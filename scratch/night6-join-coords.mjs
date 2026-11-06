#!/usr/bin/env node
/* night6-join-coords.mjs v3 —— 把 2.0 点并进旧演化图的数据管线（ZCode 起 · 千问 11-05 上午重写组装段）
 *
 * 这版修掉的五件事（都是用户 11-05 上午点名的）：
 *   ① **投影列不许由合并器填**：夜班把 `x2/y2` 抄进 `xt/yt` ⇒ 864/864 行两列逐字相同 ⇒ viewer 画的正是 `xt/yt`
 *      ⇒ 图上"团成一块 + 几个点飞出去"。本件一律留空，由 `proj-tsne --in=<本表>` 对**这张图要画的这一批点**投影。
 *   ② **版本判定交回容器**：`ver` 只由产物的 `"v":` 决定（92 ⇒ 2.0，其余 ⇒ 1.8），**不再**由"在不在 2.0 谱系 sidecar 里"决定
 *      ⇒ `D4a`（v7 面的克隆根）回到 1.8；`V7C/V7M/V7L` 那六枚 v7 面臂也回 1.8。父边照旧连（跨版本父边）。
 *   ③ **每行必须带 `path`**：夜班把 39 行 2.0 的 path 全丢了 ⇒ 既不能核容器、也不能补测。
 *   ④ **Hp 统一成一把尺**：2.0 行改读 `champion-map/epsfull-g3-1105.tsv` 的 `page` 列（= 与 1.8 行同一台 `eps-full`、
 *      35 组合 × 120 局、`--epsTier=lv:regular`、桌形默认 multi）；没测到的 ⇒ 留空走"未测"那一支，
 *      **不许**拿 eval-5p 200 局的强度冒充头号尺（`Fv = Hp/100 + T·S` 是图上名次/颜色/分界的底）。
 *   ⑤ **别名归一**：`BAS-s41__final` 与 `BAS-s41` 是同一枚产物的两个名字 ⇒ 统一成臂名
 *      （原来因此虚报 13 个"父节点没进图"）。
 *
 * 视图子集（用户："选择批次不是像拉显示范围一样把旧点扣掉——投影是局域性的，要连着点坐标一起重算"）：
 *   `--only=all` ⇒ champion-map/coords-gen3-1105.tsv（全部点）
 *   `--only=18`  ⇒ champion-map/coords-view-18.tsv （1.8 及以前）
 *   `--only=20`  ⇒ champion-map/coords-view-20.tsv （2.0 系 ∪ 父链里已在表内的点 ⇒ 边画得出）
 *   ⇒ 三张表各自过 `proj-tsne --in`，再各自烘一页；页面里的"版本"下拉**换页**，不是换滤镜。
 *
 * 用法：node scratch/night6-join-coords.mjs [--only=all|18|20] [--out=<表>]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIMS = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk'];
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const ONLY = arg('only', 'all');
if (['all', '18', '20'].indexOf(ONLY) < 0) { console.error('⛔ --only 只收 all|18|20，收到 ' + ONLY); process.exit(64); }
const tsv = (f) => { const L = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean); const h = L[0].split('\t'); return { h, rows: L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }) }; };
const norm = (id) => String(id || '').replace(/__final$/, '');   // ⑤ 别名归一

const old = tsv('champion-map/coords.tsv');                 // 825 行全列（1.8 面板）
const joint = tsv('champion-map/coords-gen3-1103.tsv');     // 927 行联合表（短 schema，代 3 臂在这里）
const oldIds = new Set(old.rows.map(r => norm(r.id)));

/* ②③ 容器版本与产物路径：单一来源 = 真文件（不是 sidecar 的名单，也不是文件名猜）
 *   ⚠ 同 id 撞两个产物是要**点名**的病：面板里的 `D4a` = `docs/artifacts/e234-out/D4a.js`（v7 容器），
 *      而 2.0 谱系里的 "D4a" = `scratch/arms/CLONE-D4a.bak`（**v:92**，克隆进新容器的那枚）⇒ 原来后写覆盖前写，
 *      于是"1.8 的 D4a 被标成 2.0"。⇒ 面板路径优先占位，撞车的第二枚**改用文件名自己的 id**，两枚都在图上。 */
const PANEL_PATH = new Map();
for (const r of old.rows) if (r.path) PANEL_PATH.set(norm(r.id), r.path);
const PATHOF = new Map(PANEL_PATH);
const COLLISION = [];
function addPath(id, p) {
  if (!p) return;
  if (!PATHOF.has(id)) { PATHOF.set(id, p); return; }
  if (PATHOF.get(id) === p) return;
  const alt = p.split(/[\\/]/).pop().replace(/\.(bak|js)$/, '');
  COLLISION.push(id + '：面板=' + PATHOF.get(id) + ' ‖ 另一枚=' + p + ' ⇒ 后者记作 ' + alt);
  if (!PATHOF.has(alt)) PATHOF.set(alt, p);
}
if (existsSync('champion-map/extra-g3-1105.tsv')) {
  for (const l of readFileSync('champion-map/extra-g3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').slice(1)) {
    const c = l.split('\t'); if (c[0] && c[1]) addPath(norm(c[0]), c[1]);
  }
}
const g3ruler = tsv('scratch/night6/ruler-g3.tsv');
/* 11-06 晨（Qoder）：池内图外那 10 枚的 12 维读数。文件名带 `-only-` 是有原因的——
 *   第一版跑成 `--set=layer`（会去量整个层级面板）中途停掉，那份残表已删；重跑用
 *   `--set=champ --extra=champion-map/pool-only-1106.tsv --ids=<10 枚> --exam=120`，落盘就只有这 10 行。
 *   ⚠ 这里写错文件名不会报错：下面有 existsSync 兜底 ⇒ 那 10 枚**静默不进表** ⇒ 下一次整条链重跑会把
 *   今天补进图的池成员又丢掉（D234 池环两条当场回红）。所以缺文件必须响亮。 */
const POOLR = 'scratch/night6/ruler-pool-only-1106.tsv';
if (!existsSync(POOLR)) { console.error('⛔ 缺池内图外那 10 枚的 ruler 表 ' + POOLR + ' ⇒ 它们不会进表，池环判据会回红（重测：见本行注释）'); process.exit(2); }
const poolRuler = tsv(POOLR);
const RULER_ROWS = g3ruler.rows.concat(poolRuler.rows);
for (const r of RULER_ROWS) if (r.path) addPath(norm(r.id), r.path);
const VERCACHE = {};
function verOf(id) {
  const p = PATHOF.get(id); if (!p) return '';
  if (VERCACHE[p] !== undefined) return VERCACHE[p];
  let v = '';
  try { const m = /"v":(\d+)/.exec(readFileSync(p, 'utf8')); v = m ? (String(m[1]) === '92' ? '2.0' : '1.8') : ''; } catch (e) { v = ''; }
  VERCACHE[p] = v; return v;
}

/* ④ Hp：2.0 行只认 eps-full 的 `page` 列（与 1.8 行同一把头号尺、同 seed、同档、同桌形）
 *   三批都是同一台 `eps-full --games=120 --epsTier=lv:regular`（jobs=4）：
 *     epsfull-g3-1105.tsv = 39 枚精选点 ‖ -g3b- = 克隆根 CLONE-D4a ‖ -g3c- = 补进来的 3 个父节点 */
const HPG3 = new Map();
const GSET = new Set();
for (const f of ['champion-map/epsfull-g3-1105.tsv', 'champion-map/epsfull-g3b-1105.tsv', 'champion-map/epsfull-g3c-1105.tsv', 'champion-map/epsfull-g3d-1105.tsv', 'champion-map/epsfull-r64-multi-1106.tsv']) {
  if (!existsSync(f)) continue;
  for (const r of tsv(f).rows) {
    if (String(r.page === undefined ? '' : r.page).trim() !== '' && Number.isFinite(+r.page)) {
      HPG3.set(norm(r.id), { Hp: +r.page, De: +r.d, examG: String(r.examG || '').trim(), mode: String(r.mode || '').trim() });
      if (r.examG) GSET.add(String(r.examG));
    }
  }
}
/* 页内那条「全图只能有一个考卷档」（§E569）要求 examG 随行且**只有一个取值**。2.0 行原来不写这一列 ⇒
 *   主图 825/870 带档、子集页 0/39 带档，两头的红都是同一件事：**Hp 是哪一把卷量的，就得随行记下来**。 */
if (GSET.size > 1) { console.error('⛔ eps-full 那几批的档不一致：' + [...GSET].join(' ‖ ') + ' ⇒ 不许把两把卷的读数并成一列 Hp'); process.exit(2); }
const EXAMG = GSET.size === 1 ? [...GSET][0] : '';
console.log('  考卷档随行（来自 eps-full 的 examG 列）：' + (EXAMG || '（读不到档 ⇒ 2.0 行的 examG 留空，页内 §E569 会红，这是对的）'));

/* ---- 组装 ---- */
const outHead = old.h.slice();
for (const extra of ['xt', 'yt', 'xt3', 'yt3', 'zt3', 'ver', 'path']) if (outHead.indexOf(extra) < 0) outHead.push(extra);
const recs = [], lines = [];
function emit(raw) {
  const r = raw; r.id = norm(r.id);
  r.ver = verOf(r.id) || r.ver || '1.8';                        // ② 容器说了算；读不到容器才退回原标注
  if (PATHOF.has(r.id)) r.path = PATHOF.get(r.id);              // ③ 路径随行
  r.xt = ''; r.yt = ''; r.xt3 = ''; r.yt3 = ''; r.zt3 = '';      // ① 投影交回 proj-tsne
  if (r.ver === '2.0') {                                     // ④ 2.0 行**只认** eps-full：没测到就留空（"未测"），不许拿 200 局的数冒充头号尺
    const h = HPG3.get(r.id); r.Hp = h ? h.Hp : ''; r.De = h ? h.De : '';
    r.examG = h ? (h.examG || EXAMG) : '';                   // 哪一把卷量的就记哪个档（§E569 判"全图只能一个档"）
  } else if (String(r.Hp === undefined ? '' : r.Hp).trim() === '') {
    /* 面板外的 1.8 行（如 V7C/V7M/V7L 这六枚 v7 面对照臂）：容器把它们判回 1.8，但它们不在 coords.tsv 面板里 ⇒ 没有 Hp。
     *   同一台 eps-full 已经量过它们 ⇒ 照实填，**不许**空着让 viewer 的头号尺守卫报"装错货"。 */
    const h = HPG3.get(r.id); if (h) { r.Hp = h.Hp; r.De = h.De; r.examG = h.examG || EXAMG; }
  }
  recs.push(r);
  lines.push(outHead.map(k => (r[k] === undefined || r[k] === null) ? '' : r[k]).join('\t'));
}

for (const o of old.rows) emit(Object.assign({}, o));            /* ① 旧池行：全列原样（x2/y2 不覆盖 ⇒ 那是旧 fit 的线性主坐标） */
let nSeg = 0;
for (const j of joint.rows) {                                    /* ② 代 3 行（只在联合表里的；段快照不进主图） */
  const id = norm(j.id); if (oldIds.has(id)) continue;
  if (/__seg\d+$/.test(j.id)) { nSeg++; continue; }
  const r = Object.assign({}, j); r.id = id;
  if (!(Number(r.H) > 0)) r.H = '';
  emit(r);
}
let nSkipDim = [];
for (const [id0, n] of new Map(RULER_ROWS.map(r => [norm(r.id), r]))) {   /* ③ 精选 2.0 点：12 维来自 ruler-g3 */
  /* 12 维不齐 ⇒ **不许进表**：`proj-tsne` 要求每一维都是数（它自己会 exit 2），而"读不出"的枚一旦带着空维进来，
   *   整张图就烘不出来。典型来源：装载闸拒绝的代 2 产物（v:91）在 ruler-g3 里留的是 ERR 行。 */
  if (DIMS.some(d => !Number.isFinite(Number(n[d])))) { nSkipDim.push(id0 + '（12 维不齐）'); continue; }
  /* 同 id 撞两个产物 ⇒ 这枚按**它自己的文件名**登记（面板里那一枚留在原位、按容器归 1.8） */
  let id = id0;
  if (PANEL_PATH.has(id0) && n.path && PANEL_PATH.get(id0) !== n.path) id = n.path.split(/[\\/]/).pop().replace(/\.(bak|js)$/, '');
  if (recs.some(x => x.id === id)) continue;
  const row = {}; outHead.forEach(h => row[h] = '');
  row.id = id; row.S = n.S; row.Geff = n.Geff; row.H = n.H || ''; row.ver = '2.0';
  for (const d of DIMS) row[d] = n[d] || '';
  emit(row);
}

/* ---- 视图子集（局域性：每张图自己一套 fit、自己一套名次/百分位） ---- */
const byId = new Map(recs.map(r => [r.id, r]));
const LIN = {};
if (existsSync('champion-map/lineage-g3.tsv')) for (const r of tsv('champion-map/lineage-g3.tsv').rows) LIN[norm(r.id)] = r;
function parentChain(id) {          // 2.0 视图带上"已在表内的父链"，否则父边画不出来
  const seen = new Set(); let cur = LIN[id] && LIN[id].parent; let guard = 0;
  while (cur && byId.has(norm(cur)) && !seen.has(norm(cur)) && guard++ < 40) { seen.add(norm(cur)); cur = LIN[norm(cur)] && LIN[norm(cur)].parent; }
  return seen;
}
let picked = recs;
if (ONLY === '18') picked = recs.filter(r => r.ver !== '2.0');
else if (ONLY === '20') { const set = new Set(); for (const r of recs) if (r.ver === '2.0') { set.add(r.id); for (const p of parentChain(r.id)) set.add(p); } picked = recs.filter(r => set.has(r.id)); }

/* ---- 名次按**本视图挑出来的这批行**重算（Fv = Hp/100 + 0.1·S；viewer 点大小 = f(rank)，空 rank = 点不可见） ---- */
const iRk = outHead.indexOf('rank'), iHp = outHead.indexOf('Hp'), iS = outHead.indexOf('S');
const idxOf = new Map(recs.map((r, i) => [r.id, i]));
const chosen = picked.map(r => lines[idxOf.get(r.id)]);
const fv = chosen.map(l => { const c = l.split('\t'); return (Number(c[iHp]) || 0) / 100 + 0.1 * (Number(c[iS]) || 0); });
const order = fv.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
const rank = new Array(fv.length); order.forEach(([v, i], k) => rank[i] = k + 1);
const finalLines = chosen.map((l, i) => { const c = l.split('\t'); c[iRk] = String(rank[i]); return c.join('\t'); });

const OUT = arg('out', ONLY === 'all' ? 'champion-map/coords-gen3-1105.tsv' : 'champion-map/coords-view-' + ONLY + '.tsv');
writeFileSync(OUT, [outHead.join('\t')].concat(finalLines).join('\n') + '\n');
const t20 = picked.filter(r => r.ver === '2.0'), noHp = t20.filter(r => String(r.Hp) === '');
console.log('⇒ ' + OUT + '：' + picked.length + ' 行（视图 ' + ONLY + ' ‖ 全表 ' + recs.length + ' 行 ‖ 段快照剔除 ' + nSeg + '）');
console.log('  版本按容器：2.0=' + t20.length + ' ‖ 1.8=' + (picked.length - t20.length) +
  ' ‖ D4a ⇒ ' + ((byId.get('D4a') || {}).ver || '?') + ' ‖ V7C-s13 ⇒ ' + ((byId.get('V7C-s13') || {}).ver || '?') + '（v7 面臂不再被 sidecar 拉进 2.0）');
console.log('  投影列 xt/yt：**全空** ⇒ 必跑 node champion-map/proj-tsne.mjs --in=' + OUT);
console.log('  Hp 统一（eps-full 同尺）：2.0 行有 Hp ' + (t20.length - noHp.length) + '/' + t20.length + (noHp.length ? ' ‖ 缺测点名 ' + noHp.map(r => r.id).slice(0, 14).join(' ') : ''));
console.log('  无 path 的枚：' + (picked.filter(r => !r.path).map(r => r.id).slice(0, 14).join(' ') || '无'));
console.log('  同 id 撞两个产物（后者按文件名另立一枚）：' + (COLLISION.length ? '\n    ' + COLLISION.join('\n    ') : '无'));
console.log('  12 维不齐、不进表（proj-tsne 要求每维都是数）：' + (nSkipDim.length ? nSkipDim.join(' ‖ ') : '无'));
