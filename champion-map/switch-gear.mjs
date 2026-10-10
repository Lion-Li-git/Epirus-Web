#!/usr/bin/env node
/* §E569（10-10 晚 · 用户裁定）：把图上的考卷尺**整体换到 exam=120 档**，并且**不留两套值当历史对照**。
 *
 * 用户原话：「我觉得不要留一大堆变量，H120 既然一定比 H30 更准确，那就不要留 H30 去做历史对照，
 *           因为历史数据反而是准确度差的，我们的考卷目标是分析冠军的特性而不是单纯拿几个数字比。」
 *
 * 所以这次的形状是：**一列 `H`（值 = 120 档）+ 一列 `examG`（档本身，写在数据里）+ 删掉 `H120`**。
 *   为什么不覆盖掉"这是哪一档"这件事本身（§E566 立的"档跟着行走"）：
 *   历史条目里 55.4 那类数是 30 档的，只要每行都带着 `examG`，日后任何人都能判断"这两句能不能直接比"；
 *   而"留一列 H30 当对照"是把 provenance 当成第二把尺 —— 那正是把两个答案并存、让读的人自己猜。
 *
 * 四道守卫（跑前写死，各挡一条本仓已有的病）：
 *   ① **档自证**：源表每一行 `examG` 必须 = 传进来的档 ⇒ 混档直接 exit 2。
 *   ② **同档互验（真复现守卫）**：本次 `exam` 必须与今早那张独立量具表（`ruler120-…-all.tsv`，同为 120 档同 seed 77000）
 *      逐字相同（允许 0.05 的浮点尾差）；不一致比例 >2% ⇒ exit 2 并点名。这条是本笔唯一能证明"换的是档、不是仪器"的东西。
 *   ③ **覆盖下限**：coords 全数里配不上的 > 3% ⇒ 不许换（半覆盖的列 = 图上混两种口径，§E314 的判据同一条）。
 *   ④ **宽度 + 幂等**：任一行宽度 ≠ 表头 ⇒ 拒绝写（§E375 那族"只错一行、无声无息"）；重复跑必须产出逐字节相同的表。
 *
 * 用法：node champion-map/switch-gear.mjs [--table=epsfull120-2026-10-10.tsv] [--gear=120] [--check]
 *   `--check` = 只跑守卫与读数，不落盘。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const TABLE = arg('table', 'epsfull120-2026-10-10.tsv');
const GEAR = Number(arg('gear', 120));
const CHECK = process.argv.includes('--check');
/* ⚠ 读 TSV 只剥行尾换行，绝不整文件 .trim()（§E314/§E375 —— 末行行尾的空单元格会被连着 tab 削掉） */
const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));

/* `--table=` 允许给相对 champion-map/ 的文件名，也允许给绝对路径（Windows 的 `D:\…` 与 POSIX 的 `/…`）
 *   —— 第一版一律 `join(HERE, …)`，拿绝对路径试负向时被拼成 `…\champion-map\C:/Users/…` 而报"文件不存在"，
 *   守卫虽然响了但报的原因是假的（这种"错误信息说错话"本仓已经吃过一次：D137 那句 flag 名）。 */
const pjoin = (v) => (/^(?:[A-Za-z]:[\\/]|\/)/.test(v) ? v : join(HERE, v));
const SRC = pjoin(TABLE);
if (!existsSync(SRC)) { console.error('⛔ 源表不存在：' + SRC + '（先跑 `node champion-map/eps-full.mjs --games=' + GEAR + ' --out=' + TABLE + '`）'); process.exit(2); }
const TB = rd(SRC), th = Object.fromEntries(TB[0].map((h, i) => [h, i]));
for (const need of ['id', 'exam', 'page', 'd', 'examG']) {
  if (th[need] === undefined) { console.error('⛔ 源表缺列 `' + need + '`（表头：' + TB[0].join('\t') + '）⇒ 拒绝按位置取数'); process.exit(2); }
}
/* 守卫 ① 档自证 */
let badGear = 0, gearSeen = {};
for (const r of TB.slice(1)) { if (!r[th.id]) continue; gearSeen[r[th.examG]] = (gearSeen[r[th.examG]] || 0) + 1; if (Number(r[th.examG]) !== GEAR) badGear++; }
if (badGear) { console.error('⛔ 守卫①：源表有 ' + badGear + ' 行的 examG ≠ ' + GEAR + '（出现过 ' + JSON.stringify(gearSeen) + '）⇒ 这张表是混档的，不换'); process.exit(2); }
console.log('守卫① 档自证 ✅ 源表 ' + Object.keys(gearSeen).length + ' 个档 = ' + Object.keys(gearSeen).join(',') + ' ‖ 行数 ' + (TB.length - 1));

const EX = {}, PG = {}, DE = {};
for (const r of TB.slice(1)) { if (!r[th.id]) continue; EX[r[th.id]] = Number(r[th.exam]); PG[r[th.id]] = Number(r[th.page]); DE[r[th.id]] = Number(r[th.d]); }

/* 守卫 ② 同档互验：与今早那张量具表（另一台仪器、同档、同 seed）逐字比 */
const R120 = join(HERE, 'ruler120-2026-10-10-all.tsv');
if (existsSync(R120)) {
  const A = rd(R120), ah = Object.fromEntries(A[0].map((h, i) => [h, i]));
  let n = 0, diff = 0, worst = 0; const names = [];
  for (const r of A.slice(1)) {
    const id = r[ah.id]; if (!id || EX[id] === undefined) continue;
    n++; const d = Math.abs(EX[id] - Number(r[ah.H]));
    if (d > 0.05) { diff++; if (names.length < 8) names.push(id + ' 本次 ' + EX[id].toFixed(2) + ' ‖ 量具表 ' + r[ah.H]); }
    if (d > worst) worst = d;
  }
  const rate = n ? diff / n : 1;
  console.log('守卫② 同档互验：可比 ' + n + ' 枚 ‖ 超 0.05 的 ' + diff + '（' + (100 * rate).toFixed(2) + '%）‖ 最大差 ' + worst.toFixed(3) + 'pt');
  if (n === 0 || rate > 0.02) { console.error('⛔ 守卫② 不过 ⇒ 两张同档表对不上，说明换的不只是档（前 8 条：\n  ' + names.join('\n  ') + '）'); process.exit(2); }
} else { console.error('⛔ 守卫② 无从执行：' + R120 + ' 不在盘上 ⇒ 不许换（本笔的凭据要求两台仪器互相复现）'); process.exit(2); }

const CO = rd(join(HERE, 'coords.tsv')), ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const iId = ch.id, iH = ch.H, iHp = ch.Hp, iDe = ch.De, iF = ch.F, iS = ch.S;
if ([iId, iH, iHp, iDe, iF, iS].some((x) => x === undefined)) { console.error('⛔ coords 缺 id/H/Hp/De/F/S 某一列'); process.exit(2); }
const iH120 = ch.H120, iExamG = ch.examG;

/* 守卫 ③ 覆盖 */
let hit = 0, miss = [];
for (const r of CO.slice(1)) { if (!r[iId]) continue; if (EX[r[iId]] !== undefined) hit++; else miss.push(r[iId]); }
const tot = CO.length - 1, missRate = miss.length / tot;
console.log('守卫③ 覆盖：' + hit + '/' + tot + (miss.length ? ' ‖ 缺 ' + miss.length + '（前 8：' + miss.slice(0, 8).join(' ') + '）' : ' ⇒ 全配上'));
if (missRate > 0.03) { console.error('⛔ 守卫③：缺 ' + (100 * missRate).toFixed(1) + '% > 3% ⇒ 换完图上会混两种口径，不换'); process.exit(2); }

/* 换档前读数（给 CHANGELOG 与页检当对照） */
const oldOf = (id) => { const r = CO.slice(1).find((x) => x[iId] === id); return r ? { H: +r[iH], Hp: +r[iHp], De: +r[iDe], F: +r[iF] } : null; };
const incBefore = oldOf('SHIPPED-Ldemo');

const newRows = [CO[0].slice()];
/* 列操作：删 H120（若有）、加 examG（若无）在末尾 */
let head = CO[0].slice();
if (iH120 !== undefined) head = head.filter((_, i) => i !== iH120);
const dropIdx = iH120;
if (iExamG === undefined) head.push('examG');
newRows[0] = head;

let widthBad = 0, kept = 0, replaced = 0;
for (const r of CO.slice(1)) {
  let row = r.slice();
  if (dropIdx !== undefined) row.splice(dropIdx, 1);
  const id = row[iId];
  if (id && EX[id] !== undefined) {
    const H = EX[id], Hp = PG[id];
    row[iH] = H.toFixed(2); row[iHp] = Hp.toFixed(2); row[iDe] = (H - Hp).toFixed(2);
    row[iF] = (H / 100 + 0.1 * (+row[iS] || 0)).toFixed(6);   /* 存储基准是 H/100 + 0.1·S（实测 986/986 行都是这条式子） */
    replaced++;
  }
  if (iExamG === undefined) row.push(id && EX[id] !== undefined ? String(GEAR) : '');
  if (row.length !== head.length) { widthBad++; continue; }
  newRows.push(row); kept++;
}
/* `rank` 也要跟着重算：coords 的 rank 是"按存储基准 F = H/100 + 0.1·S 降序"的名次（页面那栏是随 T 现场重算的，
 *   但 duel-run / duel-stats 这些工具读的是存下来的 rank）⇒ 换档不重算就是让名次停在 30 档的排法上。 */
const iRank = ch.rank;
if (iRank !== undefined) {
  const order = newRows.slice(1).map((r, i) => ({ i: i + 1, f: Number(r[iF]) }))
    .filter((o) => isFinite(o.f))
    .sort((a, b) => (b.f - a.f) || (newRows[a.i][iId] < newRows[b.i][iId] ? -1 : 1));   /* 同分按 id 定序 ⇒ 破并列不许按原行序（本仓 L7 那条：不许有座位/行序偏置） */
  order.forEach((o, k) => { newRows[o.i][iRank] = String(k + 1); });
  console.log('rank 重算：按新 F 降序赋 1..' + order.length + '（同分按 id 定序，不按行序）');
}

if (widthBad) { console.error('⛔ 守卫④：有 ' + widthBad + ' 行换完宽度 ≠ 表头（' + head.length + '）⇒ 拒绝写盘'); process.exit(2); }

/* 幂等自证：目标内容与盘上现有表若逐字节相同，就直说"已经换过了" */
const out = newRows.map((r) => r.join('\t')).join('\n') + '\n';
const nowTxt = readFileSync(join(HERE, 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n');
console.log('守卫④ 宽度 ✅ 每行 ' + head.length + ' 列（写 ' + kept + ' 行 ‖ 覆写读数 ' + replaced + ' 枚）‖' +
  (nowTxt === out ? ' **本次内容与盘上逐字节相同 ⇒ 幂等：已换过**' : ' 目标内容与盘上不同（本次是真换档）'));
console.log('列操作：删 H120 = ' + (iH120 === undefined ? '（本来就没有）' : '第 ' + (iH120 + 1) + ' 列') +
  ' ‖ examG = ' + (iExamG === undefined ? '新增（第 ' + head.length + ' 列）' : '覆写第 ' + (iExamG + 1) + ' 列'));
const incAfter = (() => { const r = newRows.find((x) => x[iId] === 'SHIPPED-Ldemo'); return r ? { H: +r[iH], Hp: +r[iHp], De: +r[iDe], F: +r[iF], gear: r[head.indexOf('examG')] } : null; })();
console.log('现役 SHIPPED-Ldemo 换档前 = ' + JSON.stringify(incBefore) + ' ‖ 换档后 = ' + JSON.stringify(incAfter));
if (incAfter && !(incAfter.H > 0 && incAfter.H < 100 && incAfter.gear === String(GEAR))) { console.error('⛔ 现役换完不合法（H 或档没落上）'); process.exit(2); }

if (CHECK) { console.log('--check ⇒ 不落盘（守卫全过：' + [1, 2, 3, 4].join('/') + '）'); process.exit(0); }
writeFileSync(join(HERE, 'coords.tsv'), out.replace(/\n/g, '\r\n'), 'utf8');
console.log('已写 champion-map/coords.tsv（' + kept + ' 行 × ' + head.length + ' 列，CRLF 工作树）');
