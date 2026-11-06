// Percorso completo: 3 cadute -> fine corsa, impostazioni, guida, frenata con neve sollevata.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 760, height: 350 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.click('#btnSet'); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/f_settings.png', timeout: 120000 });
  await page.click('#btnSetClose'); await page.click('#btnGuide'); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/f_guide.png', timeout: 120000 });
  await page.click('#btnGuideClose'); await page.click('#btnRider'); await page.waitForTimeout(1500);
  await page.click('#outfits .sw[data-i="1"]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/f_rider.png', timeout: 120000 });
  await page.click('#btnRiderClose');
  await page.click('.mode.main'); await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__bot = 1; __pr.place(60, 0, 14); __pr.IN.sy = -1; __pr.IN.sx = 0.3; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/f_brake.png', timeout: 120000 });
  await page.evaluate(() => { __pr.IN.sy = 0; __pr.IN.sx = 0; });
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => __pr.state === 'play' && __pr.P.mode !== 'crash', null, { timeout: 60000 });
    await page.evaluate(() => __pr.crash('tilt'));
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => __pr.state === 'over', null, { timeout: 90000 }).catch(() => errs.push('nessun game over'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/f_over.png', timeout: 120000 });
  await page.click('#btnAgain'); await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({ state: __pr.state, lives: __pr.GAME.lives, outfit: __pr.save.set.outfit, runs: __pr.save.runs }));
  console.log(JSON.stringify(st));
  console.log(errs.join('\n') || 'nessun errore');
  await browser.close();
})();
