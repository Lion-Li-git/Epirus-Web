#!/usr/bin/env node
/* §E680 盲区探针：改掉对局状态里**一件事实**，问两层问题 ——
 *   ① v7 的状态编码器读出来的向量变没变（变几格）⇒ 这一维"看得见"吗；
 *   ② 若看得见，冠军的**决策**跟不跟着变（eps=0 的贪心 chooser ⇒ 无采样噪声）。
 * 服务于用户那句最终目标（「冠军能结合实时对局环境使用最适合的策略」）：**看不见就谈不上适配**。
 * 三条自证（少一条这张表就不能引）：
 *   · 同形对照：同一份 state 重建两次 ⇒ 特征逐格相同且决策相同（查 chooser 与探针的确定性）；
 *   · 落地对照：每个扰动都必须真的改到 state（拿 `{p, round}` 的快照逐字比 ⇒ 不改就不算扰动）；
 *   · **在册对照**（这条是第一版写错的，改正）：`docs/research/DIM-V8-LANDING-2026-10-15.md` 说的不是
 *     "`guardNext`/`tauntPending` 没有列"，而是"**有列**（第 32‖172、28‖178 列）但真实决策点上输入恒零"
 *     ⇒ 所以探针在这两维上**必须**读出"特征会变"，读出的"反应"也**不许**当证据（真局里那一维从来没亮过）；
 *     而 `elec`/`beadNew`（对手的蓄能珠）那两维读出的"特征不变"也不是缺口 —— `CHANGELOG.md:10059/10063`（v1.5.15）
 *     是**故意**把珠类型从状态特征里摘掉的三处信息泄漏修复之一 ⇒ 归到"设计取舍"，不归到"看不见"。
 * ⚠ 实现约束：`policy.js:383` 的 `stateVec` 有**决策级缓存**（按 state 对象身份 + round + events.length 命中）
 *   ⇒ 就地改 `p[i].ep` 而不动 round/事件会读到**上一拍的向量** ⇒ 假盲区。所以每个扰动都从 `mk()` 重建一份新状态。
 * 用法：node tools/probe-state-blindspots.mjs [--pack=<包>] [--seeds=6] [--round=9] */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'seeds', 'round'], 'probe-state-blindspots');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const SEEDS = Number(arg('seeds', 6)), ROUND = Number(arg('round', 9));

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
if (T.setTrainMode) T.setTrainMode('multi');
const c = loadChamp(W, PACK);
if (!c || c.length !== P.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(c);
const sel = T.policyChooserN(params, 0);

function mk(seed, tweak) {
  const st = S.createState('multi', { next: T.mulberry32(seed * 7919 + 13) }, 5);
  st.round = ROUND;
  for (let i = 0; i < 5; i++) {
    const p = st.p[i];
    p.ep = 2 + (i % 3);
    p.hp = Math.max(2, p.hp - (i % 2));
    p.boom = i === 1 ? 1 : 0;
    p.ringStreak = i === 1 ? 2 : 0;
    p.elec = i === 2 ? 1 : 0;
    p.beadNew = i === 2 ? 'elec' : '';
    p.lastSkill = i === 3 ? R.SK.GUN : null;
    p.lastTarget = i === 3 ? 0 : null;
  }
  st.events.push({ type: 'action', pid: 1, key: R.SK.RING, target: null, via: 'test' });
  st.events.push({ type: 'damage', source: 2, to: 0, amt: 1, via: 'test', reason: '测试伤害' });
  if (tweak) tweak(st);
  return st;
}
const snap = function (st) { return JSON.stringify({ p: st.p, r: st.round }); };
const diffCells = function (a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
const decide = function (st) {
  const a = sel(st, 0, Play.legalActions(st, 0));
  return (a && a.key) + '/' + (a === null ? 'null' : a.target) + '/' + ((a && a.bead) || '-');
};

/* 第三列 = 在册状态：'' = 常规可动用；'恒零列' = 有列但真实决策点上从来没亮过（DIM-V8）；'故意不泄漏' = v1.5.15 摘掉的 */
const PERTURB = [
  ['对手1 ep 3→6', st => { st.p[1].ep = 6; }, ''],
  ['对手1 hp −1', st => { st.p[1].hp = Math.max(1, st.p[1].hp - 1); }, ''],
  ['对手1 ringStreak 2→0', st => { st.p[1].ringStreak = 0; }, ''],
  ['对手1 boom 1→0', st => { st.p[1].boom = 0; }, ''],
  ['对手1 elec 0→1', st => { st.p[1].elec = 1; }, '故意不泄漏'],
  ['对手1 beadNew →fire', st => { st.p[1].beadNew = 'fire'; }, '故意不泄漏'],
  ['对手1 cannonCount 0→2', st => { st.p[1].cannonCount = 2; }, ''],
  ['对手1 guardNext 0→1', st => { st.p[1].guardNext = 1; }, '恒零列'],
  ['对手1 stickers 空→1 张', st => { st.p[1].stickers = (st.p[1].stickers || []).concat([{ owner: 0, round: st.round }]); }, ''],
  ['对手1 mineArmed false→true', st => { st.p[1].mineArmed = true; st.p[1].mineTurns = 2; }, ''],
  ['对手1 fireWeakNext 0→1', st => { st.p[1].fireWeakNext = 1; }, ''],
  ['对手1 tauntActive 0→1', st => { st.p[1].tauntActive = 1; }, ''],
  ['对手1 lastSkill →GUN', st => { st.p[1].lastSkill = R.SK.GUN; st.p[1].lastTarget = 0; }, ''],
  ['对手1 rodGuard 0→3', st => { st.p[1].rodGuard = 3; }, ''],
  ['对手1 tauntPending 0→1', st => { st.p[1].tauntPending = 1; }, '恒零列'],
  ['对手4 hp→0（阵亡）', st => { st.p[4].hp = 0; }, ''],
  ['我自己(0) ep 2→6', st => { st.p[0].ep = 6; }, ''],
  ['round 9→20', st => { st.round = 20; }, '']
];
console.log('包=' + PACK + ' ‖ 桌=multi n=5 ‖ round=' + ROUND + ' ‖ ' + SEEDS + ' 份种子 ‖ chooser eps=0');
let detBad = 0;
for (let s = 1; s <= SEEDS; s++) {
  const a = mk(s, null), b = mk(s, null);
  if (diffCells(P.featuresV7(a, 0), P.featuresV7(b, 0)) !== 0 || decide(a) !== decide(b)) detBad++;
}
console.log('自证①同形对照：重建两次必须逐格相同且同决策 ⇒ 违例 ' + detBad + '/' + SEEDS +
  (detBad ? ' ⇒ 探针不成立，下面的数一律别引' : ' PASS'));
if (detBad) process.exit(2);
let appBad = 0, rows = [];
const flipOf = {};
for (const [label, tw, tag] of PERTURB) {
  let feat = 0, act = 0, maxCells = 0, applied = 0; const samples = [];
  flipOf[label] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const base = mk(s, null), pert = mk(s, tw);
    if (snap(base) !== snap(pert)) applied++;
    const cells = diffCells(P.featuresV7(base, 0), P.featuresV7(pert, 0));
    if (cells > 0) feat++;
    maxCells = Math.max(maxCells, cells);
    const d0 = decide(base), d1 = decide(pert);
    const fl = d0 !== d1;
    if (fl) act++;
    flipOf[label].push(fl);
    if (s === 1) samples.push(d0 + '→' + d1);
  }
  if (applied !== SEEDS) appBad++;
  rows.push({ label, tag, feat, act, maxCells, applied, sample: samples[0] || '' });
}
/* 共翻诊断（--diag=1）：如果某些桌"改哪一维都翻"，那"反应率"量的就不是这一维的敏感度，而是**刀锋桌的占比**。
 * 计数只用**对手 1 那一侧**的常规维（排除我自己 ep / round / 对手4 这三类"人人都可能翻"的扰动）。 */
const opp1 = PERTURB.filter(function (x) { return !x[2] && /^对手1/.test(x[0]); }).map(x => x[0]);
const hist = new Array(opp1.length + 1).fill(0);
for (let s = 1; s <= SEEDS; s++) {
  let k = 0; for (const lb of opp1) if (flipOf[lb][s - 1]) k++;
  hist[Math.min(k, opp1.length)]++;
}
console.log('共翻诊断（每张桌在' + opp1.length + ' 个"对手1"常规维上翻了几次）：' +
  hist.map((v, i) => i + '次:' + v).filter(x => !/:0$/.test(x)).join(' ‖ '));
console.log('自证②落地对照：扰动必须真的改到 state ⇒ 没落地的扰动 ' + appBad + ' 条' + (appBad ? '（这些行的"看不见"不成立）' : ' 全 OK'));
for (const r of rows) {
  const verdict = r.tag ? ('〔' + r.tag + '〕') : '';
  const kind = r.tag === '故意不泄漏' ? '不进向量=设计取舍 ' : (r.tag === '恒零列' ? '有列但真局恒零 ' :
    (r.feat === 0 ? '★盲区（不进向量） ' : (r.act > 0 ? '看得见+会反应 ' : '看得见但不反应 ')));
  console.log(kind.padEnd(11) + r.label.padEnd(28) + verdict.padEnd(12) +
    ' 特征变 ' + r.feat + '/' + SEEDS + '（最多 ' + r.maxCells + ' 格） ‖ 决策变 ' + r.act + '/' + SEEDS +
    ' ‖ 落地 ' + r.applied + '/' + SEEDS + ' ‖ 例 ' + r.sample);
}
const zeroCols = rows.filter(r => r.tag === '恒零列');
const okZero = zeroCols.length > 0 && zeroCols.every(r => r.feat === SEEDS);
console.log('自证③在册对照：`guardNext`/`tauntPending` 这两维按 DIM-V8 的说法是**有列但真局恒零** ⇒ 探针必须读出"扰动会改向量"' +
  '（改不了 = 我的扰动没落地或列早没了）⇒ ' + (okZero ? 'PASS（两维都改了向量；它们的"决策变 ' + SEEDS + '/' + SEEDS + '"那一栏**不许引**）'
    : '不成立：' + zeroCols.map(r => r.label + ' 特征变 ' + r.feat + '/' + SEEDS).join(' ‖ ') + ' ⇒ 要么在册那条要重看，要么探针脏了'));
const usable = rows.filter(r => !r.tag);
console.log('常规维合计：' + usable.length + ' 维里 ' + usable.filter(r => r.feat === SEEDS).length + ' 维看得见、' +
  usable.filter(r => r.feat === SEEDS && r.act > 0).length + ' 维会改变这粒冠军的出手、' +
  usable.filter(r => r.feat === SEEDS && r.act === 0).length + ' 维看得见却不动（后者是**目标/剂量**问题，不是编码器问题）');
console.log('读法：★盲区 = 这一维根本没进状态向量 ⇒ 与"结合实时环境"这一目标直接相关；');
console.log('      "看得见但不反应" = 向量里有、而这粒冠军的决策不改 ⇒ 是**训练目标/剂量**问题，不是编码器问题；');
console.log('⚠ 本探针只答"看得见 / 反应没反应"，不判"反应得对不对"（后者要一把规范尺）。');
