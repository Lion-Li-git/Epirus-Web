/* sentinel-triage.mjs —— 把 `gate-sentinel` 报的那三类"钉文本"门**逐条摊开**给人看（一次性研究件，不进判据）
 *
 * 背景：`docs/GATE-SHIFTS.md` §七 规矩 1 说门禁只许测行为；`tools/gate-sentinel.mjs` 已经在**计数**
 *   （278 条门里 md 6 ‖ src 127 ‖ log 18），但它只给"哪条门中招 + 行号"，不给**中招那一句到底在比什么**。
 *   没有"比什么"就没法分诊：钉一个文件路径存在 ≠ 钉一句中文措辞，前者是"干净克隆里必须有这份件"那一族，
 *   后者才是规矩 1 要防的。这个脚本把每条门体里 `indexOf(...)` 的操作数与它所在的整行打出来。
 *
 * 分桶口径（判据写在人读的那份清单里，这里只按机械规则预分）：
 *   A 比的是**英文标识符/路径/API 名** ⇒ 多半是"这东西存在吗"，属可接受面（存在性），保留；
 *   C 比的是**含中文的措辞** ⇒ 正是规矩 1 点名的"匹配日志措辞/文档措辞"，要逐条判能不能换成行为；
 *   B 两者都有或读不出来 ⇒ 要人看。
 *
 * 用法：node docs/debug/sentinel-triage.mjs > champion-map/_sentinel-triage.txt
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = 'tools/np-test.mjs';
const lines = readFileSync(SRC, 'utf8').split('\n');
const starts = [];
for (let i = 0; i < lines.length; i++) if (/^t\(/.test(lines[i])) starts.push(i);
const gates = starts.map((s, k) => {
  const e = (k + 1 < starts.length ? starts[k + 1] : lines.length) - 1;
  return { start: s + 1, end: e + 1, text: lines.slice(s, e + 1).join('\n'), head: lines[s] };
});
const idOf = h => { const m = /^t\(['"]([^'"]+)['"]/.exec(h); return m ? m[1] : '—'; };

const has = (t, re) => re.test(t);
const cn = s => /[一-鿿]/.test(s);
/* 把门体里所有 `X.indexOf(Y)` 抽出来（Y 可能是变量 ⇒ 变量名一并打，人眼判） */
function pins(text) {
  const out = [];
  const re = /\.indexOf\(\s*([^)]{1,90}?)\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    const arg = m[1].trim();
    const lit = /^['"`]/.test(arg) ? arg.slice(1, -1) : null;
    out.push({ raw: arg, lit: lit, cnLit: lit !== null && cn(lit), varLike: lit === null });
  }
  return out;
}
const mdRead = t => /read(?:File)?Sync?\(([^)]*\.md[^)]*)\)/i.test(t);
/* 第二条轴：这条门**读的是什么东西**再去比字符串。规矩 1 真正防的是"拿实现细节/措辞当判据"，
 *   而"读一份文件确认它在"（干净克隆里必须有这份件）是另一件事 —— 不分开就没法分诊。 */
function subjects(text) {
  const s = new Set();
  const re = /['"]([\w./-]+\.(?:mjs|js|tsv|md|json|html|yml|ts))['"]/g;
  let m; while ((m = re.exec(text))) {
    const p = m[1];
    if (/\.md$/.test(p)) s.add('doc');
    else if (/\.html$/.test(p)) s.add('page');
    else if (/\.(tsv|json|ts)$/.test(p)) s.add('table');
    else if (/^(js|tools|champion-map|docs\/debug)\//.test(p)) s.add('src:' + p.split('/')[0]);
    else s.add('other:' + p);
  }
  if (/spawnSync\(|runE\(|execFileSync\(/.test(text)) s.add('spawn');
  return [...s];
}

const rows = [];
for (const g of gates) {
  const kinds = [];
  if (mdRead(g.text)) kinds.push('md');
  if (/read(?:File)?Sync\(/.test(g.text) && has(g.text, /\.indexOf\(/)) kinds.push('src');
  if (/(?:\.out\b|stdout|stderr)/.test(g.text) && has(g.text, /\.indexOf\(/)) kinds.push('log');
  if (!kinds.length) continue;
  const p = pins(g.text);
  const cnPins = p.filter(x => x.cnLit).map(x => x.lit);
  const idPins = p.filter(x => x.lit !== null && !x.cnLit).map(x => x.lit);
  const vars = p.filter(x => x.varLike).map(x => x.raw);
  const bucket = cnPins.length ? 'C' : (idPins.length ? 'A' : (vars.length ? 'B' : 'B'));
  rows.push({ id: idOf(g.head), line: g.start, end: g.end, kinds: kinds.join('+'), bucket: bucket,
    subj: subjects(g.text).join('+'), n: p.length, cnPins: cnPins, idPins: idPins, vars: vars });
}
/* 交叉表：桶（读的东西）× 语言（中文措辞 vs 标识符）。分诊就按这张表定先后。 */
const cross = {};
for (const r of rows) {
  const s = r.subj || 'unknown';
  cross[s] = cross[s] || { C: 0, A: 0, B: 0, ids: { C: [], A: [] } };
  cross[s][r.bucket]++;
  if (r.bucket !== 'B') cross[s].ids[r.bucket].push(r.id);
}
console.log('\n交叉表（读的对象 × 桶）：');
for (const s of Object.keys(cross).sort()) {
  const c = cross[s];
  console.log('  ' + s.padEnd(28) + ' C=' + c.C + ' A=' + c.A + ' B=' + c.B +
    (c.ids.C.length ? '   C 桶门号: ' + c.ids.C.slice(0, 12).join(' ') : ''));
}

const by = b => rows.filter(r => r.bucket === b);
console.log('门体里带 indexOf/read 的条目：' + rows.length + '（桶 C 含中文措辞 ' + by('C').length +
  ' ‖ 桶 A 只比英文/路径 ' + by('A').length + ' ‖ 桶 B 读不出操作数 ' + by('B').length + '）');
console.log('⚠ 桶是按"indexOf 的字面操作数里有没有中文"机械分的 ⇒ C 里也有合法的（比如钉一条**报错文案**本身就是产品契约），');
console.log('   B 里多半是操作数在变量/拼接里，脚本看不见 ⇒ 这两桶都要人过一遍，脚本只负责把面积量出来。');
for (const b of ['C', 'A', 'B']) {
  console.log('\n===== 桶 ' + b + '（' + by(b).length + ' 条）=====');
  for (const r of by(b)) {
    console.log(r.id + '@' + r.line + '-' + r.end + ' [' + r.kinds + '] 读=' + (r.subj || '?') + ' indexOf×' + r.n);
    if (r.cnPins.length) console.log('    中文串: ' + r.cnPins.slice(0, 6).map(s => '「' + s.slice(0, 40) + '」').join(' ‖ '));
    if (r.idPins.length) console.log('    英文串: ' + r.idPins.slice(0, 6).map(s => '「' + s.slice(0, 40) + '」').join(' ‖ '));
    if (r.vars.length) console.log('    变量式: ' + r.vars.slice(0, 5).join(' ‖ '));
  }
}
/* 顺带出一份 TSV，分诊文档里的表直接由它生成（人只写"建议"那一列） */
const TSV = ['gate', 'line', 'end', 'kinds', 'reads', 'bucket', 'n_indexOf', 'cn_pins', 'id_pins']
  .concat([]).join('\t');
const body = rows.map(r => [r.id, r.line, r.end, r.kinds, r.subj, r.bucket, r.n,
  r.cnPins.slice(0, 4).join(' | ').replace(/\s+/g, ' '), r.idPins.slice(0, 4).join(' | ').replace(/\s+/g, ' ')].join('\t'));
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../champion-map/_sentinel-rows.tsv'),
  TSV + '\n' + body.join('\n') + '\n', 'utf8');
console.log('\n已写 champion-map/_sentinel-rows.tsv（' + rows.length + ' 行 · 分诊文档的表由它生成）');
