#!/usr/bin/env node
/* §E315 反循环检验：**按 Hp 选冠军，会不会真的选出更不脆的包？**
 *
 * 为什么要这一节（我自己先否掉自己的头条）：
 *   先算出来的那张表很唬人 —— 按考卷 H 选前 15 名，选中者 Δε 中位 **+3.5**；按 Hp 选前 15 名，**−2.2**。
 *   但 **Hp ≡ H − Δε** ⇒ "按 Hp 选"在定义上就偏向低 Δε，那张表**有一半是恒等式，不是发现**
 *   （口径陷阱里"max≡mean 是恒等不是读数"的同族）。⇒ 不能拿它当证据。
 *
 * 非循环的做法：换用**第三个口径** ε=0.4 soft 量脆ness —— 它既不是 H（ε=0）也不是 Hp（ε=0.2），
 *   与"选谁当键"没有定义上的关系。若按 Hp 选出来的那批在 ε=0.4 下**仍然**更不脆，效果才叫外推得动。
 * 用法：node champion-map/eps04-check.mjs
 *   前置：docs/artifacts/e315-out/eps04-{byex,bypg}.txt（id + ε=0.4 的 1st，由 eval-5p 跑出来）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));

const L = readFileSync(join(HERE, 'epsfull.tsv'), 'utf8').trim().split('\n').map(r => r.split('\t'));
const hd = Object.fromEntries(L[0].map((h, i) => [h, i]));
const M = {}; for (const r of L.slice(1)) M[r[hd.id]] = { ex: +r[hd.exam], pg: +r[hd.page], d: +r[hd.d] };
const rd = (f) => Object.fromEntries(readFileSync(join(HERE, '..', 'docs/artifacts/e315-out/eps04-' + f + '.txt'), 'utf8')
  .trim().split('\n').map(l => { const a = l.split(/\s+/); return [a[0], +a[1]]; }));
const g1 = rd('byex'), g2 = rd('bypg');
const md = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function stat(g, name) {
  const ids = Object.keys(g).filter(k => k in M);
  const d4 = ids.map(k => M[k].ex - g[k]);           // Δε(0.4) —— 非循环那一列
  const d2 = ids.map(k => M[k].d);                    // Δε(0.2) —— 会骗人的那一列
  console.log('  ' + name.padEnd(20) + ' n=' + String(ids.length).padStart(2) +
    '  ‖ Δε(0.2) 中位 ' + md(d2).toFixed(2).padStart(6) + '（定义相关，不算证据）' +
    '  ‖ **Δε(0.4) 中位 ' + md(d4).toFixed(2).padStart(6) + '** 均值 ' + mean(d4).toFixed(2));
}
console.log('现役参照：Δε(0.2) = ' + M['SHIPPED-Ldemo'].d.toFixed(2) + ' ‖ 全库 Δε(0.2) 中位 ' + md(Object.values(M).map(r => r.d)).toFixed(2));
stat(g1, '按考卷 H 选前 15');
stat(g2, '按 Hp 选前 15');
const ov = Object.keys(g1).filter(k => k in g2);
const cut = g => Object.fromEntries(Object.entries(g).filter(([k]) => !ov.includes(k)));
console.log('\n剔掉两组重叠的 ' + ov.length + ' 枚（重叠越多越测不出差别）：');
stat(cut(g1), '按考卷 H 独占');
stat(cut(g2), '按 Hp 独占');
const a = Object.keys(cut(g1)).filter(k => k in M), b = Object.keys(cut(g2)).filter(k => k in M);
const da = a.map(k => M[k].ex - cut(g1)[k]), db = b.map(k => M[k].ex - cut(g2)[k]);
const diff = md(db) - md(da);
console.log('\n判定：非循环那一列的差 = ' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + 'pt（负 = 按 Hp 选的那批在 ε=0.4 下也更不脆）');
console.log('  ⇒ ' + (diff <= -1 ? '方向站得住：效果能外推到**没参与选择**的口径上 ⇒ 换当选键不是自我实现'
  : '外推不动：ε=0.4 下两组没差别 ⇒ 那张"按 Hp 选更不脆"的表**基本就是恒等式**，不许当证据'));
console.log('  ⚠ 分辨率：同包换 eval seed 的 1st 极差 p50 1.5 ‖ p90 3.7pt ⇒ 上面这个差要 ≥3.7pt 才谈得上"显著"，1~3pt 只能算方向。');
