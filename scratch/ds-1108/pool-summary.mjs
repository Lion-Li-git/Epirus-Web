
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const g = rd('scratch/ds-1108/pool-feas-multi.tsv');
const gh = Object.fromEntries(g[0].map((x, i) => [x, i]));
const co = rd('champion-map/coords-projcols.tsv');
const ch = Object.fromEntries(co[0].map((x, i) => [x, i]));
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const x4 = {};
for (const r of co.slice(1)) { let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = r[ch['P'+n]]; if (v !== '' && v !== undefined) { a += W[n] * +v; w += W[n]; } } if (w) x4[r[ch.id]] = a / w; }
let pass = 0;
const rows = [];
for (const r of g.slice(1)) {
  if (!r[gh.id]) continue;
  const ok = r[gh.ok] === '1';
  if (ok) pass++;
  rows.push({ id: r[gh.id], ok, nFail: +r[gh.nFail], fA: +r[gh.fieldA], fB: +r[gh.fieldBClears], G: +r[gh.G], x4: x4[r[gh.id]] });
}
rows.sort((a, b) => (b.ok - a.ok) || (b.x4 - a.x4));
console.log('池 23 枚：过线 ' + pass + ' 枚');
for (const r of rows) console.log('  ' + (r.ok ? '✔' : '✘') + ' ' + r.id.padEnd(22) + ' X̄₄=' + (r.x4 === undefined ? '—' : r.x4.toFixed(3)) + ' 场A=' + (r.fA * 100).toFixed(1) + '% 场B=' + r.fB + ' G=' + r.G + ' nFail=' + r.nFail);
