# Mobile live panel — 25 % larger, and what the type audit found

Scope: the rail sheet (`#livePanel`: *My bets* + *Race monitor*) on a phone, in
`html[data-device="mobile"]` at ≤ 640 px. Desktop and tablet are untouched —
verified at 1440 px (`zoom .88`, two halves side by side) and 834 px
(`data-device="tablet"`, no rule from this change applies).

## 1. What changed

| | before | after |
|---|---|---|
| sheet scale | `zoom: .88` | `zoom: 1.10` — exactly 25 % bigger than `.88` |
| runner row | one line, 7 columns | two lines: rank · silk · name · FIT · STA, then style · drive |
| column names | separate legend line at 9 px | gone; each reading carries its own label (`FIT 89`, `STA 89%`) |
| fold headers | 26 px tall | 48 px (44 px hit box + zoom) |
| ticket saddlecloths | 30 px buttons | 44 px buttons |
| smallest text on the sheet | **8.2 px** | **12.0 px** (the `FIT`/`STA` labels); everything else ≥ 13 px |

The scale is applied at one place (`assets/trackside.css`, the *MOBILE RAIL*
block) so the sheet can be tuned without hunting through five stylesheets.
Because `.track-fold` and `#railDock` also receive `min-height: 30px` from
`#cabinet #livePanel :is(.track-fold,#railDock)`, the mobile rules win on
specificity via the same `:is()` selector rather than `!important`.

## 2. Measured, in rendered pixels (390 × 844 handset, DPR 2)

| element | before | after | Δ |
|---|---|---|---|
| panel box | 378 × 273 | 378 × 453 | +66 % area, full width both times |
| section title, Cormorant | 15.7 | 19.7 | +25 % |
| runner name, DM Sans 600 | 13.6 | 16.9 | +24 % |
| running style | 11.8 | 15.1 | +28 % |
| FIT reading | 10.6 | 14.8 | +40 % |
| STA reading | 10.9 | 14.8 | +36 % |
| drive lozenge (*Saving*) | 11.0 | 13.0 | +18 % |
| rank (*1st*) | 9.4 | 13.0 | +38 % |
| `0 slips` / `L1/4` | 9.8 / 9.4 | 13.4 | +37 % |
| empty state | 10.0 | 14.1 | +41 % |
| column legend | 9.3 | removed | labels moved onto the values |
| distinct sizes under 12 px | 9 (8.2 – 11.8) | **0** | — |
| horizontal overflow | none | none (`scrollWidth == clientWidth`) | — |

Contrast was measured too, compositing translucent backgrounds: every value on
the sheet lands between **5.9 : 1 and 14 : 1**, so all body text passes WCAG AA
(4.5 : 1) and most of it passes AAA. The lowest readings are the white numerals
inside the coloured saddlecloths (`#paper` cloths, 5.9 – 7.1 : 1) — decorative
badges whose meaning is repeated by the runner name, so they are left alone.

## 3. The font audit

Three faces, each doing a job it is not entirely suited to at phone sizes:

**Cormorant (serif) — section titles.** A high-contrast display face (hairline
strokes, x-height ≈ 0.44 em). At 15.7 px rendered the hairlines fall below one
physical pixel on a 1× screen and the counters fill in; it read as a smudge.
Kept, but only above 17 px and at weight 650, which is what the 1.10 scale
delivers (19.7 px). Below 17 px the sheet must use DM Sans instead — the
`My bets` / `Race monitor` titles are now the only serif on the sheet.

**DM Sans (sans) — names and styles.** Correct choice: large x-height, open
apertures, holds up at 14–17 px. It was simply being asked to set at 10.4 px
(styles) where its stem contrast collapses. Nothing to swap, only to scale.

**IBM Plex Mono — numbers, ranks, micro-labels.** Right for the numbers: the
tabular figures keep the FIT / STA columns from shivering as they update. Wrong
for the uppercase micro-labels: monospace capitals at 8–9 px (`RANK · RUNNER`,
`FIT · STA · SPRINT`) have no weight or width variation to separate letters,
which is most of why the old legend line was unreadable. The legend is gone and
the two labels that remain are set at 12 px with looser tracking.

Rules now enforced on the phone sheet: no text below 12 px, serif never below
17 px, all-numeric columns set in Plex Mono with `font-variant-numeric:
tabular-nums`, line-height ≥ 1.15 wherever a value can wrap, 44 px minimum for
anything you tap.

## 3b. Pinned to 40 % of the handset height

The sheet no longer grows freely: on a portrait phone it is capped at **two
fifths of the viewport** and scrolls inside itself.

```css
html[data-device=mobile] #cabinet.docked-rail #railBay #livePanel{max-height:calc((40dvh - 2px)/var(--rail-zoom,1.1))}
```

The division matters — the sheet's `max-height` lives inside its own `zoom:
1.10`, so an undivided `40dvh` renders as 44 % of the screen. Measured after the
fix:

| handset | sheet | of screen | race image |
|---|---|---|---|
| 320 × 568 | 225 px | 39.6 % | 292 px |
| 360 × 780 | 310 px | 39.7 % | 425 px |
| 390 × 844 | 336 px | 39.8 % | 463 px |
| 430 × 932 | 371 px | 39.8 % | 516 px |

Landscape is untouched — there the sheet docks to the side and takes width, so
`40dvh` would leave it 156 px tall; the rule is portrait-only. Inside the two
fifths, an empty ticket book also sheds its "no tickets on this race" line (the
header already carries `0 slips`), which buys the monitor one more runner.

## 4. The trade-off to sign off

The sheet is docked, so its extra 180 px comes out of the race image: the track
view shrinks from **390 × 516** to **390 × 338** on a 390 × 844 handset. The
map is still legible at that size, and any handset shorter than 700 px keeps the
sheet scrollable inside a 60 dvh bay instead of eating the picture. If you would
rather keep the picture larger, the alternative is a 400 px cap on the sheet
(it would scroll internally) — one line to change.

## 5. Verifying

```bash
PORT=8080 ASCOT_TABLE_CODE=ASCOT26 node serve.mjs
BASE=http://127.0.0.1:8080 node tools/dev/live-panel-mobile-audit.cjs after   # measurements
BASE=http://127.0.0.1:8080 node tools/dev/live-panel-shot.cjs after 390       # sheet shot
```

The audit prints the panel box, the rendered size of every text node, contrast,
tap targets and any overflow; run it with a fresh table (`ASCOT_DATA=/tmp/…`)
because a race has to be running for the sheet to appear.

Screenshots: `shots/live-panel-sheet-w390-390.png`, `…-w320-320.png`,
`live-panel-full-w390-390.png`, and the before state in
`shots/live-panel-mobile-before.png`.
