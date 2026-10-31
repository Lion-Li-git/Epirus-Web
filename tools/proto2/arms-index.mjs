#!/usr/bin/env node
/* arms-index.mjs — 从 `scratch/arms/*.bak.meta.json` **重建** `index.tsv`（千问 · 10-30 晚）
 *
 * 为什么要它：`probe-cem-arm` 现在只往索引里**追加**自己这一臂；而今天（换代前后）已经跑了三十多枚臂，
 *   它们的名字还是 v1 那串长字段、索引里一格没有 ⇒ 分析与演化图无从下手（用户原话："进演化图更是灾难"）。
 *   规律应当住在表里，不在文件名里。
 * 幂等：整表重建（不是追加）⇒ 跑多少次结果一样；缺 meta 的 `.bak` 只登记 id/文件、读数格写 `-`（看得见地缺，不许静默跳过）。
 * 用法：node tools/proto2/arms-index.mjs [--dir=scratch/arms] [--tree=1]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { rejectUnknownFlags } from '../audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dir', 'tree'], 'arms-index');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIR = arg('dir', 'scratch/arms');
const TAB = String.fromCharCode(9), NL = String.fromCharCode(10);
const COLS = ['id', 'file', 'gen', 'parent', 'mode', 'pop', 'seed', 'evals', 'targetGames', 'startFit', 'fit', 'dFit',
  'startFirst', 'first', 'agree', 'conc', 'singleCard', 'cardShare', 'secs', 'outHash', 'headGate', 'verifGate', 'time'];
const hv = (x) => (x === null || x === undefined || !Number.isFinite(Number(x)) ? '-' : (typeof x === 'number' ? Number(x).toFixed(4) : String(x)));
const word = (x) => { const t = String(x || '-'); return t.indexOf('绿') === 0 ? '绿' : t.indexOf('红') === 0 ? '红' : t.indexOf('不适用') === 0 ? '不适用' : t.indexOf('未开闸') === 0 ? '未开闸' : t.slice(0, 6); };
const armId = (f) => String(f).replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '');

/* 产物清单 = 现役 `.bak` + **作废归档目录里的同名产物**（10-31：obs3b 505 面瘦身后的 27 枚旧产物读不出、
 *   已移进 `voided-obs3b505/`，但它们的 meta（读数）留在 `scratch/arms/` ⇒ 行必须还在，`file` 列指向归档路径，
 *   这样"只剩读数"这件事在表上是看得见的，而不是悄悄少 27 行。 */
const VOID = DIR + '/voided-obs3b505';
const hasVoid = existsSync(VOID) ? readdirSync(VOID) : [];
const baks = readdirSync(DIR).filter((f) => f.endsWith('.bak')).map((f) => [f, statSync(DIR + '/' + f).mtimeMs]);
for (const f of hasVoid) if (f.endsWith('.bak') && existsSync(DIR + '/' + f) === false && existsSync(DIR + '/' + f + '.meta.json')) baks.push([f, statSync(VOID + '/' + f).mtimeMs]);
baks.sort((a, b) => a[1] - b[1]);
const rows = [], noMeta = [];
for (const [f, mt] of baks) {
  const id = armId(f);
  const inVoid = !existsSync(DIR + '/' + f);
  let m = null;
  try { m = JSON.parse(readFileSync(DIR + '/' + f + '.meta.json', 'utf8')); } catch (e) { noMeta.push(id); }
  const L = m && m.lineage ? m.lineage : {};
  const hh = m && m.headHealth && m.headHealth.pack ? m.headHealth.pack : {};
  const mc = m && m.arena && m.arena.bestMaxCard ? m.arena.bestMaxCard : null;
  /* `file` 列保持"纯路径"（别往路径里塞说明文字 ⇒ 下游按路径 join 的都会被咬）：
   *   作废产物靠目录名 `voided-obs3b505/` 自证。 */
  rows.push([id, (inVoid ? VOID : DIR) + '/' + f, L.gen != null ? L.gen : (m && m.container && m.container.gen != null ? m.container.gen : '-'),
    m && m.parent ? m.parent : (L.parent && L.parent !== 'random' ? armId(L.parent) : '-'),
    m ? m.mode : '-', m ? m.pop : '-', m ? m.seed : '-', m ? m.evals : '-', m && m.targetGames != null ? m.targetGames : '-',
    hv(m ? m.holdoutStartFit : NaN), hv(m ? m.holdoutFit : NaN),
    hv(m && typeof m.holdoutFit === 'number' && typeof m.holdoutStartFit === 'number' ? m.holdoutFit - m.holdoutStartFit : NaN),
    hv(m ? m.holdoutStartFirst : NaN), hv(m ? m.holdoutFirst : NaN), hv(hh.agreeRandom), hv(hh.concMed),
    mc ? mc.key : '-', hv(mc ? mc.share : NaN), hv(m ? m.secs : NaN),
    L.outHash ? String(L.outHash).slice(0, 8) : '-', word(m ? m.headGate : '-'), word(m ? m.verifGate : '-'),
    new Date(mt).toISOString().slice(5, 16).replace('T', ' ')]);
}
writeFileSync(DIR + '/index.tsv', COLS.join(TAB) + NL + rows.map((r) => r.join(TAB)).join(NL) + NL, 'utf8');

/* 链条：谁把谁当父本 ⇒ 图就是这张表上的边；顺手报每粒臂"终点高于起点"没有（判据先写死那条） */
if (arg('tree', '') === '1') {
  const by = {}; for (const r of rows) by[r[0]] = r;
  const kids = {}; for (const r of rows) if (r[3] !== '-' && by[r[3]]) (kids[r[3]] || (kids[r[3]] = [])).push(r[0]);
  const roots = rows.filter((r) => r[3] === '-' || !by[r[3]]).map((r) => r[0]);
  const walk = (id, depth) => {
    const r = by[id];
    console.log('  '.repeat(depth) + '· ' + id + '  fit=' + r[10] + (r[11] !== '-' ? ' Δ' + (Number(r[11]) >= 0 ? '+' : '') + Number(r[11]).toFixed(3) : '') +
      '  agree=' + r[14] + '  单卡=' + r[16] + ' ' + r[17]);
    for (const k of (kids[id] || [])) walk(k, depth + 1);
  };
  console.log('# 谱系（根 = 找不到父本或父本不在盘上）：根 ' + roots.length + ' 个 ‖ 臂 ' + rows.length + ' 枚 ‖ 缺 meta ' + noMeta.length + ' 枚');
  for (const id of roots) walk(id, 1);
}
console.log('⇒ ' + DIR + '/index.tsv 重建：' + rows.length + ' 行 ‖ 列 ' + COLS.length + (noMeta.length ? ' ‖ 缺 meta（读数全为 -）：' + noMeta.slice(0, 8).join(', ') : ''));
