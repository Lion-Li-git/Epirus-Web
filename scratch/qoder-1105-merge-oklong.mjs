/* 把全腿长程的 `okLong/failsLong` 并进目标表（Qoder · 11-05）
 * 为什么不直接用 `attach-hlong.mjs`：它的 `--table=` **已经是"长程 eps-full 源表"的旗标**（要 exam/page 两列），
 *   并且一次写五列（Hlong/Hplong/Flong/okLong/failsLong）；我们这次只补 2.0 那 39 枚的**环**，
 *   没有那份长程源表、也不想动另外三列 ⇒ 定向合并这两列，只落在 `--ids` 名单上，其余行逐字不动。
 * 用法：node scratch/qoder-1105-merge-oklong.mjs --table=coords-gen3-1105.tsv --ids=<39 个 id 的 txt> --feas=feas-long-g3-1105.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(import.meta.dirname, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const TABLE = arg('table', 'coords-gen3-1105.tsv');
const FEAS = arg('feas', 'feas-long-g3-1105.tsv');
const IDS = new Set(readFileSync(arg('ids', ''), 'utf8').replace(/\r/g, '').trim().split('\n').filter(Boolean));
const rd = (p) => { const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t')); return L; };
const F = rd(join(ROOT, 'champion-map', FEAS));
const fh = Object.fromEntries(F[0].map((x, i) => [x, i]));
if (fh.ok === undefined || fh.legsMode === undefined) { console.error('⛔ ' + FEAS + ' 缺 ok/legsMode 列'); process.exit(2); }
const OK = {};
for (const r of F.slice(1)) {
  if (!r[fh.id]) continue;
  if (!/^all-long/.test(String(r[fh.legsMode] || ''))) { console.error('⛔ ' + FEAS + ' 有行 legsMode 不是 all-long：' + r[fh.id]); process.exit(2); }
  OK[r[fh.id]] = { ok: r[fh.ok] === '1' ? 1 : (r[fh.ok] === '0' ? 0 : null), fails: String(r[fh.fails] || '').slice(0, 120) };
}
const CO = rd(join(ROOT, 'champion-map', TABLE));
const ch = Object.fromEntries(CO[0].map((x, i) => [x, i]));
for (const c of ['okLong', 'failsLong']) if (ch[c] === undefined) { console.error('⛔ ' + TABLE + ' 没有 ' + c + ' 列'); process.exit(2); }
let n = 0, nOk = 0, skip = 0;
for (const r of CO.slice(1)) {
  const id = r[ch.id]; if (!id || !IDS.has(id)) continue;
  const e = OK[id]; if (!e) { skip++; continue; }
  r[ch.okLong] = e.ok === null ? '-' : String(e.ok);
  r[ch.failsLong] = e.fails;
  n++; if (e.ok === 1) nOk++;
}
writeFileSync(join(ROOT, 'champion-map', TABLE), CO.map(r => r.join('\t')).join('\n') + '\n', 'utf8');
console.log(TABLE + '：名单内并上长程环 ' + n + ' 枚（过 ' + nOk + '）‖ 名单内没量到 ' + skip + ' ‖ 名单外行逐字未动');
