import { resolve, join } from 'node:path';
import { readTable, writeTable } from '../map-table.mjs';
import { FAMILY_FEATURES, buildFamilyProfiles, classifyFamily, methodOf, readPackInfo } from './family-classifier.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
const IDS = arg('ids', '').split(',').map((s) => s.trim()).filter(Boolean);
const WRITE = process.argv.includes('--write');
const ROOT = resolve(DATA, '../..');
const readPack = (p) => readPackInfo(resolve(ROOT, p));
if (!IDS.length) throw new Error('需要 --ids=<id1,id2>');
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
