#!/usr/bin/env node
/* ===== 按席归因：n=4 的座位极差是"被集火"还是"自己打法有问题"（§E693 · 千问 10-23 夜）=====
 * 起因（§E691 复现过的新事实）：冠军镜像里 **4 人桌座位极差 13.0~17.5pt（四批种子同向，P1 每次最弱、P0 每次最强）**，
 *   而 n=3 只有 ~1pt、n=5 只有 2.3~4.2pt。今天没有任何判据管 4 人席（`D59` 与 `feasibilityOf` 座位道恒 5 席）。
 *   ⇒ 动判据之前先分清两种病因：
 *     A **结构性受害者**：这台包在 4 人桌上被更多人指为目标 ⇒ 换个包也一样，问题在选目标的规则；
 *     B **该包自己的形状**：受伤量差不多但 P1 就是赢不了 ⇒ 问题在这台包的打法/打分。
 *   本尺按席报五个数（出手 / 被指定为目标 / 吃伤害 / 造成伤害 / 夺冠与终局存活），A、B 一眼能分。
 *
 * 口径：
 *   · `被指定为目标` = 各席 chooser 交回的 `action.target` 计数（不含第二目标 target2，单独记一列以防双枪/镜面混淆）
 *   · `吃伤害` = `damage` 事件按 `to` 累加 `amt`；`造成伤害` = 按 `source` 累加（`source=null` 的那些——地雷/收缩——另计一列"无来源"）
 *   · 镜像臂里所有席同一策略 ⇒ "谁被打"只可能来自**座位在目标解析顺序里的位置**，这正是 A 类病因的定义
 *   · 对照：`pickRandom` 臂（完全不看血量的随机手）⇒ 如果随机手在 n=4 也出现 P1 吃亏，那就是**引擎/席位**的问题，不是这台包的
 *
 * 用法：node tools/probe-seat-focus.mjs [--games=300] [--seed=77000] [--seats=4,5]
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'seed', 'seats'], 'probe-seat-focus');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? (k === 'seats' ? a.slice(k.length + 3) : Number(a.slice(k.length + 3))) : d; };
const GAMES = arg('games', 300), SEED0 = arg('seed', 77000);
const SEATS = String(arg('seats', '4,5')).split(',').map(Number);
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000'); process.exit(2); }
for (const n of SEATS) if (!(n >= 2 && n <= 5)) { console.error('⛔ --seats 只能是 2~5（实测 ' + SEATS.join(',') + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const params = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js'));

const POLICIES = [
  ['冠军镜像', function () { return T.policyChooserN(params, 0.15, 0.15); }],
  ['杂货铺镜像', function () { return B.pickToolKit; }],
  ['随机手对照', function () { return B.pickRandom || function (st, pid, legal) { const a = legal.filter(function (l) { return l.affordable; }); return a.length ? a[Math.floor(st.rng.next() * a.length)] : { key: R.SK.JI, target: null }; }; }],
];

function run(policyFactory, n) {
  const acc = [];
  for (let i = 0; i < n; i++) acc.push({ act: 0, tgt: 0, tgt2: 0, dealt: 0, taken: 0, first: 0, aliveEnd: 0 });
  let noSource = 0, draws = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED0 + g * 977) }, n);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const mk = policyFactory();
    const seats = [];
    for (let i = 0; i < n; i++) seats.push(function (state, pid, legal) {
      const a = mk(state, pid, legal);
      if (a) { acc[pid].act++; if (a.target != null) acc[a.target].tgt++; if (a.target2 != null) acc[a.target2].tgt2++; }
      return a;
    });
    Play.autoGameN(st, seats);
    for (const e of (st.events || [])) {
      if (e.type !== 'damage') continue;
      if (e.source != null && acc[e.source]) acc[e.source].dealt += (e.amt || 0);
      else noSource += (e.amt || 0);
      if (acc[e.to]) acc[e.to].taken += (e.amt || 0);
    }
    for (let i = 0; i < n; i++) { if (st.p[i].hp > 0) acc[i].aliveEnd++; }
    if (st.winner === 'draw' || st.winner == null) draws++;
    else if (acc[st.winner]) acc[st.winner].first++;
  }
  return { n: n, acc: acc, noSource: noSource, draws: draws };
}

console.log('== 按席归因（§E693）· ' + GAMES + ' 局/格 ‖ seed0=' + SEED0 + ' ‖ multi（3 血）==');
console.log('   每格五个按席读数：出手 / 被指定为目标 / 吃伤害 / 造成伤害 / 夺冠%（终局存活%）');
for (const [label, factory] of POLICIES) {
  for (const n of SEATS) {
    const r = run(factory, n);
    const per = function (i, f) { return f(r.acc[i]).toFixed(1); };
    console.log('\n   ' + label + ' · n=' + n + '（无来源伤害合计 ' + (r.noSource / GAMES).toFixed(2) + '/局 ‖ 平局 ' + (100 * r.draws / GAMES).toFixed(1) + '%）');
    console.log('     席     出手/局   被指定/局   吃伤害/局   造成伤害/局   夺冠%    终局存活%');
    for (let i = 0; i < n; i++) {
      console.log('     P' + i + '  ' + per(i, function (a) { return a.act / GAMES; }).padStart(9) +
        per(i, function (a) { return a.tgt / GAMES; }).padStart(12) +
        per(i, function (a) { return a.taken / GAMES; }).padStart(12) +
        per(i, function (a) { return a.dealt / GAMES; }).padStart(14) +
        per(i, function (a) { return 100 * a.first / GAMES; }).padStart(10) +
        per(i, function (a) { return 100 * a.aliveEnd / GAMES; }).padStart(11));
    }
    const spread = function (f) { const v = r.acc.map(f); return (Math.max.apply(null, v) - Math.min.apply(null, v)).toFixed(1); };
    console.log('     极差：夺冠 ' + spread(function (a) { return 100 * a.first / GAMES; }) + 'pt ‖ 被指定 ' + spread(function (a) { return a.tgt / GAMES; }) +
      ' ‖ 吃伤害 ' + spread(function (a) { return a.taken / GAMES; }) + ' ‖ 造成伤害 ' + spread(function (a) { return a.dealt / GAMES; }));
  }
}
console.log('\n   读法：如果某个臂在 n=4 出现"夺冠极差大"但"吃伤害/被指定极差很小" ⇒ 是 B 类（这台包自己在 4 人桌上的形状）；');
console.log('        如果 P1 的"被指定/吃伤害"明显高于别席 ⇒ 是 A 类（席位在目标解析顺序里的位置），换包也一样；');
console.log('        随机手那一臂是**结构地板**：它完全不看血量与身份，若它也偏 P1，那这份偏置来自引擎的席位序而不是任何包的策略。');
