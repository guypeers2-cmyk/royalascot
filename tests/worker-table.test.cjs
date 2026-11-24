'use strict';
/* Tests the Durable Object handler in worker/table.js without Cloudflare.
   A small stand-in for ctx.storage.sql records the statements the handler
   issues, so the risky paths (cold start, corrupt payload, alarm churn,
   anonymous traffic, oversized bodies) are exercised for real.

     node --test tests/worker-table.test.cjs */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');

// worker/table.js is written as an ES module inside a CommonJS package, which
// is fine for wrangler's bundler but not for bare Node. Copy it out with the
// CommonJS import rewritten to an absolute URL so it can be imported here.
async function loadHandler() {
  const source = fs.readFileSync(path.join(ROOT, 'worker', 'table.js'), 'utf8')
    .replace("from '../server-room.cjs'", `from '${pathToFileURL(path.join(ROOT, 'server-room.cjs')).href}'`);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ascot-worker-')), 'table.mjs');
  fs.writeFileSync(file, source);
  return import(pathToFileURL(file).href);
}

function fakeCtx({ payload = null } = {}) {
  const row = payload == null ? [] : [{ join_code: 'ASCOT26', updated_ms: Date.now(), payload: JSON.stringify(payload) }];
  const log = { exec: [], alarms: [] };
  let alarm = null;
  const sql = {
    exec(statement, ...params) {
      log.exec.push({ statement: statement.replace(/\s+/g, ' ').trim(), params });
      if (/^CREATE TABLE/i.test(statement)) return { toArray: () => [] };
      if (/^SELECT/i.test(statement)) return { toArray: () => row.slice() };
      if (/^INSERT/i.test(statement)) {
        row[0] = { join_code: params[0], updated_ms: params[1], payload: params[2] };
        return { toArray: () => [] };
      }
      if (/^UPDATE/i.test(statement)) {
        if (params.length === 3 && row[0]) {
          row[0].join_code = params[0];
          row[0].updated_ms = params[1];
          row[0].payload = params[2];
        }
        return { toArray: () => [] };
      }
      return { toArray: () => [] };
    }
  };
  return {
    ctx: {
      storage: {
        sql,
        getAlarm: async () => alarm,
        setAlarm: async when => { alarm = when; log.alarms.push(when); }
      }
    },
    log,
    row
  };
}

const post = (url, body, token) => new Request(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});
const getState = (token) => new Request('https://table.example/api/state', {
  headers: token ? { authorization: `Bearer ${token}` } : {}
});

test('a cold table registers a seat and answers with a snapshot', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx, log } = fakeCtx();
  const handler = createTableHandler(ctx, { ASCOT_TABLE_CODE: 'FLEMISH42' });

  const joined = await handler.fetch(post('https://table.example/api/join', { name: 'Guy', pin: '1234', code: 'FLEMISH42' }));
  assert.equal(joined.status, 200);
  const payload = await joined.json();
  assert.equal(payload.tableCode, 'FLEMISH42');
  assert.equal(payload.state.player.name, 'Guy');
  assert.equal(payload.state.player.balance, 500);
  assert.ok(log.exec.some(entry => /^INSERT/i.test(entry.statement)), 'the table row was created');
});

test('a corrupt stored payload does not take the endpoints down', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx } = fakeCtx();
  // A payload that is valid SQL but not valid JSON used to throw out of
  // ensureRoom() -> unhandled 500 on every route.
  ctx.storage.sql.exec = (() => {
    const inner = ctx.storage.sql.exec.bind(ctx.storage.sql);
    return (statement, ...params) => {
      if (/^SELECT/i.test(statement)) return { toArray: () => [{ join_code: 'ASCOT26', updated_ms: Date.now(), payload: '{"half":' }] };
      return inner(statement, ...params);
    };
  })();
  const handler = createTableHandler(ctx, {});
  const joined = await handler.fetch(post('https://table.example/api/join', { name: 'Guy', pin: '1234', code: 'ASCOT26' }));
  assert.equal(joined.status, 200, 'a fresh table is opened instead of a 500');
});

test('unauthenticated traffic is refused and does not drive the table clock', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx, log } = fakeCtx();
  const handler = createTableHandler(ctx, { ASCOT_TABLE_CODE: 'ASCOT26' });
  const joined = await (await handler.fetch(post('https://table.example/api/join', { name: 'Guy', pin: '1234', code: 'ASCOT26' }))).json();

  const anonymous = await handler.fetch(getState('x'.repeat(40)));
  assert.equal(anonymous.status, 401);
  const forgedAction = await handler.fetch(post('https://table.example/api/action', { action: 'ready' }, 'y'.repeat(40)));
  assert.equal(forgedAction.status, 401);

  // The single alarm booked on the authenticated join is not re-booked by
  // every anonymous poll: that was four storage writes a second per caller.
  const alarmsAfterJoin = log.alarms.length;
  for (let i = 0; i < 12; i += 1) await handler.fetch(getState('z'.repeat(40)));
  assert.equal(log.alarms.length, alarmsAfterJoin, 'no extra alarm writes for anonymous polls');

  const mine = await handler.fetch(getState(joined.token));
  assert.equal(mine.status, 200);
});

test('the alarm is not re-armed on every poll', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx, log } = fakeCtx();
  const handler = createTableHandler(ctx, { ASCOT_TABLE_CODE: 'ASCOT26' });
  const { token } = await (await handler.fetch(post('https://table.example/api/join', { name: 'Guy', pin: '1234', code: 'ASCOT26' }))).json();
  const booked = log.alarms.length;
  for (let i = 0; i < 10; i += 1) await handler.fetch(getState(token));
  assert.equal(log.alarms.length, booked, 'the poll path reuses the booked alarm');
});

test('an oversized or invalid body is a clean 400', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx } = fakeCtx();
  const handler = createTableHandler(ctx, { ASCOT_TABLE_CODE: 'ASCOT26' });

  const huge = new Request('https://table.example/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A'.repeat(9000), pin: '1234', code: 'ASCOT26' })
  });
  const tooBig = await handler.fetch(huge);
  assert.equal(tooBig.status, 400);
  assert.match((await tooBig.json()).error, /too large/i);

  const broken = await handler.fetch(new Request('https://table.example/api/join', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops'
  }));
  assert.equal(broken.status, 400);
  assert.match((await broken.json()).error, /JSON/);
});

test('cross-origin posts are blocked by the Durable Object too', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx } = fakeCtx();
  const handler = createTableHandler(ctx, {});
  const response = await handler.fetch(new Request('https://table.example/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ name: 'Guy', pin: '1234', code: 'ASCOT26' })
  }));
  assert.equal(response.status, 403);
});

test('a settled day persists the table and the seat balances', async () => {
  const { createTableHandler } = await loadHandler();
  const { ctx, row } = fakeCtx();
  const handler = createTableHandler(ctx, { ASCOT_TABLE_CODE: 'ASCOT26' });
  const { token } = await (await handler.fetch(post('https://table.example/api/join', { name: 'Guy', pin: '1234', code: 'ASCOT26' }))).json();
  const bet = await handler.fetch(post('https://table.example/api/action', { action: 'place', data: { market: 'win', nums: [1], amount: 30 } }, token));
  assert.equal(bet.status, 200);
  const saved = JSON.parse(row[0].payload);
  assert.ok(saved.players, 'the persisted payload keeps the seats');
  assert.equal(saved.players.guy.balance, 470, 'the stake is on disk');
  assert.ok(saved.cabinet, 'the race is on disk');
});
