import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{Miniflare}from'miniflare';
import{makeRoom,applyAction,viewRoom,publicCardId}from'../lib/game.ts';import{RECOMMENDED,validRules}from'../lib/custom-rules.ts';
import{createGuest,guestIdentity,linkGuest,accountKeys}from'../lib/identity.ts';import{createRoom,readRoom,readRow,mutateRoom}from'../lib/room-store.ts';import{records,leaderboard,touchPresence}from'../lib/records.ts';
const rng=()=>{let n=83;return()=>((n=Math.imul(n,1664525)+1013904223>>>0)/2**32)};
function start(n=6,rules=RECOMMENDED){let r=makeRoom('CUSTOM12','u0','隊員0',rules);for(let i=1;i<n;i++)r=applyAction(r,'u'+i,{type:'join',name:'隊員'+i});return applyAction(r,'u0',{type:'start'},1,rng());}
function reveal(r,type,now=100000){const p=r.players.find(p=>p.id===r.keyHolderId),target=r.players.find(t=>t.id!==p.id&&t.hand.some(c=>!c.revealed&&c.type===type));if(!target)return null;return applyAction(r,p.userKey,{type:'reveal',targetId:target.id,cardId:publicCardId(r,target.hand.findIndex(c=>!c.revealed&&c.type===type))},now);}
async function database(fn){const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],cf:false});try{const db=await mf.getD1Database('DB');for(const f of ['0000_gorgeous_deadpool','0001_chubby_hex']){for(const q of(await readFile(new URL('../drizzle/'+f+'.sql',import.meta.url),'utf8')).split('--> statement-breakpoint'))if(q.trim())await db.prepare(q).run();}await fn(db);}finally{await mf.dispose();}}
test('custom roles: server validation, exact faction slots, secret one-use investigation',()=>{
 for(const rules of [{...RECOMMENDED,capacity:2},{...RECOMMENDED,guardians:6},{...RECOMMENDED,traps:0},null])assert.throws(()=>validRules(rules));
 let r=start();assert.equal(r.players.filter(p=>p.role==='guardian').length,2);assert.equal(r.players.filter(p=>p.special==='appraiser').length,1);
 const a=r.players.find(p=>p.special==='appraiser'),k=r.players.find(p=>p.special==='keeper'),t=r.players.find(p=>p.id!==a.id);assert.ok(k.intel.faction);assert.notEqual(k.intel.targetId,k.id);
 const cmd={type:'inspect',targetId:t.id,cardId:publicCardId(r,0)};const original=JSON.stringify(r);assert.throws(()=>applyAction(r,k.userKey,cmd),/鑑定/);assert.equal(JSON.stringify(r),original);
 r=applyAction(r,a.userKey,cmd);assert.equal(r.keyHolderId,JSON.parse(original).keyHolderId);assert.equal(r.flipped,0);assert.equal(r.players.find(p=>p.id===a.id).intel.cardType,t.hand[0].type);assert.throws(()=>applyAction(r,a.userKey,cmd),/鑑定/);
 r=applyAction(r,'observer',{type:'spectate',name:'見学'});
 for(const actor of [t.userKey,'observer']){const view=viewRoom(r,actor,1);assert.equal(view.myIntel,actor===k.userKey?k.intel:null);assert.ok(view.players.filter(p=>p.id!==view.myId).every(p=>p.special===null));assert.ok(view.players.every(p=>p.hand.every(c=>c.type===null)));assert.ok(!JSON.stringify(view).includes('recordActor'));}
 assert.ok(viewRoom(r,a.userKey,1).myIntel.cardType);
});
test('guest secret is hashed, expires, links once, and old cookie cannot impersonate linked account',()=>database(async db=>{
 const req=new Request('https://test.local');const g=await createGuest(db,req);assert.match(g.cookie,/HttpOnly/);assert.match(g.cookie,/Secure/);const withCookie=new Request(req,{headers:{cookie:g.cookie.split(';')[0]}});
 assert.equal((await guestIdentity(db,withCookie)).actor,g.actor);assert.equal((await createGuest(db,withCookie)).actor,g.actor);
 const row=await db.prepare('SELECT * FROM guest_sessions').first();assert.ok(!JSON.stringify(row).includes(g.cookie.split(';')[0].split('=')[1]));
 assert.equal(await guestIdentity(db,new Request(req,{headers:{cookie:'pig_guest='+ 'a'.repeat(64)}})),null);
 await linkGuest(db,withCookie,'accountA');assert.equal(await guestIdentity(db,withCookie),null);assert.deepEqual(await accountKeys(db,'accountA'),['accountA',g.actor]);await linkGuest(db,withCookie,'accountA');await assert.rejects(()=>linkGuest(db,withCookie,'accountB'));
 const other=await createGuest(db,req);await db.prepare('UPDATE guest_sessions SET expires_at=0 WHERE actor=?').bind(other.actor).run();const expired=new Request(req,{headers:{cookie:other.cookie.split(';')[0]}});assert.equal(await guestIdentity(db,expired),null);await assert.rejects(()=>linkGuest(db,expired,'accountA'));
}));
test('D1 finish is atomic, idempotent, accounts only ranking, departures and guest import',()=>database(async db=>{
 const {roomId}=await createRoom(db,'account0','隊員0');let v=await readRoom(db,roomId,'account0');
 const g=await createGuest(db,new Request('https://test.local'));const actors=['account0','account1',g.actor];
 for(let i=1;i<3;i++)await mutateRoom(db,actors[i],{type:'join',name:'隊員'+i,roomId,requestId:crypto.randomUUID()});
 for(const actor of actors)await db.prepare('INSERT INTO profiles(actor,nickname) VALUES(?,?)').bind(actor,'ニックネーム').run();
 v=await readRoom(db,roomId,'account0');await mutateRoom(db,'account0',{type:'start',roomId,version:v.version,requestId:crypto.randomUUID()});
 let row=await readRow(db,roomId),r=JSON.parse(row.state);assert.ok(r.matchId);assert.equal(r.players.find(p=>p.userKey===g.actor).ranked,false);
 // Synthetic boundary setup in local D1 only: next trap ends the match.
 r.trapTriggered=r.trapGoal-1;let holder=r.players.find(p=>p.id===r.keyHolderId);let target=r.players.find(p=>p.id!==holder.id);target.hand[0].type='trap';
 await db.prepare('UPDATE rooms SET state=? WHERE id=?').bind(JSON.stringify(r),roomId).run();
 const absent=r.players.find(p=>p.id!==holder.id);await db.prepare('UPDATE presence SET seen=? WHERE id=?').bind(Date.now()-120001,roomId+':'+absent.userKey).run();
 const cmd={type:'reveal',roomId,version:row.version,requestId:crypto.randomUUID(),targetId:target.id,cardId:publicCardId(r,0)};
 const attempts=await Promise.allSettled([mutateRoom(db,holder.userKey,cmd),mutateRoom(db,holder.userKey,{...cmd,requestId:crypto.randomUUID()})]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 await mutateRoom(db,holder.userKey,cmd);assert.equal((await db.prepare('SELECT COUNT(*) n FROM results').first()).n,3);
 assert.equal((await records(db,[absent.userKey])).total.departures,1);assert.equal((await records(db,[absent.userKey])).total.wins,0);
 const board=await leaderboard(db,false);assert.equal(board.reduce((n,r)=>n+r.games,0),2);assert.ok(!JSON.stringify(board).includes('account'));
 const guestRequest=new Request('https://test.local',{headers:{cookie:g.cookie.split(';')[0]}});await linkGuest(db,guestRequest,'newAccount');const keys=await accountKeys(db,'newAccount');assert.equal((await records(db,keys)).total.games,1);assert.equal((await leaderboard(db,false)).reduce((n,r)=>n+r.games,0),2);
}));
test('custom 3–10 players, 1–5 traps: bounded completion and private information at every round',()=>{
 for(let n=3;n<=10;n++)for(let traps=1;traps<=5;traps++){
  let r=start(n,{...RECOMMENDED,capacity:n,guardians:1,traps,appraiser:n>=5,keeper:n>=5});const original=new Set(r.players.flatMap(p=>p.hand.map(c=>c.id)));let turns=0;
  while(r.status==='playing'){
   const appraiser=r.players.find(p=>p.special==='appraiser');if(appraiser&&!appraiser.abilityUsed){const target=r.players.find(p=>p.id!==appraiser.id&&p.hand.some(c=>!c.revealed));r=applyAction(r,appraiser.userKey,{type:'inspect',targetId:target.id,cardId:publicCardId(r,target.hand.findIndex(c=>!c.revealed))},(r.lastReveal?.until??0)+1);}
   r=reveal(r,'empty',++turns*10000)||reveal(r,'treasure',turns*10000)||reveal(r,'trap',turns*10000);assert.ok(turns<=4*n);
   assert.equal(r.players.flatMap(p=>p.hand).filter(c=>!c.revealed&&c.type==='trap').length+r.trapTriggered,traps);
   assert.ok(r.players.flatMap(p=>p.hand).every(c=>original.has(c.id)));
   for(const p of r.players){const v=viewRoom(r,p.userKey,1);assert.ok(v.players.filter(t=>t.id!==p.id).every(t=>r.status==='finished'||(!t.role&&!t.special)));}
  }
 }
});
test('guest transfer refuses two seats in one room; monthly leaderboard uses JST boundary',()=>database(async db=>{
 const g=await createGuest(db,new Request('https://test.local'));const req=new Request('https://test.local',{headers:{cookie:g.cookie.split(';')[0]}});
 const created=await createRoom(db,g.actor,'ゲスト');await mutateRoom(db,'accountX',{type:'join',name:'ログイン',roomId:created.roomId,requestId:crypto.randomUUID()});await assert.rejects(()=>linkGuest(db,req,'accountX'),/ゲスト席/);assert.ok(await guestIdentity(db,req));
 await db.prepare('INSERT INTO profiles(actor,nickname) VALUES(?,?)').bind('accountX','公開名').run();
 const now=new Date(Date.now()+9*3600000),boundary=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)-9*3600000;
 for(let i=0;i<2;i++)await db.prepare('INSERT INTO results(id,actor,match_id,ended_at,players,won,departed,ranked,mode,nickname) VALUES(?,?,?,?,3,1,0,1,?,?)').bind('monthly'+i,'accountX','match'+i,boundary-1+i,'standard','公開名').run();
 assert.equal((await leaderboard(db,false))[0].games,2);assert.equal((await leaderboard(db,true))[0].games,1);
}));
