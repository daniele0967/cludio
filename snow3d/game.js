// POWDER RUN 3D — gioco di snowboard infinito (Three.js)
(function () {
'use strict';

// ============================================================ utilità
var TAU = Math.PI * 2, PI = Math.PI;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function wrapA(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
function sm01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function hash1(n) { n = n | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function hash2(i, j, s) { return hash1(i * 73856093 ^ j * 19349663 ^ s * 83492791); }
function vnoise(x, seed) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i * 7919 + seed * 104729), hash1((i + 1) * 7919 + seed * 104729), u) * 2 - 1; }
function fbm(x, seed) { return vnoise(x, seed) * 0.6 + vnoise(x * 2.1, seed + 3) * 0.28 + vnoise(x * 4.3, seed + 7) * 0.12; }
function vnoise2(x, y, s) {
  var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  var a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return (lerp(lerp(a, b, u), lerp(c, d, u), v)) * 2 - 1;
}
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fmt(n) { n = Math.round(n); var s = String(Math.abs(n)), out = ''; while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); } return (n < 0 ? '-' : '') + s + out; }
function $(id) { return document.getElementById(id); }
function now() { return performance.now(); }

// ============================================================ salvataggio (ponte con Scriptable)
var SAVE_KEY = 'powderrun3d_v1';
var save = { best: 0, runs: 0, tut: 0, mute: false, bestDist: 0 };
(function () {
  var raw = window.__INITIAL_SAVE__;
  if (!raw) { try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {} }
  if (raw) { try { var d = JSON.parse(raw); for (var k in d) save[k] = d[k]; } catch (e) {} }
})();
var saveResolver = null, pendingSave = null;
function persist() {
  var data = JSON.stringify(save);
  try { localStorage.setItem(SAVE_KEY, data); } catch (e) {}
  if (saveResolver) { var r = saveResolver; saveResolver = null; r(data); } else pendingSave = data;
}
window.__waitSave = function (cb) {
  if (pendingSave) { var d = pendingSave; pendingSave = null; cb(d); return; }
  saveResolver = cb;
};

// ============================================================ costanti
var G = 24, MAXS = 33, FIX = 1 / 120, CH_L = 60, SL = 0.27;
var GRAB_NAMES = { method: 'Method', indy: 'Indy' };

// ============================================================ renderer e scena
var canvas = $('game'), renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loading').textContent = 'Questo dispositivo non supporta il 3D (WebGL).';
  throw e;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
scene.fog = new THREE.Fog(0xd6e8f8, 45, 210);
var W = 0, H_ = 0;
function resize() {
  W = window.innerWidth; H_ = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H_, false);
  camera.aspect = W / H_;
  var vf = 2 * Math.atan(Math.tan(33 * PI / 180) / camera.aspect) * 180 / PI;
  camera.fov = clamp(vf, 56, 92);
  camera.updateProjectionMatrix();
}

// ---- luci
var hemi = new THREE.HemisphereLight(0xdceeff, 0x8aa4c4, 1.2);
scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff3d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
var sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 90;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---- cielo
var skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color(0x3a86d8) }, bot: { value: new THREE.Color(0xcfe6fa) }, sunC: { value: new THREE.Color(0xfff3d6) }, sunD: { value: new THREE.Vector3(0.3, 0.6, 0.7) } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 sunC; uniform vec3 sunD; varying vec3 vDir;\n' +
    'void main(){ vec3 d = normalize(vDir); float h = clamp(d.y * 1.6 + 0.1, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.75));\n' +
    'float s = max(dot(d, normalize(sunD)), 0.0); c += sunC * (smoothstep(0.9985, 0.9992, s) * 1.6 + pow(s, 14.0) * 0.35);\n' +
    'gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  side: THREE.BackSide, depthWrite: false, fog: false
});
var sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
sky.renderOrder = -10;
scene.add(sky);
var starGeo = new THREE.BufferGeometry(), starPos = [];
for (var si = 0; si < 700; si++) {
  var th = Math.random() * TAU, ph = Math.acos(Math.random() * 0.9 + 0.05);
  starPos.push(Math.sin(ph) * Math.cos(th) * 560, Math.cos(ph) * 560, Math.sin(ph) * Math.sin(th) * 560);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
var starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
var stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ---- texture disegnate su canvas
function canvasTex(w, h, draw, repeat) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
var snowTex = canvasTex(128, 128, function (c, w, h) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  for (var x = 0; x < w; x += 8) { c.fillStyle = 'rgba(150,180,215,0.10)'; c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x + 4, 0, 1, h); }
  for (var i = 0; i < 900; i++) { var a = Math.random() * 0.12; c.fillStyle = 'rgba(120,150,200,' + a + ')'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  for (var j = 0; j < 140; j++) { c.fillStyle = 'rgba(255,255,255,1)'; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
}, true);
var coinTex = canvasTex(128, 128, function (c) {
  var g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,220,110,.9)'); g.addColorStop(0.45, 'rgba(255,200,60,.35)'); g.addColorStop(1, 'rgba(255,200,60,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  c.translate(64, 64); c.lineCap = 'round';
  for (var i = 0; i < 6; i++) {
    c.save(); c.rotate(i * PI / 3);
    c.lineWidth = 7; c.strokeStyle = '#ffb81f'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -34); c.moveTo(0, -20); c.lineTo(11, -31); c.moveTo(0, -20); c.lineTo(-11, -31); c.stroke();
    c.lineWidth = 2.6; c.strokeStyle = '#fffbe8'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -32); c.stroke();
    c.restore();
  }
  c.fillStyle = '#fffbe8'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
});
var puffTex = canvasTex(128, 128, function (c) {
  for (var k = 0; k < 7; k++) {
    var x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 26 + Math.random() * 26;
    var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
});
var dotTex = canvasTex(32, 32, function (c) {
  var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
});
var poleTex = canvasTex(8, 64, function (c) { for (var i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#141a26' : '#ff5a36'; c.fillRect(0, i * 8, 8, 8); } });
var boardTex = canvasTex(256, 64, function (c) {
  c.fillStyle = '#12b3c4'; c.fillRect(0, 0, 256, 64);
  c.fillStyle = '#0b2a4a'; c.fillRect(0, 0, 256, 6); c.fillRect(0, 58, 256, 6);
  c.fillStyle = '#ffcf3f'; c.beginPath(); c.moveTo(60, 64); c.lineTo(110, 0); c.lineTo(126, 0); c.lineTo(76, 64); c.fill();
  c.beginPath(); c.moveTo(130, 64); c.lineTo(180, 0); c.lineTo(196, 0); c.lineTo(146, 64); c.fill();
  c.fillStyle = '#ff5a36'; c.fillRect(20, 26, 22, 12); c.fillRect(214, 26, 22, 12);
});
var goggleTex = canvasTex(64, 32, function (c) {
  var g = c.createLinearGradient(0, 0, 64, 32); g.addColorStop(0, '#ff7a00'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#58d8ff');
  c.fillStyle = g; c.fillRect(0, 0, 64, 32);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(6, 5, 22, 4);
});

// ---- materiali
var M = {
  snow: new THREE.MeshLambertMaterial({ map: snowTex, vertexColors: true }),
  kicker: new THREE.MeshLambertMaterial({ map: snowTex, vertexColors: true }),
  tree: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  rock: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  metal: new THREE.MeshPhongMaterial({ color: 0xc8d2e0, shininess: 90, specular: 0xffffff }),
  dark: new THREE.MeshLambertMaterial({ color: 0x2a3140 }),
  boxBlue: new THREE.MeshLambertMaterial({ color: 0x2c62c9 }),
  boxTop: new THREE.MeshLambertMaterial({ color: 0xffcf3f }),
  pole: new THREE.MeshLambertMaterial({ map: poleTex }),
  flagO: new THREE.MeshLambertMaterial({ color: 0xff5a36, side: THREE.DoubleSide }),
  flagB: new THREE.MeshLambertMaterial({ color: 0x2c62c9, side: THREE.DoubleSide }),
  mount: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
};
var coinMat = new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthWrite: false });

// ---- geometrie riusabili
function mergeColored(parts) {
  var pos = [], nor = [], col = [];
  parts.forEach(function (pt) {
    var g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo;
    g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos.push(x, y, z); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      var c = pt.color(x, y, z, n.getY(i));
      col.push(c.r, c.g, c.b);
    }
  });
  var out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
var C_GREEN = new THREE.Color(0x24524a), C_GREEN2 = new THREE.Color(0x2f6656), C_SNOW = new THREE.Color(0xf4f8ff), C_TRUNK = new THREE.Color(0x5a3a26);
var C_ROCK = new THREE.Color(0x5c6a7e), C_ROCK2 = new THREE.Color(0x77849a);
function pineGeo() {
  var parts = [{ geo: new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6).translate(0, 0.7, 0), color: function () { return C_TRUNK; } }];
  var tiers = [[1.7, 2.3, 1.1], [1.3, 2.1, 2.3], [0.9, 1.9, 3.4], [0.5, 1.4, 4.4]];
  tiers.forEach(function (t, k) {
    var g = new THREE.ConeGeometry(t[0], t[1], 7, 1).translate(0, t[2] + t[1] / 2, 0);
    var top = t[2] + t[1];
    parts.push({ geo: g, color: function (x, y, z, ny) { return (y > top - t[1] * 0.42 && ny > 0.2) || (ny > 0.6) ? C_SNOW : (k % 2 ? C_GREEN2 : C_GREEN); } });
  });
  return mergeColored(parts);
}
function rockGeo() {
  var g = new THREE.DodecahedronGeometry(1, 0);
  var p = g.attributes.position;
  for (var i = 0; i < p.count; i++) { var s = 0.8 + hash1(Math.round(p.getX(i) * 100) * 7 + Math.round(p.getY(i) * 100) * 13 + Math.round(p.getZ(i) * 100)) * 0.4; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.75, p.getZ(i) * s); }
  return mergeColored([{ geo: g, color: function (x, y, z, ny) { return ny > 0.55 && y > 0.1 ? C_SNOW : (y > -0.2 ? C_ROCK2 : C_ROCK); } }]);
}
var GEO = {
  pine: pineGeo(), rock: rockGeo(),
  pole: new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6).translate(0, 0.9, 0),
  flag: (function () { var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.75, 0, 0.75, 1.55, 0, 0, 1.3, 0], 3)); g.computeVertexNormals(); return g; })(),
  post: new THREE.CylinderGeometry(0.045, 0.045, 1, 6).translate(0, 0.5, 0)
};

// ============================================================ palette (giorno → tramonto → notte → alba)
var PALS = [
  { skyT: 0x3a86d8, skyB: 0xd2e8fb, fog: 0xd6e8f8, sun: 0xfff3d6, sunI: 2.7, hemiS: 0xdceeff, hemiG: 0x8aa4c4, hemiI: 1.25, mtn: 0xb3cbe6, mtnS: 0xffffff, star: 0, sd: [0.25, 0.55, 0.8] },
  { skyT: 0x2b2f78, skyB: 0xffab74, fog: 0xebb9a2, sun: 0xffa868, sunI: 2.1, hemiS: 0xffd7c2, hemiG: 0x6c5a8a, hemiI: 1.0, mtn: 0x9c7aa0, mtnS: 0xffd9c8, star: 0.15, sd: [0.55, 0.16, 0.8] },
  { skyT: 0x030817, skyB: 0x1a2a5a, fog: 0x1c2a54, sun: 0xaec0ff, sunI: 1.0, hemiS: 0x6880c8, hemiG: 0x1a2240, hemiI: 0.85, mtn: 0x26365f, mtnS: 0x7d92c4, star: 1, sd: [-0.35, 0.5, 0.8] },
  { skyT: 0x4466ae, skyB: 0xffcfb0, fog: 0xefd6cf, sun: 0xffd2a8, sunI: 2.2, hemiS: 0xe8e0ff, hemiG: 0x7a7aa8, hemiI: 1.1, mtn: 0xa2a4cc, mtnS: 0xfff0ea, star: 0.2, sd: [-0.55, 0.22, 0.8] }
];
var PALC = PALS.map(function (p) { var o = {}; for (var k in p) o[k] = (typeof p[k] === 'number' && k !== 'sunI' && k !== 'hemiI' && k !== 'star') ? new THREE.Color(p[k]) : p[k]; return o; });
var pal = { skyT: new THREE.Color(), skyB: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), mtn: new THREE.Color(), mtnS: new THREE.Color(), sunI: 0, hemiI: 0, star: 0, sd: [0, 0, 0] };
function updatePalette(m) {
  var t = Math.max(0, m) / 1500, i = Math.floor(t) % 4, f = t - Math.floor(t);
  f = sm01((f - 0.72) / 0.28);
  var A = PALC[i], B = PALC[(i + 1) % 4];
  for (var k in pal) {
    if (pal[k] instanceof THREE.Color) pal[k].copy(A[k]).lerp(B[k], f);
    else if (k === 'sd') { for (var j = 0; j < 3; j++) pal.sd[j] = lerp(A.sd[j], B.sd[j], f); }
    else pal[k] = lerp(A[k], B[k], f);
  }
  skyMat.uniforms.top.value.copy(pal.skyT); skyMat.uniforms.bot.value.copy(pal.skyB); skyMat.uniforms.sunC.value.copy(pal.sun);
  skyMat.uniforms.sunD.value.set(pal.sd[0], pal.sd[1], pal.sd[2]);
  scene.fog.color.copy(pal.fog);
  sun.color.copy(pal.sun); sun.intensity = pal.sunI;
  hemi.color.copy(pal.hemiS); hemi.groundColor.copy(pal.hemiG); hemi.intensity = pal.hemiI;
  starMat.opacity = pal.star;
  mountMatUpdate();
}

// ---- montagne lontane (seguono il giocatore)
var mountains = new THREE.Group();
scene.add(mountains);
(function buildMountains() {
  var pos = [], col = [], low = new THREE.Color(1, 1, 1), hi = new THREE.Color(1, 1, 1);
  var R = rng(77);
  function peak(ang, dist, rad, h) {
    var cx = Math.sin(ang) * dist, cz = Math.cos(ang) * dist, seg = 9;
    var ring = [];
    for (var i = 0; i < seg; i++) { var a = i / seg * TAU, rr = rad * (0.7 + R() * 0.5); ring.push([cx + Math.cos(a) * rr, -10, cz + Math.sin(a) * rr]); }
    var mid = []; for (var j = 0; j < seg; j++) { var a2 = (j + 0.5) / seg * TAU, r2 = rad * (0.35 + R() * 0.2); mid.push([cx + Math.cos(a2) * r2, h * (0.5 + R() * 0.15), cz + Math.sin(a2) * r2]); }
    var top = [cx + (R() - 0.5) * rad * 0.2, h, cz + (R() - 0.5) * rad * 0.2];
    function tri(a, b, c) { [a, b, c].forEach(function (v) { pos.push(v[0], v[1], v[2]); var t = clamp((v[1] - h * 0.42) / (h * 0.35), 0, 1); col.push(t, t, t); }); }
    for (var k = 0; k < seg; k++) { var k2 = (k + 1) % seg; tri(ring[k], mid[k], ring[k2]); tri(ring[k2], mid[k], mid[k2]); tri(mid[k], top, mid[k2]); }
  }
  for (var n = 0; n < 26; n++) {
    var ang = (n / 26 - 0.5) * 3.6 + (R() - 0.5) * 0.15;
    peak(ang, 430 + R() * 90, 70 + R() * 70, 90 + R() * 130);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.userData.base = col.slice();
  var mesh = new THREE.Mesh(g, M.mount);
  mesh.renderOrder = -5;
  mountains.add(mesh);
  mountains.userData.mesh = mesh;
})();
var lastMtn = '';
function mountMatUpdate() {
  var key = pal.mtn.getHexString() + pal.mtnS.getHexString();
  if (key === lastMtn) return; lastMtn = key;
  var g = mountains.userData.mesh.geometry, base = g.userData.base, c = g.attributes.color, tmp = new THREE.Color();
  for (var i = 0; i < c.count; i++) { tmp.copy(pal.mtn).lerp(pal.mtnS, base[i * 3]); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  c.needsUpdate = true;
}

// ============================================================ mondo: forma della pista
var S, P, AV, combo, state = 'menu', stateT = 0;
function cxAt(z) { return 26 * fbm(z * 0.0035, 3) + 7 * vnoise(z * 0.011, 9); }
function hwAt(z) { return 14.5 + 3 * vnoise(z * 0.007, 5); }
function dropOff(z) {
  var a = S.drops; if (!a.length || z < a[0].z0) return 0;
  var lo = 0, hi = a.length - 1;
  while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (a[mid].z0 <= z) lo = mid; else hi = mid - 1; }
  var d = a[lo], t = z - d.z0;
  return d.cum + d.D * sm01(t / 1.4) + d.L * sm01((t - 1.4) / 16);
}
function rollOff(z) {
  var s = 0, a = S.rollers;
  for (var i = 0; i < a.length; i++) { var r = a[i]; if (z > r.z0 && z < r.z0 + r.len) s += r.A * Math.sin((z - r.z0) / r.lam * TAU) * Math.sin(PI * (z - r.z0) / r.len); }
  return s;
}
function terrainH(x, z) {
  var cx = cxAt(z), e = Math.abs(x - cx) - hwAt(z);
  var h = -SL * z - 9 * fbm(z * 0.006, 1) - dropOff(z) + rollOff(z);
  h += (0.07 + 0.9 * clamp(e / 25, 0, 1)) * vnoise2(x * 0.08, z * 0.08, 4);
  if (e > 0) h += 0.3 * e + 0.012 * e * e;
  return h;
}
function kickRise(k, x, z) {
  if (z < k.z0 || z > k.z1 + 1.0) return 0;
  var f = 1 - sm01((Math.abs(x - k.x) - k.w) / 0.7); if (f <= 0) return 0;
  var r; if (z <= k.z1) { var t = (z - k.z0) / k.L; r = k.Hk * t * t; } else r = k.Hk * (1 - (z - k.z1) / 1.0);
  return r * f;
}
function Hgt(x, z) {
  var h = terrainH(x, z), a = S.kickers;
  for (var i = 0; i < a.length; i++) { var k = a[i]; if (z >= k.z0 && z <= k.z1 + 1) h += kickRise(k, x, z); }
  return h;
}
function normalAt(x, z, out) {
  var e = 0.25, hx = (Hgt(x + e, z) - Hgt(x - e, z)) / (2 * e), hz = (Hgt(x, z + e) - Hgt(x, z - e)) / (2 * e);
  out.set(-hx, 1, -hz).normalize();
  return out;
}

// ============================================================ generazione dei tratti di pista
function R() { return S.rand(); }
function diff(z) { return clamp((z - S.diffStart) / 3500, 0, 1); }
function addObj(o, z) { o.userData.z = z; scene.add(o); S.objs.push(o); return o; }
function addCoin(x, y, z) {
  var s = new THREE.Sprite(coinMat); s.scale.set(1.0, 1.0, 1); s.position.set(x, y, z);
  s.userData.coin = { x: x, y: y, z: z, taken: 0, ph: Math.random() * 6 };
  addObj(s, z); S.coins.push(s);
}
function coinLine(z0, n, xFn, lift) {
  for (var i = 0; i < n; i++) { var z = z0 + i * 3.2, x = xFn(i, z); addCoin(x, Hgt(x, z) + 1.0 + (lift || 0), z); }
}
function addFlag(x, z, blue) {
  var g = new THREE.Group(); var y = Hgt(x, z);
  var pole = new THREE.Mesh(GEO.pole, M.pole); g.add(pole);
  var fl = new THREE.Mesh(GEO.flag, blue ? M.flagB : M.flagO); g.add(fl); g.userData.flag = fl;
  g.position.set(x, y, z);
  addObj(g, z); S.flags.push(g);
}
function kickerMesh(k) {
  var nx = 22, nz = 30, x0 = k.x - k.w - 0.8, x1 = k.x + k.w + 0.8, z0 = k.z0 - 0.3, z1 = k.z1 + 1.15;
  var pos = [], col = [], uv = [], idx = [], lip = new THREE.Color(k.big ? 0xff6a3d : 0x3d7bff), pack = new THREE.Color(0xe9f1fb), side = new THREE.Color(0xd2e0f0);
  for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
    var x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz), r = kickRise(k, x, z), h = terrainH(x, z);
    var y = r > 0.01 ? h + r + 0.03 : h - 0.12;
    pos.push(x, y, z); uv.push(x * 0.35, z * 0.35);
    var c = (z > k.z1 - 0.45 && z <= k.z1 + 0.05 && Math.abs(x - k.x) < k.w) ? lip : (z > k.z1 + 0.05 ? side : pack);
    col.push(c.r, c.g, c.b);
  }
  for (var jj = 0; jj < nz; jj++) for (var ii = 0; ii < nx; ii++) { var a = jj * (nx + 1) + ii, b = a + 1, c2 = a + nx + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  var m = new THREE.Mesh(g, M.kicker); m.castShadow = true; m.receiveShadow = true;
  m.userData.own = true;
  return m;
}
function secKickers(z) {
  var d = diff(z), n = 1 + Math.floor(R() * 2.4), zz = z;
  for (var i = 0; i < n; i++) {
    var cx = cxAt(zz), x = cx + (R() - 0.5) * (i === 0 ? 7 : 16), Hk = 1.35 + R() * 0.6 + d * 0.35, L = 5.2 + R() * 1.4, w = 2.1 + R() * 0.8;
    var k = { x: x, z0: zz, L: L, z1: zz + L, Hk: Hk, w: w, big: false };
    S.kickers.push(k);
    addObj(kickerMesh(k), k.z1 + 2);
    arcCoins(k, 20 + d * 4);
    zz += 26 + R() * 14;
  }
  return zz;
}
function secBig(z) {
  var d = diff(z), cx = cxAt(z + 8), Hk = 3.2 + R() * 0.8 + d * 0.6, L = 9 + R() * 1.2;
  var k = { x: cx + (R() - 0.5) * 6, z0: z, L: L, z1: z + L, Hk: Hk, w: 3, big: true };
  S.kickers.push(k);
  addDrop(k.z1 + 3, 0.2, 3.5 + d * 1.5);
  addObj(kickerMesh(k), k.z1 + 2);
  addFlag(k.x - k.w - 0.6, k.z1 - 0.2, false); addFlag(k.x + k.w + 0.6, k.z1 - 0.2, false);
  arcCoins(k, 22 + d * 4);
  return k.z1 + 40;
}
function arcCoins(k, v) {
  var lipY = Hgt(k.x, k.z1 - 0.01), s = 2 * k.Hk / k.L - SL, vy = v * s / Math.sqrt(1 + s * s), vz = v / Math.sqrt(1 + s * s);
  var lift = R() < 0.5 ? 0 : 1.6;
  for (var i = 1; i <= 7; i++) {
    var t = 0.1 + i * 0.12, z = k.z1 + vz * t, y = lipY + vy * t - 0.5 * G * t * t + 1.0 + lift;
    if (y < Hgt(k.x, z) + 1.2) break;
    addCoin(k.x, y, z);
  }
}
function addDrop(z0, D, L) {
  var last = S.drops.length ? S.drops[S.drops.length - 1] : null;
  S.drops.push({ z0: z0, D: D, L: L, cum: last ? last.cum + last.D + last.L : 0 });
}
function secDrop(z) {
  var d = diff(z), D = 3 + R() * 3 + d * 4, z0 = z + 12;
  addDrop(z0, D, 3.5);
  var cx = cxAt(z0), hw = hwAt(z0);
  for (var i = -2; i <= 2; i++) addFlag(cx + i * hw * 0.45, z0 - 1.2, i % 2 === 0);
  coinLine(z0 - 12, 3, function () { return cx; }, 0);
  for (var j = 1; j <= 5; j++) { var zz = z0 + j * 3.6; addCoin(cx, Hgt(cx, z0 - 0.5) + 1.4 - j * j * 0.25, zz); }
  return z0 + 34;
}
function railMesh(r) {
  var g = new THREE.Group();
  var len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1);
  var mid = new THREE.Vector3((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, (r.z1 + r.z2) / 2);
  var dir = new THREE.Vector3(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
  var body;
  if (r.kind === 'box') {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, len), M.boxBlue);
    var top = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, len), M.boxTop); top.position.y = 0.15; body.add(top);
    body.position.copy(mid).add(new THREE.Vector3(0, -0.15, 0));
  } else {
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 10).rotateX(PI / 2), M.metal);
    body.position.copy(mid);
  }
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  body.castShadow = true;
  g.add(body);
  for (var t = 0.06; t <= 1; t += 0.22) {
    var x = lerp(r.x1, r.x2, t), z = lerp(r.z1, r.z2, t), y = lerp(r.y1, r.y2, t), gy = terrainH(x, z);
    var p = new THREE.Mesh(GEO.post, M.dark); p.position.set(x, gy - 0.1, z); p.scale.y = Math.max(0.1, y - gy + 0.05); p.castShadow = true; g.add(p);
  }
  g.userData.own = true;
  return g;
}
function secRails(z) {
  var n = 1 + (R() < 0.35 ? 1 : 0), zz = z;
  for (var i = 0; i < n; i++) {
    var cx = cxAt(zz), x = cx + (R() - 0.5) * 12, L = 11 + R() * 8, kind = R() < 0.5 ? 'rail' : 'box', h = kind === 'box' ? 0.55 : 0.8;
    var x2 = x + (R() - 0.5) * 2.5;
    var r = { x1: x, z1: zz, x2: x2, z2: zz + L, kind: kind, h: h };
    r.y1 = terrainH(x, zz) + h; r.y2 = terrainH(x2, zz + L) + h;
    r.yaw = Math.atan2(r.x2 - r.x1, r.z2 - r.z1);
    S.rails.push(r);
    addObj(railMesh(r), r.z2 + 2);
    for (var t = 0.15; t < 1; t += 0.17) addCoin(lerp(r.x1, r.x2, t), lerp(r.y1, r.y2, t) + 1.0, lerp(r.z1, r.z2, t));
    zz += L + 18 + R() * 10;
  }
  return zz;
}
function secRocks(z) {
  var d = diff(z), len = 60 + R() * 30, n = Math.round(4 + d * 10 + R() * 3);
  for (var i = 0; i < n; i++) {
    var zz = z + R() * len, cx = cxAt(zz), hw = hwAt(zz), x = cx + (R() * 2 - 1) * (hw - 1.5), r = 0.55 + R() * 0.75;
    var m = new THREE.Mesh(GEO.rock, M.rock); m.scale.set(r * 1.2, r, r * 1.1); m.rotation.y = R() * TAU;
    m.position.set(x, terrainH(x, zz) + r * 0.15, zz); m.castShadow = true; m.receiveShadow = true;
    addObj(m, zz); S.rocks.push({ x: x, z: zz, r: r * 1.05, h: r * 0.95 });
  }
  if (R() < 0.6) coinLine(z + 8, 8, function (i, zz) { return cxAt(zz) + Math.sin(i * 0.7) * 4; }, 0);
  return z + len + 12;
}
function secTrees(z) {
  var d = diff(z), len = 70, n = Math.round(4 + d * 9);
  for (var i = 0; i < n; i++) {
    var zz = z + (i + R() * 0.6) * len / n, cx = cxAt(zz), hw = hwAt(zz), x = cx + (R() * 2 - 1) * (hw - 2), s = 0.8 + R() * 0.5;
    var m = new THREE.Mesh(GEO.pine, M.tree); m.scale.setScalar(s); m.rotation.y = R() * TAU; m.position.set(x, terrainH(x, zz) - 0.2, zz); m.castShadow = true;
    addObj(m, zz); S.rocks.push({ x: x, z: zz, r: 0.75, h: 5.5 * s, tree: true });
  }
  coinLine(z + 5, 10, function (i, zz) { return cxAt(zz) + Math.sin(i * 0.9 + z) * 6; }, 0);
  return z + len + 12;
}
function secRollers(z) {
  var len = 40 + R() * 30, lam = 9 + R() * 4, A = 0.55 + R() * 0.45 + diff(z) * 0.2;
  S.rollers.push({ z0: z, len: len, lam: lam, A: A });
  coinLine(z + lam * 0.75, 6, function (i, zz) { return cxAt(zz); }, 0.8);
  return z + len + 10;
}
function secCruise(z) {
  var len = 45 + R() * 40, off = (R() - 0.5) * 14;
  if (R() < 0.75) coinLine(z + 8, 9, function (i, zz) { return cxAt(zz) + off + Math.sin(i * 0.6) * 3; }, 0);
  return z + len;
}
var SECTIONS = { cruise: secCruise, kicker: secKickers, big: secBig, drop: secDrop, rail: secRails, rocks: secRocks, trees: secTrees, rollers: secRollers };
function genSection() {
  var z = S.genZ;
  if (z < S.flatUntil) { S.genZ = z + 40; return; }
  var d = diff(z);
  var w = { cruise: 1.4, kicker: 3, big: 1.1 + 1.6 * d, drop: 0.7 + 1.2 * d, rail: 2.2, rocks: 1.2 + 2.2 * d, trees: 0.8 + 1.8 * d, rollers: 1.5 };
  var tot = 0, k;
  for (k in w) if (k !== S.lastSec) tot += w[k];
  var r = R() * tot;
  for (k in w) { if (k === S.lastSec) continue; r -= w[k]; if (r <= 0) break; }
  S.lastSec = k;
  S.genZ = SECTIONS[k](z) + 14 + R() * 18;
}

// ============================================================ pezzi di terreno (chunk)
var chunks = {};
function buildChunk(ci) {
  var z0 = ci * CH_L, NZ = 64, NX = 50, pos = [], col = [], uv = [], idx = [];
  for (var j = 0; j <= NZ; j++) {
    var z = z0 + j * CH_L / NZ, cx = cxAt(z);
    for (var i = 0; i <= NX; i++) {
      var t = i / NX * 2 - 1, u = (t < 0 ? -1 : 1) * Math.pow(Math.abs(t), 1.75) * 110, x = cx + u;
      pos.push(x, terrainH(x, z), z); uv.push(x * 0.3, z * 0.3);
    }
  }
  for (var jj = 0; jj < NZ; jj++) for (var ii = 0; ii < NX; ii++) { var a = jj * (NX + 1) + ii, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  var n = g.attributes.normal, white = new THREE.Color(0xffffff), blue = new THREE.Color(0xc9daf0), rock = new THREE.Color(0x6d7890), tmp = new THREE.Color();
  for (var v = 0; v < n.count; v++) {
    var ny = n.getY(v), px = pos[v * 3], pz = pos[v * 3 + 2];
    var e = Math.abs(px - cxAt(pz)) - hwAt(pz);
    tmp.copy(white).lerp(blue, clamp(0.15 + (1 - ny) * 1.6 + clamp(e / 40, 0, 0.25) + vnoise2(px * 0.05, pz * 0.05, 2) * 0.12, 0, 1));
    if (ny < 0.55) tmp.lerp(rock, sm01((0.55 - ny) / 0.2));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  var mesh = new THREE.Mesh(g, M.snow); mesh.receiveShadow = true;
  scene.add(mesh);
  // abeti ai bordi
  var RR = rng(ci * 9973 + S.seed), count = 120, inst = new THREE.InstancedMesh(GEO.pine, M.tree, count), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (var k = 0; k < count; k++) {
    var zz = z0 + RR() * CH_L, side = RR() < 0.5 ? -1 : 1, dist = hwAt(zz) + 3.2 + Math.pow(RR(), 1.6) * 75, xx = cxAt(zz) + side * dist, s = 0.9 + RR() * 1.1;
    p.set(xx, terrainH(xx, zz) - 0.3, zz); q.setFromAxisAngle(up, RR() * TAU); sc.set(s, s * (0.9 + RR() * 0.3), s);
    mtx.compose(p, q, sc); inst.setMatrixAt(k, mtx);
  }
  inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
  scene.add(inst);
  // paletti di bordo pista
  var poles = new THREE.InstancedMesh(GEO.pole, M.pole, 10);
  for (var pi = 0; pi < 5; pi++) for (var sd = 0; sd < 2; sd++) {
    var pz2 = z0 + pi * 12 + 3, px2 = cxAt(pz2) + (sd ? 1 : -1) * (hwAt(pz2) + 0.6);
    p.set(px2, terrainH(px2, pz2), pz2); q.identity(); sc.set(1, 1, 1); mtx.compose(p, q, sc); poles.setMatrixAt(pi * 2 + sd, mtx);
  }
  poles.instanceMatrix.needsUpdate = true; poles.computeBoundingSphere();
  scene.add(poles);
  chunks[ci] = [mesh, inst, poles];
}
function disposeObj(o) {
  scene.remove(o);
  o.traverse(function (c) { if (c.geometry && c.userData.own !== false && (o.userData.own || c.userData.own)) c.geometry.dispose(); });
}
function genAhead() {
  var zc = P.z;
  var need = Math.floor((zc + 270) / CH_L);
  while (S.genZ < (need + 1) * CH_L + 60) genSection();
  var first = Math.floor((zc - 45) / CH_L);
  for (var ci = first; ci <= need; ci++) if (!chunks[ci]) buildChunk(ci);
  for (var key in chunks) {
    if (+key < first) {
      chunks[key].forEach(function (m) { scene.remove(m); m.geometry.dispose(); if (m.dispose) m.dispose(); });
      delete chunks[key];
    }
  }
}
function pruneWorld() {
  var lim = Math.min(P.z, focusZ()) - 40;
  var keep = [];
  for (var i = 0; i < S.objs.length; i++) { var o = S.objs[i]; if (o.userData.z < lim) { scene.remove(o); if (o.userData.own) o.traverse(function (c) { if (c.geometry && c.geometry !== GEO.post) c.geometry.dispose(); }); } else keep.push(o); }
  S.objs = keep;
  S.coins = S.coins.filter(function (c) { return c.parent && !(c.userData.coin.taken > 1.2); });
  S.flags = S.flags.filter(function (f) { return !!f.parent; });
  S.rocks = S.rocks.filter(function (r) { return r.z > lim; });
  S.rails = S.rails.filter(function (r) { return r.z2 > lim; });
  S.kickers = S.kickers.filter(function (k) { return k.z1 + 2 > lim; });
  S.rollers = S.rollers.filter(function (r) { return r.z0 + r.len > lim; });
}
function clearWorld() {
  for (var key in chunks) { chunks[key].forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); }
  chunks = {};
  if (S) S.objs.forEach(function (o) { scene.remove(o); if (o.userData.own) o.traverse(function (c) { if (c.geometry && c.geometry !== GEO.post) c.geometry.dispose(); }); });
}

// ============================================================ particelle
var PMAX = 700;
var pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX), pAlpha = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
var pMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: dotTex }, scale: { value: 400 } },
  vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC;\n' +
    'uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard;\n#include <colorspace_fragment>\n}',
  transparent: true, depthWrite: false
});
var pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false;
scene.add(pPoints);
var parts = [];
for (var pi0 = 0; pi0 < PMAX; pi0++) parts.push({ life: 0 });
var pNext = 0;
var COLS = { snow: new THREE.Color(0xffffff), spark: new THREE.Color(0xffd65a), gold: new THREE.Color(0xffec96) };
function part(x, y, z, vx, vy, vz, life, size, kind) {
  var p = parts[pNext]; pNext = (pNext + 1) % PMAX;
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.size = size; p.kind = kind || 'snow';
}
function burst(x, y, z, n, spd, up) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * TAU, s = spd * (0.3 + Math.random() * 0.8);
    part(x, y, z, Math.cos(a) * s, Math.random() * spd * 0.8 + (up || 0), Math.sin(a) * s, 0.5 + Math.random() * 0.7, 0.25 + Math.random() * 0.45);
  }
}
function updParticles(dt) {
  for (var i = 0; i < PMAX; i++) {
    var p = parts[i];
    if (p.life <= 0) { pAlpha[i] = 0; continue; }
    p.life -= dt;
    p.vy -= (p.kind === 'spark' ? 18 : 9) * dt; var dr = 1 - 1.8 * dt; p.vx *= dr; p.vz *= dr; p.vy *= 1 - 0.8 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    var a = clamp(p.life / p.max, 0, 1);
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    var c = COLS[p.kind] || COLS.snow; pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pSize[i] = p.size * (p.kind === 'snow' ? (0.6 + (1 - a) * 0.8) : 1); pAlpha[i] = p.kind === 'snow' ? a * 0.85 : a;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
}
// neve che cade attorno alla camera
var FL = 900, flGeo = new THREE.BufferGeometry(), flPos = new Float32Array(FL * 3);
for (var fi = 0; fi < FL; fi++) { flPos[fi * 3] = (Math.random() - 0.5) * 60; flPos[fi * 3 + 1] = Math.random() * 30 - 8; flPos[fi * 3 + 2] = Math.random() * 70 - 10; }
flGeo.setAttribute('position', new THREE.BufferAttribute(flPos, 3));
var flakes = new THREE.Points(flGeo, new THREE.PointsMaterial({ map: dotTex, size: 0.16, transparent: true, depthWrite: false, opacity: 0.9 }));
flakes.frustumCulled = false;
scene.add(flakes);
var flOrigin = new THREE.Vector3();
function updFlakes(dt) {
  var sp = P.air ? P.vz : P.speed;
  for (var i = 0; i < FL; i++) {
    flPos[i * 3 + 1] -= (1.6 + (i % 7) * 0.25) * dt; flPos[i * 3] += Math.sin(S.time * 0.7 + i) * 0.4 * dt;
    if (flPos[i * 3 + 1] < -8) flPos[i * 3 + 1] += 30;
  }
  flakes.position.set(camera.position.x, camera.position.y, camera.position.z);
  // la neve resta nel mondo: sposta le coordinate locali al contrario del movimento della camera
  var dz = camera.position.z - flOrigin.z, dx = camera.position.x - flOrigin.x, dy = camera.position.y - flOrigin.y;
  flOrigin.copy(camera.position);
  for (var k = 0; k < FL; k++) {
    var ix = k * 3;
    flPos[ix] -= dx; flPos[ix + 1] -= dy; flPos[ix + 2] -= dz;
    if (flPos[ix + 2] < -10) flPos[ix + 2] += 70; else if (flPos[ix + 2] > 60) flPos[ix + 2] -= 70;
    if (flPos[ix] < -30) flPos[ix] += 60; else if (flPos[ix] > 30) flPos[ix] -= 60;
    if (flPos[ix + 1] < -8) flPos[ix + 1] += 30; else if (flPos[ix + 1] > 22) flPos[ix + 1] -= 30;
  }
  flGeo.attributes.position.needsUpdate = true;
  void sp;
}

// ============================================================ il rider (modello e pose)
var rider = (function () {
  var root = new THREE.Group();
  var M2 = {
    jacket: new THREE.MeshLambertMaterial({ color: 0xff5a36 }), jacketD: new THREE.MeshLambertMaterial({ color: 0xd84424 }),
    pants: new THREE.MeshLambertMaterial({ color: 0x22325a }), pantsD: new THREE.MeshLambertMaterial({ color: 0x1a2747 }),
    glove: new THREE.MeshLambertMaterial({ color: 0x1b2433 }), boot: new THREE.MeshLambertMaterial({ color: 0x2b2f38 }),
    helmet: new THREE.MeshPhongMaterial({ color: 0xf5f7fb, shininess: 60 }), stripe: new THREE.MeshLambertMaterial({ color: 0xffcf3f }),
    skin: new THREE.MeshLambertMaterial({ color: 0xf2c29b }), goggle: new THREE.MeshPhongMaterial({ map: goggleTex, shininess: 120, specular: 0xffffff }),
    board: new THREE.MeshPhongMaterial({ map: boardTex, shininess: 40 }), boardBase: new THREE.MeshLambertMaterial({ color: 0x0b2a4a }), bind: new THREE.MeshLambertMaterial({ color: 0x111827 })
  };
  // tavola
  var board = new THREE.Group();
  var deck = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.03, 1.2), [M2.boardBase, M2.boardBase, M2.board, M2.boardBase, M2.boardBase, M2.boardBase]);
  deck.position.y = 0.035; board.add(deck);
  [-1, 1].forEach(function (s) {
    var tip = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 16, 1, false, s > 0 ? -PI / 2 : PI / 2, PI), M2.board);
    tip.position.set(0, 0.05, s * 0.6); tip.rotation.x = s * 0.18; board.add(tip);
    var bnd = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.13), M2.bind); bnd.position.set(0, 0.08, s * 0.25); board.add(bnd);
  });
  board.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  root.add(board);
  var body = new THREE.Group(); root.add(body);
  function cyl(mat, r) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1, 8), mat); m.castShadow = true; body.add(m); return m; }
  function sph(mat, r) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat); m.castShadow = true; body.add(m); return m; }
  var parts = {
    thighB: cyl(M2.pantsD, 0.085), shinB: cyl(M2.pantsD, 0.075), thighF: cyl(M2.pants, 0.085), shinF: cyl(M2.pants, 0.075),
    kneeB: sph(M2.pantsD, 0.085), kneeF: sph(M2.pants, 0.085), hip: sph(M2.pants, 0.15),
    bootB: new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.15), M2.boot), bootF: new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.15), M2.boot),
    torso: cyl(M2.jacket, 0.17), chest: sph(M2.jacket, 0.175), belly: sph(M2.jacket, 0.155),
    uArmB: cyl(M2.jacketD, 0.06), lArmB: cyl(M2.jacketD, 0.055), uArmF: cyl(M2.jacket, 0.06), lArmF: cyl(M2.jacket, 0.055),
    elbB: sph(M2.jacketD, 0.06), elbF: sph(M2.jacket, 0.06), handB: sph(M2.glove, 0.065), handF: sph(M2.glove, 0.065),
    neck: sph(M2.skin, 0.07)
  };
  body.add(parts.bootB); body.add(parts.bootF); parts.bootB.castShadow = parts.bootF.castShadow = true;
  var head = new THREE.Group(); body.add(head);
  var face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), M2.skin); face.castShadow = true; head.add(face);
  var helm = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, TAU, 0, PI * 0.58), M2.helmet); helm.position.y = 0.025; helm.castShadow = true; head.add(helm);
  var strp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.27), M2.stripe); strp.position.set(0, 0.155, 0); head.add(strp);
  var gog = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.2), [M2.goggle, M2.glove, M2.glove, M2.glove, M2.glove, M2.glove]); gog.position.set(0.1, 0.02, 0); head.add(gog);
  var strap = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.04, 16, 1, true), M2.glove); strap.position.y = 0.02; head.add(strap);
  parts.head = head;
  return { root: root, board: board, body: body, parts: parts };
})();
scene.add(rider.root);
var Y_AXIS = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function seg(mesh, a, b) {
  tmpV.subVectors(b, a); var len = tmpV.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-4) mesh.quaternion.setFromUnitVectors(Y_AXIS, tmpV.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1);
}
function ik3(a, b, l1, l2, bend, out) {
  var d = tmpV2.subVectors(b, a), dist = d.length(), mx = l1 + l2 - 0.001;
  if (dist > mx) { d.multiplyScalar(mx / dist); dist = mx; }
  var end = new THREE.Vector3().addVectors(a, d);
  var x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  var dn = d.clone().normalize();
  var perp = bend.clone().sub(dn.clone().multiplyScalar(bend.dot(dn))).normalize();
  out.copy(a).add(dn.multiplyScalar(x)).add(perp.multiplyScalar(h));
  return end;
}
var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
var BEND_KNEE = V(1, 0.2, 0), BEND_ELB = V(-0.3, -1, 0);
function poseRider(o) {
  // o: c (accovacciato), ga (grab 0..1), grab, air (0..1), t, flail
  var pp = rider.parts, c = o.c, g = o.ga, airA = o.air, t = o.t;
  var cc = c + g * 0.6;
  var hip = V(-0.02 + cc * 0.06, 0.95 - cc * 0.34, 0);
  var fB = V(0, 0.12, -0.25), fF = V(0, 0.12, 0.25);
  if (g > 0) { fB.y += g * 0.02; fF.y += g * 0.02; }
  var kB = new THREE.Vector3(), kF = new THREE.Vector3();
  var hB = hip.clone().add(V(0, 0, -0.1)), hF = hip.clone().add(V(0, 0, 0.1));
  var eB = ik3(hB, fB, 0.45, 0.44, BEND_KNEE, kB), eF = ik3(hF, fF, 0.45, 0.44, BEND_KNEE, kF);
  seg(pp.thighB, hB, kB); seg(pp.shinB, kB, eB); seg(pp.thighF, hF, kF); seg(pp.shinF, kF, eF);
  pp.kneeB.position.copy(kB); pp.kneeF.position.copy(kF); pp.hip.position.copy(hip);
  pp.bootB.position.set(0.02, 0.1, -0.25); pp.bootF.position.set(0.02, 0.1, 0.25);
  var lean = 0.1 + c * 0.22 + g * 0.25;
  var sh = hip.clone().add(V(lean, 0.52 - c * 0.06 - g * 0.14, 0));
  seg(pp.torso, hip, sh);
  pp.belly.position.lerpVectors(hip, sh, 0.25); pp.chest.position.lerpVectors(hip, sh, 0.85);
  var headP = sh.clone().add(V(0.04 + g * 0.04, 0.2, 0));
  pp.neck.position.lerpVectors(sh, headP, 0.45);
  pp.head.position.copy(headP); pp.head.rotation.z = -0.15 - c * 0.2;
  var sB = sh.clone().add(V(0, -0.03, -0.18)), sF = sh.clone().add(V(0, -0.03, 0.18));
  var wob = Math.sin(t * 5) * 0.03;
  var hBt = V(0.08, sh.y - 0.32 + wob, -0.55), hFt = V(0.14, sh.y - 0.28 - wob, 0.55);
  hBt.lerp(V(0.05, sh.y + 0.18, -0.6), airA); hFt.lerp(V(0.1, sh.y + 0.22, 0.6), airA);
  if (o.flail) { hBt.set(Math.sin(t * 13) * 0.4, sh.y + Math.cos(t * 11) * 0.4, -0.5); hFt.set(Math.cos(t * 12) * 0.4, sh.y + Math.sin(t * 15) * 0.4, 0.5); }
  if (g > 0.01) {
    if (o.grab === 'indy') { hBt.lerp(V(0.17, 0.12, -0.02), g); hFt.lerp(V(0.2, sh.y + 0.25, 0.55), g); }
    else { hFt.lerp(V(-0.17, 0.12, 0.05), g); hBt.lerp(V(0.0, sh.y + 0.25, -0.6), g); }
  }
  var elB = new THREE.Vector3(), elF = new THREE.Vector3();
  var wB = ik3(sB, hBt, 0.3, 0.3, BEND_ELB, elB), wF = ik3(sF, hFt, 0.3, 0.3, BEND_ELB, elF);
  seg(pp.uArmB, sB, elB); seg(pp.lArmB, elB, wB); seg(pp.uArmF, sF, elF); seg(pp.lArmF, elF, wF);
  pp.elbB.position.copy(elB); pp.elbF.position.copy(elF); pp.handB.position.copy(wB); pp.handF.position.copy(wF);
}

// segno d'atterraggio
var ringMat = new THREE.MeshBasicMaterial({ color: 0x4fe0b0, transparent: true, opacity: 0.8, depthWrite: false });
var ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 40).rotateX(-PI / 2), ringMat);
ring.renderOrder = 2; scene.add(ring);
var blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x1e325a, transparent: true, opacity: 0.25, depthWrite: false }));
blob.renderOrder = 1; scene.add(blob);

// valanga: nuvole di neve
var avGroup = new THREE.Group(); scene.add(avGroup);
var avPuffs = [];
for (var ai = 0; ai < 46; ai++) {
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.95 }));
  sp.userData = { ox: (Math.random() - 0.5) * 2, oz: -Math.random() * 14, oy: Math.random(), ph: Math.random() * 6, s: 6 + Math.random() * 9 };
  avGroup.add(sp); avPuffs.push(sp);
}

// ============================================================ giocatore e stato
function newPlayer() {
  return { x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, speed: 15, vx: 0, vy: 0, vz: 0, vyG: 0, air: false, airT: 0, coyote: 0, fromOllie: false,
    spin: 0, spinRate: 0, spin0: 0, stance: 0, flip: 0, flipTo: 0, grab: null, grabAmt: 0, lastGrab: 'indy', airAmt: 0, crouch: 0.3, squash: 0,
    grind: null, grindT: 0, crashed: false, crashT: 0, inv: 0, trick: null, sprayT: 0, tti: 1, landX: 0, landZ: 0, landY: 0, predT: 0,
    up: new THREE.Vector3(0, 1, 0), lean: 0, toSpeed: 15 };
}
function newWorld() {
  clearWorld();
  var seed = (Math.random() * 1e9) | 0;
  S = { seed: seed, rand: rng(seed), genZ: -60, flatUntil: 60, diffStart: 1e12, startZ: 0, lastSec: '',
    drops: [], rollers: [], kickers: [], rails: [], rocks: [], coins: [], flags: [], objs: [],
    time: 0, bank: 0, coinN: 0, tricks: 0, bestTrick: { pts: 0, name: '' }, maxSpeed: 0, crashes: 0, rag: null };
  P = newPlayer();
  P.x = cxAt(0); P.z = 0; P.y = 0;
  AV = { z: -80, speed: 12, ema: 18 };
  combo = { pts: 0, n: 0, t: 0 };
  genAhead();
  P.y = Hgt(P.x, P.z);
  resetRiderParts();
  snapCamera();
}
function runMeters() { return Math.max(0, P.z - S.startZ); }
function focusZ() { return P.crashed && S.rag ? S.rag.body.p.z : P.z; }

// ============================================================ input
var touches = {}, keySteer = 0, keyGrab = null;
function steerInput() {
  var f = keySteer;
  for (var id in touches) { var t = touches[id]; if (t.mode === 'hold' || t.mode === 'steer') f += t.side; }
  return clamp(f, -1, 1);
}
function spinInput() {
  var f = keySteer;
  for (var id in touches) { var t = touches[id]; if (t.mode === 'hold' && t.inAir) f += t.side; }
  return clamp(f, -1, 1);
}
function grabInput() {
  for (var id in touches) if (touches[id].mode === 'grab') return touches[id].dir;
  return keyGrab;
}
function pressStart(id, x, y) {
  ensureAudio();
  if (state !== 'play' || P.crashed) { touches[id] = { mode: 'none' }; return; }
  touches[id] = { mode: P.air && !P.grind ? 'hold' : 'steer', inAir: P.air && !P.grind, side: x < W / 2 ? -1 : 1, sx: x, sy: y, ax: x, ay: y, at: now(), st: now(), moved: false };
}
function pressMove(id, x, y) {
  var t = touches[id]; if (!t || t.mode === 'none' || t.mode === 'grab' || t.mode === 'used') return;
  if (now() - t.at > 260) { t.ax = x; t.ay = y; t.at = now(); }
  var dx = x - t.ax, dy = y - t.ay;
  if (Math.sqrt(dx * dx + dy * dy) < 28) return;
  t.moved = true;
  var vert = Math.abs(dy) > Math.abs(dx);
  if (!P.air || P.grind) {
    if (vert && dy < 0) { ollie(); t.mode = 'used'; }
    return;
  }
  if (vert) { queueFlip(dy < 0 ? -1 : 1); t.mode = 'used'; }
  else { t.mode = 'grab'; t.dir = dx < 0 ? 'method' : 'indy'; tutorialEvent('grab'); }
}
function pressEnd(id) {
  var t = touches[id]; delete touches[id];
  if (!t || t.mode === 'none') return;
  if (!t.moved && now() - t.st < 190 && state === 'play' && (!P.air || P.grind || P.coyote > 0)) ollie();
}
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; pressStart(t.identifier, t.clientX, t.clientY); } }, { passive: false });
canvas.addEventListener('touchmove', function (e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; pressMove(t.identifier, t.clientX, t.clientY); } }, { passive: false });
function tEnd(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) pressEnd(e.changedTouches[i].identifier); }
canvas.addEventListener('touchend', tEnd, { passive: false });
canvas.addEventListener('touchcancel', tEnd, { passive: false });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
var mouseDown = false;
canvas.addEventListener('mousedown', function (e) { mouseDown = true; pressStart('m', e.clientX, e.clientY); });
window.addEventListener('mousemove', function (e) { if (mouseDown) pressMove('m', e.clientX, e.clientY); });
window.addEventListener('mouseup', function () { if (mouseDown) { mouseDown = false; pressEnd('m'); } });
window.addEventListener('keydown', function (e) {
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); if (state === 'menu' || state === 'over') { startGame(); return; } ensureAudio(); ollie(); }
  if (e.code === 'ArrowLeft') keySteer = -1;
  if (e.code === 'ArrowRight') keySteer = 1;
  if (e.code === 'ArrowUp') queueFlip(-1);
  if (e.code === 'ArrowDown') queueFlip(1);
  if (e.code === 'KeyA') { keyGrab = 'method'; tutorialEvent('grab'); }
  if (e.code === 'KeyD') { keyGrab = 'indy'; tutorialEvent('grab'); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', function (e) {
  if ((e.code === 'ArrowLeft' && keySteer < 0) || (e.code === 'ArrowRight' && keySteer > 0)) keySteer = 0;
  if ((e.code === 'KeyA' && keyGrab === 'method') || (e.code === 'KeyD' && keyGrab === 'indy')) keyGrab = null;
});

// ============================================================ audio sintetizzato
var AU = { ctx: null, master: null, noise: null, loops: {} };
function ensureAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  try {
    var c = AU.ctx = new C();
    AU.master = c.createGain(); AU.master.gain.value = save.mute ? 0 : 0.9; AU.master.connect(c.destination);
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var wv = Math.random() * 2 - 1; last = last * 0.6 + wv * 0.4; d[i] = last * 1.6; }
    AU.noise = buf;
    var loop = function (name, type, freq, q) {
      var src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.6;
      var f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      var gn = c.createGain(); gn.gain.value = 0;
      src.connect(f); f.connect(gn); gn.connect(AU.master); src.start();
      AU.loops[name] = { f: f, g: gn };
    };
    loop('wind', 'bandpass', 500, 0.7); loop('carve', 'highpass', 2200, 0.5); loop('grind', 'bandpass', 3600, 9); loop('rumble', 'lowpass', 160, 0.8);
  } catch (e) { AU.ctx = null; }
}
function setLoop(name, gain, freq) {
  var l = AU.loops[name]; if (!l) return; var t = AU.ctx.currentTime;
  l.g.gain.setTargetAtTime(gain, t, 0.08); if (freq) l.f.frequency.setTargetAtTime(freq, t, 0.1);
}
function tone(freq, dur, type, gain, freqEnd, delay) {
  if (!AU.ctx || save.mute) return;
  var c = AU.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, type, f0, f1, gain, q) {
  if (!AU.ctx || save.mute) return;
  var c = AU.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = AU.noise;
  var f = c.createBiquadFilter(); f.type = type; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  var g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function sfx(name, a) {
  if (!AU.ctx || save.mute) return;
  if (name === 'jump') { noiseHit(0.22, 'bandpass', 700, 2600, 0.35, 1.2); tone(220, 0.12, 'triangle', 0.08, 330); }
  else if (name === 'land') { var k = clamp(a || 0.5, 0.15, 1); tone(110, 0.22, 'sine', 0.5 * k, 45); noiseHit(0.18, 'lowpass', 1400, 300, 0.45 * k, 0.7); }
  else if (name === 'coin') { var p = 1 + (a || 0) * 0.06; tone(1318 * p, 0.09, 'sine', 0.12); tone(1976 * p, 0.16, 'sine', 0.1, 0, 0.06); }
  else if (name === 'trick') { var base = [523, 587, 659, 784, 880, 1046][clamp((a || 1) - 1, 0, 5)]; tone(base, 0.12, 'triangle', 0.16); tone(base * 1.5, 0.18, 'triangle', 0.13, 0, 0.07); }
  else if (name === 'bank') { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.13, 0, i * 0.06); }); }
  else if (name === 'crash') { noiseHit(0.7, 'lowpass', 900, 120, 0.8, 0.6); tone(70, 0.4, 'sine', 0.6, 35); }
  else if (name === 'whoosh') { noiseHit(0.16, 'bandpass', 900, 1800, 0.16, 2); }
  else if (name === 'perfect') { tone(1046, 0.1, 'sine', 0.12); tone(1568, 0.25, 'sine', 0.12, 0, 0.07); }
  else if (name === 'rail') { tone(880, 0.08, 'square', 0.04, 1200); noiseHit(0.1, 'highpass', 3000, 0, 0.3, 1); }
}
function updateAudio() {
  if (!AU.ctx) return;
  var m = save.mute ? 0 : 1, sp = P.crashed ? 0 : (P.air ? Math.hypot(P.vx, P.vz) : P.speed), playing = state === 'play' || state === 'dying';
  setLoop('wind', m * (0.05 + clamp(sp / 32, 0, 1) * (P.air ? 0.42 : 0.22)) * (playing ? 1 : 0.5), 300 + sp * 40);
  setLoop('carve', m * (!P.air && !P.grind && !P.crashed ? clamp(sp / 28, 0, 1) * (0.1 + Math.abs(P.yawRate) * 0.08) : 0), 1800 + sp * 40);
  setLoop('grind', m * (P.grind ? 0.22 : 0), 3200 + sp * 30);
  var gap = playing ? focusZ() - AV.z : 99;
  setLoop('rumble', m * (clamp(1 - gap / 40, 0, 1) * 0.9 + (state === 'dying' ? 0.6 : 0)), 120 + clamp(1 - gap / 40, 0, 1) * 120);
}

// ============================================================ scritte a schermo
var popsEl = $('pops');
function popup(title, sub, tag) {
  var d = document.createElement('div');
  d.className = 'pop ' + (tag || '');
  var t = document.createElement('div'); t.className = 't'; t.textContent = title; d.appendChild(t);
  if (sub) { var s = document.createElement('div'); s.className = 's'; s.textContent = sub; d.appendChild(s); }
  popsEl.insertBefore(d, popsEl.firstChild);
  while (popsEl.children.length > 3) popsEl.removeChild(popsEl.lastChild);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1750);
}

// ============================================================ fisica del rider
function startAir() {
  var p = P;
  p.air = true; p.airT = 0; p.toSpeed = p.speed; p.spin0 = p.spin; p.flip = 0; p.flipTo = 0; p.predT = 0; p.tti = 1;
  p.trick = { grabs: {}, flips: 0 };
}
function ollie() {
  var p = P; if (state !== 'play' || p.crashed) return;
  var pop = 7.2;
  if (p.grind) {
    var r = p.grind, dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
    p.vx = dir.x * p.speed; p.vy = dir.y * p.speed + pop; p.vz = dir.z * p.speed;
    endGrind(); startAir();
  } else if (!p.air) {
    var dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
    p.vx = dx * p.speed; p.vz = dz * p.speed; p.vy = p.vyG + pop;
    startAir();
  } else if (p.coyote > 0) {
    p.vy += pop + (p.lipPop ? 2.2 : 0); p.coyote = 0;
    if (p.lipPop) popup('Pop!', '', 'perfect');
  } else return;
  sfx('jump');
  burst(p.x, p.y + 0.1, p.z, 10, 2.5, 1);
  tutorialEvent('ollie');
}
function queueFlip(dir) {
  var p = P; if (state !== 'play' || !p.air || p.grind || p.crashed) return;
  if (p.flipTo !== 0 && Math.sign(p.flipTo) !== dir) return;
  p.flipTo += dir * TAU; sfx('whoosh');
  tutorialEvent('flip');
}
function updatePlayer(dt) {
  var p = P;
  if (p.inv > 0) p.inv -= dt;
  if (p.crashed) { updateRag(dt); return; }
  var dm = diff(p.z);
  if (p.grind) updGrind(dt);
  else if (!p.air) updGround(dt, dm);
  else updAir(dt);
  if (p.crashed) return;
  var ct = 0.3 + Math.abs(p.yawRate) * 0.08;
  if (p.air) ct = 0.18; if (p.grind) ct = 0.42;
  p.squash *= Math.exp(-dt * 7);
  p.crouch = lerp(p.crouch, ct + p.squash, damp(14, dt));
  p.grabAmt = lerp(p.grabAmt, p.grab ? 1 : 0, damp(14, dt));
  p.airAmt = lerp(p.airAmt, p.air ? 1 : 0, damp(7, dt));
  if (state === 'play') collide();
  if (!p.air && !p.grind) {
    p.sprayT -= dt;
    var rate = clamp((p.speed - 8) / 22, 0, 1) * (0.5 + Math.abs(p.yawRate) * 0.5);
    if (p.sprayT <= 0 && rate > 0.05) {
      p.sprayT = 0.012 / (0.2 + rate);
      var dx = Math.sin(p.yaw), dz = Math.cos(p.yaw), side = p.yawRate > 0 ? -1 : 1;
      part(p.x - dx * 0.6 + dz * 0.15 * side, p.y + 0.05, p.z - dz * 0.6 - dx * 0.15 * side, -dx * p.speed * 0.15 + dz * side * (1 + rate * 3), 1.2 + Math.random() * 2.5 * rate, -dz * p.speed * 0.15 - dx * side * (1 + rate * 3), 0.45 + Math.random() * 0.4, 0.18 + Math.random() * 0.35 * rate);
    }
  }
  if (p.grind && Math.random() < 0.8) part(p.x + (Math.random() - 0.5) * 0.4, p.y, p.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, -2 + (Math.random() - 0.5) * 3, 0.3, 0.12, 'spark');
}
function updGround(dt, dm) {
  var p = P;
  var steer = state === 'play' ? steerInput() : Math.sin(S.time * 0.5) * 0.4 - p.yaw * 0.8;
  if (steer !== 0 && state === 'play') tutorialEvent('steer');
  var e = 0.25, hx = (Hgt(p.x + e, p.z) - Hgt(p.x - e, p.z)) / (2 * e), hz = (Hgt(p.x, p.z + e) - Hgt(p.x, p.z - e)) / (2 * e);
  p.yawRate = lerp(p.yawRate, steer * 1.9, damp(7, dt));
  p.yaw += (p.yawRate - hx * 1.3 - (steer === 0 ? p.yaw * 0.5 : 0)) * dt;
  p.yaw = clamp(p.yaw, -1.3, 1.3);
  var dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
  var sAlong = -(hx * dx + hz * dz), sinA = sAlong / Math.sqrt(1 + sAlong * sAlong), cosA = 1 / Math.sqrt(1 + sAlong * sAlong);
  var acc = G * sinA * 0.7 * (1 + 0.3 * dm) - 0.9 - 0.0085 * (1 - 0.2 * dm) * p.speed * p.speed - Math.abs(p.yawRate) * p.speed * 0.06;
  p.speed = clamp(p.speed + acc * dt, 4, MAXS);
  var nx = p.x + dx * p.speed * cosA * dt, nz = p.z + dz * p.speed * cosA * dt, ny = Hgt(nx, nz);
  var pred = p.y + p.vyG * dt - 0.5 * G * dt * dt;
  if (ny < pred - 0.0006) {
    p.vx = dx * p.speed * cosA; p.vz = dz * p.speed * cosA; p.vy = p.vyG;
    p.lipPop = isNearLip(p.x, p.z);
    p.x = nx; p.z = nz; p.y = pred; p.coyote = 0.16; startAir(); return;
  }
  p.vyG = (ny - p.y) / dt;
  p.x = nx; p.z = nz; p.y = ny;
  p.lean = lerp(p.lean, -p.yawRate * 0.22, damp(8, dt));
  var cx = cxAt(p.z), hw = hwAt(p.z);
  if (Math.abs(p.x - cx) > hw + 4.5 && state === 'play' && p.inv <= 0) crash('Sei finito tra gli alberi');
}
function isNearLip(x, z) {
  for (var i = 0; i < S.kickers.length; i++) { var k = S.kickers[i]; if (Math.abs(x - k.x) < k.w + 0.5 && z > k.z1 - 1.2 && z < k.z1 + 1.2) return true; }
  return false;
}
function updAir(dt) {
  var p = P, playing = state === 'play';
  p.airT += dt; if (p.coyote > 0) p.coyote -= dt;
  var sIn = playing ? spinInput() : 0, gb = playing ? grabInput() : null;
  if (gb) { p.grab = gb; p.lastGrab = gb; p.trick.grabs[gb] = (p.trick.grabs[gb] || 0) + dt; } else p.grab = null;
  if (sIn && playing) tutorialEvent('spin');
  // previsione dell'atterraggio
  p.predT -= dt;
  if (p.predT <= 0) {
    p.predT = 0.05;
    var qx = p.x, qy = p.y, qz = p.z, qvy = p.vy, tt = 0;
    while (tt < 3) { qvy -= G * 0.025; qx += p.vx * 0.025; qy += qvy * 0.025; qz += p.vz * 0.025; tt += 0.025; if (qy <= Hgt(qx, qz)) break; }
    p.tti = tt; p.landX = qx; p.landZ = qz; p.landY = Hgt(qx, qz);
  }
  var assist = 1 - clamp(p.tti / 0.55, 0, 1);
  p.spinRate = lerp(p.spinRate, sIn * (gb ? 6.5 : 9.6), damp(sIn ? 16 : 6, dt));
  p.spin += p.spinRate * dt;
  if (!sIn) { var tgt = Math.round(p.spin / PI) * PI, dsp = tgt - p.spin; p.spin += clamp(dsp, -1.5, 1.5) * dt * (2.2 + 9 * assist); }
  var df = p.flipTo - p.flip;
  if (Math.abs(df) > 1e-3) {
    var fr = 9.2 * (gb ? 0.8 : 1);
    var stepF = Math.sign(df) * Math.min(Math.abs(df), fr * dt * (Math.abs(df) < 0.8 ? 0.6 + assist * 1.5 : 1));
    var before = Math.floor(Math.abs(p.flip) / PI); p.flip += stepF;
    if (Math.floor(Math.abs(p.flip) / PI) > before) sfx('whoosh');
  }
  p.vy -= G * dt;
  var py = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  if (p.vy < 0 && !gb) {
    for (var i = 0; i < S.rails.length; i++) {
      var r = S.rails[i]; if (p.z < r.z1 || p.z > r.z2) continue;
      var t = (p.z - r.z1) / (r.z2 - r.z1), rx = lerp(r.x1, r.x2, t), ry = lerp(r.y1, r.y2, t);
      if (Math.abs(p.x - rx) < 0.6 && py >= ry - 0.08 && p.y <= ry + 0.05) {
        var se = Math.abs(wrapA((p.spin - Math.round(p.spin / (PI / 2)) * (PI / 2))));
        var fe = Math.abs(p.flipTo - p.flip) + Math.abs(wrapA(p.flip));
        if (se < 0.5 && fe < 0.6) { mountRail(r, t); return; }
      }
    }
  }
  var g = Hgt(p.x, p.z);
  if (p.y <= g) { p.y = g; land(); }
}
function spinErr(s) { var e = ((s % PI) + PI) % PI; return Math.min(e, PI - e); }
function land() {
  var p = P, playing = state === 'play';
  var sErr = spinErr(p.spin), fRem = Math.abs(p.flipTo - p.flip), fErr = Math.abs(wrapA(p.flip)) + fRem;
  if (playing && p.inv <= 0 && (sErr > 0.55 || fErr > 0.7 || (p.grab && (sErr > 0.3 || fErr > 0.3)))) {
    crash(p.grab ? 'Hai tenuto il grab troppo a lungo' : fErr > 0.7 ? 'Flip non chiuso' : 'Atterraggio storto'); return;
  }
  var perfectish = sErr < 0.1 && fErr < 0.12 && !p.grab;
  var nSpin = Math.round((p.spin - p.spin0) / PI), nFlip = Math.round(Math.abs(p.flipTo) / TAU), flipDir = p.flipTo < 0 ? -1 : 1;
  p.spin = Math.round(p.spin / PI) * PI; p.spinRate = 0; p.flip = 0; p.flipTo = 0;
  p.air = false;
  var hs = Math.hypot(p.vx, p.vz);
  var yaw = Math.atan2(p.vx, p.vz);
  p.yaw = clamp(yaw, -1.3, 1.3);
  var n = normalAt(p.x, p.z, tmpV);
  var vIn = -(p.vx * n.x + p.vy * n.y + p.vz * n.z);
  var sketchy = !perfectish && (sErr > 0.35 || fErr > 0.4 || !!p.grab);
  p.speed = clamp(hs * (sketchy ? 0.82 : 0.97), 4, Math.min(MAXS, Math.max(p.toSpeed * 1.12, 18)));
  var dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
  p.vyG = (Hgt(p.x + dx * 0.2, p.z + dz * 0.2) - p.y) / 0.2 * p.speed;
  var imp = clamp(vIn / 20, 0.08, 1);
  p.squash = imp * 0.8; shakeAmt = Math.max(shakeAmt, imp * 0.35);
  sfx('land', imp * 1.3);
  burst(p.x, p.y + 0.05, p.z, 8 + Math.round(imp * 30), 3 + imp * 6, 1);
  if (playing) scoreTrick(nSpin, nFlip, flipDir, perfectish, sketchy);
  p.grab = null;
}
var SPIN_PTS = [0, 300, 900, 1800, 3000, 4500, 6300, 8400];
function scoreTrick(nSpin, nFlip, flipDir, perfectish, sketchy) {
  var t = P.trick; if (!t) return;
  P.trick = null;
  var parts = [], pts = 0, a = Math.abs(nSpin);
  var sw = (Math.round(P.spin / PI) % 2 !== 0);
  if (nFlip > 0) { var nm = flipDir < 0 ? 'Backflip' : 'Frontflip'; parts.push(nFlip === 1 ? nm : nFlip === 2 ? 'Double ' + nm : nFlip === 3 ? 'Triple ' + nm : nFlip + 'x ' + nm); pts += 1500 * nFlip * (nFlip + 1) / 2; }
  if (a > 0) { parts.push((nSpin > 0 ? 'Frontside ' : 'Backside ') + (a * 180)); pts += SPIN_PTS[Math.min(a, 7)] + Math.max(0, a - 7) * 2400; }
  for (var k in t.grabs) { var tm = t.grabs[k]; if (tm > 0.12) { parts.push(GRAB_NAMES[k]); pts += 250 + Math.round(tm * 800); } }
  if (P.airT > 1.0) { parts.push(P.airT > 1.8 ? 'Huge Air' : 'Big Air'); pts += Math.round(P.airT * 250); }
  if (!parts.length) return;
  if (sw && a > 0) { parts.push('Switch'); pts += 200; }
  var perfect = perfectish && (a > 0 || nFlip > 0 || Object.keys(t.grabs).length > 0);
  if (perfect) pts *= 1.2;
  if (sketchy) pts *= 0.5;
  pts = Math.round(pts / 10) * 10;
  addCombo(pts, parts.join(' + '), perfect ? 'perfect' : sketchy ? 'sketchy' : '');
  if (perfect) { sfx('perfect'); P.speed = Math.min(MAXS, P.speed + 1.5); }
  if (a > 0 || nFlip > 0) tutorialEvent('land');
}
function addCombo(pts, label, tag) {
  combo.pts += pts; combo.n++; combo.t = 2.4; S.tricks++;
  if (pts > S.bestTrick.pts) S.bestTrick = { pts: pts, name: label };
  popup(label, (tag === 'perfect' ? 'Perfect  ' : tag === 'sketchy' ? 'Sketchy  ' : '') + '+' + fmt(pts), tag);
  sfx('trick', Math.min(combo.n, 6));
}
function bankCombo() {
  var mult = Math.min(combo.n, 10), tot = combo.pts * mult;
  S.bank += tot;
  if (combo.n > 1) { popup('Combo x' + mult, '+' + fmt(tot), 'bank'); sfx('bank'); }
  combo.pts = 0; combo.n = 0; combo.t = 0;
}
function mountRail(r, t) {
  var p = P;
  var dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
  p.speed = clamp(p.vx * dir.x + p.vy * dir.y + p.vz * dir.z, 8, Math.min(MAXS, Math.max(p.toSpeed * 1.1, 16)));
  var slide = spinErr(p.spin) > 0.8;
  p.spin = Math.round(p.spin / (PI / 2)) * (PI / 2); p.spinRate = 0;
  if (state === 'play') {
    var nSpin = Math.round((p.spin - p.spin0) / PI);
    scoreTrick(slide ? 0 : nSpin, Math.round(Math.abs(p.flipTo) / TAU), p.flipTo < 0 ? -1 : 1, false, false);
  }
  p.flip = 0; p.flipTo = 0;
  p.grind = r; p.grindT = 0; p.grindPos = t; p.grindSlide = slide; p.air = false; p.grab = null; p.squash = 0.3;
  p.x = lerp(r.x1, r.x2, t); p.y = lerp(r.y1, r.y2, t); p.z = lerp(r.z1, r.z2, t); p.yaw = r.yaw;
  sfx('rail');
}
function endGrind() {
  var p = P, r = p.grind, tm = p.grindT;
  p.grind = null;
  if (p.grindSlide) p.spin = Math.round(p.spin / PI) * PI + (p.spin > Math.round(p.spin / PI) * PI ? PI : 0);
  p.spin = Math.round(p.spin / PI) * PI;
  if (state === 'play' && tm > 0.2) addCombo(Math.round((200 + tm * 600) / 10) * 10, p.grindSlide ? 'Boardslide' : (r.kind === 'box' ? '50-50 Box' : '50-50 Grind'), '');
}
function updGrind(dt) {
  var p = P, r = p.grind, len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1), sl = (r.y1 - r.y2) / len;
  p.speed = clamp(p.speed + (G * sl * 0.6 - 0.8) * dt, 6, MAXS);
  p.grindPos += p.speed * dt / len; p.grindT += dt;
  if (p.grindPos >= 1) {
    var dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
    p.vx = dir.x * p.speed; p.vy = dir.y * p.speed; p.vz = dir.z * p.speed;
    endGrind(); startAir(); p.coyote = 0.15; p.lipPop = false; return;
  }
  p.x = lerp(r.x1, r.x2, p.grindPos); p.y = lerp(r.y1, r.y2, p.grindPos); p.z = lerp(r.z1, r.z2, p.grindPos);
  p.lean = lerp(p.lean, Math.sin(S.time * 9) * 0.06, damp(6, dt));
}
function collide() {
  var p = P, by = p.y + 0.9;
  for (var i = 0; i < S.coins.length; i++) {
    var s = S.coins[i], c = s.userData.coin; if (c.taken) continue;
    var dx = c.x - p.x, dy = c.y - by, dz = c.z - p.z;
    if (dx * dx + dy * dy + dz * dz < 1.6) {
      c.taken = 0.001; S.coinN++; S.bank += 50; sfx('coin', S.coinN % 8);
      for (var j = 0; j < 8; j++) part(c.x, c.y, c.z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, 0.45, 0.18, 'gold');
    }
  }
  if (p.inv > 0) return;
  for (var k = 0; k < S.rocks.length; k++) {
    var o = S.rocks[k]; if (Math.abs(o.z - p.z) > 2.5) continue;
    var ddx = o.x - p.x, ddz = o.z - p.z, gy = terrainH(o.x, o.z);
    if (ddx * ddx + ddz * ddz < (o.r + 0.35) * (o.r + 0.35) && p.y - gy < o.h) { crash(o.tree ? 'Hai preso un albero' : 'Hai preso un sasso'); return; }
  }
}
var shakeAmt = 0;
function crash(reason) {
  var p = P; if (p.crashed) return;
  var vx = p.air ? p.vx : Math.sin(p.yaw) * p.speed, vz = p.air ? p.vz : Math.cos(p.yaw) * p.speed, vy = p.air ? p.vy : p.vyG;
  p.crashed = true; p.crashT = 0; p.air = false; p.grind = null; p.grab = null; p.trick = null; p.flip = 0; p.flipTo = 0;
  var q = rider.root.quaternion.clone();
  S.rag = {
    body: { p: new THREE.Vector3(p.x, p.y + 0.6, p.z), v: new THREE.Vector3(vx * 0.7, Math.max(vy, 0) * 0.4 + 4, vz * 0.7), q: q.clone(), w: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, -8 - Math.random() * 5) },
    board: { p: new THREE.Vector3(p.x, p.y + 0.1, p.z), v: new THREE.Vector3(vx * 0.9 + (Math.random() - 0.5) * 3, Math.max(vy, 0) * 0.4 + 6, vz * 0.9), q: q.clone(), w: new THREE.Vector3(9 + Math.random() * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10) }
  };
  scene.attach(rider.board); scene.attach(rider.body);
  if (combo.n > 0) popup('Combo persa', '', 'lost');
  combo.pts = 0; combo.n = 0; combo.t = 0;
  popup('Wipeout!', reason, 'lost');
  shakeAmt = 0.9; S.crashes++; AV.z += 6 + Math.min(8, runMeters() * 0.004);
  sfx('crash');
  burst(p.x, p.y + 0.3, p.z, 46, 7, 2);
  (S.crashLog = S.crashLog || []).push(reason);
}
var qTmp = new THREE.Quaternion();
function stepRag(o, dt, off) {
  o.v.y -= G * dt; o.p.addScaledVector(o.v, dt);
  var w = o.w.length();
  if (w > 1e-4) { qTmp.setFromAxisAngle(tmpV.copy(o.w).multiplyScalar(1 / w), w * dt); o.q.premultiply(qTmp); }
  var gy = Hgt(o.p.x, o.p.z) + off;
  if (o.p.y < gy) {
    o.p.y = gy;
    if (o.v.y < -1.5) { o.v.y = -o.v.y * 0.3; if (o.v.y > 3) burst(o.p.x, gy, o.p.z, 10, 3, 1); } else o.v.y = 0;
    o.v.x *= 1 - 2.2 * dt; o.v.z *= 1 - 1.6 * dt; o.w.multiplyScalar(1 - 3 * dt);
  }
}
function updateRag(dt) {
  var p = P, r = S.rag; p.crashT += dt;
  stepRag(r.body, dt, 0.25); stepRag(r.board, dt, 0.04);
  if (state === 'play' && p.crashT > 1.3 && (r.body.v.length() < 3 || p.crashT > 2.4)) respawn();
}
function respawn() {
  var p = P, r = S.rag, z = r.body.p.z, cx = cxAt(z), hw = hwAt(z);
  var x = clamp(r.body.p.x, cx - hw + 2, cx + hw - 2);
  for (var tries = 0; tries < 40; tries++) {
    var bad = false;
    for (var i = 0; i < S.rocks.length; i++) { var o = S.rocks[i]; if (Math.abs(o.z - z) < 4 && Math.abs(o.x - x) < o.r + 1.2) bad = true; }
    for (var k = 0; k < S.kickers.length; k++) { var kk = S.kickers[k]; if (z > kk.z0 - 1 && z < kk.z1 + 2) bad = true; }
    for (var d = 0; d < S.drops.length; d++) { var dd = S.drops[d]; if (z > dd.z0 - 2 && z < dd.z0 + 4) bad = true; }
    if (!bad) break; z += 1.5;
  }
  p.x = x; p.z = z; p.y = Hgt(x, z); p.yaw = 0; p.yawRate = 0; p.speed = 7; p.vyG = 0; p.spin = 0; p.stance = 0;
  p.crashed = false; p.inv = 1.5; p.air = false; p.squash = 0.5;
  S.rag = null;
  resetRiderParts();
  burst(p.x, p.y + 0.2, p.z, 14, 3, 1);
}
function resetRiderParts() {
  rider.root.add(rider.board); rider.root.add(rider.body);
  rider.board.position.set(0, 0, 0); rider.board.quaternion.identity();
  rider.body.position.set(0, 0, 0); rider.body.quaternion.identity();
}

// ============================================================ valanga
function updAval(dt) {
  if (state !== 'play') return;
  var m = runMeters();
  var cur = P.crashed ? 0 : (P.air ? Math.max(0, P.vz) : P.speed * Math.cos(P.yaw));
  AV.ema += (cur - AV.ema) * dt / 5;
  AV.speed = clamp(AV.ema * 0.94 + 0.7, 9 + Math.min(9, m * 0.002), 10 + Math.min(12, m * 0.0025));
  AV.z += AV.speed * dt;
  var gap = focusZ() - AV.z;
  if (gap > 45) AV.z = focusZ() - 45;
  // nei primi 200 metri la valanga resta lontana: serve a prendere confidenza coi comandi
  if (m < 200 && gap < 28) { AV.z = focusZ() - 28; gap = 28; }
  if (gap <= 0.5) caught();
}
function caught() {
  state = 'dying'; stateT = 0; shakeAmt = 1.2;
  popup('Travolto!', '', 'lost');
}

// ============================================================ tutorial
var TUT = [
  { ev: 'steer', text: '<b>Tieni premuto</b> a sinistra o a destra dello schermo per curvare.' },
  { ev: 'ollie', text: '<b>Tocca veloce</b> lo schermo (o swipe in su) per saltare. Sul bordo di un kicker salti di più.' },
  { ev: 'spin', text: 'In aria <b>tieni premuto</b> a sinistra o a destra per girare: 360, 540, 720…' },
  { ev: 'land', text: 'Lascia il dito prima di toccare terra e <b>atterra dritto</b>. Il cerchio verde indica dove atterri.' },
  { ev: 'flip', text: 'In aria <b>swipe in su</b> = backflip, <b>swipe in giù</b> = frontflip. Serve un salto alto!' },
  { ev: 'grab', text: 'In aria <b>swipe a sinistra o a destra</b> per un grab, tieni il dito per tenerlo.' },
  { ev: 'done', text: 'Trick uno dopo l\'altro = <b>combo</b>. E occhio alla valanga dietro di te!' }
];
var tutStep = 0, tutTimer = 0, hintEl = $('hint'), hintNow = '';
function tutorialEvent(ev) {
  if (save.tut >= TUT.length || state !== 'play') return;
  if (TUT[tutStep] && TUT[tutStep].ev === ev) { tutStep++; tutTimer = 0; showHint(''); }
}
function updateTutorial(dt) {
  if (state !== 'play' || save.tut >= TUT.length) { showHint(''); return; }
  tutTimer += dt;
  var step = TUT[tutStep];
  if (!step) { save.tut = TUT.length; persist(); showHint(''); return; }
  if (tutTimer > 0.8) showHint(step.text);
  if (step.ev === 'done' && tutTimer > 6) tutStep++;
  if (step.ev !== 'done' && step.ev !== 'steer' && step.ev !== 'ollie' && tutTimer > 14) { tutStep++; tutTimer = 0; }
}
function showHint(t) {
  if (t === hintNow) return; hintNow = t;
  if (t) { hintEl.innerHTML = t; hintEl.className = 'on'; } else hintEl.className = '';
}

// ============================================================ stati di gioco
function startGame() {
  ensureAudio();
  newWorld();
  S.diffStart = P.z + 40; S.startZ = P.z; S.flatUntil = 40;
  AV.z = P.z - 42;
  state = 'play'; stateT = 0;
  touches = {};
  tutStep = 0; tutTimer = 0;
  popsEl.innerHTML = '';
  ['menu', 'over', 'pause'].forEach(function (id) { $(id).classList.add('hidden'); });
  $('hud').classList.remove('hidden'); $('aval').classList.remove('hidden');
}
function gameOver() {
  state = 'over';
  var m = Math.round(runMeters()), score = totalScore(), rec = score > save.best;
  if (rec) save.best = score;
  save.bestDist = Math.max(save.bestDist || 0, m); save.runs = (save.runs || 0) + 1;
  persist();
  $('overScore').textContent = fmt(score);
  $('overRecord').classList.toggle('hidden', !rec);
  $('overSub').textContent = rec ? 'Nuovo record personale!' : 'La valanga ti ha preso.';
  $('oDist').textContent = fmt(m) + ' m';
  $('oSpeed').textContent = Math.round(S.maxSpeed * 3.6) + ' km/h';
  $('oTricks').textContent = fmt(S.tricks);
  $('oCoins').textContent = fmt(S.coinN);
  $('oBest').textContent = S.bestTrick.pts ? S.bestTrick.name + ' · ' + fmt(S.bestTrick.pts) : 'Nessuno';
  $('bestOver').textContent = fmt(save.best);
  $('hud').classList.add('hidden'); $('aval').classList.add('hidden'); $('combo').classList.add('hidden');
  $('over').classList.remove('hidden');
  showHint('');
}
function showMenu() {
  state = 'menu';
  newWorld();
  $('bestMenu').textContent = fmt(save.best);
  $('menu').classList.remove('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.add('hidden'); $('aval').classList.add('hidden'); $('combo').classList.add('hidden');
  showHint('');
}
function togglePause() {
  if (state === 'play') { state = 'paused'; $('pause').classList.remove('hidden'); touches = {}; if (AU.ctx) AU.ctx.suspend(); }
  else if (state === 'paused') { state = 'play'; $('pause').classList.add('hidden'); if (AU.ctx) AU.ctx.resume(); }
}
function totalScore() { return Math.round(S.bank + runMeters() * 2); }
function tap(el, fn) { el.addEventListener('click', function (e) { e.preventDefault(); fn(); }); }
tap($('btnPlay'), startGame); tap($('btnAgain'), startGame); tap($('btnResume'), togglePause);
tap($('btnRestart'), startGame); tap($('btnQuit'), showMenu); tap($('btnPause'), togglePause);
tap($('btnMute'), function () { save.mute = !save.mute; persist(); ensureAudio(); if (AU.master) AU.master.gain.value = save.mute ? 0 : 0.9; updMuteIcon(); });
function updMuteIcon() { $('muteWave').style.display = save.mute ? 'none' : ''; $('muteX').style.display = save.mute ? '' : 'none'; }
document.addEventListener('visibilitychange', function () { if (document.hidden && state === 'play') togglePause(); });

// ============================================================ update
function update(dt) {
  S.time += dt;
  if (state === 'dying') {
    stateT += dt; AV.z += 30 * dt; P.speed *= 0.97;
    if (stateT > 1.5) { gameOver(); return; }
  } else updatePlayer(dt);
  if (state === 'menu' && P.crashed) P.crashed = false;
  updAval(dt);
  if (state === 'play' && combo.n > 0 && !P.air && !P.grind && !P.crashed) { combo.t -= dt; if (combo.t <= 0) bankCombo(); }
  if (state === 'play' && !P.air && !P.crashed && P.speed > S.maxSpeed) S.maxSpeed = P.speed;
}

// ============================================================ camera
var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camYaw = 0, camY = 0, camT = 0;
function focusPos(out) {
  if (P.crashed && S.rag) return out.copy(S.rag.body.p);
  return out.set(P.x, P.y, P.z);
}
var fpos = new THREE.Vector3();
function snapCamera() { camYaw = P.yaw; camY = P.y; updCamera(1, true); }
function updCamera(dt, snap) {
  focusPos(fpos);
  var menu = state === 'menu';
  var yawT = P.crashed ? camYaw : (P.air ? Math.atan2(P.vx, P.vz) : P.yaw) * 0.55;
  camYaw = snap ? yawT : lerp(camYaw, yawT, damp(2.5, dt));
  var groundY = Hgt(fpos.x, fpos.z);
  var baseY = P.air ? lerp(groundY, fpos.y, 0.55) : fpos.y;
  camY = snap ? baseY : lerp(camY, baseY, damp(P.air ? 2.5 : 6, dt));
  var dx = Math.sin(camYaw), dz = Math.cos(camYaw);
  var sp = P.air ? Math.hypot(P.vx, P.vz) : P.speed;
  var dist = 6.2 + clamp((sp - 15) * 0.08, 0, 1.6), h = 2.7;
  if (camera.aspect < 0.8) { dist += 1.2; h += 0.6; }
  var tx, ty, tz;
  if (menu) {
    camT += dt * 0.15;
    var a = 0.9 + Math.sin(camT) * 0.5;
    tx = fpos.x + Math.sin(a) * 6.5; tz = fpos.z + Math.cos(a) * 6.5 - 2; ty = fpos.y + 2.2;
    camLook.set(fpos.x, fpos.y + 0.9, fpos.z + 1.5);
  } else {
    tx = fpos.x - dx * dist; tz = fpos.z - dz * dist; ty = camY + h;
    camLook.set(fpos.x + dx * 6, (P.air ? lerp(fpos.y, groundY, 0.3) : fpos.y) + 0.6 - 0.4, fpos.z + dz * 6);
  }
  var minY = Hgt(tx, tz) + 1.2; if (ty < minY) ty = minY;
  if (snap) camPos.set(tx, ty, tz); else camPos.lerp(tmpV.set(tx, ty, tz), damp(menu ? 3 : 10, dt));
  camera.position.copy(camPos);
  if (shakeAmt > 0.01) { camera.position.x += (Math.random() - 0.5) * shakeAmt; camera.position.y += (Math.random() - 0.5) * shakeAmt; }
  shakeAmt *= Math.pow(0.03, dt);
  camera.lookAt(camLook);
}

// ============================================================ aggiornamento della grafica
var qBasis = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), qFlip = new THREE.Quaternion(), qLean = new THREE.Quaternion(), mBasis = new THREE.Matrix4();
var vUp = new THREE.Vector3(), vFwd = new THREE.Vector3(), vRight = new THREE.Vector3(), X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
function updRiderVisual(dt) {
  var p = P;
  if (p.crashed && S.rag) {
    var r = S.rag;
    rider.body.position.copy(r.body.p).add(tmpV.set(0, -0.6, 0)); rider.body.quaternion.copy(r.body.q);
    rider.board.position.copy(r.board.p); rider.board.quaternion.copy(r.board.q);
    poseRider({ c: 0.5, ga: 0, t: S.time, air: 1, flail: r.body.v.length() > 3 });
    rider.root.visible = true;
    return;
  }
  rider.root.position.set(p.x, p.y, p.z);
  if (p.air) vUp.lerp(Y_AXIS, damp(4, dt)).normalize();
  else if (p.grind) vUp.lerp(Y_AXIS, damp(10, dt)).normalize();
  else { normalAt(p.x, p.z, tmpV2); vUp.lerp(tmpV2, damp(12, dt)).normalize(); }
  var yaw = p.air ? Math.atan2(p.vx, p.vz) : p.yaw;
  vFwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  if (p.grind) { var gr = p.grind; vFwd.set(gr.x2 - gr.x1, gr.y2 - gr.y1, gr.z2 - gr.z1).normalize(); }
  vFwd.addScaledVector(vUp, -vFwd.dot(vUp)).normalize();
  vRight.crossVectors(vUp, vFwd).normalize();
  mBasis.makeBasis(vRight, vUp, vFwd);
  qBasis.setFromRotationMatrix(mBasis);
  qFlip.setFromAxisAngle(X_AXIS, p.air ? p.flip : 0);
  qSpin.setFromAxisAngle(Y_AXIS, p.spin);
  qLean.setFromAxisAngle(Z_AXIS, p.air ? 0 : p.lean);
  rider.root.quaternion.copy(qBasis).multiply(qFlip).multiply(qSpin).multiply(qLean);
  // durante il flip ruota attorno al baricentro, non ai piedi
  if (p.air && Math.abs(p.flip) > 0.01) {
    var off = tmpV.set(0, 0.7, 0).applyQuaternion(qBasis), off2 = tmpV2.set(0, 0.7, 0).applyQuaternion(rider.root.quaternion);
    rider.root.position.add(off).sub(off2);
  }
  rider.root.visible = !(p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0);
  poseRider({ c: p.crouch, ga: p.grabAmt, grab: p.grab || p.lastGrab, t: S.time, air: p.airAmt });
}
function updMarkers() {
  var p = P;
  if (p.air && !p.crashed && state === 'play' && p.airT > 0.15 && p.tti < 1.6) {
    ring.visible = true;
    ring.position.set(p.landX, p.landY + 0.06, p.landZ);
    normalAt(p.landX, p.landZ, tmpV); ring.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
    var sErr = spinErr(p.spin + p.spinRate * Math.min(p.tti, 0.3)), fErr = Math.abs(p.flipTo - p.flip) + Math.abs(wrapA(p.flip));
    var ok = sErr < 0.5 && fErr < 0.6 && !p.grab;
    ringMat.color.setHex(ok ? 0x4fe0b0 : 0xff3b4f);
    ringMat.opacity = 0.5 + 0.4 * (1 - clamp(p.tti / 1.6, 0, 1));
  } else ring.visible = false;
  var f = P.crashed && S.rag ? S.rag.body.p : tmpV2.set(p.x, p.y, p.z);
  var gy = Hgt(f.x, f.z), alt = f.y - gy;
  blob.position.set(f.x, gy + 0.04, f.z);
  normalAt(f.x, f.z, tmpV); blob.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
  blob.material.opacity = clamp(0.28 - alt * 0.03, 0, 0.28);
  blob.scale.setScalar(1 + alt * 0.04);
}
function updWorldVisual(dt) {
  for (var i = 0; i < S.coins.length; i++) {
    var s = S.coins[i], c = s.userData.coin;
    if (c.taken) { c.taken += dt * 3; s.position.y = c.y + c.taken * 1.5; var sc2 = 1 + c.taken; s.scale.set(sc2, sc2, 1); s.material = coinMat; s.visible = c.taken < 1; }
    else { s.position.y = c.y + Math.sin(S.time * 3 + c.ph) * 0.12; var k = 0.95 + Math.sin(S.time * 4 + c.ph) * 0.08; s.scale.set(k, k, 1); }
  }
  for (var j = 0; j < S.flags.length; j++) { var fl = S.flags[j].userData.flag; fl.rotation.y = Math.sin(S.time * 6 + j) * 0.35; }
  // valanga
  var gap = focusZ() - AV.z, show = (state === 'play' || state === 'dying') && gap < 42;
  avGroup.visible = show;
  if (show) {
    for (var a = 0; a < avPuffs.length; a++) {
      var sp = avPuffs[a], u = sp.userData;
      var z = AV.z + u.oz, x = cxAt(z) + u.ox * (hwAt(z) + 10);
      var y = terrainH(x, z) + u.oy * 12 + Math.sin(S.time * 2 + u.ph) * 0.8 + 2;
      sp.position.set(x, y, z);
      var ss = u.s * (1 + Math.sin(S.time * 1.5 + u.ph) * 0.1); sp.scale.set(ss, ss, 1);
      sp.material.color.copy(pal.fog).lerp(COLS.snow, 0.7);
    }
    if (Math.random() < 0.5) part(cxAt(AV.z) + (Math.random() - 0.5) * 30, terrainH(cxAt(AV.z), AV.z) + Math.random() * 6, AV.z + 1, (Math.random() - 0.5) * 6, Math.random() * 4, AV.speed + Math.random() * 6, 1, 0.6 + Math.random() * 0.8);
  }
  var danger = state === 'play' ? clamp(1 - gap / 25, 0, 1) : state === 'dying' ? 1 : 0;
  $('danger').style.opacity = (danger * (0.6 + 0.4 * Math.sin(S.time * (6 + danger * 6)))).toFixed(3);
  var white = state === 'dying' ? clamp((stateT - 0.2) / 1.0, 0, 1) : clamp(1 - (gap + 4) / 10, 0, 0.85) * (state === 'play' ? 1 : 0);
  $('white').style.opacity = white.toFixed(3);
}
function updLights() {
  var f = P.crashed && S.rag ? S.rag.body.p : tmpV2.set(P.x, P.y, P.z);
  var sd = tmpV.set(pal.sd[0], Math.max(0.35, pal.sd[1] + 0.25), pal.sd[2]).normalize();
  sun.position.set(f.x + sd.x * 40, f.y + sd.y * 40, f.z + sd.z * 40);
  sun.target.position.set(f.x, f.y, f.z + 4);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  mountains.position.set(camera.position.x, f.y - 60, camera.position.z);
}

// ============================================================ HUD
var hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud() {
  if (state !== 'play' && state !== 'paused') return;
  setText('score', fmt(totalScore()));
  setText('dist', fmt(runMeters()) + ' m');
  var sp = P.crashed ? 0 : (P.air ? Math.hypot(P.vx, P.vz) : P.speed);
  setText('spd', Math.round(sp * 3.6) + ' km/h');
  setText('coins', S.coinN + (S.coinN === 1 ? ' fiocco' : ' fiocchi'));
  var gap = Math.max(0, focusZ() - AV.z);
  setText('avalM', Math.round(gap) + ' m');
  var wv = Math.round(clamp(1 - gap / 45, 0.03, 1) * 100) + '%'; if (hudCache.bar !== wv) { hudCache.bar = wv; $('avalBar').style.width = wv; }
  var warn = gap < 18; if (hudCache.warn !== warn) { hudCache.warn = warn; $('aval').classList.toggle('warn', warn); }
  var cv = combo.n > 0 && state === 'play';
  if (hudCache.cv !== cv) { hudCache.cv = cv; $('combo').classList.toggle('hidden', !cv); }
  if (cv) {
    setText('comboTxt', 'COMBO x' + Math.min(combo.n, 10) + '  ·  ' + fmt(combo.pts * Math.min(combo.n, 10)));
    var fr = (P.air || P.grind) ? 1 : clamp(combo.t / 2.4, 0, 1);
    $('comboBar').style.transform = 'scaleX(' + fr.toFixed(3) + ')';
  }
}

// ============================================================ loop principale
var last = 0, acc = 0, genT = 0;
function frame(ts) {
  var dt = last ? (ts - last) / 1000 : 0.016; last = ts;
  if (dt > 0.1) dt = 0.1;
  var running = state !== 'paused' && state !== 'over';
  if (running) {
    acc += dt; var n = 0;
    while (acc >= FIX && n < 20) { update(FIX); acc -= FIX; n++; if (state === 'over') break; }
    genT -= dt;
    if (genT <= 0 && state !== 'over') { genT = 0.25; genAhead(); pruneWorld(); }
    updParticles(dt);
    updateTutorial(dt);
  }
  updatePalette(state === 'menu' ? 0 : runMeters());
  updRiderVisual(running ? dt : 0);
  updCamera(running ? dt : 0, false);
  updMarkers();
  updWorldVisual(running ? dt : 0);
  updLights();
  updFlakes(running ? dt : 0);
  renderer.render(scene, camera);
  updateHud();
  updateAudio();
  requestAnimationFrame(frame);
}
function boot() {
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  updMuteIcon();
  showMenu();
  $('loading').style.display = 'none';
  requestAnimationFrame(frame);
}
window.__debug = {
  get S() { return S; }, get P() { return P; }, get state() { return state; }, get AV() { return AV; },
  start: startGame, crash: function () { crash('test'); }, ollie: ollie, flip: queueFlip,
  steer: function (v) { keySteer = v; }, grab: function (g) { keyGrab = g; }, H: function (x, z) { return Hgt(x, z); }, cx: function (z) { return cxAt(z); },
  step: function (n, bot) { for (var i = 0; i < n; i++) { if (bot) bot(P, S); update(FIX); if (state !== 'play') break; if (i % 30 === 0) { genAhead(); pruneWorld(); } } },
  info: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, objs: scene.children.length }; }
};
boot();
})();
