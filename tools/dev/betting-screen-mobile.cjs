const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [tag, size] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 834, height: 1112 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => document.querySelector('[data-device-pick="' + (innerWidth < 600 ? 'mobile' : 'tablet') + '"]').click());
    await page.waitForTimeout(300);
    await page.fill('input[name="name"]', tag + (Date.now() % 1000));
    await page.fill('input[name="pin"]', '1234');
    await page.evaluate(() => document.getElementById('sharedJoinForm').requestSubmit());
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const tube = document.getElementById('roundConsole');
      const deck = document.querySelector('.sat-deck');
      const rows = document.getElementById('tubeRows');
      return {
        pill: document.getElementById('phasePill').lastElementChild.textContent,
        glass: !tube.hidden,
        tubeScrollW: tube.scrollWidth, tubeClientW: tube.clientWidth,
        deckFits: deck.scrollWidth <= deck.clientWidth + 2,
        keys: [...deck.querySelectorAll('button')].map(b => b.textContent.trim().split('\n')[0]).slice(0, 4),
        rows: rows.children.length
      };
    });
    console.log(tag, JSON.stringify(info), 'errors:', errors.slice(0, 2));
    await page.screenshot({ path: `/home/user/shots/${tag}.png`, fullPage: false });
    await page.close();
  }
  await browser.close();
})();
