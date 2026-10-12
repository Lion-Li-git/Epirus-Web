/* 人席"杀刀"的**单一实现**（§E590 从 `champion-map/seatgap.mjs` 抽出来，供 `tools/pool-add.mjs` 等复用）
 *
 * 为什么只许有一份：判据是 `§E531` 那条注册否决线（某格**两批同号**都比基准差 ≥20pt）。
 *   抄第二份实现的下场本仓栽过很多次（两条尺读同一个词但口径不同 ⇒ 结论互相打脸）。
 *   抽取的铁证：**抽取前后 `seatgap.mjs` 的输出逐字相同**（`/tmp/seatgap-before.txt` 56 行对后 56 行）。
 *
 * ⚠ 引用这条线时必须带的一条脚注（§E587 实测）：`两批同号` 防不到假杀（真无差时单批过 20pt 的概率 0.0%），
 *   它只是把 20pt 的检出从 ~50% 砍到 ~25% ⇒ "它没被否决"这句不许裸引，档对怎么挑仍待裁。
 */

/* 表头前 5 列固定是 id/path/mode/games/seed0 ⇒ 第一格在下标 5。
 * ⚠ 先前写成 `+6`，于是每一格都读到右边那一格、最后一格读到的是"六格均值"——
 *   症状是基准行自己就乱（现役"全程刷反弹"印成 5/7%，而表里那格明明是 2/1）。
 *   **列偏移要靠基准行自检**，基准值在 §E506/§E560 里有在册读数，一比就穿。 */
export const CELL_OFFSET = 5;
export const CELLS = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
export const LINE = 20;                       // §E531 的注册否决线（pt）
export const MODES = ['multi', 'long'];
export const BASE_ID = 'bundled-champion-3p';  // 现役（coords 里叫 SHIPPED-Ldemo，探针打的是路径）

/* 路径口径与 `seat-parse.mjs` 对齐（2026-10-11 DS 修）：带盘符（`D:/…`）或前导 `/` 视为**绝对路径**，
 *   不再无条件 join —— 按 `--files=champion-map/x.tsv` 或 `D:/code/…` 传都会被拼成双路径 ⇒ ENOENT。 */
export function resolve(p, here) {
  return (p.indexOf(':') >= 0 || p[0] === '/' || /^[A-Za-z]:[\/\\]/.test(p)) ? p : (here ? here + '/' + p : p);
}

/** 读一张批表 ⇒ {h, rows} */
export function rdTable(p, txt) {
  const L = txt.replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map(l => l.split('\t')) };
}

export function rowOf(t, id, mode) {
  return t.rows.filter(r => r[t.h.id] === id && r[t.h.mode] === mode)[0];
}
export function cell(r, i) { return Number(r[i + CELL_OFFSET]); }

/** 一枚在某个口径下的逐格差与过线格（两批同号才算）。缺批读数 ⇒ null（**缺行 ≠ 没踩线**）。 */
export function killOf(id, mode, batches, baseId) {
  const bs = baseId || BASE_ID;
  const baseRows = batches.map(t => rowOf(t, bs, mode));
  const rows = batches.map(t => rowOf(t, id, mode));
  if (!baseRows[0] || !baseRows[1] || !rows[0] || !rows[1]) return null;
  const per = CELLS.map((c, i) => ({
    c: c,
    a: cell(rows[0], i), b: cell(rows[1], i),
    ga: cell(rows[0], i) - cell(baseRows[0], i),
    gb: cell(rows[1], i) - cell(baseRows[1], i),
  }));
  const over = per.filter(p => p.ga >= LINE && p.gb >= LINE);
  return { per: per, over: over, base: baseRows.map((r, k) => CELLS.map((c, i) => cell(r, i))) };
}

/** 两口径合起来的否决格数（给 tsv 的一列用）。任何一批缺读数 ⇒ 返回 -1 并由调用方显式标"没量过"。 */
export function killTotal(id, batches, baseId) {
  let n = 0;
  for (const mode of MODES) {
    const k = killOf(id, mode, batches, baseId);
    if (!k) return -1;
    n += k.over.length;
  }
  return n;
}

/* ============ 带内参照（§E598 · 2026-10-12 用户裁定 A）============
 * 病（用户点名）：人席杀刀原来一律跟**现役**那一行比，而**池上线后根本没有"某一枚现役"在场**——
 *   四个 AI 席逐席从带里抽 ⇒ 玩家遇到的是"这一带"，不是那一枚包。
 *   铁证（本班算出来的）：按老口径，**我们自己的池成员 `D4a`、`E3` 各踩 1 格**；而困难带在多数格上
 *   本来就比现役软 +4~+7pt ⇒ "比现役差 20pt"根本不是离群，只是"这枚不像现役"。
 * 口径：`(read − 现役) − (本带同伴在同一对批表里的均值)` ≥ 20pt 且两批同号 ⇒ 计 1 格。
 *   问的是「**你在你自己的带里是不是那个洞**」，而不是「你比那枚已经不再单独上场的现役差多少」。
 * ⚠ **现役参照（`killOf`/`killTotal`/`seatKillIndex`）已无线上消费者**（§E598 · 用户 10-12：「理论上讲，现在也没有所谓上槽了吧」）：
 *   3P 的"上槽冠军"按用户 10-11 裁定③（「池上线后不再有 promote，改『加入冠军池』」）**已经退役** ——
 *   玩家遇到的是"从某一带里逐席抽"，不是某一枚包 ⇒ 池这一层唯一的合法参照是**本带同伴**。
 *   保留这三个导出只为**复算历史读数**（旧表里的 `seatKill` 是老口径算的）；新判决一律走 `*Band`。
 *   （唯一还"有单一冠军"的是 **2 人桌**：池按 §E286 不上 2 张桌，那儿的对手仍是 `js/bundled-champion-2p.js` ——
 *     但人席探针量的是 5 席 multi/long，表里**根本没有 2P 那一枚**，所以这条不构成本文件的参照问题。）
 * ⚠ 带内均值只用**池成员**（不含被判的那枚候选）⇒ 候选不能自己给自己定参照。
 */

/** 一对批表里，各带各口径的「相对现役」均值 ⇒ `{band: {mode: [6 个数]}}`。
 *  `widBands`: wid → band（由调用方给，只有它知道池表）；`readWid(relPath)`: 路径 → wid。 */
export function bandMeans(batches, widBands, readWid) {
  const out = {};
  const base = {};                                   /* batch idx → mode → row */
  batches.forEach((t, k) => { base[k] = {}; for (const m of MODES) base[k][m] = rowOf(t, BASE_ID, m); });
  for (const t of batches) {
    for (const r of t.rows) {
      const w = readWid(r[t.h.path]); const b = w ? widBands[w] : null;
      if (!b) continue;
      out[b] = out[b] || {};
      for (const m of MODES) {
        if (r[t.h.mode] !== m) continue;
        const k = batches.indexOf(t);
        const br = base[k][m]; if (!br) continue;
        const own = []; for (let i = 0; i < CELLS.length; i++) own.push(cell(r, i) - cell(br, i));
        out[b][m] = out[b][m] || [];
        out[b][m].push(own);
      }
    }
  }
  const mean = {};                                   /* band → mode → [6] */
  for (const b of Object.keys(out)) {
    mean[b] = {};
    for (const m of MODES) {
      const rows = out[b][m] || [];
      mean[b][m] = rows.length ? CELLS.map((_, i) => rows.reduce((a, r) => a + r[i], 0) / rows.length) : null;
    }
  }
  return mean;
}

/** 带内口径的单口径逐格差（`ref` = `bandMeans(...)[band][mode]`，缺则退回现役参照 ⇒ 不静默）*/
export function killOfBand(id, mode, batches, ref) {
  const baseRows = batches.map(t => rowOf(t, BASE_ID, mode));
  const rows = batches.map(t => rowOf(t, id, mode));
  if (!baseRows[0] || !baseRows[1] || !rows[0] || !rows[1]) return null;
  const per = CELLS.map((c, i) => {
    const r = (ref && Number.isFinite(ref[i])) ? ref[i] : 0;
    return {
      c: c,
      a: cell(rows[0], i), b: cell(rows[1], i),
      d0: cell(rows[0], i) - cell(baseRows[0], i),
      d1: cell(rows[1], i) - cell(baseRows[1], i),
      ga: cell(rows[0], i) - cell(baseRows[0], i) - r,
      gb: cell(rows[1], i) - cell(baseRows[1], i) - r,
    };
  });
  const over = per.filter(p => p.ga >= LINE && p.gb >= LINE);
  return { per: per, over: over, ref: ref || null, base: baseRows.map(r => CELLS.map((c, i) => cell(r, i))) };
}

/** 带内口径的两口径合计（缺读数 ⇒ -1，调用方必须显式标"没量过"） */
export function killTotalBand(id, batches, ref) {
  let n = 0;
  for (const mode of MODES) {
    const k = killOfBand(id, mode, batches, ref ? ref[mode] : null);
    if (!k) return -1;
    n += k.over.length;
  }
  return n;
}

/** 带内口径的 `wid → {kills, ids}`（与 `seatKillIndex` 同形，供池那一层替换用）。
 *  ⚠ 参照用**池成员**算；被判的那枚若是池外候选，它不会把自己算进参照。 */
export function seatKillIndexBand(batches, readWid, widBands) {
  const out = new Map();
  if (!batches || batches.length < 2) return out;
  const refs = bandMeans(batches, widBands, readWid);
  const per = batches.map(t => {
    const m = new Map();
    for (const r of t.rows) { const w = readWid(r[t.h.path]); if (!w) continue; if (!m.has(w)) m.set(w, new Set()); m.get(w).add(r[t.h.id]); }
    return m;
  });
  for (const [wid, set0] of per[0]) {
    const common = [...set0].filter(id => per.slice(1).every(m => m.has(wid) && m.get(wid).has(id)));
    if (!common.length) continue;
    const band = widBands[wid];
    let kills = -1;
    for (const id of common) { const k = killTotalBand(id, batches, band ? refs[band] : null); if (k >= 0) kills = Math.max(kills, k); }
    if (kills >= 0) out.set(wid, { kills: kills, ids: common, band: band || null, refMode: band && refs[band] ? 'band' : 'incumbent' });
  }
  return out;
}

/** 这一**对**表里有没有基准行（两个口径都要有）。
 * 没有 ⇒ 这对表**根本判不出杀刀**，调用方必须拒绝它 —— 不许读成"零格否决"。
 * 立案依据（10-11 夜的假干净）：`pool-seat-ml-*.tsv` 是 `--packs=` 只列了 6 枚新成员、
 *   把默认的基准 `js/bundled-champion-3p.js` 顶掉了 ⇒ 12 行全是成员、0 行基准 ⇒
 *   六枚 mid/low 成员被刷成"人席量过、零格"，其中两枚其实是**踩了 4 格 / 2 格**的送分包。 */
export function pairHasBase(tables, baseId) {
  const bs = baseId || BASE_ID;
  if (!tables || tables.length < 2) return false;
  return MODES.every(m => tables.every(t => !!rowOf(t, bs, m)));
}

/** 把一对（两张）批表按权重身份归一 ⇒ 返回 `wid → {kills, ids}`。
 *
 * 为什么不能按 id 对：同一粒权重在不同表里叫不同名字（§E589 普查：1443 个文件其实 1130 粒；
 *   池里叫 `K2`，人席表里的路径是 `kept/e70-out__D02-31.bak`；`v7w3c-82` 的文件主名是 `v7divK2b-82.bak`）。
 *   按 id 硬对 ⇒ 一部分成员会被读成"没量过"，那是**假象的干净**。
 * `readWid(relPath)` 由调用方给：只有它知道仓库根、哪些路径 tracked、怎么算 wid（读文件是 I/O，不该塞进判据模块）。
 * ⚠ 只收"每张表里都有这一粒"的 id ⇒ 缺表就是没有结论，不猜。
 * ⚠ **基准行不在表里 ⇒ 这一粒根本没法判，不许落成 0（= 干净）**（10-11 夜实测：`pool-seat-ml-*.tsv` 两张
 *   只跑了 6 枚成员、没带 `bundled-champion-3p` ⇒ `killOf` 全返回 null、`killTotal` 全是 -1，
 *   而第一版的 `kills` 初值是 0 ⇒ 六枚 mid/low 成员被刷成"人席量过、零格否决"。
 *   `没量过 ≠ 干净` 这条在这里也咬人。现在要求"至少一个 id 真出了读数"才入索引。 */
export function seatKillIndex(batches, readWid) {
  const out = new Map();
  if (!batches || batches.length < 2) return out;
  const per = batches.map(t => {
    const m = new Map();
    for (const r of t.rows) {
      const w = readWid(r[t.h.path]);
      if (!w) continue;
      if (!m.has(w)) m.set(w, new Set());
      m.get(w).add(r[t.h.id]);
    }
    return m;
  });
  for (const [wid, set0] of per[0]) {
    const common = [...set0].filter(id => per.slice(1).every(m => m.has(wid) && m.get(wid).has(id)));
    if (!common.length) continue;
    let kills = -1;                                          /* -1 = 这对表里认得出它，但算不出格（缺基准/缺 mode 行） */
    for (const id of common) { const k = killTotal(id, batches); if (k >= 0) kills = Math.max(kills, k); }
    if (kills >= 0) out.set(wid, { kills: kills, ids: common });
  }
  return out;
}
