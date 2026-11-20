# Self-hosting the shared table

This build adds one server-authoritative table. Every browser sees the same race, race clock and finish order. Each nickname has a separate virtual-medal balance and private tickets. A player can join during a race to watch; betting becomes available when a later betting window opens.

## Run it

Requires Node.js 18 or newer. From the project directory:

```sh
npm start
```

The server listens on port `3000` on all network interfaces, prints a **table join code**, and stores its table and player records under `data/table.json`. Share the code privately with players. Visit `http://localhost:3000` on the host, or `http://<host-lan-ip>:3000` from another device on the same network. Open the same URL in each browser; enter a nickname and the join code.

Configure the port, code and data directory with environment variables:

```sh
PORT=3000 ASCOT_TABLE_CODE=MYTABLE ASCOT_DATA=/srv/ascot/data npm start
```

If no `ASCOT_TABLE_CODE` is set, a random code is generated at startup. Keep the `data` directory backed up; it contains the current table and player balances. Use a persistent disk if running in a container.

## Joining over the internet

Run the process on a VPS or other always-on host, then put it behind a TLS reverse proxy (for example Caddy or nginx) and forward HTTPS traffic to port 3000. Do not expose an unencrypted public HTTP port. Allow inbound HTTPS at the firewall; keep the Node port private to the proxy where possible. The app uses same-origin HTTP requests, so no separate API domain or WebSocket port is required.

## Table and account notes

- This is a single shared table per server process, with up to 50 saved nickname seats by default.
- Nickname plus join code is the entry gate; it is **not** an account/password system. Returning browsers keep a random seat token locally. Anyone who obtains that token can use that seat.
- Balances are virtual medals only. No cash, payments or real-money wagering are supported.
- A host should protect the join code and server data file. Set a new code by changing `ASCOT_TABLE_CODE` and restarting; existing browser seat tokens remain valid.

Run the automated checks with `npm test`; the multiplayer room and portfolio tests are included.
