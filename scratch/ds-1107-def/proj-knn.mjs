
/* 3 枚夜班候补的 xt/yt 用 12 维特征空间 kNN 插值（不动其他点、不重投影）
 * 病：intake 没做投影，xt/yt 抄的是线性 x2/y2 ⇒ 地图视图 scr y≈12px（贴顶边、被工具栏挡住）。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const F = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(F, F + '.bak-proj');
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd(F), H = t[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys',
  'charges', 'waste', 'noThreatStance', 'fieldAAtk'];
const num = (v) => { const x = +v; return isFinite(x) ? x : NaN; };
const rows = t.slice(1);
const idx = (k) => h[k];
/* 标准化参数（用全部有投影的旧行） */
const old = rows.filter(r => r[idx('xt')] !== '' && r[idx('xt')] !== undefined && r[idx('id')] && !['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7'].includes(r[idx('id')]));
const cols = FEAT.map(k => old.map(r => num(r[idx(k)])));
const mu = cols.map(c => c.reduce((a, b) => a + b, 0) / c.length);
const sd = cols.map((c, k) => { const m = mu[k]; return Math.sqrt(c.reduce((a, b) => a + (b - m) ** 2, 0) / c.length) || 1; });
const vec = (r) => FEAT.map((k, j) => (num(r[idx(k)]) - mu[j]) / sd[j]);
const NEW = ['CTRL2-Q-s7', 'CTRL2-Q-s13', 'ADAPT2-Q-s7'];
const oldV = old.map(r => ({ r, v: vec(r) }));
for (const id of NEW) {
  const row = rows.find(r => r[idx('id')] === id);
  const v = vec(row);
  const dist = oldV.map(o => ({ o, d: v.reduce((s, x, j) => s + (x - o.v[j]) ** 2, 0) }));
  dist.sort((a, b) => a.d - b.d);
  const K = 8, near = dist.slice(0, K);
  const wsum = near.reduce((s, x) => s + 1 / (x.d + 1e-9), 0);
  const mix = (k) => near.reduce((s, x) => s + num(x.o.r[idx(k)]) / (x.d + 1e-9), 0) / wsum;
  for (const k of ['xt', 'yt', 'xt3', 'yt3', 'zt3']) row[idx(k)] = mix(k).toFixed(6);
  console.log(id + ' ← ' + near.slice(0, 4).map(x => x.o.r[idx('id')]).join(',') + '  xt/yt=' + row[idx('xt')] + '/' + row[idx('yt')]);
}
writeFileSync(F, t.map(r => r.join('\t')).join('\n') + '\n');
console.log('写回 ' + F);
