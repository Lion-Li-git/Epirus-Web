#!/usr/bin/env node
/* 一次性补丁：门体里钉源码字符串的四条腿跟上搬家后的路径。 */
import { readFileSync, writeFileSync } from 'node:fs';
function patch(f, pairs) {
  let s = readFileSync(f, 'utf8');
  for (const [from, to] of pairs) {
    const n = s.split(from).length - 1;
    if (!n) { console.error('⛔ 没命中: ' + f + ' :: ' + from); process.exit(1); }
    s = s.split(from).join(to);
    console.log(n + ' × ' + f + ' :: ' + from.slice(0, 56));
  }
  writeFileSync(f, s);
}
patch('tools/gates/ship-feas.mjs', [
  ["readdirSync('server')", "readdirSync('training/server')"],
  ["return 'server/' + x;", "return 'training/server/' + x;"],
  ['tb.indexOf("from \'./audit-lib.mjs\'")', 'tb.indexOf("from \'../tools/audit-lib.mjs\'")'],
  ["\\['tools\\/train-3p\\.mjs'", "\\['training\\/train-3p\\.mjs'"],
]);
patch('tools/gates/ship-promote.mjs', [
  ['t3.indexOf("from \'./p2-baselines.mjs\'")', 't3.indexOf("from \'../tools/p2-baselines.mjs\'")'],
]);
console.log('gate pins fixed');
