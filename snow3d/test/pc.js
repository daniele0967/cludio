// Versione PC: menu, legenda, tastiera (curva, salto, grab Shift / mouse), gamepad simulato. Uso: node pc.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => {
    // gamepad finto, comandato da window.__pad
    window.__pad = null;
    navigator.getGamepads = () => window.__pad ? [window.__pad] : [];
  });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder-pc.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 120000 });
  const info = await page.evaluate(() => ({ pc: document.body.classList.contains('pc'), q: __pr.quality.level, pr: __pr.quality.pr, ultra: !!document.querySelector('.seg[data-k="quality"] button[data-v="3"]'), rotate: document.getElementById('rotate').classList.contains('hidden') }));
  console.log('PC', JSON.stringify(info));
  await page.waitForTimeout(1500); await page.screenshot({ path: OUT + '/pc_menu.png', timeout: 240000 });
  await page.evaluate(() => __pr.start('free'));
  await page.waitForTimeout(1500);
  // tastiera: D tenuto = curva
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600);
  const sx = await page.evaluate(() => __pr.IN.sx); await page.keyboard.up('KeyD');
  console.log('D -> sx', sx);
  // salto: Spazio tieni e lascia
  await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space'); const mm = []; for (let i = 0; i < 20; i++) { mm.push(await page.evaluate(() => __pr.P.mode[0])); await page.waitForTimeout(50); } console.log('modi dopo Spazio', mm.join(''));
  await page.waitForFunction(() => __pr.P.mode === 'air', null, { timeout: 60000 }).catch(() => console.log('nessun salto'));
  console.log('dopo Spazio', await page.evaluate(() => __pr.P.mode));
  // kicker vero: grab con il mouse trascinato verso destra (Indy) e poi Shift
  await page.evaluate(() => { const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && (g.size === 'L' || g.size === 'M') && g.d0 > 30); window.__f = f; pr.place(f.d0 - 14, f.u, f.K.vd); pr.P.vz = -f.K.vd; });
  await page.waitForFunction(() => -__pr.P.z > window.__f.d0 - 3, null, { timeout: 120000, polling: 20 });
  await page.keyboard.down('Space');
  await page.waitForFunction(() => __pr.P.mode === 'air', null, { timeout: 60000, polling: 20 });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => __pr.P.air && __pr.P.air.t > 0.15, null, { timeout: 60000, polling: 20 });
  await page.mouse.move(400, 360); await page.mouse.down(); await page.mouse.move(520, 360, { steps: 4 });
  await page.waitForFunction(() => __pr.P.air && __pr.P.air.grab >= 0, null, { timeout: 30000, polling: 20 }).catch(() => {});
  const g1 = await page.evaluate(() => ({ grab: __pr.P.air && __pr.P.air.grab, name: __pr.P.air && __pr.P.air.grab >= 0 ? __pr.GRABS[__pr.P.air.grab].name : '-' }));
  console.log('mouse trascinato a destra ->', JSON.stringify(g1));
  await page.screenshot({ path: OUT + '/pc_grab.png', timeout: 240000 });
  await page.mouse.up();
  await page.waitForFunction(() => __pr.P.mode !== 'air', null, { timeout: 60000, polling: 20 }).catch(() => {});
  console.log('atterraggio', await page.evaluate(() => __pr.P.mode + ' ' + __pr.P.quality));
  // gamepad: aspetta fotogrammi veri (il renderer software e' lento)
  const frames = (n) => page.evaluate((n) => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  const pad = (fn) => page.evaluate(fn);
  await pad(() => { window.__pad = { connected: true, axes: [-1, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }; });
  await frames(3);
  console.log('gamepad stick sx ->', await page.evaluate(() => __pr.IN.sx));
  await pad(() => { window.__pad.axes = [0, 0, 0, 0]; window.__pad.buttons[0].pressed = true; }); await frames(3);
  console.log('gamepad A ->', await page.evaluate(() => __pr.IN.jump));
  await pad(() => { window.__pad.buttons[0].pressed = false; }); await frames(3);
  await pad(() => { window.__pad.buttons[9].pressed = true; }); await frames(3);
  console.log('gamepad Start ->', await page.evaluate(() => __pr.state));
  await pad(() => { window.__pad.buttons[9].pressed = false; }); await frames(3);
  await pad(() => { window.__pad.buttons[9].pressed = true; }); await frames(3);
  console.log('gamepad Start di nuovo ->', await page.evaluate(() => __pr.state));
  await pad(() => { window.__pad.buttons[9].pressed = false; __pr.menu(); }); await frames(3);
  await pad(() => { window.__pad.buttons[0].pressed = true; }); await frames(3);
  console.log('gamepad A nel menu ->', await page.evaluate(() => __pr.state + ' ' + (__pr.GAME && __pr.GAME.mode)));
  await pad(() => { window.__pad.buttons[0].pressed = false; }); await frames(2);
  await page.evaluate(() => { window.__pad = null; });
  await page.keyboard.press('Escape'); await frames(3);
  console.log('Esc ->', await page.evaluate(() => __pr.state));
  await page.waitForTimeout(800); await page.screenshot({ path: OUT + '/pc_play.png', timeout: 240000 });
  console.log(errs.length ? errs.join('\n') : 'nessun errore');
  await browser.close();
})();
