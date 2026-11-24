import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'scratch/2p-weighted-1124');
const OUT = join(DIR, 'human');
mkdirSync(OUT, { recursive: true });
const arms = [
  { arm: '2pw12c-s20261124', kind: 'control', seed: 20261124, wid: 'e9e4a61e82aa3519', out: 'scratch/arms/nov24-2pw12c-s20261124.bak' },
  { arm: '2pw12w3-s20261124', kind: 'weight3', seed: 20261124, wid: '8c71b718e11f1fdd', out: 'scratch/arms/nov24-2pw12w3-s20261124.bak' },
  { arm: '2pw12c-s20261125', kind: 'control', seed: 20261125, wid: '4cc7b12c892b9e21', out: 'scratch/arms/nov24-2pw12c-s20261125.bak' },
  { arm: '2pw12w3-s20261125', kind: 'weight3', seed: 20261125, wid: 'd542dd39a8f1de04', out: 'scratch/arms/nov24-2pw12w3-s20261125.bak' },
  { arm: '2pw12w3-lr5-s20261124', kind: 'weight3-lr5', seed: 20261124, wid: '8af760034c457f40', out: 'scratch/arms/nov24-2pw12w3-lr5-s20261124.bak' },
  { arm: '2pw12w3-lr5-s20261125', kind: 'weight3-lr5', seed: 20261125, wid: '85c882fb869654b2', out: 'scratch/arms/nov24-2pw12w3-lr5-s20261125.bak' },
];
const seeds = [77000, 90210];
const jobs = [];
for (const a of arms) for (const surrogate of ['rule', 'legacy']) for (const seed of seeds) {
  jobs.push({ arm: a, surrogate, seed });
}
const results = [];
let cursor = 0;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const parseJsonLine = (text) => {
  const lines = text.replace(/\r/g, '').split('\n').filter((x) => x.trim().startsWith('{'));
  return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
};
function run(job) {
  return new Promise((resolve) => {
    const a = job.arm;
    const file = join(OUT, a.arm + '-' + job.surrogate + '-s' + job.seed + '.json');
    if (existsSync(file)) {
      try {
        const row = parseJsonLine(readFileSync(file, 'utf8'));
        if (row && row.rows && row.rows.length) {
          results.push({ arm: a.arm, kind: a.kind, seed: a.seed, wid: a.wid, surrogate: job.surrogate, evalSeed: job.seed, exit: 0, pct: row.rows[0].pct, cached: true });
          resolve(); return;
        }
      } catch {}
    }
    const fd = openSync(file, 'w');
    const args = ['tools/probe-diff-ladder.mjs', '--pack=' + a.out, '--pool=0', '--tiers=lv:hard',
      '--n=2', '--mode=standard', '--surrogate=' + job.surrogate, '--games=1000', '--seed=' + job.seed, '--quiet'];
    const cp = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', fd, fd] });
    cp.on('exit', (code) => {
      closeSync(fd);
      let row = null, err = '';
      try { row = parseJsonLine(readFileSync(file, 'utf8')); } catch (e) { err = String(e && e.message || e); }
      results.push({ arm: a.arm, kind: a.kind, seed: a.seed, wid: a.wid, surrogate: job.surrogate, evalSeed: job.seed,
        exit: code, pct: row && row.rows && row.rows.length ? row.rows[0].pct : null, err });
      console.log(a.arm + ' ' + job.surrogate + ' s=' + job.seed + ' exit=' + code + ' pct=' + (row && row.rows && row.rows.length ? row.rows[0].pct : 'ERR'));
      resolve();
    });
  });
}
async function worker() { while (cursor < jobs.length) await run(jobs[cursor++]); }
Promise.all([worker(), worker()]).then(() => {
  const bad = results.filter((r) => r.exit !== 0 || r.pct == null);
  const summary = [];
  for (const a of arms) for (const surrogate of ['rule', 'legacy']) {
    const rr = results.filter((r) => r.arm === a.arm && r.surrogate === surrogate && r.pct != null);
    summary.push({ arm: a.arm, kind: a.kind, trainSeed: a.seed, wid: a.wid, surrogate, runs: rr.length,
      humanWinPct: mean(rr.map((r) => r.pct)), values: rr.map((r) => r.pct) });
  }
  writeFileSync(join(DIR, 'human-summary.json'), JSON.stringify({ finishedAt: new Date().toISOString(), summary, bad }, null, 2));
  const cols = ['arm', 'kind', 'trainSeed', 'wid', 'surrogate', 'runs', 'humanWinPct', 'values'];
  writeFileSync(join(DIR, 'human-summary.tsv'), cols.join('\t') + '\n' + summary.map((r) => cols.map((k) => Array.isArray(r[k]) ? r[k].join('/') : (r[k] == null ? '' : r[k])).join('\t')).join('\n') + '\n');
  console.log('EVAL_DONE runs=' + results.length + ' bad=' + bad.length);
  process.exit(bad.length ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(2); });
