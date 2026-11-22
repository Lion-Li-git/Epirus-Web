#!/usr/bin/env node
/* land-recovered.mjs —— `anchor-recover --do` 之后的登记步（2026-11-22 · Qoder）
 *
 * 为什么单独要有这台工具：11-21 通宵班交接 §三.3 写的是"命中真 wid 后…同步更新 registry.tsv 的 sha256 与台账"。
 *   11-22 现读在册约定发现**前半句是错的**：`registry.tsv` 的 sha256 存的是**当年入库那份字节的历史指纹**，
 *   覆盖它 = 把 91 枚漂移件的出处证据抹掉。真正的约定是：
 *     · 字节逐位等于 registry.sha256            ⇒ 台账 state = ok（第 4 列留空）
 *     · 权重逐位同（widOf）但字节不同            ⇒ state = sha-diff-wid-same + 第 4 列写**盘上实际 sha**
 *     · registry.tsv 永不因登记而改动
 *   `--check` 就是对这条判据跑遍全表：在册 1,002 行必须零违例，否则说明上面三行是我编的。
 *
 * 用法：
 *   node tools/land-recovered.mjs --check                跑遍全表验约定（有违例 exit 1）
 *   node tools/land-recovered.mjs                        只报告"文件已回到原路径但仍标 missing"的待登记件
 *   node tools/land-recovered.mjs --ids=v7attr-31,...    指定枚
 *   node tools/land-recovered.mjs --do --ids=...         真改台账（改前逐枚自证 wid，任何一枚不过 ⇒ 整批不落盘）
 *   通用：--ledger= --out-note=   （本工具**不碰** registry.tsv，也不碰 git）
 *
 * 退出码：0 通过 ‖ 1 检查发现违例 ‖ 2 输入/自证不过（响亮失败，不落半张表）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { widOf } from '../champion-map/pack-id.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

if (process.argv[1] && process.argv[1].endsWith('land-recovered.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['check', 'do', 'ids', 'ledger', 'g3', 'quiet'], 'land-recovered');
}
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const CHECK = process.argv.includes('--check');
const DO = process.argv.includes('--do');
const QUIET = process.argv.includes('--quiet');
const LEDGER = arg('ledger', 'docs/ARTIFACT-LOSS-1119.tsv');
const say = (...a) => { if (!QUIET) console.log(...a); };

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tsv = (f) => readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n');

/* 身份目标：两张 lineage 表并读（与 anchor-recover 同口径：g3=2.0 节点 ‖ lineage.tsv=1.8 全集） */
const wantWid = new Map();
for (const f of ['champion-map/data/page/lineage.tsv', arg('g3', 'champion-map/data/page/lineage-g3.tsv')]) {
  let L; try { L = tsv(f); } catch (e) { continue; }
  const h = L[0].split('\t'), ix = Object.fromEntries(h.map((c, i) => [c, i]));
  for (const l of L.slice(1)) { const c = l.split('\t'); if (c[ix.id] && c[ix.wid] && !wantWid.has(c[ix.id])) wantWid.set(c[ix.id], c[ix.wid]); }
}

/* registry：pack_id → {sha256, path} */
const reg = tsv('champion-map/data/registry.tsv');
const rh = reg[0].split('\t'), rx = Object.fromEntries(rh.map((c, i) => [c, i]));
const REG = new Map();
for (const l of reg.slice(1)) { const c = l.split('\t'); if (c[rx.pack_id]) REG.set(c[rx.pack_id], { sha: c[rx.sha256], path: c[rx.path] }); }

const rawLedger = readFileSync(LEDGER, 'utf8');
const CRLF = rawLedger.includes('\r\n');
const L = rawLedger.replace(/\r/g, '').split('\n');
const lh = L[0].split('\t'), lx = Object.fromEntries(lh.map((c, i) => [c, i]));
const bodyIdx = L.map((l, i) => (i > 0 && l.trim() ? i : -1)).filter((i) => i > 0);
const rowAt = (i) => L[i].split('\t');
say('输入：台账 ' + LEDGER + ' 表体 ' + bodyIdx.length + ' 行 ‖ 身份目标 ' + wantWid.size + ' ‖ registry ' + REG.size + ' 行 ‖ 行尾 ' + (CRLF ? 'CRLF' : 'LF'));

if (CHECK) {
  /* 跑遍全表验三条判据；只在"文件在盘上"的行上有结论（missing/no-path 不参与，另计） */
  let ok = 0, drift = 0, badState = 0, badShaCol = 0, widMismatch = 0, unreadable = 0, noTarget = 0;
  const exBadState = [], exBadSha = [], exWid = [];
  for (const i of bodyIdx) {
    const c = rowAt(i);
    const id = c[lx.id], st = c[lx.state], path = c[lx.path], shaCol = c[lx.sha256] || '';
    if (st === 'no-path') continue;
    let buf = null;
    const cand = [path, (REG.get(id) || {}).path].filter(Boolean);
    for (const p of cand) if (existsSync(p)) { try { buf = readFileSync(p); } catch (e) { } if (buf) break; }
    if (!buf) { if (st === 'ok' || st === 'sha-diff-wid-same') { unreadable++; if (exBadState.length < 3) exBadState.push(id + '(' + st + ' 但文件不在盘)'); } continue; }
    const disk = sha(buf);
    const regRow = REG.get(id);
    const byteEqual = !!(regRow && regRow.sha === disk);
    const w = wantWid.get(id);
    if (!w) { noTarget++; continue; }
    let fw = null; try { fw = widOf(buf.toString('utf8')); } catch (e) { }
    if (fw !== w) { widMismatch++; if (exWid.length < 3) exWid.push(id + ' 盘上 wid=' + fw + ' ≠ 在册 ' + w); continue; }
    if (st === 'ok') { ok++; if (!byteEqual) { badState++; if (exBadState.length < 5) exBadState.push(id + ' 标 ok 但字节 ≠ registry.sha256'); } if (shaCol !== '') { badShaCol++; } }
    else if (st === 'sha-diff-wid-same') {
      drift++;
      if (byteEqual) { badState++; if (exBadState.length < 5) exBadState.push(id + ' 标 sha-diff 但字节其实逐位等于 registry.sha256（该记 ok）'); }
      if (shaCol !== disk) { badShaCol++; if (exBadSha.length < 5) exBadSha.push(id + ' 第 4 列不是盘上 sha（差 ' + (shaCol ? shaCol.slice(0, 10) : '空') + ' vs ' + disk.slice(0, 10) + '）'); }
    }
  }
  console.log('=== --check 三条判据跑遍全表 ===');
  console.log('  state=ok ' + ok + ' 枚（字节 == registry.sha256）‖ state=sha-diff-wid-same ' + drift + ' 枚（wid 同、字节不同）');
  console.log('  标错态 ' + badState + ' ‖ 第 4 列没记盘上 sha ' + badShaCol + ' ‖ wid 对不上在册 ' + widMismatch +
    ' ‖ 声称在册却读不到文件 ' + unreadable + ' ‖ 无 wid 目标（不参与判定）' + noTarget);
  if (exBadState.length) console.log('  标错态例：' + exBadState.join(' ‖ '));
  if (exBadSha.length) console.log('  第 4 列违例：' + exBadSha.join(' ‖ '));
  if (exWid.length) console.log('  wid 违例：' + exWid.join(' ‖ '));
  const bad = badState + badShaCol + widMismatch;
  console.log(bad === 0 ? '✅ 约定成立：零违例 ⇒ registry 不该被登记步改动' : '⛔ 有 ' + bad + ' 处违例 ⇒ 上面那三条判据与在册数据不一致，别照它写新行');
  process.exit(bad === 0 ? 0 : 1);
}

/* 待登记：台账仍标 missing，但文件已经回到原路径 */
const idsArg = (arg('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const targets = [];
for (const i of bodyIdx) {
  const c = rowAt(i);
  const id = c[lx.id];
  if (idsArg.length ? !idsArg.includes(id) : c[lx.state] !== 'missing') continue;
  targets.push({ i, id, path: c[lx.path], state: c[lx.state] });
}
if (!targets.length) { console.log('没有要登记的行（' + (idsArg.length ? '给的 --ids 在台账里找不到' : '台账里没有仍标 missing 的行') + '）'); process.exit(0); }

const regBefore = sha(readFileSync('champion-map/data/registry.tsv'));
const plan = [];
const refuse = [];
for (const t of targets) {
  if (!existsSync(t.path)) { refuse.push(t.id + '：文件不在 ' + t.path + '（先跑 anchor-recover --do）'); continue; }
  const buf = readFileSync(t.path);
  const disk = sha(buf);
  const w = wantWid.get(t.id);
  if (!w) { refuse.push(t.id + '：两张 lineage 表里都没有它的 wid 目标 ⇒ 无法验身份，不许登记'); continue; }
  const fw = widOf(buf.toString('utf8'));
  if (fw !== w) { refuse.push(t.id + '：盘上 wid=' + fw + ' ≠ 在册 ' + w + ' ⇒ 不是同一枚，拒绝'); continue; }
  const regRow = REG.get(t.id);
  const byteEqual = !!(regRow && regRow.sha === disk);
  plan.push({ ...t, disk, newState: byteEqual ? 'ok' : 'sha-diff-wid-same', newShaCol: byteEqual ? '' : disk, byteEqual });
}

console.log('候选 ' + targets.length + ' 枚 ‖ 自证通过 ' + plan.length + ' ‖ 拒绝 ' + refuse.length);
for (const p of plan) console.log('  ' + (p.byteEqual ? '✅ ok        ' : '✅ sha-diff  ') + p.id.padEnd(14) + '→ ' + p.path + (p.byteEqual ? '' : '（第 4 列记盘上 sha ' + p.disk.slice(0, 12) + '…）'));
for (const r of refuse) console.log('  ⛔ ' + r);
if (refuse.length) { console.log('⛔ 有枚没过自证 ⇒ 整批不落盘（要落就 --ids= 只挑过的那几枚）'); process.exit(2); }
if (!DO) { console.log('只报告。真登记要加 --do'); process.exit(0); }

for (const p of plan) {
  const c = rowAt(p.i);
  c[lx.state] = p.newState;
  c[lx.sha256] = p.newShaCol;
  L[p.i] = c.join('\t');
}
writeFileSync(LEDGER, L.join(CRLF ? '\r\n' : '\n'));

const after = readFileSync(LEDGER, 'utf8').replace(/\r/g, '').split('\n');
const rowsAfter = after.slice(1).filter((l) => l.trim()).length;
const regAfter = sha(readFileSync('champion-map/data/registry.tsv'));
const tally = {};
for (const l of after.slice(1)) { if (!l.trim()) continue; const c = l.split('\t'); tally[c[lx.state]] = (tally[c[lx.state]] || 0) + 1; }
console.log('已写 ' + LEDGER + '：state 分布 ' + Object.entries(tally).map(([k, v]) => k + '=' + v).join(' ‖ '));
console.log('自证：行数 ' + bodyIdx.length + ' → ' + rowsAfter + (bodyIdx.length === rowsAfter ? ' ✅ 没吞行' : ' ⛔ 行数变了') +
  ' ‖ registry.tsv 字节 ' + (regBefore === regAfter ? '未改动 ✅' : '**被改动了 ⛔ 立刻回滚**'));
console.log('下一步（本工具不碰 git、不碰 registry）：git add -f <落盘的 .bak> ' + LEDGER +
  ' ‖ node tools/map-audit.mjs ‖ node tools/land-recovered.mjs --check ‖ 定向门禁');
