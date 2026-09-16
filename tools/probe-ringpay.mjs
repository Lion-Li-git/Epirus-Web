/* tools/probe-ringpay.mjs —— "上环到底划不划算"的**只读**对照（v1.5.84；用户方向：先让环产生优势）
 *
 * 动机：用户指出"先有用聚能环产生优势了，冠军的集火或打断聚能环才更有用"⇒ 先验证收益是否**真的存在**，
 * 再谈怎么让冠军学会（环境优先，v1.5.82 §4 的复盘结论）。
 *
 * 引擎事实（已读代码，不猜）：
 *   state.js:105-107  `ring` 的花费：`p.ringStreak === 0 ? 3 : 0` ⇒ **只有第一环花 3 ジ，续环免费**；
 *   resolve.js:609  `ringStreak += 1; g = ringStreak >= 3 ? 3 : ringStreak` ⇒ 收益 +1/+2/+3；
 *   resolve.js:1036 该回合没成功出环 ⇒ `ringStreak = 0`（断一次清零）。
 *   ⇒ 净额：第 1 次 −2、第 2 次 +2、**第 3 次起 +3/回合**（ジ 只有 +1）。
 *
 * 做法：0 号座换成"存 3 → 上环 → 续到死"的**一行脚本**，1~4 号座用被测冠军（即逐座位轮换的 5 席对照），
 *   量它的夺冠率 + 环引擎是否真的转起来。随机基线（5 人局）= 20%。
 *
 * 用法：node tools/probe-ringpay.mjs [冠军包] [局数]
 */
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = Number(process.argv[3] || 40);
const NPLAY = Number(process.env.RINGPAY_N || 5);
const MODE = process.env.RINGPAY_MODE || 'multi';
const params = loadChamp(W, file);

/* 一行脚本：能续环就续（免费）；否则存够 3 就上环；再否则ジ。 */
/* 几种"环打法"（都用一行规则表达；挑最贵的可负担攻击卡来输出） */
const ATTACK_ORDER = ['bigT', 'railgun', 'laserEye', 'snipe', 'tank', 'sword', 'gun'];
function pickAttack(state, pid, legal) {
  for (const k of ATTACK_ORDER) {
    const hit = legal.filter(function (l) { return l.key === k && l.affordable; })[0];
    if (!hit) continue;
    const def = R.byKey[k] || {};
    let target = null;
    if (def.target !== 'self') {
      const opps = (W.EpirusState.opponentsOf ? W.EpirusState.opponentsOf(state, pid) : []);
      const alive = opps.filter(function (o) { return state.p[o] && state.p[o].hp > 0; });
      if (alive.length) target = alive.sort(function (a, b) { return (state.p[a].hp || 0) - (state.p[b].hp || 0); })[0];
    }
    return { key: k, target: target, target2: null, bead: (def.bead ? 'elec' : null) };
  }
  return null;
}
function makeDoctrine(kind) {
  return function (state, pid, legal) {
    const me = state.p[pid] || {};
    const has = function (k) { return legal.some(function (l) { return l.key === k && l.affordable; }); };
    const canRing = has(R.SK.RING);
    const streak = me.ringStreak || 0;
    const ep = me.ep || 0;
    if (kind === 'sustain') {                       // 一直续（已测：0/40）
      if (canRing && (streak > 0 || ep >= 3)) return { key: R.SK.RING, target: null, target2: null, bead: null };
      return { key: R.SK.JI, target: null, target2: null, bead: null };
    }
    if (kind === 'cycle') {                         // 攒到 3 就上环，环转起来后**留 3 点**其余全花掉，断了再进
      if (canRing && (streak > 0 ? ep >= 3 : ep >= 3)) {
        const atk = (ep >= 5 || streak === 0) ? pickAttack(state, pid, legal) : null;
        if (atk && ep >= 5) return atk;             // 仓里有粮（>=5）就先输出
        return { key: R.SK.RING, target: null, target2: null, bead: null };
      }
      return { key: R.SK.JI, target: null, target2: null, bead: null };
    }
    if (kind === 'burst') {                         // 环到连续第 3 次就全力输出，掉到 2 点以下再回环
      if (streak >= 3) { const a = pickAttack(state, pid, legal); if (a) return a; }
      if (canRing && (streak > 0 || ep >= 3)) return { key: R.SK.RING, target: null, target2: null, bead: null };
      const a2 = pickAttack(state, pid, legal);
      if (a2 && ep >= 2) return a2;
      return { key: R.SK.JI, target: null, target2: null, bead: null };
    }
    if (kind === 'saver') {                         // 只存钱：ep>=4 才放大招；ep==3 时若大招已可负担也放
      if (ep >= 4) { const a = pickAttack(state, pid, legal); if (a) return a; }
      if (ep >= 3) { const a2 = pickAttack(state, pid, legal); if (a2 && (R.byKey[a2.key] || {}).cost >= 3) return a2; }
      return { key: R.SK.JI, target: null, target2: null, bead: null };
    }
    if (kind === 'sniper') {                        // 对照：一直用最便宜的卡压血（不存钱）
      const a3 = pickAttack(state, pid, legal);
      if (a3) return a3;
      return { key: R.SK.JI, target: null, target2: null, bead: null };
    }
    /* safe：只有血 >=3 才敢续环（挨打风险低时堆仓），否则输出 */
    if ((me.hp || 0) >= 3 && canRing && (streak > 0 || ep >= 3)) return { key: R.SK.RING, target: null, target2: null, bead: null };
    const a3 = pickAttack(state, pid, legal);
    if (a3) return a3;
    return { key: R.SK.JI, target: null, target2: null, bead: null };
  };
}

const champion = T.policyChooserN(params, 0.15);
console.log('配置: ' + MODE + ' / ' + NPLAY + ' 人');
const KINDS = (process.argv[4] || 'sustain,cycle,burst,safe').split(',');
for (const kind of KINDS) {
const ringScript = makeDoctrine(kind);
let wins = 0, top2 = 0, engineOk = 0, ringsTotal = 0, epPeak = 0, decided = 0, dmg = 0;
const seatWins = new Array(NPLAY).fill(0);
for (let g = 0; g < GAMES; g++) {
  const st = S.createState(MODE, { next: mulberry32(777 + g) }, NPLAY);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(777 + g);
  const scriptSeat = g % NPLAY;                       // 逐座位轮换，避免座位偏置被误读
  const ch = [];
  for (let i = 0; i < NPLAY; i++) ch.push(i === scriptSeat ? ringScript : champion);
  Play.autoGameN(st, ch);
  if (st.winner === scriptSeat) wins++;
  if (st.winner != null && st.winner !== 'draw') { seatWins[st.winner]++; decided++; }
  if (st.winner === scriptSeat || (st.p[scriptSeat] && st.p[scriptSeat].hp > 0)) top2++;
  /* 引擎是否真的转起来：该座连续第 3 次及以上的环次数 */
  let streak = 0, eng = 0, rings = 0;
  for (const e of st.events) {
    if (e.type === 'action' && e.pid === scriptSeat) {
      if (e.outcome === 'ok' && e.key === R.SK.RING) { streak++; rings++; if (streak >= 3) eng++; }
      else if (e.key !== R.SK.RING) streak = 0;
    }
  }
  ringsTotal += rings; if (eng > 0) engineOk++;
  for (const e of st.events) if (e.type === 'damage' && e.source === scriptSeat) dmg += (e.amt || 0);
  const peak = st.p[scriptSeat] ? (st.p[scriptSeat].ep || 0) : 0;
  if (peak > epPeak) epPeak = peak;
}
console.log('');
console.log('【' + kind + '】夺冠 = ' + wins + ' / ' + GAMES + '（' + (100 * wins / GAMES).toFixed(1) +
  '%，随机基线 20%）· 引擎转起来 ' + engineOk + '/' + GAMES + ' 局 · 环 ' + (ringsTotal / GAMES).toFixed(1) +
  ' 次/局 · 它造成的伤害 ' + (dmg / GAMES).toFixed(1) + '/局 · 最高 ep ' + epPeak);
console.log('        各座夺冠（' + decided + ' 局分胜负）：' + JSON.stringify(seatWins));
}
