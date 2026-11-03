#!/usr/bin/env node
/* evolve-viz-1103.mjs — 2.0 冠军演化可视化生成器（qoder · 11-03）
 * 画的是这两天攒下来的三件事，全部**从盘上的原件读**（不许手敲数字）：
 *   ① 深度曲线：19 条臂 × 逐代 `gen …` 日志（fit）× 每 25 代快照的种数与防御族份额
 *      （`scratch/seg-widths-92.tsv` ‖ `scratch/seg-widths-7.tsv` ‖ 12 局长桌、seed 77000 配对 ⇒ 看趋势可以、单点绝对值不行）
 *   ② 两盆散点：末代的（防御族份额 × fit），点径=种数 ⇒ §十四"宽=弱 / 强=窄"那张图的原始数据版
 *   ③ T1/T2 的判决表：band2 vs band4 的 G4/G5/期望损失（解析 gate-drafts 输出）+ 容差带敏感性（复用同一个纯函数重排）
 * 输出：docs/research/viz/champion-evolution-2026-11-03.html（自包含、无外链、离线可读）
 * 用法：node scratch/evolve-viz-1103.mjs [--out=...]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const known = ['out', 'fragment'];
const bad = argv.filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (bad.length) { console.error('⛔ 不认识的旗标：' + bad.join(' ') + '（只有 --out=）'); process.exit(64); }
const OUT = String(arg('out', 'docs/research/viz/champion-evolution-2026-11-03.html'));
const rd = (p) => (existsSync(ROOT + '/' + p) ? readFileSync(ROOT + '/' + p, 'utf8') : null);
const say = [];

/* ---- ① 快照宽度表（两代分开跑的，合起来才是全部 114 枚；混在一台沙箱里量会互相污染）---- */
const segs = [];
for (const f of ['scratch/seg-widths-92.tsv', 'scratch/seg-widths-7.tsv']) {
  const t = rd(f);
  if (!t) { say.push('⚠ 缺 ' + f + ' ⇒ 先跑 scratch/seg-widths-1103.mjs'); continue; }
  const L = t.trim().split(/\r?\n/);
  const hd = L[0].split('\t');
  for (const ln of L.slice(1)) {
    const c = ln.split('\t');
    const r = {}; hd.forEach((k, i) => { r[k] = c[i]; });
    if (!r.arm || !r.gen) continue;
    segs.push({ arm: r.arm, seg: Number(r.seg), gen: Number(r.gen), fit: Number(r.fit), kinds: Number(r.kinds),
      defShare: Number(r.defShare), defKinds: Number(r.defKinds), cell: r.cell, keys: r.keys, arch: f.includes('-92') ? 92 : 7 });
  }
}
say.push('✔ 快照 ' + segs.length + ' 枚（代 3 = ' + segs.filter((s) => s.arch === 92).length + ' ‖ v7 = ' + segs.filter((s) => s.arch === 7).length + '）');

/* ---- 逐代日志：按臂名在 scratch 与其子目录里找 ---- */
const fixedDirs = ['scratch', 'scratch/qoder-afternoon', 'scratch/qoder-v7repro', 'scratch/qoder-cold', 'scratch/qoder-basin', 'scratch/qoder-t1', 'scratch/night4'];
const findLog = (arm) => {
  for (const d of fixedDirs) if (existsSync(ROOT + '/' + d + '/' + arm + '.log')) return d + '/' + arm + '.log';
  try {
    for (const d of readdirSync(ROOT + '/scratch')) {
      if (existsSync(ROOT + '/scratch/' + d + '/' + arm + '.log')) return 'scratch/' + d + '/' + arm + '.log';
    }
  } catch (e) { /* 目录读不到就算了 */ }
  return null;
};
const arms = {};
for (const s of segs) { arms[s.arm] = arms[s.arm] || { name: s.arm, segs: [], gens: [], arch: s.arch }; arms[s.arm].segs.push(s); }
for (const a of Object.values(arms)) {
  a.segs.sort((x, y) => x.gen - y.gen);
  const lp = findLog(a.name);
  a.log = lp;
  if (!lp) { say.push('⚠ 臂 ' + a.name + ' 没有日志 ⇒ 只画快照点'); continue; }
  for (const ln of (rd(lp) || '').split(/\r?\n/)) {
    const m = /^gen (\d+) bestFit=([\d.-]+) 1st=([\d.]+)% top2=([\d.]+)%.*?出手=(\d+).*?挡=([\d.]+)/.exec(ln);
    if (!m) continue;
    a.gens.push({ gen: Number(m[1]), fit: Number(m[2]), first: Number(m[3]), top2: Number(m[4]), acts: Number(m[5]), guard: Number(m[6]) });
  }
  a.gens.sort((x, y) => x.gen - y.gen);
}
say.push('✔ 臂 ' + Object.keys(arms).length + ' 条 ‖ 有逐代线 ' + Object.values(arms).filter((a) => a.gens.length).length + ' 条');

/* ---- ③ 读数：期望损失 + G5（从 gate-drafts 的原始输出解析，不手敲）---- */
const cmp = rd('scratch/g4-band2-vs-band4-1103.txt') || '';
const cells = {};
const reC = /G4CELLS\[([^\]]+)\] mean=([\d.]+)% 中位=([\d.]+)% 格数=\d+ 输多赢少\(>50%\)=(\d+\/\d+) 最克=(\S+?) ([\d.]+)% n=(\d+)/g;
let mC;
while ((mC = reC.exec(cmp))) cells[mC[1]] = { mean: Number(mC[2]), median: Number(mC[3]), over50: mC[4], worst: mC[5], worstPct: Number(mC[6]), n: Number(mC[7]) };
const g5 = {};
const reG5 = /(FAIL|PASS|UNRUN\S*)\s+G5\[([^\]]+)\][^\n]*?实测防席夺冠 (\d+)%/g;
let mG;
while ((mG = reG5.exec(cmp))) g5[mG[2]] = { st: mG[1], defWin: Number(mG[3]) };
say.push('✔ G4CELLS ' + Object.keys(cells).length + ' 条 ‖ G5 ' + Object.keys(g5).length + ' 条');

/* T1 的容差带敏感性：从臂日志的整池格表重排，**复用当选面那个纯函数**（不在这里重写算术） */
const poolLine = ((rd('scratch/qoder-t1/CBGG-s13.log') || '').match(/\[分格选人\] 整池格表[^：]*：(.*)/) || [])[1] || '';
const pool = [];
const reP = /(D\dK\d)\s+([\d.]+)((?:\[gateOk=false\])?)(\[原当选\])?/g;
let mP;
while ((mP = reP.exec(poolLine))) pool.push({ cell: mP[1], score: Number(mP[2]) / 100, gateOk: !mP[3], wasWinner: !!mP[4] });
let tolScan = [];
if (pool.length) {
  const { gridPickByRarity } = await import(pathToFileURL(ROOT + '/tools/pick-best.mjs').href);
  tolScan = [1, 2, 4, 6, 8, 9, 10, 12].map((tol) => {
    const r = gridPickByRarity(pool.map((e) => Object.assign({}, e)), tol, null);
    return { tol, band: r.band.length, cell: r.pickedCell || '—', count: r.pickedCount, changed: !!r.changedWinner,
      paid: r.best && r.byScore ? Number(((r.byScore.score - r.best.score) * 100).toFixed(1)) : null };
  });
  say.push('✔ T1 整池 ' + pool.length + ' 粒 ‖ 容差带扫 ' + tolScan.length + ' 档');
} else say.push('⚠ CBGG-s13 日志里没整池格表 ⇒ ④ 这张表为空');

const data = { made: new Date().toISOString().slice(0, 16).replace('T', ' '),
  caliber: { games: 12, mode: 'long', seed0: 77000, field: 'scripts', eps: 0, temp: 'soft' },
  arms: Object.values(arms).map((a) => ({ name: a.name, arch: a.arch, log: a.log, gens: a.gens, segs: a.segs })),
  cells: cells, g5: g5, tolScan: tolScan, pool: pool };

const html = `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><title>2.0 冠军演化 · 11-03</title>
<style>
 body{font:14px/1.55 system-ui,"Microsoft YaHei",sans-serif;margin:18px;background:#0f1115;color:#e8eaef}
 h1{font-size:19px;margin:0 0 4px} h2{font-size:15px;margin:0 0 6px;color:#a8c7fa}
 .cal{color:#9aa4b2;font-size:12px} .warn{color:#f2b03a;font-size:12px}
 .wrap{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px}
 .card{background:#161a22;border:1px solid #262c38;border-radius:8px;padding:12px;max-width:470px}
 svg{display:block} .ax{stroke:#3a4250} .lbl{fill:#9aa4b2;font-size:10px}
 .leg{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;margin:10px 0 0}
 .leg button{background:#161a22;border:1px solid #3a4250;color:#e8eaef;border-radius:12px;padding:2px 8px;cursor:pointer;font-size:12px}
 .leg button.off{opacity:.3}
 table{border-collapse:collapse;font-size:12px;width:100%}
 th,td{border-bottom:1px solid #262c38;padding:4px 7px;text-align:right;white-space:nowrap}
 th{color:#9aa4b2;font-weight:600} td.l,th.l{text-align:left}
 .red{color:#ff8a8a} .grn{color:#7fd8a2}
 code{background:#1f2530;padding:1px 4px;border-radius:3px}
</style></head><body>
<h1>2.0 冠军演化 —— 深度 × 宽度 × 两盆</h1>
<div class="cal">数据：11-03 落盘的 <b>每 25 代深度快照</b>（用户提的中途存点，114 枚）+ 各臂逐代 <code>gen</code> 日志 + gate-drafts 的 G4/G5 原始输出 ‖ 生成时刻 ${data.made}</div>
<div class="cal">量具：<code>behavior-profile.fieldProfile</code>（eps=0 · temp=soft · <b>12 局</b> · 桌 = 1 被测 + 4 行一行脚本 · 桌制 <b>long</b> · seed 77000 全员配对）
 ‖ 种数 = 非ジ且份额 ≥0.5% ‖ 防御族 = 引擎 <code>byKey[k].cat === R.CAT.DEFENSE</code></div>
<div class="warn">⚠ 分母只有 12 局：看趋势与配对差可以，<b>单点绝对值不行</b>（0.5% 线在 12 局上约等于"整局打过一次"）。代 3(v:92) 与 v7 两代是<b>分进程</b>量的（arch2 装上摘不掉 ⇒ 混批会污染）。</div>
<div class="leg" id="lg"></div>
<div class="wrap">
 <div class="card"><h2>① 训练目标 fit 随深度</h2><div id="c1"></div><div class="cal">实线 = 逐代日志的 bestFit ‖ 点 = 快照（同一次量具）</div></div>
 <div class="card"><h2>② 种数（宽度）随深度</h2><div id="c2"></div><div class="cal">点描边 = 臂；填充 = 防御族份额档 <span class="grn">D0&lt;0.5%</span> / <span style="color:#7fd8a2">D1&lt;3%</span> / <span style="color:#f2b03a">D2&lt;8%</span> / <span class="red">D3≥8%</span></div></div>
 <div class="card"><h2>③ 末代的两个盆</h2><div id="c3"></div><div class="cal">x = 末代防御族份额 ‖ y = 末代 fit ‖ 点径 = 种数</div></div>
 <div class="card"><h2>④ T1：容差带宽会选谁</h2><div id="tab1"></div></div>
 <div class="card"><h2>⑤ T1 判决 + T2 期望损失（n=300）</h2><div id="tab2"></div></div>
</div>
<script>
const D = ${JSON.stringify(data)};
const PAL = ['#7fd8a2','#a8c7fa','#f2b03a','#ff8a8a','#c586ff','#6ec6c8','#e0a3c7','#b8d17a','#f5a97f','#8ea2ff','#d0d5dd','#7ae0c0','#ff9ecb','#9ecbff','#ffd27a','#c0c7d1','#ff6b6b','#6bf0a1','#a16bff','#d9b8ff'];
const COLOR = {}; D.arms.forEach((a, i) => { COLOR[a.name] = PAL[i % PAL.length]; });
const HID = new Set();
const W = 430, H = 240, PAD = { l: 42, r: 12, t: 12, b: 26 };
const px = (v, max) => PAD.l + (W - PAD.l - PAD.r) * (v / max);
const py = (v, max) => (H - PAD.b) - (H - PAD.b - PAD.t) * (v / max);
function frame(xmax, ymax, xt, yt, xlab, ylab) {
  let s = '<svg width="' + W + '" height="' + H + '" role="img">';
  s += '<line class="ax" x1="' + PAD.l + '" y1="' + (H - PAD.b) + '" x2="' + (W - PAD.r) + '" y2="' + (H - PAD.b) + '"/>';
  s += '<line class="ax" x1="' + PAD.l + '" y1="' + PAD.t + '" x2="' + PAD.l + '" y2="' + (H - PAD.b) + '"/>';
  xt.forEach(function (v) { const x = px(v, xmax); s += '<line class="ax" x1="' + x + '" y1="' + (H - PAD.b) + '" x2="' + x + '" y2="' + (H - PAD.b + 3) + '"/>'; s += '<text class="lbl" x="' + x + '" y="' + (H - PAD.b + 14) + '" text-anchor="middle">' + v + '</text>'; });
  yt.forEach(function (v) { const y = py(v, ymax); s += '<line class="ax" x1="' + (PAD.l - 3) + '" y1="' + y + '" x2="' + PAD.l + '" y2="' + y + '"/>'; s += '<text class="lbl" x="' + (PAD.l - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + v + '</text>'; });
  s += '<text class="lbl" x="' + (W - PAD.r) + '" y="' + (H - 3) + '" text-anchor="end">' + xlab + '</text>';
  s += '<text class="lbl" x="3" y="' + (PAD.t - 2) + '">' + ylab + '</text>';
  return s;
}
function dot(x, y, r, fill, stroke, title) {
  return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="' + (stroke || 'none') + '" stroke-width="1"><title>' + title + '</title></circle>';
}
function drawFit() {
  const xm = 150, ym = 2.0;
  let s = frame(xm, ym, [0, 25, 50, 75, 100, 125, 150], [0, 0.5, 1, 1.5, 2], '代', 'fit');
  D.arms.forEach(function (a) {
    if (HID.has(a.name)) return;
    const pts = a.gens.map(function (g) { return [px(g.gen, xm), py(Math.min(g.fit, ym), ym)]; });
    if (pts.length > 1) s += '<polyline fill="none" stroke="' + COLOR[a.name] + '" stroke-width="1.5" opacity=".8" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    a.segs.forEach(function (g) {
      s += dot(px(g.gen, xm), py(Math.min(g.fit, ym), ym), 2.8, COLOR[a.name], 'none',
        a.name + ' ‖ 第 ' + g.gen + ' 代 ‖ 快照 fit ' + g.fit + ' ‖ 种 ' + g.kinds + ' ‖ 防御族 ' + g.defShare + '%（' + g.cell + '）');
    });
  });
  document.getElementById('c1').innerHTML = s + '</svg>';
}
function drawKinds() {
  const xm = 150, ym = 14;
  const DC = { D0: '#8ea2ff', D1: '#7fd8a2', D2: '#f2b03a', D3: '#ff8a8a' };
  let s = frame(xm, ym, [0, 25, 50, 75, 100, 125, 150], [0, 2, 4, 6, 8, 10, 12, 14], '代', '种数');
  D.arms.forEach(function (a) {
    if (HID.has(a.name)) return;
    a.segs.forEach(function (g) {
      s += dot(px(g.gen, xm), py(Math.min(g.kinds, ym), ym), 4.2, DC[g.cell.slice(0, 2)] || '#888', COLOR[a.name],
        a.name + ' ‖ 第 ' + g.gen + ' 代 ‖ 种 ' + g.kinds + ' ‖ 防御族 ' + g.defShare + '%（防御卡 ' + g.defKinds + ' 种）‖ 格 ' + g.cell + '‖ ' + g.keys);
    });
  });
  document.getElementById('c2').innerHTML = s + '</svg>';
}
function drawEnds() {
  const xm = 80, ym = 2.0;
  let s = frame(xm, ym, [0, 10, 20, 30, 40, 50, 60, 70, 80], [0, 0.5, 1, 1.5, 2], '末代防御族份额 %', 'fit');
  D.arms.forEach(function (a) {
    if (HID.has(a.name)) return;
    const last = a.segs[a.segs.length - 1]; if (!last) return;
    const x = px(Math.min(last.defShare, xm), xm), y = py(Math.min(last.fit, ym), ym);
    s += dot(x, y, 4 + last.kinds * 0.85, COLOR[a.name], COLOR[a.name],
      a.name + ' ‖ ' + (a.arch === 92 ? '代 3(v:92)' : 'v7 路径') + ' ‖ 末代第 ' + last.gen + ' 代 ‖ fit ' + last.fit + ' ‖ 种 ' + last.kinds + ' ‖ 防御族 ' + last.defShare + '%');
    s += '<text class="lbl" x="' + (x + 8) + '" y="' + (y - 6) + '">' + a.name + '</text>';
  });
  document.getElementById('c3').innerHTML = s + '</svg>'
    + '<div class="cal">读法：左上 = 壁盆（防御族高、fit 低、种数多）‖ 右下 = 强盆（防御族≈0、fit 高）‖ 两盆在 150+150 代内不连通（§十五）。<b>点径 = 种数</b>。</div>';
}
function legend() {
  document.getElementById('lg').innerHTML = D.arms.map(function (a) {
    return '<button data-a="' + a.name + '"><span style="color:' + COLOR[a.name] + '">●</span> ' + a.name + '（' + (a.arch === 92 ? 'v:92' : 'v7') + '）</button>';
  }).join('');
  document.querySelectorAll('#lg button').forEach(function (b) {
    b.onclick = function () { const n = b.dataset.a; if (HID.has(n)) { HID.delete(n); b.classList.remove('off'); } else { HID.add(n); b.classList.add('off'); } drawAll(); };
  });
}
function drawAll() { drawFit(); drawKinds(); drawEnds(); }
document.getElementById('tab1').innerHTML = D.tolScan.length
  ? ('<table><tr><th class="l">容差带 pt</th><th>带内</th><th class="l">选中格</th><th>该格池内几粒</th><th class="l">换人?</th><th>付的分差 pt</th></tr>'
    + D.tolScan.map(function (r) {
        return '<tr><td class="l">' + r.tol + '</td><td>' + r.band + '</td><td class="l">' + r.cell + '</td><td>' + r.count
          + '</td><td class="l ' + (r.changed ? 'red' : '') + '">' + (r.changed ? '换' : '不换') + '</td><td>' + (r.paid === null ? '—' : r.paid) + '</td></tr>';
      }).join('') + '</table>'
    + '<div class="cal">整池格表（重验分）：' + D.pool.map(function (p) { return p.cell + ' ' + Math.round(p.score * 1000) / 10 + (p.wasWinner ? '[原当选]' : ''); }).join(' ‖ ') + '</div>'
    + '<div class="warn">⚑ 8↔9pt 之间只差 0.1pt 的带线，而同一次输出的噪声尺是「同分带 2.9pt ‖ 候选自身极差 4.4~7.9pt」⇒ 别把"几 pt 有效"当结论；能说的是这一池里"宽"与"分高"隔着 8.1pt。</div>')
  : '<div class="warn">（无整池格表 ⇒ 这一臂没开这根键）</div>';
const ORDER = ['线上包/long', '线上包/multi', 'scratch/ga-bands/CBG-s13/CBG-s13-band2/long', 'scratch/ga-bands/CBG-s13/CBG-s13-band2/multi', 'scratch/ga-bands/CBG-s13/CBG-s13-band4/long', 'scratch/ga-bands/CBG-s13/CBG-s13-band4/multi'];
const short = function (k) { return k.replace('scratch/ga-bands/CBG-s13/CBG-s13-', ''); };
const rowsT = ORDER.filter(function (k) { return D.cells[k]; });
document.getElementById('tab2').innerHTML = rowsT.length
  ? ('<table><tr><th class="l">格（包/桌制）</th><th>期望损失 mean %</th><th>中位 %</th><th>&gt;50% 的格</th><th class="l">最克那一格</th><th>max %</th><th class="l">G5 防席夺冠</th></tr>'
    + rowsT.map(function (k) {
        const c = D.cells[k], g = D.g5[k];
        return '<tr><td class="l">' + short(k) + '</td><td>' + c.mean + '</td><td>' + c.median + '</td><td>' + c.over50 + '</td>'
          + '<td class="l">' + c.worst + '</td><td class="' + (c.worstPct > 60 ? 'red' : 'grn') + '">' + c.worstPct + '</td>'
          + '<td class="l">' + (g ? g.defWin + '%（' + (g.st === 'PASS' ? '过' : '红') + '）' : '—') + '</td></tr>';
      }).join('') + '</table>'
    + '<div class="cal">band2 = 今天实际当选的那粒（8 种 ‖ 防御族 0.6%）‖ band4 = 容差带 ≥9pt 时格分会挑上的宽粒（10 种 ‖ 防御族 4.5%）。n = ' + (D.cells[rowsT[0]] || {}).n + ' 局/格。</div>'
    + '<div class="cal"><b>判决</b>：band4 的"到处都克它"轻得多（中位 78.0→27.3、六格→三格），但 G4 的 max 仍 99.3%（两枚都红），而它<b>破不了龟</b>（G5 multi 74%→95%）⇒ 买的是平均韧性，卖的是收场能力。</div>')
  : '<div class="warn">（没解析到 G4CELLS 行 ⇒ 先跑 gate-drafts 并落盘）</div>';
legend();
drawAll();
</script>
</body></html>`;

const outAbs = ROOT + '/' + OUT;
mkdirSync(path.dirname(outAbs), { recursive: true });
writeFileSync(outAbs, html, 'utf8');
/* 同一份内容再出一个**片段**（去掉 doctype/head/body 壳）⇒ 会话内可视化只吃片段，两处不许各写一遍逻辑 */
const FRAG = arg('fragment', '');
if (FRAG) {
  /* 片段 = `<style>` 那一块 + `<body>` 里的内容（会话内可视化不吃 `<html>/<head>/<body>` 壳：17:41 实测被校验器判 invalid） */
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>') + 8);
  const bodyInner = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  const frag = style + bodyInner;
  mkdirSync(path.dirname(FRAG), { recursive: true });
  writeFileSync(FRAG, frag, 'utf8');
  console.log('✔ 片段版 ' + FRAG + '（' + (frag.length / 1024).toFixed(1) + ' KB ‖ 含壳标签=' + /<(html|head|body)\b/.test(frag) + '）');
}
console.log(say.join('\n'));
console.log('✔ 已写 ' + OUT + '（' + (html.length / 1024).toFixed(1) + ' KB ‖ 内嵌数据 ' + JSON.stringify(data).length + ' B）');
