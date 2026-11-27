import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const a0 = JSON.parse(readFileSync(resolve(ROOT, OUT, 'nov28-dr-r3e-a0-eval.json'), 'utf8'));
const a1 = JSON.parse(readFileSync(resolve(ROOT, OUT, 'nov28-dr-r3e-a1-eval.json'), 'utf8'));
const rows = [];
for (let i = 0; i < a0.length; i++) {
  const b = a0[i], a = a1[i];
  const doc0 = JSON.parse(readFileSync(resolve(ROOT, OUT, 'skill-' + b.tag, b.path.split(/[\\/]/).pop().replace(/\.bak$/, '') + '.json'), 'utf8'));
  const doc1 = JSON.parse(readFileSync(resolve(ROOT, OUT, 'skill-' + a.tag, a.path.split(/[\\/]/).pop().replace(/\.bak$/, '') + '.json'), 'utf8'));
  const games0 = doc0.stage1.cells.reduce((s, c) => s + c.games, 0);
  const games1 = doc1.stage1.cells.reduce((s, c) => s + c.games, 0);
  const row = {
    seg: b.tag,
    winDeltaPt: (a.win - b.win) * 100,
    unionDelta: a.union - b.union,
    expiredPerGame0: b.expired / games0,
    expiredPerGame1: a.expired / games1,
    expiredDrop: 1 - (a.expired / games1) / (b.expired / games0),
    spentPerGame0: b.spent / games0,
    spentPerGame1: a.spent / games1,
    spentKeep: (a.spent / games1) / (b.spent / games0),
    closure0: b.closure,
    closure1: a.closure,
    drainCoverage0: b.drainCoverage,
    drainCoverage1: a.drainCoverage,
    drainKeep: b.drainCoverage ? a.drainCoverage / b.drainCoverage : null,
  };
  row.passEconomy = row.expiredDrop >= 0.4 && row.spentKeep >= 0.8;
  row.passSkill = a.drainCoverage > 0 && row.drainKeep >= 0.7;
  rows.push(row);
}
writeFileSync(resolve(ROOT, OUT, 'nov28-dr-r3e-compare.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
