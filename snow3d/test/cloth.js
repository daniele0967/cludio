// Stoffa: registra lo spostamento d'inerzia (PS.cx) su un salto e conta le oscillazioni. Uso: node cloth.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 240 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.evaluate(() => { __pr.start('free'); window.__bot = 1; });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && g.size === 'M' && g.d0 > 30);
    pr.place(f.d0 - 14, f.u, f.K.vd); pr.P.vz = -f.K.vd; window.__log = [];
    window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; IN.jump = P.mode === 'ground' && -P.z > f.d0 - 4 && -P.z < f.dLip; IN.sx = 0; IN.grab = -1;
      const c = pr.PS.cx; if (c) __log.push([P.mode[0] + Math.round(-P.z - f.d0), +c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)]); }, 50);
  });
  await page.waitForFunction(() => __pr.P.mode === 'air', null, { timeout: 180000, polling: 50 });
  await page.waitForFunction(() => __pr.P.mode === 'ground' && __pr.P.landT > 1.2, null, { timeout: 180000, polling: 50 }).catch(() => console.log('timeout'));
  const log = await page.evaluate(() => { clearInterval(__ap); return __log; });
  let sign = 0, flips = 0, max = 0;
  for (const r of log) { const y = r[2]; max = Math.max(max, Math.hypot(r[1], r[2], r[3])); if (Math.abs(y) > 0.004) { const s = Math.sign(y); if (sign && s !== sign) flips++; sign = s; } }
  console.log(log.filter((r,i)=>i%4==0).map(r => r[0] + ':' + (r[2] * 100).toFixed(1)).join(' '));
  console.log('max cm', (max * 100).toFixed(1), 'cambi di segno in y', flips);
  console.log(errs.length ? errs.join('\n') : 'nessun errore');
  await browser.close();
})();
