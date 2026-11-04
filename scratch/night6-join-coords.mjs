#!/usr/bin/env node
/* night6-join-coords.mjs v2 —— 把精选 2.0 点并进旧演化图的数据管线（ZCode · 11-05 凌晨）
 *
 * ⚑ 病根（为什么直接喂 coords-gen3-1103.tsv 会"啥也显示不出来"）：联合文件是**短 schema**（没有 Hp 列），
 *   viewer 的 `Hp: +r.Hp` 对缺列 = NaN ⇒ Fv 全 NaN ⇒ 一维排序/颜色/点大小全废。
 * 本件产出的 coords-gen3-1105.tsv：
 *   ① 旧池行 = coords.tsv **全列**（Hp/De/okLong/... 都在），x2/y2/x3/y3/z3 用联合投影覆盖（同 id 对齐）
 *   ② 代 3 行（臂/段，仅在联合文件里）= 联合行原样 + **Hp=H 兜底**（同一把 120 局考卷 ⇒ 数值合法）
 *   ③ 新 21 行（精选 2.0）= ruler-g3 的 12 维 + Hp=夜班 200 局读数 + **kNN 投影**（k=7 逆距离加权，
 *      12 维 z-score 按参照集统计——邻域保真，绝对位置压缩，页面口径注明）
 *   ④ rank 全表重算（Fv = Hp/100 + 0.1·S）——viewer 点大小 = f(rank)，空 rank = NaN = 点不可见
 * 输出列 = coords.tsv 全列 ∪ 联合文件的 xt/yt/xt3/yt3/zt3（viewer 的 PROJTSNE 开关用）
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

/* z-score 统计取联合文件全体行（新点必须进同一坐标系） */
const mu = {}, sd = {};
for (const d of DIMS) {
  const col = joint.rows.map(r => Number(r[d])).filter(Number.isFinite);
  const m = col.reduce((s, x) => s + x, 0) / col.length;
  mu[d] = m; sd[d] = Math.sqrt(col.reduce((s, x) => s + (x - m) ** 2, 0) / col.length) || 1;
}
const zv = (o) => DIMS.map(d => { const v = Number(o[d]); return Number.isFinite(v) ? (v - mu[d]) / sd[d] : 0; });

function knn(n) {
  const zn = zv(n);
  const scored = joint.rows.map(r => {
    const zr = zv(r); let d2 = 0;
    for (let i = 0; i < DIMS.length; i++) { const e = zn[i] - zr[i]; d2 += e * e; }
    return { id: r.id, d: Math.sqrt(d2), x2: +r.x2, y2: +r.y2, x3: +r.x3, y3: +r.y3, z3: +r.z3 };
  }).sort((a, b) => a.d - b.d).slice(0, 7);
  let w = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, z3 = 0;
  for (const nn of scored) { const k = 1 / (nn.d + 1e-6); w += k; x2 += k * nn.x2; y2 += k * nn.y2; x3 += k * nn.x3; y3 += k * nn.y3; z3 += k * nn.z3; }
  return { x2: x2 / w, y2: y2 / w, x3: x3 / w, y3: y3 / w, z3: z3 / w, nn: scored };
}

/* ---- 组装 ---- */
const g3ruler = tsv('scratch/night6/ruler-g3.tsv');
const g3Map = new Map(g3ruler.rows.map(r => [r.id, r]));
const outHead = old.h.slice();
for (const extra of ['xt', 'yt', 'xt3', 'yt3', 'zt3', 'ver']) if (outHead.indexOf(extra) < 0) outHead.push(extra);
const out = [];

for (const o of old.rows) {                                     /* ① 旧池行：全列 + 联合投影覆盖 */
  const r = Object.assign({}, o);
  const j = jMap.get(o.id);
  if (j) { r.x2 = j.x2; r.y2 = j.y2; r.x3 = j.x3; r.y3 = j.y3; r.z3 = j.z3; r.xt = j.x2; r.yt = j.y2; r.xt3 = j.x3; r.yt3 = j.y3; r.zt3 = j.z3; }
  r.ver = '1.8';
  r.xt = r.x2; r.yt = r.y2; r.xt3 = r.x3; r.yt3 = r.y3; r.zt3 = r.z3;   /* 无联合行的旧点：投影=原坐标（不挪） */
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
  r.ver = '2.0'; r.xt = r.x2; r.yt = r.y2; r.xt3 = r.x3; r.yt3 = r.y3; r.zt3 = r.z3;
  out.push(outHead.map(h => r[h] === undefined ? '' : r[h]).join('\t'));
  seen.add(j.id); nEra++;
}
for (const [id, n] of g3Map) {                                  /* ③ 新 21 行 */
  if (seen.has(id)) continue;
  const pr = knn(n);
  const row = {}; outHead.forEach(h => row[h] = '');
  row.id = id; row.S = n.S; row.Geff = n.Geff;
  row.x2 = pr.x2.toFixed(5); row.y2 = pr.y2.toFixed(5); row.x3 = pr.x3.toFixed(5); row.y3 = pr.y3.toFixed(5); row.z3 = pr.z3.toFixed(5);
  row.xt = row.x2; row.yt = row.y2; row.xt3 = row.x3; row.yt3 = row.y3; row.zt3 = row.z3;
  for (const d of DIMS) row[d] = n[d] || '';
  row.Hp = HP.has(id) ? HP.get(id) : ''; row.ver = '2.0';
  out.push(outHead.map(h => row[h] === undefined ? '' : row[h]).join('\t'));
  nNew++;
  console.log('  ' + id + ' ‖ Hp=' + row.Hp + ' ‖ 邻域=' + pr.nn.slice(0, 3).map(s => s.id + '(' + s.d.toFixed(2) + ')').join(','));
}

/* ---- 名次全表重算 ---- */
const all = [outHead.join('\t')].concat(out);
const iRk = outHead.indexOf('rank'), iHp = outHead.indexOf('Hp'), iS = outHead.indexOf('S');
const fv = out.map(l => { const c = l.split('\t'); return (Number(c[iHp]) || 0) / 100 + 0.1 * (Number(c[iS]) || 0); });
const order = fv.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
const rank = new Array(fv.length); order.forEach(([v, i], k) => rank[i] = k + 1);
const final = all.map((l, i) => { if (i === 0 || iRk < 0) return l; const c = l.split('\t'); c[iRk] = String(rank[i - 1]); return c.join('\t'); });
writeFileSync('champion-map/coords-gen3-1105.tsv', final.join('\n') + '\n');
console.log('⇒ coords-gen3-1105.tsv：旧池 ' + old.rows.length + ' + 代3臂 ' + nEra + '（段剔除 ' + nSeg + '）+ 新 ' + nNew + ' = ' + out.length + ' 行 ‖ rank 全表重算');
