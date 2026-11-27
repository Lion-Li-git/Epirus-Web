import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const BEFORE = 'D:/code/Epirus-Web-fp-before';
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const packs = [
  'JN-DR', 'HL-G1', 'FS-DR', 'FS2-LE26', 'TK-FS4', 'RD-PG',
  'MN-PG', 'PG-CN', 'nov21-taunt-dsp0b', 'OBS6E9', 'DR-R3E',
];
const rows = [];

function run(tree, id, path) {
  const cp = spawnSync(process.execPath, [
    'tools/arena-eval.mjs', '--pack=' + path, '--id=' + id,
    '--dose=page', '--seed=82200', '--jobs=1',
  ], { cwd: tree, encoding: 'utf8', maxBuffer: 32 << 20 });
  const stdout = String(cp.stdout || '');
  const stderr = String(cp.stderr || '');
  writeFileSync(resolve(ROOT, OUT, id + '-' + (tree === BEFORE ? 'before' : 'after') + '.txt'),
    stdout + '\n' + stderr);
  const line = stdout.trim().split('\n').reverse().find((s) => s.trim().startsWith('{'));
  if (!line) throw new Error(id + ' 没有 Arena JSON：exit=' + cp.status + '\n' + stderr.slice(-1000));
  return JSON.parse(line);
}

for (const id of packs) {
  const path = id === 'OBS6E9' ? 'docs/artifacts/obs6-coldstart/OBS6E9.bak' : 'docs/artifacts/' + id + '.bak';
  const before = run(BEFORE, id, path);
  const after = run(ROOT, id, path);
  const row = {
    id,
    beforeR: before.rAll,
    afterR: after.rAll,
    deltaR: after.rAll - before.rAll,
    beforeShortR: before.short && before.short.r,
    afterShortR: after.short && after.short.r,
    beforeLongR: before.long && before.long.r,
    afterLongR: after.long && after.long.r,
    beforeX4: before.short && before.short.x4,
    afterX4: after.short && after.short.x4,
  };
  rows.push(row);
  console.log(id + '\trAll ' + row.beforeR.toFixed(6) + ' -> ' + row.afterR.toFixed(6) + '\tdelta=' + row.deltaR.toFixed(6));
}

writeFileSync(resolve(ROOT, OUT, 'phase1-rule-regression.json'), JSON.stringify(rows, null, 2));
const header = ['id', 'beforeR', 'afterR', 'deltaR', 'beforeShortR', 'afterShortR', 'beforeLongR', 'afterLongR', 'beforeX4', 'afterX4'];
writeFileSync(resolve(ROOT, OUT, 'phase1-rule-regression.tsv'),
  header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
