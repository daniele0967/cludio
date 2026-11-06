// Misura per ogni grab la distanza tra la mano che afferra e il punto giusto della tavola
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 160 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  const res = await page.evaluate(() => {
    const pr = __pr, T = pr.THREE, out = [];
    pr.start('free'); window.__frz = 1;
    const stances = ['regular', 'goofy'];
    for (const st of stances) {
      pr.save.set.stance = st;
      for (const sw of [false, true]) {
        for (let gi = 0; gi < 8; gi++) {
          const P = pr.P; P.mode = 'air'; P.sw = sw;
          P.air = { t: 1, grab: gi, grabT: 1.2, ws: 0, wf: 0, tLand: 1, landX: P.x, landY: P.y - 3, landZ: P.z - 10, landN: new T.Vector3(0, 1, 0), spin: 0, flip: 0 };
          P.crouch = 0.4; P.vx = 0; P.vz = -12;
          const nose = new T.Vector3(sw ? 0 : 0, 0, sw ? 1 : -1), up = new T.Vector3(0, 1, 0), z = new T.Vector3().crossVectors(nose, up);
          P.q.setFromRotationMatrix(new T.Matrix4().makeBasis(nose, up, z));
          pr.PS.init = false;
          for (let k = 0; k < 90; k++) pr.poseRider(1 / 60, 'air');
          const rig = pr.rig(), G = pr.GRABS[gi], ss = st === 'goofy' ? -1 : 1;
          const front = ss > 0 ? 'Left' : 'Right', back = ss > 0 ? 'Right' : 'Left', hand = G.hand === 'front' ? front : back;
          const hp = new T.Vector3(); rig.B[hand + 'Hand'].getWorldPosition(hp);
          const gp = pr.grabPoint(G, G.hand === 'front', new T.Vector3()).applyQuaternion(rig.board.quaternion).add(rig.board.position);
          // la mano libera non deve stare sotto la tavola
          const other = G.hand === 'front' ? back : front, op = new T.Vector3(); rig.B[other + 'Hand'].getWorldPosition(op);
          const hips = new T.Vector3(); rig.B.Hips.getWorldPosition(hips);
          out.push(`${st.padEnd(7)} ${sw ? 'switch' : 'avanti'} ${G.name.padEnd(10)} mano-punto ${(hp.distanceTo(gp) * 100).toFixed(0)} cm, mano libera ${op.y > hips.y ? 'sopra' : 'sotto'} il bacino`);
        }
      }
    }
    return out.join('\n');
  });
  console.log(res);
  await browser.close();
})();
