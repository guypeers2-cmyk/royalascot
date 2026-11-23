/* Optional browser regression: run npm start, then with Playwright/Chromium
   installed run: node tests/fullscreen.browser.cjs [desktop|phone|result].
   Set ASCOT_OFFLINE to the standalone HTML to test an allow-scripts-only iframe. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const mode = process.argv[2] || 'desktop';
const base = process.env.ASCOT_URL || 'http://127.0.0.1:3000/';
(async () => {
  const small = mode === 'phone', offline = small && process.env.ASCOT_OFFLINE;
  const browser = await chromium.launch({args:['--no-sandbox','--disable-webgl']});
  try {
    const page = await browser.newPage({viewport: small ? {width:390,height:844} : {width:1366,height:768}, hasTouch:small, reducedMotion:'reduce'});
    page.setDefaultTimeout(25000);
    const errors=[], network=[];
    page.on('pageerror', e=>errors.push(e.message));
    if (mode === 'result') {
      // Resume a deterministic saved race just before the first finisher.
      require('../js/bet-math.js'); const g=require('../js/engine.js').createMachine({random:()=>.13});
      g.place('win',[1],10);g.close(true);g.tick(g.remaining()+.1);
      g.state.clock=g.state.runners[0].finish-3;
      await page.addInitScript(saved=>{localStorage.setItem('hippodrome-cabinet-3',saved);let e;Object.defineProperty(window,'AscotEngine',{get:()=>e,set:v=>{e={...v,createMachine:o=>{const m=v.createMachine(o);window.__finish=()=>step(m.remaining()+.6);const step=m.tick;m.tick=()=>{};return m;}};}});},JSON.stringify(g.state));
    }
    let root=page;
    if (offline) {
      await page.route(/^https?:\/\//, r=>{network.push(r.request().url());return r.abort()});
      await page.setContent('<style>*{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe id="viewer" sandbox="allow-scripts"></iframe>');
      await page.evaluate(src=>document.getElementById('viewer').srcdoc=src,fs.readFileSync(offline,'utf8'));
      root=page.frameLocator('#viewer');
    } else {await page.goto(base);await page.waitForLoadState('networkidle')}
    const L=s=>root.locator(s), click=s=>L(s).click(), text=s=>L(s).innerText();
    const glass=require('./glass-helpers.cjs')(L),ev=(fn,v)=>L('#cabinet').evaluate(fn,v);
    const full=async()=>assert.ok(await L('#cabinet').evaluate(c=>c.classList.contains('station-full')&&(document.fullscreenElement===c||c.classList.contains('immersive'))));
    const enter=async()=>{await click('#fullButton');await L('#cabinet.station-full').waitFor();await full();},exit=async()=>{await click('#fullButton');await L('#cabinet.station-full').waitFor({state:'detached'});assert.equal(await L('[inert]').count(),0);};
    const svc=require('./station-keys.cjs')(L),station=k=>svc(k==='menu'?'controls':k);
    const title=async t=>{await L('#dialog[open]').waitFor();assert.equal(await text('#dialogTitle'),t);},pinned=async()=>{const b=await L('#tubePlace').boundingBox();assert.ok(b&&b.height>=44&&b.y>=0&&b.y+b.height<=(await ev(()=>innerHeight))+1);};
    await L('#fullButton[aria-pressed]').waitFor();await ev(()=>document.fonts.ready);
    if(mode==='result'){
      await enter();await station('monitor');await L('#airOrder').waitFor();await page.evaluate(()=>window.__finish());await L('#finishSlate').waitFor();await click('[data-finish=details]');await title('Official result');await L('#recordSection').selectOption('places');assert.equal(await L('#folioRows .paper-run').count(),6);await click('#dialogClose');await station('menu');await click('[data-station-window=history]');await title('Race history');await click('[data-open-heat="43"]');await L('#recordSection').selectOption('tickets');assert.equal(await L('#folioRows [data-outcome=won]').count(),1);await click('#dialogClose');await click('#deskClose');await click('[data-finish=next]');assert.equal(await text('#tubeCredit'),'540');await pinned();await exit();
    }else {
      // Use the very same real slip before, in, and after fullscreen.
      await glass.market('show');await glass.pick(2);await glass.stake(20);const sel=await text('#tubeSelection');await enter();assert.equal(await text('#tubeSelection'),sel);await pinned();if(offline)assert.ok(await ev(c=>c.classList.contains('immersive')));else if(!small)assert.ok(await ev(c=>document.fullscreenElement===c));
      await click('#tubePlace');assert.equal(await text('#tubeCredit'),'480');await glass.market('quinella');await glass.pick(1);await glass.pick(4);await glass.stake(5);await click('#tubePlace');assert.equal(await text('#tubeCredit'),'475');await station('tickets');await title('My bets');assert.equal(await L('#folioRows .ticket-copy').count(),2);await click('[data-cancel="1"]');assert.equal(await text('#tubeCredit'),'480');await click('#dialogClose');
      await station('field');const card='[data-runner="3"]';for(let i=0;i<6&&!await L(card).isVisible();i++)await click('#cardPager [data-next]');await click(card);await glass.page('field');assert.equal(await L('[data-tube-pick="3"][aria-pressed=true] .entry-id b').innerText(),'Susy Spitfire');await station('menu');await click('[data-station-window=guide]');await title('How to play');await click('[data-help=cabinet]');await title('Cabinet notes');await click('#dialogClose');assert.ok(await L('[data-station-window=guide]').evaluate(e=>e===document.activeElement));await click('#deskSound');assert.equal(await L('#deskSound').getAttribute('aria-pressed'),'true');await click('#deskSound');await L('#deskCamera').selectOption('2');assert.equal(await text('#cameraName'),'Track map');await full();assert.equal(await L('#stationDrawer').isVisible(),false);
      if(small)await page.setViewportSize({width:812,height:375});await station('console');await pinned();assert.equal(await text('#tubeCredit'),'480');if(small){await page.setViewportSize({width:320,height:568});await pinned();}await exit();assert.equal(await text('#tubeCredit'),'480');assert.equal(await ev(()=>document.querySelectorAll('#roundConsole').length),1);
      if(!small){await enter();await station('menu');await click('[data-station-window=history]');await title('Race history');await page.evaluate(()=>document.exitFullscreen());await L('#cabinet.station-full').waitFor({state:'detached'});assert.equal(await L('[inert]').count(),0);await click('#dialogClose');await click('#deskClose');await station('tickets');assert.equal(await L('#folioRows .ticket-copy').count(),1);await click('#dialogClose');}
    }
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log(`PASS ${mode}${offline?' offline/sandbox':''} — real controls, fullscreen state, credit, focusable panels and layout; zero uncaught errors.`);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
