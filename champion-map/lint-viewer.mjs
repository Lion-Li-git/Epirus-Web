#!/usr/bin/env node
/* §E312 viewer.mjs 的模板字符串 lint —— 专治一个夜班踩了三次的坑
 *
 * 病：champion-map/viewer.mjs 把整段浏览器代码放在 `const JS = \`...\`` 里。
 *     注释或文案里出现一个反引号，就会把那段模板字符串**就地截断**，
 *     报的是 `SyntaxError: Unexpected identifier 'xxx'`，而且栈指向模板字符串**开头**，离病因十万八千里。
 *     （10-04 一次：注释里包 META.hotstartFrom；10-05 两次：包 #isot= 与 iso-sweep.mjs —— 第二次就写在"绝不能出现反引号"那句警告里。）
 * 近亲：HTML 属性是双引号包在 JS 单引号串里 ⇒ 属性文案里放裸双引号会截断属性，**不报错**，只是 tooltip 少一截（更难查）。
 *
 * 这个脚本在**跑构建之前**把这两类都抓出来。用法：node champion-map/lint-viewer.mjs（非 0 退出 = 有问题）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'viewer.mjs'), 'utf8').split('\n');
const open = SRC.findIndex((l) => /const JS = `/.test(l));
let close = -1;
for (let i = open + 1; i < SRC.length; i++) if (/^`;\s*$/.test(SRC[i]) || /^\S.*\bJS\b.*`;/.test(SRC[i])) { close = i; break; }
if (open < 0 || close < 0) {
  console.error('⛔ 没定位到 const JS = `...` 这段模板（viewer.mjs 的结构变了 ⇒ 这个 lint 要跟着改，别当"检查通过"）');
  process.exit(2);
}
const bad = [];
for (let i = open + 1; i < close; i++) {
  const l = SRC[i];
  if (l.indexOf('`') >= 0) bad.push(['反引号会截断模板', i + 1, l.trim().slice(0, 110)]);
  /* 属性文案里的裸双引号：只看 title="..." 这种串里是否还嵌着 " */
  for (const m of l.matchAll(/title="([^"]*)"/g)) {
    const inner = m[1];
    if (/[\u300c\u300d]/.test(inner) && /"/.test(inner)) bad.push(['title 里混了裸引号', i + 1, inner.slice(0, 90)]);
  }
}
console.log('扫了模板段第 ' + (open + 2) + ' ~ ' + close + ' 行（' + (close - open - 1) + ' 行浏览器代码）');
if (!bad.length) { console.log('✅ 没发现会截断模板的反引号'); process.exit(0); }
for (const [why, ln, txt] of bad) console.log('  ⛔ 第 ' + ln + ' 行 · ' + why + '：' + txt);
console.log('  ⇒ 修法：注释/文案里用「」或裸词，别用反引号；HTML 属性文案里别放双引号。');
process.exit(1);
