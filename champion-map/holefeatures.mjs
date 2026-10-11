/* §E585 哪一维行为特征**预测哪一格漏**（逐格版；判据跑前钉在 docs/research/logs/2026-10-11-e585-qoder.md §2）
 *
 * 与 `seatassoc.mjs`（§E576）的分工：那件的目标量是**三个聚合量**（六格均值 ×2 口径 + 最大格），
 *   本件的目标量是**逐格差**（6 格 × 2 口径 = 12 个）—— 因为 §E584 指出人类最贵的两格是「只枪压制」与「全程刷反弹」，
 *   而罚项要写的是"哪一维"，聚合量会把单格漏摊平（contX-201 / SOUP 那种尖刺形就是证据）。
 *   两件**不共用判据**，只共用统计件（`stats-lib.mjs`）。
 *
 * 用法：node champion-map/holefeatures.mjs [--a=批1.tsv[,...]] [--b=批2.tsv[,...]] [--fwd=批3,批4] [--cellmin=0.5]
 *   默认 a/b = §E576 那两批（两框合并后每批 42 行）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ranks, pear, sp, mcP, holm, rngSeed } from './stats-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const rd = p => { const P = p.indexOf(':') >= 0 || p[0] === '/' ? p : join(HERE, p);
  const L = readFileSync(P, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).filter(l => l[0] !== '#');
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
  return { f: p, h, rows: L.slice(1).map(l => l.split('\t')) }; };

const CELLS = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];
const SCR = ['H', 'Hp', 'De'];
const BASE = 'bundled-champion-3p';
const LINE = Number(arg('cellmin', 0.5));           // (c)① 的 |ρ| 门槛
const B_ = Number(arg('B', 20000));

/* ---- (f) 名单与行数守卫：同 (id,mode) 出现多次 ⇒ 必须逐值相同，否则红 ---- */
function loadBatch(list) {
  const map = new Map();
  for (const f of list) {
    const t = rd(f.trim());
    for (const r of t.rows) {
      const id = r[t.h.id], mode = r[t.h.mode];
      if (!id || !mode) continue;
      const sig = CELLS.map(c => r[t.h[c]]).join(',');
      const k = id + '|' + mode;
      if (map.has(k) && map.get(k).sig !== sig) { console.error('⛔ (f) 红：' + k + ' 在同一批里有两个值（' + map.get(k).sig + ' vs ' + sig + '）'); process.exit(2); }
      if (!map.has(k)) map.set(k, { sig, cells: CELLS.map(c => Number(r[t.h[c]])) });
    }
  }
  return map;
}
const DEF_A = 'seat-2026-10-11-90210.tsv,seat-e584-90210.tsv';
const DEF_B = 'seat-2026-10-11-90211.tsv,seat-e584-90211.tsv';
const A = loadBatch(String(arg('a', DEF_A)).split(','));
const Bt = loadBatch(String(arg('b', DEF_B)).split(','));

/* ---- coords：id ↔ path 只认 path 列（§E330 那条同名不同槽的坑） ---- */
const C = rd('coords.tsv');
const PATH2ID = {};
for (const r of C.rows) if (r[C.h.path]) PATH2ID[r[C.h.path].replace(/\\/g, '/')] = r[C.h.id];
const featOf = {};
for (const r of C.rows) { const o = {}; for (const k of BEH.concat(SCR)) o[k] = Number(r[C.h[k]]); featOf[r[C.h.id]] = o; }

/* 两批都出现、且能接到 coords 的枚 */
const P = [];
const skipped = [];
for (const k of A.keys()) {
  if (!Bt.has(k)) continue;
  const id = k.split('|')[0], mode = k.split('|')[1];
  if (mode !== 'multi' && mode !== 'long') continue;
  P.push({ k, id, mode });
}
const packPath = {};
/* ⚑ 这里必须用**同一个默认串**（第一版写成 `arg('a','')` ⇒ 没传 flag 时建出**空表**，
 *   于是"重命名过的那几枚"（probe 打的是 basename，coords 里叫 SLOT-…/R391/…）全被判成"接不到 coords"，
 *   n 从 38 掉到 34 —— 症状是"少几枚"而不是报错，正是本仓最怕的静默缺行。） */
for (const f of String(arg('a', DEF_A)).split(',')) { if (!f.trim()) continue; const t = rd(f.trim()); for (const r of t.rows) packPath[r[t.h.id]] = r[t.h.path]; }
for (const p of P) { p.cid = PATH2ID[(packPath[p.id] || '').replace(/\\/g, '/')] || p.id; p.f = featOf[p.cid]; if (!p.f) skipped.push(p.cid); }
const ids = [...new Set(P.filter(p => p.f).map(p => p.id))];
console.log('# (f) 进关联的枚数 ' + ids.length + ' ‖ 接不到 coords 的 ' + [...new Set(skipped)].join(',') + '（只进地板，不进关联）');

/* ---- (a) 锚点：现役两批逐格原值 ---- */
for (const [tag, m, exp] of [['90210 multi', A.get(BASE + '|multi'), '2,5,3,12,4,6'], ['90210 long', A.get(BASE + '|long'), '5,15,0,28,16,10'],
  ['90211 multi', Bt.get(BASE + '|multi'), '1,7,1,12,5,4'], ['90211 long', Bt.get(BASE + '|long'), '2,12,0,21,9,13']]) {
  const got = m ? m.cells.join(',') : '(缺)';
  console.log('# (a) 锚点 ' + tag + ' = ' + got + (got === exp ? ' ✅' : ' ⛔ 与在册基线不符（' + exp + '）⇒ 整表作废'));
  if (got !== exp) process.exit(2);
}

/* ---- (b) 逐格噪声地板：同一枚同格两批之差的 |Δ| ---- */
console.log('\n# (b) 逐格地板（同枚换 eval seed 的 |Δ|，pt）');
for (const mode of ['multi', 'long']) {
  const q = [];
  for (let i = 0; i < 6; i++) {
    const d = [];
    for (const id of ids) { const a = A.get(id + '|' + mode), b = Bt.get(id + '|' + mode); if (a && b) d.push(Math.abs(a.cells[i] - b.cells[i])); }
    d.sort((x, y) => x - y);
    q.push(CELLS[i] + ' p50 ' + d[Math.round(0.5 * (d.length - 1))].toFixed(1) + '/p90 ' + d[Math.min(d.length - 1, Math.round(0.9 * (d.length - 1)))].toFixed(1) + '/max ' + d[d.length - 1].toFixed(0));
  }
  console.log('#   ' + mode + '：' + q.join(' ‖ '));
}

/* ---- 目标量：逐格差（每批各算 + 两批平均） ---- */
function targets(m1, m2) {
  const out = [];
  for (const mode of ['multi', 'long']) for (let i = 0; i < 6; i++) {
    const xs = [], ysA = [], ysB = [], ysM = [];
    const baseA = (m1 || A).get(BASE + '|' + mode), baseB = (m2 || Bt).get(BASE + '|' + mode);
    for (const id of ids) {
      const a = (m1 || A).get(id + '|' + mode), b = (m2 || Bt).get(id + '|' + mode);
      if (!a || !b || !featOf[PATH2ID[(packPath[id] || '').replace(/\\/g, '/')] || id]) continue;
      xs.push(featOf[PATH2ID[(packPath[id] || '').replace(/\\/g, '/')] || id]);
      ysA.push(a.cells[i] - baseA.cells[i]); ysB.push(b.cells[i] - baseB.cells[i]); ysM.push((a.cells[i] + b.cells[i]) / 2 - (baseA.cells[i] + baseB.cells[i]) / 2);
    }
    out.push({ mode, cell: CELLS[i], xs, ysA, ysB, ysM });
  }
  return out;
}
function run(T, label) {
  const rng = () => rngSeed(20261011);
  const rows = [];
  for (const t of T) {
    const n = t.xs.length;
    for (const dim of BEH.concat(SCR)) {
      const x = t.xs.map(o => o[dim]);
      const rM = sp(x, t.ysM), rA = sp(x, t.ysA), rB = sp(x, t.ysB);
      rows.push({ 目标: t.mode + '·' + t.cell, 维: dim, n, rM, rA, rB, p: mcP(x, t.ysM, B_, rng()) });
    }
  }
  /* Holm 在**每个目标内部**校正 13 个自变量 */
  const byT = {};
  for (const r of rows) (byT[r.目标] = byT[r.目标] || []).push(r);
  for (const k in byT) { const adj = holm(byT[k].map(r => r.p)); byT[k].forEach((r, i) => r.pHolm = adj[i]); }
  console.log('\n===== ' + label + '（目标 = 逐格差 · Holm 族 = 同一目标下 ' + (BEH.length + SCR.length) + ' 个自变量）=====');
  const shortlist = [];
  for (const k of Object.keys(byT)) {
    const list = byT[k].filter(r => BEH.indexOf(r.维) >= 0).sort((a, b) => Math.abs(b.rM) - Math.abs(a.rM)).slice(0, 3);
    console.log('\n· ' + k + '（n=' + list[0].n + '）');
    for (const r of list) {
      const 同标 = Math.sign(r.rA) === Math.sign(r.rB) && r.rA !== 0;
      const 入围 = Math.abs(r.rM) >= LINE && r.pHolm <= 0.05 && 同标;
      if (入围) shortlist.push({ 目标: r.目标, 维: r.维, rM: r.rM, pHolm: r.pHolm, 前向: null });
      console.log('    ' + r.维.padEnd(15) + ' ρ(两批平均)=' + r.rM.toFixed(3) + ' ρ(单批)=' + r.rA.toFixed(2) + '/' + r.rB.toFixed(2) +
        (同标 ? ' 同' : ' **翻**') + ' p=' + r.p.toFixed(4) + ' Holm=' + r.pHolm.toFixed(3) + (入围 ? '  ★入围' : (Math.abs(r.rM) >= LINE ? '  (Holm 未过)' : '')));
    }
  }
  return shortlist;
}
const T = targets();
const shortlist = run(T, '§E585 本框（两框合并 · 90210/90211）');
console.log('\n入围清单：' + (shortlist.length ? shortlist.map(s => s.目标 + ' ← ' + s.维 + '(ρ=' + s.rM.toFixed(2) + ')').join(' ‖ ') : '（空）'));

/* ---- (d) 分辨率 ---- */
{
  const n = T[0].xs.length; const rr = []; const g = rngSeed(4242);
  for (let b = 0; b < 4000; b++) rr.push(Math.abs(sp([...Array(n)].map(() => g()), [...Array(n)].map(() => g()))));
  rr.sort((a, b) => a - b);
  console.log('# (d) n=' + n + ' ‖ 双侧 5% 的 |ρ| 临界（蒙特卡洛 B=4000）≈ ' + rr[Math.round(0.95 * (rr.length - 1))].toFixed(3) + ' ‖ 判据 (c) 门槛 ' + LINE);
}

/* ---- (e) 三条正对照 ---- */
{
  const g = rngSeed(987655);
  const n = ids.length;
  const ys = T[0].ysM.slice();
  let hit = 0; const ps = [];
  for (let k = 0; k < 2; k++) { const x = [...Array(n)].map(() => g()); ps.push(mcP(x, ys, B_, rngSeed(1000 + k))); if (ps[k] <= 0.05) hit++; }
  console.log('# (e)① 随机自变量列 ⇒ p=' + ps.map(x => x.toFixed(3)).join('/') + ' 显著 ' + hit + '/2（期望 ≤0.1）' + (hit ? ' ⛔ 判据有洞' : ' ✅'));
  const hp = T[0].xs.map(o => o.Hp);
  console.log('# (e)② 分数维 Hp ↔ ' + T[0].mode + '·' + T[0].cell + ' ρ=' + sp(hp, T[0].ysM).toFixed(3) + '（对照维，不许进清单；已排除在清单外）');
  const dm = T[0].xs.map(o => o.dmg);
  const perfect = mcP(dm, dm.slice(), 2000, rngSeed(7));
  console.log('# (e)③ 目标倒造成自变量 ⇒ ρ 必须=1.000（实测 ' + sp(dm, dm.slice()).toFixed(3) + '）‖ 同列置换 p 必须最小（实测 ' + perfect.toFixed(5) + '，期望 ≈0.0005）' + (perfect < 0.002 ? ' ✅' : ' ⛔'));
}

/* ---- (g) 带内诊断 ---- */
{
  const hi = new Set(P.filter(p => p.f && p.f.Hp >= 40).map(p => p.id));
  const T2 = targets(new Map([...A].filter(([k]) => hi.has(k.split('|')[0]))), new Map([...Bt].filter(([k]) => hi.has(k.split('|')[0]))));
  console.log('# (g) 带内（Hp ≥ 40，n=' + T2[0].xs.length + '）最重的两格：');
  for (const t of T2.filter(t => t.cell === '只枪压制' || t.cell === '全程刷反弹'))
    console.log('    ' + t.mode + '·' + t.cell + ' 行为维里最强 |ρ|=' +
      BEH.map(d => ({ d, r: sp(t.xs.map(o => o[d]), t.ysM) })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0].d +
      ' ρ=' + BEH.map(d => sp(t.xs.map(o => o[d]), t.ysM)).sort((a, b) => Math.abs(b) - Math.abs(a))[0].toFixed(3));
}

/* ---- (h) 前向：入围项在新档上重测，同号且 |ρ| ≥ 0.4 才许外推 ----
 * ⚑ 前向批只有 17 枚，而本框是 41 枚 ⇒ 直接拿 41 枚的 ρ 去比 17 枚的 ρ 是**换了样本**在比。
 *   所以这里同时印三个数：本框(41) ‖ **同一子集(17) 用原档**（ apples-to-apples 的参照）‖ 前向(17 新档)。
 *   判"外推得住"比的是**后两个**，不是第一个。 */
const FWD = String(arg('fwd', ''));
if (FWD) {
  const [f1, f2] = FWD.split(',');
  const FA = loadBatch([f1]), FB = loadBatch([f2]);
  const idsF = [...new Set([...FA.keys()].map(k => k.split('|')[0]))].filter(id => id !== BASE &&
    ids.indexOf(id) >= 0 && FA.has(id + '|multi') && FA.has(id + '|long') && FB.has(id + '|multi') && FB.has(id + '|long'));
  console.log('\n===== (h) 前向（新档 ' + f1.replace(/^.*-/, '').replace('.tsv', '') + '/' + f2.replace(/^.*-/, '').replace('.tsv', '') +
    ' · ' + idsF.length + ' 枚 · 自变量不动，只换目标量的测量）=====');
  const subA = new Map([...A].filter(([k]) => idsF.indexOf(k.split('|')[0]) >= 0));
  const subB = new Map([...Bt].filter(([k]) => idsF.indexOf(k.split('|')[0]) >= 0));
  const save = ids.splice(0); ids.push(...idsF);
  const Tsub = targets(subA, subB), TF = targets(FA, FB);
  ids.push(...save);
  if (!shortlist.length) console.log('本框无入围项 ⇒ 前向没东西可验（但仍印同子集与前向的最强维，供 §9 写"这框里到底有没有信号"）');
  const show = shortlist.length ? shortlist : Tsub.filter(t => t.cell === '只枪压制' || t.cell === '全程刷反弹')
    .map(t => ({ 目标: t.mode + '·' + t.cell, 维: BEH.map(d => ({ d, r: sp(t.xs.map(o => o[d]), t.ysM) })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0].d, rM: 0, 前向: null }));
  for (const s of show) {
    const ts = Tsub.filter(x => x.mode + '·' + x.cell === s.目标)[0];
    const tf = TF.filter(x => x.mode + '·' + x.cell === s.目标)[0];
    if (!ts || !tf) { console.log('  ' + s.目标 + ' ← ' + s.维 + ' | 前向批里缺这枚/这格，不判'); continue; }
    const rSub = sp(ts.xs.map(o => o[s.维]), ts.ysM), rFwd = sp(tf.xs.map(o => o[s.维]), tf.ysM);
    const ok = Math.sign(rSub) === Math.sign(rFwd) && Math.abs(rFwd) >= 0.4;
    s.前向 = rFwd;
    console.log('  ' + s.目标.padEnd(22) + '← ' + s.维.padEnd(14) + '本框(41) ρ=' + (s.rM ? s.rM.toFixed(3) : '—') +
      ' ‖ 同子集(17) ρ=' + rSub.toFixed(3) + ' ‖ 前向(17 新档) ρ=' + rFwd.toFixed(3) + ' ⇒ ' + (ok ? '✅ 外推得住' : '⛔ 外推不住 ⇒ 降级为"只是本框内同向"'));
  }
}
