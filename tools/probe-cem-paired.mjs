#!/usr/bin/env node
/* §E679 同格配对复分析（10-22 夜班 · 用**已经在盘上的产物包**，不新开臂）。
 * 要治的病：`idx` 是 `scoreMemberN` 的入参，每格抽到的对手桌不同 ⇒ 同一粒权重只换 idx 就能差出 SD 0.12~0.17
 *   （`tools/probe-idx-spread.mjs` 实测）。批 A–D 的跨臂比都是"各取一格再求均值" ⇒ 那一截算进了差值里。
 * 做法：两包吃**同一批格子** `(gen=999, idx=0..K-1)` + 同一份 `opps`（只建一次），逐格求差后再取均值与 SE
 *   ⇒ 格子共同效应被差分掉，剩下的才是两粒权重的差。这里给的是**方差缩减倍数**，不是新臂的读数。
 * 用法：node tools/probe-cem-paired.mjs --dir=<批次根> [--batches=d] [--trainMode=long] [--n=5] [--games=100] [--cells=12]
 *      （`--games` 是**每格**的局数；批 A–C 用 `--trainMode=multi --n=3`）
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dir', 'batches', 'trainMode', 'n', 'games', 'cells', 'start'], 'probe-cem-paired');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIR = arg('dir', ''), MODE = arg('trainMode', 'long'), N = Number(arg('n', 5));
const HG = Number(arg('games', 100)), CELLS = Number(arg('cells', 12));
const START = arg('start', 'docs/artifacts/eval-out/win-Ldemo.bak');
const BATCHES = String(arg('batches', 'd')).split(',').map(s => s.trim()).filter(Boolean);
if (!DIR) { console.error('⛔ 必须给 --dir=<批次根>'); process.exit(64); }

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
if (T.setTrainMode) T.setTrainMode(MODE);
if (T.trainMode && T.trainMode() !== MODE) { console.error('⛔ 桌形没生效（读到 ' + T.trainMode() + '）'); process.exit(2); }
const REFc = loadChamp(W, START);
if (!REFc || REFc.length !== P.paramCount()) { console.error('⛔ 起点夹具读不出：' + START); process.exit(2); }
const REF = Float64Array.from(REFc);
const OPPS = T.buildOpps(REF, 0.05);            /* 只建一次：格子只由 (gen,idx) 决定 */
const cells = []; for (let i = 0; i < CELLS; i++) cells.push([999, i]);
const one = function (p, gi) { return T.scoreMemberN(p, OPPS, HG, N, gi[0], gi[1], 0); };
const grid = function (p) { return cells.map(function (gi) { const r = one(p, gi); return { fit: r.fit, first: r.firstRate }; }); };
const mean = function (a) { return a.reduce((x, y) => x + y, 0) / a.length; };
const sd = function (a) { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : NaN; };

console.log('同格配对 ‖ trainMode=' + MODE + ' ‖ n=' + N + ' ‖ 每格 ' + HG + ' 局 × ' + CELLS + ' 格 ‖ 场只建一次 ‖ 起点 ' + START);
/* 前置：同一粒在同一格上必须逐字相同，否则"配对"是假的（这不是自反对照 —— 它查的是量具的确定性） */
const gA = grid(REF), gB = grid(REF);
const det = gA.every(function (x, i) { return x.fit === gB[i].fit; });
console.log('前置：起点粒在同一批格子跑两遍 ⇒ 逐字相同? ' + (det ? 'PASS' : 'FAIL'));
if (!det) process.exit(2);
console.log('参考：起点粒自己的逐格 fit SD=' + sd(gA.map(x => x.fit)).toFixed(4) + '（这就是"格子"那一截，配对要把它差分掉）');

for (const b of BATCHES) {
  const dir = DIR + '/' + b;
  if (!existsSync(dir)) { console.log('\n== 批 ' + b + '：目录不在 =='); continue; }
  const packs = {};
  readdirSync(dir).forEach(function (f) {
    const m = /^pack-(ga|cem)-(\d+)\.js$/.exec(f);
    if (!m) return;
    const p = loadChamp(W, dir + '/' + f);
    if (p && p.length === P.paramCount()) packs[m[1] + '-' + m[2]] = Float64Array.from(p);
  });
  const seeds = Array.from(new Set(Object.keys(packs).map(k => k.split('-')[1]))).sort();
  /* 起点一致性：配对场必须用**这批臂自己的起点**建 —— 忘传 `--start` 会安静地拿另一粒建场（10-22 实测踩到）*/
  const armLog = readdirSync(dir).filter(x => /^arm-.*\.log$/.test(x))[0];
  const lbl = armLog ? (/("startLabel":")([^"]+)/.exec(readFileSync(dir + '/' + armLog, 'utf8')) || [])[2] : '';
  if (lbl && lbl.indexOf(START) < 0)
    console.error('  ⛔ 回执的起点是「' + lbl + '」而配对场是用 ' + START + ' 建的 ⇒ 这批的配对差不可解读（请给 --start=<回执里那一枚>）');
  console.log('\n== 批 ' + b + '（产物 ' + Object.keys(packs).length + ' 枚 ‖ seeds ' + seeds.join(',') + '）==');
  const allD = [], allF = [];
  for (const s of seeds) {
    const g = packs['ga-' + s], c = packs['cem-' + s];
    if (!g || !c) { console.log('  seed ' + s + '：配对缺臂 ⇒ 跳过'); continue; }
    const gg = grid(g), gc = grid(c);
    const dFit = gc.map(function (x, i) { return x.fit - gg[i].fit; });
    const dFirst = gc.map(function (x, i) { return 100 * (x.first - gg[i].first); });
    allD.push(mean(dFit)); allF.push(mean(dFirst));
    console.log('  seed' + s + ' ‖ 单粒逐格 SD：GA fit=' + sd(gg.map(x => x.fit)).toFixed(4) +
      ' CEM fit=' + sd(gc.map(x => x.fit)).toFixed(4) +
      ' ‖ 配对 Δfit 均值=' + mean(dFit).toFixed(4) + ' SE=' + (sd(dFit) / Math.sqrt(CELLS)).toFixed(4) +
      ' ‖ 配对 Δ夺1=' + mean(dFirst).toFixed(2) + 'pt SE=' + (sd(dFirst) / Math.sqrt(CELLS)).toFixed(2));
  }
  if (allD.length) {
    const m = mean(allD), s = sd(allD), se = s / Math.sqrt(allD.length);
    console.log('  ⇒ 跨 seed 汇总 Δfit 均值=' + m.toFixed(4) + ' SE=' + se.toFixed(4) + ' ‖ |均值|/SE=' +
      (Math.abs(m) / se).toFixed(1) + ' ‖ 正号 ' + allD.filter(x => x > 0).length + '/' + allD.length +
      '（Δ夺1 均值=' + mean(allF).toFixed(2) + 'pt ‖ 正号 ' + allF.filter(x => x > 0).length + '/' + allF.length + '）');
    console.log('  ⚠ 这一批的所有对都从同一个 --start（' + START + '）热启动 ⇒ 起点自由度 = 1；' +
      '格子只缩仪器误差，跨批合并才算第二个起点（每批各自的固定场不同，不许并排比数值）。');
  }
}
