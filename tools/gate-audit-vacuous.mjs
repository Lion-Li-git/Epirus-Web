#!/usr/bin/env node
/* gate-audit-vacuous.mjs v2 —— 门禁"空转/废门"审计（DS 线 2026-10-09/10，承接 Claude 复核 + METHODOLOGY 第 89 条）
 *
 * v2 修的两处（§2026-10-09 我在 docs/GATE-SHIFTS.md 第八节附录里写过改法）：
 *   ① 花括号计数**字符串感知**：v1 直接数字符 ⇒ 字符串里的 `{` 会让门体提前结束
 *      （曾误报 D168、并把门数从运行时 277 少看到 265）。
 *   ② 门标题正则**单双引号都认**（`t('…')` 与 `t("…")`），且**不用反向引用**
 *      （v1 改这一处时反向引用被工具链写坏过一次 ⇒ 这里用单捕获组）。
 *   另：门体里**纯注释行一律置空** ⇒ 注释里出现的断言/读文件文本不再被当成腿
 *      （我 10-09 因此误摘过自己的注释两次）。
 *
 * 分类：
 *   A0 门体里没有任何**断言调用** ⇒ 可疑空转（人工复核）
 *   A1 门体里没断言调用、但它调了含断言的辅助 ⇒ 不是废门
 *   B  只有恒真断言（ok(true/1/'x')）；⚠ 多行断言有盲区 ⇒ B 是**下界**
 *   C  正向钉**文档散文**（读 docs/*.md 或 *.md 后 indexOf(...) >= 0）⇒ 该摘（第 89 条）
 *   D  正向钉**源码行**（读 js/**.js、tools/* 后 indexOf(...) >= 0）⇒ 保留（删了会改行为）
 *
 * 已知局限（2026-10-10 实测记下，别重踩）：
 *   · 门总数 **274**，而运行时口径 `grep -c '^t('` = **277** ⇒ 差 3：我对**多行字符串/模板**不跨行记忆引号状态 ⇒
 *     那 3 道门的门体配平失败被跳过。**试过**把引号状态跨行保持（`st.q`）⇒ **更糟**（门数 269、A0 从 0 蹦到 181：
 *     一个未闭合引号会把后面整片掩掉）⇒ 已回退。要修得做**真正的 JS 词法扫描**（含正则字面量），不是几行补丁。
 *   · 因此本工具的门数**只作分类参考**；「总数封顶」请用运行时口径（见 docs/GATE-SHIFTS.md 第八节口径 2）。
 *
 * 用法：node tools/gate-audit-vacuous.mjs [--json]
 */
import { readFileSync } from 'node:fs';

const SRC = 'tools/np-test.mjs';
const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

const BACKSLASH = String.fromCharCode(92);
const QUOTES = ['"', "'", '`'];

/* 逐行把注释/字符串内容换成同长度空白（保留列位置 ⇒ 行号与括号计数仍准） */
function stripLine(l, st) {
  let out = '', i = 0;
  while (i < l.length) {
    const c = l[i], c2 = l[i + 1];
    if (st.blk) { if (c === '*' && c2 === '/') { st.blk = false; out += '  '; i += 2; } else { out += ' '; i++; } continue; }
    if (c === '/' && c2 === '*') { st.blk = true; out += '  '; i += 2; continue; }
    if (c === '/' && c2 === '/') break;
    if (QUOTES.indexOf(c) >= 0) {
      const q = c; out += ' '; i++;
      while (i < l.length) {
        if (l[i] === BACKSLASH) { out += '  '; i += 2; continue; }
        if (l[i] === q) { out += ' '; i++; break; }
        out += ' '; i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}
const _st = { blk: false };
const CODE = lines.map(function (l) { return stripLine(l, _st); });
const isCommentOnly = function (i) { return CODE[i].trim() === '' && lines[i].trim() !== ''; };

/* 断言辅助（体内调用另一个断言辅助的也算） */
const ASSERT = new Set(['ok', 'eq', 'ne', 'near', 'throws', 'approx']);
const assertRe = function () { return new RegExp('\\b(' + [...ASSERT].join('|') + ')\\s*\\('); };
const hasAssert = function (text) { return assertRe().test(text); };

/* 用掩码文本找块的收尾（字符串里的花括号不再骗人） */
function blockEnd(i) {
  let depth = 0, end = -1;
  for (let j = i; j < lines.length; j++) {
    for (const ch of CODE[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && j > i) { end = j; break; }
  }
  return end;
}
const bodyOf = function (i, end) {
  const arr = [];
  for (let k = i; k <= end; k++) arr.push(isCommentOnly(k) ? '' : lines[k]);
  return arr.join('\n');
};

/* ① 顶层 function：体内是否有断言调用 */
const helperHasOk = new Map();
for (let i = 0; i < lines.length; i++) {
  const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
  if (!m) continue;
  const end = blockEnd(i);
  if (end < 0) continue;
  helperHasOk.set(m[1], hasAssert(bodyOf(i, end)));
}

/* ② 每个门：t('…') 或 t("…") */
const gates = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^t\(['"]([^'"]+)['"]/.exec(lines[i]);
  if (!m) continue;
  const end = blockEnd(i);
  if (end < 0) continue;
  gates.push({ title: m[1], start: i + 1, body: bodyOf(i, end) });
}

const TAUT = /ok\(\s*(true|1|'[^']*')\s*[,)]/;
const PIN = /readFileSync\(['"]([^'"]+)['"]\s*,\s*['"]utf8['"]\)[^;]*?indexOf\([^)]*\)\s*>=\s*0/g;
const callNames = b => [...new Set([...b.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]))];
const idOf = t => (t.match(/^(D\d+[a-z]?)/) || ['—'])[0];

const out = { n: gates.length, runtime: lines.filter(l => /^t\(/.test(l)).length, A0: [], A1: [], B: [], C: [], D: [] };
for (const g of gates) {
  const id = idOf(g.title);
  if (!hasAssert(g.body)) {
    const via = callNames(g.body).filter(n => helperHasOk.get(n) === true);
    (via.length ? out.A1 : out.A0).push({ id, start: g.start, via: via.slice(0, 3) });
  }
  const okLines = g.body.split('\n').filter(l => /\bok\(/.test(l));
  if (okLines.length && okLines.every(l => TAUT.test(l))) out.B.push({ start: g.start });
  for (const m of g.body.matchAll(PIN)) {
    const f = m[1];
    (/(^|\/)docs\//.test(f) || /\.md$/.test(f) ? out.C : out.D).push({ id, start: g.start, file: f });
  }
}
const brief = a => a.map(x => (x.id && x.id !== '—' ? x.id : '') + '@' + x.start + (x.file ? '(' + x.file + ')' : '') + (x.via && x.via.length ? '→' + x.via.join('/') : '')).join(', ');
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  const same = out.n === out.runtime ? ' ✔ 与运行时一致' : ' ⚠ 与运行时差 ' + (out.runtime - out.n);
  console.log('门总数 = ' + out.n + '（运行时口径 grep -c "^t(" = ' + out.runtime + '）' + same);
  console.log('A0 无断言调用 ⇒ **可疑空转** (' + out.A0.length + ')：' + brief(out.A0));
  console.log('A1 断言在辅助里 ⇒ 不是废门 (' + out.A1.length + ')：' + brief(out.A1));
  console.log('B  恒真断言 (' + out.B.length + '，下界)：' + brief(out.B));
  console.log('C  正向钉**文档散文** ⇒ 该摘 (' + out.C.length + ')：' + brief(out.C));
  console.log('D  正向钉**源码行** ⇒ 保留（删了会改行为）(' + out.D.length + ')：' + brief(out.D).slice(0, 260));
}
