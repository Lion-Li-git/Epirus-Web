
/* 修 intake 映射 bug：readings.log → coords-gen3-1105.tsv 的 X/P 列
 * 原脚本把 N（2/3/5/8）当成了数组下标 ⇒ P2 写的是 x5、P3 写的是 x8、P5/P8 空。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const MAP = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(MAP, MAP + '.bak-intake-fix');
const co = rd(MAP);
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const LOG = readFileSync('scratch/night-adapt2/intake/readings.log', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const VAL = {};   // id → { P2:..., XLx2:... }
for (const l of LOG) {
  const m = l.match(/^\[id=(\S+) tag=(\S+)\] \[冠军4N\].*?x2=(\S+) x3=(\S+) x5=(\S+) x8=(\S+) n2=(\S+) n3=(\S+) n5=(\S+) n8=(\S+)/);
  if (!m) continue;
  const [, id, tag, x2, x3, x5, x8, n2, n3, n5, n8] = m;
  const fam = tag[0], suf = tag[1] === 'L' ? 'L' : '';
  VAL[id] = VAL[id] || {};
  [[2, x2, n2], [3, x3, n3], [5, x5, n5], [8, x8, n8]].forEach(([n, x, nn]) => {
    VAL[id][fam + n + suf] = x;
    VAL[id][(fam === 'P' ? 'm' : 'n') + n + suf] = nn;
  });
}
let fixed = 0;
for (let r = 1; r < co.length; r++) {
  const id = co[r][h.id];
  if (!VAL[id]) continue;
  for (const [k, v] of Object.entries(VAL[id])) { if (h[k] === undefined) throw new Error('列不存在 ' + k); co[r][h[k]] = v; }
  fixed++;
}
writeFileSync(MAP, co.map(x => x.join('\t')).join('\n') + '\n');
console.log('修好 ' + fixed + ' 行');
for (const id of Object.keys(VAL)) console.log('  ' + id + '  P2=' + VAL[id].P2 + ' P3=' + VAL[id].P3 + ' P5=' + VAL[id].P5 + ' P8=' + VAL[id].P8 + ' ‖ P2L=' + VAL[id].P2L + ' P3L=' + VAL[id].P3L + ' P5L=' + VAL[id].P5L + ' P8L=' + VAL[id].P8L);
