/* 事件流里 charge 那一手长什么样（语义游标扫不到东西的直接取证） */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const W = sandbox();
const T = W.EpirusTrainer, R = W.EpirusRules;
const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const A = createArena2(W, { refParams: ref, temp: 0.15, highN: 1, wantEvents: 1 });
const ch = T.policyChooserN(ref, 0.15);
const types = {}, keysByType = {};
let n = 0, chargeLike = [];
for (let g = 0; g < 4; g++) {
  const idx = A.shapes.findIndex((s) => s.n === 3 && s.mode === 'long');
  const r = A.playOne(ch, idx, g, 101);
  for (const e of (r.evs || [])) {
    types[e.type] = (types[e.type] || 0) + 1;
    if (e.type === 'action') { const k = e.key; keysByType[k] = (keysByType[k] || 0) + 1;
      if (k === R.SK.CHARGE && chargeLike.length < 3) chargeLike.push(JSON.stringify(e)); }
  }
  n += (r.evs || []).length;
}
console.log('事件总数 ' + n + ' ‖ 类型分布 ' + JSON.stringify(types));
console.log('action 事件里 key=charge 的条数：' + (keysByType[R.SK.CHARGE] || 0) + ' ‖ 前 3 条原文：');
for (const s of chargeLike) console.log('  ' + s);
console.log('全部 key 计数（前 12）：' + Object.entries(keysByType).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>k+':'+v).join(' ‖ '));
