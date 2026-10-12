/* pool-sync.mjs —— 把演化图的**池层**同步到真源 `champion-map/pool-members.tsv`（§E599 · 用户 10-12）
 *
 * 病（用户原话）：「现在演化图的分带问题，现在还挂着旧冠军池」—— 图是**烘焙期**从池表抄进去的
 *   （`viewer.mjs` 读 `pool-members.tsv` ⇒ 写进内联 `var DATA` 的每节点 `pt` 字段），
 *   池表一改（`tools/pool-add.mjs` 写）**图就落后**，而没有任何东西会提醒 ⇒ 本仓已手工重烘多次。
 *
 * 用法：
 *   node champion-map/pool-sync.mjs            # 漂移就重烘 + 回读复核（默认）
 *   node champion-map/pool-sync.mjs --check    # 只报漂移、不写盘；有漂移 ⇒ exit 1（给门用）
 *   node champion-map/pool-sync.mjs --quiet    # 少印字（给钩子用）
 *   --chart=<路径> --table=<路径>              # 覆盖读入点（正对照/测试用）
 *
 * 判据（逐枚点名，不是只比个数）：新增（表里有、图里没标池）‖ 移除（图里标了、表里没有）‖ 换带（pt 不同）。
 * 复核：写完**必须回读**再比一次（不信"我写了"这条自述）；回读仍漂移 ⇒ exit 2。
 * 退出码：0 = 一致（或已同步）‖ 1 = `--check` 下检测到漂移 ‖ 2 = 写/复核失败或输入不齐。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes('--' + k);
/* 路径口径与 `seat-rule.mjs` 的 `resolve()` 同族：带盘符（`C:/…`）或前导 `/` 视为**绝对路径**，
 * 不再无条件 join（本仓今晚第三次撞这一类：`--seat=`/`--in=`/`--chart=` 都栽在"多拼了一层"上）。 */
const abs = p => (p.indexOf(':') >= 0 || p[0] === '/' || /^[A-Za-z]:[\/\\]/.test(p)) ? p : join(ROOT, p);
const TABLE = abs(arg('table', 'champion-map/pool-members.tsv'));
const CHART = abs(arg('chart', 'champion-map/index.html'));
const CHECK = has('check'), QUIET = has('quiet');
const say = m => { if (!QUIET) console.log(m); };

/* ---- 真源：id → 带 ---- */
if (!existsSync(TABLE)) { console.error('⛔ 池真源不在：' + TABLE); process.exit(2); }
const TL = readFileSync(TABLE, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const TH = TL[0].split('\t'), ti = TH.indexOf('id'), tt = TH.indexOf('tier');
if (ti < 0 || tt < 0) { console.error('⛔ 池表缺 id/tier 列'); process.exit(2); }
const live = new Map();
for (const l of TL.slice(1)) { const c = l.split('\t'); if (c[ti]) live.set(c[ti], c[tt] || ''); }

/* ---- 图：内联 DATA 里每个节点的 id → pt ---- */
if (!existsSync(CHART)) { console.error('⛔ 图不在：' + CHART); process.exit(2); }
const html = readFileSync(CHART, 'utf8');
function dataSlice(src) {
  const at = src.indexOf('var DATA = [');
  if (at < 0) return null;
  let i = src.indexOf('[', at), depth = 0, inStr = false, esc = false;
  for (let p = i; p < src.length; p++) {
    const ch = src[p];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return src.slice(i, p + 1); }
  }
  return null;
}
const rawData = dataSlice(html);
if (!rawData) { console.error('⛔ 图里找不到 `var DATA = [...]`（模板改了就同步不了 ⇒ 响亮失败，不许静默）'); process.exit(2); }
let nodes;
try { nodes = JSON.parse(rawData); } catch (e) { console.error('⛔ 内联 DATA 解不出 JSON：' + e.message); process.exit(2); }
const chart = new Map();
for (const n of nodes) if (n && n.id != null) chart.set(n.id, n.pt || '');

/* ---- 逐枚比 ---- */
function diff(liveM, chartM) {
  const added = [], removed = [], moved = [], absent = [];
  for (const [id, tier] of liveM) {
    if (!chartM.has(id)) { absent.push(id); continue; }
    const p = chartM.get(id);
    if (!p) added.push([id, tier]);
    else if (p !== tier) moved.push([id, p, tier]);
  }
  for (const [id, p] of chartM) if (p && !liveM.has(id)) removed.push([id, p]);
  return { added, removed, moved, absent, nDrift: added.length + removed.length + moved.length };
}
const before = diff(live, chart);
const fmt = d => '新增 ' + d.added.length + ' 枚' + (d.added.length ? '（' + d.added.slice(0, 6).map(x => x[0] + '→' + x[1]).join(' ') + (d.added.length > 6 ? ' …' : '') + '）' : '')
  + ' ‖ 移除 ' + d.removed.length + (d.removed.length ? '（' + d.removed.slice(0, 6).map(x => x[0] + '(' + x[1] + ')').join(' ') + '）' : '')
  + ' ‖ 换带 ' + d.moved.length + (d.moved.length ? '（' + d.moved.slice(0, 6).map(x => x[0] + ' ' + x[1] + '→' + x[2]).join(' ') + '）' : '');
say('池真源 ' + live.size + ' 枚 ‖ 图里标了池的 ' + [...chart.values()].filter(Boolean).length + ' 枚 ⇒ ' + fmt(before));
if (before.absent.length) say('⚠ 池成员不在图的节点里（' + before.absent.length + ' 枚）：' + before.absent.slice(0, 8).join(' ') + (before.absent.length > 8 ? ' …' : ''));

if (CHECK) {
  if (before.nDrift) { console.log('⛔ 图落后于池真源 ⇒ 跑 `node champion-map/pool-sync.mjs` 同步'); process.exit(1); }
  say('✔ 图与池真源一致（' + live.size + ' 枚逐枚核过）'); process.exit(0);
}
if (!before.nDrift) { say('✔ 无需同步（逐枚一致）'); process.exit(0); }

/* ---- 重烘 + 回读复核 ---- */
const OUT = arg('out', 'index.html');                       /* viewer 的 `--out` 按 champion-map/ 解析 */
const bak = CHART + '.bak';
copyFileSync(CHART, bak);
say('重烘中：node champion-map/viewer.mjs --out=' + OUT + '（原图备份 ' + bak + '）');
try { execFileSync(process.execPath, [join(HERE, 'viewer.mjs'), '--out=' + OUT], { cwd: ROOT, stdio: QUIET ? 'pipe' : 'inherit' }); }
catch (e) { console.error('⛔ 烘焙失败：' + e.message + '（原图已备份在 ' + bak + '）'); process.exit(2); }

const html2 = readFileSync(CHART, 'utf8');
const raw2 = dataSlice(html2);
let nodes2; try { nodes2 = JSON.parse(raw2); } catch (e) { console.error('⛔ 复核时内联 DATA 解不出：' + e.message); process.exit(2); }
const chart2 = new Map(); for (const n of nodes2) if (n && n.id != null) chart2.set(n.id, n.pt || '');
const after = diff(live, chart2);
if (after.nDrift) { console.error('⛔ **写完了但回读仍漂移**（不许信自述）：' + fmt(after)); process.exit(2); }
say('✔ 已同步并回读复核通过：' + live.size + ' 枚逐枚一致（本次修掉 ' + fmt(before) + '）');
