
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => ({ id: r[h.id], P: [2,3,5,8].map(n => r[h['P' + n]] === '' ? NaN : +r[h['P' + n]]), X: [2,3,5,8].map(n => r[h['X' + n]] === '' ? NaN : +r[h['X' + n]]) }));
function w(tilt) {
  // 与 viewer.deriveW 同形：0 = 2P/3P 极，0.5 = 15/25/45/15，1 = 5P/8P 极（分段线性）
  const a = [0.35, 0.35, 0.20, 0.10], m = [0.15, 0.25, 0.45, 0.15], b = [0.05, 0.10, 0.40, 0.45];
  const k = [a, m, b];
  if (tilt <= 0.5) { const u = tilt / 0.5; return k[0].map((v, i) => v + (k[1][i] - v) * u); }
  const u = (tilt - 0.5) / 0.5; return k[1].map((v, i) => v + (k[2][i] - v) * u);
}
const score = (r, W, key) => { let s = 0, ww = 0; for (let i = 0; i < 4; i++) if (isFinite(r[key][i])) { s += W[i] * r[key][i]; ww += W[i]; } return ww ? s / ww : NaN; };
for (const tilt of [0, 0.5, 1]) {
  const W = w(tilt);
  const s = rows.map(r => ({ id: r.id, P: score(r, W, 'P'), X: score(r, W, 'X') })).filter(r => isFinite(r.P));
  s.sort((a, b) => b.P - a.P);
  console.log('tilt=' + tilt + ' 权重 ' + W.map(v => v.toFixed(2)).join('/') + '  top6(P 侧): ' + s.slice(0, 6).map(r => r.id + ' ' + r.P.toFixed(3)).join(' ‖ '));
  const qi = s.findIndex(r => r.id === 'Q-s47'), ui = s.findIndex(r => r.id === 'U-s205');
  console.log('    Q-s47 第 ' + (qi + 1) + ' ‖ U-s205 第 ' + (ui + 1));
}
