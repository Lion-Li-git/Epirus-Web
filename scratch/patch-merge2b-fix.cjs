const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');
// 1) pm(r) → 直接字段（探针读数自带 gMulti 等）
s = s.replace(/bestWideSeen = \{ params: Float64Array\.from\(scored\[r\.gi\]\.params\), wid: r\.wid,\n\s*gen: gen, fit: r\.fit, wideScore: r\.wideScore, gMulti: pm\(r\)\.gMulti, gLong: pm\(r\)\.gLong, landMulti: pm\(r\)\.landMulti, landLong: pm\(r\)\.landLong \};/,
  'bestWideSeen = { params: Float64Array.from(scored[r.gi].params), wid: r.wid,\n            gen: gen, fit: r.fit, wideScore: r.wideScore, gMulti: r.gMulti, gLong: r.gLong, landMulti: r.landMulti, landLong: r.landLong };');
// 2) 函数声明删掉
s = s.replace("\nfunction pm(r) { return r; }   /* 读数字段已在 r 上 */", "");
// 3) HALL_PROBE 声明挪到 WIDE_FINAL 守卫之前（避免 TDZ）
const hp = "const HALL_PROBE = Number(process.env.EPIRUS_HALL_TRACE_PROBE || 0);\nlet PROBE_INC;   /* 探针参照：种子包同口径量一次（与 GA_INC 同式；GA_GATE 关时也成立） */\n";
if (!s.includes(hp)) { console.error('hp anchor missing'); process.exit(1); }
s = s.replace(hp, "");
const wf = "const WIDE_FINAL = Number(process.env.EPIRUS_WIDE_FINAL || 0);";
if (!s.includes(wf)) { console.error('wf anchor missing'); process.exit(1); }
s = s.replace(wf, hp + wf);
fs.writeFileSync('tools/train-3p.mjs', s);
console.log('2b fixes applied');
