// ============================================================ GRAFICA: scena, luce, cielo, neve, montagne
var canvas = $('game'), renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  $('loading').textContent = 'Questo dispositivo non supporta il 3D (WebGL).';
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 7000);
var VW = 1, VH = 1;

// ------------------------------------------------------------ luce: tre momenti della giornata
var LIGHTS = {
  mattina: { az: 64, el: 47, sun: 0xfff2df, sunI: 3.1, top: 0x1f63c6, hor: 0xcfe1f3, haze: 0xd6e5f3, hemiS: 0xc4dbf7, hemiG: 0xf2f5fa, hemiI: 0.55, exp: 0.86, env: 0.75, snowfall: 0.15, cloud: 0.55 },
  pomeriggio: { az: 102, el: 31, sun: 0xffe2b8, sunI: 3.0, top: 0x2a5eb8, hor: 0xe6dccf, haze: 0xe2dbd2, hemiS: 0xbcd0f0, hemiG: 0xf4ede4, hemiI: 0.5, exp: 0.9, env: 0.7, snowfall: 0.1, cloud: 0.45 },
  tramonto: { az: 118, el: 11, sun: 0xffb27a, sunI: 2.6, top: 0x34509a, hor: 0xf3b59a, haze: 0xd9b7ae, hemiS: 0x9fb0dc, hemiG: 0xf0d7c8, hemiI: 0.55, exp: 0.98, env: 0.65, snowfall: 0.08, cloud: 0.6 },
  nuvoloso: { az: 30, el: 40, sun: 0xeef2f8, sunI: 0.9, top: 0x8ea3bb, hor: 0xd3dbe4, haze: 0xd0d8e2, hemiS: 0xd8e2ee, hemiG: 0xeef1f5, hemiI: 1.4, exp: 0.95, env: 0.9, snowfall: 1, cloud: 0.95 }
};
var LT = null;
var sunDir = new THREE.Vector3();
var sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
var SH = 26;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
var hemi = new THREE.HemisphereLight(0xbfd8ff, 0xffffff, 0.6);
scene.add(hemi);
scene.fog = new THREE.Fog(0xd6e5f3, 70, 560);

// ------------------------------------------------------------ cielo
var skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSunI: { value: 1 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: [
    'uniform vec3 uTop, uHor, uSunCol; uniform vec3 uSun; uniform float uSunI; varying vec3 vDir;',
    'void main(){',
    '  vec3 d = normalize(vDir); float h = d.y;',
    '  float t = pow(clamp(h, 0.0, 1.0), 0.42);',
    '  vec3 col = mix(uHor, uTop, t);',
    '  col = mix(col, uHor * 1.04, smoothstep(0.08, -0.02, h) * 0.6);',
    '  float s = max(dot(d, uSun), 0.0);',
    '  col += uSunCol * (pow(s, 2200.0) * 40.0 + pow(s, 260.0) * 1.2 + pow(s, 18.0) * 0.28 + pow(s, 3.0) * 0.1) * uSunI;',
    '  col += uSunCol * smoothstep(0.25, 0.0, abs(h)) * pow(s, 2.0) * 0.18 * uSunI;',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'].join('\n')
});
var sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

// ------------------------------------------------------------ texture procedurali
function canvasTex(w, h, draw, repeat) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d'); draw(g, w, h);
  var t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// mappa delle normali della neve: rumore a piu' scale, piccole increspature
function heightToNormal(hf, N, strength) {
  var c = document.createElement('canvas'); c.width = c.height = N;
  var g = c.getContext('2d'), img = g.createImageData(N, N);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var l = hf[y * N + (x - 1 + N) % N], r = hf[y * N + (x + 1) % N], u = hf[((y - 1 + N) % N) * N + x], d = hf[((y + 1) % N) * N + x];
    var nx = (l - r) * strength, ny = (u - d) * strength, nz = 1, il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz), k = (y * N + x) * 4;
    img.data[k] = (nx * il * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * il * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * il * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
function tileNoise(N, scale, oct, seed) {
  var hf = new Float32Array(N * N);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var a = 0, amp = 1, f = scale;
    for (var o = 0; o < oct; o++) {
      // rumore periodico: si campiona su un toro per avere una texture senza cuciture
      var ax = x / N * TAU, ay = y / N * TAU;
      a += amp * vnoise2(Math.cos(ax) * f + 11, Math.sin(ax) * f + Math.cos(ay) * f * 0.7, seed + o) * 0.5;
      a += amp * vnoise2(Math.sin(ay) * f + 5, Math.cos(ay) * f + Math.sin(ax) * f * 0.7, seed + 40 + o) * 0.5;
      amp *= 0.5; f *= 2.1;
    }
    hf[y * N + x] = a;
  }
  return hf;
}
var snowNormal = heightToNormal(tileNoise(256, 1.6, 5, 3), 256, 3.2);

// ------------------------------------------------------------ materiale neve (battitura, brillantini)
var snowUniforms = { uCordFade: { value: 1 }, uSparkle: { value: 1 } };
function makeSnowMat(opts) {
  var m = new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, vertexColors: true, roughness: 0.84, metalness: 0, normalMap: snowNormal, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.7 }, opts || {}));
  m.onBeforeCompile = function (sh) {
    sh.uniforms.uCordFade = snowUniforms.uCordFade; sh.uniforms.uSparkle = snowUniforms.uSparkle;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCord;\nvarying vec3 vCord;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCord = aCord;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCord;\nuniform float uCordFade, uSparkle;\nfloat hh12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }')
      .replace('#include <normal_fragment_maps>', [
        '#ifdef USE_NORMALMAP_TANGENTSPACE',
        '  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        '  vec3 mapB = texture2D( normalMap, vNormalMapUv * 0.17 + vec2(0.31, 0.77) ).xyz * 2.0 - 1.0;',
        '  float vd = length(vViewPosition);',
        '  mapN = normalize(vec3(mapN.xy * (1.0 - smoothstep(14.0, 70.0, vd) * 0.7) + mapB.xy * 0.9, 1.0));',
        '  float groom = vCord.z * uCordFade * (1.0 - smoothstep(18.0, 48.0, vd));',
        '  float cu = vCord.x * 9.0;',
        '  float seam = smoothstep(0.86, 1.0, abs(fract(vCord.x / 4.4 + 0.5) * 2.0 - 1.0));',
        '  float rid = cos(cu * 6.2832) * (1.0 - seam) + (hh12(floor(vec2(vCord.x * 9.0, vCord.y * 0.7))) - 0.5) * 0.3;',
        '  mapN = normalize(mapN + vec3(rid * 0.32 * groom, 0.0, 0.0));',
        '  mapN.xy *= normalScale;',
        '  normal = normalize( tbn * mapN );',
        '#endif'].join('\n'))
      .replace('#include <opaque_fragment>', [
        '#ifdef USE_NORMALMAP_TANGENTSPACE',
        '  {',
        '    vec2 sp = vNormalMapUv * 150.0; vec2 cell = floor(sp); vec2 fr = fract(sp) - 0.5;',
        '    vec3 V = normalize(vViewPosition);',
        '    float h1 = hh12(cell), tw = hh12(cell + floor(V.xz * 7.0 + V.y * 5.0));',
        '    float sk = step(0.9935, h1) * step(0.45, tw) * smoothstep(0.33, 0.0, length(fr));',
        '    float df = 1.0 - smoothstep(4.0, 34.0, length(vViewPosition));',
        '    outgoingLight += sk * df * uSparkle * (reflectedLight.directDiffuse + reflectedLight.directSpecular) * 7.0;',
        '  }',
        '#endif',
        '#include <opaque_fragment>'].join('\n'));
  };
  return m;
}
var snowMat = makeSnowMat();
var snowMatKick = makeSnowMat({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });

// ------------------------------------------------------------ terreno a blocchi
// Ogni blocco di 64 m ha una parte centrale fitta (pista e sponde, maglia 1 m) e due fianchi radi
// (maglia 4 m) che partono un po' sotto la parte centrale, cosi' non si vedono fessure tra le due.
var TC_IN = (function () { var a = []; for (var u = -42; u <= 42; u += (Math.abs(u) < 22 ? 1 : 2)) a.push(u); return a; })();
var TC_OUT = (function () { var a = []; for (var u = 39; u < 90; u += 6) a.push(u); for (u = 90; u <= 330; u += 20) a.push(u); return a; })();
var chunks = {};
var ROCK = new THREE.Color(0x6b6866), ROCKD = new THREE.Color(0x3f3d3e), SNOW = new THREE.Color(0xffffff), SNOWB = new THREE.Color(0xeef4fb);
function terrainGrid(d0, len, rowStep, us, inner, sink) {
  var rows = Math.round(len / rowStep) + 1, cols = us.length, n = rows * cols;
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), cord = new Float32Array(n * 3);
  var yRef = profY(d0), zRef = -d0, cc = new THREE.Color();
  // altezze su una griglia allargata di una riga e una colonna per lato (per le normali)
  var R2 = rows + 2, C2 = cols + 2, hs = new Float64Array(R2 * C2), ds = new Float64Array(R2), uu = new Float64Array(C2);
  for (var r = 0; r < R2; r++) ds[r] = d0 + (r - 1) * rowStep;
  for (var c = 0; c < C2; c++) uu[c] = c === 0 ? us[0] - (us[1] - us[0]) : c === C2 - 1 ? us[cols - 1] + (us[cols - 1] - us[cols - 2]) : us[c - 1];
  for (r = 0; r < R2; r++) { var py = profY(ds[r]); for (c = 0; c < C2; c++) hs[r * C2 + c] = py + crossH(uu[c], ds[r]); }
  var base = ((d0 % 1024) + 1024) % 1024;
  for (r = 0; r < rows; r++) {
    var d = ds[r + 1], c0 = cx(d), hw = halfW(d);
    for (c = 0; c < cols; c++) {
      var u = us[c], i = r * cols + c, h = hs[(r + 1) * C2 + c + 1];
      var hl = hs[(r + 1) * C2 + c], hr = hs[(r + 1) * C2 + c + 2], hu = hs[r * C2 + c + 1], hd = hs[(r + 2) * C2 + c + 1];
      var dx = uu[c + 2] - uu[c], nx = -(hr - hl) / dx, nz = (hd - hu) / (2 * rowStep), il = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      nx *= il; var ny = il; nz *= il;
      var au = Math.abs(u), drop = sink && au < 44 ? 0.35 : 0;
      pos[i * 3] = c0 + u; pos[i * 3 + 1] = h - yRef - drop; pos[i * 3 + 2] = -d - zRef;
      nor[i * 3] = nx; nor[i * 3 + 1] = ny; nor[i * 3 + 2] = nz;
      var steep = clamp((0.78 - ny) / 0.22, 0, 1), rn = 0.5 + 0.5 * vnoise2((c0 + u) * 0.08, d * 0.08, 5);
      var rock = au > hw + 20 ? clamp(steep * 1.4 - 0.2 + (rn - 0.5) * 0.9, 0, 1) : 0;
      cc.copy(SNOW).lerp(SNOWB, au > hw + 3 ? 0.6 : 0.15);
      if (rock > 0) cc.lerp(rn > 0.5 ? ROCK : ROCKD, rock * 0.92);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
      uv[i * 2] = (c0 + u) / 3.2; uv[i * 2 + 1] = (base + r * rowStep) / 3.2;
      cord[i * 3] = u; cord[i * 3 + 1] = d % 512; cord[i * 3 + 2] = inner ? clamp((hw - 0.6 - au) / 1.2, 0, 1) : 0;
    }
  }
  var idx = new Uint32Array((rows - 1) * (cols - 1) * 6), q = 0;
  for (r = 0; r < rows - 1; r++) for (c = 0; c < cols - 1; c++) {
    var a = r * cols + c, b = a + 1, c2 = a + cols, d2 = c2 + 1;
    idx[q++] = a; idx[q++] = c2; idx[q++] = b; idx[q++] = b; idx[q++] = c2; idx[q++] = d2;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aCord', new THREE.BufferAttribute(cord, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  var mesh = new THREE.Mesh(geo, snowMat);
  mesh.position.set(0, yRef, zRef);
  mesh.receiveShadow = true;
  return mesh;
}
function buildChunk(k) {
  var d0 = k * CHUNK, ms = [];
  ms.push(terrainGrid(d0, CHUNK, 1, TC_IN, true, false));
  ms.push(terrainGrid(d0, CHUNK, 4, TC_OUT.map(function (u) { return -u; }).reverse(), false, true));
  ms.push(terrainGrid(d0, CHUNK, 4, TC_OUT, false, true));
  ms.forEach(function (m) { scene.add(m); });
  var sc = buildScenery(k);
  chunks[k] = { ms: ms, sc: sc, low: false };
}
function dropChunk(k) {
  var c = chunks[k]; if (!c) return;
  c.ms.forEach(function (m) { scene.remove(m); m.geometry.dispose(); });
  c.sc.forEach(function (o) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); });
  delete chunks[k];
}

// ------------------------------------------------------------ alberi e rocce (instanziati)
function mergeGeos(list) { // [ [geometry, color], ... ] -> geometria unica con colori per vertice
  var pos = [], nor = [], col = [], c = new THREE.Color();
  list.forEach(function (it) {
    var g = it[0].index ? it[0].toNonIndexed() : it[0]; g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal;
    for (var i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      var cl = typeof it[1] === 'function' ? it[1](p.getX(i), p.getY(i), p.getZ(i), n.getY(i)) : it[1];
      c.set(cl); col.push(c.r, c.g, c.b);
    }
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
function pineGeo(v) {
  var R = rng(91 + v * 7), parts = [], layers = 5 + v, H = 7 + v * 1.4;
  var trunk = new THREE.CylinderGeometry(0.12, 0.2, H * 0.35, 6); trunk.translate(0, H * 0.17, 0); parts.push([trunk, 0x4a3426]);
  for (var i = 0; i < layers; i++) {
    var t = i / layers, rad = (1 - t * 0.82) * (1.7 + v * 0.15), y = H * (0.16 + t * 0.74), hgt = H * 0.3 * (1 - t * 0.35);
    var cone = new THREE.ConeGeometry(rad, hgt, 8, 1, true); cone.rotateY(R() * PI); cone.translate(0, y + hgt * 0.5, 0);
    var green = new THREE.Color().setHSL(0.36 + R() * 0.04, 0.32, 0.13 + R() * 0.04);
    parts.push([cone, function (x, yy, z, ny) { return ny > 0.55 && yy > y + hgt * 0.3 ? 0xf3f7fc : green.getHex(); }]);
    var cap = new THREE.ConeGeometry(rad * 0.86, hgt * 0.42, 8, 1, true); cap.rotateY(R() * PI); cap.translate(0, y + hgt * 0.78, 0);
    parts.push([cap, 0xf4f8fd]);
  }
  return mergeGeos(parts);
}
function rockGeo(v) {
  var g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, R = rng(300 + v);
  var seen = {};
  for (var i = 0; i < p.count; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = (x * 100 | 0) + ',' + (y * 100 | 0) + ',' + (z * 100 | 0);
    var k = seen[key] || (seen[key] = 0.75 + R() * 0.5);
    p.setXYZ(i, x * k * 1.2, Math.max(y * k * 0.8, -0.3), z * k);
  }
  return mergeGeos([[g, function (x, y, z, ny) { return ny > 0.62 ? 0xf2f6fb : y < -0.1 ? 0x45403d : 0x5e5853; }]]);
}
function pineLow(v) {
  var H = 7 + v * 1.4, parts = [];
  parts.push([new THREE.CylinderGeometry(0.15, 0.2, H * 0.3, 4).translate(0, H * 0.15, 0), 0x4a3426]);
  parts.push([new THREE.ConeGeometry(1.75 + v * 0.15, H * 0.9, 6, 1, true).translate(0, H * 0.58, 0), function (x, y, z, ny) { return y > H * 0.75 ? 0xe9eff6 : 0x1f3a2c; }]);
  return mergeGeos(parts);
}
var TREE_GEOS = [pineGeo(0), pineGeo(1), pineGeo(2)], TREE_LOW = [pineLow(0), pineLow(1), pineLow(2)], ROCK_GEOS = [rockGeo(0), rockGeo(1), rockGeo(2)];
var vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.6 });
var rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, envMapIntensity: 0.6 });
var _mx = new THREE.Matrix4(), _qx = new THREE.Quaternion(), _sx = new THREE.Vector3(), _px = new THREE.Vector3(), _ex = new THREE.Euler();
function buildScenery(k) {
  var out = [], B = blockData(k);
  [0, 1, 2].forEach(function (v) {
    var list = B.trees.filter(function (t) { return t.v === v; });
    if (!list.length) return;
    var im = new THREE.InstancedMesh(TREE_GEOS[v], vegMat, list.length); im.userData.tree = v;
    list.forEach(function (t, i) {
      _qx.setFromEuler(_ex.set((hash1(i * 13 + k) - 0.5) * 0.06, t.r, (hash1(i * 7 + k) - 0.5) * 0.06));
      _mx.compose(_px.set(t.x, t.y - 0.3, t.z), _qx, _sx.set(t.s, t.s * (0.9 + hash1(i + k * 3) * 0.3), t.s));
      im.setMatrixAt(i, _mx);
    });
    im.castShadow = true; im.receiveShadow = false;
    im.computeBoundingSphere();
    scene.add(im); out.push(im);
  });
  [0, 1, 2].forEach(function (v) {
    var list = B.rocks.filter(function (r, i) { return i % 3 === v; });
    if (!list.length) return;
    var im = new THREE.InstancedMesh(ROCK_GEOS[v], rockMat, list.length);
    list.forEach(function (r, i) {
      _qx.setFromEuler(_ex.set(0, r.r, (r.t - PI) * 0.05));
      _mx.compose(_px.set(r.x, r.y - r.s * 0.25, r.z), _qx, _sx.set(r.s, r.s, r.s));
      im.setMatrixAt(i, _mx);
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im); out.push(im);
  });
  // paletti di segnalazione ai bordi della pista
  var poles = [];
  for (var d = k * CHUNK; d < (k + 1) * CHUNK; d += 8) [-1, 1].forEach(function (s) { poles.push([cx(d) + s * (halfW(d) + 1.6), d, s]); });
  var pg = new THREE.InstancedMesh(POLE_GEO, poleMat, poles.length);
  poles.forEach(function (p, i) {
    var y = profY(p[1]) + crossH(p[0] - cx(p[1]), p[1]);
    _mx.compose(_px.set(p[0], y - 0.2, -p[1]), _qx.identity(), _sx.set(1, 1, 1)); pg.setMatrixAt(i, _mx);
  });
  pg.castShadow = true; pg.computeBoundingSphere(); scene.add(pg); out.push(pg);
  return out;
}
var POLE_GEO = mergeGeos([
  [new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6).translate(0, 0.95, 0), function (x, y) { return (Math.floor(y / 0.32) % 2) ? 0x111111 : 0xff6a1a; }]
]);
var poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

// ------------------------------------------------------------ montagne lontane (anello attorno alla camera)
var mountains = null;
function buildMountains() {
  if (mountains) { scene.remove(mountains); mountains.geometry.dispose(); }
  var AS = 240, RS = 30, pos = [], col = [], idx = [], haze = new THREE.Color(LT.haze), lit = new THREE.Color(), tmp = new THREE.Color();
  var sunV = sunDir.clone();
  var Hf = function (x, z, r) {
    var ridge = ridge2(x / 1300 + 7, z / 1300 + 3, 21, 6), big = fbm2(x / 3200, z / 3200, 9, 3);
    var amp = 260 + 1100 * sm01((r - 900) / 2200);
    // verso valle (z negativo) la valle si apre: montagne piu' basse e lontane
    var ahead = sm01((-z / r - 0.35) / 0.6);
    amp *= 1 - 0.45 * ahead;
    return -320 - 180 * ahead + (ridge * 1.05 + big * 0.55 + 0.25) * amp;
  };
  for (var j = 0; j <= RS; j++) {
    var t = j / RS, r = 900 + Math.pow(t, 1.35) * 3400;
    for (var i = 0; i <= AS; i++) {
      var a = i / AS * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r, y = Hf(x, z, r);
      pos.push(x, y, z);
      var e = 6, hx = Hf(x + e, z, r) - Hf(x - e, z, r), hz = Hf(x, z + e, r) - Hf(x, z - e, r);
      var nx = -hx, ny = 2 * e, nz = -hz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= nl; ny /= nl; nz /= nl;
      var snowy = clamp((ny - 0.42) / 0.2, 0, 1) * clamp((y + 160) / 140, 0, 1);
      var forest = clamp((-y - 150) / 80, 0, 1) * clamp((ny - 0.6) / 0.2, 0, 1);
      tmp.set(0x5d5a5c).lerp(new THREE.Color(0xf3f6fb), snowy).lerp(new THREE.Color(0x1d2a25), forest * 0.8);
      var l = Math.max(0, nx * sunV.x + ny * sunV.y + nz * sunV.z);
      lit.copy(tmp).multiplyScalar(0.36 + 0.95 * l * (LT.sunI / 3));
      lit.r *= 0.92; lit.b *= 1.08;
      var f = 1 - Math.exp(-r / 1700), hf = clamp((-y + 60) / 600, 0, 1);
      lit.lerp(haze, clamp(0.26 + f * 0.62 + hf * 0.25, 0, 0.95));
      col.push(lit.r, lit.g, lit.b);
    }
  }
  for (j = 0; j < RS; j++) for (i = 0; i < AS; i++) {
    var p0 = j * (AS + 1) + i, p1 = p0 + 1, p2 = p0 + AS + 1, p3 = p2 + 1;
    idx.push(p0, p1, p2, p1, p3, p2);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  mountains = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  mountains.frustumCulled = false; mountains.renderOrder = -5;
  scene.add(mountains);
}

// ------------------------------------------------------------ nuvole
var cloudTex = canvasTex(512, 512, function (g, w, h) {
  var img = g.createImageData(w, h);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var ax = x / w * TAU, ay = y / h * TAU, v = 0, amp = 0.55, f = 1.2;
    for (var o = 0; o < 5; o++) { v += amp * vnoise2(Math.cos(ax) * f + Math.sin(ay) * f * 0.5 + 3, Math.sin(ax) * f + Math.cos(ay) * f + 9, 50 + o); amp *= 0.5; f *= 2.05; }
    var a = clamp((v + 0.05) * 2.4, 0, 1), k = (y * w + x) * 4;
    img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = a * a * 255;
  }
  g.putImageData(img, 0, 0);
}, true);
var cloudMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false,
  uniforms: { map: { value: cloudTex }, uOff: { value: new THREE.Vector2() }, uCol: { value: new THREE.Color(0xffffff) }, uShade: { value: new THREE.Color(0xc6d2e2) }, uAmt: { value: 0.6 } },
  vertexShader: 'varying vec2 vUv; varying float vR; void main(){ vUv = uv; vR = length(position.xy) / 6000.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D map; uniform vec2 uOff; uniform vec3 uCol, uShade; uniform float uAmt; varying vec2 vUv; varying float vR;\n' +
    'void main(){ vec4 t = texture2D(map, vUv * 3.0 + uOff); vec4 t2 = texture2D(map, vUv * 7.0 - uOff * 1.7 + 0.37);\n' +
    ' float a = clamp(t.a * 1.3 - (1.0 - uAmt) * 0.9 + t2.a * 0.25, 0.0, 1.0) * smoothstep(1.0, 0.45, vR);\n' +
    ' vec3 c = mix(uCol, uShade, t2.a * 0.6); gl_FragColor = vec4(c, a * 0.85);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}'
});
var clouds = new THREE.Mesh(new THREE.CircleGeometry(6000, 48), cloudMat);
clouds.rotation.x = PI / 2; clouds.frustumCulled = false; clouds.renderOrder = -8;
scene.add(clouds);

// ------------------------------------------------------------ cambio di luce
var envRT = null;
function applyLight(name) {
  LT = LIGHTS[name] || LIGHTS.mattina;
  var az = LT.az * DEG, el = LT.el * DEG;
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  sun.color.set(LT.sun); sun.intensity = LT.sunI;
  hemi.color.set(LT.hemiS); hemi.groundColor.set(LT.hemiG); hemi.intensity = LT.hemiI;
  scene.fog.color.set(LT.haze);
  skyMat.uniforms.uTop.value.set(LT.top); skyMat.uniforms.uHor.value.set(LT.hor); skyMat.uniforms.uSun.value.copy(sunDir);
  skyMat.uniforms.uSunCol.value.set(LT.sun); skyMat.uniforms.uSunI.value = name === 'nuvoloso' ? 0.15 : 1;
  cloudMat.uniforms.uAmt.value = LT.cloud;
  cloudMat.uniforms.uShade.value.set(name === 'tramonto' ? 0xd99a8c : name === 'nuvoloso' ? 0xa9b4c2 : 0xc6d2e2);
  cloudMat.uniforms.uCol.value.set(name === 'tramonto' ? 0xffd6b8 : 0xffffff);
  renderer.toneMappingExposure = LT.exp;
  snowUniforms.uSparkle.value = name === 'nuvoloso' ? 0.15 : 1;
  sun.castShadow = name !== 'nuvoloso';
  buildMountains();
  // riflessi: mappa d'ambiente calcolata dal cielo
  var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  var sk = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); es.add(sk);
  var gnd = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(LT.hemiG).multiplyScalar(0.92) }));
  gnd.rotation.x = -PI / 2; gnd.position.y = -3; es.add(gnd);
  if (envRT) envRT.dispose();
  envRT = pm.fromScene(es, 0.02);
  scene.environment = envRT.texture;
  pm.dispose(); sk.geometry.dispose(); gnd.geometry.dispose();
  [snowMat, snowMatKick].forEach(function (m) { m.envMapIntensity = LT.env; });
}

// ------------------------------------------------------------ qualita' (risoluzione adattiva)
var quality = { pr: 1, auto: true, level: 2, shadow: 2048, ms: [] };
function setQuality(level) {
  quality.level = level;
  var dpr = window.devicePixelRatio || 1;
  quality.pr = level === 2 ? Math.min(dpr, 2) : level === 1 ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
  renderer.setPixelRatio(quality.pr);
  var sz = level === 0 ? 1024 : 2048;
  if (sz !== quality.shadow) {
    quality.shadow = sz; sun.shadow.mapSize.set(sz, sz);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  resize();
}
function resize() {
  VW = window.innerWidth; VH = window.innerHeight;
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
