import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCardId, makeRoom, applyAction } from '../lib/game.ts';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { createRoom, mutateRoom, readRoom, readRow, listRooms, limitWrites, RETENTION } from '../lib/room-store.ts';
const requestId=()=>crypto.randomUUID();
test('real D1: creation retry, concurrent joining, CAS, reconnect, privacy, password and expiry',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],cf:false});
 try {
  const db=await mf.getD1Database('DB');const sql=(await Promise.all(['0000_gorgeous_deadpool','0001_chubby_hex'].map(f=>readFile(new URL('../drizzle/'+f+'.sql',import.meta.url),'utf8')))).join('--> statement-breakpoint');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();
  const created=await Promise.all(Array.from({length:8},()=>createRoom(db,'u0','host','pass123')));assert.equal(new Set(created.map(x=>x.roomId)).size,1);const id=created[0].roomId;
  assert.equal((await listRooms(db,'u0')).length,1);
  await assert.rejects(()=>mutateRoom(db,'u1',{type:'join',roomId:id,name:'one',password:'wrong',requestId:requestId()}),/合言葉/);
  await assert.rejects(()=>readRoom(db,id,'outsider'),/参加/);
  await Promise.all(['u1','u2','u3'].map((u,i)=>mutateRoom(db,u,{type:'join',roomId:id,name:`player${i}`,password:'pass123',requestId:requestId()})));
  let view=await readRoom(db,id,'u0');assert.equal(view.players.length,4);
  const startId=requestId();await mutateRoom(db,'u0',{type:'start',roomId:id,version:view.version,requestId:startId});
  view=await readRoom(db,id,'u0');const replay=await mutateRoom(db,'u0',{type:'start',roomId:id,version:view.version-1,requestId:startId});assert.equal(replay.version,view.version);
  const snapshot=await readRow(db,id),state=JSON.parse(snapshot.state),holder=state.players.find(p=>p.id===state.keyHolderId),target=state.players.find(p=>p.id!==holder.id);
  const attempts=await Promise.allSettled(target.hand.slice(0,2).map((c,index)=>mutateRoom(db,holder.userKey,{type:'reveal',roomId:id,version:view.version,requestId:requestId(),targetId:target.id,cardId:publicCardId(state,index)})));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal((await readRoom(db,id,'u0')).version,view.version+1);
  const before=await readRoom(db,id,'u0');await mutateRoom(db,'u0',{type:'join',roomId:id,name:'rename-attempt',requestId:requestId()});const after=await readRoom(db,id,'u0');assert.deepEqual(after.players,before.players);
  await mutateRoom(db,'spectator',{type:'spectate',roomId:id,name:'observer',password:'pass123',requestId:requestId()});const observer=await readRoom(db,id,'spectator');assert.ok(observer.players.every(p=>p.role===null&&p.hand.every(c=>c.revealed||c.type===null)));
  const output=JSON.stringify(observer)+JSON.stringify(await listRooms(db,'u0'));for(const key of ['passwordHash','passwordSalt','userKey','owner_key','receipts','pass123'])assert.ok(!output.includes(key));
  await assert.rejects(()=>mutateRoom(db,'spectator',{type:'close',roomId:id,version:observer.version,requestId:requestId()}),/ホスト/);
  const names=Array.from({length:60},()=>limitWrites(db,'rate-test'));await Promise.all(names);await assert.rejects(()=>limitWrites(db,'rate-test'),/操作が多/);
  await db.prepare('UPDATE rooms SET expires_at = 0 WHERE id = ?').bind(id).run();await assert.rejects(()=>readRoom(db,id,'u0'),/6時間/);const replacement=await createRoom(db,'u0','host');assert.notEqual(replacement.roomId,id);
  const last=await readRoom(db,replacement.roomId,'u0');await mutateRoom(db,'u0',{type:'close',roomId:last.id,version:last.version,requestId:requestId()});assert.equal((await listRooms(db,'u0')).length,0);
 } finally {await mf.dispose();}
});

test('six-hour boundary applies to legacy rows; reads, invalid actions and retries cannot renew expiry',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],cf:false});
 const actualNow=Date.now;let now=actualNow();Date.now=()=>now;
 try{
  const db=await mf.getD1Database('DB');const sql=(await Promise.all(['0000_gorgeous_deadpool','0001_chubby_hex'].map(f=>readFile(new URL('../drizzle/'+f+'.sql',import.meta.url),'utf8')))).join('--> statement-breakpoint');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();
  const {roomId:id}=await createRoom(db,'host','host');const original=await readRow(db,id);assert.equal(original.expires_at,now+RETENTION);
  now+=1000;const view=await readRoom(db,id,'host');await listRooms(db,'host');
  await mutateRoom(db,'host',{type:'join',roomId:id,name:'ignored',requestId:requestId()});
  await assert.rejects(()=>mutateRoom(db,'host',{type:'start',roomId:id,version:view.version,requestId:requestId()}));
  assert.equal((await readRow(db,id)).updated_at,original.updated_at);
  const chatId=requestId();const chat=await mutateRoom(db,'host',{type:'chat',message:'activity',roomId:id,version:view.version,requestId:chatId});const changed=await readRow(db,id);assert.equal(changed.expires_at,now+RETENTION);
  now+=1000;await mutateRoom(db,'host',{type:'chat',message:'activity',roomId:id,version:chat.version-1,requestId:chatId});assert.equal((await readRow(db,id)).updated_at,changed.updated_at);
  await db.prepare('UPDATE rooms SET expires_at = ? WHERE id = ?').bind(changed.updated_at+7*24*3600000,id).run();
  now=changed.updated_at+RETENTION-1;assert.equal((await readRoom(db,id,'host')).id,id);
  now++;await assert.rejects(()=>readRoom(db,id,'host'),/6時間/);assert.equal((await listRooms(db,'host')).length,0);
  await assert.rejects(()=>mutateRoom(db,'host',{type:'chat',message:'too late',roomId:id,version:chat.version,requestId:requestId()}),/6時間/);
  now++;const replacement=await createRoom(db,'host','host');assert.notEqual(replacement.roomId,id);assert.equal(await db.prepare('SELECT id FROM rooms WHERE id = ?').bind(id).first(),null);
 }finally{Date.now=actualNow;await mf.dispose();}
});

test('competing final reveals commit one redeal and enforce the persisted pause across reconnects',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],cf:false});
 try{
  const db=await mf.getD1Database('DB');const sql=(await Promise.all(['0000_gorgeous_deadpool','0001_chubby_hex'].map(f=>readFile(new URL('../drizzle/'+f+'.sql',import.meta.url),'utf8')))).join('--> statement-breakpoint');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();
  let room=makeRoom('BOUNDARY','u0','host');for(let i=1;i<3;i++)room=applyAction(room,`u${i}`,{type:'join',name:`player${i}`});
  room=applyAction(room,'u0',{type:'start'});
  const moves=r=>r.players.filter(p=>p.id!==r.keyHolderId).flatMap(p=>p.hand.flatMap((c,index)=>!c.revealed&&c.type==='empty'?[{type:'reveal',targetId:p.id,cardId:publicCardId(r,index)}]:[]));
  for(let i=0;i<2;i++)room=applyAction(room,room.players.find(p=>p.id===room.keyHolderId).userKey,moves(room)[0],100);
  const actor=room.players.find(p=>p.id===room.keyHolderId).userKey;
  const now=Date.now();await db.prepare('INSERT INTO rooms (id,owner_key,state,version,updated_at,expires_at) VALUES (?,?,?,7,?,?)').bind(room.id,'u0',JSON.stringify(room),now,now+RETENTION).run();
  const move=moves(room)[0];assert.ok(move);
  const attempts=await Promise.allSettled([0,1].map(()=>mutateRoom(db,actor,{...move,roomId:room.id,version:7,requestId:requestId()})));
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);
  const row=await readRow(db,room.id),stored=JSON.parse(row.state),view=await readRoom(db,room.id,'u0');
  assert.equal(row.version,8);assert.equal(stored.round,2);assert.equal(stored.flipped,0);assert.equal(stored.lastReveal.players.flatMap(p=>p.hand).filter(c=>c.revealed).length,3);
  assert.equal(new Set(stored.players.flatMap(p=>p.hand.map(c=>c.id))).size,12);assert.equal(view.lastReveal.until,stored.lastReveal.until);
  const nextActor=stored.players.find(p=>p.id===stored.keyHolderId).userKey;
  await assert.rejects(()=>mutateRoom(db,nextActor,{...moves(stored)[0],roomId:room.id,version:8,requestId:requestId()}),/確認中/);
  assert.equal((await readRow(db,room.id)).version,8);
 }finally{await mf.dispose();}
});
