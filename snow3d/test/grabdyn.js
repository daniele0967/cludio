// Un grab dall'inizio alla fine, fotogramma per fotogramma: scatti del gomito, mano lontana, braccia/ginocchia nel corpo,
// tavola nel corpo. Uso: GI=3 node grabdyn.js
const { chromium } = require('playwright');
const path = require('path');
const GI = (process.env.GI || '3').split(',').map(Number);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 160 } });
  page.on('pageerror', e => console.log('pageerror', e.message, e.stack.split('\n').slice(0,8).join(' | ')));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  const res = await page.evaluate(([GIS, SER]) => {
    const pr = __pr, T = pr.THREE, out = [];
    pr.start('free'); if (SER) { window.__ser = []; window.__hj = []; }
    const W = (b) => { const v = new T.Vector3(); pr.rig().B[b].getWorldPosition(v); return v; };
    for (const gi of GIS) for (const st of ['regular', 'goofy']) for (const sw of [false, true]) for (const ws of [0, 6]) {
      pr.save.set.stance = st;
      const P = pr.P, G = pr.GRABS[gi], ss = st === 'goofy' ? -1 : 1;
      P.mode = 'air'; P.sw = sw; P.crouch = 0.4; P.vx = 0; P.vz = -12;
      P.air = { t: 0.3, grab: -1, grabT: 0, ws: ws, wf: 0, tLand: 2, landX: P.x, landY: P.y - 3, landZ: P.z - 10, landN: new T.Vector3(0, 1, 0), spin: 0, flip: 0 };
      const nose = new T.Vector3(0, 0, sw ? 1 : -1), up = new T.Vector3(0, 1, 0), z = new T.Vector3().crossVectors(nose, up);
      const q0 = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(nose, up, z)); P.q.copy(q0);
      pr.PS.init = false; pr.PS.gi = -1; pr.PS.grab = 0;
      for (let k = 0; k < 20; k++) pr.poseRider(1 / 60, 'air');
      const front = ss > 0 ? 'Left' : 'Right', back = ss > 0 ? 'Right' : 'Left', hand = G.hand === 'front' ? front : back;
      let maxJump = 0, jumpAt = 0, maxDist = 0, maxPen = 0, penAt = '', maxBoard = 0, maxKnee = 0, kneeAt = 0, prevE = null, prevH = null, maxHJ = 0;
      const n = 100;
      for (let k = 0; k < n; k++) {
        const t = k / 60;
        P.air.grab = gi; P.air.grabT = t; P.air.t = 0.3 + t;
        if (ws) P.q.copy(q0).premultiply(new T.Quaternion().setFromAxisAngle(up, ws * t));
        pr.poseRider(1 / 60, 'air');
        const rig = pr.rig(), e = W(hand + 'ForeArm'), h = W(hand + 'Hand'), hip = W('Hips');
        // nel sistema del corpo (relativo al bacino) per non contare la rotazione dello spin
        const inv = new T.Quaternion(); rig.B.Hips.getWorldQuaternion(inv); inv.invert();
        const el = e.clone().sub(hip).applyQuaternion(inv), hl = h.clone().sub(hip).applyQuaternion(inv);
        if (prevE && k > 3) { const j = el.distanceTo(prevE); if (j > maxJump) { maxJump = j; jumpAt = k; } maxHJ = Math.max(maxHJ, hl.distanceTo(prevH)); if (window.__hj) window.__hj.push(Math.round(hl.distanceTo(prevH) * 100) + '/' + pr.PS.grab.toFixed(2) + '[' + [hl.x, hl.y, hl.z].map(v => Math.round(v * 100)).join(',') + ']'); }
        prevE = el; prevH = hl;
        if (k > 40) {
          const gp = pr.grabPoint(G, G.hand === 'front', new T.Vector3()).applyQuaternion(rig.board.quaternion).add(rig.board.position);
          maxDist = Math.max(maxDist, h.distanceTo(gp));
        }
        pr.bodyCapsules(); let pen = 0, why = '';
        for (const sd of ['Left', 'Right']) { const a = W(sd + 'Arm'), ee = W(sd + 'ForeArm'), hh = W(sd + 'Hand'); const p1 = pr.armPenetration(a, ee, 0.35), p2 = pr.armPenetration(ee, hh, 0); pen += p1 + p2; if (p1 + p2 > 0.02) why += sd + ':' + pr.penBreakdown(a, ee, 0.35) + '|' + pr.penBreakdown(ee, hh, 0) + ' '; }
        if (window.__ser) window.__ser.push(Math.round(pen * 100));
        if (pen > maxPen) { maxPen = pen; penAt = k + ' ' + why; }
        maxBoard = Math.max(maxBoard, pr.boardPen());
        // ginocchia: distanza dal petto (Spine2) e dal volto
        for (const sd of ['Left', 'Right']) { const kn = W(sd + 'Leg'), ch = W('Spine2'), hd = W('Head'); const d = Math.min(kn.distanceTo(ch), kn.distanceTo(hd)); const p = Math.max(0, 0.2 - d); if (p > maxKnee) { maxKnee = p; kneeAt = k; } }
      }
      if (window.__ser) { out.push(window.__ser.join(' ')); window.__ser = []; out.push(window.__hj.slice(0, 30).join(' ')); window.__hj = []; }
      out.push(`${G.name} ${st} ${sw ? 'sw' : 'av'} spin${ws}: gomito scatto max ${(maxJump * 100).toFixed(1)}cm@${jumpAt} mano scatto ${(maxHJ * 100).toFixed(1)}cm, mano-punto ${(maxDist * 100).toFixed(0)}cm, braccia nel corpo ${(maxPen * 100).toFixed(0)}cm [${penAt.trim()}], tavola nel corpo ${(maxBoard * 100).toFixed(0)}cm, ginocchio nel petto ${(maxKnee * 100).toFixed(0)}cm@${kneeAt}`);
    }
    return out.join('\n');
  }, [GI, !!process.env.SER]);
  console.log(res);
  await browser.close();
})();
