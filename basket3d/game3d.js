// ============================================================ PLAYMAKER 3D — grafica, animazioni, interfaccia
(function () {
'use strict';
function $(id) { return document.getElementById(id); }
function now() { return performance.now(); }
function W3(x, y, z) { return new THREE.Vector3(x, z || 0, -y); }

// ---------------------------------------------------------------- salvataggio
var SAVE_KEY = 'playmaker3d_v1', save = { stars: {}, mute: false, seenChap: {} };
(function () { var raw = window.__INITIAL_SAVE__; if (!raw) { try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {} } if (raw) { try { var d = JSON.parse(raw); for (var k in d) save[k] = d[k]; } catch (e) {} } })();
var saveResolver = null, pendingSave = null;
function persist() { var data = JSON.stringify(save); try { localStorage.setItem(SAVE_KEY, data); } catch (e) {} if (saveResolver) { var r = saveResolver; saveResolver = null; r(data); } else pendingSave = data; }
window.__waitSave = function (cb) { if (pendingSave) { var d = pendingSave; pendingSave = null; cb(d); return; } saveResolver = cb; };
function starsOf(i) { return save.stars[i] || 0; }
function unlocked(i) { return i === 1 || starsOf(i - 1) > 0; }

// ---------------------------------------------------------------- renderer
var canvas = $('game'), renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('loading').textContent = 'Questo dispositivo non supporta il 3D (WebGL).'; throw e; }
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
var W = 0, Hh = 0;
function resize() {
  W = window.innerWidth; Hh = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setSize(W, Hh, false);
  camera.aspect = W / Hh; camera.fov = W < Hh ? 56 : 40; camera.updateProjectionMatrix();
}
var hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a2a, 0.9); scene.add(hemi);
var key = new THREE.DirectionalLight(0xffffff, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
var ks = key.shadow.camera; ks.left = -10; ks.right = 10; ks.top = 10; ks.bottom = -10; ks.near = 1; ks.far = 60; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
key.position.set(4, 18, 2); key.target.position.set(0, 0, -9); scene.add(key); scene.add(key.target);

// ---------------------------------------------------------------- texture disegnate
function ctex(w, h, draw, rep) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
var ballTex = ctex(512, 256, function (c, w, h) {
  var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2742c'); g.addColorStop(0.5, '#f08436'); g.addColorStop(1, '#d4651f');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (var i = 0; i < 9000; i++) { c.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  c.strokeStyle = '#1b0f08'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  [0.25, 0.75].forEach(function (u) { c.beginPath(); c.moveTo(u * w, 0); c.lineTo(u * w, h); c.stroke(); });
  [0, 0.5].forEach(function (u) { c.beginPath(); for (var y = 0; y <= h; y += 4) { var x = (u + 0.25) * w + Math.sin(y / h * Math.PI) * w * 0.16 * (u ? -1 : 1); if (y) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); });
});
function jerseyTex(col, num, trim) {
  return ctex(512, 256, function (c, w, h) {
    c.fillStyle = col; c.fillRect(0, 0, w, h);
    c.fillStyle = trim; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 10, w, 10);
    for (var s = 0; s < 2; s++) { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(s * w / 2 + w * 0.22, 0, 6, h); }
    c.font = '900 120px "Avenir Next Condensed", Impact, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    [0, 0.5].forEach(function (u) { var x = (u + 0.0) * w; for (var k = -1; k <= 1; k += 2) { if (u === 0 && k < 0) continue; } c.lineWidth = 8; c.strokeStyle = trim; c.strokeText(String(num), u * w + (u ? 0 : 0), h * 0.55); c.fillStyle = '#ffffff'; c.fillText(String(num), u * w, h * 0.55); });
    c.lineWidth = 8; c.strokeStyle = trim; c.strokeText(String(num), w, h * 0.55); c.fillStyle = '#ffffff'; c.fillText(String(num), w, h * 0.55);
  });
}
function crowdTexMat() { return new THREE.MeshLambertMaterial({ vertexColors: false }); }

// ---------------------------------------------------------------- ambiente: palazzetto / campetto
var arena = new THREE.Group(); scene.add(arena);
var envRT = null, pmrem = new THREE.PMREMGenerator(renderer);
var crowdMesh = null, crowdU = { time: { value: 0 }, hype: { value: 0 } };
var board = null, scoreTexCv = null, scoreTex = null, netGeo = null, netBase = null, rimMesh = null;
var skyMat = null;
function hexCss(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
function clearArena() { while (arena.children.length) { var o = arena.children.pop(); o.traverse(function (c) { if (c.geometry) c.geometry.dispose(); }); } }
function courtTexture(ch) {
  var N = 2048, M = 19, Mz = 18, px = N / M;
  return ctex(N, Math.round(N * Mz / M), function (c, w, h) {
    function X(x) { return (x + M / 2) * px; } function Y(y) { return (16 - y) * px; }
    if (ch.kind !== 'gym' && ch.kind !== 'arena') {
      c.fillStyle = ch.floor; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 26000; i++) { c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.random() * 0.06) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (var k = 0; k < 18; k++) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.beginPath(); var x0 = Math.random() * w, y0 = Math.random() * h; c.moveTo(x0, y0); for (var s = 0; s < 6; s++) c.lineTo(x0 += (Math.random() - 0.5) * 120, y0 += (Math.random() - 0.5) * 120); c.stroke(); }
    } else {
      // parquet a listelli
      var pw = px * 0.075, base = ch.floor;
      for (var xx = 0; xx < w; xx += pw) {
        var off = Math.random() * px * 2.5;
        for (var yy = -off; yy < h; yy += px * (1.6 + Math.random() * 1.2)) {
          var lv = 0.9 + Math.random() * 0.2; c.fillStyle = base; c.globalAlpha = 1; c.fillRect(xx, yy, pw + 1, px * 3);
          c.fillStyle = lv > 1 ? 'rgba(255,240,220,' + ((lv - 1) * 0.9) + ')' : 'rgba(80,40,10,' + ((1 - lv) * 0.9) + ')'; c.fillRect(xx, yy, pw + 1, px * 3);
          c.fillStyle = 'rgba(60,30,10,.25)'; c.fillRect(xx, yy, pw + 1, 1.5);
        }
        c.fillStyle = 'rgba(60,30,10,.18)'; c.fillRect(xx, 0, 1.2, h);
      }
      for (var gi = 0; gi < 3000; gi++) { c.fillStyle = 'rgba(90,50,20,' + (Math.random() * 0.06) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 16); }
    }
    // fuori campo
    c.fillStyle = ch.kind === 'beach' ? 'rgba(232,207,154,.0)' : ch.kind === 'day' ? 'rgba(20,30,40,.25)' : 'rgba(20,24,40,.55)';
    c.fillRect(0, 0, X(-7.5), h); c.fillRect(X(7.5), 0, w - X(7.5), h); c.fillRect(0, 0, w, Y(14)); c.fillRect(0, Y(0), w, h - Y(0));
    // area colorata
    c.fillStyle = ch.paint; c.globalAlpha = 0.92; c.fillRect(X(-2.45), Y(14), X(2.45) - X(-2.45), Y(8.2) - Y(14)); c.globalAlpha = 1;
    c.strokeStyle = ch.line; c.lineWidth = px * 0.05; c.lineCap = 'round';
    function L(pts) { c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(X(q[0]), Y(q[1])); else c.moveTo(X(q[0]), Y(q[1])); }); c.stroke(); }
    function A(cx, cy, r, a0, a1) { var p = []; for (var i = 0; i <= 60; i++) { var a = a0 + (a1 - a0) * i / 60; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } L(p); }
    L([[-7.5, 0], [7.5, 0], [7.5, 14], [-7.5, 14], [-7.5, 0]]);
    L([[-2.45, 14], [-2.45, 8.2], [2.45, 8.2], [2.45, 14]]);
    A(0, 8.2, 1.8, Math.PI, Math.PI * 2);
    c.setLineDash([px * 0.3, px * 0.3]); A(0, 8.2, 1.8, 0, Math.PI); c.setLineDash([]);
    var as = Math.asin(1.415 / 6.75);
    var tp = [[-6.6, 14]]; for (var i2 = 0; i2 <= 80; i2++) { var a2 = Math.PI + as + (Math.PI - 2 * as) * i2 / 80; tp.push([Math.cos(a2) * 6.75, 12.43 + Math.sin(a2) * 6.75]); } tp.push([6.6, 14]); L(tp);
    A(0, 12.43, 1.25, Math.PI, Math.PI * 2);
    A(0, 0, 1.8, 0, Math.PI);
    for (var hs = -1; hs <= 1; hs += 2) [9, 10, 11.2].forEach(function (yh) { L([[hs * 2.45, yh], [hs * 2.75, yh]]); });
    // logo
    c.save(); c.translate(X(0), Y(0.9)); c.fillStyle = 'rgba(255,255,255,.22)'; c.font = '900 ' + Math.round(px * 1.1) + 'px "Avenir Next Condensed", Impact, Helvetica, sans-serif'; c.textAlign = 'center'; c.fillText(ch.homeName, 0, 0); c.restore();
    c.save(); c.translate(X(0), Y(13.55)); c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '800 ' + Math.round(px * 0.32) + 'px Helvetica, sans-serif'; c.textAlign = 'center'; c.fillText('PLAYMAKER', 0, 0); c.restore();
  });
}
function personGeo() {
  var g1 = new THREE.CylinderGeometry(0.2, 0.24, 0.62, 6).translate(0, 0.31, 0), g2 = new THREE.SphereGeometry(0.13, 6, 5).translate(0, 0.78, 0);
  var pos = [], nor = [];
  [g1, g2].forEach(function (g) { g = g.toNonIndexed(); g.computeVertexNormals(); var p = g.attributes.position, n = g.attributes.normal; for (var i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } });
  var o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return o;
}
function skyDome(top, bot, mid) {
  var m = new THREE.ShaderMaterial({ uniforms: { a: { value: new THREE.Color(bot) }, b: { value: new THREE.Color(top) }, c: { value: new THREE.Color(mid || bot) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; uniform vec3 c; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.8, 0.0, 1.0); vec3 col = h < 0.25 ? mix(a, c, h / 0.25) : mix(c, b, (h - 0.25) / 0.75); gl_FragColor = vec4(col, 1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false });
  return new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), m);
}
function winTexture(lit, base) { return ctex(64, 128, function (c, w, h) { c.fillStyle = base; c.fillRect(0, 0, w, h); for (var y = 4; y < h; y += 10) for (var x = 4; x < w; x += 10) { c.fillStyle = Math.random() < lit ? '#ffd27a' : 'rgba(255,255,255,.06)'; c.fillRect(x, y, 5, 6); } }, true); }
function buildings(R, n, rad, hMin, hMax, lit, base, emis) {
  var tex = winTexture(lit, base);
  for (var bi = 0; bi < n; bi++) {
    var bw = 5 + R() * 8, bh = hMin + R() * (hMax - hMin), bd = 5 + R() * 6, t = tex.clone(); t.repeat.set(bw / 6, bh / 10); t.needsUpdate = true;
    var bm = new THREE.MeshLambertMaterial({ map: t, emissive: emis ? 0xffffff : 0x000000, emissiveMap: emis ? t : null, emissiveIntensity: emis || 0 });
    var b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bm), ang = -1.5 + bi / n * 3.0 + (R() - 0.5) * 0.06, r = rad + R() * 25;
    b.position.set(Math.sin(ang) * r, bh / 2 - 0.5, -8 - Math.cos(ang) * r); b.rotation.y = -ang; arena.add(b);
  }
}
function treeMesh(R, x, z, s) {
  var g = new THREE.Group(), trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 2.4 * s, 7), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
  trunk.position.y = 1.2 * s; g.add(trunk);
  var leafM = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.27 + R() * 0.06, 0.45, 0.28 + R() * 0.1) });
  for (var k = 0; k < 4; k++) { var b = new THREE.Mesh(new THREE.IcosahedronGeometry((1.2 + R() * 0.5) * s, 0), leafM); b.position.set((R() - 0.5) * 1.2 * s, (2.6 + R() * 1.2) * s, (R() - 0.5) * 1.2 * s); b.castShadow = true; g.add(b); }
  g.position.set(x, 0, z); arena.add(g);
}
function palmMesh(R, x, z, s) {
  var g = new THREE.Group(), segM = new THREE.MeshLambertMaterial({ color: 0x8a6a42 }), lean = (R() - 0.5) * 0.5, px = 0, py = 0;
  for (var k = 0; k < 8; k++) { var sg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 0.75 * s, 7), segM); px += lean * 0.16 * s * k * 0.3; sg.position.set(px, py + 0.37 * s, 0); sg.rotation.z = -lean * 0.3; g.add(sg); py += 0.72 * s; }
  var leafM = new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide });
  for (var l = 0; l < 7; l++) {
    var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * s, 2.6 * s, 1, 4), leafM), pos = lf.geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) { var yy = pos.getY(i); pos.setZ(i, -Math.pow((yy / (1.3 * s) + 1) / 2, 2) * 0.9 * s); }
    lf.geometry.translate(0, 1.3 * s, 0); lf.position.set(px, py, 0); lf.rotation.set(-1.0, l / 7 * TAU, 0); lf.rotation.order = 'YXZ'; g.add(lf);
  }
  g.position.set(x, 0, z); g.traverse(function (o) { if (o.isMesh) o.castShadow = true; }); arena.add(g);
}
function standsWithCrowd(ch, tiers, sides, standCol) {
  var standMat = new THREE.MeshStandardMaterial({ color: standCol, roughness: 0.8 }), mats = [], R = rng(ch.name.length * 77);
  sides.forEach(function (sd) {
    for (var t = 0; t < tiers; t++) {
      var d = 0.9 * t + 0.5, st = new THREE.Mesh(new THREE.BoxGeometry(sd.w, 0.45, 0.9), standMat);
      if (sd.rot === 0) st.position.set(sd.ox, 0.25 + t * 0.45, sd.oz - d); else st.position.set(sd.ox + (sd.ox < 0 ? -d : d), 0.25 + t * 0.45, sd.oz);
      st.rotation.y = sd.rot; st.receiveShadow = true; arena.add(st);
      for (var k = 0; k < sd.w / 0.62; k++) { if (R() < 0.1) continue; mats.push({ sd: sd, t: t, k: k, d: d }); }
    }
  });
  var crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  crowdMat.onBeforeCompile = function (sh) {
    sh.uniforms.time = crowdU.time; sh.uniforms.hype = crowdU.hype;
    sh.vertexShader = 'uniform float time; uniform float hype;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat ph = float(gl_InstanceID) * 1.731;\ntransformed.y += (abs(sin(time * (2.0 + hype * 6.0) + ph)) * (0.03 + hype * 0.28));\ntransformed.x += sin(time * 1.3 + ph) * 0.02;');
  };
  crowdMesh = new THREE.InstancedMesh(personGeo(), crowdMat, mats.length);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color();
  var palette = [ch.home, ch.home, ch.home, 0xffffff, 0x222831, ch.away, 0xf2c29b, 0x8d5524, 0x3a6ea5, 0xd9d9d9, 0x5b3a29, 0xffcf3f];
  mats.forEach(function (m, i) {
    var sd = m.sd, along = -sd.w / 2 + 0.31 + m.k * 0.62, y = 0.47 + m.t * 0.45;
    if (sd.rot === 0) p3.set(sd.ox + along, y, sd.oz - m.d); else p3.set(sd.ox + (sd.ox < 0 ? -m.d : m.d), y, sd.oz + along);
    q.setFromAxisAngle(UP, sd.rot); s3.set(1, 0.85 + R() * 0.3, 1); m4.compose(p3, q, s3); crowdMesh.setMatrixAt(i, m4);
    col.setHex(palette[Math.floor(R() * palette.length)]).multiplyScalar(0.6 + R() * 0.4); crowdMesh.setColorAt(i, col);
  });
  crowdMesh.instanceMatrix.needsUpdate = true; crowdMesh.frustumCulled = false; arena.add(crowdMesh);
}
function jumbotron(ch, y, z) {
  scoreTexCv = document.createElement('canvas'); scoreTexCv.width = 512; scoreTexCv.height = 256; scoreTex = new THREE.CanvasTexture(scoreTexCv); scoreTex.colorSpace = THREE.SRGBColorSpace;
  var dark = new THREE.MeshStandardMaterial({ color: 0x111111 });
  var jb = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.4), [dark, dark, dark, dark, new THREE.MeshBasicMaterial({ map: scoreTex, toneMapped: false }), dark]);
  jb.position.set(0, y, z); arena.add(jb);
}
function buildArena(ch) {
  clearArena();
  crowdMesh = null; scoreTex = null;
  var k = ch.kind, indoor = k === 'gym' || k === 'arena', R = rng(ch.name.length * 31 + 7);
  var tex = courtTexture(ch);
  var floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: indoor ? 0.3 : k === 'roof' ? 0.45 : 0.85, metalness: 0, envMapIntensity: indoor ? 0.9 : 0.4 });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(19, 18), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -7); floor.receiveShadow = true; arena.add(floor);
  var apronCol = { day: 0x5a6470, beach: 0xe8cf9a, gym: 0x2a3550, roof: 0x30323c, arena: 0x161b2a }[k];
  var apronMat = new THREE.MeshStandardMaterial({ color: apronCol, roughness: 0.9 });
  if (k === 'beach') apronMat.map = ctex(256, 256, function (c, w, h) { c.fillStyle = '#e8cf9a'; c.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '120,90,50') + ',' + (Math.random() * 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, true), apronMat.map.repeat.set(30, 30);
  var apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), apronMat); apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.01, -10); apron.receiveShadow = true; arena.add(apron);
  var envCol = 0x0b0e18, envLights = 1;
  if (k === 'day') {
    scene.background = new THREE.Color(0x8cc8ff); scene.fog = new THREE.Fog(0xbfe0ff, 50, 190);
    arena.add(skyDome(0x3a8ee8, 0xd8ecff, 0xb7dcff));
    buildings(R, 26, 48, 10, 36, 0.12, '#c9b8a3', 0);
    for (var t = 0; t < 22; t++) { var a = -1.6 + t / 22 * 3.2; treeMesh(R, Math.sin(a) * (16 + R() * 6), -8 - Math.cos(a) * (16 + R() * 6), 0.9 + R() * 0.5); }
    var fenceTex = ctex(64, 64, function (c) { c.strokeStyle = 'rgba(80,90,100,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke(); }, true); fenceTex.repeat.set(30, 4);
    var fence = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })); fence.position.set(0, 2, -16.5); arena.add(fence);
    [-1, 1].forEach(function (s) { var f2 = fence.clone(); f2.rotation.y = Math.PI / 2; f2.position.set(s * 10.5, 2, -7); arena.add(f2); });
    for (var bn = -1; bn <= 1; bn += 2) { var bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 3), new THREE.MeshLambertMaterial({ color: 0x3b7a4a })); bench.position.set(bn * 9.3, 0.25, -6); arena.add(bench); }
    envCol = 0x9cc8f0;
  } else if (k === 'beach') {
    scene.background = new THREE.Color(0xff9a6b); scene.fog = new THREE.Fog(0xffb08a, 60, 210);
    arena.add(skyDome(0x4a3a8a, 0xffb37a, 0xff7a6a));
    var sun = new THREE.Mesh(new THREE.CircleGeometry(12, 40), new THREE.MeshBasicMaterial({ color: 0xffe1a0, fog: false })); sun.position.set(-20, 10, -170); arena.add(sun);
    seaMat = new THREE.ShaderMaterial({ uniforms: { time: crowdU.time }, vertexShader: 'uniform float time; varying vec2 vu; varying float vh; void main(){ vu = uv; vec3 p = position; float h = sin(p.x * 0.15 + time * 1.2) * 0.25 + sin(p.y * 0.21 + time * 0.9) * 0.2; p.z += h; vh = h; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
      fragmentShader: 'varying vec2 vu; varying float vh; void main(){ vec3 deep = vec3(0.12,0.28,0.45), shallow = vec3(0.95,0.55,0.4); vec3 c = mix(deep, shallow, clamp(vh * 1.2 + 0.35 + (1.0 - vu.y) * 0.3, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}', fog: false });
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 160, 80, 30), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -110); arena.add(sea);
    for (var p = 0; p < 14; p++) { var side = p % 2 ? 1 : -1; palmMesh(R, side * (11 + R() * 6), 2 - p * 2.6 - R() * 2, 1 + R() * 0.4); }
    var umbCols = [0xff5a36, 0xffcf3f, 0x1f9bb5, 0xffffff];
    for (var u = 0; u < 10; u++) {
      var ug = new THREE.Group(), ux = (u % 2 ? 1 : -1) * (13 + R() * 8), uz = 4 - u * 3;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0xffffff })); pole.position.y = 1.2; ug.add(pole);
      var top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 10, 1, true), new THREE.MeshLambertMaterial({ color: umbCols[u % 4], side: THREE.DoubleSide })); top.position.y = 2.4; ug.add(top);
      ug.position.set(ux, 0, uz); arena.add(ug);
    }
    standsWithCrowd(ch, 3, [{ ox: -11.5, oz: -7, rot: Math.PI / 2, w: 18 }, { ox: 11.5, oz: -7, rot: -Math.PI / 2, w: 18 }], 0xe0e0e0);
    envCol = 0xff9a7a;
  } else if (k === 'gym') {
    scene.background = new THREE.Color(0x1a1a22); scene.fog = new THREE.Fog(0x1a1a22, 40, 120);
    var wallM = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 });
    var wBack = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallM); wBack.position.set(0, 7, -24); arena.add(wBack);
    [-1, 1].forEach(function (s) { var w = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallM); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 17, 7, -8); arena.add(w); });
    for (var wi = 0; wi < 6; wi++) { var win = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshBasicMaterial({ color: 0xdff0ff })); win.position.set(-12.5 + wi * 5, 10.5, -23.9); arena.add(win); }
    var banners = [ch.home, ch.away, 0xffcf3f, ch.home];
    banners.forEach(function (c, i) { var bnr = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.2), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); bnr.position.set(-9 + i * 6, 8.5, -23.8); arena.add(bnr); });
    standsWithCrowd(ch, 6, [{ ox: 0, oz: -16.5, rot: 0, w: 28 }, { ox: -11.5, oz: -7, rot: Math.PI / 2, w: 20 }, { ox: 11.5, oz: -7, rot: -Math.PI / 2, w: 20 }], 0x8c6b48);
    jumbotron(ch, 7, -23.5);
    for (var lx = -2; lx <= 2; lx++) { var lp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })); lp.position.set(lx * 4.2, 12.5, -8); arena.add(lp); }
    envCol = 0x2a2a30;
  } else if (k === 'roof') {
    scene.background = new THREE.Color(0x05060f); scene.fog = new THREE.Fog(0x0a0a1e, 50, 200);
    arena.add(skyDome(0x02030a, 0x2a1a4a, 0x10123a));
    var starsG = new THREE.BufferGeometry(), sp = []; for (var s = 0; s < 500; s++) { var th = R() * TAU, ph = R() * 1.2; sp.push(Math.cos(th) * Math.cos(ph) * 200, 30 + Math.sin(ph) * 160, Math.sin(th) * Math.cos(ph) * 200 - 10); }
    starsG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); arena.add(new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, fog: false })));
    var roofM = new THREE.MeshStandardMaterial({ color: 0x24262f, roughness: 0.8 });
    var roof = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 28), roofM); roof.position.set(0, -0.52, -8); arena.add(roof);
    var wall = new THREE.MeshStandardMaterial({ color: 0x3a3d48, roughness: 0.8 });
    [[0, -21.6, 30, 0.4], [-14.8, -8, 0.4, 28], [14.8, -8, 0.4, 28]].forEach(function (b) { var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], 1.1, b[3]), wall); m.position.set(b[0], 0.55, b[1]); arena.add(m); });
    buildings(R, 40, 40, 20, 75, 0.35, '#141628', 1.1);
    // neon attorno al campo
    [[0, -15.6, 16, 0.08, 0xff2d95], [-8.2, -7, 0.08, 17, 0x22d3ee], [8.2, -7, 0.08, 17, 0x22d3ee], [0, 1.6, 16, 0.08, 0xff2d95]].forEach(function (n) { var m = new THREE.Mesh(new THREE.BoxGeometry(n[2], 0.06, n[3]), new THREE.MeshBasicMaterial({ color: n[4], toneMapped: false })); m.position.set(n[0], 0.04, n[1]); arena.add(m); });
    for (var sl = 0; sl < 40; sl++) { var t2 = sl / 39, bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: sl % 3 ? 0xffd27a : 0xff2d95, toneMapped: false })); bulb.position.set(lerp(-11, 11, t2), 6.5 - Math.sin(t2 * Math.PI) * 1.5, -17); arena.add(bulb); }
    var tank = new THREE.Group(), tkM = new THREE.MeshLambertMaterial({ color: 0x6b4a32 });
    var tk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 16), tkM); tk.position.y = 4; tank.add(tk);
    var roofT = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1, 16), tkM); roofT.position.y = 6; tank.add(roofT);
    for (var lg = 0; lg < 4; lg++) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x333 })); leg.position.set(Math.cos(lg * PI / 2) * 1.2, 1.25, Math.sin(lg * PI / 2) * 1.2); tank.add(leg); }
    tank.position.set(-12, 0, -19); arena.add(tank);
    standsWithCrowd(ch, 2, [{ ox: -11.2, oz: -7, rot: Math.PI / 2, w: 18 }, { ox: 11.2, oz: -7, rot: -Math.PI / 2, w: 18 }], 0x30323c);
    envCol = 0x1a0a2a; envLights = 0.6;
  } else {
    scene.background = new THREE.Color(0x05070d); scene.fog = new THREE.Fog(0x070a14, 40, 120);
    standsWithCrowd(ch, 16, [{ ox: 0, oz: -16.5, rot: 0, w: 30 }, { ox: -11.5, oz: -7, rot: Math.PI / 2, w: 22 }, { ox: 11.5, oz: -7, rot: -Math.PI / 2, w: 22 }], 0x1b2235);
    jumbotron(ch, 9.5, -21);
    var led = ctex(1024, 64, function (c, w, h) { c.fillStyle = '#05070f'; c.fillRect(0, 0, w, h); c.font = '800 34px Helvetica, sans-serif'; c.fillStyle = '#ffd66b'; for (var x = 0; x < w; x += 340) c.fillText('THE FINALS · GARA 7', x + 12, 44); });
    var ledM = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.8), new THREE.MeshBasicMaterial({ map: led, toneMapped: false })); ledM.position.set(0, 0.42, -15.3); arena.add(ledM);
    for (var l2 = -2; l2 <= 2; l2++) { var lp2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })); lp2.position.set(l2 * 4.2, 13, -8); arena.add(lp2); }
  }
  buildHoop(ch);
  // luci e riflessi dell'ambiente
  var L = { day: [2.6, 0xfff4e0, 1.25, 0xcfe6ff, 0x6a6a5a], beach: [2.3, 0xffc890, 1.25, 0xffc0a0, 0x8a6a5a], gym: [2.2, 0xffffff, 0.85, 0xfff2e0, 0x5a4a3a], roof: [1.7, 0xd8c8ff, 0.7, 0x8a6aff, 0x2a1a3a], arena: [2.4, 0xffffff, 0.8, 0xdfe8ff, 0x4a3a2a] }[k];
  key.intensity = L[0]; key.color.setHex(L[1]); hemi.intensity = L[2]; hemi.color.setHex(L[3]); hemi.groundColor.setHex(L[4]);
  if (k === 'beach') key.position.set(-8, 10, -18); else if (k === 'day') key.position.set(6, 18, 4); else key.position.set(4, 18, 2);
  var es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: envCol, side: THREE.BackSide })));
  for (var e = -2; e <= 2; e++) { var lb = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff })); lb.position.set(e * 4, 9, -2 - Math.abs(e)); lb.scale.multiplyScalar(envLights); es.add(lb); }
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(es, 0.02); scene.environment = envRT.texture;
}
var seaMat = null;
function buildHoop(ch) {
  var g = new THREE.Group(), indoor = ch.kind === 'gym' || ch.kind === 'arena';
  var metal = new THREE.MeshStandardMaterial({ color: indoor ? 0x1d2230 : 0x5a6270, roughness: 0.4, metalness: 0.7 });
  var base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 2), new THREE.MeshStandardMaterial({ color: indoor ? 0x1f6fd1 : 0x3a3f4a, roughness: 0.6 })); base.position.set(0, 0.55, -15.6); base.castShadow = true; g.add(base);
  var post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 12), metal); post.position.set(0, 2.6, -15.4); g.add(post);
  var arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.1), metal); arm.position.set(0, 3.45, -14.35); g.add(arm);
  var glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.04), new THREE.MeshStandardMaterial({ color: indoor ? 0xddeeff : 0xf4f4f4, transparent: true, opacity: indoor ? 0.28 : 0.95, roughness: 0.05, metalness: 0.1, envMapIntensity: 2 }));
  glass.position.set(0, 3.425, -13.2); g.add(glass);
  var frameM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  [[0, 0.51, 1.84, 0.04], [0, -0.51, 1.84, 0.04], [-0.9, 0, 0.04, 1.05], [0.9, 0, 0.04, 1.05]].forEach(function (f) { var m = new THREE.Mesh(new THREE.BoxGeometry(f[2], f[3], 0.05), frameM); m.position.set(f[0], 3.425 + f[1], -13.18); g.add(m); });
  var sqM = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
  [[0, 0.225, 0.59, 0.03], [0, -0.225, 0.59, 0.03], [-0.295, 0, 0.03, 0.45], [0.295, 0, 0.03, 0.45]].forEach(function (f) { var m = new THREE.Mesh(new THREE.BoxGeometry(f[2], f[3], 0.02), sqM); m.position.set(f[0], 3.275 + f[1], -13.17); g.add(m); });
  rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35, metalness: 0.6 }));
  rimMesh.rotation.x = Math.PI / 2; rimMesh.position.set(0, 3.05, -12.43); rimMesh.castShadow = true; g.add(rimMesh);
  var brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.55), new THREE.MeshStandardMaterial({ color: 0xff5a1f, metalness: 0.6, roughness: 0.4 })); brace.position.set(0, 3.04, -12.92); g.add(brace);
  // retina: fili che si muovono quando la palla entra
  var S = 16, Rw = 5, pos = [];
  netBase = [];
  for (var r = 0; r < Rw; r++) for (var i = 0; i < S; i++) { var t = r / (Rw - 1), rad = lerp(0.225, 0.14, t), a = (i + (r % 2) * 0.5) / S * TAU; netBase.push([Math.cos(a) * rad, -t * 0.44, Math.sin(a) * rad]); }
  var idx = [];
  for (var r2 = 0; r2 < Rw - 1; r2++) for (var j = 0; j < S; j++) { var a0 = r2 * S + j; idx.push(a0, (r2 + 1) * S + j, a0, (r2 + 1) * S + ((j + (r2 % 2 ? 1 : S - 1)) % S)); }
  netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(netBase.length * 3), 3)); netGeo.setIndex(idx);
  var net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); net.position.set(0, 3.04, -12.43); net.frustumCulled = false; g.add(net);
  g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  arena.add(g);
  netPose(0, 0);
}
var netK = 0;
function netPose(k, t) {
  var p = netGeo.attributes.position;
  for (var i = 0; i < netBase.length; i++) { var b = netBase[i], row = Math.floor(i / 16) / 4; var sq = 1 - k * 0.45 * Math.sin(row * Math.PI), dy = -k * 0.18 * row; p.setXYZ(i, b[0] * sq + Math.sin(t * 25 + i) * k * 0.02, b[1] + dy, b[2] * sq); }
  p.needsUpdate = true;
}
function drawScoreboard(home, away, hs, as, clock, ch) {
  if (!scoreTex) return;
  var c = scoreTexCv.getContext('2d'), w = 512, h = 256;
  c.fillStyle = '#05070c'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#2a3350'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  c.font = '800 30px Helvetica, sans-serif'; c.textAlign = 'center'; c.fillStyle = hexCss(ch.home); c.fillText(home, 128, 60); c.fillStyle = hexCss(ch.away); c.fillText(away, 384, 60);
  c.font = '900 92px "Courier New", monospace'; c.fillStyle = '#ff4433'; c.fillText(String(hs), 128, 160); c.fillText(String(as), 384, 160);
  c.font = '900 52px "Courier New", monospace'; c.fillStyle = '#ffd66b'; c.fillText(clock, 256, 225);
  scoreTex.needsUpdate = true;
}

// ---------------------------------------------------------------- giocatori 3D
var TEMPLATE = null, CLIPS = {}, BONE_N = {};
var SKINS = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x6b4423, 0xa0673a, 0x4a2c1a];
function prepTemplate(gltf) {
  var root = gltf.scene;
  root.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(root), hgt = box.max.y - box.min.y, s = 1.98 / hgt;
  root.scale.multiplyScalar(s); root.updateMatrixWorld(true);
  box.setFromObject(root); root.position.y -= box.min.y;
  gltf.animations.forEach(function (a) { CLIPS[a.name] = a; });
  TEMPLATE = root;
}
function findBones(o) { var b = {}; o.traverse(function (c) { if (c.isBone) b[c.name.replace('mixamorig', '')] = c; }); return b; }
function attach(bone, mesh, off) {
  var ws = new THREE.Vector3(); bone.updateMatrixWorld(true); bone.getWorldScale(ws);
  mesh.scale.setScalar(1 / ws.x); mesh.position.set(off[0] / ws.x, off[1] / ws.x, off[2] / ws.x);
  bone.add(mesh); mesh.castShadow = true; return mesh;
}
var HAIR = [0x1a1410, 0x2b1d14, 0x3b2a1a, 0x0d0d0d, 0x6b4a2a, 0xb8894a];
function std(c, r) { return new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.6 : r }); }
// faccia costruita sulla testa: occhi, sopracciglia, naso, bocca, orecchie, capelli, barba
function makeFace(bones, skin, seed, hero) {
  // misure prese dal modello: viso a 15 cm davanti all'osso della testa, lati a 9,5 cm, nuca a 12 cm, cima a 23 cm
  var R = rng(seed * 977 + 13), g = new THREE.Group();
  var skinM = std(skin, 0.55), hairC = HAIR[Math.floor(R() * HAIR.length)], hairM = std(hairC, 0.85);
  var eyeW = std(0xf6f2ec, 0.25), iris = std(R() < 0.75 ? 0x2a1a10 : 0x3a5a2a, 0.15), lip = std(new THREE.Color(skin).multiplyScalar(0.68), 0.5);
  function add(geo, mat, x, y, z, sx, sy, sz) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); g.add(m); return m; }
  var sph = new THREE.SphereGeometry(1, 14, 10), box = new THREE.BoxGeometry(1, 1, 1);
  [-1, 1].forEach(function (s) {
    add(sph, eyeW, s * 0.036, 0.068, 0.142, 0.019, 0.013, 0.01);
    add(sph, iris, s * 0.036, 0.067, 0.151, 0.009, 0.009, 0.004);
    add(box, hairM, s * 0.038, 0.094, 0.147, 0.04, 0.009, 0.012).rotation.z = s * -0.14;
    add(sph, skinM, s * 0.097, 0.06, 0.005, 0.016, 0.03, 0.022);
  });
  add(new THREE.ConeGeometry(1, 1, 8), skinM, 0, 0.045, 0.158, 0.017, 0.045, 0.017).rotation.x = Math.PI / 2 + 0.35;
  add(sph, skinM, 0, 0.028, 0.158, 0.021, 0.013, 0.013);
  add(box, lip, 0, 0.0, 0.144, 0.036, 0.009, 0.01);
  var cx = 0, cy = 0.1, cz = 0.015, style = Math.floor(R() * 5);
  if (style === 0) add(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, PI * 0.5), hairM, cx, cy + 0.005, cz - 0.004, 0.104, 0.135, 0.142);
  else if (style === 1) add(sph, hairM, cx, cy + 0.05, cz - 0.025, 0.14, 0.135, 0.155);
  else if (style === 2) { add(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, PI * 0.46), hairM, cx, cy, cz - 0.004, 0.103, 0.132, 0.14); for (var c = -2; c <= 2; c++) add(box, hairM, c * 0.024, cy + 0.125, cz - 0.01, 0.013, 0.03, 0.22); }
  else if (style === 3) { add(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, PI * 0.42), hairM, cx, cy, cz - 0.004, 0.102, 0.13, 0.14); add(box, hairM, cx, cy + 0.14, cz - 0.01, 0.035, 0.06, 0.22); }
  if (R() < 0.38) { add(new THREE.SphereGeometry(1, 16, 8, 0, TAU, PI * 0.58, PI * 0.42), hairM, 0, 0.045, 0.012, 0.1, 0.075, 0.138); }
  if (hero || R() < 0.2) add(new THREE.TorusGeometry(1, 0.08, 6, 30), std(hero ? 0xffcf3f : 0xffffff, 0.6), cx, cy + 0.03, cz, 0.104, 0.142, 0.104).rotation.x = Math.PI / 2;
  g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makePlayer(team, num, ch, idx, keeper) {
  var model = THREE.SkeletonUtils.clone(TEMPLATE);
  var wrap = new THREE.Group(); wrap.add(model); scene.add(wrap);
  if (keeper) model.scale.multiplyScalar(1.08);
  var skin = SKINS[(num * 3 + idx + team * 2) % SKINS.length], jcol = team ? ch.away : ch.home, hero = team === 0 && idx === 0;
  var skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5 });
  model.traverse(function (o) {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    o.material = /Joints/.test(o.name) ? new THREE.MeshStandardMaterial({ color: new THREE.Color(skin).multiplyScalar(0.85), roughness: 0.55 }) : skinM;
  });
  var bones = findBones(model), R = rng(num * 31 + team * 7 + idx);
  var trim = team ? '#ffffff' : '#ffcf3f', jm = new THREE.MeshStandardMaterial({ map: jerseyTex(hexCss(jcol), num, trim), roughness: 0.75, side: THREE.DoubleSide });
  attach(bones.Spine1, new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.158, 0.47, 22, 1, true), jm), [0, 0.04, 0]);
  var trimM = std(team ? 0xffffff : 0xffcf3f, 0.6);
  var shortsM = new THREE.MeshStandardMaterial({ color: new THREE.Color(jcol).multiplyScalar(0.85), roughness: 0.8, side: THREE.DoubleSide });
  attach(bones.Hips, new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.205, 0.27, 22, 1, true), shortsM), [0, -0.06, 0]);
  ['LeftUpLeg', 'RightUpLeg'].forEach(function (n) {
    attach(bones[n], new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.3, 14, 1, true), shortsM), [0, 0.14, 0]);
    attach(bones[n], new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 14, 1, true), trimM), [0, 0.29, 0]);
  });
  // calzettoni, ginocchiere, polsini, manicotto
  var sockM = std(R() < 0.5 ? 0xffffff : 0x111111, 0.8), sleeveM = std(R() < 0.5 ? 0x111111 : jcol, 0.7);
  ['LeftLeg', 'RightLeg'].forEach(function (n, i) {
    attach(bones[n], new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.16, 12, 1, true), sockM), [0, 0.36, 0]);
    if (R() < 0.35 && i === 0) attach(bones[n], new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.062, 0.12, 12, 1, true), sleeveM), [0, 0.04, 0]);
  });
  var shoeM = std(team ? 0xf4f4f4 : 0x111111, 0.45), stripe = std(team ? 0xd23b2a : 0xffcf3f, 0.5), sole = std(0xf8f8f8, 0.6);
  ['LeftFoot', 'RightFoot'].forEach(function (n) {
    var sh = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.28), shoeM); body.position.set(0, 0, 0.06); sh.add(body);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.09, 12), shoeM); top.position.set(0, 0.05, -0.02); sh.add(top);
    var st = new THREE.Mesh(new THREE.BoxGeometry(0.113, 0.03, 0.18), stripe); st.position.set(0, 0.01, 0.06); sh.add(st);
    var so = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.025, 0.29), sole); so.position.set(0, -0.055, 0.06); sh.add(so);
    var grp = new THREE.Group(); grp.add(sh); sh.rotation.x = -Math.PI / 2;
    attach(bones[n], grp, [0, 0.04, -0.02]);
  });
  attach(bones.Head, makeFace(bones, skin, num * 17 + team * 101 + idx, hero), [0, 0, 0]);
  var mixer = new THREE.AnimationMixer(model), acts = {};
  ['idle', 'walk', 'run', 'agree', 'headShake'].forEach(function (n) { if (CLIPS[n]) { acts[n] = mixer.clipAction(CLIPS[n]); acts[n].play(); acts[n].setEffectiveWeight(n === 'idle' ? 1 : 0); } });
  acts.idle.time = Math.random() * 2;
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: team ? (keeper ? 0xff8a00 : 0xff4d5e) : 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.renderOrder = 2; scene.add(ring);
  return { wrap: wrap, model: model, bones: bones, mixer: mixer, acts: acts, ring: ring, team: team, num: num, facing: 0, jump: 0, anim: null, px: 0, py: 0, speedS: 0, keeper: !!keeper };
}
function disposePlayer(v) { scene.remove(v.wrap); scene.remove(v.ring); v.mixer.stopAllAction(); }

// ---- pose: si orientano le ossa delle braccia verso direzioni nel mondo
var qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
function aim(bone, child, dir, w) {
  if (w <= 0.001) return;
  bone.getWorldPosition(vA); child.getWorldPosition(vB); vB.sub(vA).normalize();
  qA.setFromUnitVectors(vB, vC.copy(dir).normalize());
  bone.getWorldQuaternion(qB); qA.multiply(qB);
  bone.parent.getWorldQuaternion(qC); qC.invert().multiply(qA);
  bone.quaternion.slerp(qC, w); bone.updateMatrixWorld(true);
}
var F = new THREE.Vector3(), RT = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), tmpD = new THREE.Vector3();
function dirOf(c, target) { return (target || tmpD).set(0, 0, 0).addScaledVector(F, c[0]).addScaledVector(RT, c[1]).addScaledVector(UP, c[2]); }
var POSES = {
  hold: { RA: [0.55, 0.15, -0.7], RF: [0.9, -0.3, 0.35], LA: [0.55, -0.2, -0.7], LF: [0.9, 0.45, 0.3] },
  dribble: { RA: [0.35, 0.25, -0.85], RF: [0.6, 0.05, -0.75], LA: [0.5, -0.45, -0.6], LF: [1, -0.1, 0.1] },
  shoot: { RA: [0.4, 0.05, 0.9], RF: [0.35, 0, 1], LA: [0.3, -0.45, 0.75], LF: [0.1, 0.6, 0.7] },
  release: { RA: [0.55, 0.05, 0.85], RF: [0.7, 0, 0.8], LA: [0.3, -0.45, 0.7], LF: [0.2, 0.5, 0.75] },
  pass: { RA: [1, 0.15, 0.05], RF: [1, 0.05, 0.05], LA: [1, -0.15, 0.05], LF: [1, -0.05, 0.05] },
  catch: { RA: [0.9, 0.25, 0.15], RF: [1, -0.1, 0.2], LA: [0.9, -0.25, 0.15], LF: [1, 0.1, 0.2] },
  defend: { RA: [0.25, 0.85, 0.2], RF: [0.2, 0.25, 0.95], LA: [0.25, -0.85, 0.2], LF: [0.2, -0.25, 0.95] },
  deny: { RA: [0.5, 0.8, -0.1], RF: [0.6, 0.6, 0.2], LA: [0.3, -0.9, -0.2], LF: [0.3, -0.5, 0.5] },
  dunk: { RA: [0.25, 0.05, 1], RF: [0.3, 0, 1], LA: [0.2, -0.6, -0.5], LF: [0.3, -0.3, -0.8] },
  block: { RA: [0.3, 0.2, 1], RF: [0.2, 0.1, 1], LA: [0.3, -0.2, 1], LF: [0.2, -0.1, 1] },
  cheer: { RA: [0.1, 0.4, 0.9], RF: [0, 0.2, 1], LA: [0.1, -0.4, 0.9], LF: [0, -0.2, 1] },
  steal: { RA: [0.85, 0.1, -0.35], RF: [0.8, -0.1, -0.5], LA: [0.3, -0.7, 0], LF: [0.4, -0.4, 0.3] },
  sad: { RA: [0.1, 0.25, -1], RF: [0.3, 0.1, -0.9], LA: [0.1, -0.25, -1], LF: [0.3, -0.1, -0.9] }
};
function applyPose(v, name, w) {
  var P = POSES[name]; if (!P || w <= 0) return;
  var b = v.bones;
  aim(b.RightArm, b.RightForeArm, dirOf(P.RA), w); aim(b.RightForeArm, b.RightHand, dirOf(P.RF), w);
  aim(b.LeftArm, b.LeftForeArm, dirOf(P.LA), w); aim(b.LeftForeArm, b.LeftHand, dirOf(P.LF), w);
}

// ---------------------------------------------------------------- palla, segni a terra, linee
var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.65, bumpMap: ballTex, bumpScale: 0.002 }));
ball.castShadow = true; scene.add(ball);
var ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); ballShadow.renderOrder = 1; scene.add(ballShadow);
var holderRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.9, depthWrite: false })); holderRing.renderOrder = 3; scene.add(holderRing);
var pathMesh = null, dangerDots = [], routeObjs = [];
var dotGeo = new THREE.SphereGeometry(0.09, 10, 8), dangerMat = new THREE.MeshBasicMaterial({ color: 0xff3b4f, depthTest: false }), routeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
for (var di = 0; di < 40; di++) { var dd = new THREE.Mesh(dotGeo, dangerMat); dd.visible = false; dd.renderOrder = 5; scene.add(dd); dangerDots.push(dd); }
function clearPath() { if (pathMesh) { scene.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; } dangerDots.forEach(function (d) { d.visible = false; }); $('pathLbl').className = ''; }
function showPath(pts, onRim, cls) {
  if (pathMesh) { scene.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; }
  var v = pts.map(function (q) { return W3(q[0], q[1], 0.06); });
  if (onRim) { var last = v[v.length - 1]; v.push(new THREE.Vector3(lerp(last.x, 0, 0.5), 2.2, lerp(last.z, -12.43, 0.5))); v.push(new THREE.Vector3(0, 3.1, -12.43)); }
  if (v.length < 2) return;
  var curve = new THREE.CatmullRomCurve3(v), col = cls.type === 'pass' ? 0x58d8ff : cls.type === 'shot' ? 0xffcf3f : cls.type === 'alley' ? 0xff7ad9 : cls.type === 'none' ? 0x777777 : 0xffffff;
  pathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, v.length * 4), 0.055, 6, false), new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 }));
  pathMesh.renderOrder = 4; scene.add(pathMesh);
  var n = 0;
  if (cls.type !== 'shot') for (var k = 1; k < pts.length && n < dangerDots.length; k++) {
    var q = pts[k], risk = 9; G.away.forEach(function (a) { risk = Math.min(risk, dist(a.x, a.y, q[0], q[1])); });
    if (risk < (cls.type === 'dribble' ? 1.0 : 1.15)) { dangerDots[n].position.copy(W3(q[0], q[1], 0.12)); dangerDots[n].visible = true; n++; }
  }
  for (; n < dangerDots.length; n++) dangerDots[n].visible = false;
}
function showRoutes() {
  routeObjs.forEach(function (o) { scene.remove(o); }); routeObjs = [];
  if (!G) return;
  G.home.forEach(function (p) {
    if (!p.route.length) return;
    var pts = [[p.x, p.y]].concat(p.route);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], L = dist(a[0], a[1], b[0], b[1]);
      for (var s = 0.6; s < L; s += 0.45) { var t = s / L, m = new THREE.Mesh(dotGeo, routeMat); m.scale.setScalar(0.6); m.position.copy(W3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 0.08)); scene.add(m); routeObjs.push(m); }
    }
    var e = pts[pts.length - 1], pr = pts[pts.length - 2];
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 12), routeMat); cone.position.copy(W3(e[0], e[1], 0.1));
    cone.rotation.set(Math.PI / 2, 0, Math.atan2(e[0] - pr[0], e[1] - pr[1]) * -1 + Math.PI); cone.rotation.order = 'YXZ'; cone.rotation.set(-Math.PI / 2, Math.atan2(e[0] - pr[0], -(e[1] - pr[1])) + Math.PI, 0);
    scene.add(cone); routeObjs.push(cone);
    if (p.screen !== undefined) { var tag = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fe0b0, transparent: true, depthWrite: false })); tag.position.copy(W3(p.route[0][0], p.route[0][1], 0.07)); scene.add(tag); routeObjs.push(tag); }
  });
}

// ---------------------------------------------------------------- particelle (coriandoli)
var CF = 260, cfGeo = new THREE.BufferGeometry(), cfPos = new Float32Array(CF * 3), cfCol = new Float32Array(CF * 3), cfV = [];
cfGeo.setAttribute('position', new THREE.BufferAttribute(cfPos, 3)); cfGeo.setAttribute('color', new THREE.BufferAttribute(cfCol, 3));
var confettiPts = new THREE.Points(cfGeo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true })); confettiPts.frustumCulled = false; scene.add(confettiPts);
for (var ci = 0; ci < CF; ci++) { cfPos[ci * 3 + 1] = -99; cfV.push([0, 0, 0, 0]); }
function confetti() { var cols = [[1, 0.81, 0.25], [0.31, 0.88, 0.69], [1, 0.35, 0.21], [0.35, 0.85, 1], [1, 1, 1]]; for (var i = 0; i < CF; i++) { cfPos[i * 3] = (Math.random() - 0.5) * 4; cfPos[i * 3 + 1] = 4 + Math.random() * 3; cfPos[i * 3 + 2] = -11 + (Math.random() - 0.5) * 4; cfV[i] = [(Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6, 3]; var c = cols[i % 5]; cfCol[i * 3] = c[0]; cfCol[i * 3 + 1] = c[1]; cfCol[i * 3 + 2] = c[2]; } cfGeo.attributes.color.needsUpdate = true; }
function updConfetti(dt) { for (var i = 0; i < CF; i++) { var v = cfV[i]; if (v[3] <= 0) continue; v[3] -= dt; v[1] -= 6 * dt; v[0] *= 0.98; v[2] *= 0.98; cfPos[i * 3] += v[0] * dt; cfPos[i * 3 + 1] = Math.max(0.02, cfPos[i * 3 + 1] + v[1] * dt); cfPos[i * 3 + 2] += v[2] * dt; if (v[3] <= 0) cfPos[i * 3 + 1] = -99; } cfGeo.attributes.position.needsUpdate = true; }

// ---------------------------------------------------------------- audio sintetizzato
var AU = { ctx: null, master: null, noise: null };
function ensureAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  try { var c = AU.ctx = new C(); AU.master = c.createGain(); AU.master.gain.value = save.mute ? 0 : 0.8; AU.master.connect(c.destination); var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = buf; } catch (e) { AU.ctx = null; }
}
function tone(f, dur, type, g, f2, delay) { if (!AU.ctx || save.mute) return; var c = AU.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), gn = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(gn); gn.connect(AU.master); o.start(t); o.stop(t + dur + 0.05); }
function noise(dur, type, f, g, f2, delay) { if (!AU.ctx || save.mute) return; var c = AU.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(); s.buffer = AU.noise; var fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); var gn = c.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(gn); gn.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
function sfx(n) {
  if (n === 'bounce') { tone(150, 0.1, 'sine', 0.45, 70); noise(0.04, 'lowpass', 700, 0.25); }
  else if (n === 'pass') noise(0.2, 'bandpass', 700, 0.25, 2200);
  else if (n === 'catch') noise(0.06, 'lowpass', 900, 0.35);
  else if (n === 'swish') noise(0.4, 'highpass', 3000, 0.4, 7000);
  else if (n === 'rim') { tone(620, 0.3, 'triangle', 0.3, 480); tone(940, 0.2, 'sine', 0.15); }
  else if (n === 'board') { tone(220, 0.15, 'square', 0.12, 120); noise(0.08, 'lowpass', 1200, 0.3); }
  else if (n === 'dunk') { tone(80, 0.35, 'sine', 0.7, 45); noise(0.35, 'lowpass', 900, 0.6); tone(520, 0.45, 'triangle', 0.22, 300); }
  else if (n === 'crowd') { noise(2.4, 'bandpass', 900, 0.55, 500); noise(1.8, 'lowpass', 500, 0.35); }
  else if (n === 'aww') noise(1.3, 'lowpass', 600, 0.35, 200);
  else if (n === 'whistle') { tone(2900, 0.45, 'sine', 0.18); tone(3050, 0.45, 'sine', 0.12); }
  else if (n === 'buzzer') { tone(180, 0.9, 'sawtooth', 0.22); tone(186, 0.9, 'square', 0.12); }
  else if (n === 'star') { tone(880, 0.15, 'triangle', 0.2); tone(1320, 0.25, 'triangle', 0.18, 0, 0.08); }
  else if (n === 'squeak') tone(1900, 0.07, 'square', 0.05, 2700);
}

// ---------------------------------------------------------------- stato di gioco e interfaccia
var state = 'loading', cur = null, G = null, V = { home: [], away: [] }, draw = null, meter = null, shotSeq = null, time = 0, slow = 1, chapNow = null, freezeT = 0, lastEv = 0, actAnim = {}, ftSeq = null;
var NUMS_H = [7, 11, 23, 4, 33], NUMS_A = [2, 9, 15, 21, 30];
function buildPlayers() {
  V.home.forEach(disposePlayer); V.away.forEach(disposePlayer); V = { home: [], away: [] };
  var ch = chapterOf(cur.idx);
  G.home.forEach(function (p, i) { var v = makePlayer(0, NUMS_H[i], ch, i); v.px = p.x; v.py = p.y; V.home.push(v); });
  G.away.forEach(function (p, i) { var v = makePlayer(1, NUMS_A[i], ch, i, p.ai === 'keeper'); v.px = p.x; v.py = p.y; V.away.push(v); });
}
function setChapter(ch) { if (chapNow !== ch) { chapNow = ch; buildArena(ch); } }
function needText(L) { return L.ft ? 'Segna ' + L.ft + ' tiri liberi su ' + L.ft : L.need === 'three' ? 'Segna da 3 punti' : L.need === 'dunk' ? 'Segna con una schiacciata' : L.need === 'alley' ? 'Segna con un alley-oop' : L.score ? 'Segna e vinci la partita' : 'Fai canestro'; }
function bonusText(b) { return { swish: 'canestro pulito (senza toccare il ferro)', assist: 'canestro dopo un passaggio', onepass: 'con un solo passaggio', three: 'tiro da tre', dunk: 'schiacciata o alley-oop', alley: 'alley-oop' }[b] || ''; }
function fmtClock(c) { if (c === null || c === undefined) return '--:--'; return '0:' + (c < 10 ? '0' : '') + c.toFixed(1); }
function startLevel(i) {
  ensureAudio();
  cur = getLevel(i); G = newState(cur);
  setChapter(chapterOf(i)); buildPlayers();
  state = 'play'; draw = null; meter = null; shotSeq = null; ftSeq = null; slow = 1; actAnim = {}; lastEv = 0; clearPath(); showRoutes();
  ['menu', 'map', 'result', 'intro', 'chap'].forEach(function (id) { $(id).classList.add('hidden'); });
  $('hud').classList.remove('hidden'); $('meter').classList.add('hidden');
  $('lvlName').textContent = 'Livello ' + i + ' · ' + cur.name;
  $('lvlObj').textContent = needText(cur);
  $('lvlBonus').textContent = '★ ' + bonusText(cur.bonus) + ' · ★ entro ' + cur.par + (cur.par === 1 ? ' mossa' : ' mosse');
  updMoves(); updSB();
  var tip = cur.tip || ''; $('tip').textContent = tip; $('tip').classList.toggle('on', !!tip);
  crowdU.hype.value = 0;
  snapCam();
  sfx('whistle');
}
function updMoves() { var h = ''; for (var i = 0; i < cur.moves; i++) h += '<i class="' + (i < G.used ? 'used' : '') + '"></i>'; $('moves').innerHTML = h; }
function updSB(extra) {
  var ch = chapterOf(cur.idx), sc = cur.score || null;
  var hs = sc ? sc[0] + (extra || 0) : null, as = sc ? sc[1] : null;
  $('sb').classList.toggle('hidden', !sc && !G.clock);
  $('sbH').textContent = ch.homeName; $('sbA').textContent = ch.awayName;
  $('sbHs').textContent = hs === null ? '-' : hs; $('sbAs').textContent = as === null ? '-' : as;
  $('sbT').textContent = G.clock !== null ? fmtClock(G.clock) : 'ULTIMO POSSESSO';
  $('sbT').classList.toggle('urgent', G.clock !== null && G.clock < 3);
  drawScoreboard(ch.homeName, ch.awayName, hs === null ? 0 : hs, as === null ? 0 : as, G.clock !== null ? fmtClock(G.clock) : 'Q4', ch);
}

// ---------------------------------------------------------------- input
var raycaster = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
function floorAt(x, y) { ndc.set(x / W * 2 - 1, -(y / Hh) * 2 + 1); raycaster.setFromCamera(ndc, camera); if (!raycaster.ray.intersectPlane(floorPlane, hitP)) return null; return { x: hitP.x, y: -hitP.z }; }
function scr(x, y, z) { var v = W3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * Hh }; }
function holderScr() { var h = G.home[G.holder]; return scr(h.x, h.y, 1.1); }
function rimScr() { return scr(0, 12.43, 3.05); }
function pxPerM(x, y) { var a = scr(x, y, 0), b = scr(x, y, 1); return Math.abs(a.y - b.y); }
// ---- anteprima del tiro: parabola, bersaglio e zona buona sul ferro
var arcMesh = null, aimMark = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.11, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, side: THREE.DoubleSide }));
var tolRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 40), new THREE.MeshBasicMaterial({ color: 0x4fe0b0, depthTest: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
var blockMark = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff3b4f, depthTest: false, transparent: true, opacity: 0.85 }));
[aimMark, tolRing, blockMark].forEach(function (m) { m.visible = false; m.renderOrder = 6; scene.add(m); });
tolRing.position.set(0, 3.05, -12.43); tolRing.rotation.x = -Math.PI / 2;
function clearArc() { if (arcMesh) { scene.remove(arcMesh); arcMesh.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); arcMesh = null; } aimMark.visible = tolRing.visible = blockMark.visible = false; }
var rimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 12.43), aimHit = new THREE.Vector3();
// mira: l'errore si misura in pixel attorno al ferro (un ferro piccolo sullo schermo non deve essere impossibile)
function rimPx() { var a = scr(0, 12.43, 3.05), b = scr(0.228, 12.43, 3.05); return Math.max(6, Math.abs(b.x - a.x)); }
function aimRadiusPx() { return rimPx() * 3 + 30; }
function aimFrom(x, y) {
  var rs = rimScr(), R = aimRadiusPx(), ex = (x - rs.x) / R, ey = (y - rs.y) / R;
  return { dx: clamp(ex * 0.25, -1.8, 1.8), dz: clamp(-ey * 0.25, -1.4, 1.4) };
}
// la curva della striscia verso l'alto alza la parabola
function apexFrom(scrPts, h) {
  var s = scrPts[0], e = scrPts[scrPts.length - 1], cx = e[0] - s[0], cy = e[1] - s[1], L = Math.max(30, Math.hypot(cx, cy));
  var nx = cy / L, ny = -cx / L; if (ny > 0) { nx = -nx; ny = -ny; }
  var bulge = 0; scrPts.forEach(function (p) { bulge = Math.max(bulge, ((p[0] - s[0]) * nx + (p[1] - s[1]) * ny) / L); });
  var ar = apexRange(rimDist(h.x, h.y)); return lerp(ar[0], ar[1], clamp(0.25 + bulge / 0.3, 0, 1));
}
function showArc(h, aim, apex) {
  var ev = shotEval(G, h.x, h.y, aim, apex), pts = [], z0 = ev.kind === 'dunk' ? 2.7 : 2.35, blockedAt = -1;
  for (var k = 0; k <= 30; k++) { var u = k / 30, p = shotPoint(h.x, h.y, z0, RIM.x + aim.dx, RIM.y, RIM.z + aim.dz, ev.apex, u); pts.push(W3(p[0], p[1], p[2])); if (ev.blocker && blockedAt < 0 && u >= ev.bu) blockedAt = k; }
  if (arcMesh) { scene.remove(arcMesh); arcMesh.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
  var col = ev.blocker ? 0xff3b4f : ev.outcome === 'swish' ? 0x4fe0b0 : ev.outcome === 'rimin' ? 0xffcf3f : ev.outcome === 'rimout' ? 0xff9a3f : 0xff6b6b;
  var shown = blockedAt > 0 ? pts.slice(0, blockedAt + 1) : pts;
  arcMesh = new THREE.Group();
  arcMesh.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shown), 48, 0.06, 8, false), new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.92 })));
  var flat = shown.map(function (q) { return new THREE.Vector3(q.x, 0.05, q.z); });
  arcMesh.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flat), 24, 0.04, 6, false), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })));
  arcMesh.traverse(function (o) { o.renderOrder = 5; }); scene.add(arcMesh);
  aimMark.visible = true; aimMark.position.set(aim.dx, 3.05 + aim.dz, -12.43 + 0.02); aimMark.material.color.setHex(col);
  tolRing.visible = ev.kind !== 'dunk'; var pxm = rimPx() / 0.228, rr = Math.max(0.24, (ev.win.rim / 0.25) * aimRadiusPx() / pxm); tolRing.scale.setScalar(rr / 0.22);
  blockMark.visible = !!ev.blocker; if (ev.blocker) blockMark.position.copy(pts[blockedAt]);
  return ev;
}
function pointerDown(x, y) {
  ensureAudio();
  if (state !== 'play' || G.phase !== 'freeze' || shotSeq) return;
  var hs = holderScr(), h = G.home[G.holder], rad = Math.max(52, pxPerM(h.x, h.y) * 0.9);
  if (dist(x, y, hs.x, hs.y) > rad) {
    for (var i = 0; i < G.home.length; i++) { if (i === G.holder) continue; var ps = scr(G.home[i].x, G.home[i].y, 1); if (dist(x, y, ps.x, ps.y) < Math.max(40, pxPerM(G.home[i].x, G.home[i].y) * 0.6)) { commit([[h.x, h.y], [G.home[i].x, G.home[i].y]], false); return; } }
    return;
  }
  draw = { pts: [[h.x, h.y]], scr: [[hs.x, hs.y]], onRim: false, cls: { type: 'none' } };
  $('tip').classList.remove('on');
}
function shotZone(x, y) { var rs = rimScr(); return dist(x, y, rs.x, rs.y) < Math.max(105, Math.min(W, Hh) * 0.24); }
function pointerMove(x, y) {
  if (!draw) return;
  draw.scr.push([x, y]);
  draw.onRim = shotZone(x, y);
  var h = G.home[G.holder], el = $('pathLbl');
  if (draw.onRim) {
    draw.cls = classify(G, draw.pts, true);
    if (draw.cls.type === 'shot') {
      clearPath(); draw.aim = aimFrom(x, y); draw.apex = apexFrom(draw.scr, h);
      var ev = showArc(h, draw.aim, draw.apex);
      var kindTxt = ev.kind === 'three' ? 'Tiro da 3' : ev.kind === 'dunk' ? 'Schiacciata' : ev.kind === 'layup' ? 'Terzo tempo' : 'Tiro';
      var res = ev.blocker ? (ev.blocker.ai === 'keeper' ? 'stoppato dal pivot!' : 'stoppato!') : ev.outcome === 'swish' ? 'dentro pulito' : ev.outcome === 'rimin' ? 'sul ferro, entra' : ev.outcome === 'rimout' ? 'sul ferro, esce' : 'fuori';
      el.textContent = kindTxt + ' · ' + res; el.className = 'on ' + (ev.blocker || !ev.made ? 'none' : 'shot');
      el.style.left = x + 'px'; el.style.top = (y - 56) + 'px';
      return;
    }
  }
  clearArc();
  var f = floorAt(x, y); if (!f) return;
  f.x = clamp(f.x, -7.3, 7.3); f.y = clamp(f.y, 0.3, 13.8);
  var last = draw.pts[draw.pts.length - 1];
  if (dist(last[0], last[1], f.x, f.y) > 0.22) draw.pts.push([f.x, f.y]);
  draw.cls = classify(G, draw.pts, draw.onRim);
  showPath(draw.pts, draw.onRim, draw.cls);
  el.textContent = draw.cls.type === 'pass' ? 'Passaggio al n.' + NUMS_H[draw.cls.to] : draw.cls.type === 'alley' ? 'Alley-oop al n.' + NUMS_H[draw.cls.to] : (draw.cls.why || '');
  el.className = 'on ' + draw.cls.type; el.style.left = x + 'px'; el.style.top = (y - 52) + 'px';
}
function pointerUp() {
  if (!draw) return; var d = draw; draw = null; clearPath(); clearArc();
  if (d.onRim && d.cls.type === 'shot') { fire({ type: 'shot', aim: d.aim, apex: d.apex }); return; }
  if (d.pts.length < 3 && !d.onRim) return;
  commit(d.pts, d.onRim);
}
function commit(pts, onRim) {
  if (!G || G.phase !== 'freeze' || shotSeq) return;
  var cls = classify(G, pts, onRim);
  if (cls.type === 'none') { $('tip').textContent = cls.why; $('tip').classList.add('on'); return; }
  if (cls.type === 'shot') { fire({ type: 'shot', aim: { dx: 0, dz: 0 }, apex: 4.6 }); return; }
  fire({ type: cls.type, to: cls.to, pts: pts });
}
function fire(act) {
  if (!G || G.phase !== 'freeze' || shotSeq) return;
  routeObjs.forEach(function (o) { o.visible = false; }); $('tip').classList.remove('on');
  if (act.type === 'pass' || act.type === 'alley') sfx('pass');
  startAction(G, act); updMoves();
  if (act.type === 'shot') { stepAction(G, 1 / 60); if (G.phase === 'over') onOver(); }
}
function floatText(t, cls) { var el = $('bigText'); el.textContent = t; el.className = 'on ' + (cls || ''); clearTimeout(floatText.tm); floatText.tm = setTimeout(function () { el.className = ''; }, 1400); }

// ---------------------------------------------------------------- sequenza del tiro: la palla va dove l'hai mandata
var ballP = new THREE.Vector3(), relP = new THREE.Vector3(), bVel = new THREE.Vector3();
function startShotSeq(sh) {
  var shooter = G.home[G.holder], dunk = sh.kind === 'dunk' || sh.kind === 'alley';
  shotSeq = { sh: sh, t: 0, dunk: dunk, made: sh.outcome === 'swish' || sh.outcome === 'rimin' || sh.outcome === 'in', released: false, ended: false, sx: shooter.x, sy: shooter.y, phase: 'air' };
  if (sh.blocked) shotSeq.made = false;
  var d = rimDist(shooter.x, shooter.y);
  shotSeq.flight = 0.75 + d * 0.05 + Math.max(0, (sh.apex || 4.5) - 4.5) * 0.12;
  actAnim[G.holder] = { type: dunk ? 'dunk' : 'shoot', t: 0 };
  // i difensori vicini saltano: il pivot come un portiere
  G.away.forEach(function (a, i) { if (sh.blocked && sh.by === i) actAnim['a' + i] = { type: 'block', t: -0.05, big: a.ai === 'keeper' }; else if (dist(a.x, a.y, shooter.x, shooter.y) < 2.5 || a.ai === 'keeper') actAnim['a' + i] = { type: 'block', t: -0.25 - Math.random() * 0.1, big: a.ai === 'keeper', late: true }; });
  sfx(dunk ? 'squeak' : 'catch');
}
function hitEffects(kind) {
  if (kind === 'made') { sfx('swish'); netK = 1; crowdU.hype.value = 1; confetti(); sfx('crowd'); }
  else if (kind === 'rim') { sfx('rim'); }
  else if (kind === 'board') sfx('board');
}
function updShotSeq(dt) {
  var s = shotSeq; s.t += dt;
  var v = V.home[G.holder], p = G.home[G.holder], sh = s.sh;
  if (s.dunk) {
    var u = clamp(s.t / 0.55, 0, 1), tx = lerp(s.sx, 0, 0.88), ty = lerp(s.sy, 12.43, 0.88) - 0.35;
    p.x = lerp(s.sx, tx, sm(u)); p.y = lerp(s.sy, ty, sm(u)); p.vx = (tx - s.sx) * 2; p.vy = (ty - s.sy) * 2;
    v.jump = u < 0.35 ? 0 : Math.sin(clamp((u - 0.35) / 0.65, 0, 1) * Math.PI * 0.5) * 1.15;
    if (s.t > 0.55 && s.t < 0.95) v.jump = 1.15; if (s.t >= 0.95) v.jump = Math.max(0, 1.15 - (s.t - 0.95) * 4);
    if (s.t < 0.6) { v.bones.RightHand.getWorldPosition(ballP); ball.position.copy(ballP); }
    else if (s.made) { var k = clamp((s.t - 0.6) / 0.35, 0, 1); ball.position.set(0, 3.0 - k * 2.9, -12.43); }
    else { var k2 = s.t - 0.6; ball.position.set(k2 * 3, Math.max(0.12, 3.1 + k2 * 2 - k2 * k2 * 9), -12.43 + k2 * 4); }
    if (!s.slam && s.t >= 0.6) { s.slam = true; slow = 0.35; if (s.made) { sfx('dunk'); netK = 1; shake = 0.35; crowdU.hype.value = 1; floatText(sh.kind === 'alley' ? 'ALLEY-OOP!' : 'SCHIACCIATA!', 'gold'); confetti(); sfx('crowd'); } else { sfx('board'); sfx('aww'); floatText('STOPPATA!', 'red'); } }
    if (s.t > 1.0) slow = 1;
    if (s.t > 2.1 && !s.ended) endShot();
    return;
  }
  v.jump = s.t < 0.18 ? 0 : s.t < 0.62 ? Math.sin((s.t - 0.18) / 0.44 * Math.PI) * 0.5 : 0;
  if (s.t < 0.42) { v.bones.RightHand.getWorldPosition(ballP); ball.position.copy(ballP).add(vA.set(0, 0.08, 0)); relP.copy(ball.position); return; }
  if (!s.released) { s.released = true; s.rt = s.t; relP.copy(ball.position); }
  var aim = sh.aim || { dx: 0, dz: 0 }, apex = sh.apex || 4.6, tgt = new THREE.Vector3(aim.dx, 3.05 + aim.dz, -12.43);
  var long = aim.dz > 0.25 && !s.made, ft = (s.t - s.rt) / s.flight;
  if (long) tgt.z = -12.43 - Math.min(0.75, aim.dz * 0.8);
  if (s.phase === 'air') {
    var uu = Math.min(ft, sh.blocked ? sh.bu : 1);
    ball.position.lerpVectors(relP, tgt, uu); ball.position.y = lerp(relP.y, tgt.y, uu) + 4 * uu * (1 - uu) * (apex - Math.max(relP.y, tgt.y));
    slow = ft > 0.55 ? 0.42 : 1;
    if (sh.blocked && ft >= sh.bu) {
      s.phase = 'loose'; slow = 0.5; sfx('board'); sfx('aww'); floatText(sh.by !== undefined && G.away[sh.by] && G.away[sh.by].ai === 'keeper' ? 'STOPPATA DEL PIVOT!' : 'STOPPATA!', 'red'); shake = 0.2;
      bVel.set((Math.random() - 0.5) * 4, 2.5, 5);
    } else if (ft >= 1) {
      slow = 0.6;
      var o = sh.outcome;
      if (o === 'swish') { s.phase = 'net'; s.pt = s.t; hitEffects('made'); floatText(sh.kind === 'three' ? 'DA TRE!' : 'CANESTRO!', 'gold'); }
      else if (o === 'rimin') { s.phase = 'rimin'; s.pt = s.t; hitEffects('rim'); }
      else if (o === 'rimout') { s.phase = 'loose'; hitEffects('rim'); sfx('aww'); var away = new THREE.Vector3(aim.dx, 0, aim.dz * -0.5).normalize(); if (!isFinite(away.x)) away.set(1, 0, 0); bVel.set(away.x * 2.6 + (aim.dx >= 0 ? 0.6 : -0.6), 2.4, 1.5 + Math.abs(aim.dz)); floatText('SUL FERRO…', 'red'); }
      else if (long) { s.phase = 'loose'; hitEffects('board'); sfx('aww'); bVel.set(aim.dx * 1.4, 0.6, 3.2); floatText('TROPPO LUNGO', 'red'); }
      else { s.phase = 'loose'; sfx('aww'); bVel.set((ball.position.x - relP.x) / s.flight * 0.6, -3, (ball.position.z - relP.z) / s.flight * 0.6); floatText(aim.dz < -0.25 ? 'CORTO!' : 'FUORI!', 'red'); }
    }
    return;
  }
  if (s.phase === 'rimin') {
    var kk = clamp((s.t - s.pt) / 0.45, 0, 1);
    ball.position.set(lerp(tgt.x, 0, kk), 3.12 + Math.sin(kk * Math.PI) * 0.35, lerp(tgt.z, -12.43, kk));
    if (kk >= 1) { s.phase = 'net'; s.pt = s.t; hitEffects('made'); floatText('DENTRO!', 'gold'); }
    return;
  }
  if (s.phase === 'net') {
    var k3 = s.t - s.pt; if (k3 > 0.3) slow = 1;
    ball.position.set(0, Math.max(0.12, 3.0 - k3 * 4.5 - k3 * k3 * 4), -12.43 + k3 * 0.6);
    if (ball.position.y <= 0.13 && !s.b1) { s.b1 = true; sfx('bounce'); }
    if (!s.ended && k3 > 1.2) endShot();
    return;
  }
  // palla libera: gravità e rimbalzi
  if (s.t - s.rt > s.flight + 0.4) slow = 1;
  bVel.y -= 9.8 * dt; ball.position.addScaledVector(bVel, dt);
  if (ball.position.y < 0.12) { ball.position.y = 0.12; if (bVel.y < -1) { bVel.y = -bVel.y * 0.55; sfx('bounce'); } else bVel.y = 0; bVel.x *= 0.85; bVel.z *= 0.85; }
  if (!s.ended && s.t - s.rt > s.flight + 1.5) endShot();
}
function endShot() {
  var s = shotSeq; s.ended = true;
  var res = G.result;
  setTimeout(function () { if (state === 'play') showResult(res); }, s.made ? 900 : 500);
  if (s.made) { V.home.forEach(function (v, i) { actAnim[i] = { type: 'cheer', t: 0 }; }); updSB(res.shot.pts); }
  else V.home.forEach(function (v, i) { actAnim[i] = { type: 'sad', t: 0 }; });
}
function onOver() {
  var res = G.result;
  if (res.shot) { startShotSeq(res.shot); return; }
  if (res.buzzer) { sfx('buzzer'); floatText('SIRENA!', 'red'); }
  else if (res.steal !== undefined) { sfx('aww'); actAnim['a' + res.steal] = { type: 'steal', t: 0 }; floatText('RUBATA!', 'red'); }
  else sfx('whistle');
  V.home.forEach(function (v, i) { actAnim[i] = { type: 'sad', t: 0 }; });
  shake = 0.15;
  setTimeout(function () { if (state === 'play') showResult(res); }, 1300);
}
function computeStars(res) {
  if (!res.ok) return 0;
  var st = 1, kind = res.shot.kind;
  if (G.used <= cur.par) st++;
  var b = cur.bonus, ok = false;
  if (b === 'swish') ok = res.shot.outcome === 'swish' || kind === 'dunk' || kind === 'alley';
  else if (b === 'assist') ok = G.lastPass || kind === 'alley';
  else if (b === 'onepass') ok = G.passes === 1;
  else if (b === 'three') ok = kind === 'three';
  else if (b === 'dunk') ok = kind === 'dunk' || kind === 'alley';
  else if (b === 'alley') ok = kind === 'alley';
  if (ok) st++;
  return st;
}
function showResult(res) {
  state = 'result';
  var stars = computeStars(res), i = cur.idx;
  if (stars > starsOf(i)) { save.stars[i] = stars; persist(); }
  var won = res.ok && cur.score;
  $('rTitle').textContent = res.ok ? (won ? 'Vittoria!' : stars === 3 ? 'Perfetto!' : 'Livello superato') : 'Riprova';
  $('rReason').textContent = res.ok ? (res.shot.kind === 'three' ? 'Canestro da 3 punti.' : res.shot.kind === 'alley' ? 'Alley-oop spettacolare.' : res.shot.kind === 'dunk' ? 'Schiacciata.' : res.shot.kind === 'ft' ? 'Liberi tutti dentro.' : 'Canestro.') + ' Mosse usate: ' + G.used + ' su ' + cur.moves + '.' : res.reason;
  var h = ''; for (var s = 1; s <= 3; s++) h += '<i class="' + (s <= stars ? 'on' : '') + '" style="animation-delay:' + (s * 0.18) + 's">★</i>';
  $('rStars').innerHTML = h;
  var b3 = res.ok && stars === 3 || (res.ok && stars === 2 && G.used > cur.par);
  $('rList').innerHTML = res.ok ? ('<li class="ok">Canestro</li><li class="' + (G.used <= cur.par ? 'ok' : '') + '">Entro ' + cur.par + (cur.par === 1 ? ' mossa' : ' mosse') + '</li><li class="' + (b3 ? 'ok' : '') + '">' + bonusText(cur.bonus) + '</li>') : '';
  $('btnNext').classList.toggle('hidden', !res.ok || i >= 50);
  $('result').classList.remove('hidden'); $('hud').classList.add('hidden');
  for (var k = 0; k < stars; k++) setTimeout(function () { sfx('star'); }, 200 + k * 180);
}

// ---------------------------------------------------------------- mappa e schede
function buildMap() {
  var h = '';
  CHAPTERS.forEach(function (ch, ci) {
    var tot = 0; for (var j = 1; j <= 10; j++) tot += starsOf(ci * 10 + j);
    h += '<section class="chap"><header style="--c:' + hexCss(ch.home) + '"><b>Capitolo ' + (ci + 1) + ' · ' + ch.name + '</b><span>' + ch.sub + '</span><em>★ ' + tot + '/30</em></header><div class="lvls">';
    for (var i = 1; i <= 10; i++) {
      var n = ci * 10 + i, st = starsOf(n), un = unlocked(n), stx = '';
      for (var q = 1; q <= 3; q++) stx += '<i class="' + (q <= st ? 'on' : '') + '">★</i>';
      h += '<button class="lvl' + (un ? '' : ' locked') + (st ? ' done' : '') + '" data-l="' + n + '"' + (un ? '' : ' disabled') + '><b>' + n + '</b><span>' + (un ? stx : 'bloccato') + '</span></button>';
    }
    h += '</div></section>';
  });
  $('mapList').innerHTML = h;
  var all = 0; for (var q2 = 1; q2 <= 50; q2++) all += starsOf(q2);
  $('mapStars').textContent = '★ ' + all + ' / 150';
}
function showMap() { state = 'map'; buildMap(); ['menu', 'result', 'intro', 'chap'].forEach(function (id) { $(id).classList.add('hidden'); }); $('hud').classList.add('hidden'); $('map').classList.remove('hidden'); }
function showIntro(i) {
  var ci = Math.floor((i - 1) / 10), ch = CHAPTERS[ci];
  if ((i - 1) % 10 === 0 && !save.seenChap[ci]) { save.seenChap[ci] = 1; persist(); $('cTitle').textContent = 'Capitolo ' + (ci + 1) + ' · ' + ch.name; $('cText').textContent = ch.story; $('chap').dataset.l = i; $('map').classList.add('hidden'); $('chap').classList.remove('hidden'); return; }
  var L = getLevel(i);
  $('iChap').textContent = 'Capitolo ' + (ci + 1) + ' · ' + ch.name;
  $('iTitle').textContent = 'Livello ' + i + ' · ' + L.name;
  $('iStory').textContent = L.story || '';
  $('iObj').textContent = needText(L);
  $('iMoves').textContent = L.moves + (L.moves === 1 ? ' mossa' : ' mosse') + (L.clock ? ' · ' + L.clock + ' s' : '');
  $('iStars').innerHTML = '<li>★ ' + needText(L) + '</li><li>★ Entro ' + L.par + (L.par === 1 ? ' mossa' : ' mosse') + '</li><li>★ ' + bonusText(L.bonus) + '</li>';
  $('intro').dataset.l = i;
  ['map', 'result', 'chap'].forEach(function (id) { $(id).classList.add('hidden'); }); $('intro').classList.remove('hidden');
  // anteprima del campo sotto la scheda
  if (state !== 'play') { cur = L; G = newState(L); setChapter(ch); buildPlayers(); snapCam(); }
}

// ---------------------------------------------------------------- telecamera
var camP = new THREE.Vector3(), camL = new THREE.Vector3(), shake = 0;
var camTest = new THREE.PerspectiveCamera();
function baseCam(out, look) {
  var portrait = W < Hh, hx = 0, hy = 6;
  if (G) { var h = G.home[G.holder]; hx = h.x; hy = h.y; }
  var dx = hx - RIM.x, dy = hy - RIM.y, dl = Math.max(0.1, Math.hypot(dx, dy)); dx /= dl; dy /= dl;
  // vista alle spalle di chi ha la palla, verso il canestro; si allontana finché tutti sono in campo visivo
  var D = portrait ? 7.5 : 6.2, Hc = portrait ? 6.8 : 4.4;
  for (var it = 0; it < 6; it++) {
    out.set(hx + dx * D * 0.85 + dx * 1.5, Hc + it * 0.7, -(hy + dy * D));
    look.set(lerp(hx, RIM.x, 0.6), 1.3, -lerp(hy, RIM.y, 0.6));
    if (!G) return;
    camTest.copy(camera); camTest.position.copy(out); camTest.lookAt(look); camTest.updateMatrixWorld(); camTest.updateProjectionMatrix();
    var okAll = true;
    G.home.concat(G.away).forEach(function (q) { var v = W3(q.x, q.y, 1.0).project(camTest); if (Math.abs(v.x) > 0.9 || v.y > 0.85 || v.y < -0.92 || v.z > 1) okAll = false; });
    if (okAll) return;
    D += 1.6;
  }
}
var tgtP = new THREE.Vector3(), tgtL = new THREE.Vector3();
function snapCam() { baseCam(camP, camL); camera.position.copy(camP); camera.lookAt(camL); }
function updCam(dt) {
  baseCam(tgtP, tgtL);
  if (shotSeq && !shotSeq.ended) {
    // durante il tiro la camera si avvicina e segue la palla
    var bx = ball.position.x, by = ball.position.y, bz = ball.position.z, portrait = W < Hh;
    tgtP.set(lerp(tgtP.x, bx * 0.5 + (shotSeq.sx > 0 ? -3 : 3), 0.55), lerp(tgtP.y, portrait ? 6.5 : 4.2, 0.5), lerp(tgtP.z, -4.5, 0.55));
    tgtL.set(lerp(tgtL.x, bx, 0.6), lerp(tgtL.y, by, 0.5), lerp(tgtL.z, bz, 0.6));
  }
  camP.lerp(tgtP, 1 - Math.exp(-dt * 2.2)); camL.lerp(tgtL, 1 - Math.exp(-dt * 3));
  camera.position.copy(camP);
  if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
  camera.lookAt(camL);
  if (camFix) { camera.position.copy(camFix.p); camera.lookAt(camFix.l); }
}

// ---------------------------------------------------------------- animazione dei giocatori
function animPlayer(v, p, dt, role, idx, isHolder, freezeMode) {
  var a = actAnim[role === 'a' ? 'a' + idx : idx];
  if (a) a.t += dt;
  // posizione (morbida) e direzione
  v.px = lerp(v.px, p.x, 1 - Math.exp(-dt * 22)); v.py = lerp(v.py, p.y, 1 - Math.exp(-dt * 22));
  var spd = Math.hypot(p.vx || 0, p.vy || 0); v.speedS = lerp(v.speedS, spd, 1 - Math.exp(-dt * 8));
  var tx, ty, h = G.home[G.holder];
  if (spd > 0.6) { tx = p.vx; ty = p.vy; }
  else if (role === 'a') { tx = h.x - p.x; ty = h.y - p.y; }
  else if (isHolder) { tx = 0 - p.x; ty = 12.43 - p.y; }
  else { tx = h.x - p.x; ty = h.y - p.y; }
  var want = Math.atan2(tx, -ty);
  var dAng = ((want - v.facing + Math.PI * 3) % TAU) - Math.PI; v.facing += dAng * (1 - Math.exp(-dt * 10));
  v.wrap.position.set(v.px, v.jump || 0, -v.py); v.wrap.rotation.y = v.facing;
  // pesi delle animazioni registrate
  var s = v.speedS, wI = clamp(1 - s / 1.6, 0, 1), wR = clamp((s - 2.2) / 2, 0, 1), wW = clamp(1 - wI - wR, 0, 1);
  var cel = a && a.type === 'cheer', sad = a && a.type === 'sad';
  v.acts.idle.setEffectiveWeight(cel || sad ? 0 : wI); v.acts.walk.setEffectiveWeight(cel || sad ? 0 : wW); v.acts.run.setEffectiveWeight(cel || sad ? 0 : wR);
  if (v.acts.agree) v.acts.agree.setEffectiveWeight(cel ? 1 : 0);
  if (v.acts.headShake) v.acts.headShake.setEffectiveWeight(sad ? 1 : 0);
  v.acts.run.timeScale = clamp(s / 5.5, 0.6, 1.5); v.acts.walk.timeScale = clamp(s / 1.6, 0.6, 1.4);
  v.mixer.update(dt * (freezeMode ? 0.35 : 1));
  v.wrap.updateMatrixWorld(true);
  // pose delle braccia
  F.set(Math.sin(v.facing), 0, Math.cos(v.facing)); RT.crossVectors(F, UP).normalize();
  var name = null, w = 1;
  if (a) {
    if (a.type === 'pass') { name = 'pass'; w = a.t < 0.35 ? Math.sin(a.t / 0.35 * Math.PI) : 0; if (a.t > 0.4) delete actAnim[idx]; }
    else if (a.type === 'catch') { name = 'catch'; w = clamp(1 - a.t / 0.5, 0, 1); }
    else if (a.type === 'set') name = 'hold';
    else if (a.type === 'shoot') { name = a.t < 0.42 ? 'shoot' : 'release'; w = a.t < 0.12 ? a.t / 0.12 : a.t > 1.1 ? clamp(1.5 - a.t, 0, 1) : 1; }
    else if (a.type === 'dunk') name = a.t < 0.3 ? 'hold' : 'dunk';
    else if (a.type === 'block') { if (a.t > 0) { name = 'block'; w = a.t < 0.2 ? a.t / 0.2 : clamp(1.6 - a.t, 0, 1); var jh = a.big ? 0.95 : 0.6; v.jump = a.t < 0.75 ? Math.sin(a.t / 0.75 * Math.PI) * jh * (a.late ? 0.7 : 1) : 0; } }
    else if (a.type === 'steal') { name = 'steal'; w = clamp(1.2 - a.t, 0, 1); }
    else if (a.type === 'cheer') { name = 'cheer'; v.jump = Math.abs(Math.sin(a.t * 6)) * 0.35 * clamp(2.5 - a.t, 0, 1); }
    else if (a.type === 'sad') name = 'sad';
  }
  if (!name) {
    if (role === 'h' && isHolder && G.ball.mode === 'held') name = s > 0.8 ? 'dribble' : 'hold';
    else if (role === 'a') name = (p.ai === 'keeper' || dist(p.x, p.y, h.x, h.y) < 2.4) ? 'defend' : 'deny', w = 0.85;
    else if (role === 'h' && G.act && (G.act.type === 'pass' || G.act.type === 'alley') && G.act.to === idx) { name = 'catch'; w = 0.9; }
  }
  if (name) applyPose(v, name, w);
  if (a && a.type === 'pass' && name !== 'pass' && a.t < 0.35) applyPose(v, 'pass', w);
  // anello a terra
  v.ring.position.set(v.px, 0.03, -v.py);
  v.ring.material.opacity = role === 'a' ? (p.stuck > 0 ? 0.25 : 0.55) : 0.5;
}
var bounceT = 0;
function updBall(dt) {
  if (shotSeq) return;
  var h = G.home[G.holder], v = V.home[G.holder];
  if (G.ball.mode === 'held' || G.phase === 'freeze') {
    v.bones.RightHand.getWorldPosition(ballP);
    var moving = v.speedS > 0.8;
    if (moving) {
      bounceT += dt * 3.2; var ph = bounceT % 1, y = ph < 0.5 ? lerp(ballP.y - 0.05, 0.12, sm(ph * 2)) : lerp(0.12, ballP.y - 0.05, sm((ph - 0.5) * 2));
      if (ph >= 0.5 && !updBall.b) { updBall.b = true; sfx('bounce'); } if (ph < 0.5) updBall.b = false;
      ball.position.set(ballP.x + F.x * 0.12, y, ballP.z + F.z * 0.12);
    } else {
      var lh = vB; v.bones.LeftHand.getWorldPosition(lh);
      ball.position.set((ballP.x + lh.x) / 2, (ballP.y + lh.y) / 2 + 0.02, (ballP.z + lh.z) / 2).addScaledVector(F, 0.1);
    }
  } else if (G.ball.mode === 'pass' || G.ball.mode === 'stolen') {
    ball.position.copy(W3(G.ball.x, G.ball.y, G.ball.z));
  }
}

// ---------------------------------------------------------------- loop principale
var last = 0, acc = 0, sbT = 0;
function frame(ts) {
  var rdt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; time += rdt;
  var dt = rdt * slow;
  if (state === 'play' && G) {
    if (meter) { meter.v += meter.dir * meter.speed * rdt; if (meter.v > 1) { meter.v = 2 - meter.v; meter.dir = -1; } if (meter.v < 0) { meter.v = -meter.v; meter.dir = 1; } $('mNeedle').style.left = (meter.v * 100) + '%'; }
    if (G.phase === 'action') {
      acc += dt;
      while (acc >= DT && G.phase === 'action') { stepAction(G, DT); acc -= DT; }
      // eventi della simulazione per le animazioni
      while (lastEv < G.ev.length) {
        var e = G.ev[lastEv++];
        if (e.t === 'pass') actAnim[e.from] = { type: 'pass', t: 0 };
        else if (e.t === 'catch') { actAnim[e.who] = { type: 'catch', t: 0 }; sfx('catch'); }
        else if (e.t === 'screen') sfx('squeak');
      }
      if (G.phase === 'freeze') { updMoves(); showRoutes(); }
      if (G.phase === 'over') onOver();
    }
    if (shotSeq) updShotSeq(dt);
    sbT -= rdt; if (sbT <= 0 && G.clock !== null) { sbT = 0.1; updSB(); }
  }
  if (G && V.home.length) {
    var frz = state === 'play' && G.phase === 'freeze' && !shotSeq && !meter;
    G.home.forEach(function (p, i) { if (G.phase !== 'action' && !shotSeq) { p.vx *= 0.8; p.vy *= 0.8; } animPlayer(V.home[i], p, dt, 'h', i, i === G.holder, frz); });
    G.away.forEach(function (p, i) { if (G.phase !== 'action') { p.vx *= 0.8; p.vy *= 0.8; } animPlayer(V.away[i], p, dt, 'a', i, false, frz); });
    updBall(dt);
    var hv = V.home[G.holder];
    holderRing.visible = state === 'play' && !shotSeq; holderRing.position.set(hv.px, 0.035, -hv.py); holderRing.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
    ball.rotation.x += dt * 6;
    ballShadow.position.set(ball.position.x, 0.02, ball.position.z); ballShadow.material.opacity = clamp(0.35 - ball.position.y * 0.06, 0.05, 0.35);
    $('freeze').classList.toggle('on', frz);
  }
  if (netK > 0.002) { netPose(netK, time); netK *= Math.pow(0.08, rdt); if (netK < 0.003) netPose(0, 0); }
  crowdU.time.value = time; crowdU.hype.value *= Math.pow(0.35, rdt);
  updConfetti(rdt);
  updCam(rdt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- eventi
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); var t = e.changedTouches[0]; pointerDown(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchmove', function (e) { e.preventDefault(); var t = e.changedTouches[0]; pointerMove(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchend', function (e) { e.preventDefault(); pointerUp(); }, { passive: false });
canvas.addEventListener('touchcancel', function (e) { e.preventDefault(); draw = null; clearPath(); }, { passive: false });
var md = false;
canvas.addEventListener('mousedown', function (e) { md = true; pointerDown(e.clientX, e.clientY); });
window.addEventListener('mousemove', function (e) { if (md) pointerMove(e.clientX, e.clientY); });
window.addEventListener('mouseup', function () { if (md) { md = false; pointerUp(); } });
$('meter').addEventListener('touchstart', function (e) { e.preventDefault(); if (meter) releaseMeter(); }, { passive: false });
$('meter').addEventListener('mousedown', function () { if (meter) releaseMeter(); });
window.addEventListener('keydown', function (e) { if (e.code === 'Space' && meter) { e.preventDefault(); releaseMeter(); } });
function tap(id, fn) { $(id).addEventListener('click', function (e) { e.preventDefault(); ensureAudio(); fn(e); }); }
tap('btnStart', showMap);
tap('btnBackMenu', function () { state = 'menu'; $('map').classList.add('hidden'); $('menu').classList.remove('hidden'); });
$('mapList').addEventListener('click', function (e) { var b = e.target.closest('.lvl'); if (b && !b.disabled) showIntro(+b.dataset.l); });
tap('btnGo', function () { startLevel(+$('intro').dataset.l); });
tap('btnIntroBack', showMap);
tap('btnChapGo', function () { showIntro(+$('chap').dataset.l); });
tap('btnRetry', function () { startLevel(cur.idx); });
tap('btnNext', function () { showIntro(cur.idx + 1); });
tap('btnMapR', showMap);
tap('btnRestart', function () { if (state === 'play') startLevel(cur.idx); });
tap('btnExit', showMap);
tap('btnSol', function () { if (state === 'play' && cur.solution) { var s = cur.solution.map(function (a) { return a.type === 'pass' ? 'passa al n.' + NUMS_H[a.to] : a.type === 'alley' ? 'alley-oop al n.' + NUMS_H[a.to] : a.type === 'dribble' ? 'palleggia' : 'tira'; }).join(' → '); $('tip').textContent = 'Un modo per farcela: ' + s; $('tip').classList.add('on'); } });
tap('btnMute', function () { save.mute = !save.mute; persist(); if (AU.master) AU.master.gain.value = save.mute ? 0 : 0.8; $('btnMute').textContent = save.mute ? 'Audio: no' : 'Audio: sì'; });
window.addEventListener('resize', function () { resize(); });

window.__debug = { getLevel: getLevel, get G() { return G; }, get state() { return state; }, get meter() { return meter; }, startLevel: startLevel, commit: commit, fire: fire, shotEval: function (a, ap) { var h = G.home[G.holder]; return shotEval(G, h.x, h.y, a, ap); }, get shotSeq() { return shotSeq; },
  scr: function () { var h = holderScr(), r = rimScr(), m = G.home.map(function (p) { return scr(p.x, p.y, 1); }); return { h: h, rim: r, m: m }; }, info: function () { return renderer.info.render; }, get V() { return V; }, closeup: function (i, team, ang) { var v = (team ? V.away : V.home)[i || 0]; var hp = new THREE.Vector3(); v.bones.Head.getWorldPosition(hp); var fa = v.facing + (ang || 0); camFix = { p: new THREE.Vector3(hp.x + Math.sin(fa) * 0.9, hp.y + 0.12, hp.z + Math.cos(fa) * 0.9), l: hp }; }, free: function () { camFix = null; } };
var camFix = null;

// ---------------------------------------------------------------- avvio: carica il modello dei giocatori
function b64ToBuf(b64) { var bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
function boot() {
  resize();
  $('btnMute').textContent = save.mute ? 'Audio: no' : 'Audio: sì';
  var loader = new THREE.GLTFLoader();
  loader.parse(b64ToBuf(window.__MODEL_B64), '', function (gltf) {
    prepTemplate(gltf);
    // scena del menu: il livello 10 sullo sfondo
    cur = getLevel(10); G = newState(cur); setChapter(chapterOf(10)); buildPlayers(); snapCam();
    state = 'menu'; $('loading').style.display = 'none'; $('menu').classList.remove('hidden');
    requestAnimationFrame(frame);
  }, function (err) { $('loading').textContent = 'Errore nel caricamento dei giocatori: ' + (err && err.message ? err.message : err); });
}
boot();
})();
