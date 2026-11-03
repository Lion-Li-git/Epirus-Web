#!/usr/bin/env node
/* §E681 "反环"那一格的**规范一致性**尺（2026-10-22 凌晨 · 千问）
 * 背景：`tools/probe-state-blindspots.mjs` 量出现役冠军对 `ringStreak`（对手真在连开聚能环）反应最弱（48 份合成桌里 21%/44%）。
 *   但"反应弱"不等于"错"——要判对错得有一个**规范**。这里不自己发明规范，直接用**在册的那一条**：
 *   `js/train/evo.js` 的 `makeAntiRingTeacher`（v1.5.37 裁定）：
 *     「有对手 `ringStreak >= 1` 且我付得起小雷 ⇒ 打那个连开环最凶的人；否则交给基础策略」
 *   ⇒ 于是可问的问题是：**在规范适用的决策点上，冠军真按它做吗？** 与"合成桌反不反应"是两个不同的读数。
 * 做法（不自己写对局循环 ⇒ 只把 chooser 包一层，记录它被问到的那一刻）：
 *   ① 规范适用点 = 存在存活对手 `ringStreak>=1` 且 `MINI_T` 在合法且可负担表里；
 *   ② 规定动作 = `MINI_T` 且目标 = 其中 `ringStreak` 最大的那位；
 *   ③ 读数 = 冠军在这些点上的「出手 MINI_T 率」与「出手且目标选对人率」，两个都配 Wilson 95% 与**对照**（随机手 / `pickDefend`）。
 * 三条自证：同 seed 两次 ⇒ 决策序列逐字相同（确定性）‖ 适用点必须 >0（否则整张表是空枪）‖
 *   规范函数在适用点上必须每次都给出**具体目标**（给不出 = 我的谓词退化）。
 * 用法：node tools/probe-ring-norm.mjs [--pack=<包>] [--games=200] [--seed=7] [--mode=multi] [--n=5] */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'games', 'seed', 'mode', 'n', 'oppo'], 'probe-ring-norm');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 200)), SEED0 = Number(arg('seed', 7));
const MODE = arg('mode', 'long'), N = Number(arg('n', 5)), OppName = arg('oppo', 'ringmix');

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
if (T.setTrainMode) T.setTrainMode(MODE);
const c = loadChamp(W, PACK);
if (!c || c.length !== P.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(c);
const K = R.SK;

/* 规范：在册那条（`makeAntiRingTeacher` 的 v1.5.37 版）。返回 null = 这一格规范不适用（教师会交给基础策略） */
function normPrescribe(snap) {
  const canMini = snap.legal.some(function (l) { return l.key === K.MINI_T && l.affordable; });
  if (!canMini) return null;
  let best = -1, bestStreak = 0;
  for (let i = 0; i < snap.opps.length; i++) {
    const o = snap.opps[i];
    if (!o.alive) continue;
    if ((o.ringStreak || 0) >= 1 && o.ringStreak > bestStreak) { best = i; bestStreak = o.ringStreak; }
  }
  return best < 0 ? null : { key: K.MINI_T, target: best, streak: bestStreak };
}
function snapshot(st, pid, legal) {
  const opps = [];
  for (let i = 0; i < st.p.length; i++) if (i !== pid) opps.push({ idx: i, alive: st.p[i].hp > 0, ringStreak: st.p[i].ringStreak || 0, hp: st.p[i].hp, ep: st.p[i].ep });
  return { round: st.round, myEp: st.p[pid].ep, legal: legal.map(function (l) { return { key: l.key, affordable: !!l.affordable }; }), opps: opps };
}
/* 记录型 chooser：把"被问到的那一刻"存下来，转手仍交给真 chooser ⇒ 不改任何行为 */
function recorder(inner, sink) {
  return function (st, pid, legal) {
    const a = inner(st, pid, legal);
    sink.push({ snap: snapshot(st, pid, legal), got: a ? { key: a.key, target: a.target } : null });
    return a;
  };
}
/* 对手阵容：规范讲的是"有人在连开环"，所以阵容里**必须有开环的人**，否则适用点恒 0（这不算作弊，是这一格的测量条件）。
 * `ringmix`（默认）= 1 席 `pickRingSpam` + 3 席 `pickDefend`（防御不杀人 ⇒ 被测席活得久、决策点够多） */
function oppLineup(name) {
  if (name === 'balanced') return [B.pickBalanced, B.pickBalanced, B.pickBalanced, B.pickBalanced];
  if (name === 'ringonly') return [B.pickRingSpam, B.pickRingSpam, B.pickRingSpam, B.pickRingSpam];
  return [B.pickRingSpam, B.pickDefend, B.pickDefend, B.pickDefend];
}
function runGames(chooserFactory, games, seedBase) {
  const sink = [];
  const lineup = oppLineup(OppName);
  for (let g = 0; g < games; g++) {
    const st = S.createState(MODE, { next: T.mulberry32(seedBase + g * 977) }, N);
    const chs = [];
    let k = 0;
    for (let i = 0; i < N; i++) { chs.push(i === 0 ? recorder(chooserFactory(), sink) : lineup[(k++) % lineup.length]); }
    Play.autoGameN(st, chs);
  }
  return sink;
}
const wilson = function (k, n) {
  if (!n) return 'n=0';
  const z = 1.959964, p = k / n, d = 1 + z * z / n, mid = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return (100 * p).toFixed(1) + '% [' + (100 * (mid - h)).toFixed(0) + '–' + (100 * (mid + h)).toFixed(0) + ']';
};
const score = function (sink, label) {
  let applic = 0, keyHit = 0, bothHit = 0, canMini = 0, anyRing = 0, legalMini = 0;
  for (const row of sink) {
    const hasMini = row.snap.legal.some(function (l) { return l.key === K.MINI_T && l.affordable; });
    if (row.snap.legal.some(function (l) { return l.key === K.MINI_T; })) legalMini++;
    const ringSeat = row.snap.opps.some(function (o) { return o.alive && (o.ringStreak || 0) >= 1; });
    if (hasMini) canMini++;
    if (ringSeat) anyRing++;
    const want = normPrescribe(row.snap);
    if (!want) continue;
    applic++;
    if (!row.got) continue;
    if (row.got.key !== want.key) continue;
    keyHit++;
    if (row.got.target === want.target) bothHit++;
  }
  console.log(label.padEnd(26) + ' 决策 ' + sink.length + ' ‖ 小雷**在手** ' + wilson(legalMini, sink.length) + ' ‖ 在手且买得起 ' + wilson(canMini, sink.length) +
    ' ‖ 场上有人连开环 ' + wilson(anyRing, sink.length) + ' ⇒ **两者同时** ' + applic + ' 个（' + wilson(applic, sink.length) + '）' +
    (applic ? ' ‖ 按规范出手 ' + wilson(keyHit, applic) + ' ‖ 出手且选对人 ' + wilson(bothHit, applic) : ' ⇒ 规范从不被问，谈不上遵守'));
  return { applic: applic, keyHit: keyHit, bothHit: bothHit, total: sink.length };
};

const champ = function () { return T.policyChooserN(params, 0.15, 0); };      // ε=0 ⇒ 出厂贪心，无探索噪声
const sChamp = runGames(champ, GAMES, SEED0);
const sChamp2 = runGames(champ, GAMES, SEED0);
const detOK = JSON.stringify(sChamp.map(function (x) { return x.got; })) === JSON.stringify(sChamp2.map(function (x) { return x.got; }));
console.log('包=' + PACK + ' ‖ ' + MODE + ' n=' + N + ' ‖ ' + GAMES + ' 局 ‖ 座 0 =被测 ‖ 对手阵容=' + OppName);
console.log('自证①确定性：同 seed 两次决策序列逐字相同? ' + (detOK ? 'PASS' : 'FAIL') + '（FAIL ⇒ 尺不可信，下面全作废）');
if (!detOK) process.exit(2);
const a = score(sChamp, '① 冠军（ε=0）');
score(runGames(function () { return function (st, pid, legal) { const l = legal.filter(function (x) { return x.affordable; }); const u = (st.rng && st.rng.next) ? st.rng.next() : 0.5; return l.length ? l[Math.floor(u * l.length)] : null; }; }, GAMES, SEED0), '② 对照：随机合法手');
score(runGames(function () { return B.pickDefend; }, GAMES, SEED0), '③ 对照：pickDefend');
score(runGames(function () { return B.pickHeavyFire; }, GAMES, SEED0), '④ 对照：pickHeavyFire');
console.log('自证②适用点数（冠军那一行）= ' + a.applic + ' 个 ‖ =0 时它本身就是本尺**最重要的读数**：规范从不被问 ⇒ 谈不上遵守（看同一行两个分项哪个为 0）');
let normMissing = 0;
for (const row of sChamp) { const w = normPrescribe(row.snap); if (w && w.target == null) normMissing++; }
console.log('自证③规范函数在每个适用点都给出具体目标 ⇒ 缺目标 ' + normMissing + ' 处');
console.log('读法：① 那行若明显低于"该做什么"，是**目标/剂量**问题的证据；若与②同档，说明冠军在这格上等于随机。');
console.log('⚠ 规范来自 evo.js 的在册裁定（v1.5.37），不是本探针新立的；它只覆盖"反环"这一格，不能外推到"长程规划"整体。');
