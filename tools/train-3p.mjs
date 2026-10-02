/* Epirus 多人自对战训练器（N19）：名次适应度 + 座位轮换 + 多对手池
 * 用法：node tools/train-3p.mjs [代=200] [人数=3] [每代评估局数=8] [种群=12]
 * 产出：js/bundled-champion-3p.js（window.EPIRUS_CHAMPION_3P）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { P2_FNAME } from './p2-baselines.mjs';   // 2P 考卷基准的单一来源（v1.5.150：`EPIRUS_XN2REF=exam` 用它）
import { densityProfile } from './audit-lib.mjs';   // §N9 退化闸的口径源（与 promote 同一个 zeroAtkRate）
import { ECON_ENV_KEYS, ECON_REWARD_KEYS, readEconEnv } from '../server/econ-env.mjs';   // v1.5.155 黑键侦测：server 下发族名单（单一来源）
import { readTrainEnv, hasTrainOverride, REMOVED_TRAIN_KEYS } from '../server/train-env.mjs';   // v1.5.159：训练分布旋钮（与 econ/fight 同构的单一来源）
import { rejectDegenerateWinners, bandPickByLand, bandPickByUsage, rejectNarrowWinners } from './pick-best.mjs';
import { HOLO_GIFT_MAX, landShareOf } from './audit-lib.mjs';   // v1.5.168：送盾阈值与 promote 同源（当选面预筛要用）   // §N9 当选面退化闸（纯函数，门 D121 直接喂合成表）· §N24 兑现广度同分带排序
/* v1.5.269（§E77）：载重 veto 的**同口径量具** —— `behavior-profile` 的 `fieldProfile`（ε=0 · temp 0.15 · 5 席同包）。
 * 该模块的主体被 `if (RUN_AS_MAIN)` 守着 ⇒ **import 无副作用**（只会多装载一次引擎，实测 ~0.5 秒）。 */
import { fieldProfile } from './behavior-profile.mjs';
/* v1.5.194（qoder 0924 夜）：击杀奖励规则的**单一来源**实现（与 `probe-kill-reward.mjs` 共用同一份 ⇒
 * 不会出现"训出来的冠军和量出来的冠军不是一套规则"）*/
import { patchResolve as krPatchResolve, patchPlay as krPatchPlay, makeKR as krMakeKR } from './kill-reward-lib.mjs';
/* v1.5.229（用户批准方案 a）：**序列奖励** —— "蓄能[电珠] → 下一回合电磁炮"完成时给 +W ep。
 * 与击杀奖励同族：只包一层 `policyChooserN` 工厂，**仓库文件一字不动 ⇒ 规则指纹不变**，默认关。 */
import { makeSeqReward, patchEvoChooser as seqPatchEvoChooser } from './seq-reward-lib.mjs';
/* v1.5.200：黑键 / 已删键的判定搬进**单一来源**（原先只有本工具自己一份 IIFE ⇒ 别的入口没有这道闸）。
 * v1.5.226：同一个读集还用来把**实际生效的配方**写进 meta（见下面的 EFFECTIVE_ENV）。 */
import { enforceKnobs, readKeysOf } from '../server/knob-guard.mjs';

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

/* ===== v1.5.155 · CLI 黑旋钮侦测（DS 09-22 裁定 · qoder §N10 提案）=====
 * 病：本工具的 env 面是一个**闭集**（下表），而 server 侧有一大批旋钮经 `server/econ-env.mjs` /
 *   `fight-env.mjs` 下发，或由 `js/` 里的代码"加载时读 `process.env`"。从 **CLI** 传这些键**一律无效、
 *   却没有任何提示** ⇒ 会跑出"看起来在调参、其实是默认经济"的臂（本会话已踩到第 5、6 例：
 *   `EPIRUS_CLEAR_W` 传了没人读、`EPIRUS_PASSIVE_FIELD` 因沙箱无 `process` 永远默认）。
 * 改法：启动时把 env 里出现的 `EPIRUS_*` 与本工具闭集比对，命中**暗键** ⇒ 打印名单 + `exit 6`
 *   （与 D119/D120 的"要了开关不许静默"同一条规矩）。有意为之的情形用 `EPIRUS_ALLOW_DARK=1` 放行。 */
const SELF_ENV_KEYS = [
  'EPIRUS_ANCHOR', 'EPIRUS_ARM', 'EPIRUS_BAND_DIR', 'EPIRUS_CLEAR_W', 'EPIRUS_HOTSTART',
  'EPIRUS_SEL_LAND', 'EPIRUS_SEL_LAND_GAMES', 'EPIRUS_SEL_LAND_TOL',   // v1.5.167：当选面兑现广度（默认关）
  'EPIRUS_HALL_SEED',   // v1.5.277 §E114：把起点补进终局重验的候选池（默认关）
  'EPIRUS_BREADTH_FLOOR',   // v1.5.170：广度准入线（§N29，默认关；`SEL_LAND_GAMES` 是它共用的量具局数）
  'EPIRUS_SEL_KEEP', 'EPIRUS_SEL_KEEP_KEYS', 'EPIRUS_SEL_KEEP_CAST_KEYS', 'EPIRUS_SEL_KEEP_SEAT', 'EPIRUS_SEL_KEEP_SEAT_GAMES', 'EPIRUS_SEL_KEEP_SEAT_MIN', 'EPIRUS_SEL_KEEP_MODES', 'EPIRUS_SEL_KEEP_CAL', 'EPIRUS_SEL_KEEP_PLAIN_GAMES',   // v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关）
  'EPIRUS_COUNTER_OPPS',    // v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关）
  'EPIRUS_RING_OPPS',        // v1.5.285 §E127：把会放聚能环的对手放上训练桌（默认关；判据用现成的 probe-dead-term）
  'EPIRUS_ECON_OPPS',        // v1.5.325 §E236：把"会攒并且真兑现"的深经济对手放上训练桌（名字表驱动，默认关）
  'EPIRUS_SEL_BIGT', 'EPIRUS_SEL_BIGT_KEYS', 'EPIRUS_SEL_BIGT_GAMES', 'EPIRUS_SEL_BIGT_MODE',   // v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变）
  'EPIRUS_OPP_BLOCK',       // v1.5.279 §E124：整桌同原型（改"桌子的形状"，不改名单；默认关 ⇒ 逐字可逆）
  'EPIRUS_KILL_REWARD', 'EPIRUS_KR_TRANSFER',   // v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎）
  'EPIRUS_SEQ_W',   // v1.5.229：序列奖励（"蓄能[电珠]→下一回合电磁炮"完成时 +W ep；同样只在内存里，默认 0=关）
  'EPIRUS_KILL_FIELD',   // v1.5.160：收割席注入（qoder §N13 · 用户裁定"场B 缺口走对手池"）⇒ 带**开火计数**才敢算"已下达"
  'EPIRUS_TRAIN_MODE',   // v1.5.169：训练模式（§N28 · 用户"炼一个 5 血长程通吃其他模式"）⇒ 认不了就 exit 7，不许静默退回 multi
  'EPIRUS_PUBLISH', 'EPIRUS_SEED', 'EPIRUS_SEEDPACK', 'EPIRUS_XN2G', 'EPIRUS_XN2REF',
  'EPIRUS_XN2SCRIPTS', 'EPIRUS_XN2W'
];
/* v1.5.187：**大雷连带收益权重**（`evo.js` 的 `BIGT_CHAIN_W`，DS 交接 §2b 的唯一待做）走 econ 族，
 * 而它的 env 名按 D77 只许出现在 `server/econ-env.mjs` ⇒ 这里**不写字面量**，
 * 而是从单一来源**反推**："喂一个 econ env 名 ⇒ `readEconEnv` 读出哪个奖励键"，与本 CLI 真正下发的那一个对上，
 * 才算"本工具认识它"（不是暗键）。派生而非抄名单 = 少一处"两处各写一遍"。 */
/** v1.5.254（用户 GO · 千问 §E59 NEXT 第 6 条）：把 **econ 族**里治"花掉"那一半的 5 个旋钮接上 CLI。
 * 病：`beadW / bigcardW / stockBonus / hoardOnLeftover / convRatio` 只走 server/worker，
 *   而本工具不 dispatch 这些键 ⇒ **CLI 传进去静默 `exit 6`**（千问要治闭环的"花"那一半时被卡在这里）。
 * ⚠️ 这里**只写奖励键名**、不写 env 字面量：下面的 `extendSelfWithCliEcon()` 会按 D77 的单一来源反推出 env 名。 */
const CLI_ECON_REWARD_KEYS = ['bigtChainW', 'fitTailW', 'fitTailQ',
  'beadW', 'bigcardW', 'stockBonus', 'hoardOnLeftover', 'convRatio',
  'costlyW', 'fitCal',   /* v1.5.260（用户 GO"做 B+"）：贵卡预算权重（默认 0 ⇒ 行为逐字不变；见 js/train/evo.js 的 costlyBonus） */
  /* v1.5.274（§E91）：补 `ringW` —— 它在 `ECON_REWARD_KEYS`（引擎）与 `ECON_ENV_KEYS`（env 名单）里都齐，
   * 唯独这个入口的投递名单没有 ⇒ `EPIRUS_RING_W` 被黑键闸拦下（实测：整臂 exit 6，一秒响）。
   * 这正是 D172 立的"三处名单齐全"规矩的第三处；不设这个键时 `readEconEnv` 给 null ⇒ 不进 payload ⇒ 出厂行为逐字不变。 */
  'ringW'];
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
  entry: 'tools/train-3p.mjs',
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
    const r = readKeysOf({ entry: 'tools/train-3p.mjs', extraReadKeys: SELF_ENV_KEYS });
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
/* ===== v1.5.277（qoder 09-28 夜班 §E114 · 默认 0 ⇒ 行为逐字不变）：**把起点也放进终局重验的候选池** =====
 * 动因（§E113 补，实测）：今晚 9 支接力臂的名人堂逐席与现役比 —— **7 支的 6 席里没有一席是起点**
 *   （只有 λ0.30+costlyW 那两支占了 1~2 席，而那两支恰好把起点选成了产物）。
 * ⇒ 结构缺口：**接力交出的包从来没跟现役比过**。"训练成功出货"与"这粒比现役强"是两个互不蕴含的命题，
 *   这正是档案里"臂产物从来没上过槽"的机制形状（不是"门不够严"，是**候选池里没有参照**）。
 * 开关语义：终局重验之前，若起点不在名人堂里就**追加**成一粒候选（`fit=null` ⇒ 只标"起点"，不参与任何打分）。
 *   不改训练评分、不改 `fit`、不动种群、不改 promote 的五道门 —— 它只让"最后一次选人"看得见起点。
 * ⚠ 这不是判据变更，但它**会改变交出去的那一粒** ⇒ 属训练侧配方：先实测（§E114 两 seed），再提请用户裁定，不默认开。 */
const HALL_SEED = Number(process.env.EPIRUS_HALL_SEED || 0) > 0 ? 1 : 0;
/* v1.5.170（qoder §N29 · 默认 0 ⇒ 行为逐字不变）：**广度准入线**（不是排序键）。
 * 判据 = `mirrorHealth(SEL_LAND_GAMES, N, 'multi')` 的净 `effSkillsLand ≥ 本值` **且** `landedKeys ≥ 2`。
 * 标定（`mirrorHealth(20,5,'multi')` 实测）：现役 `2.66（3 种）` · 2P 槽 `2.98（3 种）` · §N28 三粒塌缩冠军 `1.00~1.24` · 最宽那粒 `1.75（3 种）`
 * ⇒ 线画在 1.5 只砍"塌成一种卡"，不砍"宽但兑现率低"。默认关，开了必须自己说剔了几粒。 */
const BREADTH_FLOOR = Number(process.env.EPIRUS_BREADTH_FLOOR || 0);
let BREADTH_LOG = null, BREADTH_ALL_NARROW = false;
/* ===== v1.5.265b（qoder 09-28 夜班 §E66 · 默认 0 ⇒ 行为逐字不变）：**载重优点 veto** =====
 * 动因（同批 12 支臂实测，见 `RESEARCH-LOG-2026-09-28-qoder.md` §E66）：从现役接力 1200 代，
 * 五粒里 **4 粒把"载重卡"打没了**（电磁炮 2.23→0~0.08 次/局、蓄能 3.83→0、最大 ep 93→2~18），
 * 5P 产品口径三粒全部低于现役（38.7 / 25.0 / 37.1 vs 42.5）⇒ **"接着练"目前是退化路径**。
 * 为什么不是"加权重"：本仓已五次否证（`WIDTH_W` 推向乱打 / `BLOCK_W` 推向龟 / `CLEAR_W` 与抗只枪单调互斥 /
 * 两臂恢复环实验全否 / `DIV_W=0.6` 选出种类=1）⇒ 走**当选面 veto**（先例 `BREADTH_FLOOR`/`SEL_LAND`）：
 * 不改 `fit`，只在"已经赢过"的候选里剔掉"把起点优点弄丢了"的那几粒。
 * 判据 = 候选的 `mirrorHealth(...).landByKey[卡]` **每局落地量** ≥ 起点（热启动种子包）同口径读数的 `(1 − SEL_KEEP)`；
 * 起点读数**当场用同一次 `mirrorHealth` 量**，不抄数字（09-27 那条"文案抄数字"的同族病）。
 * ⚠ 参照缺失（没热启动 / 该卡起点落地为 0）⇒ **响亮失败**，不许把"判不了"读成"通过"。 */
const SEL_KEEP = Number(process.env.EPIRUS_SEL_KEEP || 0);
const SEL_KEEP_KEYS = String(process.env.EPIRUS_SEL_KEEP_KEYS || 'railgun').split(',')
  .map(function (s) { return s.trim(); }).filter(Boolean);
/* v1.5.265b：**出手口径**的那一维（09-28 实测补）：`landByKey` 只数造成过伤害的卡 ⇒
 * 聚能环/蓄能**天然判不到**，把它们放进 `SEL_KEEP_KEYS` 只会得到"起点为 0、无法判"的点名。
 * ⇒ 分成两个名单：`_KEYS` 按**落地**判，`_CAST_KEYS` 按**成功出手**判（`mirrorHealth.castByKey`，v1.5.266 新增字段）。 */
const SEL_KEEP_CAST_KEYS = String(process.env.EPIRUS_SEL_KEEP_CAST_KEYS || 'ring,charge').split(',')
  .map(function (s) { return s.trim(); }).filter(Boolean);
/* ===== v1.5.326（qoder 10-03 夜班 §E249 · 默认 0 ⇒ 当选者与今天逐字相同）：**同分带内按"贵卡出手"选人** =====
 * 动因（今晚 4 批 47 臂实测）：`EPIRUS_COSTLY_W` 能把名人堂里"会打大雷"的粒从**对照 0/6 抬到 6/6**，
 *   可**当选产物**常常还是 0.000 —— 因为终局重验只按胜负分选人，"会不会打这张卡"不在它看得见之列。
 *   （`SEL_KEEP` 那次**逐位没换人**是同一族的另一半：veto 只能在保住优点的粒里挑，**造不出**保住优点的粒。）
 * ⇒ 这一根**不改 `fit`、不改奖励、不改规则**，只在"胜负分相差不到 `SEL_BIGT` pt 的候选里"挑贵卡出手最多的一粒
 *   —— 也就是**拿 ≤tol pt 的胜负分，换"这粒会打这张卡"**，把"抽签"变成"选人规则"。
 * 用量口径 = `behavior-profile.fieldProfile`（**ε=0 · soft · 5 席同包 · seed0=77000**），与 `SEL_KEEP_CAL=plain` **同一把尺**，
 *   只是 n 与模式可另给（`_GAMES` / `_MODE`，默认 60 · `long` —— 大雷要 5 珠，只有长程够得着）。
 * ⚠ 三条纪律：① 带内**全部用量为 0 ⇒ 不许改判**，并响亮印"带内 0 粒打过 ⇒ 这臂零作用"（防"永不触发的守卫当假绿"）；
 *   ② 必须印 **改判/未改判 + 胜负分差 pt**（排序键不咬 = 没接线，§N12 的原话）；③ 生效值与结果写进 `meta.recipe.selBigT`。 */
const SEL_BIGT = Number(process.env.EPIRUS_SEL_BIGT || 0);
const SEL_BIGT_KEYS = String(process.env.EPIRUS_SEL_BIGT_KEYS || 'bigT,drain').split(',')
  .map(function (s) { return s.trim(); }).filter(Boolean);
const SEL_BIGT_GAMES = Number(process.env.EPIRUS_SEL_BIGT_GAMES || 60);
const SEL_BIGT_MODE = String(process.env.EPIRUS_SEL_BIGT_MODE || 'long');
let SEL_BIGT_LOG = null;
/* v1.5.268（§E75）：载重 veto **两模式都判**（默认 `multi,long`）。
 * 起因：只按 multi 镜判"炮还在不在"，与 long 口径的载重读数**反向**（NCV-71 改判后 炮 2.90→0.90、5P 41.3→39.2）。
 * 每多一个模式 = 每名候选多跑一次 `mirrorHealth`（实测 20 局 ≈ 百毫秒级），**不加对局进 fit**、不改判定，只在当选时多筛一道。 */
const SEL_KEEP_MODES = String(process.env.EPIRUS_SEL_KEEP_MODES || 'multi,long').split(',')
  .map(function (s) { return s.trim(); }).filter(Boolean);
/* v1.5.269（§E77）：veto 的**量具口径**。
 * `mirror` = `mirrorHealth`，用的是**训练口径** chooser（temp 0.35 · ε0.15 硬档）⇒ 它与"这个包上线后会不会真的少打炮"不是同一个分布；
 * `plain`（默认）= `behavior-profile.fieldProfile`，**ε=0 · temp 0.15 · 5 席同包** ⇒ 与我判载重用的那把尺同口径（§E64/§E68 都是它）。
 * 动因（实测）：`NCV-71` 那粒被 multi 镜挑中，训练口径下 `railgun@long` 过线，ε=0 口径只有 **0.97/2.23 = 43%** ⇒ 挑错了。 */
const SEL_KEEP_CAL = String(process.env.EPIRUS_SEL_KEEP_CAL || 'plain').trim();
const SEL_KEEP_PLAIN_GAMES = Number(process.env.EPIRUS_SEL_KEEP_PLAIN_GAMES || 60);
if (SEL_KEEP_CAL !== 'plain' && SEL_KEEP_CAL !== 'mirror') {
  console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP_CAL 只认 plain / mirror，收到：' + JSON.stringify(process.env.EPIRUS_SEL_KEEP_CAL) +
    '（默认走 mirror = 拿训练口径的尺当"上线后会不会退化"的判据，正是 09-28 那次误挑的成因）');
  process.exit(7);
}
if (!(SEL_KEEP_PLAIN_GAMES >= 20)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP_PLAIN_GAMES 至少 20 局（实测 G=20 与 G=60 的炮读数差 0.22/局 ⇒ 再小就是噪声）：收到 ' + SEL_KEEP_PLAIN_GAMES);
  process.exit(7);
}
const BAD_MODE = SEL_KEEP_MODES.filter(function (m) { return m !== 'multi' && m !== 'long'; });
if (BAD_MODE.length) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP_MODES 里有不认识的模式：' + BAD_MODE.join(',') + '（只认 multi / long）');
  process.exit(7);
}
/* v1.5.267（§E73 第 4 条）：**座位对称性**也是一条会随接力退化的优点（现役 5pt 是本仓历史最好，M 组 6~15pt）。
 * 它不是一张卡 ⇒ 不能走"逐卡落地/出手"那两把尺，但 `mirrorHealth` **同一次**就已经回了 `seatSpread` ⇒ 几乎免费。
 * 本值 = 允许比起点**多出**多少 pt（0 表示"不许比起点差"）；起点读不到（`underpowered`）⇒ 点名、不据此剔人。
 * ⚠ 09-28 实测：广度线共用的 `SEL_LAND_GAMES=20` 局里**只有 18 个决胜局** ⇒ 起点自己读出 25~33pt（而 promote 用 100 局读 5pt）
 *   ⇒ 拿那把尺判"对称性退化"是**拿噪声当判据**。所以这一维**单开一次专用量具**（`SEL_KEEP_SEAT_GAMES`，默认 60），
 *   并要求**决胜局数 ≥ `SEL_KEEP_SEAT_MIN`（默认 24）**才参与判定；不够就点名"未判定"，既不剔人也不当通过。 */
const SEL_KEEP_SEAT = process.env.EPIRUS_SEL_KEEP_SEAT == null ? null : Number(process.env.EPIRUS_SEL_KEEP_SEAT);
const SEL_KEEP_SEAT_GAMES = Number(process.env.EPIRUS_SEL_KEEP_SEAT_GAMES || 60);
const SEL_KEEP_SEAT_MIN = Number(process.env.EPIRUS_SEL_KEEP_SEAT_MIN || 24);
if (SEL_KEEP_SEAT !== null && !(SEL_KEEP_SEAT >= 0 && SEL_KEEP_SEAT <= 100)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP_SEAT 必须是 0~100 的pt数（不给 = 关闭这一维）：收到 ' + JSON.stringify(process.env.EPIRUS_SEL_KEEP_SEAT));
  process.exit(7);
}
if (SEL_KEEP_SEAT !== null && !(SEL_KEEP_SEAT_GAMES >= 20 && SEL_KEEP_SEAT_MIN >= 1)) {
  console.error('[train-3p] ⛔ 座位维的量具参数不成立：GAMES=' + SEL_KEEP_SEAT_GAMES + ' MIN=' + SEL_KEEP_SEAT_MIN +
    '（GAMES 至少 20、MIN 至少 1 —— 否则"判得到"是假的）');
  process.exit(7);
}
let SEL_KEEP_LOG = null, SEL_KEEP_UNJUDGED_SEAT = null;
if (!(SEL_KEEP >= 0 && SEL_KEEP <= 1)) {
  console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP 必须是 0~1 的数（0=关）：收到 ' + JSON.stringify(process.env.EPIRUS_SEL_KEEP) +
    ' —— 非数值/越界一律拒，不许 clamp 之后谎称"开过了"');
  process.exit(7);
}
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
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'
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
let SEQ = null;
if (!(SEQ_W >= 0 && SEQ_W <= 10)) {
  console.error('[train-3p] ⛔ EPIRUS_SEQ_W=' + process.env.EPIRUS_SEQ_W + ' 不是合法档（只认 0~10 的数字，0=关）');
  process.exit(6);
}
if (SEQ_W > 0) {
  SEQ = makeSeqReward(sb.window.EpirusRules, SEQ_W);
  /* 关键：把 SEQ 挂成**沙箱全局** —— `patchEvoChooser` 插进 evo.js 的包装层读的就是 `__SEQ`。 */
  sb.__SEQ = SEQ;
  sb.window.EpirusTrainer.policyChooserN = SEQ.wrapChooserFactory(sb.window.EpirusTrainer.policyChooserN);
  console.log('[序列奖励] EPIRUS_SEQ_W=' + SEQ_W + ' ⇒ **在内存里**给"蓄能[电珠] → 下一回合电磁炮"每次完成 +' + SEQ_W +
    ' ep（仓库文件一字不动 ⇒ 规则指纹不变；本臂产物**不是**现状规则下的冠军，`meta.recipe.env` 会记下）');
  /* v1.5.229：收尾必须印**实际付了多少** —— 否则"奖励没效果"分不清是"代际太短"还是"训练场里这个事件根本不发生"
   * （后者意味着奖励永远付不出去，梯度为零 ⇒ 与击杀奖励"付得太少"同族，但更极端）。 */
  process.on('exit', function () {
    console.log('[序列奖励·结账] 本臂共发放 ' + SEQ.events + ' 次 · ' + SEQ.paid + ' ep（分母：充到电珠 ' + SEQ.charges +
      ' 次 · 首次第 ' + SEQ.firstCharge + ' 回合 · 首次付款第 ' + SEQ.firstPayRound + ' 回合；每股 ' + (SEQ.events / Math.max(1, GENS * GAMES * POP)).toFixed(4) + ' 次）' +
      (SEQ.charges === 0 ? '  ⛔ **训练场里连一次电珠都没充过** ⇒ 不是奖励的问题，是课程/热启动的问题' : (SEQ.events === 0 ? '  ⛔ 充了珠但一次没转化 ⇒ 奖励付不出去' : '')));
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
// setRng must run AFTER the engine is loaded.
// I first put it before the vm.runInNewContext loop -> crashed with
// Cannot read properties of undefined (reading 'setRng'),
// which silently turned my "same sha twice" check into a VACUOUS one
// (it was re-reading an unchanged file).
__seedSandbox(sb, __SEED);   // 必须在引擎加载之后（vm 上下文可能不反映加载前的属性替换）
if (P.setRng && sb.window.EpirusTrainer.mulberry32) P.setRng(sb.window.EpirusTrainer.mulberry32(__SEED * 7919 + 13));

const Bots = sb.window.EpirusBots;
const T = sb.window.EpirusTrainer;

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
}

/* ===== v1.5.160（qoder §N13 · 用户 09-22 裁定"场B 缺口走对手池"）：收割席注入 `EPIRUS_KILL_FIELD` =====
 * 与 v1.5.159 那条已删的 passiveField 接线的**关键区别**：这条带**开火计数**（跑完必须报"注了几局 / 覆盖几个受评座位"，
 * 一局未注 ⇒ `exit 8`）。§N11 的教训就是"横幅读回 0.34 ✓ 而作用点 0 局"烧掉两臂 ⇒ 横幅只能证明**变量**到位，
 * 证明不了**效果**发生。语义与三条设计约束见 `js/train/evo.js` 的 `killSeatFor` 注释。 */
let KILL_REQ = 0, SEL_LAND_LOG = null, KILL_REC = null, TRAIN_MODE_REQ = null, BIGT_CHAIN_REQ = 0;   // 兑现广度当选的账（写进 meta，事后能查这臂到底改没改判）
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
   * 为什么值得开这一格（实测在 `docs/RESEARCH-LOG-2026-09-26-qoder-night.md` §E28a）：适应度与五道门全在 ε=0，
   *   产品跑 ε=0.2 soft，而"按 `dmg/局` 排的 Spearman ρ(0 vs 0.2) = 0.480、随剂量单调" ⇒ **口径在换答案**。
   * 为什么这一段必须长这样（同 `KILL_FIELD`/示范族那一族的教训：横幅读回证明不了作用点发生）：
   *   "env 传进去没生效"是最容易犯的错（setter 名打错、eps 被 `|| 0` 吞、只接了 CLI 没接服务端……）
   *   ⇒ 三条硬规矩：**没有 setter 就 exit 7**（拒静默空转）· 下令后**读回消费点** · 退出前印**开火计数**，
   *     `eps>0 而一次决策都没经过漏斗` ⇒ `exitCode=8`（空枪，与 D123 同规矩）。 */
  {
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
    /* v1.5.189：退火窗口没开 ⇒ β≡0 ⇒ 覆盖永不触发（DS §N12 那个"空枪臂"的形状）⇒ 归因也就无从谈起。 */
    if (IMIT_ON && typeof T.imitBetaForGen === 'function' && !(Number(T.imitBetaForGen(0)) > 0)) IMIT_ON = false;
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

/* ===== v1.5.172（qoder §N35）：把**判它的那张桌子**搬进训练（`EPIRUS_COUNTER_OPPS=1`，默认关）=====
 * 病（`v7xn22a` 实测，不是猜）：那条 400 代大配方终于长出了"兑现广度"（各格净 `G(落地) 3.5~3.9`、4 种真卡打上血，
 * 现役只有 2.2~2.7），结果 `promote --dry` 把它砍在**行为门**上 ——
 * `G4 无一行脚本能以 >60% 击败它`：最克它的就是「只防御(不还手)」（85%）与「只枪 1ジ压制」（82%）。
 * 而这两个原型**根本不在训练桌上**：`OPPS` 里最接近的 `defend` 是"会还手的防御"，`guardSpam`（纯不还手）
 * 在 `EpirusBots` 里早就有、只是没人用它当对手 ⇒ **判它的对手从不出现，适应力当然学不出来**。
 * 与 `EPIRUS_XN2REF=exam`（v1.5.150）同一条设计：**对着产品判据本身训 ⇒ 目标与验收一致**。
 * 默认关 ⇒ `OPPS` 逐字不变 ⇒ 历史臂仍可逐位复现。 */
const COUNTER_OPPS = Number(process.env.EPIRUS_COUNTER_OPPS || 0) > 0 ? [
  { name: 'cnt:guardSpam', sel: Bots.pickGuardSpam },     // = gate-drafts 的「只防御(不还手)」
  { name: 'cnt:gunSpam', sel: Bots.pickGunSpam },         // ≈「只枪(1ジ压制)」
  { name: 'cnt:snipeSpam', sel: Bots.pickSnipeSpam }      // ≈「只狙击」
] : [];
if (COUNTER_OPPS.length) {
  for (const o of COUNTER_OPPS) {
    if (typeof o.sel !== 'function') {
      console.error('[train-3p] ⛔ EPIRUS_COUNTER_OPPS 要的对手在 EpirusBots 里不存在：' + o.name + ' ⇒ 拒绝静默少放对手（少一个就是一根空枪）');
      process.exit(4);
    }
    OPPS.push(o);
  }
  console.log('[counter-ops] 判据原型已进训练桌：' + COUNTER_OPPS.map(function (o) { return o.name; }).join(',') +
    ' ⇒ OPPS 从 9 个变 ' + OPPS.length + ' 个（fitness 现在能看见"只防御不还手"这一克）');
}

/* ===== §E127（v1.5.285 · Qoder 通宵班）：把 `ringspam` 放上训练桌（`EPIRUS_RING_OPPS=1`，默认关）=====
 * 病（DS 清单第 4 条的前提，本班修正过）：`ringspam` 在 `server/opp-pool.mjs:42` 的 `OPP_SPECS` 里，
 *   但**不在本文件运行时的 9 条 `OPPS` 里** ⇒ 训练桌上没人施放聚能环 ⇒ `ringW`（出厂 0.10，权重量级最大的一根）
 *   在常见桌上从不发声（§E96/§E104：单位级 0/9 不变、臂级 0/5689 维不同）。
 * ⚠ 但**"死项"不等于"可摘"**：§E99 已被 N=5 推翻过一次（极罕见，可一发声就重 roll 整条轨迹）。
 *   ⇒ 所以这里不摘、不改权重，只补一个**第三选项**的证据：让会放环的对手真上桌，然后看 `ringW` 开不开口。
 * 判法用现成的常驻尺（不新造）：产物跑 `tools/probe-dead-term.mjs --key=ringW` ⇒ 0/9 = 上桌也没梯度；>0 = 梯度回来了。
 * 纪律与 `EPIRUS_COUNTER_OPPS` 逐字同形：默认关 ⇒ `OPPS` 一字不变 ⇒ 历史臂仍可逐位复现；要的对手不存在 ⇒ `exit 4`（少一个就是一根空枪）。 */
const RING_OPPS = Number(process.env.EPIRUS_RING_OPPS || 0) > 0 ? [
  { name: 'cnt:ringSpam', sel: Bots.pickRingSpam },   // 会施放聚能环的对手（训练桌此前没有这一型）
] : [];
if (RING_OPPS.length) {
  for (const o of RING_OPPS) {
    if (typeof o.sel !== 'function') {
      console.error('[train-3p] ⛔ EPIRUS_RING_OPPS 要的对手在 EpirusBots 里不存在：' + o.name + ' ⇒ 拒绝静默少放对手');
      process.exit(4);
    }
    OPPS.push(o);
  }
  console.log('[ring-ops] 会放环的对手已进训练桌：' + RING_OPPS.map(function (o) { return o.name; }).join(',') +
    ' ⇒ OPPS 从 9 个变 ' + OPPS.length + ' 个（判据：产物跑 probe-dead-term --key=ringW 看 0/9 有没有变）');
}

/* ===== §E236（v1.5.325 · qoder 10-02 夜班）：**把"会攒并且真兑现"的对手放上训练桌** `EPIRUS_ECON_OPPS` =====
 * 病（读出来的，不是猜的）：训练时那 9 条 `OPPS`（上面那份表）里**没有 `deepsaver`**——
 *   `farmer` 只攒不还手、`heavyfire` 会还手但 ep≤2（贵卡分支永不触发），
 *   而**能攒到 5 珠并真把它花出去**的脚本只活在**考卷**里（`eval-5p` 的池子明确含 deepsaver，见其文件头）。
 *   ⇒ 训练世界里"攒钱"从来没有回报来源，也从来没有威胁来源 —— 这正是 DS 交接 §3 那个 (W) 分叉的**可执行版本**：
 *   要么"攒到 5"在这个分布里本来就不划算（那是对手分布问题，不该拿奖励硬拧），要么划算（那奖励侧才有意义）。
 * 口径：`EPIRUS_ECON_OPPS=deepsaver` ‖ `=deepsaver,deadlineBurst`（逗号分隔，名字在下面这张表里）；
 *   ⚠️ **不写死 1/2 档**：档名会把"加了谁"埋进数字里，而今晚要问的正是"是哪一型对手在施压"。
 * 纪律与 `EPIRUS_COUNTER_OPPS`/`EPIRUS_RING_OPPS` 逐字同形：
 *   默认关 ⇒ `OPPS` 一字不变（历史臂仍可逐位复现）；名字不在表里 ⇒ **`exit 4` 点名**（少一个就是一根空枪）。 */
const ECON_OPP_TABLE = {
  deepsaver: { name: 'econ:deepSaver', sel: Bots.pickDeepSaver },         // 会攒 + 会放大雷（考卷里那枚深经济对手）
  deadlineBurst: { name: 'econ:deadlineBurst', sel: Bots.pickDeadlineBurst }, // 攒到第 ECON_B(=6) 回合全额兑现
  earlyPressure: { name: 'econ:earlyPressure', sel: Bots.pickEarlyPressure }   // 从第 1 回合就全额兑现（与上一枚只差"第几回合花"）
};
const ECON_OPPS = String(process.env.EPIRUS_ECON_OPPS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  .map(function (nm) {
    const o = ECON_OPP_TABLE[nm];
    if (!o) {
      console.error('[train-3p] ⛔ EPIRUS_ECON_OPPS 里有不认识的名字：' + nm +
        '（合法的是 ' + Object.keys(ECON_OPP_TABLE).join(',') + '）⇒ 拒绝静默少放对手');
      process.exit(4);
    }
    if (typeof o.sel !== 'function') {
      console.error('[train-3p] ⛔ ' + o.name + ' 在 EpirusBots 里不是一个函数 ⇒ 拒绝静默空转');
      process.exit(4);
    }
    return o;
  });
if (ECON_OPPS.length) {
  for (const o of ECON_OPPS) OPPS.push(o);
  console.log('[econ-ops] "会攒并且真兑现"的对手已进训练桌：' + ECON_OPPS.map(function (o) { return o.name; }).join(',') +
    ' ⇒ OPPS 从 9 个变 ' + OPPS.length + ' 个（判据：产物的**决策时 ep 均值 / 大雷出手**，见日志 §E236 预注册）');
}

/* ===== §E124（v1.5.279 · qoder 0928 下午班）：**整桌同原型** `EPIRUS_OPP_BLOCK` 的下达（默认关）=====
 * 与 `EPIRUS_COUNTER_OPPS` 的区别要说清：那根改的是**名单**（有谁），这根改的是**桌子的形状**
 * （一局的 N−1 席是不是同一个原型）⇒ 后者才让"一局 = 一个环境"第一次成为训练里的对象。
 * 纪律照 §N35/D174：下达后**读回消费点**、不等就 `exit 7`；**没开就一行不印**（"开了没生效"必须看得见）。 */
const OPP_BLOCK_WANT = Number(process.env.EPIRUS_OPP_BLOCK || 0) > 0;
if (OPP_BLOCK_WANT) {
  if (typeof T.setOppTable !== 'function' || typeof T.oppTable !== 'function') {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_OPP_BLOCK 但引擎没有 setOppTable/oppTable ⇒ 拒绝静默空转');
    process.exit(7);
  }
  T.setOppTable({ block: true });
  const got = T.oppTable() || {};
  if (got.block !== true) {
    console.error('[train-3p] ⛔ EPIRUS_OPP_BLOCK=1 读回 ' + JSON.stringify(got.block) + ' ⇒ 没生效，退出（不许跑出"以为开了"的臂）');
    process.exit(7);
  }
  console.log('[opp-block] 训练桌改为**整桌同原型**：每局 N−1 席填同一脚本，原型按 (gen*3+g) 跨局轮换' +
    '（覆盖面/轮换节奏/CRN 一字不动，只改一桌的纯度）⇒ 判据见 §E124 ⑤/⑥');
}

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
/* v1.5.265b：**开 veto 就必须有参照**，而且要在开跑之前查（跑到 1200 代才发现参照缺失 = 白烧十分钟）。
 * 卡名也在这里验：非法名会让那一维"永远判不到" ⇒ 与静默空转同族，直接 `exit 7`。 */
if (SEL_KEEP > 0) {
  if (!seedParams) {
    console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP=' + SEL_KEEP + ' 但本臂**没有热启动种子包**可当参照' +
      '（`EPIRUS_HOTSTART=1` + `EPIRUS_SEEDPACK=<包>`）⇒ 拒绝空转：没有参照的"不劣于起点"是一条恒真判据');
    process.exit(7);
  }
  const Rules0 = sb.window.EpirusRules;
  const bad = SEL_KEEP_KEYS.concat(SEL_KEEP_CAST_KEYS).filter(function (k) { return !(Rules0.byKey && Rules0.byKey[k]); });
  if (bad.length) {
    console.error('[train-3p] ⛔ EPIRUS_SEL_KEEP_KEYS / EPIRUS_SEL_KEEP_CAST_KEYS 里有不认识的卡名：' + bad.join(',') +
      '（合法的是 `EpirusRules.byKey` 的键）⇒ 拒绝按"判不到的维"放行');
    process.exit(7);
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
    const nf3 = function (v) { return v === null || v === undefined ? '未量' : v.toFixed(3); };
    console.log('gen ' + gen + ' bestFit=' + r.fit.toFixed(3) +
      ' 1st=' + (r.firstRate * 100).toFixed(0) + '% top2=' + (r.top2Rate * 100).toFixed(0) +
      '% avgDealt=' + r.avgDealt.toFixed(2) + ' sigma=' + sigma.toFixed(3) +
      (r.anchorDist !== undefined ? ' 距种子=' + r.anchorDist.toFixed(4) : '') +
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
        ' 穿=' + nf3(r.piercePerGame) + ' 珠=' + nf3(r.beadPerGame) + ' 威=' + nf3(r.threatPerGame) +
        ' 场=' + nf3(r.clearPerGame) + ' 挡=' + nf3(r.blockPerGame) + ' 广max=' + (r.varietyMaxEv === null ? '未量' : r.varietyMaxEv)
        : ''));
  }
  /* v1.5.189：归因**逐代**印（不塞进那条 20 代的块里）—— "示范有没有转成原生行为"是随代数变化的问题，
   * 20 代一跳就把"前期靠教师、退火后归零"这条曲线糊成两个点。 */
  if (IMIT_ON) { const attr = attrLine(); if (attr) console.log('  gen ' + gen + ' ' + attr); }
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
let DEGENERATE_ONLY = false;   // §N9：名人堂全退化时置真并写进 meta
console.log('=== 名人堂验证（' + ALL_PAIRS.length + ' 对 x 20 局）===');
/* ===== §N9（qoder 09-22 · xn10b 反例）：当选面退化闸 =====
 * 收割/存活混合梯度能把"纯ジ龟包"推成带内最高 trainFit（奖励的反向捷径），
 * 而本工具的终局当选**过去没有任何退化检查** ⇒ 三处（promote 阻断 / 2P vetoDegenerate / 这里）必须同判据。
 * 口径抄 promote：`densityProfile.zeroAtkRate ≥ 0.9` = 退化（从不出手的局占比）。
 * 全退化时：不静默——产物照写但 meta.degenerateOnlyWinner=true + ⛔ 响亮（下一道 promote 本来也会砍它）。 */
/* v1.5.277（§E114 · 默认关）：起点不在名人堂 ⇒ 追加成终局重验的一粒候选（见文件头 `EPIRUS_HALL_SEED` 的注释）。 */
let HALL_SEED_APPENDED = false;
if (HALL_SEED > 0 && seedParams) {
  if (!hall.some(function (h) { return h.params === seedParams; })) {
    hall.push({ params: seedParams, fit: null });
    HALL_SEED_APPENDED = true;
    console.log('[hall-seed] 起点已追加为终局重验候选（现在 ' + hall.length + ' 席，逐位来自 ' + hotstartFrom + '）');
  } else {
    console.log('[hall-seed] 起点本来就在名人堂里（' + hall.filter(function (h) { return h.params === seedParams; }).length + ' 席）⇒ 不重复追加');
  }
}
const hallEntries = [];
for (const h of hall) {
  const v = T.evalN(h.params, ALL_PAIRS, 20, N, 987654);
  const sc = v.firstRate + 0.5 * v.top2Rate;
  const zr = densityProfile(sb, h.params, 'multi', 12).zeroAtkRate;
  console.log('  trainFit=' + (typeof h.fit === 'number' ? h.fit.toFixed(3) : '起点') + ' -> 1st=' + (v.firstRate * 100).toFixed(1) +
    '% top2=' + (v.top2Rate * 100).toFixed(1) + '% 零攻击局=' + (zr * 100).toFixed(0) + '%');
  hallEntries.push({ ref: h, score: sc, zeroAtkRate: zr, ev: v });
  if (!ev || sc > (ev.firstRate + 0.5 * ev.top2Rate)) { finalParams = h.params; ev = v; }
}
{
  const sel = rejectDegenerateWinners(hallEntries);
  if (sel.dropped) console.log('[退化闸] 剔除 ' + sel.dropped + ' 粒零攻击≥90% 的名人堂成员（与 promote/2P 同判据）');
  /* v1.5.170（§N29）：两把"兑现"口径的闸共用一次 `mirrorHealth`（同一量具测两遍 = 白跑一遍）。
   * 未开任何一个开关 ⇒ 这段一行都不跑 ⇒ 与 v1.5.166 之前的行为逐字相同。 */
  if ((BREADTH_FLOOR > 0 || SEL_LAND > 0 || SEL_KEEP > 0) && sel.clean && sel.clean.length) {
    for (const e of sel.clean) {
      const mh = T.mirrorHealth(e.ref.params, SEL_LAND_GAMES, N, 'multi');
      e.mhByMode = { multi: mh };   // v1.5.268：载重 veto 需要 long 口径时复用，不重复跑 multi
      e.landG = mh.effSkillsLand || 0; e.landedKeys = mh.landedKeys || 0; e.castG = mh.effSkills || 0;
      e.landByKey = mh.landByKey || {}; e.mhGames = SEL_LAND_GAMES;   // v1.5.265b：veto 吃逐卡落地量
      e.castByKey = mh.castByKey || {};                                //          与**出手量**（环/蓄能不打血）
      /* v1.5.267：座位维用**专用量具**（共用 20 局只有 ~18 个决胜局 ⇒ 噪声当判据）。只在开了这一维时才多跑一次。 */
      if (SEL_KEEP_SEAT !== null) {
        const mhS = T.mirrorHealth(e.ref.params, SEL_KEEP_SEAT_GAMES, N, 'multi');
        e.seatSpread = (typeof mhS.seatSpread === 'number' ? mhS.seatSpread : null);
        e.seatDec = mhS.seatDecisive || 0;
      } else e.seatSpread = (mh.seatSpread === undefined ? null : mh.seatSpread);
      /* v1.5.227（用户裁定换 G）：**塌缩判据 = 最大单卡落地份额**（旧判据"数种类"从来没触发过，见 pick-best 头注）。
       * 与 `landG` 取自**同一次** `mirrorHealth` ⇒ 两个读数天然同一口径、同一批局，不另跑一遍。
       * 归属计算走 `audit-lib.landShareOf`（单一来源：只数真卡名、分母用过滤后的 landedTotal）——
       * ⚠️ 我第一版在这里直接 `max(landByKey)/landedTotal`，而 `landByKey` 含**非卡键**（"终局收缩"…）
       * ⇒ 算出过 44900% 的份额（实测 `v7teach-32`）。 */
      const __ls = landShareOf(sb, mh);
      e.maxLandShare = __ls.share; e.maxLandKey = __ls.key;
      e.conv = (mh.nonJi ? (mh.landedTotal || 0) / mh.nonJi : 0);
      /* 与 promote 的"不可 --force"硬门槛同阈值（`HOLO_GIFT_MAX`，单源）：送盾当主业的候选**不参与**广度换人 */
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
      console.error('⛔ [广度线] 名人堂**全部塌缩**（没有一粒 `最大单卡落地份额 ≤ ' + (nf.collapseLine * 100).toFixed(0) + '% 且 G(落地)≥' + BREADTH_FLOOR + '`）⇒ 产物照写但标 breadthFloorAllNarrow；' +
        '这按预注册是**走向②**（该回去改奖励面，不是继续加排序键），别拿这粒去换包');
    } else { sel.clean = nf.clean; if (nf.best) sel.best = nf.best; }
    BREADTH_LOG = { floor: BREADTH_FLOOR, games: SEL_LAND_GAMES, dropped: nf.dropped, of: sel.clean.length + nf.dropped,
      allNarrow: nf.allRejected, winnerLandG: sel.best ? sel.best.landG : null, winnerKeys: sel.best ? sel.best.landedKeys : null };
  }
  /* ===== v1.5.265b（§E66 · 默认关）：**载重优点 veto**（剔"把起点优点弄丢的粒"，不加任何奖励项） =====
   * 量具与广度线**共用同一次** `mirrorHealth` ⇒ 同一口径、同一批局，不另跑一遍（§N29 的规矩）。
   * 起点参照**当场量**（不抄数字）。判不到的维（起点该卡落地为 0）⇒ 整臂 `exit 7`，不许静默当"通过"。 */
  if (SEL_KEEP > 0 && sel.clean && sel.clean.length && seedParams) {
    /* v1.5.268（§E75 第 3 条）：**两模式都判**。09-28 实测：只按 `multi` 镜的逐卡落地判"炮还在不在"，
     * 与按 `long` 自读的载重读数**反向**（`NCV-71` 改判后 炮 2.90→0.90、5P 41.3%→39.2%）
     * ⇒ 单模式尺当判据会骗人（本仓先例：广度"两个模式都判"，v1.5.145 用户裁定）。 */
    const modes = SEL_KEEP_MODES.length ? SEL_KEEP_MODES : ['multi'];
    const mhOf = function (params, entry, mode) {
      if (entry && entry.mhByMode && entry.mhByMode[mode]) return entry.mhByMode[mode];
      const m = T.mirrorHealth(params, SEL_LAND_GAMES, N, mode);
      if (entry) { entry.mhByMode = entry.mhByMode || {}; entry.mhByMode[mode] = m; }
      return m;
    };
    const usable = [], zeroRef = [];
    /* 口径分派：plain = ε=0 五席同包**出手**计数（两张尺合一，因为这道判据问的是"上线后还按不按"）；
     * mirror = 训练口径的 mirrorHealth（逐卡**落地** + 逐卡**出手**两把尺）。 */
    const plainCache = new Map();
    const plainOf = function (p, mode) {
      let byMode = plainCache.get(p);
      if (!byMode) { byMode = {}; plainCache.set(p, byMode); }
      if (!byMode[mode]) byMode[mode] = fieldProfile(p, 0, 'soft', SEL_KEEP_PLAIN_GAMES, 77000, 'self', mode);
      return byMode[mode];
    };
    const refOf = function (mode, key, src) {
      return SEL_KEEP_CAL === 'plain'
        ? ((plainOf(seedParams, mode).keys[key] || 0) / SEL_KEEP_PLAIN_GAMES)
        : (((src === 'land' ? mhOf(seedParams, null, mode).landByKey : mhOf(seedParams, null, mode).castByKey)[key] || 0) / SEL_LAND_GAMES);
    };
    const srcOf = k => (SEL_KEEP_CAL === 'plain' ? 'act' : k);
    for (const mode of modes) {
      /* 两个名单 = 两把尺：`SEL_KEEP_KEYS` 看**落地**（会造成伤害的卡），`SEL_KEEP_CAST_KEYS` 看**成功出手**（环/蓄能这类不打血的）
       * plain 口径下两者统一成"出手"（`act`），因为 fieldProfile 数的是 chooser 返回的那一手。 */
      for (const k of SEL_KEEP_KEYS) {
        const pg = refOf(mode, k, 'land');
        if (pg > 0) usable.push({ key: k, src: srcOf('land'), cal: SEL_KEEP_CAL, mode: mode, games: SEL_KEEP_CAL === 'plain' ? SEL_KEEP_PLAIN_GAMES : SEL_LAND_GAMES, ref: pg, line: pg * (1 - SEL_KEEP) });
        else zeroRef.push(k + '(' + (SEL_KEEP_CAL === 'plain' ? 'act' : '落地') + '/' + mode + ')');
      }
      for (const k of SEL_KEEP_CAST_KEYS) {
        const pg = refOf(mode, k, 'cast');
        if (pg > 0) usable.push({ key: k, src: srcOf('cast'), cal: SEL_KEEP_CAL, mode: mode, games: SEL_KEEP_CAL === 'plain' ? SEL_KEEP_PLAIN_GAMES : SEL_LAND_GAMES, ref: pg, line: pg * (1 - SEL_KEEP) });
        else zeroRef.push(k + '(' + (SEL_KEEP_CAL === 'plain' ? 'act' : '出手') + '/' + mode + ')');
      }
    }
    const valOf = function (e, u) {
      return u.cal === 'plain'
        ? ((plainOf(e.ref.params, u.mode).keys[u.key] || 0) / SEL_KEEP_PLAIN_GAMES)
        : (((u.src === 'land' ? mhOf(e.ref.params, e, u.mode).landByKey : mhOf(e.ref.params, e, u.mode).castByKey)[u.key] || 0) / SEL_LAND_GAMES);
    };
    if (!usable.length) {
      console.error('[train-3p] ⛔ 起点（' + (hotstartFrom || '热启动种子包') + '）在 ' + modes.join('/') + ' 镜的 ' +
        SEL_KEEP_KEYS.concat(SEL_KEEP_CAST_KEYS).join('/') + ' 上落地与出手**全为 0** ⇒ "不劣于起点"没有参照，' +
        '拒绝按恒真判据空转（可换 --keys / --modes 或加大 EPIRUS_SEL_LAND_GAMES）');
      process.exit(7);
    }
    /* v1.5.267：座位极差是一条"越小越好"的规则 ⇒ 单独走，且用**专用量具**（`SEL_KEEP_SEAT_GAMES` 局）；
     * 决胜局不够 ⇒ 整维点名"未判定"，既不据此剔人也不当通过。 */
    let seatRule = null;
    if (SEL_KEEP_SEAT !== null) {
      const refSeatMh = T.mirrorHealth(seedParams, SEL_KEEP_SEAT_GAMES, N, 'multi');
      if (typeof refSeatMh.seatSpread !== 'number' || (refSeatMh.seatDecisive || 0) < SEL_KEEP_SEAT_MIN) {
        console.log('[载重veto] ⚠ 起点的座位极差**未判定**（' + SEL_KEEP_SEAT_GAMES + ' 局里只有 ' + (refSeatMh.seatDecisive || 0) +
          ' 个决胜局 < 门槛 ' + SEL_KEEP_SEAT_MIN + '）⇒ 这一维不进判据');
        SEL_KEEP_UNJUDGED_SEAT = '起点 underpowered（决胜 ' + (refSeatMh.seatDecisive || 0) + '/' + SEL_KEEP_SEAT_MIN + '）';
      } else {
        seatRule = { line: refSeatMh.seatSpread + SEL_KEEP_SEAT, ref: refSeatMh.seatSpread, tol: SEL_KEEP_SEAT, games: SEL_KEEP_SEAT_GAMES };
      }
    }
    if (seatRule) {
      for (const e of sel.clean) {
        const sMh = T.mirrorHealth(e.ref.params, SEL_KEEP_SEAT_GAMES, N, 'multi');
        e.seatSpread = (typeof sMh.seatSpread === 'number' && (sMh.seatDecisive || 0) >= SEL_KEEP_SEAT_MIN) ? sMh.seatSpread : null;
        e.seatDec = sMh.seatDecisive || 0;
      }
    }
    const mLbl = function (u) { return modes.length > 1 ? '@' + u.mode : ''; };
    const fmt = function (e) {
      return usable.map(function (u) {
        return u.key + (u.src === 'cast' ? '≈' : ' ') + mLbl(u) + ' ' + valOf(e, u).toFixed(2) + '/' + u.ref.toFixed(2);
      }).join('  ') + (seatRule ? ' 座位' + (e.seatSpread === null ? '?' : e.seatSpread.toFixed(0)) + '/' + seatRule.line.toFixed(0) : '');
    };
    console.log('[载重veto] 参照 = 起点逐卡量（口径 ' + SEL_KEEP_CAL +
      (SEL_KEEP_CAL === 'plain' ? ' = ε0·temp0.15·5 席同包**出手**，' + SEL_KEEP_PLAIN_GAMES + ' 局（与 `behavior-profile` 同尺）'
        : ' = mirrorHealth 训练口径（temp0.35·ε0.15 硬档），' + SEL_LAND_GAMES + ' 局，与广度线共用') +
      ' · 模式 ' + modes.join('+') + '；`≈` = 按**出手**判）：' +
      usable.map(function (u) { return u.key + (u.src === 'cast' ? '≈' : '') + mLbl(u) + ' ' + u.ref.toFixed(2) + '/局 → 线 ' + u.line.toFixed(2) + '（容差 ' + (100 * SEL_KEEP).toFixed(0) + '%）'; }).join(' · ') +
      (seatRule ? ' · 座位极差 ' + seatRule.ref.toFixed(1) + 'pt → 线 ≤' + seatRule.line.toFixed(1) + 'pt（容差 +' + seatRule.tol.toFixed(0) + 'pt）' : '') +
      (zeroRef.length ? ' ｜ ⚠ 起点为 0、无法判的维：' + zeroRef.join(',') : '') +
      ' ｜ 广度参照 G(落地)=' + (mhOf(seedParams, null, modes[0]).effSkillsLand || 0).toFixed(2) + '（' + modes[0] + ' 镜）');
    const kept = [], dropped = [];
    for (const e of sel.clean) {
      const fails = usable.filter(function (u) { return valOf(e, u) < u.line; });
      if (seatRule && e.seatSpread !== null && e.seatSpread > seatRule.line) fails.push({ key: '座位', mode: 'seat' });
      if (fails.length) dropped.push({ e: e, why: fails.map(function (f) { return f.key + (modes.length > 1 && f.mode !== 'seat' ? '@' + f.mode : ''); }).join(',') }); else kept.push(e);
    }
    console.log('[载重veto] 候选 ' + sel.clean.length + ' 粒逐卡（本粒/起点）：' +
      sel.clean.map(function (e) { return fmt(e) + (e === sel.best ? '(当选)' : ''); }).join('  '));
    SEL_KEEP_LOG = { tol: SEL_KEEP, modes: modes, cal: SEL_KEEP_CAL,
      games: SEL_KEEP_CAL === 'plain' ? SEL_KEEP_PLAIN_GAMES : SEL_LAND_GAMES,
      keys: usable.map(function (u) { return u.key + ':' + u.src + '@' + u.mode; }),
      ref: usable.map(function (u) { return { key: u.key, src: u.src, mode: u.mode, perGame: Number(u.ref.toFixed(3)), line: Number(u.line.toFixed(3)) }; }),
      unjudgeable: zeroRef, dropped: dropped.length, of: sel.clean.length,
      seat: seatRule ? { ref: Number(seatRule.ref.toFixed(2)), line: Number(seatRule.line.toFixed(2)), tol: SEL_KEEP_SEAT, games: seatRule.games }
        : (SEL_KEEP_SEAT !== null ? { requested: SEL_KEEP_SEAT, games: SEL_KEEP_SEAT_GAMES, unjudgeable: SEL_KEEP_UNJUDGED_SEAT || '起点 underpowered' } : null),
      droppedDetail: dropped.map(function (d) { return { score: Number(d.e.score.toFixed(4)), why: d.why }; }),
      allRejected: false, changedWinner: false, winnerKept: false };
    if (!kept.length) {
      SEL_KEEP_LOG.allRejected = true;
      console.error('[载重veto] ⛔ 名人堂**全部**丢了起点载重卡 ⇒ 产物照写并标 selKeepAllDropped；' +
        '这按预注册是**走向②**（接力本身在丢优点，该回去改训练场/谱系，不是继续加 veto），别拿这粒去换包');
    } else {
      let best = kept[0];
      for (const e of kept) if (e.score > best.score) best = e;
      SEL_KEEP_LOG.changedWinner = best !== sel.best;
      SEL_KEEP_LOG.winnerKept = SEL_KEEP_LOG.changedWinner;
      console.log('[载重veto] 剔 ' + dropped.length + '/' + sel.clean.length + ' 粒（丢了 ' +
        dropped.map(function (d) { return d.why; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('/') + '）' +
        (SEL_KEEP_LOG.changedWinner ? ' ⇒ **改判**：换成 ' + fmt(best) + ' 的粒（胜负分差 ' +
          ((best.score - sel.best.score) * 100).toFixed(1) + 'pt，veto 换人本来就是拿胜负分换优点）'
          : ' ⇒ 未改判（原当选者本来就达标）'));
      sel.clean = kept; sel.best = best;
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
  if (sel.best) { finalParams = sel.best.ref.params; ev = sel.best.ev; }
  else if (hallEntries.length) {
    DEGENERATE_ONLY = true;
    console.error('⛔ [退化闸] 名人堂**全部退化**——产物仍写盘但标 degenerateOnlyWinner；promote 会拒收，别拿它换包');
  }
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

/* ===== 带内候选落盘（v1.5.150 · 移植自 `tools/train-best.mjs` 的 band-save）=====
 * 病：本工具的终局是"名人堂里用新种子重验、只取最优"，**其余候选全被丢掉** ⇒ 一旦重验选中热启动点，
 *     整臂的工作就没了（`v7xn1-31.bak` 与现役**逐字节相同**就是这么来的：候选连看都看不到）。
 * 改法：hall 里每一粒都写 `docs/artifacts/<ARM>-band<k>.bak`（ARM = `EPIRUS_ARM` 或输出名去掉扩展名），
 *     并把 `xn2*` 口径写进 meta（谁跑的、什么权重、对谁打 2P —— 产物要能自证来历）。
 * 只写盘、不改当选判定；失败不影响当选者写盘。 */
try {
  const ARM = process.env.EPIRUS_ARM || OUT_PATH.replace(/^.*[\\/]/, '').replace(/\.js$/, '');
  const BAND_DIR = process.env.EPIRUS_BAND_DIR || 'docs/artifacts';   // 可指向临时目录 ⇒ 门 D116 能行为式测它而**不欠 D82 的账**
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
    /* v1.5.277：`EPIRUS_HALL_SEED` 追加的那一席（`fit === null`）**不写候选文件** —— 它就是线上包本身，
     * 落一份带内候选只会让下一班以为"训练挖出了一粒 = 现役的粒"。 */
    if (hh.fit === null) { console.log('[band-save] 第 ' + (bi + 1) + ' 席 = 追加的起点 ⇒ 不另存（线上包本来就在仓里）'); continue; }
    const dupWinner = hh.params === bestParams && bi !== selFirst;
    const bmeta = {
      source: 'tools/train-3p.mjs (band-save)', arm: ARM, bandIdx: bi, trainFit: hh.fit,
      xn2w: XN2W || 0, xn2g: XN2G, xn2refs: (XN2W > 0 ? XN2REF_PATHS : []),
      n: N, gens: GENS, games: GAMES, pop: POP, seed: __SEED,
      selected: hh.params === bestParams && bi === selFirst,
      dupOfBand: (dupWinner ? selFirst + 1 : null),   // 与第几席是同一粒权重（null = 不重复）
      ts: new Date().toISOString(),
      /* v1.5.226：band 也要能自证来历 —— 原先只有 arm/gens/seed 这些手写字段，**没有旋钮配方**。 */
      recipe: { env: EFFECTIVE_ENV, envKeys: Object.keys(EFFECTIVE_ENV).length }
    };
    writeFileSync(BAND_DIR + '/' + ARM + '-band' + (bi + 1) + '.bak',
      '/* band-save ' + ARM + '-band' + (bi + 1) + '（tools/train-3p.mjs v1.5.150 起） */\n' +
      'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(bmeta) + ';\n' +
      'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(hh.params)) + ';\n');
    console.log('[band-save] ' + ARM + '-band' + (bi + 1) + '.bak  trainFit=' + hh.fit.toFixed(3) +
      (bmeta.selected ? '（当选）' : (dupWinner ? '（与 band' + bmeta.dupOfBand + ' 同一粒权重）' : '')));
  }
} catch (e) { console.log('[band-save] 失败（不影响当选者写盘）：' + e.message); }
console.log('\n=== ' + N + ' 人实测（最终冠军，28 对 × 20 局，座位轮换，temp0.15）===');
console.log('1st=' + (ev.firstRate * 100).toFixed(1) + '%  top2=' + (ev.top2Rate * 100).toFixed(1) +
  '%   (1st/2nd/3rd = ' + ev.first + '/' + ev.second + '/' + ev.third + ' of ' + ev.games + ')');
console.log('耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

const pack = P.pack(bestParams);
const meta = {
  selLand: SEL_LAND_LOG,
  selKeep: SEL_KEEP_LOG,   // v1.5.265b（§E66）：载重 veto 的账（参照/线/剔了谁/改没改判）—— 事后能从产物自证
  /* v1.5.169：产物自带配方。§N11 的教训是"读日志才知道这臂开了什么"，而日志会滚走、`.bak` 会留下来——
   * 于是事后复盘（和 DS 那边跑对照）只能靠文件名猜。把**下达值 + 开火计数**一起写进 meta，
   * 让每一粒产物能自证"我当时是在什么分布下选出来的"。只加字段，不改任何判定。 */
  recipe: { arm: (process.env.EPIRUS_ARM || null), seed: __SEED, gens: GENS, games: GAMES, pop: POP,
    ringOpps: (RING_OPPS.length ? { on: true, poolSize: OPPS.length } : null),   // §E127：上桌了才记，没上桌一行都不留
    oppBlock: (typeof T.oppTable === 'function' ? T.oppTable() : null),   // §E124：桌形 + 开火计数（下达值不够，要看真发生了多少局）
    xn2w: XN2W, xn2g: XN2G, selLand: SEL_LAND, selLandGames: SEL_LAND_GAMES, selLandTol: SEL_LAND_TOL,
    selKeep: SEL_KEEP, selKeepKeys: (SEL_KEEP > 0 ? SEL_KEEP_KEYS : null),
    /* v1.5.326 §E249：这根排序键**有没有真的换人**必须写在产物里（`{changedWinner, zeroDose, usage…}`）。
     * 关档 ⇒ `null`（一行都不跑，与历史臂逐字相同）。`zeroDose:true` 那一臂**不许**被读成"测过且无效"。 */
    selBigT: SEL_BIGT_LOG,
    selKeepCastKeys: (SEL_KEEP > 0 ? SEL_KEEP_CAST_KEYS : null),   // v1.5.266：出手口径名单（环/蓄能不打血）
    kill: KILL_REC, trainMode: TRAIN_MODE_REQ, trainModeEffective: (typeof T.trainMode === 'function' ? T.trainMode() : null),
    counterOpps: COUNTER_OPPS.map(function (o) { return o.name; }),   // v1.5.172：这臂的训练桌上放了哪几个判据原型
    /* v1.5.325 §E237：这臂的训练桌上有没有"会攒并且真兑现"的深经济对手（默认关 ⇒ `null`，产物自证）。
     * ⚠️ 与 `counterOpps` 分开写是故意的：那三个是**行为门原型**（判"被龟壳打死"），这三个是**经济威胁**（判"攒钱值不值"）。 */
    econOpps: (ECON_OPPS.length ? ECON_OPPS.map(function (o) { return o.name; }) : null),
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
  hallSeedReq: HALL_SEED, hallSeedAppended: HALL_SEED_APPENDED,   // v1.5.277 §E114：重验池有没有被补进起点
  source: 'tools/train-3p.mjs', n: N, gens: GENS, games: GAMES, pop: POP,
  ts: new Date().toISOString(), firstRate: ev.firstRate, top2Rate: ev.top2Rate
};
writeFileSync(OUT_PATH,
  '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 tools/train-3p.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
console.log('\n\u5df2\u5199\u5165 ' + OUT_PATH + '  (coldStart=' + (!seedParams) + ', seed=' + __SEED + ')' +
  (PRODUCT_IS_SEED ? '  ⚠ 产物与起点逐位相同（本臂零改包）' : ''));
