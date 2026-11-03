// Local built Worker only. Never target a hosted URL or use real account identities.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:8787';
const users=['local_seedy','qa-pig-one','qa-pig-two'];
async function request(user, body, id, origin=base) {
 const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=`${user}@sites.test`;}
 if(body){headers['Content-Type']='application/json';headers.Origin=origin;}
 const res=await fetch(base+'/api/game'+(id?'?room='+id:''),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 const data=await res.json();return {status:res.status,data};
}
const get=async(user,id)=>{const r=await request(user,undefined,id);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.room;};
const post=async(user,body)=>{const r=await request(user,{...body,requestId:crypto.randomUUID()});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
if(process.argv[2]==='setup'){
 assert.equal((await request(null)).status,401);
 assert.equal((await request(users[0],{type:'create',name:'QA'},undefined,'https://attacker.invalid')).status,403);
 const created=await Promise.all([post(users[0],{type:'create',name:'動作確認隊'}),post(users[0],{type:'create',name:'動作確認隊'})]);assert.equal(created[0].roomId,created[1].roomId);
 const id=created[0].roomId;
 assert.equal((await request('outsider',undefined,id)).status,403);
 for(let i=1;i<3;i++)await post(users[i],{type:'join',name:`テスト隊員${i}`,roomId:id});
 let room=await get(users[0],id);assert.equal(room.players.length,3);
 room=await post(users[0],{type:'start',roomId:id,version:room.version});assert.equal(room.status,'playing');
 const a=await get(users[0],id),b=await get(users[0],id);assert.deepEqual(a.players,b.players);
 await post('qa-observer',{type:'spectate',name:'テスト観戦者',roomId:id});
 const view=await get('qa-observer',id);assert.ok(view.players.every(p=>p.role===null&&p.hand.every(c=>c.type===null)));
 await writeFile('.sites-runtime/qa-http.json',JSON.stringify({roomId:id}));console.log(JSON.stringify({phase:'setup',roomId:id,players:3,duplicateCreate:'pass',unauthenticated:'401',csrf:'403',nonMember:'403',reconnect:'pass',spectatorPrivacy:'pass'}));
}else if(process.argv[2]==='play'){
 const {roomId:id}=JSON.parse(await readFile('.sites-runtime/qa-http.json','utf8'));let turns=0;
 while(true){const views=await Promise.all(users.map(u=>get(u,id)));const room=views[0];if(room.status==='finished'){console.log(JSON.stringify({phase:'completed',turns,round:room.round,winner:room.winner}));break;}
 assert.ok(turns++<12);const actorIndex=views.findIndex(v=>v.myId===v.keyHolderId);assert.ok(actorIndex>=0);const target=room.players.find(p=>p.id!==room.keyHolderId&&p.hand.some(c=>!c.revealed));const card=target.hand.find(c=>!c.revealed);
 const payload={type:'reveal',roomId:id,version:room.version,targetId:target.id,cardId:card.id};
 const result=await post(users[actorIndex],payload);const stale=await request(users[actorIndex],{...payload,requestId:crypto.randomUUID()});assert.equal(stale.status,409);assert.equal((await get(users[0],id)).version,result.version);
 }
}else throw new Error('Use setup or play against the local built preview');
