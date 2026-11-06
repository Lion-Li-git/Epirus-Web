/* 公平性探针（ZCode 11-06 晨，用户令：「公平性问题…是测试考卷的问题还是训练本身的问题…
 * 如果所有包都有同样的座位偏置那是很糟糕的」）。
 *
 * 代码事实（先读死后写探针）：
 *   · 考卷（eval-5p 的墙考卷）：主体席逐局轮转 `seat = g % N`（:654），对手槽位相对座位旋转（:655 注）。
 *   · 训练（evo.js scoreMemberN）：受评席逐局轮转 `seat = g % nG`（MIX2 切片另有口径）。
 *   ⇒ 两边的"包级总分"在期望上应该是座位中性的；剩下的问题是**引擎本身**每席有没有结构性优势。
 *
 * 本探针量三件事（全走产品同一条路：autoGameN + policyChooserN）：
 *   E1 镜像局 5P：同一枚包坐满 5 席 ⇒ 任何 1st 率偏离 20% = 引擎结构偏置（位置/结算序的纯效应）。
 *   E2 镜像局 8P：公平份额 12.5%，量 8 人桌的同一件事。
 *   E3 产品装配（pool compose、逐局换盐）：按**席位**和**包**两个边际各记 1st 率
 *      —— 席位边际 = 结构偏置在异构桌上的表现；包边际 = 包强度（应与座位无关）。
 */
import { readFileSync } from 'node:fs';
global.window = global;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/policy.js','js/train/policy2.js','js/train/bots.js','js/train/evo.js','js/train/trainer.js','js/champion-pack.js','js/pool-draw.js','js/bundled-champion-pool.js']) {
  eval(readFileSync(f, 'utf8'));
}
const S = global.EpirusState, Play = global.EpirusPlay, P = global.EpirusPolicy, D = global.EpirusPoolDraw;
const T = global.EpirusTrainer;
if (!global.EPIRUS_CHAMPION_POOL || !global.EPIRUS_CHAMPION_POOL.members) { console.error('池 bundle 没载入'); process.exit(1); }
const ALLMEM = global.EPIRUS_CHAMPION_POOL.members;
const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const paramCache = {};
const paramsOf = (id) => {
  if (!paramCache[id]) {
    const m = ALLMEM.find(x => x.id === id);
    if (!m) return null;
    try { paramCache[id] = P.unpack(m.pack, true); } catch (e) { paramCache[id] = null; }
  }
  return paramCache[id];
};

function mirror(n, packId, games, seedBase) {
  const prm = paramsOf(packId);
  if (!prm) { console.error('包解不开：' + packId); process.exit(1); }
  const first = new Array(n).fill(0), decided = new Array(n).fill(0);
  let draws = 0;
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g;
    const st = S.createState('multi', { next: mulberry32(seed) }, n);
    st.slotSalt = (Math.imul(seed, 2654435761)) >>> 0;
    const choosers = [];
    for (let pid = 0; pid < n; pid++) choosers.push(T.policyChooserN(prm, 0.15, 0.1, 5, 'soft'));
    Play.autoGameN(st, choosers);
    if (st.winner === 'draw') { draws++; continue; }
    for (let pid = 0; pid < n; pid++) {
      const rank = T.rankOf(st, pid, seed * 977 + pid);
      if (rank === 1) { first[pid]++; decided[pid]++; }
    }
  }
  const total1st = first.reduce((a, b) => a + b, 0);
  return { n, packId, games, draws, perSeat: first.map(f => +(f / total1st * 100).toFixed(1)), fair: +(100 / n).toFixed(1) };
}

function productCompose(n, games, seedBase) {
  const tier = global.EpirusBots.DIFF_TIERS.find(t => t.id === 'lv:regular');
  const seatFirst = new Array(n).fill(0);
  const packFirst = {}, packGames = {};
  let draws = 0;
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g;
    const st = S.createState('multi', { next: mulberry32(seed) }, n);
    st.slotSalt = (Math.imul(seed, 2654435761)) >>> 0;
    const R = D.rosterFor(ALLMEM, tier);
    const draw = D.compose(R.members, n - 1, D.rng(st.slotSalt), null, R.bandW);
    const choosers = [];
    const seatPack = [];
    for (let pid = 0; pid < n; pid++) {
      const se = draw.seats[(pid === 0 ? 0 : pid - 1) % draw.seats.length];
      const id = se && se.id ? se.id : null;
      seatPack[pid] = id;
      const prm = id ? paramsOf(id) : null;
      choosers.push(prm ? T.policyChooserN(prm, 0.15, 0.1, 5, 'soft') : ((s, p2, legal) => 'ji'));
    }
    Play.autoGameN(st, choosers);
    if (st.winner === 'draw') { draws++; continue; }
    for (let pid = 0; pid < n; pid++) {
      const rank = T.rankOf(st, pid, seed * 977 + pid);
      if (rank !== 1) continue;
      seatFirst[pid]++;
      const id = seatPack[pid];
      if (id) { packFirst[id] = (packFirst[id] || 0) + 1; packGames[id] = (packGames[id] || 0) + 1; }
    }
  }
  const total1st = seatFirst.reduce((a, b) => a + b, 0);
  return { n, games, draws, seatMarginal: seatFirst.map(f => +(f / total1st * 100).toFixed(1)), fair: +(100 / n).toFixed(1), packMarginal: packFirst };
}

const out = {};
out.E1_mirror_5P = mirror(5, 'L5-1200-s13', 600, 910000);
out.E1b_mirror_5P = mirror(5, 'DSTR-s13', 600, 920000);
out.E2_mirror_8P = mirror(8, 'L5-1200-s13', 400, 930000);
out.E3_product_8P = productCompose(8, 600, 940000);
console.log(JSON.stringify(out, null, 1));
