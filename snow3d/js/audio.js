// ============================================================ AUDIO sintetizzato (vento, neve, rail, colpi, musica)
var AU = null;
function ensureAudio() {
  if (AU) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  var ctx = new C(), master = ctx.createGain(); master.gain.value = save.set.sound ? 0.9 : 0; master.connect(ctx.destination);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
  var sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(comp);
  var mus = ctx.createGain(); mus.gain.value = save.set.music ? 0.32 : 0; mus.connect(comp);
  var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  AU = { ctx: ctx, master: master, sfx: sfx, mus: mus, noise: nb, loops: {}, next: 0, step: 0 };
  function loop(name, type, f, q) {
    var src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(g); g.connect(sfx); src.start();
    AU.loops[name] = { g: g, f: fl };
  }
  loop('wind', 'bandpass', 500, 0.6);
  loop('carve', 'bandpass', 2600, 0.9);
  loop('skid', 'lowpass', 900, 0.7);
  loop('rail', 'bandpass', 3300, 7);
  loop('box', 'bandpass', 1300, 2.5);
  var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 1240; og.gain.value = 0; o.connect(og); og.connect(sfx); o.start();
  AU.loops.ring = { g: og, f: o };
}
function setLoop(name, gain, freq) {
  if (!AU) return; var L = AU.loops[name], t = AU.ctx.currentTime;
  L.g.gain.setTargetAtTime(gain, t, 0.06);
  if (freq) L.f.frequency.setTargetAtTime(freq, t, 0.08);
}
function tone(freq, dur, type, gain, freqEnd, delay, dest) {
  if (!AU) return; var ctx = AU.ctx, t = ctx.currentTime + (delay || 0);
  var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t); if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, type, f0, f1, gain, q, delay) {
  if (!AU) return; var ctx = AU.ctx, t = ctx.currentTime + (delay || 0);
  var s = ctx.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 1;
  var g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(AU.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function sfx(name, a) {
  if (!AU || !save.set.sound) return;
  switch (name) {
    case 'pop': noiseHit(0.09, 'highpass', 1800, 900, 0.35, 0.7); tone(140, 0.12, 'sine', 0.35, 70); break;
    case 'land': var k = clamp(a || 0.5, 0.2, 1); tone(95, 0.22, 'sine', 0.55 * k, 45); noiseHit(0.26, 'lowpass', 1600, 300, 0.55 * k, 0.8); break;
    case 'rail': tone(1500, 0.06, 'square', 0.05, 2200); noiseHit(0.1, 'bandpass', 3200, 2600, 0.3, 4); break;
    case 'box': tone(320, 0.08, 'triangle', 0.25, 200); noiseHit(0.12, 'bandpass', 1400, 900, 0.35, 2); break;
    case 'switch': noiseHit(0.08, 'bandpass', 2600, 1800, 0.25, 3); break;
    case 'grab': noiseHit(0.12, 'bandpass', 900, 1600, 0.18, 1.2); break;
    case 'crash': tone(70, 0.4, 'sine', 0.7, 35); noiseHit(0.6, 'lowpass', 1400, 120, 0.9, 0.7); noiseHit(0.3, 'bandpass', 600, 200, 0.5, 1, 0.12); break;
    case 'trick': [0, 4, 7].forEach(function (s, i) { tone(523.25 * Math.pow(2, s / 12), 0.22, 'triangle', 0.12, 0, i * 0.06); }); break;
    case 'perfect': [0, 4, 7, 12].forEach(function (s, i) { tone(587.3 * Math.pow(2, s / 12), 0.28, 'triangle', 0.13, 0, i * 0.055); }); break;
    case 'bank': [0, 7, 12, 16].forEach(function (s, i) { tone(392 * Math.pow(2, s / 12), 0.5, 'sine', 0.16, 0, i * 0.07); }); tone(1568, 0.6, 'triangle', 0.05, 0, 0.3); break;
    case 'lost': tone(330, 0.3, 'triangle', 0.15, 160); tone(247, 0.4, 'triangle', 0.12, 120, 0.12); break;
    case 'goal': [0, 5, 9, 12, 17].forEach(function (s, i) { tone(523.25 * Math.pow(2, s / 12), 0.35, 'triangle', 0.14, 0, i * 0.07); }); break;
    case 'click': tone(900, 0.05, 'triangle', 0.1, 600); break;
    case 'whoosh': noiseHit(0.35, 'bandpass', 500, 1800, 0.25, 0.8); break;
  }
}
function updateAudio(dt, playing) {
  if (!AU) return;
  if (!playing || !P) { ['wind', 'carve', 'skid', 'rail', 'box', 'ring'].forEach(function (n) { setLoop(n, n === 'wind' ? 0.05 : 0); }); return; }
  var sp = speedOf(), g = P.mode === 'ground', air = P.mode === 'air', rail = P.mode === 'rail';
  setLoop('wind', clamp(0.02 + sp * sp * 0.00028 + (air ? 0.06 : 0), 0, 0.3), 300 + sp * 38);
  var edge = g ? clamp(Math.abs(P.steer) * 0.8 + 0.25, 0, 1) : 0;
  setLoop('carve', g ? clamp(sp / 20, 0, 1) * 0.12 * edge : 0, 1800 + sp * 60);
  var skid = g ? clamp(P.brake + Math.abs(Math.sin(P.yawOff)) * 0.8 + (P.scrub || 0), 0, 1) : 0;
  setLoop('skid', skid * clamp(sp / 12, 0, 1) * 0.5, 700 + sp * 25);
  var isBox = rail && P.rail && P.rail.r.kind === 'box';
  setLoop('rail', rail && !isBox ? 0.22 : 0, 3000 + (P.rail ? Math.abs(P.rail.vs) * 40 : 0));
  setLoop('ring', rail && !isBox ? 0.025 : 0, 1240 + (P.rail ? Math.sin(P.rail.t * 30) * 20 : 0));
  setLoop('box', isBox ? 0.3 : 0);
}
function setVolumes() {
  if (!AU) return;
  AU.master.gain.setTargetAtTime(save.set.sound ? 0.9 : 0, AU.ctx.currentTime, 0.05);
  AU.mus.gain.setTargetAtTime(save.set.music ? 0.32 : 0, AU.ctx.currentTime, 0.05);
}
// ------------------------------------------------------------ musica: loop elettronico tranquillo, generato
var MUS = { bpm: 96, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]], bass: [45, 41, 36, 43] };
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function musicTick() {
  if (!AU || !save.set.music) return;
  var ctx = AU.ctx, spb = 60 / MUS.bpm / 4; // sedicesimi
  if (AU.next < ctx.currentTime) AU.next = ctx.currentTime + 0.05;
  while (AU.next < ctx.currentTime + 0.2) {
    var s = AU.step, t = AU.next, bar = Math.floor(s / 16) % 4, i16 = s % 16, ch = MUS.chords[bar];
    var d = t - ctx.currentTime;
    if (i16 % 4 === 0) { tone(110, 0.25, 'sine', i16 === 0 || i16 === 8 ? 0.55 : 0.3, 45, d, AU.mus); }
    if (i16 % 2 === 1) noiseHitTo(0.04, 'highpass', 8000, 0, 0.09, d);
    if (i16 === 4 || i16 === 12) noiseHitTo(0.16, 'bandpass', 1800, 900, 0.22, d);
    if (i16 === 0 || i16 === 6 || i16 === 10) tone(mtof(MUS.bass[bar]), 0.32, 'triangle', 0.32, 0, d, AU.mus);
    if (i16 === 0) ch.forEach(function (n, j) { tone(mtof(n + 12), 1.9, 'sine', 0.05, 0, d + j * 0.01, AU.mus); });
    if (i16 % 4 === 2 && Math.random() < 0.55) tone(mtof(ch[(s * 7) % 4] + 24), 0.18, 'triangle', 0.035, 0, d, AU.mus);
    AU.step++; AU.next += spb;
  }
}
function noiseHitTo(dur, type, f0, f1, gain, delay) {
  var ctx = AU.ctx, t = ctx.currentTime + (delay || 0);
  var s = ctx.createBufferSource(); s.buffer = AU.noise;
  var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f0;
  var g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(AU.mus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
