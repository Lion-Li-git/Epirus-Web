#!/usr/bin/env node
/* fold-coords.mjs —— 把 `coords.tsv` 从 986 行折成 **794 行**（用户 10-14 裁：(c) 拆行重做）
 *
 * 为什么能折：一台普查实测 794 个不同 path 解出 **794 个不同权重身份**、"同一份权重还有两个物理文件"的组数 = **0**
 *   ⇒ 盘上活着的权重全是主名；多出来那 192 行只是**搭在同一份文件上的名字**（副名），不是另一份权重。
 * 主名怎么定（用户定的规矩）：**最早入库** 优先，其次 **最多引用**，再按 id 字典序（不许靠遍历次序）。
 *   入库时刻 = 这个 id **第一次出现在 coords.tsv 的那笔提交**（`git log -S` 现查，不是抄注释里的日期）。
 *   引用数 = 这个 id 在**其它入库文件**里被点到的次数（`git grep` 现数，排除 coords.tsv 与自己那一行）。
 *
 * 三条不许静默的守卫：
 *   ① 身份优先：组里若只有一行带白名单 lineage（历代上槽 / 旧槽位冠军），**它必须当选主名** ——
 *      按"最早入库"挑到别的行会把冠军身份弄丢（`viewer.mjs` 挑组内代表读的就是"谁带身份"）。
 *      组里带身份的行 ≠ 1 且不是 0 ⇒ 停下来点名，不猜。
 *   ② 读数不丢：被折掉的副名连同它自己的 `H/S/seed/examG` 落到 `champion-map/coords-aliases.tsv`；
 *      副名读数与主名**不一致**的行单独点名（实测抓到 `eco-34-v7c`：与主名同一个文件、Hp 也相同，H 却差 10.5pt
 *      ⇒ 那是它自己那份已搬走的副本留下的读数，路径后来被 §E589 改指了主名）。
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

const picked = [], warn = [], clash = [];
for (const [w, v] of G) {
  if (v.length === 1) { picked.push({ main: v[0], al: [] }); continue; }
  /* 主名 = **外部指针最多**的那个名字（用户定的"最多引用"在前），并列再比"最早入库"，再并列按 id 字典序。
   *   为什么引用数排在身份前面（10-14 实测出来的次序错一次就红一片）：
   *   `slot-timeline.tsv` / `ship-times.tsv` / `lineage.tsv` 是**按名字**索引面板的，
   *   名字被折走 ⇒ 构建报"那张表多出的（解析认它没进过槽）15"、版本号认回从 46 行掉到 31 行。
   *   而"谁带冠军身份"是**权重**的属性、不是名字的属性 ⇒ 身份随权重搬到主名行（下面 UNION 那一段），不靠选名字来保。 */
  const ranked = v.slice().sort((a, b) => {
    const ia = a[H.id], ib = b[H.id];
    return (refOf(ib) - refOf(ia)) || (tsOf(ia) - tsOf(ib)) || (ia < ib ? -1 : ia > ib ? 1 : 0);
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
const body = picked.map(p => {
  const r = p.main.slice();
  r[H.dupN] = '1';
  r[H.dupOf] = p.main[H.id];
  while (r.length < head.length) r.push('');
  return r.concat([String(1 + p.al.length), p.al.map(a => a[H.id]).join(' ')]).join('\t');
});
const ALH = ['mainId', 'aliasId', 'aliasH', 'aliasS', 'aliasSeed', 'aliasExamG', 'aliasLineage', 'path', 'wid', 'sameReading', 'mainH', 'mainS'];
const ALR = [];
for (const p of picked) for (const a of p.al) ALR.push([p.main[H.id], a[H.id], a[H.H], a[H.S], a[H.seed] || '', a[H.examG] || '',
  a[H.lineage] || '', a[H.path], WID.get(a) || '', a[H.H] === p.main[H.H] && a[H.S] === p.main[H.S] ? 'same' : 'DIFF',
  p.main[H.H], p.main[H.S]].join('\t'));

console.log('目标：' + out.length + ' 行 × ' + NEWH.length + ' 列 ‖ 副名表 ' + ALR.length + ' 行 × ' + ALH.length + ' 列');
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
