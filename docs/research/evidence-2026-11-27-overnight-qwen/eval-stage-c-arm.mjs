import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ARM = process.env.ARM || 'A0';
const base = 'scratch/arms/nov28-dr-r3e-' + ARM.toLowerCase();
const rows = [];
for (const seg of [600, 1200, 2400, 0]) {
  const path = base + (seg ? '.seg' + seg : '') + '.bak';
  const tag = ARM + '-S' + (seg || 'END');
  const test = spawnSync(process.execPath, ['training/proto2/selftest3.mjs', path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });
  const testOut = String(test.stdout || '') + String(test.stderr || '');
  writeFileSync(resolve(ROOT, OUT, tag + '-selftest3.txt'), testOut);
  const stage = spawnSync(process.execPath, ['tools/pool-skill-report.mjs', '--stage=1', '--candidate=' + path, '--jobs=1', '--out=' + OUT + '/skill-' + tag], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });
  const stageOut = String(stage.stdout || '') + String(stage.stderr || '');
  writeFileSync(resolve(ROOT, OUT, tag + '-stage1.txt'), stageOut);
  if (test.status !== 0 || stage.status !== 0) throw new Error(tag + ' 失败：selftest=' + test.status + ' stage=' + stage.status + '\n' + testOut.slice(-1000) + '\n' + stageOut.slice(-1000));
  const file = path.split(/[\\/]/).pop().replace(/\.bak$/, '');
  const doc = JSON.parse(readFileSync(resolve(ROOT, OUT, 'skill-' + tag, file + '.json'), 'utf8'));
  const s = doc.stage1, c = s.closure.charge;
  rows.push({
    tag, path, green: /selftest3 全绿/.test(testOut),
    win: s.winRate, union: s.unionN, selfUnion: s.selfUnionN,
    gained: c.uses, spent: c.paid, expired: c.wasted, closure: c.rate,
    drainCoverage: s.coverage.drain || 0,
    drainClosure: s.closure.drain || null,
    coverage: s.coverage,
  });
  console.log(tag + '\twin=' + s.winRate + '\tunion=' + s.unionN + '\tcharge=' + c.paid + '/' + c.uses + '\texpired=' + c.wasted + '\tdrain=' + (s.coverage.drain || 0));
}
writeFileSync(resolve(ROOT, OUT, 'nov28-dr-r3e-' + ARM.toLowerCase() + '-eval.json'), JSON.stringify(rows, null, 2));
