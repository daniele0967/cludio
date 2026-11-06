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
  // flessione: la tavola si piega come una tavola vera (carico sul tail per l'ollie, press, atterraggi)
  var flexGeos = [topGeo, botGeo, edgeGeo].map(function (geo) { return { geo: geo, base: geo.attributes.position.array.slice() }; });
  g.userData.flex = function (bow, tip) {
    // bow > 0: centro giu' e punte su (atterraggio, press); tip: piega in piu' sulla punta (+) o sulla coda (-)
    flexGeos.forEach(function (f) {
      var pa = f.geo.attributes.position.array, b = f.base;
      for (var i = 0; i < pa.length; i += 3) {
        var x = b[i] / Lh;
        pa[i + 1] = b[i + 1] + bow * 0.07 * x * x + (tip > 0 ? Math.max(0, x) : Math.max(0, -x)) * Math.abs(tip) * 0.12 * Math.abs(x);
      }
      f.geo.attributes.position.needsUpdate = true;
    });
    if (Math.abs(bow) > 0.02 || Math.abs(tip) > 0.02) { flexGeos.forEach(function (f) { f.geo.computeVertexNormals(); }); }
  };
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


// ============================================================ POSE (riscritte da zero)
// Tutto e' descritto nel sistema del CORPO del rider: x verso la punta della tavola, y in su,
// z verso il petto (lato delle punte dei piedi, vale per regular e goofy). Le pose sono numeri in
// questo sistema; le transizioni si fanno sui numeri, non sulle posizioni nel mondo: cosi' quando il
// rider gira, braccia e tavola girano con lui senza restare indietro.
//
// Grab (dalle guide di snowboard):
//  hip   posizione del bacino [x, y, z]          bend/side/twist/arch busto
//  bpos  spostamento della tavola [x, y, z]      brot  [toeUp (lamina punte su), noseUp, shifty (+ frontside)]
//  pt    punto della tavola per la mano [x, lato +1 punte / -1 talloni, y]
//  free  mano libera rispetto al bacino [x, y, z]   elbow gomito della mano che afferra [x, y, z]
// Principio delle guide: non si scende verso la tavola, si porta la tavola su piegando le ginocchia;
// bacino alto, schiena il piu' possibile dritta. hip[1] = altezza del bacino sopra la tavola a riposo.
var GPOSE = {
  nose:    { hand: 'front', pt: [0.66,  0,  0.02], hip: [0.07,  0.67,  -0.04], bend: 0.52, side: 0.13, twist: -0.13, arch: 0, bpos: [-0.07,  0.28,  0.15], brot: [0,  0.61,  0], free: [-0.55,  0.42,  -0.05], elbow: [0.25,  0.5,  0.35] },
  tail:    { hand: 'rear', pt: [-0.66,  0,  0.02], hip: [-0.06,  0.7,  -0.02], bend: 0.45, side: -0.03, twist: -0.05, arch: 0, bpos: [0.06,  0.22,  0.06], brot: [0,  -0.7,  0.2], free: [0.55,  0.42,  0], elbow: [-0.25,  0.5,  0.35] },
  indy:    { hand: 'rear', knee: 1.22, pt: [-0.05,  1,  0], hip: [0,  0.68,  -0.04], bend: 0.75, side: 0.2, twist: 0.3, arch: 0, bpos: [-0.06,  0.3,  0.1], brot: [0.35,  -0.1,  -0.01], free: [0.42,  0.62,  0.12], elbow: [-0.38,  -0.18,  0.47] },
  mute:    { hand: 'front', knee: 1.24, pt: [0.04,  1,  0], hip: [-0.08,  0.68,  -0.04], bend: 0.54, side: -0.84, twist: -0.93, arch: 0, bpos: [0.01,  0.25,  0.06], brot: [0.63,  0.14,  0.52], free: [-0.47,  0.53,  -0.05], elbow: [0.45,  -0.25,  0.45] },
  stale:   { hand: 'rear', knee: 0.4, pt: [-0.12,  -1,  0], hip: [0.01,  0.67,  0.02], bend: 0.03, side: 0.86, twist: 0.09, arch: 0, bpos: [-0.09,  0.31,  -0.01], brot: [-0.27,  -0.33,  0.3], free: [0.44,  0.61,  0.18], elbow: [-0.53,  0.03,  -0.69] },
  melon:   { hand: 'front', knee: 0.36, pt: [0.1,  -1,  0], hip: [-0.06,  0.68,  0.04], bend: 0.19, side: -0.82, twist: 0.2, arch: 0, bpos: [0,  0.33,  -0.18], brot: [-0.73,  -0.02,  -0.35], free: [-0.42,  0.58,  0], elbow: [0.5,  -0.02,  -0.5] },
  method:  { hand: 'front', kneeDown: 1, pt: [0.08, -1, 0], hip: [0, 0.76, 0.1], bend: 0.05, side: 0.05, twist: 0.35, arch: 0.45, bpos: [0, 0.6, -0.42], brot: [-1.15, 0.12, -0.25], free: [-0.25, 0.85, 0.1], elbow: [0.35, 0.1, -0.7] },
  japan:   { hand: 'front', kneeDown: 2, knee: 0.6, pt: [0.1, 1, 0], hip: [0, 0.72, 0.06], bend: 0.45, side: 0.25, twist: 0.45, arch: 0.15, bpos: [0.0, 0.4, -0.2], brot: [0.7, -0.7, 0.25], free: [-0.15, 0.85, 0.05], elbow: [0.5, 0.2, 0.6] }
};
function gpose(g) { return GPOSE[g.id] || GPOSE.indy; }
// punto della tavola (coordinate locali della tavola) dove va la mano
function grabPoint(g, front, out) {
  var ss = stanceSign(), pp = gpose(g).pt;
  return out.set(pp[0], pp[2], pp[1] * 0.135 * ss);
}

// pose di base (senza grab): bacino, busto, mani [x, y, z] rispetto al bacino
var BASE = {
  ride:  { hip: [0.0, 0.9, -0.04], bend: 0.18, hF: [0.46, -0.06, 0.22], hR: [-0.42, -0.1, 0.14] },
  crouch:{ hip: [0.0, 0.6, -0.08], bend: 0.7, hF: [0.42, 0.0, 0.3], hR: [-0.38, -0.04, 0.2] },
  air:   { hip: [0.0, 0.76, -0.02], bend: 0.3, hF: [0.46, 0.12, 0.18], hR: [-0.44, 0.08, 0.08] },
  tuck:  { hip: [0.0, 0.5, 0.0], bend: 0.9, hF: [0.16, 0.0, 0.38], hR: [-0.16, -0.02, 0.36] },
  spin:  { hip: [0.0, 0.66, 0.0], bend: 0.45, hF: [0.12, 0.3, 0.26], hR: [-0.12, 0.28, 0.24] },
  open:  { hip: [0.0, 0.8, -0.02], bend: 0.2, hF: [0.56, 0.2, 0.08], hR: [-0.56, 0.16, 0.04] },
  rail:  { hip: [0.0, 0.74, -0.04], bend: 0.35, hF: [0.5, 0.22, 0.12], hR: [-0.5, 0.18, 0.04] }
};
function V(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
var PS = {
  init: false, grab: 0, gi: -1, look: new THREE.Vector3(0, 0, -1), roll: 0, press: 0, comp: 0, compV: 0, lvy: 0, steerS: 0, tuck: 0, open: 0, spin: 0, lean: 0, twist: 0.1,
  hip: V(BASE.ride.hip), bend: 0.2, side: 0, arch: 0, gtw: 0, bpos: new THREE.Vector3(), brot: new THREE.Vector3(), hF: V(BASE.ride.hF), hR: V(BASE.ride.hR),
  free: new THREE.Vector3(), elbow: new THREE.Vector3(), reach: new THREE.Vector3(), crouch: 0.3
};
var _bq = new THREE.Quaternion(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _c = new THREE.Vector3(), _U = new THREE.Vector3(), _F = new THREE.Vector3();
var _hipP = new THREE.Vector3(), _tg = new THREE.Vector3(), _tg2 = new THREE.Vector3(), _pl = new THREE.Vector3(), _sh = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
var _bpos = new THREE.Vector3(), _qB = new THREE.Quaternion(), _org = new THREE.Vector3(), _rX = new THREE.Vector3(), _rY = new THREE.Vector3(), _rZ = new THREE.Vector3();
var _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _hw = new THREE.Vector3(), _eu = new THREE.Euler();
var BOARD_T = 0.013;
// dal sistema del corpo al mondo
function L2W(x, y, z, out) { return out.copy(_org).addScaledVector(_rX, x).addScaledVector(_rY, y).addScaledVector(_rZ, z); }
function D2W(x, y, z, out) { return out.set(0, 0, 0).addScaledVector(_rX, x).addScaledVector(_rY, y).addScaledVector(_rZ, z); }
function lerpV(v, a, k) { v.x += (a[0] - v.x) * k; v.y += (a[1] - v.y) * k; v.z += (a[2] - v.z) * k; }
function mixA(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function poseRider(dt, mode) {
  if (!rig) return;
  var B = rig.B, L = rig.L, ss = stanceSign();
  if (mode === 'crash' && rig.rag) { poseRagdoll(dt); return; }
  var air = P.mode === 'air', rail = P.mode === 'rail', ground = P.mode === 'ground', A = P.air;
  var first = !PS.init;
  // ---- stato
  var gi = air && A && A.grab >= 0 ? A.grab : -1;
  PS.grab = lerp(PS.grab, gi >= 0 ? 1 : 0, first ? 1 : damp(gi >= 0 ? 11 : 9, dt));
  if (gi >= 0) PS.gi = gi;
  if (PS.grab < 0.01) PS.gi = -1;
  var G0 = PS.gi >= 0 ? GRABS[PS.gi] : null, GP = G0 ? gpose(G0) : null;
  var tweak = G0 && A && gi >= 0 ? clamp((A.grabT - 0.2) / 0.5, 0, 1) : 0, gk = PS.grab * (0.7 + 0.3 * tweak);
  var spinW = air && A ? A.ws : 0, flipW = air && A ? A.wf : 0;
  PS.tuck = lerp(PS.tuck, air ? clamp(Math.abs(flipW) / 4.5, 0, 1) : 0, damp(7, dt));
  PS.spin = lerp(PS.spin, air ? clamp((Math.abs(spinW) - 2) / 5, 0, 1) : 0, damp(7, dt));
  PS.open = lerp(PS.open, air && A && A.tLand < 0.38 && gi < 0 ? 1 - A.tLand / 0.38 : 0, damp(10, dt));
  PS.steerS = lerp(PS.steerS, ground ? (P.steer || 0) : 0, damp(6, dt));
  PS.lean = lerp(PS.lean, ground ? clamp(P.lean, -0.9, 0.9) : 0, damp(8, dt));
  var press = P.butter ? P.butter.press : rail && P.rail ? P.rail.press : 0;
  PS.press = lerp(PS.press, press, damp(10, dt));
  // ---- sistema del corpo: la tavola senza tweak, inclinata nelle curve
  _qB.copy(P.q);
  _qb.setFromAxisAngle(AX, -PS.lean * 0.75 * (P.sw ? -1 : 1)); _qB.multiply(_qb);
  _org.set(P.x, P.y, P.z);
  _rX.set(1, 0, 0).applyQuaternion(_qB); _rY.set(0, 1, 0).applyQuaternion(_qB); _rZ.set(0, 0, ss).applyQuaternion(_qB);
  // ---- posa bersaglio (numeri nel sistema del corpo)
  var crouchT = P.crouch;
  if (P.landT < 0.3 && ground) crouchT = Math.max(crouchT, (1 - P.landT / 0.3) * (P.quality === 'sketchy' ? 1 : 0.7));
  PS.crouch = lerp(PS.crouch, crouchT, damp(ground ? 8 : 10, dt));
  var base = air ? BASE.air : rail ? BASE.rail : BASE.ride;
  var hip = mixA(base.hip, BASE.crouch.hip, ground ? PS.crouch : 0), bend = lerp(base.bend, BASE.crouch.bend, ground ? PS.crouch : 0);
  var hF = mixA(base.hF, BASE.crouch.hF, ground ? PS.crouch : 0), hR = mixA(base.hR, BASE.crouch.hR, ground ? PS.crouch : 0);
  if (ground) { // in curva: braccio interno piu' basso, esterno piu' alto
    var st = PS.steerS * (P.sw ? -1 : 1) * ss;
    hF[1] += 0.12 * st; hR[1] -= 0.12 * st;
    if (P.brake) { hF[1] += 0.12; hR[1] += 0.08; }
  }
  if (air) {
    var wT = PS.tuck, wS = PS.spin * (1 - wT), wO = PS.open;
    hip = mixA(mixA(mixA(hip, BASE.spin.hip, wS), BASE.tuck.hip, wT), BASE.open.hip, wO);
    bend = lerp(lerp(lerp(bend, BASE.spin.bend, wS), BASE.tuck.bend, wT), BASE.open.bend, wO);
    hF = mixA(mixA(mixA(hF, BASE.spin.hF, wS), BASE.tuck.hF, wT), BASE.open.hF, wO);
    hR = mixA(mixA(mixA(hR, BASE.spin.hR, wS), BASE.tuck.hR, wT), BASE.open.hR, wO);
  }
  var side = 0, gtw = 0, arch = 0, bpos = [0, 0, 0], brot = [0, 0, 0];
  if (GP) {
    hip = mixA(hip, GP.hip, PS.grab); bend = lerp(bend, GP.bend, PS.grab);
    side = GP.side * PS.grab; gtw = GP.twist * PS.grab; arch = GP.arch * gk;
    bpos = [GP.bpos[0] * gk, GP.bpos[1] * gk, GP.bpos[2] * gk]; brot = [GP.brot[0] * gk, GP.brot[1] * gk, GP.brot[2] * gk];
    var fr = GP.free; if (GP.hand === 'front') hR = mixA(hR, fr, PS.grab); else hF = mixA(hF, fr, PS.grab);
  }
  // nose / tail press: il peso va sulla punta o sulla coda
  hip[0] += PS.press * 0.13;
  // compressione delle gambe: atterraggi e cambi di pendenza
  if (ground && PS.init) PS.compV -= clamp(P.vy - PS.lvy, -0.6, 0.6) * 0.45;
  PS.lvy = P.vy;
  PS.compV += (-70 * PS.comp - 11 * PS.compV) * dt; PS.comp = clamp(PS.comp + PS.compV * dt, -0.3, 0.07);
  hip[1] += PS.comp;
  // ---- transizioni (nel sistema del corpo)
  var kk = first ? 1 : damp(air ? 13 : 10, dt);
  lerpV(PS.hip, hip, kk); PS.bend = lerp(PS.bend, bend, kk); PS.side = lerp(PS.side, side, kk); PS.gtw = lerp(PS.gtw, gtw, kk); PS.arch = lerp(PS.arch, arch, kk);
  lerpV(PS.hF, hF, kk); lerpV(PS.hR, hR, kk);
  lerpV(PS.bpos, bpos, first ? 1 : damp(12, dt)); lerpV(PS.brot, [brot[0], brot[1], brot[2]], first ? 1 : damp(12, dt));
  if (!GP) PS.reach.multiplyScalar(1 - damp(10, dt));
  var twistT = 0.1 - (P.charge > 0 ? P.prewind * 0.8 * P.charge : 0) - clamp(spinW * 0.07, -0.6, 0.6) * ss - (ground ? PS.steerS * 0.22 * ss * (P.sw ? -1 : 1) : 0);
  PS.twist = lerp(PS.twist, twistT, first ? 1 : damp(8, dt));
  // ---- tavola: corpo * tweak del grab; si sposta rispetto al corpo
  PS.roll = lerp(PS.roll, ground ? clamp(-P.lean * 0.5, -0.5, 0.5) * (P.sw ? -1 : 1) : 0, damp(10, dt));
  _bq.copy(P.q); _qb.setFromAxisAngle(AX, PS.roll); _bq.multiply(_qb);
  _eu.set(-ss * PS.brot.x, ss * PS.brot.z, PS.brot.y, 'YZX'); _qb.setFromEuler(_eu); _bq.multiply(_qb);
  if (Math.abs(PS.press) > 0.01) { _qb.setFromAxisAngle(AZ, -PS.press * 0.2); _bq.multiply(_qb); }
  rig.board.quaternion.copy(_bq);
  L2W(PS.bpos.x + PS.reach.x, PS.bpos.y + PS.reach.y, PS.bpos.z + PS.reach.z, _bpos);
  if (Math.abs(PS.press) > 0.01) { _t1.set(PS.press > 0 ? 0.7 : -0.7, 0, 0); _t2.copy(_t1).applyQuaternion(P.q); _t1.applyQuaternion(_bq); _bpos.add(_t2).sub(_t1); }
  rig.board.position.copy(_bpos); rig.board.updateMatrixWorld(true);
  _bx.set(1, 0, 0).applyQuaternion(_bq); _by.set(0, 1, 0).applyQuaternion(_bq); _bz.set(0, 0, 1).applyQuaternion(_bq);
  // ---- bacino
  L2W(PS.hip.x, PS.hip.y + BOARD_T, PS.hip.z, _hipP);
  if (P.wobble > 0) { P.wobble = Math.max(0, P.wobble - dt * 1.6); _hipP.addScaledVector(_rZ, Math.sin(rig.t * 22) * 0.04 * P.wobble); }
  _c.copy(_rZ); _U.copy(_rY);
  _F.copy(_c).applyAxisAngle(_U, 0.1 * ss);
  bodyQ(_F, _U, _qc); _qc.multiply(rig.bind.Hips.q);
  B.Hips.position.copy(_hipP); B.Hips.quaternion.copy(_qc); B.Hips.updateMatrixWorld(true);
  // ---- busto
  poseSpine(ss);
  // ---- testa: guarda dove va (in aria verso l'atterraggio, in curva dentro la curva)
  _tg.set(P.vx, 0, P.vz); if (_tg.lengthSq() < 0.01) _tg.copy(_rX); _tg.normalize();
  if (air && A && A.landX !== undefined) { _tg2.set(A.landX - P.x, (A.landY - P.y) * 0.6, A.landZ - P.z).normalize(); _tg.lerp(_tg2, 0.5).normalize(); }
  if (air && Math.abs(spinW) > 2) _tg.applyAxisAngle(AY, clamp(spinW * 0.12, -0.9, 0.9));
  if (ground) _tg.applyAxisAngle(AY, -PS.steerS * 0.4);
  PS.look.lerp(_tg, first ? 1 : damp(7, dt)).normalize();
  poseHead();
  bodyCapsules();
  separateBoard();
  // ---- gambe, poi braccia; se la mano non arriva alla tavola si accorcia la distanza (nel sistema del corpo)
  var front = ss > 0 ? 'Left' : 'Right', back = ss > 0 ? 'Right' : 'Left';
  poseLegs(front, back, ss, air);
  var gh = G0 ? (GP.hand === 'front' ? front : back) : null;
  if (G0 && PS.grab > 0.3) {
    B[gh + 'Arm'].getWorldPosition(_sh);
    grabPoint(G0, GP.hand === 'front', _t3).applyQuaternion(_bq).add(_bpos);
    var reach = (L.upper + L.fore) * 0.96, d = _sh.distanceTo(_t3);
    if (d > reach) {
      _t1.copy(_sh).sub(_t3).setLength(d - reach);                // la tavola deve avvicinarsi di tanto
      PS.reach.x += _t1.dot(_rX); PS.reach.y += _t1.dot(_rY); PS.reach.z += _t1.dot(_rZ);
      if (PS.reach.length() > 0.45) PS.reach.setLength(0.45);
      L2W(PS.bpos.x + PS.reach.x, PS.bpos.y + PS.reach.y, PS.bpos.z + PS.reach.z, _bpos);
      rig.board.position.copy(_bpos); rig.board.updateMatrixWorld(true);
      separateBoard();
      poseLegs(front, back, ss, air);
    }
  }
  bodyCapsules();
  poseArm(front, true, G0, GP, PS.hF, ss);
  poseArm(back, false, G0, GP, PS.hR, ss);
  curlFingers(0.35);
  if (G0 && PS.grab > 0.2) curlFingers(1.25 * PS.grab, gh === 'Left' ? 'L' : 'R');
  boardFlex(dt, ground);
  PS.init = true;
}
// flessione della tavola con una molla: si carica e scatta
PS.fb = 0; PS.fbV = 0; PS.ft = 0; PS.ftV = 0; PS.fApplied = [9, 9];
function boardFlex(dt, ground) {
  var ss = stanceSign();
  // bersagli: carica dell'ollie sul tail, press, compressione all'atterraggio, curva sullo spigolo
  var bowT = clamp(-PS.comp * 2.2, 0, 0.9) + Math.abs(PS.press) * 0.5 + (ground ? Math.abs(PS.lean) * 0.25 : 0) + (P.mode === 'rail' ? 0.25 : 0);
  var tipT = -P.charge * 0.8 + PS.press * 0.6;
  var h = Math.min(dt, 0.033);
  PS.fbV += ((bowT - PS.fb) * 260 - PS.fbV * 14) * h; PS.fb += PS.fbV * h;
  PS.ftV += ((tipT - PS.ft) * 220 - PS.ftV * 12) * h; PS.ft += PS.ftV * h;
  var b = clamp(PS.fb, -0.4, 1.2), t = clamp(PS.ft, -1, 1);
  if (Math.abs(b - PS.fApplied[0]) > 0.01 || Math.abs(t - PS.fApplied[1]) > 0.01) { rig.board.userData.flex(b, t); PS.fApplied = [b, t]; }
}
function poseSpine(ss) {
  var B = rig.B, bend = PS.bend;
  ['Spine', 'Spine1', 'Spine2'].forEach(function (n, i) {
    var f = (i + 1) / 3, b = bend - (i === 2 ? PS.arch * 0.7 : 0);
    _F.copy(_c).applyAxisAngle(_U, (0.1 + (PS.twist + PS.gtw) * f) * ss);
    _t1.crossVectors(_U, _F).normalize();
    _t2.copy(_U).applyAxisAngle(_t1, b * f * 0.9).applyAxisAngle(_F, PS.side * f * ss);
    _t3.copy(_F).applyAxisAngle(_t1, b * f * 0.9);
    bodyQ(_t3, _t2, _qc); _qc.multiply(rig.bind[n].q);
    setWorldQ(B[n], _qc);
  });
}
function poseHead() {
  var B = rig.B;
  B.Spine2.getWorldQuaternion(_qa);
  _t1.set(0, 1, 0).applyQuaternion(_qa); _t2.set(0, 0, 1).applyQuaternion(_qa);
  _t3.copy(PS.look).addScaledVector(_t1, -PS.look.dot(_t1)).normalize();
  var ang = Math.acos(clamp(_t3.dot(_t2), -1, 1));
  if (ang > 1.4) { var ax2 = _tmp.crossVectors(_t2, _t3).normalize(); _t3.copy(_t2).applyAxisAngle(ax2, 1.4); }
  bodyQ(_t3, _t1, _qc); _qb.copy(_qc).multiply(rig.bind.Head.q);
  _qa.multiply(rig.bind.Spine2.q.clone().invert()); _qa.multiply(rig.bind.Neck.q);
  _qa.slerp(_qb, 0.45); setWorldQ(B.Neck, _qa);
  setWorldQ(B.Head, _qb);
}
function poseLegs(front, back, ss, air) {
  var L = rig.L;
  [[front, 0.255, 15], [back, -0.255, -9]].forEach(function (lg) {
    var x = lg[1];
    _tg.copy(_bpos).addScaledVector(_bx, x).addScaledVector(_by, BOARD_T + 0.085);
    // ginocchia: avanti (lato petto), un po' verso la punta; nei grab e nella raccolta salgono
    // ginocchia: avanti (lato petto); nei grab sulle punte si aprono verso punta e coda per far passare il braccio
    var kn = PS.gi >= 0 ? (gpose(GRABS[PS.gi]).knee || 0) * PS.grab : 0;
    D2W((x > 0 ? 0.3 : 0.4) + (x > 0 ? 1 : -1) * kn, 0.25 + (air ? 0.5 * Math.max(PS.grab, PS.tuck) : 0), 1 - kn * 0.4, _pl);
    var gpk = PS.gi >= 0 ? gpose(GRABS[PS.gi]) : null, kd = gpk ? (gpk.kneeDown || 0) * PS.grab * (gpk.kneeDown === 2 && x < 0 ? 0 : 1) : 0;
    if (kd > 0) { D2W(x > 0 ? 0.25 : 0.05, -1.0, 0.75, _t2); _pl.lerp(_t2, kd); }
    solveLimb(lg[0] + 'UpLeg', lg[0] + 'Leg', lg[0] + 'Foot', _tg, L.thigh, L.shin, _pl, ZF);
    _F.copy(_bz).multiplyScalar(ss).applyAxisAngle(_by, lg[2] * DEG * ss);
    setFootQ(lg[0] + 'Foot', _F, _by);
    setFootQ(lg[0] + 'ToeBase', _F, _by);
  });
}
// braccio: la mano va nel punto della posa (rispetto al bacino) o sulla tavola se e' quella del grab.
// Il gomito punta sempre verso l'esterno, dalla sua parte: le braccia non si incrociano.
// ---- il corpo come ostacolo: busto, bacino, testa e cosce sono capsule solide
var _cs = [], _ca = new THREE.Vector3(), _cb = new THREE.Vector3(), _ce = new THREE.Vector3(), _cm = new THREE.Vector3(), _cu = new THREE.Vector3(), _cv2 = new THREE.Vector3();
var _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _rr = new THREE.Vector3(), _cp1 = new THREE.Vector3(), _cp2 = new THREE.Vector3();
function bodyCapsules() {
  var B = rig.B; _cs.length = 0;
  function cap(a, b, r, ext) {
    var p = new THREE.Vector3(), q = new THREE.Vector3(); B[a].getWorldPosition(p); B[b].getWorldPosition(q);
    if (ext) q.sub(p).multiplyScalar(1 + ext).add(p);
    _cs.push([p, q, r]);
  }
  cap('Hips', 'Spine2', 0.17, 0.0);       // pancia e fianchi
  // sedere: dal bacino un po' in basso e indietro
  var hp = new THREE.Vector3(), sp2 = new THREE.Vector3(), hq = new THREE.Quaternion();
  B.Hips.getWorldPosition(hp); B.Spine2.getWorldPosition(sp2); B.Hips.getWorldQuaternion(hq);
  var upv = sp2.clone().sub(hp).normalize(), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.bind.Hips.q.clone().invert()).applyQuaternion(hq).normalize();
  _cs.push([hp.clone(), hp.clone().addScaledVector(upv, -0.1).addScaledVector(fw, -0.07), 0.15]);
  cap('Spine1', 'Neck', 0.16, 0.0);       // petto
  cap('Neck', 'Head', 0.13, 0.9);         // testa
  cap('LeftUpLeg', 'LeftLeg', 0.11, 0); cap('RightUpLeg', 'RightLeg', 0.11, 0);   // cosce
  cap('LeftLeg', 'LeftFoot', 0.08, 0); cap('RightLeg', 'RightFoot', 0.08, 0);     // stinchi
}
// distanza tra due segmenti
function segDist(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _rr.subVectors(p1, p2);
  var a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_rr), s, t;
  if (a < 1e-9 && e < 1e-9) return _rr.length();
  if (a < 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    var c = _d1.dot(_rr);
    if (e < 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      var bb = _d1.dot(_d2), den = a * e - bb * bb;
      s = den !== 0 ? clamp((bb * f - c * e) / den, 0, 1) : 0;
      t = (bb * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
    }
  }
  _cp1.copy(p1).addScaledVector(_d1, s); _cp2.copy(p2).addScaledVector(_d2, t);
  return _cp1.distanceTo(_cp2);
}
// quanto un segmento del braccio entra nel corpo (0 = fuori); skipFrom salta il pezzo attaccato alla spalla
function armPenetration(a, b, skipFrom) {
  _ca.copy(a).lerp(b, skipFrom || 0);
  var pen = 0;
  for (var i = 0; i < _cs.length; i++) {
    var c = _cs[i], d = segDist(_ca, b, c[0], c[1]), need = c[2] + 0.055;
    if (d < need) pen += need - d;
  }
  return pen;
}
var CAP_NAMES = ['pancia', 'sedere', 'petto', 'testa', 'coscia S', 'coscia D', 'stinco S', 'stinco D'];
function penBreakdown(a, b, skipFrom) {
  _ca.copy(a).lerp(b, skipFrom || 0); var r = [];
  for (var i = 0; i < _cs.length; i++) { var c = _cs[i], d = segDist(_ca, b, c[0], c[1]), need = c[2] + 0.055; if (d < need) r.push(CAP_NAMES[i] + ' ' + Math.round((need - d) * 100)); }
  return r.join(', ');
}
// la tavola non entra mai in bacino, sedere, petto e testa: se ci finisce dentro viene spostata fuori
var _bA = new THREE.Vector3(), _bB = new THREE.Vector3(), _sepD = new THREE.Vector3();
function boardPen() {
  _bA.set(0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos); _bB.set(-0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos);
  var pen = 0;
  for (var i = 0; i < 4; i++) { var c = _cs[i], d = segDist(_bA, _bB, c[0], c[1]), need = c[2] + 0.13; if (d < need) pen += need - d; }
  return pen;
}
function separateBoard() {
  // 1) la tavola sta sotto il bacino (salvo i grab con la tavola dietro la schiena): mai il sedere attraverso la tavola
  var G0 = PS.gi >= 0 ? GRABS[PS.gi] : null, behind = G0 && (G0.id === 'method' || G0.id === 'japan');
  var minClear = behind ? 0.05 : 0.34;
  _t1.subVectors(_hipP, _bpos); var clr = _t1.dot(_rY);
  if (clr < minClear) _bpos.addScaledVector(_rY, clr - minClear);
  // 2) nessun pezzo della tavola dentro bacino, sedere, petto, testa: bacino e sedere spingono in basso
  for (var it = 0; it < 4; it++) {
    _bA.set(0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos); _bB.set(-0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos);
    var moved = false;
    for (var i = 0; i < 4; i++) {
      var c = _cs[i], d = segDist(_bA, _bB, c[0], c[1]), need = c[2] + 0.13;
      if (d < need) {
        if (i < 2 && !behind) _sepD.copy(_rY).negate();
        else { _sepD.subVectors(_cp1, _cp2); if (_sepD.lengthSq() < 1e-8) _sepD.copy(_rY).negate(); _sepD.normalize(); }
        _bpos.addScaledVector(_sepD, need - d + 0.005); moved = true;
        _bA.set(0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos); _bB.set(-0.7, 0.02, 0).applyQuaternion(_bq).add(_bpos);
      }
    }
    if (!moved) break;
  }
  rig.board.position.copy(_bpos); rig.board.updateMatrixWorld(true);
}
// spinge fuori dal corpo un punto (es. la mano)
function pushOut(p) {
  for (var i = 0; i < _cs.length; i++) {
    var c = _cs[i], need = c[2] + 0.06;
    _cu.subVectors(c[1], c[0]); var L2 = _cu.lengthSq() || 1e-6, t = clamp(_cv2.subVectors(p, c[0]).dot(_cu) / L2, 0, 1);
    _cm.copy(c[0]).addScaledVector(_cu, t); _cv2.subVectors(p, _cm); var d = _cv2.length();
    if (d < need && d > 1e-5) p.addScaledVector(_cv2, (need - d) / d);
  }
}
// braccio: si provano 16 posizioni del gomito attorno alla linea spalla-mano e si tiene quella che resta
// fuori dal corpo (a parita', quella piu' vicina alla direzione voluta). Cosi' il braccio gira attorno al busto.
var _ax = new THREE.Vector3(), _ub = new THREE.Vector3(), _vb = new THREE.Vector3(), _best = new THREE.Vector3(), _elb = new THREE.Vector3(), _shp = new THREE.Vector3();
function poseArm(side, isFront, G0, GP, hLocal, ss) {
  var L = rig.L, out = isFront ? 1 : -1, l1 = L.upper, l2 = L.fore;
  _hw.copy(_hipP).addScaledVector(_rX, hLocal.x).addScaledVector(_rY, hLocal.y).addScaledVector(_rZ, hLocal.z);
  var grabbing = GP && ((GP.hand === 'front') === isFront) && PS.grab > 0.01;
  if (grabbing) {
    grabPoint(G0, isFront, _t3).applyQuaternion(_bq).add(_bpos);
    _hw.lerp(_t3, sm01(PS.grab));
    D2W(GP.elbow[0], GP.elbow[1], GP.elbow[2], _pl);
  } else { pushOut(_hw); D2W(out * 0.55, -0.5, -0.15, _pl); }
  rig.B[side + 'Arm'].getWorldPosition(_shp);
  var dv = _ax.subVectors(_hw, _shp), dist = clamp(dv.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  dv.normalize();
  var x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _ub.copy(_pl).addScaledVector(dv, -_pl.dot(dv)); if (_ub.lengthSq() < 1e-6) _ub.set(0, -1, 0).addScaledVector(dv, dv.y);
  _ub.normalize(); _vb.crossVectors(dv, _ub);
  var bestScore = -1e9;
  _cb.copy(_shp).addScaledVector(dv, Math.min(dist, l1 + l2 - 1e-3));
  for (var k = 0; k < 16; k++) {
    var ang = k / 16 * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
    _elb.copy(_shp).addScaledVector(dv, x).addScaledVector(_ub, h * ca).addScaledVector(_vb, h * sa);
    var pen = armPenetration(_shp, _elb, 0.35) + armPenetration(_elb, _cb, 0);
    var score = -pen * 40 + ca;                // fuori dal corpo prima di tutto, poi vicino al gomito voluto
    if (score > bestScore) { bestScore = score; _best.copy(_elb); }
  }
  _pl.copy(_best).sub(_cm.copy(_shp).add(_cb).multiplyScalar(0.5));
  solveLimb(side + 'Arm', side + 'ForeArm', side + 'Hand', _hw, l1, l2, _pl, ZB);
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
