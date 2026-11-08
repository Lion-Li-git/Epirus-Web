
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const byId = {}; for (const r of co.slice(1)) byId[r[h.id]] = r;
const lin = {};
for (const f of ['champion-map/lineage.tsv','champion-map/lineage-g3.tsv']) {
  const t = rd(f); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) lin[r[lh.id]] = { fam: r[lh.fam], label: r[lh.famLabel], parent: r[lh.parent], psrc: r[lh.parentSrc] || '', wid: r[lh.wid] };
}
const ids = Object.keys(byId).filter(id => /^V7[ACML]|^V7C|^V7M|^V7L/i.test(id));
console.log('大写 V7* 候选 ' + ids.length + ' 枚');
for (const id of ids) {
  const L = lin[id] || {};
  console.log('  ' + id.padEnd(12) + ' fam=' + (L.fam||'-') + ' parent=' + (L.parent||'(无)') + ' psrc=' + (L.psrc||'-') + ' 父在图上=' + (byId[L.parent]?'是':'否') + ' wid=' + (L.wid||'-'));
}
