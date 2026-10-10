#!/usr/bin/env node
/* §E572 K=8 臂内 `trainFit` ↔ 验收尺配对的**量尺 + 判读**那一半（跑臂在 k8arms.mjs，判据写在那份文件头）。
 *
 * 两相：
 *   --phase=roster  把 k8bands.tsv 的 48 枚带写成 eps-full 能吃的 extra 表（id = 臂-带），并打印要跑的命令
 *   --phase=fit     读 k8bands.tsv + 量表，按**每臂单独**算 Spearman ρ 与精确置换 p，再算跨臂符号一致性，
 *                   并按跑前写死的判据 (c)(d) 给结论；两条**正对照**（常数 fit / 按考卷造的完美 fit）同场跑
 *
 * 为什么每臂单独算而不是合并：跨臂的 fit 不可比（METHODOLOGY 877 与 EXAM-FIT-MATCH §二 坑 1 ——
 *   不同配方/种子的"题"不一样，合并就是把"配方换了题"当成"训练分变了"）。
 * ⚠ n=6 时单臂 ρ 的分辨率极低（双侧 5% 的临界值是 |ρ| ≥ 0.886）⇒ 所以**主统计量是跨臂符号一致性**，
 *   单臂 ρ 只作形状参考，并同时给精确置换 p（720 种排全枚举，不靠正态近似）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const rd = (p) => { const L = readFileSync(join(HERE, p), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map((l) => l.split('\t')) }; };

if (arg('phase', '') === 'roster') {
  const B = rd('k8bands.tsv');
  const lines = ['arm\tproductRel\tlineage'];
  let miss = 0;
  for (const r of B.rows) {
    const rel = r[B.h.bandRel];
    if (!existsSync(join(ROOTDIR(), rel))) { miss++; console.log('  ⛔ 盘上查无 ' + rel); continue; }
    lines.push(r[B.h.arm] + '-b' + r[B.h.band] + '\t' + rel + '\tk8fit');
  }
  writeFileSync(join(HERE, 'k8extra.tsv'), lines.join('\n') + '\n', 'utf8');
  console.log('extra 表 ' + (lines.length - 1) + ' 枚（掉盘 ' + miss + '）→ champion-map/k8extra.tsv');
  console.log('量尺：node champion-map/eps-full.mjs --games=120 --jobs=8 --extra=k8extra.tsv --onlyExtra --out=k8fit-2026-10-10.tsv');
  process.exit(0);
}
function ROOTDIR() { return join(HERE, '..'); }

/* ===== 统计件（都在这一份文件里，判读与打印同源 —— 规矩 44）===== */
function ranks(x) { const idx = x.map((v, i) => i).sort((a, b) => x[a] - x[b]);
  const r = new Array(x.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
    const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; }
  return r; }
function pearson(a, b) { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return (da === 0 || db === 0) ? NaN : num / Math.sqrt(da * db); }
function spearman(x, y) { return pearson(ranks(x), ranks(y)); }
/* 精确置换 p：固定 x 的秩，把 y 的秩全排列（n! 种），数 |ρ| ≥ 观测值的比例。n≤6 ⇒ 720 次，便宜且无近似。
 *   ⚠ 第一版这里写的是 `!(v > obs)`（**累积分布**），于是 |ρ|=0.886 那种最极端的读数反而得 p=0.983。
 *     尾数方向写反不会抛错，只会安静地给出反向的数 ⇒ 下面加了一条 p 函数自己的正对照（完美同序必须 = 2/n!）。*/
function permP(x, y) { const n = y.length, rx = ranks(x);
  const per = (arr) => { if (arr.length <= 1) return [arr.slice()]; const out = [];
    for (let i = 0; i < arr.length; i++) { const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const q of per(rest)) out.push([arr[i]].concat(q)); } return out; };
  const obs = Math.abs(spearman(x, y)); let hit = 0, tot = 0;
  for (const q of per(y)) { tot++; const v = Math.abs(pearson(rx, ranks(q))); if (v >= obs - 1e-12) hit++; }
  return hit / tot; }

if (arg('phase', 'fit') === 'fit') {
  const B = rd('k8bands.tsv'), M = rd(arg('t', 'k8fit-2026-10-10.tsv'));
  const gear = [...new Set(M.rows.map((r) => r[M.h.examG]))];
  console.log('量表 ' + M.rows.length + ' 行 ‖ 档 = ' + gear.join(',') + '（判据(e)：必须只有一个档，且 = 120）');
  if (gear.length !== 1 || +gear[0] !== 120) { console.log('⛔ 档不对 ⇒ 不许判读'); process.exit(2); }
  const MEAS = {}; for (const r of M.rows) MEAS[r[M.h.id]] = { e: +r[M.h.exam], p: +r[M.h.page], d: +r[M.h.d] };
  const byArm = {};
  for (const r of B.rows) { const id = r[B.h.arm] + '-b' + r[B.h.band];
    if (!MEAS[id]) { console.log('  ⛔ ' + id + ' 没有量表读数 ⇒ 不计入该臂'); continue; }
    (byArm[r[B.h.arm]] = byArm[r[B.h.arm]] || []).push({ fit: +r[B.h.trainFit], e: MEAS[id].e, p: MEAS[id].p, id: id }); }
  const ARMS = Object.keys(byArm).sort();
  console.log('\n每臂单独（n = 该臂带数；单臂 ρ 在 n=6 时临界 |ρ| ≥ 0.886 才到双侧 5% ⇒ 只当形状看）');
  console.log('臂     n  fit跨 考卷跨 页面跨 | ρfit,考 p   ρfit,页 p    前二分差(考卷/页面)');
  const RH = [], RP = [], RES = [];
  for (const a of ARMS) {
    const s = byArm[a].slice().sort((x, y) => y.fit - x.fit);
    const f = s.map(x => x.fit), e = s.map(x => x.e), p = s.map(x => x.p);
    const re = spearman(f, e), rp = spearman(f, p);
    const pe = permP(f, e), pp = permP(f, p);
    RH.push(re); RP.push(rp);
    const rng = (v) => Math.max.apply(null, v) - Math.min.apply(null, v);
    RES.push({ a, n: s.length, re, rp, pe, pp, fr: rng(f), er: rng(e), pr: rng(p),
      top2e: e[0] - e[1], top2p: p[0] - p[1] });
    console.log(a.padEnd(7) + String(s.length).padStart(2) + '  ' + rng(f).toFixed(3) + '  ' +
      rng(e).toFixed(1).padStart(5) + '  ' + rng(p).toFixed(1).padStart(5) +
      ' | ' + re.toFixed(3).padStart(6) + ' p=' + pe.toFixed(3) + '  ' + rp.toFixed(3).padStart(6) + ' p=' + pp.toFixed(3) +
      '   ' + (e[0] - e[1]).toFixed(1) + 'pt / ' + (p[0] - p[1]).toFixed(1) + 'pt');
  }
  const med = (v) => { const b = v.slice().sort((x, y) => x - y); return (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2; };
  const sign = (v, sgn) => v.filter((x) => sgn > 0 ? x > 0 : x < 0).length;
  const binom = (k, n) => { const C = (i) => { let c = 1; for (let j = 0; j < i; j++) c = c * (n - j) / (j + 1); return c; };
    let lo = 0; for (let i = 0; i <= Math.min(k, n - k); i++) lo += C(i) / Math.pow(2, n); return Math.min(1, 2 * lo); };
  console.log('\n===== 判据 (b)(c)：跨臂符号一致性（主统计量）=====');
  for (const [nm, R] of [['考卷 120（ε=0）', RH], ['页面 120（ε=0.2 soft）', RP]]) {
    const pos = sign(R, 1), n = R.length, pv = binom(Math.max(pos, n - pos), n);
    console.log('ρ(trainFit, ' + nm + ')：正 ' + pos + '/' + n + ' ‖ 中位 ρ = ' + med(R).toFixed(3) +
      ' ‖ 精确二项双侧 p = ' + pv.toFixed(4));
  }
  const okR = med(RH).toFixed(3), okP = med(RP).toFixed(3);
  const posH = sign(RH, 1), posP = sign(RP, 1);
  console.log('\n判据(c) 地板（跑前写死：中位 |ρ| ≥ 0.3 且 ≥7/8 同号才算"臂内配得上"）：');
  for (const [nm, R, pos] of [['考卷', RH, posH], ['页面', RP, posP]]) {
    const pass = Math.abs(med(R)) >= 0.3 && Math.max(pos, R.length - pos) >= 7;
    console.log('  ' + nm + '：中位 ρ ' + med(R).toFixed(3) + ' ‖ 多数符号 ' + Math.max(pos, R.length - pos) + '/' + R.length +
      ' ⇒ ' + (pass ? '**配得上**（训练分与这把尺同向）' : '**配不上**（臂内也无稳定信号）'));
  }
  console.log('\n判据(d) 分辨率随行：fit 带间跨度中位 ' + med(RES.map(r => r.fr)).toFixed(3) +
    ' ‖ 考卷带间极差中位 ' + med(RES.map(r => r.er)).toFixed(1) + 'pt ‖ 页面 ' + med(RES.map(r => r.pr)).toFixed(1) + 'pt' +
    '\n  噪声尺（同包换 eval seed 极差）p50 1.5pt ‖ p90 3.7pt ⇒ 极差低于它的臂，ρ 被测量噪声衰减，不许读成"训练没用"');
  const below = RES.filter(r => r.er < 3.7).map(r => r.a);
  console.log('  考卷极差 < 3.7pt 的臂：' + (below.length ? below.join(' ‖ ') : '无') + '（这些臂的 ρ 只能算方向）');
  /* 训练侧"自己的第一"落到验收尺的第几名 —— 这条比 ρ 更好读，也直接对上 §三 那条"选冠军是抽签"。
   *   两列：`fit 最高那带`（hall 排序的第一席）与 `selected`（终局重验后真正当选的那带）。 */
  const r1 = [], r2 = [];
  for (const a of ARMS) { const s = byArm[a].slice().sort((x, y) => y.fit - x.fit);
    const eSorted = s.map(x => x.e).slice().sort((x, y) => y - x);
    r1.push(eSorted.indexOf(s[0].e) + 1);
    const selRow = B.rows.filter(rr => rr[B.h.arm] === a && rr[B.h.selected] === '1')[0];
    if (selRow) { const sid = a + '-b' + selRow[B.h.band]; const m = MEAS[sid];
      if (m) r2.push(eSorted.indexOf(m.e) + 1); } }
  const mean = (v) => v.reduce((s, x) => s + x, 0) / (v.length || 1);
  console.log('\n训练自己的第一落到考卷第几名（1 = 该臂最强，n = ' + ARMS.length + ' ‖ 机会水平均值 = 3.50）：' +
    'fit 最高那带 ' + r1.join(' ‖ ') + ' ⇒ 均值第 ' + mean(r1).toFixed(2) + ' 名 ‖ 排第 1 的 ' +
    r1.filter(v => v === 1).length + '/' + r1.length + ' 臂（机会下期望 1.33 臂）');
  console.log('  终局**当选**那带（train-3p 重评选出的赢家）' + r2.length + ' 臂有标记：名次 ' + r2.join(' ‖ ') +
    ' ⇒ 均值第 ' + mean(r2).toFixed(2) + ' 名 ‖ 排第 1 的 ' + r2.filter(v => v === 1).length + '/' + r2.length);
  console.log('\n===== 两条正对照（判据必须能红）=====');
  const c1 = spearman([1, 1, 1, 1, 1, 1], [10, 20, 30, 40, 50, 60]);
  console.log('① 常数 fit ↔ 递增尺 ⇒ ρ = ' + c1 + ' ⇒ ' + ((isNaN(c1) || Math.abs(c1) < 1e-9) ? '✅ 塌成无定义/0（能红）' : '⛔ 常数竟有相关 ⇒ 统计件坏了'));
  const perfect = spearman([60, 50, 40, 30, 20, 10], [10, 20, 30, 40, 50, 60]);
  console.log('② 按考卷倒造的完美 fit ⇒ ρ = ' + perfect.toFixed(3) + ' ⇒ ' + (perfect < -0.999 ? '✅ 判得出 ≈ −1（能红）' : '⛔ 造不出完美反向 ⇒ 统计件坏了'));
  const pPerf = permP([1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1]);
  console.log('③ 置换 p 函数自己：完美同序的 p 必须 = 2/6! = 0.00278（恒等 + 反序两种）‖ 实测 p = ' +
    pPerf.toFixed(5) + ' ⇒ ' + (Math.abs(pPerf - 2 / 720) < 1e-9 ? '✅ 尾数方向对' : '⛔ p 函数给的仍是累积分布'));
  const rnd = spearman([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 6, 5]);
  console.log('④ 相邻两两交换的 fit ⇒ ρ = ' + rnd.toFixed(3) + '（置换 p = ' + permP([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 6, 5]).toFixed(3) +
    '）⇒ n=6 时"看着挺有序"的东西 p 有多大，读单臂 ρ 前先看这一行');
} else { console.error('用法：--phase=roster ‖ --phase=fit'); process.exit(2); }
