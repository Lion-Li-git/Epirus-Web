#!/usr/bin/env node
/* §E566 把 **exam=120 档**的考卷读数作为**新列 `H120`** 挂进 coords.tsv（不动 `H` 的语义）。
 *
 * 为什么是"加列"而不是"换档"（照 `attach-hp.mjs` §E314 那个先例，理由是抄来的、不是我新造的）：
 *   `H` = 考卷口径（ε=0 贪心 · **exam=30 档**）这个名字已经被门禁/体检/历史文档大量引用，
 *   覆盖掉就把历史读数的名字偷走了（§E278 同族）。所以：**并列一列，让查看器两个数都能显示**。
 *
 * 三条款件都来自本仓反复栽过的地方：
 *   ① **档必须自证**：源表必须有 `examG` 列且逐行 = 120（这列是 10-10 由 `642fba6` 加上的）；缺列或值不对 ⇒ exit 2。
 *   ② **空值不许被读成 0**（§E491：`Hp` 空洞 ⇒ `+'' = 0` 把"未测"画成库内倒数第一）⇒ 没测到的行**留空**，
 *      由查看器显式印"未测"；本脚本自己也不写 0。
 *   ③ **幂等 + 宽度守卫**（§E375/§E314：重跑一次就在表尾多一对同名列；`.trim()` 整文件会吃掉末行空单元格 ⇒ 新列错一位）
 *      ⇒ 表头已有 `H120` 就原位覆盖；写之前数一遍每行宽度 ≠ 表头的行数，有一条就不写文件。
 *
 * 用法：node champion-map/attach-h120.mjs [--src=champion-map/ruler120-2026-10-10-all.tsv] [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
/* 只剥行尾换行，绝不剥空白（见头注 ③） */
const rd = (f) => readFileSync(f.startsWith('/') || /^[A-Za-z]:/.test(f) ? f : join(HERE, f), 'utf8')
  .replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));

const SRCP = arg('src', 'ruler120-2026-10-10-all.tsv');
const S = rd(SRCP), sh = Object.fromEntries(S[0].map((h, i) => [h, i]));
if (sh.id === undefined || sh.H === undefined) { console.error('⛔ 源表缺 id/H 列（表头：' + S[0].join('\t') + '）'); process.exit(2); }
/* ① 档守卫 */
if (sh.examG === undefined) { console.error('⛔ 源表没有 examG 列 ⇒ 无法自证它是哪个档，拒绝挂（' + SRCP + '）'); process.exit(2); }
const badG = S.slice(1).filter(r => r[sh.id] && r[sh.examG] !== '120');
if (badG.length) { console.error('⛔ 源表有 ' + badG.length + ' 行 examG ≠ 120（前 5：' + badG.slice(0, 5).map(r => r[sh.id] + '=' + r[sh.examG]).join(' ') + '）⇒ 混档不许挂进图'); process.exit(2); }

const H120 = {};
for (const r of S.slice(1)) { if (!r[sh.id]) continue; const v = Number(r[sh.H]); if (isFinite(v)) H120[r[sh.id]] = v; }

const CO = rd('coords.tsv'), ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
if (ch.id === undefined || ch.H === undefined) { console.error('⛔ coords.tsv 缺 id/H 列'); process.exit(2); }
let filled = 0, blank = [], both = [];
for (const r of CO.slice(1)) {
  const id = r[ch.id]; if (!id) continue;
  if (id in H120) { filled++; if (isFinite(Number(r[ch.H]))) both.push(H120[id] - Number(r[ch.H])); } else blank.push(id);
}
const srcOnly = Object.keys(H120).filter(id => !CO.slice(1).some(r => r[ch.id] === id));
console.log('源表 ' + Object.keys(H120).length + ' 枚 ‖ 挂上 ' + filled + '/' + (CO.length - 1) + ' ‖ 图上没有源表里的 ' + srcOnly.length + ' 枚');
console.log('档差（H120 − H）中位 ' + (both.slice().sort((a, b) => a - b)[both.length >> 1] || 0).toFixed(2)
  + ' ‖ 均值 ' + (both.reduce((s, v) => s + v, 0) / both.length).toFixed(2) + 'pt ‖ 样本 ' + both.length + ' 枚');
/* ② 覆盖下限：不到 900 就拒绝写 —— 半张表带新列会让"两个口径混着看"变成默认状态 */
if (filled < 900) { console.error('⛔ 覆盖 ' + filled + ' < 900 ⇒ 不写（缺 ' + blank.length + ' 枚；宁可回头补测，也不给图挂一条半覆盖的列）'); process.exit(2); }

/* ③ 幂等：有就原位覆盖，没有才追加 */
const H0 = CO[0], iNew = H0.indexOf('H120');
const app = iNew < 0;
const H = app ? H0.concat(['H120']) : H0.slice();
const out = [H.join('\t')];
for (const r of CO.slice(1)) {
  const id = r[ch.id];
  const v = id && id in H120 ? H120[id].toFixed(2) : '';
  if (app) out.push(r.concat([v]).join('\t'));
  else { const row = r.slice(); while (row.length < H.length) row.push(''); row[iNew] = v; out.push(row.join('\t')); }
}
const badW = out.slice(1).filter(l => l.split('\t').length !== H.length).length;
if (badW) { console.error('⛔ ' + badW + ' 行宽度 ≠ 表头 ' + H.length + ' 列 ⇒ 不写文件（列错位是静默病）'); process.exit(2); }
if (process.argv.includes('--check')) { console.log('--check：未写文件（列数 ' + H.length + ' ‖ 追加=' + app + '）'); process.exit(0); }
writeFileSync(join(HERE, 'coords.tsv'), out.join('\n') + '\n');
console.log('已写 coords.tsv ⇒ ' + (app ? '新增' : '原位覆盖') + '一列 H120（exam=120 档考卷读数；原列一字未动，' + H.length + ' 列）‖ 未测的 ' + blank.length + ' 行留空（查看器要印"未测"，不许当 0）');
