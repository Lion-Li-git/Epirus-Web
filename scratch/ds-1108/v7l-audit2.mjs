
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
const ids = Object.keys(byId).filter(id => /^v7(l|m)/i.test(id));
const counts = {};
for (const id of ids) { const L = lin[id] || {}; const k = (L.parent || '(无父)') + ' | psrc=' + (L.psrc || '-') + ' | 父在图上=' + (byId[L.parent] ? '是' : '否'); counts[k] = (counts[k] || 0) + 1; }
for (const k of Object.keys(counts).sort()) console.log(counts[k] + ' 枚  ' + k);
const wide = ids.filter(id => lin[id] && lin[id].wid && lin[id].wid.length > 12);
console.log('\nwid 列样例:', ids.slice(0,3).map(id => id + '=' + (lin[id]||{}).wid).join(' '));
