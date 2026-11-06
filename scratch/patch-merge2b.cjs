const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');

// 1) WIDE_FINAL 放宽：可由探针喂参照（gate 或 probe 二选一开）
const a1 = "if (WIDE_FINAL && GA_GATE <= 0) {\n  console.error('[wide-final] ⛔ EPIRUS_WIDE_FINAL 要与 EPIRUS_GA_GATE 同开——同一把尺的参照（GA_INC，起点同 n 读数）来自门槛；单开没有\"同尺\"可讲');\n  process.exit(2);\n}";
if (!s.includes(a1)) { console.error('f1'); process.exit(1); }
s = s.replace(a1, `if (WIDE_FINAL && GA_GATE <= 0 && !HALL_PROBE) {
  console.error('[wide-final] ⛔ EPIRUS_WIDE_FINAL 要与 EPIRUS_GA_GATE 同开（或 HALL_TRACE_PROBE=1 由探针喂同一把尺的参照）；单开没有"同尺"可讲');
  process.exit(2);
}`);

// 2) 探针读数带 fit + wideScore（bestWideSeen 同键）
const a2 = "        pr.push({ gi: pi, wid: widOfArr(scored[pi].params),\n          gMulti: +pm.gMulti.toFixed(2), gLong: +pm.gLong.toFixed(2),";
if (!s.includes(a2)) { console.error('f2'); process.exit(1); }
s = s.replace(a2, "        pr.push({ gi: pi, wid: widOfArr(scored[pi].params), fit: +scored[pi].r.fit.toFixed(4), wideScore: +(pm.landMulti + pm.landLong).toFixed(2),\n          gMulti: +pm.gMulti.toFixed(2), gLong: +pm.gLong.toFixed(2),");

// 3) 探针块内也做 bestWideSeen 追踪（与门槛块同键 = fit-max）
const a3 = "      rec.probe = { ref: PROBE_INC ? { lm: +PROBE_INC.landMulti.toFixed(2), ll: +PROBE_INC.landLong.toFixed(2) } : null, reads: pr };";
if (!s.includes(a3)) { console.error('f3'); process.exit(1); }
s = s.replace(a3, `      if (WIDE_FINAL) {
        for (const r of pr) {
          if (!r.wide) continue;
          if (!bestWideSeen || r.fit > bestWideSeen.fit) {
            bestWideSeen = { params: Float64Array.from(scored[r.gi].params), wid: r.wid,
              gen: gen, fit: r.fit, wideScore: r.wideScore, gMulti: pm(r).gMulti, gLong: pm(r).gLong, landMulti: pm(r).landMulti, landLong: pm(r).landLong };
          }
        }
      }
      rec.probe = { ref: PROBE_INC ? { lm: +PROBE_INC.landMulti.toFixed(2), ll: +PROBE_INC.landLong.toFixed(2) } : null, reads: pr };`);

// 4) 终局宽选的参照回退：GA_INC || PROBE_INC
const a4 = "    const m = wideMetricsOf(e.ref.params);\n    m.wide = (m.gMulti >= GA_KINDS && m.gLong >= GA_KINDS) && (GA_INC ? isWideVs(m, GA_INC) : true);";
if (!s.includes(a4)) { console.error('f4'); process.exit(1); }
s = s.replace(a4, "      const m = wideMetricsOf(e.ref.params);\n      const INC = GA_INC || PROBE_INC;   /* v4/2b：参照 = 门槛或探针（同一函数同一定义，谁开用谁） */\n      m.wide = (m.gMulti >= GA_KINDS && m.gLong >= GA_KINDS) && (INC ? isWideVs(m, INC) : true);");

fs.writeFileSync('tools/train-3p.mjs', s);
console.log('2b wired');

function pm(r) { return r; }   /* 读数字段已在 r 上 */
