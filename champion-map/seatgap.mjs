/* §E576 判读补充：逐格对现役的**否决差**（注册线 = 任一格比现役差 ≥20pt，§E531）
 *
 * 为什么要单独一份：`最大格` 与 `gap_max` 是三件不同的事（旧表注释里就钉过）——
 *   某枚包自己的最大格可能落在 A 格，而它被否决是因为 B 格比现役差太多；只看 `最大格` 会漏判。
 *   例：contX-201 自己的最大格在"全程刷反弹"（99~100%），而它**六格里有五格**都比现役差 20pt 以上。
 * 两批（seed 90210 / 90211）各算一遍：**两批同号且都过线**才算踩到线，单批过线可能只是噪声 × 巧合
 *   （实测噪声地板：六格均值同枚两批之差 p50 0.67~0.83pt ‖ p90 2.0~2.3pt，见 §E576 判读 (b)）。
 * 读法：印的是**人类那一席的夺冠率**，越高越糟；Δ = 该枚 − 现役同格。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
/* 路径口径与 `seat-parse.mjs` 对齐（2026-10-11 DS 修）：带盘符（`D:/…`）或前导 `/` 视为**绝对路径**，
 * 不再无条件 `join(HERE, p)`。起因（实测撞了两次）：按 `--files=champion-map/seat-prof-90210.tsv`
 * 或 `D:/code/…` 传都会被拼成 `champion-map/D:/code/…` ⇒ ENOENT，而报错里的双路径很难一眼看出是 join 造成的。
 * 裸文件名（历史的默认口径）一字不变 ⇒ 向后兼容。 */
const rd = p => {
  const abs = (p.indexOf(':') >= 0 || p[0] === '/') ? p : join(HERE, p);
  const L = readFileSync(abs, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map(l => l.split('\t')) };
};
/* 默认还是 §E576 那两张批表；`--files=a.tsv,b.tsv` 让别一批（如 §E584 的新框）也走**同一把杀刀**，
 *   免得为一批数据再抄第二份判据实现（本仓"两份代码分叉"栽过很多次）。 */
const FILES_ARG = (process.argv.find(a => a.indexOf('--files=') === 0) || '').slice(8).split(',').filter(Boolean);
const FILES = FILES_ARG.length === 2 ? FILES_ARG : ['seat-2026-10-11-90210.tsv', 'seat-2026-10-11-90211.tsv'];
if (FILES_ARG.length && FILES_ARG.length !== 2) { console.error('⛔ --files= 要正好两张批表（' + FILES_ARG.length + ' 张）'); process.exit(2); }
const BASE = 'bundled-champion-3p';                       // 现役（coords 里叫 SHIPPED-Ldemo，探针打的是路径）
const CELLS = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
const LINE = 20;                                          // §E531 的注册否决线（pt）
const batches = FILES.map(rd);
const rowOf = (t, id, mode) => t.rows.filter(r => r[t.h.id] === id && r[t.h.mode] === mode)[0];
const cell = (r, i) => Number(r[i + 5]);                 // 表头前 5 列是 id/path/mode/games/seed0 ⇒ 第一格在下标 5
/* ⚠ 这里先前写成 `+6`，于是每一格都读到了右边那一格、最后一格读到的是"六格均值"——
 *   症状是基准行自己就乱（现役"全程刷反弹"印成 5/7%，而表里那格明明是 2/1）。**列偏移要靠基准行自检**，
 *   基准值在 §E506/§E560 里有在册读数，一比就穿。 */

const ids = [...new Set(batches[0].rows.map(r => r[batches[0].h.id]))].filter(x => x !== BASE);
const named = ['K2', 'v7beadseed-93', 'D4a', 'G-s72', 'contX-201'];
const list = process.argv.includes('--all') ? ids : ids.filter(x => named.indexOf(x) >= 0);

for (const mode of ['multi', 'long']) {
  const baseRows = batches.map(t => rowOf(t, BASE, mode));
  console.log('\n== 口径 ' + mode + ' ‖ 现役基准：' + CELLS.map((c, i) => c + ' ' + cell(baseRows[0], i) + '/' + cell(baseRows[1], i) + '%').join(' ‖ '));
  console.log('   枚 | ' + CELLS.join(' | ') + ' | 过线格数(两批同号) | 判');
  for (const id of list) {
    const rows = batches.map(t => rowOf(t, id, mode));
    if (!rows[0] || !rows[1]) { console.log('   ' + id + ' | 缺批读数，不判'); continue; }
    const per = CELLS.map((c, i) => ({ c: c, a: cell(rows[0], i), b: cell(rows[1], i), ga: cell(rows[0], i) - cell(baseRows[0], i), gb: cell(rows[1], i) - cell(baseRows[1], i) }));
    const 过线 = per.filter(p => p.ga >= LINE && p.gb >= LINE);
    console.log('   ' + id.padEnd(18) + ' | ' + per.map(p => (p.a.toFixed(0) + '/' + p.b.toFixed(0) + (p.ga >= LINE || p.gb >= LINE ? 'Δ' + Math.max(p.ga, p.gb).toFixed(0) : ''))).join(' | ') +
      ' | ' + 过线.length + '/6 | ' + (过线.length ? '⛔ 否决（' + 过线.map(x => x.c).join(' ‖ ') + '）' : '✅ 无线上格'));
  }
}
console.log('\n# 格内数字 = 两批（' + FILES.join(' ‖ ') + '）各自的人类席夺冠率%；带 Δ 的是该格至少一批比现役差 ≥' + LINE + 'pt，只有**两批同号**才计入否决。');
