
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const ids = new Set(co.slice(1).map(r => r[0]));
const L = [];
for (const f of ['champion-map/lineage.tsv', 'champion-map/lineage-g3.tsv']) {
  const t = rd(f); const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) L.push({ id: r[h.id], parent: r[h.parent], psrc: r[h.parentSrc] || '', src: f });
}
const SOLID = new Set(['hash', 'hash-emb', 'seedpack-wid', 'slot-wid']);
const on = L.filter(r => ids.has(r.id) && r.parent && ids.has(r.parent));
const by = {};
for (const r of on) { const k = r.psrc || '(空)'; by[k] = (by[k] || 0) + 1; }
console.log('图上有父边的枚：' + on.length);
console.log('按 parentSrc：' + Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v]) => k + '=' + v).join(' ‖ '));
const dashed = on.filter(r => !SOLID.has(r.psrc));
console.log('虚线（不可证）共 ' + dashed.length + ' 条；最近 12 条：');
for (const r of dashed.slice(-12)) console.log('  ' + r.id.padEnd(18) + ' → ' + r.parent.padEnd(16) + ' psrc=' + (r.psrc || '空'));
