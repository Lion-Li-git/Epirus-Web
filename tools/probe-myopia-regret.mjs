#!/usr/bin/env node
/* §E195 · **近视到底值多少钱**：同一批决策上用引擎真向前模拟整局，量"oracle 那手"与"臂自己那手"的差
 *
 * 为什么现在做这一格（它直接服务用户早上要裁的那件事）：§E190~§E193 把"再加一枚手写价"这条路量尽并否掉，
 *   收敛到的唯一方向是"**换目标函数本身**（状态价值头 / 远视结算）"。但那是一笔**换代级的钱**
 *   （`PACK_VERSION` 8 ⇒ 两个出厂包被 `checkPack` 拒载 + 全量重训）。⇒ 掏钱之前要先有一个**上限**：
 *   **如果根节点那一手能选到"整局模拟最优"，胜率能多几个点？**
 *   上限小 ⇒ 价值头不值那一换代钱；上限大 ⇒ 这是本仓第一次有**量过价钱**的理由去换代。
 *
 * 做法：产品桌焦点席（1 号）的决策点上，取候选集 `P.candidatesFor(state,pid,T.econBase(...),{lockTarget:false})`
 *   （与 `evo.js:816` 信念搜索同一份，不自己重写），对其中打分前 K 个候选各 `S.cloneState` 后**让引擎把整局打完**，
 *   记两种终点（`st.winner===焦点席` 与"血量第一"）⇒ `regret = max(候选) − 臂自己那手`（同格配对，同一份克隆随机流）。
 *
 * ⚠ 四条限制（不写就会被误读的形状）：
 *   1. **这是"给定延续策略"的上限**：rollout 里后续仍用同一个臂的 chooser ⇒ 量到的是"一手前瞻 + 现有策略延续"的改进量，
 *      正是价值头/加深搜索**当前能买到**的那部分；**不是**"完美价值函数的天花板"。
 *   2. **oracle 是乐观统计**（K 个带运气结果里取最大 ⇒ 天然膨胀）⇒ 同框必须给"随机挑一个候选"的对照，
 *      只有 `regret(oracle) − regret(随机)` 才是信号；本节把两条都印出来。
 *   3. 候选集与出厂臂那份差一个 `lockTarget`（出厂是 `lastCancelOther(...)`，这里 `false`，与信念搜索一致）⇒
 *      两臂共用同一候选集才让 a/b 可比，但**不许**说"这就是出厂那一手的选择集"。
 *   4. 采样只在被采样的决策上做统计、不改执行的出手 ⇒ 每个臂各跑一遍，**不与 §E185~§E193 的绝对值并排**。
 *
 * 三道自检（§E192 的教训：静默等效比静默报错危险）：
 *   ① **覆盖必须是活的**：把第一手强制成"打分最低的候选"，其结局必须至少在一些格上与"臂自己那手"不同；
 *      全同 ⇒ 覆盖根本没进引擎，那 regret 全是假的（写错时它会精确等于 0，看起来正好像"近视不亏"）。
 *   ② **覆盖要真的落到引擎的动作栏上**：`S.attemptAction` 之后读 `state.actions[焦点席].key` 必须等于我递交的那张
 *      （第一版这里我写的是"强制成臂自己那手必须与不覆盖逐字相同"——**那条判据本身不成立**：温度采样每批随机流会自己换一手，
 *      于是检查永远红，看起来像仪器坏了，其实是判据错。改成问引擎要回执。）
 *   ③ **必须有选择余地**：采样决策数 > 0 且候选数均值 > 1.5，否则"换一手"这件事在本格不存在。
 *
 * 只读 `js/**`，不改引擎、不加门、不动冠军槽。
 */
import { writeFileSync } from 'node:fs';
import { sandbox, mulberry32, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['envs', 'games', 'every', 'rmax', 'keep', 'rep', 'arm', 'cont', 'seed', 'dump', 'depth2', 'k2', 'selfcheck', 'sweep', 'resetmem', 'freshrng', 'bare'], 'probe-myopia-regret');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const GAMES = Math.max(1, Number(arg('games', 10)) || 10);
const EVERY = Math.max(1, Number(arg('every', 6)) || 6);
const RMAX = Math.max(1, Number(arg('rmax', 8)) || 8);
const KEEP = Math.max(2, Number(arg('keep', 6)) || 6);
let REP = Math.max(1, Number(arg('rep', 4)) || 4);            /* 每一手用几条随机流重放（regret 是期望差，不是 0/1 差）；`--sweep` 会抬到最长前缀 */
const SEED = Number(arg('seed', 4100)) || 4100;
const ENV_PICK = String(arg('envs', 'aggro,wall,antidef,tankline,random,mix')).split(',').filter(Boolean);
const ARMS = String(arg('arm', 'A0,B1,B2')).split(',').filter(x => x === 'A0' || x === 'B1' || x === 'B2');
const CONT = arg('cont', 'pack');                                              /* rollout 延续席：pack = 三臂同一把尺 */
const DEPTH2 = argv.includes('--depth2');                                      /* §E199：同时量"两手的上限" */
const K2 = Math.max(1, Number(arg('k2', 4)) || 4);
/* ===== §E202 · 固定样本的 `rep` 扫（`--sweep=2,4,8,16`）=====
 * 为什么要这一格：§E200 那条"上限里有一半是选择膨胀"的头条下调，是把 `regret(oracle)` 对 `rep` 拟合出来的，
 *   而它用的五个点来自**五次独立进程**。实测它们采样到的决策数各不相同（rep=2→724、4→839、8→753、16→822，
 *   另一次带 `--depth2` 的 rep=2 是 678）⇒ 母对局的轨迹被"跑了多少次 rollout"挪动了（rollout 里复用同一批 chooser 实例，
 *   它们有跨调用状态；`bots.js` 的 `__mem` 四席共享是同族已知隐患）。⇒ **那不是同一个样本，衰减律就混进了抽样组成差**。
 * 修法（本格）：**一遍跑到底、只跑最长的那 `REP` 条流**，然后按**前缀** 2/4/8/16 分别求均值 ⇒
 *   每个 `rep` 点都是同一批决策、同一批流的前缀（嵌套 ⇒ 天然配对），衰减差只剩"估计噪声"这一个来源。
 * ⚠ 默认关：不带 `--sweep` 时聚合与调用顺序逐字照旧（§E195/§E196 的可复现性靠这条保）。 */
const SWEEP = String(arg('sweep', '')).split(',').map(x => Math.floor(Number(x))).filter(x => x >= 1).sort((a, b) => a - b);
if (SWEEP.length) REP = Math.max(REP, SWEEP[SWEEP.length - 1]);
/* §E202 的**机制检验**（`--resetmem`）：`bots.js:50` 的 `__mem` 是模块级共享，rollout 会把它往前推 ⇒ 母局换轨迹。
 *   若在"每个采样决策的 rollout 批次开头"调一次 `B.resetBotMem()`（**已导出**，`bots.js:965`），
 *   那么母局在两次采样之间自己的写入不受影响、而"跑了多少条 rollout"不再进入状态 ⇒
 *   **判据很干脆：`--rep=2` 与 `--rep=4` 的采样决策数应当变成相同。** 相同 ⇒ 病灶确认在 `__mem`；
 *   仍不同 ⇒ 还有第二处（`__pbMem` 或 `human-pool.mjs` 的 `seq/calls`），本轮先不宣称找到根因。
 * ⚠ 默认关（开了以后母局轨迹与"零 rollout"的那条**并不相同** —— 它多了中途抹记忆这一步，所以绝对值会漂）。 */
const RESETMEM = argv.includes('--resetmem');
/* ===== §E204 · 找到了主犯（`--freshrng`）：mimic 的随机流**捕获的是母局的 `st`**
 * `runArm` 给 0 号席写的是 `makeMimic(..., function () { return st.rng.next(); })`，而 `human-pool.mjs:50` 的 `rnd` 是个闭包参数
 *   ⇒ **每条 rollout 里 0 号席每出一次手，就从母局的随机流上抽走一个数** ⇒ 母局后续每个决策都换轨迹，
 *   且消耗量正比于 `rep × 候选数` ⇒ 这才是 §E202 里"只 reset `__mem` 判据还是红"的原因。
 * 修法：让 mimic 抽"当前最内层那个 clone 的 rng"（一个栈顶指针，进 rollout 时压、出时恢复）。
 *   ⚠ 母局自己跑时栈顶是 null ⇒ 照旧抽 `st.rng` ⇒ **默认路径逐字不变**；`--freshrng` 关时也不变。 */
let RNGCUR = null;
const FRESHRNG = argv.includes('--freshrng');
/* §E204 留下的那一格（"只证了与 `rep` 无关，没证等于零 rollout 的干净轨迹"）的**闭环工具**：
 *   `--bare` 只数"哪些决策会被采到"，**一条 rollout 都不跑** ⇒ 它的采样数就是"零扰动轨迹"的那个数。
 *   ⇒ 判据：`--bare` 的采样数 == `--freshrng` 各 `rep` 档的采样数 ⇒ 那条轨迹真的被还原了；
 *      不相等 ⇒ 还有残余通道（`__mem` 那一类），并且差值本身量出"残余有多大"。 */
const BARE = argv.includes('--bare');
/* §E197 用的**导出**：`--dump=<path>` 把"每个采样决策 × 每个候选"的**现有 235 维特征 + 模拟赢率标签**落成 JSONL。
 *   ⇒ 为什么要在这里导出而不是另写一台采集器：**rollout 的算术只能有一份**（本仓"两份同构实现必漂移"的老病），
 *     而"上限能不能被一个可学的头拿到"必须用**同一批标签**来问，否则两边的 regret 不可比。
 *   ⚠ 只在非自检遍里落行（自检遍会把 A0 再跑一遍，行会重复）。 */
const DUMP = arg('dump', '');
const ROWS = [];

const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENVS = ENV_PICK.map(n => { const q = POOL.find(z => z.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return q; });
const HB = loadPool(W, 'human');
const N = 5, FOCUS = 1;

function mkArm(name) {
  /* `A0` 关档 ‖ `B1` 信念搜索 ply1 ‖ `B2` ply2 ⇒ 三个臂各测"一手完美根决策还剩多少可买"。
     为什么 `B2` 必须同框：如果**加深**能把 regret 压小，那"价值头"就有便宜的替身（多算一层）；
     如果压不小（`B2 ≈ B1 ≈ A0`），那"近视"就不是深度问题，是**结算函数**问题 ⇒ 换代钱才有独立理由。 */
  if (name === 'B1' || name === 'B2') {
    T.setBeliefPly(name === 'B2' ? 2 : 1); T.setBeliefTarget(0); T.setBeliefTie(0); T.setBeliefBead(0); T.setBeliefRingPrice(0);
    T.setBeliefBeadRedeemable(0); T.setBeliefFireSpend(0); T.setBeliefSearch(0);
    return { key: name, mk: () => T.policyChooserBelief(params, 0.15) };
  }
  return { key: 'A0', mk: () => T.policyChooserN(params, 0.15) };
}

/* 一次 rollout：克隆 `state`，焦点席**下一手**按 `forced`（`null` = 不覆盖、让臂自己选），之后全部照常打完。
 * ⚠ **每次重放都换一条随机流**（照 `evo.js:854` 的做法给克隆体重挂 `rng`）：单条流的结局是 0/1，
 *   一个决策的 regret 就只能是 −1/0/+1 ⇒ 要把它当期望差来平均，同一手必须打 `REP` 条流取均值。
 *   同一格的所有候选共用这 `REP` 条流的编号 ⇒ 仍是配对比较。 */
function playRollout(state, seatChos, forced, deepFlag, streamId) {
  const q = S.cloneState(state);
  q.rng = { next: mulberry32((((state.round | 0) + 1) * 2654435761 + FOCUS * 7919 + streamId * 104729) >>> 0) };
  const prevDeep = deepFlag.v;                          /* ⚠ 必须**恢复**而不是置 false：嵌套 rollout 会把外层标志抹掉 */
  deepFlag.v = true;
  const prevRng = RNGCUR;                               /* §E204：同一族处理 —— 栈顶换成这只 clone，出去再恢复 */
  if (FRESHRNG) RNGCUR = q;
  const chs = [];
  for (let i = 0; i < N; i++) {
    if (i !== FOCUS || forced === null) { chs.push(seatChos[i]); continue; }
    let used = false;
    chs.push(function (st2, pid, legal) {
      if (used) return seatChos[FOCUS](st2, pid, legal);
      used = true;
      /* 强制那一手要走的字段照出厂形状（`play.js` 的 normPick 认 {key,target,target2,bead}） */
      return { key: forced.key, target: forced.target == null ? null : forced.target,
        target2: forced.target2 == null ? null : forced.target2, bead: forced.bead || null };
    });
  }
  Play.autoGameN(q, chs);
  deepFlag.v = prevDeep;
  RNGCUR = prevRng;
  const me = q.p[FOCUS];
  let hpTop = 0;
  if (me && me.hp > 0) { hpTop = 1; for (let i = 0; i < N; i++) if (i !== FOCUS && q.p[i].hp > me.hp) { hpTop = 0; break; } }
  return { win: q.winner === FOCUS ? 1 : 0, hpTop, rounds: q.round };
}
function m0(x) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return x.length ? s / x.length : NaN; }
/* §E202：把"每一手打 `rep` 条流"拆成**逐流数组**，均值只是它的一个前缀聚合 ⇒ `--sweep` 能在**同一批决策**上比较不同 `rep`。
 *   ⚠ 调用顺序与旧的 `outcomeOf` 逐字相同（`k = 0..rep-1`、流号 `off+k+1`），所以默认路径的读数不变。 */
function outcomeStreams(cand, state, seatChos, deepFlag, rep, off) {
  const win = [], hpTop = [], rounds = [], o = off || 0;
  for (let k = 0; k < rep; k++) { const r = playRollout(state, seatChos, cand, deepFlag, o + k + 1); win.push(r.win); hpTop.push(r.hpTop); rounds.push(r.rounds); }
  return { win, hpTop, rounds };
}
function outcomeOf(cand, state, seatChos, deepFlag, rep) {
  const s = outcomeStreams(cand, state, seatChos, deepFlag, rep, 0);
  return { win: m0(s.win), hpTop: m0(s.hpTop), rounds: m0(s.rounds) };
}
/* §E199 · **两手的上限**（`--depth2`）：第一手强制成 `a1`，跑到焦点席**下一手**时再把那一手的短名单
 *   （同样按网络分取前 `K2` 个）逐个强制 + 打完，取最大 ⇒ `oracle2 = max_{a1} max_{a2} E[win]`。
 *   ⚠ 两点必须写清，否则会被读成别的东西：
 *   · **延续仍然是关档包**（`contChos`）⇒ 量的是"连做两手 + 之后照旧"的上限，与 `oracle1` 同一把尺，可直接相减；
 *   · 若这一局在焦点席走出第二手之前就结束（它死了/ game over），`best` 无从产生 ⇒ **退回 `a1` 的一手上限值**，
 *     不是记 0 —— 记 0 会把 `oracle2` 系统性压低，得出"多看一手没用"的假结论（方向性偏差，比噪声更坏）。 */
function outcomeOf2(a1, state, pid, contChos, deepFlag, rep) {
  const one = outcomeOf(a1, state, contChos, deepFlag, rep);      /* 一手值（也用作"走不到第二手"的退回值） */
  let best = null, bestMean = null;
  const inner = [];                                               /* §E202：每个第二手候选的**逐流**赢率数组，供前缀聚合 */
  const q = S.cloneState(state);
  q.rng = { next: mulberry32((((state.round | 0) + 1) * 2654435761 + FOCUS * 7919 + 4243) >>> 0) };
  const prevDeep = deepFlag.v;
  deepFlag.v = true;
  const prevRng2 = RNGCUR;                              /* §E204：这层自己也是一次"偏离对局" ⇒ 同样压栈 */
  if (FRESHRNG) RNGCUR = q;
  let turn = 0;
  const chs = [];
  for (let i = 0; i < N; i++) {
    if (i !== FOCUS) { chs.push(contChos[i]); continue; }
    chs.push(function (st2, id, legal) {
      turn++;
      if (turn === 1) return { key: a1.key, target: a1.target == null ? null : a1.target, target2: a1.target2 == null ? null : a1.target2, bead: a1.bead || null };
      if (turn === 2 && best === null) {
        const c2 = P.candidatesFor(st2, id, T.econBase(st2, id, legal), { lockTarget: false });
        if (c2 && c2.length) {
          const sc = c2.map(c => ({ c, v: P.value(st2, id, c.key, params, null, c) })).sort((x, y) => y.v - x.v).slice(0, K2);
          let mx = -1, sum = 0;
          for (const s of sc) { const g = outcomeStreams(s.c, st2, contChos, deepFlag, rep, 699); const v = m0(g.win); inner.push(g.win); sum += v; if (v > mx) mx = v; }
          best = mx < 0 ? 0 : mx;
          bestMean = sum / sc.length;
        } else { best = one.win; bestMean = one.win; }
      }
      return contChos[FOCUS](st2, id, legal);
    });
  }
  Play.autoGameN(q, chs);
  deepFlag.v = prevDeep;
  RNGCUR = prevRng2;
  return { win: best === null ? one.win : best, winMean: bestMean === null ? one.win : bestMean, hpTop: one.hpTop, rounds: one.rounds, fellBack: best === null ? 1 : 0, inner };
}
/* §E202 · 在**同一条决策**上按前缀 `r` 重算四个统计量（与全 `REP` 那遍只用同一批流的前 `r` 条）。
 *   ⚠ 平票裁决照抄原实现：`oracle1` 先比 win、再比 hpTop；`oracle2*` 只比 win（严格 `>` ⇒ 取第一个最大）。 */
function aggPrefix(rec, r) {
  const mw = rec.sr.map(x => m0(x.win.slice(0, r))), mh = rec.sr.map(x => m0(x.hpTop.slice(0, r)));
  let bi = 0; for (let i = 1; i < mw.length; i++) if (mw[i] > mw[bi] || (mw[i] === mw[bi] && mh[i] > mh[bi])) bi = i;
  const out = { o1: mw[bi], mine: m0(rec.mineS.win.slice(0, r)), rand: m0(rec.sr[rec.ri].win.slice(0, r)),
    /* §E203 附带：`pool[0]` 就是"网络的 top-1"（`scored` 已按 `P.value` 降序），而臂实际交出去的是**抽样**的那一手
     *   ⇒ `greedy − 臂自己` = "**如果它不抽样、直接取自己打分第一名，能多拿多少**"。这一列**不要一次额外模拟**（数组已在手）。
     *   ⚠ 它是"在同一批 rollout 上的对照"，不是"整局换贪心策略"的读数（后者要重训/重跑对局，语义不同）。 */
    greedy: m0(rec.sr[0].win.slice(0, r)), o2: NaN, o2m: NaN };
  if (rec.r2) {
    let b2 = null, b2m = null;
    for (let i = 0; i < rec.r2.length; i++) {
      const arr = rec.r2[i];
      let v, vm;
      if (arr && arr.length) {
        let mx = -1, sum = 0;
        for (const a of arr) { const x = m0(a.slice(0, r)); sum += x; if (x > mx) mx = x; }
        v = mx < 0 ? 0 : mx; vm = sum / arr.length;
      } else { v = mw[i]; vm = mw[i]; }                      /* 走不到第二手 ⇒ 退回一手值（照 §E199 的处理） */
      if (b2 === null || v > b2) b2 = v;
      if (b2m === null || vm > b2m) b2m = vm;
    }
    out.o2 = b2; out.o2m = b2m;
  }
  return out;
}

function runArm(arm, selfCheck) {
  const a = { arm: arm.key, decisions: 0, candSum: 0, regretWin: [], regretTop: [], randWin: [], mineWin: [], oracleWin: [], oracle1Win: [], oracle2Win: [], oracle2mmWin: [], gap21: [], gap2m: [], fellBack: 0, nRows2: 0, byGame: {}, applied: 0, nApplied: 0, live: 0, nLive: 0, rec: [] };
  for (const env of ENVS) {
    for (let g = 0; g < GAMES; g++) {
      const deep = { v: false };
      const rnd = mulberry32(SEED + g * 7919 + env.name.length * 131);
      const st = S.createState('multi', { next: rnd }, N);
      st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
      const base = arm.mk();
      let n = 0;
      const seatChos = [];
      const focus = function (state, pid, legal) {
        const pick = base(state, pid, legal);
        if (deep.v) return pick;
        n++;
        if (!(state.round <= RMAX && n % EVERY === 0)) return pick;
        if (RESETMEM) B.resetBotMem();       /* §E202 机制检验：母局这一手已经由 `base()` 决定，抹的是 rollout 要用的那份共享记忆 */
        const cands = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false });
        if (!cands || cands.length < 2) return pick;
        a.decisions++; a.candSum += cands.length;
        if (BARE) return pick;                          /* §E204 闭环：只记"这里会采一个决策"，一条 rollout 都不跑 */
        const scored = cands.map(c => ({ c, v: P.value(state, pid, c.key, params, null, c) }));   /* ← 第 6 形参 `cand` 必须传 */
        scored.sort((x, y) => y.v - x.v);
        const pool = scored.slice(0, Math.min(KEEP, scored.length));
        const sr = pool.map(s => outcomeStreams(s.c, state, rollChos, deep, REP, 0));
        const res = sr.map(x => ({ win: m0(x.win), hpTop: m0(x.hpTop), rounds: m0(x.rounds) }));
        if (DUMP && !selfCheck) {
          const xs = P.featuresV7(state, pid);
          for (let i = 0; i < pool.length; i++) {
            ROWS.push(JSON.stringify({ seed: SEED, arm: arm.key, env: env.name, g, n, round: state.round,
              i, key: pool[i].c.key, target: pool[i].c.target == null ? null : pool[i].c.target,
              net: pool[i].v, win: res[i].win, hpTop: res[i].hpTop, rounds: res[i].rounds,
              x: xs.concat(P.actionFeatures(state, pid, pool[i].c.key, pool[i].c)).map(v => Math.round(v * 1e4) / 1e4) }));
          }
        }
        let bi = 0; for (let i = 1; i < res.length; i++) if (res[i].win > res[bi].win || (res[i].win === res[bi].win && res[i].hpTop > res[bi].hpTop)) bi = i;
        /* ⚠ 对照的"随机挑一手"**不许抽 `state.rng`** —— 被测臂自己的温度/ε 采样也抽同一只流（`policy.js:714`），
           一抽就把整局挪到另一条轨迹上（§E191 同族）。改成 `(g,n)` 的确定性函数：每格仍是候选里等可能的一手，
           但不消耗对局的随机流。 */
        const ri = (g * 31 + n * 7 + env.name.length) % res.length;
        const mineS = outcomeStreams(pick, state, rollChos, deep, REP, 0);
        const mine = { win: m0(mineS.win), hpTop: m0(mineS.hpTop), rounds: m0(mineS.rounds) };
        /* §E199：**两手的上限**，与 `res[bi]`（一手上限）、`mine`（臂自己那手）同一批组、同一把延续尺 ⇒ 三行可直接相减。
         *   读法只看一个差：`oracle2 − oracle1` = "**多看一手**到底多买回多少上限" —— 它才是"视界/结算"那条路的价签。 */
        let r2 = null;                                            /* §E202：提到外层，供前缀聚合用（**不要在里面再 `const r2`，那会把它遮蔽成 null**） */
        if (DEPTH2) {
          r2 = pool.map(s => outcomeOf2(s.c, state, pid, rollChos, deep, REP));
          let b2 = 0, b2m = 0;
          for (let i = 1; i < r2.length; i++) { if (r2[i].win > r2[b2].win) b2 = i; if (r2[i].winMean > r2[b2m].winMean) b2m = i; }
          /* `oracle2m` = **只在第一手上做 max**（第二手取均值）⇒ 与 `oracle1` 同样只选一次 ⇒ **这一行才是"多看一手"的净价签**；
             `oracle2` = 两手都取 max ⇒ 多一次"从噪声里挑最大"，只用来量选择膨胀本身。 */
          a.oracle1Win.push(res[bi].win); a.oracle2Win.push(r2[b2m].winMean); a.oracle2mmWin.push(r2[b2].win);
          a.gap21.push(r2[b2m].winMean - res[bi].win); a.gap2m.push(r2[b2m].winMean - mine.win);
          a.fellBack += r2.reduce((p, x) => p + (x.fellBack || 0), 0); a.nRows2 += r2.length;
        }
        a.regretWin.push(res[bi].win - mine.win);
        a.regretTop.push(res[bi].hpTop - mine.hpTop);
        a.randWin.push(res[ri].win - mine.win);
        a.mineWin.push(mine.win); a.oracleWin.push(res[bi].win);
        if (SWEEP.length && !selfCheck) a.rec.push({ sr, mineS, ri, r2: DEPTH2 ? r2.map(x => x.inner) : null });
        /* ⚠ 一局里会采到好几个决策 ⇒ "每个决策独立"会**低估**区间。除了按决策的 CI，另算一条**按局聚类**的：
           先对每局取均值，再对局数取标准误（这才是这个数能不能引的关键，见限制 4）。 */
        const gid = env.name + '#' + g;
        if (!a.byGame[gid]) a.byGame[gid] = [];
        a.byGame[gid].push(res[bi].win - mine.win);
        if (selfCheck) {
          /* ②' **覆盖保真**（不是"必须与不覆盖相同" —— 那条在本尺上不成立，温度采样每批流会自己换一手）：
             直接问引擎"我递交的这一手有没有被记在当回合的动作栏上"（`state.js:227 state.actions[pid] = {key,…}`）。 */
          const probe = S.cloneState(state);
          S.attemptAction(probe, FOCUS, pick.key, { bead: pick.bead || null, target: pick.target == null ? null : pick.target,
            target2: pick.target2 == null ? null : pick.target2 });
          const act = probe.actions && probe.actions[FOCUS];
          a.nApplied++; if (act && act.key === pick.key) a.applied++;
          const worst = outcomeOf(pool[pool.length - 1].c, state, rollChos, deep, REP);
          a.nLive++; if (worst.win !== mine.win || worst.rounds !== mine.rounds) a.live++;
        }
        return pick;
      };
      const mimic = makeMimic(W, HB, 'rand', function () { return (FRESHRNG && RNGCUR ? RNGCUR : st).rng.next(); });
      seatChos.push(mimic, focus, env.sel, env.sel, T.policyChooserN(params, 0.15));
      /* **rollout 的延续席**：默认换成关档包（`--cont=pack`）⇒ 三个臂用**同一把后续尺**，
         量到的才是"根决策那一手"的质量差；`--cont=arm` 留给"臂自己打完全局"那个问题（贵得多，ply2 会乘爆）。 */
      const contFocus = CONT === 'arm' ? focus : T.policyChooserN(params, 0.15);
      const rollChos = seatChos.map(function (c, i) { return i === FOCUS ? contFocus : c; });
      Play.autoGameN(st, seatChos);
    }
  }
  return a;
}

const mean = x => x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / (x.length - 1)); };
const ci95 = x => 1.96 * sd(x) / Math.sqrt(Math.max(1, x.length)) * 100;
console.log('# §E195 近视的代价上限（产品桌 n=5 ‖ 焦点席 1 号 ‖ ' + ENVS.length + ' 环境 × ' + GAMES + ' 局 ‖ 每 ' + EVERY + ' 手采一个 ‖ 回合 ≤' + RMAX
  + ' ‖ 每格向前模拟 ' + KEEP + ' 个候选 × ' + REP + ' 条随机流 ‖ seed ' + SEED + '）');
console.log('# 环境清单（§E202 补：这三行以前只印个数，导致 §E195/§E196/§E200 的命令行**无法复原**）：' + ENVS.map(z => z.name).join(',')
  + (SWEEP.length ? ' ‖ **固定样本前缀扫** rep=' + SWEEP.join('/') : '') + (DEPTH2 ? ' ‖ depth2 k2=' + K2 : '') + ' ‖ cont=' + CONT);
console.log('# ⚠ oracle 是 K 个带运气结果里取最大 ⇒ 天然膨胀；**只有 `regret(oracle) − regret(随机)` 是信号**');
console.log('# ⚠ 这是"一手前瞻 + 现有策略延续"的改进量，**不是**完美价值函数的天花板（限制 1）');
const rows = ARMS.map(k => runArm(mkArm(k), false));
for (const r of rows) {
  const cm = r.candSum / Math.max(1, r.decisions);
  const gw = 100 * mean(r.regretWin), gr = 100 * mean(r.randWin), gt = 100 * mean(r.regretTop);
  console.log('\n· 臂 **' + r.arm + '**：采样 ' + r.decisions + ' 个决策 ‖ 候选数均值 ' + cm.toFixed(1));
  console.log('   ‖ 模拟基线：臂自己那手赢率 ' + (100 * mean(r.mineWin)).toFixed(1) + '% ‖ oracle 那手 ' + (100 * mean(r.oracleWin)).toFixed(1) + '%');
  console.log('   ‖ regret(oracle, win) **' + gw.toFixed(2) + ' ±' + ci95(r.regretWin).toFixed(2) + 'pt**（95% 区间半宽，按决策为独立单元）'
    + ' ‖ regret(随机, win) ' + gr.toFixed(2) + ' ±' + ci95(r.randWin).toFixed(2) + 'pt ‖ **净信号 ' + (gw - gr).toFixed(2) + 'pt**');
  console.log('   ‖ regret(oracle, hpTop) ' + gt.toFixed(2) + ' ±' + ci95(r.regretTop).toFixed(2) + 'pt ‖ "oracle 分高于臂自己那手"的比例 '
    + (100 * r.regretWin.filter(x => x > 0).length / Math.max(1, r.regretWin.length)).toFixed(1) + '%（这是"近视会改手"的频率，与赢率增益是两回事）');
  const gm = Object.keys(r.byGame).map(k => mean(r.byGame[k]));
  console.log('   ‖ **按局聚类**的 95% 区间（' + gm.length + ' 局，每局先取均值）：±' + (1.96 * sd(gm) / Math.sqrt(Math.max(1, gm.length)) * 100).toFixed(2)
    + 'pt ⇒ 两行区间都要看，按决策那行是**下界精度**');
  if (DEPTH2 && r.oracle2Win.length) {
    console.log('   ‖ 一手上限 ' + (100 * mean(r.oracle1Win)).toFixed(1) + '% ‖ **两手上限（只在第一手上取 max，第二手取均值）' + (100 * mean(r.oracle2Win)).toFixed(1)
      + '%** ‖ 两手上限（两手都取 max）' + (100 * mean(r.oracle2mmWin)).toFixed(1) + '% ‖ 臂自己那手 ' + (100 * mean(r.mineWin)).toFixed(1) + '%');
    console.log('   ‖ **`两手 − 一手` = ' + (100 * mean(r.gap21)).toFixed(2) + ' ±' + ci95(r.gap21).toFixed(2) + 'pt**（这一行是"多看一手"的净价签）'
      + ' ‖ `两手 − 臂自己` = ' + (100 * mean(r.gap2m)).toFixed(2) + ' ±' + ci95(r.gap2m).toFixed(2) + 'pt'
      + ' ‖ 选择膨胀（两手都 max − 只第一手 max）= ' + (100 * (mean(r.oracle2mmWin) - mean(r.oracle2Win))).toFixed(2) + 'pt');
    console.log('   ‖ 走不到焦点席第二手而退回一手值的比例 ' + (100 * r.fellBack / Math.max(1, r.nRows2)).toFixed(1) + '%（记 0 会把上限系统性压低，所以退回一手值）');
  }
}
/* ===== §E202 · 固定样本前缀扫的输出 =====
 * 每一列都是**同一批决策**、同一批随机流的**前 `r` 条** ⇒ 列与列之间只剩"估计噪声"这一个差异来源。
 * 输出两样东西：① `regret(oracle)` 随 `r` 的衰减（这次能叫"膨胀曲线"，§E200 那一遍不能）；② `两手 max − 一手` 的前缀曲线 ⇒ 外推到 `1/r → 0` 才是"多规划一手"的净价签。 */
function lsq2(pts, g) {                                     /* y = c + b·g(r)，最小二乘 */
  let n = 0, sg = 0, sg2 = 0, sy = 0, sgy = 0;
  for (const p of pts) { const gv = g(p[0]); n++; sg += gv; sg2 += gv * gv; sy += p[1]; sgy += gv * p[1]; }
  const det = n * sg2 - sg * sg;
  if (!det) return null;
  const c = (sy * sg2 - sg * sgy) / det, b = (n * sgy - sg * sy) / det;
  let rss = 0; for (const p of pts) { const e = p[1] - c - b * g(p[0]); rss += e * e; }
  return { c, b, rss };
}
if (SWEEP.length) {
  for (const r of rows) {
    if (!r.rec.length) continue;
    console.log('\n## §E202 固定样本前缀扫 · 臂 **' + r.arm + '**（**同一批 ' + r.rec.length + ' 个决策**，每列只取前 `r` 条随机流 ‖ 前缀 ' + SWEEP.join('/') + ' ‖ 候选池 ' + KEEP + (DEPTH2 ? ' ‖ 第二手短名单 ' + K2 : '') + '）');
    console.log('| rep | 臂自己那手 | oracle1 | **regret(oracle1)** | regret(随机挑一手) | **greedy(top1)−抽样** | 两手都 max | **两手 max − 一手 max** |');
    console.log('|---|---|---|---|---|---|---|---|');
    const ptsReg = [], ptsGap = [], ptsO2 = [], ptsGreed = [];
    for (const rr of SWEEP) {
      const ag = r.rec.map(x => aggPrefix(x, rr));
      const reg = ag.map(x => x.o1 - x.mine), rnd = ag.map(x => x.rand - x.mine);
      const greed = ag.map(x => x.greedy - x.mine);
      const gap = DEPTH2 ? ag.map(x => x.o2 - x.o1) : [];
      ptsReg.push([rr, 100 * m0(reg)]); ptsGap.push([rr, 100 * m0(gap)]); ptsO2.push([rr, 100 * m0(ag.map(x => x.o2))]); ptsGreed.push([rr, 100 * m0(greed)]);
      console.log('| ' + rr + ' | ' + (100 * m0(ag.map(x => x.mine))).toFixed(1) + '% | ' + (100 * m0(ag.map(x => x.o1))).toFixed(1) + '%'
        + ' | **' + (100 * m0(reg)).toFixed(2) + ' ±' + (1.96 * sd(reg) / Math.sqrt(reg.length) * 100).toFixed(2) + '**'
        + ' | ' + (100 * m0(rnd)).toFixed(2) + ' ±' + (1.96 * sd(rnd) / Math.sqrt(rnd.length) * 100).toFixed(2)
        + ' | ' + (100 * m0(greed)).toFixed(2) + ' ±' + (1.96 * sd(greed) / Math.sqrt(greed.length) * 100).toFixed(2)
        + (DEPTH2 ? ' | ' + (100 * m0(ag.map(x => x.o2))).toFixed(1) + '% | **' + (100 * m0(gap)).toFixed(2) + ' ±' + (1.96 * sd(gap) / Math.sqrt(gap.length) * 100).toFixed(2) + '**' : '') + ' |');
    }
    const inv = x => 1 / x, sqr = x => 1 / Math.sqrt(x);
    const f1 = lsq2(ptsReg, inv), f2 = lsq2(ptsReg, sqr);
    console.log('· **regret(oracle1) 外推到 `1/r → 0`**：`c + b/r` ⇒ **净上限 c = ' + f1.c.toFixed(2) + 'pt**（b=' + f1.b.toFixed(1) + '，RSS=' + f1.rss.toFixed(2) + '）'
      + ' ‖ `c + b/√r` ⇒ c = ' + f2.c.toFixed(2) + '（RSS=' + f2.rss.toFixed(2) + '）');
    const g1 = lsq2(ptsGreed, inv), g2 = lsq2(ptsGreed, sqr);
    console.log('· **抽样 vs 贪心（`greedy(网络 top1) − 臂自己那手`）外推**：`c + b/r` ⇒ c = ' + g1.c.toFixed(2) + 'pt（RSS=' + g1.rss.toFixed(2) + '）'
      + ' ‖ `c + b/√r` ⇒ c = ' + g2.c.toFixed(2) + '（RSS=' + g2.rss.toFixed(2) + '）'
      + ' ⇒ 这是"焦点席那 0.15 温度赔掉多少"的读数（⚠ **同一批 rollout 上的对照**，不是"整局换成贪心"的读数 —— 后者会改它对对手的激励，要重跑对局才算）');
    if (DEPTH2) {
      const d1 = lsq2(ptsGap, inv), d2 = lsq2(ptsGap, sqr);
      console.log('· **多规划一手（两手 max − 一手 max）外推**：`c + b/r` ⇒ **Δ = ' + d1.c.toFixed(2) + 'pt**（b=' + d1.b.toFixed(1) + '，RSS=' + d1.rss.toFixed(2) + '）'
        + ' ‖ `c + b/√r` ⇒ Δ = ' + d2.c.toFixed(2) + '（RSS=' + d2.rss.toFixed(2) + '） ‖ 两手上限本身 c(o2) = ' + lsq2(ptsO2, inv).c.toFixed(1) + '%');
      console.log('  读法：Δ 是"**在同一把延续尺上，把偏离深度从一手加到两手**"多买回的上限 ⇒ 若 Δ 明显小于 `regret(oracle1)`，那"换代"的钱就不在深度里；若 Δ 与之一样大，说明**视界**才是主缺口。');
    }
    console.log('  ⚠ 外推前提：膨胀只随 `r` 变。这次五个点是**同一批决策**（§E200 那遍不是），所以曲线只剩估计噪声；但 `keep=' + KEEP + '` 的池子组成仍是同一份 ⇒ 它外推的是"这一批决策上的膨胀"，不是所有配置。');
  }
}
/* 自检遍只证"强制有牙"，不证精度 ⇒ `--sweep` 时把它压到 3 条流（否则 rep=16 的主遍要再跑一整遍，白付一倍机器时间）。
 * ⚠ 只在 `--sweep` 下压：不带 sweep 时自检仍按用户给的 `rep` 跑 ⇒ §E195/§E196/§E199 那种日志的自检行逐字不变。 */
const REP_MAIN = REP;
if (SWEEP.length) REP = Math.min(REP, 3);
const chk = runArm(mkArm('A0'), true);
REP = REP_MAIN;
console.log('\n## 自检（覆盖通路必须是活的）');
console.log('· ①强制最差候选后结局（赢率或局长）发生变化：**' + chk.live + '/' + chk.nLive + '**'
  + (chk.live === 0 ? ' ⇒ ⛔ 覆盖根本没进引擎，上面所有 regret 都是假的（§E192 那条"静默等效"的形状）' : ' ✔'));
console.log('· ②递交的动作被引擎记进当回合动作栏（`state.actions[焦点席].key` 相等）：**' + chk.applied + '/' + chk.nApplied + '**'
  + (chk.applied === chk.nApplied ? ' ✔' : ' ⇒ ⛔ 有 ' + (chk.nApplied - chk.applied) + ' 次覆盖没被接受，oracle 那手可能根本没打出来'));
console.log('· ③候选数均值 ' + (rows[0].candSum / Math.max(1, rows[0].decisions)).toFixed(1) + '、采样 ' + rows.reduce((p, q) => p + q.decisions, 0) + ' 个'
  + (rows[0].candSum / Math.max(1, rows[0].decisions) > 1.5 ? ' ✔（有选择余地）' : ' ⇒ ⛔ 没有余地，regret 无从谈起'));
if (DUMP) {
  writeFileSync(DUMP, ROWS.join('\n') + '\n');
  console.log('· 导出 **' + ROWS.length + ' 行**（决策 × 候选）到 `' + DUMP + '` ‖ 每行 x 长度 ' + (ROWS.length ? JSON.parse(ROWS[0]).x.length : 0));
}
console.log('rc=0');
