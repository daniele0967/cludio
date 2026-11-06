// Carica i moduli logici del gioco in Node (senza grafica) per i test.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.THREE = require('../vendor/three.min.js');
const files = ['core.js', 'world.js', 'tricks.js', 'physics.js'];
const ctx = vm.createContext(Object.assign(Object.create(global), { THREE: global.THREE, console, Math, performance: { now: () => Date.now() } }));
let code = '';
for (const f of files) { const p = path.join(__dirname, '..', 'js', f); if (fs.existsSync(p)) code += fs.readFileSync(p, 'utf8') + '\n'; }
code += '\n;this.__exports = { get W() { return W; } };';
vm.runInContext(code, ctx, { filename: 'game-logic.js' });
module.exports = ctx;
