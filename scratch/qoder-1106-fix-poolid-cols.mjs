/* 11-06 晨：把 10 枚"池内图外"新行的身份列改成池行在册口径（与 GLM 先入池那 10 枚逐字一致）。
 * 症状：qoder-1106-attach-pool10.mjs 从 coords-view-20 抄了 lineage="续训现役"、dupN=1、dupOf=自己，
 *   而主表里在册的 10 枚池行（L5-1200-s13 等）这三列全是空 ⇒ 同一种身份在主表里有两种写法。
 * 后果（实测，页内自检）：`lineage && !上线时刻` 那格从 21 枚涨到 31 枚、谱系图"有位置"分母从 870 涨到 880
 *   —— 新行冒充了"上过线的续训现役"，而它们从没进过槽。
 * 改法：这三列清空（身份交给 lineage-g3.tsv sidecar：本轮已重建到 59 行，这 10 枚拿到 ts/parent/wid/fam）。
 * 旧值备份 *.bak-poolid。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const IDS = ['DSTR4-s13', 'EFFG-s5', 'EFFG-s7', 'GD3ALL-POPP-s41', 'GD3ALL-PUSHON-s13',
  'D-b-hpseed-s13', 'DDEF-s13', 'DSTR-s13', 'LE-s13', 'GD3ALL-G5-s13'];
for (const F of ['champion-map/coords-gen3-1105.tsv', 'champion-map/coords-view-20.tsv']) {
  copyFileSync(F, F + '.bak-poolid');
  const co = rd(F), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
  let n = 0;
  for (let r = 1; r < co.length; r++) {
    if (IDS.indexOf(co[r][h.id]) < 0) continue;
    for (const c of ['lineage', 'dupN', 'dupOf']) if (h[c] !== undefined) co[r][h[c]] = '';
    n++;
  }
  writeFileSync(F, co.map(r => r.join('\t')).join('\n') + '\n');
  console.log(F + ' ⇒ 改 ' + n + ' 行（预期 10）');
}
