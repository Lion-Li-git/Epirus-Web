#!/usr/bin/env node
/* profile2.mjs — 2.0 包的**行为剖面**尺（§E 段 D 前置 · 千问 · 10-29 夜）
 *
 * 为什么要有它：臂的 `dFirst` 只有一个数。用户定的展示规矩是**给特性剖面不给总分**（在册 10-10），
 *   而 2.0 的包现在没有任何一条能读它的路径——v7 那三把尺（§E815/817/819b）都吃 235 维的 dump，
 *   `EpirusPolicy.value` 对 2.0 向量**当场抛**（那是 §E822 根因修完之后才有的硬行为）。
 *   ⇒ 新对象要配自己的尺，不是把旧尺硬套。
 *
 * 三条硬条款：
 *   ① 每格同场跑一枚**同结构随机起点包**当对照 ⇒ 只报"与随机起点的差"；绝对值不与 §E818 那些热启动 v7 臂并排（在册裁定）。
 *   ② **接线自证**（覆盖式接入必须证明真被调用）：同一份局面上两粒参数的 logits 若**逐位相同**，
 *      要么被测包就是那枚随机粒（会印出来），要么 chooser 根本没吃到它 ⇒ 后者当场 exit 7，不许继续印剖面。
 *   ③ 对手表由**参照包**造（`T.buildOpps(refParams)`），不用被测包自己造 ⇒ 避免"对手随被评粒变化"那条病。
 *
 * 用法：node tools/proto2/profile2.mjs --pack=scratch/arms/xxx.bak [--games=24] [--ref=js/bundled-champion-3p.js]
 *   · 包里的 `arch` 字段决定输入面（`S1`=吃 v7 切片 ‖ `S1o`=吃 obs3）⇒ 不需要手对齐，读错会当场抛。
 *   · 只读，不改引擎、不 promote、不进产品门。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const GAMES = Math.max(4, Number(arg('games', 24)) || 24);
/* ⚑ 采样温度必须**三行同一条**：v7 那条走 `P.choose`，`opts.temp` 缺省是 0.6（policy.js:701 `opts.temp || 0.6`），
 *   而 2.0 的 `chooseCandidates` 缺省写的是 0.5（arch2.mjs:418）⇒ 不显式传就等于"两行两套噪声档"，
 *   Δ夺1 里就混进"谁更敢按分差下注"。这里默认钉 0.6 并把同一枚 temp 交给三行。 */
const TEMP = Number(arg('temp', 0.6));
if (!(TEMP > 0)) { console.error('⛔ --temp 要正数'); process.exit(2); }
if (!PACK) { console.error('⛔ 需要 --pack=<2.0 的 .bak>'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = JSON.parse(readFileSync(PACK, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
if (raw.v !== 90) { console.error('⛔ 这不是 2.0 容器（v=' + raw.v + ' ⇒ 只认 v:90）'); process.exit(2); }
const archTag = raw.arch || 'S1';
const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
if (archTag === 'S1o') cfg.input = 'obs3';

/* ⚑ 顺序要紧：**先**用原生 `unpack` 把 v7 参照包读出来，**再**装 2.0 覆盖。
 *   装完之后再读 v7 ⇒ `unpack` 只认 v:90 ⇒ 返回 null（我第一版就栽在这里，报的还是"参照包读不出"这种指错方向的话）。 */
const refSrc = arg('ref', 'js/bundled-champion-3p.js');
let refParams = loadChamp(W, refSrc, '');
if (!refParams) { console.error('⛔ 参照包读不出（' + refSrc + '）⇒ 对手表无法固定'); process.exit(2); }
refParams = Float64Array.from(refParams);

/* ⚑ 对手表必须在**装 2.0 档之前**造好（10-29 02:3x 抓到）：装完档再 `buildOpps`，"装的是哪一档"会改变对手表本身
 *   ⇒ 连**参照行（v7 自己的包）**都跟着换考卷（实测：同一枚 v7 参照，装 S1 时那行夺1 25.8%，装 S1o 时 0.0% ‖ 活到终局 0.0%）。
 *   跨结构比较要的就是"参照行不随被测档动"，所以顺序是判据的一部分，不是风格。 */
const POOL = buildPoolSeeded(20261029);
const POOL_FP = poolFingerprint(POOL);
const POOL_FP2 = poolFingerprint(buildPoolSeeded(20261029));
if (POOL_FP !== POOL_FP2) { console.error('⛔ 对手表定标失败：同一枚种子两次指纹 ' + POOL_FP + ' vs ' + POOL_FP2); process.exit(2); }

const A = installArch2(W, cfg);
const params = Float64Array.from(P.unpack(raw, true));
if (!params || params.length !== P.paramCount()) { console.error('⛔ 包形状不对：读出 ' + params.length + ' ‖ 当前结构要 ' + P.paramCount()); process.exit(7); }
P.setRng(T.mulberry32(4242));
/* ⚑ 随机起点粒**必须定标**（10-29 02:2x 抓到）：`P.makePolicy` 在装 2.0 档之后走的是 arch2 的 `rngRef.r`，
 *   而 `P.setRng` 只管引擎自己那条流 ⇒ 我原先"每条臂同场跑一枚随机起点"其实是**每次换一枚粒**，
 *   对照行自己就在漂（实测两遍 17.0% vs 13.4% 夺1，3.6pt 全在对照身上）。
 *   修法：装档后把 rngRef 也换成定标流，并打印这枚起点的短指纹，两遍不一致就停。 */
if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
const randParams = Float64Array.from(P.makePolicy(0.25));
let fpRand = 2166136261;
for (let i = 0; i < randParams.length; i++) { const v = Math.round(randParams[i] * 1e6); fpRand = (Math.imul(fpRand ^ v, 16777619) >>> 0); }
/* ⚑ 对手表必须**定标**（10-29 02:2x 抓到：同一份命令跑两遍 Δ夺1 从 −12.03pt 漂到 −9.84pt、随机行从 16.5% 跳到 14.3%
 *   ⇒ 漂的不是包，是 `T.buildOpps()` 里那枚没播种的 `Math.random()`）。
 *   做法：只在造表期间临时顶掉 Math.random，出来立刻还原；并打印对手表指纹，两遍不一致就当场停。 */
function buildPoolSeeded(seedVal) {
  const real = Math.random;
  const rr = (() => { let a = seedVal >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  try { Math.random = rr; return T.buildOpps(refParams, 0.05); } finally { Math.random = real; }
}
function poolFingerprint(PL) {
  /* ⚑ 指纹要覆盖**真正影响行为的东西**：只数 `o.params` 前 6 条会在"脚本型对手根本没有 params"时退化成名字列表
   *   （这就是为什么它先前在 S1 / S1o 两档下报出同一个 9f189883，而参照行其实已经从 25.8% 掉到 0.0%）。
   *   ⇒ 现在把每个对手的全部数值字段 + 键名一起混进哈希，并额外记 `pool.numeric` 总数当"有没有牙"的证据。 */
  let h = 2166136261, nums = 0;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const o of PL) {
    mix('name=' + (o.name || '') + '|');
    const walk = (v, depth) => {
      if (depth > 3 || v == null) return;
      if (typeof v === 'number') { nums++; mix('n' + Math.round(v * 1e6)); return; }
      if (typeof v !== 'object') { mix('s' + String(v)); return; }
      if (Array.isArray(v)) { mix('[' + v.length); for (const q of v) walk(q, depth + 1); mix(']'); return; }
      for (const k of Object.keys(v).sort()) { mix('{' + k); walk(v[k], depth + 1); mix('}'); }
    };
    walk(o, 0);
  }
  return (h >>> 0).toString(16) + '/' + nums;
}
/* （对手表已移到装档之前——见上面那条 ⚑） */
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }

/* ===== 条款 ②：接线自证 =====
 * 候选集不自己重写：`legal` 只能从引擎的 chooser 回调里拿（`econBase(state,pid,legal)` 要它），
 *   所以这里在开局的决策点上装一枚"capturing chooser"，把 (state,pid,legal) 抓一份下来再打分。 */
function midFixture(seed) {
  let cap = null;
  const probe = (state, pid, legal) => { if (!cap && legal && legal.length) cap = { state, pid, legal }; return POOL[0].sel(state, pid, legal); };
  const choosers = [probe];
  for (let pid = 1; pid < 5; pid++) choosers.push(POOL[pid % POOL.length].sel);
  T.oneGameN(choosers, seed, 5, { regen: 0, mode: 'multi' });
  if (!cap) { console.error('⛔ 一整局都没抓到 (state,pid,legal) ⇒ 夹具失效，接线自证没法做'); process.exit(7); }
  return cap;
}
function logitsOf(pack, fx) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || !cands.length) { console.error('⛔ 夹具上没有合法候选 ⇒ 自证失效'); process.exit(7); }
  const f = P.forwardCands(fx.state, fx.pid, cands, pack, { temp: 0.5 });
  return { s: Array.from(f.logits).map((v) => v.toFixed(6)).join(','), n: cands.length };
}
{
  const st = midFixture(777);
  const a = logitsOf(params, st), b = logitsOf(randParams, st);
  const wiredOK = A.CNT ? A.CNT.forwards > 0 : (P.__arch2 && P.__arch2.CNT.forwards > 0);
  const cn = (P.__arch2 && P.__arch2.CNT) || A.CNT;
  if (!wiredOK) { console.error('⛔ 2.0 前向一次都没被叫到 ⇒ chooser 没吃到这份参数，剖面全是假的'); process.exit(7); }
  if (a.s === b.s) {
    let diff = 0; for (let i = 0; i < params.length; i++) if (params[i] !== randParams[i]) { diff = i + 1; break; }
    if (!diff) { console.log('⚠ 接线自证：被测包与随机起点包**逐位同一粒** ⇒ 这条臂其实没动过权重（剖面照跑，但判语只能是"没学到东西"）'); }
    else { console.error('⛔ 接线自证：两粒权重第 ' + diff + ' 个坐标已不同，但 logits 逐位相同 ⇒ 前向没吃到参数（§E822 那族病）'); process.exit(7); }
  }
  console.log('# 接线自证 ✔ forwardCands 已跑 ' + cn.forwards + ' 次 ‖ 候选打分 ' + cn.cands + ' 个 ‖ 同局面 logits：包 ' + a.s.slice(0, 34) + '… ‖ 随机 ' + b.s.slice(0, 34) + '…（各 ' + a.n + ' 个候选）');
}

const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });

/* ===== 第十七段那条口径的出厂实现：臂行自带"**并列集合大小**" =====
 * 病（#145 今夜闭合的那格）：同一份 logits，"取第一个最大"与"在并列集合里抽样"读出的夺1 差 **21.1pt**
 *   ⇒ 只报引擎那条 chooser 会把"**头分不开**"读成"头会打"。所以这条读数要跟着臂一起出厂，不能事后拿 scratch 补救。
 * 三条形状纪律：
 *   ① 包装在**接线自证之后** ⇒ 自证那两次打分不许混进账（不然计数虚高、下面的对账就白做）；
 *   ② 按"当前在跑哪一行"归账（`TIE2.cur`），行与行之间不串；
 *   ③ **覆盖式接入必须自证真被调用**：拿 arch2 自己的 `CNT.forwards` 增量与计数对账，
 *      对不上（>1%）就硬失败 ⇒ 否则这条列会像 §E824 那次一样"看着有数，其实量的是空气"。 */
/* 装在哪一层是**试出来的**，不是想当然：第一版包 `P.forwardCands` ⇒ 计数 0 而对账用的 `CNT.forwards` 涨 4365，
 *   当场红（这就是那条"覆盖式接入要自证真被调用"在起作用）。
 *   原因是 arch2 的 `chooseCandidates` 闭包里直接调**它自己那份** `forwardCands`（`arch2.mjs:420`），
 *   而引擎那条路走的是 `P.chooseCandidates` ⇒ 要拦就得拦 `chooseCandidates`，再用导出的 `P.__arch2.forwardCands` 复算一次 logits
 *   （纯函数、不抽 rng ⇒ 只多花一次打分，不改变被评者的选择）。 */
const TIE2 = { cur: null, by: {} };
const ARCH2 = P.__arch2;
const FC_BEFORE = ARCH2 && ARCH2.CNT ? ARCH2.CNT.forwards : 0;
const prevCC2 = P.chooseCandidates;
P.chooseCandidates = function (state, pid, cands, params2, opts2) {
  const r = prevCC2.apply(null, arguments);
  const t = TIE2.cur;
  if (t && ARCH2 && params2 && params2.length === P.paramCount() && cands && cands.length) {
    const f = ARCH2.forwardCands(state, pid, cands, params2,
      { temp: opts2 && opts2.temp != null ? opts2.temp : 0.5 });
    if (f && f.logits && f.logits.length === cands.length) {
      const b = TIE2.by[t] || (TIE2.by[t] = { n: 0, sum: 0, worst: 0, uniq: 0 });
      let mx = -Infinity; for (let i = 0; i < f.logits.length; i++) if (f.logits[i] > mx) mx = f.logits[i];
      let k = 0; for (let i = 0; i < f.logits.length; i++) if (Math.abs(f.logits[i] - mx) < 1e-9) k++;
      b.n++; b.sum += k; if (k > b.worst) b.worst = k; if (k === 1) b.uniq++;
    }
  }
  return r;
};
function playCell(pack, cell, seed) {
  const acc = { games: 0, first: 0, top2: 0, rounds: 0, acts: 0, cat: {}, guard: 0, charge: 0, bead: 0, voidedOnMe: 0, survived: 0 };
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid === seat) choosers.push(T.policyChooserN(pack, TEMP));
      else choosers.push(POOL[(cell.idx + 1 + pid) % POOL.length].sel);
    }
    const rm = T.oneGameN(choosers, seed + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state;
    acc.games++;
    if (rm.winner === seat) acc.first++;
    /* 前2 = 终局血量名次（`oneGameN` 只回 {winner,rounds,dmg,state} ⇒ 名次自己按终局 hp 数，别假设有现成的） */
    const myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (ahead <= 1) acc.top2++;
    acc.rounds += rm.rounds || 0;
    if (myHp > 0) acc.survived++;
    for (const e of (st.events || [])) {
      if (e.type === 'action' && e.pid === seat) {
        acc.acts++; acc.cat[CAT[e.key] || '?'] = (acc.cat[CAT[e.key] || '?'] || 0) + 1;
        if (e.key === 'charge') acc.charge++;
        if (R.GUARD_FAMILY.indexOf(e.key) >= 0) acc.guard++;
        if (e.bead) acc.bead++;
      }
      if (e.type === 'voided' && (e.to === seat || e.pid === seat || e.byPid === seat)) acc.voidedOnMe++;
    }
  }
  return acc;
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const per = (a, b) => b ? (a / b).toFixed(2) : '—';
function row(tag, pack, cell, seed) {
  TIE2.cur = tag;
  const a = playCell(pack, cell, seed);
  TIE2.cur = null;
  const cats = ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + pct(a.cat[k] || 0, a.acts)).join(' ');
  console.log('  ' + tag.padEnd(9) + ' ‖ 局 ' + a.games + ' ‖ 夺1 ' + pct(a.first, a.games) + ' ‖ 前2 ' + pct(a.top2, a.games) +
    ' ‖ 活到终局 ' + pct(a.survived, a.games) + ' ‖ 局长 ' + per(a.rounds, a.games) + ' ‖ 出手/局 ' + per(a.acts, a.games) +
    ' ‖ 族 ' + cats + ' ‖ 蓄能 ' + pct(a.charge, a.acts) + ' ‖ 架势 ' + pct(a.guard, a.acts) + ' ‖ 用珠 ' + a.bead + ' ‖ 无效化事件 ' + a.voidedOnMe);
  return a;
}
console.log('# 2.0 行为剖面 ‖ 包 ' + PACK + ' ‖ 结构 ' + archTag + ' ‖ paramCount=' + P.paramCount() +
  ' ‖ 每格 ' + GAMES + ' 局 ‖ **三行同 temp=' + TEMP + '** ‖ 随机起点粒指纹 ' + (fpRand >>> 0).toString(16) + ' ‖ 对手表固定自 ' + refSrc + '（定标指纹 ' + POOL_FP + ' ‖ 同种子两遍一致已验） ‖ 三行同格同局号（2.0包 ‖ 同结构随机起点 ‖ **参照包**）⇒ 既读"离随机起点多远"，也读"离参照包多远"');
const S = { pF: 0, pG: 0, pT: 0, rF: 0, rT: 0, rG: 0, vF: 0, vT: 0, vG: 0 };
for (const cell of CELLS) {
  console.log('· 格 ' + cell.name + ' ‖ n=' + cell.n);
  const a = row('2.0包', params, cell, 1000 + cell.n * 97 + cell.idx);
  const b = row('随机起点', randParams, cell, 1000 + cell.n * 97 + cell.idx);
  /* ⚑ 第三行 = **参照包自己**（默认 v7 现役冠军）。加它的原因很具体：段 D′ 用"模仿 v7"当货币训出来的粒，
   *   只跟随机起点比是**判不出值不值**的（模仿得再像也只是像），必须同场读"离 v7 还差多少"。
   *   三行共用同一格同一局号 ⇒ 分母天然相等（下面那条分母对账会当场抓不平）。 */
  const c = row('参照包⚠', refParams, cell, 1000 + cell.n * 97 + cell.idx);
  /* ⚑⚑ 这一行**不是**产品级的 v7 基线（10-29 02:4x 抓到）：装了 2.0 档之后再让 v7 当 seat 0，它自己会变——
   *   装 S1 时夺1 25.8%、装 S1o 时 1.2%，而**什么都不装**的同一套格同一套局号是 **40.3%**（`tools/proto2/ref-baseline.mjs`）。
   *   ⇒ 参照行只能当"同一档内的相对刻度"，任何"2.0 打赢/打输现役冠军"的句子都不许由它出，必须由 ref-baseline 那边对表。
   *   为什么会变还没查到底（覆盖表是 paramCount/makePolicy/…/forwardCands/chooseCandidates/shapeOf/value 这 11 个入口，
   *   v7 的 chooser 走 `P.choose`→本地 forward，理论上不经过被覆盖的那几个），挂在待查。 */
  S.pF += a.first; S.pG += a.games; S.pT += a.top2; S.rF += b.first; S.rG += b.games; S.rT += b.top2;
  S.vF += c.first; S.vG += c.games; S.vT += c.top2;
}
/* ===== 并列集合那一条读数（附"这条列真的在量东西"的对账）===== */
{
  const FC_AFTER = ((P.__arch2 && P.__arch2.CNT) || A.CNT || { forwards: 0 }).forwards;
  const delta = FC_AFTER - FC_BEFORE;
  const counted = ['2.0包', '随机起点'].reduce((s, t) => s + ((TIE2.by[t] && TIE2.by[t].n) || 0), 0);
  P.chooseCandidates = prevCC2;                       /* 复算用的那层壳当场摘掉，别留给后面的读数 */
  /* 对账为什么是 `delta = 2 × counted`：引擎每走一次 `chooseCandidates`，arch2 内部打一次分（+1），
   *   我这层为量并列集合**再复算一次**（+1）。所以两次都该被 `CNT.forwards` 记到 ⇒ 若包装被绕过，`counted` 会是 0 而 delta 涨
   *   （第一版就是这么红的）；若我复算漏了几枚，2× 这条关系也会破。 */
  console.log('   ⭐ 并列集合大小（同一份 logits 里"最大"有几枚并列；对局里这些枚由**引擎抽样**决定 ⇒ 大 = 头分不开，不是头会打）：');
  for (const t of ['2.0包', '随机起点', '参照包⚠']) {
    const b = TIE2.by[t];
    if (!b || !b.n) { console.log('     · ' + t + ' ‖ **读不出**（0 次逐候选打分 ⇒ 这一行没经过 2.0 前向；参照包那行本来就走 v7 自己的路）'); continue; }
    console.log('     · ' + t + ' ‖ 平均 ' + (b.sum / b.n).toFixed(2) + ' 枚 ‖ 最坏 ' + b.worst + ' ‖ "唯一最大"占 ' + (100 * b.uniq / b.n).toFixed(1) + '% ‖ 打分 ' + b.n + ' 次');
  }
  console.log('     ✔ 对账：本段内 arch2 自报 `CNT.forwards` 增 ' + delta + ' ‖ 我的计数 ' + counted + ' × 2（引擎一次 + 复算一次）⇒ '
    + (delta > 0 && counted > 0 && Math.abs(delta - 2 * counted) <= 0.01 * delta ? '**这条列量的是真被调用的那批打分**' : '**对不上 ⇒ 上面那两行读数作废，先查包装点**'));
  if (delta <= 0 || counted <= 0 || Math.abs(delta - 2 * counted) > 0.01 * delta) {
    console.error('⛔ 并列集合那条列没被自证（forwards 增 ' + delta + ' vs 2×计数 ' + (2 * counted) + '）⇒ 覆盖式接入被绕过了，尺不出数');
    process.exit(7);
  }
}
const dFirst = 100 * (S.pF / S.pG - S.rF / S.rG), dTop2 = 100 * (S.pT / S.pG - S.rT / S.rG);
console.log('⇒ 汇总 ' + CELLS.length + ' 格 ‖ 各 ' + GAMES + ' 局 ‖ 共 ' + S.pG + ' 局：夺1 ' + pct(S.pF, S.pG) + ' vs 随机 ' + pct(S.rF, S.rG) +
  ' vs 参照 ' + pct(S.vF, S.vG) + ' ⇒ **Δ夺1( vs 随机) ' + dFirst.toFixed(2) + 'pt** ‖ Δ前2 ' + dTop2.toFixed(2) + 'pt');
const dV = 100 * (S.pF / S.pG - S.vF / S.vG);
const seV = 100 * Math.sqrt((S.pF / S.pG) * (1 - S.pF / S.pG) / S.pG + (S.vF / S.vG) * (1 - S.vF / S.vG) / S.vG);
console.log('   ⇒ **Δ夺1( vs 参照包) ' + dV.toFixed(2) + 'pt ‖ 合并 SE ≈ ' + seV.toFixed(2) + '**（|Δ| < ' + (2 * seV).toFixed(1) + 'pt 只能写"分不开"）');
const se = 100 * Math.sqrt((S.pF / S.pG) * (1 - S.pF / S.pG) / S.pG + (S.rF / S.rG) * (1 - S.rF / S.rG) / S.rG);
console.log('   合并 SE ≈ ' + se.toFixed(2) + 'pt ⇒ |Δ| < ' + (2 * se).toFixed(1) + 'pt 只能写"分不开"（本轮' + (Math.abs(dFirst) > 2 * se ? '过线' : '**不过线**') + '）');
console.log('   ⚑ 「前2」在 n=3 的**随机基线就是 66.7%**、n=5 是 40% ⇒ 它只当"别死太早"的粗读数，判别力主要看夺1；' +
  '混合两档时前2 的分母不是同一个 ⇒ 不许单独引它下判语');
console.log('   ⚑ 两行分母必须相等（同格同局号）：' + S.pG + ' vs ' + S.rG + (S.pG === S.rG ? ' ✔' : ' ⇒ 剖面作废'));
process.exit(S.pG === S.rG ? 0 : 2);
