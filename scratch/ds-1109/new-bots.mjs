
import { sandbox } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer; const B = W.EpirusBots;
const PIERCE = new Set(['sword', 'snipe', 'railgun', 'laserEye', 'bigT']);
const DEF = new Set(['guard', 'reflect', 'bagua', 'jinshield', 'armor', 'holo']);
for (const nm of ['pickSwordSpam', 'pickPierceMix']) {
  const fn = B[nm]; if (typeof fn !== 'function') { console.log(nm + ' 不存在'); continue; }
  const cnt = {}; let acts = 0;
  for (let g = 0; g < 8; g++) { const n = 5; const ch = []; for (let i = 0; i < n; i++) ch.push(fn); let st;
    try { st = T.oneGameN(ch, 900 + g * 17, n, { mode: 'multi' }); } catch (e) { continue; }
    for (const ev of (st.state.events || [])) if (ev.type === 'action' && ev.key) { cnt[ev.key] = (cnt[ev.key] || 0) + 1; acts++; } }
  const pierce = Object.keys(cnt).filter(k => PIERCE.has(k)).reduce((a, k) => a + cnt[k], 0);
  const def = Object.keys(cnt).filter(k => DEF.has(k)).reduce((a, k) => a + cnt[k], 0);
  console.log(nm.padEnd(16) + ' 枪 ' + (100 * (cnt.gun || 0) / Math.max(1, acts)).toFixed(1) + '%  穿透 ' + (100 * pierce / Math.max(1, acts)).toFixed(1) + '%  防御 ' + (100 * def / Math.max(1, acts)).toFixed(1) + '%  出手 ' + acts + '  谱 ' + Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,5).map(k=>k+':'+cnt[k]).join(' '));
}
