/* 未跟踪件分诊（只报不删）：每件给 大小 / 类别 / 是否被在册 md 引用。
 * 目的：回答"哪些清掉会断证据链、哪些是纯中间件"，删除动作一律等用户点头。 */
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const others = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
const mds = git(['ls-files', '*.md']).split('\n').filter(Boolean);
const corpus = mds.map(f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');

const rows = [];
for (const f of others) {
  let size = 0; try { size = statSync(f).size; } catch { /* 目录或已消失 */ }
  const base = f.split('/').pop();
  let cls;
  if (/\.bak-/.test(base)) cls = '备份';
  else if (/\.(png|jpg|html|dom)$/.test(base)) cls = '取证快照';
  else if (/\.(tsv|csv)$/.test(base) && size > 0) {
    const ls = readFileSync(f, 'utf8').split('\n').filter(x => x.trim());
    /* .tsv 后缀也可能是 JSONL 台账（triplet-ledger 就是）：一行 JSON ≠ 只有表头 */
    cls = ls[0].trimStart().startsWith('{') ? 'JSONL台账(' + ls.length + ' 条)' : (ls.length <= 1 ? '空表(只有表头)' : '读数表');
  }
  else if (/\.(js|mjs|py|sh)$/.test(base)) cls = base.endsWith('.js') && size > 50000 ? '权重产物' : '探针/脚本';
  else cls = '其他';
  /* 引用判据分两级：全路径命中才算真被引用；只命中 basename 的（ruler.tsv/coverage.mjs 这类通用名）
   * 很可能是别处的同名件 ⇒ 标"同名待核"，不许拿它当收编理由。 */
  const cited = corpus.includes(f) ? '路径被引用' : (corpus.includes(base) ? '同名待核' : '—');
  rows.push({ f, kb: (size / 1024).toFixed(1), cls, cited });
}
const rank = (c) => c === '路径被引用' ? 2 : (c === '同名待核' ? 1 : 0);
rows.sort((a, b) => rank(b.cited) - rank(a.cited) || a.cls.localeCompare(b.cls) || a.f.localeCompare(b.f));
console.log('未跟踪件 ' + rows.length + ' 个（git ls-files --others --exclude-standard）‖ 在册 md ' + mds.length + ' 份作为引用面');
console.log('文件\tKB\t类别\t文档引用');
for (const r of rows) console.log([r.f, r.kb, r.cls, r.cited].join('\t'));
const by = {};
for (const r of rows) { const k = r.cls + (rank(r.cited) ? '·' + r.cited : ''); by[k] = (by[k] || 0) + 1; }
console.log('\n分类计数: ' + JSON.stringify(by, null, 0));
console.log('⛔ 本脚本不删任何文件。');