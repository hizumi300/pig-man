import { digest } from './room-store.ts';
import { GameError } from './game.ts';
export const GUEST_COOKIE='pig_guest';
const LIFE=30*24*3600000;
export function guestToken(request:Request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(GUEST_COOKIE+'='))?.slice(GUEST_COOKIE.length+1)??'';}
export async function guestIdentity(db:D1Database,request:Request){
 const token=guestToken(request); if(!/^[a-f0-9]{64}$/.test(token))return null;
 return db.prepare('SELECT actor FROM guest_sessions WHERE token_hash = ? AND expires_at > ? AND account_key IS NULL').bind(await digest(token),Date.now()).first<{actor:string}>();
}
export async function createGuest(db:D1Database,request:Request){
 const existing=await guestIdentity(db,request); if(existing)return {actor:existing.actor,cookie:null};
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const actor='g:'+crypto.randomUUID();
 await db.prepare('INSERT INTO guest_sessions (token_hash,actor,expires_at) VALUES (?,?,?)').bind(await digest(token),actor,Date.now()+LIFE).run();
 return {actor,cookie:`${GUEST_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LIFE/1000}${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
export async function accountKeys(db:D1Database,account:string){
 const rows=await db.prepare('SELECT actor FROM guest_sessions WHERE account_key = ?').bind(account).all<{actor:string}>();return [account,...rows.results.map(r=>r.actor)];
}
export async function linkGuest(db:D1Database,request:Request,account:string){
 const token=guestToken(request);
 if(!/^[a-f0-9]{64}$/.test(token))throw new GameError('引き継げるゲスト情報がありません');
 const row=await db.prepare('SELECT actor,account_key FROM guest_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first<{actor:string;account_key:string|null}>();
 if(!row || (row.account_key && row.account_key!==account))throw new GameError('このゲスト情報は引き継げません',403);
 const active=await db.prepare('SELECT state FROM rooms WHERE expires_at>? AND updated_at>?').bind(Date.now(),Date.now()-6*3600000).all<{state:string}>();
 const keys=await accountKeys(db,account);
 for(const item of active.results){const room=JSON.parse(item.state);const members=[...room.players,...room.spectators];if(members.some((p:{userKey:string})=>p.userKey===row.actor)&&members.some((p:{userKey:string})=>keys.includes(p.userKey)&&p.userKey!==row.actor))throw new GameError('同じ部屋にゲスト席とアカウント席があります。アカウント側の席を退室してから引き継いでください',409);}
 const r=await db.prepare('UPDATE guest_sessions SET account_key=? WHERE actor=? AND (account_key IS NULL OR account_key=?)').bind(account,row.actor,account).run();
 if(!r.meta.changes)throw new GameError('他のアカウントに引き継ぎ済みです',409);
 await db.prepare('INSERT INTO profiles (actor,nickname) SELECT ?,nickname FROM profiles WHERE actor=? ON CONFLICT(actor) DO NOTHING').bind(account,row.actor).run();
}
