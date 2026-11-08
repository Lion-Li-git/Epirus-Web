
/* 每枚包的**按卡出手谱**（同一把尺，供池内/对 v7 横比）
 * 口径：5 席全是被测包自己（镜像自对局）、ε=0 贪心、multi 桌、60 局；
 *       只数 type==='action' && outcome==='ok' 的出手（与 aggressionProfile 同判据）。
 * 用法：node scratch/ds-1108/card-usage.mjs <out.tsv> <pack1> <pack2> ...
 */
import { writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
const [OUT, ...PACKS] = process.argv.slice(2);
const G = 60;
const CAT = (k) => { const d = R.byKey[k]; return d ? (d.cat || '') : ''; };
const rows = [];
for (const f of PACKS) {
  const params = loadChamp(W, f);
  if (!params) { console.log('读不出 ' + f); continue; }
  const ch = T.policyChooserN(params, 0.15, 0);
  const cnt = {}; let acts = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: T.mulberry32(70000 + g) }, 5);
    const seats = [0,1,2,3,4].map(() => ch);
    Play.autoGameN(st, seats);
    for (const e of st.events) {
      if (e.type !== 'action' || e.outcome !== 'ok') continue;
      if (!e.key || e.pid == null) continue;
      cnt[e.key] = (cnt[e.key] || 0) + 1; acts++;
    }
  }
  const id = f.replace(/^.*\//, '').replace(/\.(bak|js)$/, '');
  const pct = {};
  for (const k of Object.keys(cnt)) pct[k] = cnt[k] / (acts || 1) * 100;
  const keys = Object.keys(pct).filter(k => pct[k] >= 0.5).sort((a, b) => pct[b] - pct[a]);
  const defShare = keys.filter(k => CAT(k) === 'defense').reduce((s, k) => s + pct[k], 0);
  rows.push({ id, path: f, acts, keys, pct, defShare, distinct: keys.length });
  console.log(id.padEnd(14) + ' 出手 ' + String(acts).padStart(6) + ' 用卡 ' + String(keys.length).padStart(2) + ' 防御占比 ' + defShare.toFixed(0) + '%  ' + keys.slice(0, 8).map(k => k + ' ' + pct[k].toFixed(0) + '%').join(' '));
}
const allKeys = [...new Set(rows.flatMap(r => r.keys))];
writeFileSync(OUT, ['id','path','acts','distinct','defShare', ...allKeys].join('\t') + '\n'
  + rows.map(r => [r.id, r.path, r.acts, r.distinct, r.defShare.toFixed(1), ...allKeys.map(k => (r.pct[k] || 0).toFixed(2))].join('\t')).join('\n') + '\n');
console.log('写 ' + OUT + '（卡 ' + allKeys.length + ' 张）');
