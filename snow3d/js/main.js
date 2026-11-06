// ============================================================ CICLO DI GIOCO: stati, eventi, sfide, tutorial, camera
var state = 'loading', GAME = null, gtime = 0, acc = 0, last = 0;
var MENU_CAM = { a: 0.6, close: 0 };
var camT = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camHd = 0, camShake = 0, camInit = false, camY = 0;
var flashEl = $('flash'), flashA = 0;

// ------------------------------------------------------------ sfide (Free Run e Zen)
var GOALS = [
  { t: 'Atterra uno spin da 360 o più', ev: 'land', ok: function (e) { return e.trick && e.trick.deg >= 360; } },
  { t: 'Fai un flip (front o back)', ev: 'land', ok: function (e) { return e.trick && e.trick.nf >= 1; } },
  { t: 'Atterra un grab tenuto a lungo (Tweaked)', ev: 'land', ok: function (e) { return e.trick && /Tweaked/.test(e.trick.name); } },
  { t: 'Grinda 14 m in tutto', ev: 'trick', n: 14, add: function (e) { return e.kind === 'rail' ? e.m : 0; } },
  { t: 'Incassa una combo con moltiplicatore ×4', ev: 'bank', ok: function (e) { return e.mult >= 4; } },
  { t: '3 atterraggi perfetti di fila', ev: 'land', n: 3, add: function (e, g) { if (e.q !== 'perfect') { g.p = 0; return 0; } return 1; } },
  { t: 'Fai un butter (nose o tail) con almeno 180', ev: 'trick', ok: function (e) { return / Butter /.test(e.name); } },
  { t: 'Cambia trick 2 volte sullo stesso rail', ev: 'railSwitch', n: 2, add: function () { return 1; }, reset: 'railOn' },
  { t: 'Atterra un 540 o più', ev: 'land', ok: function (e) { return e.trick && e.trick.deg >= 540; } },
  { t: 'Fai un trick fuori asse (Cork, Rodeo o Misty)', ev: 'land', ok: function (e) { return e.trick && /Cork|Rodeo|Misty/.test(e.trick.name); } },
  { t: 'Incassa una combo da 6.000 punti', ev: 'bank', ok: function (e) { return e.pts >= 6000; } },
  { t: 'Due grab diversi nello stesso salto', ev: 'land', ok: function (e) { return e.trick && e.trick.grabs >= 2; } },
  { t: 'Atterra uno spin partendo in switch', ev: 'land', ok: function (e) { return e.trick && /Cab|Switch/.test(e.trick.name); } },
  { t: 'Atterra un 720 o più', ev: 'land', ok: function (e) { return e.trick && e.trick.deg >= 720; } },
  { t: 'Salta un kicker XL', ev: 'land', ok: function (e) { return e.kick === 'XL'; } },
  { t: 'Fai un 270 On su un rail o un box', ev: 'railOn', ok: function (e) { return /On /.test(e.name); } },
  { t: 'Atterra un 1080', ev: 'land', ok: function (e) { return e.trick && e.trick.deg >= 1080; } },
  { t: 'Fai un doppio flip', ev: 'land', ok: function (e) { return e.trick && e.trick.nf >= 2; } }
];
function nextGoal() {
  var i = GAME.goalI++, g = GOALS[i < 6 ? i : 3 + Math.floor(Math.random() * (GOALS.length - 3))];
  GAME.goal = { g: g, p: 0, done: false, t: 0 };
  $('goalTxt').textContent = g.t; $('goal').classList.remove('done', 'hidden'); $('goalBar').style.width = '0%';
}
function goalEvent(e) {
  var G0 = GAME.goal; if (!G0 || G0.done) return;
  var g = G0.g;
  if (g.reset && e.t === g.reset) { G0.p = 0; }
  if (e.t !== g.ev) return;
  var hit = false;
  if (g.ok) hit = g.ok(e);
  else { G0.p += g.add(e, G0) || 0; hit = G0.p >= g.n; $('goalBar').style.width = Math.min(100, G0.p / g.n * 100) + '%'; }
  if (hit) {
    G0.done = true; G0.t = 2.6; GAME.goals++;
    var bonus = Math.round(1500 * (1 + GAME.goals * 0.25));
    GAME.score += bonus;
    var life = GAME.mode === 'free' && GAME.lives < 3;
    if (life) GAME.lives++;
    $('goal').classList.add('done'); $('goalBar').style.width = '100%';
    popup('Sfida completata', '+' + fmt(bonus) + (life ? ' · +1 vita' : ''), '', 'goal');
    sfx('goal');
  }
}

// ------------------------------------------------------------ tutorial
var TUT = [
  { txt: 'Metti il pollice <b>sinistro</b> nella metà sinistra e muovilo: <b>← →</b> per curvare.', test: function (s) { return s.steer > 1.4; } },
  { txt: 'Stick <b>↑</b> per andare più veloce, <b>↓</b> per frenare di traverso.', test: function (s) { return s.tuck > 0.6 && s.brake > 0.4; } },
  { txt: 'Pollice <b>destro</b>: tieni premuto per caricare e <b>lascia</b> per saltare. Prova due volte.', test: function (s) { return s.pops >= 2; } },
  { txt: 'Arriva su un <b>kicker</b>: tieni premuto sulla rampa e lascia sul bordo (<b>lip</b>).', test: function (s) { return s.kicks >= 1; } },
  { txt: 'In aria stick <b>← o →</b> per girare (spin). Lascialo per fermarti dritto prima di atterrare.', test: function (s) { return s.spins >= 1; } },
  { txt: 'In aria tocca a destra e <b>trascina</b> per un grab: la direzione sceglie quale. <b>Lascia prima di atterrare.</b>', test: function (s) { return s.grabs >= 1; } },
  { txt: 'In aria stick <b>↑ o ↓</b> per un <b>flip</b>. Serve un kicker grande e un po\' di coraggio.', test: function (s) { return s.flips >= 1; } },
  { txt: 'Arriva <b>dritto e centrato</b> sulla rampetta di un <b>box</b> o di un rail e scivolaci sopra.', test: function (s) { return s.rails >= 1; } },
  { txt: 'Sul rail colpetto di stick <b>← o →</b>: la tavola gira di traverso (boardslide).', test: function (s) { return s.switches >= 1; } },
  { txt: 'A terra trascina a destra <b>↑</b> e tieni: nose press. Con lo stick <b>← →</b> fai un butter.', test: function (s) { return s.butters >= 1; } },
  { txt: 'Fai due trick di fila prima che la barra gialla si svuoti: la <b>combo</b> moltiplica i punti.', test: function (s) { return s.bigBank >= 1; } }
];
function tutStats() { return { steer: 0, tuck: 0, brake: 0, pops: 0, kicks: 0, spins: 0, grabs: 0, flips: 0, rails: 0, switches: 0, butters: 0, bigBank: 0 }; }
function tutUpdate(dt) {
  var T = GAME.tut; if (!T || T.i >= TUT.length) return;
  var s = T.s;
  if (Math.abs(IN.sx) > 0.4 && P.mode === 'ground') s.steer += dt;
  if (P.tuck > 0.5) s.tuck += dt;
  if (P.brake > 0.5) s.brake += dt;
  if (TUT[T.i].test(s)) {
    T.i++; sfx('goal');
    if (T.i >= TUT.length) { hint('<b>Tutorial completato!</b> Ora prova il Free Run.', 5); save.tutDone = true; persist(); popup('Tutorial completato', '', '', 'goal'); }
    else { T.wait = 1.2; T.s = tutStats(); popup('Bravo!', '', '', 'small'); }
  }
  if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) hint(TUT[T.i].txt + '<small>passo ' + (T.i + 1) + ' di ' + TUT.length + '</small>', 999); }
}
function tutEvent(e) {
  var T = GAME.tut; if (!T) return; var s = T.s;
  if (e.t === 'pop') s.pops++;
  if (e.t === 'land' && e.kick) s.kicks++;
  if (e.t === 'land' && e.trick && e.trick.deg >= 180) s.spins++;
  if (e.t === 'land' && e.trick && e.trick.grabs) s.grabs++;
  if (e.t === 'land' && e.trick && e.trick.nf >= 1) s.flips++;
  if (e.t === 'railOn') s.rails++;
  if (e.t === 'railSwitch') s.switches++;
  if (e.t === 'trick' && e.kind === 'butter') s.butters++;
  if (e.t === 'bank' && e.n >= 2) s.bigBank++;
}

// ------------------------------------------------------------ partita
function startRun(mode) {
  show('menu', false); show('pause', false); show('over', false); show('settings', false); show('riderPanel', false); show('guidePanel', false);
  show('hud', true); show('controls', true);
  clearPark(); trailReset(); resetTouch();
  newWorld(1 + Math.floor(Math.random() * 1e9), mode);
  genUntil(760);
  newPlayer(6, 0, 7);
  syncChunks(6, 4);
  comboReset(); EV.length = 0;
  if (rig) rig.rag = null;
  PS.init = false; camInit = false;
  GAME = { mode: mode, score: 0, lives: mode === 'free' ? 3 : 99, tricks: 0, bestCombo: 0, best: { name: '', pts: 0 }, d0: dist(), goals: 0, goalI: 0, goal: null, tut: null, crashWait: 0 };
  $('modeLbl').textContent = mode === 'free' ? 'Free Run' : mode === 'zen' ? 'Zen' : 'Tutorial';
  if (mode === 'tutorial') { GAME.tut = { i: 0, s: tutStats(), wait: 0.6 }; $('goal').classList.add('hidden'); }
  else nextGoal();
  shownScore = 0; state = 'play';
  $('stickHome').style.opacity = '';
  save.runs++; persist();
  sfx('whoosh');
}
function pauseGame() { if (state !== 'play') return; state = 'pause'; resetTouch(); show('pause', true); $('pScore').textContent = fmt(GAME.score); $('pDist').textContent = fmt(dist() - GAME.d0) + ' m'; }
function resumeGame() { if (state !== 'pause') return; show('pause', false); state = 'play'; last = performance.now(); }
function toMenu() {
  show('pause', false); show('over', false); show('hud', false); show('controls', false);
  state = 'menu'; GAME = null; resetTouch(); hintEl.classList.remove('on');
  clearPark(); trailReset();
  newWorld(4242, 'menu'); genUntil(700); newPlayer(7, -2, 0); if (rig) rig.rag = null; PS.init = false;
  refreshMenu(); show('menu', true);
}
function gameOver() {
  state = 'over'; resetTouch();
  // la combo in corso, se c'e', si incassa comunque
  var dd = Math.round(dist() - GAME.d0), rec = false;
  if (GAME.mode === 'free' && GAME.score > save.best) { save.best = GAME.score; rec = true; }
  if (GAME.mode === 'zen' && GAME.score > save.bestZen) { save.bestZen = GAME.score; rec = true; }
  save.bestDist = Math.max(save.bestDist, dd); save.totalTricks += GAME.tricks; persist();
  $('oScore').textContent = fmt(GAME.score); $('oDist').textContent = fmt(dd) + ' m'; $('oCombo').textContent = fmt(GAME.bestCombo);
  $('oTricks').textContent = GAME.tricks; $('oBest').textContent = GAME.best.name || '—';
  $('overBadge').innerHTML = rec ? '<span class="badge">Nuovo record</span>' : '';
  $('overTitle').textContent = GAME.mode === 'free' ? 'Tavole finite' : 'Fine della corsa';
  show('controls', false); show('over', true);
}

// ------------------------------------------------------------ eventi della fisica
var CRASH_TXT = { wall: 'Contro il bordo', tree: 'Contro un albero', rock: 'Contro una roccia', railhit: 'Hai preso il rail', railtip: 'Punta sul rail', railhead: 'Storto sul rail', head: 'Sulla testa', tilt: 'Atterraggio storto', sideways: 'Di traverso', hard: 'Atterraggio troppo duro', grab: 'Grab ancora in mano' };
function handleEvents() {
  for (var i = 0; i < EV.length; i++) {
    var e = EV[i];
    if (GAME) { goalEvent(e); tutEvent(e); }
    switch (e.t) {
      case 'pop': sfx('pop'); burst(P.x, P.y, P.z, 10, 1.4, 1.2, 0.18); if (e.perfect) popup('Pop!', '', '', 'small'); break;
      case 'grab': sfx('grab'); break;
      case 'land': {
        var imp = clamp(e.impact / 9, 0.2, 1);
        sfx('land', imp); camShake = Math.max(camShake, 0.04 + imp * 0.12);
        burst(P.x, P.y, P.z, 14 + Math.round(imp * 26), 2 + imp * 3, 1.6 + imp, 0.26);
        if (e.trick) {
          popup(e.trick.name, '+' + fmt(e.pts) + (e.rep ? ' · ripetuto' : ''), e.q);
          sfx(e.q === 'perfect' ? 'perfect' : 'trick');
          if (GAME) { GAME.tricks++; if (e.pts > GAME.best.pts) GAME.best = { name: e.trick.name, pts: e.pts }; }
        } else if (e.q === 'sketchy') popup('Sporco', '', '', 'small');
        trailGap();
        break;
      }
      case 'trick': popup(e.name, '+' + fmt(e.pts), '', 'small'); sfx('trick'); if (GAME) { GAME.tricks++; if (e.pts > GAME.best.pts) GAME.best = { name: e.name, pts: e.pts }; } break;
      case 'railOn': sfx(e.kind === 'box' ? 'box' : 'rail'); popup(e.name, '', '', 'small'); burst(P.x, P.y, P.z, 8, 1, 0.8, 0.14); if (GAME && GAME.mode !== 'tutorial' && !save.railHint) { hint('Sul rail: stick <b>← →</b> cambia trick, trascina a destra <b>↑ ↓</b> per un press, tocca per saltare via.', 4); save.railHint = 1; } break;
      case 'railSwitch': sfx('switch'); popup(e.name, '', '', 'small'); break;
      case 'sketch': popup('Sbilanciato', '', '', 'small'); break;
      case 'bank':
        if (GAME) { GAME.score += e.pts; GAME.bestCombo = Math.max(GAME.bestCombo, e.pts); if (e.pts > save.bestCombo) save.bestCombo = e.pts; }
        if (e.n > 1 || e.pts > 600) { popup('+' + fmt(e.pts), e.n > 1 ? 'combo × ' + e.mult : '', '', 'bank'); sfx('bank'); }
        break;
      case 'lost': popup('Combo persa', '−' + fmt(e.pts), '', 'lost'); sfx('lost'); break;
      case 'crash':
        sfx('crash'); camShake = 0.35; flashA = 0.35;
        if (rig) startRagdoll(e.vx, e.vy, e.vz);
        burst(P.x, P.y, P.z, 40, 3.5, 2.4, 0.3);
        if (GAME) { GAME.lives -= GAME.mode === 'free' ? 1 : 0; GAME.crashWait = 2.3; }
        popup('Caduta', CRASH_TXT[e.why] || '', '', 'lost');
        trailGap();
        break;
      case 'respawn': if (rig) rig.rag = null; PS.init = false; trailGap(); break;
    }
  }
  EV.length = 0;
}
function trailGap() { trLast = null; }

// ------------------------------------------------------------ effetti a terra: neve sollevata e tracce
var _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), trailD = 0, sprayAcc = 0;
function updEffects(dt) {
  if (!P) return;
  var sp = speedOf();
  if (P.mode === 'ground') {
    _e1.set(1, 0, 0).applyQuaternion(P.q); _e2.set(0, 0, 1).applyQuaternion(P.q);
    var edge = Math.abs(P.steer) * 0.6 + P.brake * 1.4 + Math.abs(Math.sin(P.yawOff)) * 1.2 + (P.scrub || 0) + (P.butter ? 0.5 : 0);
    sprayAcc += dt * sp * (0.4 + edge * 3.2);
    var side = P.steer >= 0 ? -1 : 1; if (P.brake) side = -sign(P.yawOff || 1);
    while (sprayAcc > 1) {
      sprayAcc -= 1;
      var o = (Math.random() - 0.5) * 1.1, px = P.x + _e1.x * o + _e2.x * side * 0.16, pz = P.z + _e1.z * o + _e2.z * side * 0.16;
      var out = 0.5 + edge * 2.2;
      part(px, P.y + 0.04, pz, _e2.x * side * out + P.vx * 0.25 + (Math.random() - 0.5), 0.6 + Math.random() * (0.8 + edge), _e2.z * side * out + P.vz * 0.25 + (Math.random() - 0.5), 0.45 + Math.random() * 0.5, 0.12 + edge * 0.1 + Math.random() * 0.1, 0.75);
    }
    trailD += sp * dt;
    if (trailD > 0.35) {
      trailD = 0;
      var w = 0.13 + Math.abs(Math.sin(P.yawOff)) * 0.5;
      _e2.set(0, 0, 1).applyQuaternion(P.q);
      if (!trLast) trailAdd(P.x, P.y + 0.025, P.z, _e2.x, _e2.z, w, false);
      trailAdd(P.x, P.y + 0.025, P.z, _e2.x, _e2.z, w, true);
      trLast = 1;
    }
  } else trLast = null;
  if (P.mode === 'rail' && Math.random() < dt * 20) part(P.x, P.y, P.z, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.3, 0.08, 0.7);
}

// ------------------------------------------------------------ cerchio d'atterraggio e puntino sul rail
var _lp = { x: 0, y: 0, z: 0, t: 0, n: new THREE.Vector3() }, _rp2 = {};
function updAids(dt) {
  var on = save.set.hud && P && P.mode === 'air' && P.air && P.air.t > 0.08 && P.air.tLand > 0.15;
  landRing.material.opacity = lerp(landRing.material.opacity, on ? 0.75 : 0, damp(10, dt));
  railMark.material.opacity = 0;
  if (!on) return;
  var A = P.air;
  landRing.position.set(A.landX, A.landY + 0.05, A.landZ);
  landRing.quaternion.setFromUnitVectors(AY, A.landN);
  // colore: come atterreresti se toccassi adesso
  var e = airOrientationError(A.landN), lim = save.set.assist === 2 ? 62 : save.set.assist === 1 ? 52 : 42;
  var bad = e.tilt / DEG > lim || e.yaw / DEG > lim + 2 || (A.grab >= 0 && A.tLand < 0.35), ok = e.tilt / DEG < 18 && e.yaw / DEG < 14 && A.grab < 0;
  landRing.material.color.set(bad ? 0xff4d5e : ok ? 0x4fe6b4 : 0xffcf3f);
  // traiettoria che passa sopra un rail con la tavola dentro la zona buona
  var x = P.x, y = P.y, z = P.z, vx = P.vx, vy = P.vy, vz = P.vz, py = y;
  for (var i = 0; i < 70; i++) {
    var st = 0.02; vy -= G * st; x += vx * st; y += vy * st; z += vz * st;
    var list = railsNear(-z);
    for (var j = 0; j < list.length; j++) {
      var r = list[j], pr = railProject(r, x, z, _rp2);
      if (!pr.over || pr.s < 0 || pr.s > r.len - 0.4) continue;
      if (py >= pr.y - 0.03 && y <= pr.y + 0.04 && vy < 0.6) {
        var nose = noseOf(P.q, _e1); nose.y = 0; nose.normalize();
        var phi = yawToRail(nose, pr.hx, pr.hz), good = Math.abs(pr.w) < railCapture(r, phi);
        railMark.position.set(x + pr.w * 0, pr.y + 0.06, z);
        railMark.material.color.set(good ? 0x4fe6b4 : 0xff4d5e);
        railMark.material.opacity = 0.95;
        return;
      }
    }
    py = y;
    if (y < groundH(x, z)) break;
  }
}

// ------------------------------------------------------------ camera
var _cv = new THREE.Vector3(), _cw = new THREE.Vector3();
function updCamera(dt) {
  var portrait = VH > VW;
  if (window.__camFn) { window.__camFn(camera, P, rig); camera.updateProjectionMatrix(); return; }
  if (state === 'menu' || state === 'loading') {
    MENU_CAM.a += dt * 0.07;
    var hb = rig ? rig.B.Hips.getWorldPosition(_cv) : _cv.set(P.x, P.y + 1, P.z);
    var r = MENU_CAM.close ? 3.0 : 5.4, h = MENU_CAM.close ? 0.5 : 1.0;
    var a = MENU_CAM.close ? 2.6 + Math.sin(MENU_CAM.a * 2) * 0.35 : MENU_CAM.a;
    _cw.set(hb.x + Math.sin(a) * r, hb.y + h, hb.z + Math.cos(a) * r);
    camPos.lerp(_cw, camInit ? damp(3, dt) : 1);
    // il rider sta nella parte destra dello schermo, a sinistra c'e' il menu
    var rx = Math.cos(a), rz = -Math.sin(a), sh = portrait ? 0 : (MENU_CAM.close ? 0.75 : 1.6);
    camLook.lerp(_cv.set(hb.x - rx * sh, hb.y + (MENU_CAM.close ? 0.05 : 0.0) - (portrait ? 0.6 : 0), hb.z - rz * sh), camInit ? damp(3, dt) : 1);
    camera.fov = MENU_CAM.close ? 42 : 55; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(camLook); camInit = true;
    return;
  }
  var tx = P.x, ty = P.y, tz = P.z;
  if (P.mode === 'crash' && rig && rig.rag) { var hp = rig.rag.p.Hips; tx = hp.x; ty = hp.y - 0.6; tz = hp.z; }
  var sp = Math.hypot(P.vx, P.vz), air = P.mode === 'air';
  if (sp > 1.2 && P.mode !== 'crash') { var hd = Math.atan2(P.vx, -P.vz); camHd += wrapA(hd - camHd) * damp(air ? 1.6 : 3.2, dt); }
  if (!camInit) { camHd = Math.atan2(P.vx, -P.vz) || 0; camY = ty; }
  camY = lerp(camY, ty, damp(air ? 3 : 7, dt));
  var dist = (portrait ? 6.6 : 5.0) + Math.min(sp, 25) * 0.05 + (air ? 0.8 : 0) + (P.mode === 'crash' ? 1.5 : 0) + save.set.cam * 0;
  var hgt = (portrait ? 2.5 : 1.95) + (air ? 0.5 : 0);
  var fx = Math.sin(camHd), fz = -Math.cos(camHd);
  _cw.set(tx - fx * dist, camY + hgt, tz - fz * dist);
  var gh = groundH(_cw.x, _cw.z) + 0.9; if (_cw.y < gh) _cw.y = gh;
  // niente camera dentro gli alberi: se un tronco o una chioma e' tra il rider e la camera, ci si avvicina
  var bestK = 1;
  solidsNear(_cw.x, _cw.z, 5, function (o, rad, kind) {
    var ax = _cw.x - tx, az = _cw.z - tz, L2 = ax * ax + az * az || 1, t = clamp(((o.x - tx) * ax + (o.z - tz) * az) / L2, 0, 1);
    var px = tx + ax * t - o.x, pz = tz + az * t - o.z, rr = kind === 'tree' ? 1.5 * o.s : rad + 0.5;
    if (px * px + pz * pz < rr * rr && t > 0.15) bestK = Math.min(bestK, Math.max(0.35, t - 0.12));
  });
  if (bestK < 1) { _cw.x = tx + (_cw.x - tx) * bestK; _cw.z = tz + (_cw.z - tz) * bestK; _cw.y = Math.max(_cw.y, camY + hgt * 0.8); }
  if (!camInit) { camPos.copy(_cw); camInit = true; }
  camPos.x = lerp(camPos.x, _cw.x, damp(7, dt)); camPos.z = lerp(camPos.z, _cw.z, damp(7, dt)); camPos.y = lerp(camPos.y, _cw.y, damp(5, dt));
  if (camPos.y < gh) camPos.y = gh;
  camLook.set(tx + fx * 4.5, camY + 0.55, tz + fz * 4.5);
  camera.position.copy(camPos);
  if (camShake > 0) { camShake = Math.max(0, camShake - dt * 1.2); camera.position.x += (Math.random() - 0.5) * camShake; camera.position.y += (Math.random() - 0.5) * camShake; }
  camera.lookAt(camLook);
  var fov = (portrait ? 70 : 58) + clamp((sp - 8) * 0.55, 0, 13);
  camera.fov = lerp(camera.fov, fov, damp(3, dt)); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------ sole e ombre che seguono il rider (con aggancio ai texel: niente tremolio)
var _sl = new THREE.Vector3(), _sr = new THREE.Vector3(), _su = new THREE.Vector3(), _sc = new THREE.Vector3();
function updSun() {
  var c = _sc.set(P.x, P.y, P.z);
  _sr.crossVectors(sunDir, AY).normalize(); _su.crossVectors(_sr, sunDir).normalize();
  var tex = SH * 2 / quality.shadow, a = Math.round(c.dot(_sr) / tex) * tex, b = Math.round(c.dot(_su) / tex) * tex, d = c.dot(sunDir);
  c.copy(_sr).multiplyScalar(a).addScaledVector(_su, b).addScaledVector(sunDir, d);
  sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sunDir, 120);
  sun.target.updateMatrixWorld();
}

// ------------------------------------------------------------ prestazioni: risoluzione automatica
var perf = { acc: 0, n: 0, goodT: 0, lastChange: 0 };
function updPerf(dt) {
  if (!quality.auto || state !== 'play') return;
  perf.acc += dt; perf.n++;
  if (perf.n >= 90) {
    var avg = perf.acc / perf.n * 1000; perf.acc = 0; perf.n = 0;
    if (avg > 21 && quality.level > 0 && gtime - perf.lastChange > 3) { setQuality(quality.level - 1); perf.lastChange = gtime; toast('Qualità adattata al telefono'); }
    else if (avg < 12.5 && quality.level < 2) { perf.goodT += 1.5; if (perf.goodT > 20 && gtime - perf.lastChange > 30) { setQuality(quality.level + 1); perf.lastChange = gtime; perf.goodT = 0; } }
  }
}

// ------------------------------------------------------------ fotogramma
var PROF = { on: false };
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now; gtime += dt;
  var _pt = PROF.on ? performance.now() : 0;
  if (state === 'play') {
    readKeys();
    acc += dt; var n = 0;
    while (acc >= DT && n < 10) { stepPlayer(DT); acc -= DT; n++; }
    if (n >= 10) acc = 0;
    handleEvents();
    if (P.mode === 'crash' && GAME.crashWait > 0) {
      GAME.crashWait -= dt;
      if (GAME.crashWait <= 0) {
        if (GAME.mode === 'free' && GAME.lives <= 0) gameOver();
        else { flashA = 0.6; respawn(); handleEvents(); camInit = false; }
      }
    }
    if (GAME && GAME.goal && GAME.goal.done) { GAME.goal.t -= dt; if (GAME.goal.t <= 0) nextGoal(); }
    if (GAME && GAME.tut) tutUpdate(dt);
    updHud(dt);
  } else if (state === 'over' && P && P.mode === 'crash') { /* il ragdoll continua */ }
  if (PROF.on) { var _n = performance.now(); PROF['play'] = (PROF['play'] || 0) + _n - _pt; _pt = _n; }
  var dC = P ? dist() : 0;
  genUntil(dC + 760);
  syncChunks(dC);
  syncPark(dC);
  if (W.pd > 2000 && ((gtime * 10) | 0) % 50 === 0) pruneWorld(dC - 180);
  if (PROF.on) { var _n = performance.now(); PROF['stream'] = (PROF['stream'] || 0) + _n - _pt; _pt = _n; }
  updLift(dC, gtime);
  if (PROF.on) { var _n = performance.now(); PROF['lift'] = (PROF['lift'] || 0) + _n - _pt; _pt = _n; }
  if (rig) { rig.t += dt; if (state === 'menu') poseIdle(dt); else poseRider(dt, P.mode); }
  if (PROF.on) { var _n = performance.now(); PROF['pose'] = (PROF['pose'] || 0) + _n - _pt; _pt = _n; }
  updEffects(state === 'play' ? dt : 0);
  updParticles(dt);
  updAids(dt);
  if (PROF.on) { var _n = performance.now(); PROF['fx'] = (PROF['fx'] || 0) + _n - _pt; _pt = _n; }
  updCamera(dt);
  updSun();
  if (PROF.on) { var _n = performance.now(); PROF['cam'] = (PROF['cam'] || 0) + _n - _pt; _pt = _n; }
  sky.position.copy(camera.position);
  if (mountains) mountains.position.set(camera.position.x, camera.position.y - 40, camera.position.z);
  clouds.position.set(camera.position.x, camera.position.y + 950, camera.position.z);
  cloudMat.uniforms.uOff.value.x += dt * 0.0015; cloudMat.uniforms.uOff.value.y += dt * 0.0006;
  updFlakes(dt, camera.position, LT.snowfall, gtime);
  pMat.uniforms.uScale.value = VH * 0.5 / Math.tan(camera.fov * DEG / 2) * 0.9;
  if (flashA > 0) { flashA = Math.max(0, flashA - dt * 1.4); }
  flashEl.style.opacity = flashA;
  updateAudio(dt, state === 'play');
  if (AU && state !== 'loading') musicTick();
  if (PROF.on) { var _n = performance.now(); PROF['misc'] = (PROF['misc'] || 0) + _n - _pt; _pt = _n; }
  renderer.render(scene, camera);
  if (PROF.on) { var _n = performance.now(); PROF['render'] = (PROF['render'] || 0) + _n - _pt; _pt = _n; }
  updPerf(dt);
  if (PROF.on) PROF.frames = (PROF.frames || 0) + 1;
}

// ------------------------------------------------------------ avvio
function warmup() {
  var tmp = new THREE.Group(), w = newWorldPreview();
  scene.add(tmp);
  w.forEach(function (o) { tmp.add(o); });
  landRing.material.opacity = 0.01; railMark.material.opacity = 0.01;
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  scene.remove(tmp);
  tmp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
}
// un esemplare di ogni oggetto del park, vicino alla camera, per compilare i materiali
function newWorldPreview() {
  var out = [], d = 30;
  var f = { t: 'kick', d0: d, d1: d + 20, u: 0, hw: 2, k: 1.25, off: new Float32Array([0, 0.2, 0.4, 0.5, 0.5, 0.4, 0.2, 0]), K: { sLip: 0.75, sKn: 1.2, sJoin: 1.6 }, size: 'M', dLip: d + 0.75, dKn: d + 1.2, iLip: 3, tag: 'big' };
  try { out.push(buildKick(f)); } catch (e) {}
  ['rail', 'box'].forEach(function (k, i) {
    var r = { kind: k, hw: k === 'box' ? 0.27 : 0.035, col: i, pts: [{ x: -3 + i * 6, y: profY(d) + 0.5, z: -d, h: 0.5 }, { x: -3 + i * 6, y: profY(d + 6) + 0.5, z: -d - 6, h: 0.5 }] };
    r.segs = [{ a: r.pts[0], b: r.pts[1], s0: 0, len: 6, dx: 0, dy: (r.pts[1].y - r.pts[0].y) / 6, dz: -1 }]; r.len = 6;
    try { out.push(buildRail(r)); } catch (e) {}
  });
  out.forEach(function (o) { o.traverse(function (c) { c.frustumCulled = false; }); });
  return out;
}
function boot() {
  resize();
  applyLight(save.set.light);
  quality.auto = save.set.quality === 'auto';
  setQuality(quality.auto ? 2 : +save.set.quality);
  newWorld(4242, 'menu'); genUntil(700); newPlayer(7, -2, 0);
  try {
    var buf = b64ToBuf(window.RIDER_B64);
    makeRig(buf).buf = buf;
  } catch (err) { console.error(err); }
  // primo fotogramma per compilare gli shader, poi via il caricamento
  syncChunks(0, 99); syncPark(0);
  // si compilano subito tutti i materiali (anche quelli che compaiono piu' avanti), cosi' in partita non ci sono scatti
  warmup();
  state = 'menu'; refreshMenu(); show('menu', true);
  $('rotate').classList.toggle('hidden', false);
  setTimeout(function () { $('rotate').classList.add('hidden'); }, 6000);
  setTimeout(function () { $('loading').classList.add('hidden'); }, 60);
  last = performance.now();
  requestAnimationFrame(frame);
}
// per i test automatici
window.__pr = {
  get P() { return P; }, get W() { return W; }, get GAME() { return GAME; }, get state() { return state; }, IN: IN, save: save,
  start: function (m) { startRun(m || 'free'); }, menu: toMenu, CB: function () { return CB; }, camera: camera, renderer: renderer, quality: quality,
  setQuality: setQuality, applyLight: applyLight, rig: function () { return rig; }, step: stepPlayer, events: function () { return EV; },
  scene: scene, prof: PROF,
  place: function (d, u, sp) { newPlayer(d, u || 0, sp || 0); P.safeT = 0; camInit = false; PS.init = false; if (rig) rig.rag = null; trailReset(); },
  cx: cx, profY: profY, railCapture: railCapture, crash: function (w) { crash(w || 'tilt'); }, THREE: THREE, groundH: groundH, poseRider: poseRider, updAids: updAids, syncChunks: syncChunks, syncPark: syncPark, updEffects: updEffects, updHud: updHud, updParticles: updParticles, updLift: updLift, updFlakes: updFlakes
};
setTimeout(boot, 30);
