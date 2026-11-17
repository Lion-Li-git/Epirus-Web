/* migrate-drop-family-from-sidecar.mjs —— 一次性迁移（11-17 已执行完毕；再跑是安全的 no-op）
 *
 * 做什么：从 `champion-map/data/page/lineage-g3.tsv` 删掉 `fam` / `famLabel` 两列。
 * 为什么：同一个家族号曾存三处（registry ‖ sidecar ‖ 生成物 lineage.tsv），11-17 13:59 那次
 *   "以 registry 为真源回写"把 registry 里 4 枚 MSB15 的**空值**盖掉了 sidecar 里的真值 ⇒ `D234 ⑫` 红在 CI。
 *   修法是"只留一处"：家族号从此只在 `data/registry.tsv`；sidecar 只存血统。
 *
 * 前置断言（不成立就拒绝动手）：sidecar 每一行的 fam/famLabel 必须与 registry **逐字相同** ——
 *   只有"要删的两列不带任何额外信息"时这次迁移才是等值的。11-17 实测：可比对 164 枚全同、不同 0；
 *   sidecar 里 10 枚无 registry 行的孤行（8 枚 `wid:` 父边占位 + OB3S-C2-s7 + MSB15-soupb-R1S190353054）
 *   既不在 display 也不在 lineage.tsv ⇒ 删列不丢任何上图信息。
 * 等值性怎么验（不是我看着没坏）：迁移后重跑 `node champion-map/lineage.mjs` 与 `node champion-map/rebuild-map.mjs`，
 *   `lineage.tsv`(990 行) ‖ `index.html`(2,629,952 字节) ‖ `trends.html` 三个产物**逐位不变**。
 *
 * 配套的五组反向验牙（在一次性 worktree 里做，别在主工作树上；每次跑完必须还原并核对 `git status` 干净）：
 *   1 registry 某枚 fam 清空            → ⑫e 红并点名该枚（"fam 为空的 1 枚"）
 *   2 registry 删掉某枚整行 + 先 rebuild-map 重烘 → ⑫e 红（"没有行的 1 枚"）
 *      ⚠ 不重烘就会被同一条腿里更靠前的 ⑩c（页面必须等于烘焙输出）先抓走 ⇒ "红了"不等于"我以为的那格红了"；
 *        重烘必须走 rebuild-map 全链（裸跑 viewer.mjs 不算：worktree 里没有 gitignore 掉的 data/build/）
 *   3 两张谱系表都删掉该枚父边行 + 重烘  → ⑫ 覆盖格红（"谱系表覆盖 988 枚；缺 1 枚"）⇒ 换数据源没削钝老格子
 *   4 手改 lineage.tsv 的 fam           → ⑫f 红（生成物与 registry 不一致）
 *   5 把 fam/famLabel 塞回 sidecar 表头 → viewer 拒烘、add-point exit 2
 *
 * 用法：node champion-map/pipeline/migrate-drop-family-from-sidecar.mjs [--apply]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTable, writeTable } from '../map-table.mjs';

const ROOT = join(import.meta.dirname, '../..');
const G3 = join(ROOT, 'champion-map/data/page/lineage-g3.tsv');
const REG = join(ROOT, 'champion-map/data/registry.tsv');
const APPLY = process.argv.includes('--apply');

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));

const R = rd(REG), rh = R[0];
const ri = rh.indexOf('pack_id'), rf = rh.indexOf('fam'), rl = rh.indexOf('fam_label');
if (ri < 0 || rf < 0 || rl < 0) { console.error('⛔ registry 缺 pack_id/fam/fam_label 列'); process.exit(2); }
const reg = new Map();
for (const c of R.slice(1)) if (c[ri]) reg.set(c[ri], { fam: c[rf] === undefined ? '' : c[rf], lab: c[rl] === undefined ? '' : c[rl] });

const G = rd(G3), gh = G[0];
const gi = gh.indexOf('id'), gf = gh.indexOf('fam'), gl = gh.indexOf('famLabel');
if (gi < 0) { console.error('⛔ sidecar 没有 id 列'); process.exit(2); }
if (gf < 0 && gl < 0) { console.log('已经迁过：sidecar 表头没有 fam/famLabel（现有 ' + gh.length + ' 列：' + gh.join(',') + '）'); process.exit(0); }
if (gf < 0 || gl < 0) { console.error('⛔ sidecar 只缺 fam 或 famLabel 之一，形状非预期，拒绝自动处理：' + gh.join(',')); process.exit(2); }

let cmp = 0, same = 0, diff = [], orphan = [];
for (const c of G.slice(1)) {
  const id = c[gi]; if (!id) continue;
  const r = reg.get(id);
  if (!r) { orphan.push(id); continue; }
  cmp++;
  if (String(c[gf]) === String(r.fam) && c[gl] === r.lab) same++;
  else diff.push(id + '  sidecar=' + c[gf] + '/' + c[gl] + '  registry=' + r.fam + '/' + r.lab);
}
console.log('可比对 ' + cmp + ' 枚 ‖ 与 registry 逐字相同 ' + same + ' ‖ 不同 ' + diff.length + ' ‖ 无 registry 行的孤行 ' + orphan.length + ' 枚');
if (diff.length) { console.log('  不同的前 6 枚：'); diff.slice(0, 6).forEach((x) => console.log('   ' + x)); }
console.log('  孤行：' + orphan.slice(0, 12).join(' ‖ '));
if (diff.length) { console.error('⛔ 两源不一致，删列会丢信息 —— 先把 registry 补对再迁移'); process.exit(2); }

const keep = gh.map((h, i) => [h, i]).filter(([h]) => h !== 'fam' && h !== 'famLabel');
const rows = G.slice(1).map((c) => keep.map(([, i]) => (c[i] === undefined ? '' : c[i])));
console.log((APPLY ? '落盘：' : '--dry：') + gh.length + ' 列 → ' + keep.length + ' 列 ‖ ' + rows.length + ' 行不变');
if (!APPLY) { console.log('（加 --apply 才真写；写完请跑 lineage.mjs + rebuild-map 并核对三个产物逐位不变）'); process.exit(0); }
writeTable(G3, { header: keep.map(([h]) => h), rows }, { backup: false });
console.log('✅ 已写 ' + G3 + ' ‖ 新表头：' + keep.map(([h]) => h).join(','));
