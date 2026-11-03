// ============================================================
//  FAUNI DI VALCORONA — motore
// ============================================================
'use strict';

const PAL = ['#e3f2cd', '#9cc47a', '#4b7a5a', '#17301f'];
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
//  Disegno: tessere
// ------------------------------------------------------------
function R(g, c, x, y, w = 1, h = 1) { g.fillStyle = PAL[c]; g.fillRect(x, y, w, h); }
const SOLID = new Set('T~FRCMGWwSrYOxobtcpk#Xn'.split(''));

const PAINT = {
  '.': g => { R(g, 0, 0, 0, 16, 16); R(g, 1, 3, 4); R(g, 1, 11, 10); R(g, 1, 7, 13); R(g, 1, 13, 2); },
  '=': g => { R(g, 0, 0, 0, 16, 16); for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) R(g, 1, x, y); },
  ',': (g, f) => {
    R(g, 1, 0, 0, 16, 16);
    for (const [x, y] of [[1, 2], [9, 1], [5, 7], [12, 9], [1, 11], [8, 12]]) {
      const o = f ? 1 : 0;
      R(g, 2, x, y + 1, 1, 3); R(g, 2, x + 2, y + 1, 1, 3); R(g, 3, x + 1, y + o, 1, 3); R(g, 2, x + 3, y + 2, 1, 2);
    }
  },
  'f': (g, f) => { PAINT['.'](g); for (const [x, y] of [[3, 3], [11, 4], [6, 10], [12, 12]]) { R(g, 3, x, y + (f ? 1 : 0), 3, 3); R(g, 0, x + 1, y + 1 + (f ? 1 : 0)); R(g, 2, x + 1, y + 3, 1, 2); } },
  'T': g => {
    R(g, 0, 0, 0, 16, 16); R(g, 3, 2, 1, 12, 11); R(g, 3, 1, 3, 14, 7);
    R(g, 2, 3, 2, 10, 9); R(g, 2, 2, 4, 12, 5); R(g, 1, 5, 3, 3, 2); R(g, 1, 4, 5, 2, 1); R(g, 1, 10, 6, 2, 2);
    R(g, 3, 6, 12, 4, 3); R(g, 2, 7, 12, 2, 3);
  },
  '~': (g, f) => { R(g, 1, 0, 0, 16, 16); const o = f ? 4 : 0; R(g, 0, (2 + o) % 16, 4, 5, 1); R(g, 0, (10 + o) % 16, 11, 4, 1); R(g, 2, (9 + o) % 16, 5, 3, 1); R(g, 2, (1 + o) % 16, 12, 3, 1); },
  'F': g => { PAINT['.'](g); R(g, 3, 0, 5, 16, 1); R(g, 3, 0, 10, 16, 1); for (const x of [2, 13]) { R(g, 3, x, 3, 2, 11); R(g, 1, x, 4, 1, 8); } },
  'R': g => { R(g, 2, 0, 0, 16, 16); for (let y = 3; y < 16; y += 4) R(g, 3, 0, y, 16, 1); for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 2 : 6); x < 16; x += 8) R(g, 3, x, y, 1, 3); R(g, 1, 0, 0, 16, 1); },
  'C': g => { PAINT.R(g); R(g, 0, 5, 3, 6, 10); R(g, 3, 7, 4, 2, 8); R(g, 3, 6, 7, 4, 2); },
  'M': g => { R(g, 3, 0, 0, 16, 16); for (let x = 0; x < 16; x += 4) R(g, 2, x, 0, 2, 16); R(g, 1, 0, 0, 16, 1); R(g, 1, 0, 14, 16, 2); },
  'G': g => { R(g, 3, 0, 0, 16, 16); R(g, 2, 0, 2, 16, 2); R(g, 2, 0, 8, 16, 2); R(g, 1, 0, 0, 16, 1); R(g, 1, 6, 4, 4, 3); },
  'W': g => { R(g, 0, 0, 0, 16, 16); R(g, 1, 0, 5, 16, 1); R(g, 1, 0, 10, 16, 1); R(g, 1, 0, 15, 16, 1); R(g, 2, 0, 0, 16, 1); },
  'w': g => { PAINT.W(g); R(g, 3, 3, 3, 10, 9); R(g, 1, 4, 4, 8, 7); R(g, 0, 5, 5, 2, 2); R(g, 3, 7, 4, 1, 7); },
  'D': g => { PAINT.W(g); R(g, 3, 3, 2, 10, 14); R(g, 2, 4, 3, 8, 13); R(g, 1, 10, 9, 1, 1); R(g, 3, 4, 7, 8, 1); },
  'S': g => { PAINT['.'](g); R(g, 3, 7, 9, 2, 6); R(g, 3, 1, 2, 14, 8); R(g, 1, 2, 3, 12, 6); R(g, 2, 4, 5, 8, 1); R(g, 2, 4, 7, 6, 1); },
  'v': g => { PAINT['.'](g); R(g, 2, 0, 10, 16, 2); R(g, 3, 0, 12, 16, 1); R(g, 1, 0, 13, 16, 3); },
  'r': g => { (MAP && MAP.indoor ? PAINT._ : PAINT['.'])(g); R(g, 3, 2, 4, 12, 11); R(g, 3, 3, 3, 10, 13); R(g, 2, 3, 5, 10, 9); R(g, 2, 4, 4, 8, 11); R(g, 1, 5, 5, 3, 2); R(g, 3, 9, 9, 3, 1); },
  'B': g => { R(g, 1, 0, 0, 16, 16); for (let x = 0; x < 16; x += 4) R(g, 2, x, 0, 1, 16); R(g, 3, 0, 0, 16, 1); R(g, 3, 0, 15, 16, 1); },
  'Y': g => { PAINT['.'](g); R(g, 2, 5, 3, 6, 13); R(g, 3, 5, 3, 1, 13); R(g, 3, 10, 3, 1, 13); R(g, 3, 7, 11, 2, 5); R(g, 3, 1, 1, 14, 1); R(g, 3, 7, 0, 1, 9); R(g, 1, 6, 4, 4, 2); },
  'O': (g, f) => {
    R(g, 3, 0, 0, 16, 16); R(g, 2, 1, 1, 14, 14);
    const alive = MAP && MAP.spring && F(MAP.spring);
    if (alive) { R(g, 1, 2, 2, 12, 12); R(g, 0, 4 + (f ? 2 : 0), 5, 2, 2); R(g, 0, 9 - (f ? 2 : 0), 9, 2, 2); R(g, 0, 7, 3 + (f ? 1 : 0), 1, 1); }
    else { R(g, 3, 3, 3, 10, 10); R(g, 2, 6, 6, 4, 4); R(g, 1, 7, 7, 2, 2); }
  },
  // interni
  '#': g => { R(g, 2, 0, 0, 16, 16); R(g, 3, 0, 14, 16, 2); R(g, 1, 0, 3, 16, 1); for (let x = 3; x < 16; x += 8) R(g, 3, x, 4, 1, 10); },
  '_': g => { R(g, 0, 0, 0, 16, 16); R(g, 1, 0, 15, 16, 1); R(g, 1, 15, 0, 1, 16); },
  'b': g => { R(g, 3, 0, 0, 16, 16); R(g, 2, 1, 1, 14, 14); for (let y = 2; y < 15; y += 5) { R(g, 3, 1, y + 3, 14, 1); for (let x = 2; x < 14; x += 3) R(g, (x / 3) % 2 ? 0 : 1, x, y, 2, 3); } },
  't': g => { R(g, 3, 0, 1, 16, 14); R(g, 1, 1, 2, 14, 10); R(g, 0, 2, 3, 6, 2); R(g, 2, 1, 12, 14, 2); },
  'c': g => { R(g, 3, 0, 0, 16, 16); R(g, 1, 0, 1, 16, 5); R(g, 2, 0, 7, 16, 8); R(g, 0, 0, 2, 16, 1); },
  'p': g => { PAINT._(g); R(g, 3, 2, 1, 12, 11); R(g, 1, 3, 2, 10, 7); R(g, 0, 4, 3, 3, 2); R(g, 3, 6, 12, 4, 3); },
  'm': g => { PAINT._(g); R(g, 2, 1, 4, 14, 10); R(g, 1, 2, 5, 12, 8); for (let x = 3; x < 13; x += 3) R(g, 2, x, 6, 1, 6); },
  'k': g => { PAINT._(g); R(g, 3, 1, 0, 14, 16); R(g, 0, 2, 1, 12, 4); R(g, 1, 2, 6, 12, 9); R(g, 2, 2, 8, 12, 1); },
  'x': g => { PAINT._(g); R(g, 3, 5, 10, 6, 6); R(g, 2, 6, 11, 4, 4); R(g, 3, 3, 1, 10, 10); R(g, 2, 4, 2, 8, 8); R(g, 1, 5, 3, 2, 2); R(g, 1, 9, 6, 2, 2); },
  'o': g => { PAINT._(g); R(g, 3, 4, 1, 8, 15); R(g, 2, 5, 2, 6, 13); R(g, 1, 6, 3, 2, 3); R(g, 3, 6, 6, 1, 1); R(g, 3, 9, 6, 1, 1); R(g, 3, 3, 13, 10, 3); },
  'X': g => { R(g, 3, 0, 0, 16, 16); },
};
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
//  Disegno: personaggi
// ------------------------------------------------------------
const LOOKS = {
  player: {hair: 3, shirt: 2, cap: 1},
  rival:  {hair: 2, shirt: 3, spiky: 1},
  prof:   {hair: 1, shirt: 0, coat: 1},
  mom:    {hair: 3, shirt: 1, long: 1},
  dad:    {hair: 2, shirt: 1, beard: 1},
  man:    {hair: 3, shirt: 1},
  woman:  {hair: 2, shirt: 2, long: 1},
  old:    {hair: 1, shirt: 2, beard: 1},
  oldw:   {hair: 1, shirt: 1, long: 1},
  kid:    {hair: 3, shirt: 1, small: 1, cap: 1},
  girl:   {hair: 3, shirt: 2, long: 1, small: 1},
  scout:  {hair: 2, shirt: 1, cap: 1},
  hiker:  {hair: 3, shirt: 2, beard: 1, cap: 1},
  grigio: {hair: 3, shirt: 3, cap: 1, coat: 1},
  nurse:  {hair: 2, shirt: 0, long: 1, cross: 1},
  clerk:  {hair: 3, shirt: 1, apron: 1},
  leader: {hair: 3, shirt: 2, long: 1, coat: 1},
  miner:  {hair: 3, shirt: 2, cap: 1},
  worker: {hair: 3, shirt: 1, cap: 1, apron: 1},
};
const charCache = {};
function charImg(look, dir, step) {
  const key = look + dir + step;
  if (charCache[key]) return charCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  if (look === 'ball') {
    R(g, 3, 4, 5, 8, 9); R(g, 3, 3, 6, 10, 7); R(g, 2, 4, 6, 8, 3); R(g, 0, 4, 10, 8, 3); R(g, 3, 3, 9, 10, 1); R(g, 0, 7, 8, 2, 3); R(g, 3, 7, 9, 2, 1); R(g, 1, 5, 7, 1, 1);
  } else {
    const L = LOOKS[look] || LOOKS.man;
    const o = L.small ? 1 : 0;
    const side = dir === 'left' || dir === 'right';
    // gambe
    const lg = step ? 1 : 0;
    if (side) { R(g, 3, 6 - lg, 13, 2, 3); R(g, 3, 9 + lg, 13, 2, 3); }
    else { R(g, 3, 5, 13, 2, 3 - (step === 1 ? 1 : 0)); R(g, 3, 9, 13, 2, 3 - (step === 2 ? 1 : 0)); }
    // corpo
    R(g, 3, 4, 8 + o, 8, 6 - o); R(g, L.shirt, 5, 9 + o, 6, 4 - o);
    if (L.coat) { R(g, 0, 4, 9 + o, 2, 5 - o); R(g, 0, 10, 9 + o, 2, 5 - o); R(g, 3, 4, 13, 8, 1); }
    if (L.apron) R(g, 0, 6, 10 + o, 4, 3 - o);
    if (L.cross && dir === 'down') { R(g, 3, 7, 10, 2, 1); R(g, 3, 7, 9, 1, 3); }
    // braccia
    if (!side) { R(g, 3, 3, 9 + o, 1, 3); R(g, 3, 12, 9 + o, 1, 3); }
    // testa
    R(g, 3, 3, 1 + o, 10, 8); R(g, 3, 4, 0 + o, 8, 10 - o);
    R(g, 0, 4, 2 + o, 8, 6);
    // capelli
    R(g, L.hair, 4, 1 + o, 8, 2);
    if (dir === 'up') { R(g, L.hair, 4, 1 + o, 8, 7); R(g, L.hair === 3 ? 2 : 1, 5, 3 + o, 6, 1); R(g, L.hair === 3 ? 2 : 1, 6, 5 + o, 4, 1); }
    if (L.long) { R(g, L.hair, 3, 2 + o, 1, 7); R(g, L.hair, 12, 2 + o, 1, 7); if (dir === 'up') R(g, L.hair, 4, 8, 8, 2); }
    if (L.spiky) { R(g, 3, 4, 0, 1, 1); R(g, 3, 7, 0, 1, 1); R(g, 3, 10, 0, 1, 1); R(g, L.hair, 5, 0 + o, 2, 1); R(g, L.hair, 8, 0 + o, 2, 1); }
    if (L.cap) { R(g, 3, 4, 0 + o, 8, 3); R(g, 2, 5, 1 + o, 6, 1); if (dir === 'down') R(g, 3, 3, 3 + o, 10, 1); if (dir === 'up') R(g, 1, 6, 1 + o, 4, 1); }
    // viso
    if (dir === 'down') {
      R(g, 3, 5, 5 + o, 1, 2); R(g, 3, 10, 5 + o, 1, 2);
      if (L.beard) R(g, L.hair === 1 ? 1 : 2, 5, 7 + o, 6, 2);
    } else if (side) {
      const ex = dir === 'left' ? 5 : 10;
      R(g, 3, ex, 5 + o, 1, 2);
      R(g, L.hair, dir === 'left' ? 9 : 4, 2 + o, 3, 5);
      if (L.beard) R(g, 2, dir === 'left' ? 4 : 8, 7 + o, 4, 2);
    }
    if (dir === 'right') { // specchia
      const c2 = document.createElement('canvas'); c2.width = c2.height = 16;
      const g2 = c2.getContext('2d'); g2.translate(16, 0); g2.scale(-1, 1); g2.drawImage(c, 0, 0);
      g.clearRect(0, 0, 16, 16); g.drawImage(c2, 0, 0);
    }
  }
  return (charCache[key] = c);
}

// ------------------------------------------------------------
//  Disegno: sprite dei FAUNI (generati proceduralmente)
// ------------------------------------------------------------
const monCache = {};
function monSprite(spId, back) {
  const key = spId + (back ? 'b' : 'f');
  if (monCache[key]) return monCache[key];
  const sp = SPECIES[spId];
  const N = 16, H = 8;
  const rnd = mulberry(hashStr(sp.fam));
  const extra = mulberry(hashStr(sp.id));
  const stage = sp.st || 1;
  const halfW = [0, 5, 6, 8][stage];
  const top = [0, 5, 3, 1][stage];
  const grid = Array.from({length: N}, () => Array(N).fill(0));
  // forma base condivisa dalla famiglia
  const base = [];
  for (let y = 0; y < N; y++) { base[y] = []; for (let x = 0; x < H; x++) base[y][x] = rnd(); }
  for (let y = top; y < N - 1; y++) {
    for (let x = 0; x < H; x++) {
      const cx = H - 1 - x; // distanza dal centro
      if (cx >= halfW) continue;
      const cy = (y - top) / (N - 1 - top);
      let p = 0.92 - cx / halfW * 0.75 - Math.abs(cy - 0.55) * 0.5;
      if (stage > 1 && extra() < 0.12) p += 0.25;
      if (base[y][x] < p) grid[y][x] = 1;
    }
    // il centro è sempre pieno in basso
    if (y > top + 2) grid[y][H - 1] = 1;
  }
  // specchia
  for (let y = 0; y < N; y++) for (let x = 0; x < H; x++) grid[y][N - 1 - x] = grid[y][x];
  // pulizia: elimina pixel isolati
  const filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && grid[y][x] >= 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (grid[y][x] && !filled(x - 1, y) && !filled(x + 1, y) && !filled(x, y - 1) && !filled(x, y + 1)) grid[y][x] = 0;
  }
  // colore: corpo 1, macchie 2
  const tone = sp.types.includes('OMBRA') || sp.types.includes('ROCCIA') ? 2 : 1;
  const spots = mulberry(hashStr(sp.fam + 'spots'));
  const col = Array.from({length: N}, () => Array(N).fill(-1));
  for (let y = 0; y < N; y++) for (let x = 0; x < H; x++) {
    if (!grid[y][x]) continue;
    let c = tone;
    if (spots() < 0.22) c = tone === 1 ? 2 : 1;
    if (y < top + 3 && tone === 1 && spots() < 0.4) c = 0;
    col[y][x] = c; col[y][N - 1 - x] = c;
  }
  // contorno
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (grid[y][x]) {
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) col[y][x] = 3;
    }
  }
  // occhi
  if (!back) {
    let ey = top + 3 + Math.floor(rnd() * 2);
    for (let tries = 0; tries < 6; tries++, ey++) {
      const ex = 5 + (stage === 1 ? 1 : 0);
      if (filled(ex, ey) && filled(N - 1 - ex, ey) && filled(ex, ey + 1)) {
        for (const x of [ex, N - 1 - ex]) { col[ey][x] = 3; col[ey + 1][x] = 3; col[ey][x + (x < H ? 1 : -1)] = 0; }
        break;
      }
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (col[y][x] < 0) continue;
    const v = back && col[y][x] === 0 ? 1 : col[y][x];
    R(g, v, x * 3, y * 3, 3, 3);
  }
  return (monCache[key] = c);
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
  try { await fn(); } catch (e) { console.error(e); hideTextBox(); }
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
  const res = await battle({trainer: T, canLose: T.canLose});
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
  R(ctx, 3, 0, 0, VW, VH);
  for (let ty = ty0; ty <= ty0 + 10; ty++) for (let tx = tx0; tx <= tx0 + 11; tx++) {
    ctx.drawImage(tileImg(tileAt(tx, ty), f), tx * TS - camX, ty * TS - camY);
  }
  const actors = NPCS.filter(n => n.visible()).concat([player]);
  actors.sort((a, b) => actorPx(a)[1] - actorPx(b)[1]);
  for (const a of actors) {
    const [x, y] = actorPx(a);
    const step = a.mv ? (a.mv.t > 0.25 && a.mv.t < 0.75 ? a.mv.step : 0) : 0;
    ctx.drawImage(charImg(a.look, a.dir, step), Math.round(x - camX), Math.round(y - camY - 4));
    if (a.bang) {
      const bx = Math.round(x - camX) + 4, by = Math.round(y - camY) - 18;
      R(ctx, 3, bx, by, 8, 11); R(ctx, 0, bx + 1, by + 1, 6, 9); R(ctx, 3, bx + 3, by + 2, 2, 4); R(ctx, 3, bx + 3, by + 7, 2, 2);
    }
  }
}
function drawOverlay() {
  if (!overlay) return;
  if (overlay.type === 'mon') {
    R(ctx, 3, 52, 22, 56, 56); R(ctx, 0, 54, 24, 52, 52);
    ctx.drawImage(monSprite(overlay.sp), 56, 26);
  }
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

function drawBattle() {
  R(ctx, 0, 0, 0, VW, VH);
  // pedane
  ctx.fillStyle = PAL[1];
  ctx.beginPath(); ctx.ellipse(124, 50, 32, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(36, 94, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (!B) return;
  const sh = n => (B.shake && B.shake.who === n ? (Math.floor(frame / 3) % 2 ? 2 : -2) : 0);
  const blink = n => B.blink && B.blink.who === n && Math.floor(frame / 4) % 2;
  if (B.e && !B.eHidden && !blink('e')) ctx.drawImage(monSprite(B.e.sp), 100 + sh('e') + (B.eSlide || 0), 4 + (B.eDrop || 0));
  if (B.ball) { const b = charImg('ball', 'down', 0); ctx.drawImage(b, 116, 34 + (B.ballBob ? -2 : 0)); }
  const pm = B.pm != null ? G.party[B.pm] : null;
  if (pm && !B.pHidden && !blink('p')) ctx.drawImage(monSprite(pm.sp, true), 12 + sh('p') + (B.pSlide || 0), 50, 48, 48);
}
function hudHtml(m, enemy) {
  return `<div class="hn">${m.name}${m.status ? ' ' + STATUS_LABEL[m.status] : ''}</div>
    <div class="hl">Lv${m.lvl}</div><div class="hb">PS ${hpBar({hp: m._dhp ?? m.hp, st: m.st})}</div>
    ${enemy ? '' : `<div class="hp">${Math.ceil(m._dhp ?? m.hp)}/${m.st.hp}</div><div class="xp"><span style="width:${xpPct(m)}%"></span></div>`}`;
}
function xpPct(m) { if (m.lvl >= 100) return 0; const a = xpFor(m.lvl), b = xpFor(m.lvl + 1); return clamp(Math.round((m.xp - a) / (b - a) * 100), 0, 100); }
function hud() {
  if (!B) return;
  if (B.e && !B.eHidden) { B.eh.style.display = ''; B.eh.innerHTML = hudHtml(B.e, true); } else B.eh.style.display = 'none';
  const pm = G.party[B.pm];
  if (pm && !B.pHidden) { B.ph.style.display = ''; B.ph.innerHTML = hudHtml(pm, false); } else B.ph.style.display = 'none';
}
async function animHp(m) {
  if (m._dhp == null) m._dhp = m.hp;
  const diff = m.hp - m._dhp; if (!diff) return;
  const steps = Math.min(30, Math.abs(diff));
  for (let i = 1; i <= steps; i++) { m._dhp = m._dhp + diff / steps; hud(); await sleep(22); }
  m._dhp = m.hp; hud();
}
const eName = () => B.wild ? `${B.e.name} selvatico` : `${B.e.name} nemico`;
const nameOf = side => side === 'p' ? G.party[B.pm].name : eName();

async function battle(opts) {
  mode = 'battle';
  hideTextBox();
  screenEl.classList.add('battleflash'); await sleep(700); screenEl.classList.remove('battleflash');
  B = {wild: !!opts.wild, trainer: opts.trainer, canLose: opts.canLose, stages: {p: zeroStages(), e: zeroStages()},
    runs: 0, part: new Set(), levelled: new Set(), pm: null};
  B.eh = el('box hud ehud', 4, 6, 92, 30);
  B.ph = el('box hud phud', 70, 58, 88, 40);
  if (opts.wild) {
    B.team = [opts.wild];
  } else {
    B.team = opts.trainer.team.map(([sp, l]) => makeMon(sp, l));
  }
  B.ei = 0; B.e = B.team[0]; B.e._dhp = B.e.hp; seen(B.e.sp);
  B.pHidden = true; hud();
  B.eSlide = 60; for (let i = 0; i < 12; i++) { B.eSlide -= 5; await sleep(16); } B.eSlide = 0;
  if (B.wild) await say(`Appare un ${B.e.name} selvatico!`);
  else { await say(`${opts.trainer.cls} ${opts.trainer.name} vuole lottare!`); await say(`${opts.trainer.cls} ${opts.trainer.name} manda in campo ${B.e.name}!`); }
  B.pm = G.party.findIndex(m => m.hp > 0);
  await sendOut();
  let result = null;
  while (!result) {
    const act = await chooseAction();
    result = await doTurn(act);
  }
  // fine lotta
  if (result === 'win' || result === 'catch') await afterBattleEvolve();
  G.party.forEach(m => { delete m._dhp; });
  B.eh.remove(); B.ph.remove(); hideTextBox();
  B = null;
  if (result === 'lose') {
    if (opts.canLose) { healParty(); }
    else await whiteout();
  }
  mode = 'world';
  return result;
}
async function sendOut() {
  const m = G.party[B.pm]; m._dhp = m.hp; B.part.add(B.pm); B.stages.p = zeroStages();
  B.pHidden = false; B.pSlide = -50;
  await say(`Vai, ${m.name}!`, {auto: 250, keep: true});
  for (let i = 0; i < 10; i++) { B.pSlide += 5; await sleep(16); } B.pSlide = 0;
  hud();
}

async function chooseAction() {
  for (;;) {
    const m = G.party[B.pm];
    await say(`Cosa farà\n${m.name}?`, {noWait: true, keep: true});
    const box = el('box menu grid', 80, 100, 80, 44);
    const opts = ['LOTTA', 'FAUNI', 'BORSA', 'FUGA'];
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
    if (pick === 0) {
      const mv = await moveMenu(m);
      if (mv == null) continue;
      if (m.moves.every(x => x.pp <= 0)) return {type: 'move', id: 'botta', struggle: true};
      return {type: 'move', idx: mv};
    }
    if (pick === 1) {
      hideTextBox();
      const t = await partyScreen('battle', 'Chi mandi in campo?');
      if (t < 0) continue;
      if (G.party[t].hp <= 0) { await say(`${G.party[t].name} non ha energie per lottare!`); continue; }
      if (t === B.pm) { await say(`${G.party[t].name} è già in campo!`); continue; }
      return {type: 'switch', to: t};
    }
    if (pick === 2) {
      hideTextBox();
      const r = await bagMenu('battle');
      if (!r) continue;
      return {type: 'item', ...r};
    }
    if (pick === 3) return {type: 'run'};
  }
}
async function moveMenu(m) {
  const info = el('box', 0, 64, 76, 36);
  const show = i => {
    const mv = m.moves[i]; const d = MOVES[mv.id];
    info.innerHTML = `TIPO/<br>&nbsp;${d.t}<br><span class="r">PP ${mv.pp}/${d.pp}</span>`;
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
    await say(`Basta così, ${p().name}! Torna qui!`, {auto: 300, keep: true});
    B.pHidden = true; hud();
    B.pm = act.to; await sendOut();
  } else if (act.type === 'item') {
    if (ITEMS[act.item].ball) {
      const r = await throwBall(act.item);
      if (r) return r;
    } else hud();
  }
  // mosse
  const order = [];
  if (act.type === 'move') {
    const pmv = act.struggle ? {id: 'botta', pp: 99} : p().moves[act.idx];
    const pp = MOVES[pmv.id].prio || 0, ep = eMove ? (MOVES[eMove.id].prio || 0) : -9;
    let pFirst = pp > ep || (pp === ep && (speedOf(p(), 'p') > speedOf(B.e, 'e') || (speedOf(p(), 'p') === speedOf(B.e, 'e') && Math.random() < .5)));
    const pa = ['p', pmv], ea = ['e', eMove];
    if (pFirst) order.push(pa, ea); else order.push(ea, pa);
  } else order.push(['e', eMove]);
  for (const [side, mv] of order) {
    if (!mv) { if (side === 'e') await useMove('e', {id: 'botta', pp: 99}); continue; }
    const user = side === 'p' ? p() : B.e;
    if (user.hp <= 0) continue;
    const foe = side === 'p' ? B.e : p();
    if (foe.hp <= 0) continue;
    await useMove(side, mv);
    const r = await checkFaints();
    if (r !== undefined) return r;
  }
  // danni da stato a fine turno
  for (const side of ['p', 'e']) {
    const m = side === 'p' ? p() : B.e;
    if (m.hp > 0 && (m.status === 'psn' || m.status === 'brn')) {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.st.hp / 8)));
      await say(`${nameOf(side)} soffre per ${m.status === 'psn' ? 'il veleno' : 'la scottatura'}!`, {keep: true});
      await animHp(m);
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
  // stati che bloccano
  if (user.status === 'slp') {
    user.slp--;
    if (user.slp > 0) { await say(`${uName} dorme profondamente.`, {keep: true}); return; }
    user.status = null; hud(); await say(`${uName} si è svegliato!`, {keep: true});
  }
  if (user.status === 'par' && Math.random() < .25) { await say(`${uName} è paralizzato! Non riesce a muoversi!`, {keep: true}); return; }
  if (mv.pp < 99) mv.pp = Math.max(0, mv.pp - 1);
  await say(`${uName} usa ${d.n}!`, {keep: true, auto: 350});
  const st = B.stages[side];
  const selfTarget = d.fx && (d.fx.heal || (d.fx.stat && !d.fx.foe));
  if (!selfTarget && d.a && Math.random() * 100 >= d.a * stMul(st.acc)) { await say(`Ma ${uName} manca il bersaglio!`, {keep: true}); return; }
  if (d.p > 0) {
    const eff = typeEff(d.t, SPECIES[foe.sp].types);
    if (eff === 0) { await say(`Non ha effetto su ${nameOf(foeSide)}...`, {keep: true}); return; }
    const special = SPECIAL_TYPES.has(d.t);
    let A = (special ? user.st.spc : user.st.atk) * stMul(special ? st.spc : st.atk);
    let D = (special ? foe.st.spc : foe.st.def) * stMul(special ? B.stages[foeSide].spc : B.stages[foeSide].def);
    if (!special && user.status === 'brn') A /= 2;
    const crit = Math.random() < SPECIES[user.sp].b[3] / 512;
    const L = user.lvl * (crit ? 2 : 1);
    let dmg = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * d.p * A / Math.max(1, D)) / 50) + 2;
    if (SPECIES[user.sp].types.includes(d.t)) dmg = Math.floor(dmg * 1.5);
    dmg = Math.floor(dmg * eff * rand(217, 255) / 255);
    dmg = Math.max(1, dmg);
    B.blink = {who: foeSide}; await sleep(350); B.blink = null;
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
  const fx = d.fx;
  if (!fx) return;
  if (fx.heal) {
    if (user.hp >= user.st.hp) { await say('Ma non ha bisogno di recuperare!', {keep: true}); return; }
    user.hp = Math.min(user.st.hp, user.hp + Math.floor(user.st.hp * fx.heal)); await animHp(user);
    await say(`${uName} recupera energie!`, {keep: true}); return;
  }
  if (fx.ch != null && fx.ch < 1 && Math.random() >= fx.ch) return;
  if (fx.stat) {
    const tSide = fx.foe ? foeSide : side; const S = B.stages[tSide];
    const cur = S[fx.stat];
    const nv = clamp(cur + fx.d, -6, 6);
    if (nv === cur) { if (!d.p) await say('Non succede nulla!', {keep: true}); return; }
    S[fx.stat] = nv;
    const who = nameOf(tSide);
    await say(fx.d > 0 ? `${STAT_LABEL[fx.stat]} di ${who} ${fx.d > 1 ? 'aumenta molto' : 'aumenta'}!` : `${STAT_LABEL[fx.stat]} di ${who} diminuisce!`, {keep: true});
    return;
  }
  if (fx.st) {
    const types = SPECIES[foe.sp].types;
    const immune = (fx.st === 'brn' && types.includes('FUOCO')) || (fx.st === 'psn' && types.includes('VELENO')) || (fx.st === 'par' && types.includes('ELETTRO'));
    if (foe.status || immune) { if (!d.p) await say('Non ha effetto!', {keep: true}); return; }
    foe.status = fx.st; if (fx.st === 'slp') foe.slp = rand(2, 4);
    hud();
    const msg = {psn: 'è stato avvelenato!', par: 'è paralizzato! Potrebbe non riuscire a muoversi!', slp: 'si è addormentato!', brn: 'si è scottato!'}[fx.st];
    await say(`${nameOf(foeSide)} ${msg}`, {keep: true});
  }
}

async function checkFaints() {
  if (B.e.hp <= 0) {
    B.eDrop = 0; for (let i = 0; i < 8; i++) { B.eDrop += 6; await sleep(20); } B.eHidden = true; B.eDrop = 0; hud();
    await say(`${eName()} è esausto!`, {keep: true});
    await giveXp();
    B.ei++;
    if (B.ei < B.team.length) {
      B.e = B.team[B.ei]; B.e._dhp = B.e.hp; seen(B.e.sp); B.stages.e = zeroStages();
      B.part = new Set([B.pm]);
      B.eHidden = false; hud();
      await say(`${B.trainer.cls} ${B.trainer.name} manda in campo ${B.e.name}!`, {keep: true});
      if (G.party[B.pm].hp <= 0) return await playerFaint();
      return null;
    }
    if (B.trainer) {
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
  B.pHidden = true; hud();
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
async function giveXp() {
  const parts = [...B.part].filter(i => G.party[i] && G.party[i].hp > 0);
  if (!parts.length) return;
  const sp = SPECIES[B.e.sp];
  let total = Math.floor(sp.xp * B.e.lvl / 7 * (B.trainer ? 1.5 : 1));
  const each = Math.max(1, Math.floor(total / parts.length));
  for (const i of parts) {
    const m = G.party[i];
    if (m.lvl >= 100) continue;
    m.xp += each;
    await say(`${m.name} guadagna ${each} punti esperienza!`, {keep: true});
    while (m.lvl < 100 && m.xp >= xpFor(m.lvl + 1)) {
      const oldMax = m.st.hp;
      m.lvl++; m.st = calcStats(m); m.hp += m.st.hp - oldMax; m._dhp = m.hp;
      hud();
      await say(`${m.name} sale al livello ${m.lvl}!`, {keep: true});
      B.levelled.add(m);
      for (const [l, id] of SPECIES[m.sp].learn) if (l === m.lvl) await learnMove(m, id);
    }
    hud();
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
    hideTextBox();
    mode = 'battle'; B.eHidden = true; B.pHidden = true; hud();
    const holdE = B.e; B.e = null;
    await say(`Cosa? ${m.name} si sta evolvendo!`, {keep: true});
    overlay = null;
    const evoCanvas = el('box evo', 52, 22, 56, 56);
    const c = document.createElement('canvas'); c.width = c.height = 48; evoCanvas.appendChild(c);
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.clearRect(0, 0, 48, 48); g.drawImage(monSprite(i % 2 && i > 4 ? to.id : m.sp), 0, 0); await sleep(140 - i * 5); }
    g.clearRect(0, 0, 48, 48); g.drawImage(monSprite(to.id), 0, 0);
    const wasDefault = m.name === sp.name;
    const oldName = m.name;
    m.sp = to.id; if (wasDefault) m.name = to.name;
    const oldMax = m.st.hp; m.st = calcStats(m); m.hp += m.st.hp - oldMax;
    caught(to.id);
    await say(`Congratulazioni! ${oldName} si è evoluto in ${to.name}!`, {keep: true});
    for (const [l, id] of to.learn) if (l === m.lvl) await learnMove(m, id);
    evoCanvas.remove(); B.e = holdE;
  }
}
async function throwBall(id) {
  if (!B.wild) {
    await say('{NAME} lancia una SFERA... ma l\'allenatore la devia!', {keep: true});
    await say('Non si catturano i FAUNI degli altri!', {keep: true});
    useItemCount(id); return null;
  }
  useItemCount(id);
  await say(`{NAME} lancia una ${ITEMS[id].n}!`, {keep: true, auto: 300});
  const e = B.e, sp = SPECIES[e.sp];
  let a = (3 * e.st.hp - 2 * e.hp) * sp.cr * ITEMS[id].ball / (3 * e.st.hp);
  if (e.status === 'slp') a *= 2; else if (e.status) a *= 1.5;
  const p = Math.min(1, a / 255);
  const ok = Math.random() < p;
  const shakes = ok ? 3 : Math.min(2, Math.floor(Math.random() * 4 * p + Math.random() * 1.2));
  B.eHidden = true; B.ball = true; hud();
  for (let i = 0; i < shakes; i++) { await sleep(350); B.ballBob = true; await sleep(250); B.ballBob = false; }
  await sleep(300);
  if (ok) {
    await say(`Preso! ${e.name} è stato catturato!`, {keep: true});
    const isNew = !G.caught[e.sp];
    delete e._dhp; e.status = e.status || null; e.ot = G.name;
    const where = addMon(e);
    if (isNew) await say(`I dati di ${e.name} sono stati registrati nel FAUNARIO!`, {keep: true});
    if (where === 'box') await say(`La squadra è piena: ${e.name} è stato inviato al BOX.`, {keep: true});
    B.ball = false;
    return 'catch';
  }
  B.ball = false; B.eHidden = false; hud();
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
  R(ctx, 0, 0, 0, VW, VH);
  for (let x = 0; x < VW; x += 16) ctx.drawImage(tileImg('~', Math.floor(frame / 32) % 2), x, 128);
  for (let x = 0; x < VW; x += 16) ctx.drawImage(tileImg('T', 0), x, 112);
  const sp = TITLE_MONS[Math.floor(frame / 180) % TITLE_MONS.length];
  ctx.drawImage(monSprite(sp), 56, 54);
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
  R(ctx, 0, 0, 0, VW, VH);
  if (introPic === 'prof') { const c = charImg('prof', 'down', 0); ctx.drawImage(c, 0, 0, 16, 16, 56, 18, 48, 48); }
  else if (introPic === 'player') { ctx.drawImage(charImg('player', 'down', 0), 0, 0, 16, 16, 56, 18, 48, 48); }
  else if (introPic === 'rival') { ctx.drawImage(charImg('rival', 'down', 0), 0, 0, 16, 16, 56, 18, 48, 48); }
  else if (introPic) ctx.drawImage(monSprite(introPic), 56, 22);
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
