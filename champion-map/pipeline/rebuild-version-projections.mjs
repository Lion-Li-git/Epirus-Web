#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable, writeTable } from '../map-table.mjs';
import { VERSION_PROJ_COLS } from './build-view.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
const DRY = process.argv.includes('--dry');
const VERSIONS = [['1.8', '18'], ['2.0', '20']];
const SOURCE = ['xt', 'yt', 'xt3', 'yt3', 'zt3'];
const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk'];

const display = readTable(join(DATA, 'display.tsv'));
for (const c of ['id', 'ver'].concat(FEAT)) if (display.ix[c] === undefined) throw new Error('display.tsv 缺列 ' + c);
const header = display.header.slice();
for (const c of VERSION_PROJ_COLS) if (!header.includes(c)) header.push(c);
const ix = Object.fromEntries(header.map((c, i) => [c, i]));
const rows = display.rows.map((r) => { const out = header.map((_, i) => r[i] ?? ''); return out; });
const byId = new Map(rows.map((r) => [r[ix.id], r]));
const buildDir = join(DATA, 'build');
mkdirSync(buildDir, { recursive: true });

for (const [ver, suffix] of VERSIONS) {
  const subset = rows.filter((r) => r[ix.ver] === ver);
  if (subset.length < 4) throw new Error(ver + ' 版本点数不足：' + subset.length);
  const input = join(buildDir, 'version-' + ver + '-projection-input.tsv');
  writeTable(input, { header, rows: subset }, { backup: false });
  execFileSync('node', [join(HERE, '../proj-tsne.mjs'), '--in=' + input], { cwd: ROOT, stdio: 'inherit' });
  const fitted = readTable(input);
  const cols = ['xt' + suffix, 'yt' + suffix, 'xt3' + suffix, 'yt3' + suffix, 'zt3' + suffix];
  let changed = 0;
  for (const r of fitted.rows) {
    const dst = byId.get(r[fitted.ix.id]);
    if (!dst) throw new Error('投影结果含 display 未知 id：' + r[fitted.ix.id]);
    for (let i = 0; i < SOURCE.length; i++) {
      const v = r[fitted.ix[SOURCE[i]]];
      if (!Number.isFinite(Number(v))) throw new Error(ver + ' 投影非数：' + r[fitted.ix.id] + ' ' + SOURCE[i]);
      if (dst[ix[cols[i]]] !== v) changed++;
      dst[ix[cols[i]]] = v;
    }
  }
  console.log('版本 ' + ver + '：' + subset.length + ' 枚独立拟合，写入 ' + cols.join('/') + '，变化 ' + changed + ' 格');
}

for (const [ver, suffix] of VERSIONS) {
  const members = rows.filter((r) => r[ix.ver] === ver);
  const cols = ['xt' + suffix, 'yt' + suffix, 'xt3' + suffix, 'yt3' + suffix, 'zt3' + suffix];
  for (const r of members) for (const c of cols) if (!Number.isFinite(Number(r[ix[c]]))) throw new Error(ver + ' 缺投影 ' + r[ix.id] + ' ' + c);
  const moved = members.filter((r) => Math.abs(+r[ix['xt3' + suffix]] - +r[ix.xt3]) > 1e-6 || Math.abs(+r[ix['yt3' + suffix]] - +r[ix.yt3]) > 1e-6 || Math.abs(+r[ix['zt3' + suffix]] - +r[ix.zt3]) > 1e-6).length;
  if (moved !== members.length) throw new Error(ver + ' 仍有 ' + (members.length - moved) + ' 枚三维坐标与全库投影相同');
  console.log('版本 ' + ver + ' 自证：' + moved + '/' + members.length + ' 枚三维坐标不同于全库 fit');
}

if (DRY) { console.log('--dry：计算完成，未写 display/projections'); process.exit(0); }
const projections = readTable(join(DATA, 'projections.tsv'));
const phead = projections.header.slice();
for (const c of VERSION_PROJ_COLS) if (!phead.includes(c)) phead.push(c);
const pix = Object.fromEntries(phead.map((c, i) => [c, i]));
const prows = projections.rows.map((r) => {
  const out = phead.map((_, i) => r[i] ?? '');
  const src = byId.get(out[pix.pack_id]);
  if (!src) throw new Error('projections 含 display 未知 id：' + out[pix.pack_id]);
  for (const c of VERSION_PROJ_COLS) out[pix[c]] = src[ix[c]];
  return out;
});
writeTable(join(DATA, 'display.tsv'), { header, rows }, { backup: false });
writeTable(join(DATA, 'projections.tsv'), { header: phead, rows: prows }, { backup: false });
console.log('已写 display.tsv / projections.tsv：' + rows.length + ' 行，版本投影列 ' + VERSION_PROJ_COLS.length + ' 个');
