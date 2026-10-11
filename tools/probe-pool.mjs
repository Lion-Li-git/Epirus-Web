#!/usr/bin/env node
/* probe-pool.mjs —— **池形态的那把新尺**（§E590 · 契约见 `docs/POOL-CONTRACT.md` §5）
 *
 * 为什么不能拿旧尺直接量池：仓里每一把 5 人尺的装配都写死"1 席人 + 4 席**同一枚**包"
 *   （`probe-human-seat` 的 `duelAssembly(..., params, ...)`、`skill-report` 的 `--champ=` 单数、
 *    `usage-probe` 的镜像五席、`duel-run` 的 `field:[nm,nm,nm,nm]`）。改成逐席不同枚之后
 *   这些尺量到的不是同一个产品 ⇒ **旧尺缺省一律不动**（在册读数还要能引用），新装配另开一把。
 * 装配真源：抽签用 `js/pool-draw.js`（产品在用它、门 D234 在钉它），原型用 `audit-lib.humanPrototypes`（与旧尺同一组），
 *   对局循环用 `v2v4-lib.duelAssembly` 的 `chooserFor`/`onGame` 钩子 ⇒ **这把尺没有第二份引擎实现**。
 * v1 的定位（用户要裁的那句，我先按保守做）：**只排序 + 量 σ，不作换包判词**。
 *   依据是 §E586/§E587 的教训：一次抽样里的"稳"可能只是仪器稳，换框就翻（`waste` 那次 0.703 → −0.031）。
 *
 * 用法：node tools/probe-pool.mjs [--tier=hard] [--games=60] [--seeds=90210,90211] [--modes=multi,long]
 *        [--members=champion-map/pool-members.tsv] [--out=某.tsv]
 * 退出码：0 ‖ 2 输入/成员不齐 ‖ 7 有成员读不出包（缺行 ≠ 量了没测出来）
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags, humanPrototypes } from './audit-lib.mjs';
import { duelAssembly } from './v2v4-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
rejectUnknownFlags(process.argv.slice(2), ['tier', 'games', 'seeds', 'modes', 'members', 'out', 'n'], 'probe-pool');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const TIER = flag('tier', 'hard'), G = Number(flag('games', 60));
const SEEDS = String(flag('seeds', '90210,90211')).split(',').map(Number).filter(x => !Number.isNaN(x));
const MODES = String(flag('modes', 'multi,long')).split(',').filter(Boolean);
const TABLE = flag('members', 'champion-map/pool-members.tsv');

if (SEEDS.length < 2) { console.error('⛔ 至少两枚 seed ⇒ 不然量不出批间抖动（σ），只能给一个孤零零的均值'); process.exit(2); }
const PT = join(ROOT, TABLE);
if (!existsSync(PT)) { console.error('⛔ 池真源表不在：' + TABLE + '（先跑 tools/pool-add.mjs）'); process.exit(2); }
const L = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
for (const c of ['id', 'wid', 'path', 'tier']) if (h[c] === undefined) { console.error('⛔ 表缺列 ' + c); process.exit(2); }
const members = L.slice(1).map(l => l.split('\t')).filter(r => r[h.tier] === TIER);
if (members.length < 2) {
  console.error('⛔ tier=' + TIER + ' 只有 ' + members.length + ' 枚 ⇒ 池抽签在数学上必然"四席全同"（用户裁定不许）' +
    ' ⇒ 这一档还没成型，先别量（要量单包请用 tools/probe-human-seat.mjs）');
  process.exit(2);
}

const W = sandbox();
const PD = W.EpirusPoolDraw;
if (!PD || typeof PD.compose !== 'function') { console.error('⛔ `js/pool-draw.js` 没进 sandbox 的 CORE 名单'); process.exit(2); }
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const lite = members.map(r => ({ id: r[h.id], wid: r[h.wid] }));
const PARAMS = {}, CHOOSERS = {};
const bad = [];
for (const r of members) {
  let p = null;
  try { p = loadChamp(W, r[h.path]); } catch (e) { p = null; }
  if (!p) { bad.push(r[h.id] + '(' + r[h.path] + ')'); continue; }
  PARAMS[r[h.id]] = p; CHOOSERS[r[h.id]] = T.policyChooserN(p, 0.15);
}
if (bad.length) { console.error('⛔ ' + bad.length + ' 枚读不出包：' + bad.join(' ‖ ') + ' ⇒ 按失败处理'); process.exit(7); }
const HUMAN = humanPrototypes(B);
for (const x of HUMAN) if (typeof x[1] !== 'function') { console.error('⛔ 人类原型「' + x[0] + '」不是函数'); process.exit(7); }

console.log('# 池形态新尺（1 席人类形状 + 4 席按 tier=' + TIER + ' 抽 · 允许重复 · 禁四席全同）');
console.log('# 成员 ' + lite.length + ' 枚：' + lite.map(m => m.id).join(' ‖ '));
console.log('# ' + G + ' 局/格 × ' + SEEDS.length + ' 枚 seed（' + SEEDS.join('/') + '）· 装配实现与 `probe-human-seat` 同一份（duelAssembly）');
console.log('# 读法：印的是**人类那一席的夺冠率**（越高 = 这池子拿它没办法）；批间极差 = 这把尺自己的抖动，**没量出 σ 之前不许拿来判换不换包**\n');

const rows = [];
for (const mode of MODES) {
  const per = {};                                   // 格 → [每枚 seed 的人类夺冠率]
  const memberGames = {}, memberWins = {};
  let allSameGames = 0, totalGames = 0, distinctSum = 0, missSeat = 0;
  let seqSamples = null;                            // 只留第一枚 seed 的前 6 场组成（给人眼看"随机"是不是真的在换）
  for (const seed of SEEDS) {
    const games = new WeakMap();
    let curState = null, cur = null;
    const chooserFor = function (pid, st) {
      if (st !== curState) {
        curState = st;
        const comp = PD.compose(lite, 4, PD.rng((st.slotSalt >>> 0) || 1));
        cur = { comp: comp, byPid: {}, order: 0 };
        games.set(st, cur);
      }
      if (!(pid in cur.byPid)) { cur.byPid[pid] = cur.comp.seats[cur.order++]; }
      const m = cur.byPid[pid];
      if (!m) { missSeat++; return null; }           /* null 会落回 duelAssembly 自带的那颗 ⇒ 计数暴露，不静默补位 */
      return CHOOSERS[m.id];
    };
    const onGame = function (st, scriptedSeat) {
      const g = games.get(st); if (!g) return;
      totalGames++;
      if (g.comp.allSame) allSameGames++;
      distinctSum += PD.distinct(g.comp.seats);
      if (seqSamples === null) seqSamples = [];
      if (seqSamples.length < 6) seqSamples.push(g.comp.seats.map(s => s.id).join('+'));
      for (const pid in g.byPid) {
        const id = g.byPid[pid].id;
        memberGames[id] = (memberGames[id] || 0) + 1;
        if (st.winner === Number(pid)) memberWins[id] = (memberWins[id] || 0) + 1;
      }
    };
    HUMAN.forEach(function (x, i) {
      const r = duelAssembly({ S: S, Play: Play, T: T, R: R }, PARAMS[lite[0].id],
        { games: G, mode: mode, seed0: seed, scripted: x[1], chooserFor: chooserFor, onGame: onGame });
      (per[x[0]] = per[x[0]] || []).push(r.winPct);
    });
  }
  console.log('== 口径 ' + mode + ' ==');
  if (seqSamples && seqSamples.length) console.log('   前 ' + seqSamples.length + ' 场组成（seed=' + SEEDS[0] + '）：' + seqSamples.join(' ‖ '));
  if (missSeat) console.log('   ⛔ 有 ' + missSeat + ' 次决策没分配到成员（落回了单包）⇒ 组成漏席，本行的数不可引用');
  console.log('   格 | ' + SEEDS.join(' | ') + ' | 均值 | 批间极差');
  for (const x of HUMAN) {
    const v = per[x[0]];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const spread = Math.max.apply(null, v) - Math.min.apply(null, v);
    console.log('   ' + (x[0] + '            ').slice(0, 14) + '| ' + v.map(a => a.toFixed(1).padStart(5)).join(' | ') +
      ' | ' + mean.toFixed(1).padStart(5) + ' | ' + spread.toFixed(1).padStart(5));
    rows.push({ mode: mode, cell: x[0], seedVals: v.join(','), mean: mean.toFixed(2), spread: spread.toFixed(2) });
  }
  console.log('   ⚑ 六格均值的批间极差 = ' + (function () {
    const means = SEEDS.map((s, i) => per[HUMAN[0][0]][i]);
    const all = SEEDS.map((s, i) => HUMAN.reduce((a, x) => a + per[x[0]][i], 0) / HUMAN.length);
    return (Math.max.apply(null, all) - Math.min.apply(null, all)).toFixed(2) + 'pt（' + all.map(a => a.toFixed(2)).join(' vs ') + '）';
  })());
  console.log('   ⚑ 四席全同的场数 = ' + allSameGames + ' / ' + totalGames + '（用户裁定不许全同 ⇒ 不为 0 就要查抽签）');
  console.log('   ⚑ 平均每场不同枚数 = ' + (distinctSum / Math.max(1, totalGames)).toFixed(2) + ' / 4');
  console.log('   逐枚夺冠率：' + lite.map(m => m.id + ' ' + ((memberWins[m.id] || 0) / Math.max(1, memberGames[m.id]) * 100).toFixed(1) + '%(上场 ' + (memberGames[m.id] || 0) + ')').join(' ‖ '));
  rows.push({ mode: mode, cell: '__allSame', seedVals: allSameGames + '/' + totalGames, mean: (distinctSum / Math.max(1, totalGames)).toFixed(2), spread: '' });
}
if (flag('out', '')) {
  const cols = ['mode', 'cell', 'seedVals', 'mean', 'spread'];
  writeFileSync(join(ROOT, flag('out')), cols.join('\t') + '\n' + rows.map(r => cols.map(c => r[c]).join('\t')).join('\n') + '\n');
  console.log('\n✔ 已写 ' + flag('out'));
}
console.log('\n# 最后一行是机器可读的（给门与以后的自己核对用）：');
console.log(JSON.stringify({ tier: TIER, members: lite.length, games: G, seeds: SEEDS, modes: MODES,
  allSameGames: rows.filter(r => r.cell === '__allSame').map(r => r.seedVals) }));
