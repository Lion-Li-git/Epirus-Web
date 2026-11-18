/* arena-lib.mjs —— 多人 Plackett-Luce 联盟（Arena B 轴单一数据源）
 * 设计要点：
 *   1. 24 枚跨代/多流派锚点组成均衡 Arena 联盟，先内部多人数互打标定各自 Plackett-Luce 对数实力分 r_j；
 *   2. 任意待测包按确定性分层抽桌赛程与联盟锚点在 multi(short) + long 双桌形、N=2/3/5/8 同尺对局；
 *   3. 固定已知锚分下，对每档求 Plackett-Luce 极大似然（+经验贝叶斯向对应桌形均分收缩），
 *      再换算成对联盟平均席（r=0）的等价超额夺1率 X_N ∈ [-1/(N-1), +1]，天然统一短/长程两把尺。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadChamp, mulberry32 } from './audit-lib.mjs';

export const LEAGUE_ANCHORS = [
  /* v7 / 早期高强代表 (4) */
  { id: 'T8-s114', era: 'v7', role: 'burst' },
  { id: 'Q-s47', era: 'v7', role: 'antiwall' },
  { id: 'WSEL9-200', era: 'v7', role: 'breadth' },
  { id: 'v7blk1-92', era: 'v7', role: 'long-burst' },
  /* MSB / DEF (5) */
  { id: 'MSB11-R2S306293884', era: 'MSB', role: 'antiwall-charge' },
  { id: 'MSB13-R1S791820660', era: 'MSB', role: 'c-anchor' },
  { id: 'MSB14-railgun-R1S175656469', era: 'MSB', role: 'railgun-counter' },
  { id: 'MSB15R-HITMIX', era: 'MSB', role: 'hitmix' },
  { id: 'DEF-s16', era: 'DEF', role: 'defense-wallbreak' },
  /* obs6 真伤 / 压制 / 重火力 / V3 (6) */
  { id: 'OBS6P9-S4000', era: 'obs6', role: 'truedmg-holo' },
  { id: 'OBS6E9', era: 'obs6', role: 'truedmg-snipe' },
  { id: 'OBS6-LH6P', era: 'obs6', role: 'heavy-base' },
  { id: 'DIV-V3-ANTIDEF', era: 'obs6', role: 'v3-antidef' },
  { id: 'DIV-LH6-HEAVY-S2', era: 'obs6', role: 'heavy-bead' },
  { id: 'P9-CN-MINI-CONT', era: 'obs6', role: 'cannon-holo' },
  /* EQ / MX 主线与覆盖 (5) */
  { id: 'EQ-S4-E9', era: 'EQ', role: 'eq-mainline' },
  { id: 'EQ-S4-GD6ATEACH', era: 'EQ', role: 'gd6a-teach' },
  { id: 'MX5-GD-T2STR', era: 'MX', role: 'hard-top' },
  { id: 'MX8-TN25-KL', era: 'MX', role: 'taunt-drain-rg' },
  { id: 'MX6-GD-TF20', era: 'MX', role: 'minit-transfer' },
  /* obs6.5 特化 / 经济 / 贴符 / 护甲 (4) */
  { id: 'RING-MINIT-CONT', era: 'obs6.5', role: 'ring-econ' },
  { id: 'TZ2C', era: 'obs6.5', role: 'firestorm' },
  { id: 'TZT2D', era: 'obs6.5', role: 'hostile-transfer' },
  { id: 'MX8-R6C-KL', era: 'MX', role: 'armor-rod' },
];

export const NS4 = [2, 3, 5, 8];
export const W4 = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
export const HORIZONS = [
  { hor: 'short', mode: 'multi' },
  { hor: 'long', mode: 'long' },
];

/** 从 registry.tsv 解析所有在册包路径 */
export function loadRegistryPaths(root = ROOT) {
  const txt = readFileSync(join(root, 'champion-map/data/registry.tsv'), 'utf8').replace(/\r\n/g, '\n');
  const lines = txt.trim().split('\n');
  const ix = Object.fromEntries(lines[0].split('\t').map((c, i) => [c, i]));
  const map = new Map();
  for (const l of lines.slice(1)) {
    const c = l.split('\t');
    if (c[ix.pack_id] && c[ix.path]) map.set(c[ix.pack_id], { path: c[ix.path], status: c[ix.status], ver: c[ix.ver] });
  }
  return map;
}

/** 读取已标定的 Arena 联盟表 */
export function loadLeagueTable(tsvPath = join(ROOT, 'champion-map/data/arena-league-1118.tsv')) {
  const lines = readFileSync(tsvPath, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const h = lines[0].split('\t');
  const ix = Object.fromEntries(h.map((c, i) => [c, i]));
  return lines.slice(1).map((l) => {
    const c = l.split('\t');
    return {
      idx: Number(c[ix.idx]),
      id: c[ix.pack_id],
      path: c[ix.path],
      era: c[ix.era],
      role: c[ix.role],
      rShort: Number(c[ix.r_short]),
      rLong: Number(c[ix.r_long]),
      rAll: Number(c[ix.r_all]),
    };
  });
}

/** 按剂量建 chooser：null = 考卷 ε=0；{tierId} = 页面剂量（DIFF_TIERS 那一档 + 前 3 回合斜坡，与 exam-4n --dose=page 同一实现） */
export function makeDoseChooser(W, params, dose) {
  const T = W.EpirusTrainer;
  if (!dose || !dose.tierId) return T.policyChooserN(params, 0.15);
  const B = W.EpirusBots;
  const tier = (B.DIFF_TIERS || []).find((x) => x.id === dose.tierId);
  if (!tier) throw new Error('Arena page dose 的档不在 DIFF_TIERS：' + dose.tierId);
  const mk = (e) => e > 0 ? T.policyChooserN(params, 0.15, e, tier.epsK, tier.epsMode) : T.policyChooserN(params, 0.15);
  const byRound = { 1: mk(B.tierEps(tier, 1)), 2: mk(B.tierEps(tier, 2)), 3: mk(B.tierEps(tier, 3)) };
  return (state, id, legal) => byRound[Math.min(3, state.round)](state, id, legal);
}

/** 为每个锚点载入 chooser（默认 ε=0；传 dose 则整桌按页面剂量） */
export function loadAnchorChoosers(W, anchors, root = ROOT, dose = null) {
  return anchors.map((a) => {
    const params = loadChamp(W, a.path, root);
    if (!params) throw new Error('Arena 联盟包载入失败：' + a.id + ' (' + a.path + ')');
    return makeDoseChooser(W, params, dose);
  });
}

/** 根据一局的最终排名统计赢家（并列第一平分 1 胜，严格中性） */
export function tableWinCredits(T, state, n, gseed) {
  const ranks = new Array(n);
  let best = Infinity;
  for (let s = 0; s < n; s++) {
    ranks[s] = T.rankOf(state, s, gseed);
    if (ranks[s] < best) best = ranks[s];
  }
  const winners = [];
  for (let s = 0; s < n; s++) if (ranks[s] === best) winners.push(s);
  const wCredit = 1 / winners.length;
  const credits = new Array(n).fill(0);
  for (const s of winners) credits[s] = wCredit;
  return credits;
}

/** Stage 1 赛程：24 枚联盟锚点间跨人数的平衡多人局赛程（按模式各跑一份） */
export function buildLeagueCalibrationSchedule(nAnchors, seedBase = 81100) {
  const games = [];
  const rnd = mulberry32(seedBase);
  const randPerm = (n) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  /* N=2：全对子 276 对 × 4 局（双座向×2种子） = 1104 局 */
  let gid = 0;
  for (let i = 0; i < nAnchors; i++) {
    for (let j = i + 1; j < nAnchors; j++) {
      for (let rep = 0; rep < 4; rep++) {
        const seats = (rep % 2 === 0) ? [i, j] : [j, i];
        games.push({ n: 2, seats, gseed: seedBase + 100000 + gid * 977 });
        gid++;
      }
    }
  }
  /* N=3, 5, 8：轮换随机置换保证每个锚点同局数且跨阵营混合 */
  const roundsFor = { 3: 50, 5: 80, 8: 80 }; /* 每锚分别打 50 / 80 / 80 局 */
  for (const n of [3, 5, 8]) {
    const blocks = Math.ceil((roundsFor[n] * nAnchors) / n);
    let pool = [];
    while (pool.length < blocks * n) pool = pool.concat(randPerm(nAnchors));
    for (let b = 0; b < blocks; b++) {
      const slice = pool.slice(b * n, (b + 1) * n);
      /* 若重复抽到同锚（跨块边界极少出现），就顺延交换修正 */
      const uniq = new Set(slice);
      if (uniq.size < n) {
        const avail = [];
        for (let a = 0; a < nAnchors; a++) if (!uniq.has(a)) avail.push(a);
        const seen = new Set();
        for (let k = 0; k < n; k++) {
          if (seen.has(slice[k])) slice[k] = avail[Math.floor(rnd() * avail.length)];
          seen.add(slice[k]);
        }
      }
      const rot = b % n;
      const seats = slice.slice(rot).concat(slice.slice(0, rot));
      games.push({ n, seats, gseed: seedBase + n * 1000003 + b * 977 });
    }
  }
  return games;
}

/** Hunter (2004) Plackett-Luce MM 求解多锚对数实力（带弱高斯先验 ridge） */
export function fitPlackettLuceLeague(records, nAnchors, lambda = 0.05, iters = 250) {
  const r = new Float64Array(nAnchors);
  const wins = new Float64Array(nAnchors);
  for (const g of records) {
    for (let k = 0; k < g.seats.length; k++) wins[g.seats[k]] += g.credits[k];
  }
  for (let it = 0; it < iters; it++) {
    const er = Array.from(r, (v) => Math.exp(v));
    const denom = new Float64Array(nAnchors);
    for (const g of records) {
      let s = 0;
      for (const a of g.seats) s += er[a];
      const inv = 1 / s;
      for (const a of g.seats) denom[a] += inv;
    }
    for (let i = 0; i < nAnchors; i++) {
      /* 一阶牛顿-MM 更新含 -lambda * r[i] 罚项 */
      const w = Math.max(wins[i], 0.1);
      const d = denom[i];
      const f = w - er[i] * d - lambda * r[i];
      const fp = -er[i] * d - lambda;
      let step = -f / fp;
      if (step > 1) step = 1;
      if (step < -1) step = -1;
      r[i] += step;
    }
    let m = 0;
    for (let i = 0; i < nAnchors; i++) m += r[i];
    m /= nAnchors;
    for (let i = 0; i < nAnchors; i++) r[i] -= m;
  }
  return Array.from(r);
}

/** 固定联盟锚分下的 1D Plackett-Luce 牛顿求解（最大化凹对数似然 - 0.5*lambda*(r-prior)^2） */
export function fitSubjectRating(records, anchorRatings, lambda = 0.05, prior = 0) {
  let r = prior;
  for (let it = 0; it < 25; it++) {
    const er = Math.exp(r);
    let g1 = -lambda * (r - prior);
    let g2 = -lambda;
    for (const g of records) {
      let S = 0;
      for (const a of g.oppIdx) S += Math.exp(anchorRatings[a]);
      const p = er / (er + S);
      g1 += g.credit - p;
      g2 -= p * (1 - p);
    }
    let step = -g1 / (g2 || -1);
    if (step > 2) step = 2;
    if (step < -2) step = -2;
    r += step;
    if (r > 7) r = 7;
    if (r < -7) r = -7;
    if (Math.abs(step) < 1e-8) break;
  }
  return r;
}

/** 实力分 r_u 换算为相对均锚（r=0）的 N 人超额夺1率 */
export function ratingToExcess(r, n) {
  const er = Math.exp(r);
  const p = er / (er + (n - 1));
  return (p - 1 / n) / (1 - 1 / n);
}

/** Stage 2：为任意待测包构造固定的分层对手桌赛程（所有待测包共用完全一致的桌表，剔除自镜像） */
export function buildSubjectSchedule(nAnchors, excludeIdx = -1, seedBase = 82200) {
  const rnd = mulberry32(seedBase);
  const avail = [];
  for (let i = 0; i < nAnchors; i++) if (i !== excludeIdx) avail.push(i);
  const m = avail.length;
  const pickDistinct = (k) => {
    const copy = avail.slice();
    for (let i = copy.length - 1; i > copy.length - 1 - k; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy.slice(copy.length - k);
  };
  /* 每种桌形共 88 局（2:16 / 3:24 / 5:32 / 8:16，贴近 0.15/0.25/0.45/0.15 页面权重，降低 5P 采样方差） */
  const counts = { 2: 16, 3: 24, 5: 32, 8: 16 };
  const games = [];
  for (const n of NS4) {
    const cnt = counts[n];
    /* N=2 时先打乱抽 16 枚覆盖不同段位锚点（用随机置换无偏覆盖） */
    const perm2 = avail.slice();
    for (let i = m - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = perm2[i]; perm2[i] = perm2[j]; perm2[j] = t;
    }
    for (let j = 0; j < cnt; j++) {
      const opps = n === 2 ? [perm2[j % m]] : pickDistinct(n - 1);
      const seat = j % n;
      games.push({ n, seat, opps, gseed: seedBase + n * 1000003 + j * 977 });
    }
  }
  return games;
}

/** 用已标定联盟（anchorRatingsShort/Long/All）评估单枚待测包并返回短/长程分格与总 Arena 分 */
export function evaluatePackArena(W, subjParams, subjId, anchorChoosers, league, opts = {}) {
  const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
  const subjChooser = makeDoseChooser(W, subjParams, opts.dose);
  const excludeIdx = league.findIndex((a) => a.id === subjId);
  const rShort = league.map((a) => a.rShort);
  const rLong = league.map((a) => a.rLong);
  const rAll = league.map((a) => a.rAll);
  const seedBase = opts.seedBase || 82200;

  const res = {};
  const allRecords = [];
  for (const { hor, mode } of HORIZONS) {
    const sched = buildSubjectSchedule(league.length, excludeIdx, seedBase + (mode === 'long' ? 50000 : 0));
    const ancR = mode === 'long' ? rLong : rShort;
    const records = [];
    for (const g of sched) {
      const choosers = new Array(g.n);
      let oi = 0;
      for (let pid = 0; pid < g.n; pid++) {
        choosers[pid] = (pid === g.seat) ? subjChooser : anchorChoosers[g.opps[oi++]];
      }
      const st = S.createState(mode, { next: mulberry32(g.gseed) }, g.n);
      st.slotSalt = g.gseed >>> 0;
      Play.autoGameN(st, choosers);
      const credits = tableWinCredits(T, st, g.n, g.gseed);
      const credit = credits[g.seat];
      records.push({ n: g.n, oppIdx: g.opps, credit });
      allRecords.push({ n: g.n, oppIdx: g.opps, credit });
    }
    const rHor = fitSubjectRating(records, ancR, 0.05, 0);
    const cells = {};
    let x4 = 0;
    for (const n of NS4) {
      const sub = records.filter((x) => x.n === n);
      /* 经验贝叶斯向本桌形总分收缩（lambda=0.35），抑制单格 16~24 局极值采样噪声 */
      const rCell = fitSubjectRating(sub, ancR, 0.35, rHor);
      const x = ratingToExcess(rCell, n);
      cells[n] = { x, n: sub.length, r: rCell };
      x4 += W4[n] * x;
    }
    res[hor] = { r: rHor, x4, cells, games: records.length };
  }
  const rAllSubj = fitSubjectRating(allRecords, rAll, 0.05, 0);
  return { id: subjId, short: res.short, long: res.long, rAll: rAllSubj };
}
