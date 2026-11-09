#!/usr/bin/env node
/* 综合分 C=(A+B)/2 页面级合成列（D-33 主尺 · 2026-11-10）：C<n> = (P<n> + P<n>B)/2，长程带 L。
 * A 轴 = P 族（脚本桌 v2 全图读数，exam4-page-1109），B 轴 = P·B 族（冠军桌混合夹具，exam4-B-page-1110）。
 * 页面级均值再进 viewer 的 X̄₄ 加权（15/25/45/15）⇒ X̄₄(C) = (X̄₄(A)+X̄₄(B))/2，与 G5 样例的 --exam=both 综合同构。
 * 守卫：① P 与 PB 两族必须同时有值才算测过（一侧缺 ⇒ C 留空 = 未测，不许拿单侧冒充综合）；
 *       ② 幂等（列已存在则原位覆盖）③ 列序固定 C2 C3 C5 C8 C2L C3L C5L C8L。
 * 用法：node champion-map/attach-cmean.mjs [--in=champion-map/coords-gen3-1105.tsv]
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const IN = arg('in', 'champion-map/coords-gen3-1105.tsv');
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));

const NEWC = ['C2', 'C3', 'C5', 'C8', 'C2L', 'C3L', 'C5L', 'C8L'];
copyFileSync(IN, IN + '.bak-cmean');
const co = rd(IN), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
for (const c of [...NEWC, ...NEWC.map((x) => x === 'C' + x.slice(1) ? x : x)]) { /* 占位 */ }
const need = ['P2', 'P3', 'P5', 'P8', 'P2L', 'P3L', 'P5L', 'P8L', 'P2B', 'P3B', 'P5B', 'P8B', 'P2BL', 'P3BL', 'P5BL', 'P8BL'];
const missCol = need.filter((c) => h[c] === undefined);
if (missCol.length) { console.error('⛔ coords 缺输入列：' + missCol.join(',') + '（先跑 exam4-attach 两批）'); process.exit(2); }
const exist = NEWC.filter((c) => h[c] !== undefined);
if (exist.length && exist.length !== NEWC.length) { console.error('⛔ 只存在一部分 C 列（' + exist.join(',') + '）⇒ 表被改坏，先查再写'); process.exit(2); }
const APPEND = exist.length === 0;
let filled = 0, oneSided = 0;
for (let r = 1; r < co.length; r++) {
  const vals = [];
  for (const c of NEWC) {
    const L = c.endsWith('L') ? 'L' : '';
    const n = c.slice(1, c.length - L.length || undefined);
    const a = co[r][h['P' + n + L]], b = co[r][h['P' + n + 'B' + (L ? 'L' : '')]];
    if ((a === '' || a === undefined) || (b === '' || b === undefined)) { vals.push(''); if (a !== '' && b !== '') oneSided++; continue; }
    vals.push(((+a + +b) / 2).toFixed(4)); filled++;
  }
  if (APPEND) co[r] = co[r].concat(vals);
  else for (let k = 0; k < NEWC.length; k++) co[r][h[NEWC[k]]] = vals[k];
}
if (APPEND) co[0] = co[0].concat(NEWC);
writeFileSync(IN, co.map((r) => r.join('\t')).join('\n') + '\n');
console.log((APPEND ? '已追加 ' : '已原位覆盖 ') + NEWC.join('/') + ' ⇒ ' + IN + ' ‖ 填格 ' + filled + ' ‖ 单侧缺(留空) ' + oneSided);
console.log('下一步：node champion-map/attach-projcols.mjs（重建投影列）⇒ 按 bake-flags 重烘 index.html');
