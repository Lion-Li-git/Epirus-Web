const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');
const old = 'hall: hall.map(function (h) { return h.wid; })';
let n = 0;
while (s.includes(old)) { s = s.replace(old, 'hall: hall.map(function (h) { return h.wid || widOfArr(h.params); })'); n++; }
fs.writeFileSync('tools/train-3p.mjs', s);
console.log('hall-wid fixed x' + n);
