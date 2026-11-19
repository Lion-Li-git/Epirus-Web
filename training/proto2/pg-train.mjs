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
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../../tools/audit-lib.mjs';
import { widOf } from '../../champion-map/pack-id.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { rosterFromArg, shapesFromArg } from './roster-lib.mjs';   /* 对手表/桌形单一来源（与 supfit-gd 同源） */
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogPi, dLogKeyP, dropObs6Tape, assertObsArch } from './pg-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['up', 'upstream', 'obs', 'games', 'batch', 'lr', 'seed', 'lamC', 'lamF', 'lamExp', 'penDeadElec', 'dmgW', 'beadSpendW', 'defTax', 'temp', 'out', 'tag', 'baseline', 'probe', 'rollbackTol', 'criticProbe', 'ridgeL2', 'ridgeFeat', 'seatDrop', 'seatL2', 'segEvery', 'snapEvery', 'shapeKey', 'shapeW', 'shapeModes', 'klModes', 'onlySeg', 'klW', 'klTilt', 'klTiltMul', 'arenaPool', 'arenaShapes'], 'pg-train');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('up', arg('upstream', 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak')));
const OBS_SPEC = String(arg('obs', '')).trim();
const GAMES = Math.max(1000, Number(arg('games', 24000)) || 24000);
const BATCH = Math.max(8, Number(arg('batch', 48)) || 48);
const LR = Number(arg('lr', 3e-4)) || 3e-4;
const SEED = Number(arg('seed', 7)) || 7;
const LAMC = Number(arg('lamC', 0.005)) || 0;
const LAMF = Number(arg('lamF', 0.05)) || 0;
const LAM_EXP = Number(arg('lamExp', 0)) || 0;
const PEN_DEAD_ELEC = Number(arg('penDeadElec', 0));
if (!Number.isFinite(PEN_DEAD_ELEC) || PEN_DEAD_ELEC < 0) { console.error('⛔ --penDeadElec 需 ≥ 0（收到 ' + arg('penDeadElec', '') + '）'); process.exit(2); }
const DMG_W = Number(arg('dmgW', 0));
if (!Number.isFinite(DMG_W) || DMG_W < 0) { console.error('⛔ --dmgW 需 ≥ 0（收到 ' + arg('dmgW', '') + '）'); process.exit(2); }
const BEAD_SPEND_W = Number(arg('beadSpendW', 0));
if (!Number.isFinite(BEAD_SPEND_W) || BEAD_SPEND_W < 0) { console.error('⛔ --beadSpendW 需 ≥ 0（收到 ' + arg('beadSpendW', '') + '）'); process.exit(2); }
const DEF_TAX = Number(arg('defTax', 0));
if (!Number.isFinite(DEF_TAX) || DEF_TAX < 0) { console.error('⛔ --defTax 需 ≥ 0（收到 ' + arg('defTax', '') + '）'); process.exit(2); }
const TEMP = Number(arg('temp', 0.5)) || 0.5;
const OUT = String(arg('out', 'scratch/arms/PG1-s' + SEED + '.bak'));
const TAG = String(arg('tag', ''));
/* ===== C3（PREREG-2026-10-31-FUNNEL-COVERAGE §二乙）：状态价值基线 =====
 * `mean`（默认）= 现役常数基线（批内均值），逐字不变；`ridge` = 优势用 G − V(x)，V 是训练器里的闭式岭回归（不进包）。
 * ⚠ 机制量 R² = 1 − Var(G−V)/Var(G−mu) 必须 >0，否则净分再高也不许归因给基线（预登记条款）。
 * ⚑ 原来的 `qhead` 档（用网络内的 qHead 段当 V）随价值头一起在代 3 删除：10-31 深夜实测线性基线只解释 ~9% 方差、
 *   六枚 24k 臂三档互差 ≤1.0pt，而那个头作为死段让每个下游都要为它写一条豁免 ⇒ 结构与这条档一起删（§十九）。 */
const BASELINE = String(arg('baseline', 'mean'));
if (BASELINE !== 'mean' && BASELINE !== 'ridge') { console.error('⛔ --baseline 只认 mean|ridge（收到 ' + BASELINE + '）'); process.exit(2); }
const PROBE = Math.max(0, Number(arg('probe', 0)) || 0);
const RBTOL = Number(arg('rollbackTol', 0.05)) || 0.05;
const PROBE_TEMP = 0.15;   /* 探针一律按部署温度，与验收同档 */
const PROBE_CAP = arg('criticProbe', '0') === '1' || BASELINE === 'ridge';
const RL2 = Number(arg('ridgeL2', 1e-2)) || 1e-2;   /* 观测侧线性基线的岭系数 */
const RFEAT = String(arg('ridgeFeat', 'obs')) === 'small' ? 'small' : 'obs';   /* 基线读哪套特征：obs=xin 全宽 ‖ small=7 个手挑标量 */
const SEAT_DROP = Math.max(0, Math.min(1, Number(arg('seatDrop', 0)) || 0));
const SEAT_L2 = Math.max(0, Number(arg('seatL2', 0)) || 0);
/* `--segEvery=N`（11-14 晚 · ZCode · 用户令"强且宽"）：每 N 局存一档快照 `<out>.seg<k*N>.bak`
 *   —— FINDING-2026-11-14-obs6-coldstart §四 自己开的方子（"更早保存 2000–5000 局多节点筛选"）：
 *   PG 后段会漂移龟缩，单终点产物不可信，多节点拿去考卷+用卡筛。0=关（旧调用逐字不变）。 */
const SEG_EVERY = Math.max(0, Number(arg('segEvery', arg('snapEvery', 0))) || 0);
let segK = 0;
let klL1 = 0, klN = 0;   /* 键频锚诊断：锚两侧键分布的平均 L1 距离（漂移指示器） */
/* `--shapeKey=<SK键名> --shapeW=<w>`（11-14 晚 · ZCode）：任意键的塑形分量（λf/λc 同族泛化，
 *   见 shape 块注记）。SHAPE_W 默认 0 = 不塑形（旧调用逐字不变）。 */
const SHAPE_KEY = String(arg('shapeKey', '') || '').trim();
const SHAPE_W = Number(arg('shapeW', 0)) || 0;
/* `--klW=<w>`（11-14 晚 · ZCode · 用户点单的宽之路①）：**批级键频锚**——每决策对**冻结起点策略**的键分布
 *   做交叉熵拉力（−Σ q0_k·log kProb_k，梯度 = (π_cur−π_start) 的键级版，经 dLogKeyP 进 tapeBackward）。
 *   为什么不用逐决策塑形（第二轮 --shapeKey 判负）：ring 的 logit 在 PG 头 250 局就塌了，采样归零 ⇒
 *   逐决策优势分量挂不上未采样键；CE 锚是**全键同时拉**（mode-covering），不依赖键被采样。
 *   0 = 关（旧调用逐字不变）。代价：每决策多一次 tapeForward（起点参数）。 */
const KL_W = Number(arg('klW', 0)) || 0;
/* `--klTilt=k1,k2,… --klTiltMul=<m>`（11-14 晚 · ZCode · 补课 breadth-multi）：锚目标的**弱键倾斜**——
 *   把 tilt 表里的键在锚目标里 ×m 再全键归一（m>1 = 抬弱键份额的拉力）。A4.seg1000 的 G_eff≈2.8 骑线
 *   （ji/guard/tank 三键占 95%），倾斜锚直接把 breadth 门要的小键（sword/bagua/ring）顶上去。 */
const KL_TILT = String(arg('klTilt', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const KL_TILT_MUL = Number(arg('klTiltMul', 1)) || 1;
let sdSeed = (SEED * 48271 + 17) >>> 0;
const sdRng = () => { sdSeed = (sdSeed * 1664525 + 1013904223) >>> 0; return sdSeed / 4294967296; };

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
assertObsArch(got.cfg, OBS_SPEC, 'pg-train', UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const VALID_SK = new Set(Object.values(R.SK));
const SK_TYPO_HINT = { big_t: R.SK.BIG_T, mini_t: R.SK.MINI_T, laser_eye: R.SK.LASER_EYE, dual_gun: R.SK.DUAL_GUN };
const resolveSk = (rawKey, flagName) => {
  if (!rawKey) return null;
  if (VALID_SK.has(rawKey)) return rawKey;
  const byEnum = R.SK[String(rawKey).toUpperCase()];
  if (byEnum && VALID_SK.has(byEnum) && !SK_TYPO_HINT[rawKey]) return byEnum;
  const hint = SK_TYPO_HINT[rawKey] ? '（规则真值是 ' + SK_TYPO_HINT[rawKey] + '）' : '';
  console.error('⛔ --' + flagName + ' 含未知技能键 "' + rawKey + '"' + hint);
  process.exit(2);
};
const SHAPE_ITEMS = SHAPE_KEY
  ? SHAPE_KEY.split(',').map((s) => s.trim()).filter(Boolean).map((ent) => {
      const parts = ent.split(':');
      const k = resolveSk(parts[0].trim(), 'shapeKey');
      const w = parts.length > 1 ? Number(parts[1]) : SHAPE_W;
      if (parts.length > 2 || !Number.isFinite(w)) { console.error('⛔ --shapeKey 格式错 "' + ent + '"（认 key 或 key:weight）'); process.exit(2); }
      return { key: k, w };
    })
  : [];
for (const tk of KL_TILT) resolveSk(tk, 'klTilt');
const NEG_SHAPE_KEYS = new Set(SHAPE_ITEMS.filter((x) => x.w < 0).map((x) => x.key));
const SHAPE_MODES_RAW = String(arg('shapeModes', '') || '').trim();
const SHAPE_MODES = new Set(SHAPE_MODES_RAW ? SHAPE_MODES_RAW.split(',').map((s) => s.trim()).filter(Boolean) : []);
for (const md of SHAPE_MODES) {
  if (!R.MODES[md]) { console.error('⛔ --shapeModes 含未知模式 "' + md + '"（合法：' + Object.keys(R.MODES).join(',') + '）'); process.exit(2); }
}
const KL_MODES_RAW = String(arg('klModes', '') || '').trim();
const KL_MODES = new Set(KL_MODES_RAW ? KL_MODES_RAW.split(',').map((s) => s.trim()).filter(Boolean) : []);
for (const md of KL_MODES) {
  if (!R.MODES[md]) { console.error('⛔ --klModes 含未知模式 "' + md + '"（合法：' + Object.keys(R.MODES).join(',') + '）'); process.exit(2); }
}
const pv = Float64Array.from(P.unpack(raw, true));
const pv0 = Float64Array.from(pv);   /* KL 锚的冻结起点（--klW；起点=UP 本尊的权重） */
if (!pv) { console.error('⛔ 起点读不出：' + UP); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
const ONLY_SEG_RAW = String(arg('onlySeg', '') || '').trim();
const ONLY_SEG = ONLY_SEG_RAW ? ONLY_SEG_RAW.split(',').map((s) => s.trim()).filter(Boolean) : [];
let segMask = null;
if (ONLY_SEG.length) {
  const knownSegs = new Set(ly.L.seg.map((s) => s.name));
  for (const name of ONLY_SEG) {
    if (!knownSegs.has(name)) {
      console.error('⛔ --onlySeg 含未知段 "' + name + '"（当前模型合法段：' + [...knownSegs].join(',') + '）');
      process.exit(2);
    }
  }
  segMask = new Uint8Array(pv.length);
  for (const s of ly.L.seg) if (ONLY_SEG.indexOf(s.name) >= 0) for (let i = s.off; i < s.off + s.len; i++) segMask[i] = 1;
}
/* 11-15 深夜（ZCode · 用户令"多换训练环境防背诵"）：PG 的自对局桌也能换对手表/桌形——
 *   缺省逐字不变（stratified cap2/mix0.5 = 千问配对批口径）；--arenaPool=names:… 摆特化族对手
 *   （避开考卷名册脚本），--arenaShapes=3:multi,5:long 等轮换桌形。 */
const PG_ROSTER = rosterFromArg(W, T, String(arg('arenaPool', '')), 'pg-train');
const PG_SHAPES = shapesFromArg(arg('arenaShapes', ''), 'pg-train');
/* 夜3班 11-18：**KL/塑形空转响亮闸**（RINGB3/4 实测 klL1Final=0 的静默浪费）——
 *   `--arenaShapes` 把桌形限制成与 `--klModes`（或 `--shapeModes`）无交集时，锚/塑形一次都不会触发
 *   （allowKl = KL_MODES.has(slot.mode)，pg-train :441），预算全白交还带着"我加过锚"的假叙事。
 *   当场拒；要 long 专项就 klModes 里放 long，要么去掉桌形限制。 */
if (PG_SHAPES) {
  const sm = new Set(PG_SHAPES.map((s) => s.mode));
  if (KL_W > 0 && KL_MODES.size && ![...KL_MODES].some((m) => sm.has(m))) {
    console.error('⛔ pg-train：--arenaShapes 桌形模式 [' + [...sm].join(',') + '] 与 --klModes [' + [...KL_MODES].join(',') + '] 无交集 ⇒ KL 锚零触发（空转）。把 klModes 对上桌形模式，或去掉 arenaShapes。');
    process.exit(2);
  }
  if (SHAPE_MODES.size && ![...SHAPE_MODES].some((m) => sm.has(m))) {
    console.error('⛔ pg-train：--arenaShapes 桌形模式 [' + [...sm].join(',') + '] 与 --shapeModes [' + [...SHAPE_MODES].join(',') + '] 无交集 ⇒ 塑形零触发（空转）。同上二选一。');
    process.exit(2);
  }
}
const A2 = createArena2(W, Object.assign(
  { refParams, temp: 0.15, highN: 1, wantEvents: 1 },
  PG_ROSTER ? { roster: PG_ROSTER } : { stratified: true, stratCap: 2, stratMix: 0.5 },
  PG_SHAPES ? { shapes: PG_SHAPES } : {},
));

/* ===== 价值容量探针 `--criticProbe=1`：先问"装得下吗"，再问"训得熟吗" =====
 * 同一批 (状态, return-to-go) 上，用岭回归（闭式解，带 2 折**按局**切）量两种读出的**可达** R²：
 *   hctx = 策略压缩后的 32 维（网络内部最"近"的表示）‖ xin = ctx 层的输入（G/私有/序列/池化都在里面，ep·珠·回合是原样字段）
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
    ' 维) = ' + gX.toFixed(3) + ' ‖ 读手挑 ' + list[0].f.length + ' 标量 = ' + gF.toFixed(3));
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
  /* 桌形/残局/自身状态标量基线（14 维）：跨人数/模式混训时把初始人数、存活人数、模式血量、血差与 1v1 残局标识一并送入岭回归。 */
  const modeHp = (state.mode && state.mode.hp) || 3;
  let aliveLen = 0, leadHp = 0, sumOppHp = 0, oppN = 0, oppMaxEp = 0;
  if (PROBE_CAP) {
    for (let i = 0; i < state.p.length; i++) {
      const q = state.p[i];
      if (!q || q.hp <= 0) continue;
      aliveLen++;
      if (i === pid) continue;
      if (q.hp > leadHp) leadHp = q.hp;
      if ((q.ep || 0) > oppMaxEp) oppMaxEp = q.ep || 0;
      sumOppHp += q.hp; oppN++;
    }
  }
  const meanOppHp = oppN > 0 ? sumOppHp / oppN : (me ? me.hp : 0);
  const FEAT = PROBE_CAP ? [
    Math.min(1, state.round / 40),
    (me ? (me.hp || 0) / modeHp : 0),
    (me ? Math.min(me.ep, 12) / 12 : 0),
    (me && me.elec ? 1 : 0),
    (me && me.boom ? 1 : 0),
    (me ? (me.ringStreak || 0) / 3 : 0),
    (me ? (me.cannonCount || 0) / 3 : 0),
    state.p.length / 10,
    aliveLen / 10,
    modeHp / 6,
    (me ? (me.hp - leadHp) / 5 : 0),
    (me ? (me.hp - meanOppHp) / 5 : 0),
    aliveLen <= 2 ? 1 : 0,
    Math.min(oppMaxEp, 6) / 6,
  ] : null;
  curGame.decs.push({ push: false, tape: fr.tape, idx, key: cands[idx].key, bead: cands[idx].bead || null, ep: me ? (me.ep || 0) : 0, elec: me ? (me.elec || 0) : 0, H, q: fr.q,
      xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, hctxArr: null, feat: FEAT, gid: curGame.gid,
      qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, (RFEAT === 'small' ? FEAT : fr.tape.xin)) : null) : null });
  return asAct(cands[idx]);
}

/* ---- 主循环 ---- */
const t0 = Date.now();
const DIM = pv.length;
const adam = { m: new Float64Array(DIM), v: new Float64Array(DIM), t: 0 };
let rbCount = 0, probeGames = 0, bestProbe = -Infinity, bestSnap = Float64Array.from(pv);
let lastR2 = 0;   /* meta 在循环外，逐步留痕要用外层变量 */
const VOF = (d, mu) => (BASELINE === 'ridge' ? (d.qR == null ? mu : d.qR) : mu);
let capDone = false, vDiag = { mv: 0, sv: 0, mg: 0, sg: 0 };
if (BASELINE === 'ridge') console.log('  ⚑ 基线 = 观测侧闭式岭回归 V(xin)（住在训练器里，不进包 ‖ l2 ' + RL2 + ' ‖ 每批重拟合 ‖ 采集用上一次拟合 ⇒ 不自家打分自家）');
let games = 0, upd = 0, zeroGrad = 0;
const stat = { score: 0, fire: 0, charge: 0, deadElec: 0, beadExp: 0, beadSpent: 0, dmgAmt: 0, shapeHits: {}, ent: 0, decs: 0, snap8k: false };
const ZIP = { games: 0, bad: 0 };
console.log('# pg-train（B 臂） ‖ 起点 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 局 ' + GAMES + ' ‖ 批 ' + BATCH + ' ‖ lr ' + LR + ' ‖ temp ' + TEMP + ' ‖ λc ' + LAMC + ' ‖ λf ' + LAMF +
  (LAM_EXP > 0 ? ' ‖ λexp ' + LAM_EXP : '') +
  (PEN_DEAD_ELEC > 0 ? ' ‖ 死电罚 ' + PEN_DEAD_ELEC : '') +
  (DMG_W > 0 ? ' ‖ dmgW ' + DMG_W : '') +
  (BEAD_SPEND_W > 0 ? ' ‖ beadSpendW ' + BEAD_SPEND_W : '') +
  (DEF_TAX > 0 ? ' ‖ defTax ' + DEF_TAX : '') +
  (SHAPE_ITEMS.length ? ' ‖ shape ' + SHAPE_ITEMS.map((x) => x.key + ':' + x.w).join(',') : '') +
  (SHAPE_MODES.size ? ' ‖ shapeModes ' + [...SHAPE_MODES].join(',') : '') +
  (ONLY_SEG.length ? ' ‖ onlySeg ' + ONLY_SEG.join(',') : '') +
  ' ‖ 基线 ' + BASELINE + ' ‖ seed ' + SEED);
console.log('  口径：arena2 mild(cap2/mix0.5) salt=101 gameSeq 连续 ‖ 塑形常驻 ‖ 大雷助推照执行不进梯度');

let HF = '';
try { HF = widOf(readFileSync(UP, 'utf8')) || ''; } catch (e) { HF = ''; }
if (!HF) console.log('⚠ 起点 wid 算不出 ⇒ hotstartFrom 退回路径 ' + UP + '，谱系这一级仍按名字推');
function savePack(to) {
  mkdirSync(dirname(to), { recursive: true });
  const meta = {
    ts: new Date().toISOString(), arm: to.split(/[\\/]/).pop().replace(/\.(bak|js)$/, ''),
    up: UP, hotstartFrom: HF || UP, seed: SEED, games, batch: BATCH, lr: LR,
    lamC: LAMC, lamF: LAMF, baseline: BASELINE, seatDrop: SEAT_DROP, seatL2: SEAT_L2,
  };
  writeFileSync(to, 'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
    'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(pv)) + ';\n', 'utf8');
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
    const allowPosShape = !SHAPE_MODES.size || SHAPE_MODES.has(slot.mode);
    let lastFireIdx = -1;
    if (NEG_SHAPE_KEYS.has(R.SK.CURSE)) {
      for (let i = ds.length - 1; i >= 0; i--) {
        if (!ds[i].push && ds[i].key === R.SK.FIRESTORM && evs[i].outcome === 'ok') { lastFireIdx = i; break; }
      }
    }
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i], e = evs[i];
      if (!d.push && e.outcome === 'ok') {
        if (allowPosShape && d.key === R.SK.RAILGUN) { shape[i] += LAMF; stat.fire++; }
        else if (allowPosShape && d.key === R.SK.CHARGE && d.ep >= 3 && d.elec === 0 && (!PEN_DEAD_ELEC || (d.bead || 'elec') === 'elec')) { shape[i] += LAMC; stat.charge++; }
        else if (PEN_DEAD_ELEC > 0 && d.key === R.SK.CHARGE && (d.bead || 'elec') === 'elec' && d.ep < 3) { shape[i] -= PEN_DEAD_ELEC; stat.deadElec++; }
        /* --shapeKey（11-14 晚 · ZCode · 用户令"试试开训练"= 强且宽第二轮）：支持单键或 key:w 多键列表；负权 curse 仅罚"之后无天火引爆"的孤儿贴符 */
        for (const it of SHAPE_ITEMS) if (d.key === it.key && (it.w < 0 || allowPosShape)) {
          if (it.key === R.SK.CURSE && it.w < 0 && i < lastFireIdx) continue;
          shape[i] += it.w; stat.shapeHits[it.key] = (stat.shapeHits[it.key] || 0) + 1;
        }
        if (DEF_TAX > 0 && allowPosShape && (d.key === R.SK.GUARD || d.key === R.SK.REFLECT || d.key === R.SK.BAGUA)) { shape[i] -= DEF_TAX; }
      }
      if (!d.push) { stat.ent += d.H; stat.decs++; }
    }
    if (LAM_EXP > 0 || (allowPosShape && (DMG_W > 0 || BEAD_SPEND_W > 0))) {
      let ai = -1;
      const lastChg = { elec: -1, boom: -1 };
      for (const e of (row.evs || [])) {
        if (DMG_W > 0 && allowPosShape && e.type === 'damage' && e.source === seat && e.target !== seat && (e.amt || 0) > 0 && ai >= 0 && ai < ds.length && !ds[ai].push) {
          shape[ai] += DMG_W * Math.min(2, e.amt);
          stat.dmgAmt += e.amt;
        }
        if (e.pid !== seat) continue;
        if (e.type === 'action') { ai++; continue; }
        if (e.type === 'bead') {
          if (BEAD_SPEND_W > 0 && allowPosShape && e.delta < 0 && ai >= 0 && ai < ds.length && !ds[ai].push) {
            shape[ai] += BEAD_SPEND_W;
          }
          if (LAM_EXP > 0) {
            if (e.delta > 0 && ai >= 0 && ai < ds.length && !ds[ai].push && ds[ai].key === R.SK.CHARGE) lastChg[e.kind] = ai;
            else if (e.delta < 0 && lastChg[e.kind] >= 0) { lastChg[e.kind] = -1; stat.beadSpent++; }
          }
        } else if (LAM_EXP > 0 && e.type === 'beadExpire' && lastChg[e.kind] >= 0) {
          shape[lastChg[e.kind]] -= LAM_EXP;
          stat.beadExp++;
          lastChg[e.kind] = -1;
        }
      }
    }
    let acc = 0;
    const allowKl = !KL_MODES.size || KL_MODES.has(slot.mode);
    for (let i = ds.length - 1; i >= 0; i--) {
      acc += shape[i];
      if (!ds[i].push) decsBatch.push({ d: ds[i], G: row.scoreNet + acc, inKl: allowKl });
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
  /* 优势的分母 = 批内 **G 的标准差**（`mean` 档残差即 G−mu ⇒ 与现役逐字同；在册的 6 枚 ridge 臂吃的也是这个分母，
   *   删掉可微 critic 档后不再有"残差分母"那套热身/兜底逻辑——见 §十九：那条路判不采纳，结构也一起删了）。 */
  const sdUse = sd;
  for (const { d, G, inKl } of decsBatch) {
    const V = VOF(d, mu);
    const A = (G - V) / sdUse;
    if (!Number.isFinite(A)) { console.error('⛔ 优势非有限（G=' + G + ' mu=' + mu + ' sd=' + sd + '）⇒ 拒绝静默训练'); process.exit(9); }
    const tp = SEAT_DROP > 0 ? dropObs6Tape(d.tape, SEAT_DROP, sdRng) : d.tape;
    const act = tapeForward(tp, pv, ly);
    const t = tailOf(act.logits, tp.keys, TEMP);
    const g = dLogPi(d.idx, act.logits, tp.keys, TEMP, t);
    for (let j = 0; j < g.length; j++) g[j] *= A;
    tapeBackward(tp, pv, ly, act, g, grad);
    if (KL_W > 0 && inKl) {
      /* 批级键频锚：对**全键**同时拉向冻结起点的键分布（CE，mode-covering）——不依赖键被采样
       *   （第二轮 --shapeKey 的死因就是采样塌缩）。用未 drop 的 d.tape：锚不跟随 dropout 噪声。 */
      const act0 = tapeForward(d.tape, pv0, ly);
      const t0 = tailOf(act0.logits, d.tape.keys, TEMP);
      /* 倾斜：tilt 表里的键 ×m，负塑形键在 KL 目标中置 0（防把已知废招/孤儿贴符锚回来） */
      const q0 = {};
      let q0sum = 0;
      for (const k of new Set(d.tape.keys)) {
        const mul = NEG_SHAPE_KEYS.has(k) ? 0 : (KL_TILT.indexOf(k) >= 0 ? KL_TILT_MUL : 1);
        q0[k] = (t0.kProb[k] || 0) * mul;
        q0sum += q0[k];
      }
      if (q0sum > 0) for (const k of Object.keys(q0)) q0[k] /= q0sum;
      const acc = new Float64Array(act.logits.length);
      for (const k of new Set(d.tape.keys)) {
        const u = dLogKeyP(k, act.logits, tp.keys, TEMP, t);
        const qk = q0[k] || 0;
        for (let j = 0; j < u.length; j++) acc[j] -= qk * u[j];
        klL1 += Math.abs((t.kProb[k] || 0) - qk);
      }
      for (let j = 0; j < acc.length; j++) acc[j] *= KL_W;
      tapeBackward(tp, pv, ly, act, acc, grad);
      klN++;
    }
  }
  { let mx = 0; for (let q = 0; q < DIM; q++) { if (segMask && !segMask[q]) continue; const a = Math.abs(grad[q]); if (a > mx) mx = a; }
    if (mx === 0) { zeroGrad++; if (zeroGrad >= 3) { console.error('⛔ 连续 ' + zeroGrad + ' 步 grad 全零 ⇒ 训练在空转，拒绝继续'); process.exit(9); } }
    else zeroGrad = 0; }
  adam.t++;
  const seSeg = SEAT_L2 > 0 ? ly.L.seg.find((s) => s.name === 'seatEnc') : null;
  const se0 = seSeg ? seSeg.off : -1, se1 = seSeg ? (seSeg.off + seSeg.len) : -1;
  for (let d = 0; d < DIM; d++) {
    if (segMask && !segMask[d]) continue;
    const gg = grad[d] / Math.max(1, decsBatch.length);
    adam.m[d] = 0.9 * adam.m[d] + 0.1 * gg;
    adam.v[d] = 0.999 * adam.v[d] + 0.001 * gg * gg;
    const mh = adam.m[d] / (1 - Math.pow(0.9, adam.t)), vh = adam.v[d] / (1 - Math.pow(0.999, adam.t));
    const wd = (SEAT_L2 > 0 && d >= se0 && d < se1) ? SEAT_L2 * pv[d] : 0;
    pv[d] -= LR * (mh / (Math.sqrt(vh) + 1e-8) + wd);
  }
  if (BASELINE === 'ridge') {
    const Xs = [], ys = [];
    for (const { d, G } of decsBatch) { const xf = RFEAT === 'small' ? d.feat : d.xinArr; if (xf) { Xs.push(xf); ys.push(G); } }
    if (Xs.length < 100) { console.error('⛔ ridge 基线样本不足（' + Xs.length + '）⇒ xinArr 没接上，拒绝按常数基线假装是 AC'); process.exit(9); }
    RFIT = ridgeFit(Xs, ys, RL2); XsN = Xs.length;
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
    const shStr = SHAPE_ITEMS.length ? (' ‖ ' + SHAPE_ITEMS.map((it) => it.key + ' ' + ((stat.shapeHits[it.key] || 0) / Math.max(1, games)).toFixed(2)).join('/')) : '';
    console.log('  局 ' + games + ' ‖ 步 ' + upd + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
      ' ‖ 炮 ' + (stat.fire / Math.max(1, games)).toFixed(2) + '/局 ‖ 纪律蓄 ' + (stat.charge / Math.max(1, games)).toFixed(2) + '/局' +
      (PEN_DEAD_ELEC > 0 ? ' ‖ 死电 ' + (stat.deadElec / Math.max(1, games)).toFixed(2) + '/局' : '') +
      (DMG_W > 0 ? ' ‖ 伤 ' + (stat.dmgAmt / Math.max(1, games)).toFixed(2) + '/局' : '') +
      (LAM_EXP > 0 ? ' ‖ 花珠 ' + (stat.beadSpent / Math.max(1, games)).toFixed(2) + '/废珠 ' + (stat.beadExp / Math.max(1, games)).toFixed(2) : '') + shStr +
      ' ‖ 熵 ' + (stat.ent / Math.max(1, stat.decs)).toFixed(3) + 'nats ‖ zip坏 ' + ZIP.bad + '/' + ZIP.games +
      (KL_W > 0 ? ' ‖ 锚L1 ' + (klN ? (klL1 / klN).toFixed(3) : '-') : '') +
      (BASELINE !== 'mean' ? ' ‖ **R² ' + lastR2.toFixed(3) + '** ‖ V ' + vDiag.mv.toFixed(2) + '±' + vDiag.sv.toFixed(2) + ' ‖ G ' + vDiag.mg.toFixed(2) + '±' + vDiag.sg.toFixed(2) + ' ‖ 回滚 ' + rbCount : ''));
  }
  if (!stat.snap8k && games >= Math.floor(GAMES / 3)) {
    stat.snap8k = true;
    const p8 = OUT.replace(/\.bak$/, '') + '-8k.bak';
    savePack(p8);
    console.log('  ⚑ P-B2 快照（1/3 预算）→ ' + p8);
  }
  if (SEG_EVERY > 0) {
    while (games >= (segK + 1) * SEG_EVERY) {
      segK++;
      const to = OUT.replace(/\.(bak|js)$/, '') + '.seg' + (segK * SEG_EVERY) + '.bak';
      savePack(to);
      console.log('  ⚑ seg 快照（' + (segK * SEG_EVERY) + ' 局）→ ' + to);
    }
  }
}
const secs = (Date.now() - t0) / 1000;
console.log('  终：局 ' + games + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
  ' ‖ 炮/局 ' + (stat.fire / Math.max(1, games)).toFixed(3) + ' ‖ 纪律蓄/局 ' + (stat.charge / Math.max(1, games)).toFixed(3) +
  (PEN_DEAD_ELEC > 0 ? ' ‖ 死电/局 ' + (stat.deadElec / Math.max(1, games)).toFixed(3) : '') +
  (LAM_EXP > 0 ? ' ‖ 花珠/废珠 ' + (stat.beadSpent / Math.max(1, games)).toFixed(2) + '/' + (stat.beadExp / Math.max(1, games)).toFixed(2) : '') +
  ' ‖ zip 坏 ' + ZIP.bad + '/' + ZIP.games + ' ‖ 耗时 ' + secs.toFixed(0) + 's');
savePack(OUT);
const packed = P.pack(pv);   /* 容器形状从**产物自己**读，不在 meta 里写死代/v（Stage A 之后 91/92 两代同时在盘上） */
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'pg-train', tag: TAG || null, parent: UP, seed: SEED, games, batch: BATCH, lr: LR, temp: TEMP,
  lamC: LAMC, lamF: LAMF, lamExp: LAM_EXP || null, penDeadElec: PEN_DEAD_ELEC || null, dmgW: DMG_W || null, beadSpendW: BEAD_SPEND_W || null, defTax: DEF_TAX || null, shapeKey: SHAPE_KEY || null, shapeW: SHAPE_W || null, shapeModes: SHAPE_MODES_RAW || null, klModes: KL_MODES_RAW || null, onlySeg: ONLY_SEG_RAW || null, klW: KL_W || null, klTilt: KL_TILT.length ? KL_TILT.join(',') : null, klTiltMul: KL_TILT.length ? KL_TILT_MUL : null, klL1Final: KL_W > 0 ? +(klL1 / Math.max(1, klN)).toFixed(4) : null, cur: 'net', updates: upd, wallSecs: Math.round(secs),
  baseline: BASELINE, ridgeFeat: BASELINE === 'ridge' ? RFEAT : null, ridgeFitN: BASELINE === 'ridge' ? XsN : null, valueCapacityR2: CAPR2, ridgeL2: BASELINE === 'ridge' ? RL2 : null, ridgeDim: BASELINE === 'ridge' ? (RFIT ? RFIT.m : 0) : null, probe: PROBE || null, rollbackTol: RBTOL,
  rollbackCount: rbCount, probeGames, bestProbeScore: Number.isFinite(bestProbe) ? +bestProbe.toFixed(4) : null,
  lastR2: BASELINE === 'mean' ? null : +lastR2.toFixed(4),
  loop: { meanScore: stat.score / Math.max(1, games), firePerGame: stat.fire / Math.max(1, games), discChargePerGame: stat.charge / Math.max(1, games), deadElecPerGame: PEN_DEAD_ELEC > 0 ? stat.deadElec / Math.max(1, games) : null, beadSpentPerGame: LAM_EXP > 0 ? stat.beadSpent / Math.max(1, games) : null, beadExpPerGame: LAM_EXP > 0 ? stat.beadExp / Math.max(1, games) : null, shapeHits: Object.keys(stat.shapeHits).length ? stat.shapeHits : null, entropy: stat.ent / Math.max(1, stat.decs), zipBad: ZIP.bad },
  container: { v: packed.v, input: got.cfg.input, dof: got.cfg.dof, gen: packed.dims.gen, keySplit: packed.dims.keySplit || 0, n: packed.n },
  lineage: { parent: UP, gen: packed.dims.gen, recipe: { objective: (LAMC || LAMF) ? 'scoreNet + λc·discCharge + λf·railgun (resident)' : 'scoreNet only (λ=0 negative control)', solver: 'REINFORCE+Adam (pg-lib, selftest3 6 legs)', baseline: BASELINE } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
