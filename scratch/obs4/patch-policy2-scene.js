/* policy2 scene/seatVec 的 obs5 别名（与 obs4 同一特征面）。正则锚（CRLF 文件）。 */
const fs = require('fs');
const F = 'js/train/policy2.js';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};
repRE(["    const b = ver === 'obs3b';",
       "    const v4 = ver === 'obs4';"],
  ["    const b = ver === 'obs3b';",
   "    const v4 = ver === 'obs4' || ver === 'obs5';   /* obs5：特征面与 obs4 同一函数（聚合层才分家） */"], 'S1');
fs.writeFileSync(F, s);
console.log('policy2 scene obs5 别名完成');
