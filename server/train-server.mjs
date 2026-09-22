/* Epirus — 训练服务（Node，零依赖）：SSE 实时推送进度，训练完写 js/bundled-champion.js。
 * 启动：双击 tools/start-train-server.cmd，或 node server/train-server.mjs [端口=8787]
 * 浏览器训练页「连接远程训练」即可实时看进度；游戏仍双击 index.html 即玩。
 * 语义说明：
 *   - /train?gens=N  从当前 checkpoint 继续训练 N 代（持续训练：训练完再点一次会接着练）。
 *   - /reset         重置服务端训练器（新种子/清空服务端进度）。
 */
import http from 'node:http';
import { OPP_FN } from './opp-pool.mjs';   // v1.4.9：对手池单一来源（与 worker 共享）
/* v1.5.2：对手池支持「风格化冠军」当靶子（`champ:<仓库相对路径>`）—— 机制单一来源见该模块。 */
import { isChampOpp, champOppMissing, makeChampOppResolver, makeOppSelResolver } from './opp-champs.mjs';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';   // v1.5.48：writeBundleMP 用 resolve（容忍绝对路径）
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { makeAsyncStep, makeParallelEvalN } from './paralleltrain.mjs';
/* v1.5.18：反摆烂奖励 env 的**单一来源**（审计 §5-3：两端各写一遍导致 firstW 静默半开）。 */
import { readFightEnv, hasFightOverride, FIGHT_REWARD_KEYS } from './fight-env.mjs';
/* v1.5.89：经济/熵奖励 env 的**单一来源**（与 worker 共用同一份解析，见该文件头部的同族 bug 说明）。 */
import { readEconEnv, hasEconOverride } from './econ-env.mjs';
/* N3（qoder-research 0920 · RESEARCH-QUEUE 09-20）：产物 meta 记**落盘时的规则指纹** ——
 * 09-20 语义变更（policy.js !tid 修）之后，677 个 .bak 里哪些是旧语义训的没有任何机械手段可分辨。 */
import { rulesFingerprint } from '../tools/rules-fingerprint.mjs';
import { makeShapeScorer } from './shape-scorer.mjs';   // P2 形状适应度（qoder-research 0920）

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
/* P2（qoder-research 0920）：与 worker 同一份宿主接线（server 的无 worker 回退路径也要能跑形状项）。 */
sb.__shapeScorer = makeShapeScorer(sb, Number(process.env.EPIRUS_S4_GAMES || 8));
const stepAsync = makeAsyncStep(T);   // 并行加速：每代把评估切到 worker 池跑多核
console.log('[parallel] 训练 worker 数：' + stepAsync.workers);

const clients = new Set();
let seeds = [];            // 多种子池：[{t, seed, done, stopReason, peakWr, stall, checked}]
let running = false;
let lastChampionPack = null;   // 最近一次择优成功的冠军包（供 /champion 拉取）

let seedLegacyFrom = null;   // v7：热启动包若是**旧形状嵌入**而来，记下它的包版本（谱系用）

/* 从 js/bundled-champion.js 读回已保存冠军，用于服务重启后热启动持续训练。
 * 注意：bundle 现在含 meta（EPIRUS_CHAMPION_META）在前，不能再用 indexOf('=')（会拿到 meta 的等号导致 JSON.parse 失败）。 */
function loadSeed() {
  try {
    const src = readFileSync(join(root, 'js', 'bundled-champion.js'), 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    /* v7：先严格读（当前形状），失败再按**逐位等价嵌入**读历史形状 —— 否则换特征版本就只能从随机重开，
     * "同起点 A/B"与 hotstartFrom 谱系一起报废（见 policy.js embedLegacy）。 */
    const r = P.loadAny(JSON.parse(m[1]));
    if (r && r.legacy) seedLegacyFrom = r.from;
    return r ? r.params : null;   // loadAny：v7 走严格、旧形状走逐位等价嵌入
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
  /* v1.5.48：**隔离模式下绝不改 index.html**（它也是线上交付物）。 */
  if (process.env.EPIRUS_BUNDLE_OUT) return;

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
    return T.pickChampion(state, pid, base, params, temp);   // v7：候选感知
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
/* ===== v1.5.96：示范/课程的 env 与主线程设定 —— **两条训练路径共用一份实现** =====
 * 本轮事故的**真根因**：runner 的 URL 带 `n=5` ⇒ 请求走 **`runTrainN`**（多人路径），
 * 而全部 IMIT 接线原先只写在 **`runTrain`**（2 人路径）里 ⇒ **N 人路径上 `imitB ≡ 0`**：
 * 既没有一致性奖励、也没有真示范，整臂与对照**逐位相同**（`v7ringT` 实测）。
 * ⚠️ 更大的后果：v1.5.31 那句"C 方案实测未奏效（只做动作级模仿，学不到跨回合轨迹）"
 * **很可能是在 `imitB ≡ 0` 的空操作上得出的** ⇒ 与之前那批 A/A 臂同类，该结论应视为**未验证**。
 * ⇒ 抽成一个函数、两条路径都调它（本仓库的规矩：同一件事不许写两遍）。 */
function applyImitEnv(gens) {
  const imitGens = Math.floor((gens || 0) * Number(process.env.EPIRUS_IMIT_FRAC || '0'));
  process.env.EPIRUS_IMIT_GENS = String(imitGens);   // 给 worker 的**消息**读（paralleltrain 在消息里读它）
  let acc = null;
  if (T.setImitTeacherByName && process.env.EPIRUS_IMIT_TEACHER) {
    acc = T.setImitTeacherByName(process.env.EPIRUS_IMIT_TEACHER);
    /* v1.5.96 补：**名字解析不出来必须响亮拒绝**，不许静默退回默认教师 `heavyfire`。
     * 本轮 `v7stock1` 就是这么暴露的：env 写 `deepsaver`（它不在 `BOT_PICKS` 里，正确名字是 `pickDeepSaver`），
     * `accepted=false`，而库里照旧用 heavyfire ⇒ **整臂贴着错标签跑完**。
     * 与"env 到不了 worker"、"接线只在 2 人路径"同族 ⇒ 规矩：**开关要么生效、要么响亮失败**。 */
    if (!acc) {
      throw new Error('[imit] 教师名字解析失败：EPIRUS_IMIT_TEACHER=' + process.env.EPIRUS_IMIT_TEACHER +
        ' —— 可用名字 = `antiring`，或 `BOT_PICKS` 的键（heavyfire/guardgun/reflectspam…），' +
        '或全局注册表的函数名（pickRingSpam / pickDeepSaver）。拒绝用默认教师跑完。');
    }
  } else if (process.env.EPIRUS_IMIT_TEACHER === 'antiring' && T.setAntiRingTeacher) {
    T.setAntiRingTeacher(); acc = true;   // 老沙箱兜底
  }
  const ovr = T.setImitOverride ? T.setImitOverride(process.env.EPIRUS_IMIT_OVERRIDE === '1') : null;
  if (T.setImitUntil) T.setImitUntil(imitGens);
  /* v1.5.102：训练侧**座位探针局数**（主线程一份；worker 侧走消息 —— env 是拷贝）。
   * 缺省不改 ⇒ 保持 `SEAT_GAMES = 6` 的旧行为（"默认不设即不变"）。 */
  let seatG = null;
  if (T.setSeatGames && Number(process.env.EPIRUS_TRAIN_SEAT_GAMES || 0) > 0) {
    seatG = T.setSeatGames(Number(process.env.EPIRUS_TRAIN_SEAT_GAMES));
    console.log('[seat] 主线程生效值 SEAT_GAMES=' + seatG + '（原默认 6 局；门禁/落盘默认 60 局）');
  }
  /* v1.5.103（v1.5.100 §20）：**清场计数**奖励（默认关）。门禁要 `场B 清场 ≥ 0.3/局` 而训练 `fit` 里
   * 一项都没有 ⇒ 补上；worker 侧走消息（env 是拷贝）。 */
  if (T.setClearReward && Number(process.env.EPIRUS_CLEAR_W || 0) > 0) {
    console.log('[clear] 主线程生效值 CLEAR_W=' + T.setClearReward(Number(process.env.EPIRUS_CLEAR_W)) +
      '（封顶 /1，与 tgtBonus 同尺度；口径 = 收缩开始前由我打死的对手数）');
  }
  /* v1.5.97：**分段教师计划**（两段课程）。解析只走 evo.js 的 `setImitPlanByName`（与 worker 共用一份）；
   * 名字/占比非法 ⇒ 它**抛错**，这里不吞 ⇒ 整个 /train 请求响亮失败（不许静默退回默认教师）。 */
  let planN = 0;
  if (T.setImitPlanByName && process.env.EPIRUS_IMIT_PLAN) {
    planN = T.setImitPlanByName(process.env.EPIRUS_IMIT_PLAN, imitGens) || 0;
  } else if (T.setImitPlan) { T.setImitPlan(null); }
  /* v1.5.98：**只示范目标卡**（全局口径；计划里也能按段设，见片段第三段）。
   * 机制：v1.5.97 §4 里第二段的 fallback 覆盖把第一段教出来的"攒"抹掉了。 */
  let onlyK = null;
  if (T.setImitOnly) onlyK = T.setImitOnly(process.env.EPIRUS_IMIT_ONLY || null);
  /* v1.5.99：**"只教目标卡"的示范只在补贴局里发生**（补贴局花的是白来的 ep ⇒ 不对"攒"征税）。 */
  const subOnly = T.setImitSubOnly ? T.setImitSubOnly(process.env.EPIRUS_IMIT_SUB_ONLY === '1') : null;
  console.log('[imit] 主线程生效值 gens=' + imitGens + ' frac=' + String(process.env.EPIRUS_IMIT_FRAC || 0) +
    ' teacher=' + (process.env.EPIRUS_IMIT_TEACHER || '(默认 heavyfire)') + ' accepted=' + String(acc) +
    ' override=' + String(ovr) + ' plan=' + (process.env.EPIRUS_IMIT_PLAN || '(无)') + ' 段数=' + planN +
    ' only=' + (onlyK || '(不过滤)') + ' subOnly=' + String(subOnly) +
    ' β(gen0)=' + (T.imitBetaForGen ? T.imitBetaForGen(0) : '?'));
  return imitGens;
}

async function runTrain(gens, opts, cfg) {
  if (T.setRegenTotal) T.setRegenTotal(Number(process.env.EPIRUS_REGEN_GENS || gens || 0));
  /* C 方案：脚本教师模仿。注意 worker 是**独立进程**，主线程 setImitUntil 传不进去，
   * 故走环境变量 **+ 消息**（v1.5.96 起消息是主路径：worker 的 env 是创建时的拷贝）。
   * v1.5.96：这段**统一走 `applyImitEnv`**，与 `runTrainN` 共用一份实现。 */
  const imitGens = applyImitEnv(gens);
if (process.env.EPIRUS_TGT_W && T.setTargetReward) {
  console.log('[tgt] 威胁靶向奖励权重 = ' + T.setTargetReward(Number(process.env.EPIRUS_TGT_W)) + '（复核 §15-1）');
}
  if (T.setRingForceUntil) T.setRingForceUntil(Number(process.env.EPIRUS_RING_FORCE_UNTIL || 0));
  if (T.setRingForceEps) {
    const _e = T.setRingForceEps(Number(process.env.EPIRUS_RING_FORCE_EPS || 0));
    /* v1.5.39：主线程审计轨迹（worker 的 stdout 不进流，只有主线程的会）——
     * 让"定向强迫有没有生效"可以直接看到，而不是靠权重差异猜。 */
    console.log('[ringforce] 主线程 eps=' + _e + '  env=' + JSON.stringify(process.env.EPIRUS_RING_FORCE_EPS || null) +
      (Number(process.env.EPIRUS_RING_FORCE_EPS || 0) > 0 && _e === 0 ? '  ⚠️ env 有值但主线程没设上（sandbox 版本问题？）' : ''));
  }
  if (T.setImitUntil) T.setImitUntil(imitGens);
  cfg = cfg || {};
  const seedN = Math.max(1, cfg.seeds || 3);
  const rounds = Math.max(1, cfg.rounds || 1);
  const fresh = !!cfg.fresh;
  const t0 = Date.now();
  /* v1.4.7：原为写死的 30 分钟墙上时钟上限（第十轮复核 §6-4：同 seed 同 gens 在慢机器上可能
     * 一整份产物都不产出，破坏"同参数可复现"）。改成可关/可调：EPIRUS_WALL_MS=0 关闭（纯按代数收敛），
     * 默认仍是 30 分钟以保持既有行为。 */
  const cap = Number(process.env.EPIRUS_WALL_MS == null ? 1800000 : process.env.EPIRUS_WALL_MS); // 30 分钟上限
  /* v1.5.18 修（第三方复核 §5-2，实测）：**2P 这条路径此前整段没有播种** ——
   * `T.makeTrainer` → `P.makePolicy` 与 `evo.breed()`（用裸 `Math.random`）全走宿主随机，
   * 于是 `seed` / `fresh` / `hotstartFrom` 都记进了 meta，产物却永远不可复现。
   * （`js/bundled-champion.js` 那个 2P 包正是这条路的产物；它的 meta 也因此是空的。）
   * 现在与 N 人路径（见下方 `runTrainN`）用**同一套**播种：policy 的 randn + 沙箱 Math。
   * ⚠️ 只对"用新代码重训"生效；既有产物不追溯修复（要重测得跑 `promote-champion2p`）。 */
  const SEED0P = (Number((cfg && cfg.seed0) || 0) || 1) * 7919 + 13;
  if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(SEED0P));
  __seedSandbox(sb, SEED0P);
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
    writeBundle(finalPack, { source: 'server/train-server.mjs', seeds: seedN, gens, round: r + 1, rounds, ts: new Date().toISOString(), keptExisting: bestSeed < 0, fresh: fresh, champWr: bestWr, rulesFingerprint: rulesFingerprint(), seed: Number((cfg && cfg.seed0) || 0), hotstartFrom: hotstartFrom, seedEmbeddedFrom: seedLegacyFrom });
    last = { best: bestScore, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 };
    for (const c of clients) sse(c, { type: 'roundDone', round: r, rounds, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 });
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  for (const c of clients) sse(c, { type: 'done', from: 0, gens, best: last.best, champWr: last.champWr, attackShare: null, secs, bestSeed: last.bestSeed, seeds: seedN, rounds, keptExisting: last.keptExisting });
  running = false;
}

/* ==================== 多人（N ≥ 3）训练 ==================== */
/* v1.3.59：默认池保持 9 个；用 EPIRUS_OPP_N 可覆盖，专门给"加对手"的配对 A/B 用
 * （改默认值会让 A/B 的两个臂共用一个常量，无法配对）。 */
const OPP_NAMES = (process.env.EPIRUS_OPP_N
  ? String(process.env.EPIRUS_OPP_N).split(',').map(function (x) { return x.trim(); }).filter(Boolean)
  : ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer']);
/* 名字→函数必须显式写（'autodef' 这类拼接会导致 pickAntidef 大小写错误） */
/* v1.4.8：补回四个"单一防御 specialist"名字（v1.3.22 一次性剔除了它们，见 CHANGELOG v1.3.22）——
 * 那次审计的判据是"它是不是一个像样的**对手/人格**"（能赢吗/打法多样吗），
 * 但对**训练池**该问的是"它能不能暴露冠军的洞"。第十轮复核 + 我方复验：
 *   冠军对 4×反弹墙 1st = 0.0%（每局被自己的枪弹回 3.00 次 = 恰好 3 血上限 ⇒ 必死），
 *   而对 4×防御/八卦/原型 墙都是 100.0% ⇒ **只有反弹是真洞**。
 * 所以默认池只放 reflectspam 一个（低权重），其余三个只留名字供实验用（?opps=）。 */
/* v1.4.9：对手池从 server/opp-pool.mjs 派生（原先与 worker 的 OPP_POOL 各写一遍 ⇒ 会静默漂移：
 * v1.3.59 只补了 worker、v1.4.8 只补了 server，两次都让 A/B 退化成同一个实验）。 */
const BOT_FN_N = OPP_FN;
const BUNDLE_MP = 'js/bundled-champion-3p.js';   // 多人冠军（2/3/4/5 人局共用同一网络，特征与人数无关）
let lastChampionPackN = null;
let runningN = false;

function loadSeedN() {
  try {
    /* v1.5.48：隔离模式下从 EPIRUS_BUNDLE_IN 读热启动（训练不再碰线上包）。 */
    const src = readFileSync(resolve(root, process.env.EPIRUS_BUNDLE_IN || BUNDLE_MP), 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (m) { const r = P.loadAny(JSON.parse(m[1])); if (r && r.legacy) seedLegacyFrom = r.from; return r ? r.params : null; }
  } catch (e) { /* 无热启动 */ }
  return null;
}

function writeBundleMP(pack, meta) {
  /* v1.5.48：**训练产物绝不写线上包** —— 写 EPIRUS_BUNDLE_OUT（线上包只由 tools/promote-champion.mjs 写）。
   * 用 `resolve` 而非 `join`：env 里给绝对路径也不会被拼成坏路径（实测踩过：join 会把 D:\... 拼坏）。 */
  const OUTP = process.env.EPIRUS_BUNDLE_OUT ? resolve(root, process.env.EPIRUS_BUNDLE_OUT) : join(root, BUNDLE_MP);
  console.log('[bundle] wrote ' + OUTP + (process.env.EPIRUS_BUNDLE_OUT ? '  (隔离模式：未触碰线上包)' : '  (线上路径)'));
  writeFileSync(OUTP,
    '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 server/train-server.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
    'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
    'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
  bumpChampionVersion();   // 刷 index.html 的 ?v= 缓\u5b58\u6233
}

async function runTrainN(gens, cfg) {
  const SEED0 = Number(cfg.seed0 || 0);
  /* v1.5.96：**这条路径以前完全没有 IMIT 接线** —— 所有 N 人臂（含本晚全部实验）都走这里，
   * 所以 `imitB ≡ 0`、整臂与对照**逐位相同**。现在与 `runTrain` 共用 `applyImitEnv`。 */
  applyImitEnv(gens);
  /* WR_TOL is a CALLER input, not a hidden env read inside the engine
   * (Qianwen: CLI sandboxes have no `process`, so they always got the default). */
  if (T.setWrTol) T.setWrTol(Number(process.env.EPIRUS_WR_TOL || 0.03));
  /* v1.5.60：覆盖熵权重（DIV_W）环境旋钮。动因：本晚筛选发现 **G≥3 与 F≥25% 在所有候选里几乎互斥**
   * （打得凶的只用 2~3 张卡；用卡多的不够凶）⇒ 覆盖度这一维在演化目标里被压得太低，
   * 虽然代码注释说'覆盖熵自然把只剩两三张卡的个体压低'，实测权重不足以对抗 fitness 主力项。
   *
   * v1.5.89（第八轮复核 §2 的修）：这一组 env 原先在这里**内联**读，而 fitness 在 16 个 worker 里算
   * （worker 只读 EPIRUS_ECO_*）⇒ `EPIRUS_DIV_W/DIV_K/DIV_FORCE_GENS/WALL_FILTER` 全是空操作，
   * 臂 K / 臂甲 的 A/B 实际是 A/A。现在解析统一走 `server/econ-env.mjs`（worker 侧同一份），
   * 并把**实际生效值**打进日志与产物 meta（`ecoOverride`）——"这一臂到底开了什么"可被追溯。 */
  const ecoEnv = readEconEnv(process.env);
  const ecoSet = hasEconOverride(ecoEnv) && T.setEconomyReward ? T.setEconomyReward(ecoEnv) : null;
  if (ecoSet) console.log('[econ] 服务端生效值: ' + JSON.stringify(ecoSet));
  let __seedIdxN = 0;   // 每个种子递增，用于 setRng 配对
  if (T.setRegenTotal) T.setRegenTotal(Number(process.env.EPIRUS_REGEN_GENS || gens || 0));
  cfg = cfg || {};
  /* v1.5.0：训练模式由**调用方**显式传入（'multi'=3 血 / 'long'=5 血），默认 'multi'
   * ⇒ 不传就是旧行为、逐位不变。沿用 WR_TOL 的模式：引擎内不读 env。 */
  const mode = R.MODES[cfg.mode] ? cfg.mode : 'multi';
  if (T.setTrainMode) T.setTrainMode(mode);
  const n = Math.max(3, Math.min(cfg.n || 3, 5));
  const popSize = Math.max(8, cfg.pop || 32);
  const games = Math.max(4, cfg.games || 20);
  /* v1.3.59：对手池可按请求覆盖（`?opps=a,b,c`），默认仍是 OPP_NAMES。
   * 为什么不直接改默认值：A/B 的两个臂必须共用同一份代码、只差一个**输入**，
   * 否则"加对手"的实验与代码变更混在一起，无法配对。 */
  const oppNames = cfg.opps
    ? String(cfg.opps).split(',').map(function (x) { return x.trim(); }).filter(Boolean)
    : OPP_NAMES;
  /* v1.4.14：**未知对手名立刻中止**，并把错误送进 SSE（原先只 console.log ⇒ 在隐藏 server 的
   * stderr 里，用 curl 抓 SSE 完全看不到）。静默降级的两个真实后果都踩过：
   *   · worker 静默取子集 ⇒ "13 对手"的臂实际只跑 12 个，A/B 退化成同一个实验（v1.4.8）；
   *   · 名字完全不在池里 ⇒ `B[undefined]` 直到训练中途才炸成 `sel is not a function`（v1.4.14）。 */
  /* v1.5.2：对手名统一走**一个解析器**（脚本名 + `champ:<路径>` 冠军对手）。
   * 为什么必须唯一入口：这个项目已经因为"名字→函数"映射**写两处/漏一处**栽过三次
   * （v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 漏 opp-pool）；而我加 champ: 对手时
   * 又漏了**终局评估那条路**（它自己又写了一遍同样的"名字→函数"映射）⇒ 训练跑到名人堂评估才炸成
   * `sel is not a function`。这里同时把"解析失败"前移成**开跑前中止**（逐个名字都真的解一次）。 */
  const resolveOpp = makeOppSelResolver(sb, root, BOT_FN_N, sb.EpirusBots);
  /* v1.5.2：风格切片（复合适应度）的三个旋钮 —— 名单同样走统一解析器，缺文件照样开跑前中止。 */
  const styleNames = cfg.styleopps ? String(cfg.styleopps).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [];
  const styleW = Number(cfg.styleW || process.env.EPIRUS_STYLE_W || 0.5);
  const styleGamesN = Number(cfg.styleGames || process.env.EPIRUS_STYLE_GAMES || 2);
  const unknownOpps = [];
  for (const nm of oppNames.concat(styleNames)) {
    try { if (!resolveOpp(nm)) unknownOpps.push(nm); }
    catch (e) { unknownOpps.push(nm + '（' + e.message + '）'); }
  }
  if (unknownOpps.length) {
    for (const c of clients) sse(c, { type: 'error', msg: '未知/缺失对手: ' + unknownOpps.join(',') + '（脚本名可选: ' + Object.keys(BOT_FN_N).join(' ') + '；冠军对手写成 champ:<仓库相对路径>，例 champ:docs/artifacts/champion-5p-armB12f.bak）' });
    runningN = false;
    return;
  }
  /* v1.5.2：装好风格切片（复合适应度）。worker 是独立沙箱 ⇒ 名单/权重/局数还要随消息再下发一次
   * （见 paralleltrain / train-worker）；这里这一份是给**串行回退路径**和终局评估用的。 */
  const styleOpps = styleNames.map(function (nm) { return { name: nm, sel: resolveOpp(nm) }; });
  const slice = T.setStyleSlice ? T.setStyleSlice(styleNames.length ? styleOpps : null, styleW, styleGamesN) : { games: 0, w: 0, n: 0 };
  /* v1.5.7：经济奖励覆盖（env 传；worker 继承同一份 env ⇒ 两端一致）。用途：跑"旧门槛"对照臂
   * （`EPIRUS_ECO_TARGET=4 EPIRUS_ECO_CAP=10 EPIRUS_ECO_DIVW=0`），这样奖励的 A/B 不必回退代码版本。
   * v1.5.89：解析已提到本函数开头（`ecoEnv` / `ecoSet`，与 worker 共用 `server/econ-env.mjs` 一份实现）
   * ⇒ 这里**不再重复解析** —— "同一组 env 在两处各写一遍"正是第八轮复核 §2 那个 bug 的成因。 */
  /* v1.5.8：反摆烂覆盖（哨声惩罚 / 出手权重 / 先手激励）—— 同 env 机制，worker 继承同一份。
   * ⚠️ v1.5.18 修（第三方复核 §5-3）：触发条件**漏判 firstW** ⇒ 只设 `EPIRUS_FIGHT_FIRST` 时
   * worker 开、主线程不开（**静默半开**）。历史两轮 fstA/fstB 因为同时设了 dealW 才侥幸没暴露。
   * 现在"哪些 env / 要不要覆写"统一走 `server/fight-env.mjs`（与 worker 同一份实现）。 */
  const fightEnv = readFightEnv(process.env);
  const fightSet = hasFightOverride(fightEnv) && T.setFightReward ? T.setFightReward(fightEnv) : null;
  if (fightSet) console.log('[fight] 反摆烂覆盖: ' + JSON.stringify(fightSet));
  /* v1.5.11：把**实际生效**的奖励参数打出来。
   * ⚠️ v1.5.18 更正：本注释曾写"哨声惩罚现在长程默认 0.5、不靠 env" —— 那是 v1.5.11 的旧口径，
   * v1.5.12 已**回滚**（长程自动 0.5 是空操作，两条臂逐字节相同）⇒ 现在只反映 env 覆盖 + 代码默认值。
   * 有这一行 + worker 的 `fight` 回执，就能确认"两端都真的开了"而不是静默半开。 */
  if (T.fightReward) console.log('[fight] 生效值: ' + JSON.stringify(T.fightReward()) + '  (mode=' + mode + ')');
  if (T.economyReward) console.log('[eco] 生效值: ' + JSON.stringify(T.economyReward()));
  if (styleNames.length) console.log('[style] 风格切片: ' + slice.n + ' 对手 × ' + slice.games + ' 局/个体/代  权重=' + slice.w);
  const t0 = Date.now();
  /* v1.4.7：原为写死的 30 分钟墙上时钟上限（第十轮复核 §6-4：同 seed 同 gens 在慢机器上可能
     * 一整份产物都不产出，破坏"同参数可复现"）。改成可关/可调：EPIRUS_WALL_MS=0 关闭（纯按代数收敛），
     * 默认仍是 30 分钟以保持既有行为。 */
  const cap = Number(process.env.EPIRUS_WALL_MS == null ? 1800000 : process.env.EPIRUS_WALL_MS);
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
  for (const c of clients) sse(c, { type: 'start', n: n, gens, pop: popSize, gpo: games, from: 0, workers: poolN.workers, fresh: !!cfg.fresh, mode: mode, seed: SEED0 });
  for (let gen = 0; gen < gens; gen++) {
    let res = await poolN.evalPopN(pop, gen, games, n, oppNames, hGenes, styleNames, slice.w, slice.games);
    if (!res) {
      const opps = oppNames.map(function (nm) { return { name: nm, sel: resolveOpp(nm) }; });
      res = pop.map(function (params, idx) {
        const r = T.scoreMemberN(params, opps, games, n, gen, idx, hGenes[idx]);
        return { idx: idx, score: r.fit, firstRate: r.firstRate, top2Rate: r.top2Rate,
                 hGene: hGenes[idx], commitGames: r.commitGames, commitFirstRate: r.commitFirstRate,
                 commitTop2Rate: r.commitTop2Rate, commitMaxEp: r.commitMaxEp };
      });
    }
    /* v1.5.0 自检：worker 必须回执它**实际**用的模式。漏传 mode 时 worker 会用 'multi'，
     * 而服务端终局评估仍走 5 血 —— 这种"半程生效"最难发现（best 曲线看起来完全正常）。
     * 一有回执不符就中止并进 SSE，绝不让一份口径混杂的产物流出去。 */
    if (mode !== 'multi') {
      const bad = (res || []).filter(function (r) { return r && r.modeUsed && r.modeUsed !== mode; });
      if (bad.length) {
        for (const c of clients) sse(c, { type: 'error', msg: 'worker 没收到训练模式 ' + mode + '（回执=' + bad[0].modeUsed + '）—— 已中止，这份产物不能用' });
        runningN = false; poolN.close(); return;
      }
      /* v1.5.11 自检：奖励覆盖必须与服务端一致，否则它会静默半开（服务端开、worker 关），
       * 产物少一份适应度且日志完全正常（与 mode 半开同型）。
       * v1.5.18（第三方复核 §5-3）：从"只核 whistlePen"扩到**三项**（whistlePen / dealW / firstW）——
       * 只设 `EPIRUS_FIGHT_FIRST` 的那条路此前根本不进上面的触发条件，这条回执也就永远查不到它。 */
      const wantFight = (T.fightReward ? T.fightReward() : null);
      const badFight = (res || []).filter(function (r) {
        if (!r || !r.fight || !wantFight) return false;
        return FIGHT_REWARD_KEYS.some(function (k) { return r.fight[k] != null && wantFight[k] != null && r.fight[k] !== wantFight[k]; });
      });
      if (badFight.length) {
        for (const c of clients) sse(c, { type: 'error', msg: 'worker 的奖励覆盖与服务端不一致（worker=' + JSON.stringify(badFight[0].fight) + ' 服务端=' + JSON.stringify(wantFight) + '）—— 已中止，这份产物不能用' });
        runningN = false; poolN.close(); return;
      }
    }
    /* v1.5.2 自检：风格切片也要有回执。少了这一项，切片可能只在服务端那份生效、worker 照旧不算风格局
     * ⇒"复合适应度"名存实亡，而日志看起来完全正常（与 v1.5.0 的 mode 半开事故同型）。 */
    if (slice.games > 0) {
      const badS = (res || []).filter(function (r) { return r && !r.styleGames; });
      if (badS.length) {
        for (const c of clients) sse(c, { type: 'error', msg: 'worker 没跑风格切片（回执 styleGames=' + (badS[0] ? badS[0].styleGames : 'n/a') + '，期望 ' + slice.games + '）—— 已中止' });
        runningN = false; poolN.close(); return;
      }
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
  /* 终局：名人堂用全部对手对验证，取 1st 最高
   * v1.5.2：这里**必须**走同一个解析器 —— 之前就是这一处漏了 champ: 处理（训练跑到这里才炸）。 */
  const POOL = oppNames.map(function (nm) { return resolveOpp(nm); });
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
  /* ===== v1.5.19：**产物健康门槛（最后一道，无法绕过）** =====
   * 为什么必须放在落盘处：产物的冠军由内部多处提升路径共同决定（finishStep 的 bestChamp、
   * pickChampionByWinRate、上面的多目标择优），**任何一处漏改都会让门槛变成空操作** ——
   * 实测把门槛只加在前两处时，12 个 seed 的权重与未加时**逐字节相同**（METHODOLOGY 新增第 26 条）。
   * 口径 = 自对局体检（与 champ-audit 的 G/回合/平局**同一实现** T.mirrorHealth）。
   * 不过门槛 ⇒ **不写盘**（保留上一版产物），并在 SSE 里显式报告 ⇒ 不会再有"退化包静默上线"。 */
  /* v1.5.56: 实验臂开关（默认关 => 出厂路径一字不变）。今晚实测：12 个 seed 里 11 个被健康门槛拦下
   * （`自对局回合 45.3 > 40`）=> 包永远不换 => 表现为"训练冻结"，而验收因此没有有效样本。
   * 打开后：**仍记录** healthReject（SSE/meta 照报，透明）+ 大声打印，但**允许落盘**，
   * 让实验能拿到候选去测量；出厂门槛（promote-champion / 页面包）**不受影响**。 */
  const HEALTH_BYPASS = process.env.EPIRUS_ALLOW_HEALTH_FAIL === '1';
  let healthReject = null, healthInfo = null;
  const HGD = T.healthGate ? T.healthGate() : { on: false };
  if (HGD.on && finalParams) {
    const mh = T.mirrorHealth(finalParams, HGD.games, HGD.n, mode);
    healthInfo = { effSkills: mh.effSkills, distinctKeys: mh.distinctKeys, rounds: mh.rounds, drawRate: mh.drawRate, dmgPerGame: mh.dmgPerGame };
    const hf = T.healthFails(mh);
    if (hf.length) {
      healthReject = hf;
      console.log('[health] ⚠ 产物未过自对局体检 ⇒ 不写盘（保留上一版）：' + hf.join('；') +
        '（G=' + mh.effSkills.toFixed(2) + ' 种类=' + mh.distinctKeys + ' 回合=' + mh.rounds.toFixed(1) + '）');
      for (const c of clients) sse(c, { type: 'healthReject', fails: hf, info: healthInfo });
    }
  }
  /* ===== v1.5.67（第五轮复核 §4 的 ④）：把**上线门槛做成"决定产物的那一行"的可行性判定** =====
   * 病：训练的选择目标是"池上胜率 + 奖励"，而上线要求另外五道门槛（座位对称 / G / 反弹墙 / 场A / 场B）
   * ⇒ 实测五批 30+ 候选全是"某一项精彩、其余崩掉"（v9/v11/v12/v13/v14）。
   * 这里在**唯一的产物决定点**跑一次五道检查，把结论写进 meta（feasible / feasibilityFails / 各指标），
   * 供选优、runner 汇总与审计使用。默认**不阻断落盘**（避免重演 v1.5.56 的"整臂拦下"⇒ 实验没有样本）；
   * 出厂门槛仍由 tools/promote-champion.mjs 强制（那里才是"能不能上线"的判定）。 */
  let feasibleInfo = null;
  if (finalParams && process.env.EPIRUS_FEASIBILITY !== '0') {
    try {
      const audit = await import('../tools/audit-lib.mjs');
      /* v1.5.162（§N17）：这三处的 n 原先是**硬编码在服务器路径里**（seat 60 / wall 20 / aggr 20），
       * 而 CLI 体检用的是 seat 100 / wall 20 / aggr 40 ⇒ 同一个包两条路径读出的"五道"不是一把尺子
       * （champ-audit 的注释自己写着"座位探针 ≥100 才有判别力"）。现在统一走 `audit.feasPlan`。
       * 本处**只记录不阻断**（出厂门槛在 promote-champion），所以改的是读数口径、不是判定；
       * v1.5.164 续：同一块里那行 G 也统一了 —— 原先传 `(40, n, mode)`，而全仓另外 8 个调用点都是
       * `(20, 5, mode)`（`selfPlay` 本身就是 `mirrorHealth` 的三行转发，见 §N17 勘误）⇒ 镜像自对局的
       * G 同时依赖**局数**与**桌子大小**（`g-calib` 就是为标定 n 敏感性而存在）⇒ 浏览器路径记进
       * `meta.feasibility` 的那份一直与 CLI 体检不可直接比。现在同尺：**games 走 feasPlan、席位固定 5**。
       * 注意别误统一：上面 `[health]` 那处 `mirrorHealth(finalParams, HGD.games, HGD.n, mode)` 是**换冠军的健康门槛**，
       * 它按当前训练人数评估是有意的（门槛要判的就是"这张桌子上能不能打"），**不属于体检读数**。 */
      const FPN = audit.feasPlan(process.env);
      const ss = audit.seatSymmetry(sb, finalParams, 'multi', FPN.seat);
      /* v1.5.165（§N20）：**两个模式都判**（对齐 CLI 体检，v1.5.145 的用户裁定"long = 产品常用模式，也必须判"）。
       * 原来这里只传一个 `G`，且喂的是**训练模式** `mode`（可能是 'long'）⇒ 训练长程时记进 `meta.feasibility` 的那格
       * 其实是 long 的读数、却被 `feasibilityOf` 打印成 `G(multi)`（标签与实测量不符），而且**根本没有第四道**（G(long)）。
       * 现在按 CLI 的口径显式跑两遍：G = 5 席 multi、G2 = 5 席 long，与 `promote-champion` 完全同尺。 */
      const gg = T.mirrorHealth(finalParams, FPN.games, 5, 'multi');
      const ggL = T.mirrorHealth(finalParams, FPN.games, 5, 'long');
      const rw = audit.reflectWall(sb, finalParams, 'long', FPN.games);
      const ag = audit.aggressionProfile(sb, finalParams, FPN.aggr);
      /* v1.5.71：这五道阈值**不再写在这里** —— 与 tools/promote-champion.mjs 共用 audit-lib 的单一真源
       * （复核 §4-6：两头各写一份会漂；线上包是经 upgrade-pack 换的 ⇒ meta 里没有 feasibility）。 */
      feasibleInfo = audit.feasibilityOf({ seat: ss, G: gg, G2: ggL, G2name: 'long', wall: rw, aggr: ag });
      const ff = feasibleInfo.fails;
      console.log('[feasible] ' + (feasibleInfo.ok ? '✅ 五道全过' : '✗ ' + ff.join('；')) +
        '（座位 ' + feasibleInfo.seatSpread + 'pt · G(multi) ' + feasibleInfo.G + '（' + gg.distinctKeys + '种）' +
        (feasibleInfo.G2 != null ? ' · **G(long) ' + feasibleInfo.G2 + '**（' + ggL.distinctKeys + '种）' : '') + ' · 墙 ' +
        feasibleInfo.wallDmg + '/局 · 场A ' + (feasibleInfo.fieldA * 100).toFixed(0) + '% · 场B ' +
        feasibleInfo.fieldBClears + '/局）' +
        /* v1.5.164（§N19）：读数旁边必须自带尺子 —— 这条是给审计看的：以后谁再改 n/席位，日志一眼能看出来 */
        ' 〔' + FPN.tag + ' · G=mirrorHealth(' + FPN.games + ' 局, 5 席)〕' +
        (feasibleInfo.notes && feasibleInfo.notes.length ? ' ⚠ ' + feasibleInfo.notes.join('；') : ''));
      for (const c of clients) sse(c, { type: 'feasibility', info: feasibleInfo });
    } catch (e) {
      console.log('[feasible] ⚠ 判定失败（不阻断落盘）：' + String(e && e.message || e));
    }
  }
  if (healthReject && HEALTH_BYPASS) {
    console.log('[health] !! EPIRUS_ALLOW_HEALTH_FAIL=1（实验臂）：本次体检未过仍落盘（出厂门槛不受影响）：'
      + healthReject.join('；'));
  }
  if (!healthReject || HEALTH_BYPASS) lastChampionPackN = pack;
  if (healthReject && !HEALTH_BYPASS) {
    /* 保留上一版 bundle：本次**不产出物**。⚠️ 但必须把 `done` 事件照常发出去 ——
     * 第一版在这里直接 return，把 done 一起跳过了，runner 只能干等到 15 分钟超时后报
     * "没有 done 事件"（真因被埋掉）。 */
    for (const c of clients) sse(c, { type: 'done', n: n, gens, firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0, secs: ((Date.now() - t0) / 1000).toFixed(1), champ: null, health: healthInfo, healthReject: healthReject, wrote: false });
    runningN = false; poolN.close();
    return;
  }
  /* ===== v1.5.86：落盘处也允许**阻断**（默认关；EPIRUS_FEASIBILITY_BLOCK=1 打开）=====
   * 起因：`v7divK-82` 在训练里被正常写出（G 4.42、多样性最好），但换包时才被拦 ✗ ——
   * 它面对 4 面反弹墙**零伤害**（wall 0.00）。而五道检查本来就在这个"唯一的产物决定点"算过（v1.5.67），
   * 只是**只写进 meta、不断** ⇒ 训练把该自己做的事推给了换包那一步。
   * 打开后：不可行的候选不写盘，并把 `done` 事件照常发出（与健康门禁同一模式，避免 runner 干等）。 */
  if (process.env.EPIRUS_FEASIBILITY_BLOCK === '1' && feasibleInfo && feasibleInfo.ok === false) {
    for (const c of clients) sse(c, { type: 'done', n: n, gens: gens, firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0,
      secs: ((Date.now() - t0) / 1000).toFixed(1), champ: null, health: healthInfo, feasibility: feasibleInfo,
      feasibilityReject: true, wrote: false });
    runningN = false; poolN.close();
    return;
  }
  writeBundleMP(pack, { source: 'server/train-server.mjs', n: n, gens, games, pop: popSize, opps: oppNames.join(','), mode: mode, rulesFingerprint: rulesFingerprint(), styleOpps: styleNames.join(','), styleW: slice.w, styleGames: slice.games, feasibility: feasibleInfo, ecoOverride: (ecoSet ? JSON.stringify(ecoEnv) : ''), fightOverride: (fightSet ? JSON.stringify(fightEnv) : ''),
    /* v1.5.11：把**实际生效**的奖励参数也记下来（哨声惩罚现在长程默认开、不靠 env ⇒ 只记 env 会漏） */
    fightEffective: (T.fightReward ? JSON.stringify(T.fightReward()) : ''),
    ecoEffective: (T.economyReward ? JSON.stringify(T.economyReward()) : ''),
    ts: new Date().toISOString(), firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0,
    /* v1.3.56：把**可复现输入**记进产物。此前 meta 只有 source/n/gens/games/pop/ts/胜率，
     * 于是从产物上既看不出是不是热启动、也看不出输入是哪一版冠军 —— 而浏览器的默认配置
     * 恰好就是热启动（index.html 的"从头训练"复选框默认不勾，ui.js 也就不发 fresh=1）。
     * 与 v1.3.50 给 CLI 定的规矩对齐：让"从哪个冠军长出来的"成为可复现输入。 */
    seed: SEED0, fresh: !!cfg.fresh, hotstartFrom: hotstartFromN, seedEmbeddedFrom: seedLegacyFrom, workers: poolN.workers });
  for (const c of clients) sse(c, { type: 'done', n: n, gens, firstRate: ev ? ev.firstRate : 0, top2Rate: ev ? ev.top2Rate : 0, secs: ((Date.now() - t0) / 1000).toFixed(1), champ: pack, health: healthInfo, healthReject: healthReject });
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
    /* v1.5.0：训练模式可按请求覆盖（`?mode=long` = 5 血长程）。未知模式**立刻中止并进 SSE**，
     * 与"未知对手名"同一规矩 —— 静默降级会让"5 血实验"悄悄变回 3 血，而日志看起来完全正常。 */
    const modeQ = String(url.searchParams.get('mode') || '');
    if (modeQ && !R.MODES[modeQ]) {
      sse(res, { type: 'error', msg: '未知模式: ' + modeQ + '（可选: ' + Object.keys(R.MODES).join(' ') + '）' });
      return;
    }
    if (nPlayers > 2) {
      sse(res, { type: 'start', gens, pop, gpo, n: nPlayers, from: 0, fresh, mode: modeQ || 'multi' });
      if (!runningN) {
        runningN = true;
        runTrainN(gens, { n: nPlayers, pop: Math.max(8, pop), games: Math.max(4, gpo), fresh: fresh, seed0: seed0, opps: url.searchParams.get('opps'), mode: modeQ,
          styleopps: url.searchParams.get('styleopps'), styleW: url.searchParams.get('stylew'), styleGames: url.searchParams.get('stylegames') })
          .catch(function (e) { for (const c of clients) sse(c, { type: 'error', msg: String(e && e.message || e) }); runningN = false; });
      } else {
        /* v1.5.55 事故修复：此前这里是**静默 return** —— 第二个及以后的 /train 请求被无声丢弃，
         * runner 抓到的是**正在跑的那一场**的 done ⇒ 12 个"独立 seed"拷到**同一个包**
         * （实测 sha1 dfb399dab9 × 12、meta.seed 全 35）⇒ 一切"多种子对比"与"偏置验收"
         * 的有效样本恒为 1。现在改为**明确报错**，让工具链立刻炸出来。 */
        sse(res, { type: 'error', msg: '已有多人训练在跑：本次请求（seed=' + seed0 + '）被拒绝。一次只允许一场，避免产物串味。' });
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
