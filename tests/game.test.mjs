import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, applyAction, viewRoom, goals, publicCardId, ROUND_PAUSE_MS, shuffle } from '../lib/game.ts';
import { ROLE_POOLS, roleRule } from '../lib/role-rules.ts';
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function lobby(n) { let r = makeRoom('TEST1234','u0','隊員0'); for(let i=1;i<n;i++) r=applyAction(r,`u${i}`,{type:'join',name:`隊員${i}`}); return r; }
function start(n, seed=1) { return applyAction(lobby(n),'u0',{type:'start'},1,seeded(seed)); }
function action(r, type) { const player = r.players.find(p=>p.id===r.keyHolderId); const target = r.players.find(p=>p.id!==player.id && p.hand.some(c=>!c.revealed && (!type || c.type===type))); if(!target) return null; return {actor:player.userKey, value:{type:'reveal',targetId:target.id,cardId:publicCardId(r,target.hand.findIndex(c=>!c.revealed && (!type || c.type===type)))}}; }
test('specified role decks are shuffled, dealt N cards and leave the specified spare',()=>{
 for(const pool of ROLE_POOLS){const outcomes=new Set();for(let seed=1;seed<=100;seed++){
  const r=start(pool.players,seed*100003),rule=roleRule(pool.players);
  const expected=shuffle([...Array(pool.adventurers).fill('adventurer'),...Array(pool.guardians).fill('guardian')],seeded(seed*100003)).slice(0,pool.players);
  assert.deepEqual(r.players.map(p=>p.role),expected);
  const count=r.players.filter(p=>p.role==='guardian').length;outcomes.add(count);assert.ok(count>=rule.minGuardians&&count<=rule.maxGuardians);
  assert.equal(r.players.flatMap(p=>p.hand).filter(c=>c.type==='treasure').length,goals(pool.players).treasure);
  assert.ok(r.players.every(p=>p.hand.length===5));
 }assert.deepEqual([...outcomes].sort(),Array.from({length:roleRule(pool.players).spare+1},(_,i)=>roleRule(pool.players).minGuardians+i));}
});
test('800 seeded complete games preserve cards, counts, visibility and bounded termination',()=>{
 for(let n=3;n<=10;n++)for(let seed=1;seed<=100;seed++){
  let r=start(n,seed), count=0;const random=seeded(seed+321);let originalIds=new Set(r.players.flatMap(p=>p.hand.map(c=>c.id)));
  while(r.status==='playing'){
   assert.ok(count++ < 4*n); const actor=r.players.find(p=>p.id===r.keyHolderId);
   const options=r.players.filter(p=>p.id!==actor.id).flatMap(p=>p.hand.flatMap((c,index)=>c.revealed?[]:[{type:'reveal',targetId:p.id,cardId:publicCardId(r,index)}]));
   const before=structuredClone(r);r=applyAction(r,actor.userKey,options[Math.floor(random()*options.length)],count*10000,random);
   const cards=r.players.flatMap(p=>p.hand);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);assert.ok(cards.every(c=>originalIds.has(c.id)));
   assert.equal(cards.filter(c=>c.type==='treasure'&&!c.revealed).length+r.treasureFound,r.treasureGoal);
   assert.equal(cards.filter(c=>c.type==='trap'&&!c.revealed).length+r.trapTriggered,r.trapGoal);
   if(r.round!==before.round) {assert.equal(r.round,before.round+1);assert.equal(r.flipped,0);assert.ok(r.players.every(p=>p.hand.length===6-r.round));const remaining=before.players.flatMap(p=>p.hand.filter(c=>!c.revealed).map(c=>c.id));assert.ok(cards.every(c=>remaining.includes(c.id)));}
   if(r.status==='playing'){const view=viewRoom(r,'u0',1);assert.ok(view.players.filter(p=>p.id!==view.myId).every(p=>p.role===null&&p.hand.every(c=>c.revealed||c.type===null)));}
  }
  assert.ok(['adventurer','guardian'].includes(r.winner));
 }
});
test('round transition is synchronous and preserves exactly unopened physical cards',()=>{
 let r=start(3,15);const original=r.players.flatMap(p=>p.hand);const removed=[];
 for(let i=0;i<3;i++){const a=action(r,'empty');assert.ok(a);removed.push(r.players.find(p=>p.id===a.value.targetId).hand[Number(a.value.cardId.split(':')[2])].id);r=applyAction(r,a.actor,a.value,2,seeded(i+1));}
 assert.equal(r.round,2);assert.deepEqual(new Set(r.players.flatMap(p=>p.hand.map(c=>c.id))),new Set(original.filter(c=>!removed.includes(c.id)).map(c=>c.id)));assert.ok(r.players.every(p=>p.hand.length===4));
});
test('reconnect is a fresh private projection, never a new seat or hand',()=>{
 const r=start(4);const first=viewRoom(r,'u0',3,100);const restored=JSON.parse(JSON.stringify(r));assert.deepEqual(viewRoom(restored,'u0',3,100),first);const joined=applyAction(restored,'u0',{type:'join',name:'changed'});assert.deepEqual(joined,restored);
});
test('spectators receive no private roles, unopened card types, account IDs or password fields',()=>{
 let r=start(3);r=applyAction(r,'observer',{type:'spectate',name:'見学'});r.passwordHash='hash-value';r.passwordSalt='salt-value';r.receipts=['secret-request'];
 const view=viewRoom(r,'observer',1);assert.ok(view.players.every(p=>p.role===null && p.hand.every(c=>c.type===null)));const encoded=JSON.stringify(view);for(const forbidden of ['userKey','passwordHash','passwordSalt','receipts','hash-value','salt-value','secret-request'])assert.ok(!encoded.includes(forbidden));assert.throws(()=>viewRoom(r,'outsider',1),/参加/);
});
test('invalid actions fail without mutating input',()=>{
 const r=start(3),snapshot=JSON.stringify(r),a=action(r);
 for(const [who,cmd] of [['outsider',a.value],[a.actor,{...a.value,targetId:r.keyHolderId}],[a.actor,{...a.value,cardId:undefined}],['u0',{type:'start'}],['u0',{type:'leave'}],['outsider',{type:'join',name:'new'}],['u0',{type:'unknown'}]])assert.throws(()=>applyAction(r,who,cmd));
 assert.equal(JSON.stringify(r),snapshot);const next=applyAction(r,a.actor,a.value);assert.throws(()=>applyAction(next,a.actor,a.value));
});
test('name normalization, duplicates, capacity, spectators and invalid counts',()=>{
 let r=makeRoom('TEST1234','host','Ａlice');assert.throws(()=>applyAction(r,'u1',{type:'join',name:'alice'}),/同じ/);for(const name of ['',null,123,'x'.repeat(21),'a\u0000','<img>'])assert.throws(()=>makeRoom('TEST1234','u',name));r=lobby(10);assert.throws(()=>applyAction(r,'extra',{type:'join',name:'extra'}),/満員/);assert.throws(()=>applyAction(lobby(2),'u0',{type:'start'}),/3〜10/);
});
test('chat keeps text inert and history bounded',()=>{
 let r=lobby(3);for(let i=0;i<105;i++)r=applyAction(r,'u0',{type:'chat',message:i===104?'<img src=x onerror=alert(1)>':`message${i}`});assert.equal(r.chat.length,100);assert.equal(r.chat.at(-1).text,'<img src=x onerror=alert(1)>');assert.throws(()=>applyAction(r,'u0',{type:'chat',message:'x'.repeat(301)}));
});
test('victory is final, restart clears counters and gets fresh card IDs',()=>{
 let r=start(3,4);while(r.status==='playing'){const a=action(r,'trap')||action(r);r=applyAction(r,a.actor,a.value,(r.lastReveal?.until ?? 0)+10000);}const oldIds=new Set(r.players.flatMap(p=>p.hand.map(c=>c.id)));assert.throws(()=>applyAction(r,'u0',{type:'reveal'}));const restarted=applyAction(r,'u0',{type:'restart'});assert.equal(restarted.treasureFound,0);assert.equal(restarted.trapTriggered,0);assert.equal(restarted.round,1);assert.ok(restarted.players.flatMap(p=>p.hand).every(c=>!oldIds.has(c.id)));const waiting=applyAction(r,'u0',{type:'reset'});assert.equal(waiting.status,'waiting');assert.ok(waiting.players.every(p=>!p.hand.length&&!p.role));
});
test('leaving transfers host without touching an in-progress game',()=>{
 const r=lobby(3);const next=applyAction(r,'u0',{type:'leave'});assert.equal(next.hostId,next.players[0].id);assert.equal(next.players.length,2);
});

test('all views hide unopened positions and physical IDs, including reveal frames and finished games',()=>{
 let r=start(4,7);r=applyAction(r,'observer',{type:'spectate',name:'見学'});
 const a=action(r,'empty');r=applyAction(r,a.actor,a.value,100);
 for(const actor of ['u0','u1','observer']){
  const view=viewRoom(r,actor,2,100);const own=r.players.find(p=>p.userKey===actor);
  assert.equal(view.myCounts===null,!own);if(own)for(const type of ['treasure','trap','empty'])assert.equal(view.myCounts[type],own.hand.filter(c=>!c.revealed&&c.type===type).length);
  for(const board of [view,view.lastReveal])for(const p of board.players)for(const c of p.hand)assert.equal(c.type===null,!c.revealed);
  const serialized=JSON.stringify(view);for(const id of r.players.flatMap(p=>p.hand.map(c=>c.id)))assert.ok(!serialized.includes(id));
  for(const forbidden of ['userKey','passwordHash','passwordSalt','receipts','roleSetup'])assert.ok(!serialized.includes(forbidden));
  assert.ok(view.players.filter(p=>p.id!==view.myId).every(p=>p.role===null));
 }
 r.status='finished';const finished=viewRoom(r,'u0',3);assert.ok(finished.players.every(p=>p.role && p.hand.every(c=>c.revealed||c.type===null)));
});
test('last reveal survives the atomic redeal, deadline gates actions and old public slots expire',()=>{
 let r=start(3,15);const oldIds=viewRoom(r,'u0',1).players[0].hand.map(c=>c.id);
 for(let i=0;i<3;i++){const a=action(r,'empty');r=applyAction(r,a.actor,a.value,100+i);}
 assert.equal(r.round,2);assert.equal(r.lastReveal.round,1);assert.equal(r.lastReveal.players.flatMap(p=>p.hand).filter(c=>c.revealed).length,3);
 assert.equal(r.lastReveal.until,102+ROUND_PAUSE_MS);
 const a=action(r);const before=JSON.stringify(r);assert.throws(()=>applyAction(r,a.actor,a.value,r.lastReveal.until-1),/確認中/);assert.equal(JSON.stringify(r),before);
 assert.throws(()=>applyAction(r,a.actor,{...a.value,cardId:oldIds[0]},r.lastReveal.until),/選べません/);
 assert.doesNotThrow(()=>applyAction(r,a.actor,a.value,r.lastReveal.until));
 assert.ok(viewRoom(r,'u0',2).players.every(p=>p.hand.every(c=>!oldIds.includes(c.id))));
});
test('round chat history stays bounded per round and is preserved on victory and cleared on restart and reset',()=>{
 let r=start(3,15);r=applyAction(r,'u0',{type:'chat',message:'round-one'});
 for(let i=0;i<3;i++){const a=action(r,'empty');r=applyAction(r,a.actor,a.value,100+i);}
 for(let i=0;i<120;i++)r=applyAction(r,'u0',{type:'chat',message:'round-two-'+i});
 assert.ok(r.chat.some(m=>m.text==='round-one'));assert.equal(r.chat.filter(m=>m.kind==='message'&&m.round===2).length,100);
 assert.deepEqual(r.chat.filter(m=>m.kind==='round').map(m=>m.round),[1,2]);
 while(r.status==='playing'){const a=action(r,'trap')||action(r);r=applyAction(r,a.actor,a.value,(r.lastReveal?.until??0)+10000);}
 assert.ok(r.chat.some(m=>m.text==='round-one'));r=applyAction(r,'u0',{type:'chat',message:'after-game'});
 assert.equal(applyAction(r,'u0',{type:'reset'}).chat.length,0);
 const restart=applyAction(r,'u0',{type:'restart'});assert.equal(restart.chat.length,1);assert.equal(restart.chat[0].kind,'round');assert.equal(restart.gameNumber,r.gameNumber+1);
});
