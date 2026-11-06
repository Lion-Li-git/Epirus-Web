/* 信念搜索(B1/B2)吃的是哪台打分器？—— `js/train/evo.js:1296/1319/1321` 调的是 `P.value(...)`，
 * 而 arch2 的 install **没有**覆盖 `value` ⇒ 若把 2.0 张量喂进信念搜索，它会拿 **v7 的偏移**去切 2.0 的权重。
 * 这条不是读代码读出来的结论，要量：同一个 (局面, 候选) 集合上，
 *   ρ( `P.value` 的分数 , 该张量**自己那台网络**的 logits ) —— v7 应当高（value 就是它的排序），2.0 若是 ~0/乱 ⇒ 静默错分。
 * 原件 scratch/qoder-1030-belief-scorer.mjs */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { collectFixtures } from '../tools/proto2/head-health.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;

function rank(xs) { const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); idx.forEach((p, k) => { r[p[1]] = k; }); return r; }
function pearson(a, b) { const n = a.length; if (n < 3) return NaN; const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return s / Math.sqrt(sa * sb); }

function sample(label, params, netLogitsFn, fx) {
  const rs = [];
  let cells = 0, finite = 0, nan = 0;
  for (const f of fx) {
    const lg = netLogitsFn(f);   // chooser 真正拿去排序的那一格（v7 只有 probs，2.0 有 logits）
    const vv = f.cands.map((c) => P.value(f.st, f.pid, c.key, params, P.shapeOf(params), c));
    const ok = vv.every((x) => Number.isFinite(x)) && lg.every((x) => Number.isFinite(x));
    if (!ok) { nan += vv.filter((x) => !Number.isFinite(x)).length; }
    finite += vv.filter((x) => Number.isFinite(x)).length;
    cells++;
    rs.push(pearson(rank(vv), rank(lg)));
  }
  const good = rs.filter((x) => Number.isFinite(x));
  console.log('· ' + label + '：' + cells + ' 个决策点 ‖ ρ( P.value , 该张量自己的 logits ) 中位 = '
    + (good.length ? (good.sort((a, b) => a - b)[Math.floor(good.length / 2)]).toFixed(2) : 'n/a')
    + ' ‖ 有限值 ' + finite + '/' + (finite + nan) + (nan ? ' ‖ ⚠ 非有限 ' + nan : ''));
  return good.length ? (good.sort((a, b) => a - b)[Math.floor(good.length / 2)]) : NaN;
}

const fx = collectFixtures(W, { perShape: 6, seed: 20261030 }).fixtures;

/* ---- ① v7 线上冠军（同一枚张量既是 value 的宿主也是排序的宿主 ⇒ ρ 必须高）---- */
const v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
const rv7 = sample('v7 `bundled-champion-3p`', Float64Array.from(v7), (f) => Array.from(P.forwardCands(f.st, f.pid, f.cands, Float64Array.from(v7), { temp: 0.5 }).probs), fx);

/* ---- ② 2.0 包：在装了 arch2 之后，`P.value` 仍走 v7 那台手算器（它没被覆盖）---- */
const raw = readPack2('scratch/arms/CEM48c-s7.bak');
const got = packCfgExit(raw, 'CEM48c-s7');
const A2 = install(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const p2 = P.unpack(raw, true);
const net2 = (f) => Array.from(P.forwardCands(f.st, f.pid, f.cands, p2, { temp: 0.5 }).probs);
const r2value = sample('代 2 包 ‖ P.value（v7 手算器吃 2.0 张量）', p2, net2, fx);
const r2self = sample('代 2 包 ‖ 同一枚张量再走一次自己（正对照，应 = 1.00）', p2, net2, fx);

console.log('\n判读：v7 ρ=' + rv7.toFixed(2) + ' ‖ 2.0 走 P.value ρ=' + r2value.toFixed(2) + ' ‖ 2.0 走自己 ρ=' + r2net.toFixed(2));
console.log(r2value < 0.3 && r2net > 0.9
  ? '⇒ 信念搜索(B1/B2)拿 2.0 张量时用的是**另一台打分器**（v7 手算 value），排序与这枚包自己的判断近乎无关 ⇒ 读数不可信，必须当场拒或改分派'
  : '⇒ 与预期不符（要么 value 已被分派、要么对照坏了），这条判据本身要重看');
A2.restore();
