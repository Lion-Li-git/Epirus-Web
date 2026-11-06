const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');

// 1) env allowlist
const a1 = "'EPIRUS_GA_GATE', 'EPIRUS_GA_GATE_GAMES', 'EPIRUS_GA_BAND', 'EPIRUS_STALL_ABORT',";
if (!s.includes(a1)) { console.error('f1'); process.exit(1); }
s = s.replace(a1, a1 + "\n  'EPIRUS_HALL_TRACE', 'EPIRUS_HALL_TRACE_OUT',   // 11-01 晚（ZCode · 千问交接 §五.3）：逐代名人堂/门槛指纹落盘（默认关 ⇒ 一条行为不变）");

// 2) consts + banner，放在 GA_GATE_GAMES 常量之后
const a2 = "const GA_GATE_GAMES = Math.max(2, Number(process.env.EPIRUS_GA_GATE_GAMES || 6) || 6);";
if (!s.includes(a2)) { console.error('f2'); process.exit(1); }
s = s.replace(a2, a2 + `

/* ===== 11-01 晚（ZCode · 千问交接件 §五.3）：逐代名人堂/门槛指纹 =====
 * 病：§廿五 那条"末代 top-3 过线粒 ≠ 产物"目前靠门槛自检打印 + 产物重读**夹出来**，没有逐代个体指纹
 *   ⇒ "终局当选从名人堂挑了另一粒"只是推断。本开关把每一代的 {top3 指纹, 门槛读数, 准入后名人堂} 追加落 JSONL，
 *   终局当选时再补一行 final（当选粒指纹 + 名人堂全家）⇒ 机制可以从"推断"升成"账面"。
 * 默认关：一个 env 读取 + 一个 if ⇒ 逐字原行为（回归腿：默认关轨迹逐字同）。 */
const HALL_TRACE = Number(process.env.EPIRUS_HALL_TRACE || 0);
const HALL_TRACE_OUT = String(process.env.EPIRUS_HALL_TRACE_OUT || ('scratch/hall-trace/' + (process.env.EPIRUS_ARM || 'arm') + '.jsonl'));
if (HALL_TRACE) {
  try { mkdirSync(HALL_TRACE_OUT.replace(/\\\\[^\\\\]*$/, '') || '.', { recursive: true }); } catch (eTrace) {}
  try { unlinkSync(HALL_TRACE_OUT); } catch (eTrace2) {}
  console.log('[hall-trace] 每代指纹 → ' + HALL_TRACE_OUT + '（EPIRUS_HALL_TRACE=1；指纹 = widOfArr，与名人堂去重同式）');
}`);

// 3) gate 块：reads 提到外层
const a3 = "  let gateRank = null;\n  if (GA_GATE > 0) {";
if (!s.includes(a3)) { console.error('f3'); process.exit(1); }
s = s.replace(a3, "  let gateRank = null;\n  let gateReads = null;   /* hall-trace 用：本代 top-3 的门槛读数（hall-trace 关时为 null） */\n  if (GA_GATE > 0) {");

const a4 = "    let rank = reads.filter((r) => r.m.wide);";
if (!s.includes(a4)) { console.error('f4'); process.exit(1); }
s = s.replace(a4, "    gateReads = reads;\n    let rank = reads.filter((r) => r.m.wide);");

// 4) 每代指纹：addHall if/else 块之后
const a5 = "  } else {\n  addHall(scored[0].params, scored[0].r.fit);\n  addHall(scored[1].params, scored[1].r.fit);\n  }";
if (!s.includes(a5)) { console.error('f5'); process.exit(1); }
s = s.replace(a5, a5 + `
  if (HALL_TRACE) {
    const rec = { gen: gen, bestFit: +(scored[0].r.fit.toFixed(4)),
      top3: scored.slice(0, 3).map(function (x, i) { return { gi: i, wid: widOfArr(x.params), fit: +(x.r.fit.toFixed(4)) }; }),
      hall: hall.map(function (h) { return h.wid; }) };
    if (gateReads) rec.gate = { kinds: GA_KINDS, rank: gateRank,
      reads: gateReads.map(function (r) { return { gi: r.gi, wid: widOfArr(scored[r.gi].params), fit: +(r.fit.toFixed(4)),
        gMulti: +r.m.gMulti.toFixed(2), gLong: +r.m.gLong.toFixed(2),
        landMulti: +r.m.landMulti.toFixed(2), landLong: +r.m.landLong.toFixed(2), wide: !!r.m.wide, wideScore: +r.wideScore.toFixed(2) }; }) };
    try { appendFileSync(HALL_TRACE_OUT, JSON.stringify(rec) + '\\n'); } catch (eT3) { console.error('[hall-trace] ⛔ 写不出：' + eT3.message); }
  }`);

// 5) 终局指纹：final pick 定格处
const a6 = "  if (sel.best) { finalParams = sel.best.ref.params; ev = sel.best.ev; }";
if (!s.includes(a6)) { console.error('f6'); process.exit(1); }
s = s.replace(a6, a6 + "\n  if (HALL_TRACE) { try { appendFileSync(HALL_TRACE_OUT, JSON.stringify({ type: 'final', pickedWid: widOfArr(finalParams), hall: hall.map(function (h) { return h.wid; }) }) + '\\n'); } catch (eT4) {} }");

fs.writeFileSync('tools/train-3p.mjs', s);
console.log('hall-trace wired');
