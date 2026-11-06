// Foto mirate: kicker, rail, grab da vicino, caduta, menu. Uso: node scenes.js [nomi...]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
const W = +(process.env.W || 760), H = +(process.env.H || 350);
const want = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  const shot = async (n) => { await page.screenshot({ path: OUT + '/' + n + '.png', timeout: 180000 }); console.log('foto', n); };
  const until = (fn, t) => page.waitForFunction(fn, null, { timeout: t || 90000, polling: 30 }).catch(() => console.log('timeout'));
  if (!want.length || want.includes('menu')) { await page.waitForTimeout(2500); await shot('s_menu'); }
  await page.evaluate(() => { __pr.start('free'); window.__bot = 1; });
  await page.waitForTimeout(1500);
  if (!want.length || want.includes('kick')) {
    await page.evaluate(() => {
      const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && (g.size === 'L' || g.size === 'M') && g.d0 > 30);
      window.__f = f; pr.place(f.d0 - 14, f.u, f.K.vd); pr.P.vz = -f.K.vd;
      window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; if (P.mode === 'ground') { IN.jump = -P.z > f.d0 - 4 && -P.z < f.dLip; IN.sx = 0; IN.grab = -1; } else if (P.mode === 'air') { IN.jump = false; IN.grab = P.air.t > 0.25 && P.air.tLand > 0.4 ? 7 : -1; IN.sx = 0; } }, 10);
    });
    await until(() => __pr.P.lipD !== null && __pr.P.lipD < 2.5);
    await shot('s_ramp');
    await until(() => __pr.P.mode === 'air' && __pr.P.air.grab >= 0 && __pr.P.air.grabT > 0.35);
    await shot('s_grab');
    await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x + 4.5, P.y + 1.2, P.z - 1.5); cam.lookAt(P.x, P.y + 0.6, P.z); cam.fov = 40; }; });
    await page.waitForTimeout(400);
    await shot('s_grab_side');
    await page.evaluate(() => { window.__camFn = null; });
    await until(() => __pr.P.mode === 'ground' && __pr.P.landT > 0.05);
    await shot('s_landed');
    await page.evaluate(() => clearInterval(window.__ap));
  }
  if (!want.length || want.includes('side')) {
    await page.evaluate(() => { const pr = __pr; pr.place(60, 0, 9); pr.IN.sx = 0.35; window.__camFn = (cam, P) => { cam.position.set(P.x + 3.6, P.y + 1.1, P.z + 0.5); cam.lookAt(P.x, P.y + 0.8, P.z); cam.fov = 40; }; });
    await page.waitForTimeout(1200);
    await shot('s_carve_side');
    await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x - 0.6, P.y + 1.3, P.z - 3.6); cam.lookAt(P.x, P.y + 0.8, P.z); cam.fov = 40; }; __pr.IN.sx = 0; });
    await page.waitForTimeout(800);
    await shot('s_front');
    await page.evaluate(() => { window.__camFn = null; });
  }
  if (want.includes('board')) {
    await page.evaluate(() => { const pr = __pr; pr.place(80, 0, 7); pr.IN.sx = 0; window.__camFn = (cam, P) => { cam.position.set(P.x + 1.6, P.y + 0.55, P.z + 0.9); cam.lookAt(P.x, P.y + 0.05, P.z); cam.fov = 45; }; });
    await page.waitForTimeout(1200);
    await shot('s_board');
    await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x - 0.3, P.y + 1.6, P.z + 1.4); cam.lookAt(P.x, P.y, P.z); cam.fov = 45; }; __pr.IN.sx = 0.6; });
    await page.waitForTimeout(900);
    await shot('s_board_top');
    await page.evaluate(() => { window.__camFn = null; __pr.IN.sx = 0; });
  }
  if (!want.length || want.includes('rail')) {
    await page.evaluate(() => {
      const pr = __pr; let r = null;
      for (let i = 0; i < 40 && !r; i++) { r = pr.W.rails.find(x => x.d0 > -pr.P.z + 30); if (!r) pr.place(-pr.P.z + 200, 0, 5); }
      window.__r = r; pr.place(r.d0 - 16, r.pts[0].u, 9);
      window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; IN.jump = r.entry === 'ollie' && P.mode === 'ground' && -P.z > r.d0 - 4.8 && -P.z < r.d0 - 3.6; const u = P.x - pr.cx(-P.z), hd = Math.atan2(P.hx, -P.hz); IN.sx = P.mode === 'ground' ? Math.max(-1, Math.min(1, ((r.pts[0].u - u) * 0.15 - hd) * 3)) : 0; }, 10);
    });
    await until(() => __pr.P.mode === 'rail' || __pr.P.mode === 'crash', 60000);
    await page.waitForTimeout(150);
    await shot('s_rail');
    await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x + 3.2, P.y + 1.0, P.z + 1.0); cam.lookAt(P.x, P.y + 0.6, P.z); cam.fov = 40; }; __pr.IN.sx = 1; setTimeout(() => __pr.IN.sx = 0, 120); });
    await page.waitForTimeout(450);
    await shot('s_rail_side');
    const info = await page.evaluate(() => ({ mode: __pr.P.mode, why: __pr.P.crashWhy, type: window.__r.type }));
    console.log(JSON.stringify(info));
    await page.evaluate(() => { clearInterval(window.__ap); window.__camFn = null; });
  }
  if (want.includes('grabs')) {
    for (const gi of (process.env.GI ? process.env.GI.split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6, 7])) {
      await page.evaluate((gi) => {
        const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && (g.size === 'L' || g.size === 'XL')) || pr.W.feats.find(g => g.t === 'kick' && g.size === 'M' && g.d0 > 20);
        pr.place(f.d0 - 14, f.u, f.K.vd); window.__gi = gi;
        clearInterval(window.__ap);
        window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; if (P.mode === 'ground') { IN.jump = -P.z > f.d0 - 4 && -P.z < f.dLip; IN.sx = 0; IN.grab = -1; } else if (P.mode === 'air') { IN.jump = false; IN.grab = P.air.t > 0.2 ? gi : -1; IN.sx = 0; } }, 10);
        window.__camFn = null;
      }, gi);
      await until(() => __pr.P.mode === 'air' && __pr.P.air.grab >= 0 && __pr.P.air.grabT > 0.75);
      await page.evaluate(() => { const pr = __pr; window.__frozen = 1; window.__camFn = (cam, P) => { cam.position.set(P.x + 3.2, P.y + 1.0, P.z - 0.4); cam.lookAt(P.x, P.y + 0.45, P.z); cam.fov = 36; }; });
      await page.waitForTimeout(300);
      await shot('g_' + gi);
      await page.evaluate(() => { window.__camFn = null; clearInterval(window.__ap); });
    }
  }
  if (want.includes('slide')) {
    await page.evaluate(() => {
      const pr = __pr; pr.gen(6000); const r = pr.W.rails.find(x => x.kind === 'rail' && x.entry === 'direct');
      window.__r = r; pr.place(r.d0 - 16, r.pts[0].u, 9);
      window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; if (P.mode === 'rail') { if (P.rail.t > 0.15 && P.rail.t < 0.3) IN.sx = 1; else IN.sx = 0; return; } const u = P.x - pr.cx(-P.z), hd = Math.atan2(P.hx, -P.hz); IN.sx = P.mode === 'ground' ? Math.max(-1, Math.min(1, ((r.pts[0].u - u) * 0.15 - hd) * 3)) : 0; }, 10);
    });
    await until(() => __pr.P.mode === 'rail' && __pr.P.rail.t > 0.5, 90000);
    await shot('s_slide');
    await page.evaluate(() => { window.__camFn = (cam, P) => { cam.position.set(P.x + 2.6, P.y + 1.1, P.z + 1.4); cam.lookAt(P.x, P.y + 0.6, P.z); cam.fov = 40; }; });
    await page.waitForTimeout(250);
    await shot('s_slide_side');
    await page.evaluate(() => { clearInterval(window.__ap); window.__camFn = null; });
    console.log(await page.evaluate(() => JSON.stringify({ mode: __pr.P.mode, combo: __pr.CB().parts.map(p => p.name) })));
  }
  if (!want.length || want.includes('crash')) {
    await page.evaluate(() => { const pr = __pr; pr.place(80, 0, 14); setTimeout(() => pr.crash('tilt'), 300); });
    await page.waitForTimeout(1600);
    await shot('s_crash');
  }
  console.log(errs.join('\n') || 'nessun errore');
  await browser.close();
})();
