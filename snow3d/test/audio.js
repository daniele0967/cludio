const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 300 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.click('.mode.main');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    // tutti i suoni in fila
    window.__sfxTest = n => __pr.sfx(n); ['pop', 'land', 'rail', 'box', 'switch', 'grab', 'crash', 'trick', 'perfect', 'bank', 'lost', 'goal', 'click', 'whoosh'].forEach(n => window.__sfxTest && window.__sfxTest(n));
    await new Promise(r => setTimeout(r, 1500));
    return { ok: true, au: !!__pr.AU(), state: __pr.AU() && __pr.AU().ctx.state };
  });
  console.log(JSON.stringify(r), errs.join('\n') || 'nessun errore');
  await browser.close();
})();
