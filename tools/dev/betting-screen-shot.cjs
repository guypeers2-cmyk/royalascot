const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e).split('\n').slice(0,3).join(' | ')));
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/user/shots/0-gate.png' });

  await page.click('[data-device-pick="desktop"]');
  await page.waitForTimeout(400);
  await page.fill('input[name="name"]', process.env.WHO || ('Player' + (Date.now() % 10000)));
  await page.fill('input[name="pin"]', '1234');
  await page.evaluate(() => document.getElementById('sharedJoinForm').requestSubmit());
  await page.waitForTimeout(200);
  await page.waitForTimeout(3500);
  console.log('gate visible after login:', await page.evaluate(() => !document.getElementById('sharedTableGate').hidden), '| error line:', await page.evaluate(() => document.querySelector('#sharedGateError')?.textContent || ''));
  await page.screenshot({ path: '/home/user/shots/1-betting.png' });

  const glass = await page.evaluate(() => {
    const tube = document.getElementById('roundConsole');
    return { hidden: tube.hidden, rows: document.getElementById('tubeRows').children.length,
      cabinet: document.getElementById('cabinet').className,
      pill: document.getElementById('phasePill').lastElementChild.textContent,
      box: tube.getBoundingClientRect().toJSON(), vw: innerWidth, vh: innerHeight };
  });
  console.log('betting glass:', JSON.stringify(glass));

  // place a stake from the glass
  await page.evaluate(() => document.querySelector('#tubeRows .field-entry').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('tubePlace').click());
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/user/shots/2-ticket.png' });
  console.log('after place:', await page.evaluate(() => ({ tickets: document.getElementById('slipCount').textContent, balance: document.getElementById('balanceCount').textContent })));

  // hand back to the parade
  await page.evaluate(() => document.querySelector('[data-tube="track"]').click());
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/user/shots/3-track.png' });
  console.log('after Track:', await page.evaluate(() => ({ hidden: document.getElementById('roundConsole').hidden, cabinet: document.getElementById('cabinet').className })));

  // and back to the glass through the station menu
  await page.evaluate(() => document.getElementById('floorMenuButton').click());
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/home/user/shots/4-menu.png' });
  const menuDump = await page.evaluate(() => {
    const dlg = document.getElementById('dialog');
    const keys = [...dlg.querySelectorAll('button')].map(b => (b.dataset.service ? 'service:' + b.dataset.service : b.textContent.trim().slice(0, 22)));
    return { open: dlg.open, keys: keys.slice(0, 14) };
  });
  console.log('station menu:', JSON.stringify(menuDump));
  const entry = await page.$('[data-service="console"]');
  console.log('station menu console entry:', Boolean(entry));
  if (entry) { await page.evaluate(() => document.querySelector('[data-service=\"console\"]').click()); await page.waitForTimeout(800); await page.screenshot({ path: '/home/user/shots/5-console-again.png' });
    console.log('reopened:', await page.evaluate(() => !document.getElementById('roundConsole').hidden)); }

  // Ready key starts the meeting
  const ready = await page.$('[data-tube="start"]');
  if (ready) { await page.evaluate(() => document.querySelector('[data-tube="start"]').click()); await page.waitForTimeout(2000); await page.screenshot({ path: '/home/user/shots/6-gates.png' });
    console.log('after Ready:', await page.evaluate(() => ({ pill: document.getElementById('phasePill').lastElementChild.textContent, hidden: document.getElementById('roundConsole').hidden }))); }
  console.log('page errors:', errors.length ? errors.slice(0,3) : 'none');
  await browser.close();
})();
