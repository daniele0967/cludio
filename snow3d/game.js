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
var save = { best: 0, runs: 0, tut: 0, mute: false, bestDist: 0, tutDone: false };
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
var GRAB_NAMES = { method: 'Method', indy: 'Indy', nose: 'Nose Grab', tail: 'Tail Grab', melon: 'Melon', stale: 'Stalefish' };

// ============================================================ renderer e scena
var canvas = $('game'), renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loading').textContent = 'Questo dispositivo non supporta il 3D (WebGL).';
  throw e;
}
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
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
  camera.fov = baseFov = clamp(vf, 56, 92);
  camera.updateProjectionMatrix();
  var sc = renderer.getPixelRatio() * H_ / (2 * Math.tan(camera.fov * PI / 360));
  pMat.uniforms.scale.value = sc; spMat.uniforms.scale.value = sc;
}
var baseFov = 60;

// ---- luci
var hemi = new THREE.HemisphereLight(0xdceeff, 0x8aa4c4, 1.2);
scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff3d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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
  snow: null, kicker: null,
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
// ---- neve: rilievo a mappa di normali (grana + solchi del gatto), materiale fisico e brillii che cambiano con il punto di vista
var snowNormal = (function () {
  var N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  var g = c.getContext('2d'), img = g.createImageData(N, N), h = new Float32Array(N * N);
  function pn(x, y, P, sd) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    function q(a, b) { return hash2(((a % P) + P) % P, ((b % P) + P) % P, sd); }
    return lerp(lerp(q(i, j), q(i + 1, j), u), lerp(q(i, j + 1), q(i + 1, j + 1), u), v);
  }
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var X = x / N, Y = y / N;
    h[y * N + x] = pn(X * 8, Y * 8, 8, 1) * 0.5 + pn(X * 24, Y * 24, 24, 2) * 0.3 + pn(X * 64, Y * 64, 64, 3) * 0.2 + Math.sin(X * TAU * 32) * 0.18;
  }
  for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) {
    var dx = h[y2 * N + (x2 + 1) % N] - h[y2 * N + (x2 + N - 1) % N], dy = h[((y2 + 1) % N) * N + x2] - h[((y2 + N - 1) % N) * N + x2];
    var nx = -dx * 3.2, ny = -dy * 3.2, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz), o = (y2 * N + x2) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
var sparkU = { uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.7) }, uSpark: { value: 1 } };
function snowMaterial() {
  var m = new THREE.MeshStandardMaterial({ map: snowTex, vertexColors: true, roughness: 0.78, metalness: 0, normalMap: snowNormal, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.55 });
  m.onBeforeCompile = function (sh) {
    sh.uniforms.uSunDir = sparkU.uSunDir; sh.uniforms.uSpark = sparkU.uSpark;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec3 uSunDir; uniform float uSpark;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n{ vec3 Vd = normalize(cameraPosition - vWP); vec3 cl = floor(vWP * 20.0);\n' +
        ' float h1 = fract(sin(dot(cl, vec3(12.9898, 78.233, 37.719))) * 43758.5453); float h2 = fract(h1 * 91.7); float h3 = fract(h1 * 37.3);\n' +
        ' vec3 nn = normalize(vec3(h2 - 0.5, 1.0, h3 - 0.5)); vec3 Hh = normalize(Vd + normalize(uSunDir));\n' +
        ' float gl = pow(max(dot(nn, Hh), 0.0), 260.0) * step(0.9, h1) * clamp(1.0 - length(cameraPosition - vWP) / 38.0, 0.0, 1.0);\n' +
        ' gl_FragColor.rgb += vec3(1.0, 0.97, 0.9) * gl * uSpark * 3.0; }');
  };
  return m;
}
M.snow = snowMaterial(); M.kicker = snowMaterial();
M.metal = new THREE.MeshStandardMaterial({ color: 0xc8d2e0, roughness: 0.22, metalness: 0.9 });
M.boxBlue = new THREE.MeshStandardMaterial({ color: 0x2c62c9, roughness: 0.5 });
M.boxTop = new THREE.MeshStandardMaterial({ color: 0xffcf3f, roughness: 0.35, metalness: 0.3 });
// riflessi: il cielo diventa la mappa d'ambiente dei materiali
var pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envRT = null, envAt = -1e9;
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
function updateEnv(m) {
  if (Math.abs(m - envAt) < 120) return; envAt = m;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 100); scene.environment = envRT.texture;
}
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
  sun.color.copy(pal.sun); sun.intensity = pal.sunI * 1.05;
  hemi.color.copy(pal.hemiS); hemi.groundColor.copy(pal.hemiG); hemi.intensity = pal.hemiI * 0.75;
  sparkU.uSunDir.value.set(pal.sd[0], Math.max(0.3, pal.sd[1]), pal.sd[2]); sparkU.uSpark.value = 1 - pal.star * 0.4;
  updateEnv(m);
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
    var cx = cxAt(zz), x = cx + (S.tut ? 0 : (R() - 0.5) * (i === 0 ? 7 : 16)), Hk = 1.35 + R() * 0.6 + d * 0.35, L = 5.2 + R() * 1.4, w = 2.1 + R() * 0.8;
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
  addFence(function () { return k.x - k.w - 5; }, k.z1 - 3, k.z1 + 26); addFence(function () { return k.x + k.w + 5; }, k.z1 - 3, k.z1 + 26);
  arcCoins(k, 22 + d * 4);
  return k.z1 + 40;
}
function arcCoins(k, v) {
  var lipY = Hgt(k.x, k.z1 - 0.01), s = 2 * k.Hk / k.L - SL, vy = v * s / Math.sqrt(1 + s * s), vz = v / Math.sqrt(1 + s * s);
  var lift = R() < 0.5 ? 0 : 1.6;
  for (var i = 1; i <= 7; i++) {
    var t = 0.1 + i * 0.12, z = k.z1 + vz * t, y = lipY + vy * t - 0.5 * G * t * t + 1.0 + lift;
    if (y < Hgt(k.x, z) + 1.2) break;
    if (i === 4 && R() < 0.3) addPower(k.x, y + 0.3, z); else addCoin(k.x, y, z);
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
  addFence(function (zz) { return cxAt(zz) - hwAt(zz) + 0.6; }, z0 - 12, z0 + 22); addFence(function (zz) { return cxAt(zz) + hwAt(zz) - 0.6; }, z0 - 12, z0 + 22);
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
    var cx = cxAt(zz), x = cx + (R() - 0.5) * (S.tut ? 2 : 12), L = 12 + R() * 8, kind = R() < 0.5 ? 'rail' : 'box', h = kind === 'box' ? 0.75 : 1.05;
    var x2 = x + (S.tut ? 0 : (R() - 0.5) * 2.5);
    var r = { x1: x, z1: zz, x2: x2, z2: zz + L, kind: kind, h: h };
    r.y1 = terrainH(x, zz) + 0.14; r.y2 = terrainH(x2, zz + L) + h;
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
  if (R() < 0.7) { var kz = z + 16, kx = cxAt(kz) + (R() - 0.5) * 10, kk = { x: kx, z0: kz, L: 5.5, z1: kz + 5.5, Hk: 1.3 + R() * 0.5, w: 2.2, big: false }; S.kickers.push(kk); addObj(kickerMesh(kk), kk.z1 + 2); arcCoins(kk, 20); }
  if (R() < 0.75) coinLine(z + 8, 9, function (i, zz) { return cxAt(zz) + off + Math.sin(i * 0.6) * 3; }, 0);
  return z + len;
}
var netTex = canvasTex(64, 64, function (c) {
  c.strokeStyle = 'rgba(255,106,40,0.95)'; c.lineWidth = 3;
  for (var i = 0; i <= 64; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 64); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(64, i); c.stroke(); }
  c.fillStyle = '#ff6a28'; c.fillRect(0, 0, 64, 6);
}, true);
var netMat = new THREE.MeshLambertMaterial({ map: netTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
function addFence(xFn, z0, z1) {
  var pos = [], uv = [], idx = [], n = Math.max(2, Math.round(z1 - z0)), u = 0;
  for (var i = 0; i <= n; i++) {
    var z = lerp(z0, z1, i / n), x = xFn(z), y = terrainH(x, z) - 0.05;
    pos.push(x, y, z, x, y + 1.3, z); uv.push(u, 0, u, 1.6); u += (z1 - z0) / n / 0.8;
    if (i < n) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  var m = new THREE.Mesh(g, netMat); m.userData.own = true;
  addObj(m, z1);
}
var chaletGlow = new THREE.MeshBasicMaterial({ color: 0xffcf7a });
var C_WOOD = new THREE.Color(0x7a4b2a), C_WOOD2 = new THREE.Color(0x5e3820), C_STONE = new THREE.Color(0x8a8f99), C_DOOR = new THREE.Color(0x3a2416);
var GEO_CH = mergeColored([
  { geo: new THREE.BoxGeometry(5.4, 0.5, 4.8).translate(0, 0.1, 0), color: function () { return C_STONE; } },
  { geo: new THREE.BoxGeometry(5, 3, 4.4).translate(0, 1.7, 0), color: function (x, y) { return (Math.floor(y * 2.2) % 2) ? C_WOOD : C_WOOD2; } },
  { geo: new THREE.ConeGeometry(4.2, 2.6, 4).rotateY(PI / 4).scale(1, 1, 0.92).translate(0, 4.5, 0), color: function (x, y, z, ny) { return ny > 0.15 ? C_SNOW : C_WOOD2; } },
  { geo: new THREE.BoxGeometry(0.6, 1.8, 0.6).translate(1.2, 5, 0.9), color: function (x, y, z, ny) { return ny > 0.9 ? C_SNOW : C_STONE; } },
  { geo: new THREE.BoxGeometry(0.08, 1.9, 1).translate(2.52, 1.2, 0), color: function () { return C_DOOR; } }
]);
var C_WIN = new THREE.Color(0xffe08a);
var GEO_WIN = mergeColored([
  { geo: new THREE.BoxGeometry(0.06, 0.8, 0.8).translate(2.53, 2, 1.4), color: function () { return C_WIN; } },
  { geo: new THREE.BoxGeometry(0.06, 0.8, 0.8).translate(2.53, 2, -1.4), color: function () { return C_WIN; } },
  { geo: new THREE.BoxGeometry(0.8, 0.8, 0.06).translate(0.8, 2, 2.23), color: function () { return C_WIN; } },
  { geo: new THREE.BoxGeometry(0.8, 0.8, 0.06).translate(-1, 2, 2.23), color: function () { return C_WIN; } }
]);
function addChalet(z) {
  var cx = cxAt(z), hw = hwAt(z), x = cx - hw - 10 - R() * 8, y = terrainH(x, z) - 0.3, rot = (R() - 0.5) * 0.4;
  var g = new THREE.Group();
  var m = new THREE.Mesh(GEO_CH, M.tree); m.castShadow = true; m.receiveShadow = true; g.add(m);
  g.add(new THREE.Mesh(GEO_WIN, chaletGlow));
  g.position.set(x, y, z); g.rotation.y = rot;
  addObj(g, z + 10);
  var ch = new THREE.Vector3(1.2, 6, 0.9).applyAxisAngle(Y_AXIS, rot);
  S.chalets.push({ x: x, z: z, cx: x + ch.x, cy: y + ch.y, cz: z + ch.z });
}
function nearChalet(x, z) { for (var i = 0; i < S.chalets.length; i++) { var c = S.chalets[i]; if (Math.abs(c.x - x) < 7 && Math.abs(c.z - z) < 7) return true; } return false; }
function secLine(z) {
  var d = diff(z), zz = z, n = 3 + (R() < 0.4 ? 1 : 0);
  for (var i = 0; i < n; i++) {
    var cx = cxAt(zz), x = cx + (R() - 0.5) * 3, Hk = 1.9 + R() * 0.5 + d * 0.4, L = 6.4 + R(), w = 2.6;
    var k = { x: x, z0: zz, L: L, z1: zz + L, Hk: Hk, w: w, big: false };
    S.kickers.push(k); addObj(kickerMesh(k), k.z1 + 2); arcCoins(k, 21 + d * 4);
    if (i === 0) { addFlag(x - w - 0.6, k.z1 - 0.2, true); addFlag(x + w + 0.6, k.z1 - 0.2, true); }
    zz += 34 + R() * 6;
  }
  return zz;
}
var SECTIONS = { line: secLine, cruise: secCruise, kicker: secKickers, big: secBig, drop: secDrop, rail: secRails, rocks: secRocks, trees: secTrees, rollers: secRollers };
var TUT_SEQ = ['kicker', 'cruise', 'big', 'rail', 'kicker', 'big', 'rail', 'line'];
function genSection() {
  var z = S.genZ;
  if (S.tut && z >= S.flatUntil) { var kt = TUT_SEQ[(S.tutI = (S.tutI || 0) + 1) % TUT_SEQ.length]; S.genZ = SECTIONS[kt](z) + 14 + R() * 8; if (kt === 'rail') { var tz = S.genZ - 6, tx = cxAt(tz); addPower(tx, Hgt(tx, tz) + 1.3, tz, (S.tutI % 4 === 2) ? 'slow' : 'jump'); } return; }
  if (z < S.flatUntil) { S.genZ = z + 40; return; }
  var d = diff(z);
  var w = { cruise: 0.5, kicker: 4, line: 2.6 + d, big: 2.2 + 1.4 * d, drop: 1.0 + 1.0 * d, rail: 2.4, rocks: 0.8 + 1.6 * d, trees: 0.5 + 1.2 * d, rollers: 1.4 };
  var tot = 0, k;
  for (k in w) if (k !== S.lastSec) tot += w[k];
  var r = R() * tot;
  for (k in w) { if (k === S.lastSec) continue; r -= w[k]; if (r <= 0) break; }
  S.lastSec = k;
  S.genZ = SECTIONS[k](z) + 8 + R() * 10;
  if (R() < 0.5) { var pz = S.genZ - 4, px = cxAt(pz) + (R() - 0.5) * 8; addPower(px, Hgt(px, pz) + 1.3, pz); }
  if (S.genZ > S.nextChalet) { addChalet(S.nextChalet); S.nextChalet += 170 + R() * 220; }
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
    if (Math.abs(xx - liftX(zz)) < 4.5 || nearChalet(xx, zz)) { sc.set(0.001, 0.001, 0.001); p.y -= 50; }
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
  S.powers = S.powers.filter(function (c) { return c.parent && !(c.userData.pw.taken > 1.2); });
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
var COLS = { snow: new THREE.Color(0xffffff), spark: new THREE.Color(0xffd65a), gold: new THREE.Color(0xffec96), smoke: new THREE.Color(0xd9e0ea) };
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
    if (p.kind === 'smoke') { p.vy += 0.3 * dt; p.vx *= 1 - 0.3 * dt; } else { p.vy -= (p.kind === 'spark' ? 18 : 9) * dt; var dr = 1 - 1.8 * dt; p.vx *= dr; p.vz *= dr; p.vy *= 1 - 0.8 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    var a = clamp(p.life / p.max, 0, 1);
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    var c = COLS[p.kind] || COLS.snow; pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pSize[i] = p.size * (p.kind === 'snow' ? (0.6 + (1 - a) * 0.8) : p.kind === 'smoke' ? (1 + (1 - a) * 3) : 1); pAlpha[i] = p.kind === 'snow' ? a * 0.85 : p.kind === 'smoke' ? a * 0.4 : a;
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
  function std(c, r, m, extra) { var o = { color: c, roughness: r, metalness: m || 0 }; if (extra) for (var k in extra) o[k] = extra[k]; return new THREE.MeshStandardMaterial(o); }
  var M2 = {
    jacket: std(0xff5a36, 0.72), jacketD: std(0xd84424, 0.75), reflect: std(0xf0f4f8, 0.3, 0.2),
    pants: std(0x223560, 0.85), pantsD: std(0x1a2849, 0.85), patch: std(0x141c33, 0.9),
    glove: std(0x1b2433, 0.6), cuff: std(0xffcf3f, 0.7), boot: std(0x2b2f38, 0.55), sole: std(0x111318, 0.8),
    helmet: std(0xf5f7fb, 0.32), helmetD: std(0x2a3140, 0.5), stripe: std(0xffcf3f, 0.5),
    skin: std(0xf2c29b, 0.7), goggle: std(0xffffff, 0.08, 0.6, { map: goggleTex, envMapIntensity: 1.6 }), strap: std(0x111827, 0.6),
    boardTop: std(0xffffff, 0.45, 0, { map: boardTex }), boardBase: std(0x0b2a4a, 0.35, 0.1), edge: std(0xc0c8d2, 0.25, 0.9), bind: std(0x111827, 0.5),
    pack: std(0x2c62c9, 0.7), packD: std(0x1b3f86, 0.75), scarf: std(0xffcf3f, 0.85)
  };
  // ---- tavola: sagoma vera con punte rialzate
  var board = new THREE.Group();
  var shp = new THREE.Shape(), L = 0.78, Wd = 0.15, Tw = 0.135;
  shp.moveTo(-Tw, -L + 0.16); shp.quadraticCurveTo(-Wd, -L + 0.04, -0.05, -L); shp.lineTo(0.05, -L); shp.quadraticCurveTo(Wd, -L + 0.04, Tw, -L + 0.16);
  shp.quadraticCurveTo(0.12, 0, Tw, L - 0.16); shp.quadraticCurveTo(Wd, L - 0.04, 0.05, L); shp.lineTo(-0.05, L); shp.quadraticCurveTo(-Wd, L - 0.04, -Tw, L - 0.16);
  shp.quadraticCurveTo(-0.12, 0, -Tw, -L + 0.16);
  function rocker(g) {
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { var z = p.getZ(i), a = Math.abs(z), lift = a > 0.52 ? Math.pow((a - 0.52) / 0.26, 2) * 0.09 : 0; p.setY(i, p.getY(i) + lift); }
    g.computeVertexNormals(); return g;
  }
  var baseG = new THREE.ExtrudeGeometry(shp, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
  baseG.rotateX(PI / 2); baseG.translate(0, 0.045, 0); rocker(baseG);
  var topG = new THREE.ShapeGeometry(shp, 10); topG.rotateX(-PI / 2);
  (function () { var uv = topG.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) / (2 * L) + 0.5, uv.getX(i) / 0.3 + 0.5); })();
  topG.translate(0, 0.0475, 0); rocker(topG);
  var baseM = new THREE.Mesh(baseG, [M2.boardBase, M2.edge]); baseM.castShadow = true; board.add(baseM);
  var topM = new THREE.Mesh(topG, M2.boardTop); topM.position.y = 0.001; board.add(topM);
  [-1, 1].forEach(function (s) {
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 16), M2.bind); disc.position.set(0, 0.06, s * 0.25); board.add(disc);
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.16), M2.bind); base.position.set(0, 0.075, s * 0.25); board.add(base);
    var hb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 12, 1, true, PI * 0.5, PI), M2.bind); hb.position.set(-0.02, 0.17, s * 0.25); hb.rotation.z = 0.18; board.add(hb);
    var st1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.07), M2.stripe); st1.position.set(0.03, 0.2, s * 0.25 + 0.035); board.add(st1);
    var st2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), M2.strap); st2.position.set(0.06, 0.12, s * 0.25 - 0.05); board.add(st2);
  });
  board.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  root.add(board);
  // ---- corpo: capsule a lunghezza fissa sulle ossa
  var body = new THREE.Group(); root.add(body);
  function add(m) { m.castShadow = true; body.add(m); return m; }
  function cap(mat, r, len) { var m = add(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 5, 12), mat)); m.userData.len = len; return m; }
  function sph(mat, r) { return add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)); }
  var pp = {
    thighB: cap(M2.pantsD, 0.105, 0.5), shinB: cap(M2.pantsD, 0.09, 0.47), thighF: cap(M2.pants, 0.105, 0.5), shinF: cap(M2.pants, 0.09, 0.47),
    kneeB: sph(M2.patch, 0.098), kneeF: sph(M2.patch, 0.098), hip: add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M2.pants)),
    bootB: new THREE.Group(), bootF: new THREE.Group(),
    torso: cap(M2.jacket, 0.19, 0.56), belly: sph(M2.jacketD, 0.16), hem: add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.215, 0.08, 16), M2.jacketD)),
    hood: add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10, 0, TAU, 0, PI * 0.6), M2.jacketD)),
    zip: add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.4, 0.02), M2.reflect)),
    uArmB: cap(M2.jacketD, 0.072, 0.31), lArmB: cap(M2.jacketD, 0.064, 0.3), uArmF: cap(M2.jacket, 0.072, 0.31), lArmF: cap(M2.jacket, 0.064, 0.3),
    handB: new THREE.Group(), handF: new THREE.Group(),
    neck: sph(M2.skin, 0.065), pack: new THREE.Group(), scarf: []
  };
  pp.hip.scale.set(1, 0.85, 1.25);
  [pp.bootB, pp.bootF].forEach(function (b) {
    var up = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.08, 4, 10), M2.boot); up.position.set(0, 0.06, 0); up.castShadow = true; b.add(up);
    var toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.14, 4, 10).rotateZ(PI / 2), M2.boot); toe.position.set(0.05, -0.02, 0); toe.castShadow = true; b.add(toe);
    var sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.15), M2.sole); sole.position.set(0.04, -0.085, 0); b.add(sole);
    body.add(b);
  });
  [pp.handB, pp.handF].forEach(function (h) {
    var palm = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M2.glove); palm.scale.set(1, 1.15, 0.85); palm.castShadow = true; h.add(palm);
    var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 12), M2.cuff); cuff.position.y = 0.08; h.add(cuff);
    var th = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.04, 3, 6), M2.glove); th.position.set(0.05, 0.02, 0.04); th.rotation.z = -0.6; h.add(th);
    body.add(h);
  });
  var packBox = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.3), M2.pack); packBox.castShadow = true; pp.pack.add(packBox);
  var packTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 4, 8).rotateX(PI / 2), M2.packD); packTop.position.y = 0.19; pp.pack.add(packTop);
  var packStr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.31), M2.reflect); packStr.position.y = -0.05; pp.pack.add(packStr);
  body.add(pp.pack);
  for (var k = 0; k < 4; k++) pp.scarf.push(add(new THREE.Mesh(new THREE.CylinderGeometry(0.042 - k * 0.006, 0.036 - k * 0.006, 1, 6), M2.scarf)));
  // testa: casco, maschera curva, cinghia
  var head = new THREE.Group(); body.add(head);
  var face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), M2.skin); face.castShadow = true; head.add(face);
  var helm = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14, 0, TAU, 0, PI * 0.56), M2.helmet); helm.position.y = 0.02; helm.castShadow = true; head.add(helm);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.012, 6, 28), M2.helmetD); rim.rotation.x = PI / 2; rim.position.y = 0.0; head.add(rim);
  for (var v = -1; v <= 1; v++) { var vent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.018), M2.helmetD); vent.position.set(-0.01, 0.15, v * 0.045); head.add(vent); }
  var strp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.035), M2.stripe); strp.position.set(0.0, 0.153, 0); strp.rotation.z = 0.05; head.add(strp);
  var gog = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.075, 20, 1, true, -PI * 0.33, PI * 0.66), M2.goggle); gog.rotation.y = PI / 2; gog.position.set(0.0, 0.02, 0); head.add(gog);
  var gogF = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.09, 20, 1, true, -PI * 0.36, PI * 0.72), M2.strap); gogF.rotation.y = PI / 2; gogF.position.set(-0.004, 0.02, 0); gogF.scale.set(1, 1, 1); head.add(gogF);
  var band = new THREE.Mesh(new THREE.CylinderGeometry(0.137, 0.137, 0.035, 22, 1, true), M2.strap); band.position.y = 0.02; head.add(band);
  pp.head = head;
  return { root: root, board: board, body: body, parts: pp };
})();
scene.add(rider.root);
var Y_AXIS = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
function seg(mesh, a, b) {
  tmpV.subVectors(b, a); var len = tmpV.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-4) mesh.quaternion.setFromUnitVectors(Y_AXIS, tmpV.multiplyScalar(1 / len));
  mesh.scale.set(1, Math.max(len, 0.001), 1);
}
var mQ = new THREE.Matrix4(), qA = new THREE.Vector3(), qB = new THREE.Vector3();
function basisQ(f, u, out) {
  qB.copy(u).normalize();
  qA.copy(f).addScaledVector(qB, -f.dot(qB));
  if (qA.lengthSq() < 1e-6) qA.set(1, 0, 0).addScaledVector(qB, -qB.x);
  qA.normalize();
  mQ.makeBasis(qA, qB, tmpV3.crossVectors(qA, qB));
  return out.setFromRotationMatrix(mQ);
}
var bU = new THREE.Vector3();
// capsula sull'osso a-b, orientata con il davanti del rider (non deformata)
function bone(mesh, a, b, facing) {
  bU.subVectors(b, a); var len = bU.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  basisQ(facing, bU, mesh.quaternion);
  var s = len / (mesh.userData.len || len); mesh.scale.set(1, clamp(s, 0.7, 1.3), 1);
}
function ik3(a, b, l1, l2, bend, out, end) {
  var d = tmpV2.subVectors(b, a), dist = d.length(), mx = l1 + l2 - 0.001;
  if (dist > mx) { d.multiplyScalar(mx / dist); dist = mx; }
  if (dist < 1e-4) dist = 1e-4;
  end.copy(a).add(d);
  var x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  d.multiplyScalar(1 / dist);
  tmpV3.copy(bend).addScaledVector(d, -bend.dot(d)).normalize();
  out.copy(a).addScaledVector(d, x).addScaledVector(tmpV3, h);
}
var JN = ['head', 'neck', 'pelvis', 'hipB', 'hipF', 'knB', 'knF', 'ftB', 'ftF', 'shB', 'shF', 'elB', 'elF', 'hB', 'hF'];
function newJoints() { var o = {}; JN.forEach(function (n) { o[n] = new THREE.Vector3(); }); return o; }
var J = newJoints(), JW = newJoints();
var BEND_KNEE = V(1, 0.2, 0), BEND_ELB = V(-0.3, -1, 0), hT1 = new THREE.Vector3(), hT2 = new THREE.Vector3();
// posizioni delle mani sui grab, nel sistema della tavola (x = punta dei piedi, z = muso)
var GRAB_POSE = {
  indy: { hand: 'B', at: [0.17, 0.13, -0.02], tuck: 0.6 }, method: { hand: 'F', at: [-0.17, 0.13, 0.05], tuck: 0.55 },
  nose: { hand: 'F', at: [0.0, 0.12, 0.66], tuck: 0.7 }, tail: { hand: 'B', at: [0.0, 0.12, -0.66], tuck: 0.7 },
  melon: { hand: 'F', at: [-0.17, 0.13, -0.05], tuck: 0.6 }, stale: { hand: 'B', at: [-0.17, 0.13, -0.12], tuck: 0.6 }
};
function computePose(o, J) {
  var c = o.c, g = o.ga, airA = o.air, t = o.t, gp = GRAB_POSE[o.grab] || GRAB_POSE.indy, cc = c + g * gp.tuck, tb = o.tb || 0;
  if (o.tk && o.tk !== 'spin') cc += tb * 0.55 * (1 - g);
  J.pelvis.set(-0.02 + cc * 0.06, 0.97 - cc * 0.36 + (o.bob || 0), 0);
  J.hipB.copy(J.pelvis).z -= 0.11; J.hipF.copy(J.pelvis).z += 0.11;
  var tw = g > 0.01 && o.grab === 'nose' ? 0.05 * g : g > 0.01 && o.grab === 'tail' ? -0.05 * g : 0;
  hT1.set(0, 0.13 + g * 0.03, -0.25 + tw); hT2.set(0, 0.13 + g * 0.03, 0.25 + tw);
  ik3(J.hipB, hT1, 0.46, 0.45, BEND_KNEE, J.knB, J.ftB);
  ik3(J.hipF, hT2, 0.46, 0.45, BEND_KNEE, J.knF, J.ftF);
  var lean = 0.1 + c * 0.24 + g * 0.28 + (o.tuck || 0) * 0.18 + (o.edge || 0) * 0.12;
  J.neck.copy(J.pelvis).add(tmpV.set(lean, 0.54 - c * 0.05 - g * 0.16, (o.twist || 0) * 0.06));
  J.head.copy(J.neck).add(tmpV.set(0.05 + g * 0.05, 0.2, (o.look || 0) * 0.05));
  J.shB.copy(J.neck).add(tmpV.set(0, -0.03, -0.19)); J.shF.copy(J.neck).add(tmpV.set(0, -0.03, 0.19));
  var sy = J.neck.y, wob = Math.sin(t * 5) * 0.03, tk = o.tuck || 0;
  hT1.set(0.08, sy - 0.33 + wob, -0.56); hT2.set(0.15, sy - 0.29 - wob, 0.56);
  if (o.edge) { hT1.y += o.edge * 0.12; hT2.y -= o.edge * 0.1; }
  if (tk > 0) { hT1.lerp(tmpV.set(0.32, sy - 0.25, -0.12), tk); hT2.lerp(tmpV.set(0.36, sy - 0.22, 0.14), tk); }
  hT1.lerp(tmpV.set(0.05, sy + 0.16, -0.62), airA); hT2.lerp(tmpV.set(0.1, sy + 0.2, 0.62), airA);
  if (g > 0.01) {
    var tgt = tmpV.set(gp.at[0], gp.at[1], gp.at[2]);
    if (gp.hand === 'B') { hT1.lerp(tgt, g); hT2.lerp(tmpV2.set(0.2, sy + 0.25, 0.58), g); }
    else { hT2.lerp(tgt, g); hT1.lerp(tmpV2.set(0.0, sy + 0.25, -0.62), g); }
  }
  if (o.tk && tb > 0.01 && g < 0.5) {
    var b2 = tb * (1 - g * 2);
    if (o.tk === 'spin') { hT1.lerp(tmpV.set(0.28, sy + 0.02, 0.22), b2 * 0.85); hT2.lerp(tmpV.set(0.05, sy + 0.38, 0.78), b2 * 0.85); }
    else { hT1.lerp(tmpV.set(0.3, J.knB.y + 0.06, -0.12), b2); hT2.lerp(tmpV.set(0.33, J.knF.y + 0.06, 0.16), b2); }
  }
  if (o.flair) { hT1.y += Math.sin(t * 9) * 0.08 * o.flair; hT2.y += Math.cos(t * 8) * 0.08 * o.flair; }
  ik3(J.shB, hT1, 0.31, 0.31, BEND_ELB, J.elB, J.hB);
  ik3(J.shF, hT2, 0.31, 0.31, BEND_ELB, J.elF, J.hF);
}
var aF = new THREE.Vector3(), aU = new THREE.Vector3(), aL = new THREE.Vector3(), aW = new THREE.Vector3(), aP = new THREE.Vector3(), aP2 = new THREE.Vector3(), aT = new THREE.Vector3();
function applyPose(J, facing, wind, t) {
  var pp = rider.parts;
  bone(pp.thighB, J.hipB, J.knB, facing); bone(pp.shinB, J.knB, J.ftB, facing); bone(pp.thighF, J.hipF, J.knF, facing); bone(pp.shinF, J.knF, J.ftF, facing);
  pp.kneeB.position.copy(J.knB).addScaledVector(facing, 0.02); pp.kneeF.position.copy(J.knF).addScaledVector(facing, 0.02);
  aU.subVectors(J.neck, J.pelvis); basisQ(facing, aU, pp.hip.quaternion); pp.hip.position.copy(J.pelvis);
  aU.subVectors(J.knB, J.ftB); basisQ(facing, aU, pp.bootB.quaternion); pp.bootB.position.copy(J.ftB);
  aU.subVectors(J.knF, J.ftF); basisQ(facing, aU, pp.bootF.quaternion); pp.bootF.position.copy(J.ftF);
  aT.subVectors(J.neck, J.pelvis);
  pp.torso.position.lerpVectors(J.pelvis, J.neck, 0.5); basisQ(facing, aT, pp.torso.quaternion);
  pp.torso.scale.set(0.9, clamp(aT.length() / 0.56, 0.8, 1.2), 1.15);
  pp.belly.position.lerpVectors(J.pelvis, J.neck, 0.22).addScaledVector(facing, 0.04);
  pp.hem.position.lerpVectors(J.pelvis, J.neck, 0.06); basisQ(facing, aT, pp.hem.quaternion);
  aU.copy(aT).normalize(); aF.copy(facing).addScaledVector(aU, -facing.dot(aU)).normalize();
  pp.zip.position.lerpVectors(J.pelvis, J.neck, 0.55).addScaledVector(aF, 0.19); basisQ(facing, aT, pp.zip.quaternion);
  basisQ(facing, aT, pp.pack.quaternion); pp.pack.position.lerpVectors(J.pelvis, J.neck, 0.6).addScaledVector(aF, -0.22);
  pp.hood.position.copy(J.neck).addScaledVector(aF, -0.09).addScaledVector(aU, 0.02); basisQ(aU.clone().negate(), aF.clone().negate(), pp.hood.quaternion);
  pp.neck.position.lerpVectors(J.neck, J.head, 0.42);
  aW.subVectors(J.head, J.neck); pp.head.position.copy(J.head); basisQ(facing, aW, pp.head.quaternion);
  bone(pp.uArmB, J.shB, J.elB, facing); bone(pp.lArmB, J.elB, J.hB, facing); bone(pp.uArmF, J.shF, J.elF, facing); bone(pp.lArmF, J.elF, J.hF, facing);
  aW.subVectors(J.hB, J.elB); basisQ(facing, aW.negate(), pp.handB.quaternion); pp.handB.position.copy(J.hB);
  aW.subVectors(J.hF, J.elF); basisQ(facing, aW.negate(), pp.handF.quaternion); pp.handF.position.copy(J.hF);
  aP.copy(J.neck).lerp(J.head, 0.2).addScaledVector(aF, -0.03);
  aL.subVectors(J.shF, J.shB).normalize();
  for (var k = 0; k < pp.scarf.length; k++) {
    aP2.copy(aP).addScaledVector(wind, 0.13).addScaledVector(aL, Math.sin(t * 15 + k * 1.4) * 0.025 * (k + 1)).y -= 0.012 * (k + 1);
    seg(pp.scarf[k], aP, aP2); aP.copy(aP2);
  }
}
var POSE_FACE = V(1, 0, 0), POSE_WIND = V(-0.3, 0.05, -1).normalize();
function poseRider(o) { computePose(o, J); applyPose(J, POSE_FACE, POSE_WIND, o.t); }

// ---- ragdoll: punti collegati da vincoli (Verlet)
var RLINKS = [['head', 'neck'], ['neck', 'pelvis'], ['shB', 'neck'], ['shF', 'neck'], ['shB', 'shF'], ['shB', 'pelvis'], ['shF', 'pelvis'], ['head', 'shB'], ['head', 'shF'],
  ['shB', 'elB'], ['elB', 'hB'], ['shF', 'elF'], ['elF', 'hF'], ['pelvis', 'hipB'], ['pelvis', 'hipF'], ['hipB', 'hipF'], ['hipB', 'shB'], ['hipF', 'shF'],
  ['hipB', 'knB'], ['knB', 'ftB'], ['hipF', 'knF'], ['knF', 'ftF']];
var RMIN = [['knB', 'knF', 0.14], ['ftB', 'ftF', 0.18], ['hB', 'pelvis', 0.2], ['hF', 'pelvis', 0.2], ['ftB', 'neck', 0.5], ['ftF', 'neck', 0.5], ['knB', 'neck', 0.35], ['knF', 'neck', 0.35], ['hB', 'head', 0.16], ['hF', 'head', 0.16]];
function makeRagdoll(vel, fwd) {
  rider.root.updateMatrixWorld(true);
  var m = rider.root.matrixWorld, R = { p: {}, q: {}, rest: [], face: V(1, 0, 0).transformDirection(m), wind: fwd.clone().negate() };
  JN.forEach(function (n) {
    var w = J[n].clone().applyMatrix4(m), v = vel.clone();
    if (n === 'head' || n === 'neck' || n === 'shB' || n === 'shF') v.addScaledVector(fwd, 3.2).y += 2.5;
    if (n === 'hB' || n === 'hF' || n === 'elB' || n === 'elF') { v.x += (Math.random() - 0.5) * 6; v.y += Math.random() * 4; v.z += (Math.random() - 0.5) * 4; }
    if (n === 'ftB' || n === 'ftF' || n === 'knB' || n === 'knF') v.addScaledVector(fwd, -2.2);
    R.p[n] = w; R.q[n] = w.clone().addScaledVector(v, -FIX);
  });
  RLINKS.forEach(function (l) { R.rest.push(R.p[l[0]].distanceTo(R.p[l[1]])); });
  return R;
}
var rD = new THREE.Vector3();
function stepRagdoll(R, dt) {
  var n, p, q, vx, vy, vz, i, it;
  for (i = 0; i < JN.length; i++) {
    n = JN[i]; p = R.p[n]; q = R.q[n];
    vx = (p.x - q.x) * 0.997; vy = (p.y - q.y) * 0.997; vz = (p.z - q.z) * 0.997;
    q.copy(p); p.x += vx; p.y += vy - G * dt * dt; p.z += vz;
  }
  for (it = 0; it < 8; it++) {
    for (i = 0; i < RLINKS.length; i++) {
      var a = R.p[RLINKS[i][0]], b = R.p[RLINKS[i][1]];
      rD.subVectors(b, a); var len = rD.length(); if (len < 1e-6) continue;
      var df = (len - R.rest[i]) / len * 0.5; a.addScaledVector(rD, df); b.addScaledVector(rD, -df);
    }
    for (i = 0; i < RMIN.length; i++) {
      var a2 = R.p[RMIN[i][0]], b2 = R.p[RMIN[i][1]];
      rD.subVectors(b2, a2); var l2 = rD.length(); if (l2 >= RMIN[i][2] || l2 < 1e-6) continue;
      var d2 = (l2 - RMIN[i][2]) / l2 * 0.5; a2.addScaledVector(rD, d2); b2.addScaledVector(rD, -d2);
    }
    for (i = 0; i < JN.length; i++) { p = R.p[JN[i]]; var gy = Hgt(p.x, p.z) + (JN[i] === 'head' ? 0.14 : 0.09); if (p.y < gy) p.y = gy; }
  }
  for (i = 0; i < JN.length; i++) {
    p = R.p[JN[i]]; q = R.q[JN[i]];
    var g2 = Hgt(p.x, p.z) + (JN[i] === 'head' ? 0.14 : 0.09);
    if (p.y <= g2 + 0.01) {
      var vyy = p.y - q.y;
      if (vyy < 0) q.y = p.y + vyy * 0.25;
      q.x = p.x - (p.x - q.x) * 0.86; q.z = p.z - (p.z - q.z) * 0.86;
    }
  }
}
function ragSpeed(R) { var s = 0; for (var i = 0; i < JN.length; i++) s += R.p[JN[i]].distanceTo(R.q[JN[i]]); return s / JN.length / FIX; }
function ragPose(R) {
  JN.forEach(function (n) { JW[n].copy(R.p[n]); });
  aL.subVectors(R.p.shF, R.p.shB).normalize(); aU.subVectors(R.p.neck, R.p.pelvis).normalize();
  R.face.crossVectors(aU, aL).normalize();
  applyPose(JW, R.face, R.wind, S.time);
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
  return { x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, speed: 15, gvx: 0, gvz: 15, vx: 0, vy: 0, vz: 0, vyG: 0, air: false, airT: 0, coyote: 0, lipPop: false,
    spin: 0, spin0: 0, flip: 0, flip0: 0, grab: null, grabAmt: 0, lastGrab: 'indy', airAmt: 0, crouch: 0.3, squash: 0, tuck: 0, brake: 0, skid: 0, edge: 0,
    charging: false, chargeT: 0, grind: null, grindT: 0, crashed: false, crashT: 0, inv: 0, trick: null, sprayT: 0, tti: 1, landX: 0, landZ: 0, landY: 0, predT: 0,
    tr: null, tq: [], done: [], lean: 0, toSpeed: 15, trailD: 0, slideTo: 0 };
}
function newWorld(tut) {
  clearWorld();
  var seed = (Math.random() * 1e9) | 0;
  S = { seed: seed, rand: rng(seed), genZ: -60, flatUntil: 60, diffStart: 1e12, startZ: 0, lastSec: '', nextChalet: 120, tier: 0, tut: !!tut,
    drops: [], rollers: [], kickers: [], rails: [], rocks: [], coins: [], flags: [], objs: [], chalets: [], powers: [], pw: {}, shield: false, slowPulse: 0,
    time: 0, bank: 0, coinN: 0, tricks: 0, bestTrick: { pts: 0, name: '' }, maxSpeed: 0, crashes: 0, rag: null, board: null };
  P = newPlayer();
  P.x = cxAt(0); P.z = 0; P.y = 0;
  AV = { z: -80, speed: 12, ema: 18 };
  combo = { pts: 0, n: 0, t: 0 };
  resetLift(); trailReset();
  genAhead();
  P.y = Hgt(P.x, P.z);
  resetRiderParts();
  snapCamera();
}
function runMeters() { return Math.max(0, P.z - S.startZ); }
function ragCenter() { return S.rag.p.pelvis; }
function focusZ() { return P.crashed && S.rag ? ragCenter().z : P.z; }
function speedMul() { return 1 + Math.min(0.9, S.tier * 0.07); }
function maxSpeed() { return Math.min(52, MAXS * speedMul() * (S.pw && S.pw.turbo > 0 ? 1.3 : 1)); }
function playing() { return state === 'play'; }

// ============================================================ trick: uno swipe = un trick preciso
var SPIN_NAMES = ['', '180', '360', '540', '720', '900', '1080'];
function trickFromSwipe(dx, dy, v) {
  // v = velocità dello swipe normalizzata sullo schermo: lento < 1.7, medio < 3.2, veloce < 5, velocissimo oltre
  var lvl = v < 1.7 ? 1 : v < 3.2 ? 2 : v < 5 ? 3 : 4;
  var a = Math.atan2(-dy, dx) * 180 / PI; // 0 = destra, 90 = su
  var sec = Math.round(a / 45); if (sec < 0) sec += 8; sec %= 8;
  var R = sec === 0, U = sec === 2, Lf = sec === 4, D = sec === 6, UR = sec === 1, UL = sec === 3, DL = sec === 5, DR = sec === 7;
  var sdir = (R || UR || DR) ? -1 : 1; // destra sullo schermo = verso negativo nel mondo
  if (R || Lf) return { kind: 'spin', name: (R ? 'Frontside ' : 'Backside ') + SPIN_NAMES[lvl], spin: sdir * lvl * PI, flip: 0, units: lvl, lvl: lvl };
  if (U || D) {
    var n = lvl >= 3 ? 2 : 1, nm = U ? 'Backflip' : 'Frontflip';
    return { kind: 'flip', name: (n === 2 ? 'Double ' : '') + nm, spin: 0, flip: (U ? -1 : 1) * n * TAU, flips: n, lvl: lvl };
  }
  var k = Math.min(3, lvl), up = UR || UL;
  var base = up ? 'Rodeo ' : 'Misty ', deg = [0, 540, 720, 900][k];
  return { kind: 'off', name: base + deg, spin: sdir * k * PI, flip: (up ? -1 : 1) * TAU, flips: 1, units: k, lvl: lvl };
}
function trickDur(t) { var r = Math.max(Math.abs(t.spin), Math.abs(t.flip)); if (t.kind === 'off') r = Math.sqrt(t.spin * t.spin + t.flip * t.flip) * 0.8; return Math.max(0.42, r / 10.5); }
function startTrick(t) {
  var p = P;
  if (!p.air || p.grind || p.crashed) return;
  if (p.tr) { if (p.tq.length < 1) { p.tq.push(t); swipeLabel(t.name, true); } return; }
  p.tr = { t: t, u: 0, dur: trickDur(t), s0: p.spin, f0: p.flip };
  swipeLabel(t.name, false);
  sfx('whoosh');
  tutEvent('swipe', t);
}
function easeTrick(u) { u = clamp(u, 0, 1); return u < 0.5 ? 2 * u * u * (1.5 - u) : 1 - 2 * (1 - u) * (1 - u) * (0.5 + (1 - u)); }
function updTrick(dt) {
  var p = P, tr = p.tr; if (!tr) return;
  var before = Math.floor((Math.abs(p.flip - tr.f0) + Math.abs(p.spin - tr.s0)) / PI);
  tr.u += dt / tr.dur;
  var e = easeTrick(tr.u);
  p.spin = tr.s0 + tr.t.spin * e; p.flip = tr.f0 + tr.t.flip * e;
  if (Math.floor((Math.abs(p.flip - tr.f0) + Math.abs(p.spin - tr.s0)) / PI) > before) sfx('whoosh');
  if (tr.u >= 1) { p.done.push(tr.t); p.tr = null; if (p.tq.length) startTrick(p.tq.shift()); }
}
function trickRemaining() { var tr = P.tr; if (!tr) return 0; var e = easeTrick(tr.u); return Math.max(Math.abs(tr.t.spin), Math.abs(tr.t.flip)) * (1 - e); }
function trickTimeLeft() { var t = P.tr ? (1 - P.tr.u) * P.tr.dur : 0; for (var i = 0; i < P.tq.length; i++) t += trickDur(P.tq[i]); return t; }

// ============================================================ input: joystick a sinistra, salto e swipe a destra
var keySteer = 0, keyFlip = 0, keyGrab = null, keyJump = false;
var joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
var act = { id: null, sx: 0, sy: 0, st: 0, lx: 0, ly: 0, lt: 0, still: 0, mode: '', swiped: false, grab: null };
var JOY_R = 56;
var joyEl = $('joy'), knobEl = $('joyKnob'), jumpEl = $('jumpBtn'), jumpLbl = $('jumpLbl'), jumpSub = $('jumpSub'), swipeEl = $('swipeLbl');
var trickEl = $('trickBtn'), grabEl = $('grabBtn'), trickSub = $('trickSub'), grabSub = $('grabSub');
var grabT = null, trickT = null, btnR = { t: null, g: null, at: 0 };
function inBtn(r, x, y) { return r && x > r.left - 12 && x < r.right + 12 && y > r.top - 12 && y < r.bottom + 12; }
function refreshBtns() { btnR.t = trickEl.getBoundingClientRect(); btnR.g = grabEl.getBoundingClientRect(); btnR.at = now(); }
function trickLevel(held) { return held < 0.2 ? 1 : held < 0.42 ? 2 : held < 0.66 ? 3 : 4; }
function joyGrab() { var j = joyInput(); if (Math.abs(j.x) < 0.35 && Math.abs(j.y) < 0.35) return 'indy'; if (Math.abs(j.y) >= Math.abs(j.x)) return j.y < 0 ? 'nose' : 'tail'; return j.x < 0 ? 'method' : 'melon'; }
function fireTrickBtn(held) {
  var j = joyInput(), dx = j.x, dy = j.y;
  if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) { dx = 1; dy = 0; }
  var v = [0, 1, 2.5, 4, 6][trickLevel(held)];
  if (!inAir() && canJump()) ollie();
  if (inAir()) startTrick(trickFromSwipe(dx * 100, dy * 100, v));
}
function minDim() { return Math.max(300, Math.min(W, H_)); }
function resetInput() {
  joy.id = null; joy.x = joy.y = 0; act.id = null; act.mode = ''; act.swiped = false; act.grab = null;
  keySteer = keyFlip = 0; keyGrab = null; keyJump = false; if (P) P.charging = false; grabT = null; trickT = null; trickEl.classList.remove('down'); grabEl.classList.remove('down');
  placeJoy(0, 0, 0, 0, false); jumpEl.classList.remove('down');
}
function placeJoy(x, y, dx, dy, on) {
  if (on) { joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; joyEl.classList.add('on'); }
  else { joyEl.style.left = ''; joyEl.style.top = ''; joyEl.classList.remove('on'); }
  knobEl.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
}
var swipeT = 0;
function swipeLabel(txt, queued) { swipeEl.textContent = (queued ? 'poi ' : '') + txt; swipeEl.className = 'on'; swipeT = 1.1; }
function joyInput() { return { x: clamp(joy.x + keySteer, -1, 1), y: clamp(joy.y + keyFlip, -1, 1) }; }
function grabInput() { if (grabT !== null) return joyGrab(); return act.mode === 'grab' ? act.grab : keyGrab; }
function canJump() { return !P.air || !!P.grind || P.coyote > 0; }
function inAir() { return P.air && !P.grind; }
function quadGrab(x, y) { var top = y < H_ * 0.5, right = x > W * 0.75; return top ? (right ? 'nose' : 'method') : (right ? 'indy' : 'tail'); }
function pressStart(id, x, y) {
  ensureAudio();
  if (state !== 'play' || P.crashed) return;
  if (!btnR.t || now() - btnR.at > 1000) refreshBtns();
  if (inBtn(btnR.g, x, y) && grabT === null) { grabT = id; grabEl.classList.add('down'); if (inAir()) tutEvent('grab'); return; }
  if (inBtn(btnR.t, x, y) && trickT === null) { trickT = { id: id, st: now() }; trickEl.classList.add('down'); return; }
  if (x < W * 0.45) { if (joy.id === null) { joy.id = id; joy.ox = x; joy.oy = y; joy.x = joy.y = 0; placeJoy(x, y, 0, 0, true); } return; }
  if (act.id !== null) return;
  act.id = id; act.sx = act.lx = x; act.sy = act.ly = y; act.st = act.lt = now(); act.still = now(); act.swiped = false; act.grab = null;
  if (inAir() && P.coyote <= 0) act.mode = 'air';
  else { act.mode = 'charge'; P.charging = true; P.chargeT = 0; }
  jumpEl.classList.add('down');
}
function pressMove(id, x, y) {
  if (id === grabT || (trickT && id === trickT.id)) return;
  if (id === joy.id) {
    var dx = x - joy.ox, dy = y - joy.oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
    joy.x = dx / JOY_R; joy.y = dy / JOY_R; placeJoy(joy.ox, joy.oy, dx, dy, true); return;
  }
  if (id !== act.id) return;
  var t = now();
  if (Math.abs(x - act.lx) + Math.abs(y - act.ly) > 3) act.still = t;
  act.lx = x; act.ly = y; act.lt = t;
  if (act.swiped) { if (act.mode === 'grab' && Math.hypot(x - act.gx, y - act.gy) > 30) act.mode = 'post'; return; }
  var sx = x - act.sx, sy = y - act.sy, dist = Math.sqrt(sx * sx + sy * sy);
  if (dist < minDim() * 0.085) return;
  var el = Math.max(25, t - act.st), v = dist / el * 1000 / minDim();
  act.swiped = true;
  if (P.grind) {
    if (Math.abs(sx) > Math.abs(sy)) toggleSlide(); else if (sy < 0) ollie();
    act.mode = 'post'; return;
  }
  if (inAir() && P.coyote <= 0) { startTrick(trickFromSwipe(sx, sy, v)); act.mode = 'post'; P.charging = false; return; }
  // a terra: swipe in su = salto (e il trick parte appena sei in aria)
  if (sy < -Math.abs(sx) * 0.5) { P.charging = false; ollie(); if (P.air) { act.mode = 'post'; } }
  else act.mode = 'post';
}
function pressEnd(id) {
  if (id === grabT) { grabT = null; grabEl.classList.remove('down'); return; }
  if (trickT && id === trickT.id) { var held = (now() - trickT.st) / 1000; trickT = null; trickEl.classList.remove('down'); if (state === 'play' && !P.crashed) fireTrickBtn(held); return; }
  if (id === joy.id) { joy.id = null; joy.x = joy.y = 0; placeJoy(0, 0, 0, 0, false); return; }
  if (id !== act.id) return;
  act.id = null; jumpEl.classList.remove('down');
  if (act.mode === 'charge' && !act.swiped && state === 'play' && !P.crashed && canJump()) ollie();
  act.mode = ''; P.charging = false;
}
function updHoldGrab() {
  // dito fermo a destra mentre sei in aria = grab (quadrante: in alto Method/Nose, in basso Tail/Indy); funziona anche dopo uno swipe
  if (act.id === null || !inAir() || P.coyote > 0) return;
  if ((act.mode === 'air' || act.mode === 'post' || act.mode === 'charge') && now() - act.still > 160) {
    act.mode = 'grab'; act.grab = quadGrab(act.lx, act.ly); act.gx = act.lx; act.gy = act.ly; P.charging = false; act.swiped = true;
    tutEvent('grab');
  }
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
// tastiera: frecce = joystick, Spazio = salto; in aria W/A/S/D + Q/E = trick, Shift = più rotazione
var KEY_TRICK = { KeyD: [1, 0], KeyA: [-1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyE: [1, -1], KeyQ: [-1, -1], KeyC: [1, 1], KeyZ: [-1, 1] };
var shiftLvl = 0;
window.addEventListener('keydown', function (e) {
  if (e.key === 'Shift') shiftLvl = 1;
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state === 'menu' || state === 'over') { startGame(false); return; }
    ensureAudio();
    if (state === 'play' && canJump()) { keyJump = true; P.charging = true; P.chargeT = 0; }
    else if (state === 'play' && inAir()) keyGrab = 'indy';
  }
  if (e.code === 'ArrowLeft') keySteer = -1;
  if (e.code === 'ArrowRight') keySteer = 1;
  if (e.code === 'ArrowUp') keyFlip = -1;
  if (e.code === 'ArrowDown') keyFlip = 1;
  var kt = KEY_TRICK[e.code];
  if (kt && state === 'play') {
    if (P.grind && kt[1] === 0) toggleSlide();
    else if (inAir()) startTrick(trickFromSwipe(kt[0] * 100, kt[1] * 100, shiftLvl ? 3.6 : 2.2));
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', function (e) {
  if (e.key === 'Shift') shiftLvl = 0;
  if (e.code === 'Space') { if (keyJump) { keyJump = false; if (state === 'play' && canJump()) ollie(); P.charging = false; } keyGrab = null; }
  if ((e.code === 'ArrowLeft' && keySteer < 0) || (e.code === 'ArrowRight' && keySteer > 0)) keySteer = 0;
  if ((e.code === 'ArrowUp' && keyFlip < 0) || (e.code === 'ArrowDown' && keyFlip > 0)) keyFlip = 0;
});
var lastBtn = '';
function updButtons(dt) {
  var p = P, pl = state === 'play' && !p.crashed;
  var lbl = !pl ? '' : p.grind ? 'rail' : (inAir() && p.coyote <= 0) ? (grabInput() ? 'grab' : 'air') : 'jump';
  if (lbl !== lastBtn) {
    lastBtn = lbl;
    jumpLbl.textContent = lbl === 'air' ? 'Swipe' : lbl === 'grab' ? 'Grab' : lbl === 'rail' ? 'Rail' : 'Salta';
    jumpSub.textContent = lbl === 'air' ? 'per i trick · fermo = grab' : lbl === 'grab' ? 'lascia prima di atterrare' : lbl === 'rail' ? '← → slide · tocca = salta' : 'tieni = più alto';
  }
  var c = p.charging && canJump() ? clamp(p.chargeT / 0.35, 0, 1) : 0;
  jumpEl.style.setProperty('--c', c.toFixed(3));
  var tl = trickT ? trickLevel((now() - trickT.st) / 1000) : 0;
  trickEl.style.setProperty('--c', (tl / 4).toFixed(2));
  var ts = trickT ? (['', '180 / flip', '360', '540', '720'][tl]) : (p.grind ? 'salta via' : 'joystick = direzione');
  if (trickSub.textContent !== ts) trickSub.textContent = ts;
  var gs = grabT !== null && inAir() ? GRAB_NAMES[joyGrab()] : p.grind ? 'joystick = trick rail' : 'tieni premuto';
  if (grabSub.textContent !== gs) grabSub.textContent = gs;
  if (swipeT > 0) { swipeT -= dt; if (swipeT <= 0) swipeEl.className = ''; }
}

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
  p.air = true; p.airT = 0; p.toSpeed = p.speed; p.spin0 = p.spin; p.flip0 = p.flip; p.predT = 0; p.tti = 1;
  p.tr = null; p.tq = []; p.done = [];
  p.trick = { grabs: {} };
  trailGap();
}
function ollie() {
  var p = P; if (state !== 'play' || p.crashed) return;
  var pop = (6.6 + 3.2 * (p.charging ? clamp(p.chargeT / 0.35, 0, 1) : 0)) * (S.pw.jump > 0 ? 1.55 : 1);
  if (p.grind) {
    var r = p.grind, dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
    p.vx = dir.x * p.speed; p.vy = dir.y * p.speed + pop * 0.9; p.vz = dir.z * p.speed;
    endGrind(); startAir(); p.railCool = 0.35;
  } else if (!p.air) {
    p.vx = p.gvx; p.vz = p.gvz; p.vy = p.vyG + pop;
    startAir();
  } else if (p.coyote > 0) {
    p.vy += pop * 0.8 + (p.lipPop ? 2.4 : 0); p.coyote = 0;
    if (p.lipPop) popup('Pop!', '', 'perfect');
  } else return;
  p.charging = false; p.chargeT = 0;
  sfx('jump');
  burst(p.x, p.y + 0.1, p.z, 12, 2.5, 1);
  tutEvent(pop > 8.5 ? 'charge' : 'jump');
}
function updatePlayer(dt) {
  var p = P;
  if (p.inv > 0) p.inv -= dt;
  if (p.railCool > 0) p.railCool -= dt;
  if (p.crashed) { updateRag(dt); return; }
  if (p.charging) p.chargeT += dt;
  var dm = diff(p.z);
  if (p.grind) updGrind(dt);
  else if (!p.air) updGround(dt, dm);
  else updAir(dt);
  if (p.crashed) return;
  var ct = 0.3 + Math.abs(p.yawRate) * 0.08 + p.tuck * 0.35 + p.brake * 0.2;
  if (p.charging && canJump()) ct = 0.45 + 0.5 * clamp(p.chargeT / 0.35, 0, 1);
  if (p.air) ct = p.tr ? 0.32 : 0.18; if (p.grind) ct = 0.42;
  p.squash *= Math.exp(-dt * 7);
  p.crouch = lerp(p.crouch, ct + p.squash, damp(14, dt));
  p.grabAmt = lerp(p.grabAmt, p.grab ? 1 : 0, damp(14, dt));
  p.airAmt = lerp(p.airAmt, p.air ? 1 : 0, damp(7, dt));
  p.edge = lerp(p.edge, p.air ? 0 : clamp(p.yawRate * 0.5, -1, 1), damp(8, dt));
  if (state === 'play') collide();
  if (!p.air && !p.grind) {
    p.sprayT -= dt;
    var rate = clamp((p.speed - 8) / 22, 0, 1) * (0.4 + Math.abs(p.yawRate) * 0.4) + p.brake * 0.8 + clamp(p.skid / 4, 0, 1);
    if (p.sprayT <= 0 && rate > 0.05) {
      p.sprayT = 0.012 / (0.2 + rate);
      var dx = Math.sin(p.yaw), dz = Math.cos(p.yaw), side = p.yawRate > 0 ? -1 : 1;
      part(p.x - dx * 0.5 + dz * 0.15 * side, p.y + 0.05, p.z - dz * 0.5 - dx * 0.15 * side, -dx * p.speed * 0.12 + dz * side * (1 + rate * 3.5), 1.2 + Math.random() * 2.8 * rate, -dz * p.speed * 0.12 - dx * side * (1 + rate * 3.5), 0.45 + Math.random() * 0.45, 0.18 + Math.random() * 0.4 * rate);
    }
    p.trailD += p.speed * dt;
    if (p.trailD > 0.35) { p.trailD = 0; trailAdd(p.x, Hgt(p.x, p.z) + 0.035, p.z, p.yaw); }
  }
  if (p.grind && Math.random() < 0.85) part(p.x + (Math.random() - 0.5) * 0.4, p.y, p.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, -2 + (Math.random() - 0.5) * 3, 0.3, 0.12, 'spark');
}
// a terra: velocità come vettore, la lamina tiene (carving) ma se curvi forte la tavola derapa
function updGround(dt, dm) {
  var p = P, j = joyInput(), mul = speedMul(), pl = state === 'play';
  var steer = pl ? -j.x : Math.sin(S.time * 0.5) * 0.4 - p.yaw * 0.8;
  if (pl && steer > 0.4) tutEvent('steerL'); if (pl && steer < -0.4) tutEvent('steerR');
  var tuck = pl ? clamp(-j.y, 0, 1) : 0, brake = pl ? clamp(j.y, 0, 1) : 0;
  p.tuck = lerp(p.tuck, tuck, damp(6, dt)); p.brake = lerp(p.brake, brake, damp(8, dt));
  var e = 0.25, hx = (Hgt(p.x + e, p.z) - Hgt(p.x - e, p.z)) / (2 * e), hz = (Hgt(p.x, p.z + e) - Hgt(p.x, p.z - e)) / (2 * e);
  var gl2 = 1 + hx * hx + hz * hz, gk = G * 0.72 * (1 + 0.3 * dm) * mul * (S.pw.turbo > 0 ? 1.6 : 1) / gl2;
  var vx = p.gvx - hx * gk * dt, vz = p.gvz - hz * gk * dt;
  // sterzo: la tavola gira, la velocità la segue grazie alla lamina
  p.yawRate = lerp(p.yawRate, steer * (2.2 - clamp(p.speed / 40, 0, 0.6)), damp(7, dt));
  p.yaw += p.yawRate * dt;
  var hxv = Math.sin(p.yaw), hzv = Math.cos(p.yaw);
  var vf = vx * hxv + vz * hzv, vl = vx * hzv - vz * hxv;
  var grip = 8.5 - p.brake * 5.5;
  var vl2 = vl * Math.exp(-grip * dt);
  vf += Math.abs(vl - vl2) * (0.55 - p.brake * 0.5);
  vl = vl2;
  var drag = 0.9 + 0.0085 / mul * (1 - 0.2 * dm) * (1 - 0.25 * p.tuck) * vf * vf + p.brake * 10 + Math.abs(p.yawRate) * vf * 0.05;
  vf = clamp(vf - drag * dt, 3, maxSpeed());
  p.skid = Math.abs(vl);
  vx = hxv * vf + hzv * vl; vz = hzv * vf - hxv * vl;
  // senza sterzo la tavola si allinea alla velocità (e quindi alla linea di massima pendenza)
  if (Math.abs(steer) < 0.08) p.yaw += wrapA(Math.atan2(vx, vz) - p.yaw) * 1.6 * dt;
  if (p.yaw > 1.4) { p.yaw = 1.4; p.yawRate = Math.min(p.yawRate, 0); } else if (p.yaw < -1.4) { p.yaw = -1.4; p.yawRate = Math.max(p.yawRate, 0); }
  p.gvx = vx; p.gvz = Math.max(vz, 1.5); p.speed = Math.hypot(p.gvx, p.gvz);
  var nx = p.x + p.gvx * dt, nz = p.z + p.gvz * dt, ny = Hgt(nx, nz);
  var pred = p.y + p.vyG * dt - 0.5 * G * dt * dt;
  if (ny < pred - 0.0006) {
    p.vx = p.gvx; p.vz = p.gvz; p.vy = p.vyG;
    p.lipPop = isNearLip(p.x, p.z);
    if (S.pw.jump > 0 && p.lipPop) p.vy += 4.5;
    p.x = nx; p.z = nz; p.y = pred; p.coyote = 0.16; startAir(); return;
  }
  p.vyG = (ny - p.y) / dt;
  p.x = nx; p.z = nz; p.y = ny;
  p.lean = lerp(p.lean, -p.yawRate * 0.24, damp(8, dt));
  // entrata dritta su un rail o un box
  if (!(p.railCool > 0)) for (var i = 0; i < S.rails.length; i++) {
    var r = S.rails[i]; if (p.z < r.z1 || p.z > r.z1 + 2.2) continue;
    var t = (p.z - r.z1) / (r.z2 - r.z1), rx = lerp(r.x1, r.x2, t), ry = lerp(r.y1, r.y2, t);
    if (Math.abs(p.x - rx) < 1.6 && Math.abs(ry - p.y) < 0.7) { p.vx = p.gvx; p.vy = p.vyG; p.vz = p.gvz; startAir(); mountRail(r, t); return; }
  }
  var cx = cxAt(p.z), hw = hwAt(p.z);
  if (Math.abs(p.x - cx) > hw + 4.5 && state === 'play' && p.inv <= 0 && !S.tut) crash('Sei finito tra gli alberi');
  if (S.tut && Math.abs(p.x - cx) > hw + 2) { p.gvx -= Math.sign(p.x - cx) * 30 * dt; }
}
function isNearLip(x, z) {
  for (var i = 0; i < S.kickers.length; i++) { var k = S.kickers[i]; if (Math.abs(x - k.x) < k.w + 0.5 && z > k.z1 - 1.2 && z < k.z1 + 1.2) return true; }
  return false;
}
function updAir(dt) {
  var p = P, pl = state === 'play';
  p.airT += dt; if (p.coyote > 0) p.coyote -= dt;
  if (pl) updHoldGrab();
  var gb = pl ? grabInput() : null;
  if (gb) { p.grab = gb; p.lastGrab = gb; p.trick.grabs[gb] = (p.trick.grabs[gb] || 0) + dt; } else p.grab = null;
  p.predT -= dt;
  if (p.predT <= 0) {
    p.predT = 0.05;
    var qx = p.x, qy = p.y, qz = p.z, qvy = p.vy, tt = 0;
    while (tt < 3) { qvy -= G * 0.025; qx += p.vx * 0.025; qy += qvy * 0.025; qz += p.vz * 0.025; tt += 0.025; if (qy <= Hgt(qx, qz)) break; }
    p.tti = tt; p.landX = qx; p.landZ = qz; p.landY = Hgt(qx, qz);
  }
  updTrick(dt);
  if (!p.tr) {
    // piccole correzioni col joystick e raddrizzamento vicino a terra
    {
      var assist = 1 - clamp(p.tti / 0.5, 0, 1), ts = Math.round(p.spin / PI) * PI, tf = Math.round(p.flip / TAU) * TAU;
      p.spin += clamp((ts - p.spin) * (1.5 + 8 * assist), -3.5, 3.5) * dt;
      p.flip += clamp((tf - p.flip) * (1.5 + 8 * assist), -3.2, 3.2) * dt;
    }
  }
  p.vy -= G * dt;
  p.vx *= 1 - 0.015 * dt; p.vz *= 1 - 0.015 * dt;
  var py = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  // rail "magnetici": basta passarci sopra scendendo a meno di 1,3 m
  // rail: se ci salti vicino il rider viene attirato sopra e si attacca per forza
  if (!(p.railCool > 0)) {
    for (var i = 0; i < S.rails.length; i++) {
      var r = S.rails[i]; if (p.z < r.z1 - 7 || p.z > r.z2 - 0.6) continue;
      var t = clamp((p.z - r.z1) / (r.z2 - r.z1), 0, 1), rx = lerp(r.x1, r.x2, t), ry = lerp(r.y1, r.y2, t), dxr = rx - p.x;
      if (Math.abs(dxr) < 3.5 && p.y > ry - 0.8) { var rvx = (r.x2 - r.x1) / (r.z2 - r.z1) * p.vz; p.vx += (dxr * 7 - (p.vx - rvx) * 2.5) * dt; }
      if (p.z >= r.z1 - 0.3 && Math.abs(dxr) < 2.4 && p.vy < 4 && p.y <= ry + 1.0 && py >= ry - 0.7) {
        if (p.tr) { p.spin = p.tr.s0 + p.tr.t.spin; p.flip = p.tr.f0 + p.tr.t.flip; p.done.push(p.tr.t); p.tr = null; }
        p.tq = []; mountRail(r, t); return;
      }
    }
  }
  var g = Hgt(p.x, p.z);
  if (p.y <= g) { p.y = g; land(); }
}
function spinErr(s) { var e = ((s % PI) + PI) % PI; return Math.min(e, PI - e); }
function land() {
  var p = P, pl = state === 'play';
  var rem = trickRemaining();
  if (p.tr && rem < 0.55) { p.spin = p.tr.s0 + p.tr.t.spin; p.flip = p.tr.f0 + p.tr.t.flip; p.done.push(p.tr.t); p.tr = null; p.lateLand = true; }
  var sErr = spinErr(p.spin), fErr = Math.abs(wrapA(p.flip));
  if (pl && p.inv <= 0 && (p.tr || sErr > 0.55 || fErr > 0.6 || (p.grab && (sErr > 0.3 || fErr > 0.3)))) {
    crash(p.tr ? 'Trick non chiuso: salto troppo corto' : p.grab ? 'Hai tenuto il grab troppo a lungo' : fErr > 0.6 ? 'Flip non chiuso' : 'Atterraggio storto'); return;
  }
  var perfectish = sErr < 0.1 && fErr < 0.12 && !p.grab && !p.lateLand;
  var sketchy = !perfectish && (sErr > 0.35 || fErr > 0.4 || !!p.grab || !!p.lateLand);
  p.lateLand = false;
  p.spin = Math.round(p.spin / PI) * PI; p.flip = 0;
  p.air = false;
  var n = normalAt(p.x, p.z, tmpV);
  var vIn = -(p.vx * n.x + p.vy * n.y + p.vz * n.z);
  // l'impatto contro la neve toglie velocità: atterrare sul pendio è meglio che in piano
  var keep = (sketchy ? 0.84 : 0.97) * (1 - clamp((vIn - 8) / 45, 0, 0.25));
  p.gvx = p.vx * keep; p.gvz = Math.max(1.5, p.vz * keep);
  var hs = Math.hypot(p.gvx, p.gvz), cap = Math.min(maxSpeed(), Math.max(p.toSpeed * 1.12, 18));
  if (hs > cap) { p.gvx *= cap / hs; p.gvz *= cap / hs; }
  p.speed = Math.hypot(p.gvx, p.gvz);
  p.yaw = clamp(Math.atan2(p.gvx, p.gvz), -1.35, 1.35); p.yawRate = 0;
  p.vyG = (Hgt(p.x + p.gvx * 0.01, p.z + p.gvz * 0.01) - p.y) / 0.01;
  var imp = clamp(vIn / 20, 0.08, 1);
  p.squash = imp * 0.8; shakeAmt = Math.max(shakeAmt, imp * 0.35);
  sfx('land', imp * 1.3);
  burst(p.x, p.y + 0.05, p.z, 8 + Math.round(imp * 30), 3 + imp * 6, 1);
  if (pl) scoreTrick(perfectish, sketchy);
  p.grab = null;
  if (act.mode === 'grab') act.mode = 'post';
}
var SPIN_PTS = [0, 300, 900, 1800, 3000, 4500, 6300, 8400];
function trickPts(t) {
  if (t.kind === 'spin') return SPIN_PTS[Math.min(t.units, 7)];
  if (t.kind === 'flip') return 1500 * t.flips * (t.flips + 1) / 2;
  return Math.round((1500 + SPIN_PTS[Math.min(t.units, 7)]) * 1.4);
}
function scoreTrick(perfectish, sketchy) {
  var t = P.trick; if (!t) return;
  P.trick = null;
  var parts = [], pts = 0, done = P.done;
  var grabNames = [];
  for (var k in t.grabs) { var tm = t.grabs[k]; if (tm > 0.12) { grabNames.push(GRAB_NAMES[k]); pts += 250 + Math.round(tm * 800); } }
  for (var i = 0; i < done.length; i++) { parts.push(done[i].name); pts += trickPts(done[i]); }
  if (done.length > 1) pts *= 1 + (done.length - 1) * 0.35;
  if (grabNames.length) { if (parts.length) parts[parts.length - 1] += ' ' + grabNames.join(' '); else parts.push(grabNames.join(' ')); }
  if (P.airT > 1.0) { parts.push(P.airT > 1.8 ? 'Huge Air' : 'Big Air'); pts += Math.round(P.airT * 250); }
  P.done = [];
  if (!parts.length) return;
  var sw = Math.round(P.spin / PI) % 2 !== 0;
  if (sw && done.length) { parts.push('Switch'); pts += 200; }
  var perfect = perfectish && (done.length > 0 || grabNames.length > 0);
  if (perfect) pts *= 1.2;
  if (sketchy) pts *= 0.5;
  pts = Math.round(pts * (1 + S.tier * 0.1) / 10) * 10;
  addCombo(pts, parts.join(' + '), perfect ? 'perfect' : sketchy ? 'sketchy' : '');
  if (perfect && pts >= 2500) S.slowPulse = 0.5;
  if (perfect) { sfx('perfect'); var hs = P.speed, ns = Math.min(maxSpeed(), hs + 1.5); P.gvx *= ns / hs; P.gvz *= ns / hs; P.speed = ns; }
  for (var q = 0; q < done.length; q++) tutEvent('land', done[q]);
  if (grabNames.length) tutEvent('landgrab');
}
function addCombo(pts, label, tag) {
  if (S.pw.x2 > 0) pts *= 2;
  combo.pts += pts; combo.n++; combo.t = 2.6; S.tricks++;
  if (pts > S.bestTrick.pts) S.bestTrick = { pts: pts, name: label };
  popup(label, (tag === 'perfect' ? 'Perfect  ' : tag === 'sketchy' ? 'Sketchy  ' : '') + '+' + fmt(pts), tag);
  sfx('trick', Math.min(combo.n, 6));
  if (combo.n >= 2) tutEvent('combo');
}
function bankCombo() {
  var mult = Math.min(combo.n, 10), tot = combo.pts * mult;
  S.bank += tot;
  if (combo.n > 1) { popup('Combo x' + mult, '+' + fmt(tot), 'bank'); sfx('bank'); }
  combo.pts = 0; combo.n = 0; combo.t = 0;
}
var G_NAMES = { '5050': '50-50', board: 'Boardslide', lip: 'Lipslide', nose: 'Nose Press', tail: 'Tail Press' };
function mountRail(r, t) {
  var p = P;
  var dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
  p.speed = clamp(p.vx * dir.x + p.vy * dir.y + p.vz * dir.z, 9, Math.min(maxSpeed(), Math.max(p.toSpeed * 1.1, 16)));
  p.gBase = Math.round(p.spin / PI) * PI;
  if (state === 'play') scoreTrick(false, false);
  p.flip = 0; p.tr = null; p.tq = [];
  p.grind = r; p.grindT = 0; p.grindPos = t; p.air = false; p.grab = null; p.squash = 0.35;
  p.gState = '5050'; p.gStateT = 0; p.gParts = []; p.gPitch = 0; p.kSlide = false;
  p.x = lerp(r.x1, r.x2, t); p.y = lerp(r.y1, r.y2, t); p.z = lerp(r.z1, r.z2, t); p.yaw = r.yaw;
  if (act.id !== null) act.mode = 'post';
  sfx('rail'); shakeAmt = Math.max(shakeAmt, 0.15);
  popup(r.kind === 'box' ? 'Box!' : 'Rail!', 'joystick = trick sul rail', '');
  tutEvent('grind');
}
function toggleSlide() { if (P.grind) P.kSlide = !P.kSlide; }
function endGrind() {
  var p = P, r = p.grind, tm = p.grindT;
  p.grind = null;
  if (p.gStateT > 0.2) p.gParts.push(p.gState);
  var names = [], last = '';
  for (var i = 0; i < p.gParts.length; i++) { var n = p.gParts[i] === '5050' && r.kind === 'box' ? '50-50 Box' : G_NAMES[p.gParts[i]]; if (n !== last) names.push(n); last = n; }
  if (!names.length) names.push(r.kind === 'box' ? '50-50 Box' : '50-50');
  var styled = p.gParts.filter(function (g) { return g !== '5050'; }).length;
  p.spin = p.gBase; p.gPitch = 0;
  if (state === 'play' && tm > 0.2) addCombo(Math.round((250 + tm * 650 + (names.length - 1) * 450 + styled * 300) / 10) * 10, names.slice(0, 4).join(' → '), '');
}
function updGrind(dt) {
  var p = P, r = p.grind, len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1), sl = (r.y1 - r.y2) / len;
  var j = state === 'play' ? joyInput() : { x: 0, y: 0 }, st = '5050';
  if (Math.abs(j.x) > 0.45 && Math.abs(j.x) >= Math.abs(j.y)) st = j.x > 0 ? 'board' : 'lip';
  else if (j.y < -0.45) st = 'nose'; else if (j.y > 0.45) st = 'tail';
  if (p.kSlide && st === '5050') st = 'board';
  if (st !== p.gState) { if (p.gStateT > 0.2) p.gParts.push(p.gState); p.gState = st; p.gStateT = 0; sfx('rail'); swipeLabel(G_NAMES[st], false); if (st !== '5050') tutEvent('railtrick'); }
  p.gStateT += dt;
  var tgt = p.gBase + (st === 'board' ? -PI / 2 : st === 'lip' ? PI / 2 : 0);
  p.spin = lerp(p.spin, tgt, damp(16, dt));
  p.gPitch = lerp(p.gPitch, st === 'nose' ? 0.24 : st === 'tail' ? -0.24 : 0, damp(12, dt));
  p.speed = clamp(p.speed + (G * sl * 0.55 - 0.6 - (st !== '5050' ? 0.6 : 0)) * dt, 7, maxSpeed());
  p.grindPos += p.speed * dt / len; p.grindT += dt;
  if (p.grindPos >= 1) {
    var dir = tmpV.set(r.x2 - r.x1, r.y2 - r.y1, r.z2 - r.z1).normalize();
    p.vx = dir.x * p.speed; p.vy = dir.y * p.speed + 1.4; p.vz = dir.z * p.speed;
    endGrind(); startAir(); p.coyote = 0.15; p.lipPop = false; p.railCool = 0.4; return;
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
  for (var w = 0; w < S.powers.length; w++) {
    var ps = S.powers[w], pd = ps.userData.pw; if (pd.taken) continue;
    var ex = pd.x - p.x, ey = pd.y - by, ez = pd.z - p.z;
    if (ex * ex + ey * ey + ez * ez < 3.6) { pd.taken = 0.001; givePower(pd.type); for (var jj = 0; jj < 16; jj++) part(pd.x, pd.y, pd.z, (Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7, 0.6, 0.25, 'gold'); }
  }
  if (S.pw.magnet > 0) for (var m = 0; m < S.coins.length; m++) {
    var mc = S.coins[m].userData.coin; if (mc.taken) continue;
    var mx = p.x - mc.x, my = by - mc.y, mz = p.z - mc.z, md = Math.sqrt(mx * mx + my * my + mz * mz);
    if (md < 11) { var f = Math.min(1, FIX * 9 / Math.max(md, 0.5) * 3); mc.x += mx * f; mc.y += my * f; mc.z += mz * f; S.coins[m].position.x = mc.x; S.coins[m].position.z = mc.z; }
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
  if (S.shield && state === 'play') {
    // lo scudo salva: il rider si raddrizza e continua
    S.shield = false; p.inv = 1.6; popup('Salvato!', 'lo scudo ha retto', 'perfect'); sfx('perfect'); shakeAmt = Math.max(shakeAmt, 0.4);
    if (p.air) { p.tr = null; p.tq = []; p.spin = Math.round(p.spin / PI) * PI; p.flip = Math.round(p.flip / TAU) * TAU; p.grab = null; if (act.mode === 'grab') act.mode = 'post'; grabT = null; land(); }
    else { p.gvx *= 0.6; p.gvz *= 0.6; }
    burst(p.x, p.y + 0.5, p.z, 30, 5, 2); return;
  }
  var vx = p.air ? p.vx : p.gvx, vz = p.air ? p.vz : p.gvz, vy = p.air ? p.vy : p.vyG;
  var vel = new THREE.Vector3(vx, Math.max(vy, -6), vz), fwd = new THREE.Vector3(vx, 0, vz).normalize();
  updRiderVisual(0);
  S.rag = makeRagdoll(vel.clone().multiplyScalar(0.8), fwd);
  scene.attach(rider.board);
  scene.add(rider.body); rider.body.position.set(0, 0, 0); rider.body.quaternion.identity();
  S.board = { p: rider.board.position.clone(), v: new THREE.Vector3(vx * 0.9 + (Math.random() - 0.5) * 3, Math.max(vy, 0) * 0.4 + 5, vz * 0.9), q: rider.board.quaternion.clone(), w: new THREE.Vector3(9 + Math.random() * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10) };
  p.crashed = true; p.crashT = 0; p.air = false; p.grind = null; p.grab = null; p.trick = null; p.flip = 0; p.tr = null; p.tq = []; p.done = []; p.charging = false;
  if (act.id !== null) act.mode = 'post';
  if (combo.n > 0) popup('Combo persa', '', 'lost');
  combo.pts = 0; combo.n = 0; combo.t = 0;
  popup('Wipeout!', reason, 'lost');
  shakeAmt = 0.9; S.crashes++; if (!S.tut) AV.z += 6 + Math.min(8, runMeters() * 0.004);
  sfx('crash');
  burst(p.x, p.y + 0.3, p.z, 46, 7, 2);
  trailGap();
  (S.crashLog = S.crashLog || []).push(reason);
  tutEvent('crash', reason);
}
var qTmp = new THREE.Quaternion();
function stepRigid(o, dt, off) {
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
var ragDust = 0;
function updateRag(dt) {
  var p = P; p.crashT += dt;
  stepRagdoll(S.rag, dt); stepRigid(S.board, dt, 0.04);
  var sp = ragSpeed(S.rag), c = ragCenter();
  ragDust -= dt;
  if (sp > 3 && ragDust <= 0 && c.y - Hgt(c.x, c.z) < 0.4) { ragDust = 0.05; burst(c.x, c.y, c.z, 3, 2.5, 0.5); }
  if (state === 'play' && p.crashT > 1.4 && (sp < 1.2 || p.crashT > 2.6)) respawn();
}
function respawn() {
  var p = P, c = ragCenter(), z = c.z, cx = cxAt(z), hw = hwAt(z);
  var x = clamp(c.x, cx - hw + 2, cx + hw - 2);
  for (var tries = 0; tries < 40; tries++) {
    var bad = false;
    for (var i = 0; i < S.rocks.length; i++) { var o = S.rocks[i]; if (Math.abs(o.z - z) < 4 && Math.abs(o.x - x) < o.r + 1.2) bad = true; }
    for (var k = 0; k < S.kickers.length; k++) { var kk = S.kickers[k]; if (z > kk.z0 - 1 && z < kk.z1 + 2) bad = true; }
    for (var d = 0; d < S.drops.length; d++) { var dd = S.drops[d]; if (z > dd.z0 - 2 && z < dd.z0 + 4) bad = true; }
    for (var q = 0; q < S.rails.length; q++) { var rr = S.rails[q]; if (z > rr.z1 - 2 && z < rr.z2 + 1 && Math.abs(x - rr.x1) < 2) bad = true; }
    if (!bad) break; z += 1.5;
  }
  p.x = x; p.z = z; p.y = Hgt(x, z); p.yaw = 0; p.yawRate = 0; p.gvx = 0; p.gvz = 7; p.speed = 7; p.vyG = 0; p.spin = 0; p.flip = 0;
  p.crashed = false; p.inv = 1.5; p.air = false; p.squash = 0.5;
  S.rag = null; S.board = null;
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
  if (state !== 'play' || S.tut) return;
  var m = runMeters(), mul = speedMul();
  var cur = P.crashed ? 0 : (P.air ? Math.max(0, P.vz) : P.gvz);
  AV.ema += (cur - AV.ema) * dt / 5;
  AV.speed = clamp(AV.ema * 0.94 + 0.7, (9 + Math.min(9, m * 0.002)) * (1 + (mul - 1) * 0.8), (10 + Math.min(12, m * 0.0025)) * mul);
  AV.z += AV.speed * dt;
  var gap = focusZ() - AV.z;
  if (gap > 45) AV.z = focusZ() - 45;
  if (m < 200 && gap < 28) { AV.z = focusZ() - 28; gap = 28; }
  if (gap <= 0.5) caught();
}
function caught() {
  state = 'dying'; stateT = 0; shakeAmt = 1.2;
  popup('Travolto!', '', 'lost');
}

// ============================================================ tutorial a passi
var TSTEPS = [
  { title: 'Curva', text: 'Muovi il <b>joystick</b> a sinistra e poi a destra. Avanti accelera, indietro frena.', need: ['steerL', 'steerR'] },
  { title: 'Salto', text: 'Tocca il tasto <b>SALTA</b> a destra dello schermo.', need: ['jump'] },
  { title: 'Salto carico', text: '<b>Tieni premuto</b> SALTA finché l\'anello giallo è pieno, poi lascia.', need: ['charge'] },
  { title: '180', text: 'Prendi un kicker e in aria fai uno <b>swipe lento</b> a sinistra o a destra.', check: function (e, t) { return e === 'land' && t.kind === 'spin' && t.units === 1; } },
  { title: '360', text: 'Ora uno <b>swipe veloce</b> orizzontale. Più è veloce, più giri: 360, 540, 720.', check: function (e, t) { return e === 'land' && t.kind === 'spin' && t.units >= 2; } },
  { title: 'Flip', text: 'In aria <b>swipe in su</b> = backflip, <b>in giù</b> = frontflip. Meglio sui kicker grandi.', check: function (e, t) { return e === 'land' && t.kind === 'flip'; } },
  { title: 'Rodeo e Misty', text: '<b>Swipe in diagonale</b>: verso l\'alto = Rodeo, verso il basso = Misty.', check: function (e, t) { return e === 'land' && t.kind === 'off'; } },
  { title: 'Tasto Trick', text: 'Punta il <b>joystick</b> (o lascialo al centro) e premi <b>TRICK</b>. Tienilo più a lungo per più rotazione. A terra salta da solo.', check: function (e, t) { return e === 'land' && !!t; } },
  { title: 'Grab', text: 'In aria tieni premuto <b>GRAB</b>, anche durante un trick. Il joystick sceglie il grab. Lascia prima di atterrare.', need: ['landgrab'] },
  { title: 'Rail', text: 'Salta <b>vicino a un rail</b>: ti attacchi da solo. Entrare dritto funziona uguale.', need: ['grind'] },
  { title: 'Trick sul rail', text: 'Sul rail muovi il <b>joystick</b>: ← → Boardslide e Lipslide, ↑ Nose Press, ↓ Tail Press.', need: ['railtrick'] },
  { title: 'Poteri', text: 'Prendi una <b>sfera colorata</b>: Super salto, Slow-mo, Punti x2, Magnete, Scudo o Turbo.', need: ['power'] },
  { title: 'Combo', text: 'Fai <b>due trick di fila</b> senza restare troppo a terra: i punti si moltiplicano.', need: ['combo'] }
];
var tut = { i: 0, got: {}, doneT: 0 }, tutCard = $('tutCard'), tutTitle = $('tutTitle'), tutText = $('tutText'), tutStepEl = $('tutStep'), tutDots = $('tutDots'), tutTip = $('tutTip');
function tutShow() {
  var s = TSTEPS[tut.i]; if (!s) return;
  tutStepEl.textContent = 'Passo ' + (tut.i + 1) + ' di ' + TSTEPS.length;
  tutTitle.textContent = s.title; tutText.innerHTML = s.text; tutTip.textContent = '';
  var h = ''; for (var i = 0; i < TSTEPS.length; i++) h += '<i class="' + (i < tut.i ? 'ok' : i === tut.i ? 'now' : '') + '"></i>';
  tutDots.innerHTML = h; tutCard.classList.remove('done');
}
function tutEvent(ev, data) {
  if (!S || !S.tut || state !== 'play' || tut.doneT > 0) return;
  var s = TSTEPS[tut.i]; if (!s) return;
  if (ev === 'crash' && typeof data === 'string') {
    tutTip.textContent = data.indexOf('corto') >= 0 ? 'Consiglio: il salto era troppo corto. Prova uno swipe più lento o un kicker più grande.' : data.indexOf('storto') >= 0 || data.indexOf('Flip') >= 0 ? 'Consiglio: guarda il cerchio a terra, deve essere verde quando atterri.' : 'Riprova, nel tutorial la valanga non c\'è.';
    return;
  }
  var ok = false;
  if (s.need) { if (s.need.indexOf(ev) >= 0) { tut.got[ev] = true; ok = s.need.every(function (n) { return tut.got[n]; }); } }
  else if (s.check) ok = !!data && s.check(ev, data);
  if (ok) { tut.doneT = 1.1; tutCard.classList.add('done'); tutText.innerHTML = '<b>Fatto!</b> ' + s.title + ' completato.'; sfx('bank'); }
}
function updTut(dt) {
  if (!S || !S.tut || state !== 'play') return;
  if (tut.doneT > 0) {
    tut.doneT -= dt;
    if (tut.doneT <= 0) {
      tut.doneT = 0; tut.i++; tut.got = {};
      if (tut.i >= TSTEPS.length) { save.tutDone = true; persist(); tutFinish(); } else tutShow();
    }
  }
}
function tutFinish() {
  state = 'over';
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); $('combo').classList.add('hidden'); tutCard.classList.add('hidden');
  $('tutEnd').classList.remove('hidden');
}
// suggerimenti brevi nella prima partita vera (se il tutorial non è stato fatto)
var hintEl = $('hint'), hintNow = '';
function showHint(t) {
  if (t === hintNow) return; hintNow = t;
  if (t) { hintEl.innerHTML = t; hintEl.className = 'on'; } else hintEl.className = '';
}
function updateTutorial(dt) {
  updTut(dt);
  if (state !== 'play' || S.tut || save.tutDone || runMeters() > 260) { showHint(''); return; }
  showHint('Joystick a sinistra per curvare, <b>SALTA</b> a destra. In aria: <b>swipe</b> per i trick. Il <b>Tutorial</b> nel menu spiega tutto.');
}

// ============================================================ stati di gioco
function startGame(isTut) {
  ensureAudio();
  newWorld(isTut === true);
  S.diffStart = P.z + 40; S.startZ = P.z; S.flatUntil = 40;
  AV.z = P.z - 42;
  state = 'play'; stateT = 0;
  resetInput();
  popsEl.innerHTML = '';
  ['menu', 'over', 'pause', 'tricks', 'tutEnd'].forEach(function (id) { $(id).classList.add('hidden'); });
  $('hud').classList.remove('hidden'); $('controls').classList.remove('hidden');
  $('aval').classList.toggle('hidden', !!S.tut);
  tutCard.classList.toggle('hidden', !S.tut);
  if (S.tut) { tut.i = 0; tut.got = {}; tut.doneT = 0; tutShow(); }
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
  $('hud').classList.add('hidden'); $('aval').classList.add('hidden'); $('combo').classList.add('hidden'); $('controls').classList.add('hidden');
  $('over').classList.remove('hidden');
  showHint('');
}
function showMenu() {
  state = 'menu';
  newWorld();
  $('bestMenu').textContent = fmt(save.best);
  $('menu').classList.remove('hidden'); ['over', 'pause', 'tricks', 'tutEnd'].forEach(function (id) { $(id).classList.add('hidden'); });
  tutCard.classList.add('hidden'); $('btnTut').classList.toggle('glow', !save.tutDone);
  $('hud').classList.add('hidden'); $('aval').classList.add('hidden'); $('combo').classList.add('hidden'); $('controls').classList.add('hidden');
  showHint('');
}
function togglePause() {
  if (state === 'play') { state = 'paused'; $('pause').classList.remove('hidden'); resetInput(); if (AU.ctx) AU.ctx.suspend(); }
  else if (state === 'paused') { state = 'play'; $('pause').classList.add('hidden'); if (AU.ctx) AU.ctx.resume(); }
}
function totalScore() { return Math.round(S.bank + runMeters() * 2); }
function tap(el, fn) { el.addEventListener('click', function (e) { e.preventDefault(); fn(); }); }
tap($('btnPlay'), function () { startGame(false); }); tap($('btnAgain'), function () { startGame(false); }); tap($('btnResume'), togglePause);
tap($('btnRestart'), function () { startGame(S && S.tut); }); tap($('btnQuit'), showMenu); tap($('btnPause'), togglePause);
tap($('btnTut'), function () { startGame(true); }); tap($('btnTricks'), function () { $('tricks').classList.remove('hidden'); });
tap($('btnTricksClose'), function () { $('tricks').classList.add('hidden'); });
tap($('btnTutPlay'), function () { startGame(false); }); tap($('btnTutMenu'), showMenu);
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
  if (state === 'play' && !S.tut) {
    var tier = Math.floor(runMeters() / 450);
    if (tier > S.tier) { S.tier = tier; popup('Più veloce!', 'Livello ' + (tier + 1), 'bank'); sfx('bank'); shakeAmt = Math.max(shakeAmt, 0.2); }
  }
}

// ============================================================ camera
var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camYaw = 0, camY = 0, camT = 0;
function focusPos(out) {
  if (P.crashed && S.rag) return out.copy(ragCenter());
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
  var fovT = baseFov + (menu || P.crashed ? 0 : clamp((sp - 20) * 0.45, 0, 11));
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov = lerp(camera.fov, fovT, damp(3, dt || 0.016)); camera.updateProjectionMatrix(); }
}

// ============================================================ dettagli: solchi della tavola
var TRN = 320, trPos = new Float32Array(TRN * 2 * 3), trNor = new Float32Array(TRN * 2 * 3), trGeo = new THREE.BufferGeometry();
for (var ti = 0; ti < TRN * 2; ti++) trNor[ti * 3 + 1] = 1;
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('normal', new THREE.BufferAttribute(trNor, 3));
(function () { var idx = []; for (var i = 0; i < TRN - 1; i++) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } trGeo.setIndex(idx); })();
var trMesh = new THREE.Mesh(trGeo, new THREE.MeshLambertMaterial({ color: 0xc0d0e6, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
trMesh.frustumCulled = false; trMesh.renderOrder = 1; scene.add(trMesh);
var trail = [], trDirty = false;
function trailReset() { trail = []; trDirty = true; }
function trailAdd(x, y, z, yaw) { trail.push({ x: x, y: y, z: z, lx: Math.cos(yaw), lz: -Math.sin(yaw), w: 0.1 }); if (trail.length > TRN) trail.shift(); trDirty = true; }
function trailGap() { if (trail.length && trail[trail.length - 1].w > 0) { var l = trail[trail.length - 1]; trail.push({ x: l.x, y: l.y, z: l.z, lx: l.lx, lz: l.lz, w: 0 }); trDirty = true; } }
function trailBuild() {
  if (!trDirty) return; trDirty = false;
  var n = trail.length;
  for (var i = 0; i < TRN; i++) {
    var p = trail[Math.min(i, n - 1)] || { x: 0, y: -999, z: 0, lx: 0, lz: 0, w: 0 }, w = i < n ? p.w : 0;
    if (i > 0 && i < n && trail[i - 1].w === 0) w = 0;
    var o = i * 6;
    trPos[o] = p.x - p.lx * w; trPos[o + 1] = p.y; trPos[o + 2] = p.z - p.lz * w;
    trPos[o + 3] = p.x + p.lx * w; trPos[o + 4] = p.y; trPos[o + 5] = p.z + p.lz * w;
  }
  trGeo.attributes.position.needsUpdate = true;
}

// ============================================================ dettagli: scia luminosa della tavola in aria
var BTN = 46, btPos = new Float32Array(BTN * 2 * 3), btCol = new Float32Array(BTN * 2 * 3), btGeo = new THREE.BufferGeometry(), btPts = [];
btGeo.setAttribute('position', new THREE.BufferAttribute(btPos, 3)); btGeo.setAttribute('color', new THREE.BufferAttribute(btCol, 3));
(function () { var idx = []; for (var i = 0; i < BTN - 1; i++) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } btGeo.setIndex(idx); })();
var btMesh = new THREE.Mesh(btGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
btMesh.frustumCulled = false; scene.add(btMesh);
var btA = new THREE.Vector3(), btB = new THREE.Vector3(), btC = new THREE.Color();
function updBoardTrail() {
  var p = P, on = p.air && !p.crashed && state === 'play' && p.airT > 0.08;
  if (on) {
    rider.root.updateMatrixWorld(true);
    btA.set(0, 0.05, -0.72); rider.board.localToWorld(btA); btB.set(0, 0.05, 0.72); rider.board.localToWorld(btB);
    btPts.push({ a: btA.clone(), b: btB.clone() }); if (btPts.length > BTN) btPts.shift();
  } else if (btPts.length) { btPts.shift(); if (btPts.length) btPts.shift(); }
  btC.set(1, 0.78, 0.3); if (S.pw && S.pw.slow > 0) btC.set(0.6, 0.5, 1); else if (p.tr && p.tr.t.kind !== 'spin') btC.set(0.4, 0.9, 1);
  var n = btPts.length;
  for (var i = 0; i < BTN; i++) {
    var q = btPts[Math.min(i, n - 1)], o = i * 6, f = n ? (i / n) * (i < n ? 1 : 0) : 0;
    if (!q) { btPos[o + 1] = -9999; btPos[o + 4] = -9999; continue; }
    btPos[o] = q.a.x; btPos[o + 1] = q.a.y; btPos[o + 2] = q.a.z; btPos[o + 3] = q.b.x; btPos[o + 4] = q.b.y; btPos[o + 5] = q.b.z;
    var k = f * f * 0.85;
    btCol[o] = btC.r * k; btCol[o + 1] = btC.g * k; btCol[o + 2] = btC.b * k; btCol[o + 3] = btC.r * k; btCol[o + 4] = btC.g * k; btCol[o + 5] = btC.b * k;
  }
  btGeo.attributes.position.needsUpdate = true; btGeo.attributes.color.needsUpdate = true;
}

// ============================================================ poteri sulla pista
var PW = {
  jump: { name: 'Super salto', col: '#4fe0b0', dur: 14, glyph: 'up' }, slow: { name: 'Slow-mo', col: '#9a86ff', dur: 12, glyph: 'clock' },
  x2: { name: 'Punti x2', col: '#ffcf3f', dur: 16, glyph: 'x2' }, magnet: { name: 'Magnete', col: '#ff5a8a', dur: 16, glyph: 'mag' },
  shield: { name: 'Scudo', col: '#58d8ff', dur: 0, glyph: 'shield' }, turbo: { name: 'Turbo', col: '#ff7a2f', dur: 7, glyph: 'bolt' }
};
var PW_KEYS = ['jump', 'slow', 'x2', 'magnet', 'shield', 'turbo'];
PW_KEYS.forEach(function (k) {
  var d = PW[k];
  d.tex = canvasTex(128, 128, function (c) {
    var g = c.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, d.col); g.addColorStop(0.62, d.col); g.addColorStop(0.64, 'rgba(255,255,255,.95)'); g.addColorStop(0.72, 'rgba(255,255,255,.0)');
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(64, 64, 46, 0, TAU); c.fill();
    c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    if (d.glyph === 'up') { c.beginPath(); c.moveTo(64, 88); c.lineTo(64, 38); c.moveTo(44, 56); c.lineTo(64, 36); c.lineTo(84, 56); c.stroke(); }
    else if (d.glyph === 'clock') { c.lineWidth = 7; c.beginPath(); c.arc(64, 64, 24, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 48); c.moveTo(64, 64); c.lineTo(76, 70); c.stroke(); }
    else if (d.glyph === 'x2') { c.font = '900 40px -apple-system, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('x2', 64, 66); }
    else if (d.glyph === 'mag') { c.lineWidth = 11; c.beginPath(); c.arc(64, 58, 20, PI, 0); c.lineTo(84, 82); c.moveTo(44, 58); c.lineTo(44, 82); c.stroke(); }
    else if (d.glyph === 'shield') { c.beginPath(); c.moveTo(64, 36); c.lineTo(88, 46); c.quadraticCurveTo(88, 78, 64, 92); c.quadraticCurveTo(40, 78, 40, 46); c.closePath(); c.fill(); }
    else { c.beginPath(); c.moveTo(70, 34); c.lineTo(46, 68); c.lineTo(62, 68); c.lineTo(56, 94); c.lineTo(82, 58); c.lineTo(66, 58); c.closePath(); c.fill(); }
  });
  d.mat = new THREE.SpriteMaterial({ map: d.tex, transparent: true, depthWrite: false });
});
function addPower(x, y, z, type) {
  if (!type) type = PW_KEYS[Math.floor(R() * PW_KEYS.length)];
  var s = new THREE.Sprite(PW[type].mat); s.scale.set(1.5, 1.5, 1); s.position.set(x, y, z);
  s.userData.pw = { type: type, x: x, y: y, z: z, taken: 0, ph: R() * 6 };
  addObj(s, z); S.powers.push(s);
}
function givePower(type) {
  var d = PW[type];
  if (type === 'shield') S.shield = true; else S.pw[type] = d.dur;
  popup(d.name + '!', type === 'shield' ? 'salva una caduta' : type === 'slow' ? 'il tempo rallenta in aria' : type === 'jump' ? 'salti molto più alti' : type === 'x2' ? 'punti doppi' : type === 'magnet' ? 'attira i fiocchi' : 'più veloce', 'bank');
  sfx('perfect'); sfx('bank'); shakeAmt = Math.max(shakeAmt, 0.2);
  tutEvent('power');
}
var pwHtml = '';
function updPowersHud(dt) {
  var h = '';
  if (S && state === 'play') {
    for (var k in S.pw) { if (S.pw[k] > 0) { S.pw[k] -= dt; if (S.pw[k] > 0) h += '<span style="background:' + PW[k].col + '">' + PW[k].name + ' ' + Math.ceil(S.pw[k]) + 's</span>'; } }
    if (S.shield) h += '<span style="background:' + PW.shield.col + '">Scudo</span>';
  }
  if (h !== pwHtml) { pwHtml = h; $('powers').innerHTML = h; }
}

// ============================================================ dettagli: seggiovia
var GEO2 = {
  tower: mergeColored([
    { geo: new THREE.CylinderGeometry(0.22, 0.34, 10, 8).translate(0, 5, 0), color: function () { return new THREE.Color(0x8d98a8); } },
    { geo: new THREE.BoxGeometry(3.2, 0.3, 0.35).translate(0, 10, 0), color: function () { return new THREE.Color(0xffcf3f); } },
    { geo: new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12).rotateZ(PI / 2).translate(-1.35, 9.8, 0), color: function () { return new THREE.Color(0x2a3140); } },
    { geo: new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12).rotateZ(PI / 2).translate(1.35, 9.8, 0), color: function () { return new THREE.Color(0x2a3140); } }
  ]),
  chair: function (riders) {
    var parts = [
      { geo: new THREE.CylinderGeometry(0.035, 0.035, 2.1, 5).translate(0, -1.05, 0), color: function () { return new THREE.Color(0x5b6474); } },
      { geo: new THREE.BoxGeometry(1.5, 0.1, 0.55).translate(0, -2.2, 0), color: function () { return new THREE.Color(0xd23b2a); } },
      { geo: new THREE.BoxGeometry(1.5, 0.6, 0.08).translate(0, -1.9, -0.27), color: function () { return new THREE.Color(0xd23b2a); } },
      { geo: new THREE.BoxGeometry(1.6, 0.05, 0.05).translate(0, -1.45, 0.2), color: function () { return new THREE.Color(0x5b6474); } }
    ];
    var cols = [0x2c62c9, 0x4fe0b0, 0xffcf3f, 0x8a4fff];
    for (var i = 0; i < riders; i++) {
      var col = new THREE.Color(cols[(i * 3 + riders) % 4]), x = -0.4 + i * 0.8;
      parts.push({ geo: new THREE.BoxGeometry(0.34, 0.55, 0.3).translate(x, -1.85, -0.05), color: (function (c) { return function () { return c; }; })(col) });
      parts.push({ geo: new THREE.SphereGeometry(0.13, 8, 6).translate(x, -1.45, -0.05), color: function () { return new THREE.Color(0xf5f7fb); } });
      parts.push({ geo: new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(x, -2.15, 0.25), color: function () { return new THREE.Color(0x22325a); } });
    }
    return mergeColored(parts);
  }
};
var chairGeos = [GEO2.chair(0), GEO2.chair(1), GEO2.chair(2)];
var cableMat = new THREE.LineBasicMaterial({ color: 0x3a4250 });
var lift = { towers: [], lastZ: -200, meshes: [], cable: null, chairs: [] };
var chairMat = M.tree;
function liftX(z) { return cxAt(z) + hwAt(z) + 15; }
function resetLift() {
  lift.meshes.forEach(function (m) { scene.remove(m); }); lift.meshes = []; lift.towers = []; lift.lastZ = -200;
  if (lift.cable) { scene.remove(lift.cable); lift.cable.geometry.dispose(); lift.cable = null; }
  if (!lift.chairs.length) for (var i = 0; i < 22; i++) { var m = new THREE.Mesh(chairGeos[i % 3], chairMat); m.castShadow = false; m.visible = false; scene.add(m); lift.chairs.push(m); }
}
function genLift() {
  var changed = false;
  while (lift.lastZ < P.z + 330) {
    lift.lastZ += 44; var z = lift.lastZ, x = liftX(z), y = terrainH(x, z);
    var m = new THREE.Mesh(GEO2.tower, M.tree); m.position.set(x, y - 0.2, z); m.rotation.y = Math.atan2(liftX(z + 5) - liftX(z - 5), 10); scene.add(m);
    lift.meshes.push(m); lift.towers.push({ x: x, y: y + 9.8, z: z }); changed = true;
  }
  while (lift.towers.length > 2 && lift.towers[1].z < P.z - 80) { lift.towers.shift(); scene.remove(lift.meshes.shift()); changed = true; }
  if (changed) {
    var pos = [];
    for (var s = -1; s <= 1; s += 2) for (var i = 0; i < lift.towers.length - 1; i++) {
      for (var k = 0; k < 6; k++) { var a = cableAt(lift.towers, i, k / 6, s), b = cableAt(lift.towers, i, (k + 1) / 6, s); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    }
    if (lift.cable) { scene.remove(lift.cable); lift.cable.geometry.dispose(); }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lift.cable = new THREE.LineSegments(g, cableMat); lift.cable.frustumCulled = false; scene.add(lift.cable);
  }
}
var cabTmp = new THREE.Vector3();
function cableAt(T, i, t, side) {
  var a = T[i], b = T[i + 1];
  return cabTmp.set(lerp(a.x, b.x, t) + side * 1.35, lerp(a.y, b.y, t) - 0.9 * Math.sin(PI * t), lerp(a.z, b.z, t));
}
function updLift() {
  var T = lift.towers; if (T.length < 2) return;
  var z0 = T[0].z, span = T[T.length - 1].z - z0, n = lift.chairs.length;
  for (var c = 0; c < n; c++) {
    var side = c % 2 ? 1 : -1, dir = side > 0 ? -1 : 1;
    var u = ((c * 31 + dir * S.time * 2.4) % span + span) % span, z = z0 + u;
    var i = 0; while (i < T.length - 2 && T[i + 1].z < z) i++;
    var t = clamp((z - T[i].z) / (T[i + 1].z - T[i].z), 0, 1), p = cableAt(T, i, t, side);
    var m = lift.chairs[c]; m.visible = true; m.position.copy(p);
    m.rotation.set(0, Math.atan2(T[i + 1].x - T[i].x, T[i + 1].z - T[i].z) + (dir > 0 ? 0 : PI), Math.sin(S.time * 1.3 + c) * 0.04);
  }
}

// ============================================================ dettagli: nuvole, scie di velocità, brillii
var cloudMat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
var clouds = new THREE.Group(); scene.add(clouds);
(function () { var R2 = rng(5); for (var i = 0; i < 16; i++) { var s = new THREE.Sprite(cloudMat), a = (R2() - 0.5) * 3.2; s.position.set(Math.sin(a) * 420, 110 + R2() * 90, Math.cos(a) * 420); s.scale.set(140 + R2() * 120, 50 + R2() * 40, 1); s.renderOrder = -6; clouds.add(s); } })();
scene.add(camera);
var STN = 70, stPos = new Float32Array(STN * 6), stGeo = new THREE.BufferGeometry(), stData = [];
stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
var stMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
var streaks = new THREE.LineSegments(stGeo, stMat); streaks.frustumCulled = false; camera.add(streaks);
function stReset(d, far) { var a = Math.random() * TAU, r = 2.2 + Math.random() * 5; d.x = Math.cos(a) * r; d.y = Math.sin(a) * r * 0.65; d.z = far ? -10 - Math.random() * 40 : -50; }
for (var sti = 0; sti < STN; sti++) { var sd = {}; stReset(sd, true); stData.push(sd); }
function updStreaks(dt) {
  var sp = P.crashed ? 0 : (P.air ? Math.hypot(P.vx, P.vz) : P.speed);
  var op = clamp((sp - 21) / 14, 0, 0.55); stMat.opacity = op; streaks.visible = op > 0.01;
  if (!streaks.visible) return;
  var len = 0.6 + sp * 0.08;
  for (var i = 0; i < STN; i++) {
    var d = stData[i]; d.z += sp * 1.6 * dt; if (d.z > 0.5) stReset(d, false);
    var o = i * 6; stPos[o] = d.x; stPos[o + 1] = d.y; stPos[o + 2] = d.z; stPos[o + 3] = d.x; stPos[o + 4] = d.y; stPos[o + 5] = d.z - len;
  }
  stGeo.attributes.position.needsUpdate = true;
}
var SPN = 260, spPos = new Float32Array(SPN * 3), spPh = new Float32Array(SPN), spGeo = new THREE.BufferGeometry();
for (var spi = 0; spi < SPN; spi++) { spPh[spi] = Math.random(); spPos[spi * 3 + 1] = -9999; }
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('phase', new THREE.BufferAttribute(spPh, 1));
var spMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, scale: { value: 400 }, map: { value: dotTex }, glow: { value: 1 } },
  vertexShader: 'attribute float phase; varying float vA; uniform float time; uniform float scale;\n' +
    'void main(){ vA = pow(max(sin(time * 2.2 + phase * 40.0), 0.0), 14.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.11 * scale / -mv.z * (0.5 + vA); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; uniform float glow; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA * glow; if (a < 0.02) discard; gl_FragColor = vec4(1.0, 0.98, 0.9, a);\n#include <colorspace_fragment>\n}',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
var sparkles = new THREE.Points(spGeo, spMat); sparkles.frustumCulled = false; scene.add(sparkles);
function updSparkles() {
  spMat.uniforms.time.value = S.time;
  spMat.uniforms.glow.value = 1 - pal.star * 0.5;
  var f = P.crashed && S.rag ? ragCenter() : tmpV2.set(P.x, P.y, P.z), ch = false;
  for (var i = 0; i < SPN; i++) {
    var o = i * 3;
    if (spPos[o + 1] < -9000 || spPos[o + 2] < f.z - 6 || spPos[o + 2] > f.z + 60) {
      var z = f.z + Math.random() * 45 - 3, x = cxAt(z) + (Math.random() - 0.5) * (hwAt(z) * 2 + 6);
      spPos[o] = x; spPos[o + 1] = Hgt(x, z) + 0.03; spPos[o + 2] = z; ch = true;
    }
  }
  if (ch) spGeo.attributes.position.needsUpdate = true;
}

// ============================================================ aggiornamento della grafica
var qBasis = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), qFlip = new THREE.Quaternion(), qLean = new THREE.Quaternion(), mBasis = new THREE.Matrix4();
var vUp = new THREE.Vector3(0, 1, 0), vFwd = new THREE.Vector3(), vRight = new THREE.Vector3(), X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
function updRiderVisual(dt) {
  var p = P;
  if (p.crashed && S.rag) {
    ragPose(S.rag);
    rider.board.position.copy(S.board.p); rider.board.quaternion.copy(S.board.q);
    rider.root.visible = true; rider.body.visible = true;
    return;
  }
  rider.root.position.set(p.x, p.y, p.z);
  if (p.air) vUp.lerp(Y_AXIS, damp(4, dt)).normalize();
  else if (p.grind) vUp.lerp(Y_AXIS, damp(10, dt)).normalize();
  else { normalAt(p.x, p.z, tmpV2); vUp.lerp(tmpV2, dt > 0 ? damp(12, dt) : 1).normalize(); }
  var yaw = p.air ? Math.atan2(p.vx, p.vz) : p.yaw;
  vFwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  if (p.grind) { var gr = p.grind; vFwd.set(gr.x2 - gr.x1, gr.y2 - gr.y1, gr.z2 - gr.z1).normalize(); }
  vFwd.addScaledVector(vUp, -vFwd.dot(vUp)).normalize();
  vRight.crossVectors(vUp, vFwd).normalize();
  mBasis.makeBasis(vRight, vUp, vFwd);
  qBasis.setFromRotationMatrix(mBasis);
  qFlip.setFromAxisAngle(X_AXIS, p.air ? p.flip : (p.grind ? p.gPitch || 0 : 0));
  qSpin.setFromAxisAngle(Y_AXIS, p.spin);
  qLean.setFromAxisAngle(Z_AXIS, p.air ? 0 : p.lean);
  rider.root.quaternion.copy(qBasis).multiply(qFlip).multiply(qSpin).multiply(qLean);
  if (p.air && Math.abs(p.flip) > 0.01) {
    var off = tmpV.set(0, 0.7, 0).applyQuaternion(qBasis), off2 = tmpV2.set(0, 0.7, 0).applyQuaternion(rider.root.quaternion);
    rider.root.position.add(off).sub(off2);
  }
  rider.root.visible = !(p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0);
  var tb = p.tr ? Math.sin(PI * clamp(p.tr.u, 0, 1)) : 0;
  p.tbS = lerp(p.tbS || 0, tb, damp(14, dt || 0.016));
  poseRider({ c: p.crouch, ga: p.grabAmt, grab: p.grab || p.lastGrab, t: S.time, air: p.airAmt * (p.tr ? 0.5 : 1), tuck: p.air ? 0 : p.tuck, edge: p.air ? 0 : p.edge,
    twist: p.air && p.tr ? 0.6 : 0, look: p.air ? 0 : -p.yawRate * 0.3, tk: p.tr ? p.tr.t.kind : null, tb: p.tbS, flair: p.air && !p.tr && !p.grab && p.airT > 0.3 ? 0.6 : 0 });
  // la tavola si piega nei grab
  var g2 = p.grabAmt, gk = p.grab || p.lastGrab;
  rider.board.rotation.set(gk === 'nose' ? -0.22 * g2 : gk === 'tail' ? 0.22 * g2 : 0, 0, gk === 'method' ? 0.32 * g2 : gk === 'melon' ? 0.22 * g2 : gk === 'indy' ? -0.2 * g2 : 0);
}
function updMarkers() {
  var p = P;
  if (p.air && !p.crashed && state === 'play' && p.airT > 0.15 && p.tti < 1.6) {
    ring.visible = true;
    ring.position.set(p.landX, p.landY + 0.06, p.landZ);
    normalAt(p.landX, p.landZ, tmpV); ring.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
    var left = trickTimeLeft(), ok = !p.grab && (p.tr ? left < p.tti + 0.05 : spinErr(p.spin) < 0.5 && Math.abs(wrapA(p.flip)) < 0.55);
    ringMat.color.setHex(ok ? 0x4fe0b0 : 0xff3b4f);
    ringMat.opacity = 0.5 + 0.4 * (1 - clamp(p.tti / 1.6, 0, 1));
  } else ring.visible = false;
  var f = P.crashed && S.rag ? ragCenter() : tmpV2.set(p.x, p.y, p.z);
  var gy = Hgt(f.x, f.z), alt = f.y - gy;
  blob.position.set(f.x, gy + 0.04, f.z);
  normalAt(f.x, f.z, tmpV); blob.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
  blob.material.opacity = clamp(0.28 - alt * 0.03, 0, 0.28);
  blob.scale.setScalar(1 + alt * 0.04);
}
var smokeT = 0;
function updWorldVisual(dt) {
  for (var i = 0; i < S.coins.length; i++) {
    var s = S.coins[i], c = s.userData.coin;
    if (c.taken) { s.position.y = c.y + c.taken * 1.5; var sc2 = 1 + c.taken; s.scale.set(sc2, sc2, 1); s.visible = c.taken < 1; }
    else { s.position.y = c.y + Math.sin(S.time * 3 + c.ph) * 0.12; var k = 0.95 + Math.sin(S.time * 4 + c.ph) * 0.08; s.scale.set(k, k, 1); }
  }
  for (var w = 0; w < S.powers.length; w++) {
    var ps = S.powers[w], pd = ps.userData.pw;
    if (pd.taken) { pd.taken += dt * 3; var sc3 = 1.5 * (1 + pd.taken); ps.scale.set(sc3, sc3, 1); ps.material.opacity = 1; ps.visible = pd.taken < 1; ps.position.y = pd.y + pd.taken; }
    else { ps.position.y = pd.y + Math.sin(S.time * 2.5 + pd.ph) * 0.2; var k2 = 1.45 + Math.sin(S.time * 5 + pd.ph) * 0.12; ps.scale.set(k2, k2, 1); if (Math.random() < 0.15) part(pd.x + (Math.random() - 0.5), ps.position.y + (Math.random() - 0.5), pd.z, 0, 0.6, 0, 0.5, 0.15, 'gold'); }
  }
  for (var j = 0; j < S.flags.length; j++) { var fl = S.flags[j].userData.flag; fl.rotation.y = Math.sin(S.time * 6 + j) * 0.35; }
  // fumo dai camini delle baite
  smokeT -= dt;
  if (smokeT <= 0 && dt > 0) {
    smokeT = 0.09;
    for (var h = 0; h < S.chalets.length; h++) { var ch = S.chalets[h]; if (ch.z > P.z - 20 && ch.z < P.z + 170) part(ch.cx + (Math.random() - 0.5) * 0.3, ch.cy, ch.cz, 0.3 + Math.random() * 0.4, 1.2, (Math.random() - 0.5) * 0.4, 3.5, 0.9, 'smoke'); }
  }
  chaletGlow.color.copy(COLS.gold).multiplyScalar(0.6 + pal.star * 0.9);
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
  var f = P.crashed && S.rag ? ragCenter() : tmpV2.set(P.x, P.y, P.z);
  var sd = tmpV.set(pal.sd[0], Math.max(0.35, pal.sd[1] + 0.25), pal.sd[2]).normalize();
  sun.position.set(f.x + sd.x * 40, f.y + sd.y * 40, f.z + sd.z * 40);
  sun.target.position.set(f.x, f.y, f.z + 4);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  mountains.position.set(camera.position.x, f.y - 60, camera.position.z);
  clouds.position.set(camera.position.x, camera.position.y, camera.position.z);
  cloudMat.color.copy(pal.fog).lerp(COLS.snow, 0.55 - pal.star * 0.4);
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
  setText('lvl', 'Liv. ' + (S.tier + 1));
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
var last = 0, acc = 0, genT = 0, timeScale = 1;
function frame(ts) {
  var dt = last ? (ts - last) / 1000 : 0.016; last = ts;
  if (dt > 0.1) dt = 0.1;
  var running = state !== 'paused' && state !== 'over';
  if (running && S) {
    var tsT = 1;
    if (S.slowPulse > 0) { S.slowPulse -= dt; tsT = 0.35; }
    else if (S.pw.slow > 0 && P.air && !P.crashed) tsT = 0.5;
    timeScale = lerp(timeScale, tsT, damp(8, dt));
  }
  if (running) {
    acc += dt * timeScale; var n = 0;
    while (acc >= FIX && n < 20) { update(FIX); acc -= FIX; n++; if (state === 'over') break; }
    genT -= dt;
    if (genT <= 0 && state !== 'over') { genT = 0.25; genAhead(); pruneWorld(); genLift(); }
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
  updLift(); trailBuild(); updStreaks(running ? dt : 0); updSparkles(); updButtons(running ? dt : 0); updBoardTrail(); updPowersHud(running ? dt : 0);
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
  get S() { return S; }, get P() { return P; }, get state() { return state; }, get AV() { return AV; }, get tut() { return tut; },
  press: pressStart, move: pressMove, release: pressEnd,
  start: startGame, crash: function () { crash('test'); }, ollie: ollie, swipe: function (dx, dy, v) { startTrick(trickFromSwipe(dx, dy, v)); }, trick: trickFromSwipe,
  steer: function (v) { keySteer = v; }, joyY: function (v) { keyFlip = v; }, grab: function (g) { keyGrab = g; }, slide: toggleSlide, H: function (x, z) { return Hgt(x, z); }, cx: function (z) { return cxAt(z); },
  step: function (n, bot) { for (var i = 0; i < n; i++) { if (bot) bot(P, S); update(FIX); updTut(FIX); if (state !== 'play') break; if (i % 30 === 0) { genAhead(); pruneWorld(); genLift(); } } },
  info: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, objs: scene.children.length }; }
};
boot();
})();
