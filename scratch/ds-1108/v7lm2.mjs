
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const byId = {}; for (const r of co.slice(1)) byId[r[h.id]] = r;
const lin = {};
for (const f of ['champion-map/lineage.tsv','champion-map/lineage-g3.tsv']) {
  const t = rd(f); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) lin[r[lh.id]] = { fam: r[lh.fam], parent: r[lh.parent], psrc: r[lh.parentSrc] || '', wid: r[lh.wid] };
}
const w = (id) => { const p = byId[id] && byId[id][h.path]; const fp = p ? ('docs/artifacts/' + p) : ''; return fp && existsSync(fp) ? widOf(readFileSync(fp, 'utf8')) : ''; };
const hits = Object.keys(byId).filter(id => /^v7lm|^v7l|^v7m/i.test(id) && lin[id] && lin[id].parent && byId[lin[id].parent]);
console.log('父在图上、名字像 v7l/v7m 的点：');
for (const id of hits) {
  const L = lin[id];
  console.log('  ' + id.padEnd(12) + ' → ' + L.parent.padEnd(10) + ' psrc=' + L.psrc + '  子wid=' + (w(id) || '-') + '  父wid=' + (L.wid || w(L.parent) || '-') + ((w(id) && w(id) === w(L.parent)) ? '  ⚠ 同权重' : ''));
}
