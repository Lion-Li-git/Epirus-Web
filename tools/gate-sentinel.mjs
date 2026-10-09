#!/usr/bin/env node
/* gate-sentinel.mjs —— 门禁规矩 1 的**机械检查**（Claude 文档 · docs/GATE-SHIFTS.md §七 规矩 1）
 *
 * 规矩 1：门禁只许测行为（跑代码、给输入、比输出）。禁止三类：读 .md 文件 ‖ 对源码做正则 ‖ 匹配日志措辞。
 * 文档明说：这个检查「**不算门、也不进 np-test**」⇒ 它是独立脚本，跑在 CI 里，只报告 + 退出码。
 *
 * 为什么默认**不红**（`--strict` 才红）：163 条"钉源码行"还没逐条分诊（删了会改行为 ⇒ 不一定该删），
 *   现在让 CI 变红等于用假红训练大家忽略红色 ✗。分诊完再开 `--strict`（一处开关）。
 *
 * 三个类（都按"门体行区间"近似：从 `^t(` 行到下一个 `^t(` 行之前）：
 *   ① 读 .md：门体里出现 readFileSync/readFile 且路径以 .md 结尾
 *   ② 源码正则：门体里同时出现 readFileSync 与 indexOf(...) >= 0（读到的东西被拿去比对）
 *   ③ 日志措辞：门体里出现 .out/.stdout/.stderr 与 indexOf(...) >= 0 且比对串含中文
 *
 * 用法：node tools/gate-sentinel.mjs [--strict] [--json]
 */
import { readFileSync } from 'node:fs';

const SRC = 'tools/np-test.mjs';
const lines = readFileSync(SRC, 'utf8').split('\n');

/* 门体 = 从 ^t( 行到下一个 ^t( 行之前（不做花括号配平 ⇒ 与审计器的口径互为独立校验） */
const starts = [];
for (let i = 0; i < lines.length; i++) if (/^t\(/.test(lines[i])) starts.push(i);
const gates = starts.map((s, k) => {
  const e = (k + 1 < starts.length ? starts[k + 1] : lines.length) - 1;
  return { start: s + 1, text: lines.slice(s, e + 1).join('\n') };
});
const idOf = t => {
  const m = /^t\(['"]([^'"]+)['"]/.exec(t);
  return m ? (m[1].match(/^(D\d+[a-z]?)/) || ['—'])[0] : '—';
};
const has = (t, re) => re.test(t);

const cls = { md: [], src: [], log: [] };
for (const g of gates) {
  const id = idOf(lines[g.start - 1]);
  if (/readFileSync\([^)]*\.md['"]/.test(g.text) || /readFile\([^)]*\.md['"]/.test(g.text)) cls.md.push(id + '@' + g.start);
  if (has(g.text, /readFileSync\(/) && has(g.text, /indexOf\([^)]*\)\s*>=\s*0/)) cls.src.push(id + '@' + g.start);
  if (has(g.text, /\.(out|stdout|stderr)\b/) && /indexOf\(['"][^'"]*[\u4e00-\u9fff][^'"]*['"]\)\s*>=\s*0/.test(g.text)) cls.log.push(id + '@' + g.start);
}
const out = { gates: gates.length, md: cls.md.length, src: cls.src.length, log: cls.log.length, lists: cls };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('门禁哨兵（规矩 1：只许测行为）· 门数 = ' + out.gates);
  console.log('  ① 读 .md 的门        = ' + out.md + (out.md ? '：' + cls.md.slice(0, 8).join(', ') + (out.md > 8 ? ' …' : '') : ' ✔'));
  console.log('  ② 对源码做正则的门    = ' + out.src + (out.src ? '：' + cls.src.slice(0, 8).join(', ') + (out.src > 8 ? ' …' : '') : ' ✔'));
  console.log('  ③ 匹配日志措辞的门    = ' + out.log + (out.log ? '：' + cls.log.slice(0, 8).join(', ') + (out.log > 8 ? ' …' : '') : ' ✔'));
  console.log('  ⇒ 默认只报告（不红）；分诊完再开 --strict。见 docs/GATE-SHIFTS.md §八 口径 1。');
}
const strict = process.argv.includes('--strict');
process.exit(strict && (out.md + out.log) > 0 ? 1 : 0);
