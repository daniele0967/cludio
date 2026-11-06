// Foto del gioco in Chromium: menu, partita, salto. Uso: OUT=dir node shot.js [w] [h]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 }).catch(() => errs.push('timeout menu'));
  if (errs.length) console.log(errs.join('\n'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/menu.png', timeout: 120000 });
  // partita: il bot guida (simulazione a passo fisso, la grafica si aggiorna a ogni fotogramma)
  await page.evaluate(() => { __pr.start('free'); window.__bot = 1; });
  const snap = async (name, cond, maxT) => {
    await page.waitForFunction(cond, null, { timeout: maxT || 60000, polling: 50 }).catch(() => console.log('cond timeout ' + name));
    await page.screenshot({ path: OUT + '/' + name + '.png', timeout: 120000 });
  };
  await page.evaluate(() => { __pr.P.safeT = 999; });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: OUT + '/play.png', timeout: 120000 });
  // pilota automatico: segue il prossimo kicker, tiene il salto sulla rampa, fa uno spin e un grab
  await page.evaluate(() => {
    const pr = __pr;
    window.__autopilot = setInterval(() => {
      const P = pr.P, W = pr.W, IN = pr.IN; if (!P || pr.state !== 'play') return;
      const d = -P.z; let f = null;
      for (const g of W.feats) if (g.t === 'kick' && g.dLip > d - 1 && g.dLip < d + 60 && (!f || g.dLip < f.dLip)) f = g;
      if (P.mode === 'ground') {
        const tu = f ? f.u : 0, cxv = P.x - (window.__cx ? window.__cx(d) : 0);
        IN.jump = !!(f && f.dLip - d < 4 && f.dLip - d > -0.3);
        IN.grab = -1; IN.sx = 0;
      } else if (P.mode === 'air') {
        IN.jump = false; IN.sx = P.air && P.air.t < 0.45 ? 1 : 0; IN.grab = P.air && P.air.t > 0.3 && P.air.tLand > 0.35 ? 2 : -1;
      }
    }, 16);
  });
  await snap('air', () => __pr.P.mode === 'air' && __pr.P.air && __pr.P.air.t > 0.5, 90000);
  await snap('land', () => __pr.P.mode === 'ground' && __pr.P.landT < 0.3 && __pr.P.landT > 0.05, 90000);
  const info = await page.evaluate(() => ({ state: __pr.state, d: -__pr.P.z, mode: __pr.P.mode, calls: __pr.renderer.info.render.calls, tris: __pr.renderer.info.render.triangles, score: __pr.GAME && __pr.GAME.score }));
  console.log(JSON.stringify(info));
  console.log(errs.slice(0, 20).join('\n') || 'nessun errore');
  await browser.close();
})();
