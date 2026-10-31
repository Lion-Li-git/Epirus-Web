/* EpirusPolicy2 — 冠军包 2.0（代 2）的**浏览器侧**打分器（千问 · 10-30 晚，用户点名"可以把解码分支进 js"）
 *
 * 为什么单独一个文件而不是往 `policy.js` 里加分支：2.0 的网络是"席位集合编码 + 池化 + 独立动作编码"，
 *   与 v7 那套"单标量头 + 4 槽补零"没有共享的一行算术；混进去会把"v7 路径逐字不变"变成要重新证明的事。
 * ⚑ **规则内核一行未动**（`js/core/**` 不碰 ⇒ 规则指纹不变），本文件只做"读局面 → 出分数"。
 *
 * 与训练侧的**同源条款**（`tools/proto2/arch2.mjs` + `obs3.mjs`）：
 *   逐候选的算术顺序、池化口径（`h_self ‖ mean(对手) ‖ max(对手)`）、段偏移的读法全部照抄，不"凭记忆重写"
 *   —— 这条在 10-29 咬过我一次（凭记忆抄采样尾 ⇒ 与 v7 不同式）。验收由 `tools/proto2/browser-parity.mjs` 做：
 *   **同一枚包 + 同一批真局决策点 ⇒ 浏览器侧与训练侧的 logits 必须逐位相同**。
 *
 * 段表**不由本文件重算**，而是拿包里的 `layout.seg` 与由 `dims` 推出来的宽度**互相对账**：
 *   对不上就拒读（返回 null 并印原因），绝不"按长度猜形状"——那是 v7 的 `shapeOf` 病，也是代 1 那 47.6% 死权重的家。
 */
(function (global) {
  'use strict';

  const V_GEN3 = 92;                       // 代 3 = v:92（键层按决策键分组 + 无价值头；与 arch2 的 V_FOR_GEN[3] 同值）
  /* ⚑ 代 2（v:91）随 qHead 一起在 Stage B 退役：段表变了 ⇒ 同一个 v 会指两种网络，那正是版本门要挡的形状。
   *   旧包在这里**拒读**（reason 'version'/'gen'），要复算旧读数就 checkout 删 qHead 前那一笔用当时的尺跑。 */
  const GEN = 3;
  const SEAT_IN = 22 + 5 + 1;              // obs3 逐席：22 公开 ‖ 5 关系 ‖ 1 isSelf
  const SEAT_IN_B = 81 + 5 + 1;            // obs3b 逐席：81 公开（14 状态+30 键身份+1 none+3 目标+30 键 bag+3 目标 bag）
  const SELF_DIM = 5 + 2 + 48 + 1;         // obs3 局面侧：G(5) ‖ 私有(2) ‖ 序列(48) ‖ 全场合计(1，代 2 删了 pool.count)
  const SELF_DIM_B = 5 + 2 + 78 + 1;       // obs3b 局面侧：序列 78 = 32 Q.seq + 30 Q.bag（自身键 bag）+ 16 Q.out
  const DOF = { obs3: 208, obs3b: 415 };   // 观测面总维（与训练侧 obs3.dims(R, ver) 同账，由 browser-parity 当场红）
  const CAND_BASE = 30;                    // obs3 候选侧基础段（代 2 删了恒零的 `tgt.none`）
  const POOL_BLOCKS = 3;                   // h_self ‖ mean ‖ max
  const SKILL_CLASS = ['energy', 'attack', 'defense', 'special'];

  function relu(x) { return x > 0 ? x : 0; }

  /* ---- 席位向量（obs3=22 / obs3b=81；逐字对齐 `obs3.mjs` 的 seatVec）----
   * ⚑ 决策时刻读不到的字段（guardNext/copiedGuard/fireWeakNext/tauntPending/reviveNext/beadNew）一律不进来；
   *   对手蓄珠种类不可知 ⇒ 只给"持不持珠"。obs3b：lastSkill 键身份 30+none ‖ 最近 K=4 键 bag（2^-age 衰减）‖ 目标 bag。 */
  function seatVec(p, mePid, modeHp, R, b, recent) {
    const st = p.stickers || [];
    const head = [
      Math.max(0, p.hp) / modeHp, Math.min(p.ep, 12) / 12,
      Math.min(p.ringStreak || 0, 3) / 3, Math.min(p.cannonCount || 0, 9) / 9,
      Math.min(p.rodGuard || 0, 3) / 3, Math.min(p.mineTurns || 0, 3) / 3,
      p.baguaExtra ? 1 : 0, p.fireWeakNow ? 1 : 0,
      p.tauntActive ? 1 : 0, p.nightmare ? 1 : 0, p.vampire ? 1 : 0, p.infiniteEnergy ? 1 : 0,
      Math.min(st.length, 4) / 4, Math.min(st.reduce((a, s) => Math.max(a, (s && s.age) || 0), 0), 4) / 4,
    ];
    const tail = [
      p.lastTarget === p.id ? 1 : 0, (mePid >= 0 && p.lastTarget === mePid) ? 1 : 0,
      (p.lastTarget != null && p.lastTarget !== p.id && p.lastTarget !== mePid) ? 1 : 0,
    ];
    if (!b) {
      const cat = p.lastSkill && R.byKey[p.lastSkill] ? R.byKey[p.lastSkill].cat : null;
      const ci = SKILL_CLASS.indexOf(cat);
      return head.concat([ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0, p.lastSkill ? 0 : 1], tail);
    }
    const lsKey = new Array(R.skills.length).fill(0);
    const at = p.lastSkill ? R.skills.findIndex((s) => s.key === p.lastSkill) : -1;
    if (at >= 0) lsKey[at] = 1;
    const bag = new Array(R.skills.length).fill(0);
    const tbag = [0, 0, 0];
    const rec = recent && recent.get(p.id);
    if (rec) {
      for (const k in rec.bag) { const i = R.skills.findIndex((s) => s.key === k); if (i >= 0) bag[i] = rec.bag[k]; }
      tbag[0] = rec.tgt[0]; tbag[1] = rec.tgt[1]; tbag[2] = rec.tgt[2];
    }
    return head.concat(lsKey, [p.lastSkill ? 0 : 1], tail, bag, tbag);
  }
  /* 最近 K 回合的键/目标 bag（与 obs3.recentAll 同源：一次反扫、2^-age 衰减、/1.875；依赖 action 事件带 target） */
  function recentAll(state, R, ids, mePid, K) {
    const BAG_NORM = 1.875;
    const ev = state.events || [];
    const need = new Map(); for (const id of ids) need.set(id, K);
    const bag = new Map(), tgt = new Map(), age = new Map();
    for (const id of ids) { bag.set(id, {}); tgt.set(id, [0, 0, 0]); age.set(id, 0); }
    for (let i = ev.length - 1; i >= 0; i--) {
      let left = 0; for (const id of ids) left += need.get(id) || 0;
      if (!left) break;
      const e = ev[i];
      if (e.type !== 'action' || e.pid == null || !need.has(e.pid) || !(need.get(e.pid) > 0)) continue;
      const a = age.get(e.pid), w = Math.pow(2, -a) / BAG_NORM;
      const bb = bag.get(e.pid); if (e.key) bb[e.key] = (bb[e.key] || 0) + w;
      const tg = tgt.get(e.pid);
      if (e.target === e.pid) tg[0] += w;
      else if (e.target === mePid) tg[1] += w;
      else if (e.target != null && e.target !== e.pid) tg[2] += w;
      need.set(e.pid, need.get(e.pid) - 1);
      age.set(e.pid, a + 1);
    }
    const out = new Map();
    for (const id of ids) out.set(id, { bag: bag.get(id), tgt: tgt.get(id) });
    return out;
  }

  /* ---- 局面侧（与候选无关 ⇒ 一次决策只算一遍；ver='obs3b' 走 81 席 + 168 序列 + 键/目标 bag）---- */
  function scene(W, state, pid, ver) {
    const R = W.EpirusRules;
    const b = ver === 'obs3b';
    const me = state.p[pid];
    const modeHp = (state.mode && state.mode.hp) || 3;
    const maxR = (state.mode && state.mode.maxRounds) || R.MAX_ROUNDS || 60;
    const sd = (state.mode && state.mode.suddenDeath != null) ? state.mode.suddenDeath : (R.SUDDEN_DEATH || 0);
    const alive = state.p.filter((q) => q.hp > 0);
    /* G 5 维逐字对齐 obs3 代 2：人数族 /10、modeHp /5、round 走**本模式**上限并截到 1、shrink = round/sd */
    const g = [state.n / 10, alive.length / 10, modeHp / 5, Math.min(1, state.round / maxR),
      sd > 0 ? Math.min(1, state.round / sd) : 0];
    const priv = [Math.min(me.elec || 0, 2) / 2, Math.min(me.boom || 0, 2) / 2];
    const recentMap = b ? recentAll(state, R, alive.map((q) => q.id), pid, 4) : null;
    const seats = [];
    let sumSt = 0;
    for (const q of alive) {
      const rel = [0, 0, 0, 0, 0];
      if (q.id !== pid) {
        if ((me.tauntBy || []).indexOf(q.id) >= 0) rel[0] = 1;
        if ((q.tauntBy || []).indexOf(pid) >= 0) rel[1] = 1;
        if ((me.chains || []).indexOf(q.id) >= 0) rel[2] = 1;
        if (q.lastSkill === R.SK.MIRROR && q.lastTarget === pid) rel[3] = 1;
        if (q.lastTarget === pid) rel[4] = 1;
        sumSt += (q.stickers || []).length;
      }
      seats.push({ id: q.id, public: seatVec(q, pid, modeHp, R, b, recentMap), rel, isSelf: q.id === pid ? 1 : 0 });
    }
    const sums = [Math.min(sumSt, 12) / 12];
    return { R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, seq: selfSeq(state, pid, R, ver) };
  }

  /* 自己最近 K=4 次出手：类别 ‖ 语义家族 ‖（obs3b：键身份 30，块连续）‖ 结果类 */
  function selfSeq(state, pid, R, ver) {
    const BLOCK_TYPES = ['blocked', 'curseBlock', 'cancel', 'clash'];
    const NULL_TYPES = ['voided', 'voidedBy', 'rodBlock', 'cannonCountered', 'thunderRing', 'bigTChain'];
    const EFFECT_TYPES = ['damage', 'heal', 'ep', 'bead', 'curse', 'mineArm', 'guardSet', 'holoSet', 'taunt', 'revive', 'vampire', 'headshot', 'hidden', 'purify', 'transfer', 'reflect'];
    const ev = state.events || [];
    function outcomeBits(key) {
      let actAt = -1;
      for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key === key) { actAt = i; break; } }
      if (actAt < 0) return null;
      const a = ev[actAt];
      const b = [0, 0, 0, 0, 0, 0];
      if (a.outcome && a.outcome !== 'ok') { b[5] = 1; return b; }
      for (let i = actAt + 1; i < ev.length; i++) {
        const e = ev[i];
        const mine = (e.pid === pid || e.to === pid || e.from === pid || e.source === pid || e.byPid === pid || e.dest === pid);
        if (!mine && e.type !== 'action') continue;
        if (e.type === 'reflect') { b[2] = 1; b[0] = 1; }
        else if (e.type === 'transfer') b[3] = 1;
        else if (BLOCK_TYPES.indexOf(e.type) >= 0) b[1] = 1;
        else if (NULL_TYPES.indexOf(e.type) >= 0) b[4] = 1;
        else if (EFFECT_TYPES.indexOf(e.type) >= 0) b[0] = 1;
      }
      return b;
    }
    const acts = [];
    for (let i = ev.length - 1; i >= 0 && acts.length < 4; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key) acts.push(e); }
    const b = ver === 'obs3b';
    const per = [];
    for (let k = 0; k < 4; k++) {
      const a = acts[k];
      if (!a) { per.push([[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1]]); continue; }
      const def = R.byKey[a.key] || {};
      const ci = SKILL_CLASS.indexOf(def.cat);
      const ob = outcomeBits(a.key);
      const landed = ob ? ob[0] : 0, blocked = ob ? (ob[1] || ob[2] || ob[3] || ob[4]) : 0;
      per.push([[ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
        R.ATK_EFFECT.indexOf(a.key) >= 0 ? 1 : 0, R.GUARD_FAMILY.indexOf(a.key) >= 0 ? 1 : 0,
        R.LIGHTNING.indexOf(a.key) >= 0 ? 1 : 0, R.REFLECTABLE.indexOf(a.key) >= 0 ? 1 : 0],
        [landed, blocked, ob && ob[4] ? 1 : 0, (!landed && !blocked) ? 1 : 0]]);
    }
    if (!b) {
      const out = [];
      for (const [cf, o] of per) out.push(...cf, ...o);
      return out;
    }
    const s1 = [], s3 = [];
    for (const [cf, o] of per) { s1.push(...cf); s3.push(...o); }
    const ordered = new Array(R.skills.length).fill(0);
    for (let k = 0; k < acts.length; k++) {
      const at = R.skills.findIndex((s) => s.key === acts[k].key);
      if (at >= 0) ordered[at] += Math.pow(2, -k) / 1.875;
    }
    /* ⚑ obs3b 块序 = [Q.seq 32 ‖ Q.out 16 ‖ Q.bag 30]（与训练侧 manifest 严格同序） */
    return [...s1, ...s3, ...ordered];
  }

  /* ---- 候选侧：base(30) ⊕ 技能身份 one-hot ---- */
  function candOf(W, sc, cand) {
    const S = W.EpirusState, R = sc.R, me = sc.me;
    const def = R.byKey[cand.key] || {};
    const cost = S.computeCost(sc.state, sc.pid, cand.key);
    const c = typeof cost.ep === 'number' ? cost.ep : (def.cost || 0);
    const ci = SKILL_CLASS.indexOf(def.cat);
    const isAoe = def.target === 'all' || cand.key === R.SK.FIRESTORM || cand.key === R.SK.MINE || cand.key === R.SK.BIG_T;
    const twoTgt = !!(cand.target2 != null || def.target2 === 'enemy');
    const dmg = (def.dmg && def.dmg.amt) || 0;
    const t1 = cand.target != null ? sc.state.p[cand.target] : null;
    const t2 = cand.target2 != null ? sc.state.p[cand.target2] : null;
    const beadAfford = cand.bead === 'elec' ? Math.min(me.elec || 0, 1) : cand.bead === 'boom' ? Math.min(me.boom || 0, 1) : (def.energyNeeds ? 0 : 1);
    const hiddenReady = ((me.chains || []).length > 0 && cand.key === R.SK.DRAIN) || (me.hp <= 1 && (me.vampire || me.nightmare));
    const oppN = sc.seats.length - 1;
    const base = [Math.min(c, 6) / 6, (def.pri || 0) / 5,
      ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
      def.target === 'self' ? 1 : 0, (!isAoe && !twoTgt && def.target) ? 1 : 0, (twoTgt && !isAoe) ? 1 : 0, isAoe ? 1 : 0,
      Math.min(dmg, 3) / 3, def.pierce && def.pierce.defense ? 1 : 0, def.pierce && def.pierce.reflect ? 1 : 0, def.pierce && def.pierce.transfer ? 1 : 0,
      def.continuous ? 1 : 0, def.energyNeeds ? 1 : 0, cand.bead === 'elec' ? 1 : 0, cand.bead === 'boom' ? 1 : 0,
      cost.ok ? 1 : 0, Math.max(-1, Math.min(1, (me.ep - c) / 4)), beadAfford,
      !!(t1 && dmg > 0 && dmg >= t1.hp) ? 1 : 0, dmg > 0 ? 1 : 0,
      !!(t1 && def.pierce && def.pierce.defense && t1.baguaExtra) ? 1 : 0,
      isAoe ? Math.max(0, oppN) / 10 : 0, isAoe ? Math.min(sc.sums[0] * 12, 12) / 12 : 0,
      (sc.alive.length <= 2 || sc.state.round >= sc.maxR - 4 || (sc.sd > 0 && sc.state.round >= sc.sd)) ? 1 : 0, hiddenReady ? 1 : 0,
      (twoTgt && cand.key === R.SK.MIRROR) ? 1 : 0, (twoTgt && cand.key !== R.SK.MIRROR) ? 1 : 0];
    const idOne = new Array(R.skills.length).fill(0);
    const at = R.skills.findIndex((s) => s.key === cand.key);
    if (at >= 0) idOne[at] = 1; else idOne[idOne.length - 1] = 1;
    return { base, idOne, t1, t2 };
  }

  /* ---- 由包的 dims 推宽度，并与包里的 layout.seg 对账（对不上就拒读）----
   *  obs3b：seatIn 87（81 公开）‖ selfDim 176（序列 168）——与 arch2 的 SEAT3B/SELF3B_EXTRA 同账。 */
  function layoutOfPack(o, skills) {
    const d = o.dims;
    const isB = d.input === 'obs3b';
    /* 代 3：`keySplit` ⇒ 键层按决策键分组（charge 的 elec/boom 上提到键层）。DK 住在 forwardCands 里（那里有 R），
     *   与 arch2 同式；两边不一致会被 selftest3 腿 E（镜像 parity）+ browser-parity 当场红，不靠人记。 */
    const keySplit = (o.dims.keySplit || 0) > 0 ? 1 : 0;
    const L = { keySplit,
      input: d.input, seatH: d.seatH, actH: d.actH, hid: d.hid, hid2: d.hid2, interK: d.inter || 0, tinterK: d.tinter || 0, skills,
      seatIn: isB ? SEAT_IN_B : SEAT_IN, actIn: CAND_BASE + skills, selfDim: isB ? SELF_DIM_B : SELF_DIM, poolN: POOL_BLOCKS,
      pubN: isB ? 81 : 22,
    };
    L.ctxDim = L.selfDim + L.poolN * L.seatH;
    L.candIn = L.hid + L.actH + L.seatH * 2;               // h_t1 ⊕ h_t2
    const seg = [
      { name: 'seatEnc', len: L.seatH * L.seatIn + L.seatH },
      { name: 'actEnc', len: L.actH * L.actIn + L.actH },
      { name: 'ctx', len: L.hid * L.ctxDim + L.hid },
      { name: 'cand', len: L.hid2 * L.candIn + L.hid2 },
      { name: 'policyHead', len: L.hid2 + 1 },
    ];
    if (L.interK > 0) seg.push({ name: 'inter', len: L.interK * (L.actH + L.hid + 2) });
    if (L.tinterK > 0) seg.push({ name: 'tinter', len: L.tinterK * (L.actH + L.seatH + 2) });   // 勘误十二：act×target
    let off = 0;
    for (const s of seg) { s.off = off; off += s.len; }
    L.seg = seg; L.n = off;
    return L;
  }
  function segAgrees(L, want) {
    if (!Array.isArray(want) || want.length !== L.seg.length) return '段数 ' + (want && want.length) + ' vs 本实现 ' + L.seg.length;
    for (let i = 0; i < L.seg.length; i++) {
      if (want[i].name !== L.seg[i].name) return '第 ' + i + ' 段名 ' + want[i].name + ' vs ' + L.seg[i].name;
      if (want[i].len !== L.seg[i].len) return '段 ' + L.seg[i].name + ' 长度 ' + want[i].len + ' vs 本实现 ' + L.seg[i].len;
      if (want[i].off !== L.seg[i].off) return '段 ' + L.seg[i].name + ' 偏移 ' + want[i].off + ' vs 本实现 ' + L.seg[i].off;
    }
    return null;
  }

  /** 容器对账：返回 {ok:true, L} 或 {ok:false, reason}。**任何一项对不上都拒读**，不猜形状。 */
  function checkPack(o, W) {
    const R = W.EpirusRules;
    if (!o || !Array.isArray(o.a)) return { ok: false, reason: 'missing' };
    if (o.v !== V_GEN3) return { ok: false, reason: 'version', got: o.v, want: V_GEN3 };
    if (!o.dims) return { ok: false, reason: 'no-dims' };
    if (o.dims.gen !== GEN) return { ok: false, reason: 'gen', got: o.dims.gen, want: GEN };
    if (o.dims.input !== 'obs3' && o.dims.input !== 'obs3b') return { ok: false, reason: 'input', got: o.dims.input, want: 'obs3|obs3b' };
    const skills = R.skills.length;
    const L = layoutOfPack(o, skills);
    const wantDof = DOF[o.dims.input] || 208;
    if (o.dims.dof != null && o.dims.dof !== wantDof) {
      /* dof 是观测面总维（obs3 的 MANIFEST 长度）；浏览器没有 MANIFEST，但**包里的值必须与面版本的账一致** */
      return { ok: false, reason: 'dof', got: o.dims.dof, want: wantDof };
    }
    if (o.a.length !== L.n) return { ok: false, reason: 'length', got: o.a.length, want: L.n };
    if (o.layout) {
      const bad = segAgrees(L, o.layout.seg);
      if (bad) return { ok: false, reason: 'seg', detail: bad };
    }
    return { ok: true, L };
  }

  function unpack(o, W) {
    const c = checkPack(o, W);
    if (!c.ok) return null;
    const p = new Float64Array(c.L.n);
    for (let i = 0; i < p.length; i++) p[i] = o.a[i];
    p.p2 = c.L;
    return p;
  }
  function pack(p, W) {
    const L = p && p.p2;
    if (!L) throw new Error('EpirusPolicy2.pack: 这枚 params 不是 2.0 张量（没有 p2 布局）');
    const R = W.EpirusRules;
    return {
      v: V_GEN3, arch: 'S1o', n: L.n,
      dims: { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK, gen: GEN, keySplit: L.keySplit, dof: DOF[L.input] || 208 },
      layout: { seg: L.seg.map((s) => ({ name: s.name, off: s.off, len: s.len })), n: L.n },
      a: Array.from(p), skills: R.skills.length,
    };
  }

  function is2Params(p) { return !!(p && p.p2); }

  /* ---- 前向：逐字对齐 arch2 的 forwardObs3（同一顺序、同一加法）---- */
  function encode(p, x, inDim, outDim, wOff, biasOff, out) {
    for (let j = 0; j < outDim; j++) {
      let s = p[biasOff + j];
      const base = wOff + j * inDim;
      for (let i = 0; i < inDim; i++) s += p[base + i] * x[i];
      out[j] = relu(s);
    }
    return out;
  }

  function forwardCands(W, state, pid, cands, params, opts2) {
    const L = params && params.p2;
    if (!L) throw new Error('EpirusPolicy2.forwardCands: params 不是 2.0 张量 ⇒ 该走 v7 那条路');
    const R = W.EpirusRules;
    /* Stage A：决策键的唯一实现（与 arch2 的 DK 同式）——键层分组决定"目标函数与门看得见什么" */
    const CHARGE_KEY = (R.SK && R.SK.CHARGE) || 'charge';
    const DK = (c) => (c && L.keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);
    const sc = scene(W, state, pid, L.input);
    const seatBias = L.seg[0].off + L.seatH * L.seatIn;
    const actBias = L.seg[1].off + L.actH * L.actIn;
    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;
    const candBias = L.seg[3].off + L.hid2 * L.candIn;
    const headOff = L.seg[4].off;
    const WS = L.seg[0].off, WA = L.seg[1].off, WC = L.seg[2].off, WK = L.seg[3].off;

    const svBuf = new Float64Array(L.seatIn);
    const enc = new Map();
    const mean = new Float64Array(L.seatH), mx = new Float64Array(L.seatH);
    const zeroSeat = new Float64Array(L.seatH);
    let hSelf = zeroSeat, poolN = 0;
    const PUBN = L.pubN;                      /* obs3=22 ‖ obs3b=81（席位公开段宽，随面走） */
    /* 梯度旁路（ZCode · 10-31）：wantTape=1 捎反传输入，与 arch2 forwardObs3 同位同序（selftest3 parity 腿钉） */
    const TP = (opts2 && opts2.wantTape) ? { svs: [], afs: [], t1: [], t2: [], keys: [], xin: null } : null;
    for (const s of sc.seats) {
      let k = 0;
      for (let j = 0; j < PUBN; j++) svBuf[k++] = s.public[j];
      for (let j = 0; j < 5; j++) svBuf[k++] = s.rel[j];
      svBuf[k++] = s.isSelf;
      if (k !== L.seatIn) throw new Error('布局不自洽：逐席拼进 ' + k + ' 而 seatIn=' + L.seatIn);
      const e = new Float64Array(L.seatH);
      encode(params, svBuf, L.seatIn, L.seatH, WS, seatBias, e);
      enc.set(s.id, e);
      if (TP) TP.svs.push({ id: s.id, sv: Float64Array.from(svBuf) });
      if (s.isSelf) { hSelf = e; continue; }
      poolN++;
      for (let j = 0; j < L.seatH; j++) { mean[j] += e[j]; if (e[j] > mx[j]) mx[j] = e[j]; }
    }
    const kk = Math.max(1, poolN);
    for (let j = 0; j < L.seatH; j++) mean[j] /= kk;

    const xin = new Float64Array(L.ctxDim);
    let q2 = 0;
    for (let i = 0; i < sc.g.length; i++) xin[q2++] = sc.g[i];
    for (let i = 0; i < sc.priv.length; i++) xin[q2++] = sc.priv[i];
    for (let i = 0; i < sc.seq.length; i++) xin[q2++] = sc.seq[i];
    for (let i = 0; i < sc.sums.length; i++) xin[q2++] = sc.sums[i];
    for (let j = 0; j < L.seatH; j++) xin[q2++] = hSelf[j];
    for (let j = 0; j < L.seatH; j++) xin[q2++] = mean[j];
    for (let j = 0; j < L.seatH; j++) xin[q2++] = mx[j];
    if (q2 !== L.ctxDim) throw new Error('布局不自洽：ctx 拼进 ' + q2 + ' 而声明 ' + L.ctxDim);
    if (TP) TP.xin = Float64Array.from(xin);
    const hctx = encode(params, xin, L.ctxDim, L.hid, WC, ctxBias, new Float64Array(L.hid));

    const n = cands.length, logits = new Float64Array(n);
    const afbuf = new Float64Array(L.actIn), ci = new Float64Array(L.candIn), ae = new Float64Array(L.actH), hc = new Float64Array(L.hid2);
    for (let i = 0; i < n; i++) {
      const cp = candOf(W, sc, cands[i]);
      let m2 = 0;
      for (let j = 0; j < cp.base.length; j++) afbuf[m2++] = cp.base[j];
      for (let j = 0; j < cp.idOne.length; j++) afbuf[m2++] = cp.idOne[j];
      if (m2 !== L.actIn) throw new Error('布局不自洽：actEnc 拼进 ' + m2 + ' 而 actIn=' + L.actIn + '（skills=' + L.skills + '）');
      encode(params, afbuf, L.actIn, L.actH, WA, actBias, ae);
      const t1 = cands[i].target == null ? null : cands[i].target;
      const t2 = cands[i].target2 == null ? null : cands[i].target2;
      if (TP) { TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(DK(cands[i])); }
      const te1 = t1 != null && enc.has(t1) ? enc.get(t1) : zeroSeat;
      const te2 = t2 != null && enc.has(t2) ? enc.get(t2) : zeroSeat;
      ci.set(hctx, 0); ci.set(ae, L.hid); ci.set(te1, L.hid + L.actH); ci.set(te2, L.hid + L.actH + L.seatH);
      if (hctx.length + ae.length + te1.length + te2.length !== L.candIn) throw new Error('布局不自洽：逐候选层拼进的列数 ≠ candIn=' + L.candIn);
      encode(params, ci, L.candIn, L.hid2, WK, candBias, hc);
      let v = params[headOff + L.hid2];
      for (let j = 0; j < L.hid2; j++) v += params[headOff + j] * hc[j];
      /* 目标交互头（tinter=K）：与 arch2 逐字同式（勘误十二） */
      if (L.tinterK > 0) {
        const tS0 = L.seg.find((s) => s.name === 'tinter').off;
        for (let k = 0; k < L.tinterK; k++) {
          const u0 = tS0 + k * (L.actH + L.seatH + 2);
          let ua = 0, wt = 0;
          for (let j = 0; j < L.actH; j++) ua += params[u0 + j] * ae[j];
          for (let j = 0; j < L.seatH; j++) wt += params[u0 + L.actH + j] * te1[j];
          v += params[u0 + L.actH + L.seatH] * Math.tanh(ua * wt + params[u0 + L.actH + L.seatH + 1]);
        }
      }
      logits[i] = v;
    }
    /* 两级 softmax：与 arch2 / v7 同式（技能层用 bestOf 归一，再在该技能内部 softmax）*/
    const temp = (opts2 && opts2.temp) || 0.6;
    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }
    let kmax = -1e9;
    for (const k of keys) if (bestOf[k] > kmax) kmax = bestOf[k];
    let ktot = 0;
    for (const k of keys) { kProb[k] = Math.exp((bestOf[k] - kmax) / temp); ktot += kProb[k]; }
    for (const k of keys) kProb[k] = ktot > 0 ? kProb[k] / ktot : 0;
    for (let i = 0; i < n; i++) { const k = DK(cands[i]); kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }
    const probs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;
      probs[i] = kProb[k] * within;
    }
    let arg = 0, best = -1e9;
    for (let i = 0; i < n; i++) if (logits[i] > best) { best = logits[i]; arg = i; }
    return { probs, argmax: arg, cand: cands[arg] || null, logits, ...(TP ? { tape: TP } : {}) };
  }

  function chooseCandidates(W, state, pid, cands, params, opts2) {
    const R = W.EpirusRules;
    if (!cands || !cands.length) return { key: R.SK.JI, target: null, target2: null, bead: null };
    const f = forwardCands(W, state, pid, cands, params, { temp: opts2 && opts2.temp != null ? opts2.temp : 0.5 });
    let r = (opts2 && opts2.greedy) ? 0 : state.rng.next();
    if (r >= 1) r = 0.999999;
    let acc = 0;
    for (let i = 0; i < f.probs.length; i++) { acc += f.probs[i]; if (r < acc) return cands[i]; }
    return cands[f.argmax] || cands[0];
  }

  global.EpirusPolicy2 = {
    V_GEN3, GEN, is2Params, checkPack, unpack, pack, forwardCands, chooseCandidates, layoutOfPack,
    paramCount: (o, W) => (o && o.a ? o.a.length : null),
  };
})(typeof window !== 'undefined' ? window : globalThis);
