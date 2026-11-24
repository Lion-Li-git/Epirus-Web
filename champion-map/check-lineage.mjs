#!/usr/bin/env node
/* 2.0 谱系生成物的只读一致性检查：不读权重、不重算家族、不写文件。
 * registry 是 2.0 血统真源；缺历史权重时仍可验证 page/lineage.tsv 没有忘记同步。 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from '../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
rejectUnknownFlags(process.argv.slice(2), ['registry', 'lineage'], 'check-lineage');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const REG = resolve(ROOT, arg('registry', 'champion-map/data/registry.tsv'));
const LIN = resolve(ROOT, arg('lineage', 'champion-map/data/page/lineage.tsv'));
if (!existsSync(REG) || !existsSync(LIN)) { console.error('⛔ 缺 registry 或 lineage 表'); process.exit(2); }
const read = (p) => {
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const h = L[0].split('\t');
  return L.slice(1).map((l) => { const c = l.split('\t'); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ''])); });
};
const reg = read(REG), lin = read(LIN), byId = new Map();
for (const r of lin) {
  if (byId.has(r.id)) { console.error('⛔ lineage 重复 id=' + r.id); process.exit(2); }
  byId.set(r.id, r);
}
const rows = reg.filter((r) => String(r.ver).startsWith('2.0'));
const errors = [];
for (const r of rows) {
  const l = byId.get(r.pack_id);
  if (!l) { errors.push(r.pack_id + ': lineage 缺行'); continue; }
  for (const [a, b] of [['fam', 'fam'], ['fam_label', 'famLabel'], ['parentOf', 'parentOf'], ['parentOf2', 'parentOf2'], ['parentOf3', 'parentOf3']]) {
    if (String(r[a] || '') !== String(l[b] || '')) errors.push(r.pack_id + ': ' + a + ' registry=' + (r[a] || '') + ' lineage=' + (l[b] || ''));
  }
  const rw = String(r.wid || ''), lw = String(l.wid || '');
  if (rw && lw && !(lw.startsWith(rw) || rw.startsWith(lw))) errors.push(r.pack_id + ': wid registry=' + rw + ' lineage=' + lw);
}
if (errors.length) {
  console.error('⛔ 2.0 lineage 与 registry 不一致 ' + errors.length + ' 条（前 12）：\n  ' + errors.slice(0, 12).join('\n  '));
  process.exit(1);
}
console.log('LINEAGE_CHECK_OK 2.0 rows=' + rows.length + '（只读，未重算家族）');
