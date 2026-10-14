#!/usr/bin/env node
/* fold-coords.mjs —— 把 `coords.tsv` 从 986 行折成 **794 行**（用户 10-14 裁：(c) 拆行重做）
 *
 * 为什么能折：一台普查实测 794 个不同 path 解出 **794 个不同权重身份**、"同一份权重还有两个物理文件"的组数 = **0**
 *   ⇒ 盘上活着的权重全是主名；多出来那 192 行只是**搭在同一份文件上的名字**（副名），不是另一份权重。
 * 主名怎么定（用户定的规矩 + §E605 加的一层稳定性）：**已经在 HEAD 里当主名的先赢**，
 *   并列时 **最多引用**、再 **最早入库**、再按 id 字典序（不许靠遍历次序）。
 *   加这一层是因为这台现在是 `rebuild-coords` 的第⑧步：引用数是拿当下的仓数的，重跑一次就变一点 ⇒
 *   不加这层，同一份权重的名字会随每次重画在 `Ldemo` / `SHIPPED-Ldemo` 之间抖，而那些**按名字索引面板**的表（timeline ‖ lineage ‖ ship-times）会成片指不到。
 *   入库时刻 = 这个 id **第一次出现在 coords.tsv 的那笔提交**（`git log -S` 现查，不是抄注释里的日期）。
 *   引用数 = 这个 id 在**其它入库文件**里被点到的次数（`git grep` 现数，排除 coords.tsv 与自己那一行）。
 *
 * 三条不许静默的守卫：
 *   ① 身份优先：组里若只有一行带白名单 lineage（历代上槽 / 旧槽位冠军），**它必须当选主名** ——
 *      按"最早入库"挑到别的行会把冠军身份弄丢（`viewer.mjs` 挑组内代表读的就是"谁带身份"）。
 *      组里带身份的行 ≠ 1 且不是 0 ⇒ 停下来点名，不猜。
 *   ② 读数不丢（10-14 白天补严）：原来这一条只比 `H/S`，把副名**其余各列**当空气 ⇒ 实测抓到两处静默丢失：
 *      `Ldemo` 的 `Sc/Scd/Sch`（三格，来自 §E321 那批 10-05 的当选键读数，当年贴在 `SHIPPED-Ldemo` 那一行上）被折掉了 ‖
 *      `eco-34-v7c` 与主名同一份权重、却在 12 个行为列上整体不同（那是 `legacyFrom=6` 那个**规则变体**下的另一次测量，不是第二个名字）。
 *      ⇒ 现在分三类处理：**几何列**（`rank` ‖ `x2 y2 x3 y3 z3` ‖ `xt yt xt3 yt3 zt3`）按用户裁定不搬（同权重只算一枚，位置就是主名那一点）；
 *      **主名空着、副名有值** ⇒ 搬上去并逐格点名；**两边都有值且不同** ⇒ 不猜，原样落到副名表新增的 `aliasDiff` 列。
 *   ③ 折完必须是 `行数 == 不同 path 数`，且列数与列序一字不动（只在尾部加 `aliasN`/`aliasIds` 两列）。
 *
 * 用法：node champion-map/fold-coords.mjs [--dry] [--check]
 * 退出码：0 成（或 --dry 算完）‖ 2 守卫不过 / 输入不齐（不写盘）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CO = join(HERE, 'coords.tsv'), AL = join(HERE, 'coords-aliases.tsv');
const DRY = process.argv.includes('--dry'), CHECK = process.argv.includes('--check');
/* ⚠ 本班实测出来的拦路石（10-14 07:3x）：**192 个副名全部**在别的在册表里被当键用
 *   （`ship-times.tsv` ‖ `slot-timeline.tsv` ‖ `slot-history.tsv` ‖ `lineage.tsv` ‖ `feas-s4.tsv` ‖
 *    `epsfull120-2026-10-10.tsv` ‖ `epsfull-tier-2026-10-12.tsv` ‖ `ruler120-2026-10-10-all.tsv` ‖ `point-data.tsv`）。
 *   只折 `coords.tsv` 而不让那几台**按名字索引**的消费者认副名表，构建当场现形：
 *   `上线时刻走解析：48 枚在册 → 33` ‖ `解析认它没进过槽 0 → 15` ‖ `版本号从提交标题认回 46 行 → 31 行` ‖
 *   `内联 986 枚 … ‖ 活槽现主(解析) T-s114 在图上=⛔没了`。
 *   ⇒ 所以它默认**拒绝写盘**；要真跑（意味着同时改 slot-identity / ship-scan 对账 / 那几张键表）必须显式带
 *   `--i-resolved-consumers`。这不是装饰性护栏：这是一台会动全页面键的机器。 */
const ALLOW = process.argv.includes('--i-resolved-consumers');
if (!ALLOW && !DRY && !CHECK) {
  console.error('⛔ 不敢写：折行会把 192 个"被别的在册表当键用"的名字从 coords.tsv 上摘掉（实测症状见本文件头部那段）。\n' +
    '   先让按名字索引的消费者认 `coords-aliases.tsv`（slot-identity ‖ ship-scan 对账 ‖ viewer §E440/上线时刻那两条），\n' +
    '   或者接受只折"零键"那部分（实测 0 行可折）。\n' +
    '   已经处理完消费者、确实要写：加 `--i-resolved-consumers`。只想看判据：`--dry`。');
  process.exit(2);
}
const LIN = { '历代上槽': 1, '旧槽位冠军': 1 };
/* 守卫② 的三类列（10-14 白天补）：**几何列**按"同权重只算一枚"归主名，不搬；
 *   `lineage` 走上面的 UNION；`dupN/dupOf/aliasN/aliasIds` 是这台自己写的 ⇒ 不参与比较。
 *   其余都是**测量列**：主名空着而副名有值 ⇒ 搬；两边都有值且不同 ⇒ 不猜，落到副名表的 `aliasDiff`。 */
const GEO = { rank: 1, x2: 1, y2: 1, x3: 1, y3: 1, z3: 1, xt: 1, yt: 1, xt3: 1, yt3: 1, zt3: 1 };
const SELF = { id: 1, lineage: 1, dupN: 1, dupOf: 1, aliasN: 1, aliasIds: 1 };

const raw = readFileSync(CO, 'utf8');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);
while (L.length && L[L.length - 1].trim() === '') L.pop();      // 只剥行尾空行，不 trim 正文（§E303 那课：末行的空单元格会被连着制表符削掉）
const head = L[0].split('\t'), H = Object.fromEntries(head.map((c, i) => [c, i]));
for (const need of ['id', 'path', 'lineage', 'H', 'S', 'seed', 'examG', 'dupN', 'dupOf']) {
  if (H[need] === undefined) { console.error('⛔ coords.tsv 没有 ' + need + ' 列 ⇒ 输入不是预期那张表'); process.exit(2); }
}
const rows = L.slice(1).filter(r => r.trim()).map(r => r.split('\t'));
const bad = rows.filter(r => r.length !== head.length);
if (bad.length) { console.error('⛔ ' + bad.length + ' 行宽度 ≠ 表头 ' + head.length + '（列错位，不敢折）'); process.exit(2); }

/* ---------- 1. 按权重身份分组（wid 现算，不信 dupOf 那一列） ---------- */
const G = new Map();
const WID = new Map();                       // 行 → 它的权重身份（副名表要落这一格）
for (const r of rows) {
  const p = (r[H.path] || '').trim();
  const abs = join(ROOT, p);
  if (!p || !existsSync(abs)) { console.error('⛔ 第 ' + (r[H.id] || '?') + ' 行的 path 读不到：' + p + ' ⇒ 折行要求每个身份都能现算 wid'); process.exit(2); }
  const w = widOf(readFileSync(abs, 'utf8'));
  if (!w) { console.error('⛔ ' + r[H.id] + ' 的 ' + p + ' 解不出权重身份 ⇒ 停下（宁可不折，不许把它当独立一行留下）'); process.exit(2); }
  if (!G.has(w)) G.set(w, []); G.get(w).push(r);
  WID.set(r, w);
}
console.log('分组：' + rows.length + ' 行 → ' + G.size + ' 个权重身份 ‖ 多名的组 = ' + [...G.values()].filter(v => v.length > 1).length);
if (CHECK) { console.log('--check：行数 ' + rows.length + ' vs 身份数 ' + G.size + (rows.length === G.size ? '（已折过）' : '（还要折 ' + (rows.length - G.size) + ' 行）')); process.exit(rows.length === G.size ? 0 : 1); }

/* ---------- 2. 主名判据：最早入库 → 最多引用 → id 字典序 ---------- */
const gitTs = id => {
  try {
    const o = execSync('git log --reverse --format=%ct -S"' + id + '" -- champion-map/coords.tsv', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const first = o.trim().split('\n')[0];
    return first ? Number(first) : Infinity;
  } catch (e) { return Infinity; }
};
const refCount = id => {
  /* ⚠ 第一版把参数序写成 `git grep -c -w -- "<id>" -- ":(exclude)…"` ⇒ 排除式被当成**第二个模式** ⇒ 七个名字一律数出 0，
   *   主名判据当场变成空尺（实测：`T-s114` 明明在 lineage.tsv ‖ feas-s4.tsv ‖ epsfull* ‖ CHANGELOG 里被点到）。
   *   正确形状：`-e <模式>` 之后只跟**一个** `--`，后面全是 pathspec。 */
  try {
    const o = execSync('git grep -c -w -e "' + id + '" -- ' +
      '":(exclude)champion-map/coords.tsv" ":(exclude)champion-map/index.html" ":(exclude)champion-map/coords-aliases.tsv"',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    return o.trim().split('\n').reduce((a, l) => a + (Number(l.split(':').pop()) || 0), 0);
  } catch (e) { return 0; }   // git grep 没命中返回非零 ⇒ 0 次引用是真的，不是错
};
const CACHE_T = {}, CACHE_R = {};
const tsOf = id => (CACHE_T[id] !== undefined ? CACHE_T[id] : (CACHE_T[id] = gitTs(id)));
const refOf = id => (CACHE_R[id] !== undefined ? CACHE_R[id] : (CACHE_R[id] = refCount(id)));

const picked = [], warn = [], clash = [], carried = [];
const DIFF = new Map();                       // 副名 id → 与主名不同、且副名表那五列没记到的测量列
const RECD = { H: 1, S: 1, seed: 1, examG: 1, lineage: 1 };   // 副名表已单列记录的，不在 aliasDiff 里重复
/* HEAD 那一版面板：既给"主名不许被重排换掉"当锚，也给副名指针账当结转来源（两件事都要它，所以一次读出来）。 */
const HEADINFO = (function () {
  try {
    const txt = execSync('git show HEAD:champion-map/coords.tsv', { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
    const L = txt.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    const hh = Object.fromEntries(L[0].split('\t').map((c, i) => [c, i]));
    const main = new Set(), prevAlias = {};
    for (const l of L.slice(1)) { const c = l.split('\t'); if (!c[hh.id]) continue;
      main.add(c[hh.id]); prevAlias[c[hh.id]] = String(c[hh.aliasIds] || '').trim().split(/\s+/).filter(Boolean); }
    return { main, prevAlias };
  } catch (e) { console.log('⚠ 读不到 HEAD 的 coords.tsv（干净克隆或仓外跑）⇒ 主名稳定性与副名结转这两层都退回原样'); return { main: new Set(), prevAlias: {}, prevRows: {} }; }
})();
/* 副名表里那些**结转下来的**行（读数/宽列差异都在里面）：从 HEAD 那张账本原样搬，不改一个字节。
 *   不搬的话：面板上指针还在、账本里那一行没了 ⇒ 下次谁问"这个旧名字当年是什么档、H 多少"就没处查（本班上午刚补的 `aliasDiff` 也会一起丢）。 */
const HEADROWS = (function () {
  const out = {};
  try {
    const txt = execSync('git show HEAD:champion-map/coords-aliases.tsv', { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
    const L = txt.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    for (const l of L.slice(1)) { const c = l.split('\t'); if (c[1]) out[c[1]] = l; }
  } catch (e) { /* 没有那张账本（首次折 / 仓外跑）⇒ 结转个空，不响 */ }
  return out;
})();
/* §E605（10-14 晚，进链子时必须加的一条）：**已经在册的主名不许被重排换掉**。
 *   原判据是"最多引用 ‖ 最早入库"，而引用数是拿**当下的仓**数的 —— 链子每跑一遍，各表里的点名次数就变一点
 *   ⇒ 同一份权重可能今天叫 `Ldemo`、明天叫 `SHIPPED-Ldemo`，图上 192 个点的名字跟着抖，
 *   而 `slot-timeline` / `lineage` / `ship-times` 那些**按名字索引面板**的表会成片指不到（本班上午才刚把消费者教会认副名）。
 *   所以加一层最前的优先：这份表在 HEAD 里是哪一行，折完还叫那个名。并列时才回到引用数 ‖ 入库时刻 ‖ 字典序。 */
const HEADMAIN = HEADINFO.main;
/* §E605-A（10-14 晚）：**副名指针必须能从上一版结转过来**。
 *   第①步（`ruler-figs`）现在会按面板的 `aliasIds` 拦掉副名行 —— 那是对的（布局该按"一行=一份权重"算），
 *   但代价是折行时**再也没有副名行可折**：实测重跑一遍链子，`aliasN` 从 2/3 掉成 1、`aliasIds` 100 组全部变空，
 *   而 slot-timeline ‖ lineage ‖ ship-times ‖ 池表里那些按旧名字写的指针从此无处可翻（上午刚教会消费者认的那张指针表就这么被重算掉了）。
 *   ⇒ 指针是一份**账**，不是每次重画都能从尺表里重新学出来的东西：HEAD 里已有的先结转，本次真折出来的再并进来。 */
for (const [w, v] of G) {
  if (v.length === 1) { picked.push({ main: v[0], al: [] }); continue; }
  /* 主名 = **外部指针最多**的那个名字（用户定的"最多引用"在前），并列再比"最早入库"，再并列按 id 字典序。
   *   为什么引用数排在身份前面（10-14 实测出来的次序错一次就红一片）：
   *   `slot-timeline.tsv` / `ship-times.tsv` / `lineage.tsv` 是**按名字**索引面板的，
   *   名字被折走 ⇒ 构建报"那张表多出的（解析认它没进过槽）15"、版本号认回从 46 行掉到 31 行。
   *   而"谁带冠军身份"是**权重**的属性、不是名字的属性 ⇒ 身份随权重搬到主名行（下面 UNION 那一段），不靠选名字来保。 */
  const ranked = v.slice().sort((a, b) => {
    const ia = a[H.id], ib = b[H.id];
    /* §E605：在册主名优先（重跑不许换名字）⇒ 才轮到"最多引用"、"最早入库"、字典序 */
    const ha = HEADMAIN.has(ia) ? 0 : 1, hb = HEADMAIN.has(ib) ? 0 : 1;
    return (ha - hb) || (refOf(ib) - refOf(ia)) || (tsOf(ia) - tsOf(ib)) || (ia < ib ? -1 : ia > ib ? 1 : 0);
  });
  const main = ranked[0];
  const al = v.filter(r => r !== main);
  /* 身份 UNION：组内所有白名单 lineage 并到主名行；出现**两个不同**的身份 ⇒ 停下来点名（同一份权重不该有两种上槽史） */
  const linSet = [...new Set(v.map(r => r[H.lineage]).filter(x => LIN[x]))];
  if (linSet.length > 1) { clash.push('组 ' + main[H.id] + ' / ' + al.map(r => r[H.id]).join(' ') + ' 身上有两个不同身份：' + linSet.join(' + ')); }
  if (linSet.length === 1 && main[H.lineage] !== linSet[0]) main[H.lineage] = linSet[0];
  /* 并列引用数（主名和某个副名被同样多点 ⇒ 选谁都会让另一边的指针变松）：只点名，不静默 */
  const tied = al.filter(r => refOf(r[H.id]) === refOf(main[H.id]) && refOf(main[H.id]) > 0).map(r => r[H.id]);
  if (tied.length) warn.push('引用数并列：' + main[H.id] + ' 与 ' + tied.join(' ‖ ') + ' 各被点 ' + refOf(main[H.id]) + ' 次 ⇒ 主名按最早入库定（' + new Date(tsOf(main[H.id]) * 1000).toISOString().slice(0, 10) + '）');
  /* 守卫②（10-14 白天补严）：测量列不许被折行静默丢掉 —— 主名空着、副名有值就搬上去；两边都有值且不同就不猜 */
  for (const a of al) {
    const d = [];
    for (const c of head) {
      if (GEO[c] || SELF[c]) continue;
      const j = H[c], v1 = String(main[j] || '').trim(), v2 = String(a[j] || '').trim();
      if (!v2 || v1 === v2) continue;
      if (!v1) { main[j] = v2; carried.push(main[H.id] + '.' + c + ' ← ' + a[H.id] + '（' + v2 + '）'); }
      else if (!RECD[c]) d.push(c + '=' + v2);
    }
    DIFF.set(a[H.id], d.join(' '));
  }
  picked.push({ main, al, by: '最多引用‖最早入库' });
  for (const a of al) {
    if (a[H.H] !== main[H.H] || a[H.S] !== main[H.S]) warn.push('读数矛盾：' + a[H.id] + ' H=' + a[H.H] + ' vs 主名 ' + main[H.id] + ' H=' + main[H.H] +
      ' ‖ S=' + a[H.S] + '/' + main[H.S] + ' ‖ 同一个文件 ' + main[H.path]);
  }
}
if (clash.length) { console.error('⛔ 同一份权重上挂着两个不同冠军身份（' + clash.length + ' 组）⇒ 不敢折，先裁身份：\n  ' + clash.join('\n  ')); process.exit(2); }
const out = picked.map(p => p.main);
if (out.length !== G.size) { console.error('⛔ 折出来 ' + out.length + ' 行 ≠ 身份数 ' + G.size); process.exit(2); }

/* ---------- 3. 落盘：主表（尾部加两列）+ 副名表（读数全留） ---------- */
const NEWH = head.concat(['aliasN', 'aliasIds']);
const MAIN_SET = new Set(picked.map(p => p.main[H.id]));
const NEWALIAS = new Set();                     // 本次真从表里折出来的副名（有读数可记的那些）
const CARRIED = [];                             // §E605-A：从上一版账本结转下来的行（原样搬，只把 mainId 对准现在的主名）
const ALH0 = ['mainId', 'aliasId', 'aliasH', 'aliasS', 'aliasSeed', 'aliasExamG', 'aliasLineage', 'path', 'wid', 'sameReading', 'mainH', 'mainS', 'aliasDiff'];
const body = picked.map(p => {
  const r = p.main.slice();
  r[H.dupN] = '1';
  r[H.dupOf] = p.main[H.id];
  while (r.length < head.length) r.push('');
  for (const a of p.al) NEWALIAS.add(a[H.id]);
  /* §E605-A：指针账 = 上一版结转 ∪ 本次新折；去掉自己、去掉"现在自己是主行"的名字（一个名字不许既当主名又当别人的副名） */
  const als = new Set((HEADINFO.prevAlias[p.main[H.id]] || []).concat(p.al.map(a => a[H.id])));
  als.delete(p.main[H.id]);
  for (const a of Array.from(als)) if (MAIN_SET.has(a)) als.delete(a);
  const list = Array.from(als).sort();
  /* 结转的指针要有账可查：账本里有那一行就原样搬（只改 mainId），没有就补一行写明"结转、无记录"——
   *   绝不允许主表指着一个说不出"当年是什么档、H 多少"的名字（本班上午刚给这张账本加过 `aliasDiff`，同一个道理）。 */
  for (const a of list) if (!NEWALIAS.has(a)) {
    const prev = HEADROWS[a];
    const cells = prev ? prev.split('\t') : [p.main[H.id], a, '', '', '', '', '', '', '', 'carried-no-row', '', '', ''];
    cells[0] = p.main[H.id];
    while (cells.length < ALH0.length) cells.push('');
    CARRIED.push(cells.join('\t'));
  }
  return r.concat([String(1 + list.length), list.join(' ')]).join('\t');
});
const ALH = ['mainId', 'aliasId', 'aliasH', 'aliasS', 'aliasSeed', 'aliasExamG', 'aliasLineage', 'path', 'wid', 'sameReading', 'mainH', 'mainS', 'aliasDiff'];
const ALR = [];
for (const p of picked) for (const a of p.al) ALR.push([p.main[H.id], a[H.id], a[H.H], a[H.S], a[H.seed] || '', a[H.examG] || '',
  a[H.lineage] || '', a[H.path], WID.get(a) || '', a[H.H] === p.main[H.H] && a[H.S] === p.main[H.S] ? 'same' : 'DIFF',
  p.main[H.H], p.main[H.S], DIFF.get(a[H.id]) || ''].join('\t'));
for (const c of CARRIED.sort()) ALR.push(c);
if (CARRIED.length) console.log('§E605-A 结转上一版账本 ' + CARRIED.length + ' 行（其中补写明"结转、无记录"的 ' +
  CARRIED.filter(x => x.split('\t')[9] === 'carried-no-row').length + ' 行）');

console.log('目标：' + out.length + ' 行 × ' + NEWH.length + ' 列 ‖ 副名表 ' + ALR.length + ' 行 × ' + ALH.length + ' 列');
console.log('守卫② 从副名搬上主名的测量格 = ' + carried.length + ' 个' + (carried.length ? '：\n  ' + carried.join('\n  ') : ''));
const nDiff = ALR.filter(r => r.split('\t')[ALH.length - 1] !== '').length;
const wDiff = ALR.reduce((a, r) => a + (r.split('\t')[ALH.length - 1] ? r.split('\t')[ALH.length - 1].split(' ').length : 0), 0);
console.log('守卫② 两边都有值且不同 ⇒ **不搬、原样记进副名表 aliasDiff** = ' + wDiff + ' 格（涉及 ' + nDiff + ' 个副名）');
console.log('读数不一致的副名 = ' + warn.length + ' 条' + (warn.length ? '：\n  ' + warn.join('\n  ') : ''));
const byHow = {}; for (const p of picked) if (p.al.length) byHow[p.by] = (byHow[p.by] || 0) + 1;
console.log('多数组的主名是凭什么定的：' + Object.entries(byHow).map(([k, v]) => k + ' ' + v + ' 组').join(' ‖ '));
if (DRY) { console.log('--dry：一个字没写'); process.exit(0); }

writeFileSync(CO, [NEWH.join('\t')].concat(body).join(EOL) + EOL, 'utf8');
writeFileSync(AL, [ALH.join('\t')].concat(ALR).join(EOL) + EOL, 'utf8');

/* 回读复核（不信"我写了"）：行数、列数、身份数、副名总数守恒 */
const B = readFileSync(CO, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const bh = B[0], bH = Object.fromEntries(bh.map((c, i) => [c, i]));
const Bb = B.slice(1);
const errs = [];
if (Bb.length !== out.length) errs.push('回读行数 ' + Bb.length + ' ≠ ' + out.length);
if (Bb.filter(r => r.length !== bh.length).length) errs.push('有行宽度 ≠ 表头');
if (bH.aliasN === undefined || bH.aliasIds === undefined) errs.push('新列没落上');
const totAlias = Bb.reduce((a, r) => a + (+r[bH.aliasN] - 1), 0);
if (totAlias !== ALR.length) errs.push('主表 aliasN 合计 ' + totAlias + ' ≠ 副名表 ' + ALR.length + ' 行');
if (new Set(Bb.map(r => r[bH.id])).size !== Bb.length) errs.push('折完还有重复 id ⇒ 分组没做干净');
const A2 = readFileSync(AL, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
if (A2.length - 1 !== ALR.length) errs.push('副名表回读 ' + (A2.length - 1) + ' ≠ ' + ALR.length);
if (errs.length) { console.error('⛔ 写完复核红：\n  ' + errs.join('\n  ') + '\n     ⇒ 表已改，请先看这条再说下一步（原件在 git 里：git checkout -- ' + 'champion-map/coords.tsv）'); process.exit(2); }
console.log('✔ 折完并回读通过：' + Bb.length + ' 行 × ' + bh.length + ' 列 ‖ 副名 ' + totAlias + ' 条全部落到 coords-aliases.tsv ‖ id 唯一');
