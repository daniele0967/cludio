// ============================================================ RIDER: modello con scheletro, vestiti, tavola, pose procedurali, ragdoll
// Il modello (mesh e scheletro) viene dal file rider.bin, estratto da Xbot (esempi di Three.js, origine Mixamo).
var RIDER = null;
var OUTFITS = [
  { name: 'Lago', jacket: 0x1d8f8c, accent: 0xff7a2b, pants: 0x1c2333, glove: 0x15171b, helmet: 0xf2f4f6, lens: 0xff8a1e, buff: 0x40464f, boot: 0x24201d },
  { name: 'Vulcano', jacket: 0xc7323b, accent: 0xf4f4f4, pants: 0x121417, glove: 0x16181c, helmet: 0x17191d, lens: 0x2aa6ff, buff: 0x1d2026, boot: 0x2b2522 },
  { name: 'Senape', jacket: 0xe0a526, accent: 0x2a2f36, pants: 0x3c4a35, glove: 0x2a2f36, helmet: 0x4d6b47, lens: 0xc76bff, buff: 0xb98a2f, boot: 0x3a2d22 },
  { name: 'Ghiaccio', jacket: 0xeef2f6, accent: 0x6c5ce7, pants: 0x6c5ce7, glove: 0xeef2f6, helmet: 0x6c5ce7, lens: 0x2de0c2, buff: 0xd8dde4, boot: 0xeef2f6 },
  { name: 'Notte', jacket: 0x22283a, accent: 0x3ee6a0, pants: 0x2d3446, glove: 0x0f1115, helmet: 0x3ee6a0, lens: 0xffd23c, buff: 0x22283a, boot: 0x0f1115 }
];
var BOARDS = [
  { name: 'Aurora', base: '#ff5a36', top: ['#0d1b2e', '#21b8ff', '#ff5a36'] },
  { name: 'Pino', base: '#1a9b58', top: ['#f4efe4', '#1a9b58', '#0d1b2e'] },
  { name: 'Lampo', base: '#ffd23c', top: ['#111111', '#ffd23c', '#ffffff'] },
  { name: 'Viola', base: '#6c5ce7', top: ['#f2f4f6', '#6c5ce7', '#ff4f8b'] }
];

function b64ToBuf(b64) { var bin = atob(b64), n = bin.length, u8 = new Uint8Array(n); for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; }

function buildRider(buf) {
  var dv = new DataView(buf), hl = dv.getUint32(0, true);
  var head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl;
  var bones = head.bones.map(function (b) { var bone = new THREE.Bone(); bone.name = b.name; bone.position.fromArray(b.t); bone.quaternion.fromArray(b.r); return bone; });
  var rootI = 0;
  head.bones.forEach(function (b, i) { if (b.parent >= 0) bones[b.parent].add(bones[i]); else rootI = i; });
  var ibm = new Float32Array(buf, base + head.ibm, bones.length * 16);
  var inverses = bones.map(function (b, i) { return new THREE.Matrix4().fromArray(ibm, i * 16); });
  var group = new THREE.Group();
  group.add(bones[rootI]);
  group.updateMatrixWorld(true);
  var skeleton = new THREE.Skeleton(bones, inverses);
  var B = {}; bones.forEach(function (b) { B[b.name] = b; });
  var meshes = head.meshes.map(function (m) {
    var q = new Int16Array(buf, base + m.pos, m.count * 3), pos = new Float32Array(m.count * 3);
    for (var i = 0; i < m.count; i++) for (var k = 0; k < 3; k++) pos[i * 3 + k] = (q[i * 3 + k] + 32768) / 65535 * (m.max[k] - m.min[k]) + m.min[k];
    var nq = new Int8Array(buf, base + m.nor, m.count * 4), nor = new Float32Array(m.count * 3);
    for (i = 0; i < m.count; i++) for (k = 0; k < 3; k++) nor[i * 3 + k] = nq[i * 4 + k] / 127;
    var jo = new Uint8Array(buf, base + m.joi, m.count * 4), we = new Uint8Array(buf, base + m.wei, m.count * 4);
    var idx = new Uint16Array(buf, base + m.idx, m.index);
    return { name: m.name, pos: pos, nor: nor, jo: new Uint8Array(jo), we: new Uint8Array(we), idx: new Uint16Array(idx), count: m.count };
  });
  return { group: group, bones: bones, B: B, skeleton: skeleton, meshes: meshes, rootBone: bones[rootI], names: head.bones.map(function (b) { return b.name; }) };
}

// regione di ogni vertice: dall'osso con piu' peso e dall'altezza nella posa di riposo
var REG = { HEAD: 0, NECK: 1, JACKET: 2, ACCENT: 3, GLOVE: 4, PANTS: 5, BOOT: 6 };
function regionOf(name, y, x) {
  if (/Hand|Thumb|Index|Middle|Ring|Pinky/.test(name)) return REG.GLOVE;
  if (/Head|Eye/.test(name)) return y < 1.6 ? REG.NECK : REG.HEAD;
  if (name === 'Neck') return REG.NECK;
  if (/Foot|Toe/.test(name)) return REG.BOOT;
  if (/Leg/.test(name) && !/UpLeg/.test(name)) return y < 0.2 ? REG.BOOT : REG.PANTS;
  if (/ForeArm/.test(name)) return Math.abs(x) > 0.66 ? REG.ACCENT : REG.JACKET;
  if (/Arm|Shoulder/.test(name)) return REG.JACKET;
  if (y > 0.9) return y > 1.36 && /Spine2|Shoulder/.test(name) ? REG.ACCENT : REG.JACKET;
  return REG.PANTS;
}
function riderMaterials(of) {
  return {
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 }),
    helmet: new THREE.MeshStandardMaterial({ color: of.helmet, roughness: 0.32, metalness: 0.05, envMapIntensity: 1 }),
    lens: new THREE.MeshStandardMaterial({ color: of.lens, roughness: 0.08, metalness: 1, envMapIntensity: 1.6, emissive: new THREE.Color(of.lens).multiplyScalar(0.18) }),
    frame: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5 }),
    strap: new THREE.MeshStandardMaterial({ color: of.accent, roughness: 0.6 }),
    binding: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.45, metalness: 0.2 })
  };
}

var rig = null; // { root, B, mats, board, ... }
var _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
var _q1 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion(), _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

function makeRig(buf) {
  var R = buildRider(buf), of = OUTFITS[save.set.outfit % OUTFITS.length], mats = riderMaterials(of);
  var group = R.group, B = R.B;
  // posa di riposo: orientamenti e posizioni nel mondo
  var bind = {};
  R.bones.forEach(function (b) {
    var q = new THREE.Quaternion(), p = new THREE.Vector3(); b.getWorldQuaternion(q); b.getWorldPosition(p);
    bind[b.name] = { q: q, p: p, local: b.quaternion.clone(), lpos: b.position.clone() };
  });
  var geos = R.meshes.map(function (m) {
    var cols = new Float32Array(m.count * 3), pos = m.pos, c = new THREE.Color();
    var pal = [of.helmet, of.buff, of.jacket, of.accent, of.glove, of.pants, of.boot];
    var infl = [0.004, 0.012, 0.024, 0.024, 0.01, 0.03, 0.02];
    for (var i = 0; i < m.count; i++) {
      var best = 0, bi = 0;
      for (var k = 0; k < 4; k++) if (m.we[i * 4 + k] > best) { best = m.we[i * 4 + k]; bi = m.jo[i * 4 + k]; }
      var reg = regionOf(R.names[bi], pos[i * 3 + 1], pos[i * 3]);
      c.set(pal[reg]);
      if (reg === REG.HEAD) c.set(0xd9a383);
      // pieghe del tessuto: un filo di variazione di colore
      var nz = 0.94 + 0.06 * vnoise2(pos[i * 3] * 40, pos[i * 3 + 1] * 40, 3);
      cols[i * 3] = c.r * nz; cols[i * 3 + 1] = c.g * nz; cols[i * 3 + 2] = c.b * nz;
      var f = infl[reg] * (m.name === 'joints' ? 1.1 : 1);
      if (reg === REG.PANTS) f += 0.012 * sm01((0.62 - Math.abs(pos[i * 3 + 1] - 0.55)) / 0.4);
      pos[i * 3] += m.nor[i * 3] * f; pos[i * 3 + 1] += m.nor[i * 3 + 1] * f; pos[i * 3 + 2] += m.nor[i * 3 + 2] * f;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(m.jo, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(m.we, 4, true));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    return g;
  });
  var meshes = geos.map(function (g) {
    var sm = new THREE.SkinnedMesh(g, mats.cloth);
    sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    group.add(sm);
    sm.bind(R.skeleton, new THREE.Matrix4());
    return sm;
  });
  // accessori attaccati alle ossa, posizionati nella posa di riposo (personaggio rivolto verso +Z)
  function attach(boneName, obj, worldPos, worldQ) {
    var bn = B[boneName], bq = bind[boneName].q, bp = bind[boneName].p;
    var inv = bq.clone().invert();
    obj.position.copy(worldPos).sub(bp).applyQuaternion(inv);
    obj.quaternion.copy(inv).multiply(worldQ || new THREE.Quaternion());
    bn.add(obj);
    obj.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    return obj;
  }
  var hp = bind.Head.p, ht = bind.HeadTop_End.p;
  var hc = hp.clone().lerp(ht, 0.5);
  var helmet = new THREE.Group();
  var shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, TAU, 0, PI * 0.58), mats.helmet);
  shell.scale.set(0.118, 0.124, 0.132); helmet.add(shell);
  var brim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 28, PI * 1.25), mats.helmet);
  brim.scale.set(0.116, 0.124, 0.13); brim.rotation.set(PI / 2, 0, PI * 1.125); brim.position.y = -0.01; helmet.add(brim);
  var vent = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.09), mats.frame);
  [-0.03, 0, 0.03].forEach(function (x) { var v = vent.clone(); v.position.set(x, 0.121, -0.005); helmet.add(v); });
  attach('Head', helmet, hc.clone().add(new THREE.Vector3(0, 0.03, -0.012)));
  // maschera
  var goggle = new THREE.Group();
  var fr = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.062, 28, 1, true, -1.05, 2.1), mats.frame); goggle.add(fr);
  var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1245, 0.1245, 0.05, 28, 1, true, -0.98, 1.96), mats.lens); goggle.add(lens);
  var strap = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.035, 28, 1, true, 1.05, TAU - 2.1), mats.strap); goggle.add(strap);
  goggle.scale.set(1, 1, 1.12);
  attach('Head', goggle, hc.clone().add(new THREE.Vector3(0, -0.012, 0.006)));
  // tavola e attacchi
  var board = makeBoard(BOARDS[save.set.board % BOARDS.length], mats);
  scene.add(board);
  scene.add(group);
  // misure dello scheletro
  var len = function (a, b) { return bind[a].p.distanceTo(bind[b].p); };
  var L = {
    thigh: len('LeftUpLeg', 'LeftLeg'), shin: len('LeftLeg', 'LeftFoot'), upper: len('LeftArm', 'LeftForeArm'), fore: len('LeftForeArm', 'LeftHand'),
    hipW: len('LeftUpLeg', 'RightUpLeg'), hipsY: bind.Hips.p.y, ankleY: bind.LeftFoot.p.y, footFwd: bind.LeftToeBase.p.z - bind.LeftFoot.p.z
  };
  var fingers = R.bones.filter(function (b) { return /Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(b.name); });
  rig = { R: R, B: B, bind: bind, group: group, meshes: meshes, mats: mats, board: board, L: L, fingers: fingers, of: of, rag: null, wob: 0, t: 0, grabW: 0, gi: -1, look: new THREE.Vector3(0, 0, -1) };
  return rig;
}
function setOutfit(i, bi) {
  if (!rig) return;
  var buf = rig.buf; disposeRig(); makeRig(buf).buf = buf;
}
function disposeRig() {
  if (!rig) return;
  scene.remove(rig.group); scene.remove(rig.board);
  rig.meshes.forEach(function (m) { m.geometry.dispose(); });
  rig.board.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  rig = null;
}

// tavola: griglia con sciancratura e punte rialzate, grafica disegnata
function makeBoard(bd, mats) {
  var g = new THREE.Group(), NL = 64, NW = 8, Lh = 0.78, Wb = 0.135, T = 0.013;
  var top = [], bot = [], uvT = [], uvB = [], sideP = [];
  function shape(t) { // t in [-1,1] lungo la tavola: mezza larghezza e altezza (punte rialzate)
    var a = Math.abs(t), w = Wb * (1 - 0.1 * Math.cos(t * PI / 2 * 0.92));
    if (a > 0.86) { var k = (a - 0.86) / 0.14; w *= Math.sqrt(Math.max(0, 1 - k * k)) * 0.82 + 0.18 * (1 - k); }
    var y = a > 0.78 ? Math.pow((a - 0.78) / 0.22, 2) * 0.065 : 0;
    return [w, y];
  }
  var pos = [], uv = [], idx = [];
  function grid(sideTop) {
    var off = pos.length / 3;
    for (var i = 0; i <= NL; i++) {
      var t = -1 + 2 * i / NL, s = shape(t);
      for (var j = 0; j <= NW; j++) {
        var v = -1 + 2 * j / NW;
        pos.push(t * Lh, s[1] + (sideTop ? T : 0), v * s[0]);
        uv.push(i / NL, j / NW);
      }
    }
    for (i = 0; i < NL; i++) for (j = 0; j < NW; j++) {
      var a = off + i * (NW + 1) + j, b = a + 1, c = a + NW + 1, d = c + 1;
      if (sideTop) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  grid(true);
  var topGeo = new THREE.BufferGeometry(); topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); topGeo.setIndex(idx); topGeo.computeVertexNormals();
  pos = []; uv = []; idx = []; grid(false);
  var botGeo = new THREE.BufferGeometry(); botGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); botGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); botGeo.setIndex(idx); botGeo.computeVertexNormals();
  // bordo
  pos = []; idx = [];
  var ring = [];
  for (var i = 0; i <= NL; i++) { var t = -1 + 2 * i / NL, s = shape(t); ring.push([t * Lh, s[1], s[0]]); }
  for (i = NL; i >= 0; i--) { t = -1 + 2 * i / NL; s = shape(t); ring.push([t * Lh, s[1], -s[0]]); }
  ring.forEach(function (p) { pos.push(p[0], p[1], p[2], p[0], p[1] + T, p[2]); });
  for (i = 0; i < ring.length - 1; i++) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  var edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); edgeGeo.setIndex(idx); edgeGeo.computeVertexNormals();
  var topTex = canvasTex(512, 96, function (c, w, h) {
    var gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, bd.top[0]); gr.addColorStop(0.5, bd.top[1]); gr.addColorStop(1, bd.top[0]);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = bd.top[2]; for (var x = 0; x < w; x += 46) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 23, 0); c.lineTo(x + 31, 0); c.lineTo(x + 8, h); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(w * 0.36, 0, w * 0.28, h);
    c.fillStyle = '#fff'; c.font = 'italic 900 40px "Avenir Next Condensed", "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('POWDER', w * 0.5, h * 0.5);
  });
  topTex.colorSpace = THREE.SRGBColorSpace;
  var botTex = canvasTex(512, 96, function (c, w, h) {
    c.fillStyle = bd.base; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = 'italic 900 64px "Avenir Next Condensed", "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('RUN', w * 0.5, h * 0.52);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
  });
  botTex.colorSpace = THREE.SRGBColorSpace;
  var mTop = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.05 });
  var mBot = new THREE.MeshStandardMaterial({ map: botTex, roughness: 0.25, metalness: 0.1 });
  var mEdge = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.3, metalness: 0.85 });
  var inner = new THREE.Group();
  [[topGeo, mTop], [botGeo, mBot], [edgeGeo, mEdge]].forEach(function (p) { var m = new THREE.Mesh(p[0], p[1]); m.castShadow = true; m.receiveShadow = true; inner.add(m); });
  // attacchi: piastra, schienale (highback) e cinghie
  var ss = stanceSign();
  [[0.255, 15], [-0.255, -9]].forEach(function (b) {
    var bg = new THREE.Group();
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.25), mats.binding); plate.position.y = T + 0.011; bg.add(plate);
    var hb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.2, 12, 1, true, PI * 0.5 - 1.2, 2.4), mats.binding);
    hb.position.set(0, T + 0.12, -0.09 * ss); hb.rotation.y = ss > 0 ? PI : 0; hb.rotation.x = -0.18 * ss; bg.add(hb);
    var st = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.05), mats.strap);
    st.position.set(0, T + 0.1, 0.02 * ss); bg.add(st);
    var st2 = st.clone(); st2.position.set(0, T + 0.06, 0.1 * ss); bg.add(st2);
    bg.position.x = b[0]; bg.rotation.y = -b[1] * DEG * ss;
    bg.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    inner.add(bg);
  });
  g.add(inner); g.userData.inner = inner;
  return g;
}

// ------------------------------------------------------------ strumenti per le pose
// mette un osso con un certo orientamento nel mondo
function setWorldQ(bone, qw) {
  bone.parent.getWorldQuaternion(_q1);
  bone.quaternion.copy(_q1.invert().multiply(qw));
  bone.updateMatrixWorld(true);
}
// rotazione che porta il sistema del corpo a riposo (avanti +Z, su +Y) a quello dato
var _bm = new THREE.Matrix4(), _bm0 = new THREE.Matrix4();
function bodyQ(F, U, out) {
  _v1.copy(U).normalize(); _v2.copy(F).addScaledVector(_v1, -F.dot(_v1)).normalize(); _v3.crossVectors(_v1, _v2); // _v3 = sinistra (+X a riposo)
  _bm.makeBasis(_v3, _v1, _v2);
  return out.setFromRotationMatrix(_bm);
}
// orienta un osso: asse verso il figlio = dir; il "fronte" dell'osso (a riposo +Z del mondo) verso pole
function aimBone(boneName, dir, pole, restPole) {
  var bn = rig.B[boneName], bd = rig.bind[boneName], child = bn.children.find(function (c) { return c.isBone; });
  var cd = rig.bind[child.name];
  // a riposo: asse e fronte nel mondo
  var a0 = _v1.copy(cd.p).sub(bd.p).normalize(), f0 = _v2.copy(restPole || ZF).addScaledVector(a0, -(restPole || ZF).dot(a0)).normalize();
  var s0 = _v3.crossVectors(a0, f0);
  _bm0.makeBasis(a0, f0, s0);
  var a1 = _v4.copy(dir).normalize(), f1 = _v5.copy(pole).addScaledVector(a1, -pole.dot(a1));
  if (f1.lengthSq() < 1e-6) f1.set(0, 0, 1).addScaledVector(a1, -a1.z);
  f1.normalize();
  var s1 = _vS.crossVectors(a1, f1);
  _bm.makeBasis(a1, f1, s1);
  _bm.multiply(_bm0.transpose());
  _q3.setFromRotationMatrix(_bm).multiply(bd.q);
  setWorldQ(bn, _q3);
}
var _vS = new THREE.Vector3(), ZF = new THREE.Vector3(0, 0, 1), ZB = new THREE.Vector3(0, 0, -1);
// IK a due ossa: dove va il ginocchio / gomito
function ik2(root, target, l1, l2, pole, out) {
  var d = _v4.copy(target).sub(root), c = clamp(d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  d.normalize();
  var x = (l1 * l1 - l2 * l2 + c * c) / (2 * c), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  var p = _v5.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
  out.copy(root).addScaledVector(d, x).addScaledVector(p, h);
  return c;
}
var _knee = new THREE.Vector3(), _hip = new THREE.Vector3(), _end = new THREE.Vector3(), _tmp = new THREE.Vector3(), _pole = new THREE.Vector3();
function solveLimb(upper, lower, endBone, target, l1, l2, pole, restPole) {
  rig.B[upper].getWorldPosition(_hip);
  var c = ik2(_hip, target, l1, l2, pole, _knee);
  var kneeDir = _tmp.copy(_knee).sub(_hip);
  var pl = _pole.copy(pole);
  aimBone(upper, kneeDir, pl, restPole);
  rig.B[lower].getWorldPosition(_hip);
  aimBone(lower, _end.copy(target).sub(_hip), pl, restPole);
}
function setFootQ(bone, F, U) {
  var bd = rig.bind[bone];
  bodyQ(F, U, _q4);
  _q4.multiply(bd.q);
  setWorldQ(rig.B[bone], _q4);
}
function curlFingers(amount, side) {
  rig.fingers.forEach(function (b) {
    var bd = rig.bind[b.name], left = /^Left/.test(b.name), thumb = /Thumb/.test(b.name);
    if (side && ((side === 'L') !== left)) return;
    var ang = amount * (thumb ? 0.5 : 1.15) * (left ? -1 : 1);
    _q1.setFromAxisAngle(thumb ? _v1.set(1, 0, 0) : ZF, ang);
    _q3.copy(bd.q).invert().multiply(_q1).multiply(bd.q);
    b.quaternion.copy(bd.local).multiply(_q3);
  });
}

// ------------------------------------------------------------ pose del rider (ogni fotogramma)
var PS = { crouch: 0.3, lean: 0, open: 0.3, twist: 0.35, bend: 0.2, side: 0, xOff: 0, grab: 0, gi: -1, fh: new THREE.Vector3(), rh: new THREE.Vector3(), look: new THREE.Vector3(0, 0, -1), roll: 0, tw: new THREE.Quaternion(), press: 0, init: false, comp: 0, compV: 0 };
var _bq = new THREE.Quaternion(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _c = new THREE.Vector3(), _U = new THREE.Vector3(), _F = new THREE.Vector3();
var _hipP = new THREE.Vector3(), _tg = new THREE.Vector3(), _tg2 = new THREE.Vector3(), _pl = new THREE.Vector3(), _sh = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
var _bpos = new THREE.Vector3();
var BOARD_T = 0.013;

// punti della tavola (in coordinate della tavola) dove vanno le mani nei grab
function grabPoint(g, front, out) {
  var ss = stanceSign();
  switch (g.at) {
    case 'nose': return out.set(0.62, 0.03, 0);
    case 'tail': return out.set(-0.62, 0.03, 0);
    case 'toe': return out.set(front ? 0.08 : -0.08, 0.02, 0.13 * ss);
    default: return out.set(front ? 0.1 : -0.1, 0.02, -0.13 * ss);
  }
}

function poseRider(dt, mode) {
  if (!rig) return;
  var B = rig.B, L = rig.L, ss = stanceSign();
  if (mode === 'crash' && rig.rag) { poseRagdoll(dt); return; }
  var air = P.mode === 'air', rail = P.mode === 'rail', A = P.air;
  // ---- orientamento della tavola (con inclinazione sullo spigolo in curva e tweak dei grab)
  var k = PS.init ? damp(air ? 40 : 22, dt) : 1;
  PS.roll = lerp(PS.roll, P.mode === 'ground' ? clamp(-P.lean * 0.55, -0.55, 0.55) * (P.sw ? -1 : 1) : 0, damp(10, dt));
  var gi = air && A && A.grab >= 0 ? A.grab : -1;
  var gw = gi >= 0 ? Math.min(1, A.grabT / 0.18) : 0;
  PS.grab = lerp(PS.grab, gw, damp(gi >= 0 ? 16 : 10, dt));
  if (gi >= 0) PS.gi = gi;
  var G0 = PS.gi >= 0 ? GRABS[PS.gi] : null, tweak = G0 && A ? clamp((A.grabT - 0.25) / 0.6, 0, 1) * PS.grab : 0;
  _qa.copy(P.q);
  _qb.setFromAxisAngle(AX, PS.roll); _qa.multiply(_qb);
  if (G0 && PS.grab > 0.01) {
    var tw = G0.tweak === 'method' ? [0.15 * ss, 0, -0.55] : G0.tweak === 'japan' ? [0, 0, 0.45] : G0.at === 'nose' ? [0, 0.25, 0] : G0.at === 'tail' ? [0, -0.25, 0] : G0.at === 'toe' ? [0, 0, -0.3] : [0, 0, 0.3];
    _qb.setFromEuler(_ex.set(tw[2] * ss * tweak, 0, tw[1] * PS.grab + tw[0] * tweak)); _qa.multiply(_qb);
  }
  var press = P.butter ? P.butter.press : 0;
  PS.press = lerp(PS.press, press, damp(10, dt));
  if (Math.abs(PS.press) > 0.01) { _qb.setFromAxisAngle(AZ, -PS.press * 0.2); _qa.multiply(_qb); }
  if (!PS.init) _bq.copy(_qa); else _bq.slerp(_qa, k);
  rig.board.quaternion.copy(_bq);
  _bpos.set(P.x, P.y, P.z);
  if (Math.abs(PS.press) > 0.01) { _v1.set(PS.press > 0 ? 0.7 : -0.7, 0, 0).applyQuaternion(_bq); _v2.set(PS.press > 0 ? 0.7 : -0.7, 0, 0).applyQuaternion(P.q); _bpos.add(_v2).sub(_v1); }
  if (rail && P.rail) { _bpos.y += P.rail.offY * 0; }
  rig.board.position.copy(_bpos);
  rig.board.updateMatrixWorld(true);
  _bx.set(1, 0, 0).applyQuaternion(_bq); _by.set(0, 1, 0).applyQuaternion(_bq); _bz.set(0, 0, 1).applyQuaternion(_bq);
  // il corpo segue la tavola, ma senza i tweak (il corpo "tira" la tavola)
  _v1.set(1, 0, 0).applyQuaternion(P.q); _v2.set(0, 1, 0).applyQuaternion(P.q);
  _c.set(0, 0, 1).applyQuaternion(P.q).multiplyScalar(ss);  // petto: lato delle punte dei piedi
  // ---- parametri della posa
  var sp = speedOf(), crouch = P.crouch, lean = P.mode === 'ground' ? P.lean : 0;
  if (air && PS.grab > 0.05) crouch = Math.max(crouch, 0.55 + 0.45 * PS.grab);
  if (rail) crouch = 0.45;
  if (P.landT < 0.3 && P.mode === 'ground') crouch = Math.max(crouch, (1 - P.landT / 0.3) * (P.quality === 'sketchy' ? 1 : 0.75));
  PS.crouch = lerp(PS.crouch, crouch, damp(12, dt));
  PS.lean = lerp(PS.lean, clamp(lean, -0.9, 0.9), damp(9, dt));
  var spinW = air && A ? A.ws : 0;
  var twist = 0.38 - (P.charge > 0 ? P.prewind * 0.9 * P.charge : 0) + clamp(-spinW * 0.07, -0.6, 0.6) * (ss);
  if (P.mode === 'ground' && P.brake) twist += 0.3;
  PS.twist = lerp(PS.twist, twist, damp(8, dt));
  PS.xOff = lerp(PS.xOff, press * 0.13 + (rail && P.rail ? P.rail.press * 0.1 : 0), damp(8, dt));
  // ---- bacino
  // atterraggio: le gambe assorbono come una molla
  PS.compV += (-70 * PS.comp - 11 * PS.compV) * dt; PS.comp = clamp(PS.comp + PS.compV * dt, -0.32, 0.08);
  var hipH = lerp(0.93, 0.58, PS.crouch) + PS.comp;
  // nei grab le ginocchia salgono al petto: il bacino scende verso la tavola
  if (G0 && PS.grab > 0.01) {
    hipH = lerp(hipH, G0.at === 'heel' ? 0.47 : G0.at === 'toe' ? 0.43 : 0.5, PS.grab);
    PS.xOff = lerp(PS.xOff, (G0.at === 'nose' ? 0.14 : G0.at === 'tail' ? -0.14 : 0) * PS.grab, damp(10, dt));
  }
  _v3.set(P.hx, 0, P.hz).normalize();
  _U.copy(_v2).applyAxisAngle(_v3, -PS.lean * 0.9).normalize();
  if (P.wobble > 0) { P.wobble = Math.max(0, P.wobble - dt * 1.6); _U.applyAxisAngle(_v1, Math.sin(rig.t * 22) * 0.12 * P.wobble); }
  _hipP.set(P.x, P.y, P.z).addScaledVector(_by, BOARD_T).addScaledVector(_U, hipH).addScaledVector(_v1, PS.xOff).addScaledVector(_c, -0.04 - PS.crouch * 0.06);
  // in aria con grab il bacino si avvicina alla tavola: le ginocchia salgono
  _F.copy(_c).applyAxisAngle(_U, 0.3 * ss);
  bodyQ(_F, _U, _qc); _qc.multiply(rig.bind.Hips.q);
  B.Hips.position.copy(_hipP);
  B.Hips.quaternion.copy(_qc);
  B.Hips.updateMatrixWorld(true);
  // ---- busto: torsione verso la punta, piegato in avanti quando si accuccia
  var bend = 0.12 + 0.5 * PS.crouch + (air && PS.grab > 0 && G0 ? (G0.at === 'heel' ? 0.05 : 0.35) * PS.grab : 0);
  var side = (G0 && PS.grab > 0.05 ? (G0.at === 'nose' ? 0.45 : G0.at === 'tail' ? -0.45 : 0) * PS.grab : 0);
  ['Spine', 'Spine1', 'Spine2'].forEach(function (n, i) {
    var f = (i + 1) / 3;
    _F.copy(_c).applyAxisAngle(_U, (0.3 + PS.twist * f) * ss);
    _v3.crossVectors(_U, _F).normalize(); // sinistra del busto
    _v4.copy(_U).applyAxisAngle(_v3, bend * f * 0.9).applyAxisAngle(_F, side * f * ss);
    _v5.copy(_F).applyAxisAngle(_v3, bend * f * 0.9);
    bodyQ(_v5, _v4, _qc); _qc.multiply(rig.bind[n].q);
    setWorldQ(B[n], _qc);
  });
  // ---- testa: guarda dove si va (in aria verso il punto d'atterraggio)
  _tg.set(P.vx, 0, P.vz);
  if (_tg.lengthSq() < 0.01) _tg.copy(_v1);
  _tg.normalize();
  if (air && A && A.landX !== undefined) { _tg2.set(A.landX - P.x, (A.landY - P.y) * 0.6, A.landZ - P.z).normalize(); _tg.lerp(_tg2, 0.5).normalize(); }
  PS.look.lerp(_tg, damp(6, dt)).normalize();
  B.Spine2.getWorldQuaternion(_qa);
  _v3.set(0, 1, 0).applyQuaternion(_qa); _v4.set(0, 0, 1).applyQuaternion(_qa);
  // limite: la testa non gira oltre ~85 gradi rispetto al petto
  _v5.copy(PS.look).addScaledVector(_v3, -PS.look.dot(_v3)).normalize();
  var ang = Math.acos(clamp(_v5.dot(_v4), -1, 1));
  if (ang > 1.45) { var ax2 = _tmp.crossVectors(_v4, _v5).normalize(); _v5.copy(_v4).applyAxisAngle(ax2, 1.45); }
  bodyQ(_v5, _v3, _qc); _qb.copy(_qc).multiply(rig.bind.Head.q);
  _qa.multiply(rig.bind.Spine2.q.clone().invert()); _qa.multiply(rig.bind.Neck.q);
  _qa.slerp(_qb, 0.45); setWorldQ(B.Neck, _qa);
  setWorldQ(B.Head, _qb);
  // ---- gambe: caviglie sugli attacchi, ginocchia verso le punte dei piedi
  var front = ss > 0 ? 'Left' : 'Right', back = ss > 0 ? 'Right' : 'Left';
  [[front, 0.255, 15], [back, -0.255, -9]].forEach(function (lg) {
    var x = lg[1], tgt = _tg.copy(_bpos).addScaledVector(_bx, x).addScaledVector(_by, BOARD_T + 0.085);
    _pl.copy(_c).addScaledVector(_bx, x > 0 ? 0.25 : 0.45).addScaledVector(_by, 0.25);
    if (air && PS.grab > 0.05) _pl.addScaledVector(_by, 0.6 * PS.grab);
    solveLimb(lg[0] + 'UpLeg', lg[0] + 'Leg', lg[0] + 'Foot', tgt, L.thigh, L.shin, _pl, ZF);
    _F.copy(_bz).multiplyScalar(ss).applyAxisAngle(_by, lg[2] * DEG * ss * (x > 0 ? 1 : 1));
    setFootQ(lg[0] + 'Foot', _F, _by);
    setFootQ(lg[0] + 'ToeBase', _F, _by);
  });
  // ---- braccia
  var t = rig.t;
  B[front + 'Arm'].getWorldPosition(_sh);
  armPose(front, true, G0, gi, air, rail, t, dt);
  armPose(back, false, G0, gi, air, rail, t, dt);
  curlFingers(0.35);
  if (G0 && PS.grab > 0.2) curlFingers(1.25 * PS.grab, (G0.hand === 'front') === (front === 'Left') ? 'L' : 'R');
  PS.init = true;
}
var _hand = { L: new THREE.Vector3(), R: new THREE.Vector3() }, _handInit = false;
function armPose(side, isFront, G0, gi, air, rail, t, dt) {
  var B = rig.B, L = rig.L, ss = stanceSign(), S = side[0];
  B[side + 'Arm'].getWorldPosition(_sh);
  var dirX = isFront ? 1 : -1, tgt = _tg2;
  // braccia in equilibrio: avanti verso la punta e dietro verso la coda
  var sp = speedOf();
  var lift = air ? 0.15 : rail ? 0.25 : 0.02 + Math.abs(PS.lean) * 0.25;
  tgt.copy(_sh).addScaledVector(_bx, dirX * (isFront ? 0.42 : 0.3)).addScaledVector(_c, isFront ? 0.22 : 0.12).addScaledVector(_U, -0.42 + lift);
  if (air && P.air && Math.abs(P.air.ws) > 3) tgt.copy(_sh).addScaledVector(_c, 0.32).addScaledVector(_U, -0.3).addScaledVector(_bx, dirX * 0.08);
  if (P.mode === 'ground' && !P.butter && P.brake) tgt.addScaledVector(_U, 0.15);
  // la mano che fa il grab va sul punto della tavola
  if (G0 && PS.grab > 0.02 && ((G0.hand === 'front') === isFront)) {
    var gp = grabPoint(G0, isFront, _v3).applyQuaternion(rig.board.quaternion).add(rig.board.position);
    tgt.lerp(gp, PS.grab);
  } else if (G0 && PS.grab > 0.02) {
    // l'altra mano si apre per lo stile
    tgt.lerp(_v4.copy(_sh).addScaledVector(_U, 0.25).addScaledVector(_bx, dirX * 0.45).addScaledVector(_c, -0.1), PS.grab);
  }
  var h = _hand[S];
  if (!_handInit || !PS.init) h.copy(tgt); else h.lerp(tgt, damp(G0 && PS.grab > 0.5 ? 30 : 12, dt));
  _pl.copy(_U).multiplyScalar(-0.6).addScaledVector(_c, -0.6).addScaledVector(_bx, -dirX * 0.2);
  solveLimb(side + 'Arm', side + 'ForeArm', side + 'Hand', h, L.upper, L.fore, _pl, ZB);
  if (S === 'R') _handInit = true;
}

// ------------------------------------------------------------ ragdoll (caduta)
var RAG_J = ['Hips', 'Spine2', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
var RAG_LINKS = [['Hips', 'Spine2'], ['Spine2', 'Head'], ['Spine2', 'LeftArm'], ['Spine2', 'RightArm'], ['LeftArm', 'RightArm'], ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'],
  ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'], ['Hips', 'LeftUpLeg'], ['Hips', 'RightUpLeg'], ['LeftUpLeg', 'RightUpLeg'], ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'],
  ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'], ['LeftFoot', 'RightFoot'], ['LeftUpLeg', 'Spine2'], ['RightUpLeg', 'Spine2'], ['Head', 'LeftArm'], ['Head', 'RightArm'], ['Hips', 'LeftLeg'], ['Hips', 'RightLeg']];
function startRagdoll(vx, vy, vz) {
  var p = {}, q = {}, rnd = function () { return (Math.random() - 0.5); };
  RAG_J.forEach(function (n) { var v = new THREE.Vector3(); rig.B[n].getWorldPosition(v); p[n] = v; });
  var spin = new THREE.Vector3(rnd() * 5, rnd() * 3, rnd() * 5), c = p.Hips.clone();
  RAG_J.forEach(function (n) {
    var r = p[n].clone().sub(c), w = new THREE.Vector3().crossVectors(spin, r);
    q[n] = p[n].clone().sub(new THREE.Vector3(vx * 0.85 + w.x, vy * 0.6 + w.y + 1.2, vz * 0.85 + w.z).multiplyScalar(1 / 120));
  });
  var links = RAG_LINKS.map(function (l) { return [l[0], l[1], p[l[0]].distanceTo(p[l[1]])]; });
  rig.rag = { p: p, q: q, links: links, t: 0 };
}
function stepRagdoll(dt) {
  var R = rig.rag, n = Math.max(1, Math.round(dt * 120)), h = 1 / 120;
  for (var s = 0; s < n; s++) {
    R.t += h;
    RAG_J.forEach(function (j) {
      var p = R.p[j], q = R.q[j], vx = (p.x - q.x) * 0.995, vy = (p.y - q.y) * 0.995, vz = (p.z - q.z) * 0.995;
      q.copy(p); p.x += vx; p.y += vy - G * h * h; p.z += vz;
    });
    for (var it = 0; it < 6; it++) {
      R.links.forEach(function (l) {
        var a = R.p[l[0]], b = R.p[l[1]], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = (d - l[2]) / d * 0.5;
        a.x += dx * f; a.y += dy * f; a.z += dz * f; b.x -= dx * f; b.y -= dy * f; b.z -= dz * f;
      });
      RAG_J.forEach(function (j) {
        var p = R.p[j], q = R.q[j], gh = groundH(p.x, p.z) + (j === 'Head' ? 0.12 : 0.07);
        if (p.y < gh) {
          p.y = gh;
          var fr = 0.18; q.x = lerp(q.x, p.x, fr); q.z = lerp(q.z, p.z, fr); if (q.y < p.y) q.y = p.y + (p.y - q.y) * 0.25;
        }
      });
    }
  }
}
function poseRagdoll(dt) {
  stepRagdoll(dt);
  var R = rig.rag, p = R.p, B = rig.B;
  // bacino
  _v1.copy(p.Spine2).sub(p.Hips).normalize();               // su
  _v2.copy(p.LeftUpLeg).sub(p.RightUpLeg).normalize();      // sinistra
  _v3.crossVectors(_v2, _v1).normalize();                    // avanti
  bodyQ(_v3, _v1, _qc); _qc.multiply(rig.bind.Hips.q);
  B.Hips.position.copy(p.Hips); B.Hips.quaternion.copy(_qc); B.Hips.updateMatrixWorld(true);
  _v4.copy(p.LeftArm).sub(p.RightArm).normalize();
  _v5.crossVectors(_v4, _v1).normalize();
  ['Spine', 'Spine1', 'Spine2'].forEach(function (n, i) {
    var f = (i + 1) / 3; _tg.copy(_v3).lerp(_v5, f).normalize();
    bodyQ(_tg, _v1, _qc); _qc.multiply(rig.bind[n].q); setWorldQ(B[n], _qc);
  });
  _tg.copy(p.Head).sub(p.Spine2).normalize();
  bodyQ(_v5, _tg, _qc); _qb.copy(_qc).multiply(rig.bind.Head.q); _qa.copy(_qc).multiply(rig.bind.Neck.q);
  setWorldQ(B.Neck, _qa); setWorldQ(B.Head, _qb);
  [['Left', 'UpLeg', 'Leg', 'Foot', ZF], ['Right', 'UpLeg', 'Leg', 'Foot', ZF], ['Left', 'Arm', 'ForeArm', 'Hand', ZB], ['Right', 'Arm', 'ForeArm', 'Hand', ZB]].forEach(function (c) {
    var a = p[c[0] + c[1]], m = p[c[0] + c[2]], e = p[c[0] + c[3]];
    _tg.copy(a).lerp(e, 0.5); _pl.copy(m).sub(_tg);
    if (_pl.lengthSq() < 1e-6) _pl.copy(_v3);
    aimBone(c[0] + c[1], _tg2.copy(m).sub(a), _pl, c[4]);
    aimBone(c[0] + c[2], _tg2.copy(e).sub(m), _pl, c[4]);
  });
  // la tavola resta attaccata ai piedi
  var fr = stanceSign() > 0 ? p.LeftFoot : p.RightFoot, bk = stanceSign() > 0 ? p.RightFoot : p.LeftFoot;
  _bx.copy(fr).sub(bk).normalize();
  _v1.copy(p.LeftLeg).add(p.RightLeg).multiplyScalar(0.5).sub(_tg.copy(fr).add(bk).multiplyScalar(0.5));
  _by.copy(_v1).addScaledVector(_bx, -_v1.dot(_bx)).normalize();
  _bz.crossVectors(_bx, _by);
  _m1.makeBasis(_bx, _by, _bz); rig.board.quaternion.setFromRotationMatrix(_m1);
  rig.board.position.copy(fr).add(bk).multiplyScalar(0.5).addScaledVector(_by, -0.09);
  setFootQ('LeftFoot', _bz.clone().multiplyScalar(stanceSign()), _by); setFootQ('RightFoot', _bz.clone().multiplyScalar(stanceSign()), _by);
  curlFingers(0.2);
}
// posa in piedi per il menu
function poseIdle(dt) { P.crouch = 0.15; poseRider(dt, 'idle'); }
