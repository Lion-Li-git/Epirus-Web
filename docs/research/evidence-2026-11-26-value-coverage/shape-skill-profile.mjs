import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const readTable = (p) => {
  const lines = readFileSync(p, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const h = lines[0].split('\t');
  return lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v])));
};
const pool = readTable(ROOT + '/champion-map/data/page/pool-members.tsv');
const reports = pool.map((p) => ({ ...p, report: JSON.parse(readFileSync(`${ROOT}/champion-map/data/skill-report/${p.id}.json`, 'utf8')) }));
const fixtureKeys = new Set(reports.map((r) => r.report.fixtureKey));
const ruleFps = new Set(reports.map((r) => r.report.rulesFingerprint));
if (fixtureKeys.size !== 1 || ruleFps.size !== 1) throw new Error('fixture/rules drift');

const skills = [...new Set(reports.flatMap((r) => Object.keys(r.report.stage1.coverage || {})))].sort();
const scopes = ['all', 'real', 'script'];
const ns = [2, 3, 5, 8], modes = ['multi', 'long'];
const empty = () => ({ uses: 0, games: 0, cells: 0, nonzeroCells: 0, closureUses: 0, closurePaid: 0 });
const poolAgg = new Map();
const packRows = [];

function add(map, key, field, n = 1) {
  const row = map.get(key) || (map.set(key, empty()), map.get(key));
  row[field] += n;
}

for (const { id, tier, report } of reports) {
  const perPack = new Map();
  for (const c of report.stage1.cells || []) {
    for (const skill of skills) {
      const uses = Number(c.keys?.[skill] || 0);
      for (const scope of scopes) {
        if (scope === 'real' && !c.real) continue;
        if (scope === 'script' && c.real) continue;
        const key = [skill, c.n, c.mode, scope].join(':');
        add(perPack, key, 'games', c.games);
        add(perPack, key, 'cells');
        add(perPack, key, 'uses', uses);
        if (uses > 0) add(perPack, key, 'nonzeroCells');
        add(poolAgg, key, 'games', c.games);
        add(poolAgg, key, 'cells');
        add(poolAgg, key, 'uses', uses);
        if (uses > 0) add(poolAgg, key, 'nonzeroCells');
      }
    }
  }
  for (const [skill, closure] of Object.entries(report.stage1.closure || {})) {
    for (const [shape, v] of Object.entries(closure.byShape || {})) {
      const [n, mode] = shape.split(':');
      for (const scope of scopes) {
        const key = [skill, n, mode, scope].join(':');
        add(perPack, key, 'closureUses', v.uses);
        add(perPack, key, 'closurePaid', v.paid);
        add(poolAgg, key, 'closureUses', v.uses);
        add(poolAgg, key, 'closurePaid', v.paid);
      }
    }
  }
  for (const [key, v] of perPack) {
    const [skill, n, mode, scope] = key.split(':');
    packRows.push({ pack: id, tier, skill, n: Number(n), mode, scope, ...v,
      usesPerGame: v.games ? v.uses / v.games : null,
      closureRate: v.closureUses >= 20 ? v.closurePaid / v.closureUses : null });
  }
}

const rows = [];
for (const skill of skills) for (const n of ns) for (const mode of modes) for (const scope of scopes) {
  const v = poolAgg.get([skill, n, mode, scope].join(':')) || empty();
  rows.push({ skill, n, mode, scope, ...v,
    usesPerGame: v.games ? v.uses / v.games : null,
    closureRate: v.closureUses >= 20 ? v.closurePaid / v.closureUses : null });
}

const railgun = [];
for (const mode of modes) for (const scope of scopes) {
  const vals = ns.map((n) => rows.find((r) => r.skill === 'railgun' && r.n === n && r.mode === mode && r.scope === scope));
  const rates = vals.map((r) => r.usesPerGame);
  railgun.push({ mode, scope, n2: rates[0], n3: rates[1], n5: rates[2], n8: rates[3],
    monotonic: rates.every((v, i) => i === 0 || v >= rates[i - 1]) });
}

const header = ['pack', 'tier', 'skill', 'n', 'mode', 'scope', 'uses', 'games', 'cells', 'nonzeroCells', 'closureUses', 'closurePaid', 'usesPerGame', 'closureRate'];
writeFileSync(OUT + '/shape-skill-per-pack.tsv', header.join('\t') + '\n' + packRows.map((r) => header.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
const poolHeader = ['skill', 'n', 'mode', 'scope', 'uses', 'games', 'cells', 'nonzeroCells', 'closureUses', 'closurePaid', 'usesPerGame', 'closureRate'];
writeFileSync(OUT + '/shape-skill-profile.tsv', poolHeader.join('\t') + '\n' + rows.map((r) => poolHeader.map((k) => r[k] ?? '').join('\t')).join('\n') + '\n');
const railHeader = ['mode', 'scope', 'n2', 'n3', 'n5', 'n8', 'monotonic'];
writeFileSync(OUT + '/railgun-shape-check.tsv', railHeader.join('\t') + '\n' + railgun.map((r) => railHeader.map((k) => r[k]).join('\t')).join('\n') + '\n');

console.log(JSON.stringify({ packs: reports.length, fixtureKey: [...fixtureKeys][0], rulesFingerprint: [...ruleFps][0], skills: skills.length, rows: rows.length }, null, 2));
console.table(railgun);
for (const skill of ['railgun', 'tank', 'transfer', 'guard', 'reflect', 'bagua']) {
  console.log('\n' + skill);
  console.table(rows.filter((r) => r.skill === skill && r.scope === 'all'));
}
