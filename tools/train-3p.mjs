/* Epirus 多人自对战训练器（N19）：名次适应度 + 座位轮换 + 多对手池
 * 用法：node tools/train-3p.mjs [代=200] [人数=3] [每代评估局数=8] [种群=12]
 * 产出：js/bundled-champion-3p.js（window.EPIRUS_CHAMPION_3P）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { P2_FNAME } from './p2-baselines.mjs';   // 2P 考卷基准的单一来源（v1.5.150：`EPIRUS_XN2REF=exam` 用它）

/* 输出保护（千问复核的延伸）：训练工具的产出**默认不写线下冠军文件**。
 * 起因：一次 60 代/40 代的测试跑把 js/bundled-champion*.js 覆写成测试冠军，
 * 并被 git add -A 提交（线下冠军就这么被换掉了，我还据此写错过文档）。
 * 规则：只有显式 EPIRUS_PUBLISH=1 才写线下路径；否则写 docs/artifacts/<tool>-out.js。 */
/* Output path. NOTE: do NOT name this OUT_PATH and then reference OUT_PATH inside its own
 * definition -- my first version did exactly that (the replace script also rewrote the
 * shipped path inside the guard itself), producing a self-reference / TDZ. */
const OUT_PATH = process.env.EPIRUS_PUBLISH === '1'
  ? 'js/bundled-champion-3p.js'
  : ('docs/artifacts/' + 'train-3p' + '-out.js');

/* ===== Hard guard (belt & braces) =====
 * Twice now a training run silently replaced the SHIPPED champion (js/bundled-champion-3p.js):
 * once by a 40-gen test run, and the stale hard-coded log line made it look like it wrote
 * elsewhere. So: snapshot the shipped file at startup and restore it on exit unless
 * EPIRUS_PUBLISH=1. This holds even if OUT_PATH is wrong for any reason. */
const SHIPPED = 'js/bundled-champion-3p.js';
let __shippedBackup = null;
try { __shippedBackup = readFileSync(SHIPPED, 'utf8'); } catch (e) { }
if (process.env.EPIRUS_PUBLISH !== '1' && __shippedBackup != null) {
  process.on('exit', function () {
    try {
      if (readFileSync(SHIPPED, 'utf8') !== __shippedBackup) {
        writeFileSync(SHIPPED, __shippedBackup, 'utf8');
        console.log('[guard] \u5df2\u8fd8\u539f\u7ebf\u4e0b\u51a0\u519b\uff08\u672c\u6b21\u8bad\u7ec3\u4e0d\u5e94\u5199\u5b83\uff09');
      }
    } catch (e) { }
  });
}
import vm from 'node:vm';

const GENS = Number(process.argv[2] || 200);
const N = Number(process.argv[3] || 3);
const GAMES = Number(process.argv[4] || 8);
const POP = Number(process.argv[5] || 12);
/* §N6 跨 N 混适应度开关（默认 0 = 行为逐字不变；用法与红线见循环内注释） */
const XN2W = Number(process.env.EPIRUS_XN2W || 0);
const ANCHOR = Number(process.env.EPIRUS_ANCHOR || 0);   // v1.5.153：锚定正则 λ（0=关，逐字不变）
const XN2G = Number(process.env.EPIRUS_XN2G || Math.max(4, (GAMES / 2) | 0));

const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;

/* 可复现性（千问复核指出）：CLI 训练器原先**完全没播种**——沙箱直接塞宿主 Math，
 * 而 evo.js 的 breed() 用裸 Math.random ⇒ 走 CLI 的任何训练，种子从头到尾不起作用，
 * 产出的对照数字（WR_TOL 0.03 vs 0.01、3x200 vs 1x600 等）都是**未配对的噪声**。
 * 用法：EPIRUS_SEED=N node tools/xxx.mjs ...   （默认 1） */
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


const __SEED = Number(process.env.EPIRUS_SEED || 1);
for (const f of [
  'js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'
]) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });

const P = sb.window.EpirusPolicy;
// setRng must run AFTER the engine is loaded.
// I first put it before the vm.runInNewContext loop -> crashed with
// Cannot read properties of undefined (reading 'setRng'),
// which silently turned my "same sha twice" check into a VACUOUS one
// (it was re-reading an unchanged file).
__seedSandbox(sb, __SEED);   // 必须在引擎加载之后（vm 上下文可能不反映加载前的属性替换）
if (P.setRng && sb.window.EpirusTrainer.mulberry32) P.setRng(sb.window.EpirusTrainer.mulberry32(__SEED * 7919 + 13));

const Bots = sb.window.EpirusBots;
const T = sb.window.EpirusTrainer;

const OPPS = [
  { name: 'random', sel: Bots.pickRandom },
  { name: 'balanced', sel: Bots.pickBalanced },
  { name: 'aggro', sel: Bots.pickAggro },
  { name: 'defend', sel: Bots.pickDefend },
  { name: 'wall', sel: Bots.pickWall },
  { name: 'antidef', sel: Bots.pickAntiDef },
  { name: 'breakdef', sel: Bots.pickBreakDef },
  { name: 'mix', sel: Bots.pickMix },
  { name: 'farmer', sel: Bots.pickFarmer }
];

/* ===== §N6 修正（v1.5.150 · DS 09-22）：**2P 切片的对手必须是 2P 强参照，不能是多人池** =====
 * 病（实测，`docs/RESEARCH-LOG-2026-09-22-ds.md` §2）：原实现让每个个体对**多人池**打 2P，而现役包对
 *   `pickBalanced`/`pickGunSpam`/`pickAggro` 在 2P 里**全是 0% 胜率** ⇒ 人人 ≈0 分 ⇒ 该切片是**常数**
 *   ⇒ `fit'=(fit_main+W·fit₂)/(1+W)` 加常数**不改变排序** ⇒ 选择完全由 3P 侧驱动
 *   ⇒ 第一臂（`v7xn1-31.bak`）与热启动**逐字节相同**（空枪）。
 * 改法：切片的对手 = `EPIRUS_XN2REF`（逗号分隔的包路径，默认 = 现役 2P 冠军 `js/bundled-champion.js`），
 *   即"**跟 2P 强者打**"⇒ 分数能分出"谁在 2P 里撑得久"⇒ 梯度回来了。
 * `EPIRUS_XN2SCRIPTS=1` 可把多人池也并进来（默认**不并**：混入弱对手会稀释梯度）。
 * ⚠️ 读不出参照包 ⇒ **立刻退出**（拒绝静默退化：无梯度的切片等于白跑一整臂，正是本次踩的坑）。 */
const XN2REF_PATHS = (process.env.EPIRUS_XN2REF || 'js/bundled-champion.js')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
function loadPackParamsAny(p) {
  const src = readFileSync(p, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('没有 window.EPIRUS_CHAMPION[_3P] 外壳');
  const raw = P.unpack(JSON.parse(m[1]), true);
  return raw ? P.embedLegacy(raw) : null;
}
function champChooser(params) {
  return function (s, pl, legal) { return T.pickChampion(s, pl, legal, params, 0.15, 0, 5, 'soft'); };
}
const XN2_OPPS = [];
for (const rp of XN2REF_PATHS) {
  /* v1.5.150 追加（DS 09-22 臂 3 的教训）：`exam` = **直接用 2P 考卷那 20 个基准**当切片对手
   * （单一来源 `tools/p2-baselines.mjs`，与 `promote-champion2p`/`train-best.evalChamp` 同表）。
   * 为什么需要：臂 3（冠军 + 9 个多人池脚本）把信号**平均稀释**掉了 ⇒ 退回 0%；而考卷基准全部是
   * **可打的**（现役 2P 冠军对它们 99%）⇒ 只对着它们打 = 对着**产品判据本身**训 ⇒ 目标与验收一致。 */
  if (rp === 'exam') {
    for (const nm in P2_FNAME) {
      const fn = Bots[P2_FNAME[nm]];
      if (typeof fn !== 'function') { console.error('[train-3p] ⛔ 考卷基准 EpirusBots.' + P2_FNAME[nm] + ' 不存在（p2-baselines 与 bots.js 漂移）'); process.exit(4); }
      XN2_OPPS.push({ name: 'exam:' + nm, sel: fn });
    }
    continue;
  }
  let rpParams = null;
  try { rpParams = loadPackParamsAny(rp); } catch (e) { rpParams = null; }
  if (!rpParams) { console.error('[train-3p] ⛔ EPIRUS_XN2REF 读不出包：' + rp + '（拒绝静默退化：无梯度的切片等于白跑）'); process.exit(2); }
  XN2_OPPS.push({ name: 'ref:' + rp.replace(/^.*[\\/]/, ''), sel: champChooser(rpParams) });
}
if (Number(process.env.EPIRUS_XN2SCRIPTS || 0) === 1) for (const o of OPPS) XN2_OPPS.push(o);

const t0 = Date.now();

/* ===== Hot start: THIS WAS THE ROOT CAUSE (located by Qianwen) =====
 * The old code hot-started by readFileSync(OUT_PATH) -- but OUT_PATH is this tool's OWN
 * output path. So run #1 cold-started, run #2 read run #1's artifact => same seed, different
 * result. Training is DETERMINISTIC BUT STATEFUL, and the assertion "same seed twice"
 * can never see it: it misreports "the input changed" as "there is a random source".
 * Now:
 *   - COLD START BY DEFAULT (reuse nothing);
 *   - hot start requires explicit EPIRUS_HOTSTART=1, and the seed source is separate
 *     (EPIRUS_SEEDPACK=<path>, default = the shipped champion, never OUT_PATH);
 *   - the hot-start source is recorded in meta.hotstartFrom, so "which champion this run
 *     grew from" becomes part of the reproducible input instead of hidden state. */
let seedParams = null, hotstartFrom = null;
if (process.env.EPIRUS_HOTSTART === '1') {
  const srcPath = process.env.EPIRUS_SEEDPACK || 'js/bundled-champion-3p.js';
  /* v1.5.153 修正（DS 09-22 · **两臂白跑**的根因）：这里原来只认 `window.EPIRUS_CHAMPION_3P`，
   * 而 `train-best` 产的包是 **2P 外壳**（`window.EPIRUS_CHAMPION`）⇒ `EPIRUS_SEEDPACK=<2P 包>` 时
   * **静默不热启动**（`catch` 吞掉一切）⇒ 臂 7/臂 8 实际是**冷启动**跑的 ✗ —— 预注册前提没成立、结论作废。
   * ⇒ 两条修正：① 兼容两种外壳（与 `loadPackParamsAny` 同正则）；
   * ② **明确要了热启动却读不出 ⇒ 立刻退出**（拒绝静默退化；与 `EPIRUS_XN2REF` 同一条规矩）。 */
  let ok = false;
  try {
    const src = readFileSync(srcPath, 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (m) { const raw = P.unpack(JSON.parse(m[1]), true); seedParams = raw ? P.embedLegacy(raw) : null; hotstartFrom = srcPath; ok = !!seedParams; }
  } catch (e) { ok = false; }
  if (!ok) {
    console.error('[train-3p] ⛔ EPIRUS_HOTSTART=1 但读不出种子包：' + srcPath +
      '（拒绝静默冷启动 —— 白跑一整臂正是 09-22 臂 7/8 的教训）');
    process.exit(5);
  }
}

let pop = [];
for (let i = 0; i < POP; i++) {
  if (seedParams && i === 0) pop.push(seedParams);
  else if (seedParams && i < Math.floor(POP / 3)) pop.push(P.mutatePolicy(seedParams, 0.10));
  else pop.push(P.makePolicy(0.25));
}
if (seedParams) console.log('[train-3p] 热启动：以现有冠军为种子');
/* (c) h 基因：与 pop 平行的承诺视界（与 server/train-server.mjs 同口径）。
 * 2/3 个体跑纯原生（fit 干净），1/3 分到 h∈1..4，此后靠分巢精英存活 + 突变漂移。 */
let hGenes = pop.map(function (_, i) {
  if (i === 0) return 0;
  if (i % 3 !== 0) return 0;
  return 1 + (Math.floor(i / 3) % 4);
});
let sigma = 0.18;
let bestParams = pop[0], bestFit = -1e9;
const hall = [];                       // 名人堂：训练分靠前的个体（终局用全对手验证重选）
function addHall(params, fit) {
  hall.push({ params: params, fit: fit });
  hall.sort(function (a, b) { return b.fit - a.fit; });
  if (hall.length > 6) hall.pop();
}

console.log('[train-3p] 人数=' + N + ' 代=' + GENS + ' 种群=' + POP + ' 每代局数=' + GAMES +
  ' 参数=' + P.paramCount() + (XN2W > 0 ? (' · XN混适应度 W=' + XN2W + ' 2P局=' + XN2G + '/个体 · 2P对手=' +
    XN2_OPPS.map(function (o) { return o.name; }).join('+')) : '') +
  (ANCHOR > 0 ? (' · **锚定正则 λ=' + ANCHOR + '**（治遗忘：把个体拉回热启动种子）') : ''));

for (let gen = 0; gen < GENS; gen++) {
  const scored = pop.map(function (params, i) {
    let r = T.scoreMemberN(params, OPPS, GAMES, N, gen, i, hGenes[i]);
    /* ===== §N6 跨 N 混适应度（夜班 09-22 · 用户时间盒：只实现 + smoke，不产可换包候选）=====
     * EPIRUS_XN2W>0 ⇒ 每个个体**追加** XN2G 局 N=2 standard 切片，fit 按权重平均：
     *   fit' = (fit_main + W·fit_2)/(1+W)。
     * 直接检验白班两问："训最大即包含"是否只要把小场**写进目标**就成立；
     *   以及 2P 切片能不能让一包同时过 5P 门与 2P 对决（正式判据等用户 GO 后预注册）。
     * 默认 W=0 ⇒ 一条行为都不变（np-test D114 钉接线 + 默认值）。 */
    if (XN2W > 0 && N > 2) {
      const prevMode = T.trainMode();
      T.setTrainMode('standard');
      /* v1.5.150：对手 = `XN2_OPPS`（2P 强参照），**不是** `OPPS`（多人池在 2P 里是常数 ⇒ 无梯度 ⇒ 空枪）。 */
      const r2 = T.scoreMemberN(params, XN2_OPPS, XN2G, 2, gen, i, 0);
      T.setTrainMode(prevMode);
      r = Object.assign({}, r, { fit: (r.fit + XN2W * r2.fit) / (1 + XN2W), xn2fit: r2.fit });
    }
    /* ===== 锚定正则（v1.5.153 · DS 09-22 · "冻结/分区"立项的最小可测形式）=====
     * 依据（`docs/RESEARCH-LOG-2026-09-22-ds.md` §9/§10）：跨 N 两轴的失败机理是**遗忘** ——
     *   每阶段都牺牲上一场（练会 2P 忘 3P、找回 3P 又忘 2P），且**排练（4→16 局）也治不了**（零和）。
     * 机制可选的最小实现：向量化进化没有梯度 ⇒ "冻结"用**适应度锚定**表达：
     *   fit' = fit − λ · mean((θ−θ_seed)²)
     * 即"离种子越远，需要越高的原始分才配赢" ⇒ 直接压制漂移。λ=0（默认）⇒ 一条行为都不变。
     * 锚点 = 热启动种子（`EPIRUS_SEEDPACK`）；没热启动就没有锚点（本项自然失效）。 */
    if (ANCHOR > 0 && seedParams && params.length === seedParams.length) {
      let s = 0;
      for (let ai = 0; ai < params.length; ai++) { const d = params[ai] - seedParams[ai]; s += d * d; }
      const ms = s / params.length;
      r = Object.assign({}, r, { anchorDist: Math.sqrt(ms), fit: r.fit - ANCHOR * ms });
    }
    return { params: params, r: r };
  });
  scored.sort(function (a, b) { return b.r.fit - a.r.fit; });
  if (scored[0].r.fit > bestFit) { bestFit = scored[0].r.fit; bestParams = scored[0].params; }
  addHall(scored[0].params, scored[0].r.fit);
  addHall(scored[1].params, scored[1].r.fit);
  if (gen % 20 === 0 || gen === GENS - 1) {
    const r = scored[0].r;
    console.log('gen ' + gen + ' bestFit=' + r.fit.toFixed(3) +
      ' 1st=' + (r.firstRate * 100).toFixed(0) + '% top2=' + (r.top2Rate * 100).toFixed(0) +
      '% avgDealt=' + r.avgDealt.toFixed(2) + ' sigma=' + sigma.toFixed(3) +
      (r.anchorDist !== undefined ? ' 距种子=' + r.anchorDist.toFixed(4) : ''));
  }
  const breedRng = T.mulberry32 ? T.mulberry32(__SEED * 100003 + gen) : Math.random;
  const elite = scored.slice(0, 3).map(function (x) { return x.params; });
  /* (c) 分巢精英：每个 h 值保留它自己承诺局夺 1 率最高的个体（h 参与选择的唯一机制）。 */
  const byH = {};
  for (let i = 0; i < scored.length; i++) {
    const r2 = scored[i].r;
    if (!r2 || !r2.commitGames) continue;
    const k = r2.hGene || 0;
    if (!k) continue;
    if (!byH[k] || r2.commitFirstRate > byH[k].r.commitFirstRate) byH[k] = scored[i];
  }
  for (const k in byH) if (elite.indexOf(byH[k].params) < 0) elite.push(byH[k].params);
  const hOf = new Map();
  for (let i = 0; i < pop.length; i++) hOf.set(pop[i], hGenes[i]);
  const hPick = function (p) { const v = hOf.get(p); return (typeof v === 'number') ? v : 0; };
  const next = elite.slice();
  const nextH = elite.map(hPick);
  while (next.length < POP) {
    /* 与 server 同一类 bug（千问复核指出"Node 作用域漏播"）：
     * 这三行在 **Node 全局**，__seedSandbox 只换沙箱内的 Math，够不到这里
     * ⇒ 即使加了播种，train-3p 仍不可复现。改用显式播种流。 */
    const a = elite[Math.floor(breedRng() * elite.length)];
    const b = scored[Math.floor(breedRng() * Math.min(6, scored.length))].params;
    let child = breedRng() < 0.5 ? P.crossover(a, b) : a.slice();
    child = P.mutatePolicy(child, sigma);
    let ch = hPick(a);                                     // 基因随父代继承
    if (breedRng() < 0.15) ch = Math.max(0, Math.min(4, ch + (breedRng() < 0.5 ? -1 : 1)));
    next.push(child); nextH.push(ch);
  }
  if (gen % 30 === 29) { next[POP - 1] = P.makePolicy(0.25); nextH[POP - 1] = 0; }
  pop = next; hGenes = nextH;
  sigma = Math.max(0.06, sigma * 0.995);
}

const POOL = [Bots.pickRandom, Bots.pickAggro, Bots.pickDefend, Bots.pickBalanced,
              Bots.pickAntiDef, Bots.pickBreakDef, Bots.pickWall, Bots.pickMix, Bots.pickFarmer];
const ALL_PAIRS = [];
for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) ALL_PAIRS.push([POOL[a], POOL[b]]);

// 名人堂逐个用全部 28 对手对验证（新种子），取 1st 最高者作为最终冠军
let finalParams = bestParams, ev = null;
console.log('=== 名人堂验证（' + ALL_PAIRS.length + ' 对 x 20 局）===');
for (const h of hall) {
  const v = T.evalN(h.params, ALL_PAIRS, 20, N, 987654);
  const sc = v.firstRate + 0.5 * v.top2Rate;
  console.log('  trainFit=' + h.fit.toFixed(3) + ' -> 1st=' + (v.firstRate * 100).toFixed(1) +
    '% top2=' + (v.top2Rate * 100).toFixed(1) + '%');
  if (!ev || sc > (ev.firstRate + 0.5 * ev.top2Rate)) { finalParams = h.params; ev = v; }
}
bestParams = finalParams;

/* ===== 带内候选落盘（v1.5.150 · 移植自 `tools/train-best.mjs` 的 band-save）=====
 * 病：本工具的终局是"名人堂里用新种子重验、只取最优"，**其余候选全被丢掉** ⇒ 一旦重验选中热启动点，
 *     整臂的工作就没了（`v7xn1-31.bak` 与现役**逐字节相同**就是这么来的：候选连看都看不到）。
 * 改法：hall 里每一粒都写 `docs/artifacts/<ARM>-band<k>.bak`（ARM = `EPIRUS_ARM` 或输出名去掉扩展名），
 *     并把 `xn2*` 口径写进 meta（谁跑的、什么权重、对谁打 2P —— 产物要能自证来历）。
 * 只写盘、不改当选判定；失败不影响当选者写盘。 */
try {
  const ARM = process.env.EPIRUS_ARM || OUT_PATH.replace(/^.*[\\/]/, '').replace(/\.js$/, '');
  const BAND_DIR = process.env.EPIRUS_BAND_DIR || 'docs/artifacts';   // 可指向临时目录 ⇒ 门 D116 能行为式测它而**不欠 D82 的账**
  if (!existsSync(BAND_DIR)) console.log('[band-save] 无 ' + BAND_DIR + ' 目录，跳过');
  else for (let bi = 0; bi < hall.length; bi++) {
    const hh = hall[bi];
    const bmeta = {
      source: 'tools/train-3p.mjs (band-save)', arm: ARM, bandIdx: bi, trainFit: hh.fit,
      xn2w: XN2W || 0, xn2g: XN2G, xn2refs: (XN2W > 0 ? XN2REF_PATHS : []),
      n: N, gens: GENS, games: GAMES, pop: POP, seed: __SEED,
      selected: hh.params === bestParams, ts: new Date().toISOString()
    };
    writeFileSync(BAND_DIR + '/' + ARM + '-band' + (bi + 1) + '.bak',
      '/* band-save ' + ARM + '-band' + (bi + 1) + '（tools/train-3p.mjs v1.5.150 起） */\n' +
      'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(bmeta) + ';\n' +
      'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(hh.params)) + ';\n');
    console.log('[band-save] ' + ARM + '-band' + (bi + 1) + '.bak  trainFit=' + hh.fit.toFixed(3) + (bmeta.selected ? '（当选）' : ''));
  }
} catch (e) { console.log('[band-save] 失败（不影响当选者写盘）：' + e.message); }
console.log('\n=== ' + N + ' 人实测（最终冠军，28 对 × 20 局，座位轮换，temp0.15）===');
console.log('1st=' + (ev.firstRate * 100).toFixed(1) + '%  top2=' + (ev.top2Rate * 100).toFixed(1) +
  '%   (1st/2nd/3rd = ' + ev.first + '/' + ev.second + '/' + ev.third + ' of ' + ev.games + ')');
console.log('耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

const pack = P.pack(bestParams);
const meta = {
  source: 'tools/train-3p.mjs', n: N, gens: GENS, games: GAMES, pop: POP,
  ts: new Date().toISOString(), firstRate: ev.firstRate, top2Rate: ev.top2Rate
};
writeFileSync(OUT_PATH,
  '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 tools/train-3p.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
console.log('\n\u5df2\u5199\u5165 ' + OUT_PATH + '  (coldStart=' + (!seedParams) + ', seed=' + __SEED + ')');
