#!/usr/bin/env node
/* audit-dims.mjs — 现役 235 维的"死维 / 近死维 / 冗余维 / 有用维"体检（DS · 2026-10-28 夜）
 *
 * 为什么：用户问"之前定的维度里哪些是读不到的死维、哪些没什么用"。维度账不能靠读代码，得用真实局面量。
 * 做法（读 probe-myopia-regret 的 dump，每行 = 候选：x 235 + win）：
 *   ① 死维：在所有行上 std == 0（任何局面都不变）；
 *   ② 近死维：取值 >99% 落在同一个值上；
 *   ③ 冗余：状态段（0..212）组级值的两两相关 |r| > 0.98；
 *   ④ 有用：状态段对"这一局好不好打"（组内 win 均值）的 |r|；动作段（213..234）对组内中心化 win 的 |r|。
 * ⚠ 状态段在同一决策内对所有候选**逐字相同**（设计如此），所以它的"有用性"只能按**组级**量；动作段才按组内量。
 * 用法：node tools/proto2/audit-dims.mjs --dump=scratch/x.jsonl[,scratch/y.jsonl] [--arm=A0] [--top=20]
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const DUMPS = String(arg('dump', '')).split(',').filter(Boolean);
const ARM = arg('arm', '');
const TOP = Math.max(5, Number(arg('top', 20)) || 20);
if (!DUMPS.length) { console.error('⛔ 需要 --dump=a.jsonl[,b.jsonl]'); process.exit(2); }

const EFFECTS = ['guardCarry', 'guardPrev', 'copiedGuard', 'rodGuard', 'fireWeak', 'mine', 'tauntActive', 'tauntPend', 'nightmare', 'vampire', 'revive', 'infinite', 'stickers', 'chains'];
const B0 = 143, BPER = 14;
function dimName(j) { if (j >= B0 && j < B0 + 70) { const slot = Math.floor((j - B0) / BPER), k = (j - B0) % BPER; return 'B[' + slot + '].' + EFFECTS[k]; } if (j < 63) return 'G[' + j + ']'; if (j < 103) return 'OPP[' + Math.floor((j - 63) / 10) + '][' + ((j - 63) % 10) + ']'; if (j < 123) return 'HIST[' + Math.floor((j - 103) / 4) + '][' + ((j - 103) % 4) + ']'; if (j < 143) return 'T[' + Math.floor((j - 123) / 4) + '][' + ((j - 123) % 4) + ']'; return 'ACT[' + (j - 213) + ']'; }

let rows = [];
for (const p of DUMPS) rows = rows.concat(readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
if (ARM) rows = rows.filter((r) => r.arm === ARM);
if (!rows.length) { console.error('⛔ 过滤后没有行'); process.exit(2); }
const F = rows[0].x.length;
const GKEY = (r) => [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|');
const g = new Map();
for (const r of rows) { const k = GKEY(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
const groups = [...g.values()];
console.log('行 ' + rows.length + ' ‖ 组 ' + groups.length + ' ‖ 维 ' + F);

/* ① 死维 / ② 近死维（全行口径） */
const dead = [], near = [];
for (let j = 0; j < F; j++) {
  let mn = Infinity, mx = -Infinity; const seen = new Set();
  for (const r of rows) { const v = r.x[j]; if (v < mn) mn = v; if (v > mx) mx = v; if (seen.size < 4) seen.add(v); }
  if (mx - mn < 1e-12) dead.push(dimName(j));
  else { let same = 0; const top = rows[0].x[j]; for (const r of rows) if (r.x[j] === top) same++; if (same / rows.length > 0.99) near.push(dimName(j)); }
}
console.log('\n① 死维（任何局面都不变）：' + dead.length + ' / ' + F);
if (dead.length) console.log('   ' + dead.join(', '));
console.log('\n② 近死维（>99% 行取同一个值）：' + near.length);
if (near.length) console.log('   ' + near.join(', '));

/* ③ 冗余（状态段组级相关） */
const stateCols = []; for (let j = 0; j < 213; j++) stateCols.push(j);
const gVec = stateCols.map((j) => groups.map((arr) => arr[0].x[j]));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function pear(a, b) { const ma = mean(a), mb = mean(b); let sa = 0, sb = 0, sab = 0; for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; sa += da * da; sb += db * db; sab += da * db; } return sab / Math.sqrt((sa || 1e-12) * (sb || 1e-12)); }
const red = [];
for (let a = 0; a < stateCols.length; a++) {
  const va = gVec[a]; const mna = Math.min(...va), mxa = Math.max(...va);
  if (mxa - mna < 1e-12) continue;
  for (let b = a + 1; b < stateCols.length; b++) { const vb = gVec[b]; const mnb = Math.min(...vb), mxb = Math.max(...vb); if (mxb - mnb < 1e-12) continue; const c = pear(va, vb); if (Math.abs(c) > 0.98) red.push([dimName(stateCols[a]), dimName(stateCols[b]), Math.round(c * 100) / 100]); }
}
console.log('\n③ 冗余对（|r|>0.98）：' + red.length);
if (red.length) console.log(red.slice(0, 12).map((x) => x[0] + ' ↔ ' + x[1] + ' r=' + x[2]).join('\n   '));

/* ④ 有用：状态段 vs 组内 win 均值；动作段 vs 组内中心化 win */
const gMean = groups.map((arr) => mean(arr.map((r) => Number(r.win))));
const stateR = stateCols.map((j) => { const v = groups.map((arr) => arr[0].x[j]); return [dimName(j), Math.round(pear(v, gMean) * 100) / 100]; });
stateR.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
console.log('\n④a 状态段对“这局好不好打”的相关（top ' + TOP + '，正负都可）：');
console.log(stateR.slice(0, TOP).map((x) => x[0] + ' r=' + x[1]).join(' ‖ '));
const actR = [];
for (let j = 213; j < F; j++) {
  const xs = [], ys = [];
  for (const arr of groups) {
    const mu = mean(arr.map((r) => Number(r.win))); const mx = mean(arr.map((r) => r.x[j]));
    for (const r of arr) { xs.push(r.x[j] - mx); ys.push(Number(r.win) - mu); }
  }
  actR.push([dimName(j), Math.round(pear(xs, ys) * 100) / 100]);
}
actR.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
console.log('\n④b 动作段对“组内哪手更好”的相关：');
console.log(actR.map((x) => x[0] + ' r=' + x[1]).join(' ‖ '));
