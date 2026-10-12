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
   *  scriptMix（§E600-B 新增，可缺省）: `{seats:k, ids:['st:toolkit',...]}` = 把其中 k 个 AI 席换成**脚本席**。
   *    · 不传 / k=0 ⇒ 与今天逐字相同（老的量具与判据的主语没被偷换，这是硬要求）
   *    · 包的抽取**照常先做完**再替换位置 ⇒ 同一个 salt 下"包的阵容"不随掺不掺而变（掺席只是盖掉几席）
   *    · `allSame` / `degraded` 仍然只说**包席**的事；整桌都是脚本 ⇒ `degraded='all-script'`（必须被说出来，不许静默）
   *  返回 { seats: [{id,wid,seat,kind}], allSame, degraded, scriptSeats }
   *  ⚠ `degraded` 不是"失败了"，是**必须被产品与判词说出来**的三种降级：池空 / 该档只有 1 枚（全同是数学必然）/ 整桌脚本。 */
  function compose(members, aiSeats, rand, scriptMix) {
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
    out.seats = out.seats.map(function (m) { return { id: m.id, wid: m.wid, seat: idx++, kind: 'pack' }; });
    out.scriptSeats = 0;
    /* §E600-B 掺脚本席：在**已经抽好的包阵容**上盖掉 k 席 ⇒ 同一个 salt 下包的阵容不随掺不掺而变
     *   （否则"掺席"会把抽签整体重排，量具两侧的历史读数就没法配对了）。位置也用同一个 rand ⇒ 可复现。 */
    var sids = (scriptMix && scriptMix.ids && scriptMix.ids.length) ? scriptMix.ids : null;
    if (sids) {
      var k = Math.min(Math.max(0, scriptMix.seats | 0), out.seats.length);
      if (k > 0) {
        var order = [];
        for (var q = 0; q < out.seats.length; q++) order.push(q);
        for (var w = order.length - 1; w > 0; w--) {
          var v = Math.floor(rand() * (w + 1)); var tmp = order[w]; order[w] = order[v]; order[v] = tmp;
        }
        for (var z = 0; z < k; z++) {
          var at = order[z];
          out.seats[at] = { id: sids[z % sids.length], wid: null, seat: at, kind: 'script' };
        }
        out.scriptSeats = k;
        if (k === out.seats.length) out.degraded = 'all-script';
      }
    }
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

  /** §E600-B：这一档要掺几席脚本、掺谁 —— **页面与量具共用这一份推导**（谁都不许抄第二遍，规矩 134 那一族）。
   *  tier   = `bots.js` 的 `DIFF_TIERS` 里那一档（读它的 `scriptMix`）
   *  aiSeats = AI 席数 ‖ styles = `Bots.STYLES`（用来判"id 认不认得出"）
   *  返回 null（这档不掺）或 `{seats, ids, note}`；`note` 非空 = 有降级，调用方**必须说出来**（契约 §4）。 */
  function scriptSeats(tier, aiSeats, styles) {
    var sm = tier && tier.scriptMix;
    if (!sm) return null;
    if (!(aiSeats > 0)) return null;
    var raw = sm.ids || [];
    function known(id) {
      for (var i = 0; i < (styles || []).length; i++) if (styles[i].id === id) return true;
      return false;
    }
    var ids = raw.filter(known), dropped = raw.length - ids.length;
    if (!ids.length) {
      return raw.length ? { seats: 0, ids: [], note: '声明了 scriptMix 但风格 id 全认不出 ⇒ 本档不掺脚本席' } : null;
    }
    var keep = (typeof sm.min === 'number') ? sm.min : 1;
    var k = Math.min(sm.seats | 0, Math.max(0, aiSeats - keep));
    if (k <= 0) return { seats: 0, ids: ids, note: 'AI 席只有 ' + aiSeats + ' 席 ⇒ 掺不动脚本（至少留 ' + keep + ' 席包）' };
    return { seats: Math.min(k, ids.length), ids: ids, note: dropped > 0 ? ('掺席里有 ' + dropped + ' 个风格 id 认不出，已跳过') : null };
  }

  global.EpirusPoolDraw = { rng: rng, compose: compose, byTier: byTier, distinct: distinct, scriptSeats: scriptSeats };
})(typeof window !== 'undefined' ? window : globalThis);
