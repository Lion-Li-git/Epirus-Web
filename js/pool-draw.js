/* 冠军池抽签（§E590 · v1）—— **产品与量具共用这一份实现**，谁都不许抄第二遍。
 *
 * 为什么单独成一个文件而不是写进 `ui.js`：门禁 `D234` 与量具 `tools/probe-pool.mjs` 都必须跑**同一套**抽签，
 *   否则量具量到的是"我以为产品会怎么抽"，不是产品实际怎么抽（规矩 134 那一族：判据的主语要与被测对象同源）。
 *   `tools/audit-lib.mjs` 的 `CORE` 里含本文件 ⇒ 门与量具用 `sandbox()` 就能拿到同一个 `EpirusPoolDraw`。
 *
 * 用户裁定（2026-10-11 23:0x，逐字）：**「逐席不同枚来做吧，但是随机抽取结果不一定非得不同，可以有重复，不要全部重复就行」**
 *   ⇒ 三句话对应三段代码：① 逐席各抽一枚 ② 允许重复（档内成员数 < AI 席数时循环取）③ **不许四席全同**（撞了就重抽其中一席）。
 *
 * 纯函数、不碰 DOM、不读全局：`compose(members, aiSeats, rand)`。
 * 确定性：**只吃传进来的 rand**，不读时间、不自造种子 ⇒ 同一个 `slotSalt` 必然得到同一个组成。
 */
(function (global) {
  'use strict';

  /** 从整数造 [0,1) 随机流（与 `tools/audit-lib.mjs` 的 mulberry32 同式 —— 浏览器里没有 require，只能自带一份，
   *  所以口径靠 `D234` ④ 钉："同 salt 重放 ⇒ 组成逐字相同"，而不是靠注释保证两边一致）。 */
  function rng(seedInt) {
    var a = seedInt | 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** members: [{id,wid}]（**调用方负责按 tier 过滤好**） ‖ aiSeats: AI 席数 ‖ rand: ()=>[0,1)
   *  返回 { seats: [{id,wid,seat}], allSame, degraded }
   *  ⚠ `degraded` 不是"失败了"，是**必须被产品与判词说出来**的两种降级：池空 / 该档只有 1 枚（此时全同是数学必然）。 */
  function compose(members, aiSeats, rand) {
    var out = { seats: [], allSame: false, degraded: null };
    if (!members || !members.length) { out.degraded = 'empty'; return out; }
    if (!(aiSeats > 0)) { out.degraded = null; return out; }
    var pool = members.slice();
    /* 洗牌（Fisher-Yates，用同一个 rand）⇒ 优先不放回；成员不够就把洗牌后的序列循环补足（裁定②允许重复） */
    function shuffled() {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      return pool;
    }
    var order = shuffled();
    for (var s = 0; s < aiSeats; s++) out.seats.push(order[s % order.length]);
    /* 禁全同（裁定③）：撞了就重抽**其中一席**，最多 8 次；仍全同 ⇒ 只有"该档 1 枚"这一种可能，如实标降级 */
    var guard = 0;
    while (distinct(out.seats) === 1 && members.length > 1 && guard < 8) {
      var k = Math.floor(rand() * out.seats.length);
      order = shuffled();
      out.seats[k] = order[Math.floor(rand() * order.length)];
      guard++;
    }
    out.allSame = distinct(out.seats) === 1;
    if (out.allSame) out.degraded = members.length < 2 ? 'single-member-tier' : 'still-all-same';
    /* 席位号：AI 席按升序领组成里的第 0..n-1 枚（`ui.js` 那边 pid 也是升序，两边对得上才谈"同一套装配"） */
    var idx = 0;
    out.seats = out.seats.map(function (m) { return { id: m.id, wid: m.wid, seat: idx++ }; });
    return out;
  }
  function distinct(seats) {
    var seen = {};
    for (var i = 0; i < seats.length; i++) seen[seats[i].wid || seats[i].id] = 1;
    return Object.keys(seen).length;
  }

  /** 按档取成员（表/ bundle 里的 `tier` 字段）。没有这一档 ⇒ 返回 []（调用方负责降级并说出来）。 */
  function byTier(members, tier) {
    return (members || []).filter(function (m) { return m.tier === tier; });
  }

  global.EpirusPoolDraw = { rng: rng, compose: compose, byTier: byTier, distinct: distinct };
})(typeof window !== 'undefined' ? window : globalThis);
