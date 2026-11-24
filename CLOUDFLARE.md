# Deploy “Royal Ascot · Harness Trot” to Cloudflare

This folder is a complete, self-contained deployment: the static cabinet **and**
the authoritative shared table (one Worker + one Durable Object). Nothing here
talks to an external database, and no file outside this folder is needed.

```
royal-ascot-cloudflare/
├── wrangler.toml        Worker, assets, Durable Object, table code
├── .assetsignore        what must never be published as a static file
├── index.html           the cabinet
├── styles.css
├── assets/              101 files: art, fonts, six hoofbeat tracks, start cues
├── js/                  66 browser modules, including the shared engine
├── worker/index.js      the Worker: /api/* + a Durable Object class
├── worker/table.js      the endpoint handler inside the object
└── server-room.cjs      the authoritative room (seats, race, settlement)
```

---

## 0. What you get

| URL | Served by | What it is |
|---|---|---|
| `/`, `/styles.css`, `/assets/*`, `/js/*` | Workers Assets | the cabinet, no cold start |
| `/api/info` | Worker | `{"enabled":true}` — the page checks this to decide shared vs offline mode |
| `/api/join`, `/api/state`, `/api/action`, `/api/leave` | Worker → Durable Object | the shared table: seats, PINs, tokens, one race for everybody |

One deployment serves **one table** (a single Durable Object named
`shared-table`). Every player who enters the same table code joins the same
race. Medals are virtual and private per seat.

---

## 1. Prerequisites

- **Node 22.12 or newer** (`node -v`). Wrangler 4 refuses older runtimes.
- A Cloudflare account with Workers enabled: `npx wrangler login`.
- **Workers Paid is strongly recommended.** The first request of a brand-new
  table builds the field and the opening meet, which is ~1 s of CPU; the free
  plan's 10 ms CPU ceiling will terminate that request. Once a table has been
  saved, a cold start rehydrates from storage in **~4 ms**, but the very first
  one is expensive.

## 2. Deploy

```bash
cd royal-ascot-cloudflare
npm install            # installs wrangler 4 locally
npx wrangler login     # once per machine
npm run deploy         # or: npx wrangler deploy
```

Expected output:

```
Total Upload: ~110 KiB / gzip: ~30 KiB
Your Worker has access to the following bindings:
env.SHARED_TABLE     Durable Object
env.ASSETS           Assets
env.ASCOT_TABLE_CODE "ASCOT26"
Uploaded royal-ascot (…)
  https://royal-ascot.<your-subdomain>.workers.dev
```

Dry-run without touching your account (useful in CI):

```bash
npm run dry-run
```

## 3. The table code

Players need the table code to sign in. It is `[vars] ASCOT_TABLE_CODE` in
`wrangler.toml` (default **ASCOT26**).

- Change it to anything 4–12 letters/digits, then redeploy.
- The code is not a secret from your players, but it is the only thing standing
  between a stranger and a seat at the table. **Do not publish it** — share it
  with players directly, or put it in the URL they are given
  (`https://…/?code=FLEMISH42`, which pre-fills the login field).
- Wrong code → “That table code is not recognised.”

Print the live code from the platform side:

```bash
npx wrangler tail          # the first boot logs: TABLE JOIN CODE: ASCOT26
```

## 4. Verify the deployment

```bash
BASE=https://royal-ascot.<your-subdomain>.workers.dev

curl -s $BASE/api/info
# {"enabled":true,"table":"Royal Ascot · Shared Table"}

# join a seat
TOKEN=$(curl -s -X POST $BASE/api/join -H 'content-type: application/json' \
  -d '{"name":"Tester","pin":"1234","code":"ASCOT26"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# read the table
curl -s -H "authorization: Bearer $TOKEN" $BASE/api/state | head -c 200
```

Then in a browser: open the URL, pick a layout, sign in, and the **Station 07
betting glass** should appear while betting is open. Open a second browser (or a
phone), sign in with a different username, and press **Ready** on both — the
gates open for the whole table at once.

If the login gate says *“Offline single-device mode”*, `/api/info` is not
reaching the Worker: check that `run_worker_first = ["/api/*"]` is still in
`wrangler.toml`, and that `/api/info` returns JSON rather than the HTML page.

## 5. Custom domain / route

```toml
# wrangler.toml
routes = [
  { pattern = "ascot.example.com", custom_domain = true }
]
```

Then `npx wrangler deploy` again. Keep the game and the API on **one** origin:
the API rejects cross-origin requests (`403 Cross-origin requests are not
allowed`), by design.

## 6. How state is stored

- The Durable Object keeps the table in its own **SQLite** storage
  (`ctx.storage.sql`, table `ascot_shared_table`). The migration in
  `wrangler.toml` (`new_sqlite_classes`) is what makes that available — do not
  change it to `new_classes`, the object would have no `storage.sql`.
- Saved on joins, leaves, every command, and at most every 5 s during a race.
- **A redeploy does not wipe the table.** Seats, medals and the live race
  survive; the object rehydrates on its next request.
- To start from a clean table, delete the object's storage: open the Worker in
  the dashboard → *Durable Objects* → `SharedTable` → the `shared-table`
  instance → delete, or change the object name in `worker/table.js`
  (`idFromName('shared-table')`) and redeploy.
- A race is ~147 s of table time (60 s betting, 10 s to the stalls, then four
  laps). While a race is running the object books a **1 s alarm** so the clock
  keeps running even with nobody polling; during betting it is every 2.5 s, and
  alarms stop after 30 minutes with no players.

## 7. Local development

```bash
npm run dev            # http://localhost:8787, real workerd + Miniflare DO
```

Local state lives in `.wrangler/state/` and is not uploaded. `wrangler dev`
also honours the same `ASCOT_TABLE_CODE`.

For the Node edition instead (`serve.mjs`, file-backed, no Cloudflare):
use the parent project, not this folder.

## 8. Cost and traffic notes

- Payload: one poll is **~50–60 KiB** (the race plus the seat's last four
  receipts). The cabinet polls every 400 ms while visible and pauses in a
  background tab. Ten players ≈ **1.2 MB/s** aggregate; if that is too much for
  your plan, raise the poll interval in `js/multiplayer-client.js`
  (`const POLL_MS=400`).
- Requests: ~2.5/s per active player, plus 1/s alarm per running race.
- Every `/api/state` is served by the Durable Object (single-threaded per
  table). Eight seats is the cap, which is what the object is sized for.

## 9. Security posture (what is and is not protected)

- **Seats**: username + a 4-digit PIN. Five wrong PINs hold the seat for 30 s,
  doubling per further batch up to 15 min; `/api/join` is capped at 20 attempts
  per minute per IP, and the failure message never reveals whether a username
  exists. PINs are stored as salted SHA-256 (Web Crypto), never in clear.
- **One live token per seat**: signing in again retires the previous token, so
  two devices cannot share a balance.
- **Same-origin only** API, bearer tokens in `localStorage`, no cookies → no
  CSRF surface on commands.
- A 4-digit PIN is still only 10 000 guesses wide. For anything beyond friends
  and family, front the Worker with Cloudflare Access, or ask for a longer PIN.
- Medals are play money and live only inside the table's storage.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `500 Cloudflare SharedTable Durable Object binding is missing` | the `[[durable_objects.bindings]]` block or the migration is missing from `wrangler.toml` |
| `500 The shared table could not be opened` | the object failed to start; `npx wrangler tail` shows the reason (usually CPU on the free plan) |
| `403 Cross-origin requests are not allowed` | the page and the API are on different origins — serve both from this Worker |
| Gate says “Shared table online” but login says “seat no longer available” | the table was reset (new object) while the browser held an old token: sign in again |
| Login says “Too many sign-in attempts” | per-IP throttle, 20/minute. Wait a minute |
| Nobody’s bets appear on the other screen | each player must be signed in to the **same table code**; check the pill in the top-left says *N active* |
| First request takes ~1 s and times out on the free plan | see §1 — use Workers Paid |
| `Wrangler requires at least Node.js v22.12.0` | upgrade Node |

## 11. What is deliberately not in this folder

The single-file `royal-ascot.html`, the Node server (`serve.mjs`), the test
suite and the research docs are part of the source project, not of the deployed
site. They are not needed to deploy and are excluded from the asset upload by
`.assetsignore` anyway.
