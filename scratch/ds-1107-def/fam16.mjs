
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/lineage-g3.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
console.log('fam 16 的行（全列）：');
for (const r of t.slice(1)) if (r[h.fam] === '16') console.log('  ' + JSON.stringify(Object.fromEntries(Object.keys(h).map(k => [k, r[h[k]]]))));
/* 新包的 META */
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) {
  const s = readFileSync('docs/artifacts/night-adapt/' + id + '.js', 'utf8');
  const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '(无 ts)';
  const seed = (s.match(/"seed":(\d+)/) || [])[1] || '(无 seed)';
  console.log(id + ' ts=' + ts + ' seed=' + seed);
}
