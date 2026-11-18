# Royal Ascot · Hippodrome Arcade Club

A playable, local-medal rebuild of the [original Hippodrome](https://hippo-8lw.pages.dev/). The outdoor course, tiered grandstands, spectators, and crowd soundtrack have been removed. Station 07 is now on the **middle of the long side**, looking across the table. The horses pass left to right along the straight immediately beyond the player’s own satellite console.

## Play

- **Single-file edition:** open `royal-ascot.html` in a modern browser. Graphics, fonts, scripts, and sound synthesis are all included. No internet connection is required for gameplay.
- **Source project:** run `npm start` from this folder (Node 18+). There are no npm dependencies. Open the displayed port, normally 3000.
- **Static hosting:** serve `index.html`, `styles.css`, `js/`, and `assets/` from the same directory. No build step, accounts, backend, keys, cookies, analytics, or payment integration.

Choose a runner, select a denomination, and press **Place bet**. The metal **skip** button beside the countdown starts the race immediately after a three-second gate sequence. Otherwise the cabinet automatically runs through betting, the gate sequence, four racing laps, settlement and a fresh field. Open **My bets** to inspect tickets or refund one before betting closes.

### Publish on GitHub Pages

This repository is a static site. `index.html` is at the repository root and all runtime asset URLs are relative, including when the site is served under `/royalascot/`. To publish a pushed copy, open **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, select **main** and **/ (root)**, and save. GitHub shows the live URL after a successful deployment. No external package installation or build service is required.

### Markets

| Market | Pays when |
|---|---|
| Win | The selected horse finishes first. |
| Show | The selected horse finishes **exactly second**, preserving this particular source cabinet's nonstandard rule. |
| Quinella | The two selected horses take the first two places in either order. |

Displayed multipliers are gross returns, **including the stake**. Six different open selections are allowed; repeating a selection increases the existing ticket. Each station starts with 500 fictional medals. If fewer than five remain and there are no open tickets, the terminal offers a free refill. No real-money value or cash-out.

### Cameras and controls

- **Long-side seat (default):** a silver-and-charcoal cabinet, cream canopy and twin strip lamps. The photographic-style scene is calibrated to the gravel at the base of the rails; animated textured carrier figures, the shared odds display and your inset CRT are all live. Both bends stay visible in the normal mobile view. In portrait immersive mode the station fills the phone, and a swipe looks left or right along the rail.
- **Console close-up:** click the physical screen or choose this camera. Tap a market and runner on the CRT; use the two amber buttons to adjust the stake in five-medal steps, then press the green BET button. These are real controls connected to the same tickets and balance, also in immersive mode. The adjacent accessible HTML controls remain available.
- **Rail close-up:** follows a selected miniature from the side. All six have moulded and painted details, a numbered saddlecloth, silver spindle and low green carrier. The torso, forelegs and hind legs have independently phased mechanical movement.
- **Track map:** an orthographic instrument view of the same positions.
- **Cabinet orbit:** a physical three-dimensional cabinet with a matching long-axis fascia, slim lamp gantry, polished columns, twelve satellite stations and live CRT textures. The initial camera looks across the long side. Drag to rotate, scroll or use +/- to zoom. The other views work without WebGL.
- **1–6:** select a runner; **C:** cycle cameras; **M:** toggle audio; **F:** immersive view. **Esc** closes dialogs or immersive view. The expansion control falls back to an in-page immersive view if browser fullscreen is blocked.
- Audio is opt-in and generated locally: coin clinks, relay clicks, motor hum, light hoofbeats, and start/finish cues. No stadium crowd sound.

The clock pauses in help, ticket and history windows and when the page is hidden. Current credits, pending tickets, the current race, and up to 40 completed races are checkpointed in local storage. Storage is optional, so the game still runs in a restricted viewer. It is a single-player simulation, not a streamed casino or an official SEGA product.

## Visual research

The six-runner field, separate satellite terminals and shared display are informed by the Royal Ascot Special catalogue and cabinet flyer. [1](https://www.highwaygames.com/arcade-machines/royal-ascot-special-8035/)

The brushed-metal sloped consoles, blue odds monitor and low side sightline were studied in photographs of the Brussels installation. [3](https://www.onetime.nl/landbased-casino/buitenland/europa/belgie/golden-palace-bourse/) Details of the painted mechanical figure and its spindle were also studied in the [Royal Ascot-family spare-part photograph](https://www.highway.net.au/screenshots/arcade-parts/sega-parts/sega-royal-ascot-2-dx-horse-only/61605-16834-1.html).

The scene and cast master are original photographic-style reconstructions, not a real casino stream or a claim of exact factory reproduction. Reference photos are not included as game textures. The original simulator supplied the silk identifiers, horse-name pool, market mathematics and four-lap format.

## Implementation

- `js/engine.js`: race lifecycle, independent weighted race draws, pace curves, persistence, stake validation, refunds, finish settlement, and lap splits.
- `js/bet-math.js`: odds and gross settlement functions from the supplied game.
- `js/scene.js`: continuously registered race paths, runner depth ordering, atlas projection, photographic cameras, and live map.
- `js/station-screen.js`: live odds/credit CRTs, inverse-projection texture cache and physical control hit testing.
- `js/orbit.js`, `js/mould.js`, `js/horse-rig.js`: optional 3D cabinet and textured carrier geometry. The same game state drives both renderers. WebGL is initialized only upon selecting the orbit camera.
- `js/art.js`, `styles.css`, `js/app.js`: original racing silks, responsive station controls, keyboard access, results, and history.
- `js/audio.js`: local Web Audio cabinet sound design.
- `tools/build_offline.py`: packs the source into one offline HTML file using only the Python standard library.

## Verification

`npm test` runs the engine tests. They cover the three settlement rules, gross returns, insufficient funds, refunds, bet limits, automatic phase changes, saved tickets, monotonically increasing race progress, and lap/finish agreement. A full browser race and desktop/mobile interaction checks were also run on the delivered build.

See `CREDITS.md` and `licenses/` for third-party notices.

## Art masters

`art-src/` contains the original generated artwork. The finished compressed textures, calibrated masks and turntable atlases are already built in `assets/`. Optional authoring scripts in `tools/` derive the six painted skins, relief mesh, portraits, rail masks and sprite atlases. Python art preparation requires Pillow, NumPy, SciPy and OpenCV; turntable rendering requires Playwright/Chromium with WebGL. **None of those authoring dependencies are needed to play or host the game.**
