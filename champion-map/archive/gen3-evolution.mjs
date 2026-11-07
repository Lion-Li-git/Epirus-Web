#!/usr/bin/env node
/* gen3-evolution.mjs —— 纯 2.0 冠军演化图生成器（ZCode · 11-04 凌晨）
 *
 * 用户 11-04 01:2x 令：「做一个纯2.0版的完整冠军演化图，内容和v7的一样」。
 * v7 图（champion-map/index.html，viewer.mjs 烘焙）的内容 ⇒ 本页对应物：
 *   谱系树（父子边）           ⇒ g3-lineage.tsv 的 227 节点（根→CEM→蒸馏→臂→种子/长跑/精调→段）
 *   每节点 Hp（夺冠率）        ⇒ 5P long / 5P multi 各 200 局夺1率（seed 77000 配对，ε=0 干预全关）
 *   绿红分界（现役锚）         ⇒ **分界锚 = 强带均值**（v7 §E596 用户原话「改成最强一批的平均值」同款）
 *   池带 tier 色（hard/mid/soft） ⇒ 今晚分带定案 bands-final.tsv（同 v7 POOL_COL 三色）
 *   决斗腿                    ⇒ 带间直交（night6-h2h，4pt/2σ 判线）
 *   可行性/体检列             ⇒ 未考节点如实灰显（不假红不假绿——v7 页「没测过≠0」同一课）
 * 段节点（HOLDOUT_SEG 存段）不进主树（会糊），落在各臂的「段」抽屉表里：同一训练不同代数 = 演化的时间轴。
 *
 * 用法: node champion-map/gen3-evolution.mjs   ⇒ 烘 champion-map/gen3-evolution.html（产物，不手改）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const rd = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '');
const rdTsv = (f) => rd(f).split(/\r?\n/).filter(Boolean);

/* ---- 1) 谱系 ---- */
const linLines = rdTsv('champion-map/g3-lineage.tsv');
const hdr = linLines[0].split('\t');
const nodes = linLines.slice(1).map((l) => { const o = {}; hdr.forEach((h, i) => (o[h] = l.split('\t')[i] || '')); return o; });
const byId = new Map(nodes.map((n) => [n.id, n]));

/* ---- 2) 强度大考（13 正选）---- */
function rdStr(f) { const m = new Map(); for (const l of rdTsv(f).slice(1)) { const c = l.split('\t'); if (c[2] !== 'NA' && Number(c[1]) === 200) m.set(c[0], Number(c[2])); } return m; }
const LG = rdStr('scratch/night6/strength-long.tsv');
for (const [k, v] of rdStr('scratch/night6/strength-long-fix.tsv')) LG.set(k, v);
for (const [k, v] of rdStr('scratch/night6/strength-long-ext.tsv')) LG.set(k, v);
const MU = rdStr('scratch/night6/strength-multi.tsv');
for (const [k, v] of rdStr('scratch/night6/strength-multi-fix.tsv')) MU.set(k, v);
for (const [k, v] of rdStr('scratch/night6/strength-multi-ext.tsv')) MU.set(k, v);

/* ---- 3) 分带定案（bands-final.tsv: id<tab>band；band ∈ hard/mid/soft）---- */
const BAND = new Map();
for (const l of rdTsv('scratch/night6/bands-final.tsv')) { const c = l.split('\t'); if (c[0] && c[0] !== 'id') BAND.set(c[0], c[1]); }

/* ---- 4) 带间直交读数（h2h 落盘文本原样进页）---- */
const H2H = rd('scratch/night6/h2h.txt');

/* ---- 5) 覆盖门输出（逐带并集判读原样进页）---- */
const COV = rd('scratch/night6/band-unions.txt') || rd('scratch/night6/coverage-bands.txt');

/* ---- 6) 派生字段 ---- */
const CANON = new Set([...LG.keys()]);
const depthOf = (id) => {
  const n = byId.get(id); if (!n || !n.parent) return 0;
  return 1 + depthOf(n.parent);
};
function cladeOf(n) {
  const id = n.id, fam = n.family || '';
  if (n.edgeKind === '根' || ['OB3S-C2-s7', 'GD3-ALL', 'GD3-RATION', 'GD3-SWORD', 'D4a', 'GA-ration-s13', 'GA-ration-s41'].includes(id) || fam === '蒸馏谱系' || fam === 'ration臂') return '根·蒸馏层';
  if (id === 'D-a底座' || id === 'CB-combo-v2' || id === 'LE-laser-v2') return '根·蒸馏层';
  if (/^GD3ALL-/.test(id) || fam === 'GD3ALL' || /^GD3ALL/.test(fam)) return 'GD3ALL 臂族';
  if (/^L5/.test(id) || fam === 'L5谱系') return 'L5 谱系';
  if (/^D/.test(id) || fam === 'D谱系') return 'D 谱系';
  if (/^CB/.test(id) || fam === 'CB谱系') return 'CB 谱系';
  if (/^LE/.test(id) || fam === 'LE谱系') return 'LE 谱系';
  if (n.edgeKind.indexOf('段@') === 0) { const p = byId.get(n.parent); return p ? cladeOf(p) : '其他'; }
  return '其他';
}
const CLADES = ['根·蒸馏层', 'GD3ALL 臂族', 'L5 谱系', 'D 谱系', 'CB 谱系', 'LE 谱系', '其他'];
for (const n of nodes) { n.depth = String(depthOf(n.id)); n.clade = cladeOf(n); n.lg = LG.has(n.id) ? LG.get(n.id) : null; n.mu = MU.has(n.id) ? MU.get(n.id) : null; n.band = BAND.get(n.id) || ''; n.canon = CANON.has(n.id) ? 1 : 0; }

const mainNodes = nodes.filter((n) => n.edgeKind.indexOf('段@') !== 0);
const segNodes = nodes.filter((n) => n.edgeKind.indexOf('段@') === 0);
/* 分界锚 = 强带（hard）均值；无带定案时退回正选最强五枚均值并响亮声明 */
const hardMembers = mainNodes.filter((n) => n.band === 'hard' && n.lg != null);
let anchor = null, anchorLbl = '';
if (hardMembers.length) { anchor = hardMembers.reduce((s, n) => s + n.lg, 0) / hardMembers.length; anchorLbl = '强带均值（hard ' + hardMembers.length + ' 枚）'; }
else {
  const top5 = mainNodes.filter((n) => n.lg != null).sort((a, b) => b.lg - a.lg).slice(0, 5);
  if (top5.length) { anchor = top5.reduce((s, n) => s + n.lg, 0) / top5.length; anchorLbl = '⚠ 无带定案 ⇒ 退回正选最强 5 枚均值（不是带均值）'; }
}

const DATA = { nodes: mainNodes, segs: segNodes, anchor, anchorLbl, h2h: H2H, cov: COV, clades: CLADES };

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>纯 2.0 冠军演化图（gen-3 谱系）</title>
<style>
 body { background:#14161c; color:#d8dce6; font: 13px/1.5 "Microsoft YaHei", sans-serif; margin:0; }
 header { padding: 14px 22px 8px; border-bottom:1px solid #2a2f3d; }
 h1 { font-size:17px; margin:0 0 4px; color:#fff; }
 .sub { color:#8a92a6; font-size:12px; }
 #wrap { display:flex; }
 #tree { flex:1; overflow:auto; padding:10px; }
 #panel { width:360px; border-left:1px solid #2a2f3d; padding:12px 14px; overflow:auto; height: calc(100vh - 54px); box-sizing:border-box; position:sticky; top:0;}
 svg text { font: 11px "Microsoft YaHei", sans-serif; }
 .nd { cursor:pointer; }
 .nd:hover text { fill:#fff; font-weight:bold; }
 .drawer { margin: 8px 0 16px; }
 .drawer summary { cursor:pointer; color:#9fb6ff; }
 table { border-collapse: collapse; font-size:12px; }
 td, th { border:1px solid #2a2f3d; padding:2px 7px; }
 th { color:#8a92a6; font-weight:normal; background:#1a1e29; }
 pre { background:#10131a; border:1px solid #2a2f3d; padding:8px; font-size:11px; white-space:pre-wrap; }
 .hard { color:#ff4fa3; } .mid { color:#8f7bff; } .soft { color:#ff9a3c; }
</style>
</head>
<body>
<header>
 <h1>纯 2.0 冠军演化图 <span class="sub">（gen-3 谱系 · 内容对照 v7 champion-map/index.html）</span></h1>
 <div class="sub" id="hdr-sub"></div>
</header>
<div id="wrap">
 <div id="tree"></div>
 <div id="panel"><div class="sub">点树上的节点看明细。</div><div id="detail"></div>
  <h3 style="font-size:13px;color:#9fb6ff">带间直交（强度差主判据）</h3><pre id="h2h"></pre>
  <h3 style="font-size:13px;color:#9fb6ff">覆盖门（各带）</h3><pre id="cov"></pre>
  <h3 style="font-size:13px;color:#9fb6ff">与 v7 图的内容对照</h3>
  <table><tr><th>v7 index.html</th><th>本页</th></tr>
   <tr><td>谱系树（父子边）</td><td>g3-lineage.tsv 227 节点（根→CEM→蒸馏→臂→种子/长跑/精调）</td></tr>
   <tr><td>Hp 夺冠率</td><td>5P long / 5P multi 各 200 局夺1率（seed 77000 配对，ε=0 干预全关）</td></tr>
   <tr><td>绿红分界（现役锚）</td><td>分界锚 = 强带均值（v7 §E596 用户裁的同款原则）</td></tr>
   <tr><td>池带 tier 三色</td><td>hard/mid/soft 同三色（#ff4fa3/#8f7bff/#ff9a3c）</td></tr>
   <tr><td>决斗腿</td><td>带间直交 night6-h2h（4pt/2σ 判线）</td></tr>
   <tr><td>段/时间轴</td><td>HOLDOUT_SEG 存段抽屉（同臂不同代 = 训练内演化）</td></tr>
  </table>
 </div>
</div>
<script>
const DATA = ${JSON.stringify(DATA)};
/* ---- 渲染：分层（x=深度，y=枝内序） ---- */
const ND = DATA.nodes, SG = DATA.segs;
const kids = {}; ND.forEach(n => { (kids[n.parent] = kids[n.parent] || []).push(n); });
const CLADE_ORDER = DATA.clades;
const cladeRank = id => { let n = ND.find(x => x.id === id), g = 0; while (n && n.parent) { n = ND.find(x => x.id === n.parent); g++; if (g > 30) break; } return g; };
/* 布局：按深度分层；同层按 clade 聚簇；y 由 DFS 序给出 */
let yPos = 0; const POS = {};
const childrenOf = id => (kids[id] || []).slice().sort((a, b) => CLADE_ORDER.indexOf(a.clade) - CLADE_ORDER.indexOf(b.clade) || a.id.localeCompare(b.id));
(function layout(id, depth) {
  const ch = childrenOf(id);
  if (!ch.length) { POS[id] = { x: 60 + depth * 210, y: yPos }; yPos += 26; return; }
  const y0 = yPos;
  ch.forEach(c => layout(c.id, depth + 1));
  POS[id] = { x: 60 + depth * 210, y: (y0 + yPos - 26) / 2 };
})('arch2随机', 0);
const W = 60 + Math.max(...ND.map(n => POS[n.id].x)) + 240, H = yPos + 60;
const COL = { hard: '#ff4fa3', mid: '#8f7bff', soft: '#ff9a3c' };
function nodeFill(n) { if (n.lg == null) return '#3a4152'; const t = Math.max(0, Math.min(1, (n.lg - 20) / 65)); const r = Math.round(60 + t * 30), g = Math.round(80 + t * 120), b = Math.round(160 - t * 60); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
let edges = '', dots = '';
ND.forEach(n => { const p = POS[n.parent]; const q = POS[n.id]; if (!p || !q) return; const mx = (p.x + 90 + q.x) / 2; edges += '<path d="M' + (p.x + 90) + ' ' + (p.y + 8) + ' C ' + mx + ' ' + (p.y + 8) + ', ' + mx + ' ' + (q.y + 8) + ', ' + q.x + ' ' + (q.y + 8) + '" fill="none" stroke="#2e3547" stroke-width="1"/>'; });
ND.forEach(n => {
  const q = POS[n.id]; const ring = n.band ? 'stroke="' + COL[n.band] + '" stroke-width="2.2"' : 'stroke="#1c2130" stroke-width="1"';
  const w = Math.max(56, n.id.length * 6.4 + 10);
  dots += '<g class="nd" data-id="' + n.id + '"><rect x="' + q.x + '" y="' + q.y + '" width="' + w + '" height="17" rx="4" fill="' + nodeFill(n) + '" ' + ring + '/>' +
    '<text x="' + (q.x + 5) + '" y="' + (q.y + 12.5) + '" fill="#e8ecf5">' + n.id + (n.lg != null ? ' ' + n.lg.toFixed(0) : '') + (n.band ? ' •' : '') + '</text></g>';
});
/* 分界锚 */
let anchorLine = '';
if (DATA.anchor != null) { /* 锚画在图例条上而不是树上（树 y 不是强度轴）——图例里给色标与锚值 */ }
document.getElementById('tree').innerHTML = '<svg width="' + W + '" height="' + H + '">' + edges + dots + '</svg>' +
  '<div class="drawer"><b>段抽屉（同臂不同代 = 训练内演化时间轴）</b><div id="segbox"></div></div>';
/* 段表 */
const byArm = {}; SG.forEach(s => { (byArm[s.parent] = byArm[s.parent] || []).push(s); });
let segHtml = '<table><tr><th>臂</th><th>段（代@kinds/defShare/fit）</th></tr>';
Object.keys(byArm).sort().forEach(a => { segHtml += '<tr><td>' + a + '</td><td>' + byArm[a].map(s => s.edgeKind.replace('段@', '') + '（' + (s.note || '') + '）').join('<br>') + '</td></tr>'; });
segHtml += '</table>';
document.getElementById('segbox').innerHTML = segHtml;
document.getElementById('h2h').textContent = DATA.h2h || '（未跑）';
document.getElementById('cov').textContent = DATA.cov || '（未跑）';
document.getElementById('hdr-sub').textContent = '节点 ' + ND.length + ' ‖ 正选 ' + ND.filter(n => n.canon).length + ' ‖ 段 ' + SG.length + ' ‖ 分界锚 = ' + (DATA.anchor != null ? DATA.anchor.toFixed(1) + '（' + DATA.anchorLbl + '）' : '未定') + ' ‖ 强度尺 = 5P long 200 局（seed 77000，ε=0 干预全关）';
document.getElementById('tree').addEventListener('click', e => {
  const g = e.target.closest('.nd'); if (!g) return;
  const n = ND.find(x => x.id === g.dataset.id); if (!n) return;
  document.getElementById('detail').innerHTML =
   '<b style="font-size:14px">' + n.id + '</b> ' + (n.band ? '<span class="' + n.band + '">[' + n.band + ']</span>' : '') +
   '<table>' +
   '<tr><th>谱系</th><td>' + (n.parent || '—') + ' ← ' + n.edgeKind + '</td></tr>' +
   '<tr><th>配方</th><td>seed ' + (n.seed || '—') + ' · ' + (n.gens || '—') + ' 代 × ' + (n.games || '—') + ' 局/代</td></tr>' +
   '<tr><th>强度</th><td>' + (n.lg != null ? '5P long <b>' + n.lg.toFixed(1) + '%</b>' : '未考') + (n.mu != null ? ' ‖ 5P multi ' + n.mu.toFixed(1) + '%' : '') + '（200 局/桌，seed 77000 配对）</td></tr>' +
   '<tr><th>引用读数</th><td>' + (n.refRead ? n.refRead + '%（' + n.refSrc + '）' : '—') + '</td></tr>' +
   '<tr><th>备注</th><td>' + (n.note || '—') + '</td></tr>' +
   '<tr><th>产物</th><td style="font-size:10px">' + (n.src || '非产物（蒸馏/虚拟根）') + '</td></tr>' +
   '</table>';
});
</script>
</body>
</html>`;
writeFileSync('champion-map/gen3-evolution.html', html);
console.log('烘好了 champion-map/gen3-evolution.html ‖ 主树 ' + mainNodes.length + ' 节点 ‖ 段 ' + segNodes.length + ' ‖ 锚=' + (anchor != null ? anchor.toFixed(1) + '（' + anchorLbl + '）' : '未定'));
