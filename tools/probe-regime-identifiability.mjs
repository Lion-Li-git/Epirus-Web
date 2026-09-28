#!/usr/bin/env node
/* ============================================================================
 * probe-regime-identifiability.mjs —— **多包路由到底能拿到多少 oracle 上界**（v1.5.288 · §E129）
 *
 * 为什么要有它：用户头号目标是"在不同环境下用不同策略"。§E124/§E125 把两条不改网络的路（桌形、聚合）否证之后，
 * 只剩两个选项：① 改观测面（`js/train/policy.js` ⇒ **规则指纹换代**）；② 多包路由（chooser 层按环境换打法，不碰指纹）。
 * §E49 量过的 `oracle 上界 = mean_r max_p fit(p,r)` 是**拿真环境标签挑包**算的，不可实现。
 * 本工具回答真正该问的那一句：**只看得到桌面行为的路由器，能拿到那份上界的几成？**
 *
 * 签名 = **前 K 回合对手席出招的"类别直方图"**（归一化，**置换不变**）
 *   ⇒ 与 §18-E 提议加进 `policy.js` 的那组特征是同一个东西，所以一次实验同时回答两件事：
 *      路由值不值（R）+ 那组特征有没有分辨力（LOO 准确率 / placebo 对照）。
 * ⚠ 标签**只用于评分**，绝不进特征，也绝不进选包：每个环境的包都由 **leave-one-out** 从"其它环境"里挑。
 *
 * 判据：**跑前**写在 §E129 的是 ① 准确率 < 25% ⇒ 路由不可实现；② R ≥ 0.5 且准确率 ≥ 50% ⇒ 值得做且不必动指纹；
 *   ③ 0.2 ≤ R < 0.5 ⇒ 只报数；④ R < 0.2 ⇒ 支持改观测面（oracle − best_single < 0.02 ⇒ ⑤ 上界本身不存在）。
 * ⚠ 主读数（K=3）出来后 ① 与 ③ 在同一次运行里**自相矛盾**（13% 判"不可实现"，可 realizable 确实 > best_single）
 *   ⇒ ① 的绝对阈值是我写错的推断，已换成 ①′"准确率 ≥ 2×max(随机, placebo) 才算签名有分辨力"。
 *   **这条改动是看过数据之后做的**，所以：原始预注册与两条读数都原样留在 §E129，代码这里只是不再打印自相矛盾的判词。
 *
 * 用法：node tools/probe-regime-identifiability.mjs --matrix=<probe-regime-fitness 的 --json 产物>
 *      [--games=40] [--k=3] [--n=3] [--seed=4243] [--json=<输出路径>]
 * 除 `--json=` 指定的那一个输出文件外**只读**：不写仓库、不改引擎、不碰出厂权重。
 * ==========================================================================*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32 } from './audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { poolFromSpecs, heldFromNames, HELDOUT } from './regime-panel.mjs';
import { bestInByEnv, routingReadings, matrixComplaint, metricOrThrow, bestSingleOf, medianOf, shareOf, decideSwitch, nearestDistinct } from './routing-gain-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['matrix', 'games', 'k', 'n', 'seed', 'json', 'quiet', 'exclude', 'metric', 'dump', 'abstain']);
/* `--metric=fit|win|noDiv`（§E130）：**签名与分类链路一字不动，只换打分那一列**。
 * 动因是 §E129 判读第 5 节我自己写下的那条限制——"`fit` 不是胜率"。矩阵里每格本来就同时有
 * `fit / noDiv / win / sd` ⇒ 同一套预测可以同时在两个量纲上打分，不必再打一局。
 * ⚠ 预注册那条"上界缺口 < 0.02 就判⑤"的 0.02 是在 **fit** 上定的，换量纲**不重定阈值**（重定就是扫参）。 */
let METRIC = 'fit';
try { METRIC = metricOrThrow(arg('metric', 'fit')); } catch (e) { console.error('⛔ ' + e.message); process.exit(2); }
/* §E131 的弃权闸。名字写错必须响亮拒 —— 把拼错读成"没开闸"会让人把一个**没生效**的实验当成生效版引用。 */
const ABSTAIN = arg('abstain', 'off');
if (['off', 'dist', 'share', 'both'].indexOf(ABSTAIN) < 0) {
  console.error('⛔ --abstain 只认 off|dist|share|both（实测 `' + ABSTAIN + '`）⇒ 拒绝拿拼错的规则名当"未开闸"');
  process.exit(2);
}

const GAMES = Math.max(4, Number(arg('games', 40)) || 40);
const K = Math.max(1, Number(arg('k', 3)) || 3);
const N = Math.max(3, Number(arg('n', 3)) || 3);
const SEED0 = Number(arg('seed', 4243)) || 4243;
const MATRIX = arg('matrix', '');
if (!MATRIX || !existsSync(MATRIX)) {
  console.error('⛔ 必须给 --matrix=<probe-regime-fitness --json=… 的产物>（读不到 ⇒ 拒绝用假矩阵算上界）');
  process.exit(2);
}
const M = JSON.parse(readFileSync(MATRIX, 'utf8'));
/* ⚠ `probe-regime-fitness --json` 的行键是 **`label`**（不是 `pack`）—— 第一版读错键 ⇒
 * `bestIn[e]` 全成 `undefined` ⇒ 交集塌成 0 个环境、`best_single` 报 `-Infinity`、随机基线报 100%，
 * 而工具**不崩**、照样打出一整屏看起来合理的数 ⇒ 这正是 §E121 那族"读不出冒充读数"的形状。
 * 所以现在：两种键都认，且**认不出就点名退出**，不再让 0 个环境溜过去。 */
const rows = (M.rows || []).map(r => ({ pack: r.label || r.pack || (r.file || '').replace(/^.*[\\/]/, '').replace(/\.bak$/, ''), per: r.per }))
  .filter(r => r && r.per && r.pack);
const ENVS = rows.length ? Object.keys(rows[0].per) : [];
/* 三条拒绝（包不足 3 / 有行没名字 / 环境不足 4）走 `matrixComplaint` —— 与门 D193 验的是**同一个函数**，
 * 不是"工具里写一遍、门里再写一遍"。`!r.pack` 那条在本工具这条路上已被上面的 filter 挡掉，
 * 它是给合成调用者（门）留的护栏，不是这里的死代码。 */
const complaint = matrixComplaint(rows, ENVS);
if (complaint) { console.error('⛔ ' + complaint); process.exit(2); }

const W = sandbox(), B = W.EpirusBots, T = W.EpirusTrainer, RU = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
if (!T || typeof T.oneGameN !== 'function' || !Play || typeof Play.autoGameN !== 'function') {
  console.error('⛔ 拿不到 oneGameN/autoGameN ⇒ 拒绝改用近似算法（那会让签名与训练分布不同形）'); process.exit(2);
}
/* 环境块定义与 probe-regime-fitness **同一份真源**（regime-panel），否则"池内/池外"两边不是同一个量 */
const { pool: POOL_BLOCKS, byFn } = poolFromSpecs(B, OPP_SPECS);
const regimes = POOL_BLOCKS.map(p => ({ name: p.name, sel: p.sel }));
for (const h of heldFromNames(B, byFn, Object.keys(HELDOUT))) {
  if (h.clash) continue;                                  // 同一脚本换名 ≠ 新环境
  if (ENVS.indexOf(h.name) < 0) continue;                 // 矩阵里没有它就算不上环境
  regimes.push({ name: h.name, sel: h.sel });
}
const live = regimes.filter(r => ENVS.indexOf(r.name) >= 0);
if (live.length < 4) { console.error('⛔ 与矩阵交集后环境数不足 4（' + live.length + '）'); process.exit(2); }
/* `--exclude=a,b`：**把指定环境整个从分类与打分里摘掉**。
 * 为什么要有它（§E129 的第三条检查，写死在跑之前）：K=3 有 6 个环境签名全空 ⇒ 被判"无可观测身份"、
 * 不参与打分（27 个环境），而 K=8 一个都不缺（33 个）⇒ **K=3 与 K=8 的 R 不是同一个分母**，
 * 直接说"R 从 0.24 涨到 0.53"混进了两个效应（窗口变长 + 环境变多）。
 * ⇒ 用 K=3 那批空签名的环境名去排除，让 K=8 在**同一批 27 个环境**上重算，才分得清是哪一条在起作用。 */
const EXCLUDE = arg('exclude', '').split(',').map(s => s.trim()).filter(Boolean);
if (EXCLUDE.length) {
  const names = new Set(live.map(r => r.name));
  const ghost = EXCLUDE.filter(x => !names.has(x));
  if (ghost.length) console.log('⚠ --exclude 里这些名字不在有效环境（typo？忽略）：' + ghost.join(', '));
  for (let i = live.length - 1; i >= 0; i--) if (EXCLUDE.indexOf(live[i].name) >= 0) live.splice(i, 1);
  console.log('⚠ 已排除 ' + EXCLUDE.filter(x => names.has(x)).length + ' 个环境 ⇒ 有效环境 ' + live.length + ' 个（分类与打分都用这一批）');
  if (live.length < 4) { console.error('⛔ 排除后有效环境不足 4 ⇒ 不出结论'); process.exit(2); }
}

/* ---- 签名：前 K 回合**对手席**（非 0 座）出招的类别直方图，归一化；0 座固定用中性脚本 ⇒ 不含标签 ---- */
const catSet = new Set();
for (const k of Object.keys(RU.byKey || {})) { const c = (RU.byKey[k] && RU.byKey[k].cat) || null; if (c) catSet.add(c); }
const CATS = [...catSet].sort();
const ci = {}; CATS.forEach((c, i) => { ci[c] = i; });
function signatureOf(rg) {
  /* 返回**每个游戏种子一条**签名（不是平均成一条）。
   * 为什么必须多样本：第一版把每环境平均成唯一样本，又在近邻里排除自己 ⇒ "预测命中"按构造永远是 0%，
   * 那不是"签名不可辨"，是**指标定义错了**（多样本才叫分类问题）。平均向量另外还会把"环境内离散度"抹掉。 */
  const out = [];
  const neutral = B.pickBalanced;
  if (typeof neutral !== 'function') { console.error('⛔ 中性 0 座脚本 pickBalanced 取不到'); process.exit(2); }
  for (let g = 0; g < GAMES; g++) {
    const acc = new Array(CATS.length).fill(0);
    const st = S.createState('multi', { next: mulberry32(SEED0 + g * 7919) }, N);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
    let stopAt = -1;
    const chs = [neutral];
    for (let i = 1; i < N; i++) chs.push(rg.sel);
    Play.autoGameN(st, chs, undefined, function () {
      if (stopAt < 0 && st.round > K) stopAt = st.events.length;   // 只取前 K 回合的事件 ⇒ 观察得到、不必知道环境名
    });
    const upto = stopAt < 0 ? st.events.length : stopAt;
    for (let i = 0; i < upto; i++) {
      const e = st.events[i];
      if (e && e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== RU.SK.JI && e.pid !== 0) {
        const c = (RU.byKey[e.key] || {}).cat;
        if (c != null && ci[c] != null) acc[ci[c]] += 1;
      }
    }
    let tot = acc.reduce((a, b) => a + b, 0);
    out.push({ v: tot ? acc.map(x => x / tot) : acc, tot });
  }
  return out;
}
const sigs = {}, emptySig = [];
for (const rg of live) {
  const per = signatureOf(rg);
  sigs[rg.name] = per;
  /* 空签名 = 这个环境前 K 回合对手一次没出手 ⇒ 它**没有可观测身份**（这是发现，不是故障），
   * 但绝不允许把全零向量当"和其他环境相似" ⇒ 判"不可辨"并如实计数。 */
  if (!per.some(s => s.tot > 0)) emptySig.push(rg.name);
}
if (emptySig.length) console.log('⚠ 这些环境在前 ' + K + ' 回合量不到任何对手出招（**没有可观测身份**，不参与分类也不参与选包）：' + emptySig.join(', '));
const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0));
const canUse = (nm) => sigs[nm] && sigs[nm].some(s => s.tot > 0);

/* ---- 样本池：每条 = 一个环境在一个游戏种子下的签名 ---- */
const samples = [];
for (const rg of live) for (const s of sigs[rg.name]) if (s.tot > 0) samples.push({ env: rg.name, v: s.v });
/* 留一（leave-one-sample-out）：判某条样本时，训练池里**剔除同一条样本**，但同环境的其它样本可以当邻居
 * —— 这才是"新来一桌，我认得这桌是什么打法"的真实设定（router 上线时同环境的历史桌是有的）。 */
function nearestOther(s, pool) {
  /* 判据本体在 `routing-gain-lib.nearestDistinct`（门 D193 喂合成向量直接验"并列不给答案"）。
   * 这里只负责把本工具的欧氏距离注进去。 */
  return nearestDistinct(s.v, pool, s, dist);
}
let hit = 0, judged = 0, ambiguous = 0;
const predOf = {};                                   // env -> 该环境所有样本的预测**众数**（选包用，保持稳定）
const predVotes = {};
const nnDists = {};                                  // env -> 该环境每条样本的最近邻距离（弃权闸的 `dist` 规则用）
const ambOf = {};                                    // env -> 该环境的歧义样本数（"这桌根本分不开"的直接读数）
const hitByEnv = {}, nByEnv = {};                    // 逐环境命中/样本数（dump 与聚类区间都要用；**在这里一次算完，不在别处重算近邻**）
for (const s of samples) {
  const nn = nearestOther(s, samples);
  if (!nn) continue;
  judged++;
  nByEnv[s.env] = (nByEnv[s.env] || 0) + 1;
  (nnDists[s.env] = nnDists[s.env] || []).push(nn.d);
  if (nn.ambiguous) { ambiguous++; ambOf[s.env] = (ambOf[s.env] || 0) + 1; continue; }   // 未命中，但不许替它编一个答案
  predVotes[s.env] = predVotes[s.env] || {};
  predVotes[s.env][nn.env] = (predVotes[s.env][nn.env] || 0) + 1;
  if (nn.env === s.env) { hit++; hitByEnv[s.env] = (hitByEnv[s.env] || 0) + 1; }          // 命中 = 最近邻也是同一个环境
}
const acc = judged ? hit / judged : NaN;
for (const e in predVotes) {
  const ent = Object.entries(predVotes[e]).sort((a, b) => b[1] - a[1]);
  predOf[e] = ent[0][0];
}
/* ---- placebo：把训练池的**标签**整体打乱后再跑同一套近邻 ⇒ 准确率必须掉到随机水平 ----
 * 不这么做，"准确率高"可能只是签名向量的尺度造成的假象（本仓 §E102 恒真行、D182 阳性对照同族）。 */
function shuffled(a) { const r = mulberry32(SEED0 + 991); const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
const realEnvs = [...new Set(samples.map(s => s.env))];
const perm = shuffled(realEnvs);
const relabel = {}; realEnvs.forEach((e, i) => { relabel[e] = perm[i]; });
let phit = 0, pj = 0;
for (const s of samples) {
  const nn = nearestOther(s, samples);
  if (!nn) continue;
  pj++;
  if (!nn.ambiguous && relabel[nn.env] === s.env) phit++;   // 歧义样本在 placebo 里同样不给命中（两边口径必须一致）
}
const pAcc = pj ? phit / pj : NaN;

/* ---- 打分：算式住在 `routing-gain-lib.mjs`（单一来源，门 D193 直接喂合成输入验它）----
 * 这里只负责决定"哪些环境参与打分"：要求 ① 矩阵里有最佳包，② 前 K 回合量得到行为。 */
const bestIn = bestInByEnv(rows, ENVS, METRIC);
const envsForScore = live.map(r => r.name).filter(e => bestIn[e] && canUse(e));
if (envsForScore.length < 4) {
  console.error('⛔ 可算环境不足 4（' + envsForScore.length + ' / live ' + live.length + '）⇒ **不出结论**，先查键名与面板是不是两份定义');
  process.exit(2);
}
/* ---- §E131 弃权闸（`--abstain=off|dist|share|both`，默认 off ⇒ 与 §E129/§E130 逐字同口径）----
 * `dist`：这桌的最近邻距离中位数 ≤ τ，τ = **同环境两两签名距离的中位数**（"同一个原型的两张桌子之间的典型距离"）；
 * `share`：留一投票众数占比 ≥ 0.5。两条都是跑前定死的、**没有可调分位数**（§E131 修订第 5 节）。
 * 弃权的环境**不改包**（落回这一量纲下的一招鲜）⇒ 这条路径上"认不出"从"猜一个邻居"变成"什么都不做"。 */
const withinD = [];
for (const rg of live) {
  const arr = (sigs[rg.name] || []).filter(s => s.tot > 0);
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) withinD.push(dist(arr[i].v, arr[j].v));
}
const TAU = medianOf(withinD);
const MIN_SWITCH = 5;                                       // §E131 反退化条款：换包环境不足 5 个 ⇒ 判"没有结论"
const ABSTAIN_ON = ABSTAIN !== 'off';
/* 落点 = 这一量纲下的一招鲜。**任何模式下都必须给**（v1.5.289）：没有票的环境不能被跳过，
 * 否则 `realizable` 与 `oracle` 就不是同一批环境的均值，`R` 会冲出 1（§E131 实测踩过 R=2.81）。 */
const FALLBACK = bestSingleOf(rows, envsForScore, METRIC).pack;
const switchInfo = {};
const picksAbstain = {};
for (const e of envsForScore) {
  const nnMed = medianOf(nnDists[e]);
  const sh = shareOf(predVotes[e]);
  const dec = decideSwitch(ABSTAIN, { nnMed: nnMed, tau: TAU, share: sh.share });
  switchInfo[e] = { nnMed: nnMed, tau: TAU, share: sh.share, canSwitch: dec.canSwitch, predicted: predOf[e] || null };
  picksAbstain[e] = dec.canSwitch ? predOf[e] : null;
}
const RD = routingReadings({ rows, envs: envsForScore, bestIn, picks: ABSTAIN_ON ? picksAbstain : predOf,
  acc, placebo: pAcc, metric: METRIC, fallbackPack: FALLBACK, abstainOn: ABSTAIN_ON, minSwitch: MIN_SWITCH });
const { bestSingle, bestSinglePack, realizable, oracle, gap, R, chance, informative, verdict } = RD;
function pct1(x) { return (100 * x).toFixed(0) + '%'; }

console.log('# 多包路由可实现性 · ' + rows.length + ' 粒包 × ' + ENVS.length + ' 环境 · 签名=前 ' + K + ' 回合对手类别直方图 · 留一最近邻(逐样本) · ' + GAMES + ' 局/环境');
console.log('# 打分量纲 = **' + METRIC + '**' + (METRIC === 'fit' ? '（训练目标，§E129 预注册的主口径）' : '（§E130：同一套预测换一列打分）')
  + ' · 阈值 0.02 沿用 fit 上定的那条，**换量纲不重定**');
console.log('  样本 ' + samples.length + ' 条 · 参与判定环境 ' + envsForScore.length + ' 个 · 无可观测身份 ' + emptySig.length + ' 个');
console.log('  best_single  = ' + bestSingle.toFixed(3) + '   （一粒一招鲜：' + bestSinglePack + '）');
console.log('  realizable   = ' + (isFinite(realizable) ? realizable.toFixed(3) : '未量到') + '   （只看桌面行为、LOO 选包）');
console.log('  oracle       = ' + oracle.toFixed(3) + '   （偷看环境标签的上界）');
console.log('  上界缺口 oracle−best_single = ' + gap.toFixed(3) + (gap < 0.02 ? '  ⇒ 太小，不谈 R' : '  ⇒ 可实现率 R = ' + (R == null ? '—' : R.toFixed(2))));
console.log('  实际赚到的量 realizable−best_single = ' + (isFinite(realizable) ? (realizable - bestSingle).toFixed(3) : '未量到')
  + '   ‖ 签名有分辨力？ ' + (informative ? '是' : '否') + '（判尺：准确率 ≥ 2×max(随机, placebo)，**不是**绝对阈值）');
console.log('  LOO 分类准确率 = ' + (isFinite(acc) ? pct1(acc) : '—') + '   ‖ placebo（把预测错配）= ' + pct1(pAcc) + ' ‖ 随机基线 ≈ ' + pct1(chance));
console.log('  歧义样本（最近邻在**不同环境之间逐位并列** ⇒ 按定义不可辨，不给预测也不替它编答案）= '
  + ambiguous + ' / ' + judged + '（' + pct1(judged ? ambiguous / judged : NaN) + '）');
if (ABSTAIN_ON) {
  /* ⚠ 列出来的是"**真的换了包**"的环境。早先这行印的是 `canSwitch` 的名单，而 `canSwitch` 只看距离门槛——
   * 一个环境可以"门槛过了但根本没有票"（§E131 修完并列判歧义之后大面积出现），那时它走的是**落回一招鲜**那条路。
   * 印错会让"换包 1 个 / 名单 26 个"这种自相矛盾直接进交接件。 */
  const sw = envsForScore.filter(e => switchInfo[e].canSwitch && switchInfo[e].predicted);
  console.log('  弃权闸 **' + ABSTAIN + '**：τ = ' + (TAU === null ? '—' : TAU.toFixed(4))
    + '（同原型两两签名距离的中位数，' + withinD.length + ' 对）· 实际换包 ' + RD.switched + '/' + envsForScore.length + ' 个环境'
    + (sw.length ? '：' + sw.join(', ') : ' ⇒ **一个都不换**'));
  const noVote = envsForScore.filter(e => !switchInfo[e].predicted).length;
  if (noVote) console.log('    其中 ' + noVote + ' 个环境**一票都没有**（全部样本的最近邻都在不同环境之间逐位并列 ⇒ 按定义不可辨），'
    + '它们走"落回一招鲜"这条路');
  console.log('    （反退化条款：换包 < ' + MIN_SWITCH + ' 个环境时本条判"没有结论"——弃权版退化成"几乎不换包"，'
    + '那时它的"增益 ≈ 0"是同义反复，不是结果）');
}
/* ---- 签名**退化度**（§E131 跑出来 τ=0 之后加的现场诊断，不是新判据）----
 * 为什么必须印：弃权闸"没起作用"这件事本身有两种完全相反的解释——
 *   (a) 每个环境都认得出来（所以都换包）；(b) 签名空间塌成少数几个点（所以距离门槛形同虚设）。
 * 不量这三个数就分不开，而这直接决定"给 `policy.js` 加这组特征"值不值。 */
const sigKey = (v) => v.map(x => x.toFixed(3)).join('|');
const UNIQUES = new Set(samples.map(s => sigKey(s.v))).size;
const nnAll = []; for (const e in nnDists) for (const d of nnDists[e]) nnAll.push(d);
const NN_MEDIAN = medianOf(nnAll);
const dom = {};
for (const rg of live) {
  const arr = (sigs[rg.name] || []).filter(s => s.tot > 0);
  if (!arr.length) continue;
  const meanV = CATS.map((_, i) => arr.reduce((s, x) => s + x.v[i], 0) / arr.length);
  let bi = 0; for (let i = 1; i < meanV.length; i++) if (meanV[i] > meanV[bi]) bi = i;
  const dk = CATS[bi] + '(' + (100 * meanV[bi]).toFixed(0) + '%)';
  dom[dk] = (dom[dk] || 0) + 1;
}
console.log('  签名退化度：**唯一向量 ' + UNIQUES + ' / 样本 ' + samples.length + ' 条**（' + ENVS.length + ' 个环境 × ' + GAMES + ' 局）'
  + ' ‖ τ（同原型两两距离中位数）= ' + (TAU === null ? '—' : TAU.toFixed(4))
  + ' ‖ 最近邻距离中位数 = ' + (NN_MEDIAN === null ? '—' : NN_MEDIAN.toFixed(4)));
console.log('    每个环境的"主导类别"（均值向量里最大的那一类）分布：'
  + Object.entries(dom).sort((a, b) => b[1] - a[1]).map(e => e[0] + '×' + e[1]).join(' ‖ '));
console.log('    ⇒ ' + ENVS.length + ' 个原型在签名空间里只落在 **' + UNIQUES + ' 个点**上'
  + (UNIQUES * 2 <= ENVS.length ? ' ⇒ 门槛与投票都因此形同虚设（弃权闸换了 ' + RD.switched + '/' + envsForScore.length + ' 个）' : ''));
console.log('  判读：' + verdict);
/* `--dump=<path>`：把**逐环境**的链路落成文件（预测到哪个环境 → 拿到哪粒包 → 它在真环境上的两量纲读数 + 该环境的命中率）。
 * 为什么非落不可：§E130 的预注册判据要 `realizable − best_single` 的**配对 95% 区间**，
 * 而工具原先只印均值 ⇒ 均值没法配区间，只能拿"逐局样本"冒充独立样本把区间算窄（正是 DS 清单第 8 条点的那类错）。 */
if (arg('dump', '')) {
  /* 逐环境命中率**复用主循环已经算好的 `hitByEnv/nByEnv`**。
   * 这里原先写的是 `if (nearestOther(s, samples) === s.env)` —— 而 `nearestOther` 早已改成返回对象，
   * 对象永远不等于字符串 ⇒ 每个环境的命中率都成 0，聚类区间那条读数就废了（本仓同族的"键名/形状改了、代码不崩、静默出假数"）。 */
  const dump = envsForScore.map(e => {
    const pe = predOf[e] || null, pack = pe && bestIn[pe] ? bestIn[pe] : null;
    const can = ABSTAIN_ON ? (switchInfo[e] && switchInfo[e].canSwitch) : !!pack;
    /* ⚠ `门槛过了但没有票` 也算**没得换** ⇒ 必须落回一招鲜。早先这里写的是 `can ? pack : FALLBACK`，
     * 于是 24 个环境的 `chosen` 成了 null，而 json 的 `realizable` 是按"落回一招鲜"平均的
     * ⇒ dump 与均值又是两笔算术（§E131 第一次撞过同形错，这条是它的第二具尸体）。 */
    const usedPack = (can && pack) ? pack : FALLBACK;
    const val = (p, mt) => { const r = rows.find(x => x.pack === p); return r && r.per[e] ? r.per[e][mt] : null; };
    const bs = rows.find(x => x.pack === RD.bestSinglePack);
    const si = switchInfo[e] || {};
    return { env: e, predEnv: pe, oracleOfPred: pack, switched: !!usedPack && !!pack && can,
      chosenPack: usedPack,
      abstain: { mode: ABSTAIN, canSwitch: can === true, nnMed: si.nnMed == null ? null : +si.nnMed.toFixed(4), share: si.share == null ? null : +si.share.toFixed(3) },
      chosen: { fit: val(usedPack, 'fit'), win: val(usedPack, 'win') },
      incumbent: { fit: bs && bs.per[e] ? bs.per[e].fit : null, win: bs && bs.per[e] ? bs.per[e].win : null },
      oraclePack: bestIn[e] || null, oracleFit: bestIn[e] ? (rows.find(x => x.pack === bestIn[e]).per[e].fit) : null,
      oracleWin: bestIn[e] ? (rows.find(x => x.pack === bestIn[e]).per[e].win) : null,
      acc: nByEnv[e] ? (hitByEnv[e] || 0) / nByEnv[e] : null, n: nByEnv[e] || 0,
      ambiguous: ambOf[e] || 0, ambiguousRate: nByEnv[e] ? (ambOf[e] || 0) / nByEnv[e] : null };
  });
  writeFileSync(arg('dump'), JSON.stringify({ meta: { metric: METRIC, k: K, games: GAMES, seed0: SEED0, n: N, envs: envsForScore.length, matrix: MATRIX, abstain: ABSTAIN, tau: TAU, minSwitch: MIN_SWITCH },
    metric: METRIC, k: K, abstain: ABSTAIN, tau: TAU, bestSinglePack: RD.bestSinglePack, perEnv: dump }, null, 1));
  console.log('  dump（逐环境链路）→ ' + arg('dump'));
}
if (arg('json', '')) {
  writeFileSync(arg('json'), JSON.stringify({
    meta: { games: GAMES, k: K, n: N, seed0: SEED0, envs: envsForScore.length, envsMatrix: ENVS.length, judged, emptySig, metric: METRIC,
      ambiguous, ambiguityRate: judged ? ambiguous / judged : null, uniqueSignatures: UNIQUES, tau: TAU, nnMedian: NN_MEDIAN,
      abstain: ABSTAIN, switched: RD.switched, minSwitch: MIN_SWITCH,
      rule: 'v1.5.289 ①′（去掉 25% 绝对阈值，改比随机/placebo）+ 并列判歧义（不再按遍历顺序取第一）' },
    bestSingle, bestSinglePack, realizable, realizableN: RD.realizableN, scored: envsForScore.length,
    oracle, gap, R: R, acc: isFinite(acc) ? acc : null, placebo: pAcc,
    chance, informative, branch: RD.branch, verdict,
  }, null, 1));
  console.log('  json → ' + arg('json'));
}
