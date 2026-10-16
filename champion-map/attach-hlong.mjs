#!/usr/bin/env node
/* §E615 把**长程桌**的读数挂进 `coords.tsv` ⇒ 图上有第二张桌可选，而**头号尺 `Hp` 一字不动**。
 *
 * 为什么要这一列（10-16 午，用户看图问"Hp 为什么这么低"）：
 *   图上 `H`/`Hp`/`F` 全部量在 `eval-5p` 的**默认 `multi`（3 血短程）**，而 10-15 起训练默认是 5 人长程
 *   （包的 `meta.recipe.env.EPIRUS_TRAIN_MODE` 就写着 `long`）。同 seed 同档只换桌形重测 26 枚池成员：
 *   `Spearman(multi, long) = 0.654` ⇒ 两张桌**不是同一把尺**，`G12H1 46.3→69.8`（26 枚里 19/26→1/26）。
 *   但**不能把 `Hp` 换成 `long`**：它的所指是"玩家在默认桌上拿到的那个数"，796 行在册引用与历史文档都指着它
 *   （METHODOLOGY 那条"换尺要另起一列、不许偷走历史读数的名字"，`attach-hp.mjs` 头注第 ① 条同一件事）。
 *   ⇒ 所以：**加三列**（`Hlong` 考卷 ‖ `Hplong` 页面 ‖ `Flong = Hplong + T·S`），颜色与一维轴各多一个可选项。
 *
 * 判据（跑前写死）：
 *   ① **不许把"没量到"写成 0**（R8）：源表里没有这枚 ⇒ 写 `-`，查看器读 `-` 走"未测 = 灰"，不进色标区间。
 *   ② **配对成立的前提要自证**：源表每行必须 `examG=120` 且 `pageDose=tier:lv:regular` 且 `mode=long`
 *      —— 与在册 `Hp` 只差 `mode` 这一维；有一行不满足就 exit 2（否则这张表是混装的）。
 *   ③ `Flong` 用的 `T` 与页面当前滑轨默认值**必须是同一个**（`viewer.mjs` 的 `T` 默认），否则两根轴不同尺。
 *   ④ 覆盖报数：量到 N ‖ 没量到 M（点名前 8 枚）—— 覆盖率本身就是要给她看的数。
 *
 * 用法：node champion-map/attach-hlong.mjs [--check] [--table=epsfull-long-2026-10-16.tsv] [--t=0.10]
 *   幂等：列已存在则**原地回写**（不重复加列）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const rd = f => readFileSync(join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const CHECK = process.argv.includes('--check');
const TAB = String(arg('table', 'epsfull-long-2026-10-16.tsv'));
const T = Number(arg('t', 0.10));   /* 与 `viewer.mjs` 的 T 滑轨默认值同一个（判据 ③） */
if (!isFinite(T) || T < 0) { console.error('⛔ --t 得是非负数'); process.exit(2); }

if (!existsSync(join(HERE, TAB))) { console.error('⛔ 长程桌源表不在：champion-map/' + TAB + '（先跑 eps-full --mode=long）'); process.exit(2); }
const LT = rd(TAB), lh = Object.fromEntries(LT[0].map((x, i) => [x, i]));
for (const k of ['id', 'exam', 'page']) if (lh[k] === undefined) { console.error('⛔ 源表缺列 `' + k + '`（表头：' + LT[0].join(',') + '）'); process.exit(2); }
if (lh.mode === undefined || lh.examG === undefined || lh.pageDose === undefined) {
  console.error('⛔ 源表没有 `mode`/`examG`/`pageDose` 三列 ⇒ 这张表没登记自己是哪把尺量的，不许往图上挂'); process.exit(2);
}
const HL = {}, HP2 = {}, bad = [];
for (const r of LT.slice(1)) {
  if (!r[lh.id]) continue;
  if (r[lh.mode] !== 'long' || r[lh.examG] !== '120' || r[lh.pageDose] !== 'tier:lv:regular') {
    bad.push(r[lh.id] + '(' + r[lh.mode] + '/' + r[lh.examG] + '/' + r[lh.pageDose] + ')'); continue;
  }
  HL[r[lh.id]] = Number(r[lh.exam]); HP2[r[lh.id]] = Number(r[lh.page]);
}
if (bad.length) { console.error('⛔ 源表里有 ' + bad.length + ' 行的档/桌形/剂量不是 `long/120/tier:lv:regular` ⇒ 整表拒绝：' + bad.slice(0, 6).join(' ‖ ')); process.exit(2); }

const CO = rd('coords.tsv'), ch = Object.fromEntries(CO[0].map((x, i) => [x, i]));
const COLS = ['Hlong', 'Hplong', 'Flong'];
let idx = COLS.map(c => ch[c]);
if (idx.some(x => x === undefined)) {
  if (CHECK) { console.error('⛔ coords.tsv 还没有这三列 ⇒ 先不带 --check 跑一次'); process.exit(2); }
  const at = CO[0].length;
  CO[0] = CO[0].concat(COLS);
  for (let i = 1; i < CO.length; i++) while (CO[i].length < at) CO[i].push('');
  idx = COLS.map((c, k) => at + k);
}
let nHit = 0, miss = [];
for (let i = 1; i < CO.length; i++) {
  const r = CO[i], id = r[ch.id]; if (!id) continue;
  if (HP2[id] === undefined) { for (const j of idx) r[j] = '-'; miss.push(id); continue; }
  r[idx[0]] = HL[id].toFixed(2); r[idx[1]] = HP2[id].toFixed(2);
  /* ⚠ 标度必须跟页面那根 `F = Hp/100 + T·S`（工具栏 F窗口 的提示语就是这个式子）逐字一致。
   *   第一版写成 `Hp + T·S` ⇒ 两根轴差 100 倍，"ΔF 均值 40"就是这么来的（同一个 bug 的免费探测器：
   *   差值大得离谱就该先怀疑自己抄错了式子，而不是先解释成"两桌差很多"）。 */
  r[idx[2]] = (HP2[id] / 100 + T * (+r[ch.S] || 0)).toFixed(4);
  nHit++;
}
const out = CO.map(r => r.join('\t')).join('\n') + '\n';
if (CHECK) {
  console.log('✔ 只核不写：量到 ' + nHit + ' 枚 ‖ 没量到 ' + miss.length + ' 枚（写 `-`，不是 0）');
  process.exitCode = nHit >= 700 ? 0 : 1;
} else {
  writeFileSync(join(HERE, 'coords.tsv'), out, 'utf8');
  console.log('已写 coords.tsv：三列 ' + COLS.join('/') + '（T=' + T + '）‖ 量到 ' + nHit + ' ‖ 没量到 ' + miss.length +
    (miss.length ? '（前 8：' + miss.slice(0, 8).join(' ') + '）' : ''));
  console.log('⚠ 坐标一列未动 —— 点坐标是**行为轴**（探针列），换桌形不改它们；变的只有颜色与一维排序。');
}
