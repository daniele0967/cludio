// Effetti, camere e replay
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 760, height: 350 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  console.log('diag', await page.evaluate(() => { __pr.quality.auto = false; return document.getElementById('diagTxt') ? 'ok' : 'manca'; }));
  await page.evaluate(() => { __pr.start('free'); window.__bot = 1; __pr.quality.auto = false; });
  // salto con spin e grab sul primo kicker M/L
  await page.evaluate(() => {
    const pr = __pr, f = pr.W.feats.find(g => g.t === 'kick' && g.d0 > 30);
    pr.place(f.d0 - 14, f.u, f.K.vd);
    window.__ap = setInterval(() => { const P = pr.P, IN = pr.IN; if (pr.state !== 'play') return; if (P.mode === 'ground') { IN.jump = -P.z > f.d0 - 4 && -P.z < f.dLip; IN.sx = 0; IN.grab = -1; } else if (P.mode === 'air') { IN.jump = false; IN.sx = P.air.t < 0.4 ? 1 : 0; IN.grab = P.air.t > 0.45 && P.air.tLand > 0.35 ? 2 : -1; } }, 10);
  });
  await page.waitForFunction(() => __pr.P.mode === 'air' && __pr.P.air.grab >= 0, null, { timeout: 90000, polling: 30 });
  await page.screenshot({ path: OUT + '/x_air_post.png', timeout: 120000 });
  console.log('live', await page.evaluate(() => document.getElementById('live').textContent));
  await page.waitForFunction(() => !document.getElementById('btnReplay').classList.contains('hidden'), null, { timeout: 90000, polling: 50 }).catch(() => console.log('niente replay'));
  await page.evaluate(() => clearInterval(window.__ap));
  await page.click('#btnReplay').catch(e => console.log('click replay', e.message));
  await page.waitForTimeout(2500);
  console.log('stato', await page.evaluate(() => __pr.state));
  await page.screenshot({ path: OUT + '/x_replay.png', timeout: 120000 });
  await page.click('#replayBar').catch(() => {});
  await page.waitForTimeout(500);
  console.log('dopo replay', await page.evaluate(() => __pr.state));
  for (let c = 0; c < 2; c++) { await page.click('#btnCam'); await page.waitForTimeout(2500); await page.screenshot({ path: OUT + '/x_cam' + (c + 1) + '.png', timeout: 120000 }); }
  console.log(await page.evaluate(() => { const d = document.getElementById('diagTxt'); return d ? d.textContent : ''; }));
  console.log(errs.join('\n') || 'nessun errore');
  await browser.close();
})();
