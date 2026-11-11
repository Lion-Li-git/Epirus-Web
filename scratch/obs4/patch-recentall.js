/* obs3.mjs recentAll 补 keys[]/cnt —— 与 policy2.recentAll 逐字同账（浏览器镜像腿 E 抓出的洞：
 * 训练侧 obs4 的 actsLast4/streakDef 两维恒 0（死维），浏览器却有活值 ⇒ 训-读不同账）。
 * obs3b 只读 bag/tgt ⇒ 加字段零回归。正则锚（文件 CRLF）。 */
const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};
repRE(["  const bag = new Map(), tgt = new Map(), age = new Map();",
       "  for (const id of ids) { bag.set(id, {}); tgt.set(id, [0, 0, 0]); age.set(id, 0); }"],
  ["  const bag = new Map(), tgt = new Map(), age = new Map(), keysSeq = new Map();",
   "  for (const id of ids) { bag.set(id, {}); tgt.set(id, [0, 0, 0]); age.set(id, 0); keysSeq.set(id, []); }   // keys：与 policy2.recentAll 同账（11-10 腿 E 抓出训练侧缺 keys/cnt ⇒ obs4 的 actsLast4/streakDef 训练时恒 0）"], 'R1');
repRE(["    need.set(e.pid, need.get(e.pid) - 1);",
       "    age.set(e.pid, a + 1);",
       "  }"],
  ["    need.set(e.pid, need.get(e.pid) - 1);",
   "    age.set(e.pid, a + 1);",
   "    const ks = keysSeq.get(e.pid); ks.push(e.key); if (ks.length > K) ks.length = K;   // 反向扫描 ⇒ keys[0] = 最近一手",
   "  }"], 'R2');
repRE(["  for (const id of ids) out.set(id, { bag: bag.get(id), tgt: tgt.get(id) });"],
  ["  for (const id of ids) out.set(id, { bag: bag.get(id), tgt: tgt.get(id), keys: keysSeq.get(id) || [], cnt: 4 - (need.get(id) || 0) });"], 'R3');
fs.writeFileSync(F, s);
console.log('recentAll keys/cnt 补齐');
