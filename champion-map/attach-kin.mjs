/* attach-kin.mjs —— §E328：把"这批新点是谁"标清楚，并且**不许它们冒充冠军**。
 *
 * 背景（用户 10-05 20:2x）：「至少把现役的进化链相关的冠军以及同族其他有数据的冠军放到演化图里，
 *   并且现役好像有后续的一些训练结果只不过都不如现役所以没上」⇒ `chain-scan.mjs` 量出 **192 支臂**是以现役为种子续训的，
 *   其中 183 支的臂产品**从没进过面板**。`ruler-figs.mjs` 把它们的点画出来了，但 `lineage` 那一列被我填成了 '续训现役'，
 *   而**这一列在图上和查看器里都是"当过线上冠军"的意思**（`eps-full`/`eps-scan` 拿它当历代冠军名单的唯一来源，
 *   `e287-figs` 打印的"历代上槽冠军 198 枚"就是把这 183 枚算进去了 —— 那是**假的 198**，真的只有 15 枚 + 现役）。
 *
 * 所以这一步做三件事，且只这三件：
 *   ① 把这 183 枚的 `lineage` 清成空，另开一列 `kin` 标它们跟现役的关系（`续训现役` / `父链`）；
 *   ② 把改动前那份 `coords.tsv` 里的 `Sc/Scd/Scs/Sch` **按 id 原样搬过来**（当选键那四列是 §E321 花 24 万局量的，
 *      重跑 `attach-sc` 要再花两小时，而且那批新点本来**没量过** ⇒ 留空，查看器按"未测"压暗，不许当 0）；
 *   ③ 收尾打印守卫：冠军枚数必须回到 15+1，`kin` 非空枚数必须等于名单数。
 *
 * 用法：node champion-map/attach-kin.mjs --from=<改动前的 coords.tsv> --list=<_e328-extra.tsv> [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const FROM = arg('from', ''), LIST = arg('list', '_e328-extra.tsv');
if (!FROM) { console.error('⛔ 必须给 --from=<改动前的 coords.tsv>：没有它就无法把 Sc 四列原样搬回来'); process.exit(2); }

const read = p => readFileSync(p, 'utf8').trim().split('\n').map(l => l.split('\t'));
const CO = read(join(HERE, 'coords.tsv')), H0 = CO[0], ROWS = CO.slice(1);
const OLD = read(join(HERE, FROM)), OH = OLD[0], OR = OLD.slice(1);
const idx = h => { const o = {}; h.forEach((k, i) => { o[k] = i; }); return o; };
const ch = idx(H0), oh = idx(OH);
for (const need of ['id', 'lineage', 'H', 'S']) if (ch[need] === undefined || oh[need] === undefined) {
  console.error('⛔ 两份表都必须有 ' + need + ' 列（一份表头缺了它 ⇒ 我拒绝猜列位）'); process.exit(2); }

/* 名单：id -> kin 标签。`E51-t8-713` 是父链（`chain-scan.mjs` 往上走那一步的产物），其余是子代。 */
const LT = read(join(HERE, LIST)), lh = idx(LT[0]);
if (lh.arm === undefined) { console.error('⛔ --list 要有 arm 列（表头：' + LT[0].join('\t') + '）'); process.exit(2); }
const KIN = {};
for (const r of LT.slice(1)) { if (!r[lh.arm]) continue; KIN[r[lh.arm]] = r[lh.arm] === 'E51-t8-713' ? '父链' : '续训现役'; }

const OLDROW = {}; for (const r of OR) OLDROW[r[oh.id]] = r;
const SC = ['Sc', 'Scd', 'Scs', 'Sch'];
const hasSc = SC.every(k => oh[k] !== undefined);
if (!hasSc) console.warn('⚠ 旧表里没有 Sc 四列 ⇒ 这一版只清 lineage、不搬当选键读数');

/* 表头 = 现表的列 + （若新表没带当选键四列则补上）+ `kin`。**只往尾部加列**，已有列的位置一个都不动。 */
const NEED_SC = hasSc && ch.Sc === undefined;
const OUT_H = H0.concat(NEED_SC ? SC : []).concat(['kin']);
const ROWLEN = OUT_H.length;
const out = [OUT_H.join('\t')];
let cleared = 0, carried = 0, keptChamp = 0;
for (const r of ROWS) {
  const id = r[ch.id];
  const row = r.slice();
  while (row.length < H0.length) row.push('');
  const kin = KIN[id] || '';
  if (kin) { if (row[ch.lineage]) cleared++; row[ch.lineage] = ''; }
  else if (row[ch.lineage]) keptChamp++;
  /* Sc 四列：新表（ruler-figs 重画时不带这四列）以旧表为准，量过的原样搬，没量过的**留空**（不许当 0） */
  if (NEED_SC) for (const k of SC) row.push(OLDROW[id] ? (OLDROW[id][oh[k]] || '') : '');
  if (OLDROW[id]) carried++;
  row.length = ROWLEN - 1;                       // 硬截到"加 kin 之前"的长度，多一列少一列都不会错位
  if (row.length < ROWLEN - 1) while (row.length < ROWLEN - 1) row.push('');
  out.push(row.concat([kin]).join('\t'));
}

/* 上面那段"ch.Sc === undefined 时才补列"的分支是有前提的：新表若已经带 Sc 列（说明这一步跑在 attach-sc 之后），就不该再补。
 *   两种情况都要能跑，但**必须只有一种成立** ⇒ 这里显式判一下，别让列重复出来。 */
const dupSc = OUT_H.filter(x => x === 'Sc').length;
if (dupSc > 1) { console.error('⛔ 表头里出现两列 Sc ⇒ 这一步与新表的列序不匹配，别写文件'); process.exit(2); }

if (process.argv.includes('--check')) {
  console.log('--check：会写 ' + out.length + ' 行；清掉假冠军 ' + cleared + ' ‖ 保留真冠军 ' + keptChamp + ' ‖ 搬 Sc 四列 ' + carried + ' 枚');
  process.exit(0);
}
writeFileSync(join(HERE, 'coords.tsv'), out.join('\n') + '\n');
const CH = read(join(HERE, 'coords.tsv'));
const chh = idx(CH[0]);
const nChamp = CH.slice(1).filter(r => r[chh.lineage]).length, nKin = CH.slice(1).filter(r => r[chh.kin]).length;
console.log('已写 coords.tsv：' + (CH.length - 1) + ' 枚 ‖ lineage 非空（真冠军）' + nChamp + ' ‖ kin 非空 ' + nKin);
if (nChamp > 20) { console.error('⛔ 冠军枚数 ' + nChamp + ' 明显不对 ⇒ ' + LIST + ' 那批没被清掉？'); process.exit(2); }
if (nKin !== Object.keys(KIN).length) console.warn('⚠ kin 非空 ' + nKin + ' ‖ 名单 ' + Object.keys(KIN).length + ' —— 差的那几枚在面板里没有行');
