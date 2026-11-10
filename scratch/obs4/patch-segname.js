/* 段查找按下标 → 按段名（obs5 在 seatEnc 后插了 attn/pma 两段，seg[1..4] 全部错位）。
 * 只动 obs3 族通用路（policy2.forwardCands / arch2.forwardObs3 / arch2 的 head 解算器）；
 * forwardV7 的段表从不插段，seg[4] 仍 = policyHead，不动（老路零回归）。 */
const fs = require('fs');
let n = 0;
function fix(F, anchors) {
  let s = fs.readFileSync(F, 'utf8');
  for (const [a, b, tag] of anchors) {
    if (!s.includes(a)) { console.error('锚失败: ' + tag); process.exit(2); }
    s = s.split(a).join(b); n++;
  }
  fs.writeFileSync(F, s);
}
fix('js/train/policy2.js', [
  ["    const seatBias = L.seg[0].off + L.seatH * L.seatIn;\n    const actBias = L.seg[1].off + L.actH * L.actIn;\n    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;\n    const candBias = L.seg[3].off + L.hid2 * L.candIn;\n    const headOff = L.seg[4].off;\n    const WS = L.seg[0].off, WA = L.seg[1].off, WC = L.seg[2].off, WK = L.seg[3].off;",
   "    /* 11-10：一律按段名查——obs5 在 seatEnc 后插了 attn/pma 两段，seg[1..4] 的下标假设已不成立\n     *   （obs3 族名字与下标恰好同值，逐位不变）。 */\n    const segOff = (nm) => L.seg.find((sg) => sg.name === nm).off;\n    const seatBias = segOff('seatEnc') + L.seatH * L.seatIn;\n    const actBias = segOff('actEnc') + L.actH * L.actIn;\n    const ctxBias = segOff('ctx') + L.hid * L.ctxDim;\n    const candBias = segOff('cand') + L.hid2 * L.candIn;\n    const headOff = segOff('policyHead');\n    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');", 'POL']],
);
fix('tools/proto2/arch2.mjs', [
  ["    const seatBias = L.seg[0].off + L.seatH * L.seatIn;\n    const actBias = L.seg[1].off + L.actH * L.actIn;\n    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;\n    const candBias = L.seg[3].off + L.hid2 * L.candIn;\n    const headOff = L.seg[4].off;",
   "    /* 11-10：一律按段名查（obs5 插段后下标错位；obs3 族名字=下标，逐位不变） */\n    const segOff = (nm) => L.seg.find((sg) => sg.name === nm).off;\n    const seatBias = segOff('seatEnc') + L.seatH * L.seatIn;\n    const actBias = segOff('actEnc') + L.actH * L.actIn;\n    const ctxBias = segOff('ctx') + L.hid * L.ctxDim;\n    const candBias = segOff('cand') + L.hid2 * L.candIn;\n    const headOff = segOff('policyHead');", 'ARCH']],
);
fix('tools/proto2/arch2.mjs', [
  ["    const out = Float64Array.from(params);\n    const headOff = L.seg[4].off;",
   "    const out = Float64Array.from(params);\n    const headOff = L.seg.find((sg) => sg.name === 'policyHead').off;   /* 11-10：按段名（obs5 插段后下标错位） */", 'SOLVER']],
);
console.log('按名查段完成 ' + n + ' 处');
