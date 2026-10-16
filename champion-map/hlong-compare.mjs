/* §E615 分析：**默认桌（multi）↔ 长程桌（long）** 的 F 差多少、序还保不保得住。
 * 读 champion-map/coords.tsv 的 `Hp`/`S`/`F`/`Hplong`/`Flong`（三列由 `attach-hlong.mjs` 挂上，缺测是 `-`）
 *   + 长程桌源表 `epsfull-long-*.tsv`（哪一枚是从哪个文件量的、档/桌形/剂量都在行里）。
 * 判据（跑前写死）：
 *   ① 覆盖率自己报数（量到 N ‖ 没量到 M）—— 这张表是**边跑边读**的，读数必须带"截至几分覆盖"。
 *   ② Spearman(F, Flong) 与 |Δrank| 分布 ⇒ 决定"换桌形看图会不会得出不同结论"。
 *   ③ **电平 vs 序**分开说：电平差可以平移（不改变谁强谁弱），序变了才是尺换了。
 *   ④ 谁跨过了"分界（最强一批均值）"那根针 ⇒ 这一类翻转是唯一会**改变决策**的读数（换带/换代）。
 * 用法：node champion-map/hlong-compare.mjs [--table=epsfull-long-2026-10-16.tsv]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const TAB = String(arg('table', 'epsfull-long-2026-10-16.tsv'));
if (!existsSync(join(HERE, TAB))) { console.error('⛔ 读不到 ' + TAB); process.exit(2); }
const rd = f => readFileSync(join(HERE, f), 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const CO = rd('coords.tsv'), ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
for (const k of ['id', 'Hp', 'S', 'F', 'Hplong', 'Flong', 'lineage']) if (ch[k] === undefined) { console.error('⛔ coords 缺列 ' + k); process.exit(2); }
const LT = rd(TAB), lh = Object.fromEntries(LT[0].map((x, i) => [x, i]));
const LONG = {}; for (const r of LT.slice(1)) if (r[lh.id] && r[lh.mode] === 'long') LONG[r[lh.id]] = { page: +r[lh.page], exam: +r[lh.exam] };
const T = 0.10;
const rows = [];
for (const r of CO.slice(1)) {
  const id = r[ch.id]; if (!id || !LONG[id]) continue;
  const hp = r[ch.Hp], s = +r[ch.S], fl = r[ch.Flong];
  if (hp === '' || hp === '-' || !isFinite(+hp) || fl === '-' || !isFinite(+fl)) continue;
  rows.push({ id, lin: r[ch.lineage] || '', F: +r[ch.F], fl: +fl, dHp: LONG[id].page - +hp, dF: +fl - +r[ch.F] });
}
console.log('① 覆盖：coords ' + (CO.length - 1) + ' 枚 ‖ 长程桌有读数 ' + Object.keys(LONG).length + ' 枚 ‖ 两桌齐可配对 ' + rows.length + ' 枚');
if (rows.length < 30) { console.log('⛔ 可配对不足 30 枚 ⇒ 这张表还太薄，下面的结论不许引用'); process.exit(7); }
function spearman(a, b) {
  const rk = x => { const s2 = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(x.length);
    for (let i = 0; i < s2.length;) { let j = i; while (j + 1 < s2.length && s2[j + 1][0] === s2[i][0]) j++; const av = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[s2[k][1]] = av; i = j + 1; } return r; };
  const ra = rk(a), rb = rk(b), n = a.length, ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}
const rank = (arr, v) => arr.filter(x => x > v).length + 1;
const Fs = rows.map(x => x.F).sort((a, b) => b - a), Ls = rows.map(x => x.fl).sort((a, b) => b - a);
const dh = rows.map(x => x.dHp).sort((a, b) => a - b), df = rows.map(x => x.dF).sort((a, b) => a - b);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
console.log('② 电平：ΔHp 均值 ' + mean(dh).toFixed(2) + 'pt（σ ' + sd(dh).toFixed(2) + ' ‖ 极差 ' + dh[0].toFixed(1) + '~' + dh[dh.length - 1].toFixed(1) + ' ‖ t=' + (mean(dh) / (sd(dh) / Math.sqrt(dh.length))).toFixed(2) + '）');
console.log('        ΔF  均值 ' + mean(df).toFixed(3) + ' ‖ 中位 ' + df[Math.floor(df.length / 2)].toFixed(3) + '（F 与 Hp 同向，因为 Flong 只换了 Hp 那一半）');
console.log('③ 序：Spearman(F, Flong) = ' + spearman(rows.map(x => x.F), rows.map(x => x.fl)).toFixed(3)
  + ' ‖ |Δrank| 中位 ' + (function () { const d = rows.map(x => Math.abs(rank(Fs, x.F) - rank(Ls, x.fl))).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })()
  + ' ‖ 最大 ' + Math.max.apply(null, rows.map(x => Math.abs(rank(Fs, x.F) - rank(Ls, x.fl)))) + ' / ' + rows.length + ' 枚');
const top = rows.slice().sort((a, b) => b.fl - a.fl).slice(0, 8);
console.log('   长程桌上最高的 8 枚：' + top.map(x => x.id + ' ' + x.fl.toFixed(1) + '（默认桌 ' + x.F.toFixed(1) + '）').join(' ‖ '));
const big = rows.filter(x => Math.abs(rank(Fs, x.F) - rank(Ls, x.fl)) >= Math.max(20, rows.length * 0.06));
console.log('   名次移动 ≥ ' + Math.max(20, Math.round(rows.length * 0.06)) + ' 位的 ' + big.length + ' 枚：' + big.slice(0, 10).map(x => x.id + '(' + rank(Fs, x.F) + '→' + rank(Ls, x.fl) + ')').join(' ‖ '));
const champ = rows.filter(x => x.lin === '历代上槽' || /上槽/.test(x.lin));
if (champ.length) console.log('④ 历代上槽那批（会真被玩家拿到的）里 ΔHp 最大的 5 枚：'
  + champ.slice().sort((a, b) => b.dHp - a.dHp).slice(0, 5).map(x => x.id + ' ' + (x.dHp >= 0 ? '+' : '') + x.dHp.toFixed(1) + 'pt').join(' ‖ ')
  + ' ‖ 最小的 5 枚：' + champ.slice().sort((a, b) => a.dHp - b.dHp).slice(0, 5).map(x => x.id + ' ' + x.dHp.toFixed(1) + 'pt').join(' ‖ '));
