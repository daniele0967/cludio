// ============================================================ POWDER RUN — base comune
// Funzioni di servizio, rumore procedurale, salvataggio e impostazioni.
// Questo file e world.js / physics.js / tricks.js non toccano la grafica:
// si possono caricare anche in Node per i test.
'use strict';
var PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
function sm01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function wrapA(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
function sign(v) { return v < 0 ? -1 : 1; }
function hash1(n) { n = n | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function hash2(i, j, s) { return hash1(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(s | 0, 83492791)); }
function vnoise1(x, seed) {
  var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash1(i * 7919 + seed * 104729), hash1((i + 1) * 7919 + seed * 104729), u) * 2 - 1;
}
function fbm1(x, seed) { return vnoise1(x, seed) * 0.6 + vnoise1(x * 2.13, seed + 3) * 0.28 + vnoise1(x * 4.37, seed + 7) * 0.12; }
function vnoise2(x, y, s) {
  var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  var a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function fbm2(x, y, s, oct) {
  var a = 0, amp = 0.5, f = 1, n = oct || 4;
  for (var i = 0; i < n; i++) { a += vnoise2(x * f, y * f, s + i * 17) * amp; f *= 2.03; amp *= 0.5; }
  return a;
}
function ridge2(x, y, s, oct) {
  var a = 0, amp = 0.5, f = 1, n = oct || 5, w = 1;
  for (var i = 0; i < n; i++) {
    var v = 1 - Math.abs(vnoise2(x * f, y * f, s + i * 31)); v *= v; v *= w; w = clamp(v * 1.6, 0, 1);
    a += v * amp; f *= 2.07; amp *= 0.5;
  }
  return a;
}
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function fmt(n) {
  n = Math.round(n); var s = String(Math.abs(n)), out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  return (n < 0 ? '-' : '') + s + out;
}
function $(id) { return document.getElementById(id); }
function pick(R, arr) { return arr[Math.floor(R() * arr.length) % arr.length]; }
function wpick(R, w) { // w: { chiave: peso }
  var tot = 0, k; for (k in w) tot += Math.max(0, w[k]);
  var r = R() * tot; for (k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; }
  return k;
}

// ============================================================ salvataggio (ponte con Scriptable)
var SAVE_KEY = 'powderrun_freeride_v2';
var save = {
  best: 0, bestZen: 0, bestCombo: 0, bestDist: 0, runs: 0, totalTricks: 0, tutDone: false,
  set: { stance: 'regular', assist: 1, sens: 1, invFlip: false, quality: 'auto', sound: true, music: true, hud: true, outfit: 0, board: 0, light: 'mattina', cam: 1 }
};
(function () {
  var raw = typeof window !== 'undefined' ? window.__INITIAL_SAVE__ : null;
  if (!raw && typeof localStorage !== 'undefined') { try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {} }
  if (raw) {
    try {
      var d = JSON.parse(raw);
      for (var k in d) if (k !== 'set') save[k] = d[k];
      if (d.set) for (var s in d.set) save.set[s] = d.set[s];
    } catch (e) {}
  }
})();
var saveResolver = null, pendingSave = null;
function persist() {
  var data = JSON.stringify(save);
  if (typeof localStorage !== 'undefined') { try { localStorage.setItem(SAVE_KEY, data); } catch (e) {} }
  if (saveResolver) { var r = saveResolver; saveResolver = null; r(data); } else pendingSave = data;
}
if (typeof window !== 'undefined') {
  window.__waitSave = function (cb) {
    if (pendingSave) { var d = pendingSave; pendingSave = null; cb(d); return; }
    saveResolver = cb;
  };
}
