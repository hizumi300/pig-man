// Pure game rules. Storage, authentication, transport and UI are deliberately separate.
import { roleRule } from './role-rules.ts';
export type CardType = 'treasure' | 'trap' | 'empty';
export type Role = 'adventurer' | 'guardian';
export type Card = { id: string; type: CardType; revealed: boolean };
export type Player = { id: string; userKey: string; name: string; hand: Card[]; role: Role | null };
export type Entry = { id: string; text: string; name: string; at: number; round?: number; gameNumber?: number; kind?: 'message' | 'round' };
export const ROUND_PAUSE_MS = 3000;
export type RevealFrame = {
  id: string; gameNumber: number; round: number; at: number; until: number;
  targetId: string; cardId: string; treasureFound: number; trapTriggered: number; flipped: number;
  players: { id: string; hand: Card[] }[];
};
export type Room = {
  id: string; title: string; hostId: string; status: 'waiting' | 'playing' | 'finished';
  players: Player[]; spectators: { userKey: string; name: string }[];
  round: number; flipped: number; keyHolderId: string | null; treasureGoal: number; trapGoal: number;
  treasureFound: number; trapTriggered: number; winner: Role | null;
  logs: Entry[]; chat: Entry[]; receipts: string[]; gameNumber: number;
  passwordHash: string | null; passwordSalt: string | null;
  roleSetup?: { gameNumber: number; version: 2 };
  lastReveal?: RevealFrame | null;
};
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function requireThat(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new GameError(message, status);
}
export function cleanName(value: unknown): string {
  requireThat(typeof value === 'string', '表示名を入力してください');
  const name = value.normalize('NFKC').trim();
  requireThat(name.length >= 1 && name.length <= 20 && !/[\p{Cc}\p{Cf}<>]/u.test(name), '表示名は1〜20文字で入力してください（制御文字・<>は使えません）');
  return name;
}
export function shuffle<T>(input: T[], random: () => number = secureRandom): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function secureRandom() { return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; }
export function goals(n: number) {
  requireThat(Number.isInteger(n) && n >= 3 && n <= 10, 'ゲーム開始には3〜10人必要です');
  return { treasure: n <= 6 ? n + 2 : n, trap: n === 10 ? 3 : 2 };
}
// 外向けIDはそのラウンドの位置だけを表す。物理カードIDを次ラウンドへ追跡させない。
export function publicCardId(room: { gameNumber: number; round: number }, index: number) { return `${room.gameNumber}:${room.round}:${index}`; }
function handView(room: { gameNumber: number; round: number }, hand: Card[]) {
  return hand.map((c, index) => ({ id: publicCardId(room, index), revealed: c.revealed, type: c.revealed ? c.type : null }));
}
function handCounts(hand: Card[]) {
  const counts = { treasure: 0, trap: 0, empty: 0 };
  hand.filter(c => !c.revealed).forEach(c => counts[c.type]++);
  return counts;
}
function roundMarker(room: Room, now: number) {
  room.chat.push({ id: crypto.randomUUID(), kind: 'round', gameNumber: room.gameNumber, round: room.round, name: '', text: `ラウンド ${room.round}`, at: now });
}
export function makeRoom(id: string, userKey: string, name: unknown): Room {
  const player: Player = { id: crypto.randomUUID(), userKey, name: cleanName(name), hand: [], role: null };
  return { id, title: `${player.name}の探検隊`, hostId: player.id, status: 'waiting', players: [player], spectators: [], round: 0, flipped: 0, keyHolderId: null, treasureGoal: 0, trapGoal: 0, treasureFound: 0, trapTriggered: 0, winner: null, logs: [], chat: [], receipts: [], gameNumber: 0, passwordHash: null, passwordSalt: null };
}
function log(room: Room, text: string, now: number) {
  room.logs = [...room.logs, { id: crypto.randomUUID(), text, name: '', at: now }].slice(-60);
}
// Preserve the physical IDs of all unopened cards. Exactly N revealed cards are
// removed each round, so the remaining deck is N * (6 - nextRound), without invention.
function deal(room: Room, pool: Card[], random: () => number) {
  const perPlayer = 6 - room.round;
  requireThat(pool.length === room.players.length * perPlayer, 'カード保存則が一致しません', 500);
  requireThat(new Set(pool.map(c => c.id)).size === pool.length, 'カードIDが重複しています', 500);
  const deck = shuffle(pool, random);
  room.players.forEach((p, i) => { p.hand = deck.slice(i * perPlayer, (i + 1) * perPlayer); });
}
export type Action = { type: string; name?: unknown; message?: unknown; targetId?: unknown; cardId?: unknown };
export function applyAction(original: Room, actor: string, action: Action, now = Date.now(), random: () => number = secureRandom): Room {
  const room = structuredClone(original);
  const player = room.players.find(p => p.userKey === actor);
  const spectator = room.spectators.find(p => p.userKey === actor);
  if (action.type === 'join' || action.type === 'spectate') {
    if (player || (spectator && action.type === 'spectate')) return room;
    const name = cleanName(action.name);
    requireThat(![...room.players, ...room.spectators.filter(s => s.userKey !== actor)].some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase()), '同じ表示名の人がいます。別の名前にしてください');
    if (action.type === 'join') {
      requireThat(room.status === 'waiting', 'ゲーム開始後は観戦で参加してください');
      requireThat(room.players.length < 10, 'この部屋は満員です');
      room.spectators = room.spectators.filter(p => p.userKey !== actor);
      room.players.push({ id: crypto.randomUUID(), userKey: actor, name, hand: [], role: null });
      log(room, `${name}が探検隊に加わりました`, now);
    } else {
      requireThat(room.spectators.length < 50, '観戦席が満員です');
      room.spectators.push({ userKey: actor, name });
    }
    return room;
  }
  requireThat(player || spectator, '先に部屋に参加してください', 403);
  switch (action.type) {
    case 'leave': {
      if (spectator) { room.spectators = room.spectators.filter(p => p.userKey !== actor); break; }
      requireThat(room.status !== 'playing', '探検中は席と手札を保持します。ロビーに戻っても同じアカウントで再開できます');
      room.players = room.players.filter(p => p.userKey !== actor);
      if (room.hostId === player!.id) room.hostId = room.players[0]?.id ?? '';
      log(room, `${player!.name}が退室しました`, now);
      break;
    }
    case 'start':
    case 'restart': {
      requireThat(player?.id === room.hostId, 'ホストだけが開始できます', 403);
      requireThat(action.type === 'start' ? room.status === 'waiting' : room.status === 'finished', '現在の状態では開始できません', 409);
      const n = room.players.length, goal = goals(n);
      room.status = 'playing'; room.round = 1; room.flipped = 0; room.winner = null;
      room.treasureFound = 0; room.trapTriggered = 0; room.treasureGoal = goal.treasure; room.trapGoal = goal.trap;
      room.gameNumber++; room.logs = []; room.chat = []; room.lastReveal = null;
      room.roleSetup = { gameNumber: room.gameNumber, version: 2 };
      roundMarker(room, now);
      const pool = roleRule(n)!;
      const roles = shuffle([...Array<Role>(pool.adventurers).fill('adventurer'), ...Array<Role>(pool.guardians).fill('guardian')], random).slice(0, n);
      room.players.forEach((p, i) => { p.role = roles[i]; });
      const cards = Array.from({ length: n * 5 }, (_, i): Card => ({ id: crypto.randomUUID(), type: i < goal.treasure ? 'treasure' : i < goal.treasure + goal.trap ? 'trap' : 'empty', revealed: false }));
      deal(room, cards, random);
      room.keyHolderId = room.players[Math.floor(random() * n)].id;
      log(room, '探検開始！鍵を持つ人が、他の隊員の部屋を1つ開きます', now);
      break;
    }
    case 'reveal': {
      requireThat(room.status === 'playing', '探検中ではありません', 409);
      requireThat(!room.lastReveal || room.lastReveal.gameNumber !== room.gameNumber || now >= room.lastReveal.until, '最後のカードを確認中です。次のラウンドまで少しお待ちください', 409);
      requireThat(player?.id === room.keyHolderId, '今はあなたの番ではありません', 403);
      requireThat(typeof action.targetId === 'string' && action.targetId !== player!.id, '他の隊員の部屋を選んでください');
      const target = room.players.find(p => p.id === action.targetId);
      const card = target?.hand.find((c, index) => publicCardId(room, index) === action.cardId);
      requireThat(target && card && !card.revealed, 'このカードは選べません。最新の盤面を確認してください', 409);
      card.revealed = true; room.flipped++; room.keyHolderId = target.id;
      if (card.type === 'treasure') room.treasureFound++;
      if (card.type === 'trap') room.trapTriggered++;
      log(room, `${player!.name} → ${target.name}の部屋：${{ treasure: '子豚を救出！', trap: '罠が発動！', empty: '空き部屋' }[card.type]}`, now);
      room.lastReveal = {
        id: crypto.randomUUID(), gameNumber: room.gameNumber, round: room.round, at: now, until: now,
        targetId: target.id, cardId: String(action.cardId), treasureFound: room.treasureFound,
        trapTriggered: room.trapTriggered, flipped: room.flipped,
        players: room.players.map(p => ({ id: p.id, hand: structuredClone(p.hand) })),
      };
      if (room.treasureFound >= room.treasureGoal) room.winner = 'adventurer';
      else if (room.trapTriggered >= room.trapGoal) room.winner = 'guardian';
      else if (room.flipped === room.players.length) {
        if (room.round === 4) room.winner = 'guardian';
        else {
          const unopened = room.players.flatMap(p => p.hand.filter(c => !c.revealed));
          room.round++; room.flipped = 0; deal(room, unopened, random);
          room.lastReveal.until = now + ROUND_PAUSE_MS;
          roundMarker(room, now);
          log(room, `ラウンド${room.round}：未公開カードを回収し、1人${6 - room.round}枚ずつ再配布しました`, now);
        }
      }
      if (room.winner) {
        room.status = 'finished'; room.chat = [];
        room.lastReveal.until = now + ROUND_PAUSE_MS;
        log(room, room.winner === 'adventurer' ? '全ての子豚を救出！探検家チームの勝利' : '豚男チームの勝利！探検隊は脱出できませんでした', now);
      }
      break;
    }
    case 'chat': {
      requireThat(typeof action.message === 'string', 'メッセージを入力してください');
      const text = action.message.trim();
      requireThat(text.length > 0 && text.length <= 300 && !/[\p{Cc}\p{Cf}]/u.test(text), 'メッセージは1〜300文字で入力してください');
      // 各ラウンドの最新100件を残す。他ラウンドの会話を投稿連打で消さない。
      const round = room.status === 'playing' ? room.round : 0;
      const sameRound = room.chat.filter(m => m.kind !== 'round' && m.gameNumber === room.gameNumber && m.round === round);
      const remove = new Set(sameRound.slice(0, Math.max(0, sameRound.length - 99)).map(m => m.id));
      room.chat = [...room.chat.filter(m => !remove.has(m.id)), { id: crypto.randomUUID(), kind: 'message' as const, gameNumber: room.gameNumber, round, name: player?.name ?? spectator!.name, text, at: now }].slice(-505);
      break;
    }
    case 'reset': {
      requireThat(player?.id === room.hostId, 'ホストだけが待機室に戻せます', 403);
      requireThat(room.status === 'finished', '終了後に待機室へ戻せます', 409);
      room.status = 'waiting'; room.round = 0; room.keyHolderId = null; room.winner = null;
      room.treasureFound = 0; room.trapTriggered = 0; room.flipped = 0;
      room.chat = []; room.lastReveal = null;
      room.players.forEach(p => { p.hand = []; p.role = null; });
      break;
    }
    default: throw new GameError('対応していない操作です');
  }
  return room;
}
// Explicit allowlist: never serialize the stored room or its player objects directly.
export function viewRoom(room: Room, actor: string, version: number, now = Date.now()) {
  const me = room.players.find(p => p.userKey === actor);
  const spectator = room.spectators.some(p => p.userKey === actor);
  requireThat(me || spectator, 'この部屋への参加が必要です', 403);
  const frame = room.lastReveal?.gameNumber === room.gameNumber ? room.lastReveal : null;
  return {
    id: room.id, title: room.title, hostId: room.hostId, status: room.status, version, serverNow: now, gameNumber: room.gameNumber,
    legacyRoles: room.status !== 'waiting' && room.roleSetup?.gameNumber !== room.gameNumber,
    myCounts: me ? handCounts(me.hand) : null,
    lastReveal: frame ? {
      id: frame.id, gameNumber: frame.gameNumber, round: frame.round, at: frame.at, until: frame.until,
      targetId: frame.targetId, cardId: frame.cardId, treasureFound: frame.treasureFound, trapTriggered: frame.trapTriggered, flipped: frame.flipped,
      players: frame.players.map(p => ({ id: p.id, hand: handView(frame, p.hand) })),
      myCounts: me ? handCounts(frame.players.find(p => p.id === me.id)?.hand ?? []) : null,
    } : null,
    round: room.round, flipped: room.flipped, keyHolderId: room.keyHolderId,
    treasureGoal: room.treasureGoal, trapGoal: room.trapGoal, treasureFound: room.treasureFound, trapTriggered: room.trapTriggered,
    winner: room.winner, myId: me?.id ?? null, spectator: !me, spectatorCount: room.spectators.length,
    logs: room.logs, chat: room.chat,
    players: room.players.map(p => ({
      id: p.id, name: p.name,
      role: p.id === me?.id || room.status === 'finished' ? p.role : null,
      hand: handView(room, p.hand),
    })),
  };
}
export type RoomView = ReturnType<typeof viewRoom>;
