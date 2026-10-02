#!/usr/bin/env node
/* §E223 第二步 · **把线性蒸馏头当成出手策略，在产品桌上对打**（只读，不动出厂路径、不动冠军包）
 *
 * 为什么必须补这一刀（01:2x，接在 `probe-distill-learnability` 后面）：
 *   · §E223 第一步读到的是**与教师（= 一手搜索的 argmax）的一致率**：线性蒸馏头 44.6% ‖ 45.1%，
 *     现役冠军包 33.7% ‖ 40.0%，教师自己的分半天花板 67.4% ‖ 69.1%，两个方向都过判据；
 *   · 但**一致率不是胜率**（这条仓里栽过很多次：§E197 的"分↔模拟赢率"、§E205 的"上界要与结算口径同构"）。
 *     这一档只回答一个问题：**"更像搜索的口味"换成真对局之后，是赚还是赔？**
 *
 * 装配（**焦点席怎么在候选表里挑 = 唯一的自由量**）：
 *   · 桌 = 产品桌 n=5（0 席人类形状 ‖ 1 席被测 ‖ 2/3 席环境原型 ‖ 4 席关档冠军），与 §E191/§E195 同一张；
 *   · 候选表 = `P.candidatesFor(state, pid, T.econBase(state, pid, affordable), { lockTarget: false })`
 *     —— 与 §E223 采标签那一遍**逐字同一个调用**（否则头就落在自己的训练分布之外）；
 *   · 特征做**与导出时同样的四位取整**（训练标签就是在取整后的向量上学的；不留"精度"这个隐藏自由量）；
 *   · 平票：用与候选顺序**无关**的 FNV 哈希破（§E215 §4 那条课的第四次；这里的顺序恰好是"键×目标"枚举序，
 *     若写成"先出现者胜"就会系统性偏向低编号目标）。
 *   · 五臂：
 *       `pack`  = 同一张候选表上用现役包的 `P.value` 取 max（贪心参照 ⇒ 与 `head` 严格配对）
 *       `head`  = 同一张候选表上用导出的线性头 `β·(featuresV7 ⊕ actionFeatures)` 取 max
 *       `packT` = **复刻出厂的两级采样**（技能层 × 条目层，temp=0.15，抽 `state.rng` 一次）用 `P.value` 当 logits
 *       `headT` = 同一套复刻采样，只把 logits 换成头分 ⇒ 与 `packT` **只差打分器一个自由量**，这才是"能不能上线"那一问
 *       `a0`    = 生产口径 `T.policyChooserN(params, 0.15)`（参照电平；与 `packT` 还差 `lockTarget` 一项，不进判据）
 *   · ⚠ `packT/headT` 用复刻采样，所以**必须先证明复刻忠实**：每台决策都拿 `P.forwardCands(...).probs` 对一遍
 *     （最大逐格概率差 + argmax 是否同一格），差 >1e-9 就当堂报废这两臂（09-30 那条课："换实现的验收要先看心跳"）。
 *
 * 判据（**跑之前写死**，不许看完数再改）：
 *   ① 配对差 `head − pack` 的夺冠率必须在**两个 seed 带同号**，且合并后逐局配对的 95% 区间不含 0；
 *   ② 两臂的**决策分歧率**必须 > 5%（否则两臂其实是同一个策略，读数只是噪声，判"这一档没跑起来"）；
 *   ③ 递交动作被引擎记进当回合动作栏的比例必须 ≥ 99%（低于 ⇒ 头选的东西被静默降级，胜率差不可归因）；
 *   ④ 复刻忠实性：`packT` 与 `P.forwardCands` 的逐格概率最大差 <1e-9 且 argmax 全同（否则 ①' 不给读数）。
 *   ①' 次级（本轮新增，同样跑前写死）：`headT − packT` 两带同号且合并区间不含 0 ⇒ "换成头打分"在生产采样口径下赚钱。
 *   全过 ⇒ "蒸馏真的买到胜率"成立，下一步才谈进训练；
 *   ①/①' 不过（尤其**两带异号或区间含 0**）⇒ 这一格关掉，判语是"搜索的口味学得来、换成对局不赚钱"，
 *     那将把 §E223 第一步的正读数降级成"只是更像教师，而教师本身在这张桌上不值钱"。
 *
 * 用法：node tools/probe-distill-player.mjs --heads=<headA.json>,<headB.json> [--seeds=3100,9200] [--games=12]
 *        [--envs=aggro,wall,antidef,tankline,random,mix] [--arms=pack,head,packT,headT,a0] [--chk=8] [--temp=0.15]
 *      `--heads` 给两枚（各自 `trainSeed/testSeed` 由 §E223 第一步写进文件）；每一带自动取**训在另一带**的那枚 ⇒ 保证是样本外。
 */
import { sandbox, mulberry32, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { loadCardTable, breadth, defShare } from './log-reading.mjs';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['heads', 'seeds', 'games', 'envs', 'arms', 'chk', 'temp', 'lambdas', 'randctl', 'calib', 'config', 'quiet'], 'probe-distill-player');
const arg = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); };
const SEEDS_ARG = arg('seeds', '3100,9200');
const GAMES = Math.max(1, Number(arg('games', 12)) || 12);
const ENV_PICK = String(arg('envs', 'aggro,wall,antidef,tankline,random,mix')).split(',').filter(Boolean);
const ARMS = String(arg('arms', 'pack,head,packT,headT,a0')).split(',').filter(Boolean);
/* `--lambdas=0,0.25,0.5,1,2` 追加**混合打分**臂：`score = P.value + λ·σp·(头分 − μh)/σh`
 *   ⇒ λ 的单位是"现役包打分标准差的几成"，且 **λ=0 必须与 `packT` 逐字相同**（新旋钮第一读 = 与上一档是否相同，§E192 那条）。
 *   加这一族的理由（01:5x，接在四带负读数之后）：整表换成头会**饿死自己的经济**（候选数中位 4 vs 23），
 *   而"头只在包的答案附近微调"是同一张脸、同一个采样器下**唯一还没试过的剂量方向**。 */
const LAMS = String(arg('lambdas', '')).split(',').filter(x => x !== '').map(Number).filter(x => !isNaN(x));
const RC = String(arg('randctl', '')).split(',').filter(x => x !== '').map(Number).filter(x => !isNaN(x));
for (const l of LAMS) ARMS.push('lam' + l);
for (const r of RC) ARMS.push('rnd' + r);
/* 去重（我自己刚踩过：`--arms` 里已经点名 `lam0,lam0.25,...`，`--lambdas` 又追加一遍 ⇒ 同一批局**各跑两遍**、
 *   每个臂的 `perGame` 出现重复块。夺冠率不受影响（分子分母同倍），但逐局配对的区间会**虚降 √2** ⇒ 假精度。 */
{ const seen = new Set(); for (let i = ARMS.length - 1; i >= 0; i--) { if (seen.has(ARMS[i])) ARMS.splice(i, 1); else seen.add(ARMS[i]); } }
const TEMP = Number(arg('temp', 0.15));
const CHK = Math.max(0, Number(arg('chk', 8)) || 0);                 /* 每几手做一次"递交是否被接受"的覆盖保真检查（0=关） */
const HEADS = String(arg('heads', '')).split(',').filter(Boolean).map(p => JSON.parse(readFileSync(p, 'utf8')));
const QUIET = argv.indexOf('--quiet') >= 0;
const N = 5, FOCUS = 1;

const W = sandbox(), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
/* ===== `--config=<mode>`（§E230 · 只开模式，不开人数）=====
 *   为什么只到 mode：这台仪器的席位装配是**照产品桌 n=5 写死的**（`[人类形状, 被测, 原型, 原型, 关档冠军]`）⇒
 *   要量"人数轴"得先重做装配，而 §E229 刚量过人数是**弱轴**（参照名次 ρ=+0.771）、血量才是真轴（ρ≈+0.09）
 *   ⇒ 这一档只把**血量模式**换掉（`multi` 3 珠 ‖ `long` 5 珠），装配、种子、席位顺序一律不动。
 *   ⚠ 默认 `multi` ⇒ 输出与加这一档之前**逐字相同**（只多一行"本遍在 `long` 下跑"的提示，且只在非默认时印）；
 *   ⚠ 跨配置的**绝对电平与配对差不可互相比**（§E202"绝对电平一律不引"在这一档升级成跨配置），
 *     可比的只有"同一配置内 `headT − packT`"这个量在两处的取值。 */
const CFG_MODE = String(arg('config', 'multi'));
if (!R.MODES || !R.MODES[CFG_MODE]) { console.error('⛔ `--config` 的 mode `' + CFG_MODE + '` 不在 `MODES` 里（可用：' + Object.keys(R.MODES || {}).join(',') + '）'); process.exit(4); }
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENVS = ENV_PICK.map(n => { const q = POOL.find(z => z.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return q; });
const HB = loadPool(W, 'human');
const mean = x => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)); };
const ci = x => (x.length > 1 ? 1.96 * sd(x) / Math.sqrt(x.length) : NaN);
const r4 = v => Math.round(v * 1e4) / 1e4;
const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/* ---------- 头的装配检查 ---------- */
for (const h of HEADS) {
  if (h.feat !== 'sa') { console.error('⛔ 头 `' + (h.train || '') + '` 是 `feat=' + h.feat + '` ⇒ 状态维在训练时被置零，这里喂的是真状态 ⇒ A/B 多了一个自由量'); process.exit(3); }
  if (!h.trainSeed || !h.testSeed) { console.error('⛔ 头文件缺 trainSeed/testSeed ⇒ 无法保证样本外（请用最新 §E223 第一步重新 --export=）'); process.exit(3); }
  /* §E230：头自带的标签配置戳 ⇒ 与本遍桌配置不一致时**点名**（跨配置投放正是这一档要量的"处理"，不是事故，
     但读数必须写明"这张脸是在哪种局的标签上蒸的"，否则下一个人会把它当成同配置的头来读）。旧导出无此戳 ⇒ 不印，保持原样。 */
  if (h.trainCfg) console.log((h.trainCfg.split('/')[0] === CFG_MODE ? '# 头 `' + (h.train || '').split('/').pop() + '` 的标签配置 = 本遍桌配置（`' + h.trainCfg + '`）⇒ **同配置投放**'
    : '# ⚠ 头 `' + (h.train || '').split('/').pop() + '` 的标签来自 `' + h.trainCfg + '`，而本遍桌是 `--config=' + CFG_MODE + '` ⇒ 这是**跨配置投放**的读数'));
}

/* ---------- 混合臂的标定（`--calib=<dump.jsonl>[,...]`）：只取**决策内**的散布 ----------
 * 为什么不用全表池化的标准差：`P.value`/头分的**绝对电平**随状态漂移，池化 sd 里混的是"局面之间"的差，
 * 而 λ 要换算的是"同一张候选表里头比包多偏离几个标准差"⇒ 必须**先按决策去均值**再合方差。 */
const CAL = (function () {
  const files = String(arg('calib', '')).split(',').filter(Boolean);
  if (!files.length) return null;
  const rows = [];
  for (const f of files) for (const l of readFileSync(f, 'utf8').trim().split('\n')) rows.push(JSON.parse(l));
  const within = arrs => {                       /* arrs = 每决策一组分数 ⇒ 决策内去均值后的合并 sd */
    let ss = 0, n = 0;
    for (const a of arrs) { if (a.length < 2) continue; const m = mean(a); for (const v of a) { ss += (v - m) * (v - m); n++; } }
    return Math.sqrt(ss / Math.max(1, n - arrs.length));
  };
  const scored = (r, b) => { const s = r.s, a = r.a, out = [];
    for (let i = 0; i < a.length; i++) { let z = 0; for (let j = 0; j < s.length; j++) z += b[j] * s[j]; for (let j = 0; j < a[i].length; j++) z += b[s.length + j] * a[i][j]; out.push(z); }
    return out; };
  const sigmaP = within(rows.map(r => r.net));
  const sigmaOf = b => within(rows.map(r => scored(r, b)));
  for (const h of HEADS) h._calSigmaH = sigmaOf(h.beta);
  return { sigmaP: sigmaP, n: rows.length, sigmaOf: sigmaOf, rows: rows, scored: scored };
})();
if ((LAMS.length || RC.length) && !CAL) { console.error('⛔ `--lambdas`/`--randctl` 需要 `--calib=<§E223 的 dump.jsonl>`（λ 的单位靠决策内标准差换算，没有标定集就没有"几成"这个说法）'); process.exit(3); }
/* ===== 随机方向对照（§E215 那条课的第三次应用："加扰动要同幅度随机方向对照"）=====
 * λ=0.25 那一档读出 +1.27pt 时，第一问题不是"是不是真的"，而是**"任何同幅度的扰动是不是都赚"**：
 * 若随机方向的 β 也给差不多的增益 ⇒ 那个钱不是"教师的口味"买的，是"把包的 argmax 稍微打散"买的
 * （与 §E205 的"temp 抽样"那条同族）。⇒ 这一臂就是为这个而存在，不是装饰。
 * ⚠ β 的**尺度**无所谓（λ 里已经用 σh 归一 ⇒ 缩放会被约掉），所以一个固定种子的均匀随机方向就是全部自由量。 */
const CTRL = (function () {
  if (!RC.length || !CAL) return null;
  const p = HEADS[0].beta.length, b = new Array(p);
  let s = 20261002 >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s << 17; s >>>= 0; s ^= s >>> 5; s >>>= 0; return s / 4294967296 - 0.5; };
  for (let i = 0; i < p; i++) b[i] = rnd();
  return { beta: b, _calSigmaH: CAL.sigmaOf(b), isControl: true };
})();

/** 焦点席的公共部分：候选表 + 现役包分 +（给了 β 才算）头分 + 出厂同一套两级概率（用来验复刻忠实）。 */
function table(state, pid, legal, beta) {
  const aff = (legal || []).filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  const cands = P.candidatesFor(state, pid, T.econBase(state, pid, base), { lockTarget: false });
  if (!cands || cands.length < 2) return null;
  const s = P.featuresV7(state, pid).map(r4);
  const salt = ((state.round | 0) * 2654435761 ^ (pid + 1) * 40503 ^ cands.length * 22465903) >>> 0;
  const tie = i => ((salt ^ strHash(cands[i].key) ^ Math.imul(i + 1, 2654435761)) >>> 0);
  const packV = [], headV = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    packV.push(P.value(state, pid, c.key, params, null, c));
    const a = P.actionFeatures(state, pid, c.key, c).map(r4);
    if (beta) {
      if (s.length + a.length !== beta.length) { console.error('⛔ 现算特征 ' + s.length + '+' + a.length + ' 维 ≠ 头的 ' + beta.length + ' 维 ⇒ 头的训练面与这台仪器的面不是同一个（读数作废）'); process.exit(3); }
      let z = 0; for (let j = 0; j < s.length; j++) z += beta[j] * s[j];
      for (let j = 0; j < a.length; j++) z += beta[s.length + j] * a[j];
      headV.push(z);
    } else headV.push(0);
  }
  return { cands: cands, packV: packV, headV: headV, tie: tie, n: cands.length, state: state, pid: pid,
    affN: aff.length, ep: (state.p && state.p[pid] ? state.p[pid].ep : 0) };
}
const argmax = (V, tie) => { let b = 0; for (let i = 1; i < V.length; i++) if (V[i] > V[b] || (V[i] === V[b] && tie(i) < tie(b))) b = i; return b; };
/** 复刻 `policy.js:654 forwardCands` 的两级采样分布（技能层取条目最大值 ⇒ 每技能一个槽位；条目层内部 softmax）。 */
function twoLevelOf(cands, V, temp) {
  const n = V.length, keys = [], bestOf = {}, kSum = {};
  for (let i = 0; i < n; i++) {
    const k = cands[i].key;
    if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
    if (V[i] > bestOf[k]) bestOf[k] = V[i];
  }
  let kmax = -1e9;
  for (let t = 0; t < keys.length; t++) if (bestOf[keys[t]] > kmax) kmax = bestOf[keys[t]];
  const kProb = {}; let ktot = 0;
  for (let t = 0; t < keys.length; t++) { kProb[keys[t]] = Math.exp((bestOf[keys[t]] - kmax) / temp); ktot += kProb[keys[t]]; }
  for (let t = 0; t < keys.length; t++) kProb[keys[t]] = ktot > 0 ? kProb[keys[t]] / ktot : 0;
  for (let i = 0; i < n; i++) kSum[cands[i].key] += Math.exp((V[i] - bestOf[cands[i].key]) / temp);
  const probs = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = cands[i].key;
    const within = kSum[k] > 0 ? Math.exp((V[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;
    probs[i] = kProb[k] * within;
  }
  return probs;
}
function sample(probs, cands, V, state) {
  const r = state.rng.next(); let acc = 0;
  for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r < acc) return cands[i]; }
  return cands[argmax(V, () => 0)];
}

const AGG = {};
function aggOf(k) {
  return (AGG[k] = AGG[k] || {
    games: 0, win: 0, rounds: 0, acts: 0, dec: 0, noChoice: 0, disagree: 0, nChk: 0, applied: 0, candSum: 0,
    affSum: 0, epSum: 0, epN: 0, repMax: 0, repArgDiff: 0, repN: 0, perGame: [], nHist: [], byCard: {}, hands: 0
  });
}
/* 广度四量走 `tools/log-reading.mjs` 的**唯一一份**实现（与真机栏、模拟装配栏可并排读）。
 * ⚠ 键对不上必须**响亮失败**：静默跳过就等于"这张卡从来没被打过"（D216 那条同一族的病）。 */
const CT = loadCardTable();
function aggPlay(agg, key) {
  const nm = CT.byKey[key];
  if (!nm) { console.error('⛔ 引擎给出的技能键 `' + key + '` 不在 `js/core/rules.js` 的 `.key` 里 ⇒ 广度会静默漏数'); process.exit(3); }
  agg.byCard[nm] = (agg.byCard[nm] || 0) + 1; agg.hands++;
}

function chooser(arm, head, agg, fallback) {
  if (arm === 'a0') { const b = T.policyChooserN(params, TEMP); return function (state, pid, legal) { const r = b(state, pid, legal); if (r) { agg.acts++; aggPlay(agg, r.key); } return r; }; }
  const isCtl = arm.indexOf('rnd') === 0;                       /* 随机方向对照臂：同一个 λ、同一套公式，只把 β 换成随机向量 */
  const HH = isCtl ? CTRL : head;
  const isHead = arm === 'head' || arm === 'headT' || arm.indexOf('lam') === 0 || isCtl;
  const isTemp = arm === 'packT' || arm === 'headT' || arm.indexOf('lam') === 0 || isCtl;
  const LAM = (arm.indexOf('lam') === 0 || isCtl) ? Number(arm.slice(3)) : null;
  return function (state, pid, legal) {
    const t = table(state, pid, legal, isHead ? HH.beta : null);
    let pick;
    if (!t) { agg.noChoice++; pick = fallback(state, pid, legal); }
    else {
      let V;
      if (LAM !== null) {
        /* `packV + λ·σp·(头分去均值)/σh`：去均值 ⇒ 每决策一个常数偏移，被 `twoLevelOf` 里的 `−kmax` 精确抵消；
           λ=0 时逐字退回 `packV` ⇒ 与 `packT` **必须**给同一串出手（表里那一行是这条的凭据）。 */
        const mh = mean(t.headV), k = LAM * (CAL.sigmaP / HH._calSigmaH);
        V = t.packV.map((v, i) => v + k * (t.headV[i] - mh));
      } else V = isHead ? t.headV : t.packV;
      const i = argmax(V, t.tie);
      if (isTemp) {
        /* 判据④：与出厂 `forwardCands` 逐格对概率。**只有 `packT` 臂能当这个凭据**（`headT` 的 logits 本来就不同）。 */
        const f = P.forwardCands(state, pid, t.cands, params, { temp: TEMP });
        if (!isHead) {
          const mine = twoLevelOf(t.cands, t.packV, TEMP);
          let mx = 0; for (let k = 0; k < mine.length; k++) mx = Math.max(mx, Math.abs(mine[k] - f.probs[k]));
          agg.repN++; agg.repMax = Math.max(agg.repMax, mx);
          let fa = 0, fb = -1e9; for (let k = 0; k < t.packV.length; k++) if (t.packV[k] > fb) { fb = t.packV[k]; fa = k; }
          if (fa !== f.argmax) agg.repArgDiff++;
        }
        pick = sample(twoLevelOf(t.cands, V, TEMP), t.cands, V, state);
      } else {
        pick = t.cands[i];
      }
      agg.dec++; agg.candSum += t.n; agg.nHist.push(t.n); agg.affSum += t.affN; agg.epSum += t.ep; agg.epN++;
      /* 分歧率：**同一个状态**上两臂各取一次 max ⇒ "这一档到底改了决定没有"的直接凭据（§E192 那条：
         新旋钮的第一读 = 与上一档是否逐格相同）。temp 臂这一列是"**打分层**分歧"，与实际抽到哪一手无关。 */
      if (isHead && i !== argmax(t.packV, t.tie)) agg.disagree++;
      if (CHK && (agg.dec % CHK === 0)) {
        const probe = S.cloneState(state);
        S.attemptAction(probe, pid, pick.key, { bead: pick.bead || null, target: pick.target == null ? null : pick.target, target2: pick.target2 == null ? null : pick.target2 });
        const act = probe.actions && probe.actions[pid];
        agg.nChk++; if (act && act.key === pick.key) agg.applied++;
      }
    }
    agg.acts++; aggPlay(agg, pick.key);
    return { key: pick.key, target: pick.target == null ? null : pick.target, target2: pick.target2 == null ? null : pick.target2, bead: pick.bead || null };
  };
}

function playOne(arm, head, env, g, seed, agg) {
  const rnd = mulberry32(seed + g * 7919 + env.name.length * 131);         /* 与 §E195/§E223 采标签那一遍同一套局种子 */
  const st = S.createState(CFG_MODE, { next: rnd }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
  const champ = T.policyChooserN(params, TEMP);
  const fallback = T.policyChooserN(params, TEMP);                          /* 候选表 <2 时的兜底（与 a0 同口径） */
  Play.autoGameN(st, [mimic, chooser(arm, head, agg, fallback), env.sel, env.sel, champ]);
  const me = st.p[FOCUS];
  agg.games++;
  const won = (me && me.hp > 0 && st.p.every((q, i) => i === FOCUS || q.hp <= me.hp)) ? 1 : 0;
  if (won) agg.win++;
  agg.rounds += st.round;
  agg.perGame.push({ env: env.name, g: g, won: won, alive: !!(me && me.hp > 0), rounds: st.round });
}

/* ---------- 开跑前把配对钉死：每一带用的头必须**训在另一带** ----------
 * `--seeds` 支持两种写法：
 *   `3100,9200`         = 严格留出（带 3100 用训于 9200 的那枚，且该枚的 `testSeed` 必须正好是 3100）
 *   `5150#3100`         = **第三带复现**：带 5150 用训于 3100 的那枚 ⇒ 这一带压根不是它的留出带，
 *                          但也从没进过训练 ⇒ 拿它当"换一批桌子还成不成立"的独立复现组（判据同向才算）。 */
const BANDS = String(arg('seeds', '3100,9200')).split(',').filter(Boolean).map(x => {
  const m = /^(\d+)(?:#(\d+))?$/.exec(x.trim());
  if (!m) { console.error('⛔ `--seeds` 写法不对：`' + x + '`（应为 `带种子` 或 `带种子#头的训练带`）'); process.exit(4); }
  return { seed: Number(m[1]), wantTrain: m[2] ? Number(m[2]) : null };
});
const SEEDS = BANDS.map(b => b.seed);
const headFor = {};
for (const b of BANDS) {
  const c = b.wantTrain ? HEADS.filter(h => h.trainSeed === b.wantTrain) : HEADS.filter(h => h.trainSeed !== b.seed && h.testSeed === b.seed);
  if (c.length !== 1) { console.error('⛔ 带 ' + b.seed + ' 找不到唯一合规的头（找到 ' + c.length + ' 枚）⇒ 样本外无法保证' + (b.wantTrain ? '；`#' + b.wantTrain + '` 指定的训练带我手里没有' : '')); process.exit(4); }
  if (c[0].testSeed === b.seed && c[0].trainSeed === b.seed) { console.error('⛔ 带 ' + b.seed + ' 用的是训在同一带的头 ⇒ 这是**样本内**，不许'); process.exit(4); }
  headFor[b.seed] = c[0];
}
const NEED = LAMS.length ? ['packT'] : ['pack', 'head'];      /* 只跑 λ 族时不必带贪心两臂（①会自己跳过），但必须有 `packT` 当参照 */
for (const req of NEED) if (ARMS.indexOf(req) < 0) { console.error('⛔ 判据要 `' + req + '` 臂 ⇒ --arms 必须含它（当前 --arms=' + ARMS.join(',') + '）'); process.exit(4); }
if (!QUIET) {
  console.log('# §E223 第二步 · 蒸馏头当策略的产品桌 A/B（n=5 ‖ 焦点席 1 号 ‖ ' + ENVS.length + ' 环境 × ' + GAMES + ' 局/带 × ' + SEEDS.length + ' 带 ‖ ' + (GAMES * ENVS.length * SEEDS.length * ARMS.length) + ' 局 ‖ temp=' + TEMP + '）');
  for (const s of SEEDS) console.log('#   带 ' + s + ' 用的头：训于 ' + headFor[s].trainSeed + (headFor[s].testSeed === s ? '（留出带）' : '（**第三带**：既没训过也不是它的留出带 ⇒ 独立复现组）') + ' ‖ 第一步留出一致率 ' +
    headFor[s].heldoutAgree.toFixed(1) + '% vs 现役包 ' + headFor[s].packAgree.toFixed(1) + '% ‖ 教师天花板 ' + headFor[s].ceiling.toFixed(1) + '%');
  console.log('# 判据（写死）：① `head − pack` 两带同号且逐局配对 95% 区间不含 0 ② 分歧率 >5% ③ 递交被接受率 ≥99% ④ 复刻概率与 `forwardCands` 逐格差 <1e-9');
  console.log('# ①\' 次级（跑前写死）：`headT − packT` 同规则 ⇒ 那才是"能不能上线"那一问（只差打分器一个自由量）；`a0` 只当参照电平（还差 lockTarget）。');
  if (CFG_MODE !== 'multi') console.log('# ⚠ 本遍**换了配置**：`--config=' + CFG_MODE + '`（血量 ' + R.MODES[CFG_MODE].hp + ' 珠 ‖ 默认 `multi` = ' + R.MODES.multi.hp + ' 珠）' +
    ' ⇒ 绝对电平与配对差**只能在配置内部比**；跨配置可比的是"同一量在两处的取值"（`headT − packT` 各自多少）');
  if (LAMS.length) {
    console.log('# λ 族（本轮追加，跑前写死）：`score = P.value + λ·σp·(头分−决策内均值)/σh`，σp/σh 由 `--calib` 的 dump 现算（' +
      (CAL ? 'σp=' + CAL.sigmaP.toFixed(4) + ' ‖ σh=' + HEADS.map(h => h._calSigmaH.toFixed(4)).join('/') + ' ‖ 标定决策数 ' + CAL.n : '**未给 → 会拒跑**') + '）');
    console.log('#   判据：①λ=0 必须与 `packT` 逐局相同（否则整族作废）②存在 λ>0 两/四带同号为正且合并区间不含 0 ⇒ 混合打分有产品增益；③最好的 λ 落在梯度顶端 ⇒ 曲线被截断，得再延一档。');
    if (RC.length) console.log('# 随机方向对照（`--randctl=' + RC.join(',') + '`）：同一个 λ、同一套公式，只把 β 换成固定种子的随机向量 ⇒ **`口味−扰动@λ`** 那一行才是"钱是不是教师的口味买的"；它≈0 而 λ 为正 ⇒ 钱是"把 argmax 打散一点"买的（§E205 的 temp 那条同族）。');
  }
}

for (const s of SEEDS) for (const arm of ARMS) {
  const agg = aggOf(s + '|' + arm);
  for (const env of ENVS) for (let g = 0; g < GAMES; g++) playOne(arm, headFor[s], env, g, s, agg);
  process.stdout.write('|');
}
process.stdout.write('\n');

const w = a => 100 * a.win / Math.max(1, a.games);
const wr = k => AGG[k];
const has = k => !!AGG[k];
console.log('\n## 夺冠率（焦点席 1 号）');
console.log('| 带 | 臂 | 夺冠 % | 局长 | 每局出手 | 没得选(兜底) | 候选数均值(中位) | 可付卡均值 | 决策时 ep 均值 | 与现役包分歧 | 递交被接受 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of SEEDS) for (const arm of ARMS) {
  const a = wr(s + '|' + arm);
  const srt = a.nHist.slice().sort((x, y) => x - y);
  console.log('| ' + s + ' | `' + arm + '` | **' + w(a).toFixed(1) + '%** | ' + (a.rounds / Math.max(1, a.games)).toFixed(1) + ' | ' +
    (a.acts / Math.max(1, a.games)).toFixed(1) + ' | ' +
    (100 * a.noChoice / Math.max(1, a.acts)).toFixed(1) + '% | ' + (a.candSum / Math.max(1, a.dec)).toFixed(1) + '（' + (srt[Math.floor(srt.length / 2)] || 0) + '） | ' +
    (a.affSum / Math.max(1, a.epN)).toFixed(1) + ' | ' + (a.epSum / Math.max(1, a.epN)).toFixed(2) + ' | ' +
    (a.disagree ? (100 * a.disagree / Math.max(1, a.dec)).toFixed(1) + '%' : (a.dec ? '0.0%（与包逐手相同）' : '—')) + ' | ' +
    (a.nChk ? (100 * a.applied / a.nChk).toFixed(1) + '%（' + a.nChk + ' 抽验）' : '—') + ' |');
}
/* 广度四量走**唯一一份**实现（`tools/log-reading.mjs`）⇒ 这一列与真机栏、模拟装配栏可以直接并排读，
 *   不必担心"两份名单漂成两个数"（D117/D216 那一族）。用户的病名是"只会几张卡"⇒ 胜率之外必须同印这一列。 */
console.log('\n## 广度（焦点席自己的出手 ‖ `breadth()` = 真机栏那一份实现 ⇒ 可并排读）');
console.log('| 带 | 臂 | 有效出手 | 种数 | 前3 占比 | `G=exp(H)` | 防御类 | 前三 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const s of SEEDS) for (const arm of ARMS) {
  const a = wr(s + '|' + arm), B = breadth(a.byCard, a.hands), D = defShare(a, CT);
  console.log('| ' + s + ' | `' + arm + '` | ' + a.hands + ' | ' + B.kinds + ' | ' + B.top3.toFixed(1) + '% | ' + B.G.toFixed(2) + ' | ' +
    D.share.toFixed(1) + '% | ' +
    B.rows.slice(0, 3).map(r => r.name + ' ' + (100 * r.n / a.hands).toFixed(1) + '%').join(' · ') + ' |');
}
/* 逐环境的**配对差**（对 `packT` 比）：判据只看合并量，这张表只用来**点名下一步的假设**。
 * ⚠ 六格多重比较 ⇒ 单格显著不算结论（§E187 那条：分母要对齐；这里另给每格自己的区间）。 */
const TEMPARMS = ['headT'].concat(LAMS.map(l => 'lam' + l), RC.map(r => 'rnd' + r)).filter(a => has(SEEDS[0] + '|' + a) && has(SEEDS[0] + '|packT'));
if (TEMPARMS.length) {
  console.log('\n## 分环境的配对差（对 `packT`，pt；每格 = 该环境下所有带的逐局配对）');
  console.log('| 环境 | ' + TEMPARMS.map(a => '`' + a + '`').join(' | ') + ' |');
  console.log('|---|' + TEMPARMS.map(() => '---|').join(''));
  const signRuns = {};
  for (const a of TEMPARMS) signRuns[a] = [];
  for (const env of ENVS) {
    const cells = TEMPARMS.map(armB => {
      const d = [];
      for (const s of SEEDS) {
        const pa = wr(s + '|packT').perGame.filter(x => x.env === env.name);
        const pb = wr(s + '|' + armB).perGame.filter(x => x.env === env.name);
        d.push.apply(d, pa.map((x, i) => pb[i].won - x.won));
      }
      return (100 * mean(d) >= 0 ? '+' : '') + (100 * mean(d)).toFixed(1) + ' ±' + (100 * ci(d)).toFixed(1);
    });
    console.log('| `' + env.name + '` | ' + cells.join(' | ') + ' |');
    for (const armB of TEMPARMS) {
      const v = SEEDS.map(s => {
        const pa = wr(s + '|packT').perGame.filter(x => x.env === env.name);
        const pb = wr(s + '|' + armB).perGame.filter(x => x.env === env.name);
        return mean(pa.map((x, i) => pb[i].won - x.won));
      });
      signRuns[armB].push(env.name + ':' + (v.every(x => x > 0) ? '全正' : v.every(x => x < 0) ? '全负' : v.every(x => x === 0) ? '全零' : '不同号'));
    }
  }
  console.log('  各环境的**跨带符号**（全正 / 全负 / 全零 / 不同号）：');
  for (const armB of TEMPARMS) console.log('    `' + armB + '` ' + signRuns[armB].join('  '));
}
/* ---------- 判据读数 ---------- */
console.log('\n## 判据');
let pairP = null, pairQ = null; const PAIRS = {};
function paired(armA, armB) {                                  /* armB − armA，逐局配对（同 env、同 g ⇒ 同局种子） */
  const bd = {}, all = [];
  for (const s of SEEDS) {
    const a = wr(s + '|' + armA), h = wr(s + '|' + armB);
    const d = a.perGame.map((x, i) => h.perGame[i].won - x.won);
    bd[s] = d; all.push.apply(all, d);
  }
  return { bd: bd, all: all, A: armA, B: armB };
}
const PAIR_SPECS = [['pack', 'head', '①'], ['packT', 'headT', "①'"]]
  .concat(LAMS.map(l => ['packT', 'lam' + l, 'λ=' + l]))
  /* 最要紧的一列：**同一个 λ 上"教师方向 − 随机方向"**（同种子逐局配对）。
     若这一列≈0 而 `λ=… − packT` 为正 ⇒ 赚钱的是"把 argmax 打散一点"，不是"搜索的口味"。 */
  .concat(RC.filter(r => LAMS.indexOf(r) >= 0).map(r => ['rnd' + r, 'lam' + r, '口味−扰动@λ=' + r]));
for (const spec of PAIR_SPECS) {
  const [A, B, tag] = spec;
  if (!has(SEEDS[0] + '|' + A) || !has(SEEDS[0] + '|' + B)) continue;
  const p = paired(A, B);
  console.log('  ' + tag + ' `' + B + ' − ' + A + '`：' + SEEDS.map(s => '带 ' + s + ' **' + (100 * mean(p.bd[s])).toFixed(2) + ' ±' + (100 * ci(p.bd[s])).toFixed(2) + 'pt**').join(' ‖ '));
  console.log('     ‖ 合并 **' + (100 * mean(p.all)).toFixed(2) + ' ±' + (100 * ci(p.all)).toFixed(2) + 'pt**（' + p.all.length + ' 局逐局配对）‖ 本档能检出的最小效应 = 区间半宽 ' + (100 * ci(p.all)).toFixed(1) + 'pt');
  p.ok = SEEDS.every(s => Math.sign(mean(p.bd[s])) === Math.sign(mean(p.all)) && mean(p.bd[s]) !== 0) &&
    Math.abs(100 * mean(p.all)) - 100 * ci(p.all) > 0 && mean(p.all) > 0;
  p.neg = SEEDS.every(s => Math.sign(mean(p.bd[s])) === Math.sign(mean(p.all)) && mean(p.bd[s]) !== 0) &&
    Math.abs(100 * mean(p.all)) - 100 * ci(p.all) > 0 && mean(p.all) < 0;
  p.verdict = p.ok ? '立住为正' : p.neg ? '**显著为负（这一换赔胜率）**' : '没立住（区间含 0 或跨带不同号）';
  console.log('     ⇒ ' + tag + ' 判定：' + p.verdict);
  PAIRS[tag] = p;
  if (tag === '①') pairP = p; else if (tag === "①'") pairQ = p;
}
/* λ=0 的**逐字相同**检查：混合公式在 λ=0 时必须退回 `packV` ⇒ 与 `packT` 该给出**同一串出手**。
 * 这条不是装饰：它证明"λ 这一族里唯一的自由量就是 λ"，也证明我没有在旁边偷偷换候选表/采样。 */
if (has(SEEDS[0] + '|lam0') && has(SEEDS[0] + '|packT')) {
  let diff = 0, n = 0;
  for (const s of SEEDS) { const a = wr(s + '|packT'), b = wr(s + '|lam0'); n += a.games; for (let i = 0; i < a.perGame.length; i++) if (a.perGame[i].won !== b.perGame[i].won) diff++; }
  console.log('  λ=0 忠实性：与 `packT` 逐局不同的结果 **' + diff + '/' + n + '**（需要 0 ‖ 大于 0 ⇒ 混合公式在 λ=0 就没退回原口径，整族 λ 读数作废）');
  if (diff) console.log('  ⛔ λ=0 没退回 `packT` ⇒ 这一族的读数全部作废，先修公式');
}
{
  const ks = LAMS.filter(l => l > 0 && PAIRS['λ=' + l]);
  if (ks.length) {
    const best = ks.map(l => ({ l: l, m: 100 * mean(PAIRS['λ=' + l].all), ci: 100 * ci(PAIRS['λ=' + l].all), ok: PAIRS['λ=' + l].ok }))
      .sort((x, y) => y.m - x.m);
    console.log("  λ 剂量梯（对 `packT`，合并 pt）：" + best.map(x => 'λ=' + x.l + ' **' + (x.m >= 0 ? '+' : '') + x.m.toFixed(2) + ' ±' + x.ci.toFixed(2) + '**' + (x.ok ? '（立住为正）' : '')).join(' ‖ '));
    const top = best[0];
    if (top.ok && top.l === Math.max.apply(null, ks)) console.log('  ⚠ 最好的 λ 恰好是**梯度顶端** ⇒ 曲线被截断，不能就此收口，要往大再延一档');
    console.log('  判据（跑前写死的 λ 版）：存在 λ>0 使两/四带同号为正且合并区间不含 0 ⇒ "混合打分"有产品增益；全为负或含 0 ⇒ λ 这条也关掉。');
  }
}
const headAgg = SEEDS.map(s => (['head', 'headT'].some(a => AGG[s + '|' + a]) ? ['head', 'headT'] : ['lam' + LAMS[LAMS.length - 1], 'rnd' + RC[RC.length - 1]])
  .filter(a => AGG[s + '|' + a]).map(a => wr(s + '|' + a))).flat()
  .reduce((a, x) => ({ disagree: a.disagree + x.disagree, dec: a.dec + x.dec }), { disagree: 0, dec: 0 });
const headArmNote = (['head', 'headT'].some(a => AGG[SEEDS[0] + '|' + a])) ? '头臂与包臂' : '（本轮没跑整张脸换掉的臂 ⇒ 这一列取**最大 λ 档**的分歧）';
const dis = 100 * headAgg.disagree / Math.max(1, headAgg.dec);
/* ⚠ 这一条曾经写成 `.filter(...)` 就接 `.flat()`（漏了 `.map(...)`）⇒ 迭代到的是**字符串**，
 *   `x.nChk` = undefined ⇒ `chk.n` = NaN ⇒ 打印"未抽验"，而同一份日志的表格里明明有 394 次抽验。
 *   ⇒ 通用形：**汇总守卫自己也要能被"表里有数、汇总为 0"这种矛盾当场揭穿**；所以这里加了一条硬检：
 *     若任一臂的 `nChk > 0` 而合计不是正数，就响亮报错而不是安静地打"未测"。 */
const chkArms = SEEDS.map(s => ARMS.filter(a => a !== 'a0' && AGG[s + '|' + a]).map(a => wr(s + '|' + a))).flat();
const chk = chkArms.reduce((a, x) => ({ applied: a.applied + x.applied, n: a.n + x.nChk }), { applied: 0, n: 0 });
if (chkArms.some(x => x.nChk > 0) && !(chk.n > 0)) { console.error('⛔ ③ 的汇总算错了：逐臂有抽验（' + chkArms.map(x => x.nChk).join('/') + '）而合计 = ' + chk.n); process.exit(5); }
const ap = chk.n ? 100 * chk.applied / chk.n : NaN;
const rep = SEEDS.map(s => wr(s + '|packT')).filter(Boolean).reduce((a, x) => ({ max: Math.max(a.max, x.repMax), argDiff: a.argDiff + x.repArgDiff, n: a.n + x.repN }), { max: 0, argDiff: 0, n: 0 });
console.log('  ② ' + headArmNote + '的**打分层 argmax 分歧率 ' + dis.toFixed(1) + '%**（需要 >5%）‖ ③ 递交被接受率 ' +
  (chk.n ? '**' + ap.toFixed(1) + '%**（需要 ≥99%‖抽验 ' + chk.n + '）' : '**未抽验**（`--chk` 大于每局出手数 ⇒ 这一条压根没测，不许当通过）'));
console.log('  ④ 复刻忠实性：**最大逐格概率差 ' + rep.max.toExponential(2) + '** ‖ argmax 不同 ' + rep.argDiff + '/' + rep.n + ' 决策（需要 <1e-9 且全同）' +
  (rep.n ? (rep.max < 1e-9 && rep.argDiff === 0 ? ' ✔ ⇒ `headT/packT` 那两臂的读数可用' : ' ⛔ ⇒ 复刻不忠实，①\' 不给读数') : '（未跑 packT 臂）'));
if (ARMS.indexOf('a0') >= 0) {
  console.log('  ‖ 参照电平（**不进判据**，`a0` 与 `packT` 还差 `lockTarget` 一项）：');
  for (const s of SEEDS) {
    const cells = ARMS.map(a => '`' + a + '` ' + w(wr(s + '|' + a)).toFixed(1) + '%');
    console.log('    带 ' + s + '：' + cells.join(' ‖ '));
  }
}
const fails = [];
if (!pairP) fails.push('① 没跑（缺 pack/head 臂）');
else if (!pairP.ok) fails.push('① 贪心口径：' + pairP.verdict);
if (pairQ && rep.n && !(rep.max < 1e-9 && rep.argDiff === 0)) fails.push('④ 复刻不忠实 ⇒ ①\' 作废');
else if (pairQ && !pairQ.ok) fails.push("①' 生产采样口径：" + pairQ.verdict);
if (dis <= 5) fails.push('② 两臂几乎不分歧，这一档没跑起来');
if (!chk.n) fails.push('③ 递交保真**没测到**（抽验 0 次）');
else if (ap < 99) fails.push('③ 递交被静默降级，差不可归因');
{
  const ks = LAMS.filter(l => l > 0 && PAIRS['λ=' + l]);
  if (ks.length && !ks.some(l => PAIRS['λ=' + l].ok)) {
    const allNeg = ks.every(l => PAIRS['λ=' + l].neg);
    fails.push('λ 族：' + (allNeg ? '**全档显著为负**' : '没有一档立住为正'));
  }
}
console.log('  ⇒ ' + (fails.length
  ? '判据未全过：' + fails.join('‖') + '。 一致率增益换不成（可检出的）胜率 ⇒ 这一格降级为"学得来口味、换不来胜率"。'
  : '**全过：蒸馏头买到的是胜率，不只是口味。** 下一步才谈进训练（现算的头 ≠ 真训练出来的头）。'));
/* ---------- "捕捉率"换算：把"没立住"从含糊变成有价签 ---------- */
{
  const cap = HEADS.map(h => (h.heldoutAgree - h.packAgree) / Math.max(1e-9, h.ceiling - h.packAgree));
  const capt = 100 * mean(cap);
  console.log('\n## 换算：头到底捕捉了教师的几成（这一格把"区间含 0"变成"效应本来就这么小"）');
  console.log('  捕捉率 = (头一致率 − 包一致率) / (教师天花板 − 包一致率) = **' + capt.toFixed(0) + '%**（逐头 ' + cap.map(x => (100 * x).toFixed(0) + '%').join(' ‖ ') + '）');
  const q = pairP || pairQ;
  for (const [nm, pt] of [['§E193 一手搜索当策略（同表、关档口径）≈ +4.7pt', 4.7], ['§E203 一手完美根决策净上限（膨胀校正后）≈ +12~18pt', 15]]) {
    const pred = capt / 100 * pt;
    console.log('  ‖ 教师整体值 +' + pt + 'pt（' + nm + '）⇒ 按捕捉率线性折算的头增益 ≈ **+' + pred.toFixed(1) + 'pt**' +
      (q ? '；本档实测 ' + (100 * mean(q.all)).toFixed(1) + ' ±' + (100 * ci(q.all)).toFixed(1) + 'pt ⇒ 预测' + (pred < 100 * ci(q.all) ? '**落在分辨率之内（这一档既没证实也没证伪）**' : '落在分辨率之外（可检）') : ''));
    if (q) {
      const sdv = sd(q.all), need = Math.ceil(Math.pow(1.96 * sdv / (pred / 100), 2));
      console.log('     ‖ 要检出 +' + pred.toFixed(1) + 'pt 需要约 **' + need + '** 局/臂（当前 ' + q.all.length + ' 局；按实测逐局差 sd=' + sdv.toFixed(3) + '）');
    }
  }
}
/* ⚠ 这一行以前印的是 `SEEDS.join(',')`，**把 `#训练带` 后缀抹掉了** ⇒ 照它复跑会挑到别的头（§E223 那两遍实际用的是
   `5150#9200` 这种第三带配对，日志里却印成 `5150`）⇒ "复跑命令"印错比不印更坏。现在按 BANDS 原样印。 */
console.log('\n## 复跑命令\n  node tools/probe-distill-player.mjs --heads=' + arg('heads', '') + ' --seeds=' + BANDS.map(b => b.seed + (b.wantTrain ? '#' + b.wantTrain : '')).join(',') + ' --games=' + GAMES + ' --envs=' + ENV_PICK.join(',') + ' --arms=' + ARMS.join(',') +
  (LAMS.length ? ' --lambdas=' + LAMS.join(',') + ' --calib=' + arg('calib', '') : ''));
console.log('rc=0');
