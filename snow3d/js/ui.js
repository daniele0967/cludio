// ============================================================ COMANDI E INTERFACCIA
// Pollice sinistro: stick che appare dove tocchi (sterzo; in aria spin e flip; sul rail cambio trick).
// Pollice destro: tieni = carica il salto, lascia = salta. In aria tocca e trascina = grab (la direzione sceglie quale).
// A terra o sul rail trascina su/giu' = nose press / tail press (con lo stick a terra diventa un butter).
var TOUCH = { stick: null, sx0: 0, sy0: 0, act: null, ax0: 0, ay0: 0, mode: null };
var keys = { l: 0, r: 0, u: 0, d: 0 };
var stickEl = $('stickBase'), knobEl = $('stickKnob'), compassEl = $('compass'), actEl = $('act'), chgEl = $('chg'), actLbl = $('actLbl');
var STICK_R = 58;

// otto direzioni per i grab: 0 = su, in senso orario. Per i goofy destra e sinistra si scambiano
function grabSector(dx, dy) {
  if (stanceSign() < 0) dx = -dx;
  var a = Math.atan2(dx, -dy);
  return ((Math.round(a / (PI / 4)) % 8) + 8) % 8;
}
(function buildCompass() {
  for (var i = 0; i < 8; i++) {
    var e = document.createElement('div'); e.className = 'g'; e.dataset.i = i;
    compassEl.appendChild(e);
  }
})();
function placeCompass(x, y) {
  compassEl.style.left = x + 'px'; compassEl.style.top = y + 'px';
  var gs = compassEl.querySelectorAll('.g'), ss = stanceSign();
  gs.forEach(function (e, i) {
    var a = i * PI / 4, dx = Math.sin(a) * 78 * ss, dy = -Math.cos(a) * 78;
    e.style.left = (100 + dx) + 'px'; e.style.top = (100 + dy) + 'px'; e.textContent = GRABS[i].name.replace(' Grab', '');
  });
}
function showGrabSel(i) { compassEl.querySelectorAll('.g').forEach(function (e) { e.classList.toggle('sel', +e.dataset.i === i); }); }

function touchStart(e) {
  if (state !== 'play') return;
  e.preventDefault(); ensureAudio();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i], x = t.clientX, y = t.clientY;
    if (x < VW * 0.5 && TOUCH.stick === null) {
      TOUCH.stick = t.identifier; TOUCH.sx0 = x; TOUCH.sy0 = y;
      stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.classList.add('on'); knobEl.style.transform = '';
      $('stickHome').style.opacity = 0;
    } else if (x >= VW * 0.5 && TOUCH.act === null) {
      TOUCH.act = t.identifier; TOUCH.ax0 = x; TOUCH.ay0 = y;
      actStart(x, y);
    }
  }
}
function actStart(x, y) {
  if (P.mode === 'air') { TOUCH.mode = 'grab'; IN.grab = GRAB_CENTER; IN.jump = false; placeCompass(x, y); compassEl.classList.add('on'); showGrabSel(IN.grab); }
  else if (P.mode === 'crash') { TOUCH.mode = 'none'; }
  else { TOUCH.mode = 'jump'; IN.jump = true; IN.press = 0; }
}
function touchMove(e) {
  if (state !== 'play') return;
  e.preventDefault();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i], x = t.clientX, y = t.clientY;
    if (t.identifier === TOUCH.stick) {
      var dx = x - TOUCH.sx0, dy = y - TOUCH.sy0, d = Math.hypot(dx, dy), R = STICK_R;
      if (d > R * 1.25) { TOUCH.sx0 = x - dx / d * R * 1.25; TOUCH.sy0 = y - dy / d * R * 1.25; stickEl.style.left = TOUCH.sx0 + 'px'; stickEl.style.top = TOUCH.sy0 + 'px'; dx = x - TOUCH.sx0; dy = y - TOUCH.sy0; d = R * 1.25; }
      var kx = clamp(dx / R, -1, 1), ky = clamp(-dy / R, -1, 1);
      var m = Math.hypot(kx, ky), dz = 0.1;
      if (m < dz) { kx = 0; ky = 0; } else { var s = Math.min(1, (m - dz) / (1 - dz)) / m; kx *= s; ky *= s; }
      IN.sx = kx; IN.sy = ky;
      knobEl.style.transform = 'translate(' + clamp(dx, -R, R) + 'px,' + clamp(dy, -R, R) + 'px)';
    } else if (t.identifier === TOUCH.act) {
      var ax = x - TOUCH.ax0, ay = y - TOUCH.ay0, ad = Math.hypot(ax, ay);
      if (TOUCH.mode === 'grab') { if (ad > 22) { IN.grab = grabSector(ax, ay); showGrabSel(IN.grab); } }
      else if (TOUCH.mode === 'jump') {
        if (P.mode === 'air' && ad > 28) {
          // tenuto oltre il lip e poi trascinato: diventa un grab
          TOUCH.mode = 'grab'; IN.jump = false; if (P.air) P.air.hold = false;
          IN.grab = grabSector(ax, ay); placeCompass(TOUCH.ax0, TOUCH.ay0); compassEl.classList.add('on'); showGrabSel(IN.grab);
        } else if (P.mode !== 'air' && Math.abs(ay) > 30 && Math.abs(ay) > Math.abs(ax) * 1.2) {
          TOUCH.mode = 'press'; IN.jump = false; IN.cancel = true; IN.press = ay < 0 ? 1 : -1;
        }
      } else if (TOUCH.mode === 'press') {
        if (Math.abs(ay) > 18) IN.press = ay < 0 ? 1 : -1;
        if (P.mode === 'air') { IN.press = 0; TOUCH.mode = 'grab'; IN.grab = grabSector(ax, ay); placeCompass(TOUCH.ax0, TOUCH.ay0); compassEl.classList.add('on'); }
      }
    }
  }
}
function touchEnd(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    if (t.identifier === TOUCH.stick) { TOUCH.stick = null; IN.sx = 0; IN.sy = 0; stickEl.classList.remove('on'); }
    else if (t.identifier === TOUCH.act) { TOUCH.act = null; IN.jump = false; IN.grab = -1; IN.press = 0; TOUCH.mode = null; compassEl.classList.remove('on'); }
  }
}
function resetTouch() {
  TOUCH.stick = TOUCH.act = null; TOUCH.mode = null; IN.sx = IN.sy = 0; IN.jump = false; IN.grab = -1; IN.press = 0;
  stickEl.classList.remove('on'); compassEl.classList.remove('on');
}
canvas.addEventListener('touchstart', touchStart, { passive: false });
['controls', 'hud'].forEach(function (id) { $(id).addEventListener('touchstart', function (e) { if (e.target.closest('button')) return; touchStart(e); }, { passive: false }); });
window.addEventListener('touchmove', touchMove, { passive: false });
window.addEventListener('touchend', touchEnd);
window.addEventListener('touchcancel', touchEnd);
// mouse (per provare sul computer): il tasto sinistro a destra dello schermo fa da pollice destro
canvas.addEventListener('mousedown', function (e) {
  if (state !== 'play' || e.clientX < VW * 0.5) return;
  ensureAudio(); TOUCH.act = 'm'; TOUCH.ax0 = e.clientX; TOUCH.ay0 = e.clientY; actStart(e.clientX, e.clientY);
});
window.addEventListener('mousemove', function (e) { if (TOUCH.act === 'm') touchMove({ preventDefault: function () {}, changedTouches: [{ identifier: 'm', clientX: e.clientX, clientY: e.clientY }] }); });
window.addEventListener('mouseup', function (e) { if (TOUCH.act === 'm') touchEnd({ changedTouches: [{ identifier: 'm' }] }); });

// tastiera: frecce/WASD = stick, Spazio = salto, 1-8 = grab, R/F = press, P = pausa
var KEYGRAB = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, KeyE: 2, KeyQ: 6 };
window.addEventListener('keydown', function (e) {
  if (e.repeat) return;
  var c = e.code;
  if (c === 'KeyP' || c === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'play') return;
  ensureAudio();
  if (c === 'ArrowLeft' || c === 'KeyA') keys.l = 1;
  if (c === 'ArrowRight' || c === 'KeyD') keys.r = 1;
  if (c === 'ArrowUp' || c === 'KeyW') keys.u = 1;
  if (c === 'ArrowDown' || c === 'KeyS') keys.d = 1;
  if (c === 'Space') { IN.jump = true; e.preventDefault(); }
  if (c in KEYGRAB) IN.grab = KEYGRAB[c];
  if (c === 'KeyR') IN.press = 1;
  if (c === 'KeyF') IN.press = -1;
});
window.addEventListener('keyup', function (e) {
  var c = e.code;
  if (c === 'ArrowLeft' || c === 'KeyA') keys.l = 0;
  if (c === 'ArrowRight' || c === 'KeyD') keys.r = 0;
  if (c === 'ArrowUp' || c === 'KeyW') keys.u = 0;
  if (c === 'ArrowDown' || c === 'KeyS') keys.d = 0;
  if (c === 'Space') IN.jump = false;
  if (c in KEYGRAB && IN.grab === KEYGRAB[c]) IN.grab = -1;
  if (c === 'KeyR' || c === 'KeyF') IN.press = 0;
});
function readKeys() {
  if (TOUCH.stick === null && (keys.l || keys.r || keys.u || keys.d)) { IN.sx = keys.r - keys.l; IN.sy = keys.u - keys.d; }
  else if (TOUCH.stick === null && !window.__bot) { IN.sx = 0; IN.sy = 0; }
}

// ------------------------------------------------------------ scritte dei trick
var popsEl = $('pops');
function popup(title, sub, q, cls) {
  var e = document.createElement('div');
  e.className = 'pop' + (cls ? ' ' + cls : '');
  var h = '<div class="t">' + title + '</div>';
  if (sub) h += '<div class="s">' + sub + '</div>';
  if (q) h += '<div class="q ' + q + '">' + ({ perfect: 'Perfetto', clean: 'Pulito', sketchy: 'Sporco' }[q] || q) + '</div>';
  e.innerHTML = h;
  popsEl.appendChild(e);
  while (popsEl.children.length > 3) popsEl.removeChild(popsEl.firstChild);
  setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1900);
}
var hintEl = $('hint'), hintT = 0;
function hint(html, sec) { hintEl.innerHTML = html; hintEl.classList.add('on'); hintT = sec || 4; }
function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(function () { e.classList.remove('on'); }, 1800); }

// ------------------------------------------------------------ HUD
var shownScore = 0;
function updHud(dt) {
  if (!GAME) return;
  shownScore += (GAME.score - shownScore) * damp(8, dt);
  if (Math.abs(GAME.score - shownScore) < 1) shownScore = GAME.score;
  $('score').textContent = fmt(shownScore);
  $('spd').textContent = Math.round(speedOf() * 3.6);
  $('dst').textContent = fmt(Math.max(0, dist() - GAME.d0)) + ' m';
  var cb = $('comboBox');
  if (CB.live && CB.parts.length) {
    cb.classList.add('on');
    $('comboVal').innerHTML = fmt(CB.pts) + '<small>× ' + comboMult() + '</small>';
    var busy = P.mode === 'air' || P.mode === 'rail' || !!P.butter;
    $('comboT').style.transform = 'scaleX(' + (busy ? 1 : clamp(CB.timer / BANK_TIME, 0, 1)) + ')';
    $('comboList').textContent = CB.parts.slice(-4).map(function (p) { return p.name; }).join('  +  ');
  } else cb.classList.remove('on');
  // tasto destro: cosa fa adesso
  var lbl = 'Salta', sm = 'tieni e lascia', hot = false;
  if (P.mode === 'air') { lbl = 'Grab'; sm = 'tocca e trascina'; hot = IN.grab >= 0; }
  else if (P.mode === 'rail') { lbl = 'Pop'; sm = '↑↓ press'; }
  else if (P.butter) { lbl = P.butter.press > 0 ? 'Nose' : 'Tail'; sm = 'stick = butter'; hot = true; }
  else if (P.lipD !== null && P.lipD < 6) { lbl = 'Lip!'; sm = 'lascia sul bordo'; hot = P.charge > 0; }
  if (actLbl._l !== lbl + sm) { actLbl.innerHTML = lbl + '<small>' + sm + '</small>'; actLbl._l = lbl + sm; }
  actEl.classList.toggle('hot', hot || P.charge > 0);
  chgEl.style.strokeDashoffset = 327 * (1 - P.charge);
  $('railBal').classList.toggle('on', P.mode === 'rail' && GAME.mode === 'tutorial');
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.classList.remove('on'); }
  var lv = $('lives');
  if (lv._n !== GAME.lives) {
    lv._n = GAME.lives;
    lv.innerHTML = GAME.mode === 'free' ? [0, 1, 2].map(function (i) { return '<i class="' + (i < GAME.lives ? '' : 'off') + '"></i>'; }).join('') : '';
  }
  $('speedfx').style.opacity = POST.on ? 0 : clamp((speedOf() - 17) / 10, 0, 0.8);
  $('vig').style.opacity = POST.on ? 0 : 1;
}

// ------------------------------------------------------------ menu e schede
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function refreshMenu() {
  $('recFree').textContent = save.best ? fmt(save.best) : '—';
  $('recZen').textContent = save.bestZen ? fmt(save.bestZen) : '—';
  $('tutState').textContent = save.tutDone ? 'fatto' : 'consigliato';
  $('menuRec').textContent = save.best ? 'Record Free Run: ' + fmt(save.best) + ' · combo migliore ' + fmt(save.bestCombo) : 'Prima volta? Prova il Tutorial: due minuti e sai fare tutto.';
}
document.querySelectorAll('.mode').forEach(function (b) { b.addEventListener('click', function () { ensureAudio(); sfx('click'); startRun(b.dataset.mode); }); });
$('btnPause').addEventListener('click', function () { pauseGame(); });
$('btnCam').addEventListener('click', function () { save.set.camMode = ((save.set.camMode || 0) + 1) % CAMS.length; toast('Camera: ' + CAMS[save.set.camMode].name); persist(); });
$('btnReplay').addEventListener('click', function () { startReplay(); });
$('replayBar').addEventListener('click', function () { endReplay(); });
$('btnPReplay').addEventListener('click', function () { if (!REP.avail) { toast('Fai prima un bel trick'); return; } resumeGame(); startReplay(); });
$('btnResume').addEventListener('click', function () { resumeGame(); });
$('btnRestart').addEventListener('click', function () { startRun(GAME.mode); });
$('btnQuit').addEventListener('click', function () { toMenu(); });
$('btnAgain').addEventListener('click', function () { startRun(GAME.mode); });
$('btnOverMenu').addEventListener('click', function () { toMenu(); });
var setReturn = 'menu';
function openSettings(from) { setReturn = from; show('settings', true); show(from === 'pause' ? 'pause' : 'menu', false); syncSettings(); }
$('btnSet').addEventListener('click', function () { sfx('click'); openSettings('menu'); });
$('btnPSet').addEventListener('click', function () { openSettings('pause'); });
$('btnSetClose').addEventListener('click', function () { show('settings', false); show(setReturn === 'pause' ? 'pause' : 'menu', true); persist(); });
function syncSettings() {
  document.querySelectorAll('#settings .seg').forEach(function (seg) {
    var k = seg.dataset.k, v = String(save.set[k]);
    seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
  });
  $('sens').value = save.set.sens; $('sensV').textContent = Math.round(save.set.sens * 100) + '%';
  $('diagTxt').textContent = 'WebGL ' + DIAG.gl + ' · terreno: ' + (DIAG.ground || '?') + ' · neve: ' + DIAG.snow + ' · effetti: ' + DIAG.post + ' · qualità ' + quality.level + ' (' + quality.pr.toFixed(1) + 'x)' +
    (DIAG.errors.length ? '\nErrori:\n' + DIAG.errors.slice(-4).join('\n') : '\nNessun errore');
}
document.querySelectorAll('#settings .seg').forEach(function (seg) {
  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var k = seg.dataset.k, v = b.dataset.v;
    if (v === 'true' || v === 'false') v = v === 'true';
    else if (k === 'assist') v = +v;
    else if (k === 'quality' && v !== 'auto') v = +v;
    var old = save.set[k]; save.set[k] = v;
    if (k === 'light') applyLight(v);
    if (k === 'quality') { quality.auto = v === 'auto'; setQuality(v === 'auto' ? 2 : v); }
    if (k === 'sound' || k === 'music') { ensureAudio(); setVolumes(); }
    if (k === 'stance' && old !== v) rebuildRider();
    sfx('click'); syncSettings(); persist();
  });
});
$('sens').addEventListener('input', function () { save.set.sens = +this.value; $('sensV').textContent = Math.round(save.set.sens * 100) + '%'; });
$('btnRider').addEventListener('click', function () { sfx('click'); show('menu', false); show('riderPanel', true); buildSwatches(); MENU_CAM.close = 1; });
$('btnRiderClose').addEventListener('click', function () { show('riderPanel', false); show('menu', true); persist(); MENU_CAM.close = 0; });
function buildSwatches() {
  $('outfits').innerHTML = OUTFITS.map(function (o, i) {
    var a = '#' + new THREE.Color(o.jacket).getHexString(), b = '#' + new THREE.Color(o.accent).getHexString();
    return '<button class="sw' + (i === save.set.outfit ? ' on' : '') + '" data-i="' + i + '" style="background:linear-gradient(135deg,' + a + ' 55%,' + b + ' 56%)">' + o.name + '</button>';
  }).join('');
  $('boards').innerHTML = BOARDS.map(function (o, i) {
    return '<button class="sw' + (i === save.set.board ? ' on' : '') + '" data-i="' + i + '" style="background:linear-gradient(135deg,' + o.top[0] + ' 40%,' + o.top[1] + ' 41%,' + o.top[1] + ' 70%,' + o.base + ' 71%)">' + o.name + '</button>';
  }).join('');
}
$('outfits').addEventListener('click', function (e) { var b = e.target.closest('.sw'); if (!b) return; save.set.outfit = +b.dataset.i; rebuildRider(); buildSwatches(); sfx('click'); });
$('boards').addEventListener('click', function (e) { var b = e.target.closest('.sw'); if (!b) return; save.set.board = +b.dataset.i; rebuildRider(); buildSwatches(); sfx('click'); });
function rebuildRider() { var buf = rig.buf; disposeRig(); makeRig(buf).buf = buf; PS.init = false; }

var GUIDE = [
  ['Camera e replay', 'Il tasto con la camera (in alto a destra) cambia inquadratura: Classica, Video (bassa e di lato), Lontana. Dopo un bel trick compare <em>Replay</em>: lo rivedi al rallentatore (tocca per tornare). In pausa c\'è anche "Rivedi".'],
  ['Sterzare', 'Pollice <em>sinistro</em> ovunque nella metà sinistra: lo stick appare sotto il dito. ← → curvi, ↑ vai più veloce (posizione raccolta), ↓ freni mettendo la tavola di traverso.'],
  ['Saltare', 'Pollice <em>destro</em>: tieni premuto per caricare, lascia per saltare. Sui kicker lascia proprio sul bordo (il <em>lip</em>): spinta in più e "Pop!". Se tieni premuto oltre il bordo, salta da solo.'],
  ['Spin', 'In aria stick <em>← →</em>. Più lo spingi, più giri veloce. Per atterrare lascia lo stick: con l\'aiuto attivo la rotazione si ferma sulla posizione buona più vicina. 180, 360, 540, 720, 900, 1080…'],
  ['Pre-carica', 'Tieni lo stick ← o → mentre carichi il salto: parti già girando e arrivi a spin più grandi.'],
  ['Flip', 'In aria stick <em>↑</em> = frontflip, <em>↓</em> = backflip (si può invertire nelle impostazioni). In diagonale fai trick fuori asse: <em>Cork</em>, <em>Rodeo</em>, <em>Misty</em>, anche doppi.'],
  ['Grab', 'In aria tocca a destra e <em>trascina</em>: ↑ Nose, ↗ Mute, → Indy, ↘ Japan, ↓ Tail, ↙ Stalefish, ← Melon, ↖ Method. Tenerlo a lungo fa un tweak (vale di più). Trascina in un\'altra direzione per cambiare grab. <em>Lascia prima di toccare terra.</em> Trucco: tieni il salto oltre il lip e trascina subito, è un solo gesto.'],
  ['Rail e box', 'Arrivaci <em>dritto e centrato</em>: nessuna calamita, ti aggancia solo se la tavola ci finisce davvero sopra (aiuto di 6 cm). Se arrivi di lato o storto prendi il rail e cadi. Il puntino verde sul rail ti dice che la traiettoria è giusta.'],
  ['Sul rail', 'Stick <em>← →</em> = gira la tavola di 90°: 50-50, Boardslide, Lipslide. Trascina a destra <em>↑ ↓</em> = Nose / Tail Press. Tocca a destra per saltare via (con lo stick fai 180 Out, 360 Out…). Ogni cambio sullo stesso rail è un trick in più.'],
  ['Press e butter', 'A terra trascina a destra <em>↑</em> (nose press) o <em>↓</em> (tail press) e tieni. Con lo stick ← → mentre premi fai girare la tavola sulla neve: Nose Butter 180, 360…'],
  ['Combo', 'Ogni trick allunga la combo e alza il moltiplicatore. La barra gialla si svuota quando vai dritto: fai un altro trick prima che finisca. Se cadi perdi la combo. Ripetere lo stesso trick vale sempre meno: varia.'],
  ['Atterraggio', '<em>Perfetto</em> = tavola dritta e nessun grab: ×1,25. <em>Sporco</em> = storto o con il grab ancora in mano: punti a metà. Troppo storto, sulla testa o di traverso: caduta. Il cerchio verde mostra dove atterri (rosso = così cadi).'],
  ['Sfide', 'In Free Run c\'è sempre una sfida in alto a sinistra: completarla dà punti e, se ne hai perse, una vita.'],
  ['Computer', 'Frecce o WASD = stick · Spazio = salto · 1–8 = grab (E = Indy, Q = Melon) · R / F = nose / tail press · P = pausa.']
];
$('guideList').innerHTML = GUIDE.map(function (g) { return '<div class="gl"><b>' + g[0] + '</b><div>' + g[1] + '</div></div>'; }).join('');
var guideReturn = 'menu';
$('btnGuide').addEventListener('click', function () { sfx('click'); guideReturn = 'menu'; show('menu', false); show('guidePanel', true); });
$('btnPGuide').addEventListener('click', function () { guideReturn = 'pause'; show('pause', false); show('guidePanel', true); });
$('btnGuideClose').addEventListener('click', function () { show('guidePanel', false); show(guideReturn, true); });
document.addEventListener('visibilitychange', function () { if (document.hidden && state === 'play') pauseGame(); });
