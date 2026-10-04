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
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, '..', 'docs', 'artifacts');
const SURVEY = process.argv.includes('--survey');

const ids = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]);

/* META 是包文件顶部一行 `.EPIRUS_CHAMPION_3P_META = {...}`；有些字段是**被字符串再包一层**的 JSON
 *   （ecoOverride / ecoEffective / fightEffective 都是字符串）⇒ 要二次 parse，否则整个字段全成"一个超长字符串"。 */
function braceObj(txt, from) {
  const a = txt.indexOf('{', from); if (a < 0) return null;
  let depth = 0, end = -1, inS = false, esc = false;
  for (let j = a; j < txt.length; j++) { const c = txt[j];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { end = j; break; } } }
  if (end < 0) return null;
  try { return JSON.parse(txt.slice(a, end + 1)); } catch (e) { return null; }
}
function parseMeta(txt) {
  const i = txt.indexOf('EPIRUS_CHAMPION_3P_META'); if (i < 0) return null;
  const m = braceObj(txt, i); if (!m) return null;
  for (const k of ['ecoOverride', 'ecoEffective', 'fightOverride', 'fightEffective', 'feasibility']) {
    if (typeof m[k] === 'string' && m[k].trim().startsWith('{')) { try { m[k] = JSON.parse(m[k]); } catch (e) { /* 留字符串 */ } } }
  return m;
}
/* 权重身份 = `server/train-server.mjs` 的 `weightsId()`：sha1(JSON.stringify(Array.from(params))) 前 16 位。
 *   它**只哈希权重数组**（源码注释里写着 v1.3.36 的教训：整文件哈希会被 META 的 ts 污染）。
 *   ⇒ 拿它去对 `META.hotstartFrom`，就能把"这枚是从哪一枚长出来的"还原成真正的父子边。*/
function widOf(txt) {
  /* 坑：`EPIRUS_CHAMPION_3P` 同时是 `EPIRUS_CHAMPION_3P_META` 的前缀，而 .bak 里 META 那行**在前面**
   *   ⇒ 直接 indexOf 会拿到 META 对象（它没有 `.a`）⇒ 全部静默返回 null。只认"名字后面紧跟 ="的那一处。 */
  const KEY = 'EPIRUS_CHAMPION_3P';
  for (let k = txt.indexOf(KEY); k >= 0; k = txt.indexOf(KEY, k + 1)) {
    const after = txt.slice(k + KEY.length, k + KEY.length + 4);
    if (!/^\s*=/.test(after)) continue;
    const o = braceObj(txt, k); if (!o || !Array.isArray(o.a)) continue;
    return createHash('sha1').update(JSON.stringify(Array.from(o.a))).digest('hex').slice(0, 16);
  }
  return null;
}
const REC = [];
let nmiss = 0;
for (const id of ids) {
  const p = join(ART, id + '.bak');
  let m = null, wid = null;
  if (existsSync(p)) { const txt = readFileSync(p, 'utf8'); m = parseMeta(txt); wid = widOf(txt); }
  else { const alt = join(HERE, '..', 'js', 'bundled-champion-3p.js');
    if (existsSync(alt)) { const txt = readFileSync(alt, 'utf8'); m = parseMeta(txt); wid = widOf(txt); } }
  if (!m) { nmiss++; REC.push({ id, m: null, wid }); continue; }
  REC.push({ id, m, wid });
}
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
for (const r of REC) { const m = r.m || {};
  const eco = (m.ecoEffective && typeof m.ecoEffective === 'object') ? m.ecoEffective : {};
  const fig = (m.fightEffective && typeof m.fightEffective === 'object') ? m.fightEffective : {};
  const cfg = { divW: norm(eco.divW), divK: norm(eco.divK), divRoleW: norm(eco.divRoleW), divCatW: norm(eco.divCatW),
    stockBonus: norm(eco.stockBonus), hoardPen: norm(eco.hoardPen), eTarget: norm(eco.target), eCap: norm(eco.cap),
    dealW: norm(fig.dealW), firstW: norm(fig.firstW), whistlePen: norm(fig.whistlePen), styleW: norm(m.styleW),
    oppsN: norm(Array.isArray(m.opps) ? m.opps.length : (typeof m.opps === 'string' && m.opps ? m.opps.split(',').filter(Boolean).length : '')),
    seedEmb: norm(m.seedEmbeddedFrom), gens: norm(m.gens), mode: norm(m.mode), rulesFp: norm(m.rulesFingerprint),
    parent: norm(m.hotstartFrom) };
  ROWS.push({ id: r.id, ts: m.ts || '', seed: m.seed, cfg, sig: AXES.map(k => k + '=' + cfg[k]).join('|'),
    parentOf: (m.hotstartFrom && BYWID[m.hotstartFrom]) || '', wid: r.wid || '',
    branch: BRANCH.map(k => k + '=' + cfg[k]).join('|') }); }
const nres = ROWS.filter(r => r.parentOf).length, np = ROWS.filter(r => r.cfg.parent !== '-').length;
console.log('父指针：' + np + ' 枚记了 hotstartFrom ‖ 其中 ' + nres + ' 枚能解析到**具体哪一枚**（' +
  (np ? Math.round(nres / np * 100) : 0) + '%）‖ 解析不出的多是"父是当时的现役冠军、后来被覆写没留档"');
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
const COLS = ['id', 'fam', 'famLabel', 'ts', 'metaSeed', 'nameSeed', 'parent', 'parentOf', 'wid', 'rulesFp', 'divW', 'divK', 'divRoleW', 'divCatW',
  'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW', 'whistlePen', 'styleW', 'eTarget', 'eCap', 'gens', 'mode', 'seedEmb'];
const out = [COLS.join('\t')];
for (const r of ROWS) { const d = FAM[r.id]; if (!d) continue; const c = r.cfg;
  out.push([r.id, d.n, d.label, (r.ts || '').slice(0, 19), r.seed, r.id.replace(/^.*-/, ''), c.parent.slice(0, 8), r.parentOf, r.wid, c.rulesFp, c.divW, c.divK, c.divRoleW, c.divCatW, c.oppsN,
    c.stockBonus, c.hoardPen, c.dealW, c.firstW, c.whistlePen, c.styleW, c.eTarget, c.eCap, c.gens, c.mode, c.seedEmb].join('\t')); }
writeFileSync(join(HERE, 'lineage.tsv'), out.join('\n') + '\n');
console.log('已写 lineage.tsv（' + (out.length - 1) + ' 行 ‖ ' + defs.length + ' 个家族）');
for (const d of defs) console.log('  家族 ' + String(d.n).padStart(2) + '  ' + String(d.g.rs.length).padStart(4) + ' 枚  ' + d.label);

