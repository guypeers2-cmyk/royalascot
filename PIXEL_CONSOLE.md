# The betting glass: one pixel face, and a compact rack

Scope: `#roundConsole` — the station's betting glass (status strip, medal
stakes, the six-runner field, the ticket preview, the four keys). Desktop,
tablet and phone all take the pixel face; the *compact rack* is the phone and
narrow-cabinet layout (≤ 760 px).

## 1. The face

Two OFL 1.1 faces from Google Fonts are now shipped inside the build — no CDN,
no network at run time:

| file | face | role |
|---|---|---|
| `assets/pixel/VT323.woff2` (18 KB) | **VT323** | every word and number on the glass |
| `assets/pixel/Silkscreen-Regular.woff2`, `-Bold` | **Silkscreen** | the small uppercase registers (race tag, `6 SULKY TEAMS`, `STATION TICKETS`, casting line) |

VT323 is drawn on a 16 px grid with a tall x-height and a narrow advance. That
combination is what makes the compaction possible: it stays legible at 11–15 px
where the humanist sans needed 13–17 px, and it is roughly 15 % narrower, so a
full runner line fits where the old card needed three lines.

Switch the whole glass to Silkscreen, if you prefer the blockier register, with
one line in `assets/pixel-console.css`:

```css
--pixel: var(--pixel-caps);   /* was: var(--pixel-terminal) */
```

Both faces carry no bold weight in this build, so `font-synthesis-weight: none`
is set inside the glass and hierarchy comes from size and ink instead of a
smeared synthetic bold.

## 2. The rack

Measured at 390 × 844, rendered pixels:

| block | before | after | how |
|---|---|---|---|
| status strip | 45 | **27** | race tag, title, credit, staked and clock on one line |
| medal stakes | 51 | **39** | caption inline, six keys at 30 px |
| field mast | 50 | **43** | `Field`, the chance key and the three markets on one row |
| one runner | 76 | **32** | one line per runner instead of a three-row card |
| six runners | ≈470 | **202** | — |
| hint line | 36 | **25** | one short line, hint text dropped when tight |
| ticket preview | 46 | **49** | kept whole: market, runner, stake, odds, return |
| four keys | 52 | **51** | 38 px keys, one line each |
| smallest type | 8 px | **11 px** | nothing on the glass is smaller now |
| console depth | 819 px | **~390 px of content** | the rest is glass |

The runner line is: `silk · name · running style · win chance · the quote for
the selected market`. Two things move rather than disappear:

- **The unselected market quote is hidden** — the `Win / Show / Quinella` tabs
  already say which price is being quoted, so `Win 3.6× Show 4.8×` becomes
  `3.6×` with the market lit in the tab. Tap another market and the quote
  changes with it.
- **Gate ratings and L5 form** are not drawn on the phone. They remain in the
  horse file (press and hold / hover a runner) and on the desktop glass, which
  still uses the full table sheet at 70 px a row. Below 460 px the running-style
  words go too, so the name keeps its full width.

Everything else is untouched: the same six rows, the same focus order, the same
`data-tube-*` hooks, so the betting flow, the keyboard shortcuts and the shared
table are unchanged.

## 3. What did not change, and what to watch

- Hit areas: the four keys are 38 px tall, the six stake keys 30 px, the market
  tabs 26 px. That is a deliberate trade for the rack — a 44 px key cannot fit
  four abreast at 320 px. If you want them back at 44 px, raise
  `min-height` in the same block; the console will scroll instead of fitting.
- The glass still fills the cabinet height on a phone, so a compact rack leaves
  open glass below the six runners. That space is the console's own background,
  not a layout bug.
- Contrast was re-measured with the new face: on every flat ground it is
  **5.9 : 1 or better** (the lowest reading is the white numeral inside a
  coloured saddlecloth), so the glass passes AA throughout. The buttons sit on
  gradients that a flat sampler cannot composite; those were checked by eye
  against the rendered shots.

## 4. Verifying

```bash
tools/dev/run-console-audit.sh after 390      # measures the glass on a fresh table
tools/dev/run-console-audit.sh after 517
tools/dev/run-console-audit.sh after 320
tools/dev/run-console-audit.sh blocks 390 console-blocks   # before/after heights
```

The audit prints the console box, every text node's rendered size and contrast,
the hit areas and any overflow; it starts a throw-away table so the glass is
always open in a betting phase. Screenshots land in `/home/user/shots/`
(`console-<tag>-<width>.png`).
