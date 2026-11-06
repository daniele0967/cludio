// Bot: scende al centro della pista, sterza verso la corsia del prossimo kicker, tiene premuto il salto sulla rampa.
const C = require('./load.js');
const vm = require('vm');
const run = (code) => vm.runInContext(code, C);
const seed = +(process.argv[2] || 7), meters = +(process.argv[3] || 3000), trickMode = process.argv[4] || 'none';
run(`newWorld(${seed}, 'free'); genUntil(400); newPlayer(5, 0, 8); save.set.assist = 1;`);
const out = { lands: {}, crashes: [], tricks: [], banks: 0, kicks: 0, rails: 0 };
let t = 0, lastD = 0;
while (t < 600) {
  const st = run(`(function(){
    genUntil(dist() + 400);
    var d = dist(), f = null, list = W.feats;
    for (var i = 0; i < list.length; i++) { var g = list[i]; if (g.t === 'kick' && g.dLip > d - 1 && g.dLip < d + 60) { if (!f || g.dLip < f.dLip) f = g; } }
    var tu = f ? f.u : 0, u = P.x - cx(d);
    var hd = Math.atan2(P.hx, -P.hz), want = clamp((tu - u) * 0.08, -0.5, 0.5); IN.sx = P.mode === "ground" ? clamp((want - hd) * 2.5, -1, 1) : 0;
    IN.sy = 0; IN.press = 0; IN.grab = -1;
    // salto: tiene premuto sulla rampa (si stacca da solo sul lip)
    IN.jump = !!(P.mode === 'ground' && f && f.dLip - d < 4 && f.dLip - d > -0.3);
    if (P.mode === 'air' && '${trickMode}' === 'spin' && P.air && P.air.t < 0.5) IN.sx = 1;
    if (P.mode === 'air' && '${trickMode}' === 'grab' && P.air && P.air.t > 0.2 && P.air.tLand > 0.3) IN.grab = 2;
    for (var k = 0; k < 4; k++) stepPlayer(DT);
    if (P.mode === 'crash' && P.crashT > 1.5) respawn();
    var ev = EV.splice(0); return JSON.stringify({ d: dist(), mode: P.mode, sp: speedOf(), ev: ev });
  })()`);
  const s = JSON.parse(st);
  for (const e of s.ev) {
    if (e.t === 'land') { out.lands[e.q] = (out.lands[e.q] || 0) + 1; if (e.kick) out.kicks++; if (e.trick) out.tricks.push(e.trick.name + ' ' + e.pts + ' (' + e.q + ', air ' + e.air.toFixed(2) + ', imp ' + e.impact.toFixed(1) + ')'); }
    if (e.t === 'crash') out.crashes.push(e.why + ' @' + s.d.toFixed(0));
    if (e.t === 'bank') out.banks++;
    if (e.t === 'railOn') out.rails++;
  }
  t += 4 / 120;
  if (s.d > meters) break;
}
const fin = JSON.parse(run('JSON.stringify({d: dist(), sp: speedOf(), mode: P.mode})'));
console.log('seed', seed, 'tempo', t.toFixed(0) + 's', 'distanza', fin.d.toFixed(0), 'v', fin.sp.toFixed(1));
console.log('atterraggi', out.lands, 'kicker', out.kicks, 'rail', out.rails, 'combo incassate', out.banks);
console.log('cadute', out.crashes.length, out.crashes.slice(0, 12).join(', '));
console.log(out.tricks.slice(0, 14).join('\n'));
