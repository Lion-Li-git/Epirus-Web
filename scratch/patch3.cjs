const fs = require('fs');
const p = 'tools/probe-cem-arm.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('ARENA_DIVK')) { console.log('already'); process.exit(0); }
const ac = "    const r = ARENA.evalParams(params, { phase: 'loop', gen: gen, games: GAMES, temp: ARENA_TEMP, cur: ARENA_CUR });\n    return { fit: r.score, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard };";
if (!s.includes(ac)) { console.error('anchor missing'); process.exit(1); }
const rep = "    const r = ARENA.evalParams(params, { phase: 'loop', gen: gen, games: GAMES, temp: ARENA_TEMP, cur: ARENA_CUR });\n" +
  "    /* `--arenaDivK=`（ZCode · 11-01 凌晨，'广而强'合成实验）：fit += DivK × 非 ji 出手种类数。\n" +
  "     *   只住 CEM 路的 loop 评估；与 mastery 门同开时在门口拒跑（门与正则共用一个 fit 会互相说不清）。 */\n" +
  "    let dvFit = r.score;\n" +
  "    if (ARENA_DIVK > 0 && r.cat) { let dvc = 0; for (const k in r.cat) if (k !== R.SK.JI) dvc++; dvFit += ARENA_DIVK * dvc; }\n" +
  "    return { fit: dvFit, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard };";
s = s.replace(ac, rep);
s = s.replace("'arenaPool', 'arenaShapes'], 'probe-cem-arm');", "'arenaPool', 'arenaShapes', 'arenaDivK'], 'probe-cem-arm');");
const decl = "const ARENA_CUR = String(arg('arenaCur', 'net'));";
if (!s.includes(decl)) { console.error('decl anchor missing'); process.exit(1); }
s = s.replace(decl, decl + "\nconst ARENA_DIVK = Number(arg('arenaDivK', 0)) || 0;   /* 0 = 关；>0 时与 mastery 门互斥（见下） */");
// mastery 互斥闸：MASTERY_ON 定义之后再查
const mAnchor = "let auditsBefore = 0;   /* mastery 门的本代审计起点（每代重置） */";
if (!s.includes(mAnchor)) { console.error('m anchor missing'); process.exit(1); }
s = s.replace(mAnchor, "if (MASTERY_ON && ARENA_DIVK > 0) { console.error('⛔ --arenaDivK 与 --masteryKey 同开 ⇒ 两个判据共用一个 fit 说不清，拒跑'); process.exit(2); }\n" + mAnchor);
fs.writeFileSync(p, s);
console.log('divK wired');
