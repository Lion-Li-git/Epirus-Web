#!/usr/bin/env node
/* measure-point.mjs —— 新点测量编排（2026-11-11 · add-point 的上游第一版）
 * 只做四件事：跑 A/B × multi/long 四张 exam4、跑 ruler-measure、拼 readings/display、调用 add-point。
 * 不跑 feas（ok 环暂空）；不自动生成投影/rank/F（display 里这些列留空，--bake 可能过不了页检）。
 * 用法：
 *   node champion-map/pipeline/measure-point.mjs --pack=<权重> --id=<id> --ver=2.0 [--rounds=12]
 *     [--no-add] [--bake] [--dry] [--skip-long] [--skip-b]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readTable } from '../map-table.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DRY = process.argv.includes('--dry');
const NO_ADD = process.argv.includes('--no-add');
const BAKE = process.argv.includes('--bake');
const SKIP_LONG = process.argv.includes('--skip-long');
const SKIP_B = process.argv.includes('--skip-b');
const ROOT = resolve(process.cwd());
const HERE = join(ROOT, 'champion-map');
const PACK = resolve(arg('pack', ''));
const ID = String(arg('id', '')).trim();
const VER = String(arg('ver', '2.0')).trim();
const ROUNDS = String(arg('rounds', '12'));
if (!PACK || !ID) { console.error('⛔ 需要 --pack= 和 --id='); process.exit(2); }
if (!existsSync(PACK)) { console.error('⛔ pack 不在：' + PACK); process.exit(2); }
const ST = join(HERE, 'staging');
if (!DRY) mkdirSync(ST, { recursive: true });
const rul = readTable(join(HERE, 'data/rulers.tsv'));
const bRow = rul.rows.find((r) => r[rul.ix.axis] === 'B' && r[rul.ix.status] === 'current');
if (!bRow) { console.error('⛔ 没有 current B 尺'); process.exit(2); }
const F2 = bRow[rul.ix.fixture];
const rel = PACK.replace(ROOT + '\\', '').replace(/\\/g, '/');
const extra = join(ST, ID + '-extra.tsv'), only = join(ST, ID + '-only.txt');
if (!DRY) {
  writeFileSync(extra, 'arm\tproductRel\n' + ID + '\t' + rel + '\n', 'utf8');
  writeFileSync(only, ID + '\n', 'utf8');
}
const runs = [];
const addRun = (tag, args) => runs.push({ tag, args });
const ex = (tag, mode, axis, extraArgs) => {
  const out = join(ST, ID + '-' + tag + '.tsv');
  addRun(tag, ['tools/exam-4n-full.mjs',
    '--out=' + out.replace(HERE + '\\', '').replace(/\\/g, '/'),
    '--extra=' + extra.replace(HERE + '\\', '').replace(/\\/g, '/'),
    '--only=' + only.replace(HERE + '\\', '').replace(/\\/g, '/'),
    '--rounds=' + ROUNDS, '--jobs=1', '--dose=page', '--mode=' + mode, '--exam=' + axis].concat(extraArgs || []));
};
ex('a-multi', 'multi', 'A');
if (!SKIP_LONG) ex('a-long', 'long', 'A');
if (!SKIP_B) {
  ex('b-multi', 'multi', 'B', ['--champ=' + F2]);
  if (!SKIP_LONG) ex('b-long', 'long', 'B', ['--champ=' + F2]);
}
const featOut = join(ST, ID + '-ruler.tsv');
addRun('ruler', ['champion-map/ruler-measure.mjs', '--extra=' + extra.replace(HERE + '\\', '').replace(/\\/g, '/'),
  '--ids=' + ID, '--out=' + featOut.replace(HERE + '\\', '').replace(/\\/g, '/'), '--exam=120', '--self=40', '--seat=100', '--probe=40']);
for (const r of runs) console.log('[measure] ' + r.tag + '：node ' + r.args.join(' '));
if (DRY) { console.log('--dry：未跑任何测量'); process.exit(0); }
for (const r of runs) {
  try {
    const out = execFileSync('node', r.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log('—— ' + r.tag + ' ——\n' + out.trim().split('\n').slice(-2).join('\n'));
  } catch (e) {
    console.error('⛔ ' + r.tag + ' 失败：' + String(e.message || e).slice(0, 300));
    process.exit(2);
  }
}
const cell = [2, 3, 5, 8];
const rd = [['ruler_id', 'cell', 'horizon', 'value', 'n']];
const vals = {};
for (const tag of ['a-multi', 'a-long', 'b-multi', 'b-long']) {
  const f = join(ST, ID + '-' + tag + '.tsv');
  if (!existsSync(f)) continue;
  const t = readTable(f); const row = t.rows[0]; if (!row) continue;
  const [axis, horizon] = tag.split('-');
  for (const c of cell) {
    const x = row[t.ix['x' + c]], n = row[t.ix['n' + c]];
    if (x === undefined || x === '') continue;
    const rid = axis === 'a' ? 'a-v2-page-1109' : 'b-f2-page-1111';
    const hor = horizon === 'multi' ? 'short' : 'long';
    rd.push([rid, String(c), hor, x, n]);
    vals[axis + c + (horizon === 'multi' ? '' : 'L')] = x;
  }
}
writeFileSync(join(ST, ID + '-readings.tsv'), rd.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
const dispHead = readTable(join(HERE, 'data/display.tsv')).header;
const D = new Array(dispHead.length).fill('');
const setD = (c, v) => { const i = dispHead.indexOf(c); if (i >= 0 && v !== undefined && v !== null) D[i] = String(v); };
setD('id', ID); setD('path', rel); setD('ver', VER); setD('lineage', 'new');
const ft = readTable(featOut); const fr = ft.rows[0];
if (!fr) { console.error('⛔ ruler-measure 没产出 ' + ID); process.exit(2); }
for (const c of ['S', 'Geff', 'rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg']) {
  if (ft.ix[c] !== undefined) setD(c, fr[ft.ix[c]]);
}
for (const c of cell) {
  if (vals['a' + c] !== undefined) setD('P' + c, vals['a' + c]);
  if (vals['a' + c + 'L'] !== undefined) setD('P' + c + 'L', vals['a' + c + 'L']);
  if (vals['b' + c] !== undefined) setD('P' + c + 'R', vals['b' + c]);
  if (vals['b' + c + 'L'] !== undefined) setD('P' + c + 'RL', vals['b' + c + 'L']);
  if (vals['a' + c] !== undefined && vals['b' + c] !== undefined) setD('C' + c + 'R', (Number(vals['a' + c]) + Number(vals['b' + c])) / 2);
  if (vals['a' + c + 'L'] !== undefined && vals['b' + c + 'L'] !== undefined) setD('C' + c + 'RL', (Number(vals['a' + c + 'L']) + Number(vals['b' + c + 'L'])) / 2);
}
setD('examG', fr[ft.ix.examG] || '120');
const dispFile = join(ST, ID + '-display.tsv');
writeFileSync(dispFile, [dispHead.join('\t'), D.join('\t')].join('\n') + '\n', 'utf8');
console.log('readings ' + (rd.length - 1) + ' 条 ‖ display ' + basename(dispFile));
if (NO_ADD) { console.log('--no-add：停在 ' + join(ST, ID + '-readings.tsv')); process.exit(0); }
const addArgs = [join(HERE, 'pipeline/add-point.mjs'), '--id=' + ID, '--pack=' + PACK, '--ver=' + VER,
  '--readings=' + join(ST, ID + '-readings.tsv'), '--display=' + dispFile, '--batch=measure-' + ID];
if (BAKE) addArgs.push('--bake');
const out = execFileSync('node', addArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
console.log(out.trim().split('\n').slice(-6).join('\n'));
