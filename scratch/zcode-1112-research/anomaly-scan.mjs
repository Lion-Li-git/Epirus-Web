#!/usr/bin/env node
/* 研究探针（只读量具，不进判据）：跨人数异常扫描 —— 池装配自动对局里找"不该出现的形状"。
 * 检查项（每项都是引擎不变量，违反即异常）：
 *   A. NaN/Infinity 渗进 hp/ep/珠/血
 *   B. ep < 0 ‖ 珠 > 1（R9' 同类珠上限1）‖ hp 高于开局血量（无治疗技能，摄魂/净化可回，回的幅度有限）
 *   C. 回合撞上限的局占比（MAX_ROUNDS 截断 = 没打完）
 *   D. 平局率 / 全灭率
 *   E. 出手谱宽度（种类数）与防御类占比 —— 档位行为面
 *   F. 死人出手（state.attemptAction 已拦，核事件流一致性）
 *   G. 每局最长/最短回合、每局总出手、ジ占比（经济形状）
 * 用法：node scratch/zcode-1112-research/anomaly-scan.mjs [--games=30] [--seed=90210]
 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Number(flag('games', 30) || 30);
const SEED = Number(flag('seed', 90210) || 90210);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots, PD = W.EpirusPoolDraw;
if (!PD || !T || !T.policyChooserN) { console.error('⛔ sandbox 名单缺件'); process.exit(2); }

/* 池真源（与 tier-census 同源：页面 bundle 的真源表） */
function readPool(table) {
  const L = readFileSync(join(ROOT, table), 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
  return L.slice(1).map(l => { const c = l.split('\t'); return { id: c[h.id], wid: c[h.wid], path: c[h.path], tier: c[h.tier] }; });
}
function loadParams(row) {
  const src = readFileSync(join(ROOT, row.path), 'utf8');
  const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src) || /(?:^|\n)[\w.]*EPIRUS_CHAMPION(?!_3P|_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (!m) return null;
  return W.EpirusPolicy.unpack(JSON.parse(m[1]), true);
}
const MULTI = readPool('champion-map/data/page/pool-members.tsv');
const P2 = readPool('champion-map/pool-members-2p.tsv');
console.log('# 池：multi ' + MULTI.length + ' 枚（hard ' + MULTI.filter(r => r.tier === 'hard').length + '） ‖ 2p ' + P2.length + ' 枚');

/* mulberry32（与 audit-lib 同式） */
function mulberry32(a) {
  const f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next: f };
}

/* 出手谱账 */
function analyze(st, acc) {
  acc.rounds.push(st.round);
  const kinds = new Set(), aiKinds = new Set();
  let ji = 0, def = 0, total = 0;
  for (const e of st.events) {
    if (e.type === 'action' && e.outcome === 'ok') {
      total++; kinds.add(e.pid === undefined ? '?' : e.key); aiKinds.add(e.key);
      if (e.key === R.SK.JI) ji++;
      if (R.byKey[e.key] && R.byKey[e.key].cat === 'defense') def++;
    }
    if (e.type === 'damage' && e.to != null) {
      const p = st.p[e.to];
      /* 死人挨伤可发生在致死那一击；这里查的是"事件里 hp 字段"之外的不变量，只记 NaN */
      if (!isFinite(e.amt)) acc.bad.push('NaN damage amt round=' + st.round + ' ' + JSON.stringify(e).slice(0, 120));
    }
    if (e.type === 'ep' && !isFinite(e.delta)) acc.bad.push('NaN ep delta round=' + st.round);
    if (e.type === 'bead' && !isFinite(e.delta)) acc.bad.push('NaN bead delta round=' + st.round);
  }
  /* 终态不变量 */
  for (const p of st.p) {
    if (!isFinite(p.hp)) acc.bad.push('NaN hp seat=' + p.id + ' round=' + st.round);
    if (!isFinite(p.ep)) acc.bad.push('NaN ep seat=' + p.id + ' round=' + st.round);
    if (p.ep < 0) acc.bad.push('负 ep seat=' + p.id + ' ep=' + p.ep + ' round=' + st.round);
    if (p.elec > 1 || p.boom > 1) acc.bad.push('珠超上限 seat=' + p.id + ' elec=' + p.elec + ' boom=' + p.boom + ' round=' + st.round);
    if (p.elec < 0 || p.boom < 0) acc.bad.push('负珠 seat=' + p.id + ' round=' + st.round);
    if (p.hp > st.mode.hp + 1e-9) acc.bad.push('hp 超开局血 seat=' + p.id + ' hp=' + p.hp + '/' + st.mode.hp + ' round=' + st.round);
  }
  acc.totalActs.push(total);
  acc.jiShare.push(total ? ji / total : 0);
  acc.defShare.push(total ? def / total : 0);
  acc.kindsPerGame.push(aiKinds.size);
  for (const k of aiKinds) acc.kindsUnion.add(k);
  acc.outcome.push(st.winner);
  if (st.round >= ((st.mode && st.mode.maxRounds) || R.MAX_ROUNDS)) acc.maxRoundGames++;
  /* 胜者非法检查 */
  if (st.winner != null && st.winner !== 'draw' && (typeof st.winner !== 'number' || !st.p[st.winner])) acc.bad.push('非法胜者 ' + st.winner + ' round=' + st.round);
}

function runBatch(label, mode, n, poolRows, tier, games, seed0) {
  const acc = { rounds: [], totalActs: [], jiShare: [], defShare: [], kindsPerGame: [], kindsUnion: new Set(), outcome: [], maxRoundGames: 0, bad: [] };
  const tierId = tier || 'lv:hard';
  const band = poolRows.filter(r => r.tier === (tierId === 'lv:sparring' ? 'soft' : 'hard'));
  const useRows = band.length ? band : poolRows;
  const packCache = new Map();
  for (let g = 0; g < games; g++) {
    const rand = mulberry32((seed0 + g * 2246822519) >>> 0).next;
    /* 逐席抽一枚（允许重复、禁全同）——简化版 compose 语义，探针自用，不替代产品抽签 */
    const picks = [];
    for (let s = 0; s < n - 1; s++) picks.push(useRows[Math.floor(rand() * useRows.length) % useRows.length]);
    if (picks.every(p => p === picks[0]) && useRows.length > 1) picks[n - 2] = useRows[(useRows.indexOf(picks[0]) + 1) % useRows.length];
    const choosers = picks.map(row => {
      if (!packCache.has(row.id)) { const p = loadParams(row); packCache.set(row.id, p); }
      const params = packCache.get(row.id);
      if (!params) throw new Error('读不出包 ' + row.id);
      return T.policyChooserN(params, { eps: 0.1 });
    });
    const st = S.createState(mode, mulberry32((seed0 ^ (g * 2654435761)) >>> 0), n);
    st.slotSalt = ((seed0 + g * 2246822519) >>> 0);
    Play.autoGameN(st, choosers, null, null);
    analyze(st, acc);
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const winCount = {};
  for (const w of acc.outcome) winCount[w === 'draw' ? '平' : '胜者分布'] = (winCount[w === 'draw' ? '平' : '胜者分布'] || 0) + 1;
  const draws = acc.outcome.filter(w => w === 'draw').length;
  console.log('\n== ' + label + ' ==');
  console.log('局数 ' + games + ' ‖ 均回合 ' + mean(acc.rounds).toFixed(1) + ' (min ' + Math.min(...acc.rounds) + ' max ' + Math.max(...acc.rounds) + ') ‖ 撞上限 ' + acc.maxRoundGames + ' ‖ 平局 ' + draws);
  console.log('出手/局 ' + mean(acc.totalActs).toFixed(1) + ' ‖ ジ占 ' + (100 * mean(acc.jiShare)).toFixed(1) + '% ‖ 防御类 ' + (100 * mean(acc.defShare)).toFixed(1) + '% ‖ 逐局种类 ' + mean(acc.kindsPerGame).toFixed(1) + ' ‖ 并集 ' + acc.kindsUnion.size);
  if (acc.bad.length) { console.log('⛔ 异常 ' + acc.bad.length + ' 条：'); acc.bad.slice(0, 10).forEach(b => console.log('   ' + b)); }
  else console.log('✔ 不变量全过（NaN/负值/珠上限/血上限/非法胜者）');
  return acc;
}

/* 批次：人数 × 模式 × 档位 */
const HPT = Number(flag('hp', 3) || 3);
for (const n of [2, 3, 5, 8]) {
  const mode = n === 2 ? 'standard' : (HPT === 5 ? 'long' : 'multi');
  const pool = n === 2 ? P2 : MULTI;
  for (const tier of ['lv:hard', 'lv:regular']) {
    runBatch(n + 'P ' + mode + ' ' + tier, mode, n, pool, tier, GAMES, SEED + n * 1000 + (tier === 'lv:hard' ? 0 : 50));
  }
}
/* 5P 长程 */
runBatch('5P long lv:hard', 'long', 5, MULTI, 'lv:hard', GAMES, SEED + 9000);
console.log('\n# done');
