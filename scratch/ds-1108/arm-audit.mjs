
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/^\)\s*$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const pathById = {}; for (const r of co.slice(1)) pathById[r[h.id]] = r[h.path];
const lin = {};
for (const f of ['champion-map/lineage.tsv','champion-map/lineage-g3.tsv']) {
  const t = rd(f); const lh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) lin[r[lh.id]] = { parent: r[lh.parent], psrc: r[lh.parentSrc] || '' };
}
const ARMED = Object.entries(lin).filter(([id, v]) => v.parent && v.psrc === 'arm' && pathById[id] && pathById[v.parent]);
for (const [id, v] of ARMED) {
  const p = pathById[id];
  if (!existsSync(p)) { console.log(id + ' 包不在盘上'); continue; }
  const s = readFileSync(p, 'utf8');
  const hs = (s.match(/"hotstartFrom":"([^"]*)"/) || [])[1] || '';
  const parentPath = pathById[v.parent];
  let pw = '';
  if (parentPath && existsSync(parentPath)) pw = widOf(readFileSync(parentPath, 'utf8'));
  console.log(id.padEnd(14) + ' → ' + v.parent.padEnd(14) + ' 子hotstart=' + (hs || '(无)') + ' 父wid=' + (pw || '(读不到)') + (hs && pw && hs === pw ? '  ✅可升 seedpack-wid' : '  ✗'));
}