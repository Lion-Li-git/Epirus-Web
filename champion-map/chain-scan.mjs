/* chain-scan.mjs —— §E328：把"现役冠军的进化链 + 同族其他有数据的包"摊开，并说清哪些**不在这张图上**。
 *
 * 用户 10-05 20:2x 的原话：「我想看能不能至少把现役的进化链相关的冠军以及同族其他有数据的冠军放到演化图里，
 *   并且现役好像有后续的一些训练结果只不过都不如现役所以没上，你也看一下」
 *
 * 血统的承载量不是包名（§E304 已证：包名尾数 = RNG seed），而是 META 里这三样：
 *   ① `hotstartFrom`        —— 父指针（父包的**权重哈希**）
 *   ② `seedEmbeddedFrom`    —— 另一种嵌入来源
 *   ③ `recipe.env.EPIRUS_SEEDPACK` / `EPIRUS_HOTSTART` —— 白名单写法：直接给**文件路径**（现役那颗就是这么来的：
 *      `recipe.env.EPIRUS_SEEDPACK = docs/artifacts/E51-t8-713.bak`，而它的 `hotstartFrom` 字段**是空的**）
 *   ⇒ 只按 ① 找子代会漏掉 ③ 这一路，所以两条都查（这是本工具存在的主要理由）。
 *
 * 身份哈希与 META 解析一律 import `./pack-id.mjs`（**单一来源**，与 `lineage.mjs` 共用同一份实现；
 *   §E312 那条"复刻仪器要搬代码，别照记忆重写"在这里同样成立）。
 *
 * 用法：node champion-map/chain-scan.mjs [--pack=js/bundled-champion-3p.js] [--up=8] [--dirs=docs/artifacts] [--verbose]
 *   ⚠ 递归扫盘只读**文件头 8KB** 取 META（全库 2837 枚 .bak，整读要 300+MB）；只有链上那几枚才做全量哈希。
 */
import { readFileSync, readdirSync, existsSync, statSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMeta, widOf } from './pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const UP = Number(arg('up', 8));
const DIRS = String(arg('dirs', 'docs/artifacts')).split(',');
const VERBOSE = process.argv.includes('--verbose');
const EMIT = arg('emit', '');   // --emit=_e328-descendants.tsv ⇒ 落到 champion-map/ 下（入库当证据，别只留本机）

/* 图上的面板：`coords.tsv` 的 id 列 **+** `lineage.tsv` 的 `wid` 列。
 *   ⚠ 只按 id 匹配会**假报缺**：现役在盘上叫 `bundled-champion-3p.js`、META.arm = `Ldemo`、源文件名 `win-Ldemo.bak`，
 *     而在图上那一行叫 **`SHIPPED-Ldemo`**（§E313 起有 `SHIPPED-3P → SHIPPED-Ldemo` 这层别名）⇒ 三个名字都不是 `Ldemo`。
 *     所以图上身份要靠**权重哈希**，不是靠名字。 */
const ONMAP = new Set(readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]));
const WIDONMAP = new Map();
{
  const lp = join(HERE, 'lineage.tsv');
  if (existsSync(lp)) {
    const L = readFileSync(lp, 'utf8').trim().split('\n'); const h = L[0].split('\t'); const wi = h.indexOf('wid'), ii = h.indexOf('id');
    if (wi < 0 || ii < 0) { console.error('⛔ lineage.tsv 的表头里没有 id/wid 两列 ⇒ 图上身份没法按哈希核（表头：' + L[0] + '）'); process.exit(2); }
    for (const l of L.slice(1)) { const c = l.split('\t'); if (c[wi] && c[wi] !== '-' && !WIDONMAP.has(c[wi])) WIDONMAP.set(c[wi], c[ii]); }
  } else console.warn('⚠ lineage.tsv 不在 ⇒ 只能按 id 判"在不在图上"（会假报缺）');
}
function onMap(id, wid) { return ONMAP.has(id) || ONMAP.has('SHIPPED-' + id) || !!(wid && WIDONMAP.has(wid)); }
function mapName(id, wid) { const w = wid && WIDONMAP.get(wid); return ONMAP.has(id) ? id : (w ? w : (ONMAP.has('SHIPPED-' + id) ? 'SHIPPED-' + id : '')); }

function headTxt(p, n) {
  let fd; try { fd = openSync(p, 'r'); } catch (e) { return null; }
  try { const buf = Buffer.alloc(n); const got = readSync(fd, buf, 0, n, 0); return buf.slice(0, got).toString('utf8'); }
  catch (e) { return null; } finally { closeSync(fd); }
}
function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    let st; try { st = statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.bak') || f.endsWith('.js')) out.push(p);
  }
  return out;
}
const FILES = [];
for (const d of DIRS) walk(join(ROOT, d), FILES);
/* `js/bundled-champion-3p.js` 本身也要能当链上的一枚（现役就住在这） */
if (!FILES.some(f => f.endsWith(PACK.replace(/\//g, '\\').replace(/\\/g, '/')))) FILES.push(join(ROOT, PACK.split('/').join('/')));

const REC = [];
for (const p of FILES) {
  const head = headTxt(p, 8192); if (!head) continue;
  const m = parseMeta(head); if (!m) continue;
  const id = basename(p).replace(/\.bak$/, '').replace(/\.js$/, '');
  const rEnv = (m.recipe && m.recipe.env) || {};
  REC.push({ p, id, rel: p.slice(ROOT.length + 1).replace(/\\/g, '/'), m,
    parent: m.hotstartFrom || '', emb: m.seedEmbeddedFrom || '',
    seedpack: rEnv.EPIRUS_SEEDPACK || '', ts: m.ts || '', gens: m.gens, mode: m.mode,
    fp: m.rulesFingerprint || '', exam: (typeof m.examScoreAtBuild === 'number' ? m.examScoreAtBuild :
      (typeof m.firstRate === 'number' ? m.firstRate : null)), name: m.arm || (m.recipe && m.recipe.arm) || id });
}

const rootPath = join(ROOT, PACK.split('/').join('/'));
const rootTxt = readFileSync(rootPath, 'utf8');
const ROOTWID = widOf(rootTxt);
const RM = parseMeta(rootTxt);
if (!ROOTWID) { console.error('⛔ 算不出 ' + PACK + ' 的权重身份 ⇒ 链无从锚定'); process.exit(2); }

/* ① 往上走父链：靠 hotstartFrom（若为空则退到 recipe.env.EPIRUS_SEEDPACK 的文件名） */
/* 父指针是**权重哈希** ⇒ 要一张 wid→文件 的表。整读全库太贵（2837 枚 × 110KB），
 *   所以只对**顶层 `docs/artifacts`**（臂产物与冠军 .bak 都在这，1461 枚）做全量哈希 —— 与 `lineage.mjs` 同一套做法。
 *   子目录里那些是实验带内候选，父链几乎不指向它们；真查无会响亮印出来，不静默。 */
const BYWID = {}, BYNAME = {};
{
  const top = join(ROOT, 'docs', 'artifacts');
  if (existsSync(top)) for (const f of readdirSync(top)) {
    if (!f.endsWith('.bak') && !f.endsWith('.js')) continue;
    const p = join(top, f); let txt; try { txt = readFileSync(p, 'utf8'); } catch (e) { continue; }
    const w = widOf(txt); if (w && !BYWID[w]) BYWID[w] = { id: basename(f).replace(/\.(bak|js)$/, ''), rel: 'docs/artifacts/' + f };
  }
}
const chain = [{ wid: ROOTWID, id: RM && RM.arm ? RM.arm : basename(PACK), rel: PACK, rec: null }];
function findParentOf(node) {
  /* 节点自身的 wid 只有在**链上**才需要算（一次全量读），所以这里按需算 */
  const rec = REC.find(r => r.rel === node.rel || r.id === node.id);
  let m = rec ? rec.m : null, rel = rec ? rec.rel : node.rel;
  if (!m) { try { m = parseMeta(readFileSync(join(ROOT, node.rel), 'utf8')); } catch (e) { return null; } }
  if (!m) return null;
  const hot = m.hotstartFrom || '';
  const sp = (m.recipe && m.recipe.env && m.recipe.env.EPIRUS_SEEDPACK) || m.seedEmbeddedFrom || '';
  if (hot) return { via: 'hotstartFrom', key: hot, sp };
  if (sp) return { via: 'SEEDPACK', key: String(sp).replace(/^.*\//, '').replace(/\.bak$/, ''), sp };
  /* band-save 的产物**只带** `{source, arm, bandIdx, trainFit, ts}`（`train-3p.mjs:1498` 那一段），
   *   所以 `<ARM>-band<k>.bak` 里没有父指针 —— 它的父信息在**同臂那个产品** `<ARM>.bak` 上。
   *   不接这一跳，链就会在带内候选这一格假断（实测就是这么断的）。 */
  const bm = /^(.*)-band\d+$/.exec(node.id || '');
  if (bm) return { via: 'band→臂', key: bm[1] };
  return null;
}
/* 名字→记录 的索引。⚠ **必须分两层查**：`BYID`（文件名去扩展名）优先，`BYARM`（`META.arm`）只当兜底。
 *   踩过的坑：band-save 的 `<ARM>-band<k>.bak` 里 `META.arm` 写的就是 `<ARM>`（不带 band 后缀），
 *   而 `readdir` 顺序上 `-band1.bak`（`-` = 0x2D）排在 `.bak`（`.` = 0x2E）**前面** ⇒ 只按一张表查会把臂产品**认成带内候选**，
 *   父链于是原地打转（实测就是这么"防环"停住的）。 */
const BYID = {}, BYARM = {};
for (const r of REC) { if (!BYID[r.id]) BYID[r.id] = r; if (r.name && !BYARM[r.name]) BYARM[r.name] = r; }
function byName(k) { return BYID[k] || BYARM[k] || null; }
let cur = { rel: PACK, id: chain[0].id };
for (let d = 0; d < UP; d++) {
  const pa = findParentOf(cur); if (!pa) { console.log('父链在第 ' + (d + 1) + ' 步断（这一枚的 META 里没有 hotstartFrom，也没有 SEEDPACK 路径）'); break; }
  let hit = null;
  if (pa.via === 'hotstartFrom') { const bw = BYWID[pa.key]; hit = bw ? (REC.find(function (r) { return r.rel === bw.rel; }) || { id: bw.id, rel: bw.rel, m: null }) : null; }
  else hit = byName(pa.key);
  if (!hit) { console.log('第 ' + (d + 1) + ' 步的父**查无**（' + pa.via + ' = ' + pa.key + '）⇒ 链到此（这就是"丢主干"那一类）'); break; }
  if (hit.id === cur.id || chain.some(function (c) { return c.id === hit.id; })) { console.log('第 ' + (d + 1) + ' 步回到链上已有的 ' + hit.id + ' ⇒ 停（防环）'); break; }
  chain.push({ id: hit.id, rel: hit.rel, rec: hit, via: pa.via });
  cur = { rel: hit.rel, id: hit.id };
}

/* ② 往下找子代：谁的 hotstartFrom / seedEmbeddedFrom == 链上任一枚的 wid，
 *   或谁的 `recipe.env.EPIRUS_SEEDPACK` **指到链上任一枚的文件**（按子串，不按全名相等 ——
 *   同一枚包在盘上/仓里/图上可能同时叫 `win-Ldemo` ‖ `bundled-champion-3p` ‖ `SHIPPED-Ldemo` ‖ `Ldemo`）。 */
const CHAIN_RELS = new Set(chain.map(c => c.rel));
const CHAIN_KEYS = new Set();
/* §E330 别名 → 链上节点 id。臂级父指针最后要落到"图上的哪一枚"，而链上节点在图上的名字可能换过
 *   （现役在链上叫 `Ldemo`、在图上叫 `SHIPPED-Ldemo`、文件叫 `bundled-champion-3p.js`）⇒ 只存一个名字会接不上。*/
const KEY2ID = {};
for (const c of chain) {
  const add = function (k) { if (k) { CHAIN_KEYS.add(k); if (!KEY2ID[k]) KEY2ID[k] = c.id; } };
  add(c.id);
  add(String(c.rel).replace(/^.*\//, '').replace(/\.(bak|js)$/, ''));
  if (c.rec && c.rec.name) add(c.rec.name);
  if (c.rec && c.rec.m && c.rec.m.shippedAs) { const mm = /docs\/artifacts\/([^\s"']+)/.exec(String(c.rec.m.shippedAs)); if (mm) add(mm[1].replace(/\.bak$/, '')); }
}
const rootKey = basename(PACK).replace(/\.(bak|js)$/, '');
CHAIN_KEYS.add(rootKey); if (!KEY2ID[rootKey]) KEY2ID[rootKey] = chain[0].id;
for (const k of Array.from(CHAIN_KEYS)) if (k && !CHAIN_KEYS.has('SHIPPED-' + k)) { CHAIN_KEYS.add('SHIPPED-' + k); KEY2ID['SHIPPED-' + k] = KEY2ID[k]; }
const chainWids = new Map([[ROOTWID, chain[0].id]]);
const chainWidOf = new Map([[chain[0].id, ROOTWID]]);
for (const c of chain) { try { const w = widOf(readFileSync(join(ROOT, c.rel), 'utf8')); if (w) { chainWids.set(w, c.id); chainWidOf.set(c.id, w); } }
  catch (e) { console.warn('⚠ 链上 ' + c.id + ' 读不动，那一格的父哈希没法当锚：' + e.message); } }
const kids = [];
for (const r of REC) {
  if (CHAIN_RELS.has(r.rel)) continue;
  const byHash = (r.parent && chainWids.get(r.parent)) || (r.emb && chainWids.get(r.emb));
  let byPath = '';
  if (r.seedpack) { const low = String(r.seedpack); for (const k of CHAIN_KEYS) { if (k && low.indexOf(k) >= 0) { byPath = k; break; } } }
  if (byHash || byPath) kids.push({ r, parent: byHash || byPath, parentId: byHash || KEY2ID[byPath] || '',
    via: byHash ? 'hotstartFrom/seedEmb(哈希)' : 'EPIRUS_SEEDPACK(路径)' });
}

console.log('== 锚点：' + PACK + ' ‖ 权重身份 ' + ROOTWID + ' ‖ META.arm=' + (RM && RM.arm ? RM.arm : '(无)') +
  ' ‖ ts=' + (RM && RM.ts ? RM.ts : '(无)') + ' ‖ gens=' + (RM && RM.gens) +
  ' ‖ 在图上=' + (onMap(chain[0].id, ROOTWID) ? '是（那一行叫 ' + mapName(chain[0].id, ROOTWID) + '）' : '否（' + chain[0].id + '）') +
  ' ‖ 别名核过：' + ['Ldemo', 'win-Ldemo', 'SHIPPED-Ldemo', 'bundled-champion-3p'].filter(function (n) { return ONMAP.has(n); }).join('/') + '（无 = 只靠哈希才算命中）');
console.log('扫到带 META 的产物 ' + REC.length + ' 枚（.bak/.js，递归 ' + DIRS.join(',') + '）');
console.log('\n--- ① 父链（往上 ' + UP + ' 步）---');
for (const c of chain) {
  const r = c.rec;
  console.log('  ' + c.id.padEnd(22) + (r && r.m ? ' ts=' + r.ts + ' gens=' + r.gens + ' mode=' + r.mode + ' fp=' + (r.fp || '(无)') : '') +
    '  在图上=' + (onMap(c.id, chainWidOf.get(c.id)) ? '✅ 叫 ' + mapName(c.id, chainWidOf.get(c.id)) : '⛔缺') + (c.via ? '  ←经 ' + c.via : ''));
}
/* 子代的**自然单位是"一支臂"，不是一个文件**：同一支臂会留下 1 枚臂产品 + 6 枚带内候选（`<ARM>-band1..6`），
 *   而且实验期把产物改道进子目录（`EPIRUS_T3P_OUT` / `EPIRUS_BAND_DIR`）⇒ 臂产品常常在 `eNN-out/` 里、band 在顶层。
 *   第一版按"在不在顶层 + 是不是 band"分，把 200 多支臂全归成"副本"、独立臂只剩 4 枚 —— 那是分类错，不是事实。 */
const byArm = new Map();
for (const k of kids) {
  const r = k.r;
  const arm = (r.m && r.m.arm) || (r.name && r.name.replace(/-band\d+$/, '')) || r.id.replace(/-band\d+$/, '');
  if (!byArm.has(arm)) byArm.set(arm, { arm, files: [], product: null, via: k.parent, parentId: '', ts: r.ts, gens: r.gens, exam: null });
  const g = byArm.get(arm);
  if (!g.parentId && k.parentId) g.parentId = k.parentId;   /* §E330 臂级父指针：产物自己没留指针时，同臂的带内候选留了 */
  g.files.push(r);
  const isBand = /-band\d+$/.test(r.id);
  if (!isBand && (!g.product || r.rel.split('/').length < g.product.rel.split('/').length)) g.product = r;
  if (typeof r.exam === 'number' && (g.exam === null || g.exam === undefined)) g.exam = r.exam;
}
const ARMLIST = [...byArm.values()];
const noProduct = ARMLIST.filter(g => !g.product);
console.log('\n--- ② 子代（以现役为种子的**臂**）---');
console.log('文件 ' + kids.length + ' 枚 ‖ 归并成臂 ' + ARMLIST.length + ' 支 ‖ 其中盘上找不到"臂产品"那枚（只剩带内候选/子目录件）的 ' +
  noProduct.length + ' 支');
ARMLIST.sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
for (const g of ARMLIST.slice(-24)) {
  const p = g.product;
  console.log('  ' + g.arm.padEnd(20) + ' ts=' + (g.ts || '').slice(0, 16) + ' 文件=' + String(g.files.length).padStart(3) +
    ' 产品=' + (p ? p.id + '(' + p.rel.split('/').slice(0, -1).join('/') + '/)' : '⛔只剩带内候选') +
    ' gens=' + String(g.gens).padEnd(5) + ' 在册考卷=' + (g.exam === null || g.exam === undefined ? '—' : (g.exam <= 1 ? (g.exam * 100).toFixed(1) : g.exam.toFixed(1))) +
    ' 产品在图上=' + (p ? (onMap(p.id) ? '✅ 叫 ' + mapName(p.id) : '⛔缺') : '—'));
}
console.log('  …（按 ts 只列最近 24 支，全表用 --emit= 落）');
console.log('⚠ "在册考卷"是**各臂自己那棵树**训完时记的数（`examScoreAtBuild`/`firstRate`），跨指纹/跨引擎版本**不可比**（§E312）' +
  ' ⇒ 要与现役并排引，必须在同一棵树上重测。');
const uniq = new Map();
for (const g of ARMLIST) { if (g.product) uniq.set(g.product.rel, g); }
if (EMIT) {
  const lines = ['arm\tts\tfiles\tproductRel\tproductWid\tgens\tmode\tfp\tseedpack\texamRecorded\tonMap\tarmParent'];
  for (const g of ARMLIST) { const p = g.product || { id: '', rel: '', ts: g.ts, gens: g.gens, mode: '', fp: '', seedpack: '', exam: null };
    let w = ''; if (p.rel) { try { w = widOf(readFileSync(join(ROOT, p.rel), 'utf8')); } catch (e) { w = ''; } }
    lines.push([g.arm, g.ts, g.files.length, p.rel, w, p.gens, p.mode || '', p.fp || '', p.seedpack || '',
      (p.exam === null || p.exam === undefined) ? '' : p.exam, p.id ? (onMap(p.id) ? 'yes' : 'no') : 'no-product',
      g.parentId || ''].join('\t')); }
  writeFileSync(join(HERE, EMIT), lines.join('\n') + '\n');
  console.log('已落 ' + EMIT + '（' + ARMLIST.length + ' 行 = 每支臂一行）');
}

const missing = [];
for (const c of chain) if (!onMap(c.id, chainWidOf.get(c.id))) missing.push(c.id);
for (const g of ARMLIST) if (g.product && !onMap(g.product.id)) missing.push(g.product.id);
console.log('\n--- ③ 链上/子代里**不在图**上的（要补进 coords.tsv 的那批）---');
console.log(missing.length ? '  共 ' + missing.length + ' 枚 ⇒ ' + missing.slice(0, 40).join(' ‖ ') + (missing.length > 40 ? ' …' : '')
  : '  （空 ⇒ 链已经全在图上）');
if (VERBOSE) { for (const k of kids) console.log('  full ' + k.r.rel); }
