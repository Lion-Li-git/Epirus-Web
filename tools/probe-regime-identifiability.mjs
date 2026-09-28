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
import { bestInByEnv, routingReadings, matrixComplaint, metricOrThrow } from './routing-gain-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['matrix', 'games', 'k', 'n', 'seed', 'json', 'quiet', 'exclude', 'metric', 'dump']);
/* `--metric=fit|win|noDiv`（§E130）：**签名与分类链路一字不动，只换打分那一列**。
 * 动因是 §E129 判读第 5 节我自己写下的那条限制——"`fit` 不是胜率"。矩阵里每格本来就同时有
 * `fit / noDiv / win / sd` ⇒ 同一套预测可以同时在两个量纲上打分，不必再打一局。
 * ⚠ 预注册那条"上界缺口 < 0.02 就判⑤"的 0.02 是在 **fit** 上定的，换量纲**不重定阈值**（重定就是扫参）。 */
let METRIC = 'fit';
try { METRIC = metricOrThrow(arg('metric', 'fit')); } catch (e) { console.error('⛔ ' + e.message); process.exit(2); }

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
  let bn = null, bd = Infinity;
  for (const o of pool) {
    if (o === s) continue;
    const d = dist(s.v, o.v);
    if (d < bd) { bd = d; bn = o.env; }
  }
  return bn;
}
let hit = 0, judged = 0;
const predOf = {};                                   // env -> 该环境所有样本的预测**众数**（选包用，保持稳定）
const predVotes = {};
for (const s of samples) {
  const bn = nearestOther(s, samples);
  if (!bn) continue;
  judged++;
  predVotes[s.env] = predVotes[s.env] || {};
  predVotes[s.env][bn] = (predVotes[s.env][bn] || 0) + 1;
  if (bn === s.env) hit++;                          // 命中 = 最近邻也是同一个环境（换了样本，不是换了自己）
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
  const bn = nearestOther(s, samples);
  if (!bn) continue;
  pj++;
  if (relabel[bn] === s.env) phit++;                 // 邻居的"真标签"被换掉之后还命中 ⇒ 才算巧合
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
const RD = routingReadings({ rows, envs: envsForScore, bestIn, picks: predOf, acc, placebo: pAcc, metric: METRIC });
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
console.log('  判读：' + verdict);
/* `--dump=<path>`：把**逐环境**的链路落成文件（预测到哪个环境 → 拿到哪粒包 → 它在真环境上的两量纲读数 + 该环境的命中率）。
 * 为什么非落不可：§E130 的预注册判据要 `realizable − best_single` 的**配对 95% 区间**，
 * 而工具原先只印均值 ⇒ 均值没法配区间，只能拿"逐局样本"冒充独立样本把区间算窄（正是 DS 清单第 8 条点的那类错）。 */
if (arg('dump', '')) {
  const perEnvHit = {}, perEnvN = {};
  for (const s of samples) { perEnvN[s.env] = (perEnvN[s.env] || 0) + 1; if (nearestOther(s, samples) === s.env) perEnvHit[s.env] = (perEnvHit[s.env] || 0) + 1; }
  const dump = envsForScore.map(e => {
    const pe = predOf[e] || null, pack = pe && bestIn[pe] ? bestIn[pe] : null;
    const one = (mt) => { const r = rows.find(x => x.pack === pack); return r && r.per[e] ? r.per[e][mt] : null; };
    const bs = rows.find(x => x.pack === RD.bestSinglePack);
    return { env: e, predEnv: pe, chosenPack: pack,
      chosen: { fit: one('fit'), win: one('win') },
      incumbent: { fit: bs && bs.per[e] ? bs.per[e].fit : null, win: bs && bs.per[e] ? bs.per[e].win : null },
      oraclePack: bestIn[e] || null, oracleFit: bestIn[e] ? (rows.find(x => x.pack === bestIn[e]).per[e].fit) : null,
      oracleWin: bestIn[e] ? (rows.find(x => x.pack === bestIn[e]).per[e].win) : null,
      acc: perEnvN[e] ? (perEnvHit[e] || 0) / perEnvN[e] : null, n: perEnvN[e] || 0 };
  });
  writeFileSync(arg('dump'), JSON.stringify({ meta: { metric: METRIC, k: K, games: GAMES, seed0: SEED0, n: N, envs: envsForScore.length, matrix: MATRIX }, metric: METRIC, k: K, bestSinglePack: RD.bestSinglePack, perEnv: dump }, null, 1));
  console.log('  dump（逐环境链路）→ ' + arg('dump'));
}
if (arg('json', '')) {
  writeFileSync(arg('json'), JSON.stringify({
    meta: { games: GAMES, k: K, n: N, seed0: SEED0, envs: envsForScore.length, envsMatrix: ENVS.length, judged, emptySig, metric: METRIC, rule: 'v1.5.288 ①′（去掉 25% 绝对阈值，改比随机/placebo）' },
    bestSingle, bestSinglePack, realizable, realizableN: RD.realizableN, scored: envsForScore.length,
    oracle, gap, R: R, acc: isFinite(acc) ? acc : null, placebo: pAcc,
    chance, informative, branch: RD.branch, verdict,
  }, null, 1));
  console.log('  json → ' + arg('json'));
}
