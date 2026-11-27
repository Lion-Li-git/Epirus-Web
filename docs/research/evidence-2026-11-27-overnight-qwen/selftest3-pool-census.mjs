import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const table = readFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8')
  .replace(/\r/g, '').trim().split('\n');
const head = table[0].split('\t');
const rows = table.slice(1).map((line) => Object.fromEntries(line.split('\t').map((v, i) => [head[i], v])));
const report = [];
const text = [];

for (const row of rows) {
  const cp = spawnSync(process.execPath, ['training/proto2/selftest3.mjs', row.path], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 << 20,
  });
  const output = String(cp.stdout || '') + String(cp.stderr || '');
  const params = Number((output.match(/参数\s+(\d+)/) || [])[1] || 0);
  const green = /selftest3 全绿/.test(output);
  const red = /selftest3 红/.test(output);
  const legacy = params !== 16561;
  const status = cp.status !== 0 && !red ? 'error' : legacy ? 'legacy' : green ? 'green' : red ? 'red' : 'unknown';
  report.push({ id: row.id, tier: row.tier, path: row.path, params, status, green, red, exit: cp.status });
  text.push('==== ' + row.id + ' | ' + row.tier + ' | ' + row.path + ' | status=' + status + ' | exit=' + cp.status + ' ====');
  text.push(output.trimEnd());
  text.push('');
  console.log(row.id + '\t' + status + '\tparams=' + params + '\texit=' + cp.status);
}

const summary = {
  total: report.length,
  green: report.filter((r) => r.status === 'green').length,
  red: report.filter((r) => r.status === 'red').length,
  legacy: report.filter((r) => r.status === 'legacy').length,
  error: report.filter((r) => r.status === 'error' || r.status === 'unknown').length,
  byTier: Object.fromEntries(['hard', 'soft'].map((tier) => [tier, {
    green: report.filter((r) => r.tier === tier && r.status === 'green').length,
    red: report.filter((r) => r.tier === tier && r.status === 'red').length,
    legacy: report.filter((r) => r.tier === tier && r.status === 'legacy').length,
  }])),
};
writeFileSync(resolve(ROOT, OUT, 'phase1-selftest3-pool.txt'), text.join('\n'));
writeFileSync(resolve(ROOT, OUT, 'phase1-selftest3-pool.json'), JSON.stringify({ summary, report }, null, 2));
console.log(JSON.stringify(summary));
