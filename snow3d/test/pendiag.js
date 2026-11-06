const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 200, height: 100 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  console.log(await page.evaluate(() => {
    __pr.start('free');
    const pr = __pr, T = pr.THREE, P = pr.P, rig = pr.rig(), out = [];
    for (let gi = 0; gi < 8; gi++) {
      pr.save.set.stance = 'regular'; P.mode = 'air'; P.sw = false;
      P.air = { t: 1, grab: gi, grabT: 1.2, ws: 0, wf: 0, tLand: 1, landX: P.x, landY: P.y - 3, landZ: P.z - 10, landN: new T.Vector3(0, 1, 0) };
      const nose = new T.Vector3(0, 0, -1), up = new T.Vector3(0, 1, 0), z = new T.Vector3().crossVectors(nose, up);
      P.q.setFromRotationMatrix(new T.Matrix4().makeBasis(nose, up, z)); pr.PS.init = false;
      for (let k = 0; k < 40; k++) pr.poseRider(1 / 30, 'air');
      pr.bodyCapsules(); const r = [];
      for (const sd of ['Left', 'Right']) { const a = new T.Vector3(), e = new T.Vector3(), h = new T.Vector3(); rig.B[sd + 'Arm'].getWorldPosition(a); rig.B[sd + 'ForeArm'].getWorldPosition(e); rig.B[sd + 'Hand'].getWorldPosition(h);
        const u = pr.penBreakdown(a, e, 0.35), f = pr.penBreakdown(e, h, 0); if (u) r.push(sd + ' braccio: ' + u); if (f) r.push(sd + ' avambraccio: ' + f); }
      const hp = new T.Vector3(); rig.B.Hips.getWorldPosition(hp); const by = new T.Vector3(0, 1, 0).applyQuaternion(rig.board.quaternion); const clr = hp.clone().sub(rig.board.position).dot(by);
      out.push(pr.GRABS[gi].name + ' tavola nel corpo ' + Math.round(pr.boardPen() * 100) + ' cm, bacino sopra la tavola ' + Math.round(clr * 100) + ' cm -> ' + (r.join(' | ') || 'braccia pulite'));
    }
    return out.join('\n');
  }));
  await browser.close();
})();
