/* bon-paired.mjs — boN vs 棘轮 配对汇总（DS · 10-30）
 * 读 scratch/CLIS-{BONS,RATS}-s*.json，按种子配对；每包取「最佳温度下的 CLI 干净胜」。
 * 输出：逐粒表、配对 t 检验（双侧 p，Student-t 数值积分）、分布统计、单卡计数。 */
import { readFileSync, readdirSync } from 'node:fs';
const DIR = 'D:/code/Epirus-Web/scratch';
function best(f) {
  const j = JSON.parse(readFileSync(DIR + '/' + f, 'utf8'));
  const rows = j.rows.filter((r) => !/参照/.test(r.tag));
  const v7 = j.rows.filter((r) => /参照/.test(r.tag)).sort((a, b) => b.cleanScore - a.cleanScore)[0];
  const b = rows.sort((a, b) => b.cleanScore - a.cleanScore)[0];
  return { clean: b.cleanScore, tag: b.tag, first: b.first, key: b.maxCard.key, share: b.maxCard.share, v7: v7 ? v7.cleanScore : NaN };
}
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}
function twoSidedP(t, v) { return betai(v / 2, 0.5, v / (v + t * t)); }
const seeds = [];
for (const f of readdirSync(DIR)) { const m = /^CLIS-BONS-s(\d+)\.json$/.exec(f); if (m) seeds.push(Number(m[1])); }
seeds.sort((a, b) => a - b);
const rows = [];
for (const s of seeds) {
  try { rows.push({ s, A: best('CLIS-BONS-s' + s + '.json'), B: best('CLIS-RATS-s' + s + '.json') }); } catch (e) { /* 缺一侧 */ }
}
console.log('seed | boN | rat | d | boN key/share | rat key/share');
for (const r of rows) console.log(r.s + ' | ' + r.A.clean.toFixed(3) + ' | ' + r.B.clean.toFixed(3) + ' | ' + (r.A.clean - r.B.clean >= 0 ? '+' : '') + (r.A.clean - r.B.clean).toFixed(3) + ' | ' + r.A.key + ' ' + (100 * r.A.share).toFixed(0) + '% | ' + r.B.key + ' ' + (100 * r.B.share).toFixed(0) + '%');
const d = rows.map((r) => r.A.clean - r.B.clean);
const mean = (x) => x.reduce((p, q) => p + q, 0) / x.length;
const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / (x.length - 1)); };
const md = mean(d), s = sd(d), se = s / Math.sqrt(d.length), t = md / se, pv = twoSidedP(t, d.length - 1);
const bn = rows.map((r) => r.A.clean).sort((x, y) => x - y), rn = rows.map((r) => r.B.clean).sort((x, y) => x - y);
const q = (x, f) => x[Math.floor(f * (x.length - 1))];
console.log('');
console.log('n=' + rows.length + ' | boN 赢 ' + rows.filter((r) => r.A.clean > r.B.clean).length + '/' + rows.length);
console.log('paired: mean=' + md.toFixed(4) + ' sd=' + s.toFixed(4) + ' se=' + se.toFixed(4) + ' t=' + t.toFixed(2) + ' df=' + (d.length - 1) + ' p=' + pv.toFixed(4));
console.log('boN min/q25/med/q75/max = ' + q(bn, 0).toFixed(3) + ' / ' + q(bn, 0.25).toFixed(3) + ' / ' + q(bn, 0.5).toFixed(3) + ' / ' + q(bn, 0.75).toFixed(3) + ' / ' + q(bn, 1).toFixed(3));
console.log('rat min/q25/med/q75/max = ' + q(rn, 0).toFixed(3) + ' / ' + q(rn, 0.25).toFixed(3) + ' / ' + q(rn, 0.5).toFixed(3) + ' / ' + q(rn, 0.75).toFixed(3) + ' / ' + q(rn, 1).toFixed(3));
console.log('>=0.10: boN ' + rows.filter((r) => r.A.clean >= 0.10).length + '/' + rows.length + ' | rat ' + rows.filter((r) => r.B.clean >= 0.10).length + '/' + rows.length);
console.log('单卡>=60%: boN ' + rows.filter((r) => r.A.share >= 0.60).length + '/' + rows.length + ' | rat ' + rows.filter((r) => r.B.share >= 0.60).length + '/' + rows.length);
console.log('v7 同场 clean = ' + rows[0].A.v7.toFixed(3));