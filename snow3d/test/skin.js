// Rider: editor dei colori, vestiti larghi, action cam. Foto in menu, in curva veloce e in volo.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 760, height: 350 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.click('#btnRider'); await page.waitForTimeout(1500);
  // giacca arancione, pantaloni verde scuro, casco nero
  await page.click('.pal[data-k="jacket"] button[data-c="' + 0xff8a1e + '"]');
  await page.click('.pal[data-k="pants"] button[data-c="' + 0x3c4a35 + '"]');
  await page.click('.pal[data-k="helmet"] button[data-c="' + 0x0f1115 + '"]');
  await page.click('.pal[data-k="bTop2"] button[data-c="' + 0x9bd13b + '"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/k_editor.png', timeout: 120000 });
  console.log('look salvato', await page.evaluate(() => JSON.stringify(__pr.save.set.look)));
  await page.click('#btnRiderClose');
  await page.evaluate(() => { __pr.start('free'); __pr.place(60, 0, 18); __pr.P.safeT = 999; window.__bot = 1; __pr.IN.sx = 0.5;
    window.__camFn = (cam, P) => { cam.position.set(P.x + 2.6, P.y + 1.1, P.z + 1.0); cam.lookAt(P.x, P.y + 0.9, P.z); cam.fov = 40; }; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/k_ride.png', timeout: 120000 });
  await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x - 2.4, P.y + 1.2, P.z - 0.4); cam.lookAt(P.x, P.y + 0.8, P.z); cam.fov = 38; }; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/k_back.png', timeout: 120000 });
  console.log(errs.join('\n') || 'nessun errore');
  await browser.close();
})();
