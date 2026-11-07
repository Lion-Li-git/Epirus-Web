/* V7 面臂在两版页面上的家族字段对比（lineage.tsv 6 行被深夜班删除后的状态） */
import { readFileSync } from 'node:fs';
function dataOf(f) {
  const t = readFileSync(f, 'utf8');
  const i = t.indexOf('var DATA = ');
  let depth = 0, j = t.indexOf('[', i);
  for (let k = j; k < t.length; k++) {
    if (t[k] === '[') depth++;
    else if (t[k] === ']') { depth--; if (depth === 0) { j = k + 1; break; } }
  }
  return JSON.parse(t.slice(t.indexOf('[', i), j));
}
const a = dataOf('champion-map/index.html');            // 新烘页
const b = dataOf('scratch/zcode-1106/_head-index.html'); // HEAD 页（已删，重取）
const IDS = ['V7C-s13', 'V7M-s13', 'V7L-s13', 'V7C-s41', 'V7M-s41', 'V7L-s41'];
for (const f of [['新页', a], ['HEAD', b]]) {
  console.log('== ' + f[0]);
  for (const id of IDS) {
    const n = f[1].find(x => x.id === id);
    if (!n) console.log('  ' + id + ': 不在图上');
    else console.log('  ' + id + ': fam=' + JSON.stringify(n.fam) + ' ver=' + n.ver);
  }
  const fams = new Set(f[1].map(n => String(n.fam ?? '')));
  console.log('  fam 取值种数: ' + fams.size + ' ‖ 空号: ' + (fams.has('') ? '有' : '无'));
}
