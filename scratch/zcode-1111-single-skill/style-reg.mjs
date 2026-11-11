/* 风格倾向回归：候选尺的包分数 ~ 行为特征（标准化 OLS + ridge 1e-6）
 * R² 越高 = 尺越"挑风格"（F2 的 P5R 在 v7 子集上是 0.42 —— DS FINDING §3.5 同法）
 * 用法：node style-reg.mjs <tsv文件> <列名=分数>（分数列取 all/multi+all/long 均值） */
import { readFileSync } from 'node:fs';
const [tsv, col] = process.argv.slice(2);
const rows = readFileSync(tsv, 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
const H = rows[0];
const pick = col || 'all';
const byId = {};
for (const r of rows.slice(1)) {
  const id = r[0], table = r[H.indexOf('table')], mode = r[H.indexOf('mode')], rate = +r[H.indexOf('first')] / +r[H.indexOf('games')];
  if (table !== pick) continue;
  (byId[id] = byId[id] || []).push(rate);
}
const DROP = (process.env.DROP_FEATS || '').split(',').filter(Boolean);
const feats = ['S', 'Geff', 'dmg', 'heavy', 'holo', 'rounds', 'zeroRate', 'drawRate', 'seatSpread', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg'].filter((f) => !DROP.includes(f));
const CV = readFileSync('champion-map/data/build/coords-view.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
const CH = CV[0], CI = Object.fromEntries(CH.map((x, i) => [x, i]));
const sample = [];
for (const [id, rates] of Object.entries(byId)) {
  const r = CV.slice(1).find((r) => r[0] === id);
  if (!r) { console.error('特征缺 ' + id); continue; }
  const y = rates.reduce((a, b) => a + b, 0) / rates.length;
  const x = feats.map((f) => { const v = +r[CI[f]]; return Number.isFinite(v) ? v : 0; });
  sample.push({ id, y, x });
}
if (sample.length < 10) { console.error('样本不足：' + sample.length); process.exit(2); }
const n = sample.length, m = feats.length;
const ybar = sample.reduce((s, o) => s + o.y, 0) / n;
const sst = sample.reduce((s, o) => s + (o.y - ybar) ** 2, 0);
for (let j = 0; j < m; j++) {
  const c = sample.map((o) => o.x[j]);
  const mu = c.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(c.reduce((s, v) => s + (v - mu) ** 2, 0) / n) || 1;
  for (const o of sample) o.x[j] = (o.x[j] - mu) / sd;
}
/* 正规方程 (X'X + λI)β = X'y；X = [1 | zfeat] */
const A = Array.from({ length: m + 1 }, () => new Array(m + 1).fill(0));
const b = new Array(m + 1).fill(0);
for (const o of sample) {
  const xr = [1, ...o.x];
  for (let i = 0; i <= m; i++) { b[i] += xr[i] * (o.y - ybar); for (let j = 0; j <= m; j++) A[i][j] += xr[i] * xr[j]; }
}
for (let i = 0; i <= m; i++) A[i][i] += 1e-6;
for (let i = 0; i <= m; i++) {
  let p = i;
  for (let k = i + 1; k <= m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
  [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
  for (let k = i + 1; k <= m; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j <= m; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; }
}
const beta = new Array(m + 1).fill(0);
for (let i = m; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j <= m; j++) s -= A[i][j] * beta[j]; beta[i] = s / A[i][i]; }
let ssr = 0;
for (const o of sample) { const xr = [1, ...o.x]; let yh = ybar; for (let i = 0; i <= m; i++) yh += xr[i] * beta[i]; ssr += (o.y - yh) ** 2; }
const r2 = 1 - ssr / sst;
const rank = feats.map((f, j) => [f, beta[j + 1]]).sort((a, b2) => Math.abs(b2[1]) - Math.abs(a[1])).slice(0, 5);
console.log(`${tsv.split('/').pop()} [${pick}]  n=${n}  R²=${r2.toFixed(3)}`);
console.log('  重系数: ' + rank.map(([f, w]) => `${f} ${w >= 0 ? '+' : ''}${w.toFixed(2)}`).join(' · '));
