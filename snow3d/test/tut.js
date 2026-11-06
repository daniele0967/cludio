const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 760, height: 350 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.evaluate(() => { __pr.start('tutorial'); window.__bot = 1; __pr.P.safeT = 9999; });
  const step = () => page.evaluate(() => __pr.GAME.tut.i);
  const hintTxt = () => page.evaluate(() => document.getElementById('hint').textContent);
  await page.waitForTimeout(1500);
  console.log('passo', await step(), '|', await hintTxt());
  await page.screenshot({ path: OUT + '/tut1.png', timeout: 120000 });
  await page.evaluate(() => { __pr.IN.sx = 0.8; }); await page.waitForFunction(() => __pr.GAME.tut.i >= 1, null, { timeout: 60000 }).catch(() => console.log("timeout passo 1")); await page.evaluate(() => { __pr.IN.sx = 0; });
  await page.waitForTimeout(1500);
  console.log('passo', await step(), '|', await hintTxt());
  await page.evaluate(() => { __pr.IN.sy = 1; }); await page.waitForTimeout(5000); await page.evaluate(() => { __pr.IN.sy = -1; }); await page.waitForFunction(() => __pr.GAME.tut.i >= 2, null, { timeout: 60000 }).catch(() => console.log("timeout passo 2")); await page.evaluate(() => { __pr.IN.sy = 0; });
  await page.waitForTimeout(1500);
  console.log('passo', await step(), '|', await hintTxt());
  for (let k = 0; k < 2; k++) { await page.evaluate(() => { __pr.IN.jump = true; }); await page.waitForTimeout(1500); await page.evaluate(() => { __pr.IN.jump = false; }); await page.waitForTimeout(6000); }
  await page.waitForTimeout(1500);
  console.log('passo', await step(), '|', await hintTxt());
  await page.screenshot({ path: OUT + '/tut2.png', timeout: 120000 });
  console.log(errs.join('\n') || 'nessun errore');
  // verticale
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/portrait_play.png', timeout: 120000 });
  await page.evaluate(() => __pr.menu());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/portrait_menu.png', timeout: 120000 });
  await browser.close();
})();
