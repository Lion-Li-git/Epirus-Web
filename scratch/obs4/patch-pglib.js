/* pg-lib.mjs 三件事（11-10 ZCode）：
 * ① layoutOf 段查找按名字（obs5 的 seg[1]=attn，老代码 seg[1]=actEnc 的下标假设破——顺手把 obs3 族也改稳）
 * ② tapeForward 分发：obs5=注意力重放（每步从 tape.svs 重建，陈旧性结构上不存在）/ obs4=槽位重放（修复
 *    "尾块被换成 obs3 族 hSelf/mean/mx + 头部槽嵌入陈旧"的静默污染——kd-corruption-check.mjs 坐实的那条）/
 *    obs3 族=原路逐字不动（生产包零回归）
 * ③ tapeBackward 分发：obs5 注意力/PMA 解析反传（softmax 后向 = a·(dv̄−dp·p) 技巧）/ obs4 槽位路由（修复
 *    尾块梯度错路由）／obs3 族原路逐字不动。数值梯度腿兜底（scratch/obs4/numgrad5.mjs）。 */
const fs = require('fs');
const F = 'tools/proto2/pg-lib.mjs';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
  n++;
};

/* ① layoutOf：bias 改按段名 + is4/is5/AT/PM/selfDim 入 ly */
repRE(["    WS: segOf('seatEnc'), WA: segOf('actEnc'), WC: segOf('ctx'), WK: segOf('cand'), headOff: segOf('policyHead'),",
       "    seatBias: L.seg[0].off + L.seatH * L.seatIn, actBias: L.seg[1].off + L.actH * L.actIn,",
       "    ctxBias: L.seg[2].off + L.hid * L.ctxDim, candBias: L.seg[3].off + L.hid2 * L.candIn,"],
  ["    WS: segOf('seatEnc'), WA: segOf('actEnc'), WC: segOf('ctx'), WK: segOf('cand'), headOff: segOf('policyHead'),",
   "    /* 11-10：bias 一律按段名查——obs5 的 seg[1]=attn，按 [1] 取就拿到 attention 的偏移（对 obs3 族逐位同值） */",
   "    seatBias: segOf('seatEnc') + L.seatH * L.seatIn, actBias: segOf('actEnc') + L.actH * L.actIn,",
   "    ctxBias: segOf('ctx') + L.hid * L.ctxDim, candBias: segOf('cand') + L.hid2 * L.candIn,",
   "    is4: L.input === 'obs4', is5: L.input === 'obs5', selfDim: L.selfDim,"], 'P1');

/* ② tapeForward 分发 */
repRE(["export function tapeForward(tape, params, ly) {"],
  ["export function tapeForward(tape, params, ly) {",
   "  if (ly.is5) return tapeForward5(tape, params, ly);   /* obs5：注意力重放（陈旧性不存在：嵌入每步从 svs 重建） */",
   "  if (ly.is4) return tapeForward4(tape, params, ly);   /* obs4：槽位重放（11-10 修：旧路把尾块换成 obs3 族 hSelf/mean/mx 且头部槽嵌入冻结在 tape 里 = 污染） */"], 'P2');

/* ③ tapeBackward 分发 */
repRE(["export function tapeBackward(tape, params, ly, act, upstream, grad) {"],
  ["export function tapeBackward(tape, params, ly, act, upstream, grad) {",
   "  if (ly.is5) return tapeBackward5(tape, params, ly, act, upstream, grad);",
   "  if (ly.is4) return tapeBackward4(tape, params, ly, act, upstream, grad);"], 'P3');

/* ④ 文件尾追加四块新实现 */
const APPEND = `

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
`;
s = s.replace(/\n*$/, '\n') + APPEND;
fs.writeFileSync(F, s);
console.log('pg-lib obs5/obs4 完成 ' + n + ' 处 + 追加实现');
