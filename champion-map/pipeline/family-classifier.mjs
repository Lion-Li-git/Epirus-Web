import { readFileSync } from 'node:fs';
import { parseMeta } from '../pack-id.mjs';

export const FAMILY_FEATURES = [
  'rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread',
  'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg', 'S', 'Geff',
];
export const FAMILY_DISTANCE_MAX = 0.32;

export function methodOf(meta = {}) {
  if (meta.baseline === 'ridge' || meta.baseline === 'mean') return 'pg-' + meta.baseline;
  if (meta.teacher || meta.teacher2 || meta.teacher3 || meta.steps) return 'supfit';
  if (meta.games && !meta.teacher) return 'ga';
  return 'unknown';
}

function methodLabel(method) {
  return ({ 'pg-mean': 'PG 均值基线', 'pg-ridge': 'PG 岭基线', supfit: '多教师蒸馏', ga: 'GA 强化', root: '冷启动', unknown: '未知方法' })[method] || method;
}

export function packDims(txt) {
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(txt);
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return o && o.dims ? o.dims : null; } catch { return null; }
}

export function readPackInfo(path) {
  const txt = readFileSync(path, 'utf8');
  return { dims: packDims(txt) || {}, meta: parseMeta(txt) || {} };
}

export function buildFamilyProfiles(registryInput, featureInput, readPack) {
  const regTable = registryInput.rows ? registryInput : null;
  const featTable = featureInput.rows ? featureInput : null;
  const registryRows = regTable ? regTable.rows : registryInput;
  const featureRows = featTable
    ? featTable.rows.map((r) => Object.fromEntries(featTable.header.map((c, i) => [c, r[i]])))
    : featureInput;
  const value = (row, key, table) => table ? row[table.ix[key]] : row[key];
  const features = new Map(featureRows.map((r) => [r.pack_id, r]));
  const info = new Map();
  for (const r of registryRows) {
    if (value(r, 'ver', regTable) !== '2.0') continue;
    const id = value(r, 'pack_id', regTable);
    try {
      const p = readPack(value(r, 'path', regTable));
      info.set(id, { method: methodOf(p.meta), input: p.dims.input || '' });
    } catch { info.set(id, { method: 'unknown', input: '' }); }
  }
  const profiles = new Map();
  for (const r of registryRows) {
    const id = value(r, 'pack_id', regTable), fam = value(r, 'fam', regTable), parent = value(r, 'parent', regTable);
    if (value(r, 'ver', regTable) !== '2.0' || !fam) continue;
    const self = info.get(id) || { method: 'unknown', input: '' };
    const parentInfo = parent ? info.get(parent) : null;
    const parentMethod = !parent ? 'root' : (parentInfo ? parentInfo.method : 'unknown');
    const p = profiles.get(fam) || { fam, label: value(r, 'fam_label', regTable), input: self.input, members: [] };
    p.members.push({ id, method: self.method, transition: parentMethod + '→' + self.method,
      parent: parent || '', feature: features.get(id) || null });
    profiles.set(fam, p);
  }
  return [...profiles.values()];
}

function rankVectors(rows) {
  const values = new Map();
  const medians = new Map();
  for (const col of FAMILY_FEATURES) {
    const xs = rows.map((r) => Number(r[col])).filter(Number.isFinite).sort((a, b) => a - b);
    const median = xs.length ? xs[Math.floor(xs.length / 2)] : 0;
    medians.set(col, median);
    const unique = [...new Set(xs)];
    values.set(col, new Map(unique.map((v, i) => [v, unique.length > 1 ? i / (unique.length - 1) : 0.5])));
  }
  return rows.map((r) => FAMILY_FEATURES.map((col) => {
    const n = Number(r[col]);
    return values.get(col).get(Number.isFinite(n) ? n : medians.get(col)) ?? 0.5;
  }));
}

function distance(a, b) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
}

export function classifyFamily({ id, dims, meta, parentId, parentMethod, feature, profiles, maxFam }) {
  if (dims.input !== 'obs6') return { status: 'unsupported', reason: '自动归族只支持 obs6 2.0 包' };
  if (!feature) return { status: 'need-feature', reason: '自动归族需要行为特征；请传 --display 或显式 --fam' };
  const method = methodOf(meta);
  if (method === 'unknown') return { status: 'unknown-method', reason: 'META 无法判定训练方法；请显式 --fam' };
  if (parentId && (!parentMethod || parentMethod === 'unknown')) return { status: 'unknown-parent', reason: '父包训练方法未知；请显式 --fam' };
  const pm = parentId ? parentMethod : 'root';
  const transition = pm + '→' + method;
  const compatible = profiles.filter((p) => p.input === 'obs6' && p.members.some((m) => m.feature));
  if (!compatible.length) return { status: 'no-profiles', reason: '没有可比较的 obs6 家族' };
  const rows = [...compatible.flatMap((p) => p.members.filter((m) => m.feature).map((m) => m.feature)), feature];
  const vectors = rankVectors(rows);
  const candidate = vectors.at(-1);
  let at = 0;
  const scored = compatible.map((p) => {
    const count = p.members.filter((m) => m.feature).length;
    const vs = vectors.slice(at, at + count);
    at += count;
    const centroid = FAMILY_FEATURES.map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);
    const centroidDistance = distance(candidate, centroid);
    const nearestDistance = Math.min(...vs.map((v) => distance(candidate, v)));
    return { fam: p.fam, label: p.label, distance: Math.min(centroidDistance, nearestDistance),
      centroidDistance, nearestDistance, n: count };
  }).sort((a, b) => a.distance - b.distance);
  const tiers = [
    { name: 'parent', matches: scored.filter((s) => s.fam === String(profiles.find((p) => p.members.some((m) => m.id === parentId))?.fam || '')
      && compatible.find((p) => p.fam === s.fam).members.some((m) => m.method === method)) },
    { name: 'method-label', matches: scored.filter((s) => compatible.find((p) => p.fam === s.fam).label.includes(methodLabel(method))) },
    { name: 'transition', matches: scored.filter((s) => compatible.find((p) => p.fam === s.fam).members.some((m) => m.transition === transition)) },
    { name: 'method', matches: scored.filter((s) => compatible.find((p) => p.fam === s.fam).members.some((m) => m.method === method)) },
  ];
  for (const tier of tiers) {
    if (!tier.matches.length) continue;
    const best = tier.matches[0];
    if (best.distance <= FAMILY_DISTANCE_MAX) {
      return { status: 'matched', fam: best.fam, label: best.label, method, transition, tier: tier.name,
        distance: best.distance, candidates: tier.matches.slice(0, 3) };
    }
  }
  const label = '2.0 obs6.5 ' + methodLabel(pm) + '→' + methodLabel(method) + ' 行为分支（' + id + '）';
  return { status: 'new', fam: String(maxFam + 1), label, method, transition, distance: scored[0]?.distance ?? null,
    nearest: scored[0] || null, candidates: scored.slice(0, 3),
    tierCandidates: Object.fromEntries(tiers.map((t) => [t.name, t.matches.slice(0, 3)])) };
}
