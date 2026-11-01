const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');

// 1) allowlist
const a1 = "'EPIRUS_HALL_TRACE', 'EPIRUS_HALL_TRACE_OUT',";
if (!s.includes(a1)) { console.error('f1'); process.exit(1); }
s = s.replace(a1, a1 + "\n  'EPIRUS_WIDE_FINAL',   // 11-01 深（ZCode · PREREG-2026-11-01-WIDE-FINAL）：v4 终局同尺（默认关）");

// 2) 常量 + 拒绝单开
const a2 = "const HALL_TRACE = Number(process.env.EPIRUS_HALL_TRACE || 0);";
if (!s.includes(a2)) { console.error('f2'); process.exit(1); }
s = s.replace(a2, `const WIDE_FINAL = Number(process.env.EPIRUS_WIDE_FINAL || 0);
if (WIDE_FINAL && GA_GATE <= 0) {
  console.error('[wide-final] ⛔ EPIRUS_WIDE_FINAL 要与 EPIRUS_GA_GATE 同开——同一把尺的参照（GA_INC，起点同 n 读数）来自门槛；单开没有"同尺"可讲');
  process.exit(2);
}
let bestWideSeen = null;   /* v4：全程最宽粒快照（参数拷贝 ⇒ 育种变异不穿透） */
let WIDE_FINAL_PICK = null;
` + a2);

// 3) 门槛块内追踪
const a3 = "    gateReads = reads;\n    let rank = reads.filter((r) => r.m.wide);";
if (!s.includes(a3)) { console.error('f3'); process.exit(1); }
s = s.replace(a3, `    gateReads = reads;
    if (WIDE_FINAL) {
      for (const r of reads) {
        if (!r.m.wide) continue;
        if (!bestWideSeen || r.wideScore > bestWideSeen.wideScore) {
          bestWideSeen = { params: Float64Array.from(scored[r.gi].params), wid: widOfArr(scored[r.gi].params),
            gen: gen, wideScore: r.wideScore, gMulti: r.m.gMulti, gLong: r.m.gLong, landMulti: r.m.landMulti, landLong: r.m.landLong };
        }
      }
    }
    let rank = reads.filter((r) => r.m.wide);`);

// 4) 终局池追加（HALL_SEED 块之后、hallEntries 之前）
const a4 = "const hallEntries = [];";
if (!s.includes(a4)) { console.error('f4'); process.exit(1); }
s = s.replace(a4, `let WIDE_FINAL_APPENDED = false;
if (WIDE_FINAL && bestWideSeen && !hall.some(function (h) { return (HALL_DEDUP && h.wid === bestWideSeen.wid) || h.params === bestWideSeen.params; })) {
  hall.push({ params: bestWideSeen.params, fit: null, wid: bestWideSeen.wid });
  WIDE_FINAL_APPENDED = true;
  console.log('[wide-final] 全程最宽粒入终局池：gen ' + bestWideSeen.gen + ' wideScore ' + bestWideSeen.wideScore.toFixed(2) +
    '（' + bestWideSeen.gMulti.toFixed(1) + '/' + bestWideSeen.gLong.toFixed(1) + 'G ‖ ' + bestWideSeen.landMulti.toFixed(2) + '/' + bestWideSeen.landLong.toFixed(2) + '兑）wid ' + bestWideSeen.wid.slice(0, 10));
}
` + a4);

// 5) 终局宽选：挂在"终局定格"行之前（所有既有 veto 之后、finalParams 消费 sel.best 之前）
const a5 = "  if (sel.best) { finalParams = sel.best.ref.params; ev = sel.best.ev; }";
if (!s.includes(a5)) { console.error('f5'); process.exit(1); }
s = s.replace(a5, `/* ===== v4（PREREG-2026-11-01-WIDE-FINAL）：终局同一把宽尺 =====
 * 对幸存候选用与演化门槛**同一把尺**（wideMetricsOf ‖ 同参照 GA_INC ‖ 同谓词 kinds≥3 ∧ isWideVs）
 * ⇒ 宽中取重验分最高者为产物；无宽粒 ⇒ 保留原产物 + wideFinalAllNarrow 响亮。只换"最后一句话谁说"，训练侧零变化。 */
if (WIDE_FINAL) {
  const cands = (sel.clean && sel.clean.length) ? sel.clean : (sel.best ? [sel.best] : []);
  const wreads = [];
  for (const e of cands) {
    const m = wideMetricsOf(e.ref.params);
    m.wide = (m.gMulti >= GA_KINDS && m.gLong >= GA_KINDS) && (GA_INC ? isWideVs(m, GA_INC) : true);
    wreads.push({ e: e, m: m });
    console.log('[wide-final]   候选 trainFit=' + (typeof e.ref.fit === 'number' ? e.ref.fit.toFixed(3) : '追加') +
      ' → ' + m.gMulti.toFixed(1) + '/' + m.gLong.toFixed(1) + 'G ‖ ' + m.landMulti.toFixed(2) + '/' + m.landLong.toFixed(2) + '兑 ' + (m.wide ? '宽✔' : '窄✘'));
  }
  const wides = wreads.filter(function (r) { return r.m.wide; });
  if (wides.length) {
    wides.sort(function (a, b) { return b.e.score - a.e.score; });
    const w0 = wides[0];
    const changed = sel.best !== w0.e;
    if (changed) console.log('[wide-final] **换人**：宽粒（score ' + w0.e.score.toFixed(3) + '，wideScore ' + w0.m.landMulti.toFixed(2) + '+' + w0.m.landLong.toFixed(2) + '）取代原当选');
    else console.log('[wide-final] 原当选本来就是宽粒 ⇒ 不换人');
    sel.best = w0.e;
    WIDE_FINAL_PICK = { wideN: wides.length, of: cands.length, changed: changed, allNarrow: false };
  } else {
    console.error('[wide-final] ⛔ 终局池无一宽粒（wideFinalAllNarrow）⇒ 保留原产物，这粒按预注册不许当"宽产物"引用');
    WIDE_FINAL_PICK = { wideN: 0, of: cands.length, changed: false, allNarrow: true };
  }
}
` + a5);

fs.writeFileSync('tools/train-3p.mjs', s);
console.log('wide-final wired (v2)');
