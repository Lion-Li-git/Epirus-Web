/* duel-stats.mjs —— 把 champion-map/duel-e336-s*.tsv 三批配对差合流，算"尺与实战的秩相关"。
 *
 * 为什么单独成工具（§E334 那 12 枚的教训）：12 枚全挤在 F 名次 8~42 的**窄带**里，
 *   窄带内 rho≈0.05 只能证明"F 在头部band里没分辨力"，**不能**证明 F 全局无效 ——
 *   要么承认范围受限，要么把范围铺开。这次铺开了（rank 7 → 901），所以要一把能同时报
 *   两个范围的尺，而不是让人拿窄带的那个数去否证全局。
 * 判据：
 *   ① 只合流**同一枚候选在两批里都有**的行（缺一批就标 n 批，不许偷偷算均值）；
 *   ② 合并用**逆方差加权**（每行自带 approxSE），符号翻没翻单独判 —— §E334 里 v7ws2-91 就是"三批两正一负"那种；
 *   ③ |pooled| > 1.96·SE 才许写 WIN/LOSE，其余一律 within-noise（不许把"均值>0"说成"赢了"）；
 *   ④ 秩相关必须**同一段范围**报两遍（窄带 / 全程），并给出 n。
 * 用法：node champion-map/duel-stats.mjs [--glob=duel-e336-s*.tsv] [--band=8,42]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const GLOB = arg('glob', 'duel-e336-s*.tsv');

const files = readdirSync(HERE).filter(f => {
  const re = new RegExp('^' + GLOB.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
  return re.test(f);
}).sort();
if (!files.length) { console.error('⛔ ' + GLOB + ' 在 ' + HERE + ' 一份都没找到 ⇒ 这不是"没有赢家"，是没跑。'); process.exit(2); }

/* coords.tsv：F 名次与三把尺的读数都从这张表拿（路径列保证量的是同一个包，§E330 的洞） */
const CT = rd(join(HERE, 'coords.tsv')).trim().split('\n'), ch = CT[0].split('\t');
const iId = ch.indexOf('id'), iF = ch.indexOf('F'), iR = ch.indexOf('rank'), iHp = ch.indexOf('Hp'),
      iH = ch.indexOf('H'), iS = ch.indexOf('S'), iW = ch.indexOf('dupOf');
if (iR < 0 || iHp < 0 || iS < 0) { console.error('⛔ coords.tsv 缺 rank/Hp/S 列 ⇒ 先补齐管线（attach-hp / attach-dup）'); process.exit(2); }
const M = {};
CT.slice(1).forEach(l => { const c = l.split('\t'); if (!M[c[iId]]) M[c[iId]] = { id: c[iId], F: +c[iF], rk: +c[iR], Hp: +c[iHp], H: +c[iH], S: +c[iS], dup: c[iW] || '' }; });

const R = {};
for (const f of files) {
  const B = rd(join(HERE, f)).trim().split('\n'), h = B[0].split('\t');
  const ia = h.indexOf('a'), iS2 = h.indexOf('secs'), id = h.indexOf('diff_pt'), is = h.indexOf('approxSE');
  if (ia < 0 || id < 0 || is < 0) { console.error('⛔ ' + f + ' 表头缺 a/diff_pt/approxSE ⇒ 这份不是 duel-run 的产物'); process.exit(2); }
  const seed = (/s(\d+)/.exec(f) || [, '?'])[1];
  B.slice(1).forEach(l => { const c = l.split('\t');
    const d = +c[id], se = +c[is];
    if (!isFinite(d) || !(se > 0)) { console.error('⛔ ' + f + ' 里 ' + c[ia] + ' 的 diff/SE 不是数（' + c[id] + '/' + c[is] + '）'); process.exit(2); }
    (R[c[ia]] = R[c[ia]] || {})[seed] = { d: d, se: se, file: f }; });
}

/* 逆方差加权合并 */
const rows = [];
for (const id of Object.keys(R)) {
  if (id === 'SHIPPED-Ldemo') continue;
  const m = M[id];
  if (!m) { console.log('  ⚠ ' + id + ' 不在 coords.tsv 里 ⇒ 跳过（不许拿无名读数参与相关）'); continue; }
  const ks = Object.keys(R[id]), ds = ks.map(k => R[id][k]);
  const wsum = ds.reduce((a, b) => a + 1 / (b.se * b.se), 0);
  const pooled = ds.reduce((a, b) => a + b.d / (b.se * b.se), 0) / wsum;
  const pse = 1 / Math.sqrt(wsum);
  rows.push({ id: id, n: ds.length, nMax: files.length, rk: m.rk, F: m.F, Hp: m.Hp, H: m.H, S: m.S,
    diffs: ds.map(x => x.d).join('/'), pooled: pooled, pse: pse,
    verdict: Math.abs(pooled) > 1.96 * pse ? (pooled > 0 ? 'WIN' : 'LOSE') : 'within-noise',
    allSame: ds.every(x => x.d > 0) || ds.every(x => x.d < 0) });
}
rows.sort((a, b) => b.pooled - a.pooled);

console.log('合流 ' + files.length + ' 批（' + files.join(' ‖ ') + '）· 候选 ' + rows.length + ' 枚\n');
console.log('id                 F-rk   Hp     S     逐批差               合并(pt)      判');
for (const r of rows) {
  console.log(r.id.padEnd(19) + String(r.rk).padStart(4) + ' ' + String(r.Hp.toFixed(1)).padStart(5) + ' ' +
    String(r.S.toFixed(2)).padStart(6) + '  ' + r.diffs.padEnd(21) +
    ' ' + (r.pooled >= 0 ? '+' : '') + r.pooled.toFixed(1) + '±' + r.pse.toFixed(1) +
    '  ' + r.verdict + (r.n < r.nMax ? '（只 ' + r.n + '/' + r.nMax + ' 批）' : (r.allSame && r.n > 1 ? ' 逐批同向' : '')));
}

/* 秩相关：干净的一次性实现（值 → 平均秩） */
function rank(v) {
  const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
  const out = new Array(v.length);
  for (let p = 0; p < idx.length;) {
    let q = p; while (q + 1 < idx.length && v[idx[q + 1]] === v[idx[p]]) q++;
    const r = (p + q) / 2 + 1;                       /* 并列取平均秩 */
    for (let k = p; k <= q; k++) out[idx[k]] = r;
    p = q + 1;
  }
  return out;
}
function spear(a, b) {
  const n = a.length; if (n < 3) return NaN;
  const X = rank(a), Y = rank(b), mx = X.reduce((s, x) => s + x) / n, my = Y.reduce((s, x) => s + x) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sx += (X[i] - mx) ** 2; sy += (Y[i] - my) ** 2; }
  return sx && sy ? sxy / Math.sqrt(sx * sy) : NaN;
}
const all = rows.filter(r => r.n >= 2);
const bandLo = Number(arg('band', '8,42').split(',')[0]) || 8, bandHi = Number(arg('band', '8,42').split(',')[1]) || 42;
const band = all.filter(r => r.rk >= bandLo && r.rk <= bandHi);
const duel = r => r.pooled;
/* 某把尺在这枚身上**没读数**（coords.tsv 里那格空 ⇒ +'' = NaN）时，这条配对整对退出相关，
 * 并把退出数印出来 —— 让 rho 的 n 永远等于"两把尺都真量过"的枚数，否则 NaN/漏腿都会被读成"无关"。*/
function rho(set, get) {
  const keep = set.filter(r => isFinite(get(r)));
  const lost = set.length - keep.length;
  return { v: spear(keep.map(get), keep.map(duel)), n: keep.length, lost: lost };
}
console.log('\n【全程】n=' + all.length + '（F 名次 ' + Math.min.apply(null, all.map(r => r.rk)) + ' → ' + Math.max.apply(null, all.map(r => r.rk)) + '）');
[['F', r => r.F], ['Hp', r => r.Hp], ['H（考卷）', r => r.H], ['S（广度）', r => r.S], ['名次（越小越好）', r => -r.rk]].forEach(function (p) {
  const q = rho(all, p[1]);
  console.log('  rho(' + p[0] + ', 配对差) = ' + q.v.toFixed(3) + '（n=' + q.n + (q.lost ? ' ‖ ' + q.lost + ' 枚该尺无读数 ⇒ 退出' : '') + '）');
});
if (band.length >= 3) {
  console.log('\n【窄带 rank ' + bandLo + '~' + bandHi + '】n=' + band.length + ' ⇒ §E334 那句"rho≈0"就限在这一段');
  [['F', r => r.F], ['Hp', r => r.Hp], ['S', r => r.S]].forEach(function (p) {
    const q = rho(band, p[1]);
    console.log('  rho(' + p[0] + ', 配对差) = ' + q.v.toFixed(3) + '（n=' + q.n + (q.lost ? ' ‖ ' + q.lost + ' 枚退出' : '') + '）');
  });
}
const out = join(HERE, 'duel-e336-pooled.tsv');
writeFileSync(out, 'id\tF-rank\tHp\tS\tbatches\tper-batch-diffs\tpooled_pt\tSE\tverdict\tall-same-sign\n' +
  rows.map(r => [r.id, r.rk, r.Hp, r.S, r.n + '/' + r.nMax, r.diffs, r.pooled.toFixed(2), r.pse.toFixed(2), r.verdict, r.allSame ? 1 : 0].join('\t')).join('\n') + '\n');
console.log('\n已写 ' + out + '（' + rows.length + ' 行）');
