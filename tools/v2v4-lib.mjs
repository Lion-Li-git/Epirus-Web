/* Epirus —— V1/V2/V4「整局」三装配的**单一来源**（v1.5.132）
 *
 * 为什么要有它：这三个装配原先**只写在** `probe-ring-ablate.mjs` 里，而 `np-test` 想守"V2/V4 有没有退化"
 * 就只能再抄一份（或钉文本）—— 本仓"同一规则两处维护必然漂移"栽过四次（见 `server/opp-pool.mjs` 文件头）。
 * 现在**探针与门共用这一份**。`tools/crowding.mjs` 量的是**另一个轴**（对手固定、只改同族席位份数 k=1/2/4），
 * 它的读数在文档里被引用过 ⇒ **暂不合并**（合并就得重测那批数）。
 *
 * ⚠️ 口径（改这里 = 改所有 V1/V2/V4 读数，先想清楚再动）：
 *   · 5 席、模式 `multi`；被测席用 `T.policyChooserN(params, 0.15)`（与页面"冠军"档同口径）；
 *   · 轮座：`off = g % 5`，被测占 `(off+i)%5`（k 席连续）；
 *   · 同 seed 序列：`S.createState('multi', {next: mb(seed + g*991)}, 5)` + `slotSalt = h32(seed + g*2246822519)`；
 *   · 判定：**被测席里任意一席夺冠**记 1（k=4 时即"我这个家族夺冠"），和棋另计 ⇒ k=1 时就是"我的胜率"，
 *     k=4 时要用 `rates()` 除以 k 得到**每席位**胜率（不除会随 k 上升，没信息量）。
 *   · `countKey`：统计"被测席的策略输出该卡的次数"（消融/阳性对照要的两条读数之一）；
 *     `ablate=true` 时把该卡的输出**换成ジ**（`R.SK.JI`，且只在 `legal` 里确实有ジ时替换）。
 */

/* 三个装配 = 文档里 V1/V2/V4 的定义。**顺序也是口径**（`probe-ring-ablate.mjs` 按它打印）。 */
export const ASSEMBLIES = [
  { key: 'V1', name: '打乱局（对手 random）', opp: 'pickRandom', k: 1 },
  { key: 'V2', name: '打整局（对手 balanced）', opp: 'pickBalanced', k: 1 },
  { key: 'V4', name: '成群（4 席自家族 vs 1 balanced）', opp: 'pickBalanced', k: 4 }
];

/* 与全仓其它量具同族的播种（同 seed ⇒ 可复现；也便于与历史读数对照） */
export function mb(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function h32(n) {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/* 一臂：k 席被测。`deps = {S, Play, T, R}`（沙箱对象；由调用方装好，本模块自己不读文件）。
 * 返回 { w: 逐局 1/0, draw: 和棋数, keyUses: 被测席输出 `countKey` 的次数 } */
export function playAssembly(deps, params, opts) {
  const S = deps.S, Play = deps.Play, T = deps.T, R = deps.R;
  const o = opts || {};
  const k = o.k || 1, N = o.games, seed = o.seed;
  const opp = o.opp;
  const countKey = o.countKey || null;
  if (typeof opp !== 'function') throw new Error('[v2v4] opp 必须是 chooser 函数');
  const me = T.policyChooserN(params, 0.15);
  const JI = R.SK.JI;
  let keyUses = 0, draw = 0;
  const w = [];
  for (let g = 0; g < N; g++) {
    const off = g % 5;
    const mine = []; for (let i = 0; i < k; i++) mine.push((off + i) % 5);
    const st = S.createState('multi', { next: mb(seed + g * 991) }, 5);
    st.slotSalt = h32(seed + g * 2246822519);
    const chooser = function (s2, pid, lg) {
      const r = me(s2, pid, lg);
      if (countKey && r && r.key === countKey) {
        keyUses++;
        if (o.ablate) { const ji = lg.find(function (x) { return x.key === JI; }); if (ji) return { key: JI }; }
      }
      return r;
    };
    const cs = []; for (let i = 0; i < 5; i++) cs.push(mine.indexOf(i) >= 0 ? chooser : opp);
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++;
    w.push(mine.indexOf(st.winner) >= 0 ? 1 : 0);
  }
  return { w: w, draw: draw, keyUses: keyUses };
}

/* 每席位胜率（%）。**不除以 k 会随 k 上升**，那是没信息量的读法（见 `crowding.mjs` 的口径说明）。 */
export function rates(w, k) {
  let s = 0; for (let i = 0; i < w.length; i++) s += w[i];
  return 100 * s / w.length / (k || 1);
}

/* 三个装配一次量完：返回 { V1, V2, V4 } 的每席位胜率（%）+ 逐局原始数组（配对检验要它）。 */
export function measureAll(deps, params, opts) {
  const Bots = deps.B;
  const games = opts.games, seed = opts.seed;
  const out = {};
  for (const a of ASSEMBLIES) {
    const opp = Bots[a.opp];
    if (typeof opp !== 'function') throw new Error('[v2v4] EpirusBots 里没有 ' + a.opp);
    const r = playAssembly(deps, params, { k: a.k, opp: opp, games: games, seed: seed, countKey: opts.countKey, ablate: opts.ablate });
    out[a.key] = { rate: rates(r.w, a.k), w: r.w, draw: r.draw, keyUses: r.keyUses, k: a.k, name: a.name };
  }
  return out;
}
