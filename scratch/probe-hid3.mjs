#!/usr/bin/env node
/* probe-hid3.mjs — 代 3（obs3b/obs3c）的隐元利用率与输入死维（DS · 2026-11-02 晚）
 * 量：① 候选层 hid2 隐元的活跃率/等效维数（participation ratio）；② 决策级 xin 的方差分布与近恒定维；
 *     ③ 隐元两两相关（正交性）。
 * 用法：node scratch/probe-hid3.mjs --pack=<p> [--games=20] [--n=5] [--mode=long]
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', ''); const GAMES = Math.max(5, Number(arg('games', 20)) || 20);
const N = 5, MODE = arg('mode', 'long'), TEMP = Number(arg('temp', 0.15));
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2(PACK); const got = packCfgExit(raw, PACK);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pv = Float64Array.from(P.unpack(raw, true));

const rows = []; const xins = [];
function play(seed) {
  const inner = T.policyChooserN(pv, TEMP, 0, N, 'soft');
  const A = W.EpirusArena2 ? null : null;
  const focus = (state, pid, legal) => {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    if (cs.length >= 2) {
      const fr = P.forwardCands(state, pid, cs, pv, { temp: 1, wantTape: 1 });
      if (fr && fr.tape) { for (const a of fr.tape.afs) rows.push(a); if (fr.tape.xin) xins.push(fr.tape.xin); }
    }
    return inner(state, pid, legal);
  };
  const opp = [focus];
  for (let i = 1; i < N; i++) opp.push(inner);
  T.oneGameN(opp, seed, N, { mode: MODE });
}
for (let k = 0; k < GAMES; k++) play(98000 + k * 977);

const H = rows[0] ? rows[0].length : 0;
const n = rows.length;
const mean = new Array(H).fill(0), varA = new Array(H).fill(0), act = new Array(H).fill(0);
for (const r of rows) for (let j = 0; j < H; j++) { const v = r[j] || 0; mean[j] += v; if (Math.abs(v) > 1e-9) act[j]++; }
for (let j = 0; j < H; j++) mean[j] /= Math.max(1, n);
for (const r of rows) for (let j = 0; j < H; j++) { const d = (r[j] || 0) - mean[j]; varA[j] += d * d; }
for (let j = 0; j < H; j++) varA[j] /= Math.max(1, n);
const sumV = varA.reduce((a, b) => a + b, 0), sumV2 = varA.reduce((a, b) => a + b * b, 0);
const pr = sumV2 > 0 ? (sumV * sumV) / sumV2 : 0;
const active = act.map((c) => c / Math.max(1, n));
const dead = active.filter((a) => a < 0.01).length;
/* 两两相关（样本抽样，避免 O(n*H^2) 爆） */
const S = Math.min(400, n); const corr = [];
for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) {
  let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
  for (let t = 0; t < S; t++) { const a = rows[t][i] || 0, b = rows[t][j] || 0; sxy += a * b; sx += a; sy += b; sxx += a * a; syy += b * b; }
  const num = S * sxy - sx * sy, den = Math.sqrt(Math.max(1e-12, S * sxx - sx * sx)) * Math.sqrt(Math.max(1e-12, S * syy - sy * sy));
  corr.push(Math.abs(num / den));
}
const meanCorr = corr.length ? corr.reduce((a, b) => a + b, 0) / corr.length : 0;

/* 输入侧 */
const D = xins[0] ? xins[0].length : 0;
const xm = new Array(D).fill(0), xv = new Array(D).fill(0);
for (const x of xins) for (let j = 0; j < D; j++) xm[j] += x[j];
for (let j = 0; j < D; j++) xm[j] /= Math.max(1, xins.length);
for (const x of xins) for (let j = 0; j < D; j++) { const d = x[j] - xm[j]; xv[j] += d * d; }
for (let j = 0; j < D; j++) xv[j] /= Math.max(1, xins.length);
const xNear = xv.filter((v) => v < 1e-8).length;

console.log('### ' + PACK.split('/').pop() + ' ‖ 决策 ' + n + ' ‖ hid2=' + H + ' ‖ xin=' + D);
console.log('  隐元：活跃(>1%) ' + (H - dead) + '/' + H + ' ‖ 死元 ' + dead + ' ‖ 等效维数 PR ' + pr.toFixed(2) + '/' + H + ' ‖ 平均|相关| ' + meanCorr.toFixed(2));
console.log('  激活率 前5: ' + active.slice().sort((a, b) => b - a).slice(0, 5).map((v) => v.toFixed(2)).join(',') + ' ‖ 后5: ' + active.slice().sort((a, b) => a - b).slice(0, 5).map((v) => v.toFixed(2)).join(','));
console.log('  输入：近恒定维 ' + xNear + '/' + D + ' ‖ 方差中位 ' + xv.slice().sort((a, b) => a - b)[Math.floor(D / 2)].toExponential(2));
