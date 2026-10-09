#!/usr/bin/env node
/* gate-audit-vacuous.mjs —— 门禁"空转/废门"审计（DS 线 2026-10-09，承接 Claude 的复核与 METHODOLOGY 第 89 条）
 *
 * 为什么先做这个而不是 244 次手工变异：变异测试需要**逐门知道它防的是什么**（不是纯机械），
 * 而"这条门里到底有没有能变红的断言"是纯机械可判的 —— 先把机械能判的部分判完，剩下的才值得人工变异。
 *
 * 判三类（都属于"门测的不是行为"）：
 *   A. 门体里**一条 ok() 都没有** ⇒ 空转门；
 *   B. 只有**恒真断言**（ok(true / ok(1 / ok('x') / ok(!0)）⇒ 等于不存在；
 *   C. **正向钉文档**（读 docs/*.md 然后 indexOf(...) >= 0）⇒ 删掉那行字游戏照跑、门却会红（第 89 条禁止）。
 *      （负向检查 indexOf(...) < 0 不算 —— 它能抓"文档指向已被删掉的东西"。）
 *
 * 用法：node tools/gate-audit-vacuous.mjs [--json]
 */
import { readFileSync } from 'node:fs';

const SRC = 'tools/np-test.mjs';
const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

/* 找每个 t('…', function () { … }); 的起止行（按缩进配平大括号） */
const gates = [];
const reT = /^t\('([^']+)'/;
for (let i = 0; i < lines.length; i++) {
  const m = reT.exec(lines[i]);
  if (!m) continue;
  let depth = 0, start = i, end = -1;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && j > i) { end = j; break; }
  }
  if (end < 0) continue;
  const body = lines.slice(start, end + 1).join('\n');
  const id = (m[1].match(/^(D\d+[a-z]?)/) || [m[1]])[1];
  gates.push({ id, title: m[1], start: start + 1, end: end + 1, body });
}

const TAUT = /ok\(\s*(true|1|'[^']*'\s*)\s*[,)]/;
const POSDOC = /readFileSync\('docs\/[^']+'\s*,\s*'utf8'\)[^;]*?indexOf\([^)]*\)\s*>=\s*0/;
const out = { A: [], B: [], C: [], n: gates.length };
for (const g of gates) {
  const oks = g.body.match(/\bok\(/g) || [];
  if (oks.length === 0) { out.A.push(g); continue; }
  const oksLines = g.body.split('\n').filter(l => /\bok\(/.test(l));
  if (oksLines.length && oksLines.every(l => TAUT.test(l))) { out.B.push(g); continue; }
  if (POSDOC.test(g.body)) out.C.push(g);
}
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ n: out.n, A: out.A.map(g => g.id), B: out.B.map(g => g.id), C: out.C.map(g => g.id) }, null, 2));
} else {
  console.log('门总数 = ' + out.n);
  console.log('A 空转（门体里没有 ok()）= ' + out.A.length + (out.A.length ? '：' + out.A.map(g => g.id + '@' + g.start).join(', ') : ''));
  console.log('B 恒真断言 = ' + out.B.length + (out.B.length ? '：' + out.B.map(g => g.id + '@' + g.start).join(', ') : ''));
  console.log('C 正向钉文档 = ' + out.C.length + (out.C.length ? '：' + out.C.map(g => g.id + '@' + g.start).join(', ') : ''));
  for (const g of out.C) console.log('   C ' + g.id + ' — ' + g.title.slice(0, 70));
}
