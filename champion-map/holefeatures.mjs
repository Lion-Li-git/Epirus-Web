/* §E585 哪一维行为特征**预测哪一格漏**（逐格版；判据跑前钉在 docs/research/logs/2026-10-11-e585-qoder.md §2，§7.1 加了 N 批那条）
 *
 * 与 `seatassoc.mjs`（§E576）的分工：那件的目标量是**三个聚合量**（六格均值 ×2 口径 + 最大格），
 *   本件的目标量是**逐格差**（6 格 × 2 口径 = 12 个）—— 因为 §E584 指出人类最贵的两格是「只枪压制」与「全程刷反弹」，
 *   而罚项要写的是"哪一维"，聚合量会把单格漏摊平（contX-201 / SOUP 那种尖刺形就是证据）。
 *   两件**不共用判据**，只共用统计件（`stats-lib.mjs`）。
 *
 * 用法：node champion-map/holefeatures.mjs --batches=f1.tsv,f2.tsv[,f3,f4] --seeds=90210,90211[,90212,90213] [--cellmin=0.5]
 *   ‖ 兼容旧写法：--a=<批1> --b=<批2>（等价于 --batches=a,b）
 * ⚑ 为什么要有 N 批：§5(b) 量到**逐格**档间噪声 p90 3~6pt、max 6~14pt，比六格均值粗 2~4 倍 ⇒ 单格关系被测量噪声压住。
 *   抬分辨率的便宜办法是多加 eval seed 取平均（噪声 ∝ 1/√N），不是把 --games 抬到 600（那是 3× 单价）。
 *   N 批下判据 (c)③ 自动收紧成「**每一批**单独的 ρ 都与合池同号」。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sp, mcP, holm, rngSeed } from './stats-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const rd = p => { const P = p.indexOf(':') >= 0 || p[0] === '/' ? p : join(HERE, p);
  if (!existsSync(P)) { console.error('⛔ 批表不在盘上：' + p); process.exit(2); }
  const L = readFileSync(P, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).filter(l => l[0] !== '#');
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
  return { f: p, h, rows: L.slice(1).map(l => l.split('\t')) }; };

const CELLS = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];
const SCR = ['H', 'Hp', 'De'];
const BASE = 'bundled-champion-3p';
const LINE = Number(arg('cellmin', 0.5));
const B_ = Number(arg('B', 20000));

/* ---- 批表：--batches 优先，退回 --a/--b；一批可以由多个文件用 `+` 拼（两个框合并就是两文件） ---- */
const FILES = (arg('batches', '') ? String(arg('batches', ''))
    : ['seat-2026-10-11-90210.tsv+seat-e584-90210.tsv', 'seat-2026-10-11-90211.tsv+seat-e584-90211.tsv'].join(','))
  .split(',').map(s => s.trim()).filter(Boolean).map(s => s.split('+').map(x => x.trim()).filter(Boolean));
const SEEDS = String(arg('seeds', '')).split(',').map(s => s.trim()).filter(Boolean);
if (FILES.length < 2) { console.error('⛔ 至少要两批（同枚换 eval seed 才能算同号与地板）'); process.exit(2); }
if (SEEDS.length && SEEDS.length !== FILES.length) { console.error('⛔ --seeds 的个数(' + SEEDS.length + ')必须等于批表个数(' + FILES.length + ')'); process.exit(2); }

/* (f) 守卫：同 (id,mode) 在同批里出现多次 ⇒ 必须逐值相同 */
function loadBatch(list) {
  const map = new Map();
  for (const f of list) {
    const t = rd(f);
    for (const r of t.rows) {
      const id = r[t.h.id], mode = r[t.h.mode];
      if (!id || !mode) continue;
      const sig = CELLS.map(c => r[t.h[c]]).join(',');
      const k = id + '|' + mode;
      if (map.has(k) && map.get(k).sig !== sig) { console.error('⛔ (f) 红：' + k + ' 在同一批里有两个值'); process.exit(2); }
      if (!map.has(k)) map.set(k, { sig, cells: CELLS.map(c => Number(r[t.h[c]])), path: r[t.h.path], seed0: r[t.h.seed0] });
    }
  }
  return map;
}
const ALLB = FILES.map(loadBatch);

/* ---- coords：id ↔ path 只认 path 列（§E330 那条同名不同槽的坑） ---- */
const C = rd('coords.tsv');
const PATH2ID = {};
for (const r of C.rows) if (r[C.h.path]) PATH2ID[r[C.h.path].replace(/\\/g, '/')] = r[C.h.id];
const featOf = {};
for (const r of C.rows) { const o = {}; for (const k of BEH.concat(SCR)) o[k] = Number(r[C.h[k]]); featOf[r[C.h.id]] = o; }
const packPath = {};
for (const list of FILES) for (const f of list) { const t = rd(f); for (const r of t.rows) packPath[r[t.h.id]] = r[t.h.path]; }

const ids = [...new Set(ALLB.map(m => [...m.keys()].map(k => k.split('|')[0]))
  .reduce((a, b) => a.filter(x => b.indexOf(x) >= 0)))].filter(id => id !== BASE);
const cidOf = {}; const skipped = [];
for (const id of ids) { const cid = PATH2ID[(packPath[id] || '').replace(/\\/g, '/')] || id; cidOf[id] = cid; if (!featOf[cid]) skipped.push(id); }
const usable = ids.filter(id => featOf[cidOf[id]]);
console.log('# (f) 批数 ' + ALLB.length + '（' + FILES.join(' ‖ ') + '）‖ 全批都有的候选 ' + ids.length + ' 枚 ‖ 进关联 ' + usable.length +
  ' ‖ 接不到 coords 的 ' + (skipped.join(',') || '无') + '（只进地板，不进关联）');

/* ---- (a) 锚点：按 seed0 查在册基线；查不到就**只印不验**（写死两批会让换档假红） ---- */
const ANCHORS = {
  '90210': { multi: '2,5,3,12,4,6', long: '5,15,0,28,16,10' },   // §E576 / §E506
  '90211': { multi: '1,7,1,12,5,4', long: '2,12,0,21,9,13' },     // §E576
  '90212': { multi: '1,9,1,9,9,8', long: '4,12,0,29,15,8' },      // §E583 ⇒ §E585 第二次跑**逐位复现**
  '90213': { multi: '2,4,1,14,6,8', long: '5,10,1,23,14,14' },    // §E585 第一次测
};
ALLB.forEach((m, bi) => {
  const seed = SEEDS[bi] || (m.get(BASE + '|multi') || {}).seed0 || '?';
  for (const mode of ['multi', 'long']) {
    const row = m.get(BASE + '|' + mode);
    const got = row ? row.cells.join(',') : '(缺)';
    const exp = (ANCHORS[seed] || {})[mode];
    if (!exp) { console.log('# (a) ' + seed + ' ' + mode + ' = ' + got + ' ‖ 此档无在册基线 ⇒ 只印不验'); continue; }
    console.log('# (a) ' + seed + ' ' + mode + ' = ' + got + (got === exp ? ' ✅' : ' ⛔ 与在册基线不符（' + exp + '）⇒ 整表作废'));
    if (got !== exp) process.exit(2);
  }
});

/* ---- (b) 地板：逐格的档间 sd 与"N 批平均后的 SE = sd/√N" ---- */
const sdOf = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.round(p * (a.length - 1)))]; };
console.log('\n# (b) 逐格地板（N=' + ALLB.length + ' 批 · 同一枚同格的档间 sd；平均后 SE = sd/√N）');
for (const mode of ['multi', 'long']) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const sds = [];
    for (const id of usable) {
      const v = ALLB.map(m => (m.get(id + '|' + mode) || {}).cells).filter(c => c).map(c => c[i]);
      if (v.length === ALLB.length) sds.push(sdOf(v));
    }
    parts.push(CELLS[i] + ' sd p50 ' + q(sds, .5).toFixed(2) + '/p90 ' + q(sds, .9).toFixed(2) + ' ⇒ SE(mean) ' + (q(sds, .5) / Math.sqrt(ALLB.length)).toFixed(2) + '~' + (q(sds, .9) / Math.sqrt(ALLB.length)).toFixed(2));
  }
  console.log('#   ' + mode + '：' + parts.join(' ‖ '));
}

/* ---- 目标量：逐格差（每批各算 + N 批合池平均；基线一律取**各自那批**的现役行） ---- */
function targets(subset) {
  const list = subset || usable;
  const out = [];
  for (const mode of ['multi', 'long']) for (let i = 0; i < 6; i++) {
    const xs = [], ysM = [], perBatch = ALLB.map(() => []);
    const base = ALLB.map(m => m.get(BASE + '|' + mode));
    for (const id of list) {
      const rows = ALLB.map(m => m.get(id + '|' + mode));
      if (rows.some(r => !r) || base.some(b => !b)) continue;
      xs.push(featOf[cidOf[id]]);
      const diffs = rows.map((r, bi) => r.cells[i] - base[bi].cells[i]);
      ysM.push(diffs.reduce((a, b) => a + b, 0) / diffs.length);
      diffs.forEach((d, bi) => perBatch[bi].push(d));
    }
    out.push({ mode, cell: CELLS[i], xs, ysM, perBatch });
  }
  return out;
}
function run(T, label) {
  const rng = () => rngSeed(20261011);
  const rows = [];
  for (const t of T) for (const dim of BEH.concat(SCR)) {
    const x = t.xs.map(o => o[dim]);
    rows.push({ 目标: t.mode + '·' + t.cell, 维: dim, n: t.xs.length, rM: sp(x, t.ysM),
      rEach: t.perBatch.map(y => sp(x, y)), p: mcP(x, t.ysM, B_, rng()) });
  }
  const byT = {};
  for (const r of rows) (byT[r.目标] = byT[r.目标] || []).push(r);
  for (const k in byT) { const adj = holm(byT[k].map(r => r.p)); byT[k].forEach((r, i) => r.pHolm = adj[i]); }
  console.log('\n===== ' + label + '（目标 = 逐格差 · Holm 族 = 同一目标下 ' + (BEH.length + SCR.length) + ' 个自变量）=====');
  const shortlist = [];
  for (const k of Object.keys(byT)) {
    const list = byT[k].filter(r => BEH.indexOf(r.维) >= 0).sort((a, b) => Math.abs(b.rM) - Math.abs(a.rM)).slice(0, 3);
    console.log('\n· ' + k + '（n=' + list[0].n + '）');
    for (const r of list) {
      const 同标 = r.rEach.every(v => Math.sign(v) === Math.sign(r.rM) && v !== 0);
      const 入围 = Math.abs(r.rM) >= LINE && r.pHolm <= 0.05 && 同标;
      if (入围) shortlist.push({ 目标: r.目标, 维: r.维, rM: r.rM, pHolm: r.pHolm });
      console.log('    ' + r.维.padEnd(15) + ' ρ(合池)=' + r.rM.toFixed(3) + ' ρ(逐批)=' + r.rEach.map(v => v.toFixed(2)).join('/') +
        (同标 ? ' 全同号' : ' **有反号批**') + ' p=' + r.p.toFixed(4) + ' Holm=' + r.pHolm.toFixed(3) +
        (入围 ? '  ★入围' : (Math.abs(r.rM) >= LINE ? '  (Holm 未过)' : '')));
    }
  }
  return shortlist;
}
const shortlist = run(targets(), '§E585（' + ALLB.length + ' 批合池 · ' + SEEDS.join('/') + '）');
console.log('\n入围清单：' + (shortlist.length ? shortlist.map(s => s.目标 + ' ← ' + s.维 + '(ρ=' + s.rM.toFixed(2) + ' Holm=' + s.pHolm.toFixed(3) + ')').join(' ‖ ') : '（空）'));

/* ---- (d) 分辨率 ---- */
{
  const n = usable.length; const rr = []; const g = rngSeed(4242);
  for (let b = 0; b < 4000; b++) rr.push(Math.abs(sp([...Array(n)].map(() => g()), [...Array(n)].map(() => g()))));
  rr.sort((a, b) => a - b);
  console.log('# (d) n=' + n + ' ‖ 双侧 5% 的 |ρ| 临界（蒙特卡洛 B=4000）≈ ' + rr[Math.round(0.95 * (rr.length - 1))].toFixed(3) + ' ‖ 判据 (c) 门槛 ' + LINE);
}

/* ---- (e) 三条正对照 ---- */
{
  const n = usable.length; const ys = targets()[0].ysM.slice();
  let hit = 0; const ps = [];
  for (let k = 0; k < 2; k++) { const g = rngSeed(987655 + k * 7); ps.push(mcP([...Array(n)].map(() => g()), ys, B_, rngSeed(1000 + k))); if (ps[k] <= 0.05) hit++; }
  console.log('# (e)① 随机自变量列 ⇒ p=' + ps.map(x => x.toFixed(3)).join('/') + ' 显著 ' + hit + '/2（期望 ≤0.1）' + (hit ? ' ⛔ 判据有洞' : ' ✅'));
  const t0 = targets()[0]; const hp = t0.xs.map(o => o.Hp);
  console.log('# (e)② 分数维 Hp ↔ ' + t0.mode + '·' + t0.cell + ' ρ=' + sp(hp, t0.ysM).toFixed(3) + '（对照维，不进清单）');
  const dm = t0.xs.map(o => o.dmg);
  const perfect = mcP(dm, dm.slice(), 2000, rngSeed(7));
  console.log('# (e)③ 目标倒造成自变量 ⇒ ρ 必须=1.000（实测 ' + sp(dm, dm.slice()).toFixed(3) + '）‖ 同列置换 p 必须最小（实测 ' + perfect.toFixed(5) + '）' + (perfect < 0.002 ? ' ✅' : ' ⛔'));
}

/* ---- (g) 带内诊断（Hp ≥ 40）---- */
{
  const hi = usable.filter(id => featOf[cidOf[id]].Hp >= 40);
  const T2 = targets(hi);
  console.log('# (g) 带内（Hp ≥ 40，n=' + hi.length + '）两格头名：');
  for (const t of T2.filter(t => t.cell === '只枪压制' || t.cell === '全程刷反弹')) {
    const best = BEH.map(d => ({ d, r: sp(t.xs.map(o => o[d]), t.ysM) })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
    console.log('    ' + t.mode + '·' + t.cell + ' ← ' + best.d + ' ρ=' + best.r.toFixed(3));
  }
}
