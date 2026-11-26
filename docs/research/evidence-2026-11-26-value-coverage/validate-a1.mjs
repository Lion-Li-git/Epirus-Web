import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const lines = readFileSync(ROOT + '/champion-map/data/page/pool-members.tsv', 'utf8').trim().split(/\r?\n/);
const h = lines[0].split('\t'), idIx = h.indexOf('id');
const stripCells = (s) => ({ ...s, cells: s.cells.map(({ closure, bead, ...c }) => c) });
const fields = ['unionN', 'selfUnionN', 'envOnlySkills', 'selfOnlySkills', 'coverage', 'totalUses', 'totalCells', 'decN',
  'switchJs', 'switchJsCells', 'winRate', 'bead', 'curseStats', 'winBy', 'cells'];
let checked = 0;
for (const line of lines.slice(1)) {
  const id = line.split('\t')[idIx], rel = 'champion-map/data/skill-report/' + id + '.json';
  const now = JSON.parse(readFileSync(ROOT + '/' + rel, 'utf8'));
  const old = JSON.parse(execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
  if (!now.stage1.closure) throw new Error(id + ' missing closure');
  for (const k of fields) {
    const a = k === 'cells' ? stripCells(now.stage1)[k] : now.stage1[k];
    const b = k === 'cells' ? stripCells(old.stage1)[k] : old.stage1[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(id + ' legacy metric changed: ' + k);
  }
  const c = now.stage1.closure.charge, b = now.stage1.bead;
  if (!c || c.uses !== b.elecGained + b.boomGained || c.paid !== b.elecSpent + b.boomSpent || c.wasted !== b.elecExpired + b.boomExpired) {
    throw new Error(id + ' charge closure does not reconcile with bead ledger');
  }
  checked++;
}
const hl = JSON.parse(readFileSync(ROOT + '/champion-map/data/skill-report/HL-G1.json', 'utf8')).stage1.closure.holo;
if (!hl || hl.paid <= 0) throw new Error('HL-G1 holo positive control failed');
console.log('A1_VALIDATE_OK packs=' + checked + ' legacyFieldsIdentical=15 chargeLedgerReconciled=34 holoPositiveControl=' + hl.paid + '/' + hl.uses);
