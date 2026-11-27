import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const PACKS = [
  { id: 'JN-DR', path: 'docs/artifacts/JN-DR.bak' },
  { id: 'HL-G1', path: 'docs/artifacts/HL-G1.bak' },
  { id: 'FS-DR', path: 'docs/artifacts/FS-DR.bak' },
  { id: 'FS2-LE26', path: 'docs/artifacts/FS2-LE26.bak' },
  { id: 'TK-FS4', path: 'docs/artifacts/TK-FS4.bak' },
  { id: 'RD-PG', path: 'docs/artifacts/RD-PG.bak' },
];
const SKILLS = ['jinshield', 'holo', 'firestorm', 'transfer'];
const NS = [2, 3, 5, 8], MODES = ['multi', 'long'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.WINDOW_GAMES || 60);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const rows = [];

for (const pack of PACKS) {
  const params = loadChamp(W, pack.path);
  const base = T.policyChooserN(params, 0.15);
  for (const n of NS) for (const mode of MODES) {
    const stats = Object.fromEntries(SKILLS.map((k) => [k, { decisions: 0, legal: 0, affordable: 0, picked: 0, ok: 0, damage: 0, transfer: 0 }]));
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      const wrapped = (state, pid, legal) => {
        const pick = base(state, pid, legal);
        if (pid === seat) {
          for (const skill of SKILLS) {
            const s = stats[skill];
            s.decisions++;
            const l = legal.find((a) => a.key === skill);
            if (l) s.legal++;
            if (l && l.affordable) s.affordable++;
            if (pick && pick.key === skill) s.picked++;
          }
        }
        return pick;
      };
      const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
      const result = T.oneGameN(choosers, (940000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0, n, { mode });
      for (const e of result.state.events || []) {
        for (const skill of SKILLS) {
          const s = stats[skill];
          if (e.type === 'action' && e.pid === seat && e.key === skill && e.outcome === 'ok') s.ok++;
          if (e.type === 'damage' && e.source === seat && e.via === skill) s.damage++;
          if (e.type === 'transfer' && e.from === seat && e.via === skill) s.transfer++;
        }
      }
    }
    for (const skill of SKILLS) {
      const s = stats[skill];
      rows.push({
        pack: pack.id, n, mode, skill, games: GAMES,
        affordableRate: s.decisions ? s.affordable / s.decisions : null,
        pickGivenAffordable: s.affordable ? s.picked / s.affordable : null,
        okPerGame: s.ok / GAMES,
        damagePerGame: s.damage / GAMES,
        transferPerGame: s.transfer / GAMES,
        pickedPerGame: s.picked / GAMES,
      });
    }
  }
}
const header = ['pack', 'n', 'mode', 'skill', 'games', 'affordableRate', 'pickGivenAffordable', 'okPerGame', 'damagePerGame', 'transferPerGame', 'pickedPerGame'];
writeFileSync(resolve(ROOT, OUT, 'new-rule-window-diagnostic.tsv'), header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
writeFileSync(resolve(ROOT, OUT, 'new-rule-window-diagnostic.json'), JSON.stringify(rows, null, 2));
console.table(rows);
