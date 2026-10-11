/* §E585 抽出来的共用统计件（Spearman + 蒙特卡洛置换 p + Holm）
 *
 * 为什么要抽：`seatassoc.mjs`（§E576）里这份实现带着三条踩过坑的细节 ——
 *   ① 秩要**平均秩**（并列取均值），否则大量同值的行为列会把 ρ 算歪；
 *   ② 置换 p 的**尾数方向**是 `|ρ_perm| ≥ |ρ_obs|`（§E572 那次把累积分布当 p 印，结论直接反）；
 *   ③ Holm 是 step-down（`max(前缀, (m−k)·p)`），不是简单 ×m。
 *   §E585 要做逐格版的同一套筛查 ⇒ 抄第二份就是"两份代码分叉"（本仓反复栽的那条）。
 * ⚠ 抽取的铁证：**抽取前后 `seatassoc.mjs` 的每个 ρ 与 p 必须逐值不变**（拿 §E576 在册读数对回去），
 *   不是"跑起来没报错"就算过。
 */

export const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

export function ranks(x) {
  const idx = x.map((v, i) => i).sort((a, b) => x[a] - x[b]);
  const r = new Array(x.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pear(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return (da === 0 || db === 0) ? NaN : n / Math.sqrt(da * db);
}

export const sp = (x, y) => pear(ranks(x), ranks(y));

/* 蒙特卡洛置换 p：n 大时阶乘不可枚举 ⇒ 固定种子的置换分布。返回 (hit+1)/(B+1)，最小值 = 1/(B+1)。 */
export function mcP(x, y, B, rng) {
  const obs = Math.abs(sp(x, y));
  const ry = ranks(y);
  let hit = 0;
  for (let b = 0; b < B; b++) {
    const p = ry.slice();
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    if (Math.abs(pear(ranks(x), p)) >= obs - 1e-12) hit++;
  }
  return (hit + 1) / (B + 1);
}

export function holm(ps) {
  const idx = ps.map((v, i) => i).sort((a, b) => ps[a] - ps[b]);
  const m = ps.length;
  const adj = new Array(m);
  let run = 0;
  for (let k = 0; k < idx.length; k++) { const v = Math.max(run, (m - k) * ps[idx[k]]); run = v; adj[idx[k]] = Math.min(1, v); }
  return adj;
}

/* 固定种子 PRNG（mulberry32 形状）—— 置换与随机对照都用它，保证复跑逐位相同。 */
export const rngSeed = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
