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
  const DOF = { obs3: 208, obs3b: 415, obs4: 292, obs5: 292 };   // 观测面总维（obs5 与 obs4 同 manifest；obs6 = 137 + 5*skills）
  /* ⚑ obs4（11-10 深夜 · ZCode · 用户原则「正交维度信息全覆盖 + 不再因可变人数平均化」）：
   *   固定 8 槽（slot = 座位 pid，每局随机指派 ⇒ 槽位身份不是脚本指纹）+ alive 位，**无 mean/max 池化**——
   *   每个席位每一维都被直接读到，平均化从结构上不可能发生。对手侧**不给精确键**（断指纹通道），
   *   改给风格不变量 + 威胁计数；候选侧保留精确键（「我要出什么」必须知道）。 */
  /* ⚑ obs5（11-10 · ZCode · 用户问"attention+PMA 会不会更好"的正面回答）：特征与 obs4 完全同一张（292），
   *   聚合段换成 **set-transformer**：共享 seatEnc → 1 层自注意力（QKV，alive 掩码 softmax，残差直连保底
   *   信息全覆盖）→ PMA（4 seed，keys/values 读注意力后语境向量）。置换不变与跨人数泛用从**结构**成立：
   *   K 只经 softmax 归一进入（softmax 权重和恒 1，mean 的"除以 N"不存在）；softmax 权重内容寻址——
   *   "谁威胁最大"是一跳学出来的比较，不再靠线性读 8 个槽。init 时注意力 logits≈0 ⇒ 从软均值起步特化。 */
  const SEAT_IN_4 = 35;                    // obs4/obs5 逐席：29 公开（14 状态+1 alive+5 风格+2 穿透+3 目标+4 计数）‖ 5 关系 ‖ 1 isSelf
  const SELF_DIM_4 = 5 + 2 + 48 + 1 + 4;   // obs4/obs5 局面侧：G5 ‖ 私有2 ‖ 序列48（类+果，无自身键 bag）‖ 合计1 ‖ 局面比较4
  const PMA_SEEDS_5 = 4;                   // obs5：PMA seed 数（= ctx 拼接块数；每 seed 学会盯一类席位）
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
  /* obs4 逐席公开段（29 维）：状态14 + alive1 + 风格5 + 穿透2 + 目标3 + 计数4 —— **无精确键**（断脚本指纹）。
   *   已淘汰席位全零（alive 位 0）⇒ 槽位有牙只对活人。 */
  function seatVec4(p, mePid, modeHp, R, recent) {
    const N4 = 29;
    if (!(p.hp > 0)) return new Array(N4).fill(0);
    const st = p.stickers || [];
    const head = [
      Math.max(0, p.hp) / modeHp, Math.min(p.ep, 12) / 12,
      Math.min(p.ringStreak || 0, 3) / 3, Math.min(p.cannonCount || 0, 9) / 9,
      Math.min(p.rodGuard || 0, 3) / 3, Math.min(p.mineTurns || 0, 3) / 3,
      p.baguaExtra ? 1 : 0, p.fireWeakNow ? 1 : 0,
      p.tauntActive ? 1 : 0, p.nightmare ? 1 : 0, p.vampire ? 1 : 0, p.infiniteEnergy ? 1 : 0,
      Math.min(st.length, 4) / 4, Math.min(st.reduce((a, s) => Math.max(a, (s && s.age) || 0), 0), 4) / 4,
    ];
    const def = p.lastSkill && R.byKey[p.lastSkill] ? R.byKey[p.lastSkill] : null;
    const cat = def ? def.cat : null;
    const ci = SKILL_CLASS.indexOf(cat);
    const rec = recent && recent.get(p.id);
    let streakDef = 0;
    if (rec && rec.keys) for (const k of rec.keys) { const d = R.byKey[k]; if (d && d.cat === 'defense') streakDef++; else break; }
    const hasBead = ((p.elec || 0) > 0 || (p.boom || 0) > 0) ? 1 : 0;
    return head.concat([1],
      [ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0, p.lastSkill ? 0 : 1],
      [def && def.pierce && def.pierce.defense ? 1 : 0, def && def.pierce && def.pierce.reflect ? 1 : 0],
      [p.lastTarget === p.id ? 1 : 0, (mePid >= 0 && p.lastTarget === mePid) ? 1 : 0,
        (p.lastTarget != null && p.lastTarget !== p.id && p.lastTarget !== mePid) ? 1 : 0],
      [rec ? rec.tgt[1] : 0, rec ? Math.min(rec.cnt || 0, 4) / 4 : 0, Math.min(streakDef, 4) / 4, hasBead]);
  }
  /* obs6 逐席公开段（44 + 2S 维）：18 状态 ‖ 3 相对桌面位置 ‖ S+1 lastSkill ‖ 8 规则等价类 ‖ 6 lastTarget/2 ‖ S bag23 ‖ 8 三回合统计 */
  /* ⚑ obs6（11-14 · gemini · 用户令）：**反转 obs4 的指纹条款**——精确键（lastSkill one-hot + 3 回合键 bag）
   *   回归**逐席含对手**。为什么敢开回 11-10 关掉的通道：①对手池改 **synthMix 合成对手**（10 脚本 pickers
   *   每 3 回合按局种哈希轮换 ⇒ 没有固定脚本指纹可背；考卷池锚 D235 不动）②训练侧 seatDrop（席位输入
   *   dropout）+ seatL2（席位编码权重 L2）压制对特定席位-脚本耦合的记忆。**代价与盯防**：背诵通道重新
   *   打开 ⇒ 考卷分数**无法**检出背诵（背名册反而分高）——判定必须配**非名册对手对照读数**（训外包/新
   *   脚本 vs 名册的分差），分差大 = 背诵实锤，回头收紧 synthMix/seatDrop。self 侧精确键同步恢复
   *   （同 seatEnc）⇒ obs5 时代"自己上一手是贴贴还是天火不可分辨"的教师在判别分辨率上限（11-14 白班
   *   FINDING ksmid）在 obs6 上解除。 */
  function seatVec6(p, mePid, modeHp, R, recent, ctx6) {
    const st = p.stickers || [];
    let maxAge = 0; for (let i = 0; i < st.length; i++) if (st[i] && st[i].age > maxAge) maxAge = st[i].age;
    let cdMax = 0; if (p.cooldown) for (const k in p.cooldown) if (p.cooldown[k] > cdMax) cdMax = p.cooldown[k];
    const cp = (p.cannonCount || 0) % 3;
    const head = [
      Math.max(0, p.hp) / modeHp, Math.min(p.ep, 12) / 12,
      Math.min(p.ringStreak || 0, 3) / 3,
      cp === 0 ? 1 : 0, cp === 1 ? 1 : 0, cp === 2 ? 1 : 0,
      Math.min(p.rodGuard || 0, 3) / 3, Math.min(p.mineTurns || 0, 3) / 3,
      p.baguaExtra ? 1 : 0, p.fireWeakNow ? 1 : 0,
      p.tauntActive ? 1 : 0, p.nightmare ? 1 : 0, p.vampire ? 1 : 0, p.infiniteEnergy ? 1 : 0,
      Math.min(st.length, 4) / 4, Math.min(maxAge, 4) / 4,
      ((p.elec || 0) > 0 || (p.boom || 0) > 0) ? 1 : 0,
      Math.min(cdMax, 3) / 3,
    ];
    const c6 = ctx6 || { meHp: p.hp, leadHp: p.hp, minHp: p.hp, aliveLen: 1 };
    const pos = [
      Math.max(-1, Math.min(1, (p.hp - c6.meHp) / modeHp)),
      (c6.leadHp > 0 && p.hp === c6.leadHp) ? 1 : 0,
      (c6.aliveLen > 1 && p.hp === c6.minHp) ? 1 : 0,
    ];
    const S = R.skills.length;
    const lsKey = new Array(S).fill(0);
    const lsAt = p.lastSkill ? R.skills.findIndex((s) => s.key === p.lastSkill) : -1;
    if (lsAt >= 0) lsKey[lsAt] = 1;
    const def = p.lastSkill && R.byKey[p.lastSkill] ? R.byKey[p.lastSkill] : null;
    const ci = SKILL_CLASS.indexOf(def ? def.cat : null);
    const lk = p.lastSkill || '';
    const ruleEq = [
      ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
      (lk === 'guard' || lk === 'jinshield') ? 1 : 0,
      (lk === 'reflect' || lk === 'armor') ? 1 : 0,
      (lk === 'bagua' || lk === 'shift' || lk === 'proto' || lk === 'holo') ? 1 : 0,
      (def && def.pierce && (def.pierce.defense || def.pierce.reflect || def.pierce.transfer)) ? 1 : 0,
    ];
    const t1Vec = [
      p.lastTarget === p.id ? 1 : 0,
      (mePid >= 0 && p.lastTarget === mePid) ? 1 : 0,
      (p.lastTarget != null && p.lastTarget !== p.id && p.lastTarget !== mePid) ? 1 : 0,
    ];
    const t2Vec = [
      p.lastTarget2 === p.id ? 1 : 0,
      (mePid >= 0 && p.lastTarget2 === mePid) ? 1 : 0,
      (p.lastTarget2 != null && p.lastTarget2 !== p.id && p.lastTarget2 !== mePid) ? 1 : 0,
    ];
    const bag23 = new Array(S).fill(0);
    const tb = [0, 0, 0];
    const rec = recent && recent.get(p.id);
    const ks = rec && rec.keys ? rec.keys : [];
    const n3 = Math.min(ks.length, 3);
    if (n3 > 1) { const i1 = R.skills.findIndex((s) => s.key === ks[1]); if (i1 >= 0) bag23[i1] += 0.5; }
    if (n3 > 2) { const i2 = R.skills.findIndex((s) => s.key === ks[2]); if (i2 >= 0) bag23[i2] += 0.25; }
    const W3 = [4 / 7, 2 / 7, 1 / 7];
    let atk3 = 0, guard3 = 0, ref3 = 0, streakDef = 0, streakOpen = true;
    for (let a = 0; a < n3; a++) {
      const k = ks[a];
      const dd = k ? R.byKey[k] : null;
      if (dd && dd.cat === 'attack') atk3++;
      if (k === 'guard' || k === 'jinshield' || k === 'bagua' || k === 'shift' || k === 'proto' || k === 'holo') guard3++;
      if (k === 'reflect' || k === 'armor') ref3++;
      if (streakOpen) { if (dd && dd.cat === 'defense') streakDef++; else streakOpen = false; }
      const tp = rec && rec.tgts && rec.tgts[a];
      if (tp) {
        const tg1 = tp[0], tg2 = tp[1];
        if (tg1 === p.id || tg2 === p.id) tb[0] += W3[a];
        else if (mePid >= 0 && (tg1 === mePid || tg2 === mePid)) tb[1] += W3[a];
        else if (tg1 != null || tg2 != null) tb[2] += W3[a];
      }
    }
    return head.concat(pos, lsKey, [p.lastSkill ? 0 : 1], ruleEq, t1Vec, t2Vec, bag23,
      [tb[0], tb[1], tb[2], n3 / 3, atk3 / 3, guard3 / 3, ref3 / 3, Math.min(streakDef, 3) / 3]);
  }
  /* 最近 K 回合的键/目标 bag（与 obs3.recentAll 同源：一次反扫、2^-age 衰减、/1.875；依赖 action 事件带 target） */
  function recentAll(state, R, ids, mePid, K) {
    const BAG_NORM = 1.875;
    const ev = state.events || [];
    const need = new Map(); for (const id of ids) need.set(id, K);
    const bag = new Map(), tgt = new Map(), age = new Map(), keysSeq = new Map(), tgtsSeq = new Map();
    for (const id of ids) { bag.set(id, {}); tgt.set(id, [0, 0, 0]); age.set(id, 0); keysSeq.set(id, []); tgtsSeq.set(id, []); }
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
      const ks = keysSeq.get(e.pid); ks.push(e.key); if (ks.length > K) ks.length = K;   // 反向扫描 ⇒ keys[0] = 最近一手
      const ts = tgtsSeq.get(e.pid); ts.push([e.target, e.target2]); if (ts.length > K) ts.length = K;
    }
    const out = new Map();
    for (const id of ids) out.set(id, { bag: bag.get(id), tgt: tgt.get(id), keys: keysSeq.get(id) || [], tgts: tgtsSeq.get(id) || [], cnt: K - (need.get(id) || 0) });
    return out;
  }

  /* ---- 局面侧（与候选无关 ⇒ 一次决策只算一遍；ver='obs3b'|'obs4'|'obs5'|'obs6'）---- */
  function scene(W, state, pid, ver) {
    const R = W.EpirusRules;
    const b = ver === 'obs3b';
    const is6 = ver === 'obs6';
    const v4 = ver === 'obs4' || ver === 'obs5';   /* obs5：特征面与 obs4 同一函数（聚合层才分家） */
    const me = state.p[pid];
    const modeHp = (state.mode && state.mode.hp) || 3;
    const maxR = (state.mode && state.mode.maxRounds) || R.MAX_ROUNDS || 60;
    const sd = (state.mode && state.mode.suddenDeath != null) ? state.mode.suddenDeath : (R.SUDDEN_DEATH || 0);
    const alive = state.p.filter((q) => q.hp > 0);
    /* G 5 维逐字对齐 obs3 代 2：人数族 /10、modeHp /5、round 走**本模式**上限并截到 1、shrink = round/sd */
    const g = [state.n / 10, alive.length / 10, modeHp / 5, Math.min(1, state.round / maxR),
      sd > 0 ? Math.min(1, state.round / sd) : 0];
    const priv = [Math.min(me.elec || 0, 2) / 2, Math.min(me.boom || 0, 2) / 2];
    const recentMap = (b || v4 || is6) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, is6 ? 3 : 4) : null;
    let sit = null, ctx6 = null;
    if (v4 || is6) {
      const al = alive.map((q) => q.hp);
      const lead = al.length ? Math.max.apply(null, al) : 0;
      const minHp = al.length ? Math.min.apply(null, al) : 0;
      sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8,
        Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),
        al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp),
        (state.n - alive.length) / 8];
      if (is6) {
        sit.push(alive.length <= 2 ? 1 : 0);
        ctx6 = { meHp: me.hp, leadHp: lead, minHp, aliveLen: alive.length };
      }
    }
    const seats = [];
    let sumSt = 0, ownActSt = 0, ownExpSt = 0;
    const seatList = v4 ? state.p : alive;
    for (const q of seatList) {
      if (is6 && q.hp > 0 && q.stickers) {
        for (const st of q.stickers) if (st && st.owner === pid && st.age <= 3) { ownActSt++; if (st.age === 3) ownExpSt++; }
      }
      const rel = is6 ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0];
      if (q.id !== pid && q.hp > 0) {
        if ((me.tauntBy || []).indexOf(q.id) >= 0) rel[0] = 1;
        if ((q.tauntBy || []).indexOf(pid) >= 0) rel[1] = 1;
        if ((me.chains || []).indexOf(q.id) >= 0) rel[2] = 1;
        if (q.lastSkill === R.SK.MIRROR && q.lastTarget === pid) rel[3] = 1;
        if (q.lastTarget === pid || (is6 && q.lastTarget2 === pid)) rel[4] = 1;
        if (is6 && (me.lastTarget === q.id || me.lastTarget2 === q.id)) rel[5] = 1;
        sumSt += (q.stickers || []).length;
      }
      seats.push({ id: q.id, public: is6 ? seatVec6(q, pid, modeHp, R, recentMap, ctx6) : v4 ? seatVec4(q, pid, modeHp, R, recentMap) : seatVec(q, pid, modeHp, R, b, recentMap), rel, isSelf: q.id === pid ? 1 : 0 });
    }
    const sums = [Math.min(sumSt, 12) / 12];
    let selfPhase = null;
    if (is6) {
      const cp = (me.cannonCount || 0) % 3;
      let cdMax = 0; if (me.cooldown) for (const k in me.cooldown) if (me.cooldown[k] > cdMax) cdMax = me.cooldown[k];
      selfPhase = [cp === 0 ? 1 : 0, cp === 1 ? 1 : 0, cp === 2 ? 1 : 0, Math.min(cdMax, 3) / 3, sums[0], Math.min(ownActSt, 4) / 4, Math.min(ownExpSt, 4) / 4];
    }
    return { R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, sit, selfPhase, seq: selfSeq(state, pid, R, ver) };
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
    const is6 = ver === 'obs6';
    const K = is6 ? 3 : 4;
    const acts = [];
    for (let i = ev.length - 1; i >= 0 && acts.length < K; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key) acts.push(e); }
    const b = ver === 'obs3b';
    const per = [];
    for (let k = 0; k < K; k++) {
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
    if (is6) {
      const out = [];
      for (const [cf, o] of per) out.push(...cf, ...o);
      const me = state.p[pid] || {};
      const S = R.skills.length;
      const lsKey = new Array(S).fill(0);
      const lsAt = me.lastSkill ? R.skills.findIndex((s) => s.key === me.lastSkill) : -1;
      if (lsAt >= 0) lsKey[lsAt] = 1;
      const bag23 = new Array(S).fill(0);
      if (acts.length > 1) { const i1 = R.skills.findIndex((s) => s.key === acts[1].key); if (i1 >= 0) bag23[i1] += 0.5; }
      if (acts.length > 2) { const i2 = R.skills.findIndex((s) => s.key === acts[2].key); if (i2 >= 0) bag23[i2] += 0.25; }
      return out.concat(lsKey, [me.lastSkill ? 0 : 1], bag23);
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
    const is4 = d.input === 'obs4';
    const is5 = d.input === 'obs5';
    const is6 = d.input === 'obs6';
    const keySplit = (o.dims.keySplit || 0) > 0 ? 1 : 0;
    const L = { keySplit,
      input: d.input, seatH: d.seatH, actH: d.actH, hid: d.hid, hid2: d.hid2, interK: d.inter || 0, tinterK: d.tinter || 0, keyHeadOn: d.keyHead || 0, skills,
      seatIn: is6 ? (51 + 2 * skills) : (is4 || is5) ? SEAT_IN_4 : isB ? SEAT_IN_B : SEAT_IN,
      actIn: CAND_BASE + skills,
      selfDim: is6 ? (56 + 2 * skills) : (is4 || is5) ? SELF_DIM_4 : isB ? SELF_DIM_B : SELF_DIM,
      poolN: is6 ? 3 : is4 ? 8 : is5 ? PMA_SEEDS_5 : POOL_BLOCKS,
      pubN: is6 ? (44 + 2 * skills) : (is4 || is5) ? 29 : isB ? 81 : 22,
    };
    L.ctxDim = is6 ? (L.hid + 3 * L.seatH) : (L.selfDim + L.poolN * L.seatH);
    L.candIn = L.hid + L.actH + L.seatH * 2;
    L.norm = (d.norm && Array.isArray(d.norm.mean) && Array.isArray(d.norm.std) && d.norm.mean.length === L.ctxDim)
      ? { mean: d.norm.mean.slice(), std: d.norm.std.slice() } : null;
    const FFH = 2 * L.seatH;
    const seg = is6 ? [
      { name: 'selfEnc', len: L.hid * L.selfDim + L.hid },
      { name: 'seatEnc', len: L.seatH * L.seatIn + L.seatH },
      { name: 'attnQ', len: L.seatH * L.seatH + L.seatH },
      { name: 'attnK', len: L.seatH * L.seatH + L.seatH },
      { name: 'attnV', len: L.seatH * L.seatH + L.seatH },
      { name: 'attnO', len: L.seatH * L.seatH + L.seatH },
      { name: 'rff1', len: FFH * L.seatH + FFH },
      { name: 'rff2', len: L.seatH * FFH + L.seatH },
      { name: 'xattnQ', len: FFH * L.hid + FFH },
      { name: 'xattnK', len: FFH * L.seatH + FFH },
      { name: 'xattnV', len: FFH * L.seatH + FFH },
      { name: 'actEnc', len: L.actH * L.actIn + L.actH },
      { name: 'ctx', len: L.hid * L.ctxDim + L.hid },
      { name: 'skillHead', len: skills * L.hid + skills },
      { name: 'tBilin', len: 2 * L.seatH * L.actH },
      { name: 'cand', len: L.hid2 * L.candIn + L.hid2 },
      { name: 'policyHead', len: L.hid2 + 1 },
    ] : [
      { name: 'seatEnc', len: L.seatH * L.seatIn + L.seatH },
      ...(is5 ? [
        { name: 'attn', len: 3 * (L.seatH * L.seatH + L.seatH) },
        { name: 'pma', len: (L.seatH * L.seatH + L.seatH) + PMA_SEEDS_5 * L.seatH },
      ] : []),
      { name: 'actEnc', len: L.actH * L.actIn + L.actH },
      { name: 'ctx', len: L.hid * L.ctxDim + L.hid },
      { name: 'cand', len: L.hid2 * L.candIn + L.hid2 },
      { name: 'policyHead', len: L.hid2 + 1 },
    ];
    if (!is6 && L.interK > 0) seg.push({ name: 'inter', len: L.interK * (L.actH + L.hid + 2) });
    if (!is6 && L.tinterK > 0) seg.push({ name: 'tinter', len: L.tinterK * (L.actH + L.seatH + 2) });
    if (!is6 && L.keyHeadOn > 0) seg.push({ name: 'keyHead', len: skills * (L.hid + 1) });
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
    if (o.dims.input !== 'obs3' && o.dims.input !== 'obs3b' && o.dims.input !== 'obs4' && o.dims.input !== 'obs5' && o.dims.input !== 'obs6') return { ok: false, reason: 'input', got: o.dims.input, want: 'obs3|obs3b|obs4|obs5|obs6' };
    const skills = R.skills.length;
    const L = layoutOfPack(o, skills);
    const wantDof = o.dims.input === 'obs6' ? (137 + 5 * skills) : (DOF[o.dims.input] || 208);
    if (o.dims.dof != null && o.dims.dof !== wantDof) {
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
    const dof = L.input === 'obs6' ? (137 + 5 * R.skills.length) : (DOF[L.input] || 208);
    const dims = { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK, tinter: L.tinterK || 0, keyHead: L.keyHeadOn || 0, gen: GEN, keySplit: L.keySplit, dof };
    if (L.norm) dims.norm = L.norm;
    return {
      v: V_GEN3, arch: 'S1o', n: L.n, dims,
      layout: { seg: L.seg.map((s) => ({ name: s.name, off: s.off, len: s.len })), n: L.n },
      a: Array.from(p), skills: R.skills.length,
    };
  }

  function is2Params(p) { return !!(p && p.p2); }

  /* ---- 前向：逐字对齐 arch2 的 forwardObs3 / forwardObs6（同一顺序、同一加法）---- */
  function encode(p, x, inDim, outDim, wOff, biasOff, out) {
    for (let j = 0; j < outDim; j++) {
      let s = p[biasOff + j];
      const base = wOff + j * inDim;
      for (let i = 0; i < inDim; i++) s += p[base + i] * x[i];
      out[j] = relu(s);
    }
    return out;
  }
  function lin6(params, src, inDim, outDim, segOff0, applyRelu) {
    const out = new Float64Array(outDim);
    const bOff = segOff0 + outDim * inDim;
    for (let j = 0; j < outDim; j++) {
      let s = params[bOff + j];
      const base = segOff0 + j * inDim;
      for (let i = 0; i < inDim; i++) s += params[base + i] * src[i];
      out[j] = applyRelu ? (s > 0 ? s : 0) : s;
    }
    return out;
  }
  function rms6(x, D) {
    let sq = 0;
    for (let j = 0; j < D; j++) sq += x[j] * x[j];
    const inv = 1 / Math.sqrt(sq / D + 1e-6);
    const y = new Float64Array(D);
    for (let j = 0; j < D; j++) y[j] = x[j] * inv;
    return y;
  }
  function sm6(row) {
    let mx = -Infinity;
    for (let j = 0; j < row.length; j++) if (row[j] > mx) mx = row[j];
    let s = 0;
    const w = new Float64Array(row.length);
    for (let j = 0; j < row.length; j++) { w[j] = Math.exp(row[j] - mx); s += w[j]; }
    for (let j = 0; j < row.length; j++) w[j] /= s;
    return w;
  }

  function forwardObs6(W, state, pid, cands, params, opts2) {
    const L = params.p2, R = W.EpirusRules;
    const CHARGE_KEY = (R.SK && R.SK.CHARGE) || 'charge';
    const DK = (c) => (c && L.keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);
    const sc = scene(W, state, pid, 'obs6');
    const segOff = (nm) => L.seg.find((sg) => sg.name === nm).off;
    const H6 = L.seatH, FFH = 2 * H6;
    const oSelf = segOff('selfEnc'), oSeat = segOff('seatEnc');
    const oAQ = segOff('attnQ'), oAK = segOff('attnK'), oAV = segOff('attnV'), oAO = segOff('attnO');
    const oRF1 = segOff('rff1'), oRF2 = segOff('rff2');
    const oXQ = segOff('xattnQ'), oXK = segOff('xattnK'), oXV = segOff('xattnV');
    const oAct = segOff('actEnc'), oCtx = segOff('ctx');
    const oSK = segOff('skillHead'), oTB = segOff('tBilin');
    const oCand = segOff('cand'), oHead = segOff('policyHead');

    const selfVec = new Float64Array(L.selfDim);
    let sp = 0;
    for (let i = 0; i < sc.g.length; i++) selfVec[sp++] = sc.g[i];
    for (let i = 0; i < sc.sit.length; i++) selfVec[sp++] = sc.sit[i];
    for (let i = 0; i < sc.priv.length; i++) selfVec[sp++] = sc.priv[i];
    for (let i = 0; i < sc.selfPhase.length; i++) selfVec[sp++] = sc.selfPhase[i];
    for (let i = 0; i < sc.seq.length; i++) selfVec[sp++] = sc.seq[i];
    if (sp !== L.selfDim) throw new Error('obs6 布局不自洽：selfVec=' + sp + ' ‖ selfDim=' + L.selfDim);
    const hSelf = lin6(params, selfVec, L.selfDim, L.hid, oSelf, true);

    const TP = (opts2 && opts2.wantTape) ? { is6: 1, self: Float64Array.from(selfVec), svs: [], afs: [], t1: [], t2: [], skillIdx: [], keys: [], xin: null } : null;
    const isSelfArr = [], ids6 = [], e0s = [];
    const PUBN = L.pubN;
    for (const s of sc.seats) {
      const sv = new Float64Array(L.seatIn);
      let k = 0;
      for (let j = 0; j < PUBN; j++) sv[k++] = s.public[j];
      for (let j = 0; j < 6; j++) sv[k++] = s.rel[j];
      sv[k++] = s.isSelf;
      if (k !== L.seatIn) throw new Error('obs6 布局不自洽：sv=' + k + ' ‖ seatIn=' + L.seatIn);
      isSelfArr.push(s.isSelf); ids6.push(s.id);
      if (TP) TP.svs.push({ id: s.id, sv: Float64Array.from(sv) });
      e0s.push(lin6(params, sv, L.seatIn, H6, oSeat, true));
    }
    const K = e0s.length;
    const nH = (H6 % 2 === 0) ? 2 : 1, hd = H6 / nH, SQ1 = Math.sqrt(hd);
    const q1s = [], k1s = [], v1s = [];
    for (let i = 0; i < K; i++) {
      const r0 = rms6(e0s[i], H6);
      q1s.push(lin6(params, r0, H6, H6, oAQ, false));
      k1s.push(lin6(params, r0, H6, H6, oAK, false));
      v1s.push(lin6(params, r0, H6, H6, oAV, false));
    }
    const e1s = [];
    for (let i = 0; i < K; i++) {
      const u1 = new Float64Array(H6);
      for (let h = 0; h < nH; h++) {
        const h0 = h * hd, row = new Float64Array(K);
        for (let j = 0; j < K; j++) {
          let lg = 0; for (let t = 0; t < hd; t++) lg += q1s[i][h0 + t] * k1s[j][h0 + t];
          row[j] = lg / SQ1;
        }
        const w = sm6(row);
        for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < hd; t++) u1[h0 + t] += wj * v1s[j][h0 + t]; }
      }
      const ao = lin6(params, u1, H6, H6, oAO, false);
      const e1 = new Float64Array(H6);
      for (let t = 0; t < H6; t++) e1[t] = e0s[i][t] + ao[t];
      e1s.push(e1);
    }
    const enc = new Map(), ectx = [];
    for (let i = 0; i < K; i++) {
      const r1 = rms6(e1s[i], H6);
      const ffh = lin6(params, r1, H6, FFH, oRF1, true);
      const ffo = lin6(params, ffh, FFH, H6, oRF2, false);
      const ec = new Float64Array(H6);
      for (let t = 0; t < H6; t++) ec[t] = e1s[i][t] + ffo[t];
      ectx.push(ec);
      enc.set(ids6[i], ec);
    }
    const q2 = lin6(params, hSelf, L.hid, FFH, oXQ, false);
    const k2s = [], v2s = [];
    for (let j = 0; j < K; j++) {
      const r2 = rms6(ectx[j], H6);
      k2s.push(lin6(params, r2, H6, FFH, oXK, false));
      v2s.push(lin6(params, r2, H6, FFH, oXV, false));
    }
    const cross = new Float64Array(FFH), SQ2 = Math.sqrt(H6);
    for (let m = 0; m < 2; m++) {
      const m0 = m * H6, row = new Float64Array(K);
      for (let j = 0; j < K; j++) {
        let lg = 0; for (let t = 0; t < H6; t++) lg += q2[m0 + t] * k2s[j][m0 + t];
        row[j] = lg / SQ2;
      }
      const w = sm6(row);
      for (let j = 0; j < K; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H6; t++) cross[m0 + t] += wj * v2s[j][m0 + t]; }
    }
    const oppMax = new Float64Array(H6);
    let hasOpp = false;
    for (let j = 0; j < K; j++) {
      if (isSelfArr[j]) continue;
      if (!hasOpp) { oppMax.set(ectx[j]); hasOpp = true; }
      else for (let t = 0; t < H6; t++) if (ectx[j][t] > oppMax[t]) oppMax[t] = ectx[j][t];
    }
    const xin = new Float64Array(L.ctxDim);
    xin.set(hSelf, 0); xin.set(cross, L.hid); xin.set(oppMax, L.hid + FFH);
    if (TP) TP.xin = Float64Array.from(xin);
    if (L.norm) { const mu = L.norm.mean, sd = L.norm.std; for (let i = 0; i < L.ctxDim; i++) xin[i] = (xin[i] - mu[i]) / sd[i]; }
    const hctx = lin6(params, xin, L.ctxDim, L.hid, oCtx, true);

    const KH = new Map();
    (R.skills || []).forEach((s, idx) => KH.set(typeof s === 'string' ? s : (s.key || s.id), idx));
    const n = cands.length, logits = new Float64Array(n);
    const afbuf = new Float64Array(L.actIn), ci = new Float64Array(L.candIn), zeroSeat = new Float64Array(H6);
    const tb1 = oTB, tb2 = oTB + H6 * L.actH, skB = oSK + L.skills * L.hid;
    for (let i = 0; i < n; i++) {
      const cp = candOf(W, sc, cands[i]);
      let m2 = 0;
      for (let j = 0; j < cp.base.length; j++) afbuf[m2++] = cp.base[j];
      for (let j = 0; j < cp.idOne.length; j++) afbuf[m2++] = cp.idOne[j];
      if (m2 !== L.actIn) throw new Error('obs6 布局不自洽：actIn=' + m2 + ' ‖ ' + L.actIn);
      const ae = lin6(params, afbuf, L.actIn, L.actH, oAct, true);
      const t1 = cands[i].target == null ? null : cands[i].target;
      const t2 = cands[i].target2 == null ? null : cands[i].target2;
      const te1 = t1 != null && enc.has(t1) ? enc.get(t1) : zeroSeat;
      const te2 = t2 != null && enc.has(t2) ? enc.get(t2) : zeroSeat;
      ci.set(hctx, 0); ci.set(ae, L.hid); ci.set(te1, L.hid + L.actH); ci.set(te2, L.hid + L.actH + H6);
      const hc = lin6(params, ci, L.candIn, L.hid2, oCand, true);
      const ki = KH.has(cands[i].key) ? KH.get(cands[i].key) : -1;
      if (TP) { TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.skillIdx.push(ki); TP.keys.push(DK(cands[i])); }
      let v = params[oHead + L.hid2];
      for (let j = 0; j < L.hid2; j++) v += params[oHead + j] * hc[j];
      if (ki >= 0 && ki < L.skills) {
        let sk = params[skB + ki];
        const wRow = oSK + ki * L.hid;
        for (let j = 0; j < L.hid; j++) sk += params[wRow + j] * hctx[j];
        v += sk;
      }
      let b1 = 0, b2 = 0;
      for (let r = 0; r < H6; r++) {
        let u1 = 0, u2 = 0;
        const r1 = tb1 + r * L.actH, r2 = tb2 + r * L.actH;
        for (let c = 0; c < L.actH; c++) { const ac = ae[c]; u1 += params[r1 + c] * ac; u2 += params[r2 + c] * ac; }
        b1 += u1 * te1[r]; b2 += u2 * te2[r];
      }
      v += b1 + b2;
      logits[i] = v;
    }
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

  function forwardCands(W, state, pid, cands, params, opts2) {
    const L = params && params.p2;
    if (!L) throw new Error('EpirusPolicy2.forwardCands: params 不是 2.0 张量 ⇒ 该走 v7 那条路');
    if (L.input === 'obs6') return forwardObs6(W, state, pid, cands, params, opts2);
    const R = W.EpirusRules;
    /* Stage A：决策键的唯一实现（与 arch2 的 DK 同式）——键层分组决定"目标函数与门看得见什么" */
    const CHARGE_KEY = (R.SK && R.SK.CHARGE) || 'charge';
    const DK = (c) => (c && L.keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);
    const sc = scene(W, state, pid, L.input);
    /* 11-10：一律按段名查——obs5 在 seatEnc 后插了 attn/pma 两段，seg[1..4] 的下标假设已不成立
     *   （obs3 族名字与下标恰好同值，逐位不变）。 */
    const segOff = (nm) => L.seg.find((sg) => sg.name === nm).off;
    const seatBias = segOff('seatEnc') + L.seatH * L.seatIn;
    const actBias = segOff('actEnc') + L.actH * L.actIn;
    const ctxBias = segOff('ctx') + L.hid * L.ctxDim;
    const candBias = segOff('cand') + L.hid2 * L.candIn;
    const headOff = segOff('policyHead');
    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');

    const svBuf = new Float64Array(L.seatIn);
    const enc = new Map();
    const v4 = L.input === 'obs4';
    const v5 = L.input === 'obs5';   /* obs5：聚合走 attention+PMA（特征与 obs4 同一 scene） */
    const mean = new Float64Array(L.seatH), mx = new Float64Array(L.seatH);
    const zeroSeat = new Float64Array(L.seatH);
    let hSelf = zeroSeat, poolN = 0;
    const PUBN = L.pubN;                      /* obs3=22 ‖ obs3b=81 ‖ obs4=29（席位公开段宽，随面走） */
    /* 梯度旁路（ZCode · 10-31）：wantTape=1 捎反传输入，与 arch2 forwardObs3 同位同序（selftest3 parity 腿钉） */
    const TP = (opts2 && opts2.wantTape) ? { svs: [], afs: [], t1: [], t2: [], keys: [], xin: null } : null;
    for (const s of sc.seats) {
      /* obs5：死亡席**不进集合**（不编码、不占 softmax、不进 tape）——注意力集合 = 活席；
       *   观测面"已淘汰"信息由 sit 的淘汰数维承载，不给死席发 bias 泄漏的假嵌入。 */
      if (v5 && !(s.isSelf === 1 || s.public[14] === 1)) continue;
      let k = 0;
      for (let j = 0; j < PUBN; j++) svBuf[k++] = s.public[j];
      for (let j = 0; j < 5; j++) svBuf[k++] = s.rel[j];
      svBuf[k++] = s.isSelf;
      if (k !== L.seatIn) throw new Error('布局不自洽：逐席拼进 ' + k + ' 而 seatIn=' + L.seatIn);
      const e = new Float64Array(L.seatH);
      encode(params, svBuf, L.seatIn, L.seatH, WS, seatBias, e);
      enc.set(s.id, e);
      if (TP) TP.svs.push({ id: s.id, sv: Float64Array.from(svBuf) });
      /* obs4：槽位即席位（scene 里按 pid 序），无池化累积 */
      if (!v4 && !v5) {
        if (s.isSelf) { hSelf = e; continue; }
        poolN++;
        for (let j = 0; j < L.seatH; j++) { mean[j] += e[j]; if (e[j] > mx[j]) mx[j] = e[j]; }
      }
    }
    if (!v4 && !v5) {
      const kk = Math.max(1, poolN);
      for (let j = 0; j < L.seatH; j++) mean[j] /= kk;
    }

    /* ---- obs5 注意力聚合（11-10 ZCode）——与 arch2 forwardObs3 / pg-lib tapeForward 逐字同源，改一处必改三处 ----
     *   活席集合上的自注意力（QKV 线性投影 /√H 掩码 softmax，残差直连）→ PMA（4 seed 查询，keys/values
     *   重读注意力后语境向量 ē）。置换不变与跨人数泛用由结构成立：softmax 作用在"在场集合"上，K 不进权重。 */
    const pooled5 = new Float64Array(L.poolN * L.seatH);
    if (v5) {
      const H5 = L.seatH, SQ5 = Math.sqrt(H5);
      const atS = L.seg.find((s) => s.name === 'attn'), pmS = L.seg.find((s) => s.name === 'pma');
      const WQ = atS.off, BQ = WQ + H5 * H5;
      const WKg = BQ + H5, BKg = WKg + H5 * H5;
      const WVg = BKg + H5, BVg = WVg + H5 * H5;
      const WQ2 = pmS.off, BQ2 = WQ2 + H5 * H5, SD0 = BQ2 + H5;
      const lin5 = (src, wOff, bOff) => { const out = new Float64Array(H5); for (let j = 0; j < H5; j++) { let s5 = params[bOff + j]; const base = wOff + j * H5; for (let i = 0; i < H5; i++) s5 += params[base + i] * src[i]; out[j] = s5; } return out; };
      const sm5 = (row) => { let m5 = -Infinity; for (let j = 0; j < row.length; j++) if (row[j] > m5) m5 = row[j]; let s5 = 0; const w = new Float64Array(row.length); for (let j = 0; j < row.length; j++) { w[j] = Math.exp(row[j] - m5); s5 += w[j]; } for (let j = 0; j < row.length; j++) w[j] /= s5; return w; };
      const es5 = [];
      for (const s of sc.seats) if (enc.has(s.id)) es5.push(enc.get(s.id));   // sc.seats = pid 序 ⇒ 求和序确定
      const K5 = es5.length;
      const qs5 = [], ks5 = [], vs5 = [];
      for (let i = 0; i < K5; i++) { qs5.push(lin5(es5[i], WQ, BQ)); ks5.push(lin5(es5[i], WKg, BKg)); vs5.push(lin5(es5[i], WVg, BVg)); }
      const ebs5 = [];
      for (let i = 0; i < K5; i++) {
        const row = new Float64Array(K5);
        for (let j = 0; j < K5; j++) { let lg = 0; for (let t = 0; t < H5; t++) lg += qs5[i][t] * ks5[j][t]; row[j] = lg / SQ5; }
        const w = sm5(row);
        const eb = new Float64Array(H5);
        for (let j = 0; j < K5; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H5; t++) eb[t] += wj * vs5[j][t]; }
        for (let t = 0; t < H5; t++) eb[t] += es5[i][t];   // 残差：席位原始嵌入直通，信息全覆盖不过瓶颈
        ebs5.push(eb);
      }
      const kbs5 = [], vbs5 = [];
      for (let j = 0; j < K5; j++) { kbs5.push(lin5(ebs5[j], WKg, BKg)); vbs5.push(lin5(ebs5[j], WVg, BVg)); }
      for (let d = 0; d < L.poolN; d++) {
        const seed = new Float64Array(H5);
        for (let t = 0; t < H5; t++) seed[t] = params[SD0 + d * H5 + t];
        const q2d = lin5(seed, WQ2, BQ2);
        const row = new Float64Array(K5);
        for (let j = 0; j < K5; j++) { let lg = 0; for (let t = 0; t < H5; t++) lg += q2d[t] * kbs5[j][t]; row[j] = lg / SQ5; }
        const w = sm5(row);
        for (let j = 0; j < K5; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H5; t++) pooled5[d * H5 + t] += wj * vbs5[j][t]; }
      }
    }

    const xin = new Float64Array(L.ctxDim);
    let q2 = 0;
    for (let i = 0; i < sc.g.length; i++) xin[q2++] = sc.g[i];
    for (let i = 0; i < sc.priv.length; i++) xin[q2++] = sc.priv[i];
    for (let i = 0; i < sc.seq.length; i++) xin[q2++] = sc.seq[i];
    for (let i = 0; i < sc.sums.length; i++) xin[q2++] = sc.sums[i];
    if (v4) {
      /* obs4：局面比较 4 维 + **8 个槽位嵌入**（slot = pid 0..7；空槽/已淘汰 = 零向量）——没有 mean/max */
      for (let i = 0; i < (sc.sit || []).length; i++) xin[q2++] = sc.sit[i];
      for (let s = 0; s < 8; s++) { const e = enc.has(s) ? enc.get(s) : zeroSeat; for (let j = 0; j < L.seatH; j++) xin[q2++] = e[j]; }
    } else if (v5) {
      /* obs5：局面比较 4 维（直接可读）+ PMA 池 4×seatH（内容寻址，K 自由）——没有 mean/max、没有槽位身份 */
      for (let i = 0; i < (sc.sit || []).length; i++) xin[q2++] = sc.sit[i];
      for (let i = 0; i < pooled5.length; i++) xin[q2++] = pooled5[i];
    } else {
      for (let j = 0; j < L.seatH; j++) xin[q2++] = hSelf[j];
      for (let j = 0; j < L.seatH; j++) xin[q2++] = mean[j];
      for (let j = 0; j < L.seatH; j++) xin[q2++] = mx[j];
    }
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
