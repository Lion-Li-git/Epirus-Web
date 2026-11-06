/* 「防御免费」反事实库（E23 · 09-26 夜班 · Qoder · **内存补丁，仓库一字不动 ⇒ 规则指纹不变**）
 *
 * ## 要问的问题（DS 的路子之外）
 * 用户报的两条病（"碰到攒钱的就疯狂防御并且维持很久" + "空蓄能"）在仓里被当成**训练侧**问题打了很久：
 *   击杀奖励（结构上碰不到龟）、序列奖励（六次 A/B 冠军逐字相同）、COUNTER_OPPS 上桌、SEL_LAND……
 * 但没人从**规则地形**做一次反事实：`js/core/rules.js` 里 **guard/reflect 这一族的费用是 0 ep**
 *   ⇒ "维持防御"在这套经济里几乎不要预算。若把费用调成非零，问题是**消失**、**变成弱**、还是**变成另一种塌缩**？
 *
 * ## 三档
 *   `off` = 不扣（对照组，必须与不打补丁**逐字相同** ⇒ 这是本库的自检）
 *   `L1`  = 只罚"**同席连续第 2 次起**的防御"（针对用户说的"维持很久"那半；第一次防御仍然免费 ⇒ 不误伤合理的挡枪）
 *   `L2`  = 每一次成功防御都扣 `cost` ep（防御不再免费；这是最猛的对照）
 *
 * ## 实现与它的**边界**（不许当成"改了规则"）
 * 注入点 = 包一层**决策者**：原始 chooser 选完之后，若本手是 `R.CAT.DEFENSE` 的成功动作 ⇒ 立刻从该席 `ep` 里扣。
 *   ⇒ 这是**事后扣**：它不阻止"当回合这一手"，只压缩**之后**的可选集（真改规则应当是"事前"从 `legal`/`affordable` 里摘掉，
 *     那要动 `rules.js`/`play.js` = **规则换代**，不在本实验权限内）。
 *   ⇒ 所以读数要这样读：**它衡量的是"防御占用预算"这件事的强度信号**，不是"设一个防御价格"的产品方案。
 *     若 L1/L2 让病消失但强度崩，那是"值得按规则换代去试"的证据；若病不消失，说明根不在免费上。
 * 记账：`billed`（扣了几次）· `epTaken`（共扣多少）· `guards`（看到的防御手）· `seats`（哪些席被扣过）
 *   ⇒ **空枪检测 = `dropped===0 且 epTaken===0`**（菜单一次没摘、钱一分没拿走 ⇒ 这一档没有作用点，读数作废，同 D123 的规矩）。
 *      ⚠️ 不要用 `billed===0` 当空枪：`cost` 很高时防御被整条摘光，正是"一枪没扣但满盘生效"的样子。 */
/* ## 关键的一刀（09-26 第一版就栽在这）：**事后扣是空枪**
 * 第一版"选完再扣 ep"实测 `billed=21 / epTaken=1` ⇒ 防御恰恰是在**手里没钱**时选的（它本来免费），
 *   从一个已经是 0 的余额里扣 1 ⇒ 什么都没发生 ⇒ 三档读数逐字相同（我差点把"没反应"当成结论报出去）。
 * ⇒ 正确的反事实必须**事前**：把买不起的防御卡**从菜单里摘掉**（与仓里已有的三道菜单闸同形状：
 *   `CHARGE_MIN_EP`(v1.5.82) / `hasPurgeable`(v1.5.199) / 天火闸(v1.5.139)），真选了再扣。
 * 记账：`dropped`（被摘掉的防御选项数）· `billed`/`epTaken`（实际扣了多少）⇒ **两个都为 0 就是空枪**，读数作废。 */
export function makeGuardCost(R, S, opts) {
  const o = opts || {};
  const mode = o.mode || 'off';
  /* ⚠️ 不许写 `Number(o.cost || 1)`：**`--cost=0` 会被 `||` 吞成 1** ⇒ "零价对照组"实际跑成了 1ep 组，
   *   而这条恰好是本实验的**空枪自检**要用的那一档（同族事故：v1.5.174 的 `drainHpMax` 也是 `|| 1` 让 0 关不掉）。 */
  const cost = (o.cost === undefined || o.cost === null || o.cost === '') ? 1 : Number(o.cost);
  let RULES = R || null;                       // route ① 时沙箱还没建好 ⇒ 允许事后 bindRules
  const st = { mode: mode, cost: cost, billed: 0, epTaken: 0, guards: 0, dropped: 0, seats: {} };
  function isDef(key) {
    if (!RULES || !key) return false;
    const DEF = RULES.CAT ? RULES.CAT.DEFENSE : 'defense';
    const d = RULES.byKey && RULES.byKey[key];
    return !!(d && d.cat === DEF);
  }
  return {
    stat: st,
    /** 包一层决策者：返回与 `f` 同签名的 (state, seatIdx, legal, econ) => pick
     *  （route ① 的 evo 包装层与调用方**共用这一个函数** ⇒ 两条路必然同一把尺） */
    wrapOne: function (f) {
      if (mode === 'off') return f;
      return function (state, seatIdx, legal, econ) {
        const prev = state.__gcPrev || {};
        const me = state.p && state.p[seatIdx];
        const ep = me ? (me.ep || 0) : 0;
        /* L1 只罚"同席连续第 2 次起"的防御 ⇒ 只有上一次也是防御时才对菜单上锁 */
        const chained = !!prev[seatIdx] && isDef(prev[seatIdx]);
        const gate = mode === 'L2' || (mode === 'L1' && chained);
        let lg = legal;
        if (gate && ep < cost && Array.isArray(legal)) {
          const f2 = legal.filter(function (l) { return !isDef(l && l.key); });
          st.dropped += legal.length - f2.length;
          lg = f2.length ? f2 : legal;   // 摘到空了就退回原菜单（不许造出"无路可走"的假局）
        }
        const pick = f(state, seatIdx, lg, econ);
        const pid = (pick && typeof pick.pid === 'number') ? pick.pid : seatIdx;
        state.__gcPrev = state.__gcPrev || {};
        state.__gcPrev[pid] = pick && pick.key ? pick.key : '';
        if (pick && isDef(pick.key)) {
          st.guards++;
          const p = state.p && state.p[pid];
          if (p) {
            const take = Math.min(cost, Math.max(0, p.ep || 0));
            p.ep = Math.max(0, (p.ep || 0) - cost);
            st.billed++; st.epTaken += take; st.seats[pid] = (st.seats[pid] || 0) + 1;
          }
        }
        return pick;
      };
    },
    bindRules: function (R) { RULES = R; },
    /** 每局开始前清掉跨局残留（防"上一局的连防记忆"漂进下一局） */
    resetGame: function (state) { if (state) { state.__gcPrev = {}; } }
  };
}

/** 一行自证文案（调用方必须印，否则读数无法判"补丁到底有没有开火"） */
export function formatGuardCost(st) {
  return '[' + st.mode + ' cost=' + st.cost + '] 防御 ' + st.guards + ' 手 · 实扣 ' + st.billed + ' 次/' + st.epTaken +
    'ep · **摘掉菜单项 ' + st.dropped + ' 个**' + (st.dropped === 0 && st.epTaken === 0 ? ' ⇒ ⛔ 空枪，读数作废' : '');
}

/* ===== route ①：改 `evo.js` 源码，让**内部调用点**（mirrorHealth/selfPlay 那一族）也走同一把尺 =====
 * 锚点与替换手法抄 `seq-reward-lib.patchEvoChooser` 的教训：**第二次替换必须锚在改名后的那行上**
 *   （v1.5.232 第一版拿同一个锚点替换两次 ⇒ 包装层根本没插进去，靠自证打印才抓到）。 */
export function patchEvoGuard(txt) {
  const A = '  function policyChooserN(params, temp, eps, epsK, epsMode) {';
  if (txt.indexOf(A) < 0) throw new Error('guard-cost: evo.js 的 policyChooserN 锚点没找到（引擎改过？）');
  const RAW = '  function __policyChooserN_raw(params, temp, eps, epsK, epsMode) {';
  return txt
    .replace(A, RAW)
    .replace(RAW,
      '  function policyChooserN(params, temp, eps, epsK, epsMode) {\n' +
      '    const f = __policyChooserN_raw(params, temp, eps, epsK, epsMode);\n' +
      '    return (typeof __INJ !== \'undefined\' && __INJ && __INJ.guard) ? __INJ.guard.wrapOne(f) : f;\n' +
      '  }\n' + RAW);
}

/** 建一个"防御已定价"的沙箱：内部调用点与属性层调用点**共用同一个记账器**（同一个 `wrapOne`） */
export function buildGuarded(buildFn, pack, opts, caliber) {
  const c = caliber || {};
  const gc = makeGuardCost(null, null, opts);
  const ctx = buildFn({
    on: !!c.on, pack: pack, temp: c.temp, eps: c.eps, epsK: c.epsK, epsMode: c.epsMode,
    mutate: (opts && opts.mode !== 'off') ? patchEvoGuard : undefined,
    inject: { guard: gc }
  });
  gc.bindRules(ctx.sb.EpirusRules);
  return { ctx: ctx, gc: gc };
}
