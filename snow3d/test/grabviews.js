// Un grab fermo a meta' volo visto da 4 lati. Uso: GI=3 [GOOFY=1] node grabviews.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
const GI = +(process.env.GI || 3), TAG = process.env.TAG || '';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 380 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  if (process.env.GOOFY) await page.evaluate(() => { __pr.save.set.stance = 'goofy'; });
  await page.evaluate(() => { __pr.start('free'); window.__bot = 1; });
  await page.waitForTimeout(800);
  await page.evaluate((gi) => {
    const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && (g.size === 'L' || g.size === 'XL')) || pr.W.feats.find(g => g.t === 'kick' && g.size === 'M' && g.d0 > 20);
    pr.place(f.d0 - 14, f.u, f.K.vd);
    window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; if (P.mode === 'ground') { IN.jump = -P.z > f.d0 - 4 && -P.z < f.dLip; IN.sx = 0; IN.grab = -1; } else if (P.mode === 'air') { IN.jump = false; IN.grab = P.air.t > 0.2 ? gi : -1; IN.sx = 0; } }, 10);
  }, GI);
  await page.waitForFunction(() => __pr.P.mode === 'air' && __pr.P.air.grab >= 0 && __pr.P.air.grabT > 0.75, null, { timeout: 180000, polling: 30 });
  await page.evaluate(() => { window.__frozen = 1; });
  // nel sistema della tavola: x punta, z lato punte (regular)
  const views = { toe: [0.4, 0.5, 4.0], heel: [-0.4, 0.5, -4.0], nose: [4.0, 0.5, 0.5], tail: [-4.0, 0.5, -0.5] };
  await page.evaluate(() => { const h = document.getElementById('hud') || document.querySelector('.hud'); document.querySelectorAll('body > div').forEach(d => { if (d.id !== 'game' && !d.querySelector('canvas')) d.style.visibility = 'hidden'; }); });
  for (const [n, o] of Object.entries(views)) {
    await page.evaluate((o) => {
      window.__camFn = (cam, P) => {
        const T = window.THREE || null; const q = P.q;
        // direzioni della tavola senza spin del trick: uso l'orientamento base (heading) del rider
        const hx = P.hx, hz = P.hz, ss = (__pr.save.set.stance === 'goofy') ? -1 : 1;
        const fx = -hz, fz = hx; // perpendicolare
        const x = P.x + hx * o[0] + fx * o[2], z = P.z + hz * o[0] + fz * o[2];
        cam.position.set(x, P.y + 0.5 + o[1], z); cam.lookAt(P.x, P.y + 0.55, P.z); cam.fov = 34;
      };
    }, o);
    await page.waitForTimeout(350);
    await page.screenshot({ path: OUT + '/gv' + TAG + '_' + n + '.png' });
  }
  const info = await page.evaluate(() => ({ grab: __pr.P.air.grab, hx: __pr.P.hx, hz: __pr.P.hz }));
  console.log(JSON.stringify(info), errs.length ? errs.join('\n') : 'nessun errore');
  await browser.close();
})();
