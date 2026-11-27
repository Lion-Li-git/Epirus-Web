import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ids = ['JN-DR', 'HL-G1', 'FS-DR', 'FS2-LE26', 'TK-FS4', 'RD-PG', 'MN-PG', 'PG-CN', 'nov21-taunt-dsp0b', 'OBS6E9', 'DR-R3E'];
const rows = [];
const num = (v) => v == null ? '' : Number(v);
for (const id of ids) {
  const path = 'champion-map/data/skill-report/' + id + '.json';
  const before = JSON.parse(execFileSync('git', ['show', '6712e441:' + path], { cwd: ROOT, encoding: 'utf8' }));
  const after = JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
  const b = before.stage1, a = after.stage1;
  const row = {
    id,
    beforeFp: before.rulesFingerprint,
    afterFp: after.rulesFingerprint,
    beforeWin: b.winRate,
    afterWin: a.winRate,
    deltaWinPt: (a.winRate - b.winRate) * 100,
    beforeUnion: b.unionN,
    afterUnion: a.unionN,
    beforeChargeRate: num(b.closure?.charge?.rate),
    afterChargeRate: num(a.closure?.charge?.rate),
    beforeChargePaid: b.closure?.charge?.paid,
    afterChargePaid: a.closure?.charge?.paid,
    beforeChargeWasted: b.closure?.charge?.wasted,
    afterChargeWasted: a.closure?.charge?.wasted,
    beforeJinshield: b.coverage?.jinshield,
    afterJinshield: a.coverage?.jinshield,
    beforeHolo: b.coverage?.holo,
    afterHolo: a.coverage?.holo,
    beforeFirestorm: b.coverage?.firestorm,
    afterFirestorm: a.coverage?.firestorm,
    beforeRod: b.coverage?.rod,
    afterRod: a.coverage?.rod,
  };
  rows.push(row);
  console.log(id + '\twin ' + (row.beforeWin * 100).toFixed(2) + '->' + (row.afterWin * 100).toFixed(2) + '\tunion ' + row.beforeUnion + '->' + row.afterUnion + '\tcharge ' + row.beforeChargePaid + '/' + (row.beforeChargePaid + row.beforeChargeWasted) + '->' + row.afterChargePaid + '/' + (row.afterChargePaid + row.afterChargeWasted));
}
writeFileSync(resolve(ROOT, OUT, 'phase1-stage1-rule-delta.json'), JSON.stringify(rows, null, 2));
const header = Object.keys(rows[0]);
writeFileSync(resolve(ROOT, OUT, 'phase1-stage1-rule-delta.tsv'), header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
