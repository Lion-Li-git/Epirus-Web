/* `tools/probe-defense-cause.mjs --pair=1` 同回合配对表的**唯一解析处**（v1.5.222 · Qoder 09-25）
 * 为什么单独成模块：`promote-champion.mjs` 的"设防持续性栏"要读同一张表，而**不许复制第二份仿真**（D150 同规矩）；
 *   解析规则（列序、`—` 占位、判定文案）也必须有单一来源，否则体检那栏会与探针读数各说各话。
 * 本模块**不跑仿真**，只解析文本 ⇒ 可以安全 import（不像 probe-defense-cause 一 import 就开跑）。*/

/* 行式：`   包名  N 粒|单粒  hold均%  cycle均%  ±Δ  ±种子Δ[ ±种子Δ…]  极差|—  判定文字`
 * ⚠️ 用锚到尾部的正则，而不是"按空白切开再按下标数"：每粒种子那列有 1~3 个数，切片下标会串位
 *   （v1.5.222 第一版就是这么把 band2 的 Δ 读成极差 1.4 的）。*/
const ROW = /^\s{3}(\S+)\s+(?:\d+ 粒|单粒)\s+([\d.]+)\s+([\d.]+)\s+([+-][\d.]+)\s+((?:[+-][\d.]+(?:\s+|$))+)(?:(\d+(?:\.\d+)?)|—)\s*(\S.*?)?\s*$/;

/** 解析配对表；解析不出的行如实跳过（不许编数） */
export function parsePairTable(text) {
  const L = String(text || '').split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of L) {
    if (/同回合配对/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    const m = ROW.exec(line);
    if (!m) continue;
    rows.push({
      pack: m[1],
      hold: Number(m[2]),
      cycle: Number(m[3]),
      delta: Number(m[4]),
      seeds: m[5].trim().split(/\s+/).map(Number),
      spread: m[6] === undefined ? NaN : Number(m[6]),
      verdict: (m[7] || '').trim()
    });
  }
  return rows;
}

/** 体检/门禁用的一行文案。"只记录不阻断"是刻意的：阈值尚未裁定（§H-55 立不出线 / §H-56 中间带是分布本身的形状）。 */
export function formatRecord(row, meta) {
  if (!row) return '   设防持续性栏：**没量到**（探针没出表 / 这一行解析不出）⇒ 这不是"没有体质"，是没跑成，**不许按 0 处理**';
  const g = function (v) { return isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) : '—'; };
  const p = function (v) { return isFinite(v) ? v.toFixed(1) : '—'; };   /* 水平量不加符号："+38.6% 在防"会被读成增量 */
  return '   设防持续性栏（' + (meta || '') + '**只记录不阻断**）：' +
    'Δ(钱) **' + g(row.delta) + 'pt** · hold 均 ' + p(row.hold) + '% · cycle 基线（水平轴）' + p(row.cycle) + '% · ' +
    '跨种子极差 ' + (isFinite(row.spread) ? row.spread.toFixed(1) : '—') + 'pt ⇒ ' + (row.verdict || '未判');
}
