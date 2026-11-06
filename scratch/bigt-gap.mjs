#!/usr/bin/env node
/* scratch/bigt-gap.mjs — #145 那一格的**因果拆解**：同一枚 2.0 臂，贪心读 5.7% 而引擎 chooser 读 25.9%
 *
 * 读代码得到的唯一结构差（`js/train/evo.js:933-987`，非 legacy 分支）：
 *   chooser = ①`{lockTarget:lastCancelOther}` 造候选面（本尺已逐字复制）→ ②`BIGT_PUSH` 注入（`evo.js:967`）
 *             → ③`P.chooseCandidates(...,{temp})`；而 arch2 的 `chooseCandidates` 就是 `forwardCands` 换一层壳
 *             （`tools/proto2/arch2.mjs:417-420`）。
 *   ⇒ ①③ 两行 alike（都是 temp=0.001 的近贪心），**只有 ② 是 chooser 独有的**。
 * 于是假设：那 20.2pt = 出厂大雷"看得见"那一档（`BIGT_PUSH=12`，`evo.js:648`）替这枚退化的头打的牌。
 * 三条行摆在一起就能判：贪心 ‖ 贪心+手工注入（应与 chooser 同） ‖ 引擎 chooser。
 * 顺带把"每局大雷张数 / 注入命中次数"落进表里 ⇒ 若归因成立，退化的头应当**自己一张都不打**。
 *
 * 用法：node scratch/bigt-gap.mjs [--packs=a.bak,b.bak] [--games=40] [--temp=0.001] [--with-v7]
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Math.max(4, Number(arg('games', 40)) || 40);
const TEMP = Number(arg('temp', 0.001));
const BIGT = Number(arg('bigt', 12));
const PACKS = String(arg('packs', 'scratch/arms/B8-fx-S1.bak')).split(',').map((s) => s.trim()).filter(Boolean);
const WITH_V7 = argv.includes('--with-v7');

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, Play = W.EpirusPlay;
if (typeof T.setBigTPush !== 'function' || typeof T.bigTPushPick !== 'function') {
  console.error('⛔ 引擎没导出 `bigTPushPick`/`setBigTPush` ⇒ 拆不了这一格，尺不许出数');
  process.exit(2);
}
T.setBigTPush(BIGT);
let ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!ref) { console.error('⛔ 参照包读不出'); process.exit(2); }
ref = Float64Array.from(ref);
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* 与 `ladder.mjs:57` 逐字同一台对手表（同种子 20261029）⇒ 行数可以直接和 ladder 对表 */
const POOL = (function () { const real = Math.random; try { Math.random = mulberry(20261029); return T.buildOpps(ref, 0.05); } finally { Math.random = real; } })();
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }
if (CELLS.length !== 16) { console.error('⛔ 格数 ' + CELLS.length + ' ≠ 16 ⇒ 对手表漂了，与 ladder 那批不可对表'); process.exit(2); }

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
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) });
  return cs || [];
}
const ACT = () => ({ win: 0, t2: 0, sv: 0, rd: 0, acts: 0, bigt: 0, win2: 0, fired: 0, cat: {}, tup: {}, nTupDec: 0, tieSum: 0, tieN: 0, tieMax: 0 });
function playCell(selFn, cell, acc) {
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid !== seat) choosers.push(POOL[(cell.idx + 1 + pid) % POOL.length].sel);
      else choosers.push(selFn);
    }
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state, myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (rm.winner === seat) acc.win++;
    if (ahead <= 1) acc.t2++;
    if (myHp > 0) acc.sv++;
    acc.rd += rm.rounds || 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) {
      acc.acts++;
      if (e.key === R.SK.BIG_T) acc.bigt++;
      const k = (R.byKey[e.key] && R.byKey[e.key].cat) || '?';
      acc.cat[k] = (acc.cat[k] || 0) + 1;
    }
  }
}
const TIE = { sum: 0, n: 0, worst: 0, whole: 0 };   /* 只在贪心那一条路上量（它自己就调 `forwardCands`，不额外抽 rng） */
function spy(fn, acc) {
  return function (state, pid, legal) {
    const r = fn(state, pid, legal);
    const k = r.key + '/' + (r.target == null ? '-' : r.target) + (r.bead ? '/' + r.bead : '');
    acc.tup[k] = (acc.tup[k] || 0) + 1; acc.nTupDec++;
    return r;
  };
}
function row(tag, selFn, monitor, acc, wantTie) {
  TIE.sum = 0; TIE.n = 0; TIE.worst = 0;
  for (const cell of CELLS) playCell(spy(selFn, acc), cell, acc);
  const G = CELLS.length * GAMES;
  const fam = ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + (100 * (acc.cat[k] || 0) / Math.max(1, acc.acts)).toFixed(1) + '%').join(' ');
  const mon = monitor ? ' ‖ 窗口(候选表里有大雷) ' + monitor.win2 + ' 次 ‖ 注入兑现 ' + monitor.fired + ' 次（=' + (monitor.fired / Math.max(1, monitor.win2)).toFixed(3) + '×窗口，理论 1/' + BIGT + '）' : '';
  /* 动作**身份**多样性：同一枚技能打不同目标算两格 ⇒ 只数"族/键"会骗人（`d:99%` 可能是 1 种打法，也可能是 9 种） */
  const tk = Object.entries(acc.tup).sort((a, b) => b[1] - a[1]);
  const share = (i) => (tk[i] ? (100 * tk[i][1] / acc.nTupDec).toFixed(1) + '%' : '—');
  const div = ' ‖ 出手身份 ' + tk.length + ' 种（前 3 占 ' + share(0) + '/' + share(1) + '/' + share(2) + '）';
  const tie = wantTie ? ' ‖ ⭐最大并列集合 平均 ' + (TIE.sum / Math.max(1, TIE.n)).toFixed(2) + ' 枚（' + TIE.n + ' 次决策，最坏 ' + TIE.worst + '）' : '';
  console.log('  ' + tag.padEnd(15) + ' ‖ 夺1 ' + (100 * acc.win / G).toFixed(1) + '% ‖ 前2 ' + (100 * acc.t2 / G).toFixed(1)
    + '% ‖ 活到终局 ' + (100 * acc.sv / G).toFixed(1) + '% ‖ 大雷 ' + (acc.bigt / G).toFixed(2) + ' 张/局 ‖ 出手/局 ' + (acc.acts / G).toFixed(2) + ' ‖ 族 ' + fam + div + tie + mon);
  return 100 * acc.win / G;
}
console.log('# 破号/执行口径拆解 ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局（与 `ladder.mjs` 同批局号、同对手表 ' + 'seed 20261029' + '）‖ temp=' + TEMP + ' ‖ BIGT_PUSH=' + BIGT);

function runPack(path) {
  let raw;
  try { raw = JSON.parse(readFileSync(path, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, '')); }
  catch (e) { console.log('  ⛔ 读不到 ' + path + '：' + e.message); return; }
  if (raw.v !== 90) { console.log('  ⛔ ' + path + ' 不是 2.0 容器（v=' + raw.v + '）'); return; }
  const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
  if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
  const A = installArch2(W, cfg);
  const pp = P.unpack(raw, true);
  if (!pp || pp.length !== P.paramCount()) { console.log('  ⛔ ' + path + ' 形状不对'); A.restore(); return; }
  const head = Float64Array.from(pp);
  console.log('\n# ' + path.replace(/^scratch\/arms\//, '') + ' ‖ arch=' + (raw.arch || 'S1') + ' ‖ 参数 ' + head.length + ' 条');
  const greedy = function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    const f = P.forwardCands(state, pid, cs, head, { temp: TEMP });
    if (f && f.logits) {                                     /* 并列集合大小：贪心取"第一个最大"，引擎在同一集合里**抽样** */
      const mx = f.logits[f.argmax]; let k = 0;
      for (let i = 0; i < f.logits.length; i++) if (Math.abs(f.logits[i] - mx) < 1e-9) k++;
      TIE.sum += k; TIE.n++; if (k > TIE.worst) TIE.worst = k;
    }
    const c = (f && f.cand) || cs[0];
    return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  };
  /* 同一个贪心，只在它前面加那一档注入 ⇒ 与 `evo.js:967-970` 逐字同形（`bigTPushPick` 里自己判 1/N 散列） */
  const m1 = { win2: 0, fired: 0 };
  const greedyPlus = function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    let has = false; for (let i = 0; i < cs.length; i++) if (cs[i].key === R.SK.BIG_T) { has = true; break; }
    if (has) { m1.win2++; const p = T.bigTPushPick(state, pid, cs); if (p) { m1.fired++; return p; } }
    return greedy(state, pid, legal);
  };
  const r0 = row('贪心（无注入）', greedy, null, ACT(), true);
  const tg = { sum: TIE.sum, n: TIE.n, worst: TIE.worst };   /* `row()` 每次进来都清 TIE ⇒ 这里先拿走贪心那一份 */
  const r1 = row('贪心+注入', greedyPlus, m1, ACT());
  const r2 = row('引擎 chooser', T.policyChooserN(head, TEMP), null, ACT());
  console.log('  ⇒ 分解：注入这一档值 **' + (r1 - r0).toFixed(1) + 'pt**（贪心 ' + r0.toFixed(1) + ' → 加注入 ' + r1.toFixed(1)
    + '）‖ 引擎 chooser ' + r2.toFixed(1) + ' ‖ 残差（chooser − 贪心+注入）= ' + (r2 - r1).toFixed(1) + 'pt');
  let verdict;
  if (Math.abs(r2 - r1) <= 2.5) verdict = '那一整格差 = **出厂大雷那一档**（`evo.js:967`），与破号无关';
  else if (r1 <= r0 + 0.5) {
    verdict = '**注入被排除**（加不加都是 ' + r0.toFixed(1) + '）⇒ ' + (r2 - r0).toFixed(1) + 'pt 全在"同一个并列集合里怎么挑"这一格：'
      + '贪心拿**集合的第一个**（=候选表顺序），引擎拿**集合内抽样**'
      + (tg.n ? ' ‖ 贪心行并列集合平均 ' + (tg.sum / tg.n).toFixed(2) + ' 枚、最坏 ' + tg.worst + '（' + tg.n + ' 次决策）⇒ 这个数就是"头分不分得开"的直接读数' : '');
  } else verdict = '注入只解释了 ' + (r1 - r0).toFixed(1) + 'pt，还剩 ' + (r2 - r1).toFixed(1) + 'pt 未归因';
  console.log('  ⇒ **判语**：' + verdict);
  console.log('  ⚑ 自检：注入命中 ' + m1.fired + ' 次 ÷ 窗口 ' + m1.win2 + ' 次 = ' + (m1.fired / Math.max(1, m1.win2)).toFixed(3)
    + '（理论 1/' + BIGT + ' = ' + (1 / BIGT).toFixed(3) + '）‖窗口/局 ' + (m1.win2 / (CELLS.length * GAMES)).toFixed(2)
    + ' ⇒ 窗口密度是**这枚头自己**决定的（它把大雷留在候选表上的频率）');
  A.restore();
}
for (const p of PACKS) runPack(p);

if (WITH_V7) {
  console.log('\n# 对照：参照包 v7（同一台 arena、同样三行）');
  const g7 = T.policyChooserN(ref, TEMP);
  const a0 = ACT();
  /* v7 的"无注入"行 = 把 chooser 换掉：只能靠 `setBigTPush(0)`，所以单独跑一遍（注入关掉，其余逐字同） */
  T.setBigTPush(0);
  const r0 = row('chooser（注入关）', g7, null, a0);
  const m = { win2: 0, fired: 0 };
  T.setBigTPush(BIGT);
  const wrap = function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    let has = false; for (let i = 0; i < cs.length; i++) if (cs[i].key === R.SK.BIG_T) { has = true; break; }
    if (has) { m.win2++; const p = T.bigTPushPick(state, pid, cs); if (p) { m.fired++; return p; } }
    return g7(state, pid, legal);
  };
  const r1 = row('chooser+注入', wrap, m, ACT());
  console.log('  ⇒ v7 上这一档值 ' + (r1 - r0).toFixed(1) + 'pt（' + r0.toFixed(1) + ' → ' + r1.toFixed(1) + '）‖与在册 §E270 价签 −0.52/−0.40 同号与否见第十七段');
}
