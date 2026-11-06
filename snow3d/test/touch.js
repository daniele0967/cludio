// Prova i comandi touch con eventi multi-touch veri (CDP): stick a sinistra, salto/grab/press a destra.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 760, height: 350 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  const cdp = await ctx.newCDPSession(page);
  const tp = (pts) => pts.map(p => ({ x: p[0], y: p[1], id: p[2] }));
  const T = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: tp(pts) });
  const st = () => page.evaluate(() => ({ mode: __pr.P.mode, sx: +__pr.IN.sx.toFixed(2), sy: +__pr.IN.sy.toFixed(2), jump: __pr.IN.jump, grab: __pr.IN.grab, press: __pr.IN.press, charge: +__pr.P.charge.toFixed(2), butter: !!__pr.P.butter, air: __pr.P.air ? { t: +__pr.P.air.t.toFixed(2), grab: __pr.P.air.grab, hold: __pr.P.air.hold } : null }));
  // tocco sul pulsante Free Run
  await page.tap('.mode.main');
  await page.waitForTimeout(800);
  await page.evaluate(() => { __pr.place(60, 0, 10); __pr.P.safeT = 999; });
  const log = [];
  // 1) pollice sinistro: stick a destra
  await T('touchStart', [[150, 250, 1]]); await T('touchMove', [[200, 250, 1]]); await page.waitForTimeout(100);
  log.push(['stick destra', await st()]);
  await T('touchMove', [[150, 290, 1]]); await page.waitForTimeout(100);
  log.push(['stick giu (freno)', await st()]);
  await T('touchEnd', []); await page.waitForTimeout(100);
  log.push(['stick lasciato', await st()]);
  // 2) pollice destro tenuto: carica
  await T('touchStart', [[600, 250, 2]]); await page.waitForTimeout(350);
  log.push(['destro tenuto: carica', await st()]);
  // 3) lascia il destro: salta
  await T('touchEnd', []); await page.waitForTimeout(120);
  log.push(['rilasciato: in aria?', await st()]);
  // 4) in aria: tocca e trascina verso l'alto = Nose
  await T('touchStart', [[600, 250, 3]]); await page.waitForTimeout(20);
  log.push(['tocco in aria (centro=Indy)', await st()]);
  await T('touchMove', [[600, 190, 3]]); await page.waitForTimeout(20);
  log.push(['trascina su (Nose)', await st()]);
  await page.screenshot({ path: OUT + '/t_compass.png', timeout: 120000 });
  await T('touchEnd', []);
  await page.waitForFunction(() => __pr.P.mode === 'ground', null, { timeout: 20000 }).catch(() => {});
  log.push(['atterrato', await page.evaluate(() => ({ combo: __pr.CB().parts.map(p => p.name) }))]);
  // 5) a terra: trascina su = nose press, poi stick = butter
  await page.waitForTimeout(300);
  await T('touchStart', [[600, 250, 4]]); await T('touchMove', [[600, 200, 4]]); await page.waitForTimeout(80);
  log.push(['press su', await st()]);
  await T('touchStart', [[600, 200, 4], [150, 250, 5]]); await T('touchMove', [[600, 200, 4], [210, 250, 5]]); await page.waitForTimeout(500);
  log.push(['butter con stick', await st()]);
  await T('touchEnd', []); await page.waitForTimeout(300);
  // 6) tieni il salto e trascina dopo il decollo: diventa un grab (un solo gesto)
  await T('touchStart', [[600, 250, 6]]); await page.waitForTimeout(300);
  await page.evaluate(() => { __pr.P.vy += 5; });
  await page.waitForTimeout(150);
  await T('touchMove', [[660, 250, 6]]); await page.waitForTimeout(60);
  log.push(['tenuto+trascina dopo il salto', await st()]);
  await T('touchEnd', []);
  const ev = await page.evaluate(() => ({ score: __pr.GAME.score, combo: __pr.CB().parts.map(p => p.name) }));
  log.push(['dopo', ev]);
  for (const l of log) console.log(l[0].padEnd(28), JSON.stringify(l[1]));
  console.log(errs.join('\n') || 'nessun errore');
  await browser.close();
})();
