/* 复核 DS §3.3 的"标签噪声地板"两件事：
 * ① 自反：pick 用 A 半流、评却用"全流"（A ⊂ 全流）⇒ 地板被赢者诅咒压低。
 * ② tie-break：并列最大时 indexOf/严格 > 都取**池里下标最小**的那一个，而 dump 的池是按现役 net 降序排的
 *    ⇒ "A 半流 oracle"会系统性退化成"现役 net 的第一名"。
 * 与 DS 同口径（同 dump、同分半），只把两处偏各自去掉。 */
import { readFileSync } from 'node:fs';

const rows = [];
for (const p of ['scratch/e820-train.jsonl', 'scratch/e820-test.jsonl'])
  for (const l of readFileSync(p, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.arm === 'A0') rows.push(r); }

const G = new Map();
for (const r of rows) { const k = [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|'); if (!G.has(k)) G.set(k, []); G.get(k).push(r); }
const groups = [...G.values()].filter(a => a.length >= 2);

/* --- 池的排序是不是 net 降序 --- */
let mono = 0, nonmono = 0;
for (const a of groups) {
  const idx = [...a.keys()].sort((x, y) => a[x].i - a[y].i);
  let ok = true;
  for (let j = 1; j < idx.length; j++) if (a[idx[j]].net > a[idx[j - 1]].net + 1e-12) { ok = false; break; }
  ok ? mono++ : nonmono++;
}
console.log('池内按 i 递增时 net 单调不升的组：' + mono + ' / ' + (mono + nonmono) + '（不单调 ' + nonmono + '）');

const mean = x => x.reduce((p, q) => p + q, 0) / x.length;
const M = groups[0][0].winS.length, H = M >> 1;
const out = { randB: [], oracleAfirstB: [], oracleArandTieB: [], headB: [], randFull: [], oracleAfirstFull: [], headFull: [] };
let tieAtMax = 0, firstIsNetTop = 0, oraclePicksIndex0 = 0, nGroups = 0, tiesTotal = 0;

/* 5 折按组 CV 的线性头（与 rank-signal 同法：组内中心化 + 岭回归 l2=1） */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const F = groups[0][0].x.length, FOLDS = 5;
const buckets = Array.from({ length: FOLDS }, () => []);
for (const [k, a] of G) if (a.length >= 2) buckets[hash(k) % FOLDS].push(a);
const fitHead = (gs) => {
  const X = [], y = [];
  for (const a of gs) { const us = a.map(r => r.win); const mu = mean(us); a.forEach((r, i) => { X.push(r.x); y.push(us[i] - mu); }); }
  const mu = new Float64Array(F), sd = new Float64Array(F);
  for (const x of X) for (let j = 0; j < F; j++) mu[j] += x[j] / X.length;
  for (const x of X) for (let j = 0; j < F; j++) { const d = x[j] - mu[j]; sd[j] += d * d / X.length; }
  for (let j = 0; j < F; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const A = Array.from({ length: F }, () => new Float64Array(F)), b = new Float64Array(F);
  for (let i = 0; i < X.length; i++) {
    const z = new Float64Array(F); for (let j = 0; j < F; j++) z[j] = (X[i][j] - mu[j]) / sd[j];
    for (let p = 0; p < F; p++) { b[p] += z[p] * y[i]; for (let q = 0; q < F; q++) A[p][q] += z[p] * z[q]; }
  }
  for (let p = 0; p < F; p++) A[p][p] += 1;
  const aug = A.map((r, i) => { const t = new Float64Array(F + 1); t.set(r); t[F] = b[i]; return t; });
  for (let c = 0; c < F; c++) {
    let piv = c; for (let r = c + 1; r < F; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[piv][c])) piv = r;
    if (Math.abs(aug[piv][c]) < 1e-12) continue;
    const tmp = aug[c]; aug[c] = aug[piv]; aug[piv] = tmp;
    const d = aug[c][c]; for (let k = c; k <= F; k++) aug[c][k] /= d;
    for (let r = 0; r < F; r++) { if (r === c) continue; const f = aug[r][c]; if (!f) continue; for (let k = c; k <= F; k++) aug[r][k] -= f * aug[c][k]; }
  }
  const w = new Float64Array(F); for (let i = 0; i < F; i++) w[i] = aug[i][F];
  return (x) => { let s = 0; for (let j = 0; j < F; j++) s += w[j] * (x[j] - mu[j]) / sd[j]; return s; };
};
const headOf = new Map();
for (let f = 0; f < FOLDS; f++) { const sc = fitHead(buckets.filter((_, i) => i !== f).flat()); for (const a of buckets[f]) headOf.set(a, sc); }

for (const a of groups) {
  const k = a.length;
  const uA = a.map(r => mean(r.winS.slice(0, H)));
  const uB = a.map(r => mean(r.winS.slice(H)));
  const uFull = a.map(r => r.win);
  const maxOf = u => Math.max(...u);
  const argmaxFirst = u => u.indexOf(maxOf(u));
  const tiedCount = u => maxOf(u) === Math.max(...u.map(v => v)) ? u.filter(v => Math.abs(v - maxOf(u)) < 1e-12).length : 0;
  const regretOn = (u, at) => maxOf(u) - u[at];
  const iA = argmaxFirst(uA);
  const tn = tiedCount(uA);
  nGroups++; tiesTotal += tn;
  if (tn > 1) tieAtMax++;
  if (iA === 0) oraclePicksIndex0++;
  if (iA === argmaxFirst(a.map(r => r.net))) firstIsNetTop++;
  out.randB.push(maxOf(uB) - mean(uB));
  out.oracleAfirstB.push(regretOn(uB, iA));
  // 并列随机破：对 A 半流的所有并列最大者取平均 regret（=破号的期望）
  const tiedIdx = uA.map((v, i) => Math.abs(v - maxOf(uA)) < 1e-12 ? i : -1).filter(i => i >= 0);
  out.oracleArandTieB.push(mean(tiedIdx.map(i => regretOn(uB, i))));
  out.randFull.push(maxOf(uFull) - mean(uFull));
  out.oracleAfirstFull.push(regretOn(uFull, iA));
  const sc = headOf.get(a);
  if (sc) { out.headB.push(regretOn(uB, uB.map((_, i) => i).reduce((bi, i, arr) => sc(a[i].x) > sc(a[bi].x) + 1e-12 ? i : bi, 0)));
            out.headFull.push(regretOn(uFull, arr0(a, sc))); }
}
function arr0(a, sc) { let bi = 0, bv = -Infinity; a.forEach((r, i) => { const v = sc(r.x); if (v > bv) { bv = v; bi = i; } }); return bi; }

console.log('组数 ' + nGroups + ' ‖ 平均候选 ' + (rows.length / nGroups).toFixed(1) + ' ‖ winS 每条 ' + M + ' 流，分半 ' + H + '/' + (M - H));
console.log('');
console.log('① A 半流 oracle 的并列情况：最大者唯一的组 ' + (nGroups - tieAtMax) + ' ‖ 有并列的组 ' + tieAtMax + '（' + (100 * tieAtMax / nGroups).toFixed(1) + '%）‖ 平均并列 ' + (tiesTotal / nGroups).toFixed(2) + ' 个');
console.log('   oracle 挑到下标 0（=池里 net 最高的那手）的组：' + oraclePicksIndex0 + ' / ' + nGroups + ' = ' + (100 * oraclePicksIndex0 / nGroups).toFixed(1) + '%（若无偏应 ≈ ' + (100 / (rows.length / nGroups)).toFixed(1) + '%）');
console.log('   oracle 那一手 == 现役 net 的第一名的组：' + firstIsNetTop + ' / ' + nGroups + ' = ' + (100 * firstIsNetTop / nGroups).toFixed(1) + '%');
console.log('');
console.log('② 地板的两种口径（DS 的 log 用的是"全流评"那一列）：');
console.log('   随机挑      B 评 ' + mean(out.randB).toFixed(3) + 'pt ‖ 全流评 ' + mean(out.randFull).toFixed(3) + 'pt');
console.log('   A 半流 oracle B 评 ' + mean(out.oracleAfirstB).toFixed(3) + 'pt ‖ 全流评 ' + mean(out.oracleAfirstFull).toFixed(3) + 'pt   ← 自反把地板压低 ' + (mean(out.oracleAfirstB) / Math.max(1e-9, mean(out.oracleAfirstFull))).toFixed(1) + '×');
console.log('   A oracle 并列随机破 B 评 ' + mean(out.oracleArandTieB).toFixed(3) + 'pt');
console.log('   线性头        B 评 ' + mean(out.headB).toFixed(3) + 'pt ‖ 全流评 ' + mean(out.headFull).toFixed(3) + 'pt');
console.log('');
const capClean = (mean(out.randB) - mean(out.headB)) / Math.max(1e-9, mean(out.randB) - mean(out.oracleArandTieB));
const capDs = (mean(out.randFull) - mean(out.headFull)) / Math.max(1e-9, mean(out.randFull) - mean(out.oracleAfirstFull));
console.log('兑现率（头吃到可学空间的几成）：DS 口径（自反地板）= ' + (100 * capDs).toFixed(1) + '% ‖ 干净口径（B 评 + 并列随机破）= ' + (100 * capClean).toFixed(1) + '%');
console.log('相对随机的改善：DS 口径 ' + (100 * (mean(out.randFull) - mean(out.headFull)) / mean(out.randFull)).toFixed(1) + '% ‖ 干净口径 ' + (100 * (mean(out.randB) - mean(out.headB)) / mean(out.randB)).toFixed(1) + '%');
