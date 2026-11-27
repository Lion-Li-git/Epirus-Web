import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const PACKS = [
  { id: 'TF-DR', path: 'docs/artifacts/TF-DR.bak' },
  { id: 'AR-TK2', path: 'docs/artifacts/AR-TK2.bak' },
  { id: 'PG-DR', path: 'docs/artifacts/PG-DR.bak' },
];
const NS = [2, 3, 5, 8], MODES = ['multi', 'long'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.TRANSFER_GAMES || 100);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const rows = [];

for (const pack of PACKS) {
  const params = loadChamp(W, pack.path);
  const base = T.policyChooserN(params, 0.15);
  for (const n of NS) for (const mode of MODES) {
    const row = { pack: pack.id, n, mode, games: 0, declared: 0, declaredGames: 0, paid: 0, damageEvents: 0, tankDamage: 0, invalidTarget: 0 };
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      let declared = false;
      const wrapped = (state, pid, legal) => {
        const pick = base(state, pid, legal);
        if (pid === seat && pick && pick.key === 'transfer') {
          declared = true;
          if (pick.target == null || pick.target === seat || state.p[pick.target]?.hp <= 0) row.invalidTarget++;
        }
        return pick;
      };
      const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
      const r = T.oneGameN(choosers, (930000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0, n, { mode });
      if (declared) row.declaredGames++;
      for (const e of r.state.events || []) {
        if (e.type === 'action' && e.pid === seat && e.key === 'transfer' && e.outcome === 'ok') row.declared++;
        if (e.type === 'transfer' && e.to === seat) row.paid++;
        if (e.type === 'damage' && e.to === seat) { row.damageEvents++; if (e.via === 'tank') row.tankDamage++; }
      }
      row.games++;
    }
    row.paidPerDeclared = row.declared ? row.paid / row.declared : null;
    rows.push(row);
  }
}
const header = ['pack', 'n', 'mode', 'games', 'declared', 'declaredGames', 'paid', 'damageEvents', 'tankDamage', 'invalidTarget', 'paidPerDeclared'];
writeFileSync(OUT + '/transfer-outcome-diagnostic.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
console.table(rows);
