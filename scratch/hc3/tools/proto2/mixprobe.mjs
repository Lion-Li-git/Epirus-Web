#!/usr/bin/env node
/* mixprobe.mjs — **强度 × 一致率曲线**：把"模仿为什么不兑现"从一个说法变成一条线（千问 · 10-29 03:5x · #144 之后）
 *
 * 现场问题：修好 §E824 那处形参之后，2.0 的蒸馏臂组内序读数与 AB-pre 几乎一样（top-1 63~66% ‖ 配对序 76~84% ‖ CE 1.49~1.81），
 *   可**夺1 差到 21.2pt** ⇒ 组内序读数对这件事是盲的（在册 ㉛ 的最强一例）。
 *   于是下一问不是"再换货币"，而是：**要一致到什么程度才配得上强度？**
 *
 * 做法：焦点席每一手以概率 q **交给被测 2.0 粒决定**，其余手仍由 v7 参照包决定 ⇒ q=0 就是 v7 自己，q=1 就是那枚粒。
 *   两个端点是**已知的**（q=0 应读回参照真值 40.3% ‖ q=1 应读回 profile2 那行的夺1）⇒ 端点对不上就说明这台尺的arena与 profile2 不同，当场停。
 *   中间点给的是曲线的**形状**：线性 ⇒ "65% 一致率本来就只值 18~22%"，那条路没坏，只是价码低；
 *   陡降（q 一小就掉）⇒ 强度住在**少数关键决策**上，要打的不是"平均一致率"而是那一族状态。
 *
 * 用法：node tools/proto2/mixprobe.mjs --pack=scratch/arms/xxx.bak [--mixes=0,0.25,0.5,0.75,1] [--games=48] [--temp=0.001]
 * ⚠ 只读 js/**；装 2.0 档是为了让 2.0 粒能打分，参照行走的是**原生 v7**（arch2 的长度守卫已保证它不被接走，见 selftest2 T14）。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const GAMES = Math.max(8, Number(arg('games', 48)) || 48);
const TEMP = Number(arg('temp', 0.001));
const MIXES = String(arg('mixes', '0,0.25,0.5,0.75,1')).split(',').map(Number).filter((x) => Number.isFinite(x));
if (!PACK) { console.error('⛔ 需要 --pack=<2.0 的 .bak>'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const raw = readPack2(PACK);
const got = packCfgExit(raw, PACK);
const cfg = got.cfg;

/* 参照包与对手表都在**装档之前**建好（§E824 那条病的另一半：装完档再读 v7 会读成另一张脸） */
let refParams = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!refParams) { console.error('⛔ 参照包读不出'); process.exit(2); }
refParams = Float64Array.from(refParams);
function mulberry(seedVal) { let a = seedVal >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const POOL = (function () { const real = Math.random; try { Math.random = mulberry(20261029); return T.buildOpps(refParams, 0.05); } finally { Math.random = real; } })();
/* 与 `profile2.mjs:79` 同一份指纹算法 ⇒ 两边报出同一个数，才算"这是同一张 arena"（端点自证的前提） */
function poolFingerprint(PL) {
  let h = 2166136261, nums = 0;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const o of PL) {
    mix('name=' + (o.name || '') + '|');
    const walk = (v, depth) => {
      if (depth > 3 || v == null) return;
      if (typeof v === 'number') { nums++; mix('n' + Math.round(v * 1e6)); return; }
      if (typeof v !== 'object') { mix('s' + String(v)); return; }
      if (Array.isArray(v)) { mix('[' + v.length); for (const q of v) walk(q, depth + 1); mix(']'); return; }
      for (const k of Object.keys(v).sort()) { mix('{' + k); walk(v[k], depth + 1); mix('}'); }
    };
    walk(o, 0);
  }
  return (h >>> 0).toString(16) + '/' + nums;
}
const POOL_FP = poolFingerprint(POOL);
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }

const A = installArch2(W, cfg);
const params = Float64Array.from(P.unpack(raw, true));
if (!params || params.length !== P.paramCount()) { console.error('⛔ 包形状不对：' + (params && params.length) + ' vs ' + P.paramCount()); process.exit(7); }
console.log('# mixprobe ‖ 对手表指纹 ' + POOL_FP + '（要等于 profile2 的同一枚才算同一张 arena）‖ 包 ' + PACK + ' ‖ 档 ' + (raw.arch || 'S1') + ' ‖ paramCount=' + P.paramCount()
  + ' ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局 ‖ temp=' + TEMP + ' ‖ q = 「这一手交给 2.0 粒」的概率');

/* 焦点席的混合 chooser：抽一条**定标流**决定归属；两边都走**引擎自己的 chooser**（同一个 temp）。
 * ⚑⚑ 第一版这里是我手搓的 `candidatesFor(..., {lockTarget:false}) + forwardCands().cand` ⇒ q=1 读出 15.1%，
 *   而 profile2 同一枚粒同一套格同一批局号读 **21.9%** —— 差的正是 `evo.js:953` 那条 `lockTarget: lastCancelOther(...)`
 *   （比赛会把"与上回合相抵的对手"踢出目标池，我这里没踢 ⇒ 目标面偏宽 = 另一把尺）。
 *   ⇒ 现在两半都用 `T.policyChooserN`，q=1 必须复现 profile2 那行；复现不了就当场标"这条曲线的绝对位不可读"。 */
function mixed(q, seed) {
  const r = mulberry(seed >>> 0);
  const v7sel = T.policyChooserN(refParams, TEMP);
  const headSel = T.policyChooserN(params, TEMP);
  return function (state, pid, legal) {
    return (q > 0 && r() < q) ? headSel(state, pid, legal) : v7sel(state, pid, legal);
  };
}
function playCell(q, cell, seed) {
  let games = 0, first = 0, top2 = 0, rounds = 0, acts = 0;
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid === seat) choosers.push(mixed(q, seed + g * 7919 + pid));
      else choosers.push(POOL[(cell.idx + 1 + pid) % POOL.length].sel);   /* 与 profile2 逐字同形（`+1` 是把焦点席跳过）*/
    }
    const rm = T.oneGameN(choosers, seed + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state;
    games++; rounds += rm.rounds || 0;
    if (rm.winner === seat) first++;
    const myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (ahead <= 1) top2++;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) acts++;
  }
  return { games, first, top2, rounds, acts };
}
const out = [];
for (const q of MIXES) {
  let G = 0, F = 0, T2 = 0, RD = 0, AC = 0;
  for (let i = 0; i < CELLS.length; i++) {
    const c = CELLS[i], r = playCell(q, c, 1000 + c.n * 97 + c.idx);   /* 局号与 profile2 三行同一条公式 ⇒ q=1 应当读回 profile2 那行的夺1 */
    G += r.games; F += r.first; T2 += r.top2; RD += r.rounds; AC += r.acts;
  }
  out.push({ q, games: G, win: F / Math.max(1, G) });
  console.log('  q=' + q.toFixed(2) + ' ‖ 局 ' + G + ' ‖ 夺1 ' + (100 * F / Math.max(1, G)).toFixed(1) + '% ‖ 前2 ' + (100 * T2 / Math.max(1, G)).toFixed(1)
    + '% ‖ 局长 ' + (RD / Math.max(1, G)).toFixed(1) + ' ‖ 出手/局 ' + (AC / Math.max(1, G)).toFixed(2));
}
const at = (q) => out.filter((o) => Math.abs(o.q - q) < 1e-9)[0];
const e0 = at(0), e1 = at(1);
console.log('  ⇒ 端点自证：q=0（纯 v7）= ' + (e0 ? (100 * e0.win).toFixed(1) + '%' : '未跑') + ' ‖ q=1（纯 2.0 粒）= ' + (e1 ? (100 * e1.win).toFixed(1) + '%' : '未跑')
  + ' ‖ 参照真值在册 40.3%（`tools/proto2/ref-baseline.mjs`）');
if (e0 && Math.abs(100 * e0.win - 40.3) > 6) console.log('  ⚠ q=0 与参照真值差 ' + (100 * e0.win - 40.3).toFixed(1) + 'pt ⇒ 这台尺的 arena 与 ref-baseline 不同，曲线只能看**形状**，不能看绝对值');
/* 第二个端点也要对表：`--expect=<profile2 那行的夺1%>` ⇒ q=1 必须复现它（两半都走引擎自己的 chooser 之后，这条应当过） */
const EXPECT = Number(arg('expect', NaN));
if (e1 && Number.isFinite(EXPECT)) {
  const d = 100 * e1.win - EXPECT;
  console.log('  ⇒ 端点 2 对表：q=1 实测 ' + (100 * e1.win).toFixed(1) + '% ‖ profile2 那行 ' + EXPECT.toFixed(1) + '% ‖ 差 ' + d.toFixed(1) + 'pt'
    + (Math.abs(d) > 4 ? ' ⇒ ⛔ 两把尺的执行口径还是不同 ⇒ 本曲线只读**形状**，绝对位不引' : ' ✔ 同一枚粒同一套格 ⇒ 曲线的绝对位可读'));
} else if (e1) console.log('  （没传 `--expect=` ⇒ 第二个端点没对表，曲线的绝对位先别引）');
if (out.length >= 3) {
  /* 形状判语：把曲线归一到端点之间，看它是"按比例插值"还是"一交权就掉" */
  const span = (e0 && e1) ? (e0.win - e1.win) : NaN;
  const mid = at(0.5);
  if (Number.isFinite(span) && mid && Math.abs(span) > 1e-9) {
    const lin = e0.win - span * 0.5;
    console.log('  ⇒ 中点 q=0.5 实测 ' + (100 * mid.win).toFixed(1) + '% ‖ 线性插值预期 ' + (100 * lin).toFixed(1) + '% ‖ 偏离 ' + (100 * (mid.win - lin)).toFixed(1) + 'pt'
      + (Math.abs(mid.win - lin) > Math.abs(span) * 0.15 ? ' ⇒ **非线性**：强度不住在"平均一致率"上，少数关键决策才是价签所在' : ' ⇒ 近似线性：一致率就是强度本身，65% 一致率本来就只值这个数'));
  }
}
