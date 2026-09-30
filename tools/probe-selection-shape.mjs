#!/usr/bin/env node
/* §E194 · C8-lite：**把"选冠军"那一步的桌形从 3 人换成 5 人，会不会换成另一个**
 *
 * 要回答的问题（DS 清单 C8 / 我 23:1x 排序里的 C8-lite）：训练侧的选择发生在 3 人评分桌上
 *   （`server/train-server.mjs:631` 的 `evalN(..., n=3 ...)` + `tools/train-3p.mjs:1253` 的 `bandPickByLand`），
 *   而产品桌是 5 人（§E185 之后所有读数都在 n=5 上）。以前只有 §E137 一个样本（−1.9pt 翻号）。
 *
 * ★ **两版设计，第一版是错的，错处写在代码里**（本仓第一条口径陷阱"fit ≠ 胜率"的近亲）：
 *   v1（留在 `docs/artifacts/e184-out/probe-selection-shape.v1.mjs.keep` + `e194-shape.log`）拿
 *   "档案里当年选中的那一只"（`META.selected`）当 3 人侧的决定，与 5 人考卷的 argmax 对账。
 *   ⇒ 这**同时改了两件事**：桌形（3→5）**和度量**（训练用的 `fit` 是奖励整形过的合成分，不是胜率）。
 *   v1 实测"硬翻案 15/30 = 50.0% ‖ 同卷噪声地板 11/30 = 36.7%"，我差点把它写成"桌形改决定"——
 *   **那句归因归错了主体**：一个不测胜率的合成分与一个测胜率的考卷本来就该不一致，与几个人无关。
 *   ⇒ **v2（现在的主判据）：同一只手、同一个度量（`tools/eval-5p.mjs` 的 `1st%`），只改人数 `N`（3 与 5）**，
 *     同一批候选 × 同 4 批 seed ⇒ 两形的 argmax 不一致率，才是"桌形"单独的贡献。
 *
 * 为什么用现成考卷：**本仓最怕"同一算术写两份"**（D206/D207 就为这个存在）。`eval-5p` 的第二枚位置参数本来就是人数
 *   （`[每组合局数] [人数=5] [seed] [冠军文件]`）⇒ 一只仪器、两个桌形、同一个 `1st%`。
 *   ⚠ 它的已知弱点照抄考卷自己的说明：3 人桌上只有 2 个脚本对手（5 人桌 4 个互不相同）⇒ 这是"桌形"定义的一部分，不是 extra 偏置。
 *
 * ⚠ 三条限制：
 *   1. 本节数值**不与 §E185~§E193 的产品桌读数并排**（这里是脚本对手场，没有人类形状席、没有环境原型）。
 *   2. `bandPickByLand` 不是纯 argmax（容差带 + 最大熵）⇒ 档案 `selected` 与 `trainFit` 最大者可以不同。
 *   3. **每个桌形有自己的噪声地板**：同形把 4 批 seed 对半分裂，两半 argmax 不一致的事件率。两形不一致率必须与地板同框读。
 *
 * 只读 `docs/artifacts/**` 与 `js/**`，不改引擎、不加门、不动冠军槽。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['events', 'games', 'minBands', 'arms', 'seeds', 'shapes', 'v1', 'dry'], 'probe-selection-shape');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const EXG = Math.max(1, Number(arg('games', 24)) || 24);
const WANT_EVENTS = Math.max(1, Number(arg('events', 30)) || 30);
const MIN_BANDS = Math.max(2, Number(arg('minBands', 3)) || 3);
const ARMFILTER = String(arg('arms', '')).split(',').filter(Boolean);
const SEEDS = String(arg('seeds', '77000,154000,231000,308000')).split(',').map(Number).filter(x => isFinite(x));
const SHAPES = String(arg('shapes', '3,5')).split(',').map(Number).filter(x => x >= 2 && x <= 6);
const HALF = Math.floor(SEEDS.length / 2);
const DIR = 'docs/artifacts';
const DRY = argv.includes('--dry');
const SHOW_V1 = argv.includes('--v1');
if (HALF < 1) { console.error('⛔ 至少 2 批 seed 才有噪声地板可对'); process.exit(2); }
if (SHAPES.length < 2) { console.error('⛔ 需要至少两个桌形才能比（--shapes=3,5）'); process.exit(2); }
const A = SHAPES[0], B = SHAPES[SHAPES.length - 1];

/* ---- 1. 枚举 band-save 档案：META + 权重指纹（同一份权重不重复计分） ---- */
const files = readdirSync(DIR).filter(f => /band\d+\.bak$/.test(f));
const recs = [];
let noMeta = 0, noBody = 0;
for (const f of files) {
  const p = join(DIR, f);
  const src = readFileSync(p, 'utf8');
  const m = /EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\});/.exec(src);
  if (!m) { noMeta++; continue; }
  let j; try { j = JSON.parse(m[1]); } catch (e) { noMeta++; continue; }
  if (!j || typeof j.arm !== 'string' || typeof j.bandIdx !== 'number') { noMeta++; continue; }
  const b = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (!b) { noBody++; continue; }
  recs.push({ file: p, meta: j, hash: createHash('sha1').update(b[1]).digest('hex').slice(0, 12) });
}

/* ---- 2. 事件 = 同一次训练跑（arm + 代数 + 群体 + seed + 当时的桌人数） ---- */
const grouped = {};
for (const r of recs) {
  const k = [r.meta.arm, r.meta.gens, r.meta.pop, r.meta.seed, r.meta.n].join('|');
  (grouped[k] = grouped[k] || []).push(r);
}
let dupDropped = 0;
let events = Object.keys(grouped).sort()
  .map(k => {
    const all = grouped[k].slice().sort((a, b) => a.meta.bandIdx - b.meta.bandIdx);
    const seen = {}, keep = [];
    for (const c of all) { if (seen[c.hash]) { dupDropped++; continue; } seen[c.hash] = 1; keep.push(c); }
    return { id: k, cands: keep, nAll: all.length };
  })
  .filter(e => e.cands.length >= MIN_BANDS)
  /* 只保留"当年确实做过一次选择"的事件：恰好一只 selected=true（0 只 = 没选过，≥2 只 = 档案形状不明） */
  .filter(e => e.cands.filter(c => c.meta.selected === true).length === 1);
if (ARMFILTER.length) events = events.filter(e => ARMFILTER.includes(e.id.split('|')[0]));
const stride = events.length > WANT_EVENTS ? events.length / WANT_EVENTS : 1;
const picked = stride === 1 ? events : Array.from({ length: WANT_EVENTS }, (_, i) => events[Math.floor(i * stride)]);

const nCall = picked.reduce((a, e) => a + e.cands.length, 0) * SEEDS.length * SHAPES.length;
console.log('# §E194 C8-lite：只改桌形（' + A + ' 人 ↔ ' + B + ' 人）——同一个度量、同一只手、同 ' + SEEDS.length + ' 批 seed');
console.log('# 档案 `' + DIR + '/*band*.bak` ' + files.length + ' 只（无 META ' + noMeta + ' ‖ 无权重 ' + noBody + ' ‖ 同权重去掉 ' + dupDropped
  + '）→ 事件 ' + Object.keys(grouped).length + ' → 可用（≥' + MIN_BANDS + ' 只且恰好一只 selected）**' + events.length + '** → 等距抽 **' + picked.length + '**');
console.log('# 考卷 `tools/eval-5p.mjs` ‖ 桌形 ' + SHAPES.join('/') + ' 人 ‖ 每组合 ' + EXG + ' 局 ‖ seed ' + SEEDS.join('/') + ' ‖ 排序用**均值**');
console.log('# 调用 ' + nCall + ' 次');
if (!picked.length) { console.log('⛔ 没有可用事件（放宽 --minBands 或 --arms=）'); process.exit(2); }
if (DRY) {
  for (const e of picked) console.log('· `' + e.id + '` n=' + e.cands.length + (e.nAll !== e.cands.length ? '（去重 ' + (e.nAll - e.cands.length) + '）' : '')
    + ' bands=' + e.cands.map(c => c.meta.bandIdx + (c.meta.selected ? '★' : '')).join(','));
  process.exit(0);
}

/* ---- 3. 打分 ---- */
function spawnExam(file, seed, n) {
  const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', String(EXG), String(n), String(seed), file], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const g = re => { const m = re.exec(out); return m ? Number(m[1]) : null; };
  return { first: g(/\[(?:冠军|消融[^\]]*)\]\s*1st=([\d.]+)%/), strict: g(/严胜=([0-9.]+)%/), tie: g(/并列=([0-9.]+)%/), cost3: g(/cost>=3 出手占比=([\d.]+)%/), rc: r.status };
}
const rows = [];
let calls = 0;
for (const e of picked) {
  const one = [];
  for (const c of e.cands) {
    const byShape = {};
    for (const n of SHAPES) byShape[n] = SEEDS.map(s => { calls++; return spawnExam(c.file, s, n); });
    one.push({ file: c.file, meta: c.meta, byShape });
  }
  rows.push({ id: e.id, trainedN: Number(e.id.split('|').pop()), cands: one });
  console.log('· `' + e.id + '` ' + one.length + ' 只（累计 ' + calls + '/' + nCall + '）');
}

const mean = x => x.reduce((p, q) => p + q, 0) / x.length;
const valsAt = (c, n) => c.byShape[n].map(r => r.first);
const okAll = c => SHAPES.every(n => c.byShape[n].every(r => r.first != null));
function topIdx(vals) { let bi = -1; for (let i = 0; i < vals.length; i++) { if (vals[i] == null) continue; if (bi < 0 || vals[i] > vals[bi] + 1e-9) bi = i; } return bi; }
function topHalf(list, n, idxs) { return topIdx(list.map(c => mean(idxs.map(i => c.byShape[n][i].first)))); }
const firstHalf = Array.from({ length: HALF }, (_, k) => k);
const secondHalf = Array.from({ length: SEEDS.length - HALF }, (_, k) => HALF + k);

/* ---- 4. 主判据：只改桌形 ---- */
const stats = {};
for (const n of SHAPES) stats[n] = { judgeable: 0, floor: 0, spread: 0 };
let pairJudgeable = 0, pairDiff = 0, gainSum = 0, gainN = 0, tauSum = 0, tauN = 0;
const pairDetail = [];
for (const e of rows) {
  const ok = e.cands.filter(okAll);
  if (ok.length < 2) continue;
  const avgOf = n => ok.map(c => mean(valsAt(c, n)));
  const tops = {};
  for (const n of SHAPES) {
    const v = avgOf(n);
    const spread = Math.max(...v) - Math.min(...v);
    if (spread <= 0) continue;                                     /* 该桌形在这个事件上分不开 ⇒ 不进该形分母 */
    const s = stats[n]; s.judgeable++; s.spread += spread;
    if (topHalf(ok, n, firstHalf) !== topHalf(ok, n, secondHalf)) s.floor++;
    tops[n] = topIdx(v);
  }
  if (SHAPES.every(n => tops[n] != null)) {
    pairJudgeable++;
    if (tops[A] !== tops[B]) {
      pairDiff++;
      const vb = avgOf(B);
      const gap = vb[tops[B]] - vb[tops[A]];
      gainSum += gap; gainN++;
      pairDetail.push({ id: e.id, trainedN: e.trainedN, a: ok[tops[A]].meta.bandIdx, b: ok[tops[B]].meta.bandIdx,
        av: avgOf(A)[tops[A]], bv: vb[tops[B]], aOnB: vb[tops[A]], gap });
    }
    const va = avgOf(A), vbb = avgOf(B);
    let conc = 0, disc = 0;
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
      const sa = Math.sign(va[i] - va[j]), sb = Math.sign(vbb[i] - vbb[j]);
      if (sa === 0 || sb === 0) continue;
      if (sa === sb) conc++; else disc++;
    }
    if (conc + disc > 0) { tauSum += (conc - disc) / (conc + disc); tauN++; }
  }
}
console.log('\n## 主判据：只改桌形（同一个 `1st%`、同一只手）');
for (const n of SHAPES) {
  const s = stats[n];
  console.log('· **' + n + ' 人桌**：可判 ' + s.judgeable + ' 事件 ‖ 尺的牙（事件内均值极差）' + (s.spread / Math.max(1, s.judgeable)).toFixed(1)
    + 'pt ‖ **噪声地板**（对半分裂换 argmax）' + s.floor + '/' + s.judgeable + ' = **' + (100 * s.floor / Math.max(1, s.judgeable)).toFixed(1) + '%**');
}
const floorAvg = mean(SHAPES.map(n => 100 * stats[n].floor / Math.max(1, stats[n].judgeable)));
const pairRate = 100 * pairDiff / Math.max(1, pairJudgeable);
console.log('· **两形 argmax 不一致：' + pairDiff + '/' + pairJudgeable + ' = ' + pairRate.toFixed(1) + '%**（分母 = 两形都分得开的事件）');
console.log('· 同框地板（两形各自对半分裂，取均值）：**' + floorAvg.toFixed(1) + '%**');
console.log('· 事件内两形秩相关 Kendall τ 均值：**' + (tauSum / Math.max(1, tauN)).toFixed(3) + '**（1=完全同序，0=无关）');
console.log('· 不一致事件里"按 ' + B + ' 人桌选"相对"按 ' + A + ' 人桌选"的 ' + B + ' 人桌收益：**均值 +' + (gainSum / Math.max(1, gainN)).toFixed(1)
  + 'pt `1st%`**（' + gainN + ' 个事件）');
for (const d of pairDetail) {
  console.log('  > `' + d.id + '`（当年训练桌 n=' + d.trainedN + '）：' + A + ' 人选 band' + d.a + '（' + A + ' 人桌 ' + d.av.toFixed(1) + '% ‖ 到 ' + B
    + ' 人桌 ' + d.aOnB.toFixed(1) + '%）→ ' + B + ' 人选 band' + d.b + '（' + d.bv.toFixed(1) + '%）‖ 差 **' + (d.gap >= 0 ? '+' : '') + d.gap.toFixed(1) + 'pt**');
}
console.log('\n· 读法：' + (pairJudgeable < 8 ? '⛔ 事件太少（' + pairJudgeable + '）⇒ 只给方向，不给百分比'
  : pairRate > floorAvg * 1.5 ? '**桌形确实改决定**（不一致率 ' + pairRate.toFixed(1) + '% 明显高于地板 ' + floorAvg.toFixed(1) + '%）⇒ C8 值得做'
    : pairRate > floorAvg ? '不一致率 ' + pairRate.toFixed(1) + '% 只略高于地板 ' + floorAvg.toFixed(1) + '% ⇒ **桌形的贡献与考卷自己的抖动同量级**，不足以付重排/换代成本'
      : '不一致率 ' + pairRate.toFixed(1) + '% ≤ 地板 ' + floorAvg.toFixed(1) + '% ⇒ **桌形不改决定**，C8 可以关'));

/* ---- 5. v1 那一半：降级为背景（它同时改了桌形与度量） ---- */
if (SHOW_V1) {
  let v1j = 0, v1hard = 0;
  for (const e of rows) {
    const ok = e.cands.filter(c => c.byShape[B].every(r => r.first != null));
    if (ok.length < 2) continue;
    const v = ok.map(c => mean(valsAt(c, B)));
    if (Math.max(...v) - Math.min(...v) <= 0) continue;
    const sel = ok.findIndex(c => c.meta.selected === true);
    if (sel < 0) continue;
    v1j++;
    if (topHalf(ok, B, firstHalf) !== sel && topHalf(ok, B, secondHalf) !== sel) v1hard++;
  }
  console.log('\n## 背景（v1：**归因不成立，不许引作 C8 的答案**）档案 `selected`（' + A + ' 人桌 + `fit` 合成分）vs ' + B + ' 人考卷 argmax');
  console.log('· 硬翻案 ' + v1hard + '/' + v1j + ' = ' + (100 * v1hard / Math.max(1, v1j)).toFixed(1)
    + '% —— 这一半**同时改了桌形与度量**（`fit` 不是胜率）⇒ 只说明"两套口径对不太上"，不说明桌形');
}

console.log('\n## 自检');
const badCall = rows.reduce((a, e) => a + e.cands.filter(c => SHAPES.some(n => c.byShape[n].some(r => r.rc !== 0 || r.first == null))).length, 0);
console.log('· 考卷调用 ' + calls + '/' + nCall + ' 次');
if (badCall) console.log('  ⚠ ' + badCall + ' 只候选有至少一次读不出 `1st%` ⇒ 该候选在**所有桌形**上一律排除（只剔一半会让两形分母不同）');
if (pairJudgeable === 0) console.log('  ⛔ 两形都可判的事件 = 0 ⇒ 本节没有结论');
console.log('rc=0');
