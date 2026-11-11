const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
const rep = (a, b, tag) => { if (!s.includes(a)) { console.error('锚失败: ' + tag); process.exit(2); } s = s.split(a).join(b); };
/* forwardObs3：bias/headOff 改用已有的 segOff helper（WS/WA/WC/WK 那行 DS 时代就按名了） */
rep("    const seatBias = L.seg[0].off + L.seatH * L.seatIn;\n    const actBias = L.seg[1].off + L.actH * L.actIn;\n    const ctxBias = L.seg[2].off + L.hid * L.ctxDim;\n    const candBias = L.seg[3].off + L.hid2 * L.candIn;\n    const headOff = L.seg[4].off;\n    /* 权重起点每次决策取一次（不在逐候选循环里查段表） */\n    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');",
    "    /* 11-10：bias/headOff 一律按段名（obs5 在 seatEnc 后插了 attn/pma，seg[1..4] 下标假设不成立；obs3 族名字=下标，逐位不变） */\n    const seatBias = segOff('seatEnc') + L.seatH * L.seatIn;\n    const actBias = segOff('actEnc') + L.actH * L.actIn;\n    const ctxBias = segOff('ctx') + L.hid * L.ctxDim;\n    const candBias = segOff('cand') + L.hid2 * L.candIn;\n    const headOff = segOff('policyHead');\n    /* 权重起点每次决策取一次（不在逐候选循环里查段表） */\n    const WS = segOff('seatEnc'), WA = segOff('actEnc'), WC = segOff('ctx'), WK = segOff('cand');", 'FWD3');
/* head 解算器 */
rep("    const out = Float64Array.from(params);\n    const headOff = L.seg[4].off;",
    "    const out = Float64Array.from(params);\n    const headOff = L.seg.find((sg) => sg.name === 'policyHead').off;   /* 11-10：按段名（obs5 插段后下标错位） */", 'SOLVER');
fs.writeFileSync(F, s);
console.log('arch2 按名查段完成');
