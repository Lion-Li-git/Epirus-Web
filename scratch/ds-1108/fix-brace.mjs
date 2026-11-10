
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'tools/train-3p.mjs';
let t = readFileSync(P, 'utf8');
const i = t.indexOf("\n}\n}\n\n/* ===== v1.6.60");
if (i < 0) { console.error('not found'); process.exit(2); }
t = t.slice(0, i) + "\n}\n\n/* ===== v1.6.60" + t.slice(i + "\n}\n}\n\n/* ===== v1.6.60".length);
writeFileSync(P, t);
console.log('extra brace removed');
