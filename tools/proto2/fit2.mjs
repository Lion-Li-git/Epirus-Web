#!/usr/bin/env node
/* fit2.mjs — 把现役 v7 **蒸馏进 2.0 结构**（只拟合最后一层；千问 · 10-29 夜 · §E824b）
 *
 * 为什么做这一格（它同时回答两个卡了今晚的问题）：
 *   ① **容量**：2.0（集合编码 + 双头 + 固定容器）装不装得下现役冠军的策略？
 *      装不下 ⇒ 结构要改（不是训练不够）；装得下 ⇒ "表示换掉了但没丢东西"这条就有了正面证据。
 *   ② **起点**：§E822/§E823 两波臂全部从随机起点跑，因为"v7 夹具包读不进 2.0"。
 *      蒸馏出来的这粒就是 2.0 能吃的**热启动** ⇒ 优化器臂从此可以比"从冠军附近出发谁走得动"。
 *
 * 做法（不做反传，闭式）：2.0 的前向冻结 ⇒ 每个候选拿到一份隐层激活 φ(候选)；
 *   在组内中心化之后对 v7 的 logits 拟**岭回归** w·φ+b（同一批行、同一批组 ⇒ 与 v7 的序对齐才有意义）。
 *   拟合只在**训练半批**上做，读数报在**留出半批**上（同 §E819b 那次"起点分母只有 2 局"的教训 ⇒ 这次先留出）。
 *
 * 用法：node tools/proto2/fit2.mjs [--decisions=1200] [--input=v7|obs3] [--l2=0.01] [--out=scratch/arms/xxx.bak] [--v7=js/bundled-champion-3p.js]
 * 只读 js/**；产物落到 scratch/arms/（不入库、不进冠军槽、不动产品门）。
 */
import { writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, layout } from './arch2.mjs';
import { setAblate, ablateOn, ablatableBlocks } from './obs3.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const NDEC = Math.max(60, Number(arg('decisions', 1200)) || 1200);
const INPUT = arg('input', 'v7') === 'obs3' ? 'obs3' : 'v7';
/* ⭐ `--ablock=C.id,P.opp`（第二十一段"哪几块承重"的账）：**只关 obs3 面的整块**（写成 0，宽度不变）。
 *   三条硬规矩：① 只许 `--input=obs3`（关 v7 面是另一台仪器，别混）；② 块名认错就抛（不许"以为关了其实没关"）；
 *   ③ 开没开必须落进 meta 与打印行 ⇒ 任何引用这条数的人都看得见它关过什么。默认关 = 与旧读数逐字同。 */
const ABLOCK = String(arg('ablock', '')).split(',').map((s) => s.trim()).filter(Boolean);
if (ABLOCK.length && INPUT !== 'obs3') { console.error('⛔ `--ablock` 只作用于 obs3 输入面（`--input=obs3`）⇒ 否则这一路是空操作'); process.exit(2); }
const L2 = Number(arg('l2', 0.01));
const V7 = arg('v7', 'js/bundled-champion-3p.js');
const OUT = arg('out', '');

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState;
if (ABLOCK.length) {
  const ok = new Set(ablatableBlocks(W.EpirusRules));
  const bad = ABLOCK.filter((b) => !ok.has(b));
  if (bad.length) { console.error('⛔ `--ablock` 里这些块名不存在：' + bad.join(',') + ' ⇒ 可用：' + [...ok].join(',')); process.exit(2); }
  setAblate(ABLOCK);
}
/* ⚑ 老规矩：**先**读 v7 参照包（装 2.0 之后 unpack 只认 v:90 ⇒ 会静默读成 null） */
let v7 = loadChamp(W, V7, '');
if (!v7) { console.error('⛔ v7 参照包读不出：' + V7); process.exit(2); }
v7 = Float64Array.from(v7);

const POOL = T.buildOpps(v7, 0.05);
let seed = 20261029;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const fixtures = [];
/* 抓决策点：cloneState 后把 rng 换成独立流（不然抽走母局的随机数，母局后面几步会跟着变 —— 在册条款） */
function capture(state, pid, legal) {
  const cl = S.cloneState(state);
  cl.rng = { next: rnd };
  fixtures.push({ state: cl, pid, legal });
}
function walk(seedBase, n) {
  const choosers = [];
  for (let pid = 0; pid < n; pid++) choosers.push(T.policyChooserN(v7));
  const probe = (state, pid, legal) => {
    if (fixtures.length < NDEC && legal && legal.length >= 2 && (pid % n) === 0) capture(state, pid, legal);
    return POOL[(pid + 1) % POOL.length].sel(state, pid, legal);
  };
  const cs = choosers.slice(); cs[0] = probe;
  T.oneGameN(cs, seedBase, n, { regen: 0, mode: 'multi' });
}
for (let g = 0; fixtures.length < NDEC && g < 900; g++) walk(90000 + g * 13, g % 2 ? 5 : 3);
if (fixtures.length < 60) { console.error('⛔ 只抓到 ' + fixtures.length + ' 个决策 ⇒ 蒸馏不做（分母不足）'); process.exit(2); }

const A = installArch2(W, { mutMode: 'seg', input: INPUT === 'obs3' ? 'obs3' : undefined });
A.rngRef.r = rnd;
const L = layout({ input: INPUT === 'obs3' ? 'obs3' : 'v7', skills: W.EpirusRules.skills.length });
const start = Float64Array.from(P.makePolicy(0.25));
const cut = Math.floor(fixtures.length / 2);
const fit = A.distillHead(fixtures.slice(0, cut), start, { v7, l2: L2 });
if (!fit.ok) { console.error('⛔ 蒸馏失败：' + fit.why); process.exit(2); }

/* 留出半批上的读数（自己算，不再调 distillHead ⇒ 不会把测试集喂回拟合） */
const test = fixtures.slice(cut);
let hit = 0, rhoN = 0, rhoD = 0, nT = 0, flat = 0, pairOk = 0, pairTot = 0;
for (const fx of test) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || cands.length < 2) continue;
  const mine = P.forwardCands(fx.state, fx.pid, cands, fit.params, { temp: 0.5 }).logits;
  /* 参照分数用**逐候选**的 `P.value`（v7 的 `forward` 只给动作键层的 probs，不能按下标对齐候选 ⇒ 见 arch2 那条注释）
   *   读不出有限值的候选**丢掉但保留这一组**（丢整组会让分母从万级掉到千级，10-29 01:0x 犯过） */
  const keep = [], rv = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i], v = P.value(fx.state, fx.pid, c.key, v7, null, c);   /* ⚑ 第 5 形参是**形状 `sh`**不是 bead ⇒ 传 null；bead 走第 6 形参的 `c`（照 `probe-myopia-regret.mjs:354`） */
    if (Number.isFinite(v)) { keep.push(i); rv.push(v); }
  }
  if (keep.length < 2) continue;
  let a = keep[0], bI = 0;
  const am = mine.reduce((x, y) => x + y, 0) / mine.length, bm = rv.reduce((x, y) => x + y, 0) / rv.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < keep.length; i++) {
    const ci = keep[i];
    if (mine[ci] > mine[a]) a = ci;
    if (rv[i] > rv[bI]) bI = i;
    const dx = mine[ci] - am, dy = rv[i] - bm; sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  nT++; if (a === keep[bI]) hit++;
  if (sxx < 1e-9) flat++;                                  /* 头输出在这组里几乎恒定 ⇒ top-1 是靠下标破号来的，不算学出来 */
  for (let i = 0; i < keep.length; i++) for (let j = i + 1; j < keep.length; j++) {
    const dm = mine[keep[i]] - mine[keep[j]], dr = rv[i] - rv[j];
    if (Math.abs(dm) < 1e-9 || Math.abs(dr) < 1e-9) continue;
    pairTot++; if ((dm > 0) === (dr > 0)) pairOk++;
  }
  /* Pearson 在这里会被一枚大尺度候选压掉（实测：配对序 94% 而 Pearson 0.000）⇒ 改组内**排名**上的相关（尺度无关） */
  const rkArr = (arr) => { const ix = Array.from({ length: arr.length }, (_, i) => i).sort((p, q) => arr[p] - arr[q]); const o = new Array(arr.length); ix.forEach((idx, pos) => { o[idx] = pos + 1; }); return o; };
  if (keep.length >= 3) {
    const mv = keep.map((ci) => mine[ci]);
    const ra = rkArr(mv), rb = rkArr(rv), ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
    let a2 = 0, b2 = 0, c2 = 0;
    for (let i = 0; i < ra.length; i++) { const dx = ra[i] - ma, dy = rb[i] - mb; a2 += dx * dy; b2 += dx * dx; c2 += dy * dy; }
    if (b2 > 1e-12 && c2 > 1e-12) { rhoN += a2 / Math.sqrt(b2 * c2); rhoD++; }
  }
}
const agree = hit / Math.max(1, nT), rho = rhoD ? rhoN / rhoD : 0;
let baseTop1 = 0, bt = 0;
for (const fx of test) { const c = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false }); if (c && c.length >= 2) { bt++; baseTop1 += 1 / c.length; } }
console.log('# 蒸馏 v7 → 2.0（' + (INPUT === 'obs3' ? 'S1o 吃 obs3' : 'S1 吃 v7 切片') + ' ‖ paramCount=' + P.paramCount()
  + '）' + (ablateOn() ? ' ‖⭐ **消融开着**：关掉 ' + ablateOn().join('+') + '（宽度不变，那几块全写 0）' : ''));
console.log('  决策 ' + fixtures.length + ' ‖ 拟合用前 ' + cut + ' ‖ **留出后 ' + (fixtures.length - cut) + '**（' + nT + ' 组有 ≥2 候选）');
console.log('  拟合行数 ' + fit.rows + ' ‖ 组内 top-1 与 v7 一致率（留出）= ' + (100 * agree).toFixed(1) + '% ‖ 随机该是 ' + (100 * baseTop1 / Math.max(1, bt)).toFixed(1) + '%');
const pairRate = pairTot ? pairOk / pairTot : 0;
console.log('  组内 logits 秩相关（留出，均值）= ' + rho.toFixed(3) + ' ‖ **配对序一致率 = ' + (100 * pairRate).toFixed(1) + '%**（0.5 = 没有信息；分母 ' + pairTot + ' 对）');
console.log('  ⚑ 头输出恒定的组（这类 top-1 是靠下标破号蒙的，不算学出来）：' + flat + '/' + nT);
const verdict = (pairRate > 0.85 && agree > 0.8) ? '⇒ **装得下**：冻结上游 + 一层线性头就能复现现役冠军的组内序 ⇒ 结构没丢东西，热启动可用'
  : (pairRate > 0.62 ? '⇒ **部分装得下**（配对序一致 ' + (100 * pairRate).toFixed(1) + '%）：容量在，但"只拟合最后一层"不够 ⇒ 蒸馏要连隐层一起训'
    : '⇒ **这一层装不下**（配对序一致 ' + (100 * pairRate).toFixed(1) + '% ≈ 瞎猜）：冻结的随机投影没保留 v7 排序所依赖的方向 ⇒ 不能拿这粒当热启动');
console.log('  ' + verdict);
const out = OUT || ('scratch/arms/' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '-distill-' + (INPUT === 'obs3' ? 'S1o' : 'S1') + '.bak');
writeFileSync(out, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(fit.params)) + ';\n');
writeFileSync(out + '.meta.json', JSON.stringify({ tool: 'fit2', input: INPUT, decisions: fixtures.length, fitOn: cut, holdout: fixtures.length - cut, rows: fit.rows, top1Agree: agree, meanRho: rho, randomBase: baseTop1 / Math.max(1, bt), l2: L2, paramCount: P.paramCount(), v7ref: V7 }, null, 1));
console.log('  产物 ' + out + ' ‖ ' + out + '.meta.json');
