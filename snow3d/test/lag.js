// Il rider gira su se stesso velocemente: le mani, viste dal corpo, devono restare dove sono (niente ritardo)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 160 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  console.log(await page.evaluate(() => {
    __pr.start('free');
    const pr = __pr, T = pr.THREE, P = pr.P, rig = pr.rig(), out = [];
    for (const mode of ['ground', 'air']) {
      P.mode = mode; P.air = mode === 'air' ? { t: 1, grab: -1, grabT: 0, ws: 0, wf: 0, tLand: 1, landN: new T.Vector3(0, 1, 0) } : null; P.steer = 0; P.lean = 0; P.vx = 0; P.vz = -10;
      pr.PS.init = false;
      let maxDev = 0, ref = null;
      for (let k = 0; k < 120; k++) {
        const yaw = k < 30 ? 0 : (k - 30) * 0.12;  // gira di 7 rad/s
        const nose = new T.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)), up = new T.Vector3(0, 1, 0), z = new T.Vector3().crossVectors(nose, up);
        P.q.setFromRotationMatrix(new T.Matrix4().makeBasis(nose, up, z));
        pr.poseRider(1 / 60, mode);
        const hips = new T.Vector3(), h = new T.Vector3(); rig.B.Hips.getWorldPosition(hips); rig.B.LeftHand.getWorldPosition(h);
        const loc = h.sub(hips); const l = [loc.dot(nose), loc.y, loc.dot(z)];
        if (k === 29) ref = l;
        if (k > 40 && ref) maxDev = Math.max(maxDev, Math.hypot(l[0] - ref[0], l[1] - ref[1], l[2] - ref[2]));
      }
      out.push(mode + ': spostamento massimo della mano rispetto al corpo durante la rotazione ' + (maxDev * 100).toFixed(1) + ' cm');
    }
    return out.join('\n');
  }));
  await browser.close();
})();
