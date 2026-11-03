const fs = require('fs');
const p = 'tools/proto2/supfit-gd.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes("TEACHER === 'minit'")) { console.log('already'); process.exit(0); }
if (!s.includes("from './skill-mastery.mjs'")) {
  const ai = "import { pickChain } from './chain-lib.mjs';";
  if (!s.includes(ai)) { console.error('a1'); process.exit(1); }
  s = s.replace(ai, ai + "\nimport { scanChargeRounds } from './skill-mastery.mjs';             // miniT 预示式代理的单一来源（千问 §二十三）");
}
const anchor = "  : TEACHER === 'chainmix'";
if (!s.includes(anchor)) { console.error('a2'); process.exit(1); }
s = s.replace(anchor, "  : TEACHER === 'minit'\n    ? (state, pid, cs) => miniTPick(state, pid, cs) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]\n" + anchor);
const hAnchor = "  return hit[0];\n};";
if (!s.includes(hAnchor)) { console.error('a3'); process.exit(1); }
const helper = [
  '',
  '/* miniT 预示式教师（换道后的小雷路线，ZCode · 11-01 深夜）：对 [ep≥2 ∧ 最近 4 回合内 ok 蓄过珠] 的席出小雷',
  ' *   （判据=千问 §二十三 的新代理，precision→railgun 87.99%×7.62）；无这样的席 ⇒ 回落链（保强底盘）。',
  ' *   回合计数与打分尺同源（scanChargeRounds，newturn 进格）。 */',
  'const miniTPick = (state, pid, cs) => {',
  '  const chargeRound = {};',
  '  for (const z of scanChargeRounds(state.events || [], R)) chargeRound[z.pid] = z.round;',
  '  const now = state.round || 1;',
  '  let best = null, bestEp = -1;',
  '  for (let i = 0; i < (state.p || []).length; i++) {',
  '    const o = state.p[i];',
  '    if (!o || i === pid || (o.hp || 0) <= 0) continue;',
  '    if ((o.ep || 0) < 2) continue;',
  '    const cr = chargeRound[i];',
  '    if (cr == null) continue;',
  '    const gap = now - cr;',
  '    if (!(gap >= 0 && gap <= 4)) continue;',
  '    if ((o.ep || 0) > bestEp) { bestEp = o.ep; best = i; }',
  '  }',
  '  if (best == null) return null;',
  '  const hit = cs.filter((c) => c.key === R.SK.MINI_T && c.target === best);',
  '  return hit.length ? hit[0] : null;',
  '};',
].join('\n');
s = s.replace(hAnchor, hAnchor + '\n' + helper);
fs.writeFileSync(p, s);
console.log('minit teacher wired');
