/* D15 取证尺（夜班 P1）：在多个 RNG 起点下把 `fit` 的六个分量与两条恒等式的残差打出来。
 *
 * 要答的问题（§七 ① 的机制候选能不能变成实测）：
 *   旧式 `fit = fitNoDiv + divBonus + styleWeight·styleRate`（门里断的就是这个，容差 1e-9）
 *   在什么条件下不成立？不成立时缺的是哪一项（seatPen ‖ gBonus  shapeBonus）？
 *   ⇒ 若 `seatPen > 0` 的比例可观，则 D15 是"看 RNG 脸色的运气绿"，红与机器无关。
 *
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/d15-residual.mjs [--seeds=40] [--games=2] [--out=json]
 * 只读：不写盘、不改引擎状态（除了 scoreMemberN 自己要用的 RNG）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };

/* 与 tools/gates/_ctx.mjs:87-100 同一套装载（门里 T/Pol/Bots 就是这么来的 ⇒ 尺与被测同源） */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots, Pol = sb.window.EpirusPolicy;

const NS = Number(arg('seeds', 40)), GAMES = Number(arg('games', 2));
const rows = [];
for (let i = 0; i < NS; i++) {
  const seed = 4242 + i * 7919;
  Pol.setRng(T.mulberry32(seed));
  const p = Pol.makePolicy(0.25);
  const r = T.scoreMemberN(p, [{ name: 'random', sel: Bots.pickRandom }], GAMES, 3, 1, 0, 0);
  const oldSum = r.fitNoDiv + r.divBonus + r.styleWeight * r.styleRate;
  const fullSum = oldSum - (r.seatPen || 0) + (r.gBonus || 0) + (r.shapeBonus || 0);
  rows.push({
    seed, fit: r.fit, fitNoDiv: r.fitNoDiv, divBonus: r.divBonus, style: r.styleWeight * r.styleRate,
    seatPen: r.seatPen || 0, gBonus: r.gBonus || 0, shapeBonus: r.shapeBonus,
    seatMaxPct: r.seatMaxPct, wallReject: !!r.wallReject,
    oldResid: Math.abs(r.fit - oldSum), fullResid: Math.abs(r.fit - fullSum),
  });
}
const n = rows.length;
const bad = rows.filter(x => !(x.oldResid < 1e-9));
const sp = rows.filter(x => x.seatPen > 0);
const gb = rows.filter(x => x.gBonus !== 0);
const worst = rows.slice().sort((a, b) => b.oldResid - a.oldResid)[0];
const badFull = rows.filter(x => !(x.fullResid < 1e-9));

console.log('装载：' + n + ' 个 RNG 起点 ‖ games=' + GAMES + ' ‖ 与门里同一次调用（scoreMemberN(p,[random],' + GAMES + ',3,1,0,0)）');
console.log('① `shapeBonus` 在返回对象里吗：' + (rows[0].shapeBonus === undefined ? '**没有（⇒ 全式断不了，得先暴露）**' : '有'));
console.log('② 旧式（门里断的那条）不成立的起点：**' + bad.length + ' / ' + n + '**（' + (100 * bad.length / n).toFixed(0) + '%）‖ 最大残差 ' + worst.oldResid.toExponential(2) + '（seed=' + worst.seed + '）');
console.log('③ `seatPen > 0` 的起点：' + sp.length + ' / ' + n + '‖ 其中旧式崩掉的 ' + sp.filter(x => !(x.oldResid < 1e-9)).length + ' 个');
console.log('④ `gBonus ≠ 0` 的起点：' + gb.length + ' / ' + n + '（出厂 FIT_G_W=0 ⇒ 期望 0）');
console.log('⑤ 全式仍不成立的起点：**' + badFull.length + ' / ' + n + '**' + (badFull.length ? '（⇒ 还有第四项没被算进去）' : '（⇒ 补上这几项就够）'));
console.log('⑥ seatMaxPct 分布（判"2 局够不够把占比顶到 70%"）：' + rows.map(x => x.seatMaxPct == null ? '—' : Math.round(x.seatMaxPct)).join(' ').slice(0, 220));
console.log('样例（前 6 个起点）：');
for (const x of rows.slice(0, 6)) {
  console.log('  seed=' + x.seed + ' fit=' + x.fit.toFixed(5) + ' ‖ 前三项和=' + (x.fitNoDiv + x.divBonus + x.style).toFixed(5)
    + ' ‖ seatPen=' + x.seatPen.toFixed(5) + ' ‖ gBonus=' + x.gBonus.toFixed(5) + ' ‖ 旧残差=' + x.oldResid.toExponential(1) + (x.oldResid < 1e-9 ? '' : '  ← 门会红'));
}
if (String(arg('out', '')) === 'json') console.log(JSON.stringify(rows));
