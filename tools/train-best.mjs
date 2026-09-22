/* Epirus — 多种子择优训练：并行跑 N 个独立训练，实测每个冠军对 8 基准的胜率，
 * 保留平均胜率最高的（尤其保证能破墙/破防，避免"激进但输墙"的退化个体），写盘。
 * 用法：node tools/train-best.mjs [种子数=3] [每代=500] [worker数=auto]
 * 产物：js/bundled-champion.js
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { makeAsyncStep } from '../server/paralleltrain.mjs';
/* v1.5.18：2P 基准表改成**单一来源**（本文件与 `tools/promote-champion2p.mjs` 共用一份）。
 * ⚠️ 键序就是基准顺序（考卷种子 = 20260207 + i*977）⇒ 插/删/重排都会改变历史成绩。 */
import { P2_FNAME as fname, P2_NAMES as NAMES } from './p2-baselines.mjs';
import { rulesFingerprint } from './rules-fingerprint.mjs';
/* v1.5.130：择优（不回归层 + 容差带 + 发散度）抽成**纯函数单一来源** `tools/pick-best.mjs` ——
 * 动机见该文件头：旧实现内联在这里，`np-test` 想守它只能钉文本；抽出来后门可以喂合成候选表验行为。 */
import { pickBestByExam, regressionsOf, fixesOf, vetoBy3p } from './pick-best.mjs';
/* v1.5.161（P1）：3P 第二栏必须用**同一批量具 + 同一个 `feasibilityOf` 阈值**（`promote-champion` 与 `train-server` 都吃它），
 * 否则"当选面过了、体检没过"这种两套口径的裂缝又会出现（本仓为"量具抄两遍"栽过至少四次）。 */
import { selfPlay, reflectWall, aggressionProfile, seatSymmetry, densityProfile, chargeProfile, feasibilityOf, sandbox } from './audit-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dest = join(root, 'js', 'bundled-champion.js');
const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, P = sb.EpirusPolicy, B = sb.EpirusBots, R = sb.EpirusRules;

const __SEED = Number(process.env.EPIRUS_SEED || 1);
__seedSandbox(sb, __SEED);
if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(__SEED * 7919 + 13));


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


/* v1.5.161（qoder §N16 · P1）：当选面的**第二栏（3P 可行性五道）** + 产物改道
 * 病（§N14 实证，不是猜）：收口臂 `v7xn14a` 里 `band2`（候选3）考卷 98.25%/最差 85%、3P 五道全过、场B 4.00/局，
 * `score=0.916` 也**高于**当选 band1 的 0.891 —— 却只因容差带内 hill05 3.38 < 5.79 被挤掉；
 * 而当选者 band1 的 3P 侧是 **场B 0.00 + 墙 0.00/局**。**择优函数从头到尾没有 3P 这一栏** ⇒ 本臂目标被自己人扔掉。
 * 修法：`EPIRUS_TB3P=1` 时给每粒**训练候选**跑一遍 3P 五道（与 promote 同一批 `audit-lib` 量具、同一 `feasibilityOf` 阈值，
 * 不另抄一份），不过者**取消当选资格**；全不过 ⇒ `exit 9` 响亮（绝不"看不见就当过"、也绝不退回单栏硬选一个烂的）。
 * 默认 0 ⇒ 一行都不跑 ⇒ **行为逐字不变** ✓。`EPIRUS_TB3P_GAMES` 默认 120 = 本会话预注册的口径。
 * `EPIRUS_TB_OUT=<路径>`：产物写去别处（**门与探针因此不必碰 2P 槽**；§N14 那次 `train-best` 顺手把
 * `index.html` 的 `?v=` 缓存戳改了、槽内容还原了而戳没还 ⇒ 工作区脏，这条也是治它的）。 */
const TB3P = Number(process.env.EPIRUS_TB3P || 0);
const TB3P_GAMES = Number(process.env.EPIRUS_TB3P_GAMES || 120);
const TB_OUT = process.env.EPIRUS_TB_OUT || null;
const N = Number(process.argv[2] || 3);
const GENS = Number(process.argv[3] || 500);
const workers = Number(process.argv[4]) || 0;
const stepAsync = makeAsyncStep(T, workers ? { workers: workers } : {});
console.log(`[parallel] worker 数：${stepAsync.workers}；训练 ${N} 个候选 × ${GENS} 代`);
/* v1.5.130：**热启动开关**（默认开）。
 * 背景（本轮实测反例）：本工具原先让 16 个个体**全部随机重开**（`makeTrainer` 的 `P.makePolicy(0.25)`），
 * 于是一次"学会了新线（珠爆发 0%→93%）"的运行同时把 `defend`/`reflectspam` 打成 **0%**
 * —— 修一个洞、开两个洞。
 * ⚠️ **原话此处写"3P 侧早就是热启动（`EPIRUS_BUNDLE_IN` = 最新冠军，HANDOFF §2.2）"—— 那句已被证伪**
 * （`qoder-research-0920` §5，2026-09-20；DS 复核）：`tools/ring2-run.mjs:95` **无条件覆写** `EPIRUS_BUNDLE_IN`，
 * 起点恒为 `docs/artifacts/champion-5p-v1.3.58.bak`（:78）⇒ 3P 侧从来没有"从最新冠军热启动"过；
 * 它的真开关是 **`RING2_HOT=<包路径>`**（近期臂与线上包的 `meta.hotstartFrom` 全是 `d13d3c856c6cff62` 即此故）。
 * ⇒ **2P 侧这条（`EPIRUS_HOTSTART` + `T.seedChampion(t, curP)`）是本仓唯一真正生效的热启动**。
 * `evo.js` 的 `seedChampion()` 本来就是为"围绕冠军变异"写的。
 * `EPIRUS_HOTSTART=0` 可退回旧口径（与 v1.5.129 及之前的读数同口径）。 */
const HOTSTART = process.env.EPIRUS_HOTSTART !== '0';

/* v1.5.18：2P 基准表已抽到 `tools/p2-baselines.mjs`（单一来源；本文件与 promote-champion2p 共用）。
 * ⚠️ 键序就是基准顺序（种子 = 20260207 + i*977）⇒ 重排会改变历史考卷分，见该文件注释。 */
// 与页面“困难·冠军”一致的出招：temp 0.15、只挑可负担
function champSel(c) {
  return function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return T.pickChampion(state, pid, base, c, 0.15);   // v7：候选感知（旧包内部自动回退）
  };
}
function evalChamp(c) {
  const sel = champSel(c);
  let tot = 0; const per = {};
  for (let i = 0; i < NAMES.length; i++) {
    const nm = NAMES[i];
    const r = T.correctedWinRate(sel, B[fname[nm]], 40, 20260207 + i * 977);
    tot += r.wr; per[nm] = r.wr;
  }
  return { avg: tot / NAMES.length, per: per };
}
// 跨候选择优口径：与 evo.pickChampionByWinRate 同口径——人类式基准任一 <50% 直接不合格，合格后 min 主导
function evScore(ev) {
  let mn = 1;
  for (const k in ev.per) mn = Math.min(mn, ev.per[k]);
  let gateOk = true, gateMin = 1;
  for (const nm in ev.per) {           // 与 evo 同口径：任一基准 <50% 即不合格
    const v = ev.per[nm];
    if (v <= 0.5) gateOk = false;   // 严格 >0.5：纯平局(0.5)也不算过门
    if (v < gateMin) gateMin = v;
  }
  if (!gateOk) return gateMin * 0.4 - 1;
  return 0.5 * ev.avg + 0.5 * mn;
}

let best = null, bestTime = 0;
const cands = [];   // 多目标择优：先收集，再在胜率容差带内取最发散
let curP = null;    // v1.5.130：现有冠军的参数（提到 try 外层 —— 训练循环的热启动 `seedChampion` 要用它）
// 候选 0：现有磁盘冠军（不训练，仅评估）——保证新一轮择优绝不会回归到比现有更弱的冠军
try {
  const curSrc = readFileSync(dest, 'utf8');
  const curM = curSrc.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  const curObj = curM ? JSON.parse(curM[1]) : null;
  const curRaw = curObj ? P.unpack(curObj, true) : null;
  curP = curRaw ? P.embedLegacy(curRaw) : null;   // v7：旧形状逐位等价嵌入（热启动）
  if (curP) {
    const curEv = evalChamp(curP);
    console.log(`候选 0 (现有冠军): 不训练 | avg wr=${(curEv.avg * 100).toFixed(0)}% | wall=${(curEv.per.wall * 100).toFixed(0)}% defend=${(curEv.per.defend * 100).toFixed(0)}%`);
    cands.push({ tag: '现有冠军', isIncumbent: true, params: curP, pack: P.pack(curP), ev: curEv, score: null, secs: 0, sc: evScore(curEv), div: T.champEntropy(curP, 0.15, 60, 31337) });
  }
} catch (e) { /* 无现有冠军则跳过 */ }
for (let k = 0; k < N; k++) {
  const t = T.makeTrainer({ popSize: 16, gamesPerOpp: 6 });
  /* v1.5.130：热启动 —— 围绕**现有冠军**变异，而不是 16 个体全随机重开（说明见上面 HOTSTART）。 */
  if (HOTSTART && curP) T.seedChampion(t, curP);
  const t0 = Date.now();
  for (let g = 0; g < GENS; g++) await stepAsync(t);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  // 先按 broad 8 基准真实胜率把关冠军（不是 shaped 分），再做整体评测——避免 shaped fitness 捧出"打伤害不赢"的激进型
  T.pickChampionByWinRate(t, 16, (t.gen + 1) * 9973);
  const ev = evalChamp(t.champion);
  console.log(`候选 ${k + 1}: ${GENS}代 ${secs}s | score=${t.bestChampScore.toFixed(3)} | avg wr=${(ev.avg * 100).toFixed(0)}% | wall=${(ev.per.wall * 100).toFixed(0)}% defend=${(ev.per.defend * 100).toFixed(0)}% | sel=${evScore(ev).toFixed(3)}`);
  { const e = T.champEntropy(t.champion, 0.15, 60, 31337);
    cands.push({ tag: '候选' + (k + 1), params: (t.champion && t.champion.slice) ? t.champion.slice() : t.champion, pack: P.pack(t.champion), ev: ev, score: t.bestChampScore, secs: secs, sc: evScore(ev), div: e });
    console.log(`    └ 有效技能数=${e.effSkills.toFixed(2)}（hill05=${e.hill05.toFixed(2)} · ${e.distinct} 种 · divNorm=${e.divNorm.toFixed(3)}）`); }
  bestTime += Number(secs);
}
// ===== 多目标择优：胜率容差带内取**广度**最大者（v1.5.147：hill05→distinct→divNorm，理由见 pick-best.mjs 头） =====
// 只用 argmax(胜率) 必然挑中最强也最窄的个体（实测 2.52 vs 3.25 有效技能）。
// 这里改成：先把「胜率分 ≥ 最高分 - WR_TOL」的候选圈成 band，再在 band 里取广度序最高者。
/* v1.5.130：择优改成调 `tools/pick-best.mjs` 的纯函数（不回归层 + 容差带 + 发散度）。
 * 为什么要抽出来、以及它修的那个**假承诺**（"绝不会回归到更弱的冠军"）的实测反例，见该文件头。 */
const WR_TOL = 0.03;
/* 夜班（seed 11 反例 · 00:2x）：`vetoDegenerate` = 镜像零攻击（种类=0）的候选不许当选。
 * 病：2P 考卷对"只ジ不动手"的包能读 avg=100%（脚本互杀自己），择优看不出它会加冕退化包；
 * 3P promote 早有 v1.5.94"自对局零攻击判负"，两入口从此同判。闸在纯函数侧（D104⑩ 行为化守门）。 */
/* ===== v1.5.161（qoder P1 · §N14 实证）：当选面的 **3P 第二栏**（默认关 ⇒ 一行都不跑）=====
 * 为什么必须判在**作用点**上（§N12 的教训）：这一栏不参与择优 = 本臂目标（3P 的场B/墙）对选择完全透明，
 * 于是 `band2`（考卷 98.25%/最差 85%、3P 五道全过、场B 4.00/局、score 0.916 更高）被 hill05 挤掉，
 * 当选的 `band1` 反而是 3P 侧 **场B 0.00 + 墙 0.00/局** 的那粒。 */
let pool = cands;
if (TB3P > 0) {
  const W3 = sandbox();
  for (const c of cands) {
    if (c.isIncumbent || !c.params) { c.col3p = { measured: false, skipped: true }; continue; }
    const sp = selfPlay(W3, c.params, 'multi', TB3P_GAMES);
    const spL = selfPlay(W3, c.params, 'long', TB3P_GAMES);
    const rw = reflectWall(W3, c.params, 'long', TB3P_GAMES);
    const agg = aggressionProfile(W3, c.params, Number(process.env.EPIRUS_AGGR_GAMES || 40));
    const ss = seatSymmetry(W3, c.params, 'multi', Number(process.env.EPIRUS_SEAT_GAMES || 100));
    const dens = densityProfile(W3, c.params, 'long', Number(process.env.EPIRUS_DENSITY_GAMES || 20));
    const chgE = chargeProfile(W3, c.params, 'long', Number(process.env.EPIRUS_CHARGE_GAMES || 40));
    const feas = feasibilityOf({ seat: ss, G: sp, G2: spL, G2name: 'long', wall: rw, aggr: agg,
      density: { dmgPerRound: dens.dmgPerRound, jiShare: dens.jiShare, gained: chgE.gained, spentRate: chgE.spentRate,
        expiredPerGame: chgE.games ? chgE.expired / chgE.games : 0, zeroAtkRate: dens.zeroAtkRate, zeroDealtRate: dens.zeroDealtRate } });
    c.col3p = { measured: true, ok: !!feas.ok, fails: feas.fails || [], n: TB3P_GAMES,
      seat: feas.seatSpread, G: feas.G, G2: feas.G2, wall: feas.wallDmg, fieldA: feas.fieldA, fieldBClears: feas.fieldBClears };
    console.log('[3P栏 n=' + TB3P_GAMES + '] ' + c.tag + ' ' + (feas.ok ? '✅ 五道全过' : '✗ 不过：' + (feas.fails || []).join('；')) +
      '（G ' + feas.G + ' · G(long) ' + feas.G2 + ' · 墙 ' + feas.wallDmg + '/局 · 场A ' + (100 * feas.fieldA).toFixed(0) + '% · 场B 清场 ' + feas.fieldBClears + '/局 · 座位 ' + feas.seatSpread + 'pt）');
  }
  const veto = vetoBy3p(cands);
  if (veto.allRejected) {
    console.error('⛔ [3P栏] ' + veto.rejected.length + ' 粒候选**全部**过不了 3P 五道 ⇒ 不选"烂得最轻的"当冠军（§N14 的 band1 就是这么当选的）。');
    console.error('   要么承认这一配方买不到两栏、要么改配方重跑；**不接受静默退回单栏择优**。');
    process.exit(9);
  }
  for (const c of veto.rejected) console.log('[3P栏] ' + c.tag + ' ⇒ 取消当选资格（在位参照不参与否决）');
  pool = veto.kept;
  console.log('[3P栏] 参与择优 = ' + (pool.length - (pool.some(c => c.isIncumbent) ? 1 : 0)) + ' / ' + (cands.length - 1) + ' 粒候选');
}
const pick = pickBestByExam(pool, { wrTol: WR_TOL, vetoDegenerate: true });
for (const c of cands) if (c.__vetoed) console.log('[退化闸] ' + c.tag + ' 镜像零攻击（种类=0）⇒ 取消当选资格（v1.5.94 同族）');
best = pick.best;
const inc = pick.incumbent;
if (inc) console.log('[不回归层] 现有冠军=' + inc.tag + '；剔除候选=' + pick.dropped + ' 个（回归了冠军已过的基准）');
console.log('[多目标择优] 候选=' + cands.length + '  可择优=' + pick.safe.length + '  容差带=' + pick.band.length + '（胜率分 ≥ ' + (pick.topSc - WR_TOL).toFixed(3) + '）');
for (const c of cands) console.log('   ' + c.tag.padEnd(8) + ' sc=' + c.sc.toFixed(3) + '  avg=' + (c.ev.avg * 100).toFixed(0) + '%  hill05=' + (c.div.hill05 || 0).toFixed(2) + '  有效技能=' + (c.div.effSkills || 0).toFixed(2) + '  种类=' + c.div.distinct + '  divNorm=' + c.div.divNorm.toFixed(3) + '  回归=' + regressionsOf(c, inc) + '  新过=' + fixesOf(c, inc) + (TB3P > 0 ? ('  3P栏=' + (c.col3p && c.col3p.measured ? (c.col3p.ok ? '✅' : '✗') : '未测')) : '') + (c === best ? '   ← 选中' : ''));
console.log('   实际胜率损失 = ' + ((pick.topSc - best.sc) * 100).toFixed(1) + 'pt');
/* ===== v1.5.147（流程缺口，xfer44 反例）：带内全部候选落盘 =====
 * 旧实现只持久化当选者 —— 落选候选（如那天"种类=5/avg 99%"的候选3）**连复盘机会都没有**，
 * 与 D82"产物点名"的精神相悖。现在带内每一粒都写 `docs/artifacts/<ARM>-band<k>.bak`
 * （ARM=EPIRUS_ARM，默认 tb<seed>；.gitignore 已整目录忽略 artifacts，仓库不脏）。 */
try {
  const ARM = (process.env.EPIRUS_ARM || ('tb' + __SEED)).replace(/[^A-Za-z0-9_.-]/g, '');
  /* v1.5.161：**改道要改彻底** —— 设了 `EPIRUS_TB_OUT` 时带内候选也写到那个目录旁边，
   * 否则门/探针每跑一次就在 `docs/artifacts` 留一粒未点名的 `.bak`（实测：D124 首跑即被 D82 抓住 `tb31-band1.bak`）。
   * 不设 ⇒ 仍旧写 `docs/artifacts` ⇒ 历史臂行为逐字不变 ✓。 */
  const dir = TB_OUT ? dirname(isAbsolute(TB_OUT) ? TB_OUT : join(root, TB_OUT)) : join(root, 'docs', 'artifacts');
  if (!existsSync(dir)) { console.log('[band-save] 无 ' + dir + ' 目录，跳过'); }
  else for (let bi = 0; bi < pick.band.length; bi++) {
    const c = pick.band[bi];
    const bmeta = { source: 'tools/train-best.mjs (band-save)', arm: ARM, bandIdx: bi, tag: c.tag,
      selected: c === best, seed: __SEED, gens: GENS, avg: Number(c.ev.avg.toFixed(4)),
      div: { hill05: c.div.hill05 || null, effSkills: c.div.effSkills || null, distinct: c.div.distinct, divNorm: c.div.divNorm },
      /* v1.5.161（P1）：带内每一粒也带 3P 栏读数 ⇒ 落选的"另一栏更强"那种候选（§N14 的 band2）复盘时看得见 */
      col3p: c.col3p ? { measured: !!c.col3p.measured, ok: !!c.col3p.ok, n: c.col3p.n || null,
        fieldBClears: c.col3p.fieldBClears != null ? Number(c.col3p.fieldBClears) : null,
        wall: c.col3p.wall != null ? Number(c.col3p.wall) : null, fails: c.col3p.fails || [] } : null,
      rulesFingerprint: rulesFingerprint(), ts: new Date().toISOString() };
    writeFileSync(join(dir, ARM + '-band' + (bi + 1) + '.bak'),
      'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(bmeta) + ';\nwindow.EPIRUS_CHAMPION = ' + JSON.stringify(c.pack) + ';\n', 'utf8');
    console.log('[band-save] ' + ARM + '-band' + (bi + 1) + '.bak  ' + c.tag + (bmeta.selected ? '（当选）' : ''));
  }
} catch (e) { console.log('[band-save] 失败（不影响当选者写盘）：' + e.message); }
const packStr = JSON.stringify(best.pack);
/* v1.5.161：产物可改道（`EPIRUS_TB_OUT`）⇒ 门/探针跑真训练臂时**不必碰 2P 槽**，也不会顺手改 index.html 的缓存戳
 * （§N14 实测：还原了槽内容、忘了还原戳 ⇒ 工作区脏）。改道时既不备份槽、也不动戳 —— 因为槽根本没被写。 */
const OUT = TB_OUT ? (isAbsolute(TB_OUT) ? TB_OUT : join(root, TB_OUT)) : dest;
if (OUT === dest && existsSync(dest)) copyFileSync(dest, dest + '.bak');   // 覆写前留一份 .bak
const meta = {
  source: 'tools/train-best.mjs', seeds: N, gens: GENS, ts: new Date().toISOString(),
  champWr: best.ev.avg, divNorm: best.div.divNorm, distinct: best.div.distinct, wrTol: WR_TOL,
  /* v1.5.18（第三方复核 §5-1）：2P 包此前**一个 meta 字段都没有** ⇒ `np-test D16` 完全看不到它，
   * 于是"最后一次重训是 v1.3.47、此后 11 次提交动过 core、其中 v1.5.7 还把全息屏障移出 2P 卡表"
   * 这件事没有任何机械检查能发现。现在 2P 包也必须记：考卷成绩 + **规则指纹**。 */
  examMode: '2p-standard', examBaselines: NAMES.length, examGames: 40,
  examScoreAtBuild: Number(best.ev.avg.toFixed(4)),
  examMinBaseline: Number(Math.min.apply(null, NAMES.map(function (k) { return best.ev.per[k]; })).toFixed(4)),
  examGateOk: NAMES.every(function (k) { return best.ev.per[k] > 0.5; }),
  /* v1.5.130：把"相对上一包"的账记进**产物本身**（不回归层必须可审计，而不是只活在日志里）：
   * `regressionsVsPrev` 恒为 0 —— 否则上面的不回归层不会放行它（现有冠军自身也在候选里）。 */
  prevScoreAtBuild: inc ? Number(inc.ev.avg.toFixed(4)) : null,
  fixesVsPrev: inc ? fixesOf(best, inc) : 0,
  regressionsVsPrev: inc ? regressionsOf(best, inc) : 0,
  hotStart: !!(HOTSTART && curP),
  /* v1.5.161（P1）：当选者当年的 **3P 栏读数**随产物走（与 `meta.feasibility` 同精神：不可查 = 等于没测）。
   * `tb3p=0` 表示这一臂没跑第二栏（默认关）⇒ 读历史包时先看到这行，才不会把"没测"误读成"过了"。 */
  col3pAtBuild: best.col3p ? { measured: !!best.col3p.measured, ok: !!best.col3p.ok, n: best.col3p.n || null,
    fieldBClears: best.col3p.fieldBClears != null ? Number(best.col3p.fieldBClears) : null,
    wall: best.col3p.wall != null ? Number(best.col3p.wall) : null,
    G2: best.col3p.G2 != null ? Number(best.col3p.G2) : null, fails: best.col3p.fails || [] } : null,
  tb3p: TB3P > 0 ? TB3P_GAMES : 0,
  seed: __SEED, workers: stepAsync.workers, rulesFingerprint: rulesFingerprint()
};
writeFileSync(OUT,
  '/* Epirus 内置冠军：由 tools/train-best.mjs 生成（' + N + ' 候选择优，' + GENS + ' 代，总 ' + bestTime.toFixed(0) + 's）。不要手改。 */\n' +
  'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION = ' + packStr + ';\n', 'utf8');
// cache-busting：只在**真的覆写了 2P 槽**时更新 index.html 里冠军 script 的 ?v=（改道产物不该动槽的戳）
if (OUT === dest) try {
  const htmlPath = join(root, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  html = html.replace(/(bundled-champion\.js\?v=)[0-9a-z]+/i, '$1' + Date.now().toString(36));
  writeFileSync(htmlPath, html, 'utf8');
} catch (e) { /* ignore */ }
console.log(`择优完成：avg wr=${(best.ev.avg * 100).toFixed(0)}% wall=${(best.ev.per.wall * 100).toFixed(0)}% defend=${(best.ev.per.defend * 100).toFixed(0)}% score=${best.score != null ? best.score.toFixed(3) : '--(现有冠军)'}`);
console.log('已写入 ' + (OUT === dest ? 'js/bundled-champion.js' : OUT) + '（' + packStr.length + ' 字节）');
for (const nm of NAMES) console.log('  ' + nm.padEnd(9) + (best.ev.per[nm] * 100).toFixed(0) + '%');
stepAsync.close();
process.exit(0);
