import { GameError } from './game.ts';
export async function readSmallJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new GameError('JSON形式で送信してください', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError('送信内容が不正です');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); throw new GameError('送信内容が大きすぎます', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  let input: unknown;
  try { input = JSON.parse(new TextDecoder().decode(all)); } catch { throw new GameError('送信内容が不正です'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new GameError('送信内容が不正です');
  return input as Record<string, unknown>;
}
