// Prova spin/flip/grab su un kicker L per varie durate dello stick: deve atterrare se lo stick si lascia in tempo.
const C = require('./load.js'); const vm = require('vm'); const run = c => vm.runInContext(c, C);
run(`newWorld(5, 'free'); genUntil(1500);`);
const kick = JSON.parse(run(`(function(){ var f = W.feats.find(g => g.t==='kick' && g.size==='L'); return JSON.stringify({d0: f.d0, u: f.u, vd: f.K.vd, lip: f.dLip}); })()`));
function trial(sx, sy, hold, grab, assist, pop) {
  return JSON.parse(run(`(function(){
    save.set.assist = ${assist}; comboReset(); EV.length = 0;
    newPlayer(${kick.d0} - 14, ${kick.u}, ${kick.vd}); var t = 0, res = null, airT = 0;
    for (var i = 0; i < 120 * 8; i++) {
      var d = dist();
      IN.sx = 0; IN.sy = 0; IN.grab = -1;
      IN.jump = P.mode === 'ground' && d > ${kick.d0} - 4 && d < ${kick.lip} - (${pop} ? 0.4 : -1);
      if (P.mode === 'air') { airT = P.air.t; if (P.air.t < ${hold}) { IN.sx = ${sx}; IN.sy = ${sy}; } if (${grab} >= 0 && P.air.t > 0.3 && P.air.tLand > 0.35) IN.grab = ${grab}; }
      stepPlayer(DT);
      for (var e of EV) { if (e.t === 'land') res = { ok: true, q: e.q, name: e.trick ? e.trick.name : '-', air: +e.air.toFixed(2) }; if (e.t === 'crash') res = { ok: false, why: e.why, air: +airT.toFixed(2) }; }
      EV.length = 0;
      if (res) break;
    }
    return JSON.stringify(res);
  })()`));
}
const rows = [];
for (const assist of [1, 0]) for (const [sx, sy, lbl] of [[1, 0, 'spin dx'], [-1, 0, 'spin sx'], [0, 1, 'frontflip'], [0, -1, 'backflip'], [0.7, -0.7, 'diag (cork)']]) {
  for (const hold of [0.3, 0.6, 0.9, 1.2, 1.5, 1.8]) {
    const r = trial(sx, sy, hold, -1, assist, 1);
    rows.push(`aiuto ${assist} ${lbl.padEnd(12)} stick ${hold.toFixed(1)}s -> ${r ? (r.ok ? 'OK ' + r.q + ' ' + r.name : 'CADUTA ' + r.why) : '?'} (aria ${r && r.air})`);
  }
}
for (const g of [0, 2, 4, 7]) { const r = trial(0, 0, 0, g, 1, 1); rows.push(`grab ${g} -> ${r.ok ? 'OK ' + r.q + ' ' + r.name : 'CADUTA ' + r.why}`); }
console.log(rows.join('\n'));
