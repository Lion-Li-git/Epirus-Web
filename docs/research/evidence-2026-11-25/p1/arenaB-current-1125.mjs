import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'scratch/p1-current-1125/arena');
mkdirSync(DIR, { recursive: true });
const arms = [
  { id: 'RG-CN', path: 'docs/artifacts/RG-CN.bak', base: null },
  { id: 'MX8-CN-M', path: 'docs/artifacts/obs6-coldstart/MX8-CN-M.bak', base: null },
  { id: 'nov24-pierce5-20261031', path: 'scratch/arms/nov24-pierce5-20261031.bak', base: 'RG-CN' },
  { id: 'nov24-pierce5-20261101', path: 'scratch/arms/nov24-pierce5-20261101.bak', base: 'RG-CN' },
  { id: 'nov24-pierce5-20261102', path: 'scratch/arms/nov24-pierce5-20261102.bak', base: 'RG-CN' },
  { id: 'nov24-pierce5-20261103', path: 'scratch/arms/nov24-pierce5-20261103.bak', base: 'RG-CN' },
  { id: 'nov24-baseswap-20261031', path: 'scratch/arms/nov24-baseswap-20261031.bak', base: 'MX8-CN-M' },
  { id: 'nov24-baseswap-20261101', path: 'scratch/arms/nov24-baseswap-20261101.bak', base: 'MX8-CN-M' },
];
const seeds = [82200, 83200, 84200, 85200, 86200, 87200];
const jobs = [];
for (const a of arms) for (const seed of seeds) jobs.push({ a, seed });
let cursor = 0;
const results = [];
const parseJsonLine = (text) => {
  const lines = text.replace(/\r/g, '').split('\n').filter((x) => x.trim().startsWith('{'));
  return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
};
function run(job) {
  return new Promise((resolve) => {
    const file = join(DIR, job.a.id + '-s' + job.seed + '.json');
    if (existsSync(file)) {
      try {
        const row = parseJsonLine(readFileSync(file, 'utf8'));
        if (row) { results.push({ id: job.a.id, seed: job.seed, exit: 0, row, cached: true }); resolve(); return; }
      } catch {}
    }
    const fd = openSync(file, 'w');
    const cp = spawn(process.execPath, ['tools/arena-eval.mjs', '--pack=' + job.a.path, '--id=' + job.a.id,
      '--seed=' + job.seed, '--dose=page', '--jobs=1'], { cwd: ROOT, stdio: ['ignore', fd, fd] });
    cp.on('exit', (code) => {
      closeSync(fd);
      let row = null, err = '';
      try { row = parseJsonLine(readFileSync(file, 'utf8')); } catch (e) { err = String(e && e.message || e); }
      results.push({ id: job.a.id, seed: job.seed, exit: code, row, err });
      console.log(job.a.id + ' s=' + job.seed + ' exit=' + code + (row ? ' x4=' + row.short.x4 : ' ERR'));
      resolve();
    });
  });
}
async function worker() { while (cursor < jobs.length) await run(jobs[cursor++]); }
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
Promise.all([worker(), worker()]).then(() => {
  const bad = results.filter((r) => r.exit !== 0 || !r.row);
  const get = (id, seed) => { const r = results.find((x) => x.id === id && x.seed === seed && x.row); return r ? r.row : null; };
  const summary = [];
  for (const a of arms) {
    const rr = seeds.map((s) => get(a.id, s)).filter(Boolean);
    const pick = (fn) => mean(rr.map(fn));
    summary.push({ id: a.id, base: a.base, n: rr.length,
      x2: pick((r) => r.short.cells['2'].x), x5: pick((r) => r.short.cells['5'].x), x8: pick((r) => r.short.cells['8'].x), arS: pick((r) => r.rAll) });
  }
  const pairs = [];
  for (const a of arms.filter((x) => x.base)) {
    const ds = seeds.map((s) => { const x = get(a.id, s), b = get(a.base, s); return x && b ? (x.short.x4 - b.short.x4) * 100 : null; }).filter((x) => x != null);
    pairs.push({ id: a.id, base: a.base, n: ds.length, meanDeltaPt: mean(ds), losses: ds.filter((x) => x < 0).length, values: ds });
  }
  writeFileSync(join(DIR, 'summary.json'), JSON.stringify({ finishedAt: new Date().toISOString(), dose: 'page', seeds, summary, pairs, bad }, null, 2));
  const cols = ['id', 'base', 'n', 'x2', 'x5', 'x8', 'arS'];
  writeFileSync(join(DIR, 'summary.tsv'), cols.join('\t') + '\n' + summary.map((r) => cols.map((k) => r[k] == null ? '' : r[k]).join('\t')).join('\n') + '\n');
  const pcols = ['id', 'base', 'n', 'meanDeltaPt', 'losses', 'values'];
  writeFileSync(join(DIR, 'pairs.tsv'), pcols.join('\t') + '\n' + pairs.map((r) => pcols.map((k) => Array.isArray(r[k]) ? r[k].join('/') : (r[k] == null ? '' : r[k])).join('\t')).join('\n') + '\n');
  console.log('ARENA_DONE runs=' + results.length + ' bad=' + bad.length);
  process.exit(bad.length ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(2); });
