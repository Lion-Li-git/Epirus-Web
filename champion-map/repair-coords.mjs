/* repair-coords.mjs —— §E307 一次性修数据：coords.tsv 的 13 个行为列有 9 列贴错了名字。
 *
 * 病因（不是测量错，是**落盘时表头与值的顺序不是同一份清单**）：
 *   `e287-figs.mjs` 写表头用的是字面量数组 [dmg,heavy,holo,**rounds,drawRate,zeroRate,seatSpread,distinctKeys,charges,waste,noThreatStance,fieldAAtk,rwDmg]**
 *   写值用的却是另一个 `COORD` 数组 [dmg,heavy,holo,**zeroRate,drawRate,rounds,distinctKeys,seatSpread,rwDmg,charges,waste,noThreatStance,fieldAAtk,fieldARounds]**
 *   ⇒ 从第 4 列起整体错位；`num()` 对缺列返回 NaN 又被 `toFixed` 变成 0，所以没有任何一处报错。
 *
 * 用真测逐项验过置换关系（`selfPlay`/`seatSymmetry`/`reflectWall` 现测 2 枚）：
 *   表上 distinctKeys 14.433 / 17.647 = 真测 seatSpread **逐位相同**；表上 rwDmg 0.2179 / 0.2259 = 真测 fieldAAtk **逐位相同**；
 *   表上 rounds 恒 0 ↔ 真测 zeroRate 恒 0、表上 zeroRate 19.3/33.2 ↔ 真测 rounds 19.5/33.3（差在抽样噪声内）；
 *   表上 charges 16.575/16.0 = 真测 rwDmg 16.7/15.95（反弹墙伤害/局，与 promote 印的 15.95 对上）。
 *
 * 修法取**最稳的一条**：不猜置换，而是从**表头本来就正确**的量具落盘 `e287-ruler-s*.tsv` 按 id 重接行为列；
 *   几何列（x2/y2/x3/y3/z3）与 H/S/Geff/F/rank **一字节不动** ⇒ 已经复核过的地图不会因此挪动。
 * 用法：node champion-map/repair-coords.mjs [--check]     （--check 只报不改）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OLD = join(HERE, '..', 'docs', 'artifacts', 'e287-out');
const CHECK = process.argv.includes('--check');
const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges',
  'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg'];

function tsv(p) { const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'), h = L[0].split('\t');
  return { h, rows: L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }) }; }

/* 量具三片按 id 合并（同 id 取第一片有的值 —— 尺是同一把，分片只是并行）*/
const RUL = {};
let nRul = 0;
for (const f of ['e287-ruler-s1.tsv', 'e287-ruler-s2.tsv', 'e287-ruler-s3.tsv', 'e287-ruler-plotted.tsv']) {
  const p = join(OLD, f); if (!existsSync(p)) continue;
  const t = tsv(p);
  if (!BEH.every(k => t.h.indexOf(k) >= 0)) { console.log('  跳过 ' + f + '（缺行为列）'); continue; }
  for (const r of t.rows) { if (!r.id || RUL[r.id]) continue; RUL[r.id] = r; nRul++; }
}
console.log('量具侧可接的枚数 ' + nRul + ' ‖ 行为列 ' + BEH.length + ' 个（表头与值同源）');

const C = tsv(join(HERE, 'coords.tsv'));
let fixed = 0, miss = [], chg = {};
const out = C.rows.map(r => {
  const src = RUL[r.id];
  if (!src) { miss.push(r.id); return r; }
  for (const k of BEH) { const v = Number(src[k]);
    if (!isFinite(v)) continue;
    if (String(r[k]) !== v.toFixed(4)) { chg[k] = (chg[k] || 0) + 1; r[k] = v.toFixed(4); fixed++; } }
  return r;
});
console.log('改动 ' + fixed + ' 个格子；按列：' + Object.keys(chg).sort().map(k => k + '×' + chg[k]).join('  '));
console.log('量具里没有记录的枚数 ' + miss.length + (miss.length ? '（' + miss.slice(0, 6).join(' ') + '…）' : ''));
for (const k of BEH) { const v = out.map(r => Number(r[k])).filter(isFinite);
  const nz = v.filter(x => x !== 0).length;
  console.log('  ' + k.padEnd(15) + ' 非零 ' + String(nz).padStart(4) + '/' + v.length + '  中位 ' +
    v.slice().sort((a, b) => a - b)[v.length >> 1]); }
if (CHECK) { console.log('--check：未写文件'); process.exit(0); }
if (!miss.length) {
  writeFileSync(join(HERE, 'coords.tsv'), C.h.join('\t') + '\n' +
    out.map(r => C.h.map(k => r[k]).join('\t')).join('\n') + '\n');
  console.log('已写 coords.tsv（几何列与 H/S/Geff/F/rank 原样保留）');
} else console.error('⛔ 有 ' + miss.length + ' 枚接不到量具记录 ⇒ 不写，先补 ' + 'e287-measure.mjs');
