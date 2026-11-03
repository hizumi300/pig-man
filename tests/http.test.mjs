import test from 'node:test';
import assert from 'node:assert/strict';
import { readSmallJson } from '../lib/http.ts';
const req=(body,type='application/json')=>new Request('http://localhost/api/game',{method:'POST',headers:{'Content-Type':type},body});
test('HTTP input accepts bounded objects and rejects invalid shapes/types/oversized bodies',async()=>{
 assert.deepEqual(await readSmallJson(req('{"type":"start"}')),{type:'start'});
 for(const bad of ['null','[]','"text"','123','{'])await assert.rejects(()=>readSmallJson(req(bad)));
 await assert.rejects(()=>readSmallJson(req('{}','text/plain')),e=>e.status===415);
 await assert.rejects(()=>readSmallJson(req(JSON.stringify({text:'あ'.repeat(3000)}))),e=>e.status===413);
});
