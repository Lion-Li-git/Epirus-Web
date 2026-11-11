/* arch2 段查找按下标 → 按段名（正则锚，行尾自适应——文件混合 EOL） */
const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
  n++;
};
repRE([
  "    const seatBias = L.seg[0].off + L.seatH * L.seatIn;",
  "    const actBias = L.seg[1].off + L.actH * L.actIn;",
  "    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;",
  "    const candBias = L.seg[3].off + L.hid2 * L.candIn;",
  "    const headOff = L.seg[4].off;",
  "    /* 权重起点每次决策取一次（不在逐候选循环里查段表） */",
  "    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');"],
  ["    /* 11-10：bias/headOff 一律按段名（obs5 在 seatEnc 后插了 attn/pma，seg[1..4] 下标假设不成立；obs3 族名字=下标，逐位不变） */",
   "    const seatBias = segOff('seatEnc') + L.seatH * L.seatIn;",
   "    const actBias = segOff('actEnc') + L.actH * L.actIn;",
   "    const ctxBias = segOff('ctx') + L.hid * L.ctxDim;",
   "    const candBias = segOff('cand') + L.hid2 * L.candIn;",
   "    const headOff = segOff('policyHead');",
   "    /* 权重起点每次决策取一次（不在逐候选循环里查段表） */",
   "    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');"], 'FWD3');
repRE([
  "    const out = Float64Array.from(params);",
  "    const headOff = L.seg[4].off;"],
  ["    const out = Float64Array.from(params);",
   "    const headOff = L.seg.find((sg) => sg.name === 'policyHead').off;   /* 11-10：按段名（obs5 插段后下标错位） */"], 'SOLVER');
fs.writeFileSync(F, s);
console.log('arch2 按名查段完成 ' + n + ' 处');
