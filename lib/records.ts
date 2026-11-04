// Result insert is batched with the room CAS. Only the winning state can produce rows.
import type { Room } from './game.ts';
export function resultStatements(db:D1Database,room:Room,state:string,version:number,now:number){
 if(room.status!=='finished'||!room.matchId)return [];
 return room.players.map(p=>{
  const won=p.role===room.winner;
  return db.prepare(`INSERT OR IGNORE INTO results (id,actor,match_id,ended_at,players,won,departed,ranked,mode,nickname)
   SELECT ?,?,?,?,?,CASE WHEN COALESCE((SELECT seen FROM presence WHERE id=?),?) < ? THEN 0 ELSE ? END,
   CASE WHEN COALESCE((SELECT seen FROM presence WHERE id=?),?) < ? THEN 1 ELSE 0 END,?,?,?
   FROM rooms WHERE id=? AND version=? AND state=?`)
   .bind(room.matchId+':'+p.id,p.recordActor??p.userKey,room.matchId,now,room.players.length,room.id+':'+p.userKey,now,now-120000,won?1:0,room.id+':'+p.userKey,now,now-120000,p.ranked&&room.rules?.mode!=='custom'?1:0,room.rules?.mode??'standard',p.name,room.id,version,state);
 });
}
export async function touchPresence(db:D1Database,room:string,actor:string){
 await db.prepare('INSERT INTO presence (id,seen) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen WHERE presence.seen < excluded.seen - 30000').bind(room+':'+actor,Date.now()).run();
}
export async function records(db:D1Database,keys:string[]){
 const args=keys.map(()=>'?').join(',');
 const aggregate=`SELECT COUNT(*) games, COALESCE(SUM(won),0) wins, COALESCE(SUM(departed),0) departures FROM results WHERE actor IN (${args})`;
 const total=await db.prepare(aggregate).bind(...keys).first();
 const byPlayers=await db.prepare(`SELECT players,COUNT(*) games,SUM(won) wins,SUM(departed) departures FROM results WHERE actor IN (${args}) GROUP BY players`).bind(...keys).all();
 const history=await db.prepare(`SELECT ended_at,players,won,departed,mode FROM results WHERE actor IN (${args}) ORDER BY ended_at DESC LIMIT 50`).bind(...keys).all();
 return {total,byPlayers:byPlayers.results,history:history.results};
}
export async function leaderboard(db:D1Database,monthly:boolean){
 const now=new Date(Date.now()+9*3600000);const from=monthly?Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)-9*3600000:0;
 // Only account-started standard matches qualify. No private identity fields leave this query.
 return (await db.prepare(`SELECT p.nickname,COUNT(*) games,SUM(r.won) wins,ROUND(100.0*SUM(r.won)/COUNT(*),1) winRate FROM results r JOIN profiles p ON p.actor=r.actor WHERE r.ranked=1 AND r.ended_at>=? GROUP BY r.actor ORDER BY wins DESC, games ASC, p.nickname ASC LIMIT 50`).bind(from).all()).results;
}
