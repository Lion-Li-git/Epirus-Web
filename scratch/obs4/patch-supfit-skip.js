/* supfit-full 加 used/skip 计数（静默跳过 = kProb[wantKey]==null 的键不匹配，会让训练空转而不响）。
 * 正则锚（文件 CRLF）。 */
const fs = require('fs');
const F = 'tools/proto2/supfit-full.mjs';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};
repRE(["function step() {", "  grad.fill(0);", "  let used = 0;"],
  ["function step() {", "  grad.fill(0);", "  let used = 0, skipped = 0;"], 'SS1');
repRE(["    const { a, t } = acc(g2, pv);", "    if (t.kProb[g2.wantKey] == null) continue;"],
  ["    const { a, t } = acc(g2, pv);",
   "    if (t.kProb[g2.wantKey] == null) { skipped++; continue;   /* 11-10：静默跳过必须留痕——全跳 = 训练空转（lr 都不敏感） */ }"], 'SS2');
repRE(["  if (!used) return;"],
  ["  if (!used) { if (!step.skips) step.skips = 0; step.skips += skipped; return; }\n  if (skipped > 0) console.log('  [skip] 本批 ' + skipped + '/' + BATCH + ' 组键不匹配（teacher 键不在学生候选键表）');"], 'SS3');
fs.writeFileSync(F, s);
console.log('skip 计数完成');
