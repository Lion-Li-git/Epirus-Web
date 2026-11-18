#!/usr/bin/env node
/* attach-a-greedy.mjs —— 把 A 轴贪心全量重测（exam4-a-exam-{multi,long}-1118.tsv）接进 readings
 * 用法：node tools/attach-a-greedy.mjs [--dry]
 * 输出：readings/current.tsv 追加 a-v2coop-exam-1118 行；rulers/batches 补参考尺。
 * 口径：A 轴 exam dose（ε=0），与 a-v2coop-page-1114 同协议（rounds=100、seed=77000、coop=v3）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DATA = join(ROOT, 'champion-map/data');
const DRY = process.argv.includes('--dry');
const RID = 'a-v2coop-exam-1118';
const BATCH = RID;
const FILES = [['multi', 'exam4-a-exam-multi-1118.tsv'], ['long', 'exam4-a-exam-long-1118.tsv']];

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const table = (p) => { const L = read(p); const h = L[0].split('\t'); const ix = {}; h.forEach((c, i) => ix[c] = i); return { h, ix, rows: L.slice(1).map((l) => l.split('\t')) }; };
const write = (p, h, rows) => { if (!DRY) writeFileSync(p, [h.join('\t')].concat(rows.map((r) => r.join('\t'))).join('\n') + '\n', 'utf8'); };

const rdP = join(DATA, 'readings/current.tsv');
const rd = table(rdP);
const kept = rd.rows.filter((r) => r[rd.ix.ruler_id] !== RID);
const add = [];
for (const [horRaw, fn] of FILES) {
  const hor = horRaw === 'multi' ? 'short' : 'long';
  const t = table(join(ROOT, 'champion-map', fn));
  for (const r of t.rows) {
    const id = r[t.ix.id];
    for (const c of [2, 3, 5, 8]) {
      const v = r[t.ix['x' + c]];
      if (v === '' || v === undefined) continue;
      add.push([id, RID, String(c), hor, v, r[t.ix['n' + c]], BATCH, '']);
    }
  }
}
write(rdP, rd.h, kept.concat(add));
console.log('readings +' + add.length + ' 行（旧 ' + rd.rows.length + ' → ' + (kept.length + add.length) + '）');

const ruP = join(DATA, 'rulers.tsv');
const ru = table(ruP);
const rr = ru.rows.filter((r) => r[ru.ix.ruler_id] !== RID);
rr.push([RID, 'A', 'v2 脚本桌 + 配合剧本局（exam dose ε=0）· A 轴贪心半边', 'reference', 'excess', 'v2-scripts', BATCH, '',
  '2026-11-18 A 轴全量贪心重测（999 包 × 2 桌形 × 100 回合，seed=77000，coop=v3；与 a-v2coop-page-1114 同协议，只换剂量）']);
write(ruP, ru.h, rr);
console.log('rulers：' + RID + ' → reference');

const baP = join(DATA, 'batches.tsv');
const ba = table(baP);
const br = ba.rows.filter((r) => r[ba.ix.batch_id] !== BATCH);
br.push([BATCH, RID, 'A', 'v2-scripts', 'v2 脚本桌 28 席 + coop v3', '1118',
  'champion-map/exam4-a-exam-multi-1118.tsv + exam4-a-exam-long-1118.tsv', String(add.length / 8), '2026-11-18',
  '2026-11-18 A 轴贪心全量重测（multi+long；9 枚 docs/artifacts 旧包子进程失败，未入表）']);
write(baP, ba.h, br);
console.log('batches：' + BATCH + (DRY ? '（dry-run 未写盘）' : ' 就位'));
