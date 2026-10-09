#!/usr/bin/env node
/* gate-audit-vacuous.mjs —— 门禁"空转/废门"审计（DS 线 2026-10-09，承接 Claude 复核 + METHODOLOGY 第 89 条）
 *
 * 机械能判的部分先判完，剩下的才值得人工/变异测试。分四类：
 *   A0 无路到 ok()      —— 门体里没有 ok()，且它调用的辅助函数里也没有 ok() ⇒ **可疑空转**
 *   A1 经由辅助         —— 门体里没有 ok()，但调用的辅助里有 ⇒ 不是废门（只是断言写在辅助里）
 *   B  恒真断言         —— 只有 ok(true / 1 / 'x') 这类；⚠ 多行断言有盲区 ⇒ B 计数是**下界**
 *   C  正向钉**文档散文** —— 读 docs/*.md 后 indexOf(...) >= 0 ⇒ 删掉那行字游戏照跑、门却会红（第 89 条禁止）
 *   D  正向钉**源码行**   —— 读 js/**.js、tools/*.mjs 后 indexOf(...) >= 0 ⇒ 脆，但删掉那行源码**会改行为** ⇒ 不算第 89 条的病
 *
 * 用法：node tools/gate-audit-vacuous.mjs [--json]
 */
import { readFileSync } from 'node:fs';

const SRC = 'tools/np-test.mjs';
const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

/* ① 所有顶层 function 名字 → 其函数体是否含 ok( */
/* 先找出所有**断言辅助**：ok / eq / ne / near / throws…（体内调用另一个断言辅助的也算）*/
const ASSERT = new Set(['ok', 'eq']);
let grew = true;
const helperHasOk = new Map();
for (let i = 0; i < lines.length; i++) {
  const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
  if (!m) continue;
  let depth = 0, end = i;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && j > i) { end = j; break; }
  }
  helperHasOk.set(m[1], /\bok\(/.test(lines.slice(i, end + 1).join('\n')));
}

/* ② 每个门 t('…', function () { … }); 的起止 */
const gates = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^t\('([^']+)'/.exec(lines[i]);
  if (!m) continue;
  let depth = 0, end = -1;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && j > i) { end = j; break; }
  }
  if (end < 0) continue;
  gates.push({ title: m[1], start: i + 1, body: lines.slice(i, end + 1).join('\n') });
}

const TAUT = /ok\(\s*(true|1|'[^']*')\s*[,)]/;
const PIN = /readFileSync\('([^']+)'\s*,\s*'utf8'\)[^;]*?indexOf\([^)]*\)\s*>=\s*0/g;
const callNames = b => [...new Set([...b.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]))];

const out = { n: gates.length, A0: [], A1: [], B: [], C: [], D: [] };
for (const g of gates) {
  const direct = /\bok\(/.test(g.body);
  if (!direct) {
    const viaHelper = callNames(g.body).filter(n => helperHasOk.get(n) === true);
    (viaHelper.length ? out.A1 : out.A0).push({ id: (g.title.match(/^(D\d+[a-z]?)/) || ['—'])[0], start: g.start, via: viaHelper.slice(0, 3) });
  }
  const okLines = g.body.split('\n').filter(l => /\bok\(/.test(l));
  if (okLines.length && okLines.every(l => TAUT.test(l))) out.B.push({ start: g.start });
  for (const m of g.body.matchAll(PIN)) {
    const f = m[1];
    (/(^|\/)docs\//.test(f) || /\.md$/.test(f) ? out.C : out.D).push({ id: (g.title.match(/^(D\d+[a-z]?)/) || ['—'])[0], start: g.start, file: f });
  }
}
const brief = a => a.map(x => (x.id && x.id !== '—' ? x.id : '') + '@' + x.start + (x.file ? '(' + x.file + ')' : '') + (x.via && x.via.length ? '→' + x.via.join('/') : '')).join(', ');
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('门总数 = ' + out.n);
  console.log('A0 无路到 ok ⇒ **可疑空转** (' + out.A0.length + ')：' + brief(out.A0));
  console.log('A1 断言在辅助里 ⇒ 不是废门 (' + out.A1.length + ')：' + brief(out.A1));
  console.log('B  恒真断言 (' + out.B.length + '，下界)：' + brief(out.B));
  console.log('C  正向钉**文档散文** ⇒ 该摘 (' + out.C.length + ')：' + brief(out.C));
  console.log('D  正向钉**源码行** ⇒ 保留（删了会改行为）(' + out.D.length + ')：' + brief(out.D).slice(0, 300));
}
