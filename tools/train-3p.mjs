/* Epirus 多人自对战训练器（N19）：名次适应度 + 座位轮换 + 多对手池
 * 用法：node tools/train-3p.mjs [代=200] [人数=3] [每代评估局数=8] [种群=12]
 * 产出：js/bundled-champion-3p.js（window.EPIRUS_CHAMPION_3P）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { P2_FNAME } from './p2-baselines.mjs';   // 2P 考卷基准的单一来源（v1.5.150：`EPIRUS_XN2REF=exam` 用它）
import { densityProfile } from './audit-lib.mjs';   // §N9 退化闸的口径源（与 promote 同一个 zeroAtkRate）
import { ECON_ENV_KEYS } from '../server/econ-env.mjs';   // v1.5.155 黑键侦测：server 下发族名单（单一来源）
import { FIGHT_ENV_KEYS } from '../server/fight-env.mjs';
import { readTrainEnv, hasTrainOverride, REMOVED_TRAIN_KEYS } from '../server/train-env.mjs';   // v1.5.159：训练分布旋钮（与 econ/fight 同构的单一来源）
import { rejectDegenerateWinners, bandPickByLand, rejectNarrowWinners } from './pick-best.mjs';
import { HOLO_GIFT_MAX } from './audit-lib.mjs';   // v1.5.168：送盾阈值与 promote 同源（当选面预筛要用）   // §N9 当选面退化闸（纯函数，门 D121 直接喂合成表）· §N24 兑现广度同分带排序

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
  'EPIRUS_BREADTH_FLOOR',   // v1.5.170：广度准入线（§N29，默认关；`SEL_LAND_GAMES` 是它共用的量具局数）
  'EPIRUS_COUNTER_OPPS',    // v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关）
  'EPIRUS_KILL_FIELD',   // v1.5.160：收割席注入（qoder §N13 · 用户裁定"场B 缺口走对手池"）⇒ 带**开火计数**才敢算"已下达"
  'EPIRUS_TRAIN_MODE',   // v1.5.169：训练模式（§N28 · 用户"炼一个 5 血长程通吃其他模式"）⇒ 认不了就 exit 7，不许静默退回 multi
  'EPIRUS_PUBLISH', 'EPIRUS_SEED', 'EPIRUS_SEEDPACK', 'EPIRUS_XN2G', 'EPIRUS_XN2REF',
  'EPIRUS_XN2SCRIPTS', 'EPIRUS_XN2W'
];
/* 名单 = server 下发族（单一来源：`server/econ-env.mjs` / `fight-env.mjs`）+ `js/` 里"加载时字面读"的死键。
 * ⚠️ 只盯**这份名单**，不是"任何 EPIRUS_*"——否则用户 shell 里随便一个旧旋钮（如 `EPIRUS_NO_PROXY`）
 *    就会让所有 np-test 迷你臂 exit 6（那是误伤，不是本项要治的病）。
 * v1.5.163：`EPIRUS_PASSIVE_FIELD` **已整族删除** ⇒ 不再走这条暗键判定，改由上面的 `detectRemovedKnobs` 专判（传了就 exit 6，见 CHANGELOG）。 */
const ENGINE_SIDE_KEYS = ECON_ENV_KEYS.concat(FIGHT_ENV_KEYS);
/* v1.5.163：**删掉的键也要响亮拒绝** —— 静默忽略等于把"传了等于没传"这个病换个形态留下
 * （`EPIRUS_PASSIVE_FIELD` 就是这么白跑过两臂的）。清单是单一来源：`server/train-env.mjs` 的 `REMOVED_TRAIN_KEYS`。 */
(function detectRemovedKnobs() {
  const gone = Object.keys(REMOVED_TRAIN_KEYS).filter(function (k) { return process.env[k] !== undefined; });
  if (!gone.length || process.env.EPIRUS_ALLOW_DARK === '1') return;
  for (const k of gone) console.error('[train-3p] ⛔ ' + k + ' 已被删除 —— ' + REMOVED_TRAIN_KEYS[k]);
  console.error('  · 想真做收割压力请用 `EPIRUS_KILL_FIELD`（v1.5.160，带开火计数 + 门 D123）；');
  console.error('  · 只是环境里残留这个变量 ⇒ `EPIRUS_ALLOW_DARK=1` 放行。');
  process.exit(6);
})();
(function detectDarkKnobs() {
  const dark = ENGINE_SIDE_KEYS.filter(function (k) {
    return process.env[k] !== undefined && SELF_ENV_KEYS.indexOf(k) < 0;
  }).sort();
  if (!dark.length || process.env.EPIRUS_ALLOW_DARK === '1') return;
  console.error('[train-3p] ⛔ 检测到本工具**读不到的旋钮**（CLI 黑键，传了等于没传）：' + dark.join(', '));
  console.error('  · 本工具闭集：' + SELF_ENV_KEYS.join(', '));
  console.error('  · 这一类旋钮要么走 server 路径（`tools/ring2-run.mjs`：econ-env/fight-env 下发），');
  console.error('    要么根本读不到（`js/` 里加载时读 `process.env`，而 vm 沙箱**没有 `process`** ⇒ 永远是默认值）。');
  console.error('  · 有意要传（例如只想透传给别处）请显式 `EPIRUS_ALLOW_DARK=1`。');
  process.exit(6);
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
let BREADTH_LOG = null, BREADTH_ALL_NARROW = false;
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

/* ===== v1.5.160（qoder §N13 · 用户 09-22 裁定"场B 缺口走对手池"）：收割席注入 `EPIRUS_KILL_FIELD` =====
 * 与 v1.5.159 那条已删的 passiveField 接线的**关键区别**：这条带**开火计数**（跑完必须报"注了几局 / 覆盖几个受评座位"，
 * 一局未注 ⇒ `exit 8`）。§N11 的教训就是"横幅读回 0.34 ✓ 而作用点 0 局"烧掉两臂 ⇒ 横幅只能证明**变量**到位，
 * 证明不了**效果**发生。语义与三条设计约束见 `js/train/evo.js` 的 `killSeatFor` 注释。 */
let KILL_REQ = 0, SEL_LAND_LOG = null, KILL_REC = null, TRAIN_MODE_REQ = null;   // 兑现广度当选的账（写进 meta，事后能查这臂到底改没改判）
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
let DEGENERATE_ONLY = false;   // §N9：名人堂全退化时置真并写进 meta
console.log('=== 名人堂验证（' + ALL_PAIRS.length + ' 对 x 20 局）===');
/* ===== §N9（qoder 09-22 · xn10b 反例）：当选面退化闸 =====
 * 收割/存活混合梯度能把"纯ジ龟包"推成带内最高 trainFit（奖励的反向捷径），
 * 而本工具的终局当选**过去没有任何退化检查** ⇒ 三处（promote 阻断 / 2P vetoDegenerate / 这里）必须同判据。
 * 口径抄 promote：`densityProfile.zeroAtkRate ≥ 0.9` = 退化（从不出手的局占比）。
 * 全退化时：不静默——产物照写但 meta.degenerateOnlyWinner=true + ⛔ 响亮（下一道 promote 本来也会砍它）。 */
const hallEntries = [];
for (const h of hall) {
  const v = T.evalN(h.params, ALL_PAIRS, 20, N, 987654);
  const sc = v.firstRate + 0.5 * v.top2Rate;
  const zr = densityProfile(sb, h.params, 'multi', 12).zeroAtkRate;
  console.log('  trainFit=' + h.fit.toFixed(3) + ' -> 1st=' + (v.firstRate * 100).toFixed(1) +
    '% top2=' + (v.top2Rate * 100).toFixed(1) + '% 零攻击局=' + (zr * 100).toFixed(0) + '%');
  hallEntries.push({ ref: h, score: sc, zeroAtkRate: zr, ev: v });
  if (!ev || sc > (ev.firstRate + 0.5 * ev.top2Rate)) { finalParams = h.params; ev = v; }
}
{
  const sel = rejectDegenerateWinners(hallEntries);
  if (sel.dropped) console.log('[退化闸] 剔除 ' + sel.dropped + ' 粒零攻击≥90% 的名人堂成员（与 promote/2P 同判据）');
  /* v1.5.170（§N29）：两把"兑现"口径的闸共用一次 `mirrorHealth`（同一量具测两遍 = 白跑一遍）。
   * 未开任何一个开关 ⇒ 这段一行都不跑 ⇒ 与 v1.5.166 之前的行为逐字相同。 */
  if ((BREADTH_FLOOR > 0 || SEL_LAND > 0) && sel.clean && sel.clean.length) {
    for (const e of sel.clean) {
      const mh = T.mirrorHealth(e.ref.params, SEL_LAND_GAMES, N, 'multi');
      e.landG = mh.effSkillsLand || 0; e.landedKeys = mh.landedKeys || 0; e.castG = mh.effSkills || 0;
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
    console.log('[广度线] 判据 = 净 `G(落地) ≥ ' + BREADTH_FLOOR + '` 且 `landedKeys ≥ 2`（n=' + SEL_LAND_GAMES + ' 局 multi 镜）· 各粒：' +
      sel.clean.slice().sort(function (a, b) { return b.landG - a.landG; })
        .map(function (e) { return e.landG.toFixed(2) + '(' + e.landedKeys + '种,兑现' + (100 * e.conv).toFixed(0) + '%)'; }).join('  '));
    console.log('[广度线] 剔除 ' + nf.dropped + '/' + sel.clean.length + ' 粒塌缩候选' +
      (nf.best ? ' ⇒ 池内冠军 ' + (nf.best.score === sel.best.score ? '**没换人**' : '**换成 ' + nf.best.landG.toFixed(2) + '(' + nf.best.landedKeys + '种)**') : ''));
    if (nf.allRejected) {
      BREADTH_ALL_NARROW = true;
      console.error('⛔ [广度线] 名人堂**全部塌缩**（没有一粒 `landedKeys≥2 且 G(落地)≥' + BREADTH_FLOOR + '`）⇒ 产物照写但标 breadthFloorAllNarrow；' +
        '这按预注册是**走向②**（该回去改奖励面，不是继续加排序键），别拿这粒去换包');
    } else { sel.clean = nf.clean; if (nf.best) sel.best = nf.best; }
    BREADTH_LOG = { floor: BREADTH_FLOOR, games: SEL_LAND_GAMES, dropped: nf.dropped, of: sel.clean.length + nf.dropped,
      allNarrow: nf.allRejected, winnerLandG: sel.best ? sel.best.landG : null, winnerKeys: sel.best ? sel.best.landedKeys : null };
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
  if (sel.best) { finalParams = sel.best.ref.params; ev = sel.best.ev; }
  else if (hallEntries.length) {
    DEGENERATE_ONLY = true;
    console.error('⛔ [退化闸] 名人堂**全部退化**——产物仍写盘但标 degenerateOnlyWinner；promote 会拒收，别拿它换包');
  }
}
bestParams = finalParams;

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
  selLand: SEL_LAND_LOG,
  /* v1.5.169：产物自带配方。§N11 的教训是"读日志才知道这臂开了什么"，而日志会滚走、`.bak` 会留下来——
   * 于是事后复盘（和 DS 那边跑对照）只能靠文件名猜。把**下达值 + 开火计数**一起写进 meta，
   * 让每一粒产物能自证"我当时是在什么分布下选出来的"。只加字段，不改任何判定。 */
  recipe: { arm: (process.env.EPIRUS_ARM || null), seed: __SEED, gens: GENS, games: GAMES, pop: POP,
    xn2w: XN2W, xn2g: XN2G, selLand: SEL_LAND, selLandGames: SEL_LAND_GAMES, selLandTol: SEL_LAND_TOL,
    kill: KILL_REC, trainMode: TRAIN_MODE_REQ, trainModeEffective: (typeof T.trainMode === 'function' ? T.trainMode() : null),
    counterOpps: COUNTER_OPPS.map(function (o) { return o.name; }),   // v1.5.172：这臂的训练桌上放了哪几个判据原型
    breadthFloor: BREADTH_LOG },
  breadthFloorAllNarrow: BREADTH_ALL_NARROW,   // §N29 走向②的标记：全池塌缩 ⇒ 该改奖励面，不是换排序键
  degenerateOnlyWinner: DEGENERATE_ONLY,   // §N9 退化闸：true=没有合格当选者、promote 会拒收
  source: 'tools/train-3p.mjs', n: N, gens: GENS, games: GAMES, pop: POP,
  ts: new Date().toISOString(), firstRate: ev.firstRate, top2Rate: ev.top2Rate
};
writeFileSync(OUT_PATH,
  '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 tools/train-3p.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
console.log('\n\u5df2\u5199\u5165 ' + OUT_PATH + '  (coldStart=' + (!seedParams) + ', seed=' + __SEED + ')');
