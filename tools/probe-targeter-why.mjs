/* 为什么线上包在 targeter 场里**低于随机**？—— 把机制数出来（v1.5.116 · 第三方复核者）
 * 已知（`tools/l2-eval.mjs` 首批读数，40 局/场）：线上包 1st=5.0% vs pickRandom 27.5%。
 * 本探针不看胜率，只看**过程**：
 *   ① 我出什么招（狙击占比 —— targeter 的触发条件就是"谁用狙击/刚放冷枪/攒满大雷就瞄谁"）；
 *   ② 谁在打我（被几席集火 / 每人打我几下）；
 *   ③ **挨了打还不还手**（F 门那条"被集火还手率"的直接重算）；
 *   ④ 什么时候死的（回合数分布）；
 * 对线上包与 pickRandom 各跑一遍，差在哪一眼可见。
 * 用法：node tools/probe-targeter-why.mjs [GAMES=60] [包=线上包]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots, A = R.SK;
const N = Number(process.argv[2] || 60);
const FILE = process.argv[3] || 'js/bundled-champion-3p.js';
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
const ME = T.policyChooserN(load(FILE), 0.15);
const ATK = new Set(R.ATK_EFFECT);
function report(label, myChooser) {
  let dec = 0; const use = {}; let snipeWhenTargetable = 0, attackedAfterHit = 0, hitRounds = 0, focusSum = 0, died = 0, deadRound = 0, won = 0, dmgTaken = 0, dmgDealt = 0, guardShare = 0;
  let totalMyTurns = 0, myHits = [];
  for (let g = 0; g < N; g++) {
    const seat = g % 5;
    const st = S.createState('long', { next: mb(88100 + g * 977) }, 5);
    st.slotSalt = h32(88100 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === seat ? function (s2, pid, lg) {
      const r = myChooser(s2, pid, lg); const k = (typeof r === 'string' ? { key: r } : r).key;
      dec++; use[k] = (use[k] || 0) + 1;
      if (k === A.SNIPE) snipeWhenTargetable++;
      if (R.GUARD_FAMILY.indexOf(k) >= 0) guardShare++;
      return r;
    } : T.wrapBotN(B.pickTargeter));
    Play.autoGameN(st, cs);
    const me = st.p[seat];
    if (st.winner === seat) won++;
    if (me.hp <= 0) { died++; }
    /* 逐"我的回合"归因。⚠ 事件流里 damage **不带 round 字段**（只有 cancel 等个别事件带）⇒
     * 只能按"我出招的次数"自己数回合：每见到一次 `action`(pid===seat) 就进一个新回合，
     * 其间发生的 damage 都归到当前回合。第一版直接读 `e.round` ⇒ 全部塌进一个桶，
     * 读出"人均挨打 1.0 回合 / 还手率 0.0%"这种**两边一模一样**的假数（自查抓到的）。 */
    let turn = 0; const byTurn = {};
    for (const e of st.events) {
      if (e.type === 'action' && e.pid === seat) { turn++; continue; }
      if (e.type !== 'damage') continue;
      if (e.to === seat) { const t = Math.max(1, turn); (byTurn[t] = byTurn[t] || new Set()).add(e.source); if (e.amt) dmgTaken += e.amt; }
      if (e.source === seat) { dmgDealt += e.amt || 0; if (e.to != null) myHits.push([Math.max(1, turn), e.to]); }
    }
    const hitList = Object.keys(byTurn).map(Number).sort((a, b) => a - b);
    for (const t of hitList) {
      hitRounds++; focusSum += byTurn[t].size;
      /* "还手" = 挨打之后的**下一回合内**，我对某个刚打过我的人造成了伤害 */
      const attackers = byTurn[t];
      if (myHits && myHits.some(([mt, to]) => mt > t && mt <= t + 1 && attackers.has(to))) attackedAfterHit++;
    }
    if (me.hp <= 0) deadRound += st.round;
    totalMyTurns += turn;
  }
  const top = Object.entries(use).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${R.byKey[k].name || k} ${(100 * v / dec).toFixed(0)}%`);
  console.log(`\n=== ${label}（${N} 局 · 长程 · 4 席 pickTargeter）===`);
  console.log(`  胜率 ${(100 * won / N).toFixed(1)}% · 死亡 ${(100 * died / N).toFixed(0)}% · 死时平均回合 ${(deadRound / Math.max(1, died)).toFixed(1)}`);
  console.log(`  出手构成：${top.join(' · ')}  （防御族占 ${(100 * guardShare / dec).toFixed(1)}%）`);
  console.log(`  狙击出手 ${snipeWhenTargetable} 次 / ${dec} 决策（${(100 * snipeWhenTargetable / dec).toFixed(1)}%）⇒ targeter 的点名触发面`);
  console.log(`  我的回合数 ${(totalMyTurns / N).toFixed(1)}/局 · 其中挨打 ${(100 * hitRounds / Math.max(1, totalMyTurns)).toFixed(1)}% 的回合 · **挨打回合平均被 ${(focusSum / Math.max(1, hitRounds)).toFixed(2)} 席同时打** · 挨打后下一回合内还手率 ${(100 * attackedAfterHit / Math.max(1, hitRounds)).toFixed(1)}%`);
  console.log(`  造成伤害 ${(dmgDealt / N).toFixed(1)}/局 · 承受 ${(dmgTaken / N).toFixed(1)}/局`);
}
report(FILE.includes('bundled') ? '线上包' : basenameOf(FILE), ME);
function basenameOf(f) { return f.split('/').pop().replace('.bak', ''); }
report('pickRandom（基线）', (st, pid, lg) => B.pickRandom(st, pid, lg));
