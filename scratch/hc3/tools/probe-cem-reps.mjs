#!/usr/bin/env node
/* §E679 量具噪声底之二：**固定场那把尺的重复读数散布**（报任何 Δfit 之前必须先有这条误差棒）。
 * 与 `probe-idx-spread.mjs` 的区别：那台量"同一粒只换 idx"的单格噪声；这台量**跨臂配对差能不能信**——
 * 同一批对手（`buildOpps(起点夹具)` 只建一次）下，把每个臂的产物用**不同 (gen,idx) 的抽样**量 REPS 遍，
 * 看 fit / 夺1 的 SD。注意这是"换抽样"，不是"同一抽样跑两遍"那种自反对照。
 * 用法：node tools/probe-cem-reps.mjs --dir=<批次根> [--batches=d] [--trainMode=long] [--n=5] [--games=300] [--reps=5] */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dir', 'batches', 'trainMode', 'n', 'games', 'reps'], 'probe-cem-reps');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIR = arg('dir', '');
if (!DIR) { console.error('⛔ 必须给 --dir=<批次根>'); process.exit(64); }
const BATCHES = String(arg('batches', 'd')).split(',').map(s => s.trim()).filter(Boolean);
const MODE = arg('trainMode', 'long'), N = Number(arg('n', 5)), HG = Number(arg('games', 300)), REPS = Number(arg('reps', 5));
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
if (T.setTrainMode) T.setTrainMode(MODE);
if (T.trainMode && T.trainMode() !== MODE) { console.error('⛔ 桌形没生效（读到 ' + T.trainMode() + '）'); process.exit(2); }
const REF = Float64Array.from(loadChamp(W, 'docs/artifacts/eval-out/win-Ldemo.bak'));
const OPPS = T.buildOpps(REF, 0.05);
const reps = []; for (let k = 0; k < REPS; k++) reps.push([900 + k * 13, k]);
const stat = function (arr) {
  const m = arr.reduce((x, y) => x + y, 0) / arr.length;
  const sd = Math.sqrt(arr.reduce((x, y) => x + (y - m) ** 2, 0) / (arr.length - 1));
  return { m: m, sd: sd };
};
const meas = function (p) { return reps.map(function (gi) { const r = T.scoreMemberN(p, OPPS, HG, N, gi[0], gi[1], 0); return { fit: r.fit, first: r.firstRate }; }); };
const row = function (label, p) {
  const ms = meas(p), f = stat(ms.map(x => x.fit)), fr = stat(ms.map(x => x.first));
  console.log(label.padEnd(12) + ' fit 均值=' + f.m.toFixed(4) + ' 单次读数 SD=' + f.sd.toFixed(4) +
    ' ‖ 夺1 均值=' + (100 * fr.m).toFixed(1) + '% SD=' + (100 * fr.sd).toFixed(1) + 'pt ‖ 逐次 fit ' +
    ms.map(x => x.fit.toFixed(3)).join(' '));
};
console.log('固定场 trainMode=' + MODE + ' ‖ n=' + N + ' ‖ 每样本 ' + HG + ' 局 ‖ 场只建一次 ‖ 换的只是 (gen,idx) ⇒ 换抽样不是换尺度');
row('起点夹具', REF);
for (const b of BATCHES) {
  const dir = DIR + '/' + b;
  if (!existsSync(dir)) { console.log('批 ' + b + '：目录不在'); continue; }
  for (const f of readdirSync(dir).filter(x => /^pack-.*\.js$/.test(x)).sort()) {
    const p = loadChamp(W, dir + '/' + f);
    if (p && p.length === P.paramCount()) row(f.replace(/^pack-/, '').replace(/\.js$/, ''), Float64Array.from(p));
  }
}
