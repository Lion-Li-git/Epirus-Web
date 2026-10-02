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
rejectUnknownFlags(argv, ['envs', 'games', 'every', 'rmax', 'keep', 'rep', 'arm', 'cont', 'config', 'seed', 'dump', 'dumpcover', 'depth2', 'k2', 'selfcheck', 'sweep', 'resetmem', 'freshrng', 'freshseats', 'allowrngleak', 'memisolate', 'bare', 'cover'], 'probe-myopia-regret');
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
const SWEEP = [...new Set(String(arg('sweep', '')).split(',').map(x => Math.floor(Number(x))).filter(x => x >= 1))].sort((a, b) => a - b);
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
let FRESHRNG = true;   /* 10-01（DS）：**默认开隔离** —— 见下方 ALLOW_LEAK 那段说明 */
/* §E209 `--freshseats`：§E204 修掉了"共享 `rng`"这条主通道，但**采样决策数仍比零 rollout 的参照少/多 3 个**（98 ‖ 95）。
 *   剩下的候选通道 = 席选择器本身带的**可变状态**（`makeMimic` 里那份人类形状记忆、`bots.js` 的 `__mem`/`__pbMem`）
 *   ⇒ 打开这一档后，每次 rollout **现造一套席**（mimic 历史从空开始）。若采样数回到 95 ⇒ 第三条通道就是它；
 *   若仍停在 98 ⇒ 通道在别处（`env.sel` / 引擎里的模块级缓存），要继续找，不许把"已修"写成"修完了"。*/
const FRESHSEATS = argv.includes('--freshseats');
/* §E209 `--memisolate`：主通道（共享 `rng`，§E204）之外还剩一条 = `bots.js:50` 那份**模块级跨回合记忆**。
 *   rollout 会把**自己的回合号**写进 `lastDefRound`，母局回到第 5 手时看到"19 回合刚防过"⇒ `(5-19)<=2` 成立 ⇒ 判断被别的轨迹污染。
 *   `--resetmem` 只"抹"不"还原"（连母局自己的真历史一起抹掉），所以它只能部分改善；这一档是**快照 + 恢复**。*/
const MEMISO = argv.includes('--memisolate');
/* §E204 留下的那一格（"只证了与 `rep` 无关，没证等于零 rollout 的干净轨迹"）的**闭环工具**：
 *   `--bare` 只数"哪些决策会被采到"，**一条 rollout 都不跑** ⇒ 它的采样数就是"零扰动轨迹"的那个数。
 *   ⇒ 判据：`--bare` 的采样数 == `--freshrng` 各 `rep` 档的采样数 ⇒ 那条轨迹真的被还原了；
 *      不相等 ⇒ 还有残余通道（`__mem` 那一类），并且差值本身量出"残余有多大"。 */
const BARE = argv.includes('--bare');
const ALLOW_LEAK = argv.includes('--allowrngleak');
/* ===== §E215 · 入围覆盖率（任务 #61）=====
 * 病（我今天的漏）：`oracle` 一直是**网络短名单 `pool`（前 `KEEP` 名）内部**取最大 ⇒ 如果真最优常常压根不在名单里，
 *   那么"换个更贵的评估器"这条路的钱**一分都拿不到**，而这件事我从来没量过。
 * `--cover=1` = 对**全部候选**（实测均值 ~23 名）都跑同样 `REP` 条流，问两个数：
 *   ① P(真最优 ∈ 前 k 名)（k = KEEP / 8 / 12）；② 名单放宽后上限本身抬多少 pt。
 * ⚠ 两条内置对照，缺一条这两个数都不能引：
 *   · **随机短名单** `detSalt`（确定性、不抽 `state.rng`）同尺寸取 max ⇒ `full − randK` 就是"池子变大本身的选取膨胀"；
 *     真信号只看 `rise_topK − rise_randK`（= `topK − randK`），绝对 `rise` 一律不引（§E200/§E203 同一族）。
 *   · **地板** `mean(k/n)`：入围若与真最优无关，覆盖率就该是这个数。
 * ⚠ 只在**采样分支的最末尾**跑（`mineS`/`depth2`/自检全部算完之后）⇒ 关掉时逐字不变，打开时也不许动旧读数（用采样数复验）。 */
const COVER = Math.max(0, Number(arg('cover', 0)) || 0) > 0;
const COVER_KS = [8, 12].filter(k => k > KEEP);
/* ===== 10-01（DS · 接千问 §E209 的"残余扰动"）：**默认必须开 rng 隔离，否则响亮拒绝** =====
 * 事实（代码级，我核过）：`js/core/state.js:236` 的 `cloneState` **复用同一个 rng 对象**（`c.rng = s.rng`，为免崩溃）；
 *   `playRollout`（:125-126）**已经**给 clone 换了一条自己的确定性流，**但**引擎的抽取走**模块级栈顶 `RNGCUR`**，
 *   而这里**只在 `--freshrng` 打开时**才把栈顶换成那只 clone（:129-130）⇒ **不开时 rollout 从母局那条流里抽**，
 *   扰动幅度随 `rep` 增长 —— 这正是 §E209 观察到的 366(rep=8) / 355(rep=2) / 356(零 rollout 参照) 的**同一件事**。
 * ⇒ 本仪器**默认开** `--freshrng`；**要故意不隔离**必须显式 `--allowrngleak`（并会在表头留痕）。
 *   ⚠️ 只动**研究侧量具**，出厂路径（`js/*`）一行未动。 */
const FRESHRNG_ORIG = FRESHRNG;
if (!argv.includes('--freshrng') && ALLOW_LEAK) FRESHRNG = false;   /* 显式要求不隔离才关 */

/* §E197 用的**导出**：`--dump=<path>` 把"每个采样决策 × 每个候选"的**现有 235 维特征 + 模拟赢率标签**落成 JSONL。
 *   ⇒ 为什么要在这里导出而不是另写一台采集器：**rollout 的算术只能有一份**（本仓"两份同构实现必漂移"的老病），
 *     而"上限能不能被一个可学的头拿到"必须用**同一批标签**来问，否则两边的 regret 不可比。
 *   ⚠ 只在非自检遍里落行（自检遍会把 A0 再跑一遍，行会重复）。 */
const DUMP = arg('dump', '');
/* ===== §E223 的原料：把**教师标签**落盘（`--dumpcover=<path>`，默认不写）=====
 * 为什么不另写一台采集器：rollout 的算术只能有一份（本仓"两份同构实现必漂移"的老病），而"搜索的偏好能不能被这张脸学到"
 * 必须用**同一批标签**来问。每行 = 一个采样决策：状态向量存一份 + 每候选一份动作向量 + 该候选的模拟赢率均值 + 逐流 0/1。
 *   ⇒ 逐流数组留着是为了算**教师自己的分半一致率**（= 可学性的天花板；没有它我会把"教师噪声"误读成"脸不行"）。
 * ⚠ 只读引擎、不改任何出厂路径；默认关（不带旗标 ⇒ 一行都不写）。 */
const DUMPCOVER = arg('dumpcover', '');
const CROWS = [];
const ROWS = [];

const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENVS = ENV_PICK.map(n => { const q = POOL.find(z => z.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return q; });
const HB = loadPool(W, 'human');
/* ===== `--config=<mode>/<人数>`（§E230 · 10-02）：**把"环境"从对手身份换成游戏配置** =====
 *   动因：DS 的 v1.5.315/316 在**配置轴**上量到"血量是一根会重排策略的真轴（ρ≈0.09 vs 人数轴 0.77）、
 *   但按配置在 6 枚笨探针里挑只值 +0.1pt（样本外）"⇒ **真上界没量过**。要量它必须让这台仪器能在
 *   `long`（5 珠血量）这类配置下重跑同一套 regret 算术 ⇒ **只动建局那一行 + dump 里存一个 `cfg` 字段**，
 *   采样分支 / rollout / 选择膨胀的口径**一律不碰**（一次对照只能一个自由量，§E194）。
 *   ⚠ **默认 `multi/5` 必须与加这一档之前逐字相同**（心跳：小配置下与 `HEAD` 版 `diff` 全空，见 §E230 记录）。
 *   ⚠ `mode` 必须是 `RUL.MODES` 的键、人数 3–5（产品桌 n=5 装配的席位表就三枚原型/冠军席，截短时按座位切）。 */
const CFG = String(arg('config', 'multi/5'));
const CFG_MODE = CFG.split('/')[0] || 'multi';
const N = Math.max(3, Math.min(5, Number(CFG.split('/')[1]) || 5));
if (!W.EpirusRules.MODES || !W.EpirusRules.MODES[CFG_MODE]) {
  console.error('⛔ `--config` 的 mode `' + CFG_MODE + '` 不在 `MODES` 里（可用：' + Object.keys(W.EpirusRules.MODES || {}).join(',') + '）'); process.exit(2);
}
const FOCUS = 1;

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
  /* §E209 `--freshseats`：席选择器集合可以是**工厂**（每次 rollout 现造一套 ⇒ mimic 的历史不跨 rollout 串味） */
  const base = typeof seatChos === 'function' ? seatChos() : seatChos;
  const q = S.cloneState(state);
  q.rng = { next: mulberry32((((state.round | 0) + 1) * 2654435761 + FOCUS * 7919 + streamId * 104729) >>> 0) };
  const prevDeep = deepFlag.v;                          /* ⚠ 必须**恢复**而不是置 false：嵌套 rollout 会把外层标志抹掉 */
  deepFlag.v = true;
  const prevRng = RNGCUR;                               /* §E204：同一族处理 —— 栈顶换成这只 clone，出去再恢复 */
  if (FRESHRNG) RNGCUR = q;
  const chs = [];
  for (let i = 0; i < N; i++) {
    if (i !== FOCUS || forced === null) { chs.push(base[i]); continue; }
    let used = false;
    chs.push(function (st2, pid, legal) {
      if (used) return base[FOCUS](st2, pid, legal);
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
function outcomeOf2(a1, state, pid, contChos, deepFlag, rep, SINK) {
  const one = outcomeOf(a1, state, contChos, deepFlag, rep);      /* 一手值（也用作"走不到第二手"的退回值） */
  /* §E209 `--freshseats`：`contChos` 可能是工厂。上面那次一手游玩已经用它造过一套；这一层自己要用 `contChos[i]`
   *   ⇒ **先物化一套**，本层的第二手 rollout 沿用同一套（要"每个内层 rollout 也换一套"就得把工厂传到底，这里不必）。 */
  if (typeof contChos === 'function') contChos = contChos();
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
          const xs2 = SINK ? P.featuresV7(st2, id) : null;         /* §E205：第二手那一层的**状态**特征（213 维） */
          let mx = -1, sum = 0;
          for (const s of sc) { const g = outcomeStreams(s.c, st2, contChos, deepFlag, rep, 699); const v = m0(g.win); inner.push(g.win); sum += v; if (v > mx) mx = v;
            if (SINK) SINK.push({ x: xs2.concat(P.actionFeatures(st2, id, s.c.key, s.c)), win: v, net: s.v, key: s.c.key });
          }
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
  const a = { arm: arm.key, decisions: 0, candSum: 0, regretWin: [], regretTop: [], randWin: [], mineWin: [], oracleWin: [], oracle1Win: [], oracle2Win: [], oracle2mmWin: [], gap21: [], gap2m: [], fellBack: 0, nRows2: 0, byGame: {}, applied: 0, nApplied: 0, live: 0, nLive: 0, rec: [],
    covRec: [] };
  for (const env of ENVS) {
    for (let g = 0; g < GAMES; g++) {
      const deep = { v: false };
      const rnd = mulberry32(SEED + g * 7919 + env.name.length * 131);
      const st = S.createState(CFG_MODE, { next: rnd }, N);
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
        /* §E209b：窗口要盖住**整个采样分支里的所有 rollout**，不是只盖候选那一轮。
         *   原来只在 `pool.map` 外面快照/还原，漏了下面的 `mineS`（母局自己那手也重放 REP 条流，**每个采样决策都跑**）
         *   与 `--depth2` 的内层 ⇒ 漏出去的污染正比于 REP ⇒ 这正好是"355@rep2 / 366@rep8"那点随 rep 增长的残余。 */
        const memSnap = MEMISO ? B.snapshotBotMem() : null;
        const sr = pool.map(s => outcomeStreams(s.c, state, rollChos, deep, REP, 0));
        const res = sr.map(x => ({ win: m0(x.win), hpTop: m0(x.hpTop), rounds: m0(x.rounds) }));
        if (DUMP && !selfCheck) {
          const xs = P.featuresV7(state, pid);
          for (let i = 0; i < pool.length; i++) {
            ROWS.push(JSON.stringify({ seed: SEED, arm: arm.key, lvl: 1, env: env.name, g, n, round: state.round,
              pk: env.name + '#' + g + '#' + n,
              i, key: pool[i].c.key, target: pool[i].c.target == null ? null : pool[i].c.target,
              net: pool[i].v, win: res[i].win, hpTop: res[i].hpTop, rounds: res[i].rounds,
              /* §E208：另存**逐流**的 0/1 数组 ⇒ 分析器能做"分半稳定性"检验（同一格的前半流与后半流各挑一次最优，
               *   两边挑到同一手的比例 = 这份标签到底把"哪手更好"定死了没有）。只加字段，默认分析器不读 ⇒ 旧读数逐字不变。 */
              winS: sr[i].win,
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
          const sink = DUMP && !selfCheck ? [] : null;             /* §E205：第二手那一层的 (状态×动作) → 真赢率 标签 */
          r2 = pool.map((s, ii) => {
            const local = sink ? [] : null;
            const o = outcomeOf2(s.c, state, pid, rollChos, deep, REP, local);
            if (sink) for (const row of local) sink.push({ i: ii, row: row, pk: env.name + '#' + g + '#' + n + '#' + ii });
            return o;
          });
          if (sink) for (const s2 of sink) ROWS.push(JSON.stringify({ seed: SEED, arm: arm.key, lvl: 2, pk: s2.pk, i: s2.i,
            key: s2.row.key, net: s2.row.net, win: s2.row.win, x: s2.row.x.map(v => Math.round(v * 1e4) / 1e4) }));
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
        if (COVER && !selfCheck) {
          /* 放在**整条采样分支的最末尾**：`mineS`、`r2`、自检都已经算完 ⇒ 这一档不可能改动任何旧读数
             （唯一的例外是 mimic 席的 `__pbMem` 被多喂了几条流；§E209b 已证它按回合自愈，且实测开/关两遍除新行外逐字相同）。 */
          const nAll = scored.length;
          const tail = [];
          for (let i = KEEP; i < nAll; i++) tail.push(outcomeStreams(scored[i].c, state, rollChos, deep, REP, 0));
          /* ⚠ 存**逐流 0/1 数组**而不是存均值：覆盖率 = 在 n 个带噪估计里挑最大 ⇒ `REP` 越小噪声把它推向名单外推得越狠
             （§E200/§E203 那一族的"选取膨胀"在这里换了个方向出现）。存了逐流就能**按前缀重算**，
             于是"覆盖率随 `rep` 抬不抬"当场可分：抬 = 主要是标签噪声，不抬 = 主要是入围真漏了。 */
          a.covRec.push({ gid: gid, salt: ((g + 1) * 2654435761 ^ (n + 1) * 40503) >>> 0, n: nAll, trunc: nAll > KEEP ? 1 : 0, ks: [KEEP].concat(COVER_KS),
            keys: scored.map(x => x.c.key),
            /* §E219：卡名 + 臂自己那手的赢率一并存下来 ⇒ **不用多跑一条 rollout** 就能问
               "被网络排在第 7 名之后的那些卡，按模拟赢率到底比它实际打的那一手好多少"（逐决策配对、同一批流）。 */
            mineKey: (pick && pick.key) || null, mineWin: mine.win, mineHp: mine.hpTop,
            w: sr.map(x => x.win).concat(tail.map(x => x.win)),
            h: sr.map(x => x.hpTop).concat(tail.map(x => x.hpTop)) });
          if (DUMPCOVER) {
            /* 状态向量一决策存一份（各候选共用）⇒ 文件从 ~30MB 降到 ~3MB，且不丢任何信息。 */
            const r4 = v => Math.round(v * 1e4) / 1e4;
            const xs = P.featuresV7(state, pid);
            CROWS.push(JSON.stringify({
              seed: SEED, env: env.name, g: g, n: n, round: state.round, keep: KEEP, rep: REP, cfg: CFG,
              s: xs.map(r4),
              k: scored.map(o => o.c.key),
              a: scored.map(o => P.actionFeatures(state, pid, o.c.key, o.c).map(r4)),
              net: scored.map(o => r4(o.v)),
              /* 逐流 0/1 全存 ⇒ 分析器能算"教师分半一致率"（可学性天花板）与任意 rep 档 */
              w: sr.map(x => x.win).concat(tail.map(x => x.win)),
              hp: sr.map(x => x.hpTop).concat(tail.map(x => x.hpTop)),
              mine: (pick && pick.key) || null, mineWin: r4(mine.win)
            }));
          }
        }
        if (MEMISO) B.restoreBotMem(memSnap);          /* §E209b：还原点挪到**离开采样分支之前**（候选轮 + mineS + depth2 + 自检全都围住） */
        return pick;
      };
      const mkMimic = function () { return makeMimic(W, HB, 'rand', function () { return (FRESHRNG && RNGCUR ? RNGCUR : st).rng.next(); }); };
      const mimic = mkMimic();
      seatChos.push(mimic, focus, env.sel, env.sel, T.policyChooserN(params, 0.15));
      /* **rollout 的延续席**：默认换成关档包（`--cont=pack`）⇒ 三个臂用**同一把后续尺**，
         量到的才是"根决策那一手"的质量差；`--cont=arm` 留给"臂自己打完全局"那个问题（贵得多，ply2 会乘爆）。 */
      const contFocus = CONT === 'arm' ? focus : T.policyChooserN(params, 0.15);
      const rollChos = FRESHSEATS
        ? function () { const c = seatChos.slice(); c[FOCUS] = contFocus; c[0] = mkMimic(); return c; }
        : seatChos.map(function (c, i) { return i === FOCUS ? contFocus : c; });
      Play.autoGameN(st, seatChos.slice(0, N));      /* 默认 N=5 ⇒ 与原来那枚数组逐元素相同（席位顺序不动，焦点席仍是 1 号） */
    }
  }
  return a;
}

const mean = x => x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / (x.length - 1)); };
const ci95 = x => 1.96 * sd(x) / Math.sqrt(Math.max(1, x.length)) * 100;
/* ===== §E215 的一条决策记录 → 三种入围规则各自挑到的那一手（前 `rep` 条流上取 max）=====
 * ⚠ **平手必须与候选顺序无关**：第一版沿用主口径那条 `>` 扫描（平手时保留先出现的），而"先出现"恰好就是**网络排名第 1**
 *   ⇒ 覆盖率被"入围顺序"自己虚高（实测 rep=4→8 从 64.3% 掉到 42.9% 就是它：流越多平手越少，虚高退得越多）。
 *   现在平手用 `(决策盐 × 候选序号)` 的确定性哈希破 —— 与网络排名无关、也不抽 `state.rng`（§E191 同族），并**把平手率印出来**。
 * ⚠ 这里"前 6 名的 max"可能与主表 `oracle 那手`差一两格（主表用老的"先出现者胜"）⇒ 差值只在本表内部比。 */
function covRow(rec, rep, ks) {
  const v = rec.w.map(a => m0(a.slice(0, rep))), vh = rec.h.map(a => m0(a.slice(0, rep)));
  const key = i => ((rec.salt ^ Math.imul(i + 1, 2654435761)) >>> 0);
  const best = idxs => { let b = idxs[0];
    for (let t = 1; t < idxs.length; t++) { const i = idxs[t];
      if (v[i] > v[b] || (v[i] === v[b] && (vh[i] > vh[b] || (vh[i] === vh[b] && key(i) < key(b))))) b = i; }
    return b; };
  const all = rec.w.map((_, i) => i);
  const bAll = best(all);
  let tie = 0; for (const i of all) if (v[i] === v[bAll] && vh[i] === vh[bAll]) tie++;
  const per = ks.map(k => {
    const bNet = best(all.slice(0, Math.min(k, rec.n))), bRand = best(detSalt(rec.n, k, rec.salt));
    return { k: k, vNet: v[bNet], vRand: v[bRand], hit: bAll < k ? 1 : 0, floor: Math.min(k, rec.n) / rec.n };
  });
  /* ⚠ `tie` 是"**全表 max 有没有并列**"，所以它只与 `bAll` 有关 ⇒ 上面那句"并列偏向谁"必须与候选顺序无关，
     否则 `hit` 会被网络排名自己抬高（第一版就是这么虚高的，见 §E215 §4）。 */
  return { bAll: bAll, per: per, vAll: v[bAll], tie: tie > 1, n: rec.n };
}
/* 确定性随机短名单对照：**不抽 `state.rng`**（§E191 同族），按 `(决策盐 × 候选序号)` 的 32 位哈希排序取前 k 名。
 * 同一格两次调用结果相同 ⇒ 与"网络前 k 名"是同一批候选、同一批流上的配对比较。
 * §E215 补：盐 = `(g+1)*2654435761 ^ (n+1)*40503`（与第一版 `(g,n,i)` 式子**逐位相同**，只是把序号那项留给 `key`）⇒
 *   k=6/8/12 是**同一个排序的前 k 名**（嵌套）⇒ "名单放宽一档"这件事本身不带新随机。 */
function detSalt(n, k, salt) {
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  const key = i => ((salt ^ ((i + 1) * 2246822519)) >>> 0);
  idx.sort((a, b) => key(a) - key(b));
  return idx.slice(0, Math.min(k, n));
}
console.log('# §E195 近视的代价上限（产品桌 n=5 ‖ 焦点席 1 号 ‖ ' + ENVS.length + ' 环境 × ' + GAMES + ' 局 ‖ 每 ' + EVERY + ' 手采一个 ‖ 回合 ≤' + RMAX
  + ' ‖ 每格向前模拟 ' + KEEP + ' 个候选 × ' + REP + ' 条随机流 ‖ seed ' + SEED + '）');
console.log('# 环境清单（§E202 补：这三行以前只印个数，导致 §E195/§E196/§E200 的命令行**无法复原**）：' + ENVS.map(z => z.name).join(',')
  + (SWEEP.length ? ' ‖ **固定样本前缀扫** rep=' + SWEEP.join('/') : '') + (DEPTH2 ? ' ‖ depth2 k2=' + K2 : '') + ' ‖ cont=' + CONT
  + ' ‖ **flags**：freshrng=' + (FRESHRNG ? 'ON' : 'off') + ' freshseats=' + (FRESHSEATS ? 'ON' : 'off') + ' resetmem=' + (RESETMEM ? 'ON' : 'off')
  + ' memisolate=' + (MEMISO ? 'ON' : 'off') + ' bare=' + (BARE ? 'ON' : 'off') + ' cover=' + (COVER ? 'ON' : 'off'));
/* ⚠ **只在非默认配置时多印这一行** ⇒ 默认 `multi/5` 的输出与加这一档之前**逐字相同**（少印一行也算不等价，所以不能无条件印）。 */
if (CFG !== 'multi/5') {
  console.log('# ⚠ 本遍**换了配置**：`--config=' + CFG + '` ‖ mode `' + CFG_MODE + '` 血量 **' + W.EpirusRules.MODES[CFG_MODE].hp + ' 珠** ‖ 席位 ' + N +
    '（默认 = `multi/5`，血量 ' + W.EpirusRules.MODES.multi.hp + ' 珠）');
  console.log('#   ⇒ 这一遍的**绝对电平与配对差都只在配置内部可比**（§E202/§E204"绝对电平一律不引"在这一档升级成"跨配置一律不引"）；' +
    '跨配置可比的只有**同一个量各自的值**（如"该配置下 一手完美净上限"）。');
}
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
  /* ===== §E215 · 入围覆盖率（任务 #61）：oracle 一直只在"网络前 KEEP 名"里取最大，这一档问"名单本身漏了多少" =====
   * ⚠ 两条绝对数都**不许单独引**：`全表 − 前 k` 里混着"池子变大 → max 天然更高"的选取膨胀（§E200/§E203 同一族）。
   *   能引的只有同尺寸的**配对对照**：`前 k 名的 max` vs `随机 k 名的 max`（同一批候选、同一批流）。 */
  if (COVER && r.covRec.length) {
    /* ⚠ 这一档问的是"**入围**漏了多少"，与"排序对不对"（§E197）是两件事：`scored` 用的是冠军包的 `P.value`，
       与臂无关 ⇒ 三个臂的短名单**同一份** ⇒ 默认只需跑 `--arm=A0`（省 3 倍），别把三行读成三个证据。 */
    const ALL = r.covRec, TR = ALL.filter(x => x.trunc);
    const L = ALL[0].w[0].length, ks = ALL[0].ks;
    const PRE = [4, 8, 16, 32].filter(v => v <= L).concat([L]).filter((v, i, a) => a.indexOf(v) === i);
    console.log('   ‖ **§E215 入围覆盖**：候选数均值 ' + mean(ALL.map(x => x.n)).toFixed(1)
      + ' ‖ "候选本来就不超过 ' + KEEP + ' 名"（结构上没有名单外 ⇒ 覆盖率恒为 100%）的决策 '
      + (100 * ALL.filter(x => !x.trunc).length / ALL.length).toFixed(1) + '%（n=' + ALL.length + '）⇒ 合池那档会被这批无外格抬虚，两档都印');
    for (const seg of [['全部采样决策', ALL], ['只看有名单外的（候选 > ' + KEEP + '）', TR]]) {
      const tag = seg[0], set = seg[1];
      if (!set.length) { console.log('     · ' + tag + '：**0 格** ⇒ 不给数'); continue; }
      console.log('     · **' + tag + '**（n=' + set.length + ' ‖ 候选数均值 ' + mean(set.map(x => x.n)).toFixed(1)
        + '）‖ 每行只在**前 `rep` 条流**上取 max（同一批决策、嵌套前缀 ⇒ 行与行只差标签噪声）');
      console.log('       rep │ 平手率 │ 上限win 前' + KEEP + '/随机' + KEEP + '/全表 │ 每个 k 一组：**覆盖率 ‖ 该 k 自己的地板 ‖ 同尺寸配对（网络前 k − 随机 k）**');
      for (const rep of PRE) {
        const R = set.map(x => covRow(x, rep, ks));
        const U = R.filter(o => !o.tie);
        const cols = ks.map((k, j) => {
          const hit = R.map(o => o.per[j].hit), fl = R.map(o => o.per[j].floor), pr = R.map(o => o.per[j].vNet - o.per[j].vRand);
          return 'k=' + k + ' 覆盖 **' + (100 * mean(hit)).toFixed(1) + '±' + ci95(hit).toFixed(1) + '%**（地板 ' + (100 * mean(fl)).toFixed(1)
            + '%' + (U.length ? ' ‖ 无平手 ' + U.length + ' 格：' + (100 * mean(U.map(o => o.per[j].hit))).toFixed(1) + '%' : '')
            + '）‖配对 ' + (100 * mean(pr)).toFixed(2) + '±' + ci95(pr).toFixed(2) + 'pt';
        });
        console.log('       ' + rep + ' │ ' + (100 * mean(R.map(o => (o.tie ? 1 : 0)))).toFixed(1) + '% │ '
          + (100 * mean(R.map(o => o.per[0].vNet))).toFixed(1) + '/' + (100 * mean(R.map(o => o.per[0].vRand))).toFixed(1) + '/'
          + (100 * mean(R.map(o => o.vAll))).toFixed(1) + ' │ ' + cols.join(' ┊ '));
      }
      { const rep = PRE[PRE.length - 1];
        const R = set.map(x => covRow(x, rep, ks));
        const gk = {}; for (let i = 0; i < set.length; i++) { (gk[set[i].gid] = gk[set[i].gid] || []).push(R[i].per[0].vNet - R[i].per[0].vRand); }
        const gm = Object.keys(gk).map(k2 => mean(gk[k2]));
        console.log('       ‖ 配对(k=' + KEEP + ') 按**局**聚类的区间（' + gm.length + ' 局，每局先取均值）：±'
          + (1.96 * sd(gm) / Math.sqrt(Math.max(1, gm.length)) * 100).toFixed(2) + 'pt ⇒ 表里那行按决策为独立单元，是**下界精度**');
      }
      console.log('       ⚠ "全表 − 前 ' + KEEP + ' 名"那类**绝对抬升含选取膨胀**（池子从 ' + KEEP + ' 名变 ' + mean(set.map(x => x.n)).toFixed(0)
        + ' 名，max 天然更高）⇒ 只能与"随机 ' + KEEP + ' 名 → 全表"同尺寸对照一起读，单看那一列会把噪声当钱（§E200/§E203 同族）。');
    }
    /* ===== §E219 · 被网络排在门外的**具体是哪几张卡、每张值多少**（同一批流、逐决策配对 ⇒ 零额外 rollout） =====
     * §E215 只回答"前 6 名整体兜不兜得住真最优"（答：≈随机）。这一档把它**拆到卡**：
     *   每张卡取"它在这一格里能拿到的最好目标"（该卡所有候选里模拟赢率最高的那个）⇒
     *   `Δvs臂自己` = 该卡 − 臂实际打的那手 ‖ `Δvs短名单上限` = 该卡 − 前 6 名里的最大者。
     *   后一列为负 ⇒ **这张卡比它自己短名单里最好的一手还值钱，却被排在门外** ⇒ "窄"是可指认的损失，不是一个笼统的上界。
     * ⚠ 逐卡 max 也是"从噪声里挑最大"（一卡多目标时挑一次）⇒ 绝对值偏乐观；但 `Δvs短名单上限` 两边同为 max，**方向可比**。
     * ⚠ 与 §E218b 的混叠呼应：动作向量逐位相同的卡必然同分 ⇒ 它们的"名次"由候选枚举顺序决定，不由网络决定（那一栏要连着看）。 */
    if (r.covRec.length && r.covRec[0].keys) {
      const CN = (function () { const m = {}; const R = W.EpirusRules; for (const k of Object.keys(R.skills)) if (!m[k]) m[k] = R.skills[k].name; return m; })();
      const A = {};
      const cmp = (rec, v, vh, i, j) => {
        const key = x => ((rec.salt ^ Math.imul(x + 1, 2654435761)) >>> 0);
        return v[i] > v[j] || (v[i] === v[j] && (vh[i] > vh[j] || (vh[i] === vh[j] && key(i) < key(j))));
      };
      for (const rec of r.covRec) {
        const v = rec.w.map(a => m0(a)), vh = rec.h.map(a => m0(a));
        let bAll = 0; for (let i = 1; i < rec.n; i++) if (cmp(rec, v, vh, i, bAll)) bAll = i;
        let bNet = 0; const nk = Math.min(KEEP, rec.n);
        for (let i = 1; i < nk; i++) if (cmp(rec, v, vh, i, bNet)) bNet = i;
        const grp = {};
        for (let i = 0; i < rec.n; i++) {
          const k = rec.keys[i];
          const g = grp[k] || (grp[k] = { best: i, netRank: i, nc: 0 });
          g.nc++;
          if (i < g.netRank) g.netRank = i;
          if (cmp(rec, v, vh, i, g.best)) g.best = i;
        }
        for (const k in grp) {
          const g = grp[k], a = A[k] || (A[k] = { legal: 0, in6: 0, arg: 0, played: 0, dMine: [], dNet: [], rank: [], cand: [], dMineN: [], dNetN: [] });
          a.legal++; a.in6 += g.best < KEEP ? 1 : 0; a.arg += g.best === bAll ? 1 : 0;
          if (rec.mineKey === k) a.played++;
          a.rank.push(g.netRank); a.cand.push(g.nc);
          a.dMine.push(v[g.best] - rec.mineWin);
          a.dNet.push(v[g.best] - v[bNet]);
          /* ⚠ **无偏那一版**：取"该卡按**网络自己**排名最靠前的那个候选"（= 若认真考虑这张卡、按网络选目标会选它），
             而不是"该卡按模拟赢率最好的目标"（后者是在该卡的若干目标里再取一次 max ⇒ 从噪声里挑最大，系统性偏高，
             且各卡的候选数不同 ⇒ 卡与卡之间也不可并排）。两列都印，**结论只引无偏那列**。 */
          a.dMineN.push(v[g.netRank] - rec.mineWin);
          a.dNetN.push(v[g.netRank] - v[bNet]);
        }
      }
      const rowsK = Object.keys(A).filter(k => A[k].legal >= Math.max(8, 0.15 * r.covRec.length))
        .sort((x, y) => mean(A[y].dMineN) - mean(A[x].dMineN));
      const fmt = function (arr) { return (100 * mean(arr) >= 0 ? '+' : '') + (100 * mean(arr)).toFixed(2) + ' ±' + ci95(arr).toFixed(2); };
      console.log('     · **§E219 门外哪些卡值多少**（' + r.covRec.length + ' 个采样决策 ‖ 只列合法 ≥ ' +
        Math.max(8, Math.round(0.15 * r.covRec.length)) + ' 次的卡 ‖ 按**无偏那列**降序 ‖ 同一批流、逐决策配对 ⇒ **零额外 rollout**）');
      console.log('       卡(键)                合法/决策  该卡候选数  入围率   被打率  P(=全表最优)  **Δvs臂自己〔无偏：目标也按网络选〕   Δvs臂自己〔取该卡最好目标，偏高〕   Δvs短名单上限〔无偏〕  平均网络名次');
      for (const k of rowsK) {
        const a = A[k];
        console.log('       ' + ((CN[k] || k) + '(' + k + ')').padEnd(22) +
          (a.legal / r.covRec.length).toFixed(2).padStart(6) + '      ' + mean(a.cand).toFixed(1).padStart(5) + '    ' +
          (100 * a.in6 / a.legal).toFixed(1).padStart(5) + '%  ' + (100 * a.played / a.legal).toFixed(1).padStart(6) + '%   ' +
          (100 * a.arg / a.legal).toFixed(1).padStart(6) + '%   ' +
          fmt(a.dMineN).padStart(16) + 'pt      ' + fmt(a.dMine).padStart(15) + 'pt      ' + fmt(a.dNetN).padStart(15) + 'pt   ' +
          mean(a.rank).toFixed(1).padStart(6));
      }
      console.log('       ⚠ **只引"无偏"那两列**：`该卡最好目标` 那列是在这张卡的若干目标里**再取一次 max**（从噪声里挑最大 ⇒ 系统性偏高，且各卡目标数不同 ⇒ 卡之间不可并排），印出来只给读者看两列差多少。');
      console.log('       ⚠ 读法：**`Δvs短名单上限〔无偏〕` ≥ 0 而入围率≈0** 的卡 = "按网络自己的排序就该排在门外，可它的价值不低于自己短名单里最好的一手" ⇒ 这才指得动修法（改入围/改打分），而不是再报一个笼统上界。');
      /* ===== §E222 · 把上面那张表**按环境**摊开（零额外 rollout：`gid` 里本来就带着环境名）=====
       * 为什么要摊：§E219 的"平均≈0"抹掉的正是**条件性**，而"不同环境下用不同策略"这句话唯一可测的版本就是它。
       *   现成例子：`bigT`（真正的落雷）卡面写着"**目标非防御类技能无效**" ⇒ 它天生只该在防御型桌上值钱；
       *   若它在某一桌上 `Δvs短名单上限 ≥ 0` 且**两个 seed 带同向**，那"平均为负"就不是"这卡没用"，而是"这卡看桌"。
       * 判据（先写死再跑，防事后找理由）：**入围率 < 5% 的卡**里存在某环境使 `Δ ≥ 0 且 n ≥ 25`，且两带同向 ⇒ 记"条件性价值成立"；
       *   否则这一格关掉，不再往这个方向花第三个晚上。 */
      const ENVS_SEEN = [];
      for (const rec of r.covRec) { const e = String(rec.gid).split('#')[0]; if (ENVS_SEEN.indexOf(e) < 0) ENVS_SEEN.push(e); }
      const M = {};
      for (const rec of r.covRec) {
        const env = String(rec.gid).split('#')[0];
        const v = rec.w.map(a => m0(a)), vh = rec.h.map(a => m0(a));
        let bNet = 0; const nk = Math.min(KEEP, rec.n);
        for (let i = 1; i < nk; i++) if (cmp(rec, v, vh, i, bNet)) bNet = i;
        const grp = {};
        for (let i = 0; i < rec.n; i++) {
          const k = rec.keys[i]; const gg = grp[k] || (grp[k] = { netRank: i });
          if (i < gg.netRank) gg.netRank = i;
        }
        for (const k in grp) {
          const mm = M[k] || (M[k] = {}), cell = mm[env] || (mm[env] = { dn: [], dm: [], n: 0 });
          cell.dn.push(v[grp[k].netRank] - v[bNet]); cell.dm.push(v[grp[k].netRank] - rec.mineWin); cell.n++;
        }
      }
      const excluded = Object.keys(A).filter(k => (100 * A[k].in6 / A[k].legal) < 5 && A[k].legal >= Math.max(8, 0.15 * r.covRec.length));
      if (excluded.length) {
        console.log('     · **§E222 "门外卡"按环境摊开**（每格 = `Δvs短名单上限〔无偏〕` 均值 pt ‖ 括号内是该格合法决策数 ‖ 只列**入围率 < 5%** 的卡 ‖ 臂 `' + r.arm + '`）');
        console.log('       卡(键)' + (function () { let s = ''; for (const e of ENVS_SEEN) s += ' ' + e.padStart(16); return s; })() + '          整体');
        for (const k of excluded.sort((x, y) => mean(A[y].dMineN) - mean(A[x].dMineN))) {
          let line = '       ' + ((CN[k] || k) + '(' + k + ')').padEnd(20);
          for (const e of ENVS_SEEN) {
            const c = M[k] && M[k][e];
            line += (c && c.n) ? ((100 * mean(c.dn) >= 0 ? '+' : '') + (100 * mean(c.dn)).toFixed(1) + '(' + c.n + ')').padStart(16) : '               ·';
          }
          console.log(line + '   ' + (100 * mean(A[k].dNetN) >= 0 ? '+' : '') + (100 * mean(A[k].dNetN)).toFixed(1) + '(' + A[k].legal + ')');
        }
        console.log('       ⚠ 正数只表示"**这一桌上该卡不比它自己短名单里最好的一手差**"；**两带同向才算数**（本表只有一带），n<25 的格子一律不引。');
      }
    }
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
    const fit = (pts, nm, extra) => {
      /* ⚠ 拟合要**至少两个前缀**：`c + b·g(r)` 是两个未知数，单点 ⇒ 正规方程奇异 ⇒ `lsq2` 返回 null
       *   （这坑是我自己踩的：第一次收标签时只给一个前缀想省时间，结果整遍跑到最后一行崩掉，白跑 30 分钟）。 */
      if (SWEEP.length < 2) { console.log('· ⚠ `--sweep` 只给了一个前缀 ⇒ 无法拟合膨胀律（要 ≥2 个）；上面那张表仍可引，但**不许外推**。'); return; }
      const a = lsq2(pts, inv), b = lsq2(pts, sqr);
      if (!a || !b) { console.log('· ⚠ ' + nm + ' 的拟合奇异（lsq2 返回 null）⇒ 不外推。'); return; }
      console.log('· **' + nm + ' 外推到 `1/r → 0`**：`c + b/r` ⇒ c = ' + a.c.toFixed(2) + 'pt（b=' + a.b.toFixed(1) + '，RSS=' + a.rss.toFixed(2) + '）'
        + ' ‖ `c + b/√r` ⇒ c = ' + b.c.toFixed(2) + '（b=' + b.b.toFixed(1) + '，RSS=' + b.rss.toFixed(2) + '）' + (extra || ''));
    };
    fit(ptsReg, 'regret(oracle1) ＝ 一手完美根决策的净上限');
    fit(ptsGreed, '抽样 vs 贪心（greedy(网络 top1) − 臂自己那手）',
      ' ⇒ 这是"焦点席那 0.15 温度赔掉多少"的读数（⚠ **同一批 rollout 上的对照**，不是"整局换成贪心"的读数 —— 后者会改它对对手的激励，要重跑对局才算）');
    if (DEPTH2) fit(ptsGap, '多规划一手（两手 max − 一手 max）＝ Δ',
      ' ‖ 两手上限本身 c(o2) = ' + (lsq2(ptsO2, inv) || { c: NaN }).c.toFixed(1) + '% ⇒ Δ 与"一手上限"同量级就说明**视界**才是主缺口');
    console.log('  ⚠ 外推前提：膨胀只随 `r` 变。这次各点是**同一批决策**（§E200 那遍不是），所以曲线只剩估计噪声；但 `keep=' + KEEP + '` 的池子组成仍是同一份 ⇒ 它外推的是"这一批决策上的膨胀"，不是所有配置。');
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
if (DUMPCOVER) {
  if (!COVER) { console.error('⛔ `--dumpcover` 必须与 `--cover` 同开（教师标签来自全表 rollout，不开 cover 就没有标签可写）'); process.exit(64); }
  writeFileSync(DUMPCOVER, CROWS.join('\n') + '\n');
  console.log('· §E223 教师标签导出 **' + CROWS.length + ' 个决策** 到 `' + DUMPCOVER + '`'
    + (CROWS.length ? ' ‖ 每行 = 状态 ' + JSON.parse(CROWS[0]).s.length + ' 维 ×1 + 动作 ' + JSON.parse(CROWS[0]).a[0].length + ' 维 ×' + JSON.parse(CROWS[0]).k.length + ' + 逐流赢率 ×' + REP : ''));
}
console.log('rc=0');
