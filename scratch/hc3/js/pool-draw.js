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

  /** members: [{id,wid,tier}]（**不传 bandW 时调用方负责按 tier 过滤好**） ‖ aiSeats: AI 席数 ‖ rand: ()=>[0,1)
   *  scriptMix（§E600-B 新增，可缺省）: `{seats:k, ids:['st:toolkit',...]}` = 把其中 k 个 AI 席换成**脚本席**。
   *    · 不传 / k=0 ⇒ 与今天逐字相同（老的量具与判据的主语没被偷换，这是硬要求）
   *    · 包的抽取**照常先做完**再替换位置 ⇒ 同一个 salt 下"包的阵容"不随掺不掺而变（掺席只是盖掉几席）
   *    · `allSame` / `degraded` 仍然只说**包席**的事；整桌都是脚本 ⇒ `degraded='all-script'`（必须被说出来，不许静默）
   *  bandW（§E609 新增，可缺省）: `{hard:0.5, soft:0.5}` = **逐席按带加权**，此时 members 要交**全表**（带名取自每行的 `tier`）。
   *    · 不传 ⇒ 走原来的整表洗牌路，逐字与今天相同
   *    · 权重带全空 ⇒ `degraded='empty-bands'`（响亮，不许静默凑席位）
   *    · `out.bands` 印出归一后的带权（给页面与判词说"这一桌是从哪些带按什么比例抽的"）
   *  返回 { seats: [{id,wid,seat,kind}], allSame, degraded, scriptSeats, bands }
   *  ⚠ `degraded` 不是"失败了"，是**必须被产品与判词说出来**的四种降级：池空 / 该档只有 1 枚（全同是数学必然）/ 整桌脚本 / 权重带全空。 */
  function compose(members, aiSeats, rand, scriptMix, bandW) {
    var out = { seats: [], allSame: false, degraded: null };
    if (!members || !members.length) { out.degraded = 'empty'; return out; }
    if (!(aiSeats > 0)) { out.degraded = null; return out; }
    var pool = members.slice();
    /* §E609 按带加权混抽（用户 10-15 裁定：**真·按带加权**，不靠往名单里重复铺行）。
     *   bandW = { hard: 0.5, soft: 0.5, else: 'mid' } —— 每一席先按权重掷"进哪一带"，再在该带里均匀取一枚。
     *   席位之间独立 ⇒ 允许同枚（裁定②），"不许全同"仍由下面那道闸管（裁定③）。
     *   不传 bandW ⇒ 走原来那条洗牌路，**逐字与今天相同**（老的量具与判据的主语没被偷换）。 */
    var BANDS = null;
    if (bandW) {
      var bn = Object.keys(bandW).filter(function (n) { return n !== 'else'; }), bsum = 0;
      for (var bi = 0; bi < bn.length; bi++) {
        var bl = byTier(members, bn[bi]), bw = +bandW[bn[bi]] || 0;
        if (bl.length && bw > 0) { if (!BANDS) BANDS = []; BANDS.push({ name: bn[bi], w: bw, list: bl }); bsum += bw; }
      }
      if (!BANDS || !(bsum > 0)) { out.degraded = 'empty-bands'; return out; }   /* 权重带全空 ⇒ 响亮，不许静默凑 */
      for (bi = 0; bi < BANDS.length; bi++) BANDS[bi].w /= bsum;                  /* 归一：写错权重（和不为 1）不该改变形状 */
    }
    /* 洗牌（Fisher-Yates，用同一个 rand）⇒ 优先不放回；成员不够就把洗牌后的序列循环补足（裁定②允许重复） */
    function shuffled() {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      return pool;
    }
    var order = null;
    if (BANDS) {
      for (var s2 = 0; s2 < aiSeats; s2++) {
        var r = rand(), acc = 0, pickB = BANDS[BANDS.length - 1];
        for (var q2 = 0; q2 < BANDS.length; q2++) { acc += BANDS[q2].w; if (r < acc) { pickB = BANDS[q2]; break; } }
        out.seats.push(pickB.list[Math.floor(rand() * pickB.list.length)]);
      }
      out.bands = BANDS.map(function (b) { return b.name + ' ' + (100 * b.w).toFixed(0) + '%'; }).join(' ‖ ');
    } else {
      order = shuffled();
      for (var s = 0; s < aiSeats; s++) out.seats.push(order[s % order.length]);
    }
    /* 禁全同（裁定③）：撞了就重抽**其中一席**，最多 8 次；仍全同 ⇒ 只有"该档 1 枚"这一种可能，如实标降级
     *   ⚠ 混抽模式下这一发补救走的是**整表洗牌**（不按权重）—— 它只在"四席全同"这种极端里出手，
     *     为的是守住裁定③而不是守权重；四席全同在 hard 11 ‖ soft 16 上概率约 1e-4 量级。 */
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
    /* §E600-B 掺脚本席：在**已经抽好的包阵容**上盖掉几席 ⇒ 同一个 salt 下包的阵容不随掺不掺而变
     *   （否则"掺席"会把抽签整体重排，量具两侧的历史读数就没法配对了）。位置也用同一个 rand ⇒ 可复现。
     * 10-21 用户更正：默认口径改成**概率掺**（scriptMix.p）—— 脚本与冠军包一起抽，每席独立以 p 变脚本；
     *   不传 p 时仍走原来的固定 k 席（历史读数与在册账逐字不变）。 */
    var sids = (scriptMix && scriptMix.ids && scriptMix.ids.length) ? scriptMix.ids : null;
    if (sids) {
      var keep = (typeof scriptMix.min === 'number') ? scriptMix.min : 1;
      var maxScript = Math.max(0, out.seats.length - Math.max(0, keep));
      var order = [];
      for (var q = 0; q < out.seats.length; q++) order.push(q);
      for (var w = order.length - 1; w > 0; w--) {
        var v = Math.floor(rand() * (w + 1)); var tmp = order[w]; order[w] = order[v]; order[v] = tmp;
      }
      var made = 0;
      if (typeof scriptMix.p === 'number') {
        /* 用户口径（10-21 再澄清）：脚本与冠军包**一起抽、不一定掺** ⇒ 先掷"这一桌掺不掺"（p），
         *   掺就按声明的 seats 整组盖，不掺就整桌都是包。
         *   ⚠ 不是逐席独立掷：逐席会让"只掺到 1 席 toolkit"这种更硬的组合频繁出现（实测把简单档压硬 2~4pt，D227④d 直接红）。 */
        var pp = Math.max(0, Math.min(1, scriptMix.p));
        var cap = Math.min(Math.max(0, scriptMix.seats | 0), Math.max(0, out.seats.length - Math.max(0, keep)));
        /* 用户口径（10-21）：**逐席独立**掷 p（脚本与冠军包一起抽），但**最多 seats 席**（简单 2、普通 1）。
         *   之前那次逐席被否证，是因为 cap 错写成 AI席−min（n=5 时 3 席）⇒ 简单档能抽到 3~4 席脚本，
         *   且常出现"只 1 席 toolkit"的硬组合。现在 cap=声明 seats，随机性保留（0/1/2 席都可能）。 */
        for (var z2 = 0; z2 < order.length && made < cap; z2++) {
          if (rand() < pp) { var at2 = order[z2]; out.seats[at2] = { id: sids[made % sids.length], wid: null, seat: at2, kind: 'script' }; made++; }
        }
      } else {
        var k = Math.min(Math.max(0, scriptMix.seats | 0), out.seats.length);
        for (var z = 0; z < k; z++) {
          var at = order[z];
          out.seats[at] = { id: sids[z % sids.length], wid: null, seat: at, kind: 'script' };
        }
        made = k;
      }
      out.scriptSeats = made;
      if (made === out.seats.length) out.degraded = 'all-script';
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

  /** §E609 这一档在**这张表**上该拿哪份名单、要不要按带加权 —— 产品与量具共用这一份推导（谁都不许抄第二遍）。
   *  返回 { members, bandW, note }：调用方原样交给 `compose`，`note` 非空必须说出来（契约 §4：降级不许静默）。
   *  三条规则：
   *   ① 没有 `poolMix` ⇒ 按 `tier.pool` 那一档均匀抽，逐字与今天相同；
   *   ② 有 `poolMix` 而这张表里 `poolMix.else` 那一档**还非空** ⇒ 这张表**还没拆带** ⇒ 混抽的证据不适用
   *      （split50 量在 3P 池 hard 11 ‖ soft 16 上；2P 那张表自 §E677 起是 hard 5 ‖ soft 4（无 mid ⇒ 走加权），它的 Hp 不是同一把考卷量的）
   *      ⇒ 整档退回按 `else` 那一带抽，并把这件事说出来；
   *   ③ 否则 ⇒ 交全表 + 权重，由 `compose` 逐席按带抽。
   *  ⚠ 为什么是"看表"而不是"看桌数"：`n>2` 那种写法把规则钉在人数上，而真正的条件是**这张池表拆没拆带**；
   *    将来 2P 表按它自己的证据拆完了，这条路自动生效，不用再来改代码、也不会先偷偷改掉 2P 的装配。 */
  function rosterFor(members, tier) {
    var pw = tier && tier.poolMix;
    if (!pw) return { members: byTier(members, tier && tier.pool), bandW: null, note: null };
    var fb = pw['else'] ? byTier(members, pw['else']) : [];
    if (fb.length) return { members: fb, bandW: null,
      note: '这张池表还有 ' + pw['else'] + ' 带（' + fb.length + ' 枚）⇒ 它没拆带 ⇒ 本档退回按 ' + pw['else'] + ' 带抽（混抽的证据只量在拆过带的表上）' };
    return { members: (members || []).slice(), bandW: pw, note: null };
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
    /* 10-21：**概率掺** —— 每席以 p 变脚本、不保证一定掺；不传 p 时保持旧的固定席数（在册读数不变）。 */
    if (sm.p !== undefined) {
      var pv = Number(sm.p);
      if (!isFinite(pv) || pv < 0 || pv > 1) return { seats: 0, ids: [], p: 0, note: 'scriptMix.p 必须是 0~1（收到 ' + sm.p + '）⇒ 本档不掺脚本席' };
      var ks = Math.min(Math.max(0, sm.seats | 0), Math.max(0, aiSeats - keep));
      if (pv === 0 || ks <= 0) return { seats: 0, ids: ids, p: 0, note: null };
      return { p: pv, seats: Math.min(ks, ids.length), ids: ids, min: keep, note: dropped > 0 ? ('掺席里有 ' + dropped + ' 个风格 id 认不出，已跳过') : null };
    }
    var k = Math.min(sm.seats | 0, Math.max(0, aiSeats - keep));
    if (k <= 0) return { seats: 0, ids: ids, note: 'AI 席只有 ' + aiSeats + ' 席 ⇒ 掺不动脚本（至少留 ' + keep + ' 席包）' };
    return { seats: Math.min(k, ids.length), ids: ids, note: dropped > 0 ? ('掺席里有 ' + dropped + ' 个风格 id 认不出，已跳过') : null };
  }

  global.EpirusPoolDraw = { rng: rng, compose: compose, byTier: byTier, rosterFor: rosterFor, distinct: distinct, scriptSeats: scriptSeats };
})(typeof window !== 'undefined' ? window : globalThis);
