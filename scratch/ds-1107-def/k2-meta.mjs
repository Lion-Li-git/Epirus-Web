
import { readFileSync } from 'node:fs';
const s = readFileSync('scratch/night-adapt2/KD-K2.bak', 'utf8').slice(0, 1200);
const m = s.match(/"teacher":"([^"]+)"/);
console.log('teacher =', m ? m[1] : '(无)');
const led = readFileSync('scratch/night-adapt2/triplet-ledger.tsv', 'utf8').trim().split('\n');
console.log('ledger 行数', led.length);
for (const l of led.slice(-4)) { const o = JSON.parse(l); console.log(o.pack.replace('docs/artifacts/', '') + '  S=' + o.X4P_S + ' L=' + o.X4P_L + ' dEps ' + o.dEps_S + '/' + o.dEps_L); }
