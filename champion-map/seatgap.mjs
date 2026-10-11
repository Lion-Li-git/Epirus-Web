/* §E576 判读补充：逐格对现役的**否决差**（注册线 = 任一格比现役差 ≥20pt，§E531）
 *
 * 为什么要单独一份：`最大格` 与 `gap_max` 是三件不同的事（旧表注释里就钉过）——
 *   某枚包自己的最大格可能落在 A 格，而它被否决是因为 B 格比现役差太多；只看 `最大格` 会漏判。
 *   例：contX-201 自己的最大格在"全程刷反弹"（99~100%），而它**六格里有五格**都比现役差 20pt 以上。
 * 两批（seed 90210 / 90211）各算一遍：**两批同号且都过线**才算踩到线，单批过线可能只是噪声 × 巧合
 *   （实测噪声地板：六格均值同枚两批之差 p50 0.67~0.83pt ‖ p90 2.0~2.3pt，见 §E576 判读 (b)）。
 * 读法：印的是**人类那一席的夺冠率**，越高越糟；Δ = 该枚 − 现役同格。
 *
 * ⚠ §E590：判据本身搬到 `champion-map/seat-rule.mjs`（`tools/pool-add.mjs` 走同一把刀），
 *   本文件只剩 CLI 与排版。抽取前后本文件的输出**逐字相同**（56 行对 56 行，`/tmp/seatgap-before.txt`）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CELLS, LINE, MODES, BASE_ID, resolve, rdTable, rowOf, cell, killOf } from './seat-rule.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/* 默认还是 §E576 那两张批表；`--files=a.tsv,b.tsv` 让别一批（如 §E584 的新框、§POOL-SCREEN 的困难档）也走**同一把杀刀**，
 *   免得为一批数据再抄第二份判据实现（本仓"两份代码分叉"栽过很多次）。 */
const FILES_ARG = (process.argv.find(a => a.indexOf('--files=') === 0) || '').slice(8).split(',').filter(Boolean);
const FILES = FILES_ARG.length === 2 ? FILES_ARG : ['seat-2026-10-11-90210.tsv', 'seat-2026-10-11-90211.tsv'];
if (FILES_ARG.length && FILES_ARG.length !== 2) { console.error('⛔ --files= 要正好两张批表（' + FILES_ARG.length + ' 张）'); process.exit(2); }
const batches = FILES.map(p => rdTable(p, readFileSync(resolve(p, HERE), 'utf8')));

const ids = [...new Set(batches[0].rows.map(r => r[batches[0].h.id]))].filter(x => x !== BASE_ID);
const named = ['K2', 'v7beadseed-93', 'D4a', 'G-s72', 'contX-201'];
const list = process.argv.includes('--all') ? ids : ids.filter(x => named.indexOf(x) >= 0);

for (const mode of MODES) {
  const baseRows = batches.map(t => rowOf(t, BASE_ID, mode));
  console.log('\n== 口径 ' + mode + ' ‖ 现役基准：' + CELLS.map((c, i) => c + ' ' + cell(baseRows[0], i) + '/' + cell(baseRows[1], i) + '%').join(' ‖ '));
  console.log('   枚 | ' + CELLS.join(' | ') + ' | 过线格数(两批同号) | 判');
  for (const id of list) {
    const k = killOf(id, mode, batches);
    if (!k) { console.log('   ' + id + ' | 缺批读数，不判'); continue; }
    console.log('   ' + id.padEnd(18) + ' | ' + k.per.map(p => (p.a.toFixed(0) + '/' + p.b.toFixed(0) + (p.ga >= LINE || p.gb >= LINE ? 'Δ' + Math.max(p.ga, p.gb).toFixed(0) : ''))).join(' | ') +
      ' | ' + k.over.length + '/6 | ' + (k.over.length ? '⛔ 否决（' + k.over.map(x => x.c).join(' ‖ ') + '）' : '✅ 无线上格'));
  }
}
console.log('\n# 格内数字 = 两批（' + FILES.join(' ‖ ') + '）各自的人类席夺冠率%；带 Δ 的是该格至少一批比现役差 ≥' + LINE + 'pt，只有**两批同号**才计入否决。');
