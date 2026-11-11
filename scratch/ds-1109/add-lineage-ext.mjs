
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const P = 'champion-map/lineage-g3.tsv';
copyFileSync(P, P + '.bak-ext');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));
const items = [
  ['WIDE2-200', 'scratch/ds-1109/WIDE2-200.js', 'WIDE2-Q-s13'],
  ['WIDE2-300', 'scratch/ds-1109/WIDE2-300.js', 'WIDE2-200'],
];
for (const [id, path, parent] of items) {
  if (ll.some(l => l.split('\t')[0] === id)) { console.log(id + ' 已有'); continue; }
  const s = readFileSync(path, 'utf8');
  const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '';
  const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
  const r = H.map(() => '');
  const set = (k, v) => { r[h[k]] = String(v); };
  set('id', id); set('fam', '16'); set('famLabel', 'KD 蒸馏链（v7 教师全模型）');
  set('ts', ts); set('seed', seed); set('parent', parent); set('parentOf', parent); set('parentName', parent);
  set('wid', widOf(s)); set('parentSrc', 'seedpack-wid'); set('kind', 'product');
  ll.push(r.join('\t'));
  console.log('加 ' + id + ' → ' + parent);
}
writeFileSync(P, ll.join(EOL) + EOL);
