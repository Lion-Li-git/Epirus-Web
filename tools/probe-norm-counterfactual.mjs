#!/usr/bin/env node
/* ===== 成对反事实 × 规范方向（§E685 · 千问 10-22 早段 · 研究分支）=====
 * 背景：`probe-state-blindspots` 量到冠军对 `ringStreak` 反应最弱（48 份合成桌 21%/44%），
 *   `probe-ring-norm` 量到"规范从不被问"（现役冠军 1204 个决策点上小雷 2ジ 可负担率 0.0%）。
 *   两把尺都不回答最后那一问：**当那格真的出现时，冠军翻的方向是不是规范要的那一手？**
 *
 * 这一台就是那一问。做法（预注册，写在跑之前）：
 *   · 同一局（同种子、同回合、同血量珠数）做**两个世界**：
 *       A = 没有人在连开聚能环（规范不适用）；
 *       B = 把某个存活对手的 `ringStreak` 设成 2（规范适用 ⇒ 规定动作 = 小雷打他）。
 *   · 只在**这一格里我确实付得起小雷**的决策点上量（否则"看不见"会被记成"不反应"——同 §E681 那一格）。
 *   · 记两个率：
 *       `命中B` = 在 B 世界里交出"规范规定的那一手（key 与 target 都对）"的比例；
 *       `命中A` = 在 A 世界里交出**同一手**的比例（规范在 A 不适用 ⇒ 这里高就是"没跟着事实翻"）；
 *     主读数 **方向 = 命中B − 命中A**（>0 且大 = 随事实翻转且翻向规范要的那一手）。
 *   · 两把对照（这是尺子自己的牙）：
 *       正对照 = 在册那位教师本身（`makeAntiRingTeacher`）⇒ 方向必须接近 +1；
 *       负对照 = "永远照同一手"（无视事实）⇒ 方向必须接近 0。
 *     ⇒ 两把对照不过，主读数就不许引用。
 *
 * 用法：node tools/probe-norm-counterfactual.mjs [--pack=…|--seeds=400|--quiet]
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'seeds', 'quiet'], 'probe-norm-counterfactual');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const SEEDS = Number(arg('seeds', 400));
const QUIET = argv.includes('--quiet');
if (!Number.isFinite(SEEDS) || SEEDS < 20) { console.error('⛔ --seeds 必须是 ≥20 的数（实测 ' + arg('seeds', 400) + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
if (T.setTrainMode) T.setTrainMode('multi');
const c = loadChamp(W, PACK);
if (!c || c.length !== P.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(c);
const K = R.SK;

/* 一格合成的决策点：5 人 · 第 9 回合 · 我自己 4 ジ（付得起小雷），其余座位血量/珠数各不同（免得退化成对称桌）。
 * `ringSeat` 给了谁 = B 世界；A 世界是同一个状态但没人连开环。 */
function mkState(seed, ringSeat, streak) {
  const st = S.createState('multi', { next: T.mulberry32(seed * 7919 + 13) }, 5);
  st.round = 9;
  for (let i = 0; i < 5; i++) {
    const p = st.p[i];
    p.ep = i === 0 ? 4 : 1 + (i % 3);
    p.hp = 3 - (i % 2);
    p.ringStreak = (i === ringSeat) ? streak : 0;
  }
  st.p[2].boom = 1;                                   // 场上有珠子在动，别把桌摆成纯攒钱世界
  return st;
}

/* 规范（在册那条 v1.5.37 的原文语义）：有人 ringStreak>=1 且我付得起小雷 ⇒ 打连开环最凶的那位。 */
function normPrescribe(st, pid, legal) {
  const mt = (legal || []).filter(l => l.key === K.MINI_T && l.affordable)[0];
  if (!mt) return null;
  let best = -1;
  for (let q = 0; q < st.p.length; q++) {
    if (q === pid) continue;
    const pq = st.p[q];
    if (!pq || pq.hp <= 0) continue;
    if ((pq.ringStreak || 0) >= 1 && (best < 0 || pq.ringStreak > st.p[best].ringStreak)) best = q;
  }
  return best < 0 ? null : { key: K.MINI_T, target: best };
}

const pickKey = function (a) { return a ? (a.key + '#' + (a.target == null ? '-' : a.target)) : 'null'; };
const wilson = function (k, n) {
  if (!n) return '0—0';
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return ((c - h) * 100).toFixed(1) + '—' + ((c + h) * 100).toFixed(1);
};

/* 三档策略：冠军贪心（ε=0，无探索噪声）‖ 正对照教师 ‖ 负对照"永远同一手" */
const ARMS = [
  ['被量：冠军包（ε=0 贪心）', function () { return T.policyChooserN(params, 0.15, 0); }],
  ['正对照：在册反环教师', function () { return T.makeAntiRingTeacher(function () { return { key: K.JI, target: null }; }); }],
  ['负对照：无视事实、永远同一手', function () { return function () { return { key: K.MINI_T, target: 1 }; }; }],
];

const rows = [];
let eligible = 0, skippedNoMini = 0, skippedDead = 0, prescHist = {};

for (const [label, mkChooser] of ARMS) {
  let hitB = 0, hitA = 0, flipOther = 0, flipIrrelevant = 0, flipHp = 0, nMiniA = 0, nMiniB = 0, n = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const ringSeat = 1 + (s % 4);                       // 连开环的那个座位在 1~4 之间轮转（不许永远摆同一席 ⇒ 座位偏置）
    const stA = mkState(s, -1, 0), stB = mkState(s, ringSeat, 2);
    const legalA = Play.legalActions(stA, 0), legalB = Play.legalActions(stB, 0);
    const pres = normPrescribe(stB, 0, legalB);
    if (!pres) { skippedNoMini++; continue; }           // B 里规范不适用（付不起小雷 / 没人活着连开环）⇒ 不进分母
    const miniA = legalA.filter(l => l.key === K.MINI_T && l.affordable).length > 0;
    if (!miniA) { skippedNoMini++; continue; }          // A 里付不起 ⇒ 两格不是"同一格只换一个事实"，配对不成立（同 §E681 那一格）
    prescHist[pres.key + '#' + pres.target] = (prescHist[pres.key + '#' + pres.target] || 0) + 1;
    const chooser = mkChooser();
    const a = chooser(stA, 0, legalA), b = chooser(stB, 0, legalB);
    n++;
    if (pickKey(b) === pickKey(pres)) hitB++;
    if (pickKey(a) === pickKey(pres)) hitA++;
    if (pickKey(a) !== pickKey(b)) flipOther++;
    /* 两把"规范看不见的事实"对照（ep 4⇒5 ‖ 我自己的血 3⇒2）：只翻一枚会被"这一枚恰好不动任何可付性"骗过去，
     *  两枚都不算数才敢把 0% 读成"它不读这一维"。规范只看"有没有人连开环 + 我付不付得起小雷"，这两维它都看不见。 */
    const stC = mkState(s, -1, 0); stC.p[0].ep = 5;
    const stD = mkState(s, -1, 0); stD.p[0].hp = 2;
    const c2 = chooser(stC, 0, Play.legalActions(stC, 0)), d2 = chooser(stD, 0, Play.legalActions(stD, 0));
    if (pickKey(a) !== pickKey(c2)) flipIrrelevant++;
    if (pickKey(a) !== pickKey(d2)) flipHp++;
    if (a && a.key === K.MINI_T) nMiniA++;
    if (b && b.key === K.MINI_T) nMiniB++;
  }
  rows.push({ label, n, hitA, hitB, 命中A: n ? hitA / n : NaN, 命中B: n ? hitB / n : NaN, 方向: n ? (hitB - hitA) / n : NaN,
    换招率: n ? flipOther / n : NaN, 换招率无关事实: n ? flipIrrelevant / n : NaN, 换招率血量: n ? flipHp / n : NaN,
    打小雷A: n ? nMiniA / n : NaN, 打小雷B: n ? nMiniB / n : NaN });
}

console.log('== 成对反事实 × 规范方向（规范 = 在册反环教师 v1.5.37）==');
console.log('   包=' + PACK + ' ‖ 摆的局=' + SEEDS + ' ‖ 进分母=' + rows[0].n +
  ' ‖ 规范不适用被剔除=' + skippedNoMini + '（付不起小雷/没人活着连开环）‖ 座位偏置检查=环手在 1~4 轮转');
if (rows[0].n < 20) {
  console.log('⛔ 进分母的格子不足 20 ⇒ 这一档**读不出**（不是"没反应"）。别引用方向读数。');
  process.exit(0);
}
console.log('   规定动作的分布（B 世界；**三臂累计**，每臂的分母见下一行）：' + JSON.stringify(prescHist));
console.log('   臂                                进分母  命中A(%)          命中B(%)          方向(B−A)   打小雷 A→B(%)   换招率 规范维/ep/血量(%)');
for (const r of rows) {
  console.log('   ' + r.label.padEnd(34, ' ') + ' ' + String(r.n).padStart(6) +
    '  ' + ((r.命中A * 100).toFixed(1) + ' [' + wilson(r.hitA, r.n) + ']').padEnd(16) +
    '  ' + ((r.命中B * 100).toFixed(1) + ' [' + wilson(r.hitB, r.n) + ']').padEnd(16) +
    '  ' + ((r.方向 * 100 >= 0 ? '+' : '') + (r.方向 * 100).toFixed(1) + 'pt').padStart(9) +
    '  ' + ((r.打小雷A * 100).toFixed(1) + '→' + (r.打小雷B * 100).toFixed(1)).padStart(10) +
    '  ' + ((r.换招率 * 100).toFixed(1) + ' / ' + (r.换招率无关事实 * 100).toFixed(1) + ' / ' + (r.换招率血量 * 100).toFixed(1)));
}
const champ = rows[0], pos = rows[1], neg = rows[2];
/* 三条自证（预注册时写死的阈值，不是看完数再定的）：
 *   正对照方向必须 >90pt（它会照规范翻）‖ 正对照在**无关事实**那一列必须 <5%（它只在规范那一维上换招）‖
 *   负对照方向必须 |·|<2pt（它不看事实，两格同率命中）。任何一条不过 ⇒ 本档主读数作废、退出码 3。 */
const teethOK = pos.方向 > 0.9 && pos.换招率无关事实 < 0.05 && Math.abs(neg.方向) < 0.02;
console.log('\n   尺子自证：正对照方向=' + (pos.方向 * 100).toFixed(1) + 'pt（要求 >90）‖ 正对照·无关事实换招=' + (pos.换招率无关事实 * 100).toFixed(1) +
  '%（要求 <5）‖ 负对照方向=' + (neg.方向 * 100).toFixed(1) + 'pt（要求 |·|<2）⇒ ' + (teethOK ? '**通过**，主读数可引用' : '**不通过 ⇒ 本档主读数一律作废**'));
if (!QUIET) {
  console.log('   读法：命中A 高 = 在规范不适用那一格也交同一手（"没跟着事实翻"）；命中B 高 = 事实到位那一格真按规范交那一手。');
  console.log('   ⚠ 这是**合成桌**：它只回答"如果那格出现，它会不会翻向规范要的那一手"，不回答"那格在真实流里出现几次"（后者 = probe-ring-norm 的适用率）。');
}
process.exit(teethOK ? 0 : 3);
