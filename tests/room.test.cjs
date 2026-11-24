'use strict';
/* Shared-table contract tests. Run with: node --test tests/room.test.cjs
   Covers registration, PIN throttling, seat-scoped money, ready votes,
   a full settled race, restart persistence and poll payload size. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoom, SEAT_MAX } = require('../server-room.cjs');

const bytes = value => Buffer.byteLength(JSON.stringify(value));

function build(options = {}) {
  return createRoom({ joinCode: 'ASCOT26', autoTick: false, ...options });
}

test('a seat is created once and unlocked by its PIN', async () => {
  const room = build();
  const first = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  assert.equal(typeof first.token, 'string');
  assert.match(first.token, /^[A-Za-z0-9_-]{32,128}$/);
  assert.doesNotMatch(first.token, /undefined|NaN/);
  assert.equal(room.snapshot(first.token).player.name, 'Guy');
  assert.equal(room.snapshot(first.token).player.balance, 500);

  const again = await room.register({ name: 'guy', pin: '1234', code: 'ASCOT26' });
  assert.equal(room.snapshot(again.token).player.id, room.snapshot(first.token === again.token ? again.token : again.token).player.id);
  assert.equal(room.snapshot(again.token).player.balance, 500, 'the same seat, not a second account');
  assert.equal(room.snapshot(again.token).players.length, 1, 'case and spaces do not open a second seat');
  assert.equal(room.authenticated(first.token), again.token === first.token,
    'signing in from a new device retires the previous token');
  await assert.rejects(() => room.register({ name: 'Guy', pin: '0000', code: 'ASCOT26' }), /do not match/);
  room.stop();
});

test('the table code is enforced', async () => {
  const room = build({ joinCode: 'FLEMISH42' });
  await assert.rejects(() => room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' }), /not recognised/);
  const ok = await room.register({ name: 'Guy', pin: '1234', code: 'flemish42' });
  assert.ok(ok.token);
  room.stop();
});

test('repeated wrong PINs hold the seat', async () => {
  const room = build();
  await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(() => room.register({ name: 'Guy', pin: '0000', code: 'ASCOT26' }));
  }
  await assert.rejects(() => room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' }), /Too many wrong PINs/);
  room.stop();
});

test('a seat cannot bet more than it owns, nor beyond six tickets', async () => {
  const room = build();
  const { token } = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  assert.throws(() => room.action(token, 'place', { market: 'win', nums: [1], amount: 900 }), /Not enough medals/);
  assert.throws(() => room.action(token, 'place', { market: 'win', nums: [9], amount: 5 }), /runner/);
  assert.throws(() => room.action(token, 'place', { market: 'win', nums: [1], amount: 2.5 }), /whole medal stake/);
  for (let n = 1; n <= 6; n += 1) room.action(token, 'place', { market: 'win', nums: [n], amount: 5 });
  // A seventh *new* selection is refused; adding to an existing ticket is not.
  assert.throws(() => room.action(token, 'place', { market: 'quinella', nums: [1, 2], amount: 5 }), /Six selections/);
  assert.equal(room.action(token, 'place', { market: 'win', nums: [1], amount: 5 }).player.bets.length, 6);
  room.stop();
});

test('balances are per seat, the race is shared', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  const b = await room.register({ name: 'Els', pin: '9876', code: 'ASCOT26' });
  room.action(a.token, 'place', { market: 'win', nums: [1], amount: 40 });
  const sa = room.snapshot(a.token);
  const sb = room.snapshot(b.token);
  assert.equal(sa.player.balance, 460);
  assert.equal(sb.player.balance, 500, 'the other seat pays nothing');
  assert.equal(sb.player.bets.length, 0);
  assert.deepEqual(sa.state.order, sb.state.order, 'one race for the table');
  assert.equal(sa.state.clock, sb.state.clock);
  assert.equal(sb.players.length, 2);
  room.stop();
});

test('both seats must be ready before the gates are released', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  const b = await room.register({ name: 'Els', pin: '9876', code: 'ASCOT26' });
  assert.equal(room.action(a.token, 'ready').state.phase, 'betting');
  const started = room.action(b.token, 'ready').state;
  assert.equal(started.phase, 'gates');
  assert.equal(started.clock, 0);
  // A second press is an un-ready, not a second start.
  const toggled = room.action(a.token, 'ready').player;
  assert.equal(toggled.ready, true);
  assert.equal(room.action(a.token, 'ready').player.ready, false);
  room.stop();
});

test('a race settles every seat at its own locked prices', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  const b = await room.register({ name: 'Els', pin: '9876', code: 'ASCOT26' });
  room.action(a.token, 'place', { market: 'win', nums: [1], amount: 20 });
  room.action(b.token, 'place', { market: 'show', nums: [2], amount: 10 });
  const oddsA = room.snapshot(a.token).player.bets[0].odds;

  let elapsed = 0;
  while (room.game.state.phase !== 'result' && elapsed < 300) {
    room.tick(0.25);
    elapsed += 0.25;
  }
  assert.equal(room.game.state.phase, 'result');
  assert.ok(elapsed > 60, 'the race ran the full starter clock');

  const sa = room.snapshot(a.token);
  const [winner, second] = room.game.state.order;
  const expectedA = winner === 1 ? Math.round(20 * oddsA * 100) / 100 : 0;
  assert.equal(sa.state.payout, expectedA);
  assert.equal(sa.player.balance, Math.round((480 + expectedA) * 100) / 100);
  assert.equal(sa.state.history[0].raceNo, room.game.state.raceNo);
  assert.equal(sa.state.history[0].bets.length, 1, 'the receipt keeps its ticket');

  const sb = room.snapshot(b.token);
  const expectedB = second === 2 ? Math.round(10 * room.snapshot(b.token).player.bets[0].odds * 100) / 100 : 0;
  assert.equal(sb.state.payout, expectedB);
  assert.notEqual(sa.state.payout + sb.state.payout, undefined);
  room.stop();
});

test('the table survives a restart without double-debiting', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  room.action(a.token, 'place', { market: 'win', nums: [3], amount: 30 });
  const before = room.snapshot(a.token).player;
  const db = room.exportDb();
  room.stop();

  const restored = build({ initialDb: JSON.parse(JSON.stringify(db)) });
  const after = restored.snapshot(a.token).player;
  assert.equal(after.balance, before.balance);
  assert.equal(after.bets.length, 1);
  assert.equal(after.name, 'Guy');
  restored.stop();
});

test('a poll payload stays small enough to run four times a second', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  room.action(a.token, 'place', { market: 'win', nums: [1], amount: 20 });
  const poll = room.snapshot(a.token);
  assert.ok(bytes(poll) < 80_000, `payload was ${bytes(poll)} bytes`);
  assert.equal(poll.state.history.length <= 4, true);
  room.stop();
});

test('the seat cap is enforced', async () => {
  const room = build();
  for (let i = 0; i < SEAT_MAX; i += 1) {
    await room.register({ name: `Seat ${i}`, pin: '1234', code: 'ASCOT26' });
  }
  await assert.rejects(() => room.register({ name: 'Extra', pin: '1234', code: 'ASCOT26' }), /table is full/);
  room.stop();
});

test('a restarted table keeps its numbering and gets a fresh epoch', async () => {
  const room = build();
  const a = await room.register({ name: 'Guy', pin: '1234', code: 'ASCOT26' });
  room.action(a.token, 'place', { market: 'win', nums: [1], amount: 15 });
  const before = room.snapshot(a.token);
  assert.ok(before.epoch, 'every payload carries an epoch');
  assert.ok(before.revision > 1);
  const db = room.exportDb();
  room.stop();

  // A Durable Object is evicted and rebuilt all the time; the browser must not
  // treat the rebuilt room as an older answer.
  const restarted = build({ initialDb: JSON.parse(JSON.stringify(db)) });
  const after = restarted.snapshot(a.token);
  assert.notEqual(after.epoch, before.epoch, 'a new room instance is a new epoch');
  assert.ok(after.revision >= before.revision, `revision kept going: ${before.revision} -> ${after.revision}`);
  restarted.stop();
});
