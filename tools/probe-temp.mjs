/* tools/probe-temp.mjs —— **温度 T 的（强度 ⇄ 多样性）曲线**（v1.5.85；用户要求"可调节的温度权重"）
 *
 * 用户的框架：吉布斯自由能 `G = H − T·S` ⇒ 冠军的目标里加 `+ T·S`，`T` 可调。
 * 现状（读代码）：目标函数**已经有这一项** —— `js/train/evo.js` 的 `divBonus = DIV_W * divNorm`
 *   （`coverageEntropy`，只统计**非ジ**动作；默认 `DIV_W = 0.06`，可用 `EPIRUS_DIV_W` 调）。
 *   所以缺的不是"S 项"，而是**调它的时候能看见什么**：本工具给的就是那条曲线。
 *
 * 本工具量的是**采样温度**（play-time T）对（胜率 ⇄ 技能熵）的影响，**只读**：
 *   同一权重，只用不同的采样温度跑同一批对局（逐局换边/轮座），报 1st%（强度）与 effSkills（多样性）。
 * 它回答的是"多给熵要付多少胜率"⇐⇒ 调 `DIV_W`（训练侧 T）时的预期形状由它给参考。
 *
 * 用法：node tools/probe-temp.mjs [包] [局数] [温度列表，逗号分隔]
 */
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, Bots = W.EpirusBots;
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = Number(process.argv[3] || 40);
const TEMPS = (process.argv[4] || '0.05,0.15,0.3,0.5,0.8').split(',').map(Number);
const params = loadChamp(W, file);

/* 中立场：与考卷基线同口径（4 个互不相同的普通脚本，逐局轮换座位） */
const FOES = ['pickRandom', 'pickBalanced', 'pickAggro', 'pickDefend'].map(function (n) { return T.wrapBotN(Bots[n]); });

console.log('=== 温度 T 的（强度 ⇄ 多样性）曲线：' + file + ' · ' + GAMES + ' 局/温度 · 基线 20% ===');
console.log('T(采样温度)'.padEnd(14) + '1st%    平均名次  effSkills(多样性)  伤害/局  首次出手分布(前5)');
for (const tp of TEMPS) {
  let first = 0, rankSum = 0, dmg = 0;
  const use = {}, aff = {};
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mulberry32(20240 + g) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(20240 + g);
    const seat = g % 5;
    const champ = T.policyChooserN(params, tp);
    /* 记录动作直方图（只算非ジ，与 coverageEntropy 口径一致） */
    const rec = function (state, pid, legal) {
      const pick = champ(state, pid, legal);
      if (pick && pick.key && pick.key !== R.SK.JI) use[pick.key] = (use[pick.key] || 0) + 1;
      for (const l of legal) if (l.affordable) aff[l.key] = 1;
      return pick;
    };
    const ch = [];
    let fi = 0;
    for (let i = 0; i < 5; i++) ch.push(i === seat ? rec : FOES[(fi++) % FOES.length]);
    Play.autoGameN(st, ch);
    if (st.winner === seat) first++;
    /* 名次：p[pid] 的**下标就是 pid**（没有 .pid 字段 —— 我上一版就是这里算错，全 0） */
    const order = st.p.map(function (x, i) { return { i: i, hp: x.hp }; }).sort(function (a, b) { return b.hp - a.hp; });
    for (let k = 0; k < order.length; k++) if (order[k].i === seat) rankSum += (k + 1);
    for (const e of st.events) if (e.type === 'damage' && e.source === seat) dmg += (e.amt || 0);
  }
  let tot = 0; for (const k in use) tot += use[k];
  let H = 0; if (tot > 0) for (const k in use) { const p = use[k] / tot; H -= p * Math.log(p); }
  const top = Object.keys(use).sort(function (a, b) { return use[b] - use[a]; }).slice(0, 5)
    .map(function (k) { return (R.byKey[k] ? R.byKey[k].name : k) + ' ' + (100 * use[k] / Math.max(1, tot)).toFixed(0) + '%'; });
  console.log(String(tp).padEnd(14) + (100 * first / GAMES).toFixed(1).padStart(5) + '%' +
    (rankSum / GAMES).toFixed(2).padStart(9) + Math.exp(H).toFixed(2).padStart(14) +
    (dmg / GAMES).toFixed(1).padStart(10) + '   ' + top.join(' · '));
}
console.log('');
console.log('注：训练侧的 T 就是 `DIV_W`（默认 0.06，EPIRUS_DIV_W 可调）⇒ 本表给的是"多给熵要付多少胜率"的形状参考。');
