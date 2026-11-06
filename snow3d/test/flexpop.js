const C = require('./load.js'); const vm = require('vm'); const run = c => vm.runInContext(c, C);
run(`newWorld(3,'free'); genUntil(400);`);
for (const t of [0.1, 0.4]) console.log('press tenuto', t, 's ->', run(`(function(){ EV.length=0; newPlayer(40,0,9); for (var i=0;i<30;i++) stepPlayer(DT); IN.press=1; for (var i=0;i<120*${t};i++) stepPlayer(DT); IN.press=0; stepPlayer(DT); var m = P.mode, vy = P.vy.toFixed(2); var ev = EV.map(function(e){return e.t;}).join(','); for (var i=0;i<200;i++) stepPlayer(DT); return 'modo ' + m + ' vy ' + vy + ' eventi ' + ev; })()`));
