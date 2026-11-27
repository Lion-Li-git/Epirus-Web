import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const configs = ['2p-rule', '2p-legacy', '5p-multi', '5p-long'];
function vals(path) {
  const lines = readFileSync(resolve(ROOT, path), 'utf8').split(/\r?\n/);
  const out = {};
  for (const [key, re] of [['hard', /困难/], ['regular', /普通/], ['sparring', /简单/]]) {
    const line = lines.find((s) => re.test(s) && /替身夺冠/.test(s));
    const m = line && line.match(/替身夺冠\s+([\d.]+)%/);
    if (!m) throw new Error(path + ' 缺 ' + key);
    out[key] = Number(m[1]);
  }
  return out;
}
const rows = configs.map((cfg) => {
  const before = vals(OUT + '/pre-admission-product-77000-' + cfg + '.txt');
  const after = vals(OUT + '/post-admission-product-77000-' + cfg + '.txt');
  return {
    config: cfg,
    before,
    after,
    delta: { hard: after.hard - before.hard, regular: after.regular - before.regular, sparring: after.sparring - before.sparring },
    ordered: after.hard < after.regular && after.regular < after.sparring,
  };
});
writeFileSync(resolve(ROOT, OUT, 'L1B-S600-product-ladder-delta.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
if (rows.some((r) => !r.ordered)) process.exitCode = 1;
