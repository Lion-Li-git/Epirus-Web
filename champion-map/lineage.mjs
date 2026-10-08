/* lineage.mjs —— §E304：把"家族"从**训练随机种子**换成**训练方法 / 目标的大改**。
 *
 * 为什么必须换（用户 10-05 原话）：「你标记出来的家族是 seed 数字，看起来像是单纯训练过程中随机数的种子，
 *   要是这样就没什么用了」。实测坐实：`coords.tsv` 的 seed 列只有 **14 个取值**（31~36 / 81~82 / 91~96），
 *   而它就是包名尾部那个数 = META 里的 `seed` ⇒ 同一个 seed 被几十上百枚毫不相干的臂复用 ⇒ **它标的是 RNG，不是血统**。
 *
 * 那血统在哪？META 里有三样真东西：
 *   ① `ts`            —— 这枚什么时候训出来的（时间轴）
 *   ② `hotstartFrom`  —— **父指针**：从哪一枚的权重热启动来的（一个哈希）
 *   ③ 目标/方法配置    —— `ecoEffective`/`fightEffective`（divW/divK/stockBonus/hoardPen/dealW/firstW/whistlePen…）
 *                        + `mode`/`n`/`pop`/`gens`/`games`/`opps` 数量 + `rulesFingerprint`（世界版本）
 *
 * 本脚本第一步是**普查**（--survey）：把 717 枚的 META 全读一遍，打印每个字段有多少个不同取值、
 * 哪些字段真的随时间摆过 —— 家族该按哪几根轴分，由这个读数决定，不是我拍脑袋。
 * 第二步（默认）才落 `lineage.tsv`：id → 家族号 + 家族标签 + 父指针 + 时间。
 *
 * 用法：node champion-map/lineage.mjs --survey
 *      node champion-map/lineage.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { braceObj, parseMeta, widOf, packArr, widOfArr } from './pack-id.mjs';
import { sandbox } from '../tools/audit-lib.mjs';   /* §E464 只为拿 embedLegacy：同一枚包的两个身份要按同一条嵌入规则算，不留第二份 */   // §E328：身份三件套搬进单一来源（函数体逐字搬，本文件行为不变）
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ART = join(ROOT, 'docs', 'artifacts');
const SURVEY = process.argv.includes('--survey');

/* ⚠ 读表一律先把 CRLF 归一成 LF：本仓工作树是 CRLF，`split('\n')` 会把**末列**留成带裸 \r 的串
 *   ⇒ `indexOf('path')` 返回 −1（path 恰好就是 coords.tsv 的末列，实测被 git checkout 兜一圈后就是这样）。*/
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const ids = rd(join(HERE, 'coords.tsv')).trim().split('\n').slice(1).map(l => l.split('\t')[0]);

/* `braceObj` / `parseMeta` / `widOf` 住在 `./pack-id.mjs`（§E328 起）—— 那份注释也在那里。 */
/* §E330：**同一个 id 在盘上可以有两份不同的包**，而血统表过去只按 `docs/artifacts/<id>.bak` 找 ⇒ 读错了文件。
 *   实测后果：`M05-111` / `D4a` / `E20-71` 这些"续训现役"的臂产品，真身在 `docs/artifacts/e234-out/…`（ts = 10-02），
 *   而顶层另有一份同名的旧拷贝（ts = 现役那颗的 `2026-09-27T08:55:34`）⇒ 谱系图上 **181 枚子代全叠在同一秒**
 *   （用户 10-05 21:0x：「由现役继续训练的一堆点全重合了」）。
 *   修法不是猜：`coords.tsv` 的 `path` 列（由 `attach-path.mjs` 从现测尺表贴进来）就是量它时真用的文件 ⇒
 *   名单和路径同表同序，下游（本文件、`feas.mjs`）不再各自拼约定路径。 */
const PATHOF = {};
{
  const CL = rd(join(HERE, 'coords.tsv')).trim().split('\n');
  const ch = CL[0].split('\t'), iId = ch.indexOf('id'), iPath = ch.indexOf('path');
  if (iPath < 0) { console.error('⛔ coords.tsv 没有 path 列 ⇒ 先跑 node champion-map/attach-path.mjs'); process.exit(2); }
  for (const l of CL.slice(1)) { const c = l.split('\t'); if (c[iId] && c[iPath]) PATHOF[c[iId]] = c[iPath]; }
  console.log('路径表（coords.tsv 的 path 列）：' + Object.keys(PATHOF).length + ' 条');
}
const REC = [];
let nmiss = 0, nByPath = 0;
for (const id of ids) {
  const rel = PATHOF[id];
  const p = rel ? join(ROOT, rel) : join(ART, id + '.bak');
  if (rel) nByPath++;
  let m = null, wid = null, used = rel || '';
  if (existsSync(p)) { const txt = readFileSync(p, 'utf8'); m = parseMeta(txt); wid = widOf(txt); }
  else if (/bundled-champion-3p\.js$/.test(String(rel || ''))) { const alt = join(HERE, '..', 'js', 'bundled-champion-3p.js');
    /* §E464 这条兜底**只服务"这一行就是现役那颗"**（SHIPPED-Ldemo 的 path 正是这个文件，只是 ROOT 拼法可能落空）。
     *   原来它挂在"任何文件读不到"的分支上：实测把 e370-out（未入库那批 v7 导出）挪走模拟换台机器 ⇒
     *   16 枚旧槽位冠军全部走进这一支，META/wid 被写成**现役那颗**的（d490dc13…）⇒ 谱系表 711 行的家族签名跟着变。
     *   "读不到"就该是读不到，不许拿别人的身份顶上（同一套判据见 §E330「不许凭一条路径凭空造节点」）。*/
    if (existsSync(alt)) { const txt = readFileSync(alt, 'utf8'); m = parseMeta(txt); wid = widOf(txt); used = 'js/bundled-champion-3p.js'; } }
  if (!m) { nmiss++; REC.push({ id, m: null, wid, rel: used }); continue; }
  REC.push({ id, m, wid, rel: used });
}
console.log('按 coords.tsv 的 path 列解析 ' + nByPath + ' 枚 ‖ 其余按 docs/artifacts/<id>.bak 兜底');
console.log('读到 META ' + REC.filter(r => r.m).length + ' / ' + ids.length + ' 枚（缺 ' + nmiss + '）‖ 算出权重身份 ' +
  REC.filter(r => r.wid).length + ' 枚');

/* 普查的字段清单：目标面 + 方法面 + 世界面。数组值取长度，对象值递归一层。 */
const FIELDS = ['source', 'mode', 'n', 'pop', 'gens', 'games', 'workers', 'fresh', 'seedEmbeddedFrom',
  'styleW', 'styleGames', 'rulesFingerprint', 'hotstartFrom', 'seed',
  'oppsN', 'styleOppsN',
  'eco.divW', 'eco.divK', 'eco.divRoleW', 'eco.divCatW', 'eco.stockBonus', 'eco.hoardPen', 'eco.target', 'eco.cap',
  'eco.targetOverride', 'eco.capOverride', 'eco.K_role',
  'fight.dealW', 'fight.firstW', 'fight.whistlePen', 'fight.override',
  'feas.ok', 'feas.G', 'feas.seatVerdict'];
function get(m, path) {
  const seg = path.split('.');
  if (seg[0] === 'oppsN') return Array.isArray(m.opps) ? m.opps.length : (typeof m.opps === 'string' ? m.opps.split(',').filter(Boolean).length : 0);
  if (seg[0] === 'styleOppsN') return typeof m.styleOpps === 'string' ? m.styleOpps.split(',').filter(Boolean).length : 0;
  let v = m; for (const s of seg) { if (v == null) return undefined; v = s === 'eco' ? (v.ecoEffective || v.ecoOverride) : s === 'fight' ? (v.fightEffective || v.fightOverride) : s === 'feas' ? v.feasibility : v[s]; }
  return v;
}
const prof = {};
for (const f of FIELDS) prof[f] = new Map();
for (const r of REC) { if (!r.m) continue;
  for (const f of FIELDS) { let v = get(r.m, f);
    if (v === undefined || v === null) v = '∅';
    else if (typeof v === 'object') v = JSON.stringify(v).slice(0, 24);
    prof[f].set(String(v), (prof[f].get(String(v)) || 0) + 1); } }
if (SURVEY) {
  for (const f of FIELDS) { const s = [...prof[f].entries()].sort((a, b) => b[1] - a[1]);
    console.log(('  ' + f).padEnd(20) + ' 取值数 ' + String(s.length).padStart(4) + ' ‖ ' +
      s.slice(0, 6).map(([k, c]) => k + '×' + c).join('  ')); }
  /* 时间轴：按月/日分桶看 META 的密度，"大改"必然是时间上的一次跳变 */
  const byDay = {};
  for (const r of REC) { if (!r.m || !r.m.ts) continue; const d = String(r.m.ts).slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }
  console.log('\n按日（ts）分布：');
  for (const d of Object.keys(byDay).sort()) console.log('  ' + d + '  ' + String(byDay[d]).padStart(4) + ' 枚  ' + '#'.repeat(Math.min(60, byDay[d])));
  process.exit(0);
}

/* ===== 家族 = **方法/目标配置**的等价类；父指针与规则指纹**不进签名** =====
 * 第一版把 `hotstartFrom` 也放进签名 ⇒ 48 个类、还得并掉 120 枚"零散"，而那 120 枚里 49 枚的配置和
 * 家族 13 一模一样、只是换了个热启动父 ⇒ 说明**父指针是"分支"、不是"家族"**（用户要的是"训练方法或目标大改"）。
 * ⇒ 签名只留目标面 + 方法面；parent / rulesFp 另存成 `branch`，给谱系图当分叉用。
 * 轴的选择全部来自普查（只留"真的摆过"的字段）：
 *   目标面  eco.divW（珠价/多样性权重 0/0.06/0.3/0.6 四档）· divK · divRoleW · divCatW · stockBonus · hoardPen
 *            · target · cap ‖ fight.dealW · firstW · whistlePen ‖ styleW
 *   方法面  oppsN（对手池大小）· seedEmbeddedFrom · gens · mode*/
const AXES = ['divW', 'divK', 'divRoleW', 'divCatW', 'stockBonus', 'hoardPen', 'eTarget', 'eCap',
  'dealW', 'firstW', 'whistlePen', 'styleW', 'oppsN', 'seedEmb', 'gens', 'mode'];
const BRANCH = ['parent', 'rulesFp'];
function norm(v) { if (v === undefined || v === null || v === '' || v === '∅') return '-'; 
  const n = Number(v); return Number.isFinite(n) && String(v) !== '∅' ? (Math.round(n * 1000) / 1000) : String(v); }
const ROWS = [];
/* 权重身份表要扫**全部** .bak（1461 个），不能只扫本图的 718 枚 —— 父指针指向的是"当时的现役冠军"，
 *   而那一枚未必进了 §E287 那批面板。实测只扫 718 枚时解析率 11%，扫全库后（下一行打印）才看得清谱系。*/
let nSlotEmb = 0;
const BYWID = {};
const BYWID_EMB = {};   /* §E464 嵌入成 v7 之后的指纹 → 图上的 id */
let POL = null;
function embOf(arr) { try {
  if (!POL) POL = sandbox().EpirusPolicy;
  const r = POL.embedLegacy(arr); return r ? widOfArr(r) : null;
} catch (e) { return null; } }
const allBak = existsSync(ART) ? readdirSync(ART).filter(f => f.endsWith('.bak')) : [];
for (const f of allBak) { try {
  const txt = readFileSync(join(ART, f), 'utf8'); const arr = packArr(txt);
  const w = widOfArr(arr); if (!w) continue;
  const id = f.slice(0, -4); if (!BYWID[w]) BYWID[w] = id;
} catch (e) { /* 单枚读不动不影响全表 */ } }
for (const r of REC) if (r.wid && !BYWID[r.wid]) BYWID[r.wid] = r.id;
/* §E330 哈希之外还有第二条父指针：`recipe.env.EPIRUS_SEEDPACK` 记的是**文件路径**。
 *   现役那枚（js/bundled-champion-3p.js）走的正是这一条 —— 它**没有** hotstartFrom，实测
 *   `EPIRUS_SEEDPACK = docs/artifacts/E51-t8-713.bak` ⇒ 只按哈希解析时"当前线上"那个点没有父边，
 *   用户因此看不到现役的祖先。而它下面那 182 支臂的产物同样只写了这一条
 *   （`EPIRUS_SEEDPACK = js/bundled-champion-3p.js`）⇒ 图上"子代一堆点没有连线"也是这同一个洞。
 *   ⚠ 路径的**文件名 ≠ 图上的 id**：现役在图上叫 `SHIPPED-Ldemo`，文件却叫 `bundled-champion-3p.js`
 *   ⇒ 退路必须按"这枚在图上是从哪个文件读进来的"反查（`BYBASE`），不能拿文件名当 id 用。
 *   认不出的一律留空 —— 不许凭一条路径凭空造节点（chain-scan 同一套判据）。*/
const WIDOF = {}; for (const r of REC) if (r.wid) WIDOF[r.id] = r.wid;
const IDSET = new Set(REC.map(r => r.id));
const BYBASE = {};
for (const r of REC) { const k = String(r.rel || r.id).replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '');
  if (k && !BYBASE[k]) BYBASE[k] = r.id; if (r.id && !BYBASE[r.id]) BYBASE[r.id] = r.id;
  const a = r.id.replace(/^SHIPPED-/, ''); if (a !== r.id && !BYBASE[a]) BYBASE[a] = r.id; }   /* 链上节点叫 Ldemo、图上叫 SHIPPED-Ldemo */
function seedpackOf(m) { const e = m.recipe && m.recipe.env; const p = e && e.EPIRUS_SEEDPACK;
  if (typeof p !== 'string' || !p) return '';
  const k = p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '');
  return BYBASE[k] || ''; }
/* ===== §E464 pre-v7 包的「第二身份」登记 =====
 * 训练服务记热启动父走的是 `weightsId(loadAny(种子).params)`，也就是**嵌入成 v7 之后**那份数组的指纹
 *   （FEAT_S 123 → 213 ⇒ 数组 3337 → 5689 ⇒ 哈希必变）⇒ 只索引「文件里那份数组」的哈希时，
 *   所有 pre-v7 包对父指针检索都是隐身的，§E314 因此把 585 枚共用的那个父判成「盘上无实体」。
 * 真相 = v1.3.57/58 那枚 = SLOT-e379c62c。但**登记目标必须是面板上真有的那一枚**，两条通道：
 *   ① 文件名能反查到图上节点（BYBASE，含"文件名 ≠ 图上 id"的那些）；
 *   ② 旧槽位冠军行（id = SLOT-<wid8>）：coords.tsv 把那几行的 path 指向 e370-out 的 v7 导出，而那批文件
 *      **没入库**（git ls-files = 0）⇒ 换台机器 clone 下来 BYWID 就没有这一项，584 条父边又会解不出来。
 *      这里改从**已入库的 v6 文件**推：某 .bak 的原始 wid 前 8 位 = 某个 SLOT 行的后缀 ⇒ 它的嵌入后 wid 登记给那一行。
 *      实测链路：champion-5p-v1.3.58.bak（tracked，commit 24b9f63）原始 e379c62ccd2648fa → 嵌入 d13d3c856c6cff62。
 * ⚠ 原来这条登记写在 .bak 扫描循环里、且不筛面板 ⇒ 它把 `d13d3c85…` 先记成了文件名 `champion-5p-v1.3.58`
 *   （图上没有这一枚），SLOT 规则随后一条也登记不到。不闸门上的结果就是"解析出一个不存在的父"。 */
{ const SLOTBY8 = {};
  for (const r of REC) { const m2 = /^SLOT-([0-9a-f]{8})$/.exec(String(r.id || '')); if (m2) SLOTBY8[m2[1]] = r.id; }
  for (const f of allBak) { try {
    const txt = readFileSync(join(ART, f), 'utf8'); const arr = packArr(txt);
    const w = widOfArr(arr); if (!w) continue;
    const rid = BYBASE[f.slice(0, -4)] || SLOTBY8[w.slice(0, 8)]; if (!rid) continue;
    const e = embOf(arr); if (e && e !== w && !BYWID_EMB[e]) { BYWID_EMB[e] = rid; nSlotEmb++; }
  } catch (err) { /* 单枚读不动不影响全表 */ } }
  console.log('§E464 pre-v7 包的第二身份登记：' + nSlotEmb + ' 条（目标一律是面板上真有的节点；SLOT 行走已入库的 v6 文件，不依赖 e370-out 那批未跟踪的 v7 导出）'); }
/* 第三级退路 = **臂级**父指针（`chain-scan --emit=` 落的那张表）。为什么需要：一支臂留 7 个文件
 *   （1 枚产物 + 6 枚带内候选），实测**产物那份常常不带指针、带内候选那份带** ⇒ 只看产物就漏。
 *   臂级证据"这支臂是从 X 起步的"对产物同样成立，所以按 productRel 反查图上的那一枚。
 *   ⚠ 只认**面板上已有的父**（IDSET），表里没有的臂一律不接。*/
const ARMPAR = {};
{ const AP = join(HERE, '_e330-armparent.tsv');
  if (existsSync(AP)) {
    const A = rd(AP).trim().split('\n'), ah = A[0].split('\t');
    const iRel = ah.indexOf('productRel'), iPar = ah.indexOf('armParent');
    const REL2ID = {}; for (const r of REC) if (r.rel) REL2ID[r.rel] = r.id;
    for (const l of A.slice(1)) { const c = l.split('\t'); if (iPar < 0 || !c[iRel] || !c[iPar]) continue;
      const id = REL2ID[c[iRel]], par = BYBASE[c[iPar]] || c[iPar];
      if (id && par !== id && IDSET.has(par)) ARMPAR[id] = par; }
    console.log('臂级父指针表（chain-scan --emit）：' + Object.keys(ARMPAR).length + ' 支臂的产物能反查到图上已有的父');
  } else console.log('提示：没有 _e330-armparent.tsv ⇒ 臂级父指针这一级退路不生效（跑 node champion-map/chain-scan.mjs --emit=_e330-armparent.tsv）'); }
/* §E368 **槽位时间轴**（用户 10-06 23:0x 给的办法：「通过出厂日期 + CHANGELOG 里的记录可以推出当时槽上是谁」）。
 *   `ship-times.tsv` 是 §E338 那台 ship-scan 的产物 —— 它逐提交把 `js/bundled-champion-3p.js` 的内容取出来算权重指纹，
 *   某个 wid **第一次出现**的那条提交 = 那枚真正上槽的时刻 ⇒ 这张表本身就是"槽位由谁住过"的时间轴，不用另建。
 *   ⚠ 时区：表里的 shipWhen 是**提交时间的本地格式（+08）**，而包 META 的 ts 是 **UTC（Z）** ⇒ 显式补 +08:00 再比，
 *     不许拿字符串大小直接比（本仓已四次把 UTC/本地混着当）。 */
const SLOT_TL = [];
{ const sp = join(HERE, 'ship-times.tsv');
  if (existsSync(sp)) { const S = rd(sp).trim().split('\n'), sh = S[0].split('\t');
    const ii = sh.indexOf('id'), iw = sh.indexOf('wid'), iwh = sh.indexOf('shipWhen');
    for (const l of S.slice(1)) { const c = l.split('\t'); if (!c[iw] || !c[iwh]) continue;
      const t = Date.parse(c[iwh].replace(' ', 'T') + '+08:00');
      if (isFinite(t)) SLOT_TL.push({ id: c[ii], wid: c[iw], t: t }); }
    SLOT_TL.sort((a, b) => a.t - b.t); } }
function slotAt(tsStr) { const t = Date.parse(tsStr); if (!isFinite(t) || !SLOT_TL.length) return '';
  let hit = ''; for (const s of SLOT_TL) { if (s.t <= t) hit = s.id; else break; } return hit; }
console.log('槽位时间轴（§E368）：' + SLOT_TL.length + ' 段（最早 ' + (SLOT_TL[0] ? SLOT_TL[0].id : '—')
  + ' ‖ 最晚一段起于 ' + (SLOT_TL.length ? new Date(SLOT_TL[SLOT_TL.length - 1].t).toISOString() : '—') + '）');
let nSpk = 0, nArm = 0;
/* §E367（用户 10-06 22:4x：「e35prod807 比父节点的父节点还要早，太离谱了」）
 *   查出来的真相：**那五条边是假的**。`_e330-armparent.tsv` 里 seed80/seed81/e35prod807/e35prod814/e39ctl911
 *   的 `seedpack` 一律是 **路径** `js/bundled-champion-3p.js`，而 byPath/byArm 这两级退路是拿"这个路径**今天**住的是谁"
 *   反查图上的节点的 ⇒ 于是"当时槽里那份权重（已被覆写、没留档）"被解析成了**现在的槽主 Ldemo**。
 *   实测对不上：现役那份权重 d490dc13 自己 META.ts = 09-27T08:55Z、最早可证的 git 实体 = 提交 3c17e23 @09-27T10:42Z，
 *   而 e35prod807 的 ts = 09-26T06:37Z ⇒ 它不可能热启动自一份**26 小时之后**才产出的权重。
 *   ⇒ 判据（只否**推断级**，不动实录）：父是按路径/臂名推出来的、而那个节点的 ts **晚于**子代 ⇒ 退回"父不可考"，
 *     并且**连那个哈希也不许留**（它是"今天槽主"的哈希，不是当时那份的）。
 *   ⚠ byHash 一级永远不否：那是包自己 META.hotstartFrom 里记的哈希，是实录；那种情况该怀疑的是 ts，不是边。*/
const IDTS = {}; for (const r of REC) IDTS[r.id] = (r.m && r.m.ts) || '';
let nBack = 0, nEmb = 0;
for (const r of REC) { const m = r.m || {};
  const byHash = (m.hotstartFrom && (BYWID[m.hotstartFrom] || BYWID_EMB[m.hotstartFrom])) || '';
  /* §E464 靠「嵌入后那个身份」才对上的单独记一笔（pSrc = hash-emb），不许混在 hash 里看不出来 */
  const byHashEmb = byHash && !BYWID[m.hotstartFrom] ? 1 : 0; if (byHashEmb) nEmb++;
  let byPath = byHash ? '' : seedpackOf(m);
  let byArm = (byHash || byPath) ? '' : (ARMPAR[r.id] || '');
  const parId = byHash || byPath || byArm;
  const parTs = parId ? (IDTS[parId] || '') : '';
  let demoted = '', bySlot = '';
  if (parId && !byHash && parTs && m.ts && parTs > m.ts) {
    /* §E368：这种倒挂几乎一定是"父指针记的是**槽位路径**"被按今天的槽主解析了 ⇒
     *   先按时间轴问一句"它跑的那一刻槽里是谁"，接得回来就接（那才是真父），接不回来才退回不可考。*/
    const alt = slotAt(m.ts);
    if (alt && alt !== parId && IDTS[alt] && IDTS[alt] <= m.ts) bySlot = alt;
    else { demoted = parId; nBack++; }
    byPath = ''; byArm = ''; }
  if (byPath) nSpk++; if (byArm) nArm++;
  /* ===== §E487 融合粒（`tools/soup-pack.mjs` 的产物）：它**天生有两个父** =====
   *   `meta.soup.sources` 是工具自己写进去的实录（每粒来源的 路径 + wid + ts），不是推断 ⇒
   *   第一父走正常的 `parentOf`，第二父走新列 `parentOf2`，图上用**另一种颜色的边**画第二条。
   *   解析只走 wid → 图上节点（`BYWID` / 第二身份 `BYWID_EMB`），**不猜路径、不猜臂名**；
   *   并且吃同一条 §E367 时间闸：父的 ts 晚于子 ⇒ 这条边不许画（融合粒正常总是后生的，红了就说明表错了）。*/
  let sP1 = '', sP2 = '';
  { const src = (m.soup && Array.isArray(m.soup.sources)) ? m.soup.sources : null;
    if (src) { const ids = src.map(s => (s && s.wid && (BYWID[s.wid] || BYWID_EMB[s.wid])) || '');
      sP1 = ids[0] || ''; sP2 = ids.slice(1).find(x => x && x !== sP1) || '';
      const bad = [];
      if (sP1 && IDTS[sP1] && m.ts && Date.parse(IDTS[sP1]) > Date.parse(m.ts)) bad.push(sP1);
      if (sP2 && IDTS[sP2] && m.ts && Date.parse(IDTS[sP2]) > Date.parse(m.ts)) bad.push(sP2);
      if (bad.length) { console.error('⛔ §E487 融合粒 ' + r.id + ' 的父边时间倒挂（' + bad.join(' ‖ ') +
          ' 的 ts 晚于本枚 ' + m.ts + '）⇒ 融合表或 wid 注册错了，不许画成血统'); process.exit(2); }
      if (sP1 && !sP2) console.log('⚠ §E487 ' + r.id + ' 只解析出 1 个父（' + sP1 + '）⇒ 另一粒来源不在图上（融合面板里没登记？）'); } }
  const eco = (m.ecoEffective && typeof m.ecoEffective === 'object') ? m.ecoEffective : {};
  const fig = (m.fightEffective && typeof m.fightEffective === 'object') ? m.fightEffective : {};
  const cfg = { divW: norm(eco.divW), divK: norm(eco.divK), divRoleW: norm(eco.divRoleW), divCatW: norm(eco.divCatW),
    stockBonus: norm(eco.stockBonus), hoardPen: norm(eco.hoardPen), eTarget: norm(eco.target), eCap: norm(eco.cap),
    dealW: norm(fig.dealW), firstW: norm(fig.firstW), whistlePen: norm(fig.whistlePen), styleW: norm(m.styleW),
    oppsN: norm(Array.isArray(m.opps) ? m.opps.length : (typeof m.opps === 'string' && m.opps ? m.opps.split(',').filter(Boolean).length : '')),
    seedEmb: norm(m.seedEmbeddedFrom), gens: norm(m.gens), mode: norm(m.mode), rulesFp: norm(m.rulesFingerprint),
    parent: norm(m.hotstartFrom || WIDOF[byPath || byArm || bySlot] || '') };
  ROWS.push({ id: r.id, ts: m.ts || '', seed: m.seed, cfg, sig: AXES.map(k => k + '=' + cfg[k]).join('|'),
    parentOf: byHash || byPath || byArm || bySlot || sP1, wid: r.wid || '',
    psrc: byHash ? (byHashEmb ? 'hash-emb' : 'hash') : (byPath ? 'seedpack' : (byArm ? 'arm' : (bySlot ? 'slot-at-time' : (sP1 ? 'soup' : (demoted ? 'demoted' : ''))))),
    pof2: sP2, psrc2: sP2 ? 'soup' : '',
    demoted: demoted,
    branch: BRANCH.map(k => k + '=' + cfg[k]).join('|') }); }
const nres = ROWS.filter(r => r.parentOf).length, np = ROWS.filter(r => r.cfg.parent !== '-').length;
/* ===== §E464 钉子：第二身份必须**真的登记成功**，不能只看"今天这张表解得开" =====
 *   为什么不能只验结果：BYWID 优先级高于 BYWID_EMB，而本机恰好有 e370-out 那批**未入库**的 v7 导出 ⇒
 *   两条路同时在，表看不出区别。实测就是这么漏的：`embedLegacy()` 返回 Float64Array、`widOfArr` 当时只收 Array ⇒
 *   第二身份登记 0 条、整条 durable 路自写下就空转过（页面自测照样绿，因为它读的是已生成好的表）。
 *   ⇒ 判据钉的是"durable 那条路本身通不通"：凡是被当父用的旧槽位冠军，都要能从**已入库的 v6 文件**推出第二身份。*/
{ const useSlot = {}, embTo = {};
  for (const r of ROWS) if (/^SLOT-/.test(r.parentOf || '')) useSlot[r.parentOf] = (useSlot[r.parentOf] || 0) + 1;
  for (const k in BYWID_EMB) embTo[BYWID_EMB[k]] = (embTo[BYWID_EMB[k]] || 0) + 1;
  const bad = Object.keys(useSlot).filter(id => !embTo[id]);
  console.log('§E464 钉：被当父用的旧槽位冠军 ' + Object.keys(useSlot).length + ' 枚（合计 '
    + Object.keys(useSlot).reduce((a, k) => a + useSlot[k], 0) + ' 条父边）‖ 第二身份能从已入库文件推出的 '
    + (Object.keys(useSlot).length - bad.length) + ' 枚 ‖ 全靠嵌入解开的边 ' + nEmb + ' 条');
  if (bad.length) { console.error('⛔ §E464 这些旧槽位冠军只剩「未入库的 v7 导出」一条路 ⇒ 换台机器 clone 下来这些父边会全断：'
    + bad.map(id => id + '(' + useSlot[id] + ' 条边)').join(' ') + '\n   先查 embedLegacy 的返回值是不是 array-like、widOfArr 收不收');
    process.exit(2); } }
/* §E367 + §E368：被"路径今天住的是谁"骗出来的父边，逐枚点名它**改接到了谁**（不点名就等于悄悄改了数据）*/
console.log('⭐ §E367/§E368 时间倒挂的**推断级**父指针：按槽位时间轴改接 '
  + ROWS.filter(r => r.psrc === 'slot-at-time').length + ' 枚 ‖ 接不回来、退回"不可考" ' + ROWS.filter(r => r.demoted).length + ' 枚');
for (const r of ROWS) if (r.psrc === 'slot-at-time' || r.demoted)
  console.log('   ' + r.id + ' @' + r.ts + '  原解析=' + (r.demoted || '(见下行)') + ' ⇒ 现父=' + (r.parentOf || '不可考')
    + '（其 ts=' + (IDTS[r.parentOf] || '—') + '）');
console.log('父指针：' + np + ' 枚记了 hotstartFrom ‖ 其中 ' + nres + ' 枚能解析到**具体哪一枚**（' +
  (np ? Math.round(nres / np * 100) : 0) + '%）‖ 解析不出的多是"父是当时的现役冠军、后来被覆写没留档"');
console.log('　§E330 退路解析出的：SEEDPACK 路径 ' + nSpk + ' 枚 ‖ 臂级（同臂带内候选留的指针）' + nArm + ' 枚（这些的产物自己不带任何指针）');
const bySig = new Map();
/* ===== §E466 旧槽位冠军**不参与家族聚类**（用户 10-08 指着图问"怎么有几个后期的点飞到家族 1 去了"）=====
 *   它们不是一次训练产物，是"当时上槽的那枚权重"（16 行的 META 来自 e370-out 的导出，配置字段多半是空的）。
 *   实测混进来的两处代价：
 *   ① SLOT-6ed47e18（ts 09-09）的 16 轴签名与 E59 那批和 BIG 三枚"配置字段全空"的类**逐字相同** ⇒ 被并成一类，
 *      而这一类的 t0 被它拖到 09-09 ⇒ 按 t0 排序时整类排到第 2 行 ⇒ 09-27 / 10-02 的 12 枚显示在"最早那一批"那一行。
 *   ② 另外 15 枚并进"零散实验"，那一行的枚数里有 15 枚根本不是训练产物。
 *   ⇒ 家族号只描述训练家族。这 16 枚**仍然写进表**（584 条父边要以它们为靶），但 fam 一律给 0，
 *      显示交给 viewer 那一行合成家族（§E376 补行 / §E377 放最上面）。 */
const SLOTID = {}; for (const r of ROWS) if (/^SLOT-/.test(r.id)) SLOTID[r.id] = 1;
for (const r of ROWS) { if (SLOTID[r.id]) continue; if (!bySig.has(r.sig)) bySig.set(r.sig, []); bySig.get(r.sig).push(r); }
const groups = [...bySig.entries()].map(([sig, rs]) => ({ sig, rs,
  t0: rs.map(x => x.ts).sort()[0] || '', t1: rs.map(x => x.ts).sort().slice(-1)[0] || '' }))
  .sort((a, b) => (a.t0 < b.t0 ? -1 : a.t0 > b.t0 ? 1 : b.rs.length - a.rs.length));
console.log('方法/目标配置等价类 = ' + groups.length + ' 个（成员数中位 ' +
  groups.map(g => g.rs.length).sort((a, b) => a - b)[groups.length >> 1] + '，最大 ' +
  Math.max.apply(null, groups.map(g => g.rs.length)) + '）');   /* 最大要按成员数取，groups 是按 t0 排的 */
/* 类太多就没法上色：按"成员数 ≥ 6 才独立成家，其余并进『零散实验』"收成可画的规模。*/
const BIG = groups.filter(g => g.rs.length >= 6), SMALL = groups.filter(g => g.rs.length < 6);
console.log('成员 ≥6 的类 ' + BIG.length + ' 个（覆盖 ' + BIG.reduce((s, g) => s + g.rs.length, 0) + ' 枚）‖ 并进零散的 ' + SMALL.length + ' 类 / ' + SMALL.reduce((s, g) => s + g.rs.length, 0) + ' 枚');
let i = 0; const FAM = {};
const defs = BIG.map(g => { i++; return { n: i, g, label: '' }; });
if (SMALL.length) defs.push({ n: i + 1, g: { sig: null, rs: SMALL.flatMap(s => s.rs) }, label: '零散实验（<6 枚的类合并）' });
for (const d of defs) for (const r of d.g.rs) FAM[r.id] = d;
/* 标签：说清"这一家相对上一家改了什么"，而不是把 16 个轴念一遍。*/
const CH = { divW: '珠价 divW', divK: 'divK', divRoleW: '角色多样性权', divCatW: '类别多样性权', stockBonus: '囤珠奖励',
  hoardPen: '囤珠惩罚', eTarget: '经济目标', eCap: '经济上限', dealW: '输出权重', firstW: '先手权重',
  whistlePen: '吹哨惩罚', styleW: '风格权重', oppsN: '对手池', seedEmb: '嵌入种子自', gens: '代数', mode: '桌形',
  rulesFp: '规则指纹', parent: '热启动父' };
let prev = null;
for (const d of defs) { const c = d.g.rs[0].cfg;
  const diff = [];
  if (prev) { for (const k of AXES) if (prev[k] !== c[k]) diff.push(CH[k] + ' ' + prev[k] + '→' + c[k]); }
  else { for (const k of ['divW', 'oppsN']) diff.push(CH[k] + '=' + c[k]); }
  const br = [...new Set(d.g.rs.map(r => r.cfg.parent.slice(0, 8)))];
  d.label = (d.g.sig === null ? '零散实验（<6 枚的类合并）'
    : (diff.length ? diff.join(' · ') : '同上（同配置续跑）')) +
    ' ‖ ' + String(d.g.rs.length) + ' 枚 ‖ ' + String(d.g.t0).slice(5, 10) + '→' + String(d.g.t1).slice(5, 10) +
    ' ‖ 父 ' + br.join(',');
  prev = c; }
/* §E314 → §E464 更正：这里原来写的「无实体」是**错的**，错的是一台仪器的口径。
 *   §E314 那遍穷尽扫过盘上 1461 个 .bak + 593 个可达 blob + 4190 个对象库 blob，逐枚算权重指纹 ⇒ 没找到 `d13d3c85…`。
 *   但它算的是「文件里那份数组」的哈希，而训练服务记父走的是 `weightsId(loadAny(种子).params)`
 *   = **嵌入成 v7 之后**那份数组的指纹（FEAT_S 123→213 ⇒ 3337→5689 ⇒ sha1 必变）⇒ 差的这一层没人补。
 *   补上之后（见上面 BYWID_EMB）：584 枚的父解析到 **SLOT-e379c62c**（v1.3.57，图上一枚真节点，
 *   实体在 `docs/artifacts/champion-5p-v1.3.58.bak`，git 里 4162e86 / 7859c34 两版槽文件都是它）。
 *   仍然成立的那半句：`tools/ring2-run.mjs` 历史上**无条件**把 EPIRUS_BUNDLE_IN 覆写成这一份 BASE
 *   ⇒ 81% 共父不是"演化收敛"，是 runner 每次都拷同一枚。所以这条边要画，但页脚必须说清它是恒拷。
 *   合成节点这套逻辑保留，只服务**真的**解析不到的那几枚（现在剩 17 行）。*/
const SYNTH_NAME = {};
{ const tally = {};
  for (const r of ROWS) { const p = r.cfg.parent; if (p && p !== '-' && !r.parentOf) tally[p] = (tally[p] || 0) + 1; }
  for (const p of Object.keys(tally)) {
    SYNTH_NAME[p] = tally[p] >= 50
      ? 'RUNNER-BASE ' + p.slice(0, 8) + '…（v1.3.58 BASE · runner 恒拷 EPIRUS_BUNDLE_IN 的产物 · ' + tally[p] + ' 枚共指 · **非血统**）'
      : '父未落档 ' + p.slice(0, 8) + '…（' + tally[p] + ' 枚）'; } }
for (const r of ROWS) r.parentName = r.parentOf ? r.parentOf
  : (r.demoted ? '父不可考（父指针记的是**路径** js/bundled-champion-3p.js ⇒ 反查只能查到**今天的槽主**；'
      + '当时的槽主已被覆写没留档。§E367 之前这里被误接成 ' + r.demoted + '）'
      : (SYNTH_NAME[r.cfg.parent] || ''));
const nSynth = ROWS.filter(r => r.parentName && !r.parentOf).length;
console.log('合成父节点：' + Object.keys(SYNTH_NAME).length + ' 个指纹 ‖ 落到 ' + nSynth + ' 枚身上（其中 ' +
  ROWS.filter(r => SYNTH_NAME[r.cfg.parent] && SYNTH_NAME[r.cfg.parent].indexOf('RUNNER-BASE') === 0).length + ' 枚是 runner 覆写那一格）');
const COLS = ['id', 'fam', 'famLabel', 'ts', 'metaSeed', 'nameSeed', 'parent', 'parentOf', 'parentName', 'wid', 'rulesFp', 'divW', 'divK', 'divRoleW', 'divCatW',
  /* §E367 parentSrc 追加在**最后一列**：现有消费者（chain-scan / dups / directions / gapscan / viewer）都按表头取列，
   *   但插到中间会让任何按下标取数的写法静默错位 ⇒ 新列一律往后放。*/
  'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW', 'whistlePen', 'styleW', 'eTarget', 'eCap', 'gens', 'mode', 'seedEmb', 'parentSrc',
  /* §E487 融合粒的第二父：三条新列一律追加在**表尾**（同 §E367 的规矩 —— 插中间会让按下标取数的写法静默错位）*/
  'parentOf2', 'parentName2', 'parentSrc2'];
const SLOTDEF = { n: 0, label: '旧槽位冠军（不参与家族聚类 ‖ 谱系图上那一行由 viewer 合成 ‖ 横轴 = 训出/写盘时刻）' };
const out = [COLS.join('\t')];
for (const r of ROWS) { const d = FAM[r.id] || (SLOTID[r.id] ? SLOTDEF : null); if (!d) continue; const c = r.cfg;
  out.push([r.id, d.n, d.label, (r.ts || '').slice(0, 19), r.seed, r.id.replace(/^.*-/, ''), c.parent.slice(0, 8), r.parentOf, r.parentName, r.wid, c.rulesFp, c.divW, c.divK, c.divRoleW, c.divCatW, c.oppsN,
    c.stockBonus, c.hoardPen, c.dealW, c.firstW, c.whistlePen, c.styleW, c.eTarget, c.eCap, c.gens, c.mode, c.seedEmb, r.psrc || '',
    r.pof2 || '', r.pof2 || '', r.psrc2 || ''].join('\t')); }
writeFileSync(join(HERE, 'lineage.tsv'), out.join('\n') + '\n');
console.log('已写 lineage.tsv（' + (out.length - 1) + ' 行 ‖ ' + defs.length + ' 个家族 ‖ 双父的融合粒 ' +
  ROWS.filter(r => r.pof2).length + ' 枚，第二父边 ' + ROWS.filter(r => r.pof2).length + ' 条）');
for (const d of defs) console.log('  家族 ' + String(d.n).padStart(2) + '  ' + String(d.g.rs.length).padStart(4) + ' 枚  ' + d.label);

