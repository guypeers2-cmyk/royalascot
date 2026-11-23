# @architect · The Finish Camera Atelier

**Brief:** let the player see a horse save stamina, rally and take the line. Keep the jewel-like scale of the cabinet: these are painted mechanical miniatures, not life-size racehorses. The primary surface is the ordinary Rail feed on a phone. A graphics change that works only in WebGL is not a solution.

This is a **virtual production team of 20 expert roles**. The assignments below identify design responsibilities and their concrete work in this build, not twenty external hires or claims of personal awards.

| # | Seat at the atelier | Decision / shipped work |
|---:|---|---|
| 01 | Art director | One cabinet language: ivory rails, bottle-green enamel, warm brass, grey-brown ballast. Retain the recognisable Station 07 and trade a wide scenic shot for an intimate finish. |
| 02 | Equine sculptor | Preserve the approved master’s profile and give the barrel, withers and neck more curvature. |
| 03 | Hard-surface modeller | A bevelled, tiered carriage with a brass trim ring, green enamel cap, four bolt heads and a bearing collar. |
| 04 | Silks & pigment artist | Keep six genuinely numbered painted skins; light/dark separation survives the move to a reflective resin material. |
| 05 | Surfacing TD | Clearcoat over the pigment, roughness contrast on the metalwork, softly varying brushed-metal finish on the cabinet. |
| 06 | Equine rigger | Place the left/right depth boundary in the *air* between knees and fetlocks; remove the old plinth pixels at the soles. |
| 07 | Locomotion animator | Separate reach, fold, suspension and toe travel. Phase depends on carriage distance rather than a second independent clock. |
| 08 | Character animator | Counter-motion in the rider’s crouch and a smaller head/neck pitching beat instead of swinging a rigid cut-out. |
| 09 | Secondary-motion artist | Subtle two-axis tail lag and a little shoulder roll; the moving piston follows the body while the base stays planted. |
| 10 | Lighting TD | Warm key, cooler fill, perimeter light and three studio reflection panels. Rotate the limb normals with the limbs so the highlights move. |
| 11 | Environment artist | Register a new photographic-style miniature straight to the actual rail foot, with flocked plants and the opposite satellite stations. |
| 12 | Ground-material artist | Sample the judges’ plate to make the orbit’s repeating cinder texture; fibre relief, two cypress-and-flower beds and layered leaf tips on the infield, rather than flat solid colour. |
| 13 | Camera/optics designer | Side-on finish lens with a single ground-plane projection for every lane. The vertical sensor stays fixed while runners approach left to right. |
| 14 | Broadcast director | Cut to the judges at the post, stay out of manually controlled seat/map/orbit views, give a deliberate rail pan precedence. |
| 15 | Compositor | Two HD flank passes; depth-sort the larger figures, contact shadows on the same ground plane, no stretching to fill a portrait viewport. |
| 16 | Timing & motion graphics | A small lap/duel clock from *observed* positions; recent trails and a leader halo on the plan. No tips or future placings in the overlay. |
| 17 | Photofinish artist | Expose the six carriages at the first crossing. Replay the precise stride/lane values against the same line in **Photo & result**. The carriage, not the painted nose, triggers the sensor. |
| 18 | Catalogue photographer | Re-render all six profiles and small card pictures from the illuminated articulated rig, including its mechanical mounting. |
| 19 | Real-time & mobile TD | Bake six 28-heading × 12-pose turntables for ordinary Canvas. Store the common edge matte once; size the decoded sheets for the device. The offline file needs neither a GPU nor the authoring tools. |
| 20 | Continuity / accessibility supervisor | Compare captures at the same race event. Check reduced motion, phone controls, fixed-seat picking and old saves. A receipt from before finish positions were stored does not acquire a fictional photo. |

## Direction and balance

The race has no rule that accelerates the trailing horse because it is trailing. Narrower neutral-time gaps keep the six in contention. Sustained fast cruising has a convex fuel premium; fitness mitigates it. A horse that saved reserve can use its actual fourth-lap drive. If it is exhausted it may run out during the drive, or never launch it. The odds book, ticket lock, four-lap length, opening meet and independent pre-draw forecast remain in place.

### Paired trials

The comparison uses `tools/pace_audit.cjs` on the old and new production samplers: the same 6,000 opening fields, commercial weights, initial phases and twelve random draw values per heat; seed **42017**. A spread is the real time between first and last crossing **the same point**, not a distance judgement made from the camera.

| Measurement | 73c5640 | Atelier |
|---|---:|---:|
| Median field spread · lap 1 | 5.833 s | 1.886 s |
| Median field spread · lap 2 | 9.233 s | 3.217 s |
| Median field spread · bell | 11.190 s | 4.018 s |
| Median field spread · finish | 9.499 s | 2.775 s |
| Median winner’s margin | 1.816 s | 0.526 s |
| Wins by half a second or less | 869 / 6,000 | 2,873 / 6,000 |
| Average runners crossing within two seconds of the bell | 1.694 | 2.954 |
| Leader changes between sampled lap-four sectors | 3,475 | 4,676 |
| Bell leader held on to win | 2,982 / 6,000 | 2,174 / 6,000 |
| Nightwatch wins from 4th–6th **when the bell sounds** | 837 | 877 |
| Waregem Flyer wins from 4th–6th **when the bell sounds** | 594 | 745 |
| Susy Spitfire (pace setter), mean reserve at its third crossing | 27.0% | 12.8% |

The simultaneous running order at the bell and the sequence in which each carriage subsequently crosses that marker are distinct. `npm run balance` uses the **marker** definition: 875 Nightwatch and 753 Waregem Flyer last-lap wins from the back three. Its separate 12,000 equal-form style trials give overall win shares of **15.3 / 18.0 / 17.5 / 18.4 / 14.8 / 15.9%** (front runner, strong finisher, pace setter, late closer, all-rounder, steady pacer). These frequencies describe these tests; they are not promises about a player’s next race.

### Reproduce

```sh
npm test
npm run balance
npm run pace
mkdir -p /tmp/ascot-previous
git archive 73c5640 js | tar -x -C /tmp/ascot-previous
node tools/pace_audit.cjs /tmp/ascot-previous/js
```

The camera check `node tests/atelier.browser.cjs` uses **seed 126**. Waregem Flyer is fifth when the leader rings the bell and wins in 135.364518 s, 0.167158 s clear of Silver Birch. This is one illustrative drawn heat. Supply `ASCOT_QA_SHOTS` for real play-surface captures, `ASCOT_OLD_SITE` for the previous static folder, `phone` for the reduced-motion phone check, and/or `ASCOT_OFFLINE` for the network-blocked edition.
