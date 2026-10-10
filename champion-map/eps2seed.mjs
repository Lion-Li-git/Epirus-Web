#!/usr/bin/env node
/* §E571 两 seed 的**部署口径**表（ε=0.2 soft）与考卷口径同档重测的最小改动面。
 *
 * 为什么现在要动它（这是 v1.6.55 换档留下的债，不是我新开的题）：
 *   查看器读两张表 —— `coords.tsv` 的 `H/Hp/De`（v1.6.55 已整体换到 **exam=120 局/组合**）
 *   与 `epsagg.tsv` 的 `exam/page/de`（由 `eps-scan.mjs:53` **硬编码 30 局** × 两 eval seed 产出）。
 *   ⇒ 全图已经换档、这张"脆弱性"表还在旧档：卡片与 `de` 着色会把 30 档的数与 120 档的数并排画。
 *   这正是 §E566「档跟着行走」与 METHODOLOGY 129 立规矩要拦的那件事。
 *
 * 为什么不直接改 `eps-scan.mjs`：它是 `execFileSync` **串行**三循环，120 档单枚 ≈ 20 秒
 *   ⇒ 121 枚 × 2 seed × 2 口径 ≈ 2.7 小时。`eps-full.mjs` 已经是并发的、且已经会写 `examG`（v1.6.55），
 *   所以这里**只补第二粒 seed 的那一批**（第一粒 77000 早在 `epsfull120-2026-10-10.tsv` 里），
 *   再在本工具里把两批**按 id 配对平均**成 epsagg 的形状。一台仪器只重跑缺的那一半。
 *
 * 判据（跑前写死）：
 *   (a) 两批必须**同档**（`examG` 逐行相等）且同 seed 之外的参数一字不动（`--games=120` 是唯一差别）。
 *   (b) 交集枚数 ≥ 旧 epsagg 的 121 − 8（.bak 掉盘的允许少量缺，缺名必须逐枚列出来，不许静默少）。
 *   (c) `de` = mean(考卷) − mean(页面) 与旧表的**同枚差**要报分布 —— 这是"换档改了脆弱性判读吗"的直接答案。
 *
 * 用法：node champion-map/eps2seed.mjs --phase=roster     # 从旧 epsagg 取名单，写 extra 表
 *        node champion-map/eps2seed.mjs --phase=agg [--a=epsfull120-2026-10-10.tsv] [--b=eps2s88000-120-2026-10-10.tsv]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const PHASE = arg('phase', '');
const rd = (p) => { const L = readFileSync(join(HERE, p), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map((l) => l.split('\t')) }; };

if (PHASE === 'roster') {
  const old = rd('epsagg.tsv');
  const ids = old.rows.map((r) => r[old.h.id]).filter(Boolean);
  const lines = ['arm\tproductRel\tlineage'];
  let miss = 0;
  for (const id of ids) {
    const rel = id === 'SHIPPED-Ldemo' ? 'docs/artifacts/SHIPPED-Ldemo.bak' : 'docs/artifacts/' + id + '.bak';
    /* 现役那枚盘上本来没有 .bak（§E308 ③），eps-full 会在名单含它时现造 ⇒ 这里不能按 existsSync 砍它 */
    if (id !== 'SHIPPED-Ldemo' && !existsSync(join(HERE, '..', rel))) { miss++; console.log('  ⛔ 盘上查无 ' + rel + ' ⇒ 该枚不进名单'); continue; }
    lines.push(id + '\t' + rel + '\teps2seed');
  }
  writeFileSync(join(HERE, 'eps2seed-extra.tsv'), lines.join('\n') + '\n', 'utf8');
  console.log('名单 ' + (lines.length - 1) + ' 枚（旧 epsagg ' + ids.length + ' 枚 ‖ 掉盘砍掉 ' + miss + ' 枚）→ champion-map/eps2seed-extra.tsv');
  console.log('下一步：node champion-map/eps-full.mjs --games=120 --seed=88000 --jobs=8 --extra=eps2seed-extra.tsv --onlyExtra --out=eps2s88000-120-2026-10-10.tsv');
} else if (PHASE === 'agg') {
  const A = rd(arg('a', 'epsfull120-2026-10-10.tsv')), B = rd(arg('b', 'eps2s88000-120-2026-10-10.tsv'));
  const pick = (T) => { const m = {}; for (const r of T.rows) { const g = +r[T.h.examG];
      if (!isFinite(g) || g !== 120) continue; m[r[T.h.id]] = { e: +r[T.h.exam], p: +r[T.h.page], g }; } return m; };
  const a = pick(A), b = pick(B);
  const gearsA = [...new Set(Object.values(a).map((x) => x.g))], gearsB = [...new Set(Object.values(b).map((x) => x.g))];
  console.log('判据(a) 同档：A=' + gearsA.join(',') + ' ‖ B=' + gearsB.join(',') +
    (gearsA.length === 1 && gearsB.length === 1 && gearsA[0] === gearsB[0] ? ' ✅ 两批都只有 120 档' : ' ⛔ 档不齐 ⇒ 不许平均'));
  if (!(gearsA.length === 1 && gearsB.length === 1 && gearsA[0] === gearsB[0])) process.exit(2);
  const ids = Object.keys(a).filter((k) => k in b);
  const onlyA = Object.keys(a).filter((k) => !(k in b));
  console.log('配对 ' + ids.length + ' 枚（A 有 B 无 ' + onlyA.length + '：' + onlyA.slice(0, 12).join(' ‖ ') + '）');
  /* 判据(c) 要与**旧档那张表**比，而旧表默认不入库（用户裁定：不留准确度差的那一份当历史对照）
   *   ⇒ 只有显式 `--old=<路径>` 才比；不指就跳过并说出来。绝不跟本表自己比 —— 自己比自己恒为 0，是假读数。 */
  const oldP = arg('old', ''), OM = {};
  if (oldP) { if (!existsSync(oldP)) { console.log('⛔ --old= 指不到：' + oldP); process.exit(2); }
    const L = readFileSync(oldP, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
    const oh = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
    for (const r of L.slice(1).map((l) => l.split('\t'))) OM[r[oh.id]] = { e: +r[oh.exam], p: +r[oh.page], d: +r[oh.de] };
    console.log('判据(c) 的旧表 = ' + oldP + '（' + Object.keys(OM).length + ' 枚）'); }
  else console.log('判据(c) 跳过：没给 --old=<旧 epsagg> ⇒ 不与本表自己比');
  const out = [['id', 'exam', 'page', 'de', 'nseed', 'examG']];
  const diffs = [];
  for (const k of ids.sort()) {
    const e = (a[k].e + b[k].e) / 2, p = (a[k].p + b[k].p) / 2;
    out.push([k, e.toFixed(2), p.toFixed(2), (e - p).toFixed(2), 2, 120].join('\t'));
    if (OM[k]) diffs.push({ k, d: (e - p) - OM[k].d, old: OM[k].d, neu: e - p });
  }
  writeFileSync(join(HERE, 'epsagg.tsv'), [out[0].join('\t')].concat(out.slice(1)).join('\n') + '\n', 'utf8');
  const ds = diffs.map((x) => Math.abs(x.d)).sort((x, y) => x - y);
  console.log('\n已写 champion-map/epsagg.tsv（' + (out.length - 1) + ' 枚 × 两 seed 均值 · 全部 120 档）');
  console.log('判据(b) 枚数：新 ' + (out.length - 1) + (Object.keys(OM).length ?
    ' ‖ 旧 epsagg ' + Object.keys(OM).length + ' ⇒ ' +
    ((out.length - 1) >= Object.keys(OM).length - 8 ? '够（允许掉盘 ≤8）' : '**不够，别换表**') : '（无旧表可比）'));
  if (ds.length) {
    console.log('判据(c) 与旧表的 Δε 之差（同枚 n=' + ds.length + '）：|Δ| 中位 ' + ds[Math.floor(ds.length / 2)].toFixed(2) +
      ' ‖ p90 ' + ds[Math.floor(ds.length * 0.9)].toFixed(2) + ' ‖ 最大 ' + ds[ds.length - 1].toFixed(2) + 'pt');
    const worse = diffs.filter((x) => (x.old >= 3.41) !== (x.neu >= 3.41));
    console.log('    跨过"脆"线（3.41pt）判读的枚数：' + worse.length + '（' + worse.slice(0, 8).map((x) => x.k + ' ' +
      x.old.toFixed(1) + '→' + x.neu.toFixed(1)).join(' ‖ ') + '）');
  }
} else {
  console.error('用法：--phase=roster ‖ --phase=agg'); process.exit(2);
}
