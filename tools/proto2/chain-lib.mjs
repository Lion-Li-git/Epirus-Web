#!/usr/bin/env node
/* chain-lib.mjs — "攒够链"等脚本策略的**唯一实现**（千问 · 10-30 夜）
 * 为什么要拆出来：`chain-price.mjs`（读价格）与 `chain-clone.mjs`（把链装进最后一层）必须用**同一条规则**
 *   ⇒ 若各自抄一份，克隆出来的东西与定价的东西就不是同一个对象（本仓"两份同构实现必漂移"的老账）。
 * ⚑ 本文件**没有副作用**（不像 `chain-price.mjs` 那样一 import 就跑几千局）⇒ 可以被别的量具安全 import。
 */
import { mulberry32 } from '../audit-lib.mjs';

/* ===== 脚本策略：只在**引擎给的候选表**里按优先级挑，不自造合法性 =====
 * 候选表已经把经济与前置（珠、ジ、目标）筛过 ⇒ "链能不能成"完全由**出招次序**决定，不靠我改规则。 */
/* `pick`/`pickChain` 放在**模块级导出**：`chain-clone.mjs` 要把同一条"攒够链"当行为克隆的标签源
 *   ⇒ 只能有一份实现（本仓"两份同构必漂移"那条）。 */
export function pickKey(cs, key, beadWanted) {
  const list = cs.filter((c) => c && c.key === key);
  if (!list.length) return null;
  if (beadWanted) { const b = list.find((c) => c.bead === beadWanted); if (b) return b; }
  return list[0];
}
/* "攒够链"的决策规则（= §十八 的判据行）：见炮就开；无珠且 ep≥3 才蓄能；否则不花ジ。 */
export function pickChain(state, pid, cs, R) {
  const me = state.p[pid];
  const hasElec = (me.elec || 0) > 0;
  return pickKey(cs, R.SK.RAILGUN, 'elec')
    || (!hasElec && me.ep >= 3 ? (pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE)) : null);
}
export function makeScripts(W) {
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  const pick = pickKey;
  const asAct = (c) => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null });
  const csOf = (state, pid, legal) => P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
  const ji = (cs) => { const j = cs.filter((c) => c.key === R.SK.JI)[0]; return j ? asAct(j) : { key: R.SK.JI }; };
  const named = (name, fn) => ({ name, sel: function (state, pid, legal) {
    const cs = csOf(state, pid, legal); if (!cs.length) return { key: R.SK.JI };
    const a = fn(state, pid, cs, R); return a ? asAct(a) : ji(cs);
  } });
  return {
    /* 零件（在册阶梯的同口径，这里重跑一遍只为"同批可比"）*/
    onlyRail: named('只开电磁炮（有珠才开，否则ジ）', (s, p, cs, R) => pick(cs, R.SK.RAILGUN, 'elec')),
    onlyCharge: named('只蓄能（优先电珠，否则ジ）', (s, p, cs, R) => pick(cs, R.SK.CHARGE, 'elec') || pick(cs, R.SK.CHARGE)),
    /* 链：先开炮（若珠已在），否则蓄能铺下一拍 ⇒ 这就是"两跳" */
    chain: named('天真链：见炮就开，否则蓄', (s, p, cs, R) =>
      pick(cs, R.SK.RAILGUN, 'elec') || pick(cs, R.SK.CHARGE, 'elec') || pick(cs, R.SK.CHARGE)),
    /* 链 + 经济：蓄不上时走聚能环（环是"多拍"经济，本身就是长程计划的第一段）*/
    chainRing: named('天真链+环：见炮就开，否则蓄/环', (s, p, cs, R) =>
      pick(cs, R.SK.RAILGUN, 'elec') || pick(cs, R.SK.CHARGE, 'elec') || pick(cs, R.SK.RING) || pick(cs, R.SK.CHARGE)),
    /* 一步打到（短视对照）：1 ジ 的枪，无需任何前置 */
    onlyGun: named('只开枪（短视对照，1 ジ 立刻有伤害）', (s, p, cs, R) => pick(cs, R.SK.GUN)),
    /* 攒大雷：够 5 就落雷，否则继续攒（环优先，攒不动就ジ）*/
    saveBigT: named('攒大雷：纯攒(续免费环)→落雷', (state, pid, cs, R) => {
      const me = state.p[pid];
      /* ⚑ 纯攒：只在**环已经连着（streak>0 ⇒ 续环免费 0 ジ）**时白捡收入，绝不开新环
       *   —— 开新环要 3 ジ，而大雷门槛是 5 ジ：上一版让它在 ep≥3 时开环，结果它每局把ジ喂给环 9.9 次、
       *   一次都攒不到 5 ⇒ "大雷进表 0 次"是脚本自己的经济错误，不是引擎不给窗口。 */
      return pick(cs, R.SK.BIG_T) || (me && me.ringStreak > 0 ? pick(cs, R.SK.RING) : null);
    }),
    uniform: { name: '均匀乱选（无计划基线）', sel: (function () {
      const r = mulberry32(20261030);
      return function (state, pid, legal) {
        const cs = csOf(state, pid, legal);
        if (!cs.length) return { key: R.SK.JI };
        return asAct(cs[Math.floor(r() * cs.length)]);
      };
    })() },
    /* ⚑ 上面两条 `chain:*` 是**天真链**（能打就打、否则蓄）——实测它把每拍的ジ都花在蓄能上（蓄 15.2 次/局），
     *   下一拍就凑不齐电磁炮的 2 ジ ⇒ 电磁炮只响 0.05 次/局。那不是"链不值钱"，是**我的脚本不会经济**。
     *   所以补两条"攒够才铺"的competent 链：蓄能那一拍之后必须还剩 2 ジ（⇒ 出手时 `ep ≥ 3`）。
     *   判"链的价"要用这两条，天真链只留作"脚本自己踩坑"的证据。 */
    chainSave: named('攒够链：见炮就开·无珠且ep≥3才蓄', pickChain),
    chainSaveRing: named('攒够链+环：炮→蓄→环', (state, pid, cs, R) => {
      const me = state.p[pid];
      const hasElec = (me.elec || 0) > 0;
      return pick(cs, R.SK.RAILGUN, 'elec')
        || (!hasElec && me.ep >= 3 ? (pick(cs, R.SK.CHARGE, 'elec') || pick(cs, R.SK.CHARGE)) : null)
        || (me.ringStreak > 0 ? pick(cs, R.SK.RING) : (me.ep >= 3 ? pick(cs, R.SK.RING) : null));
    }),
  };
}
