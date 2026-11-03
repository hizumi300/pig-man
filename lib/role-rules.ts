// 指定された役職カードを混ぜ、人数分だけ配る。余りの役職は公開しない。
export const ROLE_POOLS = [
  { players: 3, adventurers: 2, guardians: 2 },
  { players: 4, adventurers: 3, guardians: 2 },
  { players: 5, adventurers: 3, guardians: 2 },
  { players: 6, adventurers: 4, guardians: 2 },
  { players: 7, adventurers: 5, guardians: 3 },
  { players: 8, adventurers: 6, guardians: 3 },
  { players: 9, adventurers: 6, guardians: 3 },
  { players: 10, adventurers: 7, guardians: 4 },
] as const;
export function roleRule(players: number) {
  const pool = ROLE_POOLS.find(p => p.players === players);
  if (!pool) return null;
  const spare = pool.adventurers + pool.guardians - players;
  return { ...pool, spare, minGuardians: pool.guardians - spare, maxGuardians: pool.guardians };
}
export function roleRange(players: number) {
  const rule = roleRule(players);
  return rule ? rule.minGuardians === rule.maxGuardians ? `${rule.maxGuardians}人` : `${rule.minGuardians}〜${rule.maxGuardians}人` : '3人から開始できます';
}
