import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const D = join(ROOT, 'champion-map', 'data', 'display.tsv');
const L = readFileSync(D, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = L[0].split('\t');
const idx = (c) => H.indexOf(c);
const regL = readFileSync(join(ROOT, 'champion-map', 'data', 'registry.tsv'), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const rh = regL[0].split('\t'); const reg = new Map();
for (const l of regL.slice(1)) { const c = l.split('\t'); if (c[0]) reg.set(c[0], { ts: c[rh.indexOf('ts')] || '', fam: c[rh.indexOf('fam')] || '' }); }
const rows = [];
for (const l of L.slice(1)) {
  const c = l.split('\t'); if (!c[idx('id')]) continue;
  const o = { id: c[idx('id')], ts: c[idx('ts')] || '', fam: c[idx('fam')] || '' };
  for (const k of ['P5','P5L','P5R','P5RL','C5R','C5RL']) o[k] = c[idx(k)] || '';
  const g = reg.get(o.id) || {}; o.ts = o.ts || g.ts || ''; o.fam = o.fam || g.fam || '';
  o.t = Date.parse(o.ts);
  rows.push(o);
}
rows.sort((a,b) => (Number.isFinite(a.t) ? a.t : 0) - (Number.isFinite(b.t) ? b.t : 0));
const N = rows.length;
const W = 1240, Hh = 330, Lp = 62, Rp = 20, Tp = 34, Bp = 46;
const xAt = (i) => Lp + (N <= 1 ? 0 : i / (N - 1)) * (W - Lp - Rp);
const SER = ['P5','P5L','P5R','P5RL','C5R','C5RL'];
const COL = { P5:'#38bdf8', P5L:'#fb7185', P5R:'#fb923c', P5RL:'#22d3ee', C5R:'#a78bfa', C5RL:'#4ade80' };
const SPAN = 0.08, ITERS = 2;
function values(key) { return rows.map(r => { const v = Number(r[key]); return Number.isFinite(v) && r[key] !== '' ? v : null; }); }
function loess(pts) {
  if (pts.length < 3) return [];
  const n = pts.length;
  const r = Math.max(3, Math.floor(n * SPAN));
  let rw = new Array(n).fill(1);
  let fit = [];
  for (let it = 0; it <= ITERS; it++) {
    fit = [];
    for (let ti = 0; ti < n; ti++) {
      const xi = pts[ti][0];
      const ds = pts.map(p => Math.abs(p[0] - xi)).sort((a,b) => a-b);
      const md = Math.max(1e-9, ds[Math.min(n - 1, r)]);
      let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let j = 0; j < n; j++) {
        const u = Math.abs(pts[j][0] - xi) / md;
        const w = (u >= 1 ? 0 : Math.pow(1 - u * u * u, 3)) * rw[j];
        if (w <= 0) continue;
        const x = pts[j][0] - xi, y = pts[j][1];
        sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
      }
      const den = sw * sxx - sx * sx;
      const b = Math.abs(den) < 1e-12 ? 0 : (sw * sxy - sx * sy) / den;
      const a = (sy - b * sx) / sw;
      fit.push([pts[ti][0], a]);
    }
    if (it === ITERS) break;
    const res = pts.map((p, i) => Math.abs(p[1] - fit[i][1]));
    const med = res.slice().sort((a,b) => a-b)[Math.floor(res.length / 2)] || 1e-9;
    rw = res.map(v => { const u = v / (6 * med); return u >= 1 ? 0 : Math.pow(1 - u * u, 2); });
  }
  return fit;
}
function series(key) {
  const v = values(key); const pts = [];
  for (let i = 0; i < v.length; i++) if (v[i] !== null) pts.push([i, v[i]]);
  return loess(pts);
}
function chart(title, keys) {
  const all = keys.map(k => series(k)).flat();
  let lo = Infinity, hi = -Infinity;
  for (const p of all) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
  const pad = (hi - lo) * 0.10 || 0.1; lo -= pad; hi += pad;
  const yOf = (v) => Tp + (1 - (v - lo) / (hi - lo)) * (Hh - Tp - Bp);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, y = yOf(v);
    g += '<line x1="' + Lp + '" x2="' + (W - Rp) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#263043"/>' +
         '<text x="' + (Lp - 9) + '" y="' + (y + 4).toFixed(1) + '" fill="#9fb0cc" font-size="11" text-anchor="end">' + v.toFixed(3) + '</text>';
  }
  let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="img"><rect width="' + W + '" height="' + Hh + '" fill="#111827"/>' + g;
  if (lo < 0 && hi > 0) { const zy = yOf(0); s += '<line x1="' + Lp + '" x2="' + (W - Rp) + '" y1="' + zy.toFixed(1) + '" y2="' + zy.toFixed(1) + '" stroke="#64748b" stroke-dasharray="2 4"/>'; }
  for (let k = 0; k <= 4; k++) {
    const i = Math.round(k * (N - 1) / 4), x = xAt(i), y = Hh - Bp + 15;
    s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (Hh - Bp) + '" y2="' + (Hh - Bp + 4) + '" stroke="#64748b"/>' +
         '<text x="' + x.toFixed(1) + '" y="' + y + '" fill="#9fb0cc" font-size="11" text-anchor="middle">#' + i + '</text>';
  }
  s += '<text x="' + (Lp + (W - Lp - Rp) / 2) + '" y="' + (Hh - 6) + '" fill="#9fb0cc" font-size="11" text-anchor="middle">点序（每点一枚，按 ts 排序；LOWESS span=0.08，x 用点号，不用时间轴）</text>';
  keys.forEach((key, ki) => {
    const pts = series(key);
    const dash = ki === 1 ? ' stroke-dasharray="9 6"' : '';
    s += '<polyline fill="none" stroke="' + COL[key] + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"' + dash + ' points="' + pts.map(p => xAt(p[0]).toFixed(1) + ',' + yOf(p[1]).toFixed(1)).join(' ') + '"/>';
  });
  keys.forEach((key, ki) => {
    const x = W - 330 + ki * 150, y = 24;
    s += '<line x1="' + x + '" x2="' + (x + 28) + '" y1="' + y + '" y2="' + y + '" stroke="' + COL[key] + '" stroke-width="3"' + (ki === 1 ? ' stroke-dasharray="9 6"' : '') + '/>';
    s += '<text x="' + (x + 36) + '" y="' + (y + 4) + '" fill="#dce6f5" font-size="12">' + key + (ki === 0 ? '（短·实线）' : '（长·虚线）') + '</text>';
  });
  return s + '</svg>';
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function summary(keys) {
  const out = [];
  for (const key of keys) {
    const v = values(key); const pairs = [];
    for (let i = 0; i < v.length; i++) if (v[i] !== null) pairs.push([i, v[i]]);
    if (pairs.length < 10) continue;
    const q = Math.max(3, Math.floor(pairs.length / 4));
    const early = pairs.slice(0, q).reduce((a, b) => a + b[1], 0) / q;
    const late = pairs.slice(-q).reduce((a, b) => a + b[1], 0) / q;
    const mx = pairs.reduce((a, b) => a + b[0], 0) / pairs.length, my = pairs.reduce((a, b) => a + b[1], 0) / pairs.length;
    let num = 0, den = 0; for (const [x, y] of pairs) { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); }
    const slope = den ? num / den * 100 : 0;
    out.push('<tr><td>' + key + '</td><td>' + early.toFixed(4) + '</td><td>' + late.toFixed(4) + '</td><td>' + (late - early >= 0 ? '+' : '') + (late - early).toFixed(4) + '</td><td>' + (slope >= 0 ? '+' : '') + slope.toFixed(4) + '</td></tr>');
  }
  return out.join('');
}
const html = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Epirus 考卷 A/B/C 趋势</title>' +
'<style>body{margin:0;background:#0f1522;color:#dce6f5;font:13px system-ui,"Microsoft YaHei",sans-serif}main{max-width:1280px;margin:0 auto;padding:18px 20px 40px}h1{font-size:20px;margin:0 0 6px}a{color:#9fc3ff;text-decoration:none}.sub{color:#9fb0cc;line-height:1.7;margin-bottom:14px}.card{background:#131a29;border:1px solid #33415c;border-radius:8px;padding:10px 12px;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #2a3446;padding:5px 8px;text-align:right}th:first-child,td:first-child{text-align:left}th{color:#9fb0cc;font-weight:500}.note{color:#9fb0cc;font-size:12px;line-height:1.6}</style></head><body><main>' +
'<h1>Epirus 考卷 A/B/C 趋势</h1><div class="sub">LOWESS span=0.08（局部线性 + 2 次稳健迭代）· x = 点序（每点一枚，按 ts 排序）· 数据 data/display.tsv（926 枚）· <a href="index.html">← 返回冠军查看器</a></div>' +
'<div class="note">A = v2 脚本桌 page dose（P5/P5L）‖ B = F2 固定夹具（P5R/P5RL）‖ C = (A+B)/2。H5 是冻结旧参考，不在此图。x 不按时间留空，训练空档不会被拉平。</div>' +
'<div class="card"><h2>A 轴 · 脚本桌</h2>' + chart('A：P5（短）/ P5L（长）', ['P5','P5L']) + '</div>' +
'<div class="card"><h2>B 轴 · F2 固定夹具</h2>' + chart('B：P5R（短）/ P5RL（长）', ['P5R','P5RL']) + '</div>' +
'<div class="card"><h2>C 轴 · 综合</h2>' + chart('C：C5R（短）/ C5RL（长）', ['C5R','C5RL']) + '</div>' +
'<div class="card"><h2>首尾 25% 与斜率（每 100 点）</h2><table><thead><tr><th>列</th><th>early</th><th>late</th><th>Δ</th><th>slope/100</th></tr></thead><tbody>' + summary(SER) + '</tbody></table></div>' +
'<div class="note">实线 = 短程，虚线 = 长程；曲线 = LOWESS span 0.08，保留局部起伏但不画原始噪声。V111 应仍在 B 轴底部。</div>' +
'</main></body></html>';
writeFileSync(join(ROOT, 'champion-map', 'trends.html'), html, 'utf8');
console.log('已写 champion-map/trends.html：' + (html.length / 1024).toFixed(1) + ' KB');
