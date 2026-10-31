#!/usr/bin/env node
/* fitness-noise.mjs — **4 局适应度到底能不能排对序**（千问 · 10-31 午 · "劈法实验 A"的仪器）
 *
 * 为什么要它：现役 CEM 每个候选只打 `--games=4` 局，"选精英/选产物"全按这 4 局的均值排。
 *   于是"臂在爬坡"与"臂在爬选择噪声"这两件事，只看臂的分数曲线是**分不开**的（E822 那笔账的 CEM 版）。
 *   但这把尺不需要重训任何东西：拿盘上现成的若干枚包，同一批桌上量两样东西——
 *     ① 真值 = 440 局（11 桌形 × 40，与臂的冻结桌同一批局号）的净胜/夺1；
 *     ② 噪声 = 反复模拟"一代 4 局"（局号式子照抄 `arena2` 的 loop 分支：`gen*games+g`，盐 101）得到的均值分布。
 *   两个数一比就知道：4 局均值能把这些包排对吗？"按 4 局取前 4"和"按真值取前 4"重合几枚？
 *
 * ⚑ 三条口径纪律：
 *   ① **只读**：不动训练环、不训任何东西、不改任何在册读数；
 *   ② 真值那一批的逐局聚合必须与 `A.evalChooser(phase:'frozen')` **逐位相等**（不同 ⇒ 我抄错了局号 ⇒ exit 8，什么都不印）；
 *   ③ 报**秩相关**也报"前 4 重合"，因为 CEM 只取前几名 ⇒ 排序的头部错误比整体相关更致命（均值会把这两件事混过去）。
 *
 * 用法：node tools/proto2/fitness-noise.mjs [--packs=a.bak,b.bak,…] [--gens=60] [--games=4] [--topK=4] [--cur=net|first]
 */
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['packs', 'gens', 'games', 'topK', 'cur', 'quiet', 'mode', 'mutPop', 'mutSig'], 'fitness-noise');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GENS = Math.max(8, Number(arg('gens', 60)) || 60);
const GAMES = Math.max(2, Number(arg('games', 4)) || 4);
const TOPK = Math.max(2, Number(arg('topK', 4)) || 4);
const CUR = String(arg('cur', 'net'));
const TEMP = 0.15;
const DEFAULTS = ['OB3S-C2-s7', 'OB3M-C1-s7', 'OB3CH-s7', 'OB3CH-s11', 'OB3RB-s7', 'OB3RB-s13', 'OB3RB-s31', 'OB3RB-s41',
  'OB3CTRL-s7', 'OB3CTRL-s13', 'OB3CTRL-s31', 'OB3CTRL-s41', 'supfit-w1', 'chainkeep-1']
  .map((f) => 'scratch/arms/' + f + '.bak');
const PACKS = String(arg('packs', '')).split(',').filter(Boolean).length
  ? String(arg('packs', '')).split(',').filter(Boolean) : DEFAULTS;

const SALT_LOOP = 101, SALT_FROZEN = 5077, BASE_FROZEN = 200000;
/* ===== `--mode=mutants`：**直接模拟 CEM 的一次选择**（10-31 加，这才是要紧的那个数）=====
 * 为什么要有这一档：跨家族比包（默认档）量的是"4 局能不能分出两枚不同的包"，
 *   而 CEM 每天在做的是"在**同一父代撒出来的一群子代**里挑前 4"——近邻之间的排序噪声才是选择的真噪声。
 *   arena2 的 loop 分支同代共用同一批桌（配对）⇒ 绝对抖动会小一些，但**近邻差异也更小**，两头都得实测。
 * 做法：取一枚包当父代 → 用与训练环同一套"段感知"缩放撒 K 粒（σ 可换）→ 每粒各量 4 局均值与 440 局真值 →
 *   报 ρ / 前 K/12 重合 / "按 4 局挑 vs 按真值挑"的期望损失。 */
const MODE = String(arg('mode', 'packs'));
const MUT_K = Math.max(8, Number(arg('mutPop', 48)) || 48);
const MUT_SIG = Number(arg('mutSig', 0.2));

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const A0 = createArena2(W0, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });
const shapeN = A0.shapes.length;
const gamesPer = shapeN * 40 / shapeN;      /* 真值档 = 每桌形 40 局（与臂的终局冻结桌同式） */
console.log('# 适应度噪声仪 ‖ 装配 ' + A0.fp.split('|')[0] + ' ‖ ' + A0.fp.match(/stratified=[^|]+/)[0] + ' ‖ temp=' + TEMP);
console.log('  噪声档 = 每代 ' + GAMES + ' 局 × ' + GENS + ' 代（局号 gen*' + GAMES + '+g，盐 ' + SALT_LOOP + '）‖ 真值档 = ' + shapeN + ' 桌形 × 40 局 = ' + (shapeN * 40) + ' 局（盐 ' + SALT_FROZEN + '）‖ 货币=' + CUR);

const of = (row) => (CUR === 'first' ? row.scoreFirst : row.scoreNet);

function batchRun(A, sel, kind, gens) {
  const out = [];
  if (kind === 'frozen') {
    for (let s = 0; s < A.shapes.length; s++) for (let g = 0; g < 40; g++) out.push(of(A.playOne(sel, s, BASE_FROZEN + s * 1000 + g, SALT_FROZEN)));
  } else {
    for (let gen = 0; gen < gens; gen++) {
      let acc = 0;
      for (let g = 0; g < GAMES; g++) {
        const seq = gen * GAMES + g;
        const slot = seq % A.shapes.length;
        acc += of(A.playOne(sel, slot, seq, SALT_LOOP));
      }
      out.push(acc / GAMES);
    }
  }
  return out;
}

const rows = [];
const W = sandbox();
let installed = null;
for (const p of PACKS) {
  let raw, got;
  try { raw = readPack2(p); got = packCfgExit(raw, p); } catch (e) { console.log('⚠ 读不出 ' + p + '：' + String(e && e.message).slice(0, 60)); continue; }
  const face = (raw.dims && raw.dims.input) || 'v7';
  let A, sel;
  if (face === 'v7') { A = A0; sel = A0.chooserOf(Float64Array.from(raw.p || raw.params || []), TEMP); }
  else {
    if (installed) installed.restore();
    installed = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
    const pp = W.EpirusPolicy.unpack(raw, true);
    if (!pp) { console.log('⚠ ' + p + ' unpack 不出 ⇒ 跳过'); continue; }
    A = createArena2(W, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });
    const wi = A.verifyWired(pp, { temp: TEMP });
    if (!wi.ok) { console.error('⛔ ' + p + ' 接线没生效 ⇒ 不量'); process.exit(7); }
    sel = A.chooserOf(pp, TEMP);
  }
  const truth = batchRun(A, sel, 'frozen');
  const noise = batchRun(A, sel, 'loop', GENS);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
  rows.push({ id: p.replace(/^.*[\\/]/, '').replace('.bak', ''), face, truth: mean(truth), sdTruth: sd(truth) / Math.sqrt(truth.length),
    noiseMean: mean(noise), noiseSd: sd(noise), noiseMin: Math.min(...noise), noiseMax: Math.max(...noise), n: truth.length });
  if (face !== 'v7' && installed) { /* 留到下一枚再 restore，保证同一进程里不叠装 */ }
}
if (installed) installed.restore();

/* —— 同批自证：我这逐局算出来的真值，必须等于 arena2 自己的 frozen 聚合（用第一枚非 v7 包对一次）—— */
{
  const first2 = rows.find((r) => r.face !== 'v7');
  if (first2) {
    const p = PACKS.find((x) => x.indexOf(first2.id) >= 0);
    const raw = readPack2(p), got = packCfgExit(raw, p);
    const W2 = sandbox();
    const A2 = createArena2(W2, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });
    installed = installArch2(W2, Object.assign({ mutMode: 'seg' }, got.cfg));
    const pp = W2.EpirusPolicy.unpack(raw, true);
    const chk = A2.evalParams(pp, { phase: 'frozen', gamesPerShape: 40, cur: CUR === 'first' ? 'first' : 'net' });
    const d = Math.abs((CUR === 'first' ? chk.firstScore : chk.score) - first2.truth);
    console.log('\n[同批自证] ' + first2.id + ' 逐局真值 ' + first2.truth.toFixed(6) + ' ‖ `evalChooser(frozen)` ' +
      (CUR === 'first' ? chk.firstScore : chk.score).toFixed(6) + ' ‖ 差 ' + d.toExponential(2));
    installed.restore();
    if (d > 1e-12) { console.error('⛔ 我抄的局号与 arena2 的冻结桌不是一批 ⇒ 本工具读数作废'); process.exit(8); }
  }
}

if (MODE === 'mutants') {
  const P1 = PACKS[0];
  const raw = readPack2(P1), got = packCfgExit(raw, P1);
  const Wm = sandbox();
  const Am = createArena2(Wm, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });
  const inst = installArch2(Wm, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = Wm.EpirusPolicy.unpack(raw, true);
  if (!pp) { console.error('⛔ 父代读不出：' + P1); process.exit(2); }
  const L = Wm.EpirusPolicy.__arch2.L;
  let sd = 20261031;
  const rnd2 = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const gauss = () => { const u = rnd2() || 1e-9, v = rnd2(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const kids = [];
  for (let i = 0; i < MUT_K; i++) {
    const v = Float64Array.from(pp);
    for (const sg of L.seg) {                        /* 与训练环同一口径：权重段按 1/√fanIn 定标，偏置段吃原 σ */
      const biasLen = { seatEnc: L.seatH, actEnc: L.actH, ctx: L.hid, cand: L.hid2, policyHead: 1, qHead: 1, inter: L.hid }[sg.name] || 1;
      const biasStart = sg.off + sg.len - biasLen, k = MUT_SIG / Math.sqrt(Math.max(1, L.fanIn[sg.name]));
      for (let d = sg.off; d < sg.off + sg.len; d++) v[d] += (d >= biasStart ? MUT_SIG : k) * gauss();
    }
    kids.push(v);
  }
  const rowsK = [];
  for (let i = 0; i < kids.length; i++) {
    const sel = Am.chooserOf(kids[i], TEMP);
    const truth = batchRun(Am, sel, 'frozen'), noise = batchRun(Am, sel, 'loop', GENS);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    rowsK.push({ id: 'kid' + i, truth: mean(truth), noiseMean: mean(noise), noiseSd: Math.sqrt(mean(noise.map((x) => x * x)) - mean(noise) * mean(noise)) });
    if ((i + 1) % 12 === 0) console.log('  …已量 ' + (i + 1) + '/' + kids.length + ' 粒子代');
  }
  inst.restore();
  const tTop = [...rowsK].sort((a, b) => b.truth - a.truth);
  const nTop = [...rowsK].sort((a, b) => b.noiseMean - a.noiseMean);
  const K = Math.max(2, Math.min(TOPK, Math.floor(rowsK.length / 4)));
  const ts = new Set(tTop.slice(0, K).map((r) => r.id)), ns = new Set(nTop.slice(0, K).map((r) => r.id));
  const ov = [...ts].filter((x) => ns.has(x)).length;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rank = (arr) => { const ix = arr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); const o = new Array(arr.length); ix.forEach((p, pos) => { o[p[1]] = pos + 1; }); return o; };
  const rT = rank(rowsK.map((r) => r.truth)), rN = rank(rowsK.map((r) => r.noiseMean));
  const N = rowsK.length; let dsum = 0;
  for (let i = 0; i < N; i++) { const d = rT[i] - rN[i]; dsum += d * d; }
  const rhoK = 1 - 6 * dsum / (N * (N * N - 1));
  const spreadK = tTop[0].truth - tTop[N - 1].truth;
  console.log('\n## 一代模拟（父代 ' + P1.replace(/^.*[\\/]/, '') + ' ‖ σ=' + MUT_SIG + ' ‖ ' + N + ' 粒 ‖ 精英取前 ' + K + '）');
  console.log('  子代真值跨度 ' + spreadK.toFixed(3) + '（最好 ' + tTop[0].truth.toFixed(3) + ' ‖ 最差 ' + tTop[N - 1].truth.toFixed(3) + '）‖ 4 局均值的抖动中位 ' +
    [...rowsK].map((r) => r.noiseSd).sort((a, b) => a - b)[Math.floor(N / 2)].toFixed(3));
  console.log('  **ρ(4局, 真值) = ' + rhoK.toFixed(2) + '** ‖ **前 ' + K + ' 重合 ' + ov + '/' + K + '**');
  console.log('  按 4 局挑精英的期望真值 ' + mean(nTop.slice(0, K).map((r) => r.truth)).toFixed(3) +
    ' ‖ 按真值挑 ' + mean(tTop.slice(0, K).map((r) => r.truth)).toFixed(3) + ' ‖ 差 ' +
    (100 * (mean(tTop.slice(0, K).map((r) => r.truth)) - mean(nTop.slice(0, K).map((r) => r.truth)))).toFixed(1) + 'pt（这就是每代白丢的选择预算）');
  process.exit(0);
}
const byTruth = [...rows].sort((a, b) => b.truth - a.truth);
const rankT = new Map(byTruth.map((r, i) => [r.id, i + 1]));
const byNoisy = [...rows].sort((a, b) => b.noiseMean - a.noiseMean);
const rankN = new Map(byNoisy.map((r, i) => [r.id, i + 1]));
/* 秩相关（Spearman）——按"名次之差的平方和"算，不靠任何正态假设 */
const n = rows.length;
let dsum = 0;
for (const r of rows) { const d = rankT.get(r.id) - rankN.get(r.id); dsum += d * d; }
const rho = 1 - 6 * dsum / (n * (n * n - 1));
const topT = new Set(byTruth.slice(0, TOPK).map((r) => r.id));
const topN = new Set(byNoisy.slice(0, TOPK).map((r) => r.id));
const overlap = [...topT].filter((x) => topN.has(x)).length;
const sdNoise = rows.map((r) => r.noiseSd), sdMed = sdNoise.sort((a, b) => a - b)[Math.floor(n / 2)];
const spread = byTruth[0].truth - byTruth[n - 1].truth;

console.log('\n## 逐枚（真值 = ' + (shapeN * 40) + ' 局；一代 = ' + GAMES + ' 局的均值分布）');
console.log('包 ‖ 面 ‖ 真值(' + CUR + ') ‖ 真值SE ‖ 4局均值的中位 ‖ 4局均值sd ‖ ' + GENS + ' 代里最好一代均值 ‖ 真值名次');
for (const r of byTruth) {
  console.log(r.id.padEnd(16) + ' ‖ ' + r.face.padEnd(5) + ' ‖ ' + r.truth.toFixed(3) + ' ‖ ±' + r.sdTruth.toFixed(3) +
    ' ‖ ' + r.noiseMean.toFixed(3) + ' ‖ ' + r.noiseSd.toFixed(3) + ' ‖ ' + r.noiseMax.toFixed(3) + ' ‖ ' + rankT.get(r.id));
}
console.log('\n## 判读（这就是"CEM 每候选 4 局"能不能选对人）');
console.log('  跨包真值**跨度** ' + spread.toFixed(3) + ' ‖ 单包 ' + GAMES + ' 局均值的**抖动** 中位 ' + sdMed.toFixed(3) +
  '（是跨度的 ' + (100 * sdMed / spread).toFixed(0) + '%）‖ **要把抖动压到跨度以下，每候选约需 ' +
  Math.max(GAMES, Math.round(GAMES * (sdMed / spread) * (sdMed / spread))) + ' 局**（= ' + GAMES + ' × (sd/跨度)²，只算量级）');
console.log('  按 ' + GAMES + ' 局均值 vs 按真值：**Spearman ρ=' + rho.toFixed(2) + '** ‖ **前 ' + TOPK + ' 重合 ' + overlap + '/' + TOPK + '**');
console.log('  ⇒ ρ<0.6 或重合 ≤ 一半时，"这臂比那臂强"这类话在 ' + GAMES + ' 局档上**不成立**；劈法实验（SPLIT-*）判的就是换劈法能不能把它救回来。');
