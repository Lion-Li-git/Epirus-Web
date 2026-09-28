#!/usr/bin/env node
/* ============================================================================
 * analyze-routing-gain.mjs —— 把 `probe-regime-identifiability --dump` 的逐环境链路做成**配对区间**（v1.5.288 · §E130）
 *
 * 为什么要有它：§E129/§E130 的预注册判据写的是"增益的配对 95% 区间跨不跨 0"，
 * 而探针本体只印**均值**。只看均值有两个方向都会错：把 1 个点的运气说成趋势，
 * 也把"27 个环境里 12 个其实变差了"藏进一个正号里（DS 清单第 8 条点的正是分母/区间这一类错）。
 * 本工具只做算术、不打一局：读 dump 的 `perEnv[]`，按环境配对出三条量
 *   ① `realizable − best_single`（路由相对一招鲜赚了多少）
 *   ② `oracle − best_single`（上界本身有多少，与 §E129 的分母对表）
 *   ③ 逐环境的**输赢分布**（几个环境变好 / 变差 / 打平，最差那个亏多少）
 * 用法：node tools/analyze-routing-gain.mjs <dump.json> [<dump2.json> …]
 * ==========================================================================*/
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!files.length) { console.error('用法：node tools/analyze-routing-gain.mjs <dump.json> …'); process.exit(2); }

function paired(a, b) {
  const d = [];
  for (let i = 0; i < a.length; i++) if (typeof a[i] === 'number' && typeof b[i] === 'number') d.push(a[i] - b[i]);
  const n = d.length;
  if (n < 2) return null;
  const m = d.reduce((x, y) => x + y, 0) / n;
  const s = Math.sqrt(d.reduce((x, y) => x + (y - m) * (y - m), 0) / (n - 1));
  const h = 1.96 * s / Math.sqrt(n);
  const sorted = d.slice().sort((x, y) => x - y);
  return { n, m, h, lo: m - h, hi: m + h, worse: d.filter(x => x < -1e-9).length, better: d.filter(x => x > 1e-9).length,
    tie: d.filter(x => Math.abs(x) <= 1e-9).length, min: sorted[0], max: sorted[sorted.length - 1], p05: sorted[Math.floor(0.05 * (n - 1))] };
}
const f4 = (x) => (typeof x === 'number' ? (Math.round(x * 10000) / 10000).toFixed(4) : '—');
const pct = (x) => (typeof x === 'number' ? (100 * x).toFixed(1) + '%' : '—');
function line(tag, p, asPct) {
  if (!p) { console.log('  ' + tag + '：读数不足（n<2）⇒ **不出结论**'); return; }
  const conv = asPct ? pct : f4;
  console.log('  ' + tag + '：n=' + p.n + ' 配对均值 ' + conv(p.m) + ' ±' + conv(p.h)
    + ' ⇒ 95% [' + conv(p.lo) + ', ' + conv(p.hi) + ']'
    + (p.lo <= 0 && p.hi >= 0 ? '  ⛔**跨 0 ⇒ 与抽样不可分**' : '  ✔ 不跨 0'));
  console.log('      逐环境分布：变好 ' + p.better + ' ‖ 变差 ' + p.worse + ' ‖ 打平 ' + p.tie
    + ' · 最差 ' + conv(p.min) + ' · 最好 ' + conv(p.max));
}
for (const file of files) {
  const D = JSON.parse(readFileSync(file, 'utf8'));
  const rows = D.perEnv;
  const asPct = D.metric === 'win';
  console.log('\n# ' + file + ' · 量纲=' + D.metric + ' · K=' + D.k + ' · ' + rows.length + ' 个环境 · 一招鲜=' + D.bestSinglePack);
  line('① 路由增益 realizable−best_single', paired(rows.map(r => r.chosen[D.metric]), rows.map(r => r.incumbent[D.metric])), asPct);
  line('② 上界缺口 oracle−best_single', paired(rows.map(r => r['oracle' + D.metric[0].toUpperCase() + D.metric.slice(1)]), rows.map(r => r.incumbent[D.metric])), asPct);
  const acc = rows.filter(r => typeof r.acc === 'number' && r.n > 0);
  const am = acc.reduce((x, r) => x + r.acc, 0) / acc.length;
  const as = Math.sqrt(acc.reduce((x, r) => x + (r.acc - am) * (r.acc - am), 0) / (acc.length - 1));
  console.log('  ③ 分类准确率**按环境聚类**：n=' + acc.length + ' 个环境 · 均值 ' + pct(am) + ' ±' + pct(1.96 * as / Math.sqrt(acc.length))
    + '（探针 json 里那条朴素二项是按逐局样本算的，同环境的多局**不独立** ⇒ 真区间取这一条）');
}
