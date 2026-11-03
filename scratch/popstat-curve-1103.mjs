#!/usr/bin/env node
/* popstat-curve-1103.mjs — 把 #46 的逐代种群统计画成"argmax vs 种群"两条线，并**量化两者的抖**（qoder · 11-03 晚）
 * 要回答的是用户看图后的追问：训练里"风格在两头反复横跳"到底是搜索真的在来回，还是**只记最优一枚**造成的假象。
 *   ① 逐代的 `挡 blockPerGame`（防御族剂量，引擎口径）与 `广 varietyMaxEv` 三条线：当世代最优 / top-3 均值 / 全种群均值
 *   ② 抖的度量：**变号率**（相邻两代差值的符号翻转比例，随机游走 ≈0.5）与**平均步长**（|Δ|）——分别对三条线算
 *   ③ 最优与种群均值的距离：有多少代 `|最优 − 种群均值| > 种群标准差`（⇒ 那一代的"最优"是个离群粒）
 * 读数全从 JSONL 取，不重跑对局。用法：node scratch/popstat-curve-1103.mjs [--in=scratch/popstat/PS-CBG-s13.jsonl,scratch/popstat/PS-V7M-s13.jsonl] [--out=...]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const known = ['in', 'out'];
const bad = process.argv.slice(2).filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (bad.length) { console.error('⛔ 不认识的旗标：' + bad.join(' ') + '（只有 --in= --out=）'); process.exit(64); }
const OUT = arg('out', 'docs/research/viz/popstat-vs-argmax-2026-11-03.html');
const FILES = String(arg('in', 'scratch/popstat/PS-CBG-s13.jsonl,scratch/popstat/PS-V7M-s13.jsonl')).split(',').map((s) => s.trim()).filter(Boolean);

const series = (rows, pick) => rows.map(pick).filter((v) => typeof v === 'number' && isFinite(v));
function jitter(v) {
  if (v.length < 3) return { n: v.length, signFlip: null, meanStep: null };
  const d = []; for (let i = 1; i < v.length; i++) d.push(v[i] - v[i - 1]);
  let flip = 0, cnt = 0;
  for (let i = 1; i < d.length; i++) { if (d[i - 1] === 0 && d[i] === 0) continue; if (d[i - 1] * d[i] < 0) flip++; cnt++; }
  return { n: v.length, signFlip: cnt ? +(flip / cnt).toFixed(3) : null, meanStep: +(d.reduce((s, x) => s + Math.abs(x), 0) / d.length).toFixed(4) };
}
const arms = [];
for (const f of FILES) {
  const p = existsSync(f) ? f : join(ROOT, f);
  if (!existsSync(p)) { console.error('⚠ 读不到 ' + f + '（先跑臂）'); continue; }
  const rows = readFileSync(p, 'utf8').trim().split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean)
    .filter((r) => !r.type);
  if (!rows.length) { console.error('⚠ ' + f + ' 里没有逐代行'); continue; }
  const best = series(rows, (r) => r.block && r.block.best);
  const topk = series(rows, (r) => r.block && r.block.topK && r.block.topK.mean);
  const pop = series(rows, (r) => r.block && r.block.pop && r.block.pop.mean);
  const vb = series(rows, (r) => r.variety && r.variety.best);
  const vp = series(rows, (r) => r.variety && r.variety.pop && r.variety.pop.mean);
  let outlier = 0, otot = 0;
  /* **同一个体在两代被重测**（精英保留 ⇒ 权重一字不变，但每代评估换种子重打）⇒ 这一批 |Δ| 就是"训练内部的重测噪声"，
   *   它是判"逐代折线到底在量什么"的分母：如果重测噪声 ≥ 种群均值的逐代变化，那逐代的线基本在画噪声。 */
  const rep = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = new Map(rows[i - 1].indiv.map((q) => [q.wid, q.blk]));
    for (const q of rows[i].indiv) {
      const a = prev.get(q.wid);
      if (typeof a === 'number' && typeof q.blk === 'number') rep.push(Math.abs(q.blk - a));
    }
  }
  rep.sort(function (x, y) { return x - y; });
  const qv = function (arr, p) { return arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null; };
  const popStep = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].block && rows[i - 1].block.pop && rows[i - 1].block.pop.mean;
    const b = rows[i].block && rows[i].block.pop && rows[i].block.pop.mean;
    if (typeof a === 'number' && typeof b === 'number') popStep.push(Math.abs(b - a));
  }
  popStep.sort(function (x, y) { return x - y; });
  const repMed = qv(rep, 0.5), popMed = qv(popStep, 0.5);
  for (const r of rows) {
    const b = r.block && r.block.best, m = r.block && r.block.pop && r.block.pop.mean, sd = r.block && r.block.pop && r.block.pop.n;
    if (b === null || b === undefined || m === null || m === undefined || !sd) continue;
    const vals = rows.length ? (r.indiv || []).map((q) => q.blk).filter((q) => typeof q === 'number') : [];
    if (vals.length < 2) continue;
    const mu = vals.reduce((s, x) => s + x, 0) / vals.length;
    const s2 = Math.sqrt(vals.reduce((s, x) => s + (x - mu) ** 2, 0) / (vals.length - 1));
    otot++; if (s2 > 0 && Math.abs(b - mu) > s2) outlier++;
  }
  arms.push({ file: f.replace(/^.*[\\/]/, '').replace('.jsonl', ''), gens: rows.length,
    block: { best: jitter(best), topK: jitter(topk), pop: jitter(pop) },
    variety: { best: jitter(vb), pop: jitter(vp) },
    lastBest: best.length ? best[best.length - 1] : null, lastPop: pop.length ? pop[pop.length - 1] : null,
    outlierPct: otot ? +(100 * outlier / otot).toFixed(1) : null,
    noise: { n: rep.length, repMed: repMed === null ? null : +repMed.toFixed(4), repP90: qv(rep, 0.9) === null ? null : +qv(rep, 0.9).toFixed(4),
      popMed: popMed === null ? null : +popMed.toFixed(4), ratio: (repMed && popMed) ? +(repMed / popMed).toFixed(2) : null },
    rows: rows.map((r) => ({ gen: r.gen, sigma: r.sigma, best: r.block && r.block.best, topk: r.block && r.block.topK && r.block.topK.mean,
      pop: r.block && r.block.pop && r.block.pop.mean, pn: r.block && r.block.pop && r.block.pop.n,
      vbest: r.variety && r.variety.best, vpop: r.variety && r.variety.pop && r.variety.pop.mean })) });
}
if (!arms.length) { console.error('⛔ 一份 JSONL 都没读到 ⇒ 没东西可画（不写空页）'); process.exit(2); }

const html = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>#46 argmax vs 种群统计 · 11-03</title><style>' +
 'body{font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;margin:16px;background:#0e1014;color:#e8eaef}' +
 'h1{font-size:18px;margin:0 0 6px} h2{font-size:14px;margin:16px 0 4px;color:#a8c7fa}' +
 '.cal{color:#9aa4b2;font-size:12px;max-width:1150px} .warn{color:#f2b03a;font-size:12px;max-width:1150px}' +
 '.card{background:#161a22;border:1px solid #262c38;border-radius:8px;padding:10px;margin:10px 0;display:inline-block;vertical-align:top}' +
 'table{border-collapse:collapse;font-size:12px} th,td{border-bottom:1px solid #262c38;padding:3px 7px;text-align:right}' +
 'th{color:#9aa4b2;font-weight:600} td.l,th.l{text-align:left} .red{color:#ff8a8a} .grn{color:#7fd8a2}' +
 'code{background:#1f2530;padding:1px 4px;border-radius:3px}</style></head><body>' +
 '<h1>逐代记录"最优一枚" vs "整个种群" —— 横跳有多少是记录方式造成的</h1>' +
 '<div class=cal>数据 = <code>EPIRUS_POPSTAT=1</code> 落的逐代 JSONL（零额外对局：挡 <code>blockPerGame</code> 与广 <code>varietyMaxEv</code> 本来就是逐个体算的）‖ ' +
 '配方与今天那两条臂逐字同（同 seed 同起点包 150×5P×pop8×games8），所以这三条线描述的就是**同一条搜索轨迹**。</div>' +
 arms.map((a) => {
  const W = 640, H = 220, PAD = { l: 46, r: 12, t: 12, b: 24 };
  const vals = [];
  a.rows.forEach((r) => { [r.best, r.topk, r.pop].forEach((v) => { if (typeof v === 'number') vals.push(v); }); });
  const ymax = Math.max.apply(null, vals.concat([0.001])) * 1.08;
  const xmax = a.gens;
  const X = (g) => PAD.l + (W - PAD.l - PAD.r) * (g / xmax);
  const Y = (v) => (H - PAD.b) - (H - PAD.b - PAD.t) * (v / ymax);
  const line = (key, color, w, dash) => {
    const pts = a.rows.filter((r) => typeof r[key] === 'number').map((r) => X(r.gen).toFixed(1) + ',' + Y(r[key]).toFixed(1));
    return pts.length > 1 ? '<polyline fill="none" stroke="' + color + '" stroke-width="' + w + '" ' + (dash ? 'stroke-dasharray="4 3" ' : '') + 'points="' + pts.join(' ') + '"/>' : '';
  };
  let svg = '<svg width=' + W + ' height=' + H + '><line x1=' + PAD.l + ' y1=' + (H - PAD.b) + ' x2=' + (W - PAD.r) + ' y2=' + (H - PAD.b) + ' stroke="#3a4250"/>' +
    '<line x1=' + PAD.l + ' y1=' + PAD.t + ' x2=' + PAD.l + ' y2=' + (H - PAD.b) + ' stroke="#3a4250"/>';
  for (let g = 0; g <= xmax; g += 25) svg += '<text x=' + X(g) + ' y=' + (H - 8) + ' fill="#9aa4b2" font-size=10 text-anchor=middle>' + g + '</text>';
  for (let j = 0; j <= 4; j++) { const v = ymax * j / 4; svg += '<text x=' + (PAD.l - 5) + ' y=' + (Y(v) + 3) + ' fill="#9aa4b2" font-size=10 text-anchor=end>' + v.toFixed(2) + '</text>'; }
  svg += line('pop', '#7fd8a2', 2.2) + line('topk', '#a8c7fa', 1.6) + line('best', '#ff8a8a', 1.1, true) + '</svg>';
  return '<div class="card"><h2>' + a.file + ' ‖ ' + a.gens + ' 代 ‖ 末代：最优 ' + (a.lastBest === null ? '?' : a.lastBest) + ' / 种群均值 ' + (a.lastPop === null ? '?' : a.lastPop) + '</h2>' + svg +
    '<div class=cal>红虚线 = 当世代<strong>最优那一枚</strong>（今天所有折线与存段用的就是它）‖ 蓝 = top-3 均值 ‖ 绿 = <strong>全种群均值</strong>（n=' + (a.rows[a.rows.length - 1].pn || '?') + '）</div>' +
    '<table><tr><th class=l>线</th><th>变号率(随机游走≈0.5)</th><th>平均步长|Δ|</th><th>样本代数</th></tr>' +
    '<tr><td class=l>挡 · 最优一枚</td><td class=red>' + (a.block.best.signFlip === null ? 'n/a' : a.block.best.signFlip) + '</td><td>' + a.block.best.meanStep + '</td><td>' + a.block.best.n + '</td></tr>' +
    '<tr><td class=l>挡 · top-3 均值</td><td>' + (a.block.topK.signFlip === null ? 'n/a' : a.block.topK.signFlip) + '</td><td>' + a.block.topK.meanStep + '</td><td>' + a.block.topK.n + '</td></tr>' +
    '<tr><td class=l>挡 · 种群均值</td><td class=grn>' + (a.block.pop.signFlip === null ? 'n/a' : a.block.pop.signFlip) + '</td><td>' + a.block.pop.meanStep + '</td><td>' + a.block.pop.n + '</td></tr>' +
    '<tr><td class=l>广 · 最优 vs 种群（变号率）</td><td colspan=2>' + (a.variety.best.signFlip === null ? 'n/a' : a.variety.best.signFlip) + ' / ' + (a.variety.pop.signFlip === null ? 'n/a' : a.variety.pop.signFlip) + '</td><td>' + a.variety.best.n + '</td></tr>' +
    '<tr><td class=l>最优离种群均值 &gt;1σ 的代数</td><td colspan=3>' + (a.outlierPct === null ? 'n/a' : a.outlierPct + '%') + '</td></tr>' +
    '<tr><td class=l><strong>同一个体隔一代重测</strong> |Δ挡|（=训练内部噪声）</td><td colspan=2 class=red>' + (a.noise.repMed === null ? 'n/a' : a.noise.repMed) + ' 中位（P90 ' + (a.noise.repP90 === null ? '?' : a.noise.repP90) + ' ‖ n=' + a.noise.n + '）</td><td>种群均值步长 ' + (a.noise.popMed === null ? '?' : a.noise.popMed) + '</td><td>比值 <b>' + (a.noise.ratio === null ? '?' : a.noise.ratio) + '</b></td></tr></table>' +
    (a.noise.ratio && a.noise.ratio > 0.7
      ? '<div class=warn>⇒ 逐代的 <code>挡</code> 读数<strong>是噪声主导的</strong>：同一枚权重隔一代重测的变化（中位 ' + a.noise.repMed + '）比整个种群的逐代移动（' + a.noise.popMed + '）还大 ' + a.noise.ratio + ' 倍。每代只打 8 局且换种子 ⇒ "谁最优"与"它这代用了多少防御"都在抽签。</div>'
      : '<div class=cal>⇒ 重测噪声小于种群逐代移动 ⇒ 这条逐代线读得出真变化。</div>') + '</div>';
 }).join('') +
 '<div class=warn>读法：如果<strong>红虚线变号率高、绿线低</strong> ⇒ "横跳"里有一大块是<strong>记录方式</strong>造成的（每代只取带噪 argmax，pop=8 × 8 局/代 ⇒ 排名本身在抖）；' +
 '如果两条都高 ⇒ 是搜索真在来回。<strong>两者都对得上时</strong>才回到 §十九 的机制（行为步长 &gt; 该方向选择梯度 + 两端吸收角）。</div>' +
 '</body></html>';
const outAbs = OUT.indexOf('/') < 0 ? join(HERE, OUT) : join(ROOT, OUT);
mkdirSync(dirname(outAbs), { recursive: true });
writeFileSync(outAbs, html, 'utf8');
console.log(arms.map((a) => a.file + '：' + a.gens + ' 代 ‖ 挡 变号率 最优=' + a.block.best.signFlip + ' top3=' + a.block.topK.signFlip + ' 种群=' + a.block.pop.signFlip +
  ' ‖ 平均步长 ' + a.block.best.meanStep + ' vs ' + a.block.pop.meanStep + ' ‖ 最优离群 ' + a.outlierPct + '%' +
  ' ‖ 同体重测|Δ|中位 ' + a.noise.repMed + ' vs 种群步长 ' + a.noise.popMed + ' ⇒ 噪声/信号 = ' + a.noise.ratio).join('\n'));
console.log('✔ 已写 ' + OUT + '（' + (html.length / 1024).toFixed(1) + ' KB）');
