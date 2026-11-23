# Royal Ascot · Multiplayer op Cloudflare Workers

Deze opzet draait de volledige Royal Ascot-tafel (statische website + gedeelde multiplayer-API + continue server-side races + persistente SQLite-opslag) rechtstreeks op **Cloudflare Workers** met een **SQLite-backed Durable Object** (`SharedTable`).

- **Races lopen door op de server**: de klok loopt door via wandklok-voortgang én Durable Object Alarms, ook tussen logins door.
- **Spelerlogin met Nickname + PIN**: spelers kunnen een persoonlijke PIN instellen om op elk apparaat terug in te loggen op hun eigen portemonnee, lopende tickets en historie.
- **Belangrijk: gebruik Cloudflare Workers (geen Cloudflare Pages)**: een `*.pages.dev`-project serveert alleen statische bestanden en negeert `wrangler.jsonc` + `worker/` + Durable Objects! Gebruik altijd een **Worker** (`*.workers.dev`).

## Bestanden in dit pakket

- `wrangler.jsonc` — Cloudflare Worker-configuratie (`royalascot`, `nodejs_compat`, statische assets, standaard `ASCOT_TABLE_CODE: "ASCOT26"`, en `SharedTable` SQLite Durable Object).
- `worker/index.js` & `worker/table.js` — Worker-entrypoint, Durable Object `alarm()` en `/api/info`, `/api/join`, `/api/state`, `/api/action`.
- `server-room.cjs` — Gedeelde tafel-logica, spelerlogin met PIN en weddenschapafhandeling.
- `js/multiplayer-client.js`, `js/app.js`, `index.html`, `styles.css`, e.a. — Frontend multiplayer-client, inklapbaar spelersmenu linksonder, alle 9 camerastanden en graphics-updates.
- `.assetsignore` — zorgt dat alleen publieke frontendbestanden (`index.html`, `styles.css`, `assets/`, `js/`) als statische assets worden geüpload.

## Deployen vanaf GitHub Desktop (zonder CLI)

1. Pak `cloudflare-github-desktop.zip` uit en kopieer **alle** bestanden naar je lokale GitHub-map (`royalascot`), vervang bestaande bestanden indien gevraagd.
2. Commit en push naar `main` via **GitHub Desktop**.
3. Open het **Cloudflare Dashboard** → **Workers & Pages** → **Create** → kies **Workers** → **Import a repository** (kies **niet** Pages).
4. Selecteer je GitHub-repository **`guypeers2-cmyk/royalascot`**.
5. Laat de projectnaam op **`royalascot`** staan (gelijk aan `"name"` in `wrangler.jsonc`), bouwcommando leeg, en **Deploy command** op **`npx wrangler deploy`**.
6. Klik op **Save and Deploy**.
7. *(Optioneel)* Pas de standaard tafelcode **`ASCOT26`** aan via Worker → **Settings** → **Variables and Secrets** → **`ASCOT_TABLE_CODE`**.
8. Open je **`https://royalascot.<jouw-subdomain>.workers.dev`**-URL! Vul je **Nickname**, een persoonlijke **PIN** (om later op elk apparaat weer in te loggen) en de tafelcode (`ASCOT26`) in.
