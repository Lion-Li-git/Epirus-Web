#!/usr/bin/env node
/* §E313 读 eps.tsv：把"部署口径 vs 考卷口径"按跑前写死的三条判据判掉
 *   (a) Spearman(考卷 1st, 页面 1st) —— 换口径改不改排名
 *   (b) 线上包的 Δε 在过线组里的分位 + 历代冠军里同量级的枚数（≥2 枚才许说"冠军体质"）
 *   (c) 页面口径下 候选 − 现役 ≥ +5pt 且两个 seed 同号
 * 用法：node champion-map/epsread.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const L = readFileSync(join(HERE, 'eps.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const hd = Object.fromEntries(L[0].map((h, i) => [h, i]));
const R = L.slice(1).map((r) => ({ id: r[hd.id], seed: +r[hd.seed], eps: r[hd.eps], first: +r[hd.first] }));

/* 按 id × eps 聚合两个 seed 的均值，并留逐 seed 值（判"同号"要用） */
const M = {};
for (const r of R) { const k = r.id; (M[k] = M[k] || { exam: [], page: [] })[r.eps].push(r.first); }
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const ids = Object.keys(M).filter((k) => M[k].exam.length && M[k].page.length);
const AT = (k) => ({ exam: mean(M[k].exam), page: mean(M[k].page), e: M[k].exam, p: M[k].page });
const A = ids.map(AT);

/* 过线组 / 历代冠军名单（与 eps-scan 同源）*/
const PASS = new Set();
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) {
  const T = readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const h2 = Object.fromEntries(T[0].map((x, i) => [x, i]));
  for (const r of T.slice(1)) if (r[h2.ok] === '1') PASS.add(r[h2.id]);
}
const CO = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const CH = new Set(CO.slice(1).filter((r) => r[ch.lineage]).map((r) => r[ch.id]));

function spearman(xs, ys) {
  const rx = xs.map((v) => { const s = xs.slice().sort((a, b) => a - b); return s.indexOf(v) + 1; });
  const ry = ys.map((v) => { const s = ys.slice().sort((a, b) => a - b); return s.indexOf(v) + 1; });
  const n = xs.length, mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy || 1);
}
const ex = A.map((a) => a.exam), pg = A.map((a) => a.page);
const dAll = ids.map((k) => AT(k).exam - AT(k).page).sort((x, y) => x - y);
console.log('样本 ' + ids.length + ' 枚（过线 ' + ids.filter((k) => PASS.has(k)).length +
  ' ‖ 历代冠军 ' + ids.filter((k) => CH.has(k)).length + '）');
console.log('\n(a) Spearman(考卷 1st, 页面 1st) = ' + spearman(ex, pg).toFixed(3) +
  '   ⇒ ' + (spearman(ex, pg) >= 0.9 ? '换口径不改排名' : spearman(ex, pg) < 0.7 ? '**图上按 H 排的名次不许当"上线会更强"读**' : '中间地带：排名大体在、细节会换'));
console.log('    全量：考卷均值 ' + mean(ex).toFixed(1) + '% ‖ 页面均值 ' + mean(pg).toFixed(1) + '% ‖ 掉 ' +
  (mean(ex) - mean(pg)).toFixed(1) + 'pt   逐枚 Δε 中位 ' + dAll[Math.floor(dAll.length / 2)].toFixed(1) +
  ' ‖ 反向（页面比考卷高）的枚数 ' + dAll.filter((v) => v < 0).length);

const d = ids.map((k) => ({ k, d: AT(k).exam - AT(k).page })).sort((a, b) => a.d - b.d);
const ds = d.map((x) => x.d), q = (p) => ds[Math.max(0, Math.min(ds.length - 1, Math.floor(ds.length * p)))];
const inc = AT('SHIPPED-Ldemo');
const incD = inc.exam - inc.page;
const pctile = (ds.filter((v) => v <= incD).length / ds.length * 100);
console.log('\n(b) 线上包 Δε = ' + incD.toFixed(1) + 'pt（考卷 ' + inc.exam.toFixed(1) + ' → 页面 ' + inc.page.toFixed(1) + '）' +
  '   过线组分位：p50 ' + q(.5).toFixed(1) + ' ‖ p75 ' + q(.75).toFixed(1) + ' ‖ p90 ' + q(.9).toFixed(1) + ' ‖ p95 ' + q(.95).toFixed(1) +
  ' ‖ 最大 ' + ds[ds.length - 1].toFixed(1));
console.log('    线上包落在第 ' + pctile.toFixed(0) + ' 百分位 ⇒ ' + (pctile >= 90 ? '**判据 (b) 第一半：现役确实偏脆**' : '现役不算特别脆'));
const same = d.filter((x) => x.k !== 'SHIPPED-Ldemo' && x.d >= 0.75 * incD);
const sameCh = same.filter((x) => CH.has(x.k));
console.log('    同量级（≥0.75×）的枚数：全库 ' + same.length + ' ‖ 历代冠军 ' + sameCh.length + ' 枚 ⇒ ' +
  (sameCh.length >= 2 ? '第二半也过 ⇒ "冠军体质"可说' : '**第二半没过 ⇒ 只能说这两枚的性格，不能说冠军体质**'));
const chD = ids.filter((k) => CH.has(k)).map((k) => ({ k, d: AT(k).exam - AT(k).page, a: AT(k) })).sort((x, y) => y.d - x.d);
console.log('    历代冠军里最脆的五枚：' + chD.slice(0, 5).map((x) => x.k + ' ' + x.a.exam.toFixed(1) + '→' + x.a.page.toFixed(1) +
  ' (Δ' + x.d.toFixed(1) + ')').join('  ‖  '));

console.log('\n(c) 页面口径下 候选 − 现役 ≥ +5pt 且两个 seed 同号：');
const hits = ids.filter((k) => {
  if (k === 'SHIPPED-Ldemo') return false;
  const a = AT(k); if (a.page - inc.page < 5) return false;
  return a.p.every((v) => v > inc.page) || (a.p[0] - inc.p[0] > 0 && a.p[1] - inc.p[1] > 0);
}).map((k) => ({ k, a: AT(k) })).sort((x, y) => y.a.page - x.a.page);
for (const h of hits) console.log('   ' + h.k.padEnd(18) + ' 页面 ' + h.a.page.toFixed(1) + '%（+' + (h.a.page - inc.page).toFixed(1) +
  '） ‖ 考卷 ' + h.a.exam.toFixed(1) + '%（+' + (h.a.exam - inc.exam).toFixed(1) + '） ‖ 逐 seed 页面 ' + h.a.p.map((v) => v.toFixed(1)).join(' ‖ ') +
  '   过线=' + (PASS.has(h.k) ? '是' : '否') + ' 冠军=' + (CH.has(h.k) ? '是' : '否'));
console.log('   合计 ' + hits.length + ' 枚');
console.log('\n   现役逐 seed：考卷 ' + inc.e.map((v) => v.toFixed(1)).join(' ‖ ') + '  页面 ' + inc.p.map((v) => v.toFixed(1)).join(' ‖ '));

/* 汇成查看器要读的那张表（一页一行）。⚠ 只有两个 seed 都有页面口径才算数 ⇒ 缺的留空，图上按"没测"压暗 */
const OUT = ['id', 'exam', 'page', 'de', 'nseed'];
const lines = [OUT.join('\t')];
for (const k of ids.sort()) {
  const a = AT(k);
  if (a.p.length < 2) continue;
  lines.push([k, a.exam.toFixed(2), a.page.toFixed(2), (a.exam - a.page).toFixed(2), a.p.length].join('\t'));
}
writeFileSync(join(HERE, 'epsagg.tsv'), lines.join('\n') + '\n', 'utf8');
console.log('\n已写 champion-map/epsagg.tsv（' + (lines.length - 1) + ' 枚，两 seed 齐的才收）');
