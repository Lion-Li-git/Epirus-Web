#!/usr/bin/env node
/* attach-g4path.mjs —— 给 `champion-map/g4scan-*.tsv` 补最后一列 `path`（输入指针）。
 *
 * 为什么要它（2026-10-24 夜班 · §E725 复核第③条）：GLM 那张全库 G4 单格扫描表**入库了，但没有"吃什么输入"的记录**
 *   ⇒ 干净克隆里这张表能读不能复算（154 枚的 `.bak` 大多只在本机，属"702 行只活在本机"那一族的**新对象**）。
 *   补一列 `path` 之后，复算入口就是一行：`awk -F'\t' 'NR>1{print $NF}' 表 | xargs node tools/probe-g4-anatomy.mjs 60`。
 *
 * 三条形状上的自律（都是本仓踩过的坑，不是装饰）：
 *   ① 列一律**按表头名**定位，不按写死的下标 —— `coords.tsv` 的列序会被 `attach-hp` 那类后挂步骤挪动（§E605 第①条）。
 *   ② **幂等**：已经有 `path` 列就只重写它的值，不在表尾再叠一列（§E605 那条"连跑三次 → 三个同名 Hp"的同型病）。
 *   ③ 只**后挂**新列，前 9 列逐字节不动；跑完自证（行数、列数、前 9 列与改前逐字同、每一枚都解出了 path）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const unknown = process.argv.slice(2).filter(a => a.startsWith('--') && !/^--(table|coords)=/.test(a) && a !== '--dry');
if (unknown.length) { console.error('⛔ 不认识的参数：' + unknown.join(' ') + ' ⇒ 拒绝静默忽略（会被吞掉的就是你以为改了的那部分）'); process.exit(2); }
const TABLE = arg('table', 'champion-map/g4scan-2026-10-24.tsv');
const COORDS = arg('coords', 'champion-map/coords.tsv');

const colsOf = (line) => line.split('\t');
function indexOfCol(header, name) { const i = header.indexOf(name); if (i < 0) { console.error('⛔ `' + name + '` 列不在表头里：' + header.join(',')); process.exit(2); } return i; }

const co = readFileSync(COORDS, 'utf8').replace(/\r/g, '').split('\n').filter(l => l.length);
const coHead = colsOf(co[0]);
const coId = indexOfCol(coHead, 'id'), coPath = indexOfCol(coHead, 'path');
const PATH = new Map();
for (let i = 1; i < co.length; i++) { const c = colsOf(co[i]); if (c.length <= Math.max(coId, coPath)) continue; PATH.set(c[coId], c[coPath]); }

const tb = readFileSync(TABLE, 'utf8').replace(/\r/g, '').split('\n').filter(l => l.length);
const head = colsOf(tb[0]);
const idCol = indexOfCol(head, 'id');
const hadPath = head.includes('path');
const base = hadPath ? head.slice(0, head.length - 1) : head;          // 幂等：已有 path 就摘掉重挂
const pIdx = hadPath ? head.length - 1 : -1;
const before = tb.slice(1).map(colsOf);

const out = [base.concat(['path']).join('\t')];
const missing = [];
for (const c of before) {
  const id = c[idCol];
  const p = PATH.get(id);
  if (!p) { missing.push(id); continue; }
  const kept = c.slice();
  if (hadPath) kept[pIdx] = p; else kept.push(p);
  out.push(kept.join('\t'));
}
if (missing.length) { console.error('⛔ ' + missing.length + ' 枚在 `coords.tsv` 里解不出 path（前 8：' + missing.slice(0, 8).join(' ') + '）\n   ⇒ 半张表的指针不写：现在写下去，下一个人会把"这一列有洞"读成"这一枚没有输入"'); process.exit(2); }

const text = out.join('\n') + '\n';
if (process.argv.includes('--dry')) { console.log('（--dry）不落盘。将写 ' + (out.length - 1) + ' 行 × ' + colsOf(out[0]).length + ' 列'); process.exit(0); }
writeFileSync(TABLE, text, 'utf8');

/* ===== 自证 ===== */
const after = readFileSync(TABLE, 'utf8').replace(/\r/g, '').split('\n').filter(l => l.length);
const aHead = colsOf(after[0]);
const rowsOk = after.length === tb.length;
const colsOk = after.every(l => colsOf(l).length === aHead.length);
/* 前 9 列逐字节不动：把新表的每一行切掉最后一列，应与"改前的行（若原来有 path 列也切掉它）"完全相同 */
const stripped = after.slice(1).map(l => colsOf(l).slice(0, base.length).join('\t'));
const origLines = before.map(c => c.slice(0, base.length).join('\t'));
const nineOk = stripped.join('\n') === origLines.join('\n');
console.log('已写 ' + TABLE + '  ‖ 行数 ' + (after.length - 1) + '（改前 ' + (tb.length - 1) + '，' + (rowsOk ? '行数守恒 ✓' : '✚ 不守恒 ⇒ 红') + '）'
  + ' ‖ 列数 ' + aHead.length + ' ‖ 每行列数一致 ' + (colsOk ? '✓' : '✗')
  + ' ‖ 前 ' + base.length + ' 列逐字节不动 ' + (nineOk ? '✓' : '✗'));
console.log('复算入口：awk -F\'\\t\' \'NR>1{print $NF}\' ' + TABLE + ' | xargs node tools/probe-g4-anatomy.mjs 60');
if (!rowsOk || !colsOk || !nineOk) { console.error('⛔ 自证没过 ⇒ 这次写入不可信，先别提交'); process.exit(2); }
