import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { GameError, type Action } from '../../../lib/game';
import { readSmallJson } from '../../../lib/http';
import { createRoom, digest, limitWrites, listRooms, mutateRoom, readRoom } from '../../../lib/room-store';

export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
}
async function identity() {
  const user = await getChatGPTUser();
  if (!user) throw new GameError('ChatGPTでログインしてください', 401);
  // Store only a pseudonymous account key; do not persist email or profile names.
  return digest(`pig-house:${user.userId}`);
}
function failure(error: unknown) {
  return error instanceof GameError ? json({ error: error.message }, error.status) : json({ error: '処理を完了できませんでした。少し待って再試行してください' }, 500);
}
export async function GET(request: Request) {
  try {
    const actor = await identity();
    if (!env.DB) throw new GameError('保存領域の準備中です', 503);
    const id = new URL(request.url).searchParams.get('room');
    return json(id ? { room: await readRoom(env.DB, id, actor) } : { rooms: await listRooms(env.DB, actor) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await identity();
    if (!env.DB) throw new GameError('保存領域の準備中です', 503);
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) throw new GameError('このページから操作してください', 403);
    const input = await readSmallJson(request);
    if (typeof input.type !== 'string') throw new GameError('操作が不正です');
    await limitWrites(env.DB, actor);
    if (input.type === 'create') return json(await createRoom(env.DB, actor, input.name, input.password));
    return json(await mutateRoom(env.DB, actor, input as Action));
  } catch (error) { return failure(error); }
}
