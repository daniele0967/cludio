// ============================================================ FISICA DEL RIDER (senza grafica)
// Il punto (x,y,z) e' il centro della tavola, sotto, a contatto con la neve.
// Sistema locale della tavola: +X = punta (nose), +Y = su, +Z = a destra della punta.
var DT = 1 / 120;
var SPIN_MAX = 9.4;          // rad/s (circa 540 gradi al secondo)
var FLIP_MAX = 6.6;          // rad/s
var POP_MIN = 1.1;           // salto con un tocco veloce
var CHARGE_T = 0.42;         // tempo per caricare il salto al massimo
var RAIL_ASSIST = 0.06;      // aiuto laterale per salire sui rail: 6 cm, quasi niente

// comandi letti dalla fisica (li riempie l'interfaccia o i test)
var IN = { sx: 0, sy: 0, jump: false, grab: -1, press: 0, cancel: false };

var P = null, EV = [];
var V3 = THREE.Vector3, Q4 = THREE.Quaternion;
var _n = new V3(), _n2 = new V3(), _a = new V3(), _b = new V3(), _c = new V3(), _m = new THREE.Matrix4(), _q = new Q4(), _q2 = new Q4(), _rp = {}, _pp = {};
var AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);

function stanceSign() { return save.set.stance === 'goofy' ? -1 : 1; }
function assistLvl() { return save.set.assist; } // 0 pro, 1 normale, 2 facile

function newPlayer(d, u, speed) {
  var x = cx(d) + (u || 0), z = -d, y = groundH(x, z);
  P = {
    x: x, y: y, z: z, vx: 0, vy: 0, vz: -(speed || 0), mode: 'ground', sw: false, yawOff: 0, steer: 0, lean: 0,
    n: new V3(0, 1, 0), hx: 0, hz: -1, q: new Q4(), crouch: 0, charge: 0, chargeT: 0, prewind: 0, jumpWas: false,
    coyote: 0, coyotePop: false, lipD: null, onKick: null, air: null, rail: null, butter: null, brake: 0, tuck: 0,
    landT: 9, sketchT: 0, quality: '', crashT: 0, crashWhy: '', safeT: 0, d0: d, maxD: d, airTot: 0,
    railCool: 0, wobble: 0, popT: 9, lastGround: 0, kickTag: null, scrub: 0
  };
  groundN(x, z, P.n);
  boardFrame(P.q, P.hx, P.hz, P.n, 0, false);
  return P;
}
function dist() { return -P.z; }
function speedOf() { return Math.sqrt(P.vx * P.vx + P.vy * P.vy + P.vz * P.vz); }

// orientamento della tavola: direzione di marcia (orizzontale), normale, rotazione della tavola rispetto alla marcia
function boardFrame(out, hx, hz, n, yaw, sw) {
  var c = Math.cos(yaw), s = Math.sin(yaw);
  var fx = hx * c + hz * s, fz = -hx * s + hz * c; // rotazione attorno a +Y
  if (sw) { fx = -fx; fz = -fz; }
  _a.set(fx, 0, fz);
  _a.addScaledVector(n, -_a.dot(n)).normalize();      // punta sul piano della neve
  _c.crossVectors(_a, n).normalize();                  // destra della punta
  _b.crossVectors(_c, _a).normalize();
  _m.makeBasis(_a, _b, _c);
  return out.setFromRotationMatrix(_m);
}
function noseOf(q, out) { return out.copy(AX).applyQuaternion(q); }
function upOf(q, out) { return out.copy(AY).applyQuaternion(q); }

// ------------------------------------------------------------ passo principale
function stepPlayer(dt) {
  P.landT += dt; P.popT += dt; P.safeT = Math.max(0, P.safeT - dt); P.railCool = Math.max(0, P.railCool - dt);
  P.sketchT = Math.max(0, P.sketchT - dt);
  if (P.mode === 'crash') { P.crashT += dt; return; }
  if (IN.cancel) { IN.cancel = false; P.jumpWas = false; P.chargeT = 0; P.charge = 0; P.prewind = 0; }
  // carica del salto (tasto tenuto)
  var canPop = P.mode === 'ground' || P.mode === 'rail';
  if (IN.jump && canPop && !P.butter) {
    P.chargeT += dt; P.charge = Math.min(1, P.chargeT / CHARGE_T);
    if (Math.abs(IN.sx) > 0.45) P.prewind = lerp(P.prewind, IN.sx, damp(8, dt)); else P.prewind *= 1 - damp(4, dt);
  }
  var released = P.jumpWas && !IN.jump;
  P.jumpWas = IN.jump;
  if (P.mode === 'ground') stepGround(dt, released);
  else if (P.mode === 'air') stepAir(dt, released);
  else if (P.mode === 'rail') stepRail(dt, released);
  if (!IN.jump) { P.chargeT = 0; P.charge = 0; if (P.mode !== 'ground') P.prewind = 0; }
  if (dist() > P.maxD) P.maxD = dist();
  comboTick(dt);
}

function comboTick(dt) {
  if (!CB.live) return;
  var busy = P.mode === 'air' || P.mode === 'rail' || !!P.butter;
  if (!busy) CB.timer -= dt;
  if (CB.timer <= 0) {
    var v = comboValue(), m = comboMult();
    EV.push({ t: 'bank', pts: v, mult: m, n: CB.parts.length, parts: CB.parts.slice() });
    var hist = CB.history; comboReset(); CB.history = hist;
  }
}
function comboLose(why) {
  if (CB.live && CB.parts.length) EV.push({ t: 'lost', pts: comboValue(), why: why });
  var hist = CB.history; comboReset(); CB.history = hist;
}

// ------------------------------------------------------------ a terra
function stepGround(dt, released) {
  var n = groundN(P.x, P.z, _n);
  P.n.lerp(n, damp(18, dt)).normalize();
  var vn = P.vx * n.x + P.vy * n.y + P.vz * n.z;
  if (vn < 0) { P.vx -= n.x * vn; P.vy -= n.y * vn; P.vz -= n.z * vn; } // se sta lasciando il terreno (lip) non si tocca
  var sp = speedOf();
  if (sp > 0.25) { var hl = Math.hypot(P.vx, P.vz); if (hl > 0.05) { P.hx = P.vx / hl; P.hz = P.vz / hl; } }
  var sens = save.set.sens;
  var sx = clamp(IN.sx * sens, -1, 1), sy = IN.sy;
  // pressione (nose / tail) e butter
  if (IN.press && !P.butter && sp < 24 && P.landT > 0.12) P.butter = { press: IN.press, spin: 0, t: 0, yaw0: P.yawOff };
  if (P.butter) {
    var B = P.butter; B.t += dt; if (IN.press) B.press = IN.press;
    var w = -sx * 6.2;
    B.spin += w * dt; P.yawOff += w * dt;
    if (!IN.press) endButter();
  }
  P.brake = !P.butter && sy < -0.35 ? clamp((-sy - 0.35) / 0.5, 0, 1) : 0;
  P.tuck = !P.butter && sy > 0.35 ? clamp((sy - 0.35) / 0.5, 0, 1) : 0;
  // sterzo: la velocita' ruota attorno alla normale
  if (!P.butter) {
    P.steer += (sx - P.steer) * damp(10, dt);
    var wmax = clamp(10.5 / Math.max(sp, 4.5), 0.55, 2.3) * (1 + P.brake * 0.35);
    var ang = -P.steer * wmax * dt;
    _a.set(P.vx, P.vy, P.vz).applyAxisAngle(n, ang);
    P.vx = _a.x; P.vy = _a.y; P.vz = _a.z;
    P.lean = lerp(P.lean, -P.steer * wmax * sp / G, damp(10, dt));
    // in frenata la tavola si mette di traverso
    var yt = P.brake ? (P.steer >= 0 ? 1 : -1) * 1.15 * P.brake * (P.sw ? -1 : 1) : 0;
    P.yawOff += (yt - P.yawOff) * damp(P.brake ? 9 : 7, dt);
  } else P.lean *= 1 - damp(6, dt);
  // forze: gravita' lungo il pendio, attrito, aria
  var gn = -G * n.y;
  P.vx += (-n.x * gn) * dt; P.vy += (-G - n.y * gn) * dt; P.vz += (-n.z * gn) * dt;
  sp = speedOf();
  var k = 0.0094 - 0.004 * P.tuck, skid = Math.abs(Math.sin(P.yawOff));
  var dec = 0.035 * G * n.y + k * sp * sp + P.brake * (5 + 0.25 * sp) + Math.abs(P.steer) * 0.5 + skid * (1.5 + 0.12 * sp);
  if (P.sketchT > 0) dec += 2.5;
  // sulla pista non ci si ferma mai del tutto
  var d = dist(), u = P.x - cx(d), onPiste = Math.abs(u) < halfW(d) + 1;
  var push = onPiste && sp < 7 && !P.brake && -P.vz > 0 ? 2.2 : 0;
  if (sp > 0.01) { var nsp = Math.max(0, sp - dec * dt); P.vx *= nsp / sp; P.vy *= nsp / sp; P.vz *= nsp / sp; }
  if (push) { P.vz -= push * dt; }
  if (sp < 1.5 && !onPiste) { P.vx += (cx(d) - P.x) * 0.15 * dt; P.vz -= 1.2 * dt; }
  // velocita' guidata verso i kicker: si arriva al lip alla velocita' per cui e' costruito l'atterraggio
  var kf = kickAhead(u, d);
  P.onKick = kf && d >= kf.d0 && d < kf.dLip ? kf : null;
  if (kf) {
    var K = kf.K, lo = K.vd - KV_LO, hi = K.vd + KV_HI, onRamp = d >= kf.d0;
    sp = speedOf();
    var want = clamp(sp, lo, hi);
    if (onRamp && kf.dLip - d < sp * dt * 2) want = clamp(sp, lo + 0.2, hi - 0.2);
    var rate = onRamp ? (kf.dLip - d < sp * dt * 2 ? 1e3 : 9) : 3.5;
    if (want !== sp && sp > 0.1) {
      var f = lerp(sp, want, damp(rate, dt)) / sp; P.vx *= f; P.vy *= f; P.vz *= f;
      if (want < sp) P.scrub = Math.min(1, (sp - want) * 0.4);
    }
    P.lipD = onRamp ? kf.dLip - d : null; P.kickTag = kf;
  } else P.lipD = null;
  // movimento
  var px = P.x, pz = P.z;
  P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
  var h = groundH(P.x, P.z);
  // salto (rilascio del tasto)
  if (released && !P.butter) { doPop(n, false); return; }
  if (P.y > h + 0.035) { takeoff(n); return; }
  P.y = h;
  var n2 = groundN(P.x, P.z, _n2), vin = P.vx * n2.x + P.vy * n2.y + P.vz * n2.z;
  if (vin < 0) {
    P.vx -= n2.x * vin; P.vy -= n2.y * vin; P.vz -= n2.z * vin;
    if (-vin > 7.5 && P.safeT <= 0) { crash('wall'); return; }
  }
  P.lastGround = 0;
  P.scrub *= 1 - damp(4, dt);
  // la tavola si riallinea alla marcia
  if (!P.butter && !P.brake && Math.abs(P.yawOff) > 0.001) P.yawOff *= 1 - damp(P.sketchT > 0 ? 3 : 9, dt);
  boardFrame(P.q, P.hx, P.hz, P.n, P.yawOff, P.sw);
  P.crouch = lerp(P.crouch, Math.max(P.charge * 0.9, P.tuck * 0.55, P.brake * 0.35, P.landT < 0.25 ? 0.7 * (1 - P.landT / 0.25) : 0), damp(14, dt));
  collideSolids();
  collideRails(false);
}

// il kicker davanti (entro 16 m dalla rampa) nella corsia del rider
function kickAhead(u, d) {
  var b0 = Math.floor((d - 2) / FB), b1 = Math.floor((d + 18) / FB), best = null;
  for (var b = b0; b <= b1; b++) {
    var list = W.fb[b]; if (!list) continue;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (f.t !== 'kick' || d > f.dLip || d < f.d0 - 16 || Math.abs(u - f.u) > f.hw) continue;
      if (!best || f.d0 < best.d0) best = f;
    }
  }
  return best;
}

function endButter() {
  var B = P.butter; P.butter = null;
  var y = wrapA(P.yawOff), k = Math.round(y / PI), res = y - k * PI;
  if (k % 2 !== 0) { P.sw = !P.sw; }
  P.yawOff = res;
  var deg = Math.floor(Math.abs(B.spin) / PI + 0.35) * 180, nm = (B.press > 0 ? 'Nose' : 'Tail');
  var name = deg > 0 ? nm + ' Butter ' + deg : B.t > 0.45 ? nm + ' Press' : '';
  if (Math.abs(res) > 0.75) { P.sketchT = 0.5; EV.push({ t: 'sketch', why: 'butter' }); }
  if (name) {
    var pts = deg > 0 ? Math.round(spinPts(deg) * 0.75 + 60 * B.t) : Math.round(70 + 110 * B.t);
    var r = comboAdd(name, pts, Math.abs(res) > 0.75 ? 'sketchy' : 'clean');
    EV.push({ t: 'trick', name: name, pts: r.pts, rep: r.rep, kind: 'butter' });
  }
}

// ollie: spinta lungo la normale; sul lip del kicker c'e' una spinta in piu'
function doPop(n, fromAir) {
  var c = P.charge, pop = POP_MIN + (POP_MAX - POP_MIN) * c, perfect = false;
  if (P.lipD !== null && P.lipD < 1.4 && P.lipD > -0.5) { pop += POP_LIP; perfect = P.lipD < 0.8; }
  if (fromAir) { pop *= 0.8; }
  P.vx += n.x * pop; P.vy += n.y * pop; P.vz += n.z * pop;
  P.popT = 0;
  EV.push({ t: 'pop', perfect: perfect, charge: c });
  if (!fromAir) takeoff(n, true);
  else if (P.air) P.air.popped = true;
}

function takeoff(n, popped) {
  if (P.butter) endButter();
  P.mode = 'air';
  var nose = noseOf(P.q, _a), sw = P.sw;
  var hl = Math.hypot(P.vx, P.vz) || 1;
  var hx = P.vx / hl, hz = P.vz / hl;
  // la tavola in aria: orientamento orizzontale della partenza, poi rotazioni (spin attorno a Y, flip attorno alla punta)
  var q0 = new Q4(); boardFrame(q0, hx, hz, AY, P.yawOff, sw);
  var tilt0 = new Q4().setFromUnitVectors(AY, P.n);
  P.air = {
    t: 0, spin: 0, flip: 0, ws: 0, wf: 0, yaw0: P.yawOff, sw0: sw, q0: q0, tilt0: tilt0, tilt: tilt0.clone(), grabs: [], grab: -1, grabT: 0,
    popped: !!popped, fromRail: P.rail ? P.rail.r : null, spinMul: 1 + 0.25 * Math.abs(P.prewind), y0: P.y, d0: dist(),
    kick: P.lipD !== null && P.lipD < 2.5 ? P.kickTag : null, landN: new V3(0, 1, 0), tLand: 1, hold: IN.jump && !popped
  };
  if (Math.abs(P.prewind) > 0.45) P.air.ws = -P.prewind * SPIN_MAX * 0.75;
  if (P.air.kick) EV.push({ t: 'lip', size: P.air.kick.size });
  P.coyote = popped ? 0 : 0.13; P.coyotePop = false;
  P.rail = null; P.butter = null; P.prewind = 0;
  // tasto tenuto oltre il lip: salta da solo
  if (!popped && IN.jump && P.chargeT > 0.08) { doPop(P.n, true); P.chargeT = 0; P.charge = 0; P.jumpWas = false; }
  EV.push({ t: 'takeoff' });
}

// ------------------------------------------------------------ in aria
function stepAir(dt, released) {
  var A = P.air; A.t += dt;
  // salto in ritardo (subito dopo il lip): vale ancora
  if (P.coyote > 0) {
    P.coyote -= dt;
    if (released && !A.popped) { doPop(P.n, true); A.popped = true; }
  }
  P.vy -= G * dt;
  var sp = speedOf(), drag = 0.0016 * sp * sp;
  if (sp > 0.1) { var f = Math.max(0, sp - drag * dt) / sp; P.vx *= f; P.vy *= f; P.vz *= f; }
  var py = P.y;
  P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
  airRotate(dt);
  airGrab(dt);
  airPose(dt);
  if (P.railCool <= 0 && tryRailLand(py)) return;
  collideRails(true, py);
  if (P.mode !== 'air') return;
  var h = groundH(P.x, P.z);
  if (P.y <= h) { P.y = h; land(); return; }
  collideSolids();
}

function airRotate(dt) {
  var A = P.air, sens = save.set.sens, as = assistLvl();
  var sx = clamp(IN.sx * sens, -1, 1), sy = clamp(IN.sy * sens, -1, 1) * (save.set.invFlip ? -1 : 1);
  var ss = stanceSign();
  // spin
  var yaw = A.yaw0 + A.spin;
  if (Math.abs(sx) > 0.22) {
    var tw = -sx * SPIN_MAX * A.spinMul;
    A.ws += (tw - A.ws) * damp(9, dt);
  } else if (as > 0) A.ws = settle(yaw, A.ws, PI, as, dt, 2.6);
  else A.ws *= 1 - damp(7, dt);
  // flip (positivo = in avanti)
  if (Math.abs(sy) > 0.3) {
    var tf = sy * FLIP_MAX;
    A.wf += (tf - A.wf) * damp(8, dt);
  } else if (as > 0) A.wf = settle(A.flip, A.wf, TAU, as, dt, 2.2);
  else A.wf *= 1 - damp(7, dt);
  A.spin += A.ws * dt; A.flip += A.wf * dt;
  // orientamento: inclinazione verso il pendio d'atterraggio * spin attorno a Y * partenza * flip attorno alla punta
  _q.setFromAxisAngle(AY, A.spin);
  _q2.setFromAxisAngle(AX, A.flip * ss);
  P.q.copy(A.tilt).multiply(_q).multiply(A.q0).multiply(_q2);
}
// aiuto all'atterraggio: a stick lasciato la rotazione finisce sulla posizione buona piu' vicina
function settle(ang, w, period, as, dt, minW) {
  var dir = Math.abs(w) > 1.2 ? sign(w) : 0, tgt;
  if (dir > 0) tgt = Math.ceil(ang / period - 0.04) * period;
  else if (dir < 0) tgt = Math.floor(ang / period + 0.04) * period;
  else tgt = Math.round(ang / period) * period;
  if (dir && Math.abs(tgt - ang) > period * 0.62 && Math.abs(w) < 4) tgt = Math.round(ang / period) * period;
  var err = tgt - ang, kp = as === 2 ? 13 : 8, lim = Math.max(Math.abs(w), minW);
  var wd = clamp(err * kp, -lim, lim);
  return w + (wd - w) * damp(as === 2 ? 12 : 7, dt);
}

function airGrab(dt) {
  var A = P.air, g = IN.grab;
  if (A.hold) { if (!IN.jump) A.hold = false; g = -1; } // il dito che teneva il salto non vale come grab
  if (g !== A.grab) {
    if (A.grab >= 0 && A.grabT > 0.05) A.grabs.push({ g: A.grab, t: A.grabT });
    A.grab = g; A.grabT = 0;
    if (g >= 0) EV.push({ t: 'grab', g: g });
  }
  if (A.grab >= 0) A.grabT += dt;
}

// l'inclinazione del corpo va verso la pendenza del punto in cui si atterrera'
var _pred = { x: 0, y: 0, z: 0, t: 0, n: new V3() };
function predictLanding(out) {
  var x = P.x, y = P.y, z = P.z, vx = P.vx, vy = P.vy, vz = P.vz, t = 0, h = 0;
  for (var i = 0; i < 160; i++) {
    var st = 0.025; vy -= G * st; x += vx * st; y += vy * st; z += vz * st; t += st;
    h = groundH(x, z);
    if (y <= h) break;
  }
  out.x = x; out.y = h; out.z = z; out.t = t;
  groundN(x, z, out.n);
  return out;
}
function airPose(dt) {
  var A = P.air;
  if (((A.t * 60) | 0) % 3 === 0 || A.t < 0.02) { predictLanding(_pred); A.landN.copy(_pred.n); A.tLand = _pred.t; A.landX = _pred.x; A.landZ = _pred.z; A.landY = _pred.y; }
  _q.setFromUnitVectors(AY, A.landN);
  var k = A.t / Math.max(0.05, A.t + A.tLand);
  A.tilt.copy(A.tilt0).slerp(_q, sm01(k * 1.4));
  P.crouch = lerp(P.crouch, A.grab >= 0 ? 1 : 0.35 + 0.25 * Math.min(1, Math.abs(A.ws) / 6), damp(10, dt));
}

function airOrientationError(n) {
  // inclinazione rispetto alla normale e scarto della punta rispetto alla direzione di marcia
  var up = upOf(P.q, _a), tilt = Math.acos(clamp(up.dot(n), -1, 1));
  var nose = noseOf(P.q, _b); nose.addScaledVector(n, -nose.dot(n));
  var nl = nose.length();
  _c.set(P.vx, P.vy, P.vz); _c.addScaledVector(n, -_c.dot(n)); var vl = _c.length();
  if (nl < 0.2 || vl < 0.2) return { tilt: tilt, yaw: PI / 2, sw: P.sw, yawS: 0 };
  nose.multiplyScalar(1 / nl); _c.multiplyScalar(1 / vl);
  var dot = nose.dot(_c), sw = dot < 0, crossY = _c.clone().cross(nose).dot(n);
  var yaw = Math.acos(clamp(Math.abs(dot), 0, 1));
  return { tilt: tilt, yaw: yaw, sw: sw, yawS: (sw ? -1 : 1) * sign(crossY) * yaw };
}

function land() {
  var A = P.air, n = groundN(P.x, P.z, _n);
  var e = airOrientationError(n), as = assistLvl();
  var vin = -(P.vx * n.x + P.vy * n.y + P.vz * n.z);
  var lim = as === 2 ? { tilt: 62, yaw: 62 } : as === 1 ? { tilt: 52, yaw: 54 } : { tilt: 42, yaw: 46 };
  var tiltD = e.tilt / DEG, yawD = e.yaw / DEG, grabbing = A.grab >= 0 && A.grabT > 0.08;
  if (A.grab >= 0 && A.grabT > 0.05) A.grabs.push({ g: A.grab, t: A.grabT });
  // atterraggio: rimuove la componente della velocita' nel terreno
  P.vx += n.x * vin; P.vy += n.y * vin; P.vz += n.z * vin;
  P.airTot += A.t;
  var why = '';
  if (tiltD > lim.tilt) why = Math.abs(wrapA(A.flip * stanceSign())) > PI / 2 ? 'head' : 'tilt';
  else if (yawD > lim.yaw) why = 'sideways';
  else if (vin > 14.5) why = 'hard';
  else if (grabbing && (vin > 9 || tiltD > lim.tilt * 0.6)) why = 'grab';
  if (why && P.safeT <= 0) { P.mode = 'ground'; crash(why); return; }
  var q = 'clean';
  if (tiltD < 14 && yawD < 11 && !grabbing && vin < 9) q = 'perfect';
  else if (tiltD > lim.tilt * 0.62 || yawD > lim.yaw * 0.55 || grabbing || vin > 11) q = 'sketchy';
  P.mode = 'ground'; P.sw = e.sw; P.yawOff = e.yawS; P.landT = 0; P.quality = q;
  var sp = speedOf(), loss = q === 'sketchy' ? 0.22 : q === 'clean' ? 0.06 : 0;
  loss += (1 - Math.cos(e.yaw)) * 0.6;
  if (sp > 0.1) { var f = 1 - clamp(loss, 0, 0.6); P.vx *= f; P.vy *= f; P.vz *= f; }
  if (q === 'sketchy') { P.sketchT = 0.6; P.wobble = 1; }
  P.n.copy(n);
  var hl = Math.hypot(P.vx, P.vz) || 1; P.hx = P.vx / hl; P.hz = P.vz / hl;
  // trick del salto
  var spinN = A.spin - (A.spinBase || 0), ss = stanceSign(), fs = spinN * ss * (A.sw0 ? -1 : 1) > 0;
  var tr = airTrick({ spin: spinN, flip: A.flip, sw0: A.sw0, grabs: A.grabs, air: A.t, fs: fs, fromRail: A.fromRail });
  var res = null;
  if (tr) res = comboAdd(tr.name, tr.pts, q);
  EV.push({ t: 'land', q: q, trick: tr, pts: res ? res.pts : 0, rep: res ? res.rep : 0, air: A.t, impact: vin, kick: A.kick ? A.kick.size : null });
  P.air = null; P.rail = null;
  P.crouch = 0.8;
}

// ------------------------------------------------------------ rail
function railCapture(r, phi) {
  var s = Math.abs(Math.sin(phi)), c = Math.abs(Math.cos(phi));
  return r.hw + 0.3 * s + 0.1 * c + RAIL_ASSIST;
}
function railExtent(r, phi) {
  var s = Math.abs(Math.sin(phi)), c = Math.abs(Math.cos(phi));
  return r.hw + 0.78 * s + 0.135 * c;
}
function yawToRail(nose, hx, hz) {
  return Math.atan2(-(hx * nose.z - hz * nose.x), hx * nose.x + hz * nose.z);
}
function tryRailLand(prevY) {
  if (P.vy > 0.6) return false;
  var list = railsNear(dist());
  for (var i = 0; i < list.length; i++) {
    var r = list[i], pr = railProject(r, P.x, P.z, _rp);
    if (!pr.over || pr.s < -0.05 || pr.s > r.len - 0.4) continue;
    var top = pr.y;
    if (prevY < top - 0.03 || P.y > top + 0.04) continue;     // deve arrivare da sopra
    var nose = noseOf(P.q, _a); nose.y = 0; nose.normalize();
    var phi = yawToRail(nose, pr.hx, pr.hz), w = Math.abs(pr.w);
    if (w > railCapture(r, phi)) continue;
    var up = upOf(P.q, _b);
    if (up.y < Math.cos(48 * DEG)) { crash('railhead'); return true; }
    mountRail(r, pr, phi);
    return true;
  }
  return false;
}
function mountRail(r, pr, phi) {
  var A = P.air, g = railPoint(r, pr.s, _pp);
  var vs = P.vx * g.dx + P.vy * g.dy + P.vz * g.dz;
  var snap = Math.round(phi / (PI / 2)) * (PI / 2);
  var spinOn = A ? Math.abs(A.spin) : 0;
  if (A && A.grab >= 0 && A.grabT > 0.05) A.grabs.push({ g: A.grab, t: A.grabT });
  P.mode = 'rail';
  P.rail = { r: r, s: pr.s, vs: Math.max(vs, 3), yaw: phi, yawT: snap, press: 0, t: 0, part: null, flick: 0, offW: -pr.w, offY: P.y - pr.y, sw: false };
  P.x = g.x; P.y = g.y; P.z = g.z;
  // il trick del salto prima del rail (es. 270 on)
  var on = '';
  if (A) {
    var deg = Math.round(spinOn / (PI / 2)) * 90;
    if (deg >= 180) on = deg + ' On ';
    var tr = airTrick({ spin: 0, flip: A.flip, sw0: A.sw0, grabs: A.grabs, air: A.t, fs: true });
    if (tr && tr.grabs) { var rr = comboAdd(tr.name, tr.pts, 'clean'); EV.push({ t: 'trick', name: tr.name, pts: rr.pts, rep: rr.rep, kind: 'air' }); }
    P.airTot += A.t;
  }
  P.air = null; P.butter = null; P.yawOff = 0;
  railPart(on);
  EV.push({ t: 'railOn', kind: r.kind, name: P.rail.part.name });
  P.landT = 0;
}
function railFront() {
  var R = P.rail, ss = stanceSign(), g = railPoint(R.r, R.s, _pp);
  var nose = noseOf(P.q, _a), up = upOf(P.q, _b), chest = _c.crossVectors(nose, up).multiplyScalar(ss);
  return chest.x * g.dx + chest.z * g.dz > 0;
}
function railPart(prefix) {
  var R = P.rail;
  if (R.part) closeRailPart();
  var nm = railTrickName(R.yawT, R.press, railFront(), R.r.kind);
  R.part = { name: (prefix || '') + nm.name, m: 0, t: 0, rate: nm.rate };
}
function closeRailPart() {
  var R = P.rail, p = R.part; if (!p) return;
  R.part = null;
  if (p.t < 0.12 && p.m < 0.6) return;
  var pts = Math.round(70 + p.rate * p.m);
  var r = comboAdd(p.name, pts, 'clean');
  EV.push({ t: 'trick', name: p.name, pts: r.pts, rep: r.rep, kind: 'rail', m: p.m });
}
function stepRail(dt, released) {
  var R = P.rail, r = R.r; R.t += dt;
  var g = railPoint(r, R.s, _pp);
  var slide = Math.abs(Math.sin(R.yawT)) > 0.7;
  var mu = (slide ? 0.13 : 0.06) * (r.kind === 'box' ? 1.15 : 1);
  var a = -G * g.dy - mu * G - 0.004 * R.vs * R.vs;
  R.vs += a * dt;
  R.s += R.vs * dt;
  if (R.part) { R.part.m += Math.abs(R.vs) * dt; R.part.t += dt; }
  // switch-up: un colpetto dello stick a destra o a sinistra gira la tavola di 90 gradi
  var sx = IN.sx;
  if (R.flick === 0 && Math.abs(sx) > 0.62 && R.t > 0.12) { R.flick = sign(sx); R.yawT -= sign(sx) * PI / 2; railPart(''); EV.push({ t: 'railSwitch', name: R.part.name }); }
  else if (R.flick !== 0 && Math.abs(sx) < 0.3) R.flick = 0;
  var pr = IN.press || 0;
  if (pr !== R.press) { R.press = pr; railPart(''); EV.push({ t: 'railSwitch', name: R.part.name }); }
  R.yaw += (R.yawT - R.yaw) * damp(16, dt);
  R.offW *= 1 - damp(14, dt); R.offY *= 1 - damp(14, dt);
  g = railPoint(r, R.s, _pp);
  P.x = g.x; P.y = g.y; P.z = g.z;
  P.vx = g.dx * R.vs; P.vy = g.dy * R.vs; P.vz = g.dz * R.vs;
  var hl = Math.hypot(g.dx, g.dz); P.hx = g.dx / hl; P.hz = g.dz / hl;
  // orientamento: la punta ruotata di yaw rispetto al rail, inclinata come il rail
  var c = Math.cos(R.yaw), s = Math.sin(R.yaw);
  var nx = P.hx * c + P.hz * s, nz = -P.hx * s + P.hz * c;
  _a.set(nx, 0, nz).normalize();
  var along = _a.x * P.hx + _a.z * P.hz;
  _a.y = g.dy / hl * along; _a.normalize();
  _c.crossVectors(_a, AY).normalize(); _b.crossVectors(_c, _a).normalize();
  if (R.press) { _q.setFromAxisAngle(_c, R.press * 0.16); _a.applyQuaternion(_q); _b.applyQuaternion(_q); }
  _m.makeBasis(_a, _b, _c); P.q.setFromRotationMatrix(_m);
  P.crouch = lerp(P.crouch, 0.45, damp(8, dt));
  if (released) { leaveRail(true); return; }
  if (R.s >= r.len || R.vs < 0.4) { leaveRail(false); return; }
}
function leaveRail(pop) {
  var R = P.rail;
  closeRailPart();
  P.mode = 'air';
  if (pop) { P.vy += POP_MIN + (POP_MAX - POP_MIN) * 0.55 * Math.max(0.4, P.charge); EV.push({ t: 'pop', perfect: false }); }
  var hl = Math.hypot(P.vx, P.vz) || 1, hx = P.vx / hl, hz = P.vz / hl;
  var q0 = new Q4(); boardFrame(q0, hx, hz, AY, 0, false);
  var tilt0 = new Q4();
  // la tavola parte ruotata come sul rail: lo spin parte da quell'angolo (per i nomi conta solo quello in piu')
  P.air = {
    t: 0, spin: R.yaw, spinBase: R.yaw, flip: 0, ws: 0, wf: 0, yaw0: 0, sw0: false, q0: q0, tilt0: tilt0, tilt: tilt0.clone(), grabs: [], grab: -1, grabT: 0,
    popped: pop, fromRail: R.r, spinMul: 1, y0: P.y, d0: dist(), kick: null, landN: new V3(0, 1, 0), tLand: 1, hold: false
  };
  P.railCool = 0.25;
  P.rail = null;
  EV.push({ t: 'railOff' });
}

// ------------------------------------------------------------ urti
function collideRails(air, prevY) {
  if (P.safeT > 0) return;
  var list = railsNear(dist());
  for (var i = 0; i < list.length; i++) {
    var r = list[i], pr = railProject(r, P.x, P.z, _rp);
    if (!pr.over || pr.s < 0 || pr.s > r.len) continue;
    if (P.y > pr.y - 0.06) continue;
    var w = Math.abs(pr.w);
    if (air && prevY !== undefined && prevY >= pr.y - 0.06) {
      // la tavola scende alla quota del rail senza essere agganciata: cade solo se ci finisce sopra con la punta o la coda
      var nose = noseOf(P.q, _a); nose.y = 0; nose.normalize();
      var phi = yawToRail(nose, pr.hx, pr.hz);
      if (w < r.hw + 0.85 * (railExtent(r, phi) - r.hw) && w > railCapture(r, phi) - 0.02) { crash('railtip'); return; }
      continue;
    }
    if (P.y < pr.y - 1.6) continue;
    // di lato: il bordo della tavola (in aria) o le gambe (a terra) toccano il rail
    if (w < r.hw + (air ? 0.12 : 0.17)) { crash('railhit'); return; }
  }
}
function collideSolids() {
  if (P.safeT > 0) return;
  var hit = null;
  solidsNear(P.x, P.z, 3, function (o, rad, kind) {
    if (hit) return;
    var dx = P.x - o.x, dz = P.z - o.z, rr = rad + 0.3;
    if (dx * dx + dz * dz < rr * rr && P.y < o.y + (kind === 'tree' ? 6 * o.s : o.s * 1.2)) hit = kind;
  });
  if (hit) crash(hit);
}

function crash(why) {
  if (P.mode === 'crash') return;
  if (P.rail) { P.rail = null; }
  P.mode = 'crash'; P.crashT = 0; P.crashWhy = why; P.butter = null;
  comboLose(why);
  EV.push({ t: 'crash', why: why, vx: P.vx, vy: P.vy, vz: P.vz });
}
function respawn() {
  var d = safeSpot(dist() + 12), u = 0;
  newPlayer(d, u, 10);
  P.safeT = 1.2;
  EV.push({ t: 'respawn' });
}
