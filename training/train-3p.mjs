/* Epirus 多人自对战训练器（N19）：名次适应度 + 座位轮换 + 多对手池
 * 用法：node tools/train-3p.mjs [代=200] [人数=3] [每代评估局数=8] [种群=12]
 * 产出：js/bundled-champion-3p.js（window.EPIRUS_CHAMPION_3P）
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isWideVs, LAND_TOL } from '../tools/pool-frontier-lib.mjs';   // §十四：门槛不自造判据——两条都指到在册出处（种类那条 = 产品门 L1 `broad`，净兑现那条 = 池级前沿尺 `isWideVs`）
import { P2_FNAME } from '../tools/p2-baselines.mjs';   // 2P 考卷基准的单一来源（v1.5.150：`EPIRUS_XN2REF=exam` 用它）
import { guardWrite, declareCopy } from '../champion-map/pack-guard.mjs';   /* §E589：落盘前查「这粒权重是否已有真身」 */
import { widOf, widOfArr } from '../champion-map/pack-id.mjs';   /* 2026-10-12 DS：`hotstartFrom` 记权重身份（wid）而不是路径 —— 与 server 的 weightsId 同式 */
import { densityProfile, aggressionProfile, cardUsageProfile } from '../tools/audit-lib.mjs';   // §N9 退化闸的口径源（与 promote 同一个 zeroAtkRate）‖ §E787 清场地板用同一个 `aggressionProfile`（官方 场A/场B 口径，与门禁 `fieldB.clearedPerGame` 同源 ⇒ 不加新尺）   // 11-09 P2：`cardUsageProfile` = `tools/card-usage.mjs` 的那把尺搬进 lib ⇒ 地板与 POOL-CONTRACT v2.1 的基准同一个种子序列
import { ECON_ENV_KEYS, ECON_REWARD_KEYS, readEconEnv } from './server/econ-env.mjs';   // v1.5.155 黑键侦测：server 下发族名单（单一来源）
import { readTrainEnv, hasTrainOverride, REMOVED_TRAIN_KEYS } from './server/train-env.mjs';   // v1.5.159：训练分布旋钮（与 econ/fight 同构的单一来源）
import { rejectDegenerateWinners, bandPickByLand, bandPickByUsage, rejectNarrowWinners, rejectGiftSpamWinners,
  parseSelSeeds, selBases, scoreRuns, selNote, selGapNote, bandFor } from '../tools/pick-best.mjs';
import { HOLO_GIFT_MAX, landShareOf } from '../tools/audit-lib.mjs';   // v1.5.168：送盾阈值与 promote 同源（当选面预筛要用）   // §N9 当选面退化闸（纯函数，门 D121 直接喂合成表）· §N24 兑现广度同分带排序
/* v1.5.269（§E77）：载重 veto 的**同口径量具** —— `behavior-profile` 的 `fieldProfile`（ε=0 · temp 0.15 · 5 席同包）。
 * 该模块的主体被 `if (RUN_AS_MAIN)` 守着 ⇒ **import 无副作用**（只会多装载一次引擎，实测 ~0.5 秒）。 */
import { fieldProfile, WIN } from '../tools/behavior-profile.mjs';   // §E787：`WIN` = 那个模块已经装载好的引擎沙箱 ⇒ 清场地板直接复用，不再 sandbox() 第二次
import { measureDefenseQuality } from '../tools/defense-quality.mjs';   // 11-09 P1：当选面白防率的**装配与切窗**与在产探针同源（三档算术本来就是这一份）
/* v1.5.194（qoder 0924 夜）：击杀奖励规则的**单一来源**实现（与 `probe-kill-reward.mjs` 共用同一份 ⇒
 * 不会出现"训出来的冠军和量出来的冠军不是一套规则"）*/
import { patchResolve as krPatchResolve, patchPlay as krPatchPlay, makeKR as krMakeKR } from '../tools/kill-reward-lib.mjs';
/* v1.5.229（用户批准方案 a）：**序列奖励** —— "蓄能[电珠] → 下一回合电磁炮"完成时给 +W ep。
 * 与击杀奖励同族：只包一层 `policyChooserN` 工厂，**仓库文件一字不动 ⇒ 规则指纹不变**，默认关。 */
import { makeSeqReward, patchEvoChooser as seqPatchEvoChooser } from '../tools/seq-reward-lib.mjs';
/* v1.5.200：黑键 / 已删键的判定搬进**单一来源**（原先只有本工具自己一份 IIFE ⇒ 别的入口没有这道闸）。
 * v1.5.226：同一个读集还用来把**实际生效的配方**写进 meta（见下面的 EFFECTIVE_ENV）。 */
import { enforceKnobs, readKeysOf } from './server/knob-guard.mjs';
/* §E821（10-28 傍晚 · 2.0 架构原型）：与 `seq-reward-lib` 同一手法 —— **只覆盖沙箱里的导出入口**，
 * `js/**` 一字不动 ⇒ 规则指纹不变；默认关（不带 `EPIRUS_ARCH2` 时这一行只是把一个函数引进来）。 */
import { install as installArch2, verifyWired as verifyArch2Wired } from './proto2/arch2.mjs';

/* ===== v1.5.244：本入口只吃**位置参数** ⇒ 任何 `--…` 一律 exit 64（仓规 v1.5.234 的延长线）=====
 * 起因是我自己 15:12 亲手踩的：`node tools/train-3p.mjs --help` 以前被读成 `GENS=NaN` ⇒ **真的开跑一支臂**
 * （打印到"3 人实测"才在中途抛错），而它默认落点就是门禁拿去比哈希的 `docs/artifacts/train-3p-out.js`
 * ⇒ 一次打错的帮助页，能把正在跑的门禁基线文件改脏。
 * 与 `audit-lib.rejectUnknownFlags` 同码（64 = 用法错），且**排在所有昂贵动作之前**（连经济快照都不做）。 */
const __badFlag = process.argv.slice(2).find(function (a) { return String(a).slice(0, 2) === '--'; });
if (__badFlag !== undefined) {
  console.error('[train-3p] ⛔ 不认识的参数：' + __badFlag + ' —— 本工具只吃位置参数：'
    + 'train-3p [代=200] [人数=3] [每代局数=8] [种群=12]；旋钮一律走 EPIRUS_* 环境变量（暗键会 exit 6）。');
  process.exit(64);
}

/* 输出保护（千问复核的延伸）：训练工具的产出**默认不写线下冠军文件**。
 * 起因：一次 60 代/40 代的测试跑把 js/bundled-champion*.js 覆写成测试冠军，
 * 并被 git add -A 提交（线下冠军就这么被换掉了，我还据此写错过文档）。
 * 规则：只有显式 EPIRUS_PUBLISH=1 才写线下路径；否则写 docs/artifacts/<tool>-out.js。 */
/* Output path. NOTE: do NOT name this OUT_PATH and then reference OUT_PATH inside its own
 * definition -- my first version did exactly that (the replace script also rewrote the
 * shipped path inside the guard itself), producing a self-reference / TDZ. */
const OUT_PATH = process.env.EPIRUS_PUBLISH === '1'
  ? 'js/bundled-champion-3p.js'
  /* v1.5.244（E34）：`EPIRUS_T3P_OUT=<路径>` 可把产物改道 —— 与 `train-best` 的 `EPIRUS_TB_OUT` 同形。
   * 为什么现在要：孪生臂要**并发**跑（一台 18 核机器上一次 10+ 臂），而所有臂默认都写同一个
   * `docs/artifacts/train-3p-out.js` ⇒ 并发时互相覆盖，只能串行（用户 09-26 指令：别再单核慢慢跑）。
   * 改道后默认路径**一字不动**（门禁那两道比对它哈希的 CLI 基线门因此不会被我的臂污染）。 */
  : (process.env.EPIRUS_T3P_OUT || ('docs/artifacts/' + 'train-3p' + '-out.js'));

/* v1.7.114（10-19，DS）：**点名谁在写默认落点**（`EPIRUS_LOG_DEFAULT_OUT=1`）。
 *   ⚠ 这一行**不在这里打**，挪到真正落盘之后（本文件末尾 `GUARD.wrote` 那一段）⇒ 见那里的 v1.7.115 注释。
 *   为什么必须挪：原版打在模块加载时，于是 `--help` 与"该失败的失败"那几条腿（exit 5/6/7/8，**根本没写盘**）也上榜；
 *   而条件没排 `EPIRUS_PUBLISH=1` ⇒ 覆盖出厂冠军那一次也被标成"写默认落点"，最该另说的一类被归了错名。 */

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
const N = Number(process.argv[3] || 5);   /* 11-02 晚（用户裁）：默认 5 人（配 TRAIN_MODE 默认 long = 5 血） */
const GAMES = Number(process.argv[4] || 8);
const POP = Number(process.argv[5] || 12);

/* ===== v1.5.155 · CLI 黑旋钮侦测（DS 09-22 裁定 · qoder §N10 提案）=====
 * 病：本工具的 env 面是一个**闭集**（下表），而 server 侧有一大批旋钮经 `server/econ-env.mjs` /
 *   `fight-env.mjs` 下发，或由 `js/` 里的代码"加载时读 `process.env`"。从 **CLI** 传这些键**一律无效、
 *   却没有任何提示** ⇒ 会跑出"看起来在调参、其实是默认经济"的臂（本会话已踩到第 5、6 例：
 *   `EPIRUS_CLEAR_W` 传了没人读、`EPIRUS_PASSIVE_FIELD` 因沙箱无 `process` 永远默认）。
 * 改法：启动时把 env 里出现的 `EPIRUS_*` 与本工具闭集比对，命中**暗键** ⇒ 打印名单 + `exit 6`
 *   （与 D119/D120 的"要了开关不许静默"同一条规矩）。有意为之的情形用 `EPIRUS_ALLOW_DARK=1` 放行。 */
const SELF_ENV_KEYS = [
  'EPIRUS_ANCHOR', 'EPIRUS_ANCHOR_TO', 'EPIRUS_ARM', 'EPIRUS_BAND_DIR', 'EPIRUS_CLEAR_W', 'EPIRUS_HOTSTART',   // 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK)
  'EPIRUS_ARCH2', 'EPIRUS_MUT_MODE',   // §E821（10-28 傍晚 · 千问）：2.0 架构原型 + 段感知/扁平变异算子档（默认关 ⇒ 逐字回到 v7）
  'EPIRUS_SEL_EVAL_SEEDS',   // §E322（v1.6.7）：当选键重验用几粒 seedBase 取均值（默认 4；=1 逐字回到旧行为）
  'EPIRUS_SEL_LAND', 'EPIRUS_SEL_LAND_GAMES', 'EPIRUS_SEL_LAND_TOL',   // v1.5.167：当选面兑现广度（默认关）
  'EPIRUS_BREADTH_FLOOR',   // v1.5.170：广度准入线（§N29，默认关；`SEL_LAND_GAMES` 是它共用的量具局数）
  'EPIRUS_GA_GATE', 'EPIRUS_GA_GATE_GAMES', 'EPIRUS_GA_BAND', 'EPIRUS_STALL_ABORT',   // 每代 top-3 健康门槛(宽粒优先,饿退不杀) ‖ 门槛测量局数(默认6) ‖ 带内取宽带宽 ‖ 连续K代bestFit不进步⇒整臂终止
  'EPIRUS_HALL_TRACE', 'EPIRUS_HALL_TRACE_OUT',   // 名人堂逐粒追踪开关 ‖ 追踪 JSONL 落盘路径(默认 scratch/hall-trace/<臂>.jsonl)
  'EPIRUS_SEL_GIFT_VETO', 'EPIRUS_SEL_GIFT_VETO_GAMES',   // §E650（千问）：送盾当选 veto + 它的测量长度（默认关 ⇒ `gateOk` 那一次测量也不跑）
  'EPIRUS_INIT_SCALE',                        // 11-04 波 H（千问）：随机起点幅度（缺省 0.25 = 出厂）
  'EPIRUS_SEL_CLEAR', 'EPIRUS_SEL_CLEAR_GAMES',   // §E787（10-26 夜班后追加，用户裁"加上开跑"）：当选面的**场B 清场地板**（veto，不进 fit）+ 它的测量局数（默认 40 = 官方口径）
  'EPIRUS_COUNTER_OPPS', 'EPIRUS_SEL_COUNTER',    // v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关）
  /* §E797（10-27 夜班）：`EPIRUS_BLOCK_W` 走通用 econ 回路（D77/D174 见 git 史）。 */
  'EPIRUS_POOL_OPPS', 'EPIRUS_POOL_OPPS_TIER', 'EPIRUS_POOL_OPPS_TABLE',   // v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；表路径可指名册——11-13 统一池裁定后 pool-members-2p.tsv 是**2P 训练对手名册**（旧 v7 包当 2P 陪练），不再喂页面
  'EPIRUS_SEL_POOL',   // v1.7.92 §E635：把池成员**也放上选拔桌**（终局重验那张表；默认关 ⇒ `ALL_PAIRS` 一字不变）
  'EPIRUS_HALL_DEDUP', // v1.7.92 §E635：名人堂按 wid 去重（同一粒权重只占一席；默认关 ⇒ 榜的形状一字不变）
  'EPIRUS_BIGT_PUSH', 'EPIRUS_DRAIN_PUSH',   // §E275（v1.5.334）：**部署档的 CLI 把手**（大雷默认档 / 摄魂探索软提升）；不设 ⇒ 引擎默认一字不动，设了就由引擎回读
  'EPIRUS_SEL_BIGT', 'EPIRUS_SEL_BIGT_KEYS', 'EPIRUS_SEL_BIGT_GAMES', 'EPIRUS_SEL_BIGT_MODE',   // v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变）
  'EPIRUS_SEL_DEFQ', 'EPIRUS_SEL_DEFQ_MINHANDS', 'EPIRUS_SEL_DEFQ_MINSHARE', 'EPIRUS_SEL_DEFQ_GAMES', 'EPIRUS_SEL_DEFQ_MODE', 'EPIRUS_SEL_DEFQ_EPS',   // 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变
  'EPIRUS_SEL_CARDS', 'EPIRUS_SEL_CARDS_GAMES',   // 11-09 P2（用户裁定：只筛新候选、不回筛现役池）：当选面**用卡数地板 veto**，度量复用 fieldProfile 的逐卡计数（份额 ≥0.5%，与 tools/card-usage.mjs 同定义），默认 0=关
  'EPIRUS_CARD_ABORT', 'EPIRUS_CARD_MIN', 'EPIRUS_CARD_ABORT_GAMES',   // 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物
  'EPIRUS_KILL_REWARD', 'EPIRUS_KR_TRANSFER',   // v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎）
  'EPIRUS_SEQ_W',   // v1.5.229：序列奖励（"蓄能[电珠]→下一回合电磁炮"完成时 +W ep；同样只在内存里，默认 0=关）
  'EPIRUS_SUB_BEAD',   // 模仿教师的蓄能钩子（与 EPIRUS_SUB_BEAD_KIND 一起设才进；只设珠种=钩子不进）
  'EPIRUS_SEQ_KIND',   // v1.8.37（10-25 ZCode · §二十一）：序列奖励的**珠种档**（'elec' 缺省 = 电磁炮原义；'boom' = 蓄爆珠→激光眼）
  'EPIRUS_KILL_FIELD',   // v1.5.160：收割席注入（qoder §N13 · 用户裁定"场B 缺口走对手池"）⇒ 带**开火计数**才敢算"已下达"
  'EPIRUS_TRAIN_MODE',   // v1.5.169：训练模式（§N28 · 用户"炼一个 5 血长程通吃其他模式"）⇒ 认不了就 exit 7，不许静默退回 multi
  'EPIRUS_MIX8',   //（ZCode · 11-02 深夜）fitness 每第 K 局换 8 人桌——地雷 5P+ 高性价比（用户裁定），8P 局照常进 fit（默认 0=关）
  'EPIRUS_MIX2_EVERY',   //（ZCode · 11-06 夜）fitness 每第 K 局换 2 人桌——同代混桌（DS 待办 2；默认 0=关）
  'EPIRUS_COURSE_EVERY',   //（ZCode · 11-06 夜）课程席：每第 K 代 fitness 局注一席脚本对手（D-08 机制解；默认 0=关）
  'EPIRUS_MIXHP_EVERY',   //（ZCode · 11-06 深夜）桌形混合：每第 K 局换对偶桌形（multi↔long；3血适应，默认 0=关）
  'EPIRUS_COURSE_BOT',     //（ZCode · 11-06 夜）课程席坐谁：Bots 导出的函数名（缺省 pickToolKit）
  'EPIRUS_HPSEED',   //（ZCode · 11-02 深夜）残血开局课程——摄魂 (b) 线（默认 0=关；p 比例局全席对称压 HP=min(2,modeHp-1)）
  'EPIRUS_HOLDOUT_SEG',   //（ZCode · 11-03 凌晨）E3 存段：每 K 代快照当代最优粒落 band 目录（默认 0=关；只存盘不改当选）
  'EPIRUS_HOLO2PROTO',   // v1.7.4（10-13 夜班 S2a）：训练期把"送盾"改写成"给自己上原型制御"（决策期档，`policy.js` 的 `setHolo2Proto`）
  'EPIRUS_PUBLISH', 'EPIRUS_SEED', 'EPIRUS_SEEDPACK', 'EPIRUS_XN2G', 'EPIRUS_XN2REF',   // 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准
  'EPIRUS_XN2W',   // 2P 切片 fit 权重(0=关)
  'EPIRUS_PAIRED',   /* 2026-10-28（DS）：配对评估 —— 同代所有个体吃同一批局（common random numbers），默认关 */
  /* ===== 11-11 夜（ZCode）：补登记 sweep —— 在用未登记 68 条清零（清单 = 生成器 docs/TRAINING-KNOBS.md「在用未登记」节，
   * 剔除 ECON/FIGHT/TRAIN 三份单一来源表已管的 37 条）。注解一律同行 //（收割按行取）；详注在读取点旁边。 ===== */
  'EPIRUS_ALLOW_DARK',   // 闸放行旗（=1 放行「本入口读不到的键」）；用臂必须自己补回逐键回执证据（见上 ⚑ 块）
  'EPIRUS_ALLOW_HEALTH_FAIL',   // 2P 服务：体检未过仍落盘（实验臂旗，默认关）
  'EPIRUS_T3P_OUT', 'EPIRUS_T3P_BASELINE',   // 产物改道 / 基线持有者声明（写默认落点要显式认领，三选一纪律见 :2363）
  'EPIRUS_TB_OUT', 'EPIRUS_TB3P', 'EPIRUS_TB3P_GAMES',   // train-best：产物改道 / 候选跑 3P 五道体检（默认 0=关）/ 其量具局数（缺省跟随 feasPlan）
  'EPIRUS_LOG_DEFAULT_OUT',   // 没改道的臂另追加一行到该文件（点名默认落点用，§E654）
  'EPIRUS_BUNDLE_IN', 'EPIRUS_BUNDLE_OUT',   // 2P 服务：热启动源 / 产物落点（隔离模式；线上包只由 promote 写）
  'EPIRUS_IMIT_TEACHER', 'EPIRUS_IMIT_PLAN', 'EPIRUS_IMIT_FRAC', 'EPIRUS_IMIT_GENS',   // 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算）
  'EPIRUS_IMIT_ONLY', 'EPIRUS_IMIT_OVERRIDE', 'EPIRUS_IMIT_SUBONLY', 'EPIRUS_IMIT_SUB_ONLY',   // 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账
  'EPIRUS_LASER_W', 'EPIRUS_TGT_W',   // 奖励权重：激光眼命中 / 威胁靶向（下达后回执不一致 ⇒ exit 7）
  'EPIRUS_CURSE_PUSH', 'EPIRUS_SUPPORT_PRIOR',   // 部署档把手：贴贴高 ep 软注入 / 送盾先验 0|1|2（本入口 CLI 默认 2）
  'EPIRUS_COURSE_PACK', 'EPIRUS_FIT_CHAMP', 'EPIRUS_FIT_CHAMP_EVERY',   // 11-10 DS：课程席放真实包 / fitness 掺冠军桌（包路径）/ 冠军席每 k 局一席（默认 4）
  'EPIRUS_PACK_OPP',   // 2.0 臂：一枚包上训练桌当对手席（默认关；v7 模式拒收）
  'EPIRUS_SIGMA_FLOOR', 'EPIRUS_SIGMA_DECAY', 'EPIRUS_SIGMA_STALL',   // GA σ 调度：下限（0.06）/ 衰减（0.995）/ 停滞回抬档（K 代没进步 ×1.25，默认 0=关）
  'EPIRUS_TRAIN_EPS', 'EPIRUS_TRAIN_EPS_K', 'EPIRUS_TRAIN_EPS_MODE', 'EPIRUS_TRAIN_TEMP',   // 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验
  'EPIRUS_WR_TOL',   // 2P 服务：冠军换代的胜率容差（默认 0.03）
  'EPIRUS_SEL_TWO_STAGE',   // 选拔档：两段式（默认开，=0 关）
  'EPIRUS_FEAS_GAMES', 'EPIRUS_AGGR_GAMES', 'EPIRUS_SEAT_GAMES', 'EPIRUS_DENSITY_GAMES', 'EPIRUS_CHARGE_GAMES',   // 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS）
  'EPIRUS_FEASIBILITY', 'EPIRUS_FEASIBILITY_BLOCK',   // 2P 服务：落盘前可行性体检（=0 关）/ 体检不过阻断落盘（默认关）
  'EPIRUS_OPP_N',   // 2P 服务：对手池名单覆盖（逗号名表，缺省 9 席；配对 A/B 用）
  'EPIRUS_REGEN_GENS', 'EPIRUS_REGEN_SLICE',   // 补贴族：补贴总代数 / 补贴率下达（本入口）
  'EPIRUS_RING_FORCE_EPS', 'EPIRUS_RING_FORCE_UNTIL',   // 聚能环强探档：ε / 截止代（默认 0=关）
  'EPIRUS_S4_GAMES',   // 2P 服务：shapeScorer 量具局数（默认 8）
  'EPIRUS_SEED0',   // 2P 服务：worker 播种根（服务端派生后下发）
  'EPIRUS_TRAIN_SEAT_GAMES',   // 2P 服务：座位轮换局数（>0 才开 setSeatGames）
  'EPIRUS_STYLE_W', 'EPIRUS_STYLE_GAMES',   // 风格课程：风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2）
  'EPIRUS_SUBSIDY_H', 'EPIRUS_SUBSIDY_EP', 'EPIRUS_SUBSIDY_MIN',   // 2P 服务：补贴局形状（每 h 局 / 从 ep 起 / 低于 min 不补）
  'EPIRUS_WALL_MS',   // 2P 服务：墙钟收敛（ms，=0 纯按代数；动它破坏同参可复现，慎重）
  'EPIRUS_WORKERS',   // 2P 服务并行度：worker 数（缺省 cpus-1，上限 16）
  'EPIRUS_CHARGE_MIN_EP',   // 蓄能门槛（worker 下达，缺省 2 = v1.5.82 裁定）
  'EPIRUS_FEAT_MASK',   // worker：特征掩码（policy.setFeatMask，训练侧砍维用）
  'EPIRUS_NORM',   // 2.0 臂：输入标准化 {mean[],std[]} JSON 路径（读不出/形状不对 ⇒ exit 7）
  'EPIRUS_TRIPLET', 'EPIRUS_TRIPLET_LOG',   // 落盘后 triplet 读数（spawn exam4-triplet，JSON 上 stdout）/ 台账追加路径（设了才写）
  'EPIRUS_ALIAS_TSV',   // 包别名表路径（pack-resolve 链读；门体 _ctx 有自己的缺省）
  'EPIRUS_INIT_ACT_K',   // 2.0 起点初始化的动作头振幅（arch2 缺省 1）
  /* ===== 11-11 夜：promote-champion（第五入口）的体检探针族——注解住在登记块，读取点在 promote ===== */
  'EPIRUS_BREADTH_GAMES',   // promote 广度画像局数（long/multi 各一把，默认 20）
  'EPIRUS_NO_PROXY', 'EPIRUS_PROXY_GAMES',   // promote 反弹代理探针：跳过旗（省 30s）/ 局数（默认 20；只打印不判定）
  'EPIRUS_NO_GUARD', 'EPIRUS_GUARD_GAMES', 'EPIRUS_GUARD_SEEDS',   // promote 防御三件探针：跳过旗 / 局数（默认 40）/ 种子数（默认 2）
  'EPIRUS_NO_SHAPE', 'EPIRUS_SHAPE_GAMES',   // promote 形状适应度探针：跳过旗 / 局数（默认 30；只打印不判定）
  'EPIRUS_NO_DEFQ', 'EPIRUS_DEFQ_GAMES',   // promote 白防率探针：跳过旗 / 局数（默认 30；立线前只让读数可见）
  'EPIRUS_SNIPER_GAMES',   // promote 狙击画像局数（默认 20，long/mixed）
  'EPIRUS_JSON'   // promote 判据的机器可读投影行前缀（固定字面量，不是路径）
];
/* v1.5.187：**大雷连带收益权重**（`evo.js` 的 `BIGT_CHAIN_W`，DS 交接 §2b 的唯一待做）走 econ 族，
 * 而它的 env 名按 D77 只许出现在 `server/econ-env.mjs` ⇒ 这里**不写字面量**，
 * 而是从单一来源**反推**："喂一个 econ env 名 ⇒ `readEconEnv` 读出哪个奖励键"，与本 CLI 真正下发的那一个对上，
 * 才算"本工具认识它"（不是暗键）。派生而非抄名单 = 少一处"两处各写一遍"。 */
/** v1.5.254（用户 GO · 千问 §E59 NEXT 第 6 条）：把 **econ 族**里治"花掉"那一半的 5 个旋钮接上 CLI。
 * 病：`beadW / bigcardW / stockBonus / hoardOnLeftover / convRatio` 只走 server/worker，
 *   而本工具不 dispatch 这些键 ⇒ **CLI 传进去静默 `exit 6`**（千问要治闭环的"花"那一半时被卡在这里）。
 * ⚠️ 这里**只写奖励键名**、不写 env 字面量：下面的 `extendSelfWithCliEcon()` 会按 D77 的单一来源反推出 env 名。 */
/* v1.7.86（DS · 10-17）：补 `widthW` 与 `divForceGens` —— 这两个键在 `server/econ-env.mjs` 的
 *   `ECON_ENV_KEYS`（`EPIRUS_WIDTH_W` / `EPIRUS_DIV_FORCE_GENS`）与 `ECON_REWARD_KEYS` 里都齐，
 *   **唯独本入口的投递名单缺**（D172 立的「三处名单齐全」规矩的第三处）。实测：不补，喂它们一律 `exit 6` 被黑键闸拦。
 *   而这两个恰好是广度上**最该试的两根**（`WIDTH_W` 按 `WIDTH_FLOOR=3 → WIDTH_TARGET=7` 线性给钱，`evo.js:1503` 明写
 *   「与 `DIV_W` 那个归一化熵不同，**刷不动**」；`divForceGens` 是强迫窗）—— 而 `DIV_W` 在 `evo.js:1532` 有实测
 *   「×5 后产物 G=1.24/1.90」的反面记录。 */
const CLI_ECON_REWARD_KEYS = ['bigtChainW', 'fitTailW', 'fitTailQ', 'widthW', 'divForceGens',
  'beadW', 'bigcardW', 'stockBonus', 'hoardOnLeftover', 'convRatio',
  'costlyW', 'fitCal',   /* v1.5.260（用户 GO"做 B+"）：贵卡预算权重（默认 0 ⇒ 行为逐字不变；见 js/train/evo.js 的 costlyBonus） */
  'fitGW', 'fitGF',      /* v1.6.50（用户 10-10 裁定「B 也可以做」）：把出厂闸的广度维度折进适应度（默认 0 ⇒ 逐位不变）
                          *   —— 缺这一处就被入口黑键闸拦（D172 立的"三处名单齐全"规矩的第三处）。 */
  /* v1.5.274（§E91）：补 `ringW` —— 它在 `ECON_REWARD_KEYS`（引擎）与 `ECON_ENV_KEYS`（env 名单）里都齐，
   * 唯独这个入口的投递名单没有 ⇒ `EPIRUS_RING_W` 被黑键闸拦下（实测：整臂 exit 6，一秒响）。
   * 这正是 D172 立的"三处名单齐全"规矩的第三处；不设这个键时 `readEconEnv` 给 null ⇒ 不进 payload ⇒ 出厂行为逐字不变。 */
  'ringW',
  /* v1.6.0（DS · 千问 §1.3 点名的黑键）：补 `divK` —— 它此前在 `ECON_REWARD_KEYS`（引擎）与 env 名单里都齐，
   * 唯独**不在这个 CLI 白名单**里 ⇒ 从本入口调 `--divK` 会撞「检测到本入口读不到的旋钮 ⇒ exit 6」（千问 10-03 00:2x 实测）。
   * 照 v1.5.274 补 `ringW` 的同一次做法：补进来，并让 D218 的登记腿跟着扫。 */
  'divK',
  /* v1.8.29（用户裁定 10-23「失效技能应该都要给奖励」）：失效成功 / 理想情况两档价钱的**投递名单**。
   * 缺这一处的症状与 ringW/divK 那两次逐字相同：`ECON_ENV_KEYS`+`ECON_REWARD_KEYS` 都齐，
   * 但 `extendSelfWithCliEcon()` 推不出"本入口认得它" ⇒ 一上臂就撞黑键闸（整臂 `exit 6`，一秒响）。 */
  'voidW', 'voidIdealW',
  /* v1.8.36（夜班 #58）：开局珠塑形 `beadSeed` 的**投递名单**（缺这处的症状与 voidW/divK 那两次逐字相同：
   *   `ECON_ENV_KEYS`+`ECON_REWARD_KEYS` 都齐，但本入口的"我认得哪些奖励键"推不出它 ⇒ 一上臂就撞黑键闸 `exit 6`）。 */
  'beadSeed',
  /* v1.8.37（10-25 ZCode · 激光眼移植批 §二十一）：珠种档（枚举键 elec/boom；缺这处同样撞黑键闸。
   * ⚠ 派生探针喂 0.5 时 `readEconEnv` 透传非空值 ⇒ 能认出；真正的值校验在 evo.js 的 setter（响亮拒）。
   * 注释里不给值加单引号（D77/登记腿那族正则会把引号串当键名）。 */
  'beadSeedKind',
  /* v1.8.37 夜班续（10-26 千问 §E763）：**补贴局的珠种**（枚举 elec/boom）与**按珠种拆开的珠奖励**。
   * 缺这两处的症状与 beadSeedKind/voidW/divK 那几次逐字相同：`ECON_ENV_KEYS` + `ECON_REWARD_KEYS` 都齐，
   * 但本入口的"我认得哪些奖励键"推不出它们 ⇒ 一上臂就撞黑键闸 `exit 6`。
   * ⚠ 注释里不给值加单引号（D77/登记腿那族正则会把引号串当键名）。 */
  'subBeadKind', 'beadBoomW'];
(function extendSelfWithCliEcon() {
  for (const k of ECON_ENV_KEYS) {
    /* v1.5.254：**同一个 env 名要试两种取值** —— 数值档喂 `0.5`、布尔档喂 `'1'`。
     * 病（我接 econ 族 5 键时实测）：`EPIRUS_CONV_RATIO`/`EPIRUS_HOARD_LEFTOVER` 在 `readEconEnv` 里是
     * `=== '1' ? true : null`（**布尔档**）⇒ 只喂 `0.5` 时它返回 null、命中列表为空 ⇒ 派生失败 ⇒
     * 这两个键在 CLI 上仍是 `exit 6`（"名单里有、但本工具认不出"）。试两档能一次治好**所有**布尔档键，
     * 而不是给这两个名字开特例。 */
    let hit = [];
    for (const v of [0.5, '1']) {
      const probe = {}; probe[k] = v;
      const g = readEconEnv(probe);
      hit = Object.keys(g).filter(function (r) { return g[r] != null; });
      if (hit.length === 1) break;
    }
    if (hit.length === 1 && CLI_ECON_REWARD_KEYS.indexOf(hit[0]) >= 0 && SELF_ENV_KEYS.indexOf(k) < 0) SELF_ENV_KEYS.push(k);
  }
})();
/* v1.5.200：黑键 / 已删键的判定交给**单一来源** `server/knob-guard.mjs`（原先只有本工具一份 IIFE，
 * 于是只有这一个入口有这道闸 —— `train-best` / `train-fast` / 页面训练服务收到读不到的键一律**静默**，
 * `EPIRUS_KILL_REWARD` 就是这么在那些入口上跑成 A/A 的：产物与不带它那次逐字节相同）。
 * 判据同时升级：不再是「ECON ∪ FIGHT 名单 − 本工具闭集」，而是
 *   **全仓（tools/ + server/，排除 js/）有人真读的键 − 本入口读得到的键**，
 * 而「本入口读得到」由 `entry` 的**传递 import 闭包**扫出来（不手抄名单）∪ `SELF_ENV_KEYS`（经单一来源列表读的那些）。
 * `EPIRUS_ALLOW_DARK=1` 仍放行；`REMOVED_TRAIN_KEYS`（已删除的键）仍响亮拒绝。 */
enforceKnobs({
  tool: 'train-3p',
  env: process.env,
  entry: 'training/train-3p.mjs',
  extraReadKeys: SELF_ENV_KEYS,
  removed: REMOVED_TRAIN_KEYS,
});

/* ===== v1.5.226（用户批准）：把**实际生效的 `EPIRUS_*` 配方**机械地写进产物 meta =====
 * 病：meta.recipe 原先是**手抄名单**（arm/seed/xn2w/kill/trainMode/counterOpps/bigtChainW/killReward/…）
 *   ⇒ **新旋钮天生不在里面**（METHODOLOGY 13「白名单两处各写一遍必出事」的同族）。
 *   后果很具体：千问 的 E9/E10 想问"哪根旋钮养出这粒包"，查 `meta` 却**没有 env** ⇒
 *   只能归因到"抽奖"，并用**前瞻实验绕道**才把问题问出来。
 * 修法：问 `knob-guard`「本入口**读得到**哪些键」（与上面 `enforceKnobs` **同一个读集**，不另抄一份），
 *   再取**环境里真的设了的**那些 ⇒ 以后加旋钮**不用改这里**。
 * 记的是"实际生效的配方"而不是"默认值"：没设的键**不**出现（默认值要看代码，不在这里猜）。 */
const EFFECTIVE_ENV = (function () {
  try {
    const r = readKeysOf({ entry: 'training/train-3p.mjs', extraReadKeys: SELF_ENV_KEYS });
    const e = {};
    Array.from(r.read).sort().forEach(function (k) { if (process.env[k] !== undefined) e[k] = process.env[k]; });
    return e;
  } catch (err) { return { __error: String((err && err.message) || err) }; }   // 读集算不出来也必须留痕，不许静默成空表
})();

/* §N6 跨 N 混适应度开关（默认 0 = 行为逐字不变；用法与红线见循环内注释） */
const XN2W = Number(process.env.EPIRUS_XN2W || 0);
/* v1.5.167（qoder §N24 · 默认 0 ⇒ 行为逐字不变）：**当选面在同分带内按「兑现广度」取大者**。
 * 动因（实测 `tools/probe-cast-vs-land.mjs`）：门禁的 G 只数「发起了几种」⇒ 现役包 G=4.44 而出手:落地 = 530:237
 * （一半以上出手没变成伤害）。把「兑现」写进**奖励**这条路已被否证（乱挥双枪 −27pt，见 `evo.js:evalSubsidyProbe` 头注）
 * ⇒ 所以它只当**同分带内的排序键**：胜率不为广度让路，带外者永不参与。 */
const SEL_LAND = Number(process.env.EPIRUS_SEL_LAND || 0);
const SEL_LAND_GAMES = Number(process.env.EPIRUS_SEL_LAND_GAMES || 20);
const SEL_LAND_TOL = Number(process.env.EPIRUS_SEL_LAND_TOL || 0.03);
/* v1.5.170（qoder §N29 · 默认 0 ⇒ 行为逐字不变）：**广度准入线**（不是排序键）。
 * 判据 = `mirrorHealth(SEL_LAND_GAMES, N, 'multi')` 的净 `effSkillsLand ≥ 本值` **且** `landedKeys ≥ 2`。
 * 标定（`mirrorHealth(20,5,'multi')` 实测）：现役 `2.66（3 种）` · 2P 槽 `2.98（3 种）` · §N28 三粒塌缩冠军 `1.00~1.24` · 最宽那粒 `1.75（3 种）`
 * ⇒ 线画在 1.5 只砍"塌成一种卡"，不砍"宽但兑现率低"。默认关，开了必须自己说剔了几粒。 */
const BREADTH_FLOOR = Number(process.env.EPIRUS_BREADTH_FLOOR || 0);
/* ===== §十一 C（千问 · 11-01 傍晚，用户"开一下"）：把**演化期**健康门槛搬进 GA（不是终局筛）=====
 * 形状搬自线上 trainer（`js/train/evo.js:3952`）：不过自对局健康门槛 ⇒ 不许进容差带 / 不配当选，
 *   然后"先按分数取带、带内取覆盖熵最高者"。与在册 `EPIRUS_BREADTH_FLOOR` 的区别：那根作用在**终局 `sel.clean`**
 *   （train-3p.mjs 里那处），正是我在 `RESULTS-2026-11-01-DAY` §十 批评过的"终局 veto 不塑形搜索"；这两根作用在**每代的父母抽取 + 名人堂准入**上（§十二 勘误后）。
 * 成本明说（**按现役配方算，不是按出厂档算** —— DS 11-04 抓到我把 8 局时代的数当现状引用）：
 *   增量 = 3 粒 × 2 桌 × `GA_GATE_GAMES`（默认 6）= **36 局/代**，分母是原生 `POP×GAMES` ⇒
 *   pop8×games8（本工具出厂档）= 64 局 ⇒ **+56%** ‖ **pop8×games24（11-03 起所有产线臂的实际档）= 192 局 ⇒ +18.75%**；
 *   等预算比较要把代数折掉：+18.75% ⇒ 150 代只能跑 **126 代**（臂账里如实写，别当免费；§十一 那句"+28%"是单桌时代的数，作废）。
 * 全代都不过线 ⇒ **饿退**：照收原生前两粒并计数（`--selCap` v1 把整代挡空后当场炸的那笔教训）。 */
const GA_GATE = Math.max(0, Number(process.env.EPIRUS_GA_GATE || 0));
/* 旗标语义（§十四 同源化后必须说清，否则"多档产物 md5 全等"又会被当成"没接电"）：
 *   判据里"两种模式各 ≥3 种"这条住在 `isWideVs` 内部、**调不下来**；本旗标只能**往上加严**。
 *   ⇒ 有效种类下限 = `max(3, GA_GATE)`：=3 ⇒ 与产品门 `broad` 的**种类那条**齐平（净兑现那条另加，严于门）；=99 ⇒ 必然全饿退（= 饿退对照腿）；
 *     <3（旧 §十一 用过 4/6）⇒ 只影响"更严"的那一侧，绝不放宽。每代打印都带有效下限，不接受"悄悄退回默认档"。 */
const GA_KINDS = Math.max(3, GA_GATE);
const GA_GATE_GAMES = Math.max(2, Number(process.env.EPIRUS_GA_GATE_GAMES || 6) || 6);

const HALL_TRACE = Number(process.env.EPIRUS_HALL_TRACE || 0);
const HALL_TRACE_OUT = String(process.env.EPIRUS_HALL_TRACE_OUT || ('scratch/hall-trace/' + (process.env.EPIRUS_ARM || 'arm') + '.jsonl'));
if (HALL_TRACE) {
  try { mkdirSync(HALL_TRACE_OUT.split(/[\\/]/).slice(0, -1).join('/') || '.', { recursive: true }); } catch (eTrace) {}
  try { unlinkSync(HALL_TRACE_OUT); } catch (eTrace2) {}
  console.log('[hall-trace] 每代指纹 → ' + HALL_TRACE_OUT + '（EPIRUS_HALL_TRACE=1；指纹 = widOfArr，与名人堂去重同式）');
}
const GA_BAND = Math.max(0, Number(process.env.EPIRUS_GA_BAND || 0));
const GA_STAT = { audits: 0, healthyGens: 0, starvedGens: 0, swapped: 0, eff1Sum: 0, lastEff1: '', noRef: 0 };
/* §十四 判据换掉（v2 被 Goodhart，见 PREREG §十三）：门槛**不自己数键**，改用两条在册判据的合取——
 *   ① 种类：`两模式 effSkills ≥3` —— 与产品门 L1 `broad` 的 `pass` 逐字同一条（`champion-gate.mjs:80-85`，
 *      它的 `src` 写着"两把尺里取更严的那把"，我这边只喂 `selfPlay` 那一把 ⇒ **这一条我和门并不同尺**，见 PREREG §十四③）；
 *   ② 出血：`两模式 effSkillsLand ≥ 参照 − LAND_TOL(0.10)` —— 这条**不在** `broad` 里，住在池级前沿尺
 *      `pool-frontier-lib.isWideVs`（消费者 `probe-pool-frontier.mjs:76`）⇒ 门槛比产品门**严**一条。
 *   为什么要第②条：v2 只数"出手种类"，而镜里反弹/防御/贴贴这些**不打血**的键几乎无代价可按压
 *   （`GATE2-s7` 出手 6 种而**落地种 1**、最大落地份额 100.0%、5P 掉 24.7pt）——就是 Goodhart。
 *   参照 = 本臂的热启动起点（量一次，与候选同 n ⇒ 配对；绝对线自带样本量依赖，见 `pool-frontier-lib` v1.5.254 注释）。
 *   ⚠ 参照**对象**与门不同：门判"入池新包 vs 现役池成员"，这里判"候选 vs 自己的起点" ⇒ 这根只保证"别把出发时的宽和出血丢掉"。
 *   代价：两模式 × 每代 top-3 ⇒ 增量 = 3×2×GA_GATE_GAMES 局镜 vs 原生 POP×GAMES 局 ⇒ **出厂档(8 局) ≈ +56%，现役档(24 局) ≈ +18.75%**（见上面 :308 那条），臂账里如实写。 */
function wideMetricsOf(params) {
  const a = T.mirrorHealth(params, GA_GATE_GAMES, 5, 'multi');
  const b = T.mirrorHealth(params, GA_GATE_GAMES, 5, 'long');
  return { gMulti: a.effSkills, gLong: b.effSkills, landMulti: a.effSkillsLand, landLong: b.effSkillsLand };
}
let GA_INC;   // undefined = 还没量；null = 没有参照（无热启动）
let BREADTH_LOG = null, BREADTH_ALL_NARROW = false;
/* ===== §E650（千问 · 预注册 `docs/research/archive/2026-11-06-october-sweep/PREREG-2026-10-19-gift-veto-qoder.md` · **默认 0 ⇒ 行为逐字不变**）=====
 * 送盾 veto：把"裸包送盾超线"从**只挡带内换人**（`bandPickByLand` 吃 `gateOk`）升成**也挡当选**。
 * 为什么不算新加阈值：判定与那个数都已有单一来源（`audit-lib.HOLO_GIFT_MAX = 6` + `e.gateOk`，:1624 那行算的就是它）；
 *   本开关只多一个**消费点**，函数体里没有第二个数（`tools/probe-gift-veto.mjs` 腿⑤ 钉这件事）。
 * ⚑ 已知风险（预注册里写死的）：贴着线的那批包，20 局的读数会随抽样长度翻判定（§E649 实测 `v7tgt2-52` 6.15→4.94）
 *   ⇒ 所以 `EPIRUS_SEL_GIFT_VETO_GAMES` 可指长度（默认沿用 `SEL_LAND_GAMES`），跑出来的账必须带上这个长度。 */
const SEL_GIFT_VETO = Number(process.env.EPIRUS_SEL_GIFT_VETO || 0);
const SEL_GIFT_VETO_GAMES = Number(process.env.EPIRUS_SEL_GIFT_VETO_GAMES || 0) || SEL_LAND_GAMES;
let GIFT_VETO_LOG = null, GIFT_VETO_ALL_SPAM = false;
const SEL_BIGT = Number(process.env.EPIRUS_SEL_BIGT || 0);
/* ===== 11-09 P1/P2（用户 11-09 上午裁定）：当选面**白防率排序键**与**用卡数地板** =====
 * 两条都默认 0=关 ⇒ 整段一行都不跑，`meta.recipe` 里留 null，与历史臂逐字相同（在册纪律）。
 * **P1 为什么是排序键而不是地板**（同口径实测 `scratch/qoder-1109-defq-caliber.mjs`，页面装配 60 局×2 seed）：
 *   分母够的 6 枚白防率 = PASS2 65.9% < CLEAR 76.8% < FOCUS 80.2% < KD-G2 82.8% < ADAPT2 85.0% ≈ KDG-B 85.1%，
 *   排序两 seed 完全一致但相邻只差 2–4pt，而 CLEAR(74.9/78.6) 与 FOCUS(79.3/81.0) **正好跨着 80%**
 *   ⇒ 任何硬地板要么落在噪声里、要么像原计划的 ≤60% 那样把 28/29 粒全否。带内排序没有悬崖。
 * **P1 的 n≥30 门为什么必须有**：同一批里 STR-B 两 seed 只有 2/3 手防御却读出 50%/66.7% ⇒
 *   没有手数门时它会以"全池防得最准"的身份通过任何筛选；DEF-s13（18/15 手）两 seed 差 8.9pt。
 *   ⇒ 手数不够按 `defense-quality` 的"没量到"处理：**既不判过也不判不过**，也不许被读成"测过且无效"。
 * **P2 用哪把尺**：`fieldProfile(params, 0, 'soft', N, seed, 'self', 'multi')` = 5 席同包镜像 · ε=0 · multi，
 *   与 `tools/card-usage.mjs`（POOL-CONTRACT v2.1 判据的出处）同一装配同一阈值（份额 ≥0.5%，**含 ジ**）
 *   ⇒ 地板 9 就是契约里那句"用卡 ≥9"。⚠ 与 `SEL_GRID` 的"种数"**差一张 ジ**（那边排除 ジ），两条别混着引用。 */
const SEL_DEFQ = Number(process.env.EPIRUS_SEL_DEFQ || 0);
const SEL_DEFQ_MINHANDS = Number(process.env.EPIRUS_SEL_DEFQ_MINHANDS || 30);
/* 11-09 用户裁定：白防率是比值 ⇒ 必须配一个**防御占比地板**（默认 0=关，历史读数逐位不变）；
 *   实测反例：只开 minHands=30 时，2.0pt 容差带会改判到「51 手 / 防御占比 1%」的包（白防 90.2% 但根本不防）。 */
const SEL_DEFQ_MINSHARE = Number(process.env.EPIRUS_SEL_DEFQ_MINSHARE || 0);
const SEL_DEFQ_GAMES = Number(process.env.EPIRUS_SEL_DEFQ_GAMES || 40);
const SEL_DEFQ_MODE = String(process.env.EPIRUS_SEL_DEFQ_MODE || 'multi');
const SEL_DEFQ_EPS = Number(process.env.EPIRUS_SEL_DEFQ_EPS || 0.1);
let SEL_DEFQ_LOG = null;
const SEL_CARDS = Number(process.env.EPIRUS_SEL_CARDS || 0);
const SEL_CARDS_GAMES = Number(process.env.EPIRUS_SEL_CARDS_GAMES || 60);   // 默认对齐 card-usage 的 60 局 ⇒ 地板值与 POOL-CONTRACT v2.1 的基准同一次测量口径
let SEL_CARDS_LOG = null;
if (!(SEL_DEFQ >= 0) || !isFinite(SEL_DEFQ)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_DEFQ 必须是 ≥0 的数（0=关，单位=重验分分差 pt）：收到 ' + JSON.stringify(process.env.EPIRUS_SEL_DEFQ));
  process.exit(2);
}
if (SEL_DEFQ > 0 && !(SEL_DEFQ_MINHANDS >= 10)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_DEFQ_MINHANDS=' + SEL_DEFQ_MINHANDS + ' ⇒ 防御是"整局才几次"的事件，' +
    '11-09 实测 2–3 手就能读出 50% 白防（全池最好看的数）⇒ 手数门低于 10 等于把噪声接进当选决策，拒跑');
  process.exit(2);
}
if (SEL_DEFQ > 0 && SEL_DEFQ_GAMES < 10) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_DEFQ_GAMES=' + SEL_DEFQ_GAMES + ' 太短（<10 局 ⇒ 凑不满手数门，白防率不可比）');
  process.exit(2);
}
if (SEL_DEFQ > 0 && typeof measureDefenseQuality !== 'function') {
  console.error('[train-3p] ⛔ SEL_DEFQ 开着但量具 `measureDefenseQuality` 没接进来 ⇒ 拒绝静默空转');
  process.exit(7);
}
if (!(SEL_CARDS >= 0) || !isFinite(SEL_CARDS)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_CARDS 必须是 ≥0 的数（0=关，单位=用卡张数）：收到 ' + JSON.stringify(process.env.EPIRUS_SEL_CARDS));
  process.exit(2);
}
if (SEL_CARDS > 30) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_CARDS=' + SEL_CARDS + ' 高于全卡种上限 30 ⇒ 这是**恒假判据**（名人堂会整批被否），拒跑');
  process.exit(2);
}
if (SEL_CARDS > 0 && SEL_CARDS_GAMES < 10) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_CARDS_GAMES=' + SEL_CARDS_GAMES + ' 太短（<10 局 ⇒ 逐卡份额不稳，地板会随抽样翻）');
  process.exit(2);
}
const SEL_BIGT_KEYS = String(process.env.EPIRUS_SEL_BIGT_KEYS || 'bigT,drain').split(',')
  .map(function (s) { return s.trim(); }).filter(Boolean);
const SEL_BIGT_GAMES = Number(process.env.EPIRUS_SEL_BIGT_GAMES || 60);
const SEL_BIGT_MODE = String(process.env.EPIRUS_SEL_BIGT_MODE || 'long');
let SEL_BIGT_LOG = null;
/* ===== §E787（用户 10-26 11:5x 裁"加上开跑"）：当选面的**场B 清场地板** =====
 * 动因（§E786 四格，同包反事实给的因果）：`U2`/`N2`/`Q4` 在官方 场B（calm 桌）上清场 **0.00**、每局伤害 1.00，
 *   而引擎自带的 `forceAttack`（选ジ而当回合枪买得起 ⇒ 改判成枪）把 `U2` 的场B 清场抬到 **3.00/4.00**
 *   ⇒ **能力在包里，是当选出来的那个策略选择不打**（苟赢：靠"没人死 + 血量排名"100% 胜）。
 * 为什么是 veto 而不是奖励：`CLEAR_W` 已在册否证（`js/train/evo.js:75` 引 §N8 `xn10b`："奖励一生效，
 *   带内最高分被**纯ジ龟包**拿走 ⇒ 奖励收割 ≠ 学会收割"）⇒ 地板**不进目标函数**，没有可被收割的对象，
 *   恰是那次的对症药。**不加新尺**（`aggressionProfile` = 门禁 `fieldB.clearedPerGame` 同源）、**不新增门**。
 * 取严：`multi` 与 `long` 两桌各量一次、取**更差**的那一桌当判据（与 v1.5.268"两模式都判"、
 *   10-25"广度取严"同一规矩；单桌当判据会被另一桌打脸——§E75 那次就是 multi 过而 long 反向）。 */
const SEL_CLEAR = Number(process.env.EPIRUS_SEL_CLEAR || 0);
const SEL_CLEAR_GAMES = Number(process.env.EPIRUS_SEL_CLEAR_GAMES || 40);
let SEL_CLEAR_LOG = null;
if (!(SEL_CLEAR >= 0) || !isFinite(SEL_CLEAR)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_CLEAR 必须是 ≥0 的数（0=关）：收到 ' + JSON.stringify(process.env.EPIRUS_SEL_CLEAR) +
    ' —— 非数值/负数一律拒，不许 clamp 之后谎称"开过了"');
  process.exit(7);
}
if (SEL_CLEAR_GAMES < 10) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_CLEAR_GAMES=' + SEL_CLEAR_GAMES + ' 太短（<10 局 ⇒ 清场这种"整局才一次"的事件量不出稳定读数）');
  process.exit(7);
}
if (SEL_CLEAR > 4) {
  console.log('[train-3p] ⚠ EPIRUS_SEL_CLEAR=' + SEL_CLEAR + ' 高于 场B 的物理上限（4 席全打死 = 4.00/局）⇒ 这是**恒假判据**，' +
    '跑完会全剔并标 selClearAllDropped；确认这不是你想要的剂量再往下跑');
}

const ANCHOR = Number(process.env.EPIRUS_ANCHOR || 0);   // v1.5.153：锚定正则 λ（0=关，逐字不变）
/* ===== 11-04（千问 · 用户命题"好方法 + 冷启动 + 长代能不能出一个有用的包"）：**锚点选谁** =====
 *   `seed`（缺省 ⇒ 与历史臂逐字同）‖ `widest`（**覆盖锚 / 棘轮**）。
 * 为什么不是锚在种子：在册三次的"时长-宽度交换"（§二十六 D1200/L5-1200 ‖ §四十八 CB3L ‖ 千问 §十一）说明
 *   收缩的方向是**离开本臂已经到过的那一版宽度**，不是离开起点 ⇒ 缰绳（锚在种子）只能"少动"，棘轮能"只进不退"：
 *   允许往更强走，但不许丢掉已达到的宽。附带效果：**冷启动臂（没有种子）第一次有可用的锚**。
 * 代价：不新增测量 —— 复用 `GA_GATE` 那份 top-3 镜局读（ ⇒ 要求同开，否则宽度没得比）。 */
const ANCHOR_TO_RAW = String(process.env.EPIRUS_ANCHOR_TO || 'seed').trim();
if (ANCHOR_TO_RAW !== 'seed' && ANCHOR_TO_RAW !== 'widest') {
  console.error('[anchor] ⛔ `EPIRUS_ANCHOR_TO` 只认 seed / widest，收到 ' + JSON.stringify(process.env.EPIRUS_ANCHOR_TO)
    + ' ⇒ 拒绝把它当默认关（锚点选错等于换了目标函数，不许静默回落）');
  process.exit(2);
}
const ANCHOR_TO = ANCHOR_TO_RAW;
if (ANCHOR > 0 && ANCHOR_TO === 'widest' && GA_GATE <= 0) {
  console.error('[anchor] ⛔ `EPIRUS_ANCHOR_TO=widest` 要复用 `GA_GATE` 的宽度读 ⇒ 必须与 `EPIRUS_GA_GATE` 同开（单开没有"最宽"可比）');
  process.exit(2);
}
let anchorRef = null;          /* {params, wid, gen, wideScore, g} —— widest 模式下逐代只进不退 */
let anchorRefMoves = 0;
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
/* ===== v1.5.194（qoder 0924 夜 · 用户指派）：**击杀奖励规则下的训练** =====
 * `EPIRUS_KILL_REWARD=1|2` ⇒ 在**内存里**给 `resolve.js`/`play.js` 打补丁（仓库文件一字不动 ⇒ **规则指纹不变**、
 * 门禁不红、线上不受影响），让整条训练链（评分 / 终评 / 当选面）都跑在"带击杀奖励的世界"里。
 * 三条纪律：
 *   ① 规则的**实现**在 `tools/kill-reward-lib.mjs`，与 `probe-kill-reward` **同源** —— 两处各写一遍会训出
 *      "和量出来的不是一套规则"的冠军（本仓为这类病栽过六次）；
 *   ② 下达后必须**行为式读回**：跑一局确认钩子真跑过（`state.__krPaid` 在）且事件真带上归因字段 ——
 *      只看变量到位就是本仓最恨的 "seam 2"；
 *   ③ 产物 meta 必须记 `killReward`，否则第二天没人知道这粒是哪套规则训出来的。 */
const KR_MODE = Number(process.env.EPIRUS_KILL_REWARD || 0);
if (!(KR_MODE === 0 || KR_MODE === 1 || KR_MODE === 2)) {
  console.error('[train-3p] ⛔ EPIRUS_KILL_REWARD=' + process.env.EPIRUS_KILL_REWARD + ' 不是合法档（只认 0=关 / 1=单点 / 2=按伤害）');
  process.exit(7);
}
for (const f of [
  'js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'
]) {
  let txt = readFileSync(f, 'utf8');
  if (KR_MODE === 1 || KR_MODE === 2) {
    if (f === 'js/core/resolve.js') txt = krPatchResolve(txt);
    if (f === 'js/core/play.js') txt = krPatchPlay(txt);
    /* v1.5.232：序列奖励必须**打进源码** —— `evo.js` 内部构造 chooser 走模块级局部函数，
     * 属性层包装会被绕过 ⇒ 付款进不了被打分的对局（实测四次 A/B 付款 78/28/125/165 次、冠军却逐字相同）。 */
    if (f === 'js/train/evo.js' && Number(process.env.EPIRUS_SEQ_W || 0) > 0) txt = seqPatchEvoChooser(txt);
  }
  vm.runInNewContext(txt, sb, { filename: f });
}
/* ===== v1.5.229（用户批准方案 a）：序列奖励 =====
 * 判定不需要打源码补丁（与击杀奖励不同）：蓄能/电磁炮在**事件流**里已有
 *   `{type:'bead', pid, kind:'elec'}` 与 `{type:'action', pid, key:'railgun', outcome:'ok'}`
 * ⇒ 只要在**决策点**上扫一次新增事件。注入点 = 包一层 `EpirusTrainer.policyChooserN` **工厂**：
 *   返回的每个 chooser 都先 tick ⇒ 一次覆盖 mirrorHealth / 评估 / 真桌**所有**路径（含 evo.js 内部调用）。
 * 默认 0 ⇒ 不包、行为逐字不变。⭐ 用了它训出来的包是在**另一套经济**下长大的，`meta.recipe.env` 会自动记下。 */
const SEQ_W = Number(process.env.EPIRUS_SEQ_W || 0);
/* v1.8.37（10-25 ZCode · §二十一 激光眼移植批）：序列奖励的**珠种档**。
 * 'elec'（缺省）= v1.5.229 原义（蓄电珠→电磁炮，历史臂逐字可复现）；'boom' = 蓄爆珠→激光眼（`resolve.js`
 * 的 charge 事件本来就用 `opt.bead` 带 `kind:'boom'` ⇒ 判定不用动引擎）。别的值响亮拒（exit 6）。 */
const SEQ_KIND = String(process.env.EPIRUS_SEQ_KIND || 'elec');
let SEQ = null;
if (!(SEQ_W >= 0 && SEQ_W <= 10)) {
  console.error('[train-3p] ⛔ EPIRUS_SEQ_W=' + process.env.EPIRUS_SEQ_W + ' 不是合法档（只认 0~10 的数字，0=关）');
  process.exit(6);
}
/* 11-12 夜（研究矩阵结论）：第三档 `hit:<键,键>` = 按真实落地伤害付费（见 seq-reward-lib 头注）——
 *   键名必须**在卡表里**且是伤害卡（黑键同族：拼错的键 = 奖励永远付不出 = 静默空转 ⇒ 响亮拒）。 */
const SEQ_HIT = /^hit:([a-zA-Z,]+)$/.exec(SEQ_KIND);
if (SEQ_HIT) {
  const BYK = sb.window.EpirusRules.byKey || {};
  const bad = SEQ_HIT[1].split(',').filter(Boolean).filter((k) => !BYK[k] || k === 'ji');
  if (bad.length) { console.error('[train-3p] ⛔ EPIRUS_SEQ_KIND=' + SEQ_KIND + ' 里的键不在卡表（或是 ジ）：' + bad.join(',')); process.exit(6); }
} else if (SEQ_KIND !== 'elec' && SEQ_KIND !== 'boom') {
  console.error('[train-3p] ⛔ EPIRUS_SEQ_KIND=' + process.env.EPIRUS_SEQ_KIND + ' 不是合法档（只认 elec/boom/hit:<键,键>，缺省 elec）');
  process.exit(6);
}
if (SEQ_W > 0) {
  SEQ = makeSeqReward(sb.window.EpirusRules, SEQ_W, SEQ_KIND);
  /* 关键：把 SEQ 挂成**沙箱全局** —— `patchEvoChooser` 插进 evo.js 的包装层读的就是 `__SEQ`。 */
  sb.__SEQ = SEQ;
  sb.window.EpirusTrainer.policyChooserN = SEQ.wrapChooserFactory(sb.window.EpirusTrainer.policyChooserN);
  console.log('[序列奖励] EPIRUS_SEQ_W=' + SEQ_W + ' EPIRUS_SEQ_KIND=' + SEQ_KIND + ' ⇒ **在内存里**给"' +
    (SEQ.hitKeys ? '命中(' + SEQ.hitKeys.join('/') + ') 每次真实落地' : (SEQ_KIND === 'boom' ? '蓄爆珠 → 激光眼' : '蓄能[电珠] → 下一回合电磁炮')) + '" +' + SEQ_W +
    ' ep（仓库文件一字不动 ⇒ 规则指纹不变；本臂产物**不是**现状规则下的冠军，`meta.recipe.env` 会记下）');
  /* v1.5.229：收尾必须印**实际付了多少** —— 否则"奖励没效果"分不清是"代际太短"还是"训练场里这个事件根本不发生"
   * （后者意味着奖励永远付不出去，梯度为零 ⇒ 与击杀奖励"付得太少"同族，但更极端）。 */
  process.on('exit', function () {
    if (SEQ.hitKeys) {
      console.log('[序列奖励·结账] 本臂共发放 ' + SEQ.events + ' 次 · ' + SEQ.paid + ' ep（分母：本臂总局数 ' + GENS * GAMES * POP +
        ' ‖ 按键：' + SEQ.hitKeys.map((k) => k + '=' + (SEQ.byKey[k] || 0)).join(' · ') +
        ' · 首次付款第 ' + SEQ.firstPayRound + ' 回合；每局 ' + (SEQ.events / Math.max(1, GENS * GAMES * POP)).toFixed(4) + ' 次）' +
        (SEQ.events === 0 ? '  ⛔ **一次命中都没有** ⇒ 奖励付不出去（课程/热启动的问题，不是奖励的问题）' : ''));
      return;
    }
    console.log('[序列奖励·结账] 本臂共发放 ' + SEQ.events + ' 次 · ' + SEQ.paid + ' ep（分母：充到' +
      (SEQ_KIND === 'boom' ? '爆珠' : '电珠') + ' ' + SEQ.charges +
      ' 次 · 首次第 ' + SEQ.firstCharge + ' 回合 · 首次付款第 ' + SEQ.firstPayRound + ' 回合；每股 ' + (SEQ.events / Math.max(1, GENS * GAMES * POP)).toFixed(4) + ' 次）' +
      (SEQ.charges === 0 ? '  ⛔ **训练场里连一次珠都没充过** ⇒ 不是奖励的问题，是课程/热启动的问题' : (SEQ.events === 0 ? '  ⛔ 充了珠但一次没转化 ⇒ 奖励付不出去' : '')));
  });
}
let KR_REQ = 0, KR_PAID_PROBE = -1;
if (KR_MODE === 1 || KR_MODE === 2) {
  sb.__KR = krMakeKR(sb.window.EpirusRules, sb.window.EpirusState, KR_MODE, { transfer: process.env.EPIRUS_KR_TRANSFER || 'owner' });
  /* 行为式读回：跑一局确认钩子真跑过（`state.__krPaid` 在）且事件真带上归因字段。
   * ⚠️ 这里**故意不用冠军包** —— 此刻 `js/bundled-champion-3p.js` 还没进沙箱（它在下面才加载），
   *    第一版我拿 `EPIRUS_CHAMPION_3P` 去 unpack ⇒ 拿到 null ⇒ policy 里 `shapeOf(null)` 直接抛。
   *    钩子是否与谁下注无关，用脚本池照样能证明"补丁真的在引擎里跑"。 */
  const T0 = sb.window.EpirusTrainer, B0 = sb.window.EpirusBots;
  const chs = [];
  for (let pid = 0; pid < 5; pid++) chs.push(function (s2, p2, lg) { return B0.pickAggro(s2, p2, lg); });
  const probe = T0.oneGameN(chs, 99991, 5, { mode: 'multi' });
  KR_PAID_PROBE = probe.state.__krPaid;
  const hasAttr = (probe.state.events || []).every(function (e) { return e.type !== 'damage' || ('mineFrom' in e && 'fireFrom' in e && 'transferBy' in e); });
  if (KR_PAID_PROBE === undefined || KR_PAID_PROBE === null || !hasAttr) {
    console.error('[train-3p] ⛔ 击杀奖励钩子没跑起来（__krPaid=' + KR_PAID_PROBE + ' · 归因字段齐=' + hasAttr + '）⇒ 拒绝静默按现状训练');
    process.exit(7);
  }
  KR_REQ = KR_MODE;
  console.log('[train-3p] **击杀奖励规则已下达**：mode=' + KR_MODE + '（' + (KR_MODE === 1 ? '单点：+1ep 给最高优先级/最高开销者，仍并列则都不回' : '按伤害：每位参与者按有效伤害回 ep，overkill 不付') + '）' +
    ' · 转移归因=' + (process.env.EPIRUS_KR_TRANSFER || 'owner') + ' · 行为式读回 __krPaid=' + KR_PAID_PROBE +
    ' · 蓄能计入开销（电磁炮/激光眼首次 +1）· 地雷/天火无来源也归因（走 mineFrom/fireFrom，**不动 R57 的 source:null**）');
}

const P = sb.window.EpirusPolicy;
/* 11-10（DS）：arch2.install 会把 P.unpack 覆盖成「只认 v92」的版本 ⇒ 先把**原始 legacy unpack** 留一份，
 *   否则 v7 冠军（如 Q-s47）永远载不进来（报「同架构才行」）。 */
const P_LEGACY_UNPACK = (typeof P.unpack === 'function') ? P.unpack.bind(P) : null;
// setRng must run AFTER the engine is loaded.
// I first put it before the vm.runInNewContext loop -> crashed with
// Cannot read properties of undefined (reading 'setRng'),
// which silently turned my "same sha twice" check into a VACUOUS one
// (it was re-reading an unchanged file).
__seedSandbox(sb, __SEED);   // 必须在引擎加载之后（vm 上下文可能不反映加载前的属性替换）
if (P.setRng && sb.window.EpirusTrainer.mulberry32) P.setRng(sb.window.EpirusTrainer.mulberry32(__SEED * 7919 + 13));

const Bots = sb.window.EpirusBots;
const T = sb.window.EpirusTrainer;

/* ===== §E821（10-28 傍晚 · 千问 · 研究分支）：`EPIRUS_ARCH2` ⇒ 本进程换成 **2.0 结构** =====
 * 为什么是"覆盖导出入口"而不是改 `js/train/policy.js`：
 *   ① `js/**` 一字未动 ⇒ **规则指纹不变**（policy.js 在 `tools/rules-fingerprint.mjs` 的指纹文件表里，
 *      动它会让 D16/N19/D34/D234 一起翻，而这一格现在要测的是结构、不是门禁搬家）；
 *   ② 发局 / 座位轮转 / playoff / 名人堂全部沿用 `T.scoreMemberN` / `T.evalN` ⇒ **不存在第二套评估算术**
 *      （本仓"两份同构实现必漂移"是老病，`tools/probe-settle-capture.mjs` 头上就写着）；
 *   ③ 只活在这个训练进程里 ⇒ 产品、页面、评测装配看不到 2.0。
 * ⚠ 三条代价（写在这里，不许偷偷吃）：
 *   · 2.0 **没有热启动**：v7 包在 2.0 的 `unpack` 下必 null ⇒ 带 `EPIRUS_HOTSTART=1` 会当场 `exit 5`
 *     （这是好事：宁可退出也不静默冷启动，09-22 臂 7/8 的教训按同一条规矩执行）。
 *     ⇒ 本批只能与"同为随机起点的 2.0 臂"互比，**不许**拿夺一率去横比 §E818 那五枚 v7 臂。
 *   · 前向比 v7 贵 ⇒ 横比只比**评估次数**，不比墙钟（在册条款）。
 *   · `EPIRUS_MUT_MODE=seg|flat` 换的是**优化器算子**（段感知 σ / 段级交叉 vs 逐位均匀），与结构正交
 *     ⇒ 这一对正交旋钮就是本波要测的"哪种优化器配这种结构"。
 */
let A2_INSTALLED = null;
if (process.env.EPIRUS_ARCH2) {
  const spec = String(process.env.EPIRUS_ARCH2);
  const parts = spec.split(':');
  const cfg = { mutMode: String(process.env.EPIRUS_MUT_MODE || 'seg') };
  if (parts[1]) parts[1].split(',').forEach(function (kv) { const e = kv.split('='); if (e.length === 2) { const v = e[1].trim(); cfg[e[0].trim()] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; } });
  if (process.env.EPIRUS_NORM) {
    /* E1（DS · 11-02 晚）：ctx 输入逐维标准化统计量（离线语料算好；随包存 dims.norm，推理自动复用）。 */
    try { cfg.norm = JSON.parse(readFileSync(String(process.env.EPIRUS_NORM), 'utf8')); }
    catch (e) { console.error('[train-3p] ⛔ EPIRUS_NORM 读不出：' + String(e && e.message || e)); process.exit(7); }
    if (!cfg.norm || !Array.isArray(cfg.norm.mean) || !Array.isArray(cfg.norm.std)) { console.error('[train-3p] ⛔ EPIRUS_NORM 要 {mean:[], std:[]}'); process.exit(7); }
    console.log('[train-3p] 输入标准化：' + String(process.env.EPIRUS_NORM) + '（' + cfg.norm.mean.length + ' 维）');
  }
  const A2 = installArch2(sb.window, cfg);
  A2_INSTALLED = A2;
  const __wantFace = (String(spec).match(/input=(obs3c|obs3b|obs3|obs4|obs5|obs6|v7)/) || [])[1];   /* ⚑ 最长优先：obs3c 不能被 obs3 抢先匹配（11-02 冒烟） */
  if (__wantFace && A2.L && A2.L.input !== __wantFace) {
    console.error('[train-3p] ⛔ EPIRUS_ARCH2 spec 写了 input=' + __wantFace + ' 但实际装出的面是 ' + A2.L.input +
      '（横幅与实际不一致 = 静默错结构，11-01 冒烟抓到的形状）⇒ 拒绝开跑');
    process.exit(7);
  }
  /* ⚑ 开臂前的**接线自证**（10-28 晚三波作废读数换来的）：打一局看 `forwardCands` 有没有被叫到。
   *   根因写在 arch2 里：`evo.js:21` 的 `LEGACY(params)` 把"形状认不出来"的包判成旧包 ⇒ 走旧口径 ⇒
   *   覆盖的入口一次都没被调用，而 `fit` 照样出数、臂照样跑完 ⇒ **"没崩"与"接上了"同形**。 */
  let WIRED;
  try { WIRED = verifyArch2Wired(sb.window, A2, { mode: (process.env.EPIRUS_TRAIN_MODE || 'multi'), n: N, games: 1 }); }
  catch (e) { console.error('[train-3p] ⛔ ' + String(e && e.message || e)); process.exit(7); }
  /* 变异/初始化必须走**同一颗播种 RNG**（与上面 `P.setRng(mulberry32(...))` 同源），否则"同 seed 同配置 ⇒ 产物一致"这条在册证据就断了 */
  if (T.mulberry32) A2.rngRef.r = T.mulberry32((__SEED * 7919 + 13) >>> 0);
  console.log('[train-3p] ⚙ **架构 = 2.0 原型 `' + spec + '`**（§E821，`tools/proto2/arch2.mjs` 覆盖 paramCount/makePolicy/mutatePolicy/crossover/forwardCands/chooseCandidates/pack/unpack）' +
    ' ‖ paramCount=' + P.paramCount() + ' ‖ **解析后的面=' + A2.L.input + '**（与 spec 串分开印——11-01 冒烟：串写 obs3b 实际落 v7，别再让横幅说谎）' +
    ' ‖ 变异算子=' + cfg.mutMode + ' ‖ 热启动=只认 v:92 包（v7 包读不进 ⇒ exit 5）');
  console.log('[train-3p]   ⚠ 可比性：与本文件任何 v7 历史读数**不同源**（起点是随机、维度是新结构）⇒ 只在 2.0 臂之间横比，且只比评估次数');
  /* ⚑ 11-02（千问）：**当选面量具也必须活在同代世界里** —— 病是这么撞出来的：我给 `SEL_DEF` 做校准时，
   *   钩子报"当选者防御 15.0 手/局 ‖ 占出手 71.1%"，而同一个产物用与它同代的路径直接量是 **0.00**（`scratch/seldef-checks.log` ‖ 本次标定）。
   *   根因：`SEL_BIGT`(v1.5.326) ‖ `SEL_CLEAR`(§E787) ‖ 新加的 `SEL_DEF` 都调 `fieldProfile/aggressionProfile(WIN, …)`，
   *   而 `WIN` 是 `behavior-profile.mjs` 自己 `sandbox()` 出的**第二个引擎沙箱**，此前从没被 arch2 覆盖 ⇒
   *   在 2.0 臂里它拿 **v7 前向读代 3 权重**（`evo.js:21` 的 `LEGACY` 认形状那条老路）， ⇒ 排序键会拿"另一个世界的读数"换人，**且不崩不报错**。
   *   修法只在 2.0 分支里做（v7 路径、promote、门禁一个字节不动），装完立刻用 `verifyArch2Wired` 自证真被调用（"横幅证明变量、证明不了效果"是本页在册教训）。 */
  /* ⚑ 11-10 改判（千问 · 用户令"先做短的整理"）：**接线不再按名单例外，2.0 臂一律接**。
   *   原条件是三行上面那份六根 SEL 旗标的硬编码 OR，而"谁在读 WIN 这把尺"是会长的：
   *   `EPIRUS_CARD_ABORT`（:2486 `cardUsageProfile(WIN,…)`，11-10 才加的杀臂地板 ⇒ 一咬就 exit 13、产物不落）与
   *   `SEL_KEEP`/`SEL_LAND`/`BREADTH_FLOOR`/`EFFSKILL_MIN` 那一段（:2891 → :2980 `fieldProfile(…)`，它内部用的就是 WIN）
   *   **都不在那六根里** ⇒ 2.0 臂只开这两族时，当选面与早杀读的都是"v7 前向代 2.0 权重"，且不崩不报错（:809 那次同一个病）。
   *   代价：多打一局 `games:1` 的自证；不消费 WIN 的臂行为逐字不变（没人读 ⇒ 装了也没人用）。 */
  {
    let AW = null, wiredMsg = '';
    try {
      AW = installArch2(WIN, cfg);
      const WC = verifyArch2Wired(WIN, AW, { mode: (process.env.EPIRUS_TRAIN_MODE || 'multi'), n: 5, games: 1 });
      wiredMsg = 'forwardCands 自证通过' + (WC && WC.L ? '（面=' + WC.L.input + '）' : '');
    } catch (e) {
      console.error('[train-3p] ⛔ 量具沙箱 WIN 的 2.0 接线没生效：' + String((e && e.message) || e) +
        ' ⇒ 拒跑（当选面排序键会拿 v7 前向读代 3 权重，读数不可信）');
      process.exit(7);
    }
    if (AW.L && cfg.input && String(AW.L.input) !== String(cfg.input)) {
      console.error('[train-3p] ⛔ WIN 侧装出的面=' + AW.L.input + ' ≠ spec 的 ' + cfg.input + ' ⇒ 拒跑');
      process.exit(7);
    }
    const WIN_READERS = [['SEL_BIGT', SEL_BIGT], ['SEL_CLEAR', SEL_CLEAR],
      ['SEL_DEFQ', SEL_DEFQ], ['SEL_CARDS', SEL_CARDS], ['SEL_LAND', SEL_LAND],
      ['BREADTH_FLOOR', BREADTH_FLOOR],
      ['CARD_ABORT', Number(process.env.EPIRUS_CARD_ABORT || 0)]].filter(function (f) { return f[1] > 0; });
    console.log('[train-3p] ⚙ **量具同代已接线**：behavior-profile 的沙箱 WIN 也装了 arch2 ‖ 面=' + AW.L.input +
      ' ‖ paramCount=' + WIN.EpirusPolicy.paramCount() + ' ‖ ' + wiredMsg +
      ' ⇒ `fieldProfile/aggressionProfile/cardUsageProfile/measureDefenseQuality` 的读数与产物同代' +
      ' ‖ 这一臂在读这把尺的旗标：' + (WIN_READERS.length ? WIN_READERS.map(function (f) { return f[0] + '=' + f[1]; }).join(' ') : '（无 ⇒ 接了但本臂不消费）') +
      '【这份名单只点名，**不再决定接不接线**】');
  }
}

/* ===== §E275（v1.5.334）：**部署档的 CLI 把手**（大雷 `BIGT_PUSH` / 摄魂 `DRAIN_PUSH`）=====
 * 为什么必须有：v1.5.333 起大雷那档是**引擎默认**，于是"训练桌"也带着它跑 ⇒
 *   凡是前提为"这一档关着"的量具（门 D135 的"这一项的非零只能来自注入"）都必须能**显式关掉**。
 * 三条纪律：① 引擎内不读 `process.env`（`evo.js:30` 的 setWrTol 模式）⇒ 读环境是本 CLI 的活；
 *   ② 下达后**由引擎回读**逐键比对，不一致 ⇒ `exit 7`（v1.5.262 那次"过了黑键闸却从没送给引擎"的同一族病）；
 *   ③ 不设 ⇒ 一行都不动 ⇒ 现网默认形状逐字不变。 */
/* 11-02 上午（千问 · 用户裁"注入档按训练目标分档"之后必须有字据）：四键的**生效值一律回读并落进产物 meta**，
 *   不管有没有下达 ⇒ 治的是"GATE4b 那批只靠 mtime 推它当时带不带档"这种无字据状态。
 *   行为不改：不设仍是一行都不动，只是把"当前到底是多少"从口头假设变成盘上记录。 */
const DEPLOY_REC = {};
(function applyDeployKnobs() {
  /* 11-01 深夜（用户裁定「3 代训练和考试把引擎干预全关」）：名单从两键扩到四键——
   *   大雷(硬兑现,默认12=开) / 摄魂(eps软注入,默认1,节点侧到不了也显式关) /
   *   贴贴(eps软注入,默认0=关) / 送盾先验(全息屏障部署层先验,默认0=关)。
   * 后两个默认本来就是 0 ⇒ 不设环境变量时逐字不变；显式设 0 是把"关"落成**回执**（拒"应该关着吧"这种口头关法）。 */
  const KN = [['EPIRUS_BIGT_PUSH', 'setBigTPush', 'bigTPushOn'], ['EPIRUS_DRAIN_PUSH', 'setDrainPush', 'drainPushOn'],
    ['EPIRUS_CURSE_PUSH', 'setCursePush', 'cursePushOn'], ['EPIRUS_SUPPORT_PRIOR', 'setSupportPrior', 'supportPriorOn'],
    ['EPIRUS_MIX8', 'setMix8Every', 'mix8Every'],   /*（ZCode · 11-02 深夜）训练形状档（非干预档）：每第 K 局 8 人桌，地雷的 8P 课；记录器自动落 requested/effective */
    ['EPIRUS_MIX2_EVERY', 'setMix2Every', 'mix2Every'],   /*（ZCode · 11-06 夜）同代混桌：每第 K 局 2 人桌（DS 待办 2）；记录器自动落 requested/effective */
    ['EPIRUS_COURSE_EVERY', 'setCourseEvery', 'courseEvery'],   /*（ZCode · 11-06 夜）课程席：每第 K 代注一席脚本对手（D-08 机制解） */
    ['EPIRUS_MIXHP_EVERY', 'setMixHpEvery', 'mixHpEvery'],   /*（ZCode · 11-06 深夜）桌形混合：每第 K 局换对偶桌（3血适应） */
    ['EPIRUS_HPSEED', 'setHpSeed', 'hpSeedOn'],   /*（ZCode · 11-02 深夜）残血开局课程——摄魂 (b) 线（p 比例局全席对称 HP=min(2,modeHp-1)，课程局照常进 fit） */
    /* 11-12 修接线：聚能环强探档与其它部署档同表下达；此前只列在 SELF_ENV_KEYS，
     *   实际只有 train-worker 消费 ⇒ 产线臂静默无效（R5 的“无效实验”根因）。 */
    ['EPIRUS_RING_FORCE_EPS', 'setRingForceEps', 'ringForceEps'],
    ['EPIRUS_RING_FORCE_UNTIL', 'setRingForceUntil', 'ringForceUntil']];
  const unset = [];
  for (const [envName, setter, getter] of KN) {
    const raw = process.env[envName];
    if (typeof T[getter] !== 'function') { DEPLOY_REC[envName] = { requested: raw == null || raw === '' ? null : Number(raw), effective: null, note: '引擎无 ' + getter }; continue; }
    const eff = () => Number(T[getter]());
    /* ⚠ `EPIRUS_SUPPORT_PRIOR` 在本入口有**第二个读者**（下面那族按 v1.7.128 的裁定取 CLI 默认 2）⇒ 横幅不许报引擎出厂值 0，
     *   否则它就成了一张"0=关"的假证据（11-02 夜班那张表就是这么错的）。真实生效值以 `meta.deployKnobs` 为准。 */
    if (raw == null || raw === '') {
      unset.push(envName + '=' + eff() + (envName === 'EPIRUS_SUPPORT_PRIOR' ? '（稍后按 CLI 默认取 2，不是 0）' : ''));
      DEPLOY_REC[envName] = { requested: null, effective: eff() }; continue;
    }
    if (typeof T[setter] !== 'function') {
      console.error('⛔ ' + envName + ' 下达了，但引擎没有 `' + setter + '`/' + getter + ' ⇒ 这是黑键，拒跑'); process.exit(6);
    }
    T[setter](Number(raw));
    const back = eff();
    DEPLOY_REC[envName] = { requested: Number(raw), effective: back };
    if (back !== Number(raw)) {
      console.error('⛔ ' + envName + '=' + raw + ' 没生效：引擎回读 ' + back + ' ⇒ 拒静默空转'); process.exit(7);
    }
    console.log('[部署档] ' + envName + ' ⇒ ' + setter + '(' + raw + ') 已下达，**消费点读回 ' + back + '**');
  }
  /* ⚠ 没下达的那些键**照样响亮印出来**：本臂其实跑在引擎默认档上（大雷默认 12=开），
   *   过去这里一行都不印 ⇒ "忘了关"和"故意不关"同形（11-02 §三 那对孪生包的差异就是从这儿起的）。 */
  if (unset.length) console.log('[部署档] ⚠ 未下达 ⇒ 走引擎默认档：' + unset.join(' ‖ ') + '（已回读并写进产物 meta.deployKnobs）');
})();

/* =====（ZCode · 11-06 夜）课程席脚本名：字符串档，不走上面的数值 KN 表 =====
 * 那张表按 `Number()` 回执比对，函数名会变 NaN ⇒ NaN !== NaN 恒真 ⇒ 合法下达被误拒。
 * 单独块：下达 → 字符串回执比对 → 当场验「Bots 里真解得出这个函数」（解不出 ⇒ 课程席每局静默落空，
 *   与「缺省 pickToolKit 恒可解」不符 ⇒ 只有显式写错才会红，exit 7 响亮失败）。 */
if (process.env.EPIRUS_COURSE_BOT != null && process.env.EPIRUS_COURSE_BOT !== '') {
  const want = String(process.env.EPIRUS_COURSE_BOT).trim();
  if (typeof T.setCourseBot !== 'function') { console.error('⛔ EPIRUS_COURSE_BOT 下达了，但引擎没有 setCourseBot ⇒ 黑键，拒跑'); process.exit(6); }
  T.setCourseBot(want);
  const back = (typeof T.courseBotName === 'function') ? T.courseBotName() : null;
  if (back !== want) { console.error('⛔ EPIRUS_COURSE_BOT=' + want + ' 没生效：读回 ' + back + ' ⇒ 拒静默空转'); process.exit(7); }
  if (typeof T.courseSeatBot !== 'function' || !T.courseSeatBot()) {
    console.error('⛔ EPIRUS_COURSE_BOT=' + want + ' 在 Bots 导出里解不出函数 ⇒ 课程席会静默落空，拒跑'); process.exit(7);
  }
  console.log('[部署档] EPIRUS_COURSE_BOT ⇒ ' + want + ' 已下达（读回一致，脚本可解）');
  DEPLOY_REC.EPIRUS_COURSE_BOT = { requested: want, effective: back };
} else if (typeof T.courseBotName === 'function') {
  DEPLOY_REC.EPIRUS_COURSE_BOT = { requested: null, effective: T.courseBotName() };
}

/* ===== v1.5.262（DS · §24 的根因修复）：**通用 econ 下达**（名单驱动 + 强制逐键回执）=====
 * 病（本班三族实验全部逐字节相同才查出来）：本文件对 econ 旋钮是**逐个键各写一块**下达代码
 *   （bigtChainW 一块 / fitTailW 一块 …）⇒ 新登记进名单的键（costlyW）**通过了黑键闸却从没送给引擎**
 *   ⇒ 训练进程里它恒为默认 0 ⇒ 0 / 0.05 / 0.2 三档、长程场、从会出贵卡的粒出发 —— 跑出同一份权重。
 * 本块把 `readEconEnv(process.env)` 里**名单内**的键统一下达，并**逐键回执比对**：
 *   回执与下达不一致 ⇒ exit 7（拒静默空转 —— 这正是上次我写 `typeof` 守卫栽的坑）。
 * ⚠️ 位置必须在 `T` 装配之后（第一条修复尝试放在文件顶部 ⇒ 连日志都没出来）。 */
/* 回执比对必须**按数值语义**比，不能按字符串比（实测事故 09-28：`EPIRUS_BEAD_W=0.10` ⇒ 引擎里是 `0.1`，
 * `String('0.10') !== String(0.1)` ⇒ 一条**合法下达被拒**、整臂 `exit 7`，一行的量都没跑到）。
 * 但也不许放宽成"差不多就行"：两边读不出数值时仍返回 false ⇒ "回执字段名对不上"照样红
 * （实测 `EPIRUS_BEAD_W=-5` 被引擎拒收、回执仍是 0.05 ⇒ 仍 exit 7，闸门判别力没被这次放宽吃掉）。
 * 注：布尔档走不到这里 —— `readEconEnv` 已经把 `'1'` 转成 `true`，字符串等值那一行就过了。 */
function rcptEq(a, b) {
  if (String(a) === String(b)) return true;
  const na = Number(a), nb = Number(b);
  return a !== '' && b !== '' && isFinite(na) && isFinite(nb) && Math.abs(na - nb) < 1e-12;
}
{
  if (!Array.isArray(ECON_REWARD_KEYS)) {
    console.error('[train-3p] ⛔ 拿不到 ECON_REWARD_KEYS（单一来源没导入）⇒ 拒静默空转');
    process.exit(7);
  }
  const eff = readEconEnv(process.env);
  const payload = {};
  for (const k of ECON_REWARD_KEYS) if (eff[k] != null) payload[k] = eff[k];
  if (Object.keys(payload).length) {
    if (typeof T.setEconomyReward !== 'function') {
      console.error('[train-3p] ⛔ 有 econ 键要下达但引擎没有 setEconomyReward ⇒ 拒静默空转');
      process.exit(7);
    }
    try { T.setEconomyReward(payload); }
    catch (e) { console.error('[train-3p] ⛔ econ 下达被拒：' + (e && e.message)); process.exit(7); }
    const echo = (typeof T.economyReward === 'function' ? (T.economyReward() || {}) : {});
    const miss = Object.keys(payload).filter(function (k) { return !rcptEq(echo[k], payload[k]); });
    if (miss.length) {
      console.error('[train-3p] ⛔ econ 下达后回执不一致：' + miss.map(function (k) { return k + '=' + payload[k] + '(回执 ' + echo[k] + ')'; }).join(' · ') +
        ' ⇒ 拒静默空转（回执字段名可能与输入键不同 ⇒ 先在 economyReward() 里对齐）');
      process.exit(7);
    }
    console.log('[train-3p] econ 族通用下达：' + JSON.stringify(payload) + ' ⇒ 逐键回执一致 ✓');
  }
  /* v1.8.23（爆珠臂）：激光眼命中奖励。不属 econ 族，单独下达；回执不一致就响亮退出。 */
  if (process.env.EPIRUS_LASER_W && typeof T.setLaserReward === 'function') {
    const got = T.setLaserReward(Number(process.env.EPIRUS_LASER_W));
    if (!(got >= 0) || Math.abs(got - Number(process.env.EPIRUS_LASER_W)) > 1e-9) {
      console.error('[train-3p] ⛔ EPIRUS_LASER_W 下达后回执不一致：' + got); process.exit(7);
    }
    console.log('[train-3p] 激光眼奖励 LASER_W=' + got);
  }
}

/* ===== v1.5.160（qoder §N13 · 用户 09-22 裁定"场B 缺口走对手池"）：收割席注入 `EPIRUS_KILL_FIELD` =====
 * 与 v1.5.159 那条已删的 passiveField 接线的**关键区别**：这条带**开火计数**（跑完必须报"注了几局 / 覆盖几个受评座位"，
 * 一局未注 ⇒ `exit 8`）。§N11 的教训就是"横幅读回 0.34 ✓ 而作用点 0 局"烧掉两臂 ⇒ 横幅只能证明**变量**到位，
 * 证明不了**效果**发生。语义与三条设计约束见 `js/train/evo.js` 的 `killSeatFor` 注释。 */
let KILL_REQ = 0, SEL_LAND_LOG = null, KILL_REC = null, TRAIN_MODE_REQ = null, BIGT_CHAIN_REQ = 0, H2P_REQ = null;   // 兑现广度当选的账（写进 meta，事后能查这臂到底改没改判）
let IMIT_ON = false;   // v1.5.189：示范真开着才逐代印"原生 vs 注入"的归因（必须在下达块之前声明 —— 那里要赋值）
{
  const trainEnv = readTrainEnv(process.env);
  if (trainEnv.kill != null && Number(trainEnv.kill) > 0) {
    if (typeof T.setKillField !== 'function') {
      console.error('[train-3p] ⛔ 传了 EPIRUS_KILL_FIELD 但引擎没有 setKillField ⇒ 拒绝静默空转');
      process.exit(7);
    }
    const got = T.setKillField(trainEnv.kill);
    if (!(Number(got) > 0)) {
      console.error('[train-3p] ⛔ EPIRUS_KILL_FIELD=' + trainEnv.kill + ' 被 setter 拒绝（读回 ' + got + '）');
      process.exit(7);
    }
    KILL_REQ = Number(got);
    console.log('[train-3p] 收割席注入已下达：killField=' + got + ' ⇒ 消费点读回 ' + T.killField() +
      '（每 ' + Math.max(2, Math.round(1 / got)) + ' 局注 **1 席** pickKillSecure · 相位按代旋转 · 只注多人局 · 避开承诺局）');
  }
  /* ===== v1.5.177（DS）：**补贴率下达** `EPIRUS_REGEN_SLICE` =====
   * 动因（数据）：全卡边际扫描显示"钱是**系统性**的墙"（long 只有 59%/18%/3% 的回合买得起 1/2/3 费；
   * multi 更紧到 30 张卡 0 张可测）—— 而要跑"给钱 + 教卡"的双侧实验，**必须先能调"给多少钱"**，
   * 此前它是硬编码常量 0.08（每 12 局 1 局）。纪律与 KILL_FIELD 完全一致：没有 setter ⇒ `exit 7`
   * （**拒绝静默空转**）；下令后**读回消费点**；被 setter 拒（含超界 clamp）也 `exit 7`。 */
  if (process.env.EPIRUS_REGEN_SLICE != null && String(process.env.EPIRUS_REGEN_SLICE).trim() !== '') {
    if (typeof T.setRegenSlice !== 'function') {
      console.error('[train-3p] ⛔ 传了 EPIRUS_REGEN_SLICE 但引擎没有 setRegenSlice ⇒ 拒绝静默空转');
      process.exit(7);
    }
    const gotSlice = T.setRegenSlice(process.env.EPIRUS_REGEN_SLICE);
    /* ⚠️ NaN 安全：`Math.abs(got - NaN) > 1e-9` 恒为 **false** ⇒ 非数值会被静默放行
     * （我第一版就这么写的，`EPIRUS_REGEN_SLICE=abc` 实测 exit 0 静默跑完 ⇒ 正是本项目最恨的那一族）。 */
    const reqSlice = Number(process.env.EPIRUS_REGEN_SLICE);
    if (!isFinite(reqSlice) || !(Number(gotSlice) > 0) || Math.abs(Number(gotSlice) - reqSlice) > 1e-9) {
      console.error('[train-3p] ⛔ EPIRUS_REGEN_SLICE=' + process.env.EPIRUS_REGEN_SLICE +
        ' 被 setter 拒绝（读回 ' + gotSlice + '；注意超界会被 clamp 到 [0.01,1] ⇒ 也算被拒）');
      process.exit(7);
    }
    console.log('[train-3p] 补贴率已下达：regenSlice=' + gotSlice + ' ⇒ 消费点读回 ' + T.regenSlice() +
      '（每 ' + Math.max(2, Math.round(1 / gotSlice)) + ' 局留 1 局带补贴：受评席在白拿 ep 的世界里被评估）');
  }
  /* ===== v1.5.187（qoder · DS 交接 §2b 的"唯一待做"）：**大雷连带收益权重** =====
   * 为什么是这一项（DS 的结论链 + 我的独立复跑）：现役产物**大雷 0.000/局、连带 0.00/局**，
   * 而把"会挑时机的大雷教师"当一个席位直接量，连带是真的（multi 0.57/局 · long 0.49/局）
   * ⇒ 机制/时机/payoff 都在，缺的是**选择不给它付钱**（示范活不过"选择"）。
   * 纪律与 `REGEN_SLICE`/`KILL_FIELD` 逐字一致：无 setter ⇒ `exit 7`；下达后**读回消费点**；
   * NaN/被 clamp 都算被拒 ⇒ `exit 7`（`Math.abs(got - NaN) > 1e-9` 恒 false 那个坑已写进下面的判据）。
   * ⚠️ 取值**必须**经 `server/econ-env.mjs` 的 `readEconEnv`（D77 的单一来源 ⇒ 本文件不出现那个 env 名）。 */
  /* v1.7.127（用户 10-20：「测一下开关的差别」）：**训练侧也开送盾先验**（`EPIRUS_SUPPORT_PRIOR=0|1|2`）。
   * 纪律与 `REGEN_SLICE` 一致：无 setter ⇒ exit 7；下达后**回读**；读不回也 exit 7（不许静默空转）。 */
  {
    /* v1.7.128（用户 10-20 裁定「默认开」）：**训练侧默认 = 2**（与页面一致）。
     *   依据：10 粒配对 A/B（120 代）强度 Δ −0.43pt (t=−0.14) ⇒ 无差别；
     *   但 ⚠ 那批包送盾≈0%（`p0` 0.0%）⇒ **没覆盖「本来就爱送盾」的区间**，以后出现刷盾型起点包要重测。
     *   要关掉就显式设 `EPIRUS_SUPPORT_PRIOR=0`（门里那些比对产物的腿应显式设 0，见 CHANGELOG）。 */
    /* 10-21（§E675 交班 B4）：显式空串**必须**按非法值处理（原来被当「没设」⇒ 静默取默认 2，
     *   而脚本里 env="${MAYBE}" 那种拼法正是本仓「设了但被判成没设」的常见来源）。 */
    const spRaw = process.env.EPIRUS_SUPPORT_PRIOR;
    const spReq = spRaw == null ? '2' : String(spRaw).trim();
    if (spReq === '') {
      console.error('[train-3p] ⛔ EPIRUS_SUPPORT_PRIOR 被设成了空串 ⇒ 按非法值处理（要默认就**别设这个 env**）');
      process.exit(7);
    }
    {
      const v = Number(spReq);
      if (!(v === 0 || v === 1 || v === 2)) {
        console.error('[train-3p] ⛔ EPIRUS_SUPPORT_PRIOR 只能是 0/1/2（收到 ' + spReq + '）');
        process.exit(7);
      }
      if (typeof T.setSupportPrior !== 'function' || typeof T.supportPriorOn !== 'function') {
        console.error('[train-3p] ⛔ 下达了送盾先验但引擎没有 setSupportPrior/supportPriorOn ⇒ 拒绝静默空转');
        process.exit(7);
      }
      T.setSupportPrior(v);
      if (Number(T.supportPriorOn()) !== v) {
        console.error('[train-3p] ⛔ 送盾先验=' + v + ' 未生效（读回 ' + T.supportPriorOn() + '）');
        process.exit(7);
      }
      console.log('[train-3p] 送盾先验 = ' + v + '（读回一致）');
      /* qoder 11-02（#47 的落地）：`applyDeployKnobs()` 跑在第 695 行、这一族在它**之后** ⇒ 产物 meta 里
       *   `deployKnobs.EPIRUS_SUPPORT_PRIOR.effective` 记的是引擎出厂值 0，而训练实际吃的是 CLI 默认 2
       *   （v1.7.128 裁定）——那是枚**假字据**，而我今天刚把"跨批横比先对 deployKnobs"写成纪律。
       *   ⇒ 这里按真实生效值改写，`requested` 保持"没下达"的原样。
       * ⚠ 已落盘的历史产物（DD 12 臂、今天 SEL_DEF 那对）仍带旧字段：读到 `effective:0 ∧ requested:null`
       *   ⇒ 真实生效值是 **2**，不是 0。 */
      if (DEPLOY_REC && DEPLOY_REC.EPIRUS_SUPPORT_PRIOR) {
        DEPLOY_REC.EPIRUS_SUPPORT_PRIOR = {
          requested: spRaw == null ? null : Number(spRaw),
          effective: Number(T.supportPriorOn()),
          wiredBy: 'train-3p 的第二个读者（CLI 默认 2，v1.7.128）'
        };
      }
    }
  }
  /* ===== §E764（10-26 夜班 · 千问）：`EPIRUS_SUB_BEAD` 在**本入口**也要真下达（三条纪律照上面那族）=====
   * 病是实测出来的，不是推论：我把这个 env 名补进白名单之后跑了四臂，回来对**权重哈希**发现
   *   `N0`（对照）与 `N1`（+`EPIRUS_SUB_BEAD=1` +珠种 boom）**逐位同一粒**（wid 都是 114287e505d9f6d4），
   *   `N2` 与 `N3` 也是同一粒（2cfcce34515b19f1）⇒ 带不带补贴档，训练轨迹一点没动。
   *   根因：这根布尔此前只由 `server/paralleltrain.mjs:131` 随 **worker 消息**投递，
   *   而 `train-3p` 单进程那条路上**没人读它** ⇒ 白名单收下它、`meta.recipe.env` 记下它，
   *   引擎里却是出厂的 false。这就是 D175 / D206 那一族「通过黑键闸却从没送到作用点」的又一次实付，
   *   只是这次是我自己补的白名单把它藏得更像"已登记"。
   * ⇒ 三条硬规矩照旧：**没有 setter 就 exit 7**（拒静默空转）‖ 下达后**读回消费点** ‖ 不一致 exit 7。
   * ⚠ 珠种那根（`EPIRUS_SUB_BEAD_KIND`）走 econ 单一来源，由上面那句「econ 族通用下达 … 逐键回执一致」自证；
   *   两根都在场时日志里应各印一行，**缺一行就是有一根没落地**。 */
  {
    const sbReq = process.env.EPIRUS_SUB_BEAD;
    if (sbReq !== undefined && String(sbReq).trim() !== '') {
      const wantSb = String(sbReq).trim() === '1';
      if (typeof T.setSubBead !== 'function' || typeof T.subBeadOn !== 'function') {
        console.error('[train-3p] ⛔ 下达了 EPIRUS_SUB_BEAD 但引擎没有 setSubBead/subBeadOn ⇒ 拒绝静默空转');
        process.exit(7);
      }
      T.setSubBead(wantSb);
      if (T.subBeadOn() !== wantSb) {
        console.error('[train-3p] ⛔ 补贴局补珠=' + wantSb + ' 未生效（读回 ' + T.subBeadOn() + '）');
        process.exit(7);
      }
      console.log('[train-3p] 补贴局补珠 = ' + wantSb + '（消费点读回一致 ‖ 珠种见上面那行 econ 回执）');
    }
  }
  {
    const chainReq = readEconEnv(process.env).bigtChainW;
    if (chainReq != null && String(chainReq).trim() !== '') {
      const reqChain = Number(chainReq);
      if (typeof T.setEconomyReward !== 'function' || typeof T.bigTChainReward !== 'function') {
        console.error('[train-3p] ⛔ 下达了大雷连带权重但引擎没有 setEconomyReward/bigTChainReward ⇒ 拒绝静默空转');
        process.exit(7);
      }
      T.setEconomyReward({ bigtChainW: chainReq });
      const back = T.bigTChainReward() || {};
      const gotChain = back.w;
      if (!isFinite(reqChain) || reqChain < 0 || !(Number(gotChain) === reqChain)) {
        console.error('[train-3p] ⛔ 大雷连带权重=' + chainReq +
          ' 未生效（读回 ' + gotChain + '）—— 非数值/负数/被 clamp 都算被拒');
        process.exit(7);
      }
      /* v1.5.188（用户裁 Q-14 ②）：**形状也要读回**。这次改的就是形状（计数 → 率），而"权重读回了"证明不了
       * 项按哪种方式进 fit ⇒ 读不回 `shape === 'rate'` 就是"旧形状还活着"，必须响（同一族的"seam 2"病）。 */
      if (back.shape !== 'rate') {
        console.error('[train-3p] ⛔ 连带项形状读回=' + JSON.stringify(back.shape) + '（要 `rate` ⇒ 分母是"该席大雷出手数"）');
        process.exit(7);
      }
      BIGT_CHAIN_REQ = reqChain;
      console.log('[train-3p] 大雷连带权重已下达：' + reqChain + ' ⇒ 消费点读回 ' + gotChain +
        '（形状=' + back.shape + '：**W × min(1, 该席连带数 / 该席大雷出手数)** ⇒ 付的是"用它时真赚了"，不是"多抽几次"；0 出手 = 0 分）');
    }
  }
  /* ===== §E49（qoder 09-26 夜班）：尾部聚合开关 `EPIRUS_FIT_TAIL_W/Q` 的下达 =====
   * **这里不再自己写一块** —— v1.5.262（DS §24 根因："闸放行 ≠ 线接通"）的**通用 econ 下达**已经
   * 把 `ECON_REWARD_KEYS` 里每个键（含 `fitTailW`/`fitTailQ`）统一下达并**逐键比对回执**（不一致 `exit 7`）。
   * 我昨夜那版"一键一块"与它重复，而且正是那次修复要消灭的形状 ⇒ 删掉，只留这条指路注释。
   * "开关到底有没有改掉 fit"仍由门禁 **D165** 用**行为**判：同一份 params 跑两次比 `fitMean`/`fit`，
   * 臂级再钉"不设 vs 显式 0 ⇒ 产物权重逐位相同"与"=0.4 ⇒ 必须不同"（判在效果上，不判在横幅上）。 */
  /* ===== v1.5.254（用户 GO · 千问 §E59 NEXT 第 6 条）：**econ 族 5 键**接上 CLI =====
   * 纪律与 `fitTailW`/`bigtChainW` 逐字一致：无 setter/读回接口 ⇒ `exit 7`；下达后**读回消费点**；
   *   非数值/越界/被 clamp 都算被拒 ⇒ `exit 7`；**不设时一行都不印**（"开了但没生效"与"没开"必须看得见差别）。
   * `convRatio` 是**布尔档**（`readEconEnv` 里 `EPIRUS_CONV_RATIO === '1' ? true : null`）⇒ 按真值比较，不按数值。
   * ⚠️ 取值一律经 `readEconEnv`（D77 单一来源 ⇒ 本文件不出现那些 env 名）。 */
  {
    const econEnv = readEconEnv(process.env);
    const NUM_ECON = ['beadW', 'bigcardW', 'stockBonus', 'hoardOnLeftover'];
    const want = {}, picked = [];
    for (const k of NUM_ECON) {
      const raw = econEnv[k];
      if (raw != null && String(raw).trim() !== '') { want[k] = Number(raw); picked.push(k); }
    }
    if (econEnv.convRatio != null) { want.convRatio = econEnv.convRatio === true; picked.push('convRatio'); }
    if (picked.length) {
      if (typeof T.setEconomyReward !== 'function' || typeof T.economyReward !== 'function') {
        console.error('[train-3p] ⛔ 下达了 econ 旋钮但引擎没有 setEconomyReward/economyReward ⇒ 拒绝静默空转');
        process.exit(7);
      }
      T.setEconomyReward(want);
      const eb = T.economyReward() || {};
      const bad = [];
      for (const k of picked) {
        if (k === 'convRatio') { if (!!eb[k] !== !!want[k]) bad.push(k + ' 读回 ' + eb[k]); }
        else if (!isFinite(want[k]) || want[k] < 0 || Number(eb[k]) !== want[k]) bad.push(k + '=' + want[k] + ' 读回 ' + eb[k]);
      }
      if (bad.length) {
        console.error('[train-3p] ⛔ econ 旋钮未生效：' + bad.join(' · ') + '（非数值/越界/被 clamp 都算被拒）');
        process.exit(7);
      }
      console.log('[train-3p] econ 旋钮已下达并读回消费点：' +
        picked.map(function (k) { return k + '=' + (k === 'convRatio' ? !!eb[k] : eb[k]); }).join(' · '));
    }
  }
  /* ===== v1.5.179（DS · **Q-8 的最小版本**）：示范族下达 `EPIRUS_IMIT_*` =====
   * 动因（实测）：全卡边际扫描 + "只给钱"实验 ⇒ **钱能让它更勤**（出手 G_eff 2.63→4.01）但**贵卡仍是 0.00%**
   * ⇒ "教"那一侧必须上桌；而它此前**只在服务端**接通（`paralleltrain.mjs:126` 下发 → `train-worker.mjs:206` 应用 + 回执），
   * `train-3p` 侧传了**静默无效**（§N8 那一族的 CLI 版本）。这里按 `KILL_FIELD`/`REGEN_SLICE` 的同一范式接通：
   * **没有 setter ⇒ `exit 7` 拒静默空转** · 下令后**读回消费点** · setter 抛错（如非法卡名）也 `exit 7`。 */
  {
    const DEMO_KEYS = [
      ['EPIRUS_IMIT_OVERRIDE', 'setImitOverride', 1],
      ['EPIRUS_IMIT_ONLY', 'setImitOnly', 0],
      ['EPIRUS_IMIT_TEACHER', 'setImitTeacherByName', 0],
      ['EPIRUS_IMIT_SUBONLY', 'setImitSubOnly', 1]
    ];
    for (const spec of DEMO_KEYS) {
      const envKey = spec[0], setterName = spec[1], isBool = spec[2] === 1;
      const raw = process.env[envKey];
      if (raw == null || String(raw).trim() === '') continue;
      if (typeof T[setterName] !== 'function') {
        console.error('[train-3p] ⛔ 传了 ' + envKey + ' 但引擎没有 ' + setterName + ' ⇒ 拒绝静默空转');
        process.exit(7);
      }
      let got = null;
      try { got = T[setterName](isBool ? (String(raw) === '1') : String(raw)); }
      catch (e) {
        console.error('[train-3p] ⛔ ' + envKey + '=' + raw + ' 被 setter 拒绝：' + (e && e.message));
        process.exit(7);
      }
      console.log('[train-3p] 示范族已下达：' + envKey + '=' + raw + ' ⇒ 消费点读回 ' + JSON.stringify(got));
      /* v1.5.189：逐代归因只在**示范真会开火**时印。条件不在这里重推 —— 直接取 setter 的返回值（引擎是唯一口径）。 */
      if (setterName === 'setImitOverride' && got === true) IMIT_ON = true;
    }
  }
  /* ===== v1.5.237（E28）：训练侧**执行口径**旋钮 `EPIRUS_TRAIN_EPS` 的下达与自证 =====
   * 为什么值得开这一格（实测在 `docs/research/logs/RESEARCH-LOG-2026-09-26-qoder-night.md` §E28a）：适应度与五道门全在 ε=0，
   *   产品跑 ε=0.2 soft，而"按 `dmg/局` 排的 Spearman ρ(0 vs 0.2) = 0.480、随剂量单调" ⇒ **口径在换答案**。
   * 为什么这一段必须长这样（同 `KILL_FIELD`/示范族那一族的教训：横幅读回证明不了作用点发生）：
   *   "env 传进去没生效"是最容易犯的错（setter 名打错、eps 被 `|| 0` 吞、只接了 CLI 没接服务端……）
   *   ⇒ 三条硬规矩：**没有 setter 就 exit 7**（拒静默空转）· 下令后**读回消费点** · 退出前印**开火计数**，
   *     `eps>0 而一次决策都没经过漏斗` ⇒ `exitCode=8`（空枪，与 D123 同规矩）。 */
  {
    /* ===== v1.6.51（用户 10-10 裁定「把 A 回退了吧」）：**回退 v1.6.50 那条"产品口径成为训练臂默认"** =====
     * 用户给的原则（本仓此前没写下来过，逐字记在这里）：
     *   **"冠军在训练过程中应该是不含或少含随机注入的，而测量的地方才应该按照上线的要求。"**
     * ⇒ 我 v1.6.50 做反了：把 `ε=0.2/k5/soft` 注入**选择回路**，期望它"训出更稳的冠军"。
     *   那不是换个尺，那是**在噪声更大的目标上做选择**——实测代价（配对、预算对齐到 1200 代）：
     *   页面 `H` 出厂口径 55.9 vs 产品口径 42.1（**−13.8pt**），而 250 代时差 −10.2pt ⇒ 越训越差。
     *   同种子当选键「第 1 与第 2 名分差」在产品口径下只有 **0.30pt（落在同分带内 ⇒ 基本是抽签）**
     *   —— 一个分不清前两名的选择过程，选出来的就是运气。读数见 `champion-map/cont1200-2026-10-10.tsv`。
     * 所以默认回到**出厂形状**：`fitChooser()` = `temp0.35·ε0.15·不带 epsMode` 硬档 ‖ `trainChooser()` = `temp0.15·ε0` 纯贪心。
     * 想跑"产品口径训练臂"做研究**仍然可以**（显式 `EPIRUS_TRAIN_EPS=0.2 EPIRUS_TRAIN_EPS_K=5
     *   EPIRUS_TRAIN_EPS_MODE=soft EPIRUS_TRAIN_TEMP=0.15`）—— 那是**显式的实验**，不是默认。
     * ⚠️ 别再把"上线口径"搬进这两个漏斗当默认：**上线口径的用武之地在"量"的那一侧**
     *   （页面 / `eval-5p --eps=0.2` / `promote --dry` 的页面那一栏），不在选择回路里。
     * ⚠️ 三条硬规矩一条都不许松：没有 setter 就 exit 7 · 下令后读回消费点 · 空枪 exit 8。 */
    const rawEps = process.env.EPIRUS_TRAIN_EPS;
    if (rawEps != null && String(rawEps).trim() !== '') {
      if (typeof T.setTrainEps !== 'function') {
        console.error('[train-3p] ⛔ 传了 EPIRUS_TRAIN_EPS 但引擎没有 setTrainEps ⇒ 拒绝静默空转');
        process.exit(7);
      }
      let epsBack = null;
      try {
        epsBack = T.setTrainEps(Number(rawEps), process.env.EPIRUS_TRAIN_EPS_K || null, process.env.EPIRUS_TRAIN_EPS_MODE || null,
          process.env.EPIRUS_TRAIN_TEMP || null);
      } catch (e) {
        console.error('[train-3p] ⛔ EPIRUS_TRAIN_EPS=' + rawEps + ' 被 setter 拒绝：' + (e && e.message));
        process.exit(7);
      }
      console.log('[train-3p] 训练/选择执行口径已下达 ⇒ 消费点读回 eps=' + epsBack.eps + ' k=' + epsBack.k + ' mode=' + epsBack.mode +
        ' temp=' + (epsBack.temp == null ? '各点出厂值' : epsBack.temp) +
        '\n            作用范围 = `fitChooser()`（每代评分的被评席，出厂 temp0.35·ε0.15·硬档）+ `trainChooser()`（自评/健康门槛漏斗，出厂 ε=0）；' +
        '`audit-lib` 的 9 处与承诺局(`makeCommitChooser`)不经过它');
      process.on('exit', function () {
        if (typeof T.countTrainEps !== 'function') return;
        const c = T.countTrainEps();
        console.log('[train-3p] ε 臂统计：建探索型 Chooser ' + c.built + ' 个 · 经它决策 **' + c.seen + '** 次 ‖ 每代评分被评席 **fit ' + c.fitSeen + '** 次 · eps=' + c.eps +
          ' k=' + c.k + ' ' + c.mode);
        if (c.eps > 0 && c.seen + c.fitSeen === 0) {
          console.error('[train-3p] ⛔ 空枪：eps>0 却一次决策都没经过两个漏斗 ⇒ 这一臂与出厂臂逐字相同，读数作废（同 D123）');
          process.exitCode = 8;
        }
      });
    }
  }
  /* ===== v1.5.181（DS）：示范注入的**开火计数**必须在退出前报 =====
   * 动因（实测）：三种配置下"真正的落雷"使用率全是 0.00%，而**唯一能分辨原因的信息**（轮到过几次 / 教师无动作 /
   * 买不起 / 被 only 过滤）此前根本没人记 ⇒ 我只能靠"输出是否与无示范臂逐字节相同"去**反推**（§N12 的原话：
   * 横幅读回证明不了作用点发生）。`KILL_FIELD` 在 v1.5.160 补 `countKillSeats()` 后就是靠这个收口的。 */
  if (process.env.EPIRUS_IMIT_ONLY || process.env.EPIRUS_IMIT_OVERRIDE === '1') {
    process.on('exit', function () {
      try {
        if (typeof T.countImitInject !== 'function') return;
        const c = T.countImitInject();
        console.log('[train-3p] 示范注入统计：tries=' + c.tries + ' · **fired=' + c.fired + '** · 未开火原因：教师无动作 ' +
          c.noTeacherAction + ' / 买不起 ' + c.unaffordable + ' / 被 only 过滤 ' + c.filteredByOnly +
          ' · 覆盖席 ' + JSON.stringify(c.seats) + ' · 注入的卡 ' + JSON.stringify(c.keys));
        /* v1.5.189：臂末把**归因**也报一遍 —— `fired` 是"教师伸了几次手"，这一行才是"受评席自己留下几次手"。
         * 二者以前没法分开（同一张卡、同一个事件形状），所以"示范学会了没有"这个问题在臂上根本问不出来。 */
        if (typeof T.imitAttribution === 'function') {
          const a = T.imitAttribution();
          console.log('[train-3p] 出手归因（受评席 · 只数 `outcome:ok`）：' +
            (Object.keys(a.keys).length ? JSON.stringify(a.keys) : '（一张都没打）') +
            ' · tagged=' + a.tagged + ' · **unmatched=' + a.unmatched + '**（注入了但没成为事件 ⇒ 不该大于 0）');
          if (a.tagged > 0 && a.unmatched > a.tagged) {
            console.error('[train-3p] ⛔ 归因不可信：unmatched(' + a.unmatched + ') > tagged(' + a.tagged + ') ⇒ 事件与台账对不上（exit 8）');
            process.exitCode = 8;
          }
        }
        if (c.tries > 0 && c.fired === 0) {
          console.error('[train-3p] ⛔ 示范要了、也轮到过 ' + c.tries + ' 次，但**一次都没注入** ⇒ 拒绝静默空转（exit 8）');
          process.exitCode = 8;
        }
      } catch (e) { /* 退出阶段不抛 */ }
    });
  }
  /* ===== v1.5.179b（DS）：示范族的**退火窗口** `EPIRUS_IMIT_FRAC` =====
   * ⚠️ 踩过的坑（实测）：只设 `_OVERRIDE/_ONLY/_TEACHER` **什么都不发生** —— 退火窗口 `IMIT_UNTIL` 默认 **0**
   * ⇒ `imitBetaForGen()` 恒 0 ⇒ 覆盖从不触发。我上一版就是这么跑出一臂**与"无示范"臂逐字节相同**的"空枪"
   * （同一串 bestFit / 同一批 trainFit / 同样的 1st ⇒ 不是"效果为零"而是**从未触发**）。
   * 这里按服务端口径 `imitGens = floor(gens × frac)`（`train-server.mjs:171`）下达，并**行为式读回** `β(gen0) > 0`。 */
  {
    const rawFrac = process.env.EPIRUS_IMIT_FRAC;
    if (rawFrac != null && String(rawFrac).trim() !== '') {
      const frac = Number(rawFrac);
      const gens = Math.max(1, Number(process.argv[2]) || 200);
      if (!isFinite(frac) || frac <= 0) {
        console.error('[train-3p] ⛔ EPIRUS_IMIT_FRAC=' + rawFrac + ' 非法（要 > 0）'); process.exit(7);
      }
      if (typeof T.setImitUntil !== 'function' || typeof T.imitBetaForGen !== 'function') {
        console.error('[train-3p] ⛔ 传了 EPIRUS_IMIT_FRAC 但引擎没有 setImitUntil/imitBetaForGen ⇒ 拒绝静默空转');
        process.exit(7);
      }
      const imitGens = Math.max(1, Math.floor(gens * frac));
      T.setImitUntil(imitGens);
      const beta0 = T.imitBetaForGen(0);
      if (!(Number(beta0) > 0)) {
        console.error('[train-3p] ⛔ 示范窗口没打开（β(gen0)=' + beta0 + '）⇒ 拒绝静默空转'); process.exit(7);
      }
      console.log('[train-3p] 示范窗口已下达：EPIRUS_IMIT_FRAC=' + frac + ' ⇒ imitUntil=' + imitGens +
        ' 代 · **行为式读回** β(gen0)=' + beta0);
    }
    /* v1.5.189：退火窗口没开 ⇒ β≡0 ⇒ 覆盖永不触发（DS §N12 那个"空枪臂"的形状）⇒ 归因也就无从谈起。
     * §E499 收口：这里原来只是**静默**把 IMIT_ON 关掉 ⇒ 一臂"要了示范"却与无示范臂逐字节相同，
     *   而退出前的开火统计写的是 `tries=0` —— 那条守卫只挡 `tries>0 && fired===0`，**0 次尝试就这么溜过去了**。
     *   实测踩过：`EPIRUS_IMIT_OVERRIDE=1 + IMIT_ONLY=snipe + TEACHER=pickSnipeSpam` 三行横幅都"读回 true"，
     *   跑完与对照臂 **0/5689 位不同**。⇒ 现在按同一族的老规矩：没有 β 就是用法错，`exit 7` 并指名补哪个旋钮。 */
    if (IMIT_ON && typeof T.imitBetaForGen === 'function' && !(Number(T.imitBetaForGen(0)) > 0)) {
      console.error('[train-3p] ⛔ 示范族已下达（OVERRIDE/ONLY/TEACHER 都读回成功）但 **β(gen0)=' + T.imitBetaForGen(0) +
        '** ⇒ 覆盖一次都不会触发，这一臂会与"无示范"臂逐字节相同（§N12 的空枪臂形状）。' +
        '\n       补上退火窗口再跑：EPIRUS_IMIT_FRAC=0.5（前 50% 代注入示范，之后退火到纯自策略）');
      process.exit(7);
    }
  }
  /* ===== v1.5.169（§N28）：训练**模式**下达（`EPIRUS_TRAIN_MODE=long` ⇒ 5 血长程考卷）=====
   * 动因（用户 09-22 的原话目标）："理想情况下应该炼一个 5 血长程能通吃其他模式" —— 而 `TRAIN_MODE` 一直是写死的 `'multi'`，
   * 所以这句**从来没被当成实验跑过**（`evo.js:28` 自己注释着"5 血冠军从来没被训过"）。
   * 三条纪律：① 认不认这个模式由 `R.MODES` 判，不认 ⇒ `exit 7`（**拒绝"要了 long 却静默训 multi"**，那是 §N11 那一族）；
   * ② 下达后必须**读回**消费点的值；③ 生效值进 `meta.recipe.trainMode`，让产物自己说它是在哪种考卷下选出来的。 */
  if (trainEnv.mode != null && trainEnv.mode !== '') {
    const want = trainEnv.mode;
    if (typeof T.setTrainMode !== 'function') {
      console.error('[train-3p] ⛔ 传了 EPIRUS_TRAIN_MODE 但引擎没有 setTrainMode ⇒ 拒绝静默空转');
      process.exit(7);
    }
    const Rules = sb.window.EpirusRules;
    if (!Rules || !Rules.MODES || !Rules.MODES[want]) {
      console.error('[train-3p] ⛔ EPIRUS_TRAIN_MODE=' + want + ' 不是规则表里的模式（可选 ' + Object.keys((Rules && Rules.MODES) || {}).join(',') + '）⇒ 不跑（不许静默退回 multi）');
      process.exit(7);
    }
    const gotMode = T.setTrainMode(want);
    if (gotMode !== want) {
      console.error('[train-3p] ⛔ setTrainMode(' + want + ') 读回 ' + gotMode + '（不等于下达值）⇒ 本臂作废');
      process.exit(7);
    }
    TRAIN_MODE_REQ = want;
    const M = Rules.MODES[want];
    console.log('[train-3p] 训练模式已下达：EPIRUS_TRAIN_MODE=' + want + ' ⇒ 消费点读回 ' + T.trainMode() +
      '（建局 hp=' + (M.hp != null ? M.hp : '?') + ' · suddenDeath=' + (M.suddenDeath != null ? M.suddenDeath : '?') + '）');
  }
}

/* ===== v1.7.4（10-13 夜班 S2a）：把 `EPIRUS_HOLO2PROTO` 从"只有评测器会下达"接到训练入口 =====
 * 病（在册）：这一档自 v1.6.8 起**只有 `champion-map/holo2proto.mjs` 在评测期调 `setHolo2Proto`**，
 *   训练链路一条没接 ⇒ 给它设 env 会被 `knob-guard` 报成黑键（exit 6），或更糟：接了但不读回 = **A/A 臂**
 *   （`server/knob-guard.mjs` 头注记着本仓为这一族栽过至少 9 次）。
 * 三条纪律照 `EPIRUS_TRAIN_MODE`：① 引擎没 `setHolo2Proto` ⇒ exit 7 ② 下达后**读回消费点**，不等于下达值就 exit 7
 *   ③ 生效值进 `meta.recipe.h2p`，让产物自己说它是在哪一档下长大的。非法值由 `policy.js` 自己 throw（只认 off|proto|drop）。
 * ⚠ 这是**决策期**改写：不动包、不动卡面、不动网络形状 ⇒ 出厂面四个入口（`promote-champion` ‖ `eval-5p` ‖ `style-exam` ‖ `ui.js`）
 *   按门 **D229⑧** 一条都不许读它。所以本臂的**评估必须在 off 档做**（拿现成的尺跑新产物）——
 *   否则"网络学会了选自盾"与"评估时被换了个动作"这两件事分不开。 */
{
  const wantH2P = String(process.env.EPIRUS_HOLO2PROTO || '').trim();
  if (wantH2P !== '') {
    if (!P || typeof P.setHolo2Proto !== 'function') {
      console.error('[train-3p] ⛔ 传了 EPIRUS_HOLO2PROTO 但引擎没有 setHolo2Proto ⇒ 拒绝静默空转');
      process.exit(7);
    }
    const gotH2P = P.setHolo2Proto(wantH2P);
    if (gotH2P !== wantH2P) {
      console.error('[train-3p] ⛔ setHolo2Proto(' + wantH2P + ') 读回 ' + gotH2P + '（不等于下达值）⇒ 本臂作废');
      process.exit(7);
    }
    H2P_REQ = gotH2P;
    console.log('[train-3p] 决策期档已下达：EPIRUS_HOLO2PROTO=' + wantH2P + ' ⇒ 消费点读回 ' + P.holo2Proto() +
      '（仅本进程训练期生效 ⇒ 出厂面与评测口径逐字不变）');
  }
}

/* ===== §N8b（qoder 09-22）：接通"CLI 上没人读"的 EPIRUS_CLEAR_W =====
 * 门禁"场B 清场"是**在量的量**，但 `EPIRUS_CLEAR_W` 此前只接在 train-server/worker（浏览器训练路径）——
 * CLI 传了等于没传（09-22 实测：臂 a 因此把 7′ 逐字节复现了一遍，"单变量"是空转的）。
 * 与 v1.5.153 的热启动静默同族："要了开关却静默无效"。现在：>0 就打进本沙箱的 evo，并回显**生效值**；
 * 被 evo 的入参钳位拒绝 ⇒ exit 5（拒绝继续静默）。 */
const CLEAR_W_CLI = Number(process.env.EPIRUS_CLEAR_W || 0);
if (CLEAR_W_CLI > 0) {
  const gotClear = T.setClearReward ? T.setClearReward(CLEAR_W_CLI) : 0;
  if (!(Number(gotClear) > 0)) {
    console.error('⛔ EPIRUS_CLEAR_W=' + CLEAR_W_CLI + ' 未能生效（setClearReward 返回 ' + gotClear + '）—— 拒绝静默空转');
    process.exit(5);
  }
  console.log('[clear] train-3p 主线程生效值 CLEAR_W=' + gotClear);
}


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

/* ===== v1.5.172（qoder §N35）：把**判它的那张桌子**搬进训练（`EPIRUS_COUNTER_OPPS`，默认关）=====
 * 病（`v7xn22a` 实测，不是猜）：那条 400 代大配方终于长出了"兑现广度"（各格净 `G(落地) 3.5~3.9`、4 种真卡打上血，
 * 现役只有 2.2~2.7），结果 `promote --dry` 把它砍在**行为门**上 ——
 * `G4 无一行脚本能以 >60% 击败它`：最克它的就是「只防御(不还手)」（85%）与「只枪 1ジ压制」（82%）。
 * 而这两个原型**根本不在训练桌上**：`OPPS` 里最接近的 `defend` 是"会还手的防御"，`guardSpam`（纯不还手）
 * 在 `EpirusBots` 里早就有、只是没人用它当对手 ⇒ **判它的对手从不出现，适应力当然学不出来**。
 * 与 `EPIRUS_XN2REF=exam`（v1.5.150）同一条设计：**对着产品判据本身训 ⇒ 目标与验收一致**。
 * 默认关 ⇒ `OPPS` 逐字不变 ⇒ 历史臂仍可逐位复现。
 *
 * §E500（v1.6.35 · 10-09 通宵班）改成**名字表驱动**，因为原来的 boolean 一根改三个自由度：
 *   `=1`（或 `all`）⇒ 三个全上，**与 v1.5.172 起的历史臂逐位相同**（老口径不失效）；
 *   `=snipeSpam` ⇒ **只上狙击场** ⇒ 今晚要问的"是哪一型对手在施压"第一次成为单自由度问题。
 *   ⚠ 为什么要这个：§E499 之后 DS 提的 R1 写的是"对照臂只去掉狙击场"，而这根旋钮当时**表达不出那个对照**
 *   （去掉就是三个全去掉）⇒ 照原样跑完会得出"赢了但不知道谁在施压"的臂（§N12 那一族：读回 ≠ 作用点，而这里更糟，是作用点本身不唯一）。
 * 纪律与 `EPIRUS_ECON_OPPS` 同形：默认关 ⇒ `OPPS` 一字不变；名字不在表里 ⇒ **`exit 4` 点名**（少一个就是一根空枪）。 */
const COUNTER_OPP_TABLE = {
  guardSpam: { name: 'cnt:guardSpam', sel: Bots.pickGuardSpam },   // = gate-drafts 的「只防御(不还手)」
  gunSpam: { name: 'cnt:gunSpam', sel: Bots.pickGunSpam },         // ≈「只枪(1ジ压制)」
  gunFocus: { name: 'cnt:gunFocus', sel: Bots.pickGunFocus },     // G4 实际的「只枪·击杀优先」（10-23 发现 gunSpam 是打最肥，口径不对）
  snipeSpam: { name: 'cnt:snipeSpam', sel: Bots.pickSnipeSpam },  // ≈「只狙击」
  /* 10-24（ZCode · 用户点名"训练场难出坦克，查怎么调整"）：永久反弹席上训练桌。
   * 病（§六/§十二 冷启动批实测）：默认 9 席里 `pickWall` 只在 1/3 回合弹、`pickDefend` 是防御系 ⇒
   * 桌面防御压力 >> 反弹压力 ⇒ 坦克（穿防御）压过激光剑（被防御挡）——冷启动 6 枚产物里 3 枚坦克 76~95%，
   * 与用户口径"基础训练一般出激光剑（穿反弹）"相反。`pickReflectSpam`（bots.js 既有导出，本为 2P 基准造的
   * "永久反弹"）从没上过 3P 训练桌 ⇒ 反弹的惩罚在训练分布里结构性缺位。
   * ⚠ 只按名字点名（`EPIRUS_COUNTER_OPPS=reflectWall`）；数字老口径已冻结为三元组（v1.8.32）⇒ 不受本项影响。 */
  reflectWall: { name: 'cnt:reflectWall', sel: Bots.pickReflectSpam },  // 永久反弹：枪/坦克每一发都被弹回
  /* v1.8.37（10-25 ZCode · §二十一 激光眼移植批）：**会打激光序列的席**上训练桌（`EPIRUS_COUNTER_OPPS=laserBank`）。
   * 动机 = 电磁炮先例的第一块：珠爆发线 v1.5.130 进**默认池**的理由是"训练要看得见自己最大的洞"
   * （evo.js:179-188 在册）——而激光这条线，五个被否证的杠杆全是奖励/注入侧，**没有任何一臂的对手席
   * 真的做过"存 3ジ→蓄爆珠→下一回合激光"** ⇒ 梯度结构性缺位，与当年反弹缺位（reflectWall 那条）同形。
   * `pickLaserBank`（bots.js §E744/§E745 夜班造的教师，默认不进任何池）在这里只当**对手**上桌，
   * 不动教师通道。⚠ 只按名字点名；数字口径已冻结为三元组（v1.8.32）不受影响；`all`/`*` = 全表会带上它（与
   * gunFocus/reflectWall 同一既有语义，不另开特例）。 */
  laserBank: { name: 'cnt:laserBank', sel: Bots.pickLaserBank },

  /* ---- 11-01（ZCode · PREREG-2026-11-01-LONGSHORT b 部分）：RICH 压力席进 GA 训练桌（**加法，默认关**）----
   *   名单与 server/opp-pool.mjs 的 OPP_SPECS 同源同名（fn 逐字同引用）；不点 EPIRUS_COUNTER_OPPS 时一条行为不变
   *   （回归腿：v7 1 代小跑逐代轨迹逐字同）。RICH-13 的 6 个压力源 + 产品 7 里原生表没有的 heavyfire/deepsaver。
   *   gunspam 与表里既有 gunSpam 是同一函数（OPP_SPECS 的 fn 名），两个键只是别名，别重复加席。 */
  heavyfire: { name: 'cnt:heavyfire', sel: Bots.pickHeavyFire },
  deepsaver: { name: 'cnt:deepsaver', sel: Bots.pickDeepSaver },
  protomine: { name: 'cnt:protomine', sel: Bots.pickProtoMine },
  ringspam: { name: 'cnt:ringspam', sel: Bots.pickRingSpam },
  targeter: { name: 'cnt:targeter', sel: Bots.pickTargeter },
  deadlineburst: { name: 'cnt:deadlineburst', sel: Bots.pickDeadlineBurst },
  earlypressure: { name: 'cnt:earlypressure', sel: Bots.pickEarlyPressure }
};
const COUNTER_RAW = String(process.env.EPIRUS_COUNTER_OPPS || '').trim();
/* ⚑ v1.8.32（10-24 夜 · 千问）：**数字口径冻结成老三元组**，`all`/`*` 才等于全表。
 * 病（远端 main 因此红了一整轮，D130）：DS 的 `71e2c0af` 给表里加了第四个原型 `gunFocus`（G4 真口径），
 *   而数字/`all` 两条支共用 `Object.keys(COUNTER_OPP_TABLE)` ⇒ `EPIRUS_COUNTER_OPPS=1` 的含义
 *   从"三个全上"**静默变成**"四个全上"。这根旋钮对历史臂的承诺是逐位可复现，不是"跟着表长"。
 *   在册证据（逐条读过来处原文才写的）：`logs/RESEARCH-LOG-2026-09-23-qoder-night.md:346`（新键把三名推进 OPPS，9→12）
 *   与 `:462`（`v7xn22a` 配方唯一变量 = `=1`）、`logs/RESEARCH-LOG-2026-09-24-qoder-night.md:102`（`co1s1..9`）
 *   与 `:225`（K-12 出货臂 `cbs1s2-band2` = `=1` + `SEL_LAND=1` + 1500 代）、`logs/RESEARCH-LOG-2026-09-24-qoder-handoff.md:483`
 *   （A/B/C/D 四臂里 B/D 用它）、`logs/OVERNIGHT-2026-10-05-qoder.md:874`（实验组 seed 77/78/79）、
 *   `logs/OVERNIGHT-2026-10-09-qoder.md:23` 原话"原来一把塞 3 个对手（guard/gun/snipe，OPPS 9→12）"。
 * ⇒ 数字 = 冻结三元组（**不含** gunFocus）；`all`/`*` = 全表；`gunFocus` 要上只能按名字点名
 *   （DS 自己的 g18 命令原文就是 `EPIRUS_COUNTER_OPPS=guardSpam,gunFocus` ⇒ 这条路不受影响）。 */
const COUNTER_LEGACY_TRIPLET = ['guardSpam', 'gunSpam', 'snipeSpam'];
const COUNTER_WANT = !COUNTER_RAW || COUNTER_RAW === '0' ? []
  : /^\d+$/.test(COUNTER_RAW) ? COUNTER_LEGACY_TRIPLET.slice()
    : (COUNTER_RAW === 'all' || COUNTER_RAW === '*') ? Object.keys(COUNTER_OPP_TABLE)
      : COUNTER_RAW.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const COUNTER_OPPS = COUNTER_WANT.map(function (nm) {
  if (nm === 'synthMix') {
    const POOL_FNS = [
      Bots.pickAggressive, Bots.pickDefend, Bots.pickBalanced, Bots.pickHeavyFire, Bots.pickDeepSaver,
      Bots.pickProtoMine, Bots.pickRingSpam, Bots.pickTargeter, Bots.pickEarlyPressure, Bots.pickToolKit,
    ].filter((f) => typeof f === 'function');
    return {
      name: 'cnt:synthMix',
      sel: function (state, pid) {
        const turn = Math.floor((state.round || 1) / 3);
        const h = ((pid + 1) * 2654435761 + turn * 2246822519 + ((state.gameSeq || 0) * 3266489917)) >>> 0;
        const r = state.rng && typeof state.rng.next === 'function' ? state.rng.next() : ((h & 65535) / 65536);
        const idx = (r < 0.15) ? Math.floor((r / 0.15) * POOL_FNS.length) % POOL_FNS.length : (h % POOL_FNS.length);
        return POOL_FNS[idx].apply(null, arguments);
      },
    };
  }
  const o = COUNTER_OPP_TABLE[nm];
  if (!o) {
    console.error('[train-3p] ⛔ EPIRUS_COUNTER_OPPS 里有不认识的名字：' + JSON.stringify(nm) +
      '（合法的是 ' + Object.keys(COUNTER_OPP_TABLE).join(',') + ' ‖ 或数字 = 老三元组 ' + COUNTER_LEGACY_TRIPLET.join(',') +
      '（**不含** gunFocus，与历史臂同形）‖ `all`/`*` = 全表 ' + Object.keys(COUNTER_OPP_TABLE).length + ' 个）⇒ 拒绝静默少放对手');
    process.exit(4);
  }
  if (typeof o.sel !== 'function') {
    console.error('[train-3p] ⛔ EPIRUS_COUNTER_OPPS 要的对手在 EpirusBots 里不存在：' + o.name + ' ⇒ 拒绝静默少放对手（少一个就是一根空枪）');
    process.exit(4);
  }
  return o;
});
if (COUNTER_OPPS.length) {
  for (const o of COUNTER_OPPS) OPPS.push(o);
  console.log('[counter-ops] 判据原型已进训练桌：' + COUNTER_OPPS.map(function (o) { return o.name; }).join(',') +
    ' ⇒ OPPS 从 9 个变 ' + OPPS.length + ' 个' +
    (COUNTER_OPPS.length === 1 ? '（**单自由度**：这一臂只改了一型对手，读得动"是谁在施压"）'
      : COUNTER_LEGACY_TRIPLET.length === COUNTER_OPPS.length &&
        COUNTER_OPPS.every(function (o) { return COUNTER_LEGACY_TRIPLET.indexOf(o.name.replace(/^cnt:/, '')) >= 0; })
        ? '（老口径：' + COUNTER_OPPS.length + ' 个一起上 ⇒ 本臂**不能**归因到某一型对手）'
          : '（点名 ' + COUNTER_OPPS.length + ' 型：' + COUNTER_WANT.join(',') + ' ⇒ 不是老口径，但这批仍不能归因到某一型）'));
}

/* =====（ZCode · 11-02 夜）`EPIRUS_PACK_OPP=<包路径>`：把一枚**包**放上训练桌当对手席（默认关）=====
 * 目的（M-3 线索③后半）：进化中的包在桌上直接面对 ration6 产物（会全息/藤甲/挑衅/地雷/坦狙的用户），
 *   从**防守侧**覆盖批 2/3 技能——脚本对手永远不会出这些牌，宽门槛与配给教师都教不会"怎么应对它们"。
 * 纪律：① 只在 2.0 臂可用（gen-3 包走 P.unpack 原生路；v7 模式拒跑——混代是评测能力不是训练能力）；
 *   ② 读不出 ⇒ exit 4（拒静默少放对手，同 COUNTER_OPPS 的规矩）；③ 回执印参数长度与 OPPS 计数。 */
const PACK_OPP = process.env.EPIRUS_PACK_OPP || '';
if (PACK_OPP) {
  if (!process.env.EPIRUS_ARCH2) {
    console.error('[train-3p] ⛔ EPIRUS_PACK_OPP 只在 EPIRUS_ARCH2 2.0 臂可用（gen-3 包席；v7 模式不收）'); process.exit(4);
  }
  try {
    const poSrc = readFileSync(PACK_OPP, 'utf8');
    const poM = poSrc.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!poM) throw new Error('没有 EPIRUS_CHAMPION 外壳');
    const poJson = JSON.parse(poM[1]);
    /* DS 11-02 晚（用户：「让已经训练出的冠军拿来当对手」）：v7 包（v:7 / 单向量 a）也收——
     *   arch2 的 chooseCandidates/forwardCands 有**长度守卫**（params 长度 ≠ L.n ⇒ 交回原 v7 实现），
     *   所以传 Float64Array(5689) 给 policyChooserN 会走回 v7 通路。v7 最多 5 人局（4 槽），8P 训练会在
     *   发局处按引擎自己的人数限制报错 ⇒ 用 v7 包席时训练桌必须 N≤5（本批固定 N=5）。 */
    const poParams = (poJson.v === 7 || (poJson.a && poJson.v == null))
      ? Float64Array.from(poJson.a)
      /* 11-12 修接线：3P 包必须用**原生** EpirusPolicy2.unpack(o, window)，不能用 P.unpack；
       *   arch2 安装后 P 是当前架构（L.n=5225），旧 gen 的 .bak（如 DSTR4 obs3b 7993）会被长度守卫拒成 null。 */
      : (sb.window.EpirusPolicy2 ? sb.window.EpirusPolicy2.unpack(poJson, sb.window) : P.unpack(poJson));
    if (!poParams || !poParams.length) throw new Error('解包失败');
    OPPS.push({ name: 'pack:' + PACK_OPP.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), sel: T.policyChooserN(poParams, 0.15) });
    console.log('[pack-opp] 包席上桌：' + PACK_OPP + '（params ' + poParams.length + ' ‖ OPPS → ' + OPPS.length + ' 个）');
  } catch (e) {
    console.error('[train-3p] ⛔ EPIRUS_PACK_OPP 读不出：' + (e && e.message || e) + ' ⇒ 拒静默少放对手'); process.exit(4);
  }
}

/* ===== §E631（v1.7.83 · 千问 10-17 白班）：**把冠军池放上训练桌** `EPIRUS_POOL_OPPS=<k>`（默认关）=====
 * 用户裁定（10-17 逐字）：「把冠军池本身当做一个新判据也可以参与训练，并且新冠军总是能进冠军池，这样永远不会碰到区分度低的问题」。
 * 为什么是**混进 `OPPS`** 而不是"换成池桌"：`docs/research/archive/2026-11-06-october-sweep/TRAINING-METHOD-CONCLUSIONS-2026-10-17-ds.md:67` 那条实测——
 *   **对固定对手做 RL 必然练出 exploiter**（E1 臂就是标本：对手是四份冻结的自己，回收 −27.6/−43.0pt），
 *   而标准解法写的就是「混合对手池（池成员 + 脚本 + 自己的历史快照，**轮换**）」。
 *   轮换这里**已经是现成的**：`js/train/evo.js` 的 `oppSeatIndex(gen,g,k,len,block) = (gen*3+g+(block?0:k)) % len`
 *   会遍历整张 `OPPS` ⇒ append 池成员就自动与 9 条脚本基准同桌轮换，**不新增任何席位逻辑**
 *   （自己写一份席位分配就是第二份实现，而且会跟钉着闭键的 `D4` 打架）。
 * ⚠ 两条口径必须先说清楚，不然是给自己埋"赢了但不知道谁在施压"那种臂：
 *   ① **默认关 ⇒ `OPPS` 一字不变**（历史臂逐位可复现；`tools/gates/train-evo.mjs:2071` 那条"默认关的产物与登记基线逐位相同"照绿）；
 *   ② 一开就改 `OPPS.length` ⇒ **每一局**的对手映射都变（不是"多出几席"那么局部）⇒ **配对实验要两臂同 K**，
 *      对照臂不能拿出厂臂当逐位对照（这条与 §E500 的名字表驱动同一个坑）。
 * 纪律与 `EPIRUS_COUNTER_OPPS` / `EPIRUS_ECON_OPPS` 同形：档认不出、枚数不够、成员包读不出 ⇒ **`exit 4` 点名**
 *   （少一个就是一根空枪）；上了桌必须**真被问到**，否则 `exit 8`（横幅证明变量、证明不了效果）。
 * 名单真源 = `champion-map/pool-members.tsv`（产品池的真源，`js/pool-draw.js` 与 `D234` 都吃这一张）。
 * ⚠ 成员 `.path` 指向的 `.bak` 里有一部分是 gitignore 的 ⇒ 干净克隆可能读不到，那是 **`D234` 的活**（在册产物闸），
 *   这里只负责"读不到就响亮失败"，不静默少放。记账写 **wid**（与 `hotstartFrom` 同一条纪律），不写路径。 */
const POOL_OPP_N = Number(process.env.EPIRUS_POOL_OPPS || 0);
const POOL_OPP_TIER = String(process.env.EPIRUS_POOL_OPPS_TIER || 'hard');
const POOL_OPP_TABLE = String(process.env.EPIRUS_POOL_OPPS_TABLE || 'champion-map/pool-members.tsv');
const POOL_OPPS = [];
if (Number.isNaN(POOL_OPP_N) || POOL_OPP_N < 0 || POOL_OPP_N !== Math.floor(POOL_OPP_N)) {
  console.error('[pool-ops] ⛔ `EPIRUS_POOL_OPPS` 要非负整数（收到 ' + JSON.stringify(process.env.EPIRUS_POOL_OPPS || '') + '）⇒ 拒绝把它当 0');
  process.exit(4);
}
if (POOL_OPP_N > 0) {
  if (!existsSync(POOL_OPP_TABLE)) { console.error('[pool-ops] ⛔ 池真源表不在：' + POOL_OPP_TABLE); process.exit(4); }
  const pl = readFileSync(POOL_OPP_TABLE, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const ph = Object.fromEntries(pl[0].split('\t').map((x, i) => [x, i]));
  for (const c of ['id', 'wid', 'path', 'tier']) {
    if (ph[c] === undefined) { console.error('[pool-ops] ⛔ 池表缺列 ' + c + ' ⇒ 表头变了要去改真源，不在这里兜底'); process.exit(4); }
  }
  const pr = pl.slice(1).map(r => r.split('\t'));
  const cand = pr.filter(r => r[ph.tier] === POOL_OPP_TIER);
  if (cand.length < POOL_OPP_N) {
    console.error('[pool-ops] ⛔ tier=' + POOL_OPP_TIER + ' 只有 ' + cand.length + ' 枚 ⇒ 要 ' + POOL_OPP_N + ' 枚，拒绝静默少放' +
      '（这张表里的档：' + Array.from(new Set(pr.map(r => r[ph.tier]))).join(' ‖ ') + '，可用 `EPIRUS_POOL_OPPS_TIER=` 点名）');
    process.exit(4);
  }
  for (const r of cand.slice(0, POOL_OPP_N)) {
    const mid = r[ph.id], mpath = r[ph.path];
    let params = null;
    try {
      if (!existsSync(mpath)) throw new Error('路径不在盘上');
      params = loadPackParamsAny(mpath);
      if (!params) throw new Error('外壳解不出来（没有 `EPIRUS_CHAMPION[_3P]` 对象）');
    } catch (e) { console.error('[pool-ops] ⛔ 成员 ' + mid + ' 的包读不出（' + mpath + '：' + e.message + '）⇒ 缺行 ≠ 量了没测出来，拒绝静默少放对手'); process.exit(4); }
    let asked = 0;
    const base = champChooser(params);
    const wrapped = function (state, pid, legal) { asked++; return base(state, pid, legal); };
    wrapped.poolId = mid; wrapped.poolWid = r[ph.wid]; wrapped.asked = function () { return asked; };
    POOL_OPPS.push({ name: 'pool:' + mid, sel: wrapped });
  }
  for (const o of POOL_OPPS) OPPS.push(o);
  console.log('[pool-ops] 冠军池成员已进训练桌：' + POOL_OPPS.map(o => o.name).join(',') +
    '（档=' + POOL_OPP_TIER + ' · 真源=' + POOL_OPP_TABLE + '）⇒ OPPS 从 9 个变 ' + OPPS.length + ' 个');
  console.log('[pool-ops] ⚑ 轮换走既有 `oppSeatIndex`（池成员与 9 条脚本基准同桌轮换 ⇒ 不是"对固定名单训"）；' +
    '但开了它就改了 `OPPS.length` ⇒ **配对实验两臂必须同 K**，不许拿出厂臂当逐位对照');
  process.on('exit', function () {
    /* 牙要判得对，先得把"轮换到底能走到哪几席"算出来，而不是拿"没被问到"当断线的证据。
     * ⚑ **本班订正（v1.7.92，19:5x 实测）**：这一块的旧版有两处错，都是"仪器自己骗自己"那一族 ——
     *   ① `k` 的界写成了 `N-2`，而引擎里 `ok` 是**每个非受评席**都加一（`evo.js:1963` ⇒ 一局有 `N-1` 个对手席）
     *     ⇒ 可达索引被**系统性少数一格**：2 代 × 6 局 × N=3 时旧版算出 `0..8`，而引擎真走到 `9`
     *     ⇒ 于是同一条日志里既印了「B5-10-31 被问 60 次」又印了「#9 不可达」——**自相矛盾摆在脸上**。
     *   ② 注释里承诺的第三种情形（"不可达却被问到 ⇒ 我的模型与引擎不符"）**代码从没实现**，
     *     所以那次矛盾读数落进了"全不可达"那一支，报了句假话（"一枚池席都没轮到"）。
     *   订正做法：**不再自己抄公式**，直接问引擎的纯函数 `T.oppSeatIndex(gen,g,k,len,block)`（单一来源，
     *     门 D4 钉它），并把 `EPIRUS_OPP_BLOCK` 的形状读回来一起算（开了整桌同原型时 `k` 项归零 ⇒ 可达集**更小**，
     *     旧版完全没管这一维）。
     *   三种情形分开判：① 可达而没被问到 ⇒ 真断线 `exit 8`；② **不可达却被问到 ⇒ 模型与引擎不符** `exit 8`；
     *   ③ 不可达且没被问到 ⇒ 响亮说"这轮根本没测到它"，不判失败（短程 smoke 合法，但**不许**当"池对手参与训练"的证据）。 */
    const baseIdx = OPPS.length - POOL_OPPS.length;                 // 我这两枚在表里的位置（append 在尾部）
    const len = OPPS.length, reach = new Set();
    const blockedOf = (function () {
      if (typeof T.oppTable !== 'function') return false;
      const tb = T.oppTable() || {};
      return !!tb.block;
    })();
    if (typeof T.oppSeatIndex === 'function') {
      for (let gen = 0; gen < GENS; gen++) for (let g = 0; g < GAMES; g++)
        for (let k = 0; k < Math.max(0, N - 1); k++) reach.add(T.oppSeatIndex(gen, g, k, len, blockedOf));
    }
    const hits = POOL_OPPS.map(o => o.sel.asked());
    const cells = POOL_OPPS.map((o, i) => ({ o: o, idx: baseIdx + i, asked: hits[i] }));
    const unreachable = cells.filter(x => !reach.has(x.idx));
    const reachableButSilent = cells.filter(x => reach.has(x.idx) && !x.asked);
    const askedButUnreachable = unreachable.filter(x => x.asked > 0);
    console.log('[pool-ops] 开火计数：' + POOL_OPPS.map((o, i) => o.name + ' ' + hits[i]).join(' ‖ ') +
      '（合计 ' + hits.reduce((a, b) => a + b, 0) + ' 次 ‖ 可达集**问引擎 `oppSeatIndex` 现算**（整桌同原型=' + (blockedOf ? '开' : '关') +
      '）：' + len + ' 席里本轮可达 ' + reach.size + ' 个索引' +
      (unreachable.length ? ' ‖ 不可达：' + unreachable.map(x => x.o.name + '#' + x.idx).join(',') : '') + '）');
    if (!process.exitCode && askedButUnreachable.length) {
      console.error('[pool-ops] ⛔ 模型与引擎不符：' + askedButUnreachable.map(x => x.o.name + '(#' + x.idx + ' 被问 ' + x.asked + ' 次)').join(' ‖ ') +
        ' 按 `oppSeatIndex` 算出来到不了，却真被问到了 ⇒ 分母/推进方式与引擎不一致，**这轮的可达性读数作废**');
      process.exitCode = 8;
    } else if (!process.exitCode && reachableButSilent.length) {
      console.error('[pool-ops] ⛔ 空枪：' + reachableButSilent.map(x => x.o.name).join(' ‖ ') +
        ' 按轮换模型这一代/局应当被问到，实际 0 次 ⇒ 分母或席位填充与 `evo.js` 的 `oppSeatIndex` 不一致，读数作废');
      process.exitCode = 8;
    } else if (!process.exitCode && unreachable.length === POOL_OPPS.length && !hits.some(h => h > 0)) {
      console.error('[pool-ops] ⛔ 这一轮**一枚池席都没被问到**（GENS=' + GENS + ' GAMES=' + GAMES + ' N=' + N +
        ' ⇒ 现算可达集最大 ' + Math.max.apply(null, Array.from(reach)) + ' < 池席起点 ' + baseIdx +
        '）⇒ 短程 smoke 可以，但**不许**把这轮读成"池对手参与了训练"');
      process.exitCode = 8;
    } else if (!process.exitCode && unreachable.length) {
      console.log('[pool-ops] ⚑ ' + unreachable.map(x => x.o.name + '#' + x.idx).join(' ‖ ') +
        ' 这轮结构性到不了（现算可达集最大 ' + Math.max.apply(null, Array.from(reach)) + '）⇒ 这几枚的读数**缺失**，' +
        '不是"测过是 0"，别当测过；要全覆盖就把 `GENS`/`GAMES` 提到可达集里出现那个索引');
    }
  });
}

/* ===== 2026-10-28（DS · 2.0 重构前）：`EPIRUS_PAIRED=1` ⇒ **配对评估** =====
 * 为什么现在加：千问 §E822 量出「同代个体各自抽桌 ⇒ 名人堂 1↔2 名差 0.05pt 而自身极差 7.9pt ⇒ 基本是抽签」。
 *   配对之后，同一代所有个体吃同一批局（同对手、同局面、同随机流），适值差里不再混「哪桌好打」的运气。
 * 口径（引用必带）：① 默认关；② 打开后**跨代**仍换桌；③ 它只改「谁跟谁吃同一批局」，不改局的条数与任何判据。 */
if (process.env.EPIRUS_PAIRED) {
  if (typeof T.setPairedEval !== "function" || typeof T.evalSeedOf !== "function") {
    console.error("[train-3p] ⛔ 下达了 EPIRUS_PAIRED 但引擎没有 setPairedEval/evalSeedOf ⇒ 拒绝静默空转");
    process.exit(7);
  }
  T.setPairedEval(true);
  if (T.pairedEvalOn() !== true) { console.error("[train-3p] ⛔ EPIRUS_PAIRED 读回不是 true ⇒ 退出"); process.exit(7); }
  const s0 = T.evalSeedOf(7, 0), s3 = T.evalSeedOf(7, 3);
  if (s0 !== s3) { console.error("[train-3p] ⛔ 配对评估没生效（同代两个下标的种子不同：" + s0 + " vs " + s3 + "）"); process.exit(7); }
  console.log("[paired] 配对评估已开：同代所有个体吃同一批局（gen7 种子 " + s0 + " ‖ idx 0/3 相同）");
}
/* ===== §N6 修正（v1.5.150 · DS 09-22）：**2P 切片的对手必须是 2P 强参照，不能是多人池** =====
 * 病（实测，`docs/research/logs/RESEARCH-LOG-2026-09-22-ds.md` §2）：原实现让每个个体对**多人池**打 2P，而现役包对
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
/* ⚑ 11-01（ZCode）：参照包装载**只在 XN2W>0 时做**。原先无条件装载 ⇒ EPIRUS_ARCH2 臂全灭在起跑线
 *   （arch2.unpack 拒读 v7 2P 包 ⇒ exit 2），而 XN2_OPPS 在 XN2W=0 时根本不会被用到——纯白拦。
 *   XN2W>0 的 2.0 臂：`EPIRUS_XN2REF` 指到 v:92 包即可（loadPackParamsAny 走的就是当前 P.unpack）。 */
for (const rp of (XN2W > 0 ? XN2REF_PATHS : [])) {
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
let seedParams = null, hotstartFrom = null, hotstartPath = null;
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
    if (m) {
      const raw = P.unpack(JSON.parse(m[1]), true);
      /* ⚑ 11-01（ZCode）：2.0 热启动**不过 embedLegacy**——那是 v7 的 3337→5689 加宽语义，arch2 没覆盖它，
       *   会把 v:92 的 7993 参数折成 5689（冒烟实测：种子包 7993 ⇒ seedParams 5689 ⇒ 被我的长度闸拦下）。
       *   2.0 的 unpack 输出就是参数本身（Float64Array，长度恒 = 布局长）。 */
      seedParams = raw ? (process.env.EPIRUS_ARCH2 ? raw : P.embedLegacy(raw)) : null;
      hotstartPath = srcPath;
      /* ===== 2026-10-12 DS：`hotstartFrom` 记**权重身份（wid）**，不再记文件路径 =====
       * 依据：① `server/train-server.mjs:289` 一直记的是 `weightsId(seedPack)`；
       *   ② `champion-map/lineage.mjs:9` 的契约写着"`hotstartFrom` —— 父指针：从哪一枚的**权重**热启动来的（一个哈希）"。
       * 病（实测，不是推测）：CLI 侧记**路径** ⇒ 血统图只能按路径推 ⇒ 画**虚线**，而路径会因去重/改名而失效
       *   ——63 枚子包点名 `docs/artifacts/e234-out/K2.js`，那份被搬进隔离区 ⇒ 6 天来只能画虚线；
       *   服务端那一路因为记哈希，一直是实线。两条路记的东西不同 = 同一件事两处维护的那种漂移。
       * 路径**不丢**：它就在 `recipe.env.EPIRUS_SEEDPACK` 里（本次只改这一个字段的**内容**，不改 meta 形状、不加字段）。
       * 算不出（外壳不认/形状异常）⇒ **退回路径**（老行为）——不猜、也不静默。 */
      hotstartFrom = (seedParams && widOf(src)) || srcPath;
      ok = !!seedParams;
    }
  } catch (e) { ok = false; }
  if (!ok) {
    console.error('[train-3p] ⛔ EPIRUS_HOTSTART=1 但读不出种子包：' + srcPath +
      '（拒绝静默冷启动 —— 白跑一整臂正是 09-22 臂 7/8 的教训）');
    process.exit(5);
  }
  /* ⚑ 11-01（ZCode）：2.0 热启动的**长度闸**——种子包参数长必须等于装出的布局长。
   *   11-01 冒烟：spec 串 `input=obs3b` 被 `Number()` 静默落 v7 面（paramCount=5225 ≠ 包 7993），
   *   若没有这道闸，热启动会"成功"读包然后整臂在错误结构上白跑。v7 侧不加（embedLegacy 有合法的加宽语义）。 */
  if (process.env.EPIRUS_ARCH2 && seedParams && seedParams.length !== P.paramCount()) {
    console.error('[train-3p] ⛔ 2.0 热启动种子包参数长 ' + seedParams.length + ' ≠ 当前布局 ' + P.paramCount() +
      '（spec 与包结构不一致 —— 拒绝在错误结构上开跑）');
    process.exit(5);
  }
}

/* ===== 11-10（DS）：课程席换成**一枚真实冠军包**（EPIRUS_COURSE_PACK=<path>）=====
 * 动因：复核发现训练 objective 仍停在 A 轴脚本桌，而主尺已换 C（脚本桌 + 冠军桌）；
 *   反射墙能 farm 脚本桌、却打不过冠军桌 ⇒ 不给它见冠军，GA 永远学不会打冠军。
 * 纪律：① 读不出 / 不兼容 ⇒ exit 8（不许静默退回脚本课程）；② 设了 pack 就覆盖 COURSE_BOT；③ 印回执。
 * ⚠ 位置在种子包装载**之后**：同一条 unpack 路径（P.unpack(o,true)）在两种外壳上都被验证过。 */
if (process.env.EPIRUS_COURSE_PACK != null && process.env.EPIRUS_COURSE_PACK !== '') {
  const pp2 = String(process.env.EPIRUS_COURSE_PACK).trim();
  if (typeof T.setCoursePack !== 'function') { console.error('⛔ EPIRUS_COURSE_PACK 下达了，但引擎没有 setCoursePack ⇒ 黑键，拒跑'); process.exit(6); }
  let paramsC = null;
  try {
    const srcC = readFileSync(pp2, 'utf8');
    const mC = srcC.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (mC) {
      const blobC = JSON.parse(mC[1]);
      paramsC = (blobC && blobC.v === 92 && sb.window.EpirusPolicy2)
        ? sb.window.EpirusPolicy2.unpack(blobC, sb.window)
        : (P_LEGACY_UNPACK ? P_LEGACY_UNPACK(blobC, true) : null);
    }
  } catch (e) { console.error('⛔ EPIRUS_COURSE_PACK 读不出：' + pp2 + ' ⇒ ' + e.message); process.exit(8); }
  if (!paramsC) { console.error('⛔ EPIRUS_COURSE_PACK 包不兼容（unpack 返回 null）：' + pp2); process.exit(8); }
  T.setCoursePack(T.policyChooserN(paramsC, 0.15));
  if (typeof T.coursePackOn === 'function' && !T.coursePackOn()) { console.error('⛔ EPIRUS_COURSE_PACK 没生效 ⇒ 拒静默空转'); process.exit(7); }
  console.log('[部署档] EPIRUS_COURSE_PACK ⇒ ' + pp2 + ' 作为课程席（覆盖 COURSE_BOT），参数量 ' + paramsC.length);
  DEPLOY_REC.EPIRUS_COURSE_PACK = { path: pp2, n: paramsC.length };
}

/* ===== 11-10（DS）：**fitness 掺冠军桌**（EPIRUS_FIT_CHAMP=<包> [EPIRUS_FIT_CHAMP_EVERY=<k>]）=====
 * 为什么：课程席只占 1 席/代，GA 梯度主体仍是脚本局 ⇒ 反射墙在 fitness 里不吃亏。
 *   这里每 k 局（默认 4）把一席对手换成**真实冠军包**，打不过会还手的人就直接扣分。
 * 兼容性：包必须与当前架构同源（obs5 包才能装进 obs5 布局）。 */
if (process.env.EPIRUS_FIT_CHAMP != null && process.env.EPIRUS_FIT_CHAMP !== '') {
  const pf = String(process.env.EPIRUS_FIT_CHAMP).trim();
  const every = Math.max(1, Math.floor(Number(process.env.EPIRUS_FIT_CHAMP_EVERY || 4) || 4));
  if (typeof T.setFitChamp !== 'function') { console.error('⛔ EPIRUS_FIT_CHAMP 下达了，但引擎没有 setFitChamp ⇒ 黑键，拒跑'); process.exit(6); }
  let paramsF = null;
  try {
    const srcF = readFileSync(pf, 'utf8');
    const mF = srcF.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (mF) {
      const blobF = JSON.parse(mF[1]);
      /* 11-10（用户：给训练增加兼容性，v7/obs3 冠军直接拉来当对手）：v:92 走 Policy2（按**包自己的 dims** 建布局，
       *   不按当前 spec），v7 走 legacy unpack。P.unpack 的 v92 分支依赖 `global.EpirusPolicy2`（沙箱里可能没挂上）⇒ 显式双路。 */
      paramsF = (blobF && blobF.v === 92 && sb.window.EpirusPolicy2)
        ? sb.window.EpirusPolicy2.unpack(blobF, sb.window)
        : (P_LEGACY_UNPACK ? P_LEGACY_UNPACK(blobF, true) : null);
    }
  } catch (e) { console.error('⛔ EPIRUS_FIT_CHAMP 读不出：' + pf + ' ⇒ ' + e.message); process.exit(8); }
  if (!paramsF) { console.error('⛔ EPIRUS_FIT_CHAMP 包不兼容（同架构才行）：' + pf); process.exit(8); }
  const st = T.setFitChamp(T.policyChooserN(paramsF, 0.15), every);
  if (!st || !st.on) { console.error('⛔ EPIRUS_FIT_CHAMP 没生效 ⇒ 拒静默空转'); process.exit(7); }
  console.log('[部署档] EPIRUS_FIT_CHAMP ⇒ ' + pf + '（每 ' + st.every + ' 局一席；参数量 ' + paramsF.length + '）');
  DEPLOY_REC.EPIRUS_FIT_CHAMP = { path: pf, every: st.every, n: paramsF.length };
}

/* 11-04 傍晚（千问 · 波 H）：**随机起点幅度**从硬编码提出成一个显式剂量。
 *   动因（`scratch/coldstart-why-1104.mjs` 的实测，账在 `RESULTS-2026-11-04-COLDSTART-qoder.md`）：
 *   2.0 在出厂幅度 0.25 下，8 枚随机粒在产品温度（temp 0.15）打出来的**聚合行为几乎同一点**
 *   （非ジ出手里防御族 84.0%、粒间 sd 0.9pt）；同一把尺量 v7 的 0.25 是 sd **31.3pt** ⇒
 *   2.0 的冷启动失败不是"地形没有上坡"，是**种群里没有可被选择看见的行为方差**。
 *   幅度扫到 2 / 4 时 sd 长到 18.6 / 30.0pt（个体内种数从 11.8 降到 8.9 / 5.0，与 v7 随机起点的 3.4 同向）。
 * ⚑ 缺省 0.25 ⇒ 一字不改旧臂；下面两处调用点（初始种群 + 每 30 代补一粒新血）**必须同一个变量**，
 *   否则"新血"会用另一套幅度，等于偷偷加了第二种初始化（本仓两份同构实现必漂移的老账）。 */
const INIT_SCALE = Number(process.env.EPIRUS_INIT_SCALE || 0.25);
if (!(INIT_SCALE > 0) || !isFinite(INIT_SCALE)) {
  console.error('[train-3p] ⛔ EPIRUS_INIT_SCALE 必须是 >0 的有限数（出厂 0.25）：收到 ' + JSON.stringify(process.env.EPIRUS_INIT_SCALE));
  process.exit(2);
}
console.log('[train-3p] 随机起点幅度 = ' + INIT_SCALE + (INIT_SCALE === 0.25 ? '（出厂档 ⇒ 与历史臂同）' : ' **非出厂档**（两处分流点都吃这个值）'));
let pop = [];
for (let i = 0; i < POP; i++) {
  if (seedParams && i === 0) pop.push(seedParams);
  else if (seedParams && i < Math.floor(POP / 3)) pop.push(P.mutatePolicy(seedParams, 0.10));
  else pop.push(P.makePolicy(INIT_SCALE));
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
/* ===== E2（千问 10-17 通宵班）搜索算子的三个旋钮 —— **默认值 = 今天的行为，一字不变** =====
 * 为什么先做这个而不是继续调梯度：本班 E1 量到"从冠军出发 1300 代 = 15.9 分钟，注册尺上 −0.6pt（种子散差 2.9pt）"
 *   ⇒ 预算不是瓶颈，**步长策略**才是。而这里有一条在册的口径打架（实测，不是推测）：
 *   `js/train/evo.js:2464` 写的是 `sigma = max(0.10, sigma*0.999)`，旁边那句注释还给了理由
 *     （"较高sigma地板+缓衰减：种群别坍缩，才能持续探索、突破退化盆地（否则冠军蝉联且续训退化）"）；
 *   而**真正跑 N 人臂的这里**（原 :1291）是 `max(0.06, sigma*0.995)` —— 地板低 40%、衰减快一倍。
 *   ⇒ 同一件事两份口径（v1.7.67 刚清过那一族），而且带理由的那份不是生效的那份。
 *   本班实测：跑到 gen 580 时 stdout 印 `sigma=0.060`（= 撞在这份 0.06 地板上），与 evo.js 注释承诺的 0.10 不同。
 * 旋钮：`EPIRUS_SIGMA_FLOOR`（默认 0.06）‖ `EPIRUS_SIGMA_DECAY`（默认 0.995）‖
 *       `EPIRUS_SIGMA_STALL=<K>`（默认 0=关）⇒ 连续 K 代 bestFit 没进步就把 σ 往回抬一档（×1.25，上限 0.18）
 * ⚠ 这三个键**只在显式下达时改行为**；默认档与今天逐位相同（下面读 env 时把默认写回同一组常数，不另立一份）。 */
const SIG_FLOOR = Number(process.env.EPIRUS_SIGMA_FLOOR || 0.06);
const SIG_DECAY = Number(process.env.EPIRUS_SIGMA_DECAY || 0.995);
const SIG_STALL = Number(process.env.EPIRUS_SIGMA_STALL || 0);
let sigStall = 0, sigBumps = 0, noProg = 0;
let cardStreak = 0;   // 11-10：连续多少代 top-1 的动作种类 < CARD_MIN
/* EPIRUS_STALL_ABORT=<K>（用户 11-01 傍晚提的"连续 n 代完全一样就提前报错终止"，GA 侧）：
 *   在册的 EPIRUS_SIGMA_STALL 已经在数"连续几代 bestFit 没进步"，但它的动作是**抬 σ 继续跑**（恢复）。
 *   这条复用同一个"没进步"计数器（只在真进步时归零，抬 σ 不算进步），超过 K 代就整个终止 ⇒ 一支注定没动静的臂
 *   不再把 400 代 × 25k 局跑满。默认 0=关（关时今天的形状一字不变）。 */
const STALL_ABORT = Math.max(0, Number(process.env.EPIRUS_STALL_ABORT || 0));
/* ===== 11-10（用户裁："4 张卡这个要求太低；训练过程中连续一段 <4 卡就直接杀，不要等结束再看"）=====
 * 现成的两根都不是这个形状：SEL_CARDS 只在**终局当选面**做一次份额地板；GA_GATE 是每代 top-3 的**饿退**（照样写产物）。
 * 本键用 fitness 自带的 `r.distinct`（本代 24 局里用过的**动作种类**，含ジ；与终局 card-usage 的 ≥0.5% 份额不是同一把尺）
 * 做便宜的早杀：连续 K 代 top-1 的 distinct < CARD_MIN ⇒ exit 13，不写产物。默认 0=关 ⇒ 历史轨迹逐字不变。 */
const CARD_ABORT = Math.max(0, Number(process.env.EPIRUS_CARD_ABORT || 0));
const CARD_MIN = Math.max(1, Number(process.env.EPIRUS_CARD_MIN || 4));
const CARD_ABORT_GAMES = Math.max(10, Number(process.env.EPIRUS_CARD_ABORT_GAMES || 20) || 20);
if (CARD_ABORT > 0 && (CARD_MIN < 2 || CARD_MIN > 30)) {
  console.error('[train-3p] ⛔ EPIRUS_CARD_MIN 必须在 2..30（收到 ' + CARD_MIN + '）⇒ 这是恒真/恒假判据，拒跑');
  process.exit(2);
}
if (CARD_ABORT > 0 && CARD_ABORT_GAMES < 10) {
  console.error('[train-3p] ⛔ EPIRUS_CARD_ABORT_GAMES 太短（<10 局 ⇒ 逐卡份额不稳）');
  process.exit(2);
}
if (CARD_ABORT > 0) console.log('[cardAbort] 训练期用卡地板：连续 ' + CARD_ABORT + ' 代 top-1 的用卡数 < ' + CARD_MIN + ' ⇒ 整臂 exit 13（不写产物；终局 SEL_CARDS 仍是份额口径）');
if (process.env.EPIRUS_SIGMA_FLOOR || process.env.EPIRUS_SIGMA_DECAY || process.env.EPIRUS_SIGMA_STALL) {
  console.log('[sigma 档] floor=' + SIG_FLOOR + ' decay=' + SIG_DECAY + ' stall=' + SIG_STALL +
    '（默认档是 floor=0.06 decay=0.995 stall=0 ‖ 而 `evo.js:2464` 那份写的是 0.10/0.999 —— 两份口径的账记在日志 E2）');
}
let bestParams = pop[0], bestFit = -1e9;
const hall = [];                       // 名人堂：训练分靠前的个体（终局用全对手验证重选）
/* ===== §E635（v1.7.92 · 千问 10-17 晚班）：名人堂按 **wid 去重** `EPIRUS_HALL_DEDUP=1`（默认关）=====
 * 病（实测，不是推测）：`addHall` 无脑 push、按**当代 8 局的 fit** 排序、第 7 名 pop ⇒ **同一粒权重可以占两席**。
 *   抓到实例：`pfx60`（seed 9101 · 60 代 · K=0）的 band3 与 band5 是同一个 wid `44fa8b50`，
 *   逐元素比 5689 个数 **0 处不同**，却各记一个 fit（1.072 ‖ 1.040）⇒ 那一臂的"前 6 名"实际只有 **5 个候选**。
 * 口径：开 ⇒ 已在榜的那粒**再进榜时拒收并计数**；**不更新**它榜里那个 fit ——
 *   "同一粒再抽一次拿到更高分"正是本条要挡住的那种运气；要改它的分得靠"进榜重评"那一类修法，不在这条里。
 *   ⚠ 只对**当前在榜**的席位去重（被 pop 掉的以后可以再进来）⇒ 拿席位上存好的 wid 比，不重算全表哈希。
 * 默认关 ⇒ hall 席位的对象里**一个字段都不加**、行为逐字不变 ⇒ 历史臂仍可逐位复现。 */
const HALL_DEDUP_RAW = process.env.EPIRUS_HALL_DEDUP;
const HALL_DEDUP = (HALL_DEDUP_RAW === undefined || HALL_DEDUP_RAW === '') ? false : (function () {
  const v = Number(HALL_DEDUP_RAW);
  if (!Number.isInteger(v) || v < 0 || v > 1) {
    console.error('[hall-dedup] ⛔ `EPIRUS_HALL_DEDUP` 只认 0 或 1（收到 ' + JSON.stringify(HALL_DEDUP_RAW) +
      '）⇒ 拒绝把它当默认关（这一格直接改榜的形状，不许静默回落）');
    process.exit(4);
  }
  return v === 1;
})();
let hallDupDropped = 0;
function addHall(params, fit) {
  if (HALL_DEDUP) {
    const w = widOfArr(params);
    if (hall.some(function (h) { return h.wid === w; })) { hallDupDropped++; return; }
    hall.push({ params: params, fit: fit, wid: w });
  } else {
    hall.push({ params: params, fit: fit });
  }
  hall.sort(function (a, b) { return b.fit - a.fit; });
  if (hall.length > 6) hall.pop();
}
if (HALL_DEDUP) console.log('[hall-dedup] 名人堂开按 wid 去重（同一粒权重只占一席；末了印拒收次数，不许留空）');

/* ===== §E654（10-19 下午 · 千问 · 用户裁「你来负责搞这些门禁的问题」）：**要开始训练就必须声明落点** =====
 *   病：`docs/artifacts/train-3p-out.js` 是门 D123 逐字比对的**基线**（`train-evo.mjs:2071`），任何一条忘了改道的臂覆盖它，
 *     红的都是**别人** —— 10-19 一天之内抓到两例现行：D162 报 `got≠want`（写方 = D127 的 on 臂 `train-runner.mjs:738`）
 *     ‖ D116 行为二（`ship-promote.mjs:422`）没改道，被 §E589 拦成 exit 9。
 *   老办法是"每条腿自己记得带 `EPIRUS_T3P_OUT`"——纪律长在人身上就会漏（DS 的 CHANGELOG 教训 #2 写的正是这条：跟着红点清，从没红过的腿就一直漏）。
 *   现在改成**声明制**，三选一：① `EPIRUS_T3P_OUT=<路径>`（并发臂的常规做法；改道到仓库外要一并给 `EPIRUS_BAND_DIR`，否则 band 备份仍撒进 `docs/artifacts` ⇒ D191 红）；
 *   ② `EPIRUS_T3P_BASELINE=1`（只有基线持有者该用，写明"这一次就是要写默认落点"，落盘时打 `[WRITE-BASELINE]`）；③ `EPIRUS_PUBLISH=1`（发布态写 `js/**`，另一条路）。
 *   位置**故意放在所有启动校验之后**：暗键 exit 6 / 坏参照 exit 2 / 坏种子 exit 5 / 打错名 exit 4 / `--help` exit 64 这些退出码一个都不许被我这条闸改掉；
 *     而"没声明就要开跑"的臂在这里停 ⇒ 省的是**一整臂的算力**（不只是归因）。退出码 **10**（与既有 9「守卫拦下没写盘」不撞）。 */
if (!process.env.EPIRUS_T3P_OUT && process.env.EPIRUS_T3P_BASELINE !== '1' && process.env.EPIRUS_PUBLISH !== '1') {
  console.error('⛔ [train-3p] 马上要开始训练了，但产物落点没声明 ⇒ 拒跑（exit 10）。'
    + '\n   默认落点 `docs/artifacts/train-3p-out.js` 是门禁（D123/D162）逐字比对的基线文件，任何臂写它都会让**别人的门**红（§E653 实测两例）。'
    + '\n   三选一：① `EPIRUS_T3P_OUT=<路径>`（改道；仓库外的话记得同时给 `EPIRUS_BAND_DIR=<目录>`）'
    + '\n             ② `EPIRUS_T3P_BASELINE=1`（基线持有者专用，等于说"我就是要写这一份"）'
    + '\n             ③ `EPIRUS_PUBLISH=1`（发布态：写 `js/bundled-champion-3p.js`）'
    + '\n   本次 argv=' + process.argv.slice(2).join(' ') + ' ‖ EPIRUS_ARM=' + String(process.env.EPIRUS_ARM || '(no-arm)'));
  process.exit(10);
}

console.log('[train-3p] 人数=' + N + ' 代=' + GENS + ' 种群=' + POP + ' 每代局数=' + GAMES +
  ' 参数=' + P.paramCount() + (XN2W > 0 ? (' · XN混适应度 W=' + XN2W + ' 2P局=' + XN2G + '/个体 · 2P对手=' +
    XN2_OPPS.map(function (o) { return o.name; }).join('+')) : '') +
  (ANCHOR > 0 ? (' · **锚定正则 λ=' + ANCHOR + ' ‖ 锚点=' + (ANCHOR_TO === 'widest' ? '本臂迄今最宽的一粒（棘轮，随代推进）' : '热启动种子（缰绳，固定）') + '**）') : ''));

/* v1.5.189：逐代**归因**的上一格快照 ⇒ 打印"这一代里受评席自己打了 vs 教师替它打了"。
 * 为什么值得单独一条尺：`IMIT_OVERRIDE` 的注入在事件流里与原生出手不可区分（今天才发现，见门 D136），
 * 所以"示范到底学会了没有"以前**根本没有读法** —— 只能看产物（产物是示范退火之后的，看不到学习过程）。 */
let ATTR_LAST = { tagged: 0, keys: {} };   // v1.5.189：逐代归因的上一格快照（`IMIT_ON` 在上面声明，下达块要早于这里）
function attrLine() {
  if (typeof T.imitAttribution !== 'function') return '';
  const a = T.imitAttribution();
  const d = {};
  for (const k in a.keys) {
    const prev = ATTR_LAST.keys[k] || {};
    const cur = a.keys[k];
    const z = x => Number(x) || 0;   // v1.5.189：分桶字段是后加的 ⇒ 旧快照里读不到就是 0，不许变 NaN
    if (cur.imit > z(prev.imit) || cur.native > z(prev.native)) {
      d[k] = {
        imit: cur.imit - z(prev.imit), native: cur.native - z(prev.native),
        nativeSub: z(cur.nativeSub) - z(prev.nativeSub), nativeEcon: z(cur.nativeEcon) - z(prev.nativeEcon)
      };
    }
  }
  ATTR_LAST = { tagged: a.tagged, keys: JSON.parse(JSON.stringify(a.keys)) };
  /* 一行要能读完：逐个列**这只臂里教师伸过手的那几张卡**（含退火窗口之后 —— 那正是"学没学会"要看的段落），
   * 其余卡折成一个总数（27 张全列会把臂日志淹掉）。 */
  const hot = [], other = { imit: 0, native: 0 };
  for (const k in d) {
    const everImit = a.keys[k] && a.keys[k].imit > 0;
    if (d[k].imit > 0 || everImit) {
      hot.push(k + ' 原生' + d[k].native + '（补贴局 ' + d[k].nativeSub + ' · 原生经济 ' + d[k].nativeEcon + '）/注入' + d[k].imit);
    } else other.native += d[k].native;
    if (d[k].imit > 0) other.imit += d[k].imit;
  }
  hot.sort();
  const body = (hot.length ? hot.join(' · ') : '（教师这一代一次手都没伸）') +
    ' · 其余卡合计 原生' + other.native + '/注入' + other.imit;
  if (!hot.length && !other.native && !a.unmatched) return '';
  return '[归因·本代] ' + body + ' · 累计 tagged=' + a.tagged +
    (a.unmatched ? ' **unmatched=' + a.unmatched + '**（注入了却没成为事件）' : '');
}

/*（ZCode · 11-03 凌晨）E3 存段旋钮：`EPIRUS_HOLDOUT_SEG=K` ⇒ 每 K 代快照当代最优粒（默认 0=关）。
 *  快照进 SEGS（内存）→ band-save 段落落 `<ARM>-seg<k>.bak` → `scratch/holdout-promote.mjs` 固定留出复排。
 *  对策的靶 = "末代重验收埋掉中代峰"（DS E3 + 夜班 D-a band3 实锤）；只存盘不改当选。 */
const HOLDOUT_SEG = Math.max(0, Math.floor(Number(process.env.EPIRUS_HOLDOUT_SEG || 0) || 0));
const SEGS = [];
/* ===== 11-03（用户提"训练中断也要留得住节点"）：快照改成**当场落盘** =====
 * 病（实测）：`CBG-*` 三臂开了 `EPIRUS_HOLDOUT_SEG=25`、快照打到 gen 25/50/…，但 SEGS 只攒在内存、
 *   统一等 band-save 那段才写盘 ⇒ 进程在**名人堂验证**阶段被停 ⇒ 段与包一起蒸发（"没有留下数据"）。
 * 改法：每打一个快照就写 `<ARM>-seg<k>.bak`，于是任何时刻被停都已经留住"到这一代为止"的那些深度。
 *   ⚠ 存的是**每 K 代的最优粒**，不是整个种群 ⇒ 不能用来"续跑"（那要另写重启口），它答的是
 *     "训练到什么程度长成什么样"——按深度对比由 `scratch/holdout-promote.mjs` 固定留出复排做。
 * 名字/落点在此提前定义（band-save 那段原本把 `ARM`/`BAND_DIR` 关在自己的 try 块里，循环够不着）。 */
const ARM_NAME = process.env.EPIRUS_ARM || OUT_PATH.replace(/^.*[\\/]/, '').replace(/\.js$/, '');
const BAND_DIR_NAME = process.env.EPIRUS_BAND_DIR || 'docs/artifacts';   // 可指向临时目录 ⇒ 门 D116 能行为式测它而**不欠 D82 的账**
const segTextOf = function (s, k) {
  /* ⚑ `ts` 在这里是**必需的**，不是装饰：`tools/dedupe-artifacts.mjs` 定主名按"最早 META.ts"，而缺 ts 的那份
   *   会被当成 `'9999'` 排到最后 ⇒ 段档案（seg）在同权重同时存在 band 夹具时**必输主名**，于是
   *   `pack-guard` 按"真身=seg"登记的别名关系反被 D191④ 判成"未登记的重复"（11-03 夜 7 条就是这么来的）。 */
  return '/* holdout-seg ' + ARM_NAME + '-seg' + (k + 1) + '（EPIRUS_HOLDOUT_SEG=' + HOLDOUT_SEG + '，第 ' + s.gen + ' 代快照） */\n' +
    'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify({ ts: new Date().toISOString(), seg: true, segIndex: k + 1, gen: s.gen, fit: s.fit, arm: ARM_NAME, hotstartFrom: (/^[0-9a-f]{16}$/.test(hotstartFrom || '') ? hotstartFrom : undefined) }) + ';\n' +
    'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(s.params)) + ';\n';
};
const SEG_FLUSH_FAIL = [];
const flushSeg = function (s, k) {
  try {
    if (!existsSync(BAND_DIR_NAME)) mkdirSync(BAND_DIR_NAME, { recursive: true });
    writeFileSync(BAND_DIR_NAME + '/' + ARM_NAME + '-seg' + (k + 1) + '.bak', segTextOf(s, k), 'utf8');
    return true;
  } catch (e) {
    SEG_FLUSH_FAIL.push('seg' + (k + 1) + '@gen' + s.gen + '：' + e.message);
    console.log('[holdout-seg] ⚠ 第 ' + s.gen + ' 代快照落盘失败（' + e.message + '）⇒ 这份只在内存里，进程被停就丢');
    return false;
  }
};
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
     * 依据（`docs/research/logs/RESEARCH-LOG-2026-09-22-ds.md` §9/§10）：跨 N 两轴的失败机理是**遗忘** ——
     *   每阶段都牺牲上一场（练会 2P 忘 3P、找回 3P 又忘 2P），且**排练（4→16 局）也治不了**（零和）。
     * 机制可选的最小实现：向量化进化没有梯度 ⇒ "冻结"用**适应度锚定**表达：
     *   fit' = fit − λ · mean((θ−θ_seed)²)
     * 即"离种子越远，需要越高的原始分才配赢" ⇒ 直接压制漂移。λ=0（默认）⇒ 一条行为都不变。
     * 锚点 = `EPIRUS_ANCHOR_TO` 选的那一份：`seed` ⇒ 热启动种子（没热启动就自然失效，= 历史行为）；
     *   `widest` ⇒ **本臂迄今最宽的一粒**（棘轮，见上面 :546 那块；冷启动没有种子也能用）。 */
    const aRef = ANCHOR_TO === 'widest' ? (anchorRef ? anchorRef.params : null) : seedParams;
    if (ANCHOR > 0 && aRef && params.length === aRef.length) {
      let s = 0;
      for (let ai = 0; ai < params.length; ai++) { const d = params[ai] - aRef[ai]; s += d * d; }
      const ms = s / params.length;
      r = Object.assign({}, r, { anchorDist: Math.sqrt(ms), fit: r.fit - ANCHOR * ms });
    }
    if (A2_INSTALLED && A2_INSTALLED.OPT.seatL2 > 0) {
      const se = A2_INSTALLED.L.seg.find((s) => s.name === 'seatEnc');
      if (se && se.len > 0) {
        let s2 = 0;
        for (let ai = se.off; ai < se.off + se.len; ai++) s2 += params[ai] * params[ai];
        r = Object.assign({}, r, { fit: r.fit - A2_INSTALLED.OPT.seatL2 * (s2 / se.len) });
      }
    }
    return { params: params, r: r };
  });
  scored.sort(function (a, b) { return b.r.fit - a.r.fit; });
  if (scored[0].r.fit > bestFit) { bestFit = scored[0].r.fit; bestParams = scored[0].params; sigStall = 0; noProg = 0; }
  else { sigStall++; noProg++; }
  if (CARD_ABORT > 0) {
    /* 11-10 修：`r.distinct` / `spDistinct` 都受探索温度影响（MSB4 在 fitness 里读出 11 种，而 ε=0 的
     *   card-usage 只有 2 种）⇒ 早杀必须用**与终局 SEL_CARDS / card-usage 同一把尺**的 greedy 份额口径。
     *   每代只量 top-1、局数可调（默认 20；比终局 60 便宜，且是同一 `cardUsageProfile`）。 */
    const cu = cardUsageProfile(WIN, scored[0].params, { games: CARD_ABORT_GAMES, mode: 'multi' });
    const topCards = (cu && typeof cu.distinct === 'number') ? cu.distinct : null;
    if (gen % 10 === 0 || cardStreak > 0) console.log('[cardAbort] gen ' + gen + ' topCards=' + topCards + ' streak=' + cardStreak);
    if (topCards != null && topCards < CARD_MIN) cardStreak++;
    else cardStreak = 0;
    if (cardStreak >= CARD_ABORT) {
      console.error('\n⛔ **训练期用卡地板杀臂**：连续 ' + cardStreak + ' 代 top-1 的用卡数 < ' + CARD_MIN +
        '（本代 ' + topCards + '；线 ' + CARD_MIN + '）⇒ exit 13，不写产物。');
      process.exit(13);
    }
  }
  /* ===== §十二（11-01 傍晚的位置勘误）：门槛必须接在**父母抽取处**，不是名人堂准入 =====
   * 第一批（判据 §十一）把钩子接在 `addHall` 上，结果三粒产物与对照**权重逐位同**
   *   （`GATE-s7/s13/s41.js` vs `GA2R-sword-s*.js` 的 `"a":[` 摘要相同），而门槛自检明明审计了 1200 次、换粒 180 次
   *   ⇒ 因为这条 GA 里**名人堂是只写不读的旁路**（只当终局候选池），下一代的父母来自 `scored.slice(0, 3)`（下面 `elite`）。
   *   所以现在只算一次健康读、产出一个**优选次序 `gateRank`**，同时喂给"父母抽取"与"名人堂准入"；
   *   `bestFit/bestParams` 那对仍按纯 fit 走（门槛塑形搜索，不动产物记账）。 */
  let gateRank = null;
  let gateReads = null;   /* hall-trace 用：本代 top-3 的门槛读数（hall-trace 关时为 null） */
  if (GA_GATE > 0) {
    if (GA_INC === undefined) GA_INC = seedParams ? wideMetricsOf(seedParams) : null;
    if (!GA_INC) GA_STAT.noRef++;
    const reads = [];
    for (let gi = 0; gi < Math.min(3, scored.length); gi++) {
      const m = wideMetricsOf(scored[gi].params);
      /* 参照缺（无热启动）⇒ 只判种类、不判净兑现，并且**必须打印这件事**：静默退回绝对线就是"判据被换掉而输出看不出来" */
      m.wide = (m.gMulti >= GA_KINDS && m.gLong >= GA_KINDS) &&
        (GA_INC ? isWideVs(m, GA_INC) : true);
      reads.push({ gi: gi, fit: scored[gi].r.fit, m: m, wideScore: m.landMulti + m.landLong });
      GA_STAT.audits++;
    }
    GA_STAT.lastEff1 = reads.map((r) => r.m.gMulti.toFixed(1) + '/' + r.m.gLong.toFixed(1) +
      'G ‖ ' + r.m.landMulti.toFixed(2) + '/' + r.m.landLong.toFixed(2) + '兑').join('  ');
    gateReads = reads;
    /* 覆盖锚推进（11-04）：只吃这份镜局读，**一测量都不加**；宽=兑现加权的那种宽（`wideScore`，
     *   与 `GA_BAND` 带内取的东西同一把尺 ⇒ 不去奖励"只为刷种类数"的假宽，那是 v1.5.167 点名的病）。 */
    if (ANCHOR > 0 && ANCHOR_TO === 'widest') {
      let cand = null;
      for (const r of reads) if (!cand || r.wideScore > cand.wideScore) cand = r;
      if (cand && (!anchorRef || cand.wideScore > anchorRef.wideScore)) {
        anchorRef = { params: Float64Array.from(scored[cand.gi].params), wid: widOfArr(scored[cand.gi].params),
          gen: gen + 1, wideScore: cand.wideScore, g: cand.m.gMulti + '/' + cand.m.gLong };
        anchorRefMoves++;
        /* 推进就印，**不按 25 代节流**：棘轮的推进本来就稀少，节流会把"活臂"印成"冻住的锚"
         *   （11-04 CA13 实测：日志里 `[锚·最宽]` 只有 gen 1 一条，看着像 480 代零推进，
         *    而真数只能等 `meta.recipe.anchor.moves` 落盘 ⇒ 中途读日志的人会拿节流当结论）。 */
        {
          console.log('[锚·最宽] gen ' + (gen + 1) + ' 推进锚 → ' + anchorRef.wid.slice(0, 8)
            + '（G ' + anchorRef.g + ' ‖ 兑现宽 ' + anchorRef.wideScore.toFixed(2) + ' ‖ 累计移动 ' + anchorRefMoves + ' 次）');
        }
      }
    }
    let rank = reads.filter((r) => r.m.wide);
    const nWide = rank.length;
    if (GA_BAND > 0 && rank.length > 1) {
      const tf = rank[0].fit;
      const band = rank.filter((r) => r.fit >= tf - GA_BAND);
      const rest = rank.filter((r) => band.indexOf(r) < 0);
      band.sort(function (a, b) { return b.wideScore - a.wideScore; });   // 带内取"打得出血的宽"更大者（不再是出手熵）
      rank = band.concat(rest);
    }
    rank.push.apply(rank, reads.filter((r) => !r.m.wide));   // 不宽者排最后（仍可当父母，但轮不到优先）
    gateRank = rank.map((r) => r.gi);
    if (nWide) { GA_STAT.healthyGens++; GA_STAT.eff1Sum += rank[0].m.gMulti; if (gateRank[0] !== 0) GA_STAT.swapped++; }
    else GA_STAT.starvedGens++;
  }
  if (gateRank) {
    /* 准入次序跟着门槛走（与父母同一份读，不再另算一遍镜局） */
    const g0 = gateRank[0], g1 = gateRank.length > 1 ? gateRank[1] : gateRank[0];
    addHall(scored[g0].params, scored[g0].r.fit);
    addHall(scored[g1].params, scored[g1].r.fit);
  } else {
  addHall(scored[0].params, scored[0].r.fit);
  addHall(scored[1].params, scored[1].r.fit);
  }
  if (HALL_TRACE) {
    const rec = { gen: gen, bestFit: +(scored[0].r.fit.toFixed(4)),
      top3: scored.slice(0, 3).map(function (x, i) { return { gi: i, wid: widOfArr(x.params), fit: +(x.r.fit.toFixed(4)) }; }),
      hall: hall.map(function (h) { return h.wid || widOfArr(h.params); }) };
    if (gateReads) rec.gate = { kinds: GA_KINDS, rank: gateRank,
      reads: gateReads.map(function (r) { return { gi: r.gi, wid: widOfArr(scored[r.gi].params), fit: +(r.fit.toFixed(4)),
        gMulti: +r.m.gMulti.toFixed(2), gLong: +r.m.gLong.toFixed(2),
        landMulti: +r.m.landMulti.toFixed(2), landLong: +r.m.landLong.toFixed(2), wide: !!r.m.wide, wideScore: +r.wideScore.toFixed(2) }; }) };
    try { appendFileSync(HALL_TRACE_OUT, JSON.stringify(rec) + '\n'); } catch (eT3) { console.error('[hall-trace] ⛔ 写不出：' + eT3.message); }
  }
  if (gen % 20 === 0 || gen === GENS - 1) {
    const r = scored[0].r;
    const nf3 = function (v) { return v === null || v === undefined ? '未量' : v.toFixed(3); };
    console.log('gen ' + gen + ' bestFit=' + r.fit.toFixed(3) +
      ' 1st=' + (r.firstRate * 100).toFixed(0) + '% top2=' + (r.top2Rate * 100).toFixed(0) +
      '% avgDealt=' + r.avgDealt.toFixed(2) + ' sigma=' + sigma.toFixed(3) +
      (r.anchorDist !== undefined ? ' ' + (ANCHOR_TO === 'widest' ? '距锚(最宽)=' : '距种子=') + r.anchorDist.toFixed(4) : '') +
      /* v1.5.187：把"这一代最优个体打出几条连带"直接印出来（DS 交接 §2b 的验收判据是 `连带 ≥ 0.2/局`）。
       * 为什么必须挂在臂上而不是事后量产物：我实测过四档越来越有利的造局（含"全场集火同一人 + 教师永远提议大雷"），
       * **产物级链数一直是 0** ⇒ 只有逐代的读数能区分"权重没生效"与"要付钱的行为在评分局里根本没出现"。 */
      (r.chainEvents !== undefined ? ' **连带=' + r.chainEvents + ' 条/' + (r.chainPerGame || 0).toFixed(3) + '每局**' +
        /* v1.5.188（率形）：**分母必须一起印** —— 只印分子的话，"1 条 / 1 次出手"（率 1.0）与
         * "1 条 / 8 次出手"（率 0.125）在尺子上完全同形，而这正是这次换形状要分开的那两件事。 */
        ' 出手=' + (r.chainCasts || 0) + ' 率=' + (r.chainRate || 0).toFixed(3) : '') +
      /* v1.5.265（§E65）：**贵卡剂量必须逐代可见** —— 09-27 那三档 `costlyW` 之所以被读成"结构性惰性"，
       * 就是因为剂量只在 `BIGCARD_W>0` 时才累加、且从不打印 ⇒ 假零结果与"真没出手"在 stdout 上不可分。
       * 现在计数不设门槛（`evo.js:1639`），这里把分子/每局量一起印出来当**剂量表**。 */
      (r.costlyUses !== undefined ? ' 贵卡=' + r.costlyUses + '(' + (r.costlyPerGame || 0).toFixed(3) + '/局)' : '') +
      /* v1.5.272（§E83）：**整族行为剂量**（门在 `evo.js` 的 `DOSE_ON`）—— 这一族里只要有任何一根 W 被下达，
       * 引擎就把 8 个计数全算出来，这里全印：被下达的那根看剂量，没被下达的兄弟当**对照组**。
       * 整族都没下达时不印（读数会是 null=未量，绝不能印成 0 —— 0 会被读成"这粒真没做出该行为"，
       * 而那正是本条要消灭的混淆）。 */
      (r.doseOn ? ' 剂量[/局]' + ' 环打=' + nf3(r.ringBreakPerGame) + ' 压=' + nf3(r.pressPerGame) +
        ' 穿=' + nf3(r.piercePerGame) + ' 珠=' + nf3(r.beadPerGame) +
        /* v1.8.38 后续（DS §六 · 用户 10-26 裁"顺手做"）：`beadBoomPerGame` 自 v1.8.37 起在引擎侧算得出
         * 但没人打印 ⇒ "花掉的爆珠"只能事后重量。纯打印、零判据（不看不涨也不红）。
         * 未量不许印成 0：这一族若没被下达，`null` 要显式印"未量"（同 `广max` 那格的规矩）。 */
        ' 爆珠花=' + (r.beadBoomPerGame === null || r.beadBoomPerGame === undefined ? '未量' : nf3(r.beadBoomPerGame)) +
        ' 威=' + nf3(r.threatPerGame) +
        ' 场=' + nf3(r.clearPerGame) + ' 挡=' + nf3(r.blockPerGame) + ' 广max=' + (r.varietyMaxEv === null ? '未量' : r.varietyMaxEv) +
        /* v1.8.29：失效这一族 + 激光眼那一格（补 v1.8.23"只算不报"的欠账）。
         * 用户 10-23 给这条杠杆定的验收就是**次数**（"出现频率可以比大雷更低，只要有学会就行"）⇒
         * 这两格必须逐代可见，否则臂跑完只能事后重新量。 */
        ' 激光=' + nf3(r.laserPerGame) + ' 失效=' + nf3(r.voidPerGame) + ' 失效理=' + nf3(r.voidIdealPerGame)
        : ''));
  }
  /* v1.5.189：归因**逐代**印（不塞进那条 20 代的块里）—— "示范有没有转成原生行为"是随代数变化的问题，
   * 20 代一跳就把"前期靠教师、退火后归零"这条曲线糊成两个点。 */
  if (IMIT_ON) { const attr = attrLine(); if (attr) console.log('  gen ' + gen + ' ' + attr); }
  const breedRng = T.mulberry32 ? T.mulberry32(__SEED * 100003 + gen) : Math.random;
  /* 父母抽取：门槛开时按 `gateRank` 的优选次序取前三（不过线的排最后 ⇒ 仍可被抽到，但轮不到优先），
     *   ⇒ 这样门槛才真的**塑形搜索**；接在 addHall 上时三粒产物与对照逐位同（§十二 的位置勘误）。 */
  const elite = (gateRank ? gateRank.slice(0, 3) : [0, 1, 2])
    .filter(function (ix, k, arr) { return ix != null && arr.indexOf(ix) === k; })
    .map(function (ix) { return scored[ix] ? scored[ix].params : null; }).filter(Boolean);
  if (elite.length < 3) for (let ei = 0; ei < Math.min(3, scored.length) && elite.length < 3; ei++) { if (elite.indexOf(scored[ei].params) < 0) elite.push(scored[ei].params); }
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
  if (gen % 30 === 29) { next[POP - 1] = P.makePolicy(INIT_SCALE);   /* 11-04 波 H：与初始种群同一幅度来源 */ nextH[POP - 1] = 0; }
  /*（ZCode · 11-03 凌晨）E3 存段：每 HOLDOUT_SEG 代快照**当代评估最优**粒（默认 0=关 ⇒ 一行都不进）。
   *  动因（DS E3 实测 + 夜班 holdout-promote 实锤 D-a band3）：末代重验收的产物会埋掉中代峰。
   *  快照只在内存攒着，band-save 段落统一落 `<ARM>-seg<k>.bak` ⇒ holdout-promote 复排；
   *  ⚠ 只存盘不改当选，"按留出换人"由 holdout-promote 报告、转正与否晨班裁。 */
  if (HOLDOUT_SEG > 0 && (gen + 1) % HOLDOUT_SEG === 0 && scored.length) {
    const bs = scored.reduce((a, b) => (((b.r && b.r.fit) || -Infinity) > ((a.r && a.r.fit) || -Infinity) ? b : a));
    SEGS.push({ gen: gen + 1, params: Float64Array.from(bs.params), fit: bs.r ? bs.r.fit : null });
    /* 11-03：当场落盘（原来只攒内存，进程在末代之后被停 ⇒ 段全蒸发，DS 的 CBG 三臂就是这么丢的） */
    flushSeg(SEGS[SEGS.length - 1], SEGS.length - 1);
    console.log('[holdout-seg] ' + (gen + 1) + ' 代快照（fit ' + (bs.r ? bs.r.fit.toFixed(3) : '?') + '）· 累计 ' + SEGS.length
      + ' ‖ 已落 ' + BAND_DIR_NAME + '/' + ARM_NAME + '-seg' + SEGS.length + '.bak');
  }
  pop = next; hGenes = nextH;
  sigma = Math.max(SIG_FLOOR, sigma * SIG_DECAY);
  /* E2 的"成功驱动"那一半：连续 SIG_STALL 代 bestFit 没进步 ⇒ 把 σ 往回抬一档（上限 0.18 = 初值）。
   *   默认 SIG_STALL=0 ⇒ 这段永不执行，今天的形状一字不变。
   *   ⚠ 抬的是**步长**不是"随机重置"：种群已经坍缩时，只有把探索半径拉回来才有机会跳出退化盆地
   *     （这正是 `evo.js:2464` 那句注释承诺的机制，而生效的这份代码此前地板更低、衰减更快）。 */
  if (SIG_STALL > 0 && sigStall >= SIG_STALL) {
    const up = Math.min(0.18, sigma * 1.25);
    if (up > sigma + 1e-9) { sigma = up; sigBumps++; }
    sigStall = 0;
  }
  if (STALL_ABORT > 0 && noProg >= STALL_ABORT) {
    console.log('\n⛔ **臂级空转终止（GA）**：连续 ' + noProg + ' 代 bestFit 没有进步（≥ EPIRUS_STALL_ABORT=' + STALL_ABORT + '）'
      + ' ⇒ 第 ' + gen + ' 代收摊，不再把剩下的 ' + (GENS - gen - 1) + ' 代跑满（已花约 ' + ((gen + 1) * POP * GAMES * 1) + ' 局）。'
      + '产物**不写**：这一支等于什么都没练出来。');
    process.exit(13);
  }
}

/* §十一 C 的自证收尾：开档必须真审计过（`patch-must-prove-invoked` 的在册教训——覆盖式接入要自证"真被调用"）。 */
if (GA_GATE > 0) {
  if (GA_STAT.audits === 0) { console.error('⛔ --EPIRUS_GA_GATE 开着（=' + GA_GATE + '）但一次健康读都没跑 ⇒ 门槛没接电，这臂等于白跑：**不写产物**。'); process.exit(15); }
  console.log('[GA 宽门槛] 判据 = 两条在册判据的合取（不自造）：种类那条同产品门 L1 `broad`（两模式 effSkills≥' + GA_KINDS +
    '，`champion-gate.mjs` 的 `broad.pass`）‖ 净兑现那条来自池级前沿尺 `pool-frontier-lib.isWideVs`（两模式 effSkillsLand ≥ 参照−' + LAND_TOL + '）' +
    ' ‖ 旗标=' + GA_GATE + ' ⇒ 有效种类下限=' + GA_KINDS +
    (GA_GATE === 3 ? '（与产品门 broad 的种类那条齐平）' : GA_GATE < 3 ? '（旗标低于 3 已被夹回 3：**本门槛不可能比产品门更宽**）' : '（⚠ 种类那条被加严到 ' + GA_GATE + ' 种：这一臂严于产品门' + (GA_GATE >= 99 ? '，是饿退对照腿' : '') + '）') +
    ' ‖ 参照 = ' + (GA_INC ? '热启动起点（G ' + GA_INC.gMulti.toFixed(1) + '/' + GA_INC.gLong.toFixed(1) + ' ‖ 兑 ' +
      GA_INC.landMulti.toFixed(2) + '/' + GA_INC.landLong.toFixed(2) + '，同一 n=' + GA_GATE_GAMES + ' 局）' : '⚠ 无热启动参照 ⇒ 只判种类（净兑现那条没参与）') +
    ' ‖ 每代取 top-3 × 两模式 × ' + GA_GATE_GAMES + ' 局 ‖ 带内取宽 ' + (GA_BAND > 0 ? GA_BAND : '（关）') + '：' +
    '审计 ' + GA_STAT.audits + ' 次 ‖ 宽代 ' + GA_STAT.healthyGens + '/' + GENS + ' ‖ 饿退代 ' + GA_STAT.starvedGens +
    ' ‖ 换粒进席 ' + GA_STAT.swapped + ' 次' + (GA_STAT.noRef ? ' ‖ ⚠ 无参照的代 ' + GA_STAT.noRef : '') +
    ' ‖ 末代 top-3 = ' + GA_STAT.lastEff1 +
    (GA_STAT.healthyGens === 0 ? '  ⚠ 一代都不宽 ⇒ 全程饿退 = 这根等于没开（不许当"测过了"引用）' : ''));
}

const POOL = [Bots.pickRandom, Bots.pickAggro, Bots.pickDefend, Bots.pickBalanced,
              Bots.pickAntiDef, Bots.pickBreakDef, Bots.pickWall, Bots.pickMix, Bots.pickFarmer];
const ALL_PAIRS = [];
for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) ALL_PAIRS.push([POOL[a], POOL[b]]);

/* ===== §E635（v1.7.92 · 千问 10-17 晚班）：把池成员**也放上选拔桌** `EPIRUS_SEL_POOL=1`（默认关）=====
 * 病（读出来的，不是猜的）：`EPIRUS_POOL_OPPS` 只把池成员加进**训练桌** `OPPS`（上面 `pool-ops` 那一块），
 *   而终局选拔用的是这份**写死的 9 脚本两两**（36 对）⇒ 于是「训练时对着池打 ‖ 选冠军时不看池 ‖ 验收又用池桌」
 *   三段不在同一张桌上：**往训练桌上加对手，结构上管不到最后输出的是谁**（日志 §十八 18.1 的实测来源）。
 * 口径：开 ⇒ 选拔桌 = 9 脚本 + `POOL_OPPS` 的两两（K=2 时 36 → 55 对 = 脚本×脚本 36 ‖ 脚本×池 18 ‖ 池×池 1）；
 *   关 ⇒ 逐字仍是 `ALL_PAIRS` ⇒ 历史臂仍可逐位复现。
 * ⚠ 只加**池成员**，不加 `COUNTER/RING/ECON/OPP_HUMAN` 那几族塞进 `OPPS` 的对手 —— 一臂只改一维，
 *   否则"选拔桌变了"与"训练桌变了"会被混成同一次读数（这几族的表各在自己那块里，见上面 :840~:960）。
 * ⚠ 开了却 `POOL_OPPS=0` ⇒ `exit 4` 点名（一张桌也没多出来 = 空枪，与 `EPIRUS_COUNTER_OPPS` 同纪律）。
 * ⚠ 这条一旦开，`probe-pool` 那把池桌尺就**部分变成了目标函数**：它的配对差不再是独立证据，
 *   只有"把被考者从名单里摘掉再抽"那一腿还给它保着独立性（10-17 实测摘掉之后优势从 +8.9 涨到 +10.2pt，§十五）。
 *   ⇒ 开档的臂**必须**继续带那条腿跑，不然"+pt"读不出是变强还是练过考官。 */
const SEL_POOL_RAW = process.env.EPIRUS_SEL_POOL;
const SEL_POOL = (SEL_POOL_RAW === undefined || SEL_POOL_RAW === '') ? false : (function () {
  const v = Number(SEL_POOL_RAW);
  if (!Number.isInteger(v) || v < 0 || v > 1) {
    console.error('[sel-pool] ⛔ `EPIRUS_SEL_POOL` 只认 0 或 1（收到 ' + JSON.stringify(SEL_POOL_RAW) +
      '）⇒ 拒绝把它当默认关（这一格直接换选拔桌，不许静默回落）');
    process.exit(4);
  }
  return v === 1;
})();
if (SEL_POOL && POOL_OPPS.length === 0) {
  console.error('[sel-pool] ⛔ 要池席上选拔桌，但 `EPIRUS_POOL_OPPS=0` ⇒ 一张桌也没多出来（空枪）' +
    ' ⇒ 要开就 `EPIRUS_SEL_POOL=1 EPIRUS_POOL_OPPS=<k>` 一起下达');
  process.exit(4);
}
/* 10-23：`EPIRUS_SEL_COUNTER=1` 把**对抗原型**也放进选拔桌（各两份 ⇒ 允许同原型两两成对）。
 * 病：只把对抗原型放训练桌、不放选拔桌 ⇒ 当选仍按脚本/池分数挑，G4/G5 只在最后否决、全灭就保留原当选。 */
const SEL_COUNTER = process.env.EPIRUS_SEL_COUNTER === '1';
const SEL_CNT_SELS = SEL_COUNTER ? COUNTER_OPPS.reduce(function (acc, o) { return acc.concat([o.sel, o.sel]); }, []) : [];
const SEL_TABLE = (SEL_POOL ? POOL.concat(POOL_OPPS.map(function (o) { return o.sel; })) : POOL).concat(SEL_CNT_SELS);
const SEL_PAIRS = [];
for (let a = 0; a < SEL_TABLE.length; a++) for (let b = a + 1; b < SEL_TABLE.length; b++) SEL_PAIRS.push([SEL_TABLE[a], SEL_TABLE[b]]);

// 名人堂逐个用选拔桌全部对手对（`SEL_PAIRS.length` 对）× 多粒 seedBase 验证，取 `sc` 最高者作为最终冠军
let finalParams = bestParams, ev = null;
let DEGENERATE_ONLY = false;   // §N9：名人堂全退化时置真并写进 meta
console.log('=== 名人堂验证（' + SEL_PAIRS.length + ' 对 x 20 局' +
  (SEL_POOL ? ' · **选拔桌含池席 ' + POOL_OPPS.length + ' 枚**（' + POOL_OPPS.map(o => o.name).join(',') + '）'
            : (SEL_COUNTER
              /* 11-04 午后抓到的措辞谎：旧文案不分"有没有把对抗原型搬进当选面"，两类都印"出厂那张桌：9 个脚本两两"
               *   ⇒ 开着 `SEL_COUNTER` 的臂明明数是 55 对（11 席两两），却被那句说成"跑的是出厂桌"。
               *   只改可见性：`SEL_TABLE` / `SEL_PAIRS` 的构造一字未动（席数现在照实印）。 */
              ? ' · **选拔桌含对抗原型 ' + COUNTER_OPPS.map(function (o) { return o.name; }).join(',') + ' 各两份**（桌共 ' + SEL_TABLE.length + ' 席两两）'
              : ' · 出厂那张桌：' + SEL_TABLE.length + ' 席两两')) + '）===');
if (HALL_DEDUP) console.log('[hall-dedup] 进榜拒收同一粒权重 ' + hallDupDropped + ' 次 ⇒ 榜 ' + hall.length + ' 席' +
  '（开档必印：0 次也要印，否则"没遇到重复"与"没生效"在日志上同形）');
/* ===== §N9（qoder 09-22 · xn10b 反例）：当选面退化闸 =====
 * 收割/存活混合梯度能把"纯ジ龟包"推成带内最高 trainFit（奖励的反向捷径），
 * 而本工具的终局当选**过去没有任何退化检查** ⇒ 三处（promote 阻断 / 2P vetoDegenerate / 这里）必须同判据。
 * 口径抄 promote：`densityProfile.zeroAtkRate ≥ 0.9` = 退化（从不出手的局占比）。
 * 全退化时：不静默——产物照写但 meta.degenerateOnlyWinner=true + ⛔ 响亮（下一道 promote 本来也会砍它）。 */
const hallEntries = [];
/* §E322（v1.6.7）：当选键**不再只吃一粒 seedBase**。默认 4 粒取均值（`EPIRUS_SEL_EVAL_SEEDS=1` 逐字回到旧行为）。
 * 病与量的证据在 `pick-best.mjs` 的 §E322 头注里（单枚换种子摆 5.4~9.1pt，而同分带只有 3.0pt）。 */
const SEL = parseSelSeeds(process.env.EPIRUS_SEL_EVAL_SEEDS);
if (SEL.bad) console.warn('[当选键] ⚠ EPIRUS_SEL_EVAL_SEEDS=' + SEL.bad + ' 不是 1..8 的整数 ⇒ 回落 ' + SEL.k + ' 粒（不静默：这一格直接改当选结果）');
const SEL_BASES = selBases(SEL.k);
console.log('[当选键] 每粒候选重验 ' + SEL.k + ' 粒 seedBase（' + SEL_BASES.join(' ‖ ') + '）取均值 ‖ 来源=' + SEL.from);
for (const h of hall) {
  const runs = SEL_BASES.map(function (b) { return T.evalN(h.params, SEL_PAIRS, 20, N, b); });
  const v = scoreRuns(runs);
  const sc = v.sc;
  const zr = densityProfile(sb, h.params, 'multi', 12).zeroAtkRate;
  console.log('  trainFit=' + (typeof h.fit === 'number' ? h.fit.toFixed(3) : '起点') + ' -> 1st=' + (v.firstRate * 100).toFixed(1) +
    '% top2=' + (v.top2Rate * 100).toFixed(1) + '% 零攻击局=' + (zr * 100).toFixed(0) + '% ' + selNote(v));
  hallEntries.push({ ref: h, score: sc, zeroAtkRate: zr, ev: v, runs: runs });
  if (!ev || sc > ev.sc) { finalParams = h.params; ev = v; }
}
{
  /* v1.7.104（用户 10-18：「做两段式」）：先跑 `SEL.k` 粒；**只有**第 1 与第 2 名的分差落进同分带（= 判不动）时，
   *   才把 k 追加到 8 粒重验一次 —— 于是在"大多数轮次分差够大"的情况下只付 k 粒的钱。
   *   同分带按 k 查表（`bandFor`，k=4 ⇒ 5.8pt），不是旧常数 3.0。
   *   默认**关**（`EPIRUS_SEL_TWO_STAGE=1` 才开）⇒ 不设时与旧行为逐字相同。 */
  /* v1.7.105（用户 10-18：「两段式默认开」）：**默认开**，`EPIRUS_SEL_TWO_STAGE=0` 才关。 */
  if (process.env.EPIRUS_SEL_TWO_STAGE !== '0' && hallEntries.length >= 2) {
    const srt = hallEntries.slice().sort(function (a, b) { return b.score - a.score; });
    const gapPt = (srt[0].score - srt[1].score) * 100;
    const band = bandFor(SEL.k);
    if (gapPt <= band) {
      const k2 = Math.min(8, Math.max(SEL.k + 2, 8));
      const extra = selBases(k2).slice(SEL.k);
      console.log('[当选键] 两段式：第 1↔2 名分差 ' + gapPt.toFixed(2) + 'pt ≤ 同分带 ' + band.toFixed(1) + 'pt ⇒ 追加 ' + extra.length + ' 粒（k ' + SEL.k + '→' + k2 + '）后再选');
      for (const e of hallEntries) {
        for (const b of extra) e.runs.push(T.evalN(e.ref.params, SEL_PAIRS, 20, N, b));
        e.ev = scoreRuns(e.runs); e.score = e.ev.sc;
      }
      console.log('[当选键] 两段式之后：' + selGapNote(hallEntries));
    } else {
      console.log('[当选键] 两段式：第 1↔2 名分差 ' + gapPt.toFixed(2) + 'pt > 同分带 ' + band.toFixed(1) + 'pt ⇒ **判得动，不追加**（只付 ' + SEL.k + ' 粒）');
    }
  }
  console.log(selGapNote(hallEntries));
  const sel = rejectDegenerateWinners(hallEntries);
  if (sel.dropped) console.log('[退化闸] 剔除 ' + sel.dropped + ' 粒零攻击≥90% 的名人堂成员（与 promote/2P 同判据）');
  /* v1.5.170（§N29）：两把"兑现"口径的闸共用一次 `mirrorHealth`（同一量具测两遍 = 白跑一遍）。
   * 未开任何一个开关 ⇒ 这段一行都不跑 ⇒ 与 v1.5.166 之前的行为逐字相同。 */
  if ((BREADTH_FLOOR > 0 || SEL_LAND > 0) && sel.clean && sel.clean.length) {
    for (const e of sel.clean) {
      const mh = T.mirrorHealth(e.ref.params, SEL_LAND_GAMES, N, 'multi');
      e.mhByMode = { multi: mh };
      e.landG = mh.effSkillsLand || 0; e.landedKeys = mh.landedKeys || 0; e.castG = mh.effSkills || 0;
      e.landByKey = mh.landByKey || {}; e.mhGames = SEL_LAND_GAMES;
      e.castByKey = mh.castByKey || {};
      e.seatSpread = (mh.seatSpread === undefined ? null : mh.seatSpread);
      const __ls = landShareOf(sb, mh);
      e.maxLandShare = __ls.share; e.maxLandKey = __ls.key;
      e.conv = (mh.nonJi ? (mh.landedTotal || 0) / mh.nonJi : 0);
      e.gateOk = (mh.holoOtherPerGame || 0) <= HOLO_GIFT_MAX;
    }
  }
  /* ===== v1.5.170（§N29）：广度**准入线**（默认关）——把"塌成一种卡"当不合格，而不是当排序键 =====
   * 依据（§N28 实测）：两对种子 4 粒冠军里有 3 粒净兑现只剩 1 种卡（`1.00（1 种）`）⇒ 塌缩是常态不是意外；
   * 而 §N25 已证明"广度当排序键"要么咬不动（带里只剩 1 粒）要么咬错（换上来的是过不了硬门槛的包）。 */
  if (BREADTH_FLOOR > 0 && sel.clean && sel.clean.length) {
    const nf = rejectNarrowWinners(sel.clean, BREADTH_FLOOR);
    console.log('[广度线] 判据 = 净 `G(落地) ≥ ' + BREADTH_FLOOR + '` 且 **最大单卡落地份额 ≤ ' + (nf.collapseLine * 100).toFixed(0) + '%**（v1.5.227 起；旧判据是 `landedKeys ≥ 2`，实测从不触发）· n=' + SEL_LAND_GAMES + ' 局 multi 镜 · 各粒：' +
      sel.clean.slice().sort(function (a, b) { return b.landG - a.landG; })
        .map(function (e) { return e.landG.toFixed(2) + '(' + e.landedKeys + '种,最大' + (100 * (e.maxLandShare || 0)).toFixed(0) + '%' + (e.maxLandKey ? '-' + e.maxLandKey : '') + ',兑现' + (100 * e.conv).toFixed(0) + '%)'; }).join('  '));
    console.log('[广度线] 剔除 ' + nf.dropped + '/' + sel.clean.length + ' 粒塌缩候选' + (nf.shareMissing ? '（⚠️ ' + nf.shareMissing + ' 粒没带份额字段 ⇒ 走了旧子句）' : '') +
      (nf.best ? ' ⇒ 池内冠军 ' + (nf.best.score === sel.best.score ? '**没换人**' : '**换成 ' + nf.best.landG.toFixed(2) + '(' + nf.best.landedKeys + '种,最大' + (100 * (nf.best.maxLandShare || 0)).toFixed(0) + '%' + (nf.best.maxLandKey ? '-' + nf.best.maxLandKey : '') + ')**') : ''));
    if (nf.allRejected) {
      BREADTH_ALL_NARROW = true;
      console.error('⛔ [广度线] 名人堂**全部塌缩**（没有一粒 `最大单卡落地份额 ≤ ' + (nf.collapseLine * 100).toFixed(0) + '% 且 G(落地)≥' + BREADTH_FLOOR + '`）⇒ 产物照写但标 breadthFloorAllNarrow；这按预注册是**走向②**（该回去改奖励面，不是继续加排序键），别拿这粒去换包');
    } else { sel.clean = nf.clean; if (nf.best) sel.best = nf.best; }
    BREADTH_LOG = { floor: BREADTH_FLOOR, games: SEL_LAND_GAMES, dropped: nf.dropped, of: sel.clean.length + nf.dropped,
      allNarrow: nf.allRejected, winnerLandG: sel.best ? sel.best.landG : null, winnerKeys: sel.best ? sel.best.landedKeys : null };
  }
  /* ===== §E787：场B 清场地板（当选 veto）—— 位置在载重 veto **之后**、兑现广度**之前** =====
   * 顺序要说清：载重 veto 问"这粒还打不打那张关键卡"，这根问"它打不打得死人"。两根都过才进排序。
   * 三条纪律照 `SEL_KEEP`：① **空转要响亮**（地板一格都没咬到 ⇒ 明说"这根等于没开"，不许读成"筛过了"）；
   *   ② 必须印**逐粒读数 + 改没改判 + 胜负分差**（排序键不咬 = 没接线，§N12）；
   *   ③ 生效值与账写进 `meta.recipe.selClear`（关档 ⇒ null，一行都不跑，与历史臂逐字相同）。 */
  if (SEL_CLEAR > 0 && sel.clean && sel.clean.length) {
    const cacheC = new Map();
    const clearOf = function (p) {
      let v = cacheC.get(p);
      if (!v) {
        const byMode = {};
        for (const md of ['multi', 'long']) byMode[md] = Number(aggressionProfile(WIN, p, SEL_CLEAR_GAMES, { mode: md }).fieldB.clearedPerGame);
        v = { byMode: byMode, worst: Math.min(byMode.multi, byMode.long) };
        cacheC.set(p, v);
      }
      return v;
    };
    const rows = [], kept = [], dropped = [];
    for (const e of sel.clean) {
      const c = clearOf(e.ref.params);
      rows.push(e);
      (c.worst >= SEL_CLEAR ? kept : dropped).push({ e: e, c: c });
    }
    console.log('[清场地板] 口径 = 官方 `aggressionProfile` 的 `fieldB.clearedPerGame`（场B = calm 桌，与门禁同源）· ' +
      SEL_CLEAR_GAMES + ' 局/桌 · 两桌取严 ｜ 线 ≥' + SEL_CLEAR.toFixed(2) + '/局');
    console.log('[清场地板] 候选 ' + sel.clean.length + ' 粒逐粒（multi ‖ long ⇒ 取严）：' +
      rows.map(function (e) { const c = clearOf(e.ref.params);
        return c.byMode.multi.toFixed(2) + '‖' + c.byMode.long.toFixed(2) + '⇒' + c.worst.toFixed(2) + (e === sel.best ? '(当选)' : ''); }).join('  '));
    SEL_CLEAR_LOG = { line: SEL_CLEAR, games: SEL_CLEAR_GAMES, cal: 'aggressionProfile.fieldB.clearedPerGame', modes: ['multi', 'long'], rule: 'worst-of-two',
      of: sel.clean.length, dropped: dropped.length,
      readings: rows.map(function (e) { const c = clearOf(e.ref.params); return { score: Number(e.score.toFixed(4)), multi: Number(c.byMode.multi.toFixed(3)), long: Number(c.byMode.long.toFixed(3)), worst: Number(c.worst.toFixed(3)) }; }),
      allRejected: false, changedWinner: false, bitNothing: false };
    if (!kept.length) {
      SEL_CLEAR_LOG.allRejected = true;
      console.error('[清场地板] ⛔ 名人堂**全部**低于线 ' + SEL_CLEAR.toFixed(2) + ' ⇒ 产物照写并标 selClearAllDropped；' +
        '按 §E786 的预注册这**不是**"地板没用"，而是"这一支里没粒能收场" ⇒ 别拿这粒去换包，去看下面那条改判/未改判行');
    } else {
      if (!dropped.length) {
        SEL_CLEAR_LOG.bitNothing = true;
        console.log('[清场地板] ⚠ 线 ' + SEL_CLEAR.toFixed(2) + ' **一格都没咬到**（' + kept.length + '/' + kept.length + ' 粒本来就达标）' +
          '⇒ 这根在本臂等于没开，不许读成"筛过了"（要它咬东西就把线抬到读数之上）');
      }
      let best = kept[0].e;
      for (const k of kept) if (k.e.score > best.score) best = k.e;
      SEL_CLEAR_LOG.changedWinner = best !== sel.best;
      const cb = clearOf(best.ref.params);
      console.log('[清场地板] 剔 ' + dropped.length + '/' + sel.clean.length + ' 粒（被剔读数：' +
        dropped.map(function (d) { return d.c.worst.toFixed(2); }).join('/') + '）' +
        (SEL_CLEAR_LOG.changedWinner ? ' ⇒ **改判**：换成清场 ' + cb.worst.toFixed(2) + '（multi ' + cb.byMode.multi.toFixed(2) +
          ' ‖ long ' + cb.byMode.long.toFixed(2) + '）的粒，胜负分差 ' + ((best.score - sel.best.score) * 100).toFixed(1) + 'pt' +
          '（veto 换人本来就是拿胜负分换能力）' : ' ⇒ 未改判（原当选者本来就达标，清场 ' + cb.worst.toFixed(2) + '）'));
      sel.clean = kept.map(function (k) { return k.e; }); sel.best = best;
    }
  }
  /* ===== 11-09 P2：用卡数地板（当选 veto）—— 位置在清场地板**之后**、兑现广度**之前** =====
   * 三条纪律照 `SEL_CLEAR`：① **空转要响亮**（一格没咬到 ⇒ 明说"这根等于没开"）；② 逐粒读数 + 改没改判 + 胜负分差；
   * ③ 生效值与账写进 `meta.recipe.selCards`（关档 ⇒ null，一行都不跑，与历史臂逐字相同）。
   * 主语 = **只筛新候选**：这根住在当选面，不回筛现役池（用户 11-09 裁）。 */
  if (SEL_CARDS > 0 && sel.clean && sel.clean.length) {
    const cacheK = new Map();
    const cardsOf = function (p) {
      let v = cacheK.get(p);
      if (!v) {
        /* 单一来源 = `audit-lib.cardUsageProfile`（`tools/card-usage.mjs` 的循环搬进 lib）⇒ 与 POOL-CONTRACT v2.1 的
         * 基准**同一个种子序列**。11-09 实测：原来想复用 `fieldProfile` 的逐表数卡，同一枚 KD-G2 读出 8 张而
         * card-usage 在册 9 张，差的就是压在 ≥0.5% 线上的 `bigT 0.51%` ⇒ 两把尺做不了一个地板。 */
        const u = cardUsageProfile(WIN, p, { games: SEL_CARDS_GAMES, mode: 'multi' });
        v = { n: u.distinct, keys: u.keys, acts: u.acts, borderline: u.borderline };
        cacheK.set(p, v);
      }
      return v;
    };
    const kept = [], dropped = [];
    for (const e of sel.clean) (cardsOf(e.ref.params).n >= SEL_CARDS ? kept : dropped).push({ e: e, c: cardsOf(e.ref.params) });
    console.log('[用卡地板] 口径 = `audit-lib.cardUsageProfile`（镜像 5 席 · ε=0 · temp 0.15 · multi · ' + SEL_CARDS_GAMES +
      ' 局 · 种子 70000+g · 份额 ≥0.5% **含 ジ**）＝ 与 `tools/card-usage.mjs` **同一把尺** ⇒ 线值可直接对 POOL-CONTRACT v2.1' +
      '｜ 线 ≥' + SEL_CARDS + ' 张 ‖ 候选 ' + sel.clean.length + ' 粒逐粒：' +
      sel.clean.map(function (e) { return cardsOf(e.ref.params).n + '张' + (e === sel.best ? '(当选)' : ''); }).join(' '));
    /* 压线卡自报：11-09 实测 KD-G2 的第 9 张是 `bigT 0.51%`，正好贴在阈值上 ⇒ 张数会随抽样翻。
     * 这根地板咬在压线卡上时**不许**当稳定判据引用：要稳就抬 EPIRUS_SEL_CARDS_GAMES，或把线挪开那一张。 */
    const bl = [];
    for (const kk of kept.concat(dropped)) { const c = cardsOf(kk.e.ref.params); if (c.borderline.length) bl.push(c.borderline.join(',')); }
    if (bl.length) {
      console.log('[用卡地板] ⚠ 有 ' + bl.length + ' 粒的张数由**压在 0.5% 线上的卡**决定（' + bl.join(' ‖ ') +
        '）⇒ 这一维落在噪声边缘，改判与否可能只取决于那张卡');
    }
    SEL_CARDS_LOG = { line: SEL_CARDS, games: SEL_CARDS_GAMES, cal: 'cardUsageProfile(mirror5,eps=0,multi,share>=0.5%,incl-ji)＝card-usage 同尺',
      of: sel.clean.length, dropped: dropped.length,
      readings: sel.clean.map(function (e) { return { score: Number(e.score.toFixed(4)), cards: cardsOf(e.ref.params).n, incumbent: e === sel.best }; }),
      allRejected: false, bitNothing: false, changedWinner: false };
    if (!kept.length) {
      SEL_CARDS_LOG.allRejected = true;
      console.error('[用卡地板] ⛔ 名人堂**全部**低于线 ' + SEL_CARDS + ' 张 ⇒ 产物照写并标 selCardsAllDropped；' +
        '这按预注册是"这一支里没有宽粒"，**不是**"地板没用" ⇒ 别拿这粒去换包，回去看起点/谱系');
    } else {
      if (!dropped.length) {
        SEL_CARDS_LOG.bitNothing = true;
        console.log('[用卡地板] ⚠ 线 ' + SEL_CARDS + ' **一格都没咬到**（' + kept.length + '/' + kept.length +
          ' 粒本来就达标）⇒ 这根在本臂等于没开，不许读成"筛过了"（要它咬东西就把线抬到读数之上）');
      }
      let best = kept[0].e;
      for (const k of kept) if (k.e.score > best.score) best = k.e;
      SEL_CARDS_LOG.changedWinner = best !== sel.best;
      const cb = cardsOf(best.ref.params);
      console.log('[用卡地板] 剔 ' + dropped.length + '/' + sel.clean.length + ' 粒（被剔张数：' +
        dropped.map(function (d) { return d.c.n; }).join('/') + '）' +
        (SEL_CARDS_LOG.changedWinner ? ' ⇒ **改判**：换成 ' + cb.n + ' 张（' + cb.keys.join(' ') + '）的粒，胜负分差 ' +
          ((best.score - sel.best.score) * 100).toFixed(1) + 'pt（veto 换人本来就是拿胜负分换能力）'
          : ' ⇒ 未改判（原当选者本来就达标，' + cb.n + ' 张）'));
      sel.clean = kept.map(function (k) { return k.e; }); sel.best = best;
    }
  }
  /* v1.5.167（§N24）：兑现广度参与当选（默认关）。量具 = `mirrorHealth.effSkillsLand`（同一套熵，把"出手次数"换成"落地次数"）；
   * 必须打印「换没换人」(`tieBrokenBy`)——排序键不咬就等于没接线（§N12 的教训：判作用点，不判有没有配置）。 */
  if (SEL_LAND > 0 && sel.clean && sel.clean.length) {
    const lp = bandPickByLand(sel.clean, SEL_LAND_TOL);
    console.log('[兑现广度] n=' + SEL_LAND_GAMES + ' 局 · 同分带 ' + lp.band.length + '/' + sel.clean.length + '（先剔送盾等硬门槛不过 ' + (lp.skipped || 0) + ' 粒）' +
      '（tol=' + SEL_LAND_TOL + '）· 各粒 G(出手→落地)：' +
      sel.clean.slice().sort(function (a, b) { return b.landG - a.landG; })
        .map(function (e) { return e.castG.toFixed(2) + '→' + e.landG.toFixed(2) + '(' + e.landedKeys + '种)'; }).join('  '));
    if (lp.best) {
      /* 归因要说全：L1b 实测暴露——"未改判"只说了带内没换人，**预筛换掉了池**（6 粒里剔了 4 粒），
       * 结果照样换包 ⇒ 只报"带内没改判"会让读数人以为这臂与不开开关逐字相同。三格分开报。 */
      const poolChanged = !!(sel.best && lp.best && sel.best !== lp.best);
      if (lp.tieBrokenBy === 'land' && poolChanged) {
        console.log('[兑现广度] **改判（排序键换人）**：' + sel.best.landG.toFixed(2) + ' → ' + lp.best.landG.toFixed(2) +
          '（胜负分差 ' + ((lp.best.score - sel.best.score) * 100).toFixed(1) + 'pt，在带内 ⇒ 用一点胜负分换兑现广度）');
      } else if (lp.skipped > 0 && poolChanged) {
        console.log('[兑现广度] **改判（是预筛选掉的，不是排序键）**：剔 ' + lp.skipped + ' 粒过硬门槛不过的 ⇒ 池变小后冠军从 ' +
          sel.best.landG.toFixed(2) + '(' + (sel.best.castG || 0).toFixed(2) + ' 出手) 变成 ' + lp.best.landG.toFixed(2) +
          '(' + (lp.best.castG || 0).toFixed(2) + ' 出手)');
      } else console.log('[兑现广度] 未改判（池与排序键都没换人）');
      sel.best = lp.best;
    }
    SEL_LAND_LOG = { tol: SEL_LAND_TOL, band: lp.band.length, by: lp.tieBrokenBy,
      landG: sel.best ? sel.best.landG : null, castG: sel.best ? sel.best.castG : null };
  }
  /* ===== v1.5.326（§E249 · 默认关 ⇒ 这一段一行都不跑）：**同分带内按贵卡出手选人** =====
   * 与 `SEL_LAND`（同分带内按兑现广度）**同形**，只是排序键换成"这张贵卡打没打过"。
   * ⚠️ 用量**只在带内量**（不是全池）：预筛已经用硬门槛剔过退化粒，带内通常 2~4 粒 ⇒ 每臂多花 2~4 次 × n 局，可接受。 */
  if (SEL_BIGT > 0 && sel.clean && sel.clean.length && sel.best) {
    const RulesB = sb.window.EpirusRules;
    const badK = SEL_BIGT_KEYS.filter(function (k) { return !(RulesB.byKey && RulesB.byKey[k]); });
    if (badK.length) {
      console.error('[贵卡选人] ⛔ EPIRUS_SEL_BIGT_KEYS 里有不认识的卡名：' + badK.join(',') +
        '（合法的是 `EpirusRules.byKey` 的键）⇒ 拒绝按"判不到的维"选人');
      process.exit(7);
    }
    if (typeof fieldProfile !== 'function') {
      console.error('[贵卡选人] ⛔ 量具 `fieldProfile` 没接进来 ⇒ 拒绝静默空转');
      process.exit(7);
    }
    const useOf = function (e) {
      if (e.bigtUse === undefined) {
        const t = fieldProfile(e.ref.params, 0, 'soft', SEL_BIGT_GAMES, 77000, 'self', SEL_BIGT_MODE);
        e.bigtUseBy = SEL_BIGT_KEYS.map(function (k) {
          return k + ' ' + (((t.keys && t.keys[k]) || 0) / SEL_BIGT_GAMES).toFixed(2);
        }).join('/');
        e.bigtUse = SEL_BIGT_KEYS.reduce(function (s, k) {
          return s + ((t.keys && t.keys[k]) || 0) / SEL_BIGT_GAMES;
        }, 0);
      }
      return e.bigtUse;
    };
    /* 排序键的算术在 `pick-best.mjs:bandPickByUsage`（纯函数 ⇒ 门能喂合成表直接钉它，见 D221 的夹具）。
     * ⚠ `sel.best` 正常就在带内（它分数最高），但**不保证**（`SEL_KEEP` 全剔那一支会留下"best 不在 clean 里"的形状）
     *   ⇒ 先把它单独量一遍，否则下面读 `.__usage` 会 `undefined.toFixed` 当场崩（崩在选完人之后 = 白跑一整臂）。 */
    useOf(sel.best);
    const bp = bandPickByUsage(sel.clean, SEL_BIGT, useOf);
    const band = bp.band, pick = bp.best;
    const ladder = band.map(function (e) {
      return e.bigtUseBy + '（胜负分 ' + (e.score * 100).toFixed(1) + (e === sel.best ? '·当选' : '') + '）';
    }).join(' ‖ ');
    SEL_BIGT_LOG = { tol: SEL_BIGT, keys: SEL_BIGT_KEYS, mode: SEL_BIGT_MODE, games: SEL_BIGT_GAMES,
      band: band.length, of: sel.clean.length, usage: band.map(function (e) { return Number(e.bigtUse.toFixed(3)); }),
      /* `picked` / `wasWinner` 是给门用的：**排序键到底咬没咬到**（"取带内用量最高"这句必须能在产物账里被查一遍）*/
      picked: Number(pick.bigtUse.toFixed(3)), wasWinner: Number(sel.best.bigtUse.toFixed(3)),
      by: bp.tieBrokenBy, changedWinner: pick !== sel.best, zeroDose: bp.zeroDose };
    if (SEL_BIGT_LOG.zeroDose) {
      console.log('[贵卡选人] tol=' + SEL_BIGT + 'pt · 带内 ' + band.length + '/' + sel.clean.length + ' 粒 ⇒ ' +
        '**带内一张贵卡都没打过**（' + ladder + '）⇒ 不改判；这一臂按预注册算「这根旋钮**零作用**」，' +
        '不算"测过且无效"（§N12：判作用点，不判配置）');
    } else if (pick !== sel.best) {
      console.log('[贵卡选人] tol=' + SEL_BIGT + 'pt · 带内 ' + band.length + '/' + sel.clean.length + ' · 用量梯：' + ladder +
        '\n[贵卡选人] **改判（排序键换人）**：拿 ' + ((sel.best.score - pick.score) * 100).toFixed(1) +
        'pt 胜负分换「贵卡出手 ' + pick.bigtUseBy + '」（原当选者 ' + sel.best.bigtUseBy + '）');
      sel.best = pick;
    } else {
      console.log('[贵卡选人] tol=' + SEL_BIGT + 'pt · 带内 ' + band.length + '/' + sel.clean.length + ' · 用量梯：' + ladder +
        ' ⇒ **未改判**（原当选者本来就是带内用量最高的）');
    }
  }
  /* ===== §E650（千问 · 默认关）：送盾 veto ⇒ 超线的不许当选 =====
   * 单独量一次 `holoOtherPerGame`（长度可由 `EPIRUS_SEL_GIFT_VETO_GAMES` 指，默认沿用 `SEL_LAND_GAMES=20`）而**不复用 :1624 那个 gateOk**，
   *   理由是 §E649 实测：20 局的读数在贴着 6 的那批包上会随长度翻判定（`v7tgt2-52` 20 局 6.15 / 100 局 4.94）
   *   ⇒ 这一闸的判定必须与它自己报出的那个数同一批局，不能"用的是 20 局的旧 gateOk、报的是另一个长度"。
   * 只喂**浅拷贝**给纯函数（`{ref, score, gateOk, giftPerGame}`），不改 `sel.clean` 里那些对象——`bandPickByLand` 还要按它原来的 gateOk 走。 */
  if (SEL_GIFT_VETO > 0 && sel.clean && sel.clean.length) {
    const giftCache = new Map();
    const giftOf = function (params) {
      let v = giftCache.get(params);
      if (v === undefined) {
        const mh = T.mirrorHealth(params, SEL_GIFT_VETO_GAMES, N, 'multi');
        v = Number(mh && mh.holoOtherPerGame);
        if (!isFinite(v)) { console.error('⛔ [送盾闸] `mirrorHealth` 没读出 `holoOtherPerGame` ⇒ 不许当 0 放行'); process.exit(7); }
        giftCache.set(params, v);
      }
      return v;
    };
    const view = sel.clean.map(function (e, i) {
      const g = giftOf(e.ref.params);
      /* 名人堂的 `ref` 只有 `params/fit(/wid)` ⇒ 没 id 时退回"榜内第几席"，**不许打成 '?' 让人以为丢了数据** */
      return Object.assign({}, e, { id: e.ref.id || (e.ref.wid ? String(e.ref.wid).slice(0, 8) : ('榜内#' + (i + 1))), giftPerGame: g, gateOk: g <= HOLO_GIFT_MAX });
    });
    const gv = rejectGiftSpamWinners(view);
    const who = gv.droppedList.map(function (d) { return d.id + ' ' + (d.gift === null ? '?' : d.gift.toFixed(2)) + '/局'; }).join(' ‖ ');
    const widOf = function (e) { return e.id || (e.ref && e.ref.id) || (e.ref && e.ref.wid ? String(e.ref.wid).slice(0, 8) : '未名'); };
    const tail = gv.best
      ? (gv.best.ref.params === (sel.best && sel.best.ref.params)
        ? ' ⇒ 池内冠军**没换人**'
        : ' ⇒ 池内冠军**换成 ' + widOf(gv.best) + '（送盾 ' + gv.best.giftPerGame.toFixed(2) + '/局）**')
      : '';
    console.log('[送盾闸] 判据 = 裸包 `holoOtherPerGame > ' + HOLO_GIFT_MAX + '`（单源 `audit-lib.HOLO_GIFT_MAX`）· 量具 ' + SEL_GIFT_VETO_GAMES + ' 局 multi 镜'
      + ' ‖ 剔 ' + gv.dropped + '/' + view.length + (who ? '：' + who : '') + tail);
    GIFT_VETO_LOG = { line: HOLO_GIFT_MAX, games: SEL_GIFT_VETO_GAMES, dropped: gv.dropped, of: view.length,
      droppedList: gv.droppedList, allSpam: gv.allRejected,
      winnerGift: gv.best ? Number(gv.best.giftPerGame.toFixed(2)) : null, changedWinner: !!(gv.best && sel.best && gv.best.ref.params !== sel.best.ref.params) };
    if (gv.allRejected) {
      GIFT_VETO_ALL_SPAM = true;
      console.error('⛔ [送盾闸] 名人堂**全部超线**（' + view.length + ' 粒没有一粒 ≤' + HOLO_GIFT_MAX + '/局）⇒ 产物照写但标 giftVetoAllSpam；'
        + '这按预注册算"线画太紧或该回奖励面"，**不许静默退回不过滤**');
    } else {
      /* 把当选者换到 veto 后的第一名：按 `ref.params` 找回**原对象**（不拿浅拷贝去写 finalParams） */
      const keep = new Set(gv.clean.map(function (e) { return e.ref.params; }));
      sel.clean = sel.clean.filter(function (e) { return keep.has(e.ref.params); });
      const nb = gv.best ? sel.clean.find(function (e) { return e.ref.params === gv.best.ref.params; }) : null;
      if (nb) sel.best = nb;
    }
  }
  /* ===== 11-09 P1（用户裁「容差带内排序键 + n≥30 才算数 + 只筛新候选」）：当选面**白防率**排序键 =====
   * 与 `SEL_DEF` 的刻意分工：那根问"防得够不够多"（下限，越多越好），这根问"防得对不对时机"（白防率低者优）。
   *   在册证据：把占比推上去只会放大白防（11-09 实机：实验室 24% → 实机 49%，同时白防率 89%）。
   * 位置在 `SEL_DEF` **之后**、`SEL_GRID` **之前** ⇒ `SEL_GRID` 仍保有它在册的"最后发言权"。
   * 读数走 `measureDefenseQuality`（攒钱者装配，与 promote 那条防御质量栏同一把尺；11-09 交叉核 874/82/19/773 逐位相同）。
   *   ⚠ 装配是 4 席同包 ⇒ 决策相关 ⇒ 本读数只配**相对排序**，不配当绝对合格线（绝对口径另量：
   *   `scratch/qoder-1109-defq-caliber.mjs` 用页面 8 席装配，分母够的 6 枚 = 65.9%~85.1%，与这把转移差约 3pt）。
   * 手数门：`def < SEL_DEFQ_MINHANDS` ⇒ 喂哨兵值，**不参与竞争**（不判过也不判不过）；全体都不够 ⇒
   *   明说"这根零作用（selDefqNoSample）"，不许读成"测过且无效"。带仍按**全体闸后候选**的最高重验分算，
   *   不是按"有读数的那几粒"算 ⇒ 否则容差带会随样本可得性伸缩（同 §E679 那类主语漂移）。 */
  if (SEL_DEFQ > 0 && sel.best) {
    const NOSENTRY = -1e9;
    const defqOf = function (e) {
      if (e.__defq === undefined) {
        const m = measureDefenseQuality(WIN, e.ref.params, { games: SEL_DEFQ_GAMES, mode: SEL_DEFQ_MODE, eps: SEL_DEFQ_EPS, minHands: SEL_DEFQ_MINHANDS, minShare: SEL_DEFQ_MINSHARE });
        if (m.err) { console.error('[白防选人] ⛔ 量具读不出：' + m.err + ' ⇒ 拒跑（不许静默当成"没防过"或"防得准"）'); process.exit(7); }
        e.__defq = m;
        e.__defqBy = '白防 ' + (m.measurable ? m.whitePct.toFixed(1) + '%' : '没量到(n=' + m.n + '<' + m.minHands + '手' + (SEL_DEFQ_MINSHARE > 0 ? ' 或占比 ' + (100 * m.share).toFixed(1) + '%<' + (100 * SEL_DEFQ_MINSHARE).toFixed(0) + '%' : '') + ')') +
          ' ‖ 防御 ' + m.def + ' 手 · 质量 ' + (isFinite(m.q) ? (100 * m.q).toFixed(1) + '%' : '—') +
          ' ‖ placebo 倍差 ' + (isFinite(m.placeboRatio) ? m.placeboRatio.toFixed(2) + '×' : '—');
      }
      return e.__defq;
    };
    const keyOf = function (e) { const m = defqOf(e); return m.measurable ? -m.whitePct : NOSENTRY; };
    defqOf(sel.best);   /* 照 SEL_BIGT/SEL_DEF 的在册坑：best 不一定在带内 ⇒ 先单独量一遍，否则下面读 `.__defqBy` 会崩在选完人之后 */
    const gpool = (sel.clean && sel.clean.length) ? sel.clean : [sel.best];
    const gated = gpool.filter(function (e) { return e.gateOk !== false; });   /* 硬门槛不过的**不许**被这根键换上来（§E168/§N24 的教训） */
    const usable = gated.filter(function (e) { return defqOf(e).measurable; });
    SEL_DEFQ_LOG = { tol: SEL_DEFQ, games: SEL_DEFQ_GAMES, mode: SEL_DEFQ_MODE, eps: SEL_DEFQ_EPS, minHands: SEL_DEFQ_MINHANDS, minShare: SEL_DEFQ_MINSHARE,
      of: gpool.length, gatedOut: gpool.length - gated.length, measurable: usable.length, skipped: gated.length - usable.length,
      readings: gated.map(function (e) { const m = defqOf(e);
        return { score: Number(e.score.toFixed(4)), def: m.def, white: isFinite(m.whitePct) ? Number(m.whitePct.toFixed(1)) : null,
          measurable: m.measurable, placebo: isFinite(m.placeboRatio) ? Number(m.placeboRatio.toFixed(3)) : null, incumbent: e === sel.best }; }),
      band: 0, pickedWhite: null, changedWinner: false, noSample: usable.length === 0, tieBrokenBy: 'none' };
    if (!usable.length) {
      console.log('[白防选人] tol=' + SEL_DEFQ + 'pt · 手数门 ≥' + SEL_DEFQ_MINHANDS + ' ‖ 闸后 ' + gated.length + ' 粒逐粒：' +
        gated.map(function (e) { defqOf(e); return e.__defqBy; }).join(' ‖ ') +
        '\n[白防选人] ⇒ **全部没量到防御手 ⇒ 不改判（selDefqNoSample）**：这根在本臂零作用，**不算**"测过且无效"');
    } else {
      /* 排序键算术仍交给纯函数 `bandPickByUsage`（门 D221 能喂合成表直接钉它）。它取"用量最大"，
       * 而这里"白防率低者优" ⇒ 喂**负值**；没量到的喂哨兵 ⇒ 永不竞争，但仍在带里（带不因可得性缩）。 */
      const bp = bandPickByUsage(gated, SEL_DEFQ, keyOf, null);
      const ladder = bp.band.map(function (e) { defqOf(e); return e.__defqBy + '（重验分 ' + (e.score * 100).toFixed(1) + (e === sel.best ? '·原当选' : '') + '）'; }).join(' ‖ ');
      SEL_DEFQ_LOG.band = bp.band.length;
      SEL_DEFQ_LOG.tieBrokenBy = bp.tieBrokenBy;
      SEL_DEFQ_LOG.pickedWhite = bp.best ? Number(defqOf(bp.best).whitePct.toFixed(1)) : null;
      if (bp.best && bp.best !== sel.best && bp.tieBrokenBy === 'usage') {
        SEL_DEFQ_LOG.changedWinner = true;
        console.log('[白防选人] 带内 ' + bp.band.length + '/' + gated.length + ' 粒（闸外剔 ' + SEL_DEFQ_LOG.gatedOut +
          ' 粒 · 手数不够不参与竞争 ' + SEL_DEFQ_LOG.skipped + ' 粒）白防梯：' + ladder +
          '\n[白防选人] **改判（排序键换人）**：' + sel.best.__defqBy + ' → ' + bp.best.__defqBy +
          '（拿 ' + ((sel.best.score - bp.best.score) * 100).toFixed(1) + 'pt 胜负分换更低的白防率）');
        sel.best = bp.best;
      } else {
        /* 归因要说全（照 `兑现广度` 那条在册教训）：不改判有两种完全不同的原因——键真的没咬到，
         * 或者原当选者压根不在这根键看的带里（前面的 veto 把它挤出去了）。后者不许读成"键没起作用"。 */
        const inBand = bp.band.indexOf(sel.best) >= 0;
        console.log('[白防选人] 带内白防梯：' + ladder + ' ⇒ **未改判**（' +
          (!inBand ? '⚠ 原当选者**不在带内**（被前面的 veto 挤出去）⇒ 这根键无从比较，不许读成"键没作用"'
            : (bp.best === sel.best ? '带内白防最低的就是原当选者' : '带内可比的读数没低过原当选者')) + '）');
      }
      const pm = bp.best ? defqOf(bp.best).placeboRatio : NaN;
      if (isFinite(pm) && pm > 0.85) {
        console.log('[白防选人] ⚠ 当选者 placebo 倍差 ' + pm.toFixed(2) + '×（≈1 ⇒ "白防高"主要是因为**这张桌没人互相打**，' +
          '不许读成"时机差"；这条基线率是在册纪律，见 probe-wasted-play 的同名行）');
      }
    }
  }
  if (sel.best) { finalParams = sel.best.ref.params; ev = sel.best.ev; }
  /* ⚠ 下面这条 `else` 的先行词是**上面那句 `if (sel.best)`**。11-01 的 HALL_TRACE 语句曾插在两者之间，
   *   把 `else` 改挂到它身上 ⇒ 默认档（HALL_TRACE 关）下只要名人堂非空就假报"全部退化"并写错 meta，
   *   而开 HALL_TRACE 的臂反而把这条真报警吞了。门 D121 的接线腿查的是调用串在不在，抓不到这种接错。
   *   ⇒ 要在这两句之间插话，先把 `else if` 改写成独立判断。 */
  else if (hallEntries.length) {
    DEGENERATE_ONLY = true;
    console.error('⛔ [退化闸] 名人堂**全部退化**——产物仍写盘但标 degenerateOnlyWinner；promote 会拒收，别拿它换包');
  }
  if (HALL_TRACE) { try { appendFileSync(HALL_TRACE_OUT, JSON.stringify({ type: 'final', pickedWid: widOfArr(finalParams), hall: hall.map(function (h) { return h.wid || widOfArr(h.params); }) }) + '\n'); } catch (eT4) {} }
}
bestParams = finalParams;

/* ===== v1.5.277（qoder §E113）：**"产物 = 起点逐位"必须自己喊出来** =====
 * 病（09-28 夜班实测踩到）：λ 抬到 0.30（N=5 桌，两个 seed 都是）时，热启动种子以"锚定罚恰好为 0"挤进名人堂，
 *   终局重验又常由它夺冠 ⇒ 写盘的产物与起点**逐位相同**。这条线下面 band-save 的注释（v1.5.150）六晚前就点名了
 *   —— "一旦重验选中热启动点，整臂的工作就没了" —— 但**只补了落盘、没补读数** ⇒ 日志一切照常，
 *   我当场把起点的行为读数（炮 2.23 / maxEp 93）当成了那根旋钮的成绩（= 恒真读数，本仓最怕的形状）。
 * 处置：不改判定、不动权重，只**印 + 写进 meta**（`productIsSeed`），让下一班一眼看见"这臂零改包"。 */
let PRODUCT_IS_SEED = null, HALL_SEED_ENTRIES = null;
if (seedParams) {
  const sameAsSeed = function (p) {
    if (!p || p.length !== seedParams.length) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== seedParams[i]) return false;
    return true;
  };
  HALL_SEED_ENTRIES = hall.filter(function (h) { return sameAsSeed(h.params); }).length;
  PRODUCT_IS_SEED = sameAsSeed(bestParams);
  if (PRODUCT_IS_SEED) {
    console.error('[train-3p] ⚠ [产物=起点] 终局重验选出的冠军与热启动种子**逐位相同**' +
      '（名人堂 ' + hall.length + ' 席里 ' + HALL_SEED_ENTRIES + ' 席就是起点）⇒ 本臂**零改包**：' +
      '这粒产物的任何读数都是起点的读数，**不能**当本臂旋钮的效果。训练确实跑过（见逐代行），' +
      '但没有任何候选在重验里赢过起点 ⇒ 要看训练出了什么，读 band-save 落盘的那些候选。');
  }
}

/* ===== v1.5.160（qoder §N13）：**开火计数**——作用点自证，不接受"横幅说下达了所以一定生效" =====
 * 两条硬闸都来自用户 09-22 的裁定：一局未注 ⇒ 本臂作废（exit 8，别再白跑一整臂）；
 * 注入只覆盖 1 个受评座位 ⇒ 座位偏置没消掉（v1.5.65 那条注入的默认 1/8 在 `GAMES=8` 下恒落 `g=0` ⇒ 恒 0 号座，
 * 就是被裁掉的那个病）⇒ 同样 exit 8。 */
if (KILL_REQ > 0) {
  const ks = (typeof T.countKillSeats === 'function') ? T.countKillSeats() : { fired: -1, seats: {}, names: {} };
  const seatKeys = Object.keys(ks.seats || {}).sort();
  KILL_REC = { req: KILL_REQ, fired: ks.fired, seats: seatKeys, names: Object.keys(ks.names || {}) };
  console.log('[kill] 开火计数：注入 ' + ks.fired + ' 局 · 覆盖受评座位 ' + seatKeys.length + ' 个 [' + seatKeys.join(',') + ']' +
    ' · 注入名单 ' + Object.keys(ks.names || {}).join(',') + '（killField=' + KILL_REQ + '）');
  if (!(ks.fired > 0)) {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_KILL_FIELD=' + KILL_REQ + ' 却**一局未注** ⇒ 本臂作废（§N11 教训：横幅不等于作用点）');
    process.exit(8);
  }
  if (seatKeys.length < 2) {
    console.error('[train-3p] ⛔ 注入只覆盖 ' + seatKeys.length + ' 个受评座位 ⇒ 座位偏置未消（用户 09-22 裁定）⇒ 本臂作废');
    process.exit(8);
  }
}

/* =====（ZCode · 11-06 夜）课程席收据：下达了就必须真的上过桌 =====
 * 与 killSeat 同一条纪律（横幅读回证明不了作用点发生）：EPIRUS_COURSE_EVERY>0 而开火计数为 0
 * ⇒ 判据没接上（比如 ALL 局都是承诺局/人数恒 <3）⇒ 本臂作废，不许静默空转。 */
if (Number(process.env.EPIRUS_COURSE_EVERY || 0) > 0) {
  const cs = (typeof T.countCourseSeats === 'function') ? T.countCourseSeats() : { fired: -1, gens: {}, names: {} };
  console.log('[course] 开火计数：注入 ' + cs.fired + ' 局 · 覆盖 ' + Object.keys(cs.gens || {}).length + ' 个世代' +
    ' · 脚本名单 ' + Object.keys(cs.names || {}).join(',') + '（courseEvery=' + process.env.EPIRUS_COURSE_EVERY +
    ' ‖ bot=' + (typeof T.courseBotName === 'function' ? (T.courseBotName() || 'pickToolKit') : '?') + '）');
  if (!(cs.fired > 0)) {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_COURSE_EVERY=' + process.env.EPIRUS_COURSE_EVERY + ' 却**一局未注** ⇒ 本臂作废');
    process.exit(8);
  }
}

/* ===== 11-10（用户：2P 也要统一冠军）：FIT_CHAMP 开火收据 =====
 * 同 [course]/[kill] 纪律：下达了却一局未上桌 ⇒ 判据没接上（例如 2P 混桌被旧的 nG<3 挡掉）⇒ 本臂作废。 */
if (process.env.EPIRUS_FIT_CHAMP != null && process.env.EPIRUS_FIT_CHAMP !== '') {
  const fst = (typeof T.fitStat === 'function') ? T.fitStat() : { fired: -1 };
  console.log('[fitChamp] 开火计数：冠军席上桌 ' + fst.fired + ' 局 · 按人数 ' + JSON.stringify(fst.byN || {}) + '（fitChampEvery=' + (process.env.EPIRUS_FIT_CHAMP_EVERY || '4') + '）');
  if (!(fst.fired > 0)) {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_FIT_CHAMP 却**一局未上桌** ⇒ 本臂作废');
    process.exit(8);
  }
}

/* =====（ZCode · 11-06 深夜）桌形混合 收据：同 [course] 的形状 =====
 * 一局未翻 ⇒ 判据没接上（k<2 被钳 / 表形不匹配）⇒ 本臂作废，不许静默空转。
 * （池对手席走在册 EPIRUS_POOL_OPPS——它的收据在 [pool-ops] 那一支，不在这里重复。） */
if (Number(process.env.EPIRUS_MIXHP_EVERY || 0) > 0) {
  const flips = (typeof T.countMixHpFlips === 'function') ? T.countMixHpFlips() : -1;
  console.log('[mixHp] 开火计数：换对偶桌 ' + flips + ' 局（mixHpEvery=' + process.env.EPIRUS_MIXHP_EVERY + ' ‖ 主桌=' +
    (typeof T.trainMode === 'function' ? T.trainMode() : '?') + '）');
  if (!(flips > 0)) {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_MIXHP_EVERY=' + process.env.EPIRUS_MIXHP_EVERY + ' 却**一局未翻** ⇒ 本臂作废');
    process.exit(8);
  }
}

/* ===== 带内候选落盘（v1.5.150 · 移植自 `tools/train-best.mjs` 的 band-save）=====
 * 病：本工具的终局是"名人堂里用新种子重验、只取最优"，**其余候选全被丢掉** ⇒ 一旦重验选中热启动点，
 *     整臂的工作就没了（`v7xn1-31.bak` 与现役**逐字节相同**就是这么来的：候选连看都看不到）。
 * 改法：hall 里每一粒都写 `docs/artifacts/<ARM>-band<k>.bak`（ARM = `EPIRUS_ARM` 或输出名去掉扩展名），
 *     并把 `xn2*` 口径写进 meta（谁跑的、什么权重、对谁打 2P —— 产物要能自证来历）。
 * 只写盘、不改当选判定；失败不影响当选者写盘。 */
try {
  /* 11-03：名字与落点已在 GA 循环之前定义（存段要当场落盘），这里只引用，避免"两处各写一遍" */
  const ARM = ARM_NAME;
  const BAND_DIR = BAND_DIR_NAME;
  /* ⚠ 只提醒、不改行为（本班实测踩到的形状）：产物被 `EPIRUS_T3P_OUT` 改道到**仓库外**（并发臂的常规做法），
   *   但 band 备份仍按默认落进 `docs/artifacts` ⇒ 每一臂多 6 份 `.bak`，**下一位跑 `--group=meta` 的人当场吃 `D191` 的"未登记重复"红**
   *   （实测：11 臂 × 6 = 66 份 ⇒ `got=5 want=0`；同一族 DS 上一批也撞过一次）。
   *   旋钮本来就有（`EPIRUS_BAND_DIR`，见上一行注释）⇒ 这里不替谁改默认值，只把"改了产物没改 band"这件事**说响**。 */
  const OUT_ABS = /^[a-zA-Z]:[\/\\]|^\//.test(OUT_PATH);    // 盘符开头（`C:/` 或 `C:\` 都算）或以 / 开头 ⇒ 产物被改道到仓库外
  if (!process.env.EPIRUS_BAND_DIR && OUT_ABS) {
    console.log('[band-save] ⚠ 产物已改道到仓库外（' + OUT_PATH.slice(0, 60) + '），但 band 备份仍要写默认目录 `docs/artifacts`'
      + ' ⇒ 并发臂会把 ' + (process.env.EPIRUS_ARM || ARM) + '-band*.bak 撒进门禁扫描区（`D191` 的"未登记重复"会红）。'
      + '要一并改道请带 `EPIRUS_BAND_DIR=<仓库外目录>`；本行只是提醒，**行为一字未改**。');
  }
  /* v1.5.247：目录不存在 ⇒ **自己建**，不再静默跳过。
   * 起因（09-26 实测，我自己的漏）：E35/E39 两批共 52 支臂我都把 `EPIRUS_BAND_DIR` 指到 `<tmp>/bands/<arm>`，
   * 但并发脚本只 `mkdir` 了父目录 ⇒ 每支臂都打了 `[band-save] 无 … 目录，跳过` 就**把带内候选全丢了**
   * （只留下当选者）。这恰好废掉了本节存在的理由——"落选者也是证据"，而且**它不影响退出码、不影响当选**，
   * 所以臂"跑成功"了、证据却没了。改成建目录；建不出来（权限等）才**响亮**报告。 */
  let bandDirReady = true;
  if (!existsSync(BAND_DIR)) { try { mkdirSync(BAND_DIR, { recursive: true }); } catch (e2) { bandDirReady = false; console.log('[band-save] ⛔ 建不出 ' + BAND_DIR + '：' + e2.message + ' ⇒ 带内候选会丢，只剩当选者'); } }
  /* 名人堂**可以装同一粒权重两次**（同一对象在不同代被重采样进前二）⇒ "（当选）"会打两遍。
   * 09-28 就是这个"两个当选"让我发现产物其实是起点，所以重复席位必须显式说出来，不能靠读者自己数。 */
  const selFirst = hall.findIndex(function (x) { return x.params === bestParams; });
  if (bandDirReady) for (let bi = 0; bi < hall.length; bi++) {
    const hh = hall[bi];
    const dupWinner = hh.params === bestParams && bi !== selFirst;
    const bmeta = {
      /* ===== 2026-10-12 DS：热启动的**父权重身份**（与终局产物那条同一把尺，理由见 `const meta` 处的长注释）=====
       * band 是**真正被留下来的候选**（终局重验常由起点夺冠 ⇒ 那条根本不落盘）⇒ 这一条比终局那条更要紧。
       * 只有真的是哈希（16 位 hex）时才写：算不出时 `hotstartFrom` 退回的是**路径**，而路径写进这个字段会让
       *   `lineage` 的 `byHash` 一级去解一个不存在的身份（那一级"永远不否"）；路径本身在 `recipe.env` 里已有。
       * 冷启动一个字段都不加（`docs/artifacts/train-3p-out.js` 是被 D123/D127 钉在 `aa743488cc` 的登记基线）。 */
      ...(/^[0-9a-f]{16}$/.test(hotstartFrom || '') ? { hotstartFrom: hotstartFrom } : {}),
      source: 'training/train-3p.mjs (band-save)', arm: ARM, bandIdx: bi, trainFit: hh.fit,
      xn2w: XN2W || 0, xn2g: XN2G, xn2refs: (XN2W > 0 ? XN2REF_PATHS : []),
      n: N, gens: GENS, games: GAMES, pop: POP, seed: __SEED,
      selected: hh.params === bestParams && bi === selFirst,
      dupOfBand: (dupWinner ? selFirst + 1 : null),   // 与第几席是同一粒权重（null = 不重复）
      ts: new Date().toISOString(),
      /* v1.5.226：band 也要能自证来历 —— 原先只有 arm/gens/seed 这些手写字段，**没有旋钮配方**。 */
      recipe: { env: EFFECTIVE_ENV, envKeys: Object.keys(EFFECTIVE_ENV).length }
    };
    /* band 夹具**设计上就是同一粒权重按 band 各存一份**（打印里本来就写着「与 bandN 同一粒权重」）
     *   ⇒ 走 declareCopy：照写，但每一份额外登记进别名表，于是"未登记的重复"才是 D191 那条腿要打的东西。 */
    declareCopy({ root: process.cwd(), dest: BAND_DIR + '/' + ARM + '-band' + (bi + 1) + '.bak', tool: 'train-3p:band',
      why: 'band 夹具（同一次跑的第 ' + (bi + 1) + ' 席）',
      text: '/* band-save ' + ARM + '-band' + (bi + 1) + '（tools/train-3p.mjs v1.5.150 起） */\n' +
      'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(bmeta) + ';\n' +
      'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(hh.params)) + ';\n' });
    console.log('[band-save] ' + ARM + '-band' + (bi + 1) + '.bak  trainFit=' + hh.fit.toFixed(3) +
      (bmeta.selected ? '（当选）' : (dupWinner ? '（与 band' + bmeta.dupOfBand + ' 同一粒权重）' : '')));
  }
  /*（ZCode · 11-03 凌晨）E3 存段落盘：<ARM>-seg<k>.bak（与 band 同目录同格式；`scratch/holdout-promote.mjs` 复排）。 */
  if (SEGS.length && bandDirReady) {
    let already = 0, rewrote = 0;
    SEGS.forEach(function (s, k) {
      const dest = BAND_DIR + '/' + ARM + '-seg' + (k + 1) + '.bak';
      if (existsSync(dest)) { already++; return; }   /* 快照当时已落盘 ⇒ 这里不重写（同字节，省一次写） */
      writeFileSync(dest, segTextOf(s, k), 'utf8'); rewrote++;
    });
    console.log('[holdout-seg] 段档案 ' + SEGS.length + ' 个（当场已落 ' + already + ' ‖ 本次补写 ' + rewrote + '）⇒ '
      + BAND_DIR + '/' + ARM + '-seg*.bak（holdout-promote 复排用）'
      + (SEG_FLUSH_FAIL.length ? ' ‖ ⚠ 当场落盘失败过 ' + SEG_FLUSH_FAIL.length + ' 个：' + SEG_FLUSH_FAIL.join(' ; ') : ''));
  } else if (SEGS.length && !bandDirReady) {
    console.log('[holdout-seg] ⛔ 目录建不出 ⇒ ' + SEGS.length + ' 段里当场落盘成功的只有 ' + (SEGS.length - SEG_FLUSH_FAIL.length) + ' 个（见上面各 ⚠ 行）');
  }
} catch (e) { console.log('[band-save] 失败（不影响当选者写盘）：' + e.message); }
console.log('\n=== ' + N + ' 人实测（最终冠军，' + SEL_PAIRS.length + ' 对 × 20 局 × ' + SEL.k + ' 粒 seedBase，座位轮换，temp0.15）===');
console.log('1st=' + (ev.firstRate * 100).toFixed(1) + '%  top2=' + (ev.top2Rate * 100).toFixed(1) +
  '%   (1st/2nd/3rd = ' + ev.first + '/' + ev.second + '/' + ev.third + ' of ' + ev.games + ')');
console.log('耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

const pack = P.pack(bestParams);
const meta = {
  /* ===== 2026-10-12 DS：热启动的**父权重身份**必须落进产物 =====
   * 为什么非写不可：`champion-map/lineage.mjs:9` 的契约是"`hotstartFrom` = 从哪一枚的**权重**热启动来的（一个哈希）"，
   *   而 CLI 侧此前只记 `recipe.env.EPIRUS_SEEDPACK`（一个**路径**）⇒ 血统图只能按路径推 ⇒ **画虚线**，
   *   且路径会因去重/改名失效 —— 实测 63 枚子包点名 `docs/artifacts/e234-out/K2.js`，那份被搬进隔离区
   *   ⇒ 六天来只能画虚线（本班已按别名表把那 63 条解回实线）。
   * 这不是新字段：服务端那一路（`server/train-server.mjs:289,357`）一直写 `hotstartFrom: weightsId(seedPack)`；
   *   本条是**对齐** —— 同一个名字、同一个量（`widOfArr` 与 `weightsId` 逐字同式 = `sha1(权重数组)` 前 16 位）。
   * ⚠ **只有真的是哈希时才写**（16 位 hex）：① 算不出时 `hotstartFrom` 会退回路径，路径写进这个字段会让
   *   `lineage` 的 `byHash` 一级去解一个不存在的身份（那一级"永远不否"，会画出悬空边）；路径本身在 `recipe.env` 里已有。
   * ② **冷启动一个字段都不加**：`docs/artifacts/train-3p-out.js` 是被 D123/D127 钉在 `CLI_ARM_BASELINE='aa743488cc'`
   *   的登记基线（默认冷启动的产物），加一个 `null` 字段就等于改了它。 */
  ...(/^[0-9a-f]{16}$/.test(hotstartFrom || '') ? { hotstartFrom: hotstartFrom } : {}),
  selLand: SEL_LAND_LOG,
  selClear: SEL_CLEAR_LOG,   // §E787：场B 清场地板的账（线/逐粒读数/剔几粒/改没改判/**一格没咬到**）；关档 ⇒ null，一行都不跑
  /* v1.5.169：产物自带配方。§N11 的教训是"读日志才知道这臂开了什么"，而日志会滚走、`.bak` 会留下来——
   * 于是事后复盘（和 DS 那边跑对照）只能靠文件名猜。把**下达值 + 开火计数**一起写进 meta，
   * 让每一粒产物能自证"我当时是在什么分布下选出来的"。只加字段，不改任何判定。 */
  recipe: { arm: (process.env.EPIRUS_ARM || null), seed: __SEED, gens: GENS, games: GAMES, pop: POP,
    /* §E635（v1.7.92）：这两张"桌"的账必须能从产物自证 —— 关档 ⇒ `null`（一行都不留，与历史臂逐字相同）。
     * `selPool` 记的是**选拔桌**（终局重验那张表）有没有池席；`poolOpps`（上面那个字段）记的是**训练桌**。
     * 分两处记不是重复：它们本来就是两张桌，而 10-17 那页归因的病正是"只记了一张、另一张没人知道"。 */
    selPool: (SEL_POOL ? { table: SEL_TABLE.length, pairs: SEL_PAIRS.length, poolSeats: POOL_OPPS.length,
      poolIds: POOL_OPPS.map(function (o) { return o.name; }) } : null),
    hallDedup: (HALL_DEDUP ? { dropped: hallDupDropped, seats: hall.length } : null),   // 开过就记次数，0 次也记（0 与"没开"不同形）
    xn2w: XN2W, xn2g: XN2G, selLand: SEL_LAND, selLandGames: SEL_LAND_GAMES, selLandTol: SEL_LAND_TOL,
    selClear: SEL_CLEAR, selClearGames: SEL_CLEAR > 0 ? SEL_CLEAR_GAMES : null,   // §E787：下达值 + 测量长度（关档 ⇒ 只留 0，读数与历史臂逐字相同）
    /* 11-09 P1/P2（用户裁的形状：白防率**排序键**+ 手数门 / 用卡地板**只筛新候选**）。
     * 关档 ⇒ 两条 `null`，整段一行都不跑；开着就把「逐粒读数 / 改没改判 / placebo 倍差 / 几粒没量到」全记进产物，
     * 因为"这根有没有作用"只能从落盘的账里核，不能从我嘴上说。 */
    selDefq: SEL_DEFQ_LOG,
    selCards: SEL_CARDS_LOG,
    /* v1.5.326 §E249：这根排序键**有没有真的换人**必须写在产物里（`{changedWinner, zeroDose, usage…}`）。
     * 关档 ⇒ `null`（一行都不跑，与历史臂逐字相同）。`zeroDose:true` 那一臂**不许**被读成"测过且无效"。 */
    selBigT: SEL_BIGT_LOG,
    /* §E650（千问 · 默认关 ⇒ 两个 `null`，与历史臂同形）：送盾 veto 的账。
     * 记 `games` 是硬要求：§E649 实测这条判定随抽样长度翻（20 局 6.15 / 100 局 4.94），**没带长度的送盾读数不许被引用**。 */
    selGiftVeto: (SEL_GIFT_VETO > 0 ? SEL_GIFT_VETO : null), giftVeto: GIFT_VETO_LOG, giftVetoAllSpam: GIFT_VETO_ALL_SPAM,
    /* §十一 C：演化期健康门槛的开没开、审了多少次、饿退几代 —— 关档时整条 null（与历史臂同形）。 */
    gaGate: (GA_GATE > 0 ? { caliber: '两模式 effSkills≥' + GA_KINDS + '（种类那条 = 产品门 broad）∧ 两模式 effSkillsLand≥参照−' + LAND_TOL + '（那条 = pool-frontier-lib.isWideVs）', kindsFloor: GA_KINDS, sameAsBroadKinds: GA_GATE === 3, switch: GA_GATE, games: GA_GATE_GAMES, band: GA_BAND,
      ref: GA_INC ? { gMulti: GA_INC.gMulti, gLong: GA_INC.gLong, landMulti: GA_INC.landMulti, landLong: GA_INC.landLong } : null,
      noRefGens: GA_STAT.noRef, audits: GA_STAT.audits,
      healthyGens: GA_STAT.healthyGens, starvedGens: GA_STAT.starvedGens, swapped: GA_STAT.swapped,
      eff1Mean: GA_STAT.healthyGens ? Number((GA_STAT.eff1Sum / GA_STAT.healthyGens).toFixed(2)) : null,
      lastEff1: GA_STAT.lastEff1, gens: GENS } : null),
    /* 11-02（千问）：四把干预档的**生效值**无条件落盘（未下达也记引擎默认）⇒ 以后任何一臂都能直接读出"训练时带不带档"。 */
    deployKnobs: DEPLOY_REC,
    /* 11-04（DS，千问清单第 5 条）：门闸的**生效值**无条件落盘（未下达也记 0）。 */
    gateState: { breadthFloor: BREADTH_FLOOR, gaGate: GA_GATE, gaGateGames: GA_GATE_GAMES },
    /* 11-04（千问）：锚定的**目标与棘轮状态**同样无条件落盘（关档也记 `{lambda:0,to:'seed'}`）
     *   —— 否则"锚没生效 / λ 太小空转 / 压根没下达"三种情况在账上又是同形（DS 给 gateState 补的就是这族病，
     *   而他 ANCHOR 那批的 meta 里连 `anchor` 都没有，只有日志能判）。 */
    initScale: INIT_SCALE,   // 11-04 波 H：无条件落盘（缺省也记 0.25）⇒ 冷启动批能分幅度读
    anchor: { lambda: ANCHOR, to: ANCHOR_TO,
      refWid: anchorRef ? anchorRef.wid : null, refGen: anchorRef ? anchorRef.gen : null,
      refG: anchorRef ? anchorRef.g : null, refWideScore: anchorRef ? Number(anchorRef.wideScore.toFixed(2)) : null,
      moves: anchorRefMoves,
      live: ANCHOR > 0 ? ((ANCHOR_TO === 'widest' ? !!anchorRef : !!seedParams) ? 1 : 0) : 0 },
    kill: KILL_REC, trainMode: TRAIN_MODE_REQ, trainModeEffective: (typeof T.trainMode === 'function' ? T.trainMode() : null),
    /* v1.7.4 S2a：训练期那档决策期改写也要记账 —— 只记"下达值"不够（本仓的教训：横幅证明变量、证明不了效果）。
     * ⇒ 两个都记：下达的 `h2p` 与写 meta 时消费点仍读到的 `h2pEffective`；两者不等 = 中途被改回去，产物不可信。 */
    h2p: H2P_REQ, h2pEffective: (typeof P.holo2Proto === 'function' ? P.holo2Proto() : null),
    counterOpps: COUNTER_OPPS.map(function (o) { return o.name; }),   // v1.5.172：这臂的训练桌上放了哪几个判据原型
    /* v1.7.83 §E631：这臂的训练桌上有没有**池成员**（默认关 ⇒ `null`，一行都不留，与历史臂同形）。
     * 记 **wid + 被问到几次**而不是路径 —— 成员 `.bak` 有一批是 gitignore 的，路径在干净克隆里可能指空（那是 `D234` 的活）。 */
    poolOpps: (POOL_OPPS.length ? POOL_OPPS.map(function (o) { return { name: o.name, wid: o.sel.poolWid, asked: o.sel.asked() }; }) : null),
    bigtChainW: BIGT_CHAIN_REQ,   // v1.5.187：这臂有没有给"连带"付钱（0 = 出厂口径）
    /* v1.5.194：这臂是**在哪套规则下训的**。写在最显眼处 —— 否则第二天没人知道这粒冠军学过击杀奖励，
     * 拿回现状引擎里一评就成了"冠军莫名变弱"的悬案。 */
    killReward: KR_REQ, krTransfer: (KR_REQ ? (process.env.EPIRUS_KR_TRANSFER || 'owner') : null), killRewardProbe: KR_PAID_PROBE,
    breadthFloor: BREADTH_LOG,
    /* v1.5.226：**机械算出的实际生效配方**（= knob-guard 的读集 ∩ 环境里真设了的键）。
     * 与上面那些手写字段并存：手写字段是"这一臂的口径摘要"，`env` 是"当时环境里到底有哪些旋钮"。 */
    env: EFFECTIVE_ENV, envKeys: Object.keys(EFFECTIVE_ENV).length },
  breadthFloorAllNarrow: BREADTH_ALL_NARROW,   // §N29 走向②的标记：全池塌缩 ⇒ 该改奖励面，不是换排序键
  degenerateOnlyWinner: DEGENERATE_ONLY,   // §N9 退化闸：true=没有合格当选者、promote 会拒收
  productIsSeed: PRODUCT_IS_SEED, hallSeedEntries: HALL_SEED_ENTRIES,   // v1.5.277 §E113：产物=起点逐位 ⇒ 本臂零改包
  source: 'training/train-3p.mjs', n: N, gens: GENS, games: GAMES, pop: POP,
  /* §E322：把"当选键用了几粒 seedBase + 那几粒之间的极差"记进 meta。
   * 理由（§E318 实测）：链上从不印"分差 vs 噪声"的关系，于是 0.49pt 的分差被当判断用。 */
  selSeeds: SEL.k, selSeedBases: SEL_BASES, selSpreadPt: Number(ev.spreadPt ? ev.spreadPt.toFixed(2) : 0),
  ts: new Date().toISOString(), firstRate: ev.firstRate, top2Rate: ev.top2Rate
};
const ARM_TXT =
  '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 tools/train-3p.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n';
/* §E589 防新增拷贝：臂产物落盘前先查"这粒权重是否已有真身"。
 *   最常见的命中就是 `PRODUCT_IS_SEED`（本臂零改包 ⇒ 产物与起点逐位相同）与"同一次跑换个系列名再存一遍"——
 *   普查里最大那组 17 份就是这么来的。命中 ⇒ 不写第二份，只登记别名（`champion-map/pack-aliases.tsv`）。
 *   要真复制（例如臂产物必须留在当批目录里当夹具用）加 `--force-copy` 并写 `--copy-note=`。 */
const GUARD = guardWrite({ root: process.cwd(), dest: OUT_PATH, text: ARM_TXT, tool: 'train-3p',
  force: process.argv.includes('--force-copy'),
  /* 本文件没有 `arg()` 那套旗标助手（它读 env）⇒ 这里自己扫 argv，别凭空引一个不存在的函数 */
  why: ((process.argv.find(x => x.indexOf('--copy-note=') === 0) || '').slice('--copy-note='.length)
    || (PRODUCT_IS_SEED ? '本臂零改包：产物 = 起点那一粒' : '')) });
console.log('[train-3p] 落盘：' + GUARD.note);
/* v1.7.79（用户 2026-10-17 裁定）：§E589 守卫拦下 = **产物没落盘** ⇒ 给专属退出码 9。
 *   原来这里继续往下走、最后 `exit 0` ⇒ 调用方把「退出码 0」读成「这臂跑成了、产物在那儿」，
 *   而它读到的是**上一次留在那个路径上的旧文件**；这与 D233（拿退出码当"跑成没跑成"的唯一凭据）是同一个病。
 *   规矩：**要么真的写了、要么响亮失败** —— 不许用 0 表示"我什么都没写"。 */
if (!GUARD.wrote) {
  console.error('⛔ [train-3p] §E589 守卫拦下了这次落盘 ⇒ 产物不存在（退出码 9，不是 0）。原本要写 ' + OUT_PATH);
  process.exit(9);
}
/* v1.7.115（10-19，千问）：点名器**只在真落了盘之后**打，而且把发布态分出去。
 *   三条判据都要能各自成立：① 上面 `!GUARD.wrote` 那条已经 exit(9) ⇒ 走到这儿就是真写了；
 *   ② `EPIRUS_PUBLISH=1` 那次写的是 `js/bundled-champion-3p.js`（发布态），不是"默认落点" ⇒ 不混进这份名单；
 *   ③ 没设 `EPIRUS_T3P_OUT` 且非发布态 ⇒ 才是要点名的"没改道就写共享基线"。
 *   自证：`docs/research/archive/2026-10-19-ds-gate-review/verify-writedefault.mjs`（三格：该失败的失败 / 发布态 / 真写默认落点）。
 * ⚑ §E654 加的第二条通道：`EPIRUS_LOG_DEFAULT_OUT=<文件路径>` 时**另外追加一行到那个文件**。
 *   为什么必须有文件这一路：门里每条腿是用 `spawnSync` 拿子进程 stdout 的，那行 `[WRITE-DEFAULT]` 落在**腿自己的变量**里，
 *   腿不失败就永远不打印 ⇒ 光靠 stdout（DS 交班那条 `| Select-String`）在门里**一条都捞不到**（10-19 实测：整趟六个部分，stdout 里 0 条）。
 *   值是 `1` 时只打 stdout（手跑的用法）；值是个路径时 stdout + 台账都写。台账由调用方放到仓库外，门禁面不产新文件。 */
if (process.env.EPIRUS_LOG_DEFAULT_OUT && !process.env.EPIRUS_T3P_OUT && process.env.EPIRUS_PUBLISH !== '1') {
  const TAGX = process.env.EPIRUS_T3P_BASELINE === '1' ? '[WRITE-BASELINE] ' : '[WRITE-DEFAULT] ';
  const WDL = TAGX + String(process.env.EPIRUS_ARM || '(no-arm)') + ' ‖ argv=' + process.argv.slice(2).join(' ')
    + ' ‖ 落点=' + OUT_PATH;
  console.log(WDL);
  const LED = String(process.env.EPIRUS_LOG_DEFAULT_OUT);
  if (LED !== '1') {
    try {
      appendFileSync(LED, new Date().toISOString() + '\t' + String(process.env.EPIRUS_ARM || '(no-arm)')
        + '\t' + process.pid + '\t' + OUT_PATH + '\t' + process.argv.slice(2).join(' ')
        + '\t' + (process.env.EPIRUS_T3P_BASELINE === '1' ? 'BASELINE（声明过）' : 'DEFAULT（没声明）') + '\n', 'utf8');
    } catch (e) { console.error('⛔ [WRITE-DEFAULT] 台账写不进去（' + LED + '）：' + (e && e.message ? e.message : e)); }
  }
}
console.log((GUARD.wrote ? '\n\u5df2\u5199\u5165 ' : '\n✘ 没写文件（§E589 守卫）：' + GUARD.note + '\n  原本要写 ') + OUT_PATH + '  (coldStart=' + (!seedParams) + ', seed=' + __SEED + ')' +
  (PRODUCT_IS_SEED ? '  ⚠ 产物与起点逐位相同（本臂零改包）' : ''));

/* =====（ZCode · 11-08 凌晨）三件套自动读数（PLAN-2026-11-07 A1 落地 · 默认关）=====
 *   夜班实证：训练桌评估会骗人（塌方臂臂内 5P 终评 58.2%，考卷已塌到 0.201）⇒ 每臂收尾用**考卷**自报家门。
 *   EPIRUS_TRIPLET=1 时 spawn tools/exam4-triplet.mjs（双剂量双桌 R=100 ≈70s），JSON 带前缀 [triplet] 打到 stdout，
 *   并追加进 EPIRUS_TRIPLET_LOG（设了路径才写；批量调用方拼表用）。读数失败只响亮警告、不判臂死
 *   （阈值闸等用户裁，见 PLAN-2026-11-07 A1）；默认关 ⇒ 历史臂逐字可复现。 */
if (process.env.EPIRUS_TRIPLET === '1' && GUARD.wrote) {
  const tr = spawnSync(process.execPath, ['tools/exam4-triplet.mjs', OUT_PATH, '100'], { cwd: process.cwd(), encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 24 });
  const line = (tr.stdout || '').split(/\r?\n/).find(l => l.indexOf('{"pack"') === 0);
  if (line) {
    console.log('[triplet] ' + line);
    const TL = String(process.env.EPIRUS_TRIPLET_LOG || '');
    if (TL) { try { appendFileSync(TL, line + '\n', 'utf8'); } catch (e) { console.error('⛔ [triplet] 台账写不进去（' + TL + '）：' + (e && e.message ? e.message : e)); } }
  } else {
    console.error('⛔ [triplet] 三件套没读到结果（stderr 前 200 字）：' + String(tr.stderr || '').slice(0, 200));
  }
}


