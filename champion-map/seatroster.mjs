/* §E576 人席批的**抽样框**（跑前定，不许看完数再挑）
 *
 * 为什么要单独一份脚本：§E506 那 24 臂的人席六格读数**只存在于 markdown 里**
 *   （`champion-map/seat-cands-2026-10-09.tsv` 实测只有 Ldemo / v7beadseed-93 / D4a / G-s72 四枚，
 *    文档那张表还写着"…（中略 12 枚）"）⇒ "分数尺 ⊥ 人席"这条结论承重的那批数据没有结构化件。
 *   这一批要同时干两件事：把 24 枚的逐格原值落成 tsv，以及**把抽样框定义清楚**——
 *   关联筛查需要的是"覆盖行为空间"，不是"挑强包"。按分数挑会让清单只反映强包那一段的行为分布。
 *
 * 规矩（写死在这里，跑前）：
 *   ① 6 枚**点名**必进：现役 Ldemo 与 K2（两个基线，参照必须从 coords 的 path 列取，§E330 同族的坑）、
 *      contX-201、v7beadseed-93、D4a、G-s72（Claude 的 roster 里那三枚 + 那条没人跟的线索）。
 *      ⚠ contX-201 **不在 coords 里**（实测 0 命中），它在册的地方是 `cont1200-2026-10-10.tsv` +
 *        `docs/artifacts/e315-out/contX-201.js` ⇒ 它的行为列只能从那次跑的读数补，本轮先当"未知形状"入池。
 *   ② 其余 18 枚用**最远点贪心**（farthest-point）在 z 化的行为维上铺：先撒 6 枚点名，
 *      每次加入"离已选集合最远"的那枚 ⇒ 拿的是行为空间的**边角覆盖**，不是分位数。
 *   ③ 候选池限定：`coords.tsv` 里 path 存在、且行为列都取得到值的行（缺列就不参与，别用 0 填）。
 *   ④ 打印每枚入选理由（点名 / 第几步加入 + 当时距离），事后能查"这只手有没有偷偷挑强的"。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const TOTAL = Number(arg('n', 24));
const SEEDS = ['SHIPPED-Ldemo', 'K2', 'v7beadseed-93', 'D4a', 'G-s72'];   // contX-201 不在 coords，单独追加
/* 行为维：z 化后铺覆盖用。刻意不含分数列（Hp/H/De）⇒ 这不是"挑好包"。 */
const DIMS = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];

const L = readFileSync(join(HERE, 'coords.tsv'), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
const H = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
const rows = L.slice(1).map(l => l.split('\t'));
const pool = [];
for (const r of rows) {
  const path = r[H.path];
  if (!path || !existsSync(join(ROOT, path))) continue;
  const v = DIMS.map(k => Number(r[H[k]]));
  if (v.some(x => !isFinite(x))) continue;
  pool.push({ id: r[H.id], path: path, v: v, Hp: Number(r[H.Hp]), H: Number(r[H.H]) });
}
/* z 化用全池的均值与标准差（不是被选子集的）⇒ 距离尺度与选择过程无关 */
const mu = DIMS.map((_, j) => pool.reduce((s, p) => s + p.v[j], 0) / pool.length);
const sg = DIMS.map((_, j) => Math.sqrt(pool.reduce((s, p) => s + (p.v[j] - mu[j]) ** 2, 0) / pool.length) || 1);
const zOf = p => p.v.map((x, j) => (x - mu[j]) / sg[j]);
const dist = (a, b) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) ** 2, 0));

const chosen = [], why = [];
const byId = id => pool.filter(p => p.id === id)[0];
for (const s of SEEDS) { const p = byId(s); if (p) { chosen.push(p); why.push([p.id, '点名(基线/待核)', '']); } else console.log('  ⚠ 点名 ' + s + ' 在 coords 里查不到（或 path 不存在）'); }
while (chosen.length < TOTAL) {
  const Z = chosen.map(p => zOf(p));
  let best = null, bd = -1;
  for (const p of pool) {
    if (chosen.indexOf(p) >= 0) continue;
    const z = zOf(p);
    const d = Math.min.apply(null, Z.map(q => dist(z, q)));
    if (d > bd) { bd = d; best = p; }
  }
  if (!best) break;
  chosen.push(best); why.push([best.id, '最远点贪心 第 ' + (chosen.length - SEEDS.length) + ' 步', bd.toFixed(2)]);
}
console.log('# 池 ' + pool.length + ' 枚（path 存在且 ' + DIMS.length + ' 维齐全）‖ 选 ' + chosen.length + ' 枚 ‖ 维度: ' + DIMS.join(','));
console.log('# id | 入选理由 | 当时最近距离 | Hp | H');
for (let i = 0; i < chosen.length; i++) console.log(chosen[i].id + ' | ' + why[i][1] + ' | ' + (why[i][2] || '—') + ' | ' + chosen[i].Hp + ' | ' + chosen[i].H);
console.log('\n# 跑法：\n#   node tools/probe-human-seat.mjs --packs=' + chosen.map(p => p.path).join(',') + ' --games=200 --seed=90210');
console.log('#   （第二粒 seed 复量噪声：--seed=90211 再跑一遍同一份 roster）');
