# Credits and reference material

- **Original simulator and betting mathematics:** [Royal Ascot Special — The Hippodrome](https://hippo-8lw.pages.dev/), supplied as the rebuild reference. Its `HippoBetMath` functions are retained in `js/bet-math.js`. No ownership of the original simulator or SEGA marks is claimed.
- **Updated figure art and geometry:** original generated photographic-style study of a painted mechanical racehorse; six pigment variants, correctly numbered saddlecloths, a two-sided sculpt and mechanical gait. The older photographic negatives retain their support spindle and low sled; the Turf casting uses neither. The new photographic and orbit renderers use the same cast figurine design. No third-party horse mesh is used in this edition. [Visual reference: Royal Ascot-family carrier](https://www.highway.net.au/screenshots/arcade-parts/sega-parts/sega-royal-ascot-2-dx-horse-only/61605-16834-1.html).
- **Three.js r152.2:** the MIT-licensed renderer distributed with the reference simulator. License in `licenses/three-MIT.txt`.
- **Cormorant Garamond, DM Sans, IBM Plex Mono:** locally subsetted fonts from Google Fonts. The SIL Open Font License notices are included in `licenses/`.
- **Original assets:** AI-generated long-side cabinet plate, figurine master, casino panorama and matching wide seat surround (`art-src/seat-surround.jpg`); five preprojected stationary seat textures; a survey-guided width adjustment shared by the photograph and its calibrated rail masks, a rectified nine-slice CRT rim and close-up surround derived from that same cabinet plate, and independently drawn working CRTs; original interface, emblems, silks, chips, dashboard, cabinet model, terminal displays, and synthesized sounds.
- **Visual references:** Highway Games' Royal Ascot Special catalogue and brochures, and Onetime’s photographs of Golden Palace Bourse in Brussels. See the source links in `README.md` or the in-game **Cabinet notes**.

This is an independent play-medal simulation, not affiliated with or endorsed by the manufacturers, casino, or reference publications.

The six larger profile portraits and race cards are studio renders of the same locally authored, articulated and numbered miniature used on the course. No real-horse statistics or third-party photographs are used for the runner profiles.

### Start signal and stall references

- **Physical machine:** [Nagashima Onsen cabinet footage, あべのばし](https://www.youtube.com/watch?v=IDulVSKqP3A) identifies the original 1991 SEGA Royal Ascot; [1991-board race footage](https://www.nicovideo.jp/watch/sm2072812) is another historical reference. Neither video is included. No authenticated, cleared master of the original start cue was located.
- **Earlier web imitation:** the [supplied Hippodrome](https://hippo-8lw.pages.dev/) plays a separate countdown fanfare and a three-note bell at the break: **784, 988, 587 Hz**, starting at **0, 110, 270 ms**. Its credited metal sample is [Sonilo’s generated garage-door effect](https://sonilo.com/royalty-free-sound-effects/doors/fast-metal-garage-door-opening), not evidence of the cabinet sound. This historical comparison is not an attribution of the two player-supplied files.
- **This build:** the two recordings supplied for this project are now the defaults: `countdown-fanfare.m4a` (original AAC; alternate 16-bit FLAC for browsers without AAC) and the original `start-gate-metal-door.mp3`. They live in the game, not behind a Drive link. Neither is represented as authenticated SEGA cabinet audio. The former synthesized call and metal/bell design remain as a codec fallback. A player may independently replace either cue with a local recording for that session; Reset restores the supplied recording.
- **Gate geometry:** [Royal Ascot starting-gate parts listing](https://www.highwaygames.com/arcade-machines/sega-royal-ascot-4824/) and [Royal Ascot **II DX** left gate door, WYT-2064](https://www.highway.net.au/arcade-parts/other/sega-royal-ascot-2-dx-gate-door-left-wyt-2064/16843-2.html). The latter shows a red slatted half-door. The six-stall hinged rig and its retraction are a reconstruction, not authenticated 1991 engineering drawings. No parts photographs are shipped.

**Historical head-on feed (not used by Long Course):** the original AI-generated start-lane master, guide and head-on carrier in `art-src/` are authoring references from an earlier edition. The current runtime does not load that feed, its front-facing atlas or a square-on camera director.

**Cabinet and gallery:** `art-src/side-station-master.jpg` and `seat-surround.jpg` are original AI-generated empty-room scenes, not live footage. They supplied the earlier floor, seat and console plates and the v6 judges’ gallery. The new composite keeps the registered cabinet and live screen openings. The original generated `art-src/tangent-camera.jpg` and historical negatives remain as dated film stock. The live 3D floor retains the sixteen terminals and their unoccupied stools. Six new neutral standing turntables were rendered from the project’s own numbered cast. The CSS/layout review uses 20 simulated expert perspectives, not twenty named people or award claims.

### Casino gallery · photographic references

The **v7** unoccupied casino gallery is generated artwork. Three real photographs informed its composition, lighting and machine details:

- [Slot machines in a casino](https://unsplash.com/photos/slot-machines-in-a-casino-vBWsG91aR_U) — Kvnga, Las Vegas (2020). [Unsplash License](https://unsplash.com/license). Reference for slot banks, stools and carpet.
- [Wynn Las Vegas casino floor (2018)](https://commons.wikimedia.org/wiki/File:Wynn_Las_Vegas_casino_floor_(2018).jpg) — Andrew Milligan sumo, [original on Flickr](https://www.flickr.com/photos/andrewmilligansumo/41093330765/), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Reference for the ceiling, light and depth of the aisle.
- [Arcade Coin Pusher, detail](https://commons.wikimedia.org/wiki/File:Arcade_Coin_Pusher,_detail.jpg) — Andrew Dunn (2005), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Reference for stepped coin shelves, glass and metal housings.

No source photograph is embedded or streamed. The generated interior is projected into a panorama; the registered floor and seat plates and the upper v7 finish strip are composites. The casino-room background artwork is shared under [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/); no change of licence is claimed for the original cabinet marks, third-party components or archive. The room is not a photograph of the Wynn, the fair or an actual Royal Ascot installation.

**Lamplit lounge (v9):** Original AI-generated architectural room art: oxblood and bottle-green sofas, shaded cocktail lamps, small tables and a walnut bar. The background, carpet, seat faces and separate v9 wire strip are optically registered to the cabinet. The 3D furnishings, moving lenses and working brass infield tote are original game geometry and typography. Saved v8 and earlier photos still use their own unmodified plates.

**Black & Brass Salon (v8):** Original generated private-salon scenery, not a photograph of a venue. The black lacquer, brass-framed panels, lighting and carpet are projected behind the existing registered cabinet. The empty home-straight view was rendered from the game’s own 3D cabinet with the finish camera on the surveyed timing plane. Horses, saddlecloths and the foreground rail are composited against that plate at runtime. The perpendicular photo sensor retains its own lens. Neither v7’s casino stock nor any older archived negative is replaced.

**Finish camera atelier:** the empty judges’ straight in `art-src/judges-rail-master.jpg` is original AI-generated photographic-style scenery, registered to the project’s lens guide. Its gravel surface is retained for old finish negatives only. The figures, contact shadows, sensor and finish timing are composited from the game; the archived frame reconstructs an actual simulated crossing. The 20 disciplines in `docs/atelier.md` are virtual design responsibilities, not biographical credits or claims of awards.

**Turf edition:** `art-src/turf-study.jpg` is an original AI-generated overhead grass material study. The offline authoring pipeline tiles the fibre texture, projects it into the running lanes at model scale and preserves the rail occluders. New views use the grass tracks and rebuilt horse-only meshes/turntables; the two older finish formats remain deliberately unaltered. The @architect bench is a measured local scheduling fixture, not a live model or platform benchmark.

**Broad Turf:** the 85.2 cm model bed, turning mower cuts, scuffed fibres, enamel markers, two-rail fence films, printed bay numbers and updated cabinet rendering are authored for this edition. Older race negatives retain their original lenses, rail stock, figures and stride. No contemporary racing footage or real casino player data is included.

### Recorded hoofbeats · six trackside voices

All six originals are field recordings from race meetings, released by the recordists on Freesound under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The numbered assignment is a game mix, not a claim that these are recordings of the fictional named horses. Each shipped `rail-hoof-N.mp3` is a trimmed, filtered, level-matched mono loop with a crossfaded seam. `tools/prepare_hoofbeats.py` gives the exact cut points and processing. No sound is streamed during play.

| Saddlecloth | Source recording | Recordist | Trackside location |
|---|---|---|---|
| 1 | [Horse Galopp Race Pferderennen 01 .mp3](https://freesound.org/people/taddeo67/sounds/392235/) | taddeo67 | Krefeld, Germany |
| 2 | [Horse Galopp Race Pferderennen 02 .mp3](https://freesound.org/people/taddeo67/sounds/392237/) | taddeo67 | Krefeld, Germany |
| 3 | [Horse Galopp horse-racing Pferderennen 03 .mp3](https://freesound.org/people/taddeo67/sounds/392236/) | taddeo67 | Krefeld, Germany |
| 4 | [Pfrederennen Horses Race.mp3](https://freesound.org/people/taddeo67/sounds/392234/) | taddeo67 | Krefeld, Germany |
| 5 | [HorseRace.wav](https://freesound.org/people/tonant/sounds/204950/) | tonant | Beaudesert, Australia |
| 6 | [Horse Race](https://freesound.org/people/AugustSandberg/sounds/508504/) | AugustSandberg | Breistein, Norway |

### Race radio

Fifteen paddock preview phrases, 136 original English race calls (including 36 wry calls from the same booth) and the named roster were synthesized for this game in a user-selected British English voice. Broadcasts, announcers’ recordings and transcribed calls are **not** in the sound bank. Field reports and an interview informed the cues; see the research notes in `docs/commentary.md` in the source edition.

Single-file decompression and lossless unpacking of the original cast geometry use the `inflateSync` subset of fflate 0.8.2, MIT © 2023 Arjun Barrett; see `licenses/fflate.txt`.

## Start-stall reference study · Stewards’ edition

The model is an original six-stall cabinet design. These sources guided the *appearance and movement*, not the real Ascot supplier, exact dimensions, branding, or an engineering specification:

- The National Horseracing Museum distinguishes individual front and rear gates in the British stall system. The model has an entry and a release end for every horse. [1](https://www.nhrm.co.uk/flags-tapes-and-starting-stalls/)
- United Puett describes square tubular steel, vinyl-covered padding and V-shaped, latched front leaves. These informed the squared overhead structure, green rolled cushions and shallow V seam. [1](https://www.unitedpuett.com/horse-gates)
- Jennifer Kelly’s *The Science of Racing: The Starting Gate* describes lower padded rear doors, taller fronts with open upper grating, a wheeled support frame and a simultaneous release. The model keeps a clear view through the upper grille and closes the rear leaves at the end of loading. [2](https://www.twinspires.com/edge/racing/the-science-of-racing-the-starting-gate/)

No reference photograph, sponsor mark or manufacturer logo is included. The simplified cabinet retraction, materials palette and enamel START telltale belong to the game. The source geometry is shared by the photographic and WebGL views; the map uses the same rotating leaf tips. The historical square-on authoring lens remains optional, not a forced camera change.

### Parterre · infield and motion

The four ribbon beds are original procedural planting, surveyed in model metres. One plan places 392 flower heads in the side view, map, finish plate and cabinet geometry. The two-sided tote remains live; no predicted result is painted into the room. The new hock, fetlock and hoof arcs are an animation of the existing miniature, not a motion-capture or veterinary reconstruction. The moving photographic passes, silk alignment and obstruction mattes were developed from the rig; earlier sensor prints use the archived film stock.

**Continuous coverage:** the former home-straight takeover plate is retired. The finish negatives and their photographic stock are unchanged. `room-light.webp` is not a new room image: it is a lossless, mip-level arrangement of the salon panorama's broad, prefiltered GGX lighting samples, developed with Three.js r152 by `tools/bake_room_light.cjs`.

### Diagonal trot · motion study

The new race animation is original articulation of the same cabinet cast, not motion capture. Timing reference: Laffi et al., *Rhythmic categories in horse gait kinematics* (2025), https://doi.org/10.1111/joa.14200. Contact and suspension: Clayton & Hobbs, *A Review of Biomechanical Gait Classification* (2019), https://doi.org/10.3390/ani9100763. Profile reference: Eadweard Muybridge, *Abe Edgington, trotting*, Library of Congress, https://loc.gov/pictures/item/91483062/. None of the external plates or papers are embedded, and no network access is needed to play.

### Private drawing room · v13
The private room photograph (generated for this edition) is original game art, not a photograph of an actual casino. Its black panelwork, gilt mouldings, equine print, settees and lamplit tables supply the reflection panorama, five seat faces and the new sensor strip. The enclosed room, upholstery, numbered satellite consoles and clock-driven podium are game geometry and lettering. Neither the new room nor the revised movement is applied to archived exposures.

For the new articulation we used Hilary M. Clayton, *Mechanics of Equine Locomotion* [1](https://www.quia.com/files/quia/users/medicinehawk/3307-Biomechanics/MECHANICS-OF-EQUINE-LOCOMOTION.pdf), specifically loaded midstance, heel-off about the toe and the returning limb. Compare Eadweard Muybridge, *Abe Edgington, trotting* (1878), Library of Congress [2](https://loc.gov/pictures/item/91483062/). These are motion references, not textures or game footage. The simplified model is not veterinary motion capture.

### Hind limb · v14

The high stifle and lower, rear-pointing hock were rearticulated on the existing cast, with a separate four-beat approach and two-beat race. Anatomical reference: Hilary M. Clayton, [*The Hock Examined*](https://www.equinemassageassociation.co.uk/wp-content/uploads/2015/09/The-hock-examined.pdf), especially the side view of flexion and extension in figure 4. The study traces follow landmark patches on the actual deformed model; no third-party diagram or footage is embedded.

### Harness Trot · v15
The unmounted coat was restored from the game's own original cast. The new racing bike, wheels, driver, harness and reins are original geometry. Equipment reference: United States Trotting Association, *Equipped for Racing*, https://fanguide.ustrotting.com/equipped-for-racing.cfm. Trot versus pace and the two-wheeled racing sulky: Caroline Cochran, *Harness Racing*, Mad Barn, https://madbarn.com/harness-racing-horses/. No outside photo, rulebook diagram or racing film is shipped. See `docs/diagonal-trot.md` for the forward high stifle, rear-facing hock and photographic checks.

### Racing bike, stirrups & driver · v16
Original meshes, graded studio prints and enamel board; no supplier or race photograph is distributed as game art. Proportion and construction references are documented in [the racing-bike notes](docs/racing-bike.md): Harness Racing Australia’s *Sulky & Sulky Wheel Standard*, COMAR 09.10.02.36 and Finntack’s R6 QH race frame. Width and lane dimensions in the game are for the cabinet, not full-size equipment specifications.

### Two clear shoulders and the turning field · v17

See [Panorama: construction, sources and measurements](docs/panorama.md). USTA track planning, Standardbred Canada harness drawings and Clayton & Van Weeren’s description of the diagonal trot informed the new geometry, straps and motion. New rig, silhouette plates, lane markings, rails and photographic registration authored for the game. No third-party racing photograph, video or model was imported. V16 exposures are preserved separately.
