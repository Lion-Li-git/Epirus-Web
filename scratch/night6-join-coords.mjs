#!/usr/bin/env node
/* night6-join-coords.mjs v2 —— 把精选 2.0 点并进旧演化图的数据管线（ZCode · 11-05 凌晨）
 *
 * ⚑ 病根（为什么直接喂 coords-gen3-1103.tsv 会"啥也显示不出来"）：联合文件是**短 schema**（没有 Hp 列），
 *   viewer 的 `Hp: +r.Hp` 对缺列 = NaN ⇒ Fv 全 NaN ⇒ 一维排序/颜色/点大小全废。
 * 本件产出的 coords-gen3-1105.tsv：
 *   ① 旧池行 = coords.tsv **全列**（Hp/De/okLong/... 都在），x2/y2/x3/y3/z3 用联合投影覆盖（同 id 对齐）
 *   ② 代 3 行（臂/段，仅在联合文件里）= 联合行原样 + **Hp=H 兜底**（同一把 120 局考卷 ⇒ 数值合法）
 *   ③ 新 21 行（精选 2.0）= ruler-g3 的 12 维 + Hp=夜班 200 局读数（**位置由整表重投影给，不再 kNN 借**）
 *   ④ rank 全表重算（Fv = Hp/100 + 0.1·S）——viewer 点大小 = f(rank)，空 rank = NaN = 点不可见
 * 输出列 = coords.tsv 全列 + ver；**xt/yt/xt3/yt3/zt3 一律留空**，由下一步 proj-tsne --in 填。
 * ⚠ 11-05 上午的病（本件曾经把 x2/y2 抄进 xt/yt）：viewer 画的是 xt/yt ⇒ 抄进去之后 864/864 行两列逐字相同，
 *   范围从 ±1.0 变成 −19.2…8.2 ⇒ 图上"团成一块 + 两个点飞出去"。判据留在 `viewer.mjs` 的投影守卫里。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIMS = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk'];
const tsv = (f) => { const L = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean); const h = L[0].split('\t'); return { h, rows: L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }) }; };

const old = tsv('champion-map/coords.tsv');                 // 825 行全列
const joint = tsv('champion-map/coords-gen3-1103.tsv');     // 927 行联合投影（短 schema）
const jMap = new Map(joint.rows.map(r => [r.id, r]));

/* Hp 来源（夜班 200 局大考 + 根补测） */
const HP = new Map();
for (const f of ['strength-long.tsv', 'strength-long-ext.tsv', 'strength-long-fix.tsv', 'strength-long-roots.tsv']) {
  const p = 'scratch/night6/' + f;
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean).slice(1)) {
    const c = l.split('\t');
    if (c[2] && c[2] !== 'NA' && Number(c[1]) === 200) HP.set(c[0].replace(/^root:/, '').replace(/^CLONE-D4a$/, 'D4a').replace(/^D-a-s41-base$/, 'D-a底座'), Number(c[2]));
  }
}

/* （11-05 上午）原来这里的 z-score + `knn()`（k=7 逆距离加权借邻域位置）**整段删除**：
 *   它存在的前提是"投影只算过一次、新点没有自己的投影"。现在并集整体过 `proj-tsne --in` 一次 ⇒ 每个点都是真投影，不借。 */

/* ---- 组装 ---- */
const g3ruler = tsv('scratch/night6/ruler-g3.tsv');
const g3Map = new Map(g3ruler.rows.map(r => [r.id, r]));
const outHead = old.h.slice();
for (const extra of ['xt', 'yt', 'xt3', 'yt3', 'zt3', 'ver']) if (outHead.indexOf(extra) < 0) outHead.push(extra);
const out = [];

for (const o of old.rows) {                                     /* ① 旧池行：全列 + 联合投影覆盖 */
  const r = Object.assign({}, o);
  const j = jMap.get(o.id);
  /* ⛔ 11-05 上午（千问）修掉的病：这里原来写 `r.xt = r.x2; r.yt = r.y2`（连同上一行联合行的同款赋值）
   *   ⇒ **投影列 xt/yt 被填成了未投影的主坐标 x2/y2**，viewer 真画的正是 xt/yt ⇒ 864/864 行 xt 逐字等于 x2，
   *      范围从 t-SNE 的 ±1.0 变成 −19.2…8.2 ⇒ 两枚离群点把视口撑开，其余 89% 团成一块（用户看到的形态）。
   *   现在：本件**不再产出投影列**，xt/yt 一律留空，由 `node champion-map/proj-tsne.mjs --in=coords-gen3-1105.tsv`
   *   对**整张并集**重投影一次 ⇒ 一张图只许有一套 fit（旧点、代 3 臂、新 21 点同一坐标系，也不用再 kNN 借位置）。 */
  if (j) { r.x2 = j.x2; r.y2 = j.y2; r.x3 = j.x3; r.y3 = j.y3; r.z3 = j.z3; }
  r.ver = '1.8';
  r.xt = ''; r.yt = ''; r.xt3 = ''; r.yt3 = ''; r.zt3 = '';
  out.push(outHead.map(h => r[h] === undefined ? '' : r[h]).join('\t'));
}
const seen = new Set(old.rows.map(r => r.id));
let nNew = 0, nEra = 0, nSeg = 0;
for (const j of joint.rows) {                                   /* ② 代 3 行（臂/段）：Hp=H 兜底 */
  if (seen.has(j.id)) continue;
  /* §G3 用户令"点不需要很多"：114 个段快照不进图（gen3-map.html 是它们的家）；早期实验臂 19 枚保留 */
  if (/__seg\d+$/.test(j.id)) { nSeg++; continue; }
  const r = Object.assign({}, j);
  if (!(Number(r.H) > 0)) r.H = ''; r.Hp = r.H || '';
  r.ver = '2.0'; r.xt = ''; r.yt = ''; r.xt3 = ''; r.yt3 = ''; r.zt3 = '';   /* 投影交给 proj-tsne --in 一次算全（见 ① 那条注释） */
  out.push(outHead.map(h => r[h] === undefined ? '' : r[h]).join('\t'));
  seen.add(j.id); nEra++;
}
for (const [id, n] of g3Map) {                                  /* ③ 新 21 行 */
  if (seen.has(id)) continue;
  /* 新点不再"借邻域位置"（kNN 插值本来就是**因为投影只算过一次**才需要的补丁）：
   *   它们自带 12 维特征 ⇒ 直接进同一次 t-SNE，得到自己的投影。x2/y2 也留空（那是旧管线的线性主坐标，2.0 点没有）。 */
  const row = {}; outHead.forEach(h => row[h] = '');
  row.id = id; row.S = n.S; row.Geff = n.Geff;
  for (const d of DIMS) row[d] = n[d] || '';
  row.Hp = HP.has(id) ? HP.get(id) : ''; row.ver = '2.0';
  out.push(outHead.map(h => row[h] === undefined ? '' : row[h]).join('\t'));
  nNew++;
  console.log('  ' + id + ' ‖ Hp=' + row.Hp + ' ‖ 12 维齐=' + DIMS.every(d => Number.isFinite(Number(n[d])) ? '✔' : '✗'));
}

/* ---- 名次全表重算 ---- */
const all = [outHead.join('\t')].concat(out);
const iRk = outHead.indexOf('rank'), iHp = outHead.indexOf('Hp'), iS = outHead.indexOf('S');
const fv = out.map(l => { const c = l.split('\t'); return (Number(c[iHp]) || 0) / 100 + 0.1 * (Number(c[iS]) || 0); });
const order = fv.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
const rank = new Array(fv.length); order.forEach(([v, i], k) => rank[i] = k + 1);
const final = all.map((l, i) => { if (i === 0 || iRk < 0) return l; const c = l.split('\t'); c[iRk] = String(rank[i - 1]); return c.join('\t'); });
writeFileSync('champion-map/coords-gen3-1105.tsv', final.join('\n') + '\n');
console.log('⇒ coords-gen3-1105.tsv：旧池 ' + old.rows.length + ' + 代3臂 ' + nEra + '（段剔除 ' + nSeg + '）+ 新 ' + nNew + ' = ' + out.length + ' 行 ‖ rank 全表重算 ‖ **xt/yt 留空**');
console.log('  下一步（必做，否则图上没有投影列）：node champion-map/proj-tsne.mjs --in=coords-gen3-1105.tsv');
