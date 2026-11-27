import { readFileSync, existsSync } from 'node:fs';

const root = process.cwd();
const rows = readFileSync(root + '/champion-map/data/page/pool-members.tsv', 'utf8')
  .replace(/\r/g, '').trim().split('\n').slice(1).map((line) => line.split('\t'));
const out = [];
const fixtures = new Set();
const fingerprints = new Set();
for (const row of rows) {
  const id = row[0];
  const tier = row[3];
  const path = root + '/champion-map/data/skill-report/' + id + '.json';
  if (!existsSync(path)) throw new Error('缺 skill-report: ' + id);
  const report = JSON.parse(readFileSync(path, 'utf8'));
  fixtures.add(report.fixtureKey);
  fingerprints.add(report.rulesFingerprint);
  const bead = report.stage1.bead;
  const elecGained = bead.elecGained || 0;
  const elecSpent = bead.elecSpent || 0;
  const elecExpired = bead.elecExpired || 0;
  const boomGained = bead.boomGained || 0;
  const boomSpent = bead.boomSpent || 0;
  const boomExpired = bead.boomExpired || 0;
  const totalGained = elecGained + boomGained;
  const totalSpent = elecSpent + boomSpent;
  const totalExpired = elecExpired + boomExpired;
  out.push({
    id, tier, wid: report.wid, fixtureKey: report.fixtureKey, rulesFingerprint: report.rulesFingerprint,
    elecGained, elecSpent, elecExpired, boomGained, boomSpent, boomExpired,
    totalGained, totalSpent, totalExpired,
    wastePct: totalGained ? (100 * totalExpired / totalGained).toFixed(2) : 'NA',
    readable: totalGained >= 20 ? 1 : 0,
  });
}
if (fixtures.size !== 1 || fingerprints.size !== 1) {
  throw new Error('夹具或规则指纹混读: fixtures=' + [...fixtures].join(',') + ' fingerprints=' + [...fingerprints].join(','));
}
out.sort((a, b) => Number(b.wastePct) - Number(a.wastePct) || a.id.localeCompare(b.id));
const header = ['id', 'tier', 'wid', 'fixtureKey', 'rulesFingerprint', 'elecGained', 'elecSpent', 'elecExpired', 'boomGained', 'boomSpent', 'boomExpired', 'totalGained', 'totalSpent', 'totalExpired', 'wastePct', 'readable'];
process.stdout.write(header.join('\t') + '\n');
for (const row of out) process.stdout.write(header.map((key) => row[key]).join('\t') + '\n');
