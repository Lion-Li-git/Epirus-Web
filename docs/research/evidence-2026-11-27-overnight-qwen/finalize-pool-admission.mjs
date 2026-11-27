import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.POOL_ID || 'L1B-S600';
const TARGET = process.env.POOL_TARGET || 'RING-MINIT-CONT';
const PRE = process.env.POOL_PRE || 'pre-admission-pool-members.tsv';
const pre = readFileSync(resolve(ROOT, OUT, PRE), 'utf8').replace(/\r/g, '').trimEnd().split('\n');
const cur = readFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8').replace(/\r/g, '').trimEnd().split('\n');
const head = pre[0].split('\t');
const preRows = pre.slice(1).map((line) => line.split('\t'));
const curRows = cur.slice(1).map((line) => line.split('\t'));
const byId = new Map(curRows.map((r) => [r[head.indexOf('id')], r]));
if (!byId.has(ID)) throw new Error('当前池没有候选 ' + ID);
if (byId.has(TARGET)) throw new Error('靶点仍在池里：' + TARGET);
const ordered = [];
for (const row of preRows) {
  const id = row[head.indexOf('id')];
  if (id === TARGET) ordered.push(byId.get(ID));
  else if (byId.has(id)) ordered.push(byId.get(id));
}
for (const row of curRows) {
  const id = row[head.indexOf('id')];
  if (id !== ID && !preRows.some((r) => r[head.indexOf('id')] === id)) ordered.push(row);
}
writeFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), [head.join('\t'), ...ordered.map((r) => r.join('\t'))].join('\n') + '\n');

const seatSummary = {};
for (const seed of [90210, 90211]) {
  const canonicalPath = resolve(ROOT, 'champion-map/pool-seat-' + seed + '.tsv');
  const candidatePath = resolve(ROOT, OUT, ID + '-seat-candidate-' + seed + '.tsv');
  const canonical = readFileSync(canonicalPath, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const cand = readFileSync(candidatePath, 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const h = canonical[0].split('\t');
  const existing = new Set(canonical.slice(1).map((line) => line.split('\t')[h.indexOf('id')]));
  const add = cand.slice(1).map((line) => line.split('\t')).filter((r) => !existing.has(r[h.indexOf('id')]));
  writeFileSync(canonicalPath, canonical.concat(add.map((r) => r.join('\t'))).join('\n') + '\n');
  seatSummary[seed] = { appended: add.length, totalRows: canonical.length - 1 + add.length };
}
writeFileSync(resolve(ROOT, OUT, ID + '-admission-finalize.json'), JSON.stringify({ id: ID, target: TARGET, members: ordered.length, seatSummary }, null, 2));
console.log(JSON.stringify({ id: ID, target: TARGET, members: ordered.length, seatSummary }));
