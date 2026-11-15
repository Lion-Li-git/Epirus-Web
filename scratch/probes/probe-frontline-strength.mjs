#!/usr/bin/env node
/* probe-frontline-strength.mjs —— 前线真实强度尺（ZCode · 2026-11-16 凌晨，PLAN 批2）
 *
 * 动机：exam-4n 的 champ 夹具是旧 MSB 代（MSB15R/GD6a/Q-s47），H 集只有 6 枚真包——
 * 都不是"现役最强"。真实强度应该量「对现役前线能赢多少」：对手集 = 当前最强的 8 枚
 * （shaped1 / V3S2 / V3a / V3b / E9 / P4-S4000 / P9-S4000 / WSEL9-200）。
 * 网格：对手 × (2:standard, 5:multi, 5:long)，每格 GAMES 局，被测席轮换；
 * 复合分 = 全格胜率均值（X-weighted 可后加）。对局核心 = T.oneGameN + T.rankOf（exam-v2 口径）。
 *
 * 用法：node scratch/probes/probe-frontline-strength.mjs --packs=a.bak,... [--games=20] [--out=x.json]
 */
import { writeFileSync } from 'node:fs';
import { rejectUnknownFlags, sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { makeAsChooser } from '../../tools/bot-chooser-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['packs', 'games', 'out'], 'probe-frontline-strength');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const PACKS = arg('packs', '').split(',').map((s) => s.trim()).filter(Boolean);
if (!PACKS.length) { console.error('用法：--packs=... [--games=20] [--out=x.json]'); process.exit(2); }
const GAMES = Math.max(6, Number(arg('games', 20)) || 20);
const GRID = [['2', 'standard'], ['5', 'multi'], ['5', 'long']];

const FRONT = [
  ['shaped1', 'scratch/arms/OBS6-SHAPEDIST.bak'],
  ['V3S2', 'scratch/arms/OBS6-SHAPEDIST-V3S2.bak'],
  ['V3a', 'scratch/arms/OBS6-SHAPEDIST-V3a.bak'],
  ['V3b', 'scratch/arms/OBS6-SHAPEDIST-V3b.bak'],
  ['E9', 'docs/artifacts/obs6-coldstart/OBS6E9.bak'],
  ['P4-S4000', 'docs/artifacts/obs6-coldstart/OBS6P4-S4000.bak'],
  ['P9-S4000', 'docs/artifacts/obs6-coldstart/OBS6P9-S4000.bak'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
];

const W = sandbox();
const T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const asChooser = makeAsChooser({ T, R });
const FRONT_CH = [];
for (const [nm, p] of FRONT) {
  let params = null;
  try { params = loadChamp(W, p); } catch (e) { console.error('⛔ 前线对手读不出：' + nm + ' ' + String(e).slice(0, 80)); process.exit(2); }
  FRONT_CH.push([nm, T.policyChooserN(params, 0.15)]);
}

function evalPack(tag, path) {
  const params = loadChamp(W, path);
  const sel = T.policyChooserN(params, 0.15);
  const cells = [];
  for (const [onm, och] of FRONT_CH) for (const [n, mode] of GRID) {
    const cell = { opp: onm, n: +n, mode, games: 0, win: 0 };
    const N = +n;
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const choosers = [];
      for (let pid = 0; pid < N; pid++) choosers.push(pid === seat ? sel : och);
      const gseed = 720000 + N * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977;
      const r = T.oneGameN(choosers, gseed, N, { mode });
      cell.games++;
      cell.win += T.rankOf(r.state, seat, gseed) === 1 ? 1 : 0;
    }
    cells.push(cell);
  }
  const wr = {};
  for (const c of cells) wr[c.opp + '@' + c.n + c.mode[0]] = +(c.win / c.games).toFixed(3);
  const composite = +(cells.reduce((a, c) => a + c.win, 0) / cells.reduce((a, c) => a + c.games, 0)).toFixed(4);
  return { tag, path, composite, perCell: wr, cells };
}

const OUT = arg('out', '');
const results = [];
for (const p of PACKS) {
  const tag = p.split('/').pop().replace(/\.bak$|\.js$/, '');
  const t0 = Date.now();
  let r = null;
  try { r = evalPack(tag, p); } catch (e) { console.error('⛔ ' + tag + ' ' + String(e).slice(0, 140)); continue; }
  r.sec = +((Date.now() - t0) / 1000).toFixed(1);
  results.push(r);
  console.error('[' + tag + '] 前线复合 ' + r.composite + ' ' + r.sec + 's');
}
results.sort((a, b) => b.composite - a.composite);
console.log('\n前线真实强度（对手=现役 8 强，格=' + GRID.map((g) => g[0] + g[1][0]).join('/') + '，' + GAMES + ' 局/格）');
console.log('排名 包'.padEnd(24) + '复合   ' + FRONT.map((f) => f[0].slice(0, 7)).join(' ').padStart(FRONT.length * 8));
results.forEach((r, i) => {
  const row = FRONT.map(([nm]) => {
    const keys = Object.keys(r.perCell).filter((k) => k.startsWith(nm + '@'));
    const v = keys.reduce((a, k) => a + r.perCell[k], 0) / Math.max(1, keys.length);
    return (v ? v.toFixed(2) : '—').padStart(7);
  }).join(' ');
  console.log(String(i + 1).padStart(2) + ' ' + r.tag.padEnd(21) + r.composite.toFixed(4) + ' ' + row);
});
if (OUT) { writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8'); console.error('产物 → ' + OUT); }
