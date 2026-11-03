#!/usr/bin/env node
/* reflect-why.mjs — 追问："只镜面反射"那条 rung 凭什么夺1 65.3%？（千问 · 10-29，用户点出 3EP 一次说不过去）
 *
 * 已知三条（读规则读出来的，不是猜的）：
 *   ① `reflect` 花 **3 EP**（`rules.js:55` 的 mk(SK.REFLECT,…,0,3,'self')）；
 *   ② 它只反弹 `REFLECTABLE = [GUN, TANK]`（`rules.js:118`）——**ジ 不在里面**；
 *   ③ ladder 里"只镜面反射"= `pickBy(c=>c.key==='reflect')` ⇒ **有反射就反射、没有就退回ジ**
 *      ⇒ 真实打法不是"只反射"，是"**反弹 + ジ填充**"（ジ 每发还 +1 EP，`resolve.js:744`）。
 * ⇒ 所以 65.3% 要么来自"反弹把对手的枪/坦克伤害原样退回去"，要么来自"ジ 在那套对手表里本来就够赢"，要么两者相乘。
 * 这把尺只量三件事：
 *   A. 这局反射放了几次、反弹出去多少伤害（`reflect` 事件里 `to === 我方席` 的 `amt` 求和）；
 *   B. 我方挨的伤害按来源卡分（枪/坦克=可反弹 ‖ 其它=穿过去）；
 *   C. 按人数拆（n=3 vs n=5）：如果赢面随攻击者数量涨 ⇒ 反射的收益是"每多一个打你的人多一份"
 * 用法：node scratch/reflect-why.mjs [--games=40] [--packs=]（不给则只量 rung 本身）
 */
import { sandbox, loadChamp, buildPoolSeeded } from '../tools/audit-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Math.max(4, Number(arg('games', 40)) || 40);

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
ref = Float64Array.from(ref);
const POOL = buildPoolSeeded(T, ref, 20261029);
if (typeof T.setBigTPush === 'function') T.setBigTPush(12);

/* 与 ladder 逐字同一份：引擎同口径候选面（`evo.js:404` 那份 cancelOther 的复刻） */
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
      return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
  }
  return null;
}
function candsOf(state, pid, legal) {
  return P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
}
/* ⚑ 每次决策都记一笔：出手时 EP 多少、候选表里有没有 reflect、**买不买得起**（规则里 reflect 要 3 EP）
 *   用户那句"3EP 一次怎么能每回合放"直指这一格 ⇒ 先量"提交的动作是不是合法的"，再谈强度。 */
const AUDIT = { n: 0, reflectPicked: 0, reflectAffordable: 0, reflectNotAffordable: 0, epAtPick: [], fallbackJi: 0, emptyCands: 0 };
function pickKey(key, opts) {
  const audit = opts && opts.audit;
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) { if (audit) AUDIT.emptyCands++; return { key: R.SK.JI }; }
    const hit = cs.filter((c) => c.key === key)[0];
    if (audit) {
      AUDIT.n++;
      const ep = state.p[pid] ? state.p[pid].ep : NaN;
      AUDIT.epAtPick.push(ep);
      if (hit) {
        AUDIT.reflectPicked++;
        const cost = (R.byKey && R.byKey[key] && (R.byKey[key].ep != null ? R.byKey[key].ep : R.byKey[key].epCost)) || NaN;
        if (Number.isFinite(cost) && ep >= cost) AUDIT.reflectAffordable++; else AUDIT.reflectNotAffordable++;
      } else AUDIT.fallbackJi++;
    }
    if (hit) return { key: hit.key, target: hit.target == null ? null : hit.target, target2: hit.target2 == null ? null : hit.target2, bead: hit.bead || null };
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }

const REFLECTABLE = new Set(R.REFLECTABLE || []);
/* `--trace=1`：只打一局，逐回合印"我方 EP 前后 + 这一手是什么 + 弹没弹出去" ⇒ 直接看 3EP 的账怎么平的 */
if (arg('trace', '0') === '1') {
  const cell = CELLS[0];
  const seat = 0;
  const log = [];
  const actor = function (state, pid, legal) {
    const epBefore = state.p[pid].ep;
    const aff = (legal || []).filter((x) => x.key === R.SK.REFLECT)[0];
    const pick = pickKey(R.SK.REFLECT)(state, pid, legal);
    log.push({ round: state.round, epBefore, key: pick.key, legalHasReflect: !!aff, affordable: aff ? aff.affordable : null, loan: aff ? aff.loan : null });
    return pick;
  };
  const ch = []; for (let pid = 0; pid < cell.n; pid++) ch.push(pid === seat ? actor : POOL[(cell.idx + 1 + pid) % POOL.length].sel);
  const rm = T.oneGameN(ch, 1000 + cell.n * 97 + cell.idx, cell.n, { regen: 0, mode: 'multi' });
  console.log('# 逐回合账（n=' + cell.n + ' ' + cell.name + ' ‖ 局号与 ladder 同）‖ 我方 EP 在前、这一手是什么、引擎的 legal 里那枚 affordable/loan 怎么说');
  for (const r of log) console.log('  R' + String(r.round).padStart(2) + ' ‖ EP ' + String(r.epBefore).padStart(3) + ' ‖ 出手 ' + String(r.key).padEnd(7)
    + ' ‖ legal 里有 reflect: ' + (r.legalHasReflect ? 'yes（affordable=' + r.affordable + ', loan=' + r.loan + '）' : 'no'));
  console.log('  ⇒ 结局 winner=' + rm.winner + ' ‖ rounds=' + rm.rounds + ' ‖ 终局 EP=' + (rm.state.p[seat] ? rm.state.p[seat].ep : '—') + ' ‖ 终局 HP=' + (rm.state.p[seat] ? rm.state.p[seat].hp : '—'));
  process.exit(0);
}
function myHpRaw(rm, seat) { const st = rm.state; return st && st.p && st.p[seat] ? Math.max(0, st.p[seat].hp) : 0; }
const agg = {};   /* 按 n 汇总 */
for (const cell of CELLS) {
  const bucket = (agg[cell.n] = agg[cell.n] || { games: 0, wins: 0, casts: 0, reflAmt: 0, takenRefl: 0, takenOther: 0,
    jiActs: 0, otherActs: 0, rounds: 0, hp: 0, dead: 0 });
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) choosers.push(pid === seat ? pickKey(R.SK.REFLECT, { audit: true }) : POOL[(cell.idx + 1 + pid) % POOL.length].sel);
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state;
    bucket.games++;
    if (rm.winner === seat) bucket.wins++;
    /* ⚑ 自洽检查：赢了却 hp≤0、或死了却算赢，都是"读数接错"的信号（第一版就撞见 76.9% 胜 / 37.8% 阵亡） */
    if (rm.winner === seat) { bucket.winAndDead = (bucket.winAndDead || 0) + (myHpRaw(rm, seat) <= 0 ? 1 : 0); }
    if ((rm.rounds || 0) >= 45) bucket.sudden = (bucket.sudden || 0) + 1;
    bucket.rounds += rm.rounds || 0;
    const myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    bucket.hp += myHp;
    if (myHp <= 0) bucket.dead++;
    let castThisRound = -1;
    for (const e of (st.events || [])) {
      if (e.type === 'action' && e.pid === seat) {
        if (e.key === R.SK.REFLECT) bucket.casts++;
        else if (e.key === R.SK.JI) bucket.jiActs++;
        else bucket.otherActs++;
        castThisRound = e.key === R.SK.REFLECT ? (e.round || -1) : castThisRound;
      }
      /* 反弹出去的量：reflect 事件里 `to` 是我方席（受击者）⇒ 这一笔被退回给攻击者 */
      if (e.type === 'reflect' && e.to === seat) bucket.reflAmt += (e.amt || 0);
      /* 我挨的伤害按"可不可反弹"分（damage 事件：to=我方） */
      if (e.type === 'damage' && e.to === seat) {
        const via = e.via || '';
        if (REFLECTABLE.has(via)) bucket.takenRefl += (e.amt || 0); else bucket.takenOther += (e.amt || 0);
      }
    }
  }
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const per = (a, b) => b ? (a / b).toFixed(2) : '—';
console.log('# "只镜面反射"那条 rung 的解剖 ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局（与 ladder 同局号、同对手表 20261029）');
console.log('  规则事实：reflect 花 3 EP ‖ REFLECTABLE = [' + [...REFLECTABLE].join(',') + ']（ジ不在其中）‖ 无反射可放时退回ジ（ジ 每发 +1 EP）');
let all = { games: 0, wins: 0, casts: 0, reflAmt: 0, takenRefl: 0, takenOther: 0, jiActs: 0, otherActs: 0, rounds: 0, hp: 0, dead: 0 };
for (const k of Object.keys(agg)) {
  const b = agg[k];
  for (const f of Object.keys(all)) all[f] += b[f];
}
for (const k of Object.keys(agg).sort()) {
  const b = agg[k];
  console.log('  n=' + k + ' ‖ 局 ' + b.games + ' ‖ **夺1 ' + pct(b.wins, b.games) + '** ‖ 局长 ' + per(b.rounds, b.games) + ' ‖ 终局血量 ' + per(b.hp, b.games) + ' ‖ 阵亡 ' + pct(b.dead, b.games)
    + ' ‖ **反射/局 ' + per(b.casts, b.games) + ' 次**（= 每 ' + (b.casts ? (b.rounds / b.casts).toFixed(1) : '—') + ' 回合一次）'
    + ' ‖ 反弹出去/局 ' + per(b.reflAmt, b.games) + ' 点 ‖ 挨·可反弹/局 ' + per(b.takenRefl, b.games) + ' 点 ‖ 挨·穿透/局 ' + per(b.takenOther, b.games)
    + ' ‖ 赢且 hp≤0 ' + (b.winAndDead || 0) + ' 局 ‖ 打满突死线(≥45 回合) ' + (b.sudden || 0) + '/' + b.games
    + ' ‖ 出手：ジ ' + pct(b.jiActs, b.jiActs + b.otherActs + b.casts) + ' / 反射 ' + pct(b.casts, b.jiActs + b.otherActs + b.casts) + ' / 其它 ' + pct(b.otherActs, b.jiActs + b.otherActs + b.casts));
}
{
  const b = all;
  console.log('⇒ 合计 ‖ 夺1 ' + pct(b.wins, b.games) + ' ‖ 反射 ' + per(b.casts, b.games) + ' 次/局 ‖ 反弹 ' + per(b.reflAmt, b.games) + ' 点/局'
    + ' ‖ 自己挨的可反弹 ' + per(b.takenRefl, b.games) + ' 点/局 · 穿透 ' + per(b.takenOther, b.games) + ' 点/局'
    + '\n   ⇒ 每次反射平均退回 **' + (b.casts ? (b.reflAmt / b.casts).toFixed(2) : '—') + '** 点伤害 ‖ 反射覆盖了敌方对我伤害的 '
    + (b.takenRefl ? (100 * b.reflAmt / b.takenRefl).toFixed(0) + '%（反弹量/可反弹量）' : '—'));
}
{
  const a = AUDIT, epAvg = a.epAtPick.length ? (a.epAtPick.reduce((x, y) => x + y, 0) / a.epAtPick.length) : NaN;
  console.log('⇒ **合法性审计**（用户那一问的正面回答）‖ 决策 ' + a.n + ' 次 ‖ 选中 reflect ' + a.reflectPicked + ' 次（' + pct(a.reflectPicked, a.n) + '）'
    + ' ‖ 其中**买得起**（ep≥3）' + a.reflectAffordable + ' 次（' + pct(a.reflectAffordable, a.reflectPicked) + '）‖ **买不起却提交了** ' + a.reflectNotAffordable + ' 次（' + pct(a.reflectNotAffordable, a.reflectPicked) + '）'
    + ' ‖ 候选表无 reflect 退回ジ ' + a.fallbackJi + ' 次 ‖ 空候选 ' + a.emptyCands + ' 次 ‖ 出手时 EP 均值 ' + (Number.isFinite(epAvg) ? epAvg.toFixed(2) : '—'));
}
console.log('   ⚑ 读法：夺1 若随 n 涨、且"反弹/局"与"挨·可反弹"同向 ⇒ 收益来自"每多一个打你的人多退一份"；若主要靠ジ 出手占比 ⇒ 那 65.3% 是ジ 的功劳，不是反射。');
