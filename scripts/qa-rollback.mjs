// Synthetic state only. This never reads or writes the production database.
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import * as current from '../lib/game.ts';
const directory = await mkdtemp(join(tmpdir(), 'pig-house-rollback-'));
try {
  const file = join(directory, 'game-v1.ts');
  await writeFile(file, execFileSync('git', ['show', 'release/v0.2.0:lib/game.ts']));
  await writeFile(join(directory, 'role-rules.ts'), execFileSync('git', ['show', 'release/v0.2.0:lib/role-rules.ts']));
  const old = await import(pathToFileURL(file).href);
  let checked = 0;
  for (let n = 3; n <= 10; n++) {
    let room = old.makeRoom('TEST1234', 'u0', 'host');
    for (let i = 1; i < n; i++) room = old.applyAction(room, `u${i}`, { type: 'join', name: `player${i}` });
    room = old.applyAction(room, 'u0', { type: 'start' });
    assert.equal(current.viewRoom(room, 'u0', 1).legacyRoles, false);
    assert.ok(current.viewRoom(room, 'u0', 1).players.every(p => p.hand.every(c => c.type === null)));
    room.status = 'finished';
    room = current.applyAction(room, 'u0', { type: 'restart' });
    assert.equal(current.viewRoom(room, 'u0', 2).legacyRoles, false);
    while (room.status === 'playing') {
      const actor = room.players.find(p => p.id === room.keyHolderId);
      const target = room.players.find(p => p.id !== actor.id && p.hand.some(c => !c.revealed));
      const index = target.hand.findIndex(c => !c.revealed);
      room = current.applyAction(room, actor.userKey, { type: 'reveal', targetId: target.id, cardId: current.publicCardId(room, index) }, (room.lastReveal?.until ?? 0) + 10000);
      const restored = JSON.parse(JSON.stringify(room));
      assert.doesNotThrow(() => old.viewRoom(restored, 'u0', 2));
      if (restored.status === 'playing') {
        const oldActor = restored.players.find(p => p.id === restored.keyHolderId);
        const oldTarget = restored.players.find(p => p.id !== oldActor.id && p.hand.some(c => !c.revealed));
        assert.doesNotThrow(() => old.applyAction(restored, oldActor.userKey, { type: 'reveal', targetId: oldTarget.id, cardId: old.publicCardId(restored, oldTarget.hand.findIndex(c => !c.revealed)) }, (restored.lastReveal?.until ?? 0) + 10000));
      } else {
        const restarted = old.applyAction(restored, 'u0', { type: 'restart' });
        assert.equal(current.viewRoom(restarted, 'u0', 3).legacyRoles, false);
      }
      checked++;
    }
  }
  console.log(JSON.stringify({ rollbackCompatibility: 'PASS', target: 'release/v0.2.0', players: '3–10', checkedStates: checked, productionWrites: 0 }));
} finally { await rm(directory, { recursive: true, force: true }); }
