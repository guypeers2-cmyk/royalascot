'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function createMockSqlStorage() {
  let tableRow = null;
  return {
    exec(query, ...params) {
      const normalized = query.trim().replace(/\s+/g, ' ').toUpperCase();
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS ASCOT_SHARED_TABLE')) {
        return { toArray: () => [] };
      }
      if (normalized.startsWith('SELECT JOIN_CODE, UPDATED_MS, PAYLOAD FROM ASCOT_SHARED_TABLE')) {
        return { toArray: () => (tableRow ? [{ ...tableRow }] : []) };
      }
      if (normalized.startsWith('INSERT INTO ASCOT_SHARED_TABLE')) {
        const [join_code, updated_ms, payload] = params;
        tableRow = { id: 1, join_code, updated_ms, payload };
        return { toArray: () => [] };
      }
      if (normalized.startsWith('UPDATE ASCOT_SHARED_TABLE SET JOIN_CODE = ?, UPDATED_MS = ?, PAYLOAD = ?')) {
        const [join_code, updated_ms, payload] = params;
        tableRow = { id: 1, join_code, updated_ms, payload };
        return { toArray: () => [] };
      }
      if (normalized.startsWith('UPDATE ASCOT_SHARED_TABLE SET JOIN_CODE = ?')) {
        const [join_code] = params;
        if (tableRow) tableRow.join_code = join_code;
        return { toArray: () => [] };
      }
      throw new Error('Unexpected SQL query in mock: ' + query);
    }
  };
}

function createMockEnv({ tableCode = 'ASCOT26', sql = createMockSqlStorage(), createTableHandler }) {
  let handler = null;
  const env = {
    ASCOT_TABLE_CODE: tableCode,
    ASSETS: {
      fetch(req) {
        return new Response('ASSET:' + new URL(req.url).pathname, { status: 200 });
      }
    },
    SHARED_TABLE: {
      idFromName(name) {
        return `do:${name}`;
      },
      get() {
        if (!handler) {
          handler = createTableHandler({ storage: { sql, setAlarm: async () => {} } }, env);
        }
        return handler;
      }
    }
  };
  return {
    env,
    sql,
    evictDurableObject() {
      handler = null;
    }
  };
}

test('Cloudflare Worker serves /api/info, passes non-API routes to ASSETS, and enforces origin/methods', async () => {
  const { createTableHandler, handleWorkerFetch } = await import('../worker/table.js');
  const { env } = createMockEnv({ createTableHandler });

  const assetRes = await handleWorkerFetch(new Request('https://royalascot.example.workers.dev/'), env);
  assert.equal(assetRes.status, 200);
  assert.equal(await assetRes.text(), 'ASSET:/');

  const infoRes = await handleWorkerFetch(new Request('https://royalascot.example.workers.dev/api/info'), env);
  assert.equal(infoRes.status, 200);
  assert.deepEqual(await infoRes.json(), { enabled: true, table: 'Royal Ascot · Shared Table' });

  const crossOriginRes = await handleWorkerFetch(
    new Request('https://royalascot.example.workers.dev/api/state', {
      headers: { Origin: 'https://evil.example' }
    }),
    env
  );
  assert.equal(crossOriginRes.status, 403);

  const badMethodRes = await handleWorkerFetch(
    new Request('https://royalascot.example.workers.dev/api/join', { method: 'GET' }),
    env
  );
  assert.equal(badMethodRes.status, 405);
  assert.equal(badMethodRes.headers.get('allow'), 'POST');
});

test('Cloudflare Durable Object shares one race, isolates player wallets, and persists across DO restarts', async () => {
  const { createTableHandler, handleWorkerFetch } = await import('../worker/table.js');
  const sharedSql = createMockSqlStorage();
  const harness = createMockEnv({ tableCode: 'ASCOT26', sql: sharedSql, createTableHandler });
  const base = 'https://royalascot.example.workers.dev';

  const unauthState = await handleWorkerFetch(new Request(`${base}/api/state`), harness.env);
  assert.equal(unauthState.status, 401);

  const badCodeJoin = await handleWorkerFetch(
    new Request(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guy', code: 'WRONG' })
    }),
    harness.env
  );
  assert.equal(badCodeJoin.status, 400);

  const joinGuyRes = await handleWorkerFetch(
    new Request(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guy', code: 'ascot26' })
    }),
    harness.env
  );
  assert.equal(joinGuyRes.status, 200);
  const guyJoin = await joinGuyRes.json();
  assert.equal(guyJoin.tableCode, 'ASCOT26');
  assert.equal(guyJoin.state.player.name, 'Guy');
  assert.equal(guyJoin.state.state.balance, 500);

  const joinRobinRes = await handleWorkerFetch(
    new Request(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Robin', code: 'ASCOT26' })
    }),
    harness.env
  );
  assert.equal(joinRobinRes.status, 200);
  const robinJoin = await joinRobinRes.json();

  const betRes = await handleWorkerFetch(
    new Request(`${base}/api/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guyJoin.token}`
      },
      body: JSON.stringify({ action: 'place', data: { market: 'win', nums: [1], amount: 25 } })
    }),
    harness.env
  );
  assert.equal(betRes.status, 200);
  const betState = await betRes.json();
  assert.equal(betState.state.balance, 475);
  assert.equal(betState.state.bets.length, 1);

  // Simulate Cloudflare hibernating/evicting the Durable Object and waking from SQLite storage.
  harness.evictDurableObject();

  const guyAfterRestart = await handleWorkerFetch(
    new Request(`${base}/api/state`, {
      headers: { Authorization: `Bearer ${guyJoin.token}` }
    }),
    harness.env
  );
  assert.equal(guyAfterRestart.status, 200);
  const guySnap = await guyAfterRestart.json();
  assert.equal(guySnap.player.name, 'Guy');
  assert.equal(guySnap.state.balance, 475);
  assert.equal(guySnap.state.bets[0].stake, 25);

  const robinAfterRestart = await handleWorkerFetch(
    new Request(`${base}/api/state`, {
      headers: { Authorization: `Bearer ${robinJoin.token}` }
    }),
    harness.env
  );
  assert.equal(robinAfterRestart.status, 200);
  const robinSnap = await robinAfterRestart.json();
  assert.equal(robinSnap.player.name, 'Robin');
  assert.equal(robinSnap.state.balance, 500);
  assert.equal(robinSnap.state.bets.length, 0);
  assert.equal(robinSnap.state.raceNo, guySnap.state.raceNo);
  assert.equal(robinSnap.state.phase, guySnap.state.phase);
  assert.deepEqual(
    robinSnap.players.map((p) => p.name).sort(),
    ['Guy', 'Robin']
  );
  assert.deepEqual(
    guySnap.players.map((p) => p.name).sort(),
    ['Guy', 'Robin']
  );
});

test('Cloudflare Durable Object keeps races advancing server-side across idle gaps and alarm ticks', async () => {
  const { createTableHandler, handleWorkerFetch } = await import('../worker/table.js');
  const sharedSql = createMockSqlStorage();
  const realNow = Date.now;
  let fakeNow = 1_700_000_000_000;
  Date.now = () => fakeNow;
  try {
    let scheduledAlarm = null;
    const env = {
      ASCOT_TABLE_CODE: 'ASCOT26',
      SHARED_TABLE: {
        idFromName: () => 'do:main',
        get: (() => {
          let h = null;
          return () =>
            (h ??= createTableHandler(
              {
                storage: {
                  sql: sharedSql,
                  setAlarm: async (ts) => {
                    scheduledAlarm = ts;
                  }
                }
              },
              env
            ));
        })()
      }
    };
    const base = 'https://royalascot.example.workers.dev';
    const joinRes = await handleWorkerFetch(
      new Request(`${base}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Guy', pin: '2468', code: 'ASCOT26' })
      }),
      env
    );
    const join = await joinRes.json();
    const startClock = join.state.state.clock;
    assert.ok(scheduledAlarm > fakeNow, 'Durable Object schedules background alarm');

    // Simulate 15 seconds passing with NO client polling, then alarm firing
    fakeNow += 15000;
    await env.SHARED_TABLE.get().alarm();

    const stateRes = await handleWorkerFetch(
      new Request(`${base}/api/state`, {
        headers: { Authorization: `Bearer ${join.token}` }
      }),
      env
    );
    const after = await stateRes.json();
    assert.ok(after.state.clock > startClock + 10 || after.state.phase !== 'betting', 'Race clock continued server-side');

    // Verify PIN login recovers the same seat without a token
    const reloginRes = await handleWorkerFetch(
      new Request(`${base}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Guy', pin: '2468', code: 'ASCOT26' })
      }),
      env
    );
    const relogin = await reloginRes.json();
    assert.equal(relogin.reconnected, true);
    assert.equal(relogin.token, join.token);
  } finally {
    Date.now = realNow;
  }
});
