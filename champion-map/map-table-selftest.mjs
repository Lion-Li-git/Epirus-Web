#!/usr/bin/env node
/* map-table 自检（阶段 1）：5 条腿 + 别名/默认表/守卫。
 * 用临时 2~3 行 fixture，不碰在册 coords.tsv / coords-gen3-1105.tsv。
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import assert from 'node:assert';
import { resolveTable, readTable, writeTable, assertColumns, assertFullTable, tableStamp, DEFAULT_TABLE } from './map-table.mjs';

const HERE = process.cwd().endsWith('champion-map') ? process.cwd() : join(process.cwd(), 'champion-map');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('PASS ' + msg); } else { fail++; console.log('FAIL ' + msg); } }
function throws(fn, re, msg) {
  let e = null; try { fn(); } catch (x) { e = x; }
  ok(!!e && (!re || re.test(String(e.message))), msg + (e ? '（' + e.message.slice(0, 80) + '…）' : '（没抛）'));
}

/* 1. 默认 gen3，且不是旧表 */
const def = resolveTable([], { baseDir: HERE });
ok(basename(def) === 'coords-gen3-1105.tsv', '默认表 = coords-gen3-1105.tsv（实际 ' + basename(def) + '）');
const gt = readTable(def);
ok(gt.rowsN === 926 && gt.header.length === 142, '默认表行/列 = 926 × 142（实际 ' + gt.rowsN + ' × ' + gt.header.length + '）');
ok(!existsSync(join(HERE, 'coords.tsv.tmp-' + process.pid)), '默认解析不产生临时文件');

/* 2. 旧表只显式 */
const legacy = resolveTable(['--table=coords.tsv'], { baseDir: HERE });
const lt = readTable(legacy);
ok(basename(legacy) === 'coords.tsv' && lt.rowsN === 825, '显式 --table=coords.tsv 读到 825 行（实际 ' + lt.rowsN + '）');

/* 3. --fit 别名 */
const fit = resolveTable(['--fit=data/display.tsv'], { baseDir: HERE });
const ft = readTable(fit);
ok(basename(fit) === 'display.tsv' && ft.header.length === 146, '--fit 别名读到 data/display 146 列（实际 ' + ft.header.length + '）');

/* 4. 缺表：报错并列出试过的路径，不许退回旧表 */
throws(function () { resolveTable(['--table=__nope__.tsv'], { baseDir: HERE }); }, /找不到输入表/, '缺表必须抛错（不静默退回）');

/* 5. 读/写 roundtrip + 备份 + 原子写 */
const td = mkdtempSync(join(tmpdir(), 'epirus-maptable-'));
const p = join(td, 'tiny.tsv');
writeFileSync(p, 'id\tpath\nA\ta.js\nB\tb.js\n', 'utf8');
const t1 = readTable(p);
ok(t1.rowsN === 2 && t1.ix.id === 0 && t1.ix.path === 1, '小表读入 2 行 / 列索引正确');
t1.rows[0][1] = 'a2.js';
const w = writeTable(p, t1, { backupTool: 'selftest' });
ok(!!w.backup && existsSync(w.backup), '写表生成备份 ' + (w.backup ? basename(w.backup) : '（无）'));
const t2 = readTable(p);
ok(t2.rows[0][1] === 'a2.js' && t2.sha !== t1.sha, 'roundtrip 值已更新且 sha 变化');

/* 6. 列宽不符：拒写，原文件不变 */
const before = readFileSync(p, 'utf8');
const bad = { header: ['id', 'path'], rows: [['A', 'a.js'], ['B', 'b.js', 'EXTRA']] };
throws(function () { writeTable(p, bad, { backup: false }); }, /列/, '列宽不符必须拒写');
ok(readFileSync(p, 'utf8') === before, '拒写后原文件逐字不变');

/* 7. 完整性守卫 */
throws(function () { assertFullTable(t2, { minRows: 999 }); }, /只有 2 行/, 'assertFullTable 拦半成品');
ok(assertFullTable(t2, { minRows: 999, allowPartial: true }) === true, 'allowPartial 显式放行');
throws(function () { assertColumns(t2, ['id', 'missing']); }, /缺列/, 'assertColumns 拦缺列');
ok(tableStamp(t2).indexOf('rows=2') >= 0 && tableStamp(t2).indexOf('sha=') >= 0, 'tableStamp 含 rows/sha');

rmSync(td, { recursive: true, force: true });
console.log('\n' + (fail ? '❌ FAIL ' + fail + ' / PASS ' + pass : '✅ map-table selftest：' + pass + '/' + pass + ' PASS'));
process.exit(fail ? 1 : 0);
