import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const readTable = (p) => {
  const lines = readFileSync(p, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const h = lines[0].split('\t');
  return lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v])));
};
const pool = readTable(ROOT + '/champion-map/data/page/pool-members.tsv');
const reg = new Map(readTable(ROOT + '/champion-map/data/registry.tsv').map((r) => [r.pack_id, r]));
const arena = new Map(readTable(ROOT + '/champion-map/data/arena-noise-floor-1118.tsv').map((r) => [r.pack_id, Number(r.arenaB)]));
const rows = pool.map((p) => {
  const j = JSON.parse(readFileSync(`${ROOT}/champion-map/data/skill-report/${p.id}.json`, 'utf8'));
  const b = j.stage1.bead || {}, gained = (b.elecGained || 0) + (b.boomGained || 0), expired = (b.elecExpired || 0) + (b.boomExpired || 0);
  const c = j.stage1.closure || {};
  return { pack: p.id, tier: p.tier, fam: reg.get(p.id).fam, win: j.stage1.winRate, union: j.stage1.unionN,
    gained, expired, waste: gained ? expired / gained : null, chargeRate: c.charge && c.charge.rate,
    rodRate: c.rod && c.rod.rate, holoRate: c.holo && c.holo.rate, fireRate: c.firestorm && c.firestorm.rate,
    arenaB: arena.get(p.id), seatKill: Number(p.seatKill) };
});
rows.sort((a, b) => a.tier === b.tier ? (b.waste || 0) - (a.waste || 0) : (a.tier === 'hard' ? -1 : 1));
const header = ['pack', 'tier', 'fam', 'win', 'union', 'gained', 'expired', 'waste', 'chargeRate', 'rodRate', 'holoRate', 'fireRate', 'arenaB', 'seatKill'];
writeFileSync(OUT + '/replacement-priority.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k] == null ? '' : r[k]).join('\t')).join('\n') + '\n');
const cand = [];
for (const r of rows) {
  const alts = rows.filter((x) => x.pack !== r.pack && x.waste != null && r.waste != null && x.waste <= r.waste - 0.15 && x.win >= r.win - 0.01)
    .sort((a, b) => a.waste - b.waste || b.win - a.win).slice(0, 3);
  for (let i = 0; i < alts.length; i++) cand.push({ from: r.pack, fromTier: r.tier, fromWaste: r.waste, fromWin: r.win, rank: i + 1,
    candidate: alts[i].pack, candidateTier: alts[i].tier, candidateWaste: alts[i].waste, candidateWin: alts[i].win });
}
const ch = ['from', 'fromTier', 'fromWaste', 'fromWin', 'rank', 'candidate', 'candidateTier', 'candidateWaste', 'candidateWin'];
writeFileSync(OUT + '/replacement-candidates.tsv', ch.join('\t') + '\n' + cand.map((r) => ch.map((k) => r[k]).join('\t')).join('\n') + '\n');
console.log('priority rows=' + rows.length + ' candidate rows=' + cand.length);
