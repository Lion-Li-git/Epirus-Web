/* D13 取证尺（夜班 P3 续）：这条腿今天有两处"上游说了算"的地方，逐个量。
 *
 *   ① **装配顺序**：`tools/gates/train-table.mjs:373` 的 `p = Pol.makePolicy(0.25)` 写在
 *      `Pol.setRng(...)`（:377）**之前**，而 `makePolicy` 里逐位读的是 `randn()` → 模块级 `__rng`
 *      （`js/train/policy.js:465-476,877`）⇒ 这个 `p` 是从 **`Math.random`** 抽的（每次跑门都换一个）。
 *      断言只看相对量 ⇒ 不必然红，但"它今天测的是哪副权重"是不可复现的。
 *   ② **旋钮泄漏**：`js/train/evo.js:2359` `wallReject = (wallDmg != null && wallDmg < 0.5)`，
 *      而 `wallDmg` 只在 `WALL_FILTER_ON` 为真时算 ⇒ 出厂关着恒 false；但只要同一进程里前一条腿
 *      开了 `wallFilter` 没复位，`fit` 就变成 **−5.0 短路**，"fit = 各加项之和"这条契约**必然**不成立
 *      （D15 今晚的红就是这个形状，只不过它当时缺的是 `seatPen`）。
 *
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/d13-leak.mjs [--draws=40]
 * 只读：不写盘。逐条照抄门里的调用序列（scoreMemberN(p, opps, 2,3,1,0,0)）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots, Pol = sb.window.EpirusPolicy;

const opps = [{ name: 'random', sel: Bots.pickRandom }];
const styleOpps = [{ name: 'defend', sel: Bots.pickDefend }];

/* 门里那条恒等式（train-table.mjs:393）逐字搬过来，只用来判"会不会红"，不改判据 */
function resid(r) {
  return Math.abs((r.fit - r.fitNoDiv) - (r.divBonus + 0.5 * r.styleRate
    - (r.seatPen || 0) + (r.shapeBonus || 0) + (r.gBonus || 0)));
}

/* ⚑ 第一版在这里埋了自己的坑：泄漏档是"调用 runD13 之前 setEconomyReward({wallFilter:true})"，
 *   而 runD13 开头就 reset ⇒ 自己把刚喂的旋钮抹了，③ 那格打印出来的 fit=0.85 与"−5.0 短路"自相矛盾，
 *   就是这个矛盾暴露的。⇒ 泄漏必须在 reset **之后**喂（这才对应门里的真实顺序：前一条腿设、下一条腿跑）。 */
function runD13(makeP, leak) {
  T.setEconomyReward({ reset: true });
  if (leak) T.setEconomyReward(leak);
  const p = makeP();
  T.setStyleSlice(null, 0, 0);
  Pol.setRng(T.mulberry32(777001));
  const a = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  T.setStyleSlice(styleOpps, 0.5, 2);
  Pol.setRng(T.mulberry32(777001));
  const b = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  T.setStyleSlice(null, 0, 0);
  const c = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  return { a, b, c, residB: resid(b), residC: resid(c), addSame: Math.abs(b.fitNoDiv - a.fitNoDiv) < 1e-9 };
}

const ND = Number(arg('draws', 40));
/* 轴①：门里现在的画法（Math.random 抽权重）跑 ND 次，看恒等式红几次 */
let badRand = 0, rejRand = 0, addBad = 0;
for (let i = 0; i < ND; i++) {
  const o = runD13(() => Pol.makePolicy(0.25));
  if (!(o.residB < 1e-9 && o.residC < 1e-9)) badRand++;
  if (o.b.wallReject) rejRand++;
  if (!o.addSame) addBad++;
}
/* 轴②：改成先播种再装配（种子扫 ND 档），看同样的读数稳不稳 */
let badSeed = 0, spread = [];
for (let i = 0; i < ND; i++) {
  const o = runD13(() => { Pol.setRng(T.mulberry32(4242 + i * 7919)); return Pol.makePolicy(0.25); });
  if (!(o.residB < 1e-9 && o.residC < 1e-9)) badSeed++;
  spread.push(o.b.fit);
}
console.log('装载 ' + ND + ' 次/轴 ‖ 门里那条恒等式（残差 < 1e-9 记为绿）');
console.log('① 现状（Math.random 抽权重）：恒等式红 **' + badRand + '/' + ND + '** ‖ wallReject 触发 ' + rejRand + '/' + ND +
  ' ‖ "追加不改池子分"这条红 ' + addBad + '/' + ND);
console.log('② 先播种再装配（' + ND + ' 个种子）：恒等式红 **' + badSeed + '/' + ND + '** ‖ fit 取值 ' +
  (new Set(spread.map(x => x.toFixed(6)))).size + ' 种（>1 ⇒ 断言虽绿但读数随权重变）');

/* 轴③：把"上游没复位"的泄漏喂进去（这才是 D15 今晚的形状），看两条恒等式怎么红 */
const LEAKS = [
  ['wallFilter（破墙硬过滤）', { wallFilter: true, wallGames: 3 }],
  ['divW=0.3（熵奖励开档）', { divW: 0.3 }],
  ['fitGW=0.2（广度罚开档）', { fitGW: 0.2 }],
  ['s4W=0.5（形状项开档）', { s4W: 0.5 }],
];
console.log('③ 泄漏档（前一条腿设了旋钮没复位 ⇒ runD13 开头 reset 之后立刻喂进去，跑一次看残差）：');
for (const [nm, lk] of LEAKS) {
  const o = runD13(() => { Pol.setRng(T.mulberry32(4242)); return Pol.makePolicy(0.25); }, lk);
  const red = !(o.residB < 1e-9 && o.residC < 1e-9) || !o.addSame;
  console.log('   ' + nm + '：fit(b)=' + o.b.fit.toFixed(5) + ' ‖ wallReject=' + o.b.wallReject +
    ' ‖ 残差 b=' + o.residB.toExponential(2) + ' ‖ 残差 c=' + o.residC.toExponential(2) +
    ' ‖ 追加等式 ' + (o.addSame ? '成立' : '**破**') + ' ⇒ ' + (red ? '**门会红**' : '绿'));
}
const base = runD13(() => { Pol.setRng(T.mulberry32(4242)); return Pol.makePolicy(0.25); });
console.log('   （对照）出厂档 + 播种：fit(b)=' + base.b.fit.toFixed(5) + ' ‖ wallReject=' + base.b.wallReject + '（三次调用都是同一副 p）');
