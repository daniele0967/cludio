// Arriva sui rail con vari scostamenti laterali: deve agganciare solo se e' davvero sopra (aiuto 6 cm)
const C = require('./load.js'); const vm = require('vm'); const run = c => vm.runInContext(c, C);
run(`newWorld(21, 'free'); genUntil(4000);`);
const rails = JSON.parse(run(`JSON.stringify(W.rails.map(r => ({ id: r.id, type: r.type, kind: r.kind, entry: r.entry, d0: r.d0, d1: r.d1, u: r.pts[0].u, hw: r.hw })))`));
const pickType = t => rails.find(r => r.type === t);
function trial(r, off, jumpEarly) {
  return JSON.parse(run(`(function(){
    comboReset(); EV.length = 0;
    newPlayer(${r.d0} - 16, ${r.u + off}, 9); var res = [];
    for (var i = 0; i < 120 * 6; i++) {
      var d = dist(), u = P.x - cx(d), hd = Math.atan2(P.hx, -P.hz);
      IN.sx = P.mode === 'ground' ? clamp((((${r.u + off}) - u) * 0.25 - hd) * 4, -1, 1) : 0;
      IN.jump = ${r.entry === 'ollie'} && P.mode === 'ground' && d > ${r.d0} - 9 && d < ${r.d0} - 2.6;
      stepPlayer(DT);
      for (var e of EV) { if (e.t === 'railOn') res.push('su: ' + e.name); if (e.t === 'crash') res.push('CADUTA ' + e.why); if (e.t === 'trick') res.push(e.name + ' ' + (e.m||0).toFixed(1) + 'm'); if (e.t === 'land') res.push('atterra ' + e.q + (e.trick ? ' ' + e.trick.name : '')); }
      EV.length = 0;
      if (P.mode === 'crash' || d > ${r.d1} + 8) break;
    }
    return JSON.stringify(res.join(', ') || 'passa accanto');
  })()`));
}
for (const t of ['box', 'rail', 'raildown', 'kink', 'rainbow', 'boxdown']) {
  const r = pickType(t); if (!r) { console.log(t, 'non trovato'); continue; }
  console.log(`--- ${t} (${r.kind}, ${r.entry}, mezza larghezza ${r.hw})`);
  for (const off of [0, 0.1, 0.18, 0.25, 0.35, 0.5, 0.8, 1.2]) console.log(`  scostamento ${off.toFixed(2)} m: ${trial(r, off)}`);
}
