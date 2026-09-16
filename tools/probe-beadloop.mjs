/* tools/probe-beadloop.mjs —— **珠子闭环**的只读诊断（v1.5.83；用户裁定后的下一步）
 *
 * 要回答的问题（用户："激光眼也用爆破能……主要目标是破防御，而破防御需要别人进攻才起效，偏结盟用"）：
 *   在"珠子卡真的可负担"的那些决策点上，
 *     ① 它在**候选表**里吗？（不在 ⇒ 条件/枚举问题）
 *     ② 真实采样给它多少概率？（在但≈0 ⇒ 是价值估计问题）
 *     ③ 不给它的时候，网络选了什么？（判断它"用别的卡替代"是否合理）
 *
 * 方法（不重写游戏循环）：
 *   `Play.autoGameN(st, choosers)` 跑完整对局；把 0 号座包一层**只读记录器**：
 *   在每个决策点，用 `T.econBase`（与线上**同一份**经济门槛）重算候选表、
 *   并做 24 次**蒙特卡洛**（把 state.rng 临时换成独立流，问完还原 ⇒ 绝不消耗对局随机流）。
 *
 * 用法：node tools/probe-beadloop.mjs [包] [局数]
 */
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, X = W.EpirusResolve;
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = Number(process.argv[3] || 10);
const MC = 24;
const params = loadChamp(W, file);
console.log('=== 珠子闭环诊断：' + file + '（' + GAMES + ' 局 multi，0 号座，蒙特卡洛 ' + MC + ' 次/决策）===');

const BEAD_CARDS = ['railgun', 'laserEye'];      // 电磁炮（电珠）/ 激光眼（爆破能，首次 1ジ+1珠）
const rows = [];
let decisions = 0;

function recorder(sel, pid) {
  return function (state, pid2, legal) {
    pid = pid2;
    if (!legal) { legal = pid2; pid = 0; }   // 防御：签名不同时不至于崩
    decisions++;
    const me = state.p[pid] || {};
    const p = params;
    /* 候选表：与线上同源（affordable 过滤 + econBase 经济门槛） */
    const aff = legal.filter(function (l) { return l.affordable; });
    const base = T.econBase(state, pid, aff);
    let candKeys = [];
    try {
      const cands = P.candidatesFor(state, pid, base, {});
      candKeys = cands.map(function (c) { return c.key; });
    } catch (e) { /* 记不到就当空 */ }
    /* 蒙特卡洛：换独立 RNG ⇒ 不影响对局 */
    const realRng = state.rng;
    const mc = {};
    try {
      state.rng = { next: mulberry32(1000 + decisions) };
      for (let k = 0; k < MC; k++) {
        const pk = T.pickChampion(state, pid, legal, p, 0.15);
        const kk = pk && pk.key;
        if (kk) mc[kk] = (mc[kk] || 0) + 1;
      }
    } finally { state.rng = realRng; }
    rows.push({
      ep: me.ep || 0, elec: me.elec || 0, boom: me.boom || 0,
      affordable: legal.filter(function (l) { return l.affordable; }).map(function (l) { return l.key; }),
      candKeys: candKeys, mc: mc
    });
    return sel(state, pid2, legal);
  };
}

for (let g = 0; g < GAMES; g++) {
  const st = S.createState('multi', { next: mulberry32(5150 + g) }, 5);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(5150 + g);
  const choosers = [];
  for (let i = 0; i < 5; i++) {
    const sel = T.policyChooserN(params, 0.15);
    choosers.push(i === 0 ? recorder(sel, 0) : sel);
  }
  Play.autoGameN(st, choosers);
}

/* 统计：按"这张卡此刻可负担吗"分组 */
function summarize(card) {
  const ready = rows.filter(function (r) { return r.affordable.indexOf(card) >= 0; });
  const inCand = ready.filter(function (r) { return r.candKeys.indexOf(card) >= 0; });
  let picks = 0, opp = 0;
  const alt = {};
  ready.forEach(function (r) {
    picks += (r.mc[card] || 0);
    opp += MC;
    for (const k in r.mc) if (k !== card) alt[k] = (alt[k] || 0) + r.mc[k];
  });
  const top = Object.keys(alt).sort(function (a, b) { return alt[b] - alt[a]; }).slice(0, 4)
    .map(function (k) { return (W.EpirusRules.byKey[k] ? W.EpirusRules.byKey[k].name : k) + ' ' + (100 * alt[k] / Math.max(1, opp)).toFixed(1) + '%'; });
  console.log('\n【' + (W.EpirusRules.byKey[card] ? W.EpirusRules.byKey[card].name : card) + '】可负担的决策点 = ' + ready.length +
    ' / ' + decisions + '（' + (100 * ready.length / Math.max(1, decisions)).toFixed(1) + '%）');
  console.log('   在候选表里：' + inCand.length + ' / ' + ready.length +
    '（' + (ready.length ? (100 * inCand.length / ready.length).toFixed(0) : '—') + '%）');
  console.log('   真实采样选中率：' + (opp ? (100 * picks / opp).toFixed(1) : '—') + '%（蒙特卡洛 ' + MC + ' 次/点）');
  console.log('   不选它时选的是：' + (top.length ? top.join(' · ') : '—'));
}
console.log('\n决策点总数 = ' + decisions);
for (const c of BEAD_CARDS) summarize(c);

/* 最尖的一问：**手里有珠的时候**，它用掉了吗？ */
const withBead = rows.filter(function (r) { return (r.elec || 0) > 0 || (r.boom || 0) > 0; });
console.log('');
console.log('持有珠子（电或爆）的决策点 = ' + withBead.length + ' / ' + decisions);
const epDist = withBead.reduce(function (a, r) { a['ep' + r.ep] = (a['ep' + r.ep] || 0) + 1; return a; }, {});
console.log('   持珠时 ep 分布 = ' + JSON.stringify(epDist));
['laserEye', 'railgun'].forEach(function (c) {
  const ok = withBead.filter(function (r) { return r.affordable.indexOf(c) >= 0; });
  const cand = ok.filter(function (r) { return r.candKeys.indexOf(c) >= 0; });
  let picks = 0, opp = 0;
  ok.forEach(function (r) { picks += (r.mc[c] || 0); opp += MC; });
  console.log('   持珠时可负担【' + c + '】= ' + ok.length + '（在候选表 ' + cand.length + '）· 采样选中率 = ' +
    (opp ? (100 * picks / opp).toFixed(1) + '%' : '—'));
});

/* 蓄能可负担的 ep 分布（验证 v1.5.82 的门槛是否还在起作用） */
const chargePts = rows.filter(function (r) { return r.affordable.indexOf('charge') >= 0; });
console.log('');
console.log('蓄能可负担的决策点 = ' + chargePts.length + '；其中 ep 分布 = ' +
  JSON.stringify(chargePts.reduce(function (a, r) { a['ep' + r.ep] = (a['ep' + r.ep] || 0) + 1; return a; }, {})));
