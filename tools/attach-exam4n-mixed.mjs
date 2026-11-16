#!/usr/bin/env node
/* attach-exam4n-mixed.mjs —— 批2：mixed 夹具考卷读数贴进 page/coords.tsv 新列族（§E597：新尺=新列名）。
 *
 * 列族 `mx1116`（尺 = exam4n-mixedfix-1116，rounds=6 seed=77000 dose=exam 5锚 champ）：
 *   MxC    = multi 模式复合 C 均值（x2..x8 的均值，C=(A+B)/2）
 *   MxCL   = long  模式复合 C 均值
 *   MxSkU  = 跨环境出招数（两模式 skU 取大 = 并集下界）
 *   MxSkE  = 跨环境有效技能数（两模式 skE 取大；有效 = 总≥3手 ∧ 出现在≥3个不同环境格）
 * 旧行不动，只追加列；没测的行留空 = 未测不当 0。幂等：列已在则就地更新值。
 * 用法：node tools/attach-exam4n-mixed.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry');
const CO = join(ROOT, 'champion-map/data/page/coords.tsv');
const TBL = (mode) => join(ROOT, 'champion-map/data/exam4n-mixedfix-1116-' + mode + '.tsv');

const readTsv = (p) => {
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const ix = Object.fromEntries(L[0].split('\t').map((c, i) => [c, i]));
  return { rows: L.slice(1).map((l) => l.split('\t')), ix, header: L[0].split('\t') };
};
const cellMean = (r, ix) => {
  const xs = ['x2', 'x3', 'x5', 'x8'].map((k) => +r[ix[k]]);
  return xs.every((v) => Number.isFinite(v)) ? (xs.reduce((a, b) => a + b, 0) / 4).toFixed(4) : '';
};
const collect = (mode) => {
  const t = readTsv(TBL(mode));
  const out = {};
  for (const r of t.rows) {
    const id = r[t.ix.id];
    if (!id) continue;
    out[id] = { C: cellMean(r, t.ix), skU: r[t.ix.skU] || '', skE: r[t.ix.skE] || '' };
  }
  return out;
};
const M = collect('multi'), L = collect('long');

const raw = readFileSync(CO, 'utf8');
const CRLF = raw.includes('\r\n');
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const header = lines[0].split('\t');
const NEW = ['MxC', 'MxCL', 'MxSkU', 'MxSkE'];
const existing = NEW.filter((c) => header.includes(c));
if (existing.length === NEW.length) console.log('列族已在，就地更新');
else if (existing.length) { console.error('⛔ 列族残缺（已有 ' + existing.join(',') + '）⇒ 拒绝半套列'); process.exit(2); }

const width = header.length;
let updated = 0, filled = 0;
const outRows = lines.map((l, li) => {
  const c = l.split('\t');
  if (li === 0) return existing.length === NEW.length ? c : c.concat(NEW);
  if (c.length === 1 && !c[0]) return c;   // 空行原样
  const id = c[header.indexOf('id')];
  const m = M[id], g = L[id];
  const vals = [
    m ? m.C : '',
    g ? g.C : '',
    m && g ? String(Math.max(+m.skU || 0, +g.skU || 0)) || '' : (m ? m.skU : (g ? g.skU : '')),
    m && g ? String(Math.max(+m.skE || 0, +g.skE || 0)) || '' : (m ? m.skE : (g ? g.skE : '')),
  ];
  if (existing.length === NEW.length) {
    for (let k = 0; k < NEW.length; k++) c[header.indexOf(NEW[k])] = vals[k];
  } else {
    if (c.length !== width) { console.error('⛔ 第 ' + (li + 1) + ' 行宽度 ' + c.length + ' ≠ 表头 ' + width + ' ⇒ 拒写'); process.exit(2); }
    c.push(...vals);
  }
  if (vals.some(Boolean)) { updated++; if (vals.every(Boolean)) filled++; }
  return c;
});
console.log('mixed 表：multi ' + Object.keys(M).length + ' ‖ long ' + Object.keys(L).length + ' ‖ 贴数 ' + updated + ' 行（全四列 ' + filled + '）');
if (DRY) { console.log('--dry：未写'); process.exit(0); }
const nl = CRLF ? '\r\n' : '\n';
writeFileSync(CO, outRows.map((r) => r.join('\t')).join('\n') + '\n'.replace('\n', nl), 'utf8');
console.log('✅ page/coords.tsv 列族 mx1116 就位（' + outRows.length + ' 行 × ' + outRows[0].length + ' 列）');
/* display.tsv 同步（coords-view 模板=display ⇒ viewer 的 ske/mxc 档吃这里；新注册包的 display 行 Mx 列为空，必须一并补） */
const DP = join(ROOT, 'champion-map/data/display.tsv');
const draw = readFileSync(DP, 'utf8');
const DCRLF = draw.includes('\r\n');
const dl = draw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const dh = dl[0].split('\t');
const dfix = Object.fromEntries(dh.map((c, i) => [c, i]));
let dUpdated = 0;
const dOut = dl.map((l, li) => {
  const c = l.split('\t');
  const id = li === 0 ? null : c[dfix.id];
  if (!id || !M[id] && !L[id]) return c;
  const m = M[id], g = L[id];
  const vals = [m ? m.C : '', g ? g.C : '',
    m && g ? String(Math.max(+m.skU || 0, +g.skU || 0)) || '' : (m ? m.skU : (g ? g.skU : '')),
    m && g ? String(Math.max(+m.skE || 0, +g.skE || 0)) || '' : (m ? m.skE : (g ? g.skE : ''))];
  for (let k = 0; k < NEW.length; k++) { if (dfix[NEW[k]] === undefined) return c; c[dfix[NEW[k]]] = vals[k]; }
  dUpdated++;
  return c;
});
if (dfix.MxC !== undefined) { writeFileSync(DP, dOut.map((r) => r.join('\t')).join('\n') + '\n'.replace('\n', DCRLF ? '\r\n' : '\n'), 'utf8'); console.log('✅ display.tsv Mx 列同步 ' + dUpdated + ' 行'); }
else console.log('⚠ display.tsv 无 Mx 列（跑 tools/sync-display-mx 或等列族迁移）');
