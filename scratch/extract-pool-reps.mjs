#!/usr/bin/env node
/* extract-pool-reps.mjs — 从现役池文件抽 5 枚代表落盘（scratch，不入库） */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const s = readFileSync('js/bundled-champion-pool.js', 'utf8');
const at = s.indexOf('EPIRUS_CHAMPION_POOL');
const i = s.indexOf('{', at);
let depth = 0, inStr = false, esc = false, end = -1;
for (let k = i; k < s.length; k++) {
  const ch = s[k];
  if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
  if (ch === '"') { inStr = true; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
}
const pool = JSON.parse(s.slice(i, end));
const mem = pool.members || [];
console.log('成员数', mem.length, 'pack.v =', mem[0] && mem[0].pack && mem[0].pack.v);
const tiers = {};
for (const x of mem) tiers[x.tier] = (tiers[x.tier] || 0) + 1;
console.log('tier 分布', JSON.stringify(tiers));
mkdirSync('scratch/poolrep', { recursive: true });
const byTier = {};
for (const x of mem) (byTier[x.tier] = byTier[x.tier] || []).push(x);
const picks = [];
for (const t of Object.keys(byTier).sort()) {
  byTier[t].sort((a, b) => (a.id < b.id ? -1 : 1));
  picks.push(...byTier[t].slice(0, t === 'hard' ? 2 : 3));
}
const chosen = picks.slice(0, 5);
for (const x of chosen) {
  const id = String(x.id).replace(/[^A-Za-z0-9_-]/g, '_');
  writeFileSync('scratch/poolrep/' + id + '.js', 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(x.pack) + ';\n');
  console.log('写出', id, 'tier=' + x.tier, 'verdict=' + x.promoteVerdict);
}
