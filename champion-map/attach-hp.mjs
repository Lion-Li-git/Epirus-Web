#!/usr/bin/env node
/* §E314 把线上口径的读数挂进 coords.tsv ⇒ 查看器那把头号尺从此是"玩家拿到的那个数"
 *
 * 用户裁定（10-05 中午）：「那你先把冠军演化全部改成线上口径吧」。
 *   背景 = §E313：图上的 H 一直是 `eval-5p` 的**考卷口径（ε=0 贪心）**，而真页面每手 20% 概率在短名单里软采样。
 *   两口径的排名同构（Spearman 0.912）但**电平不同构**，且现役恰好落在最脆那一档（Δε 全库第 99.6 百分位）。
 *
 * 为什么不直接覆盖 H 而要另起一列 `Hp`（这是关键决定）：
 *   ① 门禁/体检/历史文档里大量读数写的是"H = 考卷夺1率"，覆盖掉就把**历史读数的名字**偷走了（§E278 那条"注释里不许复制数值"同族）；
 *   ② 换尺之后仍要能回答"这一枚在旧尺下是多少"，否则 §E308/§E313 那两张表没法复核；
 *   ③ `repair-coords.mjs` 是按文件自身表头回写的 ⇒ 新列能穿过它存活（已核）。
 *   ⇒ 所以：**加列 + 让查看器的 Fv 改读 Hp**，而不是改 H 的语义。
 *
 * 判据（跑前写死，来自 eps-full.mjs）：覆盖 ≥700 才许换尺；复现守卫 |本次考卷 − 旧 H| 必须 p50≈0。
 *   实测：718/718 ‖ 718 枚逐字相同（max 差 0.00）⇒ 两条都过。
 *
 * 用法：node champion-map/attach-hp.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));

const CO = rd('coords.tsv'), ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const EP = rd('epsfull.tsv'), eh = Object.fromEntries(EP[0].map((h, i) => [h, i]));
const HP = {}, DE = {}, EX = {};
for (const r of EP.slice(1)) { if (!r[eh.id]) continue; HP[r[eh.id]] = +r[eh.page]; EX[r[eh.id]] = +r[eh.exam]; DE[r[eh.id]] = +r[eh.d]; }
/* §E328：`--more=` 再并几张同格式的表（子代那 183 枚量在 `e328-epsfull.tsv` 里，不并进来的话它们就没有头号尺 `Hp`）。
 *   格式必须一致（列名查表头，不按位置取 —— 按位置取是本仓反复犯过的那件事）。 */
for (const f of String(arg('more', '')).split(',').map(s => s.trim()).filter(Boolean)) {
  const P2 = rd(f), h2 = Object.fromEntries(P2[0].map((x, i) => [x, i]));
  if (h2.id === undefined || h2.page === undefined || h2.exam === undefined || h2.d === undefined) {
    console.error('⛔ --more=' + f + ' 缺 id/page/exam/d 列（表头：' + P2[0].join('\t') + '）⇒ 不并，免得把两批混成一把假尺');
    process.exit(2);
  }
  let n = 0;
  for (const r of P2.slice(1)) { if (!r[h2.id] || HP[r[h2.id]] !== undefined) continue; HP[r[h2.id]] = +r[h2.page]; EX[r[h2.id]] = +r[h2.exam]; DE[r[h2.id]] = +r[h2.d]; n++; }
  console.log('--more 并进 ' + f + '：新增 ' + n + ' 枚（同名以 epsfull.tsv 为准，不覆盖）');
}

/* 守卫：本次考卷读数必须与 coords 里的 H 逐字相同；不同就是"两把尺"，必须当场报出来而不是悄悄换 */
let mismatch = [];
for (const r of CO.slice(1)) { const id = r[ch.id]; if (!id || !(id in HP)) continue;
  if (Math.abs(EX[id] - +r[ch.H]) > 1e-9) mismatch.push(id + ' 本次 ' + EX[id] + ' ‖ coords ' + r[ch.H]); }
console.log('复现守卫：' + (mismatch.length ? '⚠ ' + mismatch.length + ' 枚不一致 ⇒ 前 8 条：\n  ' + mismatch.slice(0, 8).join('\n  ')
  : '✅ 全部逐字相同 ⇒ 换尺不是换仪器'));

/* 覆盖判据 */
let filled = 0, blank = [];
for (const r of CO.slice(1)) { const id = r[ch.id]; if (!id) continue; if (id in HP) filled++; else blank.push(id); }
console.log('覆盖 ' + filled + '/' + (CO.length - 1) + (blank.length ? ' ‖ 缺 ' + blank.slice(0, 8).join(' ') + '…' : ''));
if (filled < 700) { console.error('⛔ 覆盖不足 700 ⇒ 按跑前判据不许换尺（缺太多会让图上混两种口径）'); process.exit(2); }

const H = CO[0].concat(['Hp', 'De']);
const out = [H.join('\t')];
for (const r of CO.slice(1)) { const id = r[ch.id];
  out.push(r.concat(id in HP ? [HP[id].toFixed(2), DE[id].toFixed(2)] : ['', '']).join('\t')); }
if (process.argv.includes('--check')) { console.log('--check：未写文件'); process.exit(0); }
writeFileSync(join(HERE, 'coords.tsv'), out.join('\n') + '\n');
console.log('已写 coords.tsv（新增两列：Hp = 线上口径夺1率 ‖ De = Δε = 考卷 − 页面；原 26 列一字未动）');
const ds = Object.values(DE).sort((a, b) => a - b);
console.log('Δε 分位 p50 ' + ds[ds.length >> 1].toFixed(2) + ' ‖ p90 ' + ds[Math.floor(ds.length * .9)].toFixed(2) +
  ' ‖ 吃探索(Δε<0) ' + ds.filter(v => v < 0).length + '/' + ds.length);
