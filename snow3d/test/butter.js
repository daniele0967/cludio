const C = require('./load.js'); const vm = require('vm'); const run = c => vm.runInContext(c, C);
run(`newWorld(3,'free'); genUntil(400);`);
for (const [sx, t] of [[1, 0.25], [1, 0.5], [1, 1.0], [-1, 0.55], [0, 0.6]]) {
  const r = run(`(function(){ comboReset(); EV.length=0; newPlayer(40,0,9); for (var i=0;i<30;i++) stepPlayer(DT); IN.press=1; for (var i=0;i<120*${t};i++){ IN.sx=${sx}; stepPlayer(DT);} IN.sx=0; IN.press=0; for (var i=0;i<60;i++) stepPlayer(DT); var o=EV.filter(function(e){return e.t==='trick'||e.t==='sketch'||e.t==='crash';}).map(function(e){return e.name||e.t+':'+e.why;}); return o.join(',') + ' sw=' + P.sw; })()`);
  console.log('stick', sx, 'per', t, 's ->', r);
}
