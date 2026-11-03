import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, applyAction, viewRoom, goals, guardianCount } from '../lib/game.ts';
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function lobby(n) { let r = makeRoom('TEST1234','u0','隊員0'); for(let i=1;i<n;i++) r=applyAction(r,`u${i}`,{type:'join',name:`隊員${i}`}); return r; }
function start(n, seed=1) { return applyAction(lobby(n),'u0',{type:'start'},1,seeded(seed)); }
function action(r, type) { const player = r.players.find(p=>p.id===r.keyHolderId); const target = r.players.find(p=>p.id!==player.id && p.hand.some(c=>!c.revealed && (!type || c.type===type))); if(!target) return null; return {actor:player.userKey, value:{type:'reveal',targetId:target.id,cardId:target.hand.find(c=>!c.revealed && (!type || c.type===type)).id}}; }
test('upstream role and deck counts retained for every supported player count',()=>{
 for(let n=3;n<=10;n++){const r=start(n);assert.equal(r.players.filter(p=>p.role==='guardian').length,guardianCount(n));assert.equal(r.players.flatMap(p=>p.hand).filter(c=>c.type==='treasure').length,goals(n).treasure);assert.equal(r.players.flatMap(p=>p.hand).filter(c=>c.type==='trap').length,goals(n).trap);assert.ok(r.players.every(p=>p.hand.length===5));}
});
test('800 seeded complete games preserve cards, counts, visibility and bounded termination',()=>{
 for(let n=3;n<=10;n++)for(let seed=1;seed<=100;seed++){
  let r=start(n,seed), count=0;const random=seeded(seed+321);let originalIds=new Set(r.players.flatMap(p=>p.hand.map(c=>c.id)));
  while(r.status==='playing'){
   assert.ok(count++ < 4*n); const actor=r.players.find(p=>p.id===r.keyHolderId);
   const options=r.players.filter(p=>p.id!==actor.id).flatMap(p=>p.hand.filter(c=>!c.revealed).map(c=>({type:'reveal',targetId:p.id,cardId:c.id})));
   const before=structuredClone(r);r=applyAction(r,actor.userKey,options[Math.floor(random()*options.length)],count,random);
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
 for(let i=0;i<3;i++){const a=action(r,'empty');assert.ok(a);removed.push(a.value.cardId);r=applyAction(r,a.actor,a.value,2,seeded(i+1));}
 assert.equal(r.round,2);assert.deepEqual(new Set(r.players.flatMap(p=>p.hand.map(c=>c.id))),new Set(original.filter(c=>!removed.includes(c.id)).map(c=>c.id)));assert.ok(r.players.every(p=>p.hand.length===4));
});
test('reconnect is a fresh private projection, never a new seat or hand',()=>{
 const r=start(4);const first=viewRoom(r,'u0',3);const restored=JSON.parse(JSON.stringify(r));assert.deepEqual(viewRoom(restored,'u0',3),first);const joined=applyAction(restored,'u0',{type:'join',name:'changed'});assert.deepEqual(joined,restored);
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
 let r=lobby(3);for(let i=0;i<65;i++)r=applyAction(r,'u0',{type:'chat',message:i===64?'<img src=x onerror=alert(1)>':`message${i}`});assert.equal(r.chat.length,60);assert.equal(r.chat.at(-1).text,'<img src=x onerror=alert(1)>');assert.throws(()=>applyAction(r,'u0',{type:'chat',message:'x'.repeat(301)}));
});
test('victory is final, restart clears counters and gets fresh card IDs',()=>{
 let r=start(3,4);while(r.status==='playing'){const a=action(r,'trap')||action(r);r=applyAction(r,a.actor,a.value);}const oldIds=new Set(r.players.flatMap(p=>p.hand.map(c=>c.id)));assert.throws(()=>applyAction(r,'u0',{type:'reveal'}));const restarted=applyAction(r,'u0',{type:'restart'});assert.equal(restarted.treasureFound,0);assert.equal(restarted.trapTriggered,0);assert.equal(restarted.round,1);assert.ok(restarted.players.flatMap(p=>p.hand).every(c=>!oldIds.has(c.id)));const waiting=applyAction(r,'u0',{type:'reset'});assert.equal(waiting.status,'waiting');assert.ok(waiting.players.every(p=>!p.hand.length&&!p.role));
});
test('leaving transfers host without touching an in-progress game',()=>{
 const r=lobby(3);const next=applyAction(r,'u0',{type:'leave'});assert.equal(next.hostId,next.players[0].id);assert.equal(next.players.length,2);
});
