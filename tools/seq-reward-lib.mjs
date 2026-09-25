/* 序列奖励（"蓄能[电珠] → 下一回合电磁炮"完成时给 W ep）—— v1.5.229 · 用户批准的方案 (a)
 *
 * ## 为什么是"内存里"的
 * 与 `tools/kill-reward-lib.mjs` 同一族：**仓库文件一字不动 ⇒ 规则指纹不变**，默认关（`EPIRUS_SEQ_W=0`）时行为逐字不变。
 * ⚠️ 代价（写在这里免得以后有人忘）：用了这个旋钮训出来的包是在**另一套经济**下长大的，**不能当"现状规则下的冠军"用**；
 *   v1.5.226 起 `meta.recipe.env` 会自动把 `EPIRUS_SEQ_W` 记进去 ⇒ 事后可查。
 *   若这一刀要上产品，必须改 `js/core/rules.js`（**规则换代**：新指纹、全部历史基线作废）——那是**另一个决定**。
 *
 * ## 为什么不用"打源码补丁"
 * `kill-reward-lib` 要在 `resolve.js` 里插钩子是因为"死亡/伤害归因"只有结算内部才有。
 * 而**本奖励需要的信息事件流里已经有了**：
 *   · 蓄能（选择电珠）⇒ `ev({ type: 'bead', pid, kind: 'elec' })`（`resolve.js` 的 `case SK.CHARGE`）
 *   · 电磁炮真放出去 ⇒ `ev({ type: 'action', pid, key: 'railgun', outcome: 'ok' })`
 * ⇒ 只要在**决策点**上扫一次新增事件，就能判定"这两件事是不是同一个人的、且间隔一回合"。
 *   注入点 = 包一层 `EpirusTrainer.policyChooserN`（与 `probe-layer-caliber.mjs` 的包装同族，**一处覆盖所有路径**）。
 *
 * ## 语义（与"珠子只活一回合"的规则对齐）
 * 电珠在**下一回合**可用、之后失效 ⇒ "能打出电磁炮"本身就意味着"该席**上一回合自己充过电珠**"
 *   （`p.elec` 每回合末清空，电磁炮又必须持有电珠）⇒ 判定用**事件顺序**即可：见 `bead(elec,pid)` 挂起，
 *   随后该席真的打出 `railgun` 就付钱。
 * ⚠️ 我试过再加一层"恰好隔一回合"的严格校验（`state.round === pend+1`），结果发放从 71 次**掉到 0** ——
 *   因为 `tick` 跑在**回合动作结算之前**（决策点），回合号比较恒不成立 ⇒ 那是**时机 bug**，不是严格性。
 *   已回退：现有判定的误差方向是**漏付**（tick 没夹在中间时少付，实测 71/86 ≈ 83%），不是多付。
 *
 * ## 付款时机
 * 付款发生在**下一个决策点**（任意席位）而不是结算那一刻 —— 于是它只影响**后续**决策的可负担性（这正是我们要的），
 * 且不依赖任何引擎内部钩子。`__seqCur`/`__seqPend` 都挂在 `state` 上 ⇒ 天然按局隔离。
 */
export function makeSeqReward(R, W) {
  const w = Number(W) || 0;
  if (!w) return null;
  const KR = R.SK.RAILGUN;
  return {
    w: w, paid: 0, events: 0, granted: [], charges: 0, firstCharge: -1, firstPayRound: -1,   // granted：给谁、第几局，便于自证
    /** 每个决策点调一次。**幂等**：同一事件不会被处理两次（cursor 记账）。 */
    tick: function (state) {
      const evs = state.events, n = evs.length;
      let k = state.__seqCur || 0;
      const pend = state.__seqPend || (state.__seqPend = {});
      for (; k < n; k++) {
        const e = evs[k];
        if (e.type === 'bead' && e.kind === 'elec' && e.pid != null) { pend[e.pid] = 1; this.charges++; if (this.firstCharge < 0) this.firstCharge = state.round; }
        else if (e.type === 'action' && e.outcome === 'ok' && !e.voided && e.key === KR && e.pid != null && pend[e.pid]) {
          delete pend[e.pid];
          state.p[e.pid].ep += w;
          state.events.push({ type: 'ep', pid: e.pid, delta: w, reason: '序列奖励(蓄能→电磁炮)' });
          this.paid += w; this.events++;
          this.granted.push(e.pid); if (this.firstPayRound < 0) this.firstPayRound = state.round;
        }
      }
      state.__seqCur = evs.length;   // ⚠️ 用**扫描后**的长度：中途 push 的那条 ep 事件不该被再扫一遍
    },
    /** 包一层 chooser 工厂：返回的每个 chooser 都先 tick（覆盖 mirrorHealth / 评估 / 真桌所有路径）。 */
    wrapChooserFactory: function (factory) {
      const self = this;
      return function () {
        const f = factory.apply(null, arguments);
        if (typeof f !== 'function') return f;
        return function (st, pid, legal) { self.tick(st); return f(st, pid, legal); };
      };
    }
  };
}
