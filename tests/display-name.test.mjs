import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, makeRoom, applyAction, viewRoom } from '../lib/game.ts';
import { nameLength, MAX_NAME_LENGTH } from '../lib/display-name.ts';

test('names accept eight visible characters and reject nine in every join path', () => {
  assert.equal(MAX_NAME_LENGTH, 8);
  for (const character of ['あ', 'a', '🐷', '🇯🇵', '👍🏽']) {
    const good = character.repeat(8), bad = character.repeat(9);
    assert.equal(nameLength(good), 8); assert.equal(cleanName(good), good);
    assert.throws(() => cleanName(bad), /1〜8文字/);
    assert.throws(() => makeRoom('TEST1234', 'u0', bad), /1〜8文字/);
    for (const type of ['join', 'spectate']) {
      const room = makeRoom('TEST1234', 'host', 'ホスト');
      assert.doesNotThrow(() => applyAction(room, 'u1', { type, name: good }));
      assert.throws(() => applyAction(room, 'u1', { type, name: bad }), /1〜8文字/);
    }
  }
});
test('length uses the saved normalized name and keeps duplicate and control protections', () => {
  assert.equal(cleanName('  ＡＢＣＤＥＦＧＨ  '), 'ABCDEFGH');
  assert.equal(cleanName('㍿㍿'), '株式会社株式会社');
  assert.throws(() => cleanName('㍿㍿㍿'), /1〜8文字/);
  assert.equal(nameLength('か\u3099'.repeat(8)), 8);
  for (const invalid of ['', '   ', 'a\u0000', 'a\u200b', '<豚>', null, 8]) assert.throws(() => cleanName(invalid));
  const room = makeRoom('TEST1234', 'host', 'ABCDEFGH');
  assert.throws(() => applyAction(room, 'other', { type: 'join', name: 'ａｂｃｄｅｆｇｈ' }), /同じ/);
});
test('pre-existing longer names and seats survive reconnection without silent renaming', () => {
  const room = makeRoom('TEST1234', 'host', 'ホスト');
  room.players[0].name = '以前の長いプレイヤー名';
  const restored = applyAction(room, 'host', { type: 'join', name: room.players[0].name });
  assert.deepEqual(restored, room);
  assert.equal(viewRoom(restored, 'host', 1).players[0].name, room.players[0].name);
});
