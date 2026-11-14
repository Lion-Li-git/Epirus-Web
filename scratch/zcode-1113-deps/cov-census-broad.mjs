/* 广域覆盖普查（11-15 夜第二波）：上线池 15 + coverage-canon13 + GD3ALL 系——找 tank/transfer/drain/
 *   big_t/cannon/mine 的既有载体（≥2% 记 ●）。15 局/桌形轻量级。 */
import { sandbox, loadChamp, cardUsageProfile } from '../../tools/audit-lib.mjs';

const PACKS = [
  ['CB3-s13', 'scratch/night6/CB3-s13.js'],
  ['CB3-s7', 'scratch/night6/CB3-s7.js'],
  ['GD3ALL-POPP-s17', 'scratch/night3/GD3ALL-POPP-s17.js'],
  ['GD3ALL-PUSHON-s41', 'scratch/night3/GD3ALL-PUSHON-s41.js'],
  ['GD3ALL-G5-8p-s41', 'scratch/night3/GD3ALL-G5-8p-s41.js'],
  ['G5J-50', 'scratch/ds-1109/G5J-50.js'],
  ['CTRL2-Q-s13', 'docs/artifacts/night-adapt/CTRL2-Q-s13.js'],
  ['KDG-B-Q-s13', 'docs/artifacts/night-adapt/KDG-B-Q-s13.js'],
  ['MSB11-R2', 'docs/artifacts/night-adapt/MSB11-R2S306293884.js'],
  ['MSB14-railgun', 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'],
  ['MSB15R-HITMIX', 'docs/artifacts/night-adapt/MSB15R-hit-mix-R1S2057836694.js'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
  ['GD16m', 'scratch/arms/GD16m-D1.bak'],
  ['K2', 'docs/artifacts/kept/e70-out__D02-31.bak'],
  ['T8-s114', 'docs/artifacts/e528-out/T8-s114.js'],
  ['v7blk1-92', 'docs/artifacts/v7blk1-92.bak'],
  ['v7seat24b-92', 'docs/artifacts/v7seat24b-92.bak'],
];
const KEYS = ['gun', 'sword', 'tank', 'snipe', 'ring', 'big_t', 'railgun', 'transfer', 'guard', 'reflect', 'bagua', 'holo', 'drain', 'mini_t', 'mine', 'laser_eye', 'cannon', 'proto', 'rod', 'charge'];
const W = sandbox();
const profiles = [];
for (const [nm, p] of PACKS) {
  try {
    const params = loadChamp(W, p);
    const cuL = cardUsageProfile(W, params, { games: 15, mode: 'long' });
    const cuM = cardUsageProfile(W, params, { games: 15, mode: 'multi' });
    const pct = {};
    for (const k of new Set([...Object.keys(cuL.pct), ...Object.keys(cuM.pct)])) pct[k] = Math.max(cuL.pct[k] || 0, cuM.pct[k] || 0);
    profiles.push({ nm, pct, cards: Math.max(cuL.distinct, cuM.distinct) });
    console.error('[broad] ' + nm + ' 卡 ' + Math.max(cuL.distinct, cuM.distinct));
  } catch (e) { console.error('[broad] ⛔ ' + nm + ' ' + String(e).slice(0, 80)); }
}
console.log('\nskill'.padEnd(10) + profiles.map((p) => p.nm.slice(0, 7)).join(' ').padEnd(profiles.length * 8));
for (const k of KEYS) {
  const row = profiles.map((p) => { const v = p.pct[k] || 0; return v >= 2 ? '     ●' : v >= 1 ? '     ◐' : '     ·'; }).join('');
  const carriers = profiles.filter((p) => (p.pct[k] || 0) >= 2).map((p) => p.nm);
  console.log(k.padEnd(10) + row + '  ‖ ' + (carriers.length ? carriers.join(',') : '—— 零载体'));
}
