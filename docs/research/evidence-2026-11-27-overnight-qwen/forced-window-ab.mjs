import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { tableWinCredits } from '../../../tools/arena-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const CASES = [
  { id: 'JN-DR', path: 'docs/artifacts/JN-DR.bak', skill: 'jinshield' },
  { id: 'HL-G1', path: 'docs/artifacts/HL-G1.bak', skill: 'jinshield' },
  { id: 'FS2-LE26', path: 'docs/artifacts/FS2-LE26.bak', skill: 'holo' },
];
const NS = [2, 3, 5, 8], MODES = ['multi', 'long'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.FORCED_GAMES || 100);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const rows = [];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(mean(xs.map((x) => x * x)) - mean(xs) * mean(xs));

for (const c of CASES) {
  const params = loadChamp(W, c.path);
  const base = T.policyChooserN(params, 0.15);
  for (const n of NS) for (const mode of MODES) {
    const deltas = [];
    let forcedPicks = 0, baseDmg = 0, forcedDmg = 0;
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      const seed = (950000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0;
      const run = (forced) => {
        const wrapped = (state, pid, legal) => {
          const pick = base(state, pid, legal);
          if (forced && pid === seat) {
            const l = legal.find((a) => a.key === c.skill && a.affordable);
            if (l) { forcedPicks++; return l; }
          }
          return pick;
        };
        const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
        const r = T.oneGameN(choosers, seed, n, { mode });
        const credit = tableWinCredits(T, r.state, n, seed)[seat];
        const dmg = (r.state.events || []).filter((e) => e.type === 'damage' && e.source === seat).reduce((s, e) => s + (e.amt || 0), 0);
        return { credit, dmg };
      };
      const b = run(false), f = run(true);
      deltas.push((f.credit - b.credit) * 100);
      baseDmg += b.dmg; forcedDmg += f.dmg;
    }
    rows.push({
      id: c.id, skill: c.skill, n, mode, games: GAMES,
      meanDeltaPt: mean(deltas), sdDeltaPt: sd(deltas),
      forcedPickPerGame: forcedPicks / GAMES,
      baseDmgPerGame: baseDmg / GAMES,
      forcedDmgPerGame: forcedDmg / GAMES,
    });
  }
}
const header = ['id', 'skill', 'n', 'mode', 'games', 'meanDeltaPt', 'sdDeltaPt', 'forcedPickPerGame', 'baseDmgPerGame', 'forcedDmgPerGame'];
writeFileSync(resolve(ROOT, OUT, 'forced-window-ab.tsv'), header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
writeFileSync(resolve(ROOT, OUT, 'forced-window-ab.json'), JSON.stringify(rows, null, 2));
console.table(rows);
