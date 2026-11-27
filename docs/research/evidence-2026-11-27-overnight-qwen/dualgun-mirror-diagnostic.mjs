import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const table = readFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8').replace(/\r/g, '').trim().split('\n');
const head = table[0].split('\t');
const packs = table.slice(1).map((line) => {
  const c = line.split('\t');
  return { id: c[head.indexOf('id')], tier: c[head.indexOf('tier')], path: c[head.indexOf('path')] };
});
const NS = [3, 5, 8], MODES = ['multi', 'long'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.DM_GAMES || 10);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const rows = [];

for (const pack of packs) {
  let params;
  try { params = loadChamp(W, pack.path); } catch (e) { continue; }
  if (!params) continue;
  const base = T.policyChooserN(params, 0.15);
  const stats = Object.fromEntries(['dualGun', 'mirror'].map((k) => [k, { decisions: 0, legal: 0, affordable: 0, picked: 0, ok: 0, validTarget2: 0, mirrorEvents: 0 }]));
  for (const n of NS) for (const mode of MODES) {
    for (let g = 0; g < GAMES; g++) {
      const seat = g % n;
      const wrapped = (state, pid, legal) => {
        const pick = base(state, pid, legal);
        if (pid === seat) {
          for (const skill of ['dualGun', 'mirror']) {
            const s = stats[skill];
            s.decisions++;
            const l = legal.find((a) => a.key === skill);
            if (l) s.legal++;
            if (l && l.affordable) s.affordable++;
            if (pick && pick.key === skill) {
              s.picked++;
              if (skill === 'dualGun') {
                const t2 = pick.target2;
                if (t2 != null && t2 !== pid && t2 !== pick.target && state.p[t2] && state.p[t2].hp > 0) s.validTarget2++;
              }
            }
          }
        }
        return pick;
      };
      const choosers = Array.from({ length: n }, (_, pid) => pid === seat ? wrapped : opp[(pid + g) % opp.length]);
      const r = T.oneGameN(choosers, (960000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977) >>> 0, n, { mode });
      for (const e of r.state.events || []) {
        if (e.type === 'action' && e.pid === seat && (e.key === 'dualGun' || e.key === 'mirror') && e.outcome === 'ok') stats[e.key].ok++;
        if (e.type === 'mirror' && e.pid === seat) stats.mirror.mirrorEvents++;
      }
    }
  }
  for (const skill of ['dualGun', 'mirror']) {
    const s = stats[skill];
    rows.push({
      id: pack.id, tier: pack.tier, skill,
      affordableRate: s.decisions ? s.affordable / s.decisions : null,
      pickGivenAffordable: s.affordable ? s.picked / s.affordable : null,
      pickedPerGame: s.picked / (NS.length * MODES.length * GAMES),
      ok: s.ok,
      validTarget2: s.validTarget2,
      mirrorEvents: s.mirrorEvents,
    });
  }
}
const header = ['id', 'tier', 'skill', 'affordableRate', 'pickGivenAffordable', 'pickedPerGame', 'ok', 'validTarget2', 'mirrorEvents'];
writeFileSync(resolve(ROOT, OUT, 'dualgun-mirror-diagnostic.tsv'), header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
writeFileSync(resolve(ROOT, OUT, 'dualgun-mirror-diagnostic.json'), JSON.stringify(rows, null, 2));
console.table(rows);
