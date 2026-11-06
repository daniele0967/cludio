// Method e Japan da tre lati, con il rider fermo in aria (regular, tavola verso -Z)
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-workspace-cludio/a159db5d-364f-5530-b3e8-33bda5b2af0d/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 360, height: 300 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  await page.evaluate(() => { __pr.start('free'); document.getElementById('btnPause').click(); document.getElementById('pause').style.display = 'none'; document.getElementById('hud').style.display = 'none'; document.getElementById('controls').style.display = 'none'; });
  for (const gi of [7, 3]) {
    for (const [nm, ox, oy, oz] of [['punte', 0, 0.9, 3.4], ['talloni', 0, 0.9, -3.4], ['punta', -3.4, 0.9, 0.0]]) {
      await page.evaluate(([gi, ox, oy, oz]) => {
        const pr = __pr, T = pr.THREE, P = pr.P;
        clearInterval(window.__hold);
        pr.save.set.stance = 'regular';
        const set = () => {
          P.mode = 'air'; P.sw = false; P.vx = 0; P.vy = 0; P.vz = -0.01; P.y = pr.groundH(P.x, P.z) + 3;
          P.air = { t: 1, grab: gi, grabT: 1.5, ws: 0, wf: 0, tLand: 2, landX: P.x, landY: P.y - 3, landZ: P.z - 10, landN: new T.Vector3(0, 1, 0), spin: 0, flip: 0, grabs: [] };
          const nose = new T.Vector3(0, 0, -1), up = new T.Vector3(0, 1, 0), z = new T.Vector3().crossVectors(nose, up);
          P.q.setFromRotationMatrix(new T.Matrix4().makeBasis(nose, up, z));
        };
        set(); window.__hold = setInterval(set, 5);
        // camera: punte = lato +X (petto del regular), talloni = -X, punta = davanti (-Z)
        window.__camFn = (cam, P) => { cam.position.set(P.x + oz, P.y + oy, P.z + ox); cam.lookAt(P.x, P.y + 0.55, P.z); cam.fov = 40; };
      }, [gi, ox, oy, oz]);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/mj_${gi}_${nm}.png`, timeout: 120000 });
    }
  }
  await browser.close();
})();
