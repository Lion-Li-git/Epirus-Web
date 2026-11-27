import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { widOf } from '../../../champion-map/pack-id.mjs';
import { rdTable, bandMeans, killTotalBand, pairHasBase } from '../../../champion-map/seat-rule.mjs';

const ROOT = process.cwd();
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.SEAT_ID || 'L1B-S1200';
const CAND = process.env.SEAT_PACK || 'scratch/arms/nov27-long-pgdr-l1b.seg1200.bak';
const labels = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '规则理解·自适应', '攒钱+反弹(会玩)', '重火力+反弹'];
const header = ['id', 'path', 'mode', 'games', 'seed0', ...labels, '六格均值', '最大格', '最大格是谁', '和棋均值'];

function parse(raw, seed) {
  const lines = raw.split(/\r?\n/);
  const rows = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^==\s+(.+)$/);
    if (m) {
      current = { id: m[1].trim() === 'js/bundled-champion-3p.js' ? 'bundled-champion-3p' : ID,
        path: m[1].trim() === 'js/bundled-champion-3p.js' ? 'js/bundled-champion-3p.js' : CAND };
      continue;
    }
    const mm = line.match(/^\s*(multi|long)\s+(.+)$/);
    if (!mm || !current) continue;
    const vals = [], draws = [];
    for (const label of labels) {
      const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+([\\d.]+)%\\(和([\\d.]+)%\\)');
      const hit = mm[2].match(re);
      if (!hit) throw new Error('人席行缺列：' + label + '\n' + line);
      vals.push(Number(hit[1]));
      draws.push(Number(hit[2]));
    }
    const max = Math.max(...vals);
    rows.push([current.id, current.path, mm[1], 200, seed, ...vals,
      vals.reduce((a, b) => a + b, 0) / vals.length,
      max, labels[vals.indexOf(max)], draws.reduce((a, b) => a + b, 0) / draws.length]);
  }
  if (rows.length !== 4) throw new Error('人席解析行数不是 4：' + rows.length);
  return rows;
}

const batches = [];
const summary = [];
for (const seed of [90210, 90211]) {
  const raw = readFileSync(resolve(ROOT, OUT, ID + '-seat-' + seed + '.tsv'), 'utf8');
  const parsed = parse(raw, seed);
  const candidateRows = parsed.filter((r) => r[0] === ID);
  const candPath = resolve(ROOT, OUT, ID + '-seat-candidate-' + seed + '.tsv');
  writeFileSync(candPath, header.join('\t') + '\n' + candidateRows.map((r) => r.join('\t')).join('\n') + '\n');
  const canonicalLines = readFileSync(resolve(ROOT, 'champion-map/pool-seat-' + seed + '.tsv'), 'utf8').replace(/\r/g, '').trimEnd().split('\n');
  const canonicalHead = canonicalLines[0].split('\t');
  const idCol = canonicalHead.indexOf('id');
  const kept = canonicalLines.slice(1).filter((line) => line.split('\t')[idCol] !== ID);
  const full = [canonicalLines[0], ...kept, ...candidateRows.map((r) => r.join('\t'))].join('\n') + '\n';
  const fullPath = resolve(ROOT, OUT, ID + '-seat-full-' + seed + '.tsv');
  writeFileSync(fullPath, full);
  batches.push(rdTable(fullPath, full));
  summary.push({ seed, candidateRows });
}

const pool = readFileSync(resolve(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8').trim().split(/\r?\n/);
const ph = pool[0].split('\t');
const widBands = {};
for (const line of pool.slice(1)) {
  const c = line.split('\t');
  widBands[c[ph.indexOf('wid')]] = c[ph.indexOf('tier')];
}
if (!pairHasBase(batches)) throw new Error('人席批表缺基准');
const readWid = (path) => widOf(readFileSync(resolve(ROOT, path), 'utf8'));
const candWid = readWid(CAND);
const refs = bandMeans(batches, widBands, readWid);
const kills = killTotalBand(ID, batches, refs.soft);
if (kills < 0) throw new Error('候选没有 seatKill 读数');
writeFileSync(resolve(ROOT, OUT, ID + '-seat-summary.json'), JSON.stringify({ id: ID, pack: CAND, wid: candWid, seatKill: kills, band: 'soft', refMode: 'band' }, null, 2));
console.log(JSON.stringify({ id: ID, wid: candWid, seatKill: kills, band: 'soft', refMode: 'band' }));
