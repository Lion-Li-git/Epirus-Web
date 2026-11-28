import { resolve, join } from 'node:path';
import { readTable, writeTable } from '../map-table.mjs';
import { rejectUnknownFlags } from '../../tools/audit-lib.mjs';
import { FAMILY_FEATURES, buildFamilyProfiles, classifyFamily, methodOf, readPackInfo } from './family-classifier.mjs';

rejectUnknownFlags(process.argv.slice(2), ['data', 'ids', 'plan', 'write'], 'reclassify-family');

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
const IDS = arg('ids', '').split(',').map((s) => s.trim()).filter(Boolean);
const PLAN = arg('plan', '');
const WRITE = process.argv.includes('--write');
const ROOT = resolve(DATA, '../..');
const readPack = (p) => readPackInfo(resolve(ROOT, p));
if (PLAN) {
  const plan = readTable(resolve(PLAN));
  for (const c of ['id', 'fam', 'fam_label']) if (plan.ix[c] === undefined) throw new Error('计划缺列 ' + c);
  const reg = readTable(join(DATA, 'registry.tsv'));
  const lin = readTable(join(DATA, 'page/lineage.tsv'));
  const seen = new Set(), labels = new Map();
  for (const r of plan.rows) {
    const id = r[plan.ix.id], fam = r[plan.ix.fam], label = r[plan.ix.fam_label];
    if (!id || seen.has(id)) throw new Error('计划 id 为空或重复：' + id);
    if (!/^\d+$/.test(fam) || Number(fam) < 1 || !label) throw new Error('计划家族非法：' + id);
    if (labels.has(fam) && labels.get(fam) !== label) throw new Error('同一家族标签冲突：' + fam);
    labels.set(fam, label);
    seen.add(id);
    const rr = reg.rows.find((x) => x[reg.ix.pack_id] === id);
    const lr = lin.rows.find((x) => x[lin.ix.id] === id);
    if (!rr || !lr) throw new Error('计划含不在册节点：' + id);
    rr[reg.ix.fam] = fam;
    rr[reg.ix.fam_label] = label;
    lr[lin.ix.fam] = fam;
    lr[lin.ix.famLabel] = label;
  }
  for (const r of reg.rows) if (!seen.has(r[reg.ix.pack_id]) && labels.has(r[reg.ix.fam]) && r[reg.ix.fam_label] !== labels.get(r[reg.ix.fam])) {
    throw new Error('家族 ' + r[reg.ix.fam] + ' 标签与未迁移成员冲突：' + r[reg.ix.pack_id]);
  }
  if (WRITE) {
    writeTable(join(DATA, 'registry.tsv'), { header: reg.header, rows: reg.rows }, { backup: false });
    writeTable(join(DATA, 'page/lineage.tsv'), { header: lin.header, rows: lin.rows }, { backup: false });
    console.log('已应用家族计划：' + seen.size + ' 枚');
  } else console.log('--dry：计划有效，未写盘（加 --write）');
  process.exit(0);
}
if (!IDS.length) throw new Error('需要 --ids=<id1,id2> 或 --plan=<tsv>');
const registry = readTable(join(DATA, 'registry.tsv'));
const features = readTable(join(DATA, 'features.tsv'));
const targetSet = new Set(IDS);
const rows = registry.rows.map((r) => r.slice());
const baseRows = rows.filter((r) => !targetSet.has(r[registry.ix.pack_id]));
const profiles = buildFamilyProfiles({ ...registry, rows: baseRows }, features, readPack);
const featureById = new Map(features.rows.map((r) => [r[registry.ix.pack_id], r]));
const decisions = [];
let maxFam = Math.max(0, ...rows.filter((r) => !targetSet.has(r[registry.ix.pack_id])).map((r) => Number(r[registry.ix.fam]) || 0));

for (const id of IDS) {
  const row = rows.find((r) => r[registry.ix.pack_id] === id);
  if (!row) throw new Error('registry 没有 ' + id);
  const info = readPack(row[registry.ix.path]);
  const parentId = row[registry.ix.parent] || '';
  const parentRow = parentId ? rows.find((r) => r[registry.ix.pack_id] === parentId) : null;
  const parentMethod = parentRow ? methodOf(readPack(parentRow[registry.ix.path]).meta) : 'root';
  const fr = featureById.get(id);
  if (!fr) throw new Error(id + ' 缺 features 行');
  const feature = Object.fromEntries(FAMILY_FEATURES.map((c) => [c, fr[features.ix[c]]]));
  const decision = classifyFamily({ id, dims: info.dims, meta: info.meta, parentId, parentMethod, feature, profiles, maxFam });
  if (decision.status !== 'matched' && decision.status !== 'new') throw new Error(id + ' 归族失败：' + decision.reason);
  const before = row[registry.ix.fam];
  row[registry.ix.fam] = decision.fam;
  row[registry.ix.fam_label] = decision.label;
  maxFam = Math.max(maxFam, Number(decision.fam));
  let profile = profiles.find((p) => p.fam === decision.fam);
  if (!profile) {
    profile = { fam: decision.fam, label: decision.label, input: info.dims.input, members: [] };
    profiles.push(profile);
  }
  profile.members.push({ id, method: decision.method, transition: decision.transition, parent: parentId, feature });
  decisions.push({ id, before, ...decision });
  console.log(JSON.stringify({ id, before, after: decision.fam, label: decision.label,
    status: decision.status, tier: decision.tier || '', distance: decision.distance, nearest: decision.nearest?.fam || '',
    tierCandidates: decision.tierCandidates || null }));
}

if (!WRITE) {
  console.log('--dry：未写 registry；加 --write 落盘');
} else {
  writeTable(join(DATA, 'registry.tsv'), { header: registry.header, rows }, { backup: false });
  const lineage = readTable(join(DATA, 'page/lineage.tsv'));
  for (const id of IDS) {
    const lr = lineage.rows.find((r) => r[lineage.ix.id] === id);
    const rr = rows.find((r) => r[registry.ix.pack_id] === id);
    if (!lr) throw new Error('lineage 没有 ' + id);
    lr[lineage.ix.fam] = rr[registry.ix.fam];
    lr[lineage.ix.famLabel] = rr[registry.ix.fam_label];
  }
  writeTable(join(DATA, 'page/lineage.tsv'), { header: lineage.header, rows: lineage.rows }, { backup: false });
  console.log('已写 registry.tsv 与 lineage.tsv 的家族字段；下一步运行 rebuild-map.mjs');
}
