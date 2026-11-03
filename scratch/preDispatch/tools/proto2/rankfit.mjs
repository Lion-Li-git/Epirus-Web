#!/usr/bin/env node
/* rankfit.mjs — 决策级**监督排序**适应度：稠密货币能不能把 2.0 结构训起来（千问 · 10-29 02:1x · 段 D′）
 *
 * 为什么换这条（不是临时加戏，是 9.3 决策规则里预登记的第三条）：
 *   · 段 C 四波 + 段 E 一波共 **二十臂**把 预算/步长口径/当选面/配对开关/ES‖CEM/热启动 六轴扫完，
 *     全部 |Δ夺1| ≤ 1.16pt（SE≈0.9）⇒ 整局货币在这个精度下**给不出可用梯度**（三万局只有 2~5 次真打过父代）。
 *   · 第四段控制后的读数说**输入里是有信息的**（一层线性头直接吃候选原始特征就能复现 v7 组内 top-1 56.5%）。
 *   ⇒ 那就把货币换成稠密的：**逐候选对齐现役冠军 v7 的组内序**，一次评估不打一局。
 *
 * ⚠ 这条尺**只回答"结构装不装得下现役冠军"**，不回答"比冠军强"——后者仍然只有整局那一档能答。
 *
 * ⚑ 跨臂可比性由构造保证（第四段查因换来的三条，全部落实）：
 *   ① 标签**冻在装档之前**：只调 v7 原版 `P.candidatesFor / P.value`，之后无论装哪档都不重算；
 *   ② 对手表只建一次，且 `buildOpps` 里面的 `Math.random()` 被一条**定标过的 LCG**顶掉（跑两遍指纹必须一样，见自证 T-A）；
 *   ③ 每枚夹具的抽签流由 FNV 混合种子 + mulberry32（**不是**线性 LCG ⇒ 组间不仿射相关）。
 *
 * 用法：node tools/proto2/rankfit.mjs [--arch=S1|S1o] [--groups=1600] [--pops=16] [--iters=120]
 *                                     [--sig=0.3] [--elite=4] [--seed=7] [--l2head=1e-3] [--out=scratch/arms/...]
 * 只读 js/**；产物落 scratch/arms/（不入库、不进冠军槽、不动产品门）。
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, layout } from './arch2.mjs';
import { encode as obs3Encode } from './obs3.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ARCH = arg('arch', 'S1') === 'S1o' ? 'obs3' : 'v7';
/* ===== §E824（10-29 03:1x · #143 换路）：`--fromdump=<jsonl>` ⇒ **夹具与标签都由仪器落盘** =====
 * 为什么不再在本地打 rollout：`playRollout` 家族的续局语义只许有一份（本仓七台下游仪器全部"读 dump、不自采"）。
 * 上游 = `node tools/probe-myopia-regret.mjs --dumpfx=<jsonl> --arm=A0`（每行一个采样决策：整只状态 + top-KEEP 名单 + 逐流赢率）。
 * ⇒ 于是这里的货币从"模仿 v7 的组内序"换成"**rollout 赢率的组内序**"——它才是与强度同向的那一类稠密标签。
 * ⚠ 复现不是"看起来一样"：**逐候选拿 v7 的 `P.value` 复算 `net`（≤1e-9）并拿同一个 obs3 编码器复算 `x3`（≤1e-4）**，
 *   任何一条对不上就硬失败 ⇒ 对不上时我量的是两个世界的标签（"覆盖式接入要自证真被调用"同族）。 */
const FROM = arg('fromdump', '');
const FXARM = arg('fxarm', 'A0');
const FXMAX = Math.max(50, Number(arg('fxmax', 2000)) || 2000);
/* 标签面掉候选的计数器（`collect` 里 ++，出来就判）+ 显式逃生阀 ⇒ 默认响亮拒绝，不静默 */
let LAB_DROP = 0, LABDROPTOT = 0;
const ALLOW_DROP = argv.includes('--allowdroplabels');
const NG = Math.max(200, Number(arg('groups', 1600)) || 1600);
const POP = Math.max(4, Number(arg('pops', 16)) || 16);
const ITER = Math.max(5, Number(arg('iters', 120)) || 120);
const ELITE = Math.max(1, Number(arg('elite', 4)) || 4);
const SIG = Number(arg('sig', 0.3));
const SEED = Number(arg('seed', 7));
const OUT = arg('out', '');
/* ⚑ `--dagger=<2.0 包>`：**走局用那枚粒自己**（标签仍来自 v7），起点也从它出发 ⇒ 这就是 DAgger 那一轮。
 *   判的是第五段留下的那格：模仿到 66.9% 组内 top-1 却不兑现成强度，到底是
 *   ①标签出在冠军的局面上、被评者自己会走到别的局面（分布漂移），还是 ②v7 的强度根本不在组内 argmax 里。
 *   `--playtemp` 只在 dagger 下有意义（那枚粒走局时的采样温度；对局级读数请用 profile2 而不是这里）。 */
const DAGGER = arg('dagger', '');
/* ⚑ `--warm=<2.0 包>`：**只热启动、不走自己的局**（标签仍出在 v7 走出来的局面上）。
 *   这是 H1 那条读数的对照组：H1 同时换了"起点"和"标签分布"两件事 ⇒ 单看它分不清是哪一件买到的强度。
 *   W = warm(同起点 + v7 局面标签)，H = dagger(同起点 + 自己局面标签) ⇒ 两臂只差"标签出在谁的局面上"。 */
const WARM = arg('warm', '');
const PLAYTEMP = Number(arg('playtemp', 0.6)) || 0.6;

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
let v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!v7) { console.error('⛔ v7 参照包读不出'); process.exit(2); }
v7 = Float64Array.from(v7);
/* ⚑ 目标分布的**锐度旋钮**：v7 分数是几十上百的量纲 ⇒ temp 8 刚好；rollout 赢率组内标准化后是 1 个标准差的量纲 ⇒ temp 1。
 *   这条不是"调参让它好看"：H（目标自熵）与 ln n（平坦地板）**都跟着 TT 一起重算**，
 *   所以"这条货币值多少信息"永远是相对自己地板来判的（记进 meta 的 tgtTemp 列）。 */
const TT = Number(arg('tgttemp', FROM ? 1 : 8)) || (FROM ? 1 : 8);
if (FROM && DAGGER) { console.error('⛔ `--fromdump` 与 `--dagger` 互斥（前者的局面由仪器走完，后者要本地走局）'); process.exit(2); }
/* 上游那枚参照包的短指纹（与 `probe-myopia-regret.mjs` 里同一算法逐字一致 ⇒ 换包会当场抓住） */
function pfpOf(a) {
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) { const v = Math.round(a[i] * 1e6); h = (h ^ (v & 255)) >>> 0; h = Math.imul(h, 16777619) >>> 0; h = (h ^ ((v >> 8) & 255)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  return (h >>> 0).toString(16) + '/' + a.length;
}

/* ===== 定标随机源 ===== */
function mulberry(seedVal) {
  let a = seedVal >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/* ② `buildOpps` 自带 Math.random ⇒ 临时顶成定标流，出来就还原。**自证**：同 seed 跑两遍对手表指纹必须一致 */
function buildPoolSeeded(seedVal) {
  const real = Math.random;
  try { const rr = mulberry(seedVal); Math.random = rr; return T.buildOpps(v7, 0.05); }
  finally { Math.random = real; }
}
function poolFingerprint(POOL) {
  let h = 2166136261;
  for (const o of POOL) { const s = (o.name || o.key || '') + ':' + Array.from(o.params || []).slice(0, 6).map((x) => x.toFixed(3)).join(','); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } }
  return (h >>> 0).toString(16);
}

const POOL = buildPoolSeeded(fnv('pool' + SEED));
const fpPool = poolFingerprint(POOL);

/* ===== ① 抓决策点 + 冻结标签 =====
 *   缺省：轨迹由 **v7 自己**走 ⇒ 标签出在"冠军会去到的局面"上。
 *   `--dagger=<2.0 包>`：轨迹改由**那枚粒自己**走，标签仍是 v7 的逐候选分 ⇒ 判"分布漂移 vs v7 强度不住在组内 argmax"。
 *   ⚠ 开了 dagger 就**没有**"两档同场"（每档照自己的粒走局）⇒ 跨档只各自对 v7 读数，不许互比绝对值。 */
const gstream = mulberry(fnv('game' + SEED));
function collect(learnerArr) {
  LAB_DROP = 0;
  const fixtures = [];
  const lsel = learnerArr ? T.policyChooserN(learnerArr, PLAYTEMP) : null;
  function walk(sb, n) {
    const choosers = [];
    for (let p = 0; p < n; p++) choosers.push(T.policyChooserN(v7));
    const probe = (st, p, legal) => {
      if (fixtures.length < NG && legal && legal.length >= 2 && (p % n) === 0) {
        const cl = S.cloneState(st);
        cl.rng = { next: mulberry(fnv('fx' + fixtures.length + 'g' + sb + 'p' + p + (lsel ? 'd' : ''))) };
        const cands = P.candidatesFor(cl, p, T.econBase(cl, p, legal), { lockTarget: false });
        /* ⚑ 口径缺口（10-29 02:1x 记下，**没修**）：比赛那条路用的是
         *   `candidatesFor(state, pid, base, { lockTarget: lastCancelOther(state, pid) })`（`js/train/evo.js:953`）
         *   ⇒ 上回合与本席"相抵"的对手会被**踢出目标池**。我这里固定 `lockTarget:false` ⇒ 标签面比比赛面**宽**。
         *   影响面：只在该席存在相抵对手时少一枚目标候选 ⇒ 组内 top-1/CE 会略微高估"像 v7"，
         *   但**强度读数是 profile2 走比赛那条路量的**，所以第五/六段的对局级判语不受这条影响。
         *   要修就把 `lastCancelOther` 导出或从 chooser 回调里直接捕获 (state,pid,cands)（后者更准，代价是包一层钩子）。 */
        if (cands && cands.length >= 3) {
          const raw = [], keep = [];
          for (let i = 0; i < cands.length; i++) {
            const cd = cands[i];
            /* ⚑⚑ **形参位置**（10-29 03:2x 由 §E824 的夹具复现门当场抓出）：`P.value(state,pid,key,params,sh,cand)` 的
            *   第 5 形参是**形状对象**（`policy.js:485` 里读 `sh.featS/featN/featA`），**不是 bead**。
            *   我原来写的是 `cd.bead || null` ⇒ 两枚蓄能候选（`charge/elec`、`charge/boom`）拿到 `sh='elec'/'boom'`
            *   → 三个宽度全 `undefined` → 循环一次不跑 → **NaN** → 被下面那句 `Number.isFinite` **静默丢掉**。
            *   后果：今夜所有"模仿 v7"的组内标签**从来没有蓄能这一手**（分母少 2 枚、CE 地板与 top-1 都跟着变），
            *   而对局里蓄能照常在候选表上 ⇒ 训练面与比赛面差着一整个技能。
            *   正确形状照 `probe-myopia-regret.mjs:354`：第 5 形参传 `null`（用默认 v7 形状），bead 走第 6 形参的 `cand`。 */
            const val = P.value(cl, p, cd.key, v7, null, cd);
            if (Number.isFinite(val)) { raw.push(val); keep.push(i); } else LAB_DROP++;
          }
          if (keep.length >= 3) {
            const mu = raw.reduce((a, b) => a + b, 0) / raw.length;
            let rp = 0; for (let i = 1; i < raw.length; i++) if (raw[i] > raw[rp]) rp = i;
            /* ⚑ **逐组打乱候选顺序**（用该组自己的独立流）。下标空间要说清楚：
            *   `keep[t]` = 第 t 枚**留下候选**在原候选表里的下标；`raw[t]`/`rp` 都在"留下候选表"这个空间里；
            *   `ord` 是 [0..K−1] 的一个置换 ⇒ 新表第 k 位 = cands[keep[ord[k]]]，标签 = raw[ord[k]]，
            *   新的当选位置 = ord 里值为 rp 的那个 k。**不要**把原下标和留下下标混进同一次运算（上一版就在这里错）。
            *   打乱的理由：引擎候选表本身有次序含义（实测"v7 当选落在位置 0"≈50%），不打乱 ⇒ 稠密货币会奖励"背枚举顺序"；
            *   顺带一层用处：这条货币只在结构对候选顺序无关时干净 ⇒ 顺序不变性另立一条腿 T-F 当场量。 */
            const K = keep.length;
            const ord = Array.from({ length: K }, (_, t) => t);
            for (let i = K - 1; i > 0; i--) { const j = Math.floor(cl.rng.next() * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
            fixtures.push({ state: cl, pid: p,
              cands: ord.map((t) => cands[keep[t]]),
              ref: ord.map((t) => raw[t]),
              tgt: ord.map((t) => raw[t] - mu), mu,
              refPick: ord.indexOf(rp) });
          }
        }
      }
      return lsel ? lsel(st, p, legal) : POOL[(p + 1) % POOL.length].sel(st, p, legal);
    };
    const cs = choosers.slice(); cs[0] = probe;
    T.oneGameN(cs, sb, n, { regen: 0, mode: 'multi' });
  }
  let gg = 0;
  while (fixtures.length < NG && gg < 4000) { walk(70000 + gg * 17, gg % 2 ? 5 : 3); gg++; }
  if (fixtures.length < 200) throw new Error('只抓到 ' + fixtures.length + ' 组 ⇒ 分母不足');
  /* ⚑ **两面同形闸**（§E824 那条蓄能形参错位欠下的）：标签面每掉一枚候选，比赛面却照旧带着它 ⇒ 训练面少一整族动作，
   *   而**任何一条既有读数都不会红**。所以这里不许静默：掉过就必须显式认。 */
  if (LAB_DROP > 0 && !ALLOW_DROP) {
    console.error('⛔ 标签面与比赛面**不同形**：本遍有 ' + LAB_DROP + ' 枚候选因分数不有限被静默丢掉（§E824 那条病的形状）。'
      + '先查是不是又踩了形参/口径，确认无害才加 `--allowdroplabels=1`。');
    process.exit(10);
  }
  LABDROPTOT = LAB_DROP;
  return fixtures;
}
/* ===== §E824：从仪器落的夹具重建（**这一步必须在装档之前**，用的全是 v7 原版算子）===== */
function collectFromDump() {
  const raw = readFileSync(FROM, 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s));
  const rows = raw.filter((r) => r.arm === FXARM).slice(0, FXMAX);
  const FXMIN = Math.max(20, Number(arg('fxmin', 120)) || 120);
  if (rows.length < FXMIN) { console.error('⛔ `--fromdump` 里 arm=' + FXARM + ' 只有 ' + rows.length + ' 个决策（文件共 ' + raw.length + ' 行）< 地板 ' + FXMIN + ' ⇒ 分母不足，判"读不出"不判"无响应"'); process.exit(2); }
  const pfp = rows[0].pfp;
  if (pfp !== pfpOf(v7)) { console.error('⛔ 参照包换了：dump 落盘时是 ' + pfp + ' ‖ 本地 `js/bundled-champion-3p.js` 是 ' + pfpOf(v7) + ' ⇒ `net` 复算与标签都不可比'); process.exit(2); }
  if (rows.some((r) => r.pfp !== pfp)) { console.error('⛔ 同一份 dump 里混了不止一枚参照包 ⇒ 标签不可配对'); process.exit(2); }
  const fresh = rows.every((r) => r.freshrng === 'ON');
  if (!fresh) console.log('  ⚠ 这批标签是在 **freshrng=off**（rollout 会从母局那条流抽数）下落的 ⇒ 与在册 ON 那批不可并排引');
  const out = [];
  let netMax = 0, x3Max = 0, bad = null, nCand = 0;
  for (const r of rows) {
    const st = r.st;
    st.rng = { next: mulberry(fnv('fxr' + r.pk + '|' + r.arm)) };   /* 母局那条流在序列化时是闭包 ⇒ JSON 里掉了，这里挂一条**定标**的 */
    const legal = Play.legalActions(st, r.pid);
    const cands = P.candidatesFor(st, r.pid, T.econBase(st, r.pid, legal), { lockTarget: false });
    const scored = cands.map((c) => ({ c, v: P.value(st, r.pid, c.key, v7, null, c) })).filter((x) => Number.isFinite(x.v));   /* 第 5 形参 = 形状，传 null ⇒ 与上游 `probe-myopia-regret:354` 逐字同口径 */
    scored.sort((a, b) => b.v - a.v);
    const take = scored.slice(0, Math.min(r.keep, scored.length));
    if (take.length !== r.pool.length) { bad = bad || (r.pk + '：名单长度 ' + take.length + ' ≠ dump ' + r.pool.length); continue; }
    let stop = false;
    for (let i = 0; i < take.length; i++) {
      const d = take[i], s = r.pool[i];
      if (d.c.key !== s.key || (d.c.target == null ? null : d.c.target) !== s.target
        || (d.c.target2 == null ? null : d.c.target2) !== s.target2
        || (d.c.bead || null) !== (s.bead || null)) { bad = bad || (r.pk + '#' + i + '：身份对不上（复算 ' + d.c.key + '/' + d.c.bead + ' ‖ dump ' + s.key + '/' + s.bead + '）'); stop = true; break; }
      const dn = Math.abs(d.v - s.net);
      if (!(dn <= 1e-9)) { bad = bad || (r.pk + '#' + i + '：`net` 复算不上（差 ' + dn.toExponential(2) + '）⇒ 状态没原地复现'); stop = true; break; }
      const xo = obs3Encode(W, st, r.pid, d.c);
      let dm = 0; for (let k = 0; k < xo.length; k++) { const e = Math.abs(xo[k] - s.x3[k]); if (e > dm) dm = e; }
      if (!(dm <= 1.01e-4)) { bad = bad || (r.pk + '#' + i + '：obs3 `x` 复算不上（最大 ' + dm.toExponential(2) + '）⇒ 特征面漂移，不是同一批夹具'); stop = true; break; }
      if (dn > netMax) netMax = dn; if (dm > x3Max) x3Max = dm;
    }
    if (stop) continue;
    /* 标签 = **组内标准化**的 rollout 赢率（与强度同向；量纲与 v7 分数不同 ⇒ 用 z 而不是原值，见 TT 那段） */
    const win = take.map((x, i) => r.pool[i].win), hp = take.map((x, i) => r.pool[i].hpTop);
    let rp = 0; for (let i = 1; i < win.length; i++) if (win[i] > win[rp] || (win[i] === win[rp] && hp[i] > hp[rp])) rp = i;
    const mu = win.reduce((a, b) => a + b, 0) / win.length;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mu) * (b - mu), 0) / win.length);
    const ctr = win.map((x) => x - mu);
    const tgt = sd > 1e-12 ? ctr.map((x) => x / sd) : ctr.map(() => 0);
    /* 逐组打乱候选顺序（该组自己的独立流）——上游的名单是**按 v7 的分**排好序的，不打乱 ⇒ 稠密货币会奖励"背 v7 的枚举顺序" */
    const K = take.length, ord = Array.from({ length: K }, (_, t) => t);
    for (let i = K - 1; i > 0; i--) { const j = Math.floor(st.rng.next() * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
    out.push({ state: st, pid: r.pid, pk: r.pk, env: r.env, round: r.round,
      cands: ord.map((t) => take[t].c),
      ref: ord.map((t) => win[t]),            /* 原始赢率 ⇒ regret 报"赢率单位"（不是 v7 单位）*/
      tgt: ord.map((t) => tgt[t]), winS: ord.map((t) => r.pool[t].winS), mu,
      refPick: ord.indexOf(rp), pre0: rp === 0 ? 1 : 0 });
    nCand += K;
  }
  if (bad) { console.error('⛔ 夹具复现失败（第一处）：' + bad + ' ⇒ 整批作废，不要用这批标签出数'); process.exit(9); }
  /* 这条货币**有没有牙**：组内赢率全等的组根本没有序可言（分母，不是缺陷）；分半一致率 = 标签自己把"哪手更好"定死了多少 */
  let flat = 0, hsOk = 0, hsN = 0, pre0 = 0;
  for (const f of out) {
    if (f.tgt.every((x) => x === 0)) flat++;
    if (f.pre0) pre0++;
    const half = f.winS[0].length >> 1;
    if (half >= 1 && f.winS.length > 1) {
      const pick = (arr, off, len) => { let b = 0; for (let i = 1; i < arr.length; i++) { const s1 = arr[i].slice(off, off + len).reduce((a, x) => a + x, 0), s0 = arr[b].slice(off, off + len).reduce((a, x) => a + x, 0); if (s1 > s0) b = i; } return b; };
      hsN++; if (pick(f.winS, 0, half) === pick(f.winS, half, half)) hsOk++;
    }
  }
  FXREP = { groups: out.length, candAvg: nCand / Math.max(1, out.length), flatRate: flat / Math.max(1, out.length), hsAgree: hsN ? hsOk / hsN : NaN, hsN, pre0rate: pre0 / Math.max(1, out.length), netMax, x3Max, pfp, freshrng: fresh ? 'ON' : 'off', arm: FXARM, cfg: rows[0].cfg, keep: rows[0].keep, rep: rows[0].rep, src: FROM };
  return out;
}
let FXREP = null;
function labelFp(list) {
  let h = 2166136261;
  for (const fx of list) { const s = fx.cands.map((c) => c.key + '/' + (c.bead || '-')).join(',') + '|' + fx.refPick + '|' + fx.tgt.map((x) => x.toFixed(4)).join(','); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } }
  return (h >>> 0).toString(16);
}
let fixtures = FROM ? collectFromDump() : (DAGGER ? [] : collect(null));
let fpLabels = (DAGGER && !FROM) ? '(dagger：每档各走各的局)' : labelFp(fixtures);

/* 训练半批 / 留出半批（按**组号**奇偶分，不是按池顺序 ⇒ 两半的桌形分布同构）*/
const train = [], hold = [];
function splitInto(list) { train.length = 0; hold.length = 0; list.forEach((fx, i) => (i % 2 === 0 ? train : hold).push(fx)); }
if (!DAGGER) splitInto(fixtures);

/* ===== 装档（这时才允许覆盖 P.*）===== */
const A = installArch2(W, { mutMode: 'seg', input: ARCH === 'obs3' ? 'obs3' : undefined });
const L = layout({ input: ARCH === 'obs3' ? 'obs3' : 'v7', skills: W.EpirusRules.skills.length });
let ps = fnv('init' + SEED); const istring = mulberry(ps);
A.rngRef.r = istring;
const base = Float64Array.from(P.makePolicy(0.25));
let theta0 = null;                             /* dagger 时改成"从那枚粒继续"，否则随机起点 */
const mutStream = mulberry(fnv('mut' + SEED));
A.rngRef.r = mutStream;                       /* 变异用第三条流，不再碰 init 流 */
let learner = null, learnerBefore = null;
if (DAGGER) {
  const obj = JSON.parse(readFileSync(DAGGER, 'utf8').replace(/^window\.EPIRUS_CHAMPION_3P\s*=\s*/, '').replace(/;\s*$/, ''));
  if (obj.a.length !== L.n) { console.error('⛔ dagger 的粒与当前档不符：' + obj.a.length + ' 条 vs ' + L.n + ' 条（包内 arch=' + obj.arch + ' ‖ 当前=' + L.arch + '）'); process.exit(2); }
  learner = Float64Array.from(obj.a);
  fixtures = collect(learner);
  fpLabels = labelFp(fixtures);
  splitInto(fixtures);
  learnerBefore = scoreSet(learner, hold);
  console.log('# dagger ‖ 走局用的就是这枚粒（' + DAGGER + ' ‖ 标签仍来自 v7）⇒ **没有"两档同场"**，跨档只各自对 v7 读数');
  console.log('  这枚粒在**它自己走出来的局面**上的留出读数：top-1=' + (100 * learnerBefore.top1).toFixed(1) + '%（同分 ' + (100 * learnerBefore.hitVal).toFixed(1) + '% ‖ **集合内 ' + (100 * learnerBefore.hitSet).toFixed(1) + '%**）‖ 配对序=' + (100 * learnerBefore.pair).toFixed(1) + '% ‖ CE=' + learnerBefore.ce.toFixed(4) + ' ‖ regret=' + learnerBefore.regret.toFixed(3) +
    ' ‖ ⚑ 我方最大集合平均大小 ' + learnerBefore.myTie.toFixed(2) + ' ‖ v7 自己的 ' + learnerBefore.refTie.toFixed(2) + '（前者大 ⇒ "序对了但选错枚"，对局里就是随机目标）');
  console.log('  ⚑ 把它和"在 v7 走出来的局面上"的同一读数并排（F1 是 66.9%/83.3%/1.458）⇒ **两个数之差就是分布漂移的价钱**');
  theta0 = Float64Array.from(learner);
}
if (WARM) {
  const obj = JSON.parse(readFileSync(WARM, 'utf8').replace(/^window\.EPIRUS_CHAMPION_3P\s*=\s*/, '').replace(/;\s*$/, ''));
  if (obj.a.length !== L.n) { console.error('⛔ warm 的粒与当前档不符：' + obj.a.length + ' vs ' + L.n); process.exit(2); }
  theta0 = Float64Array.from(obj.a);
  const wb = scoreSet(theta0, hold);
  console.log('# warm ‖ 起点=' + WARM + '（标签仍出在 **v7 走出来的局面**上 ⇒ 这一臂是 H 的对照组：只差"标签出在谁的局面上"）');
  console.log('  起点在 v7 局面留出集上：top-1=' + (100 * wb.top1).toFixed(1) + '% ‖ 配对序=' + (100 * wb.pair).toFixed(1) + '% ‖ CE=' + wb.ce.toFixed(4));
}

/* ===== 打分：组内 regret（**单位跟着货币走**：缺省 = v7 分数，`--fromdump` = 赢率 0~1）‖ 配对序正确率 ‖ top-1 一致 ‖ 交叉熵 =====
 * ⚑⚑ 10-29 02:2x 这里犯过一次**流式归一化**的错：`pr = tgt.map(x => { Zr += e; return e / Zr })`
 *   把"前缀和"当分母 ⇒ pr[0] 恒等于 1、q[0] 恒等于 1 ⇒ CE 那一项对下标 0 永远是 0，
 *   于是优化器真正学到的是"**把靠后的候选压低**"这种纯位置偏置 —— CE 从 1.76 掉到 0.34 全是这个来的。
 *   修法：softmax 两趟（先求总和再归一），并且**加三条校准腿**（见 calib）：
 *     · 完美模仿者（logits = v7 自己的分）CE 必须是全场最低、top-1 必须 100%；
 *     · 恒定输出 CE 必须 = ln(候选数)、top-1 ≈ 位置 0 的占比；
 *     · 纯位置打分（logits = −下标）CE 必须≈恒定输出那条 ⇒ 若它明显更低，说明这条货币能靠位置刷，作废。
 */
function softmax(arr, temp) {
  let mx = -1e9; for (const x of arr) if (x > mx) mx = x;
  let Z = 0; const e = arr.map((x) => { const v = Math.exp((x - mx) / temp); Z += v; return v; });
  return e.map((v) => v / Z);                                /* ⚑ 两趟：分母是**总和**，不是前缀和 */
}
function scoreSet(params, groups, logitsOf) {
  let reg = 0, pairOk = 0, pairTot = 0, hit = 0, hitVal = 0, hitSet = 0, myTieSum = 0, refTieSum = 0, tie = 0, n = 0, ce = 0;
  let skN = 0, skFlat = 0, skRefN = 0, skRefFlat = 0;          /* 第十九段那一列的出厂化：同目标、只差技能的**逐对**分不开率 ‖ 后两个是同一批对上的标签同分率 */
  for (const g of groups) {
    const lg = logitsOf ? logitsOf(g) : P.forwardCands(g.state, g.pid, g.cands, params, { temp: 0.5 }).logits;
    if (!lg || lg.length !== g.cands.length) throw new Error('rankfit：logits 长度 ' + (lg && lg.length) + ' ≠ 候选数 ' + g.cands.length);
    {                                                          /* ⭐ "技能身份分辨力"（**逐对**统计，不是"整桶相等"）
                                                              *   第一版写成"同一目标那一桶里**全部**逐位相等才算一组"⇒ 而 `target=null` 那桶里
                                                              *   本来就装着 `ji` 与三手防御，ji 与它们**该有**差别 ⇒ 那条判据恒假 ⇒ 读出 0% 的**假干净**
                                                              *   （10-29 05:2x 与 `scratch/head-ablation.mjs` 对表时才撞出来）。
                                                              *   现在按对算：同目标(同珠)的候选两两一对，分数逐位相等 ⇒ 那一对分不开。 */
      const byT = {};
      for (let i = 0; i < lg.length; i++) {
        const c = g.cands[i], k = (c.target == null ? '-' : c.target) + '|' + (c.bead || '-');
        (byT[k] || (byT[k] = [])).push({ i, key: c.key + '|' + (c.bead || '-') });
      }
      for (const v of Object.values(byT)) {
        if (v.length < 2 || new Set(v.map((x) => x.key)).size < 2) continue;
        for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) {
          skN++;
          if (Math.abs(lg[v[a].i] - lg[v[b].i]) < 1e-12) skFlat++;
          skRefN++;
          if (Math.abs(g.tgt[v[a].i] - g.tgt[v[b].i]) < 1e-12) skRefFlat++;
        }
      }
    }
    let a = 0; for (let i = 1; i < lg.length; i++) if (lg[i] > lg[a]) a = i;
    if (a === g.refPick) hit++;
    /* ⚑ **并列破号**这条必须在 2.0 上单独量：头的 logits 常常几枚完全相等（同技能不同目标），
     *   严格 `>` 取"第一个最大" ⇒ top-1 读数是靠下标蒙的；而对局里 `chooseCandidates` 是在**并列集合内抽样**。
     *   ⇒ 另记两条：hitSet = "v7 的首选落在我方最大集合里"的组占比（=序对了但可能选错枚），
     *     myTie = 我方最大集合的平均大小（越大 ⇒ 头分不开的那些候选在对局里就是随机目标）。 */
    const mxLg = lg[a];
    let tieN = 0, inSet = false;
    for (let i = 0; i < lg.length; i++) if (Math.abs(lg[i] - mxLg) < 1e-9) { tieN++; if (i === g.refPick) inSet = true; }
    if (inSet) hitSet++;
    myTieSum += tieN;
    let tieR = 0; for (let i = 0; i < g.tgt.length; i++) if (Math.abs(g.tgt[i] - g.tgt[g.refPick]) < 1e-9) tieR++;
    refTieSum += tieR;
    /* ⚑ **并列**是这里的常态不是边角：v7 常给好几枚候选一模一样的分（实测 -392.433 重复出现）。
     *   top-1 严格按位置破号 ⇒ "喂它自己目标"的腿也只有 84.7%，那 15% 全是并列，不是接错线。
     *   ⇒ 另记一条 hitVal（选中的那枚与 v7 首选**同分**就算对），校准腿判它，报数时两条都摆出来。 */
    if (Math.abs(g.tgt[a] - g.tgt[g.refPick]) < 1e-9) hitVal++;
    let nTop = 0; for (let i = 0; i < g.tgt.length; i++) if (Math.abs(g.tgt[i] - g.tgt[g.refPick]) < 1e-9) nTop++;
    if (nTop > 1) tie++;
    reg += g.ref[g.refPick] - g.ref[a];
    const pr = softmax(g.tgt, TT);
    /* ⚑ 货币判的是**序**，不是胆量：把模型 logits 做矩对齐（减均值除标准差，再乘回目标的标准差），
     *    这样"排序完全对但尺度任意"的粒能拿到理论下界 CE = H(目标分布)。
     *    上一版没做这一步，"完美模仿者"（直接用 v7 的分数当 logits）反而比恒定输出差（5.08 vs 3.13）——
     *    因为它拿 temp 0.5 去拟合一个 temp 8 的软分布，KL 项爆炸。那是**我这条腿的期望写错了**，不是接线错。 */
    const lga = Array.from(lg);
    const mm = lga.reduce((a, x) => a + x, 0) / lga.length;
    const sd = Math.sqrt(lga.reduce((a, x) => a + (x - mm) * (x - mm), 0) / lga.length) || 1e-9;
    const tm = g.tgt.reduce((a, x) => a + x, 0) / g.tgt.length;   /* ⚑ tgt 已经减过组均值 ⇒ 它自己的均值≈0，**不能**再拿 g.mu 去算标准差（上一版这么写把 tSd 抬成 sqrt(sd²+mu²)，把"喂目标"那条腿拉尖了 ⇒ CE 2.80 ≠ 自熵 1.01） */
    const tSd = Math.sqrt(g.tgt.reduce((a, x) => a + (x - tm) * (x - tm), 0) / g.tgt.length) || 1;
    const z = lga.map((x) => tm + ((x - mm) / sd) * tSd);
    const qq = softmax(z, TT);
    let ceSum = 0;                                            /* ⚑ 每组必须清零（上一版把它提到了组外 ⇒ CE 随组数线性涨，整条读数作废） */
    for (let i = 0; i < pr.length; i++) if (pr[i] > 1e-12) ceSum += -pr[i] * Math.log(Math.max(1e-12, qq[i]));
    ce += ceSum;                                              /* 每组报**整组 nats**，与候选数无关（ln 候选数 是平坦下界） */
    for (let i = 0; i < lg.length; i++) for (let j = i + 1; j < lg.length; j++) {
      const dm = lg[i] - lg[j], dr = g.tgt[i] - g.tgt[j];
      if (Math.abs(dm) < 1e-12 || Math.abs(dr) < 1e-12) continue;
      pairTot++; if ((dm > 0) === (dr > 0)) pairOk++;
    }
    n++;
  }
  return { regret: reg / Math.max(1, n), pair: pairOk / Math.max(1, pairTot), top1: hit / Math.max(1, n), hitVal: hitVal / Math.max(1, n), hitSet: hitSet / Math.max(1, n), myTie: myTieSum / Math.max(1, n), refTie: refTieSum / Math.max(1, n), tie: tie / Math.max(1, n), ce: ce / Math.max(1, n), skillFlat: skFlat / Math.max(1, skN), skillPairs: skN, skillPairsLabelFlat: skRefFlat / Math.max(1, skRefN), n };
}

/* ===== 自证三条（跑前定死，坏了就停，不带病出数）===== */
const s1 = scoreSet(base, train), s2 = scoreSet(base, train);
if (JSON.stringify(s1) !== JSON.stringify(s2)) { console.error('⛔ T-A 确定性坏：同一粒参数两次评出 ' + s1.regret + ' vs ' + s2.regret); process.exit(6); }
const pool2 = buildPoolSeeded(fnv('pool' + SEED));
if (poolFingerprint(pool2) !== fpPool) { console.error('⛔ T-B 对手表没定住（' + fpPool + ' vs ' + poolFingerprint(pool2) + '）⇒ 跨臂不可比'); process.exit(6); }
{
  const jit = Float64Array.from(base);
  for (let i = 0; i < jit.length; i++) jit[i] += (mutStream() - 0.5) * SIG;
  const sj = scoreSet(jit, train);
  if (Math.abs(sj.ce - s1.ce) < 1e-9) { console.error('⛔ T-C 接线坏：参数动了而货币不动 ⇒ 这粒参数根本没被前向吃到'); process.exit(7); }
}

console.log('# rankfit ‖ arch=' + (ARCH === 'obs3' ? 'S1o(obs3)' : 'S1(v7)') + ' ‖ paramCount=' + P.paramCount() + ' ‖ 组 ' + fixtures.length + '（训练 ' + train.length + ' ‖ 留出 ' + hold.length + '）‖ 货币=' + (FROM ? ('组内 rollout 赢率的标准分 ‖ 源=' + FROM + ' ‖ arm=' + FXARM) : '组内 v7 分数的标准分') + ' ‖ 标签面被丢掉的动作候选 ' + LABDROPTOT + ' 枚' + (ALLOW_DROP ? '（⚠ `--allowdroplabels` 开着 ⇒ 这条闸被人为放行）' : ''));
if (FXREP) console.log('  §E824 夹具复现自证 ‖ 参照包指纹 ' + FXREP.pfp + ' ‖ freshrng=' + FXREP.freshrng + ' ‖ cfg=' + FXREP.cfg + ' keep=' + FXREP.keep + ' rep=' + FXREP.rep +
  ' ‖ net 最大差 ' + FXREP.netMax.toExponential(2) + ' ‖ x3 最大差 ' + FXREP.x3Max.toExponential(2) +
  '\n  ⇒ 这批标签**有没有牙**：组内赢率零方差占比 ' + (100 * FXREP.flatRate).toFixed(1) + '% ‖ 分半一致率 ' + (100 * FXREP.hsAgree).toFixed(1) + '%（' + FXREP.hsN + ' 组，每半 ' + (FXREP.rep / 2) + ' 条流）');
/* ===== 校准腿（三条，跑前定死该落在哪）=====
 *   完美模仿者 = 直接把 v7 自己的分组内中心化分数当 logits ⇒ CE 必须最低、top-1 必须 100%；
 *   恒定输出   ⇒ top-1 应等于"v7 当选落在位置 0 的比例"（这就是那条**假高分**的来源，必须显式摆在桌上）；
 *   纯位置打分 ⇒ CE 必须不优于恒定输出，否则这条货币能靠下标刷 ⇒ 整把尺作废。 */
const calPerfect = scoreSet(base, train, (g) => g.tgt);
const calFlat = scoreSet(base, train, (g) => g.tgt.map(() => 0));
const calPos = scoreSet(base, train, (g) => g.tgt.map((x, i) => -i));
const pos0rate = fixtures.filter((f) => f.refPick === 0).length / fixtures.length;
/* 两条解析地板：**喂给它自己的目标** ⇒ CE 必须正好等于目标分布自身的熵；**恒定输出** ⇒ CE 必须正好等于平均 ln(候选数)
 *   这两条都是"尺自己该落在哪"的对照，任何一条不中就是 CE 那条算式错，而不是被评的粒差。 */
const Htgt = train.reduce((a, g) => { const pr = softmax(g.tgt, TT); return a - pr.reduce((s, q) => s + (q > 1e-12 ? q * Math.log(q) : 0), 0); }, 0) / train.length;
const lnN = train.reduce((a, g) => a + Math.log(g.cands.length), 0) / train.length;
console.log('  校准：目标自熵 H=' + Htgt.toFixed(4) + ' ‖ 喂目标的 CE=' + calPerfect.ce.toFixed(4) + '（top-1=' + (100 * calPerfect.top1).toFixed(1) + '% ‖ 同分口径 hitVal=' + (100 * calPerfect.hitVal).toFixed(1) + '%）‖ 平坦下界 ln n=' + lnN.toFixed(4) + ' ‖ 恒定输出 CE=' + calFlat.ce.toFixed(4) + '（top-1=' + (100 * calFlat.top1).toFixed(1) + '%）‖ 纯位置 CE=' + calPos.ce.toFixed(4));
console.log('  （v7 当选落在位置 0 的比例 = ' + (100 * pos0rate).toFixed(1) + '% ‖ **并列组占比 = ' + (100 * calFlat.tie).toFixed(1) + '%** ⇒ top-1 一律对着 hitVal 看）');
if (calPerfect.hitVal < 0.995) { console.error('⛔ T-D 校准坏：喂 v7 自己的分数却连"同分口径"都不满（hitVal=' + calPerfect.hitVal.toFixed(3) + '）⇒ 打分/比较接错线'); process.exit(8); }
if (Math.abs(calPerfect.ce - Htgt) > 0.05) { console.error('⛔ T-D1 校准坏：CE=' + calPerfect.ce.toFixed(4) + ' ≠ 目标自熵 ' + Htgt.toFixed(4) + ' ⇒ softmax/矩对齐那一段算式错'); process.exit(8); }
if (Math.abs(calFlat.ce - lnN) > 0.05) { console.error('⛔ T-D2 校准坏：恒定输出 CE=' + calFlat.ce.toFixed(4) + ' ≠ ln(候选数) ' + lnN.toFixed(4) + ' ⇒ 归一化仍没接对'); process.exit(8); }
if (calPos.ce < calFlat.ce - 0.02) { console.error('⛔ T-E 这条货币能靠**候选下标**刷（纯位置 CE ' + calPos.ce.toFixed(4) + ' < 恒定 ' + calFlat.ce.toFixed(4) + '）⇒ 监督排序臂作废'); process.exit(8); }
/* T-F①：打乱必须**真的生效** ⇒ "v7 当选落在位置 0"的比例要从 ~50% 掉到 ~1/候选数（覆盖式改动要自证被调用）
 *   `--fromdump` 那批的地板本来不是 v7 而是 rollout 最优，但上游名单仍**按 v7 的分**排序 ⇒ 判据形状一样，阈值放宽到 35%
 *   （实测从 'FXREP.pre0rate' 掉到 pos0rate；打印两个数就是为了让人看见这一档确实掉下来了）。 */
if (pos0rate > (FROM ? 0.35 : 0.2)) { console.error('⛔ T-F1 候选顺序没打乱开（当选落位置 0 占 ' + (100 * pos0rate).toFixed(1) + '% ‖ 打乱前 ' + (100 * (FXREP ? FXREP.pre0rate : NaN)).toFixed(1) + '%）⇒ 上面那条位置地板是假的'); process.exit(8); }
/* T-F②：结构对候选顺序无关是这条货币干净的前提 ⇒ 当场量：同一组换序再评，逐位 logits 必须回到同一枚候选 */
{
  const perm = mulberry(fnv('permcheck' + SEED));
  let maxDiff = 0, checked = 0;
  for (const g of train.slice(0, 60)) {
    const n = g.cands.length;
    const ord = Array.from({ length: n }, (_, t) => t);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(perm() * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
    const lg0 = P.forwardCands(g.state, g.pid, g.cands, base, { temp: 0.5 }).logits;
    const lg1 = P.forwardCands(g.state, g.pid, ord.map((t) => g.cands[t]), base, { temp: 0.5 }).logits;
    for (let k = 0; k < n; k++) { const d = Math.abs(lg1[k] - lg0[ord[k]]); if (Number.isFinite(d) && d > maxDiff) maxDiff = d; }
    checked++;
  }
  console.log('  顺序不变性（T-F2，' + checked + ' 组换序重评）：逐位 logits 最大偏离 = ' + maxDiff.toExponential(2));
  if (maxDiff > 1e-6) { console.error('⛔ T-F2 结构对候选顺序敏感（最大偏离 ' + maxDiff.toExponential(2) + '）⇒ "集合编码顺序无关"这条设计断言不成立，先改结构再谈训练'); process.exit(8); }
}
console.log('  同场自证：对手表指纹 ' + fpPool + '（跑两遍一致）‖ 标签指纹 ' + fpLabels + ' ‖ 起点两次评估逐字同 ‖ 变异→货币动（T-A/B/C PASS）');
console.log('  随机基线粒（base' + ((WARM || DAGGER) ? ' ‖ ⚑ 本臂真正起点是上面那枚 warm/dagger 粒，不是这枚' : '') + '）：训练集 regret=' + s1.regret.toFixed(3) + ' ‖ 配对序=' + (100 * s1.pair).toFixed(1) + '% ‖ top-1=' + (100 * s1.top1).toFixed(1) + '% ‖ CE=' + s1.ce.toFixed(4));

/* ===== (μ+λ)-ES：货币 = 训练半批的**负交叉熵**（稠密；regret 与 top-1 只报不选）===== */
let theta = Float64Array.from(theta0 || base), best = Float64Array.from(theta0 || base);
let bestCe = s1.ce, curCe = s1.ce, hist = [];
for (let it = 0; it < ITER; it++) {
  const kids = [], fits = [];
  for (let k = 0; k < POP; k++) {
    const c = k === 0 ? Float64Array.from(theta) : P.mutatePolicy(Float64Array.from(theta), SIG);
    kids.push(c); fits.push(scoreSet(c, train).ce);
  }
  const order = kids.map((c, i) => i).sort((a, b) => fits[a] - fits[b]);   /* CE 越小越好 */
  /* ⚑ 加权**平均**：系数和必须为 1。第一版多乘了一个 2/ELITE ⇒ 每代把 θ 整体往 0 缩 1/3，
   *   十代后起点已被自己压扁（这种"看着在动其实在缩"的 bug，靠 CE 曲线看不出来，只能对账算式）。 */
  let sum = 0; for (let e = 0; e < ELITE; e++) sum += ELITE - e;
  const nxt = new Float64Array(theta.length);
  for (let e = 0; e < ELITE; e++) { const f = (ELITE - e) / sum; const c = kids[order[e]]; for (let i = 0; i < nxt.length; i++) nxt[i] += f * c[i]; }
  theta = nxt;
  curCe = fits[order[0]];
  if (curCe < bestCe) { bestCe = curCe; best = Float64Array.from(kids[order[0]]); }
  if (it % 10 === 0 || it === ITER - 1) hist.push({ it, ce: curCe });
}
const tr = scoreSet(best, train), ho = scoreSet(best, hold), ho0 = scoreSet(base, hold);
console.log('  训练轨迹 CE：' + hist.map((h) => h.it + ':' + h.ce.toFixed(3)).join(' '));
console.log('  当选粒 ‖ 训练 regret=' + tr.regret.toFixed(3) + ' ‖ 配对序=' + (100 * tr.pair).toFixed(1) + '% ‖ top-1=' + (100 * tr.top1).toFixed(1) + '%（同分 ' + (100 * tr.hitVal).toFixed(1) + '%）‖ CE=' + tr.ce.toFixed(4));
console.log('  当选粒 ‖ **留出** regret=' + ho.regret.toFixed(3) + ' ‖ 配对序=' + (100 * ho.pair).toFixed(1) + '% ‖ top-1=' + (100 * ho.top1).toFixed(1) + '%（同分 ' + (100 * ho.hitVal).toFixed(1) + '%）‖ CE=' + ho.ce.toFixed(4) + ' ‖ 地板：H=' + Htgt.toFixed(3) + ' / ln n=' + lnN.toFixed(3)
  + ' ‖ ⭐ 同目标只差技能却**逐位全等**的对 = ' + (100 * ho.skillFlat).toFixed(1) + '%（' + ho.skillPairs + ' 对 ‖ 同一批对上标签自己也是全等的 ' + (100 * ho.skillPairsLabelFlat).toFixed(1) + '% ‖ 我方最大并列集合平均 ' + ho.myTie.toFixed(2) + ' 枚 ‖ 标签并列 ' + ho.refTie.toFixed(2) + ' 枚）');
console.log('  随机基线粒 ‖ 留出 regret=' + ho0.regret.toFixed(3) + ' ‖ 配对序=' + (100 * ho0.pair).toFixed(1) + '% ‖ top-1=' + (100 * ho0.top1).toFixed(1) + '%（同分 ' + (100 * ho0.hitVal).toFixed(1) + '%）‖ CE=' + ho0.ce.toFixed(4));
const dTop = 100 * (ho.top1 - ho0.top1), dPair = 100 * (ho.pair - ho0.pair);
console.log('  ⇒ 留出上的净变化：Δtop-1 ' + (dTop >= 0 ? '+' : '') + dTop.toFixed(1) + 'pt ‖ Δ配对序 ' + (dPair >= 0 ? '+' : '') + dPair.toFixed(1) + 'pt（每组成员候选数中位 ' +
  fixtures.map((f) => f.cands.length).sort((a, b) => a - b)[Math.floor(fixtures.length / 2)] + ' ⇒ 随机 top-1 约 ' +
  (100 / fixtures.map((f) => f.cands.length).sort((a, b) => a - b)[Math.floor(fixtures.length / 2)]).toFixed(1) + '%）');
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const out = OUT || ('scratch/arms/' + stamp + '-rankfit-' + (ARCH === 'obs3' ? 'S1o' : 'S1') + '-s' + SEED + '.bak');
writeFileSync(out, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(best)) + ';\n');
writeFileSync(out + '.meta.json', JSON.stringify({ tool: 'rankfit', arch: ARCH === 'obs3' ? 'S1o' : 'S1', seed: SEED,
  dagger: DAGGER || null, warm: WARM || null, playTemp: DAGGER ? PLAYTEMP : null,
  groups: fixtures.length, train: train.length, hold: hold.length,
  poolFp: fpPool, labelFp: fpLabels, pop: POP, elite: ELITE, iters: ITER, sig: SIG, targetTemp: TT, modelTemp: TT, momentMatch: true,
  labelKind: FROM ? 'rollout-win' : 'v7-distill', from: FROM || null, fx: FXREP, regretUnit: FROM ? 'winRate01' : 'v7score',
  labelDrops: LABDROPTOT, allowDropLabels: ALLOW_DROP,
  holdoutStart: ho0, holdoutBest: ho, deltaTop1Pt: dTop, deltaPairPt: dPair, paramCount: P.paramCount(), v7ref: 'js/bundled-champion-3p.js' }, null, 1));
console.log('  产物 ' + out + ' ‖ ' + out + '.meta.json');
