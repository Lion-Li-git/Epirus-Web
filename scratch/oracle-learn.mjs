#!/usr/bin/env node
/* oracle-learn.mjs — 从"事后先知"标签里学防御时机（DS · 2026-11-02 晚，用户点子第 2 步）
 * 1) 收集：基础策略打 long，逐决策记公开特征 + 本回合实际打过来的牌（事后标签）；
 * 2) 训练：softmax 逻辑回归（5 类：无/反弹类/防御类/反打枪/转移）；
 * 3) 评估：留出局上按预测出防御（合法才出），与 native 同种对比胜率。
 * 这是"冠军能不能总结出正确时机"的最小检验；不是端到端蒸馏。
 * 用法：node scratch/oracle-learn.mjs --pack=scratch/ga-arms/L5-D4a-s13.js [--games=240]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/L5-D4a-s13.js');
const GAMES = Math.max(60, Number(arg('games', 240)) || 240);
const N = Math.max(3, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long'), TEMP = 0.15;
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const SK = R.SK;
const DEF = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));
const ATTACKS = new Set([SK.GUN, SK.TANK, SK.SWORD, SK.SNIPE, SK.RAILGUN, SK.DUAL_GUN]);
const CLASS = (k) => (k === SK.GUN || k === SK.TANK || k === SK.DUAL_GUN) ? 1 : (k === SK.SWORD ? 2 : (k === SK.SNIPE ? 3 : (k === SK.RAILGUN ? 4 : 0)));
const REPLY = { 1: SK.REFLECT, 2: SK.GUARD, 3: SK.GUN, 4: SK.TRANSFER };
const NF = 11;
const THRESH = Number(arg('thresh', 0.45));
const CHEAT_GATE = arg('cheatGate', '0') === '1';

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出'); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}

function feats(state, pid, round) {
  const me = state.p[pid] || {}; let oppEp = 0, oppBead = 0, oppAtk = 0, oppDef = 0, oppLow = 0, alive = 0;
  for (let i = 0; i < state.p.length; i++) {
    if (i === pid) continue; const o = state.p[i]; if (!o || o.hp <= 0) continue;
    alive++; oppEp += (o.ep | 0); oppBead += ((o.elec | 0) + (o.boom | 0)); oppLow += (o.hp <= 1 ? 1 : 0);
    if (ATTACKS.has(o.lastSkill)) oppAtk++; if (DEF.has(o.lastSkill)) oppDef++;
  }
  return [1, (me.hp | 0) / 5, (me.ep | 0) / 5, ((me.elec | 0) + (me.boom | 0)) > 0 ? 1 : 0, (state.round | 0) / 20, alive / 4, oppEp / 10, oppBead / 4, oppAtk / 4, oppDef / 4, oppLow / 4];
}

const pack = loadPack(PACK);
const data = [];
function playGame(seed, gIdx, useRule, models) {
  const { pp } = pack;
  const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
  const rows = []; let round = 0, pending = null; const defStats = { hands: 0, eff: 0, white: 0 };
  const classifyWin = (state) => {
    if (!pending) return;
    const evs = state.events || []; const win = evs.slice(pending.cursor);
    let block = false, hit = false;
    for (const e of win) { if (!e || e.to !== 0) continue; if (e.type === 'blocked' || e.type === 'reflect') block = true; if (e.type === 'damage') hit = true; }
    if (pending.isDef) { defStats.hands++; if (block) defStats.eff++; else if (!hit) defStats.white++; }
    pending = null;
  };
  const onPicks = (state, picks, legals) => {
    round++;
    classifyWin(state);
    const me = state.p[0]; if (!me || me.hp <= 0) return null;
    const x = feats(state, 0, round);
    let label = 0, repPid = null;
    for (let pid = 1; pid < state.p.length; pid++) { const pk = picks[pid]; if (pk && (pk.target === 0 || pk.target2 === 0) && ATTACKS.has(pk.key)) { label = CLASS(pk.key); repPid = pid; break; } }
    rows.push({ x, y: label });
    /* ⚠ 11-02 晚更正：原先这里还有 `label === 0` 的守卫 —— 那等于**出招时也知道这一手会不会挨打**，
     *   不是"只看公开特征"。默认改成纯门（--cheatGate=1 才保留旧行为，用于对照）。 */
    if (!useRule || !models) return null;
    if (CHEAT_GATE && label === 0) return null;
    /* 预测 */
    let best = 0, bestP = -1, probs = softmaxModels(models, x);
    for (let c = 1; c < 5; c++) if (probs[c] > bestP) { bestP = probs[c]; best = c; }
    if (best === 0 || bestP < THRESH) return null;
    const rep = REPLY[best]; const lg = legals[0].find((c) => c.key === rep && c.affordable);
    if (!lg) return null;
    const np = picks.slice(); np[0] = { key: rep, target: rep === SK.GUN ? repPid : null, target2: null, bead: null };
    pending = { cursor: (state.events || []).length, isDef: true };
    return np;
  };
  const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const subs = [(s, pid, legal) => inner(s, pid, legal)];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + gIdx * 17 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
  const r = T.oneGameN(subs, seed, N, { mode: MODE, onPicks });
  classifyWin(r.state);
  data.push(...rows);
  return { win: r.winner === 0 ? 1 : 0, rows, defStats };
}

function softmaxModels(models, x) {
  const p = new Array(5).fill(0);
  for (let c = 0; c < 5; c++) { let s = 0; for (let j = 0; j < NF; j++) s += models[c][j] * x[j]; p[c] = Math.exp(Math.max(-30, Math.min(30, s))); }
  const z = p.reduce((a, b) => a + b, 0) || 1; return p.map((v) => v / z);
}
function train(rows, epochs, lr) {
  const models = Array.from({ length: 5 }, () => new Array(NF).fill(0));
  /* 类别平衡：稀疏的攻击类按 1/类频加权（否则大样本直接学成"永远无攻击"——1600 局那版召回 0%）。 */
  const cnt = new Array(5).fill(0); for (const r of rows) cnt[r.y]++;
  const CW = Number(arg('classWeight', 0)) === 1;
  const wts = cnt.map((c) => (CW && c ? rows.length / (5 * c) : 1));
  for (let ep = 0; ep < epochs; ep++) {
    for (const r of rows) {
      const p = softmaxModels(models, r.x), w = wts[r.y];
      for (let c = 0; c < 5; c++) { const g = ((c === r.y ? 1 : 0) - p[c]) * w; for (let j = 0; j < NF; j++) models[c][j] += lr * g * r.x[j]; }
    }
  }
  return models;
}

/* 收集（前半 native，标签来自事后） */
const trainGames = Math.floor(GAMES * 0.7);
for (let k = 0; k < trainGames; k++) playGame(77000 + k * 977, k, false, null);
const rows = data.slice();
const models = train(rows, 120, 0.3);
const OUT = arg('out', '');
if (OUT) { const fs = await import('node:fs'); fs.writeFileSync(OUT, JSON.stringify({ v: 1, nf: NF, thresh: THRESH, classes: ['none', 'reflect', 'guard', 'gun', 'transfer'], w: models }, null, 1)); console.log('  ✔ 模型已写 ' + OUT); }
let acc = 0, n = 0, base = 0;
for (const r of rows) { const p = softmaxModels(models, r.x); let bc = 0; for (let c = 1; c < 5; c++) if (p[c] > p[bc]) bc = c; if (bc === r.y) acc++; if (r.y === 0) base++; n++; }
let tp = 0, fp = 0, fn = 0, tpT = 0, fpT = 0;
for (const r of rows) { const p = softmaxModels(models, r.x); let bc = 0; for (let c = 1; c < 5; c++) if (p[c] > p[bc]) bc = c; const predAtk = bc !== 0, realAtk = r.y !== 0; if (predAtk && realAtk) { tp++; if (bc === r.y) tpT++; } else if (predAtk && !realAtk) fp++; else if (!predAtk && realAtk) fn++; }
console.log('### 时机学习 ‖ 包=' + PACK.split('/').pop() + ' ‖ 训练局 ' + trainGames + ' ‖ 决策 ' + n);
console.log('  训练集：5 类准 ' + (100 * acc / n).toFixed(1) + '% ‖ 无攻击基线 ' + (100 * base / n).toFixed(1) + '% ‖ 攻击召回 ' + (100 * tp / Math.max(1, tp + fn)).toFixed(1) + '% ‖ 攻击精确 ' + (100 * tp / Math.max(1, tp + fp)).toFixed(1) + '% ‖ 类型对 ' + (100 * tpT / Math.max(1, tp)).toFixed(1) + '%');

/* 留出：同种子 native vs rule */
let winN = 0, winR = 0, m = 0; const diffs = []; const aggDef = { hands: 0, eff: 0, white: 0 };
for (let k = trainGames; k < GAMES; k++) {
  const a = playGame(77000 + k * 977, k, false, null);
  const b = playGame(77000 + k * 977, k, true, models);
  winN += a.win; winR += b.win; m++; diffs.push(b.win - a.win);
  if (b.defStats) { aggDef.hands += b.defStats.hands; aggDef.eff += b.defStats.eff; aggDef.white += b.defStats.white; }
}
const mean = diffs.reduce((s, v) => s + v, 0) / m;
const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, m - 1));
const se = sd / Math.sqrt(m), t = se > 0 ? mean / se : 0;
console.log('  留出 ' + m + ' 局：native 夺1 ' + (100 * winN / m).toFixed(1) + '% ‖ 规则（预测到才防） ' + (100 * winR / m).toFixed(1) + '% ‖ Δ ' + (100 * mean).toFixed(1) + 'pt ± ' + (100 * se).toFixed(1) + '（配对 SE，t=' + t.toFixed(2) + '） ‖ 规则防御 ' + (aggDef.hands / m).toFixed(1) + ' 手/局、有效 ' + (100 * aggDef.eff / Math.max(1, aggDef.hands)).toFixed(1) + '%、白防 ' + (100 * aggDef.white / Math.max(1, aggDef.hands)).toFixed(1) + '%');