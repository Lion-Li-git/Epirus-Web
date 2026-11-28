import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const PREFIX = process.env.LOO_PREFIX || 'pool-loo-2026-11-28';
const data = JSON.parse(readFileSync(resolve(ROOT, OUT, PREFIX + '.json'), 'utf8'));
const lines = readFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8').trim().split(/\r?\n/);
const head = lines[0].split('\t');
const members = lines.slice(1).map((line) => {
  const c = line.split('\t');
  return { id: c[head.indexOf('id')], tier: c[head.indexOf('tier')] };
});
const reports = new Map();
for (const m of members) {
  try { reports.set(m.id, JSON.parse(readFileSync(resolve(ROOT, 'champion-map/data/skill-report/' + m.id + '.json'), 'utf8'))); }
  catch { throw new Error('缺技能报告 ' + m.id); }
}
function coverage(omit, tier) {
  const skills = new Set();
  const depth = {};
  for (const m of members) {
    if (m.id === omit || (tier && m.tier !== tier)) continue;
    const cov = reports.get(m.id).stage1.coverage || {};
    for (const [k, v] of Object.entries(cov)) if (v > 0) { skills.add(k); depth[k] = (depth[k] || 0) + 1; }
  }
  return { unionN: skills.size, skills: [...skills].sort(), depth };
}
const baseAll = coverage(null, null), baseSoft = coverage(null, 'soft');
const result = {};
for (const target of Object.keys(data.summary)) {
  const afterAll = coverage(target, null), afterSoft = coverage(target, 'soft');
  const lostAll = baseAll.skills.filter((s) => !afterAll.skills.includes(s));
  const lostSoft = baseSoft.skills.filter((s) => !afterSoft.skills.includes(s));
  const configs = Object.entries(data.summary[target]);
  const critical = configs.filter(([, s]) => s.deltaRegular >= 1.5 && s.allRegularSameSign).map(([k]) => k);
  const retirementSafe = configs.every(([, s]) => s.inversionsAfter <= s.inversionsBefore);
  const improving = configs.filter(([, s]) => s.deltaRegular <= -1.5 && s.allRegularSameSign).map(([k]) => k);
  const verdict = critical.length ? 'role-critical' : (improving.length && !lostAll.length && !lostSoft.length && retirementSafe ? 'retirement-candidate' : 'low-marginal-or-inconclusive');
  result[target] = { verdict, criticalConfigs: critical, improvingConfigs: improving, lostAll, lostSoft,
    retirementSafe, baseAllUnionN: baseAll.unionN, afterAllUnionN: afterAll.unionN,
    baseSoftUnionN: baseSoft.unionN, afterSoftUnionN: afterSoft.unionN,
    targetCoverage: reports.get(target).stage1.coverage || {},
    targetClosure: reports.get(target).stage1.closure || {} };
}
writeFileSync(resolve(ROOT, OUT, PREFIX + '-summary.json'), JSON.stringify({ baseAll, baseSoft, result }, null, 2));
console.log(JSON.stringify(result, null, 2));
