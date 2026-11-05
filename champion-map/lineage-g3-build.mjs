#!/usr/bin/env node
/* lineage-g3-build.mjs —— 从 `g3-lineage.tsv`（ZCode 的 237 行代 3 谱系）**生成** `lineage-g3.tsv`
 *
 * 为什么要生成而不是手抄（用户 11-05 上午三条点名）：
 *   ① **D4a 被标成 2.0**：旧 sidecar 只有 21 行、且 viewer 用"在 sidecar 里"当版本判据 ⇒ v7 面的克隆根也进了 2.0 名单。
 *      ⇒ 本件把 `parent` 如实写下来（D4a 的父是 GD3-SWORD，跨版本），**版本判定交回容器**（`night6-join-coords.mjs` 读 `"v":`）。
 *   ② **19 枚代 3 臂根本没有谱系行** ⇒ 图上孤立。⇒ 本件从产物 meta 的 `hotstartFrom`（**权重 id**，不是猜的名字）回解父节点。
 *   ③ **家族号 900+ 且分得太碎**（900:4 ‖ 901:6 ‖ 902:5 ‖ 903:3 ‖ 904:2 ‖ 905:1）。⇒ 续上旧表（旧 fam 最大 13）编成 **14~18 共 5 族**。
 *
 * 输出：`champion-map/lineage-g3.tsv`（列同旧：id/fam/famLabel/ts/parent/wid）+ 一份"父节点不在图上"的点名（要进图就得测 ⇒ 交回合并器）。
 * 用法：node champion-map/lineage-g3-build.mjs [--write=1]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const WRITE = arg('write', '1') !== '0';
const tsv = (f) => { const p = join(ROOT, f); if (!existsSync(p)) { console.error('⛔ 缺输入 ' + f); process.exit(2); }
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim().split('\n'); const h = L[0].split('\t');
  return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); };

const norm = (id) => String(id || '').replace(/__final$/, '');
const g3 = tsv('champion-map/g3-lineage.tsv');                 // 237 行：id/parent/edgeKind/family/seed/gens/games/src/...
const coords = tsv('champion-map/coords-gen3-1105.tsv');       // 864 行（图上画的东西）
const ruler = tsv('scratch/night6/ruler-g3.tsv');              // 21 枚精选：带 path
const extra = existsSync(join(ROOT, 'champion-map/extra-g3-1105.tsv'))
  ? readFileSync(join(ROOT, 'champion-map/extra-g3-1105.tsv'), 'utf8').trim().split('\n').slice(1)
    .map(l => { const c = l.split('\t'); return { id: c[0], path: c[1] }; }) : [];

const byId = {}; for (const r of g3) byId[r.id] = r;
const plotted = new Set(coords.map(r => r.id));
const PATHOF = {};
const PANEL = {}; for (const r of coords) if (r.path) PANEL[norm(r.id)] = r.path;
const RENAME = {};   // 同 id 撞两个产物 ⇒ 谱系里那一枚改用文件名（面板里的原枚不动）
function putPath(id, p) {
  if (!p) return;
  id = norm(id);
  if (!PATHOF[id]) { PATHOF[id] = p; return; }
  if (PATHOF[id] === p) return;
  const alt = p.split(/[\\/]/).pop().replace(/\.(bak|js)$/, '');
  if (!PATHOF[alt]) { PATHOF[alt] = p; RENAME[id] = alt; }
}
for (const r of coords) if (r.path) putPath(r.id, r.path);
for (const e of extra) putPath(e.id, e.path);
for (const r of ruler) if (r.path) putPath(r.id, r.path);
for (const r of g3) if (r.src) putPath(r.id, r.src);   // ⚠ 必须走 putPath：面板里的 `D4a`（v7 面）与谱系里的 `D4a`（=scratch/arms/CLONE-D4a.bak，v:92）
                                                       //   是同名的两枚 ⇒ 撞车检测要把后者改立为 CLONE-D4a，否则克隆根的父边挂错点
const ren = (id) => RENAME[norm(id || '')] || norm(id || '');
console.log('同 id 撞车改名：' + (Object.keys(RENAME).length ? Object.entries(RENAME).map(([k, v]) => k + '→' + v).join(' ‖ ') : '无') +
  '（⇒ 谱系里那一枚按自己的文件名登记，面板里的原枚不动）');

/* ---- 家族：**4 类**（用户："家族分太多了，标号莫名其妙变成九百多"）⇒ 续旧表编号从 14 起，按来源归并、不按 seed 拆。
 *   ⚠ 顺序就是优先级（细的先、粗的后），归不上的进最后一类（产线），**不许**新开一族。
 *   ⚠ **编号不是写死的**（11-05 中午）：页内自检有一条「家族行序要与这一行真显示的那些枚的训出时刻同向」，
 *     写死 14=KD ‖ 15=冷启动 ‖ 16=gen3 ‖ 17=产线 会让 11-01 那批排在 11-04 那批下面 ⇒ 当场红。
 *     所以四类的**号**按各类最早训出时刻升序发（14..17），类别归属不变。 */
const CATS = [
  ['KD', 'KD 蒸馏链（v7 教师全模型）', /^KD/],
  ['COLD', '2.0 冷启动与幅度臂（波 D/H：CB13·CG13·CA13·HS*·AK3*·GK*）', /^(CB13|CG13|CA13|HS-|HS4|HS\b|AK3|GK|GKS|SC\d)/],
  ['G3', 'gen-3 实验臂（11-01 era：起点=热启动权重 id）', /^(BAS|G3C|G3M|V7C|V7M|V7L|BREAD-W05|CBG|CBGG|GD3ALL-|EFFG|PUSHON|G5DEF|POPP)/],
  ['ROOT', '2.0 蒸馏根与 L5/CB/D 产线', null],   /* catch-all：归不上前三类的都在这儿 */
];
const catOf = (id) => { for (let i = 0; i < CATS.length; i++) if (!CATS[i][2] || CATS[i][2].test(id)) return i; return CATS.length - 1; };

/* ---- 父节点：优先 g3-lineage 的行；没有就用产物 meta 的 `hotstartFrom`（权重 id）回解 ---- */
const WIDOF = {};   // wid → 图上/表里已知的节点 id（用于把 hotstartFrom 翻成父名）
function widOfPath(p) {
  try { const t = readFileSync(join(ROOT, p), 'utf8'); const m = /window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/.exec(t); if (!m) return '';
    const raw = JSON.parse(m[1]); const a = raw.a || raw.p || [];
    let h = 0x811c9dc5; for (let i = 0; i < a.length; i += 3) { h ^= Math.round((a[i] || 0) * 1e6) | 0; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0').slice(0, 12);
  } catch (e) { return ''; }
}
/* 仓里的 `widOf` 是权威（与 D191/pack-id 同一式）⇒ 能 import 就用它，别自己发明第二套哈希 */
let widOf = widOfPath;
try { const mod = await import('./pack-id.mjs'); if (typeof mod.widOf === 'function') widOf = (p) => { try { return (mod.widOf(readFileSync(join(ROOT, p), 'utf8')) || '').slice(0, 12); } catch (e) { return ''; } }; } catch (e) {}

const WIDIDX = {}; let widBuilt = false;
function buildWidIndex() {
  if (widBuilt) return;
  widBuilt = true;
  const dirs = ['scratch/arms', 'scratch/ga-arms', 'docs/artifacts/e234-out', 'docs/artifacts/e100-out', 'docs/artifacts/e287-out'];
  for (const d of dirs) { let fs2; try { fs2 = readdirSync(join(ROOT, d)); } catch (e) { continue; }
    for (const f of fs2) { if (!/\.(bak|js)$/.test(f)) continue; const rel = d + '/' + f; const w = widOf(rel); if (w) { const id = f.replace(/\.(bak|js)$/, ''); if (!WIDIDX[w.slice(0, 12)]) WIDIDX[w.slice(0, 12)] = id; } } }
}
function resolveWid(w) { buildWidIndex(); return WIDIDX[(w || '').slice(0, 12)] || ''; }
function hotstartWid(p) {
  try { const t = readFileSync(join(ROOT, p), 'utf8'); const m = /"hotstartFrom":"([0-9a-f]{8,})"/.exec(t); return m ? m[1] : ''; } catch (e) { return ''; }
}

/* ---- 时刻：产物里嵌的 `"ts":"…"` 是权威；`.bak` 没有 ⇒ 退回文件 mtime（并**如实标来路**）---- */
function prodTs(p) {
  if (!p) return '';
  try { const m = /"ts":"(20\d\d-\d\d-\d\dT[\d:.]+Z?)"/.exec(readFileSync(join(ROOT, p), 'utf8')); return m ? m[1] : ''; } catch (e) { return ''; }
}
function mtimeTs(p) {
  if (!p) return '';
  try { return new Date(statSync(join(ROOT, p)).mtime).toISOString(); } catch (e) { return ''; }
}

const nodes = [];
const needMeasure = new Map();   // 父节点 id → 路径（不在图上、需要进图的那些）
function addNode(idRaw, parentHint, tsHint) {
  const id = ren(idRaw);
  if (!id || nodes.some(n => n.id === id)) return;
  const g = byId[idRaw] || byId[id] || null;
  const parent = parentHint || (g ? ren(g.parent || '') : '');
  const f = catOf(id);
  nodes.push({ id, cat: f, fam: CATS[f][0], famLabel: CATS[f][1], ts: (g && g.ts) || tsHint || '', parent });
  if (parent && !/^wid:/.test(parent) && !plotted.has(parent) && !nodes.some(n => n.id === parent)) {
    const pp = PATHOF[parent] || (byId[parent] && byId[parent].src) || '';
    if (pp) needMeasure.set(parent, pp); else needMeasure.set(parent, '');
  }
}

/* ① 图上已有的 2.0/代 3 行 */
for (const r of coords) {
  if (r.ver !== '2.0' && !/__final$/.test(r.id) && !byId[r.id]) continue;
  const arm = norm(r.id);
  const g = byId[r.id] || byId[arm] || null;
  let parent = g ? ren(g.parent || '') : '';
  /* ⚠ 别名：`BAS-s41__final` 的"g3-lineage 里的父"就是 `BAS-s41` —— 那是**同一枚产物的两个名字**，不是父节点。
   *   ⇒ 别名一律丢掉，改走产物 meta 的 `hotstartFrom`（真起点）。 */
  if (parent === arm || parent === r.id || ren(parent) === arm) parent = '';   // ⑤ 别名（含撞车改名后）不算父边
  if (!parent || true) {                                   // 19 枚没有谱系行 ⇒ 用产物 meta 的 hotstartFrom 回解
    const p = PATHOF[r.id] || PATHOF[arm] || '';
    const w = p ? hotstartWid(p) : '';
    if (w) { const hit = resolveWid(w); parent = hit || 'wid:' + w.slice(0, 12); }
  }
  /* meta 回解这一路绕过了上面那行别名守卫 ⇒ 蒸馏根那枚（WIDEFIX-s7）的 `hotstartFrom` 指向**它自己的输出文件**
   * （蒸馏跑把 seedpack 环境变量指到了同一份产物），回解出来 parent == 自己 ⇒ 图上会画一条"父在自己正上方"的自环。
   * 自父不是父：丢掉并点名（不许静默 —— 页脚那条"自环已剔除"是渲染侧的第二道）。 */
  if (parent === r.id || parent === arm || ren(parent) === arm) {
    console.log('   · 自父剔除：' + r.id + '（meta hotstartFrom 解析回它自己）'); parent = '';
  }
  addNode(r.id, parent, g ? (g.addedAt || '') : '');
}

/* ② sidecar 里那些"父在 2.0 树内、自己没进图"的中间节点（如 KDFULLGA-s13）也一并登记 ⇒ 让链条连得上 */
for (const n of nodes.slice()) if (n.parent && !plotted.has(n.parent)) addNode(n.parent, byId[n.parent] ? byId[n.parent].parent : '', '');

/* ③ **克隆精调的父边要挂到克隆那枚上**：g3-lineage 里写的是 `D4a ← GD3-SWORD（克隆精调）`，
 *   而图上有两枚同名不同物的东西——面板里的 `D4a`（v7 面，wid 5a60c8489990）与 `CLONE-D4a`（v:92，wid 4de326c6c458）。
 *   "克隆精调"这一步的产物是后者 ⇒ 父边交给 CLONE-D4a，面板那枚保持它自己在 1.8 侧的谱系，不许把 v7 点拉进 2.0 树。 */
for (const n of nodes) {
  const m = /^CLONE-(.+)$/.exec(n.id);
  if (!m || n.parent) continue;
  const src = nodes.find(x => x.id === ren(m[1]) && x.parent);
  if (src) { n.parent = src.parent; console.log('  克隆根父边归位：' + n.id + ' ← ' + n.parent + '（原来挂在同名面板枚 ' + src.id + ' 上）'); }
}

/* ---- 时刻（先算，家族编号要用）---- */
const TSO = {}, TSSRC = {};
for (const n of nodes) {
  const p = PATHOF[n.id] || '';
  const emb = prodTs(p);
  const v = emb || n.ts || mtimeTs(p);
  TSO[n.id] = v || '';
  const src = v ? (emb ? '产物内嵌 ts' : n.ts ? '谱系表带的 ts' : '文件 mtime') : '读不出';
  TSSRC[src] = (TSSRC[src] || 0) + 1;
}
/* ⛔ 旧表已有行的枚**一律不出行**（11-05 中午查出第二个病）：viewer 并 sidecar 用的是
 *   `LIN[o.id] = Object.assign({}, LIN[o.id]||{}, o)` ⇒ 同名列**逐键覆盖**，sidecar 里一行 `D4a`
 *   就把 1.8 侧真正的谱系（fam 9 ‖ ts 10-02 ‖ parentOf=Ldemo）盖成了代 3 的那一套，
 *   还给 v7 面的 D4a 接上一条"父=GD3-SWORD"的假血统（时间倒挂才被抓出来）。
 *   sidecar 只管**代 3/2.0 的树**；1.8 的谱系归 `lineage.mjs` 一家说了算。
 *   ⇒ 这一跳必须在**发家族号之前**：编号按"真会出现在图上的那些枚"的最早时刻排，
 *     否则 10-02 的面板 D4a 会把 ROOT 那类拖到 14 号、行序判据照样红（实测过）。 */
const OLD = new Set();
{ const op = join(HERE, 'lineage.tsv');
  if (existsSync(op)) { const ol = readFileSync(op, 'utf8').replace(/\r\n/g, '\n').trim().split('\n'); const oh = ol[0].split('\t'); const oi = oh.indexOf('id');
    for (const l of ol.slice(1)) { const v = l.split('\t')[oi]; if (v) OLD.add(v); } } }
const skipped = nodes.filter(n => OLD.has(n.id));
const outNodes = nodes.filter(n => !OLD.has(n.id));

/* 四类**按各自最早的训出时刻升序**领 14..17（页内自检「家族行序 = 训出时刻同向」的判据，写死号会撞它）。
 *   只给**真有成员出行**的类发号 ⇒ 空类不占号。 */
{
  const earliest = CATS.map(() => Infinity);
  for (const n of outNodes) { const t = Date.parse(TSO[n.id] || ''); if (isFinite(t) && t < earliest[n.cat]) earliest[n.cat] = t; }
  const NUM = {};
  const present = CATS.map((c, i) => i).filter(i => outNodes.some(n => n.cat === i));
  /* 有时刻的类按最早时刻升序在前，**全批读不出时刻的类排最后**（但仍必须拿到号 ⇒ 否则 fam 会留成类别名串） */
  present.sort((a, b) => earliest[a] - earliest[b]).forEach((i, k) => { NUM[i] = 14 + k; });
  for (const n of nodes) if (NUM[n.cat] !== undefined) n.fam = NUM[n.cat];
  console.log('家族编号（真出行的类按最早训出时刻升序领号）：' + present.map(i =>
    NUM[i] + '=' + CATS[i][0] + '（' + (isFinite(earliest[i]) ? new Date(earliest[i]).toISOString().slice(5, 10) : '时刻读不出') + ' ‖ ' +
    outNodes.filter(n => n.cat === i).length + ' 枚）').join(' ‖ ') +
    ' ‖ 空类不发号：' + (CATS.map((c, i) => present.includes(i) ? null : c[0]).filter(Boolean).join(' ') || '无'));
}

if (WRITE) {
  /* 列名与旧表**逐字对齐**（11-05 中午查出来的病根）：viewer 画父边读的是 `parentOf`（图上的枚名），
   *   不是 `parent`（旧表里那一列放的是父的**权重 id**）。ZCode 的 sidecar 只写了 `parent` ⇒
   *   `pof` 全空 ⇒ 2.0 点在图上**一枚父边都没有**（用户："很多点也纯孤立的放，也没有连父边"）。
   *   ⚠ `parentOf` 只许填**已在并集表上**的父：页内那条「不许有任何父边指向图上不存在的枚」当场会红（§E378 实测 57 条）。
   *   ⚠ 时间倒挂（父的 ts 晚于本枚）⇒ 退回 parentOf=''、parentSrc='demoted-time'，与 lineage.mjs §E367 同一条规矩。 */
  const head = ['id', 'fam', 'famLabel', 'ts', 'metaSeed', 'nameSeed', 'parent', 'parentOf', 'parentName', 'wid', 'parentSrc', 'tsSrc'];
  let nEdge = 0, nOff = 0, nBack = 0;
  console.log('  旧表已有行 ⇒ sidecar 不出行（防覆盖 1.8 谱系）：' + (skipped.length ? skipped.map(n => n.id).join(' ') : '无'));
  const body = outNodes.map(n => {
    const p = PATHOF[n.id] || '';
    const par = n.parent || '';
    const inGraph = par && plotted.has(par);
    const back = inGraph && TSO[n.id] && TSO[par] && Date.parse(TSO[par]) > Date.parse(TSO[n.id]);
    let pof = '', psrc = '';
    if (par && inGraph && !back) { pof = par; psrc = 'arm'; nEdge++; }
    else if (par && inGraph && back) { psrc = 'demoted-time'; nBack++; }
    else if (par) { nOff++; }
    const seedM = /-s(\d+)$/.exec(n.id);
    return [n.id, n.fam, n.famLabel, TSO[n.id] || '', '', seedM ? 's' + seedM[1] : '', par, pof, pof, p ? widOf(p) : '', psrc, TSO[n.id] ? (prodTs(p) ? 'product' : 'mtime') : '']
      .join('\t');
  });
  writeFileSync(join(HERE, 'lineage-g3.tsv'), [head.join('\t')].concat(body).join('\n') + '\n');
  console.log('  父边可画（写进 parentOf，页内真会画线）：' + nEdge + ' 枚 ‖ 父不在并集表上（只能留名字）' + nOff + ' ‖ 时间倒挂退回 ' + nBack);
  console.log('  时刻来路：' + Object.entries(TSSRC).map(([k, v]) => k + ' ' + v).join(' ‖ '));
}
const famCount = {}; for (const n of nodes) famCount[n.fam] = (famCount[n.fam] || 0) + 1;
console.log('生成 lineage-g3.tsv：节点 ' + nodes.length + ' ‖ 家族 ' + Object.keys(famCount).sort().map(k => k + ':' + famCount[k]).join(' ‖ '));
console.log('父边按 parent 计（还没过时间守卫，上面的"可画"才是写进 parentOf 的数）：有父的 ' +
  nodes.filter(n => n.parent).length + ' 枚里，父已在图上 ' +
  nodes.filter(n => n.parent && plotted.has(n.parent)).length + ' ‖ 父**不在图上**（要测要进图）' + needMeasure.size + ' 枚');
console.log('  待进图的父节点：' + [...needMeasure.entries()].map(([k, v]) => k + (v ? '' : '（找不到产物）')).slice(0, 20).join(' ‖ '));
const unresolved = nodes.filter(n => /(^|,)wid:|wid:/.test(n.parent) || (n.parent && !byId[n.parent] && !PATHOF[n.parent] && !/^wid:/.test(n.parent) === false && false));
console.log('  起点只拿到权重 id、名字回解不到的：' + nodes.filter(n => /^wid:/.test(n.parent)).map(n => n.id + '←' + n.parent).join(' ‖ ') || '无');
