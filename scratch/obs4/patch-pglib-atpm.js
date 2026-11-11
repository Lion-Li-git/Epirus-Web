/* layoutOf 补 AT/PM 偏移 + 重放/反传入口加响亮守卫（undefined 偏移 → NaN → falsy 吞掉的静默零） */
const fs = require('fs');
const F = 'tools/proto2/pg-lib.mjs';
let s = fs.readFileSync(F, 'utf8');
const rep = (a, b, tag) => { if (!s.includes(a)) { console.error('锚失败: ' + tag); process.exit(2); } s = s.split(a).join(b); };
rep("    is4: L.input === 'obs4', is5: L.input === 'obs5', selfDim: L.selfDim,",
    "    is4: L.input === 'obs4', is5: L.input === 'obs5', selfDim: L.selfDim,\n    /* obs5 聚合段的偏移（缺了就是 NaN 静默零——必须在入口守卫里响亮红） */\n    AT: (L.seg.find((x) => x.name === 'attn') || {}).off,\n    PM: (L.seg.find((x) => x.name === 'pma') || {}).off,", 'ATPM');
rep("  if (ly.is5) return tapeForward5(tape, params, ly);   /* obs5：注意力重放（陈旧性不存在：嵌入每步从 svs 重建） */",
    "  if (ly.is5) { if (ly.AT == null || ly.PM == null) throw new Error('tapeForward: obs5 的 AT/PM 偏移缺失 ⇒ layoutOf 没对上段表'); return tapeForward5(tape, params, ly); }   /* obs5：注意力重放（陈旧性不存在：嵌入每步从 svs 重建） */", 'G1');
rep("  if (ly.is5) return tapeBackward5(tape, params, ly, act, upstream, grad);",
    "  if (ly.is5) { if (ly.AT == null || ly.PM == null) throw new Error('tapeBackward: obs5 的 AT/PM 偏移缺失'); return tapeBackward5(tape, params, ly, act, upstream, grad); }", 'G2');
fs.writeFileSync(F, s);
console.log('AT/PM 补齐 + 守卫完成');
