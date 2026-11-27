import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'docs/research/evidence-2026-11-27-overnight-qwen');
const groups = [
  { key: '2p-rule', pattern: /^phase6-base-2p-rule-(\d+)\.txt$/ },
  { key: '2p-legacy', pattern: /^phase6-base-2p-legacy-(\d+)\.txt$/ },
  { key: '5p-multi', pattern: /^phase6-base-5p-multi-(\d+)\.txt$/ },
  { key: '5p-long', pattern: /^phase6-base-5p-long-(\d+)\.txt$/ },
];
const tiers = [
  { key: 'hard', re: /困难/ },
  { key: 'regular', re: /普通/ },
  { key: 'sparring', re: /简单/ },
];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(mean(xs.map((x) => x * x)) - mean(xs) * mean(xs));
const out = {};

for (const g of groups) {
  const files = readdirSync(DIR).filter((f) => g.pattern.test(f)).sort();
  const values = { hard: [], regular: [], sparring: [] };
  for (const file of files) {
    const lines = readFileSync(resolve(DIR, file), 'utf8').split(/\r?\n/);
    for (const tier of tiers) {
      const line = lines.find((s) => tier.re.test(s) && /替身夺冠/.test(s));
      const m = line && line.match(/替身夺冠\s+([\d.]+)%/);
      if (!m) throw new Error(file + ' 缺 ' + tier.key + ' 读数');
      values[tier.key].push(Number(m[1]));
    }
  }
  out[g.key] = {
    seeds: files.map((f) => Number(f.match(g.pattern)[1])),
    values,
    mean: Object.fromEntries(tiers.map((t) => [t.key, mean(values[t.key])])),
    sd: Object.fromEntries(tiers.map((t) => [t.key, sd(values[t.key])])),
    ordered: mean(values.hard) < mean(values.regular) && mean(values.regular) < mean(values.sparring),
  };
}

writeFileSync(resolve(DIR, 'phase6-base-ladder-summary.json'), JSON.stringify(out, null, 2));
const header = ['group', 'seed', 'hard', 'regular', 'sparring'];
const rows = [];
for (const [key, g] of Object.entries(out)) {
  g.seeds.forEach((seed, i) => rows.push([key, seed, g.values.hard[i], g.values.regular[i], g.values.sparring[i]]));
  rows.push([key, 'mean', g.mean.hard, g.mean.regular, g.mean.sparring]);
}
writeFileSync(resolve(DIR, 'phase6-base-ladder-summary.tsv'), header.join('\t') + '\n' + rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log(JSON.stringify(out, null, 2));
if (Object.values(out).some((g) => !g.ordered)) process.exitCode = 1;
