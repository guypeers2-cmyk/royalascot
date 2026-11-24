import roomPackage from '../server-room.cjs';

const { createRoom } = roomPackage;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders
    }
  });
}

function methodNotAllowed(allow) {
  return json({ error: 'Method not allowed.' }, 405, { allow });
}

function bearer(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(request.headers.get('authorization') || '');
  return match?.[1] || '';
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function parseJsonBody(request) {
  const text = await request.text();
  if (text.length > 8192) {
    throw new Error('Request is too large.');
  }
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function generateJoinCode() {
  const random = crypto.getRandomValues(new Uint8Array(3));
  return [...random].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function createTableHandler(ctx, env) {
  const sql = ctx.storage.sql;
  let room = null;
  let activeJoinCode = '';
  let lastTickMs = 0;
  let lastSavedMs = 0;
  let lastClientMs = 0;

  function ensureSchema() {
    sql.exec(`CREATE TABLE IF NOT EXISTS ascot_shared_table (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      join_code TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      payload TEXT NOT NULL
    )`);
  }

  function saveSnapshot(dbPayload, now = Date.now()) {
    const codeToSave = typeof dbPayload?.joinCode === 'string' && dbPayload.joinCode.trim()
      ? dbPayload.joinCode.trim().toUpperCase()
      : activeJoinCode;
    activeJoinCode = codeToSave;
    sql.exec(
      'UPDATE ascot_shared_table SET join_code = ?, updated_ms = ?, payload = ? WHERE id = 1',
      activeJoinCode,
      now,
      JSON.stringify(dbPayload)
    );
    lastSavedMs = now;
  }

  function ensureRoom() {
    if (room) return room;
    ensureSchema();
    const configured = typeof env?.ASCOT_TABLE_CODE === 'string' ? env.ASCOT_TABLE_CODE.trim().toUpperCase() : '';
    const rows = sql.exec('SELECT join_code, updated_ms, payload FROM ascot_shared_table WHERE id = 1').toArray();
    const now = Date.now();
    let persisted;

    if (!rows.length) {
      activeJoinCode = configured || generateJoinCode();
      persisted = { version: 1, cabinet: null, players: {} };
      sql.exec(
        'INSERT INTO ascot_shared_table (id, join_code, updated_ms, payload) VALUES (1, ?, ?, ?)',
        activeJoinCode,
        now,
        JSON.stringify(persisted)
      );
      lastTickMs = now;
      lastSavedMs = now;
      lastClientMs = now;
      console.log(`TABLE JOIN CODE: ${activeJoinCode}`);
    } else {
      const row = rows[0];
      persisted = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const persistedJoin = typeof persisted?.joinCode === 'string' ? persisted.joinCode.trim().toUpperCase() : '';
      activeJoinCode = persistedJoin || configured || String(row.join_code || '').trim().toUpperCase() || generateJoinCode();
      if (activeJoinCode !== row.join_code) {
        sql.exec('UPDATE ascot_shared_table SET join_code = ? WHERE id = 1', activeJoinCode);
      }
      lastTickMs = Number(row.updated_ms) || now;
      lastSavedMs = now;
      lastClientMs = lastTickMs;
    }

    let initialized = false;
    room = createRoom({
      dataDir: null,
      joinCode: activeJoinCode,
      initialDb: persisted,
      autoTick: false,
      adminUser: typeof env?.ASCOT_ADMIN_USER === 'string' ? env.ASCOT_ADMIN_USER : '',
      adminPassword: typeof env?.ASCOT_ADMIN_PASSWORD === 'string' ? env.ASCOT_ADMIN_PASSWORD : '',
      onPersist: next => {
        if (initialized) saveSnapshot(next, Date.now());
      }
    });
    initialized = true;
    return room;
  }

  let activeAlarmAllowedUntil = 0;

  function advanceTo(activeRoom, now = Date.now()) {
    const rawSec = (now - lastTickMs) / 1000;
    lastTickMs = now;
    if (!(rawSec > 0)) return false;
    let remaining = Math.min(rawSec, 3600);
    while (remaining > 0.0005) {
      const step = Math.min(0.25, remaining);
      activeRoom.tick(step);
      remaining -= step;
    }
    return true;
  }

  async function scheduleNextAlarm(activeRoom, now = Date.now()) {
    if (!ctx?.storage?.setAlarm) return;
    const allowedUntil = Math.max(activeAlarmAllowedUntil, lastClientMs + 30 * 60 * 1000);
    if (now > allowedUntil) return;
    const phase = activeRoom.game.state.phase;
    const interval = phase === 'race' || phase === 'gates' ? 1000 : 2500;
    try {
      await ctx.storage.setAlarm(now + interval);
    } catch {}
  }

  async function alarm() {
    const activeRoom = ensureRoom();
    const now = Date.now();
    if (advanceTo(activeRoom, now)) {
      saveSnapshot(activeRoom.exportDb(), now);
    }
    await scheduleNextAlarm(activeRoom, now);
  }

  async function fetch(request) {
    const url = new URL(request.url);
    if (!sameOrigin(request)) {
      return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    }

    const activeRoom = ensureRoom();
    const now = Date.now();
    lastClientMs = now;
    activeAlarmAllowedUntil = now + 30 * 60 * 1000;
    advanceTo(activeRoom, now);
    await scheduleNextAlarm(activeRoom, now);

    try {
      if (url.pathname === '/api/join') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const data = await parseJsonBody(request);
        const joined = activeRoom.register({ name: data.name, code: data.code, token: data.token, pin: data.pin });
        saveSnapshot(activeRoom.exportDb(), now);
        return json({
          token: joined.token,
          reconnected: joined.reconnected,
          tableCode: activeRoom.joinCode,
          state: activeRoom.snapshot(joined.token)
        });
      }

      if (url.pathname === '/api/state') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const snapshot = activeRoom.snapshot(bearer(request));
        if (!snapshot) {
          return json({ error: 'This player seat is not recognized. Rejoin with the table code.' }, 401);
        }
        if (now - lastSavedMs >= 1000) {
          saveSnapshot(activeRoom.exportDb(), now);
        }
        return json(snapshot);
      }

      if (url.pathname === '/api/action') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const token = bearer(request);
        if (!activeRoom.authenticated(token)) {
          return json({ error: 'This player seat is not recognized. Rejoin with the table code.' }, 401);
        }
        const data = await parseJsonBody(request);
        const snapshot = activeRoom.action(token, data.action, data.data || {});
        saveSnapshot(activeRoom.exportDb(), now);
        return json(snapshot);
      }

      if (url.pathname === '/api/leave') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const token = bearer(request);
        if (token && activeRoom.leave?.(token)) {
          saveSnapshot(activeRoom.exportDb(), now);
        }
        return json({ ok: true });
      }

      if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')) {
        const op = url.pathname === '/api/admin'
          ? (url.searchParams.get('op') || '')
          : url.pathname.slice('/api/admin/'.length);

        if (op === 'status') {
          if (request.method !== 'GET') return methodNotAllowed('GET');
          return json({ table: 'Royal Ascot · Shared Table', ...activeRoom.adminStatus() });
        }
        if (op === 'setup') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const data = await parseJsonBody(request);
          const out = activeRoom.adminSetup(data);
          saveSnapshot(activeRoom.exportDb(), now);
          return json(out);
        }
        if (op === 'login') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const data = await parseJsonBody(request);
          const out = activeRoom.adminLogin(data);
          saveSnapshot(activeRoom.exportDb(), now);
          return json(out);
        }
        if (op === 'logout') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const token = bearer(request);
          if (token && activeRoom.adminLogout(token)) {
            saveSnapshot(activeRoom.exportDb(), now);
          }
          return json({ ok: true });
        }
        if (op === 'overview') {
          if (request.method !== 'GET') return methodNotAllowed('GET');
          const snap = activeRoom.adminSnapshot(bearer(request));
          if (!snap) return json({ error: 'Administrator session expired or unauthorized.' }, 401);
          return json(snap);
        }
        if (op === 'reset') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const token = bearer(request);
          if (!activeRoom.adminAuth(token)) {
            return json({ error: 'Administrator session expired or unauthorized.' }, 401);
          }
          const data = await parseJsonBody(request);
          const out = activeRoom.adminResetServer(token, data);
          saveSnapshot(activeRoom.exportDb(), now);
          return json(out);
        }
        if (op === 'action') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const token = bearer(request);
          if (!activeRoom.adminAuth(token)) {
            return json({ error: 'Administrator session expired or unauthorized.' }, 401);
          }
          const data = await parseJsonBody(request);
          const out = activeRoom.adminAction(token, data.action, data.data || {});
          saveSnapshot(activeRoom.exportDb(), now);
          return json(out);
        }
        return json({ error: 'Unknown administrator endpoint.' }, 404);
      }

      return json({ error: 'No such table endpoint.' }, 404);
    } catch (error) {
      const msg = error?.message || 'The table could not complete that request.';
      return json({ error: msg }, /already been claimed|environment variables/i.test(msg) ? 403 : 400);
    }
  }

  return { fetch, alarm };
}

export async function handleWorkerFetch(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }

  if (url.pathname === '/api/info') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    return json({ enabled: true, table: 'Royal Ascot · Shared Table' });
  }

  if (!sameOrigin(request)) {
    return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  }

  if (!env.SHARED_TABLE) {
    return json({ error: 'Cloudflare SharedTable Durable Object binding is missing.' }, 500);
  }

  const id = env.SHARED_TABLE.idFromName('shared-table');
  const stub = env.SHARED_TABLE.get(id);
  return stub.fetch(request);
}
