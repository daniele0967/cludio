// ============================================================ GRAFICA DEL PARK: kicker, rail, box, bandiere, seggiovia, effetti
var parkObjs = {};   // id ostacolo -> oggetto 3D
var RAIL_COLS = [0xf4c01e, 0xff6a2b, 0x21b8ff, 0xe8eef6];
var metalMat = RAIL_COLS.map(function (c) { return new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: 0.28 }); });
var steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 });
var plateMat = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.4, roughness: 0.6 });
var boxTopMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.0 });
var boxSideTex = canvasTex(512, 64, function (g, w, h) {
  g.fillStyle = '#0d1b2e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff5a36'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
  g.fillStyle = '#ffffff'; g.font = 'italic 900 34px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
  for (var x = 14; x < w; x += 250) { g.fillText('POWDER RUN', x, h / 2 + 1); }
  g.fillStyle = '#21b8ff'; for (x = 196; x < w; x += 250) { g.beginPath(); g.moveTo(x, h / 2 + 12); g.lineTo(x + 18, h / 2 - 12); g.lineTo(x + 36, h / 2 + 12); g.fill(); }
}, true);
boxSideTex.colorSpace = THREE.SRGBColorSpace;
var boxSideMat = new THREE.MeshStandardMaterial({ map: boxSideTex, roughness: 0.55 });
var flagTex = [0xff5a36, 0x21b8ff, 0xf4c01e];
var flagMats = flagTex.map(function (c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }); });
var KICK_BLUE = new THREE.Color(0x2a5fe0), WHITE = new THREE.Color(0xffffff);

// unisce le mesh di un gruppo che usano lo stesso materiale: meno oggetti da disegnare
function mergeByMaterial(group, keep) {
  group.updateMatrixWorld(true);
  var inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = {}, out = new THREE.Group(), m4 = new THREE.Matrix4();
  group.traverse(function (o) {
    if (!o.isMesh || o.isInstancedMesh || (keep && keep(o)) || Array.isArray(o.material)) return;
    var k = o.material.uuid; (buckets[k] || (buckets[k] = { mat: o.material, list: [], shadow: o.castShadow })).list.push(o);
  });
  for (var k in buckets) {
    var b = buckets[k], pos = [], nor = [], uv = [], idx = [], base = 0;
    b.list.forEach(function (o) {
      var g = o.geometry; m4.multiplyMatrices(inv, o.matrixWorld);
      var nm = new THREE.Matrix3().getNormalMatrix(m4), p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv, v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m4); pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
        uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      }
      if (g.index) for (i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (i = 0; i < p.count; i++) idx.push(i + base);
      base += p.count;
      o.parent.remove(o); g.dispose();
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeBoundingSphere();
    var mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.shadow; mesh.receiveShadow = true;
    out.add(mesh);
  }
  // quello che resta (es. la neve del kicker) si sposta nel nuovo gruppo
  group.children.slice().forEach(function (c) { out.add(c); });
  return out;
}

// griglia di neve (kicker, rampe dei rail): y = terreno con quell'ostacolo
function snowGrid(f, sEnd, wExt, lines) {
  var rows = Math.max(2, Math.ceil(sEnd / KS) + 1), ws = [];
  for (var w = -wExt; w <= wExt + 1e-6; w += 0.22) ws.push(w);
  [-f.hw, f.hw].forEach(function (e) { if (ws.indexOf(e) < 0) ws.push(e); });
  ws.sort(function (a, b) { return a - b; });
  var cols = ws.length, n = rows * cols;
  var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), cord = new Float32Array(n * 3);
  var yRef = profY(f.d0), zRef = -f.d0, cc = new THREE.Color();
  for (var r = 0; r < rows; r++) {
    var s = Math.min(r * KS, sEnd), d = f.d0 + s, c0 = cx(d), py = profY(d);
    for (var c = 0; c < cols; c++) {
      var u = f.u + ws[c], o = featOff(f, u, d), y = py + crossH(u, d) + o, i = r * cols + c;
      if (o <= 0.002) y -= 0.06;
      pos[i * 3] = c0 + u; pos[i * 3 + 1] = y - yRef; pos[i * 3 + 2] = -d - zRef;
      cc.copy(WHITE);
      var top = Math.abs(ws[c]) <= f.hw + 0.01;
      if (lines && top) lines.forEach(function (L) { if (s >= L[0] && s <= L[1]) cc.copy(KICK_BLUE); });
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
      uv[i * 2] = (c0 + u) / 3.2; uv[i * 2 + 1] = (((d % 1024) + 1024) % 1024) / 3.2;
      cord[i * 3] = u; cord[i * 3 + 1] = d % 512; cord[i * 3 + 2] = top ? 1 : 0;
    }
  }
  var idx = [];
  for (r = 0; r < rows - 1; r++) for (c = 0; c < cols - 1; c++) {
    var a = r * cols + c, b = a + 1, c2 = a + cols, d2 = c2 + 1;
    idx.push(a, b, c2, b, d2, c2); // faccia verso l alto
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aCord', new THREE.BufferAttribute(cord, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  var m = new THREE.Mesh(geo, snowMatKick);
  m.position.set(0, yRef, zRef); m.receiveShadow = true; m.castShadow = false;
  return m;
}
function buildKick(f) {
  var K = f.K, maxO = 0; for (var i = 0; i < f.off.length; i++) maxO = Math.max(maxO, f.off[i]);
  var g = new THREE.Group();
  g.add(snowGrid(f, f.d1 - f.d0, f.hw + maxO / f.k + 0.5, [[K.sLip - 0.35, K.sLip - 0.02], [K.sKn + 0.15, K.sKn + 0.45]]));
  // bandierine ai lati del lip e del knuckle
  [[f.dLip, 0], [f.dKn + 0.5, 1]].forEach(function (pp, j) {
    [-1, 1].forEach(function (s) {
      var u = f.u + s * (f.hw + 0.25), d = pp[0], y = groundH(cx(d) + u, -d);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), poleMat2);
      pole.position.set(cx(d) + u, y + 0.8, -d); pole.castShadow = true; g.add(pole);
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.36), flagMats[j]);
      fl.position.set(cx(d) + u + s * 0.28, y + 1.4, -d); fl.rotation.y = s * 0.15; g.add(fl);
    });
  });
  // cartello con la misura del salto, prima della rampa
  var sd = f.d0 - 9, su = f.u + (f.u <= 0 ? -1 : 1) * (f.hw + 2.6);
  if (Math.abs(su) < halfW(sd) - 0.5) {
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), signMat(f.size));
    var sy = groundH(cx(sd) + su, -sd);
    sign.position.set(cx(sd) + su, sy + 1.25, -sd); g.add(sign);
    var sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), poleMat2); sp.position.set(cx(sd) + su, sy + 0.5, -sd); g.add(sp);
  }
  if (f.tag === 'big') g.add(buildArch(f.d0 - 22, f.u, 'BIG AIR'));
  if (f.tag === 'super') buildSuper(f, g);
  var snow = g.children[0];
  return mergeByMaterial(g, function (o) { return o === snow; });
}
var poleMat2 = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.4, metalness: 0.3 });
var signMats = {};
function signMat(sz) {
  if (signMats[sz]) return signMats[sz];
  var t = canvasTex(256, 192, function (g, w, h) {
    g.fillStyle = sz === 'XL' ? '#111' : sz === 'L' ? '#d7263d' : sz === 'M' ? '#1f6fd6' : '#1a9b58';
    g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#fff'; g.font = '900 120px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sz, w / 2, h / 2 + 6);
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return (signMats[sz] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
}
function bannerMat(text, bg, fg) {
  var t = canvasTex(1024, 128, function (g, w, h) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'italic 900 92px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide });
}
// arco gonfiabile
// super salto: arco, file di bandiere lungo la rincorsa, tribune piene di pubblico ai lati dell'atterraggio
var crowdGeo = mergeGeos([[new THREE.CylinderGeometry(0.2, 0.24, 0.9, 6).translate(0, 0.45, 0), 0xffffff], [new THREE.SphereGeometry(0.13, 8, 6).translate(0, 1.05, 0), 0xe0b090]]);
var crowdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
var standMat = new THREE.MeshStandardMaterial({ color: 0x5c6670, roughness: 0.6, metalness: 0.4 });
var CROWD_COLS = [0xff5a36, 0x21b8ff, 0xf4c01e, 0xe8eef6, 0x1d8f8c, 0xc7323b, 0x6c5ce7, 0x22283a];
function buildSuper(f, g) {
  g.add(buildArch(f.d0 - 26, f.u, 'SUPER BIG AIR'));
  for (var i = 0; i < 7; i++) [-1, 1].forEach(function (sd) {
    var d = f.d0 - 22 + i * 4, u = f.u + sd * (f.hw + 1.6 + i * 0.1), y = groundH(cx(d) + u, -d);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.5, 6), poleMat2); pole.position.set(cx(d) + u, y + 2.25, -d); g.add(pole);
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), flagMats[i % 3]); fl.position.set(cx(d) + u + sd * 0.52, y + 3.6, -d); fl.rotation.y = sd * 0.25; g.add(fl);
  });
  // tribune
  var dStand = f.dLand + (f.dLandE - f.dLand) * 0.75, col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
  [-1, 1].forEach(function (sd) {
    var u0 = f.u + sd * (halfW(dStand) + 7), base = baseH(cx(dStand) + u0, -dStand), rows = 6, perRow = 22, im = new THREE.InstancedMesh(crowdGeo, crowdMat, rows * perRow), n = 0;
    for (var r = 0; r < rows; r++) {
      var step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6 + r * 0.7, 26), standMat);
      var uu = u0 + sd * r * 1.4; step.position.set(cx(dStand) + uu, base + (0.6 + r * 0.7) / 2 - 0.2, -dStand); step.castShadow = true; step.receiveShadow = true; g.add(step);
      for (var k = 0; k < perRow; k++) {
        pp.set(cx(dStand) + uu + (Math.random() - 0.5) * 0.4, base + 0.4 + r * 0.7, -dStand - 12 + k * 1.15 + (Math.random() - 0.5) * 0.3);
        q.setFromAxisAngle(AY, sd > 0 ? -PI / 2 : PI / 2); m4.compose(pp, q, sc); im.setMatrixAt(n, m4);
        im.setColorAt(n, col.set(CROWD_COLS[(k * 7 + r * 3) % CROWD_COLS.length])); n++;
      }
    }
    im.castShadow = true; g.add(im);
  });
}

// arco gonfiabile: le gambe stanno fuori dalla pista, sulle sponde
function buildArch(d, u, text) {
  var g = new THREE.Group(), span = halfW(d) + 1.2, c0 = cx(d), y = profY(d), sy = 0.62;
  var arch = new THREE.Mesh(new THREE.TorusGeometry(span, 0.6, 12, 48, PI), new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.5 }));
  arch.scale.set(1, sy, 1); arch.position.set(c0 + u, y + 0.2, -d); arch.castShadow = true; g.add(arch);
  var ban = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), bannerMat(text, '#0d1b2e', '#ffffff'));
  ban.position.set(c0 + u, y + span * sy - 1.2, -d + 0.02); g.add(ban);
  var ban2 = ban.clone(); ban2.rotation.y = PI; ban2.position.z = -d - 0.02; g.add(ban2);
  return g;
}

// rampe di neve davanti ai rail
function buildLead(f) {
  var h = f.t === 'lead' ? f.h0 : f.h;
  return snowGrid(f, f.d1 - f.d0, f.hw + h / f.k + 0.4, null);
}

function buildRail(r) {
  var g = new THREE.Group(), mat = metalMat[r.col % metalMat.length];
  var tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  r.segs.forEach(function (s, i) {
    tmpA.set(s.a.x, s.a.y, s.a.z); tmpB.set(s.b.x, s.b.y, s.b.z);
    var mid = tmpA.clone().add(tmpB).multiplyScalar(0.5), dir = tmpB.clone().sub(tmpA), len = dir.length(); dir.normalize();
    var q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    if (r.kind === 'rail') {
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, len, 12), mat);
      tube.position.copy(mid); tube.position.y -= 0.042; tube.quaternion.copy(q); tube.castShadow = true; g.add(tube);
      if (i > 0) { var j = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), mat); j.position.set(s.a.x, s.a.y - 0.042, s.a.z); g.add(j); }
    } else {
      // box: piano di plastica sopra, fianchi con la grafica
      var hgt = Math.max(0.35, (s.a.h + s.b.h) / 2 + 0.25);
      var topM = new THREE.Mesh(new THREE.BoxGeometry(r.hw * 2, 0.05, len + 0.02), boxTopMat);
      var side = new THREE.Mesh(new THREE.BoxGeometry(r.hw * 2 - 0.02, hgt, len), [boxSideMat, boxSideMat, plateMat, plateMat, plateMat, plateMat]);
      var qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      // il box resta dritto (niente rollio): si costruisce con la punta lungo dir e l'alto verso Y
      var fwd = dir.clone(), right = new THREE.Vector3().crossVectors(fwd, up).normalize(), upv = new THREE.Vector3().crossVectors(right, fwd).normalize();
      var m4 = new THREE.Matrix4().makeBasis(right, upv, fwd.clone().negate()); qq.setFromRotationMatrix(m4);
      topM.quaternion.copy(qq); topM.position.copy(mid).addScaledVector(upv, -0.025);
      side.quaternion.copy(qq); side.position.copy(mid).addScaledVector(upv, -0.05 - hgt / 2);
      topM.castShadow = side.castShadow = true; topM.receiveShadow = true;
      g.add(topM); g.add(side);
      // per far leggere la grafica, le facce laterali usano la texture ruotata
      boxSideTex.repeat.set(1, 1);
    }
  });
  // supporti dei rail
  if (r.kind === 'rail') {
    var L = r.len, n = Math.max(2, Math.round(L / 2.8));
    for (var k = 0; k <= n; k++) {
      var s = clamp(k / n * L, 0.25, L - 0.25), p = railPoint(r, s, {}), gy = baseH(p.x, p.z);
      var hgt = p.y - 0.08 - gy + 0.3;
      if (hgt < 0.1) continue;
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, hgt, 8), steelMat);
      post.position.set(p.x, gy - 0.3 + hgt / 2, p.z); post.castShadow = true; g.add(post);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), plateMat); foot.position.set(p.x, gy + 0.01, p.z); foot.receiveShadow = true; g.add(foot);
    }
    var a0 = r.pts[0], a1 = r.pts[r.pts.length - 1];
    [a0, a1].forEach(function (p) { var cap = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), mat); cap.position.set(p.x, p.y - 0.042, p.z); g.add(cap); });
  }
  return mergeByMaterial(g);
}

// cancello di partenza
function buildStart() {
  var g = new THREE.Group();
  g.add(buildArch(16, 0, 'POWDER RUN · FREE RUN'));
  // casetta di legno a lato
  var d = 4, u = -halfW(d) - 6, y = profY(d) + crossH(u, d);
  var wood = new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: 0xf4f8fd, roughness: 0.7 });
  var hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wood); hut.position.set(cx(d) + u, y + 1.3, -d); hut.castShadow = true; hut.receiveShadow = true; g.add(hut);
  var rf = new THREE.Mesh(new THREE.ConeGeometry(4, 1.6, 4), roof); rf.rotation.y = PI / 4; rf.position.set(cx(d) + u, y + 3.6, -d); rf.castShadow = true; g.add(rf);
  return g;
}

// ------------------------------------------------------------ seggiovia lungo il lato sinistro
var LIFT_U = -46, LIFT_STEP = 90, LIFT_H = 11;
var liftGroup = new THREE.Group(); scene.add(liftGroup);
var towerParts = mergeGeos([
  [new THREE.CylinderGeometry(0.28, 0.42, LIFT_H, 8).translate(0, LIFT_H / 2, 0), 0x8a929c],
  [new THREE.BoxGeometry(6.2, 0.35, 0.5).translate(0, LIFT_H, 0), 0x6c747e],
  [new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12).rotateX(PI / 2).translate(-2.8, LIFT_H - 0.3, 0), 0x2b2f35],
  [new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12).rotateX(PI / 2).translate(2.8, LIFT_H - 0.3, 0), 0x2b2f35]
]);
var towerMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.5 });
var chairGeo = mergeGeos([
  [new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5).translate(0, -1.2, 0), 0x30343a],
  [new THREE.BoxGeometry(1.8, 0.1, 0.6).translate(0, -2.4, 0.1), 0x2b6de0],
  [new THREE.BoxGeometry(1.8, 0.6, 0.08).translate(0, -2.1, -0.18), 0x2b6de0],
  [new THREE.CylinderGeometry(0.025, 0.025, 1.8, 5).rotateZ(PI / 2).translate(0, -1.75, 0.35), 0x30343a]
]);
var chairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
var CHAIRS = 44, chairs = new THREE.InstancedMesh(chairGeo, chairMat, CHAIRS);
chairs.castShadow = true; chairs.frustumCulled = false; scene.add(chairs);
var towers = {}, cableMat = new THREE.LineBasicMaterial({ color: 0x2b2f35 });
function liftTop(i) { var d = i * LIFT_STEP; return { x: cx(d) + LIFT_U, y: profY(d) + crossH(LIFT_U, d) + LIFT_H, z: -d }; }
function liftAt(d, side) { // posizione del cavo a distanza d (side -1/+1 = salita / discesa)
  var i = Math.floor(d / LIFT_STEP), t = d / LIFT_STEP - i, a = liftTop(i), b = liftTop(i + 1);
  var sag = Math.sin(t * PI) * 1.1;
  return { x: lerp(a.x, b.x, t) + side * 2.8, y: lerp(a.y, b.y, t) - 0.3 - sag, z: lerp(a.z, b.z, t) };
}
function updLift(dCenter, time) {
  var i0 = Math.floor((dCenter - 150) / LIFT_STEP), i1 = Math.floor((dCenter + 520) / LIFT_STEP), k;
  for (k in towers) if (+k < i0 || +k > i1) { liftGroup.remove(towers[k]); towers[k].children.forEach(function (c) { if (c.geometry && c.geometry !== towerParts) c.geometry.dispose(); }); delete towers[k]; }
  for (var i = Math.max(0, i0); i <= i1; i++) {
    if (towers[i]) continue;
    var g = new THREE.Group(), p = liftTop(i), d = i * LIFT_STEP;
    var tw = new THREE.Mesh(towerParts, towerMat); tw.position.set(p.x, p.y - LIFT_H, p.z); tw.castShadow = true;
    var nd = (i + 1) * LIFT_STEP, ang = Math.atan2(cx(nd) - cx(d), LIFT_STEP); tw.rotation.y = ang;
    g.add(tw);
    [-1, 1].forEach(function (s) {
      var pts = []; for (var t = 0; t <= 12; t++) { var q = liftAt(d + t / 12 * LIFT_STEP, s); pts.push(new THREE.Vector3(q.x, q.y + 0.3, q.z)); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
    });
    liftGroup.add(g); towers[i] = g;
  }
  // seggiole che scorrono
  var span = 670, base = dCenter - 150;
  for (var c = 0; c < CHAIRS; c++) {
    var side = c % 2 ? 1 : -1, ph = ((time * 4.2 * side + c * span / CHAIRS * 2) % span + span) % span, d2 = base + ph;
    if (d2 < 0) d2 += span;
    var q = liftAt(d2, side);
    _mx.compose(_px.set(q.x, q.y, q.z), _qx.setFromEuler(_ex.set(0, side > 0 ? PI : 0, 0)), _sx.set(1, 1, 1));
    chairs.setMatrixAt(c, _mx);
  }
  chairs.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------ gestione degli oggetti del park
function syncPark(dCenter) {
  var lo = dCenter - 60, hi = dCenter + 520, seen = {};
  W.feats.forEach(function (f) {
    if (f.d1 < lo || f.d0 > hi) return;
    seen[f.id] = 1;
    if (!parkObjs[f.id]) { var o = f.t === 'kick' ? buildKick(f) : buildLead(f); scene.add(o); parkObjs[f.id] = o; }
  });
  W.rails.forEach(function (r) {
    if (r.d1 < lo || r.d0 > hi) return;
    seen[r.id] = 1;
    if (!parkObjs[r.id]) { var o = buildRail(r); scene.add(o); parkObjs[r.id] = o; }
  });
  if (!parkObjs.start && dCenter < 300) { parkObjs.start = buildStart(); scene.add(parkObjs.start); }
  seen.start = dCenter < 300 ? 1 : 0;
  for (var k in parkObjs) if (!seen[k]) { disposeObj(parkObjs[k]); delete parkObjs[k]; }
}
function disposeObj(o) {
  scene.remove(o);
  o.traverse(function (c) { if (c.geometry && c.geometry !== towerParts && c.geometry !== chairGeo) c.geometry.dispose(); });
}
function clearPark() {
  for (var k in parkObjs) disposeObj(parkObjs[k]);
  parkObjs = {};
  for (k in chunks) dropChunk(+k);
  clearFar();
  for (k in towers) { liftGroup.remove(towers[k]); delete towers[k]; }
}
var VIEW_AHEAD = 540;
function syncChunks(dCenter, budget) {
  var k0 = Math.floor((dCenter - 70) / CHUNK), k1 = Math.floor((dCenter + VIEW_AHEAD) / CHUNK), built = 0, kc = Math.floor(dCenter / CHUNK);
  for (var k in chunks) if (+k < k0 || +k > k1) dropChunk(+k);
  // si costruisce prima il blocco piu' vicino che manca, uno per fotogramma
  for (var j = 0; j <= k1 - k0 && built < (budget || 1); j++) {
    var kk = kc + (j % 2 ? Math.ceil(j / 2) : -Math.ceil(j / 2));
    if (kk < k0 || kk > k1) kk = kc + j;
    if (kk >= k0 && kk <= k1 && !chunks[kk]) { buildChunk(kk); built++; }
  }
  for (k = k0; k <= k1; k++) if (!chunks[k] && built < (budget || 1)) { buildChunk(k); built++; }
  // alberi: ombre solo vicino al rider, versione semplice da lontano
  for (k in chunks) {
    var near = Math.abs(+k - kc) <= 1, low = Math.abs(+k - kc) >= 3;
    chunks[k].sc.forEach(function (o) {
      o.castShadow = near && o.isInstancedMesh;
      if (o.userData.tree !== undefined) { var g = low ? TREE_LOW[o.userData.tree] : TREE_GEOS[o.userData.tree]; if (o.geometry !== g) o.geometry = g; }
    });
  }
  return built;
}

// ------------------------------------------------------------ neve sollevata (particelle)
var pBase = new Float32Array(2600);
var PN = 2600, pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pSize = new Float32Array(PN), pAlpha = new Float32Array(PN), pHead = 0;
var pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
var pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uScale: { value: 300 }, uCol: { value: new THREE.Color(0xffffff) }, uShade: { value: new THREE.Color(0xc4d4e8) } },
  vertexShader: 'attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 uCol, uShade; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c,c) * 4.0; if (r > 1.0) discard; float a = exp(-r * 2.6) * vA; gl_FragColor = vec4(mix(uCol, uShade, smoothstep(0.1, 0.9, gl_PointCoord.y) * 0.75), a);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}'
});
var pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
function part(x, y, z, vx, vy, vz, life, size, a) {
  var i = pHead; pHead = (pHead + 1) % PN;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pLife[i] = pMax[i] = life; pSize[i] = size; pAlpha[i] = pBase[i] = a === undefined ? 0.85 : a;
}
function burst(x, y, z, n, spd, up, size) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * TAU, s = spd * (0.3 + Math.random());
    part(x, y + 0.05, z, Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s, 0.8 + Math.random() * 0.9, (size || 0.3) * (0.7 + Math.random()), 0.75);
  }
}
function updParticles(dt) {
  for (var i = 0; i < PN; i++) {
    if (pLife[i] <= 0) { if (pAlpha[i]) { pAlpha[i] = 0; } continue; }
    pLife[i] -= dt;
    var k = i * 3;
    pVel[k + 1] -= 2.6 * dt;
    var dr = 1 - damp(1.7, dt); pVel[k] *= dr; pVel[k + 1] *= dr; pVel[k + 2] *= dr;
    pPos[k] += pVel[k] * dt; pPos[k + 1] += pVel[k + 1] * dt; pPos[k + 2] += pVel[k + 2] * dt;
    var t = pLife[i] / pMax[i];
    pAlpha[i] = Math.max(0, t) * pBase[i];
    pSize[i] *= 1 + dt * 1.5;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aSize.needsUpdate = true; pGeo.attributes.aAlpha.needsUpdate = true;
}

// ------------------------------------------------------------ fiocchi e cristalli nell'aria
var FN = 900, fPos = new Float32Array(FN * 3), fGeo = new THREE.BufferGeometry();
for (var fi = 0; fi < FN; fi++) { fPos[fi * 3] = (Math.random() - 0.5) * 60; fPos[fi * 3 + 1] = Math.random() * 30; fPos[fi * 3 + 2] = (Math.random() - 0.5) * 60; }
fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
var fMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false });
var flakes = new THREE.Points(fGeo, fMat); flakes.frustumCulled = false; scene.add(flakes);
var flakeOrigin = new THREE.Vector3();
function updFlakes(dt, cam, amount, time) {
  var n = Math.floor(FN * clamp(amount, 0.05, 1));
  fGeo.setDrawRange(0, n);
  fMat.size = amount > 0.5 ? 0.09 : 0.05;
  for (var i = 0; i < n; i++) {
    var k = i * 3;
    fPos[k] += (Math.sin(time * 0.7 + i) * 0.4) * dt; fPos[k + 1] -= (amount > 0.5 ? 1.3 : 0.25) * dt; fPos[k + 2] += 0.2 * dt;
    var rx = fPos[k] - cam.x, ry = fPos[k + 1] - cam.y, rz = fPos[k + 2] - cam.z;
    if (rx > 30) fPos[k] -= 60; else if (rx < -30) fPos[k] += 60;
    if (rz > 30) fPos[k + 2] -= 60; else if (rz < -30) fPos[k + 2] += 60;
    if (ry < -12) fPos[k + 1] += 26; else if (ry > 14) fPos[k + 1] -= 26;
  }
  fGeo.attributes.position.needsUpdate = true;
}

// ------------------------------------------------------------ tracce della tavola sulla neve
var TRN = 900, trPos = new Float32Array(TRN * 2 * 3), trA = new Float32Array(TRN * 2), trV = new Float32Array(TRN * 2), trN = 0;
for (var tvi = 0; tvi < TRN; tvi++) { trV[tvi * 2] = 0; trV[tvi * 2 + 1] = 1; }
var trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
trGeo.setAttribute('aA', new THREE.BufferAttribute(trA, 1));
trGeo.setAttribute('aV', new THREE.BufferAttribute(trV, 1));
(function () { var idx = []; for (var i = 0; i < TRN - 1; i++) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trGeo.setIndex(idx); })();
var trMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: new THREE.Color(0x7d93b4) }, uRim: { value: new THREE.Color(0xffffff) } }]),
  vertexShader: '#include <fog_pars_vertex>\nattribute float aA; attribute float aV; varying float vA; varying float vV; void main(){ vA = aA; vV = aV; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
  // solco nella neve fresca: fondo in ombra, bordi sollevati e illuminati
  fragmentShader: '#include <fog_pars_fragment>\nuniform vec3 uCol, uRim; varying float vA; varying float vV; void main(){ float c = abs(vV * 2.0 - 1.0); float groove = smoothstep(0.9, 0.35, c); float rim = smoothstep(0.62, 0.9, c) * smoothstep(1.0, 0.92, c); vec3 col = mix(uRim, uCol, groove); float a = vA * (groove * 0.5 + rim * 0.45); gl_FragColor = vec4(col, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>\n}'
});
var trail = new THREE.Mesh(trGeo, trMat); trail.frustumCulled = false; trail.renderOrder = 1; scene.add(trail);
var trLast = null;
function trailReset() { trN = 0; trA.fill(0); trLast = null; trGeo.setDrawRange(0, 0); trGeo.attributes.aA.needsUpdate = true; }
function trailAdd(x, y, z, rx, rz, w, on) {
  if (trN >= TRN) {
    trPos.copyWithin(0, 6 * 60); trA.copyWithin(0, 2 * 60); trN -= 60;
  }
  var i = trN++;
  trPos[i * 6] = x - rx * w; trPos[i * 6 + 1] = y; trPos[i * 6 + 2] = z - rz * w;
  trPos[i * 6 + 3] = x + rx * w; trPos[i * 6 + 4] = y; trPos[i * 6 + 5] = z + rz * w;
  trA[i * 2] = trA[i * 2 + 1] = on ? 1 : 0;
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.aA.needsUpdate = true;
  trGeo.setDrawRange(0, Math.max(0, (trN - 1) * 6));
}

// ------------------------------------------------------------ cerchio dove si atterra (aiuto visivo)
var landRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x5cf0b5, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
landRing.renderOrder = 4; scene.add(landRing);
var railMark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5cf0b5, transparent: true, opacity: 0, depthTest: false }));
railMark.renderOrder = 6; scene.add(railMark);
