#!/usr/bin/node
/* coldstart-why-1104.mjs —— **为什么 2.0 冷启动训不出可用包，而 v7 当初可以**（用户 11-04 点名）
 *
 * 在册前提（11-03 §十四/§十五，本尺**不重跑训练**，只量"为什么"）：
 *   同世界同预算同 `makePolicy(0.25)` 的随机起点 ⇒ v7 出厂桌夺1 **53.0 / 50.6%**（3~4 种、防御族 ≈0）
 *   ‖ 2.0 只有 **21.3 / 19.3%**（7~10 种、防御族 61.4 / 66.1%）⇒ 2.0 一出生就落在"壁盆"，
 *   而且从壁盆续训 150 代爬不出去（fit 0.3~0.6，强盆 1.2~1.8）。今天波 D 复现了同一形状（1200 代仍 11.3/10.9）。
 *
 * 这台尺量两件事（都便宜、都可独立证伪）：
 *   M1 **出生点在哪**：各抽 N 枚随机粒，在脚本桌上量 种数 / 防御族份额 / 出手每局 / 夺1。
 *      ⇒ 若 v7 的随机粒**天生会打**、2.0 的天生摆架 ⇒ 差别不在搜索而在**参数化给的归纳偏置**。
 *   M2 **一步变异走多远**（景观崎岖度）：同一粒做 `mutatePolicy(p, σ)`，σ 取在册的两档
 *      （`SIGMA0=0.18` 出厂档 ‖ `0.06` = `EPIRUS_SIGMA_FLOOR` 地板档），
 *      **同 seed 重跑**、比对**出手键序列** ⇒ 翻转率 = 同一决策序号上换了键的比例。
 *      ⇒ 若 2.0 一步就把策略打散而 v7 基本不动，GA 在 2.0 上做的就不是爬坡而是随机跳 ⇒ 这就是"势垒"的微观解释。
 *
 * 三条自守（都是我今天在册病名，先钉在自己尺上）：
 *   ① **placebo 对照**：同一份权重跑两遍（σ=0）⇒ 翻转率必须 ≈ 0；不为 0 说明我的 seed 对齐是假的，整批判废。
 *   ② **装载自证**：跑前点名 `paramCount`（2.0 批必须 7993，v7 批必须是 v7 的长度）⇒
 *      防我 11-04 早上那次"漏 `installArch2` ⇒ 四枚不同 wid 读出同一份剖面"的同类错。
 *   ③ **两批分进程**：`--gen=7` 与 `--gen=2` 必须各起一个进程（`installArch2` 是进程内覆盖，混在一趟会把 v7 批也变成 2.0）。
 *
 * 用法：node scratch/coldstart-why-1104.mjs --gen=7 --N=12 --G=30   （默认 N=12 G=30）
 *       读数落 scratch/coldstart-why-1104-<gen>.tsv
 */
import { writeFileSync } from 'node:fs';
/* `mulberry32` 从 `tools/audit-lib.mjs` 拿**同一个实现**（`fieldProfile` 也是从那里 import 的）
 *   ⇒ 两边的 seed 展开逐字同，placebo 才有意义；自己抄一份就是"两份同构实现必漂移"的老账。 */
const { fieldProfile, WIN } = await import('../tools/behavior-profile.mjs').then(m => m.default || m);
const { mulberry32 } = await import('../tools/audit-lib.mjs');
const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) ARG[m[1]] = m[2] === '' ? '1' : m[2]; }
const GEN = String(ARG.gen || '');
if (GEN !== '7' && GEN !== '2') { console.error('⛔ --gen 只收 7 或 2（两批必须分进程跑，混在一趟装载会互相污染）'); process.exit(64); }
const N = Number(ARG.N || 12), G = Number(ARG.G || 30), SEED0 = Number(ARG.seed0 || 55000);
if (!(N >= 2) || !(G >= 5)) { console.error('⛔ N/G 太小就没法判翻转率的置信（要 N≥2、G≥5）'); process.exit(64); }
if (GEN === '2') {
  /* ⚑ 第二版踩的坑（被自己的 `paramCount` 守卫抓住）：`installArch2(WIN, {spec:'…'})` **不是 install 的入参形状**
   *   ⇒ 它按默认 dims 装出一张 **5225** 参的网，我以为是 7993。修法不自己拼 dims：**从一枚真产物读 cfg**
   *   （`packCfgExit` 是仓里唯一的"从包解 cfg"通路）⇒ 装出来的形状与臂**同源**，而权重仍然是随机生成的。 */
  const { readFileSync } = await import('node:fs');
  const { install: installArch2, packCfgExit } = await import('../tools/proto2/arch2.mjs');
  const CFG_SRC = process.env.CFG_FROM || 'scratch/ga-arms/CB13.js';
  const raw = JSON.parse(new RegExp('window\\.EPIRUS_CHAMPION_3P = (\\{[\\s\\S]*?\\});').exec(readFileSync(CFG_SRC, 'utf8'))[1]);
  const cfg = packCfgExit(raw, CFG_SRC).cfg;
  installArch2(WIN, cfg);
  console.log('2.0 装载：cfg 取自 ' + CFG_SRC + ' ‖ dims=' + JSON.stringify(cfg));
}
const P = WIN.EpirusPolicy;
const PC = P.paramCount();
const EXPECT = { 7: 5689, 2: 7993 };
console.log('装载自证：路径=gen' + GEN + ' ‖ paramCount=' + PC + ' ‖ 期望=' + EXPECT[GEN] +
  (PC === EXPECT[GEN] ? ' ✔' : ' ⚠ **不等于期望**（说明装载/接线与预期不同 ⇒ 本批读数全部标"读不出"，先修尺）'));
if (PC !== EXPECT[GEN]) process.exit(5);
const S = WIN.EpirusState, T = WIN.EpirusTrainer, Play = WIN.EpirusPlay, B = WIN.EpirusBots;
/* 桌子照 `tools/behavior-profile.mjs:64` 那一行**逐字同**地搭（五席脚本桌 ⇒ 与 11-03 §十四 那张出厂桌同一个东西）。
 *   名单从 `B` 现取，不写死名字以外的任何东西；取不到当场拒跑（"接不出桌子"不许读成"读数为 0"）。 */
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
if (SCRIPTS.some(function (f) { return typeof f !== 'function'; })) {
  console.error('⛔ 五席脚本名单取不全（EpirusBots 的导出名变了）⇒ 桌子搭不出来，本尺判"读不出"'); process.exit(6);
}

/* M2 的口径（关键，别读错）：**同一局、同一状态快照**上同时问父代与变异子"这一手选什么"，
 *   只让父代真的落子 ⇒ 两边输入逐字相同 ⇒ 翻转不是"世界分叉后的连锁"，而是**这一步参数变了**。
 *   ⚑ 两版踩坑才走对的（都靠 placebo 抓住，不是靠我觉得像）：
 *     ① 想用 `policyChooserN(params, 0, …)` 当贪心 ⇒ `js/train/policy.js:578` 的 `opts.temp || 0.6` **把 0 吞成 0.6**，
 *        同权重跑两遍翻到 77.5%；
 *     ② 改极小温度 `1e-9` 之后仍有 ~28% 地板 ⇒ 随机起点上**恰好并列的最高分**要靠抽样决胜（并列本身就是读数）。
 *     ⇒ 第三版**绕开抽样**：直接拿 `candidatesFor + forwardCands` 的 **argmax（`f.cand`）**比 ⇒ placebo 必须恰好 0；
 *        并列程度另量成 `tie%`。⚠ 所以这量的是"参数步长移动 argmax 的能力"，不是"产品档 temp0.15 的手感"。 */
const R = WIN.EpirusRules;
/* ⚑ 第二版原型的第二个坑（差点又读成"把手没用"）：`KEYBIAS` 只作用在**我这台的 argmax** 上，
 *   而 M1 那几列来自 `fieldProfile`（它自己建 chooser，不吃我的偏置）⇒ K 从 0.5 扫到 100，
 *   防御族一直纹丝不动 73~74%，那是**没接上**，不是**没效果**。修法：加一条 `M1b`——
 *   聚合剖面也走自己的贪心 chooser，类别用**引擎单源** `R.byKey[k].cat`（不自己写第二份分类）。 */
function profileWithHandle(params, G) {
  const SKL = R.SK, keys = {}, by = R.byKey;
  let acts = 0, defc = 0, atkc = 0, wins = 0, games = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % 5;
    const st = S.createState('multi', { next: mulberry32(SEED0 + g * 997) }, 5);
    st.slotSalt = (SEED0 + g * 2246822519) >>> 0;
    const cs = [];
    for (let i = 0; i < 5; i++) {
      if (i !== seat) { cs.push(T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length])); continue; }
      cs.push(function (state, pid, legal) {
        const a = argmaxPick(params, state, pid, legal);
        if (a.key && a.key !== SKL.JI) {
          acts++;
          keys[a.key] = (keys[a.key] || 0) + 1;
          const cat = by[a.key] && by[a.key].cat;
          if (cat === R.CAT.DEFENSE) defc++; else if (cat === R.CAT.ATTACK) atkc++;
        }
        return { key: a.key, target: null, target2: null, bead: null };
      });
    }
    Play.autoGameN(st, cs);
    games++; if (st.winner === seat) wins++;
  }
  const kinds = Object.keys(keys).filter(function (k) { return keys[k] / (acts || 1) >= 0.005; }).length;
  return { kinds: kinds, def: acts ? 100 * defc / acts : 0, atk: acts ? 100 * atkc / acts : 0,
    acts: acts / games, win: 100 * wins / games, dec: acts };
}
/* ===== P1 的"无改动原型试验"：给 argmax 前加一枚**逐键可加偏置** =====
 * 假设（今天由 sd 对比逼出来的）：2.0 缺的不是代数/步长/桌，而是**没有逐键的局部把手** ⇒ 随机粒的聚合行为钉在菜单默认值上。
 * 不必先改架构就能验：**在尺里**给候选 logit 加一个"每个技能键一个随机偏置"（`KEYBIAS=幅度`），
 *   等价于给头层加了 v7 式的 per-key bias。若聚合 sd 从 ~2pt 跳到 v7 那种 20pt 量级 ⇒ 假设成立，值得真去加这一维。
 * ⚠ 这是**仪器侧的原型**（不改 `arch2`、不改产物形状），所以它证明的是"这个把手会有方差"，不是"我们的包已经这样"。 */
const KEYBIAS = Number(ARG.keybias || 0);
/* 最后一格要回答的问题：**把手要多大，才能够在产品档温度（temp 0.15）下还留下"聚合行为差异"**？
 *   贪心档下两条路径都有差异（上面 K=0 就看见了），差异是被**采样温度抹平的** ⇒ 所以处方不是"加把手"三个字，
 *   而是"加一个幅度 ≥ X 的把手"。`SAMP=0.15` 让本尺按温度抽样（用对局自己的 rng ⇒ 与引擎同一条随机源）。 */
const SAMP = Number(ARG.samp || 0);
/* ⚑ 第一版原型是**错的**（我把偏置存成了"全局每键一份"⇒ 父/子/另一粒拿到同一套 ⇒ flip(random)=0、
 *   聚合 sd 也一动不动）。要模拟"把手在个体基因组里"，偏置必须**由这粒自己的参数派生**：
 *   下面用 FNV 取 params 的几个采样位当种子 ⇒ 每粒一套、可复现，且不需要改架构。 */
const KB = new Map();
const SEEDS = new WeakMap();
function kbSeedOf(params) {
  if (SEEDS.has(params)) return SEEDS.get(params);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < params.length; i += 97) { h = (h ^ (Math.round((params[i] + 1024) * 4096) >>> 0)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  SEEDS.set(params, h >>> 0);
  return h >>> 0;
}
function kbVal(key, params) {
  const kk = kbSeedOf(params) + '|' + key;
  if (!KB.has(kk)) {
    let x = kk.length * 2654435761;
    for (let i = 0; i < kk.length; i++) { x = (Math.imul(x ^ kk.charCodeAt(i), 1540483477) >>> 0); }
    KB.set(kk, KEYBIAS * (((x >>> 8) / 0x800000) * 2 - 1));
  }
  return KB.get(kk);
}
function resetKb() { /* 保留缓存（同粒同键必须同值），只在换路径时清 */ KB.clear(); }
const PLACEBO_MAX = 0.5;   /* 绕开抽样之后地板就该是 0；超过它 = 接线坏，不是"并列多" */
function argmaxPick(params, state, pid, legal) {
  /* 与 `T.policyChooserN` 同一个前置（`evo.js:961-962`）：先滤"买得起"，全买不起就退回 ジ ⇒ 别自己造第二套 */
  const aff = legal.filter(function (l) { return l.affordable; });
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  const cands = P.candidatesFor(state, pid, base);
  if (!cands || !cands.length) return { key: null, tie: 0, uniq: false };
  const f = P.forwardCands(state, pid, cands, params, { temp: 0.6 });
  let tie = 0;
  if (f && f.probs) { let mx = -Infinity;
    for (let i = 0; i < f.probs.length; i++) if (f.probs[i] > mx) mx = f.probs[i];
    for (let i = 0; i < f.probs.length; i++) if (Math.abs(f.probs[i] - mx) < 1e-12) tie++; }
  /* `uniq`：父代这一手**有没有唯一的最高分**。并列时 argmax 退回"候选表第一个"⇒
   *   那不是偏好，是表格次序 ⇒ 并列格上的"没翻转"不能算稳定（v7 随机起点 80% 决策是并列，见 §建尺账）。 */
  if (SAMP > 0 && f && f.logits) {
    /* 带温度抽样（K 可以=0 ⇒ 这就是"引擎同款 softmax 抽样"的对照组） */
    let mx = -Infinity, i;
    const lg = new Float64Array(f.logits.length);
    for (i = 0; i < f.logits.length; i++) { lg[i] = f.logits[i] + (KEYBIAS > 0 ? kbVal(cands[i].key, params) : 0); if (lg[i] > mx) mx = lg[i]; }
    let sum = 0; const pr = new Float64Array(lg.length);
    for (i = 0; i < lg.length; i++) { pr[i] = Math.exp((lg[i] - mx) / SAMP); sum += pr[i]; }
    const r = (state.rng && state.rng.next ? state.rng.next() : Math.random()) * sum;
    let acc = 0, bi = lg.length - 1;
    for (i = 0; i < pr.length; i++) { acc += pr[i]; if (r < acc) { bi = i; break; } }
    return { key: cands[bi] ? cands[bi].key : null, tie: 0, uniq: true };
  }
  if (KEYBIAS > 0 && f && f.logits) {
    /* 用加性偏置**重取 argmax**（并列按候选表次序 ⇒ 与出厂实现同一条 tie-break） */
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < f.logits.length; i++) { const v = f.logits[i] + kbVal(cands[i].key, params); if (v > bv) { bv = v; bi = i; } }
    const t2 = (function () { let n = 0; for (let i = 0; i < f.logits.length; i++) if (Math.abs((f.logits[i] + kbVal(cands[i].key, params)) - bv) < 1e-12) n++; return n; })();
    return { key: cands[bi] ? cands[bi].key : null, tie: t2, uniq: t2 === 1 };
  }
  return { key: f && f.cand ? f.cand.key : null, tie: tie, uniq: tie === 1 };
}
function sameStateFlip(parent, child, G) {
  let same = 0, diff = 0, ties = 0, uniqTot = 0, uniqDiff = 0; const firstDiffAt = [];
  for (let g = 0; g < G; g++) {
    const seat = g % 5;
    const st = S.createState('multi', { next: mulberry32(SEED0 + g * 997) }, 5);
    st.slotSalt = (SEED0 + g * 2246822519) >>> 0;
    let n = 0, fd = null;
    const cs = [];
    for (let i = 0; i < 5; i++) {
      if (i !== seat) { cs.push(T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length])); continue; }
      cs.push(function (state, pid, legal) {
        const a = argmaxPick(parent, state, pid, legal);
        const b = argmaxPick(child, state, pid, legal);
        n++;
        if (a.tie > 1) ties++;
        if (a.uniq) { uniqTot++; if (a.key !== b.key) uniqDiff++; }
        if (a.key === b.key) same++; else { diff++; if (fd === null) fd = n; }
        return { key: a.key, target: null, target2: null, bead: null };   /* 只有父代真的落子 */
      });
    }
    Play.autoGameN(st, cs);
    firstDiffAt.push(fd);
  }
  const tot = same + diff;
  return { flip: tot ? 100 * diff / tot : null, decs: tot, tiePct: tot ? 100 * ties / tot : null,
    flipU: uniqTot ? 100 * uniqDiff / uniqTot : null, uniqN: uniqTot, uniqShare: tot ? 100 * uniqTot / tot : null,
    firstAt: firstDiffAt.filter(function (x) { return x != null; }),
    noDiff: firstDiffAt.filter(function (x) { return x === null; }).length };
}
const kindsOf = (pr) => { const acts = pr.acts || 0; const JI = WIN.EpirusRules.SK.JI;
  return Object.keys(pr.keys || {}).filter(k => k !== JI && acts && (pr.keys[k] / acts) >= 0.005).length; };
/* 剂量扫描：`SIGS=0.005,0.02,0.06,0.18` 之类（缺省仍是训练用的两档）。
 *   动因：既然 2.0 一步变异≈重采样，那**能不能把步子缩到与 v7 同一行为翻转水平**就是最直接的处方 ⇒
 *   扫出一条"flip(σ) 曲线"，读它到达 v7 在同 σ 档水平所需的 σ 是几。 */
const ZEROS = ARG.zeros === '1';
/* 处方候选（比"改架构"便宜一格）：**只把随机起点的幅度调大**。
 *   `makePolicy(scale)` 本来就吃这个参数 ⇒ 冷启动臂把 0.25 改成 1/2/4 是一行的事，不动架构、不动容器。
 *   要验的是一件事：**随机人口的"聚合行为方差"（temp 0.15 下）会不会随幅度长出来**，
 *   以及长出来的同时**个体内的宽度**（种数）会不会像 `KEYBIAS` 那样塌掉。 */
const SCALE = Number(ARG.scale || 0.25);
const SIGS = ZEROS ? [] : (ARG.sigs || '0.18,0.06').split(',').map(function (x) { return Number(x); }).filter(function (x) { return x > 0 && isFinite(x); });
const rows = [];
let placeboBad = 0;
const plaVals = [];
for (let i = 0; i < N; i++) {
  /* `ZEROS=1`：**只测"菜单自己"** ⇒ 用全零参数（v7：所有 logit 相等；2.0：只剩 bias 项）。
   *   动因：若 2.0 随机粒的聚合剖面（防御族 73.9%、sd 1.7）就落在"零偏好"那一点上，
   *   那"墙"是**菜单结构**（哪些键此刻合法/买得起）给的，不是权重给的 ⇒ 加大步长/多种子都救不了（P3），
   *   要救得给编码一个"逐键可加偏置"的局部把手（P1）。 */
  const p = ZEROS ? new Float64Array(PC) : Float64Array.from(P.makePolicy(SCALE));
  const prof = fieldProfile(p, 0, 'soft', G, SEED0, 'scripts', 'multi');
  const hp = profileWithHandle(p, Math.min(G, 6));   /* M1b：走自己 chooser 的聚合剖面（KEYBIAS 真的作用在这上面） */
  /* ① placebo：同一份权重当作"子代"再问一遍 ⇒ 贪心档下翻转率必须恰好 0 */
  const pla = sameStateFlip(p, Float64Array.from(p), G);
  if (pla.flip > PLACEBO_MAX) placeboBad++;
  const rec = { i, hKinds: hp.kinds, hDef: hp.def, hAtk: hp.atk, hActs: hp.acts, hWin: hp.win,
    kinds: kindsOf(prof), def: prof.acts ? 100 * (prof.def || 0) / prof.acts : 0,
    acts: prof.acts / G, win: 100 * (prof.wins || 0) / (prof.decisive || G),
    dec: prof.dec, placeboDecs: pla.decs, placeboFlip: pla.flip, tie: pla.tiePct };
  plaVals.push(pla.flip);
  /* 关键对照：**"变异一步"和"另起一枚随机粒"是不是同一件事**。
   *   若 flip@σ ≈ flip(random) ⇒ 这个编码下变异**在行为上等于重采样** ⇒ GA 没有邻域可爬（爬坡失效的直接证据），
   *   而不是"地形没有上坡"。这两件事对训练的意义完全相反，必须分开量。 */
  {
    const rnd = Float64Array.from(P.makePolicy(0.25));
    const fr = sameStateFlip(p, rnd, G);
    rec.flipRand = fr.flip; rec.flipURand = fr.flipU; rec.uniqNrand = fr.uniqN;
  }
  for (const sig of SIGS) {
    const m = Float64Array.from(P.mutatePolicy(p, sig));
    const mp = fieldProfile(m, 0, 'soft', G, SEED0, 'scripts', 'multi');
    const fr = sameStateFlip(p, m, G);
    rec['flip@' + sig] = fr.flip; rec['dec@' + sig] = fr.decs;
    rec['first@' + sig] = fr.firstAt.length ? fr.firstAt.reduce((a, b) => a + b, 0) / fr.firstAt.length : null;
    rec['never@' + sig] = fr.noDiff; rec['tie@' + sig] = fr.tiePct;
    rec['flipU@' + sig] = fr.flipU; rec['uniqN@' + sig] = fr.uniqN;
    rec['flipU@' + sig] = fr.flipU; rec['uniqN@' + sig] = fr.uniqN;
    rec['kinds@' + sig] = kindsOf(mp); rec['def@' + sig] = mp.acts ? 100 * (mp.def || 0) / mp.acts : 0;
    rec['win@' + sig] = 100 * (mp.wins || 0) / (mp.decisive || G);
    rec['acts@' + sig] = (mp.acts || 0) / G;
    let s0 = 0, sd = 0; for (let k = 0; k < p.length; k++) { s0 += p[k] * p[k]; sd += (m[k] - p[k]) * (m[k] - p[k]); }
    rec['rel@' + sig] = 100 * Math.sqrt(sd) / (Math.sqrt(s0) || 1);
  }
  rows.push(rec);
}
const plaMean = plaVals.length ? plaVals.reduce((a, b) => a + b, 0) / plaVals.length : null;
const sd = (k) => { const v = rows.map(r => r[k]).filter(x => x != null && isFinite(x)); if (v.length < 3) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1)); };
const mean = (k) => { const v = rows.map(r => r[k]).filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const f2 = (x) => (x == null ? '  —  ' : (Math.round(x * 100) / 100).toFixed(2).padStart(6));
const L = [];
L.push('# 起点幅度 scale=' + SCALE + '（出厂冷启动用 0.25） ‖ 抽样温度 samp=' + SAMP + ' ‖ 把手 K=' + KEYBIAS);
L.push('# 路径 = gen' + GEN + ' ‖ paramCount=' + PC + ' ‖ N=' + N + ' 粒随机起点（makePolicy(0.25)，与冷启动臂同一个生成器）‖ G=' + G + ' 局/表 · seed0=' + SEED0);
if (KEYBIAS > 0) L.push('# ⚑ KEYBIAS=' + KEYBIAS + '：仪器侧原型——argmax 前给每个技能键加一枚随机偏置（= v7 那种逐键把手），不改架构');
L.push('# 尺 = scratch/coldstart-why-1104.mjs（M1 出生点 + M2 一步变异走多远）；两批必须分进程跑');
if (ZEROS) L.push('# ⚑ ZEROS=1：这批**只测全零参数 = 菜单自己给的聚合剖面**（没有权重偏好），M2 整段跳过；' +
  'N 只是重复样本数（同一份零向量），所以别读它的粒间 sd。');
if (placeboBad) L.push('⛔ **接线可疑**：' + placeboBad + '/' + N + ' 粒在同权重重复跑里翻转 >' + PLACEBO_MAX + '% ⇒ seed/装载对不上，本批**全部作废**（不印均值）');
L.push('');
/* ★ 这台尺真正要看的一格：**种群在"聚合行为"上有没有方差**。
 *   选择只能选它看得见的差异 ⇒ 若随机粒在聚合上全是一个样（防御族% 的粒间 sd ≈ 0），
 *   那冷启动失败的原因就是**没有可选**，跟代数、跟地形有没有上坡都无关。
 *   ⚠ 噪声地板必须一起印：夺1 用 G 局量，纯抽样 sd ≈ √(p(1−p)/G) ⇒ 实测 sd 小于它就说明"真方差≈0"。 */
L.push('M1 出生点（随机粒直接量，没训练）：种数 ' + f2(mean('kinds')) + '（粒间 sd ' + f2(sd('kinds')) + '）' +
  ' ‖ 防御族% ' + f2(mean('def')) + '（粒间 sd ' + f2(sd('def')) + '）' +
  ' ‖ 出手每局 ' + f2(mean('acts')) + '（sd ' + f2(sd('acts')) + '）' +
  ' ‖ 脚本桌夺1% ' + f2(mean('win')) + '（sd ' + f2(sd('win')) +
  ' ‖ 纯抽样 sd ≈ ' + f2(100 * Math.sqrt(Math.max(0.01, ((mean('win') || 0) / 100) * (1 - ((mean('win') || 0) / 100)) / G))) + '）' +
  '（' + N + ' 粒 × ' + G + ' 局）');
L.push('M1b 同一批粒走**本尺自己的贪心 chooser**（`KEYBIAS` 只接在这里，M1 那列吃不到它）：' +
  '种数 ' + f2(mean('hKinds')) + '（sd ' + f2(sd('hKinds')) + '） ‖ 防御族% ' + f2(mean('hDef')) + '（sd ' + f2(sd('hDef')) + '）' +
  ' ‖ 进攻族% ' + f2(mean('hAtk')) + '（sd ' + f2(sd('hAtk')) + '） ‖ 出手/局 ' + f2(mean('hActs')) + ' ‖ 夺1% ' + f2(mean('hWin')) + '（sd ' + f2(sd('hWin')) + '）');
/* ★ 光有方差还不够：**GA 要的是"行为差异 ↔ 成绩差异"真的相关**。
 *   若 scale 抬上去之后防御族在动而夺1 完全不动（ρ≈0），那选择依旧只能挑噪声 ⇒ 处方作废。
 *   ⚠ 6 局/粒的胜率本身带 ~15pt 抽样噪声 ⇒ 这里只看 ρ 的**方向与量级**，不拿它当显著性检验。 */
function pear(a, b) {
  const v = []; for (let i = 0; i < rows.length; i++) if (isFinite(a[i]) && isFinite(b[i])) v.push([a[i], b[i]]);
  if (v.length < 4) return null;
  const mx = v.reduce((x, y) => x + y[0], 0) / v.length, my = v.reduce((x, y) => x + y[1], 0) / v.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of v) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null;
}
L.push('耦合（没有它，方差再大也选不动）：ρ(防御族, 夺1) = ' + f2(pear(rows.map(function (r) { return r.hDef; }), rows.map(function (r) { return r.hWin; }))) +
  ' ‖ ρ(种数, 夺1) = ' + f2(pear(rows.map(function (r) { return r.hKinds; }), rows.map(function (r) { return r.hWin; }))) +
  ' ‖ 聚合防御族跨度 = ' + f2(Math.max.apply(null, rows.map(function (r) { return r.hDef; }))) + ' − ' +
  f2(Math.min.apply(null, rows.map(function (r) { return r.hDef; }))) + 'pt');
L.push('M2 一步变异（**同一状态**上问父/子，贪心 argmax ‖ placebo 自证：同权重翻转率均值 ' + f2(mean('placeboFlip')) +
  ' %，必须恰好 0 ‖ placebo 对比决策数 ' + Math.round((mean('placeboDecs') || 0)) +
  ' ‖ argmax 并列率（父代自身）' + f2(mean('tie')) + '%）');
for (const sig of SIGS) {
  L.push('   σ=' + sig + ' ⇒ argmax 翻转率 ' + f2(mean('flip@' + sig)) + '% ‖ 参量相对步长 ' + f2(mean('rel@' + sig)) +
    ' ‖ **只在有唯一最高分的决策上** ' + f2(mean('flipU@' + sig)) + '%（该档平均 ' + Math.round(mean('uniqN@' + sig) || 0) + ' 个/粒）' +
    ' ‖ 首次分歧平均在第 ' + f2(mean('first@' + sig)) + ' 手 ‖ 全程不分歧的局 ' + f2(mean('never@' + sig)) + '/' + G +
    ' ‖ 种数 → ' + f2(mean('kinds@' + sig)) + ' ‖ 防御族 → ' + f2(mean('def@' + sig)) + '%' +
    ' ‖ **夺1 → ' + f2(mean('win@' + sig)) + '%（粒间 sd ' + f2(sd('win@' + sig)) + '）** ‖ 出手/局 → ' + f2(mean('acts@' + sig)));
}
L.push('   对照 flip(random 另一粒) = ' + f2(mean('flipRand')) + '%（唯一分档 ' + f2(mean('flipURand')) + '%）  ⇒ 与 flip@σ 比：越接近就越像"变异=重采样"');
L.push('');
L.push('逐粒（前 ' + Math.min(6, N) + '）：i 种数 防御% 出手 夺1 ' + SIGS.map(function (x) { return 'flip@' + x; }).join(' '));
for (const r of rows.slice(0, 6)) L.push('  ' + String(r.i).padStart(2) + f2(r.kinds) + f2(r.def) + f2(r.acts) + f2(r.win) +
  SIGS.map(function (x) { return f2(r['flip@' + x]); }).join(''));
L.push('');
L.push('⚑ 读法：① 翻转率高 ⇒ 一步变异就把策略打散 ⇒ GA 的"邻域"在行为上不连续（爬坡失效的微观形式）；' +
  '② 出生点防御% 高 + 夺1 低 ⇒ 冷启动不是"没搜到"，而是**随机粒一开始就在壁盆里**；' +
  '③ `rel@σ` 是参量相对步长，两路径都≈σ·√D/‖p‖ ⇒ 用它核对"我们比的不是步长大小而是步长的行为后果"。');
const out = L.join('\n') + '\n';
console.log(out);
L.push('');
L.push('噪声地板（placebo）逐粒：' + plaVals.map(x => x.toFixed(1)).join(' / ') + ' %（并列最高分处采样所致 ⇒ 读"净翻转"）');
if (!placeboBad) writeFileSync('scratch/coldstart-why-1104-gen' + GEN + '.tsv', out, 'utf8');
else writeFileSync('scratch/coldstart-why-1104-gen' + GEN + '-VOID.tsv', out, 'utf8');
