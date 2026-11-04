import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { GameError, cleanName, type Action, type Room } from '../../../lib/game';
import { readSmallJson } from '../../../lib/http';
import { createRoom, digest, limitWrites, listRooms, mutateRoom, readRoom, readRow } from '../../../lib/room-store';
import { accountKeys, createGuest, guestIdentity, linkGuest } from '../../../lib/identity';
import { records, leaderboard, touchPresence } from '../../../lib/records';
export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200, cookie?:string|null) {
 const headers:Record<string,string>={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}; if(cookie)headers['Set-Cookie']=cookie;
 return Response.json(data,{status,headers});
}
async function identity(request:Request) {
 if(!env.DB)throw new GameError('保存領域の準備中です',503);
 const user=await getChatGPTUser();
 if(user){const actor=await digest(`pig-house:${user.userId}`);return {actor,keys:await accountKeys(env.DB,actor),account:true};}
 const guest=await guestIdentity(env.DB,request);
 if(!guest)throw new GameError('ゲストで開始するかログインしてください',401);
 return {actor:guest.actor,keys:[guest.actor],account:false};
}
async function effective(id:string,keys:string[]){
 const row=await readRow(env.DB!,id); const room:Room=JSON.parse(row.state);
 return keys.find(k=>room.players.some(p=>p.userKey===k)||room.spectators.some(p=>p.userKey===k)||row.owner_key===k)??keys[0];
}
function failure(e:unknown){return e instanceof GameError?json({error:e.message},e.status):json({error:'処理を完了できませんでした。少し待って再試行してください'},500);}
export async function GET(request:Request){try{
 if(!env.DB)throw new GameError('保存領域の準備中です',503);
 const who=await identity(request),url=new URL(request.url);
 if(url.searchParams.has('session'))return json({ready:true,account:who.account});
 if(url.searchParams.has('records'))return json({...await records(env.DB,who.keys),ranking:await leaderboard(env.DB,url.searchParams.get('month')==='1'),account:who.account});
 const id=url.searchParams.get('room');
 if(id){const actor=await effective(id,who.keys);const room=await readRoom(env.DB,id,actor); if(room.myId)await touchPresence(env.DB,id,actor); return json({room});}
 const rooms=await listRooms(env.DB,who.actor);
 for(const key of who.keys.slice(1)){for(const r of await listRooms(env.DB,key)){const target=rooms.find(t=>t.id===r.id);if(target){target.mine ||=r.mine;target.owned ||=r.owned;}}}
 return json({rooms:who.account?rooms:rooms.filter(r=>r.mine)});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(!env.DB)throw new GameError('保存領域の準備中です',503);
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new GameError('このページから操作してください',403);
 const input=await readSmallJson(request);
 if(input.type==='guest'){
  // Per-network hash is used only for bounded abuse limits, never persisted as an address.
  const network=await digest('guest-network:'+(request.headers.get('cf-connecting-ip')??'unknown'));
  await limitWrites(env.DB,network);
  const guest=await createGuest(env.DB,request);return json({ready:true},200,guest.cookie);
 }
 const who=await identity(request);await limitWrites(env.DB,who.actor);
 if(input.type==='linkGuest'){
  if(!who.account)throw new GameError('戦績の引継ぎにはログインしてください',401);
  await linkGuest(env.DB,request,who.actor);return json({linked:true},200,'pig_guest=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
 }
 if(['create','join','spectate'].includes(String(input.type))){
  const nickname=cleanName(input.name);await env.DB.prepare('INSERT INTO profiles (actor,nickname) VALUES (?,?) ON CONFLICT(actor) DO UPDATE SET nickname=excluded.nickname').bind(who.actor,nickname).run();
 }
 if(input.type==='create'){
  for(const key of who.keys){const owned=(await listRooms(env.DB,key)).find(r=>r.owned);if(owned)return json({roomId:owned.id});}
  return json(await createRoom(env.DB,who.actor,input.name,input.password,input.rules));
 }
 if(typeof input.roomId!=='string')throw new GameError('部屋コードを確認してください');
 const actor=await effective(input.roomId,who.keys);
 return json(await mutateRoom(env.DB,actor,input as Action));
 }catch(e){return failure(e);}}
