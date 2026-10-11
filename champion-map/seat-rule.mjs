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
