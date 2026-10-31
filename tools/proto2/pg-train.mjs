#!/usr/bin/env node
/* pg-train.mjs — B 臂：REINFORCE + 行为塑形常驻（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §二B）
 *
 * 对比口径：起点/预算/训练食性 = 千问 CEM 配对批（OB3CH-s7 起、24k 局、arena2 mild cap2 mix0.5、salt=101、
 *   gameSeq 连续 0..N ⇒ 同一批局、同一批对手、同一批座位——CRN 已内建，PG 直接受益）。
 * 更新：每 batch 局一步 Adam；G_t = 终局 scoreNet + 未折扣塑形回报；全局均值基线；优势按批标准化；
 *   策略 = temp 收集温度的两级 softmax（dLogPi，selftest3 腿 C 验过）；tinter/inter>0 拒跑。
 * 塑形（常驻，回应 SUPTUNE 拆链）：λc·1[charge(ok) ∧ 决策时 ep≥3 ∧ 无电珠] + λf·1[railgun(ok)]。
 * 共驾四处（PREREG 口径差异清单）：大雷助推照执行不进梯度；自备 rng 采样；lockTarget:false；收集 temp=0.5。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogPi } from './pg-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['up', 'games', 'batch', 'lr', 'seed', 'lamC', 'lamF', 'temp', 'out', 'tag'], 'pg-train');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('up', 'scratch/arms/OB3CH-s7.bak'));
const GAMES = Math.max(1000, Number(arg('games', 24000)) || 24000);
const BATCH = Math.max(8, Number(arg('batch', 48)) || 48);
const LR = Number(arg('lr', 3e-4)) || 3e-4;
const SEED = Number(arg('seed', 7)) || 7;
const LAMC = Number(arg('lamC', 0.005)) || 0;
const LAMF = Number(arg('lamF', 0.05)) || 0;
const TEMP = Number(arg('temp', 0.5)) || 0.5;
const OUT = String(arg('out', 'scratch/arms/PG1-s' + SEED + '.bak'));
const TAG = String(arg('tag', ''));

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const pv = Float64Array.from(P.unpack(raw, true));
if (!pv) { console.error('⛔ 起点读不出：' + UP); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: 0.15, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5, wantEvents: 1 });

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- 收集器 chooser：记录 (tape, 选中, 决策时资源快照)；大雷助推照执行、单候选不进梯度 ---- */
let curGame = null;
function collector(state, pid, legal) {
  if (!curGame) return { key: R.SK.JI };
  const cands = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
  const rec = (push, c) => ({ push, key: c.key });
  const asAct = (c) => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null });
  if (!cands.length) { curGame.decs.push(rec(true, { key: R.SK.JI })); return { key: R.SK.JI }; }
  const pushed = T.bigTPushPick ? T.bigTPushPick(state, pid, cands) : null;
  if (pushed) { curGame.decs.push(rec(true, pushed)); return asAct(pushed); }
  if (cands.length < 2) { curGame.decs.push(rec(true, cands[0])); return asAct(cands[0]); }
  const fr = P.forwardCands(state, pid, cands, pv, { temp: TEMP, wantTape: 1 });
  const r = curGame.rng();
  let acc = 0, idx = fr.probs.length - 1;
  for (let i = 0; i < fr.probs.length; i++) { acc += fr.probs[i]; if (r < acc) { idx = i; break; } }
  let H = 0; for (let i = 0; i < fr.probs.length; i++) if (fr.probs[i] > 1e-12) H -= fr.probs[i] * Math.log(fr.probs[i]);
  const me = state.p[pid];
  curGame.decs.push({ push: false, tape: fr.tape, idx, key: cands[idx].key, ep: me ? (me.ep || 0) : 0, elec: me ? (me.elec || 0) : 0, H });
  return asAct(cands[idx]);
}

/* ---- 主循环 ---- */
const t0 = Date.now();
const DIM = pv.length;
const adam = { m: new Float64Array(DIM), v: new Float64Array(DIM), t: 0 };
let games = 0, upd = 0, zeroGrad = 0;
const stat = { score: 0, fire: 0, charge: 0, ent: 0, decs: 0, snap8k: false };
const ZIP = { games: 0, bad: 0 };
console.log('# pg-train（B 臂） ‖ 起点 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 局 ' + GAMES + ' ‖ 批 ' + BATCH + ' ‖ lr ' + LR + ' ‖ temp ' + TEMP + ' ‖ λc ' + LAMC + ' ‖ λf ' + LAMF + ' ‖ seed ' + SEED);
console.log('  口径：arena2 mild(cap2/mix0.5) salt=101 gameSeq 连续 ‖ 塑形常驻 ‖ 大雷助推照执行不进梯度');

function savePack(to) {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(pv)) + ';\n', 'utf8');
}

while (games < GAMES) {
  const decsBatch = [];
  for (let b = 0; b < BATCH && games < GAMES; b++, games++) {
    const gameSeq = games;
    const slot = A2.loopShapes[gameSeq % A2.loopShapes.length];
    const seat = gameSeq % slot.n;
    curGame = { decs: [], rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };
    const row = A2.playOne(collector, slot.idx, gameSeq, 101);
    const ds = curGame.decs;
    curGame = null;
    stat.score += row.scoreNet;
    /* zip：我的决策序列 ↔ 学习席 action 事件序列（引擎对每次尝试都落一条 action 事件） */
    const evs = (row.evs || []).filter((e) => e.type === 'action' && e.pid === seat);
    ZIP.games++;
    if (evs.length !== ds.length) { ZIP.bad++; continue; }
    /* 塑形：逐决策对账事件结果（只认 ok），G_t = 终局 + 未折扣塑形回报（return-to-go） */
    const shape = new Float64Array(ds.length);
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i], e = evs[i];
      if (!d.push && e.outcome === 'ok') {
        if (d.key === R.SK.RAILGUN) { shape[i] += LAMF; stat.fire++; }
        else if (d.key === R.SK.CHARGE && d.ep >= 3 && d.elec === 0) { shape[i] += LAMC; stat.charge++; }
      }
      if (!d.push) { stat.ent += d.H; stat.decs++; }
    }
    let acc = 0;
    for (let i = ds.length - 1; i >= 0; i--) {
      acc += shape[i];
      if (!ds[i].push) decsBatch.push({ d: ds[i], G: row.scoreNet + acc });
    }
  }
  /* 优势：全局均值基线 + 批内标准化。
   * ⚑ 勘误（10-31 15:0x，首轮 8 臂全废的根因）：G 挂在**批条目**上不是决策记录上——第一版写 `d.G` ⇒
   *   A=NaN；而 JS 里 NaN 是 **falsy**（Python 才是 truthy）⇒ tapeBackward 的 `if (!u)` 把 NaN 全跳了
   *   ⇒ grad 恒 0、训练静默 no-op、产物=起点逐位同，日志照样印出"合理"数字。
   *   抓到它的是 λ 与 λ=0 两臂产物 md5 逐位同（阴性对照当接线检查）。修法：解构出 G + A 非有限当场抛。 */
  const mu = decsBatch.reduce((a, x) => a + x.G, 0) / Math.max(1, decsBatch.length);
  const sd = Math.sqrt(decsBatch.reduce((a, x) => a + (x.G - mu) * (x.G - mu), 0) / Math.max(1, decsBatch.length)) || 1;
  const grad = new Float64Array(DIM);
  for (const { d, G } of decsBatch) {
    const A = (G - mu) / sd;
    if (!Number.isFinite(A)) { console.error('⛔ 优势非有限（G=' + G + ' mu=' + mu + ' sd=' + sd + '）⇒ 拒绝静默训练'); process.exit(9); }
    const act = tapeForward(d.tape, pv, ly);
    const t = tailOf(act.logits, d.tape.keys, TEMP);
    const g = dLogPi(d.idx, act.logits, d.tape.keys, TEMP, t);
    for (let j = 0; j < g.length; j++) g[j] *= A;
    tapeBackward(d.tape, pv, ly, act, g, grad);
  }
  { let mx = 0; for (let q = 0; q < DIM; q++) { const a = Math.abs(grad[q]); if (a > mx) mx = a; }
    if (mx === 0) { zeroGrad++; if (zeroGrad >= 3) { console.error('⛔ 连续 ' + zeroGrad + ' 步 grad 全零 ⇒ 训练在空转，拒绝继续'); process.exit(9); } }
    else zeroGrad = 0; }
  adam.t++;
  for (let d = 0; d < DIM; d++) {
    const gg = grad[d] / Math.max(1, decsBatch.length);
    adam.m[d] = 0.9 * adam.m[d] + 0.1 * gg;
    adam.v[d] = 0.999 * adam.v[d] + 0.001 * gg * gg;
    const mh = adam.m[d] / (1 - Math.pow(0.9, adam.t)), vh = adam.v[d] / (1 - Math.pow(0.999, adam.t));
    pv[d] -= LR * mh / (Math.sqrt(vh) + 1e-8);
  }
  upd++;
  if (upd % 25 === 0 || games >= GAMES) {
    console.log('  局 ' + games + ' ‖ 步 ' + upd + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
      ' ‖ 炮 ' + (stat.fire / Math.max(1, games)).toFixed(2) + '/局 ‖ 纪律蓄 ' + (stat.charge / Math.max(1, games)).toFixed(2) + '/局' +
      ' ‖ 熵 ' + (stat.ent / Math.max(1, stat.decs)).toFixed(3) + 'nats ‖ zip坏 ' + ZIP.bad + '/' + ZIP.games);
  }
  if (!stat.snap8k && games >= Math.floor(GAMES / 3)) {
    stat.snap8k = true;
    const p8 = OUT.replace(/\.bak$/, '') + '-8k.bak';
    savePack(p8);
    console.log('  ⚑ P-B2 快照（1/3 预算）→ ' + p8);
  }
}
const secs = (Date.now() - t0) / 1000;
console.log('  终：局 ' + games + ' ‖ 平均净分 ' + (stat.score / Math.max(1, games)).toFixed(3) +
  ' ‖ 炮/局 ' + (stat.fire / Math.max(1, games)).toFixed(3) + ' ‖ 纪律蓄/局 ' + (stat.charge / Math.max(1, games)).toFixed(3) +
  ' ‖ zip 坏 ' + ZIP.bad + '/' + ZIP.games + ' ‖ 耗时 ' + secs.toFixed(0) + 's');
savePack(OUT);
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'pg-train', tag: TAG || null, parent: UP, seed: SEED, games, batch: BATCH, lr: LR, temp: TEMP,
  lamC: LAMC, lamF: LAMF, cur: 'net', updates: upd, wallSecs: Math.round(secs),
  loop: { meanScore: stat.score / Math.max(1, games), firePerGame: stat.fire / Math.max(1, games), discChargePerGame: stat.charge / Math.max(1, games), entropy: stat.ent / Math.max(1, stat.decs), zipBad: ZIP.bad },
  container: { v: 91, input: got.cfg.input, dof: got.cfg.dof },
  lineage: { parent: UP, gen: 2, recipe: { objective: (LAMC || LAMF) ? 'scoreNet + λc·discCharge + λf·railgun (resident)' : 'scoreNet only (λ=0 negative control)', solver: 'REINFORCE+Adam (pg-lib, selftest3 6 legs)' } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
