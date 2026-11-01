const fs = require('fs');
let s = fs.readFileSync('scratch/probe-transfer.mjs', 'utf8');
s = s.replace(/const FACES = \{[\s\S]*?\};/, `const FACES = {};
for (const nm of Object.keys(B).filter((k) => k.startsWith('pick'))) {
  const f = B[nm];
  if (typeof f === 'function') FACES[nm.replace('pick', '')] = [f, f, f, f];
}`);
s = s.replace('for (const [pkName, params] of [["s41", S41], ["champ", CHAMP]]) {', 'for (const [pkName, params] of [["s41", S41]]) {');
s = s.replace('const GAMES = 60;', 'const GAMES = 20;');
fs.writeFileSync('scratch/probe-transfer.mjs', s);
console.log('face-scan mode');
