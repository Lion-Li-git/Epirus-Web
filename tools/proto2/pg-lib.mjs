/* pg-lib.mjs — 2.0 网的精确梯度（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §三2）
 *
 * 为什么存在：CEM 把每局 ~26 个决策点压成 1 个标量（fitness-noise 实测同代 ρ=0.41）；这个网的全部层
 * 都是"线性+ReLU"、只有尾是线性读出 + 两级 softmax ⇒ 对每个参数的**精确梯度**可以手写反传拿到。
 * 本文件三件事：
 *   ① tapeForward —— 从 `forwardObs3(…, {wantTape:1}).tape` 出发**逐字重放**层算术 ⇒ logits/probs 与
 *      前向逐位同（selftest3 腿 A/B）；特征构造仍单源在 arch2，这里只重放、不重算特征。
 *   ② tapeBackward —— 4 层线性+ReLU（seatEnc/ctx/actEnc/cand）+ 线性尾的反传；上游 dlogits 由
 *      ③ 的尾导数（强化学习）或 dlogπ 的负值（监督 CE）给出。
 *   ③ dLogPi —— 两级 softmax（键层 bestOf + 键内 softmax）对 logit 的导数；**数值梯度腿**全局兜底
 *      （selftest3 腿 C：解析 vs 中心差分 <1e-3，避开拐点的参数计数）。尾式与 arch2 forwardObs3
 *      的尾**逐字同源**（复制粘贴，不凭记忆——本仓 10-29 的教训）。
 * 布局语义（逐字对 encode）：权重行主序 base=wOff+j*inDim，bias 在 biasOff+j，biasOff=seg.off+out*in。
 */
export function layoutOf(P) {
  const L = P.__arch2 && P.__arch2.L;
  if (!L) throw new Error('pg-lib: P.__arch2.L 不在 ⇒ 只支持 2.0 张量（v7 包走原训练环）');
  const segOf = (nm) => { const s = L.seg.find((x) => x.name === nm); if (!s) throw new Error('pg-lib: 段 `' + nm + '` 不在段表'); return s.off; };
  const y = {
    L,
    seatIn: L.seatIn, seatH: L.seatH, ctxDim: L.ctxDim, hid: L.hid, actIn: L.actIn, actH: L.actH, candIn: L.candIn, hid2: L.hid2,
    WS: segOf('seatEnc'), WA: segOf('actEnc'), WC: segOf('ctx'), WK: segOf('cand'), headOff: segOf('policyHead'),
    seatBias: L.seg[0].off + L.seatH * L.seatIn, actBias: L.seg[1].off + L.actH * L.actIn,
    ctxBias: L.seg[2].off + L.hid * L.ctxDim, candBias: L.seg[3].off + L.hid2 * L.candIn,
  };
  if (L.interK > 0 || L.tinterK > 0) throw new Error('pg-lib: interK/tinterK>0 的包反传未实现（收到 ' + L.interK + '/' + L.tinterK + '）⇒ 拒绝静默按线性算');
  return y;
}

/* —— 层算术（逐字抄 arch2 encode 的循环次序；Float 加法顺序不能动）—— */
function enc(buf, params, inDim, outDim, wOff, biasOff, out) {
  for (let j = 0; j < outDim; j++) {
    let s = params[biasOff + j];
    const base = wOff + j * inDim;
    for (let i = 0; i < inDim; i++) s += params[base + i] * buf[i];
    out[j] = s > 0 ? s : 0;
  }
  return out;
}

/* 两级 softmax 尾（逐字抄 forwardObs3 的尾；入参 logits/keys/temp）⇒ {probs, within, kProb} */
export function tailOf(logits, keys, temp) {
  const n = logits.length;
  const bestOf = {}, kSum = {}, kProb = {}, keysU = [];
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keysU.push(k); }
    if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
  }
  let kmax = -1e9;
  for (const k of keysU) if (bestOf[k] > kmax) kmax = bestOf[k];
  let ktot = 0;
  for (const k of keysU) { kProb[k] = Math.exp((bestOf[k] - kmax) / temp); ktot += kProb[k]; }
  for (const k of keysU) kProb[k] = ktot > 0 ? kProb[k] / ktot : 0;
  for (let i = 0; i < n; i++) { const k = keys[i]; kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }
  const probs = new Float64Array(n), within = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    within[i] = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;
    probs[i] = kProb[k] * within[i];
  }
  return { probs, within, kProb, bestOf };
}

/* dlogπ(chosen)/dlogit —— 两级 softmax 的精确导数（推导记 PREREG §二；数值腿兜底）。
 *   g_j = (1/temp)·[ δ_ij − δ{k_j=k_i}·within_j + δ{k_j=k_i ∧ j=am(k_i)} − kProb[k_j]·δ{j=am(k_j)} ] */
export function dLogPi(chosen, logits, keys, temp, t) {
  const n = logits.length;
  const g = new Float64Array(n);
  const ki = keys[chosen];
  /* am(k)：bestOf 的下标 */
  const am = {};
  for (let i = 0; i < n; i++) { const k = keys[i]; if (t.bestOf[k] === logits[i] && am[k] === undefined) am[k] = i; }
  for (let j = 0; j < n; j++) {
    const same = keys[j] === ki;
    g[j] = ((chosen === j ? 1 : 0)
      - (same ? t.within[j] : 0)
      + (same && j === am[ki] ? 1 : 0)
      - t.kProb[keys[j]] * (j === am[keys[j]] ? 1 : 0)) / temp;
  }
  return g;
}

/* dlog P(key=k)/dlogit —— 监督蒸馏的目标是**键级**似然（教师给的是键，键内候选是同一手的不同珠/目标变体）。
 *   P(key=k) = kProb[k] = e^{B_k/temp}/Σ_m e^{B_m/temp} ⇒
 *   u_j = (1/temp)·[ δ_{j=am(k)} − kProb[k_j]·δ_{j=am(k_j)} ]   （selftest3 腿 F 数值兜底） */
export function dLogKeyP(k, logits, keys, temp, t) {
  const n = logits.length;
  const am = {};
  for (let i = 0; i < n; i++) { const kk = keys[i]; if (t.bestOf[kk] === logits[i] && am[kk] === undefined) am[kk] = i; }
  const u = new Float64Array(n);
  for (let j = 0; j < n; j++) u[j] = ((j === am[k] ? 1 : 0) - t.kProb[keys[j]] * (j === am[keys[j]] ? 1 : 0)) / temp;
  return u;
}

/* 前向重放：tape（wantTape 产物）+ params ⇒ 全部激活 + logits。
 *   xin 尾块（hSelf/mean/max）从 e 重算（反传要这两条路）；前块（g/priv/seq/sums）直接抄 tape。 */
export function tapeForward(tape, params, ly) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias } = ly;
  const head = ctxDim - 3 * seatH;
  if (!tape.xin || tape.xin.length !== ctxDim) throw new Error('tapeForward: tape.xin 缺/宽不对');
  const e = new Map(), eArr = [];
  let selfIdx = -1;
  for (let s = 0; s < tape.svs.length; s++) {
    const out = new Float64Array(seatH);
    enc(tape.svs[s].sv, params, seatIn, seatH, WS, seatBias, out);
    e.set(tape.svs[s].id, out); eArr.push(out);
    if (tape.svs[s].sv[seatIn - 1] >= 0.5) selfIdx = s;
  }
  if (selfIdx < 0) throw new Error('tapeForward: tape 里没有 isSelf 席（sv 尾位全 0）');
  const hSelf = eArr[selfIdx];
  let poolN = 0;
  const mean = new Float64Array(seatH), mx = new Float64Array(seatH);
  for (let s = 0; s < eArr.length; s++) {
    if (s === selfIdx) continue;
    poolN++;
    for (let j = 0; j < seatH; j++) { mean[j] += eArr[s][j]; if (eArr[s][j] > mx[j]) mx[j] = mx[j] > eArr[s][j] ? mx[j] : eArr[s][j]; }
  }
  const kk = Math.max(1, poolN);
  for (let j = 0; j < seatH; j++) mean[j] /= kk;
  const xin = new Float64Array(ctxDim);
  for (let i = 0; i < head; i++) xin[i] = tape.xin[i];
  for (let j = 0; j < seatH; j++) { xin[head + j] = hSelf[j]; xin[head + seatH + j] = mean[j]; xin[head + 2 * seatH + j] = mx[j]; }
  const hctx = enc(xin, params, ctxDim, hid, WC, ctxBias, new Float64Array(hid));
  const n = tape.afs.length;
  const zeros = new Float64Array(seatH);
  const aes = [], hcs = [], logits = new Float64Array(n), te1s = [], te2s = [];
  for (let i = 0; i < n; i++) {
    const ae = enc(tape.afs[i], params, actIn, actH, WA, actBias, new Float64Array(actH));
    const t1 = tape.t1[i], t2 = tape.t2[i];
    const te1 = (t1 != null && e.has(t1)) ? e.get(t1) : zeros;
    const te2 = (t2 != null && e.has(t2)) ? e.get(t2) : zeros;
    const ci = new Float64Array(candIn);
    ci.set(hctx, 0); ci.set(ae, hid); ci.set(te1, hid + actH); ci.set(te2, hid + actH + seatH);
    const hc = enc(ci, params, candIn, hid2, WK, candBias, new Float64Array(hid2));
    let v = params[headOff + hid2];
    for (let j = 0; j < hid2; j++) v += params[headOff + j] * hc[j];
    aes.push(ae); hcs.push(hc); te1s.push(te1); te2s.push(te2); logits[i] = v;
  }
  return { e, eArr, selfIdx, hSelf, mean, mx, xin, hctx, aes, te1s, te2s, hcs, logits };
}

/* 反传：upstream（对 logit 的梯度）⇒ 累加进 grad（Float64Array(DIM)）。act = tapeForward 的产物。
 *   ⚑ ReLU 掩码的点位（写错一次就全错的账，记在注释里）：
 *     · dhc  掩 hc>0（cand 层输出）
 *     · dae  掩 ae>0（actEnc 输出）——在 actEnc 聚合处
 *     · dhctx 掩 hctx>0（ctx 输出）——在 ctx 聚合处
 *     · dSeat 是"对 e_s（seatEnc 的 ReLU 输出）的梯度"，四条路（hSelf/mean/max/te1·te2）**都不掩**，
 *       统一在 seatEnc 聚合处掩 e_s>0 —— 掩两次 = 把别的路也清了（第一版就栽在这里）。 */
export function tapeBackward(tape, params, ly, act, upstream, grad) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias } = ly;
  const head = ctxDim - 3 * seatH;
  const n = act.hcs.length;
  const dhctxTot = new Float64Array(hid);
  const dSeat = new Map();
  const dSeatAcc = (sidx) => { if (!dSeat.has(sidx)) dSeat.set(sidx, new Float64Array(seatH)); return dSeat.get(sidx); };
  const tePaths = [];
  for (let i = 0; i < n; i++) {
    const u = upstream[i];
    /* ⚠ NaN 在 JS 里是 **falsy**（10-31 首轮 8 臂全废的根因之一）：`if (!u)` 会把 NaN 当"无上游"
     *   静默吞掉 ⇒ grad 恒 0、训练空转。这里把 NaN 当事故响亮抛，0 才是合法的稀疏跳过。 */
    if (Number.isNaN(u)) throw new Error('tapeBackward: upstream[' + i + '] 是 NaN ⇒ 上游计算有洞，拒绝静默跳过');
    if (!u) continue;
    const hc = act.hcs[i];
    for (let j = 0; j < hid2; j++) grad[headOff + j] += u * hc[j];
    grad[headOff + hid2] += u;
    const dhc = new Float64Array(hid2);
    for (let j = 0; j < hid2; j++) dhc[j] = (hc[j] > 0) ? u * params[headOff + j] : 0;
    const dci = new Float64Array(candIn);
    for (let j = 0; j < hid2; j++) {
      const d = dhc[j];
      if (!d) continue;
      grad[candBias + j] += d;
      const base = WK + j * candIn;
      for (let t2 = 0; t2 < hid; t2++) { grad[base + t2] += d * act.hctx[t2]; dci[t2] += d * params[base + t2]; }
      const ae = act.aes[i];
      for (let t2 = 0; t2 < actH; t2++) { grad[base + hid + t2] += d * ae[t2]; dci[hid + t2] += d * params[base + hid + t2]; }
      const t1i = tape.t1[i];
      if (t1i != null && act.e.has(t1i)) {
        const sv1 = act.te1s[i];
        for (let t2 = 0; t2 < seatH; t2++) { grad[base + hid + actH + t2] += d * sv1[t2]; dci[hid + actH + t2] += d * params[base + hid + actH + t2]; }
      }
      const t2i = tape.t2[i];
      if (t2i != null && act.e.has(t2i)) {
        const sv2 = act.te2s[i];
        for (let t2 = 0; t2 < seatH; t2++) { grad[base + hid + actH + seatH + t2] += d * sv2[t2]; dci[hid + actH + seatH + t2] += d * params[base + hid + actH + seatH + t2]; }
      }
    }
    if (tape.t1[i] != null && act.e.has(tape.t1[i])) tePaths.push({ seatId: tape.t1[i], dte: dci.slice(hid + actH, hid + actH + seatH) });
    if (tape.t2[i] != null && act.e.has(tape.t2[i])) tePaths.push({ seatId: tape.t2[i], dte: dci.slice(hid + actH + seatH, hid + actH + 2 * seatH) });
    for (let t2 = 0; t2 < hid; t2++) dhctxTot[t2] += dci[t2];
    const dae = dci.subarray(hid, hid + actH);
    const ae = act.aes[i];
    for (let j = 0; j < actH; j++) {
      const d = (ae[j] > 0) ? dae[j] : 0;
      if (!d) continue;
      grad[actBias + j] += d;
      const base = WA + j * actIn, af = tape.afs[i];
      for (let t2 = 0; t2 < actIn; t2++) grad[base + t2] += d * af[t2];
    }
  }
  /* ctx 层（权重/偏置全宽 + dxin 尾块；第一版漏了尾块 48 列的权重梯度——数值腿抓的） */
  const dxinTail = new Float64Array(3 * seatH);
  for (let j = 0; j < hid; j++) {
    const d = (act.hctx[j] > 0) ? dhctxTot[j] : 0;
    if (!d) continue;
    grad[ctxBias + j] += d;
    const base = WC + j * ctxDim;
    for (let t2 = 0; t2 < ctxDim; t2++) grad[base + t2] += d * act.xin[t2];
    for (let t2 = 0; t2 < 3 * seatH; t2++) dxinTail[t2] += d * params[base + head + t2];
  }
  /* dxin 尾块 → 席编码三条路（对 e_s 的梯度，不掩——掩在 seatEnc 聚合处） */
  {
    const dSelf = dSeatAcc(act.selfIdx);
    for (let j = 0; j < seatH; j++) dSelf[j] += dxinTail[j];
  }
  {
    const poolN = Math.max(1, act.eArr.length - 1);
    for (let s = 0; s < act.eArr.length; s++) {
      if (s === act.selfIdx) continue;
      const dO = dSeatAcc(s);
      for (let j = 0; j < seatH; j++) dO[j] += dxinTail[seatH + j] / poolN;
    }
  }
  for (let j = 0; j < seatH; j++) {
    let bi = -1, bv = -Infinity;
    for (let s = 0; s < act.eArr.length; s++) {
      if (s === act.selfIdx) continue;
      if (act.eArr[s][j] > bv) { bv = act.eArr[s][j]; bi = s; }
    }
    if (bi >= 0) dSeatAcc(bi)[j] += dxinTail[2 * seatH + j];
  }
  const id2idx = new Map();
  for (let s = 0; s < tape.svs.length; s++) id2idx.set(tape.svs[s].id, s);
  for (const p of tePaths) {
    const sidx = id2idx.get(p.seatId);
    if (sidx === undefined) throw new Error('tapeBackward: te 席号 ' + p.seatId + ' 不在 tape.svs');
    const dS = dSeatAcc(sidx);
    for (let j = 0; j < seatH; j++) dS[j] += p.dte[j];
  }
  /* seatEnc 聚合：唯一掩码点（e_s>0） */
  for (const [sidx, dS] of dSeat) {
    const sv = tape.svs[sidx].sv, e = act.eArr[sidx];
    for (let j = 0; j < seatH; j++) {
      const d = (e[j] > 0) ? dS[j] : 0;
      if (!d) continue;
      grad[seatBias + j] += d;
      const base = WS + j * seatIn;
      for (let t2 = 0; t2 < seatIn; t2++) grad[base + t2] += d * sv[t2];
    }
  }
  void head;
}
