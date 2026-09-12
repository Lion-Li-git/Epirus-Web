/* 多版本 skill-report 对比页
 * 用法: node tools/skill-report-cmp.mjs sr-a.json sr-b.json ... [--out=docs/skill-report-cmp.html] [--title=...]
 *
 * 为什么需要：tools/skill-report.mjs 一次只测一个冠军（--champ/--json），
 * 但"这一版的死技能是哪几个""哪几版把同一招用起来了"这类问题必须**横向比**。
 * 本工具只读各版本的 JSON（不重复跑实验），产出一页：
 *   ① 每个版本的基线 + 各类判定计数
 *   ② 技能 × 版本 矩阵：每格 = 实际使用率 / 强制使用强度 Δ（按判定着色）
 *   ③ 控制台同时打印纯文本表，便于直接贴进讨论
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
const OUT = FLAG.out || 'docs/skill-report-cmp.html';
const TITLE = FLAG.title || 'Epirus 技能报告 · 多版本对比';

const files = ARGV.filter(function (f) { return existsSync(f); });
const missing = ARGV.filter(function (f) { return !existsSync(f); });
if (!files.length) { console.error('没有可读的 JSON：' + ARGV.join(' ')); process.exit(1); }
const data = files.map(function (f) { return JSON.parse(readFileSync(f, 'utf8')); });
if (missing.length) console.log('[提醒] 跳过缺失文件: ' + missing.join(' '));

const VCOLOR = {
  '坑（常用却亏）': '#e5484d', '主力（强且常用）': '#30a46c', '中性常用': '#8b8d98',
  '没学会的强招': '#f5a623', '死技能（弱且不用）': '#6b4fbb',
  '基础动作（mono-spam 必然变差）': '#3a4252', '边缘': '#555',
  '实验未生效（Δ 不可读）': '#6b7280', '辅助/防御（Δ 结构性为负）': '#2b303b'
};
const esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };

/* 技能行：并集，按第 1 个版本的使用率降序（同率按费用升序） */
const order = [];
const seen = {};
for (const d of data) for (const r of d.rows) if (!seen[r.key]) { seen[r.key] = 1; order.push(r); }
order.sort(function (a, b) { return b.use - a.use || (a.cost == null ? 99 : a.cost) - (b.cost == null ? 99 : b.cost); });

const cellOf = function (d, key) { return d.rows.find(function (r) { return r.key === key; }) || null; };
const counts = function (d) {
  const c = {};
  for (const r of d.rows) c[r.verdict] = (c[r.verdict] || 0) + 1;
  return c;
};

/* ---------- 控制台文本表 ---------- */
console.log('\n=== ' + TITLE + ' ===');
console.log('版本: ' + data.map(function (d) { return d.label; }).join('  |  '));
console.log('\n校样基线（本版本自己的）：');
for (const d of data) console.log('  ' + d.label.padEnd(10) + ' 原生 1st=' + (d.baseNative * 100).toFixed(1) + '%   富经济 1st=' + (d.baseRich * 100).toFixed(1) + '%   局数/条件=' + (d.games * 126));
console.log('\n各类判定计数：');
const VERDICTS = Object.keys(VCOLOR);
console.log('  ' + '判定'.padEnd(26) + data.map(function (d) { return d.label.padStart(9); }).join(''));
for (const v of VERDICTS) {
  const row = data.map(function (d) { return String(counts(d)[v] || 0).padStart(9); }).join('');
  if (/^0+$/.test(row.replace(/\s/g, ''))) continue;
  console.log('  ' + v.padEnd(26) + row);
}
console.log('\n技能 × 版本（单元格 = 使用率 / 强制强度 Δ）：');
const head = '  ' + '技能'.padEnd(10) + '费用'.padStart(5) + data.map(function (d) { return d.label.padStart(16); }).join('');
console.log(head);
for (const r of order) {
  let line = '  ' + r.name.padEnd(10) + String(r.cost == null ? '?' : r.cost).padStart(5);
  for (const d of data) {
    const c = cellOf(d, r.key);
    line += c ? ((c.use * 100).toFixed(1) + '%/' + (c.delta >= 0 ? '+' : '') + (c.delta * 100).toFixed(0)).padStart(16) : '—'.padStart(16);
  }
  console.log(line);
}

/* ---------- HTML ---------- */
const maxUse = Math.max(0.01, ...order.map(function (r) { return r.use; }));
const maxAbs = Math.max(0.01, ...data.flatMap(function (d) { return d.rows.map(function (r) { return Math.abs(r.delta); }); }));

let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + esc(TITLE) + '</title>';
html += '<style>body{background:#0d0f14;color:#dfe2ea;font:13px/1.5 system-ui,"Microsoft YaHei",sans-serif;margin:0;padding:20px}';
html += 'h1{font-size:19px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 8px;color:#9aa0b0}';
html += '.meta{color:#7c8494;font-size:12px;margin-bottom:14px}';
html += 'table{border-collapse:collapse;background:#12151c;border-radius:8px;overflow:hidden;font-size:12px}';
html += 'th,td{padding:5px 7px;text-align:right;border-bottom:1px solid #1e2330;white-space:nowrap}';
html += 'th{background:#171b24;color:#9aa0b0;font-weight:600}td.name,th.name{text-align:left;color:#dfe2ea}';
html += '.cell{padding:3px 5px;border-radius:4px;display:inline-block;min-width:74px}';
html += '.barwrap{background:#1b202b;border-radius:3px;height:10px;width:70px;display:inline-block;overflow:hidden;vertical-align:middle}.bar{height:100%}';
html += '.pos{background:#30a46c}.neg{background:#e5484d}.legend{font-size:12px;color:#7c8494;margin-top:10px}';
html += '.tag{padding:1px 6px;border-radius:9px;font-size:10px;color:#0d0f14;font-weight:700}';
html += '.cards{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.card{background:#161a22;border:1px solid #232936;border-radius:8px;padding:8px 12px}';
html += '.card b{display:block;font-size:17px;color:#fff}.card span{font-size:11px;color:#7c8494}</style></head><body>';
html += '<h1>' + esc(TITLE) + '</h1>';
html += '<div class="meta">' + data.length + ' 个版本 · 每个版本：对手场 126 组(4 个互不相同脚本) × ' + (data[0].games) + ' 局 · 富裕经济 = 每回合补到 ' + data[0].rich + ' ep</div>';

/* 版本卡片 */
html += '<h2>每个版本的校样基线</h2><div class="cards">';
for (const d of data) {
  html += '<div class="card"><b>' + esc(d.label) + '</b><span>原生 1st ' + (d.baseNative * 100).toFixed(1) + '% · 富经济 ' + (d.baseRich * 100).toFixed(1) + '%</span></div>';
}
html += '</div>';

/* 判定计数矩阵 */
html += '<h2>各类判定计数（"死技能"越少越好，"没学会的强招"是行动项）</h2><table><tr><th class="name">判定</th>';
for (const d of data) html += '<th>' + esc(d.label) + '</th>';
html += '</tr>';
for (const v of VERDICTS) {
  const rowCounts = data.map(function (d) { return counts(d)[v] || 0; });
  if (rowCounts.every(function (x) { return x === 0; })) continue;
  html += '<tr><td class="name"><span class="tag" style="background:' + VCOLOR[v] + '">' + esc(v) + '</span></td>';
  for (const n of rowCounts) html += '<td>' + n + '</td>';
  html += '</tr>';
}
html += '</table>';

/* 主矩阵 */
html += '<h2>技能 × 版本：实际使用率 / 强制使用强度 Δ（底色 = 该版本的判定）</h2><table><tr><th class="name">技能</th><th>费用</th>';
for (const d of data) html += '<th>' + esc(d.label) + '</th>';
html += '</tr>';
for (const r of order) {
  html += '<tr><td class="name">' + esc(r.name) + '</td><td>' + (r.cost == null ? '?' : r.cost) + '</td>';
  for (const d of data) {
    const c = cellOf(d, r.key);
    if (!c) { html += '<td>—</td>'; continue; }
    const col = VCOLOR[c.verdict] || '#555';
    html += '<td><span class="cell" style="background:' + col + '22"><b>' + (c.use * 100).toFixed(1) + '%</b>' +
      ' <span style="color:' + (c.delta >= 0 ? '#30a46c' : '#e5484d') + '">' + (c.delta >= 0 ? '+' : '') + (c.delta * 100).toFixed(0) + '</span>' +
      '<br><span class="barwrap"><span class="bar ' + (c.use >= 0.04 ? 'pos' : 'neg') + '" style="width:' + (c.use / maxUse * 100).toFixed(0) + '%"></span></span></span></td>';
  }
  html += '</tr>';
}
html += '</table>';
html += '<div class="legend">每格：<b>使用率</b>（原生经济，同一考卷口径） / <b>Δ</b>（富裕经济下强制只用这一招 vs 自由发挥，单位 pt）。'
  + '底色是判定：<b>紫</b>=死技能、<b>橙</b>=没学会的强招、<b>绿</b>=主力、<b>红</b>=坑、'
  + '<b>灰</b>=实验未生效（该招进不了 legal，Δ 不可读）、<b>深灰</b>=辅助/防御（mono-spam 必然为负）。'
  + '<br>⚠️ 跨版本比"使用率"要看同一口径：本页所有版本都是 1 冠军 + 4 脚本、座位轮换、同一套对手场种子。</div>';
html += '</body></html>';
writeFileSync(OUT, html, 'utf8');
console.log('\n已写出 ' + OUT + '（' + html.length + ' 字节）');
