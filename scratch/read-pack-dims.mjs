#!/usr/bin/env node
/* read-pack-dims.mjs — 读 2.0 包容器 dims（scratch 诊断件） */
import { readFileSync } from 'node:fs';
const s = readFileSync(process.argv[2] || 'scratch/arms/CEM48c-s7.bak', 'utf8');
const at = s.indexOf('EPIRUS_CHAMPION_3P ');
const i = s.indexOf('{', at);
let depth = 0, inStr = false, esc = false, end = -1;
for (let k = i; k < s.length; k++) {
  const ch = s[k];
  if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
  if (ch === '"') { inStr = true; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
}
const raw = JSON.parse(s.slice(i, end));
console.log('v =', raw.v, '‖ params =', raw.a ? raw.a.length : '?');
console.log('dims =', JSON.stringify(raw.dims));
console.log('keys =', Object.keys(raw).join(','));
console.log('arch =', JSON.stringify(raw.arch));
console.log('n =', raw.n);
const L = raw.layout || {};
if (L.seg) for (const seg of L.seg) console.log('seg', seg.name, 'off', seg.off, 'len', seg.len);
console.log('layout 其余键 =', Object.keys(L).filter((k) => k !== 'seg').join(','));
