import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.SIM_ID || 'L1B-S1200';
const full = JSON.parse(readFileSync(resolve(ROOT, OUT, ID + '-pool-replacement-phase6-full.json'), 'utf8'));
const base = JSON.parse(readFileSync(resolve(ROOT, OUT, 'phase6-base-ladder-summary.json'), 'utf8'));
const baseBySeed = {};
for (const [key, g] of Object.entries(base)) {
  g.seeds.forEach((seed, i) => {
    baseBySeed[key + ':' + seed] = { hard: g.values.hard[i], regular: g.values.regular[i], sparring: g.values.sparring[i] };
  });
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(mean(xs.map((x) => x * x)) - mean(xs) * mean(xs));
const rows = full.map((r) => {
  const b = baseBySeed[r.config + ':' + r.seed];
  return {
    target: r.target, config: r.config, seed: r.seed,
    hard: r.hard, regular: r.regular, sparring: r.sparring,
    deltaHard: r.hard - b.hard,
    deltaRegular: r.regular - b.regular,
    deltaSparring: r.sparring - b.sparring,
    ordered: r.hard < r.regular && r.regular < r.sparring,
  };
});
const summary = {};
for (const target of [...new Set(rows.map((r) => r.target))]) {
  summary[target] = { ordered: rows.filter((r) => r.target === target).every((r) => r.ordered), configs: {} };
  for (const config of [...new Set(rows.map((r) => r.config))]) {
    const rs = rows.filter((r) => r.target === target && r.config === config);
    summary[target].configs[config] = {
      seeds: rs.length,
      meanDeltaHard: mean(rs.map((r) => r.deltaHard)),
      meanDeltaRegular: mean(rs.map((r) => r.deltaRegular)),
      meanDeltaSparring: mean(rs.map((r) => r.deltaSparring)),
      sdDeltaRegular: sd(rs.map((r) => r.deltaRegular)),
      sdDeltaSparring: sd(rs.map((r) => r.deltaSparring)),
    };
  }
}
writeFileSync(resolve(ROOT, OUT, ID + '-phase6-full-delta.json'), JSON.stringify({ rows, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
