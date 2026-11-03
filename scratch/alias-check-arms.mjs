/* 别名检测：一批"看起来是 N 枚候选"的产物里，有没有同一粒权重存了多份。
 * 动因（11-03 审 DS 九臂）：表里 `−0.042` 出现三次 ⇒ 要么三粒真的同分，要么它们本来就是同一粒；
 *   这两种读法给的"九臂"分母完全不同（本仓 D191 管的是 docs/artifacts，这里管任意一批）。
 * 用法：node scratch/alias-check-arms.mjs <目录> [文件名正则] */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DIR = process.argv[2] || 'scratch/ga-arms';
const RE = new RegExp(process.argv[3] || '^BREAD-W');
const rows = [];
for (const f of readdirSync(DIR).filter((x) => RE.test(x) && /\.js$/.test(x))) {
  const t = readFileSync(DIR + '/' + f, 'utf8');
  const cm = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(t);
  const mm = /EPIRUS_CHAMPION_3P_META\s*=\s*(\{.*?\});/.exec(t);
  if (!cm) { rows.push({ f, err: '抠不出容器' }); continue; }
  let cont, meta;
  try { cont = JSON.parse(cm[1]); } catch (e) { rows.push({ f, err: '容器不是纯 JSON：' + e.message }); continue; }
  try { meta = mm ? JSON.parse(mm[1]) : {}; } catch (e) { meta = {}; }
  const a = Float64Array.from(cont.a || []);
  const h = createHash('sha1').update(Buffer.from(a.buffer)).digest('hex').slice(0, 10);
  rows.push({ f, h, n: a.length, v: cont.v, seed: meta.recipe && meta.recipe.seed,
    widthW: (meta.recipe && meta.recipe.env || {}).EPIRUS_WIDTH_W || '-',
    pis: meta.productIsSeed, firstRate: meta.firstRate });
}
const by = new Map();
for (const r of rows) { if (r.h) (by.get(r.h) || by.set(r.h, []).get(r.h)).push(r); }
console.log('目录 ' + DIR + ' ‖ 匹配 ' + String(RE) + ' ‖ 共 ' + rows.length + ' 枚产物\n');
for (const r of rows.filter((x) => x.err)) console.log('  ⚠ ' + r.f + '：' + r.err);
const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
let dups = 0;
for (const [h, g] of groups) {
  if (g.length > 1) dups += g.length - 1;
  console.log((g.length > 1 ? '★ 同一粒 ×' + g.length + ' ' : '  唯一        ') + h + ' ‖ '
    + g.map((r) => r.f + '(W' + r.widthW + ' seed' + r.seed + (r.pis === true ? ' =起点' : '') + ')').join(' ‖ '));
}
console.log('\n独立权重数 = ' + groups.length + ' ‖ 重复份数 = ' + dups
  + (dups ? '\n⇒ 引用"九臂/N 枚"之前要点名：表里的行数 ' + rows.length + ' 比实际独立粒数多 ' + dups : ''
  + '\n注：同哈希=权重逐位相同（浮点字节级）；同分不同哈希是"两粒各自算出同一个数"，那是另一件事。'));
