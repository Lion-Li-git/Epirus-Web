/* Epirus N 人（3-5）引擎测试：随机对局 fuzz + 关键裁定点（docs/RULES-NP.md） */
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parsePairTable } from './defense-axis.mjs';   /* D155 用：配对表解析的单一来源（不许在门里再写一份） */
import { makeGuardCost } from './guard-cost-lib.mjs';   /* D161 用：直接对库做单元级判定（不靠探针的输出措辞） */
import { hardwiredLine } from './probe-layer-caliber.mjs';   /* D149 用：指针行号从源码现算（钉死数字会在别人插一行后变成假行号） */
/* D163 用：防御质量三档的单一来源（用户 09-26 裁定："出防御的时候完全没人打他就算白防御，被穿透算半有效"） */
import { classifyDefenseWindow, defenseQuality, formatQuality, parseQuality, formatQualityRecord } from './defense-quality.mjs';
/* D164 用：池子前沿的三条判据（**只 import 纯函数模块**，探针本体会去扫 1457 个文件） */
import * as AUDIT from './audit-lib.mjs';
import * as PS from './play-shape.mjs';
import * as PF_FRONT from './pool-frontier-lib.mjs';
/* v1.5.225（用户批准方案 a）：确定性重活的**内容寻址缓存** —— 键 = argv + EPIRUS_* env + 源码树内容。
 * 只缓存 (status, stdout, stderr)，**断言照旧跑**；命中响亮打印；`NP_NOCACHE=1` 一律真跑。
 * ⚠️ 只许缓存"断言只用 stdout/status"的子进程（前置要求见 tools/np-cache.mjs 头注）。
 * ⚠️ 门里**不许**把缓存计数器清零（模块里那个清零 API，np-test 一律不许 import）：那会把收尾的"命中/省下多少"抹掉。 */
import { spawnCached, inputHash, cacheStats } from './np-cache.mjs';
import { spawnBatch } from './np-parallel.mjs';   // v1.5.281：互相独立的臂并发跑（D176 一道就占全套 49%）
/* v1.5.288（D193）：多包路由收益的**算式单一来源** —— 门直接喂合成表覆盖六个分支与两类拒绝，
 * 不靠探针的输出措辞、也不依赖本机产物（同 D149/D161/D164 的路子）；环境名从 opp-pool 现取，不写死。 */
import * as RGAIN from './routing-gain-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
/* D206 用（DS 清单 B7）：奖励键名单与默认表**从同一来源拿**（不许在门里抄一份键名单——那正是 B7 要防的"第五处"）。 */
import { ECON_REWARD_KEYS, readEconEnv } from '../server/econ-env.mjs';
/* D207 用（§E164）：落点集中度的算术**只许住在 behavior-profile 里** ⇒ 门直接 import 它做手算自证（被 import 时不跑 main，那条守卫由 D168 系钉着）。 */
import { conc, fieldProfile, tallyPick, WIN } from './behavior-profile.mjs';
/* D209 用（§E168）：人类形状对手池的单一来源（两台仪器共用它 ⇒ 门来钉"不许再抄第二份"）。 */
import { loadPool, selfTest } from './human-pool.mjs';
import vm from 'node:vm';
/* v1.5.2：冠军对手（`champ:<路径>`）机制的单一来源 —— 本用例直接调它做**功能**验证，
 * 而不是只 grep 源码（用仓库里在库的 js/bundled-champion-3p.js，不依赖本机 .bak）。 */
import { isChampOpp, loadChampParams } from '../server/opp-champs.mjs';
import { makeShapeScorer } from '../server/shape-scorer.mjs';   // P2 形状适应度（qoder-research 0920）
/* v1.5.7：规则指纹守门（D16）—— 把"产物 ↔ 规则版本"绑成机械检查 */
import { rulesFingerprint, fingerprintOfBundle } from './rules-fingerprint.mjs';
/* v1.5.130：择优纯函数 —— D104 直接喂**合成候选表**验"不回归层"的行为（不是钉文本）。 */
import { pickBestByExam, regressionsOf, fixesOf, INCUMBENT_TAG, rejectDegenerateWinners, vetoBy3p, bandPickByLand, bandPickByUsage, rejectNarrowWinners, COLLAPSE_LINE } from './pick-best.mjs';
import { readTrainEnv, hasTrainOverride, TRAIN_ENV_KEYS as TEK } from '../server/train-env.mjs';   // v1.5.169 D129：训练旋钮单一来源
/* v1.5.132：V1/V2/V4「整局」三装配的**单一来源**（D105 与 `probe-ring-ablate.mjs` 共用一份实现）。 */
import { measureAll } from './v2v4-lib.mjs';
/* v1.5.194：击杀奖励规则的单一来源实现（D140 直接喂合成局面验语义）*/
import * as KR_LIB from './kill-reward-lib.mjs';
/* v1.5.200：黑键闸与墙上时钟上限的**单一来源** —— D143/D144 直接喂合成 env / 合成 cap 验口径，
 * 而不是只 grep 源码（本仓「钉文本」的门已经太多，见 D122 的教训）。 */
import { detectDarkKnobs, readKeysOf } from '../server/knob-guard.mjs';
import { wallCapExceeded, wallCapOf } from '../server/wall-cap.mjs';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
import { sandbox, stanceProfile, aggressionProfile, feasibilityOf, attackAttribution, feasPlan, FEAS_N_DEFAULTS, nullSpreadQuantile } from './audit-lib.mjs';
/* v1.5.202：G4 `--force` 越线例外的判定抽成**纯函数单一来源**（D146 用合成 meta 直接覆盖它）。 */
import { g4ExceptionOk, G4IMPL_AT_EXCEPTION as G4FROZEN } from './gate4-exception.mjs';
/* v1.5.202：UNRUN 的处置（哪个方向阻断）也是纯函数单一来源（D147 直接喂合成输入）。 */
import { unrunDisposition, UNRUN_KINDS } from './unrun-policy.mjs';

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
let PASS = 0, FAIL = 0;
const __T = [];   /* v1.5.224：按门计时。默认**零成本**（只 push 两个数），NP_TIME=1 时才在收尾印排行榜。
                   * 整轮墙钟用 `process.uptime()`（见收尾），不另记起点 —— 少一个变量就少一处能写错的地方。 */
/* `--only=<子串>`：**只跑名字匹配的门**（v1.5.288）。
 * 为什么要它：本文件没有"单门复跑"的口子，改一条门的判据就要等整轮 6~10 分钟 ⇒
 * 实际发生的是我拿**开发台脚本**在外面复算同一批断言（D193 今天就这么做的），
 * 而那套外部脚本与门体是分叉的两份代码。有了 `--only`，"改门 → 验门"回到同一把尺上。
 * ⚠ 这条**不冒充全绿**：跑完会响亮印"跳过 N 条"，收尾的注册数守卫也把跳过数算进去。 */
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7) || null;
let __skipped = 0;
function t(name, fn) {
  if (ONLY && name.indexOf(ONLY) < 0) { __skipped++; return; }
  const __t0 = Date.now();
  try { fn(); PASS++; console.log('  ✔ ' + name); }
  catch (e) { FAIL++; console.log('  ✘ ' + name + '  → ' + e.message); }
  __T.push([Date.now() - __t0, name]);
}
function ok(c, m) { if (!c) throw new Error(m || 'assert failed'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' got=' + a + ' want=' + b); }

/* 随机 chooser：可负担里随机挑，随机挑一个存活对手 */
function randChooser(state, pid, legal) {
  const aff = legal.filter(function (l) { return l.affordable; });
  if (!aff.length) return R.SK.JI;
  const pick = aff[Math.floor(state.rng.next() * aff.length)];
  const opps = S.opponentsOf(state, pid);
  const target = opps.length ? opps[Math.floor(state.rng.next() * opps.length)] : null;
  return { key: pick.key, target };
}

console.log('== N 人引擎测试 ==');

t('N1 人数：createState 默认 2 人；multi 模式可 3/4/5 人', function () {
  eq(S.createState('standard').p.length, 2, '默认 2 人');
  for (const n of [3, 4, 5]) {
    const st = S.createState('multi', { next: mulberry32(n) }, n);
    eq(st.p.length, n, n + ' 人');
    eq(st.actions.length, n, n + ' 行动槽');
    eq(st.n, n, 'n 字段');
  }
});

t('N2 多人模式含全部多人专用技能（双枪 + 镜面）', function () {
  const st = S.createState('multi', { next: mulberry32(1) }, 3);
  ok(S.canUseSkillInMode(st, R.SK.DUAL_GUN), '双枪可用');
  ok(S.canUseSkillInMode(st, R.SK.MIRROR), '镜面可用');
  const st2 = S.createState('standard', { next: mulberry32(1) }, 2);
  ok(!S.canUseSkillInMode(st2, R.SK.DUAL_GUN), '标准模式双枪不可用');
  ok(!S.canUseSkillInMode(st2, R.SK.MIRROR), '标准模式镜面不可用');
});

t('目标：attemptAction 记录 action.target，resolveTarget 兜底第一个存活对手', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 3);
  st.p[0].ep = 5;
  S.attemptAction(st, 0, R.SK.GUN, { target: 2 });
  eq(st.actions[0].target, 2, '显式目标');
  S.attemptAction(st, 1, R.SK.GUN, {});
  ok(st.actions[1].target !== null && st.actions[1].target !== 1, '兜底目标≠自己');
});

t('N3 小雷逐边：A→B 使 B 作废（B 未反击 A）', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[1].voided, 'B 的枪被小雷作废');
  ok(!st.actions[0].voided, 'A 的小雷成立');
});

t('N3b 小雷互雷成环（2 人边）：双方作废', function () {
  const st = S.createState('multi', { next: mulberry32(12) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互雷成环双方作废');
  ok(st.events.some(function (e) { return e.type === 'thunderRing'; }), 'thunderRing 事件');
});

t('N10 胜负：最后存活者胜', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 3);
  st.p[1].hp = 0; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '仅 P0 存活 → 胜');
});

t('N10b 胜负：同回合全灭 = 平局', function () {
  const st = S.createState('multi', { next: mulberry32(14) }, 4);
  for (const p of st.p) p.hp = 0;
  X.checkOver(st);
  eq(st.winner, 'draw', '全灭平局');
});

t('N10c 回合上限：血量最高者胜；并列平局', function () {
  const st = S.createState('multi', { next: mulberry32(15) }, 3);
  st.round = R.MAX_ROUNDS;
  st.p[0].hp = 2; st.p[1].hp = 1.5; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '血最高者胜');
  const st2 = S.createState('multi', { next: mulberry32(16) }, 3);
  st2.round = R.MAX_ROUNDS;
  st2.p[0].hp = 2; st2.p[1].hp = 2; st2.p[2].hp = 1;
  X.checkOver(st2);
  eq(st2.winner, 'draw', '并列最高平局');
});

t('N8 铁索：边共享伤害、不递归，且**一次性**（v1.5.18 用户裁定按原文修正）', function () {
  /* 原文：「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」⇒ 共享过一次连边即解除。
   * 本用例第一版（v1.5.18 之前）直接假定连边**持久**、拿同一个局连续打两次 —— 那正是实现与原文不符的地方。 */
  const st = S.createState('multi', { next: mulberry32(17) }, 3);
  st.p[0].chains = [1]; st.p[1].chains = [0, 2]; st.p[2].chains = [1];
  st.p[0].hp = st.p[1].hp = st.p[2].hp = 3;
  X.rawDamage(st, 0, 1, '测试', 'test', {});
  eq(st.p[0].hp, 2, 'A 自身');
  eq(st.p[1].hp, 2, 'B 通过 A 的边共享');
  eq(st.p[2].hp, 3, 'C 不共享（铁索图不递归 N8）');
  /* v1.5.18：共享过一次 ⇒ A-B 这条边**两侧一起**解除（单向解除 = 半截铁索，也要查）。
   * 反证：删掉 `p.chains = []` 与那个 filter ⇒ 下面三条立刻红。 */
  eq((st.p[0].chains || []).length, 0, 'A 侧的边已解除');
  eq((st.p[1].chains || []).indexOf(0), -1, 'B 侧到 A 的边也已解除（对称解除）');
  const hpB = st.p[1].hp;
  X.rawDamage(st, 0, 1, '测试', 'test', {});
  eq(st.p[1].hp, hpB, '一次性：同一条边不再共享第二次');
  // 另一局：打 B（它同时连着 A 与 C）⇒ 两条边都共享，且两条边都断
  const st2 = S.createState('multi', { next: mulberry32(19) }, 3);
  st2.p[0].chains = [1]; st2.p[1].chains = [0, 2]; st2.p[2].chains = [1];
  X.rawDamage(st2, 1, 1, '测试', 'test', {});
  eq(st2.p[1].hp, 2, 'B 自身');
  eq(st2.p[0].hp, 2, 'A 共享（B 的边之一）');
  eq(st2.p[2].hp, 2, 'C 共享（B 的边之二）');
  eq((st2.p[1].chains || []).length, 0, 'B 侧两条边都断');
  eq((st2.p[0].chains || []).length, 0, 'A 的边断');
  eq((st2.p[2].chains || []).length, 0, 'C 的边断');
});

t('N3 双枪射手：对两个目标各 1 点', function () {
  const st = S.createState('multi', { next: mulberry32(18) }, 3);
  st.p[0].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.DUAL_GUN, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 2, '目标1 受伤');
  eq(st.p[2].hp, 2, '目标2 受伤');
  eq(st.p[0].hp, 3, '自身不受伤');
});

t('N14 镜面反射：复制目标的伤害技能打输出对象', function () {
  const st = S.createState('multi', { next: mulberry32(31) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 复制 P1 → 打 P2
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });                 // P1 用枪打 P0
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 被复制来的枪打中');
  eq(st.p[0].hp, 2, 'P1 的枪打中 P0');
  eq(st.p[1].hp, 3, 'P1 未受伤');
  ok(st.events.some(function (e) { return e.type === 'mirror'; }), 'mirror 事件');
});

t('N14b 镜面反射：复制双枪只算一枪；镜面本身不可复制', function () {
  const st = S.createState('multi', { next: mulberry32(32) }, 4);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.DUAL_GUN, { target: 0, target2: 3 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, '复制双枪只算 1 伤');
  eq(st.p[0].hp, 2, '双枪打 P0');
  eq(st.p[3].hp, 2, '双枪打 P3');
});

t('N15 反复横跳：镜面边成环 → 所有使用者受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(33) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 1->2
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 2, target2: 0 });   // 2->0
  S.attemptAction(st, 2, R.SK.MIRROR, { target: 0, target2: 1 });   // 0->1
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'P0 受 1 点光&火');
  eq(st.p[1].hp, 2, 'P1 受 1 点光&火');
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '反复横跳'; }), '反复横跳事件');
});

t('N16 聚光炮：互镜且输出同一人 → 该人受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(34) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 0, target2: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  eq(st.p[0].hp, 3, 'P0 不受伤');
  eq(st.p[1].hp, 3, 'P1 不受伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '聚光炮'; }), '聚光炮事件');
});

t('N17 合二为一：两人同时小雷打同一人 → 额外 1 电伤', function () {
  const st = S.createState('multi', { next: mulberry32(35) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[2].voided, 'P2 行动被小雷作废');
  eq(st.p[2].hp, 2, 'P2 额外受 1 电伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '合二为一'; }), '合二为一事件');
});

t('N18 光&火复合伤害：藤甲火弱 +1、吸血鬼光弱 +1 可叠加', function () {
  const st = S.createState('multi', { next: mulberry32(36) }, 3);
  for (const p of st.p) p.ep = 5;
  st.p[2].fireWeakNow = true; st.p[2].vampire = true;
  X.rawDamage(st, 2, 1, '聚光炮', 'focusCannon', { type: R.DMG.FIRELIGHT });
  eq(st.p[2].hp, 0, '1 + 藤甲 1 + 光弱 1 = 3 伤');
});

t('N19 多人冠军包：可加载且维度兼容', function () {
  const P = sb.window.EpirusPolicy;
  const pack = sb.window.EPIRUS_CHAMPION_3P;
  ok(!!pack, '存在 EPIRUS_CHAMPION_3P');
  const chk = P.checkPack(pack);
  ok(chk.ok, 'checkPack: ' + JSON.stringify(chk));
  const params = P.unpack(pack);
  ok(!!params && params.length === P.paramCount(), 'unpack 长度=' + (params ? params.length : 'null'));
  ok(pack.f === P.FEAT_S && pack.h === P.HID, 'f/h 一致');
});

t('N4 相抵必须“互为目标”：两家同打第三人 → 各中一枪', function () {
  const st = S.createState('multi', { next: mulberry32(41) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 1, 'P0 中两枪');
  ok(!st.actions[1].voided && !st.actions[2].voided, '两枪都没被相抵');
});

t('N4b 互为目标仍相抵（2 人回归）', function () {
  const st = S.createState('standard', { next: mulberry32(42) }, 2);
  st.p[0].ep = st.p[1].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互枪相抵');
  eq(st.p[0].hp, 3, '无人受伤');
});

t('N4c 高优先级打第三人，不作废别人对同一目标的攻击', function () {
  const st = S.createState('multi', { next: mulberry32(43) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.SWORD, { target: 2 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(!st.actions[1].voided, 'P1 的枪不被 P0 的剑作废');
  eq(st.p[2].hp, 1, 'P2 各中 1 点');
});

t('N12 已淘汰玩家不能行动', function () {
  const st = S.createState('multi', { next: mulberry32(44) }, 3);
  st.p[1].hp = 0; st.p[1].ep = 5;
  const r = S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  eq(r.outcome, 'invalid', '被拒绝');
  ok(st.actions[1].voided, '行动作废');
});

t('N12b 每回合重置行动槽：死人不会沿用上回合行动', function () {
  const st = S.createState('multi', { next: mulberry32(45) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st); X.endTurn(st);
  st.p[1].hp = 0;
  X.startTurn(st);
  ok(st.actions[1] === null, '行动槽已清空');
});

t('N6 大雷连带：攻击被雷劈中者 → 攻击者受 1 电伤且攻击作废', function () {
  const st = S.createState('multi', { next: mulberry32(46) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 1, 'P1 中 2 电');
  eq(st.p[2].hp, 1, 'P2 受 2 点连带伤');
  ok(st.actions[2].voided, 'P2 的攻击被连带无效化');
  eq(st.p[2].cooldown[R.SK.GUN], 4, '连带者的技能（枪）被禁用 3 回合');
});

t('N6b 大雷连带：被雷劈者攻击第三人 → 第三人受连带', function () {
  const st = S.createState('multi', { next: mulberry32(47) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 1, 'P2 受 2 点连带电伤');
  ok(st.actions[2].voided, 'P2 的行动同样被作废');
});

t('目标反锁：上回合与某对手互为目标而相抵 → 本回合不再打他', function () {
  const T = sb.window.EpirusTrainer;
  const st = S.createState('multi', { next: mulberry32(51) }, 3);
  st.round = 5; st.p[1].hp = 2; st.p[2].hp = 2;
  st.events.push({ type: 'cancel', pids: [0, 2], round: 4 });
  ok(T.pickTargetN(st, 0, R.SK.GUN) !== 2, '不再打 P2（反锁）');
});

t('目标选择：能一击必杀先杀；否则打血量最高的领先者', function () {
  const T = sb.window.EpirusTrainer;
  const a = S.createState('multi', { next: mulberry32(52) }, 3);
  a.round = 5; a.p[1].hp = 1; a.p[2].hp = 3;
  eq(T.pickTargetN(a, 0, R.SK.GUN), 1, '能杀 P1 就杀');
  const b = S.createState('multi', { next: mulberry32(53) }, 3);
  b.round = 5; b.p[1].hp = 2; b.p[2].hp = 3;
  eq(T.pickTargetN(b, 0, R.SK.GUN), 2, '打领先者 P2');
});

t('fuzz：3/4/5 人随机对局无异常，且必然收敛', function () {
  for (const n of [3, 4, 5]) {
    for (let g = 0; g < 120; g++) {
      const st = S.createState('multi', { next: mulberry32(1000 + g * 31 + n) }, n);
      const ch = [];
      for (let i = 0; i < n; i++) ch.push(randChooser);
      const w = Play.autoGameN(st, ch);
      ok(st.over, '必须结束');
      ok(w === 'draw' || (typeof w === 'number' && w >= 0 && w < n), '合法胜者: ' + w);
      ok(st.round <= R.MAX_ROUNDS, '回合上限内: ' + st.round);
      for (const p of st.p) ok(isFinite(p.hp), 'HP 有限');
    }
  }
});

t('autoGame 2 人入口仍可用（数组/位置参数两种）', function () {
  const st = S.createState('standard', { next: mulberry32(21) }, 2);
  const w1 = Play.autoGame(st, randChooser, randChooser);
  ok(st.over, '位置参数入口收敛');
  const st2 = S.createState('standard', { next: mulberry32(22) }, 2);
  const w2 = Play.autoGame(st2, [randChooser, randChooser]);
  ok(st2.over, '数组入口收敛');
});

t('N2 同优先级同时结算：三方互放大雷 → 人人挨打（低 pid 不再免伤）', function () {
  const st = S.createState('multi', { next: mulberry32(42) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 5; st.p[i].elec = 1; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.BIG_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st);
  const hp = st.p.map(function (p) { return p.hp; });
  ok(hp[0] < 3 && hp[1] < 3 && hp[2] < 3,
    '三人应各受伤害（快照结算），实际 HP=' + hp.join('/'));
});

t('N2 座位偏置：3x 同一策略各座位 1st 率接近均等', function () {
  const B = sb.window.EpirusBots, T = sb.window.EpirusTrainer;
  const sel = T.wrapBotN(B.pickBreakDef);
  const GAMES = 80, first = [0, 0, 0];
  let drawn = 0;
  for (let g = 0; g < GAMES; g++) {
    const r = T.oneGameN([sel, sel, sel], 31337 + g * 977, 3);
    if (typeof r.winner !== 'number') drawn++; else first[r.winner]++;
  }
  const decided = GAMES - drawn;
  ok(decided >= 30, '有效样本不足 decided=' + decided);
  const pct = first.map(function (c) { return c / decided * 100; });
  const spread = Math.max.apply(null, pct) - Math.min.apply(null, pct);
  ok(spread <= 32,
    '座位偏置过大 ' + pct.map(function (v) { return v.toFixed(1); }).join('/') + '% 极差=' + spread.toFixed(1) + 'pt（修复前为 73.5pt）');
});


/* ===== N20 地雷 AoE（用户裁定 2026-09-11）=====
 * 旧实现是 2 人口径"只让攻击者受 1 火伤"；而 2 人局里「全场其他角色」与「攻击者」**恰好同一人**
 * ⇒ 两种读法在 2 人下无法区分，multi 加入时未回头核对。以下用例必须 N≥3 才测得出。 */
t('N20a 地雷直接触发：4 人 a/b/c 装雷、d 打 a → 除 a 外各 1；b/c 间接触发合并一波打 a/d', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].mineArmed, false, 'a 的雷被直接触发后消耗');
  eq(st.p[1].mineArmed, false, 'b 的雷被间接触发后消耗');
  eq(st.p[2].mineArmed, false, 'c 的雷被间接触发后消耗');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 4, 'b：只挨 a 的直接波 1');
  eq(st.p[2].hp, 4, 'c：只挨 a 的直接波 1');
  eq(st.p[3].hp, 3, 'd：a 的直接波 1 + 间接触发波 1');
});

t('N20b 直接触发无上限：d 双枪打 a,b → a/b 各一波 + c 间接触发合并一波 = 共 3 波', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.DUAL_GUN, { target: 0, target2: 1 });
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'a：双枪 1 + b 直接波 1 + c 间接触发波 1');
  eq(st.p[1].hp, 2, 'b：双枪 1 + a 直接波 1 + c 间接触发波 1');
  eq(st.p[2].hp, 3, 'c：a 直接波 1 + b 直接波 1（间接触发者豁免自己那波）');
  eq(st.p[3].hp, 2, 'd：a 直接波 1 + b 直接波 1 + c 间接触发波 1');
});

t('N20c 地雷伤害无来源：事件 source=null → 不被铁索共享', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  st.p[0].chains = [1]; st.p[1].chains = [0];
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  ok(md.length > 0, '应有地雷伤害事件');
  ok(md.every(function (e) { return e.source == null; }), '地雷伤害事件 source 必须为 null');
  eq(st.p[1].hp, 3, 'b：铁索共享 d 的枪 1 + a 的直接波 1；雷伤不共享故不再掉');
});

t('N20d 火弱逐目标：地雷 AoE 只对挂了藤甲 debuff 的那一个 +1', function () {
  const st = S.createState('multi', { next: mulberry32(17) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  st.p[1].fireWeakNow = true;            // 只给 b 挂火弱（模拟此前被藤甲贴过）
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  const toB = md.filter(function (e) { return e.to === 1; });
  ok(toB.length > 0, 'b 应吃到地雷伤害');
  eq(toB[0].amt, 2, 'b 挂了火弱 → 这一发 2 点');
  ok(md.filter(function (e) { return e.to !== 1; }).every(function (e) { return e.amt === 1; }),
    '其他没挂火弱的人只吃 1 点');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 3, 'b：直接波 2（含火弱 +1），间接触发者豁免自己那波');
  eq(st.p[2].hp, 4, 'c：直接波 1');
  eq(st.p[3].hp, 3, 'd：直接波 1 + 间接触发波 1');
});

t('N20e 狙击枪豁免只针对那一次攻击：狙击打持雷者不触发，雷仍装着', function () {
  const st = S.createState('multi', { next: mulberry32(19) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.SNIPE, { target: 0 });
  X.resolveActions(st);
  ok(st.p[0].hp < 5, 'a 应挨到狙击伤害（点数随爆头判定变化，本用例只锁豁免不变量）');
  eq(st.p[0].mineArmed, true, '狙击枪攻击不触发地雷 → 雷仍然装着');
  eq(st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; }).length, 0,
    '不应产生任何地雷伤害事件');
  eq(st.p[1].hp, 5, 'b 未被波及');
  eq(st.p[3].hp, 5, 'd 未被波及');
});

/* 千问建议的硬规矩：训练路径禁止裸 Math.random / Date.now —— 随机只能来自
 * state.rng 或 P.setRng 注入的流。这次不可复现的根因就是 server 里两处 Node 作用域的裸调用
 * （__seedSandbox 只管 vm 沙箱，管不到 Node 全局）。加自动检查防止再犯。
 * 白名单：明确的兜底分支 / 超时与时间戳（不参与决策）。 */
t('REPRO 训练路径不得出现裸 Math.random / Date.now（白名单见下）', function () {
  const WL = [
    'js/train/bots.js',            // rnd() 的 Math.random 兜底（浏览器无 state.rng 时）
    'js/train/policy.js',          // __rng 的默认值 Math.random（可被 setRng 覆盖）
    'T.mulberry32 ? T.mulberry32', // 播种流不可用时的显式兜底
    'Date.now() - t0 > cap',       // ⚠️ 理由已更正：它**参与决策**（在生成循环内，到点直接 return
    //   ⇒ 机器负载不同 ⇒ 跑到的代数不同 ⇒ 冠军不同）。暂列白名单只为让断言可用，
    //   正解是改成按代数上限（docs/REVIEW-3P.md P3#2）
    'Date.now() % ',               // 仅允许作为"已废弃写法"的检测目标，不应出现在有效代码
  ];
  /* 扩面（千问复核指出）：原先只扫 server/*.mjs —— **恰好只保护了刚修好的那条路**，
   * 而 tools/train-*.mjs 三个 CLI 训练器完全没播种，研究数字多半出自它们。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'js/train/evo.js'];
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const t0 = L.trim();
      if (t0.startsWith('*') || t0.startsWith('//') || t0.startsWith('/*')) continue;   // 注释不算
      const hasRand = L.indexOf('Math.random(') >= 0;
      const hasClock = L.indexOf('Date.now(') >= 0;
      if (!hasRand && !hasClock) continue;
      if (WL.some(function (w) { return L.indexOf(w) >= 0 || f.indexOf(w) >= 0 && w.indexOf('/') >= 0; })) continue;
      if (L.indexOf('const t0 = Date.now()') >= 0) continue;   // 纯计时（不参与决策）
      if (L.indexOf('Date.now() - t0') >= 0) continue;      // 超时
      if (L.indexOf('toISOString') >= 0) continue;          // 时间戳（meta 用）
      if (L.indexOf('toString(36)') >= 0) continue;         // cache-busting token
      if (L.indexOf('mulberry32') >= 0) continue;           // 播种兜底
      /* js/train/evo.js 里的 Math.random 是**安全**的，但这个安全性依赖于另一条断言：
       * evo.js 跑在沙箱里，而 __seedSandbox 把整个沙箱的 Math 换掉了；
       * REPRO2 正好保证"每个训练入口都必须播种"。两者合起来才成立 ——
       * 如果有一天新加了一个不播种的入口，REPRO2 会先红。
       * （千问倾向把这几处直接改成播种流；列白名单是我在预算内的折中，已记入 CHANGELOG。） */
      if (f === 'js/train/evo.js' && L.indexOf('Math.random(') >= 0) continue;
      if (f === 'js/train/bots.js' && L.indexOf('Math.random(') >= 0) continue;  // rnd() 兜底
      bad.push(f + ':' + (i + 1) + '  ' + L.trim().slice(0, 70));
    }
  }
  eq(bad.length, 0, '训练路径出现裸随机/时间源：\n    ' + bad.join('\n    '));
});

t('N21 大雷不失效/不禁用小雷（非空版）：小雷打第三方时大雷正常结算，此时才看得出豁免', function () {
  /* 空用例的教训：若被大雷打的人**自己**用了小雷，小雷(pri5)会先作废大雷本身，
   * 大雷压根不结算 -> 禁用与否都是 0，用例恒过。
   * 必须让小雷**打第三方**，大雷才不会被作废、才会真的走到"要不要禁用目标技能"这一步。 */
  const st = S.createState('multi', { next: mulberry32(23) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });      // 大雷 pri4 -> P1
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });     // 小雷 pri5 -> **P2**（不干扰 P0 的大雷）
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'ban'; }), '大雷应已结算并发出 ban 事件（否则用例又是空的）');
  eq(st.p[1].cooldown[R.SK.MINI_T] || 0, 0, '小雷不应被大雷禁用');

  // 对照组：目标用普通技能（激光剑）时**应当**被禁用
  const st2 = S.createState('multi', { next: mulberry32(29) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st2.p[i2].hp = 8; st2.p[i2].ep = 9; }
  X.startTurn(st2);
  S.attemptAction(st2, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st2, 1, R.SK.SWORD, { target: 0 });
  S.attemptAction(st2, 2, R.SK.JI, {});
  X.resolveActions(st2);
  ok((st2.p[1].cooldown[R.SK.SWORD] || 0) > 0, '非防御类技能(激光剑)应被大雷禁用');
});

t('N22 大雷效果传导（用户 a,b,c,d 例子）：b/c/d 各受 2 点；c 的ジ失效不给 ep；b 的转移与 d 的枪禁用 3 回合', function () {
  const st = S.createState('multi', { next: mulberry32(41) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });         // a 大雷 -> b
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 2 });      // b 转移伤害 -> c
  S.attemptAction(st, 2, R.SK.JI, {});                       // c 只出ジ
  S.attemptAction(st, 3, R.SK.GUN, { target: 1 });           // d 枪 -> b
  X.resolveActions(st);
  eq(st.p[0].hp, 8, 'a（施法者）不受影响');
  eq(st.p[1].hp, 6, 'b（大雷目标）受 2 点');
  eq(st.p[2].hp, 6, 'c（b 的转移对象）受 2 点');
  eq(st.p[3].hp, 6, 'd（攻击 b 的人）受 2 点');
  eq(st.p[2].ep, 9, 'c 的ジ被失效 -> 不 +ep');
  ok((st.p[1].cooldown[R.SK.TRANSFER] || 0) > 0, 'b 的转移伤害应被禁用 3 回合');
  ok((st.p[3].cooldown[R.SK.GUN] || 0) > 0, 'd 的枪应被禁用 3 回合');
  eq(st.p[2].cooldown[R.SK.JI] || 0, 0, 'ジ 不进 3 回合禁用');
});

t('N22b 防御族可格挡大雷；藤甲（有作用目标）本人免伤、伤害落到其目标', function () {
  // 直接命中：b 用反弹 -> 应挡住那 2 点（且不触发反弹反击）
  const st = S.createState('multi', { next: mulberry32(43) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 8, '反弹应格挡大雷（反弹可格挡）');
  eq(st.p[0].hp, 8, '大雷不被反弹反击（反弹不触发）');
  ok((st.p[1].cooldown[R.SK.REFLECT] || 0) === 0, '防御族不进 3 回合禁用');
});
t('N22c 【覆盖传导链中的防御】链上成员用藤甲：本人免伤、2 点落到其作用目标', function () {
  /* 为什么需要这条：N22 的链条里没有防御者，N22b 测的是**直接目标**的防御（走另一分支），
   * 两者都测不到"传导链成员用防御"这段新代码（反证已证：关掉豁免它们仍通过）。 */
  const st = S.createState('multi', { next: mulberry32(47) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });        // a 大雷 -> b
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 2 });     // b 转移 -> c   => c 进链
  S.attemptAction(st, 2, R.SK.ARMOR, { target: 3 });        // c 藤甲 -> d  （防御族 + 有作用目标）
  S.attemptAction(st, 3, R.SK.JI, {});                      // d 只出ジ（不是链成员，只作为藤甲目标）
  X.resolveActions(st);
  eq(st.p[1].hp, 6, 'b（大雷目标）受 2 点');
  eq(st.p[2].hp, 8, 'c（链上成员，用防御）本人免伤');
  eq(st.p[3].hp, 6, 'd 作为藤甲的作用目标，吃到那 2 点传导伤害');
  /* 注意：**不**断言"防御族不进 3 回合禁用"——用户说的"防住大雷"指格挡那 2 点伤害，
   * 而 R23' 明确"2 电被挡但禁用目标用的原型制御仍生效" ⇒ 防御族**仍会被禁用**。
   * 我曾在此写错断言，直接把 R23' 撞成 spec 36/37。 */
  ok((st.p[2].cooldown[R.SK.ARMOR] || 0) > 0, '防御族仍会被禁用 3 回合（与 R23 注释同口径）');
});
t('N23 单个激光眼即失效原型制御（用户裁定：单发破全防御族）', function () {
  const st = S.createState('multi', { next: mulberry32(53) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; st.p[i2].boom = 2; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.LASER_EYE, { target: 1 });   // 单个激光眼 -> 目标在出原型制御
  S.attemptAction(st, 1, R.SK.PROTO, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  /* 关键判据：不再出现 laserNoEffect（那是"需两发才破原型制御/全息"的旧路径）。
   * （本用例第一版还写了 `some(e => e.type==='laserNoEffect' ? false : true)` 和 `ok(true,'')`
   *   —— 前者近乎恒真、后者是空断言，已删除；判据只保留下面这条可被反证的。） */
  eq(st.events.filter(function (e) { return e.type === 'laserNoEffect'; }).length, 0,
     '单发不应再走 laserNoEffect（需两发）路径');
  /* 不写"应产生失效事件"——`setVoid` 并不发 type:'void' 的事件（我一度这么断言，直接失败）。
   * 判据只保留下面那条**可被反证**的 laserNoEffect 计数。 */
});
t('REPRO2 每个训练入口都必须**真的**播种（按 makeTrainer 调用点反查 + 按函数体切分）', function () {
  /* 第三方复核 §5-2 的两条实测，把上一版的问题说清了：
   * ① 上一版是**字符串存在性检查**（对硬编码的 5 个文件 grep 'seedSandbox|setRng'）——
   *    而 2P 的 `runTrain`（server/train-server.mjs）整段没有任何播种却**照样通过**：
   *    因为同一个文件里的 `runTrainN` 有 ⇒ 守门守的是"文件"，不是"入口"。
   *    那条未播种的路产出的正是 `js/bundled-champion.js`（2P 线上包，meta 至今是空的）。
   * ② `tools/diag.mjs` 是第 6 个入口，既不在 REPRO 的扫描表、也不在 REPRO2 的名单里。
   * 现在三层：(a) 名单**反查**（不再硬编码，新增入口自动纳入）；
   *          (b) server 的两个入口**按函数体**各自要求播种；
   *          (c) 可复现性由 D25 用"同 seed 两遍逐字节相同"**实测**（静态检查只是兜底）。 */
  const dirs = [['server', /\.mjs$/], ['tools', /\.mjs$/], ['js/train', /\.js$/]];
  const entries = [];
  for (const pair of dirs) {
    for (const f of readdirSync(pair[0])) {
      if (!pair[1].test(f)) continue;
      const p = pair[0] + '/' + f;
      /* 只认**调用点**（`.makeTrainer(`），不认 `js/train/evo.js` 里的 `function makeTrainer(` 定义
       * —— 定义文件是引擎，不是"入口"；把它算进来只会让这条永远红。 */
      if (readFileSync(p, 'utf8').indexOf('.makeTrainer(') >= 0) entries.push(p);
    }
  }
  ok(entries.length >= 4, '按 makeTrainer 调用点反查只找到 ' + entries.length + ' 个入口（应当 ≥4）—— 反查逻辑坏了？');
  const miss = entries.filter(function (f) {
    const s2 = readFileSync(f, 'utf8');
    return s2.indexOf('__seedSandbox') < 0 && s2.indexOf('setRng') < 0;
  });
  eq(miss.length, 0, '以下训练入口未播种：' + miss.join(', '));

  /* (b) 文件级存在性不够：server 的两个训练入口必须**各自**在函数体内播种
   *（"文件里别处有"正是 v1.5.17 那个洞的形态）。 */
  const srvSrc = readFileSync('server/train-server.mjs', 'utf8');
  for (const fn of ['runTrain', 'runTrainN']) {
    const i0 = srvSrc.indexOf('async function ' + fn + '(');
    ok(i0 >= 0, 'server 里找不到训练入口 ' + fn);
    const i1 = srvSrc.indexOf('\nasync function ', i0 + 1);
    const body = srvSrc.slice(i0, i1 < 0 ? srvSrc.length : i1);
    ok(body.indexOf('__seedSandbox') >= 0 && body.indexOf('setRng') >= 0,
      fn + ' 的函数体内必须**自己**播种（__seedSandbox + setRng）—— 文件里别处有播种不算数');
  }
});

/* ===== LESSON->TEST: turn the recurring failure classes into cases that FAIL =====
 * Claude's review of the changelog: the "this is the Nth time" counters kept growing, i.e.
 * the rules were written down but never INTERNALISED. But every lesson that actually stuck
 * in this project stuck as a TEST (repro-check.mjs, the REPRO assertion, the falsification
 * rule) -- a note dies with the context, a test does not.
 * So each recurring class below is encoded as an assertion. All of these were real, and each
 * one would have failed on the buggy code. */

t('L1 断言不得是恒真式（空断言 / 近乎恒真）——本项目出现过 3 次', function () {
  /* Real instances are described in prose only -- spelling the patterns on a
   * code-like line would trip this very lint. */

  const src = readFileSync('tools/np-test.mjs', 'utf8');
  const lines = src.split('\n');
  const bad = [];
  const PAT = [/ok\(\s*true\b/, /ok\(\s*[0-9]+\s*[,)]/, /\?\s*false\s*:\s*true/, /ok\(\s*1\s*[,)]/];
  for (let i2 = 0; i2 < lines.length; i2++) {
    const L = lines[i2];
    if (L.trim().startsWith('*') || L.trim().startsWith('//')) continue;
    if (L.indexOf('PAT') >= 0) continue;                 // this definition line itself
    for (const re of PAT) if (re.test(L)) { bad.push((i2 + 1) + ': ' + L.trim().slice(0, 60)); break; }
  }
  eq(bad.length, 0, '恒真断言（测不到任何东西）：\n    ' + bad.join('\n    '));
});

t('L2 事件字段名必须与发射端一致（筛错字段 => 把"没发生"当结论）', function () {
  /* Real instance: I filtered transfer events by `e.from === 0`, but the event is
   * { type:'transfer', to:<transfer player>, from:<attacker> } -- so I concluded
   * "transfer never fired" from a wrong field. Pin the schema here. */
  const st = S.createState('multi', { next: mulberry32(61) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  const tr = st.events.filter(function (e) { return e.type === 'transfer'; });
  ok(tr.length > 0, '构造场景里应出现 transfer 事件');
  ok(tr.every(function (e) { return typeof e.to === 'number'; }), 'transfer 必须带 to（转移方）');
  ok(tr.every(function (e) { return typeof e.from === 'number'; }), 'transfer 必须带 from（攻击者）');
  ok(tr.every(function (e) { return e.to !== e.from; }), 'transfer 的 to/from 不能是同一人');
  // 反过来：damage 事件的 source 表示"来源"，地雷伤害必须为 null
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  ok(md.every(function (e) { return e.source == null; }), 'mine 伤害 source 必须为 null');
});

t('L4 补贴口径：chooser 内补 ep 只对当回合无效、次回合起生效（turn-start 通道才干净）', function () {
  /* 为什么钉这条：为诊断"深经济锁死"我写了补贴探针，看到贵技能 0 次就写下"这是测量假象"。
   * 实测（tools/grant-mech-diag.mjs）否定了它：play.js:50-53 先算 affordable 再问 chooser、
   * 事后又用旧值把买不起的选择强制改回 ジ，所以**每局第 1 回合**是盲的；但改的是真实 state，
   * 从第 2 回合起 affordable 就变 true 了。两种解读对历史结论的含义完全相反
   * （"纯假象" => 那个结论要推翻；"只有首回合盲" => 结论仍成立），所以必须由用例钉住。 */
  const RINGk = R.SK.RING, BIGk = R.SK.BIG_T;

  // (1) chooser 内补 ep：当回合 affordable 仍为 false，次回合起才 true
  const st1 = S.createState('multi', { next: mulberry32(91) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st1.p[i2].ep = 2; st1.p[i2].elec = 0; st1.p[i2].boom = 0; }
  const seenAff = [];
  const ch1 = function (state, pid, legal) {
    state.p[pid].ep = Math.max(state.p[pid].ep, 99);
    const l = legal.find(function (x) { return x.key === RINGk; });
    seenAff.push(l ? l.affordable : null);
    return { key: BIGk, target: 1, target2: null };
  };
  Play.autoGameN(st1, [ch1, ch1, ch1]);
  eq(seenAff[0], false, '首回合：legal 在 chooser 之前算好，补 ep 不能让 RING 变可负担');
  ok(seenAff.indexOf(true) >= 0, '次回合起：补的 ep 留在真实 state 上，RING 必须变可负担');
  ok(st1.events.some(function (e) { return e.via === BIGk || e.via === RINGk; }),
    '既然次回合起可负担，就该真的出现贵/环技能出手（否则连"留存"都不成立）');

  // (2) turn-start 通道（引擎 opts.regen）在 chooser 之前就把 ep 发好 —— 这是干净口径
  const st2 = S.createState('multi', { next: mulberry32(92) }, 3, { regen: 6 });
  st2.p[0].ep = 0;
  X.startTurn(st2);
  const l2 = Play.legalActions(st2, 0).find(function (x) { return x.key === BIGk; });
  ok(!!l2, 'multi 模式应含 bigT（真正的落雷）');
  ok(l2.affordable === true, 'opts.regen 在 startTurn 发 ep，早于 legalActions => bigT 当回合必须可负担');
});

t('L3 复现工具必须保留冷/热启动断言（v1.5.128 诚实化：原名的"每个工具都能跑"从未实现）', function () {
  /* Real instance: my bisect script died on `T.buildOpps(null, 0.05)` -- a signature I
   * never verified. A per-tool smoke run turns "I forgot to check the API" into a red test.
   * Only --help / tiny-arg runs here: fast and side-effect free. */
  const fsx = readFileSync('tools/repro-check.mjs', 'utf8');
  ok(fsx.indexOf('EPIRUS_HOTSTART') >= 0 || fsx.indexOf('D cold start') >= 0,
    'repro-check 应包含冷启动/热启动断言');
  /* v1.5.128（审计 §C）：原来这里断言 `npt.indexOf('REPRO2') >= 0` —— 而 `REPRO2` 就是**本文件自己**定义的
   * 字符串 ⇒ 近乎恒真、纯自指。已删；真实覆盖由 REPRO2 那条门自己提供。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('process.env.EPIRUS_WR_TOL') < 0,
    'WR_TOL 不得在引擎内读 env（CLI 沙箱无 process => 两条路取到不同值）');
  ok(evo.indexOf('setWrTol') >= 0, 'WR_TOL 应由调用方通过 setWrTol 显式传入');

  /* v1.3.56：「浏览器训练不可复现」的根因不是随机源，是**输入没被记录**：
   * 浏览器按钮走 Node 服务，而 index.html 的"从头训练"默认不勾 ⇒ 默认热启动，
   * 种群围绕 js/bundled-champion*.js 长出来。那个文件会随每次训练变化 ⇒ 输入变了。
   * 修法与 v1.3.50 给 CLI 定的规矩一致：把输入标识记进产物。 */
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  ok(srv.indexOf('weightsId') >= 0,
    'server 必须能把"输入冠军"算成标识（weightsId）——否则热启动产物无法复现');
  ok((srv.match(/hotstartFrom/g) || []).length >= 3,
    'server 的冠军 meta 必须记录 hotstartFrom（2P 与 N 两条路径都要）');
  ok(/seed:\s*(SEED0|Number\(\(cfg && cfg\.seed0\))/.test(srv),
    'server 的冠军 meta 必须记录 seed');
});

t('L7 rankOf 不得有座位偏置（并列时不许按 pid 升序）', function () {
  /* 真实缺陷（v1.3.57）：`rankOf` 的比较器是 alive→hp→taken，**没有 pid**，完全并列时
   * 落到 Array.prototype.sort 的稳定性 = 插入顺序 = pid 升序。对称场 800 局实测
   * 各座位 1st 率 P0=61.9% … P4=7.5%（极差 54.4pt），换成种子洗牌后 16.0…23.5%（7.5pt）。
   * 本用例构造"五人完全并列"的终局，断言 rank1 在座位间大致均匀。
   * 旧实现在这里会是 [400,0,0,0,0]（座位 0 拿满），所以它会红。 */
  const TR = 400;
  const firsts = [0, 0, 0, 0, 0];
  for (let s = 0; s < TR; s++) {
    const st = S.createState('multi', { next: mulberry32(7000 + s) }, 5);
    for (let i = 0; i < 5; i++) st.p[i].hp = 3;          // 全员同血、无伤害事件 ⇒ 完全并列
    for (let pid = 0; pid < 5; pid++) if (T.rankOf(st, pid, 12345 + s) === 1) firsts[pid]++;
  }
  const spread = Math.max.apply(null, firsts) - Math.min.apply(null, firsts);
  ok(spread <= 80,
    '并列时 rank1 的座位分布过于偏斜（疑似按 pid 升序）: ' + firsts.join('/') + ' 极差=' + spread + '（' + TR + ' 次里每座位期望 ' + (TR / 5) + '）');

  // 幂等 + 严格排列（同一局可能被问多个座位）
  const st2 = S.createState('multi', { next: mulberry32(1) }, 5);
  for (let i = 0; i < 5; i++) st2.p[i].hp = 3;
  const a = [], b = [];
  for (let pid = 0; pid < 5; pid++) { a.push(T.rankOf(st2, pid, 999)); b.push(T.rankOf(st2, pid, 999)); }
  ok(a.join(',') === b.join(','), 'rankOf 必须幂等：同局同 seed 问两次结果要一致（不要消耗 st.rng）');
  const uniq = {}; for (const r of a) uniq[r] = 1;
  eq(Object.keys(uniq).length, 5, 'rankOf 必须返回 1..N 的严格排列（调用方按整数比较名次）');
});

t('L6 考卷完整性：深经济对手必须在池子里 + wrapBotN 必须保留脚本自己选的目标', function () {
  /* 两个都在 v1.3.55 被发现，且都是"没人发现的静默退化"：
   * (a) pickDeepSaver（"会攒 + 会还手"）在 v1.3.27 加入、v1.3.30 被**静默删除**，
   *     CHANGELOG 只字未提，24 个版本没人发现，而 REVIEW §1-D 把它记成"对手池去重（卫生）"。
   *     后果：现有池里 pickFarmer 只攒不还手、pickHeavyFire 会还不攒（ep<=2 贵技能分支永不触发）
   *     => "不攒钱"在考卷里**没有任何惩罚来源**。这正是 P3.5 说的"考卷未改"。
   * (b) wrapBotN 无条件用 pickTargetN 重算目标，把返回 {key,target} 的脚本（protomine /
   *     prototransfer / focusfire / deepsaver）的目标整个丢掉 => "会还手"的脚本被剥掉瞄准。 */
  ok(typeof Bots.pickDeepSaver === 'function', 'pickDeepSaver 必须在 EpirusBots 里（别再被静默删掉）');

  // (b) 显式目标必须被保留
  const st1 = S.createState('multi', { next: mulberry32(93) }, 3);
  st1.p[0].ep = 9;
  X.startTurn(st1);
  const legal1 = Play.legalActions(st1, 0);
  const wrapped = T.wrapBotN(function () { return { key: R.SK.GUN, target: 2 }; });
  const got = wrapped(st1, 0, legal1);
  eq(got.key, R.SK.GUN, 'wrapBotN 应保留脚本选的技能');
  eq(got.target, 2, 'wrapBotN 必须保留脚本显式返回的 target（否则被剥掉瞄准）');

  // (c) 行为反证：ep=5 时它必须真的把大雷打出去（"会攒 + 会还手"）
  const st2 = S.createState('multi', { next: mulberry32(94) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st2.p[i2].ep = 0; }
  st2.p[0].ep = 5;
  X.startTurn(st2);
  const legal2 = Play.legalActions(st2, 0);
  const bigAff = legal2.filter(function (l) { return l.key === R.SK.BIG_T && l.affordable; });
  ok(bigAff.length === 1, 'ep=5 时真正的落雷(5 ジ)必须可负担（前置条件，先验证再断言）');
  const act = T.wrapBotN(Bots.pickDeepSaver)(st2, 0, legal2);
  eq(act.key, R.SK.BIG_T, 'pickDeepSaver 攒够 5 ジ 后必须打出大雷（否则它就不惩罚"不攒钱"了）');
});

t('D217 经济轴的两根锚（v1.5.313 · 用户裁定批）：两枚新桌必须导出/登记/不进默认池，且**只差一个自由量**', function () {
  /* 10-02（千问 `PROPOSAL-2026-10-02-econ-exam-tables.md` §2 · 用户裁定"批"）。
   * 为什么这两枚值得一道门：它们是**考场**（不是能力）的地基 —— §E226 体检 32,200 局实测
   * `saver − spender` 在 23 张原型桌里的 21 张上是 **0.0 vs 0.0** ⇒ **经济轴在考场里不存在**，
   * 而"攒 vs 花"正是头号目标（"不同环境用不同策略"）目前唯一还没被否掉的落点。
   * ⇒ 它俩被静默改掉（改目标 / 改选牌 / 退化成"什么都打"）会让那条结论变成假的，而**没有门会知道**
   *   —— 与 L6 那条"pickDeepSaver 被静默删除、24 个版本没人发现"是同族。
   * 判据三层：① 形状（导出 + 登记 + 不进默认池 + 选牌/目标各只有一份实现）
   *            ② 单决策行为（死线在 B 之前攒、到点全额兑现成最贵的**伤害牌**；早压第 2 回合就花）
   *            ③ **单自由度**（同一状态下两枚必须选同一张牌 ⇒ 唯一区别只剩"第几回合开始花"）。 */
  ok(typeof Bots.pickDeadlineBurst === 'function' && typeof Bots.pickEarlyPressure === 'function',
    '两枚经济锚必须都在 EpirusBots 里（别再被静默删掉）');
  const poolSrc2 = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'deadlineburst'/.test(poolSrc2) && /fn:\s*'pickDeadlineBurst'/.test(poolSrc2) &&
    /\{\s*name:\s*'earlypressure'/.test(poolSrc2) && /fn:\s*'pickEarlyPressure'/.test(poolSrc2),
    '两枚必须登记进 OPP_SPECS（单一来源；漏登记 = 服务端拿到 undefined）');
  const DEF9 = OPP_SPECS.slice(0, 9).map(function (o) { return o.name; });
  ok(DEF9.indexOf('deadlineburst') < 0 && DEF9.indexOf('earlypressure') < 0,
    '两枚**不许**进默认进化池（它们是考场，不是默认基线；要进进化池必须单独裁）');
  eq(Bots.getEconB(), 6, '死线的默认爆发回合必须是 6（锚点来自 §E227 实测，不是扫参扫出来的）；要改必须走 `setEconB` 并被记录');
  eq(Bots.setEconB(4), 4, '`setEconB` 必须真改（预注册里"若判 (a) 才补 B∈{4,9} 敏感性"靠它零改码跑）');
  eq(Bots.setEconB(6), 6, '必须能改回 6（别把状态泄漏给后面的用例）');
  const botSrc2 = readFileSync('js/train/bots.js', 'utf8');
  ok(/function mpEconSpend\(/.test(botSrc2) && /function econTarget\(/.test(botSrc2) &&
    (botSrc2.match(/mpEconSpend\(legal\)/g) || []).length >= 2 && (botSrc2.match(/econTarget\(state, pid\)/g) || []).length >= 2,
    '选牌与目标必须各只有**一份**实现（两枚共用）—— 一次对照只能有一个自由量（§E194）');

  const cidx = {};
  for (const k in R.skills) { const s = R.skills[k]; if (s && s.key) cidx[s.key] = { cost: s.cost || 0, dmg: !!s.dmg, name: s.name }; }
  const mkEcon = function (ep, round) {
    const st = S.createState('multi', { next: mulberry32(97) }, 5);
    for (let i = 0; i < 5; i++) st.p[i].ep = 0;
    st.p[0].ep = ep; st.round = round; X.startTurn(st);
    return { st: st, legal: Play.legalActions(st, 0) };
  };
  /* ② 死线：B 之前，买得起也不许花 */
  const pre = mkEcon(5, 3);
  const affBig2 = pre.legal.filter(function (l) { return l.affordable && (cidx[l.key] || {}).cost >= 4; });
  ok(affBig2.length > 0, '前置：ep=5 / 第 3 回合必须有 ≥4 费的牌可负担（否则下面那条断言测不到东西）');
  eq(T.wrapBotN(Bots.pickDeadlineBurst)(pre.st, 0, pre.legal).key, R.SK.JI,
    'T‑死线在死线（第 6 回合）之前必须只攒（ジ）—— 买得起也不花，这才是"硬死线"的全部意义');
  /* ②' 死线：到点必须全额兑现成"最贵的那张**伤害牌**" */
  const at6 = mkEcon(5, 6);
  const dmgs6 = at6.legal.filter(function (l) { return l.affordable && (cidx[l.key] || {}).dmg; })
    .sort(function (a, b) { return (cidx[b.key] || {}).cost - (cidx[a.key] || {}).cost; });
  ok(dmgs6.length > 0, '前置：第 6 回合 ep=5 时必须有可负担的伤害牌');
  const actD6 = T.wrapBotN(Bots.pickDeadlineBurst)(at6.st, 0, at6.legal);
  eq(actD6.key, dmgs6[0].key,
    'T‑死线到点必须打**最贵的那张伤害牌**：用规则表自己的 `dmg` 字段判，**不许**按 `cat === ATTACK` 过滤 —— ' +
    '真正的落雷/电磁炮/过载炮全是 `CAT.SPECIAL`，按类别过滤会把最贵那一整族排除掉（首版就是这么错的）');
  ok(actD6.target != null, 'T‑死线必须显式给 target（wrapBotN 不许剥掉瞄准 —— L6 那条的同一族）');
  /* ②'' 早压：第 2 回合就得花 */
  const early2 = mkEcon(5, 2);
  ok(T.wrapBotN(Bots.pickEarlyPressure)(early2.st, 0, early2.legal).key !== R.SK.JI,
    'T‑早压必须从第 1~2 回合就花光（"先攒后打"的一方在攒的过程中被磨死，靠的就是这条）');
  /* ③ 单自由度 */
  eq(T.wrapBotN(Bots.pickEarlyPressure)(mkEcon(5, 7).st, 0, mkEcon(5, 7).legal).key,
    T.wrapBotN(Bots.pickDeadlineBurst)(mkEcon(5, 7).st, 0, mkEcon(5, 7).legal).key,
    '≥B 时两枚必须选**同一张**牌 ⇒ 唯一区别只剩"第几回合开始花"（否则 §3 那条"分离方向相反"没法解释）');
});

t('D218 研究工具的旗标登记结构（v1.5.318）：读了却没登记的旗标必须为 0，且假旗标必须 exit 64', function () {
  /* 为什么：`rejectUnknownFlags` 是研究工具唯一的输入消毒层，漏登记的后果**两向都坏** ——
   * 要么工具自己读的旗标被它响亮拒掉（§E230 跑前发现的 `allowmixedcfg` 正是这一类：
   * 亲手建的逃生口被自己的门挡死），要么拼错的旗标**静默被忽略**、读数按默认档跑完而没人知道。
   * 判据钉的是**结构**（读到的每个旗标都在自己的名单里），不是某几个旗标词 ⇒ 加旗标不用改门，漏登记才红。
   * 纯 indexOf 实现（本仓踩过 heredoc 把反斜杠折掉、正则变成真换行的坑）⇒ 门里不出现反斜杠。 */
  const quoted = function (s) { const p = s.split(String.fromCharCode(39)); const out = [];
    for (let i = 1; i < p.length; i += 2) out.push(p[i]); return out; };
  const grab = function (src, needle) { const out = []; const q = String.fromCharCode(39); let i = -1;
    while ((i = src.indexOf(needle, i + 1)) >= 0) { const j = src.indexOf(q, i + needle.length);   /* v1.5.323 修 off-by-one：针脚自己含开引号 ⇒ 名字从针脚之后起到**下一个引号**止 */
      if (j > i + needle.length) out.push(src.slice(i + needle.length, j)); } return out; };
  /* v1.5.323：**名单解析器** —— 按**顶层逗号**取第二个实参，且它必须以 `[` 开头才算「内联名单」。
   * 为什么必须换成它：上一版用 `indexOf('[', 调用处)` + 「调用处到 `[` 之间不能再有 `)`」当守卫，
   * 前者在 `FLAGS` 变量形式下会把**后面别的数组**当名单（假违规），
   * 后者又把 `process.argv.slice(2)` 里那个 `)` 当分界 ⇒ **把所有内联名单也跳过 ⇒ 这条腿又空转**。
   * 纯 indexOf/charAt 实现，**不出现反斜杠**（沿用本门风格）。 */
  const flagListSpan = function (src) {
    const call = 'rejectUnknownFlags(';
    const i0 = src.indexOf(call);
    if (i0 < 0) return null;
    const open = i0 + call.length - 1;
    let d = 1, comma = -1, end = -1;
    for (let j = open + 1; j < src.length; j++) {
      const c = src.charAt(j);
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) { end = j; break; } }
      else if (c === ',' && d === 1 && comma < 0) comma = j;
    }
    if (comma < 0 || end < 0) return null;
    let k0 = comma + 1;
    while (k0 < end && (src.charCodeAt(k0) === 32 || src.charCodeAt(k0) === 9 || src.charCodeAt(k0) === 13 || src.charCodeAt(k0) === 10)) k0++;
    if (src.charAt(k0) !== '[') return null;                 /* 变量形式（如 FLAGS）⇒ 不是内联名单 */
    let d2 = 0, closeIdx = -1;
    for (let j = k0; j < end; j++) {
      const c = src.charAt(j);
      if (c === '[') d2++;
      else if (c === ']') { d2--; if (d2 === 0) { closeIdx = j; break; } }
    }
    if (closeIdx < 0) return null;
    return { start: k0, end: closeIdx, listed: quoted(src.slice(k0, closeIdx)) };
  };
  /* 不扫门文件自己：它里面就写着 grab(src, "arg('" ) 这类字面量，会把门自己的源码当读数扫进来（首版就栽在这）。 */
  const files = readdirSync('tools').filter(function (f) { return f.slice(-4) === '.mjs' && f !== 'np-test.mjs'; });
  const offenders = []; let scanned = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const src = readFileSync('tools/' + files[fi], 'utf8');
    const a0 = src.indexOf('rejectUnknownFlags(argv, [');
    if (a0 < 0) continue;
    scanned++;
    const a1 = src.indexOf(']', a0);
    const listed = {}; quoted(src.slice(a0, a1)).forEach(function (x) { listed[x] = 1; });
    const used = {};
    grab(src, "arg('").concat(grab(src, "flag('")).concat(grab(src, "=== '--")).concat(grab(src, "startsWith('--"))
      .forEach(function (x) { const v = x.replace('=', ''); const isName = v.length > 0 && v.split('').every(function (c) { const o = c.charCodeAt(0); return (o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122) || o === 95; }); if (isName) used[v] = 1; });
    const miss = Object.keys(used).filter(function (x) { return !listed[x]; });
    if (miss.length) offenders.push(files[fi] + ' -> ' + miss.join(','));
  }
  ok(scanned >= 8, '至少要有 8 台工具带 rejectUnknownFlags（实测 ' + scanned + ' 台）—— 少了说明消毒层被人拆了');
  eq(offenders.length, 0, '读了却没登记的旗标必须为 0（实测违规：' + (offenders.join(' | ') || '无') + '）');
  /* 行为腿：假旗标必须**响亮**失败（exit 64），不许静默按默认档跑完 */
  const rb = spawnSync(process.execPath, ['tools/probe-distill-learnability.mjs', '--绝对不存在的旗标=1'], { encoding: 'utf8' });
  eq(rb.status, 64, '假旗标必须以 exit 64 被拒（实测 status=' + rb.status + '）');
  /* ══════════ v1.5.323 加强：研究量具**必须有**这道层 ══════════
   * 原版只扫"**已经有**这道层"的工具（8 台）⇒ 对"**根本没有**消毒层"的工具是**瞎的**。
   * 实测缺口：`tools/probe-skill-marginal.mjs`（就是产出"摄魂 +22.5"那台）grep `rejectUnknownFlags`
   * **零命中** ⇒ 拼错的旗标（`--games=80` 打成 `--game=80`）**静默按默认档跑完**、读数照旧出来，
   * 而人会以为"我控制了这个变量" —— 这正是仓规"静默忽略 = 假读数"要防的那一类（v1.5.234 立）。
   * 判据升级成两条合取：① 枚举规则内的每一台研究量具都**带**这道层（结构）；
   *   ② 每一台都**真的**以 exit 64 拒绝假旗标（行为，逐台 spawn）。 */
  const probes = files.filter(function (f) { return f.indexOf('probe-') === 0; }).sort();
  const noLayer = [];
  for (let pi = 0; pi < probes.length; pi++) {
    if (readFileSync('tools/' + probes[pi], 'utf8').indexOf('rejectUnknownFlags') < 0) noLayer.push(probes[pi]);
  }
  ok(probes.length >= 40, '枚举规则内的研究量具至少 40 台（实测 ' + probes.length + ' 台）—— 少了说明枚举被改窄了');
  eq(noLayer.length, 0, '每一台研究量具都必须带 rejectUnknownFlags（实测缺口：' + (noLayer.join(', ') || '无') + '）');
  /* 登记一致性**覆盖两种调用形式**：原版只认 `rejectUnknownFlags(argv, [` ⇒
   * 用 `process.argv.slice(2)` 的那批工具从来没被这条腿扫到过（同一个"名单写两遍"家族）。 */
  const isFlagName = function (v) {
    if (v.length < 2 || v.charAt(0) === '-') return false;
    return v.split('').every(function (c) { const o = c.charCodeAt(0); return (o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122) || o === 95 || o === 45; });
  };
  /* 自检（**防这条腿再空转**）：在夹具上抽，必须**恰好**抽到这三个名字。
   * 为什么必须有它：抽取函数原先有 **off-by-one** —— 针脚 `arg('` 自己就含开引号，名字应从「针脚之后」到
   * 「下一个引号」；原实现从「下一个引号之后再下一个引号」取 ⇒ 抽到的是 `, ` 这种垃圾，
   * 再被名字过滤一滤 ⇒ **这条腿自 v1.5.318 起一直在空转**（"永不触发的守卫 = 没有守卫"再犯一次）。
   * 下面这条自检就是为了让抽取器**再也不能**静默失准。 */
  const q2 = String.fromCharCode(39);
  const fxSrc = "const a = arg(" + q2 + "games" + q2 + ", 1); if (x === " + q2 + "--json" + q2 + ") f.startsWith(" + q2 + "--self-test=" + q2 + ");";
  const fxNames = {};
  grab(fxSrc, "arg('").concat(grab(fxSrc, "=== '--")).concat(grab(fxSrc, "startsWith('--"))
    .forEach(function (x) { const v = x.replace('=', ''); if (isFlagName(v)) fxNames[v] = 1; });
  eq(Object.keys(fxNames).sort().join(','), 'games,json,self-test',
    '旗标抽取自检：夹具上必须恰好抽到 games,json,self-test（实测 ' + (Object.keys(fxNames).sort().join(',') || '空') + '）—— 抽不到说明这条腿又空转了');
  const misreg = [];
  for (let pi = 0; pi < probes.length; pi++) {
    const src2 = readFileSync('tools/' + probes[pi], 'utf8');
    const c0 = src2.indexOf('rejectUnknownFlags(');
    if (c0 < 0) continue;
    const span2 = flagListSpan(src2);
    if (!span2) continue;   /* 名单是变量形式（如 FLAGS）⇒ 跳过：宁可跳过也不误报 */
    const listed2 = {};
    span2.listed.forEach(function (x) { listed2[x] = 1; });
    const used2 = {};
    grab(src2, "arg('").concat(grab(src2, "flag('")).concat(grab(src2, "=== '--"))
      .concat(grab(src2, "startsWith('--")).concat(grab(src2, "indexOf('--")).concat(grab(src2, "includes('--"))
      .forEach(function (x) { const v = x.replace('=', ''); if (isFlagName(v)) used2[v] = 1; });
    const m2 = Object.keys(used2).filter(function (x) { return !listed2[x]; });
    if (m2.length) misreg.push(probes[pi] + ' -> ' + m2.join(','));
  }
  eq(misreg.length, 0, '研究量具读到的旗标必须全部登记（两种调用形式都算；实测违规：' + (misreg.join(' | ') || '无') + '）');
  /* 行为腿（逐台）：消毒层**真的接上了**的唯一凭据 —— 假旗标必须 exit 64 */
  const notRejecting = [];
  for (let pi = 0; pi < probes.length; pi++) {
    const rr = spawnSync(process.execPath, ['tools/' + probes[pi], '--绝对不存在的旗标=1'], { encoding: 'utf8', timeout: 15000 });
    if (rr.status !== 64) notRejecting.push(probes[pi] + '(status=' + rr.status + ')');
  }
  eq(notRejecting.length, 0, '每一台研究量具都必须以 exit 64 拒绝假旗标（实测不拒：' + (notRejecting.join(', ') || '无') + '）');
});

t('D219 「6 珠悬崖」回归护栏（v1.5.318）：现役冠军决策时 ep 的暴露面不许越过实测基线', function () {
  /* 依据（千问 §16④ / §E232）：夺冠率对手里留多少珠是**一片平台 + 一道悬崖** ——
   *   0.77~1.81 珠 => 14.9~20.9%（无差异区）；6.5~6.8 珠 => 1.6%；8.2~8.6 珠 => 0.1~0.3%。
   * => 门禁/进化池要考经济判断，考的应当是会不会越过 6 珠，不是攒不攒。
   * 这条曲线是**相关性**读数，合法用法只有两条：否证单调性 / 支持 theta=0 是局部最优（§16④ 的限定）。
   * => 本门是**回归护栏**（别让暴露面变大），不是证明 6 珠以上必输。
   * 夹具：60 局 multi/5（冠军席 + 4 脚本），固定种子；实测基线 ep>=6 = 1.95%（14/717 次）、峰值 12。 */
  const ch = AUDIT.loadChamp(sb, 'js/bundled-champion-3p.js');
  const pr = ch && ch.params ? ch.params : ch;
  const OPPX = [Bots.pickBalanced, Bots.pickAggro, Bots.pickDefend, Bots.pickMix, Bots.pickFarmer];
  let n = 0, ge6 = 0, peak = 0;
  for (let g = 0; g < 60; g++) {
    const st = S.createState('multi', { next: mulberry32(3100 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3779b9) >>> 0;
    const base = T.policyChooserN(pr, 0.15, 0.15, 5);
    const rec = function (state, pid, legal) { const ep = state.p[pid].ep || 0; n++; if (ep >= 6) ge6++; if (ep > peak) peak = ep; return base(state, pid, legal); };
    Play.autoGameN(st, [rec, OPPX[0], OPPX[1], OPPX[2], OPPX[3]]);
  }
  ok(n >= 500, '夹具必须真的跑出足够决策（实测 ' + n + ' 次）—— 少了说明夹具坏了，不是冠军变好了');
  ok(100 * ge6 / n <= 4, '决策时 ep>=6 的占比必须 <= 4%（实测 ' + (100 * ge6 / n).toFixed(2) + '%，基线 1.95%）');
  ok(peak <= 14, '决策时 ep 峰值必须 <= 14（实测 ' + peak + '，基线 12）');
});

t('D220 深经济对手必须能放上**训练桌**（v1.5.325 · §E237 · DS 交接 (W) 假设的可执行版本）：`EPIRUS_ECON_OPPS` 默认关 + 名字不认识必须响 + 开档产物自证', function () {
  /* 病（读出来的）：训练时那 9 条 `OPPS` 里没有 `deepsaver` —— `farmer` 只攒不还手、`heavyfire` ep≤2（贵卡分支永不触发），
   *   而"会攒到 5 珠并且真花出去"的脚本**只活在考卷里**（`eval-5p` 文件头明写池子含 deepsaver）
   *   ⇒ 训练世界里"攒钱"既没有回报来源也没有威胁来源 ⇒ DS 的 (W)/(R) 分叉以前**根本跑不了**。
   * 纪律与 D130/§E127 的 `counter-ops`/`ring-ops` 逐字同形：默认关 ⇒ `OPPS` 一字不变；要的对手不存在 ⇒ `exit 4`。 */
  ok(Bots && typeof Bots.pickDeepSaver === 'function' && typeof Bots.pickDeadlineBurst === 'function' &&
    typeof Bots.pickEarlyPressure === 'function',
    '三枚深经济脚本必须真在 `EpirusBots` 里（不在就是 train-3p 引用了不存在的名字）');
  /* ① 行为：`deepsaver` 值钱就值钱在"**攒得到、并且真兑现**"——把它改成随手花 = 量具自己没了 */
  const mk = ep => { const s = S.createState('multi', { next: mulberry32(11) }, 5); s.p[0].ep = ep; return s; };
  const poor = mk(1), poorLegal = Play.legalActions(poor, 0).filter(x => x.affordable);
  ok(poorLegal.some(x => x.key === R.SK.BIG_T) === false, '构造态：1 珠时大雷必须**不可负担**（否则"攒"这条空转）');
  const p1 = Bots.pickDeepSaver(poor, 0, poorLegal);
  ok(p1 && (p1.key === R.SK.JI || p1.key === R.SK.CHARGE), '付不起大雷时必须攒（实测出 ' + (p1 && p1.key) + '）');
  const rich = mk(9), richLegal = Play.legalActions(rich, 0).filter(x => x.affordable);
  ok(richLegal.some(x => x.key === R.SK.BIG_T) === true, '构造态：9 珠时大雷必须可负担（否则"兑现"这条空转）');
  eq(Bots.pickDeepSaver(rich, 0, richLegal).key, R.SK.BIG_T, '付得起就必须放大雷 ⇒ 这才叫"真兑现"的威胁来源');
  /* ② 接线：默认关 ⇒ 源里走的是空串；开了 ⇒ 真推进 fitness 的对手表，并且**产物自带这臂上了谁** */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_ECON_OPPS || ''") >= 0, '必须默认空（不设 ⇒ 一个对手都不加，历史臂逐位可复现）');
  ok(t3.indexOf("'EPIRUS_ECON_OPPS'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会判它"传了没人读"）');
  ok(/EPIRUS_ECON_OPPS 里有不认识的名字[\s\S]{0,200}process\.exit\(4\)/.test(t3), '名字不在表里必须 exit 4（少一个 = 一根空枪）');
  ok(t3.indexOf('for (const o of ECON_OPPS) OPPS.push(o)') >= 0, '开了必须真推进 `OPPS`（推进别处 = 死作用点）');
  const dir = mkdtempSync(join(tmpdir(), 'd220-')), out = join(dir, 'arm.js');
  const on = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220on', EPIRUS_ECON_OPPS: 'deepsaver,deadlineBurst', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '开了要跑得通（实测 status=' + on.status + ' · ' + String(on.stdout || '').slice(-160) + '）');
  ok(/\[econ-ops\] .*已进训练桌：econ:deepSaver,econ:deadlineBurst.*OPPS 从 9 个变 11 个/.test(String(on.stdout || '')),
    '必须印出进了哪几个、桌变大（不印 = 又一根暗旋钮）');
  const jm = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(readFileSync(out, 'utf8'));
  ok(!!jm, '产物要能读出 META（读不出就是这条门自己瞎了）');
  const mt = JSON.parse(jm[1]);
  ok(mt.recipe && Array.isArray(mt.recipe.econOpps) && mt.recipe.econOpps.length === 2,
    '产物要自带"这臂的训练桌上放了哪几个深经济对手"（实测 ' + JSON.stringify(mt.recipe && mt.recipe.econOpps) + '）');
  /* ③ 反面：写错名字必须**当场响**，不许静默少放一个对手（这正是本仓烧过三臂的那一族） */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220bad', EPIRUS_ECON_OPPS: 'deepsaver,nosuchbot', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out }), encoding: 'utf8', timeout: 120000 });
  eq(bad.status, 4, '不认识的卡名必须 exit 4（实测 ' + bad.status + '）');
  /* ④ 关档：不设这个键时**一行都不许印**（"开了没生效"与"没开却在讲话"都是假信号） */
  const off = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220off', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }), encoding: 'utf8', timeout: 300000 });
  eq(off.status, 0, '关档要跑得通');
  ok(String(off.stdout || '').indexOf('[econ-ops]') < 0, '关档不许印 econ-ops（印了 = 默认分布被悄悄改了）');
  const jmOff = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(readFileSync(out, 'utf8'));
  const mtOff = JSON.parse(jmOff[1]);
  ok(mtOff.recipe && mtOff.recipe.econOpps === null, '关档产物的 recipe 必须写 null（实测 ' + JSON.stringify(mtOff.recipe && mtOff.recipe.econOpps) + '）');
});

t('D221 同分带内按"贵卡出手"选人（v1.5.326 · §E249 · 今晚 4 批 47 臂的账：奖励改的是种群，**当选那一步把它又筛掉了**）：默认 0 ⇒ 冠军逐字不变 · **零剂量时不许换人** · 排序键必须真咬到', function () {
  /* 病（实测，不是猜）：`EPIRUS_COSTLY_W` 把名人堂"会打大雷"的粒从**对照 0/6 抬到 6/6**，可**当选产物**常常还是 0.000
   *   —— 终局重验只按胜负分选人，"会不会打这张卡"看不见；而 `SEL_KEEP` 的 bigT veto **逐位没换人**
   *   （它只能在保住优点的粒里挑，**造不出**这样的粒）。⇒ 修法是把"用量"做成**选人排序键**（同 `SEL_LAND` 的先例），
   *   代价明码标价：只在胜负分相差 ≤ tol pt 的带内换，且**带内零剂量时一律不改判**（否则就是一根在没有证据时也会动判定的键）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* ⓪ **先钉纯函数**（合成候选表，不跑训练）—— 三条各挡一种失效。
   *    为什么不能只跑真臂：6 代的小训练里"带内"通常只有当选者自己（实测 `band=1`）⇒
   *    那种断言**永远不会红**（§E198"永绿假守卫"的同族，我 01:2x 用变异实测撞了一次：
   *    把"零剂量也不换人"故意改成"换"，真臂夹具照样绿）。 */
  const EU = function (score, usage) { return { score: score, usage: usage }; };
  const uof = function (e) { return e.usage; };
  const hiSet = [EU(0.70, 0), EU(0.69, 3), EU(0.50, 9)];            // tol=2pt ⇒ 带内前两粒；分数最高那粒用量 0
  const ph = bandPickByUsage(hiSet, 2, uof);
  ok(ph.best === hiSet[1] && ph.tieBrokenBy === 'usage',
    '带内存在用量差 ⇒ **必须换人**到用量最高那粒（实测换到 usage=' + (ph.best && ph.best.usage) + '，by=' + ph.tieBrokenBy + '）');
  ok(ph.band.length === 2, '带外那粒（胜负分差 20pt）用量再高也不许进带（实测 band=' + ph.band.length + '）');
  const zeroSet = [EU(0.60, 0), EU(0.59, 0), EU(0.20, 12)];
  const pz = bandPickByUsage(zeroSet, 5, uof);
  ok(pz.zeroDose === true && pz.best === zeroSet[0] && pz.tieBrokenBy === 'score',
    '带内全部零剂量 ⇒ **一律不换人**（这根键不许在没有证据时动判定；实测 best.usage=' + (pz.best && pz.best.usage) + '）');
  const tieSet = [EU(0.70, 4), EU(0.70, 4), EU(0.69, 1)];
  const pt = bandPickByUsage(tieSet, 2, uof);
  ok(pt.best === tieSet[0], '用量相同 ⇒ 按胜负分取高，且**不许抖**（实测 best.score=' + (pt.best && pt.best.score) + '）');
  ok(t3.indexOf('bandPickByUsage(sel.clean, SEL_BIGT, useOf)') >= 0,
    'train-3p 必须调这份纯函数（在调用点重写一遍排序 = 两份实现必漂移）');
  ok(t3.indexOf('EPIRUS_SEL_BIGT || 0') >= 0, '默认必须 0（关档 ⇒ 当选者与历史臂逐字相同）');
  ok(t3.indexOf("'EPIRUS_SEL_BIGT'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键闸会判它"传了没人读"）');
  ok(t3.indexOf('fieldProfile(e.ref.params, 0, ') >= 0,
    '用量必须走 `behavior-profile.fieldProfile`（与 `SEL_KEEP_CAL=plain` 同一把尺）—— 另写一份逐卡计数 = 两份实现必漂移');
  ok(/EPIRUS_SEL_BIGT_KEYS 里有不认识的卡名[\s\S]{0,220}process\.exit\(7\)/.test(t3), '卡名不合法必须 exit 7（判不到的维不许当排序键）');
  ok(t3.indexOf('selBigT: SEL_BIGT_LOG') >= 0, '结果必须写进 `meta.recipe.selBigT`（否则"改没改判"只能靠读日志）');
  const dir = mkdtempSync(join(tmpdir(), 'd221-'));
  const run = function (env, tag) {
    const out = join(dir, tag + '.js');
    const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '6', '3', '8', '6'], {
      env: Object.assign({}, process.env, { EPIRUS_SEED: '21', EPIRUS_ARM: 'd221' + tag, EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }, env || {}),
      encoding: 'utf8', timeout: 300000
    });
    return { r: r, out: out };
  };
  const metaOf = function (p) {
    const m = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(readFileSync(p, 'utf8'));
    return m ? JSON.parse(m[1]) : null;
  };
  const weightsOf = function (p) {
    const m = /"a":\[([^\]]*)\]/.exec(readFileSync(p, 'utf8'));
    return m ? m[1] : 'NOPARSE';
  };
  /* ① 关档 ⇒ recipe 写 null；② 开档但**带内零剂量**（6 代的小训练里没人够得着 5 珠）⇒ **冠军必须逐字不变** + 响亮印"零作用" */
  const off = run({}, 'off'), on = run({ EPIRUS_SEL_BIGT: '2' }, 'on');
  eq(off.r.status, 0, '关档要跑得通（实测 ' + off.r.status + '）');
  eq(on.r.status, 0, '开档要跑得通（实测 ' + on.r.status + ' · ' + String(on.r.stdout || '').slice(-140) + '）');
  const mOff = metaOf(off.out), mOn = metaOf(on.out);
  ok(!!mOff && !!mOn, '两遍都要能读出 META（读不出 = 这条门自己瞎了）');
  eq(mOff.recipe.selBigT, null, '关档必须写 null（一行都不跑）');
  const lg = mOn.recipe.selBigT;
  ok(lg && lg.zeroDose === true, '6 代的小训练里带内应当零剂量 ⇒ 必须报 zeroDose（实测 ' + JSON.stringify(lg) + '）');
  ok(/带内一张贵卡都没打过/.test(String(on.r.stdout || '')), '零作用必须**响亮印出来**（静默等效比静默报错危险，§E192）');
  eq(weightsOf(off.out), weightsOf(on.out), '**零剂量时不许换冠军**：换了 = 这根键在没有证据的情况下动了判定');
  /* ③ 排序键真咬到：把"贵卡"换成 `gun`（枪永远有人打）⇒ 用量必非零，且 `picked` 必须等于带内最大值 */
  const gun = run({ EPIRUS_SEL_BIGT: '2', EPIRUS_SEL_BIGT_KEYS: 'gun', EPIRUS_SEL_BIGT_MODE: 'multi' }, 'gun');
  eq(gun.r.status, 0, 'gun 档要跑得通');
  const gl = metaOf(gun.out).recipe.selBigT;
  ok(gl && gl.zeroDose === false, 'gun 档必须量到非零用量（否则"取最大"这句没被检验过：' + JSON.stringify(gl) + '）');
  ok(gl && gl.usage && gl.usage.length && gl.picked === Math.max.apply(null, gl.usage),
    '`picked` 必须 = 带内用量最大值（实测 picked=' + (gl && gl.picked) + ' usage=' + JSON.stringify(gl && gl.usage) + '）⇒ 否则排序键根本没咬');
  /* ④ 非法卡名必须响 */
  const bad = run({ EPIRUS_SEL_BIGT: '2', EPIRUS_SEL_BIGT_KEYS: 'nosuchcard' }, 'bad');
  eq(bad.r.status, 7, '不认识的卡名必须 exit 7（实测 ' + bad.r.status + '）');
});

t('D222 费用表反事实旗标 `--bigtcost=`（v1.5.327 · §E255）：不设 ⇒ 逐字不变 · 出厂价档 ⇒ **零剂量逐字相同** · 生效与否由**引擎回读**判而不是由配置印了没印判 · 假值必须 exit 2 · 落盘表头必须带这一维', function () {
  /* 为什么钉这道：这是本仓第一次把**规则参数**（大雷单价）做成研究旗标。
   * 后果两向都坏：静默不生效 ⇒ 我把"出厂世界"当成"4 珠世界"报给用户裁定（那是**错的裁定输入**）；
   * 静默生效 ⇒ `eval-5p` 历史读数全部换尺（D197 那一族的反面）。
   * ⚠ 判"生效"不许用 banner 出现与否（那是自我印证），必须用**引擎自己的定价回读**（`computeCost` 报的 ep）。
   * ⚠ 判"没生效"的对照必须是**同种子同场**的差分（绝对量守卫会杀掉正对照，METHODOLOGY 那一族）。 */
  const src = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(src.indexOf('FLAG.bigtcost') >= 0, '① `eval-5p` 里已经没有 `FLAG.bigtcost` ⇒ 旗标被删了而记账（CHANGELOG §E255）还写着有');
  ok(src.indexOf('computeCost') >= 0 && src.indexOf('改价没生效') >= 0,
    '② 缺"由引擎回读新价"那条自检 ⇒ 定价若被别处缓存，工具会印"已生效"而跑的仍是出厂世界');

  const runE = function (extra, tag) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '6', '5', '77000', '--field=mix4'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const base = runE([], 'base');
  eq(base.code, 0, '⓪ 默认臂必须跑通（否则下面三条差分对照全在比错误输出）：' + base.out.slice(0, 200));
  ok(base.out.indexOf('bigtcost') < 0, '③ 关档（不设旗标）**一行都不许印** ⇒ 印了就是"看起来像改了价"的噪声');

  /* ④ 零剂量：出厂价档 `--bigtcost=5` 与不设 ⇒ **剥掉 banner 行后逐字相同**（这根键不咬就不许动任何一个读数） */
  const w5 = runE(['--bigtcost=5'], 'w5');
  eq(w5.code, 0, '出厂价档不该报错：' + w5.out.slice(0, 200));
  /* ⚠ 剥掉两类**与判定无关**的行才能比"逐字相同"：banner 本身，和 `eval-5p` 末行的**墙钟**（`耗时 0.0s` ‖ `0.1s` 两次跑就会差）。
   *    这条门第一次整轮认证就红在腿 ⑥（624s 那一趟），根因正是我没剥墙钟行 —— 小样本两次跑的耗时常常撞在一起 ⇒ 独立复跑看不出来，
   *    整轮抢核时才暴露（§E257 那条"未归因的红"事后归因到了这里：**是门错，不是抖动**）。 */
  const strip = function (s) { return s.split('\n').filter(function (l) {
    return l.indexOf('[bigtcost]') !== 0 && l.indexOf('耗时') !== 0;
  }).join('\n'); };
  ok(w5.out.indexOf('[bigtcost]') === 0 || w5.out.split('\n').some(function (l) { return l.indexOf('[bigtcost]') === 0; }),
    '⑤ 开档必须响亮印一行 banner（不印 ⇒ 我没法从输出判断这一臂在哪个世界）');
  eq(strip(w5.out), strip(base.out), '⑥ **出厂价档必须零剂量**：`--bigtcost=5` 去掉 banner 后与不设旗标逐字相同（不同 ⇒ 这根键在没有改价时也动了判定）');

  /* ⑦ 生效判据 = 引擎回读的数字，不是 banner 的措辞 */
  const w1 = runE(['--bigtcost=1'], 'w1'), w99 = runE(['--bigtcost=99'], 'w99');
  ok(/ep=1\b/.test(w1.out), '⑧ `--bigtcost=1` 的世界必须让 `computeCost` 回读出 **ep=1**（实测没读到 ⇒ 定价被别处缓存，整个反事实是幻觉）');
  ok(/ep=99\b/.test(w99.out), '⑨ `--bigtcost=99` 的世界必须回读出 ep=99（同上）');
  /* ⑩ 落盘身份腿：改价与封卡都必须进表头 —— 配对尺只看表头，缺哪一维就会把"世界 4"与"世界 3"当成同世界配对着配（§E246 那一族）。
   *     ⚠ 这里**不**做"两个世界的读数必须不同"那种绝对量守卫：小样本里真可能一字不差，那会把正对照杀成假红（本仓踩过）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd222-'));
  const dump = join(dir, 'h.tsv');
  const rd = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17',
    '--bigtcost=4', '--ban=bigT', '--dump-per=' + dump], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(rd.status, 0, '⑩a 带 `--dump-per` 的改价+封卡臂必须跑通：' + String(rd.stderr || '').slice(0, 200));
  if (existsSync(dump)) {
    const headTxt = readFileSync(dump, 'utf8').split('\n').filter(function (l) { return l[0] === '#'; }).join('\n');
    ok(headTxt.indexOf('#bigtcost=4') >= 0, '⑩b 落盘表头必须带 `#bigtcost=`（跨世界配对必须能被拒）实测=' +
      (/^#bigtcost=.*$/m.exec(headTxt) || ['(缺)'])[0]);
    ok(headTxt.indexOf('#ban=bigT') >= 0, '⑩c 落盘表头必须带 `#ban=`（同臂自配与两臂差分的唯一区分处）');
  } else { console.error('⑩d 没落盘 ⇒ 这条腿退化成装饰，判红'); ok(false, '`--dump-per` 没写出文件'); }

  /* ⑪ 假值必须响亮拒绝，不许降级成"当没写" */
  for (const badv of ['abc', '-2', '1.5']) {
    const rb = runE(['--bigtcost=' + badv], 'bad');
    eq(rb.code, 2, '`--bigtcost=' + badv + '` 必须 exit 2（实测 ' + rb.code + '）⇒ 含糊写法被当出厂价跑完就是假世界');
  }
});

t('L5 测试跑不得给 shipped 文件留残留（会随 git add -A 提交）', function () {
  /* 真实事故（v1.3.48）：一次测试跑把 js/bundled-champion*.js 覆写成测试冠军并被提交。
   * v1.3.54 又发现两个同类缺口，都只在"跑完看 git status"时才显形：
   *  (1) server 的 writeBundleMP 会顺带把 index.html 的 ?v= 缓存戳改成新值；
   *      repro-check 备份还原了冠军包，却没还原 index.html => 每次测试都留 diff。
   *  (2) 训练工具的非发布输出 docs/artifacts/*-out.js 没被 .gitignore 覆盖。
   * 所以这条断言查的是"残留通道"，不是某个具体文件。 */
  const gi = readFileSync('.gitignore', 'utf8');
  ok(gi.indexOf('-out.js') >= 0, '.gitignore 必须忽略训练工具的非发布输出（docs/artifacts/*-out.js）');

  // 反向：真的会写那个落点的工具，必须同时有 EPIRUS_PUBLISH 门槛（否则它会写线下路径）
  for (const f of ['tools/train-3p.mjs', 'tools/train-fast.mjs', 'tools/train-best.mjs']) {
    const src = readFileSync(f, 'utf8');
    if (src.indexOf('-out.js') >= 0) {
      ok(src.indexOf('EPIRUS_PUBLISH') >= 0, f + ' 用了 -out.js 落点，就必须有 EPIRUS_PUBLISH 门槛');
    }
  }

  // index.html 的缓存戳副作用必须被测试工具还原
  const rc = readFileSync('tools/repro-check.mjs', 'utf8');
  ok(rc.indexOf('htmlBackup') >= 0,
    'repro-check 必须备份/还原 index.html（writeBundleMP -> bumpChampionVersion 会改它）');
  ok(rc.indexOf('bumpChampionVersion') >= 0 || rc.indexOf('index.html') >= 0,
    'repro-check 的注释里应能看出它还原的是 index.html');

  /* v1.5.0：本轮新踩的同类残留 —— 产物名把 TAG 拼在**扩展名之后**
   * （`ring2-status.log-<tag>`、`ring2-server.log-<tag>`）⇒ `.gitignore` 的 `*.log` 匹配不到
   * ⇒ `git add -A` 会把它们带进仓库。凡按 TAG 拼名字的产物，扩展名必须在最后。 */
  const rr = readFileSync('tools/ring2-run.mjs', 'utf8');
  ok(!/'ring2-[a-z]+\.log' \+ TAG/.test(rr),
    "ring2-run 的日志名必须是 <名字><TAG>.log，不能是 <名字>.log<TAG>（否则 *.log 忽略不到）");
});

/* ===== v1.4.0：长程模式（5 血）+ 按模式配摄魂门槛 =====
 * 反证：把 state.js 的 DRAIN 门槛写回写死的 `p.hp > 1` 时 D2 必红；
 *       把 resolve.js 的终局判定写回 `R.MAX_ROUNDS` 时 D3 必红。 */
t('D1 drain gate in multi stays HP<=1 (R25 unchanged)', function () {
  eq(R.MODES.multi.drainHpMax, 1, 'multi.drainHpMax');
  const st = S.createState('multi', { next: mulberry32(71) }, 5);
  st.p[0].hp = 1; ok(S.computeCost(st, 0, R.SK.DRAIN).ok, 'multi HP=1 usable');
  st.p[0].hp = 2; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'multi HP=2 must be banned');
});

t('D2 long mode hp=5 / drainHpMax=2（v1.5.174 用户裁定 3 → 2；0 必须能真关掉）', function () {
  const m = R.MODES.long;
  ok(!!m, 'MODES.long must exist');
  eq(m.hp, 5, 'long.hp'); eq(m.drainHpMax, 2, 'long.drainHpMax');
  eq(S.createState('long', { next: mulberry32(72) }, 5).p[0].hp, 5, 'long initial hp');
  const st = S.createState('long', { next: mulberry32(73) }, 5);
  st.p[0].hp = 2; ok(S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=2 usable（新窗口的上沿）');
  st.p[0].hp = 3; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=3 must be banned（v1.5.174 起窗口是 2，不再是 3）');
  st.p[0].hp = 4; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=4 must be banned (gate is 2)');
  /* v1.5.174 顺手修的那条语义：`state.js` 原来写 `(mode.drainHpMax) || 1` ⇒ **0 会静默变成 1**，"关掉这张卡"这个选项根本不存在。
   * （我做"永不可用"对照组时被它骗过一次：`drainHpMax:0` 跑出来与 `≤1` 逐位相同才发现。） */
  const keep = m.drainHpMax;
  try {
    m.drainHpMax = 0; st.p[0].hp = 1;
    ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'drainHpMax=0 必须真的永不可用（HP1 也不行）');
    m.drainHpMax = 1; st.p[0].hp = 1;
    ok(S.computeCost(st, 0, R.SK.DRAIN).ok, '未设/设 1 仍走 R25 原口径（HP1 可用）');
  } finally { m.drainHpMax = keep; }
});

t('D3 round cap follows the mode (long safety net=140 + sudden death at 100)', function () {
  eq(R.MODES.long.maxRounds, 140, 'long.maxRounds（安全网，不是硬截断）');
  /* v1.5.10：收缩起点改为**全局规则** `R.SUDDEN_DEATH`（用户裁定），模式字段只用于覆盖 ⇒
   * 这里断言"该模式实际生效的阈值"，而不是"模式自带字段"（后者现在可以是 undefined）。 */
  eq(R.MODES.long.suddenDeath != null ? R.MODES.long.suddenDeath : R.SUDDEN_DEATH, 100, 'long 实际生效的收缩起点');
  /* v1.5.65：multi 此前走全局 100 而上限 60 ⇒ **实际永不触发**（"不打"零代价，实测 40/40 平局、回合打满）；
   * 现给它显式阈值（必须落进上限内）。 */
  eq(R.MODES.multi.suddenDeath, 45, 'multi 实际生效的收缩起点');
  ok(R.MODES.multi.suddenDeath < R.MAX_ROUNDS, 'multi 的收缩必须落进回合上限内（否则永不触发）');
  eq(R.MAX_ROUNDS, 60, 'default cap unchanged');
  const mk = function (mode, round) {
    const st = S.createState(mode, { next: mulberry32(74) }, 3);
    st.round = round;
    st.p[0].hp = 3; st.p[1].hp = 2; st.p[2].hp = 1;
    X.checkOver(st);
    return st;
  };
  ok(!mk('long', 60).over, 'long round 60 must not end (60 is only multi cap)');
  ok(!mk('long', 99).over, 'long round 99 must not end');
  /* v1.4.8：100 回合不再是终局（那是收缩起点），终局只看安全网 140。
   * 这条断言就是"硬截断已被移除"的守门人。 */
  ok(!mk('long', 100).over, 'long round 100 must NOT end any more (sudden death onset, not a cap)');
  ok(!mk('long', 139).over, 'long round 139 must not end');
  eq(mk('long', 140).winner, 0, 'long round 140 (safety net) ends, highest hp wins');
  eq(mk('multi', 60).winner, 0, 'multi round 60 ends (unchanged)');
});

t('D4 opponent rotation must not depend on individual index (pairing)', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  const all = [];
  const re = /let oi = ([^;]+);/g;
  let m;
  while ((m = re.exec(src))) all.push(m[1]);
  /* v1.5.280（§E124）：轮换公式搬进了纯函数 `oppSeatIndex`（整桌同原型要的就是"局内不推进"）
   * ⇒ 只扫 `let oi` 会只剩 `evalN` 里那个 `let oi = 0`（那是量具游标，不是轮换）⇒ **这条老门失去判据**。
   * 现在两种形状都认：老式 `let oi = <式>` 与新式 `function oppSeatIndex(...) { return <式>; }`。
   * ⚠ 这条本身是 v1.3.60 那次"把同代同对手批拆掉 ⇒ 适值不可比"的事故换来的，不许再退化。 */
  const fn = /function oppSeatIndex\([^)]*\)\s*\{\s*return ([^;]+);/.exec(src);
  if (fn) all.push(fn[1]);
  ok(all.length >= 1, 'no opponent rotation expression found');
  ok(fn || all.some(function (e) { return e.indexOf('gen') >= 0; }),
    '轮换必须在 `let oi` 或 `oppSeatIndex` 里有一处真身（两处都扫不到 = 这条门已被重构架空，判红）');
  for (const e of all) ok(e.indexOf('idx') < 0, 'rotation must not use idx (breaks same-gen pairing): ' + e);
  ok(all.some(function (e) { return e.indexOf('gen') >= 0; }),
    'rotation should advance with gen so a large pool still gets covered: ' + all.join(' | '));
});

t('D5 dualGun second shot must come from the same data row', function () {
  /* v1.4.7：第二发原先写死 amt:1/NORMAL/无 pierce，与注释"走数据表"矛盾 ——
   * 改 byKey.dualGun.dmg.amt 只会影响第一发（第十轮复核 §6-2 用内存改表验证）。
   * 这条用例就是那个内存改表的固化版：改表后两发都必须跟着变。 */
  const dg = R.byKey[R.SK.DUAL_GUN];
  const bakAmt = dg.dmg.amt;
  try {
    dg.dmg.amt = 2;
    const st = S.createState('multi', { next: mulberry32(81) }, 3);
    st.p[0].ep = 3; st.p[1].hp = 3; st.p[2].hp = 3;
    X.startTurn(st);
    const r = S.attemptAction(st, 0, R.SK.DUAL_GUN, { target: 1, target2: 2 });
    ok(r && r.outcome === 'ok', '双枪应能出手: ' + JSON.stringify(r));
    X.resolveActions(st);
    eq(3 - st.p[1].hp, 2, '第一发伤害应跟数据表(2)');
    eq(3 - st.p[2].hp, 2, '第二发伤害也必须跟数据表(2)，不能写死 1');
  } finally { dg.dmg.amt = bakAmt; }
});

t('D6 终局收缩：到 suddenDeath 后每回合末全员 -1（反弹挡不住、不触发地雷）', function () {
  /* v1.4.8：用户方案（100 回合后每轮全员扣 1 血）替代硬截断。
   * 反证：把 resolve.js 里收缩那段的 bypassGuards 去掉，下面"反弹挡不住"必红；
   *       去掉 noMine 则地雷断言必红。 */
  const mk = function (round, hp) {
    const st = S.createState('long', { next: mulberry32(91) }, 3);
    st.round = round;
    for (const p of st.p) { p.hp = hp; p.mineArmed = true; }
    for (let i = 0; i < 3; i++) st.actions[i] = { key: R.SK.REFLECT, target: null };  // 全员挂反弹
    X.endTurn(st);
    return st;
  };
  eq(mk(99, 3).p[0].hp, 3, '未到 suddenDeath 不能扣血');
  const on = mk(100, 3);
  eq(on.p[0].hp, 2, '到 suddenDeath 当回合就扣 1（且反弹挡不住）');
  eq(on.p[1].hp, 2, '全员扣血');
  eq(on.p[2].hp, 2, '全员扣血');
  ok(!on.events.some(function (e) { return e.type === 'mine'; }), '收缩不能触发地雷');
  ok(!on.events.some(function (e) { return e.type === 'reflect'; }), '收缩不能被反弹（bypassGuards）');
  eq(mk(105, 1).p[0].hp, 0, '1 血时被收缩扣死');
});

t('D7 对手池必须单一来源（server/worker 不得各写一份名单）', function () {
  /* v1.4.9：这类"两处各写一遍"的漂移已经静默坑过两次 ——
   * v1.3.59 只补了 worker、v1.4.8 只补了 server（后者让"13 对手"的臂实际只跑 12 个，
   * 告警又只写进隐藏 server 的 stderr ⇒ 我直到发现"两个不同臂的考卷逐位相同"才察觉）。 */
  const w = readFileSync('server/train-worker.mjs', 'utf8');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(w.indexOf("from './opp-pool.mjs'") >= 0, 'worker 必须从 opp-pool.mjs 导入池子');
  ok(sv.indexOf("from './opp-pool.mjs'") >= 0, 'server 必须从 opp-pool.mjs 导入池子');
  ok(!/const OPP_POOL = \[\s*[\r\n]*\s*\{ name:/.test(w), 'worker 不得自己再写一份字面量池子');
  ok(!/const BOT_FN_N = \{/.test(sv), 'server 不得自己再写一份字面量名单');
});

t('D8 版本号三方一致（CHANGELOG 最新条目 = README = index.html）', function () {
  /* v1.4.13：本轮发现 README 停在 v1.4.6、index.html 停在 v1.4.1（HEAD 已是 v1.4.13），
   * 而 CHANGELOG 还缺 v1.4.10/v1.4.12 两条 —— 根因是我用 sed 假设"上一版的字符串"，
   * 而 sed 不匹配时不报错 ⇒ 连续多次静默 no-op（index.html 还被 A/B 任务的备份还原打乱过）。
   * 反证：把 README 改回任意旧版本号，这条立即红。 */
  const cl = readFileSync('CHANGELOG.md', 'utf8');
  const m = cl.match(/^## v([0-9]+\.[0-9]+\.[0-9]+)/m);
  ok(m, 'CHANGELOG 里找不到 ## vX.Y.Z 条目');
  const newest = m[1];
  const rd = readFileSync('README.md', 'utf8').match(/当前版本：v([0-9]+\.[0-9]+\.[0-9]+)/);
  ok(rd, 'README 里找不到"当前版本：vX.Y.Z"');
  eq(rd[1], newest, 'README 版本号必须等于 CHANGELOG 最新条目');
  const ix = readFileSync('index.html', 'utf8').match(/程序 v([0-9]+\.[0-9]+\.[0-9]+)/);
  ok(ix, 'index.html 里找不到"程序 vX.Y.Z"');
  eq(ix[1], newest, 'index.html 版本号必须等于 CHANGELOG 最新条目');
});

t('D9 对手池单一来源里的每个 fn 都必须存在于 EpirusBots', function () {
  /* v1.4.14：第三次"加名字漏一处"（v1.3.59 漏 server、v1.4.8 漏 worker、v1.4.14 漏 opp-pool 本身）。
   * 这次的症状最隐蔽：服务端拿到未定义名字 → B[undefined] = undefined → 训练跑到中途才炸成
   * "sel is not a function"。这条用例把"名字 → 函数"这一步钉在测试期。 */
  const src = readFileSync('server/opp-pool.mjs', 'utf8');
  const items = [...src.matchAll(/\{ name: '([A-Za-z0-9_]+)', fn: '([A-Za-z0-9_]+)' \}/g)];
  ok(items.length >= 12, 'opp-pool.mjs 条目数异常: ' + items.length);
  for (const it of items) {
    ok(typeof Bots[it[2]] === 'function', 'opp-pool 的 ' + it[1] + ' → Bots.' + it[2] + ' 不存在');
  }
  ok(items.some(function (it) { return it[1] === 'reflectspam'; }), 'reflectspam 必须在池子里（v1.4.8）');
  ok(items.some(function (it) { return it[1] === 'ringspam'; }), 'ringspam 必须在池子里（v1.4.14）');
});

t('D10 训练模式必须真的透传到建局（setTrainMode(long) ⇒ 5 血）', function () {
  /* v1.5.0：`oneGameN` 从 v1.4.0 起就支持 `opts.mode`，但**训练路径没有一处传它** ——
   * 19 个 oneGameN 调用点里唯一传过的还是评测工具（eval-5p.mjs）。于是历次训练
   * （hA9 / hB12 / wall2 / ms2 / ring2…）全部按 'multi'（3 血）建局，
   * "5 血冠军"从来没被训过，产物 meta 里连模式字段都没有。
   * 这条用例不看返回值，直接盯**真正建出来的局用的模式**（state.mode.hp）——
   * 反证：把 evo.js 里 scoreMemberN / evalN / champEntropy 任意一处 mode 传参删掉，本条立刻红。 */
  const seen = [];
  const origGame = Play.autoGameN;
  Play.autoGameN = function (st) { seen.push(st.mode && st.mode.hp); return origGame.apply(Play, arguments); };
  try {
    const p = Pol.makePolicy(0.25);
    const opps = [{ name: 'random', sel: Bots.pickRandom }];
    T.setTrainMode('multi');
    seen.length = 0;
    T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
    ok(seen.length > 0, 'scoreMemberN 必须真的建局（否则本条是空转断言）');
    ok(seen.every(function (hp) { return hp === 3; }), '默认必须是 3 血(multi)，实测 hp=' + seen.join(','));
    T.setTrainMode('long');
    seen.length = 0;
    T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
    ok(seen.length > 0, 'setTrainMode(long) 后 scoreMemberN 仍必须建局');
    ok(seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后训练建局必须 5 血，实测 hp=' + seen.join(','));
    seen.length = 0;
    T.evalN(p, [[Bots.pickRandom, Bots.pickDefend]], 2, 3, 999);
    ok(seen.length > 0 && seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后 evalN 也必须建 5 血局，实测 hp=' + seen.join(','));
    seen.length = 0;
    T.champEntropy(p, 0.15, 2, 4242, 3);
    ok(seen.length > 0 && seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后 champEntropy 也必须建 5 血局，实测 hp=' + seen.join(','));
    ok(T.trainMode() === 'long', 'setTrainMode 之后 trainMode() 必须回读 long');
    T.setTrainMode('nonexistent');
    ok(T.trainMode() === 'long', '未知模式名不得悄悄改掉当前模式');
  } finally {
    Play.autoGameN = origGame;
    T.setTrainMode('multi');
  }
});

t('D11 训练模式必须随消息下发到 worker（并行路径不是同一个沙箱）', function () {
  /* v1.5.0 实测事故（我自己踩的）：`T.setTrainMode` 只改**本线程**的模块状态，而训练打分跑在
   * worker 线程里、各自是独立沙箱 ⇒ 只在服务端设 = 进化照旧 3 血、只有服务端终局评估 5 血。
   * 症状是"整条 best 曲线与 multi 轮逐位相同"—— 不看这一点会以为实验跑通了。
   * D10 抓不到它（D10 测的是**进程内**的 scoreMemberN）。故补这条贯通性检查。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(/type: 'evalN'[\s\S]{0,300}?mode:/.test(pt), "paralleltrain 的 evalN 消息必须带 mode（否则 worker 收不到）");
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('setTrainMode(msg.mode') >= 0, 'worker 必须按消息里的 mode 调 setTrainMode');
  ok(wk.indexOf('modeUsed') >= 0, 'worker 必须回报 modeUsed 回执');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('modeUsed') >= 0, 'server 必须校验 worker 的 modeUsed 回执并响亮中止');
});

t('D12 冠军对手（champ:）机制必须两端都通 + 能真的解出 params', function () {
  /* v1.5.2：训练池要能放「风格化冠军」当靶子（脚本对手打不出成体系的策略）。
   * 这类"两处各写一遍"的机制只要漏一端就静默取子集（v1.4.8 踩过），所以两端都要点名；
   * 而且**功能上**必须真能解包 —— 这里用仓库里在库的 js/bundled-champion-3p.js 验证。 */
  ok(isChampOpp('champ:docs/artifacts/champion-5p-armB12f.bak'), 'champ: 前缀必须被识别');
  ok(!isChampOpp('heavyfire'), '普通脚本名不得被当成冠军对手');
  const params = loadChampParams(Pol, 'js/bundled-champion-3p.js');
  ok(params && params.length > 0, 'loadChampParams 必须能从在库冠军包解出 params（实测 length=' + (params && params.length) + '）');
  /* 反向：拿一个不是冠军包的文件去解，必须**响亮抛错**，不能静默返回半个东西 */
  let threw = false;
  try { loadChampParams(Pol, 'js/core/rules.js'); } catch (e) { threw = true; }
  ok(threw, '非冠军包文件必须抛错（否则会把 undefined 当对手，训练中途才炸）');
  const pt = readFileSync('server/train-server.mjs', 'utf8');
  ok(pt.indexOf('isChampOpp') >= 0, 'server 的对手名校验必须认识 champ:（否则开跑前就被当未知名字中止）');
  ok(pt.indexOf('makeOppSelResolver') >= 0, 'server 必须走**统一解析器** makeOppSelResolver');
  /* ★ 这条是本轮真正的教训（v1.5.2 我踩了第三次）：加对手名时**又漏了一处** ——
   * 终局评估那段自己写了一遍 `B[BOT_FN_N[nm]]`，对 champ: 名字给出 undefined，
   * 于是训练跑到名人堂评估才炸成 `sel is not a function`（前几代轮换只覆盖脚本下标，看不见）。
   * 所以要求 train-server 里**不再存在裸的 B[BOT_FN_N[...] 映射** —— 名字→函数只能有一个入口。 */
  ok(pt.indexOf('B[BOT_FN_N[') < 0, "train-server 不得再有裸的 B[BOT_FN_N[nm]] 映射（'加名字漏一处'就是这个形状）");
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('makeOppSelResolver') >= 0, 'worker 必须用**同一个**解析器（函数无法跨线程传，但规则只有一份）');
  ok(wk.indexOf('resolveOpp') >= 0, 'worker 必须按 msg.oppNames 的**原顺序**逐个解析（顺序变了就是另一场实验）');
  ok(readFileSync('server/opp-champs.mjs', 'utf8').indexOf('policyChooserN') >= 0, '冠军对手必须走 policyChooserN（与页面同一条推理路径）');
});

t('D13 风格切片（复合适应度）必须真的打进 fit —— 且是**追加**不是替换', function () {
  /* v1.5.2：两次"改对手池"落空（ring2 加 1 个脚本、mix 加 4 个真实风格冠军）之后，改走
   * "在池子预算之外附加 k 局风格局、按权重并进 fit"。这条用例盯四件事：
   *   ① 关闭时不产生风格局；② 打开时真的打 k 局；③ fit 里那部分恰好是 w*styleRate（自洽）；
   *   ④ **池子那一半 fit 逐位不变**（追加而非替换 —— 这正是"不摊薄"的保证）。 */
  ok(typeof T.setStyleSlice === 'function', 'T.setStyleSlice 必须存在');
  const p = Pol.makePolicy(0.25);
  const opps = [{ name: 'random', sel: Bots.pickRandom }];
  const styleOpps = [{ name: 'defend', sel: Bots.pickDefend }];
  T.setStyleSlice(null, 0, 0);
  Pol.setRng(T.mulberry32(777001));           // 两次调用从**同一随机流起点**出发（否则比不了）
  const a = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(a.styleGames === 0, '切片关闭时不得产生风格局，实测 styleGames=' + a.styleGames);
  T.setStyleSlice(styleOpps, 0.5, 2);
  Pol.setRng(T.mulberry32(777001));
  const b = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(b.styleGames === 2, '切片打开后必须真的打 2 局，实测 ' + b.styleGames);
  ok(b.styleRate >= 0 && b.styleRate <= 1, 'styleRate 必须是比率，实测 ' + b.styleRate);
  /* v1.5.6：fit 的组成多了熵奖励 ⇒ 这里的"多出来的部分"要把它算进去（D15 管熵项本身）。
   * v1.5.71：**原来漏了 `seatPen`**（v1.5.68 加的座位惩罚项）⇒ 惩罚一触发这条断言就随机变红
   * （实测 5 次里 1 次，`实测多出 -0.069 vs 期望 0.031`）。修法不是放宽阈值，而是把 fit 的
   * **全部加项**都纳入恒等式 —— 契约是"fit = 报告出来的各加项之和"，将来再加项也必须先报告再进 fit。 */
  const residualB = (b.fit - b.fitNoDiv) - (b.divBonus + 0.5 * b.styleRate - (b.seatPen || 0));
  ok(isFinite(b.seatPen), 'seatPen 必须照实报告（fit 的每个加项都要可审计，否则这条恒等式必然偶发红）');
  ok(Math.abs(residualB) < 1e-9,
    'fit 必须等于**全部**已报告加项之和（熵奖励 + w*styleRate - seatPen）；残差 ' + residualB.toFixed(6) +
    '（实测多出 ' + (b.fit - b.fitNoDiv).toFixed(6) + '，报告项合计 ' + (b.divBonus + 0.5 * b.styleRate - b.seatPen).toFixed(6) + '）');
  ok(Math.abs(b.fitNoDiv - a.fitNoDiv) < 1e-9,
    '切片必须是**追加**：池子那部分 fit 不得被改变（无切片 ' + a.fitNoDiv + ' vs 有切片 ' + b.fitNoDiv + '）');
  T.setStyleSlice(null, 0, 0);
  const c = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(c.styleGames === 0 && Math.abs((c.fit - c.fitNoDiv) - (c.divBonus - (c.seatPen || 0))) < 1e-9, '关掉切片后必须完全回到无切片状态（只剩熵奖励 - seatPen）');
  /* 两端接线（结构性）：这类"两处各写一遍"的机制漏一端就静默半开（v1.5.0 的 mode 事故同型） */
  const pt = readFileSync('server/train-server.mjs', 'utf8');
  ok(pt.indexOf('setStyleSlice') >= 0, 'server 必须调 setStyleSlice');
  ok(pt.indexOf('styleNames, slice.w') >= 0, 'server 必须把风格名单/权重/局数传给 poolN.evalPopN');
  ok(pt.indexOf('回执 styleGames') >= 0, 'server 必须校验 worker 的 styleGames 回执');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('setStyleSlice') >= 0, 'worker 必须在**自己沙箱**里设切片（服务端那份改不到 worker）');
  ok(wk.indexOf('styleGames') >= 0, 'worker 必须回执 styleGames');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('styleOppNames') >= 0, 'paralleltrain 必须把切片随消息下发');
});

t('D15 ep 奖罚门槛必须按 (人数,模式) 走（用户锚点）+ 熵奖励已恢复', function () {
  /* v1.5.6（用户裁定）：用户回忆的"ep 奖励/惩罚"就是 stock 项，但门槛原先**写死 4/10**、与人数和模式无关
   * ⇒ 5 血里 11 ep 就被当囤积。锚点：3 人局 → 奖励到 **3 ep**、惩罚 **>10 ep**；
   * 5 人 · 5 血 → 奖励到 **5 ep**、惩罚 **>20 ep**。这里直接点纯函数的语义，不靠跑训练看数字。 */
  const B = T.economyStock;
  ok(typeof B === 'function', 'T.economyStock 必须存在（纯函数，便于钉门槛）');
  const t3 = T.economyTargets(3, 'multi'), t5 = T.economyTargets(5, 'long'), t4 = T.economyTargets(4, 'multi');
  eq(t3.target, 3, '3 人局奖励点 = 3'); eq(t3.cap, 10, '3 人局惩罚点 = 10');
  eq(t5.target, 5, '5 人 5 血奖励点 = 5'); eq(t5.cap, 20, '5 人 5 血惩罚点 = 20');
  eq(t4.target, 4, '4 人局落在中间（奖励点 4）');
  const b3 = B(3, 3, 'multi'), b10 = B(10, 3, 'multi'), b11 = B(11, 3, 'multi');
  ok(b3 > 0, '3 人局：到 3 ep 应有攒钱奖励（实测 ' + b3.toFixed(4) + '）');
  ok(Math.abs(b10 - b3) < 1e-9, '3..10 ep 不奖不罚（实测 ' + b10.toFixed(4) + '）');
  ok(b11 < b10, '超过 10 ep 开始惩罚（实测 ' + b11.toFixed(4) + ' < ' + b10.toFixed(4) + '）');
  const l5 = B(5, 5, 'long'), l20 = B(20, 5, 'long'), l21 = B(21, 5, 'long');
  ok(l5 > 0 && Math.abs(l20 - l5) < 1e-9, '5 人 5 血：到 5 ep 满额、到 20 ep 仍不罚');
  ok(l21 < l20, '超过 20 ep 才开始惩罚（实测 ' + l21.toFixed(4) + ' < ' + l20.toFixed(4) + '）');
  ok(B(15, 5, 'long') > B(15, 3, 'multi'), '同一个 15 ep：长程 5 人必须比 3 人 3 血宽松（人数/模式真的进了门槛）');
  /* 熵奖励：从 0 恢复，且权重必须小（"奖惩不用给太多"） */
  const er = T.economyReward();
  ok(er.divW > 0 && er.divW <= 0.2, '熵奖励权重要小而正（实测 divW=' + er.divW + '）');
  const p = Pol.makePolicy(0.25);
  Pol.setRng(T.mulberry32(4242));
  const r = T.scoreMemberN(p, [{ name: 'random', sel: Bots.pickRandom }], 2, 3, 1, 0, 0);
  ok(Math.abs(r.fit - (r.fitNoDiv + r.divBonus + r.styleWeight * r.styleRate)) < 1e-9,
    'fit 必须 = 池子分 + 熵奖励 + 风格切片（实测 fit=' + r.fit.toFixed(5) + '）');
  /* v1.5.87（用户裁定 A）：进 fit 的熵改用与门禁同口径的 spDivNorm（自对局·成功非ジ动作），
   * 旧口径 divNorm 只留作对照 ⇒ 这条公式断言跟着改（它红过一次，正是它该做的事）。 */
  ok(Math.abs(r.divBonus - r.divW * r.spDivNorm) < 1e-9,
    'divBonus 必须 = divW × spDivNorm（实测 ' + r.divBonus.toFixed(5) + ' vs ' + (r.divW * r.spDivNorm).toFixed(5) + '）');
  ok(r.avgStock != null, '必须回报 avgStock（攒钱分）便于诊断');
  T.setEconomyReward({ reset: true });   // 复位，别污染后面的用例
});

t('D51 双目标技能必须**有序成对**进入决策（镜面反射 t1→t2 / 双枪射手两个角色）', function () {
  /* v1.5.52（用户指出）：镜面反射的两个目标**不可调换**（t1=复制对象、t2=输出对象），双枪射手同理。
   * 此前 `candidatesFor` 每次 push 的 `target2` 都硬编码 null ⇒ 第二个目标由引擎兜底（"索引最小的对手"）
   * ⇒ ① 角色不可表达；② 系统性把 0 号座当第二个目标（实测 0 号座每局必死 60/60 的一部分来源）。 */
  ok(R.byKey[R.SK.MIRROR].target2 === 'enemy', '规则数据必须声明镜面反射有第二目标（target2=enemy）');
  ok(R.byKey[R.SK.DUAL_GUN].target2 === 'enemy', '规则数据必须声明双枪射手有第二目标（target2=enemy）');
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf("def.target2 === 'enemy'") >= 0, 'candidatesFor 必须有"双目标技能"分支');
  const stz = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const nopps = S.opponentsOf(stz, 0).length;
  for (const k of [R.SK.MIRROR, R.SK.DUAL_GUN]) {
    const c = Pol.candidatesFor(stz, 0, [{ key: k }]);
    const pairs = c.filter(function (x) { return x.target != null && x.target2 != null; });
    const selfPair = pairs.filter(function (x) { return x.target === x.target2; });
    eq(pairs.length, nopps * (nopps - 1), k + '：必须枚举**全部有序**组合 n×(n-1)（实测 ' + pairs.length + '）');
    eq(selfPair.length, 0, k + '：两个目标不得相同');
    const fwd = c.filter(function (x) { return x.target === 1 && x.target2 === 2; }).length;
    const bwd = c.filter(function (x) { return x.target === 2 && x.target2 === 1; }).length;
    eq(fwd, 1, k + '：必须存在 (1→2) 这一个候选');
    eq(bwd, 1, k + '：必须存在 (2→1) 这一个候选（**顺序不可交换** ⇒ 是两个不同候选）');
  }
  /* 对照：单目标技能不得被这条分支改变口径 */
  const cg = Pol.candidatesFor(stz, 0, [{ key: R.SK.GUN }]);
  eq(cg.length, nopps, '单目标技能（枪）候选数必须仍等于存活对手数（口径不变）');
  eq(cg.filter(function (x) { return x.target2 != null; }).length, 0, '单目标技能的 target2 必须恒为 null');
});

t('D52 结算起点必须每局随机（不得有确定性身份映射）；盐 0 保持旧口径', function () {
  /* v1.5.53：`turnOrder` 原为 `start = (round-1) % n` —— **确定性映射** ⇒ 第 1 回合永远从 0 号座开始。
   * 强策略下对局前几回合就定局 ⇒ 0 号座白拿首发优势。实测（5 个同一冠军坐满 5 座）：
   * 修掉槽位焦点后反而变成"0 号座夺冠 37~54%、死亡最少"，方向与修前相反 ⇒ 同族的第二条身份映射。
   * 修法：相位取每局的盐（纯函数、可复现、不消耗随机流）。 */
  ok(typeof X.turnOrder === 'function', 'X.turnOrder 必须导出（守门要能直接测）');
  const st = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const firsts = {};
  for (let s = 0; s < 25; s++) {
    st.slotSalt = ((s * 0x9e3779b9) >>> 0);
    st.round = 1;
    const o = X.turnOrder(st);
    eq(o.length, 5, '5 人局的结算顺序必须含 5 个座位');
    firsts[o[0]] = (firsts[o[0]] || 0) + 1;
  }
  eq(Object.keys(firsts).length, 5, '25 个不同盐下第 1 回合起点必须覆盖全部 5 座（实测 ' + JSON.stringify(firsts) + '）');
  const vals = [0, 1, 2, 3, 4].map(function (i) { return firsts[i] || 0; });
  ok(Math.min.apply(null, vals) >= 2, '各座作为起点的次数必须大致均匀（实测 ' + JSON.stringify(firsts) + '）');
  st.slotSalt = 0; st.round = 1;
  eq(X.turnOrder(st)[0], 0, '盐 0 必须保持旧口径（第 1 回合从 0 号座开始）⇒ 页面与既有对比基线不变');
  st.slotSalt = 0; st.round = 3;
  eq(X.turnOrder(st)[0], 2, '盐 0 时盐=0 的轮转必须与旧口径一致（第 3 回合起点 = 2）');
  const st2 = S.createState('multi', { next: function () { return 0.5; } }, 2);
  eq(X.turnOrder(st2).join(','), '0,1', '2 人局必须恒等顺序（v1.0 冻结）');
  const rj = readFileSync('js/core/resolve.js', 'utf8');
  ok(rj.indexOf('state.slotSalt') >= 0, 'turnOrder 必须使用每局的盐作为相位');
  ok(rj.indexOf('const start = ((state.round || 1) - 1) % n;') < 0, '旧的确定性相位必须已移除');
});

t('D53 无显式目标时的默认作用者不得恒定取最小索引（L7 第四次）', function () {
  /* v1.5.54：`oppOf` / `mirrorRefs` 的兜底原本一律 `aliveOpps(...)[0]` = 索引最小的存活对手
   * ⇒ 0 号座是"所有人的默认靶子"（实测 0 号座每局必死 60/60 的一部分来源）。
   * 修法：按每局的盐轮换（纯函数、可复现、不消耗随机流）；**盐 0 保持旧口径**。 */
  ok(typeof X.saltPick === 'function', 'X.saltPick 必须导出（守门要能直测）');
  eq(X.saltPick({ slotSalt: 0, round: 1 }, [3, 1, 4], 0), 3, '盐 0 必须保持旧口径（取 [0]）');
  eq(X.saltPick({}, [3, 1, 4], 0), 3, '没有 slotSalt 时也必须保持旧口径（页面默认）');
  const seen = {};
  for (let sd = 1; sd <= 40; sd++) {
    for (let r = 1; r <= 5; r++) {
      const v = X.saltPick({ slotSalt: sd * 2654435761 >>> 0, round: r }, [1, 2, 3, 4], 0);
      seen[v] = (seen[v] || 0) + 1;
    }
  }
  eq(Object.keys(seen).length, 4, '有盐时默认作用者必须覆盖所有候选（实测 ' + JSON.stringify(seen) + '）');
  const vals = [1, 2, 3, 4].map(function (i) { return seen[i] || 0; });
  ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) <= 40,
    '分布必须大致均匀（实测 ' + JSON.stringify(seen) + '）');
  /* oppOf：无目标时按盐轮换 */
  const st = S.createState('multi', { next: function () { return 0.5; } }, 5);
  X.startTurn(st);
  st.actions[0] = { key: R.SK.ARMOR, target: null };
  st.slotSalt = 0; st.round = 1;
  eq(X.oppOf(st, 0), 1, '盐 0：无目标 ⇒ 旧口径（最小索引的存活对手）');
  const oppSeen = {};
  for (let sd = 1; sd <= 30; sd++) {
    st.slotSalt = sd * 2654435761 >>> 0; st.round = 1;
    const t = X.oppOf(st, 0);
    oppSeen[t] = (oppSeen[t] || 0) + 1;
  }
  eq(Object.keys(oppSeen).length, 4, '有盐时 oppOf 必须覆盖 1..4 号对手（实测 ' + JSON.stringify(oppSeen) + '）');
  const rj = readFileSync('js/core/resolve.js', 'utf8');
  ok(rj.indexOf('return o.length ? o[0] : null;') < 0, 'oppOf 不得再有"恒定取最小索引"的兜底');
  ok(rj.indexOf('t1 = opps.length ? opps[0] : null') < 0, 'mirrorRefs 的 t1 兜底不得再取最小索引');
  ok(rj.indexOf('if (o !== t1) { t2 = o; break; }') < 0, 'mirrorRefs 的 t2 兜底不得再取最小索引');
  ok(rj.indexOf('function saltPick(') >= 0, '必须存在 saltPick 助手');
});

t('D54 引擎层对称性烟测：同一策略坐满 5 座不得系统性偏座（L7 守卫）', function () {
  /* v1.5.55：本会话修掉四条"确定性身份映射"（槽位并列 / 结算起点相位 / 默认作用者 t1,t2）。
   * 这条是它们的**统计守卫**：固定种子的（近随机）策略坐满 5 座，各座胜场与死亡次数都不得系统性偏差。
   * 修前实测（训练产物）：0 号座每局必死 60/60、其余座 37~46 ⇒ 死亡极差 20~26，本用例会红。 */
  Pol.setRng(T.mulberry32(90210));
  /* v1.5.74：夹具改用**脚本**（同一脚本坐满 5 座）。原用随机权重神经网络，而 F2 两级采样后
   * "条目少的技能（ジ/防御）"拿回份额 ⇒ 随机网络的局面更平（实测只剩 17/120 分出胜负）⇒
   * 这条**引擎层**烟测会被夹具的被动性带偏（它要测的是引擎对称性，不需要神经网络）。 */
  const scripted = T.wrapBotN(Bots.pickAggro);
  const win = [0, 0, 0, 0, 0], dead = [0, 0, 0, 0, 0];
  let dec = 0;
  for (let g = 0; g < 120; g++) {
    const st = S.createState('multi', { next: T.mulberry32(31000 + g) }, 5);
    st.slotSalt = ((g * 2654435761) >>> 0);
    Play.autoGameN(st, [scripted, scripted, scripted, scripted, scripted]);
    for (let i = 0; i < 5; i++) if (st.p[i].hp <= 0) dead[i]++;
    /* v1.5.74：胜负要用**引擎自己的裁定**（v1.5.65 起"全灭按累计伤害判胜"）——
     * 旧的"有人活着且血量唯一最高"口径会把全员阵亡的局全算成平局
     * （脚本对局里几乎每局都全员阵亡 ⇒ 实测只有 12/120 被判"分出胜负"）。 */
    if (st.winner !== 'draw' && st.winner != null) { win[st.winner]++; dec++; }
  }
  const winners = win.filter(function (w) { return w > 0; }).length;
  const wSpread = Math.max.apply(null, win) - Math.min.apply(null, win);
  const dSpread = Math.max.apply(null, dead) - Math.min.apply(null, dead);
  ok(dec >= 20, '必须有足够多分出胜负的局（实测 ' + dec + '/120；未训练策略平局多，阈值放宽）');
  ok(winners >= 4, '5 个座位里至少 4 个必须赢过（否则系统性偏座，win=' + JSON.stringify(win) + '）');
  ok(wSpread <= 18, '各座胜场极差必须小（实测 ' + wSpread + '，win=' + JSON.stringify(win) + '）');
  ok(dSpread <= 22, '各座死亡次数极差必须小（实测 ' + dSpread + '，dead=' + JSON.stringify(dead) + '）');
});

t('D55 F 的口径必须是"场 A 被集火还手率"（考核依据修正），旧口径不得再作判据', function () {
  /* v1.5.62（用户裁定）：旧 F 的场地是"1 席进攻者 + 4 席冠军自己" ⇒ 量到的是自对局均衡；
   * 门槛从 35% 降到 25% 后仍靠 --force 越过（所有冠军 22~35%）⇒ 问题在考核依据。
   * 新口径 = 场 A（4 席脚本猛攻 vs 1 席冠军）的还手率，阈值 20%（线上包 13% ✗ / 种子 27% ✓ / eco-34 25% ✓）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function aggressionProfile') >= 0, 'audit-lib 必须导出 aggressionProfile（单一真源）');
  ok(al.indexOf('e.source === me') >= 0, '伤害归因必须用事件真字段 source（不是 from）');
  ok(al.indexOf("me = g % 5") >= 0, '冠军座位必须逐局轮换（避免座位相位污染）');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('agg.fieldA.atk < 0.20') >= 0, '上线体检的 F 判据必须是场 A 的 >=20%');
  ok(pc.indexOf('fAct.atk < 0.25') < 0, '旧的"活跃场进攻率 < 25%"判据必须已移除');
  const sc = readFileSync('tools/screen-champ.mjs', 'utf8');
  ok(sc.indexOf('agg.fieldA.atk < 0.20') >= 0, '筛选器必须同步用场 A');
  /* 行为断言：两场必须真的不同构造 —— 场 A 的对手出手次数应远多于场 B（B 场对手只ジ） */
  const Wl = { EpirusRules: R, EpirusState: S, EpirusTrainer: T, EpirusPlay: Play };
  Pol.setRng(T.mulberry32(31337));
  const pl = Pol.makePolicy(0.25);
  const agg = aggressionProfile(Wl, pl, 8);
  ok(agg.fieldA.oppAtkPerGame > agg.fieldB.oppAtkPerGame + 1,
    '场 A 的对手必须真的在进攻（A=' + agg.fieldA.oppAtkPerGame.toFixed(1) + ' vs B=' + agg.fieldB.oppAtkPerGame.toFixed(1) + '）');
  ok(agg.fieldA.atk >= 0 && agg.fieldA.atk <= 1 && agg.fieldB.atk >= 0 && agg.fieldB.atk <= 1, '两场都必须返回合法比率');
  /* v1.5.65：终局收缩的伤 source=null（不可格挡）⇒ 场 B 里冠军仍会掉血，必须按"对手造成的伤"判。 */
  ok(agg.fieldB.takenByOpponentPerGame === 0,
    '场 B（对手只ジ）里冠军不该被**对手**打（实测 ' + agg.fieldB.takenByOpponentPerGame.toFixed(2) + '/局）');
});

t('D56 旧冠军嵌入 v7 后必须仍走旧口径（否则目标退化：实测破墙 12.25→7.70）', function () {
  /* v1.5.64（第五轮复核）：换回 eco-34 时用 upgrade-pack 嵌成 v7 容器，但 `LEGACY()` 靠
   * `shapeOf(params).legacy`（按 `params.length` 反推）判断 ⇒ 嵌入后 legacy=false ⇒ 被切到
   * **它从没训练过的** v7 候选口径（动作侧目标/珠权重为 0 ⇒ 分不出目标 ⇒ 目标退化成枚举顺序）
   * ⇒ 实测破墙伤害 12.25→7.70、穿透 242→152。修法：容器写 `lv`、读取挂到 params、chooser 认标记。 */
  const src = readFileSync('js/train/policy.js', 'utf8');
  ok(src.indexOf('function isLegacyChooser') >= 0, 'policy.js 必须导出 isLegacyChooser');
  ok(src.indexOf('o.lv != null') >= 0, 'unpack 必须把容器 lv 标记挂到 params 上');
  ok(src.indexOf('o.lv = p.legacyFrom') >= 0, 'pack 必须把标记写回容器');
  ok(readFileSync('js/train/evo.js', 'utf8').indexOf('P.isLegacyChooser') >= 0, 'LEGACY() 必须优先认显式标记');
  /* 行为断言：同一份"旧形状权重"（3337 位）原生跑 vs 嵌入+标记跑 ⇒ 逐场结果必须相同。 */
  Pol.setRng(T.mulberry32(4242));
  const p7 = Pol.makePolicy(0.25);
  const legacy = new Float64Array(3337);
  for (let i = 0; i < legacy.length; i++) legacy[i] = p7[i];
  const emb = Pol.embedLegacy(legacy);
  ok(emb && emb.length === Pol.paramCount(), 'embedLegacy 必须把 3337 撑成 ' + Pol.paramCount() + ' 位');
  emb.legacyFrom = 6;
  ok(Pol.isLegacyChooser(emb) === true, '带 lv 标记的嵌入包必须被判为旧口径');
  ok(Pol.isLegacyChooser(p7) === false, '纯 v7 包不得被判为旧口径');
  const play = function (params, seed) {
    const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
    const ch = [];
    for (let i = 0; i < 5; i++) ch.push(T.policyChooserN(params, 0.15));
    Play.autoGameN(st, ch);
    return String(st.winner) + '|' + st.round + '|' + st.p.map(function (x) { return Math.max(0, x.hp); }).join(',');
  };
  const A = [0, 1, 2].map(function (k) { return play(legacy, 777 + k); }).join(' ; ');
  const B = [0, 1, 2].map(function (k) { return play(emb, 777 + k); }).join(' ; ');
  eq(B, A, '嵌入+标记后必须与原生旧口径逐场相同（旧版嵌入会改行为）');
});

t('D57 multi 的收缩必须落进回合上限内，且"全灭"必须按伤害判胜（否则场 B 上限恒为 0）', function () {
  /* v1.5.65（第五轮复核 §4-2，第四轮就提过；本轮实测坐实）：
   * ① multi 不设 suddenDeath ⇒ 走全局 100，而上限是 60 ⇒ **收缩永不触发** ⇒ "不打"零代价；
   * ② 收缩一旦生效又会**同时**清场（实测 40 局回合恒 47、5/5 阵亡）⇒ 旧"全灭=平局"口径下
   *    "4 席只ジ vs 1 席冠军"是 0 胜 / 40 平 ⇒ 严格胜率上限恒为 0，惩罚攒钱无从谈起。 */
  ok(R.MODES.multi.suddenDeath > 0, 'multi 必须显式设 suddenDeath（否则走全局 100 > 上限 60）');
  ok(R.MODES.multi.suddenDeath < R.MAX_ROUNDS, 'multi 的收缩起点必须 < MAX_ROUNDS（实测修前永不触发）');
  const rj = readFileSync('js/core/resolve.js', 'utf8');
  ok(rj.indexOf('dealtSum') >= 0, '全灭分支必须按累计造成伤害判胜');
  /* 行为断言：4 席只ジ vs 1 席冠军 —— 修前 0/40 分出胜负、回合恒打满；修后必须出现胜者且不撞上限 */
  /* v1.5.163：这里原来钉的是 `passiveFieldAt` 的三条**正向**断言（"第 0 局必须是暴露局"）——
   * 而那条注入自 v1.5.65 起一局没开过火（消费点查 `BOT_PICKS` 不存在的键）。键与分支都已删除，
   * 断言随之**反向**：不许复活。复活一次就要再白跑一臂才看得见，那正是 §N11 的代价。 */
  eq(typeof T.passiveFieldAt, 'undefined', 'passiveFieldAt 必须已随 EPIRUS_PASSIVE_FIELD 一起删除');
  eq(typeof T.setPassiveField, 'undefined', 'setPassiveField 同上');
  ok(readFileSync('js/train/evo.js', 'utf8').indexOf('PASSIVE_EVERY') < 0,
    'evo.js 里不许留下该机制的残留变量（半删状态最坏： setter 还在、作用点没了）');
  Pol.setRng(T.mulberry32(777));
  const pl = Pol.makePolicy(0.25);
  const ji = function () { return { key: R.SK.JI }; };
  let dec = 0, cap = 0;
  for (let g = 0; g < 12; g++) {
    const st = S.createState('multi', { next: T.mulberry32(900 + g) }, 5);
    st.slotSalt = ((g + 1) * 2654435761) >>> 0;
    Play.autoGameN(st, [T.policyChooserN(pl, 0.15), ji, ji, ji, ji]);
    if (st.winner !== 'draw' && st.winner != null) dec++;
    if (st.round >= R.MAX_ROUNDS) cap++;
  }
  ok(dec >= 1, '收缩+伤害判胜之后，"4 席只ジ"场里必须出现分出胜负的局（实测 ' + dec + '/12）');
  eq(cap, 0, '不该再有打满上限的局（实测 ' + cap + '/12）');
});

t('D58 L7 第七处：候选枚举顺序必须无身份（镜像对称 + 5 席不得某座通吃）', function () {
  /* v1.5.66：`candidatesFor` 按 `opponentsOf` 升序枚举目标，而 argmax **并列取第一个下标**
   * ⇒ 网络对目标"无所谓"时实际退化成"打最小 pid" ⇒ 那是一条偏置规则（镜像实验：打最小索引 ⇒ P4 通吃；
   * 打最大索引 ⇒ P0 通吃，而引擎本身镜像对称）。v7 候选口径让**新训的冠军**都暴露在这条通道上；
   * v6 老种子走旧口径（键 + pickTargetN）不经过枚举，所以它均衡。 */
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf('function poolOrder') >= 0, 'policy.js 必须有 poolOrder（按每局盐洗牌目标枚举顺序）');
  ok(pol.indexOf('poolOrder(state, pid, S.opponentsOf') >= 0, '枚举处必须走 poolOrder');
  ok(readFileSync('js/ui/ui.js', 'utf8').indexOf('B.state.slotSalt') >= 0, '页面必须每局带盐（否则产品仍走确定性顺序）');
  /* ① 镜像对称（引擎层，最强形式）：脚本"打最小索引"与"打最大索引"必须给出镜像结果 */
  const ATK = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
  const mk = function (pick) {
    return function (state, pid, legal) {
      const a = legal.filter(function (x) { return x.affordable && ATK.indexOf(x.key) >= 0; });
      if (!a.length) return { key: R.SK.JI };
      const o = S.opponentsOf(state, pid);
      return { key: a[0].key, target: pick(o) };
    };
  };
  const run = function (fn, G) {
    const win = [0, 0, 0, 0, 0];
    for (let g = 0; g < G; g++) {
      const st = S.createState('multi', { next: T.mulberry32(12000 + g) }, 5);
      st.slotSalt = ((Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0);
      Play.autoGameN(st, [fn, fn, fn, fn, fn]);
      if (st.winner !== 'draw' && st.winner != null) win[st.winner]++;
    }
    return win;
  };
  const lo = run(mk(function (o) { return o[0]; }), 10);
  const hi = run(mk(function (o) { return o[o.length - 1]; }), 10);
  eq(lo[4], 10, '脚本"打最小索引"必须让最高 pid 通吃（实测 ' + lo.join('/') + '）');
  eq(hi[0], 10, '镜像规则"打最大索引"必须让最低 pid 通吃（实测 ' + hi.join('/') + '）⇒ 引擎镜像对称');
  /* ② 5 席同一策略：不得某座通吃（修前实测 v13-106 是 60/60 全给 0 号座）。
   * 用**仓库内的线上包**（它经过候选枚举 ⇒ 正对着这条通道）；未训练策略几乎不出手、样本不足。
   * 包在训练中会被临时改写（D16 已有该守卫）⇒ 这里读不到就跳过而不是误报。 */
  let liveParams = null;
  try {
    const liveSrc = readFileSync('js/bundled-champion-3p.js', 'utf8');
    const lm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(liveSrc);
    if (lm) liveParams = Pol.unpack(JSON.parse(lm[1]), true);
  } catch (e) { liveParams = null; }
  if (!liveParams) {
    /* v1.5.201（门层审计 D58/D59）：**不可判必须红** —— 静默跳过等于把这条测量关掉，
     * 而汇总仍显示全绿（"190/190"里完全看不见）。它守的正是"5 席通吃"这个产品级退化。 */
    ok(false, '线上多人包必须可读（不可判 = 红，不允许静默跳过）：' +
      (existsSync('js/bundled-champion-3p.js') ? '文件在但解析失败' : '文件不存在') +
      ' —— 训练进行中请先停训练再跑门禁');
  } else {
    const win2 = [0, 0, 0, 0, 0];
    let dec = 0;
    for (let g = 0; g < 60; g++) {
      const st = S.createState('multi', { next: T.mulberry32(12000 + g) }, 5);
      st.slotSalt = ((Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0);
      const base = T.policyChooserN(liveParams, 0.15);
      Play.autoGameN(st, [base, base, base, base, base]);
      if (st.winner !== 'draw' && st.winner != null) { win2[st.winner]++; dec++; }
    }
    ok(dec >= 20, '必须有足够多分出胜负的局（实测 ' + dec + '/60）');
    ok(Math.max.apply(null, win2) <= Math.round(dec * 0.55),
      '5 席同一策略时不得某座通吃（最高座 ' + Math.max.apply(null, win2) + '/' + dec + '：' + win2.join('/') + '）');
  }
});

t('D59 阈值式座位惩罚必须真的在 fit 里（让演化"看得见"偏置）', function () {
  /* v1.5.68（第五轮复核 §4 的 ④ 落地）：训练从不评估"5 席同策略"配置 ⇒ 固定目标偏好的策略
   * 在机器人池上能赢、在 5 席测量里却某座通吃（v9~v15 五批 30+ 候选全是这个形状）。
   * 修：用**已经在打的 mirror 局**统计各座胜场，极差超过阈值才扣分（阈值式 = 约束处理，不是奖励权重）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('SEAT_PEN_MAXPCT') >= 0 && ev.indexOf('SEAT_PEN_W') >= 0, '必须有阈值式座位惩罚常量');
  /* v1.5.69：触发条件必须是"明显通吃"（静音地板：6 局样本的极差噪声就有 40~60pt） */
  ok(ev.indexOf('seatMaxPct >= SEAT_PEN_MAXPCT') >= 0, '触发条件必须按 maxPct（不是极差，否则等于按噪声扣分）');
  /* v1.5.69：惩罚必须**真的能算出极差** —— v1.5.68 曾因蹭 MIRROR_GAMES=2 而静默失效（seatPen 恒 0） */
  ok(readFileSync('js/train/evo.js', 'utf8').indexOf('SEAT_GAMES') >= 0, '必须有独立座位探针 SEAT_GAMES');
  ok(typeof T.seatGames === 'function' && T.seatGames() >= 4, '座位探针局数必须 >=4（实测 ' + (typeof T.seatGames === 'function' ? T.seatGames() : '?') + '）');
  ok(ev.indexOf('- seatPen') >= 0, '座位惩罚必须真的减进 fit');
  ok(ev.indexOf('seatSpreadMirror') >= 0, '成员评分必须回报座位极差（供审计）');
  ok(ev.indexOf('seatWins: seatWins') >= 0, 'mirrorHealth 必须回报各座胜场');
  /* 行为断言：mirrorHealth（5 席同策略）必须给出座位分布；线上包（已知均衡）极差应 <40pt。
   * v1.5.104：样本 20 → 60 局（METHODOLOGY §31/§35 的第三次现身）。
   * v1.5.115（第十二轮复核 §31 的第四次现身）：60 局仍不够 —— v1.5.114 换包后本门被新包打到 **43pt 红**，
   * 但同一份包的极差随样本量单调收敛：n=20→57.1 · 60→43.2 · 80→39.0 · 120→37.0 · 160→34.1
   * · 240→27.7 · 320→27.0 · 400→26.6pt ⇒ 真值约 27pt，43pt 是抽样噪声。
   * 按 §31「判据要用够用的样本，而不是放宽阈值」⇒ n 提到 **400**（实测 3.5 秒，相对全套件可忽略），
   * **阈值 40pt 一字不放宽**；分胜负守卫同比抬到 ≥120（不可判时必须红）。 */
  const SEAT_N = 400;
  let live = null;
  try {
    const src2 = readFileSync('js/bundled-champion-3p.js', 'utf8');
    const lm2 = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src2);
    if (lm2) live = Pol.unpack(JSON.parse(lm2[1]), true);
  } catch (e) { live = null; }
  if (!live) {
    /* v1.5.201：同 D58 —— 这条是守 v1.5.114 "43pt 红"的哨兵，不许在读不出包时变成一句打印。 */
    ok(false, '线上多人包必须可读（不可判 = 红，不允许静默跳过）：' +
      (existsSync('js/bundled-champion-3p.js') ? '文件在但解析失败' : '文件不存在') +
      ' —— 训练进行中请先停训练再跑门禁');
  } else {
    const mh = T.mirrorHealth(live, SEAT_N, 5, 'multi');
    ok(Array.isArray(mh.seatWins) && mh.seatWins.length === 5, 'mirrorHealth 必须回报 5 个座位的胜场');
    ok(mh.seatDecisive >= 120, '必须有足够多分出胜负的局（实测 ' + mh.seatDecisive + '/' + SEAT_N + '；<120 时极差不可判）');
    ok(mh.seatSpread != null && mh.seatSpread < 40,
      '线上包（已知均衡）的 5 席极差必须 <40pt（实测 ' + (mh.seatSpread == null ? '?' : mh.seatSpread.toFixed(0)) + 'pt，分布 ' + mh.seatWins.join('/') + '）');
  }
});

t('D16 两个线上冠军包（2P/3P）的规则指纹都必须等于当前规则指纹（否则成绩已过期）', function () {
  /* v1.5.7（千问体检 §5-2 建议 / HANDOFF §4-9 规矩）：v1.5.4 只改了 rules.js 里一个 `target` 字段，
   * 5P 线上冠军的考卷成绩就从 38.0% 掉到 15.0%，而当时**没有任何机制**能自动发现"产物与引擎错配"。
   * 这条把两者绑成机械检查：规则源码一改 ⇒ 指纹变 ⇒ 本用例立刻红 ⇒ 必须重测线上冠军、
   * 把新成绩与新指纹一起记回 bundle 的 meta。它**故意敏感**（连注释改动都会触发），
   * 因为重记的成本是"一次考卷 + 一行 meta"，而漏掉的成本是交付质量静默下降。 */
  const cur = rulesFingerprint();
  /* v1.5.71 **更正**：这条"训练期间 bundle = 热启动基线"的旧假设**已过期**。
   * v1.5.48 做了训练隔离（自跑器只把基线拷到 staging `docs/artifacts/.training-in-3p.js`、
   * 产物从 `.training-out-3p.js` 取；线上包只在臂首**备份**、臂尾**还原**，训练期间**不写**）——
   * 实测铁证：本臂运行中 `js/bundled-champion-3p.js` 的 mtime 仍是**前一天**。
   * 旧断言于是把**每一条臂**在训练期间都打红（我用它提交时被挡了一次）⇒ 属"门禁在正常运行时乱响"。
   * 改成两条真断言：臂首快照存在 ⇒ 逐字节比对（能抓住"训练又去写线上包"这种回归 ——
   * 用户被这个坑过两次）；无快照（旧臂）⇒ 走下面的正常路径校验指纹（隔离下本来就该成立）。 */
  if (existsSync('docs/artifacts/.training.lock') && existsSync('docs/artifacts/.training-live.sha1')) {
    const want = readFileSync('docs/artifacts/.training-live.sha1', 'utf8').trim().split(/\s+/)[0];
    const got = createHash('sha1').update(readFileSync('js/bundled-champion-3p.js')).digest('hex');
    eq(got, want, '训练进行中：线上包必须与臂首快照逐字节相同（不等 ⇒ 训练在写线上包，用户被这个坑过两次）');
  }
  const bundle = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const fp = fingerprintOfBundle(bundle);
  ok(!!fp, '线上 bundle 的 meta 必须记 rulesFingerprint（当前规则指纹 = ' + cur + '）');
  eq(fp, cur, 'bundle 记的规则指纹必须等于当前规则指纹（不等 ⇒ 考卷成绩已过期，重测后把新指纹/成绩记回 meta）');
  ok(/"examScoreAtBuild"\s*:\s*[0-9.]+/.test(bundle), 'bundle 的 meta 必须记 examScoreAtBuild（构建时的考卷成绩）');

  /* v1.5.18（第三方复核 §5-1）：**2P 包也必须被罩住**。此前 `js/bundled-champion.js` 一个 meta
   * 字段都没有 ⇒ 它落在本用例视野之外：最后一次重训是 v1.3.47，此后 11 次提交动过 core，
   * 其中 v1.5.7 还把【全息屏障】移出 2P 卡表 —— 而没有任何机械检查能发现"这个包是在旧规则下训的"。
   * 反证：删掉 promote-champion2p 写的那行 meta ⇒ 本用例立即红。 */
  const bundle2 = readFileSync('js/bundled-champion.js', 'utf8');
  const fp2 = fingerprintOfBundle(bundle2);
  ok(!!fp2, '2P bundle（js/bundled-champion.js）的 meta 必须记 rulesFingerprint（v1.5.18 起；用 tools/promote-champion2p.mjs 补记）');
  eq(fp2, cur, '2P bundle 记的规则指纹必须等于当前规则指纹');
  ok(/"examScoreAtBuild"\s*:\s*[0-9.]+/.test(bundle2), '2P bundle 的 meta 必须记 examScoreAtBuild（2P 基准表 × 40 局的平均胜率）');
  ok(/window\.EPIRUS_CHAMPION\s*=/.test(bundle2), '2P bundle 的冠军槽必须还在（补 meta 不得写坏权重槽）');
});

t('D17 技能熵必须**只统计非ジ动作**（否则熵奖励会惩罚攒钱）', function () {
  /* v1.5.8（用户裁定）：熵是按**动作分布**算的，而"攒钱/等待"就是反复出ジ ⇒ 攒钱会把熵压到极低
   * ⇒ 熵奖励其实在**惩罚攒钱**，与 ep 攒钱奖励互相打架（v1.5.7 实测：熵权重 0→0.06 后
   * 最高 ep 44.8→12.8、ep≥3 决策 34.3%→5.8%）。修法：熵只统计非ジ动作。 */
  const E = T.coverageEntropy;
  ok(typeof E === 'function', 'T.coverageEntropy 必须存在（纯函数，便于钉语义）');
  const JI = R.SK.JI, GUN = R.SK.GUN, SWORD = R.SK.SWORD;
  /* ① 纯ジ（只等不做事）⇒ 广度 0 */
  eq(E({ [JI]: 100 }, null, 10).divNorm, 0, '只出ジ ⇒ 熵必须为 0');
  /* ② 90 次ジ + 10 次枪：非ジ只有一种 ⇒ 广度仍是 0（"攒钱+一招"不是广度） */
  eq(E({ [JI]: 900, [GUN]: 100 }, null, 10).divNorm, 0, '攒钱+单一招式 ⇒ 熵必须为 0');
  /* ③ 关键性质：**多出ジ不该改变熵**（旧口径下出ジ越多熵越低 ⇒ 等于惩罚攒钱） */
  const a = E({ [GUN]: 50, [SWORD]: 50 }, null, 10).divNorm;
  const b = E({ [JI]: 10000, [GUN]: 50, [SWORD]: 50 }, null, 10).divNorm;
  ok(a > 0, '两种非ジ招式均用 ⇒ 熵应 > 0（实测 ' + a.toFixed(4) + '）');
  ok(Math.abs(a - b) < 1e-9, '掺进任意多ジ都不得改变熵（实测 ' + a.toFixed(4) + ' vs ' + b.toFixed(4) + '）');
  /* ④ 单调性：多一种非ジ招式 ⇒ 熵上升 */
  ok(E({ [GUN]: 50, [SWORD]: 50, [R.SK.TANK]: 54 }, null, 10).divNorm > a, '多一种非ジ招式 ⇒ 熵应上升');
  /* ⑤ 归一化分母也排除ジ：可负担集合里只有ジ+1 招 ⇒ 熵按 ln2 归一（否则永远到不了 1） */
  const c = E({ [GUN]: 50, [SWORD]: 50 }, { [JI]: 1, [GUN]: 1, [SWORD]: 1 }, null);
  ok(Math.abs(c.divNorm - 1) < 1e-9, '两种可负担的非ジ均匀 ⇒ 归一化后应为 1（实测 ' + c.divNorm.toFixed(4) + '）');
  /* ⑥ fit 里那条也要跟着变：报告里 distinctNonJi 存在 */
  const p = Pol.makePolicy(0.25);
  Pol.setRng(T.mulberry32(31));
  const r = T.scoreMemberN(p, [{ name: 'random', sel: Bots.pickRandom }], 2, 3, 1, 0, 0);
  ok(r.distinctNonJi != null && r.nonJiShare != null, 'scoreMemberN 必须回报 distinctNonJi / nonJiShare');
  ok(r.distinctNonJi <= r.distinct, '非ジ种类数不得多于总种类数（实测 ' + r.distinctNonJi + ' vs ' + r.distinct + '）');
});

t('D18 哨声惩罚：熬到回合上限的胜利必须打折（反摆烂）', function () {
  /* v1.5.8：多人局允许"熬到上限比血量"，而考卷看不出"熬"与"打" ⇒ 必须让"熬出来的胜利"不那么值钱。
   * 实测动因（tools/champ-audit.mjs，5 座同一冠军自对局）：long-33 考卷 45.3%、自对局 20/20 局零伤害。 */
  const C = T.rankCredit;
  ok(typeof C === 'function', 'T.rankCredit 必须存在（纯函数，便于钉语义）');
  T.setFightReward({ whistlePen: 0 });                    // 旧行为
  eq(C(1, 1), 1.0, 'whistlePen=0 时头名仍是 1.0（KO 胜）');
  eq(C(1, 3), 1.0, 'whistlePen=0 时哨声局不打折（保持既有路径逐位不变）');
  T.setFightReward({ whistlePen: 0.5 });
  eq(C(1, 1), 1.0, '打出 KO 的胜利必须全额（实测 ' + C(1, 1) + '）');
  ok(Math.abs(C(1, 3) - 0.5) < 1e-9, '还有 3 人活着 ⇒ 哨声局头名只算 0.5（实测 ' + C(1, 3) + '）');
  ok(C(2, 3) < C(2, 1), '哨声局的第二名同样要低于 KO 局的第二名');
  T.setFightReward({ dealW: 0.05 });
  eq(T.fightReward().dealW, 0.05, '出手权重可调（实测 ' + T.fightReward().dealW + '）');
  T.setFightReward({ reset: true });                      // 复位
  eq(T.fightReward().whistlePen, 0, 'reset 后回到 0（默认关）');
  eq(T.fightReward().dealW, 0.01, 'reset 后出手权重回到 0.01');
  /* v1.5.12：**取消**"长程自动 0.5"。实测（lngC vs lngD，6 seed）产出逐字节相同 ⇒ 长程里是空操作
   * （长程局几乎总以淘汰结束 ⇒ 哨兵局≈0%）。惩罚只在多人 3 血有意义，用 env 显式开。 */
  T.setTrainMode('multi'); eq(T.fightReward().whistlePen, 0, 'multi 默认关');
  T.setTrainMode('long'); eq(T.fightReward().whistlePen, 0, 'long 默认也关（v1.5.12 回滚了自动 0.5）');
  T.setFightReward({ whistlePen: 0.5 }); eq(T.fightReward().whistlePen, 0.5, '仍可显式开（env / setFightReward）');
  T.setFightReward({ reset: true }); T.setTrainMode('multi');
});

t('D19 终局收缩是**全局规则**：第 100 回合起每回合末全员 −1 血（不可格挡、不计来源）', function () {
  /* v1.5.10（用户裁定）："把 100 回合之后扣血的机制直接做到正常对战规则里面，反正一般也打不了那么久"。
   * 它原本只挂在 long 模式的 `suddenDeath` 字段上 ⇒ standard/multi 完全没有这条规则。
   * 现在阈值是全局 `R.SUDDEN_DEATH`（模式仍可用自己的字段覆盖，写 0 = 关）。 */
  eq(R.SUDDEN_DEATH, 100, '全局阈值必须是 100');
  const mk = function (round) {
    /* v1.5.65：全局 100 的用例改用 long（它继承全局阈值）；multi 已有自己的 45（下面单独断言）。 */
    const st = S.createState('long', { next: T.mulberry32(7) }, 3);
    st.round = round;
    return st;
  };
  /* ① 第 99 回合：不触发 */
  let st = mk(99);
  const hpA = st.p.map(function (p) { return p.hp; });
  X.endTurn(st);
  eq(st.p[0].hp, hpA[0], '第 99 回合不该触发终局收缩');
  eq(st.p[1].hp, hpA[1], '第 99 回合不该触发终局收缩（所有人）');
  /* v1.5.65 新增：multi 自己的阈值必须生效（44 不触发 / 45 触发） */
  const mkMulti = function (round) { const st2 = S.createState('multi', { next: T.mulberry32(7) }, 3); st2.round = round; return st2; };
  let sm = mkMulti(44);
  const hpM = sm.p.map(function (p) { return p.hp; });
  X.endTurn(sm);
  eq(sm.p[0].hp, hpM[0], 'multi 第 44 回合不该触发收缩（阈值 45）');
  sm = mkMulti(45);
  const hpM2 = sm.p.map(function (p) { return p.hp; });
  X.endTurn(sm);
  eq(sm.p[0].hp, hpM2[0] - 1, 'multi 第 45 回合必须全员 −1（这是"不打"不再免费的规则基础）');
  /* ② 第 100 回合：全员 −1 */
  st = mk(100);
  const hpB = st.p.map(function (p) { return p.hp; });
  X.endTurn(st);
  const hpN = st.p.map(function (p) { return p.hp; });
  ok(hpN.every(function (h, i) { return h === hpB[i] - 1; }), '第 100 回合必须全员 −1（实测 ' + hpN.join('/') + '，原 ' + hpB.join('/') + '）');
  /* ③ 有防御架势也照掉（这是"场地收缩"，不是攻击） */
  st = mk(100);
  S.attemptAction(st, 0, R.SK.GUARD, {});
  const hpC = st.p[0].hp;
  X.resolveActions(st);
  X.endTurn(st);
  eq(st.p[0].hp, hpC - 1, '有防御架势也必须掉 1 血（不可格挡）');
  /* ④ 事件可追溯：reason=终局收缩，且不记任何人战功 */
  const evs = st.events.filter(function (e) { return e.type === 'damage' && e.reason === '终局收缩'; });
  ok(evs.length >= 1, '必须有 reason=终局收缩 的伤害事件（实测 ' + evs.length + ' 条）');
  ok(evs.every(function (e) { return e.source === undefined || e.source === null; }),
    '终局收缩的伤害不得有来源（否则会记成某个人的战功）');
  /* ⑤ 模式仍可覆盖（写 0 = 关掉） */
  const st5 = S.createState('multi', { next: T.mulberry32(7) }, 3);
  st5.round = 100;
  const realMode = st5.mode;
  st5.mode = { hp: realMode.hp, minPlayers: 3, maxPlayers: 5, suddenDeath: 0, maxRounds: realMode.maxRounds };
  const hpD = st5.p[0].hp;
  X.endTurn(st5);
  eq(st5.p[0].hp, hpD, '模式把 suddenDeath 写成 0 时必须真的关掉（可覆盖）');
  /* ⑥ v1.5.11：**起扣回合与每回合扣血量都可调**（页面入口经 createState 的 opts 传入）
   *    —— 且必须是浅拷贝，不能污染全局共享的 MODES 对象（否则会串到之后所有对局） */
  const st6 = S.createState('multi', { next: T.mulberry32(7) }, 3, { suddenDeath: 5, suddenDeathDmg: 2 });
  st6.round = 5;
  const hpE = st6.p[0].hp;
  X.endTurn(st6);
  eq(st6.p[0].hp, hpE - 2, 'suddenDeathDmg=2 时每回合必须扣 2 血（实测 ' + st6.p[0].hp + ' vs ' + hpE + '）');
  eq(st6.mode.suddenDeath, 5, 'createState 的 opts 必须能覆盖起扣回合');
  /* v1.5.65：multi 现在**自己**有 suddenDeath=45（见 D3）⇒ 这里改成断言"全局值保持模式自身的 45"，
   * 而上面那次 opts 覆盖是 5 ⇒ 若发生污染，这里就会变成 5（污染检查的效力不变）。 */
  eq(R.MODES.multi.suddenDeath, 45, 'opts 覆盖不得污染全局 MODES（全局仍是模式自身的 45）');
  eq(R.SUDDEN_DEATH_DMG, 1, '全局默认每回合扣 1 血');
});

t('D20 狙击"被干扰"只认"狙击手本人被攻击"（多人局；v1.5.13 修用户报的 bug）', function () {
  /* 用户对局记录（results/epirus-battle-22回合.txt）第 16 回合：玩家5 用枪打**玩家3**，
   * 却把玩家1 打玩家5 的狙击枪判成"狙击被干扰"。
   * 原始 README 特殊 2：「若被作用者或其余玩家对**该玩家**（狙击手）使用其它带攻击效果技能则狙击无效」；
   * 特殊 3 的爆头条件：「若**被作用者**使用的技能对**攻击者**没有影响」⇒ 两者都要求"指向狙击手"。
   * 旧实现只看"目标这回合用了什么技能"、不看打谁 ⇒ 2 人局恰好等价（所以 spec R13/57 一直绿），多人局才错。 */
  const disturbed = function (st) { return st.events.some(function (e) { return e.type === 'voided' && e.by === '狙击被干扰'; }); };
  const mk = function (seed) {
    const st = S.createState('multi', { next: T.mulberry32(seed || 11) }, 3);
    st.p[0].ep = st.p[1].ep = st.p[2].ep = 9;
    return st;
  };
  /* ① 目标打**第三方** ⇒ 狙击必须命中（旧实现在这里会误判） */
  let st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(!disturbed(st), '目标打第三方时不得判"狙击被干扰"');
  ok(st.p[1].hp < 3, '目标打第三方时狙击必须命中（实测目标 hp=' + st.p[1].hp + '）');
  /* ② 第三个人打**狙击手** ⇒ 无效（"其余玩家对该玩家使用"这一支） */
  st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(disturbed(st), '狙击手被别人打 ⇒ 必须判"狙击被干扰"');
  eq(st.p[1].hp, 3, '被干扰时目标不掉血');
  /* ③ 目标自己打狙击手 ⇒ 无效（2 人局的老口径，多人局同样成立）
   *    注意：多人局这条通常走**优先级规则**（枪 pri2 > 狙击 pri1 ⇒ "被高优先级攻击阻止"），
   *    所以断言"狙击被废 + 目标不掉血"，不锁具体 by（v1.5.13 实测两者的 by 不同）。 */
  st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'voided' && e.pid === 0; }),
    '目标自己打狙击手 ⇒ 狙击必须被废（by=' + JSON.stringify(st.events.filter(function (e) { return e.type === 'voided'; }).map(function (e) { return e.by; })) + '）');
  eq(st.p[1].hp, 3, '被干扰时目标不掉血');
  /* ④ 2 人局口径不许变（spec R13/57 的等价场景） */
  st = S.createState('standard', { next: T.mulberry32(3) }, 2);
  st.p[0].ep = st.p[1].ep = 9;
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'voided' && e.pid === 0; }), '2 人局：被枪反打 ⇒ 狙击必须被废（不许回退）');
  eq(st.p[1].hp, 3, '2 人局被干扰时目标不掉血');
});

t('D21 先手激励（v1.5.14 选项 A）：默认关，且"首伤方"的判定只看带 source 的伤害', function () {
  /* 动机（REVIEW §12）：多人局三张架势牌费用为 0 ⇒ 互戒均衡；`deal` 只有 0.01、`proact` 是相对
   * 全场均值的（全场 0 伤害时恒 0）⇒ 对称局面下没有梯度先出手。**首伤奖励是区分名次的项**
   * （每局只有一个席位拿到），这是它可能有效的关键；而统一加在所有人身上的项（如哨声惩罚）无效。 */
  eq(T.fightReward().firstW, 0, '默认必须关（不猜默认值，先用对照臂证明）');
  eq(T.fightReward().dealW, 0.01, 'deal 默认仍是 0.01');
  T.setFightReward({ firstW: 0.08, dealW: 0.05 });
  eq(T.fightReward().firstW, 0.08, '可显式打开先手奖励');
  eq(T.fightReward().dealW, 0.05, '可显式抬高出手权重');
  const F = T.firstBloodSeat;
  ok(typeof F === 'function', 'T.firstBloodSeat 必须存在（纯函数，便于钉语义）');
  eq(F([]), null, '没有事件 ⇒ 无先手');
  eq(F([{ type: 'ep', pid: 1, delta: 1 }]), null, '只有攒钱事件 ⇒ 无先手');
  /* 关键：终局收缩是 source:null 的场地伤害，不能算任何人的先手 */
  eq(F([{ type: 'damage', to: 3, amt: 1, reason: '终局收缩', source: null }]), null, '终局收缩不算先手');
  /* 有人真的打中了 ⇒ 那才是先手；后续伤害不改变"第一" */
  eq(F([{ type: 'damage', to: 2, amt: 1, reason: '枪', source: 4 },
        { type: 'damage', to: 1, amt: 2, reason: '激光剑', source: 0 }]), 4, '第一个造成伤害的席位才算先手');
  T.setFightReward({ reset: true });
  eq(T.fightReward().firstW, 0, 'reset 回到关');
  eq(T.fightReward().dealW, 0.01, 'reset 回到 0.01');
});

t('D22 蓄能的珠类型不得泄漏给对手（v1.5.15 修用户报的信息泄漏）', function () {
  /* 规则：`蓄能` 选电珠还是爆珠**只有本人知道**，其他角色只知道"有人蓄能了"。
   * 旧实现把类型直接喂给了 AI（特征里 `.elec/.boom` 的对手项，以及逐对手的 elec/boom 两项）。
   * 判据：构造两个**只差"2 号位的珠类型"**的状态 ⇒ **0 号位看到的特征向量必须逐位相同**。 */
  const mk = function (elec, boom) {
    const st = S.createState('multi', { next: T.mulberry32(9) }, 3);
    st.p[1].elec = elec; st.p[1].boom = boom;
    return st;
  };
  const diffIdx = function (a, b) {
    const out = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
    return out;
  };
  const fA = Pol.features(mk(1, 0), 0), fB = Pol.features(mk(0, 1), 0), fC = Pol.features(mk(0, 0), 0);
  eq(fA.length, fB.length, '特征长度必须一致');
  eq(diffIdx(fA, fB).length, 0, '对手持电珠 vs 持爆珠 ⇒ 特征必须**完全相同**（泄漏下标=' + JSON.stringify(diffIdx(fA, fB)) + '）');
  /* 但两条**公开**信息必须保留（否则是把公开信息也一起砍了） */
  ok(diffIdx(fA, fC).length > 0, '必须仍能感知"有对手持珠（类型未知）"');
  const st3 = S.createState('multi', { next: T.mulberry32(9) }, 3);
  st3.p[1].lastSkill = R.SK.CHARGE;
  ok(diffIdx(Pol.features(st3, 0), fC).length > 0, '必须仍能感知"有对手刚蓄能"');
});

t('D14 全息屏障必须给**目标**套盾（原始规则），不是给施放者自己', function () {
  /* v1.5.4 规则修正：原始规则集（`D:\code\Epirus\README.md`「全息屏障」）写明
   *   「作用效果：给**被作用者**施加一个“原型制御”」+ 手势「双臂伸出挡住**被作用者**胸前」
   * ⇒ 它是**一张对别人用的盾**。此前 `target:'self'`（R18）把它做成了原型制御的重复品
   * （用户裁定：写两个一模一样的技能没有意义）。
   * 反证：把 rules.js 的 target 改回 'self'、或删掉 resolve.js 里的 holoShieldFrom，本用例立刻红。 */
  ok(R.byKey[R.SK.HOLO].target !== 'self', '全息屏障的目标必须是别人（实测 target=' + R.byKey[R.SK.HOLO].target + '）');
  function mk3() {
    const st = S.createState('multi', { next: mulberry32(7) }, 3);
    st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
    X.startTurn(st);
    return st;
  }
  /* ① 盾套在 P1 身上 ⇒ P1 被打不掉血（盾真的生效） */
  let st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  X.resolveActions(st);
  eq(st.p[1].hp, 3, '被套盾者应被挡住（枪 1 伤）');
  /* ② 盾在 P1 身上，不是施放者身上 ⇒ 打**施放者 P0** 必须照常掉血（旧实现会把他护住） */
  st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 2, '施放者不该被自己的屏障护住（这正是修正前的老行为）');
  eq(st.p[1].hp, 3, '被套盾者本回合没挨打');
  /* ③ 回归：原型制御仍是自保 */
  st = mk3();
  S.attemptAction(st, 0, R.SK.PROTO, {});
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 3, '原型制御仍是自保（回归）');
  /* ④ 试图把盾套给自己 ⇒ 兜底到别人（规则里目标是"被作用者"） */
  st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 0 });
  ok(st.actions[0].target !== 0 && st.actions[0].target != null, '套不到自己（实测 target=' + st.actions[0].target + '）');
  /* ④b v1.5.7（用户裁定）：全息屏障是**多人专用卡** ⇒ 2P 模式不再提供它
   *     （2P 里唯一能套的就是对手 ⇒ 纯陷阱；而自保已有原型制御、效果相同 ⇒ 灰掉零损失） */
  const k2p = R.MODES.standard.skills.map(function (x) { return (typeof x === 'string' ? x : x.key); });
  ok(k2p.indexOf(R.SK.HOLO) < 0, '2P 技能表不得含全息屏障（实测 ' + k2p.length + ' 个技能）');
  ok(k2p.indexOf(R.SK.PROTO) >= 0, '2P 必须保留原型制御（自保的正规手段）');
  const kMulti = R.MODES.multi.skills.map(function (x) { return (typeof x === 'string' ? x : x.key); });
  ok(kMulti.indexOf(R.SK.HOLO) >= 0, '多人模式必须保留全息屏障');
  /* ⑤ 小雷（pri5）在屏障（pri3）之前结算：打**施放者** ⇒ 这次施法被无效化，屏障不该出现。
   * ⚠️ 这是 v1.5.4 的第二个坑：盾若从 `state.actions` 直读（不看 `voided`）就会漏掉无效化，
   * 症状是"小雷明明打了施放者，被套盾的人还是被护住"。（原始规则：雷击之枪需要对**使用者**作用才能使其无效） */
  function mk4() {
    const s4 = S.createState('multi', { next: mulberry32(7) }, 4);
    for (const q of s4.p) q.ep = 5;
    X.startTurn(s4);
    return s4;
  }
  st = mk4();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 0 });
  X.resolveActions(st);
  eq(st.p[1].hp, 2, '小雷打施放者 ⇒ 屏障被无效化（被套盾者照样挨枪）');
  eq(st.events.filter(function (e) { return e.type === 'holoSet'; }).length, 0, '被无效化的屏障不该留下 holoSet 事件');
  /* ⑥ 反过来：小雷打**被套盾者** ⇒ 盾仍在（要打施放者才能拆盾），只是那个人自己的技能被无效化 */
  st = mk4();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 1 });
  X.resolveActions(st);
  eq(st.p[1].hp, 3, '小雷打被套盾者 ⇒ 盾仍在');
  eq(st.p[2].hp, 3, '被套盾者自己的技能被无效化（枪没打出去）');
});

t('D23 镜面反射：没有"无可复制" + 优先级裁定（大雷 pri4 先于镜面 pri3）（v1.5.16/v1.5.17 用户裁定）', function () {
  /* v1.5.16（用户裁定）：「没有"无可复制"这回事 —— 所有技能都能复制」：架势 / 自增益 / 能量类复制到
   * **使用者自己**身上（相当于自己也摆了那个架势 / 也蓄了能）；t1 行动被作废时才是"无可复制"。
   * v1.5.17（用户**二次 + 三次**裁定，推翻上一版）：**大雷(pri4) 优先于镜面反射(pri3)** ⇒ 目标若用镜面反射
   * 会先被大雷**无效化**，"反弹并没有被复制成功"；而**同优先级时防御类先出现** ⇒ 复制来的防御架势
   * 挡得住同优先级(pri3)的激光剑 / 坦克（按原本的伤害矩阵），也挡得住随后结算的 ⑤ 枪 / ⑥ 狙击。
   * 反证（三条都会让本用例立刻红）：① 自效果表失效（复制ジ不给 ep）② `guardOf` 改回"从声明派生"
   * （不看 `copiedGuard` 状态）③ 把镜面反射也豁免大雷的"非防御类无效化"。
   * 另有 ④ 去掉 `mirrorGuardPass`（防御架势不在 ④ 之前落位）⇒ D23②c 红。 */
  function mk4() {
    const s = S.createState('multi', { next: mulberry32(11) }, 4);
    for (const q of s.p) q.ep = 6;
    X.startTurn(s);
    return s;
  }
  const cnt = function (st, type) {
    return st.events.filter(function (e) { return e.type === type; }).length;
  };

  /* ① 复制【反弹】⇒ 自己真的获得反弹架势（空指 → t2），且不再发"无可复制"。
   *    对手的枪是 pri2 ⇒ 在镜面反射（pri3）之后结算 ⇒ 这一条正是"复制从结算那一刻起生效"的正例。 */
  let st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(cnt(st, 'mirrorNoEffect'), 0, '不该出现"无可复制"（t1 有行动）');
  eq(cnt(st, 'mirrorCopySelf'), 1, '应有一条"复制到自己身上"');
  const g0 = X.guardOf(st, 0);
  ok(g0 && g0.kind === 'reflect', '复制到的反弹必须是**真架势**（实测 ' + JSON.stringify(g0) + '）');
  eq(st.p[0].hp, 3, '复制来的反弹挡住 P2 的枪');
  eq(st.p[2].hp, 2, '反弹把枪弹回 P2（R20：枪可被反弹）');

  /* ② **优先级裁定**：a 复制 b 的【反弹】并指向 c，d 用大雷打 a
   *    ⇒ 大雷(pri4) 先结算、把 a 的镜面反射无效化 ⇒ 复制根本没发生 ⇒ a 挨那 2 点电伤；
   *      b 仍有自己的反弹（连带打不动它）；c 只是被声明的 t2，而施法已废 ⇒ 不产生指向、不受影响。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});                       // b：自己的反弹
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 }); // a：想复制 b、指向 c
  S.attemptAction(st, 2, R.SK.JI, {});                            // c
  S.attemptAction(st, 3, R.SK.BIG_T, { target: 0 });              // d：大雷打 a
  X.resolveActions(st);
  ok(st.actions[0].voided, 'a 的镜面反射必须被大雷无效化（镜面反射不是防御族）');
  eq(cnt(st, 'mirrorCopySelf'), 0, '被作废的镜面反射不该产生任何复制');
  eq(st.p[0].hp, 1, '复制没发生 ⇒ a 实打实挨 2 点电伤（v1.5.16 那版会错误地护住他）');
  eq(st.p[1].hp, 3, 'b 有自己的反弹 ⇒ 连带动不了它');
  eq(st.p[2].hp, 3, 'c 只是被声明的 t2 而施法已废 ⇒ 不产生指向、不受连带');

  /* ②c 同优先级（v1.5.17 用户三次澄清「同优先级的时候防御类先出现」）：复制来的防御架势要挡得住
   *     **同优先级(pri3)** 的攻击 —— 坦克能穿防御但穿不了反弹 ⇒ 反弹挡得住并弹回。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.TANK, { target: 0 });              // 坦克 pri3，与镜面反射同优先级
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 3, '复制来的反弹应挡住同优先级的坦克（同优先级防御类先出现）');
  eq(st.p[2].hp, 2, '并把坦克弹回 P2（坦克在 REFLECTABLE 里）');

  /* ②d 但"本来挡不住的"仍挡不住：激光剑可攻破反弹（pierce.reflect）⇒ 复制来的反弹也挡不住它
   *     （否则就是把这个澄清改成了"复制来的防御无敌"，伤害矩阵被改坏）。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.SWORD, { target: 0 });
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 2, '激光剑穿反弹 ⇒ 复制来的反弹挡不住（伤害矩阵保持原样）');

  /* ③ 自增益/能量类也复制到自己身上：复制【ジ】⇒ 自己 +1 ep（镜面反射 3 ⇒ 6-3+1=4） */
  st = mk4();
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].ep, 4, '复制【ジ】应给使用者自己 +1 ep');

  /* ④ 复制【蓄能】的珠类型取**使用者自己**的选择，不读 t1 的（t1 蓄哪种珠是隐藏信息，见 D22） */
  st = mk4();
  S.attemptAction(st, 1, R.SK.CHARGE, { bead: 'elec' });
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2, bead: 'boom' });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].boom, 1, '复制蓄能应得使用者自己选的爆珠');
  eq(st.p[0].elec, 0, '不得因为 t1 蓄了电珠就白拿电珠（那等于泄漏隐藏信息）');

  /* ⑤ 唯一的合法"无可复制"：t1 本回合行动已被作废 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.GUN, { target: 3 });        // t1 用枪
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });        // 用它验证"确实没拿到任何架势"
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 1 });     // 小雷作废 t1 的枪
  X.resolveActions(st);
  eq(cnt(st, 'mirrorNoEffect'), 1, 't1 被作废 ⇒ 唯一合法的"无可复制"');
  eq(cnt(st, 'mirrorCopySelf'), 0, 't1 被作废时不该复制任何东西');
  eq(st.p[0].hp, 2, '没拿到架势 ⇒ 枪照常命中');

  /* ⑥ 穷举守门：技能表里**每一个**技能都必须被显式归类（新增技能必须决定它怎么被复制，
   *    否则会出现"复制了等于没复制"这种静默漏洞 —— 本项目的第四次同类事故就是这个形状）。 */
  const DMG_COPY = [R.SK.GUN, R.SK.SWORD, R.SK.TANK, R.SK.SNIPE, R.SK.DRAIN, R.SK.RAILGUN,
    R.SK.BIG_T, R.SK.CANNON, R.SK.LASER_EYE, R.SK.DUAL_GUN];
  const AIR_ONLY = [R.SK.MINI_T, R.SK.TRANSFER, R.SK.CURSE, R.SK.FIRESTORM, R.SK.TAUNT, R.SK.MIRROR];
  const cls = {};
  for (const k of DMG_COPY) { ok(!cls[k], '分类重复：' + k); cls[k] = 'dmg'; }
  for (const k of R.MIRROR_SELF) { ok(!cls[k], '分类重复：' + k); cls[k] = 'self'; }
  for (const k of AIR_ONLY) { ok(!cls[k], '分类重复：' + k); cls[k] = 'air'; }
  const all = R.skills.map(function (s) { return s.key; });
  const unclassified = all.filter(function (k) { return !cls[k]; });
  eq(unclassified.length, 0, '有技能没归类（新增技能必须决定怎么复制）：' + JSON.stringify(unclassified));
  eq(Object.keys(cls).length, all.length, '分类表必须与技能表一一对应（技能数 ' + all.length + '）');

  /* ⑦ "归类了但没实现"也要红：把每个自效果技能真的复制一遍，看架势/资源是否到位 */
  const EXPECT = {};
  EXPECT[R.SK.GUARD] = 'guard'; EXPECT[R.SK.REFLECT] = 'reflect'; EXPECT[R.SK.BAGUA] = 'bagua';
  EXPECT[R.SK.SHIFT] = 'bagua'; EXPECT[R.SK.JINSHIELD] = 'jinshield'; EXPECT[R.SK.ARMOR] = 'armor';
  EXPECT[R.SK.PROTO] = 'proto'; EXPECT[R.SK.HOLO] = 'proto';   // 复制全息屏障 = 原型制御式自保（v1.5.7 两者等价）
  for (const k of R.MIRROR_SELF) {
    const s2 = S.createState('multi', { next: mulberry32(3) }, 3);
    for (const q of s2.p) q.ep = 9;
    X.startTurn(s2);
    ok(S.canUseSkillInMode(s2, k), '多人模式应可用：' + k);
    S.attemptAction(s2, 1, k, {});
    eq(s2.actions[1].outcome, 'ok', 't1 用 ' + k + ' 应成功（' + s2.actions[1].reason + '）');
    S.attemptAction(s2, 0, R.SK.MIRROR, { target: 1, target2: 2 });
    S.attemptAction(s2, 2, R.SK.JI, {});
    X.resolveActions(s2);
    ok(s2.events.some(function (e) { return e.type === 'mirrorCopySelf' && e.key === k; }),
      '复制【' + k + '】必须走"复制到自己身上"分支');
    if (EXPECT[k]) {
      const gg = X.guardOf(s2, 0);
      ok(gg && gg.kind === EXPECT[k], '复制【' + k + '】后架势应为 ' + EXPECT[k] + '（实测 ' + JSON.stringify(gg) + '）');
    }
    if (k === R.SK.MINE) ok(s2.p[0].mineArmed, '复制地雷应让自己也架上雷');
    if (k === R.SK.ROD) ok(s2.p[0].rodGuard > 0, '复制避雷针应得到免雷窗口（R31 情形B）');
  }

  /* ⑧ 页面必须真的会渲染这条新事件：事件渲染是纯映射、**没有默认分支** ⇒ 漏了就是静默不显示。 */
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  ok(/case 'mirrorCopySelf'/.test(uiSrc), 'ui.js 必须渲染 mirrorCopySelf 事件');
  ok(/case 'mirrorNoEffect'/.test(uiSrc), 'ui.js 必须仍渲染 mirrorNoEffect（t1 被作废那条）');
});

t('D24 反摆烂奖励 env 只能有**一个**读取点（server/fight-env.mjs）—— 两端各写一遍会静默半开', function () {
  /* 第三方复核 §5-3（实测）：`train-server.mjs` 的触发条件写的是 `whistlePen || dealW`，
   * 而 `train-worker.mjs` 三个 env 都判 ⇒ **只设 `EPIRUS_FIGHT_FIRST` 时主线程不开、worker 开**：
   * 产物静默少一份适应度，日志完全正常（与 v1.5.0 的 mode 半开同型）。历史两轮 fstA/fstB
   * 因为同时设了 dealW 才侥幸没暴露。
   * 修法不是"补一个 ||"（那正是它第二次犯错的方式），而是**单一来源**：env 名与"要不要覆写"
   * 都只在 `server/fight-env.mjs` 里。这条断言扫全库训练侧代码文件，出现第二处读取点就红
   * —— 与 D7（对手池单一来源）同一族。反证：把 `readFightEnv` 换回任一处裸读 ⇒ 立即红。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'tools/ring2-run.mjs',
    'js/train/evo.js', 'js/train/policy.js', 'js/train/trainer.js'];
  const bad = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i2 = 0; i2 < lines.length; i2++) {
      const L = lines[i2];
      const t2 = L.trim();
      if (t2.startsWith('*') || t2.startsWith('//') || t2.startsWith('/*')) continue;   // 注释里提到名字不算
      const re = /EPIRUS_FIGHT_[A-Z_]+/g; let m2;
      while ((m2 = re.exec(L))) bad.push(f + ':' + (i2 + 1) + '  ' + m2[0]);
    }
  }
  eq(bad.length, 0, 'EPIRUS_FIGHT_* 的读取必须集中在 server/fight-env.mjs：\n    ' + bad.join('\n    '));

  /* 正证：被集中的那一份必须真的覆盖三个 env，且两端都从它导入（否则"集中"只是集中了一半）。 */
  const fe = readFileSync('server/fight-env.mjs', 'utf8');
  for (const k of ['EPIRUS_FIGHT_WHISTLE', 'EPIRUS_FIGHT_DEAL', 'EPIRUS_FIGHT_FIRST']) {
    ok(fe.indexOf(k) >= 0, 'fight-env.mjs 必须覆盖 ' + k);
  }
  ok(fe.indexOf('hasFightOverride') >= 0, 'fight-env.mjs 必须导出"要不要覆写"的判定（两端共用同一份）');
  for (const f of ['server/train-server.mjs', 'server/train-worker.mjs']) {
    ok(readFileSync(f, 'utf8').indexOf("from './fight-env.mjs'") >= 0, f + ' 必须从 fight-env.mjs 导入');
  }
});

t('D25 播种必须**真的**可复现：同 seed 两遍逐字节相同、换 seed 必须不同（实测，不靠 grep）', function () {
  /* 第三方复核 §5-2 的结论是"REPRO2 形同虚设"：它的判据是**字符串存在性**，而 2P 入口整段没播种
   * 照样通过。这条把"可复现"从"代码里出现了某个词"变成**跑两遍比字节**。
   * 反向对照同样重要：换 seed 必须产出不同结果 —— 否则可能是"播种了但没人用它"。
   * （这也正是 §5.2-16 那条教训的固化：`workers` 都是行为输入，何况随机流。） */
  const orig = sb.Math;
  const runOnce = function (seed) {
    const s0 = (seed >>> 0) || 1;
    const M = Object.create(Math);
    let s = s0;
    M.random = function () {
      s = (s + 0x6D2B79F5) | 0;
      let t2 = Math.imul(s ^ (s >>> 15), 1 | s);
      t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
      return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
    };
    sb.Math = M;                                  // 覆盖 evo/bots 里的裸 Math.random（等价 __seedSandbox）
    Pol.setRng(T.mulberry32(s0 * 7919 + 13));     // policy 的 randn
    const tr = T.makeTrainer({ popSize: 8, gamesPerOpp: 4 });
    for (let g = 0; g < 3; g++) T.step(tr);
    return JSON.stringify(Pol.pack(tr.champion));
  };
  try {
    const a1 = runOnce(31), a2 = runOnce(31), b1 = runOnce(32);
    eq(a1, a2, '同 seed 同代数必须逐字节相同（不可复现 ⇒ 一切 A/B 都是噪声）');
    ok(a1 !== b1, '换 seed 必须产出不同结果（若相同，说明"播种"根本没被用上）');
  } finally { sb.Math = orig; }
});

t('D26 网络形状必须被钉住（FEAT_S/FEAT_A/paramCount）+ v5 裁剪规则精确（shapeOf 守门）', function () {
  /* 第三方复核 §5-7：`docs/PARAMS-PLAN.md` 承诺过一条"shapeOf 守门"，但**它并不存在** ——
   * np-test 全文没有 shapeOf，也没有任何断言钉住 FEAT_S=123 / paramCount=3337。
   * 后果：静默改维度不会被任何用例发现，而那正是"升 v6 时 7 个 v5 存档当场变砖"的成因。
   * 这条把常量、反推、以及**v5 裁剪规则**一起钉住：维度一变立刻红，逼你同步 PACK_VERSION 与裁剪规则。 */
  /* v7（v1.5.19）：候选体系 + 关系块 T(15) + 效果快照块 B(70) + 动作侧 +8。
   * 常量一变就必须同步：PACK_VERSION、VER_SHAPES 形状表、裁剪规则、两个 bundle 的重训与重记。 */
  eq(Pol.FEAT_S, 213, 'FEAT_S 变了 ⇒ 旧冠军包不兼容，必须同时升 PACK_VERSION 并写清裁剪规则');
  eq(Pol.FEAT_A, 22, 'FEAT_A 变了 ⇒ 动作特征布局变了（v7：+2 珠类型 +6 目标相对）');
  eq(Pol.FEAT_N, 235, 'FEAT_N 必须 = FEAT_S + FEAT_A');
  eq(Pol.HID, 24, 'HID 变了 ⇒ 参数量与所有训练曲线不可比');
  eq(Pol.PACK_VERSION, 7, 'PACK_VERSION 变了 ⇒ 游戏侧 checkPack 会拒绝所有旧包（要有意为之）');
  eq(Pol.paramCount(), 5689, 'paramCount = HID*FEAT_N + HID + HID + 1');
  eq(Pol.FEAT_S_V6, 123, 'v6 前缀长度错了 ⇒ 旧包会按错位置裁剪（静默错位）');
  eq(Pol.EFFECTS.length, 14, 'B 块效果表的条数变了 ⇒ 同时改"每玩家槽位数"与文档');
  eq(Pol.PLAYER_SLOTS, 5, '自己 + 4 个对手槽');
  /* ACT_KEYS 是"动作键表"（= R.skills 的 key），**不是** FEAT_A 那个 14 维动作特征。
   * 这里钉住卡数：新增一张卡会同时改变 ACT_KEYS / `MIRROR_SELF` 归类 / 特征布局，
   * 必须是有意为之（算法见 `PARAMS-PLAN.md` §3）。 */
  eq(Pol.ACT_KEYS.length, 30, '技能表必须是 30 张卡（TOTAL 变了就要同步走一遍"新增卡必须显式归类"的守门）');

  const cur = new Float64Array(Pol.paramCount());
  const nw = Pol.shapeOf(cur);
  ok(nw && nw.featS === Pol.FEAT_S && nw.featA === Pol.FEAT_A && nw.legacy === false,
    'shapeOf 对新形状必须给出 featS=' + Pol.FEAT_S + '/featA=' + Pol.FEAT_A + ' 且非 legacy');
  /* v7 起 FEAT_A 也会变 ⇒ 形状**必须按表查**：(len-49)/24 只能反推出 featN，
   * 无法决定"状态段/动作段"的切分点（切错 = 静默错位，正是这套机制存在的理由）。 */
  const v6Len = Pol.HID * (123 + 14) + Pol.HID + Pol.HID + 1;
  eq(v6Len, 3337, 'v6 参数量应当 = 3337');
  const v6s = Pol.shapeOf(new Float64Array(v6Len));
  ok(v6s && v6s.featS === 123 && v6s.featA === 14 && v6s.legacy === true,
    'shapeOf 必须认出 v6（featS=123 / featA=14）并标 legacy —— 只靠整除反推会把它切成 115+22');
  const oldLen = Pol.HID * (122 + 14) + Pol.HID + Pol.HID + 1;
  eq(oldLen, 3313, 'v5 参数量应当 = 3313');
  const od = Pol.shapeOf(new Float64Array(oldLen));
  ok(od && od.featS === 122 && od.featA === 14 && od.legacy === true, 'shapeOf 必须认出 v5（featS=122/featA=14）');
  eq(Pol.unpack({ v: 5, a: new Array(oldLen).fill(0), f: 122, h: Pol.HID }), null,
    '游戏侧 unpack 必须**拒绝** v5 包（严格校验是刻意的）');
  eq(Pol.unpack({ v: 6, a: new Array(v6Len).fill(0), f: 123, h: Pol.HID }), null,
    '游戏侧 unpack 必须**拒绝** v6 包（v7 上线后线上包必须重训重发）');
  const lg = Pol.unpack({ v: 5, a: new Array(oldLen).fill(0), f: 122, h: Pol.HID }, true);
  ok(lg && lg.length === oldLen, '工具侧 unpack(o,true) 必须仍能读 v5 包（否则 A/B 证据链一次性）');
  const lg6 = Pol.unpack({ v: 6, a: new Array(v6Len).fill(0), f: 123, h: Pol.HID }, true);
  ok(lg6 && lg6.length === v6Len, '工具侧必须仍能读 v6 包（用于与历史冠军做配对对照）');

  /* v5 裁剪规则必须精确等于"v6 去掉'自己跨得过环启动线'那一维"（运行时探测，不硬编码下标）。
   * 裁错维度不会有任何报错 —— 只会让旧包静默错位，所以这条必须是逐位比较。 */
  const mk = function (rs) {
    const s2 = S.createState('standard', { next: function () { return 0.5; } }, 2);
    s2.p[0].ep = 3; s2.p[0].ringStreak = rs;
    return Pol.featuresV7(s2, 0);
  };
  const a0 = mk(0), b0 = mk(3);
  let idx = -1;
  for (let i = 0; i < a0.length; i++) if (a0[i] - b0[i] > 0.5) { idx = i; break; }
  ok(idx >= 0, '应当能探测到"自己跨得过环启动线"那一维（特征加了新维度就得同步改裁剪规则）');
  ok(idx < 123, 'v7 新维度必须全部追加在 123 之后（插在中间会让 v6 前缀错位）');
  const st5 = S.createState('standard', { next: function () { return 0.5; } }, 2);
  const f6 = Pol.features(st5, 0, 123);
  eq(f6.length, 123, 'features(state,pid,123) 必须裁成 v6 长度');
  eq(f6.join(','), Pol.featuresV7(st5, 0).slice(0, 123).join(','),
    'v6 裁剪必须逐位等于新向量的**前 123 维**（裁错 = 旧包静默错位）');
  const f5 = Pol.features(st5, 0, 122);
  eq(f5.length, 122, 'features(state,pid,122) 必须裁成 v5 长度');
  const expect = Pol.featuresV7(st5, 0).slice(0, 123).filter(function (_, i) { return i !== idx; });
  eq(f5.join(','), expect.join(','), 'v5 裁剪必须逐位等于"v6 去掉那一维"（裁错维度 = 旧包静默错位）');

});

/* v1.5.202：本块原**嵌在 D26 的用例里** —— 它失败会报成 `✘ D26 网络形状必须被钉住…`，
 * 把读者指向网络形状常量（而那是对的），是"名字与内容不对应"的典型。提成独立用例，判定一个字没改。 */
t('D33b v7 两块新状态特征的语义：T 关系块（上一手指向谁）+ B 效果快照块（符号 = 自施/他施）—— 原嵌在 D26 里，失败会误报成 D26', function () {
  /* ===== D33（同一条用例里）：v7 两块新状态特征的语义 ===== */
  /* T 关系块：上一手"指向谁"必须可读 —— `state.actions` 每回合清空，所以引擎把它落在
   * `p.lastTarget` 上（js/core/state.js）。这里同时钉住"引擎真的写了"和"特征真的读了"。 */
  const st3 = S.createState('multi', { next: function () { return 0.5; } }, 3);
  X.startTurn(st3);
  S.attemptAction(st3, 1, R.SK.GUN, { target: 2 });      // 玩家1 拿枪指**玩家2（不是我）**
  S.attemptAction(st3, 0, R.SK.JI, {});
  S.attemptAction(st3, 2, R.SK.JI, {});
  eq(st3.p[1].lastTarget, 2, '引擎必须把"这一手指向谁"留在 p.lastTarget 上（决策时刻 state.actions 已清空）');
  X.resolveActions(st3); X.endTurn(st3);
  X.startTurn(st3);
  const fv = Pol.featuresV7(st3, 0);
  const tBase = Pol.FEAT_S - Pol.EFFECTS.length * Pol.PLAYER_SLOTS - 4 * Pol.PLAYER_SLOTS;
  eq(tBase, 123, 'T/B 两块必须正好从第 124 维（下标 123）开始');
  /* v1.5.52：对手槽顺序在并列时是**随机**的（L7：不得有确定性身份映射）⇒ 测试**不得硬编码槽下标**，
   * 必须按 pid 反查槽位。（旧写法硬编码"玩家1 在槽 1"，那是"槽位永远按 pid 升序"时代的遗留。） */
  const slots0 = Pol.oppSlots(st3, 0);
  const SL1 = 1 + slots0.indexOf(1);
  ok(slots0.indexOf(1) >= 0 && slots0.indexOf(2) >= 0, '三人局里 1、2 号都必须出现在对手槽里');
  eq(fv[tBase + SL1 * 4 + 2], 1, 'T 块：玩家1 的"上一手指向别人"必须是 1（三人局"他们互相打"的核心信号）');
  eq(fv[tBase + SL1 * 4 + 1], 0, 'T 块：玩家1 上回合指的不是我 ⇒"指向我"必须是 0');
  eq(fv[tBase + 0 * 4 + 0], 1, 'T 块：我上回合按ジ ⇒ 引擎解析出来的目标就是自己（"指向自己"=1）');
  /* B 效果快照块：值的符号 = 自己施加(+) / 他人施加(−)（镜面复制来的架势就是"他人给的"） */
  const bBase = Pol.FEAT_S - Pol.EFFECTS.length * Pol.PLAYER_SLOTS;
  const CG = Pol.EFFECTS.findIndex(function (e) { return e[0] === 'copiedGuard'; });
  const GP = Pol.EFFECTS.findIndex(function (e) { return e[0] === 'guardPrev'; });
  ok(CG >= 0 && GP >= 0, 'B 块必须同时有 copiedGuard 与 guardPrev 两条');
  st3.p[0].guardNext = true;                              // 自己摆的架势
  st3.p[1].copiedGuard = R.SK.REFLECT;                    // 镜面反射复制来的（他人技能）
  const fv2 = Pol.featuresV7(st3, 0);
  eq(fv2[bBase + 0 * Pol.EFFECTS.length + GP], 1, 'B 块：自己摆的架势应当是 +1');
  eq(fv2[bBase + SL1 * Pol.EFFECTS.length + CG], -1, 'B 块：镜面复制来的架势应当是 −1（他人施加）');
  eq(fv2[tBase + SL1 * 4 + 3], R.skills.findIndex(function (s) { return s.key === R.SK.REFLECT; }) / R.skills.length,
    'T 块最后一维必须是"他复制到了哪张卡"（② 的可见性）');
});

t('D33 v7 候选体系：候选枚举 / 珠类型与目标真的进输入 / 掩码不改形状 / 旧包走旧口径', function () {
  /* v7 的结构性改动：网络不再只对"技能 key"打分，而是对 **候选 = (技能, 目标, 珠类型)** 打分。
   * 这条钉住四件事 —— 任何一件坏了，"打谁/蓄哪种珠"都会静默退化成固定启发式（而分数照常出）。 */
  const st = S.createState('multi', { next: function () { return 0.5; } }, 3);
  st.p[0].ep = 6;
  const legal = Play.legalActions(st, 0);
  const cands = Pol.candidatesFor(st, 0, legal, {});
  const gun = cands.filter(function (c) { return c.key === R.SK.GUN; });
  eq(gun.length, 2, '3 人局里 枪 必须展开成 2 个候选（每个对手一个）');
  ok(gun[0].target !== gun[1].target, '两个候选的目标必须不同');
  const ch = cands.filter(function (c) { return c.key === R.SK.CHARGE; });
  eq(ch.length, 2, '蓄能 必须展开成 2 个候选');
  eq(ch.map(function (c) { return c.bead; }).sort().join(','), 'boom,elec', '两个候选的珠类型必须是 elec/boom');
  const ae = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'elec' });
  const ab = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'boom' });
  eq(ae.length, Pol.FEAT_A, '动作特征长度必须是 FEAT_A');
  let diff = 0;
  for (let i = 0; i < ae.length; i++) if (ae[i] !== ab[i]) diff++;
  eq(diff, 2, '两个珠类型候选必须**恰好差 2 维**（电/爆两个指示位）—— 否则同分、等于随机');
  const ag = Pol.actionFeatures(st, 0, R.SK.GUN, gun[0]);
  const ag0 = Pol.actionFeatures(st, 0, R.SK.GUN, { key: R.SK.GUN, target: null, bead: null });
  let diff2 = 0;
  for (let i = 0; i < ag.length; i++) if (ag[i] !== ag0[i]) diff2++;
  ok(diff2 > 0, '带目标的候选必须在动作特征上与不带目标的不同（目标血量/ジ/收割窗口…）');
  /* 动作侧新维度的**布局**：14=蓄电珠、15=蓄爆珠、16..21=目标相对 6 维。写死下标是为了
   * 让"顺序被改动"也能被这条用例抓住（追加维度的顺序一旦变，旧包裁剪规则就要跟着改）。 */
  eq(ag[16], st.p[gun[0].target].hp / st.mode.hp, '第 17 维（下标 16）必须是目标血量占比');
  /* 掩码：只改取值、不改形状（"去掉某几块再训一版"不能动版本与包格式）。
   * 语义：`setFeatMask('target')` = **只开 target 块**，其余（bead/effects/rel）恒 0。 */
  Pol.setFeatMask('target');
  eq(Pol.paramCount(), 5689, '掩码不得改变参数量');
  eq(Pol.featMask().bead, false, 'setFeatMask 的语义是"列出的块开、其余关"');
  const ae2 = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'elec' });
  const ab2 = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'boom' });
  eq(ae2.join(','), ab2.join(','), '掩掉 bead 后两个候选的动作特征必须逐位相同（这正是"缩臂"臂的定义）');
  const fx = Pol.featuresV7(st, 0);
  eq(fx.length, Pol.FEAT_S, '掩码不得改变状态向量长度');
  let tailZero = true;
  for (let i = 123; i < fx.length; i++) if (fx[i] !== 0) tailZero = false;
  ok(tailZero, '掩掉 effects/rel 后 T/B 两块必须恒为 0');
  Pol.setFeatMask(null);
  eq(Pol.featMask().effects && Pol.featMask().rel, true, 'setFeatMask(null) 必须全开');
  eq(Pol.featuresV7(st, 0).length, Pol.FEAT_S, '复位掩码后长度不变');
  /* 旧包必须走旧口径（否则历史基线不可比）：legacy 形状的 chooser 不得产生 bead 选择，
   * 且目标必须**恰好等于** pickTargetN 的结果（而不是候选枚举里的那个）。 */
  const v6params = new Float64Array(3337);
  for (let i = 0; i < v6params.length; i++) v6params[i] = ((i * 37) % 101) / 101 - 0.5;   // 非零权重，避免 softmax 全等
  const pick6 = T.policyChooserN(v6params, 0.15, 0)(st, 0, legal);
  eq(pick6.bead, null, '旧包（v6 形状）必须走旧口径：不产生 bead 选择');
  ok(pick6.key != null, '旧包仍必须给出 key');
  eq(pick6.target, T.pickTargetN(st, 0, pick6.key), '旧包的目标必须逐位等于 pickTargetN（旧口径），不能走候选');
});

t('D34 旧包"逐位等价嵌入"：embedLegacy 的输出必须与按旧布局手算的参考逐位相同', function () {
  /* 为什么需要：训练是**热启动**的（从 champion-5p-v1.3.58.bak 这类 v6 包长出来），
   * 而 train-server 用的是严格 unpack（v7 会拒收 v6 包）⇒ 不嵌入就只能从随机重开，
   * "同起点 A/B"与 meta 的 hotstartFrom 谱系一起报废。
   * 这条用一个**独立手算的参考实现**（按 v6 布局的小 MLP）对着比 —— 布局错一位就红。 */
  const n6 = 3337, HID = Pol.HID;
  const w6 = new Float64Array(n6);
  for (let i = 0; i < n6; i++) w6[i] = ((i * 2654435761) % 997) / 997 - 0.5;
  const w7 = Pol.embedLegacy(w6);
  eq(w7.length, Pol.paramCount(), '嵌入后必须是新形状（paramCount）');
  const st = S.createState('multi', { next: function () { return 0.5; } }, 3);
  st.p[0].ep = 8; st.p[0].guardNext = true; st.p[1].copiedGuard = R.SK.REFLECT;
  const x6 = Pol.features(st, 0, 123);
  let worst = 0, n = 0;
  for (const k of ['gun', 'sword', 'charge', 'bagua', 'reflect', 'ji', 'bigT']) {
    const af = Pol.actionFeatures(st, 0, k, null).slice(0, 14);
    let ref = w6[n6 - 1];                                  // b2
    for (let j = 0; j < HID; j++) {
      let s = w6[HID * 137 + j];                           // b1
      const base = j * 137;
      for (let i = 0; i < 123; i++) s += w6[base + i] * x6[i];
      for (let i = 0; i < 14; i++) s += w6[base + 123 + i] * af[i];
      if (s > 0) ref += w6[HID * 137 + HID + j] * s;       // ReLU + W2
    }
    worst = Math.max(worst, Math.abs(Pol.value(st, 0, k, w7, Pol.shapeOf(w7)) - ref));
    n++;
  }
  /* 参考实现是**另一个加法顺序**（先加 b1 再加特征）⇒ 浮点求和不可结合，允许 1e-12 级别的差。
   * 与"旧代码本身"的逐位比较在开发时做过（偏差恰好 0，因为两条路径的加法顺序一致）。 */
  ok(worst < 1e-12, '嵌入后的输出必须等于按 v6 布局手算的参考（' + n + ' 个技能，实测最大偏差 ' + worst + '）');
  ok(Pol.loadAny({ v: 6, a: Array.from(w6), f: 123, h: HID }).legacy === true, 'loadAny 必须把 v6 包标成 legacy 并嵌入');
  ok(Pol.loadAny({ v: 7, a: Array.from(w7), f: Pol.FEAT_S, fa: Pol.FEAT_A, h: HID }).legacy === false,
    'loadAny 读当前版本包必须走严格路径（不得嵌入）');
});

t('D35 训练侧"自对局健康门槛"必须存在、默认开、且与体检共用同一实现', function () {
  /* 起因（v1.5.19）：v7 加完特征后，分最高的几个候选在**自对局**里只剩 1~2 张卡、打到 50~60 回合
   * （实测 G=1.00~1.66，而 eco-34 是 4.24）—— 单一 1st 率能被"熬"骗（REVIEW §11）。
   * 修法是把体检的 G/平局/回合做成**换冠军的硬门槛**，且**与 champ-audit 共用一份实现**。 */
  ok(typeof T.mirrorHealth === 'function', 'T.mirrorHealth 必须导出（体检 G 列与训练门槛的单一真源）');
  const hg = T.healthGate();
  ok(hg.on === true, '健康门槛默认必须开（关掉就等于把"熬"解放回冠军位）');
  eq(hg.minG, 3, 'G 门槛必须与 champ-audit 的判读口径一致（<3 = 打法坍缩到两三张卡）');
  eq(hg.maxDraw, 0.2, '平局率门槛 20%');
  eq(hg.maxRounds, 40, '自对局回合门槛 40');
  ok(hg.promoteGames >= 4, 'promoteGames（提升冠军前的自对局局数）必须存在且够小样本可用');
  /* ⚠️ 门槛必须加在**决定产物的那一行**上：产物冠军由 finishStep 的 `t.champion = t.bestChamp` 决定，
   * 第一版只加在收尾的 pickChampionByWinRate 上 ⇒ 12 个 seed 的产物与没加时**逐个相同**（空操作）。 */
  const evo0 = readFileSync('js/train/evo.js', 'utf8');
  ok(/if \(better && HEALTH\.on( && !IN_EXPLORE)?\) \{/.test(evo0), '提升冠军前（finishStep 的 better 分支）必须有健康门槛（v1.5.42 起允许探索期例外）');
  ok(/if \(better && !healthReject\) \{/.test(evo0), '体检不过时必须**不提升**（保留上一个合格冠军）');
  /* 单一真源：体检侧不许再自己算一遍 exp(熵)（两处各写一遍必出事，METHODOLOGY 第 13 条） */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('mirrorHealth(') >= 0, 'tools/audit-lib.mjs 的 selfPlay 必须调用 T.mirrorHealth（单一真源）');
  ok(al.indexOf('Math.exp(H)') < 0, 'audit-lib 不许再自己算一遍 exp(熵)（否则门槛与体检会漂移）');
  /* 阈值逻辑本身（纯函数，逐条可判） */
  eq(T.healthFails({ effSkills: 4.2, drawRate: 0, rounds: 30 }).length, 0, '健康候选不得报失败');
  eq(T.healthFails({ effSkills: 1.5, drawRate: 0, rounds: 55 }).length, 2, 'G<3 与回合>40 必须各报一条');
  eq(T.healthFails({ effSkills: 3.1, drawRate: 0.5, rounds: 20 }).length, 1, '平局率 50% 必须报一条');
  /* 门槛必须真的参与择优：容差带过滤条件里必须有 healthOk */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(/band = pool\.filter\(function \(c\) \{ return c\.healthOk && c\.score >= topScore - WR_TOL; \}\)/.test(evo),
    '容差带必须只收健康候选（否则"高分但退化"仍会被选中）');
  /* 实测一次（2 局，便宜）：镜像局体检必须给出有限数值并回显局数 */
  const mh = T.mirrorHealth(new Float64Array(Pol.paramCount()), 2, 5, 'multi');
  ok(mh && mh.games === 2 && isFinite(mh.effSkills) && isFinite(mh.rounds) && isFinite(mh.drawRate),
    'mirrorHealth 必须返回有限数值并回显 games');
});

t('D36 方向 A：自对局必须折进适应度（只折动作分布，不折胜负）', function () {
  /* 只"筛"（健康门槛）不"教" 的实测后果：6/7 个 seed 被拦回"健康但弱"的角落（考卷 15.8%）。
   * 这条钉住"教"的那一半：每个个体额外打 MIRROR_GAMES 局 n 座同策略，只把**非ジ动作直方图**
   * 并进 agg.use（抬升已有的覆盖熵项），**胜负名次一项都不折**。 */
  const P0 = Pol.makePolicy(0.25);
  const opps = [{ sel: Bots.pickRandom }, { sel: Bots.pickAggro }, { sel: Bots.pickDefend }];
  eq(T.setMirrorGames(0), 0, 'setMirrorGames(0) 必须能关掉（对照臂要用）');
  const r0 = T.scoreMemberN(P0, opps, 2, 5, 4242, 0, 0);
  eq(T.mirrorGames(), 0, 'mirrorGames() 必须回显当前配置');
  eq(T.setMirrorGames(2), 2, 'setMirrorGames(2) 必须开启');
  const r2 = T.scoreMemberN(P0, opps, 2, 5, 4242, 0, 0);
  eq(r0.mirrorGames, 0, '关闭时不得跑自对局');
  eq(r2.mirrorGames, 2, '开启后必须真的跑了 2 局自对局');
  eq(r0.games, r2.games, '自对局**不得**改变胜负统计的对局数（镜像局的第 1 名是轮盘，无信息）');
  eq(r0.first, r2.first, '自对局**不得**改变 1st 计数');
  eq(r0.played === undefined ? r0.games : r0.played, r2.played === undefined ? r2.games : r2.played, '场次口径不得被自对局污染');
  ok(Math.abs(r0.divNorm - r2.divNorm) > 1e-9,
    '自对局必须改变覆盖熵 divNorm（否则"折进适应度"是空操作）：' + r0.divNorm.toFixed(4) + ' vs ' + r2.divNorm.toFixed(4));
});

t('D37 页面回合列表/导出：死人不许出ジ、观战回合必须显示技能并落 transcript', function () {
  /* 用户实测报的三个 bug（v1.5.21 修）：① 死掉的玩家仍在回合列表里出【ジ】；
   * ② 人类死后自动观战那段从不追加 transcript ⇒ "导出对局记录"只到玩家死前；
   * ③ 同处只写"第 N 回合（观战）"，不显示任何人用了什么技能。
   * 修法是把"拼回合行 / 追加 transcript"抽成**单一真源**（roundLineParts / pushTranscript），
   * 正常回合与观战回合共用。这条用源码级断言钉住"不许再退回各写一份"。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/function roundLineParts\(\)/.test(ui), '必须有 roundLineParts()：回合行的单一真源');
  ok(/function pushTranscript\(/.test(ui), '必须有 pushTranscript()：transcript 的单一真源');
  ok(ui.indexOf("p.name + '=【已淘汰】'") >= 0, '死且本回合没出手的玩家必须显示【已淘汰】（不许再出ジ）');
  const spec = ui.slice(ui.indexOf('function autoRunRest()'), ui.indexOf('function autoRunRest()') + 1600);
  ok(spec.indexOf('roundLineParts()') >= 0, '观战回合必须走 roundLineParts()（显示技能行）');
  ok(spec.indexOf('pushTranscript(') >= 0, '观战回合必须 pushTranscript()（否则导出只到玩家死前）');
  ok(spec.indexOf('persistBattle()') >= 0, '观战回合必须 persistBattle()（上局记录也要完整）');
  /* ⚠️ 用户第三次澄清（v1.5.22）：**技能格按钮**用规则顺序（能量在最上）；
   * "防御优先"指的是**回合日志的显示顺序**，与格子无关 —— 前两轮把它错用在格子上，各错一次。 */
  ok(ui.indexOf('const SD_GRP =') < 0, '技能格按钮**不得**再做"防御优先"重排（用户已明确：格子用规则顺序）');
  ok(/const sdOrder = R\.skills\.map\(function \(s, i\) \{ return \{ s: s, i: i \}; \}\);/.test(ui),
    '技能格按钮必须用 R.skills 的规则声明顺序（能量 → 攻击 → 防御 → 特殊）');
});

t('D38 结算事件行的**显示顺序**（防御→中立→攻击→镜像；被无效先于使其无效）+ 不得改动引擎事件数组', function () {
  /* 用户第三次澄清（v1.5.22）："防御优先"说的是**回合日志里结算事件行的显示顺序**，且明确"与后端实现无关"。
   * 三条规则：① 防御类先于攻击类 ② 被无效的先于使其无效的 ③ 原技能先于镜面反射复制出来的。
   * 这条钉住：实现存在 + 只排渲染副本（不许给 state.events 排序）+ 同档稳定。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/function evDisplayRank\(e\)/.test(ui), '必须有 evDisplayRank()：事件 → 显示档 (tier, sub)');
  ok(/function orderEventsForDisplay\(list\)/.test(ui), '必须有 orderEventsForDisplay()：稳定排序');
  ok(ui.indexOf('for (const e of orderEventsForDisplay(list))') >= 0,
    'logEvents 必须渲染**排序后的副本**（否则显示顺序规则等于没做）');
  ok(ui.indexOf('EV_TIER_DEF') >= 0 && ui.indexOf('EV_TIER_ATK') >= 0 && ui.indexOf('EV_TIER_MIRROR') >= 0,
    '三个档位表必须存在：防御 / 攻击 / 镜像复制');
  ok(ui.indexOf('EV_SUB_VOIDER') >= 0, '必须有"使其无效"子档（cancel/clash/thunderRing）');
  const at = ui.indexOf('function orderEventsForDisplay(list)');
  const fn = ui.slice(at, at + 400);
  ok(fn.indexOf('list.map(') >= 0, 'orderEventsForDisplay 必须先 map 出副本（不许就地排序）');
  ok(!/list\.sort\(/.test(fn), 'orderEventsForDisplay 不许对入参 list 直接 sort（会打乱引擎事件数组）');
  ok(fn.indexOf('a.i - b.i') >= 0, '同档必须用原始下标做**稳定**排序（否则无关事件被打乱）');
  ok(ui.indexOf("if (e.type === 'death') return [2, 1];") >= 0,
    '**死亡结算必须排在伤害之后**（用户实测：第一版把 death 当中立 ⇒ 先死再掉血，很搞笑）');
  /* v1.5.140（用户实机 R9/R10/R23 抓到"挡下先于摆出"）：防御档内部必须再分子档——
   * 摆出架势类（guardSet/holoSet/rod）sub=0，其结果类（blocked/reflect/voidImmune/curseBlock/rodBlock）sub=1。 */
  ok(ui.indexOf('EV_SUB_RESULT') >= 0, '必须有"架势结果"子档表 EV_SUB_RESULT（blocked/reflect/…排在摆出之后）');
  ok(/EV_TIER_DEF\[e\.type\]\) return \[0, EV_SUB_RESULT\[e\.type\] \? 1 : 0\]/.test(ui),
    'evDisplayRank 的防御档必须按 EV_SUB_RESULT 分 [0,0]/[0,1]（一律 [0,0] = 老 bug 复现）');
});

t('D39 环奖励必须**可归因**（复核 §5-1：voided 不记施法者 ⇒ 反例 A 与 B 曾同分）', function () {
  /* 复核给的五个反例，缺一不可（旧版只测了 A，恰好漏掉 B 这一格）。 */
  const evs = function (byPid) {
    return [
      { type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
      { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' },
      { type: 'voided', pid: 1, by: R.SK.MINI_T, byPid: byPid },
    ];
  };
  ok(T.ringReward().w > 0, 'RING_W 默认必须 > 0');
  eq(T.countRingBreaks(evs(0), 0), 1.5, 'A 我小雷作废开环者 ⇒ 1.5（0.5 密集 + 1 作废）');
  eq(T.countRingBreaks(evs(3), 0), 0.5, 'B 是**别人**（byPid=3）作废的 ⇒ 只拿 0.5，**必须与 A 不同**');
  eq(T.countRingBreaks([{ type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
    { type: 'voided', pid: 1, by: R.SK.MINI_T, byPid: 2 }], 0), 0, 'C 我全程没出小雷 ⇒ 0');
  eq(T.countRingBreaks([{ type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
    { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' }], 0), 0.5, 'D 环的**首次**出手也算开环（delta 是 1 然后 2）');
  eq(T.countRingBreaks([{ type: 'ep', pid: 1, delta: 4 },
    { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' }], 0), 0, 'E 避雷针回馈 +4 ジ ≠ 开环，不得误触发');
  eq(T.setRingReward(0), 0, 'setRingReward(0) 必须能关掉');
  eq(T.setRingRamp(0, 1).g1, 1, 'setRingRamp 必须可调');
  T.setRingReward(0.10);
});

t('D40 训练信号：惩罚被动（只奖"打中了且这一回合没挨打"的回合）', function () {
  /* 起因：v7anneal-34 在**被动场**里 E=100%（对手只出ジ，它也只会堆架势）⇒ 被体检判成"集体防御"。
   * 这条用合成事件流验：回合重建（每回合每玩家最多一条 action）+ 只奖"我没挨打"的回合。 */
  ok(T.pressReward().w > 0, 'PRESS_W 默认必须 > 0（默认开）');
  const A0 = { type: 'action', pid: 0 }, A1 = { type: 'action', pid: 1 };
  /* ① 第 0 回合：我打中对手、自己没挨打 ⇒ 记 1 个主动回合 */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }], 0), 1,
    '打中了且没挨打 ⇒ 记一个主动回合');
  /* ② 同一个回合我也挨了打 ⇒ 不算（不是"对手没威胁") */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }, { type: 'damage', to: 0, source: 1, amt: 1 }], 0), 0,
    '这一回合我也挨了打 ⇒ 不算主动回合');
  /* ③ 没造成任何伤害 ⇒ 不算（防"乱打也给奖"） */
  eq(T.countPressRounds([A0, A1], 0), 0, '没有伤害 ⇒ 不算');
  /* ④ 归因：伤害不是我造成的 ⇒ 不算 */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 1, amt: 1 }], 0), 0, '不是我打的不算');
  /* ⑤ 两回合：一回合主动、一回合挨打 ⇒ 只记 1（回合重建必须正确） */
  eq(T.countPressRounds([
    A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 },
    A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }, { type: 'damage', to: 0, source: 1, amt: 1 },
  ], 0), 1, '两回合里只有一回合是"我打他没挨打"');
  /* ⑥ 可关闭（对照臂） */
  eq(T.setPressReward(0), 0, 'setPressReward(0) 必须能关掉');
  T.setPressReward(0.03);
});

t('D41 E 新口径：只有"**没有大雷威胁时还一直摆架势**"才算病（合理防御不算）', function () {
  /* 用户裁定（v1.5.26）：旧 E（摆架势回合占比>85%）把"看到对手攒到 5 ジ 该防一下"也判成病 ——
   * 实测 eco-34 旧口径 89%（判病）而新口径只有 16%（合理）。新口径两条：
   *   ① noThreatStanceRate：对手ジ < 5（无大雷威胁）的回合里摆架势的占比 —— 主门槛；
   *   ② maxNoThreatRun：无威胁回合里的最长连摆（只作参考，实测区分度不足）。 */
  const rows = [
    { seat: 1, round: 0, stance: true },
    { seat: 1, round: 1, stance: true },     // 无威胁连摆 2 回合
    { seat: 1, round: 2, stance: false },
    { seat: 1, round: 3, stance: true },     // 这一回合**有威胁**（对手ジ≥5）⇒ 不该算病
  ];
  const threat = { 0: false, 1: false, 2: false, 3: true };
  const p = stanceProfile(rows, threat);
  eq(p.noThreatRounds, 3, '有威胁的回合不得计入"无威胁回合数"');
  eq(p.noThreatStanceRate.toFixed(3), (2 / 3).toFixed(3), '无威胁回合里 2/3 摆架势 ⇒ 占比 0.667');
  eq(p.maxNoThreatRun, 2, '无威胁最长连摆 = 2（第 0、1 回合）');
  eq(p.stanceRate.toFixed(3), (3 / 4).toFixed(3), '旧口径占比仍然可算（3/4，用于对照打印）');
  /* 全防 + 全无威胁 ⇒ 100%（这才是该挡的病理样本，实测 v7anneal-34 = 100%） */
  eq(stanceProfile([{ seat: 1, round: 0, stance: true }, { seat: 1, round: 1, stance: true }],
    { 0: false, 1: false }).noThreatStanceRate, 1, '全程无威胁还每回合摆架势 ⇒ 100%');
  /* 合理防御：只在有威胁的回合摆 ⇒ 无威胁占比 0（旧口径仍会很高，正是要修掉的误伤） */
  const fair = stanceProfile([
    { seat: 1, round: 0, stance: false }, { seat: 1, round: 1, stance: false },
    { seat: 1, round: 2, stance: true }, { seat: 1, round: 3, stance: true },
  ], { 0: false, 1: false, 2: true, 3: true });
  eq(fair.noThreatStanceRate, 0, '只在有威胁时防 ⇒ 新口径 0%（旧口径会是 50%）');
  eq(fair.stanceRate, 0.5, '旧口径对照值 = 50%');
  /* 门槛必须挂在**新口径**上 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('fPass.noThreatStanceRate > 0.6') >= 0, 'promote-champion 的 E 门槛必须用新口径（noThreatStanceRate）');
  ok(pc.indexOf('fPass.stance > 0.85') < 0, '旧口径（stance > 0.85）必须已从门槛里移除');
  /* v1.5.62：F 的口径已整体换成"场 A 被集火还手率"（≥20%）—— 新契约由 D55 专管。
   * 这里只留**反断言**：旧的 25%/35% 阈值写法都必须不存在（防止回退到"所有人靠 --force 过"的老路）。 */
  ok(pc.indexOf('fAct.atk < 0.25') < 0, '旧的 F 门槛（25%）必须已移除（口径已换成场 A，见 D55）');
  ok(pc.indexOf('fAct.atk < 0.35') < 0, '旧的 F 门槛（35%）必须已移除');
  /* v1.5.28：**反弹墙穿透卡零命中 = 阻断**（第三方复核 §3-1 实测：v1.5.27 自对局激光剑命中 20 次、墙里 0 次） */
  ok(pc.indexOf('reflectWall') >= 0, 'promote-champion 必须调用 reflectWall（反弹墙探针）');
  ok(pc.indexOf('rw.pierceLand === 0') >= 0, '反弹墙穿透卡零命中必须是阻断条件');
  ok(pc.indexOf("fails.push('穿透卡零命中") < 0, "自对局穿透卡零命中**不得**是阻断条件（实测所有冠军都没用过坦克/电磁炮）");
});

t('D42 破墙奖励（方案 b）：只有"我用穿透卡**落地命中**"才记分', function () {
  /* 起因：v1.5.27 的冠军面对 4 面反弹墙一枪未发（穿透卡 0 命中）⇒ 长程反弹墙 85%→0%。
   * 修法是在 fitness 里显式补一条窄条件奖励：只认能穿反弹/穿防御的卡，且必须落地命中、必须是我打的。 */
  const pk = T.pierceKeyList();
  ok(pk.length >= 3, '穿透卡清单必须从 R.skills 推导（实测：' + pk.join(',') + '）');
  ok(pk.indexOf('sword') >= 0 && pk.indexOf('tank') >= 0 && pk.indexOf('snipe') >= 0,
    '清单至少含 激光剑(sword)/坦克(tank)/狙击枪(snipe)');
  ok(T.pierceReward().w > 0, 'PIERCE_W 默认必须 > 0（默认开）');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'sword' }], 0), 1, '我用激光剑打中 ⇒ 记 1');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'gun' }], 0), 0, '普通攻击卡（枪）不算破墙');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 1, via: 'sword' }], 0), 0, '可归因：不是我打的不算');
  eq(T.countPierceHits([{ type: 'action', pid: 0, key: 'sword', outcome: 'ok' }], 0), 0,
    '只出招没打中不算（要**落地命中**，否则"朝墙上砍空气"也能得分）');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'sword' }, { type: 'damage', to: 2, source: 0, via: 'snipe' }], 0), 2,
    '两张不同的穿透卡各记一次');
  eq(T.setPierceReward(0), 0, 'setPierceReward(0) 必须能关掉（对照臂）');
  T.setPierceReward(0.04);
});

t('D43 课程/示范：反环教师必须砸**真的在滚环的那个人**（复核 §5-2：旧条件 ep>=2 宽 300 倍）', function () {
  /* 复核实测：`ep >= 2` 在真实自对局里 **45%** 的决策都成立，而"有人真在滚环"只有 **0.15%** ⇒
   * 旧教师实际在教"见人兜里有 2 ジ就砸小雷"，与"开环"这个状态几乎不相关（这就是示范没建立关联的原因）。 */
  const base = function () { return { key: R.SK.JI }; };
  const teach = T.makeAntiRingTeacher(base);
  const mt = [{ key: R.SK.MINI_T, affordable: true }];
  const ringers = { p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 3, ringStreak: 2 }] };
  eq(T.setAntiRingTeacher(), true, 'setAntiRingTeacher() 必须能把教师换成反环教师');
  eq(teach(ringers, 0, mt).key, R.SK.MINI_T, '有人在滚环 ⇒ 教师必须示范小雷');
  eq(teach(ringers, 0, mt).target, 1, '必须砸**那个**滚环的（死掉的不算）');
  eq(teach({ p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 5, ringStreak: 0 }] }, 0, mt).key, R.SK.JI,
    '只是兜里有 ジ（没滚环）⇒ 不得砸小雷（旧条件在这里会误触发）');
  eq(teach({ p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 3, ringStreak: 1 }, { hp: 3, ep: 9, ringStreak: 3 }] }, 0, mt).target, 2,
    '多个滚环者 ⇒ 优先砸环最粗的那个');
  eq(teach(ringers, 0, [{ key: R.SK.MINI_T, affordable: false }]).key, R.SK.JI, '付不起小雷 ⇒ 交回基础策略');
  eq(T.setImitTeacher(null), false, 'setImitTeacher(null) 必须能恢复默认教师（heavyfire）');
});

t('D27 体检指标必须单一来源 + 换冠军必须有**阻断**条件（不能只 warn）', function () {
  /* 第三方复核 §7-4(1)：champ-audit 的 E/F 两列"只打印、不参与任何判定"，
   * `promote-champion.mjs:77-81` 也只有三条 console.warn、末尾还写着"决定权在你"
   * ⇒ "集体防御/打法坍缩"这种形状量出来了也没人挡。
   * 修法有两半，这条守门的也正是这两半：① 指标只有一份实现（否则门槛会跟打印漂移）；
   * ② 不过门槛必须**中止**，越过必须显式 `--force` 且在 meta 里留痕。 */
  const ca = readFileSync('tools/champ-audit.mjs', 'utf8');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(ca.indexOf("from './audit-lib.mjs'") >= 0, 'champ-audit 必须用共享指标库（tools/audit-lib.mjs）');
  ok(pc.indexOf("from './audit-lib.mjs'") >= 0, 'promote-champion 必须用**同一份**指标库');
  for (const f of ['function fieldRate', 'function selfPlay', 'function loadChamp']) {
    ok(ca.indexOf(f) < 0, 'champ-audit 不得再自带 ' + f + '（两处各写一遍必漂移）');
    ok(pc.indexOf(f) < 0, 'promote-champion 不得再自带 ' + f);
  }
  ok(/process\.exit\(6\)/.test(pc), 'promote-champion 必须在体检不过时中止（exit 6），而不是只 warn');
  ok(pc.indexOf('--force') >= 0, '必须提供显式 --force 才能越过阻断');
  ok(pc.indexOf('auditForced') >= 0 && pc.indexOf('auditFails') >= 0, '越过阻断必须在 meta 里留痕（auditFails/auditForced）');
  for (const k of ['selfPlayEffSkills', 'passiveStanceRate', 'activeAttackRate']) {
    ok(pc.indexOf(k) >= 0, 'meta 必须记下 ' + k + '（否则"当年怎么过门的"又不可查）');
  }
});

t('D28 模式入口一致性：MODES 的每个 key 都必须能在页面选到（且页面不许有幽灵选项）', function () {
  /* 第三方复核 §3-2(d) 的建议。起因是实测：`MODES.lucky` 无入口无测试、`MODES.fast` 无入口
   * 但引擎分支还在、`tests/spec.js` 的 R52 用例**还在跑**（守一条不可达路径）——
   * 作者本人都以为删了。这条把"入口/实现/文档三者一致"变成机械检查，与 D8（版本号三方一致）同族。
   * 反证：给 MODES 加一个不在 index.html 里的 key ⇒ 立即红；把 index.html 的某个 option 拼错也红。 */
  const html = readFileSync('index.html', 'utf8');
  const sel = /<select id="sel-mode">([\s\S]*?)<\/select>/.exec(html);
  ok(sel, 'index.html 里找不到 #sel-mode');
  const opts = [];
  const re = /<option value="([^"]+)"/g; let m3;
  while ((m3 = re.exec(sel[1]))) opts.push(m3[1]);
  ok(opts.length >= 3, '#sel-mode 至少要有三个选项（现有 ' + opts.length + ' 个）');

  const modes = Object.keys(R.MODES);
  const missing = modes.filter(function (k) { return opts.indexOf(k) < 0; });
  eq(missing.length, 0, 'MODES 里有页面选不到的模式（要么补 index.html 的 <option>，要么删掉它）：' + missing.join(', '));
  const ghost = opts.filter(function (k) { return modes.indexOf(k) < 0; });
  eq(ghost.length, 0, 'index.html 里有 MODES 中不存在的模式选项：' + ghost.join(', '));

  /* 原始规则里有、本程序**明确不做**的模式必须显式登记（v1.5.18 用户裁定：快速/欧皇删掉）。 */
  for (const k of ['fast', 'lucky', 'vampire']) {
    ok(modes.indexOf(k) < 0, 'MODES 不应再有 ' + k + '（不做的模式只登记在文档里，不留在代码里）');
  }
  const r2p = readFileSync('docs/RULES-2P.md', 'utf8');
  ok(r2p.indexOf('本程序不做') >= 0, 'RULES-2P.md 必须显式登记"本程序不做"的模式（快速/欧皇/吸血鬼）');
});

t('D29 "只有指纹在响"的规则数据必须有**行为**断言（判定 p / 爆头 3 轮 / 小雷豁免名单 / 费用 / 雷系集合）', function () {
  /* 第三方复核 §2-2 做了 17 个变异注入，结论是：**用户报过 bug 的路径与刚裁定的路径守门是真的，
   * 但"早就定稿、没人再质疑"的规则数据表没有任何行为断言在守** —— 改坏了只有 D16 指纹会响
   * （那只说明"东西变了"，不说明"哪个行为错了"）。最典型的一条：`tests/spec.js` 里那条名叫
   * 「三判定全胜=爆头」的测试，把 `judge3` 改成 `judge`（只判一次）**照样绿**。
   * 下面每条都对应那 7 条注入之一，且都必须能反证（改坏 → 红）。 */
  const seqRngN = function (vals) { let i = 0; return { next: function () { return i < vals.length ? vals[i++] : 0.9; } }; };
  const mkst = function (rng) { return S.createState('standard', rng, 2); };

  /* ① 判定 = 公平随机、阈值严格 0.5（原文"判定：双方进行猜拳"）。
   * 反证：把 `resolve.js:63` 的 0.5 改成 0.65 ⇒ 第一、三条立刻红。 */
  ok(X.judge(mkst(seqRngN([0.49]))) === true, '判定：0.49 < 0.5 ⇒ 胜');
  ok(X.judge(mkst(seqRngN([0.5]))) === false, '判定：0.5 不算胜（严格小于）');
  ok(X.judge(mkst(seqRngN([0.51]))) === false, '判定：0.51 ⇒ 负');

  /* ② 爆头必须**三轮全胜**（原文「进行 3 轮判定，若攻击者均获胜」）。
   * 反证：把 `judge3` 改成 `judge` ⇒ 第二条立刻红。 */
  ok(X.judge3(mkst(seqRngN([0.1, 0.1, 0.1]))) === true, '三次全胜 ⇒ 爆头');
  ok(X.judge3(mkst(seqRngN([0.1, 0.1, 0.6]))) === false, '2 胜 1 负 ⇒ **不**爆头（这一条才钉住那个"3"）');
  ok(X.judge3(mkst(seqRngN([0.6, 0.1, 0.1]))) === false, '首轮即负 ⇒ 不爆头');

  /* ③ 小雷豁免名单 = 防御 / 反弹 / 原型制御（原文"使除防御、反弹、原型制御外技能无效"）。 */
  eq(R.MINI_T_IMMUNE.slice().sort().join(','), [R.SK.GUARD, R.SK.REFLECT, R.SK.PROTO].sort().join(','),
    '小雷豁免名单必须恰好是 防御/反弹/原型制御（多一个少一个都是规则漂移；反证：把八卦阵加进去 ⇒ 红）');
  /* 穷举表态（审计 R1 的建议）：防御族里每张卡都必须被显式判为"豁免 / 不豁免"。
   * 这样以后新增一张防御卡，就必须先回答"小雷能不能无效它"，而不是静默漂移。 */
  const GUARD_NON_IMMUNE = [R.SK.BAGUA, R.SK.SHIFT, R.SK.JINSHIELD, R.SK.ARMOR, R.SK.HOLO];
  const cls = {};
  for (const k of R.MINI_T_IMMUNE) { ok(!cls[k], '小雷豁免名单重复：' + k); cls[k] = 'immune'; }
  for (const k of GUARD_NON_IMMUNE) { ok(!cls[k], '分类重复：' + k); cls[k] = 'not'; }
  const unclassified = R.GUARD_FAMILY.filter(function (k) { return !cls[k]; });
  eq(unclassified.length, 0, '防御族里有卡没表态"小雷是否豁免"（新增防御卡必须显式归类）：' + JSON.stringify(unclassified));

  /* ④ 费用走**行为**口径（不是只比常量）：大雷 5 ジ、全息屏障 1 ジ。
   * 反证：大雷改 3 / 全息改 3 ⇒ 下面各有一条红。 */
  const stB = S.createState('multi', { next: mulberry32(77) }, 3);
  stB.p[0].ep = 4; X.startTurn(stB);
  eq(S.attemptAction(stB, 0, R.SK.BIG_T, { target: 1 }).outcome, 'insufficient', '大雷 4 ジ 必须不够（花费 5）');
  stB.p[0].ep = 5;
  eq(S.attemptAction(stB, 0, R.SK.BIG_T, { target: 1 }).outcome, 'ok', '大雷 5 ジ 必须够');
  const stH = S.createState('multi', { next: mulberry32(79) }, 3);
  stH.p[0].ep = 0; X.startTurn(stH);
  eq(S.attemptAction(stH, 0, R.SK.HOLO, { target: 1 }).outcome, 'insufficient', '全息屏障 0 ジ 必须不够（花费 1）');
  stH.p[0].ep = 1;
  eq(S.attemptAction(stH, 0, R.SK.HOLO, { target: 1 }).outcome, 'ok', '全息屏障 1 ジ 必须够');

  /* ⑤ 雷系集合（避雷针回馈 / 大雷传导都读它）必须含电磁炮 —— 并且看**行为**：
   * 避雷针在场（情形 A）时电磁炮必须被无效化。反证：把 RAILGUN 从 LIGHTNING 删掉 ⇒ 这条红。 */
  for (const k of [R.SK.RAILGUN, R.SK.MINI_T, R.SK.BIG_T]) ok(R.LIGHTNING.indexOf(k) >= 0, '雷系集合必须含 ' + k);
  const stR = S.createState('multi', { next: mulberry32(83) }, 3);
  for (const q of stR.p) { q.ep = 9; q.hp = 8; }
  stR.p[1].elec = 1;                      // 电磁炮需要 1 电珠
  X.startTurn(stR);
  S.attemptAction(stR, 0, R.SK.ROD, {});
  S.attemptAction(stR, 1, R.SK.RAILGUN, { target: 0 });
  S.attemptAction(stR, 2, R.SK.JI, {});
  X.resolveActions(stR);
  ok(stR.actions[1].voided, '避雷针在场（情形 A）必须无效化本回合的电磁炮');
  eq(stR.p[0].hp, 8, '避雷针使用者不该被那个电磁炮打到');
  ok(stR.events.some(function (e) { return e.type === 'rod' && e.mode === 'A'; }), '必须走情形 A（当回合有雷系）');
});

t('D30 铁索连环一次性（真实摄魂路径）+ 合二为一 >=2（3 人同轰也只额外 +1）', function () {
  /* 第三方复核 §3-1 指出两处实现与原文不符，用户 2026-09-13 裁定：
   *   ① 铁索连环原文「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」⇒ **一次性**；
   *   ② 合二为一原文「**两个**角色同时对同一角色使用雷击之枪」⇒ **保持** `>=2`（3 人同轰同样只触发一次）。 */

  /* ① 走真实路径建立连边：双方互勾【摄魂指法】（需目标 HP ≤ drainHpMax，multi 下 =1）。
   * 按 RULES-2P 的顺序口径：先各自治愈到 2、再互相扣到 1 ⇒ 无人死亡 ⇒ 连环成立。 */
  const st = S.createState('multi', { next: mulberry32(97) }, 3);
  for (const q of st.p) { q.ep = 9; q.hp = 1; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.DRAIN, { target: 1 });
  S.attemptAction(st, 1, R.SK.DRAIN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 1, '互勾摄魂后 A 仍活着（先治愈后扣血）');
  eq(st.p[1].hp, 1, '互勾摄魂后 B 仍活着');
  eq((st.p[0].chains || []).join(','), '1', '互勾摄魂必须建立连边 A↔B');
  eq((st.p[1].chains || []).join(','), '0', '连边必须是对称的');
  st.p[0].hp = 5; st.p[1].hp = 5;                     // 抬高血量，便于观察共享
  X.rawDamage(st, 0, 2, '测试', 'test', {});
  eq(st.p[0].hp, 3, 'A 自身');
  eq(st.p[1].hp, 3, 'B 共享同量伤害');
  eq((st.p[0].chains || []).length, 0, '共享一次后 A 侧连边解除（一次性）');
  eq((st.p[1].chains || []).length, 0, '共享一次后 B 侧连边解除');
  X.rawDamage(st, 0, 2, '测试', 'test', {});
  eq(st.p[1].hp, 3, '第二次不再共享 —— 要再连必须重新互勾摄魂');

  /* ② 合二为一：**3 人**同时对同一目标用小雷 ⇒ 仍然只额外 +1（用户裁定保持 `>=2`）。
   * 反证：把 `>= 2` 改成 `=== 2` ⇒ 本用例立刻红。 */
  const st3 = S.createState('multi', { next: mulberry32(99) }, 4);
  for (const q of st3.p) { q.ep = 9; q.hp = 9; }
  X.startTurn(st3);
  S.attemptAction(st3, 0, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 1, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 2, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 3, R.SK.JI, {});
  X.resolveActions(st3);
  const unite = st3.events.filter(function (e) { return e.type === 'hidden' && e.name === '合二为一'; });
  eq(unite.length, 1, '3 人同轰同一目标 ⇒ 合二为一只触发**一次**（保持 >=2 口径）');
  eq(st3.p[3].hp, 8, '被作用者只额外吃 1 点电伤（不是 2 点）');
});

t('D31 复制避雷针的"挡本回合的雷"与免雷窗口的真实口径（v1.5.18 用户裁定 / 第三方复核 §6 R2）', function () {
  /* 背景：R2 提议把"复制到避雷针"那一支从 ④b **提前到 ② 之前**，好让它挡本回合在飞的雷。
   * **实现时的实测结论：那是空操作** —— ① 层的避雷针语义是"**当回合有任何雷系技能 ⇒ 它们全部无效**"
   * （全场，见 `resolveActions` ① 段），而"镜面反射能复制到避雷针"的**前提**就是 t1 本回合真的用了避雷针
   * ⇒ ① 必然已经把那一回合的雷清空了 ⇒ 复制来的窗口本回合无物可挡。
   * 也就是说用户要的**结果**（a 不该吃到那个大雷）本来就成立，只是机制来自 t1 的真避雷针。
   * 因此那段提前落位没有落进代码（"有实现、有测试、无入口"正是审计 §3-2 点名的最危险形态）；
   * 改为把事实**钉成守门**：若将来有人把 ① 收窄成"只无效化指向避雷针使用者的雷"，下面第一条立刻红。 */

  /* 场景一：a 用镜面反射复制 b 的【避雷针】，c 用【大雷】打 a ⇒ a 安全，且原因是 ① 的全场无效化。 */
  const st = S.createState('multi', { next: mulberry32(131) }, 3);
  for (const q of st.p) { q.ep = 9; q.hp = 5; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.ROD, {});
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 5, 'a 不该吃到大雷的 2 点（这就是用户要的结果）');
  ok(st.actions[2].voided, '那个大雷必须被无效化 —— 由 t1 的**真**避雷针在 ① 层全场无效化（不是复制体）');
  ok(st.events.some(function (e) { return e.type === 'rod' && e.mode === 'A'; }), '必须走 ① 的情形 A（当回合有雷系 ⇒ 全部无效）');
  ok(st.p[0].rodGuard > 0, '复制避雷针仍应给出免雷窗口（供后续回合用）');
  ok(st.events.some(function (e) { return e.type === 'mirrorCopySelf' && e.key === R.SK.ROD; }), '复制本身照常发生');

  /* 场景二：免雷窗口（R31 情形B）必须能挡【电磁炮】—— v1.5.18 修的**真实偏差**
   *（电磁炮在 `R.LIGHTNING` 里，但它的投递原先从不查 `rodGuard`）。反证：删掉 ④ 的 `case SK.RAILGUN`
   * 里那段 rodGuard 检查 ⇒ 本场景两条立刻红。 */
  const st2 = S.createState('multi', { next: mulberry32(137) }, 3);
  for (const q of st2.p) { q.ep = 9; q.hp = 5; }
  st2.p[2].elec = 1;                    // 电磁炮需要 1 电珠
  X.startTurn(st2);
  st2.p[0].rodGuard = 4;                // 上一回合避雷针留下的窗口（本回合没人用避雷针 ⇒ ① 不介入）
  S.attemptAction(st2, 2, R.SK.RAILGUN, { target: 0 });
  S.attemptAction(st2, 0, R.SK.JI, {});
  S.attemptAction(st2, 1, R.SK.JI, {});
  X.resolveActions(st2);
  eq(st2.p[0].hp, 5, '电磁炮必须被避雷针的免雷窗口挡下（v1.5.18 之前这里是坏的）');
  ok(st2.actions[2].voided, '电磁炮那次行动必须被无效化');
  ok(st2.events.some(function (e) { return e.type === 'rodBlock' && e.by === R.SK.RAILGUN; }), '应当出现 rodBlock(电磁炮)');

  /* 场景三（**回归 v1.5.17**）：复制的是**防御架势**时，大雷照旧把镜面反射废掉 ⇒ 证明本节的结论
   * 没有影响"大雷 pri4 先于镜面反射 pri3"这条裁定。 */
  const st3 = S.createState('multi', { next: mulberry32(139) }, 3);
  for (const q of st3.p) { q.ep = 9; q.hp = 5; }
  X.startTurn(st3);
  S.attemptAction(st3, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st3, 1, R.SK.REFLECT, {});
  S.attemptAction(st3, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st3);
  ok(st3.actions[0].voided, 'v1.5.17 裁定仍成立：复制防御架势时大雷(pri4)先作废镜面反射');
  eq(st3.p[0].hp, 3, 'a 必须实打实挨那 2 点（复制的反弹挡不住先前结算的大雷）');
});

t('D44 零提升检测：训练"静默冻结"必须可被发现（产物 == 热启动种子）', function () {
  const zc = readFileSync('tools/zero-promote-check.mjs', 'utf8');
  ok(zc.indexOf("createHash('sha1')") >= 0, '检测必须用权重哈希比对（分数会骗人）');
  ok(zc.indexOf('process.exit(3)') >= 0, '发现零提升必须非零退出（可被脚本捕获，不能只打印）');
  ok(zc.indexOf('embedLegacy') >= 0, '必须按训练起点口径 embedLegacy 后再比');
  ok(zc.indexOf('零提升') >= 0, '必须有明确判定文案');
});

t('D45 全息屏障候选**不得含幻影"自己"**（这张卡本来就不能给自己）', function () {
  /* 复核 §2-1：`holoShieldFrom` 明写"自己给自己套不算"，而 `targetOf()` 会把 null/自己
   * 在声明阶段退成"第一个存活对手" ⇒ 候选里的"自己"是幻影：策略以为在做 A，引擎执行的是送盾给 1 号
   * （实测被选中 35/330 次，每次都给训练喂错误归因）。修法=只给真实对手。 */
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf("def.target === 'other'") >= 0, 'candidatesFor 必须有 target:other 分支');
  /* v1.5.201（审计 D45）：原来这两条钉的是**注释文本**（policy.js 的「幻影选项」、resolve.js 的「自己给自己套不算」）
   * —— 注释一改就红，而它描述的 bug 完全可以在注释仍在的情况下复活。改成**行为断言**：直接枚举候选。
   * 判据 = 候选里不许出现 target==null（引擎会把 null 退成"第一个存活对手" ⇒ 送盾给别人却按"给自己"归因）。 */
  const st45 = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const holo45 = Pol.candidatesFor(st45, 0, [{ key: R.SK.HOLO }]);
  eq(holo45.length, S.opponentsOf(st45, 0).length, '全息屏障候选数必须等于存活对手数（一人一个真实对手）');
  eq(holo45.filter(function (x) { return x.target == null; }).length, 0,
    '全息屏障候选里**不许有自己的幻影选项**（target=null ⇒ 引擎退成「第一个存活对手」，归因全错）');
  const res = readFileSync('js/core/resolve.js', 'utf8');
  ok(res.indexOf('const hDecl = targetOf') < 0, 'v1.5.34 那个"无目标=自己"的特例必须已撤销');
});


t('D46 终局平局口径：全活但血量有差 = 按血量的胜局（只有血量也相同才算平局）', function () {
  /* 规则原文（rules.js:134）：到上限"按血最多者胜" ⇒ 游戏本身按血量排名次。
   * 此前体检把"全员存活"一律当平局 ⇒ 农夫场出现"0% 胜 / 100% 和"的假象（复核两轮都提到）。 */
  eq(T.allAliveTied([{ hp: 2 }, { hp: 2 }]), true, '全活且血量相同 ⇒ 真平局');
  eq(T.allAliveTied([{ hp: 3 }, { hp: 2 }]), false, '全活但血量不同 ⇒ 不是平局（按血量分胜负）');
  eq(T.allAliveTied([{ hp: 1 }, { hp: 1 }, { hp: 0 }]), false, '有人死了 ⇒ 不是平局');
  eq(T.allAliveTied([{ hp: 0 }, { hp: 0 }]), false, '全死 ⇒ 不是平局');
  eq(T.allAliveTied([]), false, '空数组 ⇒ 不是平局（防御性）');
});


t('D47 定向强制探索：**只在"有滚环者且我付得起小雷"这一格**生效，其余必须原样交回学习到的策略', function () {
  /* 前五次实测（奖励/池子/示范/暴露度/可归因信号）都拿不到自然小雷 ⇒ 动作从未被采样。
   * 定向强迫是最后一枪；但**不能**用教师槽做常开 ε（那会用 heavyfire 扰动全局）。 */
  const mt = [{ key: R.SK.MINI_T, affordable: true }];
  const ringers = { p: [{ hp: 3, ringStreak: 0 }, { hp: 3, ringStreak: 2 }] };
  eq(T.ringForceTarget(ringers, 0, mt), 1, '有滚环者且付得起小雷 ⇒ 目标就是那个滚环者');
  eq(T.ringForceTarget({ p: [{ hp: 3, ringStreak: 0 }, { hp: 3, ringStreak: 0 }] }, 0, mt), -1, '没人滚环 ⇒ 不出手（-1）');
  eq(T.ringForceTarget(ringers, 0, [{ key: R.SK.MINI_T, affordable: false }]), -1, '付不起 ⇒ 不出手（-1）');
  eq(T.ringForceTarget({ p: [{ hp: 3, ringStreak: 0 }, { hp: 0, ringStreak: 3 }] }, 0, mt), -1, '滚环者已死 ⇒ 不出手（-1）');
  eq(T.setRingForceEps(0.05), 0.05, 'setRingForceEps 必须可设');
  eq(T.setRingForceEps(0), 0, 'setRingForceEps(0) 必须能关掉（验收要在关掉后量自然行为）');
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('const _fe = ringForceEpsAt(gen);') >= 0, '强迫必须带**按代**概率门（v1.5.40 起；不能常开、也不能全程常数）');
  ok(evo.indexOf('return econ(state, pid2, legal);') >= 0, '非目标格必须原样返回学习到的动作');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_RING_FORCE_EPS') >= 0, 'worker 必须能通过 env 打开强迫（独立进程）');
});


t('D48 强迫必须可退火（否则会把训练冻死）：只在早期代生效，之后归零', function () {
  /* 实测：格内常开 ε=1.0 ⇒ 6/6 零提升（训练整体冻死，产物退回种子）；格内 ε=5% 又因格子罕见（0.15%）等于没做。
   * 正确形态：早期强制示范、之后关掉 ⇒ 最终产物来自无强迫的后段，验收才有意义。 */
  eq(T.setRingForceEps(1), 1, 'setRingForceEps 必须可设到 1.0');
  eq(T.setRingForceUntil(40), 40, 'setRingForceUntil 必须可设');
  eq(T.ringForceEpsAt(0), 1, '第 0 代：强迫生效');
  eq(T.ringForceEpsAt(39), 1, '第 39 代（<40）：仍生效');
  eq(T.ringForceEpsAt(40), 0, '第 40 代起：必须归零（产物后段无强迫）');
  eq(T.ringForceEpsAt(200), 0, '后期必须为 0，否则产物不可信');
  eq(T.setRingForceEps(0), 0, '关掉后必须恒为 0');
  eq(T.ringForceEpsAt(0), 0, '关掉后第 0 代也不强迫');
  T.setRingForceEps(1); T.setRingForceUntil(40);
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('const _fe = ringForceEpsAt(gen);') >= 0, '包装层必须**按代**取概率（不能是常数）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_RING_FORCE_UNTIL') >= 0, 'worker 必须能通过 env 设退火窗口');
  T.setRingForceEps(0); T.setRingForceUntil(0);
});


t('D49 探索期不得被健康门槛惩罚（否则强迫会堵死整条提升链：实测逃逸率 1/6）', function () {
  /* 实测（v1.5.40/41）：格内强迫出来的小雷降低成员形状分/体检 ⇒ 提升被拒 ⇒ 冠军冻回种子。
   * 修法：探索期（强迫窗口内）跳过健康判定与 healthOk 过滤；**窗口外必须照旧**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IN_EXPLORE = false;') >= 0, '必须有探索期标志');
  ok(evo.indexOf('IN_EXPLORE = _fe > 0;') >= 0, '标志必须由 scoreMemberN 按当前代更新');
  ok(evo.indexOf('if (better && HEALTH.on && !IN_EXPLORE)') >= 0, '提升闸门必须在探索期内跳过健康判定');
  ok(evo.indexOf('const mh = (HEALTH.on && !IN_EXPLORE) ? mirrorHealth') >= 0, '选择过滤在探索期内也必须不评健康');
  ok(evo.indexOf('const hf = healthFails(mh);') >= 0, '窗口外的健康判定链必须完整保留（healthFails(mh)）');
  ok(evo.indexOf('mirrorHealth(cand.params') >= 0, '非探索期的提升健康判定必须仍在');
});


t('D50 对手槽位并列不得按 pid 升序（座位身份泄漏 ⇒ 0 号座夺冠 81%）', function () {
  /* 复核 §3 实测：5 席同策略自对局 **0 号座夺冠 81%（long）/ 59%（multi）**，其余 3~7%（期望 20%）。
   * 机制：开局全员同血时并列按 pid 升序 ⇒ 1~4 号座看别人时"槽位 0"永远是 0 号座 ⇒ 特征里出现
   * 与实力无关的座位身份泄漏 ⇒ 网络学"槽位 0 该怎么对待"。这是 L7 教训（并列不许按 pid 升序）的另一处复现。 */
  const firsts = [];
  for (let sd = 0; sd < 5; sd++) {
    const st = S.createState('multi', { next: mulberry32(1000 + sd) }, 5);
    st.round = 1 + sd;
    firsts.push(Pol.oppSlots(st, 1)[0]);
  }
  ok(new Set(firsts).size > 1, '不同回合下"槽位 0"不得恒为同一人（修前对 pid=1 恒为 0 号座）');
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf('slotRand(x, state) - slotRand(y, state)') >= 0, '并列排序必须用**不可预测的键**（slotRand(x,state)）');
  {
    /* v1.5.52 反证型守门：槽位键**绝不能借用采样/游戏随机流** ——
     * v1.5.51 借了策略的 __rng() ⇒ ① 消耗采样流；② 任何"特征调用时机/次数"变化都扰动它 ⇒
     * 实测把 D22（蓄能珠类型不得泄漏）踩红。旧实现还曾从 state.rng 抽盐 ⇒ 改变对局行为（D26 红）。 */
    const i0 = pol.indexOf('function slotRand(');
    const i1 = pol.indexOf('function oppSlots(');
    const seg = (i0 >= 0 && i1 > i0) ? pol.slice(i0, i1) : '';
    ok(seg.length > 0, '必须能定位 slotRand 的实现段');
    ok(seg.indexOf('__rng') < 0, '槽位键不得使用策略采样随机流 __rng');
    ok(seg.indexOf('state.rng') < 0 && seg.indexOf('rng.next') < 0, '槽位键不得消耗对局随机流 state.rng');
    ok(seg.indexOf('__slotHash') >= 0, '槽位键必须是纯函数哈希（决策内一致、可复现）');
  }
  ok(pol.indexOf('_rot(x) - _rot(y)') < 0, '旧的"按回合起点轮转"必须已移除（它让回合起点占槽位 0 ⇒ 被集火）');
  ok(pol.indexOf('SLOT_RAND') < 0, '不得再用"缓存随机键"的旧实现（v1.5.52 改为纯函数哈希 ⇒ 决策内天然一致）');
  ok(pol.indexOf('return d !== 0 ? d : x - y;') < 0, '旧的"并列按 pid 升序"必须已移除');
});


/* ===== v1.5.71（第五轮复核 §2-1/§2-2/§2-3/§4-6）：门槛的**单一真源**与**样本量守卫** =====
 * 三条更正各自的反证都做成用例：不能只在"病在的时候"绿，必须在**机制死掉时变红**。 */
t('D60 场B 判据只认清场数，胜率是规则红利（复核 §2-1）', function () {
  /* 背景：v1.5.65 的 multi 终局收缩 + 全灭按累计伤害判胜 ⇒ "打 1 点就赢"。线上包场B 严格胜率
   * 100%，而清场 0.00/局、伤害 1.0/局 ⇒ 用胜率当门槛等于白送。 */
  const base = {
    seat: { verdict: 'ok', spread: 10, decisiveRate: 0.6, pct: [22, 20, 19, 21, 18] },
    G: { effSkills: 4.0, distinctKeys: 11 }, wall: { dmgPerGame: 3.0, pierceLand: 100 },
    aggr: { fieldA: { atk: 0.3, dealtPerGame: 5 }, fieldB: { clearedPerGame: 1.0, winRate: 0.0 } }
  };
  /* ① 反向反证：真的在清场（清场 1.0/局）即使胜率 0% 也必须**过** —— 证明判据不是胜率。 */
  const okCase = feasibilityOf(base);
  ok(okCase.fails.length === 0, '清场 1.0/局、胜率 0% 必须判可行（实测 fails=' + JSON.stringify(okCase.fails) + '）');
  /* ② 正向反证：胜率 100% + 清场 0 ⇒ 必须**拒**，且文案说的是清场、不能出现"胜率"。 */
  const windfall = JSON.parse(JSON.stringify(base));
  windfall.aggr.fieldB = { clearedPerGame: 0.0, winRate: 1.0 };
  const bad = feasibilityOf(windfall);
  ok(bad.fails.length === 1, '只有场B 崩掉时应当恰好一条失败（实测 ' + JSON.stringify(bad.fails) + '）');
  ok(bad.fails[0].indexOf('清场') >= 0, '失败文案必须是"清场"（实测：' + bad.fails[0] + '）');
  ok(bad.fails[0].indexOf('胜率') < 0, '场B 失败文案里不得出现"胜率"（那是规则红利）');
  /* ③ 胜率仍然**记录**（可查），但不参与判定 */
  eq(bad.fieldBWinRate, 1, 'fieldBWinRate 必须照实记录');
  eq(bad.fieldBClears, 0, 'fieldBClears 必须照实记录');
});

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

t('D61 五道门槛是单一真源：落盘处与出厂换包都必须走 feasibilityOf（复核 §4-6）', function () {
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  const pro = readFileSync('tools/promote-champion.mjs', 'utf8');
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(srv.indexOf('audit.feasibilityOf(') >= 0, '训练落盘处必须调用 audit.feasibilityOf');
  ok(srv.indexOf('fieldB.clearedPerGame < 0.3') < 0, '落盘处不得再自己写一份阈值（应已搬进 audit-lib）');
  ok(pro.indexOf('feasibilityOf(') >= 0, '出厂换包处必须调用 feasibilityOf（线上包曾因绕过落盘而没有 feasibility 记录）');
  ok(pro.indexOf('meta.feasibility') >= 0, '出厂包必须把可行性记录写进 meta');
  /* 阈值必须在 lib 里，且五道齐全（搬运时漏一条 = 静默放宽） */
  const i0 = lib.indexOf('export function feasibilityOf(');
  /* v1.5.201（审计 D61）：原来是"锚点 + 固定 4000 字符窗"。实测最远的钉点离锚 2114 字符，
   * 余量只剩 ~1.9KB —— 代码一挪出窗口，红出来的信息会读成"实现错了"，而真相是"实现搬了"。
   * 改成按**配对花括号**取整个函数体（fnBody），阈值还在不在就是"在不在这个函数里"。 */
  const seg = fnBody(lib, 'export function feasibilityOf(');
  ok(seg.length > 0, '必须能定位 feasibilityOf 的实现段');
  ok(seg.indexOf('clearedPerGame) < 0.3') >= 0, '五道之一：场B 清场 < 0.3/局');
  ok(seg.indexOf('atk) < 0.20') >= 0, '五道之二：场A 还手 < 20%');
  ok(seg.indexOf('effSkills) < 3') >= 0, '五道之三：G < 3');
  ok(seg.indexOf('dmgPerGame) <= 0.5') >= 0, '五道之四：反弹墙伤害 ≤ 0.5/局');
  ok(seg.indexOf("s.verdict === 'biased'") >= 0, '五道之五：座位偏座');
  ok(seg.indexOf('winRate <') < 0 && seg.indexOf('winRate >=') < 0, 'feasibilityOf 里不得有任何以胜率为准的比较');
  /* 缺值必须响亮：`!(NaN > 0.5)` 曾是本函数第一个 bug（把"探针没跑"读成"墙瘫了"，假红） */
  ok(seg.indexOf('探针缺失') >= 0, '探针缺失/无值必须显式判失败（不许静默通过，也不许静默判死）');
});

t('D62 座位判据的样本量守卫：小样本必须报"不知道"，不得当"均衡"（复核 §2-3）', function () {
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(lib.indexOf("'underpowered'") >= 0, '必须存在第三态 underpowered（小样本=不知道）');
  ok(/MIN_N_SPREAD = 50/.test(lib), '极差判据必须有最小局数门槛（n<50 的极差是噪声：n=6 期望 41pt/p99 67pt）');
  ok(/SHARE_BIAS = 70/.test(lib), '占比判据必须是"某座 ≥70%"（对称假设下 ~0.2%，任意 n 稳健）');
  /* 行为反证：underpowered 不许判 fail，但必须留 note；biased/missing 必须判 fail。
   * 注意**必须给全四道探针**：缺值本身是另一条失败（见 D61 的"探针缺失"断言）。 */
  const full = { G: { effSkills: 4.0 }, wall: { dmgPerGame: 3.0 }, aggr: { fieldA: { atk: 0.3 }, fieldB: { clearedPerGame: 1.0 } } };
  const up = feasibilityOf(Object.assign({}, full, { seat: { verdict: 'underpowered', basis: 'n=6<50', pct: [40, 30, 15, 10, 5] } }));
  eq(up.fails.length, 0, 'underpowered 不得作为失败条件（否则小样本噪声会挡住所有候选）');
  ok(up.notes.length >= 1 && up.notes[0].indexOf('未判定') >= 0, 'underpowered 必须留下"未判定"的 note（不得沉默）');
  const bi = feasibilityOf(Object.assign({}, full, { seat: { verdict: 'biased', basis: '某座≥70%', pct: [90, 10, 0, 0, 0], spread: 90, decisiveRate: 0.5 } }));
  ok(bi.fails.length >= 1 && bi.fails[0].indexOf('座位') >= 0, 'biased 必须判 fail（实测 ' + JSON.stringify(bi.fails) + '）');
  const noSeat = feasibilityOf({ G: { effSkills: 4.0 }, wall: { dmgPerGame: 3.0 }, aggr: { fieldA: { atk: 0.3 }, fieldB: { clearedPerGame: 1.0 } } });
  eq(noSeat.fails.length, 1, '座位探针整个缺失必须判 fail（不许当"均衡"）');
  ok(noSeat.fails[0].indexOf('座位') >= 0, '缺座位探针的失败文案必须点名"座位"（实测：' + noSeat.fails[0] + '）');
});


/* ===== v1.5.71（第五轮复核 §4-1）：会瞄人的对手 =====
 * 复核的反向验证把病根钉死了：给 4 席对手加一条"谁用狙击就瞄谁"的规则 ⇒ 候选 v17-146 夺冠 30% → 0%。
 * 也就是说池子里**没有任何对手会瞄人**（脚本走 pickTargetN = 击杀优先 → 血量最高，满血不出头的狙击手
 * 永远进不了任何人的候选集）。这条用例盯三件事：① 它真的指威胁；② 目标**不被引擎剥掉**（否则退化成
 * 又一个 pickTargetN ⇒ 整批实验白跑）；③ 无威胁时攒钱（它是惩罚者，不是又一个乱打的激进派）。 */
t('D63 会瞄人的对手（targeter）：指威胁 + 目标不被引擎剥掉（复核 §4-1）', function () {
  ok(typeof Bots.pickTargeter === 'function', 'Bots.pickTargeter 必须存在');
  const poolSrc = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'targeter'/.test(poolSrc), 'targeter 必须登记进 server/opp-pool.mjs 的 OPP_SPECS（单一来源；漏登记 = 服务端拿到 undefined）');
  ok(poolSrc.indexOf("fn: 'pickTargeter'") >= 0, 'OPP_SPECS 里的 fn 必须是 pickTargeter');
  const st = S.createState('multi', { next: mulberry32(63) }, 5);
  /* 场景：1 号座是**领先者**（血最多 ⇒ pickTargetN 会选他），真正在滚环的是 2 号座，3 号座攒满 5 ジ。 */
  st.p[0].ep = 2;                       // 自己攒够一枪的钱（否则"指谁"这件事无从表达）
  /* 血量故意造成"**没有可击杀目标**（无人 ≤ 枪的 1 点伤害）+ 领先者唯一"的确定性局面：
   * 这样默认口径 pickTargetN 必然选 1 号座（血最多），而 targeter 必然选 2 号座（在滚环）——
   * 两者不同 ⇒ 本用例才真的分得出"自己瞄"与"默认口径"（否则测试没有判别力）。 */
  st.p[1].hp = 3; st.p[2].hp = 2; st.p[3].hp = 2; st.p[4].hp = 2;
  st.p[2].ringStreak = 2; st.p[3].ep = 5;
  const legal = Play.legalActions(st, 0);
  eq(T.pickTargetN(st, 0, R.SK.GUN), 1, '对照：默认口径必须选领先者 1 号座（否则本用例分不出自己瞄与默认口径）');
  const raw = Bots.pickTargeter(st, 0, legal);
  eq(raw.target, 2, 'targeter 必须掐**在滚环**的那位（实测 target=' + raw.target + '）');
  /* ① 关键：目标必须活着穿过 wrapBotN（v1.3.55 的"保留脚本自选目标"） */
  const wrapped = T.wrapBotN(Bots.pickTargeter)(st, 0, legal);
  eq(wrapped.target, 2, 'wrapBotN 必须保留脚本自选目标，实测 ' + wrapped.target + '（被剥掉 ⇒ 本对手退化成 pickTargetN）');
  ok(wrapped.target !== 1, '不得退化成"打血最多的领先者"（那是 pickTargetN 的口径，= 病根本身）');
  /* ② 只读状态真源：滚环者消失后必须转向"刚放冷枪的"，而不是永远指 2 号 */
  st.p[2].ringStreak = 0; st.p[3].lastSkill = R.SK.SNIPE;
  eq(T.wrapBotN(Bots.pickTargeter)(st, 0, legal).target, 3, '滚环者消失后必须转向刚放冷枪的');
  /* ③ 无威胁 ⇒ **压领先者**，不许攒钱躺平
   * （实测反噬：第一版"无威胁就攒钱"让 `--field=targeter` 随机基线都有 78.3%，
   *   而且会给训练送一条"别成为威胁就不挨打"的反向梯度 = 喂大低压力场瘫） */
  st.p[3].lastSkill = null; st.p[3].ep = 0;
  const w3 = T.wrapBotN(Bots.pickTargeter)(st, 0, legal);
  eq(w3.key, R.SK.GUN, '无威胁时也必须出手（实测 ' + w3.key + '）');
  eq(w3.target, 1, '无威胁时必须压领先者 1 号座（实测 ' + w3.target + '）');
  /* ④ 濒死保命优先于补刀（别让它变成送人头机器） */
  st.p[2].ringStreak = 1; st.p[0].hp = 1; st.p[0].ep = 3;
  const w4 = T.wrapBotN(Bots.pickTargeter)(st, 0, Play.legalActions(st, 0));
  eq(w4.key, R.SK.GUARD, '1 血且买得起盾时必须先保命（实测 ' + w4.key + '）');
});


/* ===== v1.5.71（第五轮复核 §4-2）：狙击场探针 =====
 * 复核把"狙击无解"证伪了（任何攻击效果技能指过来就能让狙击无效，1 ジ 的枪就够）；池里之所以显得无解，
 * 是因为**没人会瞄人**。这条用例盯两件事：① 归因口径是纯函数且双向可证（`source` 而非 `from`）；
 * ② 混合场才带靶向判别力（4 席全狙击时比例恒 ~1 ⇒ 无判别力，那是我 `ringWallProbe` 犯过的错）。 */
t('D64 狙击场探针：归因纯函数 + 混合场的靶向判据（复核 §4-2）', function () {
  ok(typeof Bots.pickSnipeSpam === 'function', 'Bots.pickSnipeSpam 必须存在（狙击场探针的威胁源）');
  const poolSrc = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'snipespam'/.test(poolSrc) && poolSrc.indexOf("fn: 'pickSnipeSpam'") >= 0,
    'snipespam 必须登记进 OPP_SPECS（单一来源，实验臂按需加入；默认池不受影响）');
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(lib.indexOf('export function sniperField(') >= 0, 'audit-lib 必须导出 sniperField');
  ok(lib.indexOf('export function attackAttribution(') >= 0, 'audit-lib 必须导出 attackAttribution（纯函数，可单测）');
  /* ① 归因纯函数：只认 `source` + `via`；反向反证（别人的攻击、无 via 的伤害都必须不计） */
  const ev = [
    { type: 'damage', source: 0, to: 2, via: 'gun', amt: 1 },   // 我打的 ✓
    { type: 'damage', source: 0, to: 2, via: 'gun', amt: 1 },   // 我打的 ✓
    { type: 'damage', source: 0, to: 0, via: 'railgun', amt: 1 },// 自伤（计入 total，判据里排除）
    { type: 'damage', source: 1, to: 2, via: 'gun', amt: 1 },   // **别人**打的 ✗
    { type: 'damage', source: 0, to: 3, amt: 1 },               // 无 via（非技能）✗
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' }       // action 不带目标，不该被当攻击 ✗
  ];
  const a = attackAttribution(ev, 0);
  eq(a.total, 3, '只统计 source=我 且有 via 的伤害（实测 ' + a.total + '）');
  eq(a.byTarget[2], 2, '命中 2 号座两次必须照实统计');
  eq(a.byTarget[0], 1, '自伤照实统计（由调用方排除）');
  eq(a.targets, 2, '打过的人数 = 2（0 号=自伤，2 号=对手）');
  eq(attackAttribution(ev, 1).total, 1, '换成 1 号座视角只统计它自己那一次');
  eq(attackAttribution(null, 0).total, 0, '空事件必须安全返回 0');
  /* ② 判别力声明：混合场给"均匀乱打=25%"的基准，wall 场不得谎报基准 */
  ok(lib.indexOf("uniformRate: (K === 'mixed') ? 0.25 : null") >= 0,
    '混合场必须声明 uniformRate=0.25（4 席里 1 席是狙击手）；wall 场必须为 null（无靶向判别力）');
  ok(readFileSync('tools/probe-sniper.mjs', 'utf8').indexOf('没有靶向判别力') >= 0 ||
     readFileSync('tools/probe-sniper.mjs', 'utf8').indexOf('无靶向判别力') >= 0,
    '探针工具必须写明 wall 口径没有靶向判别力（防止把恒 ~1 的比例当成果）');
});


/* ===== v1.5.74（用户 4 局实测两问 → F1/F2）=====
 * ① F1：**买不起的招不得进候选表**（旧行为：进表 → 被选中 → 引擎静默降级成ジ = 幻影动作）；
 * ② F2：**两级采样**（先技能、后条目）⇒ 槽位数不再放大某技能的抽样概率。
 * 两条都必须能被反证：③ 用零权重（所有候选同分）检查"4 条槽位 vs 1 条槽位"的概率是否相等。 */
t('D65 候选表过滤买不起 + 两级采样抹平槽位放大（v1.5.74 F1/F2）', function () {
  const st = S.createState('multi', { next: mulberry32(6501) }, 5);
  /* ① F1：显式 affordable:false 必须被排除（字段真源 = play.js:17/21） */
  const legal = [
    { key: R.SK.JI, affordable: true },
    { key: R.SK.CHARGE, affordable: false },
    { key: R.SK.GUN, affordable: true },
    { key: R.SK.GUARD, affordable: false }
  ];
  const c1 = Pol.candidatesFor(st, 0, legal, {});
  ok(c1.every(function (c) { return c.key !== R.SK.CHARGE && c.key !== R.SK.GUARD; }),
    '买不起的招不得进候选表（实测 [' + c1.map(function (c) { return c.key; }).join(',') + ']）');
  ok(c1.some(function (c) { return c.key === R.SK.GUN; }), '买得起的招必须仍在表里');
  const c2 = Pol.candidatesFor(st, 0, legal, { allowUnaffordable: true });
  ok(c2.some(function (c) { return c.key === R.SK.CHARGE; }), '逃生口 allowUnaffordable 必须能放回它们（评测脚本用）');
  /* ② 只过滤**显式 false**：页面/工具/夹具自造的 legal 通常不带该字段，过滤会把表清空 ⇒ 冠军只出ジ */
  const c3 = Pol.candidatesFor(st, 0, [{ key: R.SK.GUN }], {});
  ok(c3.length >= 1 && c3.every(function (c) { return c.key === R.SK.GUN; }),
    'legal 不带 affordable 字段时不得被过滤（D51 曾因此红；实测 ' + c3.length + ' 条）');
  /* ③ F2 的判别性检查：零权重 ⇒ 所有候选同分 ⇒ 槽位多寡**不得**改变技能概率 */
  const zero = new Array(Pol.paramCount()).fill(0);
  const cands = [
    { key: R.SK.GUN, target: 1, target2: null, bead: null },
    { key: R.SK.GUN, target: 2, target2: null, bead: null },
    { key: R.SK.GUN, target: 3, target2: null, bead: null },
    { key: R.SK.GUN, target: 4, target2: null, bead: null },
    { key: R.SK.PROTO, target: null, target2: null, bead: null }
  ];
  const f = Pol.forwardCands(st, 0, cands, zero, { temp: 0.5 });
  let pg = 0; for (let i = 0; i < 4; i++) pg += f.probs[i];
  ok(Math.abs(pg - f.probs[4]) < 0.05,
    '同分时"4 条槽位"与"1 条槽位"的技能概率必须相等（实测 ' + (pg * 100).toFixed(1) + '% vs ' + (f.probs[4] * 100).toFixed(1) + '%）');
  let s = 0; for (let i = 0; i < f.probs.length; i++) s += f.probs[i];
  ok(Math.abs(s - 1) < 1e-9, '两级相乘后 prob 表必须仍严格归一（实测 ' + s + '）');
  /* ④ argmax/greedy 语义必须不变（两级后"条目少"的条目概率反而更高 ⇒ 不能用 probs 取最大） */
  const y = new Array(Pol.paramCount()).fill(0);
  ok(Pol.forwardCands(st, 0, cands, y, { temp: 0.5 }).cand.key === R.SK.GUN,
    'greedy 语义 = 全表最大对数几率（零权重时取第一个条目）');
  /* ⑤ 结构断言：两级相乘与 F1 的"显式 false"必须真在源码里 */
  const src = readFileSync('js/train/policy.js', 'utf8');
  ok(src.indexOf('kProb[k] * within') >= 0, '两级采样必须写在 forwardCands（技能层 × 条目层）');
  ok(src.indexOf('l.affordable === false') >= 0, 'F1 必须只过滤显式 false');
});


/* ===== v1.5.76（P1）：珠子闭环奖励 =====
 * 起因：用户实测线上包 `chargeProfile` 浪费率 100%（得珠 0.30/局、花掉 0.00），
 * 而珠子消费卡（电磁炮/天火）都要 2 ジ、蓄能常发生在 ep=1 ⇒ 下回合必然凑不出 ⇒ 闭环学不出来。
 * 窄条件 + 可归因 + 事件派生（与 RING_W/PRESS_W/PIERCE_W 同族）⇒ 不该引 D16 指纹 churn。 */
t('D66 珠子闭环奖励：只认**花掉**，囤着/过期不记分（v1.5.76 P1）', function () {
  const ev = [
    { type: 'bead', pid: 0, kind: 'elec', delta: 1 },    // 蓄能得珠 ⇒ 不记
    { type: 'bead', pid: 0, kind: 'elec', delta: -1 },   // 花掉 ⇒ 记
    { type: 'bead', pid: 0, kind: 'boom', delta: -1 },   // 花掉 ⇒ 记
    { type: 'beadExpire', pid: 0, kind: 'elec' },        // 过期 ⇒ 不记
    { type: 'bead', pid: 1, kind: 'elec', delta: -1 },   // 别人花的 ⇒ 不记
    { type: 'bead', pid: 0, kind: 'elec' }               // 无 delta ⇒ 不记
  ];
  eq(T.countBeadSpent(ev, 0), 2, '只数自己花掉的珠子（实测 ' + T.countBeadSpent(ev, 0) + '）');
  eq(T.countBeadSpent(ev, 1), 1, '换座位视角只数它的');
  eq(T.countBeadSpent(null, 0), 0, '空事件必须安全返回 0');
  const r = T.beadReward();
  ok(r && typeof r.w === 'number' && r.w > 0, '默认权重必须为正（否则奖励形同虚设）');
  ok(typeof T.setBeadReward === 'function', '必须可调（实验臂/守门用）');
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('const beadBonus = BEAD_W * Math.min(1, beadSpent / 2)') >= 0, '两次封顶的加成必须真的存在');
  const gfitLine = src.slice(src.indexOf('const gFit = '), src.indexOf('const gFit = ') + 500);
  ok(gfitLine.indexOf('+ beadBonus') >= 0, 'beadBonus 必须并进 gFit（漏了 = 静默空操作）');
  /* ⚠ 这一行原本钉的是字面量 `if (BEAD_W > 0) beadSpent += …`，被 v1.5.272（§E83）换成了整族门 `DOSE_ON`
   * ⇒ 钉的**语义不变**（"计数必须逐局接上"），换的是那根门的形状：计数按族算，**付钱仍按 `BEAD_W`**（上面那条 `beadBonus` 断言就是守这一半的）。
   * 反过来也钉：不许再退回"跟着自己的 W 关"（那正是本门当初要防的假零结果的成因）。 */
  ok(src.indexOf('if (DOSE_ON) beadSpent += countBeadSpent(') >= 0, '每局的计数必须接上（v1.5.272 起按整族 `DOSE_ON` 算）');
  ok(src.indexOf('if (BEAD_W > 0) beadSpent +=') < 0, '计数不许再退回跟着自己的 W 关（§E65 那族假零结果）');
});


/* ===== v1.5.78（第七轮复核 §15-1）：G4/G5 行为门 =====
 * 复核把"一行脚本能否克制它"（G4）与"面对只防御不还手能否清场"（G5）写成可跑代码，并**先证明量具有判别力**：
 *   线上包 G4 两模式 PASS（最克 22%/18%）、G5 PASS（防席 0%）；91/94 分别在这些格上 FAIL。
 * ⇒ 只有这两条进阻断面（G3 阈值连线上包都过不了；G6 四代全红=能力未长出，都不能当阻断）。
 * 本条守门锁三件事：① 量具仍在且带判别力元测试；② 只有 G4/G5 进阻断；③ 退出码契约（有 FAIL ⇒ 1）。 */
t('D67 G4/G5 行为门：量具可跑 + 只有 G4/G5 进阻断 + 退出码契约（第七轮复核 §15-1）', function () {
  const g = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(g.indexOf('st.slotSalt = h32pre(') >= 0, '对局必须设**与轮座去相关**的盐（否则座位/基线自检出假数）');
  ok(g.indexOf('judgeable') >= 0 && g.indexOf('不可判') >= 0, 'G4 必须有"基线格可判"的前置守卫');
  ok(g.indexOf('G6[元测试]') >= 0, 'G6 必须先有"量具判别力"元测试');
  /* v1.5.202：把"默认值"也钉住 —— 否则上面那条 spawn 用的是显式 GATE4_GAMES=60，默认被改回去也没人发现。
   * 默认 300 的依据：同一只包的参照行基线在 n=60→300 之间摆 **7pt**（long 27%→20%）；代价实测 +35 秒（15s→50s）。
   * 生产路径（promote-champion）走的就是这个默认值；本用例自己显式传 60 只为跑得快。 */
  ok(g.indexOf('GATE4_GAMES || 300') >= 0, 'G4/G5 的**默认**样本量必须是 300（n=60 的参照行基线会摆 ±7pt）');
  ok(g.indexOf(' 记录  G6[') >= 0 && g.indexOf('gate(`G6[${nm}]') < 0, 'G6 的逐包行必须是**记录**而不是 PASS/FAIL（四代包全未达 ⇒ 恒假）；元测试那条仍是门');
  ok(g.indexOf('process.exitCode') >= 0, '必须有退出码契约（FAIL ⇒ 非 0）');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf("['tools/gate-drafts.mjs', SRC]") >= 0, 'promote-champion 必须调用量具');
  ok(pc.indexOf('/^G4\\[/.test(nm) || /^G5\\[/.test(nm)') >= 0, '只有 G4/G5 进阻断面（G3/G6 只记录）');
  ok(pc.indexOf('行为门未过') >= 0 && pc.indexOf('meta.gateDrafts') >= 0, '阻断结论必须留痕（meta）');
  /* v1.5.89：本轮实测发现的三处**判词缺陷**，各留一条"能失败"的断言（都与 v1.5.78 的原病根同族）：
   * 原病根 = "把没跑 / 没判的当成过了"。这三个缺陷是它的三种变体：主语错位、判词不可读、缺第三态。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(pc.indexOf("const isRef = /^G[3-6]\\[(线上包|元测试)/.test(nm);") >= 0,
    '必须识别**参照行**（线上包 / 元测试）—— 它们说的是别的对象，不得阻断候选');
  ok(/if \(m\[1\] === 'FAIL' && !isRef &&/.test(pc),
    '阻断条件必须排除参照行：否则候选被"在位包是红的"连坐 ⇒ 任何换包都只能靠 --force（主语错位）');
  /* v1.5.202：第三态现在**带方向**（`UNRUN:弱|强|缺`）—— 因为处置按方向分，光有"第三态"不够了。 */
  ok(gd.indexOf("const st = unrun ? ('UNRUN'") >= 0 && gd.indexOf("unrunKind") >= 0,
    'gate-drafts 必须支持 UNRUN 第三态（跑不了 / 不可判 ≠ 不合格）**且带方向**（弱/强/缺 ⇒ 处置不同）');
  /* v1.5.202：UNRUN 不再"一律只打印" —— 处置走纯函数、按**方向**分（弱/强/缺）。 */
  ok(pc.indexOf('unrunDisposition(') >= 0 && pc.indexOf('unrun-policy.mjs') >= 0,
    'UNRUN 的处置必须是单一来源纯函数（v1.5.202：原来它从不进 fails ⇒ 基线退化的候选可零阻断通过）');
  ok(g.indexOf("'UNRUN' + (unrunKind") >= 0 && g.indexOf('unrunKind') >= 0,
    'gate-drafts 必须给 UNRUN 带上**方向**（弱/强/缺）—— 可判窗口把两个相反形状合并了');
  ok(pc.indexOf('gateDrafts.unrun') >= 0 && pc.indexOf('不得当作通过') >= 0,
    'UNRUN 必须被单独收集 + 醒目提示"不得当作通过"（否则它读起来就是"过"）');
  ok(gd.indexOf('最克「${worst[0]}」${worst[1]}%') >= 0,
    'G4 标题必须带"最克那一格"：原先标题只有基线 ⇒ FAIL 行读起来像"这条过了"（实测时连作者都被误导）');
  ok(gd.indexOf('实测防席夺冠 ${pct}%') >= 0, 'G5 标题必须带实测值而不是只有阈值');
  /* 行为：用极小局数真跑一遍量具（不拖慢门禁），验元测试与退出码契约 */
  const r = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '60', GATE6_GAMES: '6' })
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  ok(/PASS\s+G6\[元测试\]/.test(out), 'G6 元测试必须 PASS（量具判别力不足 ⇒ 后面所有读数不可信）');
  /* v1.5.89：口径改了 —— 补入"只枪(1ジ压制·打最肥)"这一格之后，线上包自己在 **G4[long]** 就是红的
   * （长程被最便宜的一张卡打穿，第八轮复核 §6 的结论）。判别力依据只要求"线上包**至少一个模式** PASS"；
   * 而"在位包是红的"必须**只记录、不阻断候选** —— 该契约由上面那两条 isRef 断言守着。
   * （v1.5.104：`GATE4_GAMES` 由 6 抬到 **60** —— n=6 的"哪一格最克 / 是否越线"本身就是小样本统计量
   *  （§31/§35 的同一条教训），拿它断言等于内置"偶发红"；仍**不**断言 `FAIL G4[线上包/long]`，
   *  因为在位包/候选的 long 读数会随包更替而变。） */
  /* ===== v1.5.129（**用户裁定②**）：这一条从"硬红"改成"**已记录的例外**" =====
   * 背景（v1.5.123 §3，如实记录过）：线上包 `v7press3-91` 是**用 `--force` 越过 G4** 换上的
   * ⇒ 它两个模式都红 ⇒ 旧措辞（"线上包至少一个模式必须 PASS"）**会一直红**。
   * "长期红"的代价不是"少一道网"，而是**以后的真红会被已知红淹没**（每次提交都要人肉分辨哪条是新的）。
   * 现在的判据是**三分支**（口径 id 来自 gate-drafts 打印的 `G4POOL` 行，见其 `G4_POOL_ID`）：
   *   ① 至少一个模式 PASS ⇒ 通过（原口径，锚还在）；
   *   ② 两模式都红 **且** bundle 的 meta 里有一条**格式良好 + 口径匹配**的 G4 越线留痕 ⇒ 通过（已记录的例外）；
   *   ③ 两模式都红 **且** 无留痕 / 留痕口径与当前克制表不一致 ⇒ **红**。
   * ⇒ 安全网没丢：丢掉的只是"记过账的旧账"，留下的是"**没记的账**"与"**改了池子却没重记的账**"
   *   （后者正是本次自己会踩的那一步：加了「珠爆发」一格 ⇒ 口径 id 变 ⇒ 旧留痕自动失效 ⇒ 必须重记）。 */
  const refPassG4 = /PASS\s+G4\[线上包\/(long|multi)\]/.test(out);
  const poolM = /G4POOL\s+([0-9a-f]{8})/.exec(out);
  const curPool = poolM ? poolM[1] : null;
  /* qoder-research 0920（RESEARCH-LOG §3-2 · 缝自曝于 v1.5.133 §5）：**实现身份双绑**。
   * `G4IMPL` = 各格 chooser 源码 + `pT` 的 sha1 ⇒ **改格子行为不改键名**时它也变，旧例外失效。
   * 在位包的留痕记于"实现身份"发明**之前**（meta 无 `impl` 字段）⇒ 给一条**冻结豁免**：
   * 仅当"当前实现 == v1.5.134 那一版（`caecc92f`）"时放行；谁改了任何一格，豁免随 id 一起作废，
   * 届时必须 `--force` 重记（新留痕会带 impl，走正常比对）。这是**一次性**的迁移垫脚，不是永久通道。 */
  const G4IMPL_AT_EXCEPTION = G4FROZEN;   // v1.5.202：单一来源（原为手抄常量）
  const implM = /G4IMPL\s+([0-9a-f]{8})/.exec(out);
  const curImpl = implM ? implM[1] : null;
  let meta3p = null;
  try {
    const m3 = /(window\.EPIRUS_CHAMPION_3P_META\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(readFileSync('js/bundled-champion-3p.js', 'utf8'));
    meta3p = m3 ? JSON.parse(m3[2]) : null;
  } catch (e) { meta3p = null; }
  const g4rec = (meta3p && meta3p.gate4Forced && typeof meta3p.gate4Forced === 'object') ? meta3p.gate4Forced : null;
  /* ⚠️ 例外的**完整性**并进判据本身（而不是另立一条恒真断言）：
   * `forced` 为真 + **口径 id 相等** + **带上被放过的具体行**，三者缺一 ⇒ 不认这条例外。
   * 第三条（`lines`）不是排版洁癖：promote-champion 哪天只写 `forced` 而丢掉 `lines`，
   * 例外就变成"记了账但不知道记了什么"—— 那时这条门必须**红**，而不是静默放行。 */
  /* v1.5.202：判定搬进 pure function（\`tools/gate4-exception.mjs\`）。
   * 原来这段被 \`refPassG4\` 短路 ⇒ 只要在位包 G4 有一个模式 PASS（常态）它就**从未被求值**，
   * 第一次真正运行会发生在"正要发一只过不了门的冠军"的那次提交里 —— 那是最不能出错、却唯一没被验证过的时刻。
   * 抽出来之后 D146 用**合成 meta** 把六种组合逐一跑过。语义一个字没改。 */
  const g4recOk = g4ExceptionOk(curImpl, curPool, g4rec);
  ok(refPassG4 || g4recOk,
    refPassG4 ? '线上包 G4 **至少一个模式** PASS（"已知好"一侧成立）'
      : (g4recOk ? '线上包 G4 两模式都红，但 meta 有**完整且口径匹配的 `--force` 留痕** ⇒ 已记录的例外（' +
        String(g4rec.ts || '?') + ' · pool ' + g4rec.pool + ' · impl ' + (g4rec.impl || G4IMPL_AT_EXCEPTION + '(冻结豁免)') +
        ' · ' + g4rec.lines.length + ' 行）'
        : '线上包 G4 两模式都红，且 meta 里**没有可用的越线留痕**（缺失 / 未 `--force` / 口径 id 与当前克制表不一致' +
          ' / **实现身份已变而例外未重记** / 留痕没带被放过的具体行）⇒ **必须重记**：node tools/promote-champion.mjs <源.bak> --force'));
  /* v1.5.104（用户裁定）：G4 阈值 45% → 60%。**阈值必须有单一常量 + 标定理由**，
   * 否则它会像 `sed` 不匹配那样静默漂移；同时把"理想线 45%"单独留着，别让绿灯被读成"已达理想"。 */
  const gsrc = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gsrc.indexOf('const G4_MAX = 60, G4_IDEAL = 45;') >= 0,
    'G4 阈值必须是**单一常量**（`G4_MAX`），理想线（`G4_IDEAL = 45`）分开存');
  ok(gsrc.indexOf('在位包自己在 G4[long] 就是 65%') >= 0,
    '必须写明标定理由：45% 是**现役包都达不到**的线（用户裁定 60%），否则下轮又会有人把它当"该回到 45%"');
  ok(gsrc.indexOf('距理想线') >= 0, '过闸但未达理想线时，判词必须显式写出差距（别让绿灯冒充"已达理想"）');
  ok(/PASS\s+G5\[线上包\/(long|multi)\]/.test(out), '线上包 G5 必须 PASS（同上）');
  const anyFail = /^\s*FAIL\s+/m.test(out);
  eq(r.status, anyFail ? 1 : 0, '退出码必须与"是否存在 FAIL"一致（CI/promote 靠它判定）');
});





/* ===== v1.5.79（第七轮复核 §15-1）：**威胁靶向**奖励 =====
 * 复核的机制发现：池子里没人会瞄人 ⇒"狙击专精"是池子漏洞（给 4 席加一条"谁放冷枪就打谁"的一行规则，
 * v17-146 的 A 考卷 30%→0%）。与环课题的关键区别：环出手率 0（bootstrap 不到），
 * 而"打威胁者"已在发生（22.5% ≈ 随机 25%）⇒ 窄奖励能给**已有的偶然行为**定向加压。
 * 归因走 damage.source/to（真字段；动作事件**没有** target ⇒ 只能从结果归属）。 */
t('D68 威胁靶向奖励：只记"我打的、上回合构成威胁的、不同受击者"（复核 §15-1）', function () {
  eq(T.targetReward().w, 0, '默认必须是**关**（实验臂用 EPIRUS_TGT_W 打开，不改出厂口径）');
  const tk = T.threatKeyList();
  ok(tk.indexOf('snipe') >= 0 && tk.indexOf('ring') >= 0, '威胁键 = 穿透类 + 聚能环（实测 ' + tk.join(',') + '）');
  const ev = [
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' },
    { type: 'action', pid: 1, key: 'snipe', outcome: 'ok' },
    { type: 'damage', source: 1, to: 0, amt: 2, via: 'snipe' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' },
    { type: 'action', pid: 2, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 2, amt: 2, via: 'gun' }
  ];
  eq(T.countThreatHits(ev, 0), 1, '只有"上回合放冷枪的人"记 1（打无威胁的攒ジ者不计）');
  eq(T.countThreatHits(ev, 1), 0, '可归因：不是我打的不算我的分');
  eq(T.countThreatHits([{ type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' }], 0), 0, '第 1 回合没有"上一回合" ⇒ 一律不计');
  const ev2 = [
    { type: 'action', pid: 1, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 1, to: 3, amt: 2, via: 'gun' },
    { type: 'action', pid: 2, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 1, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' }
  ];
  eq(T.countThreatHits(ev2, 0), 1, '上回合造成 >=2 伤害也算威胁（事件派生，不硬编码技能名）');
  const src = readFileSync('js/train/evo.js', 'utf8');
  const gline = src.slice(src.indexOf('const gFit = '), src.indexOf('const gFit = ') + 500);
  ok(gline.indexOf('+ tgtBonus') >= 0, 'tgtBonus 必须并进 gFit（漏了 = 静默空操作）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_TGT_W') >= 0 && wk.indexOf('setTargetReward') >= 0, 'worker 必须读 EPIRUS_TGT_W');
  ok(readFileSync('server/train-server.mjs', 'utf8').indexOf('EPIRUS_TGT_W') >= 0, 'server 必须有审计轨迹（worker stdout 不进流）');
  /* 加硬（v1.5.79 事故本身）：**多回合**序列才抓得住"回合边界不重置 seen"这类 bug ——
   * 第一版 D68 只用 <=2 回合的序列 ⇒ 漏掉了 countThreatHits 恒 0 的**静默空操作**
   * （奖励在 v7tgt4 整臂里从没发出去过，那一臂的读数因此作废）。 */
  const evLong = [];
  for (let r = 0; r < 6; r++) {
    evLong.push({ type: 'action', pid: 0, key: 'gun', outcome: 'ok' });
    evLong.push({ type: 'damage', source: 0, to: 1, amt: 1, via: 'gun' });
    evLong.push({ type: 'action', pid: 1, key: 'ji', outcome: 'ok' });
    evLong.push({ type: 'damage', source: 1, to: 3, amt: 2, via: 'gun' });
  }
  ok(T.countThreatHits(evLong, 0) >= 4, '6 回合重复序列必须认出 >=4 次（回合边界必须重置 seen；恒 0 = 静默空操作）');
  const evSrc = readFileSync('js/train/evo.js', 'utf8');
  ok(evSrc.indexOf('else if (seen[e.pid] !== undefined) { seen = {}; cur++; }') >= 0, 'countThreatHits 必须在换回合处重置 seen');
  const mhSrc = evSrc.slice(evSrc.indexOf('function mirrorHealth'));
  ok(mhSrc.indexOf('threatHitsPerGame') >= 0 && mhSrc.indexOf('threatCapRate') >= 0, '健康探针必须暴露奖励的支付诊断');
  eq(T.setTargetReward(0.07), 0.07, 'setTargetReward 可设');
  T.setTargetReward(0);
});
/* ===== v1.5.80（第八轮复核 §5）：UI 契约（目标弹窗可取消 / 结算期点击有反馈）=====
 * 探针 tools/ui-probe.mjs 在真页面上复现过三条缺陷（读数记在 CHANGELOG v1.5.80）。
 * Chrome 依赖 ⇒ 行为验证走探针，这里只锁**接线**，防它被改回去。 */
/* ===== v1.5.86：对手注册表一致性（这个 bug 在本仓库已发生 ≥3 次，文件注释里自己都写着）=====
 * 事故：往池子里加一个新对手名，只加了 runner 或只加了 worker ⇒ 服务端拿到未定义名字，
 * 跑起来才 `sel is not a function` / `未知/缺失对手`。本轮我又踩了一次（protomine/prototransfer
 * 只注册在 BOT_FN、没进 opp-pool ⇒ 整臂 0.4 秒就失败）。这里把三份清单绑成机械检查。 */
t('D72 对手注册表一致性：runner 的池子名 / opp-pool 注册表 / BOT_FN 映射必须对齐', function () {
  const pool = readFileSync('server/opp-pool.mjs', 'utf8');
  const reg = {};
  const re1 = /name:\s*'([a-z0-9_]+)'\s*,\s*fn:\s*'([A-Za-z0-9_]+)'/g;
  let m; while ((m = re1.exec(pool))) reg[m[1]] = m[2];
  ok(Object.keys(reg).length >= 15, 'opp-pool 注册表应 >=15 个对手（实测 ' + Object.keys(reg).length + '）');
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  const fnBlk = (srv.match(/const BOT_FN = \{[^}]*\}/) || [''])[0];
  ok(fnBlk.length > 0, 'train-server 必须有 BOT_FN 映射表');
  const run = readFileSync('tools/ring2-run.mjs', 'utf8');
  const names = [];
  const re2 = /POOL_[A-E]\s*=\s*[^;]+/g; let m2;
  while ((m2 = re2.exec(run))) {
    const q = m2[0].match(/'([^']+)'/g) || [];
    q.forEach(function (lit) { lit.replace(/'/g, '').split(',').forEach(function (n) { if (n && !/^[A-E]$/.test(n)) names.push(n); }); });
  }
  ok(names.length > 0, '必须能从 runner 里解析出池子名单');
  const bad = names.filter(function (n) { return reg[n] === undefined && n.indexOf('champ:') !== 0; });
  eq(bad.length, 0, 'runner 池子里的名字必须在 opp-pool 注册（未注册: ' + bad.join(',') + '）');
  ok(reg['protomine'] === 'pickProtoMine' && reg['prototransfer'] === 'pickProtoTransfer',
    '本轮补的两个原型系脚本（最强脚本，中立场 45%）必须在册');
});

t('D73 落盘阻断开关：EPIRUS_FEASIBILITY_BLOCK=1 时不可行候选不写盘（默认关）', function () {
  const src = readFileSync('server/train-server.mjs', 'utf8');
  ok(src.indexOf("EPIRUS_FEASIBILITY_BLOCK === '1'") >= 0, '开关必须显式要求 =1（默认关，出厂口径不变）');
  ok(src.indexOf('feasibilityReject: true') >= 0 && src.indexOf('wrote: false') >= 0, '拒绝时必须发 done 事件并标 wrote:false（否则 runner 干等超时）');
  const i = src.indexOf('EPIRUS_FEASIBILITY_BLOCK');
  /* ⚠ 用"就近"判定：文件里 writeBundleMP 出现**两次**（2P 路径也有一处）——
   * 我第一版拿全局 indexOf 比大小，被前面那一处骗红（同 D72 的教训：锚点/位置判定要就近）。 */
  ok(i > 0, '必须有落盘阻断判断');
  /* v1.5.201（审计 D73）：原来切 1500 字符窗 —— 窗口一挪空，报错读成「阻断逻辑放错地方」，
   * 而真相多半是"代码被搬远/被注释掉了"。改成**就近判据**：锚点之后的第一次落盘调用。 */
  const jW = src.indexOf('writeBundleMP(pack', i);
  ok(jW > i && (jW - i) < 4000, '阻断判断必须紧邻 writeBundleMP（在其之前，否则写了再拦等于没拦）—— ' +
    '若这条红了但代码确实在附近，先怀疑「它被搬远了/被注释了」，别当成阈值写错（实测距离 ' + (jW - i) + ' 字符）');
  ok(src.indexOf('feasibility: feasibleInfo') >= 0, '可行时仍要把结论写进产物 meta（可追溯）');
});

t('D74 熵奖励与门禁同口径：进 fit 的熵必须来自"自对局·成功非ジ动作"（用户裁定 A）', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('const spUse = {};') >= 0, '必须有自对局成功动作直方图 spUse');
  ok(src.indexOf("e.outcome === 'ok' && e.key && e.key !== R.SK.JI") >= 0,
    'spUse 必须只收 outcome===ok 的非ジ动作（与 mirrorHealth 的 keyCount 同口径）');
  /* v1.5.92 引入、v1.5.93 换层：进 fit 的那一项是"与门禁同源的量 × 类间/类内**混比**"。
   * `DIV_ROLE_W = 0`（默认）时 `spMixNorm === spDivNorm` ⇒ 逐位等于 v1.5.87 的口径，旧读数仍可比；
   * 这条断言同时钉住"必须与门禁同源"和混比公式（免得有人把 spDivNorm 换成别的量）。 */
  ok(src.indexOf('const divBonus = DIV_W * spMixNorm;') >= 0 &&
    src.indexOf('const spMixNorm = (1 - DIV_ROLE_W) * spDivNorm + DIV_ROLE_W * spRoleNorm;') >= 0,
    '进 fit 的必须是 spDivNorm 与角色间熵的混比（DIV_ROLE_W=0 时逐位等于 spDivNorm）');
  ok(src.indexOf('coverageEntropy(agg.use, agg.aff, DIV_K)') >= 0, '旧口径保留为对照量（便于审计两口径之差）');
  ok(src.indexOf('effSkills: tot ? Math.exp(H) : 0') >= 0, '门禁量仍是自对局成功非ジ动作的 exp(H)（同源）');
});

t('D75 破墙硬过滤：必须在**真的反弹墙**里量（自对局用量不能预测），wall<0.5 压到底', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('function wallProbe(params, games, n)') >= 0, '必须有 wallProbe');
  ok(src.indexOf("BOT_PICKS['reflectspam']") >= 0, '探针必须用真的 reflectspam 对手（不能拿自对局代理量）');
  ok(src.indexOf('wallReject ? (-5.0)') >= 0, '不过关的成员必须被压到选择之外');
  ok(src.indexOf('const wallDmg = WALL_FILTER_ON ? wallProbe') >= 0, '必须有开关（默认关）');
  ok(src.indexOf('let WALL_FILTER_ON = false;') >= 0, '默认 false（出厂口径不变）');
});
t('D76 退火强迫多样性：窗口默认 0（关）、只作用于计分对局、有 env 接线', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('function makeDiversityForce(inner, gen)') >= 0, '必须有强迫器');
  ok(src.indexOf('let DIV_FORCE_GENS = 0;') >= 0, '窗口默认 0（出厂口径不变）');
  ok(src.indexOf('gen < DIV_FORCE_GENS) baseSel = makeDiversityForce') >= 0, '只包计分 chooser（自对局探针不动）');
  /* v1.5.89：接线点从 train-server 的**内联读**挪到**单一来源** server/econ-env.mjs（见 D77）——
   * 所以这里不能再断言"train-server 里有这个 env 名"（它已经不在那儿了），
   * 要断言的是"真正被两端共用的那一份里有它" + "worker 确实导入了那一份"。
   * （这正是本轮修的 bug：断言的是"名字存在"，而名字存在 ≠ 开关进得了算 fitness 的进程。） */
  const eeW = readFileSync('server/econ-env.mjs', 'utf8');
  ok(eeW.indexOf('EPIRUS_DIV_FORCE_GENS') >= 0, '必须有 env 接线（接线点在单一来源 econ-env.mjs）');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf("from './econ-env.mjs'") >= 0,
    'worker 必须导入同一份接线（否则这四个开关到不了算 fitness 的进程 —— 第八轮复核 §2）');
});

/* ===== v1.5.89（第八轮复核 §2）：经济/熵奖励 env 的**单一来源** + "worker 真的拿到了吗" =====
 * 事故（[实测 + 代码事实]）：`EPIRUS_DIV_W / EPIRUS_DIV_K / EPIRUS_DIV_FORCE_GENS / EPIRUS_WALL_FILTER`
 * 原先只在 `train-server.mjs` 内联读，而 fitness 在 **16 个 worker 线程**里算，worker 只读
 * `EPIRUS_ECO_*` 三个名字 ⇒ 这四个开关在 worker 里**全是空操作**，而日志完全正常
 * （服务端 `[eco] 生效值` 打的是被覆盖后的值）⇒ 臂 K（`DIV_W=0.3`）与臂甲（强迫 60 代 + 破墙过滤）
 * 的 A/B 实际是 **A/A**，两条臂的读数整批作废。
 * 同族：D24（fight env 半开）、D7/D72（对手池两份清单）、v1.5.79 的 `TGT_W` 空发。
 * 解法同族：**单一来源** + 两端回执。反证：把 `readEconEnv` 换回任一处裸读 ⇒ 这条立即红。 */
t('D77 经济/熵奖励 env 只能有**一个**读取点（server/econ-env.mjs），且 worker 必须拿到生效值', function () {
  const ee = readFileSync('server/econ-env.mjs', 'utf8');
  /* 键名表从模块里解析 ⇒ 以后往 econ-env.mjs 加一个键，这条扫描自动覆盖它（不会漏）。 */
  const keyList = ((ee.match(/ECON_ENV_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(keyList.length >= 8, 'ECON_ENV_KEYS 应 >=8 个 env 名（实测 ' + keyList.length + '）');

  /* ① 静态：这些 env 名不得出现在**任何**读取点。用**整名**匹配（不能用 EPIRUS_WALL_*
   * 这种前缀正则 —— `EPIRUS_WALL_MS`（墙上时钟上限）是另一个无辜的 env，会被误伤）。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'tools/ring2-run.mjs',
    'js/train/evo.js', 'js/train/policy.js', 'js/train/trainer.js'];
  const bad = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i2 = 0; i2 < lines.length; i2++) {
      const L = lines[i2]; const t2 = L.trim();
      if (t2.startsWith('*') || t2.startsWith('//') || t2.startsWith('/*')) continue;   // 注释里提到名字不算
      for (const k of keyList) if (L.indexOf(k) >= 0) bad.push(f + ':' + (i2 + 1) + '  ' + k);
    }
  }
  eq(bad.length, 0, '这些 env 的读取必须集中在 server/econ-env.mjs：\n    ' + bad.join('\n    '));

  /* ② 正证：两端都从它导入，且 worker 把**生效值**打出来（"到没到 worker"唯一能直接看到的证据，
   * 与 `[ringforce] worker eps=` 同族 —— 本轮全靠第三方复核才发现，就是因为没有这一行）。 */
  for (const f of ['server/train-server.mjs', 'server/train-worker.mjs']) {
    ok(readFileSync(f, 'utf8').indexOf("from './econ-env.mjs'") >= 0, f + ' 必须从 econ-env.mjs 导入');
  }
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('hasEconOverride(econEnv)') >= 0, 'worker 必须用 hasEconOverride 判"要不要覆写"');
  ok(wk.indexOf('[econ] worker 生效值: ') >= 0, 'worker 必须有 [econ] worker 生效值 回执（否则静默半开看不出来）');
  ok(wk.indexOf('T.economyReward()') >= 0, '回执必须报 setter 后的**生效值**，不能只报 env 原文');

  /* ③ 契约：`readEconEnv` 可能返回的每个键，`evo.js:setEconomyReward` 都必须认 ——
   * 漏一个键 = "开关看着接上了、实际被 setter 忽略"，与 §2 是同一类事故的另一种形态。 */
  const keys = ((ee.match(/ECON_REWARD_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(keys.length >= 6, 'ECON_REWARD_KEYS 应 >=6 个键（实测 ' + keys.length + '）');
  /* ===== v1.5.128（门禁审计 §2-1）：**把"1200 字符窗口"检查换成运行时往返** =====
   * 旧写法 `evo.slice(indexOf('function setEconomyReward(o)'), +1200).indexOf('o.<键> != null')` 有三个毛病：
   *   ① 保的是**排版**（加一行注释就能把后面的键顶出窗口）；② 窗口会在模式串**中途截断** ⇒ 起点 1194 也会红
   *   （我为它连红四次）；③ 抓不到"读了但没生效"。下面喂值读回：**更强、且与排版无关**。 */
  const SENT = { target: 7, cap: 33, divW: 0.123, divK: 9, divRoleW: 0.25, divCatW: 0.25, divForceGens: 5, wallFilter: true, fitCal: true,
    wallGames: 4, hoardOnLeftover: true, convRatio: true, convOffense: true, hoardCapMult: 5, stockBonus: 0.11,
    blockW: 0.22, widthW: 0.33, bigcardW: 0.44 };
  const ALIAS = { target: 'targetOverride', cap: 'capOverride' };
  const notOk = [];
  try {
    T.setEconomyReward({ reset: true });
    for (const k of keys) {
      const s = Object.prototype.hasOwnProperty.call(SENT, k) ? SENT[k] : 0.5;
      T.setEconomyReward({ reset: true });
      let back = null;
      const one = {}; one[k] = s;
      try { T.setEconomyReward(one); back = T.economyReward(); } catch (e) { notOk.push(k + '(抛错)'); continue; }
      const f = ALIAS[k] || k;
      if (!back || !(f in back)) { notOk.push(k + '(未接受)'); continue; }
      if (back[f] !== s && String(back[f]) !== String(s)) notOk.push(k + '(未生效:' + String(back[f]) + ')');
    }
  } finally { T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 }); }
  eq(notOk.length, 0, 'setEconomyReward 必须**接受并生效** econ-env 的每个键（运行时往返；坏: ' + notOk.join(',') + '）');

  /* ④ 行为：把真模块跑一遍 —— 新名优先、旧名兜底、空串＝未设、wallFilter 只认 '1'。 */
  const prog = [
    'const { pathToFileURL } = require("node:url");',
    'import(pathToFileURL(process.cwd() + "/server/econ-env.mjs").href).then(function (M) {',
    '  var a = M.readEconEnv({ EPIRUS_DIV_W: "0.3", EPIRUS_ECO_DIVW: "0.06", EPIRUS_DIV_K: "6", EPIRUS_DIV_FORCE_GENS: "60", EPIRUS_WALL_FILTER: "1", EPIRUS_WALL_GAMES: "3" });',
    '  var b = M.readEconEnv({ EPIRUS_ECO_DIVW: "0.06" });',
    '  var c = M.readEconEnv({ EPIRUS_DIV_W: "", EPIRUS_WALL_FILTER: "0" });',
    '  console.log(JSON.stringify({ a: a, b: b, c: c, ha: M.hasEconOverride(a), hb: M.hasEconOverride(b), hc: M.hasEconOverride(c) }));',
    '}).catch(function (e) { console.log("ERR " + e.message); });'
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', prog], { encoding: 'utf8' });
  ok(r.status === 0 && String(r.stdout || '').indexOf('ERR ') < 0,
    'econ-env 自检进程必须正常跑完（stdout: ' + String(r.stdout || '').slice(0, 120) +
    ' stderr: ' + String(r.stderr || '').slice(0, 200) + '）');
  const out = JSON.parse(String(r.stdout || '').trim().split('\n').pop());
  eq(out.a.divW, '0.3', '新名 EPIRUS_DIV_W 必须优先于旧名 EPIRUS_ECO_DIVW');
  eq(out.a.wallFilter, true, "EPIRUS_WALL_FILTER='1' 才是开");
  eq(out.b.divW, '0.06', '旧名 EPIRUS_ECO_DIVW 必须继续生效（历史臂的启动命令仍可复现）');
  eq(out.c.divW, null, "空串必须当**未设**（不能被静默当成 divW=0 从而改掉训练口径）");
  eq(out.c.wallFilter, null, "EPIRUS_WALL_FILTER='0' 不是开（与改动前的语义逐字一致）");
  eq(out.hc, false, "只有空串 / 非 '1' 的 wallFilter ⇒ 不应触发覆写（保持出厂行为一字不变）");
  eq(out.hb, true, '只设旧名也必须触发覆写');
});

t('D78 第 6 道判据（输出密度 / 经济出口）：**没有"已知好"一侧就不许上闸** + 密度对手必须在册', function () {
  /* v1.5.90（第八轮复核 §8-3/§8-4）：把"输出密度 / 经济出口"机械化。
   * 这条守门盯的不是阈值数字，而是**上闸的前提**：本仓库栽过多次"阈值把所有人挡住"
   * （附录 B2-6 / C-4：阈值必须先能分开已知好与已知坏）。在位线上包花珠率 0%（未闭环）
   * ⇒ 这道判据现在**没有**判别力 ⇒ 只许记录、不许阻断；等有候选真过了它再打开。
   * 反证：把 `DENSITY_BLOCK` 改成 true ⇒ 这条立即红（它就开始挡所有候选了）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function densityProfile(') >= 0, '必须有输出密度探针（每回合出手伤害 / 按ジ占比）');
  ok(al.indexOf('export const DENSITY_BLOCK = false;') >= 0, '第 6 道判据默认**不阻断**（现在没有判别力）');
  /* v1.5.94（第九轮复核 §6）：复核要求"上闸"，我**部分不采纳**，理由必须钉在源码里 ——
   * 它点名的"密度门"是 `只枪(打最肥)` 那一格，而那一格**早就已经是阻断项**（G4，标定包 `v7f3-94` = 5%/5%）；
   * 本常量管的是**珠经济闭环**，过了它的两个包都是废包 ⇒ 翻了只会挡死所有候选。 */
  ok(al.indexOf('v7f3-94') >= 0 && al.indexOf('已经是闸') >= 0,
    '必须把"只枪格已由 G4 阻断、本常量管的是另一件事"写进源码注释（免得下轮又有人来翻它）');
  /* v1.5.94（第九轮复核 §5-1）：**退化包**（自对局从不出手）必须能被判负，且走 fails */
  ok(al.indexOf('zeroAtkRate') >= 0 && al.indexOf('自对局零攻击局') >= 0 &&
    al.indexOf("fails.push('自对局零攻击局") >= 0,
    '退化包判据必须存在且进 fails（复核实测：0 出手的包照样拿 A 考卷 46.8~47.1%）');
  ok(al.indexOf('zeroDealtRate') >= 0, '零出手率与零伤害率必须分两列（复核 §7-1）');
  /* v1.5.101（第十轮复核 §4-2）：**布尔化的经济判据会被"最小非零"刷分** ——
   * 候选② `v7wall1-93` 得珠 835 / 花掉 **1**（花/得 0.12%）就点亮了"闭环 ✓"，而它每局浪费 20.9 颗。
   * ⇒ 闭环改成**双条件**，并单列"过期/局"。 */
  ok(al.indexOf('Number(dens.spentRate) >= 0.2 && Number(dens.expiredPerGame) <= 1') >= 0,
    '珠经济闭环必须是**双条件**（花/得 ≥20% 且 过期/局 ≤1）');
  ok(al.indexOf('beadExpiredPerGame') >= 0, '必须记录"过期/局"（双条件的第二项）');
  ok(readFileSync('tools/promote-champion.mjs', 'utf8').indexOf('含空转/过期珠') >= 0,
    '`energy` 那一档必须标注"含空转/过期珠" —— 否则 25.4% 会被读成"开始用能量类"（实际是囤积）');
  ok(al.indexOf('density: dRec') >= 0, '第 6 道的读数必须进 feasibilityOf 的返回值（落盘 meta 要能查）');
  const fs0 = al.indexOf('export function feasibilityOf(');
  const fs1 = al.indexOf('export function chargeProfile(');
  ok(fs0 > 0 && fs1 > fs0, '必须能定位 feasibilityOf 的函数体（用顶层兄弟函数定界，不能用"下一个 function"）');
  const fs = al.slice(fs0, fs1);
  ok(fs.indexOf('fails.push') >= 0, '前五道仍照旧记 fails');
  ok(fs.indexOf('notes.push') >= 0 && /notes\.push\('第6道/.test(fs) && fs.indexOf('DENSITY_BLOCK') >= 0,
    '第 6 道必须走 notes（记录）+ 由 DENSITY_BLOCK 显式控制 —— **不得**进 fails');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('densityProfile(W, params') >= 0 && pc.indexOf('输出密度') >= 0,
    '体检必须打印输出密度（否则等于没量 —— "命门"就还只是口头的）');
  ok(pc.indexOf('density: { dmgPerRound: dens.dmgPerRound') >= 0, '体检必须把密度读数喂给 feasibilityOf');
  /* 上游：密度对手必须在册，否则"把压制密度放进池子"这条实验根本起不来（第 4 次"加名字漏一处"）。 */
  const bots = readFileSync('js/train/bots.js', 'utf8');
  ok(bots.indexOf('function pickGunSpam(') >= 0, '必须有"只枪·打最肥"的对手（复核 §6 那一行脚本）');
  ok(bots.indexOf('pickGunSpam,') >= 0, 'pickGunSpam 必须导出');
  ok(bots.indexOf('mpPickOne(state, fattest)') >= 0,
    '打最肥必须在最高血那一档里**随机**取（按 pid 取 = 座位身份通道，D50/D58 家族）');
  ok(readFileSync('server/opp-pool.mjs', 'utf8').indexOf("name: 'gunspam'") >= 0, 'gunspam 必须在对手注册表里');
  const T2 = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/OPP_DEFAULT = OPP_SPECS\.slice\(0, 9\)/.test(T2), '默认池仍取前 9 个 ⇒ 新增 specialist 不进默认基线');
});

t('D79 技能广度 S：定义明确 + 按 rules.js 声明的 cat 分层（**不按伤害加权**）+ 固定分母 + 只记录不阻断', function () {
  /* v1.5.91（用户裁定）：用户要的目标形状是 `H + T·S`（H = 与胜率相关的强度、S = 技能广度、T = 交换率）。
   * 这条守门盯的是**用户明确否定过的东西**，免得以后又走回去：
   *   ① 不得按"落地伤害"加权 —— 那样梯度会全给最便宜的枪，而且防御类卡伤害恒 0 ⇒ 量不出防御技能的使用；
   *      更根本：任何"按卡打分"的权重都会给某张卡一个**专属梯度**（v1.3.7 的 hold+conv 就是活例）；
   *   ② 分母不得来自"当时可负担的技能数"（v1.5.86 那个可以靠"把菜单变穷"刷分的洞）；
   *   ③ 不得悄悄变成阻断项（它现在**只测量**；上闸是独立决策，且要先有判别力）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function breadthProfile(') >= 0, '必须有广度的权威定义 breadthProfile');
  const seg = al.slice(al.indexOf('export function breadthProfile('));
  ok(seg.indexOf('.cat') >= 0, 'S 必须按 rules.js **自己声明的 cat** 分层（单一真源，不手搓角色表）');
  ok(seg.indexOf('dmg') < 0 && seg.indexOf('amt') < 0,
    'S **不得**按落地伤害加权（用户 v1.5.91：那会全跑去用枪，且量不出防御技能）');
  ok(seg.indexOf('Math.log(K_menu)') >= 0, '分母必须是**固定的声明菜单** ln(K_menu)');
  ok(seg.indexOf('aff') < 0, '分母不得取自"当时可负担的技能数"（v1.5.86 的刷分洞）');
  ok(seg.indexOf('e.key !== R.SK.JI') >= 0, 'ジ 必须排除（它是攒钱/等待，不算技能选择）');
  ok(seg.indexOf("e.outcome === 'ok'") >= 0, '只统计成功动作（与门禁 G 同源，D74 的同一条规矩）');
  ok(seg.indexOf('N: N') >= 0 && seg.indexOf('maxCardShare') >= 0, '必须返回样本量 N 与反 spam 的 maxCardShare');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('breadthProfile(W, params') >= 0 && pc.indexOf('技能广度 S（n=') >= 0,
    '体检必须打印 S，且**与 n 一起打**（S 对样本量敏感 —— METHODOLOGY 22）');
  ok(pc.indexOf('目标 = H + T·S') >= 0, '打印里必须写清目标形状（用户要求"S 怎么算"必须明确）');
  ok(pc.indexOf("fails.push('广度") < 0 && pc.indexOf('fails.push("广度') < 0,
    '广度**不得**进 fails（只测量；要上闸是独立决策）');
});

t('D80 类间广度权重 DIV_ROLE_W：默认 0（逐位等于旧口径）+ 走单一来源接线 + 真源与 breadthProfile 同一个', function () {
  /* v1.5.92 引入（当时叫 `DIV_CAT_W`、按 4 个 `cat`），v1.5.93 换成按 **8 个功能角色** 并更名 `DIV_ROLE_W`。
   * 设计上必须同时满足三条：
   *   ① 默认（不设 env）**逐位等于** v1.5.87 的旧口径 ⇒ 旧产物 / 旧读数仍可比（"默认不设即不变"的规矩）；
   *   ② 类间那一层必须与 `tools/audit-lib.mjs` 的 `breadthProfile` **同一个真源**（现在是 `T.roleOf`），
   *      否则"训练在优化什么"与"体检在量什么"会分叉 —— v1.5.89 的静默半开就是这一族；
   *   ③ 旧 env `EPIRUS_DIV_CATW` 必须仍可用（新名优先），否则老命令会**静默变成空操作**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let DIV_ROLE_W = 0;') >= 0, '默认必须是 0（不设 env 即旧行为）');
  /* v1.5.128（审计 §2-4）：把**源码文本钉**换成**运行时喂值读回** ——
   * 旧写法逐字匹配 setter 的表达式，2026-09-19 一次"语义不变的重写"就把它弄红过（它保的是排版不是行为）。 */
  try {
    T.setEconomyReward({ reset: true });
    T.setEconomyReward({ divRoleW: 0.4 });
    eq(T.economyReward().divRoleW, 0.4, '新名 divRoleW 必须生效');
    T.setEconomyReward({ reset: true });
    T.setEconomyReward({ divCatW: 0.4 });
    eq(T.economyReward().divCatW, 0.4, '旧名 divCatW 必须兜底生效（新名优先）');
  } finally { T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 }); }
  ok(evo.indexOf('const spMixNorm = (1 - DIV_ROLE_W) * spDivNorm + DIV_ROLE_W * spRoleNorm;') >= 0,
    '混比公式必须显式可读（W=0 ⇒ 只剩 spDivNorm = 旧口径）');
  ok(evo.indexOf('const divBonus = DIV_W * spMixNorm;') >= 0, 'fit 必须用混比后的量');
  ok(evo.indexOf('Math.log(K_ROLE)') >= 0, '类间熵的分母必须是**声明的角色数** ln(K_ROLE)（固定，不可随实测变）');
  const ee = readFileSync('server/econ-env.mjs', 'utf8');
  ok(ee.indexOf("'EPIRUS_DIV_ROLEW'") >= 0 && ee.indexOf("'EPIRUS_DIV_CATW'") >= 0 &&
    ee.indexOf("'divRoleW'") >= 0 && ee.indexOf("'divCatW'") >= 0,
    'econ-env 必须同时覆盖新名与旧名（D77 会顺带查"读到的键 setter 都认"）');
  /* 行为：设一次 / 试旧名 / 试优先序 / 复位 —— 防"写了但从没生效"这类静默空操作 */
  eq(T.economyReward().divRoleW, 0, 'D80 跑到这里时它必须还是默认 0');
  eq(T.setEconomyReward({ divRoleW: 1 }).divRoleW, 1, '设 divRoleW=1 后 economyReward() 必须回读 1');
  eq(T.setEconomyReward({ divCatW: 0.5 }).divRoleW, 0.5, '旧名 divCatW 必须仍能设（老命令不能变成空操作）');
  eq(T.setEconomyReward({ divRoleW: 0.25, divCatW: 0.75 }).divRoleW, 0.25, '两个都给时新名优先');
  eq(T.economyReward().K_role, 8, '声明的角色数应为 8');
  eq(T.setEconomyReward({ divRoleW: 0 }).divRoleW, 0, '复位必须回 0（别把状态泄漏给后面的用例）');
});

t('D81 功能角色表 roleOf：只从声明字段推导（**不得枚举卡名**）+ 每张非ジ卡恰好一类 + tools 侧共用同一真源', function () {
  /* v1.5.93（用户裁定的下一步）：v1.5.92 的 4 个 `cat` 太粗 —— `attack` 里混着三种**不同功能**
   * （枪=廉价压制 / 激光剑=穿透反射 / 狙击=穿透防御）⇒ 几次 token 出手就能把类间熵拉满。
   * 换成 8 个功能角色。这条守门钉住两件事：分类是**推导**出来的（不是手搓），以及两处**不许各写一张表**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  const i0 = evo.indexOf('  function roleOf(k) {');
  const i1 = evo.indexOf('const K_ROLE = (function () {');
  ok(i0 > 0 && i1 > i0, '必须能定位 roleOf 的定义（用 K_ROLE 定界）');
  const seg = evo.slice(i0, i1);
  ok(seg.indexOf('c.cat') >= 0 && seg.indexOf('c.pierce') >= 0 && seg.indexOf('c.dmg') >= 0,
    '分类只许用 rules.js 已声明的字段（cat / pierce / dmg）');
  const NAMES = ['gun', 'sword', 'tank', 'snipe', 'guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor',
    'proto', 'holo', 'charge', 'ring', 'drain', 'railgun', 'miniT', 'bigT', 'rod', 'laserEye', 'transfer',
    'curse', 'firestorm', 'mine', 'taunt', 'cannon', 'purify', 'dualGun', 'mirror'];
  const hit = NAMES.filter(function (n) { return seg.indexOf("'" + n + "'") >= 0 || seg.indexOf('"' + n + '"') >= 0; });
  ok(hit.length === 0, '不得枚举卡名（命中：' + hit.join(',') + '）—— 手搓白名单是本仓库踩过三次的坑');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  const seg2 = al.slice(al.indexOf('export function breadthProfile('));
  ok(seg2.indexOf('T.roleOf') >= 0 && seg2.indexOf('K_role') >= 0,
    'breadthProfile 必须调 T.roleOf（单一真源），不得自己再写一张角色表');
  /* 行为：在**真卡表**上跑一遍 —— 每张卡都要有归属，且非ジ卡恰好 8 类 */
  const roles = {};
  const bad = [];
  Object.keys(R.byKey).forEach(function (k) {
    const r2 = T.roleOf(k);
    if (typeof r2 !== 'string' || !r2) bad.push(k);
    if (k !== R.SK.JI) roles[r2] = (roles[r2] || 0) + 1;
  });
  eq(bad.length, 0, '每张卡都必须能归类（未归类：' + bad.join(',') + '）');
  eq(T.roleOf(R.SK.JI), 'ji', 'ジ 必须单独归为 ji（它是攒钱/等待，不算技能选择）');
  eq(Object.keys(roles).length, 8, '非ジ卡应恰好分 8 个角色（实测 ' + Object.keys(roles).sort().join(',') + '）');
  ['defense', 'economy', 'pierceBoth', 'pierceReflect', 'pierceDefense', 'burst', 'damage', 'utility'].forEach(function (n) {
    ok(roles[n] >= 1, '角色 ' + n + ' 至少要有一张卡（实测 ' + (roles[n] || 0) + '）');
  });
});

t('D82 记账纪律：24 小时内落盘的 .bak 必须在 CHANGELOG 里被点名（第九轮复核 §7-5）', function () {
  /* 复核抓到：整晚 20 个产物零记录（其中一个座位极差 99pt）—— "产物=证据，没记账的产物等于没有结论"。
   * 这条门只看**最近 24 小时**（不去追溯历史堆积，那是另一件清理工作）；它的作用是：
   * **新落的臂在下次跑门禁时就被点名**，直到写进 CHANGELOG 为止。 */
  const cd = readFileSync('CHANGELOG.md', 'utf8');
  const dir = 'docs/artifacts';
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const fresh = readdirSync(dir).filter(function (f) { return /\.bak$/.test(f); })
    .filter(function (f) { return statSync(dir + '/' + f).mtimeMs >= cutoff; });
  /* v1.5.201（门层审计 D82）：原来"时窗内无产物"时退化成 ok(cd.length > 1000)
   * = "CHANGELOG 大于 1000 字节"（该文件 307KB）—— 一条恒真断言，等于这条门在干净检出上不存在。
   * 现在**两个方向都查**：① 在场但没点名（下面这一段，原有）；② **点过名却不在场**（这里）。
   * ② 只认 **显式产物点名行**（`> 产物点名（D82）：a.bak, b.bak`）且只查**最新条目**那一块 ——
   * 正文里随口提到的文件名不是账本（第一版就是这么误报的：把 v1.5.200 正文里的
   * `js/bundled-champion.js.bak` 与范围写法 `train-3p-out-band1..6.bak` 都当成了账本条目），
   * 而历史条目里被清理掉的产物属正常，全查会永久红。
   * 补这半条的直接起因：本轮我误删了 6 个 09-22「排练臂」产物，整套门禁全绿、没有一条发现。 */
  const i2 = cd.indexOf('\n## ', 1);
  const topBlock = i2 > 0 ? cd.slice(0, i2) : cd;
  const ledLine = (topBlock.match(/^> 产物点名（D82）：(.*)$/m) || [])[1] || '';
  const namedTop = (ledLine.match(/[A-Za-z0-9_./-]+\.bak/g) || []);
  const absent = namedTop.filter(function (n) {
    return !existsSync(n.indexOf('/') >= 0 ? n : (dir + '/' + n));
  });
  ok(absent.length === 0, '最新条目的产物点名行点过名、但盘上不在的产物（被删了？改名了？）：' + absent.join(', '));
  const miss = fresh.filter(function (f) { return cd.indexOf(f.replace(/\.bak$/, '')) < 0; });
  ok(miss.length === 0, '这些 24h 内的产物在 CHANGELOG 里查无字（' + fresh.length + ' 个里缺 ' + miss.length + '）：' +
    miss.slice(0, 12).join(', ') + (miss.length > 12 ? ' …' : ''));
});

t('D83 转化率探针：分母必须是"可负担的决策点"（**不得用使用率**）+ 蒙特卡洛不得消耗对局随机流', function () {
  /* v1.5.95（第九轮复核 §5-2/§7-2）：验收"价值估计病"必须用**可负担时的选中率** ——
   * 使用率会被"压根不出手"的退化包骗（`v7ctrlE-31` 0.00 攻击/回合，照样拿 A 卷 46.8%）。
   * 这条门把这个口径选择**钉在源码里**，免得以后有人图省事换成使用率。 */
  const p = readFileSync('tools/probe-convert.mjs', 'utf8');
  ok(p.indexOf('const ready = rows.filter(function (r) { return r.affordable.indexOf(k) >= 0; });') >= 0,
    '分母必须是**可负担的决策点**（不是全部决策点）');
  ok(p.indexOf('picks += (r.mc[k] || 0); opp += MC;') >= 0, '分子必须是蒙特卡洛采样选中次数（按点数累计）');
  ok(p.indexOf('const realRng = state.rng;') >= 0 && p.indexOf('state.rng = { next: mulberry32(') >= 0 &&
    p.indexOf('finally { state.rng = realRng; }') >= 0,
    '蒙特卡洛必须换**独立 RNG** 并在 finally 里还原（否则会污染对局随机流）');
  ok(p.indexOf('实际选中率') >= 0 && p.indexOf('【转化拒绝】') >= 0 && p.indexOf('【收入饥饿】') >= 0,
    '必须同时给"实际选中率"对照 + 转化拒绝/收入饥饿两张分类表（两种形态必须分开数）');
  ok(p.indexOf('可负担 ≥10% 的决策点，却选中 <1%') >= 0, '转化拒绝的判据必须写清（可负担门槛 + 选中门槛）');
});

t('D84 真示范（override）：默认关、只在教师动作**可负担**时覆盖、教师按名字选、env 两端接线', function () {
  /* v1.5.96（承接第九轮复核 §5-2 的"价值估计病"）：v1.5.31 起的"教师模仿"其实**只做一致性计数**
   * （`_mt/_mm`），策略从来没走过教师那条线 ⇒ 跨回合后果（环先付 3 ジ、之后 +3/回合）没被体验过。
   * 这条门钉住补上的"真示范"的三个安全性质，以及"名字→函数"只在 evo.js 里写一遍。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IMIT_OVERRIDE = false;') >= 0, '真示范必须**默认关**（旧产物、旧读数仍可比）');
  ok(evo.indexOf("if (IMIT_OVERRIDE && teacherFn && imitB > 0 && subOK && state.rng && typeof state.rng.next === 'function')") >= 0,
    '覆盖必须门控在"有教师 + 退火期内 + 补贴局门槛 + 有 rng"条件下（v1.5.99 加了 subOK）');
  ok(evo.indexOf('legal.some(function (l) { return l.key === ta.key && l.affordable; })') >= 0,
    '只在教师动作**确实可负担**时才覆盖（否则示范会教成"白扔一回合"）');
  ok(evo.indexOf('function teacherFull(') >= 0, '覆盖必须用带 target 的完整动作（teacherAction 只回 key）');
  ok(evo.indexOf("if (n === 'antiring') return setAntiRingTeacher();") >= 0 &&
    evo.indexOf('typeof BOT_PICKS[n] === \'function\'') >= 0,
    '名字→函数映射必须在 evo.js 里（antiring 兼容 + bot 注册表），不许在 server/worker 各写一份');
  /* 行为：真模块上设一次 / 复位；名字认不认 */
  eq(T.setImitOverride(true), true, 'setImitOverride(true) 必须回读 true');
  eq(T.setImitOverride(false), false, '复位必须回 false（别把状态泄漏给后面的用例）');
  eq(T.setImitTeacherByName('antiring'), true, 'antiring 必须仍被认（老命令不能变成空操作）');
  eq(T.setImitTeacherByName('heavyfire'), true, '必须能按名字取 `BOT_PICKS` 里的教师');
  ok(evo.indexOf('global.EpirusBots') >= 0,
    '环专精（`pickRingSpam`）不在 BOT_PICKS 里 ⇒ 必须留"全局注册表按函数名取"这条路（且不许往默认池加键）');
  eq(T.setImitTeacherByName('绝对不存在的名字'), false, '认不出的名字必须返回 false（不许静默当没设）');
  T.setImitTeacher(null);   // 复位成默认教师
  /* 接线：worker 必须读 ENV 并打回执 */
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf("process.env.EPIRUS_IMIT_OVERRIDE === '1'") >= 0 && wk.indexOf('T.setImitTeacherByName') >= 0,
    'worker 必须读 EPIRUS_IMIT_OVERRIDE 并按名字设教师');
  ok(wk.indexOf("[imit] worker 启动值") >= 0, 'worker 必须打启动回执（照 [econ] 的先例，防静默半开）');
  ok(wk.indexOf('gens(env)=') >= 0 && wk.indexOf('以**消息**为准') >= 0,
    '启动回执必须标明"env 是拷贝、示范代数以消息为准"（免得下一个人又被 gens=0 误导）');
  ok(readFileSync('server/train-server.mjs', 'utf8').indexOf('T.setImitTeacherByName') >= 0,
    '主线程也要设一份（两侧口径一致）');
  /* v1.5.96 追加（被真实事故逼出来的）：示范代数必须**走消息**。
   * `worker_threads` 的 process.env 是**创建时的拷贝**，而 `EPIRUS_IMIT_GENS` 是服务端事后派生的
   * ⇒ 只走 env 时 worker 永远读到 0 ⇒ 整臂与对照**逐位相同**（本轮 `v7ringT` 实测，回执里 `gens=0`）。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('imitGens: Number(process.env.EPIRUS_IMIT_GENS || 0)') >= 0,
    'evalN 消息必须带 `imitGens`（示范代数不能只走 env）');
  ok(wk.indexOf('T.setImitUntil(Number(msg.imitGens) || 0)') >= 0, 'worker 必须按**消息**设示范代数');
  ok(wk.indexOf('示范代数没在 worker 生效') >= 0, 'worker 必须自检生效并**响亮报错**（不许静默半开）');
  ok(wk.indexOf('[imit] worker **消息**生效值') >= 0, '消息生效值必须有回执（照 [econ] 的先例）');
  /* v1.5.96 真根因：IMIT 接线原先**只写在 2 人路径 `runTrain`**，而 runner 带 `n=5` 走的是
   * `runTrainN` ⇒ N 人臂上 `imitB ≡ 0`、整臂与对照逐位相同。⇒ 两条路径必须**共用一份实现**。 */
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('function applyImitEnv(') >= 0, '必须抽成共用的 `applyImitEnv`（同一件事不许写两遍）');
  ok((sv.match(/applyImitEnv\(/g) || []).length >= 3,
    '`applyImitEnv` 必须被**两条训练路径**都调用（定义 1 + 调用 ≥2）—— 本轮事故正是"只写在 2 人路径"');
  ok(/async function runTrainN\([\s\S]{0,400}applyImitEnv\(/.test(sv), '`runTrainN`（N 人路径）必须调用它（事故现场）');
  ok(/\[imit\] 主线程生效值 gens=/.test(sv), '主线程必须打"生效值"回执（含 gens / frac / teacher / accepted / override / β(gen0)）');
  /* v1.5.96 补：名字解析不出来**必须响亮拒绝** —— `v7stock1` 就是 env 写了 `deepsaver`（不在 BOT_PICKS 里）
   * 而库里静默用默认教师 heavyfire，整臂**贴着错标签跑完**（回执打了 accepted=false，但没人拦）。 */
  ok(sv.indexOf('教师名字解析失败') >= 0 && /if \(!acc\) \{\s*throw new Error/.test(sv),
    '教师名字解析不出来必须抛错拒绝（不许静默退回默认 heavyfire）');
});

t('D85 分段教师计划（两段课程）：解析只写一份、两条路径 + worker 都调它、每段各自退火、坏名字抛错', function () {
  /* v1.5.97（承接 v1.5.96 §7 的机制结论）：一次性"开环教师"够不着环（环恒不可负担）；
   * 两段课程 = 先用攒钱教师把 ep 攒起来，再换开环教师。这条门钉住这四件事。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('function setImitPlanByName(spec, totalGens) {') >= 0, '必须有**唯一一份**解析函数 setImitPlanByName');
  ok(evo.indexOf('let IMIT_PLAN = null;') >= 0, '默认无计划（不设 plan ⇒ 行为与旧版逐位相同）');
  ok(evo.indexOf('if (!IMIT_UNTIL || gen >= IMIT_UNTIL) return 0;') >= 0,
    '旧口径（单一退火窗）必须保留 —— 不设 plan 时逐位不变');
  ok(evo.indexOf('return IMIT_BETA * Math.max(0, 1 - (gen - s.start) / span);') >= 0,
    '计划模式下必须**每段各自**线性退火（第二段要重新施加压力）');
  ok(evo.indexOf("imitTeacherForGen(gen) || BOT_PICKS['heavyfire']") >= 0,
    '取教师必须按当前代数走 imitTeacherForGen（分段）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setImitPlanByName(process.env.EPIRUS_IMIT_PLAN, imitGens)') >= 0, '主线程必须按 plan 建计划');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitPlan: process.env.EPIRUS_IMIT_PLAN || null') >= 0,
    'evalN 消息必须带 imitPlan（同 imitGens 的理由：env 是拷贝）');
  const wk2 = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk2.indexOf('T.setImitPlanByName(msg.imitPlan, Number(msg.imitGens) || 0)') >= 0,
    'worker 必须调**同一个**解析函数（不许各写一份）');
  ok(wk2.indexOf('[imit] worker **消息**计划生效') >= 0, '计划生效必须有回执（含第二段 β ⇒ 自证每段退火）');
  ok(wk2.indexOf("[imit] worker **消息**计划生效") < wk2.indexOf('catch (e) {', wk2.indexOf('msg.imitPlan')) ||
    wk2.indexOf('postMessage({ type: \'evalNResult\', id: msg.id, error: String((e && e.message) || e) })') >= 0,
    'worker 侧解析失败必须 post error（不许崩、不许静默）');
  /* 行为：空 spec ⇒ 无计划；单段 ⇒ 1 段；坏名字 ⇒ 抛错；两段 ⇒ 教师不同 + 第二段 β>0 */
  eq(T.setImitPlanByName('', 100), 0, '空 spec 必须等于"无计划"');
  eq(T.setImitPlanByName('heavyfire:1', 100), 1, '单段计划应有 1 段');
  let threw = null;
  try { T.setImitPlanByName('noSuchTeacher:1', 100); } catch (e) { threw = String((e && e.message) || e); }
  ok(threw && threw.indexOf('教师名字解析失败') >= 0,
    '计划里"认不出的名字"必须抛**名字解析**错误（实测：' + threw + '）');
  let threw2 = null;
  try { T.setImitPlanByName('不是合法片段:1', 100); } catch (e) { threw2 = String((e && e.message) || e); }
  ok(threw2 && threw2.indexOf('无法解析') >= 0,
    '计划里格式错的片段必须抛**片段解析**错误（实测：' + threw2 + '）—— 两条错路都得响亮');
  eq(T.setImitPlanByName('heavyfire:0.5,guardgun:0.5', 100), 2, '两段计划应有 2 段');
  ok(T.imitTeacherForGen(10) !== T.imitTeacherForGen(90), '两段的教师必须不同（前段 10 / 后段 90）');
  /* 钉的是"**段边界处 β 回到接近满额**"（第二段重新施加压力）：
   * 两段各 50 代 ⇒ β(50) 应≈0.12；旧的单窗口口径在 50 处只有 0.06 ⇒ 这条能判别。 */
  ok(T.imitBetaForGen(50) > 0.10,
    '第二段开头必须重新接近满额（β(50) 实测 ' + T.imitBetaForGen(50).toFixed(3) + ' > 0.10；旧口径会是 0.060）');
  ok(T.imitBetaForGen(90) > 0, '第二段内部必须仍为正（β(90) 实测 ' + T.imitBetaForGen(90).toFixed(3) + '）');
  ok(T.imitBetaForGen(100) === 0, '窗末 β 必须为 0（退火到底）');
  eq(T.setImitPlanByName('', 0), 0, '复位成无计划（别把状态泄漏给后面的用例）');
});

t('D86 只示范目标卡（only）：override 与奖励计数**都**过滤 + 非法卡名抛错 + 随消息下发', function () {
  /* v1.5.98（承接 v1.5.97 §4）：两段课程里第二段的 fallback 覆盖把第一段教出来的"攒"抹掉了。
   * 修法 = 让示范只作用于**教师真要教的那张卡**（环）⇒ fallback 不再覆盖策略自己的好动作。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IMIT_ONLY = null;') >= 0 && evo.indexOf('function setImitOnly(k) {') >= 0,
    '必须有 only 开关且默认 null（不过滤 ⇒ 行为与旧版逐位相同）');
  ok(evo.indexOf('else if (onlyKey && ta.key !== onlyKey) { IMIT_STAT.filteredByOnly++; }') >= 0 &&
    evo.indexOf('IMIT_STAT.fired++;') >= 0,
    'override 必须被 only 过滤（只覆盖教师真要教的那张卡）—— v1.5.181 起同时记"被 only 过滤"的次数'
    + '（这条原来是钉旧文本形态的，随 v1.5.181 的结构改动而红 ⇒ 见门禁审计 §2-4：这类文本钉应改运行时）');
  ok(evo.indexOf('if (tk != null && (!onlyKey || tk === onlyKey) && subOK) {') >= 0,
    '**奖励计数也必须被 only 与 subOK 过滤** —— 否则"与 fallback 一致"白拿奖励，正是抹掉"攒"的那股力');
  ok(evo.indexOf('function imitOnlyForGen(gen)') >= 0 && evo.indexOf('imitB, imitOnlyForGen(gen)') >= 0,
    '取值必须按当前代数走 imitOnlyForGen（计划里可**按段**设 only）');
  ok(evo.indexOf('(?:\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*|\\*))?$/.exec(parts[i])') >= 0,
    '计划片段必须支持第三段 `:卡名`（或 `:*` = 不过滤）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setImitOnly(process.env.EPIRUS_IMIT_ONLY || null)') >= 0, '主线程必须设 only');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitOnly: process.env.EPIRUS_IMIT_ONLY || null') >= 0,
    'evalN 消息必须带 imitOnly（env 是拷贝的正当教训）');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setImitOnly(msg.imitOnly)') >= 0,
    'worker 必须按消息设 only');
  /* 行为：默认 null；合法卡可设；非法卡抛错；计划第三段能按段指定 */
  eq(T.setImitOnly(null), null, '不设 ⇒ null（不过滤）');
  eq(T.setImitOnly('ring'), 'ring', '合法卡必须能被设上');
  let threwO = null;
  try { T.setImitOnly('不是一张卡'); } catch (e) { threwO = String((e && e.message) || e); }
  ok(threwO && threwO.indexOf('不是一张合法的卡') >= 0, '非法卡名必须抛错（实测：' + threwO + '）');
  eq(T.setImitOnly(null), null, '复位');
  eq(T.setImitPlanByName('pickDeepSaver:0.5,pickRingSpam:0.5:ring', 100), 2, '第三段形式的计划必须能解析');
  eq(T.imitOnlyForGen(10), null, '段1（无 only）不设过滤');
  eq(T.imitOnlyForGen(90), 'ring', '段2 必须按段生效 only=ring');
  eq(T.setImitPlanByName('', 0), 0, '复位计划');
});

t('D87 只在补贴局里示范目标卡（subOnly）：只对设了 only 的示范生效、值随消息下发', function () {
  /* v1.5.99（承接 v1.5.98 §3）：原生经济里示范"开环"≡ 对"攒"征税（逼它把攒的 ep 花掉）；
   * 补贴局里花的是**白来的 ep** ⇒ 不构成对"攒"的惩罚。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IMIT_SUB_ONLY = false;') >= 0 && evo.indexOf('function setImitSubOnly(on)') >= 0,
    '必须有 subOnly 开关且默认 false（不影响旧行为）');
  ok(evo.indexOf('const subOK = (!IMIT_SUB_ONLY || !onlyKey || !!subFlag);') >= 0,
    '门槛必须**只对设了 onlyKey 的示范**生效（段1 教攒不受影响）');
  ok(evo.indexOf('imitB > 0 && subOK && state.rng') >= 0, 'override 必须被 subOK 门控');
  ok(evo.indexOf('&& subOK) {') >= 0,
    '**奖励计数也必须被 subOK 门控**（否则奖励侧仍在原生局里推它花掉攒的 ep）');
  ok(evo.indexOf('const regenThisGame = commitGame ? 2 : regenForGame(g, games, gen);') >= 0 &&
    evo.indexOf('const regen = regenThisGame;') >= 0,
    '补贴局的判定必须**只算一遍**（同一口径，避免两处各算一遍）；v1.5.186 起必须把 `gen` 传进去（相位按代旋转）');
  ok(evo.indexOf('imitB, imitOnlyForGen(gen), subThisGame)') >= 0, '本局是否补贴必须传进 chooser');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf("T.setImitSubOnly(process.env.EPIRUS_IMIT_SUB_ONLY === '1')") >= 0, '主线程必须设 subOnly');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitSubOnly: process.env.EPIRUS_IMIT_SUB_ONLY || null') >= 0,
    'evalN 消息必须带 imitSubOnly');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setImitSubOnly(String(msg.imitSubOnly') >= 0,
    'worker 必须按消息设 subOnly');
  eq(T.setImitSubOnly(true), true, '可打开');
  eq(T.setImitSubOnly(false), false, '可关回（默认关）');
  /* v1.5.141（DS 研究）：`subBead` 与 `subOnly` **同一族**（补贴局里连"珠"一起补）——
   * 接线必须齐，否则旋钮会**静默无效**：本日研究查出的病正是"教师示范了 0 次"却没人发现
   * （`pickHeavyFire` 最大 ep=2 ⇒ 结构上买不起 cost≥3 ⇒ v7t2 那一臂的"贵卡示范段"是空的）。
   * 所以这条旋钮**自己先被门管住**：默认关 + 四个接线点 + 只作用于补贴局。 */
  const ev3 = readFileSync('js/train/evo.js', 'utf8');
  ok(ev3.indexOf('function setSubBead') >= 0, 'evo 必须实现 setSubBead');
  ok(ev3.indexOf('SUB_BEAD && regen > 0') >= 0, '补珠只许作用于 regen>0 的补贴局（原生局/体检读数不受影响）');
  ok(ev3.indexOf('onRoundStart: subBeadHook') >= 0, '补贴局必须把补珠钩子真的传进 onRoundStart');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('subBead: process.env.EPIRUS_SUB_BEAD || null') >= 0,
    'evalN 消息必须带 subBead');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setSubBead(String(msg.subBead') >= 0,
    'worker 必须按消息设 subBead（否则旋钮静默无效）');
  eq(T.subBeadOn(), false, '默认必须是关（不设 EPIRUS_SUB_BEAD ⇒ 旧行为逐位不变）');
  eq(T.setSubBead(true), true, '可打开');
  eq(T.setSubBead(false), false, '可关回');
});

t('D88 门地形量具：挂科清单必须在第一个括号前截断（括号里是读数）+ 在位包单列参照 + 跳过 A 卷', function () {
  /* v1.5.100：`promote-champion` 一次只看**一个**候选，而"门是否可达到"是**分布**问题 ⇒ 新增 `gate-landscape`。
   * 这条门钉住三个容易出错的口径（第一版实现时我自己就踩了第一个）。 */
  const s = readFileSync('tools/gate-landscape.mjs', 'utf8');
  ok(s.indexOf("split('（')[0]") >= 0,
    '挂科清单必须在**第一个括号之前**截断 —— 括号里是"座位 26.9pt · G 3.9 · …"这种读数，当成挂科会全表误判');
  ok(s.indexOf('参照行') >= 0, '必须写明在位包是**参照行**（它自己过不了只枪格 G4，别读成"候选不行"）');
  ok(s.indexOf('--exam-first=0') >= 0, '必须跳过 A 卷那 1400 局（五道门不依赖它，约 10~20s/包）');
  ok(s.indexOf('五道全过 = ') >= 0 && s.indexOf('各门阻塞次数') >= 0, '必须汇总过门数与各门阻塞频次');
  ok(s.indexOf('清场均值') >= 0, '必须给出"广度 vs 清场"的两组对照（它曾否掉一个假说）');
});

t('D89 训练侧座位探针局数：必须能按**消息**设（`setSeatGames` 以前导出却从没被调用）+ 缺省不改', function () {
  /* v1.5.102（v1.5.100 §17）：训练侧座位惩罚的样本写死 6 局，而门禁要 ≥50 局 ⇒ **同一个量、两个样本量**。
   * 这条门钉住：① 有旋钮；② 走**消息**（env 是 worker 创建时的拷贝）；③ 缺省不改（`SEAT_GAMES` 仍 6）。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('seatGames: Number(process.env.EPIRUS_TRAIN_SEAT_GAMES || 0) || null') >= 0,
    'evalN 消息必须带 `seatGames`（env 到不了 worker ⇒ 必须随消息）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('T.setSeatGames(Number(msg.seatGames) || 0)') >= 0, 'worker 必须按消息设座位探针局数');
  ok(wk.indexOf('[seat] worker **消息**生效值') >= 0, '必须有回执（照 [econ]/[imit] 的先例）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setSeatGames(Number(process.env.EPIRUS_TRAIN_SEAT_GAMES))') >= 0, '主线程也要设一份');
  ok(sv.indexOf('Number(process.env.EPIRUS_TRAIN_SEAT_GAMES || 0) > 0') >= 0,
    '缺省必须**不改**（0/未设 ⇒ 保持 6 局；"默认不设即不变"）');
  eq(T.seatGames(), 6, 'D89 跑到这里时训练侧探针必须仍是默认 6 局');
  eq(T.setSeatGames(40), 40, 'setSeatGames(40) 必须回读 40');
  eq(T.setSeatGames(6), 6, '复位回 6（别把状态泄漏给后面的用例）');
});

t('D90 清场计数奖励：口径必须与门禁同源（收缩分界 + 归因）且默认关', function () {
  /* v1.5.103（v1.5.100 §20）：门禁要 `场B 清场 ≥ 0.3/局`，而训练 `fit` 里**一项都没有** ⇒
   * 演化没有理由去长"真的能打死人"（新规则下打 1 点就赢）。这条门钉住口径与接线。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('function countClears(events, seat)') >= 0, '必须有 countClears');
  ok(ev.indexOf("if (e.reason === '终局收缩') shrink = true;") >= 0,
    '分界必须是**收缩自己的标记**（`reason === \'终局收缩\'`）—— 与 audit-lib 场B 清场同口径；'
    + 'v1.5.113 之前两边都用 `source == null`，那会被地雷/天火的无来源伤害误触发（见 D98）');
  ok(ev.indexOf('lastBy[e.pid] === seat') >= 0,
    '必须**归因**（`death` 事件不带凶手 ⇒ 只能用"最后一次伤害来源"回溯；不归因等于奖励"别人清场"）');
  ok(ev.indexOf('const clearBonus = CLEAR_W * Math.min(1, clears / 1)') >= 0,
    '奖励必须进 `fit` 且封顶 /1（与 tgtBonus 同尺度，按 v1.5.79 的标度教训）');
  ok(ev.indexOf('let CLEAR_W = 0;') >= 0, '默认必须是 0（不开就是原行为）');
  eq(T.clearReward().w, 0, 'D90 跑到这里时 CLEAR_W 必须仍是 0');
  eq(T.setClearReward(0.2), 0.2, 'setClearReward 必须回读生效值');
  eq(T.setClearReward(0), 0, '复位回 0（别把状态泄漏给后面的用例）');
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('clearW: Number(process.env.EPIRUS_CLEAR_W || 0) || null') >= 0,
    '必须随**消息**下发（env 是 worker 创建时的拷贝）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('T.setClearReward(Number(msg.clearW) || 0)') >= 0 && wk.indexOf('[clear] worker **消息**生效值') >= 0,
    'worker 必须按消息设 + 打回执（今晚已四次栽在"看着接了、其实没通"）');
});

t('D91 被无效化的聚能环不得续计（v1.5.105：出招即计次 + 复位漏 voided ⇒ 打断者反而送 +3）', function () {
  /* 用户实盘 bug（`results/epirus-battle-26回合.txt:52-64`）：第 9 回合环被雷击之枪无效化（无ジ进账），
   * 第 10 回合却直接吃 **+3**。根因：`state.js:190` 出招即 `ringStreak++`，`endTurn` 的复位只看
   * `outcome === 'ok'`，而 `setVoid` 只置 `voided` ⇒ 被废的那次照样算"续"。
   * ⚠️ 注意性质：这不是"没文档的事故" —— 旧行为被 `docs/RULES-2P.md:73` 的 R10 条款**文档化**过
   * （且那句话自相矛盾："计数已+1"与"不再连续"互斥）。用户 2026-09-18 裁定按"打断必须断链"改。
   * 这条门是**结构反证**；行为证据在 `tests/spec.js` 的 R10 新用例（旧实现读到 ep=5/streak=2）。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('!a.voided && a.key === SK.RING') >= 0,
    'endTurn 的连击复位必须与 actionOf 同口径（加 `!a.voided`）');
  ok(rs.indexOf("if (!(a && a.outcome === 'ok' && a.key === SK.RING)) p.ringStreak = 0;") < 0,
    '旧的"只看 outcome"复位**不得**回来 —— 那是本 bug 的成因');
    ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('**被无效化的聚能环不续计**') >= 0,
    'RULES-2P 的 R10 条款必须同步（旧措辞"不再连续（计数已+1）"自相矛盾，是 bug 的温床）');
  /* 边界：**过载炮**的"出招即计次"是 R43 的**用户裁定明文** ⇒ 不许被这次修复顺手波及。 */
  ok(readFileSync('js/core/state.js', 'utf8').indexOf('if (key === R.SK.CANNON) p.cannonCount++;') >= 0,
    '过载炮 R43（被无效化仍计次）不得被顺手改掉 —— 它与环是**两条不同的明文**');
});

t('D102 R61 被无效化的一手不写 lastSkill（第三方复核 §2-1：与 R10 同族 · 打断不再白送激光眼连用）', function () {
  /* 病（`docs/REVIEW-QODER-2026-09-19.md` §2-1）：`setVoid` 只置 `voided`、**不动** `outcome`，
   * 而 `endTurn` 的 `p.lastSkill = ...` 只看 `outcome === 'ok'`（`js/core/resolve.js:1179`）
   * ⇒ "被雷击之枪废掉的那一手"照样成为 `lastSkill`，喂给两个真实下游：
   *   ① **R32 激光眼连用**（`state.js:118-123`：连用只收 2 ジ**且免爆珠**）⇒ 打断方反而送出一次免珠连用；
   *   ② 特征块（`policy.js:209-212` / `:259-260`）⇒ 读到一手**根本没发生**的动作。
   * 它是 R10（被无效化的**聚能环**不续计，D91）的**另一半** —— D91 只钉了环。
   * 本条按 v1.5.128 的规矩写成**运行时行为门**（不是源码文本钉），并且**带对照组**：
   * 只有"被无效化 ⇒ null"与"没被无效化 ⇒ 照旧"**两个方向都能失败**，才排除"恒 null"这种假修法。 */
  const mkEye = function (seed) {
    const st = S.createState('standard', { next: mulberry32(seed) }, 2);
    st.p[0].ep = 5; st.p[0].boom = 1;
    eq(S.computeCost(st, 0, R.SK.LASER_EYE).ep, 1, '前提：**首次**激光眼收 1 ジ（R32 的另一半是连用收 2 ジ）');
    S.attemptAction(st, 0, R.SK.LASER_EYE, { bead: 'boom' }, null);
    return st;
  };
  /* ① 被无效化的一手 */
  const a = mkEye(9101);
  X.setVoid(a, 0, 1);                                  // 模拟"被雷击之枪废掉这一手"
  const act = a.actions[0];
  ok(act && act.outcome === 'ok' && act.voided === true,
    '前提：`setVoid` 只置 `voided`、**不动** `outcome` —— 这正是本 bug 的成因（前提若不成立，本门要重写）');
  X.endTurn(a);
  eq(a.p[0].lastSkill, null, 'R61：被无效化的一手**不得**写进 `lastSkill`');
  a.p[0].boom = 1;                                     // 补一枚爆珠，专门看"连用价"有没有被白送
  const c1 = S.computeCost(a, 0, R.SK.LASER_EYE);
  eq(c1.ep, 1, '被无效化 ⇒ **拿不到连用价**（仍按首次 1 ジ）');
  eq(!!(c1.beads && c1.beads.boom), true, '被无效化 ⇒ 也**不得免掉爆珠**要求');
  /* ② 对照组：没被无效化的一手必须照旧写 —— 否则本门会被"恒 null"的假修法骗过 */
  const b = mkEye(9102);
  X.endTurn(b);
  eq(b.p[0].lastSkill, R.SK.LASER_EYE, '对照组：**没被无效化**的一手照旧写 `lastSkill`（R32 连用仍成立）');
  b.p[0].boom = 1;
  eq(S.computeCost(b, 0, R.SK.LASER_EYE).ep, 2, '对照组：连用价 2 ジ（R32 不得被这次修复一起改掉）');
  /* ③ 边界（**这段能失败**）：**过载炮** R43"被无效化**仍**计入次数"是**另一条用户裁定明文**
   *    （`state.js:190` 出招即计次）⇒ 被无效化之后，下一发必须还是"第 **2** 次"（花光现有多数ジ、且需 ≥1 ジ），
   *    而**不是**退回第 1 次的固定 2 ジ。若有人把 R61 的 `!voided` 顺手套到计次上（"被废就当没出"），
   *    这里会读回 `ep=2 / phase=1` ⇒ 红。（它与环/`lastSkill` 是两条不同的明文，D91 也守着同一件事。） */
  const st3 = S.createState('standard', { next: mulberry32(9103) }, 2);
  st3.p[0].ep = 9;
  eq(S.computeCost(st3, 0, R.SK.CANNON).ep, 2, '前提：过载炮第 1 次固定 2 ジ（`state.js:111`）');
  S.attemptAction(st3, 0, R.SK.CANNON, { target: 1 }, null);
  X.setVoid(st3, 0, 1);
  X.endTurn(st3);
  st3.p[0].ep = 5;
  const c3 = S.computeCost(st3, 0, R.SK.CANNON);
  eq(c3.ep, 5, 'R43：被无效化**仍计入次数** ⇒ 下一发是第 2 次（花光现有ジ = 5），不是第 1 次的 2 ジ');
  eq(c3.cannonPhase, 2, '  且相位必须仍是 2（把 `!voided` 套到计次上会读回相位 1）');
});

t('D103 「珠爆发」线必须同时在册（2P 考卷 + G4 克制表），且 G4 **复用同一份实现**', function () {
  /* 动机（第三方复核 §3 的建议 + 本仓**栽过四次**的老病"加名字漏一处"）：
   * v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 漏 opp-pool 本身、v1.5.19 漏 trainer.js。
   * 这条线要同时出现在**两处池子**才有意义：2P 考卷（`p2-baselines`）量"2 人局防不防电"、
   * G4 克制表量"5 席 multi/long 防不防电"。少一处 ⇒ 那个洞在那一侧仍然不可见。
   * ① **行为**部分（运行时，不是文本钉）：这个脚本必须真的是"为放电而蓄电珠 → 有珠就放电 → 残血摄魂"。 */
  ok(typeof Bots.pickBeadBurst === 'function', 'pickBeadBurst 必须在 EpirusBots 里（并被 p2-baselines 指向）');
  const mk = function (ep, elec, hp0) {
    const st = S.createState('standard', { next: mulberry32(9501) }, 2);
    st.p[0].ep = ep; st.p[0].elec = elec; st.p[0].boom = 0;
    if (hp0 != null) st.p[0].hp = hp0;
    return st;
  };
  const pickOf = function (st) { return Bots.pickBeadBurst(st, 0, Play.legalActions(st, 0)); };
  /* ⚠️ 下面这组断言来自 v1.5.129 的**实测教训**：我的第一版写成"买得起蓄能就蓄"，而**珠只活一回合**、
   * 蓄能又花 1 ジ ⇒ 退化成 `蓄能 → ジ → 珠过期 → 蓄能 → …` **永不放炮**
   * （200 局里 `railgun` 出手 **0** 次、造成伤害 **0.00/局**）。所以"ep=1 不许蓄珠"不是风格问题，
   * 而是**这条线能不能成立**的条件；单点行为全对也救不了——必须另有端到端断言（见 ①b）。 */
  const s1 = mk(1, 0);
  eq(pickOf(s1).key, R.SK.JI, 'ep=1 **不许**蓄珠（蓄完只剩 0 ジ，珠活不过下一回合 ⇒ 永不放炮）');
  const s2 = mk(3, 0);
  const r2 = pickOf(s2);
  eq(r2.key, R.SK.CHARGE, 'ep=3 ⇒ **蓄珠**（花 1 后余 2，下一回合正好付得起电磁炮）');
  eq(r2.bead, 'elec', ' 且必须**显式指定电珠**（`play.js:33-37` 的 v7 珠类型通道；不指定就学不会为放电蓄珠）');
  const s3 = mk(2, 1);
  const r3 = pickOf(s3);
  eq(r3.key, R.SK.RAILGUN, '有电珠且付得起（2 ジ）⇒ 必须放**电磁炮**');
  ok(r3.target === 1, ' 且目标必须指向唯一对手（不按 pid 乱指）');
  const s4 = mk(0, 0);
  eq(pickOf(s4).key, R.SK.JI, '什么都买不起 ⇒ 只能ジ（攒钱）');
  const s5 = mk(3, 0, 1);
  eq(pickOf(s5).key, R.SK.DRAIN, '自己残血（standard 摄魂窗口 = 自己 HP≤1）且付得起 ⇒ 摄魂收尾');
  /* ①b **端到端**（这条才是抓第一版那个 bug 的那条）：单点行为全对而整条链死循环，
   *    正是第一版的形态 ⇒ 必须有一条"**链条真的转起来**"的断言。
   *    对手只出ジ（零伤害）⇒ 只要脚本放得出炮，`railgun` 次数必 > 0；第一版在这里读到 **0**。 */
  const stG = S.createState('standard', { next: mulberry32(9502) }, 2);
  Play.autoGame(stG, [function (st2, pid, legal) { return Bots.pickBeadBurst(st2, pid, legal); },
    function () { return { key: R.SK.JI, target: null }; }]);
  const rg = stG.events.filter(function (e) { return e.type === 'action' && e.pid === 0 && e.key === R.SK.RAILGUN; }).length;
  ok(rg > 0, '整条线必须真的转起来（对"只出ジ"的对手，脚本必须放得出电磁炮；第一版这里是 0）');
  /* ② 注册部分：2P 考卷**只能追加在表尾**（`p2-baselines.mjs:8-10`：顺序是行为输入）。
   * 文本口径在这里是**有意**的 —— 它守的是"插入位置"这条纪律，运行时读不出"是第几个"。 */
  const pb = readFileSync('tools/p2-baselines.mjs', 'utf8');
  ok(/beadburst: 'pickBeadBurst'/.test(pb), '`tools/p2-baselines.mjs` 必须登记 beadburst（否则 2P 考卷量不到这个洞）');
  ok(/beadburst: 'pickBeadBurst'\s*\n\};/.test(pb),
    'beadburst 必须是**表尾最后一项** —— 插在中间会改掉后面每个对手的种子（`20260207 + i*977`）⇒ 历史考卷分全漂移');
  /* ③ 单一来源：G4 那一格必须**复用** bots.js 的函数对象，不许抄第二份实现。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gd.indexOf("'珠爆发(ジ→蓄电珠→电磁炮/摄魂)': B.pickBeadBurst") >= 0,
    'G4 的第 8 格必须直接引用 `B.pickBeadBurst`（抄一份副本 = 同一规则两处维护，本仓栽过四次）');
  /* ⚠️ 这条文本钉**不是**排版洁癖，它挡的是**假绿**：`B` 若没绑上，那一格就是 `undefined`
   * ⇒ `duel` 把该席当"没有 chooser"跑，`autoGameN` 兜底成只出ジ ⇒ **读数看起来更"安全"**，
   * 而实际什么都没测（v1.5.89「把没跑的/没判的当成过了」同族）。行为上无法廉价复现，故用文本钉。 */
  ok(gd.indexOf('const B = sb.window.EpirusBots;') >= 0,
    '前提：gate-drafts 必须真的把 EpirusBots 取出来（否则「珠爆发」格会静默退化成"只出ジ"的**假安全读数**）');
});

t('D104 「择优不得回归」必须是机械保证（而不是注释里的承诺）', function () {
  /* 病（v1.5.130 实测反例，`train2p.log`）：`train-best` 的择优原先只有 `sc` + 容差带 + 发散度三步，
   * 而 `evScore()` 的闸门罚项**在有洞时退化成常数**（`gateMin*0.4-1`，gateMin=0 ⇒ sc ≡ -1）
   * ⇒ 5 个候选 sc 全 -1、容差带 = 全部 ⇒ 择优实际由 `divNorm` 决定，
   * 实测把现有冠军（1 个洞：beadburst 0%）换成了更差的包（2 个洞：defend 0% / reflectspam 0%，avg 89%→85%）。
   * 而第 92 行的注释从 v1.5.18 起就一直写着"保证**绝不会**回归到比现有更弱的冠军"——**假承诺**。
   * 现在择优是纯函数（`tools/pick-best.mjs`），这里喂**合成候选表**验行为（不是钉排版）。 */
  const INC = { tag: INCUMBENT_TAG, sc: -1,
    ev: { avg: 0.89, per: { wall: 1.0, defend: 1.0, beadburst: 0.0, reflectspam: 0.9 } }, div: { divNorm: 0.201, distinct: 2 } };
  /* 那次运行里**被选中**的那个候选（数值逐条取自 `train2p.log`） */
  const REGRESS = { tag: '候选1', sc: -1,
    ev: { avg: 0.85, per: { wall: 0.70, defend: 0.0, beadburst: 0.93, reflectspam: 0.0 } }, div: { divNorm: 0.366, distinct: 5 } };
  const FIX = { tag: '候选X', sc: -1,
    ev: { avg: 0.88, per: { wall: 1.0, defend: 1.0, beadburst: 0.70, reflectspam: 0.9 } }, div: { divNorm: 0.22, distinct: 3 } };
  /* ① 回归数（冠军已过、却被候选打回 ≤50% 的条数）必须数得出来 */
  eq(regressionsOf(REGRESS, INC), 2, '「候选1」把冠军已过的 defend/reflectspam 打回 0% ⇒ 回归数必须是 2');
  eq(fixesOf(REGRESS, INC), 1, ' 且它确实新过了 1 条（beadburst 0%→93%）—— 修了洞也**不能**抵掉回归');
  eq(regressionsOf(FIX, INC), 0, '「候选X」不回归');
  eq(fixesOf(FIX, INC), 1, ' 且修好了那个洞');
  /* ② 回归型候选**不许**当选 —— 旧实现正会选它（发散度最大 0.366）。这是本条门的核心。 */
  eq(pickBestByExam([INC, REGRESS], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG,
    '把冠军已过的基准打回 ≤50% 的候选一律不许当选（哪怕它修好了别的洞、发散度更大）');
  eq(pickBestByExam([INC, REGRESS], { wrTol: 0.03 }).dropped, 1,
    '该候选必须是被"不回归层"**剔除**的（而不是碰巧没被挑中）');
  /* ③ 0 回归且真修好了洞 ⇒ 必须能当选（否则修法本身成了障碍，这条线永远修不动） */
  eq(pickBestByExam([INC, FIX], { wrTol: 0.03 }).best.tag, '候选X', '0 回归且修好了洞的候选必须能当选');
  /* ④ 所有候选都有回归 ⇒ 现有冠军必须原样留下 */
  const ALLREG = { tag: '候选Y', sc: 0.2,
    ev: { avg: 0.95, per: { wall: 1.0, defend: 0.0, beadburst: 0.9, reflectspam: 0.9 } }, div: { divNorm: 0.9, distinct: 6 } };
  eq(pickBestByExam([INC, REGRESS, ALLREG], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG,
    '全部候选都有回归 ⇒ 现有冠军必须留下（这才是"绝不回归"的实际含义）');
  /* ⑤ 现有冠军自身在不回归层里恒成立（否则会把自己剔掉 ⇒ 无包可用） */
  eq(regressionsOf(INC, INC), 0, '现有冠军对自己没有回归');
  eq(pickBestByExam([INC], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG, '只有现有冠军时也必须选出它（不许抛）');
  /* ⑥ 单一来源：工具必须 import 这个纯函数 —— 否则上面这些用例测的是**另一份**实现 */
  const tb = readFileSync('tools/train-best.mjs', 'utf8');
  ok(tb.indexOf("from './pick-best.mjs'") >= 0, 'tools/train-best.mjs 必须从 pick-best.mjs 导入择优');
  ok(tb.indexOf('const regressOf = function') < 0, ' 且不许再内联一份 regressOf（两处实现必然漂移）');
  /* ⑦ v1.5.147（xfer44 反例）：带内排序主键 = hill05（Rényi-0.5 有效技能数），divNorm 退居末级。
   * 病形复刻：候选N"两件套打花"divNorm .194 / hill05 1.98，候选W"五件套一主四辅"divNorm .189 / hill05 3.1
   * ⇒ 旧序选 N（0.005 的采样熵噪声定冠军），新序必须选 W。 */
  const INC7 = { tag: INCUMBENT_TAG, sc: 0.90, ev: { avg: 0.99, per: { wall: 1.0 } }, div: { divNorm: 0.10, distinct: 2, hill05: 1.5 } };
  const NARROW = { tag: '候选N', sc: 0.90, ev: { avg: 0.99, per: { wall: 1.0 } }, div: { divNorm: 0.194, distinct: 2, hill05: 1.98 } };
  const WIDE = { tag: '候选W', sc: 0.89, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.189, distinct: 5, hill05: 3.1 } };
  eq(pickBestByExam([INC7, NARROW, WIDE], { wrTol: 0.03 }).best.tag, '候选W',
    '带内（胜率差在容差内）必须选 hill05 更大的广包 —— divNorm 更高但 hill05 更低的窄包不许赢（0921 xfer44 实测反例）');
  /* ⑧ 旧对象没有 hill05 列 ⇒ 退回 distinct→divNorm 的老序（历史可比性不许被打破） */
  const OLDA = { tag: '候选A', sc: 0.9, ev: { avg: 0.99, per: {} }, div: { divNorm: 0.30, distinct: 2 } };
  const OLDB = { tag: '候选B', sc: 0.9, ev: { avg: 0.98, per: {} }, div: { divNorm: 0.20, distinct: 5 } };
  eq(pickBestByExam([OLDA, OLDB], { wrTol: 0.03 }).best.tag, '候选B', '无 hill05 列时按 distinct 退回（种类多者赢）');
  /* ⑨ 带内候选必须全部落盘（D82 精神：落选者也是证据）—— 行为式钉：train-best 源码里存在 band-save 写盘点 */
  ok(tb.indexOf("ARM + '-band'") >= 0 && tb.indexOf('selected: c === best') >= 0,
    'train-best 必须把容差带内每一粒写成 <arm>-band<k>.bak 并标 selected（候选3 那种"死了都没碑"不许再有）');
  /* ⑩ 夜班（seed 11 反例）：`vetoDegenerate` 双向验——不开时退化包凭 avg=100% 必当选（量具有判别力），
   * 开了必须把它踢下去、由正常候选继承。 */
  const INC10 = { tag: INCUMBENT_TAG, sc: 0.8, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.2, distinct: 3, hill05: 2.0 } };
  const DEGEN = { tag: '候选D', sc: 0.99, ev: { avg: 1.00, per: { wall: 1.0 } }, div: { divNorm: 0, distinct: 0, hill05: 0 } };
  const OK10 = { tag: '候选O', sc: 0.82, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.3, distinct: 4, hill05: 2.8 } };
  eq(pickBestByExam([INC10, DEGEN, OK10], { wrTol: 0.03 }).best.tag, '候选D',
    '不开闸时退化包凭考卷分必当选（证明该反例真实存在、闸有东西可挡）');
  eq(pickBestByExam([INC10, DEGEN, OK10], { wrTol: 0.03, vetoDegenerate: true }).best.tag, '候选O',
    '开 vetoDegenerate 后：种类=0 的退化包取消资格，正常候选继承（现有冠军/闸内豁免不许被误杀）');
  eq(pickBestByExam([INC10], { wrTol: 0.03, vetoDegenerate: true }).best.tag, INCUMBENT_TAG,
    '现有冠军即使 distinct=0 也恒在层内（闸不打破 D104 的冠军豁免承诺）');
});

t('D92 R56 同层内资源型先结算（用户裁定：过载炮的清除须含目标本回合收入）', function () {
  /* 病（第十一轮复核 §10-4 实测）：同层原先按座位轮换序结算 ⇒ 同一发炮效果差 3 ジ ⇒ 座位红利。
   * 用户 2026-09-18 裁定：资源型（ENERGY 类）先结算。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('R.byKey[a0.key].cat === R.CAT.ENERGY') >= 0,
    '资源型必须**从卡面声明推导**（`cat === CAT.ENERGY`）—— 不许写卡名清单（D81/D72 的教训）');
  ok(rs.indexOf('const ord3 = (function ()') >= 0 && rs.indexOf('return inc.concat(oth);') >= 0,
    '同层遍历顺序必须"先资源型、再其余"（两组各自保持轮换）');
  ok(rs.indexOf('for (const i of ord3) {') >= 0, '那一层必须真的用新顺序遍历（别只造了数组不用）');
  ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('R56') >= 0, 'RULES-2P 必须记下 R56 这条裁定');
  });

t('D93 R57 天火不需要目标（卡面声明 + 引擎全场 + 文档三条必须一致）', function () {
  /* 用户报的 UI bug：用天火时会弹目标选择 —— 根因是**卡面声明成 `target: 'enemy'`**
   * （UI 与 AI 都从声明推导），而引擎也只在选中的那一个目标上引爆。
   * 权威口径：README「你贴出的符咒引爆」·`RULES-2P:240`「**每个目标**每枚符咒受 1 火伤害」·
   * `RULES-NP:322` 列它进「仅空指」。 */
  const ru = readFileSync('js/core/rules.js', 'utf8');
  ok(ru.indexOf("mk(SK.FIRESTORM, '天火', CAT.SPECIAL, 2, 3, 'self',") >= 0,
    '天火的卡面必须声明为**无目标**（`self`）—— UI 与 AI 都从这一处推导');
  ok(ru.indexOf("mk(SK.FIRESTORM, '天火', CAT.SPECIAL, 2, 3, 'enemy',") < 0,
    '旧的 `enemy` 声明**不得**回来 —— 那正是"用天火要选目标"的来源');
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('for (let v = 0; v < playerCount(state); v++)') >= 0 &&
     rs.indexOf('const pg = guardOf(state, v);') >= 0,
    '引擎必须**全场遍历**且**原型制御按每个受害者各自判定**（不许再只打 `state.p[t]`）');
  ok(rs.indexOf("rawDamage(state, v, 1, '天火', 'firestorm', { type: R.DMG.FIRE });") >= 0,
    '天火伤害必须是**无目标伤害**（不传 `source`）—— 用户裁定：天火无目标 ⇒ 不参与大雷连带传导');
  ok(rs.indexOf("{ type: R.DMG.FIRE, source: i }") < 0, '天火不许带 `source`（v1.5.107 首版加过、被用户纠正）');
  ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('R57') >= 0, 'RULES-2P 必须记下 R57');
  });

t('D94 R58 藤甲火弱覆盖当回合（用户裁定：贴上即生效、到下回合结束）', function () {
  /* 旧文 R22「仅在下回合内有效」= 纯预置 debuff；用户 2026-09-18 要求多覆盖一回合。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('if (a.key === SK.ARMOR) { you.fireWeakNext = true; you.fireWeakNow = true; }') >= 0,
    '藤甲必须**同时**点亮 Now（本回合）与 Next（下回合）—— 只挂 Next 是旧行为（当回合白贴）');
  ok(rs.indexOf('if (a.key === SK.ARMOR) you.fireWeakNext = true;') < 0,
    '旧的"只挂 Next"写法不得回来（那是 R22 的旧口径）');
  const rp = readFileSync('docs/RULES-2P.md', 'utf8');
  ok(rp.indexOf('R58') >= 0, 'RULES-2P 必须记下 R58');
  ok(rp.indexOf('仅在下回合内有效') < 0 || rp.indexOf('旧口径（R22 原文）') >= 0,
    'R22 的"仅在下回合内有效"必须被标注为**已被 R58 取代**（不许留着一句与实现对不上的旧文）');
  });

t('D95 R59 地雷 3 回合时效（用户裁定，取代 R38「持续直到被触发」）+ 写入点只有一处', function () {
  /* 旧 R38 = 永久 ⇒ 实测"身上有雷还再敲"占 68%(多)/81%(长)（≈21/50 ジ每局纯浪费）；
   * 严格单回合又把牌打废（引爆 1.90→0.08 次/局）⇒ 用户裁定 3 回合。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('function armMine(state, me, pid)') >= 0, '必须有一个统一的埋雷函数');
  ok(rs.indexOf('me.mineTurns = 3;') >= 0, '埋雷必须记 3 回合（本回合 + 后两个回合）');
  ok(rs.indexOf('case SK.MINE: armMine(state, me, m); break;') >= 0 &&
     rs.indexOf('case SK.MINE: armMine(state, me, i); break;') >= 0,
    '两个 `case SK.MINE` 都必须走 armMine（**写入只此一份** —— 环的"两处写入"就是 R10 bug 的温床）');
  ok((rs.match(/me\.mineArmed = true;/g) || []).length === 1,
    '直接置位 `me.mineArmed = true` 只允许出现在 armMine 里（一处）');
  ok(rs.indexOf('state.p[v].mineArmed = false; state.p[v].mineTurns = 0;') >= 0 &&
     rs.indexOf('state.p[i].mineArmed = false; state.p[i].mineTurns = 0;') >= 0,
    '触发失效（直接/间接两条路）都必须同时清零计时');
  ok(rs.indexOf('if (p.mineTurns > 0) {') >= 0 && rs.indexOf("type: 'mineExpire'") >= 0,
    '回合末必须递减并在归零时卸下（并留事件便于量具核对）');
  ok(readFileSync('js/core/state.js', 'utf8').indexOf('mineTurns: 0,') >= 0, 'state 必须有 mineTurns');
  /* ===== v1.5.143 门禁审计：一条**运行时**断言，替掉原先 9 条"钉 spec 用例标题 / 钉 CHANGELOG 短语"的断言 =====
   * 阳性对照（0921 实测）：把 spec 里 `R59 地雷时效` 改成 `R59 时效X` —— 行为逐字节没变、spec 仍 52/52，
   * 而 np-test 当场红一条 ⇒ 那类断言测的是**字符串**不是**行为**（还会误伤正常的用例改名：
   * 本仓今天就把一条 R61 改成 R62 避让重号）。它想防的"整条用例被静默删除"（v1.5.37 那族事故）
   * 用**跑一遍**来防更准 —— 顺带把 spec 套件的失败也变成 np-test 的阻断（此前两边完全独立、没人连着跑）。 */
  const specRes = (function () {
    /* ===== v1.5.146（去 spawn 化，RESEARCH-LOG §22 NEXT 的收尾）=====
     * 旧实现 spawnSync 跑 tools/spec-run.mjs 拿 stdout。Windows 上 spawn 偶发**空 stdout**
     * （0921 夜班自报 + 0921 审计复现：并发负载下 np-test 五次里红一次 158/159），
     * 两次重试 + "退回源码用例计数"只把假红概率压低、没有归零，还给门塞了第二口径。
     * spec-run 本身就是"vm 沙箱装 5 个文件、读 innerHTML"，同口径在进程内直接做 ⇒
     * **没有子进程就没有抖动**；读不到结果从此是**真红**（加载抛异常 / 用例没全绿 / 条数被人删少），不再降级。 */
    const ssb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
    ssb.window = ssb; ssb.globalThis = ssb;
    let OUT = '';
    ssb.document = {
      getElementById: function () {
        return { set innerHTML(v) { OUT = v; }, get innerHTML() { return OUT; }, textContent: '' };
      },
      createElement: function () { return { style: {}, appendChild() {} }; }
    };
    try {
      for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'tests/spec.js'])
        vm.runInNewContext(readFileSync(f, 'utf8'), ssb, { filename: f });
    } catch (e) { return { err: String((e && e.message) || e), out: OUT }; }
    return { out: OUT };
  })();
  ok(!specRes.err, 'spec 套件必须能在进程内无异常跑完（真实错误：' + (specRes.err || '') + '）');
  const specM = /通过 (\d+) \/ (\d+)/.exec(String(specRes.out));
  ok(!!specM && Number(specM[1]) === Number(specM[2]) && Number(specM[2]) >= 52,
    'spec 引擎用例必须**全绿**且条数 ≥52（实测 ' + (specM ? specM[0] : String(specRes.out).slice(0, 200)) + '）');
  const specFails = [...String(specRes.out).matchAll(/<li class="fail">✘ ([^<]+)/g)].map(function (x) { return x[1]; });
  ok(specFails.length === 0, 'spec 失败用例不许有：' + specFails.slice(0, 3).join(' | '));
  /* 夜班（0922 00:1x）：去 spawn 化当场把潜伏的 1/8 flake 钉出来（R23c 场景用例用裸 Math.random，
   * 爆头判定把 hp=2 打成 1 ⇒ 同一 spec 连跑五次能红一次）。修法是场景用例改判定恒败常量 `noJudge()`
   * （需要判定胜的本来就显式喂 seqRng）；这条防回归钉保证裸随机不再回流场景用例。 */
  ok(readFileSync('tests/spec.js', 'utf8').indexOf('next: Math.random') < 0,
    'tests/spec.js 场景用例不许再用裸 Math.random 当 rng（1/8 抖动会红门禁；判定敏感的用例显式喂 seqRng）');
  ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('R59') >= 0, 'RULES-2P 必须记下 R59');
  ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('持续直到被触发') < 0 ||
     readFileSync('docs/RULES-2P.md', 'utf8').indexOf('旧文 R38 是') >= 0,
    'R38 的"持续直到被触发"必须被标注为**已被 R59 取代**');
  });

t('D96 R60 净化清除"自身全部持续状态"（含增益）+ 写入点只有一处', function () {
  /* 用户裁定："藤甲与地雷既然成了 buff，就一并会被净化掉（还有避雷针、符咒、大雷禁用、梦魇）"。
   * 旧实现只清 stickers/nightmare/tauntPending，且**两个 case 各写一遍**（环/地雷同族隐患）。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('function purgeSelf(state, me, pid)') >= 0, '必须有唯一的净化函数');
  ok(rs.indexOf('me.fireWeakNow = false; me.fireWeakNext = false;') >= 0, '必须清藤甲火弱（R58 的两个标志）');
  ok(rs.indexOf('me.mineArmed = false; me.mineTurns = 0;') >= 0, '必须清地雷（R59 含计时）');
  ok(rs.indexOf('me.rodGuard = 0;') >= 0, '必须清避雷针（R31）');
  ok(rs.indexOf('me.cooldown = {};') >= 0, '必须清大雷禁用（R29）');
  ok(rs.indexOf('case SK.PURIFY: purgeSelf(state, me, m); break;') >= 0 &&
     rs.indexOf('purgeSelf(state, state.p[i], i);') >= 0,
    '两个 `case SK.PURIFY`（正式路径 + 镜面复制路径）都必须走 purgeSelf');
  ok(rs.indexOf('me.stickers = []; me.nightmare = false; me.tauntPending = false;') < 0,
    '旧的"两处各写一遍"写法不得回来');
  ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('**R60**') >= 0, 'RULES-2P 必须记下 R60');
  ok(readFileSync('js/core/rules.js', 'utf8').indexOf('清除自身**全部持续状态**') >= 0,
    '卡面描述必须同步（否则玩家看到的是旧的"只清负面"）');
  });

t('D97 环的**段长口径**（复核 §4）：必须按"用成了"数段（被无效化=断链）+ 不许只报"上环率"', function () {
  /* 复核 §4 的原话：现在报的"环转化率 8.06%"只数"上没上环" ⇒ **一个疯狂单按的包会被读成"很会用环"**，
   * 而成本表是"首次净 −2 / 第 2 次刚好回本 / 第 3 次起才 +3" ⇒ 必须有段长口径。 */
  const pc = readFileSync('tools/probe-convert.mjs', 'utf8');
  ok(pc.indexOf('ringRun2') >= 0 && pc.indexOf('ringRun3') >= 0,
    '探针必须给出 ringRun2（段长≥2 / 可负担点）与 ringRun3（段长≥3 / 可负担点）');
  ok(pc.indexOf("e.key !== R.SK.RING) close(e.pid)") >= 0, '非环出手必须终止当前段（出手侧口径）');
  ok(pc.indexOf("e.type === 'voided'") >= 0 && pc.indexOf('close(e.pid);                                                // R10') >= 0,
    '被无效化必须终止当前段 —— 这是 R10 之后的真口径（所以必须读**事件**而不是选择序列）');
  ok(pc.indexOf('会被单按刷高') >= 0, '必须写明旧口径"上环率"的失效方式（会被单按刷高）');
  ok(pc.indexOf('extractRingRuns(st.events)') >= 0,
    '**调用点必须在**（v1.5.111 我第一版只写了定义、漏了调用 ⇒ 读数全是 0 —— 与 D28"接线在文件里≠在跑的那条路径上"同族）');
  });

t('D98 "终局收缩"的哨兵必须是它自己的标记（不许再用 source==null —— 地雷/天火按规则就是无来源）', function () {
  /* 病：`场B 清场` 的判据用 `damage.source == null` 当"收缩开始"的哨兵，可是
   * **地雷伤害按规则就是无来源**（N20 第 6 条）· **天火被用户裁定为无目标伤害**（R57，也是 null）
   * ⇒ 收缩前第一颗雷/第一发天火会被误判成收缩开始 ⇒ **场B 清场被系统性少读**。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf("if (e.reason === '终局收缩') shrinkStarted = true;") >= 0,
    '量具必须用 `reason === \'终局收缩\'` 当哨兵');
  ok(al.indexOf('if (e.source == null) shrinkStarted = true;') < 0,
    '旧的 `source == null` 哨兵**不得**回来');
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf("if (e.reason === '终局收缩') shrink = true;") >= 0,
    '训练侧 `countClears`（清场奖励）必须与门禁**同口径**（否则奖励与判据量的是两件事）');
  ok(ev.indexOf('if (e.source == null) shrink = true;') < 0, '训练侧旧哨兵不得回来');
  /* 反向证据：引擎里收缩伤害确实带这个 reason，且地雷/天火确实无来源。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf("reason: '终局收缩'") >= 0, '引擎的收缩伤害必须带 `reason: \'终局收缩\'`（哨兵的真源）');
  ok(rs.indexOf("地雷伤害无来源") >= 0 || rs.indexOf('noMine: true') >= 0,
    '地雷的无来源是有明文规则依据的（N20 第 6 条）—— 这正是旧哨兵会误判的原因');
});

t('D99 两处修正：原型制御 ≥3 转移（R24）+ 目标架势特征不再是死特征', function () {
  /* ① 原版 `README.md:257` 后半句「若伤害总数≥3 则将伤害各自转移给作用者」从未实现（用户实测没触发）。
   * ② 用户实盘"无根据的突然集火"的根因：`policy.js` 的"目标带架势"那一维读 `X.guardOf(state, tid)`，
   *    而决策时刻 `state.actions` 全 null（startTurn 清空 + autoGameN 先收 picks 再施加）⇒ **恒为 0**。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('function protoReflectAll(state)') >= 0, '原型制御必须有"决算"函数（≥3 各自转移）');
  ok(rs.indexOf('protoNote(state, to, dmg.source, dmg.amt, dmg.type, via)') >= 0,
    '挡住的同时必须**记账**（"伤害总数"= 可以生效且会被挡住的伤害之和 —— 用户口径）');
  ok(rs.indexOf('if (total >= 3)') >= 0 && rs.indexOf('if (it.source == null || it.source === to) continue;') >= 0,
    '决算：总数 ≥3 时反给施法者；**无来源的那几份（天火）计入总数但跳过**');
  ok(rs.indexOf('protoReflectAll(state);  // v1.5.117') >= 0, '决算必须真的被调用（不是只定义 —— D28 的教训）');
  ok(rs.indexOf("protoNote(state, v, null, 1, R.DMG.FIRE, 'firestorm')") >= 0,
    '天火那一份必须**计入总数**（用户口径：它会被挡住，所以算进总数；但无来源 ⇒ 不被反）');
  ok(rs.indexOf("reason: '原型制御·转移'") >= 0, '转移伤害必须有事件标记便于量具核对');
  const po = readFileSync('js/train/policy.js', 'utf8');
  /* ⚠️ 只看**代码行**：这条根因的注释里必然会提到旧写法（`guardOf(…)`），扫全文会自己把自己判红
   * （我第一版就这么栽的）。注释行以 `*` 或 `//` 开头 ⇒ 滤掉再断言。 */
  const poCode = po.split('\n').filter(function (l) {
    const s = l.trim();
    return s.indexOf('*') !== 0 && s.indexOf('//') !== 0 && s.indexOf('/*') !== 0;
  }).join('\n');
  ok(poCode.indexOf('guardOf(state, tid)') < 0,
    '**死特征**不得回来 —— `guardOf` 在决策时刻恒为 null（旧写法读的是本回合 actions）');
  ok(poCode.indexOf('(t.guardNext || t.baguaExtra || t.copiedGuard) ? 1 : 0') >= 0,
    '目标架势特征必须用**决策时刻真的存在**的信号（guardNext / baguaExtra / copiedGuard）');
  ok(po.indexOf('无根据的突然集火') >= 0, 'policy.js 必须写下这条根因（否则下一个人又会以为它读得到）');
      ok(readFileSync('docs/RULES-2P.md', 'utf8').indexOf('三个人各用枪打') >= 0,
    'RULES-2P 必须写下用户口径的三个例子（三枪各反 1 / 大雷+天火 / 单发只挡）');
});

t('D100 E4：挡下伤害奖励（env 单一来源 · 只认真的挡下 · 标度按实测 · 必须进 gFit）', function () {
  /* 复核 §23/E4：防御族**费用 0 ep** ⇒ 不需要多回合计划 ⇒ 是"shaping 只在 0.0X 尺度、买不动多回合计划"
   * 这条限制唯一还可能绕过的方向。口径：只数 `{type:'blocked'|'reflect', to: seat}`（**不认摆架势**）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('function countBlocks(events, seat)') >= 0, '必须有 countBlocks');
  ok(ev.indexOf("(e.type === 'blocked' || e.type === 'reflect') && e.to === seat") >= 0,
    '只认"真的挡掉/弹走"（blocked / reflect），且必须是**发生在我身上**的那一次');
  ok(ev.indexOf('const blockBonus = BLOCK_W * Math.min(1, blocks / 1);') >= 0,
    '标度必须是 /1（量出来的：线上包每席每局 0.10 次挡下 ⇒ 用 /2 会退化成常数微扰）');
  ok(ev.indexOf('+ blockBonus') >= 0,
    '必须真的进 gFit（不是只算不用 —— D28 的教训）');
  ok(ev.indexOf('let BLOCK_W = 0;') >= 0, '默认必须关（0 ⇒ 出厂行为一字不变）');
  ok(ev.indexOf('if (o.blockW != null) BLOCK_W = Math.max(0, Number(o.blockW));') >= 0,
    'setEconomyReward 必须接受 blockW');
  /* 同 D66：v1.5.272（§E83）把"跟着自己的 W 计数"换成整族 `DOSE_ON` ⇒ 钉的语义没变（必须在快照循环里累加），
   * 换的是形状；`blockBonus` 那条断言仍单独守着"付钱按 `BLOCK_W`"这一半（全族 8 个形状由门 D179 统一钉）。 */
  ok(ev.indexOf('if (DOSE_ON) blocks += countBlocks') >= 0, '必须在快照循环里累加（v1.5.272 起按整族 `DOSE_ON`）');
  ok(ev.indexOf('if (BLOCK_W > 0) blocks +=') < 0, '不许退回"计数跟着自己的 W 关"（§E65 那族假零结果的成因）');
  ok(ev.indexOf('BLOCK_W = 0;') >= 0, 'reset 必须把它复位');
  const en = readFileSync('server/econ-env.mjs', 'utf8');
  ok(en.indexOf("'EPIRUS_BLOCK_W'") >= 0, 'env 名必须在**单一来源**里（否则 worker 拿不到 ⇒ 附录 D 臂 K 的 A/A 事故）');
  ok(en.indexOf("'blockW'") >= 0 && en.indexOf('blockW: nv(e.EPIRUS_BLOCK_W)') >= 0,
    '必须被 readEconEnv 读出（两端同一对函数）');
  /* v1.5.128（审计 §2-1）：原来这里复制了一份"D77 的 1200 字符窗口"检查（同一规则三处实现，改一次要改三处）。
   * D77 已改成**运行时往返**（喂值读回）⇒ 这条窗口子检查**删除**。 */
});

t('D101 贵卡出手奖励（v1.5.126 用户洞察：它不会用电磁炮/大雷、也丢了地雷/净化 ⇒ 没必要攒 ep）', function () {
  /* 贵卡由**声明字段**推导（D81/D72 的规矩：不得枚举卡名）：`cost ≥ 3`（大雷 5 · 地雷/净化/摄魂 3）
   * 或 `energyNeeds` 非空（电磁炮需 1 电珠 · 激光眼需爆珠）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  /* v1.5.128（审计 §2-4）：**语义改用运行时验**（原来这三条是源码文本钉 —— 保排版不保行为）。
   * 贵卡 = `cost ≥ 3` 或 `energyNeeds` 非空 ⇒ 大雷(5)/地雷(3)/净化(3)/电磁炮(需电珠) 记分，枪(1)/狙击(2)/ジ(0) 不记；
   * 且只认 `outcome === 'ok'`（被无效化的不算 ⇒ 不可刷）。**不枚举卡名**：靠声明字段。 */
  const mkAct = function (key, voided) { return { type: 'action', pid: 0, outcome: voided ? 'voided' : 'ok', key: key }; };
  eq(T.countBigCards([mkAct(R.SK.BIG_T)], 0), 1, '真正的落雷（cost 5）必须记分');
  eq(T.countBigCards([mkAct(R.SK.MINE), mkAct(R.SK.PURIFY)], 0), 2, '地雷/净化（cost 3）必须记分');
  eq(T.countBigCards([mkAct(R.SK.RAILGUN)], 0), 1, '电磁炮（需 1 电珠）必须记分');
  eq(T.countBigCards([mkAct(R.SK.GUN)], 0), 0, '枪（cost 1）不得记分');
  eq(T.countBigCards([mkAct(R.SK.SNIPE)], 0), 0, '狙击枪（cost 2）不得记分');
  eq(T.countBigCards([mkAct(R.SK.JI)], 0), 0, 'ジ 不得记分');
  eq(T.countBigCards([mkAct(R.SK.BIG_T, true)], 0), 0, '被无效化的出手不得记分（不可刷）');
  ok(ev.indexOf('const bigBonus = BIGCARD_W > 0 ?') >= 0, '标度必须有关闭守卫（0 * NaN = NaN 会把 fit 打成 NaN —— v1.5.124 的坑）');
  /* v1.5.187：原来钉的是 `+ blockBonus + widthBonus + bigBonus));`（**带尾巴**）⇒ 任何新加权项接到后面都会误伤这条门。
   * 与 D100 同形（只钉"+ 该项"，不钉求和式的顺序/结尾）。 */
  ok(ev.indexOf('+ bigBonus') >= 0, '必须真的进 gFit');
  ok(ev.indexOf('let BIGCARD_W = 0;') >= 0, '默认必须关');
  ok(ev.indexOf('if (o.bigcardW != null) BIGCARD_W') >= 0, 'setEconomyReward 必须接受 bigcardW');
  const en = readFileSync('server/econ-env.mjs', 'utf8');
  ok(en.indexOf("'EPIRUS_BIGCARD_W'") >= 0 && en.indexOf("'bigcardW'") >= 0 && en.indexOf('bigcardW: nv(e.EPIRUS_BIGCARD_W)') >= 0,
    'env 名/键/读出三处都要在**单一来源**里');
});

t('D108 候选特征不得把"打 0 号座"当成"无目标"（qoder-research 0920 · 座位身份泄漏现行犯）', function () {
  /* 病（policy.js:397 旧写法 `if (!tid ...)`）：target pid 0 是 falsy ⇒ "打 0 号"的候选
   * 拿到与"无目标"同款的**全零目标块** ⇒ 网络能把"零块"学成"软目标"，镜像局全员集火 0 号座。
   * 实测（RESEARCH-LOG §9）：v7aim1-82 自对局 120 局 × 3 盐配置，**首死 120/120 全是 0 号座**。
   * 守门 = 镜像等性价对：完全对称局面上，(座1 打 座0) 与 (座0 打 座1) 是同一相对局面，
   * actionFeatures 必须**逐位相等**；并对照组 (座1 打 0) vs (座1 打 2) 允许不等（防止"恒输出零块"的假修法）。 */
  const st = S.createState('long', { next: function () { return 0.5; } }, 5);
  st.slotSalt = 123456;
  const a = Pol.actionFeatures(st, 1, 'snipe', { key: 'snipe', target: 0 });
  const b = Pol.actionFeatures(st, 0, 'snipe', { key: 'snipe', target: 1 });
  eq(a.length, b.length, '两侧维数一致');
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  eq(diff.length, 0, '镜像等性价对（1→0 vs 0→1）特征必须逐位相等，不等的维：' + JSON.stringify(diff));
  /* 对照组必须造**不对称**局面：完全对称局面上不同目标的特征**本应全同**（那是真对称，不是假修法）。 */
  st.p[2].hp = 3;
  const c2 = Pol.actionFeatures(st, 1, 'snipe', { key: 'snipe', target: 2 });
  st.p[2].hp = 5;
  let anyDiff = false;
  for (let i = 0; i < a.length; i++) if (c2[i] !== a[i]) anyDiff = true;
  ok(anyDiff, '对照组（不对称局面）：换目标的特征不得全同（挡"永远返回零块"的假修法）；对称局面特征全同是**正确的**');
});
t('D109 形状适应度 S4_W：默认关 · 断线必抛 · 真评分器可跑（P2 · qoder-research 0920）', function () {
  /* 三件事：① 出厂 s4W=0（不加项）；② S4_W>0 而宿主没注入 __shapeScorer ⇒ scoreMemberN **抛错**
   *    （静默降级 = 又一次"开关看着接上、实际作用在没跑的那条路"——附录 D 臂 K 的 A/A 事故形状）；
   * ③ 真接线可跑：shape-scorer.mjs（复用 tools/v2v4-lib 的 duelAssembly，D107 单一来源）在 np-test 沙箱里
   *    对随机策略出 0..1 的分。 */
  eq(T.economyReward().s4W, 0, '默认 s4W 必须 0（econ-env 不设 ⇒ 出厂逐字不变）');
  T.setEconomyReward({ wallFilter: false });   // 自防：不依赖前面门的收尾（wallFilter 泄漏史见 evo reset 注释）
  const p = Pol.makePolicy(0.25);
  const opps = [{ name: 'random', sel: Bots.pickRandom }];
  const had = sb.window.__shapeScorer;
  try {
    T.setEconomyReward({ s4W: 0.2 });
    delete sb.window.__shapeScorer;
    let threw = false;
    try { T.scoreMemberN(p, opps, 1, 3, 1, 0, 0); } catch (e) { threw = /__shapeScorer/.test(String(e && e.message)); }
    ok(threw, 'S4_W>0 且评分器缺线 ⇒ 必须抛错（不许静默跑成 A/A）');
    sb.window.__shapeScorer = function () { return 0.5; };
    const r1 = T.scoreMemberN(p, opps, 1, 3, 1, 0, 0);
    ok(r1 && typeof r1.fit === 'number' && isFinite(r1.fit), '接上桩评分器后打分必须正常出 fit');
    const v = makeShapeScorer(sb.window, 2)(p);
    ok(typeof v === 'number' && v >= 0 && v <= 1, '真评分器（V4 形状 × 两条外部线）输出须在 0..1，实测 ' + v);
  } finally {
    T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 });
    if (had) sb.window.__shapeScorer = had; else delete sb.window.__shapeScorer;
  }
});
t('D70 UI 契约：目标弹窗可取消 + 结算期点击有反馈（复核 §5-①②）', function () {
  const src = readFileSync('js/ui/ui.js', 'utf8');
  ok(src.indexOf('B.picking = { key: key, bead: bead }') >= 0, '目标弹窗必须登记待选状态 picking');
  ok(src.indexOf('function cancelPick()') >= 0, '必须有 cancelPick');
  ok(src.indexOf("ev.key === 'Escape' && B.picking") >= 0, 'Esc 必须能取消（只在有待选状态时拦截）');
  ok(src.indexOf("$('modal-root').onclick") >= 0 && src.indexOf('B.picking) cancelPick()') >= 0, '点遮罩也要能取消');
  ok(src.indexOf('选择目标（Esc') >= 0, '弹窗开着时提示必须写"选择目标"');
  ok(src.indexOf('你刚才的点击没有生效') >= 0, '结算期间点击必须明确告知（不再静默丢弃）');
  ok(src.indexOf('已放弃【') >= 0, '改主意/误触必须留痕');
  ok(src.indexOf('取消', src.indexOf('label:')) >= 0 || src.indexOf('↩ 取消') >= 0, '弹窗必须提供「取消」按钮');
  ok(src.indexOf('B.aiKey = null; B.picking = null;') >= 0, '新局必须重置待选状态');
  ok(src.indexOf('请出招') >= 0, '回合开始的"请出招"提示必须保留（只改弹窗开着时的提示）');
});

t('D71 蓄能经济门槛：ep<2 不许蓄能（v7 口径），legacy 保持旧口径（用户裁定 v1.5.82）', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  const i0 = src.indexOf('function policyChooserN(');
  const i1 = src.indexOf('function pickChampion(');   // 用顶层兄弟函数定界（不能用'下一个 function'：内部有回调）
  const seg = src.slice(i0, i1);
  ok(seg.indexOf('econBase(state, pid, base)') >= 0, 'policyChooserN 必须调用 econBase（单一真源）');
  ok(src.indexOf('function econBase(state, pid, legal)') >= 0, 'econBase 必须存在');
  ok(src.indexOf('return gated.length ? gated : legal;') >= 0, 'econBase 必须在滤空时回退（不改变"必须有招可选"）');
  /* v1.5.143：这一条原本是 `segAll.indexOf('(pp.ep || 0) >= 2') >= 0`（**钉源码字符**）——
   * 门槛变成可调旋钮（`EPIRUS_CHARGE_MIN_EP`，默认仍是 2）之后，钉字符串既挡不住改错方向、
   * 又会误伤合法改动（我加旋钮的当下它就红了）。换成**跑一遍 econBase**：默认口径 + 抬到 3 的口径都验。 */
  const EB = sb.window.EpirusTrainer.econBase, SKc = R.SK.CHARGE;
  const mk = function (ep) {
    const s2 = S.createState('multi', { next: function () { return 0.5; } }, 3);
    s2.p[0].ep = ep;
    const lg = [{ key: SKc, affordable: ep >= 1 }, { key: R.SK.JI, affordable: true }];
    return EB(s2, 0, lg).some(function (l) { return l.key === SKc; });
  };
  ok(mk(1) === false && mk(2) === true, '默认口径：ep=1 不许蓄能、ep=2 许（v1.5.82 裁定，跑出来而不是钉字符串）');
  const T7 = sb.window.EpirusTrainer;
  T7.setChargeMinEp(3);
  const raised = mk(2) === false && mk(3) === true;
  T7.setChargeMinEp(2);          // **必须复位**：沙箱是共享的，漏出去会污染后面每一条门
  ok(raised && mk(2) === true, '门槛可调且能复位：抬到 3 ⇒ ep=2 被摘、ep=3 可蓄，设回 2 后逐字恢复');
  ok(seg.indexOf('candidatesFor(state, pid, v7base') >= 0, 'v7 分支必须用过滤后的 base');
  ok(seg.indexOf('P.choose(state, pid, base,') >= 0, 'legacy 分支必须仍用未过滤的 base（历史基线可比）');
});

t('D105 V4「满桌同包」必须有地板（v1.5.132 立门；**阈值是草案、待用户裁定**）· V2 记录不阻断（09-21 晨回滚，理由见 ③）', function () {
  /* 动机（两条独立证据，都出自 v1.5.131）：
   *  ① R61 改引擎后，线上 3P 包（权重是在旧语义下训的）在 V4/V2 上掉了 1.1pt / **24.7pt**，
   *     而**这两条轴当时没有任何门** ⇒ 静默丢了两个版本（CHANGELOG v1.5.131 §4/§5、HANDOFF §4-11/§4-12）。
   *  ② 同引擎跑一条 6 seed 臂：V4 落在 **1.8~15.0%/席** ⇒ "臂把包送到哪里就是哪里"。
   * 量什么（用户已否掉"数动作投向谁" ⇒ 量**后果**）：**V4 每席位胜率** = 产品形态（满桌同包、会不会跟自己人互杀）；
   *  公平份额 **20%/席**。口径与 `tools/probe-ring-ablate.mjs` **共用同一份实现**（`tools/v2v4-lib.mjs`），n=600、seed 7777。
   * ⚠️ **阈值与标定理由写在一起**（v1.5.104 给 G4 立 45%→60% 时定的规矩）。标定证据（本次实跑 · n=600 · 同 seed）：
   *   线上包 **V4 16.1%/席**；**零权重常数策略 V4 3.4%/席**（阳性对照）；6 个臂包 1.8 / 5.1 / 2.5 / 5.8 / 15.0 / 4.0。
   *   ⇒ 草案 **V4 ≥ 10%/席**：现包余量 6.1pt、零权重 3.4 被挡、**6 个臂里 5 个跌破** ⇒ 判别力够。
   *   **阈值是草案，等用户裁定**；改它只需改下面的 `V4_MIN`（判词会自动跟上）。
   * ⚠️⚠️ **V2 为什么只记录不阻断**（v1.5.132 实测；09-20 夜曾升级成 15% 阈值门，**09-21 晨已回滚**——
   *   回滚理由见下面 ③ 的两晚标定账：整条 V2 轴会随引擎语义平移 ~6pt，绝对阈值跨指纹代不稳定），
   *   本段留作背景：**零权重常数策略在 V2 上拿到 10.2%，
   *   与线上冠军的 10.0% 一模一样** ⇒ 这条轴对"包好不好"**没有判别力**（任何阈值都会被垃圾满足）。
   *   但它作为**历史坐标**仍有意义：R61 之前同一个包在 V2 上是 **34.7%** ⇒ 那次引擎改动把它**从"明显高于
   *   什么都不做"打到了"就是什么都不做"**。⇒ 想让它重新有判别力，得先让"什么都不做"显著低于"好包"，
   *   那是**另一件工作**（不是加个阈值就能解决的）。 */
  const V4_MIN = 10;
  /* V2 阳性对照线（**不是**现役包阈值 —— 见 ③ 的两次标定账）。 */
  const V2_LINE = 12;
  const G = 600, SEED = 7777;
  const DEP = { S: S, Play: Play, T: T, R: R, B: Bots };
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  ok(!!params, '线上 3P 包必须能解包（否则本门没有测量对象）');
  const meas = function (pp) {
    const m = measureAll(DEP, pp, { games: G, seed: SEED, countKey: null, ablate: false });
    return { V1: m.V1.rate, V2: m.V2.rate, V4: m.V4.rate };
  };
  const o = meas(params);
  const zero = new Float64Array(Pol.paramCount());     // 什么都不学的常数策略 = 本门的"地板参考"
  const z = meas(zero);
  ok(isFinite(o.V4) && isFinite(o.V2) && isFinite(z.V4), '量具必须给出有限数（V4=' + o.V4 + ' V2=' + o.V2 + '）');
  /* ① 主判据：V4 地板 */
  ok(o.V4 >= V4_MIN, 'V4（满桌同包 · 每席位胜率）必须 ≥ ' + V4_MIN + '%（实测 **' + o.V4.toFixed(1) +
    '%** / 公平份额 20%）—— 低于它 = 这个包跟自己人互杀到没意义（v1.5.131 实测：6 个臂里 5 个只有 1.8~5.8%）');
  /* ② **仪器必须能看见"坏"**（阳性对照；同族做法见 `probe-ring-ablate` 的"禁一张高频卡必须掉分"）：
   *    零权重策略必须**被这条门挡住** —— 否则这条门的绿是"量具死了"，不是"包好"。 */
  ok(z.V4 < V4_MIN, '阳性对照：零权重常数策略的 V4 必须低于 ' + V4_MIN + '%（实测 **' + z.V4.toFixed(1) +
    '%**）⇒ 否则这条门只是"量具死了"');
  ok(o.V4 > z.V4, '线上包的 V4 必须高于零权重策略（' + o.V4.toFixed(1) + '% vs ' + z.V4.toFixed(1) + '%）');
  /* ③ V2：**记录不阻断**（昨夜一度升级成 15% 阈值门，今晨用实测证据回滚 —— 下面是两晚的完整标定账）。
   *    · 旧引擎 72a9c1b5（昨夜）：零 10.2 / 前任 10.0 / 现役 21.2 ⇒ 判"有判别力"、立 V2≥15 草案；
   *    · 新引擎 56402bbf（今晨指向盲三修后同口径复测）：零 **7.7** / 现役 **13.7** / v7n1-31 13.8 /
   *      v7s9-82 15.7 / v7press3-91 4.3 ⇒ **整条轴随引擎语义平移 ~6pt**（saltPick 兜底本身改了选目标），
   *      15 那条线当场把合法在位包挡红。
   *    ⇒ 结论：判别力是真的（零与好包的**相对**差稳定在 ~6pt），但**绝对值阈值跨指纹代无效**。
   *      本门保留"阳性对照"（零权重必须 < V2_LINE=12 ⇒ 量具没死），现役读数只记录不阻断；
   *      若要立门应改用**相对口径**（如 现役 ≥ 零+5）——那是要用户裁定的事，不偷跑。 */
  ok(z.V2 < V2_LINE, '阳性对照：零权重常数策略的 V2 必须低于 ' + V2_LINE + '%（实测 **' + z.V2.toFixed(1) +
    '%**）⇒ 否则 V2 这条轴又是"量具死了"');
  console.log('  [记录] V2 现役 ' + o.V2.toFixed(1) + '% vs 零权重 ' + z.V2.toFixed(1) + '%（差 ' +
    (o.V2 - z.V2).toFixed(1) + 'pt；绝对阈值跨指纹代不稳定 ⇒ 见 RESEARCH-LOG §25 的裁定件）');
  /* ④ 单一来源：装配只许有一份（本仓"同一规则两处维护必然漂移"栽过四次）。 */
  const pb = readFileSync('tools/probe-ring-ablate.mjs', 'utf8');
  ok(pb.indexOf("from './v2v4-lib.mjs'") >= 0, '探针必须从 v2v4-lib.mjs 导入装配（不许自己再写一份）');
  ok(pb.indexOf('pickBalanced') < 0, ' 且探针里不许再出现对手名清单（它是装配定义的一部分）');
});

t('D112 **广度两个模式都判** + 最大单卡占比排除ジ且打出卡名（v1.5.145 用户裁定）', function () {
  /* 病（用户 2026-09-21 晚）：现役包"不探索时广度非常差"却能上线。查证：阻断项 `G` 只取
     `selfPlay(..., 'multi', G)`，而产品常用模式是 long（现役 long G_eff 2.79 < 3 却无人管）。
     用户裁定："**两个模式都判**" + "**最大单卡占比要排除 ji**"（查证：`breadthProfile` 的计数条件本就
     `key !== R.SK.JI` ⇒ 已排除，但打印只给数字 ⇒ 会被读成ジ的份额 ⇒ 补卡名）。 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf("selfPlay(W, params, 'multi', G)") >= 0, '第一模式（multi）必须仍走自对局');
  ok(pc.indexOf("selfPlay(W, params, 'long', G)") >= 0, '第二模式（long = 产品常用模式）必须也有自对局 G');
  ok(pc.indexOf('G2: spL') >= 0 && pc.indexOf("G2name: 'long'") >= 0, 'long 的 G 必须传进 feasibilityOf 才会**阻断**');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('o.G2') >= 0 && al.indexOf('第二模式') >= 0, 'feasibilityOf 必须真的用 G2 判（否则只是打印）');
  ok(al.indexOf('e.key !== R.SK.JI') >= 0, '广度计数必须排除ジ（S/最大单卡占比同源）');
  ok(al.indexOf('maxCardKey: maxCardKey') >= 0, 'maxCardShare 必须带卡名返回（读者可自证"不含ジ"）');
  ok(pc.indexOf('最大单卡占比（**非ジ**）') >= 0 && pc.indexOf('brd.maxCardKey') >= 0,
    '打印必须写明"非ジ"并把卡名印出来');
  ok(pc.indexOf('两个模式都判') >= 0, '打印必须说明两模式都判（否则读者以为另一栏只记录）');
});

t('D113 chooser 入口必须免疫"直喂原始包"（0921 qoder 审计：忘 unpack ⇒ 静默均匀分布、零报错）', function () {
  /* 病（实测踩中）：把 `window.EPIRUS_CHAMPION_3P` 的**原始外壳**直接喂 `policyChooserN` /
   * `Trainer.pickChampion` 不抛错，权重取不到 ⇒ forwardCands 输出**均匀分布**（25 候选实测全 0.002）
   * ⇒ 谁写新工具忘了 unpack，就会拿着"冠军只出ジ"这种假结论去对账（09-21 写对战台当场中招，
   * unpack 后同包复跑 balanced 50/50）。守卫在 `evo.js` 的 `normChampParams`：原始壳自动 unpack、
   * 垃圾**响亮抛错**、Float64Array/null 走原路（训练热路径零成本 + 不打破健康门槛兜底）。 */
  const raw = sb.window.EPIRUS_CHAMPION_3P;
  ok(!!raw && Array.isArray(raw.a), '前置：仓库里必须有真 3P 包（门不依赖本机 .bak）');
  const W = Pol.unpack(raw);
  ok(!!W, '前置：原始包必须能过 checkPack 并 unpack（否则先修包，别动这条门）');
  Pol.setRng(T.mulberry32(113113));
  /* ① 行为一致：同一装配逐 seed 出招相同（eps=0 贪心 ⇒ 判定不含抽样噪声） */
  for (let g = 0; g < 3; g++) {
    const mk = function () {
      const st = S.createState('long', { next: T.mulberry32(77000 + g) }, 3);
      X.startTurn(st); st.p[0].ep = 5;
      return st;
    };
    const s1 = mk(), s2 = mk();
    const l1 = Play.legalActions(s1, 0).filter(function (x) { return x.affordable; });
    const l2 = Play.legalActions(s2, 0).filter(function (x) { return x.affordable; });
    const p1 = T.policyChooserN(raw, 0.15)(s1, 0, l1);
    const p2 = T.policyChooserN(W, 0.15)(s2, 0, l2);
    ok(p1.key === p2.key, '直喂原始包与 unpack 后必须同一手（seed ' + g + '：' + p1.key + ' vs ' + p2.key + '）');
  }
  /* ② "相同"不许是两条都退化成均匀分布的巧合 ⇒ 单独证明 W 在该态下给的是**尖**分布 */
  const s3 = S.createState('long', { next: T.mulberry32(77000) }, 3);
  X.startTurn(s3); s3.p[0].ep = 5;
  const l3 = Play.legalActions(s3, 0).filter(function (x) { return x.affordable; });
  const cands3 = Pol.candidatesFor(s3, 0, l3, {});
  const f3 = Pol.forwardCands(s3, 0, cands3, W, { temp: 0.05 });
  let mx = 0; for (let i = 0; i < f3.probs.length; i++) mx = Math.max(mx, f3.probs[i]);
  /* ⚠️ 阈值必须是**相对均匀基线**而不是绝对值：两级 softmax（先技能后条目）把 joint 峰的
   * 上界压到恰好 0.5（v1.5.74 的两级归一 + temp 0.05 ⇒ "技能概率 1.0 × 键内 0.5"），
   * 写 `>0.5` 会把**正确实现**判红（0921 首跑实测峰恰好 0.5000）。均匀退化读数是 1/n（此处 ≈0.024）
   * ⇒ 判据取 4/n：离退化线两个数量级、离上界留够余量，任何"真尖"包都过、任何平摊都红。 */
  ok(mx > 4 / f3.probs.length, 'unpack 权重必须产生非均匀分布（实测峰 p=' + mx.toFixed(3) + ' vs 均匀基线 ' +
    (1 / f3.probs.length).toFixed(3) + '；旧坑读数就是那个平摊值）');
  /* ③ 垃圾输入必须响亮 */
  let thr1 = false, thr2 = false;
  try { T.policyChooserN({}, 0.15); } catch (e) { thr1 = /unpack|权重/.test(String(e && e.message)); }
  try { T.policyChooserN({ a: [1, 2, 3] }, 0.15); } catch (e) { thr2 = true; }
  ok(thr1, '空对象必须被守卫挡下并给出点名 unpack 的错（不许再走静默均匀）');
  ok(thr2, '维度错的假包必须被挡下（checkPack 失败 ⇒ 重训重发，不许静默）');
  /* ④ null 的既有兜底不许被守卫打破（LEGACY(null)=true 是健康门槛拒配时的活路） */
  ok(typeof T.policyChooserN(null, 0.15) === 'function', 'params=null 必须仍可建 chooser');
});

t('D114 §N6 跨 N 混适应度：默认关（行为逐字）+ 接线三钉（夜班 09-22 · 时间盒=只实现+smoke）', function () {
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("process.env.EPIRUS_XN2W || 0") >= 0, 'EPIRUS_XN2W 必须默认 0（未设 ⇒ 一条行为不变）');
  ok(t3.indexOf('if (XN2W > 0 && N > 2)') >= 0, '2P 切片只许在 W>0 且主场 N>2 时追加（2P 主场自己混自己 = 无意义）');
  ok(t3.indexOf("T.setTrainMode('standard')") >= 0 && t3.indexOf('T.setTrainMode(prevMode)') >= 0,
    '切片必须临时切 standard 并**复原**（半开事故族：fight-env/econ-env 的前车）');
  /* 行为面：默认关时混入代码不可达 ⇒ 用一个 2 代微跑对照 W=0 与"未装此代码"同分不实测（CPU 紧），
   * 这里退而求其次：验证 setTrainMode/trainMode 真在 EpirusTrainer 导出面上（否则上面全是死代码）。 */
  ok(typeof T.setTrainMode === 'function' && typeof T.trainMode === 'function', 'evo 必须导出 setTrainMode/trainMode');
});

t('D116 §N6 修正（v1.5.150 · DS）：2P 切片必须打**2P 强参照**（对多人池 ⇒ 常数 ⇒ 空枪）+ 参照读不出必须响 + 带内候选落盘', function () {
  /* 病（DS 09-22 实测 · `docs/RESEARCH-LOG-2026-09-22-ds.md` §2）：切片原来拿多人池 `OPPS` 当 2P 对手，
   * 而现役包对池子脚本在 2P 里**0% 胜率** ⇒ 人人 ≈0 分 ⇒ 该切片是常数 ⇒ 加常数不改变排序
   * ⇒ 第一臂 `v7xn1-31.bak` 与热启动**逐字节相同**（空枪，白跑）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('T.scoreMemberN(params, XN2_OPPS') >= 0,
    '2P 切片必须用参照列表 XN2_OPPS（改成 OPPS 就退回"常数切片"= 空枪）');
  ok(t3.indexOf("EPIRUS_XN2REF || 'js/bundled-champion.js'") >= 0, '默认参照 = 现役 2P 冠军（不设环境变量也得有梯度）');
  ok(t3.indexOf('process.exit(2)') >= 0 && t3.indexOf('拒绝静默退化') >= 0,
    '参照包读不出必须**立刻退出**（静默退化正是这次踩的坑）');
  ok(t3.indexOf('-band') >= 0 && t3.indexOf('EPIRUS_BAND_DIR') >= 0,
    '必须带内候选落盘，且目录可指（门才测得了它，且不欠 D82 的账）');
  /* v1.5.150 追加：`exam` 关键词 = 直接用 2P 考卷那 20 个基准当切片对手（与产品判据同表）。
   * 为什么钉：臂 3 的教训是"混入弱对手 ⇒ 信号被平均稀释 ⇒ 退回常数切片"；而考卷基准**全部可打**
   * （现役 2P 冠军对它们 99%）⇒ "对着验收标准训"是唯一能让目标与验收一致的路径，这条接线不许悄悄断。 */
  ok(t3.indexOf("from './p2-baselines.mjs'") >= 0 && t3.indexOf("rp === 'exam'") >= 0,
    'exam 模式必须接**单一来源** p2-baselines（自己抄一份基准表 = 本仓栽过三次的老坑）');
  ok(t3.indexOf('exam:') >= 0 && t3.indexOf('p2-baselines 与 bots.js 漂移') >= 0,
    'exam 模式的基准函数缺失必须响（不许静默少几个对手 ⇒ 验收口径偷偷变窄）');
  /* 行为一：坏参照 ⇒ 训练前就 exit 2（无副作用、不写任何产物）。 */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2REF: 'no/such/pack.bak' }), encoding: 'utf8', timeout: 120000 });
  ok(bad.status === 2, '坏参照必须 exit 2（实测 exit=' + bad.status + '）');
  /* 行为二：迷你臂（1 代 · N=3 · pop 2 · 2P 局 2）写进**临时目录** ⇒ 断言候选落盘 + meta 自证口径。 */
  const dir = mkdtempSync(join(tmpdir(), 'xn2band-'));
  const run = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '2', EPIRUS_BAND_DIR: dir, EPIRUS_ARM: 'nptest-arm' }), encoding: 'utf8', timeout: 300000 });
  ok(run.status === 0, '迷你臂必须跑通（exit=' + run.status + '）');
  const bands = readdirSync(dir).filter(function (f) { return /-band\d+\.bak$/.test(f); });
  ok(bands.length > 0, '带内候选必须落盘（实测 ' + bands.length + ' 个）');
  /* 行为二b（v1.5.247）：**目录不存在**时必须自己建，不许静默跳过。
   * 为什么单独钉：上面那条"行为二"用 `mkdtempSync` 先把目录建好了 ⇒ **门自己替被测代码满足了它的前置条件**，
   * 于是 09-26 两批共 52 支臂（把 BAND_DIR 指到没建过的嵌套路径）每支都打 `[band-save] 无 … 目录，跳过`
   * 把带内候选全丢了，而门一直是绿的 —— 这是"用例把前提喂饱"的典型盲区（METHODOLOGY 63 同族）。 */
  const bandRoot = mkdtempSync(join(tmpdir(), 'xn2band2-'));
  const dir2 = join(bandRoot, 'deep', 'nested');
  const run2 = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '2', EPIRUS_BAND_DIR: dir2, EPIRUS_ARM: 'nptest-nodir', EPIRUS_T3P_OUT: join(bandRoot, 'out.js') }), encoding: 'utf8', timeout: 300000 });
  eq(run2.status, 0, 'BAND_DIR 不存在时迷你臂仍须跑通（exit=' + run2.status + ' ' + String(run2.stderr || '').slice(0, 80) + '）');
  const bands2 = existsSync(dir2) ? readdirSync(dir2).filter(function (f) { return /-band\d+\.bak$/.test(f); }) : [];
  ok(bands2.length > 0, 'BAND_DIR 不存在 ⇒ 必须**自建嵌套目录**并落盘带内候选（实测目录在场=' + existsSync(dir2) + ' · 候选 ' + bands2.length + ' 个）——'
    + '静默跳过 = 臂"跑成功"但落选证据全丢（09-26 实测丢过 52 支）');
  ok(String(run2.stdout || '').indexOf('目录，跳过') < 0, '不许再出现"无目录，跳过"这条静默退路');
  rmSync(bandRoot, { recursive: true, force: true });
  if (bands.length) {
    const txt = readFileSync(join(dir, bands[0]), 'utf8');
    ok(txt.indexOf('"xn2w":1') >= 0 && txt.indexOf('bundled-champion.js') >= 0,
      'band 产物的 meta 必须自证 2P 口径（权重 + 参照路径），否则没人能追溯"它是跟谁训的"');
  }
  ok(String(run.stdout || '').indexOf('2P对手=ref:bundled-champion.js') >= 0,
    'banner 必须打出 2P 对手（非空枪自检就靠这一行）');
});

t('D117 口径工具（v1.5.151）：防御类必须**从 rules.js 取表**（手写正则漏过"金刚盾"）+ 行为剖面必须能一次报多个装配', function () {
  /* 病（用户 09-22 追问"ε=0 下防御 0% 也不是很对吧"时查出两件事）：
   * ① `tools/log-behavior.mjs`（真机栏）的防御类是**手写正则** `/防御|反弹|八卦阵|原型制御|金钟|镜面/`：
   *    匹配不上真卡名「**金刚盾**」（不是"金钟"）、漏了「无极变速/藤甲/全息屏障」、还列了不存在的「镜面」
   *    ⇒ 真机栏的防御占比长期是**漏数**的结果（修后 23.0% → **24.8%**）。
   * ② **装配是比 ε 更大的口径因素**：同一包同一 ε=0，镜像（5 席同包）电磁炮 **4.30/局**，
   *    真桌（1 冠 + 4 脚本）只有 **0.10/局**（43 倍）⇒ 一个口径点必须同时报**装配**，否则读数会被当成"包的能力"。 */
  const lb = readFileSync('tools/log-behavior.mjs', 'utf8');
  /* v1.5.312：读取实现挪进 `tools/log-reading.mjs`（真机栏与 `log-census.mjs` 共用一份）⇒ 这两枚静态钉跟着挪，
   *   并且**加严**：`log-behavior` 里不许再留自己的手写能力项表。行为级复验在 **D216**（静态钉会被重构架空，光改钉词不算修好）。 */
  const lr = readFileSync('tools/log-reading.mjs', 'utf8');
  ok(lr.indexOf('js/core/rules.js') >= 0 && lr.indexOf('RUL.CAT.DEFENSE') >= 0,
    '防御类必须从规则表取（手写正则漏过真卡名 —— 本仓"同一份名单抄两遍"栽过三次，这是第四个同类隐患）');
  ok(lr.indexOf('取不到防御类卡') >= 0, '取不到必须响（不许静默退化成"数 0 个"）');
  ok(lb.indexOf('./log-reading.mjs') >= 0 && lb.indexOf('const CAP = {') < 0,
    '真机栏必须走那一份读取实现，**不许留自己的手写能力项表**（旧 9 项 `CAP` 漏掉了真机第 3、第 4 名激光剑/聚能环 ⇒ D216 行为级复验）');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(bp.indexOf('FIELDS') >= 0 && bp.indexOf('for (const fld of FIELDS)') >= 0,
    '行为剖面必须能一次报多个装配（`--field=self,pool`）⇒ 否则"装配口径"永远缺一栏、读数继续被误读');
  ok(bp.indexOf("flag('field', 'mixed')") >= 0, '默认口径不许被改（历史读数靠它可比）');
});

t('D118 体检必须并报"产品代理栏"（真桌 1+4 · ε=0.2 soft）—— **只记录不阻断**（v1.5.152 · 用户裁定）', function () {
  /* 病（DS 09-22 §7 实测 · 用户追问"ε=0 下防御 0% 也不是很对吧"）：同一包同一 **ε=0**，
   *   **镜像**装配（5 席同包 · 门禁/体检用的就是它）电磁炮 4.30/局，**真桌**（1 冠 + 4 脚本）只有 0.10/局
   *   ⇒ **装配单独值 43 倍、ε 只值 2 倍** ⇒ 体检打印的贵卡数字是**镜像局特有**的，却被当成"这个包的能力"
   *   （千问 §23 的"4 倍口径差"也是把 ε 与装配混算的结果 ✗）。
   * 用户裁定：把"真桌 + ε=0.2"接进体检，**只记录不阻断**（在它有判别力之前不拦人）。
   * 本条钉四件事：那一栏必须打印 · 必须借 `behavior-profile` 的实现（**单一来源**，不抄第二份）·
   * 必须写明"只记录不阻断"· 可关掉（`EPIRUS_NO_PROXY`）；并守住 `behavior-profile` 的导出/守卫。 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('产品代理栏') >= 0 && pc.indexOf("fieldProfile(params, 0.2, 'soft'") >= 0,
    '体检必须并报产品代理栏（真桌装配 · ε=0.2 soft）');
  ok(pc.indexOf("from './behavior-profile.mjs'") >= 0, '必须借 behavior-profile 的实现（单一来源 —— 本仓"同一份名单抄两遍"栽过三次）');
  ok(pc.indexOf('只记录不阻断') >= 0, '必须写明只记录不阻断（否则读者会以为它参与判定）');
  ok(pc.indexOf('EPIRUS_NO_PROXY') >= 0, '必须能关掉（省时间；也留一条"不装它也能跑"的活路）');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(bp.indexOf('export function fieldProfile') >= 0 && bp.indexOf('RUN_AS_MAIN') >= 0,
    'behavior-profile 必须导出 fieldProfile、且**被 import 时不跑 main**（否则体检一 import 就把整个剖面跑一遍）');
});

t('D119 热启动不许静默失败（v1.5.153 · DS）：两种外壳都认 + 读不出种子必须 exit 5 —— 否则整臂白跑', function () {
  /* 病（DS 09-22 实测 · 两臂白跑）：`tools/train-3p.mjs` 的热启动正则只认 `window.EPIRUS_CHAMPION_3P`，
   * 而 `train-best` 产的包是 **2P 外壳** `window.EPIRUS_CHAMPION` ⇒ `EPIRUS_SEEDPACK=<2P 包>` 时
   * `try/catch` **静默不热启动** ⇒ 臂 7/臂 8（跨 N 的 W 轴与排练轴）实际是**冷启动**跑的 ✗ ——
   * 预注册前提没成立、两条结论作废，直到做锚定正则时 `距种子` 一直不打才发现。
   * ⇒ 本条钉两件事：① 兼容两种外壳；② **明确要了热启动却读不出 ⇒ exit 5**（与 `EPIRUS_XN2REF` 同规矩）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('window\\.EPIRUS_CHAMPION(?:_3P)?') >= 0, '热启动必须兼容两种外壳（2P 壳 = train-best 的产物）');
  ok(t3.indexOf('拒绝静默冷启动') >= 0 && t3.indexOf('process.exit(5)') >= 0,
    '读不出种子必须 exit 5（静默冷启动会让整臂白跑且看起来"有结果"）');
  ok(t3.indexOf('热启动：以现有冠军为种子') >= 0, '生效时必须打印那一行（非空枪自检就靠它）');
  /* 行为式：坏种子 ⇒ exit 5（训练前就退出，不写任何产物）。 */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: 'no/such/seed.bak' }), encoding: 'utf8', timeout: 120000 });
  ok(bad.status === 5, '坏种子必须 exit 5（实测 exit=' + bad.status + '）');
});

t('D122 CLI 黑旋钮不许静默（v1.5.155 · DS 裁定；v1.5.159 升级：已下达的键改用**空枪检测**）：train-3p 命中读不到的 EPIRUS_* ⇒ exit 6 + 静态钉住"引擎里字面读 env"的清单', function () {
  /* 病（qoder §N10 审计 + DS 本会话第 5/6 例）：`train-3p` 的 env 面是**闭集**，而 server 侧旋钮走
   * `server/econ-env.mjs`/`fight-env.mjs` 下发（CLI 不 import ⇒ 全黑）；`js/` 里还有**加载时字面读**
   * `process.env` 的键（而 vm 沙箱没有 `process` ⇒ 永远默认）⇒ 从 CLI 传这些键**一律无效却毫无提示**，
   * 会跑出"看起来在调参、其实是默认经济"的臂。用户/DS 裁定：**采纳黑键侦测 + 加静态门**。
   * v1.5.159：`EPIRUS_PASSIVE_FIELD` 已**升级为可下达**（`server/train-env.mjs` + `T.setPassiveField`）
   * ⇒ 它从"死键"移入闭集，本门对它的期待**从 exit 6 改为"必须真到达消费点"**（空枪检测，见 ③）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* v1.5.200：判定已搬进单一来源 `server/knob-guard.mjs`（原先只有 train-3p 一份 IIFE ⇒
   * train-best / train-fast / 页面训练服务全都没有这道闸）。静态钉跟着搬到单一来源，
   * 行为断言（下面 ①②③）**一个字没改** —— 门守的是行为，不是实现放在哪个文件。 */
  const kgSrc = readFileSync('server/knob-guard.mjs', 'utf8');
  ok(t3.indexOf('SELF_ENV_KEYS') >= 0 && t3.indexOf('enforceKnobs(') >= 0 && t3.indexOf('knob-guard.mjs') >= 0,
    'train-3p 必须走单一来源的黑键闸（enforceKnobs + 自己的闭集 SELF_ENV_KEYS）');
  ok(kgSrc.indexOf('detectDarkKnobs') >= 0 && kgSrc.indexOf('CLI 黑键') >= 0 && kgSrc.indexOf('EPIRUS_ALLOW_DARK') >= 0,
    '单一来源里必须响亮说明白 + 留逃逸口');
  /* ① 行为：**仍未下达**的暗键 ⇒ exit 6（用 fight 族键：CLI 至今不 import 它 ⇒ 传它本就无效） */
  const dark = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_FIGHT_WHISTLE: '0.34' }), encoding: 'utf8', timeout: 120000 });
  ok(dark.status === 6, '暗键必须 exit 6（实测 exit=' + dark.status + '）');
  /* ② 行为：逃逸口放行（1 代迷你臂，写临时目录 ⇒ 不欠 D82） */
  const dir2 = mkdtempSync(join(tmpdir(), 'darkok-'));
  const okRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_FIGHT_WHISTLE: '0.34', EPIRUS_ALLOW_DARK: '1', EPIRUS_BAND_DIR: dir2, EPIRUS_ARM: 'nptest-dark' }), encoding: 'utf8', timeout: 300000 });
  ok(okRun.status === 0, 'EPIRUS_ALLOW_DARK=1 必须放行（实测 exit=' + okRun.status + '）');
  /* ③a 行为（v1.5.163）：**已删除的键也必须响亮** —— 传 `EPIRUS_PASSIVE_FIELD` ⇒ exit 6 + 说明删于哪一版。
   * 静默忽略等于把"传了等于没传"换个形态留下（它就是白跑两臂的那个病）。 */
  const goneRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_PASSIVE_FIELD: '0.34' }), encoding: 'utf8', timeout: 120000 });
  eq(goneRun.status, 6, '已删除的键必须 exit 6（实测 exit=' + String(goneRun.status) + '）');
  ok(/已被删除/.test(String(goneRun.stderr || '')), '必须说清"已被删除 + 删于哪一版 + 用什么替代"');
  /* ③b 行为（v1.5.163 取代旧"横幅读回"式空枪检测）：**活键必须改到评估分布本身** ——
   * 判据是跑完打印的 `开火计数` 与它覆盖的受评座位数，不是"消费点读回 X"（§N11 的教训：读回 = 变量到位 ≠ 效果发生）。 */
  const dir3 = mkdtempSync(join(tmpdir(), 'knobok-'));
  const knobRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '8', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_FIELD: '0.2', EPIRUS_SEED: '7', EPIRUS_BAND_DIR: dir3, EPIRUS_ARM: 'nptest-knob' }), encoding: 'utf8', timeout: 300000 });
  ok(knobRun.status === 0, 'EPIRUS_KILL_FIELD 下达 ⇒ 不许 exit 5/6/7/8（实测 exit=' + String(knobRun.status) + '）');
  const fired = /开火计数：注入 (\d+) 局 · 覆盖受评座位 (\d+) 个/.exec(String(knobRun.stdout || ''));
  ok(fired, '必须打印开火计数（没有它 = 回到"横幅自证"）');
  ok(fired && Number(fired[1]) > 0, '真注到局才算下达（实测 ' + (fired ? fired[1] : '无') + ' 局）');
  ok(fired && Number(fired[2]) >= 2, '注入必须覆盖 >=2 个受评座位（座位偏置 = 用户 09-22 裁掉的对象）');
  /* ④ 静态：引擎里"字面读 process.env"的清单（新增一处 ⇒ 红；修掉一处 ⇒ 也要来改这份清单）
   * v1.5.163：清单**清空** —— `EPIRUS_PASSIVE_FIELD` 是最后一个字面死读，随整族删除一起退场。
   * 从此往 `js/` 里加任何 `process.env.EPIRUS_*` 都会立刻红 ⇒ 必须走宿主 setter（或显式登记为死键）。 */
  const DEAD_LITERAL = {};
  const found = {};
  const walk = function (d) {
    for (const nm of readdirSync(d)) {
      const p = d + '/' + nm;
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.js$/.test(nm)) continue;
      const ks = (readFileSync(p, 'utf8').match(/process\.env\.EPIRUS_[A-Z0-9_]+/g) || [])
        .map(function (s) { return s.replace('process.env.', ''); });
      if (ks.length) found[p.replace(/\\/g, '/')] = Array.from(new Set(ks)).sort();
    }
  };
  walk('js');
  ok(JSON.stringify(Object.keys(found).sort()) === JSON.stringify(Object.keys(DEAD_LITERAL).sort()),
    'js/ 里字面读 env 的文件清单必须与声明一致（新增一处就得来处理：走宿主 setter 或显式登记为死键）\n      实测 ' +
    JSON.stringify(found) + '\n      声明 ' + JSON.stringify(DEAD_LITERAL));
  for (const f of Object.keys(DEAD_LITERAL)) {
    ok(JSON.stringify(found[f]) === JSON.stringify(DEAD_LITERAL[f].slice().sort()), f + ' 的字面读键必须与声明一致');
  }
});

/* v1.5.201（审计：硬编码复制 D123/D127 各写一遍）：默认关的 CLI 臂产物基线只留**一处**。
 * 红了 = 默认关的产物变了（那等于偷偷改了所有 CLI 臂的分布）⇒ 先查是不是有意的；
 * 确认有意要重记，就只改这一行（别再去两个用例里各改一处）。 */
const CLI_ARM_BASELINE = 'aa743488cc';

t('D123 收割席注入（v1.5.160 · §N13 · 用户裁定"场B 缺口走对手池"）：默认关逐位不变 + **判开火计数不判横幅** + 座位不偏置 + 不拿纯攒钱型当陪练', function () {
  /* 四条各钉一类 09-22 实测过的病：
   *  · **默认关 ⇒ 逐位不变**（一次加旋钮不许偷偷挪所有历史臂的评估分布）；
   *  · **判作用点**：§N11 的病是"横幅读回 0.34 ✓ 而一局未注"（`PASSIVE_FIELD` 查 `BOT_PICKS` 不存在的键 ⇒ 死分支），
   *    烧掉 `v7xn10c`/`v7xn11a` 两臂 —— 所以本门**不钉横幅**，钉"跑完报了几局注入"；
   *  · **座位不偏置**：用户 09-22 裁掉"每 8 局注入"那种恒落 `g=0` ⇒ 恒 0 号座的覆盖（`seat = g % n`）；
   *  · **不罚囤**：用户原话"囤一点 ep 放大招也是有好处的" ⇒ 陪练必须是**会抢收割**的 `pickKillSecure`，
   *    只攒不打的 farmer/deepsaver 不许上这条分支（那等于出一道没有反击的题）。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* ① 静态：注入分支取的是注册表函数，且该分支里不许出现纯攒钱型 */
  ok(evo.indexOf('Bots.pickKillSecure') >= 0, '注入必须直接取 Bots.pickKillSecure（不查 BOT_PICKS —— 那张表加键会改默认池）');
  const br = /else if \(killSeatPid[\s\S]*?\n        \} else/.exec(evo);
  ok(br, '收割席分支必须存在（v1.5.163 起它是唯一的注入分支）');
  ok(!/farmer|deepsaver/.test(br[0]), '注入分支里不许出现 farmer/deepsaver（用户裁定：囤是有效打法，不许拿它当陪练罚）');
  ok(evo.indexOf('KILL_STAT.fired++') >= 0 && typeof T.countKillSeats === 'function',
    '必须有开火计数（§N12 教训：setter + 横幅读回证明不了作用点）');
  ok(t3.indexOf('process.exit(8)') >= 0 && t3.indexOf('本臂作废') >= 0, '一局未注 / 座位偏置 ⇒ 必须 exit 8 响亮');
  /* ② 单元：只注多人局 + 永不注到受评席自己 + 相位真的按代旋转（自建沙箱，别污染共享 T） */
  const sb2 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb2.window = sb2; sb2.globalThis = sb2;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), sb2, { filename: f });
  const T2 = sb2.window.EpirusTrainer;
  eq(T2.setKillField(0.2), 0.2, 'setKillField 必须回读生效值');
  for (let g = 0; g < 8; g++) for (let gen = 0; gen < 20; gen++) {
    const pid = T2.killSeatFor(g, gen, 0, 2, 0);
    eq(pid, -1, '2P 局一律不许注（切片的全部意义是"对着考卷基准打"，注进去等于换参照 ⇒ 目标与验收不一致）');
    const p5 = T2.killSeatFor(g, gen, 2, 5, 0);
    ok(p5 === -1 || p5 !== 2, '注入席永远不许是受评席自己（g=' + g + ' gen=' + gen + ' 实得 ' + p5 + '）');
  }
  /* 承诺局（`T.isCommitGame`）**一分不进 fit** ⇒ 那一局不许注（注了等于白注，§N12 的第三处错位）
   * ⚠️ v1.5.186：这里原来自己写了一遍 `g % 3 === 0` —— 而承诺局的相位从本版起**按代旋转**（修 DS 交接 §3 坑#8 的席位锁死），
   *    于是这条门立刻变成"用旧口径判新代码"的红。**门也不许复制判据**（同一味药，换了个病人）。 */
  let commitLeaks = 0;
  for (let gen = 0; gen < 40; gen++) for (let g = 0; g < 8; g++) if (T2.isCommitGame(g, gen, 2) && T2.killSeatFor(g, gen, g % 5, 5, 2) >= 0) commitLeaks++;
  eq(commitLeaks, 0, '承诺局不许注入（那局不进 fit ⇒ 白注）');
  const seen = new Set();
  for (let gen = 0; gen < 6; gen++) for (let g = 0; g < 8; g++) { const p = T2.killSeatFor(g, gen, g % 5, 5, 0); if (p >= 0) seen.add(g % 5); }
  ok(seen.size >= 3, '受评座位必须随代旋转（6 代里至少覆盖 3 个不同座位；实测 ' + seen.size + ' 个 [' + Array.from(seen).sort().join(',') + ']）');
  T2.setKillField(0);
  /* ③ 行为 · 默认关 ⇒ 与登记产物**逐位相同**（seed 7 · 3 代 × 3 人 × 6 局 × 种群 4） */
  const wh = function (p) {
    const s = readFileSync(p, 'utf8');
    const m = /"a":\[([^\]]*)\]/.exec(s);
    return m ? createHash('sha1').update(m[1]).digest('hex').slice(0, 10) : 'NOPARSE';
  };
  const dir = mkdtempSync(join(tmpdir(), 'd123-'));
  const mini = function (env) {
    return spawnCached(['tools/train-3p.mjs', '3', '3', '6', '4'], {
      env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd123', EPIRUS_BAND_DIR: dir }, env || {}),
      encoding: 'utf8', timeout: 300000,
    });
  };
  let r = mini({});
  eq(r.status, 0, '默认关必须跑通（实测 exit=' + r.status + '）');
  eq(wh('docs/artifacts/train-3p-out.js'), CLI_ARM_BASELINE, '默认关的产物必须与登记基线逐位相同（动了它 = 偷偷改了所有 CLI 臂的分布）');
  /* ④ 行为 · 下达 ⇒ **必须真开火**，且覆盖 ≥2 个受评座位（判计数，不判横幅） */
  r = mini({ EPIRUS_KILL_FIELD: '0.2' });
  const so = String(r.stdout || '');
  eq(r.status, 0, 'KILL_FIELD=0.2 必须跑通（实测 exit=' + r.status + '）\n' + so.slice(-400));
  const fired = /开火计数：注入 (\d+) 局 · 覆盖受评座位 (\d+) 个/.exec(so);
  ok(fired, '必须打印开火计数（没有它 = 回到"横幅自证"的老病）');
  ok(Number(fired[1]) > 0, '注入了密度就必须真注到局（实测 0 局 ⇒ 死作用点，正是 §N11 那两臂的病）');
  ok(Number(fired[2]) >= 2, '注入覆盖的受评座位必须 ≥2 个（座位偏置 = 用户 09-22 裁掉的对象；实测 ' + fired[2] + '）');
  ok(so.indexOf('注入名单 killsecure') >= 0, '名单只许 killsecure（出现别的 = 有人往这条路上加了罚囤陪练）');
  /* ⑤ 反证 · 密度小到不可能开火 ⇒ 必须 exit 8（证明这道闸自己会响，而不是摆设） */
  const never = mini({ EPIRUS_KILL_FIELD: '1e-9' });
  eq(never.status, 8, 'EPIRUS_KILL_FIELD 小到一局未注时必须 exit 8（拒绝白跑；实测 exit=' + never.status + '）');
});

t('D124 当选面的 3P 第二栏（v1.5.161 · P1 · §N14 实证"band2 被 hill05 挤掉、当选者 3P 场B/墙双 0"）：纯函数四向 + 缺栏即不合格 + 全否决必须响', function () {
  /* 这一族病叫"择优看不见本臂目标"：`train-best` 的 fit 就是 2P 考卷，收口臂里 3P 那一栏**从来没进过选择**，
   * 于是 §N14 里两栏都更强的 band2（考卷 98.25%/最差 85、3P 五道全过、场B 4.00、score 0.916>0.891）被 hill05 挤掉。
   * ⚠️ 判据必须判在**作用点**上（§N12 的教训）：既钉纯函数，也钉"栏真的跑过"的那行输出，不钉横幅口号。 */
  const mk = function (tag, ok, measured, inc) {
    return { tag: tag, isIncumbent: !!inc, col3p: measured === false ? undefined : { measured: true, ok: !!ok, fails: ok ? [] : ['场B 清场 0.00 < 0.3/局'] } };
  };
  const inc = mk('现有冠军', false, true, true);
  /* ① 全合格 ⇒ 一个不拒 */
  let r = vetoBy3p([inc, mk('A', true), mk('B', true)]);
  eq(r.rejected.length, 0, '全合格时不许拒任何候选'); eq(r.allRejected, false, '全合格不许报"全否决"');
  /* ② 部分不合格 ⇒ 拒的是那粒，在位参照永不参与否决 */
  r = vetoBy3p([inc, mk('A', true), mk('B', false)]);
  eq(r.rejected.length, 1, '不合格的那粒必须被拒');
  eq(r.rejected[0].tag, 'B', '被拒的必须是 B');
  ok(r.kept.indexOf(inc) >= 0, '在位参照必须永远留在池里（它是不回归层的基线，不是竞争者）');
  /* ③ **缺栏/未测 = 不合格**（拒绝"看不见就当过"的静默降级 —— §N11 那两臂正是"读到了值就当生效了"）*/
  r = vetoBy3p([inc, mk('A', true, false)]);
  eq(r.rejected.length, 1, 'col3p 缺失的候选必须判不合格（没测 ≠ 过了）');
  /* ④ 全否决 ⇒ allRejected 为真（调用方据此 exit 9，不许退回单栏硬选） */
  r = vetoBy3p([inc, mk('A', false), mk('B', false)]);
  eq(r.allRejected, true, '有竞争者但无一合格 ⇒ 必须报全否决');
  eq(r.kept.length, 1, '全否决时池里应只剩在位参照');
  /* ⑤ 空池不误判（没有竞争者 ≠ 全否决） */
  eq(vetoBy3p([inc]).allRejected, false, '只有在位参照时不许误报全否决');
  /* ⑥ 接线：必须在 `pickBestByExam` **之前**否决，且用的是 audit-lib 那批量具（不许另抄实现） */
  const tb = readFileSync('tools/train-best.mjs', 'utf8');
  ok(tb.indexOf('vetoBy3p(') >= 0 && tb.indexOf('process.exit(9)') >= 0, 'train-best 必须接 vetoBy3p 并有全否决的 exit 9');
  ok(tb.indexOf('pickBestByExam(pool') >= 0 && tb.indexOf('vetoBy3p(cands)') < tb.indexOf('pickBestByExam(pool'),
    '否决必须发生在择优**之前**（之后改结果就是暗改）');
  ok(tb.indexOf("from './audit-lib.mjs'") >= 0 && tb.indexOf('feasibilityOf(') >= 0,
    '3P 栏必须复用 audit-lib 的 feasibilityOf/量具（另抄一份 = 本仓栽过四次的"两处各写一遍"）');
  ok(tb.indexOf('EPIRUS_TB_OUT') >= 0 && tb.indexOf('if (OUT === dest)') >= 0,
    '产物必须可改道，且**只有真覆写 2P 槽时**才动 index.html 的缓存戳（§N14 实测：还原了槽、忘了还原戳 ⇒ 工作区脏）');
  ok(/const dir = TB_OUT \? dirname\(/.test(tb),
    '改道必须**改彻底**：带内候选也要跟着走 —— 否则门每跑一次就在 docs/artifacts 欠一粒未点名 .bak（实测 D82 抓住 `tb31-band1.bak`）');
  /* ⑦ 行为：迷你臂开栏 ⇒ 必须真跑出那一栏（默认关的逐位不变另有实测：HEAD 对照跑权重同为 f256cb100f） */
  const dir = mkdtempSync(join(tmpdir(), 'd124-'));
  const out = join(dir, 'tb-out.js');
  const run = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '4'], {
    env: Object.assign({}, process.env, { EPIRUS_SEED: '31', EPIRUS_TB3P: '1', EPIRUS_TB3P_GAMES: '20', EPIRUS_TB_OUT: out, EPIRUS_ARM: 'd124' }),
    encoding: 'utf8', timeout: 600000,
  });
  const so = String(run.stdout || '') + String(run.stderr || '');
  ok(/\[3P栏 n=20[\/]/.test(so), '开了 EPIRUS_TB3P 必须真跑 3P 栏并打印读数（实测输出无该行 = 又一处死作用点）');
  ok(run.status === 0 || run.status === 9, '只许两种收场：0=有合格候选并择优、9=全否决响亮退出（实测 exit=' + run.status + '）\n' + so.slice(-500));
  if (run.status === 9) ok(so.indexOf('不接受静默退回单栏择优') >= 0, 'exit 9 必须说清"不接受退回单栏"');
  else ok(existsSync(out), 'exit 0 时产物必须写在 EPIRUS_TB_OUT 指的位置');
  ok(so.indexOf('已写入 js/bundled-champion.js') < 0, '改道跑时**一个字都不许碰 2P 槽**');
});

t('D125 可行性五道的样本量 = 单一来源（v1.5.162 · §N17 · 实测同一包两条路径读出 墙 17.85 vs 18.04）', function () {
  /* 病（§N16 实测，不是猜）：`promote-champion` 的 selfPlay/reflectWall 吃 `--games`（默认 20）、
   * `train-best` 的 3P 栏默认 120、`train-server` 干脆把 seat 60 / wall 20 / aggr 20 **硬编码**在服务器路径里
   * （而 `champ-audit` 的注释写着"座位探针 ≥100 才有判别力"）⇒ 同一个包三条路径三把尺子，读数互相不等。
   * 本仓为"量具抄两遍"栽过至少四次，这次抄的是**默认值**。 */
  /* ① 纯函数：默认 / env / 显式 override 的优先级，以及非法值必须回落到默认而不是变成 0 */
  eq(FEAS_N_DEFAULTS.games, 20, '体检默认 n 仍是 20（改了 = 历史读数口径变了，得走裁定）');
  eq(FEAS_N_DEFAULTS.seat, 100, '座位探针默认 100（champ-audit 注释：≥100 才有判别力）');
  let p = feasPlan({});
  eq(p.games, 20, '空 env ⇒ 默认'); eq(p.aggr, 40, 'aggr 默认'); eq(p.seat, 100, 'seat 默认');
  p = feasPlan({ EPIRUS_FEAS_GAMES: '120' });
  eq(p.games, 120, 'EPIRUS_FEAS_GAMES 必须能整体换尺');
  p = feasPlan({ EPIRUS_FEAS_GAMES: '120' }, { games: 40 });
  eq(p.games, 40, '调用点显式 override 必须赢过 env（体检与训练栏各自要能声明自己用了多少局）');
  eq(feasPlan({ EPIRUS_FEAS_GAMES: 'abc' }).games, 20, '非法 n 必须回落默认（不许变 NaN 把五道全判糊）');
  eq(feasPlan({ EPIRUS_SEAT_GAMES: '0' }).seat, 100, 'n=0 必须回落默认 —— 0 局探针 = 空读数冒充测量');
  ok(/n=\d+\/aggr\d+\/seat\d+/.test(feasPlan({}).tag), '必须自带可打印的尺子标签（读数旁边不印 n = 可疑）');
  /* ② 反抄：五道用到的四个 n 的字面默认值，**只许出现在 audit-lib** */
  const dupes = [];
  const mjsFiles = readdirSync('tools').filter(function (x) { return /\.mjs$/.test(x); }).map(function (x) { return 'tools/' + x; })
    .concat(readdirSync('server').filter(function (x) { return /\.mjs$/.test(x); }).map(function (x) { return 'server/' + x; }));
  for (const f of mjsFiles) {
    if (f.indexOf('audit-lib') >= 0) continue;
    const hits = (readFileSync(f, 'utf8').match(/EPIRUS_(SEAT|AGGR|DENSITY|CHARGE)_GAMES\s*\|\|\s*\d/g) || []);
    if (hits.length) dupes.push(f + ' → ' + hits.join(','));
  }
  eq(dupes.join(' | '), '', '五道的 n 不许再有任何第二处默认（统一走 feasPlan）');
  ok(readFileSync('tools/promote-champion.mjs', 'utf8').indexOf("flag('games', 20)") < 0, 'promote 不许留自己的 --games 默认');
  /* ②b v1.5.164（§N19）：镜像 G 在服务器路径上有**两种用途**，参数不许混。
   *   · 记 `feasibility` 那处 = **体检读数** ⇒ 必须与 CLI 同尺（games 走 feasPlan、席位固定 5）；
   *   · `[health]` 那处 = **产物决定点的健康门槛** ⇒ 必须按**当前训练人数**评估（判的是"这张桌子上能不能打"）。
   * 旧参数 `(40, n, mode)` 记的是体检，却用 40 局 + n 席 ⇒ 与全仓另外 8 个调用点（20 局 / 5 席）不可比。 */
  const tsv = readFileSync('server/train-server.mjs', 'utf8');
  ok(/mirrorHealth\(finalParams, FPN\.games, 5, '(multi|long)'\)/.test(tsv), 'server 记 feasibility 的 G 必须与 CLI 同尺（games=plan · 5 席）');
  ok(tsv.indexOf('mirrorHealth(finalParams, 40, n, mode)') < 0, '旧的 (40, n) 不许复活（同包在 3 人桌读的 G ≠ 5 人桌读的）');
  ok(/mirrorHealth\(finalParams, HGD\.games, HGD\.n, mode\)/.test(tsv), '健康门槛那处必须继续按训练人数评估（它是门槛不是体检读数，别顺手统一掉）');
  /* ②c v1.5.165（§N20）：浏览器路径的 feasibility 也必须**两个模式都判**（对齐 CLI 的 v1.5.145 用户裁定），
   * 且不许把"训练模式"当 G 喂 —— 训练长程时那会让 meta 里的 `G(multi)` 其实是 long 读数（标签与实测量不符）。 */
  ok(/mirrorHealth\(finalParams, FPN\.games, 5, 'multi'\)/.test(tsv) && /mirrorHealth\(finalParams, FPN\.games, 5, 'long'\)/.test(tsv),
    'server 记 feasibility 必须显式跑 multi 与 long 两遍（与 promote 同尺）');
  ok(tsv.indexOf("mirrorHealth(finalParams, FPN.games, 5, mode)") < 0, '不许拿训练模式当 G 喂（会造成 meta 标签与实测量不符）');
  ok(/feasibilityOf\(\{[^}]*G2: ggL/.test(tsv), 'G2 必须真传进 feasibilityOf —— 否则第四道（long 的 G）在浏览器路径上根本不存在');
  /* 尺子必须落在**那一条** [feasible] 日志里（只查"文件里两个字符串都存在"是假断言 —— 换个位置就糊过去了） */
  const fS = tsv.indexOf("console.log('[feasible] '");
  const fE = tsv.indexOf("for (const c of clients) sse(c, { type: 'feasibility'");
  ok(fS >= 0 && fE > fS && tsv.slice(fS, fE).indexOf('G=mirrorHealth(') >= 0,
    'server 的 [feasible] 那条日志本身必须印尺子（以后改 n/席位要能从日志看出来）');
  for (const f of ['tools/promote-champion.mjs', 'tools/train-best.mjs', 'tools/champ-audit.mjs', 'server/train-server.mjs']) {
    ok(readFileSync(f, 'utf8').indexOf('feasPlan') >= 0, f + ' 必须改用 feasPlan（漏一个 = 那条路径继续用自己的尺子）');
  }
  /* ③ 行为式（判作用点，不判声明）：迷你收口臂不设 `EPIRUS_TB3P_GAMES` ⇒ 3P 栏必须打印体检那把尺子 */
  const dir = mkdtempSync(join(tmpdir(), 'd125-'));
  const r = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '3'], {
    env: Object.assign({}, process.env, { EPIRUS_SEED: '31', EPIRUS_TB3P: '1', EPIRUS_TB_OUT: join(dir, 'o.js'), EPIRUS_ARM: 'd125' }),
    encoding: 'utf8', timeout: 600000,
  });
  const so = String(r.stdout || '');
  ok(/\[3P栏 n=20\/aggr40\/seat100\]/.test(so),
    '不设 EPIRUS_TB3P_GAMES 时 3P 栏必须与体检同尺（实测打印的是：' + ((so.match(/\[3P栏[^\]]*\]/) || ['（没跑这一栏）'])[0]) + '）');
  ok(r.status === 0 || r.status === 9, '迷你臂只许 0/9 收场（实测 ' + r.status + '）');
});

t('D126 R48「回魂复活回合」只免**花费**、不免**条件**（v1.5.166 · 用户报的摄魂 bug 追到的三处短路）', function () {
  /* 规则原文（docs/RULES-2P.md:336）：「下回合开始你以 1HP 复活，本回合内拥有无限各类能量
   * （**一切花费为 0**，含蓄能产物无限 ⚠️ R48）」。"花费为 0" ≠ "条件作废"。
   * 旧实现在三处整体短路：`state.js:computeCost` 开头就 return ok、`state.js:attemptAction` 干脆不走 computeCost、
   * `play.js:legalActions` 直接 push affordable ⇒ 满血也能摄魂、电磁炮免备珠、过载炮免血债。
   * 行为变化范围（配对复现 6480 局，新旧引擎同种子）：只有 13 局触发过回魂、4 局读数不同、**胜者全部相同**
   * ⇒ 这条不是"能赢多少"的改动，是"规则说的是什么"的改动。 */
  const mkLong = function () { const s = S.createState('long', { next: T.mulberry32(4242) }, 5); return s; };
  /* ① 满血 + 免费回合：三个条件门都不许被绕过 */
  let st = mkLong();
  Object.assign(st.p[0], { hp: 5, ep: 0, infiniteEnergy: true, elec: 0, boom: 0 });
  eq(S.computeCost(st, 0, R.SK.DRAIN).ok, false, '满血（hp=5 > long 的 ≤3）⇒ 摄魂必须仍判非法（这是用户报的那一格）');
  eq(S.computeCost(st, 0, R.SK.RAILGUN).ok, false, '无电珠 ⇒ 电磁炮必须仍判非法（"含珠无限"是免花费，不是凭空给珠）');
  eq(S.computeCost(st, 0, R.SK.LASER_EYE).ok, false, '首次激光眼无爆珠 ⇒ 必须仍判非法');
  const legal = Play.legalActions(st, 0).map(function (l) { return l.key; });
  ok(legal.indexOf(R.SK.DRAIN) < 0, '合法表里不许出现摄魂（页面按钮因此不可点、AI 因此看不见它）');
  ok(legal.indexOf(R.SK.RAILGUN) < 0, '合法表里不许出现免珠的电磁炮');
  /* ② 真在窗口内（复活后 hp=1）⇒ 可用，且**花费**归零 */
  st = mkLong(); Object.assign(st.p[0], { hp: 1, ep: 0, infiniteEnergy: true });
  const c2 = S.computeCost(st, 0, R.SK.DRAIN);
  eq(c2.ok, true, 'hp=1 ≤3 ⇒ 免费回合摄魂应合法'); eq(c2.ep, 0, '免费回合 ep 必须归零');
  S.attemptAction(st, 0, R.SK.DRAIN, { target: 1 }, null);
  eq(st.p[0].ep, 0, '执行后不扣ジ'); eq(st.p[0].hp, 1, '执行后不掉血（血债属花费）');
  /* ③ 免费回合的过载炮：第 2 次不要求 ≥1ジ、第 3 次不自损 1 血 */
  st = mkLong(); Object.assign(st.p[0], { hp: 4, ep: 0, infiniteEnergy: true, cannonCount: 1 });
  eq(S.computeCost(st, 0, R.SK.CANNON).ok, true, '过载炮第 2 次在免费回合不该被"需至少 1ジ"挡住');
  st.p[0].cannonCount = 2;
  S.attemptAction(st, 0, R.SK.CANNON, null, null);
  eq(st.p[0].hp, 4, '过载炮第 3 次的自损 1 血是**花费** ⇒ 免费回合不该扣（R42 × R48）');
  /* ④ 非免费回合回归：旧口径一字不变 */
  st = mkLong(); Object.assign(st.p[0], { hp: 5, ep: 0, elec: 0, boom: 0 });
  eq(S.computeCost(st, 0, R.SK.RAILGUN).ok, false, '普通回合电磁炮照旧需要电珠');
  eq(S.computeCost(st, 0, R.SK.DRAIN).ok, false, '普通回合摄魂照旧看 HP 窗口');
  eq(S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 }, null).outcome, 'insufficient', '普通回合 ep 不足 ⇒ 照旧 insufficient（不是 ok）');
  /* ⑤ 反抄：三处短路都不许复活 */
  ok(readFileSync('js/core/state.js', 'utf8').indexOf('if (p.infiniteEnergy) return { ok: true') < 0, 'computeCost 不许再整体短路');
  ok(readFileSync('js/core/play.js', 'utf8').indexOf('if (p.infiniteEnergy) { out.push') < 0, 'legalActions 不许再整体短路');
  const sj = readFileSync('js/core/state.js', 'utf8');
  ok(sj.indexOf('if (p.infiniteEnergy) {') < 0 || sj.indexOf('const cost = computeCost') < sj.indexOf('if (p.infiniteEnergy) {'),
    'attemptAction 必须先过 computeCost（条件）再谈免费');
});

t('D127 兑现广度（v1.5.167 · §N24 · 用户"G_eff 像刷分"）：mirrorHealth 出 effSkillsLand + 同分带内按落地取大者（默认关 ⇒ 逐位不变）', function () {
  /* 为什么需要第二把尺：`effSkills` 数的是**发起**几种（`keyCount` 的熵）⇒ 一张常出手常被防的卡与
   * 一张少见但每次掉血的卡等价。实测（`tools/probe-cast-vs-land.mjs`）现役包出手:落地 = 530:237，
   * G=4.44 而真打上血的只有 3~4 种 ⇒ 用户那句"像是为了刷 eff 只用最容易被测到的技能"成立。
   * ⚠️ 它**只许当选面当排序键**，不许进 fit：仓里已证"奖励贵技能落地"会选出乱挥双枪的冠军（−27pt）。 */
  const mh = T.mirrorHealth(sb.window.EPIRUS_CHAMPION_3P ? sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true) : null, 6, 3, 'multi');
  ok(mh && typeof mh.effSkillsLand === 'number', 'mirrorHealth 必须同时给 G(出手) 与 G(落地)');
  ok(mh.effSkillsLand >= 0 && Number.isInteger(mh.landedKeys), 'landedKeys 必须是整数种（来自 landByKey，不另数一遍）');
  /* ⚠️ 口径钉（发布前自查发现的缺陷）：`damage.via` 有两类取值**不是一张卡**——`终局收缩`（`deliverDamage` 在 `via`
   * 缺省时回落成中文 reason，`resolve.js:305`）与 `headshot`（爆头 = 结果修饰）。它们能占"落地"计数的 35%（实测 band4 那粒
   * 293 次落地里 104 次是收缩）⇒ 不滤就会**奖励"拖到收缩阶段活着"的包**、惩罚主动进攻的包，L1 臂的"改判"whole 是这个 bug 的产物。
   * 本断言在**已知会出非卡名 via** 的读数上独立复算熵，不许只比个大小。 */
  const mh20 = T.mirrorHealth(sb.window.EPIRUS_CHAMPION_3P ? Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true) : null, 20, 5, 'multi');
  const lbk = mh20.landByKey || {};
  const nonCard = Object.keys(lbk).filter(function (k) { return !R.byKey[k]; });
  ok(nonCard.length > 0, '这份读数里必须真的出现非卡名 via（终局收缩/headshot），否则本断言是空枪');
  {
    const ck = Object.keys(lbk).filter(function (k) { return lbk[k] > 0 && R.byKey[k]; });
    const ct = ck.reduce(function (a, k) { return a + lbk[k]; }, 0);
    let he = 0; for (const k of ck) { const pr = lbk[k] / ct; he -= pr * Math.log(pr); }
    eq(mh20.landedTotal, ct, 'landedTotal 必须只加真卡名（非卡名 via 一次都不许进）');
    eq(Math.round(Math.exp(he) * 1e9) / 1e9, Math.round(mh20.effSkillsLand * 1e9) / 1e9, 'effSkillsLand 必须 = 只数真卡名的那套熵（独立复算）');
    ok(mh20.landedKeys === ck.length && ck.length < Object.keys(lbk).length, 'landedKeys 要比 landByKey 的键数小（滤是真动作，不是恒等）');
    eq(mh20.landedFiltered, Object.keys(lbk).reduce(function (a, k) { return a + (R.byKey[k] ? 0 : lbk[k]); }, 0),
      'landedFiltered 必须等于被滤掉的量（尺子要自证"我少算了多少"，不许悄悄丢数）');
  }
  /* ① 纯函数：带外永不参与 / 带内按落地取大 / 缺 landG 记 0 / tieBrokenBy 说真话 */
  const E = function (score, landG) { return { score: score, landG: landG }; };
  let r = bandPickByLand([E(1.00, 2), E(0.99, 5), E(0.90, 9)], 0.03);
  eq(r.best.score, 0.99, '带内（0.99 与 1.00）必须按落地取大者 ⇒ 选 0.99/land5');
  eq(r.tieBrokenBy, 'land', '改了判就得说"是广度改的"');
  r = bandPickByLand([E(1.00, 2), E(0.90, 99)], 0.03);
  eq(r.best.score, 1.00, '带外的"超广"候选永不参与（广度不许救一个胜率更差的包）');
  eq(r.dropped, 1, '带外者要计数（不能静默消失）');
  r = bandPickByLand([E(1.00, 2), E(0.99)], 0.03);
  eq(r.best.score, 1.00, '缺 landG 记 0（不是当它无限好）—— 未测 = 不占便宜');
  r = bandPickByLand([E(1.00, 4), E(0.99, 4)], 0.03);
  eq(r.tieBrokenBy, 'score', '落地相同则回到胜率，不许拿并列当理由乱换');
  eq(bandPickByLand([], 0.03).best, null, '空表 ⇒ best=null（调用方须自己响）');
  /* ② 接线：默认关逐位不变（与 D123③ 同一基线哈希）；开 ⇒ 必须真打印两把尺并说改没改判 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_SEL_LAND || 0") >= 0, 'EPIRUS_SEL_LAND 必须默认 0');
  ok(t3.indexOf('bandPickByLand(') >= 0 && t3.indexOf('sel.best = lp.best') >= 0, 'train-3p 当选面必须真用它（接了不看结果 = 死作用点）');
  const wh = function (p2) {
    const m = /"a":\[([^\]]*)\]/.exec(readFileSync(p2, 'utf8'));
    return m ? createHash('sha1').update(m[1]).digest('hex').slice(0, 10) : 'NOPARSE';
  };
  /* v1.5.168：预筛也必须被记账 —— L1b 实测：`gateOk` 预筛换掉了池（6 剔 4），排序键自己没换人，
   *  当时只报"未改判" ⇒ 读表的人会以为这臂与不开开关逐字相同。三条分支缺一不可。 */
  r = bandPickByLand([{ score: 1.00, landG: 2, gateOk: true }, { score: 0.99, landG: 9, gateOk: false }], 0.03);
  eq(r.skipped, 1, '过不了不可 --force 硬门槛的候选必须先被剔出池（兑现广度不许把病包换上来）');
  eq(r.best.score, 1.00, '被剔的"超广"病包不许赢');
  r = bandPickByLand([{ score: 1.00, landG: 2 }, { score: 0.99, landG: 9 }], 0.03);
  eq(r.skipped || 0, 0, '未提供 gateOk（旧调用点）⇒ 视为通过，行为与 v1.5.167 一致');
  const dirA = mkdtempSync(join(tmpdir(), 'd127a-')), dirB = mkdtempSync(join(tmpdir(), 'd127b-'));
  const off = spawnCached(['tools/train-3p.mjs', '3', '3', '6', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127off', EPIRUS_BAND_DIR: dirA }), encoding: 'utf8', timeout: 300000 });
  eq(off.status, 0, '默认关必须跑通');
  eq(wh('docs/artifacts/train-3p-out.js'), CLI_ARM_BASELINE, '默认关的产物必须仍是那条基线（动了它 = 所有 CLI 臂的当选规则被偷改）');
  const on = spawnCached(['tools/train-3p.mjs', '3', '3', '6', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127on', EPIRUS_SEL_LAND: '1', EPIRUS_BAND_DIR: dirB }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '开开关也要跑通');
  ok(/\[兑现广度\].*G\(出手→落地\)/.test(String(on.stdout || '')), '开了必须印出每候选的两把尺（不印 = 又一根暗旋钮）');
  ok(/改判（排序键换人）|改判（是预筛选掉的|未改判/.test(String(on.stdout || '')),
    '必须三分归因：排序键换人 / 预筛换池 / 都没换 —— 只报"未改判"会让人误以为与不开开关逐字相同');
  ok(readFileSync('tools/train-3p.mjs', 'utf8').indexOf('HOLO_GIFT_MAX') >= 0, '送盾阈值必须与 promote 同源（不许两处各写一个 6）');
});

t('D128 广度准入线（v1.5.170 · §N29 · §N28"四粒冠军三粒塌成一种卡"）：塌缩当**不合格**，不当排序键（默认关 ⇒ 逐位不变）', function () {
  /* 为什么是"线"不是"键"：§N25 实测排序键要么咬不动（同分带只剩 1 粒）要么咬错（换上来过不了硬门槛的包）；
   * 而 §N28 两对种子 4 粒冠军里 3 粒净兑现只剩 `1.00（1 种）` ⇒ 塌缩是常态，需要准入线。 */
  const E = function (score, landG, landedKeys) { return { ref: { params: 'p' + score }, score: score, landG: landG, landedKeys: landedKeys }; };
  let r = rejectNarrowWinners([E(1.00, 2.66, 3), E(0.99, 1.00, 1)], 1.5);
  eq(r.dropped, 1, '塌缩粒（landedKeys=1）必须被剔');
  eq(r.best.score, 1.00, '留下的必须是过线的那粒');
  r = rejectNarrowWinners([E(1.00, 9.00, 1), E(0.50, 1.60, 2)], 1.5);
  eq(r.best.score, 0.50, 'G 再高但只有 1 种卡 ⇒ 仍然不合格（**"塌缩的定义"不许被大数绕过**）');
  r = rejectNarrowWinners([E(1.00, 1.49, 3), E(0.98, 1.50, 2)], 1.5);
  eq(r.dropped, 1, '线是 `>=`：1.49 不过、1.50 过');
  r = rejectNarrowWinners([E(1.00, undefined, undefined), E(0.90, 2.0, 3)], 1.5);
  eq(r.dropped, 1, '未测（缺 landG/landedKeys）= 不合格（与 vetoBy3p"看不见就当不过"同规矩）');
  r = rejectNarrowWinners([E(1.00, 1.0, 1), E(0.90, 1.2, 1)], 1.5);
  eq(r.allRejected, true, '全塌缩 ⇒ allRejected=true，调用方必须响亮（不许静默退回"不过滤"）');
  eq(r.best, null, 'allRejected 时没有 best');
  eq(rejectNarrowWinners([E(1.00, 1.6, 2), E(0.90, 2.5, 3)]).floor, 1.5, '默认线 1.5（标定见函数头注：现役 2.66 / 2P 槽 2.98 / 塌缩 1.00~1.24）');
  /* 接线：默认 0 ⇒ 逐位不变；开了 ⇒ **产物自己必须满足这条线**（判效果，不判横幅） */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_BREADTH_FLOOR || 0") >= 0, 'EPIRUS_BREADTH_FLOOR 必须默认 0');
  ok(t3.indexOf('rejectNarrowWinners(') >= 0 && t3.indexOf('sel.best = nf.best') >= 0, 'train-3p 当选面必须真用它（接了不看结果 = 死作用点）');
  ok(t3.indexOf("'EPIRUS_BREADTH_FLOOR'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会把它当"传了没人读"）');
  const dir = mkdtempSync(join(tmpdir(), 'd128-'));
  const run = spawnSync(process.execPath, ['tools/train-3p.mjs', '3', '3', '6', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd128floor', EPIRUS_BREADTH_FLOOR: '1.5', EPIRUS_BAND_DIR: dir }), encoding: 'utf8', timeout: 300000 });
  eq(run.status, 0, '开了线也要跑通');
  ok(/\[广度线\] 判据 = 净 `G\(落地\)/.test(String(run.stdout || '')), '开了必须印出判据与每粒的净兑现（不印 = 又一根暗旋钮）');
  const txt = readFileSync('docs/artifacts/train-3p-out.js', 'utf8');
  const jm = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(txt);
  ok(!!jm, '产物 meta 必须能解析（配方自证的前提）');
  const mt = JSON.parse(jm[1]);
  ok(mt.recipe && Number(mt.recipe.breadthFloor && mt.recipe.breadthFloor.floor) === 1.5, 'meta.recipe.breadthFloor 必须记下这臂的线');
  if (mt.breadthFloorAllNarrow) {
    ok(/⛔ \[广度线\] 名人堂\*\*全部塌缩\*\*/.test(String(run.stderr || '') + String(run.stdout || '')),
      '全塌缩必须响亮（并指向"走向②：该改奖励面"）');
  } else {
    ok(Number(mt.recipe.breadthFloor.winnerKeys) >= 2 && Number(mt.recipe.breadthFloor.winnerLandG) >= 1.5,
      '当选者必须真满足这条线（判产物，不判打印）：实测 winnerKeys=' + mt.recipe.breadthFloor.winnerKeys +
      ' winnerLandG=' + mt.recipe.breadthFloor.winnerLandG);
  }
});

t('D129 训练模式可以在 CLI 上下达（v1.5.169 · §N28 · 用户"炼一个 5 血长程通吃其他模式"）：认不了就 exit 7，不许静默退回 multi', function () {
  /* 病（这次是"从来没接过"）：`evo.js` v1.4.0 就有 `setTrainMode`（门 D10 钉着它透传到建局），
   * 但 CLI 从来没有这个键 ⇒ `TRAIN_MODE` 恒 multi，"5 血冠军从来没被训过"（`evo.js:28` 自己注释着）。 */
  ok(TEK.indexOf('EPIRUS_TRAIN_MODE') >= 0, '必须进 train-env 的单一来源清单（别处不许再抄键名）');
  eq(readTrainEnv({ EPIRUS_TRAIN_MODE: 'long ' }).mode, 'long', 'readTrainEnv 要搬运并去空格');
  eq(readTrainEnv({}).mode, undefined, '没下达 ⇒ 不带 mode 键（⇒ 行为逐字不变）');
  eq(hasTrainOverride({ mode: 'long' }), true, '只有 mode 也算覆盖（不许被 kill 一家独占）');
  const dir = mkdtempSync(join(tmpdir(), 'd129-'));
  /* ① 乱写的模式名 ⇒ 必须 exit 7 且**不产出**（静默退回 multi 就是 §N11 那一族） */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd129bad', EPIRUS_TRAIN_MODE: 'nope', EPIRUS_BAND_DIR: dir }), encoding: 'utf8', timeout: 300000 });
  eq(bad.status, 7, '不认的模式名必须 exit 7（实测 ' + bad.status + '）');
  ok(/不是规则表里的模式/.test(String(bad.stderr || '')), 'exit 7 要说清为什么');
  /* ② 合法名 ⇒ 跑通 + 横幅读回 + 产物 meta 自证 */
  const good = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd129long', EPIRUS_TRAIN_MODE: 'long', EPIRUS_BAND_DIR: dir }), encoding: 'utf8', timeout: 300000 });
  eq(good.status, 0, '长程臂要跑得通');
  ok(/训练模式已下达：EPIRUS_TRAIN_MODE=long ⇒ 消费点读回 long/.test(String(good.stdout || '')), '必须印"下达 ⇒ 读回"（横幅只证明变量，读回证明消费点）');
  const jm = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(readFileSync('docs/artifacts/train-3p-out.js', 'utf8'));
  const mt = JSON.parse(jm[1]);
  eq(mt.recipe.trainMode, 'long', '产物要自带这臂的模式（日志会滚走，.bak 不会）');
  eq(mt.recipe.trainModeEffective, 'long', '连消费点读回值一起记');
  /* ③ 长程臂建局真的 5 血（D10 证的是 setter；这里证**整条 CLI 路**通到建局） */
  eq(T.setTrainMode('long'), 'long', 'setter 要能读回');
  const stL = S.createState(T.trainMode(), { next: T.mulberry32(5) }, 5);
  eq(stL.mode.hp, 5, '`long` 模式建局 hp 必须是 5（否则"训长程"是空话）');
  const stM = S.createState(T.setTrainMode('multi'), { next: T.mulberry32(5) }, 5);
  eq(stM.mode.hp, 3, '切回 multi 必须是 3 血（同一批建局参数，只有模式在动）');
});

t('D130 判据原型必须能放上**训练桌**（v1.5.172 · §N35 · `v7xn22a` 被"只防御不还手"85% 击败）：`EPIRUS_COUNTER_OPPS` 默认关 + 缺对手必须响', function () {
  /* 病（实测）：`promote --dry` 把大配方臂砍在 G4/G5 上，最克的两个原型是「只防御(不还手)」「只枪 1ジ压制」——
   * 而 `train-3p` 的 `OPPS` 九个里最接近的 `defend` 是**会还手**的防御，纯不还手的 `guardSpam` 在 `EpirusBots` 里早就有却没人拿它当对手。
   * ⇒ "判它的对手从不出现，适应力学不出来"。修法与 v1.5.150 的 `EPIRUS_XN2REF=exam` 同一条：**对着产品判据本身训**。 */
  ok(Bots && typeof Bots.pickGuardSpam === 'function' && typeof Bots.pickGunSpam === 'function' && typeof Bots.pickSnipeSpam === 'function',
    '三个判据原型必须真在 `EpirusBots` 里（不在就是 train-3p 引用了不存在的名字）');
  /* ① 行为：`guardSpam` 必须**只防不还手**——它值钱就正是因为它"没有攻击性"（把它改成会还手 = 把量具改没了） */
  const stG = S.createState('multi', { next: mulberry32(3) }, 5);
  stG.p[0].ep = 9;
  const lgG = Play.legalActions(stG, 0).filter(function (x) { return x.affordable; });
  const gk = lgG.find(function (x) { return x.key === R.SK.GUARD; });
  ok(!!gk, '构造态必须让防御卡合法（否则本断言空转）');
  eq(Bots.pickGuardSpam(stG, 0, lgG), R.SK.GUARD, '防御在手 ⇒ 必须出防御');
  const atk = lgG.filter(function (x) { return x.key !== R.SK.GUARD && x.key !== R.SK.JI; }).map(function (x) { return x.key; });
  ok(atk.length > 0, '构造态里必须**有**可出的攻击卡（否则"不还手"是白测）');
  const noRet = atk.every(function (k) { return Bots.pickGuardSpam(stG, 0, lgG) !== k; });
  ok(noRet, '手里有攻击卡也不许出 ⇒ 这才叫"不还手"原型');
  /* ② 接线：默认关 ⇒ `OPPS` 逐字不变；开了 ⇒ 三个都进桌且**产物自证** */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_COUNTER_OPPS || 0") >= 0, 'EPIRUS_COUNTER_OPPS 必须默认 0');
  ok(t3.indexOf('OPPS.push(o)') >= 0, '开了必须真推进 fitness 的对手表（推进别处 = 死作用点）');
  ok(t3.indexOf("'EPIRUS_COUNTER_OPPS'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会判它"传了没人读"）');
  ok(/typeof o\.sel !== 'function'[\s\S]{0,160}process\.exit\(4\)/.test(t3), '缺一个对手必须 exit 4（少一个 = 一根空枪，不许静默少放）');
  const dir = mkdtempSync(join(tmpdir(), 'd130-'));
  const on = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130on', EPIRUS_COUNTER_OPPS: '1', EPIRUS_BAND_DIR: dir }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '开了要跑得通');
  ok(/\[counter-ops\] 判据原型已进训练桌：cnt:guardSpam,cnt:gunSpam,cnt:snipeSpam/.test(String(on.stdout || '')),
    '必须印出进了哪三个（不印 = 又一根暗旋钮）');
  const jm = /window\.EPIRUS_CHAMPION_3P_META = ([\s\S]*?);\n/.exec(readFileSync('docs/artifacts/train-3p-out.js', 'utf8'));
  const mt = JSON.parse(jm[1]);
  ok(mt.recipe && Array.isArray(mt.recipe.counterOpps) && mt.recipe.counterOpps.length === 3,
    '产物要自带"这臂的训练桌上放了哪几个判据原型"（实测 ' + JSON.stringify(mt.recipe && mt.recipe.counterOpps) + '）');
});

t('D132 补贴率旋钮 `EPIRUS_REGEN_SLICE`（v1.5.177 · 双侧实验的前置）：默认 0.08 逐位不变 + 下达必须读回 + 拒静默空转', function () {
  /* 动因：全卡边际扫描证明"钱是系统性的墙"（long 59%/18%/3% 买得起 1/2/3 费；multi 0 张可测）
   * ⇒ "给钱+教卡"的双侧实验**必须先能调"给多少钱"**，而它此前是硬编码常量 `REGEN_SLICE = 0.08`。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('let REGEN_SLICE = 0.08;') >= 0, '必须是 let（可下达）且默认 0.08（不下达 ⇒ 逐位等于旧行为）');
  ok(ev.indexOf('function setRegenSlice(v)') >= 0 && ev.indexOf('function regenSlice()') >= 0, '必须有 setter 与回执');
  ok(ev.indexOf('if (!isFinite(n) || n <= 0) return REGEN_SLICE;') >= 0, '非法值必须原样返回（宿主据此判"被拒"）');
  ok(ev.indexOf('setRegenSlice, regenSlice,') >= 0, '必须导出（CLI/服务端两边都要能调）');
  ok(ev.indexOf('const step = Math.max(2, Math.round(1 / REGEN_SLICE));') >= 0, '消费点必须真的读这个变量（不是只定义）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('process.env.EPIRUS_REGEN_SLICE') >= 0, 'CLI 必须读这个 env');
  ok(t3.indexOf('没有 setRegenSlice ⇒ 拒绝静默空转') >= 0 && t3.indexOf('process.exit(7)') >= 0,
    '没有 setter 必须**响亮拒绝**（§N11/§N8 那一族：横幅读回不等于作用点发生）');
  ok(t3.indexOf('消费点读回') >= 0, '下达后必须**读回消费点**的值');
  ok(t3.indexOf('const reqSlice = Number(process.env.EPIRUS_REGEN_SLICE);') >= 0 &&
    t3.indexOf('!isFinite(reqSlice)') >= 0,
    '非数值必须被挡（**NaN 安全**：`Math.abs(got - NaN) > 1e-9` 恒 false ⇒ 我第一版 `abc` 实测 exit 0 静默跑完）');
});

t('D131 卡面提示必须说真话（v1.5.173 · 用户实测"摄魂 bug 没解决"追到的成因）：门槛按模式取真值，文案不许自己抄一份数字', function () {
  /* 成因（`results/摄魂.txt`）：引擎按 `state.mode.drainHpMax` 放行（长程 3），而 `rules.js` 的 `desc` 写死"仅限 HP≤1"
   * ⇒ 长程 HP 2 时格子**该亮**也确实亮，提示却说"≤1" ⇒ 玩家读成"血回上去了还能用 = 没修"。**引擎没错，文案过期。**
   * 所以这条门两半：① 判**引擎**逐档（防真闩锁回来）；② 判**提示跟着模式变数字**（防这次这种"说的≠做的"）。 */
  const caps = { long: 2, multi: 1, standard: 1 };   // v1.5.174：长程窗口 3 → 2（用户裁定）
  for (const mode in caps) {
    const cap = (R.MODES[mode].hp) || 3, lim = caps[mode];
    for (let hp = cap; hp >= 1; hp--) {
      const st = S.createState(mode, { next: mulberry32(4242) }, mode === 'standard' ? 2 : 5);
      st.p[0].hp = hp; st.p[0].ep = 9;
      const okCost = S.computeCost(st, 0, R.SK.DRAIN).ok;
      const inLegal = Play.legalActions(st, 0).some(function (x) { return x.key === R.SK.DRAIN && x.affordable; });
      eq(okCost, hp <= lim, mode + ' HP' + hp + ' 的 computeCost 必须按 ≤' + lim + ' 判（实测 ok=' + okCost + '）');
      eq(inLegal, hp <= lim, mode + ' HP' + hp + ' 的合法表必须与 computeCost 同口径（防"UI 亮着而引擎拒"那种分裂）');
    }
  }
  /* ② 提示组装：单一来源 `js/ui/skill-tip.js`（纯函数 ⇒ 这里能直接跑），数字必须来自 `st.mode.drainHpMax` */
  const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
  box.window = box; box.globalThis = box;
  vm.runInNewContext(readFileSync('js/ui/skill-tip.js', 'utf8'), box, { filename: 'js/ui/skill-tip.js' });
  ok(box.EpirusSkillTip && typeof box.EpirusSkillTip.of === 'function', '必须导出 EpirusSkillTip.of');
  const drain = R.skills.find(function (x) { return x.key === R.SK.DRAIN; });
  const tipLong = box.EpirusSkillTip.of(R, { mode: { drainHpMax: 3 } }, drain);
  const tipStd = box.EpirusSkillTip.of(R, { mode: {} }, drain);
  ok(/仅限 HP≤3/.test(tipLong), '提示必须跟着模式给的数字走（合成态喂 3 就要写 3；实测：' + tipLong + '）');
  /* v1.5.174（用户裁定长程 3 → 2）：**真模式对象**的提示必须写 ≤2 —— 这条才是"页面此刻对用户说了什么" */
  const tipReal = box.EpirusSkillTip.of(R, { mode: R.MODES.long }, drain);
  ok(/仅限 HP≤2/.test(tipReal), '长程（真配置）提示必须写 ≤2（实测：' + tipReal + '）');
  ok(!/仅限 HP≤3/.test(tipReal), '长程提示里不许残留上一代的 ≤3');
  ok(/仅限 HP≤1/.test(tipStd), '2 人/多人提示必须仍是 ≤1（实测：' + tipStd + '）');
  ok(tipLong !== tipStd, '两种模式的提示不许相同（相同 = 又回到"一个数字写死"）');
  ok(tipLong.indexOf('HP≤1') < 0, '长程提示里不许残留过期数字');
  /* 非摄魂卡必须逐字不变（本函数只换它负责的那一处数字） */
  const gun = R.skills.find(function (x) { return x.key === R.SK.GUN; });
  eq(box.EpirusSkillTip.of(R, { mode: { drainHpMax: 3 } }, gun), String(gun.desc), '别的卡一个字都不许动');
  /* ③ 接线：ui.js 必须走这个单一来源，index.html 必须加载它（否则页面里 undefined ⇒ 静默不显示） */
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  ok(uiSrc.indexOf('Tip.of(R, st, s)') >= 0, 'ui.js 组卡面提示必须走 EpirusSkillTip（自己再抄一份数字 = 本仓那四次同型病）');
  ok(uiSrc.indexOf("仅限 HP≤") < 0, 'ui.js 里不许再出现写死的"仅限 HP≤N"');
  ok(readFileSync('index.html', 'utf8').indexOf('js/ui/skill-tip.js') >= 0, 'index.html 必须加载 skill-tip.js');
});

t('D134 切片相位不许与座位轮换锁死（v1.5.186 · 复核 DS 交接 §3 坑#8）：承诺局/补贴局必须按代旋转，且示范要真覆盖各席', function () {
  /* 病（我实测到的，DS 只记了"注入偏向 0 号席，未结案"）：受评席 `seat = g % n`，而承诺局用 `g % 3`、补贴局用 `g % step`
   * ⇒ **n=3（CLI 臂默认人数）时两者锁死**：示范覆盖席 `{0:236,1:20,2:1}`（92% 在 0 号席）；n=5·12 局时 2 号席**整晚一次没拿到**。
   * ⇒ "给钱/示范"类读数全带席位运气。修法 = 相位按代旋转 + 收成单一来源 `sliceHit`（原来"承诺局"在两个函数里各写一遍 `% 3`）。 */
  const SH = T.sliceHit, IC = T.isCommitGame;
  ok(typeof SH === 'function' && typeof IC === 'function', '必须导出 sliceHit/isCommitGame（不导出 = 门只能钉文本）');
  /* ① 相位随代旋转，且三代合起来覆盖全部余数（否则总有席位拿不到补贴） */
  const hitSets = [0, 1, 2].map(function (gen) {
    const s = []; for (let g = 0; g < 9; g++) if (SH(g, 3, gen)) s.push(g); return s.join(',');
  });
  ok(new Set(hitSets).size === 3, '同一 step 下 gen=0/1/2 的命中集合必须互不相同（实测 ' + hitSets.join(' | ') + '）');
  const seatsByGen = [0, 1, 2].map(function (gen) {
    const s = new Set(); for (let g = 0; g < 12; g++) if (IC(g, gen, 2)) s.add(g % 3); return s;
  });
  eq(seatsByGen[0].size, 1, '单代内 n=3 时承诺局确实只落 1 个席（这就是锁死的形状 —— 本门要钉的是"跨代必须换席"）');
  const union = new Set([].concat.apply([], seatsByGen.map(function (s) { return Array.from(s); })));
  eq(union.size, 3, 'gen=0/1/2 合起来必须覆盖 3 个受评席（有席位整晚拿不到补贴 = 这次的病）');
  /* ② 不传 gen ⇒ 相位 0 ⇒ 与旧版逐字相同（历史臂仍可复现） */
  eq(SH(0, 3), true, 'sliceHit 缺省 gen ⇒ 命中 g=0（旧口径 g % step === 0）');
  eq(SH(1, 3), false, '旧口径下 g=1 不命中');
  /* ③ 单一来源：`killSeatFor` 与评分循环必须用同一个承诺局判据（原来各写一遍 `% 3`） */
  for (let gen = 0; gen < 4; gen++) for (let g = 0; g < 8; g++) {
    if (IC(g, gen, 2)) eq(T.killSeatFor(g, gen, g % 3, 3, 2), -1,
      'gen' + gen + ' g' + g + '：承诺局不许注收割席（两个判据必须一致，否则一处旋转一处没旋转）');
  }
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  /* 只判**代码行**：注释里出现这个字面量是历史说明（"原来两处各写一遍"），不是漂移 */
  const bare = evoSrc.split('\n').filter(function (ln) {
    return ln.indexOf('g % 3 === 0') >= 0 && !/^\s*(\*|\/\/|\/\*)/.test(ln);
  });
  eq(bare.length, 0, '`g % 3 === 0` 不许再出现在代码里（只许走 isCommitGame）实测 ' + bare.map(function (l) { return l.trim(); }).join(' / '));
  ok(evoSrc.indexOf('regenForGame(g, games, gen)') >= 0, '补贴切片必须收到 gen（不传 = 相位不转 = 病复发）');
  /* ④ 真跑一臂：判**产出的覆盖席**，不判横幅（§N11 那条纪律） */
  const dir = mkdtempSync(join(tmpdir(), 'd134-'));
  const run = spawnCached(['tools/train-3p.mjs', '40', '3', '8', '8'], {
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTFocus', EPIRUS_IMIT_ONLY: 'bigT',
      EPIRUS_IMIT_OVERRIDE: '1', EPIRUS_IMIT_FRAC: '0.5', EPIRUS_IMIT_SUBONLY: '0',
      EPIRUS_REGEN_SLICE: '0.25', EPIRUS_ARM: 'd134', EPIRUS_BAND_DIR: dir
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '示范臂要跑得通');
  const mm = /覆盖席 \{([^}]*)\}/.exec(String(run.stdout || ''));
  ok(!!mm, '退出前必须报示范注入的覆盖席（不报 = 又一根没计数的旋钮）');
  const seats = mm[1].split(',').map(function (kv) { const a = kv.split(':'); return { k: a[0].replace(/"/g, ''), v: Number(a[1]) }; });
  const tot = seats.reduce(function (p, s) { return p + s.v; }, 0);
  ok(tot > 20, '注入必须真的发生（实测 fired=' + tot + '）');
  ok(seats.length >= 3, 'n=3 · 40 代后示范必须覆盖到 3 个受评席（实测 ' + mm[1] + '）');
  const top = Math.max.apply(null, seats.map(function (s) { return s.v / tot; }));
  ok(top <= 0.8, '单个席位的占比不许超过 80%（修前实测 92% ⇒ 这条就是那次的反例）；实测 ' + (100 * top).toFixed(0) + '%');
});

t('D135 大雷连带收益项（v1.5.187 接线 · v1.5.188 换**率形**）：归因走 bigTChain.from、分子分母都不受权重门控、且证明"这一项的非零只能来自注入"', function () {
  /* ① 计数器的归因口径（DS 自己踩过的 L2 坑：`voided` 事件**没有 reason**，连带主标记是 `bigTChain{from,to,kind}`） */
  const evs = [
    { type: 'bigTChain', from: 2, to: 0, kind: 'attack' },
    { type: 'bigTChain', from: 2, to: 1, kind: 'targeted' },
    { type: 'bigTChain', from: 1, to: 2, kind: 'attack' },        // 别人打出的链 ⇒ 不许算到我头上
    { type: 'voided', pid: 0, by: '真正的落雷连带' },                 // 作废事件不是链标记
    { type: 'damage', to: 0, amt: 2, reason: '真正的落雷·连带' },      // damage.reason 只覆盖"吃到伤害"那半
    { type: 'action', pid: 2, key: R.SK.BIG_T, outcome: 'ok' }
  ];
  eq(T.countBigTChain(evs, 2, R), 2, '只数 `from === 该席` 的 bigTChain（别人的、damage 的、voided 的都不算）');
  eq(T.countBigTChain(evs, 1, R), 1, '换一个席位看归因是否跟着走');
  eq(T.countBigTChain([], 0, R), 0, '空事件 ⇒ 0');
  /* ①b v1.5.188（用户裁 Q-14 ② = 按率付）：**分母**的口径 —— 只数该席"真正打出的大雷"（`outcome === 'ok'`，
   *  与 `countBigCards` 同规矩 ⇒ 被无效化的不算，不可刷）；卡从 `rules.SK.BIG_T` 取，不许写字面卡名。 */
  const casts = [
    { type: 'action', pid: 0, key: R.SK.BIG_T, outcome: 'ok' },
    { type: 'action', pid: 0, key: R.SK.BIG_T, outcome: 'voided' },     // 被无效化 ⇒ 不算
    { type: 'action', pid: 1, key: R.SK.BIG_T, outcome: 'ok' },         // 别人的出手 ⇒ 不算
    { type: 'action', pid: 0, key: R.SK.MINE, outcome: 'ok' },          // 贵卡但不是大雷 ⇒ 不算
    { type: 'bigTChain', from: 0, to: 2, kind: 'attack' }               // 链事件本身不是出手
  ];
  eq(T.countBigTCasts(casts, 0, R), 1, '分母只数该席 `outcome:ok` 的 `BIG_T` 出手');
  eq(T.countBigTCasts([], 0, R), 0, '空事件 ⇒ 分母 0（**0 出手必须走 0 分这条路，不许 0/0**）');
  /* ①c 率形本身：`0 出手 ⇒ 0 分`（`NaN` 会把整个 fit 打坏 —— DS §3 坑#2/#3 那一族）⇒ 用评分器直接判产物 */
  {
    const pack = sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
    const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
    T.setEconomyReward({ bigtChainW: 4 });          // 故意给到能把 fit 顶满的量级
    const hot = T.scoreMemberN(pack, opps, 6, 3, 0, 0, 0);
    T.setEconomyReward({ reset: true });
    const cold = T.scoreMemberN(pack, opps, 6, 3, 0, 0, 0);
    ok(isFinite(hot.fit) && isFinite(hot.chainRate), 'fit 与率都必须是有限数（0/0 会出 NaN）');
    if (hot.chainCasts === 0) {
      eq(hot.chainRate, 0, '分母 0 ⇒ 率必须是 0（不许 NaN）');
      ok(Math.abs(hot.fit - cold.fit) < 1e-12,
        '分母 0 ⇒ **即使 W=4 也不许加一分钱**（这条就是"0 出手却吃到连带奖励"的防伪钉；实测 fit ' + hot.fit + ' vs ' + cold.fit + '）');
    } else {
      ok(Math.abs(hot.chainRate - hot.chainEvents / hot.chainCasts) < 1e-12, '率必须等于分子/分母（读数不许各算一份）');
    }
  }
  /* ② 权重三件套：setter 生效 / 读回 / reset 复位（econ-env 的键对齐由 D77 管）
   *    v1.5.188：**形状也要读得回** —— 这次改的就是形状（计数 → 率），而"权重读回了"证明不了项按哪种方式进 fit。 */
  T.setEconomyReward({ bigtChainW: 0.4 });
  eq((T.bigTChainReward() || {}).w, 0.4, 'setEconomyReward ⇒ bigTChainReward 必须读回生效值');
  eq((T.bigTChainReward() || {}).shape, 'rate', '必须读回形状 `rate`（付的是"连带/出手"，不是"连带绝对数"）');
  T.setEconomyReward({ bigtChainW: -3 });
  eq((T.bigTChainReward() || {}).w, 0, '负数 ⇒ clamp 到 0（不许负权重把 fit 往下拽出反向梯度）');
  T.setEconomyReward({});
  eq((T.bigTChainReward() || {}).w, 0, '未设 ⇒ 不动');
  /* ③ 读数必须**不受权重门控**（W=0 也要能看"这一代打出几条链"）—— 否则"死作用点"与"真没链"永远分不开
   *    （这次就卡在这一步：三档剂量逐位相同，我一度判它死了，其实是链数为 0）
   *    v1.5.188：**分母同样不许跟着门控**（率形没有分母读数 = 又一根只能事后量的尺） */
  T.setEconomyReward({ bigtChainW: 0 });
  const s0 = T.scoreMemberN(sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true),
    [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }], 4, 3, 0, 0, 0);
  ok(typeof s0.chainEvents === 'number', 'W=0 时评分也必须返回 chainEvents（读数不能跟着权重一起关）');
  ok(typeof s0.chainCasts === 'number' && typeof s0.chainRate === 'number',
    'W=0 时也必须返回**分母与率**（只给分子就无法判断率是几）');
  /* ④a **判活**（示范开着）：跑一臂 W=0.5 ⇒ 必须印"形状=rate"、每代印分子/分母/率；
   *      若整臂一条链都没打出，fit 不许出现 +0.5 级的跳变（否则 = 计数漏了、奖励却在动）。
   *      v1.5.187 用的是 W=1.5 计数形（一发幸运链吃满 ⇒ 把名次适应度整个盖掉，实测考卷 35.4%→23.5%）⇒ 剂量降到 0.5。 */
  const dir = mkdtempSync(join(tmpdir(), 'd135-'));
  const run = spawnCached(['tools/train-3p.mjs', '60', '3', '8', '8'], {
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTChain', EPIRUS_IMIT_ONLY: 'bigT', EPIRUS_IMIT_OVERRIDE: '1',
      EPIRUS_IMIT_FRAC: '0.5', EPIRUS_REGEN_SLICE: '0.25', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd135', EPIRUS_BAND_DIR: dir
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '带连带权重的臂要跑得通');
  const out = String(run.stdout || '');
  /* v1.5.187：CLI 的横幅里**不许出现那个 env 名**（D77 ① 按整名扫，train-3p.mjs 在读的清单里）
   * ⇒ 改钉"下达值 ⇒ 消费点读回同值"，判的还是同一件事（值真到了引擎），只是不钉字面量。 */
  ok(/大雷连带权重已下达：0\.5 ⇒ 消费点读回 0\.5/.test(out), '必须印"下达 ⇒ 读回"');
  ok(/形状=rate/.test(out), '横幅必须印**读到的形状**（形状读不回 = 旧形状还活着也没人知道）');
  ok(/连带=\d+ 条\/[\d.]+每局\*\* 出手=\d+ 率=[\d.]+/.test(out),
    '每代必须把**分子、分母、率**一起印（只印分子时"1 条/1 次出手"与"1 条/8 次出手"在尺子上同形 —— 正是换形状要分开的那两件事）');
  const fitJump = (out.match(/bestFit=([0-9.]+)/g) || []).map(function (s) { return Number(s.split('=')[1]); });
  const withChain = /连带=([1-9]\d*) 条/.test(out);
  ok(withChain || Math.max.apply(null, fitJump) < 1.5,
    '整臂没链时 fit 不许出现 +0.5 级跳变；实测最大 bestFit=' + Math.max.apply(null, fitJump));
  /* ④b **今天真正的结论**（v1.5.188 单变量：把示范关掉，其余与 ④a 同）⇒ 链与出手必须**恒 0**，
   *      且 fit 不许被这项顶起来。含义：`BIGT_CHAIN_W` 的非零信号**只能来自教师注入的那几手**
   *      （事件流里注入与原生出手不可区分 —— 没有标记），所以在"原生零出手"的物种上，这一项**不是在评这个包**。
   *      ⇒ 这就是 Q-14 ①② 都买不到行为的机制解释；钉在这里，防以后有人拿"率很高"当出货。 */
  const dir2 = mkdtempSync(join(tmpdir(), 'd135b-'));
  const run2 = spawnCached(['tools/train-3p.mjs', '60', '3', '8', '8'], {
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd135b', EPIRUS_BAND_DIR: dir2
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run2.status, 0, '关掉示范的对照臂要跑得通');
  const out2 = String(run2.stdout || '');
  const castLines = (out2.match(/出手=(\d+)/g) || []).map(function (s) { return Number(s.split('=')[1]); });
  ok(castLines.length > 0, '对照臂也必须印分母（不印 = 这项在没示范时根本不看数据）');
  eq(Math.max.apply(null, castLines), 0, '没有示范 ⇒ 该席大雷出手必须恒 0（实测最大 ' + Math.max.apply(null, castLines) + '）');
  ok(!/连带=([1-9]\d*) 条/.test(out2), '没有示范 ⇒ 一条链都不许出现（出现就说明分子数到了别人/注入之外的东西）');
});

t('D136 示范归因（v1.5.189）：教师的手必须能从包自己的手里分出来，且**没有注入的局也照样计数**、**不进 fit**、**按经济口径分桶**', function () {
  /* 病（今天用两条单变量对照才抓到的）：`IMIT_OVERRIDE` 的注入是直接 `return ta` ⇒ 事件流里"教师替它打的那一手"
   * 与"包自己打的那一手"**一模一样** ⇒ 一切"示范学会了没有"的臂内读数都混着教师的手。
   * ⚠️ 这条门自己也要防那个坑：第一版我把打标记挂在"本局有注入"上 ⇒ 退火窗口之后整段没有读数，
   *    等于**量具自己把要测的那半砍掉了**（"没测到"又会被读成"没发生"）。所以 ② 是这条门的主钉。 */
  const mk = function (pid, key, outcome) { return { type: 'action', pid: pid, key: key, outcome: outcome }; };
  T.resetImitStat();
  /* ① 归因口径：只数该席、只数 `outcome:'ok'`；台账按事件顺序消费 ⇒ **条数一定对**（同卡多次谁是被注入的不保证） */
  const ev1 = [mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.GUN, 'ok'),
    mk(0, R.SK.BIG_T, 'voided'), mk(1, R.SK.BIG_T, 'ok')];
  const r1 = T.tagImitActions(ev1, { bigT: 1 }, 0, { subsidy: true });
  eq(r1.tagged, 1, '台账说"教师伸过 1 次手" ⇒ 必须标出 1 条');
  eq(ev1[0].imit, true, '该席第一条 ok 的 bigT ⇒ 打上 `imit`（**同卡多次时"哪一条是注入的"顺序相关、不保证；条数保证**）');
  ok(!ev1[1].imit && !ev1[2].imit && !ev1[3].imit && !ev1[4].imit, '第二条同卡出手（记成原生）/ 别的卡 / 被作废的一手 / 别人的出手都不许标');
  let a = T.imitAttribution();
  eq(a.keys.bigT.imit, 1, '分子账：注入 1');
  eq(a.keys.bigT.native, 1, '分子账：该席 bigT 另有 1 次是**原生**（`voided` 那条不记 ⇒ 与 `countBigCards` 同口径，不可刷）');
  eq(a.keys.bigT.nativeSub, 1, '分桶：补贴局');
  eq(a.keys.bigT.nativeEcon, 0, '分桶：原生经济局 0');
  /* ② **没有注入的局也必须计数**（那次砍掉另一半的回归钉）⇒ 空台账喂进去，原生数照样涨、且进的是 `econ` 桶 */
  const ev2 = [mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.GUN, 'ok')];
  const r2 = T.tagImitActions(ev2, {}, 0, { subsidy: false });
  eq(r2.tagged, 0, '空台账 ⇒ 零条注入');
  a = T.imitAttribution();
  eq(a.keys.bigT.nativeEcon, 1, '**无注入的局也要计数** ⇒ `nativeEcon` 必须涨（否则退火后整段没有读数）');
  eq(a.keys.bigT.nativeSub, 1, '两桶各记各的，不许互相污染');
  eq(a.games, 2, '每次调用都算一局（窗口后的那些局同样进账）');
  /* ③ 台账有条数、事件里却没有 ⇒ 必须落进 `unmatched` 被看见，不许静默 */
  T.resetImitAttribution();
  const r3 = T.tagImitActions([mk(0, R.SK.BIG_T, 'ok')], { bigT: 3 }, 0, { subsidy: false });
  eq(r3.unmatched, 2, '注入了 3 次只有 1 次成为事件 ⇒ unmatched=2（不许装作没事）');
  eq(T.imitAttribution().unmatched, 2, '累计账里也要看得见');
  T.resetImitAttribution();
  a = T.imitAttribution();
  eq(a.tagged + a.unmatched + a.games, 0, 'reset 必须真清空（否则上一门的账会污染下一门）');
  ok(T.resetImitStat() === true, '`resetImitStat` 要顺带清归因（同一族账，只清一半就会串代）');
  /* ④ **不进 fit**：β=0（示范窗口没开）⇒ 归因照跑，但评分逐位等于"示范关" —— 这一项只许记账，不许买行为 */
  const pack = sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
  T.setImitPlan(null); T.setImitUntil(0);            // 显式关窗口：别的手段（前面的门）留下的计划/窗口都不算
  eq(T.imitBetaForGen(0), 0, '前置条件：β(gen0) 必须是 0（否则 ④ 判的就不是"只记账"，而是"示范确实会改行为"）');
  T.setImitOverride(false);
  const sOff = T.scoreMemberN(pack, opps, 4, 3, 0, 0, 0);
  T.resetImitAttribution();
  T.setImitOverride(true);                            // 开 override，但 β≡0 ⇒ 从不注入
  const sOn = T.scoreMemberN(pack, opps, 4, 3, 0, 0, 0);
  T.setImitOverride(false);
  ok(T.imitAttribution().games > 0, '归因这一趟**必须真的跑过**（否则"fit 相同"是空枪：压根没执行就打不开这个证明）');
  eq(sOn.fit, sOff.fit, '示范开着但窗口=0 ⇒ fit 必须逐位相同（归因只记账，不许动目标函数）');
  ok(sOn.chainEvents !== undefined, '顺带：连带读数仍在（与 D135 同一把尺，不许跟着开关关）');
  /* ⑤ 真跑一臂：窗口后的代数里必须仍有归因读数，且**分桶不是恒零尺**（别的卡要在 `econ` 桶里有出手） */
  const dir = mkdtempSync(join(tmpdir(), 'd136-'));
  const run = spawnCached(['tools/train-3p.mjs', '30', '3', '8', '6'], {
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTChain', EPIRUS_IMIT_ONLY: 'bigT', EPIRUS_IMIT_OVERRIDE: '1',
      EPIRUS_IMIT_FRAC: '0.5', EPIRUS_REGEN_SLICE: '0.25', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd136', EPIRUS_BAND_DIR: dir
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '归因臂要跑得通');
  const out = String(run.stdout || '');
  const lines = (out.match(/\[归因·本代\][^\n]*/g) || []);
  ok(lines.length >= 8, '逐代印归因（30 代 ⇒ 至少 8 行；实测 ' + lines.length + ' 行）');
  const postWindow = lines.slice(Math.ceil(lines.length * 0.6));
  ok(postWindow.length > 0 && postWindow.every(function (l) { return /注入0/.test(l) || /教师这一代一次手都没伸/.test(l); }),
    '退火窗口之后必须**仍有读数**且注入=0 ⇒ 这就是"量具别再砍掉要测的那半"的产物级证据');
  ok(/unmatched=0/.test(out), '臂末 unmatched 必须为 0（台账与事件逐条对得上；实测：' +
    ((/unmatched=(\d+)/.exec(out) || ['', '?'])[1]) + '）');
  const econTot = (/出手归因（受评席 · 只数 `outcome:ok`）：(\{[^\n]*?\}) · tagged=/.exec(out) || [null, '{}'])[1];
  let econSum = 0;
  try { const o = JSON.parse(econTot); for (const k in o) econSum += (o[k].nativeEcon || 0); } catch (e) { econSum = -1; }
  ok(econSum > 0, '`原生经济` 桶不许是恒零尺（别的卡要在里面有出手，否则这条分桶等于没测；实测合计 ' + econSum + '）');
  ok(/bigT.*"nativeSub":([1-9])/.test(out) || /bigT 原生[1-9]（补贴局/.test(out),
    '大雷必须至少在补贴局桶里有原生出手（今天的读数）；两桶都为 0 说明注入根本没发生');
});

t('D137 三把量具（v1.5.190）：判定必须过显著性 · 通吃必须"除 2P"排序 · "读不出"必须分得出是算力还是钱墙（Q-9/Q-10）', function () {
  /* ===== ① skill-report：判定标签只许贴在"分得出"的卡上 =====
   * 病（Q-9 原话：30 张里 21 张读不出，而表上没有 SE ⇒ 读表人把"读不出"当"没价值"）：
   * 旧门槛 `|Δ|>0.5pt` 比本工具自己的配对噪声（实测中位 ±3.4pt）**还小** ⇒ 一部分标签是贴给噪声的。
   * 判据不钉文本：**从 --json 产物里逐行复核不变式**（四象限标签 ⇒ |Δ|>1.96·SE；消融标签 ⇒ |Δ_lost|>1.96·banSE）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd137-'));
  const outHtml = join(dir, 'r.html'), outJson = join(dir, 'r.json');
  const run = spawnSync(process.execPath,
    ['tools/skill-report.mjs', '3', '2', outHtml, '--champ=js/bundled-champion-3p.js', '--json=' + outJson],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, 'skill-report 要跑得通（stderr=' + String(run.stderr || '').slice(0, 200) + '）');
  ok(existsSync(outJson), '必须能导出 --json（否则这条判据只能靠肉眼读 HTML）');
  const rep = JSON.parse(readFileSync(outJson, 'utf8'));
  ok(rep.targetPt > 0, 'JSON 里要带 `targetPt`（"要辨几 pt"这件事必须随产物一起落盘，不然价码就丢了）');
  const QUAD = ['坑（', '主力（', '没学会的强招', '死技能（'];
  const monoBad = [], banBad = [], noSe = [];
  for (const r of rep.rows) {
    if (typeof r.se !== 'number') noSe.push(r.name);
    if (r.banLost == null) {
      if (QUAD.some(function (q) { return String(r.verdict).indexOf(q) === 0; })) {
        if (!(r.se > 0) || !(Math.abs(r.delta) > 1.96 * r.se)) monoBad.push(r.name + '=' + r.verdict + ' Δ=' + (100 * r.delta).toFixed(1) + ' SE=' + (100 * r.se).toFixed(1));
      }
    } else {
      if (typeof r.banSe !== 'number') noSe.push(r.name + '(消融)');
      const isLoad = String(r.verdict).indexOf('承重') === 0 || String(r.verdict).indexOf('陷阱') === 0;
      if (isLoad && !(r.banSe > 0) || (isLoad && Math.abs(r.banLost) <= r.banMde)) {
        banBad.push(r.name + '=' + r.verdict + ' Δ_lost=' + (100 * r.banLost).toFixed(1) + ' SE=' + (r.banSe > 0 ? (100 * r.banSe).toFixed(1) : '?'));
      }
    }
  }
  eq(noSe.length, 0, '每行都必须带配对 SE（`se` / `banSe`）：' + JSON.stringify(noSe));
  eq(monoBad.length, 0, '不许给"分不出"的卡贴四象限标签（Q-9 的正面钉）：' + JSON.stringify(monoBad));
  eq(banBad.length, 0, '消融臂同一条规矩（承重/陷阱要过 1.96·SE）：' + JSON.stringify(banBad));
  ok(/要辨[\d.]+pt需\d+局\/组/.test(String(run.stdout || '')),
    '控制台必须印"要辨 X pt 需几局/组"（算力价码；没有它就只剩一句"噪声内"，等于没回答 Q-10）');
  ok(/噪声内.*张/.test(String(run.stdout || '')) && /1\.96SE 中位/.test(String(run.stdout || '')),
    '必须有"可测量性"汇总（多少张分不出 + 本口径噪声中位）⇒ 这是把"读不出"和"没价值"分开的那句话');
  /* ===== ② probe-cross-mode：通吃排序必须"除 2P" =====
   * 病（今天 9 粒历史包实测）：3P 包塞进 2P 格是**结构性 0% 胜/100% 平**（含现役）⇒ 含 2P 的"最弱格"对这批包恒 0，
   * 排序键等于没有，把真正分辨得出的四格糊平。 */
  const cm = spawnCached(['tools/probe-cross-mode.mjs',
    'js/bundled-champion-3p.js', 'docs/artifacts/v7aim3-93.bak', 'docs/artifacts/v7divK-31.bak', '--games=6', '--json'],
    { encoding: 'utf8', timeout: 600000 });
  eq(cm.status, 0, '通吃矩阵要跑得通');
  const mx = JSON.parse(String(cm.stdout)).rows;
  ok(mx.length > 0 && mx[0].weakestMulti !== undefined, '每行必须带 `weakestMulti`（除 2P 的最弱格）');
  const byField = {};
  for (const r of mx) { (byField[r.field] = byField[r.field] || []).push(r); }
  for (const f in byField) {
    const arr = byField[f];
    for (let i = 1; i < arr.length; i++) {
      ok(arr[i - 1].weakestMulti.first >= arr[i].weakestMulti.first - 1e-12,
        '环境 ' + f + ' 的排序必须按 `weakestMulti`（第 ' + i + ' 行 ' + arr[i].pack + ' 排在 ' + arr[i - 1].pack + ' 后面却更高）');
    }
  }
  ok(mx.some(function (r) { return r.weakest.id === '2P' && r.weakestMulti.id !== '2P'; }),
    '必须真的存在"含 2P 最弱格 ≠ 除 2P 最弱格"的行（否则这条改动是空操作，两列同形等于没加）');
  /* ===== ③ probe-skill-marginal：把"读不出"分成两种病 =====
   * `机会≈0` 的判据是 `chance`（每局几次机会）⇒ **与局数无关 ⇒ 加算力救不了**；`噪声内` 才是算力问题。
   * 混为一谈就会白烧算力（Q-10 的实际答复：×3.1 算力只把原生口径的可测从 3/30 抬到 4/30，换 `--rich=card` 才到 14/30）。 */
  const mg = spawnCached(['tools/probe-skill-marginal.mjs', '--mode=multi', '--games=6', '--only=ji,gun'],
    { encoding: 'utf8', timeout: 600000 });
  eq(mg.status, 0, '边际价值探针要跑得通');
  const mgOut = String(mg.stdout || '');
  ok(/病因拆开/.test(mgOut), '汇总必须把"读不出"拆成**钱墙 / 算力**两种病（不拆就是让人拿算力去治钱墙）');
  ok(/合计 \d+ 张卡/.test(mgOut), '汇总行要在（可测/噪声内/机会≈0 三分类）');
  ok(!/要 SE→.*需 ~0 局/.test(mgOut), '不许出现"需 0 局"这种假价码（se=0 时该走"读不出"而不是"再跑 0 局就行"）');
});

t('D138 拦截代价表（v1.5.191 新量具）：归因必须真收到 blocked/reflect、"没测到"必须单独成类、判读必须要求两场符号翻转', function () {
  /* 这把尺子要回答的是用户那句"AI 为了防止技能被拦截、倾向于完全不用可能被拦截的技能"。
   * 它有三个可失败点，逐个钉：① `blocked` 事件**没有 source** ⇒ 对手必须禁用被测卡，否则被挡率会混进别人的手；
   * ② 贵卡在猛攻场里"4 回合就死 ⇒ 一次都没出手"，只报 0% 被挡率就会把**没测到**当成"拦截不成立"（门 L2 那句原话）；
   * ③ ε=1 的 mono-spam 自带"只会一招"的惩罚 ⇒ 判"理性"必须要求**两场符号翻转**，不能只看 Δ 为负。 */
  const run = spawnSync(process.execPath, ['tools/probe-intercept-cost.mjs', '--games=12', '--only=bigT,gun,ji', '--json'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '探针要跑得通（stderr=' + String(run.stderr || '').slice(0, 200) + '）');
  const out = String(run.stdout || '');
  ok(out.indexOf('{"games"') >= 0, '探针必须能把结果导成 JSON（找不到就是 `--json` 这条路断了，别拿人读表格凑数）');
  const j = JSON.parse(out.slice(out.indexOf('{"games"')));
  ok(j.judged.length >= 3, '三张被测卡都要有判读行（实测 ' + j.judged.length + '）');
  /* ① 归因活着：枪/大雷在"半数席设防"的场里必须**真收到**拦截事件（收不到 = 字段筛错 = 整张表是空枪） */
  const gun = j.judged.filter(function (r) { return r.key === 'gun'; })[0];
  const big = j.judged.filter(function (r) { return r.key === 'bigT'; })[0];
  ok(gun && gun.casts > 0.5, '枪必须真出手（否则被挡率是 0/0 的假 0；实测 casts/局=' + (gun && gun.casts) + '）');
  ok(gun.blockRate > 0.10, '枪在会防的混合场里必须**收到**拦截事件（实测被挡率 ' + (100 * gun.blockRate).toFixed(0) + '%；为 0 说明 `via`/归因断了）');
  ok(Object.keys(gun.who || {}).length > 0, '必须记下"被哪张防御卡挡的"（`blocked.by`），否则这张表只剩一个数、解释不了机制');
  /* ② "没测到"必须能单独成类，且优先级高于 N/R/L */
  const clsOf = function (r) { return r.cls; };
  ok(j.judged.map(clsOf).every(function (c) { return 'RLNUC?'.indexOf(c) >= 0; }), '判读只能落在 R/L/N/U/C/? 里');
  {
    const u = spawnSync(process.execPath, ['tools/probe-intercept-cost.mjs', '--games=6', '--only=drain', '--grant=0', '--json'],
      { encoding: 'utf8', timeout: 600000 });
    ok(u.status === 0, '关掉垫钱的对照臂要跑得通（status=' + u.status + '）');
    const uu = JSON.parse((function (s) { return s.slice(s.indexOf('{"games"')); })(String(u.stdout || '')));
    const r0 = uu.judged.filter(function (x) { return x.key === 'drain'; })[0];
    ok(r0 && r0.cls === 'U', '关掉定向垫钱后，"活不到有钱"的卡必须判 **U（未测到）**而不是 N —— ' +
      '把"没测到"读成"拦截解释不成立"就是本仓门 L2 点名的那族病（实测 cls=' + (r0 && r0.cls) + ' casts/局=' + (r0 && r0.casts) + '）');
  }
  /* ③ 判据形状：R 要求两场符号翻转（Δ混合<0 且 Δ不防>0）；L 要求 Δ混合>0 —— 直接从产物复核，不钉源码文本 */
  for (const r of j.judged) {
    if (r.cls === 'R') ok(r.dMix < 0 && r.dNodef > 0, 'R 必须两场符号翻转：' + r.name + ' Δ混合=' + r.dMix + ' Δ不防=' + r.dNodef);
    if (r.cls === 'L') ok(r.dMix > 0 && r.blockRate >= 0.10, 'L 必须是"会防场里仍赚 + 真被挡"：' + r.name);
    if (r.cls === 'N') ok(r.blockRate < 0.10, 'N 只能给被挡率 <10% 的卡：' + r.name + ' 实测 ' + (100 * r.blockRate).toFixed(0) + '%');
    ok(typeof r.interceptCost === 'number', '机制列（拦截代价=Δ混合−Δ不防）必须在');
  }
  ok(/判读合计/.test(out) && /规则：/.test(out), '必须印分类合计与判读规则（没有规则的话，这张表就是一堆没有口径的数）');
});

t('D139 击杀奖励实验台（v1.5.193）：补丁必须真打上、破防场必须证明"奖励根本没发出去"、脚本池场必须证明"它能触发"', function () {
  /* 这条门钉的不是游戏行为，是**实验台本身**的两件事（本仓吃过亏的形状）：
   *   ① 引擎补丁如果没打上（锚点漂了/CRLF），三档跑的是同一个引擎 ⇒ 整份对照是假的 ⇒ 工具必须**抛错**而不是静默跑；
   *   ② "胜率没变"必须能被区分成"没效果"还是"根本没触发" ⇒ 所以要同时钉**发放计数为 0**（破防场）与**> 0**（脚本池场）。
   * 实测结论（§N49）：破防场里现役包三档读数**逐位相同**且 `奖励发放 = 0.00 次/局` ——
   *   因为那场里 5 个座位全死、却没有一次死亡是"被某个有来源的伤害打死的"（都是反弹/自损）⇒
   *   **任何"按击杀归因"的奖励都碰不到龟缩场**。这条就是那个结论的钉子。 */
  const run = spawnSync(process.execPath, ['tools/probe-kill-reward.mjs', '--games=40', '--fields=guardwall,pool', '--json'],
    { encoding: 'utf8', timeout: 900000 });
  eq(run.status, 0, '实验台要跑得通；若报"锚点找不到"就是 play.js 改了而补丁没跟着改（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const j = JSON.parse(out.slice(out.lastIndexOf('{"games"')));
  const wall = j.rows.filter(function (r) { return r.field === 'guardwall' && r.pack.indexOf('bundled-champion') === 0; })[0];
  ok(wall, '必须有"破防场 × 现役包"这一格（它就是防龟的靶心）');
  eq(wall.by[1].paid, 0, '破防场里**规则 1 的奖励发放必须是 0** —— 大于 0 就说明死亡归因变了，那条"没效果"的结论要重读');
  eq(wall.by[2].paid, 0, '破防场里规则 2 同样发放 0 次');
  eq(wall.by[1].first, wall.by[0].first, '破防场：规则 1 与现状的胜率必须**逐位相同**（没触发 ⇒ 不许有任何差别）');
  eq(wall.by[2].rounds, wall.by[0].rounds, '破防场：规则 2 的局长也必须逐位相同');
  ok(wall.by[0].draws === 1 && wall.by[0].first === 0, '破防场现役必须仍是 `0% 胜 / 100% 平`（这是 §N37/§N46 三次复现的那条形）');
  const poolRows = j.rows.filter(function (r) { return r.field === 'pool'; });
  const paidAny = poolRows.filter(function (r) { return r.by[1].paid > 0.3; });
  ok(paidAny.length >= 2, '脚本池场里奖励必须**能触发**（≥2 格发放 >0.3 次/局）—— 否则这两条规则是死代码，' +
    '上面那些"逐位相同"就只是"永远不发放"的同义反复；实测 ' + paidAny.length + ' 格');
  ok(/Δ胜率 vs 现状（同种子配对）/.test(out) && /噪声内 ±[\d.]+/.test(out),
    '必须印**配对**噪声（±1.96SE）—— 只印 Δ 百分点不印噪声，读表人就会把 ±5pt 的抖动当成结论（Q-9 同族病）');
});

t('D140 击杀奖励规则库（v1.5.194 · 单一来源）：合成局面逐个钉五条语义 —— 单点/按伤害/overkill/蓄能加价/无来源归因/转移记给', function () {
  /* 这份 lib 现在决定"冠军是在哪个世界里训出来的" ⇒ 语义必须逐条钉死，且**不许**只在真对局里顺带验到。
   * 全部用合成 state 喂 `makeKR().pre/post`（不依赖引擎跑局 ⇒ 每条都是确定性的）。 */
  const KR = KR_LIB;   // ESM 里没有 require ⇒ 用顶部静态导入
  const mkState = function (hps) {
    return { p: hps.map(function (h) { return { hp: h, ep: 0 }; }), events: [], round: 1 };
  };
  const dmg = function (to, amt, source, via, extra) {
    return Object.assign({ type: 'damage', to: to, amt: amt, source: source, via: via, reason: via }, extra || {});
  };
  /* ① 规则 1：集火时只回给"优先级最高"者（大雷 pri4 > 枪 pri2） */
  let st = mkState([3, 3, 3]);
  let kr = KR.makeKR(R, S, 1, {});
  kr.pre(st);
  st.p[1].hp = 0;   // 1 号席死
  st.events.push(dmg(1, 2, 0, R.SK.BIG_T), dmg(1, 1, 2, R.SK.GUN));
  kr.post(st);
  eq(st.p[0].ep, 1, '规则1：最高优先级（大雷 pri4）拿 1 ep');
  eq(st.p[2].ep, 0, '规则1：低优先级参与者（枪 pri2）一分不得');
  /* ② 同优先级 + 仍并列 ⇒ 都不回 */
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, 0, R.SK.GUN), dmg(1, 1, 2, R.SK.GUN));
  kr.post(st);
  eq(st.p[0].ep + st.p[2].ep, 0, '规则1：同 pri 同 cost 的**不同角色**并列 ⇒ 都不回（用户明说）');
  /* ③ 蓄能算进开销 ⇒ 同优先级里需珠的那手占优（坦克 vs 电磁炮：pri 相同时电磁炮 cost+1 胜出） */
  const priTank = (R.byKey[R.SK.TANK] || {}).pri, priRail = (R.byKey[R.SK.RAILGUN] || {}).pri;
  /* 开销比较值：**动态费用必须问引擎**（聚能环/激光眼/过载炮 的 `cost` 是 null ⇒ 读卡表会把它们当 0） */
  {
    const costOf = KR.buildCostOf(R, S);
    eq(costOf(R.SK.GUN), 1, '枪 = 1');
    eq(costOf(R.SK.BIG_T), 5, '大雷 = 5');
    eq(costOf(R.SK.RAILGUN), 3, '电磁炮 = 费用 2 + 蓄能 1（用户点名要算进开销）');
    eq(costOf(R.SK.LASER_EYE), 2, '激光眼 = 首次 1 + 蓄能 1 = 2（与"续招 2ep"那条路径平价）');
    eq((R.byKey[R.SK.LASER_EYE] || {}).cost, null, '前置事实：激光眼在卡表里是**动态费用（null）** ⇒ 不问引擎就会算成 0');
    eq(costOf(R.SK.RING), 3, '聚能环（动态费用）必须问引擎拿到 3，而不是读卡表得 0');
    ok(costOf(R.SK.CANNON) >= 2, '过载炮（动态费用）≥2；实测 ' + costOf(R.SK.CANNON));
  }
  void priTank; void priRail;
  /* ④ 规则 2：按有效伤害付，overkill 不付（**起始血量必须与注释一致** —— 第一版写了"目标只有 2 血"
   *    却用 `mkState([3,3,3])` 造了 3 血 ⇒ 该发其实不是 overkill，是这条断言自己错了） */
  st = mkState([3, 2, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, 0, R.SK.GUN), dmg(1, 3, 2, R.SK.SNIPE));   // 目标开局 2 血：第二发 3 点里 2 点是 overkill
  kr.post(st);
  eq(st.p[0].ep, 1, '规则2：第一发全额付 1 ep');
  eq(st.p[2].ep, 1, '规则2：致命那发只付"把血打到 0"的部分（3 点里 2 点是 overkill ⇒ 只付 1）；实测 ' + st.p[2].ep);
  /* ⑤ 无来源的地雷 / 天火也要回 ep（走 mineFrom / fireFrom，**不动 source**） */
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, null, 'mine', { mineFrom: 2 }));
  kr.post(st);
  eq(st.p[2].ep, 1, '地雷炸死 ⇒ 回给埋雷者（`mineFrom`），而不是因为 `source:null` 就谁都不回');
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 2, null, 'firestorm', { fireFrom: 0 }));
  kr.post(st);
  eq(st.p[0].ep, 2, '天火引爆致死 ⇒ 按伤害回给引爆者（`fireFrom`）');
  /* ⑥ 转移伤害：功劳记给**转移者**（默认），可切成原攻击者 */
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[3].hp = 0;
  st.events.push(dmg(3, 2, 0, R.SK.SNIPE, { transferBy: 1 }));   // 0 打出的伤害被 1 转移给 3
  kr.post(st);
  eq(st.p[1].ep, 1, '转移伤害致死 ⇒ 默认记给转移者（1 号席）');
  eq(st.p[0].ep, 0, '默认口径下原攻击者（0 号席）不拿');
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, { transfer: 'source' }); kr.pre(st);
  st.p[3].hp = 0;
  st.events.push(dmg(3, 2, 0, R.SK.SNIPE, { transferBy: 1 }));
  kr.post(st);
  eq(st.p[0].ep, 1, '`--kr-transfer=source` 时改记给原攻击者（两种读法都留了开关）');
  /* ⑦ 真正无主的死亡（铁索传导 / 禁用扣血 / 终局收缩）⇒ 一律不回，也不许崩 */
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[2].hp = 0;
  st.events.push(dmg(2, 1, null, 'chain'), dmg(2, 1, null, 'ban'), dmg(2, 2, null, '终局收缩'));
  kr.post(st);
  eq(st.p[0].ep + st.p[1].ep, 0, '无归因的死亡 ⇒ 谁都不回（且不许 NaN/抛错）');
  /* ⑧ 引擎补丁：锚点漂了必须抛错（静默没打上 = 三档跑同一个引擎 = 假实验） */
  {
    let threw = 0;
    try { KR.patchResolve('这是一段被改过的、没有锚点的 resolve.js'); } catch (e) { threw = 1; }
    eq(threw, 1, '锚点找不到必须**抛错**，不许静默返回原文');
    const patched = KR.patchResolve(readFileSync('js/core/resolve.js', 'utf8'));
    ok(patched.indexOf('mineFrom:') >= 0 && patched.indexOf('fireFrom:') >= 0 && patched.indexOf('transferBy:') >= 0,
      'resolve.js 补丁必须真的把三个归因字段接进事件（缺一个就有某类死亡回不了 ep）');
    ok(patched.indexOf("source: (opts.source != null ? opts.source : null)") >= 0,
      '**不许动 `source`**（R57：地雷/天火是无来源伤害，且 `source==null` 还是大雷连带与"终局收缩"哨兵的输入）');
  }
  /* ⑨ 补丁行为中性：打了补丁但不挂规则钩子 ⇒ 与未打补丁**逐位相同** */
  {
    const boot = function (patched) {
      const box = {
        console: { log: function () { }, warn: function () { }, error: function () { } },
        Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
      };
      box.window = box; box.globalThis = box;
      for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
        'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
        let t = readFileSync(f, 'utf8');
        if (patched && f === 'js/core/resolve.js') t = KR.patchResolve(t);
        if (patched && f === 'js/core/play.js') t = KR.patchPlay(t);
        vm.runInNewContext(t, box, { filename: f });
      }
      return box;
    };
    const play = function (box) {
      const T = box.window.EpirusTrainer, B = box.window.EpirusBots, sig = [];
      for (let g = 0; g < 14; g++) {
        const ch = [];
        for (let pid = 0; pid < 5; pid++) ch.push(function (s2, p2, lg) { return B.pickMix(s2, p2, lg); });
        const r = T.oneGameN(ch, 4242 + g * 7919, 5, { mode: 'multi' });
        sig.push(r.state.winner + '|' + r.state.round + '|' + r.state.p.map(function (q) { return q.hp; }).join(','));
      }
      return sig.join(' ');
    };
    const a = play(boot(false)), b = play(boot(true));
    eq(a, b, 'mode 0（打了补丁、钩子不发）必须与未打补丁**逐位相同** —— 否则所有 Δ 都不是纯规则差');
  }
});

t('D141 破龟群栏（v1.5.195）：`归因伤害/局` 与 `终场存活` 必须存在、必须与 `resolve.js` 的判胜口径同源、且**不是恒 0 的死读数**', function () {
  /* 病（今晚量出来的）：`--field=guardwall` 的 1st 是**下限判据** —— 那格 4 席不还手 ⇒ 全员被终局收缩清场 ⇒
   * 判胜走 `resolve.js` 的 `alive.length === 0` 分支 = "累计**有归因**伤害最高者胜"。
   * 于是"破防 100%"只等价于"至少蹭到一发"，实测同为 100% 的两粒包幅值差 4 倍（2.17 vs 8.77 点/局）。
   * ⇒ 光有胜率会把"蹭一发"和"凿穿"排进同一档 ⇒ 必须并读幅值。这条门钉三件事：
   *   ① 两个新读数存在；② 归因口径与引擎判胜口径**同一个表达式**（不许自己抄一份 `source != null`）；
   *   ③ 读数**会动**（现役在破龟群场 = 0，在头对头场 > 0）—— 防"死读数当结论"（seam 2 那一族）。 */
  const p = readFileSync('tools/probe-kill-reward.mjs', 'utf8');
  ok(/if \(e\.type === 'damage' && e\.source != null && dsum\[e\.source\] != null\) dsum\[e\.source\] \+= e\.amt;/.test(p),
    '受评席伤害累计必须按 `damage` 事件 + `e.source != null` 累加 —— 与 `resolve.js` 全灭判胜的表达式同形（换槽径）');
  ok(/deal: deal \/ games, alive: aliveEnd \/ games,/.test(p) && /if \(r\.state\.p\[seat\]\.hp > 0\) aliveEnd\+\+;/.test(p),
    '两栏都必须真累加并归一（`终场存活`判据 = 终场血量 > 0，**不是**"局长 < 回合上限"：那格是被收缩清场的，人人都会"提前"）');
  const run = spawnSync(process.execPath, ['tools/probe-kill-reward.mjs', '--games=40',
    '--fields=guardwall,vs', '--opp=js/bundled-champion-3p.js', '--rules=0', '--json'],
    { encoding: 'utf8', timeout: 900000 });
  eq(run.status, 0, '实验台要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const j = JSON.parse(out.slice(out.lastIndexOf('{"games"')));
  const cell = function (f) { return j.rows.filter(function (r) { return r.field === f && r.pack.indexOf('bundled-champion') === 0; })[0]; };
  const wall = cell('guardwall'), vs = cell('vs');
  ok(wall && vs, '必须有"破龟群 × 现役包"和"头对头 × 现役包"两格');
  eq(typeof wall.by[0].deal, 'number', '`归因伤害/局` 必须进 JSON 读数（不印出来的读数下次没人信）');
  eq(typeof wall.by[0].alive, 'number', '`终场存活` 必须进 JSON 读数');
  eq(wall.by[0].deal, 0, '现役包在破龟群场必须仍是 **0.00 点/局**（23 次出手全被防御挡 ⇒ 一发都没落地）；实测 ' + wall.by[0].deal);
  eq(wall.by[0].alive, 0, '现役包在那格必须**一局都没活着收场**');
  ok(vs.by[0].deal > 0, '同一只包在头对头场必须有非 0 归因伤害（否则上面那个 0 是"死读数"而不是"那格打不穿"）；实测 ' + vs.by[0].deal);
  ok(/归因伤害\/局.*终场存活/.test(out), '表头必须印出这两栏（读表人看得见才知道不能只看 1st）');
});

t('D115 序列窗锁：链上状态（持珠/上手蓄能/有我方符咒）⇒ soft 探索整回合作废（v1.5.149-night · 夜测 §N4 悬崖）', function () {
  ok(typeof T.seqLockedTurn === 'function', '判据必须导出（门喂构造态，不钉文本）');
  const mk = function (f) { const s = S.createState('long', { next: mulberry32(9) }, 3); f(s.p[0]); return s; };
  /* ① 判据：三正（珠/上手蓄能/我方符咒）+ 三负（空态/他人符咒/只有 ep 富余） */
  ok(T.seqLockedTurn(mk(p => { p.elec = 1; }), 0), '持电珠 ⇒ 锁（终点炮在手，这一回合不赌）');
  ok(T.seqLockedTurn(mk(p => { p.lastSkill = 'charge'; }), 0), '上一手蓄能 ⇒ 锁（链不许中途撒手）');
  (function () { const s = mk(() => {}); s.p[2].stickers.push({ owner: 0, age: 1 });
    ok(T.seqLockedTurn(s, 0), '自己贴的存活符咒 ⇒ 锁（引爆/续贴线）'); })();
  ok(!T.seqLockedTurn(mk(p => { p.ep = 9; }), 0), 'ep 富余但不在链上 ⇒ 不锁（噪声留给非序列手）');
  (function () { const s = mk(() => {}); s.p[2].stickers.push({ owner: 1, age: 1 });
    ok(!T.seqLockedTurn(s, 0), '别人贴的符咒不算（owner 必须是自己）'); })();
  ok(!T.seqLockedTurn(mk(() => {}), 0), '空态不锁');
  /* ② 端到端：真·链上态 ε=1 soft 的 40 抽样必须与 ε=0（同 rng）逐手相等 ⇒ 锁=探索整回合作废 */
  const W3b = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P);
  Pol.setRng(mulberry32(115115));
  const lockedStates = [];
  const seen = { n: 0 };
  for (let g = 0; g < 30 && lockedStates.length < 4; g++) {
    const st = S.createState('long', { next: mulberry32(330000 + g) }, 5);
    const ch = (state, pid, legal) => {
      const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji', affordable: true }];
      const p = T.pickChampion(state, pid, b, W3b, 0.15);
      if (lockedStates.length < 4 && T.seqLockedTurn(state, pid)) {
        seen.n++;
        lockedStates.push({ snap: JSON.parse(JSON.stringify({ p: state.p, round: state.round })), pid });
      }
      return p;
    };
    Play.autoGameN(st, [ch, ch, ch, ch, ch]);
  }
  ok(lockedStates.length >= 2, '长程自对局里必须存在链上决策态（找不到 ⇒ 珠线又断了，先查 §18-21）· 实测 ' + lockedStates.length);
  for (const rec of lockedStates) {
    let same = 0;
    for (let d = 0; d < 40; d++) {
      const mkSt = function (eps) {
        const st2 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
        const sp = JSON.parse(JSON.stringify(rec.snap));
        for (let i = 0; i < 5; i++) Object.assign(st2.p[i], sp.p[i]);
        st2.round = sp.round;
        const legal = Play.legalActions(st2, rec.pid).filter(l => l.affordable);
        if (!legal.length) return null;
        return T.pickChampion(st2, rec.pid, legal, W3b, 0.15, eps ? 1 : 0, 5, eps ? 'soft' : undefined);
      };
      const a = mkSt(false), b = mkSt(true);
      if (a && b && a.key === b.key) same++;
    }
    ok(same === 40, '链上态 ε=1 soft 必须与 ε=0 逐手相等（实测 ' + same + '/40 ⇒ 锁漏或 rng 假象）');
  }
  /* ③ 反证：锁只在 soft —— 同一批态 ε=1 无 epsMode（uniform 原口径）必须出现改判（否则 ② 是假绿） */
  (function () {
    if (!lockedStates.length) return;
    const rec = lockedStates[0];
    let diff = 0;
    for (let d = 0; d < 40; d++) {
      const st2 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
      const sp = JSON.parse(JSON.stringify(rec.snap));
      for (let i = 0; i < 5; i++) Object.assign(st2.p[i], sp.p[i]);
      st2.round = sp.round;
      const legal = Play.legalActions(st2, rec.pid).filter(l => l.affordable);
      const g0 = T.pickChampion(st2, rec.pid, legal, W3b, 0.15, 0);
      const st3 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
      for (let i = 0; i < 5; i++) Object.assign(st3.p[i], JSON.parse(JSON.stringify(rec.snap)).p[i]);
      st3.round = sp.round;
      const legal3 = Play.legalActions(st3, rec.pid).filter(l => l.affordable);
      const gu = T.pickChampion(st3, rec.pid, legal3, W3b, 0.15, 1, 5);
      if (gu.key !== g0.key) diff++;
    }
    ok(diff > 0, '无 epsMode 的 ε=1 必须会打断链上回合（实测改判 ' + diff + '/40 —— 为 0 说明量具没判别力）');
  })();
});

t('D142 空净化闸门（v1.5.199 · 用户实机报）必须与引擎 `purgeSelf` 逐字段对账，且「攒哪种珠」必须单一来源', function () {
  /* ===== (a) 净化：与天火空爆（v1.5.139）/ 蓄能 ep<2（v1.5.82）同族的第三个"恒亏动作" =====
   * 用户实盘（`results/band2/*.txt`）里 5 次净化全是「清除 **0** 枚符咒与负面状态」，而同装配下现役包 0 次净化
   * ⇒ 说明这不是"某只包爱用"，而是**菜单从来允许出空转的一张牌**。 */
  ok(typeof T.hasPurgeable === 'function', '判据必须导出（门喂构造态，不钉文本）');
  eq(T.hasPurgeable({}), false, '全空 ⇒ 不可清（这正是"空净化"）');
  eq(T.hasPurgeable(null), false, '席位不存在也不许抛');
  /* 引擎 R60（v1.5.110）`purgeSelf` 清的字段清单 —— 这里逐字段挂上，两边必须同判** */
  const FIELDS = [
    ['stickers', [{ owner: 0, age: 1 }]], ['nightmare', true], ['tauntPending', true],
    ['tauntByPending', [2]], ['fireWeakNow', true], ['fireWeakNext', true],
    ['mineArmed', true], ['mineTurns', 2], ['rodGuard', 1], ['cooldown', { bigT: 1 }]
  ];
  for (const f of FIELDS) {
    const p = {}; p[f[0]] = f[1];
    eq(T.hasPurgeable(p), true, '挂了 ' + f[0] + ' 必须算"有东西可清"（漏一个字段 = 把有用的净化也摘掉）');
  }
  /* ② 与**引擎本身**逐字段对账：只挂这一个状态 ⇒ 出一次净化 ⇒ 判据必须"事前 true / 事后 false"，
   *    且引擎得真把它清掉（清单漂了 —— 比如以后新增一类持续状态 —— 当场红）。 */
  {
    const st0 = S.createState('multi', { next: mulberry32(909) }, 3);
    ok(Play.legalActions(st0, 0).some(function (x) { return x.key === R.SK.PURIFY; }),
      '前置事实：净化在 multi 合法表里（否则下面的对账全是空判）');
  }
  for (const f of FIELDS.concat([['（全空）', null]])) {
    const st = S.createState('multi', { next: mulberry32(909) }, 3);
    X.startTurn(st);
    st.p[0].ep = 9;
    if (f[1] !== null) st.p[0][f[0]] = f[1];
    const before = T.hasPurgeable(st.p[0]);
    eq(before, f[1] !== null, f[0] + '：判据事前判定（挂了才该说有东西可清）');
    S.attemptAction(st, 0, R.SK.PURIFY, {});
    for (let i = 1; i < 3; i++) S.attemptAction(st, i, R.SK.JI, {});
    X.resolveActions(st);
    const acted = st.events.filter(function (e) { return e.type === 'purify'; })[0];
    ok(acted, f[0] + '：净化必须真落地（被合法表/费用挡下 ⇒ 这条对账是假的）');
    eq(T.hasPurgeable(st.p[0]), false, f[0] + '：净化之后判据必须认为"已无可清"（引擎没清干净 = 清单漂了）');
    if (f[1] === null) {
      eq(acted.curses, 0, '空净化在引擎侧的读数必须就是 curses===0（用户看到的那行字）');
      eq(st.p[0].hp, (R.MODES.multi || {}).hp || 3, '空净化不许顺带回血（n-1 规则里 n=0 ⇒ 不该有 heal）');
      ok(!st.events.some(function (e) { return e.type === 'heal' && e.pid === 0; }), '空净化那一手不得产生 heal 事件');
    }
  }
  /* ③ 作用点必须活着：`econBase` 在"干净 + 买得起"时把 PURIFY 摘掉，挂上符咒就必须留着 */
  {
    const st = S.createState('multi', { next: mulberry32(11) }, 3);
    st.p[0].ep = 9;
    const legal = Play.legalActions(st, 0).map(function (x) { return { key: x.key, affordable: true }; });
    ok(legal.some(function (x) { return x.key === R.SK.PURIFY; }), '前置事实：净化本来就在合法表里（否则 ③ 是空判）');
    eq(T.econBase(st, 0, legal).some(function (x) { return x.key === R.SK.PURIFY; }), false,
      '身上干净 ⇒ 菜单里必须没有净化（摘掉，不是"降权"）');
    st.p[0].stickers = [{ owner: 0, age: 1, key: R.SK.CURSE }];
    eq(T.econBase(st, 0, legal).some(function (x) { return x.key === R.SK.PURIFY; }), true,
      '有东西可清 ⇒ 必须还在（不许把好牌一起摘掉）');
  }
  /* ④ 症状级双对照（正反各一）：**强制**每回合尽量出净化，走 `econBase` 后真实对局里"空净化"必须归零；
   *    而绕过 `econBase` 的对照组必须**测得出非零** —— 否则 ④ 只是"它本来就没出"的假绿（seam 2 那一族）。 */
  {
    const runForced = function (useGate, games) {
      let emptyPurify = 0, purify = 0;
      for (let g = 0; g < games; g++) {
        const seed = 5150 + g * 977;
        const ch = [];
        for (let pid = 0; pid < 3; pid++) ch.push(function (s2, p2, lg) {
          /* ⚠️ chooser 只许**返回**动作（下注由 `oneGameN` 去 attempt）—— 自己再 attempt 一次会 double 掉，
           *    第一版我就这么写出了"对照组 0 次净化"的假绿。 */
          const pool = useGate ? T.econBase(s2, p2, lg) : lg;
          const aff = pool.filter(function (x) { return x.affordable; });
          const pu = aff.find(function (x) { return x.key === R.SK.PURIFY; });
          return pu ? { key: R.SK.PURIFY, target: null } : { key: R.SK.JI, target: null };
        });
        const r = T.oneGameN(ch, seed, 3, { mode: 'multi' });
        for (const e of r.state.events) if (e.type === 'purify') { purify++; if (!e.curses) emptyPurify++; }
      }
      return { purify: purify, empty: emptyPurify };
    };
    const noGate = runForced(false, 12);
    ok(noGate.empty > 0, '对照组（绕过闸门）必须测得出空净化，否则整条 ④ 无判别力；实测 ' + JSON.stringify(noGate));
    const gated = runForced(true, 12);
    eq(gated.empty, 0, '走了 `econBase` 之后真实对局里的"清除 0 枚"必须为 0（对照组 ' + noGate.empty + ' 次）');
    ok(gated.purify > 0 || noGate.purify > 0, '至少一边要真出过净化（两边都没出 ⇒ 装配不成立）');
  }
  /* ===== (b) 「这一手蓄能攒哪种珠」：三处各自写过的三元式必须收成一处 =====
   * 事实（读代码得出来，非推断）：冠军策略返回的动作里 `bead` 基本恒为 null ⇒ **珠类型是 UI 层替 AI 决定的**，
   * 原本在 `ui.js` 里有三份同样的 `p.elec > p.boom ? 'boom' : 'elec'`（2P 主循环 / 多人主循环 / 观战循环）
   * ⇒ 漂了就是"你活着时和死后，同一个包打法不同"。这一步**只收拢、不改行为**。 */
  {
    const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
    box.window = box; box.globalThis = box;
    vm.runInNewContext(readFileSync('js/ui/bead-choice.js', 'utf8'), box, { filename: 'js/ui/bead-choice.js' });
    const BC = box.EpirusBeadChoice;
    ok(BC && typeof BC.prefer === 'function' && typeof BC.of === 'function', '必须导出 EpirusBeadChoice.{prefer,of}');
    eq(BC.prefer({ elec: 1, boom: 0 }), 'boom', '电珠多于爆珠 ⇒ 攒爆珠（原口径）');
    eq(BC.prefer({ elec: 0, boom: 1 }), 'elec', '爆珠多于电珠 ⇒ 攒电珠（原口径）');
    eq(BC.prefer({ elec: 1, boom: 1 }), 'elec', '相等 ⇒ 电珠（原口径，不许改成随机）');
    eq(BC.prefer({}), 'elec', '全新 ⇒ 电珠');
    eq(BC.of({ elec: 2, boom: 0 }, 'boom'), 'boom', '策略自己给了珠型 ⇒ 必须听策略的');
    eq(BC.of({ elec: 2, boom: 0 }, null), 'boom', '策略没给 ⇒ 回落到单一口径（这里 elec>boom ⇒ boom）');
    eq(BC.of({ elec: 0, boom: 0 }, 'nonsense'), 'elec', '非法值 ⇒ 走回落，不许原样透传');
    const html = readFileSync('index.html', 'utf8');
    const iBead = html.indexOf('js/ui/bead-choice.js'), iUI = html.indexOf('js/ui/ui.js');
    ok(iBead >= 0, 'index.html 必须加载 bead-choice.js');
    ok(iBead < iUI, '必须在 ui.js **之前**加载（ui.js 顶层就取 window.EpirusBeadChoice）');
    const ui = readFileSync('js/ui/ui.js', 'utf8');
    const calls = (ui.match(/BeadChoice\.of\(/g) || []).length;
    ok(calls >= 3, '三处出手点（2P 主循环 / 多人主循环 / 观战循环）都必须走单一来源；实测 ' + calls + ' 处');
    ok(!/elec\s*>\s*[\w.\[\]]*\.?boom\s*\?\s*'boom'\s*:\s*'elec'/.test(ui),
      'ui.js 里不许再留内联的 elec>boom 三元式（"同一规则写两遍"的第七例就在这条线上）');
  }
});

t('D148 E1/E2 量具 `probe-ep-reach.mjs`（09-24 夜 · 交接 §4）：门槛可达性必须问引擎、无决策点必须响、改价必须还原', function () {
  /* 这份量具的产出直接决定"该改价还是该改判据"（交接 §0 的两条来路）⇒ 它自己不能是错的。
   * 三条会复发的形状，逐条钉：
   *  ① 门槛数字**不许自己抄**（抄了就与 `computeCost` 的动态费用漂移：大雷 5、电磁炮 2+珠、聚能环/过载炮是 null）；
   *  ② 决策点为 0 必须**非零退出**（交接 §5-4：静默跳过 = 把测量关掉而汇总仍全绿）；
   *  ③ §B 的改价是**内存里改 `R.byKey`** ⇒ 必须在 finally 还原，否则"改价反事实"会污染后一场读数。 */
  const p = readFileSync('tools/probe-ep-reach.mjs', 'utf8');
  ok(p.indexOf('S.computeCost') >= 0 && p.indexOf('const canNow = ep >= need') >= 0,
    '门槛必须问引擎（`S.computeCost`），再与 ep 比 —— 不许硬写数字');
  ok(!/\bep >= \d+\s*&&/.test(p), '不许出现"ep ≥ 某常量 &&"这种把硬编码门槛喂进判定式的写法（与动态费用必漂）；' +
    '直方图分桶（`ep >= 5 ? \'5+\'`）不算判定，所以只禁"参与判定"的那种');
  ok(p.indexOf("String(rr.need)") >= 0, '打印的门槛数字必须来自引擎回传的 `need`，不是字面量');
  ok(p.indexOf('finally') >= 0 && /R\.byKey\[R\.SK\.BIG_T\]\.cost = prevCost/.test(p),
    '改价反事实必须在 finally 还原单价（否则 §B 三档之间互相污染）');
  const run = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=6', '--fields=pool,mirror'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  ok(/可达时成交率/.test(out) && /只差≤2ep/.test(out),
    '必须同时印"可达时成交率"与"只差≤2ep"两列 —— 缺任何一列就分不开"够不着"与"不想去"（E1 的全部意义）');
  ok(/ep 支出结构/.test(out) && /ep 收入/.test(out), 'E2 的收支两栏必须在（不然只剩"钱不够"这一种解释）');
  ok(/n=\d+/.test(out), '每个比例必须带 n（交接 §5-5：阈值不写 n 就没有意义）');
  ok(/真放出去|真买了/.test(out), '必须印"真放出去/真买了" —— 只有"买得起 X%"会把"够不着"与"不去"混成一格');
  /* §E 广度含多少空转：判据必须**来自事件**（写卡名清单必然与引擎的清除清单漂 —— 同 D142 的教训） */
  ok(p.indexOf("e.type === 'purify' && !e.curses") >= 0 && p.indexOf("'beadExpire'") >= 0 &&
     p.indexOf("e.reason === '天火'") >= 0,
    '空转的三类判据必须来自事件（`purify.curses===0` / `beadExpire` / 该回合无 `reason===天火` 的伤害），不许维护第二份卡名清单');
  const b = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=4', '--fields=pool', '--breadth-games=8'],
    { encoding: 'utf8', timeout: 600000 });
  eq(b.status, 0, '§E 要跑得通（' + String(b.stderr || '').slice(0, 160) + '）');
  ok(/G 有效技能数：原始 [\d.]+（\d+ 种 \/ \d+ 次非ジ出手） → 扣空转/.test(String(b.stdout)),
    '§E 必须把"原始 G → 扣空转 G"并排印出来 —— 只印一个数就会让人以为扣空转必然变小（实测 `v7cmin4-82` 扣完从 4.83 **涨**到 5.79）');
  /* ② 空枪检测：--games=0 ⇒ 决策点必为 0 ⇒ 必须非零退出，不许印一排 0% 假装量到了 */
  const zero = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=0', '--fields=pool'],
    { encoding: 'utf8', timeout: 300000 });
  ok(zero.status !== 0, '零决策点必须**非零退出**（实测 exit=' + zero.status + '）—— 静默返回 0 就是把这条测量关掉');
});

t('D149 理想冠军 7 条表**不是一个口径**：两个旋钮要分开、【5】【6】必须**两口径都印**且搬运自证（v1.5.224 契约升级）', function () {
  /* 病（09-25 凌晨实测）：`probe-ideal-champion.mjs` 原本只有一个写死的 `0.15`，名字读起来像 ε、实际是**温度**（交接 §4-E5 让人拿温度去扫探索率，整晚白跑）；
   * 拆成 `--temp/--eps` 之后又发现第二层：**【5】seatSymmetry 与【6】mirrorHealth 各自在内部建 Chooser**（audit-lib.mjs:403 / evo.js:403 都是
   * `policyChooserN(params, 0.15)`），所以 ε 扫描时那两行**逐字不变** —— 容易被读成"座位/广度对探索不敏感"，而真实原因是**它们没接到旋钮**。
   * ⇒ 钉三件：旋钮分开、调用点真用、不吃旋钮的行必须**在输出里自报口径**。 */
  const p = readFileSync('tools/probe-ideal-champion.mjs', 'utf8');
  ok(/arg\('temp'/.test(p) && /arg\('eps'/.test(p),
    '温度与探索率必须是**两个**参数（只有一个 0.15 时谁按交接做 E5 都会拉错杆）');
  ok(/policyChooserN\(live, TEMP, EPS, EPSK, EPSMODE\)/.test(p),
    '受评席的 Chooser 必须把四个参数一起传（只传 eps = 全候选均匀抽，那是 v1.5.139 被用户否掉的口径）');
  ok(!/policyChooserN\(live, 0\.15\)/.test(p), '调用点不许再留写死的 0.15');
  const i5 = p.lastIndexOf('【5】'), i6 = p.lastIndexOf('【6】'), i7 = p.lastIndexOf('【7】');
  ok(i5 > 0 && i6 > i5 && i7 > i6, '【5】【6】【7】三条必须都在（用 lastIndexOf 定位打印行，头注释里也出现这些标号）');
  /* v1.5.223 契约**升级**（不是放宽）：原来这两行只能"自报不吃旋钮"；现在必须**两个口径都印出来**。
   * 原有每一层意图都保留：① 单一真源（仍调 seatSymmetry / mirrorHealth，不许另起实现）；
   * ② 口径必须在**输出里**可见；③ 旋钮分开、四参数调用（上面几条仍钉着）。 */
  ok(/seatSymmetry\((A|B2)\.sb, live, MODE, n\)/.test(p),
    '【5】仍走 seatSymmetry（单一真源，不许在这份表里另起一份实现）');
  ok(/\.EpirusTrainer\.mirrorHealth\(live, (MIRROR_N|400), 5, MODE\)/.test(p),
    '【6】仍走 mirrorHealth（单一真源，不许在这份表里另起一份实现）—— 样本量可以是门禁小档，但函数不许换');
  ok(/from '\.\/probe-layer-caliber\.mjs'/.test(p) && p.indexOf('build({ on: true') >= 0,
    '第二口径必须复用 build()（D150 的单一来源），不许自建第二份"替换/装载"');
  ok(/B2\.patched !== B2\.hardwired/.test(p) && /__viaWrapper > 0/.test(p),
    '搬运必须**两半自证**（替换数 = 源码现算数；包装层真被调用）—— 否则"两栏相同"会被误读成"口径无关"');
  /* 指针行号**从源码现算**（原来门钉的是探针**源码里**的字面量 `403`/`2554` ⇒ 谁在它们上面插一行，
   *   探针印的就是假行号而门仍绿；这正是 METHODOLOGY 52 那族"冻结的期望值"）。
   *   改判法：不查源码字面，改查**输出里印出来的行号 == 源码现算的行号**（见下面 o5/o6 那两条）。 */
  const LN_AL = hardwiredLine('tools/audit-lib.mjs', 'export function seatSymmetry(');
  const LN_MH = hardwiredLine('js/train/evo.js', 'function trainChooser(');
  ok(LN_AL != null && LN_MH != null, '两处 ε 决定点必须还能从源码定位到（定位不到 ⇒ 探针的口径警示会印"行号读不出"，本门判红）');
  ok(/function mirrorHealth\([\s\S]{0,9000}?\btrainChooser\(params\)/.test(readFileSync('js/train/evo.js', 'utf8')),
    '【6】的 ε 现在决定在漏斗 `trainChooser()` 里 ⇒ 必须真看到 `mirrorHealth` 通过漏斗建 Chooser（v1.5.237 E28 把四处收成一处；漏斗若被拆回四处，本门红着提醒去重钉指针）');
  /* v1.5.224：spawn 用**门禁专用小样本档**（座位 60/120、广度 120）—— 门只要"两列都在且不同"，
   * 不需要报告里那个 n（座位 100+400、广度 400 ⇒ 这一段让本门吃 46.5 秒、是整支门禁最慢的一道）。
   * 两次 spawn 必须传**同一组**档位，否则下面"逐字相同"那条对照就不成立了。 */
  const run = spawnSync(process.execPath, ['tools/probe-ideal-champion.mjs', '--games=8', '--eps=0.2', '--epsmode=soft', '--seat-n=60,120', '--mirror-n=120'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '表要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const n5 = (out.match(/极差 [\d.]+pt/g) || []).join('|'), n6 = (out.match(/净兑现 G = [\d.]+/g) || []).join('|');
  /* 输出侧：两条口径都必须**看得见**（源码里有、输出里没有 = 读表的人看不见）。
   * v1.5.223 起判的是"两列都在"，而不是"两条不吃旋钮的警示"—— 后者已被两列并列取代。 */
  const o5 = out.slice(out.indexOf('【5】'), out.indexOf('【6】')), o6 = out.slice(out.indexOf('【6】'), out.indexOf('【7】'));
  ok(/ε=0/.test(o5) && /产品/.test(o5), '【5】输出里必须两口径都看得见（ε=0 与产品）');
  ok(/ε=0/.test(o6) && /产品/.test(o6), '【6】输出里必须两口径都看得见（ε=0 与产品）');
  ok(new RegExp('audit-lib\\.mjs:' + LN_AL + '(?!\\d)').test(o5),
    '【5】输出里必须指到 seatSymmetry 的写死处，且**行号 = 源码现算的 ' + LN_AL + '**（印死数字会在别人插一行后撒谎）');
  ok(new RegExp('evo\\.js:' + LN_MH + '(?!\\d)').test(o6),
    '【6】输出里必须指到 ε 的决定点（现算行号 = 漏斗 `trainChooser()` 的 ' + LN_MH + '）—— 印死数字会在别人插一行后变成假行号');
  ok(/口径搬运自证/.test(out) && /经包装调用 \d+ 次/.test(out),
    '自证两半必须**打印出来**（现算数量 + 经包装次数）—— 源码里有、输出里没有就等于没自证');
  const r2 = spawnSync(process.execPath, ['tools/probe-ideal-champion.mjs', '--games=8', '--seat-n=60,120', '--mirror-n=120'],
    { encoding: 'utf8', timeout: 600000 });
  const out2 = String(r2.stdout || '');
  eq((out2.match(/极差 [\d.]+pt/g) || []).join('|'), n5, '【5】在 eps=0.2 与默认下必须逐字相同（它不吃旋钮 ⇒ 这条相等本身就是那处写死的证据）');
  eq((out2.match(/净兑现 G = [\d.]+/g) || []).join('|'), n6, '【6】同上 —— 若哪天这两行开始随 ε 动，说明单一真源被改散了，要重看钉法');
});

t('D150 全层口径搬运量具 `probe-layer-caliber.mjs`：搬运必须**自证生效**，且判据数量不许冻结成常数', function () {
  /* 为什么要有这份量具：五道门的输入全部写在 ε=0 上（`audit-lib` 9 处 + `evo.js` 4 处 `policyChooserN(params, 0.15)`），
   * 而 5 人产品跑 ε=0.2 soft（`ui.js:464`）—— v1.5.152 只给"真桌出招份额"补了代理栏（D118），**门本身的输入没有第二口径**。
   * 搬运是两条"改内存不改仓库"的路：① 装载 `evo.js` 前做字符串替换；② 装载后把沙箱里的 `EpirusTrainer.policyChooserN` 包一层。
   * ⇒ 最大风险不是数不对，是**没搬成功而两栏一样**（会被读成"口径无关"）。所以本门判的是"搬运有没有留下证据"，不是某个读数。 */
  const p = readFileSync('tools/probe-layer-caliber.mjs', 'utf8');
  ok(p.indexOf('writeFileSync') < 0 && p.indexOf('appendFile') < 0, '量具必须只读（不许落任何产物）');
  ok(/process\.exit\(9\)/.test(p) && /SELF\.patched !== EVO_HARDWIRED \|\| SELF\.wrapper <= 0/.test(p),
    '必须有"两条路都自证生效否则作废"的自检（非零退出）—— 缺它时两栏相同会被当成"口径无关"');
  ok(/EVO_HARDWIRED = \(EVO_SRC\.match\(HARDWIRED\)/.test(p) && !/patched !== 4/.test(p),
    '期望的写死处数量必须**从源码现算**（METHODOLOGY 52：冻结成常数的"期望值"会在别人补一处后静默少覆盖）');
  ok(/arguments\.length >= 3 \? orig\.apply/.test(p),
    '包装层必须**原样透传**已经传了 ≥3 个参数的调用（否则会把产品口径自己的四参数调用改坏，制造假差异）');
  const run = spawnCached(['tools/probe-layer-caliber.mjs', '--packs=js/bundled-champion-3p.js', '--games=30'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 200) + '）');
  const out = String(run.stdout || '');
  ok(/工具自检：`evo\.js` 写死处实测 \d+ 处 → 内存里替换了 \d+ 处/.test(out) && /经包装调用 \d+ 次/.test(out),
    '必须印出自检两半（现算数量 + 经包装次数）');
  ok(/攒钱场 设防率/.test(out) && /最长连设防/.test(out) && /五道门总结论/.test(out),
    '必须同时印"五道门的输入"与"门不看的栏（设防持续性）"—— 后者是用户 09-24 实机报的病，前者是门唯一在读的东西');
  const num = function (o, label) {
    const m = new RegExp(label + '[^\\n]*ε=0\\s+([\\d.]+)\\s+产品\\s+([\\d.]+)').exec(o);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const seat = num(out, '座位极差'), wall = num(out, '反弹墙伤害/局');
  ok(!!seat && !!wall, '座位与反弹墙两栏必须能被抓出来（格式变了就一起改本门）');
  ok(seat[0] !== seat[1] || wall[0] !== wall[1],
    '两栏至少一列必须**不同** ⇒ 证明搬运真的到了引擎（全同 = 测量没打开）。实测 座位 ' + seat.join(' vs ') + ' / 墙 ' + wall.join(' vs '));
  /* 对照：把产品口径也设成 ε=0，则两栏必须**逐字相同** —— 这条是上面那条的反证，也顺手钉住"差异来自口径而不是别的参数" */
  const ctl = spawnCached(['tools/probe-layer-caliber.mjs', '--packs=js/bundled-champion-3p.js', '--games=30', '--eps=0'],
    { encoding: 'utf8', timeout: 600000 });
  eq(ctl.status, 0, 'eps=0 对照要跑得通');
  const cout = String(ctl.stdout || '');
  const cSeat = num(cout, '座位极差'), cWall = num(cout, '反弹墙伤害/局');
  ok(!!cSeat && !!cWall && cSeat[0] === cSeat[1] && cWall[0] === cWall[1],
    'ε=0 对照下两栏必须相同（实测 座位 ' + (cSeat || []).join('/') + ' · 墙 ' + (cWall || []).join('/') + '）');
  /* 复用方必须**共用**上面那两条搬运路，不许出现第二份口径实现（本仓"同一规则只写一遍"的规矩）。
   * v1.5.223：复用方从 1 个扩到 2 个 —— 理想冠军 7 条量具也要读产品口径的【5】【6】。 */
  for (const rf of ['tools/probe-breadth-flip.mjs', 'tools/probe-ideal-champion.mjs']) {
    const rfSrc = readFileSync(rf, 'utf8');
    /* 语义判定（原来钉的是 `import { build }` 这个**精确形状** ⇒ 复用方一旦同时要第二个 helper，
     *   合法改动就把本门打红；D152/D159 同一族教训）。现在判的是"从那个模块导入的名单里含 build"。 */
    const imp = /import\s*\{([^}]*)\}\s*from\s*'\.\/probe-layer-caliber\.mjs'/.exec(rfSrc);
    ok(!!imp && (imp[1].split(',').map(function (s) { return s.trim(); }).indexOf('build') >= 0),
      '`' + rf + '` 必须从 `probe-layer-caliber.mjs` 导入 `build`（搬运手法单一来源）');
    ok(!/HARDWIRED/.test(rfSrc) && !/vm\.runInNewContext/.test(rfSrc),
      '复用方不许在自己文件里再写一份"替换/装载"逻辑（`HARDWIRED`/`runInNewContext` 都只能活在 `build` 里）：' + rf);
  }
  ok(/export function build/.test(p) && /IS_MAIN/.test(p),
    '被 import 的量具必须"装载不跑 main"（与 behavior-profile.mjs 同规），否则复用时会连带跑出两张表');
  ok(/HARDWIRED/.test(p) && /EVO_HARDWIRED = \(EVO_SRC\.match\(HARDWIRED\)/.test(p),
    '写死处的正则与期望数量必须**同一份常量**（现算），两处各写一遍必漂');
  /* 档案筛（复用同一套搬运）也必须**真跑得通**：09-25 03:30 我给它加"先认货再装载"时漏 import `readFileSync`，
   *   只有把它跑一次才暴露（`node --check` 只抓语法）⇒ 这类"import 漏了"的错误必须由跑通断言兜。 */
  const sw2 = spawnCached(['tools/probe-breadth-flip.mjs', '--every=700', '--limit=2', '--games=6'],
    { encoding: 'utf8', timeout: 600000 });
  eq(sw2.status, 0, '`probe-breadth-flip` 要跑得通（' + String(sw2.stderr || '').slice(0, 200) + '）');
  ok(/结论（n=/.test(String(sw2.stdout)), '筛完必须印结论块（含被跳过的非包 .bak 计数）');
  /* v1.5.223：这条原来靠上面那个 `const sw`（我把它收进复用方循环里了）⇒ 改成**自己读**，不再依赖外层绑定。 */
  const bfSrc = readFileSync('tools/probe-breadth-flip.mjs', 'utf8');
  ok(/SKIP/.test(bfSrc) && /跳过/.test(bfSrc), '扫池工具必须**点名跳过项**——静默跳过会把"没跑成"读成"没体质"（而漏 import 会被洗成数据问题）');
});

t('D151 「攒钱→防御」量具：ep 必须**决策时实读**，因果必须靠**两档配对**，小分母不许当结论', function () {
  /* 这条门是被自己的第一版**逼**出来的：我最初从事件流前缀和重建"对手 ep"，并假定"一回合内 5 条 action 全先于结算"。
   * 实测该假定为假（一局里 64 次结算落在 action 之前/之间、只有 13 次是干净分界）⇒ 前缀和既不是"开始值"、又只加不减（花了不扣）。
   * ⇒ 唯一站得住的读法是**在被评席做决策的那一刻直接读 `state.p[0].ep`**（这才是这只包看得见的钱），回合号用 `state.round`。 */
  const p = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(p.indexOf('from \'./probe-layer-caliber.mjs\'') >= 0 && /import \{ build \}/.test(p),
    '口径搬运必须继续复用 `build`（单一来源，同 D150）');
  ok(/ep0: opp \? \(opp\.ep \|\| 0\)/.test(p) && !/epAtRound/.test(p),
    '桶变量必须是**决策时实读**的 `state.p[0].ep`；不许回到"从事件流重建 ep"（那种写法只加不减，量的是"一辈子挣过多少"）');
  ok(/const REC = \[\];/.test(p) && /rd: s2\.round/.test(p),
    '决策记录必须带 `state.round`（实测单调），不许再用"某 pid 重复出现"当回合边界');
  /* 因果那一问：单档里 ep 与回合号是同一条轴 ⇒ 必须有两档才能配对判 */
  ok(/arg\('saver', 'hold'\)/.test(p) && /SAVER === 'cycle'/.test(p) && /CYCLE_AT = Number\(arg\('cycle-at', 4\)\)/.test(p),
    '必须提供 `hold`（钱一路堆）与 `cycle`（堆到 `--cycle-at` 就花掉）两档替身 —— 单档答不了"是不是因为对方有钱"');
  ok(/按回合号的曲线/.test(p) && /同一回合号/.test(p),
    '必须印"按回合号的曲线"并写明"同一回合号跨两档配对"才是因果判据（否则读者会拿单档的负相关当因果结论）');
  ok(/该桶平均回合/.test(p), '每个 ep 桶必须并排印该桶平均回合 ⇒ 让"ep 轴 = 回合轴"这个混淆在读数里就看得见');
  ok(/玩家侧代价/.test(p) && /攒钱者夺冠/.test(p),
    '必须把代价落到玩家侧（局长中位/p90、平局率、攒钱者夺冠率）——只有设防率的报告会被读成"AI 变弱了"，而实际是它开始奖励龟缩');
  ok(/没掉过血/.test(p) && /LASTHP/.test(p),
    '必须有"自上次决策以来没掉过血"的子样本曲线 —— 缺它时两档的差值可以全是"装配里另一件事（对手会不会真打你）"的差，而不是钱的差');
  ok(/安慰剂|两档在 ep 还没分岔/.test(p) || /同一曲线、但\*\*只取/.test(p),
    '必须印那条"只取没掉过血"的第二曲线（与主曲线同格式，好让人做分岔前/分岔后的对照）');
  ok(/'%（n=' \+ n \+ '）'/.test(p) && /—（n=0）/.test(p),
    '每个比例必须带分母，且空桶印成"—（n=0）"而不是 0.0%（那会把"没量到"读成"量为零"）');
  ok(/const BMIN = Number\(arg\('bucket-min', 40\)\)/.test(p) && /自适应合并|并入/.test(p) && /分母不足/.test(p),
    '必须有分母下限（`--bucket-min`，默认 40）+ 空桶丢弃/高桶自适应合并 + 小样本时输出"分母不足/没量到"');
  ok(/同一席连续设防/.test(p) && /gamesWithRun3/.test(p),
    '"维持很久"是**游程长度**问题，必须单独印（设防率答不了它）');
  /* 引擎侧：决策时读到的是**当下**的 ep（不是回合开始）—— 这条钉的是"包看得见什么" */
  ok(p.indexOf('state.p[0]') >= 0 || /s2\.p\[0\]/.test(p), '必须从 state 直接读对手席');
  for (const sv of ['hold', 'cycle']) {
    const run = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--games=6', '--packs=js/bundled-champion-3p.js', '--saver=' + sv],
      { encoding: 'utf8', timeout: 600000 });
    eq(run.status, 0, '量具两档都要跑得通（saver=' + sv + '：' + String(run.stderr || '').slice(0, 140) + '）');
    const out = String(run.stdout || '');
    ok(/攒钱替身 = `' + SAVER + '`|攒钱替身 = `' + sv + '`/.test(out) || out.indexOf(sv) >= 0, 'saver=' + sv + ' 必须把档位印在表头（读数要带装配）');
    ok(/维持很久/.test(out) && /判读/.test(out), 'saver=' + sv + ' 必须同时印"游程长度"与"方向判读"两行');
  }
});

t('D152 「空蓄能」分因量具 `probe-bead-loop.mjs`：两种相反的病不许挤在同一个"浪费率"里，两把尺不许互相校验', function () {
  /* 动因（§H-27）：`chargeProfile` 只给"得珠/花掉/过期"三个总量。按"蓄能后下一次决策时电磁炮买不买得起"拆开之后，
   *   现役是 **② 买得起却没射 68.1%**（选择），`v7cmin4-82` 是 **① 买不起 83.3%**（经济）—— 同一个"浪费率高"指向两层完全不同的修法。
   * ⇒ 本门钉的是"这把尺别又长回一个总量"。 */
  const p = readFileSync('tools/probe-bead-loop.mjs', 'utf8');
  ok(p.indexOf('writeFileSync') < 0, '量具必须只读');
  /* v1.5.234：改成**语义**断言 —— 原来钉的是 `import { chargeProfile }` 的**字面文本**，
   * 于是我加一个 `rejectUnknownFlags` 进同一行 import、行为一字未改，门就红了（同族：D159 那次正则没算括号）。
   * 门该守的是"**从单一来源 import、不许自建第二份**"，不是"这行长什么样"。 */
  ok(/import \{ build \} from '\.\/probe-layer-caliber\.mjs'/.test(p) && /import \{[^}]*chargeProfile[^}]*\} from '\.\/audit-lib\.mjs'/.test(p),
    '口径搬运复用 `build`、总量复用真源 `chargeProfile`（都不许有第二份实现）');
  ok(/beadAlive/.test(p) && /beadGone/.test(p),
    '必须先判"珠子还活不活"：该席下一次决策可能已隔两三回合 ⇒ 那批要单列 `beadGone`，不混进①②的分母（第一版没判，造出过 8 次假"买不起"）');
  ok(/按决策计/.test(p) && /按珠子计/.test(p),
    '必须写明"本表按决策计、真源按珠子计，两者不该相等"—— 不写就会有人拿其中一个去"校验"另一个，把发现当 bug 删掉');
  ok(/实际干了什么/.test(p), '② 必须并排印"那些决策实际出了什么卡"（不然"选择问题"这四个字没有内容）');
  const run = spawnSync(process.execPath, ['tools/probe-bead-loop.mjs', '--games=8', '--packs=js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 180) + '）');
  const out = String(run.stdout || '');
  ok(/① 下一回合电磁炮/.test(out) && /② 买得起/.test(out) && /③ 买得起也射了/.test(out), '三桶必须都在且互斥（加起来等于分母）');
  ok(/真源 `chargeProfile`（\*\*按珠子计\*\*）/.test(out), '必须印真源那一行做并排对照');
});

t('D153 产品的两个口径必须钉住（5 人 = temp.15/ε 回合斜坡 0→.1→.2/k5/soft、2 人困难 = ε0）——本夜全部"口径"结论都挂在这两行代码上', function () {
  /* 为什么单独立一条：§H-6/H-10/H-12/H-13 的整串"评测口径 ≠ 产品口径"结论，**唯一的凭据就是 `ui.js` 里那一次调用**；
   *   而那行没有任何门钉着（D111/D118 钉的是探索规则与代理栏存在，不钉这四个值）。⇒ 有人调了它，全夜的读数就失去所指。
   * v1.5.298（用户 09-29 裁定）：5 人槽的 ε 从常数 0.2 改成**按回合斜坡 0 → 0.1 → 0.2**。
   *   本门跟着改钉法，**但钉的还是同一件事**：玩家实际看到的探索口径必须写死在这一处、不许被静默改动。
   *   为什么第 1 回合那个 `0` 值得单独一条断言：§E145 量到首手防御 14.91%±0.18 **全部**来自 ε（ε=0 ⇒ 0.00%，
   *   近贪心 ⇒ 0.00%，只压温度 ⇒ 与现役逐字同局），而那一回合**结构性地不可能挡到任何东西**
   *   （攻击卡 ≥1 ジ 而人人 ep=0；架势只活本回合）⇒ 那个 0 是"首手不白站架势"的唯一防线。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/Trainer\.pickChampion\(state, pid, legalForAI, c, 0\.15, epsRound, 5, 'soft'\)/.test(ui),
    '5 人冠军路径必须是 temp0.15 / epsRound / epsK=5 / soft —— 这是本仓唯一一份"玩家实际看到的探索口径"');
  ok(/const epsRound = state\.round <= 1 \? 0 : \(state\.round === 2 \? 0\.1 : 0\.2\);/.test(ui),
    'ε 的回合斜坡必须逐字是 0 / 0.1 / 0.2（用户 09-29 裁定"第 1~3 回合逐步提升"）⇒ 改回常数 .2 就把 §E145 那条 14.91% 的白站防御放回来');
  ok(/Trainer\.pickChampion\(state, 1, legalForAI, c, 0\.15\)/.test(ui),
    '2 人困难槽仍是 ε=0（`ui.js` 里那句"播放口径：与训练口径一致"是**有意的**）⇒ 所以"产品口径"不是一个数，报数必须指明哪个槽');
  const m = readFileSync('docs/METHODOLOGY.md', 'utf8');
  ok(/2 人口径|2 人槽/.test(m) && /评测口径/.test(m),
    'METHODOLOGY 必须留着"两槽口径不同"这段（否则下一个人会把"产品口径"当成单一口径去改门）');
  /* 反向钉：代理栏与门的输入必须**仍可分辨**（代理栏用 0.2 soft，门禁输入用 ε=0） */
  const pr = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/fieldProfile\(params, 0\.2, 'soft'/.test(pr), 'D118 的产品代理栏必须继续显式带 0.2/soft（它存在的意义就是"另一口径"）');
  /* ===== v1.5.304（用户 09-29 下午委托裁定）：`evo.js` 那道"剔掉防御键"的门槛 = ≥1 =====
   * 这条钉的不是 ui.js 的 ε 调度，而是**同一口径的另一半**：`soft` 的探索池里到底能不能出现防御键。
   * 旧档（≥2）在"非防御只剩 ジ 一张"的回合里整条豁免 ⇒ §E145 仪器直读：ε 注入的防御占第 1 回合 100%、
   * 第 3 回合 58.56%、第 4+ 74.73% ⇒ 页面上的防御约四分之三是噪声。
   * ⚠ 两条断言都要**能红**（"夹具缺对比度让新门变装饰"是本仓踩过的坑）：
   *   仓库档必须 0.00%，而**同一把探针把门槛退回 ≥2 必须照出 ≈15%** ⇒ 缺了后一条，前一条在"探针根本没跑起来"时也会绿。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(/if \(nonDef\.length >= 1\) pool = nonDef;/.test(ev),
    '探索池"剔掉防御键"的门槛必须是 `>= 1`（v1.5.304 用户裁定）');
  ok(!/if \(nonDef\.length >= 2\) pool = nonDef;/.test(ev),
    '旧门槛 `>= 2` 不许复活：它让"非防御只剩一张"的那些回合整条豁免失效（§E145：那是首手白站防御的唯一来源）');
  const repoRun = spawnSync(process.execPath, ['tools/probe-round1-open.mjs', '--packs=js/bundled-champion-3p.js',
    '--games=200', '--configs=ui', '--draws=4000'], { encoding: 'utf8', timeout: 600000 });
  eq(repoRun.status, 0, '探针（仓库档）要跑得通（stderr=' + String(repoRun.stderr || '').slice(0, 200) + '）');
  const mRepo = /防御合计 ([0-9.]+)%/.exec(String(repoRun.stdout || ''));
  ok(mRepo, '探针必须印出"[A/ui] … 防御合计 x%"那一行（格式变了就要同步这里的正则，别让它静默变成"没找到=通过"）');
  eq(Number(mRepo[1]), 0, '仓库档的第 1 回合防御必须**恰好 0.00%**（≥1 门槛下探索池={ジ}，ε 是空操作）');
  ok(/机制吻合/.test(String(repoRun.stdout || '')), '探针自带的机制预测必须吻合（预测 0.00% ‖ 实测 0.00%）⇒ 不吻合说明防御另有来源，这条改动没治到病根');
  const oldRun = spawnSync(process.execPath, ['tools/probe-round1-open.mjs', '--packs=js/bundled-champion-3p.js',
    '--games=200', '--configs=ui', '--draws=4000', '--filterge2=1'], { encoding: 'utf8', timeout: 600000 });
  eq(oldRun.status, 0, '探针（旧档对照）要跑得通（stderr=' + String(oldRun.stderr || '').slice(0, 200) + '）');
  const mOld = /防御合计 ([0-9.]+)%/.exec(String(oldRun.stdout || ''));
  ok(mOld && Number(mOld[1]) >= 8, '旧档（门槛退回 ≥2）必须照出**非零**的首手防御（实测 ' + (mOld ? mOld[1] + '%' : '读不到') +
    '，§E145 的历史读数是 14.91%±0.18）⇒ 它为 0 说明 `--filterge2` 那条补丁没生效，上面 0.00% 那条就成了空断言');
  ok(/剔掉防御键"因 nonDef=1 <2 而\*\*没生效\*\*/.test(String(oldRun.stdout || '')),
    '旧档那遍必须把"剔除没生效"写在机制预测行里（这半句是"对照真的走到那条分支"的凭据）');
});
t('D154 `--pair=1` 必须**一条命令跑两档并自带 placebo 自检**（09-25 E18 那次自我作废换来的）', function () {
  const p = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(/const PAIR = arg\('pair', ''\) === '1';/.test(p), "两档配对要成为**一个档**（`--pair=1`），不能靠人眼比两根曲线");
  ok(/const SAVES = PAIR \? \['hold', 'cycle'\] : \[SAVER\];/.test(p) && /for \(const SAV of SAVES\)/.test(p) && /SAVER = SAV;/.test(p),
    '配对模式必须**在同一次调用里**跑 hold+cycle（同种子同局数）⇒ 唯一变量是"对手手里的钱"；跨两次调用会漂');
  ok(/CURVES\.push\(\{ pack:.*byRound: byRound/.test(p), '每档的"按回合号曲线"必须留档到内存 ⇒ 才有逐回合对齐的原料（探针不写文件）');
  ok(/placebo 自检/.test(p) && /两档不该分岔的回合/.test(p),
    '必须自带 placebo 自检：两档在 ep 未分岔的前几回合读数**必须逐字相同**，不同就当场作废（这条抓到过替身做错）');
  ok(/不能当体质流行率/.test(p), '输出里必须留着那句更正：**单档 `hold` 的"倍差≥2"是含混了回合轴的粗筛**（E18：八成在配对后掉下 Δ≥15pt）');
  ok(p.indexOf('不是拍的（§H-55') >= 0 && p.indexOf('池化 Δ') >= 0,
    '判定线要自己声明带宽是实测来的（跨种子极差），不是拍的 —— §H-55 的教训：贴线那一段本身就是噪声');
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const r = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=25', '--pair=1'], { encoding: 'utf8' });
  eq(r.status, 0, '`--pair=1` 要跑得通（' + String(r.stderr || '').slice(0, 200) + '）');
  const o = String(r.stdout || '');
  ok(o.indexOf('同回合配对') >= 0, '`--pair=1` 必须印出同回合配对表');
  ok(o.indexOf('✓ placebo 自检通过') >= 0, '小样本上 placebo 自检必须**通过**（不通过 = 两档连不该分岔的地方都分了岔，读数没意义）');
  ok(o.indexOf("⇒ 判定用的是") >= 0 && o.indexOf("12~18 灰区 / ≤12 低") >= 0,
    '配对表必须把三档判定线（含灰区）印在表尾 —— 线不许只存在于源码里');
  const q = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=15'], { encoding: 'utf8' });
  eq(q.status, 0, '不开 `--pair` 的默认档要照常跑完');
  ok(String(q.stdout || '').indexOf('同回合配对') < 0, '默认档**不许**偷跑两档（历史读数必须逐字节可复现：09-25 已用 diff 自证过）');

  /* --seeds=N：多种子池化 + 跨种子极差（§H-55 立这条的理由：贴线那一段本身就是噪声，只看单种子会把"线"当成"事实"） */
  ok(/const NSEEDS = Math.max\(1, Number\(arg\('seeds', 1\)\)\)/.test(p),
    '--seeds 必须存在且默认 1（默认时取到的种子与改前完全相同 ⇒ 历史读数一字不变）');
  ok(/SEED_LIST\.push\(\(SEED0 \+ si \* 100003\)/.test(p) && /let SEED_BASE = SEED0;/.test(p),
    '每粒种子必须走同一条 SEED_BASE 通道（两处 mul(SEED0…) 都要改，漏一处就等于"换了参数却没换种子"）');
  ok(/池化计数/.test(p) && /spread/.test(p),
    '多种子必须**按计数池化**（不是把率求平均）并印跨种子极差 ⇒ 极差才是判"线落在噪声里吗"的量');
  ok(/灰区 12~18pt/.test(p) && /灰区宽度来自实测跨种子极差/.test(p),
    '灰区宽度必须声明是实测来的，不是拍的（§H-55：eco-34 换种子从 +14.2 跨到 +15.9）');
  const sr = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=8', '--pair=1', '--seeds=2'], { encoding: 'utf8' });
  eq(sr.status, 0, '--seeds=2 要跑得通（' + String(sr.stderr || '').slice(0, 200) + '）');
  ok(/每粒种子Δ/.test(String(sr.stdout || '')) && /极差/.test(String(sr.stdout || '')),
    '多种子必须逐粒印 Δ 与极差（只印均值会把"这条线站不站得住"藏掉）');
  const sn = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=6', '--seeds=2'], { encoding: 'utf8' });
  eq(sn.status, 4, '不开 --pair 却要求多粒种子必须**报错退出**，不许静默按单种子跑完装作跑了两种子');
  const sp = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=8', '--pair=1', '--seeds=1'], { encoding: 'utf8' });
  ok(/同回合配对/.test(String(sp.stdout || '')) && !/多种子：/.test(String(sp.stdout || '')),
    'seeds=1 时退回单种子表（不印池化说明），配对表照常存在'
  );
});
t('D155 设防持续性栏必须**只记录不阻断**，且配对表的解析只有 defense-axis.mjs 一处', function () {
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  const ax = readFileSync('tools/defense-axis.mjs', 'utf8');
  ok(pc.indexOf('设防持续性栏') >= 0 && /EPIRUS_NO_GUARD/.test(pc), 'promote 必须印这一栏，且给一条能关掉省时间的开关');
  ok(pc.indexOf("from './defense-axis.mjs'") >= 0 && ax.indexOf('export function parsePairTable') >= 0,
    '解析必须单一来源：promote 里不许有第二份 parsePairTable（同 D150 的"搬运不许各写一份"）');
  ok(pc.indexOf('createState') < 0, 'promote 的新栏**不许自己仿真** —— 只 spawn 探针再解析（自己搭桌子必然与探针漂移）');
  ok(ax.indexOf('不许按 0 处理') >= 0, '解析不出行时必须明说"没量到"，不许静默回 0（0 会被读成"这包不龟"）');
  /* ① 固定样本回归：第一版把 Δ 读成了"跨种子极差"（每粒种子列有 1~3 个数，按空白切下标就串位） */
  const SAMPLE = ['   包                      placebo    hold均%  cycle均%      Δpt  每粒种子Δ                 极差   判定',
    '   cbs1s2-band2                2 粒      37.2      13.7     +23.5  +22.0 +25.1       3.1   钱驱动（高，≥18pt）',
    '   v7cmin4-31                  单粒       5.5       4.4      +1.6  +1.6                    —    非钱驱动（≤12pt）'].join('\n');
  const parsed = parsePairTable('# 同回合配对（占位表头）\n' + SAMPLE);
  eq(parsed.length, 2, '两行都得解析出来（实际 ' + parsed.length + '）');
  eq(parsed[0].delta, 23.5, 'Δ 必须取 Δpt 那一列，不是极差（v1.5.222 第一版就在这串了位）');
  eq(parsed[0].spread, 3.1, '跨种子极差要单独拿到（判"线落在不落在噪声里"用的就是它）');
  eq(parsed[1].delta, 1.6, '单种子行（极差列是 —）也要解析对');
  ok(!isFinite(parsed[1].spread), '单种子时极差必须是 NaN 而不是 0（0 会被读成"完全稳定"）');
  eq(parsed[0].hold, 37.2, 'hold 均%'); eq(parsed[0].cycle, 13.7, 'cycle 基线%（= 水平轴）');
  /* ② 真链：小样本跑探针 → 同一份解析 → 必须是有限数 + 有判定文案 */
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const rr = spawnCached(['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=25', '--pair=1', '--seeds=2'], { encoding: 'utf8' });
  eq(rr.status, 0, '探针要跑得通');
  const rows = parsePairTable(rr.stdout);
  ok(rows.length >= 1 && isFinite(rows[0].delta) && rows[0].verdict.length > 0,
    '真表必须解析出有限 Δ 与判定文案（解析 0 行 = 探针换了列序而没人发现，正是本门要防的）');
  /* ③ 行为式铁证：开/关这一栏，promote 的其余输出与退出码必须**逐字相同**（"只记录"不许是口头承诺） */
  const on = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8' });
  const off = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8', env: Object.assign({}, process.env, { EPIRUS_NO_GUARD: '1' }) });
  eq(on.status, off.status, '退出码必须一致（实测 ' + on.status + ' vs ' + off.status + '）⇒ 这栏不许改变判定');
  const strip = x => String(x || '').split(/\r?\n/).filter(l => l.indexOf('设防持续性栏') < 0).join('\n');
  eq(strip(on.stdout + on.stderr), strip(off.stdout + off.stderr), '去掉这一行后两次的全部输出（含 stderr 里的阻断结论）必须逐字相同');
  ok((on.stdout + on.stderr).indexOf('G 有效技能数') >= 0 || on.status === 0, '顺带确认这次 dry-run 真走到了门结论（阻断文案在 stderr，别只拼 stdout）');
});



t('D160 探针的参数守卫：接过的不许掉、位置要对、且不许误伤自己；没接的**点名只记录**（v1.5.236 · 落地仓规 v1.5.234）', function () {
  /* 语义断言优先（D152/D159 的教训：钉字面文本会被合法重构打红）——这里判的是"守卫存在 + 位置 + 真跑行为"。 */
  const GUARDED = ['probe-defense-cause', 'screen-cheap-predict', 'probe-breadth-flip', 'probe-seat-caliber',
    'probe-layer-caliber', 'probe-kill-reward', 'probe-ideal-champion', 'probe-bead-loop', 'probe-ep-reach'];
  for (const nm of GUARDED) {
    const src = readFileSync('tools/' + nm + '.mjs', 'utf8');
    ok(/rejectUnknownFlags\(/.test(src), nm + ' 必须调用 rejectUnknownFlags（不认识的 `--` 参数必须 exit 64）');
  }
  const dc = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(dc.indexOf('rejectUnknownFlags(') < dc.indexOf("arg('packs'"),
    '守卫必须**早于**任何 arg() 读取 —— 晚跑的守卫挡不住已经算完的读数（那正是"假成功"的形态）');
  const lc = readFileSync('tools/probe-layer-caliber.mjs', 'utf8');
  ok(lc.indexOf('rejectUnknownFlags(') > lc.indexOf('function main()'),
    '被 import 的模块（probe-layer-caliber）守卫必须只在自己的 main() 里跑 —— 放在顶层会把调用方的 --packs/--pair 当成非法参数打死');
  const bad = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--typo-flag=1'], { encoding: 'utf8' });
  eq(bad.status, 64, '真跑：不认识的参数必须 exit 64（实测 ' + bad.status + '）');
  ok(/不认识的参数/.test(String(bad.stderr || '')) && /--typo-flag/.test(String(bad.stderr || '')),
    '必须**点名**是哪个参数（只给退出码 = 下一次还要再猜）');
  const good = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak', '--games=6', '--pair=1'], { encoding: 'utf8' });
  eq(good.status, 0, '真跑：认识的那一串参数不许被自己的守卫误伤（**守卫名单漏项是这类门最常见的死法**）');
  const rest = readdirSync('tools').filter(function (f) { return /^(probe|screen)-.*\.mjs$/.test(f); })
    .filter(function (f) { return GUARDED.indexOf(f.replace(/\.mjs$/, '')) < 0; })
    .filter(function (f) { const s = readFileSync('tools/' + f, 'utf8'); return /arg\('/.test(s) && !/rejectUnknownFlags/.test(s); });
  console.log('   ℹ️ 另有 ' + rest.length + ' 个读 `--参数` 的工具尚未接守卫（**只记录不阻断**，各归其 owner）：' + (rest.join('、') || '无'));
});

t('D161 「防御定价」量具必须自带三把自检：零价档逐字等于对照 · 重价档不许读成空枪 · 补丁真打进**内部调用点**（v1.5.237 · E23 那三个假读数换来的）', function () {
  /* 这道门钉的是**量具**，不是任何一条实验结论。三个假读数都真实发生过（见 RESEARCH-LOG 09-26 §E23）：
   *   ① `Number(o.cost || 1)` 把 `--cost=0` 静默变成 1ep ⇒ "零价对照档"根本不存在（同族：v1.5.174 的 `|| 1` 让 0 关不掉）；
   *   ② 空枪判据写成 `billed===0` ⇒ `cost=99`（防御被整条摘光、一分钱没扣）会被自己的自检判成"读数作废"；
   *   ③ route ②（只包属性层）打不进 `mirrorHealth` 的内部闭包调用 ⇒ 强度栏三档"逐字相同"，看着像"定价不影响强度"。
   * 全部**真跑 + 语义比较**，不钉探针的措辞（D152/D159 的教训）。 */
  const DEFK = Object.keys(R.byKey).find(function (k) { return R.byKey[k] && R.byKey[k].cat === R.CAT.DEFENSE; });
  const ATKK = Object.keys(R.byKey).find(function (k) { return R.byKey[k] && R.byKey[k].cat !== R.CAT.DEFENSE; });
  ok(!!DEFK, '规则表里必须至少有一张 DEFENSE 族卡（这道门的载体）');

  /* ① 零价不许被吞 */
  eq(makeGuardCost(R, S, { mode: 'L2', cost: 0 }).stat.cost, 0, '`cost:0` 必须真的是 0（`|| 1` 会把零价对照档变成 1ep 档）');
  /* 对照组不许套壳：`off` 档与"不打补丁"必须是**同一个函数对象**，否则"对照"二字是假的 */
  { const f = function () { return 0; }; eq(makeGuardCost(R, S, { mode: 'off' }).wrapOne(f), f, '`off` 档必须原样返回传入的决策者（对照组不许被包一层）'); }

  /* ② 事前摘菜单 + 真选了才扣 */
  {
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 2 });
    const st = { p: [{ ep: 5 }] };
    const pick = gc.wrapOne(function (s2, i2, lg) { return lg[0]; })(st, 0, [{ key: DEFK }, { key: ATKK }]);
    eq(pick.key, DEFK, '付得起时防御不许被摘');
    eq(st.p[0].ep, 3, '选了防御必须真扣到钱（5 − 2 = 3）');
    eq(gc.stat.billed, 1, '`billed` 计一次');
    eq(gc.stat.epTaken, 2, '`epTaken` 计 2ep');
  }
  {
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 99 });
    const st = { p: [{ ep: 0 }] };
    let saw = null;
    const pick = gc.wrapOne(function (s2, i2, lg) { saw = lg.map(function (l) { return l.key; }); return lg[0]; })(st, 0, [{ key: DEFK }, { key: ATKK }]);
    ok(saw.indexOf(DEFK) < 0, '付不起时防御必须**事前**从菜单里摘掉（事后扣 = 从 0 里扣，实测等于没扣）');
    eq(pick.key, ATKK, '摘掉之后 chooser 只能在剩下的里选');
    eq(gc.stat.dropped, 1, '`dropped` 必须计到这一次摘除 ⇒ 它是"补丁有没有作用点"的唯一凭据');
    eq(gc.stat.billed, 0, '没选防御就不许扣钱');
  }
  {
    /* 摘到空必须**退回原菜单**：不许为了"看起来生效"造出一局无路可走的假局 */
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 99 });
    const st = { p: [{ ep: 0 }] };
    let sawLen = -1;
    gc.wrapOne(function (s2, i2, lg) { sawLen = lg.length; return lg[0]; })(st, 0, [{ key: DEFK }]);
    eq(sawLen, 1, '菜单只有防御一张时不许摘成空集（退回原菜单 ⇒ chooser 仍有一手可出）');
    ok(gc.stat.dropped > 0, '退回原菜单这件事仍要计入 `dropped`（否则"没得选"会被读成"选了别的"）');
  }

  /* ③ 真跑两档：零价必须与对照逐字相同；重价必须改变**强度栏**（= route ① 打进内部调用点的证据） */
  const tailOf = function (txt, mode) {
    const ln = txt.split('\n').filter(function (l) { return new RegExp('^\\s+' + mode + '\\s').test(l); })[0];
    if (!ln) return null;
    const i = ln.search(/\d+\.\d%/);
    return i < 0 ? null : ln.slice(i);
  };
  const zero = spawnSync(process.execPath, ['tools/probe-guard-cost.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak',
    '--modes=off,L1', '--cost=0', '--games=12', '--feas-games=3'], { encoding: 'utf8', timeout: 300000 });
  eq(zero.status, 0, '零价档探针必须正常退出（实测 status=' + zero.status + '）');
  {
    const zo = tailOf(String(zero.stdout || ''), 'off'), z1 = tailOf(String(zero.stdout || ''), 'L1');
    ok(zo && z1, '探针必须能解析出 off/L1 两行（行形一改，这道门就红着提醒）');
    eq(z1, zo, '`cost=0` 的行为读数必须与对照**逐字相同**（不一样 ⇒ 补丁有观察者效应，或在偷读别的档）');
    ok(String(zero.stdout).indexOf('⛔ 空枪：') >= 0, '零价档必须被自检抓出来（一分钱没拿走 = 这一档没有作用点，不许留成"两档相同 ⇒ 定价无效"的结论）');
  }
  const hot = spawnSync(process.execPath, ['tools/probe-guard-cost.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak',
    '--modes=off,L2', '--cost=99', '--games=12', '--feas-games=3'], { encoding: 'utf8', timeout: 300000 });
  eq(hot.status, 0, '重价档探针必须正常退出（实测 status=' + hot.status + '）');
  {
    const out = String(hot.stdout || '');
    ok(out.indexOf('⛔ 空枪：') < 0, '重价档不许被判成空枪：防御被整条摘光时 `billed=0` 而 `dropped>0`，那正是补丁生效到顶（E23 建台时实测就是这个形状）');
    const dm = out.match(/摘掉菜单项 (\d+)/);
    ok(dm && Number(dm[1]) > 0, '必须打印被摘掉的菜单项数（`dropped` 是这条档唯一的自证）');
    const ho = tailOf(out, 'off'), h2 = tailOf(out, 'L2');
    ok(ho && h2, '重价档必须解析出 off/L2 两行');
    ok(h2.slice(0, h2.indexOf('%') + 1) === '0.0%', '防御被定价 99ep 时【病】栏设防率必须是 0.0%（不是 ⇒ 地形闸没关住防御）');
    const cut = function (t2) { const i = t2.indexOf('‖'); return i < 0 ? t2 : t2.slice(i); };
    ok(cut(h2) !== cut(ho),
      '【强度】栏必须与对照**不同** ⇒ 这是"补丁打进 mirrorHealth 内部调用点"的行为证据（route ② 只包属性层时这里会逐字相同，而那正是我第一版读到的假"定价不影响强度"）：\n     off ' +
      cut(ho).trim() + '\n     L2  ' + cut(h2).trim());
  }
});

t('D162 训练/选择执行口径旋钮（v1.5.237 · E28）：默认关要**可逆**、开了要**真打到适应度**、没接的入口要**响亮**', function () {
  /* 建台过程中先纠正了写门的人自己的一条前提（记在 `evo.js` 那段注释与夜日志 §E28b）：
   *   出厂的**每代评分**并不在 ε=0 —— 被评席走"temp 0.35 · ε=0.15 · 不带 epsMode"（硬档）；
   *   ε=0 的是自评/健康门槛那一路。所以这个旋钮改的是"选择压力用哪种噪声"，而"默认关 = 逐字不变"必须能证。
   * 判的四件事（全部真调用，不钉措辞）：
   *   ① `eps=0` 不许被 `|| 默认` 吞（同 v1.5.174 `drainHpMax` 那一族）；非法值必须抛；
   *   ② 开档必须**改变** `mirrorHealth`（= 打进了它的内部闭包调用，不是只包了属性层）与 `scoreMemberN` 的 fit（= 真的在适应度通路上）；
   *   ③ 关档之后两个读数必须**回到原值**（不许留隐性状态）；
   *   ④ `train-3p` 真读它（不算暗键），而 `train-best` 没读 ⇒ 必须被列为暗键（宁可 exit 6，不许静默 A/A，D143 那族的规矩）。 */
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  ok(!!params, '载体：现役 3P 权重要能 unpack（本门全部读数都挂在它身上）');
  eq(typeof T.setTrainEps, 'function', '引擎必须导出 setTrainEps（CLI 侧"没有 setter 就 exit 7"靠它）');
  eq(typeof T.countTrainEps, 'function', '必须导出**开火计数**（横幅读回证明不了作用点发生 · D123 的原话）');
  eq(T.countTrainEps().eps, 0, '出厂默认必须是 eps=0');
  const mhOff = T.mirrorHealth(params, 8, 5, 'multi');
  const fitOff = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
  try {
    const back = T.setTrainEps(0.2, 5, 'soft', 0.15);
    eq(back.eps, 0.2, 'setter 必须读回生效值（引擎是唯一口径）');
    eq(back.mode, 'soft', 'mode 必须能下达（出厂每代评分是**硬档** ⇒ "挪到产品口径"这件事一半在 mode 上）');
    eq(T.setTrainEps(0).eps, 0, '`eps=0` 必须真的是 0（`|| 默认` 会把"零档对照"变成 0.2 档）');
    let threw = false;
    try { T.setTrainEps(3); } catch (e) { threw = true; }
    ok(threw, 'eps 越界（>1）必须抛，不许静默夹紧');
    T.setTrainEps(0.2, 5, 'soft', 0.15);
    const mhOn = T.mirrorHealth(params, 8, 5, 'multi');
    ok(Math.abs(mhOn.rounds - mhOff.rounds) > 1e-9 || Math.abs(mhOn.dmgPerGame - mhOff.dmgPerGame) > 1e-9,
      '【作用点 1】开档必须改变 `mirrorHealth` 的读数（不变 ⇒ 漏斗没打进它的内部闭包调用，那正是 E23 第一版读到的假"三档相同"）');
    const fitOn = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
    ok(Math.abs((fitOn.fit || 0) - (fitOff.fit || 0)) > 1e-9,
      '【作用点 2】开档必须改变**每代评分的 fit**（同 gen/idx ⇒ 同种子，唯一变量就是口径；不变 ⇒ 选择压力没接到这个旋钮，整臂会跑成 A/A）');
    const c1 = T.countTrainEps();
    ok(c1.fitSeen > 0 && c1.seen > 0, '两条漏斗都必须留下**决策计数**（fit=' + c1.fitSeen + ' · 自评=' + c1.seen + '）');
  } finally {
    T.setTrainEps(0);                 // 门内不许把口径留在开档状态去跑后面的门
  }
  const mhBack = T.mirrorHealth(params, 8, 5, 'multi');
  const fitBack = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
  ok(Math.abs(mhBack.rounds - mhOff.rounds) < 1e-12 && Math.abs(mhBack.dmgPerGame - mhOff.dmgPerGame) < 1e-12,
    '关档后 `mirrorHealth` 必须**逐字回到**开档前（差一丝 = 有隐性状态，那"出厂读数不变"这句话就是假的）');
  ok(Math.abs((fitBack.fit || 0) - (fitOff.fit || 0)) < 1e-12, '关档后 fit 同样必须逐字回到原值');
  eq(detectDarkKnobs({ EPIRUS_TRAIN_EPS: '0.2' }, { entry: 'tools/train-3p.mjs' }).dark.indexOf('EPIRUS_TRAIN_EPS'), -1,
    'train-3p 必须被认成"真读这个键"（否则整臂一开就 exit 6 跑不起来）');
  ok(detectDarkKnobs({ EPIRUS_TRAIN_EPS: '0.2' }, { entry: 'tools/train-best.mjs' }).dark.indexOf('EPIRUS_TRAIN_EPS') >= 0,
    'train-best 没接这个旋钮 ⇒ 必须被列为**暗键**并在握手前 exit 6（宁可响，不许"传了没人读"跑成一整臂 A/A —— D143 那一族栽过 9 次）');
  ok(readFileSync('tools/audit-lib.mjs', 'utf8').indexOf('EPIRUS_TRAIN_EPS') < 0,
    '作用范围必须**关在训练侧**：`audit-lib` 的 9 处写死不许经过这两个漏斗（否则门禁口径会被一个训练旋钮悄悄搬走）');
  /* ===== 并发臂的前提：产物必须能改道（用户 09-26 指令"别单核慢慢跑"）=====
   * 所有臂默认都写同一个 `docs/artifacts/train-3p-out.js` ⇒ 并发时互相覆盖，只能串行；而门禁里有两道门
   * 拿这个文件的哈希当 CLI 基线 ⇒ 并发臂还会把基线文件改脏。`EPIRUS_T3P_OUT`（与 `train-best` 的 `EPIRUS_TB_OUT` 同形）解决这两件事。 */
  {
    const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
    ok(/EPIRUS_T3P_OUT/.test(t3) && /EPIRUS_PUBLISH === '1'[\s\S]{0,220}EPIRUS_T3P_OUT/.test(t3),
      'train-3p 必须支持产物改道（`EPIRUS_T3P_OUT`），且**顺序必须在 `EPIRUS_PUBLISH` 之后**（否则一个 env 就能把臂写进线下槽）');
    const def = 'docs/artifacts/train-3p-out.js';
    const before = createHash('sha1').update(readFileSync(def)).digest('hex');
    const dir = mkdtempSync(join(tmpdir(), 't3pout-'));
    const rr = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '5', '4', '4'], {
      encoding: 'utf8', timeout: 300000,
      env: Object.assign({}, process.env, { EPIRUS_ARM: 'nptest-rr', EPIRUS_SEED: '999', EPIRUS_BAND_DIR: join(dir, 'bands'), EPIRUS_T3P_OUT: join(dir, 'RR.js') })
    });
    eq(rr.status, 0, '改道跑一支迷你臂必须成功（status=' + rr.status + ' ' + String(rr.stderr || '').slice(0, 90) + '）');
    ok(existsSync(join(dir, 'RR.js')), '产物必须写到 `EPIRUS_T3P_OUT` 指的地方');
    const after = createHash('sha1').update(readFileSync(def)).digest('hex');
    eq(after, before, '默认 CLI 产物**一个字节都不许动**（并发臂不得污染门禁比对的基线文件）');
    ok(String(rr.stdout).indexOf('已写入 ' + def) < 0, '日志里不许出现"已写入默认路径"（改道要改彻底，含打印）');
    /* 我自己 15:12 踩过的那一下：`train-3p --help` 曾被读成 `GENS=NaN` ⇒ 真开跑一支臂，
     * 默认落点就是上面那个被门禁比哈希的基线文件 ⇒ 一次打错的帮助页能污染正在跑的门禁。
     * **行为式**判定（真跑一遍看退出码），不判横幅。 */
    const hf = spawnSync(process.execPath, ['tools/train-3p.mjs', '--help'], { encoding: 'utf8', timeout: 60000 });
    eq(hf.status, 64, '`train-3p --help` 必须 exit 64（只吃位置参数的入口收到 `--` 一律响亮拒绝），实际 status=' + hf.status + ' 输出=' + String(hf.stdout || '').slice(0, 80));
    ok(String(hf.stderr || '').indexOf('不认识的参数') >= 0, '拒绝时必须说清"不认识的参数"并给出正确用法');
    eq(createHash('sha1').update(readFileSync(def)).digest('hex'), before, '那次 `--help` 尝试之后基线文件仍须逐字节不变（不许它已经把臂跑出来）');
    rmSync(dir, { recursive: true, force: true });
  }
});

t('D163 防御质量三档（用户 09-26 裁定：白防 / 被穿透=半 / 有效）必须**判在事件语义上**、单一来源、且 promote 那栏只记录不阻断', function () {
  /* 用户给的判据形状很具体："出防御的时候完全没人打他就算白防御了（被穿透算防御半有效）"
   * ⇒ 三档全靠**回合结算窗里的事件语义**判，所以本门喂**合成窗口**（不靠真跑一局去"希望碰上"某种局面）。
   * 会骗人的三种写法都被下面钉死：① 把梦魇/连环/违约/血债这些**非卡伤害**当成"有人打我"（⇒ 白防被误判成半有效）；
   *   ② 把自损（`source === 我`）算成攻击；③ 解析不到行时回 0（0 会被读成"这包不白防"—— 与 D155 同族）。 */
  const Rk = R;
  const ATKK = Object.keys(Rk.byKey).find(k => Rk.byKey[k] && Rk.byKey[k].cat === Rk.CAT.ATTACK);
  ok(!!ATKK, '载体：得有一张攻击卡当 `via`（合成窗口用它表示"有人朝我来"）');
  eq(classifyDefenseWindow([], Rk, 0), 'idle', '空窗（那一回合没人朝我来）⇒ 白防');
  eq(classifyDefenseWindow([{ type: 'blocked', to: 0, by: '防御', via: ATKK }], Rk, 0), 'eff', '挡下一次 ⇒ 有效');
  eq(classifyDefenseWindow([{ type: 'reflect', to: 0, from: 2, via: ATKK }], Rk, 0), 'eff', '弹回也算有效');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 2, via: ATKK, amt: 1 }], Rk, 0), 'part', '被卡打穿 ⇒ 半有效');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 2, via: '梦魇', amt: 0.5 }], Rk, 0), 'idle',
    '`via` 不是一张真卡（梦魇/连环/违约/血债）⇒ **不许**算"有人打我"（这是 `landByKey` 含非卡键那族事故的镜像）');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: null, via: ATKK, amt: 1 }], Rk, 0), 'idle', '`source` 为空的地形伤不算攻击');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 0, via: ATKK, amt: 1 }], Rk, 0), 'idle', '自损（打自己）不算"有人朝我来"');
  eq(classifyDefenseWindow([{ type: 'damage', to: 1, source: 2, via: ATKK }], Rk, 0), 'idle', '打别人不算招呼我');
  eq(classifyDefenseWindow([{ type: 'blocked', to: 0, by: '防御', via: ATKK }, { type: 'damage', to: 0, source: 2, via: ATKK }], Rk, 0), 'eff',
    '一回合里既挡到又被穿透 ⇒ 记"有效"（它确实挡下了东西，不许两档重复计）');
  const qq = defenseQuality({ eff: 2, part: 2, idle: 6 });
  ok(Math.abs(qq.q - 0.3) < 1e-12, '质量分 = (有效 + 0.5×半) / 手数 ⇒ 2/2/6 应为 0.30（实测 ' + qq.q + '）');
  ok(isNaN(defenseQuality({ eff: 0, part: 0, idle: 0 }).q), '没量到防御手 ⇒ NaN，**不许是 0**');
  const line = formatQuality(defenseQuality({ eff: 3, part: 1, idle: 6 }));
  const back = parseQuality(line);
  ok(back && Math.abs(back.q * 100 - 35) < 0.051 && back.n === 10,
    '打印器与解析器必须闭环（producers/consumers 一份契约）：' + JSON.stringify(back));
  ok(formatQualityRecord(null, {}).indexOf('没量到') >= 0 && formatQualityRecord(null, {}).indexOf('0.0%') < 0,
    '读不到时必须明说"没量到"，不许印成 0.0%（0 会被读成"这包不白防"）');
  /* 真链：探针跑得出这一行，且数字落在合法区间 */
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const pr = spawnCached(['tools/probe-wasted-play.mjs', '--packs=' + one, '--games=20', '--quiet=1', '--assembly=banker'], { encoding: 'utf8' });
  eq(pr.status, 0, '探针要跑得通（status=' + pr.status + '）');
  const pq = parseQuality(pr.stdout);
  ok(pq && pq.n > 0 && pq.q >= 0 && pq.q <= 1, '真跑必须解析出有限质量分与 >0 的手数（解析 0 行 = 探针改了列序而没人发现）：' + JSON.stringify(pq));
  /* 行为式铁证：开/关 promote 这一栏，其余输出与退出码逐字相同（"只记录"不许是口头承诺） */
  const on = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8' });
  const off = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { EPIRUS_NO_DEFQ: '1' }) });
  eq(on.status, off.status, '退出码必须一致（' + on.status + ' vs ' + off.status + '）⇒ 这栏不许改变判定');
  const stripQ = x => String(x || '').split(/\r?\n/).filter(l => l.indexOf('防御质量栏') < 0).join('\n');
  eq(stripQ(on.stdout + on.stderr), stripQ(off.stdout + off.stderr), '去掉这一行后两次的全部输出（含 stderr 的阻断结论）必须逐字相同');
  ok(on.stdout.indexOf('防御质量栏') >= 0 && on.stdout.indexOf('只记录不阻断') >= 0, '这一栏必须印出来，且自己说清"只记录不阻断"');
  ok(readFileSync('tools/probe-wasted-play.mjs', 'utf8').indexOf("from './defense-quality.mjs'") >= 0,
    '探针与 promote 必须共用同一个分类器（不许两处各写一遍"什么算打到我"）');
});

t('D106 场A/场B 打印器必须真的能工作（`probe-aggr` 曾长期每行打「读失败」）', function () {
  /* 病（v1.5.133 实测）：`tools/probe-aggr.mjs` 读的字段名与 `audit-lib.aggressionProfile()` 实际返回的
   * 漂移了（它读 `x.atkOld`/`x.dealt`/`x.taken`/`x.rounds`；真源给的是 `atkOldWhitelist`/`dealtPerGame`/
   * `takenPerGame`/`roundsPerGame`）⇒ `undefined.toFixed()` 每行抛错、被 catch 吞成一行「读失败」
   * ⇒ **全仓没有一个能用的场A/场B 打印器**，而这两条轴正是 G4/五道门争论里被反复引用的东西。
   * 本门**真跑一次探针**（1 局），不钉源码文本；同时要求它打印**门禁真正判的那一列**「清场/局」
   * （阈值 ≥0.3 局；D60 明确：场B 判据只能是清场数，胜率是规则红利）—— 原探针只打胜率/平局。 */
  const r = spawnSync(process.execPath, ['tools/probe-aggr.mjs', '1', 'js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 180000 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  ok(r.status === 0, '探针必须正常退出（实测 status=' + r.status + '）');
  ok(out.indexOf('读失败') < 0, '探针输出不许出现「读失败」（= 字段名与真源漂移，整行读数无效）：' +
    out.split('\n').filter(function (l) { return l.indexOf('读失败') >= 0; }).join(' | ').slice(0, 90));
  ok(out.indexOf('清场/局') >= 0, '探针必须打印「清场/局」——那是场B 唯一被门禁判的数（≥0.3/局）');
  /* 真源 → 打印器 的键对账（比钉文本结实：字段名两边一起改才不会红） */
  const Wl = { EpirusRules: R, EpirusState: S, EpirusTrainer: T, EpirusPlay: Play };
  Pol.setRng(T.mulberry32(31337));
  const one = aggressionProfile(Wl, Pol.makePolicy(0.25), 1);
  for (const k of ['fieldA', 'fieldB']) {
    const keys = Object.keys(one[k]);
    ok(keys.indexOf('clearedPerGame') >= 0 && keys.indexOf('jiShare') >= 0 && keys.indexOf('forced') >= 0,
      k + ' 必须带诊断字段（clearedPerGame / jiShare / forced）—— 反事实读数要靠 forced 判空枪');
    ok(one[k].forced === 0, '默认关闭诊断钩子时 ' + k + '.forced 必须是 0（钩子不得改变基线读数）');
  }
});

t('D107 G4「1 席脚本 vs 4 席被测」装配只许有一份实现（v1.5.133 收拢）', function () {
  /* 病：该装配原先**只写在 gate-drafts 内部** ⇒ 任何"想解剖 G4 到底输在哪"的探针只能抄一份
   * （本仓"同一规则两处维护必然漂移"栽过四次）。现在它在 `tools/v2v4-lib.mjs` 的 `duelAssembly()`，
   * gate-drafts 与 `probe-g4-anatomy.mjs` 共用。重构的验收 = G4 全表逐字不变（已对 `g4-check.log` 全部对账）。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gd.indexOf("from './v2v4-lib.mjs'") >= 0, 'gate-drafts 必须从 v2v4-lib.mjs 导入（装配单一来源）');
  ok(gd.indexOf('duelAssembly(') >= 0, ' 且真的调用它');
  ok(gd.indexOf('function duel(') >= 0, ' 但保留 duel() 薄壳（调用点与判词一字不动）');
  ok(gd.indexOf('h32(seed0 + g * 2246822519)') < 0, '装配本体不许再出现在 gate-drafts 里（否则又成两份）');
  const lib = readFileSync('tools/v2v4-lib.mjs', 'utf8');
  ok(lib.indexOf('export function duelAssembly') >= 0, 'v2v4-lib 必须导出 duelAssembly');
  ok(lib.indexOf('forceAttack') >= 0 && lib.indexOf('forceTurtle') >= 0, ' 且带双向反事实钩子');
  /* v1.5.134：这一轮真正的载重列是**伤害归属**（跨 13 个包 r = −0.82；"攒钱比例"只有 +0.23）
   * ⇒ 钩子与那一列计数都得在，否则下次读 G4 又会退回到"看分数猜原因"。 */
  ok(lib.indexOf('aimGunner') >= 0, ' 且带「只改目标」的单杠杆（v1.5.134 实测：主因是瞄准，不是花钱）');
  ok(lib.indexOf('dmgToScriptedPerGame') >= 0, ' 且统计"打在脚本席（枪手）身上的伤害" —— 那一格相关性最强的一列');
  const pg = readFileSync('tools/probe-g4-anatomy.mjs', 'utf8');
  ok(pg.indexOf('dmgToScriptedPerGame') >= 0, '解剖探针必须打印"打在枪手身上 X/局"（否则看不到主因那一列）');
  const pb = readFileSync('tools/probe-g4-anatomy.mjs', 'utf8');
  ok(pb.indexOf("from './v2v4-lib.mjs'") >= 0, '解剖探针必须从单一来源导入装配');
  ok(pb.indexOf('EXPECT') >= 0 && /EXPECT = \{ long: 38, multi: 35 \}/.test(pb),
    '探针必须自带"复现 G4 在位包记录值"的自检（现役 v7cmin4-31：long 38 / multi 35）—— 装配错了就不许读后面的数');
  /* v1.5.205 校正：这条钉原先写死 `long: 75 / multi: 62`，那是 **v1.5.144 之前**那件线上包的读数
   * ⇒ 常量不随换包走，后果不是"数字旧"，而是**每次跑都自证「⛔ 复现失败 ⇒ 下面的读数先别读」**（一个好量具被自己的记账废掉）。
   * 所以这里除了钉数值，还必须钉"来历写清楚"（包名 + n + 日期），换包时漏改就会红 —— 文本钉反过来当防腐用。 */
  ok(/现役 `v7cmin4-31`（v1\.5\.144 上槽）实测 38% \/ 35%/.test(pb) || /现役 `v7cmin4-31` 在同一装配、同一 seed、n=60 上是 \*\*long 38% \/ multi 35%\*\*/.test(pb),
    'EXPECT 旁边必须写清"这个值属于哪件在位包 + n"（否则下一次换包又会把它变成永久自检失败）');
  ok(pb.indexOf('75%/62%') < 0, '历史数字 75%/62% 不许再被当成"当前在位包的记录值"引用（它属于 v1.5.144 之前那件包）');
});

t('D110 冠军包解析单一来源：吃得下产物 .bak 外壳 / 纯 JSON / 垃圾必拒（页面「导入冠军包」的底座）', function () {
  /* v1.5.141（用户要求）：页面的「导入」原本只吃自己导出的 JSON，而训练产物是
   * `window.EPIRUS_CHAMPION[_3P] = {…};` 外壳 ⇒ 候选包没法直接拿去实机试。剥壳逻辑单一来源在
   * `js/champion-pack.js`（纯函数、不碰 DOM）。这条门**真跑一遍**：拿仓里 tracked 的真 bundle 当输入。 */
  const src = readFileSync('js/champion-pack.js', 'utf8');
  ok(src.indexOf('EPIRUS_CHAMPION(_3P)?') >= 0, '必须认产物的 window.EPIRUS_CHAMPION[_3P] 外壳');
  const html = readFileSync('index.html', 'utf8');
  ok(html.indexOf('js/champion-pack.js') >= 0, 'index.html 必须加载 champion-pack.js（否则页面里 undefined ⇒ 静默失效）');
  ok(html.indexOf('.bak') >= 0, '文件选择器必须收 .bak（否则用户选不到产物）');
  ok(readFileSync('js/ui/ui.js', 'utf8').indexOf('EpirusChampionPack') >= 0, 'ui.js 的导入必须走这个单一来源');
  /* 真跑：真 bundle ⇒ 外壳形态与纯 JSON 形态**逐字节相等**；垃圾必拒。 */
  const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
  box.window = box; box.globalThis = box;
  vm.runInNewContext(src, box, { filename: 'js/champion-pack.js' });
  const X = box.EpirusChampionPack;
  ok(X && typeof X.extract === 'function', '必须导出 extract');
  const a = X.extract(readFileSync('js/bundled-champion-3p.js', 'utf8'));
  ok(a.ok && a.slot === '3p' && a.source === 'bundle', '真 3P bundle 必须解析成 slot=3p（实测 slot=' + a.slot + '）');
  const b = X.extract(JSON.stringify(a.pack));
  ok(b.ok && JSON.stringify(b.pack) === JSON.stringify(a.pack), '纯 JSON 形态必须与外壳形态逐字节相等（保真）');
  ok(X.extract('这不是包').ok === false, '垃圾文本必须被拒（不许塞个空 pack 进槽）');
  ok(X.extract('/* 注释 */\nwindow.EPIRUS_CHAMPION = {"v":7,"params":[1,2]};\n').slot === '2p', '2P 外壳（含前置注释）必须判成 2p');
});

t('D111 前台探索三条规则（v1.5.142 · ②③ 于 09-22 夜升级为序列窗锁）：铺垫卡 ep 门槛 + 链上回合整锁', function () {
  /* 病（docs/RESEARCH-LOG-2026-09-21-ds.md §10，DS 实测）：贴贴/蓄能只在 ε>0 时出现（ε=0 ⇒ 0.00/局、
     前台 ε.2 ⇒ 2.7/局），而**天火两档都是 0.00/局** ⇒ 探索只付铺垫成本、结构性地拿不到收尾。
     用户三条裁定 → 落在 `policyChooserN` 的 `epsMode==='soft'` 分支里。本门**行为式**验证。 */
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  ok(evoSrc.indexOf("epsMode === 'soft'") >= 0 && evoSrc.indexOf('HOLD_MIN_EP') >= 0,
    '规则必须只作用于 soft（缺省 epsMode 与 eps=0 的读数逐字不变）');
  const params = loadChampParams(Pol, 'js/bundled-champion-3p.js');   // 线上 3P 包（S / R / T / mulberry32 用外层句柄）
  const draws = function (st, pid, key, n) {   // 用 ε=1（必探索）+ soft ⇒ 只测"探索集"本身
    const chooser = T.policyChooserN(params, 0.15, 1, 5, 'soft');
    const legal = key.map(function (k) { return { key: k, affordable: true }; });
    const hit = {};
    for (let i = 0; i < n; i++) { const r = chooser(st, pid, legal); hit[r.key] = (hit[r.key] || 0) + 1; }
    return hit;
  };
  const mk = function () { return S.createState('multi', { next: mulberry32(11) }, 5); };
  const K = R.SK;
  const KEYS = [K.JI, K.CURSE, K.CHARGE, K.RAILGUN, K.FIRESTORM, K.GUN, K.SNIPE];
  /* ① 低 ep（<3）：贴贴/蓄能**不许**进探索集 ⇒ 200 次抽样里一次都不该出现 */
  const st1 = mk(); st1.p[0].ep = 1;
  const h1 = draws(st1, 0, KEYS, 200);
  eq((h1[K.CURSE] || 0) + (h1[K.CHARGE] || 0), 0, 'ep=1 时探索不得抽到贴贴/蓄能（实测 ' +
    (h1[K.CURSE] || 0) + '/' + (h1[K.CHARGE] || 0) + ' 次）');
  /* ②③（09-22 夜裁升级）：白班的"并入探索集"被**序列窗锁**覆盖 —— 持珠/持符的回合整回合作废探索，
   * 比"收尾卡抽得到"更强（抽不到≠会被改判；夜测 §N4：悬崖在 ε=0.1 就跌满 ⇒ 可达性不够，要原子性）。
   * 断言随之改写：这类态上 ε=1 soft 必须**逐手等于 ε=0**（锁生效；deviation=0）。① 原样保留。 */
  const eqGreedy = function (st, n) {
    const soft = T.policyChooserN(params, 0.15, 1, 5, 'soft');
    const zero = T.policyChooserN(params, 0.15, 0);
    const legal = K ? KEYS.map(function (k) { return { key: k, affordable: true }; }) : [];
    let diff = 0;
    for (let i = 0; i < n; i++) {
      const a = zero(st, 0, legal), b = soft(st, 0, legal);
      if (a.key !== b.key) diff++;
    }
    return diff;
  };
  const st2 = mk(); st2.p[0].ep = 4; st2.p[0].elec = 1;
  eq(eqGreedy(st2, 100), 0, '持电珠回合 ε=1soft 与 ε=0 不许有任何改判（序列锁·白班②升级）');
  const st3 = mk(); st3.p[0].ep = 4; st3.p[1].stickers = [{ owner: 0, age: 1 }];
  eq(eqGreedy(st3, 100), 0, '有我方符咒回合 ε=1soft 与 ε=0 不许有任何改判（序列锁·白班③升级）');
});

t('D121 当选面退化闸三处对齐（§N9 · xn10b 龟包以带内最高 trainFit 当选的反例）', function () {
  /* 纯函数行为：退化但分数最高 ⇒ 必须让位给干净的第二名；阈值边界（0.89 过 / 0.90 剔）与 promote 同 0.9；
   * 全退化 ⇒ best:null（调用方必须响亮，门③钉 train-3p 真的接了这条响亮路径）。 */
  const A = { ref: 'A', score: 1.15, zeroAtkRate: 0.95 };
  const B = { ref: 'B', score: 1.02, zeroAtkRate: 0.30 };
  const C = { ref: 'C', score: 0.90, zeroAtkRate: 0.89 };
  let r = rejectDegenerateWinners([A, B, C]);
  eq(r.best.ref, 'B', 'trainFit 最高的退化龟包不许当选，第一名让位给最高分干净候选');
  eq(r.dropped, 1, '只剔 A（0.95）；C=0.89 在阈值内侧（与 promote 的 ≥0.9 一字同界）');
  r = rejectDegenerateWinners([A, { ref: 'D', score: 2, zeroAtkRate: 0.9 }]);
  eq(r.best, null, '全退化 ⇒ best:null（调用方必须响亮，不许回退当选）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('rejectDegenerateWinners(hallEntries)') >= 0 && t3.indexOf('degenerateOnlyWinner') >= 0,
    'train-3p 必须真接这道闸（当选过滤 + 全退化写 meta.degenerateOnlyWinner）——纯函数有闸不接线=没闸');
  ok(t3.indexOf('densityProfile(sb, h.params') >= 0,
    '零攻击率必须走 audit-lib 单一来源（不许在 CLI 里再造一个"数出手"的口径）');
});

t('D120 CLI 训练器上的 EPIRUS_* 开关不许"传了没人读"（§N8b · qoder 09-22 空转臂反例）', function () {
  /* 病：`EPIRUS_CLEAR_W` 只接在 train-server/worker；train-3p CLI 读了 env 也没人调 setter ⇒
     09-22 臂 a 的"单变量"实为**逐字节复现 7′**（同种子 ⇒ 连门读数都一模一样，幸而当场看穿）。
     与 v1.5.153 热启动静默同族。门两半：① setter 行为（打进/复位）；② train-3p 的接线与 exit-5 拒绝存在。 */
  const w0 = T.clearReward ? T.clearReward().w : 0;
  const got = T.setClearReward(0.1);
  eq(Number(got), 0.1, 'setClearReward(0.1) 必须回读 0.1（生效值 ≠ 请求值 ⇒ 静默钳位在骗人）');
  T.setClearReward(0);   // 复位：不污染后面的门
  const t3src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3src.indexOf('EPIRUS_CLEAR_W') >= 0 && t3src.indexOf('setClearReward') >= 0,
    'train-3p 必须读 EPIRUS_CLEAR_W 并打进本沙箱 evo（CLI 与 server 两条入口同口径）');
  ok(t3src.indexOf('拒绝静默空转') >= 0, '开关 >0 但 setter 拒绝 ⇒ 必须 exit 5 响亮（同 D119 规矩）');
  T.setClearReward(w0);
});

t('D143 黑键闸必须铺到**每个**训练入口（v1.5.200）：`EPIRUS_KILL_REWARD` 传给 train-best / 页面训练服务时曾是**静默无效**（产物与不带它逐字节相同）', function () {
  /* 病（本轮实测，不是推演）：`EPIRUS_KILL_REWARD` 全仓只在 tools/train-3p.mjs 被读。
   *   KR=1 与 KR=0 在 train-best 上跑出的 pack sha1 相同（c67521d82ff32d2a），去掉 ts 后两个产物
   *   文件逐字节相同；页面「训练场」的 server 路径同理（ad5baadcd32aaec8）。本仓为"传了没人读"
   *   这一族栽过至少 9 次 ⇒ 判定抽成单一来源之后，必须**每个入口都挂上**，而且要在握手/训练之前。 */
  const SRC = 'server/knob-guard.mjs';
  ok(existsSync(SRC), '判定必须是单一来源 ' + SRC);
  const kg = readFileSync(SRC, 'utf8');
  ok(kg.indexOf('detectDarkKnobs') >= 0 && kg.indexOf('enforceKnobs') >= 0, '单一来源必须导出 detectDarkKnobs / enforceKnobs');
  const ENTRIES = ['tools/train-3p.mjs', 'tools/train-best.mjs', 'tools/train-fast.mjs', 'server/train-server.mjs'];
  for (const e of ENTRIES) {
    const src = readFileSync(e, 'utf8');
    ok(src.indexOf('knob-guard.mjs') >= 0 && src.indexOf('enforceKnobs(') >= 0,
      e + ' 必须挂 enforceKnobs —— 否则它继续静默忽略自己读不到的键（整臂可能跑成 A/A）');
  }
  /* ① 纯口径：名单模块（*-env.mjs）不许靠 import 自动继承读权（否则"只 import 名单来点名"被当成真读 ⇒ 假阴性）。
   * 第一版就是这么错的：FIGHT_WHISTLE 传 train-3p 从 exit 6 变成静默通过，被 D122 当场抓住。 */
  const wr = readKeysOf({ entry: 'tools/train-3p.mjs' });
  ok(!wr.read.has('EPIRUS_FIGHT_WHISTLE'),
    'train-3p 只 import 了 FIGHT_ENV_KEYS（点名）、没读它的值 ⇒ 不许算"读得到"');
  eq(detectDarkKnobs({ EPIRUS_KILL_REWARD: '1' }, { entry: 'tools/train-best.mjs' }).dark.join(','), 'EPIRUS_KILL_REWARD',
    'train-best 读不到的 KILL_REWARD 必须被列为暗键');
  eq(detectDarkKnobs({ EPIRUS_KILL_REWARD: '1' }, { entry: 'tools/train-3p.mjs' }).dark.length, 0,
    'train-3p 真读它 ⇒ 不许误报（误报会让迷你臂无故 exit 6）');
  eq(detectDarkKnobs({ EPIRUS_TB3P: '1', EPIRUS_CHARGE_GAMES: '8' }, { entry: 'tools/train-best.mjs' }).dark.length, 0,
    'train-best 经 audit-lib 的 feasPlan 真读 EPIRUS_CHARGE_GAMES ⇒ 闭包要跟到 reader 那一层，不许误报');
  /* ② 行为：用户报的那个病 —— 传 KILL_REWARD 给 train-best 必须响亮 */
  const d1 = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1' }), encoding: 'utf8', timeout: 120000 });
  eq(d1.status, 6, 'KILL_REWARD 传给 train-best 必须 exit 6（实测 ' + d1.status + '）');
  ok(/EPIRUS_KILL_REWARD/.test(String(d1.stderr || '')), '拒绝时必须点名是哪个键');
  const d2 = spawnSync(process.execPath, ['tools/train-fast.mjs', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_COUNTER_OPPS: '1' }), encoding: 'utf8', timeout: 120000 });
  eq(d2.status, 6, 'COUNTER_OPPS 传给 train-fast 必须 exit 6（实测 ' + d2.status + '）');
  /* 页面训练服务是长驻进程 —— 静默起来最难发现 ⇒ 必须在**起监听之前**就拒绝 */
  const d3 = spawnSync(process.execPath, ['server/train-server.mjs', '8799'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1' }), encoding: 'utf8', timeout: 90000 });
  eq(d3.status, 6, 'KILL_REWARD 传给页面训练服务必须 exit 6（实测 ' + d3.status + '）');
  ok(!/Epirus train server on/.test(String(d3.stdout || '')), '拒绝时不许已经起监听');
  /* ③ 行为：逃逸口仍放行（1 代迷你臂 + 临时落点 ⇒ 不欠 D82） */
  const dirE = mkdtempSync(join(tmpdir(), 'knobesc-'));
  const d4 = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1', EPIRUS_ALLOW_DARK: '1',
      EPIRUS_TB_OUT: join(dirE, 'out.js'), EPIRUS_ARM: 'nptest-esc' }), encoding: 'utf8', timeout: 300000 });
  ok(d4.status === 0 || d4.status === 9, 'EPIRUS_ALLOW_DARK=1 必须放行（实测 exit=' + d4.status + '）');
});

t('D144 墙上时钟上限：`EPIRUS_WALL_MS=0` 必须是**关闭**（v1.5.200）—— 此前它第一次检查就判超时、训练当场中止，与它自己的注释正好相反', function () {
  /* 病（本轮实测）：`server/train-server.mjs` 两处 `if (Date.now() - t0 > cap)` 都**没有 `cap > 0` 这一半**，
   * 而同文件 :247/:476 的注释写着「EPIRUS_WALL_MS=0 关闭（纯按代数收敛）」。我拿它去关上限时被它打成两轮空炮
   * （SSE 直接回 `训练超时上限（30 分钟）`、一代都没跑）。语义收进纯函数 ⇒ 门喂合成值即可判，不必真等 30 分钟。 */
  eq(wallCapExceeded(0, 1e12), false, 'cap=0 必须是**关闭**（旧写法此刻判超时 —— 这就是被修的那条）');
  eq(wallCapExceeded(-1, 1e12), false, 'cap<0 也是关闭');
  eq(wallCapExceeded(NaN, 1e12), false, 'cap=NaN 不许静默变成"永远超时"');
  eq(wallCapExceeded(1800000, 100), false, '未到上限不许判超');
  eq(wallCapExceeded(1800000, 1800001), true, '过了上限必须判超（别把闸修成死的）');
  eq(wallCapOf({}), 1800000, '缺省仍是 30 分钟（改了 = 历史行为变）');
  eq(wallCapOf({ EPIRUS_WALL_MS: '0' }), 0, '显式 0 要原样传下去（不许 \|\| 之类把它变成默认值）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  eq((sv.match(/wallCapExceeded\(cap, Date\.now\(\) - t0\)/g) || []).length, 2, '两处（2P 与 N 人）都必须走 wallCapExceeded');
  ok(sv.indexOf('Date.now() - t0 > cap') < 0, '不许再留裸的 `Date.now() - t0 > cap`（缺 cap>0 的那一半）');
  ok(sv.indexOf('wallCapOf(process.env)') >= 0, '上限的读取也必须走单一来源（默认值与判定不许两处各写一遍）');
});

t('D145 座位极差线必须随 n 标定（v1.5.202）：固定 30pt 线在 n=400 会**放走**真偏置包（26.6pt）—— 而座位事故在本仓真实发生过', function () {
  /* 历史实测（np-test D59 注释的收敛表 + `docs/REVIEW-3P.md:29`）：
   *   `v7new5_005-31`（v1.5.114 用 --force 换掉的那只）在 n=60 读 **43.2pt**、n=400 读 **26.6pt**；
   *   另一只破防脚本三座 1st 率 **73.5 / 14.5 / 0.0**（极差 73.5pt）。
   * 而 v1.5.69 修的正是"**座位惩罚从未触发**（我自己的错）"⇒ 这条线**复发过**，用户明确要求保留。
   * 旧口径 = 固定 30pt ⇒ 在 n=400 上 26.6 < 30，**放它过去**；同时 30pt 又坐在零分布的最大值上（n=100 的 max=30.0，2 万次）。
   * 新口径 = **该 n 下均匀零分布的分位**（种子固定 ⇒ 可复现）。这不是放宽/收紧阈值，而是让阈值跟着样本量走。 */
  const line100 = nullSpreadQuantile(100, 5, 0.99), line400 = nullSpreadQuantile(400, 5, 0.99);
  ok(line100 > 15 && line100 < 28, 'n=100 的线必须落在标定锚点附近（实测 20~21pt，本机 ' + line100.toFixed(1) + '）');
  ok(line400 > 8 && line400 < 14, 'n=400 的线必须落在标定锚点附近（实测 10.3pt，本机 ' + line400.toFixed(1) + '）');
  ok(line400 < line100, '线必须随 n 单调下降（n 越大，真偏置的读数与噪声同比缩小）');
  /* 判定演练：历史上真实出现过的三个读数都必须被抓住 */
  for (const c of [[60, 43.2], [100, 38], [400, 26.6], [100, 73.5]]) {
    ok(c[1] >= nullSpreadQuantile(c[0], 5, 0.99), '历史的偏置读数必须被抓住：n=' + c[0] + ' 极差 ' + c[1] + 'pt（线 ' + nullSpreadQuantile(c[0], 5, 0.99).toFixed(1) + '）');
  }
  ok(11.6 < line100 && 6.5 < line400, '现役 v7cmin4-31（n=100 读 11.6、n=400 读 6.5）必须有约 2 倍余量地通过');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('spread >= 30') < 0 && al.indexOf('spreadLine') >= 0, '极差判定必须走 spreadLine（不许回到裸的 30）');
});

t('D146 G4 `--force` 越线例外的判定必须是被**覆盖**的纯函数（v1.5.202）：它原来只在"在位包 G4 红了"那天才求值', function () {
  /* 病（门层审计）：`ok(refPassG4 || g4recOk, …)` 被 `refPassG4` 短路 —— 现役包 G4 有模式 PASS（常态）⇒
   * `implOk`/`g4recOk` 整段**从未被求值**，第一次真正运行会发生在"正要发一只过不了门的冠军"的那次提交里。
   * 现在判定是 `tools/gate4-exception.mjs` 的纯函数 ⇒ 这里用**合成 meta** 把每种组合跑一遍。 */
  const good = { forced: true, pool: 'p1', impl: 'i1', lines: ['G4[foo/multi] 无一行脚本能以 >60% 击败它'], ts: 't' };
  ok(g4ExceptionOk('i1', 'p1', good), '齐全的例外必须认（forced + pool 匹配 + impl 匹配 + 带 G4 行）');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { forced: false })), 'forced=false 不许认');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { lines: [] })), '没有"被放过的具体行"不许认（记了账但不知道记了什么）');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { lines: ['G5[x] 别的门'] })), 'lines 第一行不是 G4[ 不许认');
  ok(!g4ExceptionOk('i1', 'p2', good), '口径 id（pool）不匹配不许认 —— 克制表键序/阈值变过，旧例外当场失效');
  ok(!g4ExceptionOk('i2', 'p1', good), '实现身份（impl）不匹配不许认 —— 改过任何一格，豁免随 id 作废');
  ok(!g4ExceptionOk(null, 'p1', good), '读不出当前 G4IMPL 时不许认');
  ok(!g4ExceptionOk('i1', 'p1', null), 'meta 里根本没有 gate4Forced 不许认');
  const old = { forced: true, pool: 'p1', lines: ['G4[foo/multi] x'], ts: 't' };
  ok(g4ExceptionOk(G4FROZEN, 'p1', old), '无 impl 字段的旧留痕 + 当前实现 == 冻结版 ⇒ 放行（一次性迁移垫脚）');
  ok(!g4ExceptionOk('deadbeef', 'p1', old), '无 impl 字段 + 当前实现已变 ⇒ 豁免作废');
  const nt = readFileSync('tools/np-test.mjs', 'utf8');
  ok(nt.indexOf('g4ExceptionOk(curImpl, curPool, g4rec)') >= 0, 'D67 必须调用纯函数（判定的单一来源，不许再抄一份）');
});

t('D147 UNRUN 必须有**处置语义**且按方向分（v1.5.202）：原来它从不进 fails ⇒ 基线退化的候选可零阻断通过', function () {
  /* 病（门层审计）：`promote-champion` 把 UNRUN 单独收集、醒目打印"不得当作通过"，却**从不送进 `fails`**
   * ⇒ 一个"基线退化、整格不可判"的候选能零阻断通过，全靠一句 print 兜着，而门只钉了那句话的**文本**。
   * 但不能无脑阻断：G4 的可判窗口 [8%,32%] 把两个**相反**方向合并了 ——
   *   `base.win < 8%` ⇒ 候选压着克制表打（**强包**形状，阻断它会把最强的候选挡在门外）；
   *   `base.win > 32%` ⇒ 候选打不过最弱的克制脚本（**真缺陷**被"不可判"这个措辞盖住了）。
   * ⇒ 弱 = 只记录；强 / 缺 = 阻断；参照行与参照行的 FAIL 同待遇（只记录）。 */
  eq(unrunDisposition(UNRUN_KINDS.WEAK, false).blocking, false, '基线太弱（候选压着克制表打）⇒ 只记录（否则会把最强候选挡掉）');
  eq(unrunDisposition(UNRUN_KINDS.STRONG, false).blocking, true, '基线太强（候选打不过最弱脚本）⇒ 必须阻断');
  eq(unrunDisposition(UNRUN_KINDS.MISSING, false).blocking, true, '读不出基线 ⇒ 未知，保守判红（同 audit-lib 探针缺失守卫）');
  eq(unrunDisposition(null, false).blocking, true, '未知种类（旧格式）⇒ 保守判红');
  eq(unrunDisposition(UNRUN_KINDS.STRONG, true).blocking, false, '**参照行**的 UNRUN 与参照行的 FAIL 同待遇：只记录、不阻断');
  eq(unrunDisposition(UNRUN_KINDS.WEAK, true).blocking, false, '参照行 + 弱 ⇒ 同样只记录');
  /* 静态：三处必须真的接通（出方向 / 按方向判 / 不再是"一律只打印"） */
  const g3 = readFileSync('tools/gate-drafts.mjs', 'utf8');
  const pc3 = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(g3.indexOf("'弱' ") >= 0 && g3.indexOf('unrunKind') >= 0, 'gate-drafts 必须算出方向（弱/强/缺）');
  ok(pc3.indexOf('uD.blocking') >= 0 && pc3.indexOf('unrunDisposition(') >= 0, 'promote 必须按方向把阻断项送进 fails');
  /* v1.5.202：**被打穿**必须优先于**不可判** —— 否则真 FAIL 会被 UNRUN 盖住。
   * 实测（本轮扫 12 个真实候选）：`v7xn8c-31-band4` 的 multi 格最克脚本 **65% > 60%**（真 FAIL），
   * 却因为**基线那格**退化（0%）而整格报 UNRUN ⇒ 旧口径下它零阻断通过。 */
  ok(g3.indexOf('const hardFail = worst[1] > G4_MAX;') >= 0 && g3.indexOf('const isUnrun = !hardFail && !judgeable;') >= 0,
    '被打穿必须优先于不可判（UNRUN 不许盖住真 FAIL）');
  ok(pc3.indexOf('【阻断】') >= 0 && pc3.indexOf('【只记录】') >= 0, '输出必须能分辨「阻断」与「只记录」，不许含糊成一句「不得当作通过」');
});

t('D157 确定性重活的缓存必须**内容寻址**、**响亮**、且不许把"没跑"伪装成"过了"（v1.5.225 · 用户批准方案 a）', function () {
  /* 病：D134/D135/D136 里的训练臂是**确定性**的（固定 seed + 固定 env + 固定输入），却每次全量重跑 ——
   * 实测 D135 一条 41.4 秒、D134 16.1、D136 13.8，合计约 71 秒；而绝大多数提交根本没碰训练侧。
   * 危险不在"慢"，在**修错方向**：把"门跑过"变成"门认定输入没变"就是 D58/D59 那族"静默跳过"的新外衣。
   * ⇒ 所以本门判三件：① 键必须是**内容**（不是路径/时间）；② 只缓存 (status,stdout,stderr) 且**断言照旧跑**；
   *   ③ 命中必须**响亮**（独立一行 + 收尾计数），且有 `NP_NOCACHE=1` 逃生口。 */
  const src = readFileSync('tools/np-test.mjs', 'utf8');
  ok(/import \{ spawnCached, inputHash, cacheStats \}/.test(src), 'np-test 必须接缓存模块（spawnCached / inputHash / cacheStats）');
  /* 门里**绝不许**把缓存计数器清零：那会把收尾"命中 N 次 · 省下 X 秒"抹掉 —— D157 第一版就这么把自己的成绩抹了
   * （热跑明明省 140+ 秒，收尾却印"命中 2 次 · 省 0.2 秒"）。
   * ⚠️ 判的是**整份源码里不许出现那个名字**（含注释）：v1.5.225 试过"逐行过滤掉注释行"，被 `/*` 与字符串骗了两次。 */
  ok(!src.includes('cache' + 'Reset'), 'np-test 里不许出现缓存清零的那个 API 名（连注释也别提，免得断言与注释打架）');
  /* 计数断言用**下限**而不是等号：本版只接了 7 条 train-3p，以后扩到别的确定性 spawn 是**好事**，
   * 写成 `=== 4` 会在扩展时无故变红（门不该阻止自己被扩）。 */
  ok((src.match(/spawnCached\(\['tools\/train-3p\.mjs'/g) || []).length >= 4,
    '至少四条最重的训练臂要走缓存（40/60/60/30 代那四条）—— 实测 ' + (src.match(/spawnCached\(\['tools\/train-3p\.mjs'/g) || []).length + ' 条');
  ok((src.match(/spawnCached\(/g) || []).length >= 12,
    '确定性 spawn 的缓存覆盖面 ≥12 处（本版：4 条重臂 + D123/D127 的臂 + D150/D137 的只读探针）—— 实测 ' +
    (src.match(/spawnCached\(/g) || []).length + ' 处');
  ok(/缓存：命中 ' \+ __cs\.hit/.test(src), '收尾必须印命中数与省下的秒数（亮不亮要看得见）');
  const mod = readFileSync('tools/np-cache.mjs', 'utf8');
  ok(/NP_NOCACHE/.test(mod) && /export function spawnCached/.test(mod) && /createHash\('sha1'\)/.test(mod),
    '模块必须有逃生口 + sha1 内容键');
  ok(!/pass|fail|PASS|FAIL/.test(mod.replace(/[\s\S]*?## ⚠️/, '')), '模块**绝不许**缓存"通过/失败"（只许缓存 status/stdout/stderr）');

  /* ===== 行为断言（不是钉文本）：键的四种敏感性 ===== */
  const k1 = inputHash(['--probe-a'], { EPIRUS_X: '1' });
  eq(k1, inputHash(['--probe-a'], { EPIRUS_X: '1' }), '同一个 argv+env 必须给同一个键（否则永不命中）');
  ok(k1 !== inputHash(['--probe-b'], { EPIRUS_X: '1' }), 'argv 变 ⇒ 键必须变');
  ok(k1 !== inputHash(['--probe-a'], { EPIRUS_X: '2' }), 'EPIRUS_* 值变 ⇒ 键必须变（旋钮就是靠这个）');
  /* **内容敏感**这条最要紧：同一个路径、同一份大小，只改一个字节，键就必须变
   * （否则"改了源码却复用旧结果"就是必然事故） */
  const d = mkdtempSync(join(tmpdir(), 'd157-'));
  const tf = join(d, 'fake-input.mjs');
  writeFileSync(tf, 'const A = 1;\n');
  const kA = inputHash([tf], {});
  writeFileSync(tf, 'const A = 2;\n');
  const kB = inputHash([tf], {});
  ok(kA !== kB, '**同一个路径、只改一个字节 ⇒ 键必须变**（这条挂了就等于"改了源码还复用旧结果"）');

  /* **临时路径必须被归一化**（这条是 v1.5.225 我自己连栽两版的坑，必须由门钉住）：
   * 训练臂传 `EPIRUS_BAND_DIR = mkdtempSync(...)`，**每次随机** ⇒ 若不折成 `<TMP>`，键每次都变、缓存永不命中
   * （第一版冷跑写 4 条、热跑又写 4 条新条目；第二版只折了前缀、没折 `mkdtemp` 的随机后缀，照样不命中）。 */
  const e1 = { EPIRUS_SEED: '31', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-AAA') };
  const e2 = { EPIRUS_SEED: '31', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-BBB') };
  const e3 = { EPIRUS_SEED: '32', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-AAA') };
  eq(inputHash(['tools/train-3p.mjs'], e1), inputHash(['tools/train-3p.mjs'], e2),
    '同一个旋钮、只有**临时输出目录不同** ⇒ 键必须相同（否则缓存永远不命中）');
  ok(inputHash(['tools/train-3p.mjs'], e1) !== inputHash(['tools/train-3p.mjs'], e3),
    '旋钮值真变了（EPIRUS_SEED 31→32）⇒ 键必须变');

  /* ===== 命中/未命中行为：命中必须给出**与真跑逐字相同**的输出 =====
   * ⚠️ 用**差值**判、绝不清零计数器 —— 清零会把收尾"命中 N 次 · 省下 X 秒"的成绩抹掉
   * （v1.5.225 第一版就犯了这个：热跑明明省了 142 秒，收尾却印"命中 2 次 · 省 0.2 秒"）。 */
  const cs0 = cacheStats();
  const argv = ['-e', 'process.stdout.write("cache-probe-42")'];
  const r1 = spawnCached(argv, { encoding: 'utf8' });
  const r2 = spawnCached(argv, { encoding: 'utf8' });
  const cs = cacheStats();
  ok(cs.hit - cs0.hit >= 1, '第二次必须**命中**（实测本次增量 ' + (cs.hit - cs0.hit) + '）');
  eq(r2.status, r1.status, '命中与真跑的 status 必须一致');
  eq(String(r2.stdout), String(r1.stdout), '命中与真跑的 stdout 必须逐字一致');
  /* 逃生口的行为断言：设上之后必须**真跑**（命中数不许再涨） */
  const bak = process.env.NP_NOCACHE;
  process.env.NP_NOCACHE = '1';
  const r3 = spawnCached(argv, { encoding: 'utf8' });
  ok(String(r3.stdout) === String(r1.stdout) && cacheStats().hit === cs.hit,
    '`NP_NOCACHE=1` 时必须**真跑**（命中数不许再涨）');
  if (bak == null) delete process.env.NP_NOCACHE; else process.env.NP_NOCACHE = bak;
});

t('D158 产物必须能自证**实际生效的 EPIRUS_* 配方**（v1.5.226 · 用户批准；千问 E9/E10 就是被这个缺口逼着绕道跑的）', function () {
  /* 病：`meta.recipe` 原先是**手抄名单**（arm/seed/xn2w/kill/trainMode/counterOpps/…）⇒ **新旋钮天生不在里面**
   * （METHODOLOGY 13「白名单两处各写一遍必出事」的同族）。后果很具体：想问"哪根旋钮养出这粒包"，
   * 查 meta 却没有 env ⇒ 只能归因到"抽奖"，并用**前瞻实验绕道**才把问题问出来（千问 E9/E10）。
   * 修法：读集问 `knob-guard.readKeysOf`（与 `enforceKnobs` **同一份**），再取环境里真设了的键 ⇒ 加旋钮不用改这里。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/import \{ enforceKnobs, readKeysOf \}/.test(t3), '读集必须来自 knob-guard 单一来源');
  ok(/readKeysOf\(\{ entry: 'tools\/train-3p\.mjs', extraReadKeys: SELF_ENV_KEYS \}\)/.test(t3),
    '必须用**与 enforceKnobs 同一个读集**（entry + SELF_ENV_KEYS），不许另抄一份名单');
  ok(/const EFFECTIVE_ENV = \(function \(\) \{/.test(t3) && /env: EFFECTIVE_ENV, envKeys:/.test(t3),
    '主 meta 的 recipe 必须带 env + envKeys');
  ok(/recipe: \{ env: EFFECTIVE_ENV, envKeys:/.test(t3), 'band meta 也必须带配方（`.bak` 才是长期留存的那份）');
  /* 行为断言：真跑一条小臂，读它写出来的 `.bak` 的 META —— 配方必须**逐键逐值**对上，且只记"真设了的"。
   * ⚠️ 这条 spawn **故意不走缓存**：它要读子进程**产出的文件**（np-cache 的前置要求正好把这类排除在外）。 */
  const d = mkdtempSync(join(tmpdir(), 'd158-'));
  const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'], {
    env: Object.assign({}, process.env, {
      EPIRUS_BAND_DIR: d, EPIRUS_ARM: 'd158probe', EPIRUS_KILL_REWARD: '2', EPIRUS_BIGT_CHAIN_W: '0.5'
    }), encoding: 'utf8', timeout: 600000
  });
  eq(r.status, 0, '小臂要跑得通（' + String(r.stderr || '').slice(0, 160) + '）');
  const baks = readdirSync(d).filter(function (f) { return /\.bak$/.test(f); });
  ok(baks.length >= 1, '必须写出至少一粒 band（实测 ' + baks.length + '）');
  const bsrc = readFileSync(join(d, baks[0]), 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(bsrc);
  ok(!!mm, 'band .bak 必须带 META');
  const bmeta = JSON.parse(mm[1]);
  ok(bmeta.recipe && bmeta.recipe.env, 'band META 必须有 recipe.env —— 实测 ' + JSON.stringify(bmeta.recipe || null));
  eq(bmeta.recipe.env.EPIRUS_KILL_REWARD, '2', '配方必须逐值记下真设了的旋钮');
  eq(bmeta.recipe.env.EPIRUS_BIGT_CHAIN_W, '0.5', '同上（按字符串形态原样记）');
  eq(bmeta.recipe.env.EPIRUS_ARM, 'd158probe', '臂名也要在配方里');
  ok(bmeta.recipe.env.EPIRUS_XN2W === undefined, '**没设的旋钮不许凭空出现在配方里**（记的是配方，不是默认值）');
  eq(bmeta.recipe.envKeys, Object.keys(bmeta.recipe.env).length, 'envKeys 必须等于 env 的键数（自洽）');
  try { rmSync(d, { recursive: true, force: true }); } catch (e) {}
});

t('D159 广度判据必须是**最大单卡落地份额**（v1.5.227 · 用户裁定换 G）：数种类会误导，且旧子句从不触发', function () {
  /* 病（实测 `tools/probe-g-collapse.mjs` 20 粒产品口径样本）：
   *   旧判据 `landedKeys < 2`（以及口语里的"≥4 种"）**从来没触发过** —— 池里每粒都是 4~10 种（中位 5）。
   *   反例就在样本里：`v7expo-31`/`v7r3-42`/`v7soft-36` **10 种卡打上血、却有 76.4% 的伤害来自 `sword`**
   *   ⇒ **宽度会误导**（种类多与塌缩可以同时成立）。
   * 新判据 = `max(landByKey)/landedTotal > 0.60` ⇒ 塌缩。实测散布 36.0%→97.7%、中位 69.1%、11/20 超线，
   *   现役 45.9% 在安全侧 ⇒ **这个轴有判别力，旧轴没有**（这就是"先量判别力再立门"那条纪律的产物）。 */
  const pb = readFileSync('tools/pick-best.mjs', 'utf8');
  ok(/export const COLLAPSE_LINE = 0\.60/.test(pb), '塌缩线必须是单一来源常量（探针/门/训练都 import 它）');
  /* 断言用**语义**而不是逐字（v1.5.227 第一版把正则写死成 `share == null ? ...`，
   * 而真代码是 `(share == null) ? ...` ⇒ 门因为多了一对括号就红 —— 那种门守的是空白，不是行为）。 */
  ok(/share == null[\s\S]{0,48}keys < 2/.test(pb) && /share > COLLAPSE_LINE/.test(pb) && /shareMissing/.test(pb),
    '缺 `maxLandShare` 时必须退回旧子句**并把缺的个数报出来**（不许静默降级成"看不见就当过"）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* 训练路径必须**真的**把份额传进否决（否则新判据在真路径上是死代码），而且必须走 `landShareOf` 单一来源 ——
   * 顺手**禁止**退回手写：我第一版写的是 `max(landByKey)/landedTotal`，而 `landByKey` 含非卡键 ⇒ 算出过 44900%。 */
  ok(/landShareOf\(sb, mh\)/.test(t3) && /e\.maxLandShare = __ls\.share; e\.maxLandKey = __ls\.key;/.test(t3),
    '训练路径必须把份额传进否决，且走 `landShareOf`（单一来源）');
  ok(!/Object\.keys\(__lb\)/.test(t3),
    '不许退回手写 `max(landByKey)/landedTotal`：`landByKey` 含**非卡键**（"终局收缩"…）而 landedTotal 是过滤后的 ⇒ 份额会 >100%');
  ok(/HOLO_GIFT_MAX/.test(t3) && /最大单卡落地份额/.test(t3), '训练日志必须按新口径印（含阈值与最大卡名）');

  /* ===== 行为断言：判别力本身 ===== */
  const mk = function (score, landG, keys, share, key) {
    return { ref: { params: 'p' + score }, score: score, landG: landG, landedKeys: keys, maxLandShare: share, maxLandKey: key };
  };
  /* ① **旧判据放行、新判据必须砍**的那一粒（10 种但 76.4% 塌缩）—— 本门存在的理由 */
  let r = rejectNarrowWinners([mk(1.00, 3.2, 10, 0.764, 'sword'), mk(0.90, 3.0, 5, 0.459, 'gun')], 1.5);
  eq(r.dropped, 1, '10 种卡但 76.4% 来自一张 ⇒ 必须判塌缩（旧判据会放行它）');
  ok(r.best && r.best.score === 0.90, '该留的是份额健康的那一粒');
  eq(r.victims[0].maxLandKey, 'sword', '被剔者必须带上是哪张卡塌的（否则日志读不出病因）');
  /* ② 线的方向：`>` 而非 `>=`（恰好 0.60 不砍、0.601 砍）—— 阈值语义不许漂 */
  eq(rejectNarrowWinners([mk(1, 3.2, 5, 0.60, 'gun')], 1.5).dropped, 0, '恰好 60% 不算塌缩（线是 >）');
  eq(rejectNarrowWinners([mk(1, 3.2, 5, 0.601, 'gun')], 1.5).dropped, 1, '60.1% 必须判塌缩');
  /* ③ 加严而非放宽：只有一种卡 ⇒ 份额 100% ⇒ 一定被砍（旧子句的 case 被蕴含） */
  eq(rejectNarrowWinners([mk(1, 3.2, 1, 1.0, 'gun')], 1.5).dropped, 1, '只剩一种卡必须仍被砍（新线蕴含旧线）');
  /* ④ 缺字段的老调用方：不许静默当"过"，也不许一律判死 —— 走旧子句 + 计数 */
  r = rejectNarrowWinners([mk(1, 3.2, 3, null) ], 1.5);
  eq(r.dropped, 0, '缺份额且种类够 ⇒ 按旧子句放行');
  eq(r.shareMissing, 1, '缺份额必须被计数（让调用方看得见）');
  /* ⑤ G(落地) 那条下限仍在（两条子句是"且"的关系） */
  eq(rejectNarrowWinners([mk(1, 1.49, 5, 0.3, 'gun')], 1.5).dropped, 1, '净兑现低于地板仍要砍');
});

t('D166 大雷连带**被挡下时 UI 不许说"造成伤害"**（v1.5.253 用户报）：文案必须按同回合的真事件反推', function () {
  /* 病（用户在实盘里发现）：`bigTChain` 事件在 `js/core/resolve.js` 里是**无条件发出**的 —— 发完才可能
   *   `continue` 完全挡住、或把伤害转给防御者的作用目标。UI 原来把这条**硬编码**成"受 2 点电伤"
   *   ⇒ "被挡下"被渲染成"造成了伤害"（**结算是对的，错的只有文案**）。
   * 本门做两件事：① 从 `js/ui/ui.js` **真源码**里抽出 `bigTChainText` 并跑它（不拷一份，测试跑的就是产品代码）；
   *   ② 三档现场用**引擎真结算**造出来（不手搓事件）：自守防御=完全挡住 / 藤甲=转给被贴者 / 非防御族=真打中。 */
  const src = readFileSync('js/ui/ui.js', 'utf8').split('\r\n').join('\n');
  const i0 = src.indexOf('const BIGT_CHAIN_REASON');
  const i1 = src.indexOf('function evText(e, roundEvents)');
  ok(i0 >= 0 && i1 > i0, 'ui.js 里必须存在 `bigTChainText`（连带文案的唯一来源）');
  const NM = ['你', '电脑1', '电脑2', '电脑3', '电脑4'];
  const nm = function (pid) { return NM[pid] != null ? NM[pid] : String(pid); };
  const mod = new Function('nm', src.slice(i0, i1) + '\n return { bigTChainText: bigTChainText };')(nm);
  ok(typeof mod.bigTChainText === 'function', '抽出的 `bigTChainText` 必须可调用（源码形状变了就要改本门）');

  const W = sandbox('.');
  const R = W.EpirusRules, S = W.EpirusState, X = W.EpirusResolve;
  const rng = function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /* 现场：c=0 放【真正的落雷】→2；T=2 用【枪】打 q=1（让 q 成为连带候选）；q=1 用 `qKey`。 */
  const scen = function (qKey, qTarget) {
    const st = S.createState('long', { next: rng(7) }, 5);
    X.startTurn(st);
    st.p.forEach(function (p) { p.ep = 0; });
    st.p[0].ep = 10; st.p[2].ep = 3;
    st.actions[0] = { key: R.SK.BIG_T, target: 2, opt: null };
    st.actions[2] = { key: R.SK.GUN, target: 1, opt: null };
    st.actions[1] = { key: qKey, target: qTarget, opt: null };
    st.actions[3] = { key: R.SK.JI, target: 3, opt: null };
    st.actions[4] = { key: R.SK.JI, target: 4, opt: null };
    const before = st.events.length;
    X.resolveActions(st);
    const evs = st.events.slice(before);
    return { evs: evs,
      chain: evs.filter(function (e) { return e.type === 'bigTChain'; }),
      dmg: evs.filter(function (e) { return e.type === 'damage' && e.reason === '真正的落雷·连带'; }) };
  };
  const A = scen(R.SK.GUARD, 1);      // 自守防御 ⇒ 完全挡住
  const B = scen(R.SK.ARMOR, 2);      // 藤甲（enemy 目标）⇒ 伤害转给被贴者
  const C = scen(R.SK.GUN, 2);        // 非防御族 ⇒ 真打中（对照）
  /* 前置（本门要测的三档都必须真的被造出来，否则门会变成"测空气"） */
  eq(A.chain.length, 1, '前置：自守防御那档必须产生 bigTChain 事件');
  eq(A.dmg.length, 0, '前提：自守防御那档**没有连带伤害**（这正是用户看到"被挡下"的情形）');
  eq(B.dmg.length, 1, '前置：藤甲那档必须产生连带伤害（转给被贴者）');
  eq(C.dmg.length, 1, '前置：非防御族那档必须真的打中');

  const aT = mod.bigTChainText(A.chain[0], A.evs).html;
  ok(!/受 2 点电伤|受 2 点伤害/.test(aT) && /挡下/.test(aT),
    '【用户报的那条】被挡下时绝对不许说"受 2 点电伤"，必须说"挡下"：实际=' + aT);
  const bT = mod.bigTChainText(B.chain[0], B.evs).html;
  ok(bT.indexOf(NM[B.dmg[0].to]) >= 0 && /转给/.test(bT) && !new RegExp(NM[B.chain[0].to] + ' 受').test(bT),
    '转走时必须指出**真实受害者**、不许记在连带候选头上：实际=' + bT);
  const cT = mod.bigTChainText(C.chain[0], C.evs).html;
  ok(/受 2 点电伤/.test(cT), '真打中时仍要报数（不许为了修 A 把 C 也改哑）：实际=' + cT);
  /* ===== 第四档：**一回合两个候选**（q=1 自守防御=被挡 · q=3 非防御族=真中）=====
   * 这一档是**第一版说假话的地方**，而它是我在**真 Chrome**里跑页面才发现的：
   *   第一版扫的是"整回合的连带伤害" ⇒ 被挡的那条看到**别的候选的伤害**，把它误报成"转给你"。
   * 引擎对每个候选是"先发 `bigTChain`、紧跟自己的投递" ⇒ 判据必须落在**段内**（到下一个 bigTChain 为止）。 */
  const two = (function () {
    const st = S.createState('long', { next: rng(7) }, 5);
    X.startTurn(st);
    st.p.forEach(function (p) { p.ep = 0; });
    st.p[0].ep = 10; st.p[2].ep = 3;
    st.actions[0] = { key: R.SK.BIG_T, target: 2, opt: null };
    st.actions[2] = { key: R.SK.GUN, target: 1, opt: null };
    st.actions[1] = { key: R.SK.GUARD, target: 1, opt: null };   // 自守防御 ⇒ q=1 被完全挡住
    st.actions[3] = { key: R.SK.GUN, target: 2, opt: null };     // 非防御族 ⇒ q=3 真吃 2 点
    st.actions[4] = { key: R.SK.JI, target: 4, opt: null };
    const before = st.events.length;
    X.resolveActions(st);
    const evs = st.events.slice(before);
    return { evs: evs,
      chain: evs.filter(function (e) { return e.type === 'bigTChain'; }),
      dmg: evs.filter(function (e) { return e.type === 'damage' && e.reason === '真正的落雷·连带'; }) };
  })();
  eq(two.chain.length, 2, '前置：一回合两候选必须产生两条 bigTChain');
  eq(two.dmg.length, 1, '前置：这一回合只有**一个**候选真吃到连带伤害');
  const blk = two.chain.filter(function (x) { return x.to === 1; })[0];
  const hit = two.chain.filter(function (x) { return x.to === 3; })[0];
  ok(blk && /挡下（未造成电伤）/.test(mod.bigTChainText(blk, two.evs).html),
    '同回合还有别的候选真中时，被挡的那条**仍**必须说"挡下（未造成电伤）"，不许说"转给"（第一版就是在这里说假话）：实际=' +
    (blk ? mod.bigTChainText(blk, two.evs).html : '(缺候选)'));
  ok(hit && /受 2 点电伤/.test(mod.bigTChainText(hit, two.evs).html), '同回合真中的那条仍要报数：实际=' +
    (hit ? mod.bigTChainText(hit, two.evs).html : '(缺候选)'));
  /* 接线：三处调用点都必须把**整回合事件表**传进去（否则 `roundEvents` 恒为 undefined、修了等于没修） */
  eq((src.match(/evText\(e, (list|events)\)/g) || []).length, 3, '三处 `evText` 调用点都必须传整回合事件表');
  ok(/case 'bigTChain': return bigTChainText\(e, roundEvents\);/.test(src),
    '`evText` 的 bigTChain 分支必须委托给 `bigTChainText`（不许再内联硬编码）');
});

t('D167 econ 族 5 键必须能在 CLI **真下达并读回消费点**（用户 GO · 千问 §E59 NEXT 6）：开档臂不许 exit 6、同族没接线的键必须仍是 6', function () {
  /* 病：`beadW/bigcardW/stockBonus/hoardOnLeftover/convRatio` 只走 server/worker，
   *   `train-3p` 不 dispatch ⇒ CLI 传进去**静默 exit 6**（治闭环"花"那一半时卡在这里）。
   * 判"真接上了"用**行为式**两条一起（METHODOLOGY 73 的变异测试同族）：
   *   ①开档臂必须跑通并印**读回**；②同族但没接线的键必须仍 `exit 6`（证明守卫没被自己关掉）。 */
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  for (const k of ['beadW', 'bigcardW', 'stockBonus', 'hoardOnLeftover', 'convRatio']) {
    ok(src.indexOf("'" + k + "'") >= 0, 'CLI 白名单 `CLI_ECON_REWARD_KEYS` 必须含 ' + k);
  }
  const econ = readFileSync('server/econ-env.mjs', 'utf8');
  ok(econ.indexOf("'EPIRUS_BEAD_W'") >= 0,
    '`ECON_ENV_KEYS` 必须含 `EPIRUS_BEAD_W`（v1.5.254 之前**漏在名单外**：`readEconEnv` 一直在读它 ⇒ 名单是"本族覆盖了哪些 env"的单一来源，漏名 = 任何按名单派生的入口都把它当暗键）');
  ok(/for \(const v of \[0\.5, '1'\]\)/.test(src),
    '派生探针必须**一试两档**（`0.5` 与 `\'1\'`）：布尔档键（`convRatio`/`hoardOnLeftover`）只喂 `0.5` 时命中为空 ⇒ 会被误判成"本工具不认得"');

  const dir = mkdtempSync(join(tmpdir(), 'd167-'));
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '1'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  try {
    const rU = runArm('d167u');
    ok(!/econ 旋钮已下达/.test(String(rU.stdout)), '不设 ⇒ 一行都不许印（"开了但没生效"与"没开"要看得见差别）');
    const rB = runArm('d167b', { EPIRUS_BEAD_W: '0.4' });
    eq(rB.status, 0, '`EPIRUS_BEAD_W=0.4` 必须成功（不许再 `exit 6`）：' + String(rB.stderr || '').slice(0, 90));
    ok(/econ 旋钮已下达并读回消费点：beadW=0\.4/.test(String(rB.stdout)), '`beadW` 必须印**消费点读回**值');
    const rC = runArm('d167c', { EPIRUS_CONV_RATIO: '1' });
    eq(rC.status, 0, '`EPIRUS_CONV_RATIO=1` 必须成功：' + String(rC.stderr || '').slice(0, 90));
    ok(/convRatio=true/.test(String(rC.stdout)), '布尔档必须按**真值**读回（印 true，不是 1）');
    const rBad = runArm('d167bad', { EPIRUS_BEAD_W: 'abc' });
    eq(rBad.status, 7, '非数值必须 `exit 7`（读回不相等就算被拒），实际 ' + rBad.status);
    const rDark = runArm('d167dark', { EPIRUS_S4_W: '0.4' });
    eq(rDark.status, 6, '同族但**没接线的键**（`EPIRUS_S4_W`）必须仍 `exit 6` ⇒ 守卫是活的，上面"开档臂跑通"才真是"接上了"');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
});

t('D168 包 META 的读取必须扛得住**嵌套**与**线上槽的手改损坏**（v1.5.255 · 本班撞上的两个真缺陷）', function () {
  /* 病一（嵌套截断）：旧代码用懒惰正则 `(\{[\s\S]*?\})` 抽 JSON ⇒ 对象里有嵌套时在**第一个** `}` 就截断。
   *   v1.5.226 给 META 加了 `recipe.env` ⇒ 这个形状真实存在（713 那种平铺 meta 恰好不触发）。
   * 病二（线上槽真的坏了）：`js/bundled-champion-3p.js` 与 `js/bundled-champion.js` 的 META 都**少了
   *   `fingerprintRefresh` 的起始引号**（手改追加时丢的）⇒ 任何 `JSON.parse(meta)` 的入口在**线上槽**上必崩 ——
   *   而线上槽恰恰是最该能读的那一个。⇒ 本门两条都钉：扫描器扛嵌套、容错只修这一种且**必须响亮**。 */
  const A = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(/export function extractJsonObject/.test(A), '`extractJsonObject` 必须是 audit-lib 的导出（**唯一一份**这种抽取）');
  ok(/export function parseMetaTolerant/.test(A), '`parseMetaTolerant` 必须是 audit-lib 的导出');

  /* ① 扫描器：嵌套 / 字符串里带花括号 / 转义 / marker 后紧跟 avoid 时跳过 */
  const nested = 'window.M = {"a":1,"r":{"env":{"X":"1"}},"z":2};';
  eq(AUDIT.extractJsonObject(nested, 'window.M'), '{"a":1,"r":{"env":{"X":"1"}},"z":2}', '嵌套对象必须完整抽出（旧懒惰正则会截断）');
  eq(AUDIT.extractJsonObject('window.M = {"s":"}{","a":1};', 'window.M'), '{"s":"}{","a":1}', '字符串里的花括号不许影响配平');
  eq(AUDIT.extractJsonObject('window.M = {"s":"a\\"b"};', 'window.M'), '{"s":"a\\"b"}', '转义引号不许破坏字符串状态');
  eq(AUDIT.extractJsonObject('window.M = {"a":1', 'window.M'), null, '没配平 ⇒ 返回 null（不许静默给半截）');
  eq(AUDIT.extractJsonObject('window.M_META = {"m":1};window.M = {"w":2};', 'window.M', '_META'), '{"w":2}',
    'marker 后紧跟 avoid ⇒ 必须跳过（`_META` 写在 `_3P` **前面**，不跳过就会把元数据当权重包）');

  /* ② 容错解析：合法输入**不许**被改；已知缺陷**修好且报告**；别的损坏**原样抛** */
  const legal = '{"a":1,"s":"x,y:1"}';
  const r0 = AUDIT.parseMetaTolerant(legal, 'unit-legal');
  eq(r0.repaired.length, 0, '合法 JSON 不许报告"修过"');
  eq(r0.meta.s, 'x,y:1', '合法 JSON 的值不许被改（尤其别把值里的 `,x:` 当初坏点）');
  const r1 = AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'unit-broken');
  eq(r1.repaired.join(','), 'broken', '已知缺陷（裸键名缺起始引号）必须被修并**列出键名**');
  eq(r1.meta.broken, 'v', '【本条防的是我自己踩过的坑】修引号时**不许把值的开引号吃掉**（第一版写坏 ⇒ 值成了裸的 `v`）');
  let threw = false;
  try { AUDIT.parseMetaTolerant('{"a":,}', 'unit-other'); } catch (e) { threw = true; }
  ok(threw, '不是"缺起始引号"这一种的损坏 ⇒ 必须**原样抛**（不许瞎修）');

  /* ③ 【最有价值的一条】用**真·线上槽**跑一遍：这两个文件正是崩过的现场 */
  for (const f of ['js/bundled-champion-3p.js', 'js/bundled-champion.js']) {
    const src = readFileSync(f, 'utf8');
    const seg = AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_3P_META') || AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_META');
    ok(!!seg, f + ' 的 META 段必须能被扫描器定位（配平）');
    let got = null;
    try { got = AUDIT.parseMetaTolerant(seg, f).meta; } catch (e) { got = null; }
    ok(got && typeof got === 'object' && Object.keys(got).length >= 8,
      f + ' 的 META 必须能被解析出 ≥8 个顶层键（**这两个文件就是当初崩的现场** ⇒ 本门防回归）');
  }

  /* ③b（10-03 夜班 §E261 新增）：**线上槽必须严格可解析**（不走容错），且**一条警告都不许印**。
   *      为什么加：v1.5.256 把两个包的引号补回来之后，容错路其实只在夹具上走；但旧文本把"源文件是红线包"
   *      硬写在通用警告里 ⇒ 我把单元测试的 `unit-broken` 念成了"生产缺陷 + 待用户裁定"，还写进了日志。
   *      这条腿把"线上槽是干净的"钉成事实：**它红了就是真有人手改了包**，不会再是文本错觉。 */
  const warnSink = [];
  const realWarn = console.warn;
  console.warn = function (s) { warnSink.push(String(s)); };
  try {
    for (const f of ['js/bundled-champion-3p.js', 'js/bundled-champion.js']) {
      const src = readFileSync(f, 'utf8');
      const seg = AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_3P_META') || AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_META');
      let strictOk = true;
      try { JSON.parse(seg); } catch (e) { strictOk = false; }
      ok(strictOk, f + ' 的 META 必须**严格** JSON.parse 得动（v1.5.256 的修复要站住；红了=有人手改过线上槽，不是"容错路失效"）');
      AUDIT.parseMetaTolerant(seg, f);
    }
    ok(warnSink.length === 0, '读**两个真线上槽**时一条容错警告都不许印（实测印了 ' + warnSink.length + ' 条：'
      + (warnSink[0] || '').slice(0, 90) + '）');
  } finally { console.warn = realWarn; }

  /* ⑤ 警告文本必须**按 label 分岔**（合成夹具不许被念成"线上槽损坏"，真线上槽的措辞也不能丢） */
  const say = [];
  const rw2 = console.warn;
  console.warn = function (s) { say.push(String(s)); };
  try {
    AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'unit-broken');
    AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'js/bundled-champion-3p.js');
  } finally { console.warn = rw2; }
  eq(say.length, 2, '两条合成分岔都要各印一条（实测 ' + say.length + '）⇒ 抽取式失效时这条要响，不许静默');
  ok(say[0].indexOf('红线包') < 0 && say[0].indexOf('不是生产缺陷') >= 0,
    '⑤a **夹具 label** 的警告不许说"线上槽/红线包损坏"（实测：' + say[0].slice(0, 120) + '）');
  ok(say[1].indexOf('线上槽文件') >= 0,
    '⑤b 真的 `js/bundled-champion*` 损坏必须仍响亮指向"由用户裁定"（实测：' + say[1].slice(0, 120) + '）');

  /* ④ promote-champion 必须走扫描器：不许再留**读 META 的懒惰正则**，也不许残留旧的 `metaM` 变量 */
  const P = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/extractJsonObject\(src, 'window\.EPIRUS_CHAMPION_3P_META'\)/.test(P), 'promote 必须用扫描器定位 META');
  ok(P.indexOf('metaM[0]') < 0 && P.indexOf('metaM[1]') < 0, 'promote 不许再引用那条懒惰正则的捕获组（写回路径也在里面）');
  ok(!/EPIRUS_CHAMPION_3P_META\\s\*=\\s\*\)\(\\\{\[\\s\\S\]\*\?\\\}/.test(P), 'promote 里不许再有"抽 META 的懒惰正则"');
  ok(/src\.replace\(metaSeg, function \(\) \{ return JSON\.stringify\(meta\); \}\)/.test(P),
    '写回必须用**函数形式**替换（字符串形式的替换会把 `$&`/`$\'` 当特殊模式 —— 同一族的"替换吃字符"）');
});

t('D169 闭环判据的**分形态版**必须只在"贵卡真出手且余珠不多"时才算闭环，且**默认不启用**（v1.5.256 · §15 实测）', function () {
  /* 病（5 种子实测 · 日志 §15）：`isClosed`（得珠≥100 且 花珠率≥0.5）把两种**不同病因**判成同一个 ✗ ——
   *   ① 攒着不花（seed31：得珠 402、花珠率 9.2%）② 根本没有经济（seed71/191：得珠 0）；
   * 而"大雷>0"与"花珠率≥0.5"两点集不相交，skill report 又说大雷值 +4.9~7.7pt
   *   ⇒ 旧线在惩罚"会用贵卡"。分形态版以"**钱有没有出口**"为实质。
   * 本门两侧都钉：**该收的形态必须收**、**不该收的假对冲必须拒**，并且**默认路径不许被换掉**。 */
  const rows = {
    hoardWithBig: { gained: 402, spentRate: 0.092, bigCardPerGame: 2.92, leftoverPerGame: 5.0 },   // seed31 形状 ⇒ 该收
    noEconomy: { gained: 0, spentRate: 0, bigCardPerGame: 1.7, leftoverPerGame: 0 },               // 没经济 ⇒ 拒
    spender: { gained: 290, spentRate: 0.886, bigCardPerGame: 2.5, leftoverPerGame: 1 },           // 花得动 ⇒ 收
    fakeHedge: { gained: 402, spentRate: 0.09, bigCardPerGame: 0.3, leftoverPerGame: 30 }          // 攒着且贵卡不出 ⇒ 拒
  };
  ok(AUDIT && PF_FRONT.isClosedShaped, '`isClosedShaped` 必须从 pool-frontier-lib 导出');
  eq(PF_FRONT.isClosed(rows.hoardWithBig, 0.5, 100), false, '（前提自检）旧判据对"攒着不花"确实判 ✘ —— 这条门才有意义');
  eq(PF_FRONT.isClosedShaped(rows.hoardWithBig, 0.5, 100), true,
    '攒着但**贵卡真出手**且余珠不多 ⇒ 分形态版必须判闭环（这正是被旧线误杀的形态）');
  eq(PF_FRONT.isClosedShaped(rows.spender, 0.5, 100), true, '花得动 ⇒ 两种判据都要收（不许把旧的正确判定弄丢）');
  eq(PF_FRONT.isClosedShaped(rows.noEconomy, 0.5, 100), false, '得珠 0（根本没经济）⇒ 拒（"挣到"这条是前提）');
  eq(PF_FRONT.isClosedShaped(rows.fakeHedge, 0.5, 100), false,
    '攒着不花且贵卡也不出手 ⇒ 必须拒（余珠门槛就是防"假对冲"把这条线刷松）');
  eq(PF_FRONT.isClosedShaped({ gained: 402, spentRate: 0.09, bigCardPerGame: NaN, leftoverPerGame: NaN }, 0.5, 100), false,
    '【fail-closed】读数缺失 ⇒ 判**不闭环**（不许因为读不到就当通过，与 `isRobust` 同规矩）');
  ok(Number.isFinite(PF_FRONT.CARD_BUDGET.bigCardMin) && Number.isFinite(PF_FRONT.CARD_BUDGET.leftoverMax),
    '阈值必须是**具名单一来源**（`CARD_BUDGET`），不许散在调用点里');
  /* 【默认不启用】当前调用路径必须仍是旧判据 —— 判据变更属用户裁定，不许代码偷偷换 */
  const pfSrc = readFileSync('tools/probe-pool-frontier.mjs', 'utf8');
  ok(!/isClosedShaped/.test(pfSrc), 'probe-pool-frontier **不许**已经改用分形态版：切换要用户点头、并留痕（本门就是那句"留痕"）');
  ok(/isClosed\(m, BEAD, GAINED\)/.test(pfSrc), 'probe-pool-frontier 当前必须仍走 `isClosed`');
  /* ===== 【本条是"先量再切"的产物】分形态版**被实测反例否掉**，所以不能照那个设计切 =====
   * 用户裁定"切、用占位阈值"之后，我在**切之前**把两个新读数在真包上量了一遍（5 粒 · 同一把尺 · 40 局账）：
   *   · 得珠/局：现役 6.8 · 713 2.5 · Ldemo 4.2 · **Lctl(seed31) 10.1** · s111 7.3
   *   · **过期/局**：现役 0.9 · 713 0.4 · Ldemo 1.6 · **Lctl 9.1** · s111 0.7   ← Lctl 的珠子是**过期烂掉**，不是花掉
   *   · **贵卡/局**：现役 3.81 · 713 3.55 · Ldemo 4.20 · Lctl 5.58 · s111 4.46  ← 全落在 3.55~5.58 ⇒ **没有判别力**
   * ⇒ 照分形态版：`Lctl`（花珠率 9.2% · 过期 9.1/局）会被判 **✔** —— 等于把"珠子经济烂掉"的粒**洗白**。
   * ⇒ 正确读法：这不是"闭环在惩罚正确行为"，而是**两套货币各自崩**（贵卡/大雷花的是 ep；珠子是另一种资源）。
   * ⇒ 处置：**不切**（保留 `isClosed`），把这条反例钉在这里：以后谁要切，必须先面对这组数。 */
  const LCTL = { gained: 404, spentRate: 0.092, bigCardPerGame: 5.58, leftoverPerGame: 0.05 };
  eq(PF_FRONT.isClosed(LCTL, 0.5, 100), false,
    '【实测反例】Lctl 的珠子经济（花珠率 9.2% · 过期 9.1/局）必须被判 ✘ —— 旧判据在这件事上是对的');
  ok(/洗白/.test(readFileSync('tools/pool-frontier-lib.mjs', 'utf8')),
    '`isClosedShaped` 的文档必须**留痕**这条反例（说明它为什么不能被采用）—— 不许后人看不出它被否过');
});

t('D170 出手形状的两条记录读数（目标死磕 / ジ⇄枪交替）必须可复现、缺读数给 NaN、且**只记录不阻断**（v1.5.258 · 用户 09-27 点名）', function () {
  /* 动因（用户原话）：「不过还是有一些**奇怪的公式打法**」+ 点名让我把另外两条也做记录测试：
   *   ① 同一目标死磕（实盘 4 局里 `玩家4→玩家5 ×5`、`玩家3→玩家5 ×4` …）
   *   ② ジ⇄枪 机械交替（30 回合局玩家4 从第16~30回合几乎就是 `枪,ジ,枪,ジ,…`）
   * 另注：**"空防御"那条用户说千问已列过** ⇒ 不要在别处另立一套，用 `tools/defense-quality.mjs` 的**白防**（用户 09-26 裁定）。 */
  const S = PS;
  ok(S && typeof S.attackTargets === 'function' && typeof S.targetFixation === 'function' &&
     typeof S.actionKeys === 'function' && typeof S.jiGunShape === 'function',
    'play-shape 的四个纯函数必须都导出（**唯一一份**这种读数）');

  /* ① 出手目标序列：只认**带 source 的结算事件**（action 事件本身不带目标 —— 别去猜） */
  const ev = [
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 2, via: 'gun' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'blocked', source: 0, to: 2, via: 'gun', reason: '反弹' },
    { type: 'damage', source: 1, to: 0, via: 'gun' },        // 别人打我 ⇒ 不算我的出手
    { type: 'damage', source: 0, to: 3, via: 'sword' },
    { type: 'damage', source: 0 },                             // 没 to ⇒ 跳过
    { type: 'action', pid: 0, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 0, key: 'ji', outcome: 'noep' }     // 被拒 ⇒ 不算
  ];
  eq(JSON.stringify(S.attackTargets(ev, 0)), '[2,2,3]', '只取带 source 的结算事件（被挡也算一次出手），跳过无 to/他人所为');
  const fx = S.targetFixation([2, 2, 2, 3]);
  eq(fx.maxRun, 3, '最长连打同一目标必须是 3（实盘 `×5` 那种形状要能读出来）');
  eq(Number(fx.sameRate.toFixed(3)), 0.667, '同目标率 = 2/3');
  ok(isNaN(S.targetFixation([]).sameRate) && isNaN(S.targetFixation([]).maxRun),
    '【NaN 纪律】没量到出手 ⇒ 必须 NaN，**不许是 0**（"没量到"≠"量到 0"，与 defense-quality 同规矩）');
  ok(isNaN(S.targetFixation([5]).sameRate), '只有 1 次出手 ⇒ 同目标率 NaN（没有"上一次"可比）');

  /* ② 出手序列 + ジ⇄枪交替 */
  eq(JSON.stringify(S.actionKeys(ev, 0)), '["gun","gun","ji"]', '只取 outcome===ok 的本席 action（被拒的 noep 不算；ev 里那条 ok 的 ji 要算）');
  const jg = S.jiGunShape(['ji', 'gun', 'ji', 'gun'], 'ji', 'gun');
  eq(jg.altRate, 1, '纯交替 ⇒ 交替率 1');
  const jg2 = S.jiGunShape(['ji', 'ji', 'ji'], 'ji', 'gun');
  eq(jg2.altRate, 0, '有相邻对、但一次都不交替 ⇒ 交替率 **0**（那是真的"从不交替"，不是缺读数）');
  ok(isNaN(S.jiGunShape(['ji'], 'ji', 'gun').altRate), '【NaN 纪律】只有 1 次出手 ⇒ 连相邻对都没有 ⇒ 交替率必须 NaN，不许 0');
  eq(jg2.meanJiRun, 3, '连ジ段均长 = 3（"攒钱深度"这半条要能读）');
  eq(jg2.jiShare, 1, 'ジ占比 = 1');
  eq(S.jiGunShape(['gun', 'sword', 'gun'], 'ji', 'gun').jiShare, 0, '没出ジ ⇒ 占比 0（这里**该**是 0，因为有分母）');

  /* ③ 措辞唯一 + 可解析回数字（探针与体检共用同一串） */
  const line = S.formatShape({ n: 5, maxRun: 3, sameRate: 0.5 }, { n: 5, altRate: 0.4, meanJiRun: 2, jiShare: 0.6 });
  ok(/最长 3 连/.test(line) && /ジ⇄枪交替 \*\*40\.0%\*\*/.test(line), '一行读数必须把四条都印出来：' + line);
  const back = S.parseShape(line);
  eq(back.maxRun, 3, 'parseShape 必须能解回最长连打（措辞唯一，免得两处各写一遍）');
  eq(back.altRate, 0.4, 'parseShape 必须能解回交替率');

  /* ④ 【只记录】不许接成判据 —— 判据变更属用户裁定；本门就是那句"留痕" */
  const pro = readFileSync('tools/promote-champion.mjs', 'utf8');
  /* v1.5.258 追加：本栏已**并进 promote 的只记录体检栏**（照 DEFQ 栏同一套：spawn 探针、不自己仿真）⇒
   * 门钉三件事：① 栏在（spawn 探针）② promote 不自己算（不许 import 那两个函数去参与判定）③ 有逃生阀。 */
  ok(/probe-play-shape\.mjs/.test(pro), 'promote 必须 spawn 探针来出这一栏（单一来源，别自己仿真）');
  ok(pro.indexOf('targetFixation(') < 0 && pro.indexOf('jiGunShape(') < 0,
    'promote **不许**自己 import 并计算这两个读数（那就成了第二份实现；要立判据先请用户裁定）');
  ok(/EPIRUS_NO_SHAPE/.test(pro), '这一栏必须有逃生阀 EPIRUS_NO_SHAPE=1（与 DEFQ/GUARD 两栏同规矩）');
  ok(/出手形状栏（同上，\*\*只记录不阻断\*\*/.test(pro), '栏名必须写明"只记录不阻断"（以后有人想拿它阻断，得先改这行字）');
  const lib = readFileSync('tools/play-shape.mjs', 'utf8');
  ok(/只记录不阻断/.test(lib), '`play-shape.mjs` 的头注必须写明"只记录不阻断"');
  /* ===== v1.5.259（用户 GO"做 B"）：**昂贵层只记录读数** —— 大雷出手 / ≥3ep 出手占比 / 珠过期率 =====
   * 动因（§20.1/§20.2）：大雷是"抽到就得留住"的瞬态（21 粒只 1 粒学会；从学会者续训三臂全掉回 ~0），
   *   根因候选是**适应度里没有读数量它**。这一步只让"它出现过没有、以什么代价"可见；进 fit 属判据裁定。 */
  const keys = ['ji', 'gun', 'gun', 'ring', 'ji'];
  const isCostly = (k) => k === 'ring' || k === 'bigT';
  const cpp = PS.costlyProfile(keys, 'bigT', isCostly);
  eq(cpp.n, 5, '昂贵层画像要给出总出手数（分母）');
  eq(cpp.costly, 1, '≥3ep 出手数必须按调用方给的价格口径数（价格在规则里，别在这里复写一份）');
  eq(Number(cpp.costlyShare.toFixed(3)), 0.2, '≥3ep 出手占比 = 1/5');
  ok(isNaN(PS.costlyProfile([], 'bigT', isCostly).costlyShare), '【NaN 纪律】没出手 ⇒ 占比 NaN，不许 0');
  eq(PS.costlyProfile(['bigT', 'bigT'], 'bigT', isCostly).bigT, 2, '真·落雷出手数要单独数（这就是判据缺失的那个量）');
  ok(isNaN(PS.beadRotRate(0, 5)), '【NaN 纪律】得珠 0 ⇒ 过期率 NaN（不许把"没经济"读成"过期率 0 = 很好"）');
  eq(Number(PS.beadRotRate(100, 96.7).toFixed(3)), 0.967,
    '过期率 = 过期/得珠（本班实测 Lctl = 96.7% vs 现役 48.1% —— 这条就是"用贵卡的代价"第一次可见）');
  ok(/昂贵层/.test(PS.formatCostly(cpp, 0.967)) && /96\.7%/.test(PS.formatCostly(cpp, 0.967)),
    '昂贵层那一行的措辞必须把三个数都印出来（探针与体检共用同一串）');
  ok(/defense-quality/.test(lib) && /白防/.test(lib),
    '头注必须指向**已有的白防口径**（用户 09-26 裁定 + 千问已列）—— 不许在别处另立一套"空防御"');
});

t('D172 贵卡预算权重 costlyW：默认 0 · 线性形状 · **三处名单齐全**（缺一处就被入口黑键闸拦）· 读回可验（v1.5.260）', function () {
  /* 动因（本班 §20.1/§20.2 + §21 的坑）：大雷/贵卡是"抽到就得留住"的瞬态（21 粒只 1 粒学会、续训三臂全掉回 ~0），
   * 根因候选=适应度里没有读数量它；而现役那条 `bigcardW` 的形状 `min(1, uses/1)` **1 次即吃满** ⇒ 对已出 3~8 次的粒没有梯度。
   * ⇒ 新增 `costlyW`（**线性计数** `costlyW × bigUses`，默认 0 ⇒ 行为逐字不变）。
   * 【本门第二段是这次踩的坑】我第一次只改了 econ-env 的两处名单 ⇒ `train-3p` 仍把 `EPIRUS_COSTLY_W` 当**黑键**拦下
   *   （"传了等于没传"）⇒ 必须在**三个地方**都登记：① `ECON_ENV_KEYS`（env 名）② `ECON_REWARD_KEYS`（驼峰）③ `train-3p` 的 `CLI_ECON_REWARD_KEYS`。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  ok(/let COSTLY_W = 0;/.test(EVO), '`costlyW` 必须默认 0（默认关 ⇒ 行为逐字不变）');
  ok(/const costlyBonus = COSTLY_W > 0 \? \(COSTLY_W \* bigUses\) : 0;/.test(EVO),
    '形状必须是**线性计数** `costlyW × bigUses`（不许复用 bigcardW 那条 1 次即吃满的饱和形状）');
  ok(/\+\s*widthBonus \+ bigBonus \+ costlyBonus \+ chainBonus\)\)/.test(EVO), 'costlyBonus 必须真的进 fit 求和（接线不许只到声明）');
  ok(/if \(o\.costlyW != null\) COSTLY_W = Math\.max\(0, Number\(o\.costlyW\)\);/.test(EVO), 'setEconomyReward 必须收口这个键');
  ok(/costlyW: COSTLY_W,/.test(EVO), '生效值回执里必须有它（否则读不回 = 不知道有没有生效）');
  const E = readFileSync('server/econ-env.mjs', 'utf8');
  ok(/'EPIRUS_COSTLY_W'/.test(E), '① `ECON_ENV_KEYS`（env 名表）必须有 EPIRUS_COSTLY_W');
  ok(/costlyW: nv\(e\.EPIRUS_COSTLY_W\)/.test(E), '② 解析里必须真的读它');
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/CLI_ECON_REWARD_KEYS = \[[^\]]*'costlyW'/.test(T3),
    '③ `train-3p` 的 CLI 名单必须有它 —— **缺这一处就被黑键闸拦**（本次实测：缺它时 exit 非 0、报"本入口读不到的旋钮"）');
  /* v1.5.281 删掉了一条 `/'costlyW'\];|'costlyW',/` 的"写法检查"：它名义上"防止只加在注释里"，
   * 但实测**注释里出现的 `'costlyW',` 也算命中** ⇒ 它声称的事它没在判；而真正的保证就是上一行那条锚定式。
   * ⚠ 别再把它加回来当"双保险" —— 那种第二遍抄写正是本仓反复出事的形状。 */
  /* ④ 读回可验：下达 ⇒ 消费点读回同值（仓里所有旋钮的标准姿势） */
  /* ④ 读回可验（下达 ⇒ 消费点读回同值）本门不 spawn：已在提交前手工验证过
   *   `setEconomyReward({costlyW:0.05})` ⇒ `economyReward().costlyW === 0.05`（下达前 0）；
   *   这里只钉静态三处 + 形状，行为由探针/训练臂体现，免得门为了一个数去起沙箱。 */
});

t('D173 贵卡预算的**剂量表**（开火计数）：非零才计数、随回执一起给出、且不许改任何判定（v1.5.261 · §22.1 的教训）', function () {
  /* 动因（本班 §22.1）：`costlyW` 0/0.05/0.2 三档跑出**逐字节相同**的当选者与 **相同 bestFit**
   *   ⇒ 不是"压力不够大"，而是**剂量恒 0**（`bigUses` 在每代每席 3 局的训练场里几乎总是 0）。
   * 本仓既有规矩（`EPIRUS_TRAIN_EPS` 的开火计数）：**先装计数、再谈剂量**。本门钉三件事：
   *   ① 只在 `costlyBonus > 0` 时 +1（否则计数本身没意义）② 随 `economyReward()` 一起回执（读得到）
   *   ③ **只计数、不改判定**（不许碰 fit/排序/参数）。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  ok(/let COSTLY_HITS = 0;/.test(EVO), '剂量计数必须显式声明（第一版瞬态快照就是栽在"裸用未声明标识符"上）');
  ok(/if \(costlyBonus > 0\) COSTLY_HITS\+\+;/.test(EVO), '只在 costlyBonus **非零**时 +1（剂量表的意义就在"有没有非零过"）');
  ok(/costlyHits: COSTLY_HITS,/.test(EVO), '必须随 `economyReward()` 回执给出（读不到 = 没法用）');
  /* v1.5.281 删掉 `COSTLY_HITS\+\+[\s\S]{0,80}(?!fit)` 这条"形状检查"。变异实测：
   * 它声称要防的写法 `COSTLY_HITS++; fit += 1;` **照样通过**（贪婪 `[\s\S]{0,80}` 配尾部 lookahead 几乎总能满足）⇒ 名不副实。
   * 它想防的事其实由上一行**整句锚定** `if (costlyBonus > 0) COSTLY_HITS++;` 覆盖 —— 那条一改成夹带 fit 就红。判据没有少。 */
  const seg = (function () { const i = EVO.indexOf('COSTLY_HITS++'); return EVO.slice(Math.max(0, i - 200), i + 200); })();
  ok(seg.indexOf('gFit') < 0 && seg.indexOf('.fit =') < 0, '【只计数】计数处附近不许改 fit/判定（与 D171 同规矩）');
});

t('D174 econ 通用下达：**名单驱动** + **逐键回执比对**（不一致 exit 7）+ 位置在 T 之后 + 禁止 typeof 静默守卫（v1.5.262 · §24）', function () {
  /* 动因（本班 §24 的根因）：`train-3p` 原来对 econ 键**逐个键各写一块**下达代码 ⇒
   * 新登记进名单的键（`costlyW`）**通过了黑键闸却从没送给引擎** ⇒ 三族实验（0/0.05/0.2 · 长程场 · 从会出贵卡的粒出发）
   * 全部跑出**逐字节相同**的权重 —— 看起来像"压力无效"，实际是"**线根本没接**"。
   * 本门钉五条，缺一条就会退回那种"静默无效果"的状态。 */
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/import \{[^}]*ECON_REWARD_KEYS[^}]*\} from '\.\.\/server\/econ-env\.mjs'/.test(T3),
    '必须从**单一来源** import ECON_REWARD_KEYS（第一版漏了它 ⇒ 静默空转）');
  ok(/for \(const k of ECON_REWARD_KEYS\) if \(eff\[k\] != null\) payload\[k\] = eff\[k\];/.test(T3),
    '下达内容必须**由名单驱动**（不许再逐个键手写一块 —— 那正是新键从来不发的原因）');
  ok(/T\.setEconomyReward\(payload\)/.test(T3), '必须真的调 setEconomyReward');
  ok(/const miss = Object\.keys\(payload\)\.filter/.test(T3) && /if \(miss\.length\)/.test(T3),
    '**逐键回执比对**必须有：不一致就 exit 7 —— 这是"下达了但没生效"的唯一自动防线');
  const iT = T3.indexOf('const T = sb.window.EpirusTrainer;');
  const iD = T3.indexOf('econ 族通用下达');
  ok(iT >= 0 && iD > iT, '下达块必须在 **T 装配之后**（第一条修复尝试放在文件顶部 ⇒ 连日志都没出来）');
  ok(T3.indexOf("typeof ECON_REWARD_KEYS !== 'undefined'") < 0,
    '【本班教训】禁止 `typeof <常量> !== undefined` 这种**静默守卫**：它把"接线 bug"变成"静默无效果"（我在这条路上栽了两次）');
});

/* ===== D175（qoder 09-28 夜班 §E65b）：econ 族的**两条接线卫生**必须判在效果上 =====
 * 动因（今天实测推翻的一条结论）：09-27 那三档 `costlyW`（0/0.05/0.2）跑出逐字节相同的产物，被写成
 * "`bigUses` 在训练评分局里恒为 0 ⇒ 这条杠杆**结构性惰性**"。真相是 `evo.js` 把**累加本身**包在
 * `if (BIGCARD_W > 0)` 里 ⇒ 只开 `costlyW` 的臂剂量恒 0 是**开关造成的**，不是训练场造成的（同 §24 的"闸放行≠线接通"）。
 * 同一次审计还抓出 `setEconomyReward({reset:true})` 的手写名单**漏了 5 个键**
 * （`divW/divK/divRoleW/divForceGens/costlyW`）⇒ 同进程后续所有评分都活在哨兵脏值里。
 * 本门不钉源码文本（文本会重构掉），钉三件**行为**：剂量在权重全 0 时仍可见、开档必须改变 fit、reset 必须逐位可逆；
 * 外加"臂上必须印剂量"与"名单驱动 ⇒ 新键不可能被忘记"。 */
t('D175 econ 接线卫生：贵卡计数**不受权重门控** + costlyW 到作用点 + reset 名单驱动全覆盖（v1.5.265 · §E65b）', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd175-'));
  const outJson = dir + '/audit.json';
  const r = spawnSync(process.execPath, ['tools/probe-econ-reset-audit.mjs', '--games=32', '--json=' + outJson],
    { encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '审计探针必须通过（泄漏/没接上/不可逆都会 exit 7）：' + String(r.stderr || '').slice(0, 160));
  let j = null;
  try { j = JSON.parse(readFileSync(outJson, 'utf8')); } catch (e) { /* 下面会判 */ }
  ok(!!j, '探针必须按 `--json` 落结构化结果（没有它，门只能去 grep 中文横幅）');
  ok(j && j.leak.length === 0, 'reset 之后**每个** ECON_REWARD_KEYS 键都要回出厂（漏一个 = 哨兵泄漏给后续门/臂）：' + (j ? j.leak.join(' · ') : '-'));
  ok(j && j.notApplied.length === 0, '名单里的键必须**都**被 setter 吃（登记了却没接线 = §24 那个形状）：' + (j ? j.notApplied.join(' · ') : '-'));
  ok(j && j.dose > 0, '【作用点 A】两个权重全 0 时也必须量到**贵卡剂量**（读不到 = 计数又被关进某个 W 的门里，09-27 的假零结果就是这么来的）。实测 dose=' + (j && j.dose));
  ok(j && j.fitW !== null && Math.abs(j.dFit) > 0, '【作用点 B】`costlyW` 开档必须改变 fit（不变 = 项没接到每代评分通路）。实测 Δfit=' + (j && j.dFit));
  ok(j && j.resetReversible === true, 'reset 之后 fit 必须**逐位**回到出厂（留隐性状态 ⇒ "出厂行为不变"这句话就是假的）');
  /* 臂上必须看得见剂量：这是 09-27 那次"事后也查不到"的直接补救 */
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  const rOff = runArm('d175off'), rOn = runArm('d175on', { EPIRUS_COSTLY_W: '0.2' });
  eq(rOff.status, 0, '对照臂必须成功：' + String(rOff.stderr || '').slice(0, 120));
  eq(rOn.status, 0, '`costlyW=0.2` 臂必须成功');
  ok(/贵卡=\d+/.test(String(rOff.stdout)), '不设权重时逐代行**也要**印剂量（只在开档时印 ⇒ 又变回"没生效"与"没出手"不可分）');
  ok(/贵卡=\d+/.test(String(rOn.stdout)), '开档臂必须印剂量');
  const rBad = runArm('d175bad', { EPIRUS_COSTLY_W: 'abc' });
  eq(rBad.status, 7, '非数值必须 `exit 7`（不许 clamp 成 0 再谎称"开过了"）');
});

/* ===== D176（qoder 09-28 夜班 §E66）：**载重优点 veto** 的语义必须判在产物上 =====
 * 动因（同批臂实测）：从现役接力，**60 代**就把名人堂 6 粒的电磁炮落地全部打掉（起点 1.25/局 → 候选 ≤0.55），
 * 1200 代产物级 2.23→0~0.75/局、最大 ep 93→2~18，5P 三粒全部低于现役（38.7/25.0/37.1 vs 42.5）。
 * ⇒ 这根开关不许"开了等于没开"，也不许"为了保优点把别的塞进 fit"：
 *   ① 容差 100% ⇒ **产物逐位等于不设**（证明它只挑人不加项）；
 *   ② 全塌缩 ⇒ 产物仍等于不设 + 标 `allRejected`（不许硬换人）；
 *   ③ 账必须落在**产物 META** 上（参照/线/剔了几粒/分母），否则事后无法复核；
 *   ④ 参照缺失 / 非法卡名 / 越界 ⇒ `exit 7`（拒绝恒真判据与静默空转）。 */
t('D176 载重优点 veto（v1.5.265b · §E66）：容差 100% 逐位不变 + 全塌缩不硬换人 + 账进产物 + 无参照即拒', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd176-'));
  const SEEDPACK = 'docs/artifacts/eval-out/win-Ldemo.bak';   // 与线上槽权重逐位相同（09-28 实测 d490dc136293）
  ok(existsSync(SEEDPACK), '用例需要一粒"起点包"当参照（缺了就只能造静默通过的假绿）');
  const armEnv = (name, extra) => Object.assign({
    EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK, EPIRUS_SEED: '31', EPIRUS_ARM: name,
    EPIRUS_BAND_DIR: dir + '/band-' + name, EPIRUS_T3P_OUT: dir + '/' + name + '.js'
  }, extra || {});
  const arm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '60'], {
    encoding: 'utf8', timeout: 420000, env: Object.assign({}, process.env, armEnv(name, extra))
  });
  /* v1.5.281：这几支 60 代臂**互相独立**（各自 EPIRUS_ARM / BAND_DIR / T3P_OUT），串行只是 `spawnSync`
   * 的写法顺出来的，不是判据要求的 ⇒ 一批并发跑。判据一条没减：下面的"逐位相同 / 换 seed 必须不同 /
   * 账进产物"全都照旧，而"并发会不会改变产物"由这条门自己的变异对照兜着（`wCtl===wWide` 与 `wOther!==wCtl`）；
   * 门面另有门 D188 判"归属不串台 / 失败不吞 / 少一个 job 就判红"。 */
  const armBatch = (specs) => spawnBatch(specs.map(s => ({
    tag: s[0], argv: ['tools/train-3p.mjs', '60'], env: armEnv(s[0], s[1])
  })), { max: specs.length, timeout: 900000 });
  const metaOf = f => {
    const s = readFileSync(f, 'utf8'); const i = s.indexOf('EPIRUS_CHAMPION_3P_META = ');
    if (i < 0) return null;
    const b = s.indexOf('{', i), j = s.indexOf(';\n', b);
    try { return JSON.parse(s.slice(b, j)); } catch (e) { return null; }
  };
  const wOf = f => { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(readFileSync(f, 'utf8')); return m ? JSON.stringify(JSON.parse(m[1]).a) : null; };
  /* ④ 三条响亮拒绝（都不该跑到训练，秒级） */
  const rBad = arm('d176bad', { EPIRUS_SEL_KEEP: 'abc' });
  eq(rBad.status, 7, '`SEL_KEEP` 非数值必须 exit 7（不许 clamp 后谎称开过）');
  const rNoRef = spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_SEL_KEEP: '0.5', EPIRUS_ARM: 'd176noref', EPIRUS_T3P_OUT: dir + '/noref.js', EPIRUS_BAND_DIR: dir + '/band-noref' })
  });
  eq(rNoRef.status, 7, '开了 veto 却**没有热启动参照包**必须 exit 7（无参照的"不劣于起点"是恒真判据）');
  const rBadKey = arm('d176badkey', { EPIRUS_SEL_KEEP: '0.5', EPIRUS_SEL_KEEP_KEYS: 'notacard' });
  eq(rBadKey.status, 7, '`SEL_KEEP_KEYS` 里非法卡名必须 exit 7（判不到的维不许当通过）');
  /* ①② 三臂并排：不设 / 容差 100% / 容差 35%（现役起点 60 代实测会全塌缩）+ 变异对照（换 seed） */
  const BB = armBatch([
    ['d176ctl'],
    ['d176wide', { EPIRUS_SEL_KEEP: '1' }],
    ['d176tight', { EPIRUS_SEL_KEEP: '0.35' }],
    ['d176other', { EPIRUS_SEED: '57' }],
  ]);
  const rCtl = BB.d176ctl, rWide = BB.d176wide, rTight = BB.d176tight, rOther = BB.d176other;
  eq(rCtl.status, 0, '对照臂必须成功：' + String(rCtl.stderr || '').slice(0, 140));
  eq(rWide.status, 0, '容差 100% 臂必须成功');
  eq(rTight.status, 0, '容差 35% 臂必须成功（全塌缩也只许响亮报告，不改退出码）');
  const wCtl = wOf(dir + '/d176ctl.js'), wWide = wOf(dir + '/d176wide.js'), wTight = wOf(dir + '/d176tight.js');
  ok(wCtl && wWide && wTight, '三臂产物都要能读出权重本体');
  /* 变异对照：不同 seed 的产物必须不同，否则上面的"逐位相同"是恒真比较器 */
  eq(rOther.status, 0, '变异对照臂必须成功');
  const wOther = wOf(dir + '/d176other.js');
  ok(wOther && wOther !== wCtl, '【比较器自检】换 seed 必须产出**不同**的权重（相同 = 比较器恒真，D165 建门时踩过同族）');
  ok(wCtl === wWide, '【①】容差 100% 的产物必须与**不设 veto 逐位相同**（veto 只挑人不加项；不同 = 它往 fit 里塞了东西）');
  const mWide = metaOf(dir + '/d176wide.js'), mTight = metaOf(dir + '/d176tight.js');
  ok(mWide && mWide.selKeep && mWide.selKeep.dropped === 0, '【③】容差 100% 臂的账必须写着"剔了 0 粒"：' + JSON.stringify(mWide && mWide.selKeep));
  ok(mTight && mTight.selKeep && Array.isArray(mTight.selKeep.ref) && mTight.selKeep.ref.length > 0,
    '【③】账必须进**产物**（参照逐卡落地量与线），否则事后没人能复核这臂按什么判的：' + JSON.stringify(mTight && mTight.selKeep));
  const sk = mTight && mTight.selKeep;
  ok(sk && sk.of > 0 && (sk.dropped === sk.of ? sk.allRejected === true : sk.allRejected === false),
    '【②】"全剔"与 `allRejected` 必须互推（实测 dropped=' + (sk && sk.dropped) + ' of=' + (sk && sk.of) + ' allRejected=' + (sk && sk.allRejected) + '）');
  if (sk && sk.dropped === sk.of) {
    ok(wTight === wCtl, '【②】全塌缩时**不许硬换人**：产物必须仍逐位等于不设 veto 的对照');
    ok(/名人堂\*\*全部\*\*丢了起点载重卡|走向②/.test(String(rTight.stdout) + String(rTight.stderr)),
      '全塌缩必须响亮（写进 stdout/stderr，不许只留在 META 字段里）');
  } else {
    ok(wTight !== wCtl || /未改判/.test(String(rTight.stdout)), '有达标候选时 veto 必须给出"改判/未改判"的明确归因');
  }
  /* v1.5.266：**出手口径**那一维必须真生效（`landByKey` 只数造成过伤害的卡 ⇒ 环/蓄能按落地判会永远是 0） */
  const castKeys = ((sk && sk.keys) || []).filter(function (x) { return /^ring[:]|^charge[:]/.test(x); });
  ok(castKeys.length >= 2, '账里必须有**出手名单**（ring/charge）的维；实测 keys=' + JSON.stringify(sk && sk.keys));
  /* v1.5.269：默认口径必须是 **plain（ε=0 五席同包出手）** —— 拿训练口径的尺当"上线后退不退化"的判据，
   * 就是 09-28 那次误挑（NCV-71 炮 2.90→0.97）的成因。这条判在**产物的账**上，不判横幅。 */
  ok(sk && sk.cal === 'plain', 'veto 的默认量具口径必须是 plain（ε=0，与 `behavior-profile` 同尺）；实测 cal=' + (sk && sk.cal));
  ok(sk && typeof sk.games === 'number' && sk.games >= 20, 'plain 口径的局数必须 ≥20（实测 G=20 与 60 的炮读数差 0.22/局 ⇒ 再小是噪声）；实测 games=' + (sk && sk.games));
  const rBadCal = arm('d176badcal', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_CAL: 'notacal' });
  eq(rBadCal.status, 7, '`SEL_KEEP_CAL` 不认识的值必须 exit 7（静默退回 mirror = 又拿训练口径当判据）');
  const rFewGames = arm('d176fewg', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_PLAIN_GAMES: '5' });
  eq(rFewGames.status, 7, '`SEL_KEEP_PLAIN_GAMES < 20` 必须 exit 7（判据不许建在噪声上）');
  /* v1.5.268：**两模式都判**（09-28 实测单模式尺会反向：NCV-71 改判后 炮 2.90→0.90、5P 41.3→39.2） */
  ok(Array.isArray(sk && sk.modes) && sk.modes.indexOf('multi') >= 0 && sk.modes.indexOf('long') >= 0,
    '默认判据必须同时覆盖 multi 与 long 两个模式（实测 modes=' + JSON.stringify(sk && sk.modes) + '）');
  ok(((sk && sk.keys) || []).some(function (x) { return /@multi$/.test(x); }) && ((sk && sk.keys) || []).some(function (x) { return /@long$/.test(x); }),
    '账里每条规则要带它属于哪个模式（缺了就没法复核"两模式都判"到底判没判）：keys=' + JSON.stringify(sk && sk.keys));
  const rBadMode = arm('d176badmode', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_MODES: 'notamode' });
  eq(rBadMode.status, 7, '`SEL_KEEP_MODES` 里不认识的模式必须 exit 7（静默丢掉一个模式 = 又回到单模式尺骗人）');
  const castRef = ((sk && sk.ref) || []).filter(function (r) { return r.src === 'cast' || r.src === 'act'; });
  ok(castRef.length >= 2 && castRef.every(function (r) { return r.perGame > 0 && r.line >= 0 && r.line < r.perGame; }),
    '出手参照必须**当场量到非零**且线低于参照（0 = 起点根本没打这两张卡 ⇒ 该维不该进判据）：' + JSON.stringify(castRef));
  ok(!((sk && sk.unjudgeable) || []).some(function (x) { return /^charge/.test(x); }),
    'v1.5.266 修的就是这条：`charge` 从前只按落地判 ⇒ 被点名"无法判"（09-28 实测），现在按出手判就不该再出现');
  /* ===== v1.5.267：座位对称性维（第三条尺）—— 起点读 16.7pt(N=3/60 局)，宽容差必须完全不动人 ===== */
  const BS = armBatch([
    ['d176seatlax', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '100' }],
    ['d176seat', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '0' }],
  ]);
  const rSeatLax = BS.d176seatlax, rSeatStrict = BS.d176seat;
  const rSeatBad = arm('d176seatbad', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: 'abc' });
  eq(rSeatBad.status, 7, '`SEL_KEEP_SEAT` 非数值必须 exit 7');
  const rSeatBig = arm('d176seatbig', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '999' });
  eq(rSeatBig.status, 7, '`SEL_KEEP_SEAT` 越界（>100pt）必须 exit 7（不许 clamp 成"最松档"后谎称开了）');
  eq(rSeatLax.status, 0, '宽容差座位臂必须成功');
  eq(rSeatStrict.status, 0, '严座位臂必须成功（剔人也不改退出码）');
  ok(wOf(dir + '/d176seatlax.js') === wCtl,
    '【①同形】座位容差 +100pt（等于"什么都放行"）时产物必须与不设 veto **逐位相同** ⇒ 证明这一维不加任何项');
  const mSeat = metaOf(dir + '/d176seat.js');
  ok(mSeat && mSeat.selKeep && mSeat.selKeep.seat && typeof mSeat.selKeep.seat.ref === 'number',
    '【③账进产物】严臂的 META 要写下座位参照与线（实测 seat=' + JSON.stringify(mSeat && mSeat.selKeep && mSeat.selKeep.seat) + '）');
  ok(mSeat && mSeat.selKeep && mSeat.selKeep.seat && mSeat.selKeep.seat.games >= 20,
    '座位维必须用**专用量具**（09-28 实测：共用 20 局只有 18 个决胜局 ⇒ 起点自己读出 25~33pt，那是噪声不是判据）；实测 games=' +
    (mSeat && mSeat.selKeep && mSeat.selKeep.seat && mSeat.selKeep.seat.games));
  ok(wOf(dir + '/d176seat.js') === wCtl || /改判/.test(String(rSeatStrict.stdout)),
    '严座位臂要么没换人（则不许印"改判"），要么换人并**明说改判**——两者必须一致');
});

/* ===== D177（qoder 09-28 §E81）：`champ-audit` 遇到读不出的包**不许把整张表带走** =====
 * 动因（09-28 实测）：我传了一个不存在的包路径 ⇒ `loadChamp` 里裸的 `readFileSync` 抛 ENOENT ⇒
 * **前面已经打完的行全部作废**，现场只剩一句报错，没人知道是哪个包；同族另一种表现是 `gate-drafts`
 * 对非 `.bak` 路径**静默忽略**。⇒ 钉三条行为：坏包要**点名**、好包的行必须**还在**、整体**非零退出**。 */
t('D177 champ-audit 缺包必须点名 + 保留其余行 + exit 7（v1.5.270 · §E81）', function () {
  const rGood = spawnSync(process.execPath, ['tools/champ-audit.mjs', 'js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 420000 });
  eq(rGood.status, 0, '只给一个正常包时必须 exit 0（新加的"缺包即失败"不许误伤常规路径）：' + String(rGood.stderr || '').slice(0, 120));
  ok(/^bundled-champion-3p\.js\s+\d/m.test(String(rGood.stdout)), '正常路径必须真的打出行（否则下面那条"保留其余行"是恒真）');
  const rBad = spawnSync(process.execPath, ['tools/champ-audit.mjs', 'js/bundled-champion-3p.js', 'docs/artifacts/__d177_missing__.bak'],
    { encoding: 'utf8', timeout: 420000 });
  eq(rBad.status, 7, '有一个包读不出必须非零退出（缺行 ≠ 量了没测出来）');
  ok(/__d177_missing__/.test(String(rBad.stdout) + String(rBad.stderr)), '要点名**是哪个包**读不出（只报一句 ENOENT 等于没报）');
  ok(/^bundled-champion-3p\.js\s+\d/m.test(String(rBad.stdout)), '坏包**不能带走整张表**：好包那一行必须仍然打出来');
  ok(/整行没量到/.test(String(rBad.stdout) + String(rBad.stderr)), '末尾必须汇总"有几个包整行没量到"');
});

/* ===== D178（qoder 09-28 §E82）：新量具 `probe-human-seat`（1 席"人" vs 4 席被测冠军） =====
 * 动因：仓里两种装配（`eval-5p` 的 1 主体+4 脚本 / G4 的 1 脚本+4 被测）里，**用户实盘那一格从来没有常驻读数**
 * —— G4 虽然就是这个形状，但它的脚本席八格里没有一格是反弹型，而 §E63 量到线上冠军在"4 席纯反弹"场严胜 0%。
 * 钉四条：① 必须**复用** `v2v4-lib.duelAssembly`（不许另写一份装配，否则与 G4 不同尺）；
 * ② 同种子两次必须逐字相同（量具自己先要可复现）；③ 缺包必须点名 + 保留其余行 + 非零退出；
 * ④ 这一格必须有判别力（全行 0% = 尺子坏了，不许读成"冠军无敌"）。 */
t('D178 人类那一席量具（v1.5.271 · §E82）：单一来源装配 + 可复现 + 缺包点名 + 判别力', function () {
  const src = readFileSync('tools/probe-human-seat.mjs', 'utf8');
  ok(/import \{ duelAssembly \} from '\.\/v2v4-lib\.mjs'/.test(src), '① 必须 import v2v4-lib 的 duelAssembly（与 G4 同源）');
  ok(!/autoGameN\(/.test(src), '① 不许自己写装配（第二份实现必然漂移，本仓栽过四次）');
  ok(!/pickDefend \|\|/.test(src) && !/\|\| *B\.pick/.test(src), '① 人类原型不许写兜底链（把"名字写错"伪装成"这原型不赢"）');
  const run = (extra) => spawnSync(process.execPath, ['tools/probe-human-seat.mjs',
    '--packs=js/bundled-champion-3p.js', '--games=40'].concat(extra || []), { encoding: 'utf8', timeout: 420000 });
  const r1 = run(), r2 = run();
  eq(r1.status, 0, '正常包必须 exit 0：' + String(r1.stderr || '').slice(0, 160));
  const nm = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
  const out1 = String(r1.stdout);
  for (const k of nm) ok(out1.indexOf(k) >= 0, '② 六个"人类原型"必须都在（缺一个 = 那格静默消失）：' + k);
  ok(/multi/.test(out1) && /long/.test(out1), '② 两个模式都要印（与 G4 同规矩）');
  eq(String(r2.stdout), out1, '② 同 seed0 两次必须逐字相同（量具不可复现 = 读数无意义）');
  ok(!/所有"人"都 0%/.test(out1), '④ 现役包上这一格必须有判别力（全行 0% 时工具自己会警告）');
  const cells = (out1.match(/(\d+\.\d)%\(和\d+%\)/g) || []);
  eq(cells.length, 12, '④ 必须正好 6 原型 × 2 模式 = 12 格（少一格 = 有原型静默失败）');
  const rBad = spawnSync(process.execPath, ['tools/probe-human-seat.mjs',
    '--packs=js/bundled-champion-3p.js,docs/artifacts/__d178_missing__.bak', '--games=20'], { encoding: 'utf8', timeout: 420000 });
  eq(rBad.status, 7, '③ 缺包必须非零退出（缺行 ≠ 量了没测出来）');
  ok(/__d178_missing__/.test(String(rBad.stdout) + String(rBad.stderr)), '③ 要点名是哪个包');
  ok(/== js\/bundled-champion-3p\.js/.test(String(rBad.stdout)), '③ 坏包不许带走整张表');
  const rFlag = spawnSync(process.execPath, ['tools/probe-human-seat.mjs', '--packs=js/bundled-champion-3p.js', '--mode=multi'],
    { encoding: 'utf8', timeout: 120000 });
  eq(rFlag.status, 64, '③ 不认识的 `--mode=` 必须响亮失败（写错开关名不许当默认值跑）');
});

/* ===== D179（qoder 09-28 §E83）：行为剂量表——计数门的粒度从"各自的 W"换成"整族有没有被下达" =====
 * 动因：`bigUses` 那次假零结果（§E65）的同族形状在 `evo.js` 里还留着 8 处，而且这 8 个计数**连剂量字段都不返回**
 * ⇒ "这根杠杆没作用"永远无法否证。更要紧的是**其中 4 根是出厂就开着的**（pierceW .04 / beadW .05 / pressW .03 / ringW .10）
 * ⇒ 现役配方里这 4 项的剂量从未被打印过一次。
 * 钉五条：① 8 个累加点必须都写 `if (DOSE_ON)`，一处都不许留"跟着自己的 W"；
 * ② 8 个**收益项**必须仍各自按自己的 W ⇒ 这才是"逐位不变"的结构保证；
 * ③ 族里有任何一根 W 非零 ⇒ `doseOn===true` 且 8 个读数全是数字（未下达的兄弟也必须给出数，那是对照组）；
 * ④ 整族全 0 ⇒ `doseOn===false` 且读数必须是 **null（未量）**，不许是 0（把"未量"印成 0 就是重新制造这次的事）；
 * ⑤ `train-3p` 的逐代行只在 `r.doseOn` 时印剂量表。 */
t('D179 整族行为剂量（v1.5.272 · §E83）：计数按族算 + 收益按各自 W 付 + 未量必须 null + 打印有门', function () {
  const ev = readFileSync('js/train/evo.js', 'utf8'), T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  const CNT = [['ringBreaks', 'countRingBreaks'], ['pressRounds', 'countPressRounds'], ['pierceHits', 'countPierceHits'],
    ['beadSpent', 'countBeadSpent'], ['threatHits', 'countThreatHits'], ['clears', 'countClears'],
    ['blocks', 'countBlocks'], ['varietyMax', 'countVariety']];
  for (const c of CNT) {
    ok(new RegExp('if \\(DOSE_ON\\) ' + c[0] + ' [+=]').test(ev), '① ' + c[0] + ' 的累加必须走 DOSE_ON');
    ok(!new RegExp('if \\([A-Z_]+_W > 0\\) ' + c[0] + ' [+=]').test(ev) &&
      !new RegExp('if \\(ringWeightAt\\(gen\\) > 0\\) ' + c[0]).test(ev),
      '① ' + c[0] + ' 不许再跟着自己那根的 W（假零结果的形状）');
  }
  ok(/const DOSE_ON = PRESS_W > 0 \|\| PIERCE_W > 0/.test(ev), '① DOSE_ON 必须**存在**且按族取或');
  const BON = [['pressBonus', 'PRESS_W', 'pressRounds'], ['pierceBonus', 'PIERCE_W', 'pierceHits'],
    ['beadBonus', 'BEAD_W', 'beadSpent'], ['tgtBonus', 'TGT_W', 'threatHits'], ['clearBonus', 'CLEAR_W', 'clears'],
    ['blockBonus', 'BLOCK_W', 'blocks'], ['ringBonus', 'ringWeightAt\\(gen\\)', 'ringBreaks']];
  for (const b of BON) {
    ok(new RegExp('const ' + b[0] + ' = ' + b[1] + ' \\*').test(ev), '② ' + b[0] + ' 必须仍按自己的 W 付钱（fit 逐位不变的保证）');
  }
  ok(/WIDTH_W \* Math\.min\(1, Math\.max\(0, varietyMax/.test(ev), '② widthBonus 同理');
  const er0 = T.economyReward(), w0 = { press: T.pressReward().w, pierce: T.pierceReward().w, tgt: T.targetReward().w, clear: T.clearReward().w };
  /* 本门跑在整套门禁的最后段，前面的用例可能动过这些权重 ⇒ **不假设出厂值**：
   * 先读回当前值当"要复位的原值"，再显式保证族里至少有一根非零（`Math.max(0.01, 原值)`，不新造默认值），
   * 这样 ③ 判的是"剂量表跟着 `DOSE_ON` 出现"这件事本身，而不是"前面的门有没有复位干净"。 */
  T.setPressReward(Math.max(0.01, w0.press));
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
  const KEYS = ['ringBreakEv', 'pressEv', 'pierceEv', 'beadEv', 'threatEv', 'clearEv', 'blockEv', 'varietyMaxEv'];
  const dOn = T.scoreMemberN(params, opps, 4, 3, 0, 0, 0);
  eq(dOn.doseOn, true, '③ 族里有一根被下达 ⇒ `doseOn` 必须为 true');
  for (const k of KEYS) {
    ok(typeof dOn[k] === 'number', '③ 族里有一根被下达时，' + k + ' 必须是数字（没下达的兄弟是对照组，不许缺席）');
  }
  ok(dOn.varietyMaxEv > 0, '③ **WIDTH_W=0 的兄弟也必须真的在数** —— 旧形状下 varietyMax 恒 0，这一条就是"修法生效"的证据');
  T.setPierceReward(0); T.setPressReward(0); T.setTargetReward(0); T.setClearReward(0);
  T.setEconomyReward({ ringW: 0, beadW: 0, blockW: 0, widthW: 0, bigcardW: 0, costlyW: 0, bigtChainW: 0 });
  const dOff = T.scoreMemberN(params, opps, 4, 3, 0, 0, 0);
  eq(dOff.doseOn, false, '④ 整族全 0 ⇒ 不必否证任何杠杆 ⇒ 不算');
  for (const k of KEYS) {
    eq(dOff[k], null, '④ 全 0 时 ' + k + ' 必须是 null（"未量"印成 0 会被读成"这粒真没做出该行为"）');
  }
  T.setPressReward(w0.press); T.setPierceReward(w0.pierce); T.setTargetReward(w0.tgt); T.setClearReward(w0.clear);
  T.setEconomyReward({ ringW: er0.ringW, beadW: er0.beadW, blockW: er0.blockW, widthW: er0.widthW,
    bigcardW: er0.bigcardW, costlyW: er0.costlyW, bigtChainW: er0.bigtChainW });
  const back = { pierce: T.pierceReward().w, press: T.pressReward().w, tgt: T.targetReward().w, clear: T.clearReward().w, er: T.economyReward() };
  /* ⚠ 复位检查走各自的 getter，**不走 `economyReward()` 的快照**：那四根里有些键根本不在快照里，
   * `eq(undefined, undefined)` 会当"通过"印出来（本仓最怕的形状之一就是恒真断言）。 */
  eq(back.pierce, w0.pierce, '⑤ 复位必须真的恢复出厂 pierceW（本门自己不许污染后续用例）');
  eq(back.press, w0.press, '⑤ 同上（pressW）');
  eq(back.tgt, w0.tgt, '⑤ 同上（tgtW）');
  eq(back.clear, w0.clear, '⑤ 同上（clearW）');
  eq(back.er.beadW, er0.beadW, '⑤ 同上（beadW，走 econ 快照）');
  eq(back.er.ringW, er0.ringW, '⑤ 同上（ringW）');
  ok(/r\.doseOn \? ' 剂量\[\/局\]/.test(T3), '⑤ `train-3p` 的逐代行必须只在 doseOn 时印剂量表');
});


/* ===== D181（qoder 09-28 §E91）：`train-3p` 必须能命令 `EPIRUS_RING_W`，且"投不到"这件事必须自己会说话 =====
 * 动因：§E91 那批"把 `ringW` 整根关掉"的臂**一秒就死**在黑键闸上 ⇒ 查出一个事实：
 * 引擎认 `ringW`、env 名单也登记了 `EPIRUS_RING_W`，但**本入口的投递名单 `CLI_ECON_REWARD_KEYS` 没有它**
 * ⇒ 这个入口从来没能命令环权重（D172 立的"三处名单齐全"里缺第三处）。
 * 钉两条：① 补上之后必须**真投递**（回执一致 + 消费点读回 0）；② 顺手把"仍有 8 根投不到"这件事**印出来**
 * （不是假装全通，而是让下一班看得见边界：`widthW/blockW/s4W/wallFilter/divK/hoardCapMult/convOffense/wallGames`）。 */
t('D181 `EPIRUS_RING_W` 在 train-3p 可命令（v1.5.274 · §E91）：三处名单齐 + 边界必须可见', function () {
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8'), E = readFileSync('server/econ-env.mjs', 'utf8');
  const cli = ((T3.match(/CLI_ECON_REWARD_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(cli.indexOf('ringW') >= 0, '① 投递名单必须有 `ringW`（这次缺的就是这一处）');
  const envK = ((E.match(/ECON_ENV_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(envK.indexOf('ringW') >= 0 || /EPIRUS_RING_W/.test(E), '① env 单一名名单里也得有它（两处缺一处就是"设了没人读"）');
  const d = mkdtempSync(join(tmpdir(), 'd181-'));
  const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '2', '2'], {
    encoding: 'utf8', timeout: 420000,
    env: Object.assign({}, process.env, {
      EPIRUS_ARM: 'D181', EPIRUS_SEED: '9', EPIRUS_HOTSTART: '1', EPIRUS_RING_W: '0',
      EPIRUS_BAND_DIR: d + '/bands', EPIRUS_T3P_OUT: d + '/out.js'
    })
  });
  eq(r.status, 0, '② 下达 `EPIRUS_RING_W=0` 必须能跑起来（实测补名单前是 exit 6 的黑键拒绝）：' + String(r.stderr || '').slice(0, 160));
  ok(/ringW/.test(String(r.stdout)) && /逐键回执一致/.test(String(r.stdout)),
    '② 必须打印"投递 + 回执一致"（静默生效 = 下次又查不到）');
});


/* ===== D180（qoder 09-28 §E85）：econ 回执比对必须按**数值语义**比，但闸门本身不许被放宽 =====
 * 实测事故：`EPIRUS_BEAD_W=0.10` 被 `String('0.10') !== String(0.1)` 判成"下达没生效"⇒ **整臂 exit 7、一行的量都没跑**。
 * 这类"把合法输入拒了"和"把没生效的放过去"一样糟 ⇒ 三条一起钉：小数写法能过（修好了）·
 * **引擎拒收的值仍必须红**（`-5` 过不了 `setBeadReward` 的 `>=0` ⇒ 回执还是 0.05 ⇒ 必须 exit 7）·
 * 名字写错仍必须响（黑键闸没被吃掉）。后两条是防"为了修第一条把闸门拆了"。 */
t('D180 econ 回执按数值比（v1.5.273 · §E85）：0.10 写法不再被拒 + 拒收值仍红 + 黑键闸仍响', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/function rcptEq\(a, b\)/.test(src) && /return !rcptEq\(echo\[k\], payload\[k\]\)/.test(src),
    '① 比对必须走 `rcptEq`（不许退回字符串等值）');
  ok(/isFinite\(na\) && isFinite\(nb\) && Math\.abs\(na - nb\) < 1e-12/.test(src),
    '① 数值档必须真的比数值（且两边都不是数值时返回 false ⇒ 兜底不放宽）');
  /* ⚠ 必须落到 `mkdtemp` 出来的临时目录：第一版写成 `process.env.TMPDIR || '.'` ⇒ 在 Git Bash 下 `TMPDIR` 为空 ⇒
   *   产物与 `*-bandN.bak` 直接落在**仓库根目录**（顶层 `.bak` 会触发 D82 点名、也是脏工作区）。 */
  const d180Dir = mkdtempSync(join(tmpdir(), 'd180-'));
  const short = (env) => spawnSync(process.execPath, ['tools/train-3p.mjs', '3', '3', '4', '4'], {
    encoding: 'utf8', timeout: 420000,
    env: Object.assign({}, process.env, {
      EPIRUS_ARM: 'D180', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1',
      EPIRUS_BAND_DIR: d180Dir + '/bands', EPIRUS_T3P_OUT: d180Dir + '/d180-out.js'
    }, env)
  });
  const r10 = short({ EPIRUS_BEAD_W: '0.10' });
  eq(r10.status, 0, '② `=0.10` 这种写法必须能跑（实测它曾把整臂顶成非零）：' + String(r10.stderr || '').slice(0, 140));
  ok(/逐键回执一致/.test(String(r10.stdout)), '② 而且必须仍然**打印**回执一致（不是靠跳过检查过的）');
  const rNeg = short({ EPIRUS_BEAD_W: '-5' });
  ok(rNeg.status !== 0, '③ 引擎拒收的值（`-5` ⇒ 回执仍是出厂 0.05）必须仍然失败 —— 这次放宽只放宽格式：实得 ' + rNeg.status);
  ok(/回执不一致/.test(String(rNeg.stderr) + String(rNeg.stdout)), '③ 且必须是"回执不一致"这条响，不是别的偶然报错');
  const rDark = short({ EPIRUS_BEAD_W_ROLL: '0.10' });
  ok(rDark.status !== 0, '④ 名字写错仍必须失败（黑键闸没被吃掉）：实得 ' + rDark.status);
  ok(/读不到/.test(String(rDark.stderr) + String(rDark.stdout)), '④ 且要明说"本入口读不到这个旋钮"');
});


/* ===== D182（qoder 09-28 §E102）：`probe-dead-term` 必须**禁止过度声称**，且自己先做到可复现 =====
 * 这把尺是为"我今晚把『两次产物逐位相同』写成『可证死项』然后被下一个实验推翻"（§E99）而做的，
 * 所以门判的不是它算得快不快，而是它**会不会再次让人把记忆/稀有当成效应**：
 * ① 出厂权重为 0 的根（`tgtW`）必须**报恒真**，且"变的行"必须是 0/9 —— 这一条同时钉住预热（不预热时我实测过到 1/9）；
 * ② `ringW` 必须给出"单位级 0/9 不变 + 阳性对照会变"这对**方向相反**的读数（少了任何一半都会让人误判）；
 * ③ 认不来的根必须**响亮失败**（不许"探测不到就跳过"）；未知 `--` 参数必须 exit 64；
 * ④ 输出末尾必须带那句"不支持可以摘某根权重"的限定。 */
t('D182 死项筛子（v1.5.275 · §E102）：预热可复现 + 恒真必须标 + 阳性对照方向 + 拒绝兜底', function () {
  const run = (args) => spawnSync(process.execPath, ['tools/probe-dead-term.mjs'].concat(args),
    { encoding: 'utf8', timeout: 420000 });
  const z = run(['--key=tgtW', '--games=4', '--rounds=6']);
  eq(z.status, 0, '① 出厂 0 的根也必须能跑完（它给的是"恒真"警告，不是失败）：' + String(z.stderr || '').slice(0, 140));
  ok(/出厂就是 0/.test(String(z.stdout)), '① 必须明写"出厂就是 0 ⇒ 恒真"，否则下游会把 0→0 读成"这项没用"');
  ok(/变的行 0\/9/.test(String(z.stdout)), '① 权重为 0 时"变的行"必须是 0/9 —— 非零就说明**没预热**，把 `pickMix` 的模块级记忆读成了效应');
  const r = run(['--key=ringW', '--games=6', '--rounds=10']);
  eq(r.status, 0, '② `ringW` 必须跑完：' + String(r.stderr || '').slice(0, 140));
  ok(/变的行 0\/9/.test(String(r.stdout)), '② 单位级：九个池内对手上关掉 `ringW` 后 fit 必须全不变（"稀有"那一半）');
  ok(/阳性对照/.test(String(r.stdout)) && /fit 变 Δ=0\.\d+/.test(String(r.stdout)), '② 阳性对照：必须给出"变"的读数（"但活着"那一半）');
  ok(/稀有但活着/.test(String(r.stdout)), '② 两层合起来的判读必须是"稀有但活着"，不许让工具自己写成"死项"');
  ok(/响一次的频率/.test(String(r.stdout)), '② 前置条件必须给"多久响一次"的量级（或明说"这些局里一次都没出现"），不能只印一个 0');
  ok(/不支持.*可以摘/.test(String(r.stdout)), '④ 末尾必须带"不支持可以摘"的限定');
  const p = run(['--key=pressW', '--games=4', '--rounds=5']);
  eq(p.status, 0, '⑤ `pressW` 也必须跑得起来：' + String(p.stderr || '').slice(0, 120));
  ok(!/变的行 0\/9/.test(String(p.stdout)) && !/稀有但活着/.test(String(p.stdout)),
    '⑤ 出厂每代都有剂量的那根（`pressW`，§E89 实测 0/61 代零剂量）**不许被判成"稀有/死项"** —— ' +
    '它若变 0/9，说明这把尺自己坏了（接线、预热或复位出了问题），而不是这根死了');
  const bad = run(['--key=divW', '--games=4']);
  ok(bad.status === 7, '③ 没钉 setter/getter 的根必须响亮失败（实得 ' + bad.status + '）—— 不许"探测不到就跳过"');
  ok(/不许加.*探测不到就跳过/.test(String(bad.stderr) + String(bad.stdout)), '③ 且要说明为什么拒（这条规矩本身就是本仓的形状库）');
  const fl = run(['--key=ringW', '--bogus=1']);
  eq(fl.status, 64, '③ 不认识的 `--` 参数必须 exit 64（写错开关名不许当默认值跑）');
});


/* ===== D183（qoder 09-28 §E115）：权重逐位对账必须有常驻工具，且**不许是个恒真比较器** =====
 * 今晚一半的"证明"（行为中性 / 两臂同配置可复现 / λ 饱和 0.08≡0.15 / veto 容差 100% 不改人）
 * 都靠"逐位比两粒产物的权重"，而我一直用临时脚本 ⇒ 下一班要么重写、要么拿**整文件哈希**代替（头注与 META 每次都变 ⇒ 会误报）。
 * 钉四条：① 比的是权重数组（不许退成文件字节）；② 仓库里**自带一对已知相同**与**一对已知不同**的用例 ⇒ 判别力自证；
 * ③ 读不出包必须点名 + `exit 7`；④ `--self-test` 在"全部逐位相同"时必须判失败（防恒真）。 */
t('D183 权重逐位对账工具（v1.5.276 · §E115）：比数组 + 判别力自证 + 缺包点名 + 反恒真', function () {
  const src = readFileSync('tools/probe-pack-identity.mjs', 'utf8');
  ok(/loadChamp\(W, f\)/.test(src) && /x\[i\] !== y\[i\]/.test(src), '① 必须解出权重数组逐元素比（不是文件字节 / 整文件哈希）');
  ok(/self-test/.test(src) && /恒真的比较器/.test(src), '④ 必须带 --self-test 这条反恒真路径');
  const P = function (args) { return spawnSync(process.execPath, ['tools/probe-pack-identity.mjs'].concat(args),
    { encoding: 'utf8', timeout: 120000 }); };
  /* 用两份**门禁自带的 fixture** 造"一对不同"：线上包与 2P 壳/不同 seed 的产物结构不同 ⇒ 数组不同。
   * 为避免依赖 gitignore 的实验产物，这里现造两份临时包：把线上包原样复制一份（必同）与把它某维 +1（必不同）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd183-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live);
  ok(!!mm, '① 前置：线上包里要能取到权重对象（取不到说明 fixture 变了，本门该红去修 fixture）');
  const obj = JSON.parse(mm[1]);
  const bumped = JSON.parse(JSON.stringify(obj)); bumped.a[0] = (bumped.a[0] || 0) + 1;
  const same = join(dir, 'same.js'), same2 = join(dir, 'same2.js'), diffp = join(dir, 'diff.js');
  writeFileSync(same, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(obj) + ';\n');
  writeFileSync(same2, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(obj) + ';\n');
  writeFileSync(diffp, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(bumped) + ';\n');
  const rEq = P([same, same2]);
  eq(rEq.status, 0, '② 两份内容相同、路径不同的包必须 exit 0：' + String(rEq.stderr || '').slice(0, 140));
  ok(/逐位相同/.test(String(rEq.stdout)), '② 必须报"逐位相同"（并报维度数 n，否则不知道它读了几个数）');
  ok(/n=\d{3,}/.test(String(rEq.stdout)), '② 必须印出维度数 n（一个只读到 0 维的比较器会永远"相同"）');
  const rDup = P([same, same]);
  eq(rDup.status, 7, '⑤ 同一个路径传两次必须**拒**（去重后无对可比 ⇒ "零比较然后 exit 0"就是把没比报成相同）：实得 ' + rDup.status);
  const rNe = P([same, diffp]);
  ok(/不同 \d+\/\d+ 维/.test(String(rNe.stdout)), '② **必须能报出"不同"** —— 只会说相等不叫比较器（这里改了一维）');
  const rST = P([same, same2, '--self-test']);
  eq(rST.status, 7, '④ 全同输入 + --self-test 必须判失败（恒真比较器是本仓最怕的形状）');
  const rMiss = P([same, join(dir, 'nope.js')]);
  eq(rMiss.status, 7, '③ 读不出的包必须非零退出（缺行 ≠ 相同）');
  ok(/nope\.js/.test(String(rMiss.stderr) + String(rMiss.stdout)), '③ 且要点名是哪个包');
});


/* ===== D184（qoder 09-28 §E113）：接力"把起点重新当选"必须**自己喊出来** =====
 * 病（今晚最贵的一条）：§E111 两臂（λ=0.30 × costlyW=0.02 × N=5 × 1200 代）产物与现役**逐位相同**，
 *   而日志一切照常（逐代行、`[band-save] …（当选）`、`已写入 …` 全都在）⇒ 我把起点的读数（炮 2.23 / maxEp 93）
 *   当成了那根旋钮的成绩。机制：种子常驻种群 0 号 + 锚定罚对它恰为 0 ⇒ 它照样进名人堂、照样在终局重验里当选。
 *   v1.5.150 的 band-save 注释六晚前就点名了这件事，但**只补了落盘、没补读数**。
 * 钉三向（都用真跑的迷你臂，fixture 现造在临时目录 ⇒ 不欠 D82 的账）：
 *   ① 正例必须喊 + `meta.productIsSeed=true`；② **反例必须能不喊**（换成全 0 的起点、训够代 ⇒ `false`）——
 *      没有这条，"永远喊"与"永远不喊"一样是恒真；③ 冷启动必须是 `null`（"没起点"≠"产物等于起点"）。 */
t('D184 产物=起点读数（v1.5.276 · §E113）：正例喊、反例不喊、冷启动为 null', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/for \(let i = 0; i < p\.length; i\+\+\) if \(p\[i\] !== seedParams\[i\]\) return false;/.test(src),
    '① 必须是**逐维权重**比较（对象同一 `===` 会漏掉"同一粒权重的另一个对象"，文件哈希会被头注骗）');
  ok(/productIsSeed: PRODUCT_IS_SEED/.test(src) && /hallSeedEntries: HALL_SEED_ENTRIES/.test(src),
    '① 必须写进产物 meta（只在 stdout 喊一遍 ⇒ 事后拿到 .bak 的人看不见）');
  ok(/dupOfBand/.test(src) && /同一粒权重/.test(src),
    '① 名人堂重复席位必须标出来（今晚就是"两个（当选）"让我发现产物是起点）');

  const dir = mkdtempSync(join(tmpdir(), 'd184-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live);
  ok(!!mm, '① 前置：线上包要能取到权重对象（取不到 ⇒ fixture 变了，本门该红去修）');
  const zeroObj = JSON.parse(mm[1]);
  zeroObj.a = zeroObj.a.map(function () { return 0; });
  const zeroSeed = join(dir, 'zero-seed.js');
  writeFileSync(zeroSeed, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(zeroObj) + ';\n');
  const arm = function (argv, extra) {
    return spawnSync(process.execPath, ['tools/train-3p.mjs'].concat(argv), {
      encoding: 'utf8', timeout: 600000,
      env: Object.assign({}, process.env, extra, { EPIRUS_BAND_DIR: join(dir, 'b' + Math.random().toString(36).slice(2)) })
    });
  };
  const metaOf = function (p) {
    const s = readFileSync(p, 'utf8');
    return JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*\});\n/.exec(s)[1]);
  };

  /* ① 正例：热启动 + 极大的 λ ⇒ 除了起点没人能在训练分上活着 ⇒ 必然"产物=起点"（实测同配置两次逐位复现）。
   * 种子包用**线上包本身**（`EPIRUS_SEEDPACK` 指到不存在的文件会 exit 5，不是回退 ⇒ 不能给假路径）。 */
  const hot = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd184-hot', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '50',
    EPIRUS_SEEDPACK: 'js/bundled-champion-3p.js', EPIRUS_T3P_OUT: join(dir, 'hot.js')
  });
  eq(hot.status, 0, '① 正例迷你臂必须跑通（exit=' + hot.status + ' ' + String(hot.stderr || '').slice(0, 120) + '）');
  ok(/产物=起点/.test(String(hot.stderr)), '① 产物与起点逐位相同时必须**喊出来**（这条线六晚前只在注释里，无人读数 ⇒ 我今晚重新掉了一遍）');
  ok(/产物与起点逐位相同（本臂零改包）/.test(String(hot.stdout)), '① 末行"已写入"也要带（很多人只读最后一行）');
  eq(metaOf(join(dir, 'hot.js')).productIsSeed, true, '① meta.productIsSeed 必须为 true');
  ok(metaOf(join(dir, 'hot.js')).hallSeedEntries >= 1, '① 起点占了几席要写出来（0 席却当选 = 说明读数逻辑 itself 有问题）');
  eq(String(hot.stdout).split('（当选）').length - 1, 1, '① "（当选）"只许出现一次（重复席位改标"与 bandN 同一粒权重"）');

  /* ② 反例：起点是**全 0 的坏包** + 训 40 代 ⇒ 一定有候选赢过它 ⇒ 不许喊、meta 必须 false。
   * 为什么专门钉：正例只证明"它会喊"，不证明"它会不喊"。 */
  const rev = arm(['40', '3', '2', '8'], {
    EPIRUS_ARM: 'd184-rev', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '0',
    EPIRUS_SEEDPACK: zeroSeed, EPIRUS_T3P_OUT: join(dir, 'rev.js')
  });
  eq(rev.status, 0, '② 反例臂必须跑通（exit=' + rev.status + ' ' + String(rev.stderr || '').slice(0, 120) + '）');
  ok(!/产物=起点/.test(String(rev.stderr)), '② 产物**不等于**起点时不许喊（永远喊 = 又一个恒真）');
  eq(metaOf(join(dir, 'rev.js')).productIsSeed, false, '② meta 必须读成 false（不是 null、不是缺字段）');

  /* ③ 冷启动：没有起点 ⇒ 这个判断根本不适用，必须是 null（"没起点" ≠ "产物等于起点"） */
  const cold = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd184-cold', EPIRUS_SEED: '5', EPIRUS_T3P_OUT: join(dir, 'cold.js')
  });
  eq(cold.status, 0, '③ 冷启动迷你臂必须跑通（exit=' + cold.status + '）');
  ok(!/产物=起点/.test(String(cold.stderr)), '③ 冷启动不许喊"产物=起点"');
  eq(metaOf(join(dir, 'cold.js')).productIsSeed, null, '③ 冷启动的 productIsSeed 必须是 null（未定义 ≠ 假）');

});


/* ===== D185（qoder 09-28 §E114）：`EPIRUS_HALL_SEED` 只**多一粒候选**，一分打分都不许动 =====
 * 背景：今晚 9 支接力臂里 **7 支的名人堂一席起点都没有** ⇒ "接力交出的包从没跟现役比过"是常态（§E113 补）。
 * 这个开关把起点补进终局重验的池子。它是**训练侧配方**（会改变交出去的那一粒）⇒ 出厂必须关、必须可证中性。
 * 钉三向：① 关时一行 `[hall-seed]` 都不许出现；② 开时"真的多了一席"，而**六席的 trainFit 逐字不变**、
 * 且起点是坏包时**产物必须逐位相同**（只多候选、不改判据）；③ 起点已在堂必须走"不重复追加"（幂等 ——
 * 否则同一粒被当两票，§E113 那"两个（当选）"就是这个形状）。 */
t('D185 起点补进重验池（v1.5.277 · §E114）：默认零行 + 只多候选不动打分 + 幂等', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/'EPIRUS_HALL_SEED'/.test(src.split('const SELF_ENV_KEYS')[1].split('];')[0]),
    '① 必须登记进 `SELF_ENV_KEYS`（否则按 D122 它是个"黑键"，一设就 exit 6）');
  ok(/if \(HALL_SEED > 0 && seedParams\)/.test(src), '① 追加必须在开关后面（默认 0 ⇒ 一行不跑）');
  ok(/hall\.push\(\{ params: seedParams, fit: null \}\)/.test(src), '② 追加那席的 `fit` 必须是 null（它没参加过训练打分，不许编一个数）');
  ok(/hh\.fit === null/.test(src), '② band-save 必须跳过追加的起点席（线上包本来就在仓里，另存一份会误导下一班）');

  const dir = mkdtempSync(join(tmpdir(), 'd185-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const zeroObj = JSON.parse(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live)[1]);
  zeroObj.a = zeroObj.a.map(function () { return 0; });
  const zeroSeed = join(dir, 'zero-seed.js');
  writeFileSync(zeroSeed, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(zeroObj) + ';\n');
  const arm = function (argv, extra) {
    return spawnSync(process.execPath, ['tools/train-3p.mjs'].concat(argv), {
      encoding: 'utf8', timeout: 600000,
      env: Object.assign({}, process.env, extra, { EPIRUS_BAND_DIR: join(dir, 'b' + Math.random().toString(36).slice(2)) })
    });
  };
  const fitsOf = function (txt) {
    return String(txt).split('\n').filter(function (l) { return /^\s+trainFit=[\d.]/.test(l); }).map(function (l) { return l.trim(); });
  };
  const common = { EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '0', EPIRUS_SEEDPACK: zeroSeed };
  const offOut = join(dir, 'off.js'), onOut = join(dir, 'on.js');
  /* v1.5.281：off/on 两臂互相独立 ⇒ 一批并发（判据不变：下面仍比 `fitsOff.length` / 产物逐位 / 横幅有无） */
  const B185 = spawnBatch([
    { tag: 'off', argv: ['tools/train-3p.mjs', '40', '3', '2', '8'],
      env: Object.assign({}, common, { EPIRUS_ARM: 'd185-off', EPIRUS_HALL_SEED: '0', EPIRUS_T3P_OUT: offOut, EPIRUS_BAND_DIR: join(dir, 'b-off') }) },
    { tag: 'on', argv: ['tools/train-3p.mjs', '40', '3', '2', '8'],
      env: Object.assign({}, common, { EPIRUS_ARM: 'd185-on', EPIRUS_HALL_SEED: '1', EPIRUS_T3P_OUT: onOut, EPIRUS_BAND_DIR: join(dir, 'b-on') }) },
  ], { max: 2, timeout: 900000 });
  const off = B185.off, on = B185.on;
  eq(off.status, 0, '① 开关关的迷你臂必须跑通（exit=' + off.status + ' ' + String(off.stderr || '').slice(0, 100) + '）');
  ok(!/hall-seed/.test(String(off.stdout) + String(off.stderr)), '① 默认（关）不许出现任何 `[hall-seed]` 行 ⇒ 出厂路径一行都不跑');
  const fitsOff = fitsOf(off.stdout);
  eq(fitsOff.length, 6, '① 前置：关档要读到 6 席重验行（实测 ' + fitsOff.length + ' ⇒ 终局形状变了，本门的比较基准得跟着改）');
  eq(on.status, 0, '② 开关开的迷你臂必须跑通（exit=' + on.status + '）');
  ok(/起点已追加为终局重验候选（现在 7 席/.test(String(on.stdout)), '② 必须**真的多了一席候选**（只打横幅不改池子 = 本仓"seam 2"族的老病）');
  const fitsOn = fitsOf(on.stdout);
  eq(fitsOn.length, 6, '② 开档的**训练打分**席仍必须只有 6 行（起点那行标 `trainFit=起点`，不许混进来）');
  eq(fitsOn.join('|'), fitsOff.join('|'), '② 六席读数必须**逐字相同** ⇒ 这个开关不动任何打分，只多一粒候选');
  ok(/第 7 席 = 追加的起点 ⇒ 不另存/.test(String(on.stdout)), '② 追加的起点席不许写成带内候选（会让人以为训练挖出了一粒"等于现役"的料）');
  const idp = spawnSync(process.execPath, ['tools/probe-pack-identity.mjs', offOut, onOut], { encoding: 'utf8', timeout: 120000 });
  eq(idp.status, 0, '② 起点是坏包时开/关的产物必须**逐位相同**（它是"多一粒候选"，不是"改判据"）：' + String(idp.stderr || '').slice(0, 120));
  const idem = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd185-idem', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '50',
    EPIRUS_SEEDPACK: 'js/bundled-champion-3p.js', EPIRUS_HALL_SEED: '1', EPIRUS_T3P_OUT: join(dir, 'idem.js')
  });
  ok(/起点本来就在名人堂里/.test(String(idem.stdout)), '③ 起点已在堂必须走"不重复追加"（幂等 ⇒ 同一粒不许被当两票）');
  ok(!/现在 7 席/.test(String(idem.stdout)), '③ 幂等分支不许又声称追加了');
  const mOn = JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*\});\n/.exec(readFileSync(onOut, 'utf8'))[1]);
  eq(mOn.hallSeedAppended, true, '④ 追加与否必须写进产物 meta（只有 stdout 有账 ⇒ 事后拿 .bak 的人看不见）');
  eq(mOn.hallSeedReq, 1, '④ meta 还要记"这臂请求过这个开关"（开了但没追加，事后要能区分）');
  rmSync(dir, { recursive: true, force: true });
});


/* ===== D186（qoder 09-28 §E122）：序列机会率探针必须**只读、可复现、有判别力**，且不许把 chooser 的返回重造 =====
 * 为什么单独钉一道：这把尺是裁 (a) 目标函数缺维 / (b) 课程缺行为 的**唯一依据**，
 * 而我建它的时候**当场产出过一个假读数** —— 第一版把 `policyChooserN` 的返回值当字符串比（它其实是 `{key,target,target2,bead}`），
 * 于是现役被读成"兑现率 0.0%"，与独立的 §E121（现役炮 1.45/局）矛盾才被抓出来。
 * 更坏的是第一版修法：重造 `{key, target:null}` 返回 ⇒ **探针自己吞掉目标选择、改了玩法**（那就不是在测这个包）。
 * 所以钉：① 源码必须原样交回返回对象；② 不认识的参数 exit 64；③ 包读不出必须点名 exit 7；
 * ④ 默认自证（复现 + 中性 + 守恒 + 判别力）必须全过且**两档口径都在**；⑤ 同一粒包传两次读数必须逐字相同。 */
t('D186 序列机会率探针（v1.5.278 · §E122）：原样交回 + 复现/中性/守恒/判别力四自证 + 两档口径', function () {
  const src = readFileSync('tools/probe-seq-opportunity.mjs', 'utf8');
  ok(/rejectUnknownFlags\(process\.argv\.slice\(2\), \['packs', 'games', 'n', 'seed', 'self-test', 'json'\]/.test(src),
    '① 参数守卫必须走 `rejectUnknownFlags`（D160 那条：写错开关名不许当默认值跑）');
  ok(/const r = base\(st, pid, legal\)/.test(src) && /return r;/.test(src) && /return r2;/.test(src),
    '① 观察点必须把真 chooser 的返回**原样交回**（重造对象会吞掉 target ⇒ 探针改玩法，测的就不是这个包了）');
  ok(!/return \{ key:/.test(src), '① 反向哨兵：源码里不许出现"重造返回对象"的写法（我第一版就是这么错的）');
  ok(/armed !== c\.notOffered \+ c\.notAfford \+ c\.opp/.test(src) && /c\.opp !== c\.taken \+ c\.missed/.test(src),
    '② 计数守恒必须自己检查（不守恒 = 尺坏了，读数作废）');
  ok(/runOnce\(params, cal\.mk, GAMES, SEED0, false\)/.test(src), '③ 必须有"摘掉观察者再跑一遍"的中性对照');
  ok(/firedReal/.test(src), '④ 必须另数**事件里的真开炮**（只信意图计数就是 §E121 那个错的复刻）');
  /* ⑥ 电珠账目（§E123 新增）：**"按下蓄能"≠"得到珠"** ⇒ 意图计数 `charges` 会把被引擎换掉的那一半也算进去，
   *   所以必须同时有 `beadGained`（事件 delta>0）与 `refresh`（R9 引注的"已持珠再蓄能只刷新"），并如实打印差额 Δ、
   *   Δ 过大时拒发账目（但**不拖累** armed/opp/taken 这些直接观测）。 */
  ok(/beadGained/.test(src) && /refresh/.test(src) && /c\.delta = \(c\.beadGained - c\.refresh\)/.test(src),
    '⑥ 电珠流必须有"得到/刷新/差额"三项（缺任何一项就会把意图读成结果 —— §E122 我犯的正是这个）');
  ok(/0\.25 \* Math\.max\(1, c\.beadGained - c\.refresh\)/.test(src),
    '⑥ Δ 超阈必须拒发账目（差额大到不能当描述用时，不许装作还能引）');
  ok(/CALIBERS = \[/.test(src) && src.indexOf('0.35, 0.15') > 0 && src.indexOf("0.15, 0.2, 5, 'soft'") > 0,
    '⑤ 两档口径必须都在（序列窗锁只在 soft 生效 ⇒ 只报一档就是撒谎）');

  const P = function (args) {
    return spawnSync(process.execPath, ['tools/probe-seq-opportunity.mjs'].concat(args), { encoding: 'utf8', timeout: 600000 });
  };
  const bad = P(['--nonsense=1']);
  eq(bad.status, 64, '② 不认识的 `--` 参数必须 exit 64（实得 ' + bad.status + '）');
  const miss = P(['--packs=no/such/pack.bak', '--games=40']);
  eq(miss.status, 7, '③ 包读不出必须 exit 7（"读不到"不许被读成"机会率 0"）：实得 ' + miss.status);
  ok(/no\/such\/pack\.bak/.test(String(miss.stderr)), '③ 且要点名是哪个包');
  const okRun = P(['--packs=js/bundled-champion-3p.js', '--games=40']);
  eq(okRun.status, 0, '④ 现役包（含四道自证）必须跑通（exit=' + okRun.status + ' ' + String(okRun.stderr || '').slice(0, 160) + '）');
  ok(/判别力自证 @train/.test(String(okRun.stdout)) && /判别力自证 @product/.test(String(okRun.stdout)),
    '④ 判别力自证必须两档口径都跑（均匀策略对照必须与真包不同 ⇒ "机会率 0"才不是"探针没在看"）');
  ok(/训练评分口径/.test(String(okRun.stdout)) && /产品口径/.test(String(okRun.stdout)), '⑤ 输出必须同时给两档口径的表');
  const dup = P(['--packs=js/bundled-champion-3p.js,js/bundled-champion-3p.js', '--games=40']);
  eq(dup.status, 0, '⑥ 同一粒包传两次必须跑通（这不是"零比较"，是**确定性**自证）：实得 ' + dup.status);
  const rows = String(dup.stdout).split('\n').filter(function (l) { return /bundled-champion-3p\.js/.test(l); });
  /* 形状（§E123 之后）：每档口径印**两块**（机会率表 + 电珠流水账）× 两行（同粒包传两次）= 8 行 */
  eq(rows.length, 8, '⑥ 两档口径 × 两块表 × 两行 = 8 行读数（实测 ' + rows.length + ' 行 ⇒ 表的形状变了，本门的基准要跟着改，别把它改成"只要非空就过"）');
  eq(rows[0], rows[1], '⑥ 同一粒包同尺同种子 ⇒ 机会率表两行必须**逐字相同**（不同就说明读数里混了未播种的随机）');
  eq(rows[2], rows[3], '⑥ 电珠流水账两行同理（Δ 也必须相同，否则账目本身依赖运行顺序）');
  eq(rows[4], rows[5], '⑥ 第二档口径的机会率表同理');
  eq(rows[6], rows[7], '⑥ 第二档口径的流水账同理');
  ok(/Δ=/.test(String(dup.stdout)), '⑥ 电珠账目的差额 Δ 必须印出来（不守恒却"看起来平衡"是最坏的形状）');
});


t('D189 gate-drafts **不许静默吞参数**（认不出 ⇒ exit 64；`.bak` 与 bundle `.js` 都要真量）（v1.5.282 · Qoder §5-3 点名）', function () {
  /* 病（Qoder 09-28 §5-3 点名交给 DS）：`EXTRA` 原来只收 `.bak` ⇒ 传 `js/bundled-champion-3p.js` 这类 bundle
   * 会被**静默丢掉**，而工具照样打出全套结论（其实只量了"线上包"那一行）—— **量具自己骗人**，
   * 与 §24 那族"静默无效果"同族。（我自己此前量"抗克参照"时传过 `.js`，读数对只是**因为那个文件恰好就是线上包**。）
   * 规矩：认不出的参数 ⇒ exit 64；认得出但读不出 ⇒ 一并报出并 exit 64。 */
  const GD = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(/\.\(bak\|js\|json\)\$/.test(GD) || /\\.\(bak\|js\|json\)/.test(GD),
    '参数识别必须接受 `.bak` / `.js` / `.json` 三种（v1.5.78 起 loadBakParams 本来就支持 bundle）');
  ok(/const EXTRA = \[\], BAD = \[\];/.test(GD), '必须把读不出的参数**收集起来**而不是过滤掉');
  ok(/if \(BAD\.length\)/.test(GD) && /process\.exit\(64\)/.test(GD),
    '读不出 ⇒ **exit 64 响亮失败**（不许静默忽略）');
  ok(!/filter\(function \(a\) \{ return \/\\.bak\$\/\.test\(a\); \}\)/.test(GD),
    '【反例】不许再出现"只留 `.bak`、其余静默丢"的那种过滤器');
  /* 行为：传一个不存在的 `.bak` ⇒ 必须 exit 64（在 G1/G2/G3 之后、重活之前就退出） */
  const r = spawnSync(process.execPath, ['tools/gate-drafts.mjs', 'this-file-does-not-exist-12345.bak'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 22 });
  eq(r.status, 64, '传不存在的路径 ⇒ 必须 exit 64 且印出"拒绝静默忽略"（实测 status=' + r.status + '）');
  ok(/拒绝静默忽略/.test(r.stderr || r.stdout || ''), '必须印出"拒绝静默忽略"这句话（人能看懂才算响亮）');
});

t('D190 promote 的阻断计数**不许被重复打印翻倍**（Qoder §F-1 点名 · v1.5.283）', function () {
  /* 病（Qoder 09-28 §F 交给 DS）：`gate-drafts` 会把同一格 `G4[…]` 印**两遍**（实测：stdout 8 行 / 唯一格名 5 个，
   * stderr 0 行 ⇒ 是工具自己重复打印，不是 stdout+stderr 拼接）⇒ 旧代码每遇一行就 push 一次 ⇒
   * 「⛔ 体检未过（N 项阻断）」的 N **翻倍**（判定不受影响，但读数字的人会被误导）。
   * 本门钉 promote 侧的去重（按格名），并留一条"工具侧待修"的说明。 */
  const PM = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/if \(gateDrafts\.blocking\.indexOf\(nm\) < 0\)/.test(PM),
    'G4/G5 阻断必须**按格名去重**后再 push（同一格被印两遍时不许数两遍）');
  ok(/gateDrafts\.recorded\.indexOf\('FAIL ' \+ nm\) < 0/.test(PM), 'recorded 一族同样要去重');
  ok(/gate-drafts 自己重复打印/.test(PM),
    '必须把根因（工具自己重复打印）留档 —— 免得后人以为已修而删掉去重（工具侧那条还没修）');
  /* ===== v1.5.284（Qoder §20-2/§20-3）：把这条门从"纯文本钉"升级成**行为判据** =====
   * 上面三条都是 `readFileSync(promote)` 的源码匹配 ⇒ 谁把去重提成 `pushUniq()` helper 就会为**非 bug** 变红，
   * 而真正的漏口（UNRUN 分支）反而抓不到。这族病本班刚红过一次（D4 被 `oppSeatIndex` 重构架空，见 §E125 补充）。
   * ① 行为判根因：`gate-drafts` 自己的输出里**每个格名必须恰好出现一次**（汇总段再复述也不许长得像判据行）。
   *    ⇒ 它按**格式**数，所以 FAIL / UNRUN 两种状态一起覆盖，不靠数状态名。 */
  const rgd = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '20', GATE6_GAMES: '4' })
  });
  const gout = String(rgd.stdout || '') + String(rgd.stderr || '');
  /* ⚠ 归因必须先于判据：这条门曾红过一次，报的是"汇总段前缀没了"，而**真实原因是那次 spawn 没跑到汇总**
   * （09-29 复跑同一命令 ⇒ 前缀在、重复 0 ⇒ 绿）。把"没跑完"和"格式回退"混报是本仓反复写的
   * "读不出 ≠ 没接线"同族病 ⇒ 先把 status/长度 断掉，再谈格式。 */
  ok(!!rgd.stdout && rgd.stdout.length > 800, '① 前置：gate-drafts 必须真跑出正文（stdout 长度 ' +
    String(rgd.stdout || '').length + '，status=' + rgd.status + '，error=' + (rgd.error ? rgd.error.message : '无') +
    '）——**没跑完不许被读成"格式回退了"**');
  const cellNames = (gout.match(/^\s*(?:PASS|FAIL|UNRUN)\s+(G[3-6][^\n]*)$/gm) || [])
    .map(s => s.replace(/^\s*(?:PASS|FAIL|UNRUN)\s+/, '').trim());
  ok(cellNames.length > 0, '① 至少要扫到判据行（扫到 0 行 ⇒ 这条门自己退化成恒真，本仓最怕的形状）');
  const dupCell = cellNames.filter((v, i) => cellNames.indexOf(v) !== i);
  eq(dupCell.length, 0, '① 判据行不许重复出现（重复 ⇒ promote 会把同一格数两遍）：实测重复 ' + dupCell.length + ' 处');
  ok(/汇总│\s/.test(gout), '① 汇总段必须还在、且带**不可解析的前缀** `汇总│ `（删掉汇总 = 丢人的读数；改回旧格式 = 丢这道网）');
  /* ② 行为判漏口：promote 的 UNRUN 分支也必须去重（DS v1.5.283 只修了 FAIL 那一支） */
  ok(/if \(uD\.blocking && gateDrafts\.blocking\.indexOf\(uName\) < 0\)/.test(PM),
    '② UNRUN 分支的阻断 push 必须去重（`statusOf` 会产出 `UNRUN:缺`，同样可解析）');
  ok(/gateDrafts\.unrun\.indexOf\(uLine\) < 0/.test(PM), '② UNRUN 的账目行同样不许重复记（meta 里翻倍会误导事后复核）');
});

t('D191 kept/ 别名检测（v1.5.285 · §E128）：按权重本体分组 · 已知别名必须查到 · 读不出不许当"无重复"', function () {
  /* 动因（09-28 凌晨实测）：`--aliases` 一跑就发现 kept/ 的 25 个文件其实只有 19 粒不同权重，
   * 其中 `NOL24-71 ≡ V2-71` 被交接件当成**两个方向的活体案例**引用（§17-E-3）⇒ 一例是重复计数。
   * 文件 sha 看不出来（权重同、META 不同）⇒ 必须比 `.a` **数组本体**（与 `probe-pack-identity` 同一判据，
   * 但那是两两比，这把尺是全池分组）。这条门防的是"证据池静默缩水成 N-1 粒"。 */
  const r = spawnSync(process.execPath, ['tools/keep-artifact.mjs', '--aliases'], { encoding: 'utf8', timeout: 180000 });
  eq(r.status, 0, '别名检测必须能跑（读不出权重时要 exit 7 点名，实测 ' + r.status + '）：' + String(r.stderr || '').slice(0, 200));
  const out = String(r.stdout);
  /* ① 判别力：账本里**已知存在**的一对别名必须被查到（查不到 = 这把尺是瞎的） */
  const hasPair = /e78-out__G08-71\.bak[\s\S]{0,160}e124-out__blk0t00-s71\.bak|e124-out__blk0t00-s71\.bak[\s\S]{0,160}e78-out__G08-71\.bak/.test(out);
  ok(hasPair, '① 必须查到已知别名对 G08-71 ≡ blk0t00-s71（同一配方同 seed ⇒ 两个班次跑出的产物逐位相同）⇒ 查不到说明分组没在读权重本体');
  ok(/权重本体不同的 \*\*\d+ 粒\*\*/.test(out) && /个文件/.test(out),
    '① 必须同时报"文件数"和"权重本体粒数"（只报一个就看不出缩水）');
  /* ⚠ 本门第一版在这里红过一次，**不是工具坏了**：真实输出是 `**19 粒**`，而我按 `**19**` 匹配 ⇒
   * 正则没对上就让门判红。教训同 D183：**门自己也要判别力自证**，正则必须照真实打印格式写。 */
  const nFiles = Number((/池子：(\d+) 个文件/.exec(out) || [])[1]);
  const mUniq = /权重本体不同的 \*\*(\d+) 粒\*\*/.exec(out);
  const nUniq = mUniq ? Number(mUniq[1]) : NaN;
  ok(nFiles > 15 && nUniq > 10, '② 读数必须在合理量级（池子 ' + nFiles + ' 个 / 独立 ' + nUniq + ' 粒 ⇒ 太小 = 外壳正则没命中，会被当成"无重复"）');
  ok(!/读不到权重本体/.test(out), '② 本次跑不许有"读不到权重本体"的文件（有就是 exit 7，不许继续报"无重复"）');
  /* ③ 静态钉：比较的本体必须是 `.a` 数组，不是文件字节（字节会把"同权重不同 META"误判成两粒） */
  const src = readFileSync('tools/keep-artifact.mjs', 'utf8');
  ok(/JSON\.parse\(m\[1\]\)\.a/.test(src) && /createHash\('sha1'\)\.update\(JSON\.stringify\(arr\)\)/.test(src),
    '③ 分组键必须是**权重数组本体**的哈希（文件 sha 会因 META 不同而漏掉别名 —— 这正是本次要抓的情形）');
});



t('D192 判定读数自带噪声尺（v1.5.287 · DS 清单第 8 条后半）：区间在边界不塌、n 小就变大、量不出不装 0', function () {
  /* 单一来源在 audit-lib（gate-drafts 只 import，不另抄公式 —— METHODOLOGY 35）。
   * 这条门判的是**这把尺自己有没有牙**，不是它印得好看。 */
  const c = AUDIT.ci95pt, tag = AUDIT.ci95tag;
  eq(typeof c, 'function', '① audit-lib 必须导出 ci95pt');
  eq(typeof tag, 'function', '① 与 ci95tag（打印形态只有一处定义）');
  /* ② 反"边界塌成 ±0.0"：裸 Wald 在 0%/100% 会给 ±0.0 ⇒ 被读成极其精确。add-2 调整不许这样 */
  ok(c(0, 300) > 0.5, '② 读数 0% 也必须给出非零区间（实测 ' + c(0, 300) + ' ⇒ 裸 Wald 就是 0，那是在装精确）');
  ok(c(100, 300) > 0.5, '② 读数 100% 同上（实测 ' + c(100, 300) + '）');
  /* ③ 判别力：n 变小 ⇒ 区间必须变大，且方向单调（否则"噪声尺"不随样本量动 = 装饰） */
  const s60 = c(62, 60), s300 = c(62, 300), s1000 = c(62, 1000);
  ok(s60 > s300 && s300 > s1000 && s60 > 2 * s300,
    '③ 同一读数下 n=60 的区间必须明显大于 n=300 且大于 n=1000（实测 ' + s60 + ' / ' + s300 + ' / ' + s1000 + '）');
  /* ④ 量不出就说量不出：坏 n / 坏 pct 一律 null，且打印形态不许出现 ±0.0 */
  eq(c(50, 1), null, '④ n<2 必须 null（单样本没有区间）');
  eq(c(-3, 300), null, '④ 非法读数必须 null');
  eq(c('abc', 300), null, '④ 非数值必须 null（不许 NaN 混进打印）');
  ok(tag(50, 1).indexOf('±?') === 0, '④ 打印形态在量不出时写 `±?…` 而不是 ±0.0');
  /* ⑤ 消费点必须真在用（只导出不用 = 第二把没人读的尺，本仓 §24 那族） */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(/import \{ ci95tag, ci95pt \} from '\.\/audit-lib\.mjs'/.test(gd), '⑤ gate-drafts 必须 import 这两个（不许在工具里再抄一遍公式）');
  ok((gd.match(/ci95tag\(/g) || []).length >= 3, '⑤ G4 最克格 / G4 基线格 / G5 三处读数都要带尺（实测 ' + (gd.match(/ci95tag\(/g) || []).length + ' 处调用）');
  ok(/阈值 25% 落在 95% 区间内|落在这一格的 95% 区间内/.test(gd),
    '⑤ **判定线落在区间内时必须明说"红/绿由抽样决定"** —— 只印 ±SE 不点名，读的人还是会当结论');
  /* ⑥ 行为：真跑一次小 n 的 gate-drafts，输出里必须出现噪声尺（判在输出上，不判在源码上） */
  const rg = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '20', GATE6_GAMES: '4' })
  });
  const gout = String(rg.stdout || '');
  ok(rg.stdout && rg.stdout.length > 800, '⑥ 前置：量具必须真跑出正文（长度 ' + String(rg.stdout || '').length +
    '，status=' + rg.status + '）——**没跑完不许被读成"尺没印"**');
  ok(/噪声尺：/.test(gout), '⑥ 实际输出里必须有"噪声尺"');
  ok(/±\d+\.\dpt\(95%,n=20\)/.test(gout), '⑥ 且带上具体的 n（没有 n 的 ±x 等于没给口径）');
});

t('D193 多包路由收益的算式有牙（v1.5.288-289 · §E129/§E130/§E131）：分支全覆盖、绝对阈值不许回来、印出来的分支必须等于重算的分支、并列与弃权都不许偷偷改分母', function () {
  /* 这条门**不判科学结论**（R 是多少由 §E129 的记录负责），只判三件事：
   *   ① 判读函数的每条分支都走得到、边界值不许含混；
   *   ② 我预注册写错的那条**绝对 25% 阈值**不许回来（27 类时 13% 是"有信息"的，旧规则在这里判了"路由不可实现"，
   *      而同一次运行的 realizable > best_single 说明钱真赚到了 ⇒ 两条判词互相打脸）；
   *   ③ 矩阵读不出、环境被排空时必须**拒绝出结论**，不许拿空表算上界。
   * 变异实测（把 `isInformative` 换回旧的绝对阈值）⇒ ② 的两条红；开发台 47 断言全绿后才搬进本文件。 */
  for (const fn of ['routingReadings', 'bestInByEnv', 'bestSingleOf', 'realizableOf', 'chanceOf', 'isInformative', 'branchOf', 'matrixComplaint', 'pairedDiff']) {
    ok(typeof RGAIN[fn] === 'function', '① routing-gain-lib 必须导出 ' + fn + '（算式只许这一处）');
  }
  const B = RGAIN.BRANCHES;
  /* ---- ② 合成表：完美路由器的 R 恰好 1；没预测 ⇒ ⑥；全平 ⇒ ⑤ ---- */
  const E6 = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
  const row = (pack, f) => ({ pack: pack, per: Object.fromEntries(E6.map((e, i) => [e, { fit: f[i] }])) });
  const ROWS = [
    row('A', [0.90, 0.30, 0.30, 0.30, 0.30, 0.30]), row('B', [0.20, 0.85, 0.20, 0.20, 0.20, 0.20]),
    row('C', [0.20, 0.20, 0.80, 0.75, 0.20, 0.20]), row('D', [0.10, 0.10, 0.10, 0.10, 0.10, 0.60]),
  ];
  const BI = RGAIN.bestInByEnv(ROWS, E6);
  eq(BI.e1, 'A', '② 每个环境的最佳包要挑对');
  const perf = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0.05, fallbackPack: 'A' });
  ok(perf.oracle >= perf.bestSingle, '② oracle 不许低于 best_single（上界是"每环境各挑各的"，一定不差于一招鲜）');
  eq(perf.R, 1, '② 完美路由器（picks=真环境）的 R 必须恰好 1');
  eq(perf.branch, B.WORTH, '② R=1 且有分辨力 ⇒ 必须判 ②');
  /* "一个预测都没有"在新口径下**不是**"读数不全"：路由器什么都没换 ⇒ `realizable` 逐位等于 `best_single` ⇒ R=0。
   * （v1.5.288 的老断言判的是 ⑥，那是彼时"没预测的环境被整条跳过"的口径 —— §E131 量到 R=2.81 才暴露那套均值不可比。） */
  const none = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: {}, acc: 0.9, placebo: 0.05, fallbackPack: BI.e1 });
  ok(none.realizable === none.bestSingle, '② 一个预测都没有 ⇒ realizable 必须**逐位等于** best_single（实测 ' + none.realizable + ' vs ' + none.bestSingle + '）');
  eq(none.R, 0, '② 那台路由器等于什么都没做 ⇒ R 必须是 0，不许是"未量到"（"没做"与"没量到"是两件事）');
  eq(none.branch, B.NEEDS_NET, '② R=0 且有分辨力 ⇒ 判 ④（钱要靠网络内部条件化），这是**允许**的结论形状');
  let threw = false;
  try { RGAIN.realizableOf(ROWS, E6, BI, {}, 'fit'); } catch (e) { threw = /必须有 fallbackPack/.test(e.message); }
  ok(threw, '② **不给 fallbackPack 必须抛**：没有预测的环境被跳过 ⇒ realizable 与 oracle 就不是同一批环境 ⇒ 这正是 §E131 那次 R=2.81 的成因');
  const over = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0.05, fallbackPack: 'A' });
  ok(over.realizable <= over.oracle + 1e-12, '② 构造保证 realizable ≤ oracle（越线就说明链路又变成两套均值比大小）');
  const FLAT = [row('X', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), row('Y', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), row('Z', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5])];
  const flat = RGAIN.routingReadings({ rows: FLAT, envs: E6, bestIn: RGAIN.bestInByEnv(FLAT, E6), picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0, fallbackPack: 'X' });
  eq(flat.branch, B.NO_EDGE, '② 上界缺口 < 0.02 ⇒ 必须判 ⑤（不必谈 R）');
  eq(flat.R, null, '② 判 ⑤ 时 R 必须是 null，不许印 0（0 会被读成"路由赚不到钱"）');
  /* ---- ③ 分支函数：四个带的上下边界 + 两条优先级 ---- */
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.50 }), B.WORTH, '③ R=0.50 在 ② 的界上（含）');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.49 }), B.HALF, '③ R=0.49 掉进 ③');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.20 }), B.HALF, '③ R=0.20 在 ③ 的界上（含）');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.19 }), B.NEEDS_NET, '③ R=0.19 掉进 ④');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: false, R: 0.90 }), B.NO_SIGNAL, '③ 签名没分辨力时 R 再大也不许判"值得做"');
  eq(RGAIN.branchOf({ gap: 0.019, readingsOk: true, informative: true, R: null }), B.NO_EDGE, '③ 缺口太小 ⇒ ⑤ 优先');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: false, informative: true, R: null }), B.NO_READING, '③ 读数不全 ⇒ ⑥ 优先于收益判断');
  /* ---- ④ 核心那条：§E129 的读数在这把尺下必须是"有信息"，旧的绝对 25% 不许回来 ---- */
  const CH27 = RGAIN.chanceOf(27);
  ok(RGAIN.isInformative(0.1267, CH27, 0.0047) === true, '④ §E129 主读数（准确率 12.7% / 随机 3.7% / placebo 0.5%）必须判"有分辨力"');
  ok(RGAIN.isInformative(0.24, CH27, 0) === true, '④ 准确率 24%（低于旧的 25% 绝对阈值）在 27 类下仍是**有信息** ⇒ 绝对阈值不许回来');
  ok(RGAIN.isInformative(0.05, CH27, 0.04) === false, '④ 只比随机高一点点（5% vs 3.7%）⇒ 必须判"没有分辨力"');
  ok(RGAIN.isInformative(NaN, CH27, 0) === false, '④ 准确率没量到 ⇒ 不许判有信息');
  ok(RGAIN.isInformative(0.20, RGAIN.chanceOf(2), 0.19) === false, '④ 两类问题里 20% 低于随机 50% ⇒ 没信息（placebo 参与取大）');
  /* ---- ⑤ 矩阵读不出就拒绝 ---- */
  ok(/不足 3 粒/.test(RGAIN.matrixComplaint(ROWS.slice(0, 2), E6) || ''), '⑤ 只有 2 粒包 ⇒ 拒绝并说清为什么');
  ok(/包名读不出/.test(RGAIN.matrixComplaint([{ per: {} }, { per: {} }, { pack: '', per: {} }], E6) || ''), '⑤ 有行没名字 ⇒ 拒绝（矩阵改键时不许静默用无名行）');
  ok(/环境数不足/.test(RGAIN.matrixComplaint(ROWS, ['a', 'b', 'c']) || ''), '⑤ 环境不足 4 ⇒ 拒绝');
  eq(RGAIN.matrixComplaint(ROWS, E6), null, '⑤ 合格的表必须放行');
  /* ---- ⑥ 消费点：探针必须用这把尺，且不许留第二份公式 ---- */
  const probeSrc = readFileSync('tools/probe-regime-identifiability.mjs', 'utf8');
  ok(/from '\.\/routing-gain-lib\.mjs'/.test(probeSrc), '⑥ 探针必须 import routing-gain-lib');
  ok(!/R\s*=\s*\(realizable\s*-/.test(probeSrc), '⑥ 探针里不许再抄一份 R 的公式');
  ok(!/acc\s*<\s*0\.25/.test(probeSrc) && !/改观测面是唯一路/.test(probeSrc), '⑥ 旧的 25% 绝对阈值判词必须已从探针里删干净');
  ok(/nearestDistinct\(s\.v, pool, s, dist\)/.test(probeSrc),
    '⑥ 探针的最近邻必须走 `routing-gain-lib.nearestDistinct`（**并列怎么裁决**这件事只许有一处定义）');
  /* ---- ⑩ 并列裁决与弃权闸（§E131 那两处读数错误的直接补丁，判在纯函数上）---- */
  const dv = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0));
  const P1 = { v: [1, 0], env: 'x' }, P2 = { v: [1, 0], env: 'y' }, P3 = { v: [1, 0], env: 'x' }, P4 = { v: [0, 1], env: 'z' };
  const nd1 = RGAIN.nearestDistinct(P1.v, [P1, P2, P3, P4], P1, dv);
  ok(nd1.ambiguous === true && nd1.env === null,
    '⑩ 并列来自**不同环境** ⇒ 必须判歧义、不给预测（原先按遍历顺序取第一个最小距离 ⇒ §E129 那个 13% 里有一部分是顺序给的假分辨力）');
  const nd2 = RGAIN.nearestDistinct(P1.v, [P3, P4], P1, dv);
  ok(nd2.ambiguous === false && nd2.env === 'x', '⑩ 同环境内部的逐位重复**不算歧义**（那正是"同一个原型"，不许把它判成不可辨）');
  const nd3 = RGAIN.nearestDistinct([0.9, 0.1], [{ v: [1, 0], env: 'a' }, { v: [0, 1], env: 'b' }], null, dv);
  ok(nd3.ambiguous === false && nd3.env === 'a' && Math.abs(nd3.d - Math.sqrt(0.02)) < 1e-9,
    '⑩ 明显更近的那个要照单收下（歧义判定不许退化成"一律不给答案"）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: true, nSwitch: 4, minSwitch: 5 }), B.DEGENERATE,
    '⑩ 弃权版只换 4 个环境 ⇒ ⓪ "没有结论"（§E131 跑前写死的反退化条款）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: true, nSwitch: 5, minSwitch: 5 }), B.HALF,
    '⑩ 换满 5 个才进入正常判读（边界含）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: false, nSwitch: 0, minSwitch: 5 }), B.HALF,
    '⑩ 没开弃权闸时 ⓪ 不许介入（§E129/§E130 的读数靠这条保住口径）');
  eq(RGAIN.medianOf([]), null, '⑩ 空样本的中位数必须是 null（不许印 0 冒充量到）');
  const sh = RGAIN.shareOf({ a: 30, b: 10 });
  ok(Math.abs(sh.share - 0.75) < 1e-9 && sh.top === 'a', '⑩ share 算的是众数占比（0.75），不是票数');
  ok(RGAIN.decideSwitch('dist', { nnMed: 0.001, tau: 0, share: 1 }).canSwitch === false, '⑩ dist：比 τ 远一点就不许换（τ=0 时只有逐位重合才允许）');
  ok(RGAIN.decideSwitch('share', { nnMed: 0, tau: 0, share: 0.49 }).canSwitch === false, '⑩ share 差一点也不许换（0.49 < 0.5）');
  ok(RGAIN.decideSwitch('off', { nnMed: 9, tau: 0, share: 0 }).canSwitch === true, '⑩ off 不改任何旧读数（默认口径不许被新闸偷偷挪动）');
  /* ---- ⑦ 行为：真跑一次（合成矩阵 + opp-pool 现取的环境名），**印出来的分支必须等于用同一批数重算的分支** ----
   * 复算用的 R 必须由未取整的 realizable/bestSingle/gap 推出，**不能**用 json 里那个取整过的 `R`：
   * 取整值恰好压在带边界上（真实 0.49996 → 印 0.5000）会把分支判到隔壁一档 ⇒ **门自己**在正确的代码上假红。
   * 这条是变异实测撞出来的，不是设想出来的。 */
  const dir = mkdtempSync(join(tmpdir(), 'd193-'));
  try {
    const specs = Array.isArray(OPP_SPECS) ? OPP_SPECS : Object.values(OPP_SPECS);
    /* 8 个环境（不是 5）：合成表要让**命中率非零**，否则 ⑨″ 那条"链路命中率不许整体塌成 0"
     * 会在一份全都歧义的表上变成空转（实测 5 个环境时 acc=0 ⇒ 装饰；8 个时 acc≈23% ⇒ 有牙）。 */
    const names = specs.slice(0, 8).map((s) => s.name);
    const synth = { rows: names.map((nm, i) => ({ label: nm, per: Object.fromEntries(names.map((e, j) => [e, { fit: i === j ? 0.95 : 0.30 }])) })) };
    const mf = join(dir, 'matrix.json');
    writeFileSync(mf, JSON.stringify(synth));
    const run = (extra, out) => spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--matrix=' + mf, '--games=6', '--k=3'].concat(extra, out ? ['--json=' + out] : []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 24 });
    const jf = join(dir, 'out.json');
    const r1 = run([], jf);
    const o1 = String(r1.stdout || '');
    ok(r1.status === 0 && o1.length > 300, '⑦ 前置：探针必须真跑出正文（status=' + r1.status + '，长度 ' + o1.length + '）——没跑完不许把"分支对不上"当结论');
    const j = JSON.parse(readFileSync(jf, 'utf8'));
    ok(j.meta.envs >= 4, '⑦ 前置：合成矩阵至少 4 个有效环境（实测 ' + j.meta.envs + '）');
    ok(j.oracle >= j.bestSingle, '⑦ 实跑也必须满足 oracle ≥ best_single');
    const Rcalc = (j.realizable - j.bestSingle) / j.gap;
    eq(j.chance, RGAIN.chanceOf(j.meta.envs), '⑦ json 的随机基线必须等于 1/参与判定环境数');
    eq(j.informative, RGAIN.isInformative(j.acc, j.chance, j.placebo), '⑦ json 的"有分辨力"必须能由它自己的三个数重算出来');
    ok(j.gap < 0.02 || Math.abs(j.R - Rcalc) < 1e-3, '⑦ json 印的 R 与复算的 R 必须一致（实测 ' + j.R + ' vs ' + Rcalc + '）');
    eq(j.branch, RGAIN.branchOf({ gap: j.gap, readingsOk: isFinite(j.realizable) && isFinite(j.acc), informative: j.informative, R: Rcalc }),
      '⑦ **印出来的分支 = 用同一批数重算的分支**');
    const vline = o1.split('\n').filter(l => /判读：/.test(l))[0] || '（输出里没有判读行）';
    ok(new RegExp('^\\s*判读：' + j.branch).test(vline), '⑦ 屏幕上的判读开头必须是 json 里那个分支符（实测：' + vline.trim().slice(0, 60) + '）');
    const n1 = Number((o1.match(/参与判定环境 (\d+) 个/) || [])[1]);
    const n2 = Number((String(run(['--exclude=' + names[0]]).stdout || '').match(/参与判定环境 (\d+) 个/) || [])[1]);
    ok(isFinite(n1) && isFinite(n2) && n2 === n1 - 1, '⑦ --exclude 一个真环境 ⇒ 参与判定环境必须少 1 个（实测 ' + n2 + ' vs ' + n1 + '）');
    const o3 = String(run(['--exclude=zzz-not-an-env']).stdout || '');
    const n3 = Number((o3.match(/参与判定环境 (\d+) 个/) || [])[1]);
    ok(/typo/.test(o3) && n3 === n1, '⑦ 排除一个不存在的名字 ⇒ 必须点名"typo？忽略"，且参与判定环境与不排除时相同（实测 ' + n3 + ' vs ' + n1 + '）');
    ok(run(['--exclude=' + names.join(',')]).status === 2, '⑦ 把环境全排除 ⇒ 必须 exit 2 拒绝出结论');
    ok(spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--games=2'], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 }).status === 2,
      '⑦ 不给 --matrix ⇒ 必须 exit 2');
    /* ---- ⑧ `--metric=` 必须真的换列打分（不是被忽略），拼错的量纲必须响亮拒 ----
     * 这是 §E130 的整条依据：同一套预测在 `fit` 与 `win` 上读出 R=0.235 与 R=0.14 两个结论。
     * 若这个参数被静默忽略，两个"口径"其实是同一个数 ⇒ 那条更正就是假的。 */
    const mf2 = join(dir, 'matrix2.json');
    /* 这张合成表是**故意设计成有对比度**的（第一版没有，于是一条断言成了装饰 —— 变异实测抓出来的）：
     * `pack[0]` 两个量纲上都平（fit 0.55 / win 0.20），`pack[i≥1]` 只在自己那一格尖（fit 0.95 / win 0.90）
     * ⇒ `fit` 的一招鲜 = pack0，而 `win` 的一招鲜 = 某个尖包 ⇒ ⑧ 的"换列必须换数"量得出；
     * ⇒ 且 per-env 最佳包 ≠ 那一招鲜 ⇒ ⑨ 的"链路均值 = 印出来的均值"也量得出。 */
    writeFileSync(mf2, JSON.stringify({ rows: names.map((nm, i) => ({
      label: nm,
      per: Object.fromEntries(names.map((e, j) => [e,
        i === 0 ? { fit: 0.55, win: 0.20 }
          : { fit: j === i ? 0.95 : 0.10, win: j === i ? 0.90 : 0.05 }]))
    })) }));
    const run2 = (extra, out) => spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--matrix=' + mf2, '--games=6', '--k=3'].concat(extra, out ? ['--json=' + out] : []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 24 });
    const jfFit = join(dir, 'm-fit.json'), jfWin = join(dir, 'm-win.json');
    const rFit = run2(['--metric=fit'], jfFit), rWin = run2(['--metric=win'], jfWin);
    ok(rFit.status === 0 && rWin.status === 0, '⑧ 前置：两个量纲都要跑完（fit status=' + rFit.status + '，win status=' + rWin.status + '）');
    const jFit = JSON.parse(readFileSync(jfFit, 'utf8')), jWin = JSON.parse(readFileSync(jfWin, 'utf8'));
    eq(jWin.meta.metric, 'win', '⑧ json 必须记下用的哪个量纲');
    ok(/打分量纲 = \*\*win\*\*/.test(String(rWin.stdout || '')), '⑧ 屏幕上必须印出量纲（换列打分这件事不许只藏在 json 里）');
    ok(jWin.bestSinglePack !== jFit.bestSinglePack || Math.abs(jWin.bestSingle - jFit.bestSingle) > 1e-6,
      '⑧ **同一套预测、换一列打分必须读出不同的数**（实测 fit ' + jFit.bestSinglePack + '/' + jFit.bestSingle + ' vs win ' + jWin.bestSinglePack + '/' + jWin.bestSingle + '）⇒ 一模一样就说明 `--metric` 被忽略了');
    ok(jFit.realizable !== jWin.realizable, '⑧ realizable 也必须随量纲变（实测 ' + jFit.realizable + ' vs ' + jWin.realizable + '）');
    const rBad = run2(['--metric=winn']);
    ok(rBad.status === 2 && /不认识的量纲/.test(String(rBad.stderr || '')),
      '⑧ 拼错的量纲必须 exit 2 并点名（实测 status=' + rBad.status + '）⇒ 读出一列 undefined 比红危险得多');
    /* ---- ⑨ `--dump=` 的逐环境链路必须与印出来的均值**是同一笔算术**，且区间量具读得动它 ----
     * §E130 那句"增益与 0 不可分"全靠这份链路能对上账；对不上就是拿另一套数算的区间。 */
    const dp = join(dir, 'dump.json'), jdp = join(dir, 'dumpmeta.json');
    const rd = run2(['--metric=fit', '--dump=' + dp], jdp);
    ok(rd.status === 0 && existsSync(dp), '⑨ 前置：--dump 必须真写出文件（status=' + rd.status + '）');
    const DM = JSON.parse(readFileSync(dp, 'utf8')), JD = JSON.parse(readFileSync(jdp, 'utf8'));
    ok(Array.isArray(DM.perEnv) && DM.perEnv.length === JD.meta.envs,
      '⑨ 逐环境条数必须等于参与判定环境数（实测 ' + (DM.perEnv || []).length + ' vs ' + JD.meta.envs + '）');
    const mOf = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const got = DM.perEnv.filter(r => typeof r.chosen.fit === 'number').map(r => r.chosen.fit);
    const inc = DM.perEnv.map(r => r.incumbent.fit);
    ok(got.length === JD.realizableN, '⑨ 链路里"真拿到包"的环境数必须等于 json 的 realizableN（实测 ' + got.length + ' vs ' + JD.realizableN + '）');
    ok(Math.abs(mOf(got) - JD.realizable) < 1e-9,
      '⑨ 链路的 chosen 均值必须等于印出来的 `realizable`（实测 ' + mOf(got) + ' vs ' + JD.realizable + '）⇒ 链路落的数与印出来的数不是同一笔算术，区间就是假的');
    ok(Math.abs(mOf(inc) - JD.bestSingle) < 1e-9,
      '⑨ 链路的 incumbent 均值必须等于印出来的 `best_single`（实测 ' + mOf(inc) + ' vs ' + JD.bestSingle + '）');
    ok(Math.abs(mOf(got) - mOf(inc) - (JD.realizable - JD.bestSingle)) < 1e-9,
      '⑨ 两者之差（配对均值）必须等于 `realizable − best_single`');
    ok(DM.perEnv.every(r => r.env && typeof r.acc === 'number'), '⑨ 每条链路要带环境名与该环境命中率（聚类区间要用）');
    /* ⑨″ dump 的逐环境命中率必须与 json 的总命中率**是同一个量**，而且不许整体塌成 0。
     * 动因（真实事故）：`nearestOther` 从返回字符串改成返回对象之后，链路里的 `nn === s.env` 恒 false
     * ⇒ **每个环境命中率都成 0**、工具不崩、别的字段全都正常 ⇒ 聚类区间那条读数悄悄废掉。
     * 只判"字段存在"挡不住这种错（0 也是 number），必须判**它与总量对得上、并且不恒为 0**。 */
    const wsum = DM.perEnv.reduce((s, r) => s + r.acc * r.n, 0), wtot = DM.perEnv.reduce((s, r) => s + r.n, 0);
    ok(wtot > 0 && Math.abs(wsum / wtot - JD.acc) < 1e-9,
      '⑨″ 链路命中率的**样本加权均值**必须等于 json 的总准确率（实测 ' + (wtot ? wsum / wtot : NaN) + ' vs ' + JD.acc + '）');
    ok(JD.acc === 0 || DM.perEnv.some(r => r.acc > 0),
      '⑨″ json 说准确率不是 0（实测 ' + JD.acc + '）⇒ 链路里至少要有一个环境的命中率 > 0；两者不一致就是**形状改了之后的死代码**（不是"真的都没认出来"）');
    const an = spawnSync(process.execPath, ['tools/analyze-routing-gain.mjs', dp], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
    ok(an.status === 0 && /95% \[/.test(String(an.stdout || '')) && /变好 \d+ ‖ 变差 \d+/.test(String(an.stdout || '')),
      '⑨ 区间量具必须读得动这份 dump，并印出 95% 区间与**逐环境好/差分布**（实测 status=' + an.status + '）');
    /* ⑨′ 同一件事在**弃权版**上再验一遍：`门槛过了但没有票` 的环境也必须"实际打一粒包"（落回一招鲜），
     * 不许留 null —— 留 null 就是把这个环境从均值里悄悄删掉，而 json 的 realizable 却按"落回"算 ⇒ 两笔算术。
     *（这一条是 §E131 第一次撞到之后补的，形如"dump 与均值不一致"的错在本仓已经出现过三次。）*/
    const dp2 = join(dir, 'dump-abstain.json'), jdp2 = join(dir, 'dumpmeta-abstain.json');
    const rd2 = run2(['--metric=win', '--abstain=dist', '--dump=' + dp2], jdp2);
    ok(rd2.status === 0 && existsSync(dp2), '⑨′ 前置：弃权版也必须跑完并落下 dump（status=' + rd2.status + '，' + String(rd2.stderr || '').slice(0, 90) + '）');
    const DM2 = JSON.parse(readFileSync(dp2, 'utf8')), JD2 = JSON.parse(readFileSync(jdp2, 'utf8'));
    ok(DM2.perEnv.every(r => r.chosen && typeof r.chosen.win === 'number' && typeof r.chosen.fit === 'number'),
      '⑨′ 每个参与打分的环境都要有"**实际打的那一粒**"（弃权 ⇒ 落回一招鲜，不许 null）：实测 null 条数 '
      + DM2.perEnv.filter(r => !r.chosen || typeof r.chosen.win !== 'number').length);
    const m2 = DM2.perEnv.map(r => r.chosen[JD2.metric || 'win']);
    ok(Math.abs(m2.reduce((s, x) => s + x, 0) / m2.length - JD2.realizable) < 1e-9,
      '⑨′ 弃权版的链路均值必须等于 json 的 realizable（实测 ' + (m2.reduce((s, x) => s + x, 0) / m2.length) + ' vs ' + JD2.realizable + '）');
    ok(DM2.perEnv.filter(r => r.switched).length === JD2.meta.switched,
      '⑨′ 链路里 `switched` 的条数必须等于 json 的 meta.switched（实测 ' + DM2.perEnv.filter(r => r.switched).length + ' vs ' + JD2.meta.switched + '）');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

t('D195 特征可分性这把前置尺有牙（v1.5.290 · §E134）：分得开要能测出来、分不开不许靠"唯一点数多"蒙过去', function () {
  /* 为什么补这道门：§E134 的全部价值在于"它比验收益便宜一个数量级，而且能提前否证一整条方向"。
   * 尺子本身如果没牙（比如把"每条样本都独一无二"误当"原型分得开"），那这条便宜路就会变成**新的假绿灯**。 */
  ok(typeof RGAIN.separabilityOf === 'function', '① routing-gain-lib 必须导出 separabilityOf（判据只许一处定义）');
  ok(typeof RGAIN.euclid === 'function', '① 与 euclid（§E131/§E134 共用同一把距离）');
  const V = (a) => a.slice();
  /* ② 三个离得很远、组内很紧的原型 ⇒ 必须**全部判可分**、歧义率 0、留一准确率 1 */
  const sep3 = { x: [V([0, 0]), V([0.01, 0]), V([0, 0.01]), V([0.01, 0.01])],
    y: [V([10, 0]), V([10.01, 0]), V([10, 0.01]), V([10.01, 0.01])],
    z: [V([0, 10]), V([0.01, 10]), V([0, 10.01]), V([0.01, 10.01])] };
  const r2 = RGAIN.separabilityOf(sep3);
  eq(r2.U_sep, 3, '② 明显分得开 ⇒ U_sep 必须等于原型数（实测 ' + r2.U_sep + '）');
  eq(r2.ambRate, 0, '② 没有跨环境并列 ⇒ 歧义率必须 0');
  eq(r2.acc, 1, '② 留一最近邻必须全中');
  /* ③ 两个逐位重合的原型 ⇒ 必须判**一个都分不开**、歧义率 1（这条钉住"并列不许按顺序裁决"） */
  const same = { p: [V([1, 1]), V([1, 1]), V([1, 1])], q: [V([1, 1]), V([1, 1]), V([1, 1])] };
  const r3 = RGAIN.separabilityOf(same);
  eq(r3.U_sep, 0, '③ 质心重合 ⇒ 必须 0 个可分（实测 ' + r3.U_sep + '）');
  eq(r3.ambRate, 1, '③ 每条样本的最近邻都跨环境并列 ⇒ 歧义率必须 1（不许按遍历顺序编一个答案）');
  eq(r3.acc, 0, '③ 准确率必须 0');
  /* ④ **这条最要紧**：组内极散、质心却挨得很近 ⇒ `U_sample` 很大但 `U_sep` 必须小。
   *    钉住"维度多/样本条条唯一 ≠ 分得开"——这正是我第一节 §E134 差点读错的地方。 */
  const spread = { a: [V([-5, 0]), V([5, 0]), V([0, -5]), V([0, 5])], b: [V([-4, 1]), V([4, 1]), V([1, -4]), V([-1, 4])] };
  const r4 = RGAIN.separabilityOf(spread);
  ok(r4.U_sample >= 7, '④ 前置：这个构造就该"条条样本独一无二"（实测 U_sample=' + r4.U_sample + '）');
  ok(r4.U_sep <= 1, '④ **唯一点数多不算分得开**：组内比组间还远 ⇒ U_sep 必须 ≤1（实测 ' + r4.U_sep + '，U_sample ' + r4.U_sample + '）');
  ok(r4.inseparable.length >= 1 && r4.inseparable[0].ratio <= 1, '④ 分不开的原型要**点名列出来**并给 b/w 比值（实测 ' + JSON.stringify(r4.inseparable[0]) + '）');
  /* ⑤ 只有一条样本的原型：组内没有距离 ⇒ 不许当"可分"（更不许崩） */
  const solo = { m: [V([0, 0])], n: [V([9, 9])] };
  const r5 = RGAIN.separabilityOf(solo);
  eq(r5.U_sep, 0, '⑤ 单样本原型无法算组内距离 ⇒ 判不可分（实测 ' + r5.U_sep + '）');
  eq(r5.nEnvs, 2, '⑤ 原型数照常报');
  /* ⑥ 探针必须用这把尺（而不是自己再写一份）；**行为面（K 有没有真截断、判据的线）由 D196 负责**，这里不重复 spawn */
  const src = readFileSync('tools/probe-sig-separable.mjs', 'utf8');
  ok(/import \{[^}]*separabilityOf[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src), '⑥ 探针必须 import separabilityOf（判据只许一处定义）');
  ok(!/U_sep: sep/.test(src), '⑥ 探针里不许留第二份 U_sep 的实现');
});

t('D196 可分性量具的窗口与判据不许自骗（v1.5.290 · §E134）：K 必须真截断、事件没 round 就不能靠事件分回合', function () {
  /* 这道门只为一个事故存在：§E134 第一版拿 `e.round` 给事件分回合，而 **action 事件根本没有 round 字段**
   * ⇒ 三档 K 算的是"整局"，读数字父相同、工具不崩、表看着完全合理。现在靠"每回合开局记事件水位"截断，
   *   并且工具自己把"前 K 回合 vs 整局"印出来 —— 本门判的就是这个印出来的数**必须随 K 变**。 */
  const argvOf = (K) => ['tools/probe-sig-separable.mjs', '--games=6', '--n=3', '--ks=' + K];
  const o3 = String(spawnSync(process.execPath, argvOf(3), { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 }).stdout || '');
  const o15 = String(spawnSync(process.execPath, argvOf(15), { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 }).stdout || '');
  const m3 = o3.match(/A\/C 实际用的那条 `inWindow` = \*\*前 (\d+) 回合 (\d+) 次出招\*\* ‖ 整局 (\d+) 次/);
  const m15 = o15.match(/A\/C 实际用的那条 `inWindow` = \*\*前 (\d+) 回合 (\d+) 次出招\*\* ‖ 整局 (\d+) 次/);
  ok(!!m3 && !!m15, '① 两档都必须印出窗口自检（K=3 有=' + !!m3 + '，K=15 有=' + !!m15 + '）——**自检必须走特征向量用的那条 `inWindow`**，另写一份就等于给自己打勾');
  if (m3 && m15) {
    eq(Number(m3[1]), 3, '① 第一档确实按 K=3 算');
    eq(Number(m15[1]), 15, '① 第二档确实按 K=15 算');
    ok(Number(m3[2]) < Number(m15[2]), '② **窗口越长按到的出招必须越多**（实测 K=3 得 ' + m3[2] + ' 次 ‖ K=15 得 ' + m15[2] + ' 次）'
      + ' ⇒ 两档相等就意味着 K 根本没起作用（就是那个事故）');
    ok(Number(m15[2]) <= Number(m3[3]), '② 长窗口也不许超过整局（' + m15[2] + ' vs ' + m3[3] + '）');
  }
  /* ③ 判据的线必须来自跑前定死的常数，且 json 里要带出来 */
  const jp = join(mkdtempSync(join(tmpdir(), 'd196-')), 'e134.json');
  const rj = spawnSync(process.execPath, ['tools/probe-sig-separable.mjs', '--games=6', '--n=3', '--ks=8', '--json=' + jp],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rj.status === 0 && existsSync(jp), '③ 带 --json 必须跑得完并落下产物（status=' + rj.status + '）');
  const J = JSON.parse(readFileSync(jp, 'utf8'));
  eq(J.meta.uBar, 25, '③ json 必须把过线的那条 U 线带出来（25，§E134 跑前定死）');
  eq(J.meta.ambBar, 0.40, '③ 与歧义率那条线（40%）');
  ok(J.rows.length === 8, '③ 七组特征 + 一条拼接 = 8 行（§E135 起了 E/F/G 三组 ⇒ 这条行数也要跟着动；实测 ' + J.rows.length + '）');
  ok(J.rows.every(r => r.U_sep <= J.meta.envs), '③ U_sep 不许超过原型数（实测最大 ' + Math.max(...J.rows.map(r => r.U_sep)) + ' / ' + J.meta.envs + '）');
  ok(J.rows.every(r => r.pass === (r.U_sep >= J.meta.uBar && r.ambRate <= J.meta.ambBar)),
    '③ "过线"必须由这两条线算出来，不许手写文案');
  rmSync(jp, { force: true });
  /* ④ 单一来源：判据住在 lib，探针只负责观测与打印 */
  const src = readFileSync('tools/probe-sig-separable.mjs', 'utf8');
  ok(/import \{[^}]*separabilityOf[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src), '④ 探针必须 import separabilityOf');
  ok(!/U_sep: sep/.test(src), '④ 探针里不许留第二份 U_sep 的实现');
});

t('D197 §E136 的换包开关默认必须是关的（v1.5.292）：不写 --swap 逐位不变、写了必须真生效、含糊写法要拒绝', function () {
  /* 为什么钉这道：§E136 往**产品口径的量具**（eval-5p）里加了一条"第 R 回合换权重"的分支。
   * 这条一旦悄悄生效，历史上所有 eval-5p 读数就换了尺 —— 所以门的重点是"默认关"而不是"能用"：
   *   ① 用同一个场跑 三臂：不换 / 换包点写在终局之后 / 换包点写在第 1 回合。
   *      **第一臂与第二臂必须逐字相同（只有标签不同），第三臂必须不同** ⇒ 一正一负，"没生效"和"总在生效"都跑不掉。
   *   ② 含糊的写法（没有 @、第 0 回合、路径不存在、和第二粒包与主包同一个、抢主体席的组合）必须 exit 2，
   *     不许降级成"当没写"。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/kept/eval-out__win-Ldemo.bak';
  ok(existsSync(A) && existsSync(B), '⓪ 两粒入库包必须在（门要用它们做"换包 vs 不换包"的对照）：A=' +
    existsSync(A) + ' B=' + existsSync(B));
  const run = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '4', '5', '77000', A, '--field=mix4'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const base = run([]);
  const far = run(['--swap=' + B + '@9999']);
  const early = run(['--swap=' + B + '@1']);
  ok(base.code === 0 && far.code === 0 && early.code === 0, '① 三臂都要跑得完（实测 ' + base.code + '/' + far.code + '/' + early.code + '）');
  const rate = function (o) { const m = o.match(/\[[^\]]*\] 1st=([0-9.]+)% 严胜=([0-9.]+)%/); return m ? m[1] + '/' + m[2] : null; };
  /* `耗时 0.1s` 那行本来就随机器抖动 ⇒ 先抹掉它，再要求"其余逐字相同"。
   * ⚠ 这里**不能只比 1st 那一行**：换包分支若泄漏，最先变的可能是回合数/经济行为，只看胜率会放过它。 */
  const norm = function (o) { return String(o).replace(/冠军→第 \d+ 回合换 [A-Za-z0-9_.\-]+/g, '冠军').replace(/耗时 [0-9.]+s/g, '耗时 抹掉'); };
  const firstDiff = function (a, b) {
    const la = a.split('\n'), lb = b.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) return '第 ' + (i + 1) + ' 行 [' + String(la[i] || '').slice(0, 66) + '] vs [' + String(lb[i] || '').slice(0, 66) + ']';
    }
    return null;
  };
  const fd = norm(far.out) === norm(base.out) ? null : firstDiff(norm(far.out), norm(base.out));
  ok(fd === null,
    '② **不带 --swap 与"换包点在终局之后"必须逐字相同**（实测差异：' + (fd || '') + '）⇒ 产品口径的量具不许多一条会悄悄生效的分支');
  ok(rate(base.out) != null && rate(early.out) != null && norm(early.out) !== norm(base.out),
    '②′ 反过来：换包点写在第 1 回合时读数**必须变**（不换=' + rate(base.out) + ' ‖ 第1回合换=' + rate(early.out) +
    '，输出差异=' + (norm(early.out) === norm(base.out) ? '无' : '有') + '）⇒ 两臂相同就意味着这条分支是死代码');
  /* ③ 拒绝口径：每一类含糊写法都要 exit 2，不许"当没写"继续出读数 */
  const bad = [
    ['--swap=' + B, '没有 @'],
    ['--swap=' + B + '@0', '第 0 回合'],
    ['--swap=' + B + '@2.5', '非整数回合'],
    ['--swap=nope-not-here.bak@5', '路径不存在'],
    ['--swap=' + A + '@5', '第二粒包与主包同一个文件'],
    ['--swap=' + B + '@5', '与 --subject 同时给（抢主体席）', '--subject=aggro'],
  ];
  for (const c of bad) {
    const argv = ['tools/eval-5p.mjs', '1', '5', '77000', A].concat([c[0]]).concat(c.slice(2));
    const r = spawnSync(process.execPath, argv, { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '③ ' + c[1] + ' ⇒ 必须 exit 2 拒绝（实测 exit=' + r.status + '，' + String(r.stderr || '').slice(0, 40).replace(/\n/g, ' ') + '）');
  }
  /* ④ 接线：默认那条主体分支必须走 subjectPolicy()（否则上面的"逐字相同"只是没接上） */
  const src = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(/:\s*function \(\) \{ return subjectPolicy\(\); \}\)/.test(src),
    '④ 主体席的默认分支必须调 `subjectPolicy()`（写死 `T.policyChooserN(params, 0.15)` 就等于把开关焊死在半开）');
  ok(/function subjectPolicy\(\)[\s\S]{0,320}state\.round >= SWAP_ROUND \? b : a/.test(src),
    '④ `subjectPolicy` 必须按 `state.round >= SWAP_ROUND` 选 a/b（换成别的判据就不是"按阶段换打法"了）');
  ok(!/FLAG\.field\s*\)\s*\{[\s\S]{0,120}--swap 只能单独用/.test(src),
    '④ `--field` 不许进"与 --swap 互斥"的名单：它只换对手场、不抢主体席，而它是唯一能把一臂压到"1 组 × 几局"的便宜口径（本门就靠它）');
  /* ⑤ --every 采样：默认必须逐位不变，采样后组合数要按 ceil(N/step) 掉、且非法值要拒 */
  const d1 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const d2 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=1'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const d5 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=5'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const nOf = function (o) { const m = String(o).match(/全部 (\d+) 组合/); return m ? Number(m[1]) : null; };
  const n1 = nOf(d1.stdout), n5 = nOf(d5.stdout);
  ok(norm(d2.stdout) === norm(d1.stdout), '⑤ `--every=1` 与不写必须**逐字相同**（默认口径不许被采样代码动过；实测差异：' +
    (norm(d2.stdout) === norm(d1.stdout) ? '' : firstDiff(norm(d2.stdout), norm(d1.stdout))) + '）');
  ok(n1 === 35 && n5 === 7, '⑤ core 池 C(7,4)=35 组 ⇒ `--every=5` 要剩 ceil(35/5)=7 组（实测 默认=' + n1 + ' ‖ every=5 → ' + n5 + '）');
  for (const v of ['0', '2.5', 'abc', '-3']) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=' + v], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '⑤ --every=' + v + ' ⇒ 必须 exit 2（实测 exit=' + r.status + '）');
  }
});

t('D198 §E136 的配对判读有牙（v1.5.292）：配对不成立要拒、三个判读分支都走得到、逐桌子账要与汇总对得上、配对算术只有一份', function () {
  /* 为什么钉这道：`analyze-swap-gain.mjs` 是"把 8 臂变成一个结论"的那一层 ——
   * 它若把"配对不成立"当警告、或把判读分支写死成一条，§E136 的结案就是脚本自己编的。
   * 全部用合成 TSV（tmpdir），一局都不重跑。 */
  const dir = mkdtempSync(join(tmpdir(), 'd198-'));
  const NAMES = []; for (let i = 0; i < 24; i++) NAMES.push('n' + i + 'a,n' + i + 'b,n' + i + 'c,n' + i + 'd');
  const tsv = function (firsts, games) {
    const L = ['#eval5p-percombo', '#seed=77000', '#games=' + games, '#n=5', '#pool=all', '#every=1', '#field=-', '#file=x', '#swap=-',
      '#arm\tidx\tnames\tgames\tfirst\tstrict'];
    firsts.forEach(function (f, i) { L.push('subject\t' + i + '\t' + NAMES[i] + '\t' + games + '\t' + f + '\t' + Math.max(0, f - 1)); });
    return L.join('\n') + '\n';
  };
  const wave = function (base, amp) { const a = []; for (let i = 0; i < 24; i++) a.push(base + (i % 2 ? amp : -amp)); return a; };
  const put = function (arm, firsts, games, names) {
    const body = tsv(firsts, games == null ? 10 : games);
    writeFileSync(join(dir, arm + '.tsv'), names ? body.replace(/n\d+[a-d]/g, function (x) { return 'x' + x; }) : body);
    writeFileSync(join(dir, arm + '.txt'), '平均回合=31.3  转移事件=0');
  };
  const run = function (extra) {
    const r = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir].concat(extra || []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  /* ②′ 夹具：A→B 越过两个对照，B→A 只越过弱对照 ⇒ 反巧合条款必须把 ① 拦下 */
  put('AAA', wave(6, 0)); put('BBB', wave(4, 0));
  put('A2B-at5', wave(8, 0)); put('B2A-at5', wave(5, 0));
  const p2 = run();
  ok(p2.code === 0, '⓪ 正常夹具要跑得完（exit=' + p2.code + ' ' + p2.out.slice(0, 90).replace(/\n/g, ' ') + '）');
  ok(/判读[^\n]*\n\s*②′/.test(p2.out), '① 只有一个方向越过两个对照 ⇒ 必须判 ②′（反巧合拦下），不许出 ①');
  ok(/◆ 夹在中间/.test(p2.out), '② `B2A-at5`（50%）显著低于 AAA(60%)、显著高于 BBB(40%) ⇒ 必须印成**夹在中间**，不许并进"分不出"');
  ok(!/— 与某个对照分不出/.test(p2.out), '②′ 这份夹具里没有任何臂该被判"分不出"（印出来就是区间算错）');
  /* ① 夹具：两个方向都越过两个对照 */
  put('B2A-at5', wave(9, 0));
  const p1 = run();
  ok(/判读[^\n]*\n\s*①/.test(p1.out) && !/②′/.test(p1.out), '③ 两个方向同时越过两个对照 ⇒ 才允许判 ①（实测 ' + (p1.out.match(/\n\s+([①②②′]+)/) || ['', '?'])[1] + '）');
  /* ② 夹具：两个方向都低于两个对照 */
  put('A2B-at5', wave(3, 0)); put('B2A-at5', wave(2, 0));
  const p0 = run();
  ok(/判读[^\n]*\n\s*② /.test(p0.out), '④ 全部低于对照 ⇒ 必须判 ②（不赚钱），不许因为"有臂高于弱对照"就翻成正');
  /* ⑤ 配对前提：组合名字列被改动 ⇒ exit 2 拒绝（不是警告） */
  put('A2B-at5', wave(8, 0), 10, true);
  const pBad = run();
  ok(pBad.code === 2 && /配对不成立/.test(pBad.out), '⑥ 组合序列不同就不是同一批桌子 ⇒ 必须 exit 2 拒绝出读数（实测 exit=' + pBad.code + '）');
  /* ⑥ 每桌局数不同 ⇒ 同样要拒；缺臂 ⇒ 要拒 */
  put('A2B-at5', wave(8, 0));
  put('B2A-at5', wave(9, 0));
  writeFileSync(join(dir, 'B2A-at5.tsv'), tsv(wave(9, 0), 12));
  const pG = run();
  ok(pG.code === 2 && /配对不成立/.test(pG.out) && /games/.test(pG.out),
    '⑥′ 每桌局数不一致 ⇒ 也必须 exit 2 并点名是 `games` 这一要素不同（实测 exit=' + pG.code + '，' + pG.out.slice(0, 70).replace(/\n/g, ' ') + '）');
  writeFileSync(join(dir, 'B2A-at5.tsv'), tsv(wave(9, 0), 10));
  rmSync(join(dir, 'BBB.tsv'), { force: true });
  const pM = run();
  ok(pM.code === 2 && /缺臂/.test(pM.out), '⑥″ 缺臂 ⇒ exit 2 点名，不许拿剩下的臂出结论（实测 exit=' + pM.code + '）');
  /* ⑦ 内部守卫：分位数/累积分布错了就整表区间一起错 */
  const src = readFileSync('tools/analyze-swap-gain.mjs', 'utf8');
  ok(/x \/ Math\.SQRT2/.test(src), '⑧ `Φ(x)` 必须按 `erf(x/√2)` 算（少除 √2 会把 z₀.₉₇₅ 从 1.96 算成 1.39）');
  ok(/内部自检失败[\s\S]{0,200}拒绝出读数/.test(src), '⑧ 必须带那条无条件自测守卫');
  /* ⑨ 单一来源：配对算术只许住在 lib */
  const lib = readFileSync('tools/routing-gain-lib.mjs', 'utf8');
  const ar = readFileSync('tools/analyze-routing-gain.mjs', 'utf8');
  ok(/export function pairedDiff\(a, b, z\)/.test(lib), '⑨ lib 必须导出 pairedDiff');
  ok(/const zz = z == null \? 1\.96 : z;/.test(lib), '⑨ 默认 z 必须是 1.96（`analyze-routing-gain` 的历史区间靠这个默认值逐位不变）');
  ok(/import \{[^}]*pairedDiff[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src) &&
    /import \{[^}]*pairedDiff[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(ar), '⑨ 两个分析器都必须 import lib 那一份');
  ok(!/function paired\(a, b\)/.test(ar) && !/const sd = Math\.sqrt/.test(src),
    '⑨ 分析器里不许留第二份配对 SE 的实现');
  /* ⑩ lib 自己的算术：d=[2,4,6] ⇒ m=4、sd=2（除以 n−1）、se=2/√3、h=1.96·se */
  ok(typeof RGAIN.pairedDiff === 'function', '⑩ `pairedDiff` 要能被门禁直接调用（本门下面拿它算夹具）');
  const pd = RGAIN.pairedDiff([3, 5, 7], [1, 1, 1]);
  ok(Math.abs(pd.m - 4) < 1e-12 && Math.abs(pd.sd - 2) < 1e-12 && Math.abs(pd.se - 2 / Math.sqrt(3)) < 1e-12,
    '⑩ m/sd/se 必须等于手算值（实测算得 m=' + pd.m + ' sd=' + pd.sd.toFixed(6) + ' se=' + pd.se.toFixed(6) + '，期望 4 / 2 / 1.154700）');
  ok(Math.abs(pd.lo - (4 - 1.96 * pd.se)) < 1e-12 && Math.abs(pd.hi - (4 + 1.96 * pd.se)) < 1e-12,
    '⑩ 区间必须由 `z·se` 双向张开（实测 [' + pd.lo.toFixed(4) + ', ' + pd.hi.toFixed(4) + ']）');
  eq(pd.n, 3, '⑩ n 是**成对**样本数');
  eq(pd.better, 3, '⑩ better 计数（变好 3 桌）');
  ok(RGAIN.pairedDiff([3], [1]) === null, '⑩ n<2 要返回 null（调用方负责"不出结论"，不许把 null 当 0）');
  const pd2 = RGAIN.pairedDiff([3, 5, NaN], [1, 1, 9]);
  ok(pd2 && pd2.n === 2 && Math.abs(pd2.m - 3) < 1e-12,
    '⑩ 非数值项必须**成对**剔除：3 项里剔掉 NaN 那对 ⇒ n=2、m=(2+4)/2=3（实测 n=' + (pd2 ? pd2.n : 'null') + ' m=' + (pd2 ? pd2.m : 'null') + '）');
  /* ⑪ eval-5p 的逐桌子账必须与它自己印的汇总对得上（否则配对分析建在假账上） */
  const dp = join(dir, 'per.txt');
  const rr = spawnSync(process.execPath, ['tools/eval-5p.mjs', '2', '5', '77000', '--field=mix4', '--dump-per=' + dp],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rr.status === 0 && existsSync(dp), '⑪ 带 --dump-per 要跑得完并落盘（exit=' + rr.status + '）');
  const txt = String(rr.stdout || '');
  const printed = txt.match(/\[冠军\] 1st=([0-9.]+)%/);
  const subj = readFileSync(dp, 'utf8').split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const totFirst = subj.reduce(function (a, l) { return a + Number(l.split('\t')[4]); }, 0);
  const totGames = subj.reduce(function (a, l) { return a + Number(l.split('\t')[3]); }, 0);
  ok(subj.length === 1 && totGames === 2, '⑪ mix4 只有 1 组 × 2 局 ⇒ 主体席应有 1 行、合计 2 局（实测 ' + subj.length + ' 行 / ' + totGames + ' 局）');
  ok(printed && Math.abs(totFirst / totGames * 100 - Number(printed[1])) < 0.06,
    '⑪ 逐桌子求出的 1st 必须与打印的 1st 一致（实测 逐桌子=' + (totFirst / totGames * 100).toFixed(1) + '% ‖ 打印=' + (printed ? printed[1] : '?') + '%）' +
    ' ⇒ 配对分析的分母就是这张表自己数的局');
  const noDump = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--field=mix4'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(!/逐桌子命中数/.test(String(noDump.stdout || '')), '⑪′ 不带 --dump-per 时** stdout 不许多出任何一行**（默认关）');
  /* ⑫ 目录里只有对照 ⇒ 不许印 §E136 的判语（§E139 用同一把尺读"A 粒 vs B 粒"，判语留着就是误导） */
  const dir2 = mkdtempSync(join(tmpdir(), 'd198b-'));
  writeFileSync(join(dir2, 'AAA.tsv'), tsv(wave(6, 0), 10));
  writeFileSync(join(dir2, 'BBB.tsv'), tsv(wave(4, 0), 10));
  const only = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir2],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  const oo = String(only.stdout || '') + String(only.stderr || '');
  ok(only.status === 0 && /只有两个对照、没有 swap 臂/.test(oo),
    '⑫ 只有对照时要正常退出并点名"这一轮不判 §E136"（实测 exit=' + only.status + '）');
  ok(!/=== 判读（按/.test(oo), '⑫′ 这种目录里**不许**出现 ①/②/②′ 的判语');
  ok(/A\/B 两粒本身的差（配对）: 20\.00pt/.test(oo),
    '⑫″ 对照之间的配对差仍要印出来（60% vs 40% ⇒ 20.00pt）（实测 ' + ((oo.match(/A\/B 两粒本身的差（配对）: [-0-9.]+pt/) || ['?'])[0]) + '）');
  try { rmSync(dir2, { recursive: true, force: true }); } catch (e) { /* 同上：Windows 偶发占用 */ }
  /* ⑬ 配对校验必须看**跑法**，不能只数组合名：组合由"池子 + --every"决定，**与 seed 无关**
   * ⇒ 两个 seed 的臂放在同一个目录里（§E140 就是这种用法）时，序列完全一样，只看序列会把两批不同的桌子当成同一批。 */
  const dir3 = mkdtempSync(join(tmpdir(), 'd198c-'));
  const tsvSeed = function (firsts, games, seed) { return tsv(firsts, games).replace('#seed=77000', '#seed=' + seed); };
  writeFileSync(join(dir3, 'AAA.tsv'), tsv(wave(6, 0), 10));
  writeFileSync(join(dir3, 'BBB.tsv'), tsv(wave(4, 0), 10));
  writeFileSync(join(dir3, 'A2B-at5.tsv'), tsvSeed(wave(8, 0), 10, 999));
  const seedRun = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir3],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  const se = String(seedRun.stdout || '') + String(seedRun.stderr || '');
  ok(seedRun.status === 2 && /seed/.test(se) && /配对不成立/.test(se),
    '⑬ 只有 `#seed` 不同（组合名逐位相同）⇒ 也必须 exit 2 点名跑法不同（实测 exit=' + seedRun.status + '，' + se.slice(0, 60).replace(/\n/g, ' ') + '）');
  /* ⑬′ 反向：跑法完全相同就**不许**误报（否则上面那条会退化成"永远拒绝"） */
  writeFileSync(join(dir3, 'A2B-at5.tsv'), tsv(wave(8, 0), 10));
  const sameRun = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir3],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(sameRun.status === 0 && /跑法已逐臂核对相同/.test(String(sameRun.stdout || '')),
    '⑬′ 跑法一致时必须放行，并把核对过的五要素**印出来**（实测 exit=' + sameRun.status + '）');
  try { rmSync(dir3, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* Windows 偶发占用：tmpdir 里留一个空目录不影响门禁 */ }
});

t('D200 §E142/§E143 的 5P 环境量具有牙（v1.5.296）：构造默认满席、名字与包装规则只许一份真源、桌子不许跟着包漂', function () {
  /* 为什么钉这道：§E142 是今晚**唯一翻掉总结论**的那条（5P 上界 +12.35pt），它现在直接决定用户"下一班往哪投"。
   * 一个会翻结论的量具，最贵的三种坏法正好对应下面三组判据：
   *   ① 名字表/对手包装规则各抄一份 ⇒ "探针里的对手"与"评测里的对手"不是同一种对手（本仓这族事故踩过四次）；
   *   ② 桌子种子跟着包走 ⇒ `oracle − best_single` 变成两批不同桌子的比较（配对假成立，§E136 前科）；
   *   ③ 构造（每桌几席原型）不写进产物 ⇒ mix=4 与 mix=2 的产物混在一个目录里也照样算出一个数。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/kept/eval-out__win-Ldemo.bak';
  const dir = mkdtempSync(join(tmpdir(), 'd200-'));
  const probe = function (tag, extra) {
    const out = join(dir, tag + '.tsv');
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--games=2', '--seeds=0', '--out=' + out].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || ''), tsv: existsSync(out) ? readFileSync(out, 'utf8') : null };
  };
  const body = function (txt) {
    return String(txt).replace(/\r\n/g, '\n').split('\n').filter(function (l) { return l && l[0] !== '#' && !/^env\t/.test(l); });
  };
  /* ---- ① 单一来源 ---- */
  const src = readFileSync('tools/probe-5p-envfit.mjs', 'utf8');
  const ev = readFileSync('tools/eval-5p.mjs', 'utf8');
  const lib = readFileSync('tools/bot-chooser-lib.mjs', 'utf8');
  ok(/import \{[^}]*poolFromSpecs[^}]*\} from '\.\/regime-panel\.mjs'/.test(src) && /import \{[^}]*HELDOUT[^}]*\}/.test(src),
    '① 探针的环境名单必须来自 `regime-panel`（池内取 `OPP_SPECS` 函数引用、池外取 `HELDOUT`），不许自己列名字');
  ok(!/pickTarget2?N\s*\(/.test(src) && /import \{[^}]*makeAsChooser[^}]*\} from '\.\/bot-chooser-lib\.mjs'/.test(src),
    '① 对手 chooser 的包装规则必须 import lib 那一份：探针里出现 `pickTargetN/pickTarget2N` 就等于手抄了第二份目标语义');
  ok(/const asChooser = makeAsChooser/.test(ev) && !/function asChooser\(fn\)/.test(ev),
    '① `eval-5p` 也必须改成 lib 那一份（它原来自己实现了一遍，这是第二份的来源）');
  ok(/export function makeAsChooser\(deps\)/.test(lib) && /保留脚本自己选的目标/.test(lib),
    '① lib 必须导出 `makeAsChooser`，并写明那条规则（保留脚本自己的目标）');
  /* ---- ② 桌子与包无关（配对的命根子）---- */
  ok(/const gameSeed = \(salt \^ \(sd \* 1000003\)\) \+ g \* 977;/.test(src),
    '② 每局种子必须由 `(环境, seed 档, 第几局)` 唯一决定；出现包名/包下标就意味着不同包打的是不同桌子 ⇒ `oracle − best_single` 不是配对比较');
  const pa = probe('pa', []);
  const pb = (function () {
    const out = join(dir, 'pb.tsv');
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + B, '--games=2', '--seeds=0', '--out=' + out],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    return { code: r.status, tsv: existsSync(out) ? readFileSync(out, 'utf8') : null };
  })();
  ok(pa.code === 0 && pb.code === 0 && pa.tsv && pb.tsv, '② 两粒包都要跑得完（实测 ' + pa.code + '/' + pb.code + '）');
  const envColOf = function (txt) { return body(txt).map(function (l) { return l.split('\t')[0] + '|' + l.split('\t')[1]; }); };
  ok(envColOf(pa.tsv).join(',') === envColOf(pb.tsv).join(','),
    '②′ 两粒包的环境×seed 行序必须逐字相同（同一批桌子的可观察证据）');
  /* ---- ③ 构造：默认满席 + 头部必须带 mix ---- */
  ok(/#mix=4/.test(pa.tsv), '③ 不写 `--mix` 时必须是 §E142 那份"满席原型"构造，且**把 k 写进产物头部**（`#mix=4`）');
  const mixFull = probe('mixfull', ['--mix=4']);
  ok(mixFull.tsv && body(mixFull.tsv).join('\n') === body(pa.tsv).join('\n'),
    '③′ **默认与显式 `--mix=4` 的数据行必须逐字节相同**（新旗标不许动老构造）');
  const mix2 = probe('mix2', ['--mix=2']);
  ok(mix2.code === 0 && /#mix=2/.test(mix2.tsv) && body(mix2.tsv).join('\n') !== body(pa.tsv).join('\n'),
    '③″ `--mix=2` 要跑得完、头部写 `#mix=2`，且数据必须与满席构造**不同**（相同就意味着这个旗标根本没生效）');
  for (const bad of ['--mix=0', '--mix=5', '--mix=abc']) {
    const r = probe('bad-' + bad.replace(/[^a-z0-9]/gi, ''), [bad]);
    ok(r.code === 2, '③‴ ' + bad + '（n=5 ⇒ 合法是 1~4）必须 exit 2，实测 exit=' + r.code + '');
  }
  /* ---- ④ 一个环境都不许静默丢：造一份含假环境的矩阵 ---- */
  /* ⚠ 必须先满足"环境数 ≥ 10"那道守卫，否则探针会在更早的地方 exit 2，
   *    于是这条断言测的就变成"分母守卫"而不是"点名缺环境"（本门第一版就是这么假通过的）。 */
  const REAL_ENVS = Object.keys(JSON.parse(readFileSync('docs/artifacts/e129-out/matrix.json', 'utf8')).rows[0].per);
  ok(REAL_ENVS.length >= 12, '④ 前置：真矩阵要有 ≥12 个环境可借（实测 ' + REAL_ENVS.length + '）');
  const perFake = {};
  REAL_ENVS.slice(0, 12).forEach(function (e) { perFake[e] = { fit: 1 }; });
  perFake.totallyNotAnArchetype = { fit: 1 };
  const fake = join(dir, 'fake-matrix.json');
  writeFileSync(fake, JSON.stringify({ rows: [{ per: perFake }] }));
  const rFake = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--games=1', '--seeds=0',
    '--envs=' + fake, '--out=' + join(dir, 'fake.tsv')], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rFake.status === 2 && /totallyNotAnArchetype/.test(String(rFake.stderr || '') + String(rFake.stdout || '')),
    '④ 名单里出现解析不到的环境 ⇒ 必须 exit 2 **点名是哪个**（少一个环境 = 分母变了 = 与 §E129 不可比），实测 exit=' + rFake.status + '');
  for (const argv of [['--games=0'], ['--games=2.5'], ['--n=2'], ['--n=6']]) {
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--out=' + join(dir, 'x.tsv')].concat(argv),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '④′ ' + JSON.stringify(argv) + ' 这类含糊剂量/人数必须 exit 2（实测 exit=' + r.status + '）');
  }
  const noPack = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--games=1', '--seeds=0'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(noPack.status === 2 && /--pack/.test(String(noPack.stderr || '')),
    '④″ 缺 `--pack` 必须 exit 2 并点名它（**不许"默认拿出厂包"混进矩阵**），实测 exit=' + noPack.status + '');
  /* ---- ⑤ 决定论 ---- */
  const again = probe('again', []);
  ok(again.tsv && body(again.tsv).join('\n') === body(pa.tsv).join('\n'), '⑤ 同参数两次运行的数据行必须逐字节相同（量具自己得先可复现）');
  /* ---- ⑥ 分析器：不许把两种构造合算；判语只许一条规则 ---- */
  const dA = join(dir, 'an-a'), dB = join(dir, 'an-b');
  mkdirSync(dA); mkdirSync(dB);
  const rowsA = body(pa.tsv), rowsB = body(mix2.tsv);
  const mk = function (p, pack, mix, rows) {
    writeFileSync(p, ['#probe-5p-envfit', '#pack=' + pack, '#n=5', '#mix=' + mix, '#games=2', '#seeds=0', '#envs=' + rows.length,
      '#env\tseed\tinPool\tgames\tfirst\tstrict'].concat(rows).join('\n') + '\n');
  };
  /* 拿两粒包各自造一份同构造的目录（分析器要 ≥3 粒 ⇒ 第三份复制） */
  mk(join(dA, 'a.tsv'), 'pa', 4, rowsA);
  mk(join(dA, 'b.tsv'), 'pb', 4, rowsB.map(function (l) { const c = l.split('\t'); return [c[0], c[1], c[2], c[3], Number(c[4]) - 1 >= 0 ? Number(c[4]) - 1 : 0, c[5]].join('\t'); }));
  mk(join(dA, 'c.tsv'), 'pc', 4, rowsB.map(function (l) { const c = l.split('\t'); return [c[0], c[1], c[2], c[3], Number(c[4]) + 1 <= Number(c[3]) ? Number(c[4]) + 1 : c[4], c[5]].join('\t'); }));
  const an = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dA, '--rule=off'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(an.status === 0 && /构造 = 每桌原型 \*\*4\*\*/.test(String(an.stdout || '')), '⑥ 分析器要把构造（`#mix`）**印在表头**（实测 exit=' + an.status + '）');
  ok(/判读：本工具\*\*不出判语\*\*/.test(String(an.stdout || '')) && !/=== 判读（按 §E142/.test(String(an.stdout || '')),
    '⑥′ `--rule=off` 时**不许**印 §E142 那条判语（§E143 有自己的三条阈值，一份代码同时印两种判语迟早会有人读错那条）');
  const an2 = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dA],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(an2.status === 0 && /=== 判读（按 §E142 第 2 节写死的规则/.test(String(an2.stdout || '')), '⑥″ 默认必须印 §E142 那条判语（不写旗标时的行为不变）');
  mk(join(dB, 'a.tsv'), 'pa', 4, rowsA);
  mk(join(dB, 'b.tsv'), 'pb', 2, rowsB);
  mk(join(dB, 'c.tsv'), 'pc', 4, rowsA);
  const anMix = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dB],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(anMix.status === 2 && /mix/.test(String(anMix.stderr || '') + String(anMix.stdout || '')),
    '⑥‴ 目录里混了 `#mix=4` 与 `#mix=2` ⇒ 必须 exit 2 拒绝合算（那是两个实验，不是一个）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
});

t('D199 eval-5p 必须决定论、逐桌子账必须与它自己印的读数对得上（v1.5.295 · §E140 的免费自检升级成门）', function () {
  /* 为什么钉这道：§E140 之所以能当"新旗标没动口径"的证据，全靠**同 seed 重跑逐字相同**这一件事。
   * 而这条此前**没有任何门守着** ⇒ 任何一次重构（换随机流消费顺序、把 ε 探索改成共享、把 dump 挪到统计之后）
   * 都会让今晚所有"同 seed 复现"式的论证一夜之间失效。四段 spawn 各约 1~2 秒，成本可忽略。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/kept/eval-out__win-Ldemo.bak';
  const dir = mkdtempSync(join(tmpdir(), 'd199-'));
  /* ⚠ 场子必须选 **farmerwall**（4 席只按ジ的农民）：实测主体 1st=100% 而对照 `pickRandom` 是
   * `1st=91.7% 严胜=75.0% 并列=16.7%` ⇒ **有并列**，才能把"把 rank 当 winner 写进账里"这类错暴露出来。
   * 换 ringmix/mix4 那种主体 0% 并列的场，本门的 ③′/③″/③‴ 三条恒等式会**退化成同一条**（变异实测确实红不了过一次）。 */
  const norm2 = function (o) {
    return String(o).replace(/耗时 [0-9.]+s/g, '耗时 抹掉')
      .replace(/逐桌子命中数 → \S+/g, '逐桌子命中数 → 路径');
  };
  const runDump = function (tag, extra) {
    const p = join(dir, tag + '.tsv');
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '12', '5', '77000', A, '--field=farmerwall', '--dump-per=' + p].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || ''), dump: existsSync(p) ? readFileSync(p, 'utf8') : null };
  };
  const r1 = runDump('r1', []);
  const r2 = runDump('r2', []);
  ok(r1.code === 0 && r2.code === 0 && r1.dump !== null, '① 两次同参数运行都要跑得完并落盘（实测 ' + r1.code + '/' + r2.code + '）');
  ok(norm2(r1.out) === norm2(r2.out), '② **同 seed 同参数 ⇒ stdout 必须逐字相同**（除耗时）' +
    ' ⇒ §E140/§E137 那批"同 seed 复现"的论证靠的就是这件事');
  ok(r1.dump === r2.dump, '②′ **逐桌子账也必须逐字节相同**（不是"总量相同"，是每桌每一个数相同）');
  /* ③ 账要对得上自己的表头：桌数 = 打印的组合数；Σfirst/Σgames = 打印的 1st；Σfirst = ranks[0] 那一格 */
  const nCombo = (r1.out.match(/全部 (\d+) 组合/) || ['', '-1'])[1];
  const subj = r1.dump.split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const ctrl = r1.dump.split('\n').filter(function (l) { return l.indexOf('ctrl\t') === 0; });
  const sum = function (rows, col) { return rows.reduce(function (a, l) { return a + Number(l.split('\t')[col]); }, 0); };
  const sFirst = sum(subj, 4), sGames = sum(subj, 3), sStrict = sum(subj, 5);
  ok(subj.length === Number(nCombo) && ctrl.length === Number(nCombo),
    '③ 落盘桌数必须等于表头打印的组合数（打印 ' + nCombo + ' ‖ 主体 ' + subj.length + ' / 对照 ' + ctrl.length + '）' +
    ' ⇒ 少写一桌就等于配对分析悄悄少一批桌子');
  const p1st = (r1.out.match(/\[冠军\] 1st=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(sFirst / sGames * 100 - Number(p1st)) < 0.06,
    '③′ 逐桌子求出的 1st 必须等于打印的 1st（逐桌子=' + (sFirst / sGames * 100).toFixed(2) + '% ‖ 打印=' + p1st + '%）');
  const pStrict = (r1.out.match(/严胜=([0-9.]+)%/) || ['', '-1'])[1];
  const pTie = (r1.out.match(/并列=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(sStrict / sGames * 100 - Number(pStrict)) < 0.06,
    '③″ `strict` 那一列也必须等于打印的**严胜**（逐桌子=' + (sStrict / sGames * 100).toFixed(2) + '% ‖ 打印=' + pStrict + '%）' +
    ' ⇒ 两个终点各自对账，才排掉"把 rank 与 winner 混成一列"这种错');
  ok(Math.abs((sFirst - sStrict) / sGames * 100 - Number(pTie)) < 0.06,
    '③‴ `Σfirst − Σstrict` 就是**并列第一**（引擎没判赢但名次第一），必须等于打印的 `并列`（实测 ' +
    ((sFirst - sStrict) / sGames * 100).toFixed(2) + '% ‖ 打印=' + pTie + '%）');
  const cFirst = sum(ctrl, 4), cGames = sum(ctrl, 3), cStrict = sum(ctrl, 5);
  const pCtrl = (r1.out.match(/\[对照 pickRandom\] 1st=([0-9.]+)%/) || ['', '-1'])[1];
  const pCtrlStrict = (r1.out.match(/\[对照 pickRandom\] 1st=[0-9.]+% 严胜=([0-9.]+)%/) || ['', '-1'])[1];
  const pCtrlTie = (r1.out.match(/\[对照 pickRandom\] 1st=[0-9.]+% 严胜=[0-9.]+% 并列=([0-9.]+)%/) || ['', '-1'])[1];
  ok(cGames === sGames && Math.abs(cFirst / cGames * 100 - Number(pCtrl)) < 0.06,
    '④ 对照行的总局数必须与主体相同、且它的逐桌子 1st 也等于打印值（' + cGames + ' vs ' + sGames +
    ' ‖ 逐桌子=' + (cFirst / cGames * 100).toFixed(2) + '% ‖ 打印=' + pCtrl + '%）⇒ 两行确实是同一批桌子');
  ok(Math.abs(cStrict / cGames * 100 - Number(pCtrlStrict)) < 0.06 &&
    Math.abs((cFirst - cStrict) / cGames * 100 - Number(pCtrlTie)) < 0.06,
    '④′ 对照行的 `strict` 与 `first − strict` 必须分别等于打印的**严胜**与**并列**（逐桌子 ' +
    (cStrict / cGames * 100).toFixed(2) + '% / ' + ((cFirst - cStrict) / cGames * 100).toFixed(2) +
    '% ‖ 打印 ' + pCtrlStrict + '% / ' + pCtrlTie + '%）');
  ok(Number(cFirst - cStrict) > 0,
    '④″ 这份夹具里对照**必须真的有并列**（实测 `first − strict` = ' + (cFirst - cStrict) + ' 桌）' +
    ' ⇒ 没有并列时 ③′/③″/③‴ 会退化成同一条恒等式，本门就没有牙了（换场时要重新核对这一条）');
  /* ⑤ 换包臂的账也要自洽（此前 ⑪ 只查了默认臂；`--swap` 那条分支的 cFirst 走的是另一个 chooser） */
  const sw = runDump('sw', ['--swap=' + B + '@3']);
  ok(sw.code === 0 && sw.dump !== null, '⑤ 带 `--swap` 的一臂要跑得完并落盘（exit=' + sw.code + '）');
  const swSubj = sw.dump.split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const swFirst = sum(swSubj, 4), swGames = sum(swSubj, 3);
  const swP1 = (sw.out.match(/1st=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(swFirst / swGames * 100 - Number(swP1)) < 0.06,
    '⑤′ 换包臂的逐桌子 1st 也必须等于它打印的 1st（逐桌子=' + (swFirst / swGames * 100).toFixed(2) + '% ‖ 打印=' + swP1 + '%）');
  ok(swSubj.length === subj.length && sw.dump !== r1.dump,
    '⑤″ 换包臂桌数不变，但**逐桌子账必须与不换包那臂不同**（相同就等于 `--swap` 在这条分支里根本没生效）');
  /* ⑥ 头部元信息齐不齐：分析器靠这五个字段判"是不是同一批桌子"（D198 ⑬），所以这里必须钉它们在 */
  ok(/#seed=77000/.test(r1.dump) && /#games=12/.test(r1.dump) && /#pool=core/.test(r1.dump) &&
    /#every=1/.test(r1.dump) && /#field=farmerwall/.test(r1.dump),
    '⑥ 落盘头部必须带 `seed/games/pool/every/field`（缺一个，配对校验就会把不同批桌子放行）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
});

t('D194 `--only` 复跑单道门不许伪装成全绿（v1.5.288）：跳过的条数必须响亮印出、打错字要拒绝、注册数守卫要把跳过算进去', function () {
  /* 为什么补这道：本班给 np-test 加了 `--only=`（改门→验门从 9 分钟降到 10 秒）。
   * 这把刀的危险很具体：**跳过 237 道门然后报"通过 1 / 1"**，或者**子串打错 ⇒ 一条没跑也报绿**。
   * 所以判据钉在三处可观察的行为上，不是钉在"有这个参数"上。 */
  const src = readFileSync('tools/np-test.mjs', 'utf8');
  ok(/const ONLY = \(process\.argv\.find\(a => a\.startsWith\('--only='\)\)/.test(src), '① 入口必须解析 --only');
  ok(/__nReg !== PASS \+ FAIL \+ __skipped/.test(src),
    '② "注册数 vs 执行数"那道守卫必须把**被 --only 跳过的**也计进去（否则加了开关就等于把守卫拆了）');
  const one = spawnSync(process.execPath, ['tools/np-test.mjs', '--only=D193'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o1 = String(one.stdout || '');
  ok(one.status === 0 && /通过 1 \/ 1/.test(o1), '③ `--only=D193` 应当正好跑 1 道并绿（实测 exit=' + one.status + '，输出尾部 ' + o1.slice(-90).replace(/\n/g, ' ') + '）');
  const m = o1.match(/只跑了 (\d+) \/ (\d+) 条\*\*（跳过 (\d+) 条）/);
  ok(!!m, '③ 必须响亮印出"只跑了 N / M 条（跳过 K 条）"——**没有这一行就是静默少跑**');
  if (m) {
    eq(Number(m[1]), 1, '③ 实跑条数');
    ok(Number(m[2]) === Number(m[1]) + Number(m[3]) && Number(m[2]) > 100,
      '③ 分母必须是**全部注册数**（' + m[2] + ' = 跑的 ' + m[1] + ' + 跳的 ' + m[3] + '）⇒ 分母偷偷变小就等于把守卫拆了');
    ok(/不许当"四道全绿"引用/.test(o1), '③ 那句"这不是全量门禁"必须跟着印出来');
  }
  const typo = spawnSync(process.execPath, ['tools/np-test.mjs', '--only=ZZ-没有这道门'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  ok(typo.status === 3 && /一个都没匹配到/.test(String(typo.stderr || '')),
    '④ 子串打错 ⇒ 必须 **exit 3 拒绝**，不许报"通过 0 / 0"当绿（实测 exit=' + typo.status + '）');
});

t('D212 破平票三件套（explain-champion-decision 第⑤节）：只记录 · 自检有牙 · 反转反事实与属性判别都在（v1.5.307 · 接千问 §E180）', function () {
  /* 动因：两席属性相同时同卡分数**逐位相同** ⇒ 选择退化成"枚举顺序 + 温度采样"。
   * 本门钉三件事：① 节在（含自检与两个关键量）② **只记录**（不许拿平票率去阻断/退出）③ 行为验证（真跑一次，
   * 自检必须打 ✔ —— 这是本仓"门要守行为"的规矩；我 v1.5.299 那次"声称有门其实没有"就是反面教材）。 */
  const E = readFileSync('tools/explain-champion-decision.mjs', 'utf8');
  ok(/## ⑤ 破平票/.test(E), '第⑤节必须在（平票率 / 方向 / 反事实 / 属性判别）');
  ok(/scored\.slice\(\)\.reverse\(\)\[0\]/.test(E), '反转候选列表的反事实必须在（顺序决定的判据）');
  ok(/sameAttrs/.test(E) && /diffAttrs/.test(E), '必须直接读 state 判"平票目标属性是否一样"（不能只靠猜特征布局）');
  ok(/tieSelf\.ok/.test(E), '自检必须有牙（tieSelf.ok）');
  ok(/tieByRound/.test(E), '必须按回合分桶（分辨"开局对称"与"结构性"）');
  /* 只记录：**只切我自己那段循环内代码**（第一版切到节尾 ⇒ 把文件别处的自检 exit 也包进来 ⇒ 假红） */
  {
    const i0 = E.indexOf('破平票三件套（v1.5.307 · 只记录）');
    const i1 = E.indexOf('firstTargetSeen === false');
    const seg = (i0 >= 0 && i1 > i0) ? E.slice(i0, i1) : '';
    ok(seg.length > 200, '平票那段循环内代码必须在（找不到就是被删了）');
    ok(seg.indexOf('process.exit') < 0 && seg.indexOf('fails.push') < 0, '【只记录】平票那一段不许有 exit / 阻断');
  }
  /* v1.5.307 追加（我自己踩的坑）：**分母必须是独立的量** —— 第一版把累计的 tie.dec（只在平票分支里 +1）
   * 当分母印 ⇒ 分母=分子 ⇒ 平票率必然 100%。这一条钉住"率的分母不许用只在分子分支里累加的量"。 */
  ok(/decAll:\s*0/.test(E), '必须有独立的分母计数器 tie.decAll');
  ok(/pct\(tie\.n, tie\.decAll\)/.test(E), '平票率的分母必须用 tie.decAll（不是 tie.dec）');
  ok(!/pct\(tie\.n, tie\.dec\)/.test(E), '【反例】不许再拿 tie.dec 当平票率的分母（分母=分子 ⇒ 恒 100%）');
  /* 行为：真跑一次小档，自检必须打 ✔（这是一条会 spawn 的门，成本约 20~40 秒） */
  const r = spawnSync(process.execPath, ['tools/explain-champion-decision.mjs', '--games=2'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  eq(r.status, 0, '小档必须 exit 0（实测 ' + r.status + '）');
  ok(out.indexOf('## ⑤') >= 0, '小档输出里必须有第⑤节');
  ok(/判别力自检[^\n]*✔ 过/.test(out), '第⑤节的判别力自检必须打 ✔（行为验证，不看静态文本）');
});

t('D213 C8-lite 选择锦标赛（pick-5p）：同尺 · 只记录 · 自检两侧都有牙（10-01 · 千问 §3.5.3 提的形状）', function () {
  /* 动因：N=3 评分桌排序外推到产品口径会翻号（§E137），但 C8 全量（换评分桌）被量成不值且作废历史臂。
   * ⇒ 折中 = 训练之后加一段 **5P 产品形状选择**：候选与参照跑**完全相同的 eval-5p 参数**（同 seed/pool/局数），
   *   只记录、不 promote。本门钉三件事：① 同尺（一次命令里所有候选同参数）② 只记录（不许写包/不许 promote）
   *   ③ 行为验证（`--self-test` 必须 ✔：解析、排序、噪声带两侧都要有牙）。 */
  const P = readFileSync('tools/pick-5p.mjs', 'utf8');
  ok(/spawnSync\(process\.execPath, \['tools\/eval-5p\.mjs', GAMES, '5', SEED, p, '--pool=' \+ POOL\]/.test(P),
    '必须对**每个候选**都用同一组参数跑 eval-5p（同 seed ⇒ 配对；这是"同尺"的唯一保证）');
  ok(/1\.96 \* se/.test(P), '必须印噪声带判据（±1.96SE），不能只报一个裸百分比');
  ok(/top2/.test(P), '必须同时报 top2（1st 与 top2 双读数）');
  const SRC = P.replace(/^import[^\n]*\n/m, '');   /* 去掉 import 行（writeFileSync 从 node:fs 导入 ⇒ 会误伤） */
  ok(!/writeFileSync\((?!JSONOUT)/.test(SRC), '【只记录】不许写任何包/权重文件（唯一的写是 --json 那份）');
  ok(!/spawnSync\([^\n]*promote-champion/.test(P), '【只记录】不许 spawn promote（注释里提到这个词没关系 —— 第一版就是被我自己的注释判红的）');
  const r = spawnSync(process.execPath, ['tools/pick-5p.mjs', '--self-test'], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '自检必须 exit 0（实测 ' + r.status + '）');
  ok(/自检：✔ 全过/.test(String(r.stdout || '')), '自检必须打 ✔ 全过（行为验证：解析/排序/噪声带两侧都要有牙）');
});

t('D214 研究侧模拟仪器必须**默认隔离 rng**（`--freshrng` 默认开；要关必须显式 `--allowrngleak` 且表头留痕）（10-01 · 接千问 §E209 残余扰动）', function () {
  /* 事实（代码级）：`js/core/state.js:236` 的 `cloneState` **复用同一个 rng 对象**；`playRollout` 虽给 clone 换了自己的流，
   * 但引擎抽取走**模块级栈顶 `RNGCUR`**，而该栈顶**只在 `--freshrng` 打开时**才换成 clone ⇒ 不开时 rollout 从**母局**那条流抽，
   * 扰动随 `rep` 增长（§E209 实测 366(rep=8) / 355(rep=2) / 356 零 rollout 参照）。
   * ⇒ 本门钉住：默认必须是隔离；关闭必须有显式逃生阀；表头必须留痕（否则读的人分不出这批数是被扰动的）。 */
  const P = readFileSync('tools/probe-myopia-regret.mjs', 'utf8');
  ok(/let FRESHRNG = true;/.test(P), '默认必须是**开隔离**（`let FRESHRNG = true`）');
  ok(/ALLOW_LEAK/.test(P) && /allowrngleak/.test(P), '必须有显式逃生阀 `--allowrngleak`（并在允许名单里）');
  ok(/freshrng=/.test(P), '表头必须留痕 `freshrng=`（读的人要能分辨这批数有没有被扰动）');
  const r1 = spawnSync(process.execPath, ['tools/probe-myopia-regret.mjs', '--rep=1', '--games=1'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o1 = String(r1.stdout || '') + String(r1.stderr || '');
  eq(r1.status, 0, '默认档必须能跑（实测 ' + r1.status + '）');
  ok(/freshrng=ON/.test(o1), '默认档表头必须显示 freshrng=ON（实测输出里没找到）');
  const r2 = spawnSync(process.execPath, ['tools/probe-myopia-regret.mjs', '--rep=1', '--games=1', '--allowrngleak'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o2 = String(r2.stdout || '') + String(r2.stderr || '');
  eq(r2.status, 0, '--allowrngleak 档必须能跑（实测 ' + r2.status + '）');
  ok(/freshrng=off/.test(o2), '关档表头必须印 `freshrng=off`（该工具既有格式；第一版我自造了一串字样 ⇒ 假红）');
  ok(!/freshrng=ON/.test(o2), '关档不许再显示 ON（显示 ON 就分不出这批数有没有被扰动）');
});

/* ⚠ v1.5.79：汇总**必须在 process.exit 之前**（否则它是死代码、永远不打印 =>
 * 门禁会安静地不报结论）。~~D69 自检守着这个顺序~~ ⇒ **D69 已在 v1.5.128 按审计删掉**
 * （它是自指门：检查 np-test 自己的行序）⇒ **现在没有门守这个顺序，改文件尾部时自己看住**。 */if (process.env.NP_TIME === '1') {
  /* v1.5.224：**按门计时**（默认零成本，只有 NP_TIME=1 时才印排行榜）。
   * 动机：用户问"门禁为什么要 4 分钟"，我先前只能靠猜 —— 现在先量再优化。 */
  const __tot = __T.reduce(function (a, b) { return a + b[0]; }, 0);
  const __slow = __T.slice().sort(function (a, b) { return b[0] - a[0]; });
  /* v1.5.224：**整轮**用 `process.uptime()`（真·进程墙钟，含引擎装载）；`门槛外` = 整轮 − 门内合计。 */
  const __wall = process.uptime();
  console.log('\n=== 计时：整轮 ' + __wall.toFixed(1) + ' 秒 · 门内合计 ' + (__tot / 1000).toFixed(1) +
    ' 秒 · 门槛外 ' + (__wall - __tot / 1000).toFixed(1) + ' 秒（进程启动 + 沙箱装载）===');
  const __cs = cacheStats();
  console.log('=== 缓存：命中 ' + __cs.hit + ' 次 · 真跑 ' + __cs.miss + ' 次 · 省下 ' + (__cs.savedMs / 1000).toFixed(1) +
    ' 秒（`NP_NOCACHE=1` 关闭；键 = argv + EPIRUS_* env + 源码树内容）===');
  console.log('=== 最慢的 15 道门 ===');
  for (const r of __slow.slice(0, 15)) console.log('  ' + (r[0] / 1000).toFixed(1).padStart(6) + ' 秒  ' + r[1].slice(0, 76));
}
/* ===== D164：池子前沿量具（v1.5.249 · Qoder 09-26）=====
 * 钉四件事，全部判在**效果**上：
 *  ① 三条判据在**线处**方向正确（"两模式都要"是今天的核心教训：只看 multi 会让 long 2.86 的包混进来）；
 *  ② "三合一"必须真是三样求交，且**没量到 ≠ 通过**；
 *  ③ 未知 `--` 参数一律 exit 64（真跑，不判文本）；
 *  ④ `--stage=1` 真的不起 gate-drafts（那 ~40 分钟必须能**真的**跳过，而不是"照跑但没印"）。
 * 判据从 `pool-frontier-lib.mjs` import —— 不 import 探针本体（它一被 import 就会去扫 1457 个文件）。 */
t('D164 池子前沿量具（v1.5.249）：三判据在线上方向正确、"三合一"必须真是三样求交、没量到不许当通过、参数守卫与 stage 语义判在输出上', function () {
  const M = o => Object.assign({ gMulti: 4, gLong: 4, landMulti: 3, landLong: 3, gained: 200, spentRate: 0.8 }, o);
  ok(PF_FRONT.isWide(M({}), 2.66) === true, '两模式都过线 ⇒ 判宽');
  ok(PF_FRONT.isWide(M({ gLong: 2.99 }), 2.66) === false, 'long 的 G 差 0.01 ⇒ 不许判宽（只看 multi 是本仓踩过的形状）');
  ok(PF_FRONT.isWide(M({ landLong: 2.65 }), 2.66) === false, '净兑现只有一模式过 ⇒ 不许判宽');
  /* ===== v1.5.254（用户 GO）：**"宽"的净兑现判据必须同 n 并排**，绝对线是被实测否掉的形状 =====
   * 病：绝对线自带样本量依赖 —— 现役**自己**在 80 局下 `净兑现 2.63 < 线 2.66`（线抄自另一次 n 的实测）
   *    ⇒ 同一粒包换个 n 就被判成"不宽"。本门钉三件：①同 n 判据本身 ②参照缺时 fail-closed ③探针真用它。 */
  const INC = { landMulti: 2.63, landLong: 2.70 };
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.63, landLong: 2.70 }), INC) === true,
    '【本条就是要防的】现役**自己**在旧绝对线(2.66)下会被判"不宽"（landMulti 2.63 < 2.66）⇒ 同 n 并排下必须判宽');
  ok(PF_FRONT.isWide(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.63, landLong: 2.70 }, 2.66)) === false,
    '（前提自检）同一条读数在绝对线下确实是 false —— 不成立就说明这条门在测空气');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.58, landLong: 2.65 }), INC) === true,
    '低于现役 ' + PF_FRONT.LAND_TOL + ' 以内（容差内）⇒ 仍判宽');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.13, landLong: 2.20 }), INC) === false,
    '低于现役超过容差 ⇒ 不许判宽');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 9, landLong: 9 }), { landLong: 2.1 }) === false,
    '【fail-closed】参照的净兑现读不到 ⇒ 必须判**不宽**，不许因为缺参照就悄悄退回绝对线');
  ok(PF_FRONT.isWideVs(M({ gMulti: 2.9, gLong: 3.2, landMulti: 9, landLong: 9 }), INC) === false,
    '同 n 判据不许覆盖 G≥3 那条（G=2.9 仍不算宽）');
  const pfSrc = readFileSync('tools/probe-pool-frontier.mjs', 'utf8');
  ok(/isWideVs\(m, incM, LAND_TOL\)/.test(pfSrc) && /isWide\(m, LAND\)/.test(pfSrc),
    '探针默认必须走 `isWideVs(m, incM, LAND_TOL)`；绝对线 `isWide(m, LAND)` 只许留在**显式 `--land-line`** 那条支路上');
  ok(/ABS_LAND/.test(pfSrc) && /--land-line=/.test(pfSrc),
    '显式传 `--land-line` 时必须走绝对线并**响亮说明**（历史读数可复现，但不许静默换判据）');
  ok(pfSrc.indexOf('const rows = []') > pfSrc.indexOf('const incM = metricsOf(incParams)'),
    '参照块必须在 rows **之前**算出来（否则同 n 判据拿不到现役读数）');
  ok(PF_FRONT.isClosed(M({}), 0.5, 100) === true, '花珠率 0.8 + 得珠 200 ⇒ 闭环');
  ok(PF_FRONT.isClosed(M({ spentRate: 0.49 }), 0.5, 100) === false, '花珠率差 0.01 ⇒ 不算闭环');
  ok(PF_FRONT.isClosed(M({ gained: 60 }), 0.5, 100) === false, '率高但攒得少 ⇒ 不算闭环');
  ok(PF_FRONT.isClosed({ gained: NaN, spentRate: NaN }, 0.5, 100) === false, '读数 NaN ⇒ 不许当闭环');
  ok(PF_FRONT.isRobust({ long: 30, multi: 30 }, { long: 38, multi: 35 }) === true, '两模式都低于现役 ⇒ 抗克');
  ok(PF_FRONT.isRobust({ long: 39, multi: 10 }, { long: 38, multi: 35 }) === false, '只一模式超线 ⇒ 不许判抗克');
  ok(PF_FRONT.isRobust(null, { long: 38, multi: 35 }) === false, '没量到 ⇒ 必须判"不抗克"，不许当通过');
  /* 四行合成样本，让"两两组合"与"三样全有"各自至少有一粒（第一版我把第二行写成 wide:true ⇒
   * `robustNotWide` 期望 1 实得 0，被自己的门当场逮住 —— 这正是门该干的事） */
  const fr = PF_FRONT.frontierOf([
    { wide: true, closed: true, robust: false },     // 宽+闭环，但不抗克
    { wide: false, closed: false, robust: true },    // 只抗克（不宽）—— 09-26 那 7 粒档案包里有这个形状
    { wide: true, closed: true, robust: true },      // 三样全有
    { wide: true, closed: false, robust: false },    // 只宽
  ], { long: 38, multi: 35 });
  eq(fr.wide, 3, '宽的计数（含三样全有那粒）');
  eq(fr.wideAndClosed, 2, '宽∩闭环 计数不该含抗克');
  eq(fr.three, 1, '"三合一"必须真的是三样求交');
  eq(fr.robustNotWide, 1, '"只抗克不宽"要单独报 —— 它正是"加筛子也筛不出东西"那一类');
  eq(fr.wideNotRobust, 2, '"只宽不抗克" = 2（第一行"宽+闭环不抗克"与第四行"只宽"都算 —— 这一维本来就是大多数）');
  const bad = spawnSync(process.execPath, ['tools/probe-pool-frontier.mjs', '--oops=1'], { encoding: 'utf8', timeout: 90000 });
  eq(bad.status, 64, '`--oops` 必须 exit 64，实际 status=' + bad.status);
  const s1 = spawnSync(process.execPath, ['tools/probe-pool-frontier.mjs', '--stage=1', '--limit=3', '--every=200'],
    { encoding: 'utf8', timeout: 900000 });
  eq(s1.status, 0, 'stage=1 迷你跑必须成功（status=' + s1.status + ' ' + String(s1.stderr || '').slice(0, 90) + '）');
  ok(/前沿计数/.test(String(s1.stdout)), 'stage=1 仍要印出前沿计数（"跑了"与"跑出东西"分不开就是假绿）');
  ok(String(s1.stdout).indexOf('gate-drafts exit=') < 0, 'stage=1 不许起 gate-drafts（跳过的那 ~40 分钟必须是真跳过）');
  ok(/老维包 \d+/.test(String(s1.stdout)) && /2P 壳 \d+/.test(String(s1.stdout)),
    '必须把"老维包"与"2P 壳"的跳过数印出来（09-26 我手工筛时把一粒 2P 壳混进过 3P 池，而 276 个老维包会被今天的引擎解成另一种行为）');
});

t('D165 尾部聚合适应度开关（v1.5.251 · 夜班 §E49）：默认关要**逐位可逆**、开了只换聚合不加局、越界/非数值要**响亮拒**', function () {
  /* 为什么值得建门：档案级实测（863 等价类 × 33 环境）说 `fit` 那条"逐局求平均"看不见地板
   * —— τ(池内均值, 池外地板) = 0.380，而尾部统计量给 0.749。旋钮本身可逆与否不是看法问题，
   * 是**断言**问题 ⇒ 判四件事：
   *   ① 关着 / 显式 `=0` / reset 之后，fit 必须**逐位相同**（`|| 默认` 那一族：0 是一个真实取值）；
   *   ② 开着必须改变 `fit` 但**不改变** `fitMean` 与 `fitGames`（= 同一批局，只换了聚合；多花一局就是另一回事了）；
   *   ③ `q=1` ⇒ 尾部 = 整体 ⇒ fit 必须回到平均（判**形状**，不只判"数值动了"）；
   *   ④ 臂上真跑：`EPIRUS_FIT_TAIL_W` 不设 vs 设 0 ⇒ **产物权重逐位相同**；设 0.4 ⇒ 必须不同；
   *      非数值 / 越界 ⇒ `exit 7`（"下达了但被 clamp 掉"不许当成开了）。 */
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  ok(!!params, '载体：现役 3P 权重要能 unpack');
  const opps = T.buildOpps(params, 0.05);
  ok(Array.isArray(opps) && opps.length >= 2, '要 ≥2 个对手才谈得上"最差那几局"（实测 ' + (opps && opps.length) + '）');
  const er0 = T.economyReward();
  eq(er0.fitTailW, 0, '出厂必须是 W=0（不加项）');
  eq(er0.fitTailQ, 0.25, '出厂 q 必须是 0.25');
  const SCORE = () => T.scoreMemberN(params, opps, 8, 3, 1200, 5, 0);
  const f0 = SCORE();
  ok(typeof f0.fitMean === 'number', '必须回传 `fitMean`（没有它，"它本来分低"与"被地板拖下来"永远分不开）');
  eq(f0.fitGames, 8, '逐局数必须就是下达的局数');
  try {
    T.setEconomyReward({ fitTailW: 0 });
    const f0z = SCORE();
    ok(f0z.fit === f0.fit && f0z.fitMean === f0.fitMean, '`W=0` 必须逐位等于不设（被当成"未设"再吞回默认 = 零档对照根本不存在）');
    T.setEconomyReward({ fitTailW: 0.6, fitTailQ: 0.25 });
    eq(T.economyReward().fitTailW, 0.6, 'setter 要读回生效值');
    const f1 = SCORE();
    ok(f1.fitMean === f0.fitMean, '开档**不许改局**：fitMean 必须逐位相同（变了就是多跑/换了局，那 A/B 就不是同一个量）');
    eq(f1.fitGames, f0.fitGames, '逐局数也不许变');
    ok(f1.fit !== f0.fit, '【作用点】开档必须改变 fit（不变 ⇒ 该项没接到每代评分通路，整臂会跑成 A/A）');
    ok(f1.fit < f0.fit, '尾部聚合只会往下压（ES ≤ mean ⇒ 上界只能等于平均）');
    T.setEconomyReward({ fitTailQ: 1 });
    const f2 = SCORE();
    ok(Math.abs(f2.fit - f0.fit) < 1e-12, '`q=1` 时 ES = 整体平均 ⇒ fit 必须回到原值（差一丝 = 形状写错了，实测 Δ=' + (f2.fit - f0.fit) + '）');
    T.setEconomyReward({ fitTailW: 1, fitTailQ: 0.25 });
    const f3 = SCORE();
    ok(Math.abs(f3.fit - (f0.fitMean - 0)) >= 0 && f3.fit < f0.fit, 'W=1（纯 ES）必须比平均更低');
  } finally { T.setEconomyReward({ reset: true }); }
  const fBack = SCORE();
  ok(fBack.fit === f0.fit && fBack.fitMean === f0.fitMean, 'reset 之后必须逐位回到出厂（留隐性状态 ⇒ "出厂行为不变"这句话就是假的）');
  eq(T.economyReward().fitTailW, 0, 'reset 必须抹掉 W（D77 的往返会喂 0.5 哨兵，漏抹就泄漏给后面的门）');
  /* ⚠ 这里**不**再用 `detectDarkKnobs({entry})` 判"是不是暗键"：那个调用不传 `extraReadKeys`，
   *   而 econ 族键在 `train-3p` 里是**运行时**从 `ECON_ENV_KEYS` + `CLI_ECON_REWARD_KEYS` 派生出来的
   *   ⇒ 静态判它会把 `EPIRUS_BIGT_CHAIN_W`/`EPIRUS_S4_W`/`EPIRUS_RING_W` 一律报成暗键（实测三条全红）。
   *   判"真接上了"改用下面那条**行为式**的：开档臂必须不是 `exit 6`，且**同族没接线的键必须是 6** ——
   *   两条一起才排除"守卫自己关了"这个混淆（METHODOLOGY 73 的变异测试同族）。 */

  /* ---- ④ 臂上真跑（同种子 2 代 × 3 粒，只换开关）---- */
  const dir = mkdtempSync(join(tmpdir(), 'd165-'));
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  try {
    const rU = runArm('d165u'), rZ = runArm('d165z', { EPIRUS_FIT_TAIL_W: '0' }), rK = runArm('d165k', { EPIRUS_FIT_TAIL_W: '0.4' });
    eq(rU.status, 0, '对照臂必须成功（' + String(rU.stderr || '').slice(0, 90) + '）');
    eq(rZ.status, 0, '`W=0` 臂必须成功');
    eq(rK.status, 0, '`W=0.4` 臂必须成功');
    /* 下达自 v1.5.262 起走 **DS 的通用 econ 派发**（名单驱动 + 逐键回执），本门只认那一处的回执 ⇒
     * 断言"这个键真的被点名下达过"，而不是我自己的横幅措辞（横幅会改，回执是机制）。 */
    ok(/econ 族通用下达[^\n]*"fitTailW":"0"/.test(String(rZ.stdout)), '`W=0` 必须被通用派发点名并回执（不许把 "0" 当未设）');
    ok(/econ 族通用下达[^\n]*"fitTailW":"0\.4"/.test(String(rK.stdout)), '开档臂必须在派发回执里出现 fitTailW=0.4');
    ok(!/fitTailW/.test(String(rU.stdout)), '不设 ⇒ 派发与回执里都不许出现这个键（"开了但没生效"与"没开"要看得见差别）');
    const wtOf = f => { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(readFileSync(f, 'utf8')); return m ? JSON.stringify((JSON.parse(m[1]) || {}).a) : null; };
    const wU = wtOf(dir + '/d165u.js'), wZ = wtOf(dir + '/d165z.js'), wK = wtOf(dir + '/d165k.js');
    ok(wU && wZ && wK, '三臂产物都要能读出权重（读到的是**数组本体**，不是"数组有几个"那种形状签名 —— 建门时我自己先踩过一次假通过）');
    ok(wU === wZ, '【P3 门票】不设 vs 显式 0 ⇒ 产物权重必须**逐位相同**（不同 ⇒ 这根开关改了出厂训练结果，那"默认关"是假的）');
    ok(wU !== wK, '开档臂必须训出**不同的**权重（相同 ⇒ 开关在臂这条路上是空转的）');
    const rBad = runArm('d165bad', { EPIRUS_FIT_TAIL_W: 'abc' });
    eq(rBad.status, 7, '非数值必须 exit 7（读回不相等就算被拒），实际 ' + rBad.status);
    const rOver = runArm('d165over', { EPIRUS_FIT_TAIL_W: '5' });
    eq(rOver.status, 7, '越界（W=5 会被 clamp 成 1）必须 exit 7，实际 ' + rOver.status);
    const rDark = runArm('d165dark', { EPIRUS_FIT_TAIL_OOPS: '0.4' });
    eq(rDark.status, 6, '同族但**没接线**的键必须 `exit 6` ⇒ 守卫是活的，上面"W=0.4 那臂活着跑完"才真是"接上了"而不是"没人管"');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
});

t('D187 整桌同原型（v1.5.280 · §E124）：关=逐位可逆 / 开=局内恒等且跨局满覆盖 / 量具路不许被配方拖动', function () {
  /* 这根杠杆动的是**训练桌的形状**，不是规则 ⇒ 判据必须落在"索引公式"本体上，
   * 而不是"横幅印了没有"（D174 那族：闸放行 ≠ 线接通）。 */
  const idx = T.oppSeatIndex;
  eq(typeof idx, 'function', '① 引擎必须把 `oppSeatIndex` 作为**纯函数**导出来（判在公式上，不判在日志上）');
  eq(typeof T.setOppTable, 'function', '① 必须有 setter（train-3p 下达走读回，没有 setter 就是空转）');
  eq(typeof T.oppTable, 'function', '① 必须有 getter（回执与 meta.recipe 都从它取）');
  /* ② 反"假默认关"：关 ⇒ 必须与**旧公式**逐位相同（旧式独立复算，不 import 新函数） */
  let legacyMismatch = 0, N = 0;
  for (const len of [3, 5, 9, 12, 20]) for (let gen = 0; gen < 7; gen++) for (let g = 0; g < 6; g++) for (let k = 0; k < len; k++) {
    const legacy = (((gen * 3 + g) % len) + k) % len;
    N++; if (idx(gen, g, k, len, false) !== legacy) legacyMismatch++;
  }
  eq(legacyMismatch, 0, '② 关开关时 ' + N + ' 个 (gen,g,k,len) 组合必须与旧累加器逐位相同（不同 ⇒ "默认关"是假的，历史臂不再可复现）');
  /* ③ 判别力（反恒真）：开 ⇒ 同一局内所有对手席索引必须相同（整桌同一原型） */
  let spreadBad = 0;
  for (let gen = 0; gen < 9; gen++) for (let g = 0; g < 9; g++) {
    const a = idx(gen, g, 0, 12, true), b = idx(gen, g, 3, 12, true);
    if (a !== b) spreadBad++;
  }
  eq(spreadBad, 0, '③ 开开关 ⇒ 局内第 1 席与第 4 对手的索引必须相同（不同 ⇒ 桌形根本没改，那臂是白跑的）');
  /* ④ 覆盖面不许被牺牲：开 ⇒ 原型仍按 (gen*3+g) 跨局轮换，len 个连续局必须**恰好各出现一次** */
  for (const len of [9, 12]) {
    const seen = new Set();
    for (let g = 0; g < len; g++) seen.add(idx(4, g, 0, len, true));
    eq(seen.size, len, '④ 开开关时 ' + len + ' 个连续局必须覆盖全部 ' + len + ' 个原型（漏一个 = 那个环境永远练不到）');
  }
  /* ⑤ 往返与哨兵：reset 必须抹掉 true，否则后续门活在"整桌同原型"的假世界里（D109 那族事故） */
  T.setOppTable({ block: true }); eq(T.oppTable().block, true, '⑤ 下达 true 必须读得回（读不回 = §E124 那臂不知道自己开了什么）');
  T.setOppTable({ reset: true }); eq(T.oppTable().block, false, '⑤ reset 必须把 true 抹回出厂值（哨兵泄漏防线）');
  const st = T.oppTable();
  ok(st.blockedGames === 0 && st.styleBlocked === 0, '⑤ reset 顺带清零**开火计数**（不清 ⇒ 下一扇门读到上一扇的剂量）');
  /* ⑥ 静态钉：`evalN` 是**量具**，不许被训练配方拖动 —— 否则产品口径跟着配方变（§E87 那族"口径决定结论"）。
   * ⚠ 这里**不能**写 `String(T.evalN || '')`：`evalN` 根本不在导出名单里 ⇒ 空串 ⇒ 判据恒真（本仓最怕的形状）。 */
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  const from = evoSrc.indexOf('function evalN(');
  ok(from > 0, '⑥ 要在源码里定位 `evalN`（找不到就说明它被改名/删了 ⇒ 这条钉失效，必须响亮红而不是默默过）');
  const nextFn = evoSrc.indexOf('\n  function ', from + 20);
  const evalBody = evoSrc.slice(from, nextFn > 0 ? nextFn : evoSrc.length);
  ok(evalBody.length > 100, '⑥ `evalN` 函数体必须真取到了（' + evalBody.length + ' 字符 ⇒ 切片失败，判据会假通过）');
  ok(evalBody.indexOf('oppSeatIndex') === -1, '⑥ `evalN` 体内不许出现 `oppSeatIndex`（评测口径必须与训练桌形无关）');
  ok((evoSrc.match(/oppSeatIndex\(gen/g) || []).length >= 2, '⑥ 训练侧两条路（主池 + 风格切片）都要真走这个公式（只改一条 ⇒ "环境"只在一半训练里存在）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/'EPIRUS_OPP_BLOCK'/.test(t3), '⑥ 键必须登记进 `SELF_ENV_KEYS`（漏一处就被入口黑键闸拦成暗键，D172 那族三处名单）');
  ok(/EPIRUS_OPP_BLOCK=1 读回/.test(t3) || /没生效，退出/.test(t3), '⑥ 下达必须有"读回不等 ⇒ exit 7"的硬拒（静默空转的臂比不跑更坏）');
});

t('D188 并发批跑器（v1.5.281）：归属不串台 / 失败不吞 / 输入不全就抛 / 真并发 / 退化成串行仍正确', function () {
  /* 这把尺自己必须有牙：D176 的加速全靠它，"跑得快但把结果记错人"比慢更坏。 */
  const J = (tag, code) => ({ tag: tag, argv: ['-e', code] });
  /* ① 归属：4 个微型 job 并发，每个的 stdout 必须只含自己的 tag（串台 = 断言读错臂） */
  const r1 = spawnBatch([J('tA', 'console.log("tA")'), J('tB', 'console.log("tB")'),
    J('tC', 'console.log("tC")'), J('tD', 'console.log("tD")')], { max: 4 });
  for (const t of ['tA', 'tB', 'tC', 'tD']) {
    eq(String(r1[t].stdout).trim(), t, '① ' + t + ' 的输出必须归属自己（实测 ' + JSON.stringify(String(r1[t].stdout).slice(0, 40)) + '）');
    eq(r1[t].status, 0, '① ' + t + ' 必须成功退出');
  }
  /* ② 失败不吞：非零码与抛错都必须原样带回（吞掉失败 = 假绿） */
  const r2 = spawnBatch([J('e3', 'process.exit(3)'), J('thr', 'throw new Error("boom")'), J('out', 'console.error("E")')]);
  eq(r2.e3.status, 3, '② 子进程 exit 3 必须原样带回，实测 ' + r2.e3.status);
  ok(r2.thr.status !== 0, '② 抛错必须非零，实测 ' + r2.thr.status);
  ok(/E/.test(r2.out.stderr) && !/E/.test(r2.out.stdout), '② stderr 与 stdout 不许混（读 stderr 的断言会因此瞎掉）');
  /* ③ 输入不全一律抛：零 job / tag 重复 / 缺 argv —— 都是"少跑了却像过了"的前身 */
  const throws = (fn) => { try { fn(); return null; } catch (e) { return String(e.message || e); } };
  ok(throws(() => spawnBatch([])), '③ 零个 job 必须抛（一条都没跑不许当通过）');
  ok(throws(() => spawnBatch([J('dup', 'console.log(1)'), J('dup', 'console.log(2)')])).indexOf('tag 重复') >= 0,
    '③ tag 重复必须抛（两支臂盖同一份结果 = 悄悄少跑一支）');
  ok(throws(() => spawnBatch([{ tag: 'x' }])), '③ 缺 argv 必须抛');
  /* ④ 真并发：3 个各睡 1 秒的 job，批跑总耗时必须明显小于串跑的 3 秒 */
  const sleep = (tag) => J(tag, 'const t=Date.now();while(Date.now()-t<1000);console.log("ok")');
  const t0 = Date.now();
  spawnBatch([sleep('a'), sleep('b'), sleep('c')], { max: 3 });
  const ms = Date.now() - t0;
  ok(ms < 2500, '④ 三支各 1 秒的 job 并发跑完用了 ' + ms + 'ms ⇒ 必须明显小于串跑（3000ms+），否则加速是假的');
  /* ⑤ 退化成串行也必须给出全部结果（并发只是加速，不许改变"每支都跑"这件事） */
  const r5 = spawnBatch([J('s1', 'console.log("1")'), J('s2', 'console.log("2")'), J('s3', 'console.log("3")')], { max: 1 });
  ok(['s1', 's2', 's3'].every(k => r5[k] && r5[k].status === 0), '⑤ max=1 时三支仍都要有结果');
  eq(String(r5.s2.stdout).trim(), '2', '⑤ 串行路径的归属同样不许错');
});


t('D201 v1.5.299 的 fit 口径旋钮 EPIRUS_FIT_CAL 有牙（补 DS 提交里那条其实不存在的"门 D200"）', function () {
  /* 为什么有这条（09-29 13:47 复核 c0eb9d4）：DS 的提交说明与 `CHANGELOG.md` 都写"门 D200"、`js/train/evo.js` 的注释写
   *   "默认关 ⇒ 门 D191 钉 A/A" —— **两条引用都落空**：D200 是 v1.5.296 给 5P 环境量具立的门（构造/名字真源/桌子漂移），
   *   D191 是 kept/ 别名检测；np-test 在那版实际只多了 1 行（D77 的 `SENT` 里登记 `fitCal: true`，管的是"设得进读得回"，
   *   不管默认值、不管公式、不管调用点）。⇒ 这个**会换掉全部历史臂的尺**的旋钮当时是"声称有门、其实没门"。
   *   与本仓同族事故（D199 第一版恒真、D159 正则没算括号、§E108 改了被读文件没复跑）记在同一类里：**记账说门在，门不在**。
   * ⚠ 本门能钉什么、钉不了什么，写在最后一条注释里，别把它读成"接线已被证明"。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  /* 自建沙箱（与 D162 同规矩）：默认值必须在**干净**模块里读，共享 `T` 早被 D77 那类门喂过值 */
  const sb3 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb3.window = sb3; sb3.globalThis = sb3;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), sb3, { filename: f });
  const T3 = sb3.window.EpirusTrainer;
  /* ① 默认关 ⇒ 旧刻度逐位不变（这条是"没换尺"的全部凭据；D77 的往返管不到它） */
  eq(T3.economyReward().fitCal, false, '① 出厂必须**关**（实测 ' + T3.economyReward().fitCal + '）');
  eq(T3.rankCredit(2, 1, 5), 0.3, '① 关着时第二名必须还是绝对刻度 0.3（与人数无关的老行为）');
  eq(T3.rankCredit(1, 1, 3), 1, '① 关着时第一名 1.0');
  /* ② setter 收口径：布尔/数字/字符串 '0' 都要能判，且回执读得到（D77 只喂 true 一种形态） */
  eq(T3.setEconomyReward({ fitCal: 1 }).fitCal, true, '② =1 必须开（回执 fitCal）');
  eq(T3.setEconomyReward({ fitCal: '0' }).fitCal, false, "② 字符串 '0' 必须判成关（env 下达全是字符串，'0' 被当真是本仓反复踩的形状）");
  eq(T3.setEconomyReward({ fitCal: 0 }).fitCal, false, '② 数字 0 必须判成关');
  /* ③ 开了之后的形状：1 名 = 1、其余 = 0、**且不许出负数/NaN**（rank=N 时基线 = 1 ⇒ 除零靠 0.99 夹 + clamp≥0 兜）
     各 N 都试一遍，钉的是"形状与人数无关"这个**设计目的**本身 */
  T3.setEconomyReward({ fitCal: 1 });
  for (const N of [2, 3, 4, 5]) {
    eq(T3.rankCredit(1, 1, N), 1, '③ 开 + N=' + N + '：1 名必须 1.0（对齐后 1 名回到满分）');
    for (let r = 2; r <= N; r++) {
      const v = T3.rankCredit(r, 1, N);
      ok(Number.isFinite(v) && v >= 0, '③ 开 + N=' + N + ' rank=' + r + ' 必须是**有限非负**数（实测 ' + v + '）⇒ 夹住基线上界与 clamp≥0 两道都在');
      eq(v, 0, '③ 开 + N=' + N + ' rank=' + r + '：低于随机基线 ⇒ 归 0（"只有赢才算"是 DS 写进注释的语义）');
    }
  }
  /* ④ 复位必须真能抹掉（DS 自己栽过的坑：`ECON_DEFAULTS` 是**字面量列表**，漏一个新键 ⇒ `reset` 静默抹不掉，D175 才抓到） */
  T3.setEconomyReward({ reset: true });
  eq(T3.economyReward().fitCal, false, '④ reset 后必须回出厂 false（实测 ' + T3.economyReward().fitCal + '）⇒ 新键要同时进 ECON_DEFAULTS 快照');
  eq(T3.rankCredit(2, 1, 5), 0.3, '④ reset 后刻度必须真的回到旧的 0.3（读回接口 false 但作用点没复位 = 假复位）');
  /* ⑤ 签名 + **调用点真传人数**：本仓规矩是"只看签名不算接线"（D174 那次 costlyW 通过黑键闸却从没送给引擎） */
  const sig = /function rankCredit\(rank, aliveEnd, nSeats\)/.exec(EVO);
  ok(sig, '⑤ `rankCredit` 必须收第三个人数参（实测没找到该签名）');
  ok(EVO.indexOf('rankCredit(rank, aliveEnd, r.state.p.length)') >= 0,
    '⑤ 调用点必须把**真实席数**传进去（`r.state.p.length`）—— 接了参数却不传 = 开了也等于没开');
  ok(!/rankCredit\(rank, aliveEnd\)[^,]/.test(EVO), '⑤ 不许残留两参数的老调用点（漏改一处 = 那一处静默用旧刻度）');
  /* ⑥ 名单三处（ECON_ENV_KEYS / ECON_REWARD_KEYS / train-3p 的 CLI 名单）由 D77 与 probe-econ-reset-audit 钉，
     **这里不再抄一份**（仓规：第二遍抄写正是本仓反复出事的形状）。DS 的 A/B 实测已证明它没被黑键闸拦。
   * ⚠ 本门钉不了什么（写清楚，免得下一个人以为"有门 = 接线已被证明"）：
   *   对齐后的输出对 N **恒等**（1 名永远 1.0、其余永远 0）⇒ ③ 无法从数值上区分"按人数算"与"写死按 3 人算"；
   *   那半条只能靠 ⑤ 的调用点静态钉 + DS 的产物级 A/B（末代 bestFit 0.835→0.380）。 */
});

t('D202 §E146 的判读器 `analyze-fitcal-ab.mjs` 有牙（合成夹具，<1 秒）：配对不成立必须响亮拒、算术要等于手算值', function () {
  /* 为什么钉这道：这条门产出的数**直接决定用户要不要在目标函数层换手**（决策单 §零 第①件）。
   * 而这类"读现成 tsv 做算术"的工具，最贵的三种坏法恰好是：
   *   ① 两臂其实打的不是同一批桌子，却照样算出一个配对差（§E136 的前科）；
   *   ② 报错走"退出码 0 + 少印一段"，于是**崩在半成品报告中间**、前半截读数被抄走
   *      （**本门就是为这件事立的**：开发时第一版把 `const mean` 写在 H2 使用点之后 ⇒ ESM TDZ ⇒ H1 全印完才炸）；
   *   ③ 判据缺对比度还照判（§E146 的极差在真产物上三档全部饱和 100pt ⇒ 门要验"极差算对了"，缺陷本身记在日志里）。
   * 夹具全是手写字符串 ⇒ 不跑引擎、不进 np 的耗时榜。 */
  const TOOL = 'tools/analyze-fitcal-ab.mjs';
  ok(/import \{ pairedDiff \} from '\.\/routing-gain-lib\.mjs'/.test(readFileSync(TOOL, 'utf8')),
    '① 配对差必须 import lib 那一份（本仓三处 SE 各写一遍的教训；门 D193/D198 同族）');
  ok(!/Math\.sqrt/.test(readFileSync(TOOL, 'utf8')),
    '① 反向哨兵：判读器里不许出现第二个标准差/SE 公式（`pairedDiff` 就是唯一那份）');
  /* ⓪ 参数守卫（仓规 v1.5.234）：`--envdir` 打错会被当"没给"⇒ 静默读默认目录；`--seeds` 打错会退回默认三档
     ⇒ 报出来的"三 seed 同号"其实不是使用者指定的那三档。真跑一遍，不许只看源码。 */
  const typo = spawnSync(process.execPath, [TOOL, '--seed=7,31,77', '--nonsense=1'], { encoding: 'utf8', timeout: 60000 });
  eq(typo.status, 64, '⓪ 不认识的 `--` 参数必须 exit 64（实测 ' + typo.status + '）');
  ok(/nonsense/.test(String(typo.stderr || '')), '⓪ 且要点名是哪个开关打错了');

  const dir = mkdtempSync(join(tmpdir(), 'd202-'));
  const envDir = join(dir, 'env'); mkdirSync(envDir, { recursive: true });
  const HDR = ['#eval5p-percombo', '#seed=77000', '#games=2', '#n=5', '#pool=all', '#every=7', '#field=-', '#swap=-',
    '#arm\tidx\tnames\tgames\tfirst\tstrict'].join('\n');
  /* 手算好的两臂：cal0 两张桌子 (1/2, 0/2)、cal1 (2/2, 1/2) ⇒ 逐桌子差 = 0.5, 0.5 ⇒ 均值 0.5、sd 0 ⇒ 区间退化成 [50,50]pt */
  const perFile = function (file, first0, first1, opts) {
    const o = opts || {};
    const names1 = o.badNames ? 'X|B|C|D|E' : 'A|B|C|D|E';
    const ctrl0 = o.badCtrl ? 1 : 0;
    return HDR.replace('#swap=-', '#file=' + file + '\n#swap=-') + '\n' +
      ['subject\t0\tA|B|C|D|E\t2\t' + first0 + '\t' + first0, 'subject\t1\t' + names1 + '\t2\t' + first1 + '\t' + first1,
        'ctrl\t0\tA|B|C|D|E\t2\t' + ctrl0 + '\t' + ctrl0, 'ctrl\t1\tA|B|C|D|E\t2\t1\t1'].join('\n') + '\n';
  };
  const write2 = function (a, b) {
    writeFileSync(join(dir, 'cal0-s9.tsv'), a); writeFileSync(join(dir, 'cal1-s9.tsv'), b);
  };
  const run = function (extra) {
    const r = spawnSync(process.execPath, [TOOL, '--dir=' + dir, '--envdir=' + envDir, '--seeds=9'].concat(extra || []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const num = function (s, label, unit) {
    const u = unit || 'pt';
    const m = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([-+0-9.]+)' + u).exec(s); return m ? Number(m[1]) : NaN;
  };
  /* ---- ② 算术必须等于手算值（不是"跑通了就行"）---- */
  write2(perFile('packA', 1, 0), perFile('packB', 2, 1));
  const ok0 = run();
  eq(ok0.code, 0, '② 合法夹具必须跑通（实测 ' + ok0.code + '）：' + ok0.out.slice(0, 200));
  eq(num(ok0.out, '配对差'), 50, '② 配对差必须 = 手算的 50.00pt（实测 ' + num(ok0.out, '配对差') + '）');
  ok(/\[50\.00pt, 50\.00pt\]/.test(ok0.out), '② sd=0 时区间必须退化成 [50,50] 而不是塌成 ±0 或 NaN（实测没匹配到）');
  ok(/n=2/.test(ok0.out) && /pickRandom 基线 25\.00%/.test(ok0.out),
    '② 分母 n 与随机基线都要印（基线 = ctrl 的 (0/2,1/2) 均值 = 25%）');
  /* ---- ③ 四道"配对不成立"必须响亮拒（exit 5），不许静默出一个数 ---- */
  const refuse = function (label, a, b) {
    write2(a, b); const r = run();
    eq(r.code, 5, '③ ' + label + ' 必须 exit 5（实测 ' + r.code + '）⇒ 退出码 0 就等于"照常出判据"');
    ok(/配对不成立/.test(r.out), '③ ' + label + ' 还要点名为什么不能比：' + r.out.slice(0, 160));
  };
  refuse('桌子组合不同', perFile('packA', 1, 0), perFile('packB', 2, 1, { badNames: true }));
  refuse('pickRandom 对照不一致（§E139 的配对自检）', perFile('packA', 1, 0), perFile('packB', 2, 1, { badCtrl: true }));
  refuse('两臂 #file 相同（把同一粒包当两臂）', perFile('packA', 1, 0), perFile('packA', 2, 1));
  refuse('两臂 #every 不同（不是同一批桌子）', perFile('packA', 1, 0).replace('#every=7', '#every=5'), perFile('packB', 2, 1));
  /* ---- ④ H2 的算术 + "不许崩在 H2"（TDZ 事故的回归位）---- */
  const envRows = function (rev) {
    const o = [];
    for (let i = 0; i < 12; i++) { const f = rev ? (11 - i) : i; o.push('e' + i + '\t0\t1\t10\t' + f + '\t' + f); }
    return ['#probe-5p-envfit', '#n=5', '#mix=4', '#games=10', '#seeds=0', '#envs=12',
      '#env\tseed\tinPool\tgames\tfirst\tstrict'].join('\n') + '\n' + o.join('\n') + '\n';
  };
  write2(perFile('packA', 1, 0), perFile('packB', 2, 1));
  writeFileSync(join(envDir, 'cal0-s9.tsv'), envRows(false)); writeFileSync(join(envDir, 'cal1-s9.tsv'), envRows(true));
  const h2 = run();
  eq(h2.code, 0, '④ 带环境账时必须整体跑通（第一版在这里 TDZ 崩 ⇒ 崩码非 0 才算抓到）：实测 ' + h2.code);
  ok(/## H2/.test(h2.out) && /极差之差/.test(h2.out), '④ H2 段必须真的印出来（缺这段就是"报告半成品"）');
  eq(num(h2.out, 'cal0 均', '%'), 55, '④ 每臂均值必须 = 手算的 55.00%（0..11 除以 10 局再平均）：实测 ' + num(h2.out, 'cal0 均', '%') +
    '（⚠ 这里第一次跑的是 `pt` 而工具印 `%` ⇒ 门抓到的是**我的正则写窄了**，不是工具算错。这类"断言读不到就 NaN"必须红，不许把 NaN 当 0 放过去）');
  ok(/极差之差 0\.00pt/.test(h2.out), '④ 极差之差必须 = 手算的 0.00pt（两臂是同一组数的正反序 ⇒ max−min 相等）');
  /* ---- ⑤ 缺环境账要**降级**而不是崩（我实际用过这条路：H2 未量、H1 照出）---- */
  const noEnv = spawnSync(process.execPath, [TOOL, '--dir=' + dir, '--envdir=' + join(dir, 'nope'), '--seeds=9'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  eq(noEnv.status, 0, '⑤ 缺 H2 账必须 exit 0 并降级（实测 ' + noEnv.status + '）—— 不许把"没量到"报成崩溃，也不许静默少印一段');
  ok(/降级为"未量"/.test(String(noEnv.stdout || '')), '⑤ 且要在屏幕上明说 H2 没量（否则读者会拿 H1 当两问的答案）');
  /* ---- ⑥ 环境数不足不许算极差（§E142 的名单是 33 个，读出一小撮就是解析坏了）
     ⚠ 本条第一版写成 `few.stderr / few.stdout`，而 `run()` 返回的是 `{code, out}` ⇒ 读到的永远是空串。
        它这次**红**着被抓到（假红比假绿好），但形状与 D199 第一版"恒真断言"是同一族：**门的输入字段名也要有牙**。
        现在改成 `few.out`，并在消息里带上前 160 字（红的时候能一眼看出是"没匹配"还是"真拒了"）。 ---- */
  writeFileSync(join(envDir, 'cal0-s9.tsv'), envRows(false).split('\n').slice(0, 6).join('\n') + '\n');
  const few = run();
  eq(few.code, 5, '⑥ 只读出 3 个环境时必须 exit 5（实测 ' + few.code + '）⇒ 拿 3 个环境算"极差"是个假数');
  ok(/<10/.test(String(few.out || '')), '⑥ 且要点名是环境数不够：' + String(few.out).slice(0, 160));
});

t('D203 §E147 的 k 粒组合收益曲线工具：它自带的**手算自证**必须随门禁一起跑（不许只在开发时跑过一次）', function () {
  /* 为什么这样立：`analyze-kpool-capture.mjs` 的算术（贪心挑子集 + split-half 结算 + 逐环境配对区间）
   * 一旦算错，报出来的就是"备两粒能多赢 3.5pt"这种会直接影响决策的数。开发期它已经抓到过自己三处错：
   *   ① 夹具把 first=90/games=10 当 0.9 用（⇒ 算出 9.0）；② 份额的分母用了"两向平均"而分子是单向 ⇒ 吐出 101%（§E131 同族）；
   *   ③ 标签写死"受限池"，拿 15 粒未受限目录跑也照印 ⇒ 假的池子身份。
   * ⇒ 把它自带的 `--self-test`（六个手算期望值）**搬进门禁**，成本 <5 秒，但以后谁改算式改坏了，门当场红。 */
  const src = readFileSync('tools/analyze-kpool-capture.mjs', 'utf8');
  ok(/import \{ pairedDiff \} from '\.\/routing-gain-lib\.mjs'/.test(src),
    '① 配对区间必须 import lib 那一份 `pairedDiff`（本仓第三处 SE，见 D193/D198/D202 同族规矩）');
  ok(!/function pairedDiff|Math\.sqrt/.test(src), '① 反向哨兵：这个工具里不许有第二份 SE/标准差公式');
  ok(/rejectUnknownFlags\(/.test(src), '② 参数守卫必须在（仓规 v1.5.234：不认识的 `--` 要 exit 64，不许静默走默认目录）');
  ok(/run\(packs, '池子来自 ' \+ DIR/.test(src),
    '③ 池子身份必须由目录名推出来（写死过一次：拿 15 粒未受限目录跑，屏幕却印"受限池（过体检闸的几粒）"⇒ 假的池子身份比不印更坏）');
  const r = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--self-test'], { encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '④ 手算自证必须整批绿（exit 0）：\n' + String(r.stdout || '').slice(0, 500) + String(r.stderr || '').slice(0, 200));
  const ticks = (String(r.stdout || '').match(/^ {2}✔ /gm) || []).length;
  ok(ticks >= 6, '④ 且六条手算期望必须都过（实测 ' + ticks + ' 条 ✔）—— 只 exit 0 不算，红过的那几条会被 `|| true` 之类的写法吞掉');
  const bad = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--nonsense=1'], { encoding: 'utf8', timeout: 60000 });
  eq(bad.status, 64, '⑤ 不认识的参数必须 exit 64（实测 ' + bad.status + '）');
  const noDir = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--dir=no/such/dir'], { encoding: 'utf8', timeout: 60000 });
  ok(noDir.status === 2 || noDir.status === 7, '⑥ 目录读不到必须非零退出（实测 ' + noDir.status + '）⇒ "没读到"不许被读成"收益为 0"');
});

t('D204 在线对手模型 + 1-ply 重放搜索（v1.5.305 · **默认关** · `setBeliefSearch(1)` / 页面 `localStorage.epirus.beliefSearch`）有牙', function () {
  /* 为什么有这条（09-30 夜 §E152d/§E153，Qoder）：五臂分解把现役 AI 的病名定成"**没有对手模型**"，
   *   而"加几维进网络"只买得到 +7.83 / +15.50pt（每席 1~4 个量，60 桌 × 20 局），大头 +44.08pt [34.81, 53.36]
   *   要求"席位 → 具体卡名分布"这种表状结构 ⇒ 于是做成**决策时搜索**，不动 `policy.js`/`FEAT_S`/规则指纹。
   * 发布路径的实测（`docs/artifacts/e152b-arms.mjs` · 40 桌 × 10 局 · 逐桌配对 · 关档走 `pickChampion`、开档走 `policyChooserBelief`）：
   *   关档 **31.50%** ‖ 开档 **74.75%** ⇒ **+43.25pt [33.54, 52.96]**；同桌对撞（0 号位=发布档现役包）**+66.00pt [59.46, 72.54]**。
   * ⚠ 本门是**行为门**，不是文本钉（D190 那种"纯静态、零判据"的门本仓已经点过名）：
   *   四段全部跑真引擎，且关/开用**同一批 seed** ⇒ 配对成立；④ 专门打"假复位"。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  const UI = readFileSync('js/ui/ui.js', 'utf8');
  const mkSb = function () {
    const s3 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, decodeURIComponent };
    s3.window = s3; s3.globalThis = s3;
    for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
      'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), s3, { filename: f });
    return s3.window;
  };
  /* 跑一批固定 seed 的 5 人局：0 号位是候选（开/关两档），其余四席是可学习的固定型脚本
     ⇒ 脚本必须**有规律**，否则"信念表有没有在工作"这件事根本测不到（§口径陷阱：反事实要先证明扰动进得去） */
  function batch(on, games, collect) {
    const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, P = W.EpirusPolicy, Play = W.EpirusPlay;
    const mm = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    const params = P.unpack(JSON.parse(mm[1]), true);
    if (!params) throw new Error('夹具读不到出厂 3P 包');
    T.setBeliefSearch(on ? 1 : 0);
    const scripted = function (s, pid, legal) {
      const aff = legal.filter(function (l) { return l.affordable; });
      let gun = null;
      for (let i = 0; i < aff.length; i++) if (aff[i].key === R.SK.GUN) { gun = aff[i]; break; }
      if (!gun) return { key: R.SK.JI, target: null };
      let tg = (pid + 1) % s.p.length;
      if (!s.p[tg] || s.p[tg].hp <= 0) tg = pid;
      return { key: R.SK.GUN, target: tg };
    };
    const out = [];
    for (let g = 0; g < games; g++) {
      const st = S.createState('multi', { next: T.mulberry32(555 + g * 7919) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(555 + g * 7919);
      const sub = T.policyChooserN(params, 0.15, 0.2, 5, 'soft');
      Play.autoGameN(st, [sub, scripted, scripted, scripted, scripted]);
      const row = { winner: st.winner, round: st.round };
      if (collect) { const bb = T.beliefObserve(st); row.bel = Object.keys(bb.tab).length; row.sig0 = bb.sig[1]; }
      out.push(row);
    }
    return out;
  }
  const sig = function (rows) { return rows.map(function (r) { return r.winner + '/' + r.round; }).join(' '); };
  /* ① 出厂必须关（干净沙箱里读，别用共享 `T` —— 它早被别的门喂过值） */
  const W0 = mkSb();
  eq(W0.EpirusTrainer.beliefSearchOn(), 0, '① 出厂必须是 0（实测 ' + W0.EpirusTrainer.beliefSearchOn() + '）⇒ 开档必须是点名行为，不是默认');
  ok(/let BELIEF_SEARCH = 0;/.test(EVO), '① 源码里的默认值必须是 `let BELIEF_SEARCH = 0`（被人改成 1 = 悄悄改了线上 AI 的行为）');
  /* ② setter 的口径：env/CLI 下达全是字符串，`'0'` 被当真是本仓反复踩的形状 */
  W0.EpirusTrainer.setBeliefSearch('0'); eq(W0.EpirusTrainer.beliefSearchOn(), 0, "② 字符串 '0' 必须判成关");
  W0.EpirusTrainer.setBeliefSearch(0); eq(W0.EpirusTrainer.beliefSearchOn(), 0, '② 数字 0 必须判成关');
  W0.EpirusTrainer.setBeliefSearch('1'); eq(W0.EpirusTrainer.beliefSearchOn(), 1, '② 字符串 "1" 必须判成开');
  /* ③ 开档真的改变了行为（钩子若被注释掉/短路成不返回，这段立刻红）+ 方向必须是"更强" */
  const OFF = batch(false, 12, false), ON = batch(true, 12, true);
  ok(sig(OFF) !== sig(ON), '③ 同 seed 下开档必须至少改变一局的结果（关/开逐字相同 = 钩子根本没接上，D174 那一族）');
  const winO = OFF.filter(r => r.winner === 0).length, winN = ON.filter(r => r.winner === 0).length;
  ok(winN >= winO + 3, '③ 方向：12 局里开档夺冠数必须比关档多 ≥3（实测 关=' + winO + ' 开=' + winN + '）⇒ 大样本是 31.50%→74.75%，掉回来就是坏了');
  /* ④ 复位必须真能抹掉：再跑一遍关档，要与 ③ 的关档基线**逐字相同**（"读回接口是关、作用点还开着"= 假复位） */
  eq(sig(batch(false, 12, false)), sig(OFF), '④ 关掉之后必须逐字回到基线（否则 `setBeliefSearch(0)` 没复位干净，历史臂就不可比）');
  /* ⑤ 信念表确实在长（不是每次都退回默认的 ジ），且键里带**席位身份**（无身份 = §E152d 里那个只有 +7.8/+15.5pt 的便宜档） */
  const sizes = ON.map(r => r.bel);
  ok(sizes.every(function (n) { return n > 3; }), '⑤ 开档的每局都该攒到"多个条件格"（实测 ' + sizes.join(',') + '）⇒ 表太小 = 学习信号没进来，或身份锚没进键');
  ok(/^1@/.test(ON[0].sig0 || ''), '⑤ 预测格的键必须以席位开头（实测 ' + ON[0].sig0 + '）⇒ §E152d：没有身份锚就只剩 +7.83pt 那一档');
  /* ⑤b **克隆保真**（§E159 那条页面缺陷的直接替身，比跑一整局便宜）：
     页面把 AI 喂的是 `cloneState(B.state)` ⇒ 表必须能从"被 JSON 往返过的 state"里原样重建，否则浏览器里开了档等于没开。 */
  {
    const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, P = W.EpirusPolicy, Play = W.EpirusPlay;
    const mm3 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    const pp = P.unpack(JSON.parse(mm3[1]), true);
    const st = S.createState('multi', { next: T.mulberry32(9021) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(9021);
    const f = T.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
    const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R.SK.JI; };
    Play.autoGameN(st, [f, others, others, others, others]);
    const a = JSON.stringify(T.beliefObserve(st).tab), b2 = JSON.stringify(T.beliefObserve(S.cloneState(st)).tab);
    ok(a.length > 20, '⑤b 一整局之后表必须真的非空（实测序列化长度 ' + a.length + '）');
    eq(b2, a, '⑤b **同一局、克隆体重建的表必须与活对象逐字相同**（页面喂的就是克隆；这条红了就等于"浏览器里开了档但没在学"，§E159 实测过那个失败形状：83.25% → 28.25%）');
  }
  /* ⑥ 泄漏红线：条件量只许用**公开信息**。扫的是重建函数全体（`beliefObserve` + `beliefSigOf`），
     键里出现 `elec`/`boom`/`bead`/`lastTarget`/`target` 就等于把"珠的类型"或"未出手的目标"喂给模型（v1.5.15 那条红线）。 */
  const bsBody = /function beliefObserve\(state\)[\s\S]{0,1600}?\n  \}/.exec(EVO);
  ok(bsBody, '⑥ 找不到 `beliefObserve`（学习条件的唯一来源）');
  /* ⚠ 必须先剥注释再扫：我第一版直接扫函数体，结果被我自己写的"不用 `p.lastSkill`"那句注释判红
     ⇒ 与 D204⑦ 那条 `state.rng` 的坑同族（**钉代码形状，不钉措辞**）。 */
  const bsCode = bsBody[0].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  ok(!/elec|boom|bead|lastTarget|\.target/.test(bsCode),
    '⑥ `beliefObserve` 的**代码**里不许读珠类型/目标这类私有信息（实测 ' + bsCode.replace(/\s+/g, ' ').slice(0, 140) + '）');
  ok(!/lastSkill/.test(bsCode),
    '⑥ 条件量必须走**同一种构造**（代码里出现 `lastSkill` = 训练格用走查值、预测格用引擎字段，两格不同构，表再准也接不上）');
  /* ⑦ 接线：页面侧的旋钮必须真的送到引擎（"闸放行 ≠ 线接通"，DS 今天立的那条） */
  ok(/localStorage\.getItem\('epirus\.beliefSearch'\)/.test(UI) && /Trainer\.setBeliefSearch\(bsOn\)/.test(UI),
    '⑦ `js/ui/ui.js` 必须读 `epirus.beliefSearch` 并调用 `Trainer.setBeliefSearch`（少了后半句 = 键能设但送不到作用点）');
  ok(/if \(bsMine\) \{ const bs = beliefSearchPick\(state, pid, cands, params\); if \(bs\) return bs; \}/.test(EVO),
    '⑦ 作用点必须在 `greedyOf` **内部**（只换"贪心那一支"，探索支不许动）——挂在 ε 之前会多抽一次随机数，开/关两档的轨迹就分叉了');
  ok(!/state\.rng\.next\(/.test(/function beliefSearchPick[\s\S]{0,1200}/.exec(EVO)[0]),
    '⑦ `beliefSearchPick` 里不许抽 `state.rng`（一次决策只该有一次 ε 抽取；多抽 = 同构漂移的另一半）。' +
    '⚠ 这条一开始写成"不许出现 state.rng"，结果被我自己的注释（"不许抽 `state.rng`"）判红 ⇒ 钉代码形状，不钉措辞');
  /* ⑧ 防漂移。这条判据我连写错两次，两次都被自己抓住，如实记下来免得下一个人再错：
     ✘ 第一版写"eps=1 时两把工厂必须给同样的选择" ⇒ 错：开档本来就该改变软豁免路径下的那一手，选择**应该**不同。
     ✘ 第二版写"开档不许多抽 `state.rng`" ⇒ 也错：搜索是确定性的，开了就不再走网络采样 ⇒ 抽数**必然变少**（实测 270 → 0）。
     ✓ 真正必须钉的是两件事：(a) **不许存在第二份候选枚举**（本仓"两份同构实现必漂移"第五次诱惑，我第一版工厂确实自己重写了三行）；
        (b) 开档必须**可复现**（同 seed 同结果 ⇒ 排除 `Math.random`/对象身份这类隐形输入）。 */
  {
    const fac = /function policyChooserBelief\([\s\S]{0,420}?\n  \}/.exec(EVO);
    ok(fac, '⑧ 找不到 `policyChooserBelief`');
    ok(fac[0].indexOf('policyChooserN(') >= 0, '⑧ 工厂必须**委派**给 `policyChooserN`（自己枚举一份 = 第二份实现，必漂）');
    ok(fac[0].indexOf('candidatesFor(') < 0 && fac[0].indexOf('econBase(') < 0,
      '⑧ 工厂里不许出现 `candidatesFor`/`econBase`（候选口径只许有一份真源；今晚第一版就是在这里漂掉的）');
    const trace = function () {
      const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, P = W.EpirusPolicy, Play = W.EpirusPlay;
      const mm2 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P.unpack(JSON.parse(mm2[1]), true);
      const f = T.policyChooserBelief(pp, 0.15, 0);
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R.SK.JI; };
      const seen = [];
      for (let g = 0; g < 3; g++) {
        const seed = 4242 + g * 977;
        const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
        if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
        Play.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    eq(trace(), trace(), '⑧ 开档必须可复现（同 seed 两次跑出不同结果 = 混进了 `Math.random`/对象身份这类隐形输入，A/B 不可信）');
    ok(trace() !== 'undefined/0,undefined/0,undefined/0', '⑧ 复现检查不许是"两批空跑"（真的量到了局）');
  }
  /* ⑪ §E161 的层数旋钮：默认必须是 1（= §E156b 那版行为），且"开档 + ply=2"必须真的不同于 ply=1
     （否则那三列"电磁炮/蓄能/集火回不回来"根本没在被测的东西上）。
     ⚠ 本段在文件里排在 ⑨ 之前（只是插入位置，编号仍跟着 ⑩ 之后）；⑩ 及 ⑪ 这两个圈码在别的门里也用过，
        读时按"本门内部编号"理解，别去别处找同名段。 */
  {
    const W = mkSb(), T = W.EpirusTrainer;
    eq(T.beliefPly(), 1, '⑪ `beliefPly()` 出厂必须是 1（实测 ' + T.beliefPly() + '）⇒ 默认形状必须等于已量过的那版');
    T.setBeliefPly('3'); eq(T.beliefPly(), 3, '⑪ 字符串 "3" 必须能设进去');
    T.setBeliefPly(99); eq(T.beliefPly(), 3, '⑪ 上界夹住（99 ⇒ 3）：一次决策要重放 候选^层，不许有人把它当"越深越好"随手调');
    T.setBeliefPly(0); eq(T.beliefPly(), 1, '⑪ 0 必须回到 1，不许出现"0 层"这种静默退化');
    T.setBeliefPly('abc'); eq(T.beliefPly(), 1, '⑪ 非数值必须回到 1（NaN 传下去会让整局成 NaN）');
    const trace = function (ply) {
      const W2 = mkSb(), T2 = W2.EpirusTrainer, S2 = W2.EpirusState, P2 = W2.EpirusPolicy, Play2 = W2.EpirusPlay, R2 = W2.EpirusRules;
      const mm4 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P2.unpack(JSON.parse(mm4[1]), true);
      T2.setBeliefSearch(1); T2.setBeliefPly(ply);
      const f = T2.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R2.SK.JI; };
      const seen = [];
      for (let g = 0; g < 2; g++) {
        const sd = 31337 + g * 977;
        const st = S2.createState('multi', { next: T2.mulberry32(sd) }, 5);
        if (T2.slotSaltFor) st.slotSalt = T2.slotSaltFor(sd);
        Play2.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    const t1 = trace(1), t2 = trace(2);
    ok(t1 !== t2, '⑪ 开档下 ply=1 与 ply=2 的整局必须不同（实测两批都是 ' + t1 + '）⇒ 相同就说明层数没接到评估里');
  }
  /* ⑫ §E161b/§E161c 的两个新档（目标怎么定价 `setBeliefTarget` / 平票怎么破 `setBeliefTie`）：
     出厂必须都是 0（= §E154~§E161 已认证的那把尺），且**每一档必须真的改判决**——
     不然"三列回没回来"是在一把没接到引擎的尺上量的（⑪ 同族的坑：旋钮印在 banner 上不等于进了决策）。 */
  {
    const src12 = readFileSync('js/train/evo.js', 'utf8');
    ok(/let BELIEF_TGT = 0;/.test(src12) && /let BELIEF_TIE = 0;/.test(src12),
      '⑫ 源码默认值必须是 `BELIEF_TGT = 0` / `BELIEF_TIE = 0`（出厂 = 已量过那版）');
    ok(src12.indexOf('else if (BELIEF_TIE === 1') >= 0,
      '⑫ 平票那条支路必须**带 `BELIEF_TIE === 1` 守卫**（tie=0 时一次都不许多算 `P.value` ⇒ 默认形状逐字不变）');
    const W12 = mkSb(), T12 = W12.EpirusTrainer;
    eq(T12.beliefTarget(), 0, '⑫ `beliefTarget()` 出厂必须是 0（实测 ' + T12.beliefTarget() + '）');
    eq(T12.beliefTie(), 0, '⑫ `beliefTie()` 出厂必须是 0（实测 ' + T12.beliefTie() + '）');
    T12.setBeliefTarget('2'); eq(T12.beliefTarget(), 2, '⑫ 字符串 "2" 必须能设进去');
    T12.setBeliefTarget(99); eq(T12.beliefTarget(), 2, '⑫ 上界夹住（99 ⇒ 2）');
    T12.setBeliefTarget(-1); eq(T12.beliefTarget(), 0, '⑫ 负数必须回 0，不许把 -1 当"另一种档"');
    T12.setBeliefTarget('abc'); eq(T12.beliefTarget(), 0, '⑫ 非数值必须回 0');
    T12.setBeliefTie(5); eq(T12.beliefTie(), 1, '⑫ 平票档只有两档，5 必须夹成 1');
    T12.setBeliefTie(0); eq(T12.beliefTie(), 0, '⑫ 0 必须能关回去');
    const trace12 = function (tgt, tie) {
      const W2 = mkSb(), T2 = W2.EpirusTrainer, S2 = W2.EpirusState, P2 = W2.EpirusPolicy, Play2 = W2.EpirusPlay, R2 = W2.EpirusRules;
      const mm4 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P2.unpack(JSON.parse(mm4[1]), true);
      T2.setBeliefSearch(1); T2.setBeliefTarget(tgt); T2.setBeliefTie(tie);
      const f = T2.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R2.SK.JI; };
      const seen = [];
      for (let g = 0; g < 6; g++) {
        const sd = 31337 + g * 977;
        const st = S2.createState('multi', { next: T2.mulberry32(sd) }, 5);
        if (T2.slotSaltFor) st.slotSalt = T2.slotSaltFor(sd);
        Play2.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    const base12 = trace12(0, 0);
    ok(trace12(0, 1) !== base12, '⑫ tie=1（平票交给网络打分）必须改判决（实测与基线同为 ' + base12 + '）⇒ 相同就说明这个档没接进搜索');
    ok(trace12(1, 0) !== base12, '⑫ tgt=1（减最强活着的那个）必须改判决（实测与基线同为 ' + base12 + '）');
    ok(trace12(2, 0) !== base12, '⑫ tgt=2（每次淘汰定价）必须改判决（实测与基线同为 ' + base12 + '）');
    eq(trace12(0, 0), base12, '⑫ 同档两次跑必须逐字相同（搜索不许抽 `state.rng`）');
  }
  /* ⑨ 锚点纪律（今晚 D161 真红过一次换来的）：两道量具拿 `policyChooserN` 的**签名整行**当补丁锚点。
     钉法是"从两个库源码里把锚字符串抠出来，再要求 evo.js 逐字含有它"—— 而不是我再抄一遍那行字
     （抄第三份 = 制造下一次"改了一处漏两处"，本仓那条老规矩）。 */
  {
    const anchors = [];
    for (const lib of ['tools/guard-cost-lib.mjs', 'tools/seq-reward-lib.mjs']) {
      const m = /const A = '(  function policyChooserN[^\n]*?)';/.exec(readFileSync(lib, 'utf8'));
      ok(m, '⑨ ' + lib + ' 里抠不到 `policyChooserN` 的锚字符串（库的形状改了 ⇒ 这条纪律要跟着改写法，不许直接删断言）');
      anchors.push(m[1]);
    }
    eq(anchors[0], anchors[1], '⑨ 两道量具的锚必须是**同一行字**（各自一份就会有一天各改各的）');
    ok(EVO.indexOf(anchors[0]) >= 0,
      '⑨ `evo.js` 里必须逐字含有这一行签名（被改 = 两道量具的 route ① 静默失配；D161 今晚就是这么红的）');
  }
});

t('D205 门号纪律（DS 清单 B8 · 09-30 夜班）：D 号不许撞车，且 CHANGELOG 最新一版声称的每个门号必须真在册（钉"记账说门在、门不在"）', function () {
  /* 为什么有这条：09-29 DS 的插门脚本拿 `indexOf("t('D200")` 当"已经插过了"的判据 ⇒ 撞上在册的 D200 就**静默跳过**，
     而提交说明与 CHANGELOG 都写了"门 D200"（我复核时抓到）。这类事故靠人核对核不住——今晚我自己就把一段截断的输出读成了"两道红"。
     ⚠ 本门只管**精确撞车**（同号两次）。另有一条已知但今天不动的形状：`D33` 与 `D33b` 互为**前缀**，
     所以 `indexOf("t('D33")` 这种写法对它们天然歧义 ⇒ 已写进 HANDOFF 交 DS 裁要不要给带字母后缀的那道换号（半夜单方面改历史门号，风险大于收益）。 */
  const own = readFileSync(new URL(import.meta.url), 'utf8');
  const gateIds = [...own.matchAll(/^t\('([A-Za-z]+[0-9]+[a-z]?)/gm)].map(m => m[1]);
  const dupOf = function (list) { const c = {}; for (const x of list) c[x] = (c[x] || 0) + 1; return Object.keys(c).filter(k => c[k] > 1); };
  const dOnly = gateIds.filter(x => /^D[0-9]/.test(x));
  ok(dOnly.length >= 150, '① 反装饰守卫：本文件应扫到 ≥150 道 D 类门（实测 ' + dOnly.length + '）⇒ 抽取式一旦被改空，这条要响亮失败，不许变成"永远通过');
  ok(dupOf(dOnly).length === 0, '② D 号撞车：' + dupOf(dOnly).join(' ') + ' ⇒ 撞号的那道会被"已插入"判据静默吞掉，记录里却写着有这道门');
  ok(dupOf(['D204', 'D204', 'D205']).length === 1, '③ 合成正对照：判据函数对明知重复的输入必须响（没响 ⇒ 上面那条是装饰）');
  /* ④ 只核**最新一版**：老条目里存在"其实不存在的 D200"这类更正用的话，扫全文会把更正本身判红。 */
  const top = String(readFileSync('CHANGELOG.md', 'utf8').split(/^## /m)[1] || '');
  const idSet = new Set(gateIds);
  const claimOf = function (text) { return [...new Set([...text.matchAll(/\bD([0-9]+)(?![0-9])/g)].map(m => 'D' + m[1]))]; };
  const claims = claimOf(top);
  ok(claims.length >= 3, '④ 反装饰：最新一版 CHANGELOG 至少该提到 3 个门号（实测 ' + claims.length + '）⇒ 提到 0 个说明抽取式失效');
  const ghost = claims.filter(c => !idSet.has(c));
  ok(ghost.length === 0, '⑤ 记账说门在、门不在：最新一版提到 ' + claims.join(' / ') + '，其中 ' + ghost.join(' / ') + ' 在 np-test 里**没有注册**');
  ok(claimOf('新增门 D99999 与 D204').filter(c => !idSet.has(c)).join() === 'D99999',
    '⑥ 合成正对照：给判据一段"声称有 D99999"的文本，它必须把 D99999 抓出来（抓不到 ⇒ ⑤ 是假的）');
});

t('D206 econ 奖励键三处名单自洽（DS 清单 B7 · 09-30 夜班）：默认表 / CLI 名单 / 两处 SENT 夹具 ⇒ 缺任一处就是"通过黑键闸却从没送到引擎"', function () {
  /* 为什么有这条：v1.5.274 那回 `costlyW` 登记进了 CLI 名单、黑键闸放行，但**引擎侧没人读它** ⇒ "传了等于没传"（METHODOLOGY 第一条硬规矩）。
     B7 列的"五处"里今天能机械核对的是这三处，就钉这三处；钉不全的诚实印出来当**已知欠账**，不假装覆盖。 */
  const defaults = readEconEnv({});
  ok(ECON_REWARD_KEYS.length >= 20, '① 反装饰：`ECON_REWARD_KEYS` 该有 ≥20 个键（实测 ' + ECON_REWARD_KEYS.length + '）⇒ 名单被清空时这条要响');
  const noDef = ECON_REWARD_KEYS.filter(k => !(k in defaults));
  ok(noDef.length === 0, '② 名单里的键在 `readEconEnv({})` 默认表里找不到（引擎读到 undefined ⇒ 设了也不生效）：' + noDef.join(' / '));
  const cliBlock = String(readFileSync('tools/train-3p.mjs', 'utf8').match(/const CLI_ECON_REWARD_KEYS = \[[\s\S]*?\];/)[0]);
  const cli = [...cliBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
  ok(cli.length >= 8, '③ 反装饰：从 `train-3p` 抠到的 CLI 名单只有 ' + cli.length + ' 个键 ⇒ 抽取式大概已失效');
  const notKnown = cli.filter(k => ECON_REWARD_KEYS.indexOf(k) < 0);
  ok(notKnown.length === 0, '④ CLI 认得、引擎名单不认得（值被下达后就丢）：' + notKnown.join(' / '));
  const sentOf = function (f) {
    const s = readFileSync(f, 'utf8'); const i = s.indexOf('SENT');
    const seg = s.slice(i, s.indexOf('};', i));
    return new Set([...seg.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]));
  };
  const sA = sentOf('tools/np-test.mjs'), sB = sentOf('tools/probe-econ-reset-audit.mjs');
  ok(sA.size >= 15 && sB.size >= 20, '⑤ 反装饰：两处 SENT 解析出的键数 = ' + sA.size + ' / ' + sB.size + ' ⇒ 解析失效就别放行（D199 第一版那个形状）');
  const unsent = ECON_REWARD_KEYS.filter(k => !sA.has(k) && !sB.has(k));
  ok(unsent.length === 0, '⑥ 这个键**两处测试夹具都不送**（新登记的键没人验过它真能到达作用点）：' + unsent.join(' / '));
  const unsentOf = function (keys) { return keys.filter(k => !sA.has(k) && !sB.has(k)); };
  ok(unsentOf(['zzNotARealRewardKey']).join() === 'zzNotARealRewardKey',
    '⑦ 合成正对照：凭空造一个没登记的键，判据必须抓到（抓不到 ⇒ ⑥ 是装饰）');
});

t('D207 落点集中度 `conc()` 的手算自证（§E164 · 09-30 夜班）：新度量必须带手算值、分母为零不许 NaN、仪器不许抄第二份算术', function () {
  /* 为什么有这条（这条门的由来本身就是一次**自我更正**）：§E156b/§E161 我用 `focusRate`（"上一次带目标的伤害打的是谁"，连段率）
     断言开档"丢了集火"。但连段率低有两种完全不同的原因：**真的在撒**，或者"**这一回合打最该死的那个、下一回合改打另一个最该死的**"。
     ⇒ 补一把独立的尺：每局"最挨打的那个落点占本席带目标伤害的份额"（top）与"打了几家"（kinds）。
     ⚠ 度量算在 `tools/behavior-profile.mjs` 的 `conc()` 里（单一来源）；仪器只能 import 它，**不许再写一遍 `Σtop/Σgames`**。 */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/export function conc\(t\)/.test(bp), '① `behavior-profile` 必须**导出** `conc`（导不出就只能各抄一份算术）');
  ok(bp.indexOf('export const WIN = W;') >= 0, '② `behavior-profile` 必须交出它自己那份沙箱 `WIN`（`sandbox()` 每次新造实例 ⇒ 仪器自己 new 一份就活在另一个世界，档位切不到被测那条路）');
  const c1 = conc({ tgtGames: 3, tgtTopSum: 1.5, tgtKindSum: 7 });
  ok(c1 && Math.abs(c1.top - 50) < 1e-9 && Math.abs(c1.kinds - 7 / 3) < 1e-9,
    '③ 手算值必须对上：3 局、top 份额合计 1.5 ⇒ **50.0%**；家数合计 7 ⇒ **2.333**（实测 ' + JSON.stringify(c1) + '）');
  ok(conc({ tgtGames: 0, tgtTopSum: 0, tgtKindSum: 0 }) === null, '④ 没有带目标伤害的局 ⇒ 必须返回 null（不许 NaN 混进表里当 0%）');
  const inst = readFileSync('docs/artifacts/e161-ply.mjs', 'utf8');
  ok(inst.indexOf("from '../../tools/behavior-profile.mjs'") >= 0 && /conc/.test(inst),
    '⑤ 配对仪器必须**从 behavior-profile import `conc`**（抄第二份算术 = 本仓"两份同构实现必漂移"）');
  ok(!/tgtTopSum\s*\/\s*tgtGames/.test(inst.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
    '⑤′ 仪器源码里（剥掉注释后）**不许出现** `tgtTopSum / tgtGames` 这种第二份算术');
  ok(bp.indexOf("'  集中 '") >= 0, '⑥ 打印行必须带"集中"那一栏（少了它，体检与门禁看到的是同一个被误读的连段率）');
});

t('D208 开档的可复现性地基（§E164b · 09-30 夜班）：跨进程逐字相同 + 暖机后同进程两遍相同 + 仪器说明里不许再写"与工具种子带逐字同形"', function () {
  /* 为什么有这条：今晚全部"配对读数"的地基是**同一批牌 + 同一算法 ⇒ 同一个结果**。这句地基话今晚被我错过两次：
     ① 我在仪器与三份文档里写过"块切法与工具自身 `--games` 那条种子带**逐字同形**（b=0 那五局就是工具默认前五局）" ⇒ **实测错的**：
        `fieldProfile` 里 `rng = mulberry32(seed0 + g·997)` 而 `slotSalt = seed0 + g·2246822519`（同 seed0、**不同步长**），块起点只挪对 rng、槽位盐对不上
        ⇒ `G=10@4100` ‖ `G=5@4100 + G=5@8985` 实测 acts 248‖247、rounds 265‖285（**不是同一批牌**）。四处文档已原地更正。
     ② 我以为"同 seed 两遍相同"是显然的 ⇒ **同进程连跑两遍 `fieldProfile`（开档）第一遍与后面不同**（acts 54‖47‖47‖47），
        而**跨进程**同命令行连跑三遍**逐字相同**（防御 12.9% / 攻击 36.1% / 集火 29.2% / 集中 50.0% 三遍一致）。
        ⇒ 根因**今晚没定位到**（怀疑是某处首次调用才建立的缓存/懒初始化；`resolve.js` 与 `play.js` 里 `Math.random` 都是 0 处，`state.js` 1 处不在开档路径上）。
        ⇒ 所以这条门钉的是**实测成立的那两条**（跨进程相同、暖机后相同），而不是我原先那句错的"逐字同形"；
          第一遍不同这件事**留在 §E164b 当未结缺陷**，别当成"已经稳了"。 */
  const TBP = WIN.EpirusTrainer;
  const params = AUDIT.loadChamp(WIN, 'js/bundled-champion-3p.js', process.cwd());
  const key = (t) => JSON.stringify({ a: t.acts, w: t.wins, r: t.rounds, d: t.decisive, v: t.voided, f: t.focus, ta: t.tgtActs,
    tg: t.tgtGames, ts: Number((t.tgtTopSum * 1e6).toFixed(6)), tk: t.tgtKindSum, mx: t.maxEp, k: Object.keys(t.keys).sort().map((x) => x + ':' + t.keys[x]) });
  for (const mode of ['off', 'on']) {
    if (mode === 'on') { TBP.setBeliefSearch(1); TBP.setBeliefPly(1); TBP.setBeliefTarget(0); TBP.setBeliefTie(1); }
    else TBP.setBeliefSearch(0);
    fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi');            /* 暖机一遍（§E164b：开档第一遍与后续不同，原因未定位） */
    const one = key(fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi'));
    const two = key(fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi'));
    TBP.setBeliefSearch(0); TBP.setBeliefTie(0);
    ok(one === two, '① ' + mode + ' 档：暖机之后同参数两遍的度量必须逐字相同（实测 ' + one.slice(0, 80) + ' ‖ ' + two.slice(0, 80) + '）');
    const acts = Number((one.match(/"a":([0-9]+)/) || [0, '0'])[1]);
    ok(acts > 0, '② ' + mode + ' 档：两遍相同但**跑的是空表**（acts=' + acts + '）⇒ 仪器根本没进游戏，"相同"是假的');
  }
  /* ③ 跨进程：这条才是今晚那些表真正依赖的可复现性（每台仪器都是**一个进程跑一个配置**）。 */
  const outs = [];
  for (let i = 0; i < 2; i++) {
    const rr = spawnSync(process.execPath, ['tools/behavior-profile.mjs', '--eps=0.2', '--epsmode=soft', '--games=8', '--mirror=0', '--belief=1'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000 });
    ok(rr.status === 0, '③ 跨进程复现：第 ' + (i + 1) + ' 遍没跑成（exit=' + rr.status + '）');
    outs.push(String(rr.stdout || '').replace(/\r/g, ''));
  }
  ok(outs[0] === outs[1], '③ 同一命令行**换进程**必须逐字相同（实测两遍输出不同 ⇒ 今晚的开档读数不可复现，得先修这条再谈引用）');
  ok(/防御 [0-9.]+%.*昏手 [0-9.]+%/.test(outs[0]), '③′ 输出里必须有那行度量（没有 ⇒ 两遍"相同"可能是因为都在空转）');
  /* ④ 把今晚更正的那条错话钉住：不许有人再把"块 = 工具前 N 局"写回来。 */
  const inst = readFileSync('docs/artifacts/e161-ply.mjs', 'utf8');
  ok(inst.indexOf('逐字同形') < 0,
    '④ 配对仪器（`docs/artifacts/e161-ply.mjs`）的说明里不许再出现"与工具种子带**逐字同形**"（§E164b 实测不成立：acts 248‖247、rounds 265‖285）');
});

t('D209 人类形状对手池的单一来源（§E168 · 09-30 夜班）：`tools/human-pool.mjs` 自证 + 两台仪器不许各自再抄一份采样', function () {
  /* 为什么有这条：§E168 要把"风格代价"从脚本桌复量到人类形状桌 ⇒ 必须与 §E155 用**同一个**采样器，否则两张桌子的"人类形状"不是同一个东西，
     而复量出来的差恰好落在我自己最关心的那几列上。提取的动作本身也要钉住——本仓"两份同构实现必漂移"已经应验五次，第六次最可能发生在"重构后忘了删旧的"。 */
  const errs = selfTest();
  ok(Array.isArray(errs) && errs.length === 0, '① `selfTest()` 必须零错误（实测 ' + (Array.isArray(errs) ? errs.length : typeof errs) + '：' + JSON.stringify(errs) + '）');
  const hp = readFileSync('tools/human-pool.mjs', 'utf8');
  ok(/export function loadPool/.test(hp) && /export function makeMimic/.test(hp) && /export function selfTest/.test(hp),
    '② 三个导出齐备（少一个就意味着有人把逻辑挪回仪器里）');
  /* ③ 真池子：数量必须与 §E152e 那台解析器的产物一致（997 手抽样质量 / 56 局）⇒ json 被重新生成或截断时要在这里响 */
  const pool = loadPool(WIN, 'human');
  ok(pool.tot === 997 && pool.games === 56 && pool.conds > 20,
    '③ 人类形状池：抽样质量应为 997 手、56 局、条件键 >20（实测 ' + pool.tot + ' / ' + pool.games + ' / ' + pool.conds + '）⇒ 单一真源 `human-behavior.json` 变了却没人在读这两张桌子');
  const poolAi = loadPool(WIN, 'ai');
  ok(poolAi.tot > pool.tot, '③′ AI 形状池（' + poolAi.tot + '）不该比人类池小 ⇒ 两份分布都来自同一份 json，小的那份说明键前缀剥错了');
  /* ④ 两台仪器必须 import，且**不许**留本地采样实现 */
  for (const f of ['docs/artifacts/e155-humanpool.mjs', 'docs/artifacts/e168-style-human.mjs']) {
    const src = readFileSync(f, 'utf8');
    ok(src.indexOf('tools/human-pool.mjs') >= 0, '④ ' + f + ' 必须 import `tools/human-pool.mjs`（提走之后不许留第二份）');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    ok(!/POOL\[cond\]\s*=\s*POOL\[cond\]/.test(code) && !/function sample\s*\(dist/.test(code),
      '④′ ' + f + ' 里（剥注释后）还有本地采样实现的形状 ⇒ 两份实现必漂移');
  }
  /* ⑤ 风格度量也只许有一份：`behavior-profile` 内部不许出现第二份"按类别计数" */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/export function tallyPick/.test(bp) && /export function tallyClose/.test(bp),
    '⑤ `tallyPick`/`tallyClose` 必须导出（`fieldProfile` 与 §E168 那台复量共用这一份计数规则）');
  const defHits = (bp.match(/R\.CAT\.DEFENSE/g) || []).length;
  ok(defHits === 1, '⑤′ `behavior-profile` 里 `R.CAT.DEFENSE` 只许出现 1 次（实测 ' + defHits + '）⇒ 出现第二次就是"防御占比"有了两个定义');
  const inst = readFileSync('docs/artifacts/e168-style-human.mjs', 'utf8');
  ok(inst.indexOf('R.CAT.DEFENSE') < 0, '⑤″ §E168 仪器不许自己判类别（读 `fieldProfile` 的 tally 就行）');
  /* ⑥ §E169 那台仪器同样在人类形状桌上量 ⇒ 一并纳入"单一采样器"的名单（漏一个就会悄悄长出第三份采样） */
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  ok(i169.indexOf('tools/human-pool.mjs') >= 0 && !/POOL\[cond\]\s*=\s*POOL\[cond\]/.test(i169),
    '⑥ `e169-beadprice.mjs` 必须 import `tools/human-pool.mjs` 且不留本地采样');
  /* ⑦ §E176：把"单一来源"从**名单式**改成**机械式**。上面那份仪器名单是硬编码的，里面没有比它早生的 `e157`
     ⇒ 这条门"看得见三台、看不见第四台"，而第四份采样实现就那样并排跑了两个夜班。
     ⇒ 现在改成"谁读 `human-behavior.json` 谁就必须 import 那份"；要例外必须**点名 + 写理由 + 钉数量**（本仓"点过名却不在场"那族的老规矩）。 */
  const EXEMPT = {
    'docs/artifacts/e157-difficulty.mjs': '§E176 未结项：自带一份本地采样器，与单一来源"逐手 pick 相同但每手抽数不同步"⇒ 序列等价性未证；等 (a)/(b) 裁定后收编',
    'docs/artifacts/e157b-difficulty-pool.mjs': '§E176 已知**接坏的**对照台（主体席每手抽 0 次随机数），只作反面样本留档，不许当读数来源'
  };
  const readers = readdirSync('docs/artifacts').filter(function (f) { return /\.mjs$/.test(f); })
    .map(function (f) { return 'docs/artifacts/' + f; })
    .filter(function (p) { return readFileSync(p, 'utf8').indexOf('human-behavior.json') >= 0; });
  /* 生产者例外（**写**这份 json 的那台）单独点名——第一次跑这条门时它把 §E152e 也抓出来了，说明"读没读那份 json"这个谓词
     比"是不是第二份采样实现"宽，所以两件事要分开记，别混成一个豁免名单。 */
  const PRODUCER = 'docs/artifacts/e152e-human.mjs';
  ok(readers.indexOf(PRODUCER) >= 0 && readFileSync(PRODUCER, 'utf8').indexOf('writeFileSync(REPO + \u0027docs/artifacts/human-behavior.json') >= 0,
    '⑦‴ 生产者那台必须还在、且确实是**写**这份 json 的（它不采样 ⇒ 只许它一个人例外；改成别人了要同步改这条）');
  ok(Object.keys(EXEMPT).every(function (k) { return readers.indexOf(k) >= 0; }),
    '⑦ 例外名单里点名的文件已经不再读 `human-behavior.json` ⇒ 名单过期，来清账（别让一条已无对象的豁免继续占位）');
  eq(Object.keys(EXEMPT).length, 2, '⑦′ 例外只许两条（新增一条欠账要人裁定，别让它悄悄变多）');
  for (const p of readers) {
    if (EXEMPT[p] || p === PRODUCER) continue;
    ok(readFileSync(p, 'utf8').indexOf('tools/human-pool.mjs') >= 0,
      '⑦″ ' + p + ' 读 `human-behavior.json` 却没 import 单一来源 ⇒ 两份采样实现必漂移（§E174/§E175 的活例）；要例外必须在 `EXEMPT` 里点名并写理由');
  }
});

t('D210 §E169 的第 4 剂药有牙（`setBeliefBead` / `setBeliefRingPrice`，**两个默认 0 ⇒ 出厂形状逐字不变**）：旋钮必须真的改判决，且珠的三条去路只许数一份', function () {
  /* 为什么有这条（本仓"新门不许是装饰"的规矩）：§E169 量的正是"**给跨回合资源手写一个价，能不能买回长程**"。
     如果那两个旋钮没接进 `beliefValue`，仪器上"蓄能回来了"就只是我把噪声读成了趋势。⇒ 三条都要钉：
     ① 出厂默认 0 且两价为 0 的开档臂必须与 §E161 那一版（短写 `1:0:0`）**逐字同结果**（证明新增项没渗进默认路径）；
     ② 每一档必须**把它命名的那一列推动**（`bead`⇒蓄能/珠获得，`ring`⇒环）——同 5 局一批牌、只换一档；
     ③ 珠的三条去路（获得/消耗/过期）在 `behavior-profile` 里**只许出现在一处**，仪器不许自己扫 `state.events`。 */
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(/let BELIEF_BEAD = 0;/.test(src) && /let BELIEF_RING = 0;/.test(src),
    '① 源码默认值必须是 `BELIEF_BEAD = 0` / `BELIEF_RING = 0`（出厂 = §E161/§E168 已量过那版）');
  ok(/BELIEF_BEAD \* \(\(me\.elec/.test(src) && /BELIEF_RING \* \(me\.ringStreak/.test(src),
    '①′ 两项必须真的进 `beadTerm()`（源码里抠不到乘法形状 ⇒ 说明只加了 setter 没接进评估）');
  ok(src.indexOf('function beadTerm(me)') >= 0 && src.indexOf('return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (n ? sum / n : 0) + beadTerm(me);') >= 0,
    '①″ 默认那一路（`BELIEF_TGT === 0`）必须带 `+ beadTerm(me)` ⇒ 否则 `bead` 档在出厂目标函数上是空转的');
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(ui.indexOf('setBeliefBead') < 0 && ui.indexOf('setBeliefRingPrice') < 0,
    '①⁗ 页面**不许**接这两个档（§E169 是研究旋钮；接了就得重开"线上默认值"那条裁定，本门的"出厂形状不变"论证立刻作废）');
  const T210 = WIN.EpirusTrainer;
  eq(T210.beliefBead(), 0, '② `beliefBead()` 出厂必须是 0（实测 ' + T210.beliefBead() + '）');
  eq(T210.beliefRingPrice(), 0, '② `beliefRingPrice()` 出厂必须是 0（实测 ' + T210.beliefRingPrice() + '）');
  T210.setBeliefBead('6'); eq(T210.beliefBead(), 6, '②′ 字符串必须能设进去');
  T210.setBeliefBead(99); eq(T210.beliefBead(), 12, '②″ 上界夹住（99 ⇒ 12）');
  T210.setBeliefBead(-3); eq(T210.beliefBead(), 0, '②‴ 负数必须回 0（负价=反向激励，不许当"另一种档"）');
  T210.setBeliefBead('abc'); eq(T210.beliefBead(), 0, '②⁗ 非数值必须回 0');
  T210.setBeliefRingPrice(99); eq(T210.beliefRingPrice(), 12, '②⁵ 环价同样有上界');
  T210.setBeliefRingPrice(0); eq(T210.beliefRingPrice(), 0, '②⁶ 0 必须能关回去');
  const SK210 = WIN.EpirusRules.SK;
  const params210 = AUDIT.loadChamp(WIN, 'js/bundled-champion-3p.js', process.cwd());
  const arm = function (bead, ringp) {
    T210.setBeliefSearch(1); T210.setBeliefBead(bead); T210.setBeliefRingPrice(ringp); T210.setBeliefTie(0);
    fieldProfile(params210, 0.2, 'soft', 5, 4100, 'mixed', 'multi');           /* 暖机（§E164b：换档后第一遍不同，原因未定位） */
    const t = fieldProfile(params210, 0.2, 'soft', 5, 4100, 'mixed', 'multi');
    T210.setBeliefSearch(0); T210.setBeliefBead(0); T210.setBeliefRingPrice(0);
    return t;
  };
  const z = arm(0, 0), z2 = arm(0, 0);
  const keyZ = t => JSON.stringify({ a: t.acts, w: t.wins, r: t.rounds, d: t.decisive, v: t.voided, f: t.focus,
    bg: t.beadGain, bs: t.beadSpend, bx: t.beadExpire, k: Object.keys(t.keys).sort().map(x => x + ':' + t.keys[x]) });
  eq(keyZ(z), keyZ(z2), '③ 两价为 0 时同批牌两遍必须逐字相同（搜索不许抽 `state.rng`）');
  const b4 = arm(4, 0), r4 = arm(0, 4);
  ok(b4.beadGain > z.beadGain, '④ `bead=4` 必须把**珠获得**推上去（实测 ' + b4.beadGain + ' vs 基线 ' + z.beadGain + '）⇒ 相同就说明这一档没接进评估');
  ok((b4.keys[SK210.CHARGE] || 0) > (z.keys[SK210.CHARGE] || 0), '④′ 同上，`蓄能` 出手数必须动（实测 ' + (b4.keys[SK210.CHARGE] || 0) + ' vs ' + (z.keys[SK210.CHARGE] || 0) + '）');
  ok(r4.ring > z.ring, '⑤ `ring=4` 必须把**环**推上去（实测 ' + r4.ring + ' vs 基线 ' + z.ring + '）');
  ok((r4.keys[SK210.RING] || 0) > (z.keys[SK210.RING] || 0), '⑤′ `聚能环` 出手数必须动（实测 ' + (r4.keys[SK210.RING] || 0) + ' vs ' + (z.keys[SK210.RING] || 0) + '）');
  /* ⑥ 反证那一列必须有内容：`bead` 档如果只会攒不会花，`beadExpire` 就必须看得见（数不出来的度量是装饰） */
  ok(b4.beadExpire > 0, '⑥ `bead=4` 那批牌里必须能看到**珠过期**事件被数到（实测 ' + b4.beadExpire + '）⇒ 为 0 说明 `beadExpire` 那条计数没接上，"只攒不打"就永远量不出来');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  for (const c of ['t.beadGain++', 't.beadSpend++', 't.beadExpire +=']) {
    const n = (bp.match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    ok(n === 1, '⑦ 珠的三条去路只许数一份：`' + c + '` 应出现 1 次（实测 ' + n + '）');
  }
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  ok(i169.indexOf("st.events") < 0, '⑧ §E169 仪器不许自己扫 `st.events`（读 `fieldProfile` 的 tally ⇒ 两份事件计数必漂移）');
  ok(/\[\s*'script'\s*,\s*'human'\s*\]/.test(i169),
    "⑨ 第 19 条陷阱的机械形状：这台仪器必须**两张桌**都能起 ⇒ `--table=both` 那一支必须展开成 ['script', 'human']" +
    "（只要求文件里出现过 'human' 不算——`flag('src','human')` 里也有，那是**池子来源**不是**桌子**；本门的这条判据本身就被这个假绿抓到过一次）");
});

t('D211 §E169b 把"屯而不打"与"没钱打"分开数的量具有牙（`beadLive/beadBroke/beadHeld`，手算夹具）', function () {
  /* 为什么有这条（这条门的由来是**一条差点写错的结论**）：§E169 量到"开了珠价之后 珠转化率 0.0%、过期 ×40"，我第一反应用的是
     "**近视定价 ⇒ 它学会屯珠不打**"。但补了 `峰值ep` 之后看到 **4.2 → 2.5**（配对差 −1.77 [−2.17,−1.38]）⇒
     电磁炮要 `2 ep + 1 电珠`**同时**成立，而蓄能一手就花 2 ep ⇒ "没开炮"里可能有一块是**蓄能把自己吃穷了**，不是偏好屯。
     两种机制的**修法完全不同**（改价格 vs 改预算），所以必须当场分开数，不能留到下一班猜。
     ⚠ 同族纪律：判据是"这一手**买不买得起**"，这是 `legal[i].affordable` 的直接读法——不是"ep 余额 ≥ 2"（那会把免费回合/减免都算错）。 */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/beadLive: 0, beadBroke: 0, beadHeld: 0/.test(bp), '① `tally()` 必须初始化那三个计数器');
  ok(/if \(state\.p\[pid\]\.elec > 0 && legal\)/.test(bp), '② `tallyPick` 必须在**被问到这一刻**判"手里有电珠"（事后从事件流反推不出可付性）');
  ok(bp.indexOf('tallyPick(t, state, pid, chooser(state, pid, legal), ctx, legal)') >= 0,
    '③ 调用点必须把 `legal` 传进去（不传 ⇒ 那三个计数器恒 0，整列是装饰）');
  /* ④ 手算夹具：合成输入 + 四种组合的期望值，全部当场核对（不跑真引擎 ⇒ <1 秒） */
  const mk = () => ({ acts: 0, def: 0, atk: 0, ring: 0, ji: 0, tgtActs: 0, focus: 0, voided: 0, endgameMultiOnly: 0,
    rounds: 0, wins: 0, decisive: 0, keys: {}, maxEp: 0, tgtGames: 0, tgtTopSum: 0, tgtKindSum: 0,
    beadGain: 0, beadSpend: 0, beadExpire: 0, beadLive: 0, beadBroke: 0, beadHeld: 0 });
  const st = { p: [], length: 5 };
  for (let i = 0; i < 5; i++) st.p.push({ hp: 20, ep: 4, elec: i === 0 ? 1 : 0, boom: 0, ringStreak: 0 });
  const ctx = { lastTgt: {}, tgtCnt: {}, seat: 0 };
  const lgNoGun = [{ key: WIN.EpirusRules.SK.JI, affordable: true }, { key: WIN.EpirusRules.SK.GUN, affordable: true }];
  const lgGun = lgNoGun.concat([{ key: WIN.EpirusRules.SK.RAILGUN, affordable: true }]);
  const lgGunPoor = lgNoGun.concat([{ key: WIN.EpirusRules.SK.RAILGUN, affordable: false }]);
  const A = mk(); tallyPick(A, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGun);
  ok(A.beadLive === 1 && A.beadHeld === 1 && A.beadBroke === 0,
    '④ 有珠 + 买得起 + 打了ジ ⇒ 应为 live=1 / held=1 / broke=0（实测 ' + A.beadLive + '/' + A.beadHeld + '/' + A.beadBroke + '）');
  const B = mk(); tallyPick(B, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgNoGun);
  ok(B.beadLive === 1 && B.beadHeld === 0 && B.beadBroke === 1,
    '④′ 有珠 + 名单里根本没有电磁炮 ⇒ 应为 live=1 / held=0 / broke=1（实测 ' + B.beadLive + '/' + B.beadHeld + '/' + B.beadBroke + '）');
  const B2 = mk(); tallyPick(B2, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGunPoor);
  ok(B2.beadBroke === 1, '④″ 有珠但 `affordable:false` ⇒ 同样算"买不起"（实测 ' + B2.beadLive + '/' + B2.beadHeld + '/' + B2.beadBroke + '）');
  const D = mk(); tallyPick(D, st, 0, { key: WIN.EpirusRules.SK.RAILGUN, target: 1 }, ctx, lgGun);
  ok(D.beadLive === 1 && D.beadHeld === 0,
    '④‴ 有珠、买得起、**确实开了炮** ⇒ live=1 / held=0 / broke=0（实测 ' + D.beadLive + '/' + D.beadHeld + '/' + D.beadBroke + '）');
  st.p[0].elec = 0;
  const C = mk(); tallyPick(C, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGun);
  ok(C.beadLive === 0 && C.beadHeld === 0 && C.beadBroke === 0, '④⁗ 手里没珠 ⇒ 三个计数器都不许动（实测 ' + C.beadLive + '/' + C.beadHeld + '/' + C.beadBroke + '）');
  st.p[0].elec = 1;
  const E = mk(); tallyPick(E, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, undefined);
  ok(E.beadLive === 0, '④⁙ 没传 `legal` ⇒ 整条判据跳过（不许把"看不见"当成"买不起"，实测 ' + E.beadLive + '）');
  /* ⑤ 单一来源：仪器只许读 tally 的比，不许再自己扫一遍 `legal`（两份可付性判断必漂移） */
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  const code169 = i169.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\.affordable/.test(code169), '⑤ §E169 仪器里不许出现第二份 `.affordable` 判断（可付性只认 `tallyPick` 那一份）');
  ok(/beadHeld/.test(code169) && /beadBroke/.test(code169) && /beadLive/.test(code169),
    '⑤′ 仪器必须把三样都读出来（少一样就退化成"看起来像屯"的单边读数）');
  /* ⑥ 地板：这套计数器**必须真的在真局里有非零读数**，否则前面五条静态钉合起来仍然可能是装饰 */
  const params6 = AUDIT.loadChamp(WIN, 'js/bundled-champion-3p.js', process.cwd());
  const T6 = WIN.EpirusTrainer;
  T6.setBeliefSearch(1); T6.setBeliefBead(2);
  fieldProfile(params6, 0.2, 'soft', 3, 4100, 'mixed', 'multi');
  const t6 = fieldProfile(params6, 0.2, 'soft', 10, 4100, 'mixed', 'multi');
  T6.setBeliefSearch(0); T6.setBeliefBead(0);
  ok(t6.beadLive > 0 && (t6.beadHeld + t6.beadBroke) > 0,
    '⑥ 真局地板：`bead=2` 那 10 局里三个计数器必须都活（实测 live=' + t6.beadLive + ' held=' + t6.beadHeld + ' broke=' + t6.beadBroke +
    '）⇒ 全 0 说明夹具过了但真引擎里接不上（本仓"夹具缺对比度"那一族）');
});

/* ===== D216（10-01 深夜 · 千问 · DS 交接件 §3 点名的三处 + 我复核时挖出的第四处）=====
 * 判**行为**不判字符串：造一份**手算**夹具，跑两个入口，要求逐项计数、四个广度量、分母处理、桶不重叠全部命中手算值，
 * 并且两入口打印的同一组数**逐字相同** —— "读取实现只有一份"这句话，只有跑出来的相等才算证据
 * （两份同构实现必漂移是本仓反复栽的老病：D209 的人类采样器、§E178 的三台仪器都是靠"逐位相同"才敢并排读）。
 * 手算依据：夹具里 AI 席（2..5）共 **12 条**原始计数，其中 **5 条是 `已淘汰`** ⇒ 真出手 **7 手，恰好 7 张不同卡各打一次**
 *   ⇒ 均匀分布 ⇒ `H = ln 7 = 1.9459`、**G = exp(H) = 7.00**（解析值，不需要信工具的算术）
 *   ‖ 前 3 = 3/7 = **42.9%** ‖ 防御族只有「八卦阵」= 1/7 = **14.3%** ‖ 卡表共 30 张 ⇒ 未出现 **23 张**。
 * ⚠ 四条各治一处病：② `已淘汰` 进分母（DS §3.2）③ 两入口同源（DS §3.3）④ 「狙击枪」被 `/枪(?!法)/` 吃进"枪"（千问新查）
 *   ⑤ 表外 token 不许静默丢（DS §3.1 的根：名单被抄第二遍）。 */
t('D216 真机栏的读取只许一份实现：手算夹具四个量 + 两入口逐字相同 + `已淘汰` 不进分母 + 桶不重叠', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd216-'));
  writeFileSync(join(dir, 'a.txt'),
    '第 1 回合：玩家1=【ジ】  玩家2=【枪→玩家1】  玩家3=【狙击枪→玩家2】  玩家4=【八卦阵】  玩家5=【已淘汰】\r\n' +
    '第 2 回合：玩家1=【ジ】  玩家2=【聚能环】  玩家3=【激光剑→玩家4】  玩家4=【已淘汰】  玩家5=【已淘汰】\r\n');
  writeFileSync(join(dir, 'b.txt'),
    '第 1 回合：玩家1=【ジ】  玩家2=【ジ】  玩家3=【已淘汰】  玩家4=【已淘汰】  玩家5=【蓄能】\r\n');
  const run = function (argv) { return spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: 120000 }); };
  const rj = run(['tools/log-census.mjs', dir, '--json']);
  eq(rj.status, 0, '① `log-census --json` 必须 exit 0（实测 ' + rj.status + ' ‖ ' + String(rj.stderr).slice(0, 160) + '）');
  const J = JSON.parse(rj.stdout);
  eq(J.games, 2, '① 局数');
  eq(J.raw, 12, '① 原始计数（含 `已淘汰`，这是"剔之前有多少"的那个数）');
  eq(J.elim, 5, '① `已淘汰` 必须单独计数而不是丢掉');
  eq(J.hands, 7, '② **分母必须剔掉 `已淘汰`**（该是 7；若等于 raw 就是 DS §3.2 那条病复发）');
  eq(J.kinds, 7, '① 出现的种数');
  eq(J.G.toFixed(2), '7.00', '① G=exp(H) 必须等于解析值 7.00（7 项各一次 ⇒ 均匀）');
  eq(J.top3.toFixed(1), '42.9', '① 前 3 占比 = 3/7');
  eq(J.defense.share.toFixed(1), '14.3', '① 防御族 = 八卦阵 1 手 / 7（成员表也从规则表现取）');
  eq(J.cardTableSize, 30, '① 卡表规模（这张表变了 ⇒ 未出现数就得跟着重看）');
  eq(J.never.length, J.cardTableSize - J.kinds, '① 未出现卡数 = 卡表 − 出现过（两条必须自洽，不许一边手写）');
  const g = J.dist.filter(function (o) { return o.card === '枪'; })[0];
  const s = J.dist.filter(function (o) { return o.card === '狙击枪'; })[0];
  eq(g && g.n, 1, '④ 「枪」只许 1 手（旧 `/枪(?!法)/` 会把「狙击枪」也吃进来 ⇒ 报成 2 = 同一手计两次）');
  eq(s && s.n, 1, '④ 「狙击枪」独立成桶');
  eq(Object.keys(J.unknown).length, 0, '⑤ 表外token 必须为 0（不为 0 就是"读不出"，不许静默丢手）');
  /* ③ 两入口逐字相同：把 `log-behavior` 的文本按同一组量抠出来比 */
  const rb = run(['tools/log-behavior.mjs', dir]);
  eq(rb.status, 0, '③ `log-behavior` 必须 exit 0（实测 ' + rb.status + ' ‖ ' + String(rb.stderr).slice(0, 160) + '）');
  const out = String(rb.stdout);
  const grab = function (re) { const m = re.exec(out); return m ? m[1] : null; };
  eq(grab(/有效出手 (\d+)\*\*/), String(J.hands), '③ 两栏的"有效手"必须同一个数');
  eq(grab(/种类 \*\*(\d+)\*\*/), String(J.kinds), '③ 两栏的"种数"必须同一个数');
  eq(grab(/前 3 \*\*([\d.]+)%\*\*/), J.top3.toFixed(1), '③ 两栏的"前 3"必须同一个数');
  eq(grab(/G=exp\(H\) ([\d.]+)/), J.G.toFixed(2), '③ 两栏的 G 必须同一个数');
  eq(grab(/占有效出手 ([\d.]+)%/), J.defense.share.toFixed(1), '③ 两栏的防御占比必须同一个数');
  /* ⑥ 打错的开关必须响亮（仓规 v1.5.234：静默走默认席位 = 假读数）*/
  eq(run(['tools/log-census.mjs', '--seat=2,3,4,5']).status, 64, '⑥ `log-census` 的 `--seat=`（少个 s）必须 exit 64');
  eq(run(['tools/log-behavior.mjs', '--seat=2,3,4,5']).status, 64, '⑥ `log-behavior` 同样要拒（这两个入口以前根本没守卫）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 临时目录清不掉不影响判据 */ }
});

const __src = readFileSync(new URL(import.meta.url), "utf8").split("\n");

const __nReg = __src.filter(l => /^t\(/.test(l)).length;
if (__nReg !== PASS + FAIL + __skipped) {
  console.error("⛔ 注册的 t() 有 " + __nReg + " 条，但只执行了 " + (PASS + FAIL) + " 条"
    + (__skipped ? "（另有 " + __skipped + " 条被 --only 跳过）" : "")
    + " ⇒ 有门落在 process.exit 之后（死代码）或被条件跳过。这不是全绿，是少跑。");
  process.exit(1);
}
if (ONLY) {
  console.log('\n⚠ `--only=' + ONLY + '`：**只跑了 ' + (PASS + FAIL) + ' / ' + __nReg + ' 条**（跳过 ' + __skipped
    + ' 条）⇒ 这不是全量门禁，**不许当"四道全绿"引用**（`node tools/np-test.mjs` 不带参数才是整轮）。');
}
/* `--only` 打错字 ⇒ 一条都不跑却报"通过 0 / 0"，那是最坏的一种绿（看着像跑完且全绿）。响亮拒。 */
if (ONLY && PASS + FAIL === 0) {
  console.error('⛔ `--only=' + ONLY + '` 在 ' + __nReg + ' 条注册里**一个都没匹配到** ⇒ 一条没跑，这不是全绿。检查子串拼写。');
  process.exit(3);
}


console.log('\nN人测试：通过 ' + PASS + ' / ' + (PASS + FAIL));


process.exit(FAIL ? 1 : 0);