import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const D = join(ROOT, 'champion-map', 'data', 'display.tsv');
const L = readFileSync(D, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = L[0].split('\t');
const idx = (c) => H.indexOf(c);
const regL = readFileSync(join(ROOT, 'champion-map', 'data', 'registry.tsv'), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const rh = regL[0].split('\t'); const reg = new Map();
for (const l of regL.slice(1)) { const c = l.split('\t'); if (c[0]) reg.set(c[0], { ts: c[rh.indexOf('ts')] || '', fam: c[rh.indexOf('fam')] || '', ver: c[rh.indexOf('ver')] || '' }); }
const rows = [];
for (const l of L.slice(1)) {
  const c = l.split('\t'); if (!c[idx('id')]) continue;
  const o = {}; for (const k of ['id','ts','ver','fam','P5','P5L','P5R','P5RL','C5R','C5RL']) o[k] = c[idx(k)] || '';
  const g = reg.get(o.id) || {}; o.ts = o.ts || g.ts || ''; o.fam = o.fam || g.fam || ''; o.ver = o.ver || g.ver || '';
  const t = Date.parse(o.ts);
  o.t = Number.isFinite(t) ? t : NaN;
  rows.push(o);
}
rows.sort((a,b) => (Number.isFinite(a.t) ? a.t : 0) - (Number.isFinite(b.t) ? b.t : 0));
const t0 = rows.find(r => Number.isFinite(r.t)).t;
const t1 = [...rows].reverse().find(r => Number.isFinite(r.t)).t;
const W = 1240, Hh = 300, Lp = 58, Rp = 16, Tp = 18, Bp = 30;
const xOf = (r) => Lp + (Number.isFinite(r.t) && t1 > t0 ? (r.t - t0) / (t1 - t0) : 0) * (W - Lp - Rp);
const PAL = ['#ff6b6b','#ffa94d','#ffd43b','#a9e34b','#69db7c','#38d9a9','#3bc9db','#4dabf7','#748ffc','#9775fa','#da77f2','#f783ac','#e599f7','#ffa8a8','#ffc078','#c0eb75','#8ce99a','#66d9e8','#74c0fc','#b197fc'];
function famColor(f) { const n = parseInt(String(f), 10); return PAL[Number.isFinite(n) ? n % PAL.length : 0]; }
function vals(key) { return rows.map(r => { const v = Number(r[key]); return Number.isFinite(v) && r[key] !== '' ? v : null; }); }
function roll(key, win) {
  const v = vals(key); const out = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i] === null) continue;
    let s = 0, n = 0;
    for (let j = Math.max(0, i - win + 1); j <= i; j++) if (v[j] !== null) { s += v[j]; n++; }
    out.push({ i, x: xOf(rows[i]), y: s / n, r: rows[i] });
  }
  return out;
}
function chart(title, keys, colors) {
  const all = keys.map(k => roll(k, 30)).flat();
  let lo = Infinity, hi = -Infinity;
  for (const p of all) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
  const pad = (hi - lo) * 0.08 || 0.1; lo -= pad; hi += pad;
  const yOf = (v) => Tp + (1 - (v - lo) / (hi - lo)) * (Hh - Tp - Bp);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, y = yOf(v);
    g += '<line x1="' + Lp + '" x2="' + (W - Rp) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#2a3446"/>' +
         '<text x="' + (Lp - 8) + '" y="' + (y + 4).toFixed(1) + '" fill="#9fb0cc" font-size="11" text-anchor="end">' + v.toFixed(3) + '</text>';
  }
  let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="img"><rect width="' + W + '" height="' + Hh + '" fill="#111827"/>' + g +
    '<text x="' + Lp + '" y="16" fill="#dce6f5" font-size="14" font-weight="600">' + title + '</text>';
  if (lo < 0 && hi > 0) { const zy = yOf(0); s += '<line x1="' + Lp + '" x2="' + (W - Rp) + '" y1="' + zy.toFixed(1) + '" y2="' + zy.toFixed(1) + '" stroke="#64748b" stroke-dasharray="2 4"/>'; }
  keys.forEach((key, ki) => {
    const pts = roll(key, 30);
    const dash = ki === 1 ? ' stroke-dasharray="9 6"' : '';
    s += '<polyline fill="none" stroke="' + colors[ki] + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"' + dash + ' points="' + pts.map(p => p.x.toFixed(1) + ',' + yOf(p.y).toFixed(1)).join(' ') + '"/>';
  });
  keys.forEach((key, ki) => {
    const x = W - 330 + ki * 150, y = 22;
    s += '<line x1="' + x + '" x2="' + (x + 28) + '" y1="' + y + '" y2="' + y + '" stroke="' + colors[ki] + '" stroke-width="3"' + (ki === 1 ? ' stroke-dasharray="9 6"' : '') + '/>';
    s += '<text x="' + (x + 36) + '" y="' + (y + 4) + '" fill="#dce6f5" font-size="12">' + key + (ki === 0 ? '（短·实线）' : '（长·虚线）') + '</text>';
  });
  return s + '</svg>';
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function summary(keys) {
  const out = [];
  for (const key of keys) {
    const v = vals(key); const pairs = [];
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
'<h1>Epirus 考卷 A/B/C 趋势</h1><div class="sub">30 枚滑动平均 · 按 ts 排序 · 数据 data/display.tsv（926 枚）· <a href="index.html">← 返回冠军查看器</a></div>' +
'<div class="note">A = v2 脚本桌 page dose（P5/P5L）‖ B = F2 固定夹具（P5R/P5RL）‖ C = (A+B)/2。H5 是冻结旧参考，不在此图。家族/时代几乎共线，趋势不要当同谱系学习曲线。</div>' +
'<div class="card"><h2>A 轴 · 脚本桌</h2>' + chart('A：P5（短） / P5L（长）', ['P5','P5L'], ['#38bdf8','#fb7185']) + '</div>' +
'<div class="card"><h2>B 轴 · F2 固定夹具</h2>' + chart('B：P5R（短） / P5RL（长）', ['P5R','P5RL'], ['#fb923c','#22d3ee']) + '</div>' +
'<div class="card"><h2>C 轴 · 综合</h2>' + chart('C：C5R（短） / C5RL（长）', ['C5R','C5RL'], ['#a78bfa','#4ade80']) + '</div>' +
'<div class="card"><h2>首尾 25% 与斜率（每 100 枚）</h2><table><thead><tr><th>列</th><th>early</th><th>late</th><th>Δ</th><th>slope/100</th></tr></thead><tbody>' + summary(['P5','P5L','P5R','P5RL','C5R','C5RL']) + '</tbody></table></div>' +
'<div class="note">实线 = 短程，虚线 = 长程；已去掉家族色点，避免颜色噪声。V111 应仍在 B 轴底部。</div>' +
'</main></body></html>';
writeFileSync(join(ROOT, 'champion-map', 'trends.html'), html, 'utf8');
console.log('已写 champion-map/trends.html：' + (html.length / 1024).toFixed(1) + ' KB');
