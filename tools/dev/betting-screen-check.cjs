// Headless harness: runs the real page against the live server and reports
// which betting surfaces are actually visible during the betting phase.
const { JSDOM, VirtualConsole } = require('jsdom'); // optional dev tool: npm i --no-save jsdom playwright
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';

const noop = () => {};
function fake2d() {
  const grad = { addColorStop: noop };
  return new Proxy({
    canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', globalCompositeOperation: 'source-over',
    imageSmoothingQuality: 'low', filter: 'none', shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: ''
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => grad;
      if (key === 'createPattern') return () => ({});
      if (key === 'getLineDash') return () => [];
      if (key === 'isPointInPath') return () => false;
      return noop;
    },
    set(target, key, value) { target[key] = value; return true; }
  });
}

async function boot() {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', error => errors.push(String(error.message || error)));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => fake2d();
      window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.show = function () { this.open = true; this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.open = false; this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
      window.Path2D = class { constructor() {} addPath() {} moveTo() {} lineTo() {} arc() {} closePath() {} rect() {} };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop });
      window.fetch = (...args) => fetch(...args);
      window.AudioContext = class { constructor() { return new Proxy({}, { get: () => () => ({ connect: noop, gain: { value: 0, setTargetAtTime: noop }, start: noop, stop: noop, buffer: null }) }); } };
      window.webkitAudioContext = window.AudioContext;
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = noop;
      window.URL.createObjectURL = () => 'blob:fake';
    }
  });
  return { dom, errors };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const { dom, errors } = await boot();
  const { window } = dom;
  await wait(4500);
  const $ = id => window.document.getElementById(id);
  const pill = () => $('phasePill')?.lastElementChild?.textContent || '?';
  const balance = () => $('balanceCount')?.textContent || '?';
  const betCount = () => $('slipCount')?.textContent || '?';

  // Step through the gate: display choice, then a local login (no server seat needed).
  const gate = $('sharedTableGate');
  console.log('gate present:', Boolean(gate));
  if (gate && !gate.hidden) {
    gate.querySelector('[data-device-pick="desktop"]').click();
    await wait(200);
    const form = gate.querySelector('form');
    form.elements.name.value = 'Harness';
    form.elements.pin.value = '1234';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(2500);
  }
  console.log('after login: phase pill =', pill(), '| balance', balance(), '| gate hidden:', $('sharedTableGate')?.hidden);

  const report = label => {
    const rc = $('roundConsole'), mp = $('marketPane'), drawer = $('stationDrawer');
    console.log(`\n[${label}]`);
    console.log('  phase pill:', pill(), '| balance', balance(), '| tickets', betCount());
    console.log('  #roundConsole hidden:', rc.hidden, '| field rows:', $('tubeRows')?.children.length ?? 0, '| cabinet:', $('cabinet').className);
    console.log('  #marketPane hidden:', mp.hidden, '| #stationDrawer hidden:', drawer.hidden);
  };
  report('betting open, as loaded');

  // Is a bet actually placeable from the glass?
  const entry = $('tubeRows')?.querySelector('.field-entry');
  if (entry) {
    entry.click();
    await wait(120);
    const placeKey = $('tubePlace');
    console.log('\n  stake', $('tubeStake')?.textContent, '| place key:', placeKey.textContent.trim(), '| disabled:', placeKey.disabled);
    placeKey.click();
    await wait(400);
    console.log('  after Place bet -> tickets', betCount(), '| balance', balance());
  }

  // The Track key must hand the player back to the parade.
  const trackKey = window.document.querySelector('[data-tube="track"]');
  console.log('\n  Track key present:', Boolean(trackKey), '| Ready key present:', Boolean(window.document.querySelector('[data-tube="start"]')));
  if (trackKey) { trackKey.click(); await wait(250); report('after Track key'); }
  const readyKey = window.document.querySelector('[data-tube="start"]');
  console.log('  Ready key label:', readyKey?.textContent.trim());

  // Try the paths a player would use to reach a betting screen.
  if (trackKey) { $('floorMenuButton').click(); await wait(500); }
  const consoleKey = [...window.document.querySelectorAll('[data-service]')].find(b => b.dataset.service === 'console');
  console.log('\nstation menu has a "console" entry:', Boolean(consoleKey));
  if (consoleKey) { consoleKey.click(); await wait(500); report('after Station menu -> Console'); }
  const betKey = [...window.document.querySelectorAll('[data-service]')].find(b => b.dataset.service === 'monitor');
  if (betKey) { betKey.click(); await wait(400); report('after Station menu -> Monitor'); }

  // Ready closes the glass and starts the race (single seat = the table is ready).
  const ready = window.document.querySelector('[data-tube="start"]');
  if (ready) { ready.click(); await wait(1600); report('after the Ready key'); }
  console.log('  Ready key label now:', window.document.querySelector('[data-tube="start"]')?.textContent.trim());

  const errorsOut = errors.filter(e => !/Not implemented|Could not parse CSS|css/i.test(e));
  console.log('\npage errors:', errorsOut.length ? errorsOut.slice(0, 4) : 'none');
  window.close();
  process.exit(0);
})();
