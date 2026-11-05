/* 圆团根因取证（Qoder · 11-05）：洗平/成团到底是渲染法律还是**坐标分布**？
 * 直接读两份烘好的页面里的 DATA 坐标（xt/yt），算归一化后的最近邻距离分布与"空域占比"，
 * 与渲染无关 —— 底色是 IDW 加权，晕与晕能不能搭接完全由这批坐标的间距决定。
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function dataOf(txt) {
  const m = /var DATA = (\[[\s\S]*?\]);/.exec(txt);
  if (!m) throw new Error('DATA 段没抓到');
  return JSON.parse(m[1]);
}
function load(rev) {
  const txt = rev === 'WORK' ? readFileSync('champion-map/index.html', 'utf8')
    : execSync('git show ' + rev + ':champion-map/index.html', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return dataOf(txt);
}
function stats(rows, label) {
  /* 投影列名在两代里不同：老版用 x2/y2 或 xt/yt；取存在的那一对 */
  const keys = rows[0];
  const kx = ['xt', 'x2', 'x3'].find(k => k in keys && typeof keys[k] === 'number');
  const ky = ['yt', 'y2', 'y3'].find(k => k in keys && typeof keys[k] === 'number');
  if (!kx || !ky) { console.log(label + '：找不到投影坐标列（键 ' + Object.keys(keys).slice(0, 14).join(',') + '…）'); return; }
  const pts = rows.filter(r => Number.isFinite(r[kx]) && Number.isFinite(r[ky])).map(r => [r[kx], r[ky]]);
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of pts) { for (let i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } }
  const nrm = pts.map(p => [(p[0] - lo[0]) / (hi[0] - lo[0] || 1), (p[1] - lo[1]) / (hi[1] - lo[1] || 1)]);
  const N = nrm.length;
  const d1 = [];
  for (let i = 0; i < N; i++) {
    let best = Infinity;
    for (let j = 0; j < N; j++) { if (i === j) continue; const dx = nrm[i][0] - nrm[j][0], dy = nrm[i][1] - nrm[j][1]; const d = Math.hypot(dx, dy); if (d < best) best = d; }
    d1.push(best);
  }
  d1.sort((a, b) => a - b);
  /* 覆盖率：把画布切成 60×30 格，数"离最近点 > 3% 对角"的空格占比（= 底色拿不到任何权重的地方） */
  const GX = 60, GY = 30;
  let empty = 0, tot = 0;
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    const x = (gx + 0.5) / GX, y = (gy + 0.5) / GY;
    let best = Infinity;
    for (let i = 0; i < N; i++) { const d = Math.hypot(nrm[i][0] - x, nrm[i][1] - y); if (d < best) best = d; }
    tot++; if (best > 0.03) empty++;
  }
  const spread = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]);
  console.log(label + '：坐标列 ' + kx + '/' + ky + ' ‖ 枚数 ' + N +
    ' ‖ 最近邻距离 中位 ' + (100 * d1[N >> 1]).toFixed(2) + '% 画布宽 ‖ P90 ' + (100 * d1[Math.floor(N * 0.9)]).toFixed(2) + '%' +
    ' ‖ 点云对角跨度 ' + spread.toFixed(2) +
    ' ‖ 空格占比(离最近点>3%) ' + (100 * empty / tot).toFixed(0) + '%');
}
const revs = process.argv.slice(2);
for (const r of revs) {
  try { stats(load(r), r); } catch (e) { console.log(r + ' ⇒ ' + String(e && e.message || e).slice(0, 90)); }
}
