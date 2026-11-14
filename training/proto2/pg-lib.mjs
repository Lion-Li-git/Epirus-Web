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
    /* 11-10：bias 一律按段名查——obs5 的 seg[1]=attn，按 [1] 取就拿到 attention 的偏移（对 obs3 族逐位同值） */
    seatBias: segOf('seatEnc') + L.seatH * L.seatIn, actBias: segOf('actEnc') + L.actH * L.actIn,
    ctxBias: segOf('ctx') + L.hid * L.ctxDim, candBias: segOf('cand') + L.hid2 * L.candIn,
    is4: L.input === 'obs4', is5: L.input === 'obs5', is6: L.input === 'obs6', selfDim: L.selfDim, skills: L.skills,
    /* obs5 聚合段的偏移（缺了就是 NaN 静默零——必须在入口守卫里响亮红） */
    AT: (L.seg.find((x) => x.name === 'attn') || {}).off,
    PM: (L.seg.find((x) => x.name === 'pma') || {}).off,
    ...(L.input === 'obs6' ? {
      oSelf: segOf('selfEnc'), oSeat: segOf('seatEnc'),
      oAQ: segOf('attnQ'), oAK: segOf('attnK'), oAV: segOf('attnV'), oAO: segOf('attnO'),
      oRF1: segOf('rff1'), oRF2: segOf('rff2'),
      oXQ: segOf('xattnQ'), oXK: segOf('xattnK'), oXV: segOf('xattnV'),
      oSK: segOf('skillHead'), oTB: segOf('tBilin'),
    } : {}),
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
  if (ly.is6) return tapeForward6(tape, params, ly);
  if (ly.is5) { if (ly.AT == null || ly.PM == null) throw new Error('tapeForward: obs5 的 AT/PM 偏移缺失 ⇒ layoutOf 没对上段表'); return tapeForward5(tape, params, ly); }   /* obs5：注意力重放（陈旧性不存在：嵌入每步从 svs 重建） */
  if (ly.is4) return tapeForward4(tape, params, ly);   /* obs4：槽位重放（11-10 修：旧路把尾块换成 obs3 族 hSelf/mean/mx 且头部槽嵌入冻结在 tape 里 = 污染） */
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
  if (ly.is6) return tapeBackward6(tape, params, ly, act, upstream, grad);
  if (ly.is5) { if (ly.AT == null || ly.PM == null) throw new Error('tapeBackward: obs5 的 AT/PM 缺失'); return tapeBackward5(tape, params, ly, act, upstream, grad); }
  if (ly.is4) return tapeBackward4(tape, params, ly, act, upstream, grad);
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


/* ==================== obs4 重放/反传（11-10 修复 + 补全） ====================
 * 旧 tapeForward 对 obs4 包做的事：xin[0..180) 从 tape 原样抄（其中 [60..180) 是槽 0-4 的**陈旧嵌入**，
 * 训练全程不随参数更新、反传也拿不到这条梯度），[180..251) 整体改写成 obs3 族的 hSelf/mean/mx。
 * ⇒ KDO4 的"sword100/gun100"是在这张被污染的前向上量的（kd-corruption-check.mjs 实测 max|Δlogit|>0 且
 *   seatEnc 抖动后头部 0 维变化）。这里按真前向重建：sit4 从 tape 抄（原始特征，参数无关），槽位按 pid
 *   从 eArr **每步新鲜重建**，空槽（pid 不在 state.p）= 零向量。 */
function tapeForward4(tape, params, ly) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias, selfDim } = ly;
  if (!tape.xin || tape.xin.length !== ctxDim) throw new Error('tapeForward4: tape.xin 缺/宽不对');
  const e = new Map(), eArr = [];
  for (let i = 0; i < tape.svs.length; i++) {
    const out = new Float64Array(seatH);
    enc_(tape.svs[i].sv, params, seatIn, seatH, WS, seatBias, out);
    e.set(tape.svs[i].id, out); eArr.push(out);
  }
  /* 真前向（policy2.forwardCands v4 分支）：xin = [g|priv|seq|sums|sit(60 原始)] ‖ 8 槽位嵌入 */
  const xin = new Float64Array(ctxDim);
  for (let i = 0; i < selfDim; i++) xin[i] = tape.xin[i];   // 原始特征，参数无关 ⇒ 抄即新鲜
  const zeros = new Float64Array(seatH);
  for (let sl = 0; sl < 8; sl++) { const e5 = e.has(sl) ? e.get(sl) : zeros; for (let j = 0; j < seatH; j++) xin[selfDim + sl * seatH + j] = e5[j]; }
  const hctx = enc_(xin, params, ctxDim, hid, WC, ctxBias, new Float64Array(hid));
  const act = candReplay(tape, params, ly, e, hctx);
  act.eArr = eArr; act.xin = xin;
  return act;
}
function tapeBackward4(tape, params, ly, act, upstream, grad) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias, selfDim } = ly;
  const { dhctxTot, tePaths } = candBackward(tape, params, ly, act, upstream, grad);
  /* ctx 层：全宽 dxin（obs4 由槽位路自己路由） */
  const dxin = new Float64Array(ctxDim);
  for (let j = 0; j < hid; j++) {
    const d = (act.hctx[j] > 0) ? dhctxTot[j] : 0;
    if (!d) continue;
    grad[ctxBias + j] += d;
    const base = WC + j * ctxDim;
    for (let t2 = 0; t2 < ctxDim; t2++) { grad[base + t2] += d * act.xin[t2]; dxin[t2] += d * params[base + t2]; }
  }
  /* 路由：[0..selfDim) 原始特征无梯度；[selfDim + s*seatH ..) → 槽 s 的 seatEnc 梯度（掩码统一在 seatEnc 聚合处） */
  const dSeat = new Map();
  const id2idx = new Map();
  for (let i = 0; i < tape.svs.length; i++) id2idx.set(tape.svs[i].id, i);
  for (let sl = 0; sl < 8; sl++) {
    const idx = id2idx.get(sl);
    if (idx === undefined) continue;   // 空/不存在槽 = 常量零，无梯度路
    const dS = new Float64Array(seatH);
    for (let j = 0; j < seatH; j++) dS[j] = dxin[selfDim + sl * seatH + j];
    dSeat.set(idx, dS);
  }
  for (const p of tePaths) {
    const sidx = id2idx.get(p.seatId);
    if (sidx === undefined) throw new Error('tapeBackward4: te 席号 ' + p.seatId + ' 不在 tape.svs');
    if (!dSeat.has(sidx)) dSeat.set(sidx, new Float64Array(seatH));
    const dS = dSeat.get(sidx);
    for (let j = 0; j < seatH; j++) dS[j] += p.dte[j];
  }
  seatEncAgg(tape, params, ly, act, grad, dSeat);
}

/* ==================== obs5 重放/反传（11-10 ZCode） ====================
 * 重放把注意力+PMA **每步从 tape.svs 重建**（svs 只含活席；席位嵌入参数相关 ⇒ 重放是唯一新鲜路）。
 * xin 前缀 selfDim(60) 是原始特征抄 tape；后 poolN×seatH 是 PMA 池，算完回填。 */
function tapeForward5(tape, params, ly) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias, selfDim, AT, PM } = ly;
  if (!tape.xin || tape.xin.length !== ctxDim) throw new Error('tapeForward5: tape.xin 缺/宽不对');
  const H = seatH, SQ = Math.sqrt(H), PN = ly.L.poolN;
  const WQ = AT, BQ = WQ + H * H, WKg = BQ + H, BKg = WKg + H * H, WVg = BKg + H, BVg = WVg + H * H;
  const WQ2 = PM, BQ2 = WQ2 + H * H, SD0 = BQ2 + H;
  const lin5 = (src, wOff, bOff, out) => { for (let j = 0; j < H; j++) { let s5 = params[bOff + j]; const base = wOff + j * H; for (let i = 0; i < H; i++) s5 += params[base + i] * src[i]; out[j] = s5; } return out; };
  const sm5 = (row) => { let m5 = -Infinity; for (let j = 0; j < row.length; j++) if (row[j] > m5) m5 = row[j]; let s5 = 0; const w = new Float64Array(row.length); for (let j = 0; j < row.length; j++) { w[j] = Math.exp(row[j] - m5); s5 += w[j]; } for (let j = 0; j < row.length; j++) w[j] /= s5; return w; };
  /* 席位嵌入（活席集合，pid 序） */
  const e = new Map(), es5 = [];
  for (let i = 0; i < tape.svs.length; i++) {
    const out = new Float64Array(H);
    enc_(tape.svs[i].sv, params, seatIn, H, WS, seatBias, out);
    e.set(tape.svs[i].id, out); es5.push(out);
  }
  const K = es5.length;
  /* 注意力轮 1 */
  const qs5 = [], ks5 = [], vs5 = [], w1 = [], ebs5 = [];
  for (let i = 0; i < K; i++) { qs5.push(lin5(es5[i], WQ, BQ, new Float64Array(H))); ks5.push(lin5(es5[i], WKg, BKg, new Float64Array(H))); vs5.push(lin5(es5[i], WVg, BVg, new Float64Array(H))); }
  for (let i = 0; i < K; i++) {
    const row = new Float64Array(K);
    for (let j = 0; j < K; j++) { let lg = 0; for (let t = 0; t < H; t++) lg += qs5[i][t] * ks5[j][t]; row[j] = lg / SQ; }
    const w = sm5(row); w1.push(w);
    const u = new Float64Array(H);
    for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H; t++) u[t] += wj * vs5[j][t]; }
    const eb = new Float64Array(H);
    for (let t = 0; t < H; t++) eb[t] = es5[i][t] + u[t];
    ebs5.push(eb);
  }
  /* PMA（keys/values 读注意力后语境） */
  const kbs5 = [], vbs5 = [], w2 = [], seeds = [], qs2 = [], pooled = new Float64Array(PN * H);
  for (let j = 0; j < K; j++) { kbs5.push(lin5(ebs5[j], WKg, BKg, new Float64Array(H))); vbs5.push(lin5(ebs5[j], WVg, BVg, new Float64Array(H))); }
  for (let d = 0; d < PN; d++) {
    const seed = new Float64Array(H);
    for (let t = 0; t < H; t++) seed[t] = params[SD0 + d * H + t];
    seeds.push(seed);
    const q2 = lin5(seed, WQ2, BQ2, new Float64Array(H)); qs2.push(q2);
    const row = new Float64Array(K);
    for (let j = 0; j < K; j++) { let lg = 0; for (let t = 0; t < H; t++) lg += q2[t] * kbs5[j][t]; row[j] = lg / SQ; }
    const w = sm5(row); w2.push(w);
    for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H; t++) pooled[d * H + t] += wj * vbs5[j][t]; }
  }
  /* xin = 原始前缀（抄 tape，参数无关）‖ PMA 池（新鲜算） */
  const xin = new Float64Array(ctxDim);
  for (let i = 0; i < selfDim; i++) xin[i] = tape.xin[i];
  for (let i = 0; i < pooled.length; i++) xin[selfDim + i] = pooled[i];
  const hctx = enc_(xin, params, ctxDim, hid, WC, ctxBias, new Float64Array(hid));
  const act = candReplay(tape, params, ly, e, hctx);
  Object.assign(act, { eArr: es5, xin, pooled, es5, qs5, ks5, vs5, w1, ebs5, kbs5, vbs5, w2, seeds, qs2 });
  return act;
}
function tapeBackward5(tape, params, ly, act, upstream, grad) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias, selfDim, AT, PM } = ly;
  const H = seatH, SQ = Math.sqrt(H), PN = act.w2.length, K = act.ebs5.length;
  const WQ = AT, BQ = WQ + H * H, WKg = BQ + H, BKg = WKg + H * H, WVg = BKg + H, BVg = WVg + H * H;
  const WQ2 = PM, BQ2 = WQ2 + H * H, SD0 = BQ2 + H;
  const { dhctxTot, tePaths } = candBackward(tape, params, ly, act, upstream, grad);
  /* ctx 层：全宽 dxin */
  const dxin = new Float64Array(ctxDim);
  for (let j = 0; j < hid; j++) {
    const d = (act.hctx[j] > 0) ? dhctxTot[j] : 0;
    if (!d) continue;
    grad[ctxBias + j] += d;
    const base = WC + j * ctxDim;
    for (let t2 = 0; t2 < ctxDim; t2++) { grad[base + t2] += d * act.xin[t2]; dxin[t2] += d * params[base + t2]; }
  }
  /* ---- PMA 反传：dpooled → (w2 softmax 后向) → q2/seed 段梯度 + k̄/v̄ → dē ---- */
  const dEbar = []; for (let i = 0; i < K; i++) dEbar.push(new Float64Array(H));
  const dQ2 = []; for (let d = 0; d < PN; d++) dQ2.push(new Float64Array(H));
  for (let d = 0; d < PN; d++) {
    const dp = dxin.subarray(selfDim + d * H, selfDim + (d + 1) * H);
    let any = false; for (let t = 0; t < H; t++) if (dp[t]) { any = true; break; }
    if (!any) continue;
    /* softmax 后向：dlogit2_dj = a2_dj · dp·(v̄_j − p_d)（Σ a·v̄ = p_d 的技巧） */
    for (let j = 0; j < K; j++) {
      let dotv = 0; for (let t = 0; t < H; t++) dotv += dp[t] * act.vbs5[j][t];
      let dotp = 0; for (let t = 0; t < H; t++) dotp += dp[t] * act.pooled[d * H + t];
      const dl = act.w2[d][j] * (dotv - dotp);
      if (!dl) continue;
      const q2 = act.qs2[d], kb = act.kbs5[j];
      const dq2 = dQ2[d], dkb = dEbar[j];   // dkb 先暂存 dk̄ 进 dEbar[j]（Wk^T dk̄），v̄ 同理
      for (let t = 0; t < H; t++) { dq2[t] += dl * kb[t] / SQ; dkb[t] += dl * q2[t] / SQ; }
    }
  }
  /* PMA 段参数梯度 + k̄/v̄ → (Wk/Wv 梯度 + dē 累加)。dEbar[j] 此刻装的是 softmax 循环存下的 dk̄_j（原始量），
   *  读出后清零重用，最终装 dL/dē_j = Wk^T dk̄_j + Wv^T dv̄_j（PMA 的 k/v 是 ē 的仅有的两条下游 ⇒ 这就是全量）。 */
  for (let j = 0; j < K; j++) {
    const eb = act.ebs5[j], dv = new Float64Array(H);
    const dkbar = dEbar[j].slice(); dEbar[j].fill(0);
    for (let r = 0; r < H; r++) {
      const dkr = dkbar[r];
      if (dkr) {
        grad[BKg + r] += dkr;   /* PMA 的 bk/Wk 与注意力轮共享 ⇒ 两处累加，这里是其一 */
        const base = WKg + r * H;
        for (let i = 0; i < H; i++) { grad[base + i] += dkr * eb[i]; dEbar[j][i] += params[base + i] * dkr; }
      }
    }
    /* dv̄_j = Σ_d a2_dj·dp_d */
    for (let d = 0; d < PN; d++) {
      const dp = dxin.subarray(selfDim + d * H, selfDim + (d + 1) * H);
      const a2 = act.w2[d][j];
      for (let t = 0; t < H; t++) dv[t] += a2 * dp[t];
    }
    for (let r = 0; r < H; r++) {
      const dvr = dv[r];
      if (dvr) {
        grad[BVg + r] += dvr;
        const base = WVg + r * H;
        for (let i = 0; i < H; i++) { grad[base + i] += dvr * eb[i]; dEbar[j][i] += params[base + i] * dvr; }
      }
    }
  }
  /* seed/Wq2/bq2 梯度：q2 = Wq2·seed + bq2 ⇒ ds = Wq2^T·dq2 */
  for (let d = 0; d < PN; d++) {
    const dq2 = dQ2[d], sd = act.seeds[d];
    const ds = new Float64Array(H);
    for (let r = 0; r < H; r++) {
      const d = dq2[r];
      if (!d) continue;
      grad[BQ2 + r] += d;
      const base = WQ2 + r * H;
      for (let i = 0; i < H; i++) { grad[base + i] += d * sd[i]; ds[i] += params[base + i] * d; }
    }
    for (let i = 0; i < H; i++) grad[SD0 + d * H + i] += ds[i];
  }
  /* ---- 注意力轮 1 反传：dē（=残差直通 du + PMA 已累进 dEbar）→ (w1 softmax 后向) → q/k/v → seatEnc ---- */
  const dSeat = new Map();
  const id2idx = new Map();
  for (let i = 0; i < tape.svs.length; i++) id2idx.set(tape.svs[i].id, i);
  const dQ = [], dK = [], dV = [];
  for (let i = 0; i < K; i++) { dQ.push(new Float64Array(H)); dK.push(new Float64Array(H)); dV.push(new Float64Array(H)); }
  for (let i = 0; i < K; i++) {
    const du = dEbar[i];   // PMA 对 ē_i 的贡献已累在这里；残差路 ⇒ 它同时就是 du_i
    let any = false; for (let t = 0; t < H; t++) if (du[t]) { any = true; break; }
    if (!any) continue;
    const w = act.w1[i], vi = act.es5[i], ebi = act.ebs5[i];
    for (let j = 0; j < K; j++) {
      let dotv = 0; for (let t = 0; t < H; t++) dotv += du[t] * act.vs5[j][t];
      let dotu = 0; for (let t = 0; t < H; t++) dotu += du[t] * (ebi[t] - vi[t]);   // u_i = ē_i − e_i
      const dl = w[j] * (dotv - dotu);
      if (!dl) continue;
      for (let t = 0; t < H; t++) { dQ[i][t] += dl * act.ks5[j][t] / SQ; dK[j][t] += dl * act.qs5[i][t] / SQ; dV[j][t] += w[j] * du[t]; }
    }
  }
  /* q/k/v 投影段梯度 + de 累加（e 的梯度经残差已拿一份 dEbar）。
   *  obs5 tape 的 svs 顺序 = sc.seats pid 序 = es5 顺序 ⇒ dSeat 直接按 svs 下标键入。 */
  for (let i = 0; i < K; i++) {
    const ei = act.es5[i];
    const de = new Float64Array(H);
    for (let t = 0; t < H; t++) de[t] += dEbar[i][t];   // 残差直通
    for (const [wOff, bOff, dq] of [[WQ, BQ, dQ[i]], [WKg, BKg, dK[i]], [WVg, BVg, dV[i]]]) {
      for (let r = 0; r < H; r++) {
        const d = dq[r];
        if (!d) continue;
        grad[bOff + r] += d;
        const base = wOff + r * H;
        for (let c = 0; c < H; c++) { grad[base + c] += d * ei[c]; de[c] += params[base + c] * d; }
      }
    }
    const sidx = i;   // es5[i] 由 tape.svs[i] 编码而来
    if (!dSeat.has(sidx)) dSeat.set(sidx, new Float64Array(H));
    const dS = dSeat.get(sidx);
    for (let t = 0; t < H; t++) dS[t] += de[t];
  }
  for (const p of tePaths) {
    const sidx = id2idx.get(p.seatId);
    if (sidx === undefined) throw new Error('tapeBackward5: te 席号 ' + p.seatId + ' 不在 tape.svs');
    if (!dSeat.has(sidx)) dSeat.set(sidx, new Float64Array(seatH));
    const dS = dSeat.get(sidx);
    for (let j = 0; j < seatH; j++) dS[j] += p.dte[j];
  }
  seatEncAgg(tape, params, ly, act, grad, dSeat);
}

/* ---- 共用：候选路重放（head/cand/actEnc 与 obs3 族逐字同源） ---- */
function candReplay(tape, params, ly, e, hctx) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias } = ly;
  const n = tape.afs.length;
  const zeros = new Float64Array(seatH);
  const aes = [], hcs = [], logits = new Float64Array(n), te1s = [], te2s = [];
  for (let i = 0; i < n; i++) {
    const ae = enc_(tape.afs[i], params, actIn, actH, WA, actBias, new Float64Array(actH));
    const t1 = tape.t1[i], t2 = tape.t2[i];
    const te1 = (t1 != null && e.has(t1)) ? e.get(t1) : zeros;
    const te2 = (t2 != null && e.has(t2)) ? e.get(t2) : zeros;
    const ci = new Float64Array(candIn);
    ci.set(hctx, 0); ci.set(ae, hid); ci.set(te1, hid + actH); ci.set(te2, hid + actH + seatH);
    const hc = enc_(ci, params, candIn, hid2, WK, candBias, new Float64Array(hid2));
    let v = params[headOff + hid2];
    for (let j = 0; j < hid2; j++) v += params[headOff + j] * hc[j];
    aes.push(ae); hcs.push(hc); te1s.push(te1); te2s.push(te2); logits[i] = v;
  }
  return { e, hctx, aes, te1s, te2s, hcs, logits };
}
/* ---- 共用：候选路反传（与 obs3 族 tapeBackward 的候选段逐字同源）⇒ {dhctxTot, tePaths} ---- */
function candBackward(tape, params, ly, act, upstream, grad) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, candIn, hid2, WS, WA, WC, WK, headOff, seatBias, actBias, ctxBias, candBias } = ly;
  const n = act.hcs.length;
  const dhctxTot = new Float64Array(hid);
  const tePaths = [];
  for (let i = 0; i < n; i++) {
    const u = upstream[i];
    if (Number.isNaN(u)) throw new Error('candBackward: upstream[' + i + '] 是 NaN ⇒ 上游计算有洞，拒绝静默跳过');
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
  return { dhctxTot, tePaths };
}
/* ---- 共用：seatEnc 聚合（唯一掩码点 e>0；dSeat 键 = tape.svs 下标） ---- */
function seatEncAgg(tape, params, ly, act, grad, dSeat) {
  const { seatIn, seatH, WS, seatBias } = ly;
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
}
/* enc_：pg-lib 内部层算术的别名（与上方 enc 同一函数体，共用实现） */
function enc_(buf, params, inDim, outDim, wOff, biasOff, out) { return enc(buf, params, inDim, outDim, wOff, biasOff, out); }

/* ==================== obs6 重放/反传 + seatDrop（11-14） ==================== */
function lin6_(params, src, inDim, outDim, segOff0, applyRelu) {
  const out = new Float64Array(outDim), bOff = segOff0 + outDim * inDim;
  for (let j = 0; j < outDim; j++) {
    let s = params[bOff + j];
    const base = segOff0 + j * inDim;
    for (let i = 0; i < inDim; i++) s += params[base + i] * src[i];
    out[j] = applyRelu ? (s > 0 ? s : 0) : s;
  }
  return out;
}
function rms6_(x, D) {
  let sq = 0; for (let j = 0; j < D; j++) sq += x[j] * x[j];
  const inv = 1 / Math.sqrt(sq / D + 1e-6);
  const y = new Float64Array(D);
  for (let j = 0; j < D; j++) y[j] = x[j] * inv;
  return { y, inv };
}
function sm6_(row) {
  let mx = -Infinity; for (let j = 0; j < row.length; j++) if (row[j] > mx) mx = row[j];
  let s = 0; const w = new Float64Array(row.length);
  for (let j = 0; j < row.length; j++) { w[j] = Math.exp(row[j] - mx); s += w[j]; }
  for (let j = 0; j < row.length; j++) w[j] /= s;
  return w;
}
function rmsBack_(dy, out, inv, D, dx) {
  let dot = 0; for (let t = 0; t < D; t++) dot += dy[t] * out[t];
  const mu = dot / D;
  for (let t = 0; t < D; t++) dx[t] += inv * (dy[t] - mu * out[t]);
}
function linBack_(params, grad, src, dy, inDim, outDim, segOff0, dx) {
  const bOff = segOff0 + outDim * inDim;
  for (let r = 0; r < outDim; r++) {
    const d = dy[r]; if (!d) continue;
    grad[bOff + r] += d;
    const base = segOff0 + r * inDim;
    for (let c = 0; c < inDim; c++) { grad[base + c] += d * src[c]; dx[c] += params[base + c] * d; }
  }
}

function tapeForward6(tape, params, ly) {
  const { seatIn, seatH, ctxDim, hid, actH, selfDim, skills, WC, ctxBias,
    oSelf, oSeat, oAQ, oAK, oAV, oAO, oRF1, oRF2, oXQ, oXK, oXV, oSK, oTB } = ly;
  if (!tape.self || tape.self.length !== selfDim) throw new Error('tapeForward6: tape.self 缺/宽不对');
  const H = seatH, FFH = 2 * H;
  const hSelf = lin6_(params, tape.self, selfDim, hid, oSelf, true);
  const e0s = [], isSelfArr = [], ids = [];
  for (let i = 0; i < tape.svs.length; i++) {
    const sv = tape.svs[i].sv;
    ids.push(tape.svs[i].id);
    isSelfArr.push(sv[seatIn - 1] >= 0.5 ? 1 : 0);
    e0s.push(lin6_(params, sv, seatIn, H, oSeat, true));
  }
  const K = e0s.length;
  const nH = (H % 2 === 0) ? 2 : 1, hd = H / nH, SQ1 = Math.sqrt(hd);
  const r0s = [], inv0s = [], q1s = [], k1s = [], v1s = [];
  for (let i = 0; i < K; i++) {
    const { y: r0, inv: iv0 } = rms6_(e0s[i], H);
    r0s.push(r0); inv0s.push(iv0);
    q1s.push(lin6_(params, r0, H, H, oAQ, false));
    k1s.push(lin6_(params, r0, H, H, oAK, false));
    v1s.push(lin6_(params, r0, H, H, oAV, false));
  }
  const u1s = [], w1 = [], e1s = [];
  for (let i = 0; i < K; i++) {
    const u1 = new Float64Array(H), wi = [];
    for (let h = 0; h < nH; h++) {
      const h0 = h * hd, row = new Float64Array(K);
      for (let j = 0; j < K; j++) {
        let lg = 0; for (let t = 0; t < hd; t++) lg += q1s[i][h0 + t] * k1s[j][h0 + t];
        row[j] = lg / SQ1;
      }
      const w = sm6_(row); wi.push(w);
      for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < hd; t++) u1[h0 + t] += wj * v1s[j][h0 + t]; }
    }
    w1.push(wi); u1s.push(u1);
    const ao = lin6_(params, u1, H, H, oAO, false);
    const e1 = new Float64Array(H);
    for (let t = 0; t < H; t++) e1[t] = e0s[i][t] + ao[t];
    e1s.push(e1);
  }
  const r1s = [], inv1s = [], ffhs = [], ectx = [], enc = new Map();
  for (let i = 0; i < K; i++) {
    const { y: r1, inv: iv1 } = rms6_(e1s[i], H);
    r1s.push(r1); inv1s.push(iv1);
    const ffh = lin6_(params, r1, H, FFH, oRF1, true);
    ffhs.push(ffh);
    const ffo = lin6_(params, ffh, FFH, H, oRF2, false);
    const ec = new Float64Array(H);
    for (let t = 0; t < H; t++) ec[t] = e1s[i][t] + ffo[t];
    ectx.push(ec); enc.set(ids[i], ec);
  }
  const q2 = lin6_(params, hSelf, hid, FFH, oXQ, false);
  const r2s = [], inv2s = [], k2s = [], v2s = [];
  for (let j = 0; j < K; j++) {
    const { y: r2, inv: iv2 } = rms6_(ectx[j], H);
    r2s.push(r2); inv2s.push(iv2);
    k2s.push(lin6_(params, r2, H, FFH, oXK, false));
    v2s.push(lin6_(params, r2, H, FFH, oXV, false));
  }
  const cross = new Float64Array(FFH), w2 = [], SQ2 = Math.sqrt(H);
  for (let m = 0; m < 2; m++) {
    const m0 = m * H, row = new Float64Array(K);
    for (let j = 0; j < K; j++) {
      let lg = 0; for (let t = 0; t < H; t++) lg += q2[m0 + t] * k2s[j][m0 + t];
      row[j] = lg / SQ2;
    }
    const w = sm6_(row); w2.push(w);
    for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H; t++) cross[m0 + t] += wj * v2s[j][m0 + t]; }
  }
  const oppMax = new Float64Array(H), maxIdx = new Int32Array(H).fill(-1);
  let hasOpp = false;
  for (let j = 0; j < K; j++) {
    if (isSelfArr[j]) continue;
    if (!hasOpp) { oppMax.set(ectx[j]); maxIdx.fill(j); hasOpp = true; }
    else for (let t = 0; t < H; t++) if (ectx[j][t] > oppMax[t]) { oppMax[t] = ectx[j][t]; maxIdx[t] = j; }
  }
  const xinRaw = new Float64Array(ctxDim);
  xinRaw.set(hSelf, 0); xinRaw.set(cross, hid); xinRaw.set(oppMax, hid + FFH);
  const xin = Float64Array.from(xinRaw);
  if (ly.L.norm) { const mu = ly.L.norm.mean, sd = ly.L.norm.std; for (let i = 0; i < ctxDim; i++) xin[i] = (xin[i] - mu[i]) / sd[i]; }
  const hctx = enc_(xin, params, ctxDim, hid, WC, ctxBias, new Float64Array(hid));
  const act = candReplay(tape, params, ly, enc, hctx);
  const tb1 = oTB, tb2 = oTB + H * actH, skB = oSK + skills * hid;
  for (let i = 0; i < act.logits.length; i++) {
    const ki = tape.skillIdx[i];
    if (ki >= 0 && ki < skills) {
      let sk = params[skB + ki];
      const wRow = oSK + ki * hid;
      for (let j = 0; j < hid; j++) sk += params[wRow + j] * hctx[j];
      act.logits[i] += sk;
    }
    const ae = act.aes[i], te1 = act.te1s[i], te2 = act.te2s[i];
    let b1 = 0, b2 = 0;
    for (let r = 0; r < H; r++) {
      let u1 = 0, u2 = 0;
      const r1 = tb1 + r * actH, r2 = tb2 + r * actH;
      for (let c = 0; c < actH; c++) { const ac = ae[c]; u1 += params[r1 + c] * ac; u2 += params[r2 + c] * ac; }
      b1 += u1 * te1[r]; b2 += u2 * te2[r];
    }
    act.logits[i] += b1 + b2;
  }
  act.hSelf = hSelf; act.e0s = e0s; act.eArr = e0s;
  act.r0s = r0s; act.inv0s = inv0s; act.q1s = q1s; act.k1s = k1s; act.v1s = v1s; act.w1 = w1; act.u1s = u1s; act.e1s = e1s;
  act.r1s = r1s; act.inv1s = inv1s; act.ffhs = ffhs; act.ectx = ectx;
  act.q2 = q2; act.r2s = r2s; act.inv2s = inv2s; act.k2s = k2s; act.v2s = v2s; act.w2 = w2; act.cross = cross; act.maxIdx = maxIdx;
  act.xin = xin;
  return act;
}

function tapeBackward6(tape, params, ly, act, upstream, grad) {
  const { seatIn, seatH, ctxDim, hid, actIn, actH, selfDim, skills, WA, WC, actBias, ctxBias,
    oSelf, oAQ, oAK, oAV, oAO, oRF1, oRF2, oXQ, oXK, oXV, oSK, oTB } = ly;
  const H = seatH, FFH = 2 * H, K = act.e0s.length;
  const { dhctxTot, tePaths } = candBackward(tape, params, ly, act, upstream, grad);
  const tb1 = oTB, tb2 = oTB + H * actH, skB = oSK + skills * hid;
  for (let i = 0; i < upstream.length; i++) {
    const u = upstream[i];
    if (!u) continue;
    const ki = tape.skillIdx[i];
    if (ki >= 0 && ki < skills) {
      grad[skB + ki] += u;
      const wRow = oSK + ki * hid;
      for (let j = 0; j < hid; j++) { grad[wRow + j] += u * act.hctx[j]; dhctxTot[j] += u * params[wRow + j]; }
    }
    const ae = act.aes[i], te1 = act.te1s[i], te2 = act.te2s[i];
    const hasT1 = tape.t1[i] != null && act.e.has(tape.t1[i]);
    const hasT2 = tape.t2[i] != null && act.e.has(tape.t2[i]);
    const dae = new Float64Array(actH);
    const dte1 = hasT1 ? new Float64Array(H) : null;
    const dte2 = hasT2 ? new Float64Array(H) : null;
    for (let r = 0; r < H; r++) {
      const te1r = te1[r], te2r = te2[r], r1 = tb1 + r * actH, r2 = tb2 + r * actH;
      for (let c = 0; c < actH; c++) {
        const ac = ae[c];
        grad[r1 + c] += u * ac * te1r;
        grad[r2 + c] += u * ac * te2r;
        dae[c] += u * (params[r1 + c] * te1r + params[r2 + c] * te2r);
        if (hasT1) dte1[r] += u * params[r1 + c] * ac;
        if (hasT2) dte2[r] += u * params[r2 + c] * ac;
      }
    }
    if (hasT1) tePaths.push({ seatId: tape.t1[i], dte: dte1 });
    if (hasT2) tePaths.push({ seatId: tape.t2[i], dte: dte2 });
    const af = tape.afs[i];
    for (let j = 0; j < actH; j++) {
      const d = (ae[j] > 0) ? dae[j] : 0; if (!d) continue;
      grad[actBias + j] += d;
      const base = WA + j * actIn;
      for (let t2 = 0; t2 < actIn; t2++) grad[base + t2] += d * af[t2];
    }
  }
  const dxin = new Float64Array(ctxDim);
  for (let j = 0; j < hid; j++) {
    const d = (act.hctx[j] > 0) ? dhctxTot[j] : 0; if (!d) continue;
    grad[ctxBias + j] += d;
    const base = WC + j * ctxDim;
    for (let t2 = 0; t2 < ctxDim; t2++) { grad[base + t2] += d * act.xin[t2]; dxin[t2] += d * params[base + t2]; }
  }
  if (ly.L.norm) { const sd = ly.L.norm.std; for (let i = 0; i < ctxDim; i++) dxin[i] /= sd[i]; }
  const dhSelf = Float64Array.from(dxin.subarray(0, hid));
  const dcross = dxin.subarray(hid, hid + FFH);
  const doppMax = dxin.subarray(hid + FFH, ctxDim);

  const dq2 = new Float64Array(FFH), dk2 = [], dv2 = [], dectx = [];
  for (let j = 0; j < K; j++) { dk2.push(new Float64Array(FFH)); dv2.push(new Float64Array(FFH)); dectx.push(new Float64Array(H)); }
  const SQ2 = Math.sqrt(H);
  for (let m = 0; m < 2; m++) {
    const m0 = m * H, w = act.w2[m];
    let dotu = 0; for (let t = 0; t < H; t++) dotu += dcross[m0 + t] * act.cross[m0 + t];
    for (let j = 0; j < K; j++) {
      let dotv = 0; for (let t = 0; t < H; t++) dotv += dcross[m0 + t] * act.v2s[j][m0 + t];
      const dl = w[j] * (dotv - dotu);
      for (let t = 0; t < H; t++) {
        dq2[m0 + t] += dl * act.k2s[j][m0 + t] / SQ2;
        dk2[j][m0 + t] += dl * act.q2[m0 + t] / SQ2;
        dv2[j][m0 + t] += w[j] * dcross[m0 + t];
      }
    }
  }
  linBack_(params, grad, act.hSelf, dq2, hid, FFH, oXQ, dhSelf);
  for (let j = 0; j < K; j++) {
    const dr2 = new Float64Array(H);
    linBack_(params, grad, act.r2s[j], dk2[j], H, FFH, oXK, dr2);
    linBack_(params, grad, act.r2s[j], dv2[j], H, FFH, oXV, dr2);
    rmsBack_(dr2, act.r2s[j], act.inv2s[j], H, dectx[j]);
  }
  for (let t = 0; t < H; t++) { const j = act.maxIdx[t]; if (j >= 0) dectx[j][t] += doppMax[t]; }
  const id2idx = new Map();
  for (let i = 0; i < K; i++) id2idx.set(tape.svs[i].id, i);
  for (const p of tePaths) {
    const sidx = id2idx.get(p.seatId);
    if (sidx === undefined) throw new Error('tapeBackward6: te 席号 ' + p.seatId + ' 不在 tape.svs');
    for (let t = 0; t < H; t++) dectx[sidx][t] += p.dte[t];
  }
  const de1 = [];
  for (let i = 0; i < K; i++) {
    const de1i = Float64Array.from(dectx[i]);
    const dffh = new Float64Array(FFH);
    linBack_(params, grad, act.ffhs[i], dectx[i], FFH, H, oRF2, dffh);
    for (let r = 0; r < FFH; r++) if (!(act.ffhs[i][r] > 0)) dffh[r] = 0;
    const dr1 = new Float64Array(H);
    linBack_(params, grad, act.r1s[i], dffh, H, FFH, oRF1, dr1);
    rmsBack_(dr1, act.r1s[i], act.inv1s[i], H, de1i);
    de1.push(de1i);
  }
  const nH = (H % 2 === 0) ? 2 : 1, hd = H / nH, SQ1 = Math.sqrt(hd);
  const dq1 = [], dk1 = [], dv1 = [];
  for (let i = 0; i < K; i++) { dq1.push(new Float64Array(H)); dk1.push(new Float64Array(H)); dv1.push(new Float64Array(H)); }
  const de0 = [];
  for (let i = 0; i < K; i++) {
    const de0i = Float64Array.from(de1[i]);
    const du1 = new Float64Array(H);
    linBack_(params, grad, act.u1s[i], de1[i], H, H, oAO, du1);
    for (let h = 0; h < nH; h++) {
      const h0 = h * hd, w = act.w1[i][h];
      let dotu = 0; for (let t = 0; t < hd; t++) dotu += du1[h0 + t] * act.u1s[i][h0 + t];
      for (let j = 0; j < K; j++) {
        let dotv = 0; for (let t = 0; t < hd; t++) dotv += du1[h0 + t] * act.v1s[j][h0 + t];
        const dl = w[j] * (dotv - dotu);
        for (let t = 0; t < hd; t++) {
          dq1[i][h0 + t] += dl * act.k1s[j][h0 + t] / SQ1;
          dk1[j][h0 + t] += dl * act.q1s[i][h0 + t] / SQ1;
          dv1[j][h0 + t] += w[j] * du1[h0 + t];
        }
      }
    }
    de0.push(de0i);
  }
  const dSeat = new Map();
  for (let i = 0; i < K; i++) {
    const dr0 = new Float64Array(H);
    linBack_(params, grad, act.r0s[i], dq1[i], H, H, oAQ, dr0);
    linBack_(params, grad, act.r0s[i], dk1[i], H, H, oAK, dr0);
    linBack_(params, grad, act.r0s[i], dv1[i], H, H, oAV, dr0);
    rmsBack_(dr0, act.r0s[i], act.inv0s[i], H, de0[i]);
    dSeat.set(i, de0[i]);
  }
  seatEncAgg(tape, params, ly, act, grad, dSeat);
  const sbOff = oSelf + hid * selfDim;
  for (let j = 0; j < hid; j++) {
    const d = (act.hSelf[j] > 0) ? dhSelf[j] : 0; if (!d) continue;
    grad[sbOff + j] += d;
    const base = oSelf + j * selfDim;
    for (let t = 0; t < selfDim; t++) grad[base + t] += d * tape.self[t];
  }
}

/** obs6 训练防过拟合：按 seatDrop 概率对非自身席位遮蔽精确键身份(lsKey/bag23)与3回合风格统计，保留核心状态与规则等价位 */
export function dropObs6Tape(tape, rate, rng) {
  if (!(rate > 0) || !tape || !tape.is6 || !tape.svs || !tape.svs.length) return tape;
  const seatIn = tape.svs[0].sv.length;
  const S = Math.round((seatIn - 51) / 2);
  if (51 + 2 * S !== seatIn) return tape;
  const r = rng || Math.random;
  let changed = false;
  const svs = tape.svs.map((item) => {
    const src = item.sv;
    if (src[seatIn - 1] >= 0.5 || r() >= rate) return item;
    changed = true;
    const sv = Float64Array.from(src);
    sv.fill(0, 21, 22 + S);
    sv.fill(0, 36 + S, 44 + 2 * S);
    return { id: item.id, sv };
  });
  return changed ? { ...tape, svs } : tape;
}
