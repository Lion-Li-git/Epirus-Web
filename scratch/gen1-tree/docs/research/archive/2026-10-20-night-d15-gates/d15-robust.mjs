/* D15 修法的稳健性自证（夜班 P2 的"坏了会不会红"那一半）。
 * 要证两件事：
 *   ① **上下文无关**：先把 RNG 打到 40 种"上游状态"，再走修好的顺序
 *      （reset 经济档 → 播种 → 造策略 → 评分）⇒ 40 次的 fit 必须**逐位相同**且全式残差 0；
 *   ② **断言有牙**：把全式里任意一项人为挪动（模拟"以后有人给 fit 加了第七项而忘改门"）⇒ 残差必须越线。
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/d15-robust.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots, Pol = sb.window.EpirusPolicy;

function scoreLikeGate() {                       // 与修好的 D15 逐字同序
  T.setEconomyReward({ reset: true });
  Pol.setRng(T.mulberry32(4242));
  const p = Pol.makePolicy(0.25);
  return T.scoreMemberN(p, [{ name: 'random', sel: Bots.pickRandom }], 2, 3, 1, 0, 0);
}
const fullOf = r => r.fitNoDiv + r.divBonus + r.styleWeight * r.styleRate - r.seatPen + r.gBonus;

/* ① 上游状态扰动：先烧掉 k 次随机，模拟"前面某条腿多消耗了 RNG" */
const fits = [], resids = [];
for (let k = 0; k < 40; k++) {
  Pol.setRng(T.mulberry32(1 + k * 104729));
  for (let j = 0; j < k; j++) Math.random(), T.mulberry32(k)();
  const r = scoreLikeGate();
  fits.push(r.fit.toFixed(12)); resids.push(Math.abs(r.fit - fullOf(r)));
}
const uniq = new Set(fits);
const maxResid = Math.max(...resids);
console.log('① 上下文无关：40 种上游 RNG 状态下 fit 的不同取值 = **' + uniq.size + '**（期望 1）‖ 全式最大残差 = ' + maxResid.toExponential(2) + '（门槛 1e-9）');
console.log('   fit = ' + [...uniq].join(' ‖ ') + ' ‖ seatPen=' + scoreLikeGate().seatPen.toFixed(5) + ' ‖ gBonus=' + scoreLikeGate().gBonus.toFixed(5));

/* ② 断言有牙：逐项人为挪 1e-3，残差必须全部越线（否则这条断言是装饰）
 *    ⚠ 出厂 `styleWeight = 0` ⇒ 风格那一项恒 0，**这条断言本来就盖不到风格路径**（不是缺陷，是边界）
 *    ⇒ 风格项单列成"预期无牙"，其余四项必须全抓到。 */
const base = scoreLikeGate();
let bites = 0, tries = 0;
const LIVE = ['fitNoDiv', 'divBonus', 'seatPen', 'gBonus'];
for (const key of LIVE.concat(['styleRate'])) {
  const clone = Object.assign({}, base);
  clone[key] = base[key] + (key === 'seatPen' || key === 'gBonus' ? -1e-3 : 1e-3);
  const resid = Math.abs(base.fit - fullOf(clone));
  const inert = key === 'styleRate';
  tries++; if (resid >= 1e-9) bites++;
  console.log('   变异「' + key + ' 被改了 1e-3」⇒ 残差 ' + resid.toExponential(2)
    + (resid >= 1e-9 ? '  ✅ 会红' : (inert ? '  ⓘ 预期惰性（styleWeight=' + base.styleWeight + ' ⇒ 这一项恒 0，门盖不到风格路径）' : '  ⛔ 看不见（装饰）')));
}
console.log('② 断言有牙：活项抓到 ' + bites + ' / ' + LIVE.length + '（styleRate 属预期惰性，不计）‖ styleWeight 实测 = ' + base.styleWeight);
const okAll = uniq.size === 1 && maxResid < 1e-9 && bites === LIVE.length && base.styleWeight === 0;
console.log(okAll ? '\n✔ 三条都过：与上游状态无关 ‖ 全式残差 0 ‖ 活项变异全被抓到（风格项按出厂档预期惰性）' : '\n✘ 有一条没过 ⇒ 别提交');
process.exit(okAll ? 0 : 1);
