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

/* ⚑ 包参数**必填**（10-31 晚改）：默认曾指向 `scratch/arms/OB3CH-s7.bak`，代 2（v:91）退役后裸跑必撞代闸。
 *   scratch/ 不入库 ⇒ 没有可进 git 的默认 gen-3 包；与其埋一个会过期的默认值，不如响亮要参数。
 *   本机现成代 3 包：`scratch/arms/gd3b-ks-sb.bak`（电磁炮桶专家，电磁炮线产物都在它下游）。 */
const PACK = process.argv[2];
if (!PACK) {
  console.error('⛔ selftest3 需要 --包路径（代 3 容器）。例：node tools/proto2/selftest3.mjs scratch/arms/gd3b-ks-sb.bak（scratch/ 不入库，盘上没有就先跑一发 supfit-gd/pg-train 冒烟产出）。');
  process.exit(2);
}
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
let cN = 0, cBad = 0, cSkip = 0, cFloor = 0, cRes = 0, cFull = 0, cFullRes = 0, worst = 0;
const EPS = 1e-6;
/* ⚑ 全扫点（逐坐标查）挑的不是"最好看"的格子，而是**这条腿自己分得出真假**的格子：
 *   ① 该候选 π∈[0.05,0.95]（政策在这一格没决定死 ⇒ 梯度不是 1e-51 那种纯噪声）；
 *   ② 解析梯度 |∂|>1e-6 的坐标数 ≥300（否则全扫 7993 格里大半贴地板，等于白扫）。
 *   找不到 ⇒ 当场判红（"分母不足"），不许用绿色交差。
 *   动因（10-31 注入测）：旧版三处各抽 4% ⇒ 删掉 policyHead 偏置那一格的梯度**照样绿**；
 *   第一版改成"逐坐标全扫 pts[3]"也照样绿——因为那一格 π=1.000 ⇒ 全网络梯度都是 1e-51，全扫也是在扫噪声。 */
let fullPt = null, fullIdx = -1, fullPi = NaN;
for (const pt of pts) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15 });
  for (let i = 0; i < fr.probs.length; i++) {
    if (fr.probs[i] < 0.05 || fr.probs[i] > 0.95) continue;
    const ag = analyticGrad(pt, i);
    let res = 0; for (let k = 0; k < ag.length; k++) if (Math.abs(ag[k]) > 1e-6) res++;
    if (res > cFullRes) { cFullRes = res; fullPt = pt; fullIdx = i; fullPi = fr.probs[i]; }
    if (cFullRes >= 300) break;
  }
  if (cFullRes >= 300) break;
}
if (cFullRes < 300) { cBad++; console.log('   ✘ 全扫夹具不足：可分辨坐标最多的一格只有 ' + cFullRes + ' 个（要 ≥300）⇒ 这条腿在这枚包上分不出真假'); }
outer:
for (const [pi, cell] of [[0, fullPt ? { pt: fullPt, idx: fullIdx } : null],
                          [1, { pt: pts[3], idx: -1 }], [2, { pt: pts[11], idx: -1 }]]) {
  const pt = cell && cell.pt;
  if (!pt) break;
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15 });
  /* 抽样点里 chosen = 随机候选（覆盖多键）；全扫点用上面挑定的那一个 */
  const idx = cell.idx >= 0 ? cell.idx : Math.floor(rnd() * fr.probs.length);
  const ag = analyticGrad(pt, idx);
  const FULL = (pi === 0);
  if (FULL) cFull = params.length;
  const probe = [];
  for (let k = 0; k < params.length; k++) if (FULL || rnd() < 300 / params.length) probe.push(k);
  for (const k of probe) {
    const p2 = Float64Array.from(params), m2 = Float64Array.from(params);
    p2[k] += EPS; m2[k] -= EPS;
    const lp = logPiOf(p2, pt, idx), lm = logPiOf(m2, pt, idx);
    const num = (lp - lm) / (2 * EPS);
    const ana = ag[k];
    if (!Number.isFinite(num) || !Number.isFinite(ana)) { cSkip++; continue; }
    const err = Math.abs(num - ana) / Math.max(1e-8, Math.abs(num), Math.abs(ana));
    const adiff = Math.abs(num - ana);
    /* 中心差分的**分辨率下限 = ulp(f)/ε**（不是拍脑袋的 1e-8）：|logπ| 到 160 量级时（饱和包的弃选候选 π≈1e-70），
     *   ulp(f)≈3e-14 ⇒ 地板 1.4e-8 —— 10-31 实测：这种格的 num 随 ε 缩小而**等比放大**（1e-3→1.4e-11、1e-8→1.4e-6），
     *   是纯舍入噪声不是漏项（原件 scratch/c-leg-probe.mjs 的分诊输出），旧地板把整批好格子判成红。
     * ⚑ 第二条豁免按**训练尺度**而不是按噪声：|num| 与 |ana| 都 < 1e-5 的格子直接不进判定（记进 cFloor 的分母）。
     *   理由：temp=0.15 把 logits 侧 1e-15 量级的舍入放大成 logπ 侧 ~1e-8，而 Adam 眼里 1e-8 的梯度与 0 是同一回事；
     *   真漏项（与训练梯度同量级，O(1e-2)）远在这条线之上 ⇒ 牙还在（注入测 M1/M2/M3 全红，见 §二十）。 */
    const floor = 4 * Number.EPSILON * Math.max(Math.abs(lp), Math.abs(lm), 1) / EPS;
    const tiny = Math.max(Math.abs(num), Math.abs(ana)) < 1e-5;
    const tol = floor + 1e-3 * Math.max(Math.abs(num), Math.abs(ana));
    if (!tiny && adiff > tol) { cBad++; if (cBad <= 5) console.log('   ✘ 参数 ' + k + ' 解析 ' + ana.toExponential(3) + ' vs 数值 ' + num.toExponential(3) + ' (rel ' + err.toExponential(2) + ' ‖ 地板 ' + floor.toExponential(2) + ')'); }
    if (!tiny && adiff > tol && err > worst) worst = err;
    if (tiny || Math.max(Math.abs(num), Math.abs(ana)) <= floor) cFloor++; else cRes++;
    cN++;
    if (cBad > 8) { console.log('   …错太多，停'); break outer; }
  }
}
const cResolvable = cRes;
console.log('腿C 数值梯度:   ' + (cBad === 0 ? '✔ ' : '✘ ') + cN + ' 个参数对账 ‖ 全扫点 π=' + fullPi.toFixed(3) + '（逐坐标 ' + cFull + ' 里可分辨 ' + cFullRes + '）‖ 判定 ' + cResolvable + ' ‖ 不进判定 ' + cFloor + '（训练尺度 <1e-5 或被 ulp(logπ)/ε 盖住）‖ 最坏相对误差 ' + worst.toExponential(2) + (cSkip ? ' ‖ 跳过非有限 ' + cSkip : ''));
if (cResolvable < 60) { cBad++; console.log('   ✘ 可分辨格不足 60 ⇒ 这条腿在这枚包上分不出真假，不许当过（换未饱和的起点再跑）'); }

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

const ok = badA === 0 && badB === 0 && cBad === 0 && dBad === 0 && eBad === 0 && fBad === 0;
console.log(ok ? '# selftest3 全绿 ✔（pg 臂允许开）' : '# selftest3 红 ⇒ pg 臂不许开');
if (!ok) process.exit(8);

function main() {}
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) main();
