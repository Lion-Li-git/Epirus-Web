#!/usr/bin/env node
/* 四格卷读数挂列（页面剂量版 · 2026-11-07）：把 exam4-page-*.tsv 的 x 系列写进 coords-gen3-1105.tsv
 *
 * 为什么要有这一套：H 侧（ε=0 贪心）已经挂在 X2/X3/X5/X8 上，但**页面默认拿到的那个数**是
 *   按 DIFF_TIERS 的 lv:regular 剂量出手的结果（Hp 侧）—— 两者不是一把尺（§E313/§E597）。
 *   所以页面剂量的读数单独占一族列：P2/P3/P5/P8（excess）+ m2/m3/m5/m8（每格局数），长程加 L 后缀。
 *   ⚠ 列名前缀与 X 系分开是**故意的**：同名列会让「这一格到底是哪把尺」变得不可查（本仓 §E597 的教训）。
 *
 * 用法：node tools/exam4-attach.mjs --table=champion-map/exam4-page-1107.tsv [--suffix=] [--in=champion-map/coords-gen3-1105.tsv] [--allow-missing]
 *       长程：--table=champion-map/exam4-page-long-1107.tsv --suffix=L
 * 守卫：① 批表 seed/rounds/dose 必须单一（混批不许挂）② coords 每行都要在批表里有；③ 幂等（列已存在则原位覆盖，不重复追加）。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['table', 'suffix', 'in', 'allow-missing'], 'exam4-attach');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const TABLE = arg('table', '');
if (!TABLE) { console.error('⛔ 必须 --table=<四格批表>'); process.exit(2); }
const SUF = arg('suffix', '');
if (SUF !== '' && SUF !== 'L' && !/^[A-Z]{1,2}$/.test(SUF)) { console.error('⛔ --suffix 只认 空 / L / B / BL（大写字母 ≤2 个）'); process.exit(2); }
const IN = arg('in', 'champion-map/coords-gen3-1105.tsv');
const ALLOW_MISSING = process.argv.includes('--allow-missing');
/* 11-10：后缀放宽带进 B 轴（冠军桌）族——'B'（multi）/ 'BL'（long），列 = P<n>B/P<n>BL。
 *   A 轴的 P/P-L 列族是全图 v2 读数，B 轴**必须分族**（同名列会让"这一格是哪把尺"不可查，§E597 教训）。 */

const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
const bt = rd(TABLE), bh = Object.fromEntries(bt[0].map((x, i) => [x, i]));
const seeds = new Set(), rounds = new Set(), doses = new Set();
const B = {};
for (const r of bt.slice(1)) {
  if (!r[bh.id]) continue;
  if (B[r[bh.id]]) { console.error('⛔ 批表里 id 重复：' + r[bh.id]); process.exit(2); }
  B[r[bh.id]] = r;
  if (bh.seed !== undefined) seeds.add(r[bh.seed]);
  if (bh.rounds !== undefined) rounds.add(r[bh.rounds]);
  if (bh.dose !== undefined) doses.add(r[bh.dose]);
}
if (seeds.size > 1 || rounds.size > 1) { console.error('⛔ 批表 seed/rounds 不齐：' + [...seeds] + ' / ' + [...rounds] + ' ⇒ 混批不许挂'); process.exit(2); }
if (doses.size > 1) { console.error('⛔ 批表 dose 不齐：' + [...doses] + ' ⇒ 混批不许挂'); process.exit(2); }
if (doses.size === 1 && ![...doses][0].startsWith('page')) { console.error('⛔ 这张表的 dose=' + [...doses][0] + ' 不是页面剂量 ⇒ 该走 X 系挂列（scratch/zcode-1106/exam4-attach.mjs）'); process.exit(2); }
console.log('批表：' + (bt.length - 1) + ' 枚 ‖ seed=' + [...seeds][0] + ' rounds=' + [...rounds][0] + ' dose=' + [...doses][0]);

const KEYOF = { 2: 'x2', 3: 'x3', 5: 'x5', 8: 'x8' }, NOF = { 2: 'n2', 3: 'n3', 5: 'n5', 8: 'n8' };
const NEWC = [];   // 列顺序固定：P2 P3 P5 P8 m2 m3 m5 m8（长程带 L）
for (const n of [2, 3, 5, 8]) NEWC.push('P' + n + SUF);
for (const n of [2, 3, 5, 8]) NEWC.push('m' + n + SUF);

copyFileSync(IN, IN + '.bak-exam4p');
const co = rd(IN), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const exist = NEWC.filter((c) => h[c] !== undefined);
if (exist.length && exist.length !== NEWC.length) { console.error('⛔ 只存在一部分列（' + exist.join(',') + '）⇒ 表被改坏，先查再写'); process.exit(2); }
const APPEND = exist.length === 0;
const miss = [];
for (let r = 1; r < co.length; r++) {
  const id = co[r][h.id];
  const b = B[id];
  if (!b) { miss.push(id); if (APPEND) for (let k = 0; k < NEWC.length; k++) co[r].push(''); continue; }
  const vals = [];
  for (const n of [2, 3, 5, 8]) vals.push(b[bh[KEYOF[n]]] ?? '');
  for (const n of [2, 3, 5, 8]) vals.push(b[bh[NOF[n]]] ?? '');
  if (APPEND) co[r] = co[r].concat(vals);
  else for (let k = 0; k < NEWC.length; k++) co[r][h[NEWC[k]]] = vals[k];
}
if (miss.length && !ALLOW_MISSING) {
  console.error('⛔ ' + IN + ' 有 ' + miss.length + ' 行在批表里没有：' + miss.slice(0, 8).join(' ') + (miss.length > 8 ? ' …' : '') + ' ⇒ 先补测或 --allow-missing');
  process.exit(2);
}
if (APPEND) co[0] = co[0].concat(NEWC);
writeFileSync(IN, co.map((r) => r.join('\t')).join('\n') + '\n');
console.log((miss.length ? '⚠ ' + miss.length + ' 行缺测（占位空串） ‖ ' : '') + (APPEND ? '已追加 ' : '已原位覆盖 ') + NEWC.join('/') + ' ⇒ ' + IN);
console.log('下一步：node champion-map/attach-projcols.mjs（重建 coords-projcols.tsv）⇒ 按 bake-flags 重烘 index.html');