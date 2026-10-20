/* pool-traits.mjs —— 池成员的两列"选池看不见的性状"（DS 10-20，用户 A1）
 *
 * 为什么要有它：选池只看 H（夺冠率），而 10-20 的簇分析显示两件事在界面上**都看不见**：
 *   ① **广度**（过线才有资格谈强度；线外高分是"牺牲广度换的"）；
 *   ② **送盾**（全库 30.5% / 过线集 24.7% 是"刷盾型"，而送盾与强度 r=−0.198）。
 *
 * 只是**读数表**：不判、不挡、不进池表 schema（`pool-members.tsv` 的列被 `pool-add`/`viewer`/`fold-coords` 读，不动它）。
 *
 * 用法：node champion-map/pool-traits.mjs [--out=champion-map/pool-traits.tsv]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from '../tools/audit-lib.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['out'], 'pool-traits');
const flag = (n, d) => { for (let i = 0; i < argv.length; i++) { if (argv[i] === '--' + n) return argv[i + 1]; const p = '--' + n + '='; if (argv[i].startsWith(p)) return argv[i].slice(p.length); } return d; };
const OUT = flag('out', 'champion-map/pool-traits.tsv');
const rd = (rel) => readFileSync(join(ROOT, rel), 'utf8').trim().split(/\r?\n/).map(l => l.split('\t'));
const co = rd('champion-map/coords.tsv'); const ch = co[0];
const ci = (n) => ch.indexOf(n);
const byId = new Map();
for (const c of co.slice(1)) {
  const o = {}; ch.forEach((k, i) => o[k] = c[i]);
  byId.set(o.id, o);
}
/* coords 的 `holo` 是**裸包**读数；产品开档 2 之后实际是 `holoOtherPrior2`（`holo.tsv`）。
 *   两列都印 —— 只印裸包会把 v7beadseed-82 读成 16 次/局（它开档后 5.4），那是**口径混读**。 */
let holoPrior2 = new Map();
try {
  const ht = rd('champion-map/holo.tsv'); const hh = ht[0];
  const iId = hh.indexOf('id'), iP2 = hh.indexOf('holoOtherPrior2');
  if (iP2 >= 0) for (const c of ht.slice(1)) { const v = parseFloat(c[iP2]); if (isFinite(v)) holoPrior2.set(c[iId], v); }
} catch (e) { holoPrior2 = new Map(); }
const pm = rd('champion-map/pool-members.tsv'); const ph = pm[0];
const pi = (n) => ph.indexOf(n);
const rows = [];
const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : null; };
for (const c of pm.slice(1)) {
  const o = {}; ph.forEach((k, i) => o[k] = c[i]);
  const base = String(o.path || '').split('/').pop().replace(/\.(bak|js)$/, '');
  const g = byId.get(o.id) || byId.get(base) || null;
  if (!g) { rows.push({ id: o.id, tier: o.tier, miss: true }); continue; }
  rows.push({
    id: o.id, tier: o.tier, holoP2: holoPrior2.has(o.id) ? holoPrior2.get(o.id) : null,
    hplong: num(g.Hplong), geff: num(g.Geff), keys: num(g.distinctKeys),
    holo: num(g.holo), charges: num(g.charges), rounds: num(g.rounds), noThreat: num(g.noThreatStance),
    miss: false
  });
}
const okRows = rows.filter(r => !r.miss && r.geff !== null);
const gm = (k) => { const v = okRows.map(r => r[k]).filter(x => x !== null); return v.reduce((s, x) => s + x, 0) / v.length; };
const GH = gm('holo'), GG = gm('geff');
const H = ['id','tier','Hplong','Geff','distinctKeys','holo裸包','holo开档2','charges(环/局)','rounds','noThreatStance','广度过线','送盾偏高(按产品口径)'];
const out = [H.join('\t')];
for (const r of rows.sort((a, b) => (b.hplong ?? -1) - (a.hplong ?? -1))) {
  if (r.miss) { out.push([r.id, r.tier, '', '', '', '', '', '', '', '缺 coords', ''].join('\t')); continue; }
  out.push([r.id, r.tier,
    r.hplong === null ? '' : r.hplong.toFixed(1), r.geff === null ? '' : r.geff.toFixed(2),
    r.keys === null ? '' : r.keys.toFixed(1), r.holo === null ? '' : r.holo.toFixed(2),
    r.holoP2 === null ? '' : r.holoP2.toFixed(2),
    r.charges === null ? '' : r.charges.toFixed(2), r.rounds === null ? '' : r.rounds.toFixed(1),
    r.noThreat === null ? '' : r.noThreat.toFixed(3),
    (r.geff !== null && r.geff >= 3 ? 'yes' : '**NO**'),
    (function () { const v = (r.holoP2 !== null ? r.holoP2 : r.holo); if (v === null) return ''; return v > 2 * GH ? ('**高 ' + (v / GH).toFixed(1) + 'x**') : ''; })()
  ].join('\t'));
}
writeFileSync(join(ROOT, OUT), '\ufeff' + out.join('\r\n') + '\r\n', 'utf8');
console.log('写 ' + OUT + '（' + rows.length + ' 枚；全局均值 Geff=' + GG.toFixed(2) + ' 送盾=' + GH.toFixed(2) + '）');
const off = okRows.filter(r => r.geff < 3);
console.log('广度未过线的：' + off.length + ' 枚' + (off.length ? ' ⇒ ' + off.map(r => r.id + '(' + r.geff.toFixed(2) + ')').join(' ') : ''));
const spam = okRows.filter(r => r.holo > 2 * GH);
console.log('送盾 > 2× 全局均值的：' + spam.length + ' 枚' + (spam.length ? ' ⇒ ' + spam.map(r => r.id + '(' + r.holo.toFixed(2) + ')').join(' ') : ''));