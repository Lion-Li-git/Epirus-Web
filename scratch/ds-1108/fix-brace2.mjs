
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'tools/train-3p.mjs';
let raw = readFileSync(P, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
const pat = '\n}\n}\n\n/* ===== v1.6.60';
const i = t.indexOf(pat);
console.log('found at', i);
if (i >= 0) t = t.slice(0, i) + '\n}\n\n/* ===== v1.6.60' + t.slice(i + pat.length);
if (!t.includes('[passive-ops]')) console.log('WARN block missing');
writeFileSync(P, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log('done, crlf=' + crlf);
