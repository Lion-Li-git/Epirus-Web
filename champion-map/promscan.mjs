#!/usr/bin/env node
/* §E308 把 `promote --dry` 的裁决汇成一张表
 *
 * 为什么要这张表：图上的绿环只编码 `feasibilityOf`（五道），而**真正决定能不能上槽的是另一批腿**
 * —— G4（不许被一行脚本打穿 >60%）、G5（面对"只防御不还手"必须清场 ≤25%）、送盾硬门槛（不可 --force）。
 * §E305/§E307 一枚一枚数出来的教训就是：前沿死在这几条腿上，而它们在图上完全隐形。
 *
 * 输入：docs/artifacts/e3xx-out/dry-*.txt（`promote-champion.mjs <bak> --dry` 的原样输出）+ holo.tsv（送盾实测值）
 * 输出：champion-map/promote.tsv = id  verdict  blocks  g4worst  g5worst  holoOther
 *   verdict = pass | block；worst = 该腿的最坏格（换包判据看的正是最坏格，不是平均）
 *
 * 解析口径：只认 ⛔ 段落里逐条列出的 `   · ` 行（那是裁决的原文），不去猜中间过程的 ✅/✗。
 * 用法：node champion-map/promscan.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
/* 所有 e3xx-out 臂目录都收（新增一批日志不用改这里）*/
const DIRS = readdirSync(join(ROOT, 'docs', 'artifacts')).filter((d) => /^e3\d{2}-out$/.test(d)).map((d) => 'docs/artifacts/' + d);
const files = [];
for (const d of DIRS) {
  const p = join(ROOT, d);
  if (existsSync(p)) for (const f of readdirSync(p)) if (/^dry-.+\.txt$/.test(f)) files.push([join(p, f), f.slice(4, -4)]);
}
/* 同一枚可能在两个臂目录里各有一份日志 ⇒ 按 mtime 从旧到新读，**新的那份覆盖旧的**（去重在下面）*/
files.sort((a, b) => statSync(a[0]).mtimeMs - statSync(b[0]).mtimeMs);
if (!files.length) { console.error('没找到任何 dry 日志 ⇒ 先跑 promote-champion.mjs --dry'); process.exit(1); }

/* 送盾的本体数值来自 §E305 的全量探针（holoprobe.mjs ⇒ holo.tsv 第 6 列），日志只负责"栽没栽桩" */
const HOLO = {};
if (existsSync(join(HERE, 'holo.tsv'))) {
  const hl = readFileSync(join(HERE, 'holo.tsv'), 'utf8').trim().split('\n');
  const hh = hl[0].split('\t'), hi = hh.indexOf('id'), hg = hh.indexOf('holoOther');
  for (const l of hl.slice(1)) { const c = l.split('\t'); if (c[hi]) HOLO[c[hi]] = +c[hg]; }
}

const rows = [];
for (const [p, id] of files) {
  const t = readFileSync(p, 'utf8');
  if (!/换前体检/.test(t)) continue;                       // 还没跑完
  const done = /自检通过|体检未过|硬门槛未过/.test(t);
  if (!done) continue;
  const pass = /自检通过/.test(t);

  /* ⛔ 段落里的每一条（原文照抄）⇒ 只取第一行 ⛔ **之后**的 bullet，别把中间过程的说明条目当裁决 */
  const ln = t.split('\n');
  const from = ln.findIndex((l) => /^⛔/.test(l));
  const items = (from < 0 ? [] : ln.slice(from + 1)).filter((l) => /^\s+·\s/.test(l) && !/⇒/.test(l)).map((l) => l.trim().replace(/^·\s*/, ''));
  const blocks = [];
  let g4 = 0, g5 = 0;
  for (const it of items) {
    const m4 = it.match(/G4\[([^\]]*)\/(long|multi)\].*?」\s*([0-9]+)%/);
    const m5 = it.match(/G5\[([^\]]*)\/(long|multi)\].*?夺冠\s*([0-9]+)%/);
    const mh = it.match(/全息屏障套给别人\s*([0-9.]+)\s*次\/局\s*>\s*([0-9]+)/);
    if (m4) { g4 = Math.max(g4, +m4[3]); blocks.push('G4/' + m4[2] + ' 被一行脚本打穿 ' + m4[3] + '%'); }
    else if (m5) { g5 = Math.max(g5, +m5[3]); blocks.push('G5/' + m5[2] + ' 清不了防席（它夺冠 ' + m5[3] + '%）'); }
    else if (mh) { blocks.push('送盾 ' + mh[1] + '/局 > ' + mh[2] + '（不可 --force）'); }
    else blocks.push(it.slice(0, 60));
  }
  /* 送盾取 holo.tsv 的实测值（全 718 枚都有，日志里那行只在部分装配下才印）*/
  rows.push([id, pass ? 'pass' : 'block', blocks.join(' · ') || '—', g4 || '', g5 || '', HOLO[id] === undefined ? '' : HOLO[id]]);
}
/* 去重：同 id 取**后读到**的那份（上面已按 mtime 升序 ⇒ 新的那份赢），别把两次裁决并成一行 */
const BYID = {};
for (const r of rows) BYID[r[0]] = r;
rows.length = 0;
for (const k in BYID) rows.push(BYID[k]);
rows.sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] === 'pass' ? -1 : 1));writeFileSync(join(HERE, 'promote.tsv'),
  ['id\tverdict\tblocks\tg4worst\tg5worst\tholoOther'].concat(rows.map((r) => r.join('\t'))).join('\n') + '\n');

const np = rows.filter((r) => r[1] === 'pass').length;
console.log('读了 ' + files.length + ' 份日志（跑完并出裁决的 ' + rows.length + ' 枚）⇒ ✅ 可上槽 ' + np + ' 枚 / ⛔ ' +
  (rows.length - np) + ' 枚');
for (const r of rows) console.log('  ' + (r[1] === 'pass' ? '✅ ' : '⛔ ') + r[0].padEnd(18) + ' G4最坏 ' +
  (r[3] || '—') + '% · G5最坏 ' + (r[4] || '—') + '% · 送盾 ' + (r[5] === '' ? '—' : r[5]) + '/局  ' + r[2]);
console.log('已写 champion-map/promote.tsv');
