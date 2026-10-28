#!/usr/bin/env node
/* §E815（10-28 下午 · 2.0 架构研究尺）**这台机器到底用了几维、它分不分得开候选**：
 *   ① **隐元利用率**：HID 个隐单元里有多少真在激活，以及激活向量的**等效使用维数**（participation ratio）；
 *   ② **组内 vs 组间分解**：同一个决策内部（候选之间）的分数散布 vs 决策之间的分数漂移 ——
 *      现在的结构是**标量 Q(s,a)**，而状态段在同一决策内对所有候选**逐字相同**（`js/train/policy.js:512-527`
 *      的 `statePre` 就是把这个公共项预计算一次）⇒「状态那 213 维买到了多少组内判别力」必须**实测**；
 *   ③ **反事实**：把状态段置零 / 把动作段置零，看**组内 top-1 换不换** —— 把"它在看局面"与
 *      "它在看哪类卡普遍划算"分开。
 * 在册关系：§E197 量的是"在线性头上重学权重能兑现上限几成"（净 8.4%‖10.0%），§E198 量的是
 *   "给线性头加动作×情景交互基"（净增 +0.10±2.02 = 零）⇒ **两把都没量网络本身**。这把补的就是那一格。
 * 三条自证（少一条读数不能引）：
 *   · **逐位对账**：本脚本自己算的 v 必须与引擎 `EpirusPolicy.value` 在同一 (state,pid,key,cand) 上
 *     **逐位相同**，不一致的格数必须为 0（加法顺序照 `policy.js:494-502`：先状态、后动作、最后 b1）。
 *   · **同形对照**：同一枚包同一批种子跑第二遍 ⇒ 所有统计量逐位相同，否则 `exit 8`。
 *   · **有牙对照**：随机权重包（`makePolicy(0.2)`）必须比真包**更**依赖状态段 —— 若随机包也不看状态，
 *     那是尺瞎，不是包瞎（`--control=1`）。
 * ⚠ 口径条款（引用时必须带上）：候选表取 `P.candidatesFor(state,pid,legalActions)`，**不含** chooser 内部的
 *   `lockTarget` 变体与 `BIGT_PUSH` 短路（`js/train/evo.js:933-960`）⇒ 量的是"静态候选表上的判别力"，
 *   不是"出厂形状实际走到的那条手"。
 * ⚠ 桌形是**换分布不是换样本量**（`MULTI_ONLY` 三张按存活人数过滤、4 血把血量特征整段平移，
 *   见 `tools/probe-state-blindspots.mjs:22-24`）⇒ 不同 (n,mode) 的读数不许并排当同一条轴读。
 * 用法：node tools/probe-hidden-usage.mjs [--pack=<包>] [--games=40] [--seats=3,5] [--modes=multi,long] [--control=1]
 * 只读 `js/**` 与指定包，不改引擎、不加门、不动冠军槽。
 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'games', 'seats', 'modes', 'control'], 'probe-hidden-usage');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 40));
const SEATS = String(arg('seats', '3,5')).split(',').map(Number);
const MODES = String(arg('modes', 'multi,long')).split(',');
const WITH_CONTROL = String(arg('control', '')) === '1';   /* 走同一个 arg() 读取口登记这个开关（D218 按源码文本抽名字，注释里也不要写成形如两个引号夹旗标的那种字面量） */

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay;
const HID = P.HID, FN = P.FEAT_N, FS = P.FEAT_S, FA = P.FEAT_A, PC = P.paramCount();
if (T.setTrainMode) T.setTrainMode('multi');

function paramsOf(path) {
  const c = loadChamp(W, path);
  if (!c || c.length !== PC) { console.error('⛔ 包读不出/维度不符：' + path); process.exit(2); }
  return Float64Array.from(c);
}
const fresh = () => ({
  evals: 0, groups: 0, cands: 0, mism: 0,
  act: new Float64Array(HID), sumH: new Float64Array(HID),
  cov: new Float64Array(HID * HID),
  winSq: 0, gmSum: 0, gmSq: 0, flipS: 0, flipA: 0
});
const prOf = (cov) => {
  let tr = 0, tr2 = 0;
  for (let j = 0; j < HID; j++) tr += cov[j * HID + j];
  for (let i = 0; i < HID; i++) for (let j = 0; j < HID; j++) { const q = cov[i * HID + j]; tr2 += q * q; }
  return tr2 > 0 ? (tr * tr) / tr2 : 0;
};

/* 复刻引擎前向（h0 = 状态段，逐候选补动作段），并留着 af 供反事实用 */
function groupOf(st, pid, cands, params, sh) {
  const x = P.featuresV7(st, pid);
  const B1 = HID * FN, W2 = B1 + HID;
  const h0 = new Float64Array(HID);
  for (let j = 0; j < HID; j++) {
    let s = 0; const base = j * FN;
    for (let i = 0; i < FS; i++) s += params[base + i] * x[i];
    h0[j] = s;
  }
  const out = [];
  for (const cd of cands) {
    const af = P.actionFeatures(st, pid, cd.key, cd);
    const r = { h0, af, params, sh, W2, B1, h: new Float64Array(HID), v: 0 };
    let v = params[W2 + HID];
    for (let j = 0; j < HID; j++) {
      let s = h0[j]; const base = j * FN + FS;
      for (let k = 0; k < FA; k++) s += params[base + k] * (k < af.length ? af[k] : 0);
      s += params[B1 + j];
      r.h[j] = s > 0 ? s : 0;
      v += params[W2 + j] * r.h[j];
    }
    r.v = v; out.push(r);
  }
  return out;
}
/* 反事实：useH0=false ⇒ 状态段贡献清零；useAf=false ⇒ 动作段贡献清零 */
function rescore(res, useH0, useAf) {
  return res.map(r => {
    const params = r.params; let v = params[r.W2 + HID];
    for (let j = 0; j < HID; j++) {
      let s = useH0 ? r.h0[j] : 0;
      if (useAf) { const base = j * FN + FS; for (let k = 0; k < FA; k++) s += params[base + k] * (k < r.af.length ? r.af[k] : 0); }
      s += params[r.B1 + j];
      const h = s > 0 ? s : 0;
      v += params[r.W2 + j] * h;
    }
    return v;
  });
}
const argmax = (a) => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };

function measure(params, mode, n) {
  const A = fresh();
  const chooser = T.policyChooserN(params, 0);
  const sh = P.shapeOf(params);
  let broken = 0;
  const wrapped = (st, pid, legal) => {
    if (pid === 0 && !broken) {
      try {
        const cands = P.candidatesFor(st, 0, legal);
        if (cands && cands.length >= 2) {
          const res = groupOf(st, 0, cands, params, sh);
          for (let i = 0; i < res.length; i++) {
            const ref = P.value(st, 0, cands[i].key, params, sh, cands[i]);
            if (ref !== res[i].v) A.mism++;
            A.evals++;
            for (let j = 0; j < HID; j++) {
              if (res[i].h[j] > 0) A.act[j]++;
              A.sumH[j] += res[i].h[j];
              for (let k = 0; k < HID; k++) A.cov[j * HID + k] += res[i].h[j] * res[i].h[k];
            }
          }
          const vs = res.map(r => r.v);
          const gm = vs.reduce((s, v) => s + v, 0) / vs.length;
          let sw = 0; for (const v of vs) sw += (v - gm) * (v - gm);
          A.groups++; A.cands += vs.length; A.winSq += sw / vs.length;
          A.gmSum += gm; A.gmSq += gm * gm;
          if (argmax(rescore(res, false, true)) !== argmax(vs)) A.flipS++;
          if (argmax(rescore(res, true, false)) !== argmax(vs)) A.flipA++;
        }
      } catch (e) { broken++; }
    }
    return chooser(st, pid, legal);
  };
  const seats = []; for (let i = 0; i < n; i++) seats.push(wrapped);   /* `autoGameN` 取的是 `choosers[pid]`（`js/core/play.js:58`）⇒ 必须给**数组**，给单个函数会 undefined ⇒ 全员 null ⇒ 静默 0 样本 */
  for (let s = 1; s <= GAMES; s++) {
    const st = S.createState(mode, { next: T.mulberry32(s * 7919 + 13) }, n);
    try { Play.autoGameN(st, seats); } catch (e) { broken++; }
  }
  if (broken) console.log('    ⚠ 有 ' + broken + ' 次采样中断（异常被吞在这里 ⇒ 分母会缩水，读数要带这一行）');
  return A;
}

function report(A, label) {
  if (!A.evals) { console.error('⛔ ' + label + '：一个候选都没采到 ⇒ **分母为 0 不许打表**（0 与"读不出"同形就是本仓的老病）'); process.exit(2); }
  const e = A.evals || 1, g = A.groups || 1;
  const rate = []; for (let j = 0; j < HID; j++) rate.push(A.act[j] / e);
  const sorted = rate.slice().sort((a, b) => a - b);
  const usedN = rate.filter(x => x > 0.02).length;
  const within = Math.sqrt(A.winSq / g);
  const gmMean = A.gmSum / g, gmSd = Math.sqrt(Math.max(0, A.gmSq / g - gmMean * gmMean));
  const pr = prOf(A.cov);
  /* 中心化后的等效维数（真"用了几个自由度"）：C_c = E[h hᵀ] − m mᵀ。⚠ 上面那个 prOf 吃的是**非中心化**二阶矩
   *   ⇒ ReLU 全正 + 共享状态段会让它天然贴近 1（读的是"公共方向占多大"，不是"用了几维"）——两个都要印，别混。 */
  const cc = new Float64Array(HID * HID);
  for (let j = 0; j < HID; j++) { const m1 = A.sumH[j] / e; for (let k = 0; k < HID; k++) cc[j * HID + k] = A.cov[j * HID + k] / e - m1 * (A.sumH[k] / e); }
  const prC = prOf(cc);
  console.log('  ' + label);
  console.log('    评估 ' + A.evals + ' 个候选 ‖ 决策组 ' + A.groups + ' ‖ 平均候选/组 ' + (A.cands / g).toFixed(1)
    + ' ‖ 与引擎 value 逐位不一致 = ' + A.mism + (A.mism ? ' ⇒ ⛔ **对账失败，本行不许引**' : '（✓ 对账通过）'));
  console.log('    隐元激活率：min ' + (sorted[0] * 100).toFixed(1) + '% ‖ 中位 ' + (sorted[HID >> 1] * 100).toFixed(1)
    + '% ‖ max ' + (sorted[HID - 1] * 100).toFixed(1) + '% ‖ **激活>2% 的单元 ' + usedN + '/' + HID + '**');
  console.log('    等效使用维数：中心化后（真用了几个自由度）= **' + prC.toFixed(2) + '/' + HID + '**'
    + ' ‖ 非中心化（公共方向占比的倒数）= ' + pr.toFixed(2) + '/24');
  console.log('    组内分数极差(均 σ) ' + within.toFixed(3) + ' ‖ 决策间均值 σ ' + gmSd.toFixed(3)
    + ' ‖ **组内/组间 = ' + (within / (gmSd || 1e-9)).toFixed(2) + '**');
  console.log('    反事实：**状态段置零 ⇒ 组内 top-1 换手 ' + (A.flipS / g * 100).toFixed(1) + '%**'
    + ' ‖ 动作段置零 ⇒ 换手 ' + (A.flipA / g * 100).toFixed(1) + '%');
  return { usedN, pr, within, gmSd, flipS: A.flipS / g, flipA: A.flipA / g, mism: A.mism, evals: A.evals };
}

console.log('# 隐元利用率与组内判别力（§E815 · 架构研究尺，只读）');
console.log('# FEAT_S=' + FS + ' ‖ FEAT_A=' + FA + ' ‖ FEAT_N=' + FN + ' ‖ HID=' + HID + ' ‖ paramCount=' + PC);
const params = paramsOf(PACK);
const rows = [];
for (const mode of MODES) for (const n of SEATS) {
  console.log('\n=== 桌 ' + mode + ' · n=' + n + ' ‖ 包 ' + PACK + ' ===');
  const A = measure(params, mode, n, false);
  const r = report(A, '被测包'); rows.push({ mode, n, pack: PACK, ...r });
  const A2 = measure(params, mode, n, true);
  const same = A2.cov.every((v, i) => v === A.cov[i]) && A2.flipS === A.flipS && A2.evals === A.evals;
  console.log('    同形对照（同种子第二遍）统计量逐位相同 = ' + (same ? '✓' : '⛔ 尺不可复现'));
  if (!same) process.exit(8);
}
if (WITH_CONTROL) {
  /* ⚠ 第一版把"有牙"写成了「随机包必须比真包更看状态」——**那条前提是错的**：随机网络没有任何理由
   *   用状态排序，而实测真包 54% 换手、随机包 8% ⇒ 尺没坏，是我的判据方向反了（同族教训见
   *   [[feedback-read-the-rulers-own-clauses]]：量程与判据要**实测**，不能从"应当如此"推）。
   *   ⇒ 换成**已知答案的构造对照**：把真包的**状态段权重清零**（`params[0..FS*HID)`），
   *     这台机器**在构造上**就不可能看状态 ⇒ 尺必须读出 flipS ≈ 0。读不出 0 才是尺瞎。 */
  console.log('\n=== 构造对照（已知答案）：把被测包的**状态段权重**清零 ⇒ 它不可能再看状态 ===');
  const blank = Float64Array.from(params); for (let j = 0; j < HID; j++) for (let i = 0; i < FS; i++) blank[j * FN + i] = 0;
  let worst = 0;
  for (const mode of MODES) for (const n of SEATS) {
    const A = measure(blank, mode, n);
    const r = report(A, '状态段清零包 ' + mode + '/n=' + n);
    worst = Math.max(worst, r.flipS);
  }
  console.log('\n  ⚑ 判据：状态段清零后组内换手率最大值 = **' + (worst * 100).toFixed(1) + '%**（应当 ≈ 0）');
  if (worst > 0.05) console.log('  ⛔ 清零包仍换手 >5% ⇒ **这把尺把不该算进排序的东西算进来了**（多半是动作段里混了状态量），读数不许引。');
  else console.log('  ✓ 尺有牙：清零 ⇒ 换手归零 ⇒ "真包 54% 换手"确实是**状态段在驱动排序**，不是尺的假象。');
  console.log('\n=== 参照线（不作判据）：随机权重包 makePolicy(0.2) ===');
  const rnd = [];
  const rp = P.makePolicy(0.2);
  for (const mode of MODES) for (const n of SEATS) {
    const A = measure(rp, mode, n);
    const r = report(A, '随机包 ' + mode + '/n=' + n); rnd.push({ mode, n, pack: 'RANDOM', ...r });
  }
  const mb = (a, k) => a.reduce((s, x) => s + x[k], 0) / (a.length || 1);
  console.log('\n  （参照）随机包状态置零换手 ' + (mb(rnd, 'flipS') * 100).toFixed(1) + '% ‖ 真包见上表'
    + ' ‖ 随机包动作置零换手 ' + (mb(rnd, 'flipA') * 100).toFixed(1) + '%（这条应当是满的：动作段是全 0 时唯一的排序来源）');
}
