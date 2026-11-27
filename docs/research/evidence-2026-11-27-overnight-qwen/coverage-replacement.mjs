import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.SIM_ID || 'L1B-S1200';
const TAG = process.env.SIM_TAG || '';
const candidate = JSON.parse(readFileSync(resolve(ROOT, process.env.SIM_REPORT || OUT + '/skill-' + ID + '/nov27-long-pgdr-l1b.seg1200.json'), 'utf8'));
const targets = (process.env.SIM_TARGETS || 'RING-MINIT-CONT,MX8-R6B-KL').split(',');
const dir = resolve(ROOT, 'champion-map/data/skill-report');
const docs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
const skills = [...new Set(docs.flatMap((d) => Object.keys(d.stage1.coverage || {})))].sort();
const rows = [];
for (const target of targets) {
  const beforePool = skills.filter((k) => docs.some((d) => (d.stage1.coverage[k] || 0) >= 3));
  const afterPool = skills.filter((k) => docs.some((d) => d.id !== target && (d.stage1.coverage[k] || 0) >= 3) || (candidate.stage1.coverage[k] || 0) >= 3);
  const softBefore = docs.filter((d) => d.tier === 'soft');
  const softAfter = softBefore.filter((d) => d.id !== target).concat([{ ...candidate, tier: 'soft' }]);
  const depth = {};
  for (const k of skills) {
    const b = softBefore.filter((d) => (d.stage1.coverage[k] || 0) >= 3).length;
    const a = softAfter.filter((d) => (d.stage1.coverage[k] || 0) >= 3).length;
    if (a !== b) depth[k] = { before: b, after: a };
  }
  rows.push({
    target,
    poolUnionBefore: beforePool.length,
    poolUnionAfter: afterPool.length,
    lostPoolSkills: beforePool.filter((k) => !afterPool.includes(k)),
    softDepthChanges: depth,
    zeroedSoftSkills: Object.entries(depth).filter(([, v]) => v.before > 0 && v.after === 0).map(([k]) => k),
  });
}
writeFileSync(resolve(ROOT, OUT, ID + '-coverage-replacement' + TAG + '.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
