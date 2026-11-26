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
const rows = [];
for (const p of pool) {
  const j = JSON.parse(readFileSync(`${ROOT}/champion-map/data/skill-report/${p.id}.json`, 'utf8'));
  for (const [skill, v] of Object.entries(j.stage1.closure || {})) {
    rows.push({ pack: p.id, tier: p.tier, fam: reg.get(p.id).fam, skill, unit: v.unit, uses: v.uses, paid: v.paid,
      wasted: v.wasted, rate: v.rate == null ? '' : v.rate, readable: v.readable ? 1 : 0,
      byShape: Object.entries(v.byShape || {}).sort().map(([shape, s]) => `${shape}:${s.paid}/${s.uses}`).join(',') });
  }
}
const header = ['pack', 'tier', 'fam', 'skill', 'unit', 'uses', 'paid', 'wasted', 'rate', 'readable', 'byShape'];
writeFileSync(OUT + '/closure.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
console.log('closure rows=' + rows.length);
