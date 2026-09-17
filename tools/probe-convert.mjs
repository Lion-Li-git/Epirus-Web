/* tools/probe-convert.mjs —— **"转化率"探针**（v1.5.95；第九轮复核 §5-2/§7-2 的验收量具）
 *
 * 要回答的问题（复核 §5-2 的结论："环和原型制御现在是**同一个病**：价值估计病"）：
 *   **在一张卡真的可负担的那些决策点上，策略给了它多少概率？**
 *     · 可负担率高 + 选中率 ≈0  ⇒ **转化拒绝**（价值估计病）← 这是复核在 `w3c-93` 上看到的
 *       （环可负担 50.0% / 选中 0.00%）与 `proto` 上看到的（可负担 51.4% / 候选表 100% / 选中 0.0%）
 *     · 可负担率本身低        ⇒ **收入饥饿**（另一件事，v1.5.83 的"ep 从没到 3"就是这种）
 *   两种形态必须分开治 —— 这条探针的作用就是把它们**分开数出来**。
 *
 * 为什么**不报"使用率"**（复核 §7-2 的原话）：使用率会被"压根不出手"的退化包骗
 *   （`roleC2-31` 自对局 0.00 攻击/回合却拿 A 卷 46.8%）。本探针的分母一律是**可负担的决策点**，
 *   而且同时打印"实际使用率"作对照，好让两者的差一眼可见。
 *
 * 方法（与 `probe-beadloop.mjs` 同源，不重写游戏循环）：
 *   `Play.autoGameN(st, choosers)` 跑完整对局；把**所有座位**包一层只读记录器：
 *   每个决策点记下 ① 可负担的表 ② 候选表（`T.econBase` + `P.candidatesFor`，与线上同一个门槛）
 *   ③ 真实选中的卡 ④ 24 次蒙特卡洛（把 `state.rng` 临时换成独立流，问完还原 ⇒ **绝不消耗对局随机流**）。
 *
 * 用法：node tools/probe-convert.mjs [包=线上包] [局数=8] [模式=multi|long] [MC=12]
 * 反证：把分母改成"全部决策点"会立刻把退化包读成"很会用环"—— 这正是这条探针要防的错。
 */
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = Number(process.argv[3] || 8);
const MODE = (process.argv[4] === 'long') ? 'long' : 'multi';
const MC = Number(process.argv[5] || 12);
const params = loadChamp(W, file);
const nm = function (k) { return (R.byKey[k] && R.byKey[k].name) || k; };

console.log('=== 转化率探针：' + file + '（' + GAMES + ' 局 ' + MODE + '，全座位，蒙特卡洛 ' + MC + ' 次/决策）===');

/* 每张卡的累计桶：可负担点数 / 在候选表里的点数 / 蒙特卡洛选中数 / 真实选中次数 */
const bucket = {}, rows = [];
let decisions = 0;
const KEYS = Object.keys(R.byKey).filter(function (k) { return k !== R.SK.JI; });

function recorder(sel, seat) {
  return function (state, pid, legal) {
    if (!legal) { legal = pid; pid = seat; }        // 防御：签名不同时不至于崩
    decisions++;
    const aff = legal.filter(function (l) { return l.affordable; });
    const base = T.econBase(state, pid, aff);
    let candKeys = [];
    try { candKeys = P.candidatesFor(state, pid, base, {}).map(function (c) { return c.key; }); } catch (e) { /* 记不到就当空 */ }
    const realRng = state.rng;
    const mc = {};
    try {
      state.rng = { next: mulberry32(7000 + decisions) };
      for (let i = 0; i < MC; i++) {
        const pk = T.pickChampion(state, pid, legal, params, 0.15);
        if (pk && pk.key) mc[pk.key] = (mc[pk.key] || 0) + 1;
      }
    } finally { state.rng = realRng; }
    const act = sel(state, pid, legal);
    const chosen = act && act.key;
    rows.push({ ep: state.p[pid] ? (state.p[pid].ep || 0) : 0, affordable: aff.map(function (l) { return l.key; }),
      candKeys: candKeys, mc: mc, chosen: chosen });
    return act;
  };
}

for (let g = 0; g < GAMES; g++) {
  const st = S.createState(MODE, { next: mulberry32(9300 + g) }, 5);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(9300 + g);
  const ch = [];
  for (let i = 0; i < 5; i++) ch.push(recorder(T.policyChooserN(params, 0.15), i));
  Play.autoGameN(st, ch);
}

/* 统计：**分母一律是"可负担的决策点"** */
for (const k of KEYS) {
  const ready = rows.filter(function (r) { return r.affordable.indexOf(k) >= 0; });
  if (!ready.length) continue;
  let picks = 0, opp = 0, real = 0, inCand = 0;
  ready.forEach(function (r) {
    picks += (r.mc[k] || 0); opp += MC;
    if (r.chosen === k) real++;
    if (r.candKeys.indexOf(k) >= 0) inCand++;
  });
  bucket[k] = { ready: ready.length, mc: opp ? picks / opp : 0, real: real / ready.length,
    cand: inCand / ready.length };
}
const jiReady = rows.length;
const jiReal = rows.filter(function (r) { return r.chosen === R.SK.JI; }).length;

console.log('决策点总数 = ' + decisions + '（可负担率的分布：' +
  JSON.stringify(rows.reduce(function (a, r) { const b = r.affordable.length; a['可负担' + b + '张'] = (a['可负担' + b + '张'] || 0) + 1; return a; }, {})) + '）');
console.log('');
console.log('卡（角色）'.padEnd(22) + ' 可负担率   候选表率   **转化率(MC)**  实际选中率');
const list = Object.keys(bucket).map(function (k) { return { k: k, b: bucket[k] }; })
  .sort(function (a, b) { return b.b.ready - a.b.ready; });
for (const it of list) {
  const k = it.k, b = it.b;
  const role = T.roleOf ? T.roleOf(k) : ((R.byKey[k] && R.byKey[k].cat) || '?');
  console.log((nm(k) + '（' + role + '）').padEnd(22) +
    (' ' + (100 * b.ready / decisions).toFixed(1) + '%').padStart(8) +
    (' ' + (100 * b.cand).toFixed(0) + '%').padStart(9) +
    (' ' + (100 * b.mc).toFixed(1) + '%').padStart(13) +
    (' ' + (100 * b.real).toFixed(1) + '%').padStart(11));
}
console.log((nm(R.SK.JI) + '（ji）').padEnd(22) + (' ' + '100%').padStart(8) +
  (' ' + '—').padStart(9) + (' ' + '—').padStart(13) + (' ' + (100 * jiReal / Math.max(1, jiReady)).toFixed(1) + '%').padStart(11));

/* 病征分类（复核 §5-2 要的就是这张表） */
const refuse = list.filter(function (it) { return it.b.ready / decisions >= 0.10 && it.b.mc < 0.01; });
const starve = list.filter(function (it) { return it.b.ready / decisions < 0.02 && typeof R.byKey[it.k].cost === 'number' && R.byKey[it.k].cost >= 3; });
console.log('');
console.log('【转化拒绝】（可负担 ≥10% 的决策点，却选中 <1%）= ' + (refuse.length ? refuse.map(function (it) {
  return nm(it.k) + ' ' + (100 * it.b.ready / decisions).toFixed(0) + '%→' + (100 * it.b.mc).toFixed(2) + '%';
}).join(' · ') : '无'));
console.log('【收入饥饿】（可负担 <2% 的贵卡 cost≥3）= ' + (starve.length ? starve.map(function (it) {
  return nm(it.k) + ' ' + (100 * it.b.ready / decisions).toFixed(1) + '%';
}).join(' · ') : '无'));

/* 三个"用户最关心"的单点（复核 §5-2 的靶子） */
console.log('');
for (const k of ['ring', 'proto', 'charge']) {
  const b = bucket[k];
  if (!b) { console.log('· ' + nm(k) + '：**全程不可负担**（可负担点数 0）'); continue; }
  console.log('· ' + nm(k) + '：可负担 ' + b.ready + ' 点（' + (100 * b.ready / decisions).toFixed(1) + '%）· 候选表 ' +
    (100 * b.cand).toFixed(0) + '% · **转化率 ' + (100 * b.mc).toFixed(2) + '%** · 实际选中 ' + (100 * b.real).toFixed(2) + '%');
}
const ep3 = rows.filter(function (r) { return r.ep >= 3; }).length;
console.log('· ep≥3 的决策点 = ' + ep3 + '（' + (100 * ep3 / Math.max(1, decisions)).toFixed(1) + '%）');
