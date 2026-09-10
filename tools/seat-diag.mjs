/* 3 人座位偏置诊断：
 *  1) 三个完全相同的策略坐三个座位 → 各座位 1st 率（理想 33.3%）
 *  2) 同优先级结算顺序：三方互放大雷 → 看谁的伤害先落地
 *  3) 3P 冠军的经济分布（ep）与技能使用分布
 * 用法：node tools/seat-diag.mjs [每组局数=200]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, window: {}, localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } } };
sb.globalThis = sb;
for (const x of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/train/trainer.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(x, 'utf8'), sb, { filename: x });
}
const W = sb.window;
const S = W.EpirusState, R = W.EpirusRules, P = W.EpirusPolicy, B = W.EpirusBots, T = W.EpirusTrainer, Play = W.EpirusPlay;
const champ = P.unpack(W.EPIRUS_CHAMPION_3P);
const GAMES = parseInt(process.argv[2] || '200', 10);
const N = 3;

function seatTable(label, chooser) {
  const first = [0, 0, 0], draws = { n: 0 };
  for (let g = 0; g < GAMES; g++) {
    const r = T.oneGameN([chooser, chooser, chooser], 5000 + g * 977, N);
    if (typeof r.winner !== 'number') draws.n++;   // 平局时 winner==='draw'
    else first[r.winner]++;
  }
  const decided = GAMES - draws.n;
  const pct = first.map(function (c) { return decided ? (c / decided * 100).toFixed(1) : '-'; });
  console.log(label.padEnd(26) + 'P0=' + String(pct[0]).padStart(5) + '%  P1=' + String(pct[1]).padStart(5) + '%  P2=' + String(pct[2]).padStart(5) + '%  平局=' + draws.n + '/' + GAMES + '（分母=' + decided + '）');
}

console.log('=== 1) 三个相同策略的座位 1st 率（理想 33.3% 均等）===');
seatTable('3x random', T.wrapBotN(B.pickRandom));
seatTable('3x aggro', T.wrapBotN(B.pickAggro));
seatTable('3x breakdef', T.wrapBotN(B.pickBreakDef));
seatTable('3x balanced', T.wrapBotN(B.pickBalanced));
seatTable('3x 3P冠军 temp0.15', T.policyChooserN(champ, 0.15));

console.log('');
console.log('=== 2) 同优先级结算顺序：三方互放大雷（P0→P1, P1→P2, P2→P0）===');
(function () {
  const st = S.createState('multi', { next: T.mulberry32(42) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 5; st.p[i].elec = 1; }   // 攒够大雷资源
  W.EpirusResolve.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.BIG_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  W.EpirusResolve.resolveActions(st);
  console.log('大雷落子 ok? P0=' + !!st.actions[0] + ' P1=' + !!st.actions[1] + ' P2=' + !!st.actions[2]);
  const evs = st.events.filter(function (e) { return e.type === 'voided' || e.type === 'damage' || e.type === 'bigTChain'; });
  for (const e of evs) console.log('   ' + e.type + ' pid=' + (e.pid != null ? e.pid : e.to) + ' amt=' + (e.amt != null ? e.amt : '-') + ' reason=' + (e.reason || e.by || ''));
  console.log('   最终 HP: ' + st.p.map(function (p) { return p.hp; }).join(' / ') + '   （若 P0 满血=P0 先手结算占了便宜）');
})();

console.log('');
console.log('=== 3) 3P 冠军经济分布（决策时 ep）与技能使用 ===');
(function () {
  const epHist = {}; let decisions = 0, maxEp = 0;
  const useCnt = {};
  const inner = T.policyChooserN(champ, 0.15);
  const probe = function (state, pid, legal) {
    const ep = state.p[pid].ep;
    epHist[ep] = (epHist[ep] || 0) + 1; decisions++; if (ep > maxEp) maxEp = ep;
    const a = inner(state, pid, legal);
    useCnt[a.key] = (useCnt[a.key] || 0) + 1;
    return a;
  };
  for (let g = 0; g < 60; g++) T.oneGameN([probe, probe, probe], 7000 + g * 131, N);
  const keys = Object.keys(epHist).map(Number).sort(function (a, b) { return a - b; });
  const cum = []; let acc = 0;
  for (const k of keys) { acc += epHist[k]; cum.push(k + ':' + (acc / decisions * 100).toFixed(0) + '%'); }
  console.log('决策数=' + decisions + '  最大 ep=' + maxEp);
  console.log('ep 累积分布  ' + cum.join('  '));
  const top = Object.keys(useCnt).sort(function (a, b) { return useCnt[b] - useCnt[a]; });
  console.log('技能使用 top12:');
  for (const k of top.slice(0, 12)) console.log('   ' + (R.byKey[k] ? R.byKey[k].name : k).padEnd(8) + (useCnt[k] / decisions * 100).toFixed(1) + '%');
  console.log('未使用技能数 = ' + (R.ACT_KEYS ? 0 : 0) + Object.keys(useCnt).length + ' 种被用过');
})();
