/* 数 markdown 表行的字段数：`\|` 是转义的字面竖线，不算分隔符（10-30 我第一版检数器就栽在这儿） */
import { readFileSync } from 'node:fs';
const cells = (l) => l.replace(/\\\|/g, '\u0000').split('|').length;
const files = [
  'docs/research/PACK2-CONTRACT-2026-10-30-qoder.md',
  'docs/research/LIVE-LINES.md',
];
for (const f of files) {
  const L = readFileSync(f, 'utf8').split(/\r?\n/);
  let i = 0, tables = 0, bad = 0;
  while (i < L.length) {
    const isSep = (s) => /^\s*\|[\s:|-]+\|\s*$/.test(s) && s.includes('---');
    if (/^\s*\|/.test(L[i]) && i + 1 < L.length && isSep(L[i + 1])) {
      const n = cells(L[i]); tables++;
      let j = i + 2;
      while (j < L.length && /^\s*\|/.test(L[j])) {
        if (cells(L[j]) !== n) { bad++; console.log('  真断列', f, '行', j + 1, cells(L[j]), '应', n); }
        j++;
      }
      i = j;
    } else i++;
  }
  console.log(f, '⇒ 表', tables, '张 ‖ 真断列', bad, '行');
}
