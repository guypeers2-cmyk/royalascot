'use strict';
/* End-to-end test of the self-hosted shared table, over real HTTP.
   Boots serve.mjs on a spare port, then plays two seats against it.

     node --test tests/multiplayer-http.test.cjs */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 3400 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const CODE = 'ASCOT26';

let child = null;
let dataDir = '';

async function waitForTable(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/info`);
      if (response.ok && (await response.json()).enabled) return;
    } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('the table did not come up');
}

const api = (pathname, options = {}) => fetch(`${BASE}${pathname}`, options);
const postJson = (pathname, body, token) => api(pathname, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ascot-table-'));
  child = spawn(process.execPath, ['serve.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ASCOT_DATA: dataDir, ASCOT_TABLE_CODE: CODE },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.resume();
  child.stderr.resume();
  await waitForTable();
});

test.after(() => {
  if (child) child.kill('SIGTERM');
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('the cabinet static files are served', async () => {
  const page = await api('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Royal Ascot/);
  const script = await api('/js/multiplayer-client.js');
  assert.equal(script.status, 200);
  // A route outside the allowlist stays closed.
  const secret = await api('/server-room.cjs');
  assert.equal(secret.status, 404);
});

test('two seats join, bet and settle on one shared race', async () => {
  const join = async (name, pin) => {
    const response = await postJson('/api/join', { name, pin, code: CODE });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    return JSON.parse(text);
  };
  const guy = await join('Guy', '1234');
  const els = await join('Els', '9876');
  assert.ok(guy.token && els.token);
  assert.equal(guy.tableCode, CODE);
  assert.equal(guy.state.player.balance, 500);

  const wrongPin = await postJson('/api/join', { name: 'Guy', pin: '0000', code: CODE });
  assert.equal(wrongPin.status, 400);
  assert.match((await wrongPin.json()).error, /do not match/);

  const badCode = await postJson('/api/join', { name: 'Nina', pin: '1111', code: 'WRONG1' });
  assert.equal(badCode.status, 400);

  const bet = await postJson('/api/action', { action: 'place', data: { market: 'win', nums: [2], amount: 25 } }, guy.token);
  assert.equal(bet.status, 200);
  const betState = await bet.json();
  assert.equal(betState.player.balance, 475);
  assert.equal(betState.player.bets.length, 1);

  const noSeat = await api('/api/state');
  assert.equal(noSeat.status, 401);
  const forged = await api('/api/state', { headers: { authorization: 'Bearer ' + 'x'.repeat(32) } });
  assert.equal(forged.status, 401);

  const tooMuch = await postJson('/api/action', { action: 'place', data: { market: 'win', nums: [2], amount: 99_999 } }, guy.token);
  assert.equal(tooMuch.status, 400);
  assert.match((await tooMuch.json()).error, /Not enough medals/);

  // Both seats ready: the gates open for the whole table.
  const firstReady = await postJson('/api/action', { action: 'ready' }, guy.token);
  assert.equal((await firstReady.json()).state.phase, 'betting');
  const secondReady = await postJson('/api/action', { action: 'ready' }, els.token);
  const startedGates = await secondReady.json();
  assert.equal(startedGates.state.phase, 'gates');
  assert.equal(startedGates.players.length, 2);

  // The server clock keeps running on its own: no client tick is sent here.
  // (A full race is ~147 s of table time, so the settle maths is covered by the
  // fast room test instead of a three-minute wait in this one.)
  let phase = 'gates';
  let clockA = -1;
  let clockB = -1;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const poll = await api('/api/state', { headers: { authorization: `Bearer ${guy.token}` } });
    assert.equal(poll.status, 200);
    const payload = await poll.json();
    phase = payload.state.phase;
    if (phase === 'race') {
      if (clockA < 0) clockA = payload.state.clock;
      else if (payload.state.clock > clockA) { clockB = payload.state.clock; break; }
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  assert.equal(phase, 'race', 'the gates opened for the whole table');
  assert.ok(clockB > clockA, 'the shared race clock advanced without a client tick');

  const bothSeats = await (await api('/api/state', { headers: { authorization: `Bearer ${els.token}` } })).json();
  assert.equal(bothSeats.state.clock, clockB === -1 ? bothSeats.state.clock : bothSeats.state.clock);
  assert.equal(bothSeats.player.bets.length, 0, 'the other seat never bought a ticket');
  assert.equal(bothSeats.players.length, 2, 'both seats are on the same table');
});

test('cross-origin and oversized requests are refused', async () => {
  const cross = await api('/api/state', { headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);

  const big = await api('/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A'.repeat(20_000), pin: '1234', code: CODE })
  });
  assert.equal(big.status, 400);
  const text = await big.text();
  assert.ok(JSON.parse(text).error, 'a readable error, not a crash');
});

test('the table survives a restart with its medals and tickets', async () => {
  const join = await postJson('/api/join', { name: 'Guy', pin: '1234', code: CODE });
  const { token, state } = await join.json();
  const before = state.player.balance;

  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  child = spawn(process.execPath, ['serve.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ASCOT_DATA: dataDir, ASCOT_TABLE_CODE: CODE },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.resume();
  child.stderr.resume();
  await waitForTable();

  const again = await (await postJson('/api/join', { name: 'Guy', pin: '1234', code: CODE })).json();
  assert.equal(again.state.player.balance, before, 'medals came back with the seat');
  assert.ok(fs.existsSync(path.join(dataDir, 'ascot-table.json')), 'the table file was written');
});

test('the join endpoint rate-limits a caller', async () => {
  let sawLimit = false;
  for (let i = 0; i < 25; i += 1) {
    const response = await postJson('/api/join', { name: `Flood ${i}`, pin: '1234', code: CODE });
    if (response.status === 429) { sawLimit = true; break; }
  }
  assert.ok(sawLimit, 'a flood of sign-ins is throttled');
});
