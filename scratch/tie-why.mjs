#!/usr/bin/env node
/* scratch/tie-why.mjs — "并列集合恒等于 3"是**训练的结果**还是**结构读不到那一位**？
 * 做法：抓几个真实中局决策点，把整张候选表逐枚打分打印（键/目标/target2/珠/logits），看并列的是哪些枚。
 * 对照三种粒：①随机起点（`makePolicy`）②B8（rollout 货币那批）③R1（修好标签后的蒸馏批，它的并列实测 1.03）。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
import { encode as obs3Encode } from '../tools/proto2/obs3.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay;
let v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const POOL = (function () { const real = Math.random; try { Math.random = T.mulberry32(20261029); return T.buildOpps(v7, 0.05); } finally { Math.random = real; } })();

function fixture(seedVal, seat, minRound) {
  let cap = null;
  const probe = (state, pid, legal) => {
    if (pid === seat && legal && legal.length && state.round >= (minRound || 1)) cap = cap || { state: S.cloneState(state), pid, legal };
    return POOL[0].sel(state, pid, legal);
  };
  const choosers = [];
  for (let pid = 0; pid < 5; pid++) choosers.push(pid === seat ? probe : POOL[(pid + 1) % POOL.length].sel);
  T.oneGameN(choosers, seedVal, 5, { regen: 0, mode: 'multi' });
  return cap;
}
const PACKS = [
  ['随机起点', null],
  ['B8-fx', 'scratch/arms/B8-fx-S1.bak'],
  ['R1-v7fix', 'scratch/arms/R1-v7fix-S1.bak'],
  ['N2-fx-S1o', 'scratch/arms/N2-fx-S1o.bak'],      /* obs3 输入面：特征面 0 撞车 ⇒ 它的并列只能来自"权重没用那几维" */
];
for (const [tag, path] of PACKS) {
  let cfg = { mutMode: 'seg' }, head = null, raw = null;
  if (path) {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
    cfg = { mutMode: 'seg', ...(raw.dims || {}) };
    if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
  }
  const A = installArch2(W, cfg);
  head = path ? Float64Array.from(P.unpack(raw, true)) : Float64Array.from(P.makePolicy(0.25));
  console.log('\n# ' + tag + ' ‖ 参数 ' + head.length + ' ‖ 结构 ' + (cfg.input === 'obs3' ? 'S1o' : 'S1'));
  for (const [fxn, sd, seat] of [[1, 777, 0], [2, 991, 1], [3, 1301, 2], [4, 1607, 0]]) {
    const fx = fixture(sd, seat, fxn === 4 ? 6 : 1);
    if (!fx) { console.log('  夹具 ' + fxn + ' 没抓到决策点'); continue; }
    const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
    const f = P.forwardCands(fx.state, fx.pid, cands, head, { temp: 0.001 });
    const v7v = cands.map((c) => P.value(fx.state, fx.pid, c.key, v7, null, c));
    const mx = Math.max(...f.logits);
    const tied = [];
    for (let i = 0; i < cands.length; i++) if (Math.abs(f.logits[i] - mx) < 1e-9) tied.push(i);
    const vmx = Math.max(...v7v);
    const vtied = [];
    for (let i = 0; i < cands.length; i++) if (Math.abs(v7v[i] - vmx) < 1e-9) vtied.push(i);
    console.log('  夹具 ' + fxn + '（seed=' + sd + ' 席 ' + fx.pid + ' 第 ' + fx.state.round + ' 回合）‖ 候选 ' + cands.length
      + ' 枚 ‖ 本粒最大并列 **' + tied.length + '** ‖ v7 自己的最大并列 ' + vtied.length);
    const order = cands.map((c, i) => i).sort((a, b) => f.logits[b] - f.logits[a]).slice(0, Math.max(6, tied.length + 2));
    for (const i of order) {
      const c = cands[i];
      /* obs3 的逐候选特征：拿它与"并列里另一枚"的**不同维数**，判"并列是特征相同（结构读不到）还是分数相同（头没学开）" */
      let difTxt = '';
      if (tied.length > 1) {
        const other = tied.find((j) => j !== i);
        if (other != null) {
          const a = obs3Encode(W, fx.state, fx.pid, c), b = obs3Encode(W, fx.state, fx.pid, cands[other]);
          let d = 0; for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > 1e-12) d++;
          difTxt = ' ‖ 与并列另一枚的 obs3 特征差 ' + d + '/' + a.length + ' 维';
        }
      }
      console.log('     ' + (tied.indexOf(i) >= 0 ? '★' : ' ') + (vtied.indexOf(i) >= 0 ? '◎' : ' ') + ' ' + String(c.key).padEnd(11)
        + ' t=' + c.target + (c.target2 == null ? '' : '/' + c.target2) + (c.bead ? ' bead=' + c.bead : '')
        + ' ‖ 本粒 logit ' + f.logits[i].toFixed(9) + ' ‖ v7 分 ' + (Number.isFinite(v7v[i]) ? v7v[i].toFixed(3) : 'NaN') + difTxt);
    }
  }
  A.restore();
}

/* ===== 追加一格：并列到底是"特征相同"还是"分数恰好相同"（死维度那一问的直接答案）===== */
console.log('\n# 逐候选特征面（同一决策、三枚无目标防御技）‖ 走 v7 原版 `P.actionFeatures`');
{
  const fx = fixture(777, 0, 1);
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  const vec = {};
  for (const c of cands) vec[c.key] = Array.from(P.actionFeatures(fx.state, fx.pid, c.key, c)).map((x) => Number(x).toFixed(4));
  const keysO = Object.keys(vec);
  for (const k of keysO) console.log('  ' + k.padEnd(10) + ' ‖ 非零维 ' + vec[k].filter((x) => x !== '0.0000').length + '/' + vec[k].length + ' ‖ ' + vec[k].filter((x) => x !== '0.0000').join(','));
  for (let i = 0; i < keysO.length; i++) for (let j = i + 1; j < keysO.length; j++) {
    let d = 0; for (let k = 0; k < vec[keysO[i]].length; k++) if (vec[keysO[i]][k] !== vec[keysO[j]][k]) d++;
    if (d === 0) console.log('  ⛔ **特征逐维全等**：`' + keysO[i] + '` ≡ `' + keysO[j] + '` ⇒ 任何只吃这 22 维的头**在构造上**就分不开这两手（不是训练没学好）');
    else console.log('  · `' + keysO[i] + '` vs `' + keysO[j] + '` 差 ' + d + ' 维');
  }
}

/* ===== 全表扫一遍：`actionFeatures` 这一面把多少枚候选压成同一格（S1 的死维度账），
 *         并拿 obs3 的逐候选编码当对照（它带技能 one-hot ⇒ 应当把等价类拆开）。===== */
console.log('\n# 等价类扫描（同一决策点上的整张候选表）');
for (const [nm, sd, seat, mr] of [['第 1 回合', 777, 0, 1], ['第 6 回合（宽表）', 1607, 0, 6], ['第 9 回合（宽表）', 2203, 1, 9]]) {
  const fx = fixture(sd, seat, mr);
  if (!fx) { console.log('  ' + nm + ' ‖ 没抓到'); continue; }
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  const cls = {}, cls3 = {};
  const idOf = (c) => c.key + '/t' + c.target + (c.target2 == null ? '' : ':' + c.target2) + (c.bead ? '/' + c.bead : '');
  for (const c of cands) {
    const a = Array.from(P.actionFeatures(fx.state, fx.pid, c.key, c)).map((x) => Number(x).toFixed(4)).join(',');
    (cls[a] || (cls[a] = [])).push(idOf(c));
    const b = Array.from(obs3Encode(W, fx.state, fx.pid, c)).map((x) => Number(x).toFixed(4)).join(',');
    (cls3[b] || (cls3[b] = [])).push(idOf(c));
  }
  const big = Object.values(cls).filter((v) => v.length > 1);
  const big3 = Object.values(cls3).filter((v) => v.length > 1);
  console.log('  ' + nm + ' ‖ 候选 ' + cands.length + ' 枚 ‖ **v7 那 22 维**的等价类：' + cands.length + ' 枚 → ' + Object.keys(cls).length + ' 格'
    + '（最大一格 ' + Math.max(...Object.values(cls).map((v) => v.length)) + ' 枚 ‖ 撞车组 ' + big.length + ' 组）');
  big.slice(0, 4).forEach((v) => console.log('     · 22 维撞车：' + v.join('  ‖ ')));
  console.log('     ⇒ 对照 obs3 的 ' + (cands.length ? Array.from(obs3Encode(W, fx.state, fx.pid, cands[0])).length : 0) + ' 维编码：' + cands.length + ' 枚 → '
    + Object.keys(cls3).length + ' 格（最大 ' + Math.max(...Object.values(cls3).map((v) => v.length)) + ' 枚 ‖ 撞车组 ' + big3.length + ' 组）');
  big3.slice(0, 3).forEach((v) => console.log('       · obs3 仍撞车：' + v.join('  ‖ ')));
}
