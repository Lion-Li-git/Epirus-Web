
import { readFileSync, existsSync } from 'node:fs';
const files = ['champion-map/feas-short-s1.tsv','champion-map/feas-short-s2.tsv','champion-map/feas-short-s3.tsv','champion-map/feas-short-s4.tsv',
  'champion-map/feas-long-s1.tsv','champion-map/feas-long-s2.tsv','champion-map/feas-long-s3.tsv','champion-map/feas-long-s4.tsv'];
const rec = {};
for (const f of files) {
  if (!existsSync(f)) continue;
  const t = readFileSync(f, 'utf8').replace(/\r\n/g,'\n').trim().split('\n').map(l => l.split('\t'));
  const H = Object.fromEntries(t[0].map((x,i)=>[x,i]));
  const long = f.includes('long');
  for (const r of t.slice(1)) {
    const id = r[H.id]; if (!id) continue;
    rec[id] = rec[id] || {};
    rec[id][long ? 'L' : 'S'] = { fA: +(r[H.fieldA]||NaN), fB: +(r[H.fieldBClears]||NaN), ok: r[H.ok] };
  }
}
/* 版本：从 coords 取 ver */
const co = readFileSync('champion-map/coords-gen3-1105.tsv','utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trim().split('\n').map(l=>l.split('\t'));
const ch = Object.fromEntries(co[0].map((x,i)=>[x,i]));
const ver = {}; for (const r of co.slice(1)) ver[r[ch.id]] = r[ch.ver];
const buckets = {};
for (const id of Object.keys(rec)) {
  const v = ver[id] || '?';
  const b = buckets[v] = buckets[v] || { n:0, fBok:0, fAok:0, bothMissing:0 };
  b.n++;
  const row = rec[id].L || rec[id].S;
  if (!row) continue;
  const fb = rec[id].L ? rec[id].L.fB : rec[id].S.fB;
  const fa = rec[id].L ? rec[id].L.fA : rec[id].S.fA;
  if (fb >= 0.3) b.fBok++;
  if (fa >= 0.2) b.fAok++;
}
console.log('版本 | 有门读数 | 场B 过线(≥0.3) | 场A 过线(≥20%)');
for (const k of Object.keys(buckets).sort()) { const b = buckets[k]; console.log(k + ' | ' + b.n + ' | ' + b.fBok + ' (' + (100*b.fBok/b.n).toFixed(0) + '%) | ' + b.fAok + ' (' + (100*b.fAok/b.n).toFixed(0) + '%)'); }
