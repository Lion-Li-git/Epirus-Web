import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp, mulberry32 } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const PACKS = [
  { id: 'PG-CN', path: 'docs/artifacts/PG-CN.bak' },
  { id: 'PG-DR', path: 'docs/artifacts/PG-DR.bak' },
  { id: 'FS2-LE26', path: 'docs/artifacts/FS2-LE26.bak' },
  { id: 'T65-RINGBEAD', path: 'docs/artifacts/T65-RINGBEAD.bak' },
];
const NS = [2, 3, 5, 8], MODES = ['multi', 'long'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.WINDOW_GAMES || 100);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const rows = [];

for (const pack of PACKS) {
  const params = loadChamp(W, pack.path);
  const base = T.policyChooserN(params, 0.15);
  for (const n of NS) for (const mode of MODES) {
    const row = { pack: pack.id, n, mode, games: 0, decisions: 0, legal: 0, affordable: 0, picked: 0,
      legalWithEp: 0, affordableWithEp: 0, epSum: 0, hpSum: 0, aliveSum: 0 };
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      const wrapped = (state, pid, legal) => {
        const pick = base(state, pid, legal);
        if (pid === seat) {
          row.decisions++;
          const me = state.p[pid];
          row.epSum += me.ep || 0; row.hpSum += me.hp || 0;
          row.aliveSum += state.p.filter((p) => p.hp > 0).length;
          const l = legal.find((a) => a.key === 'railgun');
          if (l) row.legal++;
          if (l && l.affordable) row.affordable++;
          if (l && (me.elec || 0) > 0) row.legalWithEp++;
          if (l && l.affordable && (me.elec || 0) > 0) row.affordableWithEp++;
          if (pick && pick.key === 'railgun') row.picked++;
        }
        return pick;
      };
      const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
      T.oneGameN(choosers, (910000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0, n, { mode });
      row.games++;
    }
    row.legalRate = row.decisions ? row.legal / row.decisions : null;
    row.affordableRate = row.decisions ? row.affordable / row.decisions : null;
    row.pickGivenAffordable = row.affordable ? row.picked / row.affordable : null;
    row.avgEp = row.decisions ? row.epSum / row.decisions : null;
    row.avgHp = row.decisions ? row.hpSum / row.decisions : null;
    row.avgAlive = row.decisions ? row.aliveSum / row.decisions : null;
    rows.push(row);
  }
}
const header = ['pack', 'n', 'mode', 'games', 'decisions', 'legal', 'affordable', 'picked', 'legalWithEp', 'affordableWithEp', 'legalRate', 'affordableRate', 'pickGivenAffordable', 'avgEp', 'avgHp', 'avgAlive'];
writeFileSync(OUT + '/railgun-window-diagnostic.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
console.table(rows);
