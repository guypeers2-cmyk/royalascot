// Self-hostable static cabinet plus an authoritative shared table API.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sparsePlates from './tools/sparse-plates.cjs';
import roomModule from './server-room.cjs';

const { createRoom } = roomModule;
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.ASCOT_DATA ? path.resolve(process.env.ASCOT_DATA) : path.join(root, 'data');
const dataFile = path.join(dataDir, 'ascot-table.json');
const joinCode = process.env.ASCOT_TABLE_CODE || 'ASCOT26';
const sealed = sparsePlates(root);

fs.mkdirSync(dataDir, { recursive: true });
let saved = null;
try { saved = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { saved = null; }

const room = createRoom({
  joinCode,
  initialDb: saved,
  autoTick: true,
  dataDir,
  dataFile,
  // One file, written atomically. The room only asks for a write when the
  // table actually moved, so the disk is not hit on every poll.
  onPersist(db) {
    const temp = `${dataFile}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(db));
      fs.renameSync(temp, dataFile);
    } catch (error) {
      console.error('Could not save the table:', error?.message || error);
    }
  }
});

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin'
};

function json(res, status, value, extra = {}) {
  const out = JSON.stringify(value);
  res.writeHead(status, {
    ...baseHeaders,
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(out),
    'Cache-Control': 'no-store',
    ...extra
  });
  res.end(out);
}

function bearer(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(req.headers.authorization || '');
  return match?.[1] || '';
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || '';
}

// A body is refused before it is buffered, so a large POST cannot be used to
// hold memory in the server.
async function body(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > 8192) throw new Error('Request is too large.');
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 8192) throw new Error('Request is too large.');
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

// Same-origin only, but aware of a reverse proxy / tunnel that rewrites Host.
const allowOrigins = (process.env.ASCOT_ALLOW_ORIGIN || '')
  .split(',').map(value => value.trim()).filter(Boolean);

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const claimed = new URL(origin).host;
    const hosts = [
      String(req.headers['x-forwarded-host'] || '').split(',')[0].trim(),
      String(req.headers.host || '').trim()
    ].filter(Boolean);
    if (hosts.includes(claimed)) return true;
    if (allowOrigins.includes(origin)) return true;
    return false;
  } catch {
    return false;
  }
}

// A small leaky bucket per caller: joins are throttled hard because a 4-digit
// PIN is only 10 000 guesses wide, actions loosely.
const buckets = new Map();
function limited(key, limit, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now - bucket.start > 10 * 60 * 1000) buckets.delete(key);
}, 5 * 60 * 1000).unref();

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/info') {
    json(res, 200, { enabled: true, table: 'Royal Ascot · Shared Table', seats: room.seats.length });
    return true;
  }
  if (!url.pathname.startsWith('/api/')) return false;
  if (!sameOrigin(req)) {
    json(res, 403, { error: 'Cross-origin requests are not allowed.' });
    return true;
  }
  const ip = clientIp(req);
  try {
    if (req.method === 'POST' && url.pathname === '/api/join') {
      if (limited(`join:${ip}`, 20, 60 * 1000)) {
        json(res, 429, { error: 'Too many sign-in attempts. Wait a minute and try again.' });
        return true;
      }
      const data = await body(req);
      // register() is async because the PIN is hashed with Web Crypto.
      const joined = await room.register({ name: data.name, code: data.code, token: data.token, pin: data.pin, ip });
      json(res, 200, {
        token: joined.token,
        reconnected: joined.reconnected,
        tableCode: room.joinCode,
        state: room.snapshot(joined.token)
      });
      return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const state = room.snapshot(bearer(req));
      if (!state) {
        json(res, 401, { error: 'This player seat is not recognized. Rejoin with the table code.' });
        return true;
      }
      json(res, 200, state);
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      const token = bearer(req);
      if (!room.authenticated(token)) {
        json(res, 401, { error: 'This player seat is not recognized. Rejoin with the table code.' });
        return true;
      }
      if (limited(`action:${token}`, 240, 60 * 1000)) {
        json(res, 429, { error: 'Slow down: too many table commands in a minute.' });
        return true;
      }
      const data = await body(req);
      json(res, 200, room.action(token, data.action, data.data || {}));
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/leave') {
      const token = bearer(req);
      if (token) room.leave(token);
      json(res, 200, { ok: true });
      return true;
    }
    json(res, 404, { error: 'No such table endpoint.' });
  } catch (error) {
    json(res, 400, { error: error?.message || 'The table could not complete that request.' });
  }
  return true;
}

const allowedPath = /^\/(index(\.[a-z0-9]+)?\.html|[a-z0-9-]+\.html|styles\.css|assets\/[a-zA-Z0-9_.-]+|js\/[a-zA-Z0-9_.-]+\.js)$/;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://site.invalid');
    if (await api(req, res, url)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...baseHeaders, Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    if (!allowedPath.test(pathname)) {
      res.writeHead(404, baseHeaders).end('Not found');
      return;
    }
    if (pathname.startsWith('/assets/') && sealed.has(pathname.slice(8))) {
      const bytes = sealed.get(pathname.slice(8));
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': 'image/webp',
        'Content-Length': bytes.length,
        'Cache-Control': 'no-cache'
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return;
    }
    const file = path.join(root, pathname);
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        res.writeHead(404, baseHeaders).end('Not found');
        return;
      }
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    });
  } catch {
    res.writeHead(400, baseHeaders).end('Bad request');
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Hippodrome shared table listening on 0.0.0.0:${port}`);
  console.log(`TABLE JOIN CODE: ${room.joinCode} (share privately with players)`);
  console.log(`Saved server table: ${dataFile}`);
});

function shutdown() {
  room.persist();
  room.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
