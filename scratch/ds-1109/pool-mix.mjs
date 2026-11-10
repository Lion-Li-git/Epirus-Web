
import { sandbox } from '../../tools/audit-lib.mjs';
import { EXAM_POOL, EXAM_FN } from '../../server/opp-pool.mjs';
const W = sandbox(); const T = W.EpirusTrainer; const B = W.EpirusBots;
const PIERCE = new Set(['sword', 'snipe', 'railgun', 'laserEye', 'bigT']);
const DEF = new Set(['guard', 'reflect', 'bagua', 'jinshield', 'armor', 'holo']);
const stats = [];
for (const e of EXAM_POOL) {
  const fn = B[EXAM_FN[e.name]];
  if (typeof fn !== 'function') { console.error('缺函数 ' + e.name + ' → ' + EXAM_FN[e.name]); continue; }
  const cnt = {}; let acts = 0;
  for (let g = 0; g < 8; g++) {
    const n = 5; const ch = []; for (let i = 0; i < n; i++) ch.push(fn);
    let st; try { st = T.oneGameN(ch, 900 + g * 17, n, { mode: 'multi' }); } catch (err) { continue; }
    for (const ev of (st.state.events || [])) if (ev.type === 'action' && ev.key) { cnt[ev.key] = (cnt[ev.key] || 0) + 1; acts++; }
  }
  const pierce = Object.keys(cnt).filter(k => PIERCE.has(k)).reduce((a, k) => a + cnt[k], 0);
  const def = Object.keys(cnt).filter(k => DEF.has(k)).reduce((a, k) => a + cnt[k], 0);
  stats.push({ name: e.name, axis: e.axis, acts, gun: 100 * (cnt.gun || 0) / Math.max(1, acts), pierce: 100 * pierce / Math.max(1, acts), def: 100 * def / Math.max(1, acts) });
}
console.log('席名'.padEnd(15) + '轴'.padEnd(9) + '出手'.padStart(6) + '枪%'.padStart(7) + '穿透%'.padStart(7) + '防御%'.padStart(7));
for (const s of stats) console.log(s.name.padEnd(15) + String(s.axis).padEnd(9) + String(s.acts).padStart(6) + s.gun.toFixed(1).padStart(7) + s.pierce.toFixed(1).padStart(7) + s.def.toFixed(1).padStart(7));
const avg = k => stats.reduce((a, s) => a + s[k], 0) / Math.max(1, stats.length);
console.log('\n均值：枪 ' + avg('gun').toFixed(1) + '% ‖ 穿透 ' + avg('pierce').toFixed(1) + '% ‖ 防御 ' + avg('def').toFixed(1) + '%');
console.log('枪% ≥25：' + stats.filter(s => s.gun >= 25).map(s => s.name).join(' '));
console.log('穿透% ≥15：' + stats.filter(s => s.pierce >= 15).map(s => s.name).join(' '));
console.log('防御% ≥40：' + stats.filter(s => s.def >= 40).map(s => s.name).join(' '));
