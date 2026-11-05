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

// ============================================================ capitoli
var CHAPTERS = [
  { name: 'Campetto', sub: 'Il playground sotto casa', story: 'Leo "Flash" Ricci, 16 anni, palla sotto il braccio e un sogno. Al campetto comanda la banda di Gino: per giocare con i grandi devi batterli.', home: 0x2c62c9, away: 0xd23b2a, homeName: 'LEO & CO', awayName: 'GINO GANG', kind: 'out', floor: '#35838c', paint: '#c8553d', line: '#f4f1e6' },
  { name: 'Liceo', sub: 'La squadra della scuola', story: 'Il coach del liceo Fermi ti ha visto giocare. Ora indossi il verde e il campionato studentesco comincia sabato.', home: 0x1f8a5b, away: 0x7a3fb5, homeName: 'FERMI', awayName: 'VOLTA', kind: 'gym', floor: '#d9a86c', paint: '#2f6fb3', line: '#ffffff' },
  { name: 'College', sub: 'La borsa di studio', story: 'Borsa di studio negli Stati Uniti. Palazzetto pieno, avversari più grossi, difese a zona che non perdonano.', home: 0xc8102e, away: 0x003a70, homeName: 'RIVERS U', awayName: 'BAY STATE', kind: 'arena', floor: '#c98d52', paint: '#8c1d2b', line: '#fff6e6' },
  { name: 'Pro', sub: 'La prima stagione da professionista', story: 'Sei stato scelto al draft. Ogni partita è in TV e la stella avversaria vuole farti fare brutta figura.', home: 0x552583, away: 0x007a33, homeName: 'COMETS', awayName: 'TITANS', kind: 'pro', floor: '#d8a56a', paint: '#1d3a6b', line: '#ffffff' },
  { name: 'Finale', sub: 'Le Finals', story: 'Le Finals. Sette partite contro i campioni in carica. Ogni possesso vale una stagione.', home: 0xd4a017, away: 0x1d428a, homeName: 'COMETS', awayName: 'KINGS', kind: 'final', floor: '#e0b070', paint: '#141414', line: '#ffd66b' }
];
function chapterOf(lvl) { return CHAPTERS[Math.min(4, Math.floor((lvl - 1) / 10))]; }

// ============================================================ livelli: scenari di partita
function H(x, y, o) { var p = { x: x, y: y }; if (o) for (var k in o) p[k] = o[k]; return p; }
function D(x, y, ai, o) { var p = { x: x, y: y, ai: ai }; if (o) for (var k in o) p[k] = o[k]; return p; }
var HAND = [
  // ---- Capitolo 1: Campetto
  { name: 'La sfida di Gino', story: 'Gino ti lancia la palla: "Fammi vedere se sai tirare, ragazzino."', home: [H(0, 8.6)], away: [], moves: 1, par: 1, bonus: 'perfect',
    tip: 'Trascina dal tuo giocatore fino al canestro. Poi tocca quando l\'ago è nel verde.' },
  { name: 'Primo assist', story: 'Due contro uno. Marco è libero sull\'ala: servilo.', home: [H(0, 5.4), H(5.2, 9.4)], away: [D(0, 6.7, 'press')], moves: 2, par: 2, bonus: 'perfect',
    tip: 'Trascina fino al compagno per passargli la palla. Poi controlli lui.' },
  { name: 'Dribbling', story: 'Il fratello di Gino ti si piazza davanti. Giragli intorno.', home: [H(-3.8, 6.2)], away: [D(-3.1, 7.3, 'zone')], moves: 2, par: 2, bonus: 'dunk',
    tip: 'Trascina in un punto vuoto per palleggiare fin lì, poi tira da vicino.' },
  { name: 'Schiaccia!', story: 'La gente si ferma a guardare. Dai spettacolo.', home: [H(1.8, 9.6)], away: [D(-3, 9, 'zone')], moves: 2, par: 1, need: 'dunk', bonus: 'nodribble',
    tip: 'Vicino al ferro il tiro diventa una schiacciata.' },
  { name: 'Da lontano', story: 'Gino si chiude in area: "Tanto da fuori non la metti."', home: [H(0, 4.9)], away: [D(0, 9.5, 'zone')], moves: 1, par: 1, need: 'three', bonus: 'perfect',
    tip: 'Oltre la linea da tre il canestro vale 3.' },
  { name: 'Il taglio', story: 'Marco fa un movimento senza palla verso il canestro. Leggilo.', home: [H(0, 5.2), H(-5.4, 8.6, { route: [[-1.6, 11.4]] })], away: [D(0, 6.5, 'press'), D(-4.6, 9.3, 'guard', { mark: 1 })], moves: 2, par: 2, bonus: 'assist',
    tip: 'Le frecce mostrano dove correranno i compagni: passa dove arriverà.' },
  { name: 'Volo sopra il ferro', story: 'Tommy è il più alto del quartiere. Alzagliela.', home: [H(-4, 6.4), H(2.2, 11.2)], away: [D(-3.2, 7.4, 'press'), D(1.4, 10.2, 'zone')], moves: 1, par: 1, need: 'alley', bonus: 'nodribble',
    tip: 'Disegna la linea che passa sopra Tommy e finisce sul ferro: alley-oop. Curvala per evitare il difensore.' },
  { name: 'Ultimo tiro', story: 'Siamo 20 pari, si gioca al 21. Mancano 4 secondi al tramonto e alla fine.', home: [H(0, 5.2), H(-5.4, 8.6), H(6.6, 13.2)], away: [D(0, 6.4, 'press'), D(-4.6, 9.3, 'guard', { mark: 1 }), D(2.2, 11.4, 'zone')], moves: 3, par: 2, clock: 4, score: [20, 20], bonus: 'three',
    tip: 'Ora c\'è il cronometro: palleggiare costa tempo, passare è più veloce.' },
  { name: 'Il blocco', story: 'Marco ti porta un blocco sul difensore. Usalo e vai al ferro.', home: [H(-1.5, 4.8), H(-3.2, 7.6, { route: [[-0.9, 5.9]], screen: 0 })], away: [D(-0.7, 6.5, 'guard', { mark: 0 }), D(-3.6, 9.6, 'guard', { mark: 1 })], moves: 2, par: 2, need: 'dunk', bonus: 'perfect',
    tip: 'Il compagno con il blocco ferma il difensore che tocca. Palleggia dietro di lui.' },
  { name: 'Re del campetto', story: 'Finale contro la Gino Gang. Ultimo possesso, siamo sotto di uno.', home: [H(0, 5.2), H(-5.4, 8.8), H(5.4, 8.8, { route: [[1.8, 11.6]] })], away: [D(0, 6.5, 'press'), D(-4.7, 9.5, 'guard', { mark: 1 }), D(4.7, 9.5, 'guard', { mark: 2 })], moves: 3, par: 2, clock: 6, score: [19, 20], bonus: 'dunk',
    tip: 'Usa il taglio sulla destra.' },
  // ---- Capitolo 2: Liceo (11-14 a mano)
  { name: 'Contropiede', story: 'Palla rubata! Siete in tre contro due, la difesa sta rientrando.', home: [H(0, 2.6), H(-4.5, 5.5, { route: [[-3, 10.5]] }), H(4.5, 5.5, { route: [[3, 10.5]] })], away: [D(-1, 8.5, 'chase'), D(1.2, 9.5, 'chase')], moves: 3, par: 2, clock: 5, score: [32, 34], bonus: 'assist',
    tip: 'Nel contropiede i difensori corrono indietro: muovi la palla in fretta.' },
  { name: 'Rimessa dal fondo', story: 'Time-out. Rimessa da sotto canestro, 3 secondi.', home: [H(-2.5, 14.4, { inbound: true }), H(-2.2, 10.8), H(3.2, 9.4, { route: [[2.2, 11.6]] })], away: [D(0.6, 12.3, 'zone'), D(-0.6, 9.4, 'help'), D(2.6, 10.2, 'guard', { mark: 2 })], moves: 2, par: 2, clock: 3, score: [41, 42], bonus: 'nodribble',
    tip: 'Dalla rimessa non puoi tirare né palleggiare: prima devi passare.' },
  { name: 'Tiri liberi', story: 'Fallo su di te a fine partita. Due liberi, siamo sotto di uno.', home: [H(0, 8.2)], away: [], moves: 2, par: 2, ft: 2, score: [55, 56], bonus: 'perfect',
    tip: 'Ai liberi conta solo il tempismo: segnali entrambi.' },
  { name: 'Pick and roll', story: 'Il gioco preferito del coach: blocco, rollata, palla al centro.', home: [H(1.2, 5.2), H(2.8, 7.8, { route: [[1.6, 6.3], [1.2, 10.8]], screen: 0 }), H(-5.6, 9.8)], away: [D(1.1, 6.4, 'guard', { mark: 0 }), D(2.6, 8.8, 'guard', { mark: 1 }), D(-4.8, 10.2, 'guard', { mark: 2 })], moves: 3, par: 2, bonus: 'alley',
    tip: 'Il compagno blocca e poi rolla verso il canestro: servilo mentre taglia.' }
];
var HAND_N = HAND.length;

var NAMES = ['Apertura', 'Lato debole', 'Dentro e fuori', 'Uomo libero', 'Palla in post', 'Zona 2-3', 'Doppio taglio', 'Penetra e scarica', 'Raddoppio', 'Sirena', 'Triangolo', 'Backdoor', 'Linea di fondo', 'Fuori dai blocchi', 'Testa di serie', 'Ultimo possesso', 'Tempo scaduto', 'Muro in area', 'Rimonta', 'Gara secca'];
var STORIES = {
  last: ['Mancano {c} secondi, siamo sotto di {d}. Il palazzetto trattiene il fiato.', 'Ultimo possesso: {c} secondi sul cronometro e {d} punti da recuperare.', 'Il coach disegna l\'ultima azione: {c} secondi, sotto di {d}.'],
  fast: ['Palla recuperata a metà campo! Contropiede, la difesa rientra.', 'Rimbalzo e via: siete in superiorità numerica per pochi secondi.'],
  pick: ['Il lungo sale a bloccare: leggi la difesa e scegli.', 'Pick and roll centrale, come in allenamento.'],
  inbound: ['Rimessa dal fondo dopo il time-out. Pochi secondi per inventare.', 'Rimessa da sotto: la difesa si schiera a zona.'],
  zone: ['Difesa a zona: la palla deve girare più veloce di loro.', 'Si chiudono in area. Trova il tiratore libero.'],
  ft: ['Fallo subito a fine gara: tutto dalla lunetta.', 'Tiri liberi pesantissimi. Respira.'],
  iso: ['La loro stella ti marca in pressing: muovi la palla.', 'Ti raddoppiano appena tocchi palla: servi i compagni.']
};
function storyFor(kind, R, c, d) { var a = STORIES[kind]; return a[Math.floor(R() * a.length)].replace('{c}', c).replace('{d}', d); }
var SPOTS = { slotL: [-3, 6.2], slotR: [3, 6.2], wingL: [-5.4, 8.6], wingR: [5.4, 8.6], cornerL: [-6.6, 13.2], cornerR: [6.6, 13.2], elbowL: [-2.4, 8.4], elbowR: [2.4, 8.4], blockL: [-2.1, 11.6], blockR: [2.1, 11.6] };
function genLevel(i, seed) {
  var R = rng(seed), d = clamp((i - HAND_N - 1) / (50 - HAND_N), 0, 1);
  var kinds = ['last', 'pick', 'zone', 'fast', 'iso', 'inbound', 'zone', 'last', 'pick', 'iso'];
  var kind = i % 9 === 0 ? 'ft' : kinds[(i * 3) % kinds.length];
  var nH = clamp(2 + Math.floor((i - 8) / 9), 2, 5), nA = clamp(2 + Math.floor((i - 10) / 8), 2, 5);
  var NK = { last: ['Ultimo possesso', 'Tempo scaduto', 'Gara secca', 'Sirena', 'Rimonta'], fast: ['Contropiede', 'Transizione', 'Corsa a tre'], pick: ['Pick and roll', 'Fuori dai blocchi', 'Blocco cieco', 'Gioco a due'], inbound: ['Rimessa dal fondo', 'Linea di fondo', 'Dopo il time-out'], zone: ['Zona 2-3', 'Muro in area', 'Dentro e fuori', 'Penetra e scarica'], iso: ['Isolamento', 'Raddoppio', 'Lato debole', 'Backdoor'] };
  var L = { name: (NK[kind] || NAMES)[(i * 7) % (NK[kind] || NAMES).length], home: [], away: [], moves: 0, par: 0, bonus: ['perfect', 'assist', 'nodribble', 'three', 'dunk'][Math.floor(R() * 5)], speed: 1 + d * 0.35, kind: kind };
  if (kind === 'ft') {
    L.home = [H(0, 8.2)]; L.ft = 2 + (R() < 0.3 ? 1 : 0); L.moves = L.ft; L.par = L.ft; L.bonus = 'perfect';
    var sd = L.ft - 1; L.score = [70 + Math.floor(R() * 20), 0]; L.score[1] = L.score[0] + sd;
    L.story = storyFor('ft', R, 0, sd) + ' Servono ' + L.ft + ' canestri su ' + L.ft + '.'; L.name = 'Dalla lunetta';
    return L;
  }
  var keys = Object.keys(SPOTS), pick = function () { return keys.splice(Math.floor(R() * keys.length), 1)[0]; };
  var start = kind === 'inbound' ? [(R() < 0.5 ? -1 : 1) * (2 + R() * 1.5), 14.4] : [(R() - 0.5) * 6, 4.8 + R() * 1.2];
  if (kind === 'fast') start = [(R() - 0.5) * 3, 2.4 + R()];
  if (kind === 'zone') start = [(R() - 0.5) * 4, 1.6 + R() * 0.8];
  if (kind === 'iso') start = [(R() - 0.5) * 5, 3.2 + R() * 1.0];
  L.home.push(H(start[0], start[1], kind === 'inbound' ? { inbound: true } : null));
  for (var h = 1; h < nH; h++) {
    var s = SPOTS[pick()], p = H(s[0] + (R() - 0.5) * 0.8, s[1] + (R() - 0.5) * 0.8);
    if (kind === 'fast') { p.y = 4.5 + R() * 2; p.route = [[s[0] * 0.6, 10 + R() * 2]]; }
    else if (h === 1 && kind === 'pick' && start[1] < 9) { p.x = start[0] + (R() < 0.5 ? -1.8 : 1.8); p.y = start[1] + 2.6; p.route = [[start[0] + (p.x > start[0] ? 0.5 : -0.5), start[1] + 1.1], [start[0] * 0.3, 10.9]]; p.screen = 0; }
    else if (R() < 0.3 + d * 0.2 && s[1] < 11) p.route = [[(s[0] < 0 ? -1 : 1) * (1.2 + R() * 1.4), 11 + R() * 0.9]];
    L.home.push(p);
  }
  var open = 1 + Math.floor(R() * (nH - 1));
  if (kind === 'fast') { for (var f = 0; f < Math.min(nA, nH - 1); f++) L.away.push(D((R() - 0.5) * 5, 7.5 + R() * 2.5, 'chase')); }
  else if (kind === 'zone') { var Z = [[-2.2, 9.6], [2.2, 9.6], [-3.2, 12.2], [0, 11.8], [3.2, 12.2]]; for (var z = 0; z < nA; z++) L.away.push(D(Z[z][0] + (R() - 0.5) * 0.6, Z[z][1] + (R() - 0.5) * 0.6, 'zone')); }
  else {
    var hd = L.home[0];
    if (kind !== 'inbound') L.away.push(D(hd.x * 0.85, hd.y + 1.1, kind === 'iso' ? 'press' : (R() < 0.5 ? 'press' : 'guard'), { mark: 0, fast: kind === 'iso' }));
    else L.away.push(D(hd.x * 0.6, 12.6, 'zone'));
    for (var a = 1; a < nA; a++) {
      var target = a < nH ? a : -1; if (target === open && R() < 0.75) target = -1;
      if (target >= 0) { var t = L.home[target], k2 = 1.0 + R() * 0.4, dd = rimDist(t.x, t.y); L.away.push(D(t.x + (RIM.x - t.x) / dd * k2, t.y + (RIM.y - t.y) / dd * k2, 'guard', { mark: target })); }
      else L.away.push(D((R() - 0.5) * 4, 9.8 + R() * 2, R() < 0.5 ? 'zone' : 'help'));
    }
  }
  if (kind === 'last' || kind === 'inbound' || (kind === 'fast' && R() < 0.6)) {
    var down = kind === 'last' && R() < 0.4 ? 3 : (R() < 0.5 ? 2 : 1), base = 60 + Math.floor(R() * 40);
    L.clock = kind === 'fast' ? 5 : 3 + Math.floor(R() * 4); L.score = [base, base + down];
    if (down === 3) L.need = 'three';
  }
  if (!L.need && i % 5 === 0) L.need = ['three', 'dunk', 'alley'][Math.floor(R() * 3)];
  L.story = storyFor(kind === 'pick' ? 'pick' : kind, R, L.clock || 0, L.score ? L.score[1] - L.score[0] : 0);
  return L;
}
var LEVEL_CACHE = {};
function getLevel(i) {
  if (LEVEL_CACHE[i]) return LEVEL_CACHE[i];
  var L;
  if (i <= HAND_N) { L = JSON.parse(JSON.stringify(HAND[i - 1])); L.speed = 1; L.solution = solve(L); }
  else {
    for (var at = 0; at < 80; at++) {
      L = genLevel(i, i * 7919 + at * 104729);
      if (L.ft) { L.solution = []; for (var q = 0; q < L.ft; q++) L.solution.push({ type: 'shot', made: true }); break; }
      var sol = solve(L), minLen = i < 20 ? 2 : (at < 40 ? 3 : 2);
      if (L.kind === 'fast' || L.kind === 'inbound') minLen = Math.min(minLen, 2);
      if (sol && sol.length >= minLen && (L.need !== 'alley' || sol.some(function (a) { return a.type === 'alley'; }))) { L.par = sol.length; L.moves = sol.length + (i <= 40 ? 1 : 0); L.solution = sol; break; }
      if (at === 79) { L.need = null; L.clock = null; var s2 = solve(L); L.par = s2 ? s2.length : 3; L.moves = L.par + 1; L.solution = s2; }
    }
  }
  L.idx = i; LEVEL_CACHE[i] = L;
  return L;
}

// ============================================================ simulazione deterministica
var SPD_RUN = 5.4, SPD_DRIB = 5.0, SPD_PASS = 13, DT = 1 / 60;
function newState(L) {
  var G = { L: L, home: [], away: [], holder: 0, used: 0, dribbled: false, lastPass: false, phase: 'freeze', act: null, result: null, log: [], t: 0,
    clock: L.clock || null, ftMade: 0, inbound: false, ev: [] };
  L.home.forEach(function (p, i) { G.home.push({ x: p.x, y: p.y, route: p.route ? p.route.map(function (q) { return [q[0], q[1]]; }) : [], screen: p.screen, team: 0, idx: i, vx: 0, vy: 0 }); if (p.inbound && i === 0) G.inbound = true; });
  L.away.forEach(function (p, i) { G.away.push({ x: p.x, y: p.y, ai: p.ai, mark: p.mark, fast: p.fast, hx: p.x, hy: p.y, team: 1, idx: i, vx: 0, vy: 0, stuck: 0, arms: 0 }); });
  G.ball = { x: G.home[0].x, y: G.home[0].y, z: 1, mode: 'held' };
  return G;
}
function clonePlain(G) {
  return { L: G.L, home: G.home.map(function (p) { return { x: p.x, y: p.y, route: p.route.map(function (q) { return [q[0], q[1]]; }), screen: p.screen, screenOn: p.screenOn, screenDone: p.screenDone, team: 0, idx: p.idx, vx: 0, vy: 0 }; }),
    away: G.away.map(function (p) { return { x: p.x, y: p.y, ai: p.ai, mark: p.mark, fast: p.fast, hx: p.hx, hy: p.hy, team: 1, idx: p.idx, vx: 0, vy: 0, stuck: p.stuck, arms: 0 }; }),
    holder: G.holder, used: G.used, dribbled: G.dribbled, lastPass: G.lastPass, phase: 'freeze', act: null, result: null, log: G.log.slice(), t: 0,
    clock: G.clock, ftMade: G.ftMade, inbound: G.inbound, ev: [], ball: { x: 0, y: 0, z: 1, mode: 'held' } };
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
    else if (a.ai === 'guard') { var m = G.home[a.mark] || h, dd = Math.max(0.1, rimDist(m.x, m.y)); tx = m.x + (RIM.x - m.x) / dd * 1.0; ty = m.y + (RIM.y - m.y) / dd * 1.0; if (m === h) { tx = lerp(tx, focusX, 0.5); ty = lerp(ty, focusY, 0.5); } }
    else if (a.ai === 'zone') { tx = a.hx + clamp(focusX - a.hx, -1.6, 1.6); ty = a.hy + clamp(focusY - a.hy, -1.3, 1.3); s *= 0.8; }
    else if (a.ai === 'help') { tx = lerp(a.hx, focusX, 0.35); ty = lerp(a.hy, focusY, 0.35); s *= 0.9; }
    else if (a.ai === 'chase') { tx = lerp(focusX, RIM.x, 0.45); ty = lerp(focusY, RIM.y - 0.8, 0.45); s *= 1.12; }
    if (ballPath) {
      var best = 1e9, bx = 0, by = 0;
      for (var k = 0; k < ballPath.pts.length; k++) { if (ballPath.len[k] < ballS) continue; var q = ballPath.pts[k], dq = dist(a.x, a.y, q[0], q[1]); if (dq < best) { best = dq; bx = q[0]; by = q[1]; } }
      if (best < 1.7 && (actT || 0) > 0.14) { tx = bx; ty = by; s = spd; }
    }
    moveTo(a, tx, ty, s, dt); clampCourt(a);
    // i blocchi: chi va addosso a un compagno che blocca resta fermo
    G.home.forEach(function (p) { if (p.screen !== undefined && p.screenOn && dist(p.x, p.y, a.x, a.y) < 0.85) { a.stuck = 1.3; G.ev.push({ t: 'screen', who: a.idx }); p.screenOn = false; } });
    a.arms = lerp(a.arms, dist(a.x, a.y, focusX, focusY) < 2.2 ? 1 : 0.3, 0.1);
  });
}
function stepRoutes(G, dt, skip) {
  G.home.forEach(function (p, i) {
    if (i === skip) return;
    if (p.route.length) { var r = p.route[0]; if (p.screen !== undefined && !p.screenDone) p.screenOn = true; if (moveTo(p, r[0], r[1], SPD_RUN, dt)) { p.route.shift(); if (p.screen !== undefined && !p.screenDone) { p.screenDone = true; p.screenOn = false; G.away.forEach(function (a) { if (dist(a.x, a.y, p.x, p.y) < 1.6) { a.stuck = 1.5; G.ev.push({ t: 'screen', who: a.idx }); } }); } } }
    else { p.vx *= 0.8; p.vy *= 0.8; }
  });
}
function shotInfo(G, x, y) {
  if (G.L.ft) return { kind: 'ft', q: 0.72, pts: 1, blocker: null, d: rimDist(x, y) };
  var d = rimDist(x, y), kind, base;
  if (d < 1.9) { kind = 'dunk'; base = 0.96; }
  else if (d < 3.2) { kind = 'layup'; base = 0.88; }
  else if (!isThree(x, y)) { kind = 'mid'; base = 0.8 - (d - 3.2) * 0.045; }
  else { kind = 'three'; base = 0.66 - Math.max(0, d - THREE_R) * 0.09; }
  var pen = 0, blocker = null;
  G.away.forEach(function (a) {
    if (a.stuck > 0) return;
    var dd = dist(a.x, a.y, x, y); if (dd > 2.3) return;
    var toRim = [RIM.x - x, RIM.y - y], toA = [a.x - x, a.y - y], front = (toRim[0] * toA[0] + toRim[1] * toA[1]) / (Math.max(0.01, d) * Math.max(0.01, dd));
    var p = (2.3 - dd) / 2.3 * (front > 0.1 ? 0.75 : 0.35);
    if (p > pen) { pen = p; blocker = a; }
  });
  return { kind: kind, q: clamp(base - pen, 0.02, 0.98), pts: kind === 'three' ? 3 : 2, blocker: pen > 0.45 ? blocker : null, d: d };
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
function classify(G, pts, endsOnRim) {
  var h = G.home[G.holder], e = pts[pts.length - 1];
  if (endsOnRim) {
    if (G.inbound) return { type: 'none', why: 'Dalla rimessa devi prima passare' };
    var mate = alleyMate(G), near = false;
    // alley-oop solo se la linea passa vicino al compagno prima di arrivare al ferro
    if (mate >= 0) for (var k = 1; k < pts.length; k++) if (dist(pts[k][0], pts[k][1], G.home[mate].x, G.home[mate].y) < 1.7) near = true;
    if (mate >= 0 && near && rimDist(h.x, h.y) > 3.4 && !G.L.ft) return { type: 'alley', to: mate };
    return { type: 'shot' };
  }
  var best = -1, bd = 1e9;
  G.home.forEach(function (p, i) { if (i === G.holder) return; var dd = dist(p.x, p.y, e[0], e[1]); var rd = p.route.length ? dist(p.route[p.route.length - 1][0], p.route[p.route.length - 1][1], e[0], e[1]) : 99; dd = Math.min(dd, rd); if (dd < bd) { bd = dd; best = i; } });
  if (best >= 0 && bd < 2.2 && !G.L.ft) return { type: 'pass', to: best };
  if (G.inbound || G.L.ft) return { type: 'none', why: G.L.ft ? 'Ai liberi si tira e basta' : 'Dalla rimessa devi prima passare' };
  return { type: 'dribble' };
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
    G.lastPass = true; G.inbound = false; a.from = G.holder;
    G.ev.push({ t: 'pass', from: G.holder, to: action.to, alley: action.type === 'alley' });
  } else if (action.type === 'dribble') {
    var dp = action.pts.slice(); dp[0] = [h.x, h.y];
    var pth = makePath(dp);
    if (pth.total > 7.5) { var cut = [dp[0]]; for (var i = 1; i < dp.length; i++) { if (pth.len[i] > 7.5) { cut.push(pathPoint(pth, 7.5)); break; } cut.push(dp[i]); } pth = makePath(cut); }
    a.path = pth; a.s = 0; G.dribbled = true; G.lastPass = false;
  } else if (action.type === 'shot') {
    a.info = shotInfo(G, h.x, h.y); a.made = action.made; a.perfect = !!action.perfect;
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
        var blk = null; G.away.forEach(function (df2) { if (df2.stuck <= 0 && dist(df2.x, df2.y, RIM.x, RIM.y - 0.6) < 1.05) blk = df2; });
        G.holder = a.to;
        if (blk) return finish(G, false, 'Alley-oop stoppato!', { shot: { kind: 'alley', x: rc.x, y: rc.y, blocked: true, by: blk.idx } });
        return finish(G, true, '', { shot: { kind: 'alley', pts: 2, x: rc.x, y: rc.y } });
      }
      G.holder = a.to; G.ball.mode = 'held'; G.phase = 'freeze'; G.act = null; G.ev.push({ t: 'catch', who: a.to });
    }
  } else if (a.type === 'dribble') {
    a.s += SPD_DRIB * dt;
    var p = pathPoint(a.path, Math.min(a.s, a.path.total));
    moveTo(h, p[0], p[1], SPD_DRIB * 1.6, dt); clampCourt(h);
    stepRoutes(G, dt, G.holder);
    stepDefense(G, dt, h.x, h.y, null, 0);
    for (var j = 0; j < G.away.length; j++) if (G.away[j].stuck <= 0 && dist(G.away[j].x, G.away[j].y, h.x, h.y) < 0.58) { G.ev.push({ t: 'steal', by: j }); return finish(G, false, 'Palla rubata in palleggio!', { steal: j }); }
    if (a.s >= a.path.total) { G.phase = 'freeze'; G.act = null; h.vx = h.vy = 0; }
  } else if (a.type === 'shot') {
    var info = a.info, kind = info.kind, sh = { kind: kind, pts: info.pts, x: h.x, y: h.y, perfect: a.perfect };
    if (info.blocker && info.q < 0.25) { sh.blocked = true; sh.by = info.blocker.idx; return finish(G, false, 'Tiro stoppato!', { shot: sh }); }
    if (!a.made) { sh.miss = true; return finish(G, false, kind === 'dunk' ? 'Schiacciata sbagliata!' : kind === 'ft' ? 'Libero sbagliato' : 'Tiro sbagliato', { shot: sh }); }
    if (G.L.ft) { G.ftMade++; if (G.ftMade < G.L.ft) { G.phase = 'freeze'; G.act = null; G.ev.push({ t: 'ftmade', n: G.ftMade }); return; } return finish(G, true, '', { shot: sh }); }
    var need = G.L.need;
    if (need === 'three' && kind !== 'three') return finish(G, false, 'Canestro, ma serviva un tiro da tre', { shot: sh, wrong: true });
    if (need === 'dunk' && kind !== 'dunk') return finish(G, false, 'Canestro, ma serviva una schiacciata', { shot: sh, wrong: true });
    if (need === 'alley') return finish(G, false, 'Canestro, ma serviva un alley-oop', { shot: sh, wrong: true });
    if (G.L.score && !G.L.need) { var diff = G.L.score[1] - G.L.score[0]; if (info.pts < diff) return finish(G, false, 'Canestro, ma non basta per vincere', { shot: sh, wrong: true }); }
    return finish(G, true, '', { shot: sh });
  }
  if (G.phase === 'freeze' && G.used >= G.L.moves) finish(G, false, 'Mosse finite');
}

// ============================================================ risolutore
function runToFreeze(G, action) { startAction(G, action); var n = 0; while (G.phase === 'action' && n++ < 900) stepAction(G, DT); return G; }
function candidates(G) {
  var h = G.home[G.holder], out = [];
  if (!G.inbound) { var si = shotInfo(G, h.x, h.y); if (si.q >= 0.42) out.push({ type: 'shot', made: true }); }
  if (G.L.ft) return out;
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
  if (!G.inbound) [[RIM.x, RIM.y - 1.3], [RIM.x + (h.x < 0 ? -1.2 : 1.2), RIM.y - 1.6], [h.x * 0.4, h.y + 3.5], [h.x - 3, h.y + 2.5], [h.x + 3, h.y + 2.5], [h.x - 2, h.y + 4.5], [h.x + 2, h.y + 4.5]].forEach(function (t) {
    out.push({ type: 'dribble', pts: [[h.x, h.y], [clamp(t[0], -7, 7), clamp(t[1], 1, 13.4)]] });
  });
  // palleggi curvi verso il ferro (per girare intorno ai blocchi)
  if (!G.inbound) [[RIM.x, RIM.y - 1.1], [RIM.x + (h.x < 0 ? -1.8 : 1.8), RIM.y - 1.6]].forEach(function (t) {
    var mx = (h.x + t[0]) / 2, my = (h.y + t[1]) / 2, ll = Math.max(0.1, dist(h.x, h.y, t[0], t[1])), nx = -(t[1] - h.y) / ll, ny = (t[0] - h.x) / ll;
    [-2, -1.3, 1.3, 2].forEach(function (o) { var m = [clamp(lerp(h.x, t[0], 0.35) + nx * o, -7, 7), clamp(lerp(h.y, t[1], 0.35) + ny * o, 1, 13.4)]; out.push({ type: 'dribble', pts: [[h.x, h.y], m, t] }); });
  });
  // tiene solo le giocate che il gioco interpreta allo stesso modo quando le disegni
  return out.filter(function (c) {
    if (c.type === 'shot') return true;
    var k = classify(G, c.pts, c.type === 'alley');
    return k.type === c.type && (k.to === undefined || k.to === c.to);
  });
}
function solve(L) {
  if (L.ft) { var s = []; for (var q = 0; q < L.ft; q++) s.push({ type: 'shot', made: true }); return s; }
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
  var G0 = newState(L); G0.L = { moves: 99, speed: L.speed, need: L.need, score: L.score, ft: L.ft };
  rec(G0, 0, []);
  return best;
}
