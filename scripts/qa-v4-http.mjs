// Local-only black-box HTTP exercise. Credentials stay in process memory.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787';
async function request(cookie='',body,query='',extra={}){const r=await fetch(base+'/api/game'+query,{method:body?'POST':'GET',headers:{cookie,origin:base,...(body?{'content-type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const data=await r.json();return{r,data};}
const clients=[];for(let i=0;i<6;i++){const g=await request('',{type:'guest'});assert.equal(g.r.status,200);clients.push(g.r.headers.get('set-cookie').split(';')[0]);}
assert.equal((await request('',undefined,'?session=1')).r.status,401);
assert.equal((await request(clients[0],{type:'guest'},'',{origin:'https://other.invalid'})).r.status,403);
const created=await request(clients[0],{type:'create',name:'HTTP隊長',rules:{mode:'custom',capacity:6,guardians:2,traps:2,appraiser:true,keeper:true}});assert.equal(created.r.status,200);const id=created.data.roomId;
for(let i=1;i<6;i++)assert.equal((await request(clients[i],{type:'join',name:'HTTP隊員'+i,roomId:id,requestId:crypto.randomUUID()})).r.status,200);
let views=await Promise.all(clients.map(c=>request(c,undefined,'?room='+id).then(x=>x.data.room)));
const move=async(i,type,extra={})=>{const fresh=(await request(clients[i],undefined,'?room='+id)).data.room;const result=await request(clients[i],{type,roomId:id,version:fresh.version,requestId:crypto.randomUUID(),...extra});assert.equal(result.r.status,200,JSON.stringify(result.data));return result.data;};
let room=await move(0,'start');await move(0,'chat',{message:'終了後も残る会話'});
views=await Promise.all(clients.map(c=>request(c,undefined,'?room='+id).then(x=>x.data.room)));
const appraiser=views.findIndex(v=>v.players.find(p=>p.id===v.myId).special==='appraiser');assert.ok(appraiser>=0);const target=views[appraiser].players.find(p=>p.id!==views[appraiser].myId);
const inspected=await move(appraiser,'inspect',{targetId:target.id,cardId:target.hand[0].id});assert.ok(inspected.myIntel.cardType);
let turns=0;
while(room.status==='playing'){
 const fresh=(await request(clients[0],undefined,'?room='+id)).data.room;
 if(fresh.lastReveal?.until>fresh.serverNow)await new Promise(r=>setTimeout(r,fresh.lastReveal.until-fresh.serverNow+30));
 const holder=views.findIndex(v=>v.myId===fresh.keyHolderId);const t=fresh.players.find(p=>p.id!==fresh.keyHolderId&&p.hand.some(c=>!c.revealed));
 room=await move(holder,'reveal',{targetId:t.id,cardId:t.hand.find(c=>!c.revealed).id});assert.ok(++turns<=24);
}
assert.ok(room.chat.some(m=>m.text==='終了後も残る会話'));
for(const cookie of clients){const s=await request(cookie,undefined,'?records=1');assert.equal(s.data.total.games,1);assert.ok(s.data.ranking.every(r=>r.nickname!=='HTTP隊長'));}
const accountHeaders={'oai-authenticated-user-id':'local-v4-transfer','oai-authenticated-user-email':'synthetic@example.invalid'};
assert.equal((await request(clients[0],{type:'linkGuest'},'',accountHeaders)).r.status,200);
assert.equal((await request(clients[0],undefined,'?session=1')).r.status,401);
const restored=await request('',undefined,'?room='+id,accountHeaders);assert.equal(restored.data.room.myId,views[0].myId);
assert.equal((await request('',undefined,'?records=1',accountHeaders)).data.total.games,1);
console.log(JSON.stringify({localOnly:true,players:6,custom:true,turns,guestReconnect:true,secretInspection:true,chatRetained:true,records:true,accountTransfer:true,csrf:true,productionWrites:0}));
