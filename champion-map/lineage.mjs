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
import { braceObj, parseMeta, widOf } from './pack-id.mjs';   // §E328：身份三件套搬进单一来源（函数体逐字搬，本文件行为不变）
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ART = join(ROOT, 'docs', 'artifacts');
const SURVEY = process.argv.includes('--survey');

const ids = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]);

/* `braceObj` / `parseMeta` / `widOf` 住在 `./pack-id.mjs`（§E328 起）—— 那份注释也在那里。 */
/* §E330：**同一个 id 在盘上可以有两份不同的包**，而血统表过去只按 `docs/artifacts/<id>.bak` 找 ⇒ 读错了文件。
 *   实测后果：`M05-111` / `D4a` / `E20-71` 这些"续训现役"的臂产品，真身在 `docs/artifacts/e234-out/…`（ts = 10-02），
 *   而顶层另有一份同名的旧拷贝（ts = 现役那颗的 `2026-09-27T08:55:34`）⇒ 谱系图上 **181 枚子代全叠在同一秒**
 *   （用户 10-05 21:0x：「由现役继续训练的一堆点全重合了」）。
 *   修法不是猜：`coords.tsv` 的 `path` 列（由 `attach-path.mjs` 从现测尺表贴进来）就是量它时真用的文件 ⇒
 *   名单和路径同表同序，下游（本文件、`feas.mjs`）不再各自拼约定路径。 */
const PATHOF = {};
{
  const CL = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n');
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
  else { const alt = join(HERE, '..', 'js', 'bundled-champion-3p.js');
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
const BYWID = {};
const allBak = existsSync(ART) ? readdirSync(ART).filter(f => f.endsWith('.bak')) : [];
for (const f of allBak) { try {
  const w = widOf(readFileSync(join(ART, f), 'utf8')); if (!w) continue;
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
/* 第三级退路 = **臂级**父指针（`chain-scan --emit=` 落的那张表）。为什么需要：一支臂留 7 个文件
 *   （1 枚产物 + 6 枚带内候选），实测**产物那份常常不带指针、带内候选那份带** ⇒ 只看产物就漏。
 *   臂级证据"这支臂是从 X 起步的"对产物同样成立，所以按 productRel 反查图上的那一枚。
 *   ⚠ 只认**面板上已有的父**（IDSET），表里没有的臂一律不接。*/
const ARMPAR = {};
{ const AP = join(HERE, '_e330-armparent.tsv');
  if (existsSync(AP)) {
    const A = readFileSync(AP, 'utf8').trim().split('\n'), ah = A[0].split('\t');
    const iRel = ah.indexOf('productRel'), iPar = ah.indexOf('armParent');
    const REL2ID = {}; for (const r of REC) if (r.rel) REL2ID[r.rel] = r.id;
    for (const l of A.slice(1)) { const c = l.split('\t'); if (iPar < 0 || !c[iRel] || !c[iPar]) continue;
      const id = REL2ID[c[iRel]], par = BYBASE[c[iPar]] || c[iPar];
      if (id && par !== id && IDSET.has(par)) ARMPAR[id] = par; }
    console.log('臂级父指针表（chain-scan --emit）：' + Object.keys(ARMPAR).length + ' 支臂的产物能反查到图上已有的父');
  } else console.log('提示：没有 _e330-armparent.tsv ⇒ 臂级父指针这一级退路不生效（跑 node champion-map/chain-scan.mjs --emit=_e330-armparent.tsv）'); }
let nSpk = 0, nArm = 0;
for (const r of REC) { const m = r.m || {};
  const byHash = (m.hotstartFrom && BYWID[m.hotstartFrom]) || '';
  const byPath = byHash ? '' : seedpackOf(m);
  const byArm = (byHash || byPath) ? '' : (ARMPAR[r.id] || '');
  if (byPath) nSpk++; if (byArm) nArm++;
  const eco = (m.ecoEffective && typeof m.ecoEffective === 'object') ? m.ecoEffective : {};
  const fig = (m.fightEffective && typeof m.fightEffective === 'object') ? m.fightEffective : {};
  const cfg = { divW: norm(eco.divW), divK: norm(eco.divK), divRoleW: norm(eco.divRoleW), divCatW: norm(eco.divCatW),
    stockBonus: norm(eco.stockBonus), hoardPen: norm(eco.hoardPen), eTarget: norm(eco.target), eCap: norm(eco.cap),
    dealW: norm(fig.dealW), firstW: norm(fig.firstW), whistlePen: norm(fig.whistlePen), styleW: norm(m.styleW),
    oppsN: norm(Array.isArray(m.opps) ? m.opps.length : (typeof m.opps === 'string' && m.opps ? m.opps.split(',').filter(Boolean).length : '')),
    seedEmb: norm(m.seedEmbeddedFrom), gens: norm(m.gens), mode: norm(m.mode), rulesFp: norm(m.rulesFingerprint),
    parent: norm(m.hotstartFrom || WIDOF[byPath || byArm] || '') };
  ROWS.push({ id: r.id, ts: m.ts || '', seed: m.seed, cfg, sig: AXES.map(k => k + '=' + cfg[k]).join('|'),
    parentOf: byHash || byPath || byArm, wid: r.wid || '',
    branch: BRANCH.map(k => k + '=' + cfg[k]).join('|') }); }
const nres = ROWS.filter(r => r.parentOf).length, np = ROWS.filter(r => r.cfg.parent !== '-').length;
console.log('父指针：' + np + ' 枚记了 hotstartFrom ‖ 其中 ' + nres + ' 枚能解析到**具体哪一枚**（' +
  (np ? Math.round(nres / np * 100) : 0) + '%）‖ 解析不出的多是"父是当时的现役冠军、后来被覆写没留档"');
console.log('　§E330 退路解析出的：SEEDPACK 路径 ' + nSpk + ' 枚 ‖ 臂级（同臂带内候选留的指针）' + nArm + ' 枚（这些的产物自己不带任何指针）');
const bySig = new Map();
for (const r of ROWS) { if (!bySig.has(r.sig)) bySig.set(r.sig, []); bySig.get(r.sig).push(r); }
const groups = [...bySig.entries()].map(([sig, rs]) => ({ sig, rs,
  t0: rs.map(x => x.ts).sort()[0] || '', t1: rs.map(x => x.ts).sort().slice(-1)[0] || '' }))
  .sort((a, b) => (a.t0 < b.t0 ? -1 : a.t0 > b.t0 ? 1 : b.rs.length - a.rs.length));
console.log('方法/目标配置等价类 = ' + groups.length + ' 个（成员数中位 ' +
  groups.map(g => g.rs.length).sort((a, b) => a - b)[groups.length >> 1] + '，最大 ' + groups[0].rs.length + '）');
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
/* §E314 解析不出的父指针**不许再留成空白**（DS 的收口建议 + 他给的定性）：
 *   585 枚（81%）共用一个父 `d13d3c85…`，而那不是"丢了的血统"—— CHANGELOG.md:6402 已定性：
 *   `tools/ring2-run.mjs:95` **无条件覆写** `EPIRUS_BUNDLE_IN` ⇒ 近期全部臂恒拷同一个 v1.3.58 BASE。
 *   ⇒ 那根星形中心是 **runner 覆写的指纹，不是血统**。今天又把它可能藏身的地方穷尽扫了一遍
 *     （盘上 1461 个 .bak + 全历史可达 blob 593 个 + 整个对象库 4190 个 blob，逐枚算权重指纹）⇒ **无实体**。
 *   所以这里给它一个有名有姓的**合成节点**，而不是让图上继续写"盘上查无该权重"（那句话会让人以为还能找回来）。*/
const SYNTH_NAME = {};
{ const tally = {};
  for (const r of ROWS) { const p = r.cfg.parent; if (p && p !== '-' && !r.parentOf) tally[p] = (tally[p] || 0) + 1; }
  for (const p of Object.keys(tally)) {
    SYNTH_NAME[p] = tally[p] >= 50
      ? 'RUNNER-BASE ' + p.slice(0, 8) + '…（v1.3.58 BASE · runner 恒拷 EPIRUS_BUNDLE_IN 的产物 · ' + tally[p] + ' 枚共指 · **非血统**）'
      : '父未落档 ' + p.slice(0, 8) + '…（' + tally[p] + ' 枚）'; } }
for (const r of ROWS) r.parentName = r.parentOf ? r.parentOf : (SYNTH_NAME[r.cfg.parent] || '');
const nSynth = ROWS.filter(r => r.parentName && !r.parentOf).length;
console.log('合成父节点：' + Object.keys(SYNTH_NAME).length + ' 个指纹 ‖ 落到 ' + nSynth + ' 枚身上（其中 ' +
  ROWS.filter(r => SYNTH_NAME[r.cfg.parent] && SYNTH_NAME[r.cfg.parent].indexOf('RUNNER-BASE') === 0).length + ' 枚是 runner 覆写那一格）');
const COLS = ['id', 'fam', 'famLabel', 'ts', 'metaSeed', 'nameSeed', 'parent', 'parentOf', 'parentName', 'wid', 'rulesFp', 'divW', 'divK', 'divRoleW', 'divCatW',
  'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW', 'whistlePen', 'styleW', 'eTarget', 'eCap', 'gens', 'mode', 'seedEmb'];
const out = [COLS.join('\t')];
for (const r of ROWS) { const d = FAM[r.id]; if (!d) continue; const c = r.cfg;
  out.push([r.id, d.n, d.label, (r.ts || '').slice(0, 19), r.seed, r.id.replace(/^.*-/, ''), c.parent.slice(0, 8), r.parentOf, r.parentName, r.wid, c.rulesFp, c.divW, c.divK, c.divRoleW, c.divCatW, c.oppsN,
    c.stockBonus, c.hoardPen, c.dealW, c.firstW, c.whistlePen, c.styleW, c.eTarget, c.eCap, c.gens, c.mode, c.seedEmb].join('\t')); }
writeFileSync(join(HERE, 'lineage.tsv'), out.join('\n') + '\n');
console.log('已写 lineage.tsv（' + (out.length - 1) + ' 行 ‖ ' + defs.length + ' 个家族）');
for (const d of defs) console.log('  家族 ' + String(d.n).padStart(2) + '  ' + String(d.g.rs.length).padStart(4) + ' 枚  ' + d.label);

