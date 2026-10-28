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
import { scene as obs3Scene, candOf as obs3CandOf } from './obs3.mjs';

/* ---- 特征切片（一律从 `P.features` 切，不自己重算）----
 * FEAT_S 213 = base(63) ‖ 对手槽 4×10 ‖ 历史(我 4 + 对手 4×4) ‖ T 5×4 ‖ B 5×14
 * 这些偏移由 **selfTest** 核对（引擎加块时长度会变 ⇒ 自检必须当场红，而不是静默切错）。 */
const BASE = 63, OPP_BLK = 10, OPP_SLOTS = 4, HIST_ME = 4, T_BLK = 4, B_BLK = 14, PLAYER_SLOTS = 5;
const OFF_OPP = BASE;                                   // 对手 10 维块起点
const OFF_T = BASE + OPP_SLOTS * OPP_BLK + HIST_ME + OPP_SLOTS * 4;   // = 123
const OFF_B = OFF_T + PLAYER_SLOTS * T_BLK;             // = 143
const SEAT_DIM = OPP_BLK + T_BLK + B_BLK + 1;           // +1 = isSelf 标记 ⇒ 29

/* obs3 输入面的宽度（与 `tools/proto2/obs3.mjs` 同源：22 公开 + 5 关系 + 1 isSelf ‖ 5 全局 + 2 私有 + 48 序列 + 2 池化附加）*/
const SEAT3 = 22 + 5 + 1, SELF3_EXTRA = 5 + 2 + 48 + 2;
/* 初始化尺度**只允许一处定义**：`make` 与"相对变异"都要读它，两边各写一个数就会静默错位（10-29 加）。 */
const INIT_SCALE = 0.25;

export function layout(opts) {
  const o = opts || {};
  const input = o.input === 'obs3' ? 'obs3' : 'v7';
  const skills = Math.max(1, Number(o.skills) || 27);
  const seatH = Math.max(1, Number(o.seatH) || 16);
  const actH = Math.max(1, Number(o.actH) || 8);
  const hid = Math.max(1, Number(o.hid) || 32);
  const hid2 = Math.max(1, Number(o.hid2) || 24);
  const seatIn = input === 'obs3' ? SEAT3 : SEAT_DIM;
  const actIn = input === 'obs3' ? (31 + skills) : 22;
  const selfDim = input === 'obs3' ? SELF3_EXTRA : BASE + 3;   // v7：base(63)+桌子形状三条 ‖ obs3：全局+私有+序列+池化附加
  const ctxDim = selfDim + 2 * seatH;                    // 池化 = concat(mean, max) —— 这是 **ctx 层**的输入宽
  /* ⚠ 10-28 18:4x 自己抓到的布局 bug（字节对账逼出来的，不是看代码看出的）：
   *   原先写的是 `ctxDim + actH + seatH`，而真正喂进逐候选层的只有 **[hctx(hid) ‖ ae(actH) ‖ te(seatH)]**
   *   ⇒ 每单位多出 `selfDim + 2*seatH - hid` 列**恒零输入的死权重**（S1 默认档 = 66×24 ≈ 1584 个参数白占白算）。
   *   旧版每候选新建数组 ⇒ 尾部天然为 0，看不出来；改成复用缓冲后残留值让两次结果不一致，才把它照出来。
   *   ⇒ 宽度一律**由实际拼接项算**，并在 selftest 里加一条"尾列必须有牙"的构造对照（T8）。 */
  const candIn = hid + actH + (input === 'obs3' ? 2 * seatH : seatH);
  /* obs3 档把**两个目标槽**都拼进逐候选层（规则的target 上限就是 2，且镜面反射要区分 source/output）
   * ⇒ 目标身份 = 那一席自己的隐向量 h_t1 ⊕ h_t2，不再抄目标标量。 */
  const seg = [
    { name: 'seatEnc', off: 0, len: seatH * seatIn + seatH },
    { name: 'actEnc', off: 0, len: actH * actIn + actH },
    { name: 'ctx', off: 0, len: hid * ctxDim + hid },
    { name: 'cand', off: 0, len: hid2 * candIn + hid2 },
    { name: 'policyHead', off: 0, len: hid2 + 1 },
    { name: 'qHead', off: 0, len: hid + 1 },
  ];
  let off = 0;
  for (const s of seg) { s.off = off; off += s.len; }
  return {
    arch: input === 'obs3' ? 'S1o' : 'S1', input, skills, seatIn, actIn, initScale: INIT_SCALE,
    seatH, actH, hid, hid2, selfDim, ctxDim, candIn, seg, n: off,
    /* 每段的"扇入"—— 段感知变异要用它给 σ 定标（扇入越大、同样 σ 造成的输出扰动越大） */
    fanIn: { seatEnc: seatIn, actEnc: actIn, ctx: ctxDim, cand: candIn, policyHead: hid2, qHead: hid },
  };
}

export function paramCount(L) { return L.n; }

export function make(L, rng, scale) {
  const p = new Float64Array(L.n);
  const r = rng || Math.random;
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sc = scale || L.initScale || INIT_SCALE;
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
  /* 技能身份 one-hot 的宽度**由引擎给**（不让调用方手填 ⇒ 卡表变了自动跟着变，也不许两边写两个数） */
  const o2 = Object.assign({}, opts || {});
  if (!o2.skills) o2.skills = (R.skills && R.skills.length) || 27;
  const L = layout(o2);
  const OPT = { mutMode: String((opts && opts.mutMode) || 'seg'), temp: 0.6, mutRel: Number(opts && opts.mutRel) > 0 ? 1 : 0 };
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
  function forwardV7(state, pid, cands, params, opts2) {
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
    const phis = (opts2 && opts2.wantPhi) ? new Array(n) : null;   /* 蒸馏旁路：默认不建，零开销 */
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
      if (phis) phis[i] = Float64Array.from(hc);
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
    let phiRet = null;
    if (phis) { phiRet = new Float64Array(n * L.hid2); for (let i = 0; i < n; i++) phiRet.set(phis[i], i * L.hid2); }
    return { probs, argmax: arg, cand: cands[arg] || null, logits, q, phi: phiRet };
  }

  /* ===== obs3 输入面（`--input=obs3` ⇒ arch 标成 `S1o`）=====
   * 为什么单独一条函数而不是在 v7 那条里加分支：**v7 那条已经被 12 臂读数验证过**，
   *   往里塞 if 会让"同一份权重在两条路上是否逐位相同"变成要重新证明的事。复制一段尾巴换来的是一次不用解释的对照。
   * 与 v7 档的三处结构差别：
   *   ① 逐席向量来自 obs3 的 `scene()`（22 公开 + 5 相对我 + 1 isSelf），**不含任何决策时刻读不到的字段**；
   *   ② 目标身份 = 那一席的隐向量 h_t1 ⊕ h_t2（v7 档只有一个 h_t；两目标/镜面 source-output 都需要两槽）；
   *   ③ 候选侧 = obs3 的 base(31) ⊕ 技能身份 one-hot，不再吃 v7 那 22 维动作特征（里面有 15 枚结构性死维）。
   */
  function forwardObs3(state, pid, cands, params, opts2) {
    CNT.forwards++; CNT.cands += cands.length;
    const sc = obs3Scene(W, state, pid);
    const seatBias = L.seg[0].off + L.seatH * L.seatIn;
    const actBias = L.seg[1].off + L.actH * L.actIn;
    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;
    const candBias = L.seg[3].off + L.hid2 * L.candIn;
    const headOff = L.seg[4].off, qOff = L.seg[5].off;

    const svBuf = new Float64Array(L.seatIn);
    const enc = new Map();
    const mean = BUF.mean.fill(0), mx = BUF.mx.fill(0);
    for (const s of sc.seats) {
      let k = 0;
      for (let j = 0; j < 22; j++) svBuf[k++] = s.public[j];
      for (let j = 0; j < 5; j++) svBuf[k++] = s.rel[j];
      svBuf[k++] = s.isSelf;
      if (k !== L.seatIn) throw new Error('布局不自洽：逐席拼进 ' + k + ' 列而声明 seatIn=' + L.seatIn);
      const e = new Float64Array(L.seatH);
      encode(params, svBuf, L.seatIn, L.seatH, seatBias, e);
      enc.set(s.id, e);
      for (let j = 0; j < L.seatH; j++) { mean[j] += e[j]; if (e[j] > mx[j]) mx[j] = e[j]; }
    }
    const kk = Math.max(1, sc.seats.length);
    for (let j = 0; j < L.seatH; j++) mean[j] /= kk;

    const xin = new Float64Array(L.ctxDim);
    let p = 0;
    for (let i = 0; i < sc.g.length; i++) xin[p++] = sc.g[i];
    for (let i = 0; i < sc.priv.length; i++) xin[p++] = sc.priv[i];
    for (let i = 0; i < sc.seq.length; i++) xin[p++] = sc.seq[i];
    for (let i = 0; i < sc.sums.length; i++) xin[p++] = sc.sums[i];
    for (let j = 0; j < L.seatH; j++) xin[p++] = mean[j];
    for (let j = 0; j < L.seatH; j++) xin[p++] = mx[j];
    if (p !== L.ctxDim) throw new Error('布局不自洽：ctx 拼进 ' + p + ' 而声明 ' + L.ctxDim + '（seatH 改动后 selfDim 账要重算）');
    const hctx = encode(params, xin, L.ctxDim, L.hid, ctxBias, BUF.hctx);
    let q = params[qOff + L.hid]; for (let j = 0; j < L.hid; j++) q += params[qOff + j] * hctx[j];

    const n = cands.length, logits = new Float64Array(n);
    const phis = (opts2 && opts2.wantPhi) ? new Array(n) : null;   /* 蒸馏旁路：默认不建，零开销 */
    const afbuf = new Float64Array(L.actIn), ci = new Float64Array(L.candIn), zeroSeat = BUF.zeroSeat;
    for (let i = 0; i < n; i++) {
      const cp = obs3CandOf(sc, cands[i]);
      let m2 = 0;
      for (let j = 0; j < cp.base.length; j++) afbuf[m2++] = cp.base[j];
      for (let j = 0; j < cp.idOne.length; j++) afbuf[m2++] = cp.idOne[j];
      if (m2 !== L.actIn) throw new Error('布局不自洽：actEnc 拼进 ' + m2 + ' 而声明 actIn=' + L.actIn + ' ⇒ 差 ' + Math.abs(L.actIn - m2) + ' 列**死权重**（skills=' + L.skills + '）');
      const ae = encode(params, afbuf, L.actIn, L.actH, actBias, BUF.ae);
      const t1 = cands[i].target == null ? null : cands[i].target;
      const t2 = cands[i].target2 == null ? null : cands[i].target2;
      const te1 = t1 != null && enc.has(t1) ? enc.get(t1) : zeroSeat;
      const te2 = t2 != null && enc.has(t2) ? enc.get(t2) : zeroSeat;
      ci.set(hctx, 0); ci.set(ae, L.hid); ci.set(te1, L.hid + L.actH); ci.set(te2, L.hid + L.actH + L.seatH);
      if (hctx.length + ae.length + te1.length + te2.length !== L.candIn) {
        throw new Error('布局不自洽：逐候选层拼进 ' + (hctx.length + ae.length + te1.length + te2.length) +
          ' 列而声明 candIn=' + L.candIn + ' ⇒ 差 ' + Math.abs(L.candIn - hctx.length - ae.length - te1.length - te2.length) + ' 列**死权重**');
      }
      const hc = encode(params, ci, L.candIn, L.hid2, candBias, BUF.hc);
      if (phis) phis[i] = Float64Array.from(hc);
      let v = params[headOff + L.hid2];
      for (let j = 0; j < L.hid2; j++) v += params[headOff + j] * hc[j];
      logits[i] = v;
    }
    /* 两级 softmax：**逐字抄 v7 那条尾**（技能层用 bestOf 归一，再在技能内部 softmax）。
     *   ⚑ 10-29 我自己差点在这里出事：第一版凭记忆写了一遍尾，把 logits 就地改写又拿去算 probs ⇒ 与 v7 不同式，
     *   那条"可比性"就没了。现在是复制粘贴，不是回忆。 */
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
    let phiRet = null;
    if (phis) { phiRet = new Float64Array(n * L.hid2); for (let i = 0; i < n; i++) phiRet.set(phis[i], i * L.hid2); }
    return { probs, argmax: arg, cand: cands[arg] || null, logits, q, phi: phiRet };
  }
  function forwardCands(state, pid, cands, params, opts2) {
    return L.input === 'obs3' ? forwardObs3(state, pid, cands, params, opts2) : forwardV7(state, pid, cands, params, opts2);
  }

  /* ===== 蒸馏旁路：把 v7 的策略**装进 2.0 的最后一层**（fit2.mjs 用；10-29 夜）=====
   * 只拟合 policyHead（含偏置），上游四段全冻 ⇒ 闭式岭回归，不写反传、不动任何已验证的算术。
   * 它回答的是**容量**而不是"训练效果"：装不下 ⇒ 结构要改；装得下 ⇒ 优化器臂终于有一个非随机起点。
   * ⚑ 目标 logits 取 `P.forward`（v7 那条，2.0 从没覆盖它）⇒ 参照就是现役冠军自己那台打分器，不是我重写的一份。 */
  function distillHead(states, params, o) {
    const opts3 = o || {};
    const TR = W.EpirusTrainer;
    const l2 = Math.max(1e-6, Number(opts3.l2) || 1e-2);
    /* 目标 = v7 的**逐候选**分数。⚑ 不能用 `P.forward`：那条回的是"动作键层"的 probs（~22 个槽，
     *   `ACT_KEYS` 口径），拿它按下标跟候选列表比 = 苹果对橘子（10-29 01:1x 我就差一点把 94% 的假一致率当真）。
     *   逐候选的口径是 `P.value(state,pid,key,params,bead,cand)`（`probe-myopia-regret` 用的就是它，
     *   §E815 也对过账）。 */
    const v7Centered = (state, pid, cands) => {
      const raw = [], keep = [];
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        const v = P.value(state, pid, c.key, opts3.v7, c.bead || null, c);
        if (!Number.isFinite(v)) continue;                 /* ⚑ 丢**这一枚候选**，不丢整组（第一版 return null 把整组扔掉 ⇒ 分母从万级掉到 1227） */
        raw.push(v); keep.push(i);
      }
      if (keep.length < 2) return null;
      let mu = 0; for (let i = 0; i < raw.length; i++) mu += raw[i] / raw.length;
      return { tgt: raw.map((x) => x - mu), keep };
    };
    const rows = [], ys = [];
    for (const fx of states) {
      const cands = P.candidatesFor(fx.state, fx.pid, TR.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
      if (!cands || cands.length < 2) continue;
      const f2 = forwardCands(fx.state, fx.pid, cands, params, { temp: 0.5, wantPhi: true });
      const t = v7Centered(fx.state, fx.pid, cands);
      if (!f2.phi || !t) continue;
      for (let i = 0; i < t.keep.length; i++) {
        const ci = t.keep[i];
        rows.push(f2.phi.subarray(ci * L.hid2, (ci + 1) * L.hid2));
        ys.push(t.tgt[i]);
      }
    }
    if (!rows.length) return { ok: false, why: '没有可用行（候选 <2 或 phi/target 取不到）' };
    const D = L.hid2 + 1, n = rows.length;
    const A = Array.from({ length: D }, () => new Float64Array(D + 1));
    for (let i = 0; i < n; i++) {
      const z = new Float64Array(D); for (let j = 0; j < L.hid2; j++) z[j] = rows[i][j]; z[L.hid2] = 1;
      for (let p = 0; p < D; p++) { A[p][D] += z[p] * ys[i]; for (let q = 0; q < D; q++) A[p][q] += z[p] * z[q]; }
    }
    for (let p = 0; p < D; p++) A[p][p] += l2 * n;
    for (let c = 0; c < D; c++) {
      let piv = c; for (let r = c + 1; r < D; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) continue;
      const t = A[c]; A[c] = A[piv]; A[piv] = t;
      const d = A[c][c]; for (let k = c; k <= D; k++) A[c][k] /= d;
      for (let r = 0; r < D; r++) { if (r === c) continue; const f = A[r][c]; if (!f) continue; for (let k = c; k <= D; k++) A[r][k] -= f * A[c][k]; }
    }
    const out = Float64Array.from(params);
    const headOff = L.seg[4].off;
    for (let j = 0; j < L.hid2; j++) out[headOff + j] = A[j][D];
    out[headOff + L.hid2] = A[L.hid2][D];
    /* ⚑ 这里**不自评**：拟合的人顺手打分就是"在训练集上报一致率"。判定一律交给调用方的留出半批（fit2）。 */
    return { ok: true, params: out, rows: n };
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
    /* ⭐ `mutRel=1`（10-29 加）：**σ 变成"相对初始化尺度的步长"**，对每个坐标都用它自己那一段的 init std 定标。
     * 动因（B1 的实测，不是推测）：60000 局、`fxGames=30` 的那条臂里，1/5 律把 σ 从 0.2 一路缩到 **0.0001**
     *   才停下 ⇒ 因为旧口径下**偏置**段拿的是原 σ（0.2）而它的初始化尺度只有 0.25/√fanIn ≈ 0.02
     *   算出来的比值：`make` 给**每个**坐标（含偏置）的 init std = 0.25/√fanIn，而旧变异给偏置的是**原 σ**
     *   ⇒ σ=0.2 时偏置一步 = 自身 init 尺度的 0.8·√fan 倍（ctx 段 fan=113 ⇒ 8.5× ‖ qHead 4.5× ‖ policyHead 3.9×），
     *   权重段却只有 0.8× ⇒ 有一段被反复打散。**注意这一步是"为什么 σ 会崩"的解释**（B1 只给了 σ 崩 + 6/30 接受这两个事实，
     *   没给"打散偏置导致适应度不涨"的证据 ⇒ 这条要由 mutRel 那条臂来判，别提前当结论引用）。
     *   权重段虽然有 1/√fanIn 定标，但 σ 与"当前权重量级"无关，训练后期权重长大了同 σ 的相对扰动就越来越小。 */
    if (OPT.mutRel) {
      for (const s of L.seg) {
        const k = (L.initScale / Math.sqrt(Math.max(1, L.fanIn[s.name]))) * sigma;
        for (let i = s.off; i < s.off + s.len; i++) q[i] += gauss() * k;
      }
      return q;
    }
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

  /* ---- 容器：显式带 arch + dims（**不再从长度反推形状** —— 那是 v7 的 shapeOf 病） ----
   * ⚑ 10-29 01:5x 抓到：这里原先硬写 `arch: 'S1'`，S1o（吃 obs3，5650 条）产出的包也被打成 S1
   *   ⇒ 下游按 `arch` 选输入面的尺（profile2）会拿错的那张脸去读。长度不同（5258≠5650）只挡住了"unpack 成功"，
   *   挡不住"有人照 arch 装错档再按长度报错"这种绕路。⇒ 标签一律**由实际布局写**，读的时候当场对账。 */
  function pack(p) {
    return { v: 90, arch: L.arch, dims: { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input }, a: Array.from(p), n: L.n };
  }
  function unpack(o) {
    if (!o || !Array.isArray(o.a) || o.a.length !== L.n || o.v !== 90) return null;
    if (o.arch && o.arch !== L.arch) return null;            /* 标签对不上 ⇒ 宁可读不出，不要静默错切 */
    const q = new Float64Array(L.n);
    for (let i = 0; i < L.n; i++) q[i] = o.a[i];
    return q;
  }
  function checkPack(o) {
    if (!o || !Array.isArray(o.a)) return { ok: false, reason: 'missing' };
    if (o.v !== 90) return { ok: false, reason: 'version', got: o.v, want: 90 };
    if (o.a.length !== L.n) return { ok: false, reason: 'length', got: o.a.length, want: L.n };
    if (o.arch && o.arch !== L.arch) return { ok: false, reason: 'arch', got: o.arch, want: L.arch };
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
  P.__arch2 = { L, OPT, rngRef, CNT, forwardCands, chooseCandidates, distillHead, restore() { for (const k of OVERRIDES) P[k] = prev[k]; delete P.__arch2; } };
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
