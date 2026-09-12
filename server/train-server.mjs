/* Epirus — 训练服务（Node，零依赖）：SSE 实时推送进度，训练完写 js/bundled-champion.js。
 * 启动：双击 tools/start-train-server.cmd，或 node server/train-server.mjs [端口=8787]
 * 浏览器训练页「连接远程训练」即可实时看进度；游戏仍双击 index.html 即玩。
 * 语义说明：
 *   - /train?gens=N  从当前 checkpoint 继续训练 N 代（持续训练：训练完再点一次会接着练）。
 *   - /reset         重置服务端训练器（新种子/清空服务端进度）。
 */
import http from 'node:http';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { makeAsyncStep, makeParallelEvalN } from './paralleltrain.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PORT = Number(process.argv[2] || 8787);

const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;

/* 工具链修复：把沙箱内的 Math.random 整体替换为可播种 RNG。
 * 原先 evo.js(4 处)/bots.js(1 处)/policy.js 的 randn 都在用 Math.random，
 * 只播种 policy 的 randn 不够 —— 同 seed 两次运行结果仍然不同（已实测）。
 * 覆盖整个沙箱的 Math 可一次盖住所有随机源；不设 seed 时保持原样。 */
function __seedSandbox(sbox, seed) {
  if (!seed) return;
  const M = Object.create(Math);
  let s = (seed >>> 0) || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sbox.Math = M;
}

for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, P = sb.EpirusPolicy, R = sb.EpirusRules;
const stepAsync = makeAsyncStep(T);   // 并行加速：每代把评估切到 worker 池跑多核
console.log('[parallel] 训练 worker 数：' + stepAsync.workers);

const clients = new Set();
let seeds = [];            // 多种子池：[{t, seed, done, stopReason, peakWr, stall, checked}]
let running = false;
let lastChampionPack = null;   // 最近一次择优成功的冠军包（供 /champion 拉取）

/* 从 js/bundled-champion.js 读回已保存冠军，用于服务重启后热启动持续训练。
 * 注意：bundle 现在含 meta（EPIRUS_CHAMPION_META）在前，不能再用 indexOf('=')（会拿到 meta 的等号导致 JSON.parse 失败）。 */
function loadSeed() {
  try {
    const src = readFileSync(join(root, 'js', 'bundled-champion.js'), 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    return P.unpack(JSON.parse(m[1]));
  } catch (e) { return null; }
}

/* 冠军包的**可复现输入标识**：只哈希权重数组。
 * （v1.3.36 的教训：整文件 sha 会被 META 里的 ts 污染，把"权重相同"误判成"不同"。）
 * 用途：把"这一轮是从哪一版冠军长出来的"记进产物 —— 否则热启动训练无法复现。 */
function weightsId(params) {
  try { return createHash('sha1').update(JSON.stringify(Array.from(params))).digest('hex').slice(0, 16); }
  catch (e) { return null; }
}

function sse(res, data) {
  try { res.write('data: ' + JSON.stringify(data) + '\n\n'); } catch (e) { /* client gone */ }
}
/* 更新 index.html 里冠军 script 的 ?v= 版本号（cache-busting）：冠军一变版本号就变，浏览器不再用旧缓存。 */
function bumpChampionVersion() {
  const html = join(root, 'index.html');
  try {
    let s = readFileSync(html, 'utf8');
    // 所有脚本引用统一换构建标记：冠军/引擎/UI 一起缓存失效，避免改了 js 却还在跑旧代码
    s = s.replace(/(\?v=)[0-9a-z]+/gi, '$1' + Date.now().toString(36));
    writeFileSync(html, s, 'utf8');
  } catch (e) { /* ignore */ }
}
function writeBundle(pack, meta) {
  const dest = join(root, 'js', 'bundled-champion.js');
  if (existsSync(dest)) copyFileSync(dest, dest + '.bak');   // 覆写前留一份 .bak
  writeFileSync(dest,
    '/* Epirus 内置冠军：由 server/train-server.mjs 生成（多种子择优，收尾按真实胜率）。不要手改。 */\n' +
    'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';\n' +
    'window.EPIRUS_CHAMPION = ' + JSON.stringify(pack) + ';\n', 'utf8');
  bumpChampionVersion();
}

/* 与页面“困难·冠军”一致的出招（temp0.15，只挑可负担），对 8 基准实测平均真实胜率。 */
const BOT_NAMES = ['random', 'aggro', 'defend', 'balanced', 'breakdef', 'wall', 'reflectspam', 'guardspam', 'baguaspam', 'combocounter', 'mix', 'heavyfire', 'guardgun', 'protowall', 'whiff', 'reflectmix', 'reflecttank', 'defreflectgun'];
const BOT_FN = { protomine: 'pickProtoMine', prototransfer: 'pickProtoTransfer', random: 'pickRandom', aggro: 'pickAggro', defend: 'pickDefend', balanced: 'pickBalanced', breakdef: 'pickBreakDef', wall: 'pickWall', reflectspam: 'pickReflectSpam', guardspam: 'pickGuardSpam', baguaspam: 'pickBaguaSpam', combocounter: 'pickComboCounter', mix: 'pickMix', tankline: 'pickTankLine', heavyfire: 'pickHeavyFire', guardgun: 'pickGuardGun', protowall: 'pickProtoWall', whiff: 'pickWhiff', reflectmix: 'pickReflectMix', reflecttank: 'pickReflectTank', defreflectgun: 'pickDefReflectGun' };
function champRealWr(params, temp, games, seedBase) {
  const sel = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return P.choose(state, pid, base, params, { temp: temp });
  };
  let tot = 0, n = 0;
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const nm = BOT_NAMES[i];
    const r = T.correctedWinRate(sel, sb.EpirusBots[BOT_FN[nm]], games, seedBase + i * 977);
    tot += r.wr; n++;
  }
  return n ? tot / n : 0;
}

/* 早停判定（保守版）：只杀"明确过拟合/长期废物"的种子，绝不杀高分/当前最优种子。
 * 关键：不再用"wr<0.78 绝对阈值"（会把 baseline 高达 0.9 的高分种子因偶发噪声误杀）；
 * 只认两种明确信号，且用 60局/基线降噪，并要求连续 2 次（避免单次噪声误杀）。 */
function maybeEarlyStop(it, gens) {
  if (it.t.gen < 160 || it.t.gen % 40 !== 0) return;
  const base = (it.t.gen + 1) * 7919 + it.seed * 131;
  const wr = champRealWr(it.t.champion, 0.05, 60, base);   // 60局/基线=480局，噪声大幅下降
  it.lastWr = wr; it.checked++;
  if (wr > it.peakWr + 0.01) it.peakWr = wr;
  const alive = seeds.filter(function (x) { return x !== it && !x.done && x.t.gen >= 160 && x.lastWr != null; });
  const leaderWr = alive.length ? Math.max.apply(null, alive.map(x => x.lastWr)) : -1;
  const best = it.t.bestChampScore;
  // 明确过拟合：shaped 分很高（>0.85）但真实胜率一直很低（<0.55），差距大 → 真机退化
  const overfit = best > 0.85 && wr < 0.55;
  // 长期废物：真实胜率从没上过 0.70，且当前仍 <0.55
  const dud = it.peakWr < 0.70 && wr < 0.55;
  // 当前最优/接近 leader 的种子不杀（避免杀高种子）
  const notTop = !(alive.length && wr >= leaderWr - 0.03);
  if ((overfit || dud) && notTop) it.badStreak = (it.badStreak || 0) + 1; else it.badStreak = 0;
  if (it.badStreak >= 2 && alive.length >= 1) {
    it.done = true;
    it.stopReason = overfit ? '早停·明确过拟合(shaped高/真胜率低)' : '早停·长期废物(真胜率<0.55)';
    for (const c of clients) sse(c, { type: 'seedDone', seed: it.seed, reason: it.stopReason, gen: it.t.gen, wr });
  }
}

/* 多种子 × 多轮训练：每轮 = seeds 个独立种子跑 gens 代（轮间重新择优/重开种子，避免长跑 sigma 坍缩与冠军蝉联）。
 * 每轮结束都按真实胜率择优并与现有冠军比（绝不回退）。 */
async function runTrain(gens, opts, cfg) {
  if (T.setRegenTotal) T.setRegenTotal(Number(process.env.EPIRUS_REGEN_GENS || gens || 0));
  /* C 方案：脚本教师模仿。注意 worker 是**独立进程**，主线程 setImitUntil 传不进去，
   * 故走环境变量——worker 在懒创建时读它（池在首次 evalPopN 才建，此时 env 已写好）。 */
  // C 方案实测未奏效（只做动作级模仿，学不到跨回合轨迹）→ **默认关闭**。
  // 需要复验时设 EPIRUS_IMIT_FRAC=0.35 即可打开。
  const imitGens = Math.floor((gens || 0) * Number(process.env.EPIRUS_IMIT_FRAC || '0'));
  process.env.EPIRUS_IMIT_GENS = String(imitGens);
  if (T.setImitUntil) T.setImitUntil(imitGens);
  cfg = cfg || {};
  const seedN = Math.max(1, cfg.seeds || 3);
  const rounds = Math.max(1, cfg.rounds || 1);
  const fresh = !!cfg.fresh;
  const t0 = Date.now();
  const cap = 1800000; // 30 分钟上限
  let last = null;
  let nextParents = null;   // 下一轮各种子的父代（谱系）：[{label, params}]
  /* v1.3.56：记录"本轮开局所用的现有冠军"权重标识。非 fresh 时种群是围绕它长出来的，
   * 不记下来，这个产物就**无法被别人复现**（而浏览器默认就是不勾"从头训练"）。 */
  let hotstartFrom = null;
  for (let r = 0; r < rounds; r++) {
    const list = [];
    for (let s = 0; s < seedN; s++) {
      const t = T.makeTrainer(opts || { popSize: 14, gamesPerOpp: 5 });
      // 第一轮：fresh=清空旧冠军、随机起；非 fresh=围绕现有冠军精修。
      // 后续轮：只从上一轮保留的父代派生（谱系）——fresh 只作用于开局，不再每轮清空重来。
      let seedPack = null, parentLabel = null, parentSeed = -1;
      if (r === 0) {
        parentSeed = -1;   // 第 0 轮无父种子
        if (fresh) parentLabel = '随机';
        else { seedPack = loadSeed(); parentLabel = seedPack ? '现有冠军' : '随机'; if (seedPack) hotstartFrom = weightsId(seedPack); }
      } else if (nextParents && nextParents[s]) {
        seedPack = nextParents[s].params; parentLabel = nextParents[s].label; parentSeed = nextParents[s].seedId;
      }
      if (seedPack) T.seedChampion(t, seedPack);
      list.push({ t, seed: s, parent: parentLabel, parentSeed: parentSeed, done: false, stopReason: null, peakWr: -1, stall: 0, checked: 0, lastWr: null, badStreak: 0 });
    }
    seeds = list;
    for (const c of clients) sse(c, { type: 'roundStart', round: r, rounds, seeds: seedN, gens, parents: list.map(function (it) { return { label: it.parent, seedId: it.parentSeed }; }) });
    let allDone = false;
    while (!allDone) {
      for (const it of list) {
        if (it.done) continue;
        if (it.t.gen >= gens) { it.done = true; it.stopReason = '目标代'; continue; }
        const rec = await stepAsync(it.t);                 // 每种子推 1 代（曲线同步长）
        for (const c of clients) sse(c, { type: 'gen', round: r, seed: it.seed, rec });
        maybeEarlyStop(it, gens);
        if (Date.now() - t0 > cap) { for (const c of clients) sse(c, { type: 'error', msg: '训练超时上限（30 分钟）' }); running = false; return; }
      }
      allDone = list.every(it => it.done || it.t.gen >= gens);
    }
    // 本轮收尾：每种子 pickChampionByWinRate（broad 真实胜率把关）+ 实测，选最强
    let best = null, bestWr = -1, bestSeed = -1, bestScore = null;
    const cands2 = [];   // 多目标择优：先收集，再在胜率容差带内取最发散
    /* 千问定位：原为 (r+1)*7919 + (Date.now()%1000) —— 决定"选哪个冠军"的评测种子
     * 每次运行都不同 ⇒ 即使 ① 修好，2P 也永远不可复现。改为纯 seed0 派生。 */
    const seedBase = (Number((cfg && cfg.seed0) || 0) || 1) * 100003 + (r + 1) * 7919;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      T.pickChampionByWinRate(it.t, 24, seedBase + i * 9973);
      const wr = champRealWr(it.t.champion, 0.15, 100, seedBase + i * 331);   // 100局/基线，降低噪声
      it.wr = wr;
      for (const c of clients) sse(c, { type: 'seedEval', round: r, seed: it.seed, wr, gen: it.t.gen, reason: it.stopReason || '完成' });
      cands2.push({ it: it, wr: wr, seed: it.seed, score: it.t.bestChampScore, div: T.champEntropy(it.t.champion, 0.15, 60, seedBase + i * 555) });
    }
    // ===== 多目标择优：胜率容差带内取覆盖熵最高者 =====
    // 只用 argmax(胜率) 必然挑中最强也最窄的个体（实测 2.52 vs 3.82 有效技能）。
    if (cands2.length) {
      const top2 = Math.max.apply(null, cands2.map(function (c) { return c.wr; }));
      const band2 = cands2.filter(function (c) { return c.wr >= top2 - 0.03; });
      band2.sort(function (a, b) { return b.div.divNorm - a.div.divNorm; });
      const pk = band2[0];
      bestWr = pk.wr; best = pk.it.t; bestSeed = pk.seed; bestScore = pk.score;
      for (const c of clients) sse(c, { type: 'multiObj', n: 2, round: r, top: top2, band: band2.length, picked: pk.seed, wr: pk.wr, divNorm: pk.div.divNorm, distinct: pk.div.distinct });
    }
    const cur = loadSeed(); let curWr = -1;
    if (cur) {
      curWr = champRealWr(cur, 0.15, 100, seedBase + 999);   // 现有冠军同口径足量评估，避免噪声误判
      // 绝不回退：只有种子明显（>4个百分点击败现有冠军）才替换；否则保留现有冠军。
      // fresh（从头训练）例外：用户明确要清空旧冠军，此时直接采纳本轮最强种子，也不把旧冠军当父代。
      if (!fresh && !(bestWr > curWr + 0.04)) { best = null; bestWr = curWr; bestSeed = -1; bestScore = null; }
    }
    // 谱系：父母池 = 本轮各种子 + 现有冠军（存在且非 fresh 时），按真实胜率排序，保留前 k=ceil(sqrt(n)) 名；
    // 每名按“越靠前分得越多”分配 n 个新种子：n=3→2+1，n=4→2+2，n=5→2+2+1，n=8→3+3+2。
    const pool = list.map(function (it) { return { label: '种子' + it.seed, seedId: it.seed, wr: it.wr, params: it.t.champion }; });
    if (cur && curWr >= 0 && !fresh) pool.push({ label: '现有冠军', seedId: -1, wr: curWr, params: cur });
    pool.sort(function (a, b) { return b.wr - a.wr; });
    const keepN = Math.max(1, Math.ceil(Math.sqrt(seedN)));
    const kept = pool.slice(0, keepN);
    const baseN = Math.floor(seedN / kept.length), remN = seedN - baseN * kept.length;
    nextParents = [];
    kept.forEach(function (p, i) {
      const cnt = baseN + (i < remN ? 1 : 0);
      for (let j = 0; j < cnt; j++) nextParents.push({ label: p.label, seedId: p.seedId, params: p.params });
    });
    for (const c of clients) sse(c, { type: 'lineage', round: r + 1, parents: nextParents.map(function (p) { return { label: p.label, seedId: p.seedId }; }) });
    const finalPack = P.pack(best ? best.champion : cur);
    lastChampionPack = finalPack;
    writeBundle(finalPack, { source: 'server/train-server.mjs', seeds: seedN, gens, round: r + 1, rounds, ts: new Date().toISOString(), keptExisting: bestSeed < 0, fresh: fresh, champWr: bestWr, seed: Number((cfg && cfg.seed0) || 0), hotstartFrom: hotstartFrom });
    last = { best: bestScore, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 };
    for (const c of clients) sse(c, { type: 'roundDone', round: r, rounds, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 });
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  for (const c of clients) sse(c, { type: 'done', from: 0, gens, best: last.best, champWr: last.champWr, attackShare: null, secs, bestSeed: last.bestSeed, seeds: seedN, rounds, keptExisting: last.keptExisting });
  running = false;
}

/* ==================== 多人（N ≥ 3）训练 ==================== */
const OPP_NAMES = ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer'];
/* 名字→函数必须显式写（'autodef' 这类拼接会导致 pickAntidef 大小写错误） */
const BOT_FN_N = {
  random: 'pickRandom', balanced: 'pickBalanced', aggro: 'pickAggro', defend: 'pickDefend',
  wall: 'pickWall', antidef: 'pickAntiDef', breakdef: 'pickBreakDef', mix: 'pickMix', farmer: 'pickFarmer'
};
const BUNDLE_MP = 'js/bundled-champion-3p.js';   // 多人冠军（2/3/4/5 人局共用同一网络，特征与人数无关）
let lastChampionPackN = null;
let runningN = false;

function loadSeedN() {
  try {
    const src = readFileSync(join(root, BUNDLE_MP), 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (m) return P.unpack(JSON.parse(m[1]));
  } catch (e) { /* 无热启动 */ }
  return null;
}

function writeBundleMP(pack, meta) {
  writeFileSync(join(root, BUNDLE_MP),
    '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 server/train-server.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
    'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
    'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
  bumpChampionVersion();   // 刷 index.html 的 ?v= 缓\u5b58\u6233
}

async function runTrainN(gens, cfg) {
  const SEED0 = Number(cfg.seed0 || 0);
  /* WR_TOL is a CALLER input, not a hidden env read inside the engine
   * (Qianwen: CLI sandboxes have no `process`, so they always got the default). */
  if (T.setWrTol) T.setWrTol(Number(process.env.EPIRUS_WR_TOL || 0.03));
  let __seedIdxN = 0;   // 每个种子递增，用于 setRng 配对
  if (T.setRegenTotal) T.setRegenTotal(Number(process.env.EPIRUS_REGEN_GENS || gens || 0));
  cfg = cfg || {};
  const n = Math.max(3, Math.min(cfg.n || 3, 5));
  const popSize = Math.max(8, cfg.pop || 32);
  const games = Math.max(4, cfg.games || 20);
  const t0 = Date.now();
  const cap = 1800000;
  process.env.EPIRUS_SEED0 = String((SEED0 || 1) * 7919 + 13);   // worker 在下一行创建，必须在此之前设好
  const poolN = makeParallelEvalN(T);
  const seedP = cfg.fresh ? null : loadSeedN();
  const hotstartFromN = seedP ? weightsId(seedP) : null;
  /* 工具链修复：播种。原先 policy.js 的 randn/crossover 直接用 Math.random，
   * 训练完全不可复现 ⇒ A/B 两轮无法配对。带上 ?seed=N 后同一 N 两次运行结果一致。 */
  if (P.setRng && T.mulberry32) P.setRng(T.mulberry32((SEED0 || 1) * 7919 + 13));
  __seedSandbox(sb, (SEED0 || 1) * 7919 + 13);          // 覆盖 evo/bots 里的 Math.random
  // （EPIRUS_SEED0 必须在 makeParallelEvalN **之前**设好——worker 是那时创建的）
  let pop = [];
  for (let i = 0; i < popSize; i++) {
    if (seedP && i === 0) pop.push(seedP);
    else if (seedP && i < Math.floor(popSize / 3)) pop.push(P.mutatePolicy(seedP, 0.10));
    else pop.push(P.makePolicy(0.25));
  }
  /* (c) h 基因：与 pop 平行的承诺视界。2/3 个体跑纯原生（fit 干净），1/3 分到 h∈1..4，
   * 让"深承诺下能打的权重"从一开始就有座位；此后靠分巢精英存活、靠突变漂移。 */
  let hGenes = pop.map(function (_, i) {
    if (i === 0) return 0;                       // 种子个体保持原生口径
    if (i % 3 !== 0) return 0;
    return 1 + (Math.floor(i / 3) % 4);
  });
  let sigma = 0.18;
  const hall = [];
  for (const c of clients) sse(c, { type: 'start', n: n, gens, pop: popSize, gpo: games, from: 0, workers: poolN.workers, fresh: !!cfg.fresh });
  for (let gen = 0; gen < gens; gen++) {
    let res = await poolN.evalPopN(pop, gen, games, n, OPP_NAMES, hGenes);
    if (!res) {
      const B = sb.EpirusBots;
      const opps = OPP_NAMES.map(function (nm) { return { name: nm, sel: B[BOT_FN_N[nm]] }; });
      res = pop.map(function (params, idx) {
        const r = T.scoreMemberN(params, opps, games, n, gen, idx, hGenes[idx]);
        return { idx: idx, score: r.fit, firstRate: r.firstRate, top2Rate: r.top2Rate,
                 hGene: hGenes[idx], commitGames: r.commitGames, commitFirstRate: r.commitFirstRate,
                 commitTop2Rate: r.commitTop2Rate, commitMaxEp: r.commitMaxEp };
      });
    }
    const scored = pop.map(function (params, i) { return { params: params, r: res[i] || { score: -1, firstRate: 0, top2Rate: 0 } }; });
    scored.sort(function (a, b) { return b.r.score - a.r.score; });
    hall.push({ params: scored[0].params, fit: scored[0].r.score });
    hall.push({ params: scored[1] ? scored[1].params : scored[0].params, fit: scored[1] ? scored[1].r.score : -1 });
    hall.sort(function (a, b) { return b.fit - a.fit; });
    if (hall.length > 6) hall.length = 6;
    const mean = scored.reduce(function (a, x) { return a + x.r.score; }, 0) / scored.length;
    for (const c of clients) sse(c, { type: 'gen', n: n, rec: {
      gen: gen, best: scored[0].r.score, mean: mean,
      firstRate: scored[0].r.firstRate, top2Rate: scored[0].r.top2Rate, sigma: sigma,
      /* (c) h 基因可观测：分布 + 该代承诺局最好成绩。没有这两项，
       * "基因有没有真的参与选择"就只能靠猜——本项目已经栽过好几次。 */
      hDist: hGenes.join(','),
      commitBest: (function () { let b = 0; for (let i = 0; i < scored.length; i++) { const r = scored[i].r; if (r && r.commitGames && r.commitFirstRate > b) b = r.commitFirstRate; } return b; })()
    } });
    if (Date.now() - t0 > cap) { for (const c of clients) sse(c, { type: 'error', msg: '\u8bad\u7ec3\u8d85\u65f6\u4e0a\u9650\uff0830 \u5206\u949f\uff09' }); runningN = false; poolN.close(); return; }
    const elite = scored.slice(0, 3).map(function (x) { return x.params; });
    /* (c) 分巢精英：每个 h 值额外保留它自己**承诺局夺 1 率**最高的那个个体。
     * 这是 h 真正参与选择的唯一机制——否则承诺局只记在诊断里，深承诺的权重
     * 会被原生 fit 直接淘汰（= 之前"切片再多也没用"的同一个坑）。 */
    const byH = {};
    for (let i = 0; i < scored.length; i++) {
      const r = scored[i].r;
      if (!r || !r.commitGames) continue;
      const k = r.hGene || 0;
      if (!k) continue;
      if (!byH[k] || r.commitFirstRate > byH[k].r.commitFirstRate) byH[k] = scored[i];
    }
    for (const k in byH) if (elite.indexOf(byH[k].params) < 0) elite.push(byH[k].params);
    const hOf = new Map();
    for (let i = 0; i < pop.length; i++) hOf.set(pop[i], hGenes[i]);
    const hPick = function (p) { const v = hOf.get(p); return (typeof v === 'number') ? v : 0; };
    const next = elite.slice();
    const nextH = elite.map(hPick);
    /* 千问定位：这三处在 **Node 作用域**，而 __seedSandbox 只替换 vm 沙箱内的 Math
     * ⇒ 它们从未被播种（沙箱里修好的那 5 处反而都生效了）。改用显式传入的播种流。 */
    const breedRng = T.mulberry32 ? T.mulberry32((SEED0 || 1) * 100003 + gen) : Math.random;
    while (next.length < popSize) {
      const a = elite[Math.floor(breedRng() * elite.length)];
      const b = scored[Math.floor(breedRng() * Math.min(6, scored.length))].params;
      let child = breedRng() < 0.5 ? P.crossover(a, b) : a.slice();
      child = P.mutatePolicy(child, sigma);
      let ch = hPick(a);                                   // 基因随父代继承
      if (breedRng() < 0.15) ch = Math.max(0, Math.min(4, ch + (breedRng() < 0.5 ? -1 : 1)));
      next.push(child); nextH.push(ch);
    }
    if (gen % 30 === 29) { next[popSize - 1] = P.makePolicy(0.25); nextH[popSize - 1] = 0; }
    pop = next; hGenes = nextH;
    sigma = Math.max(0.06, sigma * 0.995);
  }
  // 终局：名人堂用全部对手对验证，取 1st 最高
  const B = sb.EpirusBots;
  const POOL = OPP_NAMES.map(function (nm) { return B[BOT_FN_N[nm]]; });
  const PAIRS = [];
  for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) PAIRS.push([POOL[a], POOL[b]]);
  let finalParams = hall[0] ? hall[0].params : pop[0], ev = null;
  /* (c) 门槛常量（必须在 hall 循环之前声明，否则 TDZ——v1.3.17 就栽在这）。
   * ⚠ v1.3.54 实测修正：**默认门槛 = 0（关闭）**。
   *   tools/subsidy-diag.mjs 用配对设计测出：三人局里冠军即使被白给 ep=6（并正确重算
   *   affordable）或被 regen=2 永久补贴，**一次 cost>=3 的技能都不出**（深技能 0.00/局），
   *   而脚本鲸鱼正对照能打出 3.0/局 ⇒ 0 是策略的选择，不是测量死角。
   *   有钱确实能赢（+20pt），但靠的是**更频繁地出便宜技能**——贵技能在 3 人局没有边际价值。
   *   于是"补贴局夺 1 率"反映的是**补贴强度**，不是候选的深经济能力：
   *   拿它当门槛只会往选择里注入噪声，选不出任何东西。故默认关闭，只保留测量。
   *   5 人局（千问实测 大雷−坦克 = +26.7pt）才有货架，届时用 EPIRUS_SUBSIDY_MIN 重新标定。 */
  const SUBSIDY_H = Number(process.env.EPIRUS_SUBSIDY_H || 3);
  const SUBSIDY_START_EP = Number(process.env.EPIRUS_SUBSIDY_EP || 4);
  const SUBSIDY_MIN = Number(process.env.EPIRUS_SUBSIDY_MIN || 0);
  if (SUBSIDY_MIN > 0) console.log('[multiObj] 补贴门槛已启用: 补贴局夺1率 >= ' + SUBSIDY_MIN + ' (h=' + SUBSIDY_H + ' startEp=' + SUBSIDY_START_EP + ')');
  const candsN = [];
  for (const h of hall) {
    const v = T.evalN(h.params, PAIRS, 20, n, 987654);
    for (const c of clients) sse(c, { type: 'seedEval', n: n, trainFit: h.fit, firstRate: v.firstRate, top2Rate: v.top2Rate });
    /* Q3：按类别取最差。类别①=脚本对手对（名次分），类别②=深经济探针（只打分贵技能用没用对）。
     * 探针**必须进选择**——只作诊断就会复现"切片再多也没用"的老问题。 */
    /* 修正 2（v1.3.18）：**探针是门槛，不是分数**。
     * 上一版 `sc = min(pairSc, probeSc)` 跨量纲（pairSc∈[0,1.5] vs probeSc∈[0,1]），
     * min 几乎永远取到探针 → "对手对打得如何"完全不影响排序 → 冠军为探针分牺牲实战。
     * 现在：probe >= PROBE_MIN 才进入排序；排序仍按 pairSc。探针分不足者仅在无人达标时兜底。 */
    const pairSc = v.firstRate + 0.5 * v.top2Rate;
    /* (c) 判据绑胜负：由"贵技能落地计数"换成**补贴局夺 1 率**。
     * 旧探针被否决两次：先奖励"出手"被"狂挥空"刷分，后来双枪真能落地了，
     * 任何按落地计分的判据又会选出"乱挥双枪"的冠军（实测净负 −27pt）。 */
    const pr = T.evalSubsidyProbe(h.params, 12, n, 4242, { h: SUBSIDY_H, startEp: SUBSIDY_START_EP, regen: 0 });
    const probeOk = pr.firstRate >= SUBSIDY_MIN;
    candsN.push({ params: h.params, v: v, sc: pairSc, pairSc: pairSc, probe: pr, probeOk: probeOk, div: T.champEntropy(h.params, 0.15, 60, 31337, n) });
  }
  // ===== 多目标择优：名次分容差带内取覆盖熵最高者（与 2 人路径同口径）=====
  if (candsN.length) {
    const passed = candsN.filter(function (c) { return c.probeOk; });
    const pool = passed.length ? passed : candsN;      // 无人达标 → 退化为全体（并打印告警）
    if (!passed.length) console.log('[multiObj] ⚠ 探针门槛无人达标，退化为全体候选');
    const topN = Math.max.apply(null, pool.map(function (c) { return c.sc; }));
    const bandN = pool.filter(function (c) { return c.sc >= topN - 0.03; });
    bandN.sort(function (a, b) { return b.div.divNorm - a.div.divNorm; });
    const pk = bandN[0];
    finalParams = pk.params; ev = pk.v;
    for (const c of clients) sse(c, { type: 'multiObj', n: n, top: topN, band: bandN.length, pickedWr: pk.v.firstRate, divNorm: pk.div.divNorm, distinct: pk.div.distinct, minSc: pk.sc, pairSc: pk.pairSc, probeSc: pk.probe.firstRate, subsidyMin: SUBSIDY_MIN });
    console.log('[multiObj] n=' + n + ' 候选=' + candsN.length + ' 过补贴门槛=' + passed.length + '(门槛 ' + SUBSIDY_MIN + ')' + ' 容差带=' + bandN.length +
      ' 选中 min=' + pk.sc.toFixed(3) + '(对局=' + pk.pairSc.toFixed(3) + ' 补贴局夺1=' + pk.probe.firstRate.toFixed(3) + ')' +
      ' divNorm=' + pk.div.divNorm.toFixed(3) + ' 种类=' + pk.div.distinct +
      ' 1st=' + (pk.v.firstRate * 100).toFixed(1) + '%  补贴局: 前二=' + (pk.probe.top2Rate * 100).toFixed(1) + '% 深技能/局=' + pk.probe.deepCastPerGame.toFixed(2) + ' 种类=' + pk.probe.deepKinds);
  }
  const pack = P.pack(finalParams);
  lastChampionPackN = pack;
  writeBundleMP(pack, { source: 'server/train-server.mjs', n: n, gens, games, pop: popSize, ts: new Date().toISOString(), firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0,
    /* v1.3.56：把**可复现输入**记进产物。此前 meta 只有 source/n/gens/games/pop/ts/胜率，
     * 于是从产物上既看不出是不是热启动、也看不出输入是哪一版冠军 —— 而浏览器的默认配置
     * 恰好就是热启动（index.html 的"从头训练"复选框默认不勾，ui.js 也就不发 fresh=1）。
     * 与 v1.3.50 给 CLI 定的规矩对齐：让"从哪个冠军长出来的"成为可复现输入。 */
    seed: SEED0, fresh: !!cfg.fresh, hotstartFrom: hotstartFromN, workers: poolN.workers });
  for (const c of clients) sse(c, { type: 'done', n: n, gens, firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0, secs: ((Date.now() - t0) / 1000).toFixed(1), champ: pack });
  runningN = false;
  poolN.close();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/train') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    const gens = Math.max(1, Number(url.searchParams.get('gens') || 500));
    const pop = Math.max(6, Number(url.searchParams.get('pop') || 14));
    const gpo = Math.max(2, Number(url.searchParams.get('gpo') || 5));
    const seedsN = Math.max(1, Math.min(Number(url.searchParams.get('seeds') || 3), 8));
    const roundsN = Math.max(1, Math.min(Number(url.searchParams.get('rounds') || 1), 20));
    const fresh = url.searchParams.get('fresh') === '1';
    /* 工具链修复：?seed=N 让训练可复现/可配对。
     * 原先 policy.js 的 randn/crossover 直接用 Math.random，训练完全不可复现；
     * 现在按 P.setRng(mulberry32(seed0 + 种子序号)) 播种。 */
    const seed0 = Number(url.searchParams.get('seed') || 0) || 0;
    const nPlayers = Math.max(2, Math.min(Number(url.searchParams.get('n') || 2), 5));
    if (nPlayers > 2) {
      sse(res, { type: 'start', gens, pop, gpo, n: nPlayers, from: 0, fresh });
      if (!runningN) {
        runningN = true;
        runTrainN(gens, { n: nPlayers, pop: Math.max(8, pop), games: Math.max(4, gpo), fresh: fresh, seed0: seed0 })
          .catch(function (e) { for (const c of clients) sse(c, { type: 'error', msg: String(e && e.message || e) }); runningN = false; });
      }
      return;
    }
    sse(res, { type: 'start', gens, pop, gpo, seeds: seedsN, rounds: roundsN, from: 0, fresh });
    if (!running) { running = true; runTrain(gens, { popSize: pop, gamesPerOpp: gpo }, { seeds: seedsN, rounds: roundsN, fresh, seed0: seed0 }); }
    return;
  }
  if (url.pathname === '/champion') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    const nQ = Math.max(2, Math.min(Number(url.searchParams.get('n') || 2), 5));
    if (nQ > 2) {
      const pack = lastChampionPackN || loadSeedN();
      const meta = (function () { try { const src = readFileSync(join(root, BUNDLE_MP), 'utf8'); const m = src.match(/EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/); return m ? JSON.parse(m[1]) : null; } catch (e) { return null; } })();
      res.end(JSON.stringify({ has: !!pack, n: nQ, gen: meta ? meta.gens : null, champion: pack, meta: meta }));
      return;
    }
    const gen = seeds.length ? Math.max(...seeds.map(x => x.t.gen)) : 0;
    const bestScore = seeds.length ? Math.max(...seeds.map(x => x.t.bestChampScore)) : 0;
    res.end(JSON.stringify({ has: !!lastChampionPack, gen, best: bestScore, seeds: seeds.length, champion: lastChampionPack }));
    return;
  }
  if (url.pathname === '/reset') {
    seeds = []; running = false; lastChampionPack = null;
    runningN = false; lastChampionPackN = null;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end('Epirus train server running. 在游戏训练页点「开始训练/连接远程训练」即可实时看进度。双击 tools/start-train-server.cmd 启动。');
});

server.listen(PORT, () => console.log('Epirus train server on http://127.0.0.1:' + PORT));
