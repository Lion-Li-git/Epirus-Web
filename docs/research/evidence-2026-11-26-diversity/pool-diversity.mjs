import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-diversity';
const readTable = (p) => {
  const lines = readFileSync(p, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const h = lines[0].split('\t');
  return lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v])));
};
const pool = readTable(ROOT + '/champion-map/data/page/pool-members.tsv');
const reg = new Map(readTable(ROOT + '/champion-map/data/registry.tsv').map((r) => [r.pack_id, r]));
const drIds = new Set(['DR-R3E', 'ROD-DR', 'PUR-DR', 'TF-DR', 'TF2-DR', 'TF2-RD', 'PUR-2P', 'MT-DR', 'JN-DR', 'MN-DR']);
const rows = [];
const fixtureKeys = new Set(), ruleFps = new Set(), scriptSets = new Set(), realSets = new Set();
for (const p of pool) {
  const j = JSON.parse(readFileSync(`${ROOT}/champion-map/data/skill-report/${p.id}.json`, 'utf8'));
  const cells = (j.stage1 && j.stage1.cells) || [];
  const scripts = [...new Set(cells.filter((c) => !c.real).map((c) => c.opp))].sort();
  const reals = [...new Set(cells.filter((c) => c.real).map((c) => c.opp))].sort();
  scriptSets.add(scripts.join(','));
  realSets.add(reals.join(','));
  fixtureKeys.add(j.fixtureKey);
  ruleFps.add(j.rulesFingerprint);
  const counts = {};
  for (const c of cells) if (!c.real) for (const [k, n] of Object.entries(c.keys || {})) counts[k] = (counts[k] || 0) + Number(n || 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error(p.id + ' has no script-cell actions');
  const v = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / total]));
  const r = reg.get(p.id);
  rows.push({ id: p.id, tier: p.tier, fam: r.fam, group: drIds.has(p.id) ? 'DR-line' : (r.fam === '25' ? 'fam25-other' : 'fam24'), v, total, scripts, reals });
}
if (scriptSets.size !== 1) throw new Error('script opponent sets differ: ' + [...scriptSets].join(' || '));
if (fixtureKeys.size !== 1 || ruleFps.size !== 1) throw new Error('fixtureKey/rulesFingerprint differ');
const keys = [...new Set(rows.flatMap((r) => Object.keys(r.v)))].sort();
const l1 = (a, b) => keys.reduce((s, k) => s + Math.abs((a.v[k] || 0) - (b.v[k] || 0)), 0);
const top5 = (r) => Object.entries(r.v).sort((a, b) => b[1] - a[1]).slice(0, 5).reduce((s, [, n]) => s + n, 0);
const centroid = (rs) => Object.fromEntries(keys.map((k) => [k, rs.reduce((s, r) => s + (r.v[k] || 0), 0) / rs.length]));
const median = (a) => {
  const x = [...a].sort((m, n) => m - n);
  if (!x.length) return null;
  const q = (p) => x[Math.min(x.length - 1, Math.max(0, Math.round((x.length - 1) * p)))];
  return { min: x[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: x[x.length - 1] };
};
const allCentroid = centroid(rows);
const pairs = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  pairs.push({ a: rows[i].id, b: rows[j].id, tier_a: rows[i].tier, tier_b: rows[j].tier,
    fam_a: rows[i].fam, fam_b: rows[j].fam, group_a: rows[i].group, group_b: rows[j].group, l1: l1(rows[i], rows[j]) });
}
const nearest = new Map(rows.map((r) => [r.id, { id: '', l1: Infinity }]));
for (const p of pairs) {
  for (const [a, b] of [[p.a, p.b], [p.b, p.a]]) if (p.l1 < nearest.get(a).l1) nearest.set(a, { id: b, l1: p.l1 });
}
const groups = [['all', rows], ['hard', rows.filter((r) => r.tier === 'hard')], ['soft', rows.filter((r) => r.tier === 'soft')],
  ['fam24', rows.filter((r) => r.fam === '24')], ['fam25', rows.filter((r) => r.fam === '25')],
  ['DR-line', rows.filter((r) => r.group === 'DR-line')], ['fam25-other', rows.filter((r) => r.group === 'fam25-other')]];
const summary = [];
for (const [name, rs] of groups) {
  const ids = new Set(rs.map((r) => r.id));
  const within = pairs.filter((p) => ids.has(p.a) && ids.has(p.b)).map((p) => p.l1);
  const c = centroid(rs);
  summary.push({ group: name, n: rs.length, pairs: within.length, ...median(within),
    centroid_l1_median: median(rs.map((r) => l1(r, { v: c }))).median,
    nearest_l1_median: median(rs.map((r) => nearest.get(r.id).l1)).median });
}
const tsv = (name, header, data) => writeFileSync(`${OUT}/${name}`, header.join('\t') + '\n' + data.map((r) => header.map((h) => r[h]).join('\t')).join('\n') + '\n');
tsv('fixture-audit.tsv', ['id', 'fixtureKey', 'rulesFingerprint', 'scriptOpponents', 'realOpponents'], rows.map((r) => ({ id: r.id, fixtureKey: [...fixtureKeys][0], rulesFingerprint: [...ruleFps][0], scriptOpponents: r.scripts.join(','), realOpponents: r.reals.join(',') })));
tsv('pairwise-l1.tsv', ['a', 'b', 'tier_a', 'tier_b', 'fam_a', 'fam_b', 'group_a', 'group_b', 'l1'], pairs);
tsv('per-pack.tsv', ['id', 'tier', 'fam', 'group', 'total', 'top5', 'centroid_l1_all', 'nearest_id', 'nearest_l1'], rows.map((r) => ({ id: r.id, tier: r.tier, fam: r.fam, group: r.group, total: r.total,
  top5: top5(r), centroid_l1_all: l1(r, { v: allCentroid }), nearest_id: nearest.get(r.id).id, nearest_l1: nearest.get(r.id).l1 })));
tsv('summary.tsv', ['group', 'n', 'pairs', 'min', 'p25', 'median', 'p75', 'max', 'centroid_l1_median', 'nearest_l1_median'], summary);
console.log(JSON.stringify({ packs: rows.length, fixtureKey: [...fixtureKeys], rulesFingerprint: [...ruleFps], scriptOpponents: [...scriptSets][0], realFixtureVariants: realSets.size,
  note: 'Vectors use script opponent cells only; real-pack cells are excluded because pool rotation changed the real opponent set.' }, null, 2));
console.table(summary);
console.log('Most similar pairs:');
for (const p of [...pairs].sort((a, b) => a.l1 - b.l1).slice(0, 12)) console.log(p.l1.toFixed(4), p.a, '<->', p.b, `[${p.group_a}/${p.group_b}]`);
console.log('Most isolated packs:');
for (const r of [...rows].sort((a, b) => nearest.get(b.id).l1 - nearest.get(a.id).l1).slice(0, 10)) console.log(nearest.get(r.id).l1.toFixed(4), r.id, '<->', nearest.get(r.id).id, `[${r.group}]`);
