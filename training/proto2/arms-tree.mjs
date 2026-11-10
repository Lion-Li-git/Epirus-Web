#!/usr/bin/env node
/* arms-tree.mjs — 冠军谱系树（文本版）（ZCode · 10-31 02:1x，DS 交班 P5 的第一块）
 *
 * 读 scratch/arms/*.meta.json 的 lineage（parent/seed/gen）+ holdoutFirst + mastery 终态，
 * 按"父本文件名"建森林打印。判定父子的键 = **文件名**（lineage.parent 是路径；outHash 与
 * parentHash 哈希构造不同——前者 md5(pack JSON)、后者 md5(文件字节)——不能互相对账，别用）。
 *
 * 用法：
 *   node tools/proto2/arms-tree.mjs                          # 全森林（451+ 枚，很长）
 *   node tools/proto2/arms-tree.mjs --root=CEM48c-s7.bak     # 只打某包的子树（名字后缀匹配）
 *   node tools/proto2/arms-tree.mjs --since=2026-10-31       # 只打该日期（mtime）后新增的节点及其祖先链
 *   node tools/proto2/arms-tree.mjs --root=CEM48c-s7.bak --mastery   # 有 mastery 段的臂印门终态
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const has = (k) => argv.indexOf('--' + k) >= 0;
const DIR = 'scratch/arms';

const nodes = new Map();   /* file -> {file, parent, seed, gen, first, fit, mastery, mtime, children:[]} */
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.meta.json')) continue;
  try {
    const m = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
    const file = f.replace(/\.meta\.json$/, '');
    nodes.set(file, {
      file,
      parent: m.lineage && m.lineage.parent ? String(m.lineage.parent).split(/[\\/]/).pop() : (m.parent || null),
      seed: m.lineage && m.lineage.seed,
      gen: m.lineage && m.lineage.gen,
      first: m.holdoutFirst,
      fit: m.holdoutFit,
      mastery: m.mastery && m.mastery.stat ? m.mastery : null,
      /* 空臂（10-31 千问加的标记）：产物与父本逐字节相同 ⇒ 这一臂零次接受，**不是分叉**。
       *   不标出来，图上就是"两条子代"（实测：OB3S-BIGT-s7/s11 与父本 md5 全等）。 */
      noOp: !!(m.lineage && m.lineage.noOp),
      voided: !existsSync(join(DIR, file)),
      input: (m.container && m.container.dims && m.container.dims.input) || null,
      mtime: statSync(join(DIR, f)).mtimeMs,
      children: [],
    });
  } catch (e) { /* 坏 meta 跳过 */ }
}
/* 挂孩子（父本不在册 ⇒ 根） */
for (const n of nodes.values()) {
  const p = n.parent && nodes.get(n.parent);
  if (p) p.children.push(n);
}
const roots = [...nodes.values()].filter((n) => !(n.parent && nodes.get(n.parent)));
const fmt = (n) => {
  const gf = n.first != null ? (100 * n.first).toFixed(0) + '%' : '----';
  const mast = n.mastery ? (' 门' + n.mastery.key + '(' + n.mastery.stat.pass + '/' + n.mastery.stat.audits + (n.mastery.stat.starved ? ',饿' + n.mastery.stat.starved : '') + (n.mastery.stat.spam ? ',spam' + n.mastery.stat.spam : '') + ')') : '';
  return n.file.padEnd(30) + ' gen' + (n.gen == null ? '?' : n.gen) + ' s' + (n.seed == null ? '?' : n.seed) + ' 夺1 ' + gf + mast +
    (n.input ? ' 面' + n.input : '') + (n.noOp ? ' **空臂(=父本)**' : '') + (n.voided ? ' [产物已归档读不出]' : '');
};
function walk(n, depth, out, mastery) {
  out.push('  '.repeat(depth) + (depth ? '└ ' : '') + fmt(n) + (mastery && !n.mastery && n.children.length ? '' : ''));
  const kids = [...n.children].sort((a, b) => a.mtime - b.mtime);
  for (const k of kids) walk(k, depth + 1, out, mastery);
}
let total = 0;
function collect(n, out) { out.push(n); for (const k of n.children) collect(k, out); }

const rootFilter = arg('root', '');
const since = arg('since', '');
let forest = roots;
if (rootFilter) {
  const r = nodes.get(rootFilter) || [...nodes.values()].find((n) => n.file.indexOf(rootFilter) >= 0);
  if (!r) { console.error('⛔ 找不到根：' + rootFilter); process.exit(2); }
  const sub = []; collect(r, sub); total = sub.length;
  console.log('== 子树 @ ' + r.file + '（' + sub.length + ' 节点）==');
  const out = []; walk(r, 0, out, has('mastery'));
  console.log(out.join('\n'));
} else {
  if (since) {
    const t = new Date(since + 'T00:00:00').getTime();
    const fresh = [...nodes.values()].filter((n) => n.mtime >= t);
    const keep = new Set();
    for (const n of fresh) { let cur = n; const chain = new Set(); while (cur) { if (chain.has(cur)) break; chain.add(cur); keep.add(cur); cur = cur.parent && nodes.get(cur.parent); } }
    forest = [...keep].filter((n) => !(n.parent && keep.has(nodes.get(n.parent))));
    total = keep.size;
    console.log('== 自 ' + since + ' 起的新增节点及其祖先链（' + total + ' 节点，' + forest.length + ' 棵）==');
  } else {
    total = nodes.size;
    console.log('== 全森林（' + nodes.size + ' 节点，' + forest.length + ' 棵根）==');
  }
  forest.sort((a, b) => a.mtime - b.mtime);
  for (const r of forest) {
    const out = []; walk(r, 0, out, has('mastery'));
    console.log(out.join('\n'));
  }
}
console.log('\n（父本判定键 = 文件名；outHash/parentHash 构造不同不可互对账。产物本体在 scratch/arms/，meta 摘要也在 scratch/arms/index.tsv）');
