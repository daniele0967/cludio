// ============================================================ MONDO
// Pista infinita descritta in coordinate (u, d): d = distanza percorsa (z = -d),
// u = scostamento laterale dal centro della pista. L'altezza del terreno e':
//   profilo longitudinale(d) + sezione trasversale(u, d) + ostacoli(u, d)
// Il profilo e' generato a blocchi insieme agli ostacoli, cosi' i kicker hanno
// atterraggi costruiti apposta per le velocita' con cui ci si arriva.
var G = 11;            // gravita' (m/s^2): un po' piu' della vera, salti meno lenti
var PSTEP = 0.5;       // passo del profilo longitudinale (m)
var KS = 0.25;         // passo dei profili dei kicker (m)
var LANE = 7;          // distanza tra le corsie della pista (m)
var FB = 16;           // dimensione dei secchielli per cercare gli ostacoli (m)

var W = null;          // stato del mondo

function newWorld(seed, mode) {
  W = {
    seed: seed, R: rng(seed), mode: mode,
    prof: {}, pd: -240, py: 0, pa: 0.1,
    feats: [], fb: {}, rails: [], rb: {}, deco: [], sections: [],
    blocks: {}, level: 0, tutI: 0, nid: 1, lastType: '', startD: 0
  };
  // profilo prima del punto di partenza: piano leggero, poi la partenza vera
  var y = 0; W.py = 60 * 0.12;
  for (var d = -240; d < 0; d += PSTEP) { profSet(d, W.py - (d + 240) * 0.03); }
  W.pd = 0; W.py = profGet(-PSTEP) - 0.03 * PSTEP; W.pa = Math.atan(0.03);
  profSet(0, W.py);
  return W;
}

// ------------------------------------------------------------ profilo longitudinale
function profIdx(d) { return Math.round(d / PSTEP); }
function profSet(d, y) {
  var i = profIdx(d), b = Math.floor(i / 256), blk = W.prof[b];
  if (!blk) { blk = W.prof[b] = new Float64Array(256); blk.fill(NaN); }
  blk[i - b * 256] = y;
}
function profGetI(i) {
  var b = Math.floor(i / 256), blk = W.prof[b];
  var v = blk ? blk[i - b * 256] : NaN;
  if (v === v) return v;
  var dd = i * PSTEP;
  if (dd >= W.pd) return W.py - Math.tan(W.pa) * (dd - W.pd);
  return W.py + (W.pd - dd) * 0.1;
}
function profGet(d) { return profGetI(profIdx(d)); }
function cr(p0, p1, p2, p3, t) { // Catmull-Rom: curva liscia tra i campioni (niente spigoli ogni mezzo metro)
  var t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}
function profY(d) {
  var f = d / PSTEP, i = Math.floor(f), t = f - i;
  return cr(profGetI(i - 1), profGetI(i), profGetI(i + 1), profGetI(i + 2), t);
}
// aggiunge un tratto in cui l'angolo di discesa passa da a0 ad a1 (radianti, positivo = in discesa)
function profAngle(len, a0, a1, wav) {
  var n = Math.round(len / PSTEP), y = W.py;
  for (var k = 1; k <= n; k++) {
    var t = (k - 0.5) / n, a = a0 + (a1 - a0) * sm01(t);
    if (wav) a += wav.amp * Math.sin((k - 0.5) * PSTEP / wav.len * TAU);
    y -= Math.tan(a) * PSTEP;
    profSet(W.pd + k * PSTEP, y);
  }
  W.pd += n * PSTEP; W.py = y; W.pa = a1;
}
// scrive campioni gia' calcolati (ys a passo KS, dal punto attuale)
function profWriteKS(ys, endA) {
  var len = (ys.length - 1) * KS, n = Math.floor(len / PSTEP);
  for (var k = 1; k <= n; k++) {
    var s = k * PSTEP, f = s / KS, i = Math.floor(f), t = f - i;
    var y = ys[i] + ((ys[Math.min(i + 1, ys.length - 1)] - ys[i]) * t);
    profSet(W.pd + s, y);
  }
  W.py = profGet(W.pd + n * PSTEP); W.pd += n * PSTEP; W.pa = endA;
}

// ------------------------------------------------------------ centro pista e sezione trasversale
function cx(d) {
  var m = sm01((d - 60) / 220);
  return m * (26 * fbm1(d * 0.0017 + 3.1, 11) + 5 * vnoise1(d * 0.0061, 5));
}
function halfW(d) { return 16 + 1.5 * vnoise1(d * 0.013, 21); }
function crossH(u, d) {
  var a = u < 0 ? -u : u, W0 = halfW(d);
  if (a <= W0) return 0;
  var e = a - W0;
  var h = 1.5 * sm01(e / 6);
  if (e > 4) h += 0.2 * Math.pow(e - 4, 1.28);
  if (e > 10) {
    var m = Math.min(1, (e - 10) / 45), s = u < 0 ? 3 : 4;
    h += m * (7 * fbm2(u * 0.02, d * 0.02, s, 4) + 4);
    if (e > 50) h += Math.min(1, (e - 50) / 60) * 26 * ridge2(u * 0.009, d * 0.009, s + 9, 4);
  }
  return h;
}

// ------------------------------------------------------------ ostacoli nel terreno (kicker, rampe dei rail)
function featAdd(f) {
  f.id = W.nid++;
  W.feats.push(f);
  for (var b = Math.floor(f.d0 / FB); b <= Math.floor(f.d1 / FB); b++) (W.fb[b] || (W.fb[b] = [])).push(f);
  return f;
}
function featOff(f, u, d) {
  var s = d - f.d0, o;
  if (s < 0 || d > f.d1) return 0;
  if (f.t === 'kick') {
    var x = s / KS, i = Math.floor(x), t = x - i, arr = f.off, n = arr.length - 1;
    if (i >= n) return 0;
    var a1 = arr[i], a2 = arr[i + 1];
    // sul lip (salto di pendenza) niente smussatura, altrove curva liscia
    if (i >= f.iLip - 1 && i <= f.iLip) o = a1 + (a2 - a1) * t;
    else o = cr(i > 0 ? arr[i - 1] : a1, a1, a2, i + 2 <= n ? arr[i + 2] : a2, t);
  } else if (f.t === 'lead') {
    var r = s / (f.d1 - f.d0); o = f.h0 * Math.pow(r, 1.5);
  } else if (f.t === 'bump') {
    var r2 = s / (f.d1 - f.d0); o = f.h * r2 * r2;
  } else return 0;
  if (o <= 0) return 0;
  var e = Math.abs(u - f.u) - f.hw;
  if (e <= 0) return o;
  o -= f.k * e;
  return o > 0 ? o : 0;
}
function featH(u, d) {
  var list = W.fb[Math.floor(d / FB)];
  if (!list) return 0;
  var h = 0;
  for (var i = 0; i < list.length; i++) { var o = featOff(list[i], u, d); if (o > h) h = o; }
  return h;
}
function featAt(u, d) { // il kicker sotto il punto (per la velocita' guidata sulla rampa)
  var list = W.fb[Math.floor(d / FB)];
  if (!list) return null;
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    if (d >= f.d0 && d <= f.d1 && Math.abs(u - f.u) < f.hw + 0.5) return f;
  }
  return null;
}

// ------------------------------------------------------------ altezza e normale del terreno
function baseH(x, z) { var d = -z, u = x - cx(d); return profY(d) + crossH(u, d); }
function groundH(x, z) { var d = -z, u = x - cx(d); return profY(d) + crossH(u, d) + featH(u, d); }
function groundN(x, z, out) {
  var e = 0.09;
  var hx = groundH(x + e, z) - groundH(x - e, z), hz = groundH(x, z + e) - groundH(x, z - e);
  var nx = -hx, ny = 2 * e, nz = -hz, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
  out.x = nx / l; out.y = ny / l; out.z = nz / l;
  return out;
}

// ------------------------------------------------------------ kicker progettati sulla traiettoria
var KICKS = {
  S: { name: 'S', h: 0.8, th: 10, vd: 10.5, hw: 2.6 },
  M: { name: 'M', h: 1.25, th: 13, vd: 12.5, hw: 3.0 },
  L: { name: 'L', h: 1.75, th: 16, vd: 14.5, hw: 3.5 },
  XL: { name: 'XL', h: 2.3, th: 19, vd: 16.5, hw: 4.0 }
};
var POP_MAX = 2.4;     // spinta massima dell'ollie (m/s, lungo la normale)
var POP_LIP = 0.5;     // spinta in piu' se si salta proprio sul lip
var KV_LO = 1.2, KV_HI = 0.8; // sulla rampa la velocita' viene portata in [vd - KV_LO, vd + KV_HI]
// integra un programma di angoli: [[lunghezza, angolo iniziale, angolo finale], ...] (gradi rispetto all'orizzontale, + = sale)
function angleProg(segs, ys0) {
  var ys = ys0 || [0], y = ys[ys.length - 1], sub = 4;
  segs.forEach(function (g) {
    var n = Math.max(1, Math.round(g[0] / KS));
    for (var k = 0; k < n; k++) {
      for (var j = 0; j < sub; j++) {
        var t = (k + (j + 0.5) / sub) / n, a = (g[1] + (g[2] - g[1]) * sm01(t)) * DEG;
        y += Math.tan(a) * KS / sub;
      }
      ys.push(y);
    }
  });
  return ys;
}
function sampleKS(ys, s) {
  var x = s / KS, i = Math.floor(x);
  if (i < 0) return ys[0] + s * (ys[1] - ys[0]) / KS;
  if (i >= ys.length - 1) { var n = ys.length - 1; return ys[n] + (s - n * KS) * (ys[n] - ys[n - 1]) / KS; }
  return ys[i] + (ys[i + 1] - ys[i]) * (x - i);
}
// La rampa sale con curvatura costante fino al lip; il tavolo segue il pendio; l'atterraggio
// e' costruito passo per passo: in ogni punto ha la pendenza della traiettoria che ci arriva,
// meno 3 gradi, cosi' l'urto resta piccolo per tutte le velocita' e le spinte possibili.
function designKicker(sz, alphaDeg) {
  var a = alphaDeg, th = sz.th, h = sz.h, I = 0, N = 64;
  for (var i = 0; i < N; i++) { var p = (-a + (th + a) * (i + 0.5) / N) * DEG; I += (Math.tan(p) + Math.tan(a * DEG)) / N; }
  // con l'angolo che varia a "smoothstep" l'altezza media e' quasi la stessa: si corregge con due iterazioni
  var Lr = h / I;
  for (var it = 0; it < 3; it++) { var tr = angleProg([[Lr, -a, th]]); var hh = tr[tr.length - 1] + Lr * Math.tan(a * DEG); Lr *= h / hh; }
  var ys = angleProg([[Lr, -a, th]]), sl = (ys.length - 1) * KS, yl = ys[ys.length - 1];
  var thr = th * DEG, vLo = sz.vd - KV_LO, vHi = sz.vd + KV_HI, popM = POP_MAX + POP_LIP;
  function tv(e) { var v = vLo + (vHi - vLo) * e, pop = popM * e; return [v * Math.cos(thr) - pop * Math.sin(thr), v * Math.sin(thr) + pop * Math.cos(thr)]; }
  function yAt(e, s) { var T = tv(e), t = (s - sl) / T[0]; return yl + T[1] * t - 0.5 * G * t * t; }
  function angAt(e, s) { var T = tv(e), t = (s - sl) / T[0]; return Math.atan2(T[1] - G * t, T[0]) / DEG; }
  var ma = Math.tan(a * DEG), sLo = sl + 1;
  while (yAt(0, sLo) > yl - ma * (sLo - sl) && sLo < sl + 80) sLo += KS;
  var sKn = Math.max(sl + 1.5, sLo - 2.2);
  ys = angleProg([[sKn - sl, -a, -a]], ys);
  var s = (ys.length - 1) * KS, y = ys[ys.length - 1], ang = -a, KN = 3.5, sweet = 0;
  while (s < sKn + 200) {
    var sn = s + KS, target;
    if (yAt(1, sn) < y - 0.05) break; // anche il salto piu' lungo e' gia' atterrato
    if (yAt(0, sn) >= y) target = angAt(0, sn) + 3;
    else {
      var lo = 0, hi = 1;
      for (var k = 0; k < 22; k++) { var m = (lo + hi) / 2; if (yAt(m, sn) > y) hi = m; else lo = m; }
      target = angAt((lo + hi) / 2, sn) + 3;
      if (!sweet && lo > 0.3) sweet = sn;
    }
    target = clamp(target, -44, -a);
    var want = sn - sKn < KN ? lerp(-a, target, sm01((sn - sKn) / KN)) : target;
    ang += clamp(want - ang, -5 * KS, 5 * KS);
    y += Math.tan(ang * DEG) * KS; ys.push(y); s = sn;
  }
  var sLand = sKn + KN, sLandE = s, beta = -ang, gam = Math.max(4, a - 5);
  ys = angleProg([[14, -beta, -gam], [10, -gam, -gam], [8, -gam, -a]], ys);
  var S = ys;
  // il terreno intorno segue la linea d'ingresso fino a poco prima del knuckle, poi scende e si unisce all'atterraggio
  var sJoin = sLand + (sLandE - sLand) * 0.3, yJ = sampleKS(S, sJoin);
  var mJ = (sampleKS(S, sJoin + 0.25) - sampleKS(S, sJoin - 0.25)) / 0.5, m0 = -ma;
  var sB = Math.max(sl + 1, sKn - 7), yB = -ma * sB, Lh = sJoin - sB;
  var base = new Float64Array(S.length);
  for (var q = 0; q < S.length; q++) {
    var sq = q * KS;
    if (sq >= sJoin) { base[q] = S[q]; continue; }
    if (sq <= sB) { base[q] = Math.min(-ma * sq, S[q]); continue; }
    var t = (sq - sB) / Lh, t2 = t * t, t3 = t2 * t;
    base[q] = Math.min((2 * t3 - 3 * t2 + 1) * yB + (t3 - 2 * t2 + t) * Lh * m0 + (-2 * t3 + 3 * t2) * yJ + (t3 - t2) * Lh * mJ, S[q]);
  }
  var off = new Float32Array(S.length);
  for (q = 0; q < S.length; q++) off[q] = Math.max(0, S[q] - base[q]);
  for (q = Math.round(sJoin / KS); q < off.length; q++) off[q] = 0;
  return { sz: sz, S: S, base: base, off: off, len: (S.length - 1) * KS, sLip: sl, sKn: sKn, sLand: sLand, sLandE: sLandE,
    sJoin: sJoin, sSweet: sweet || sLand + 3, th: th, beta: beta, alpha: a, Lr: Lr, vd: sz.vd, endA: a };
}
// traiettoria dal lip: punti (s, y, angolo di volo in gradi, tempo)
function flight(s0, y0, v, thDeg, pop, tmax) {
  var th = thDeg * DEG, vx = v * Math.cos(th) - pop * Math.sin(th), vy = v * Math.sin(th) + pop * Math.cos(th);
  var pts = [], dt = 1 / 120;
  for (var t = 0; t < (tmax || 6); t += dt) pts.push([s0 + vx * t, y0 + vy * t - 0.5 * G * t * t, Math.atan2(vy - G * t, vx) / DEG, t]);
  return pts;
}
function hitSurf(pts, ys) {
  for (var i = 1; i < pts.length; i++) { var p = pts[i]; if (p[1] <= sampleKS(ys, p[0])) return p; }
  return null;
}
// controlla un progetto: per varie velocita' e spinte, dove si atterra e con che urto
function checkKicker(K) {
  var res = [];
  [-KV_LO, -0.5, 0, 0.5, KV_HI].forEach(function (dv) {
    [0, POP_MAX * 0.5, POP_MAX + POP_LIP].forEach(function (pop) {
      var tr = flight(K.sLip, K.S[Math.round(K.sLip / KS)], K.vd + dv, K.th, pop), p = hitSurf(tr, K.S);
      if (!p) { res.push({ dv: dv, pop: pop, miss: true }); return; }
      var s = p[0], sa = Math.atan((sampleKS(K.S, s + 0.1) - sampleKS(K.S, s - 0.1)) / 0.2) / DEG;
      var th = K.th * DEG, v = K.vd + dv, vx = v * Math.cos(th) - pop * Math.sin(th), vy = v * Math.sin(th) + pop * Math.cos(th) - G * p[3];
      var sp = Math.hypot(vx, vy);
      res.push({ dv: dv, pop: +pop.toFixed(1), s: +s.toFixed(1), zone: s < K.sKn ? 'tavolo' : s < K.sLand ? 'knuckle' : s < K.sLandE ? 'atterraggio' : 'fondo',
        impact: +(sp * Math.sin((sa - p[2]) * DEG)).toFixed(2), surf: +sa.toFixed(0), fl: +p[2].toFixed(0), air: +p[3].toFixed(2) });
    });
  });
  return res;
}
// ------------------------------------------------------------ rail e box
// La linea superiore e' una spezzata di punti (u, d, h sopra la neve).
function railAdd(r) {
  r.id = W.nid++;
  var pts = r.raw.map(function (q) {
    var d = q[1], u = q[0], x = cx(d) + u, y = profY(d) + crossH(u, d) + q[2];
    return { x: x, y: y, z: -d, d: d, u: u, h: q[2] };
  });
  var segs = [], L = 0;
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    segs.push({ a: a, b: b, s0: L, len: l, dx: dx / l, dy: dy / l, dz: dz / l });
    L += l;
  }
  r.pts = pts; r.segs = segs; r.len = L; r.d0 = pts[0].d; r.d1 = pts[pts.length - 1].d;
  W.rails.push(r);
  for (var b2 = Math.floor((r.d0 - 6) / FB); b2 <= Math.floor((r.d1 + 2) / FB); b2++) (W.rb[b2] || (W.rb[b2] = [])).push(r);
  return r;
}
function railsNear(d) { return W.rb[Math.floor(d / FB)] || []; }
// punto della linea del rail alla distanza s dall'inizio
function railPoint(r, s, out) {
  s = clamp(s, 0, r.len);
  for (var i = 0; i < r.segs.length; i++) {
    var g = r.segs[i];
    if (s <= g.s0 + g.len || i === r.segs.length - 1) {
      var t = (s - g.s0);
      out.x = g.a.x + g.dx * t; out.y = g.a.y + g.dy * t; out.z = g.a.z + g.dz * t;
      out.dx = g.dx; out.dy = g.dy; out.dz = g.dz; out.seg = i;
      return out;
    }
  }
  return out;
}
// proiezione orizzontale di (x,z) sulla linea del rail: s lungo il rail, w laterale (+ a destra)
function railProject(r, x, z, out) {
  var best = 1e9;
  for (var i = 0; i < r.segs.length; i++) {
    var g = r.segs[i], hx = g.dx, hz = g.dz, hl = Math.sqrt(hx * hx + hz * hz); hx /= hl; hz /= hl;
    var px = x - g.a.x, pz = z - g.a.z, along = px * hx + pz * hz, segH = g.len * hl;
    var t = clamp(along, 0, segH), w = px * (-hz) + pz * hx;
    var ex = along < 0 ? -along : along > segH ? along - segH : 0, dist = Math.abs(w) + ex * 4;
    if (dist < best) {
      best = dist;
      out.s = g.s0 + t / hl; out.w = -w; out.along = along; out.over = along >= -0.05 && along <= segH + 0.05;
      out.hx = hx; out.hz = hz; out.y = g.a.y + g.dy * (t / hl); out.seg = i; out.first = i === 0; out.last = i === r.segs.length - 1; out.alongRaw = along; out.segH = segH;
    }
  }
  return out;
}

// ------------------------------------------------------------ alberi e rocce (per blocchi di 64 m, deterministici)
var BLOCK = 64, CHUNK = 64;
function blockData(bi) {
  var B = W.blocks[bi];
  if (B) return B;
  var R = rng(W.seed * 131 + bi * 7919 + 17), trees = [], rocks = [], d0 = bi * BLOCK;
  for (var i = 0; i < 300; i++) {
    var side = R() < 0.5 ? -1 : 1, d = d0 + R() * BLOCK, W0 = halfW(d);
    var e = 4 + Math.pow(R(), 1.35) * 170, u = side * (W0 + e);
    var dens = 0.55 + 0.45 * fbm2(u * 0.03, d * 0.03, 77, 3) * 1.6 - Math.max(0, (e - 120) / 90);
    if (e < 9) dens -= 0.35;
    if (R() > dens) continue;
    if (d < 40 && Math.abs(u) < 40) continue;
    var x = cx(d) + u, y = profY(d) + crossH(u, d);
    var steep = crossH(u + 1, d) - crossH(u - 1, d);
    if (Math.abs(steep) > 2.4 && R() < 0.8) continue;
    var s = 0.75 + R() * 0.7 + (e > 30 ? 0.25 : 0);
    trees.push({ x: x, y: y, z: -d, s: s, v: Math.floor(R() * 3), r: R() * TAU, u: u, d: d });
  }
  for (i = 0; i < 40; i++) {
    var side2 = R() < 0.5 ? -1 : 1, dd = d0 + R() * BLOCK, ee = 3 + Math.pow(R(), 0.9) * 200, uu = side2 * (halfW(dd) + ee);
    if (ee < 25 && R() < 0.7) continue;
    var st = Math.abs(crossH(uu + 1, dd) - crossH(uu - 1, dd));
    if (st < 0.8 && R() < 0.6) continue;
    rocks.push({ x: cx(dd) + uu, y: profY(dd) + crossH(uu, dd), z: -dd, s: 0.5 + Math.pow(R(), 2) * (ee > 40 ? 5 : 1.6), r: R() * TAU, t: R() * TAU, u: uu, d: dd });
  }
  B = W.blocks[bi] = { trees: trees, rocks: rocks };
  return B;
}
// ostacoli solidi vicini (alberi e rocce), per gli urti
function solidsNear(x, z, rad, cb) {
  var d = -z, b0 = Math.floor((d - rad) / BLOCK), b1 = Math.floor((d + rad) / BLOCK);
  for (var b = b0; b <= b1; b++) {
    var B = blockData(b);
    for (var i = 0; i < B.trees.length; i++) { var t = B.trees[i]; if (Math.abs(t.z - z) < rad && Math.abs(t.x - x) < rad) cb(t, 0.32 * t.s, 'tree'); }
    for (i = 0; i < B.rocks.length; i++) { var r = B.rocks[i]; if (Math.abs(r.z - z) < rad + r.s && Math.abs(r.x - x) < rad + r.s) cb(r, r.s * 0.8, 'rock'); }
  }
}

// ------------------------------------------------------------ generatore delle sezioni
function difficulty(d) { return clamp((d - 300) / 3500, 0, 1); }
function genUntil(dTarget) { var guard = 0; while (W.pd < dTarget && guard++ < 50) nextSection(); }
function decoAdd(o) { o.id = W.nid++; W.deco.push(o); return o; }

function secCruise(len, aEnd, wav) {
  var a = W.pa;
  profAngle(len, a, aEnd !== undefined ? aEnd : (11 + W.R() * 3) * DEG, wav);
  W.sections.push({ t: 'cruise', d0: W.pd - len, d1: W.pd });
}
function runIn(len, aDeg) { profAngle(len, W.pa, aDeg * DEG); }

function secKick(sizeName, lanes, tag) {
  var aDeg = 12;
  runIn(18 + W.R() * 6, aDeg);
  var K = designKicker(KICKS[sizeName], aDeg), d0 = W.pd;
  var ys = []; for (var k = 0; k < K.base.length; k++) ys.push(W.py + K.base[k]);
  var y0 = W.py;
  lanes.forEach(function (u) {
    var f = featAdd({ t: 'kick', d0: d0, d1: d0 + K.sJoin + 0.5, u: u, hw: KICKS[sizeName].hw, k: 1.25, off: K.off, K: K, size: sizeName, iLip: Math.round(K.sLip / KS),
      dLip: d0 + K.sLip, dKn: d0 + K.sKn, dLand: d0 + K.sLand, dLandE: d0 + K.sLandE, y0: y0, tag: tag || '' });
    decoAdd({ t: 'kickflags', f: f });
  });
  profWriteKS(ys, aDeg * DEG);
  W.sections.push({ t: 'kick', d0: d0, d1: W.pd, size: sizeName });
  return K;
}

// tipi di rail: profilo in [lunghezza, altezza all'inizio, altezza alla fine, forma]
function railSpec(type, R) {
  switch (type) {
    case 'box': return { kind: 'box', hw: 0.27, L: 9 + R() * 4, h0: 0.45, h1: 0.45, entry: 'direct' };
    case 'boxdown': return { kind: 'box', hw: 0.27, L: 9 + R() * 3, h0: 0.75, h1: 0.3, entry: 'direct' };
    case 'rainbow': return { kind: 'box', hw: 0.27, L: 10 + R() * 3, h0: 0.45, h1: 0.45, arc: 0.7, entry: 'direct' };
    case 'rail': return { kind: 'rail', hw: 0.035, L: 9 + R() * 5, h0: 0.55, h1: 0.55, entry: 'direct' };
    case 'raildown': return { kind: 'rail', hw: 0.035, L: 9 + R() * 4, h0: 0.62, h1: 0.3, entry: 'ollie' };
    case 'kink': return { kind: 'rail', hw: 0.035, L: 12 + R() * 4, h0: 0.7, h1: 0.3, kink: 0.45, entry: 'direct' };
    case 'long': return { kind: 'rail', hw: 0.035, L: 17 + R() * 5, h0: 0.6, h1: 0.6, entry: 'direct' };
    default: return { kind: 'box', hw: 0.27, L: 10, h0: 0.45, h1: 0.45, entry: 'direct' };
  }
}
function placeRail(type, u, dStart) {
  var R = W.R, sp = railSpec(type, R), raw = [], n = sp.arc || sp.kink ? 8 : 1;
  for (var i = 0; i <= n; i++) {
    var t = i / n, h = sp.h0 + (sp.h1 - sp.h0) * t;
    if (sp.arc) h = sp.h0 + sp.arc * Math.sin(t * PI);
    if (sp.kink) h = t < sp.kink ? sp.h0 : sp.h0 + (sp.h1 - sp.h0) * (t - sp.kink) / (1 - sp.kink);
    raw.push([u, dStart + sp.L * t, h]);
  }
  if (sp.kink) raw = [raw[0], [u, dStart + sp.L * sp.kink, sp.h0], raw[raw.length - 1]];
  var lead = null;
  if (sp.entry === 'direct') lead = featAdd({ t: 'lead', d0: dStart - 3.6 - sp.h0 * 2, d1: dStart, u: u, hw: sp.kind === 'box' ? 0.62 : 0.5, k: 1.4, h0: sp.h0 });
  else featAdd({ t: 'bump', d0: dStart - 5.4, d1: dStart - 2.4, u: u, hw: 0.8, k: 1.4, h: 0.38 });
  var r = railAdd({ kind: sp.kind, type: type, hw: sp.hw, raw: raw, entry: sp.entry, lead: lead, col: Math.floor(R() * 4) });
  return r;
}
function secRails(rows) {
  var R = W.R, lvl = W.level;
  runIn(14, 10);
  for (var row = 0; row < rows; row++) {
    var lanes = R() < 0.35 ? [0] : R() < 0.6 ? [-LANE, LANE] : [-LANE, 0, LANE];
    var pool = lvl < 0.25 ? ['box', 'box', 'rail', 'boxdown', 'rainbow'] : ['box', 'boxdown', 'rainbow', 'rail', 'raildown', 'kink', 'long', 'rail'];
    var d0 = W.pd + 6, maxL = 0;
    profAngle(4, W.pa, 10 * DEG);
    // il profilo sotto i rail deve esistere prima di posarli: si genera il tratto e poi si posano
    var len = 26;
    profAngle(len, 10 * DEG, 10 * DEG);
    lanes.forEach(function (u) {
      var tp = W.tutForce || pick(R, pool), r = placeRail(tp, u + (R() - 0.5) * 0.8, d0 + 2);
      maxL = Math.max(maxL, r.d1 - d0);
    });
    if (maxL + 8 > len + 4) profAngle(maxL + 8 - len, 10 * DEG, 10 * DEG);
  }
  W.sections.push({ t: 'rails', d0: W.pd - 40, d1: W.pd });
}
function secRollers() {
  runIn(10, 11);
  profAngle(6 * 6, 11 * DEG, 11 * DEG, { amp: 9 * DEG, len: 9 });
  W.sections.push({ t: 'rollers', d0: W.pd - 36, d1: W.pd });
}

var TUT_SEQ = ['cruise', 'kickS', 'cruise', 'kickM', 'box', 'kickM', 'rail', 'kickL', 'rollers', 'box', 'kickM', 'line'];
function nextSection() {
  var R = W.R, d = W.pd;
  W.level = difficulty(d);
  if (d < 1) { secCruise(70, 11 * DEG); return; }
  var t;
  if (W.mode === 'tutorial') { t = TUT_SEQ[W.tutI % TUT_SEQ.length]; W.tutI++; }
  else {
    var lvl = W.level;
    t = wpick(R, { cruise: 0.5, kickS: 1.2 - lvl, kickM: 1.6, kickL: 0.6 + 1.2 * lvl, kickXL: 0.15 + 0.9 * lvl, line: 1.6 + lvl, rails: 2.4, rollers: 0.6, double: 0.9 });
    if (t === W.lastType && (t === 'rails' || t === 'kickXL')) t = 'line';
  }
  W.lastType = t;
  switch (t) {
    case 'cruise': secCruise(30 + R() * 30); break;
    case 'kickS': secKick('S', [laneFor(R)]); break;
    case 'kickM': secKick('M', [laneFor(R)]); break;
    case 'kickL': secKick('L', [0]); break;
    case 'kickXL': secKick('XL', [0], 'big'); break;
    case 'double': { var sz = R() < 0.5 ? 'S' : 'M'; secKick(sz, [-LANE * 0.75, LANE * 0.75]); break; }
    case 'line': {
      var lv = W.level, sizes = lv < 0.3 ? ['S', 'M', 'M'] : lv < 0.7 ? ['M', 'L', 'L'] : ['L', 'L', 'XL'];
      var n = 2 + (R() < 0.6 ? 1 : 0);
      for (var i = 0; i < n; i++) secKick(sizes[Math.min(i, sizes.length - 1)], [0]);
      break;
    }
    case 'rails': secRails(R() < 0.5 ? 1 : 2); break;
    case 'box': W.tutForce = 'box'; secRails(1); W.tutForce = null; break;
    case 'rail': W.tutForce = 'rail'; secRails(1); W.tutForce = null; break;
    case 'rollers': secRollers(); break;
  }
  if (W.mode !== 'tutorial' && R() < 0.35) secCruise(10 + R() * 14);
}
function laneFor(R) { var r = R(); return r < 0.5 ? 0 : r < 0.75 ? -LANE * 0.7 : LANE * 0.7; }

// pulizia di quello che e' ormai lontano alle spalle
function pruneWorld(dBehind) {
  var lim = dBehind;
  W.feats = W.feats.filter(function (f) { return f.d1 > lim; });
  W.rails = W.rails.filter(function (r) { return r.d1 > lim; });
  W.deco = W.deco.filter(function (o) { return (o.f ? o.f.d1 : o.d1 || o.d || 0) > lim; });
  var bl = Math.floor(lim / FB) - 1, k;
  for (k in W.fb) if (+k < bl) delete W.fb[k];
  for (k in W.rb) if (+k < bl) delete W.rb[k];
  for (k in W.blocks) if (+k < Math.floor(lim / BLOCK) - 1) delete W.blocks[k];
  var pb = Math.floor(profIdx(lim - 200) / 256);
  for (k in W.prof) if (+k < pb) delete W.prof[k];
}
// un punto tranquillo dove far ripartire il rider dopo una caduta
function safeSpot(dFrom) {
  for (var d = dFrom; d < dFrom + 400; d += 2) {
    var ok = true;
    for (var k = -18; k <= 30 && ok; k += 2) {
      var list = W.fb[Math.floor((d + k) / FB)];
      if (list) for (var i = 0; i < list.length; i++) { var f = list[i]; if (d + k >= f.d0 - 2 && d + k <= f.d1 + 2) { ok = false; break; } }
      var rl = W.rb[Math.floor((d + k) / FB)];
      if (rl) for (i = 0; i < rl.length; i++) { var r = rl[i]; if (d + k >= r.d0 - 8 && d + k <= r.d1 + 2) { ok = false; break; } }
    }
    if (ok) return d;
  }
  return dFrom;
}
