import { applyAction, GameError, makeRoom, viewRoom, type Action, type Room } from './game.ts';

type Row = { id: string; owner_key: string; state: string; version: number; expires_at: number; updated_at: number };
export const RETENTION = 6 * 60 * 60 * 1000;
export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
function parsePassword(value: unknown) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length < 4 || value.length > 64) throw new GameError('合言葉は4〜64文字にしてください');
  return value;
}
function roomId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z0-9]{8}$/.test(value)) throw new GameError('部屋コードを確認してください');
  return value;
}
export async function listRooms(db: D1Database, actor: string) {
  const now = Date.now();
  const rows = await db.prepare('SELECT id, owner_key, state, version, expires_at, updated_at FROM rooms WHERE expires_at > ? AND updated_at > ? ORDER BY updated_at DESC LIMIT 100').bind(now, now - RETENTION).all<Row>();
  return rows.results.map(row => {
    const r: Room = JSON.parse(row.state);
    return { id: r.id, title: r.title, count: r.players.length, status: r.status, locked: !!r.passwordHash, mine: r.players.some(p => p.userKey === actor) || r.spectators.some(p => p.userKey === actor), owned: row.owner_key === actor };
  });
}
export async function readRow(db: D1Database, id: string) {
  const now = Date.now();
  const row = await db.prepare('SELECT id, owner_key, state, version, expires_at, updated_at FROM rooms WHERE id = ? AND expires_at > ? AND updated_at > ?').bind(roomId(id), now, now - RETENTION).first<Row>();
  if (!row) throw new GameError('部屋が見つかりません。最終操作から6時間を過ぎた部屋は終了します', 404);
  return row;
}
export async function readRoom(db: D1Database, id: string, actor: string) {
  const row = await readRow(db, id);
  return viewRoom(JSON.parse(row.state), actor, row.version);
}
export async function limitWrites(db: D1Database, actor: string) {
  const minute = Math.floor(Date.now() / 60000);
  const row = await db.prepare('INSERT INTO write_limits (actor, minute, count) VALUES (?, ?, 1) ON CONFLICT(actor) DO UPDATE SET minute = excluded.minute, count = CASE WHEN write_limits.minute = excluded.minute THEN write_limits.count + 1 ELSE 1 END RETURNING count').bind(actor, minute).first<{count: number}>();
  if (!row || row.count > 60) throw new GameError('操作が多すぎます。1分ほど待ってください', 429);
}
export async function createRoom(db: D1Database, actor: string, name: unknown, passwordValue: unknown) {
  const now = Date.now();
  // One durable room per creator makes creation idempotent across tabs and retries.
  await db.batch([
    db.prepare('DELETE FROM rooms WHERE expires_at <= ? OR updated_at <= ?').bind(now, now - RETENTION),
    db.prepare('DELETE FROM write_limits WHERE minute < ?').bind(Math.floor(now / 60000) - 1440),
  ]);
  const existing = await db.prepare('SELECT id FROM rooms WHERE owner_key = ?').bind(actor).first<{id: string}>();
  if (existing) return { roomId: existing.id };
  const password = parsePassword(passwordValue);
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const room = makeRoom(id, actor, name);
  if (password) { room.passwordSalt = crypto.randomUUID(); room.passwordHash = await hashPassword(password, room.passwordSalt); }
  const result = await db.prepare('INSERT INTO rooms (id, owner_key, state, version, updated_at, expires_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT DO NOTHING').bind(id, actor, JSON.stringify(room), now, now + RETENTION).run();
  if (result.meta.changes) return { roomId: id };
  const duplicate = await db.prepare('SELECT id FROM rooms WHERE owner_key = ?').bind(actor).first<{id: string}>();
  if (duplicate) return { roomId: duplicate.id };
  throw new GameError('部屋コードが重複しました。もう一度お試しください', 409);
}
export async function mutateRoom(db: D1Database, actor: string, input: Action & { roomId?: unknown; version?: unknown; requestId?: unknown; password?: unknown }) {
  const id = roomId(input.roomId);
  if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId)) throw new GameError('操作IDが不正です');
  const receipt = `${actor}:${input.requestId}`;
  const joining = input.type === 'join' || input.type === 'spectate';
  for (let retry = 0; retry < 4; retry++) {
    const row = await readRow(db, id);
    const room: Room = JSON.parse(row.state);
    if (room.receipts.includes(receipt)) return viewRoom(room, actor, row.version);
    const member = room.players.some(p => p.userKey === actor) || room.spectators.some(p => p.userKey === actor);
    // 再接続や同じ参加要求では部屋の寿命を延ばさない。
    if (joining && (room.players.some(p => p.userKey === actor) || (input.type === 'spectate' && member))) return viewRoom(room, actor, row.version);
    if (joining && !member && room.passwordHash) {
      const password = parsePassword(input.password);
      if (!password || await hashPassword(password, room.passwordSalt!) !== room.passwordHash) throw new GameError('合言葉が違います', 403);
    }
    if (!joining && (!Number.isInteger(input.version) || input.version !== row.version)) throw new GameError('盤面が更新されました。最新の状態で操作し直してください', 409);
    if (input.type === 'close') {
      if (room.players.find(p => p.userKey === actor)?.id !== room.hostId && row.owner_key !== actor) throw new GameError('ホストだけが部屋を閉じられます', 403);
      const result = await db.prepare('DELETE FROM rooms WHERE id = ? AND version = ?').bind(id, row.version).run();
      if (!result.meta.changes) throw new GameError('部屋が更新されました。もう一度お試しください', 409);
      return { closed: true };
    }
    const next = applyAction(room, actor, input);
    next.receipts = [...next.receipts, receipt].slice(-80);
    const now = Date.now();
    if (next.players.length === 0) {
      const deleted = await db.prepare('DELETE FROM rooms WHERE id = ? AND version = ?').bind(id, row.version).run();
      if (!deleted.meta.changes) throw new GameError('部屋が更新されました。もう一度お試しください', 409);
      return { left: true };
    }
    const updated = await db.prepare('UPDATE rooms SET state = ?, version = version + 1, updated_at = ?, expires_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(next), now, now + RETENTION, id, row.version).run();
    if (updated.meta.changes) return input.type === 'leave' ? { left: true } : viewRoom(next, actor, row.version + 1);
    if (!joining) throw new GameError('別の操作が先に確定しました。最新の盤面を確認してください', 409);
  }
  throw new GameError('参加が集中しています。もう一度お試しください', 409);
}
