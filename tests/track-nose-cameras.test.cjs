'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('index.html and styles.css define Camera 7 (Track overview), Camera 8 (Horse nose cam), #noseAim and track-only layout rules', () => {
  const html = read('index.html');
  assert.ok(html.includes('data-camera="7"'), 'camera menu has camera 7');
  assert.ok(html.includes('data-camera="8"'), 'camera menu has camera 8');
  assert.ok(html.includes('<option value="7">Track overview</option>'), 'deskCamera has option 7');
  assert.ok(html.includes('<option value="8">Horse nose cam</option>'), 'deskCamera has option 8');
  assert.ok(html.includes('id="noseAim"') && html.includes('id="noseHorse"'), 'nose selector exists');

  const css = read('styles.css');
  assert.ok(css.includes('.machine-layout.track-only-layout #terminal{display:none!important}'), 'hides terminal in track-only');
  assert.ok(css.includes('#cabinet.track-only-view #livePanel'), 'hides livePanel in track-only');
  assert.ok(css.includes('#cabinet.track-only-view #roundConsole'), 'hides roundConsole in track-only');
});

test('render-quality.js raises pixel and DPR budgets for sharper 3D, action and film output', () => {
  const { profiles } = require('../js/render-quality.js');
  assert.ok(profiles[0].orbit >= 1800000);
  assert.ok(profiles[0].dpr >= 2);
  assert.ok(profiles[0].chase >= 1250000);
  assert.ok(profiles[0].film >= 840000);
});

test('orbit.js supports overview and nose modes, 2048 shadow map, rim light, plinth, 6-lane tubes, and nose-mounted camera', () => {
  const src = read('js/orbit.js');
  assert.ok(src.includes('const rim=new T.DirectionalLight'), 'rim light present');
  assert.ok(src.includes('2048:1024'), '2048 shadow map on capable devices');
  assert.ok(src.includes('o.castShadow=n===0'), 'cast shadows active in high quality');
  assert.ok(src.includes('overviewPlinth'), 'track overview plinth created');
  assert.ok(src.includes('fixtureBucket'), 'cabinet fixtures isolated for overview mode');
  assert.ok(src.includes("viewMode==='overview'"), 'overview mode handled');
  assert.ok(src.includes("viewMode==='nose'"), 'nose mode handled');
  assert.ok(src.includes('.404*cs'), 'nose mount anchored at horse nose bridge');
  assert.ok(src.includes('arm=.54+1.04*h'), 'closer action cam duel boom');
});

test('scene.js, round-program.js, and app.js route cameras 7 and 8 cleanly and preserve 0-6 invariants', () => {
  const sceneSrc = read('js/scene.js');
  assert.ok(sceneSrc.includes("function orbitModeFor(v){return v===6?'chase':v===7?'overview':v===8?'nose':'orbit';}"));
  assert.ok(sceneSrc.includes("if(c===2||c===7){drawPlan(c===7);return;}"));
  assert.ok(sceneSrc.includes("function drawPlan(trackOnly=false)"));
  assert.ok(sceneSrc.includes("ctx.imageSmoothingQuality=['high','medium','low'][quality.level]"));

  const progSrc = read('js/round-program.js');
  assert.ok(progSrc.includes("trackOnly=camera===7"));
  assert.ok(progSrc.includes("cab.classList.toggle('track-only-view',trackOnly)"));
  assert.ok(progSrc.includes("cab.parentElement?.classList.toggle('track-only-layout',trackOnly)"));
  assert.ok(progSrc.includes("$('raceBug').hidden=true") && progSrc.includes("if(bug)bug.hidden=true"));

  const appSrc = read('js/app.js');
  assert.ok(appSrc.includes("'Track overview','Horse nose cam'"));
  assert.ok(appSrc.includes("/^[23678]$/"));
  assert.ok(appSrc.includes("function noseUI()"));
  assert.ok(appSrc.includes("activeCameras[(idx+1)%activeCameras.length]"));
  assert.ok(appSrc.includes("function startPhotoReplay()"));
  assert.ok(appSrc.includes("function stepNose(dir)"));
  assert.ok(appSrc.includes("function updatePip()"));
  assert.ok(appSrc.includes("winnerOrbit"));
});

test('all 5 camera/UX suggestions are wired across HTML, CSS, orbit.js, scene.js, round-program.js and app.js', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="nosePrev"') && html.includes('id="noseNext"') && html.includes('id="noseSpeedFx"'));
  assert.ok(html.includes('id="noseSpeedOverlay"') && html.includes('id="photoFinishBadge"'));
  assert.ok(html.includes('id="overviewPip"') && html.includes('id="overviewPipToggle"'));
  assert.ok(html.includes('data-finish="replay"') && html.includes('data-finish="winner3d"'));

  const css = read('styles.css');
  assert.ok(css.includes('.nose-speed-lines') && css.includes('.photo-finish-badge') && css.includes('.overview-pip'));

  const orbitSrc = read('js/orbit.js');
  assert.ok(orbitSrc.includes('isPhoto') && orbitSrc.includes('isWinner') && orbitSrc.includes('shakeAmp'));

  const progSrc = read('js/round-program.js');
  assert.ok(progSrc.includes('finishPhotoReplay') && progSrc.includes('winner3d'));
});

test('track overview is tilted lower, foldable players menu sits bottom-left, and static hosts stay safe', () => {
  const orbitSrc = read('js/orbit.js');
  assert.ok(orbitSrc.includes('overviewHome={yaw:0,elevation:.44'), 'track overview camera tilted lower');

  const html = read('index.html');
  assert.ok(html.includes('id="playersWrap"') && html.includes('id="playersButton"') && html.includes('id="playersMenu"'));
  assert.ok(html.indexOf('id="playersWrap"') < html.indexOf('class="feed-ident"'), 'playersWrap is placed top-left inside .feed-top');

  const css = read('styles.css');
  assert.ok(css.includes('.players-wrap') && css.includes('.players-menu'));
  assert.ok(css.includes('.players-menu{top:calc(100% + 7px);bottom:auto;left:0'), 'players menu drops down from top-left');
  assert.ok(css.includes('opacity:.75'), 'players menu keeps 75% opacity');
  assert.ok(css.includes('#cabinet:is(.console-stage,.finish-stage) #viewWindow .feed-bottom{top:auto;bottom:10px;left:12px'), 'camera view changer sits at bottom-left');
  assert.ok(css.includes('#raceBug{display:none!important}'), 'top-left trackside timer bug removed');

  const mpSrc = read('js/multiplayer-client.js');
  assert.ok(mpSrc.includes("includes('application/json')"), 'guards against SPA HTML fallback on /api/info');
  assert.ok(mpSrc.includes('name="pin"'), 'login gate supports personal PIN');
  assert.ok(mpSrc.includes('playersPinnedOpen') && mpSrc.includes('syncPlayersMenuOpen'), 'keeps active players menu open by default');
  assert.ok(mpSrc.includes('playerBetsTip') && mpSrc.includes('mouseover'), 'shows hovered player bets on mouseover');
  assert.ok(mpSrc.includes("command('ready')") && mpSrc.includes('syncReadyButtons'), 'uses Ready button instead of unilateral Start race');
  const receiptSrc = read('js/race-receipt.js');
  assert.ok(receiptSrc.includes('players-results') && receiptSrc.includes('playerResults'), 'renders other players results in result panel');

  const appSrc = read('js/app.js');
  assert.ok(appSrc.includes('window.AscotMultiplayer?AscotMultiplayer.attach'), 'guards against missing multiplayer script');
});

test('startup flow chooses Mobile / Tablet / Desktop, then Username / PIN login, and saves medals per player', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="deviceButton"') && html.includes('id="playerBadge"'));

  const css = read('styles.css');
  assert.ok(
    css.includes('html[data-device="mobile"]') &&
      css.includes('html[data-device="tablet"]') &&
      css.includes('html[data-device="desktop"]'),
    'defines dedicated Mobile / Tablet / Desktop layout modes'
  );

  const mpSrc = read('js/multiplayer-client.js');
  assert.ok(mpSrc.includes('data-device-pick="mobile"') && mpSrc.includes('data-device-pick="tablet"') && mpSrc.includes('data-device-pick="desktop"'));
  assert.ok(mpSrc.includes('name="name"') && mpSrc.includes('name="pin"'));
  assert.ok(mpSrc.includes('pattern="[0-9]{4}"') && mpSrc.includes('maxlength="4"') && mpSrc.includes('id="pinDots"'));
  assert.ok(mpSrc.includes('savedPlayerChips') && mpSrc.includes('if(gate&&!gate.hidden)return;'));
  assert.ok(mpSrc.includes('ascot-local-players-v1') && mpSrc.includes('saveLocalProfile'));
  assert.ok(mpSrc.includes("typeof game.hydrate==='function'"), 'safely falls back when game.hydrate is absent');
  assert.ok(mpSrc.includes('onlineNames.filter(x=>x&&x.online!==false)') && mpSrc.includes('/api/leave'), 'only shows active players');
  assert.ok(mpSrc.includes('gateServerMode') && mpSrc.includes('probeServer'), 'shows online/offline shared table status clearly');

  const engineSrc = read('js/engine.js');
  assert.ok(engineSrc.includes('function hydrate(') && engineSrc.includes('refill,hydrate,'), 'js/engine.js exports hydrate');

  const serveSrc = read('serve.mjs');
  assert.ok(serveSrc.includes('pin:data.pin'), 'serve.mjs forwards pin on /api/join');
  const apiJoinSrc = read('api/join.js');
  assert.ok(apiJoinSrc.includes('pin:data.pin'), 'api/join.js forwards pin on /api/join');
});

test('race monitor shows FIT left of STA and all cameras (0-8) have smooth damping, zoom, and fullscreen scaling', () => {
  const html = read('index.html');
  assert.ok(html.includes('<span>FIT · STA · Sprint</span>'), 'race monitor legend shows FIT left of STA');

  const trackJs = read('js/track-tickets.js');
  assert.ok(trackJs.includes('data-stat="fitness"') && trackJs.indexOf('data-stat="fitness"') < trackJs.indexOf('data-stat="energy"'), 'rail row puts fitness span left of STA em');

  const trackCss = read('assets/trackside.css');
  assert.ok(trackCss.includes('.rail-fit'), 'trackside.css styles .rail-fit');

  const seatSrc = read('js/seat-pov.js');
  assert.ok(seatSrc.includes('zoomSmooth') && seatSrc.includes('sF') && seatSrc.includes('sCx'), 'seat-pov smoothly damps focal length and zoom');

  const orbitSrc = read('js/orbit.js');
  assert.ok(orbitSrc.includes('autoDist') && orbitSrc.includes('sNoseYaw') && orbitSrc.includes('noseBlend') && orbitSrc.includes('winnerBlend'), 'orbit.js syncs autoDist and smoothly blends nose/chase/winner cameras');

  const sceneSrc = read('js/scene.js');
  assert.ok(sceneSrc.includes('zoom2dGoal') && sceneSrc.includes('sizeObserver') && sceneSrc.includes('reduce?45:0'), 'scene.js unlocks 60fps 2D rendering, observes orbit canvas, and supports 2D zoom');

  const appSrc = read('js/app.js');
  assert.ok(appSrc.includes('n!==3&&n!==7&&n!==8') && appSrc.includes('requestAnimationFrame(()=>scene.size())'), 'app.js enables zoom controls on Cam 8 and resizes after fullscreen transitions');

  const consoleCss = read('assets/console.css');
  assert.ok(consoleCss.includes('#cabinet.console-stage.station-full .sat-case'), 'console.css expands console case in fullscreen');
});

test('audio channel mix (mute horses / commentary / all), camera removals (0 & 5), console Ready removal, and 3D WebGL enhancements', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="soundMenu"') && html.includes('data-audio-toggle="horses"') && html.includes('data-audio-toggle="commentary"') && html.includes('data-audio-toggle="all"'), 'sound mix popover has mute horses/commentary/all');
  assert.ok(html.includes('id="soundMenuButton"') && html.includes('id="consoleSoundMenuButton"'), 'sound mix menu buttons present in header and feed-top');
  assert.ok(html.includes('id="deskMuteHorses"') && html.includes('id="deskMuteCommentary"'), 'fullscreen desk menu includes mute horses and commentary toggles');

  assert.ok(!html.includes('data-camera="0"') && !html.includes('data-camera="5"'), 'Long-side seat (0) and Satellite floor (5) removed from cameraMenu');
  assert.ok(!html.includes('value="0"') && !html.includes('value="5"'), 'Long-side seat (0) and Satellite floor (5) removed from deskCamera');
  assert.ok(!html.includes('id="seatLocator"'), 'seatLocator button removed from terminal');
  assert.ok(!html.includes('data-tube="start"'), 'console Ready/start button removed from sat-deck');
  assert.ok(html.includes('id="raceNow"') && html.includes('id="deskStartRace"'), 'raceNow and deskStartRace remain intact');

  const audioSrc = read('js/audio.js');
  assert.ok(audioSrc.includes('horsesBus') && audioSrc.includes('commentaryBus') && audioSrc.includes('fxBus'), 'audio.js separates horsesBus, commentaryBus and fxBus');
  assert.ok(audioSrc.includes('setMuteHorses') && audioSrc.includes('setMuteCommentary') && audioSrc.includes('getChannels'), 'audio.js exports channel mute API');
  assert.ok(audioSrc.includes('ascot-audio-channels-v1'), 'audio.js persists channel mute preferences');

  const folioSrc = read('js/station-folios.js');
  assert.ok(folioSrc.includes('audioMixCard') && folioSrc.includes('data-folio-audio='), 'station-folios Sound tab renders interactive Audio mix card');

  const appSrc = read('js/app.js');
  assert.ok(appSrc.includes('activeCameras=[2,3,6,7,8]') && appSrc.includes('if(n===0||n===1||n===4||n===5)n=3;'), 'app.js restricts activeCameras to [2,3,6,7,8] and guards 0/1/4/5');
  assert.ok(appSrc.includes('toggleAudioChannel') && appSrc.includes("addEventListener('ascot:audio-mix'"), 'app.js wires channel mute UI and syncs folio events');

  const sceneSrc = read('js/scene.js');
  assert.ok(sceneSrc.includes('if(v===0||v===1||v===4||v===5)v=3;'), 'scene.js guards lens(0/1/4/5) back to 3');

  const deskSrc = read('js/fullscreen-desk.js');
  assert.ok(deskSrc.includes('lastLook=3') && deskSrc.includes('if(n===0||n===1||n===4||n===5)n=3;'), 'fullscreen-desk defaults lastLook to 3 and guards 0/1/4/5');

  const orbitSrc = read('js/orbit.js');
  assert.ok(orbitSrc.includes('scene.add(sun.target)') && orbitSrc.includes('function updateShadowFrustum'), 'orbit.js dynamically aims and tightens directional shadow frustum');
  assert.ok(orbitSrc.includes('Math.min(16,r.capabilities.getMaxAnisotropy())') && orbitSrc.includes('chart.generateMipmaps=true'), 'orbit.js enables 16x anisotropy and explicit mipmaps');
  assert.ok(orbitSrc.includes('overviewBrass') && orbitSrc.includes('envMapIntensity'), 'orbit.js adds overviewBrass bezel and material envMapIntensity');

  const rigSrc = read('js/horse-rig.js');
  assert.ok(rigSrc.includes('sheen:.35') && rigSrc.includes('sheenColor') && rigSrc.includes('clearcoat:.26'), 'horse-rig.js upgrades equine coat with physical sheen and clearcoat');

  const sulkySrc = read('js/sulky.js');
  assert.ok(sulkySrc.includes('MeshPhysicalMaterial') && sulkySrc.includes('clearcoat:.85'), 'sulky.js upgrades wheel covers to MeshPhysicalMaterial clearcoat');
});

test('mobile ergonomics (folded menus, smaller buttons, readability) and removal of Rail panorama (1) & Console close-up (4)', () => {
  const html = read('index.html');
  assert.ok(!html.includes('data-camera="1"') && !html.includes('data-camera="4"'), 'Rail panorama (1) and Console close-up (4) removed from cameraMenu');
  assert.ok(!html.includes('value="1"') && !html.includes('value="4"'), 'Rail panorama (1) and Console close-up (4) removed from deskCamera');

  const css = read('styles.css');
  assert.ok(css.includes('html[data-device="mobile"] .runner-grid{grid-template-columns:repeat(2,minmax(0,1fr))'), 'mobile runner grid uses readable 2 columns');
  assert.ok(css.includes('html[data-device="mobile"] .market-pane{display:flex;flex-direction:column'), 'mobile market pane uses clean vertical stack');
  assert.ok(css.includes('--square:30px') && css.includes('#cabinet .players-menu{width:min(248px,calc(100vw - 24px))'), 'mobile uses compact 30px view buttons and crisp folded players menu');

  const mpSrc = read('js/multiplayer-client.js');
  assert.ok(mpSrc.includes('isCompactViewport') && mpSrc.includes('playersPinnedOpen=!isCompactViewport()'), 'folds active players menu by default on mobile');

  const trackSrc = read('js/track-tickets.js');
  assert.ok(trackSrc.includes('isCompact') && trackSrc.includes('let docked=isCompact()'), 'docks livePanel cleanly below viewWindow on mobile by default');

  const progSrc = read('js/round-program.js');
  assert.ok(progSrc.includes('const main=false,finish='), 'Console close-up stage disabled after camera 4 removal');
});

