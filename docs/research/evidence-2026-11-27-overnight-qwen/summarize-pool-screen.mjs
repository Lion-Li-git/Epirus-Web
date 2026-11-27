import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.SIM_ID || 'L1B-S1200';
const screen = JSON.parse(readFileSync(resolve(ROOT, OUT, ID + '-pool-replacement-screen.json'), 'utf8'));
const base = JSON.parse(readFileSync(resolve(ROOT, OUT, 'phase1-ladder-summary.json'), 'utf8'));
const baseBySeed = {};
for (const [key, g] of Object.entries(base)) {
  g.seeds.forEach((seed, i) => {
    baseBySeed[key + ':' + seed] = { hard: g.values.hard[i], regular: g.values.regular[i], sparring: g.values.sparring[i] };
  });
}
const rows = screen.map((r) => {
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
  const rs = rows.filter((r) => r.target === target);
  summary[target] = {
    ordered: rs.every((r) => r.ordered),
    worstRegular: Math.min(...rs.map((r) => r.deltaRegular)),
    worstSparring: Math.min(...rs.map((r) => r.deltaSparring)),
    meanRegular: rs.reduce((a, r) => a + r.deltaRegular, 0) / rs.length,
    meanSparring: rs.reduce((a, r) => a + r.deltaSparring, 0) / rs.length,
  };
}
writeFileSync(resolve(ROOT, OUT, ID + '-pool-replacement-screen-delta.json'), JSON.stringify({ rows, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
