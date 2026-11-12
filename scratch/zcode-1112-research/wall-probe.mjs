#!/usr/bin/env node
/* 研究探针：防御墙复测 —— 冠军（hard 带）vs 纯防御/反弹席，2P 与 5P。
 * 文档基线（FINDING-2026-11-06-hard-vs-defense-wall-ds.md）：2P 40 局 26 平（65%）、710/828 攻击是枪、坦克 0、每局 2.25 伤。
 * 用法：node scratch/zcode-1112-research/wall-probe.mjs [--games=40] [--seed=90210]
 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Number(flag('games', 40) || 40);
const SEED = Number(flag('seed', 90210) || 90210);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;

function mulberry32(a) {
  const f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next: f };
}
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

const P2 = readPool('champion-map/pool-members-2p.tsv').filter(r => r.tier === 'hard');
const MULTI = readPool('champion-map/data/page/pool-members.tsv').filter(r => r.tier === 'hard');
console.log('# hard 带：2P ' + P2.length + ' 枚 ‖ multi ' + MULTI.length + ' 枚');

function wallProbe(label, mode, n, champRows, wallBot, games, champSeat) {
  let wins = 0, draws = 0, losses = 0, roundsSum = 0;
  let dmgByChamp = 0, atkMix = {}, atkTotal = 0, champDealtPerGame = [];
  for (let g = 0; g < games; g++) {
    const row = champRows[g % champRows.length];
    const params = loadParams(row);
    if (!params) throw new Error('读不出 ' + row.id);
    const champ = T.policyChooserN(params, { eps: 0.1 });
    const choosers = [];
    for (let i = 0; i < n; i++) choosers.push(i === champSeat ? champ : wallBot);
    const st = S.createState(mode, mulberry32((SEED + g) >>> 0), n);
    st.slotSalt = (SEED + g * 2246822519) >>> 0;
    Play.autoGameN(st, choosers, null, null);
    roundsSum += st.round;
    const w = st.winner;
    if (w === champSeat) wins++;
    else if (w === 'draw') draws++;
    else if (typeof w === 'number') losses++;
    /* 冠军席造成伤害 + 攻击混比 */
    let dealt = 0;
    for (const e of st.events) {
      if (e.type === 'damage' && e.source === champSeat && e.amt > 0) dealt += e.amt;
      if (e.type === 'action' && e.outcome === 'ok' && e.pid === champSeat && R.ATK_EFFECT.indexOf(e.key) >= 0) {
        atkTotal++; atkMix[e.key] = (atkMix[e.key] || 0) + 1;
      }
    }
    champDealtPerGame.push(dealt);
    dmgByChamp += dealt;
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const mix = Object.entries(atkMix).map(([k, v]) => R.byKey[k].name + ' ' + v).join(' ‖ ') || '无';
  console.log('\n== ' + label + '（冠军在 ' + champSeat + ' 号座）==');
  console.log('局 ' + games + ' ‖ 胜 ' + wins + ' 平 ' + draws + ' 负 ' + losses + ' ‖ 均回合 ' + (roundsSum / games).toFixed(1) + ' ‖ 冠军均造伤/局 ' + (dmgByChamp / games).toFixed(2));
  console.log('冠军攻击出手 ' + atkTotal + ' 次：' + mix);
}

/* 2P：三面墙 */
const walls = [
  ['全程只防御 pickDefend', B.pickDefend],
  ['全程刷反弹 pickReflectSpam', B.pickReflectSpam],
  ['攒钱+反弹(会玩)', function (st, pid, legal) {
    const k = B.pickReflectSpam(st, pid, legal);
    if (typeof k === 'string' && k) return k;
    if (k && k.key) return k;
    return B.pickDeepSaver(st, pid, legal);
  }]
];
for (const [name, bot] of walls) {
  for (const seat of [0, 1]) {
    wallProbe('2P hard冠军 vs ' + name, 'standard', 2, P2, bot, GAMES, seat);
  }
}
/* 5P：1 冠军 + 4 面墙 */
for (const [name, bot] of walls) {
  wallProbe('5P multi hard冠军×1 vs ' + name + '×4', 'multi', 5, MULTI, bot, GAMES, 2);
}
console.log('\n# done');
