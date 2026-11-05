// ============================================================ PLAYMAKER — simulazione e livelli (senza grafica)
var TAU = Math.PI * 2, PI = Math.PI;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

// campo in metri: x larghezza, y verso il canestro
var RIM = { x: 0, y: 12.43, z: 3.05 }, BOARD_Y = 13.2, BASE_Y = 14, HALF_W = 7.5, THREE_R = 6.75, CORNER_X = 6.6;
function isThree(x, y) { if (y > RIM.y - 1.4 && Math.abs(x) >= CORNER_X) return true; return dist(x, y, RIM.x, RIM.y) >= THREE_R; }
function rimDist(x, y) { return dist(x, y, RIM.x, RIM.y); }

// ============================================================ capitoli: ambientazioni diverse
var CHAPTERS = [
  { name: 'Playground', sub: 'Il campo del quartiere', story: 'Leo "Flash" Ricci, 17 anni. Al playground di Via Roma si gioca a chi vince resta. Oggi ci sono i ragazzi del Porto e non fanno sconti.', home: 0x2c62c9, away: 0xd23b2a, homeName: 'VIA ROMA', awayName: 'PORTO', kind: 'day', floor: '#3a7fc1', paint: '#e8613a', line: '#ffffff' },
  { name: 'Spiaggia', sub: 'Il torneo sulla sabbia', story: 'Estate, torneo sul lungomare. Si gioca al tramonto, la gente guarda dagli ombrelloni e il vento sposta tutto.', home: 0xff8a00, away: 0x1f9bb5, homeName: 'LIDO NORD', awayName: 'MAREA', kind: 'beach', floor: '#c5513a', paint: '#1f9bb5', line: '#fff6e6' },
  { name: 'Liceo', sub: 'Il campionato studentesco', story: 'Il coach del liceo Fermi ti ha preso in squadra. Palestra piena, compagni di classe sugli spalti, finale regionale in vista.', home: 0x1f8a5b, away: 0x7a3fb5, homeName: 'FERMI', awayName: 'VOLTA', kind: 'gym', floor: '#d9a86c', paint: '#2f6fb3', line: '#ffffff' },
  { name: 'Rooftop', sub: 'Le notti sopra la città', story: 'Il tuo nome gira. Ti invitano alle partite sul tetto del Lumière: neon, musica, i migliori della città e scommesse che non vuoi sapere.', home: 0xff2d95, away: 0x22d3ee, homeName: 'NEON', awayName: 'SKYLINE', kind: 'roof', floor: '#2b2f4a', paint: '#5b2a86', line: '#22d3ee' },
  { name: 'Finals', sub: 'Gara 7', story: 'Sei professionista. Finals, gara 7, palazzetto esaurito. Ogni possesso vale una stagione.', home: 0xd4a017, away: 0x1d428a, homeName: 'COMETS', awayName: 'KINGS', kind: 'arena', floor: '#e0b070', paint: '#141414', line: '#ffd66b' }
];
function chapterOf(lvl) { return CHAPTERS[Math.min(4, Math.floor((lvl - 1) / 10))]; }

// ============================================================ livelli: tutti scenari di partita, subito avanzati
function H(x, y, o) { var p = { x: x, y: y }; if (o) for (var k in o) p[k] = o[k]; return p; }
function D(x, y, ai, o) { var p = { x: x, y: y, ai: ai }; if (o) for (var k in o) p[k] = o[k]; return p; }
var STORIES = {
  last: ['Mancano {c} secondi, siamo sotto di {d}. Ultimo possesso.', '{c} secondi sul cronometro, {d} punti da recuperare. Il pubblico è in piedi.', 'Time-out. Il coach disegna l\'ultima azione: {c} secondi, sotto di {d}.'],
  fast: ['Palla rubata a metà campo! Contropiede, la difesa sta rientrando.', 'Rimbalzo e via: superiorità numerica per pochi secondi.'],
  pick: ['Il lungo sale a bloccare per il tagliante: trova il tempo giusto.', 'Blocco sul lato debole: chi taglia resta libero un attimo.'],
  inbound: ['Rimessa dal fondo dopo il time-out. Il loro pivot è piantato sotto il ferro.', 'Rimessa da sotto: la difesa è schierata, il pivot aspetta.'],
  zone: ['Difesa a zona con il pivot in mezzo: la palla deve girare più veloce di loro.', 'Si chiudono in area. Trova il tiratore libero sul perimetro.'],
  iso: ['Ti raddoppiano appena tocchi palla: servi chi è libero.', 'La loro stella ti marca in pressing. Muovi la palla.'],
  post: ['Il loro pivot è enorme: fallo uscire dall\'area con i passaggi.', 'Il centro avversario protegge il ferro: tira sopra di lui o servi chi taglia.']
};
var NAMES_K = { last: ['Ultimo possesso', 'Tempo scaduto', 'Gara secca', 'Sirena', 'Rimonta', 'Allo scadere'], fast: ['Contropiede', 'Transizione', 'Corsa a tre'], pick: ['Blocco cieco', 'Fuori dai blocchi', 'Gioco a due', 'Backdoor'], inbound: ['Rimessa dal fondo', 'Linea di fondo', 'Dopo il time-out'], zone: ['Zona 2-3', 'Dentro e fuori', 'Penetra e scarica', 'Uomo libero'], iso: ['Raddoppio', 'Pressing', 'Lato debole'], post: ['Il muro', 'Torre in area', 'Sopra il gigante'] };
function storyFor(kind, R, c, d) { var a = STORIES[kind]; return a[Math.floor(R() * a.length)].replace('{c}', c).replace('{d}', d); }
var SPOTS = { slotL: [-3, 6.4], slotR: [3, 6.4], wingL: [-5.4, 8.6], wingR: [5.4, 8.6], cornerL: [-6.6, 13.2], cornerR: [6.6, 13.2], elbowL: [-2.4, 8.4], elbowR: [2.4, 8.4], blockL: [-2.4, 11.8], blockR: [2.4, 11.8], topL: [-1.3, 5.6], topR: [1.3, 5.6] };
var KINDS = ['last', 'pick', 'zone', 'post', 'fast', 'iso', 'inbound', 'last', 'pick', 'post'];
function genLevel(i, seed) {
  var R = rng(seed), d = clamp((i - 1) / 49, 0, 1), kind = KINDS[(i * 7 + Math.floor(i / 10) * 3) % KINDS.length];
  var nH = clamp(3 + Math.floor(i / 14), 3, 5), nA = clamp(3 + Math.floor(i / 12), 3, 5);
  var L = { name: NAMES_K[kind][(i * 7) % NAMES_K[kind].length], home: [], away: [], moves: 0, par: 0, kind: kind, speed: 1 + d * 0.35,
    bonus: ['swish', 'assist', 'three', 'dunk', 'onepass', 'swish'][Math.floor(R() * 6)] };
  var keys = Object.keys(SPOTS), pick = function () { return keys.splice(Math.floor(R() * keys.length), 1)[0]; };
  var start;
  if (kind === 'inbound') start = [(R() < 0.5 ? -1 : 1) * (2.2 + R() * 1.6), 14.4];
  else if (kind === 'fast') start = [(R() - 0.5) * 3, 3 + R()];
  else start = [(R() - 0.5) * 4, 4.4 + R() * 1.2];
  L.home.push(H(start[0], start[1], kind === 'inbound' ? { inbound: true } : null));
  for (var h = 1; h < nH; h++) {
    var s = SPOTS[pick()], p = H(s[0] + (R() - 0.5) * 0.8, s[1] + (R() - 0.5) * 0.8);
    if (kind === 'fast') { p.y = 4 + R() * 2.5; p.route = [[s[0] * 0.7, 9 + R() * 3]]; }
    else if (kind === 'pick' && h === 1) { p.route = [[p.x + (p.x < 0 ? 1.4 : -1.4), p.y + 0.6], [p.x * 0.25, 11.2]]; p.screen = 1; }
    else if (R() < 0.25 + d * 0.25 && s[1] < 11) p.route = [[(s[0] < 0 ? -1 : 1) * (1.2 + R() * 1.6), 10.6 + R() * 1.2]];
    L.home.push(p);
  }
  // il "portiere": il pivot avversario che protegge il ferro
  L.away.push(D((R() - 0.5) * 1.2, 11.1 + R() * 0.6, 'keeper'));
  var hd = L.home[0], open = 1 + Math.floor(R() * (nH - 1));
  if (kind === 'zone') {
    L.away.push(D(hd.x * 0.8, hd.y + 1.1, 'zone'));
    var Z = [[-2.4, 9.2], [2.4, 9.2], [-3.4, 11.9], [3.4, 11.9]];
    for (var z = 0; z < nA - 2; z++) L.away.push(D(Z[z][0] + (R() - 0.5) * 0.6, Z[z][1] + (R() - 0.5) * 0.6, 'zone'));
  } else if (kind === 'fast') {
    L.away.push(D(hd.x + (R() - 0.5), hd.y + 1.3, 'chase'));
    for (var f = 0; f < nA - 3; f++) L.away.push(D((R() - 0.5) * 5, 7 + R() * 3, 'chase'));
  } else {
    if (kind !== 'inbound') L.away.push(D(hd.x * 0.9, hd.y + 1.0, kind === 'iso' ? 'press' : 'guard', { mark: 0, fast: kind === 'iso' }));
    for (var a = L.away.length; a < nA; a++) {
      var target = a - (kind === 'inbound' ? 0 : 1); if (target < 1 || target >= nH || target === open) { L.away.push(D((R() - 0.5) * 5, 9 + R() * 2, 'help')); continue; }
      var t = L.home[target], k2 = 0.9 + R() * 0.5, dd = rimDist(t.x, t.y);
      L.away.push(D(t.x + (RIM.x - t.x) / dd * k2, t.y + (RIM.y - t.y) / dd * k2, 'guard', { mark: target }));
    }
  }
  // quasi sempre si gioca col punteggio e il cronometro
  if (kind !== 'zone' || R() < 0.5) {
    var down = R() < 0.35 ? 3 : (R() < 0.6 ? 2 : 1), base = 60 + Math.floor(R() * 40);
    L.clock = kind === 'fast' ? 4 + Math.floor(R() * 2) : 3 + Math.floor(R() * 5); L.score = [base, base + down];
    if (down === 3) L.need = 'three';
  }
  if (!L.need && i % 4 === 0) L.need = ['dunk', 'alley', 'three'][Math.floor(R() * 3)];
  L.story = storyFor(kind, R, L.clock || 0, L.score ? L.score[1] - L.score[0] : 0);
  return L;
}
var LEVEL_CACHE = {};
function getLevel(i) {
  if (LEVEL_CACHE[i]) return LEVEL_CACHE[i];
  var L;
  for (var at = 0; at < 90; at++) {
    L = genLevel(i, i * 7919 + at * 104729);
    var sol = solve(L), minLen = i < 6 ? 2 : (at < 50 ? 3 : 2);
    if (sol && sol.length >= minLen && (L.need !== 'alley' || sol.some(function (a) { return a.type === 'alley'; }))) { L.par = sol.length; L.moves = sol.length + (i <= 30 ? 1 : 0); L.solution = sol; break; }
    if (at === 89) { L.need = null; L.clock = null; L.score = null; var s2 = solve(L); L.par = s2 ? s2.length : 3; L.moves = L.par + 1; L.solution = s2; }
  }
  L.idx = i; LEVEL_CACHE[i] = L;
  return L;
}

// ============================================================ simulazione deterministica
var SPD_RUN = 5.4, SPD_PASS = 13, DT = 1 / 60;
function newState(L) {
  var G = { L: L, home: [], away: [], holder: 0, used: 0, passes: 0, lastPass: false, phase: 'freeze', act: null, result: null, log: [], t: 0, clock: L.clock || null, inbound: false, ev: [] };
  L.home.forEach(function (p, i) { G.home.push({ x: p.x, y: p.y, route: p.route ? p.route.map(function (q) { return [q[0], q[1]]; }) : [], screen: p.screen, team: 0, idx: i, vx: 0, vy: 0 }); if (p.inbound && i === 0) G.inbound = true; });
  L.away.forEach(function (p, i) { G.away.push({ x: p.x, y: p.y, ai: p.ai, mark: p.mark, fast: p.fast, hx: p.x, hy: p.y, team: 1, idx: i, vx: 0, vy: 0, stuck: 0, arms: 0 }); });
  G.ball = { x: G.home[0].x, y: G.home[0].y, z: 1, mode: 'held' };
  return G;
}
function clonePlain(G) {
  return { L: G.L, home: G.home.map(function (p) { return { x: p.x, y: p.y, route: p.route.map(function (q) { return [q[0], q[1]]; }), screen: p.screen, screenDone: p.screenDone, team: 0, idx: p.idx, vx: 0, vy: 0 }; }),
    away: G.away.map(function (p) { return { x: p.x, y: p.y, ai: p.ai, mark: p.mark, fast: p.fast, hx: p.hx, hy: p.hy, team: 1, idx: p.idx, vx: 0, vy: 0, stuck: p.stuck, arms: 0 }; }),
    holder: G.holder, used: G.used, passes: G.passes, lastPass: G.lastPass, phase: 'freeze', act: null, result: null, log: G.log.slice(), t: 0, clock: G.clock, inbound: G.inbound, ev: [], ball: { x: 0, y: 0, z: 1, mode: 'held' } };
}
function moveTo(p, tx, ty, spd, dt) {
  var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy), st = spd * dt;
  if (d < 1e-4) { p.vx = 0; p.vy = 0; return true; }
  if (d <= st) { p.vx = dx / dt; p.vy = dy / dt; p.x = tx; p.y = ty; return true; }
  p.vx = dx / d * spd; p.vy = dy / d * spd; p.x += dx / d * st; p.y += dy / d * st; return false;
}
function clampCourt(p) { p.x = clamp(p.x, -HALF_W + 0.3, HALF_W - 0.3); p.y = clamp(p.y, 0.4, BASE_Y - 0.3); }
function pathPoint(path, s) {
  var i = 0; while (i < path.len.length - 1 && path.len[i + 1] < s) i++;
  if (i >= path.pts.length - 1) return path.pts[path.pts.length - 1];
  var a = path.pts[i], b = path.pts[i + 1], seg = path.len[i + 1] - path.len[i], t = seg > 0 ? (s - path.len[i]) / seg : 0;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
function makePath(pts) { var len = [0]; for (var i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1])); return { pts: pts, len: len, total: len[len.length - 1] }; }
function stepDefense(G, dt, focusX, focusY, ballPath, ballS, actT) {
  var spd = 3.9 * (G.L.speed || 1), h = G.home[G.holder];
  G.away.forEach(function (a) {
    if (a.stuck > 0) { a.stuck -= dt; a.vx = a.vy = 0; return; }
    var tx = a.x, ty = a.y, s = spd * (a.fast ? 1.25 : 1);
    if (a.ai === 'press') { tx = focusX; ty = focusY; s *= 1.05; }
    else if (a.ai === 'guard') { var m = G.home[a.mark] || h, dd = Math.max(0.1, rimDist(m.x, m.y)); tx = m.x + (RIM.x - m.x) / dd * 1.0; ty = m.y + (RIM.y - m.y) / dd * 1.0; }
    else if (a.ai === 'zone') { tx = a.hx + clamp(focusX - a.hx, -1.6, 1.6); ty = a.hy + clamp(focusY - a.hy, -1.3, 1.3); s *= 0.8; }
    else if (a.ai === 'help') { tx = lerp(a.hx, focusX, 0.35); ty = lerp(a.hy, focusY, 0.35); s *= 0.9; }
    else if (a.ai === 'chase') { tx = lerp(focusX, RIM.x, 0.45); ty = lerp(focusY, RIM.y - 0.8, 0.45); s *= 1.12; }
    else if (a.ai === 'keeper') { tx = clamp(lerp(a.hx, focusX, 0.22), -2.2, 2.2); ty = clamp(lerp(a.hy, focusY, 0.12), 10.4, 12.4); s *= 0.85; }
    if (ballPath && a.ai !== 'keeper') {
      var best = 1e9, bx = 0, by = 0;
      for (var k = 0; k < ballPath.pts.length; k++) { if (ballPath.len[k] < ballS) continue; var q = ballPath.pts[k], dq = dist(a.x, a.y, q[0], q[1]); if (dq < best) { best = dq; bx = q[0]; by = q[1]; } }
      if (best < 1.7 && (actT || 0) > 0.14) { tx = bx; ty = by; s = spd; }
    }
    moveTo(a, tx, ty, s, dt); clampCourt(a);
    a.arms = lerp(a.arms, dist(a.x, a.y, focusX, focusY) < 2.2 ? 1 : 0.3, 0.1);
  });
}
function stepRoutes(G, dt, skip) {
  G.home.forEach(function (p, i) {
    if (i === skip) return;
    if (p.route.length) {
      var r = p.route[0];
      if (moveTo(p, r[0], r[1], SPD_RUN, dt)) {
        p.route.shift();
        // blocco: arrivato sul punto, ferma i difensori che ha addosso
        if (p.screen !== undefined && !p.screenDone) { p.screenDone = true; G.away.forEach(function (a) { if (a.ai !== 'keeper' && dist(a.x, a.y, p.x, p.y) < 1.7) { a.stuck = 1.6; G.ev.push({ t: 'screen', who: a.idx }); } }); }
      }
    } else { p.vx *= 0.8; p.vy *= 0.8; }
  });
}

// ---- il tiro: la striscia decide mira (dx, dz attorno al ferro) e altezza della parabola
function apexRange(d) { return [3.5 + d * 0.06, Math.min(6.6, 4.3 + d * 0.3)]; }
function shotKind(x, y) { var d = rimDist(x, y); return d < 2.1 ? 'dunk' : isThree(x, y) ? 'three' : d < 3.3 ? 'layup' : 'two'; }
// difficoltà: quanto grande è la "finestra" di mira (in metri attorno al ferro)
function shotWindow(G, x, y) {
  var d = rimDist(x, y), fac = 0.72 + d / 9 + Math.max(0, d - 7.4) * 0.22, contest = 0;
  G.away.forEach(function (a) {
    if (a.stuck > 0) return;
    var dd = dist(a.x, a.y, x, y); if (dd > 1.6) return;
    var toR = [RIM.x - x, RIM.y - y], toA = [a.x - x, a.y - y], front = (toR[0] * toA[0] + toR[1] * toA[1]) / (Math.max(0.01, d) * Math.max(0.01, dd));
    if (front > -0.2) contest = Math.max(contest, (1.6 - dd) / 1.6);
  });
  fac *= 1 + contest * 1.7;
  return { swish: 0.15 / fac, rim: 0.25 / fac, out: 0.37 / fac, contest: contest, fac: fac };
}
// traiettoria: parabola dal punto di rilascio al bersaglio
function shotPoint(sx, sy, z0, tx, ty, tz, apex, u) {
  return [lerp(sx, tx, u), lerp(sy, ty, u), lerp(z0, tz, u) + 4 * u * (1 - u) * (apex - Math.max(z0, tz))];
}
function shotEval(G, x, y, aim, apex) {
  var kind = shotKind(x, y), d = rimDist(x, y), ar = apexRange(d);
  var H = kind === 'dunk' ? 3.3 : clamp(apex, ar[0], ar[1]), z0 = kind === 'dunk' ? 2.7 : 2.35;
  var tx = RIM.x + aim.dx, ty = RIM.y, tz = RIM.z + aim.dz, blocker = null, bu = 0;
  G.away.forEach(function (a) {
    if (a.stuck > 0 || blocker) return;
    var keeper = a.ai === 'keeper', reach = keeper ? 3.55 : 2.75, react = keeper ? 1.6 : 0.8;
    for (var k = 1; k <= 40; k++) {
      var u = k / 40, p = shotPoint(x, y, z0, tx, ty, tz, H, u);
      if (u > 0.92) break;
      var dd = dist(a.x, a.y, p[0], p[1]);
      if (dd - react < 0.45 && p[2] < reach) { blocker = a; bu = u; return; }
    }
  });
  if (kind === 'dunk') {
    G.away.forEach(function (a) { if (!blocker && a.stuck <= 0 && a.ai === 'keeper' && dist(a.x, a.y, RIM.x, RIM.y - 0.6) < 1.0) { blocker = a; bu = 0.7; } });
    return { kind: kind, blocker: blocker, bu: bu, outcome: blocker ? 'block' : 'in', made: !blocker, pts: 2, apex: H, aim: aim, e: 0, win: shotWindow(G, x, y) };
  }
  var win = shotWindow(G, x, y), e = Math.sqrt(aim.dx * aim.dx + aim.dz * aim.dz * 0.8);
  if (H > 5.4) e += (H - 5.4) * 0.05;
  var outcome = blocker ? 'block' : e < win.swish ? 'swish' : e < win.rim ? 'rimin' : e < win.out ? 'rimout' : 'miss';
  return { kind: kind, blocker: blocker, bu: bu, outcome: outcome, made: outcome === 'swish' || outcome === 'rimin', pts: kind === 'three' ? 3 : 2, apex: H, aim: aim, e: e, win: win };
}
function alleyMate(G) {
  var mate = -1, best = -1e9;
  G.home.forEach(function (p, i) {
    if (i === G.holder || p.y > BASE_Y) return; var dd = rimDist(p.x, p.y); if (dd >= 3.2) return;
    var open = 9; G.away.forEach(function (a) { if (a.stuck <= 0) open = Math.min(open, dist(a.x, a.y, p.x, p.y)); });
    var sc = open - dd * 0.3; if (sc > best) { best = sc; mate = i; }
  });
  return mate;
}
// classifica il gesto: tiro, alley-oop o passaggio (il palleggio non esiste)
function classify(G, pts, endsOnRim) {
  var e = pts[pts.length - 1];
  if (endsOnRim) {
    if (G.inbound) return { type: 'none', why: 'Dalla rimessa devi prima passare' };
    var mate = alleyMate(G), near = false;
    if (mate >= 0) for (var k = 1; k < pts.length; k++) if (dist(pts[k][0], pts[k][1], G.home[mate].x, G.home[mate].y) < 1.7) near = true;
    if (mate >= 0 && near && rimDist(G.home[G.holder].x, G.home[G.holder].y) > 3.4) return { type: 'alley', to: mate };
    return { type: 'shot' };
  }
  var best = -1, bd = 1e9;
  G.home.forEach(function (p, i) { if (i === G.holder) return; var dd = dist(p.x, p.y, e[0], e[1]); var rd = p.route.length ? dist(p.route[p.route.length - 1][0], p.route[p.route.length - 1][1], e[0], e[1]) : 99; dd = Math.min(dd, rd); if (dd < bd) { bd = dd; best = i; } });
  if (best >= 0 && bd < 2.4) return { type: 'pass', to: best };
  return { type: 'none', why: 'Trascina fino a un compagno per passare, o verso il canestro per tirare' };
}
function startAction(G, action) {
  var h = G.home[G.holder];
  G.used++; G.phase = 'action'; G.t = 0;
  var a = { type: action.type, to: action.to, t: 0 };
  if (action.type === 'pass' || action.type === 'alley') {
    var pts = action.pts.slice();
    if (action.type === 'alley') pts.push([RIM.x, RIM.y - 0.4]);
    pts[0] = [h.x, h.y];
    a.path = makePath(pts); a.s = 0; G.ball.mode = 'pass';
    var rc = G.home[action.to];
    a.catchAt = action.type === 'alley' ? [RIM.x + (rc.x - RIM.x) * 0.15, RIM.y - 0.7] : pts[pts.length - 1];
    G.lastPass = true; G.passes++; G.inbound = false; a.from = G.holder;
    G.ev.push({ t: 'pass', from: G.holder, to: action.to, alley: action.type === 'alley' });
  } else if (action.type === 'shot') {
    a.info = shotEval(G, h.x, h.y, action.aim || { dx: 0, dz: 0 }, action.apex || 4.6);
  }
  G.act = a; G.log.push(action.type);
  return a;
}
function finish(G, ok, reason, extra) { G.phase = 'over'; G.result = { ok: ok, reason: reason }; if (extra) for (var k in extra) G.result[k] = extra[k]; }
function needOk(L, kind) { if (!L.need) return true; if (L.need === 'alley') return kind === 'alley'; if (L.need === 'dunk') return kind === 'dunk' || kind === 'alley'; return kind === L.need; }
function stepAction(G, dt) {
  var a = G.act, h = G.home[G.holder];
  a.t += dt; G.t += dt;
  if (G.clock !== null && a.type !== 'shot') { G.clock -= dt; if (G.clock <= 0) { G.clock = 0; return finish(G, false, 'Tempo scaduto! Suona la sirena.', { buzzer: true }); } }
  if (a.type === 'pass' || a.type === 'alley') {
    a.s += SPD_PASS * dt;
    var bp = pathPoint(a.path, Math.min(a.s, a.path.total)), fr = Math.min(1, a.s / a.path.total);
    G.ball.x = bp[0]; G.ball.y = bp[1]; G.ball.z = a.type === 'alley' ? lerp(1.6, 3.4, fr) + Math.sin(fr * PI) * 1.2 : 1.3 + Math.sin(fr * PI) * 0.6 * Math.min(1, a.path.total / 6);
    var rc = G.home[a.to];
    moveTo(rc, a.catchAt[0], a.catchAt[1], SPD_RUN * 1.15, dt);
    if (rc.route.length && dist(rc.x, rc.y, rc.route[0][0], rc.route[0][1]) < 0.5) rc.route.shift();
    stepRoutes(G, dt, a.to);
    stepDefense(G, dt, h.x, h.y, a.path, a.s, a.t);
    for (var i = 0; i < G.away.length; i++) {
      var df = G.away[i];
      if (df.stuck <= 0 && a.s > 1.1 && G.ball.z < 2.7 && dist(df.x, df.y, G.ball.x, G.ball.y) < 0.58 && dist(rc.x, rc.y, G.ball.x, G.ball.y) > 0.8) { G.ball.mode = 'stolen'; G.ball.by = i; G.ev.push({ t: 'steal', by: i }); return finish(G, false, 'Passaggio intercettato!', { steal: i }); }
    }
    if (a.s >= a.path.total) {
      if (dist(rc.x, rc.y, a.catchAt[0], a.catchAt[1]) > 1.1) { if (a.t > a.path.total / SPD_PASS + 0.55) return finish(G, false, 'Nessuno ha preso il passaggio'); return; }
      if (a.type === 'alley') {
        var blk = null; G.away.forEach(function (df2) { if (df2.stuck <= 0 && dist(df2.x, df2.y, RIM.x, RIM.y - 0.6) < (df2.ai === 'keeper' ? 1.15 : 0.9)) blk = df2; });
        G.holder = a.to;
        if (blk) return finish(G, false, 'Alley-oop stoppato!', { shot: { kind: 'alley', x: rc.x, y: rc.y, outcome: 'block', blocked: true, by: blk.idx } });
        return finish(G, true, '', { shot: { kind: 'alley', pts: 2, x: rc.x, y: rc.y, outcome: 'in' } });
      }
      G.holder = a.to; G.ball.mode = 'held'; G.phase = 'freeze'; G.act = null; G.ev.push({ t: 'catch', who: a.to });
    }
  } else if (a.type === 'shot') {
    var info = a.info, kind = info.kind, sh = { kind: kind, pts: info.pts, x: h.x, y: h.y, outcome: info.outcome, aim: info.aim, apex: info.apex, bu: info.bu };
    if (info.blocker) { sh.blocked = true; sh.by = info.blocker.idx; return finish(G, false, info.blocker.ai === 'keeper' ? 'Stoppata del pivot!' : 'Tiro stoppato!', { shot: sh }); }
    if (!info.made) { sh.miss = true; return finish(G, false, info.outcome === 'rimout' ? 'Sul ferro… ed esce!' : info.aim.dz > 0.25 ? 'Troppo lungo' : info.aim.dz < -0.25 ? 'Troppo corto' : 'Fuori!', { shot: sh }); }
    var need = G.L.need;
    if (need === 'three' && kind !== 'three') return finish(G, false, 'Canestro, ma serviva un tiro da tre', { shot: sh, wrong: true });
    if (need === 'dunk' && kind !== 'dunk') return finish(G, false, 'Canestro, ma serviva una schiacciata', { shot: sh, wrong: true });
    if (need === 'alley') return finish(G, false, 'Canestro, ma serviva un alley-oop', { shot: sh, wrong: true });
    if (G.L.score && !G.L.need) { var diff = G.L.score[1] - G.L.score[0]; if (info.pts < diff) return finish(G, false, 'Canestro, ma non basta per vincere', { shot: sh, wrong: true }); }
    return finish(G, true, '', { shot: sh });
  }
  if (G.phase === 'freeze' && G.used >= G.L.moves) finish(G, false, 'Mosse finite');
}

// ============================================================ risolutore (mira perfetta, tiri con finestra di mira ragionevole)
function runToFreeze(G, action) { startAction(G, action); var n = 0; while (G.phase === 'action' && n++ < 900) stepAction(G, DT); return G; }
function candidates(G) {
  var h = G.home[G.holder], out = [];
  if (!G.inbound) {
    var w = shotWindow(G, h.x, h.y), ar = apexRange(rimDist(h.x, h.y));
    if (shotKind(h.x, h.y) === 'dunk' || w.rim >= 0.12) [ar[0] + 0.3, (ar[0] + ar[1]) / 2, ar[1] - 0.2].forEach(function (ap) { out.push({ type: 'shot', aim: { dx: 0, dz: 0 }, apex: ap }); });
  }
  G.home.forEach(function (p, i) {
    if (i === G.holder) return;
    var tx = p.route.length ? p.route[p.route.length - 1][0] : p.x, ty = p.route.length ? p.route[p.route.length - 1][1] : p.y;
    out.push({ type: 'pass', to: i, pts: [[h.x, h.y], [tx, ty]] });
    var mx = (h.x + tx) / 2, my = (h.y + ty) / 2, ll = Math.max(0.1, dist(h.x, h.y, tx, ty)), nx = -(ty - h.y) / ll, ny = (tx - h.x) / ll;
    [-2, 2].forEach(function (o) { out.push({ type: 'pass', to: i, pts: [[h.x, h.y], [mx + nx * o, my + ny * o], [tx, ty]] }); });
    if (i === alleyMate(G) && rimDist(h.x, h.y) > 3.4 && !G.inbound) {
      out.push({ type: 'alley', to: i, pts: [[h.x, h.y], [p.x, p.y]] });
      var ax = (h.x + p.x) / 2, ay = (h.y + p.y) / 2, al = Math.max(0.1, dist(h.x, h.y, p.x, p.y)), anx = -(p.y - h.y) / al, any = (p.x - h.x) / al;
      [-2, 2].forEach(function (o) { out.push({ type: 'alley', to: i, pts: [[h.x, h.y], [ax + anx * o, ay + any * o], [p.x, p.y]] }); });
    }
  });
  return out.filter(function (c) {
    if (c.type === 'shot') return true;
    var k = classify(G, c.pts, c.type === 'alley');
    return k.type === c.type && (k.to === undefined || k.to === c.to);
  });
}
function solve(L) {
  var maxDepth = Math.min(L.moves || 3, 3) || 3, best = null;
  function rec(G, depth, seq) {
    if (best && seq.length >= best.length) return;
    var cs = candidates(G);
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], G2 = clonePlain(G);
      runToFreeze(G2, c);
      if (G2.phase === 'over') { if (G2.result.ok && needOk(L, G2.result.shot.kind)) { if (!best || seq.length + 1 < best.length) best = seq.concat([c]); } continue; }
      if (depth + 1 < maxDepth) rec(G2, depth + 1, seq.concat([c]));
    }
  }
  var G0 = newState(L); G0.L = { moves: 99, speed: L.speed, need: L.need, score: L.score };
  rec(G0, 0, []);
  return best;
}
