
import { readFileSync, existsSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const pathById = {}; for (const r of co.slice(1)) pathById[r[h.id]] = r[h.path];
const t = rd('champion-map/lineage-g3.tsv'); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
const bad = [];
for (const r of t.slice(1)) {
  const id = r[lh.id], p = pathById[id];
  if (!p || !existsSync(p)) continue;
  const s = readFileSync(p, 'utf8');
  const v = (s.match(/"v":(\d+)/) || [])[1];
  const arch = (s.match(/"arch":"([^"]*)"/) || [])[1] || '';
  if (v === '7') bad.push({ id, fam: r[lh.fam], label: r[lh.famLabel], v, arch, parent: r[lh.parent] });
}
console.log('lineage-g3（2.0 谱系侧车）里**实际是 v:7 架构**的包：' + bad.length + ' 枚');
const fams = {};
for (const b of bad) fams[b.fam] = (fams[b.fam] || 0) + 1;
console.log('按 fam：' + JSON.stringify(fams));
for (const b of bad.slice(0, 12)) console.log('  ' + b.id.padEnd(12) + ' fam=' + b.fam + ' v=' + b.v + ' parent=' + (b.parent || '-'));
