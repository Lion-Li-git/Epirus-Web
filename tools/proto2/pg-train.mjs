#!/usr/bin/env node
/* pg-train.mjs — B 臂：REINFORCE + 行为塑形常驻（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §二B）
 *
 * 对比口径：起点/预算/训练食性 = 千问 CEM 配对批（OB3CH-s7 起、24k 局、arena2 mild cap2 mix0.5、salt=101、
 *   gameSeq 连续 0..N ⇒ 同一批局、同一批对手、同一批座位——CRN 已内建，PG 直接受益）。
 * 更新：每 batch 局一步 Adam；G_t = 终局 scoreNet + 未折扣塑形回报；全局均值基线；优势按批标准化；
 *   策略 = temp 收集温度的两级 softmax（dLogPi，selftest3 腿 C 验过）；tinter/inter>0 拒跑。
 * 塑形（常驻，回应 SUPTUNE 拆链）：λc·1[charge(ok) ∧ 决策时 ep≥3 ∧ 无电珠] + λf·1[railgun(ok)]。
 * 共驾四处（PREREG 口径差异清单）：大雷助推照执行不进梯度；自备 rng 采样；lockTarget:false；收集 temp=0.5。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogPi } from './pg-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['up', 'games', 'batch', 'lr', 'seed', 'lamC', 'lamF', 'temp', 'out', 'tag', 'baseline', 'criticLr', 'probe', 'rollbackTol', 'criticWarm', 'criticProbe', 'ridgeL2', 'ridgeFeat'], 'pg-train');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('up', 'scratch/arms/OB3CH-s7.bak'));
const GAMES = Math.max(1000, Number(arg('games', 24000)) || 24000);
const BATCH = Math.max(8, Number(arg('batch', 48)) || 48);
const LR = Number(arg('lr', 3e-4)) || 3e-4;
const SEED = Number(arg('seed', 7)) || 7;
const LAMC = Number(arg('lamC', 0.005)) || 0;
const LAMF = Number(arg('lamF', 0.05)) || 0;
const TEMP = Number(arg('temp', 0.5)) || 0.5;
const OUT = String(arg('out', 'scratch/arms/PG1-s' + SEED + '.bak'));
const TAG = String(arg('tag', ''));
/* ===== C3（PREREG-2026-10-31-FUNNEL-COVERAGE §二乙）：把 `qHead` 从死区接成状态价值基线 =====
 * `mean`（默认）= 现役常数基线（批内均值），逐字不变；`qhead` = 优势用 G − V(s)，
 *   critic 只训 qHead 那一段（selftest3 腿 G 证：非该段梯度逐位为 0 ⇒ 策略与基线在参数空间正交）。
 * ⚠ 机制量 R² = 1 − Var(G−V)/Var(G−mu) 必须 >0，否则净分再高也不许归因给 AC（预登记条款）。 */
const BASELINE = String(arg('baseline', 'mean'));
if (BASELINE !== 'mean' && BASELINE !== 'qhead' && BASELINE !== 'ridge') { console.error('⛔ --baseline 只认 mean|qhead|ridge（收到 ' + BASELINE + '）'); process.exit(2); }
const CLRP = Number(arg('criticLr', 0.05)) || 0.05;
const PROBE = Math.max(0, Number(arg('probe', 0)) || 0);
const RBTOL = Number(arg('rollbackTol', 0.05)) || 0.05;
const PROBE_TEMP = 0.15;   /* 探针一律按部署温度，与验收同档 */
const PROBE_CAP = arg('criticProbe', '0') === '1' || BASELINE === 'ridge';
const RL2 = Number(arg('ridgeL2', 1e-2)) || 1e-2;   /* 观测侧线性基线的岭系数 */
const RFEAT = String(arg('ridgeFeat', 'obs')) === 'small' ? 'small' : 'obs';   /* 基线读哪套特征：obs=xin 全宽 ‖ small=7 个手挑标量 */

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const pv = Float64Array.from(P.unpack(raw, true));
if (!pv) { console.error('⛔ 起点读不出：' + UP); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: 0.15, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5, wantEvents: 1 });

/* ===== 价值容量探针 `--criticProbe=1`：先问"装得下吗"，再问"训得熟吗" =====
 * 同一批 (状态, return-to-go) 上，用岭回归（闭式解，带 2 折留出）量两种读出的**可达** R²：
 *   hctx = 策略压缩后的 32 维（现役 qHead 的输入）‖ xin = ctx 层的输入（G/私有/序列/池化都在里面，ep·珠·回合是原样字段）
 * ⇒ 若两者都 ≈0，说明"状态价值"根本不在这台网络的线性可达范围里，得改结构而不是调 lr。 */
let GIDS = [];
/* 2 折留出一律**按局**分（同一局的决策进两折 = 泄漏：前一版按决策奇偶切，把 R² 抬到 0.279） */
function ridgeR2(X, y, l2) {
  const n = y.length, m = X[0].length;
  const mu = y.reduce((a, c) => a + c, 0) / n;
  const solve = (idx) => {
    const A = new Float64Array((m + 1) * (m + 1)), rhs = new Float64Array(m + 1);
    for (const i of idx) {
      const xi = X[i], yi = y[i] - mu;
      for (let a = 0; a <= m; a++) {
        const va = a === m ? 1 : xi[a];
        rhs[a] += va * yi;
        for (let b = a; b <= m; b++) {
          const vb = b === m ? 1 : xi[b];
          A[a * (m + 1) + b] += va * vb;
        }
      }
    }
    for (let a = 0; a <= m; a++) A[a * (m + 1) + a] += l2;
    for (let i = 0; i <= m; i++) {
      for (let j = i + 1; j <= m; j++) A[j * (m + 1) + i] = A[i * (m + 1) + j];
    }
    for (let col = 0; col <= m; col++) {
      let piv = col;
      for (let r = col + 1; r <= m; r++) if (Math.abs(A[r * (m + 1) + col]) > Math.abs(A[piv * (m + 1) + col])) piv = r;
      if (Math.abs(A[piv * (m + 1) + col]) < 1e-12) continue;
      if (piv !== col) {
        for (let k = 0; k <= m; k++) { const t = A[col * (m + 1) + k]; A[col * (m + 1) + k] = A[piv * (m + 1) + k]; A[piv * (m + 1) + k] = t; }
        const t2 = rhs[col]; rhs[col] = rhs[piv]; rhs[piv] = t2;
      }
      for (let r = col + 1; r <= m; r++) {
        const f = A[r * (m + 1) + col] / A[col * (m + 1) + col];
        if (!f) continue;
        for (let k = col; k <= m; k++) A[r * (m + 1) + k] -= f * A[col * (m + 1) + k];
        rhs[r] -= f * rhs[col];
      }
    }
    const w = new Float64Array(m + 1);
    for (let row = m; row >= 0; row--) {
      let acc = rhs[row];
      for (let k = row + 1; k <= m; k++) acc -= A[row * (m + 1) + k] * w[k];
      w[row] = Math.abs(A[row * (m + 1) + row]) < 1e-12 ? 0 : acc / A[row * (m + 1) + row];
    }
    return w;
  };
  const idx = X.map((v, i) => i);
  const folds = idx.filter((i) => (GIDS[i] & 1) === 0), folds2 = idx.filter((i) => (GIDS[i] & 1) === 1);
  let ssRes = 0, ssTot = 0;
  for (let f = 0; f < 2; f++) {
    const tr = (f === 0 ? folds : folds2), te = (f === 0 ? folds2 : folds);
    const w = solve(tr);
    for (const i of te) {
      let v = w[m];
      for (let a = 0; a < m; a++) v += w[a] * X[i][a];
      ssRes += (y[i] - mu - v) * (y[i] - mu - v);
    }
  }
  for (const yi of y) ssTot += (yi - mu) * (yi - mu);
  return ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
}
function valueCapacity(A2, P, ly, samples) {
  const list = [];
  for (const g of samples) for (const d of g.ds) if (!d.push && d.xinArr && d.feat) list.push({ x: d.xinArr, f: d.feat, G: d.G, gid: d.gid });
  if (list.length < 200) { console.log('  ⚑ 容量探针：样本 ' + list.length + ' 不足 200 ⇒ 不读'); return; }
  const y = list.map((r) => r.G);
  GIDS = list.map((r) => r.gid);
  const nG = new Set(GIDS).size;
  const gX = ridgeR2(list.map((r) => r.x), y, 1e-2);
  const gF = ridgeR2(list.map((r) => r.f), y, 1e-2);
  console.log('  ⚑ 价值容量（岭回归**按局** 2 折留出 R²，n=' + list.length + ' ‖ 局=' + nG + '）：读 xin(' + list[0].x.length +
    ' 维) = ' + gX.toFixed(3) + ' ‖ 读手挑 7 标量 = ' + gF.toFixed(3));
  return { gX, gF };
}

const CAP = [];
/* ===== 观测侧线性基线 `--baseline=ridge`（10-31 深夜）=====
 * 为什么要单独问容量：按局切的 2 折实测 —— 读 xin(134 维) = −0.447（48 局/批的样本量撑不起 134 个参数，过拟合到比常数还差）
 *   ‖ 读手挑 7 标量 = +0.054（能用线性基线解释的就是这么点）。前一版按**决策**切出来的 +0.279 大半是泄漏（同局决策两边都有），
 *   那条"状态价值住在观测侧"的推论已随之作废。基线**只有训练期需要**（部署栈只用策略），所以做成训练器里的闭式岭回归：
 *   不动参数表、不换容器、不占包体积，也没有 Adam 步长可调。
 * ⚑ 无偏那条：V 用**上一次拟合**打分（采集时记 d.q），本次更新之后再重拟合 ⇒ 决策自己那局的 G 不进自己的基线。 */
function ridgeFit(X, y, l2) {
  const n = X.length;
  if (!n) return null;
  const m = X[0].length;
  const mu = y.reduce((a, c) => a + c, 0) / n;
  const A = new Float64Array((m + 1) * (m + 1)), rhs = new Float64Array(m + 1);
  for (let i = 0; i < n; i++) {
    const xi = X[i], yi = y[i] - mu;
    for (let a = 0; a <= m; a++) {
      const va = a === m ? 1 : xi[a];
      rhs[a] += va * yi;
      for (let bb = a; bb <= m; bb++) { const vb = bb === m ? 1 : xi[bb]; A[a * (m + 1) + bb] += va * vb; }
    }
  }
  for (let a = 0; a < m; a++) A[a * (m + 1) + a] += l2;          /* 偏置不罚 */
  for (let i = 0; i <= m; i++) for (let j = i + 1; j <= m; j++) A[j * (m + 1) + i] = A[i * (m + 1) + j];
  for (let col = 0; col <= m; col++) {
    let piv = col;
    for (let r = col + 1; r <= m; r++) if (Math.abs(A[r * (m + 1) + col]) > Math.abs(A[piv * (m + 1) + col])) piv = r;
    if (Math.abs(A[piv * (m + 1) + col]) < 1e-12) continue;
    if (piv !== col) { for (let k = 0; k <= m; k++) { const t = A[col * (m + 1) + k]; A[col * (m + 1) + k] = A[piv * (m + 1) + k]; A[piv * (m + 1) + k] = t; } const t2 = rhs[col]; rhs[col] = rhs[piv]; rhs[piv] = t2; }
    for (let r = col + 1; r <= m; r++) {
      const ff = A[r * (m + 1) + col] / A[col * (m + 1) + col];
      if (!ff) continue;
      for (let k = col; k <= m; k++) A[r * (m + 1) + k] -= ff * A[col * (m + 1) + k];
      rhs[r] -= ff * rhs[col];
    }
  }
  const w = new Float64Array(m + 1);
  for (let row = m; row >= 0; row--) {
    let acc = rhs[row];
    for (let k = row + 1; k <= m; k++) acc -= A[row * (m + 1) + k] * w[k];
    w[row] = Math.abs(A[row * (m + 1) + row]) < 1e-12 ? 0 : acc / A[row * (m + 1) + row];
  }
  return { w, mu, m };
}
function ridgeV(fit, x) {
  if (!fit) return null;
  let v = fit.mu + fit.w[fit.m];
  for (let a = 0; a < fit.m; a++) v += fit.w[a] * x[a];
  return v;
}
let XsN = 0, CAPR2 = null;
let RFIT = null;   /* 上一次的拟合（初始 null ⇒ 第一批退回常数基线） */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- 收集器 chooser：记录 (tape, 选中, 决策时资源快照)；大雷助推照执行、单候选不进梯度 ---- */
let curGame = null;
function collector(state, pid, legal) {
  if (!curGame) return { key: R.SK.JI };
  const cands = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
  const rec = (push, c) => ({ push, key: c.key });
  const asAct = (c) => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null });
  if (!cands.length) { curGame.decs.push(rec(true, { key: R.SK.JI })); return { key: R.SK.JI }; }
  const pushed = T.bigTPushPick ? T.bigTPushPick(state, pid, cands) : null;
  if (pushed) { curGame.decs.push(rec(true, pushed)); return asAct(pushed); }
  if (cands.length < 2) { curGame.decs.push(rec(true, cands[0])); return asAct(cands[0]); }
  const fr = P.forwardCands(state, pid, cands, pv, { temp: TEMP, wantTape: 1 });
  const r = curGame.rng();
  let acc = 0, idx = fr.probs.length - 1;
  for (let i = 0; i < fr.probs.length; i++) { acc += fr.probs[i]; if (r < acc) { idx = i; break; } }
  let H = 0; for (let i = 0; i < fr.probs.length; i++) if (fr.probs[i] > 1e-12) H -= fr.probs[i] * Math.log(fr.probs[i]);
  const me = state.p[pid];
  /* 手挑的 7 个价值标量（回合/血/ジ/电珠/爆珠/环连/炮数）——容量探针与 small 档基线都用它，
   *   好处是**不靠 Xin 的列号考古**（列号一变就静默读错），字段全从这里直取。 */
  const FEAT = PROBE_CAP ? [Math.min(1, state.round / 40), (me ? (me.hp || 0) / ((state.mode && state.mode.hp) || 3) : 0),
    (me ? Math.min(me.ep, 12) / 12 : 0), (me && me.elec ? 1 : 0), (me && me.boom ? 1 : 0),
    (me ? (me.ringStreak || 0) / 3 : 0), (me ? (me.cannonCount || 0) / 3 : 0)] : null;
  curGame.decs.push({ push: false, tape: fr.tape, idx, key: cands[idx].key, ep: me ? (me.ep || 0) : 0, elec: me ? (me.elec || 0) : 0, H, q: fr.q,
      xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, hctxArr: null, feat: FEAT, gid: curGame.gid,
      qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, (RFEAT === 'small' ? FEAT : fr.tape.xin)) : null) : null });
  return asAct(cands[idx]);
}

/* ---- 主循环 ---- */
const t0 = Date.now();
const DIM = pv.length;
const adam = { m: new Float64Array(DIM), v: new Float64Array(DIM), t: 0 };
const Q0 = ly.qHead, QN = ly.L.hid + 1;          /* qHead 段 = hid 个权重 + 1 个偏置 */
const cadam = { m: new Float64Array(QN), v: new Float64Array(QN), t: 0 };
let criticZero = 0, rbCount = 0, probeGames = 0, bestProbe = -Infinity, bestSnap = Float64Array.from(pv);
let lastR2 = 0;   /* meta 在循环外，逐步留痕要用外层变量 */
const WARM = arg('criticWarm', '1') !== '0';   /* critic 从批均值起步（qHead 原本是死区，里面是上游随机/未训的值 ⇒ 不热身则 V 的偏置离 G 的尺度很远，Adam 归一步长爬不回来） */
const VOF = (d, mu) => (BASELINE === 'qhead' ? d.q : BASELINE === 'ridge' ? (d.qR == null ? mu : d.qR) : mu);
let capDone = false, warmed = false, vDiag = { mv: 0, sv: 0, mg: 0, sg: 0 };
if (BASELINE === 'ridge') console.log('  ⚑ 基线 = 观测侧闭式岭回归 V(xin)（住在训练器里，不进包 ‖ l2 ' + RL2 + ' ‖ 每批重拟合 ‖ 采集用上一次拟合 ⇒ 不自家打分自家）');
if (BASELINE === 'qhead') console.log('  ⚑ 基线 = 状态价值 V(s)（qHead 段 ‖ critic lr ' + CLRP + ' ‖ 探针 ' +
  (PROBE ? PROBE + ' 局/25 步，seq 空间 gen=1e6+step（从不用于训练）' : '关') + ' ‖ 每步报 R²）');
let games = 0, upd = 0, zeroGrad = 0;
const stat = { score: 0, fire: 0, charge: 0, ent: 0, decs: 0, snap8k: false };
const ZIP = { games: 0, bad: 0 };
console.log('# pg-train（B 臂） ‖ 起点 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 局 ' + GAMES + ' ‖ 批 ' + BATCH + ' ‖ lr ' + LR + ' ‖ temp ' + TEMP + ' ‖ λc ' + LAMC + ' ‖ λf ' + LAMF +
  ' ‖ 基线 ' + BASELINE + ' ‖ seed ' + SEED);
console.log('  口径：arena2 mild(cap2/mix0.5) salt=101 gameSeq 连续 ‖ 塑形常驻 ‖ 大雷助推照执行不进梯度');

function savePack(to) {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(pv)) + ';\n', 'utf8');
}

while (games < GAMES) {
  const decsBatch = [];
  for (let b = 0; b < BATCH && games < GAMES; b++, games++) {
    const gameSeq = games;
    const slot = A2.loopShapes[gameSeq % A2.loopShapes.length];
    const seat = gameSeq % slot.n;
    curGame = { decs: [], gid: gameSeq, rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };
    const row = A2.playOne(collector, slot.idx, gameSeq, 101);
    const ds = curGame.decs;
    curGame = null;
    stat.score += row.scoreNet;
    /* zip：我的决策序列 ↔ 学习席 action 事件序列（引擎对每次尝试都落一条 action 事件） */
    const evs = (row.evs || []).filter((e) => e.type === 'action' && e.pid === seat);
    ZIP.games++;
    if (evs.length !== ds.length) { ZIP.bad++; continue; }
    /* 塑形：逐决策对账事件结果（只认 ok），G_t = 终局 + 未折扣塑形回报（return-to-go） */
    const shape = new Float64Array(ds.length);
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i], e = evs[i];
      if (!d.push && e.outcome === 'ok') {
        if (d.key === R.SK.RAILGUN) { shape[i] += LAMF; stat.fire++; }
        else if (d.key === R.SK.CHARGE && d.ep >= 3 && d.elec === 0) { shape[i] += LAMC; stat.charge++; }
      }
      if (!d.push) { stat.ent += d.H; stat.decs++; }
    }
    let acc = 0;
    for (let i = ds.length - 1; i >= 0; i--) {
      acc += shape[i];
      if (!ds[i].push) decsBatch.push({ d: ds[i], G: row.scoreNet + acc });
    }
    if (PROBE_CAP && !capDone) for (const x of decsBatch) {
      if (!x.d.hctxArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }
    }
  }
  /* 优势：全局均值基线 + 批内标准化。
   * ⚑ 勘误（10-31 15:0x，首轮 8 臂全废的根因）：G 挂在**批条目**上不是决策记录上——第一版写 `d.G` ⇒
   *   A=NaN；而 JS 里 NaN 是 **falsy**（Python 才是 truthy）⇒ tapeBackward 的 `if (!u)` 把 NaN 全跳了
   *   ⇒ grad 恒 0、训练静默 no-op、产物=起点逐位同，日志照样印出"合理"数字。
   *   抓到它的是 λ 与 λ=0 两臂产物 md5 逐位同（阴性对照当接线检查）。修法：解构出 G + A 非有限当场抛。 */
  const mu = decsBatch.reduce((a, x) => a + x.G, 0) / Math.max(1, decsBatch.length);
  const sd = Math.sqrt(decsBatch.reduce((a, x) => a + (x.G - mu) * (x.G - mu), 0) / Math.max(1, decsBatch.length)) || 1;
  const grad = new Float64Array(DIM);
  /* 机制量 R²（解释方差）：V 比常数基线多解释掉多少 G 的方差。≤0 ⇒ 这条臂的 critic 没学到东西。 */
  let ssRes = 0, ssTot = 0;
  for (const { d, G } of decsBatch) { const V = VOF(d, mu); ssRes += (G - V) * (G - V); ssTot += (G - mu) * (G - mu); }
  const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
  /* 诊断量：V 与 G 的批内均值/标准差（R² 为负的两种原因——偏置远 or 真学不到——靠这两个数分开） */
  { let sv2 = 0, sg2 = 0, mvv = 0, mgg = 0;
    for (const { d, G } of decsBatch) { mvv += VOF(d, mu); mgg += G; }
    mvv /= Math.max(1, decsBatch.length); mgg /= Math.max(1, decsBatch.length);
    for (const { d, G } of decsBatch) { const vv = VOF(d, mu); sv2 += (vv - mvv) * (vv - mvv); sg2 += (G - mgg) * (G - mgg); }
    vDiag = { mv: mvv, sv: Math.sqrt(sv2 / Math.max(1, decsBatch.length)), mg: mgg, sg: Math.sqrt(sg2 / Math.max(1, decsBatch.length)) };
  }
  lastR2 = r2;
  if (PROBE_CAP && CAP.length >= 200 && !capDone) { capDone = true; CAPR2 = valueCapacity(A2, P, ly, [{ ds: CAP }]) || null; }
  /* 优势的分母用**残差自己的**标准差。⚑ 这不是口味问题：`mean` 档里 残差=G−mu ⇒ 它与原来的 sd 是同一个数
   *   （逐位同，默认路径不变）；而 `qhead` 档若仍按 G 的 sd 归一，critic 还没学好时 G−V 可以远大于 sd
   *   ⇒ 策略步长被没训熟的 V 顶暴（10-31 深夜实测 R²=−3.1 那一格就是这么炸的，回滚闸兜住了）。 */
  if (BASELINE === 'qhead' && WARM && !warmed) {
    warmed = true;
    for (let k = 0; k < QN - 1; k++) pv[Q0 + k] = 0;
    pv[Q0 + QN - 1] = mu;
    for (const { d } of decsBatch) d.q = mu;
    console.log('  ⚑ critic 热身：qHead 权重清零、偏置置成首批均值 ' + mu.toFixed(3) + ' ⇒ 第一步的优势 = 现役常数基线（不靠这个热身不会动）');
    ssRes = ssTot; lastR2 = 0; vDiag = { mv: mu, sv: 0, mg: mu, sg: vDiag.sg };
  }
  let sdUse = sd;
  if (BASELINE === 'qhead') { const v0 = ssRes / Math.max(1, decsBatch.length); sdUse = Math.sqrt(v0 > 0 ? v0 : 0) || 1; }
  let cmax = 0;
  for (const { d, G } of decsBatch) {
    const V = VOF(d, mu);
    const A = (G - V) / sdUse;
    if (!Number.isFinite(A)) { console.error('⛔ 优势非有限（G=' + G + ' mu=' + mu + ' sd=' + sd + '）⇒ 拒绝静默训练'); process.exit(9); }
    const act = tapeForward(d.tape, pv, ly);
    const t = tailOf(act.logits, d.tape.keys, TEMP);
    const g = dLogPi(d.idx, act.logits, d.tape.keys, TEMP, t);
    for (let j = 0; j < g.length; j++) g[j] *= A;
    /* critic 的上游 = d(V−G)²/dV = 2(V−G)（mean 档传 0 ⇒ 与现役逐字同） */
    const uq = BASELINE === 'qhead' ? 2 * (V - G) : 0;
    tapeBackward(d.tape, pv, ly, act, g, grad, uq, 0);
  }
  if (BASELINE === 'qhead') {
    for (let k = 0; k < QN; k++) { const av = Math.abs(grad[Q0 + k]); if (av > cmax) cmax = av; }
    if (cmax === 0) { criticZero++; if (criticZero >= 3) { console.error('⛔ critic 梯度连续 ' + criticZero + ' 步全零 ⇒ 价值通路没接电，拒绝静默训练'); process.exit(9); } }
    else criticZero = 0;
  }
  { let mx = 0; for (let q = 0; q < DIM; q++) { const a = Math.abs(grad[q]); if (a > mx) mx = a; }
    if (mx === 0) { zeroGrad++; if (zeroGrad >= 3) { console.error('⛔ 连续 ' + zeroGrad + ' 步 grad 全零 ⇒ 训练在空转，拒绝继续'); process.exit(9); } }
    else zeroGrad = 0; }
  adam.t++;
  for (let d = 0; d < DIM; d++) {
    if (d >= Q0 && d < Q0 + QN) continue;    /* 这段梯度归 critic（mean 档这里恒 0 ⇒ 逐位不变） */
    const gg = grad[d] / Math.max(1, decsBatch.length);
    adam.m[d] = 0.9 * adam.m[d] + 0.1 * gg;
    adam.v[d] = 0.999 * adam.v[d] + 0.001 * gg * gg;
    const mh = adam.m[d] / (1 - Math.pow(0.9, adam.t)), vh = adam.v[d] / (1 - Math.pow(0.999, adam.t));
    pv[d] -= LR * mh / (Math.sqrt(vh) + 1e-8);
  }
  if (BASELINE === 'ridge') {
    const Xs = [], ys = [];
    for (const { d, G } of decsBatch) { const xf = RFEAT === 'small' ? d.feat : d.xinArr; if (xf) { Xs.push(xf); ys.push(G); } }
    if (Xs.length < 100) { console.error('⛔ ridge 基线样本不足（' + Xs.length + '）⇒ xinArr 没接上，拒绝按常数基线假装是 AC'); process.exit(9); }
    RFIT = ridgeFit(Xs, ys, RL2); XsN = Xs.length;
  }
  if (BASELINE === 'qhead') {
    cadam.t++;
    const cn = Math.max(1, decsBatch.length);
    for (let k2 = 0; k2 < QN; k2++) {
      const gc = grad[Q0 + k2] / cn;
      cadam.m[k2] = 0.9 * cadam.m[k2] + 0.1 * gc;
      cadam.v[k2] = 0.999 * cadam.v[k2] + 0.001 * gc * gc;
      const mh2 = cadam.m[k2] / (1 - Math.pow(0.9, cadam.t)), vh2 = cadam.v[k2] / (1 - Math.pow(0.999, cadam.t));
      pv[Q0 + k2] -= CLRP * mh2 / (Math.sqrt(vh2) + 1e-8);
    }
  }
  /* 回滚闸：在**从未用于训练的 seq 空间**（gen=1e6+step）上探针，劣化超阈值就退回最好快照 */
  if (PROBE > 0 && upd % 25 === 0) {
    const pr = A2.evalParams(pv, { phase: 'loop', gen: 1000000 + upd, games: PROBE, temp: PROBE_TEMP, cur: 'net' });
    probeGames += PROBE;
    if (pr.score > bestProbe) { bestProbe = pr.score; bestSnap = Float64Array.from(pv); }
    else if (pr.score < bestProbe - RBTOL) {
      for (let d2 = 0; d2 < DIM; d2++) pv[d2] = bestSnap[d2];
      rbCount++;
      console.log('  ⚑ 回滚 @步 ' + upd + '：探针净分 ' + pr.score.toFixed(3) + ' < 最好 ' + bestProbe.toFixed(3) + ' −' + RBTOL.toFixed(3) + ' ⇒ 退回最好快照');
    }
  }
  upd++;
  if (upd % 25 === 0 || games >= GAMES) {
    console.log('  局 ' + games + ' ‖ 步 ' + upd + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
      ' ‖ 炮 ' + (stat.fire / Math.max(1, games)).toFixed(2) + '/局 ‖ 纪律蓄 ' + (stat.charge / Math.max(1, games)).toFixed(2) + '/局' +
      ' ‖ 熵 ' + (stat.ent / Math.max(1, stat.decs)).toFixed(3) + 'nats ‖ zip坏 ' + ZIP.bad + '/' + ZIP.games +
      (BASELINE !== 'mean' ? ' ‖ **R² ' + lastR2.toFixed(3) + '** ‖ V ' + vDiag.mv.toFixed(2) + '±' + vDiag.sv.toFixed(2) + ' ‖ G ' + vDiag.mg.toFixed(2) + '±' + vDiag.sg.toFixed(2) + ' ‖ 回滚 ' + rbCount : ''));
  }
  if (!stat.snap8k && games >= Math.floor(GAMES / 3)) {
    stat.snap8k = true;
    const p8 = OUT.replace(/\.bak$/, '') + '-8k.bak';
    savePack(p8);
    console.log('  ⚑ P-B2 快照（1/3 预算）→ ' + p8);
  }
}
const secs = (Date.now() - t0) / 1000;
console.log('  终：局 ' + games + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
  ' ‖ 炮/局 ' + (stat.fire / Math.max(1, games)).toFixed(3) + ' ‖ 纪律蓄/局 ' + (stat.charge / Math.max(1, games)).toFixed(3) +
  ' ‖ zip 坏 ' + ZIP.bad + '/' + ZIP.games + ' ‖ 耗时 ' + secs.toFixed(0) + 's');
savePack(OUT);
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'pg-train', tag: TAG || null, parent: UP, seed: SEED, games, batch: BATCH, lr: LR, temp: TEMP,
  lamC: LAMC, lamF: LAMF, cur: 'net', updates: upd, wallSecs: Math.round(secs),
  criticDiag: BASELINE === 'qhead' ? { warm: WARM, last: vDiag } : null,
  baseline: BASELINE, ridgeFeat: BASELINE === 'ridge' ? RFEAT : null, ridgeFitN: BASELINE === 'ridge' ? XsN : null, valueCapacityR2: CAPR2, ridgeL2: BASELINE === 'ridge' ? RL2 : null, ridgeDim: BASELINE === 'ridge' ? (RFIT ? RFIT.m : 0) : null, criticLr: BASELINE === 'qhead' ? CLRP : null, probe: PROBE || null, rollbackTol: RBTOL,
  rollbackCount: rbCount, probeGames, bestProbeScore: Number.isFinite(bestProbe) ? +bestProbe.toFixed(4) : null,
  critic: BASELINE === 'qhead' ? { qHeadOff: Q0, qHeadLen: QN, advDenom: 'sd(残差)', lastR2: +lastR2.toFixed(4) } : null,
  loop: { meanScore: stat.score / Math.max(1, games), firePerGame: stat.fire / Math.max(1, games), discChargePerGame: stat.charge / Math.max(1, games), entropy: stat.ent / Math.max(1, stat.decs), zipBad: ZIP.bad },
  container: { v: 91, input: got.cfg.input, dof: got.cfg.dof },
  lineage: { parent: UP, gen: 2, recipe: { objective: (LAMC || LAMF) ? 'scoreNet + λc·discCharge + λf·railgun (resident)' : 'scoreNet only (λ=0 negative control)', solver: 'REINFORCE+Adam (pg-lib, selftest3 7 legs)', baseline: BASELINE } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
