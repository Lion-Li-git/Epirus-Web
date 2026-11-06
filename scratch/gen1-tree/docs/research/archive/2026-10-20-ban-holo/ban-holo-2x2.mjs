/* §E670 补：把消融批补成 2×2（mode × seed），并与 §E665 那批"机会式 ε 注入"的逐包原件做同档对账。
 * 主分析器 = `ban-holo-analyze.mjs`（四条闸 + 换席切法，跑单粒 seed / 单档）；本脚本只做**跨层汇总**，
 *   因为它要回答的是"那三件没覆盖的补上之后，四支的序还成不成立"。
 * 注入侧的数**不重跑**：直接读 `archive/2026-10-20-night-d15-gates/skill-marginal-pool.txt` 里逐包逐档那几行
 *   （§E665 的原件，4 颗种子 × 2 档）⇒ 对账是同档同包的，不是我另起一把尺。
 * 用法：node docs/research/archive/2026-10-20-ban-holo/ban-holo-2x2.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const PACKS = [['beadseed', 'v7beadseed-82'], ['wall', 'v7wall-33'], ['teach', 'v7teach-32'], ['expo', 'v7expo-34']];
const STRATA = [['multi', '77000'], ['multi', '77001'], ['long', '77000'], ['long', '77001']];

function rows(f, arm) {
  if (!existsSync(f)) return null;
  const t = readFileSync(f, 'utf8').replace(/\r/g, '').split('\n'), out = [];
  for (const L of t) { const q = L.split('\t'); if (q[0] === 'subject') out.push({ idx: +q[1], names: q[2], games: +q[3], first: +q[4] }); }
  out.sort((a, b) => a.idx - b.idx); return out;
}
function bootCI(d, seed, B) {
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const n = d.length; if (n < 2) return null; const o = [];
  for (let b = 0; b < B; b++) { let t = 0; for (let i = 0; i < n; i++) t += d[Math.floor(r() * n)]; o.push(t / n); }
  o.sort((a, b) => a - b); return [o[Math.floor(o.length * .025)], o[Math.floor(o.length * .975)]];
}
const f2 = (v) => (v === null || !isFinite(v)) ? '—' : ((v >= 0 ? '+' : '') + v.toFixed(2));

console.log('=== 消融 Δ（裸 − ban，负 = 拿掉送盾反而更强）四层 × 四支 ===');
const cell = {};
for (const [mode, seed] of STRATA) {
  const line = [];
  for (const [k, id] of PACKS) {
    let f1 = join(HERE, k + '-bare-' + mode + '-' + seed + '.per.txt'), f2f = join(HERE, k + '-ban-' + mode + '-' + seed + '.per.txt');
    if (!existsSync(f1)) f1 = join(HERE, k + '-bare.per.txt');           /* multi×77000 那层的原件没有后缀 */
    if (!existsSync(f2f)) f2f = join(HERE, k + '-ban.per.txt');
    const bare = rows(f1), ban = rows(f2f);
    if (!bare || !ban || bare.length !== 35 || ban.length !== 35) { line.push(k + ' 缺件'); cell[k + '@' + mode + '/' + seed] = null; continue; }
    let same = true; for (let i = 0; i < 35; i++) if (bare[i].names !== ban[i].names) same = false;
    const d = bare.map((r, i) => (r.first - ban[i].first) / 2);
    const m = d.reduce((a, b) => a + b, 0) / d.length, ci = bootCI(d, 20261020, 4000);
    cell[k + '@' + mode + '/' + seed] = { m, lo: ci[0], hi: ci[1], same };
    line.push(k + ' ' + f2(m) + (ci[1] < 0 ? '⁻' : ci[0] > 0 ? '⁺' : '') + (same ? '' : '⛔装配不同'));
  }
  console.log('  ' + (mode + ' × seed ' + seed).padEnd(20) + line.join(' ‖ '));
}
console.log('  （⁻ = 95% CI 全负 ‖ ⁺ = 全正 ‖ 无标记 = 跨 0）');

console.log('\n=== 四支的量级序：消融 vs §E665 的机会式 ε 注入（同包同档，注入侧读原件不重跑）===');
const INJ = { /* 来自 skill-marginal-pool.txt 的逐包中位（4 颗种子） */
  'beadseed@multi': -8.0, 'wall@multi': -6.5, 'teach@multi': 0.0, 'expo@multi': -0.5,
  'beadseed@long': -6.5, 'wall@long': -2.5, 'teach@long': -0.5, 'expo@long': -1.0 };
function rank(vals) { const ix = vals.map((v, i) => [Math.abs(v), i]).sort((a, b) => b[0] - a[0]); const r = []; ix.forEach((p, i) => { r[p[1]] = i + 1; }); return r; }
for (const mode of ['multi', 'long']) {
  const ks = PACKS.map(p => p[0]);
  const ab = ks.map(k => { const cs = STRATA.filter(s => s[0] === mode).map(s => cell[k + '@' + s.join('/')]).filter(Boolean);
    return cs.length ? cs.reduce((a, b) => a + b.m, 0) / cs.length : NaN; });
  const ij = ks.map(k => INJ[k + '@' + mode]);
  const ra = rank(ab), ri = rank(ij);
  const n = ks.length, sd2 = ra.reduce((a, b, i) => a + (b - ri[i]) * (b - ri[i]), 0);
  const rho = 1 - 6 * sd2 / (n * (n * n - 1));
  console.log('  @' + mode);
  ks.forEach((k, i) => console.log('    ' + k.padEnd(9) + ' 消融（两粒 seed 均值） ' + f2(ab[i]).padStart(7) + ' ‖ 注入中位（4 颗 seed 原件） ' + f2(ij[i]).padStart(6) +
    '   序：消融第 ' + ra[i] + ' ‖ 注入第 ' + ri[i]));
  console.log('    ⇒ 量级序的 Spearman ρ = ' + rho.toFixed(2) + '（n=4 ⇒ **只当形状看，不当检验**）');
}
console.log('\n读法：两把尺问的不是同一件事（"多给一次出盾机会" vs "整张卡从可选集拿掉"）；');
console.log('     若 ρ 接近 −1，说明**按支排序都会反过来** ⇒ "送盾值多少分"必须带 尺 + 切法 + 装配头 才能引用。');
