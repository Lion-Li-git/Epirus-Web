import assert from 'node:assert/strict';
import { buildFamilyProfiles, classifyFamily, methodOf, FAMILY_DISTANCE_MAX } from '../champion-map/pipeline/family-classifier.mjs';

const feature = (id, rounds = 20, extra = {}) => ({ pack_id: id, rounds, dmg: 15, heavy: 0.1, holo: 0.1,
  drawRate: 0, zeroRate: 0, seatSpread: 8, distinctKeys: 10, charges: 0.2, waste: 0.3,
  noThreatStance: 0.2, fieldAAtk: 0.3, rwDmg: 14, S: 1.5, Geff: 4.5, ...extra });
const registry = [
  { pack_id: 'S', path: 'S.bak', ver: '2.0', fam: '23', fam_label: 'supfit root', parent: '' },
  { pack_id: 'A', path: 'A.bak', ver: '2.0', fam: '24', fam_label: 'supfit→pg-mean', parent: 'S' },
  { pack_id: 'B', path: 'B.bak', ver: '2.0', fam: '21', fam_label: 'root→pg-ridge', parent: '' },
];
const packs = {
  'S.bak': { dims: { input: 'obs6' }, meta: { teacher: 'pack:S.bak', steps: 100 } },
  'A.bak': { dims: { input: 'obs6' }, meta: { baseline: 'mean', games: 1000 } },
  'B.bak': { dims: { input: 'obs6' }, meta: { baseline: 'ridge', games: 1000 } },
};
const profiles = buildFamilyProfiles(registry, [feature('A'), feature('B', 40, { dmg: 2, heavy: 0.9, holo: 0.9, seatSpread: 1, distinctKeys: 3, waste: 0.95, fieldAAtk: 0.8, rwDmg: 2, S: 0.2, Geff: 1 })], (p) => packs[p]);
assert.equal(methodOf({ baseline: 'ridge' }), 'pg-ridge');
assert.equal(methodOf({ teacher: 'pack:A' }), 'supfit');

const mean = classifyFamily({ id: 'C', dims: { input: 'obs6' }, meta: { baseline: 'mean', games: 1200 },
  parentId: 'S', parentMethod: 'supfit', feature: feature('C'), profiles, maxFam: 24 });
assert.equal(mean.status, 'matched');
assert.equal(mean.fam, '24');
assert.equal(mean.tier, 'transition');

const ridge = classifyFamily({ id: 'LE', dims: { input: 'obs6' }, meta: { baseline: 'ridge', games: 2400 },
  parentId: 'S', parentMethod: 'supfit', feature: feature('LE'), profiles, maxFam: 24 });
assert.equal(ridge.status, 'new');
assert.equal(ridge.fam, '25');
assert.match(ridge.label, /PG 岭基线/);

const withRidge = [...profiles, { fam: '25', label: ridge.label, input: 'obs6', members: [
  { id: 'LE', method: 'pg-ridge', transition: 'supfit→pg-ridge', parent: 'S', feature: feature('LE') },
] }];
const ph = classifyFamily({ id: 'PH', dims: { input: 'obs6' }, meta: { baseline: 'ridge', games: 2400 },
  parentId: 'S', parentMethod: 'supfit', feature: feature('PH', 21), profiles: withRidge, maxFam: 25 });
assert.equal(ph.status, 'matched');
assert.equal(ph.fam, '25');
assert.equal(ph.tier, 'method-label');

const far = classifyFamily({ id: 'FAR', dims: { input: 'obs6' }, meta: { baseline: 'mean', games: 1200 },
  parentId: 'S', parentMethod: 'supfit', feature: feature('FAR', 999, { dmg: 1, heavy: 0.99, holo: 0.99,
    seatSpread: 0, distinctKeys: 1, charges: 0.99, waste: 0.99, noThreatStance: 0.99, fieldAAtk: 0.99,
    rwDmg: 1, S: 0.01, Geff: 0.01 }), profiles, maxFam: 24 });
assert.equal(far.status, 'new');
assert.ok(far.distance === null || far.distance > FAMILY_DISTANCE_MAX);

const wrongArch = classifyFamily({ id: 'OLD', dims: { input: 'obs5' }, meta: { baseline: 'mean' },
  parentId: 'S', parentMethod: 'supfit', feature: feature('OLD'), profiles, maxFam: 24 });
assert.equal(wrongArch.status, 'unsupported');

const missing = classifyFamily({ id: 'MISS', dims: { input: 'obs6' }, meta: { baseline: 'mean' },
  parentId: 'S', parentMethod: 'supfit', feature: null, profiles, maxFam: 24 });
assert.equal(missing.status, 'need-feature');

console.log('FAMILY-CLASSIFIER SELFTEST OK');
