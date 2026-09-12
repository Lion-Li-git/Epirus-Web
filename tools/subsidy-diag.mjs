/* Epirus 深经济边际价值诊断 + (c) 补贴门槛标定
 *
 * 用法: node tools/subsidy-diag.mjs [冠军文件=js/bundled-champion-3p.js] [局数=30] [n=3] [seed=4242]
 *
 * 为什么需要这个脚本（写于 5 次失败之后）:
 *   REVIEW-3P §2-P0 记录了两种互相矛盾的解读:
 *     解读 A (千问"货架问题"): 富经济下"只出坦克"就 96~100% -> 多攒 3 回合换不到任何
 *                               2 ジ 换不到的东西 -> 深经济没有**边际**价值 -> 再怎么做探索都白搭;
 *     解读 B (探索问题):        冠军被补贴到 ep=3 夺 1 率 77.5%、ep=5 达 84.4%（原生 41.1%）
 *                               -> "有钱"大幅提升胜率 -> 问题在**够不到**，值得做探索。
 *   两者不可能同时为真。本脚本用同一批种子做**配对**测量，直接判定:
 *     关键量 = 补贴局夺 1 率 - 原生夺 1 率。若显著 > 0 则 A 不成立（值得做 (c)）;
 *     若 ≈ 0 则 A 成立，(c) 应当立即停止。
 *
 * 同时输出被否决的旧判据（贵技能落地计数）以便对照：它与胜负无关。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = parseInt(process.argv[3] || '30', 10);
const N = parseInt(process.argv[4] || '3', 10);
const SEED = parseInt(process.argv[5] || '4242', 10);

function loadSandbox(extra) {
  const sb = {
    console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
    parseInt, parseFloat, Float64Array, Date, window: {},
    localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } }
  };
  sb.globalThis = sb;
  const files = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'];
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  for (const f of extra) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}
function packFrom(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('未找到 EPIRUS_CHAMPION_3P: ' + file);
  return JSON.parse(m[1]);
}

const sb = loadSandbox([FILE]);
const W = sb.window;
if (!W.EpirusPolicy || !W.EpirusTrainer) throw new Error('引擎未加载');
const P = W.EpirusPolicy, T = W.EpirusTrainer;
// allowLegacy: 工具侧放宽，好让 5 次失败实验的旧存档也能被量
const params = P.unpack(packFrom(FILE), true);
if (!params) throw new Error('冠军解包失败: ' + FILE);
if (typeof T.evalSubsidyProbe !== 'function') throw new Error('evoTrainer 缺少 evalSubsidyProbe（(c) 未落地）');

const pf = (x) => (x * 100).toFixed(1).padStart(5) + '%';
const rows = [];
function run(label, opts) {
  const r = T.evalSubsidyProbe(params, GAMES, N, SEED, opts);
  rows.push({ label, opts, r });
  console.log(
    label.padEnd(26) +
    ' 夺1=' + pf(r.firstRate) +
    ' 前二=' + pf(r.top2Rate) +
    ' 深技能/局=' + r.deepCastPerGame.toFixed(2) +
    ' 种类=' + r.deepKinds
  );
  return r;
}

console.log('=== ' + FILE + '  n=' + N + '  局数=' + GAMES + '  种子=' + SEED + '（各档同一批种子，配对）===');
console.log('--- 对照组: 无补贴、无承诺 ---');
const base = run('原生 (startEp=0)', { h: 0, startEp: 0 });

console.log('--- 白给资源: 只改开局 ep，不强制攒钱 ---');
const grants = [2, 3, 4, 6].map((e) => ({ e, r: run('开局白给 ep=' + e, { h: 0, startEp: e }) }));

console.log('--- 承诺轨迹: 强制 ep<1+h 只出ジ ---');
const commits = [2, 3, 4].map((h) => ({ h, r: run('承诺 h=' + h + ' + 白给4', { h: h, startEp: 4 }) }));

console.log('--- 永久回放通道: 每回合回 ep ---');
const regen = run('regen=2 (无承诺)', { h: 0, startEp: 0, regen: 2 });

console.log('--- 被否决的旧判据（与胜负无关，仅对照）---');
if (typeof T.evalEconProbe === 'function') {
  const ep = T.evalEconProbe(params, GAMES, N, SEED);
  console.log('evalEconProbe(landing) score=' + ep.score.toFixed(3) +
    ' 贵技能出手/局=' + ep.castPerGame.toFixed(2) + ' 落地/局=' + ep.landPerGame.toFixed(2));
  console.log('  ⚠ 该口径**不是**纯测量假象（我一度这么以为，tools/grant-mech-diag.mjs 实测否定了）：' +
    '它在 chooser 内部补 pl.ep，而 play.js:50-53 在调用 chooser 之前就算好 legal[i].affordable，' +
    '所以**每局第 1 回合**是盲的（贵技能进不了采样集并被强制改回 ジ）；' +
    '但改的是真实 state，从第 2 回合起 affordable 就变 true 了。' +
    '故它的 0 分只有首回合无效，结论仍然成立。本脚本已修掉那一个回合的盲区（重算 affordable）。');
}

/* 正对照（反证法）：一个"总挑最贵且买得起的"脚本鲸鱼。
 * 若它能打出 cost>=3，则说明"深技能"这条口径本身可被触达 ->
 * 前面冠军的 0.00 是**策略的选择**，不是测量死角。 */
console.log('--- 正对照（反证法）: 脚本鲸鱼，总挑最贵且买得起的 ---');
const St = W.EpirusState, Rr = W.EpirusRules;
let deep = 0; const whaleUse = {};
function whale(level) {
  return function (state, pid, legal) {
    const pl = state.p[pid];
    if (level > 0) pl.ep = Math.max(pl.ep, level);
    let best = null;
    for (let i = 0; i < legal.length; i++) {
      const l = legal[i];
      const c = St.computeCost(state, pid, l.key);
      l.affordable = !!(c && c.ok && c.ep <= pl.ep);
      if (!l.affordable) continue;
      if (!best || c.ep > best.ep) best = { key: l.key, ep: c.ep };
    }
    const k = best ? best.key : Rr.SK.JI;
    if (best && best.ep >= 3) deep++;
    whaleUse[k] = (whaleUse[k] || 0) + 1;
    return { key: k, target: null, target2: null };
  };
}
for (let g = 0; g < 20; g++) T.oneGameN([whale(6), whale(6), whale(6)], 9000 + g * 977, N, { regen: 2 });
console.log('鲸鱼 20 局选了 cost>=3 的次数 = ' + deep + (deep > 0 ? '  ✔ 口径可触达' : '  ✘ 口径本身有问题，前面的 0 不可信'));
console.log('  鲸鱼出招分布: ' + JSON.stringify(whaleUse));

console.log('--- 判定 ---');
const bestGrant = grants.reduce((a, b) => (b.r.firstRate > a.r.firstRate ? b : a));
const dGrant = bestGrant.r.firstRate - base.firstRate;
const bestCommit = commits.reduce((a, b) => (b.r.firstRate > a.r.firstRate ? b : a));
const dCommit = bestCommit.r.firstRate - base.firstRate;
console.log('原生夺1率                 = ' + pf(base.firstRate));
console.log('最好的白给档 (ep=' + bestGrant.e + ')   = ' + pf(bestGrant.r.firstRate) + '  Δ=' + (dGrant * 100).toFixed(1) + 'pt');
console.log('最好的承诺档 (h=' + bestCommit.h + ')    = ' + pf(bestCommit.r.firstRate) + '  Δ=' + (dCommit * 100).toFixed(1) + 'pt');
console.log('regen=2 无承诺            = ' + pf(regen.firstRate));
const avg = (rows.reduce((a, x) => a + x.r.firstRate, 0) / rows.length);
console.log('全部档位均值              = ' + pf(avg) + '（分布越平 = 越像"货架问题"）');
console.log('=> 深经济有正边际价值: ' + ((dGrant > 0.05 || dCommit > 0.05) ? 'YES（探索路线值得继续）' : 'NO（支持"货架问题"，应停止 (c) 并改考卷）'));
