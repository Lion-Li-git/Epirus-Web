#!/usr/bin/env node
/* 一次性诊断：算 4 条 D191 未登记文件的 wid，并列出同 wid 的全部文件（找孪生主名）。只读。 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

function packArr(txt) {
  const m = /EPIRUS_CHAMPION(_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt) || /(?:^|\n)[\w.]*EPIRUS_CHAMPION(?!_3P|_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt);
  if (!m) return null;
  const o = JSON.parse(m[2]);
  return o.a;
}
function widOfArr(a) {
  if (!a || typeof a.length !== 'number') return null;
  return createHash('sha1').update(JSON.stringify(Array.from(a))).digest('hex').slice(0, 16);
}
function widOf(txt) { const a = packArr(txt); return a ? widOfArr(a) : null; }

const TARGETS = [
  'docs/artifacts/night-adapt/MSB15R-gd4keep-R1S1682546951.js',
  'docs/artifacts/night-adapt/MSB15R-gd4keep-R1S600595401.js',
  'docs/artifacts/MSB15R-gd4rat-R1S1155875730-band1.bak',
  'docs/artifacts/night-adapt/MSB15R-gd4rat-R1S680041201.js'
];
const wids = new Set();
for (const t of TARGETS) {
  const w = widOf(readFileSync(t, 'utf8'));
  console.log('target', t, 'wid', w);
  if (w) wids.add(w);
}
/* 全库扫（与 dedupe 同范围：docs/artifacts） */
function walk(d, out) {
  let e = [];
  try { e = readdirSync(d, { withFileTypes: true }); } catch (err) { return out; }
  for (const x of e) {
    if (x.name === '_quarantine' || x.name === 'node_modules') continue;
    const p = join(d, x.name);
    if (x.isDirectory()) walk(p, out);
    else if (/\.(bak|js)$/.test(x.name)) out.push(p);
  }
  return out;
}
const files = walk('docs/artifacts', []);
const byWid = new Map();
for (const f of files) {
  let w = null;
  try { w = widOf(readFileSync(f, 'utf8')); } catch (e) { continue; }
  if (!w || !wids.has(w)) continue;
  if (!byWid.has(w)) byWid.set(w, []);
  byWid.get(w).push(relative('.', f).split('\\').join('/'));
}
for (const [w, fs] of byWid) {
  console.log('\nwid', w, '(' + fs.length + ' 份):');
  for (const f of fs.sort()) console.log('  ' + f + '  mtime=' + statSync(f).mtime.toISOString());
}
