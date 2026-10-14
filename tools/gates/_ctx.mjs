/*#np-ctx-header
{"file":"tools/gates/_ctx.mjs","ranges":[[1,97],[100,107],[157,168],[180,203],[4347,4361],[6210,6221]],"rebased":[20,21,22,23,24,25,26,27,28,30,32,33,34,39,43,46,47,49,51,53,57,58,60,63,64,66,68,71,72,80,82,84],"patched":[]}
#np-ctx-header-end*/
/* Epirus N 人（3-5）引擎测试：随机对局 fuzz + 关键裁定点（docs/RULES-NP.md） */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync as _spawnSync } from 'node:child_process';
/* §E324：门里那些"真跑一臂"的腿只需要证明**旋钮接上了**，不需要证明当选质量 ⇒ 对 `train-3p` 钉单粒 seedBase。
 * 为什么包在这一处、而不是在顶部写 `process.env.EPIRUS_SEL_EVAL_SEEDS='1'`：
 *   第一版就是那么写的，结果**泄漏给同一次跑里的 `train-best` / `train-fast` 腿** ⇒ 那些入口的黑键闸当场 `exit 6`
 *   ⇒ D124/D125 红（认证 40 实测：np 270/272）。**那个红是对的** —— "传了没人读"正是这些闸要拦的事，
 *   所以钉值必须只落在真读它的入口上，而不是整棵环境里。 */
const T3P_ENTRY = 'tools/train-3p.mjs';
function spawnSync(cmd, args, opts) {
  if (!Array.isArray(args) || args[0] !== T3P_ENTRY) return _spawnSync(cmd, args, opts);
  const o = opts || {}, env = Object.assign({}, o.env || process.env);
  /* 腿自己显式给了粒数就**尊重它**（D228 ⑦ 要跑 `=3` 那一档；包装不许把它压回 1，否则那条腿永远测默认档以外的那条路） */
  if (env.EPIRUS_SEL_EVAL_SEEDS === undefined) env.EPIRUS_SEL_EVAL_SEEDS = '1';
  return _spawnSync(cmd, args, Object.assign({}, o, { env }));
}
import { parsePairTable } from '../defense-axis.mjs';   /* D155 用：配对表解析的单一来源（不许在门里再写一份） */
import { makeGuardCost } from '../guard-cost-lib.mjs';   /* D161 用：直接对库做单元级判定（不靠探针的输出措辞） */
import { resolveOutPath } from '../out-path.mjs';   /* D232 ⑦ 用：`--out=` 的解析是纯函数 ⇒ 给输入比输出（§2026-10-09 规矩 1） */
import { load as loadSlotId } from '../../champion-map/slot-identity.mjs';   /* D234 ⑪ 用：活槽身份的唯一解析处（门里不许再写一份） */
import { sigOf, LADDER_CLAIM } from '../diff-ladder-claims.mjs';   /* D227 ④ 用（裁定甲）：难度阶梯"哪几步分得开"是在册账，不是每次现场判断 */
import { pushTarget } from '../bot-chooser-lib.mjs';   /* D223 用：选点规则是纯函数 ⇒ 喂合成 state 逐条钉（§E262） */
import { hardwiredLine } from '../probe-layer-caliber.mjs';   /* D149 用：指针行号从源码现算（钉死数字会在别人插一行后变成假行号） */
import { widOfArr } from '../../champion-map/pack-id.mjs';   /* D234 用：池 bundle 里内嵌权重的指纹要**现算**比对，不许信它自己写的 */
import { rdTable as seatRd, seatKillIndex, pairHasBase } from '../../champion-map/seat-rule.mjs';   /* D234⑧ 用：人席闸的"算不出 ≠ 零格"直接喂两种表比 */
/* D163 用：防御质量三档的单一来源（用户 09-26 裁定："出防御的时候完全没人打他就算白防御，被穿透算半有效"） */
import { classifyDefenseWindow, defenseQuality, formatQuality, parseQuality, formatQualityRecord } from '../defense-quality.mjs';
/* D164 用：池子前沿的三条判据（**只 import 纯函数模块**，探针本体会去扫 1457 个文件） */
import * as AUDIT from '../audit-lib.mjs';
import * as PS from '../play-shape.mjs';
import * as PF_FRONT from '../pool-frontier-lib.mjs';
/* v1.5.225（用户批准方案 a）：确定性重活的**内容寻址缓存** —— 键 = argv + EPIRUS_* env + 源码树内容。
 * 只缓存 (status, stdout, stderr)，**断言照旧跑**；命中响亮打印；`NP_NOCACHE=1` 一律真跑。
 * ⚠️ 只许缓存"断言只用 stdout/status"的子进程（前置要求见 tools/np-cache.mjs 头注）。
 * ⚠️ 门里**不许**把缓存计数器清零（模块里那个清零 API，**整个门体面一律不许出现** —— D157 判的就是这条）：
 *   那会把收尾的"命中/省下多少"抹掉。 */
import { spawnCached, inputHash, cacheStats, cacheDir } from '../np-cache.mjs';
/* §2026-10-10 DS：断言要读子进程**产出的文件**的门，spawn 必须绕开缓存（命中 ⇒ 子进程不跑 ⇒ 读到上次留下的文件 ⇒ 可双向骗人）。
 *   D157 例外：它自己就是缓存的自证门，必须走缓存。 */
const spawnNC = function (argv, opts) { return spawnCached(argv, Object.assign({}, opts, { nocache: true })); };
import { spawnBatch } from '../np-parallel.mjs';   // v1.5.281：互相独立的臂并发跑（D176 一道就占全套 49%）
/* v1.5.288（D193）：多包路由收益的**算式单一来源** —— 门直接喂合成表覆盖六个分支与两类拒绝，
 * 不靠探针的输出措辞、也不依赖本机产物（同 D149/D161/D164 的路子）；环境名从 opp-pool 现取，不写死。 */
import * as RGAIN from '../routing-gain-lib.mjs';
import { OPP_SPECS } from '../../server/opp-pool.mjs';
/* D206 用（DS 清单 B7）：奖励键名单与默认表**从同一来源拿**（不许在门里抄一份键名单——那正是 B7 要防的"第五处"）。 */
import { ECON_REWARD_KEYS, readEconEnv } from '../../server/econ-env.mjs';
/* D207 用（§E164）：落点集中度的算术**只许住在 behavior-profile 里** ⇒ 门直接 import 它做手算自证（被 import 时不跑 main，那条守卫由 D168 系钉着）。 */
import { conc, fieldProfile, tallyPick, WIN } from '../behavior-profile.mjs';
/* D209 用（§E168）：人类形状对手池的单一来源（两台仪器共用它 ⇒ 门来钉"不许再抄第二份"）。 */
import { loadPool, selfTest } from '../human-pool.mjs';
import vm from 'node:vm';
/* v1.5.2：冠军对手（`champ:<路径>`）机制的单一来源 —— 本用例直接调它做**功能**验证，
 * 而不是只 grep 源码（用仓库里在库的 js/bundled-champion-3p.js，不依赖本机 .bak）。 */
import { isChampOpp, loadChampParams, makeChampOppResolver } from '../../server/opp-champs.mjs';   /* §E566 加 makeChampOppResolver：D12 要行为式验"解析出来的 chooser 就是页面那条推理路径" */
import { makeShapeScorer } from '../../server/shape-scorer.mjs';   // P2 形状适应度（qoder-research 0920）
/* v1.5.7：规则指纹守门（D16）—— 把"产物 ↔ 规则版本"绑成机械检查 */
import { rulesFingerprint, fingerprintOfBundle } from '../rules-fingerprint.mjs';
/* v1.5.130：择优纯函数 —— D104 直接喂**合成候选表**验"不回归层"的行为（不是钉文本）。 */
import { pickBestByExam, regressionsOf, fixesOf, INCUMBENT_TAG, rejectDegenerateWinners, vetoBy3p, bandPickByLand, bandPickByUsage, rejectNarrowWinners, COLLAPSE_LINE,
  SEL_BASE0, SEL_STRIDE, SEL_SEEDS_DEFAULT, parseSelSeeds, selBase, selBases, scoreRuns, selNote, selGapNote } from '../pick-best.mjs';
import { readTrainEnv, hasTrainOverride, TRAIN_ENV_KEYS as TEK } from '../../server/train-env.mjs';   // v1.5.169 D129：训练旋钮单一来源
/* v1.5.132：V1/V2/V4「整局」三装配的**单一来源**（D105 与 `probe-ring-ablate.mjs` 共用一份实现）。 */
import { measureAll } from '../v2v4-lib.mjs';
/* v1.5.194：击杀奖励规则的单一来源实现（D140 直接喂合成局面验语义）*/
import * as KR_LIB from '../kill-reward-lib.mjs';
/* v1.5.200：黑键闸与墙上时钟上限的**单一来源** —— D143/D144 直接喂合成 env / 合成 cap 验口径，
 * 而不是只 grep 源码（本仓「钉文本」的门已经太多，见 D122 的教训）。 */
import { detectDarkKnobs, readKeysOf } from '../../server/knob-guard.mjs';
import { wallCapExceeded, wallCapOf } from '../../server/wall-cap.mjs';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
import { sandbox, stanceProfile, aggressionProfile, feasibilityOf, attackAttribution, feasPlan, FEAS_N_DEFAULTS, nullSpreadQuantile } from '../audit-lib.mjs';
/* v1.5.202：G4 `--force` 越线例外的判定抽成**纯函数单一来源**（D146 用合成 meta 直接覆盖它）。 */
import { g4ExceptionOk, G4IMPL_AT_EXCEPTION as G4FROZEN } from '../gate4-exception.mjs';
/* v1.5.202：UNRUN 的处置（哪个方向阻断）也是纯函数单一来源（D147 直接喂合成输入）。 */
import { unrunDisposition, UNRUN_KINDS } from '../unrun-policy.mjs';

const R = sb.window.EpirusRules, S = sb.window.EpirusState, X = sb.window.EpirusResolve, Play = sb.window.EpirusPlay;
const T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots, Pol = sb.window.EpirusPolicy;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 区分对象：缺产品/线上槽（不可判）仍然红（本仓既有规矩「不可判必须红，不许静默跳过」）；
 * 缺本机实验残留（训练产物、融合粒那种只活在这台机器上的件）⇒ 用哨兵 Skip 响亮跳过并点名缺哪个文件。
 * 理由：假红会训练大家忽略红色（Claude 复核 + D82 那类依赖本机状态的病）。 */
function Skip(msg) { this.__skip = true; this.message = msg; }
function needArtifacts(why, files) {
  const miss = files.filter(function (f) { return !existsSync(f); });
  if (miss.length) throw new Skip('缺本机产物（' + why + '）：' + miss.join(' ‖ '));
}
/* ===== §E588（千问 10-11）：门的**夹具包** —— 它不是"现役"，是一枚钉住不动的包 =====
 * 病（v1.6.62 换包当天由 CI 整轮抓出来，本地 4/4 复现同数；前三条 commit 全绿 ⇒ 红是换包带出来的）：
 *   有几条腿把"量哪一枚"钉成了**活槽那一枚**（`js/bundled-champion-3p.js`）⇒ 换包 = 换夹具 = 门红，
 *   而红的理由跟被测旋钮一字关系都没有：
 *     · D225⑥c 要"N=4 的摄魂张数严格低于 N=1" —— 旧包 82 ‖ 19 成立，新包 482 ‖ 469（几乎持平）不成立；
 *     · D138   要"关掉定向垫钱后摄魂判 **U（未测到）**" —— 旧包判 U，新包 0.5 次/局 ⇒ 判 N（它确实活得够久、出得起钱）；
 *     · D229⑦  要"出厂冠军本来就不用 holo ⇒ 开 proto 之后逐字相同" —— 新包镜像里送盾 0.267/局 ⇒ 前提直接没了。
 *   这三条断言讲的是**旋钮与分类器**的性质，与"槽里此刻躺着谁"无关 ⇒ 夹具必须钉死（`docs/METHODOLOGY.md` 131 同族）。
 * ⚠ 这不是"把门改松"：断言一条不减，只是把被测对象换成一枚 **tracked 的钉住快照**；
 *   D229 那条改成**两向都有牙**（默认档必须逐字等于显式 `off` ＋ 用 holo 的包必须看得出 `proto` 的差异）。
 * ⚠ 换冠军时若想让这些性质重新在**新包**上判一次，那是另一件事（要显式跑，不能靠门自己悄悄换夹具）。 */
const FIXTURE_PACK = 'docs/artifacts/eval-out/win-Ldemo.bak';
function ok(c, m) { if (!c) throw new Error(m || 'assert failed'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' got=' + a + ' want=' + b); }

/* ===== §E324：门里的真臂钉在**单粒 seedBase** —— 钉法在文件头那个 `spawnSync` 包装里，不在这里 =====
 * v1.6.7（§E322）把当选键默认改成 4 粒取均值之后，整轮 np 从 570.7s 涨到 **1238.6s**（认证 39）——
 *   因为本文件里有 **28 处 `spawnSync train-3p`**（不是我以为的 5 处），它们的**终局重验**每枚候选都从 1×720 局变成 4×720 局。
 * 为什么该钉而不是"认了"：这些腿判的是**旋钮有没有接上 / 黑键有没有响 / 带内候选有没有落盘 / 产物自不自证**，
 *   跟"当选质量"无关；让认证时长由一次产品默认值的改动**顺带**抬高 2 倍，是把仪器账混进了判据账（§E214 那条"认证提速"的同类）。
 * ⛔ 但**不许写成 `process.env.EPIRUS_SEL_EVAL_SEEDS = '1'`**（第一版就是这么写的）：那会泄漏给同一次跑里的
 *   `train-best` / `train-fast` 腿，而那些入口的黑键闸（D143）认不得这个键 ⇒ 当场 `exit 6`、D124/D125 红（认证 40 实测 np 270/272）。
 *   **那个红是对的** —— "传了没人读"正是这些闸要拦的事。所以钉值只能落在真读它的入口上 ⇒ 用包装，别用全局环境。
 * ⚠ 反面也钉住：默认那 4 粒这条路**不能没有门跟着** ⇒ D228 ⑦ 单开一腿真跑一臂（`EPIRUS_SEL_EVAL_SEEDS=3`）并要求日志印出粒数与分差行。 */
const SEL_PIN = "env.EPIRUS_SEL_EVAL_SEEDS = '1'";

/* 随机 chooser：可负担里随机挑，随机挑一个存活对手 */
function randChooser(state, pid, legal) {
  const aff = legal.filter(function (l) { return l.affordable; });
  if (!aff.length) return R.SK.JI;
  const pick = aff[Math.floor(state.rng.next() * aff.length)];
  const opps = S.opponentsOf(state, pid);
  const target = opps.length ? opps[Math.floor(state.rng.next() * opps.length)] : null;
  return { key: pick.key, target };
}

/* v1.5.201：按**配对花括号**取函数体，取代"锚点 + 固定字符窗"（D61/D73 的老毛病：
 * 代码只要挪出窗口，报错就读成"实现错了"，而真相是"实现搬了"）。
 * 假设：函数体里的花括号不被字符串/模板字面量包着（audit-lib 的 feasibilityOf 满足）。 */
function fnBody(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) return '';
  const b = src.indexOf('{', i);
  if (b < 0) return '';
  let d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  return src.slice(i);
}
/* v1.5.201（审计：硬编码复制 D123/D127 各写一遍）：默认关的 CLI 臂产物基线只留**一处**。
 * 红了 = 默认关的产物变了（那等于偷偷改了所有 CLI 臂的分布）⇒ 先查是不是有意的；
 * 确认有意要重记，就只改这一行（别再去两个用例里各改一处）。
 *
 * ⚠️ v1.6.50 曾把它改成 `bec6adb7c3`（"产品口径成为训练臂默认"），**v1.6.51 已回退、值改回 `aa743488cc`**。
 *   回退理由（用户 10-10 裁定，逐字记在 `tools/train-3p.mjs` 那一段里）：
 *   **"冠军在训练过程中应该是不含或少含随机注入的，而测量的地方才应该按照上线的要求。"**
 *   实测代价（配对、预算对齐到 1200 代）：页面 `H` 出厂口径 55.9 vs 产品口径 42.1（**−13.8pt**），越训越差；
 *   同种子当选键前二名分差在产品口径下只有 0.30pt（落在同分带内 ⇒ 基本是抽签）。
 *   读数见 `champion-map/cont1200-2026-10-10.tsv`。
 *   复现方法仍与上面那三条同：同一个调用 `3 3 6 4` ‖ `wh()` 哈希的是**原始字符串**不是数字 ‖ 跑两遍确认可复现。 */
const CLI_ARM_BASELINE = 'aa743488cc';
/*#np-ctx-tail*/
/* ===== 拆分前 L1..L205 的**全部具名绑定** =====
 * 各部件用解构赋值原样接回（门函数体一个字都不用改）；runner 只留它自己那套（t/PASS/FAIL/__KEYS/ONLY/GRP/CUM/RUNSET…）。
 * ⚠ 只有 import 的**相对路径**被重基（本文件在子目录 tools/gates/ ⇒ `./x` → `../x`、`../y` → `../../y`），
 *   这是拆分里**唯一**被机械改写的东西；其余每一行与拆前逐字节相同（校验脚本见报告）。 */
export function makeCtx() {
  return {
  existsSync, readFileSync, readdirSync, statSync, mkdtempSync,
  mkdirSync, writeFileSync, rmSync, copyFileSync, tmpdir,
  join, createHash, _spawnSync, T3P_ENTRY, spawnSync,
  parsePairTable, makeGuardCost, resolveOutPath, loadSlotId, sigOf,
  LADDER_CLAIM, pushTarget, hardwiredLine, widOfArr, seatRd,
  seatKillIndex, pairHasBase, classifyDefenseWindow, defenseQuality, formatQuality,
  parseQuality, formatQualityRecord, AUDIT, PS, PF_FRONT,
  spawnCached, inputHash, cacheStats, cacheDir, spawnNC,
  spawnBatch, RGAIN, OPP_SPECS, ECON_REWARD_KEYS, readEconEnv,
  conc, fieldProfile, tallyPick, WIN, loadPool,
  selfTest, vm, isChampOpp, loadChampParams, makeChampOppResolver,
  makeShapeScorer, rulesFingerprint, fingerprintOfBundle, pickBestByExam, regressionsOf,
  fixesOf, INCUMBENT_TAG, rejectDegenerateWinners, vetoBy3p, bandPickByLand,
  bandPickByUsage, rejectNarrowWinners, COLLAPSE_LINE, SEL_BASE0, SEL_STRIDE,
  SEL_SEEDS_DEFAULT, parseSelSeeds, selBase, selBases, scoreRuns,
  selNote, selGapNote, readTrainEnv, hasTrainOverride, TEK,
  measureAll, KR_LIB, detectDarkKnobs, readKeysOf, wallCapExceeded,
  wallCapOf, sb, sandbox, stanceProfile, aggressionProfile,
  feasibilityOf, attackAttribution, feasPlan, FEAS_N_DEFAULTS, nullSpreadQuantile,
  g4ExceptionOk, G4FROZEN, unrunDisposition, UNRUN_KINDS, R,
  S, X, Play, T, Bots,
  Pol, mulberry32, Skip, needArtifacts, FIXTURE_PACK,
  ok, eq, SEL_PIN, randChooser, CLI_ARM_BASELINE,
  fnBody,
  };
}

/* ===== 自指门（读本程序自己的源码）用的面 =====
 * 面的**唯一定义**在 `../gate-src.mjs` —— 四个"按文件名定位门体源码"的工具（gate-sentinel /
 *   gate-audit-vacuous / dedupe-artifacts / docs/debug/sentinel-triage）也问它要 ⇒ 本文件只做**转出**，
 *   不再自己写一份 glob（"同一份名单抄两遍"是本仓栽过至少四次的病）。
 * ⚠ 下面这两行必须留在**本文档 payload 区之外**：payload = 拆前原文的逐字节副本，校验脚本按行数核它。
 * ⚠ 本文件不 import 门体文件（只让 gate-src 读文本）⇒ 无环；runner 也不直接 import gate-src（它经本文件转出）。 */
import { gateBodyText, partFiles } from '../gate-src.mjs';

/* 16 个部分文件（**只有门体**），按各自最小原始行号升序：runner 的收尾"注册数守卫"与 D125 用它数门。 */
export const NP_GATE_FILES = partFiles();
/* 门体面全文 = runner + 本文件 + 16 个部分（文件间有 BOUNDARY 分隔行）：
 * L1/D146/D157/D194/D205/D206/D228 这些自指门用它 ⇒ 与拆前"读 np-test.mjs 自己"同义。 */
export function npSourceAll() { return gateBodyText(); }

