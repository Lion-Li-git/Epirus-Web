
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const P = 'champion-map/lineage-g3.tsv';
copyFileSync(P, P + '.bak-fam17');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));

const L16 = 'KD 蒸馏链（种子与克隆 · v7 教师全模型）';
const L17 = '2.0 GA 强化线（11-08~09 · 集火/清场/宽包/SEL_CARDS）';
const L18 = '2.0 行为课程线（11-09 · 破防与还手）';

const GA_TO_17 = ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7','PASS2-Q-s13','STR-B-Q-s13','STR-B-Q-s41','KDG-B-Q-s13','FOCUS-Q-s13','CLEAR-Q-s13','WIDE-Q-s13','WIDE2-Q-s13','WIDE2-200','WIDE2-300','WSEL9-200'];
let moved = 0, relabeled = 0;
for (let i = 1; i < ll.length; i++) {
  if (!ll[i]) continue;
  const c = ll[i].split('\t');
  if (c[h.fam] === '16' && GA_TO_17.includes(c[h.id])) { c[h.fam] = '17'; c[h.famLabel] = L17; ll[i] = c.join('\t'); moved++; }
  else if (c[h.fam] === '16') { c[h.famLabel] = L16; ll[i] = c.join('\t'); relabeled++; }
}
console.log('fam16→17 ' + moved + ' 枚 ‖ fam16 重标注 ' + relabeled + ' 枚');

const add = [
  ['G5C-100', 'scratch/ds-1109/G5C-100.js', 'WSEL9-200'],
  ['G5I-50', 'scratch/ds-1109/G5I-50.js', 'G5C-100'],
  ['G5G-50', 'scratch/ds-1109/G5G-50.js', 'G5C-100'],
  ['G5J-50', 'scratch/ds-1109/G5J-50.js', 'G5C-100'],
];
for (const [id, path, parent] of add) {
  if (ll.some(l => l.split('\t')[0] === id)) { console.log(id + ' 已有'); continue; }
  const s = readFileSync(path, 'utf8');
  const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '';
  const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
  const r = H.map(() => '');
  const set = (k, v) => { r[h[k]] = String(v); };
  set('id', id); set('fam', '18'); set('famLabel', L18); set('ts', ts); set('seed', seed);
  set('parent', parent); set('parentOf', parent); set('parentName', parent);
  set('wid', widOf(s)); set('parentSrc', 'seedpack-wid'); set('kind', 'product');
  ll.push(r.join('\t'));
  console.log('加 ' + id + ' → ' + parent + '（fam 18）');
}
writeFileSync(P, ll.join(EOL) + EOL);
