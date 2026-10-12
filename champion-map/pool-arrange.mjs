/* pool-arrange.mjs —— 按**行为分散度**搜池的带划分（§E598 用户裁定："不是纯靠 Hp，还可以看一下技能距离
 * （比如三维行为轴的分散度）尽量让一个池的行为松散一些"）。
 *
 * 口径：
 *   · 行为坐标 = `champion-map/coords.tsv` 的 `x3/y3/z3`（`proj-tsne.mjs` 对 10 维行为谱的 t-SNE 投影，
 *     与演化图 3db 视图同一份 ⇒ **图上看着散 = 这一带真的散**）。三轴先各自 z 化（轴间尺度不可比）。
 *   · 目标函数 = 每一带**平均两两欧氏距离**之和（越大越松散）；同时报出每一带的数值与"最紧的那一带"。
 *   · 硬约束：`--locked=<id:tier,...>` 点名的成员不许挪（用户裁定：现役 `T8-s114`、`K2`、`SHIPPED-Ldemo` 钉在困难带）；
 *     每一带人数 `--sizes=`（默认按现表人数），且契约要求带内人数 > AI 席数（4）⇒ 最小 5。
 *   · 算法：模拟退火 + 多次重启（每次随机交换两带各一枚，锁定的不参与）。
 *
 * 用法：
 *   node champion-map/pool-arrange.mjs [--sizes=9,7,11] [--locked=T8-s114:hard,K2:hard,SHIPPED-Ldemo:hard]
 *        [--iters=400000] [--restarts=40] [--top=3] [--out=<json>] [--dry]
 * 退出码：0 = 跑完 ‖ 2 = 输入不齐（点名的人不在表里 / 人数对不上 / 带名不认识）
 * 口径纪律：本工具只**提议**排布，落地前必须过在册阶梯尺（`probe-diff-ladder --pairs=1 --pool=1`）——
 *   分散度与强度是两件事，分散度高的排布可能把次序做倒（本班实测过，日志 §E598）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes('--' + k);
const BANDS = ['hard', 'mid', 'soft'];

const role = arg('sizes', '');
const LOCK = arg('locked', 'T8-s114:hard,K2:hard,SHIPPED-Ldemo:hard');
const ITERS = Number(arg('iters', 400000)), RESTARTS = Number(arg('restarts', 40)), TOP = Number(arg('top', 3));
/* `--strength=<tsv>`：逐枚强度先验（`tools/probe-pool.mjs --tier=all` 的在场效应行；**越高 = 对人类越软 = 越弱**）。
 * 给了它就变成**双目标**：在"预测强度按 硬≤中≤软 排好"的可行域里最大化行为分散度 ——
 * 因为纯分散度最优的排布会把强枚塞进软带（本班实测：`E3`/`R-s123`/`S-s120` 全被塞进 soft ⇒ 次序倒）。
 * ⚠ 先验只是**过滤器**，落地前一律过在册阶梯尺（`probe-diff-ladder --pairs=1 --pool=1`）。 */
const STR = arg('strength', '');
/* --margin=<pt>：预测强度的最小相邻间隔（默认 0 只要求单调 —— 实测**太松**：把强枚塞进软带、再用一堆中档填硬带，
 *   均值照样单调 ⇒ 要给"硬带真的比软带强"留出可测余量，一般给 2~4pt）。 */
const MARGIN = Number(arg('margin', 0));

/* ---- 数据 ---- */
const members = readFileSync(join(ROOT, 'champion-map', 'pool-members.tsv'), 'utf8').replace(/\r?\n$/, '').split('\n');
const mh = members[0].split('\t'), mi = mh.indexOf('id'), mt = mh.indexOf('tier');
const ids = members.slice(1).map(l => l.split('\t')[mi]);
const cur = Object.fromEntries(members.slice(1).map(l => { const c = l.split('\t'); return [c[mi], c[mt]]; }));
const co = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r?\n$/, '').split('\n');
const ch = co[0].split('\t'), ci = ch.indexOf('id'), cx = ch.indexOf('x3'), cy = ch.indexOf('y3'), cz = ch.indexOf('z3');
const raw = {};
for (const l of co.slice(1)) { const c = l.split('\t'); if (ids.includes(c[ci])) raw[c[ci]] = [Number(c[cx]), Number(c[cy]), Number(c[cz])]; }
const miss = ids.filter(id => !raw[id]);
if (miss.length) { console.error('⛔ 这些成员在 coords.tsv 里没有三维坐标：' + miss.join(' ')); process.exit(2); }
/* z 化（按三轴各自） */
const P = {};
for (let k = 0; k < 3; k++) {
  const v = ids.map(id => raw[id][k]), m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  ids.forEach((id, j) => { (P[id] = P[id] || [])[k] = (v[j] - m) / s; });
}

/* ---- 约束 ---- */
const hidden = LOCK ? LOCK.split(',').filter(Boolean).map(x => x.split(':')) : [];
for (const [id, t] of hidden) {
  if (!ids.includes(id)) { console.error('⛔ --locked 点名的 ' + id + ' 不在池表里'); process.exit(2); }
  if (!BANDS.includes(t)) { console.error('⛔ --locked 的带名只能是 ' + BANDS.join('|')); process.exit(2); }
}
const SIZES = role ? role.split(',').map(Number) : BANDS.map(b => ids.filter(id => cur[id] === b).length);
const total = SIZES.reduce((a, b) => a + b, 0);
if (total !== ids.length) { console.error('⛔ --sizes 合计 ' + total + ' ≠ 池成员 ' + ids.length + '（人数必须一模一样，多一枚少一枚都不许）'); process.exit(2); }
if (SIZES.some(n => n < 5)) { console.error('⛔ 每一带至少 5 枚（池契约：带内人数必须 > AI 席数 4，否则抽签产生不了阵容变化）'); process.exit(2); }
for (const [id, t] of hidden) { const need = BANDS.indexOf(t); if (SIZES[need] < 5) { console.error('⛔ 锁定带人数不足'); process.exit(2); } }

/* ---- 强度先验（可选）：id<TAB>数值（在场效应，越高越软） ---- */
let S = null;
if (STR) {
  S = {};
  for (const l of readFileSync(join(ROOT, STR), 'utf8').replace(/\r/g, '').trim().split('\n')) {
    const c = l.split('\t'); if (c.length < 2 || c[0] === 'id') continue;
    const v = Number(c[c.length - 1]); if (Number.isFinite(v) && ids.includes(c[0])) S[c[0]] = v;
  }
  const lack = ids.filter(id => S[id] === undefined);
  if (lack.length) { console.error('⛔ 强度先验里缺这些成员：' + lack.join(' ')); process.exit(2); }
}
const predOf = bands => BANDS.map(b => bands[b].reduce((a, id) => a + S[id], 0) / bands[b].length);
const feasible = bands => { if (!S) return true; const [h, m, s] = predOf(bands); return (m - h) >= MARGIN && (s - m) >= MARGIN; };

/* ---- 目标函数：每带平均两两距离（z 化空间）---- */
const free = ids.filter(id => !hidden.some(([h]) => h === id));
const lockOf = Object.fromEntries(hidden);
const dist = (a, b) => Math.sqrt((P[a][0] - P[b][0]) ** 2 + (P[a][1] - P[b][1]) ** 2 + (P[a][2] - P[b][2]) ** 2);
function evalBands(bands) {                       /* bands: {hard:[],mid:[],soft:[]} → {sum,min,per} */
  const per = {};
  for (const b of BANDS) {
    const a = bands[b]; if (a.length < 2) { per[b] = 0; continue; }
    let s = 0, n = 0;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { s += dist(a[i], a[j]); n++; }
    per[b] = s / n;
  }
  const vals = BANDS.map(b => per[b]);
  return { sum: vals.reduce((x, y) => x + y, 0), min: Math.min(...vals), per };
}
const mkBands = assign => { const o = { hard: [], mid: [], soft: [] }; for (const id of ids) o[assign[id]].push(id); return o; };
/* 联合目标：分散度 − 强度可行域惩罚（给了先验时，次序做倒 = −100，绝不采纳） */
const scoreOf = bands => evalBands(bands).sum - (feasible(bands) ? 0 : 100);

/* ---- 起点：现表（锁定的照锁定；若现表违反锁定则按锁定重建）---- */
let base = { ...cur };
for (const [id, t] of hidden) base[id] = t;
/* 现表人数与 --sizes 不一致时，用随机可行解起步 */
function randFeasible(rand) {
  const a = {};
  for (const [id, t] of hidden) a[id] = t;
  const rest = free.slice();
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const room = {}; BANDS.forEach((b, k) => { room[b] = SIZES[k] - Object.values(a).filter(x => x === b).length; });
  let p = 0;
  for (const b of BANDS) while (room[b]-- > 0) a[rest[p++]] = b;
  return a;
}
const sizesOk = b => BANDS.every((x, k) => b[x].length === SIZES[k]);
let cur0 = { ...base };
if (!sizesOk(mkBands(cur0))) cur0 = null;

/* ---- 模拟退火 ---- */
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const found = [];
for (let r = 0; r < RESTARTS; r++) {
  const rand = mulberry(1000 + r * 7919);
  let a = r === 0 && cur0 ? { ...cur0 } : randFeasible(rand);
  let sc = scoreOf(mkBands(a));
  const pairs = [];
  for (const x of BANDS) for (const y of BANDS) { if (x < y) pairs.push([x, y]); }
  for (let it = 0; it < ITERS / RESTARTS; it++) {
    const [x, y] = pairs[Math.floor(rand() * pairs.length)];
    const A = free.filter(id => a[id] === x), B = free.filter(id => a[id] === y);
    if (!A.length || !B.length) continue;
    const ia = A[Math.floor(rand() * A.length)], ib = B[Math.floor(rand() * B.length)];
    a[ia] = y; a[ib] = x;
    const sc2 = scoreOf(mkBands(a));
    const T = 0.02 * (1 - it / (ITERS / RESTARTS)) + 0.001;
    if (sc2 >= sc || rand() < Math.exp((sc2 - sc) / T)) sc = sc2;
    else { a[ia] = x; a[ib] = y; }
  }
  const bands = mkBands(a), e = evalBands(bands);
  found.push({ assign: a, ...e, feasible: feasible(bands), pred: S ? predOf(bands) : null });
}
found.sort((p, q) => scoreOf(mkBands(q.assign)) - scoreOf(mkBands(p.assign)));
/* 去重（按三带的成员集合） */
const seen = new Set(), top = [];
for (const f of found) {
  const key = BANDS.map(b => mkBands(f.assign)[b].slice().sort().join(',')).join('|');
  if (seen.has(key)) continue; seen.add(key); top.push(f);
  if (top.length >= TOP) break;
}

/* ---- 报告 ---- */
const show = f => BANDS.map(b => b + '(' + mkBands(f.assign)[b].length + ')=[' + mkBands(f.assign)[b].join(' ') + ']').join('\n    ');
console.log('行为坐标：coords.tsv x3/y3/z3（z 化）‖ 目标 = 每带平均两两距离之和（越大越松散）‖ 锁定：' + hidden.map(([i, t]) => i + '→' + t).join(' '));
console.log('现表：和=' + evalBands(mkBands(cur)).sum.toFixed(3) + ' 最紧带=' + Math.min(...BANDS.map(b => evalBands(mkBands(cur)).per[b])).toFixed(3)
  + ' 逐带 ' + BANDS.map(b => b + '=' + evalBands(mkBands(cur)).per[b].toFixed(3)).join(' '));
top.forEach((f, i) => {
  console.log('\n候选 ' + (i + 1) + '：和=' + f.sum.toFixed(3) + ' 最紧带=' + f.min.toFixed(3)
    + ' 逐带 ' + BANDS.map(b => b + '=' + f.per[b].toFixed(3)).join(' ')
    + (S ? (' ‖ 预测强度 ' + BANDS.map((b, k) => b + '=' + f.pred[k].toFixed(2)).join(' ')
        + (f.feasible ? ' ✓次序(间隔 ' + (f.pred[1] - f.pred[0]).toFixed(2) + '/' + (f.pred[2] - f.pred[1]).toFixed(2) + ')' : ' ⛔次序倒')) : ''));
  console.log('    ' + show(f));
});
if (has('dry')) process.exit(0);
const out = arg('out', '');
if (out) {
  const payload = { madeAt: new Date().toISOString(), dims: 'coords.tsv x3/y3/z3 (z-scored)', locked: hidden, sizes: SIZES, current: evalBands(mkBands(cur)),
    top: top.map(f => ({ sum: +f.sum.toFixed(4), min: +f.min.toFixed(4), per: f.per, bands: mkBands(f.assign) })) };
  writeFileSync(join(ROOT, out), JSON.stringify(payload, null, 1) + '\n');
  console.log('\n已写 ' + out + '（只提议，落地前必须过在册阶梯尺）');
}
