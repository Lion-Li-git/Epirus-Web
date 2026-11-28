#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags, ROOT } from './audit-lib.mjs';
import { OPP_SPECS } from '../training/server/opp-pool.mjs';
import { rulesFingerprint } from './rules-fingerprint.mjs';
import { widOf } from '../champion-map/pack-id.mjs';

rejectUnknownFlags(process.argv.slice(2), ['pack', 'compare', 'out'], 'probe-minit-effectiveness');
const arg = (key, fallback) => {
  const hit = process.argv.find(value => value.indexOf('--' + key + '=') === 0);
  return hit ? hit.slice(key.length + 3) : fallback;
};
const packArg = arg('pack', '');
const compareArg = arg('compare', '');
const outArg = arg('out', '');
if ((!packArg && !compareArg) || (packArg && compareArg)) {
  console.error('⛔ 用法：--pack=<path|id> 或 --compare=<id1,id2>，二选一');
  process.exit(2);
}

const poolPath = join(ROOT, 'champion-map/data/page/pool-members.tsv');
const poolLines = readFileSync(poolPath, 'utf8').replace(/\r/g, '').trim().split('\n');
const poolHead = poolLines[0].split('\t');
const pool = poolLines.slice(1).map(line => {
  const cells = line.split('\t');
  return Object.fromEntries(poolHead.map((key, index) => [key, cells[index]]));
});

const fixturePath = join(ROOT, 'champion-map/data/skill-report/fixtures.tsv');
const fixtureLines = readFileSync(fixturePath, 'utf8').replace(/\r/g, '').split('\n')
  .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
const fixtureKey = fixtureLines.find(line => line.indexOf('fixtureKey\t') === 0).split('\t')[1];
const scripts = fixtureLines.filter(line => line.indexOf('script\t') === 0).map(line => line.split('\t')[1]);
const realLine = fixtureLines.find(line => line.indexOf('real-opponents\t') === 0);
if (!fixtureKey || !scripts.length || !realLine) {
  console.error('⛔ fixtures.tsv 缺 fixtureKey、script 或 real-opponents');
  process.exit(2);
}
const realIds = realLine.split('\t')[1].split(',').map(value => value.trim()).filter(Boolean);
const oppByName = new Map(OPP_SPECS.map(spec => [spec.name, spec]));
for (const name of scripts) {
  if (!oppByName.has(name)) throw new Error('fixtures.tsv 的脚本对手未登记：' + name);
}

function resolvePack(spec) {
  const candidate = isAbsolute(spec) ? spec : join(ROOT, spec);
  if (existsSync(candidate)) {
    return { id: basename(candidate).replace(/\.(bak|js)$/, ''), path: candidate };
  }
  const row = pool.find(member => member.id === spec);
  if (row) return { id: row.id, path: join(ROOT, row.path) };
  for (const extension of ['.bak', '.js']) {
    const artifact = join(ROOT, 'docs/artifacts', spec + extension);
    if (existsSync(artifact)) return { id: spec, path: artifact };
  }
  throw new Error('未知包 id 或路径：' + spec);
}

const W = sandbox();
const R = W.EpirusRules;
const T = W.EpirusTrainer;
const B = W.EpirusBots;
const TEMP = 0.15;
const GAMES = 10;
const fingerprint = rulesFingerprint();

function scoreBucket(key) {
  const def = R.byKey[key];
  if (!def) throw new Error('小雷打到了未知技能键：' + key);
  if (key === R.SK.RING || key === R.SK.LASER_EYE) return '2pt(ring/3+ep)';
  const ep = typeof def.cost === 'number' ? def.cost : 0;
  if (ep >= 3) return '2pt(ring/3+ep)';
  if (ep === 2) return '1pt(2ep)';
  if (def.cat === R.CAT.DEFENSE) return '0pt(def)';
  if (key === R.SK.JI || key === R.SK.GUN) return '0pt(ji/gun)';
  return '0pt(1ep_other)';
}

function emptyStats() {
  return {
    casts: 0,
    voided: 0,
    immune: 0,
    rodBlock: 0,
    totalPts: 0,
    buckets: {
      '2pt(ring/3+ep)': 0,
      '1pt(2ep)': 0,
      '0pt(def)': 0,
      '0pt(ji/gun)': 0,
      '0pt(1ep_other)': 0,
    },
    voidedByKey: {},
    immuneByKey: {},
  };
}

function addCount(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function scanGame(events, seat, stats) {
  let cast = null;
  let pendingVoid = null;
  let pendingVoidMirror = false;
  let previous = null;
  for (const event of events || []) {
    const mirrored = !!(previous && previous.type === 'mirror' && previous.key === R.SK.MINI_T);
    if (event.type === 'action') {
      if (event.pid === seat) {
        cast = null;
        if (event.key === R.SK.MINI_T && event.outcome === 'ok') {
          stats.casts++;
          cast = { target: event.target, resolved: false };
        }
      }
    } else if (event.type === 'voided') {
      pendingVoid = event;
      pendingVoidMirror = mirrored;
    } else if (event.type === 'voidedBy' && event.by === R.SK.MINI_T) {
      if (!pendingVoidMirror && pendingVoid && pendingVoid.byPid === seat && cast && !cast.resolved && cast.target === event.pid) {
        const key = pendingVoid.voids;
        const bucket = scoreBucket(key);
        stats.voided++;
        stats.totalPts += bucket.startsWith('2pt') ? 2 : bucket.startsWith('1pt') ? 1 : 0;
        stats.buckets[bucket]++;
        addCount(stats.voidedByKey, key);
        cast.resolved = true;
      }
      pendingVoid = null;
      pendingVoidMirror = false;
    } else if (event.type === 'voidImmune' && event.by === R.SK.MINI_T) {
      if (!mirrored && cast && !cast.resolved && cast.target === event.pid) {
        scoreBucket(event.key);
        stats.immune++;
        addCount(stats.immuneByKey, event.key);
        cast.resolved = true;
      }
    } else if (event.type === 'rodBlock' && event.by === R.SK.MINI_T) {
      if (!mirrored && cast && !cast.resolved && cast.target === event.pid) {
        stats.rodBlock++;
        cast.resolved = true;
      }
    }
    previous = event;
  }
}

function measure(pack) {
  const params = loadChamp(W, pack.path);
  if (!params) throw new Error('包读不出：' + pack.path);
  const base = T.policyChooserN(params, TEMP);
  const opponents = scripts.map(name => {
    const spec = oppByName.get(name);
    if (typeof B[spec.fn] !== 'function') throw new Error('脚本对手函数不存在：' + name);
    return { name, chooser: T.wrapBotN(B[spec.fn]), real: false };
  });
  for (const id of realIds) {
    const member = pool.find(row => row.id === id);
    if (!member) throw new Error('fixtures.tsv 的真包对手不在池表：' + id);
    const opponentParams = loadChamp(W, join(ROOT, member.path));
    if (!opponentParams) throw new Error('真包对手读不出：' + member.path);
    opponents.push({ name: id, chooser: T.policyChooserN(opponentParams, TEMP), real: true });
  }
  const stats = emptyStats();
  for (const opponent of opponents) {
    for (const n of [2, 3, 5, 8]) {
      for (const mode of ['multi', 'long']) {
        for (let game = 0; game < GAMES; game++) {
          const seat = game % n;
          const choosers = [];
          for (let pid = 0; pid < n; pid++) choosers.push(pid === seat ? base : opponent.chooser);
          const seed = 910000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + game * 977 + (opponent.real ? 7919 : 0);
          const result = T.oneGameN(choosers, seed, n, { mode });
          scanGame(result.state.events, seat, stats);
        }
      }
    }
  }
  return {
    id: pack.id,
    path: pack.path,
    wid: widOf(readFileSync(pack.path, 'utf8')),
    fixtureKey,
    rulesFingerprint: fingerprint,
    measuredAt: new Date().toISOString(),
    cells: opponents.length * 8 * GAMES,
    stats,
  };
}

function formatCounts(counts) {
  return Object.entries(counts).map(([key, value]) => key + ':' + value).join(', ');
}

function formatReport(report) {
  const stats = report.stats;
  const lines = [
    '',
    '=== ' + report.id + ' ===',
    '  fixtureKey: ' + report.fixtureKey + ' | rulesFingerprint: ' + report.rulesFingerprint + ' | wid: ' + report.wid + ' | cells: ' + report.cells + ' | measuredAt: ' + report.measuredAt,
    '  casts(ok): ' + stats.casts + ' | non-mirror voided: ' + stats.voided + ' | voidImmune: ' + stats.immune + ' | rodBlock: ' + stats.rodBlock,
    '  totalPts: ' + stats.totalPts + ' | pts/cast: ' + (stats.casts ? (stats.totalPts / stats.casts).toFixed(3) : '0.000') + ' | pts/voidedHit: ' + (stats.voided ? (stats.totalPts / stats.voided).toFixed(3) : '0.000'),
    '  buckets: {',
  ];
  for (const [key, value] of Object.entries(stats.buckets)) lines.push('  ' + JSON.stringify(key) + ': ' + value + ',');
  lines.push('}');
  lines.push('  voided hitsByKey: ' + formatCounts(stats.voidedByKey));
  lines.push('  immuneByKey: ' + formatCounts(stats.immuneByKey));
  lines.push('');
  return lines.join('\n');
}

const specs = compareArg ? compareArg.split(',').map(value => value.trim()).filter(Boolean) : [packArg];
if (specs.length !== 1 && specs.length !== 2) {
  console.error('⛔ --compare 只接受 1 或 2 个包 id');
  process.exit(2);
}
if (compareArg && specs.some(spec => isAbsolute(spec) || spec.includes('/') || spec.includes('\\'))) {
  console.error('⛔ --compare 只接受池表包 id');
  process.exit(2);
}
const reports = specs.map(resolvePack).map(measure);
const text = reports.map(formatReport).join('\n');
console.log(text);
if (outArg) {
  const outPath = isAbsolute(outArg) ? outArg : join(ROOT, outArg);
  writeFileSync(outPath, text, 'utf8');
  console.log('已写 ' + outPath);
}
