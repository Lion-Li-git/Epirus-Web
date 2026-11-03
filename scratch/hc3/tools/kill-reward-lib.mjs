/* 击杀奖励规则的**单一来源**实现（v1.5.194 · 实验用，不改仓库引擎）
 *
 * 为什么单独成一个模块：`tools/probe-kill-reward.mjs`（量具）与 `tools/train-3p.mjs`（训练）必须跑
 * **同一份规则**。本仓为"同一规则写两遍"栽过六次（`FEAS_N` / `ECON_ENV_KEYS` / `pierceKeys` /
 * `HOLO_GIFT_MAX` / 承诺局 `% 3` / `countBigCards` 口径），而这次两遍跑在不同进程里、比对的是冠军产物，
 * 一旦漂移就是"训出来的冠军和量出来的冠军不是一套规则"这种最坏的错误。
 *
 * ## 三条规则（用户 09-23 夜给的）
 * - **规则 1（单点）**：本回合有人死亡 ⇒ 回 **1 ep** 给"所用技能**优先级最高**"的参与者；
 *   同优先级取**开销最高**者；若仍并列（同 pri 同 cost 的**不同角色**）⇒ **都不回**。
 * - **规则 2（按伤害）**：每个参与者按**造成的有效伤害**回等量 ep；"结算时目标已归零"的那份不给（overkill 不付费）。
 * - 两条都吃下面三个**归因/开销口径**（用户明确点名）：
 *   ① **蓄能算进开销**：电磁炮（需 1 电珠）/ 激光眼（首次需 1 爆珠）⇒ 等价于多耗 1 ep ⇒ 规则 1 的同优先级判定里占优；
 *   ② **无来源的天火、地雷也要回 ep**：`damage.source` 对它们是 `null`（**R57 规则语义，不许改成有来源**）
 *      ⇒ 所以补三个**独立归因字段** `mineFrom` / `fireFrom` / `transferBy`，只用于本实验的奖励归因；
 *   ③ **转移伤害造成的伤害 = 其转移的伤害**：被 `转移伤害` 转走的那一份，功劳记给**转移者**（`--kr-transfer=source` 可切成"记给原攻击者"）。
 *
 * ## 实现方式
 * 在**内存里**给 `js/core/resolve.js` 与 `js/core/play.js` 打字符串补丁（锚点找不到就抛错 —— 静默没打上补丁
 * 等于"三档跑同一个引擎"，那是本仓最恨的 A/A 假实验），然后把 `__KR.pre/post` 挂在
 * `autoGameN` 的 `resolveActions` 之后、`endTurn` 之前。仓库文件一字未动 ⇒ 规则指纹 `ebdbff36` 不变。
 */

/* ---------- 补丁 ---------- */
const NL_OF = function (txt) { return txt.indexOf('\r\n') >= 0 ? '\r\n' : '\n'; };
function must(txt, anchor, what) {
  if (txt.indexOf(anchor) < 0) throw new Error('[kill-reward] ' + what + ' 的锚点找不到 ⇒ 引擎改过了，补丁没打上。' +
    '宁可直接抛错也不许静默跑（静默 = 实验作废）。');
  return txt;
}

export function patchResolve(txt) {
  const NL = NL_OF(txt);
  /* ① `rawDamage` 的事件加三个归因字段（**不动 `source`** —— 它是 R57 的规则语义，且是大雷连带的输入） */
  const evAnchor = "    ev(state, { type: 'damage', to, amt: hit, reason, via: via || reason, source: (opts.source != null ? opts.source : null) });";
  must(txt, evAnchor, 'resolve.js 的 damage 事件');
  txt = txt.replace(evAnchor,
    "    ev(state, { type: 'damage', to, amt: hit, reason, via: via || reason, source: (opts.source != null ? opts.source : null)," +
    ' mineFrom: (opts.mineFrom != null ? opts.mineFrom : null), fireFrom: (opts.fireFrom != null ? opts.fireFrom : null),' +
    ' transferBy: (opts.transferBy != null ? opts.transferBy : null) });');
  /* ② 天火：引爆者记进 `fireFrom` */
  const fireAnchor = "if (!protoBlock) rawDamage(state, v, 1, '天火', 'firestorm', { type: R.DMG.FIRE });";
  must(txt, fireAnchor, 'resolve.js 的天火伤害');
  txt = txt.replace(fireAnchor, "if (!protoBlock) rawDamage(state, v, 1, '天火', 'firestorm', { type: R.DMG.FIRE, fireFrom: i });");
  /* ③ 转移：把"转移者"带进被转走的那一份 */
  const trAnchor = "const redir = Object.assign({}, dmg, { redirected: true, noMine: true });";
  must(txt, trAnchor, 'resolve.js 的转移伤害');
  txt = txt.replace(trAnchor, "const redir = Object.assign({}, dmg, { redirected: true, noMine: true, transferBy: to });");
  /* ④ `deliverDamage` 往下透传 `transferBy`（它重建 opts，不传就丢） */
  const ddAnchor = "rawDamage(state, to, dmg.amt, ctx.reason || via || '', via, { fromChain: dmg.fromChain, type: dmg.type, source: (dmg.source != null ? dmg.source : null) });";
  must(txt, ddAnchor, 'resolve.js 的 deliverDamage');
  txt = txt.replace(ddAnchor, "rawDamage(state, to, dmg.amt, ctx.reason || via || '', via, { fromChain: dmg.fromChain, type: dmg.type, source: (dmg.source != null ? dmg.source : null), transferBy: (dmg.transferBy != null ? dmg.transferBy : null) });");
  void NL;
  return txt;
}

export function patchPlay(txt) {
  const NL = NL_OF(txt);
  const a1 = '      X.resolveActions(state);' + NL + '      X.endTurn(state);';
  must(txt, a1, 'play.js 的结算');
  const a2 = '      for (let pid = 0; pid < N; pid++) {' + NL + '        if (!picks[pid]) continue;';
  must(txt, a2, 'play.js 的行动前');
  return txt
    .replace(a1, '      X.resolveActions(state);' + NL + '      if (global.__KR) global.__KR.post(state);' + NL + '      X.endTurn(state);')
    .replace(a2, '      if (global.__KR) global.__KR.pre(state);' + NL + a2);
}

/* ---------- 开销口径（蓄能计进开销） ---------- */
/** "开销比较值"（规则 1 同优先级时的判据，用户 09-23 夜点名：**蓄能要算进开销 ⇒ 等价于多耗 1ep**）。
 *
 * ⚠️ **不自己写一份费用规则**：卡表里 `聚能环 / 激光眼 / 过载炮` 的 `cost` 是 **`null`**（动态费用，真值在
 *   `state.js:computeCost` 里）⇒ 直接读 `def.cost` 会把它们当成 0，"蓄能加价"就加在了空气上。
 *   所以动态费用一律**问引擎**（`computeCost` 在一个标准空局上的首次值），与 `skill-report.costOf` 同一口径。
 * 结果（实测）：枪 1 · 狙击 2 · 大雷 5 · 电磁炮 2+1=**3** · 激光眼 1+1=**2**（续招路径本身也是 2 ⇒ 平价）·
 *   聚能环 3 · 过载炮 2。 */
export function buildCostOf(R, S) {
  const cache = {};
  return function (key) {
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    let c = (R.byKey[key] || {}).cost;
    if (c == null) {
      c = 0;
      try {
        const st = S.createState('multi', { next: function () { return 0.5; } }, 3);
        for (let i = 0; i < st.p.length; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
        const r = S.computeCost(st, 0, key);
        if (r && r.ok) c = r.ep || 0;
      } catch (e) { c = 0; }
    }
    if (key === R.SK.RAILGUN || key === R.SK.LASER_EYE) c += 1;   // 蓄能：攒一颗珠等价于多花 1ep
    cache[key] = c;
    return c;
  };
}
export function priOf(R, key) { return (R.byKey[key] || {}).pri || 0; }

/* ---------- 规则本体 ---------- */
/** @param mode 0=现状（不打钩子）/ 1=单点 / 2=按伤害
 *  @param opts {transfer:'owner'|'source', log:boolean} */
export function makeKR(R, S, mode, opts) {
  const o = opts || {};
  const transferTo = o.transfer === 'source' ? 'source' : 'owner';
  const costOf = buildCostOf(R, S);
  if (!mode) return null;
  const attributionOf = function (e) {
    /* ③ 转移：记给转移者（`transferBy`），除非显式要求记给原攻击者 */
    if (transferTo === 'owner' && e.transferBy != null) return e.transferBy;
    if (e.source != null) return e.source;
    /* ② 无来源的地雷 / 天火：用补出来的归因字段 */
    if (e.mineFrom != null) return e.mineFrom;
    if (e.fireFrom != null) return e.fireFrom;
    return null;                                          // 铁索传导/反弹自伤/禁用扣血那类 ⇒ 无人可归因 ⇒ 都不回
  };
  return {
    mode: mode, paid: 0, events: 0,
    pre: function (state) {
      state.__krHp = state.p.map(function (q) { return q.hp; });
      state.__krMark = state.events.length;
      state.__krPaid = 0;
    },
    post: function (state) {
      if (!state.__krHp) return;
      for (let v = 0; v < state.p.length; v++) {
        if (!(state.__krHp[v] > 0) || state.p[v].hp > 0) continue;   // 本回合新死的人
        let hp = state.__krHp[v];
        const pay = [];
        for (let i = state.__krMark; i < state.events.length; i++) {
          const e = state.events[i];
          if (e.type !== 'damage' || e.to !== v || !(e.amt > 0)) continue;
          const src = attributionOf(e);
          if (src == null) continue;
          const dead = hp <= 0;
          const eff = Math.min(e.amt, hp);
          hp -= eff;
          if (dead && mode === 2) continue;                          // overkill 不付费（规则 2 原话）
          pay.push({ src: src, key: e.via, eff: eff });
        }
        if (!pay.length) continue;
        if (mode === 1) {
          const score = function (p) { return { pri: priOf(R, p.key), cost: costOf(p.key) }; };
          let best = null;
          for (const p of pay) {
            const q = score(p);
            if (!best || q.pri > best.pri || (q.pri === best.pri && q.cost > best.cost)) best = { pri: q.pri, cost: q.cost, src: p.src };
          }
          const rival = pay.some(function (p) {
            const q = score(p);
            return p.src !== best.src && q.pri === best.pri && q.cost === best.cost;
          });
          if (!rival) { state.p[best.src].ep += 1; state.__krPaid++; }
        } else if (mode === 2) {
          for (const p of pay) { if (p.eff > 0) { state.p[p.src].ep += p.eff; state.__krPaid++; } }
        }
      }
    },
    /** 跑完一批之后累计发放次数（供"下达必读回"与门使用） */
    tally: function (state) { this.paid += state.__krPaid || 0; this.events++; }
  };
}
