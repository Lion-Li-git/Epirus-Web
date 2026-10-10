/* §E576 把人席探针的 stdout 解析成 tsv（解析与判读分开，两份都在仓里）
 *
 * 为什么要落表而不是继续抄 markdown：§E506 那 24 臂的六格读数**只存在于日志的表格里**，
 *   而那张表还"中略 12 枚" ⇒ "分数尺 ⊥ 人席"这条结论承重的那批数据没有结构化件，
 *   任何人要复算或加维度都得重跑一遍贵尺。
 * 口径：`tools/probe-human-seat.mjs` 的原始 stdout **也进仓**（`seat-raw-*.log`），tsv 只当索引 ——
 *   解析出错时能用原文对回来，不会把"解析器的错"读成"包的错"。
 * 用法：node champion-map/seat-parse.mjs --in=<stdout 文件> --out=<tsv>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const IN = arg('in', ''), OUT = arg('out', '');
if (!IN || !OUT) { console.error('用法: --in=<probe-human-seat 的 stdout> --out=<tsv>'); process.exit(2); }
const src = readFileSync(IN.indexOf(':') >= 0 || IN[0] === '/' ? IN : join(HERE, IN), 'utf8');
const seedLine = (/seed0=(\d+)/.exec(src) || ['', ''])[1];
const gamesLine = (/(\d+) 局\/格/.exec(src) || ['', ''])[1];

/* 逐包块解析：`== <path>` 起头，缩进行 `  <mode> 名 x%(和y%) · …` */
const CELLS = [];   // 出现的格名，按第一次出现顺序
const rows = [];    // {path, mode, cells:{名: {win, draw}}}
let cur = null;
for (const line of src.split(/\r?\n/)) {
  const m = /^== (\S.*)$/.exec(line);
  if (m) { cur = { path: m[1].trim(), byMode: {} }; rows.push(cur); continue; }
  if (!cur) continue;
  const mm = /^\s+(multi|long)\s+(.*)$/.exec(line);
  if (!mm) continue;
  const mode = mm[1]; const cells = {};
  for (const part of mm[2].split(' · ')) {
    const c = /^(.+?)\s+([\d.]+)%\(和(\d+)%\)\s*$/.exec(part.trim());
    if (!c) { console.error('⛔ 解析不动这一段（格式变了就别硬猜）：' + part); process.exit(3); }
    cells[c[1]] = { win: +c[2], draw: +c[3] };
    if (CELLS.indexOf(c[1]) < 0) CELLS.push(c[1]);
  }
  cur.byMode[mode] = cells;
}
/* 判据 (d)：格数必须每包每口径齐全，缺一格就红（不是静默留空） */
const bad = [];
for (const r of rows) for (const mode of ['multi', 'long']) {
  if (!r.byMode[mode]) { bad.push(r.path + '/' + mode + ' 整行缺失'); continue; }
  for (const name of CELLS) if (!r.byMode[mode][name]) bad.push(r.path + '/' + mode + '/' + name + ' 缺一格');
}
const id = p => p.split(/[\\/]/).pop().replace(/\.(bak|js)$/, '');
const hdr = ['id', 'path', 'mode', 'games', 'seed0'].concat(CELLS).concat(['六格均值', '最大格', '最大格是谁', '和棋均值']);
const out = [hdr.join('\t')];
for (const r of rows) for (const mode of ['multi', 'long']) {
  const c = r.byMode[mode] || {};
  const vals = CELLS.map(k => (c[k] ? c[k].win : NaN));
  const fin = vals.filter(v => isFinite(v));
  const mi = vals.indexOf(Math.max.apply(null, fin));
  out.push([id(r.path), r.path, mode, gamesLine, seedLine]
    .concat(CELLS.map(k => (c[k] ? c[k].win : 'NA')))
    .concat([fin.length ? (fin.reduce((a, b) => a + b, 0) / fin.length).toFixed(2) : 'NA',
      fin.length ? Math.max.apply(null, fin).toFixed(1) : 'NA',
      mi >= 0 ? CELLS[mi] : 'NA',
      CELLS.map(k => (c[k] ? c[k].draw : NaN)).filter(isFinite).reduce((a, b) => a + b, 0) / Math.max(1, fin.length)]).join('\t'));
}
writeFileSync(OUT.indexOf(':') >= 0 || OUT[0] === '/' ? OUT : join(HERE, OUT), out.join('\n') + '\n', 'utf8');
console.log('# 解析：包 ' + rows.length + ' 枚 × 2 口径 ‖ 格 ' + CELLS.length + ' 个 [' + CELLS.join(' ‖ ') + '] ‖ 落盘 ' + (out.length - 1) + ' 行');
console.log('# seed0=' + seedLine + ' ‖ ' + gamesLine + ' 局/格');
if (bad.length) { console.log('⛔ 缺格 ' + bad.length + ' 处：\n  ' + bad.slice(0, 8).join('\n  ')); process.exit(4); }
console.log('✅ 每包每口径 ' + CELLS.length + ' 格齐全');
