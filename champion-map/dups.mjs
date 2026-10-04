#!/usr/bin/env node
/* §E308 权重指纹重复普查
 *
 * 起因：`promote --dry` 里 v7ws1-91 与 v7press3-91 的每一格读数逐位相同（G 7.4 ‖ 墙 18 ‖ 场A 29% ‖ G4 69%/63%），
 * 一查 wid 也一样 ⇒ 它们是**同一副权重存成了两个名字**（名次 5 与 6 其实是同一枚）。"6 枚候选"当场缩水。
 *
 * 四类"配置签名不同但权重逐字节相同"要分开，含义完全不同：
 *   ① 记账差：`-`（那版 META 没这个字段）与 `0`（有但为零）是同一个值 ⇒ 权重相同是**应该的**，不是发现
 *   ② 被夹住：oppsN 20 vs 22，若池子实际没那么大则两档同一个池 ⇒ 也不是发现
 *   ③ 规则快照：rulesFp 不同、权重相同 ⇒ 本该如此（同一枚包换一套规则）
 *   ④ 真零剂量：排除 ①②③ 之后还剩的 ⇒ 那枚旋钮在这一档**根本没进网络**（§E249 同类证据，这里从归档白捡）
 *
 * 用法：node champion-map/dups.mjs [--all]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const LIN = rd('lineage.tsv'), CO = rd('coords.tsv');
const LH = Object.fromEntries(LIN[0].map((h, i) => [h, i]));
const CH = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const LR = LIN.slice(1), CR = CO.slice(1);
const CO_BY_ID = Object.fromEntries(CR.map((r) => [r[CH.id], r]));

/* 数值轴：`-` / 空 / 0 归成同一个 '0'（① 类记账差的来源）*/
const NUM = ['divW', 'divK', 'divRoleW', 'divCatW', 'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW', 'whistlePen', 'styleW', 'eTarget', 'eCap', 'gens'];
const OTH = ['mode', 'seedEmb'];
function norm(v) { return v === '' || v === '-' || /^-?0(\.0+)?$/.test(v) ? '0' : v; }
function sig(r) {
  return NUM.map((k) => k + '=' + norm(r[LH[k]] || '')).join(' ') + ' ' +
    OTH.map((k) => k + '=' + (r[LH[k]] || '')).join(' ');
}
function diffAxes(a, b) {
  const p = (s) => Object.fromEntries(s.split(' ').map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  const A = p(a), B = p(b);
  return Object.keys(A).filter((k) => A[k] !== B[k]).map((k) => k + ' ' + A[k] + '→' + B[k]);
}

const G = new Map();
for (const r of LR) { if (!r[LH.wid]) continue; if (!G.has(r[LH.wid])) G.set(r[LH.wid], []); G.get(r[LH.wid]).push(r); }
const dup = [...G.entries()].filter(([, v]) => v.length > 1);
const n = (v) => v.length, by = (v) => v.map((r) => r[LH.id]).join(' ‖ ');

console.log('== ① 覆盖率 ==');
console.log('718 枚 → 唯一权重 ' + G.size + ' 副 ⇒ ' + dup.length + ' 组重复、吃掉 ' +
  dup.reduce((a, x) => a + n(x[1]), 0) + ' 枚（' + (100 * (1 - G.size / 718)).toFixed(1) + '% 的点是别人的副本）');

/* 名次污染：按 coords 的 rank 看前 30 名里有几枚是副本 */
const rk = (id) => (CO_BY_ID[id] ? +CO_BY_ID[id][CH.rank] : 9e9);
const Hb = (id) => (CO_BY_ID[id] ? +CO_BY_ID[id][CH.H] : NaN);
const top = [];
for (const [w, v] of G) { const s = v.slice().sort((a, b) => rk(a[LH.id]) - rk(b[LH.id])); top.push([w, s[0], v.length]); }
top.sort((a, b) => rk(a[1][LH.id]) - rk(b[1][LH.id]));
for (let K = 10; K <= 60; K += 10) {
  const t = top.slice(0, K), d = t.filter((x) => x[2] > 1).length;
  console.log('  前 ' + K + ' 名里 ' + d + ' 枚有同名副本（' + (100 * d / K).toFixed(0) + '%）');
}

console.log('\n== ② 同一副权重的考卷读数是否自洽（H 应当逐位相同）==');
let bad = 0;
for (const [w, v] of G) { const hs = new Set(v.map((r) => Hb(r[LH.id]).toFixed(2)));
  if (hs.size > 1) { bad++; if (bad <= 6) console.log('  ⚠ ' + w.slice(0, 10) + ' H 读数不一致：' + [...hs].join(' ‖ ') + '  ' + by(v)); } }
console.log(bad ? '  共 ' + bad + ' 组不自洽 ⇒ 这些要按 §E307 的教训查规则快照/装配差' : '  ✅ 0 组不自洽 ⇒ 考卷对同权重可复现（H 是权重的函数，不是噪声源）');

console.log('\n== ③ 排除记账差后的跨配置重复 ==');
const cross = [], snap = [];
/* 坑（第一版就这么静默漏了全部）：`s` 是 `[...new Set(...)]` 展开成的**数组**，`.size` 是 undefined ⇒ 永假 */
for (const [w, v] of dup) {
  const s = [...new Set(v.map(sig))];
  const rf = [...new Set(v.map((r) => r[LH.rulesFp] || '-'))];
  if (s.length > 1) cross.push([w, v, s]);
  else if (rf.length > 1) snap.push([w, v, rf]);
}
console.log('  ③a 同权重但规则快照不同：' + snap.length + ' 组（本该如此 —— 同一枚包换一套规则，不是发现）');
console.log('  ③b 归一化后配置签名仍不同、权重却逐字节相同：' + cross.length + ' 组 ← 只有这一类值得看');
cross.sort((a, b) => n(b[1]) - n(a[1]));
for (const [w, v, s] of cross.slice(0, process.argv.includes('--all') ? 999 : 10)) {
  const d = diffAxes(s[0], s[1]);
  const far = new Set(v.map((r) => String(r[LH.ts]).slice(0, 13))).size;
  console.log('  ' + n(v) + '× ' + w.slice(0, 10) + '  ' + by(v));
  console.log('     差异轴：' + d.map((x) => '    ' + x).join('\n') +
    '   ‖ 时间戳跨 ' + far + ' 个小时 ⇒ ' + (far > 1 ? '确是分别跑出来的' : '可能只是同一次跑的重复归档'));
}
const hit = {};
for (const [, , s] of cross) { const s0 = new Set(); for (let i = 1; i < s.length; i++) for (const a of diffAxes(s[0], s[i])) s0.add(a.split(' ')[0]); for (const a of s0) hit[a] = (hit[a] || 0) + 1; }
console.log('\n  被点名"改了却没换权重"的轴：' +
  (Object.keys(hit).length ? Object.entries(hit).sort((a, b) => b[1] - a[1]).map(([k, c]) => k + ' ' + c + ' 组').join(' · ') : '（无）'));
console.log('\n  ⇒ 读法：③b 才是真零剂量候选；先排掉 ③a（规则快照）与被池子上限夹住的档位（如 oppsN 20 vs 22）。');
