
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const rows = co.slice(1).filter(r => /^v7(l|m|L|M)/.test(r[h.id]) || /v7l|v7m/i.test(r[h.id]));
const lin = {};
for (const f of ['champion-map/lineage.tsv','champion-map/lineage-g3.tsv']) {
  const t = rd(f); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) lin[r[lh.id]] = { fam: r[lh.fam], parent: r[lh.parent], psrc: r[lh.parentSrc] || '', wid: r[lh.wid] };
}
console.log('v7l/v7m 节点 ' + rows.length + ' 枚：');
for (const r of rows) {
  const id = r[h.id], L = lin[id] || {};
  console.log('  ' + id.padEnd(14) + ' ver=' + r[h.ver] + ' fam=' + (L.fam || '-') + ' parent=' + (L.parent || '(无)') + ' psrc=' + (L.psrc || '-') + ' path=' + (r[h.path] || '').replace('docs/artifacts/', ''));
}
