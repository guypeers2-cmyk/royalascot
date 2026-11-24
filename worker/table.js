import roomPackage from '../server-room.cjs';

const { createRoom } = roomPackage;

const MAX_BODY = 8192;
const MAX_CATCH_UP_SECONDS = 120;
const PERSIST_FLOOR_MS = 5000;
const ALARM_HEADROOM_MS = 250;
const IDLE_ALARM_MS = 30 * 60 * 1000;
const JOIN_LIMIT = 20;
const JOIN_WINDOW_MS = 60 * 1000;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      vary: 'Origin',
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
    const claimed = new URL(origin).host;
    const hosts = [
      (request.headers.get('x-forwarded-host') || '').split(',')[0].trim(),
      new URL(request.url).host
    ].filter(Boolean);
    return hosts.includes(claimed);
  } catch {
    return false;
  }
}

// Refuse an oversized body before it is read into memory.
async function parseJsonBody(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) throw new Error('Request is too large.');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('Request is too large.');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
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
  let lastRevision = -1;
  const joins = new Map();

  function ensureSchema() {
    sql.exec(`CREATE TABLE IF NOT EXISTS ascot_shared_table (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      join_code TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      payload TEXT NOT NULL
    )`);
  }

  function saveSnapshot(dbPayload, now = Date.now()) {
    try {
      sql.exec(
        'UPDATE ascot_shared_table SET join_code = ?, updated_ms = ?, payload = ? WHERE id = 1',
        activeJoinCode,
        now,
        JSON.stringify(dbPayload)
      );
      lastSavedMs = now;
      lastRevision = room?.revision ?? lastRevision;
    } catch (error) {
      // A storage hiccup must not take the table down mid-race.
      console.error('table save failed', error?.message || error);
    }
  }

  function readPersisted() {
    const rows = sql.exec('SELECT join_code, updated_ms, payload FROM ascot_shared_table WHERE id = 1').toArray();
    if (!rows.length) return null;
    const row = rows[0];
    let parsed = null;
    try {
      parsed = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    } catch {
      // A corrupt payload used to throw out of ensureRoom() and take every
      // endpoint down with it (500, unhandled). Start a clean table instead.
      console.error('stored table payload was unreadable; starting a fresh table');
      parsed = null;
    }
    return { row, parsed };
  }

  function ensureRoom() {
    if (room) return room;
    ensureSchema();
    const configured = typeof env?.ASCOT_TABLE_CODE === 'string' ? env.ASCOT_TABLE_CODE.trim().toUpperCase() : '';
    const stored = readPersisted();
    const now = Date.now();

    if (!stored) {
      activeJoinCode = configured || generateJoinCode();
      sql.exec(
        'INSERT INTO ascot_shared_table (id, join_code, updated_ms, payload) VALUES (1, ?, ?, ?)',
        activeJoinCode,
        now,
        JSON.stringify({ version: 2, cabinet: null, players: {} })
      );
      lastTickMs = now;
      lastSavedMs = now;
      lastClientMs = now;
      console.log(`TABLE JOIN CODE: ${activeJoinCode}`);
      room = createRoom({ dataDir: null, joinCode: activeJoinCode, initialDb: null, autoTick: false, onPersist: null });
    } else {
      const { row, parsed } = stored;
      activeJoinCode = configured || String(row.join_code || '').trim().toUpperCase() || generateJoinCode();
      if (activeJoinCode !== row.join_code) {
        sql.exec('UPDATE ascot_shared_table SET join_code = ? WHERE id = 1', activeJoinCode);
      }
      lastTickMs = Number(row.updated_ms) || now;
      lastSavedMs = now;
      lastClientMs = lastTickMs;
      if (parsed?.joinCode && parsed.joinCode !== activeJoinCode) parsed.joinCode = activeJoinCode;
      room = createRoom({ dataDir: null, joinCode: activeJoinCode, initialDb: parsed, autoTick: false, onPersist: null });
    }

    lastRevision = room.revision;
    return room;
  }

  // Catch-up is bounded: a Durable Object that has been idle for a day must not
  // spin tens of thousands of engine ticks inside one request.
  function advanceTo(activeRoom, now = Date.now()) {
    const rawSeconds = (now - lastTickMs) / 1000;
    lastTickMs = now;
    if (!(rawSeconds > 0)) return false;
    activeRoom.tick(Math.min(rawSeconds, MAX_CATCH_UP_SECONDS));
    return true;
  }

  function persist(activeRoom, now = Date.now(), force = false) {
    if (!force && now - lastSavedMs < PERSIST_FLOOR_MS) return;
    saveSnapshot(activeRoom.exportDb(), now);
  }

  // The alarm is the only thing that moves the race while nobody is asking.
  // It is re-armed only when the wanted time is meaningfully earlier than the
  // one already booked, so a 4 Hz poll does not become 4 storage writes a second.
  async function scheduleNextAlarm(activeRoom, now = Date.now()) {
    if (!ctx?.storage?.setAlarm || !ctx?.storage?.getAlarm) return;
    const allowedUntil = Math.max(lastClientMs, now) + IDLE_ALARM_MS;
    if (now > allowedUntil) return;
    const phase = activeRoom.game.state.phase;
    const interval = phase === 'race' || phase === 'gates' ? 1000 : 2500;
    const wanted = now + interval;
    try {
      const booked = await ctx.storage.getAlarm();
      if (Number.isFinite(booked) && booked <= wanted + ALARM_HEADROOM_MS && booked > now) return;
      await ctx.storage.setAlarm(wanted);
    } catch {
      /* Scheduling is best effort; a client poll still advances the clock. */
    }
  }

  async function alarm() {
    try {
      const activeRoom = ensureRoom();
      const now = Date.now();
      advanceTo(activeRoom, now);
      persist(activeRoom, now);
      await scheduleNextAlarm(activeRoom, now);
    } catch (error) {
      console.error('table alarm failed', error?.message || error);
    }
  }

  async function fetch(request) {
    const url = new URL(request.url);
    if (!sameOrigin(request)) {
      return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    }

    // No endpoint in this handler can answer without the room.
    let activeRoom;
    try {
      activeRoom = ensureRoom();
    } catch (error) {
      console.error('table could not start', error?.message || error);
      return json({ error: 'The shared table could not be opened. Try again in a moment.' }, 503);
    }

    const now = Date.now();
    const token = bearer(request);
    const known = Boolean(token) && activeRoom.authenticated(token);

    // An anonymous caller may sign in, but must not drive the shared clock.
    if (known) {
      lastClientMs = now;
      advanceTo(activeRoom, now);
    }
    await scheduleNextAlarm(activeRoom, now);

    try {
      if (url.pathname === '/api/join') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const ip = clientIp(request);
        const recent = (joins.get(ip) || []).filter(stamp => now - stamp < JOIN_WINDOW_MS);
        if (recent.length >= JOIN_LIMIT) {
          joins.set(ip, recent);
          return json({ error: 'Too many sign-in attempts. Wait a minute and try again.' }, 429);
        }
        recent.push(now);
        joins.set(ip, recent);

        const data = await parseJsonBody(request);
        // register() hashes the PIN with Web Crypto, so it is awaited.
        const joined = await activeRoom.register({
          name: data.name,
          code: data.code,
          token: data.token,
          pin: data.pin,
          ip
        });
        persist(activeRoom, now, true);
        lastClientMs = now;
        advanceTo(activeRoom, Date.now());
        return json({
          token: joined.token,
          reconnected: joined.reconnected,
          tableCode: activeRoom.joinCode,
          state: activeRoom.snapshot(joined.token)
        });
      }

      if (url.pathname === '/api/state') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const snapshot = activeRoom.snapshot(token);
        if (!snapshot) {
          return json({ error: 'This player seat is not recognized. Rejoin with the table code.' }, 401);
        }
        if (activeRoom.revision !== lastRevision) persist(activeRoom, now);
        return json(snapshot);
      }

      if (url.pathname === '/api/action') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        if (!known) {
          return json({ error: 'This player seat is not recognized. Rejoin with the table code.' }, 401);
        }
        const data = await parseJsonBody(request);
        const snapshot = activeRoom.action(token, data.action, data.data || {});
        persist(activeRoom, now, true);
        lastClientMs = Date.now();
        return json(snapshot);
      }

      if (url.pathname === '/api/leave') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        if (token && activeRoom.leave(token)) persist(activeRoom, now, true);
        return json({ ok: true });
      }

      return json({ error: 'No such table endpoint.' }, 404);
    } catch (error) {
      return json({ error: error?.message || 'The table could not complete that request.' }, 400);
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
