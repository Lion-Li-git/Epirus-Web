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
rejectUnknownFlags(argv, ['envs', 'games', 'every', 'rmax', 'keep', 'rep', 'arm', 'cont', 'seed', 'dump', 'selfcheck'], 'probe-myopia-regret');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const GAMES = Math.max(1, Number(arg('games', 10)) || 10);
const EVERY = Math.max(1, Number(arg('every', 6)) || 6);
const RMAX = Math.max(1, Number(arg('rmax', 8)) || 8);
const KEEP = Math.max(2, Number(arg('keep', 6)) || 6);
const REP = Math.max(1, Number(arg('rep', 4)) || 4);            /* 每一手用几条随机流重放（regret 是期望差，不是 0/1 差） */
const SEED = Number(arg('seed', 4100)) || 4100;
const ENV_PICK = String(arg('envs', 'aggro,wall,antidef,tankline,random,mix')).split(',').filter(Boolean);
const ARMS = String(arg('arm', 'A0,B1,B2')).split(',').filter(x => x === 'A0' || x === 'B1' || x === 'B2');
const CONT = arg('cont', 'pack');                                              /* rollout 延续席：pack = 三臂同一把尺 */
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
  deepFlag.v = true;                                    /* rollout 内部不再采样（否则递归爆炸 + 统计污染） */
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
  deepFlag.v = false;
  const me = q.p[FOCUS];
  let hpTop = 0;
  if (me && me.hp > 0) { hpTop = 1; for (let i = 0; i < N; i++) if (i !== FOCUS && q.p[i].hp > me.hp) { hpTop = 0; break; } }
  return { win: q.winner === FOCUS ? 1 : 0, hpTop, rounds: q.round };
}
function outcomeOf(cand, state, seatChos, deepFlag, rep) {
  let win = 0, top = 0, rounds = 0;
  for (let k = 0; k < rep; k++) { const r = playRollout(state, seatChos, cand, deepFlag, k + 1); win += r.win; top += r.hpTop; rounds += r.rounds; }
  return { win: win / rep, hpTop: top / rep, rounds: rounds / rep };
}

function runArm(arm, selfCheck) {
  const a = { arm: arm.key, decisions: 0, candSum: 0, regretWin: [], regretTop: [], randWin: [], mineWin: [], oracleWin: [], byGame: {}, applied: 0, nApplied: 0, live: 0, nLive: 0 };
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
        const cands = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false });
        if (!cands || cands.length < 2) return pick;
        a.decisions++; a.candSum += cands.length;
        const scored = cands.map(c => ({ c, v: P.value(state, pid, c.key, params, null, c) }));   /* ← 第 6 形参 `cand` 必须传 */
        scored.sort((x, y) => y.v - x.v);
        const pool = scored.slice(0, Math.min(KEEP, scored.length));
        const res = pool.map(s => outcomeOf(s.c, state, rollChos, deep, REP));
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
        const mine = outcomeOf(pick, state, rollChos, deep, REP);
        a.regretWin.push(res[bi].win - mine.win);
        a.regretTop.push(res[bi].hpTop - mine.hpTop);
        a.randWin.push(res[ri].win - mine.win);
        a.mineWin.push(mine.win); a.oracleWin.push(res[bi].win);
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
      const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
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
}
const chk = runArm(mkArm('A0'), true);
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
