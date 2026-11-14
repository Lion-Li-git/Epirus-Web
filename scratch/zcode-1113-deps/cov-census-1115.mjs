/* 池级技能覆盖普查（11-15 夜 · ZCode · D-02 口径）
 *   每包 cardUsageProfile（long 30 + multi 30）→ 按技能列"谁会"，池并集覆盖率 = 会该技能的包数/普查包数。
 *   对照系：11-11 coverage PLAN 的合同尺（用卡 ≥9 + 三件全开 + 防御占比）。 */
import { sandbox, loadChamp, cardUsageProfile } from '../../tools/audit-lib.mjs';

const PACKS = [
  ['OBS6P4-S4000', 'docs/artifacts/obs6-coldstart/OBS6P4-S4000.bak'],
  ['OBS6P9-S4000', 'docs/artifacts/obs6-coldstart/OBS6P9-S4000.bak'],
  ['OBS6E9', 'docs/artifacts/obs6-coldstart/OBS6E9.bak'],
  ['OBS6E5c', 'docs/artifacts/obs6-coldstart/OBS6E5c.bak'],
  ['OBS6E6c', 'scratch/arms/OBS6E6c.bak'],
  ['OBS6E6d', 'scratch/arms/OBS6E6d.bak'],
  ['OBS6E8b', 'scratch/arms/OBS6E8b.bak'],
  ['OBS6E6a', 'scratch/arms/OBS6E6a.bak'],
  ['OBS6E7b', 'scratch/arms/OBS6E7b.bak'],
  ['OBS6P8s2', 'scratch/arms/OBS6P8.seg2000.bak'],
  ['OBS6E10', 'scratch/arms/OBS6E10.bak'],
  ['GD16m', 'scratch/arms/GD16m-D1.bak'],
  ['MSB11-R2', 'docs/artifacts/night-adapt/MSB11-R2S306293884.js'],
  ['MSB14-railgun', 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'],
  ['MSB15R-HITMIX', 'docs/artifacts/night-adapt/MSB15R-hit-mix-R1S2057836694.js'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
  ['GD6a-TILT', 'scratch/arms/GD6a-TILT.bak'],
];
/* Tier 分组（用户 11-15 课程裁定）：T0 短程保底 / T1 环大雷电磁炮 / T2 转伤+防御+摄魂 / T3 小雷地雷激光眼过载炮 / T4 押后 */
const TIERS = {
  T0: ['gun', 'sword', 'tank', 'snipe'],
  T1: ['ring', 'big_t', 'railgun'],
  T2: ['transfer', 'guard', 'reflect', 'bagua', 'holo', 'drain'],
  T3: ['mini_t', 'mine', 'laser_eye', 'cannon'],
  T4: ['firestorm', 'taunt', 'curse'],
};
const W = sandbox();
const profiles = [];
for (const [nm, p] of PACKS) {
  try {
    const params = loadChamp(W, p);
    const cuL = cardUsageProfile(W, params, { games: 30, mode: 'long' });
    const cuM = cardUsageProfile(W, params, { games: 30, mode: 'multi' });
    const pct = {};
    for (const k of new Set([...Object.keys(cuL.pct), ...Object.keys(cuM.pct)])) pct[k] = Math.max(cuL.pct[k] || 0, cuM.pct[k] || 0);
    profiles.push({ nm, cards: Math.max(cuL.distinct, cuM.distinct), def: Math.max(cuL.defShare, cuM.defShare), pct });
    console.error('[census] ' + nm + ' 卡 ' + Math.max(cuL.distinct, cuM.distinct));
  } catch (e) { console.error('[census] ⛔ ' + nm + ' ' + String(e).slice(0, 80)); }
}
console.log('\n=== 技能 × 包 覆盖矩阵（≥2% 记 ●，1-2% 记 ◐；只列 T0-T3） ===');
const allKeys = [...new Set(Object.values(TIERS).flat())];
console.log('skill'.padEnd(10) + 'tier  ' + profiles.map((p) => p.nm.slice(0, 8)).join(' ').padEnd(profiles.length * 9));
for (const tier of Object.keys(TIERS)) {
  for (const k of TIERS[tier]) {
    const row = profiles.map((p) => { const v = p.pct[k] || 0; return v >= 2 ? '   ●' : v >= 1 ? '   ◐' : '   ·'; }).join('');
    const n = profiles.filter((p) => (p.pct[k] || 0) >= 2).length;
    console.log(k.padEnd(10) + tier.padEnd(6) + row + '  ‖ ≥2%: ' + n + '/' + profiles.length);
  }
}
console.log('\n=== 每包用卡/防御（合同尺：用卡 ≥9 + 防御不塌） ===');
for (const p of profiles) console.log(p.nm.padEnd(16) + ' 卡 ' + String(p.cards).padEnd(3) + ' 防御 ' + p.def.toFixed(0) + '%');
