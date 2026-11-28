import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.LOO_OUT || 'docs/research/evidence-2026-11-27-overnight-qwen';
const PREFIX = process.env.LOO_PREFIX || 'pool-loo-2026-11-28';
const TARGETS = (process.env.LOO_TARGETS || 'AR-TK2,nov21-armor-tzt2d,MX6-GD-TF20,FC-S1,OBS6E9,TF2-DR').split(',');
const SEED_BASE = Number(process.env.LOO_SEED_BASE || 95001);
const BASELINE = process.env.LOO_BASELINE || '594ef9a2';
const CONFIGS = [
  { key: '2p-rule', n: 2, mode: 'standard', surrogate: 'rule', games: 1000, seeds: [0, 1, 2, 3].map((i) => SEED_BASE + i) },
  { key: '2p-legacy', n: 2, mode: 'standard', surrogate: 'legacy', games: 1000, seeds: [0, 1, 2, 3].map((i) => SEED_BASE + i) },
  { key: '5p-multi', n: 5, mode: 'multi', surrogate: 'legacy', games: 400, seeds: [0, 1].map((i) => SEED_BASE + i) },
  { key: '5p-long', n: 5, mode: 'long', surrogate: 'legacy', games: 400, seeds: [0, 1].map((i) => SEED_BASE + i) },
  { key: '8p-multi', n: 8, mode: 'multi', surrogate: 'legacy', games: 400, seeds: [0, 1].map((i) => SEED_BASE + i) },
  { key: '8p-long', n: 8, mode: 'long', surrogate: 'legacy', games: 400, seeds: [0, 1].map((i) => SEED_BASE + i) },
];
const VARIANTS = ['BASE', ...TARGETS];
const jobs = [];
for (const variant of VARIANTS) for (const cfg of CONFIGS) for (const seed of cfg.seeds) jobs.push({ variant, cfg, seed });
let cursor = 0;
let failed = null;

function readResult(path) {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const line = [...lines].reverse().find((s) => s.startsWith('{"n":'));
  if (!line) return null;
  const parsed = JSON.parse(line);
  const values = Object.fromEntries(parsed.rows.map((r) => [r.id, r.pct]));
  if (!['lv:hard', 'lv:regular', 'lv:sparring'].every((k) => Number.isFinite(values[k]))) return null;
  return { values, parsed };
}

function viewOk(raw, variant) {
  const omitted = variant === 'BASE' ? 0 : variant.split(',').filter(Boolean).length;
  return raw.includes('# 抽法推导 = rosterFor(全表 ' + (35 - omitted) + ' 枚)');
}

async function runJob(job) {
  const { variant, cfg, seed } = job;
  const stem = PREFIX + '-' + variant + '-' + cfg.key + '-s' + seed;
  const raw = resolve(ROOT, OUT, stem + '.txt');
  if (existsSync(raw)) {
    const old = readFileSync(raw, 'utf8');
    if (viewOk(old, variant) && readResult(raw)) {
      console.log(stem + '\tSKIP valid');
      return;
    }
  }
  const args = ['tools/probe-diff-ladder.mjs', '--pool=1', '--n=' + cfg.n, '--mode=' + cfg.mode,
    '--games=' + cfg.games, '--seed=' + seed, '--surrogate=' + cfg.surrogate, '--quiet'];
  if (variant !== 'BASE') args.push('--poolomit=' + variant);
  const cp = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  cp.stdout.on('data', (d) => { stdout += d; });
  cp.stderr.on('data', (d) => { stderr += d; });
  const code = await new Promise((resolveExit, reject) => {
    cp.once('error', reject);
    cp.once('close', resolveExit);
  });
  writeFileSync(raw, stdout + stderr);
  if (code !== 0) throw new Error(stem + ' exit=' + code + '\n' + stderr.slice(-1200));
  const result = readResult(raw);
  if (!result) throw new Error(stem + ' 缺三档读数');
  console.log(stem + '\t' + JSON.stringify(result.values));
}

async function worker() {
  while (!failed) {
    const i = cursor++;
    if (i >= jobs.length) return;
    try { await runJob(jobs[i]); } catch (e) { if (!failed) failed = e; }
  }
}

await Promise.all([worker(), worker()]);
if (failed) throw failed;

const measurements = jobs.map(({ variant, cfg, seed }) => {
  const raw = readFileSync(resolve(ROOT, OUT, PREFIX + '-' + variant + '-' + cfg.key + '-s' + seed + '.txt'), 'utf8');
  const result = readResult(resolve(ROOT, OUT, PREFIX + '-' + variant + '-' + cfg.key + '-s' + seed + '.txt'));
  if (!viewOk(raw, variant)) throw new Error('池视图人数不符 ' + variant);
  const v = result.values;
  return { variant, config: cfg.key, seed, hard: v['lv:hard'], regular: v['lv:regular'], sparring: v['lv:sparring'],
    ordered: v['lv:hard'] < v['lv:regular'] && v['lv:regular'] < v['lv:sparring'] };
});
const rows = measurements.filter((r) => r.variant !== 'BASE').map((r) => {
  const b = measurements.find((m) => m.variant === 'BASE' && m.config === r.config && m.seed === r.seed);
  return { ...r, deltaHard: r.hard - b.hard, deltaRegular: r.regular - b.regular, deltaSparring: r.sparring - b.sparring };
});
const summary = {};
for (const target of TARGETS) {
  summary[target] = {};
  for (const cfg of CONFIGS) {
    const rs = rows.filter((r) => r.variant === target && r.config === cfg.key);
    const mean = (k) => rs.reduce((s, r) => s + r[k], 0) / rs.length;
    summary[target][cfg.key] = {
      nSeeds: rs.length,
      deltaHard: mean('deltaHard'), deltaRegular: mean('deltaRegular'), deltaSparring: mean('deltaSparring'),
      deltaRegularBySeed: rs.map((r) => r.deltaRegular),
      allRegularSameSign: rs.every((r) => r.deltaRegular > 0) || rs.every((r) => r.deltaRegular < 0),
      inversionsBefore: measurements.filter((r) => r.variant === 'BASE' && r.config === cfg.key && !r.ordered).length,
      inversionsAfter: rs.filter((r) => !r.ordered).length,
    };
  }
}
const payload = { baseline: BASELINE, rulesFingerprint: 'c61298e6', configs: CONFIGS, measurements, rows, summary };
writeFileSync(resolve(ROOT, OUT, PREFIX + '.json'), JSON.stringify(payload, null, 2));
const header = ['variant', 'config', 'seed', 'hard', 'regular', 'sparring', 'deltaHard', 'deltaRegular', 'deltaSparring', 'ordered'];
const allRows = [...measurements.filter((r) => r.variant === 'BASE').map((r) => ({ ...r, deltaHard: 0, deltaRegular: 0, deltaSparring: 0 })), ...rows];
writeFileSync(resolve(ROOT, OUT, PREFIX + '.tsv'), header.join('\t') + '\n' + allRows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
