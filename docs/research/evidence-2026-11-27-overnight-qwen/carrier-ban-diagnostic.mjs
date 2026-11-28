import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { tableWinCredits } from '../../../tools/arena-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const CASES = [
  { id: 'AM', pack: 'docs/artifacts/nov21-armor-tzt2d.bak', keys: ['snipe', 'armor', 'gun', 'reflect'] },
  { id: 'TF', pack: 'docs/artifacts/TF2-DR.bak', keys: ['gun', 'reflect', 'guard'] },
];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const GAMES = Number(process.env.CARRIER_GAMES || 200);
const W = sandbox(ROOT), T = W.EpirusTrainer, B = W.EpirusBots;
const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(mean(xs.map((x) => x * x)) - mean(xs) * mean(xs));
const rows = [];

for (const c of CASES) {
  const params = loadChamp(W, c.pack);
  const base = T.policyChooserN(params, 0.15);
  for (let oi = 0; oi < OPPONENTS.length; oi++) {
    const ban = [], force = [];
    let banned = 0, forced = 0;
    for (let g = 0; g < GAMES; g++) {
      const seat = g % 5;
      const seed = (970000 + 5 * 1000003 + g * 977 + oi * 100003) >>> 0;
      const run = (mode) => {
        const wrapped = (state, pid, legal) => {
          if (pid !== seat) return base(state, pid, legal);
          if (mode === 'ban') {
            const filtered = legal.filter((a) => !c.keys.includes(a.key));
            if (filtered.length !== legal.length) banned++;
            return base(state, pid, filtered.length ? filtered : legal);
          }
          if (mode === 'force') {
            const pick = legal.find((a) => a.affordable && c.keys.includes(a.key));
            if (pick) { forced++; return pick; }
          }
          return base(state, pid, legal);
        };
        const choosers = Array.from({ length: 5 }, (_, pid) => pid === seat ? wrapped : opp[(pid + oi) % opp.length]);
        const r = T.oneGameN(choosers, seed, 5, { mode: 'multi' });
        return tableWinCredits(T, r.state, 5, seed)[seat];
      };
      const b = run('base'), x = run('ban'), f = run('force');
      ban.push((x - b) * 100);
      force.push((f - b) * 100);
    }
    rows.push({ id: c.id, opponent: OPPONENTS[oi], games: GAMES,
      banMeanPt: mean(ban), banSePt: sd(ban) / Math.sqrt(GAMES),
      forceMeanPt: mean(force), forceSePt: sd(force) / Math.sqrt(GAMES),
      bannedPerGame: banned / GAMES, forcedPerGame: forced / GAMES });
  }
}
const summary = CASES.map((c) => {
  const rs = rows.filter((r) => r.id === c.id);
  return { id: c.id, banMeanPt: mean(rs.map((r) => r.banMeanPt)),
    opponentsNegative: rs.filter((r) => r.banMeanPt < 0).length,
    pass: mean(rs.map((r) => r.banMeanPt)) <= -2 && rs.filter((r) => r.banMeanPt < 0).length >= 3 };
});
const header = ['id', 'opponent', 'games', 'banMeanPt', 'banSePt', 'forceMeanPt', 'forceSePt', 'bannedPerGame', 'forcedPerGame'];
writeFileSync(resolve(ROOT, OUT, 'carrier-ban-diagnostic.tsv'), header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
writeFileSync(resolve(ROOT, OUT, 'carrier-ban-diagnostic.json'), JSON.stringify({ rows, summary }, null, 2));
console.table(rows);
console.table(summary);
