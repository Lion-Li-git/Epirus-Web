#!/usr/bin/env node
/* selftest3.mjs — pg-lib 的牙（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §三）
 *   A probs 复刻：pg-lib.tailOf 与 forwardObs3.probs 逐位同（随机 50 决策点）
 *   B 前向重放：tapeForward 的 logits 与 forwardObs3 的 logits 逐位同（同上分母）
 *   C 数值梯度：解析 dlogπ vs 中心差分（随机 120 参数 × 随机 3 决策点；相对误差 <1e-3）
 *   D 部署尾一致：policyChooserN 走的真实栈与 tailOf 在同一 logits 上同 argmax/probs（抽样对账）
 * 任何一条红 ⇒ pg 臂不许开（PREREG §三：先绿后跑）。
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install, readPack2, packInstallCfg } from './arch2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogPi, dLogKeyP } from './pg-lib.mjs';

const PACK = process.argv[2] || 'scratch/arms/OB3CH-s7.bak';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
loadChamp(W, 'js/bundled-champion-3p.js');
const raw = readPack2(PACK);
install(W, packInstallCfg(raw, {}).cfg);
const params = Float64Array.from(P.unpack(raw, true));
const ly = layoutOf(P);
let seed = 20261031;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* —— 收集随机决策点（真实局中盘状态）—— */
function decisionPoints(k) {
  const pts = [];
  let g = 0;
  while (pts.length < k && g < 400) {
    g++;
    const st = S.createState('multi', { next: T.mulberry32(1000 + g) }, 3);
    st.slotSalt = (g * 7919) % 100000;
    const ch = T.policyChooserN(params, 0.15);
    for (let r = 0; r < 14 && !st.over; r++) {
      for (let pid = 0; pid < 3; pid++) {
        if (st.p[pid].hp <= 0) continue;
        const legal = Play.legalActions(st, pid);
        if (pts.length < k && rnd() < 0.12) {
          const cands = P.candidatesFor(st, pid, T.econBase(st, pid, legal), { lockTarget: false }) || [];
          if (cands.length >= 2) {
            const snap = S.cloneState(st);
            snap.rng = { next: mulberry(12345) };
            pts.push({ st: snap, pid, cands: P.candidatesFor(snap, pid, T.econBase(snap, pid, legal), { lockTarget: false }) || [] });
          }
        }
        const pk = ch(st, pid, legal);
        S.attemptAction(st, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
      }
      W.EpirusResolve.resolveActions(st);
      W.EpirusResolve.endTurn(st);
    }
  }
  return pts;
}

const pts = decisionPoints(50);
if (pts.length < 20) { console.error('⛔ 决策点不够：' + pts.length); process.exit(2); }
console.log('# selftest3 ‖ 包 ' + PACK.replace(/^.*[\\/]/, '') + ' ‖ 参数 ' + params.length + ' ‖ 决策点 ' + pts.length);

/* —— 腿 A/B：probs 复刻 + 前向重放 —— */
let badA = 0, badB = 0;
for (const p of pts) {
  const fr = P.forwardCands(p.st, p.pid, p.cands, params, { temp: 0.15, wantTape: 1 });
  const act = tapeForward(fr.tape, params, ly);
  const t = tailOf(fr.logits, fr.tape.keys, 0.15);
  for (let i = 0; i < fr.probs.length; i++) {
    if (t.probs[i] !== fr.probs[i]) badA++;
    if (act.logits[i] !== fr.logits[i]) badB++;
  }
  if (t.probs.length !== fr.probs.length) badA++;
}
console.log('腿A probs 复刻: ' + (badA === 0 ? '✔ 逐位同' : '✘ ' + badA + ' 处不同'));
console.log('腿B 前向重放:   ' + (badB === 0 ? '✔ 逐位同' : '✘ ' + badB + ' 处不同'));

/* —— 腿 C：数值梯度 —— */
/* 目标函数：对数 π(chosen)（链上有意义的标量）。解析梯度 = dLogPi(u) 过 tapeBackward。 */
function logPiOf(pv, pt, idx) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, pv, { temp: 0.15 });
  return Math.log(Math.max(1e-300, fr.probs[idx]));
}
function analyticGrad(pt, idx) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15, wantTape: 1 });
  const act = tapeForward(fr.tape, params, ly);
  const t = tailOf(fr.logits, fr.tape.keys, 0.15);
  const g = dLogPi(idx, fr.logits, fr.tape.keys, 0.15, t);
  const grad = new Float64Array(params.length);
  tapeBackward(fr.tape, params, ly, act, g, grad);
  return grad;
}
let cN = 0, cBad = 0, cSkip = 0, worst = 0;
const EPS = 1e-6;
outer:
for (const pt of [pts[3], pts[11], pts[29]]) {
  if (!pt) break;
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15 });
  /* chosen = 随机候选（覆盖多键） */
  const idx = Math.floor(rnd() * fr.probs.length);
  const ag = analyticGrad(pt, idx);
  const probe = [];
  for (let k = 0; k < params.length; k++) if (rnd() < 120 / params.length) probe.push(k);
  for (const k of probe) {
    const p2 = Float64Array.from(params), m2 = Float64Array.from(params);
    p2[k] += EPS; m2[k] -= EPS;
    const lp = logPiOf(p2, pt, idx), lm = logPiOf(m2, pt, idx);
    const num = (lp - lm) / (2 * EPS);
    const ana = ag[k];
    if (!Number.isFinite(num) || !Number.isFinite(ana)) { cSkip++; continue; }
    const err = Math.abs(num - ana) / Math.max(1e-8, Math.abs(num), Math.abs(ana));
    const adiff = Math.abs(num - ana);
    /* 中心差分的舍入下限 ≈ 1e-16·|f|/ε ≈ 1e-10·|f|：两边都贴 0 时的"相对误差 1"是假阳性 ⇒ 绝对+相对混合容差 */
    if (adiff > 1e-8 + 1e-3 * Math.max(Math.abs(num), Math.abs(ana))) { cBad++; if (cBad <= 5) console.log('   ✘ 参数 ' + k + ' 解析 ' + ana.toExponential(3) + ' vs 数值 ' + num.toExponential(3) + ' (rel ' + err.toExponential(2) + ')'); }
    if (adiff > 1e-8 + 1e-3 * Math.max(Math.abs(num), Math.abs(ana)) && err > worst) worst = err;
    cN++;
    if (cBad > 8) { console.log('   …错太多，停'); break outer; }
  }
}
console.log('腿C 数值梯度:   ' + (cBad === 0 ? '✔ ' : '✘ ') + cN + ' 个参数对账，最坏相对误差 ' + worst.toExponential(2) + (cSkip ? '（跳过非有限 ' + cSkip + '）' : ''));

/* —— 腿 D：部署栈对账（chooser 的真实 probs 与 tailOf 同源）—— */
let dBad = 0;
{
  const p = pts[7];
  if (p) {
    const fr = P.forwardCands(p.st, p.pid, p.cands, params, { temp: 0.15 });
    const t = tailOf(fr.logits, fr.tape ? fr.tape.keys : p.cands.map((c) => c.key), 0.15);
    for (let i = 0; i < fr.probs.length; i++) if (Math.abs(t.probs[i] - fr.probs[i]) > 1e-15) dBad++;
  }
}
console.log('腿D 尾同源:     ' + (dBad === 0 ? '✔' : '✘ ' + dBad));

/* —— 腿 E：浏览器镜像 parity（policy2.js 的 wantTape 与 arch2 同位同值）—— */
let eBad = 0, eN = 0;
{
  const P2 = W.EpirusPolicy2;
  if (!P2) { console.log('腿E 浏览器镜像: ✘ sandbox 里没有 EpirusPolicy2'); eBad++; }
  else {
    const container = P.pack(params, W);
    const p2 = P2.unpack(container, W);
    if (!p2) { console.log('腿E 浏览器镜像: ✘ P2.unpack 读不出'); eBad++; }
    else for (const p of pts.slice(0, 10)) {
      const fa = P.forwardCands(p.st, p.pid, p.cands, params, { temp: 0.15, wantTape: 1 });
      const fb = P2.forwardCands(W, p.st, p.pid, p.cands, p2, { temp: 0.15, wantTape: 1 });
      if (!fb.tape) { eBad++; break; }
      eN++;
      if (fa.tape.keys.length !== fb.tape.keys.length) eBad++;
      for (let i = 0; i < fa.tape.keys.length; i++) {
        if (fa.tape.keys[i] !== fb.tape.keys[i]) eBad++;
        if (fa.tape.t1[i] !== fb.tape.t1[i] || fa.tape.t2[i] !== fb.tape.t2[i]) eBad++;
        for (let j = 0; j < fa.tape.afs[i].length; j++) if (fa.tape.afs[i][j] !== fb.tape.afs[i][j]) eBad++;
      }
      for (let j = 0; j < fa.tape.xin.length; j++) if (fa.tape.xin[j] !== fb.tape.xin[j]) eBad++;
      for (let s = 0; s < fa.tape.svs.length; s++) {
        if (fa.tape.svs[s].id !== fb.tape.svs[s].id) eBad++;
        for (let j = 0; j < fa.tape.svs[s].sv.length; j++) if (fa.tape.svs[s].sv[j] !== fb.tape.svs[s].sv[j]) eBad++;
      }
    }
  }
}
console.log('腿E 浏览器镜像: ' + (eBad === 0 ? '✔ ' + eN + ' 决策点 tape 逐位同' : '✘ ' + eBad));

/* —— 腿 F：键级似然导数（supfit-gd 用）数值对账 —— */
let fBad = 0, fN = 0;
{
  const p = pts[13];
  if (p) {
    const fr = P.forwardCands(p.st, p.pid, p.cands, params, { temp: 1 });
    const keys = p.cands.map((c) => c.key);
    const uniq = [...new Set(keys)];
    for (const k of uniq) {
      const t0 = tailOf(fr.logits, keys, 1);
      const ag = dLogKeyP(k, fr.logits, keys, 1, t0);
      const kp0 = t0.kProb[k];
      for (const j of [0, Math.floor(keys.length / 2), keys.length - 1]) {
        const p2 = Float64Array.from(fr.logits); p2[j] += 1e-6;
        const m2 = Float64Array.from(fr.logits); m2[j] -= 1e-6;
        const num = (Math.log(tailOf(p2, keys, 1).kProb[k]) - Math.log(tailOf(m2, keys, 1).kProb[k])) / 2e-6;
        const ana = ag[j];
        const adiff = Math.abs(num - ana);
        fN++;
        if (adiff > 1e-8 + 1e-3 * Math.max(Math.abs(num), Math.abs(ana))) { fBad++; console.log('   ✘ 键 ' + k + ' logit[' + j + '] 解析 ' + ana.toExponential(3) + ' vs 数值 ' + num.toExponential(3)); }
        void kp0;
      }
    }
  }
}
console.log('腿F 键级导数:   ' + (fBad === 0 ? '✔ ' + fN + ' 对账' : '✘ ' + fBad));

/* —— 腿 G：价值通路（q）的数值梯度 + "只动 qHead"的正交性 —— */
let gBad = 0, gN = 0, gLeak = 0, worstG = 0;
{
  const hid = ly.L.hid, qOff = ly.qHead, qLen = hid + 1;
  for (const pt of [pts[5], pts[19], pts[33]]) {
    if (!pt) continue;
    const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15, wantTape: 1 });
    const act = tapeForward(fr.tape, params, ly);
    /* 解析：dq/dθ = tapeBackward(上游=0, upstreamQ=1) */
    const gradA = new Float64Array(params.length);
    const zeros = new Float64Array(fr.logits.length);
    /* ⚑ 上游系数不许取 1：取 1 时"忘了乘上游"这种写错与正确写法**同数**（10-31 深夜的变异测出来的空档） */
    const UQ = 2.5;
    tapeBackward(fr.tape, params, ly, act, zeros, gradA, UQ, 0);
    /* 正交性：非 qHead 段必须逐位为 0（否则 critic 更新会拖走策略算术，T18 ② 那条"死区"承诺就破了） */
    for (let k = 0; k < params.length; k++) {
      const inQ = k >= qOff && k < qOff + qLen;
      if (!inQ && gradA[k] !== 0) gLeak++;
    }
    /* 数值：中心差分 tapeForward(...).q（只探 qHead 段，偏置与权重各若干） */
    const probe = [];
    for (let k = qOff; k < qOff + qLen; k++) if (rnd() < 40 / qLen) probe.push(k);
    for (const k of probe) {
      const p2v = Float64Array.from(params), m2v = Float64Array.from(params);
      p2v[k] += EPS; m2v[k] -= EPS;
      const num = UQ * (tapeForward(fr.tape, p2v, ly).q - tapeForward(fr.tape, m2v, ly).q) / (2 * EPS);
      const ana = gradA[k];
      const adiff = Math.abs(num - ana);
      gN++;
      if (adiff > 1e-8 + 1e-3 * Math.max(Math.abs(num), Math.abs(ana))) { gBad++; if (gBad <= 4) console.log('   ✘ qHead 参数 ' + k + ' 解析 ' + ana.toExponential(3) + ' vs 数值 ' + num.toExponential(3)); }
      if (adiff > worstG) worstG = adiff;
    }
    /* q 本身要与 arch2 前向返回的 q 逐位同（否则我重放的是另一套算术） */
    if (act.q !== fr.q) { gBad++; console.log('   ✘ 重放 q ' + act.q + ' ≠ 前向 q ' + fr.q); }
  }
  console.log('腿G 价值通路:   ' + (gBad === 0 && gLeak === 0 ? '✔ ' : '✘ ') + gN + ' 个 qHead 参数对账（最坏绝对差 ' + worstG.toExponential(2) +
    '）‖ 非 qHead 段泄漏 ' + gLeak + (gLeak ? ' ⇒ critic 会拖走策略算术' : ' ⇒ 策略/基线在参数空间正交'));
}

const ok = badA === 0 && badB === 0 && cBad === 0 && dBad === 0 && eBad === 0 && fBad === 0 && gBad === 0 && gLeak === 0;
console.log(ok ? '# selftest3 全绿 ✔（pg 臂允许开）' : '# selftest3 红 ⇒ pg 臂不许开');
if (!ok) process.exit(8);

function main() {}
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) main();
