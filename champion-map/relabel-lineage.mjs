/* relabel-lineage.mjs —— 把 `coords.tsv` 的 `lineage` 列**按解析重标**，不手改、不重排（§E600-A）
 *
 * 为什么不干脆跑 `rebuild-coords.mjs`：那台的五步链里 `ruler-figs` 会**重算力导向布局**（x2/y2/x3/y3/z3 整列挪），
 *   连带把 §E488/§E371 那一族"点落在哪、段里有几枚、面板压住多少"的判据全部改主语 —— 用大改换两格标签不值。
 * 为什么也不直接在 `coords.tsv` 里改那两格：它是派生物，手改一次，下次谁重跑链条就静默冲回来
 *   （`当前线上` 那个值正是这样在 20 张历史 ruler 表里活着的）。
 *
 * 三条规则，其余一律不动：
 *   ① `当前线上` → `历代上槽`         —— 用户裁定③：没有"当前现役"这个身份类别了，锚只剩 hard 带均值
 *   ② 空 且 **面板用自己的名字点过它**（`panelId`/`metaArm`/合成行名）→ `历代上槽` —— 这一条把 `T8-s114` 补进来
 *     （它 10-11 起住在槽里却没身份；同段的 `panelId` 写的是同权重兄弟 `T-s114`，`metaArm` 才是 `T8-s114`）
 *   ③ 有身份但解析说它没上过槽 → **不动，只点名** —— 那是"名册与解析不一致"的账，留给人和门判，不由这台擅自抹
 *   ⚠ `旧槽位冠军` 原样保留：解析也认它在槽上，但图上"旧冠军段排最上面（家族 0）"那条判据读的就是这个类别，
 *     把它并成 `历代上槽` 会重排整张图 —— 那不是这次要动的手。
 *
 * 用法：
 *   node champion-map/relabel-lineage.mjs            # 写盘 + 回读复核
 *   node champion-map/relabel-lineage.mjs --check    # 只报漂移、不写盘；有漂移 ⇒ exit 1（给门用）
 *   node champion-map/relabel-lineage.mjs --dry      # 只印要改什么
 * 退出码：0 = 已一致（或已改完且回读通过）‖ 1 = `--check` 下检测到漂移 ‖ 2 = 写/复核失败或输入不齐
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SI from './slot-identity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const T = join(HERE, 'coords.tsv');
const has = k => process.argv.includes('--' + k);
const CHECK = has('check'), DRY = has('dry');

if (!existsSync(T)) { console.error('⛔ 没有 ' + T); process.exit(2); }
const raw = readFileSync(T, 'utf8');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);
const head = L[0].split('\t');
const iId = head.indexOf('id'), iLin = head.indexOf('lineage');
if (iId < 0 || iLin < 0) { console.error('⛔ coords.tsv 没有 id 或 lineage 列（列头：' + L[0].slice(0, 60) + '）'); process.exit(2); }
const nCol = head.length;

const SID = SI.load( );
if (!SID.segs.length) { console.error('⛔ `slot-timeline.tsv` 读不出任何一段 ⇒ 没法按解析重标（跑 node champion-map/slot-timeline.mjs）'); process.exit(2); }

const to1 = [], to2 = [], rest = [], claims = [];
/* 规则②的收紧（实测前两版分别多标 8 枚/8 枚，都是同权重兄弟名带来的）：
 *   只补 **① 该同权重组里目前一个身份都没有** 且 **② 这行是组代表（`canon(id)===id`）**
 *   且 **③ 面板用自己的名字点过它**（`panelId`/`metaArm`/合成行名 `SLOT-<wid8>`）的行。
 *   为什么必须这样：查看器挑组内代表读的就是"谁带身份"（`viewer.mjs:478-493`），
 *   给 `v7press3-91` 那组再多标一个 `v7ws1-91`，会让那一族的 `fam/ts/par` 静默换主人。 */
const NAMED = {};
for (const s of SID.segs) { if (s.panelId) NAMED[s.panelId] = 1; if (s.metaArm) NAMED[s.metaArm] = 1;
  NAMED['SLOT-' + String(s.wid).slice(0, 8)] = 1; }
const LIN = {};                                          /* 现表里每行的 lineage */
const LINES = [];
for (let i = 1; i < L.length; i++) { if (!L[i].trim()) continue; const c = L[i].split('\t'); LINES[i] = c; LIN[c[iId]] = c[iLin] || ''; }
const groupOf = id => { const cn = SID.canon(id); return (SID.GROUP[cn] && SID.GROUP[cn].length) ? SID.GROUP[cn] : [id]; };
const groupHasLabel = id => groupOf(id).some(x => x !== id && (LIN[x] === '历代上槽' || LIN[x] === '旧槽位冠军' || LIN[x] === '当前线上'));
for (let i = 1; i < LINES.length; i++) {
  const c = LINES[i]; if (!c) continue;
  const id = c[iId], lin = c[iLin] || '';
  if (!id) continue;
  const onSlot = SID.isOnSlot(id);
  /* §E605-A：补身份的条件从"这一格是空的"放宽成"**这一格不是身份类**"。
   *   为什么必须放宽：链子第①步从现测尺表重画，那些表的 `lineage` 列写的是当年那套**非身份**分类（`续训现役` ‖ `融合（权重平均）` …），
   *   而折行之后拿着 `历代上槽` 的那一行别名（`SHIPPED-Ldemo`）已经被第①步按面板的 aliasIds 拦掉 ⇒
   *   `Ldemo`/`T8-s114` 这两枚"解析明明认它们住过槽"的行，格子里剩的是 `续训现役` ⇒ 按旧条件补不进去，
   *   紧接着 attach-kin 按白名单把 `续训现役` 清成空 —— 身份就这么在链子里蒸发（实测产物比在册少 5 枚）。
   *   放宽只动"非身份文本"，白名单里那三类**一概不覆盖**：`历代上槽`/`旧槽位冠军` 的改动仍然一条也没有。 */
  const NOT_IDENTITY = v => !v || (v !== '历代上槽' && v !== '旧槽位冠军' && v !== '当前线上');
  if (lin === '当前线上') to1.push({ i: i, id: id, c: c, to: '历代上槽' });
  else if (NOT_IDENTITY(lin) && (NAMED[id] || SID.isOnSlot(id)) && SID.canon(id) === id && !groupHasLabel(id)) {
    /* §E605-A：判"解析点过它"不能只看 `NAMED`（那是按 timeline 的 panelId/metaArm 与 SLOT-wid8 三个**字面名**建的表），
     *   还有一条解析通道是"段里的 wid 反查到面板行"（`ID_OF_WID`）—— 走那条通道认出来的行不会进 NAMED。
     *   实测：`v7a-35` 解析认它住过槽（onSlot 命中），但 NAMED 里没有这个名字 ⇒ 补不上身份 ⇒ 链子第⑨步差 1 枚（34 ≠ 35）。
     *   权威定义本来就只有一处：`slot-identity` 说它上过槽。所以这里改成 `NAMED[id] || isOnSlot(id)`。 */
    /* 现役与"声明表点过的那几枚"是这次要补的（用户裁定②点名 T8-s114）；
     *   其余的**也是真的住过槽**（旧 `CHAMPS` 手抄名单当年就漏了它们），但补进去会**改动图上的冠军序列**
     *   （多几枚白描边大点 + 家族行）—— 那一刀留给用户裁，这台只把名单如实印出来。 */
    const declared = SID.decl.some(d => SID.canon(d.coordsId) === id) || SID.live.coordsId === id;
    (declared ? to2 : rest).push({ i: i, id: id, c: c, to: '历代上槽' });
  }
  else if ((lin === '历代上槽' || lin === '旧槽位冠军') && !onSlot) claims.push(id + '(' + lin + ')');
}
const ALL = has('all-true');
const CH = to1.concat(to2).concat(ALL ? rest : []);
console.log('lineage 现况：历代上槽 ' + L.slice(1).filter(s => s.trim() && s.split('\t')[iLin] === '历代上槽').length +
  ' ‖ 旧槽位冠军 ' + L.slice(1).filter(s => s.trim() && s.split('\t')[iLin] === '旧槽位冠军').length +
  ' ‖ 当前线上 ' + L.slice(1).filter(s => s.trim() && s.split('\t')[iLin] === '当前线上').length +
  ' ‖ 解析认到的上槽行 ' + SID.onSlot.length + ' 枚');
if (CH.length) CH.forEach(r => console.log('  改：' + r.id + '  [' + (r.c[iLin] || '(空)') + '] → [' + r.to + ']'));
if (rest.length && !ALL) console.log('⚑ 另 ' + rest.length + ' 枚：时间轴说它们也住过槽、名册却没身份（旧 `CHAMPS` 手抄名单漏的）——' +
  '补进去会改动图上冠军序列，**等裁**；要一次补全跑 `--all-true`：' + rest.map(r => r.id).join(' ‖ '));
if (claims.length) console.log('⚠ ③ 类不一致（有身份、解析说没上过槽）' + claims.length + ' 枚，**这台不动它们**：' + claims.join(' ‖ '));
if (!CH.length) console.log('✔ 已一致：没有要改的格');

if (CHECK) { if (CH.length) { console.log('⛔ --check：图侧名册落后于解析（' + CH.length + ' 格）⇒ 跑 `node champion-map/relabel-lineage.mjs`'); process.exit(1); } process.exit(0); }
if (DRY || !CH.length) process.exit(0);

/* ---- 写盘：只动 lineage 那一格，列数与行序一律不变 ---- */
for (const r of CH) { const c = L[r.i].split('\t');
  if (c.length !== nCol) { console.error('⛔ 第 ' + (r.i + 1) + ' 行列数 ' + c.length + ' ≠ 表头 ' + nCol + ' ⇒ 不敢写（这表被人手工加过列？）'); process.exit(2); }
  c[iLin] = r.to; L[r.i] = c.join('\t'); }
const out = L.join(EOL);
const bak = T + '.pre-e600.bak';
/* 先落备份再写正式表：原来这里是 `renameSync` 之后再写 ⇒ 中间有一瞬 `coords.tsv` 不在盘上，
 *   进程要是正好死在那里就丢表。备份文件本来就有就不覆盖（保留第一次的真源）。 */
if (!existsSync(bak)) writeFileSync(bak, raw, 'utf8');
writeFileSync(T, out, 'utf8');

/* ---- 回读复核（不信"我写了"这条自述，同 `pool-sync.mjs` 的纪律）---- */
const back = readFileSync(T, 'utf8').split(/\r?\n/);
if (back.length !== L.length) { console.error('⛔ 回读行数 ' + back.length + ' ≠ 写入 ' + L.length); process.exit(2); }
let still = 0, bad = 0;
for (let i = 1; i < back.length; i++) { if (!back[i].trim()) continue;
  const c = back[i].split('\t'); if (c.length !== nCol) bad++;
  if (c[iLin] === '当前线上') still++; }
if (bad) { console.error('⛔ 回读有 ' + bad + ' 行列数不对 ⇒ 这次写入把表改坏了'); process.exit(2); }
if (still) { console.error('⛔ 回读仍有 ' + still + ' 格写着 `当前线上`'); process.exit(2); }
for (const r of CH) { const c = back[r.i].split('\t');
  if (c[iId] !== r.id) { console.error('⛔ 回读第 ' + (r.i + 1) + ' 行的 id 变成 ' + c[iId] + '（期望 ' + r.id + '）⇒ 行错位，停'); process.exit(2); }
  if (c[iLin] !== r.to) { console.error('⛔ 回读 ' + r.id + ' 的 lineage 不是刚写进去的值'); process.exit(2); } }
console.log('✔ 回读复核过：改 ' + CH.length + ' 格 ‖ `当前线上` 余 0 ‖ 行数 ' + back.length + ' ‖ 每行 ' + nCol + ' 列 ‖ id 逐行对齐');
console.log('（备份在 ' + bak + '，这台不动 git）');
