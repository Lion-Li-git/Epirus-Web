#!/usr/bin/env node
/* table-census.mjs —— 把 `champion-map/` 里**所有**点数据表过一遍：谁在册、谁被忽略、谁有人读、读它的在哪一行。
 *
 * 为什么要单独一台（10-13 夜班 · 用户「那你把所有表都查一下」）：
 *   并表那次（§E593 夜班 S1）只动了 **git 在册**那一部分，而目录里另有两百多张表 git 根本不认识
 *   （`_*` 前缀被 .gitignore 整类吃掉 = 待裁 #18 的洞）⇒ "文件有没有变少"这个问题在 `ls` 上、在 `git ls-files` 上
 *   答案不一样，必须三个口径一起摆出来才读得对。
 *   第二台的原因同 `METHODOLOGY.md` 第 120 条那族：**判据要能碰到那一格** —— 光看"在册 152→79"看不见盘上还剩 327 张。
 *
 * 三类读者分开数（这条是 S1 那次踩出来的：注释里点名 = 说明书式读者，照样不能删）：
 *   CODE  = 去掉注释之后还出现（`readFileSync`/路径字符串里真在用）
 *   DOC   = 只在注释里出现（`--table=<本表名>` 这类用法行）
 *   MD    = 出现在 `docs/**.md` ‖ CHANGELOG ‖ README（D230 管的就是这一类）
 *
 * 用法：node champion-map/table-census.mjs [--json] [--only=untracked|tracked|all] [--name=<子串>]
 * 退出码：0 = 普查完成（**它不判该不该删**，只把事实摆齐）‖ 2 = 输入不齐（读不到目录/容器）
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { batches, MAP, ROOT } from './point-data.mjs';

/* ⚠ 本仓现成的 `server/knob-guard.mjs` 那份 `stripComments` **不保留行数**（实测：三行块注释摘掉之后总行数 -1）。
 *   普查要把命中报成 `文件:行号`，偏移量与行数必须同源于一份文本 ⇒ 这里自带一把**等行数**的去注释：
 *   注释里的字符换成空格、换行一个不删。判"有没有读者"用哪把都一样，报行号只有这把是对的
 *   （上一版本拿"去注释后的偏移"去数"原文的行"，九条 CODE 命中的行号全是错的）。 */
function stripKeepLines(t) {
  let out = '', i = 0, st = 0;   // 0 代码 ‖ 1 单引号 ‖ 2 双引号 ‖ 3 块注释 ‖ 4 行注释
  while (i < t.length) {
    const c = t[i], d = t[i + 1];
    if (st === 0) {
      if (c === "'" && d !== '\n') { st = 1; }
      else if (c === '"') { st = 2; }
      else if (c === '/' && d === '*') { st = 3; }
      else if (c === '/' && d === '/') { st = 4; }
      out += c; i++;
    } else if (st === 1) { out += c; if (c === '\\') { out += t[i + 1] || ''; i += 2; continue; } if (c === "'") st = 0; i++; }
    else if (st === 2) { out += c; if (c === '\\') { out += t[i + 1] || ''; i += 2; continue; } if (c === '"') st = 0; i++; }
    else if (st === 3) { if (c === '*' && d === '/') { out += '  '; st = 0; i += 2; continue; } out += c === '\n' ? '\n' : ' '; i++; }
    else { if (c === '\n') { out += '\n'; st = 0; } else out += ' '; i++; }
  }
  return out;
}
const blank2 = s => s.replace(/[^\n]/g, ' ');   /* html/yml 的注释也等行数摘掉（理由同上：行号必须对得上原文） */

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const ONLY = arg('only', 'all'), NAMEF = arg('name', ''), JSONOUT = process.argv.includes('--json');

const files = readdirSync(MAP).filter(f => /\.(tsv|txt)$/.test(f) && (!NAMEF || f.includes(NAMEF)));
if (!files.length) { console.error('⛔ 一张表都没读到（--name=' + NAMEF + ' 筛空了？）'); process.exit(2); }

const tracked = new Set(execSync('git ls-files champion-map', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n')
  .map(s => s.replace(/^champion-map\//, '')));
/* 忽略判定按**每个文件**问一次 git（整目录一把梭会把"没匹配上任何规则"与"被忽略"混成一类）*/
const ignored = new Set();
for (const f of files) {
  try { execSync('git check-ignore -q "champion-map/' + f + '"', { cwd: ROOT, stdio: 'ignore' }); ignored.add(f); } catch (e) { /* 没被忽略 */ }
}
const inContainer = new Set(batches());

/* 读者面：仓库里所有代码 + markdown，**排除表文件自己**（否则一张表里的 id 会算成引用） */
const SRC_DIRS = ['champion-map', 'tools', 'server', 'docs/debug', 'js', '.github/workflows'];
const code = [], docs = [];
const walk = d => { const o = []; for (const e of readdirSync(d, { withFileTypes: true })) {
  if (e.name === 'node_modules' || e.name === '.git') continue; const p = join(d, e.name);
  if (e.isDirectory()) o.push(...walk(p)); else o.push(p); } return o; };
for (const r of SRC_DIRS) { const rd = join(ROOT, r); if (!existsSync(rd)) continue;
  for (const p of walk(rd)) {
    const base = p.slice(rd.length + 1);
    if (/\.(mjs|js|html|yml)$/.test(p)) { let t = ''; try { t = readFileSync(p, 'utf8'); } catch (e) { continue; }
      code.push({ f: r + '/' + base, raw: t, stripped: /\.(mjs|js)$/.test(p) ? stripKeepLines(t) : t.replace(/<!--[\s\S]*?-->/g, m => blank2(m)).replace(/^\s*(#|\/\/).*$/gm, '') }); }
  } }
for (const p of [join(ROOT, 'CHANGELOG.md'), join(ROOT, 'README.md')]) if (existsSync(p)) docs.push({ f: p.slice(ROOT.length + 1).replace(/\\/g, '/'), t: readFileSync(p, 'utf8') });
if (existsSync(join(ROOT, 'docs'))) for (const p of walk(join(ROOT, 'docs'))) if (/\.md$/.test(p)) docs.push({ f: p.slice(ROOT.length + 1).replace(/\\/g, '/'), t: readFileSync(p, 'utf8') });

const lineOf = (t, ix) => t.slice(0, ix).split(String.fromCharCode(10)).length;
const rows = files.map(f => {
  const hits = { CODE: [], DOC: [], MD: [] };
  for (const c of code) {
    if (c.f.endsWith('/' + f) || c.f === f) continue;                       /* 表自己不算读者 */
    const iRaw = c.raw.indexOf(f), iStr = c.stripped.indexOf(f);
    if (iStr >= 0) hits.CODE.push(c.f + ':' + lineOf(c.stripped, iStr));
    else if (iRaw >= 0) hits.DOC.push(c.f + ':' + lineOf(c.raw, iRaw));
  }
  for (const d of docs) { const i = d.t.indexOf(f); if (i >= 0) hits.MD.push(d.f + ':' + lineOf(d.t, i)); }
  const st = statSync(join(MAP, f));
  return { f, tracked: tracked.has(f), ignored: ignored.has(f), inContainer: inContainer.has(f),
    bytes: st.size, mtime: st.mtime.toISOString().slice(0, 16).replace('T', ' '), lines: readFileSync(join(MAP, f), 'utf8').replace(/\r\n/g, '\n').trim().split('\n').length,
    code: hits.CODE, doc: hits.DOC, md: hits.MD };
});

const keep = ONLY === 'all' ? rows : rows.filter(r => ONLY === 'tracked' ? r.tracked : !r.tracked);
if (JSONOUT) { console.log(JSON.stringify(keep)); process.exit(0); }

const cls = r => r.tracked ? (r.code.length ? 'A 在册·代码在读' : r.doc.length ? 'B 在册·只在说明书里点名' : r.md.length ? 'C 在册·被文档引用' : 'D 在册·无人点名')
  : (r.code.length ? 'E 未入库·被代码点名（多为工具的写落点）' : r.doc.length || r.md.length ? 'F 未入库·被点名' : 'G 未入库·零引用（清候选）');
const by = {};
for (const r of keep) (by[cls(r)] = by[cls(r)] || []).push(r);
console.log('普查 champion-map 的表：共 ' + keep.length + ' 张（目录里 .tsv/.txt 合计 ' + files.length +
  ' ‖ git 在册 ' + rows.filter(r => r.tracked).length + ' ‖ 被 .gitignore 吃掉 ' + rows.filter(r => r.ignored).length +
  ' ‖ 已在容器里 ' + rows.filter(r => r.inContainer).length + '）\n');
for (const k of Object.keys(by).sort()) {
  const v = by[k];
  console.log('── ' + k + ' · ' + v.length + ' 张 ‖ 合计 ' + (v.reduce((a, x) => a + x.bytes, 0) / 1024).toFixed(0) + ' KB');
  for (const r of v.slice(0, 200)) {
    const w = (r.code.length ? 'CODE ' + r.code.length : '') + (r.doc.length ? ' DOC ' + r.doc.length : '') + (r.md.length ? ' MD ' + r.md.length : '');
    console.log('   ' + r.f.padEnd(38) + String((r.bytes / 1024).toFixed(1) + 'KB/' + r.lines + '行').padEnd(16) +
      r.mtime + '  容器:' + (r.inContainer ? '有' : '—') + '  ' + (w || '（零引用）') +
      (w ? '  ← ' + [...r.code, ...r.doc, ...r.md].slice(0, 2).join(' ‖ ') : ''));
  }
  if (v.length > 200) console.log('   … 另 ' + (v.length - 200) + ' 张（--json 出全量）');
}
console.log('\n读法：A/B/C/D 是"能不能删"的**证据**，不是判决 —— 一台普查不替人裁"该不该清"。' +
  '\nG 类（未入库 + 零引用）才是可清候选；E/F 类的"点名"**不分读写** —— 本班实测 E 那 9 条全是工具自己的落盘默认值（`arg(out=…)` 那种），不是依赖 ⇒ 逐条读那一行再判。');
