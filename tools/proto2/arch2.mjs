/* ===== 冠军包 2.0 架构原型（研究分支专用，10-28 傍晚 · 千问）=====
 *
 * 为什么存在：§E815/§E817/§E819/§E819b 把 v7 那一层"单标量头 + 4 槽补零"量到头了 ——
 *   容量没压满（等效维数低于随机包）、组内排序买不到、种群开大之后当选面变成抽签。
 *   用户 10-28 的话：**"要选对新模型结构最好的优化器，不要跑回去优化 v7"** ⇒ 必须先把 2.0 的结构
 *   真的搭出来，优化器只在这些新结构上比。
 *
 * ⚑ **这一版是研究原型，不是产品装配**：`js/**` 一字未动（规则指纹因此不变）。
 *   接入方式是在**训练进程内**覆盖 `window.EpirusPolicy` 的几个入口（paramCount/makePolicy/
 *   forwardCands/chooseCandidates/pack/unpack/checkPack/mutatePolicy/crossover），
 *   于是 `EpirusTrainer.scoreMemberN` 那套"发局 / 座位轮转 / playoff / 名人堂"**全部原样单源复用**
 *   —— 本仓的老病是"两份同构算术必漂移"，所以宁可覆盖入口，也不另写一台评估器。
 *
 * 三条结构决定（对应主文档 §三 的 A/B/C）：
 *   (A) **席位 = 集合，不是槽位**：每个存活玩家过**同一个** seat encoder，再按 mean+max 池化
 *       ⇒ 人数从 2 到 10 都是同一段权重（v7 是 4 个固定槽 + 补零，换桌形靠的是槽序而不是语义）。
 *   (B) **动作 = 独立编码器**（v7 把动作段与状态段拼在同一个隐层行里 ⇒ 动作与状态没有各自的深度）。
 *   (C) **输出两头**：逐候选打分头（只管组内排序）+ 一个**不参与组内排序**的 `Q(s)` 头
 *       （§E819b 的教训：整局结果与组内判别力在六枚包上互相分不开，得让两头各自有去处）。
 *
 * ⚠ 与 v7 的**可比性条款**（引用这批产物必带）：
 *   ① 候选集仍由引擎的 `P.candidatesFor` 给（口径同源，改结构不改"有哪些手可选"）；
 *   ② 采样仍是 v7 那套**两级 softmax**（先技能层、再该技能内部），`temp` 语义不变；
 *   ③ 适应度/playoff 仍走 `T.scoreMemberN`/`T.evalN` ⇒ `1st%`/`top2%` 与 §E818 五臂同尺可比；
 *   ④ **评估次数**是预算，不是墙钟 —— 2.0 的前向比 v7 贵，同 evals 下更慢，横比只比 evals。
 */
import { readFileSync } from 'node:fs';

/* ---- 特征切片（一律从 `P.features` 切，不自己重算）----
 * FEAT_S 213 = base(63) ‖ 对手槽 4×10 ‖ 历史(我 4 + 对手 4×4) ‖ T 5×4 ‖ B 5×14
 * 这些偏移由 **selfTest** 核对（引擎加块时长度会变 ⇒ 自检必须当场红，而不是静默切错）。 */
const BASE = 63, OPP_BLK = 10, OPP_SLOTS = 4, HIST_ME = 4, T_BLK = 4, B_BLK = 14, PLAYER_SLOTS = 5;
const OFF_OPP = BASE;                                   // 对手 10 维块起点
const OFF_T = BASE + OPP_SLOTS * OPP_BLK + HIST_ME + OPP_SLOTS * 4;   // = 123
const OFF_B = OFF_T + PLAYER_SLOTS * T_BLK;             // = 143
const SEAT_DIM = OPP_BLK + T_BLK + B_BLK + 1;           // +1 = isSelf 标记 ⇒ 29

export function layout(opts) {
  const o = opts || {};
  const seatH = Math.max(1, Number(o.seatH) || 16);
  const actH = Math.max(1, Number(o.actH) || 8);
  const hid = Math.max(1, Number(o.hid) || 32);
  const hid2 = Math.max(1, Number(o.hid2) || 24);
  const selfDim = BASE + 3;                              // base(63) + 桌子形状三条（存活数/席位数/回合）
  const ctxDim = selfDim + 2 * seatH;                    // 池化 = concat(mean, max) —— 这是 **ctx 层**的输入宽
  /* ⚠ 10-28 18:4x 自己抓到的布局 bug（字节对账逼出来的，不是看代码看出的）：
   *   原先写的是 `ctxDim + actH + seatH`，而真正喂进逐候选层的只有 **[hctx(hid) ‖ ae(actH) ‖ te(seatH)]**
   *   ⇒ 每单位多出 `selfDim + 2*seatH - hid` 列**恒零输入的死权重**（S1 默认档 = 66×24 ≈ 1584 个参数白占白算）。
   *   旧版每候选新建数组 ⇒ 尾部天然为 0，看不出来；改成复用缓冲后残留值让两次结果不一致，才把它照出来。
   *   ⇒ 宽度一律**由实际拼接项算**，并在 selftest 里加一条"尾列必须有牙"的构造对照（T8）。 */
  const candIn = hid + actH + seatH;
  const seg = [
    { name: 'seatEnc', off: 0, len: seatH * SEAT_DIM + seatH },
    { name: 'actEnc', off: 0, len: actH * 22 + actH },
    { name: 'ctx', off: 0, len: hid * ctxDim + hid },
    { name: 'cand', off: 0, len: hid2 * candIn + hid2 },
    { name: 'policyHead', off: 0, len: hid2 + 1 },
    { name: 'qHead', off: 0, len: hid + 1 },
  ];
  let off = 0;
  for (const s of seg) { s.off = off; off += s.len; }
  return {
    arch: 'S1', seatH, actH, hid, hid2, selfDim, ctxDim, candIn, seg, n: off,
    /* 每段的"扇入"—— 段感知变异要用它给 σ 定标（扇入越大、同样 σ 造成的输出扰动越大） */
    fanIn: { seatEnc: SEAT_DIM, actEnc: 22, ctx: ctxDim, cand: candIn, policyHead: hid2, qHead: hid },
  };
}

export function paramCount(L) { return L.n; }

export function make(L, rng, scale) {
  const p = new Float64Array(L.n);
  const r = rng || Math.random;
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sc = scale || 0.25;
  for (const s of L.seg) {
    const fan = L.fanIn[s.name];
    /* He-ish 定标：按 1/sqrt(fanIn) 而非全局同 σ ⇒ 各段初始输出尺度可比
     * （这也是"段感知"优化的前提：flat 变异在 5,000 维混结构上会让大扇入段 dominating）。 */
    const k = sc / Math.sqrt(Math.max(1, fan));
    for (let i = s.off; i < s.off + s.len; i++) p[i] = gauss() * k;
  }
  return p;
}

/* ---- 装配：把 2.0 装进一个已经建好沙箱的进程 ---- */
export function install(W, opts) {
  const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules;
  if (!P || !P.features) throw new Error('install: 沙箱里没有 EpirusPolicy.features');
  const L = layout(opts);
  const OPT = { mutMode: String((opts && opts.mutMode) || 'seg'), temp: 0.6 };
  const CNT = { forwards: 0, cands: 0 };   // 吞吐记账（见 forwardCands 那条注释）
  const rngRef = { r: Math.random };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rngRef.r(); while (v === 0) v = rngRef.r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const relu = (x) => x > 0 ? x : 0;

  /* 席位向量：slot 0 = 自己（10 维对手块位置填 0 + isSelf=1），1..4 = 对手 */
  function seatVecs(state, pid, fs) {
    const out = [];
    const slotPids = P.oppSlots(state, pid);
    for (let i = 0; i < PLAYER_SLOTS; i++) {
      const qid = i === 0 ? pid : slotPids[i - 1];
      if (qid == null || state.p[qid].hp <= 0) continue;      // ⭐ 死席**不进集合**（v7 是补零进向量）
      const v = new Float64Array(SEAT_DIM);
      let k = 0;
      if (i !== 0) for (let j = 0; j < OPP_BLK; j++) v[k++] = fs[OFF_OPP + (i - 1) * OPP_BLK + j];
      else k += OPP_BLK;                                       // 自己的"对手块"留空 ⇒ 靠 isSelf 区分
      for (let j = 0; j < T_BLK; j++) v[k++] = fs[OFF_T + i * T_BLK + j];
      for (let j = 0; j < B_BLK; j++) v[k++] = fs[OFF_B + i * B_BLK + j];
      v[k] = i === 0 ? 1 : 0;
      out.push({ slot: i, pid: qid, v: v });
    }
    return out;
  }

  /* 写进调用方给的缓冲（**逐条与旧版同序同加法** ⇒ 输出必须逐位相同；这条由 `--targetGames` 前后对账验）
   * 为什么要省掉分配：一次决策要打分 40–80 个候选，旧版每个候选新建 3 个 Float64Array ⇒
   *   一局几百次决策 × 每臂两千局 = 纯垃圾回收。吞吐那一格的第一个便宜项就在这里。 */
  function encode(p, x, inDim, outDim, biasOff, out) {
    for (let j = 0; j < outDim; j++) {
      let s = p[biasOff + j];
      const base = j * inDim;
      for (let i = 0; i < inDim; i++) s += p[base + i] * x[i];
      out[j] = s > 0 ? s : 0;   // ReLU
    }
    return out;
  }

  /* 每次决策复用的缓冲（省分配；不改任何算术顺序） */
  const BUF = {
    seat: new Float64Array(L.seatH),
    mean: new Float64Array(L.seatH),
    mx: new Float64Array(L.seatH),
    self: new Float64Array(L.selfDim),
    xin: new Float64Array(L.ctxDim),
    hctx: new Float64Array(L.hid),
    af: new Float64Array(22),
    ae: new Float64Array(L.actH),
    ci: new Float64Array(L.candIn),
    hc: new Float64Array(L.hid2),
    zeroSeat: new Float64Array(L.seatH),
  };

  /* 逐候选打分 + Q(s)；返回与 v7 同形状的 {probs, argmax, cand, logits, q} */
  function forwardCands(state, pid, cands, params, opts2) {
    /* §E822 吞吐记账：横比的货币应该是**决策数与候选打分次数**，不是"局数"——
     *   赢面越高的包局越长（实测同 2000 局，GA 臂墙钟是 CEM 的 30 倍），只报局数会把"变强"读成"变慢"。 */
    CNT.forwards++; CNT.cands += cands.length;
    const fs = P.features(state, pid, P.FEAT_S);
    const seats = seatVecs(state, pid, fs);
    const seatBias = L.seg[0].off + L.seatH * SEAT_DIM;
    const actBias = L.seg[1].off + L.actH * 22;
    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;
    const candBias = L.seg[3].off + L.hid2 * L.candIn;
    const headOff = L.seg[4].off, qOff = L.seg[5].off;

    /* (A) 席位各自过**同一个** encoder ⇒ 池化（mean + max）—— 与顺序无关。
     *     每个席位仍要一份自己的编码（不能复用同一块缓冲：池化要留着逐席读）。 */
    const enc = new Map();
    const mean = BUF.mean.fill(0), mx = BUF.mx.fill(0);
    const seatBufs = [];
    for (let s = 0; s < seats.length; s++) {
      const e = new Float64Array(L.seatH);
      encode(params, seats[s].v, SEAT_DIM, L.seatH, seatBias, e);
      enc.set(seats[s].pid, e); seatBufs.push(e);
      for (let j = 0; j < L.seatH; j++) { mean[j] += e[j]; if (e[j] > mx[j]) mx[j] = e[j]; }
    }
    const kk = Math.max(1, seats.length);
    for (let j = 0; j < L.seatH; j++) mean[j] /= kk;

    /* 上下文（不含动作）⇒ Q(s) 与两头的公共前缀 */
    const self = BUF.self;
    for (let i = 0; i < BASE; i++) self[i] = fs[i];
    let nAlive = 0; for (let i = 0; i < state.p.length; i++) if (state.p[i].hp > 0) nAlive++;
    self[BASE] = nAlive / 10; self[BASE + 1] = (seats.length - 1) / 4; self[BASE + 2] = Math.min(1, (state.round || 0) / 12);
    const xin = BUF.xin;
    for (let i = 0; i < L.selfDim; i++) xin[i] = self[i];
    for (let j = 0; j < L.seatH; j++) { xin[L.selfDim + j] = mean[j]; xin[L.selfDim + L.seatH + j] = mx[j]; }
    const hctx = encode(params, xin, L.ctxDim, L.hid, ctxBias, BUF.hctx);
    /* ⚑ **布局自洽不变量**（10-28 傍晚那次死权重事故之后，这条是硬要求，不是注释）：
     *   声明宽度必须等于真正拼进去的长度 —— 差一列就是"白占 + 白算 + 静默错位"。 */
    if (xin.length !== L.ctxDim) throw new Error('布局不自洽：ctx 层拼进 ' + xin.length + ' 而声明 ' + L.ctxDim);
    let q = params[qOff + L.hid]; for (let j = 0; j < L.hid; j++) q += params[qOff + j] * hctx[j];

    const n = cands.length, logits = new Float64Array(n);
    const afbuf = BUF.af, ci = BUF.ci, ae = BUF.ae, zeroSeat = BUF.zeroSeat;
    for (let i = 0; i < n; i++) {
      const c = cands[i];
      const af = P.actionFeatures(state, pid, c.key, c);
      for (let j = 0; j < 22; j++) afbuf[j] = j < af.length ? af[j] : 0;
      encode(params, afbuf, 22, L.actH, actBias, ae);
      /* (A 的兑现) 目标身份是**一段席位编码**，不是 v7 那几个"目标 hp/ep"标量 */
      const tpid = c.target == null ? null : c.target;
      const te = tpid != null && enc.has(tpid) ? enc.get(tpid) : zeroSeat;
      ci.set(hctx, 0); ci.set(ae, L.hid); ci.set(te, L.hid + L.actH);
      /* ⚑ 就是这一条抓到了 1584 个死权重（声明 122 列、真正拼进去 56 列）⇒ 缺它就得重犯。 */
      if (hctx.length + ae.length + te.length !== L.candIn) {
        throw new Error('布局不自洽：逐候选层拼进 ' + (hctx.length + ae.length + te.length) +
          ' 列而声明 candIn=' + L.candIn + ' ⇒ 差 ' + Math.abs(L.candIn - hctx.length - ae.length - te.length) + ' 列**死权重**（白占参数还白算）');
      }
      const hc = encode(params, ci, L.candIn, L.hid2, candBias, BUF.hc);
      let v = params[headOff + L.hid2];
      for (let j = 0; j < L.hid2; j++) v += params[headOff + j] * hc[j];
      logits[i] = v;
    }
    /* 两级采样：与 v7 `forwardCands` 同式（技能层取条目最大值归一，再在该技能内部 softmax） */
    const temp = (opts2 && opts2.temp) || OPT.temp;
    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }
    let kmax = -1e9;
    for (const k of keys) if (bestOf[k] > kmax) kmax = bestOf[k];
    let ktot = 0;
    for (const k of keys) { kProb[k] = Math.exp((bestOf[k] - kmax) / temp); ktot += kProb[k]; }
    for (const k of keys) kProb[k] = ktot > 0 ? kProb[k] / ktot : 0;
    for (let i = 0; i < n; i++) { const k = cands[i].key; kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }
    const probs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;
      probs[i] = kProb[k] * within;
    }
    let arg = 0, best = -1e9;
    for (let i = 0; i < n; i++) if (logits[i] > best) { best = logits[i]; arg = i; }
    return { probs, argmax: arg, cand: cands[arg] || null, logits, q };
  }

  function chooseCandidates(state, pid, cands, params, opts2) {
    const SK = R.SK;
    if (!cands || !cands.length) return { key: SK.JI, target: null, target2: null, bead: null };
    const f = forwardCands(state, pid, cands, params, { temp: opts2 && opts2.temp != null ? opts2.temp : 0.5 });
    let r = (opts2 && opts2.greedy) ? 0 : state.rng.next();
    if (r >= 1) r = 0.999999;
    let acc = 0;
    for (let i = 0; i < f.probs.length; i++) { acc += f.probs[i]; if (r < acc) return cands[i]; }
    return cands[f.argmax] || cands[0];
  }

  /* ---- 段感知变异 / 交叉（优化器×结构这一格的主角）---- */
  function biasLen(s) {
    /* 每段末尾是 bias 向量（head 段是 1 个标量） ⇒ 长度 = 该段输出维 */
    const outDim = { seatEnc: L.seatH, actEnc: L.actH, ctx: L.hid, cand: L.hid2, policyHead: 1, qHead: 1 };
    return outDim[s.name] || 1;
  }
  function mutatePolicy(p, sigma) {
    const q = p.slice();
    if (OPT.mutMode === 'flat') { for (let i = 0; i < q.length; i++) q[i] += gauss() * sigma; return q; }
    /* 权重按 1/sqrt(fanIn) 定标、偏置用原 σ ⇒ "同样一个 σ"在各段造成的输出扰动才同量级
     * （flat 变异在混结构上会被大扇入段 dominate —— 这正是本波要测的差）。 */
    for (const s of L.seg) {
      const k = sigma / Math.sqrt(Math.max(1, L.fanIn[s.name]));
      const biasStart = s.off + s.len - biasLen(s);
      for (let i = s.off; i < s.off + s.len; i++) q[i] += gauss() * (i >= biasStart ? sigma : k);
    }
    return q;
  }
  function crossover(a, b) {
    const c = new Float64Array(a.length);
    if (OPT.mutMode === 'flat') { for (let i = 0; i < c.length; i++) c[i] = rngRef.r() < 0.5 ? a[i] : b[i]; return c; }
    /* 段级交叉：整段继承某一方 ⇒ 保留"每段各自已校准的尺度"，不打散结构 */
    for (const s of L.seg) {
      const from = rngRef.r() < 0.5 ? a : b;
      for (let i = s.off; i < s.off + s.len; i++) c[i] = from[i];
    }
    return c;
  }

  /* ---- 容器：显式带 arch + dims（**不再从长度反推形状** —— 那是 v7 的 shapeOf 病） ---- */
  function pack(p) {
    return { v: 90, arch: 'S1', dims: { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2 }, a: Array.from(p), n: L.n };
  }
  function unpack(o) {
    if (!o || !Array.isArray(o.a) || o.a.length !== L.n || o.v !== 90) return null;
    const q = new Float64Array(L.n);
    for (let i = 0; i < L.n; i++) q[i] = o.a[i];
    return q;
  }
  function checkPack(o) {
    if (!o || !Array.isArray(o.a)) return { ok: false, reason: 'missing' };
    if (o.v !== 90) return { ok: false, reason: 'version', got: o.v, want: 90 };
    if (o.a.length !== L.n) return { ok: false, reason: 'length', got: o.a.length, want: L.n };
    return { ok: true };
  }

  const prev = {};
  const OVERRIDES = ['paramCount', 'makePolicy', 'mutatePolicy', 'crossover', 'pack', 'unpack', 'checkPack',
    'forwardCands', 'chooseCandidates', 'shapeOf', 'value'];
  for (const k of OVERRIDES) prev[k] = P[k];
  P.paramCount = () => L.n;
  P.makePolicy = (scale) => make(L, rngRef.r, scale);
  P.mutatePolicy = mutatePolicy;
  P.crossover = crossover;
  P.pack = pack;
  P.unpack = unpack;
  P.checkPack = checkPack;
  P.forwardCands = forwardCands;
  P.chooseCandidates = chooseCandidates;
  /* ⭐ **接线这一格是今天栽回去的地方**（10-28 晚，三波读数作废换来的）：
   *   `evo.js:21` 的 `LEGACY(params)` 写的是 `const sh = P.shapeOf(params); return !sh || sh.legacy === true;`
   *   ⇒ 2.0 的向量长度在 v7 的 `shapeOf` 表里查不到 ⇒ 返回 null ⇒ **判成"旧包"走旧口径**
   *     （`P.choose` + 脚本 `pickTargetN` 选目标），我覆盖的 `chooseCandidates/forwardCands` 一次都没被叫到，
   *     而 `fit` 照样出数、臂照样跑完 ⇒ "没崩"与"接上了"同形。
   *   修法：给 2.0 形状一个**显式**的 shapeOf（`legacy:false` ⇒ 走现代分支 = 候选体系），
   *   并把 `P.value` 这种"按 v7 偏移切片"的入口对 2.0 向量**当场抛**（宁可崩，不要静默错切）。 */
  P.shapeOf = function (params) {
    if (params && params.length === L.n) return { featS: L.selfDim, featA: L.actH, featN: L.ctxDim, legacy: false, arch2: true };
    return prev.shapeOf ? prev.shapeOf(params) : null;
  };
  P.value = function () {
    const params = arguments[3];
    if (params && params.length === L.n) {
      throw new Error('2.0 结构没有 v7 那种 (s,a) 单点 value()：请用 EpirusPolicy.forwardCands（逐候选集合打分）。' +
        '走到这里说明有代码在按 v7 偏移切 2.0 权重 ⇒ 宁可当场抛，不许静默错切。');
    }
    return prev.value.apply(null, arguments);
  };
  P.__arch2 = { L, OPT, rngRef, CNT, forwardCands, chooseCandidates, restore() { for (const k of OVERRIDES) P[k] = prev[k]; delete P.__arch2; } };
  return P.__arch2;
}

/* ===== 接线自证（今天最贵的一格，写成一条可复跑的闸）=====
 * 只验"装上了、没崩"是不够的：三波作废的读数全都"没崩"。这条要的是**证据**：
 *   真打一局 ⇒ 2.0 的 forwardCands 必须被叫到（CNT 增加），且 `P.chooseCandidates` 走的是我这版。
 * 任何一处不成立 ⇒ 抛（训练工具里调用它 ⇒ 直接开不了臂，比跑完 40 分钟再发现强）。 */
export function verifyWired(W, A, opts) {
  const o = opts || {};
  const T = W.EpirusTrainer, P = W.EpirusPolicy, Play = W.EpirusPlay, R = W.EpirusRules, S = W.EpirusState;
  const before = A.CNT.forwards;
  let seed = 991;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const p = P.makePolicy(0.25);
  let ccCalls = 0;
  const realCC = P.chooseCandidates;
  P.chooseCandidates = function () { ccCalls++; return realCC.apply(this, arguments); };
  /* 校准局**不许改变桌形**：先读回、用完还原（否则"验一下接线"这件事本身会把臂的口径挪走） */
  const modeWas = T.trainMode ? T.trainMode() : null;
  if (o.mode && T.setTrainMode) T.setTrainMode(o.mode);
  const r = T.scoreMemberN(p, T.buildOpps(p, 0.05), Number(o.games || 1), Number(o.n || 5), 0, 0, 0);
  if (modeWas && T.setTrainMode) T.setTrainMode(modeWas);
  P.chooseCandidates = realCC;
  const dForwards = A.CNT.forwards - before;
  const out = { forwards: dForwards, chooseCandidatesCalls: ccCalls, fit: r && r.fit };
  if (!(dForwards > 0 && ccCalls > 0)) {
    throw new Error('2.0 接线没生效：跑了一局但 forwardCands 被叫 ' + dForwards + ' 次、chooseCandidates ' + ccCalls +
      ' 次 ⇒ 训练环在走 v7/旧口径分支 ⇒ **本批不许开跑**（今天三波作废读数的同一个根因，见 arch2 里 shapeOf 那条注释）。');
  }
  void S; void Play; void R;
  return out;
}
