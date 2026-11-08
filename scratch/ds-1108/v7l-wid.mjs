
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const byId = {}; for (const r of co.slice(1)) byId[r[h.id]] = r;
const lin = {};
for (const f of ['champion-map/lineage.tsv','champion-map/lineage-g3.tsv']) {
  const t = rd(f); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) lin[r[lh.id]] = r;
}
const ids = Object.keys(byId).filter(id => /^v7l2/.test(id));
const wid = (id) => { const p = byId[id] && byId[id][h.path]; if (!p || !existsSync('docs/artifacts/' + p)) return ''; return widOf(readFileSync('docs/artifacts/' + p, 'utf8')); };
const sample = ids.slice(0, 4);
console.log('父 d13d3c85 在图上?', !!byId['d13d3c85'], byId['d13d3c85'] ? byId['d13d3c85'][h.path] : '');
for (const id of sample.concat(['v7m1-82','v7m2-82','v7m3-82'])) {
  if (!byId[id]) continue;
  console.log(id.padEnd(12) + ' wid=' + wid(id) + '  parent=' + (lin[id] ? lin[id][2] : '-') + ' psrc=' + (lin[id] ? lin[id][10] : '-'));
}
console.log('\n同父的节点数:', ids.length);
const uniqWid = new Set(ids.map(id => wid(id)).filter(Boolean));
console.log('这 ' + ids.length + ' 枚里不同权重数:', uniqWid.size);
