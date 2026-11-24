'use strict';
/* Authoritative shared table for the Royal Ascot harness trot.

   One table, one race, many seats. The race itself is driven by the *same*
   engine the browser uses (js/engine.js), so a server race is bit-identical to
   the local edition: same field draws, same gate clock, same settled prices.

   Seats are accounts, not copies of the machine. Money, tickets, receipts and
   the station book are per seat; the race (runners, clock, phase, order) is
   shared. A seat action temporarily lends its own books to the shared machine,
   so every validation (stake laws, six-ticket tray, refunds, gross prices,
   settlement) is the engine's own code — never a second implementation.

   Public surface (this is the contract serve.mjs and worker/table.js rely on):

     createRoom({ joinCode, initialDb, autoTick, dataDir, dataFile, onPersist })
       .joinCode      active table code (upper case)
       .game          the shared machine ({ state })
       .register({ name, code, token, pin, ip })  -> Promise<{ token, reconnected }>
       .snapshot(token)                            -> payload | null
       .authenticated(token)                       -> boolean
       .action(token, action, data)                -> payload
       .leave(token)                               -> boolean
       .tick(seconds)                              -> void
       .exportDb()                                 -> persistable object
       .stop()                                     -> clears the auto tick

   This module is environment agnostic: no node: imports, no DOM. It runs in
   Node (serve.mjs) and bundles for Cloudflare Workers (worker/table.js). */

const BetMath = require('./js/bet-math.js');
if (!globalThis.HippoBetMath) globalThis.HippoBetMath = BetMath;
const Engine = require('./js/engine.js');

const SEAT_MAX = 8;
const NAME_MIN = 2;
const NAME_MAX = 20;
const CODE_MAX = 12;
const PIN_RE = /^\d{4}$/;
const START_BALANCE = 500;
const HISTORY_WIRE = 4;   // receipts that travel on every poll
const HISTORY_DB = 6;     // receipts that survive a restart
const ATTEMPT_LIMIT = 5;  // wrong PINs before a seat is held
const ATTEMPT_HOLD_MS = 30 * 1000;
const ATTEMPT_HOLD_MAX_MS = 15 * 60 * 1000;
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

// Fields that belong to a seat, never to the shared race.
const SEAT_FIELDS = ['balance', 'bets', 'history', 'studBook', 'payout', 'settled'];
// Fields settlement is allowed to move on the shared state while a seat is lent.
const LENT_FIELDS = ['phase', 'clock', 'order', 'boxCall', 'gate', 'gateHold', 'openSeconds'];

const webcrypto = () => {
  const api = globalThis.crypto;
  if (!api?.subtle || !api.getRandomValues) {
    throw new Error('This runtime has no Web Crypto, so seats cannot be secured.');
  }
  return api;
};

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function randomToken() {
  const bytes = webcrypto().getRandomValues(new Uint8Array(32));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; // exactly 64
  let out = '';
  for (const byte of bytes) out += alphabet[byte & 63];
  return out; // 32 chars, inside the ^[A-Za-z0-9_-]{32,128}$ the servers accept
}

function randomSalt() {
  return hex(webcrypto().getRandomValues(new Uint8Array(16)));
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`ascot-pin:${salt}:${String(pin)}`);
  const digest = await webcrypto().subtle.digest('SHA-256', data);
  return hex(new Uint8Array(digest));
}

const cleanName = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const cleanCode = value => String(value ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, CODE_MAX).toUpperCase();
const seatKey = name => cleanName(name).toLocaleLowerCase();
const clone = value => JSON.parse(JSON.stringify(value));

function cabinetFor(db) {
  const cabinet = db && typeof db === 'object' ? db.cabinet : null;
  if (!cabinet || !Array.isArray(cabinet.runners) || cabinet.runners.length !== 6) return null;
  const book = cabinet.studBook;
  if (!book || typeof book !== 'object' || !Object.keys(book).length) return null;
  const complete = Object.values(book).every(entry => entry && Array.isArray(entry.recent) && entry.recent.length > 0);
  return complete ? cabinet : null;
}

function createRoom(options = {}) {
  const {
    joinCode = 'ASCOT26',
    initialDb = null,
    autoTick = true,
    dataDir = null,
    dataFile = dataFileFor(dataDir),
    onPersist = null
  } = options;

  // Building the machine from scratch means running the opening-meet staging:
  // ~0.8 s of CPU, which a Durable Object pays again on every eviction. If the
  // persisted cabinet already carries a full station book, hand it to the engine
  // as saved state instead, so a cold start only parses 110 KiB.
  const warmed = cabinetFor(initialDb);
  const seedStorage = warmed
    ? { getItem: () => JSON.stringify(warmed), setItem: () => {}, removeItem: () => {} }
    : null;
  const machine = Engine.createMachine({ storage: seedStorage });
  const baseline = {
    studBook: clone(machine.state.studBook || {}),
    history: clone(machine.state.history || [])
  };

  const seats = new Map();      // key -> seat
  const byToken = new Map();    // token -> key
  let activeCode = cleanCode(joinCode) || 'ASCOT26';
  // A Durable Object is evicted and rebuilt regularly. `revision` therefore has
  // to be readable as "newer than what the browser holds" *per room lifetime*,
  // so every payload carries an epoch and the client resets its counter when the
  // epoch changes. Without this a restarted room (revision 2) lost every argument
  // with a browser still holding revision 7 and the table froze on screen.
  let epoch = randomToken().slice(0, 10);
  let revision = 0;
  let ticker = null;
  let lastPersist = 0;

  function dataFileFor(dir) {
    return dir ? `${String(dir).replace(/[\\/]+$/, '')}/ascot-table.json` : null;
  }

  function seatOf(token) {
    if (!token) return null;
    const key = byToken.get(token);
    return key ? seats.get(key) || null : null;
  }

  function newSeat(name, pinHash, pinSalt) {
    return {
      id: `seat-${randomToken().slice(0, 12)}`,
      key: seatKey(name),
      name: cleanName(name),
      pinHash,
      pinSalt,
      token: '',
      balance: START_BALANCE,
      bets: [],
      history: clone(baseline.history),
      studBook: clone(baseline.studBook),
      payout: 0,
      settled: false,
      ready: false,
      online: false,
      lastSeen: 0,
      fails: 0,
      heldUntil: 0
    };
  }

  // ---- lending a seat's books to the shared machine -------------------------

  function lend(seat, patch) {
    const state = machine.state;
    const seatSaved = {};
    for (const field of SEAT_FIELDS) {
      seatSaved[field] = state[field];
      state[field] = seat[field];
    }
    const shared = {};
    for (const field of LENT_FIELDS) shared[field] = state[field];
    if (patch) Object.assign(state, patch);
    return { seatSaved, shared };
  }

  function reclaim(seat, lent) {
    const state = machine.state;
    for (const field of SEAT_FIELDS) seat[field] = state[field];
    for (const field of SEAT_FIELDS) state[field] = lent.seatSaved[field];
    for (const field of LENT_FIELDS) state[field] = lent.shared[field];
  }

  function withSeat(seat, fn, patch) {
    const lent = lend(seat, patch);
    try {
      return fn(machine, lent);
    } finally {
      reclaim(seat, lent);
    }
  }

  // ---- settlement ----------------------------------------------------------

  function settleSeats() {
    const state = machine.state;
    const order = Array.isArray(state.order) ? state.order.slice() : [];
    const finishes = state.runners.map(runner => runner.finish);
    const afterLine = Math.max(...finishes) + 0.3;
    for (const seat of seats.values()) {
      // The engine settles exactly the tickets that bought the race, at the
      // prices they were locked at. Running it per seat keeps every cashier
      // honest without a second copy of the maths.
      withSeat(seat, () => machine.tick(0.25), {
        phase: 'race',
        clock: afterLine,
        order,
        settled: false
      });
      seat.ready = false;
    }
    revision += 1;
  }

  function resetForNewCard() {
    for (const seat of seats.values()) {
      seat.bets = [];
      seat.payout = 0;
      seat.settled = false;
      seat.ready = false;
    }
    revision += 1;
  }

  // ---- the shared clock ----------------------------------------------------

  function onlineSeats() {
    const now = Date.now();
    return [...seats.values()].filter(seat => seat.online && now - seat.lastSeen < OFFLINE_AFTER_MS);
  }

  function allReady(phase) {
    if (machine.state.phase !== phase) return false;
    const table = onlineSeats();
    return table.length > 0 && table.every(seat => seat.ready);
  }

  function startIfReady() {
    if (allReady('betting')) {
      machine.close();
      for (const seat of seats.values()) seat.ready = false;
      revision += 1;
      return true;
    }
    if (allReady('result')) {
      machine.next();
      resetForNewCard();
      return true;
    }
    return false;
  }

  function tick(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = seconds;
    while (remaining > 0.0005) {
      const step = Math.min(0.25, remaining);
      const before = machine.state.phase;
      machine.tick(step);
      const after = machine.state.phase;
      if (before !== 'result' && after === 'result') settleSeats();
      else if (before !== 'betting' && after === 'betting') resetForNewCard();
      else if (before !== after) revision += 1;
      startIfReady();
      remaining -= step;
    }
    revision += 1; // the clock moved, so a cached snapshot is stale
    persistIfDue();
  }

  function persistIfDue(force = false) {
    if (!onPersist) return;
    const now = Date.now();
    if (!force && now - lastPersist < 5000) return;
    lastPersist = now;
    try {
      const db = exportDb();
      if (db) onPersist(db);
    } catch {
      /* A failed write must never take the table down. */
    }
  }

  // ---- payloads ------------------------------------------------------------

  function stateFor(seat) {
    // Shallow copy of the shared race plus this seat's own books. Only the
    // fields that changed are deep-copied, so a poll does not walk the whole
    // ledger the way a naïve JSON clone would.
    const state = { ...machine.state };
    state.balance = seat.balance;
    state.bets = seat.bets;
    state.payout = seat.payout;
    state.settled = seat.settled;
    state.studBook = seat.studBook;
    state.history = (seat.history || []).slice(0, HISTORY_WIRE);
    return state;
  }

  function payloadFor(seat) {
    if (!seat) return null;
    const now = Date.now();
    const players = [...seats.values()].map(other => ({
      id: other.id,
      name: other.name,
      balance: Math.round((Number(other.balance) || 0) * 100) / 100,
      bets: other.bets,
      ready: Boolean(other.ready),
      online: Boolean(other.online) && now - other.lastSeen < OFFLINE_AFTER_MS
    }));
    return {
      revision,
      epoch,
      tableCode: activeCode,
      player: {
        id: seat.id,
        name: seat.name,
        balance: Math.round((Number(seat.balance) || 0) * 100) / 100,
        bets: seat.bets,
        ready: Boolean(seat.ready),
        online: true
      },
      players,
      state: stateFor(seat)
    };
  }

  function touch(seat) {
    seat.online = true;
    seat.lastSeen = Date.now();
  }

  // ---- authentication ------------------------------------------------------

  function checkCode(code) {
    const offered = cleanCode(code);
    if (!offered) return; // a seat already on the table may omit it
    if (offered !== activeCode) {
      throw new Error('That table code is not recognised. Ask the host for the current code.');
    }
  }

  async function register(request = {}) {
    const { code, token, pin, ip } = request;
    const name = cleanName(request.name);
    checkCode(code);

    // A live token always wins: this is a reload, not a new seat.
    const resumed = seatOf(typeof token === 'string' ? token : '');
    if (resumed) {
      touch(resumed);
      revision += 1;
      persistIfDue(true);
      return { token: resumed.token, reconnected: true };
    }

    if (name.length < NAME_MIN) throw new Error(`Use a username of at least ${NAME_MIN} characters.`);
    if (!PIN_RE.test(String(pin ?? ''))) throw new Error('Enter an exact 4-digit PIN (0–9).');

    const key = seatKey(name);
    let seat = seats.get(key);
    const now = Date.now();

    if (seat) {
      if (seat.heldUntil && now < seat.heldUntil) {
        const seconds = Math.ceil((seat.heldUntil - now) / 1000);
        // Deliberately does not name the seat: an attacker must not be able to
        // confirm which usernames exist at this table.
        throw new Error(`Too many wrong PINs. Try again in ${seconds}s.`);
      }
      const hash = await hashPin(pin, seat.pinSalt);
      if (hash !== seat.pinHash) {
        seat.fails += 1;
        if (seat.fails >= ATTEMPT_LIMIT) {
          const hold = Math.min(ATTEMPT_HOLD_MS * 2 ** (seat.fails - ATTEMPT_LIMIT), ATTEMPT_HOLD_MAX_MS);
          seat.heldUntil = now + hold;
          seat.fails = 0;
        }
        revision += 1;
        throw new Error('That username and PIN do not match.');
      }
      seat.fails = 0;
      seat.heldUntil = 0;
    } else {
      if (seats.size >= SEAT_MAX) throw new Error(`This table is full (${SEAT_MAX} seats).`);
      const salt = randomSalt();
      seat = newSeat(name, await hashPin(pin, salt), salt);
      seats.set(key, seat);
    }

    // One live token per seat: signing in from a second device retires the old
    // one instead of leaving two seats sharing a balance.
    if (seat.token) byToken.delete(seat.token);
    seat.token = randomToken();
    byToken.set(seat.token, key);
    touch(seat);
    seat.meta = { ip: String(ip || '').slice(0, 64) };
    revision += 1;
    persistIfDue(true);
    return { token: seat.token, reconnected: Boolean(seat.pinHash) && seat.balance !== START_BALANCE };
  }

  function authenticated(token) {
    const seat = seatOf(token);
    if (!seat) return false;
    touch(seat);
    return true;
  }

  function snapshot(token) {
    const seat = seatOf(token);
    if (!seat) return null;
    touch(seat);
    return payloadFor(seat);
  }

  function needSeat(token) {
    const seat = seatOf(token);
    if (!seat) throw new Error('This player seat is not recognised. Rejoin with the table code.');
    touch(seat);
    return seat;
  }

  function action(token, name, data = {}) {
    const seat = needSeat(token);
    switch (String(name || '')) {
      case 'place': {
        const market = String(data.market || '');
        const nums = Array.isArray(data.nums) ? data.nums.map(Number) : [];
        const amount = Number(data.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Choose a whole medal stake.');
        if (nums.length > 2 || nums.some(n => !Number.isInteger(n) || n < 1 || n > 6)) {
          throw new Error('Choose a runner.');
        }
        const error = withSeat(seat, () => machine.place(market, nums, amount));
        if (error) throw new Error(error);
        break;
      }
      case 'cancel': {
        const index = Number(data.index);
        if (!Number.isInteger(index) || index < 0) throw new Error('That ticket is no longer on the tray.');
        const ok = withSeat(seat, () => machine.cancel(index));
        if (!ok) throw new Error('That ticket cannot be refunded now.');
        break;
      }
      case 'refill': {
        const ok = withSeat(seat, () => machine.refill());
        if (!ok) throw new Error('A refill is only for a seat with no tickets and under 5 medals.');
        break;
      }
      case 'ready':
      case 'next': {
        seat.ready = !seat.ready;
        break;
      }
      case 'leave': {
        seat.online = false;
        seat.ready = false;
        break;
      }
      default:
        throw new Error('No such table action.');
    }
    revision += 1;
    startIfReady();
    persistIfDue(name === 'ready' || name === 'next');
    return payloadFor(seat);
  }

  function leave(token) {
    const seat = seatOf(token);
    if (!seat) return false;
    seat.online = false;
    seat.ready = false;
    revision += 1;
    persistIfDue(true);
    return true;
  }

  // ---- persistence ---------------------------------------------------------

  function exportDb() {
    const cabinet = { ...machine.state, history: (machine.state.history || []).slice(0, HISTORY_DB) };
    const players = {};
    for (const seat of seats.values()) {
      players[seat.key] = {
        id: seat.id,
        name: seat.name,
        pinHash: seat.pinHash,
        pinSalt: seat.pinSalt,
        token: seat.token,
        balance: seat.balance,
        bets: seat.bets,
        payout: seat.payout,
        settled: seat.settled,
        history: (seat.history || []).slice(0, HISTORY_DB),
        studBook: seat.studBook
      };
    }
    return { version: 2, joinCode: activeCode, savedAt: Date.now(), revision, cabinet, players };
  }

  function restore(db) {
    if (!db || typeof db !== 'object') return;
    // Continue the numbering where the previous instance left off, so logs and
    // clients stay readable across an eviction.
    revision = Number.isFinite(Number(db.revision)) ? Number(db.revision) : 0;
    if (db.cabinet && Array.isArray(db.cabinet.runners) && db.cabinet.runners.length === 6) {
      try { machine.hydrate(db.cabinet); } catch { /* a bad snapshot starts a fresh table */ }
    }
    const players = db.players && typeof db.players === 'object' ? db.players : {};
    for (const [key, saved] of Object.entries(players)) {
      if (!saved || !saved.name || !saved.pinHash) continue;
      const seat = newSeat(saved.name, saved.pinHash, saved.pinSalt || randomSalt());
      seat.id = saved.id || seat.id;
      seat.token = typeof saved.token === 'string' ? saved.token : '';
      seat.balance = Number.isFinite(Number(saved.balance)) ? Number(saved.balance) : START_BALANCE;
      seat.bets = Array.isArray(saved.bets) ? saved.bets : [];
      seat.payout = Number(saved.payout) || 0;
      seat.settled = Boolean(saved.settled);
      seat.history = Array.isArray(saved.history) && saved.history.length ? saved.history : clone(baseline.history);
      seat.studBook = saved.studBook && typeof saved.studBook === 'object' ? saved.studBook : clone(baseline.studBook);
      seat.online = false;
      seats.set(key, seat);
      if (seat.token) byToken.set(seat.token, key);
    }
  }

  restore(initialDb);

  if (autoTick) {
    ticker = setInterval(() => tick(0.25), 250);
    if (typeof ticker.unref === 'function') ticker.unref();
  }

  return {
    get joinCode() { return activeCode; },
    set joinCode(next) { activeCode = cleanCode(next) || activeCode; },
    get game() { return machine; },
    get revision() { return revision; },
    get seats() { return [...seats.values()]; },
    dataDir,
    dataFile,
    register,
    snapshot,
    authenticated,
    action,
    leave,
    tick,
    exportDb,
    persist: () => persistIfDue(true),
    stop() { if (ticker) clearInterval(ticker); ticker = null; }
  };
}

module.exports = { createRoom, SEAT_MAX, START_BALANCE, HISTORY_WIRE, HISTORY_DB };
module.exports.default = module.exports;
