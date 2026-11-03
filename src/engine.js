// ============================================================
//  FAUNI DI VALCORONA — motore
// ============================================================
'use strict';

const PAL = ['#f8f8f8', '#a8c8e8', '#4868a0', '#202838'];
const TS = 16, VW = 160, VH = 144;
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
cv.width = VW; cv.height = VH; ctx.imageSmoothingEnabled = false;
const screenEl = $('#screen'), uiEl = $('#ui');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------
//  Stato di gioco
// ------------------------------------------------------------
let G = null;            // dati salvati
let MAP = null, mapId = null;
let NPCS = [];
const player = {x: 0, y: 0, dir: 'down', mv: null, look: 'player'};
let mode = 'title';      // title | intro | world | battle
let busy = false;
let frame = 0;
let overlay = null;      // {type:'mon', sp} disegnato sopra il mondo
let B = null;            // stato lotta

function newGame() {
  return {
    v: 1, name: 'ALE', rival: 'TEO', map: 'casa_p', x: 3, y: 4, dir: 'down',
    party: [], box: [], bag: {}, money: 3000, flags: {}, seen: {}, caught: {},
    badges: [], lastHeal: {map: 'casa_p', x: 3, y: 4}, starter: null, rivalStarter: null, time: 0,
  };
}
const F = k => !!(G && G.flags[k]);
const setF = (k, v = true) => { G.flags[k] = v; };

function fmt(t) {
  return String(t).replace(/\{NAME\}/g, G ? G.name : '').replace(/\{RIVAL\}/g, G ? G.rival : '');
}

// ------------------------------------------------------------
//  Input
// ------------------------------------------------------------
const held = {up: 0, down: 0, left: 0, right: 0};
const DIRS = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
const OPP = {up: 'down', down: 'up', left: 'right', right: 'left'};
let waiter = null;
let heldOrder = [];

function press(k) {
  if (DIRS[k]) { held[k] = 1; heldOrder = heldOrder.filter(d => d !== k); heldOrder.push(k); }
  if (waiter) { const w = waiter; waiter = null; w(k); return; }
  if (mode === 'world' && !busy) worldKey(k);
  else if (mode === 'title') titleKey(k);
}
function release(k) { if (DIRS[k]) { held[k] = 0; heldOrder = heldOrder.filter(d => d !== k); } }
function waitKey() { return new Promise(r => { waiter = r; }); }
async function waitAB() { for (;;) { const k = await waitKey(); if (k === 'A' || k === 'B') return k; } }

const KEYMAP = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  z: 'A', Z: 'A', x: 'B', X: 'B', Enter: 'START', ' ': 'A', Shift: 'SELECT', Escape: 'B'};
addEventListener('keydown', e => { const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); if (!e.repeat) press(k); });
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) release(k); });

document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  const down = e => { e.preventDefault(); b.classList.add('on'); press(k); };
  const up = e => { e.preventDefault(); b.classList.remove('on'); release(k); };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ------------------------------------------------------------
//  Disegno: tessere (a colori)
// ------------------------------------------------------------
function R(g, c, x, y, w = 1, h = 1) { g.fillStyle = typeof c === 'number' ? PAL[c] : c; g.fillRect(x, y, w, h); }
const SOLID = new Set('T~FRCMGWwSrYOxobtcpk#Xn'.split(''));
const K = {
  g0: '#b8e888', g1: '#98d070', g2: '#78b858', g3: '#4e9040', g4: '#2e6a2e',
  p0: '#f8eac0', p1: '#ead49a', p2: '#ccae72', p3: '#9a7a48',
  t0: '#5cb85a', t1: '#88d470', t2: '#3a8a3e', t3: '#215a2a', tr: '#8a5e36', trd: '#5a3a20',
  w0: '#5aa0f0', w1: '#8cc4f8', w2: '#d0ecff', w3: '#3a70c8',
  r0: '#e05a4a', r1: '#f48c74', r2: '#b03a32', r3: '#6e2020',
  b0: '#4a7ad8', b1: '#7aaaf2', b2: '#2e52a2',
  s0: '#a8a8b2', s1: '#cacad4', s2: '#787884', s3: '#4a4a54',
  wl0: '#faf2e2', wl1: '#e2d2b8', wl2: '#baa88e', wl3: '#7a6a52',
  win: '#a8d8f8', win2: '#eaf8ff', fr: '#7a5a3a',
  dr0: '#a66a3a', dr1: '#7a4a22', knob: '#f2d26a',
  rk0: '#bab2a2', rk1: '#ddd5c5', rk2: '#8a8272', rk3: '#5a5248',
  fl0: '#f4e2ba', fl1: '#dcc292', fl2: '#b89a68',
  iw0: '#eadaca', iw1: '#c4aa8a', iw2: '#8a7258',
  out: '#2a2a32',
};
const PAINT = {
  '.': g => { R(g, K.g1, 0, 0, 16, 16); R(g, K.g0, 3, 4, 2, 1); R(g, K.g2, 11, 10, 1, 2); R(g, K.g0, 7, 13, 2, 1); R(g, K.g2, 13, 2, 1, 2); R(g, K.g2, 2, 11); },
  '=': g => { R(g, K.p0, 0, 0, 16, 16); for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) R(g, K.p1, x, y, 2, 1); R(g, K.p2, 6, 9); R(g, K.p2, 13, 5); },
  ',': (g, f) => {
    R(g, K.g2, 0, 0, 16, 16);
    for (const [x, y] of [[0, 1], [8, 0], [4, 6], [12, 7], [0, 11], [8, 12]]) {
      const o = f ? 1 : 0;
      R(g, K.g3, x, y + 3, 4, 3); R(g, K.g1, x + o, y + 1, 1, 3); R(g, K.g1, x + 2, y, 1, 4); R(g, K.g0, x + 2, y, 1, 1); R(g, K.g4, x + 3, y + 2, 1, 3); R(g, K.g4, x, y + 5, 4, 1);
    }
  },
  'f': (g, f) => { PAINT['.'](g); const C = ['#f25a6a', '#ffffff', '#f2d23a', '#ffffff'];
    [[2, 2], [10, 3], [5, 10], [12, 11]].forEach(([x, y], i) => { const o = f ? 1 : 0; R(g, K.g3, x + 1, y + 2, 1, 3); R(g, C[i], x + o, y, 3, 1); R(g, C[i], x + 1 + o, y - 1, 1, 3); R(g, '#f2c23a', x + 1 + o, y); }); },
  'T': g => {
    R(g, K.g1, 0, 0, 16, 16);
    R(g, 'rgba(0,0,0,.18)', 2, 13, 12, 3);
    R(g, K.t3, 2, 1, 12, 11); R(g, K.t3, 1, 3, 14, 7);
    R(g, K.t0, 3, 2, 10, 9); R(g, K.t0, 2, 4, 12, 5);
    R(g, K.t2, 3, 8, 10, 3); R(g, K.t2, 2, 7, 3, 2); R(g, K.t2, 11, 7, 3, 2);
    R(g, K.t1, 5, 3, 3, 2); R(g, K.t1, 4, 5, 2, 1); R(g, K.t1, 9, 4, 2, 2);
    R(g, K.trd, 6, 11, 4, 4); R(g, K.tr, 7, 11, 2, 4);
  },
  '~': (g, f) => { R(g, K.w0, 0, 0, 16, 16); const o = f ? 3 : 0; R(g, K.w1, (2 + o) % 16, 4, 5, 1); R(g, K.w2, (3 + o) % 16, 4, 2, 1); R(g, K.w1, (10 + o) % 16, 11, 4, 1); R(g, K.w3, (9 + o) % 16, 7, 3, 1); R(g, K.w3, (1 + o) % 16, 13, 3, 1); },
  'F': g => { PAINT['.'](g); R(g, '#f8f8f8', 0, 5, 16, 2); R(g, '#f8f8f8', 0, 10, 16, 2); R(g, '#a8a8a8', 0, 7, 16, 1); R(g, '#a8a8a8', 0, 12, 16, 1); for (const x of [2, 12]) { R(g, '#a8a8a8', x, 3, 3, 11); R(g, '#ffffff', x, 3, 2, 10); } },
  'R': g => roof(g, K.r0, K.r1, K.r2, K.r3),
  'H': g => roof(g, K.b0, K.b1, K.b2, '#1a2a5a'),
  'C': g => { roof(g, K.r0, K.r1, K.r2, K.r3); R(g, '#ffffff', 5, 3, 6, 10); R(g, K.r0, 7, 4, 2, 8); R(g, K.r0, 6, 7, 4, 2); },
  'M': g => { roof(g, K.b0, K.b1, K.b2, '#1a2a5a'); R(g, '#ffffff', 3, 5, 10, 6); R(g, K.b0, 4, 6, 8, 1); R(g, K.b0, 4, 8, 6, 1); },
  'G': g => { roof(g, K.s0, K.s1, K.s2, K.s3); R(g, '#f2c23a', 5, 4, 6, 5); R(g, '#c89a22', 6, 5, 4, 3); },
  'W': g => { R(g, K.wl0, 0, 0, 16, 16); R(g, K.wl1, 0, 5, 16, 1); R(g, K.wl1, 0, 10, 16, 1); R(g, K.wl2, 0, 15, 16, 1); R(g, K.wl2, 0, 0, 16, 1); },
  'w': g => { PAINT.W(g); R(g, K.fr, 3, 3, 10, 9); R(g, K.win, 4, 4, 8, 7); R(g, K.win2, 5, 5, 2, 2); R(g, K.fr, 7, 4, 1, 7); R(g, K.fr, 4, 7, 8, 1); },
  'D': g => { PAINT.W(g); R(g, K.dr1, 3, 2, 10, 14); R(g, K.dr0, 4, 3, 8, 13); R(g, K.knob, 10, 9, 1, 1); R(g, K.dr1, 4, 7, 8, 1); R(g, '#c88a52', 5, 4, 2, 2); },
  'S': g => { PAINT['.'](g); R(g, K.trd, 7, 9, 2, 6); R(g, '#5a3a20', 1, 2, 14, 8); R(g, '#c8945a', 2, 3, 12, 6); R(g, '#8a5e36', 4, 5, 8, 1); R(g, '#8a5e36', 4, 7, 6, 1); },
  'v': g => { PAINT['.'](g); R(g, K.g3, 0, 10, 16, 2); R(g, K.g4, 0, 12, 16, 1); R(g, K.g2, 0, 13, 16, 3); },
  'r': g => { (MAP && MAP.indoor ? PAINT._ : PAINT['.'])(g); R(g, 'rgba(0,0,0,.2)', 2, 13, 12, 3); R(g, K.rk3, 2, 4, 12, 10); R(g, K.rk3, 3, 3, 10, 12); R(g, K.rk0, 3, 5, 10, 8); R(g, K.rk0, 4, 4, 8, 10); R(g, K.rk1, 5, 5, 3, 2); R(g, K.rk2, 4, 11, 8, 2); R(g, K.rk2, 9, 8, 3, 1); },
  'B': g => { R(g, '#c8945a', 0, 0, 16, 16); for (let x = 0; x < 16; x += 4) R(g, '#8a5e36', x, 0, 1, 16); R(g, '#5a3a20', 0, 0, 16, 1); R(g, '#5a3a20', 0, 15, 16, 1); },
  'Y': (g, f) => { PAINT['.'](g); R(g, K.wl2, 5, 5, 6, 11); R(g, K.wl0, 6, 5, 4, 11); R(g, K.dr1, 7, 12, 2, 4); const o = f ? 1 : 0; R(g, K.fr, 1 + o, 1, 14 - 2 * o, 2); R(g, K.fr, 7, 0 + o, 2, 9 - 2 * o); R(g, '#ffffff', 2 + o, 1, 4, 1); R(g, '#ffffff', 7, 1 + o, 1, 3); R(g, K.r0, 6, 4, 4, 2); },
  'O': (g, f) => {
    R(g, K.rk3, 0, 0, 16, 16); R(g, K.rk0, 1, 1, 14, 14);
    const alive = MAP && MAP.spring && F(MAP.spring);
    if (alive) { R(g, '#5ad2e2', 2, 2, 12, 12); R(g, '#a2f2ff', 3, 3, 10, 10); R(g, '#ffffff', 4 + (f ? 2 : 0), 5, 2, 2); R(g, '#ffffff', 9 - (f ? 2 : 0), 9, 2, 2); R(g, '#ffffff', 7, 3 + (f ? 1 : 0), 1, 1); }
    else { R(g, '#5a524a', 3, 3, 10, 10); R(g, '#3a342e', 6, 6, 4, 4); }
  },
  // interni
  '#': g => { R(g, K.iw0, 0, 0, 16, 16); R(g, K.iw1, 0, 12, 16, 4); R(g, K.iw2, 0, 15, 16, 1); R(g, K.iw1, 0, 3, 16, 1); for (let x = 3; x < 16; x += 8) R(g, '#f8eade', x, 4, 1, 8); },
  '_': g => { R(g, K.fl0, 0, 0, 16, 16); R(g, K.fl1, 0, 7, 16, 1); R(g, K.fl1, 0, 15, 16, 1); R(g, K.fl1, 5, 0, 1, 7); R(g, K.fl1, 12, 8, 1, 7); R(g, '#fff4d8', 1, 1, 3, 1); },
  'b': g => { R(g, '#5a3a20', 0, 0, 16, 16); R(g, '#8a5e36', 1, 1, 14, 14); const BC = ['#e05a4a', '#4a7ad8', '#f2c23a', '#5ab85a', '#a25ac2'];
    for (let y = 2, r = 0; y < 15; y += 5, r++) { R(g, '#5a3a20', 1, y + 3, 14, 1); for (let x = 2, i = r; x < 14; x += 3, i++) R(g, BC[i % 5], x, y, 2, 3); } },
  't': g => { PAINT._(g); R(g, '#7a4a22', 0, 1, 16, 14); R(g, '#c88a52', 1, 2, 14, 10); R(g, '#e8b072', 2, 3, 6, 2); R(g, '#a66a3a', 1, 12, 14, 2); },
  'c': g => { R(g, '#7a4a22', 0, 0, 16, 16); R(g, '#f8f0dc', 0, 1, 16, 5); R(g, '#c88a52', 0, 7, 16, 8); R(g, '#ffffff', 0, 2, 16, 1); },
  'p': g => { PAINT._(g); R(g, '#3a3a44', 2, 1, 12, 11); R(g, '#4a8ad8', 3, 2, 10, 7); R(g, '#a8d8ff', 4, 3, 3, 2); R(g, '#8a8a94', 5, 12, 6, 3); },
  'm': g => { PAINT._(g); R(g, '#a83a32', 1, 4, 14, 10); R(g, '#e05a4a', 2, 5, 12, 8); for (let x = 3; x < 13; x += 3) R(g, '#f2c23a', x, 6, 1, 6); },
  'k': g => { PAINT._(g); R(g, '#3a3a44', 1, 0, 14, 16); R(g, '#ffffff', 2, 1, 12, 4); R(g, '#4a7ad8', 2, 6, 12, 9); R(g, '#7aaaf2', 2, 6, 12, 2); },
  'x': g => { PAINT._(g); R(g, '#8a4a2a', 5, 10, 6, 6); R(g, '#c8723a', 6, 11, 4, 4); R(g, K.t3, 3, 1, 10, 10); R(g, K.t0, 4, 2, 8, 8); R(g, K.t1, 5, 3, 2, 2); R(g, K.t1, 9, 6, 2, 2); },
  'o': g => { PAINT._(g); R(g, K.s3, 4, 1, 8, 15); R(g, K.s0, 5, 2, 6, 13); R(g, K.s1, 6, 3, 2, 3); R(g, K.s3, 6, 6, 1, 1); R(g, K.s3, 9, 6, 1, 1); R(g, K.s2, 3, 13, 10, 3); },
  'X': g => { R(g, '#18181e', 0, 0, 16, 16); },
};
function roof(g, a, l, d, o) {
  R(g, a, 0, 0, 16, 16);
  for (let y = 3; y < 16; y += 4) R(g, d, 0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 2 : 6); x < 16; x += 8) R(g, d, x, y, 1, 3);
  R(g, l, 0, 0, 16, 1); R(g, l, 1, 1, 3, 1); R(g, o, 0, 15, 16, 1);
}
const tileCache = {};
function tileImg(ch, f) {
  const springState = ch === 'O' ? (MAP && MAP.spring && F(MAP.spring) ? 1 : 0) : 0;
  const ind = ch === 'r' && MAP && MAP.indoor ? 1 : 0;
  const key = ch + f + springState + ind;
  if (tileCache[key]) return tileCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  (PAINT[ch] || PAINT['.'])(g, f);
  return (tileCache[key] = c);
}

// ------------------------------------------------------------
//  Disegno: personaggi (a colori)
// ------------------------------------------------------------
const SKIN = '#f8cca2', SKIN2 = '#d89a6a';
const LOOKS = {
  player: {hair: '#4a3020', shirt: '#f2902e', pants: '#3a4a8a', cap: '#2aa2a2'},
  rival:  {hair: '#c88a3a', shirt: '#7a52c2', pants: '#3a3a4a', spiky: 1},
  prof:   {hair: '#c8c8c8', shirt: '#5ab85a', pants: '#6a5a4a', coat: '#ffffff', long: 1},
  mom:    {hair: '#7a3a2a', shirt: '#e85a8a', pants: '#e85a8a', long: 1},
  dad:    {hair: '#3a3a3a', shirt: '#3a6ac2', pants: '#3a3a4a', beard: 1},
  man:    {hair: '#3a2a20', shirt: '#4a9a6a', pants: '#4a4a5a'},
  woman:  {hair: '#e2a23a', shirt: '#4a8ae2', pants: '#4a8ae2', long: 1},
  old:    {hair: '#e2e2e2', shirt: '#8a6a4a', pants: '#5a4a3a', beard: 1},
  oldw:   {hair: '#d2d2e2', shirt: '#a25aa2', pants: '#a25aa2', long: 1},
  kid:    {hair: '#4a3020', shirt: '#e24a4a', pants: '#3a5aa2', small: 1, cap: '#f2c23a'},
  girl:   {hair: '#c25a2a', shirt: '#f28ac2', pants: '#f28ac2', long: 1, small: 1},
  scout:  {hair: '#6a4a2a', shirt: '#8a9a3a', pants: '#5a4a2a', cap: '#5a6a2a'},
  hiker:  {hair: '#3a2a20', shirt: '#c25a2a', pants: '#5a4a3a', beard: 1, cap: '#6a4a2a'},
  grigio: {hair: '#2a2a2a', shirt: '#6a6a74', pants: '#3a3a44', cap: '#4a4a54', coat: '#8a8a94'},
  nurse:  {hair: '#f28aa2', shirt: '#ffffff', pants: '#ffffff', long: 1, cross: 1},
  clerk:  {hair: '#3a2a20', shirt: '#4a7ad8', pants: '#3a3a4a', apron: '#ffffff'},
  leader: {hair: '#8a4a2a', shirt: '#a2725a', pants: '#5a4a3a', long: 1, coat: '#6a5a4a'},
  miner:  {hair: '#3a2a20', shirt: '#c28a3a', pants: '#4a4a5a', cap: '#f2c23a'},
  worker: {hair: '#3a2a20', shirt: '#f28a2a', pants: '#3a4a8a', cap: '#f2c23a', apron: '#f2d23a'},
};
const charCache = {};
function charImg(look, dir, step) {
  const key = look + dir + step;
  if (charCache[key]) return charCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const O = K.out;
  if (look === 'ball') {
    // SFERA: verde acqua sopra, crema sotto, fascia dorata con gemma
    R(g, O, 4, 4, 8, 10); R(g, O, 3, 5, 10, 8);
    R(g, '#2a9a8a', 4, 5, 8, 4); R(g, '#7ad8c8', 5, 5, 2, 1); R(g, '#1e6e64', 10, 6, 1, 3);
    R(g, '#f2e2b2', 4, 10, 8, 3); R(g, '#c8b282', 9, 11, 2, 2);
    R(g, '#c8962a', 3, 9, 10, 1);
    R(g, O, 6, 8, 4, 3); R(g, '#f2d23a', 7, 9, 2, 1); R(g, '#fff6b2', 7, 9, 1, 1);
  } else {
    const L = LOOKS[look] || LOOKS.man;
    const o = L.small ? 1 : 0;
    const side = dir === 'left' || dir === 'right';
    const shade = col => col;
    // gambe
    if (side) { R(g, O, 5 + (step ? -1 : 0), 12, 3, 4); R(g, L.pants, 6 + (step ? -1 : 0), 12, 1, 3); R(g, O, 8 + (step ? 1 : 0), 12, 3, 4); R(g, L.pants, 9 + (step ? 1 : 0), 12, 1, 3); }
    else {
      R(g, O, 4, 12, 4, 4 - (step === 1 ? 1 : 0)); R(g, L.pants, 5, 12, 2, 3 - (step === 1 ? 1 : 0));
      R(g, O, 8, 12, 4, 4 - (step === 2 ? 1 : 0)); R(g, L.pants, 9, 12, 2, 3 - (step === 2 ? 1 : 0));
    }
    // corpo
    R(g, O, 3, 8 + o, 10, 6 - o);
    R(g, L.shirt, 4, 9 + o, 8, 4 - o);
    R(g, 'rgba(0,0,0,.18)', 4, 12, 8, 1);
    if (L.coat) { R(g, L.coat, 4, 9 + o, 2, 5 - o); R(g, L.coat, 10, 9 + o, 2, 5 - o); }
    if (L.apron && dir !== 'up') R(g, L.apron, 6, 10 + o, 4, 3 - o);
    if (L.cross && dir === 'down') { R(g, '#e24a4a', 7, 9 + o, 2, 3); R(g, '#e24a4a', 6, 10 + o, 4, 1); }
    // braccia / mani
    if (!side) { R(g, SKIN, 3, 11, 1, 2); R(g, SKIN, 12, 11, 1, 2); }
    else R(g, SKIN, dir === 'left' ? 6 : 9, 11, 2, 2);
    // testa
    R(g, O, 3, 1 + o, 10, 8); R(g, O, 4, 0 + o, 8, 10 - o);
    R(g, SKIN, 4, 2 + o, 8, 6); R(g, SKIN2, 4, 7 + o, 8, 1);
    // capelli
    R(g, L.hair, 4, 1 + o, 8, 2);
    if (dir === 'up') { R(g, L.hair, 4, 1 + o, 8, 7); R(g, 'rgba(255,255,255,.25)', 5, 2 + o, 4, 1); }
    if (L.long) { R(g, L.hair, 3, 2 + o, 1, 7); R(g, L.hair, 12, 2 + o, 1, 7); if (dir === 'up') R(g, L.hair, 4, 8, 8, 2); }
    if (L.spiky) { R(g, O, 4, 0, 1, 1); R(g, O, 7, 0, 1, 1); R(g, O, 10, 0, 1, 1); R(g, L.hair, 5, 0 + o, 2, 2); R(g, L.hair, 8, 0 + o, 2, 2); R(g, L.hair, 3, 3 + o, 1, 2); R(g, L.hair, 12, 3 + o, 1, 2); }
    if (L.cap) {
      R(g, O, 3, 0 + o, 10, 4); R(g, L.cap, 4, 1 + o, 8, 2); R(g, 'rgba(255,255,255,.35)', 5, 1 + o, 3, 1);
      if (dir === 'down') R(g, L.cap, 3, 3 + o, 10, 1);
      if (side) R(g, L.cap, dir === 'left' ? 2 : 10, 3 + o, 4, 1);
    }
    // viso
    if (dir === 'down') {
      R(g, O, 5, 4 + o, 1, 2); R(g, O, 10, 4 + o, 1, 2);
      R(g, '#f2a29a', 4, 6 + o, 1, 1); R(g, '#f2a29a', 11, 6 + o, 1, 1);
      if (L.beard) R(g, L.hair, 5, 6 + o, 6, 2);
    } else if (side) {
      const ex = dir === 'left' ? 5 : 10;
      R(g, O, ex, 4 + o, 1, 2);
      R(g, L.hair, dir === 'left' ? 9 : 4, 2 + o, 3, 5);
      if (L.beard) R(g, L.hair, dir === 'left' ? 4 : 8, 6 + o, 4, 2);
    }
  }
  return (charCache[key] = c);
}

// ------------------------------------------------------------
//  Disegno: creature (pixel art con contorno e ombre automatici)
// ------------------------------------------------------------
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function tint(h, f) { // f>0 schiarisce, f<0 scurisce
  const [r, g, b] = hex2rgb(h);
  const m = v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function artGrid(id) {
  const A = ART[id];
  const N = 24;
  const rows = [];
  if (A.f) for (let y = 0; y < N; y++) rows.push((A.f[y] || '').padEnd(N, '.').slice(0, N));
  else for (let y = 0; y < N; y++) { const h = (A.h[y] || '').padEnd(12, '.').slice(0, 12); rows.push(h + [...h].reverse().join('')); }
  return rows;
}
const monCache = {};
function monSprite(spId, back) {
  const key = spId + (back ? 'b' : 'f');
  if (monCache[key]) return monCache[key];
  const A = ART[spId];
  const N = 24;
  let rows = artGrid(spId);
  if (back) rows = rows.map(r => [...r].reverse().join('').replace(/[ek]/g, 'a'));
  const col = {e: '#ffffff', k: '#1e1e26'};
  for (const k in A.c) col[k] = A.c[k];
  const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? rows[y][x] : '.');
  const filled = (x, y) => at(x, y) !== '.';
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = at(x, y);
    let color;
    if (ch === '.') {
      // contorno colorato attorno alla figura
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy)).find(v => v !== '.' && v !== 'e');
      if (!nb) continue;
      color = nb === 'k' ? col.k : tint(col[nb] || col.a, -0.62);
    } else if (ch === 'e' || ch === 'k') color = col[ch];
    else {
      const base = col[ch] || col.a;
      const top = !filled(x, y - 1) || !filled(x - 1, y);
      const bot = !filled(x, y + 1) || !filled(x + 1, y);
      const bot2 = !filled(x, y + 2);
      color = top ? tint(base, 0.32) : bot ? tint(base, -0.28) : bot2 ? tint(base, -0.12) : base;
    }
    g.fillStyle = color; g.fillRect(x * 2, y * 2, 2, 2);
  }
  return (monCache[key] = c);
}
// Sagoma bianca (per entrata in campo / evoluzione)
const silCache = {};
function monSilhouette(spId, color = '#ffffff') {
  const key = spId + color;
  if (silCache[key]) return silCache[key];
  const s = monSprite(spId);
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'); g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 48, 48);
  return (silCache[key] = c);
}

// ------------------------------------------------------------
//  Interfaccia (finestre di testo e menu in HTML)
// ------------------------------------------------------------
function U(n) { return `calc(var(--u) * ${n})`; }
function el(cls, x, y, w, h, parent = uiEl) {
  const d = document.createElement('div'); d.className = cls;
  d.style.left = U(x); d.style.top = U(y);
  if (w != null) d.style.width = U(w);
  if (h != null) d.style.height = U(h);
  parent.appendChild(d); return d;
}
function resize() {
  const u = screenEl.getBoundingClientRect().width / VW;
  screenEl.style.setProperty('--u', u + 'px');
}
addEventListener('resize', resize);

const LINE = 28; // caratteri per riga
function wrap(text) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if (!line) line = w;
      else if ((line + ' ' + w).length <= LINE) line += ' ' + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
let textBox = null;
function showTextBox() {
  if (!textBox) {
    textBox = el('box text', 0, 100, 160, 44);
    textBox.innerHTML = '<div class="t"></div><div class="more">▼</div>';
  }
  return textBox;
}
function hideTextBox() { if (textBox) { textBox.remove(); textBox = null; } }

function typeOut(str) {
  return new Promise(res => {
    const box = showTextBox(); const t = box.querySelector('.t'); const more = box.querySelector('.more');
    more.style.visibility = 'hidden';
    let i = 0; let done = false;
    const finish = () => { if (done) return; done = true; clearInterval(iv); t.textContent = str; if (waiter === h) waiter = null; res(); };
    const h = k => { if (k === 'A' || k === 'B') finish(); else waiter = h; };
    waiter = h;
    const iv = setInterval(() => { i += 2; t.textContent = str.slice(0, i); if (i >= str.length) finish(); }, 18);
  });
}
// Mostra un testo; "|" forza una nuova pagina.
async function say(text, opt = {}) {
  const pages = [];
  for (const chunk of fmt(text).split('|')) {
    const lines = wrap(chunk.trim());
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join('\n'));
  }
  for (let p = 0; p < pages.length; p++) {
    await typeOut(pages[p]);
    const last = p === pages.length - 1;
    if (last && opt.noWait) return;
    if (last && opt.auto) { await sleep(opt.auto); return; }
    textBox.querySelector('.more').style.visibility = 'visible';
    await waitAB();
  }
  if (!opt.keep) hideTextBox();
}

// Testo istantaneo che non aspetta tasti (usato durante le animazioni)
function msg(text) {
  const box = showTextBox();
  if (waiter && waiter.typing) waiter = null;
  box.querySelector('.t').textContent = wrap(fmt(text)).slice(0, 2).join('\n');
  box.querySelector('.more').style.visibility = 'hidden';
}

// Menu a lista. Ritorna l'indice scelto o -1 se annullato.
async function choose(opts, o = {}) {
  const rows = Math.min(opts.length, o.rows || 7);
  const w = o.w || Math.max(...opts.map(s => String(s).length)) * 5.2 + 18;
  const h = rows * 10 + 8;
  const x = o.x != null ? o.x : 160 - w;
  const y = o.y != null ? o.y : 100 - h;
  const box = el('box menu', x, y, w, h);
  let i = o.start || 0, top = 0;
  const draw = () => {
    if (i < top) top = i; if (i >= top + rows) top = i - rows + 1;
    box.innerHTML = opts.slice(top, top + rows).map((s, j) =>
      `<div class="it">${top + j === i ? '▶' : '&nbsp;'}${s}</div>`).join('') +
      (top > 0 ? '<div class="up">▲</div>' : '') + (top + rows < opts.length ? '<div class="dn">▼</div>' : '');
    if (o.onMove) o.onMove(i);
  };
  draw();
  for (;;) {
    const k = await waitKey();
    if (k === 'up') { i = (i - 1 + opts.length) % opts.length; draw(); }
    else if (k === 'down') { i = (i + 1) % opts.length; draw(); }
    else if (k === 'A') { box.remove(); return i; }
    else if ((k === 'B' || k === 'START') && o.cancel !== false) { box.remove(); return -1; }
  }
}
async function ask(text) {
  await say(text, {keep: true});
  const r = await choose(['SÌ', 'NO'], {x: 118, y: 66, w: 42, cancel: true});
  hideTextBox();
  return r === 0;
}

// Selettore di quantità
async function qty(max, price) {
  let n = 1;
  const box = el('box menu', 84, 70, 76, 28);
  const draw = () => { box.innerHTML = `<div class="it">×${String(n).padStart(2, '0')}  ${price ? (n * price) + 'M' : ''}</div>`; };
  draw();
  for (;;) {
    const k = await waitKey();
    if (k === 'up') n = n >= max ? 1 : n + 1;
    else if (k === 'down') n = n <= 1 ? max : n - 1;
    else if (k === 'right') n = Math.min(max, n + 10);
    else if (k === 'left') n = Math.max(1, n - 10);
    else if (k === 'A') { box.remove(); return n; }
    else if (k === 'B') { box.remove(); return 0; }
    draw();
  }
}

function banner(text) {
  const b = el('box banner', 4, 4, null, 18); b.textContent = text;
  setTimeout(() => b.remove(), 1600);
}

// ------------------------------------------------------------
//  FAUNI: creazione, statistiche, esperienza
// ------------------------------------------------------------
function xpFor(l) { return l <= 1 ? 0 : Math.floor(l * l * l * 0.9); }
function calcStats(m) {
  const b = SPECIES[m.sp].b;
  const s = i => Math.floor((b[i] * 2 + m.iv[i]) * m.lvl / 100);
  return {hp: s(0) + m.lvl + 10, atk: s(1) + 5, def: s(2) + 5, spd: s(3) + 5, spc: s(4) + 5};
}
function movesAt(spId, lvl) {
  const list = SPECIES[spId].learn.filter(([l]) => l <= lvl).map(([, m]) => m);
  const uniq = [...new Set(list)];
  return uniq.slice(-4).map(id => ({id, pp: MOVES[id].pp}));
}
function makeMon(spId, lvl, ot) {
  const m = {sp: spId, name: SPECIES[spId].name, lvl, xp: xpFor(lvl), iv: [0, 0, 0, 0, 0].map(() => rand(0, 15)),
    status: null, slp: 0, ot: ot || null};
  m.st = calcStats(m); m.hp = m.st.hp; m.moves = movesAt(spId, lvl);
  return m;
}
function healMon(m) { m.st = calcStats(m); m.hp = m.st.hp; m.status = null; m.slp = 0; m.moves.forEach(mv => mv.pp = MOVES[mv.id].pp); }
function healParty() { G.party.forEach(healMon); }
function alive(team) { return team.filter(m => m.hp > 0); }
function seen(sp) { G.seen[sp] = 1; }
function caught(sp) { G.seen[sp] = 1; G.caught[sp] = 1; }
function addMon(m) {
  caught(m.sp);
  if (G.party.length < 6) { G.party.push(m); return 'party'; }
  G.box.push(m); return 'box';
}
function addItem(id, n = 1) { G.bag[id] = (G.bag[id] || 0) + n; }
function useItemCount(id) { G.bag[id]--; if (G.bag[id] <= 0) delete G.bag[id]; }
async function give(id, n = 1) {
  addItem(id, n);
  await say(`{NAME} riceve ${n > 1 ? n + ' ' : ''}${ITEMS[id].n}!`);
}
function typeEff(mt, defTypes) { let e = 1; for (const t of defTypes) { const v = (CHART[mt] || {})[t]; if (v != null) e *= v; } return e; }

// ------------------------------------------------------------
//  Mappe
// ------------------------------------------------------------
function tileAt(x, y) {
  if (y < 0 || y >= MAP.rows.length || x < 0 || x >= MAP.rows[0].length) return MAP.indoor ? 'X' : 'T';
  return MAP.rows[y][x];
}
function npcAt(x, y) { return NPCS.find(n => n.visible() && n.x === x && n.y === y); }

function loadMap(id, x, y, dir) {
  MAP = MAPS[id]; mapId = id;
  NPCS = (MAP.npcs || []).map(d => Object.assign({dir: 'down', mv: null}, d, {
    visible: d.show ? d.show : () => true,
  }));
  player.x = x; player.y = y; if (dir) player.dir = dir; player.mv = null;
  G.map = id; G.x = x; G.y = y; G.dir = player.dir;
  if (MAP.name && !MAP.indoor) banner(MAP.name);
}

async function fadeOut() { screenEl.classList.add('fade'); await sleep(180); }
async function fadeIn() { screenEl.classList.remove('fade'); await sleep(120); }
async function warp(id, x, y, dir) {
  await fadeOut();
  loadMap(id, x, y, dir);
  await fadeIn();
  if (MAP.onEnter) await MAP.onEnter();
}

// Movimento a griglia (giocatore e PNG)
const STEP_MS = 170;
function startMove(actor, dir, dist = 1, jump = false) {
  return new Promise(res => {
    actor.dir = dir;
    actor.mv = {dir, t: 0, dist, jump, res, step: (actor.stepToggle = !actor.stepToggle) ? 1 : 2};
  });
}
function updateActor(a, dt) {
  if (!a.mv) return;
  a.mv.t += dt / (STEP_MS * a.mv.dist);
  if (a.mv.t >= 1) {
    const [dx, dy] = DIRS[a.mv.dir];
    a.x += dx * a.mv.dist; a.y += dy * a.mv.dist;
    const r = a.mv.res; a.mv = null; r();
  }
}
function actorPx(a) {
  let px = a.x * TS, py = a.y * TS, hop = 0;
  if (a.mv) {
    const [dx, dy] = DIRS[a.mv.dir];
    px += dx * TS * a.mv.dist * a.mv.t; py += dy * TS * a.mv.dist * a.mv.t;
    if (a.mv.jump) hop = Math.sin(a.mv.t * Math.PI) * 8;
  }
  return [px, py - hop];
}

function passable(x, y, fromDir) {
  const t = tileAt(x, y);
  if (SOLID.has(t)) return false;
  if (t === 'v') return false;
  if (npcAt(x, y)) return false;
  if (player.x === x && player.y === y) return false;
  return true;
}

async function tryMove(dir) {
  player.dir = dir;
  const [dx, dy] = DIRS[dir];
  let nx = player.x + dx, ny = player.y + dy;
  // uscita dal bordo
  if (nx < 0 || ny < 0 || ny >= MAP.rows.length || nx >= MAP.rows[0].length) {
    const link = MAP.links && MAP.links[dir];
    if (!link) return;
    const T = MAPS[link.to];
    let tx = nx, ty = ny;
    if (dir === 'up') { tx = nx + (link.d || 0); ty = T.rows.length - 1; }
    if (dir === 'down') { tx = nx + (link.d || 0); ty = 0; }
    if (dir === 'left') { ty = ny + (link.d || 0); tx = T.rows[0].length - 1; }
    if (dir === 'right') { ty = ny + (link.d || 0); tx = 0; }
    busy = true;
    loadMap(link.to, tx, ty, dir);
    busy = false;
    return;
  }
  const t = tileAt(nx, ny);
  if (t === 'v' && dir === 'down' && passable(nx, ny + 1)) {
    busy = true; await startMove(player, dir, 2, true); busy = false;
    await afterStep(); return;
  }
  if (!passable(nx, ny)) return;
  busy = true;
  await startMove(player, dir);
  busy = false;
  await afterStep();
}

async function afterStep() {
  G.x = player.x; G.y = player.y; G.dir = player.dir;
  const t = tileAt(player.x, player.y);
  // porte
  if (t === 'D' && MAP.doors) {
    const to = MAP.doors[player.x + ',' + player.y];
    if (to) { await run(async () => { const I = MAPS[to]; const e = entryOf(I); await warp(to, e.x, e.y, 'up'); }); return; }
  }
  if (t === 'm' && MAP.exit) {
    await run(async () => { await warp(MAP.exit.to, MAP.exit.x, MAP.exit.y, 'down'); }); return;
  }
  // inneschi
  for (const tr of MAP.triggers || []) {
    const inX = player.x >= tr.x && player.x < tr.x + (tr.w || 1);
    const inY = player.y >= tr.y && player.y < tr.y + (tr.h || 1);
    if (inX && inY && (!tr.when || tr.when())) { await run(tr.run); return; }
  }
  // allenatori che ti vedono
  for (const n of NPCS) {
    if (!n.trainer || !n.visible() || F(trKey(n))) continue;
    const s = n.trainer.sight || 4;
    const [dx, dy] = DIRS[n.dir];
    for (let i = 1; i <= s; i++) {
      const cx = n.x + dx * i, cy = n.y + dy * i;
      if (cx === player.x && cy === player.y) { await run(() => trainerSpot(n, i)); return; }
      if (SOLID.has(tileAt(cx, cy)) || npcAt(cx, cy)) break;
    }
  }
  // incontri nell'erba alta
  if (t === ',' && MAP.wild && Math.random() < (MAP.wild.rate || 0.1)) {
    await run(() => wildEncounter());
  }
}
function entryOf(I) {
  for (let y = 0; y < I.rows.length; y++) { const x = I.rows[y].indexOf('m'); if (x >= 0) return {x, y: y - 1}; }
  return {x: 1, y: 1};
}

async function run(fn) {
  busy = true;
  try { await fn(); } catch (e) {
    console.error(e); hideTextBox();
    // ripristino di sicurezza: mai restare bloccati dentro una lotta
    if (mode === 'battle') { if (B) { B.eh && B.eh.remove(); B.ph && B.ph.remove(); } B = null; FX = []; TR = null; mode = 'world'; }
  }
  finally { busy = false; hideTextBox(); }
}

function trKey(n) { return 'T:' + mapId + ':' + n.id; }

async function npcWalk(n, dirs) { for (const d of dirs) await startMove(n, d); }
async function playerWalk(dirs) { for (const d of dirs) await startMove(player, d); G.x = player.x; G.y = player.y; }
function face(n, dir) { n.dir = dir; }
function faceEachOther(n) {
  if (n.x < player.x) { n.dir = 'right'; player.dir = 'left'; }
  else if (n.x > player.x) { n.dir = 'left'; player.dir = 'right'; }
  else if (n.y < player.y) { n.dir = 'down'; player.dir = 'up'; }
  else { n.dir = 'up'; player.dir = 'down'; }
}

async function trainerSpot(n, dist) {
  n.bang = true; await sleep(700); n.bang = false;
  const [dx, dy] = DIRS[n.dir];
  for (let i = 1; i < dist; i++) await startMove(n, n.dir);
  faceEachOther(n);
  await trainerBattle(n);
}
async function trainerBattle(n) {
  const T = n.trainer;
  await say(T.intro);
  const res = await battle({trainer: Object.assign({look: n.look}, T), canLose: T.canLose});
  if (res === 'win') { setF(trKey(n)); if (T.onWin) await T.onWin(n); }
  return res;
}

async function interact() {
  const [dx, dy] = DIRS[player.dir];
  let tx = player.x + dx, ty = player.y + dy;
  let n = npcAt(tx, ty);
  // parlare attraverso il bancone
  if (!n && tileAt(tx, ty) === 'c') { n = npcAt(tx + dx, ty + dy); }
  if (n) {
    await run(async () => {
      if (n.look !== 'ball' && !n.noTurn) faceEachOther(n);
      if (n.trainer && !F(trKey(n))) { await trainerBattle(n); return; }
      if (n.trainer && F(trKey(n))) { await say(n.trainer.after); return; }
      if (n.talk) await n.talk(n);
      else if (n.item) {
        if (await pickItem(n)) n.show = () => false;
      }
      else if (n.text) { for (const t of [].concat(n.text)) await say(t); }
    });
    return;
  }
  const sign = (MAP.signs || []).find(s => s.x === tx && s.y === ty);
  if (sign) { await run(async () => { for (const t of [].concat(sign.text)) await say(t); }); return; }
  const t = tileAt(tx, ty);
  if (t === 'p' && MAP.pc) { await run(pcMenu); return; }
  if (t === 'b') { await run(() => say('Libri sui FAUNI, mappe vecchie e un ricettario con una pagina piegata.')); return; }
  if (t === 'O' && MAP.spring && F(MAP.spring)) { await run(() => say('La SORGENTE brilla di una luce calda. Ti senti pieno di energia.')); return; }
}
async function pickItem(n) {
  const k = 'I:' + mapId + ':' + n.id;
  if (F(k)) return true;
  setF(k);
  await give(n.item, n.n || 1);
  return true;
}

function worldKey(k) {
  if (k === 'A') interact();
  else if (k === 'START') run(startMenu);
}

// ------------------------------------------------------------
//  Rendering
// ------------------------------------------------------------
function drawWorld() {
  const [ppx, ppy] = actorPx(player);
  const camX = Math.round(ppx - 72), camY = Math.round(ppy - 64);
  const f = Math.floor(frame / 32) % 2;
  const tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
  R(ctx, '#18181e', 0, 0, VW, VH);
  for (let ty = ty0; ty <= ty0 + 10; ty++) for (let tx = tx0; tx <= tx0 + 11; tx++) {
    ctx.drawImage(tileImg(tileAt(tx, ty), f), tx * TS - camX, ty * TS - camY);
  }
  const actors = NPCS.filter(n => n.visible()).concat([player]);
  actors.sort((a, b) => actorPx(a)[1] - actorPx(b)[1]);
  for (const a of actors) {
    const [x, y] = actorPx(a);
    const sx = Math.round(x - camX), sy = Math.round(y - camY);
    const hop = a.mv && a.mv.jump ? Math.sin(a.mv.t * Math.PI) * 8 : 0;
    // ombra
    ctx.fillStyle = 'rgba(20,30,20,.28)';
    ctx.beginPath(); ctx.ellipse(sx + 8, sy + 11 + hop, 6 - hop / 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    const step = a.mv ? (a.mv.t > 0.25 && a.mv.t < 0.75 ? a.mv.step : 0) : 0;
    ctx.drawImage(charImg(a.look, a.dir, step), sx, sy - 4);
    // erba alta che copre le gambe
    const gx = Math.round(x / TS), gy = Math.round(y / TS);
    if (!hop && tileAt(gx, gy) === ',' && a.look !== 'ball') {
      ctx.drawImage(tileImg(',', f), 0, 9, 16, 7, gx * TS - camX, gy * TS - camY + 9, 16, 7);
    }
    if (a.bang) {
      const bx = sx + 3, by = sy - 20 - (frame % 20 < 10 ? 1 : 0);
      R(ctx, K.out, bx, by, 10, 12); R(ctx, '#ffffff', bx + 1, by + 1, 8, 10); R(ctx, '#e24a3a', bx + 4, by + 2, 2, 5); R(ctx, '#e24a3a', bx + 4, by + 8, 2, 2);
    }
  }
}
function drawOverlay() {
  if (!overlay) return;
  if (overlay.type === 'mon') {
    R(ctx, K.out, 50, 18, 60, 60); R(ctx, '#ffffff', 52, 20, 56, 56); R(ctx, '#e8f2ff', 52, 56, 56, 20);
    ctx.drawImage(monSprite(overlay.sp), 56, 22 + (Math.floor(frame / 20) % 2));
  }
}
// transizione d'ingresso in lotta (barre che si chiudono)
let TR = null;
function drawTransition() {
  if (!TR) return;
  const k = TR.k;
  if (TR.type === 'flash') { ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillRect(0, 0, VW, VH); return; }
  ctx.fillStyle = '#101018';
  const n = 9, h = VH / n;
  for (let i = 0; i < n; i++) {
    const w = VW * k;
    if (i % 2) ctx.fillRect(0, i * h, w, h + 1); else ctx.fillRect(VW - w, i * h, w, h + 1);
  }
}
function tween(ms, fn) {
  return new Promise(res => {
    const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(step); else res(); };
    step();
  });
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(50, now - last); last = now; frame++;
  if (G) G.time += dt;
  if (mode === 'world') {
    updateActor(player, dt);
    NPCS.forEach(n => updateActor(n, dt));
    if (!busy && !player.mv && !waiter) {
      const d = heldOrder[heldOrder.length - 1];
      if (d && held[d]) tryMove(d);
    }
    drawWorld(); drawOverlay();
  } else if (mode === 'battle') drawBattle();
  else if (mode === 'title') drawTitle();
  else if (mode === 'intro') drawIntro();
  drawTransition();
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------
//  Menu START
// ------------------------------------------------------------
async function startMenu() {
  let i = 0;
  for (;;) {
    const opts = [];
    if (F('faunario')) opts.push('FAUNARIO');
    if (G.party.length) opts.push('FAUNI');
    opts.push('BORSA', G.name, 'SALVA', 'ESCI');
    i = await choose(opts, {x: 104, y: 0, w: 56, start: Math.min(i, opts.length - 1), rows: 8});
    if (i < 0 || opts[i] === 'ESCI') return;
    const o = opts[i];
    if (o === 'FAUNARIO') await dexMenu();
    else if (o === 'FAUNI') await partyScreen('field');
    else if (o === 'BORSA') await bagMenu('field');
    else if (o === G.name) await trainerCard();
    else if (o === 'SALVA') { if (await ask('Vuoi salvare la partita?')) { saveGame(); await say('{NAME} ha salvato la partita.'); } return; }
  }
}

async function dexMenu() {
  const labels = DEX_ORDER.map((id, i) => {
    const n = String(i + 1).padStart(3, '0');
    return G.caught[id] ? `${n} ●${SPECIES[id].name}` : G.seen[id] ? `${n}  ${SPECIES[id].name}` : `${n}  ----------`;
  });
  const head = el('box', 0, 0, 160, 18);
  head.textContent = `VISTI ${Object.keys(G.seen).length}  PRESI ${Object.keys(G.caught).length}`;
  let i = 0;
  for (;;) {
    i = await choose(labels, {x: 0, y: 18, w: 160, rows: 12, start: i});
    if (i < 0) break;
    const id = DEX_ORDER[i];
    if (!G.seen[id]) continue;
    const sp = SPECIES[id];
    const page = el('box full', 0, 0, 160, 144);
    page.innerHTML = `<canvas class="spr" width="48" height="48"></canvas>
      <div class="dexname">${String(sp.num).padStart(3, '0')} ${sp.name}<br>${sp.types.join('/')}</div>
      <div class="dexdesc">${G.caught[id] ? sp.d : 'Dati incompleti. Cattura questo FAUNO per saperne di più.'}</div>`;
    page.querySelector('canvas').getContext('2d').drawImage(monSprite(id), 0, 0);
    await waitAB(); page.remove();
  }
  head.remove();
}

async function trainerCard() {
  const p = el('box full', 0, 0, 160, 144);
  const t = Math.floor(G.time / 60000);
  p.innerHTML = `<div class="card">TESSERA ALLENATORE<br><br>NOME: ${G.name}<br>MONETE: ${G.money}M<br>FAUNARIO: ${Object.keys(G.caught).length}<br>TEMPO: ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}<br><br>MEDAGLIE:<br>${
    ['CIOTTOLO', '?', '?', '?', '?', '?', '?', '?'].map((n, i) => G.badges.includes(i + 1) ? '◆' + n : '◇').join(' ')}</div>`;
  await waitAB(); p.remove();
}

function hpBar(m) {
  const r = m.hp / m.st.hp;
  const cls = r > .5 ? 'g' : r > .2 ? 'y' : 'r';
  return `<span class="bar"><span class="${cls}" style="width:${Math.round(r * 100)}%"></span></span>`;
}
// Schermata squadra. purpose: field | battle | forced | item
async function partyScreen(purpose, prompt) {
  const page = el('box full', 0, 0, 160, 144);
  let i = 0;
  const draw = () => {
    page.innerHTML = G.party.map((m, j) => `<div class="pm ${j === i ? 'sel' : ''}">
      <canvas width="48" height="48"></canvas>
      <div class="pn">${j === i ? '▶' : ''}${m.name} <span>Lv${m.lvl}</span> ${m.status ? STATUS_LABEL[m.status] : ''}</div>
      <div class="ph">PS ${hpBar(m)} ${m.hp}/${m.st.hp}</div></div>`).join('') +
      `<div class="pprompt">${prompt || 'Scegli un FAUNO.'}</div>`;
    page.querySelectorAll('canvas').forEach((c, j) => c.getContext('2d').drawImage(monSprite(G.party[j].sp), 0, 0));
  };
  draw();
  for (;;) {
    const k = await waitKey();
    if (k === 'up') { i = (i - 1 + G.party.length) % G.party.length; draw(); }
    else if (k === 'down') { i = (i + 1) % G.party.length; draw(); }
    else if (k === 'B' && purpose !== 'forced') { page.remove(); return -1; }
    else if (k === 'A') {
      if (purpose !== 'field') { page.remove(); return i; }
      const c = await choose(['SCHEDA', 'SPOSTA', 'ANNULLA'], {x: 100, y: 100, w: 60});
      if (c === 0) await summary(G.party[i]);
      else if (c === 1) {
        const p2 = el('box', 0, 130, 160, 14); p2.textContent = 'Con chi lo scambi?';
        let j = i;
        for (;;) {
          const k2 = await waitKey();
          if (k2 === 'up') j = (j - 1 + G.party.length) % G.party.length;
          else if (k2 === 'down') j = (j + 1) % G.party.length;
          else if (k2 === 'A') { [G.party[i], G.party[j]] = [G.party[j], G.party[i]]; i = j; break; }
          else if (k2 === 'B') break;
          page.querySelectorAll('.pm').forEach((e, q) => e.classList.toggle('swap', q === j));
        }
        p2.remove();
      }
      draw();
    }
  }
}
async function summary(m) {
  const p = el('box full', 0, 0, 160, 144);
  const sp = SPECIES[m.sp];
  const next = m.lvl < 100 ? xpFor(m.lvl + 1) - m.xp : 0;
  p.innerHTML = `<canvas class="spr" width="48" height="48"></canvas>
    <div class="dexname">${m.name}<br>Lv${m.lvl} ${sp.types.join('/')}<br>PS ${m.hp}/${m.st.hp}</div>
    <div class="stats">ATT ${m.st.atk}  DIF ${m.st.def}<br>VEL ${m.st.spd}  SPE ${m.st.spc}<br>ESP. AL PROSSIMO LV: ${next}<br>STATO: ${m.status ? STATUS_LABEL[m.status] : 'OK'}<br><br>${
      m.moves.map(mv => `${MOVES[mv.id].n} <span class="r">${mv.pp}/${MOVES[mv.id].pp}</span>`).join('<br>')}</div>`;
  p.querySelector('canvas').getContext('2d').drawImage(monSprite(m.sp), 0, 0);
  await waitAB(); p.remove();
}

// Borsa. Ritorna {item, target} in lotta, oppure null.
async function bagMenu(ctxName) {
  for (;;) {
    const ids = Object.keys(G.bag).filter(id => G.bag[id] > 0);
    if (!ids.length) { await say('La BORSA è vuota.'); return null; }
    const labels = ids.map(id => `${ITEMS[id].n}${ITEMS[id].key ? '' : ' ×' + G.bag[id]}`).concat(['CHIUDI']);
    const i = await choose(labels, {x: 30, y: 0, w: 130, rows: 8});
    if (i < 0 || i === ids.length) return null;
    const id = ids[i], it = ITEMS[id];
    if (it.key) { await say(it.d); continue; }
    if (it.ball) {
      if (ctxName !== 'battle') { await say('Non è il momento di usarla!'); continue; }
      return {item: id};
    }
    if (it.heal || it.cure) {
      const t = await partyScreen('item', 'Su quale FAUNO?');
      if (t < 0) continue;
      const m = G.party[t];
      const ok = await applyItem(id, m);
      if (ok && ctxName === 'battle') return {item: id, target: t, done: true};
      continue;
    }
  }
}
async function applyItem(id, m) {
  const it = ITEMS[id];
  if (it.heal) {
    if (m.hp <= 0 || m.hp >= m.st.hp) { await say('Non avrebbe alcun effetto.'); return false; }
    const before = m.hp; m.hp = Math.min(m.st.hp, m.hp + it.heal); useItemCount(id);
    await say(`${m.name} recupera ${m.hp - before} PS.`); return true;
  }
  if (it.cure) {
    if (m.status !== it.cure) { await say('Non avrebbe alcun effetto.'); return false; }
    m.status = null; m.slp = 0; useItemCount(id);
    await say(`${m.name} sta di nuovo bene.`); return true;
  }
  return false;
}

// Negozio
async function shop(items) {
  await say('Benvenuto alla BOTTEGA! Come posso aiutarti?', {keep: true});
  for (;;) {
    const c = await choose(['COMPRA', 'VENDI', 'ESCI'], {x: 104, y: 60, w: 56});
    hideTextBox();
    if (c === 0) {
      for (;;) {
        const money = el('box', 0, 0, 70, 18); money.textContent = G.money + 'M';
        const labels = items.map(id => `${ITEMS[id].n.padEnd(12, ' ')}${String(ITEMS[id].price).padStart(5, ' ')}`).concat(['ANNULLA']);
        const i = await choose(labels, {x: 20, y: 22, w: 140, rows: 7});
        if (i < 0 || i === items.length) { money.remove(); break; }
        const id = items[i];
        const max = Math.min(99, Math.floor(G.money / ITEMS[id].price));
        if (max < 1) { money.remove(); await say('Non hai abbastanza monete.'); continue; }
        const n = await qty(max, ITEMS[id].price);
        money.remove();
        if (!n) continue;
        if (await ask(`${ITEMS[id].n} ×${n}: sono ${n * ITEMS[id].price} monete. Va bene?`)) {
          G.money -= n * ITEMS[id].price; addItem(id, n);
          await say('Ecco a te! Grazie mille!');
        }
      }
    } else if (c === 1) {
      const ids = Object.keys(G.bag).filter(id => !ITEMS[id].key);
      if (!ids.length) { await say('Non hai niente da vendere.'); continue; }
      const i = await choose(ids.map(id => `${ITEMS[id].n} ×${G.bag[id]}`), {x: 20, y: 0, w: 140, rows: 8});
      if (i < 0) continue;
      const id = ids[i], price = Math.floor(ITEMS[id].price / 2);
      const n = await qty(G.bag[id], price);
      if (n && await ask(`Posso darti ${n * price} monete. Affare fatto?`)) {
        G.bag[id] -= n; if (!G.bag[id]) delete G.bag[id]; G.money += n * price;
      }
    } else { await say('Torna presto!'); return; }
    await say('Serve altro?', {keep: true});
  }
}

async function nurse() {
  if (await ask('Benvenuto al CENTRO CURA! Vuoi che rimetta in forma i tuoi FAUNI?')) {
    await say('Lascia fare a me...', {auto: 300, keep: true});
    screenEl.classList.add('flash'); await sleep(900); screenEl.classList.remove('flash');
    healParty();
    G.lastHeal = {map: MAP.exit.to, x: MAP.exit.x, y: MAP.exit.y};
    await say('Fatto! I tuoi FAUNI sono in piena forma. Torna quando vuoi!');
  } else await say('Torna quando vuoi!');
}

async function pcMenu() {
  await say('{NAME} accende il PC. Accesso al BOX dei FAUNI.', {keep: true});
  for (;;) {
    const c = await choose(['PRELEVA', 'DEPOSITA', 'ESCI'], {x: 96, y: 60, w: 64});
    hideTextBox();
    if (c === 0) {
      if (!G.box.length) { await say('Il BOX è vuoto.'); continue; }
      if (G.party.length >= 6) { await say('La tua squadra è al completo.'); continue; }
      const i = await choose(G.box.map(m => `${m.name} Lv${m.lvl}`), {x: 40, y: 0, w: 120, rows: 9});
      if (i >= 0) { const m = G.box.splice(i, 1)[0]; G.party.push(m); await say(`${m.name} si unisce alla squadra.`); }
    } else if (c === 1) {
      if (G.party.length <= 1) { await say('Non puoi restare senza FAUNI!'); continue; }
      const i = await partyScreen('item', 'Chi depositi?');
      if (i >= 0) { const m = G.party.splice(i, 1)[0]; healMon(m); G.box.push(m); await say(`${m.name} è stato depositato nel BOX.`); }
    } else return;
  }
}

// ------------------------------------------------------------
//  Lotta
// ------------------------------------------------------------
const stMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const zeroStages = () => ({atk: 0, def: 0, spd: 0, spc: 0, acc: 0});
// posizioni sullo schermo
const POS = {e: {x: 100, y: 8, cx: 124, cy: 32, base: 56}, p: {x: 14, y: 54, cx: 38, cy: 78, base: 102}};

// ---------- particelle ----------
let FX = [];
function fx(p) { p.t = -(p.delay || 0); p.life = p.life || 500; FX.push(p); return p; }
function updFx(dt) { for (const p of FX) p.t += dt; FX = FX.filter(p => p.t < p.life); }
function star(g, x, y, r, c) { R(g, c, x - r, y, r * 2 + 1, 1); R(g, c, x, y - r, 1, r * 2 + 1); if (r > 1) R(g, c, x - 1, y - 1, 3, 3); }
function drawFx() {
  for (const p of FX) {
    if (p.t < 0) continue;
    const k = p.t / p.life;
    let x, y;
    if (p.path) [x, y] = p.path(k);
    else { const s = p.t / 1000; x = p.x + (p.vx || 0) * s; y = p.y + (p.vy || 0) * s + 0.5 * (p.ay || 0) * s * s; }
    x = Math.round(x); y = Math.round(y);
    const g = ctx;
    switch (p.kind) {
      case 'flame': {
        const h = 7 - Math.floor(k * 4), fl = frame % 6 < 3;
        R(g, '#e8402a', x - 2, y - h + 2, 5, h); R(g, '#ff9a2a', x - 1, y - h + 3, 3, h - 2); R(g, '#fff27a', x, y - 2, 1, 2);
        if (fl) R(g, '#ff9a2a', x - 1, y - h, 1, 2); else R(g, '#ff9a2a', x + 1, y - h, 1, 2);
        break; }
      case 'bubble': { const r = p.r || 3; g.strokeStyle = '#4a9af2'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = 'rgba(160,215,255,.7)'; g.fill(); R(g, '#ffffff', x - 1, y - 1, 1, 1); break; }
      case 'drop': R(g, '#3a7ad8', x - 1, y - 2, 3, 4); R(g, '#a8d8ff', x, y - 1, 1, 2); break;
      case 'leaf': { const a = k * 12 + (p.seed || 0); const dx = Math.round(Math.cos(a) * 2), dy = Math.round(Math.sin(a) * 2);
        R(g, '#2a7a2a', x - 2 + dx, y - 1, 5, 3); R(g, '#7ad25a', x - 1 + dx, y - 1 + (dy > 0 ? 1 : 0), 3, 1); R(g, '#2a7a2a', x + dx, y - 2 - dy, 1, 5); break; }
      case 'bolt': {
        g.strokeStyle = '#fff27a'; g.lineWidth = 3; g.beginPath(); let bx = p.x, by = p.y0 || 0; g.moveTo(bx, by);
        const seed = p.seed || 1;
        for (let i = 1; i <= 6; i++) { bx = p.x + ((i * 7 * seed) % 11) - 5; by = (p.y0 || 0) + (p.y - (p.y0 || 0)) * i / 6; g.lineTo(bx, by); }
        g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke(); break; }
      case 'rock': R(g, '#4a4238', x - 3, y - 3, 7, 7); R(g, '#a2927a', x - 2, y - 2, 5, 5); R(g, '#d2c2a2', x - 2, y - 2, 2, 2); break;
      case 'dust': { const r = 2 + k * 5; g.fillStyle = `rgba(200,180,140,${1 - k})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); break; }
      case 'slash': { g.strokeStyle = `rgba(255,255,255,${1 - k * .6})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12, p.a0 || 3.6, (p.a0 || 3.6) + 1.6 * Math.min(1, k * 3)); g.stroke(); g.strokeStyle = 'rgba(160,220,255,.8)'; g.lineWidth = 1; g.stroke(); break; }
      case 'orb': { const r = 3 + Math.sin(k * 6) ; g.fillStyle = '#2a1a3a'; g.beginPath(); g.arc(x, y, r + 1, 0, 7); g.fill(); g.fillStyle = '#7a4aba'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); R(g, '#d2a2ff', x - 1, y - 1, 1, 1); break; }
      case 'ring': { const r = 4 + k * (p.rmax || 26); g.strokeStyle = `rgba(242,110,200,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); break; }
      case 'needle': R(g, '#2a6a1a', x - 1, y, 3, 1); R(g, '#9ae25a', x + 2, y, 2, 1); break;
      case 'poison': { const r = 2 + Math.round(k * 2); g.fillStyle = '#8a3ab2'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); R(g, '#e2a2ff', x - 1, y - 1, 1, 1); break; }
      case 'star': star(g, x, y, k < .5 ? 3 : 2, k < .5 ? '#fff27a' : '#ffffff'); break;
      case 'spark': star(g, x, y, 1, frame % 4 < 2 ? '#ffffff' : '#fff27a'); break;
      case 'hit': { const r = 3 + Math.round(k * 9); star(g, x, y, r, '#ffffff'); star(g, x, y, Math.max(1, r - 3), '#fff27a'); break; }
      case 'z': { const c = '#4a7ad8'; R(g, c, x, y, 5, 1); R(g, c, x + 3, y + 1, 1, 1); R(g, c, x + 2, y + 2, 1, 1); R(g, c, x + 1, y + 3, 1, 1); R(g, c, x, y + 4, 5, 1); break; }
      case 'up': case 'down': {
        const c = p.kind === 'up' ? '#4a9af2' : '#e24a4a'; const d = p.kind === 'up' ? 1 : -1;
        R(g, c, x - 1, y - 3, 3, 7); for (let i = 0; i < 3; i++) R(g, c, x - 3 + i, y - d * (3 - i) - (d < 0 ? 0 : 0), 1, 1), R(g, c, x + 3 - i, y - d * (3 - i), 1, 1);
        R(g, '#ffffff', x, y - 2, 1, 4); break; }
      case 'heal': star(g, x, y, 2, frame % 6 < 3 ? '#7ae25a' : '#ffffff'); break;
      case 'puff': { const r = 3 + k * 14; g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); break; }
      case 'ball': { const sp = charImg('ball', 'down', 0); g.save(); g.translate(x, y); g.rotate(p.rot ? p.rot(k) : k * 12); g.drawImage(sp, -8, -9); g.restore(); break; }
    }
  }
}
const arc = (x0, y0, x1, y1, h) => k => [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * h];
const line = (x0, y0, x1, y1) => k => [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];

// Animazione di un attacco, in base al tipo
async function moveAnim(side, d) {
  const U = POS[side], T = POS[side === 'p' ? 'e' : 'p'];
  const dir = side === 'p' ? 1 : -1;
  // slancio in avanti
  const off = side === 'p' ? 'pOff' : 'eOff';
  await tween(110, k => { B[off] = {x: dir * 8 * k, y: -dir * 3 * k}; });
  await tween(110, k => { B[off] = {x: dir * 8 * (1 - k), y: -dir * 3 * (1 - k)}; });
  B[off] = null;
  const tx = T.cx, ty = T.cy, ux = U.cx, uy = U.cy;
  const rnd = (a) => (Math.random() - .5) * a;
  let wait = 450;
  switch (d.t) {
    case 'FUOCO':
      for (let i = 0; i < 6; i++) fx({kind: 'flame', path: line(ux, uy, tx + rnd(16), ty + rnd(10)), life: 300, delay: i * 50});
      for (let i = 0; i < 10; i++) fx({kind: 'flame', x: tx + rnd(30), y: ty + 10 + rnd(10), vy: -30, life: 500, delay: 300 + i * 30});
      wait = 750; break;
    case 'ACQUA':
      for (let i = 0; i < 12; i++) fx({kind: 'bubble', r: 2 + (i % 3), path: line(ux, uy, tx + rnd(20), ty + rnd(14)), life: 380, delay: i * 35});
      for (let i = 0; i < 8; i++) fx({kind: 'drop', x: tx + rnd(10), y: ty, vx: rnd(120), vy: -60 - Math.random() * 40, ay: 300, life: 450, delay: 450});
      wait = 850; break;
    case 'PIANTA':
      if (d.fx && d.fx.drain) {
        for (let i = 0; i < 10; i++) fx({kind: 'heal', path: arc(tx + rnd(16), ty + rnd(16), ux, uy, 20 + rnd(20)), life: 500, delay: i * 50});
        wait = 900; break;
      }
      for (let i = 0; i < 8; i++) fx({kind: 'leaf', seed: i, path: arc(ux, uy, tx + rnd(18), ty + rnd(14), 14 + i * 2), life: 420, delay: i * 50});
      wait = 820; break;
    case 'ELETTRO':
      for (let i = 0; i < 3; i++) fx({kind: 'bolt', x: tx + rnd(16), y: ty + 8, y0: ty - 34, seed: i + 2, life: 140, delay: i * 140});
      for (let i = 0; i < 8; i++) fx({kind: 'spark', x: tx + rnd(36), y: ty + rnd(30), life: 300, delay: 100 + i * 40});
      B.flash = {c: '255,250,180', t0: performance.now(), ms: 420};
      wait = 600; break;
    case 'ROCCIA':
      for (let i = 0; i < 6; i++) fx({kind: 'rock', path: line(tx + rnd(30), ty - 40, tx + rnd(22), ty + 6 + rnd(6)), life: 260, delay: i * 70});
      for (let i = 0; i < 5; i++) fx({kind: 'dust', x: tx + rnd(30), y: ty + 14, life: 400, delay: 300 + i * 50});
      wait = 750; B.shakeT = performance.now() + 700; break;
    case 'VENTO':
      for (let i = 0; i < 4; i++) fx({kind: 'slash', x: tx + rnd(10), y: ty + rnd(10), a0: 3.4 + i * .5, life: 260, delay: i * 90});
      for (let i = 0; i < 6; i++) fx({kind: 'spark', path: line(tx - 30, ty + rnd(24), tx + 30, ty + rnd(24)), life: 280, delay: i * 50});
      wait = 650; break;
    case 'OMBRA':
      B.dark = {t0: performance.now(), ms: 700};
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; fx({kind: 'orb', path: line(tx + Math.cos(a) * 34, ty + Math.sin(a) * 26, tx, ty), life: 420, delay: i * 30}); }
      wait = 700; break;
    case 'MENTE':
      for (let i = 0; i < 4; i++) fx({kind: 'ring', x: tx, y: ty, life: 450, delay: i * 120});
      B.wave = {t0: performance.now(), ms: 700};
      wait = 800; break;
    case 'INSETTO':
      for (let i = 0; i < 7; i++) fx({kind: 'needle', path: line(ux, uy + rnd(10), tx + rnd(16), ty + rnd(16)), life: 220, delay: i * 50});
      wait = 600; break;
    case 'VELENO':
      for (let i = 0; i < 6; i++) fx({kind: 'poison', path: arc(ux, uy, tx + rnd(16), ty + rnd(10), 18), life: 360, delay: i * 50});
      for (let i = 0; i < 8; i++) fx({kind: 'poison', x: tx + rnd(30), y: ty + 14, vy: -35, life: 500, delay: 400 + i * 30});
      wait = 900; break;
    default:
      if (d.p) { fx({kind: 'hit', x: tx + rnd(8), y: ty + rnd(8), life: 220}); fx({kind: 'hit', x: tx + rnd(16), y: ty + rnd(16), life: 220, delay: 120}); wait = 380; }
      else wait = 100;
  }
  await sleep(wait);
}
async function statAnim(side, up) {
  const P = POS[side];
  for (let i = 0; i < 6; i++) fx({kind: up ? 'up' : 'down', x: P.cx - 18 + (i % 3) * 18, y: up ? P.cy + 18 : P.cy - 18, vy: up ? -50 : 50, life: 550, delay: i * 70});
  await sleep(800);
}
async function statusAnim(side, st) {
  const P = POS[side];
  const kind = {psn: 'poison', brn: 'flame', par: 'spark', slp: 'z'}[st];
  for (let i = 0; i < 6; i++) fx({kind, x: P.cx + (Math.random() - .5) * 30, y: P.cy + (st === 'slp' ? -6 : 10), vx: st === 'slp' ? 12 : 0, vy: st === 'par' ? 0 : -30, life: 550, delay: i * 80});
  await sleep(700);
}
async function hitAnim(side, eff) {
  B.blink = {who: side};
  if (eff > 1) B.shakeT = performance.now() + 380;
  await sleep(380); B.blink = null;
}

// ---------- disegno della scena ----------
function drawSprite(img, x, y, scale = 1, alpha = 1, clipY = null) {
  ctx.save();
  if (clipY != null) { ctx.beginPath(); ctx.rect(0, 0, VW, clipY); ctx.clip(); }
  ctx.globalAlpha = alpha;
  const w = 48 * scale, h = 48 * scale;
  ctx.drawImage(img, Math.round(x + (48 - w) / 2), Math.round(y + (48 - h)), Math.round(w), Math.round(h));
  ctx.restore();
}
function drawBattleBg() {
  // cielo e prato
  const sky = ctx.createLinearGradient(0, 0, 0, 70);
  sky.addColorStop(0, '#d8f0ff'); sky.addColorStop(1, '#f6fbe8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, 70);
  R(ctx, '#e2f2c2', 0, 46, VW, VH - 46);
  for (let x = 0; x < VW; x += 8) R(ctx, '#cfe6a8', x + ((x / 8) % 2) * 3, 66, 2, 1);
  // pedane
  const plat = (cx, cy, rx, ry) => {
    ctx.fillStyle = '#6aa24a'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#a2d87a'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c2ea9a'; ctx.beginPath(); ctx.ellipse(cx - rx * .2, cy - ry * .3, rx * .55, ry * .45, 0, 0, 7); ctx.fill();
  };
  plat(124, 52, 34, 8);
  plat(40, 98, 42, 9);
}
function drawBattle() {
  updFx(16);
  ctx.save();
  if (B && B.shakeT && performance.now() < B.shakeT) ctx.translate((frame % 4 < 2 ? 2 : -2), (frame % 6 < 3 ? 1 : -1));
  drawBattleBg();
  if (B) {
    const now = performance.now();
    const blink = n => B.blink && B.blink.who === n && Math.floor(frame / 4) % 2;
    const wave = B.wave && now - B.wave.t0 < B.wave.ms ? Math.sin(frame / 2) * 3 : 0;
    // avversario
    if (B.trainerPic) drawSprite(B.trainerPic.img, POS.e.x + B.trainerPic.x, POS.e.y, 1);
    if (B.e && !B.eHidden && !blink('e')) {
      const o = B.eOff || {x: 0, y: 0};
      const img = B.eWhite ? monSilhouette(B.e.sp) : monSprite(B.e.sp);
      drawSprite(img, POS.e.x + (B.eSlide || 0) + o.x + wave, POS.e.y + (B.eDrop || 0) + o.y, B.eScale ?? 1, 1, B.eDrop ? POS.e.base : null);
    }
    // giocatore
    if (B.playerPic) drawSprite(B.playerPic.img, POS.p.x + B.playerPic.x, POS.p.y, 1);
    const pm = B.pm != null ? G.party[B.pm] : null;
    if (pm && !B.pHidden && !blink('p')) {
      const o = B.pOff || {x: 0, y: 0};
      const img = B.pWhite ? monSilhouette(pm.sp) : monSprite(pm.sp, true);
      drawSprite(img, POS.p.x + (B.pSlide || 0) + o.x - wave, POS.p.y + (B.pDrop || 0) + o.y, B.pScale ?? 1, 1, B.pDrop ? POS.p.base + 2 : null);
    }
    // evoluzione
    if (B.evo) {
      ctx.fillStyle = B.evo.bg; ctx.fillRect(0, 0, VW, VH);
      drawSprite(B.evo.img, 56, 26, 1);
    }
    drawFx();
    if (B.dark && now - B.dark.t0 < B.dark.ms) { ctx.fillStyle = `rgba(30,10,50,${0.45 * Math.sin((now - B.dark.t0) / B.dark.ms * Math.PI)})`; ctx.fillRect(-4, -4, VW + 8, VH + 8); }
    if (B.flash && now - B.flash.t0 < B.flash.ms) { const a = (now - B.flash.t0) % 140 < 70 ? .55 : 0; ctx.fillStyle = `rgba(${B.flash.c},${a})`; ctx.fillRect(-4, -4, VW + 8, VH + 8); }
  }
  ctx.restore();
}
function bigChar(look, dir) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(charImg(look, dir, 0), 0, 0, 16, 16, 0, 0, 48, 48);
  return c;
}

// ---------- HUD ----------
function hudHtml(m, enemy) {
  const xp = m._dxp != null ? m._dxp : xpPct(m);
  return `<div class="hn">${m.name}${m.status ? ` <i class="st ${m.status}">${STATUS_LABEL[m.status]}</i>` : ''}</div>
    <div class="hl">Lv${m.lvl}</div><div class="hb"><b>PS</b>${hpBar({hp: m._dhp ?? m.hp, st: m.st})}</div>
    ${enemy ? '' : `<div class="hp">${Math.ceil(m._dhp ?? m.hp)}/${m.st.hp}</div><div class="xp"><span style="width:${xp}%"></span></div>`}`;
}
function xpPct(m) { if (m.lvl >= 100) return 0; const a = xpFor(m.lvl), b = xpFor(m.lvl + 1); return clamp(Math.round((m.xp - a) / (b - a) * 100), 0, 100); }
function hud() {
  if (!B) return;
  if (B.e && !B.eHidden && !B.hideHud) { B.eh.style.display = ''; B.eh.innerHTML = hudHtml(B.e, true); } else B.eh.style.display = 'none';
  const pm = G.party[B.pm];
  if (pm && !B.pHidden && !B.hideHud) { B.ph.style.display = ''; B.ph.innerHTML = hudHtml(pm, false); } else B.ph.style.display = 'none';
}
async function animHp(m) {
  if (m._dhp == null) m._dhp = m.hp;
  const from = m._dhp, diff = m.hp - from; if (!diff) return;
  await tween(Math.min(900, 250 + Math.abs(diff) * 25), k => { m._dhp = from + diff * k; hud(); });
  m._dhp = m.hp; hud();
}
const eName = () => B.wild ? `${B.e.name} selvatico` : `${B.e.name} nemico`;
const nameOf = side => side === 'p' ? G.party[B.pm].name : eName();

// ---------- flusso della lotta ----------
async function battleTransition() {
  for (let i = 0; i < 2; i++) { await tween(110, k => { TR = {type: 'flash', k: k}; }); await tween(110, k => { TR = {type: 'flash', k: 1 - k}; }); }
  await tween(420, k => { TR = {type: 'bars', k}; });
}
async function battle(opts) {
  hideTextBox();
  await battleTransition();
  mode = 'battle'; FX = [];
  B = {wild: !!opts.wild, trainer: opts.trainer, canLose: opts.canLose, stages: {p: zeroStages(), e: zeroStages()},
    runs: 0, part: new Set(), levelled: new Set(), pm: null};
  B.eh = el('box hud ehud', 4, 6, 92, 28);
  B.ph = el('box hud phud', 68, 60, 90, 38);
  B.team = opts.wild ? [opts.wild] : opts.trainer.team.map(([sp, l]) => makeMon(sp, l));
  B.ei = 0; B.e = B.team[0]; B.e._dhp = B.e.hp; seen(B.e.sp);
  B.pHidden = true; B.hideHud = true;
  B.playerPic = {img: bigChar('player', 'up'), x: 120};
  if (B.wild) B.eSlide = -110; else { B.eHidden = true; B.trainerPic = {img: bigChar(opts.trainer.look || 'man', 'down'), x: -110}; }
  hud();
  await tween(450, k => { TR = {type: 'bars', k: 1 - k}; });
  TR = null;
  await tween(600, k => {
    const e = 1 - Math.pow(1 - k, 3);
    if (B.wild) B.eSlide = -110 * (1 - e); else B.trainerPic.x = -110 * (1 - e);
    B.playerPic.x = 120 * (1 - e);
  });
  B.eSlide = 0;
  if (B.wild) { B.hideHud = false; hud(); await say(`Appare un ${B.e.name} selvatico!`); }
  else {
    await say(`${opts.trainer.cls} ${opts.trainer.name} vuole lottare!`);
    await tween(350, k => { B.trainerPic.x = 90 * k; });
    B.trainerPic = null;
    await enemySendOut(`${opts.trainer.cls} ${opts.trainer.name} manda in campo ${B.e.name}!`);
  }
  B.pm = G.party.findIndex(m => m.hp > 0);
  await tween(300, k => { B.playerPic.x = -90 * k; });
  B.playerPic = null;
  await sendOut();
  let result = null;
  while (!result) {
    const act = await chooseAction();
    result = await doTurn(act);
  }
  if (result === 'win' || result === 'catch') await afterBattleEvolve();
  G.party.forEach(m => { delete m._dhp; delete m._dxp; });
  hideTextBox();
  await tween(300, k => { TR = {type: 'bars', k}; });
  B.eh.remove(); B.ph.remove();
  B = null; FX = [];
  if (result === 'lose') {
    if (opts.canLose) healParty();
    else { mode = 'world'; TR = null; await whiteout(); }
  }
  mode = 'world';
  await tween(300, k => { TR = {type: 'bars', k: 1 - k}; });
  TR = null;
  return result;
}
async function popOut(side) {
  const P = POS[side];
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; fx({kind: 'star', x: P.cx + Math.cos(a) * 6, y: P.cy + 10 + Math.sin(a) * 6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 380}); }
  fx({kind: 'puff', x: P.cx, y: P.cy + 10, life: 350});
  const W = side === 'p' ? 'pWhite' : 'eWhite', S = side === 'p' ? 'pScale' : 'eScale', H = side === 'p' ? 'pHidden' : 'eHidden';
  B[H] = false; B[W] = true;
  await tween(260, k => { B[S] = 0.2 + 0.8 * k; });
  B[S] = 1; await sleep(80); B[W] = false;
}
async function enemySendOut(text) {
  msg(text);
  const P = POS.e;
  fx({kind: 'ball', path: arc(170, 20, P.cx, P.cy + 12, 26), life: 420});
  await sleep(430);
  await popOut('e');
  B.hideHud = false; hud();
  await sleep(350);
}
async function sendOut() {
  const m = G.party[B.pm]; m._dhp = m.hp; B.part.add(B.pm); B.stages.p = zeroStages();
  msg(`Vai, ${m.name}!`);
  const P = POS.p;
  fx({kind: 'ball', path: arc(-10, 70, P.cx, P.cy + 12, 30), life: 420});
  await sleep(430);
  await popOut('p');
  B.hideHud = false; hud();
  await sleep(300);
}

async function chooseAction() {
  for (;;) {
    const m = G.party[B.pm];
    await say(`Cosa farà\n${m.name}?`, {noWait: true, keep: true});
    const box = el('box menu grid', 80, 100, 80, 44);
    const opts = ['LOTTA', 'BORSA', 'FAUNI', 'FUGA'];
    let i = B.lastAct || 0;
    const draw = () => { box.innerHTML = opts.map((s, j) => `<div class="it">${j === i ? '▶' : '&nbsp;'}${s}</div>`).join(''); };
    draw();
    let pick = -1;
    while (pick < 0) {
      const k = await waitKey();
      if (k === 'up' || k === 'down') i ^= 2;
      else if (k === 'left' || k === 'right') i ^= 1;
      else if (k === 'A') pick = i;
      draw();
    }
    box.remove(); B.lastAct = pick;
    const o = opts[pick];
    if (o === 'LOTTA') {
      const mv = await moveMenu(m);
      if (mv == null) continue;
      if (m.moves.every(x => x.pp <= 0)) return {type: 'move', id: 'botta', struggle: true};
      return {type: 'move', idx: mv};
    }
    if (o === 'FAUNI') {
      hideTextBox();
      const t = await partyScreen('battle', 'Chi mandi in campo?');
      if (t < 0) continue;
      if (G.party[t].hp <= 0) { await say(`${G.party[t].name} non ha energie per lottare!`); continue; }
      if (t === B.pm) { await say(`${G.party[t].name} è già in campo!`); continue; }
      return {type: 'switch', to: t};
    }
    if (o === 'BORSA') {
      hideTextBox();
      const r = await bagMenu('battle');
      if (!r) continue;
      return {type: 'item', ...r};
    }
    return {type: 'run'};
  }
}
async function moveMenu(m) {
  const info = el('box', 0, 64, 76, 36);
  const show = i => {
    const mv = m.moves[i]; const d = MOVES[mv.id];
    info.innerHTML = `TIPO/<br>&nbsp;<i class="ty t-${d.t}">${d.t}</i><br><span class="r">PP ${mv.pp}/${d.pp}</span>`;
  };
  for (;;) {
    const i = await choose(m.moves.map(x => MOVES[x.id].n), {x: 40, y: 96, w: 120, rows: 4, onMove: show, start: B.lastMove || 0});
    if (i < 0) { info.remove(); return null; }
    if (m.moves.every(x => x.pp <= 0)) { info.remove(); await say(`${m.name} non ha più PP!`); return 0; }
    if (m.moves[i].pp <= 0) { await say('Non ci sono più PP per questa mossa!', {keep: true}); continue; }
    info.remove(); B.lastMove = i; return i;
  }
}

function speedOf(m, side) { return m.st.spd * stMul(B.stages[side].spd) * (m.status === 'par' ? .25 : 1); }
function enemyMoveIdx() {
  const e = B.e, p = G.party[B.pm];
  const opts = e.moves.map((mv, i) => ({mv, i})).filter(o => o.mv.pp > 0);
  if (!opts.length) return -1;
  const w = opts.map(({mv}) => {
    const d = MOVES[mv.id];
    if (!d.p) return d.fx && d.fx.st && p.status ? 0.1 : 0.6;
    let s = d.p * typeEff(d.t, SPECIES[p.sp].types);
    if (SPECIES[e.sp].types.includes(d.t)) s *= 1.5;
    return Math.max(0.05, s / 40);
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) return opts[k].i; }
  return opts[0].i;
}

async function doTurn(act) {
  const p = () => G.party[B.pm];
  const eIdx = enemyMoveIdx();
  const eMove = eIdx >= 0 ? B.e.moves[eIdx] : null;
  if (act.type === 'run') {
    if (!B.wild) { await say('Non puoi fuggire da una lotta tra allenatori!'); return null; }
    B.runs++;
    const ps = speedOf(p(), 'p'), es = speedOf(B.e, 'e');
    if (ps >= es || Math.random() < 0.35 + 0.2 * B.runs) { await say('Sei scappato senza problemi!'); return 'run'; }
    await say('Non riesci a scappare!');
  } else if (act.type === 'switch') {
    await say(`Basta così, ${p().name}! Torna qui!`, {noWait: true, keep: true});
    B.pWhite = true; await tween(250, k => { B.pScale = 1 - k; }); B.pHidden = true; B.pWhite = false; B.pScale = 1; hud();
    B.pm = act.to; await sendOut();
  } else if (act.type === 'item') {
    if (ITEMS[act.item].ball) {
      const r = await throwBall(act.item);
      if (r) return r;
    } else {
      const P = POS.p;
      for (let i = 0; i < 8; i++) fx({kind: 'heal', x: P.cx + (Math.random() - .5) * 30, y: P.cy + 14, vy: -40, life: 500, delay: i * 60});
      await sleep(600); hud();
    }
  }
  const order = [];
  if (act.type === 'move') {
    const pmv = act.struggle ? {id: 'botta', pp: 99} : p().moves[act.idx];
    const pp = MOVES[pmv.id].prio || 0, ep = eMove ? (MOVES[eMove.id].prio || 0) : -9;
    const pFirst = pp > ep || (pp === ep && (speedOf(p(), 'p') > speedOf(B.e, 'e') || (speedOf(p(), 'p') === speedOf(B.e, 'e') && Math.random() < .5)));
    const pa = ['p', pmv], ea = ['e', eMove];
    if (pFirst) order.push(pa, ea); else order.push(ea, pa);
  } else order.push(['e', eMove]);
  for (const [side, mv] of order) {
    const user = side === 'p' ? p() : B.e;
    if (user.hp <= 0) continue;
    const foe = side === 'p' ? B.e : p();
    if (foe.hp <= 0) continue;
    await useMove(side, mv || {id: 'botta', pp: 99});
    const r = await checkFaints();
    if (r !== undefined) return r;
  }
  for (const side of ['p', 'e']) {
    const m = side === 'p' ? p() : B.e;
    if (m.hp > 0 && (m.status === 'psn' || m.status === 'brn')) {
      await statusAnim(side, m.status);
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.st.hp / 8)));
      msg(`${nameOf(side)} soffre per ${m.status === 'psn' ? 'il veleno' : 'la scottatura'}!`);
      await animHp(m); await sleep(400);
      const r = await checkFaints();
      if (r !== undefined) return r;
    }
  }
  return null;
}

async function useMove(side, mv) {
  const user = side === 'p' ? G.party[B.pm] : B.e;
  const foeSide = side === 'p' ? 'e' : 'p';
  const foe = foeSide === 'p' ? G.party[B.pm] : B.e;
  const d = MOVES[mv.id];
  const uName = nameOf(side);
  if (user.status === 'slp') {
    user.slp--;
    if (user.slp > 0) { await statusAnim(side, 'slp'); await say(`${uName} dorme profondamente.`, {keep: true}); return; }
    user.status = null; hud(); await say(`${uName} si è svegliato!`, {keep: true});
  }
  if (user.status === 'par' && Math.random() < .25) { await statusAnim(side, 'par'); await say(`${uName} è paralizzato! Non riesce a muoversi!`, {keep: true}); return; }
  if (mv.pp < 99) mv.pp = Math.max(0, mv.pp - 1);
  msg(`${uName} usa ${d.n}!`);
  await sleep(300);
  const st = B.stages[side];
  const selfTarget = d.fx && (d.fx.heal || (d.fx.stat && !d.fx.foe));
  if (!selfTarget && d.a && Math.random() * 100 >= d.a * stMul(st.acc)) {
    const off = side === 'p' ? 'pOff' : 'eOff';
    await tween(140, k => { B[off] = {x: (side === 'p' ? 1 : -1) * 6 * Math.sin(k * Math.PI), y: 0}; }); B[off] = null;
    await say(`Ma ${uName} manca il bersaglio!`, {keep: true}); return;
  }
  if (!selfTarget || d.p) await moveAnim(side, d);
  if (d.p > 0) {
    const eff = typeEff(d.t, SPECIES[foe.sp].types);
    if (eff === 0) { await say(`Non ha effetto su ${nameOf(foeSide)}...`, {keep: true}); return; }
    const special = SPECIAL_TYPES.has(d.t);
    let A = (special ? user.st.spc : user.st.atk) * stMul(special ? st.spc : st.atk);
    const D = (special ? foe.st.spc : foe.st.def) * stMul(special ? B.stages[foeSide].spc : B.stages[foeSide].def);
    if (!special && user.status === 'brn') A /= 2;
    const crit = Math.random() < SPECIES[user.sp].b[3] / 512;
    const L = user.lvl * (crit ? 2 : 1);
    let dmg = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * d.p * A / Math.max(1, D)) / 50) + 2;
    if (SPECIES[user.sp].types.includes(d.t)) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(1, Math.floor(dmg * eff * rand(217, 255) / 255));
    await hitAnim(foeSide, eff);
    foe.hp = Math.max(0, foe.hp - dmg);
    await animHp(foe);
    if (crit) await say('Brutto colpo!', {keep: true});
    if (eff > 1) await say('È superefficace!', {keep: true});
    else if (eff < 1) await say('Non è molto efficace...', {keep: true});
    if (d.fx && d.fx.drain) {
      const h = Math.max(1, Math.floor(dmg * d.fx.drain));
      if (user.hp < user.st.hp) { user.hp = Math.min(user.st.hp, user.hp + h); await animHp(user); await say(`${nameOf(foeSide)} perde energia!`, {keep: true}); }
    }
    if (foe.hp <= 0) return;
  }
  const fxd = d.fx;
  if (!fxd) return;
  if (fxd.heal) {
    if (user.hp >= user.st.hp) { await say('Ma non ha bisogno di recuperare!', {keep: true}); return; }
    const P = POS[side];
    for (let i = 0; i < 10; i++) fx({kind: 'heal', x: P.cx + (Math.random() - .5) * 30, y: P.cy + 14, vy: -40, life: 550, delay: i * 50});
    await sleep(500);
    user.hp = Math.min(user.st.hp, user.hp + Math.floor(user.st.hp * fxd.heal)); await animHp(user);
    await say(`${uName} recupera energie!`, {keep: true}); return;
  }
  if (fxd.ch != null && fxd.ch < 1 && Math.random() >= fxd.ch) return;
  if (fxd.stat) {
    const tSide = fxd.foe ? foeSide : side; const S = B.stages[tSide];
    const cur = S[fxd.stat];
    const nv = clamp(cur + fxd.d, -6, 6);
    if (nv === cur) { if (!d.p) await say('Non succede nulla!', {keep: true}); return; }
    S[fxd.stat] = nv;
    await statAnim(tSide, fxd.d > 0);
    const who = nameOf(tSide);
    await say(fxd.d > 0 ? `${STAT_LABEL[fxd.stat]} di ${who} ${fxd.d > 1 ? 'aumenta molto' : 'aumenta'}!` : `${STAT_LABEL[fxd.stat]} di ${who} diminuisce!`, {keep: true});
    return;
  }
  if (fxd.st) {
    const types = SPECIES[foe.sp].types;
    const immune = (fxd.st === 'brn' && types.includes('FUOCO')) || (fxd.st === 'psn' && types.includes('VELENO')) || (fxd.st === 'par' && types.includes('ELETTRO'));
    if (foe.status || immune) { if (!d.p) await say('Non ha effetto!', {keep: true}); return; }
    foe.status = fxd.st; if (fxd.st === 'slp') foe.slp = rand(2, 4);
    await statusAnim(foeSide, fxd.st);
    hud();
    const msg = {psn: 'è stato avvelenato!', par: 'è paralizzato! Potrebbe non riuscire a muoversi!', slp: 'si è addormentato!', brn: 'si è scottato!'}[fxd.st];
    await say(`${nameOf(foeSide)} ${msg}`, {keep: true});
  }
}

async function faintAnim(side) {
  const k0 = side === 'p' ? 'pDrop' : 'eDrop';
  await tween(380, k => { B[k0] = 50 * k * k; });
  B[side === 'p' ? 'pHidden' : 'eHidden'] = true; B[k0] = 0; hud();
}
async function checkFaints() {
  if (B.e.hp <= 0) {
    await faintAnim('e');
    await say(`${eName()} è esausto!`, {keep: true});
    await giveXp();
    B.ei++;
    if (B.ei < B.team.length) {
      B.e = B.team[B.ei]; B.e._dhp = B.e.hp; seen(B.e.sp); B.stages.e = zeroStages();
      B.part = new Set([B.pm]);
      await enemySendOut(`${B.trainer.cls} ${B.trainer.name} manda in campo ${B.e.name}!`);
      if (G.party[B.pm].hp <= 0) return await playerFaint();
      return null;
    }
    if (B.trainer) {
      B.trainerPic = {img: bigChar(B.trainer.look || 'man', 'down'), x: 90};
      await tween(400, k => { B.trainerPic.x = 90 * (1 - k); });
      await say(`Hai sconfitto ${B.trainer.cls} ${B.trainer.name}!`);
      if (B.trainer.lose) await say(B.trainer.lose);
      const money = B.trainer.money || B.team[B.team.length - 1].lvl * 15;
      G.money += money;
      await say(`{NAME} riceve ${money} monete come premio.`);
    }
    return 'win';
  }
  if (G.party[B.pm].hp <= 0) return await playerFaint();
  return undefined;
}
async function playerFaint() {
  const m = G.party[B.pm];
  await faintAnim('p');
  await say(`${m.name} è esausto!`, {keep: true});
  B.part.delete(B.pm);
  if (!alive(G.party).length) {
    await say('{NAME} non ha più FAUNI in grado di lottare!');
    return 'lose';
  }
  hideTextBox();
  let t;
  for (;;) {
    t = await partyScreen('forced', 'Chi mandi in campo?');
    if (G.party[t].hp > 0) break;
    await say('Non ha energie per lottare!');
  }
  B.pm = t; await sendOut();
  return null;
}
async function levelUpAnim() {
  const P = POS.p;
  for (let i = 0; i < 12; i++) fx({kind: 'spark', x: P.cx + (Math.random() - .5) * 40, y: P.cy + 16, vy: -60 - Math.random() * 30, life: 600, delay: i * 40});
  B.ph.classList.add('glow'); await sleep(700); B.ph.classList.remove('glow');
}
async function giveXp() {
  const parts = [...B.part].filter(i => G.party[i] && G.party[i].hp > 0);
  if (!parts.length) return;
  const sp = SPECIES[B.e.sp];
  const total = Math.floor(sp.xp * B.e.lvl / 7 * (B.trainer ? 1.5 : 1));
  const each = Math.max(1, Math.floor(total / parts.length));
  for (const i of parts) {
    const m = G.party[i];
    if (m.lvl >= 100) continue;
    await say(`${m.name} guadagna ${each} punti esperienza!`, {keep: true, noWait: true});
    let remaining = each;
    while (remaining > 0 && m.lvl < 100) {
      const need = xpFor(m.lvl + 1) - m.xp;
      const gain = Math.min(need, remaining);
      const from = xpPct(m);
      m.xp += gain; remaining -= gain;
      const to = m.xp >= xpFor(m.lvl + 1) ? 100 : xpPct(m);
      if (i === B.pm) { await tween(Math.max(150, (to - from) * 12), k => { m._dxp = from + (to - from) * k; hud(); }); }
      if (m.xp >= xpFor(m.lvl + 1)) {
        const oldMax = m.st.hp;
        m.lvl++; m.st = calcStats(m); m.hp += m.st.hp - oldMax; m._dhp = m.hp; m._dxp = 0;
        hud();
        if (i === B.pm) await levelUpAnim();
        await say(`${m.name} sale al livello ${m.lvl}!`, {keep: true});
        B.levelled.add(m);
        for (const [l, id] of SPECIES[m.sp].learn) if (l === m.lvl) await learnMove(m, id);
      }
    }
    delete m._dxp; hud();
    await sleep(250);
  }
}
async function learnMove(m, id) {
  if (m.moves.some(x => x.id === id)) return;
  const n = MOVES[id].n;
  if (m.moves.length < 4) { m.moves.push({id, pp: MOVES[id].pp}); await say(`${m.name} impara ${n}!`, {keep: true}); return; }
  await say(`${m.name} vuole imparare ${n}, ma conosce già quattro mosse.`, {keep: true});
  if (await ask(`Vuoi fargli dimenticare una mossa per far posto a ${n}?`)) {
    const i = await choose(m.moves.map(x => MOVES[x.id].n), {x: 40, y: 40, w: 120});
    if (i >= 0) {
      const old = MOVES[m.moves[i].id].n;
      m.moves[i] = {id, pp: MOVES[id].pp};
      await say(`Uno, due e... puf! ${m.name} dimentica ${old}... e impara ${n}!`, {keep: true});
      return;
    }
  }
  await say(`${m.name} non ha imparato ${n}.`, {keep: true});
}
async function afterBattleEvolve() {
  for (const m of B.levelled) {
    const sp = SPECIES[m.sp];
    if (!sp.evo || m.lvl < sp.evo[0]) continue;
    const to = SPECIES[sp.evo[1]];
    B.hideHud = true; hud(); FX = [];
    B.evo = {img: monSprite(sp.id), bg: '#f6fbe8'};
    await say(`Cosa? ${m.name} si sta evolvendo!`, {keep: true});
    // alternanza delle sagome, sempre più veloce
    for (let i = 0; i < 18; i++) {
      B.evo.bg = i % 2 ? '#2a2a4a' : '#3a3a6a';
      B.evo.img = monSilhouette(i % 2 ? to.id : sp.id, '#ffffff');
      for (let j = 0; j < 3; j++) fx({kind: 'spark', x: 80 + (Math.random() - .5) * 90, y: 60 + (Math.random() - .5) * 70, life: 400});
      await sleep(Math.max(60, 260 - i * 12));
    }
    await tween(250, k => { TR = {type: 'flash', k}; });
    B.evo = {img: monSprite(to.id), bg: '#f6fbe8'};
    await tween(350, k => { TR = {type: 'flash', k: 1 - k}; }); TR = null;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; fx({kind: 'star', x: 80 + Math.cos(a) * 10, y: 52 + Math.sin(a) * 10, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 600}); }
    const wasDefault = m.name === sp.name;
    const oldName = m.name;
    m.sp = to.id; if (wasDefault) m.name = to.name;
    const oldMax = m.st.hp; m.st = calcStats(m); m.hp += m.st.hp - oldMax;
    caught(to.id);
    await say(`Congratulazioni! ${oldName} si è evoluto in ${to.name}!`, {keep: true});
    for (const [l, id] of to.learn) if (l === m.lvl) await learnMove(m, id);
    B.evo = null;
  }
}
async function throwBall(id) {
  const P = POS.e;
  useItemCount(id);
  msg(`{NAME} lancia una ${ITEMS[id].n}!`);
  if (!B.wild) {
    fx({kind: 'ball', path: arc(20, 90, P.cx, P.cy, 30), life: 420});
    await sleep(420);
    fx({kind: 'ball', path: arc(P.cx, P.cy, P.cx - 40, P.cy + 60, 20), life: 400}); await sleep(400);
    await say('L\'allenatore devia la SFERA! Non si catturano i FAUNI degli altri!', {keep: true});
    return null;
  }
  const e = B.e, sp = SPECIES[e.sp];
  let a = (3 * e.st.hp - 2 * e.hp) * sp.cr * ITEMS[id].ball / (3 * e.st.hp);
  if (e.status === 'slp') a *= 2; else if (e.status) a *= 1.5;
  const p = Math.min(1, a / 255);
  const ok = Math.random() < p;
  const shakes = ok ? 3 : Math.min(2, Math.floor(Math.random() * 4 * p + Math.random() * 1.2));
  // lancio
  fx({kind: 'ball', path: arc(20, 90, P.cx, P.cy - 4, 34), life: 450});
  await sleep(450);
  // il FAUNO viene risucchiato
  fx({kind: 'puff', x: P.cx, y: P.cy, life: 300});
  B.eWhite = true;
  await tween(300, k => { B.eScale = 1 - k; });
  B.eHidden = true; B.eWhite = false; B.eScale = 1; B.hideHud = true; hud();
  // la sfera cade e dondola
  const ball = {x: P.cx, y: P.cy - 4, rot: 0};
  const bp = fx({kind: 'ball', path: () => [ball.x, ball.y], rot: () => ball.rot, life: 99999});
  await tween(350, k => { ball.y = P.cy - 4 + (P.base - 6 - (P.cy - 4)) * k; });
  for (let i = 0; i < shakes; i++) {
    await sleep(380);
    await tween(300, k => { ball.rot = Math.sin(k * Math.PI * 2) * 0.45; ball.x = P.cx + Math.sin(k * Math.PI * 2) * 2; });
  }
  await sleep(400);
  if (ok) {
    for (let i = 0; i < 6; i++) fx({kind: 'star', x: ball.x, y: ball.y - 6, vx: (i - 2.5) * 22, vy: -50, ay: 120, life: 600});
    await say(`Preso! ${e.name} è stato catturato!`, {keep: true});
    FX = FX.filter(f => f !== bp);
    const isNew = !G.caught[e.sp];
    delete e._dhp; e.ot = G.name;
    const where = addMon(e);
    if (isNew) await say(`I dati di ${e.name} sono stati registrati nel FAUNARIO!`, {keep: true});
    if (where === 'box') await say(`La squadra è piena: ${e.name} è stato inviato al BOX.`, {keep: true});
    return 'catch';
  }
  FX = FX.filter(f => f !== bp);
  fx({kind: 'puff', x: P.cx, y: P.cy + 10, life: 300});
  B.eHidden = false; B.eWhite = true;
  await tween(260, k => { B.eScale = k; }); B.eScale = 1; B.eWhite = false; B.hideHud = false; hud();
  await say(['Oh no! Il FAUNO è uscito dalla SFERA!', 'Accidenti! Sembrava preso!', 'Uffa! Mancava pochissimo!'][shakes], {keep: true});
  return null;
}

async function whiteout() {
  hideTextBox();
  const lost = Math.floor(G.money / 2);
  G.money -= lost;
  await say(`{NAME} perde i sensi...|Hai perso ${lost} monete.`);
  healParty();
  const L = G.lastHeal;
  await warp(L.map, L.x, L.y, 'down');
}

async function wildEncounter() {
  const list = MAP.wild.list;
  const tot = list.reduce((a, x) => a + (x[3] || 1), 0);
  let r = Math.random() * tot, pick = list[0];
  for (const x of list) { r -= x[3] || 1; if (r <= 0) { pick = x; break; } }
  const lv = rand(pick[1], pick[2]);
  await battle({wild: makeMon(pick[0], lv)});
}

// ------------------------------------------------------------
//  Titolo, introduzione, salvataggio
// ------------------------------------------------------------
let titleSel = 0, titleMenuEl = null, titleEl = null;
const TITLE_MONS = ['fiammolo', 'gocciolo', 'fogliotto', 'lucciolo', 'ombretto', 'farfalia'];
function drawTitle() {
  const sky = ctx.createLinearGradient(0, 0, 0, 112);
  sky.addColorStop(0, '#5ab2f2'); sky.addColorStop(1, '#d2f0ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, 112);
  // nuvole
  for (const [cx, cy, sp] of [[30, 54, 40], [110, 40, 55], [150, 70, 30]]) {
    const x = (cx + frame / sp) % 200 - 20;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, cy, 14, 4, 0, 0, 7); ctx.ellipse(x + 8, cy - 3, 8, 4, 0, 0, 7); ctx.fill();
  }
  // monte Corona
  ctx.fillStyle = '#7a9ac2'; ctx.beginPath(); ctx.moveTo(10, 112); ctx.lineTo(80, 58); ctx.lineTo(150, 112); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(68, 67); ctx.lineTo(80, 58); ctx.lineTo(92, 67); ctx.lineTo(84, 64); ctx.lineTo(80, 68); ctx.lineTo(75, 64); ctx.fill();
  for (let x = 0; x < VW; x += 16) ctx.drawImage(tileImg('T', 0), x, 104);
  for (let x = 0; x < VW; x += 16) ctx.drawImage(tileImg('~', Math.floor(frame / 32) % 2), x, 120), ctx.drawImage(tileImg('~', Math.floor(frame / 32) % 2), x, 136);
  const sp = TITLE_MONS[Math.floor(frame / 180) % TITLE_MONS.length];
  const t = frame % 180;
  const a = t < 15 ? t / 15 : t > 165 ? (180 - t) / 15 : 1;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(80, 103, 18, 4, 0, 0, 7); ctx.fill();
  ctx.drawImage(monSprite(sp), 56, 56 + (Math.floor(frame / 16) % 2));
  ctx.restore();
}
function showTitle() {
  mode = 'title'; uiEl.innerHTML = ''; textBox = null;
  titleEl = el('title', 0, 6, 160, 44);
  titleEl.innerHTML = '<div class="t1">FAUNI</div><div class="t2">LE SORGENTI DI VALCORONA</div>';
  const hasSave = !!loadSave();
  const opts = hasSave ? ['CONTINUA', 'NUOVA PARTITA'] : ['NUOVA PARTITA'];
  titleMenuEl = el('box menu', 38, 104, 84, opts.length * 10 + 8);
  titleSel = 0;
  const draw = () => { titleMenuEl.innerHTML = opts.map((s, j) => `<div class="it">${j === titleSel ? '▶' : '&nbsp;'}${s}</div>`).join(''); };
  draw();
  titleKey.opts = opts; titleKey.draw = draw;
}
function titleKey(k) {
  const opts = titleKey.opts;
  if (k === 'up' || k === 'down') { titleSel = (titleSel + 1) % opts.length; titleKey.draw(); }
  if (k === 'A' || k === 'START') {
    const o = opts[titleSel];
    uiEl.innerHTML = ''; textBox = null;
    if (o === 'CONTINUA') { G = loadSave(); mode = 'world'; loadMap(G.map, G.x, G.y, G.dir); }
    else { G = newGame(); run(introScene); }
  }
}
let introPic = null;
function drawIntro() {
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#f8f8f0'); bg.addColorStop(1, '#cfe8f8');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#a2d87a'; ctx.beginPath(); ctx.ellipse(80, 76, 40, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c2ea9a'; ctx.beginPath(); ctx.ellipse(74, 74, 22, 4, 0, 0, 7); ctx.fill();
  const bob = Math.floor(frame / 20) % 2;
  if (introPic === 'prof' || introPic === 'player' || introPic === 'rival') ctx.drawImage(charImg(introPic, 'down', 0), 0, 0, 16, 16, 56, 26 + bob, 48, 48);
  else if (introPic) ctx.drawImage(monSprite(introPic), 56, 28 + bob);
}

const SAVE_KEY = 'fauni-valcorona-save';
function loadSave() {
  try {
    if (window.__INITIAL_SAVE__) return JSON.parse(window.__INITIAL_SAVE__);
    const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
let pendingSave = null, saveResolver = null;
function saveGame() {
  const data = JSON.stringify(G);
  window.__INITIAL_SAVE__ = data;
  try { localStorage.setItem(SAVE_KEY, data); } catch (e) {}
  if (saveResolver) { const r = saveResolver; saveResolver = null; r(data); } else pendingSave = data;
}
// Ponte verso Scriptable: lo script chiama __waitSave() e riceve i dati ad ogni salvataggio.
window.__waitSave = function (cb) {
  if (pendingSave) { const d = pendingSave; pendingSave = null; cb(d); return; }
  saveResolver = cb;
};

function start() {
  resize();
  showTitle();
  requestAnimationFrame(loop);
}
