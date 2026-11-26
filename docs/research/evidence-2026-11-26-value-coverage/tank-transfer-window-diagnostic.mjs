import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const PACKS = [
  { id: 'AR-TK2', path: 'docs/artifacts/AR-TK2.bak' },
  { id: 'TK-FS4', path: 'docs/artifacts/TK-FS4.bak' },
  { id: 'TF-DR', path: 'docs/artifacts/TF-DR.bak' },
  { id: 'PG-CN', path: 'docs/artifacts/PG-CN.bak' },
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
    const row = { pack: pack.id, n, mode, games: 0 };
    for (const skill of ['tank', 'transfer']) row[skill] = { decisions: 0, legal: 0, affordable: 0, picked: 0, hpSum: 0, epSum: 0 };
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      const wrapped = (state, pid, legal) => {
        const pick = base(state, pid, legal);
        if (pid === seat) {
          const me = state.p[pid];
          for (const skill of ['tank', 'transfer']) {
            const r = row[skill];
            r.decisions++; r.hpSum += me.hp || 0; r.epSum += me.ep || 0;
            const l = legal.find((a) => a.key === skill);
            if (l) r.legal++;
            if (l && l.affordable) r.affordable++;
            if (pick && pick.key === skill) r.picked++;
          }
        }
        return pick;
      };
      const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
      T.oneGameN(choosers, (920000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0, n, { mode });
      row.games++;
    }
    for (const skill of ['tank', 'transfer']) {
      const r = row[skill];
      r.legalRate = r.decisions ? r.legal / r.decisions : null;
      r.affordableRate = r.decisions ? r.affordable / r.decisions : null;
      r.pickGivenAffordable = r.affordable ? r.picked / r.affordable : null;
      r.avgHp = r.decisions ? r.hpSum / r.decisions : null;
      r.avgEp = r.decisions ? r.epSum / r.decisions : null;
      rows.push({ pack: pack.id, n, mode, games: row.games, skill, ...r });
    }
  }
}
const header = ['pack', 'n', 'mode', 'games', 'skill', 'decisions', 'legal', 'affordable', 'picked', 'legalRate', 'affordableRate', 'pickGivenAffordable', 'avgHp', 'avgEp'];
writeFileSync(OUT + '/tank-transfer-window-diagnostic.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
console.table(rows);
