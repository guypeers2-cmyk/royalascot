# Vercel multiplayer deployment

The browser client and Vercel Node Functions are prepared for the existing shared-table project. Because Vercel functions are request-driven, the live race clock advances on active state/action requests; it is not a continuously running Node process. The shared table state and nickname portfolios are transactionally stored in Postgres so concurrent player requests see one authoritative race.

## Required Vercel setup

**Deployment is not yet published.** The available `hippodrome` Vercel project is linked to GitHub repo `guypeers-cmyk/8Horsse`, while this workspace's `origin` is `guypeers2-cmyk/royalascot`. Link the project to the source containing these changes (or choose a new project) before deploying; otherwise Vercel would build a different revision. The current Vercel connector also does not expose the project’s Deployment Protection setting, so its SSO gate must be changed in the Vercel dashboard to make the URL public.

1. Attach a Neon/Postgres database to the `hippodrome` Vercel project (or use another Postgres provider). Add its connection string as `DATABASE_URL` in **Production** and **Preview** environments. Keep the value in Vercel; do not commit it or paste it into chat.
2. Add `ASCOT_TABLE_CODE` as an environment variable, using a private code you share with players.
3. Deploy this source tree to the Vercel project. It needs the `api/` functions, `lib/vercel-room.cjs`, `server-room.cjs`, the browser changes, and `vercel.json`; deploying only the existing static build is not enough. The `postgres` dependency is declared in `package.json`.
4. The shared-table row and schema are initialized on the first API request. Nicknames, balances, current wagers and per-race receipts live in that row.
5. In **Settings → Deployment Protection**, disable Vercel Authentication for the public Vercel URL if you want people outside the Vercel team to join. The current project is SSO-protected; otherwise those players will be blocked before reaching the join form.

## Important behavior and security

- One shared table per deployment; each seat has independent virtual medals and tickets. A late join can spectate and bet on the next open card.
- The table advances while clients poll it. With no clients polling, serverless execution pauses; the next visitor resumes the stored card rather than waking a background process.
- Nickname + join code is a lightweight gate, not account authentication. Browser seat tokens are bearer credentials. Use HTTPS, keep the join code private, and rotate tokens/data if a seat is compromised.
- This is a virtual-medal game only. No cash, payments or real-money wagering.

For a table that must keep advancing with no connected visitors, use the long-running `npm start` server described in [MULTIPLAYER.md](MULTIPLAYER.md) on a persistent Node host instead.
