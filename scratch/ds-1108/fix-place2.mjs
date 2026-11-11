
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'tools/train-3p.mjs';
let t = readFileSync(P, 'utf8');
const iA = t.indexOf('EPIRUS_PASSIVE_OPPS=<k>');
if (iA < 0) { console.error('no iA'); process.exit(2); }
const start = t.lastIndexOf('/* =====', iA);
const iC = t.indexOf('对农民桌胜率）\');', iA);
if (start < 0 || iC < 0) { console.error('no markers', start, iC); process.exit(2); }
const consoleEnd = t.indexOf('\n', iC);
const block = t.slice(start, consoleEnd);
let head = t.slice(0, start).replace(/\n+$/, '\n');
let after = t.slice(consoleEnd);
after = after.replace(/^\n\}\n\}/, '\n}\n');
const out = head + '}\n\n' + block + '\n' + after;
writeFileSync(P, out);
console.log('moved ok; head ends with:', JSON.stringify(head.slice(-60)));
