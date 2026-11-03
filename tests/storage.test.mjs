import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { createRoom, mutateRoom, readRoom, readRow, listRooms, limitWrites } from '../lib/room-store.ts';
const requestId=()=>crypto.randomUUID();
test('real D1: creation retry, concurrent joining, CAS, reconnect, privacy, password and expiry',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],cf:false});
 try {
  const db=await mf.getD1Database('DB');const sql=await readFile(new URL('../drizzle/0000_gorgeous_deadpool.sql',import.meta.url),'utf8');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();
  const created=await Promise.all(Array.from({length:8},()=>createRoom(db,'u0','host','pass123')));assert.equal(new Set(created.map(x=>x.roomId)).size,1);const id=created[0].roomId;
  assert.equal((await listRooms(db,'u0')).length,1);
  await assert.rejects(()=>mutateRoom(db,'u1',{type:'join',roomId:id,name:'one',password:'wrong',requestId:requestId()}),/合言葉/);
  await assert.rejects(()=>readRoom(db,id,'outsider'),/参加/);
  await Promise.all(['u1','u2','u3'].map((u,i)=>mutateRoom(db,u,{type:'join',roomId:id,name:`player${i}`,password:'pass123',requestId:requestId()})));
  let view=await readRoom(db,id,'u0');assert.equal(view.players.length,4);
  const startId=requestId();await mutateRoom(db,'u0',{type:'start',roomId:id,version:view.version,requestId:startId});
  view=await readRoom(db,id,'u0');const replay=await mutateRoom(db,'u0',{type:'start',roomId:id,version:view.version-1,requestId:startId});assert.equal(replay.version,view.version);
  const snapshot=await readRow(db,id),state=JSON.parse(snapshot.state),holder=state.players.find(p=>p.id===state.keyHolderId),target=state.players.find(p=>p.id!==holder.id);
  const attempts=await Promise.allSettled(target.hand.slice(0,2).map(c=>mutateRoom(db,holder.userKey,{type:'reveal',roomId:id,version:view.version,requestId:requestId(),targetId:target.id,cardId:c.id})));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal((await readRoom(db,id,'u0')).version,view.version+1);
  const before=await readRoom(db,id,'u0');await mutateRoom(db,'u0',{type:'join',roomId:id,name:'rename-attempt',requestId:requestId()});const after=await readRoom(db,id,'u0');assert.deepEqual(after.players,before.players);
  await mutateRoom(db,'spectator',{type:'spectate',roomId:id,name:'observer',password:'pass123',requestId:requestId()});const observer=await readRoom(db,id,'spectator');assert.ok(observer.players.every(p=>p.role===null&&p.hand.every(c=>c.revealed||c.type===null)));
  const output=JSON.stringify(observer)+JSON.stringify(await listRooms(db,'u0'));for(const key of ['passwordHash','passwordSalt','userKey','owner_key','receipts','pass123'])assert.ok(!output.includes(key));
  await assert.rejects(()=>mutateRoom(db,'spectator',{type:'close',roomId:id,version:observer.version,requestId:requestId()}),/ホスト/);
  const names=Array.from({length:60},()=>limitWrites(db,'rate-test'));await Promise.all(names);await assert.rejects(()=>limitWrites(db,'rate-test'),/操作が多/);
  await db.prepare('UPDATE rooms SET expires_at = 0 WHERE id = ?').bind(id).run();await assert.rejects(()=>readRoom(db,id,'u0'),/7日/);const replacement=await createRoom(db,'u0','host');assert.notEqual(replacement.roomId,id);
  const last=await readRoom(db,replacement.roomId,'u0');await mutateRoom(db,'u0',{type:'close',roomId:last.id,version:last.version,requestId:requestId()});assert.equal((await listRooms(db,'u0')).length,0);
 } finally {await mf.dispose();}
});
