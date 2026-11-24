# Royal Ascot · Harness Trot — multiplayer review

Scope: the **shared-table / multiplayer** edition, as shipped in
`cloudflare-github-desktop (21).zip` (the archive behind the Drive link).
Reviewed: `serve.mjs`, `worker/index.js`, `worker/table.js`,
`js/multiplayer-client.js`, `package.json`, and the engine/UI they call into.
Date: 24 Nov 2026. All measurements below are from this machine.

---

## 0. Headline

The multiplayer edition **could not run at all** as shipped. Two modules that
both servers import were missing from the archive:

```
$ npm start
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../tools/sparse-plates.cjs'
  imported from serve.mjs
$ # and worker/table.js line 1:
import roomPackage from '../server-room.cjs';   // file not in the archive
```

`server-room.cjs` is the authoritative room — seats, PINs, tokens, the race
clock, settlement, persistence. Without it there is no shared table, no
Cloudflare build, and no way to test anything else in this list. `npm test`
also failed instantly: `package.json` listed 25 test files under `tests/`,
none of which are in the archive.

That is now fixed: the room has been **rebuilt** against the contract the rest
of the code already expects (`register / snapshot / authenticated / action /
leave / tick / exportDb / game / joinCode / dataFile`), and it drives the race
with the game's *own* `js/engine.js` — the engine is CommonJS-exportable, so the
server and the cabinet run the same field draws, gate clock, trot curves,
locked prices and settlement maths. It is not a second implementation of the
rules; the certified code path is the one that decides a race. Behaviour is
proven by 22 tests, including a full settled race and two real HTTP clients.

| | Before | After |
|---|---|---|
| `npm start` | crash (missing module) | shared table on `:3000`, JSON persistence |
| Cloudflare deploy | impossible (also no `wrangler.toml`) | `npx wrangler deploy` ready |
| `npm test` | crash (missing test files) | 22 tests, all passing (~25 s) |
| Race authority | none | `js/engine.js` itself, one shared clock |
| PIN brute force | unlimited tries, ~10 000 wide | 5 tries → 30 s hold, doubling to 15 min, plus 20 joins/min per IP |

---

## 1. Blocker findings (P0)

### 1.1 The authoritative room module is missing from the archive
`serve.mjs:2` and `worker/table.js:1` both import it; neither the module nor its
helper `tools/sparse-plates.cjs` is present. Everything downstream — joining,
medals, tickets, settlement, reconnection, persistence — was therefore
unreachable code.

**Fixed.** `server-room.cjs` (new, ~520 lines) + `tools/sparse-plates.cjs`
(new, restores the server's in-memory WebP "plate" cache that `serve.mjs`
already called).

How the room keeps seats honest without a second rulebook
(sharing `js/engine.js`, `lend()` in `server-room.cjs`):

- One machine owns the race: runners, phase, clock, order, prices.
- Each seat owns only `balance`, `bets`, `history`, `studBook`, `payout`,
  `settled`.
- An action *lends* the seat's books to the shared machine, calls the engine's
  own `place / cancel / refill`, then takes the books back. Stake laws, the
  six-ticket tray, locked odds and refunds are the engine's code.
- Settlement runs the engine's `tick()` once per seat at the finish line, so
  every ticket is paid at the price it was locked at, and each seat keeps its
  own receipt in its own history.

### 1.2 No `wrangler.toml` → the Cloudflare path could never deploy
No Durable Object binding (`env.SHARED_TABLE` would be `undefined`, so
`handleWorkerFetch` returned *“Cloudflare SharedTable Durable Object binding is
missing.”* on every API call), no assets binding for the cabinet, and no
migration declaring `new_sqlite_classes` even though the handler uses
`ctx.storage.sql` (a KV-backed class has no `storage.sql`).

**Fixed.** `wrangler.toml` (new): assets binding with `run_worker_first =
["/api/*"]`, the `SharedTable` binding, and the `v1 / new_sqlite_classes`
migration.

### 1.3 The test suite referenced 25 files that are not in the archive
`npm test` was a hard failure. **Fixed**: `tests/` now holds a runnable suite
(`npm test` → 22 tests). The original 25 suites are still missing — they are
not reconstructable from this archive, so the new suite covers the netcode
contracts rather than pretending to replace them.

---

## 2. Security (P1)

### 2.1 A 4-digit PIN with no attempt limit and no rate limit
Both servers accepted unlimited `/api/join` attempts. A 4-digit PIN is 10 000
guesses; with no lockout, a script takes over any player's medal balance in
seconds, and because **medals are shared table state**, the seat is the
account.

**Fixed**, in three layers:
- per-seat hold: 5 wrong PINs → 30 s, doubling per further batch, capped at 15 min (`register()`);
- per-IP join bucket: 20/minute (`both` servers) → `429`;
- the failure message is now generic (`That username and PIN do not match.`)
  so the endpoint cannot be used to enumerate which usernames exist.

### 2.2 PIN handling
The client sent the raw PIN on every login and, for offline mode, stored
`SHA-256('ascot-pin:' + pin)` — an unsalted 10 000-entry rainbow table.
**Fixed**: the server hashes with a per-seat random 16-byte salt
(WebCrypto SHA-256, no Node built-ins, so it also runs in Workers); the
offline browser fallback is unchanged but is documented as local-only
obfuscation, not a credential.

### 2.3 Two live tokens per seat
`seat.token` was never retired, so the same seat could be signed in twice
(two devices, two balances in flight, races of the same money).
**Fixed**: one live token per seat; a new sign-in retires the old token and
the client clears a dead token instead of polling with it (`poll()` 401 path).

### 2.4 A stale answer could overwrite newer money
`accept()` stored `payload.revision` (`js/multiplayer-client.js:560`) but never
compare it, and `/api/state` polls (220 ms) race `/api/action` answers. A slow
poll arriving after a bet response reverted the balance, the tray and the clock
on screen. **Fixed**: monotonic `revision` guard (older answers dropped) plus a
clock clamp that keeps the race from jumping backwards between polls.

### 2.5 One corrupt payload bricked every endpoint
`ensureRoom()` ran outside the `try` in the handler and did
`JSON.parse(row.payload)` unguarded, so a single unreadable row turned every
route into an unhandled 500 — permanently. **Fixed**: the parse is guarded
(a fresh table is opened and the failure logged), `ensureRoom()` failure is a
`503`, and SQL writes are wrapped so a storage hiccup cannot kill a live race.

### 2.6 The UI announced bets before the table accepted them
In server mode `game.place()` returned `null` and `game.cancel()`/
`game.refill()` returned `true` unconditionally
(`js/multiplayer-client.js:566-570`), while `app.js:110` treats that return
value as final: it plays the chip sound and toasts “ticket placed / stake
refunded” **before** the request leaves the browser. A refused stake produced a
false confirmation, then a contradiction.

**Fixed** (mitigated fully, without rewriting `app.js`): the client now
pre-validates against the mirrored state with the same rules the table uses
(phase, stake laws, six-ticket tray, balance, refundability) and returns the
table's own wording for a refusal, so no toast has to be taken back. A refusal
that only the server can see still arrives as the “network error” toast.
*Deeper fix, not done:* make `place()` promise-aware in `app.js` and drive the
confirmation from the accepted snapshot.

---

## 3. Performance and cost (P2) — measured

### 3.1 Every poll shipped the whole ledger
`/api/state` returned the complete cabinet state, and the client polls it every
220 ms:

| Payload | Measured size |
|---|---|
| state during betting | **235 059 B** |
| state during a race | **252 185 B** |
| …of which `history` (≈42 archived receipts) | 211 890 B |
| …of which `studBook` | 21 288 B |

That is ≈ 1.06 MB/s **per player**, re-stringified on a single-threaded Durable
Object, four and a half times a second.

**Fixed**: the room sends the shared race + the seat's books and trims the
ledger to the last 4 receipts (what the finish board's “Last 3” needs) — the
poll is now ~45–65 KB, the client polls at 400 ms instead of 220 ms, polling
pauses in a hidden tab and resumes immediately on return, and failed polls back
off exponentially instead of hammering a host that is down.

### 3.2 Alarm churn on every request
`scheduleNextAlarm()` called `ctx.storage.setAlarm()` on **every** request —
about 4 storage writes per second per player for an alarm that was already
booked — and `activeAlarmAllowedUntil`/`lastClientMs` were refreshed *before*
authentication, so unauthenticated traffic could keep the table ticking and
writing. **Fixed**: `getAlarm()` is compared first and the alarm is only
re-armed when it is meaningfully earlier (`ALARM_HEADROOM_MS`), and anonymous
requests no longer advance the shared clock.

### 3.3 Write amplification
`saveSnapshot()` ran on every `/api/state` (throttled to 1/s) *and* on every
action, stringifying the full payload (≈250 KB cabinet + ≈55 KB per seat).
**Fixed**: transitions only, with a 5 s floor and forced writes on
join/leave/action; exported receipts are trimmed to the last 6 per seat.

### 3.4 Unbounded catch-up
`advanceTo()` replayed up to `min(elapsed, 3600) s` in 0.25 s steps — 14 400
engine ticks inside one request, which is a CPU-limit kill on Workers.
**Fixed**: catch-up capped at 120 s (`MAX_CATCH_UP_SECONDS`).

### 3.5 Body size checked after buffering
Both servers concatenated the body first and compared the length afterwards.
**Fixed**: `content-length` is checked first and the reader aborts at 8 KiB.

---

## 4. Correctness and robustness (P3)

- **Proxy-blind origin check.** `sameOrigin()` compared `Origin` to `Host`
  only. Behind a tunnel or ingress that rewrites `Host`, every API call 403s and
  the gate reports “Offline single-device mode”. **Fixed**: also accepts
  `x-forwarded-host`, plus an `ASCOT_ALLOW_ORIGIN` allowlist.
- **Duplicate leave beacons.** `pagehide` fired `/api/leave` on every unload
  attempt. **Fixed**: one per token.
- **No `405`s / HEAD handling / security headers** on the Node server; the
  static allowlist also refused any `.html` page other than `index.html`.
  **Fixed**: method guard, HEAD support, `X-Content-Type-Options`,
  `Referrer-Policy`, `Vary: Origin`, and a route for other `*.html`.
- **Reconnect gate spam.** A dead host re-opened the login gate every 10 s while
  polls failed. **Fixed**: backoff plus a single reconnection notice.
- **Seat cap and table identity.** The table is one Durable Object
  (`idFromName('shared-table')`) and seats now cap at 8. Hosting several
  tables on one deployment needs the table code in the object id — noted, not
  implemented.
- **Cold start is heavy.** Constructing the room runs the engine's opening-meet
  staging: ≈1.1 s of CPU on this machine. Fine for a Durable Object on a paid
  plan (30 s CPU), fatal on the free tier's 10 ms/request — sizing note, and
  the reason the persistence path exists.
- **A race is ≈147 s of table time** (10 s gates + 136 s of trot), so the
  Durable Object alarm fires ~147 times per race. Expected, but worth knowing
  before setting budgets.

---

## 5. What is still missing from the archive (not fixed)

These cannot be reconstructed from what was shared, and the README describes
them:

- `tools/build_offline.py` → the single-file `royal-ascot.html` edition cannot
  be rebuilt.
- `docs/`, `CREDITS.md`, `MULTIPLAYER.md`, `VERCEL_MULTIPLAYER.md` → the
  Vercel + Postgres deployment documented in the README has no server in this
  archive. `postgres@^3.4.7` is still a dependency but nothing imports it; the
  room here persists to a JSON file (Node) or Durable Object SQLite (Workers).
  Say the word and the Postgres adapter is a small addition.
- The original 25 test files.
- `.nojekyll` and the notices referenced by the README.

---

## 6. Files changed / added

| File | Status | What |
|---|---|---|
| `server-room.cjs` | **new** | authoritative room: seats, salted PINs + holds, tokens, one shared race, per-seat money and receipts, ready votes, persistence, wire-payload trimming |
| `tools/sparse-plates.cjs` | **new** | restores the plates cache `serve.mjs` imports |
| `wrangler.toml` | **new** | DO binding, SQLite migration, assets, `run_worker_first` |
| `serve.mjs` | rewritten | async join, atomic JSON persistence, proxy-aware origin, per-IP join bucket, action bucket, body caps, 405/HEAD, security headers, route fix |
| `worker/table.js` | rewritten | guarded cold start, bounded catch-up, alarm throttling, persisted-write floor, join throttle, IP passthrough, anonymous traffic cannot drive the clock |
| `js/multiplayer-client.js` | patched | revision ordering + clock clamp, honest pre-validation, 400 ms polling with pause/backoff, dead-token cleanup, de-duplicated leave, un-refundable tickets no longer reported as refunded |
| `tests/room.test.cjs` | **new** | 10 tests: registration, code, holds, stake laws, per-seat money, ready quorum, a full settled race, restart without double-debit, payload size, seat cap |
| `tests/multiplayer-http.test.cjs` | **new** | 5 tests over real HTTP: static serving, two seats betting on one race, origin/oversize refusal, restart with medals, join throttling |
| `tests/worker-table.test.cjs` | **new** | 7 tests against the Durable Object handler with a fake `ctx.storage`: cold start, corrupt payload recovery, anonymous traffic, alarm churn, body caps, origin, persistence |
| `package.json` | patched | `test` → `node --test tests/`, `engines`, `smoke` script |

## 7. Verify it yourself

```bash
npm start                      # shared table on :3000, code in the banner
npm test                       # 22 tests
# open http://localhost:3000 in two browsers (or two devices on the LAN),
# log in with two different usernames + any 4-digit PIN, and press Ready
# on both: the gates open for the whole table at once.
```

For Cloudflare: `npx wrangler deploy` — then the same page is served with
`/api/*` handled by the Durable Object.

---

## 8. Second report: “no betting screen when betting is open”

### 8.1 Root cause
The station's betting glass (`#roundConsole`, the *Station 07 betting console*
the README tells players to bet on) was **pinned shut**:

```js
// js/round-program.js, as shipped
function layers(){const main=false, ... ; tube.hidden=!main; ...}
```

`main` was a literal `false` with no setter anywhere in the archive, so
`#roundConsole` could never be shown in any phase. The only other betting
surface — the desk terminal (`#marketPane`) — lives inside the station drawer,
which starts closed. Net effect: with betting open, the cabinet showed the
track and **no betting screen at all**. The deck underneath it was also
missing its Ready key, although `styles.css` already styled
`.sat-deck .key-start` and `js/multiplayer-client.js` was already looking for
`[data-tube="start"]`.

Measured in headless Chromium before the fix: `#roundConsole.hidden = true`,
0 field rows, cabinet classes `cabinet-shell`.

### 8.2 Fix
| File | Change |
|---|---|
| `js/round-program.js` | `main` now comes from a real `consoleOpen` state; the glass opens when a race opens for betting and closes when the gates are released (only a genuine phase change moves it, so placing a ticket after the player shuts the glass does not spring it back open). New `setConsole()`, `present('console')`, `toggleConsole()`; `data-tube="track"` hands the player back to the parade |
| `index.html` | the deck regains its **Ready** key (`data-tube="start"`, so the shared-table ready vote now works from the glass) and gains a **Track** key to put the glass away |
| `styles.css` | `.key-track` and the Ready key's margins, plus a narrow-screen rule |
| `js/app.js` | Station menu → *Console* now actually opens the glass (`program.toggleConsole()`), instead of only closing the drawer and moving the camera |

Verified in headless Chromium at 1440×980, 834×1112 and 390×844, in both the
shared-table build and the offline single-device build:

| Check | Result |
|---|---|
| `#roundConsole` visible while betting is open | yes (6 field rows, cabinet gains `console-stage`) |
| Place a bet from the glass (shared table) | ticket 1 · credit 500 → 490 · “My bets 1” |
| **Track** key | glass hidden, track and parade visible |
| **Ready** key | glass closes, phase → *Bets locked*, race starts for the table |
| Deck fits mobile 390 px | yes, no horizontal overflow |
| Console errors | none |

Screenshots: `shots/1-betting.png`, `2-ticket.png`, `3-track.png`,
`mobile.png`, `tablet.png`.

### 8.3 Two further bugs found while verifying
1. **The 3D cabinet aborted at load.** `js/orbit.js` assigned `dirty` from the
   room-texture callback on line 6, but `dirty` was declared in a `let` list on
   line 138. When the texture resolved synchronously from the loader cache the
   callback hit the temporal dead zone (`ReferenceError: Cannot access 'dirty'
   before initialization`), which threw out of `createCabinetOrbit()` and left
   the orbit/3D chase views half-built. Pre-existing in the archive; fixed by
   hoisting the declaration. Page errors are now clean on all three viewports.
2. **The pinned “Active players” popover covered the glass header** — including
   the *Closes* timer — because the multiplayer client pinned it open on every
   desktop viewport. It now starts collapsed (the pill still shows the count
   and the list opens on click).

### 8.4 Optional dev tools added
`tools/dev/betting-screen-check.cjs` (jsdom), `betting-screen-shot.cjs` and
`betting-screen-mobile.cjs` (Playwright) re-run exactly these checks against a
running table. They need `npm i --no-save jsdom playwright` and
`npx playwright install chromium`; nothing in the game or the tests depends on
them.

---

## 9. Third report: Cloudflare Workers deploy export

The shared table needs one long-lived process holding one room. The export in
`royal-ascot-cloudflare/` does that with the pieces Cloudflare actually has:

| Concern | Mechanism |
|---|---|
| Static game | **Workers Assets** — `[assets] directory = "."`, `run_worker_first = ["/api/*"]` |
| One shared room | **Durable Object** `SharedTable` (`new_sqlite_classes`) |
| Race timers | DO **alarms** (1 s in race, 2.5 s while betting, off after 30 min idle) |
| Persistence | DO **SQLite**, table `ascot_shared_table`, saved on join/leave/action and ≤ every 5 s in a race |
| Access code | `[vars] ASCOT_TABLE_CODE = "ASCOT26"` |
| Private files | `.assetsignore` keeps `server-room.cjs`, `worker/`, docs, `data/` off the CDN — verified 404 in workerd |

### 9.1 What was verified, and how
`npx wrangler deploy --dry-run` in the export reads **173 files, upload 110.83 KiB
(gzip 29.94 KiB)**, three bindings (`SHARED_TABLE`, `ASSETS`, `ASCOT_TABLE_CODE`).
`wrangler dev` (real workerd + Miniflare DO, not the Node shim) then served the
game: `/`, `/styles.css`, `/js/*`, `/assets/*` → 200; `/server-room.cjs`,
`/wrangler.toml`, `/CLOUDFLARE.md`, `/package.json`, `/worker/table.js` → 404;
`/api/info` → 200. A real Chromium run against it passed the whole §8.2 matrix —
betting glass open (`hidden:false`, 6 field rows), a bet placed through the
Durable Object landed (credit 500 → 490, “My bets 1”), **Track** worked, **Ready**
closed the glass, `page errors: none`.

### 9.2 Two bugs that only appear on Cloudflare
1. **A Durable Object eviction reset `revision`** from 7 back to 2 when the object
   was recycled between requests. The browser client keeps a monotonic guard
   (`payload.revision <= revision` → ignore), so after eviction it rejected every
   future payload and the table froze. Fixed by adding a per-instance `epoch`:
   persisted revisions are restored from storage, and a payload with a new epoch
   makes the client reset its guard instead of dropping the state.
   Regression test: *“a restarted table keeps its numbering and gets a fresh epoch”*.
2. **Cold start burned ~0.8–1.1 s of CPU** rebuilding the engine on the first
   request — far past the Workers free-plan 10 ms CPU limit, so the first visitor
   would get a 500. `cabinetFor(db)` now rehydrates the engine from the saved
   cabinet (validates 6 runners + the stud book, feeds a seeded storage shim into
   `Engine.createMachine`): restart drops to **4 ms**. The very first cold start of
   a brand-new deployment is still ~1 s, so the deploy guide documents **Workers
   Paid** as a prerequisite.

`node --test tests/` → **23/23** after both fixes.

### 9.3 Deploying
```bash
cd royal-ascot-cloudflare
npm install                 # pulls wrangler 4.x (needs Node >= 22.12)
npx wrangler login
npm run deploy              # or: npm run dry-run to inspect the bundle first
curl https://royal-ascot.<subdomain>.workers.dev/api/info
```
Full walkthrough, custom domain, storage reset and troubleshooting: `CLOUDFLARE.md`
inside the bundle.
