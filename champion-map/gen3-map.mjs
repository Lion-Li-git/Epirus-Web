#!/usr/bin/env node
/* gen3-map.mjs —— 把 2.0 的冠军放进**旧池那张行为图**里看（qoder · 11-03 · 用户裁的做法）
 *
 * 用户原话（11-03 傍晚）：「把旧演化图拷一个副本出来，把这些新冠军放进去，看这些冠军的分布（以及演化，
 *   同一训练不同代数节点用线连上）在旧池里大概是什么类型。作为对照可以只复制二维和三维两个图，
 *   然后把旧池子点半透明。」并附一条对我不利的观察：「旧的演化图其实并没有很明显的两个盆，
 *   强簇就是 K2 集中且比较远，ldemo 附近强的比较多，中间有一团比较弱，而不是很极端分布。」
 *
 * 这张页同时回答两件事，且**把口径分开**：
 *   ① 新点在旧池的行为邻域里像谁（每条臂末代的 12 维最近邻表）；
 *   ② §十五 说的"两个盆"是**训练可达性**上的盆，还是**行为空间**里的盆 —— 用户在旧图上读的是后者。
 *      ⇒ 给一个可判的数：新点 k-means(k=2) 的轮廓系数 + **两群之间"谷"里坐着多少枚旧池点**。
 *        谷里旧点多 ⇒ 行为空间连通，"盆"只成立于训练那边（这两句不许混着说）。
 *
 * 坐标口径：与旧图**同一把尺**（`ruler-measure` 现测 12 维行为探针 ‖ 考卷 120 局/组合 · seed 77000 · 自对局 40 · 座位 100 · 探针 40）
 *   + 同一个 `proj-tsne`（perp 30 · iters 500 · seed 7）在**旧池 + 新点一起**重拟合 ⇒ 旧点位置会变
 *   （t-SNE 没有"只投新点"的用法；硬塞进旧布局正是 10-08 DS 判过的病）⇒ 可比的是**邻域**，不是绝对坐标。
 *
 * 用法：node champion-map/gen3-map.mjs [--fit=champion-map/coords.tsv] [--published=champion-map/coords-published-1103.tsv]
 *                                     [--g3=scratch/seg-widths-92.tsv,scratch/seg-widths-7.tsv] [--out=champion-map/gen3-map.html]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const known = ['fit', 'published', 'nodes', 'out'];
const badArgs = process.argv.slice(2).filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (badArgs.length) { console.error('⛔ 不认识的旗标：' + badArgs.join(' ') + '（可用 ' + known.join('/') + '）'); process.exit(64); }
/* 默认吃**联合拟合的那份副本**（主树的 coords.tsv 一字未动 ⇒ 线上那张图与它的账都不受影响） */
const FIT = arg('fit', 'champion-map/coords-gen3-1103.tsv');
const PUB = arg('published', 'champion-map/coords.tsv');   /* 主树这份就是已发布面板（Hp / F / 身份的来源） */
const NODES = arg('nodes', 'champion-map/g3-nodes-1103.tsv');
const OUT = arg('out', 'champion-map/gen3-map.html');
const pathOf = (p) => (p.indexOf('/') < 0 ? join(HERE, p) : join(ROOT, p));
const rd = (p) => { const f = pathOf(p); if (!existsSync(f)) { console.error('⛔ 读不到 ' + f); process.exit(2); } return readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); };
const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk'];
const num = (v) => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? n : NaN; };

/* 1) 联合拟合后的坐标表 */
const lines = rd(FIT).trim().split('\n');
const head = lines[0].split('\t');
const col = (n) => head.indexOf(n);
['id', 'xt', 'yt', 'xt3', 'yt3', 'zt3'].concat(FEAT).forEach((c) => {
  if (col(c) < 0) { console.error('⛔ ' + FIT + ' 缺列 ' + c + ' ⇒ 投影或行为列没跑'); process.exit(2); }
});
const rows = lines.slice(1).map((l) => { const c = l.split('\t'); const o = {}; head.forEach((k, i) => { o[k] = c[i]; }); return o; });

/* 2) 已发布面板（旧池的 Hp / F / 身份）——新点天生没有 Hp（§E491 那条病），所以只给旧池上势色 */
const pub = new Map();
{ const pl = rd(PUB).trim().split('\n'); const ph = pl[0].split('\t');
  for (const l of pl.slice(1)) { const c = l.split('\t'); const o = {}; ph.forEach((k, i) => { o[k] = c[i]; }); pub.set(o.id, o); } }

/* 3) 新点的谱系账（节点表：id → 臂 / 第几代 / 种数 / 防御族 / 格 / 快照 fit）
 *    ⚠ 判"哪些是新点"靠**这张表点名**，不靠 path 前缀 —— ruler-figs 产物里根本没有 path 列（path 是链子第③步 attach-path 才加的），
 *      18:33 那次就是按 path 判 ⇒ 133 枚全被判成"旧池"。 */
const g3meta = new Map();
for (const f of String(NODES).split(',')) {
  const t = rd(f).trim().split('\n'); const h = t[0].split('\t');
  for (const l of t.slice(1)) { const c = l.split('\t'); const o = {}; h.forEach((k, i) => { o[k] = c[i]; });
    g3meta.set(o.id, { arm: o.arm, node: o.node, gen: Number(o.gen), kinds: Number(o.kinds), defShare: Number(o.defShare), cell: o.cell, fit: o.fit, path: o.path }); }
}
if (!g3meta.size) { console.error('⛔ 节点表是空的 ⇒ 没法分新旧'); process.exit(2); }
const isNew = (r) => g3meta.has(r.id);
const pool = rows.filter((r) => !isNew(r));
const fresh = rows.filter(isNew);
if (!fresh.length) { console.error('⛔ 联合表里一枚新点都没有（节点表的 id 对不上 coords.tsv？）'); process.exit(2); }
console.log('联合表 ' + rows.length + ' 行（旧池 ' + pool.length + ' ‖ 新 ' + fresh.length + ' / 节点表共 ' + g3meta.size + '）');
if (fresh.length !== g3meta.size) console.error('⚠ 节点表里有 ' + (g3meta.size - fresh.length) + ' 枚没进联合表 ⇒ 去看 ruler-figs 的收枚数');

/* 4) z-score（与 ruler-figs / proj-tsne 同一写法：在**全体行**上标准化） */
const mu = {}, sd = {};
for (const f of FEAT) {
  const v = rows.map((r) => num(r[f])).filter(isFinite);
  mu[f] = v.reduce((a, b) => a + b, 0) / v.length;
  sd[f] = Math.sqrt(v.reduce((a, b) => a + (b - mu[f]) ** 2, 0) / v.length) || 1;
}
const vec = (r) => FEAT.map((f) => (num(r[f]) - mu[f]) / sd[f]);
const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));

/* 5) 每条臂：末代点的旧池最近邻 */
const arms = {};
for (const r of fresh) {
  const m = g3meta.get(r.id); if (!m) continue;
  const a = (arms[m.arm] = arms[m.arm] || { arm: m.arm, pts: [] });
  a.pts.push({ id: r.id, gen: m.gen, node: m.node, kinds: m.kinds, defShare: m.defShare, cell: m.cell, fit: m.fit,
    x: num(r.xt), y: num(r.yt), x3: num(r.xt3), y3: num(r.yt3), z3: num(r.zt3), v: vec(r), path: m.path, isFinal: m.node === 'final' });
}
const poolVec = pool.map(vec);
for (const a of Object.values(arms)) {
  a.pts.sort((p, q) => p.gen - q.gen);
  const fin = a.pts.filter((p) => p.isFinal)[0] || a.pts[a.pts.length - 1];
  a.final = fin;
  a.near = pool.map((r, i) => ({ id: r.id, d: dist(fin.v, poolVec[i]), Hp: num((pub.get(r.id) || {}).Hp),
    F: num((pub.get(r.id) || {}).F), lineage: (pub.get(r.id) || {}).lineage || '', kinds: num(r.distinctKeys) }))
    .sort((x, y) => x.d - y.d).slice(0, 10);
}

/* 6) "两个盆"的可判检验：新点 k-means(k=2) + 两群之间的谷里坐着多少旧池点 */
const nv = fresh.map(vec);
function kmeans2(V, iters) {
  let c0 = V[0].slice();
  /* 第二个中心 = 对**固定的 c0** 取最远那枚（原来写成 `dist(v,m)>dist(v,c0)` 且 m 初值就是 c0 ⇒ 恒 false ⇒ c1 与 c0 重合） */
  let c1 = V[0].slice(); let best = -1;
  for (const v of V) { const d = dist(v, c0); if (d > best) { best = d; c1 = v.slice(); } }
  let assign = new Array(V.length).fill(0);
  for (let it = 0; it < (iters || 60); it++) {
    assign = V.map((v) => (dist(v, c0) <= dist(v, c1) ? 0 : 1));
    const g = [[], []]; V.forEach((v, i) => g[assign[i]].push(v));
    if (!g[0].length || !g[1].length) break;
    c0 = FEAT.map((_, j) => g[0].reduce((s, v) => s + v[j], 0) / g[0].length);
    c1 = FEAT.map((_, j) => g[1].reduce((s, v) => s + v[j], 0) / g[1].length);
  }
  return { assign, c0, c1 };
}
const km = kmeans2(nv);
/* ⚑ 18:38 第一次跑出来 n=133/0 ‖ 轮廓=null —— 病在"最远点初始化"那句：
 *   `reduce((m,v)=> dist(v,m)>dist(v,c0)? v:m, V[0])` 里 m 初值就是 c0 ⇒ 条件恒 false ⇒ c1===c0 ⇒ 全员进 0 群。
 *   正确写法是**对固定的 c0 取 argmax**。这类"两个中心重合"的退化必须被读出来 ⇒ 下面加一条自检。 */
if (grpDegenerate(km)) { console.error('⛔ k-means(k=2) 退化成一团（心距 ' + dist(km.c0, km.c1).toFixed(4) + '）⇒ 分群统计不许印'); }
function grpDegenerate(r) { return dist(r.c0, r.c1) < 1e-6; }
const grp = [0, 1].map((k) => {
  const idx = nv.map((_, i) => i).filter((i) => km.assign[i] === k);
  const mean = (f) => idx.length ? idx.reduce((s, i) => s + num(fresh[i][f]), 0) / idx.length : NaN;
  return { k, n: idx.length, kinds: Number(mean('distinctKeys').toFixed(1)), holo: Number(mean('holo').toFixed(2)),
    dmg: Number(mean('dmg').toFixed(2)), rounds: Number(mean('rounds').toFixed(1)),
    armSet: [...new Set(idx.map((i) => (g3meta.get(fresh[i].id) || {}).arm).filter(Boolean))] };
});
function silh(V, assign) {
  const g = [0, 1].map((k) => V.filter((_, i) => assign[i] === k));
  if (!g[0].length || !g[1].length) return null;
  let s = 0, n = 0;
  V.forEach((v, i) => {
    const own = g[assign[i]].filter((w) => w !== v), other = g[1 - assign[i]];
    if (!own.length || !other.length) return;
    const a = own.reduce((t, w) => t + dist(v, w), 0) / own.length;
    const b = other.reduce((t, w) => t + dist(v, w), 0) / other.length;
    s += (b - a) / Math.max(a, b); n++;
  });
  return n ? Number((s / n).toFixed(3)) : null;
}
const SIL = silh(nv, km.assign);
const CD = dist(km.c0, km.c1);
/* 谷的两种量法（11-03 实测后**只信一维投影那条**）：
 *   ① 细管（垂直距离 < 0.25×心距）：12 维里这条管的体积本来就趋零 ⇒ 旧池实测 0/825 —— 那是几何必然，不是结构 ⇒ 只作对照印出来，不许当证据；
 *   ② 一维投影断档：把每枚投到两心轴上（t=0 一端口 ‖ t=1 另一端口），数**中段 [0.35,0.65]** 里坐了多少枚 ⇒ 非空 = 连续坡，接近 0 = 才叫两个盆。 */
const px = km.c1.map((v, j) => v - km.c0[j]);
const LEN2 = px.reduce((s, v) => s + v * v, 0) || 1;
function tOf(v) { const w = v.map((x, j) => x - km.c0[j]); return w.reduce((s, x, j) => s + x * px[j], 0) / LEN2; }
function slab(V) {
  const names = [];
  let mid = 0;
  V.forEach((v, i) => {
    const t = tOf(v);
    if (t >= 0.35 && t <= 0.65) mid++;
    const tt = t;
    if (tt <= 0.08 || tt >= 0.92) return;
    const w = v.map((x, j) => x - km.c0[j]);
    const perp = Math.sqrt(Math.max(0, w.reduce((s, x) => s + x * x, 0) - tt * tt * LEN2));
    if (perp < 0.25 * CD) names.push(tt);
  });
  return { inGap: names.length, mid, ts: V.map(tOf) };
}
const gapNew = slab(nv);
const gapPool = slab(poolVec);
const gapPoolChamp = pool.filter((r, i) => (pub.get(r.id) || {}).lineage).length;

/* 只看 19 枚末代（去掉"每臂 6 个高度相关快照"的自相关） */
const finV = Object.values(arms).map((a) => a.final.v);
const kmF = kmeans2(finV);
const FIN_SIL = silh(finV, kmF.assign);
const FIN_SIZES = [0, 1].map((k) => kmF.assign.filter((a) => a === k).length);
/* ⚑ 断档检验**只在这条轴上有意义**：133 枚全量的 k=2 分成 131/2 ⇒ 那条"心连线"是两枚离群点撑出来的，
 *   中段空不空说明不了盆不盆（18:41 第一版就是这么错的：拿它量出"新点 1/133 ‖ 旧池 15/794"，看着像分家）。
 *   ⇒ 用**末代 9/10 那一刀**的两心当轴，再数新旧各有多少枚落在中段 [0.3,0.7]。 */
const FCD = dist(kmF.c0, kmF.c1);
const fpx = kmF.c1.map((v, j) => v - kmF.c0[j]);
const fLen2 = fpx.reduce((s, v) => s + v * v, 0) || 1;
const tF = (v) => { const w = v.map((x, j) => x - kmF.c0[j]); return w.reduce((s, x, j) => s + x * fpx[j], 0) / fLen2; };
const midOf = (V) => V.map(tF).filter((t) => t >= 0.3 && t <= 0.7).length;
const MID_NEW = midOf(nv), MID_POOL = midOf(poolVec);
const tsPool = poolVec.map(tF).sort((a, b) => a - b);
const POOL_DEC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => tsPool[Math.min(tsPool.length - 1, Math.round(i * (tsPool.length - 1) / 10))].toFixed(2));

/* 7) 出页 */
const payload = {
  made: new Date().toISOString().slice(0, 16).replace('T', ' '),
  pool: pool.map((r) => { const p = pub.get(r.id) || {}; return { id: r.id, x: num(r.xt), y: num(r.yt), x3: num(r.xt3), y3: num(r.yt3), z3: num(r.zt3),
    Hp: num(p.Hp), F: num(p.F), lin: p.lineage || '', kinds: num(r.distinctKeys) }; }),
  arms: Object.values(arms).map((a) => ({ arm: a.arm, near: a.near.slice(0, 6).map((n) => ({ id: n.id, d: Number(n.d.toFixed(2)), Hp: n.Hp, lin: n.lineage })),
    pts: a.pts.map((p) => ({ id: p.id, gen: p.gen, kinds: p.kinds, defShare: p.defShare, cell: p.cell, fit: p.fit,
      x: p.x, y: p.y, x3: p.x3, y3: p.y3, z3: p.z3, isFinal: !!p.isFinal })) })),
  sil: SIL, cd: Number(CD.toFixed(3)), gapNew: gapNew.inGap, gapPool: gapPool.inGap,
  midNew: MID_NEW, midPool: MID_POOL, poolChampN: gapPoolChamp, axis: 'finals9/10', poolDec: POOL_DEC,
  finSil: FIN_SIL, finSizes: FIN_SIZES, finCd: Number(dist(kmF.c0, kmF.c1).toFixed(3)),
  grp: grp, poolN: pool.length, newN: fresh.length
};
/* 两张表在**生成期**用 node 直接产出 HTML（页内字符串拼接出过一次"续行漏引号 ⇒ 整段脚本没执行"的事故，18:53 实测） */
const nnHtml = '<table><tr><th class=l>臂（末代）</th><th class=l>旧池最近邻 6 枚</th><th>⟡ 数</th><th class=l>末代格</th><th>种数</th><th>防御族%</th></tr>' +
  Object.values(arms).map((a) => {
    const f = a.pts.filter((p) => p.isFinal)[0] || a.pts[a.pts.length - 1];
    return '<tr><td class=l>' + a.arm + '</td><td class=l>' +
      a.near.slice(0, 6).map((n) => n.id + (n.lineage ? '⟡' : '') + ' ' + n.d.toFixed(1)).join(' ‖ ') +
      '</td><td>' + a.near.filter((n) => n.lineage).length + '</td><td class=l>' + (f.cell || '—') +
      '</td><td>' + f.kinds + '</td><td>' + f.defShare + '</td></tr>';
  }).join('') + '</table>';
const verHtml =
  '<div class=cal>新点全量 133 枚分两群：群A n=' + grp[0].n + ' ‖ 群B n=' + grp[1].n + ' ‖ 轮廓 = ' + SIL +
  ' ‖ 心距 = ' + CD.toFixed(3) + '（⚠ 群大小 131/2 那种是<b>两枚离群点撑出来的轴</b>，不能当"两盆"，也不能拿它的中段数说话）</div>' +
  '<div class=cal><b>只看 19 枚末代</b>（去掉每臂 6 个高度相关快照的自相关）：轮廓 = ' + FIN_SIL + ' ‖ 群大小 ' + FIN_SIZES.join('/') + ' ‖ 心距 = ' + FCD.toFixed(3) + ' ⇒ 0.2~0.4 = 结构弱、更像连续</div>' +
  '<div class=cal><b>一维投影断档</b>（轴 = 末代那一刀的两心 ‖ 中段 t∈[0.3,0.7]）：新点 <b>' + MID_NEW + '/' + fresh.length + '</b> ‖ <b>旧池 ' + MID_POOL + '/' + pool.length + '（' + (100 * MID_POOL / pool.length).toFixed(0) + '%）</b>' +
  ' ‖ 旧池 t 十分位 ' + POOL_DEC.join(' ') + ' ⇒ 连续铺到两端就是坡，中段掉到 0 才是盆</div>' +
  '<div class=cal>（另一条量法：贴线的细管 ±0.25 心距 —— 新 ' + gapNew.inGap + ' ‖ 旧池 ' + gapPool.inGap + '。<b>不能当证据</b>：12 维里管道体积趋零，旧池那边实测 0/825 是几何必然，只留着对照）</div>' +
  '<div class=warn><b>判读（用户读对了，我 §十五 的措辞要收窄）</b>：旧池 56% 的点坐在末代两群之间的中段 ⇒ 行为空间里<b>没有两个分离的盆</b>，2.0 的各臂落在旧池已经覆盖的连续带上；' +
  '"盆/势垒"只成立于<b>训练可达性</b>（从 2.0 的起点跑 150+150 代跨不过去）。两句不许混着说。</div>';
const html = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>2.0 冠军放进旧池行为图 · 11-03</title><style>' +
 'body{font:13px/1.5 system-ui,"Microsoft YaHei",sans-serif;margin:14px;background:#0e1014;color:#e8eaef}' +
 'h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:12px 0 4px;color:#a8c7fa}' +
 '.bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:8px 0} .bar label{color:#9aa4b2}' +
 'canvas{background:#12151b;border:1px solid #262c38;border-radius:8px;display:block;cursor:crosshair}' +
 '.wrap{display:flex;flex-wrap:wrap;gap:14px} .card{background:#161a22;border:1px solid #262c38;border-radius:8px;padding:10px}' +
 '.leg{display:flex;flex-wrap:wrap;gap:5px 9px;font-size:12px;margin-top:6px}' +
 '.leg button{background:#161a22;border:1px solid #3a4250;color:#e8eaef;border-radius:11px;padding:1px 7px;cursor:pointer;font-size:12px}' +
 '.leg button.off{opacity:.3} table{border-collapse:collapse;font-size:12px} th,td{border-bottom:1px solid #262c38;padding:3px 6px;text-align:right;white-space:nowrap}' +
 'th{color:#9aa4b2;font-weight:600} td.l,th.l{text-align:left} .cal{color:#9aa4b2;font-size:12px;max-width:1200px}' +
 '.warn{color:#f2b03a;font-size:12px;max-width:1200px} #tip{position:fixed;display:none;background:#1f2530;border:1px solid #3a4250;border-radius:6px;padding:6px 8px;font-size:12px;pointer-events:none;z-index:9;max-width:380px}' +
 'code{background:#1f2530;padding:1px 4px;border-radius:3px}</style></head><body>' +
 '<h1>2.0 冠军放进旧池的行为图 —— 分布 + 演化轨迹（旧池半透明当对照）</h1>' +
 '<div class="cal">尺与旧图同一把：<code>ruler-measure</code> 现测 12 维行为探针（考卷 120 局/组合 · seed 77000 · 自对局 40 · 座位 100 · 探针 40）‖' +
 '坐标 = <code>proj-tsne</code>（perp 30 · iters 500 · seed 7）在 <b>旧池 ' + payload.poolN + ' + 新 ' + payload.newN + ' = ' + (payload.poolN + payload.newN) + ' 枚上联合重拟合</b>。' +
 '⚑ 联合重拟合会<b>动旧点的绝对位置</b>（t-SNE 没有"只投新点"的用法）⇒ 本页可比的是<b>邻域关系</b>，不是与线上 index.html 逐像素对齐。生成时刻 ' + payload.made + '</div>' +
 '<div class="bar">视图 <select id="vw"><option value="2d">二维（xt/yt）</option><option value="3d">三维（xt3/yt3/zt3）</option></select>' +
 '旧池透明 <input type="range" id="al" min="4" max="60" value="16"> <span id="alv">0.16</span>' +
 '新点 <select id="which"><option value="all">全部（快照 + 末代）</option><option value="final">只看末代</option></select>' +
 ' 轨迹线 <input type="checkbox" id="lines" checked> 池色 <select id="pc"><option value="hp">按 Hp（头号尺）</option><option value="lin">按身份（上槽=亮）</option></select></div>' +
 '<div class="wrap"><div class="card"><div id="c2"></div><div class="leg" id="lg"></div>' +
 '<div class="cal">大圈 = 臂的末代（产物）‖ 小点 = 每 25 代快照 ‖ 连线 = 同一臂随训练走的轨迹（点径≈种数）。旧池小点半透明。</div></div>' +
 '<div class="card"><h2>每条臂末代点的旧池最近邻（前 6 ‖ d = 12 维标准化欧氏距离 ‖ ⟡ = 上过槽）</h2>' + nnHtml +
 '<div class="cal">读法：最近邻里 ⟡ 多 ⇒ 它在旧池里"像个冠军的形状"；全是层内实验点 ⇒ 旧池里没有与它同型的参照。</div></div></div>' +
 '<div class="card"><h2>"两个盆"的检验</h2>' + verHtml + '</div><div id="tip"></div><script>' +
 'const D=' + JSON.stringify(payload) + ';' +
 'const PAL=["#7fd8a2","#a8c7fa","#f2b03a","#ff8a8a","#c586ff","#6ec6c8","#e0a3c7","#b8d17a","#f5a97f","#8ea2ff","#d0d5dd","#7ae0c0","#ff9ecb","#9ecbff","#ffd27a","#c0c7d1","#ff6b6b","#6bf0a1","#a16bff"];' +
 'const AC={};D.arms.forEach((a,i)=>AC[a.arm]=PAL[i%PAL.length]);' +
 'const HID=new Set();const tip=document.getElementById("tip");' +
 'let view="2d",poolAlpha=0.16,which="all",lines=true,poolColor="hp",yaw=0.6,pitch=0.35,drag=null;' +
 'const W=640,H=520;' +
 'function bb(){let xs=[],ys=[];const push=(X,Y)=>{xs.push(X);ys.push(Y)};' +
 ' D.pool.forEach(p=>push(view==="2d"?p.x:p.x3,view==="2d"?p.y:p.y3));' +
 ' D.arms.forEach(a=>a.pts.forEach(p=>push(view==="2d"?p.x:p.x3,view==="2d"?p.y:p.y3)));' +
 ' return {x0:Math.min.apply(null,xs),x1:Math.max.apply(null,xs),y0:Math.min.apply(null,ys),y1:Math.max.apply(null,ys)};}' +
 'let BB=bb();' +
 'function proj(p){const X=view==="2d"?p.x:p.x3,Y=view==="2d"?p.y:p.y3,Z=p.z3||0;' +
 ' if(view==="2d")return[(X-BB.x0)/((BB.x1-BB.x0)||1)*(W-80)+40,(1-(Y-BB.y0)/((BB.y1-BB.y0)||1))*(H-70)+35];' +
 ' const m=Math.max(BB.x1-BB.x0,BB.y1-BB.y0)||1,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);' +
 ' const x1=X*cy-Z*sy,z1=X*sy+Z*cy,y2=Y*cp-z1*sp;' +
 ' return[(x1/m)*(W-110)+W/2,(0.5-(y2/m)*0.42)*(H-70)+35];}' +
 'function hpColor(v){if(!Number.isFinite(v))return"#666";const t=Math.max(0,Math.min(1,v/100));' +
 ' return"rgb("+Math.round(40+200*t)+","+Math.round(70+110*Math.abs(0.5-t))+","+Math.round(215-170*t)+")";}' +
 'function draw(){BB=bb();document.getElementById("c2").innerHTML="<canvas id=cv width="+W+" height="+H+"></canvas>";' +
 ' const g=document.getElementById("cv").getContext("2d");g.fillStyle="#12151b";g.fillRect(0,0,W,H);' +
 ' D.pool.forEach(p=>{const q=proj(p);g.globalAlpha=poolAlpha;' +
 '  g.fillStyle=poolColor==="lin"?(p.lin?"#ffd27a":"#7d8794"):hpColor(p.Hp);' +
 '  g.beginPath();g.arc(q[0],q[1],p.lin?3.1:1.8,0,6.2832);g.fill();});' +
 ' g.globalAlpha=1;' +
 ' D.arms.forEach(a=>{if(HID.has(a.arm))return;const pts=a.pts.filter(p=>which==="final"?p.isFinal:true);if(!pts.length)return;' +
 '  if(lines){g.strokeStyle=AC[a.arm];g.globalAlpha=.6;g.lineWidth=1.3;g.beginPath();' +
 '   pts.forEach((p,i)=>{const q=proj(p);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);});g.stroke();g.globalAlpha=1;}' +
 '  pts.forEach(p=>{const q=proj(p);const r=p.isFinal?5.4:2.4+(p.kinds||0)*0.2;' +
 '   g.beginPath();g.arc(q[0],q[1],r,0,6.2832);g.fillStyle=AC[a.arm];g.globalAlpha=p.isFinal?1:.85;g.fill();g.globalAlpha=1;' +
 '   if(p.isFinal){g.strokeStyle="#0e1014";g.lineWidth=1.3;g.stroke();g.fillStyle="#e8eaef";g.font="11px system-ui";g.fillText(a.arm,q[0]+7,q[1]-5);}});});' +
 ' g.globalAlpha=1;}' +
 'document.getElementById("lg").innerHTML=D.arms.map(a=>"<button data-a=\\""+a.arm+"\\"><span style=color:"+AC[a.arm]+">●</span> "+a.arm+"</button>").join("")+" <button data-a=__all>清除高亮</button>";' +
 'document.querySelectorAll("#lg button").forEach(b=>b.onclick=()=>{const n=b.dataset.a;' +
 ' if(n==="__all"){HID.clear();document.querySelectorAll("#lg button").forEach(x=>x.classList.remove("off"));}' +
 ' else if(HID.has(n)){HID.delete(n);b.classList.remove("off");}else{HID.add(n);b.classList.add("off");}draw();});' +
 '["vw","al","which","lines","pc"].forEach(id=>{const el=document.getElementById(id);' +
 ' el.oninput=el.onchange=()=>{view=document.getElementById("vw").value;poolAlpha=Number(document.getElementById("al").value)/100;' +
 '  document.getElementById("alv").textContent=poolAlpha.toFixed(2);which=document.getElementById("which").value;' +
 '  lines=document.getElementById("lines").checked;poolColor=document.getElementById("pc").value;draw();};});' +
 'document.addEventListener("mousedown",e=>{if(e.target.id==="cv")drag=[e.clientX,e.clientY];});' +
 'document.addEventListener("mouseup",()=>drag=null);' +
 'document.addEventListener("mousemove",e=>{if(drag&&view==="3d"){yaw+=(e.clientX-drag[0])*0.008;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*0.008));drag=[e.clientX,e.clientY];draw();return;}' +
 ' if(e.target.id!=="cv"){tip.style.display="none";return;}' +
 ' const R=e.target.getBoundingClientRect(),mx=e.clientX-R.left,my=e.clientY-R.top;let best=null,bd=1e9;' +
 ' D.arms.forEach(a=>{if(HID.has(a.arm))return;a.pts.forEach(p=>{if(which==="final"&&!p.isFinal)return;const q=proj(p);const d=(q[0]-mx)**2+(q[1]-my)**2;if(d<bd&&d<110){bd=d;best={a,p};}});});' +
 ' D.pool.forEach(p=>{const q=proj(p);const d=(q[0]-mx)**2+(q[1]-my)**2;if(d<bd&&d<45){bd=d;best={pool:p};}});' +
 ' if(best){tip.style.display="block";tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY+12)+"px";' +
 '  tip.innerHTML=best.pool?("旧池 "+best.pool.id+(best.pool.lin?" ‖ "+best.pool.lin:"")+" ‖ Hp "+Math.round(best.pool.Hp)+" ‖ 种数 "+best.pool.kinds)' +
 '   :(best.a.arm+" ‖ "+best.p.id+" ‖ 第 "+best.p.gen+" 代 ‖ 种 "+best.p.kinds+" ‖ 防御族 "+best.p.defShare+"% ‖ 格 "+best.p.cell+" ‖ 快照 fit "+best.p.fit);}' +
 ' else tip.style.display="none";});' +
 'draw();</script></body></html>';
const outPath = pathOf(OUT);
/* 落盘前**先把页内脚本编译一遍**：18:53 那次是字符串续行漏了引号 ⇒ HTML 看着"已生成"，打开却全空。
 *   坏要坏在生成器里，不要坏在用户双击的时候。 */
const inlineJs = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
try { new vm.Script(inlineJs); } catch (e) {
  console.error('⛔ 页内脚本编译不过 ⇒ 拒绝落盘：' + e.message + '（页内脚本 ' + inlineJs.length + ' B）');
  process.exit(3);
}
writeFileSync(outPath, html, 'utf8');
console.log('✔ 已写 ' + OUT + '（' + (html.length / 1024).toFixed(1) + ' KB）');
/* 只看 19 枚末代（去掉"每臂 6 个高度相关的快照"带来的自相关） */
console.log('  【19 枚末代】k-means k=2 轮廓 = ' + FIN_SIL + ' ‖ 群大小 = ' + FIN_SIZES.join('/') + ' ‖ 心距 = ' + dist(kmF.c0, kmF.c1).toFixed(3));
console.log('  【133 枚全量】轮廓 = ' + SIL + ' ‖ 群大小 = ' + grp.map((g) => g.n).join('/') + ' ‖ 心距 = ' + CD.toFixed(3) +
  ' ‖ 群A 臂：' + (grp[0].armSet || []).slice(0, 6).join(',') + (grp[0].armSet && grp[0].armSet.length > 6 ? '…' : ''));
console.log('  断档（轴 = 末代 9/10 两心 ‖ 中段 t∈[0.3,0.7]）：新点 ' + MID_NEW + '/' + fresh.length + ' ‖ 旧池 ' + MID_POOL + '/' + pool.length +
  ' ‖ 旧池 t 十分位 ' + POOL_DEC.join(' ') + '（细管量法只作对照：新 ' + gapNew.inGap + ' ‖ 旧池 ' + gapPool.inGap + '）');
console.log('  每条臂末代的旧池最近邻前 3：');
for (const a of Object.values(arms)) console.log('   ' + a.arm.padEnd(16) + ' ' + a.near.slice(0, 3).map((n) => n.id + '(' + n.d.toFixed(1) + (n.lineage ? '⟡' : '') + ')').join(' ‖ '));
