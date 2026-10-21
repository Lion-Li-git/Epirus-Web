#!/usr/bin/env node
/* §E679 量具噪声底之一：**同一粒权重只换 (gen,idx)** ⇒ 读数差多少。
 * 为什么单独量这个：`idx` 是 `T.scoreMemberN` 的入参，每格抽到的桌不同 ⇒ 循环内的"取最优"有一部分是在追 idx，
 * 不是权重变好。10-22 凌晨正是这条把 `probe-cem-arm.mjs --degenerate=1` 那条旧自证打回的（旧写法拿 `max(fit)` 比起点，
 * 等于把"两臂同源"错写成"fit 与 idx 无关"）。
 * 用法：node tools/probe-idx-spread.mjs [--games=6] [--n=3] [--cells=8] [--trainMode=multi] [--pack=<某个 pack-*.js>]
 *        （不给 --pack 就用起点夹具；给一个产物包就是"这粒的噪声底"） */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'n', 'cells', 'trainMode', 'pack'], 'probe-idx-spread');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const G = Number(arg('games', 6)), N = Number(arg('n', 3)), CELLS = Number(arg('cells', 8));
const MODE = arg('trainMode', 'multi'), PACK = arg('pack', '');
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
if (T.setTrainMode) T.setTrainMode(MODE);
if (T.trainMode && T.trainMode() !== MODE) { console.error('⛔ 桌形没生效'); process.exit(2); }
const raw = PACK ? loadChamp(W, PACK) : loadChamp(W, 'docs/artifacts/eval-out/win-Ldemo.bak');
if (!raw || raw.length !== P.paramCount()) { console.error('⛔ 包读不出/维度不符：' + (PACK || '起点夹具')); process.exit(2); }
const REF = Float64Array.from(raw);
for (const gm of [G, 30]) {
  const xs = [];
  for (let idx = 0; idx < CELLS; idx++) { const opps = T.buildOpps(REF, 0.05); xs.push(T.scoreMemberN(REF, opps, gm, N, 0, idx, 0).fit); }
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  console.log((PACK ? '指定包' : '起点夹具') + ' ‖ ' + MODE + ' ‖ n=' + N + ' ‖ games=' + gm + ' ‖ 同一粒只换 idx(' + CELLS + ' 格)' +
    ' ⇒ 均值 ' + m.toFixed(4) + ' ‖ SD ' + sd.toFixed(4) + ' ‖ 极差 ' + (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(4));
}
console.log('对照：同格重复（idx=0 跑两遍）逐字相同? ' +
  (T.scoreMemberN(REF, T.buildOpps(REF, 0.05), G, N, 0, 0, 0).fit === T.scoreMemberN(REF, T.buildOpps(REF, 0.05), G, N, 0, 0, 0).fit));
