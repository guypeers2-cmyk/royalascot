'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml'
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const rel = cleanUrl === '/' ? '/index.html' : cleanUrl;
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

(async () => {
  const shots = process.env.ASCOT_QA_SHOTS || '';
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      let e;
      Object.defineProperty(window, 'AscotEngine', {
        get: () => e,
        set: (v) => {
          e = {
            ...v,
            createMachine(opts) {
              const g = (window.heat = v.createMachine({ ...opts, random: () => 0.1 }));
              window.step = g.tick;
              g.tick = () => {};
              return g;
            }
          };
        }
      });
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-device-pick="desktop"]').click();
    await page.locator('#sharedJoinForm input[name="name"]').fill('Tester');
    await page.locator('#sharedJoinForm input[name="pin"]').fill('1234');
    await page.locator('#sharedLoginBtn').click();
    await page.locator('#tubeRows button').first().waitFor();

    const tap = (q) => page.locator(q).click();
    const cam = async (n) => {
      await tap('#cameraButton');
      await tap(`[data-camera="${n}"]`);
    };
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((ok) =>
            requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(ok)))
          )
      );

    // Start race
    await tap('#tubePlace');
    await tap('[data-tube=start]');
    await page.evaluate(() => step(10));
    await page.evaluate(() => {
      heat.state.clock = 26;
    });
    await settle();

    // Verify c hotkey cycles 0..8 -> 0
    await cam(5);
    await page.keyboard.press('c');
    assert.equal(await page.locator('#cameraName').innerText(), 'Action cam');
    await page.keyboard.press('c');
    assert.equal(await page.locator('#cameraName').innerText(), 'Track overview');
    await page.keyboard.press('c');
    assert.equal(await page.locator('#cameraName').innerText(), 'Horse nose cam');
    await page.keyboard.press('c');
    assert.equal(await page.locator('#cameraName').innerText(), 'Long-side seat');

    // Camera 7: Track overview — consoles & machine hidden, full-width pure track
    await cam(7);
    await settle();
    const overviewState = await page.evaluate(() => {
      const layout = document.querySelector('.machine-layout');
      const cab = document.querySelector('#cabinet');
      const term = document.querySelector('#terminal');
      const live = document.querySelector('#livePanel');
      const consoleEl = document.querySelector('#roundConsole');
      const orbitCanvas = document.querySelector('#orbitCanvas');
      return {
        camName: document.querySelector('#cameraName')?.textContent,
        deskVal: document.querySelector('#deskCamera')?.value,
        hasLayoutClass: layout?.classList.contains('track-only-layout'),
        hasViewClass: cab?.classList.contains('track-only-view'),
        termHidden: getComputedStyle(term).display === 'none',
        liveHidden: getComputedStyle(live).display === 'none',
        consoleHidden: consoleEl.hidden || getComputedStyle(consoleEl).display === 'none',
        orbitVisible: !orbitCanvas.hidden,
        orbitWidth: orbitCanvas.getBoundingClientRect().width,
        viewportWidth: window.innerWidth,
        orbitToolsHidden: document.querySelector('#orbitTools').hidden
      };
    });
    assert.equal(overviewState.camName, 'Track overview');
    assert.equal(overviewState.deskVal, '7');
    assert.equal(overviewState.hasLayoutClass, true);
    assert.equal(overviewState.hasViewClass, true);
    assert.equal(overviewState.termHidden, true);
    assert.equal(overviewState.liveHidden, true);
    assert.equal(overviewState.consoleHidden, true);
    assert.equal(overviewState.orbitVisible, true);
    assert.ok(overviewState.orbitWidth > 1100, `Expected full-width track overview, got ${overviewState.orbitWidth}`);
    assert.equal(overviewState.orbitToolsHidden, false);

    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, 'cam7-track-overview.png') });
    }

    // Camera 8: Horse nose cam — first-person nose perspective & horse selector
    await cam(8);
    await settle();
    const noseState1 = await page.evaluate(() => ({
      camName: document.querySelector('#cameraName')?.textContent,
      deskVal: document.querySelector('#deskCamera')?.value,
      noseAimHidden: document.querySelector('#noseAim').hidden,
      noseOptions: [...document.querySelectorAll('#noseHorse option')].map((o) => o.value),
      termHidden: getComputedStyle(document.querySelector('#terminal')).display === 'none',
      orbitVisible: !document.querySelector('#orbitCanvas').hidden,
      bugText: document.querySelector('#bugLens')?.textContent
    }));
    assert.equal(noseState1.camName, 'Horse nose cam');
    assert.equal(noseState1.deskVal, '8');
    assert.equal(noseState1.noseAimHidden, false);
    assert.deepEqual(noseState1.noseOptions, ['lead', '1', '2', '3', '4', '5', '6']);
    assert.equal(noseState1.termHidden, false);
    assert.equal(noseState1.orbitVisible, true);
    assert.equal(noseState1.bugText, 'NOSE CAMERA');

    if (shots) {
      await page.screenshot({ path: path.join(shots, 'cam8-nose-lead.png') });
    }

    // Switch nose cam target to runner #3 and advance clock
    await page.locator('#noseHorse').selectOption('3');
    await page.evaluate(() => {
      heat.state.clock = 41;
    });
    await settle();
    assert.equal(await page.locator('#noseHorse').inputValue(), '3');
    if (shots) {
      await page.screenshot({ path: path.join(shots, 'cam8-nose-horse3.png') });
    }

    // Also test Camera 6 (Action cam 3D) screenshot for visual check
    await page.evaluate(() => document.querySelector('#cabinetInfo').click());
    await page.locator('#actionPicture').selectOption('3d');
    await tap('#dialogClose');
    await cam(6);
    await settle();
    if (shots) {
      await page.screenshot({ path: path.join(shots, 'cam6-action-3d.png') });
    }

    assert.deepEqual(errors, []);
    console.log('PASS Camera 7 (Track overview) & Camera 8 (Horse nose cam) verified in real WebGL Chromium.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
