// ============================================================ TRICK: nomi, punti, combo, sfide
// Grab: la direzione del dito a destra (in aria) sceglie quale. Indice 0 = su, poi in senso orario.
var GRABS = [
  { id: 'nose', name: 'Nose Grab', hand: 'front', at: 'nose', pts: 150 },
  { id: 'mute', name: 'Mute', hand: 'front', at: 'toe', pts: 160 },
  { id: 'indy', name: 'Indy', hand: 'rear', at: 'toe', pts: 150 },
  { id: 'japan', name: 'Japan', hand: 'front', at: 'toe', pts: 230, tweak: 'japan' },
  { id: 'tail', name: 'Tail Grab', hand: 'rear', at: 'tail', pts: 150 },
  { id: 'stale', name: 'Stalefish', hand: 'rear', at: 'heel', pts: 190 },
  { id: 'melon', name: 'Melon', hand: 'front', at: 'heel', pts: 160 },
  { id: 'method', name: 'Method', hand: 'front', at: 'heel', pts: 230, tweak: 'method' }
];
var GRAB_CENTER = 2; // toccare senza trascinare: Indy

var SPIN_PTS = { 0: 0, 180: 120, 360: 280, 540: 500, 720: 780, 900: 1100, 1080: 1500, 1260: 1950, 1440: 2500, 1620: 3100, 1800: 3800, 1980: 4600, 2160: 5500 };
function spinPts(deg) { if (SPIN_PTS[deg] !== undefined) return SPIN_PTS[deg]; return 5500 + (deg - 2160) * 5; }
var MULTI = ['', '', 'Double ', 'Triple ', 'Quad ', 'Quint '];

// nome e punti di un salto. a = { spin, flip (rad, con segno), sw0, grabs: [{g, t}], air, fs (spin frontside?) }
function airTrick(a) {
  var deg = Math.floor(Math.abs(a.spin) / PI + 0.35) * 180, nf = Math.floor(Math.abs(a.flip) / TAU + 0.3);
  var fs = a.fs, back = a.flip < 0, name = '', pts = 0, kind = 'air';
  if (nf > 0) {
    kind = 'flip';
    var mult = MULTI[Math.min(nf, 5)];
    if (deg <= 180) {
      name = (deg === 180 ? (back ? 'Rodeo 180' : 'Misty 180') : (back ? 'Backflip' : 'Frontflip'));
      if (nf > 1) name = mult + name;
    } else if (back) name = (fs ? 'Frontside ' + mult + 'Rodeo ' : 'Backside ' + mult + 'Cork ') + deg;
    else name = (fs ? 'Frontside ' + mult + 'Misty ' : 'Backside ' + mult + 'Misty ') + deg;
    pts = spinPts(deg) + nf * (back ? 950 : 1050);
    if (deg >= 360) pts = Math.round(pts * 1.3);
  } else if (deg > 0) {
    kind = 'spin';
    if (a.sw0) name = fs ? (deg === 180 ? 'Half Cab' : 'Cab ' + deg) : 'Switch Backside ' + deg;
    else name = (fs ? 'Frontside ' : 'Backside ') + deg;
    pts = spinPts(deg);
  }
  if (a.sw0 && nf > 0) { name = 'Switch ' + name; pts = Math.round(pts * 1.1); }
  else if (a.sw0 && deg > 0) pts = Math.round(pts * 1.1);
  if (a.fromRail && nf === 0 && deg > 0) { name = deg + ' Out'; pts = Math.round(spinPts(deg) * 0.8); }
  var gp = 0, gn = [];
  (a.grabs || []).forEach(function (g) {
    if (g.t < 0.12) return;
    var G0 = GRABS[g.g], tw = g.t > 0.7 ? 1.25 : 1;
    gp += Math.round((G0.pts + 280 * Math.min(g.t, 2.5)) * tw);
    if (!gn.length || gn[gn.length - 1] !== G0.name) gn.push((g.t > 0.7 ? 'Tweaked ' : '') + G0.name);
  });
  if (gn.length) {
    name = name ? name + ' ' + gn.join(' → ') : gn.join(' → ');
    if (gn.length > 1) gp = Math.round(gp * 1.2);
  }
  pts += gp;
  if (!name && a.air > 1.15) { name = a.air > 2.2 ? 'Big Air' : 'Straight Air'; pts = Math.round(90 * a.air); kind = 'straight'; }
  if (name && a.air > 1.0) pts += Math.round(110 * (a.air - 1.0));
  return name ? { name: name, pts: pts, kind: kind, deg: deg, nf: nf, grabs: gn.length } : null;
}

// trick sul rail: dall'angolo della tavola rispetto al rail e dalla pressione
function railTrickName(yawRel, press, frontSide, kind) {
  var a = Math.abs(wrapA(yawRel));
  var slide = a > PI / 4 && a < 3 * PI / 4, sw = a >= 3 * PI / 4;
  var base;
  if (!slide) {
    base = press > 0 ? 'Nose Press' : press < 0 ? 'Tail Press' : '50-50';
    if (sw) base = 'Switch ' + base;
  } else {
    base = (frontSide ? 'FS ' : 'BS ') + (yawRel > 0 ? 'Boardslide' : 'Lipslide');
    if (press) base += press > 0 ? ' Nose Press' : ' Tail Press';
  }
  return { name: base, slide: slide, rate: slide ? 110 : press ? 120 : 80, kind: kind };
}

// ------------------------------------------------------------ combo
var CB = null, BANK_TIME = 2.6;
function comboReset() { CB = { parts: [], pts: 0, timer: 0, history: CB ? CB.history : [], live: false }; }
comboReset();
// aggiunge un trick alla combo: i trick ripetuti di recente valgono meno
function comboAdd(name, pts, quality) {
  var key = name.replace(/^Tweaked /, '');
  var rep = 0; for (var i = 0; i < CB.history.length; i++) if (CB.history[i] === key) rep++;
  var f = rep === 0 ? 1 : rep === 1 ? 0.6 : rep === 2 ? 0.35 : 0.2;
  var q = quality === 'perfect' ? 1.25 : quality === 'sketchy' ? 0.5 : 1;
  var p = Math.round(pts * f * q);
  CB.parts.push({ name: name, pts: p, rep: rep });
  CB.pts += p; CB.live = true; CB.timer = BANK_TIME;
  CB.history.push(key); if (CB.history.length > 10) CB.history.shift();
  return { pts: p, rep: rep };
}
function comboMult() { return Math.min(12, CB.parts.length); }
function comboValue() { return CB.pts * comboMult(); }
