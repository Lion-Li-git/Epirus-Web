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
 *   通用：--ledger= --out-note= --root=   （本工具**不碰** registry.tsv，也不碰 git）
 *
 * 第四条判据（11-23 夜班加 · 用户 11-23 23:0x 点名"自动工具要做好"）：包内 `META.ts` 不许是**扫描时刻**。
 *   来历：11-22 那晚扫出的 30 枚恢复件把 `2026-11-23 02:55–09:07` 写进了 `META.ts`，而 `registry.tsv` 里是 9 月的
 *   训出时刻 ⇒ `champion-map/lineage.mjs` 重生成时把这些点画到今天（`7457e99d` 才修完，并把 lineage 改成取最早值）。
 *   ⚠ 阈值不是"包内 ts 必须等于 registry ts"——现算 816 枚里 **235 枚对不上**，且 P90 **正好 8.000 小时**
 *     ⇒ 那是 `META` 走 UTC(`Z`) / `registry` 走本地钟**两个钟域**，不是漂移（另有 K5/D1a/K6 三枚差 126h，是历史异体）。
 *     拿"相等"当判据 ⇒ 一上桌就红 235 枚，第二天就会有人把这条腿关掉。所以只判**漏痕形状**：
 *     包内 ts 落在恢复战役窗口（`--leakSince=`，默认 2026-11-19 = 丢失台账开账那天）而 registry 更早 ⇒ 红。
 *
 * 退出码：0 通过 ‖ 1 检查发现违例 ‖ 2 输入/自证不过（响亮失败，不落半张表）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { widOf } from '../champion-map/pack-id.mjs';
import { rejectUnknownFlags, extractJsonObject } from './audit-lib.mjs';

if (process.argv[1] && process.argv[1].endsWith('land-recovered.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['check', 'do', 'ids', 'ledger', 'g3', 'quiet', 'root', 'leakSince', 'tsReport', 'lineage'], 'land-recovered');
}
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const CHECK = process.argv.includes('--check');
const DO = process.argv.includes('--do');
const QUIET = process.argv.includes('--quiet');
/* --root= 是给"变异夹具"用的：整棵树（registry / lineage / 台账 / 包）都相对它解析 ⇒
 *   证明这条腿真会红，而不用去动仓库里任何一枚在册件（R4 第③步：造一个它该抓的东西）。 */
const ROOT = arg('root', process.cwd()).replace(/[/\\]+$/, '');
const rp = (p) => (!p ? p : (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') ? p : ROOT + '/' + p));
const LEAK_SINCE = Date.parse(arg('leakSince', '2026-11-19T00:00:00Z'));
const TS_REPORT = arg('tsReport', '');
const LEDGER = arg('ledger', 'docs/ARTIFACT-LOSS-1119.tsv');
const say = (...a) => { if (!QUIET) console.log(...a); };

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tsv = (f) => readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n');

/* 包内 `META.ts` 是紧凑 JSON 里的 `"ts":"…"`（UTC 带毫秒），`registry.tsv` 那列是本地钟秒级
 *   ⇒ 两个钟域本来就不该字符串相等（现算 P90 正好差 8.000h）。这里只读不改语义，比对一律走 Date.parse。 */
const META_TS_RE = /"ts":"([^"]+)"/;
const metaTs = (txt) => { const m = META_TS_RE.exec(txt); return m ? m[1] : null; };
/* 只替换那一个字段，其余字节逐字保留（wid 只哈希权重数组 ⇒ 改 ts 不动身份） */
const setMetaTs = (txt, ts) => {
  const m = META_TS_RE.exec(txt);
  if (!m) return { txt, changed: false, why: '包内没有 "ts" 字段（老格式 .js？）' };
  if (m[1] === ts) return { txt, changed: false, why: '已逐字一致' };
  return { txt: txt.slice(0, m.index) + '"ts":"' + ts + '"' + txt.slice(m.index + m[0].length), changed: true, why: m[1] + ' → ' + ts };
};

/* 身份目标：lineage.tsv（2026-11-23 起 lineage-g3 退役） */
const wantWid = new Map();
const linKnob = new Map();
for (const f of [rp(arg('lineage', 'champion-map/data/page/lineage.tsv'))]) {
  let L; try { L = tsv(f); } catch (e) { continue; }
  const h = L[0].split('\t'), ix = Object.fromEntries(h.map((c, i) => [c, i]));
  for (const l of L.slice(1)) {
    const c = l.split('\t');
    if (c[ix.id] && c[ix.wid] && !wantWid.has(c[ix.id])) {
      wantWid.set(c[ix.id], c[ix.wid]);
      linKnob.set(c[ix.id], { oppsN: c[ix.oppsN], gens: c[ix.gens], mode: c[ix.mode] });
    }
  }
}

/* registry：pack_id → {sha256, path} */
const reg = tsv(rp('champion-map/data/registry.tsv'));
const rh = reg[0].split('\t'), rx = Object.fromEntries(rh.map((c, i) => [c, i]));
const REG = new Map();
for (const l of reg.slice(1)) { const c = l.split('\t'); if (c[rx.pack_id]) REG.set(c[rx.pack_id], { sha: c[rx.sha256], path: c[rx.path], ts: c[rx.ts] || '' }); }

const rawLedger = readFileSync(rp(LEDGER), 'utf8');
const CRLF = rawLedger.includes('\r\n');
const L = rawLedger.replace(/\r/g, '').split('\n');
const lh = L[0].split('\t'), lx = Object.fromEntries(lh.map((c, i) => [c, i]));
const bodyIdx = L.map((l, i) => (i > 0 && l.trim() ? i : -1)).filter((i) => i > 0);
const rowAt = (i) => L[i].split('\t');
say('输入：台账 ' + LEDGER + ' 表体 ' + bodyIdx.length + ' 行 ‖ 身份目标 ' + wantWid.size + ' ‖ registry ' + REG.size + ' 行 ‖ 行尾 ' + (CRLF ? 'CRLF' : 'LF'));

if (CHECK) {
  /* 跑遍全表验三条判据；只在"文件在盘上"的行上有结论（missing/no-path 不参与，另计） */
  let ok = 0, drift = 0, badState = 0, badShaCol = 0, widMismatch = 0, unreadable = 0, noTarget = 0;
  let tsJudged = 0, tsSame = 0, tsNoField = 0, tsClockSkew = 0, tsLeak = 0;
  let linJudged = 0, linStale = 0;
  const exBadState = [], exBadSha = [], exWid = [], exTs = [], exLin = [], tsRows = [];
  for (const i of bodyIdx) {
    const c = rowAt(i);
    const id = c[lx.id], st = c[lx.state], path = c[lx.path], shaCol = c[lx.sha256] || '';
    if (st === 'no-path') continue;
    let buf = null;
    const cand = [path, (REG.get(id) || {}).path].filter(Boolean).map(rp);
    for (const p of cand) if (existsSync(p)) { try { buf = readFileSync(p); } catch (e) { } if (buf) break; }
    if (!buf) { if (st === 'ok' || st === 'sha-diff-wid-same') { unreadable++; if (exBadState.length < 3) exBadState.push(id + '(' + st + ' 但文件不在盘)'); } continue; }
    const disk = sha(buf);
    const regRow = REG.get(id);
    const byteEqual = !!(regRow && regRow.sha === disk);
    const w = wantWid.get(id);
    if (!w) { noTarget++; continue; }
    const txt = buf.toString('utf8');
    let fw = null; try { fw = widOf(txt); } catch (e) { }
    if (fw !== w) { widMismatch++; if (exWid.length < 3) exWid.push(id + ' 盘上 wid=' + fw + ' ≠ 在册 ' + w); continue; }
    /* 第四条判据（恢复时间防复发）：包内 META.ts 落在恢复战役窗口、而 registry 记的是更早的历史时刻
     *   ⇒ 那是"扫描时刻被写进了权重件"（11-22 夜班 30 枚就这么把图谱画到今天过）。其余对不齐一律只报不判。 */
    {
      const regTs = (regRow && regRow.ts) || '';
      const inTs = metaTs(txt);
      if (!regTs) { /* registry 这一行没有 ts ⇒ 无结论（不是干净） */ }
      else if (!inTs) tsNoField++;
      else {
        tsJudged++;
        const a = Date.parse(inTs), b = Date.parse(regTs);
        const hrs = (isFinite(a) && isFinite(b)) ? (a - b) / 3600000 : NaN;
        const leak = isFinite(hrs) && a >= LEAK_SINCE && b < LEAK_SINCE;
        tsRows.push([id, st, inTs, regTs, isFinite(hrs) ? hrs.toFixed(2) : '', leak ? 'LEAK' : ''].join('\t'));
        if (leak) { tsLeak++; if (exTs.length < 6) exTs.push(id + ' 包内=' + inTs + ' ‖ registry=' + regTs + '（Δ' + hrs.toFixed(0) + 'h）'); }
        else if (inTs === regTs) tsSame++;
        else tsClockSkew++;
      }
    }
    /* 第五条判据（11-24 夜班加 · 门数不变）：**件上写得出的方法参数，表里不许还是 `-`**。
     *   来历：本班回收了 v7tgt5 三枚（wid 逐位命中），但 `lineage.tsv` 那三行的
     *   `oppsN/gens/mode` 仍是 `-` —— 因为这几列是 `champion-map/lineage.mjs` **从包内 META 烘出来的**
     *   （见其 :157/:492 `oppsN = m.opps.length`），包回来之后没人重跑生成器，表就落后于件。
     *   ⚠ 谓词必须**照生成器的推导式写**，不能拿 `pop` 去推 `oppsN`：
     *     第一版我就是这么写的，748 枚里误报 281 枚（`B-s63` 的 gens 其实是对的）——
     *     "一上桌就几百行红"的判据第二天就会被人关掉，那比没有判据更糟。
     *   按生成器同式重写后实测：可推 748 枚、落后 **0** 枚（刚重生成过），而对着修复前那份表应当正好点出 3 枚。 */
    {
      const k = linKnob.get(id);
      if (k) {
        const raw = extractJsonObject(txt, 'EPIRUS_CHAMPION_3P_META');
        let mm = null; if (raw) { try { mm = JSON.parse(raw); } catch (e) { mm = null; } }
        if (mm) {
          const nOpps = Array.isArray(mm.opps) ? mm.opps.length : (typeof mm.opps === 'string' && mm.opps ? mm.opps.split(',').filter(Boolean).length : 0);
          const deriv = {};
          if (nOpps) deriv.oppsN = String(nOpps);
          if (mm.gens !== undefined) deriv.gens = String(mm.gens);
          if (mm.mode !== undefined) deriv.mode = String(mm.mode);
          const blank = (v) => v === undefined || v === null || v === '' || v === '-';
          const miss = Object.keys(deriv).filter((c) => blank(k[c]));
          if (Object.keys(deriv).length) { linJudged++; if (miss.length) { linStale++; if (exLin.length < 5) exLin.push(id + ' 件里可推 ' + miss.map((c) => c + '=' + deriv[c]).join('/') + ' 而表里是 `-`'); } }
        }
      }
    }
    if (st === 'ok') { ok++; if (!byteEqual) { badState++; if (exBadState.length < 5) exBadState.push(id + ' 标 ok 但字节 ≠ registry.sha256'); } if (shaCol !== '') { badShaCol++; } }
    else if (st === 'sha-diff-wid-same') {
      drift++;
      if (byteEqual) { badState++; if (exBadState.length < 5) exBadState.push(id + ' 标 sha-diff 但字节其实逐位等于 registry.sha256（该记 ok）'); }
      if (shaCol !== disk) { badShaCol++; if (exBadSha.length < 5) exBadSha.push(id + ' 第 4 列不是盘上 sha（差 ' + (shaCol ? shaCol.slice(0, 10) : '空') + ' vs ' + disk.slice(0, 10) + '）'); }
    }
  }
  console.log('=== --check 五条判据跑遍全表 ===');
  console.log('  state=ok ' + ok + ' 枚（字节 == registry.sha256）‖ state=sha-diff-wid-same ' + drift + ' 枚（wid 同、字节不同）');
  console.log('  标错态 ' + badState + ' ‖ 第 4 列没记盘上 sha ' + badShaCol + ' ‖ wid 对不上在册 ' + widMismatch +
    ' ‖ 声称在册却读不到文件 ' + unreadable + ' ‖ 无 wid 目标（不参与判定）' + noTarget);
  if (exBadState.length) console.log('  标错态例：' + exBadState.join(' ‖ '));
  if (exBadSha.length) console.log('  第 4 列违例：' + exBadSha.join(' ‖ '));
  if (exWid.length) console.log('  wid 违例：' + exWid.join(' ‖ '));
  console.log('  第四条（恢复时间 ' + arg('leakSince', '2026-11-19T00:00:00Z') + ' 起算）：有结论 ' + tsJudged + ' 枚 ‖ 逐字一致 ' + tsSame +
    ' ‖ 钟域/历史差（只报不判）' + tsClockSkew + ' ‖ ⚠ 扫描时刻残留 ' + tsLeak + ' ‖ 包内读不到 ts（**无结论，不是干净**）' + tsNoField);
  if (exTs.length) console.log('  扫描时刻残留：' + exTs.join(' ‖ '));
  if (TS_REPORT) { writeFileSync(rp(TS_REPORT), 'id\tstate\tmetaTs\tregistryTs\tdeltaHours\tleak\n' + tsRows.join('\n') + '\n'); console.log('  时间戳账本已落盘：' + TS_REPORT + '（' + tsRows.length + ' 行）'); }
  console.log('  第五条（表不许落后于件）：件里可推方法参数 ' + linJudged + ' 枚 ‖ 表里仍是 `-` 的 ' + linStale + ' 枚');
  if (exLin.length) console.log('  表落后（跑 `node champion-map/lineage.mjs` 后按 bake-flags 重烘页面即可清）：' + exLin.join(' ‖ '));
  const bad = badState + badShaCol + widMismatch + tsLeak + linStale;
  console.log(bad === 0 ? '✅ 约定成立：零违例 ⇒ registry 不该被登记步改动，无扫描时刻残留，表也没落后于件' : '⛔ 有 ' + bad + ' 处违例 ⇒ 上面那五条判据与在册数据不一致，别照它写新行');
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

const regBefore = sha(readFileSync(rp('champion-map/data/registry.tsv')));
const plan = [];
const refuse = [];
for (const t of targets) {
  if (!existsSync(rp(t.path))) { refuse.push(t.id + '：文件不在 ' + t.path + '（先跑 anchor-recover --do）'); continue; }
  const buf = readFileSync(rp(t.path));
  const disk = sha(buf);
  const w = wantWid.get(t.id);
  if (!w) { refuse.push(t.id + '：两张 lineage 表里都没有它的 wid 目标 ⇒ 无法验身份，不许登记'); continue; }
  const fw = widOf(buf.toString('utf8'));
  if (fw !== w) { refuse.push(t.id + '：盘上 wid=' + fw + ' ≠ 在册 ' + w + ' ⇒ 不是同一枚，拒绝'); continue; }
  const regRow = REG.get(t.id);
  /* 登记时顺手堵恢复时间：包内 META.ts 落在恢复窗口而 registry 更早 ⇒ 那正是"扫描时刻被写进权重件"，
   *   按 registry 的历史时刻改回**那一个字段**（其余字节逐字不动；wid 只哈希权重 ⇒ 身份不变）。
   *   钟域差/历史异体（如 registry 本地钟 vs 包内 UTC，P90 正好 8h）**不动**——那是两本账，不是漏痕。 */
  let bufNow = buf, diskNow = disk, tsFix = '';
  {
    const regTs = (regRow && regRow.ts) || '';
    const txt0 = buf.toString('utf8');
    const inTs = metaTs(txt0);
    if (regTs && inTs) {
      const a = Date.parse(inTs), b = Date.parse(regTs);
      if (isFinite(a) && isFinite(b) && a >= LEAK_SINCE && b < LEAK_SINCE) {
        const r = setMetaTs(txt0, regTs);
        if (r.changed) {
          tsFix = '包内 META.ts ' + r.why;
          if (DO) { writeFileSync(rp(t.path), r.txt); bufNow = readFileSync(rp(t.path)); diskNow = sha(bufNow); }
        }
      }
    }
  }
  const byteEqual = !!(regRow && regRow.sha === diskNow);
  plan.push({ ...t, disk: diskNow, tsFix, newState: byteEqual ? 'ok' : 'sha-diff-wid-same', newShaCol: byteEqual ? '' : diskNow, byteEqual });
}

console.log('候选 ' + targets.length + ' 枚 ‖ 自证通过 ' + plan.length + ' ‖ 拒绝 ' + refuse.length);
for (const p of plan) console.log('  ' + (p.byteEqual ? '✅ ok        ' : '✅ sha-diff  ') + p.id.padEnd(14) + '→ ' + p.path +
  (p.tsFix ? ' ‖ ⚑ 回写 ' + p.tsFix + (DO ? '（已写）' : '（**未写**，加 --do 才动文件）') : '') +
  (p.byteEqual ? '' : '（第 4 列记盘上 sha ' + p.disk.slice(0, 12) + '…）'));
for (const r of refuse) console.log('  ⛔ ' + r);
if (refuse.length) { console.log('⛔ 有枚没过自证 ⇒ 整批不落盘（要落就 --ids= 只挑过的那几枚）'); process.exit(2); }
if (!DO) { console.log('只报告。真登记要加 --do'); process.exit(0); }

for (const p of plan) {
  const c = rowAt(p.i);
  c[lx.state] = p.newState;
  c[lx.sha256] = p.newShaCol;
  L[p.i] = c.join('\t');
}
writeFileSync(rp(LEDGER), L.join(CRLF ? '\r\n' : '\n'));

const after = readFileSync(rp(LEDGER), 'utf8').replace(/\r/g, '').split('\n');
const rowsAfter = after.slice(1).filter((l) => l.trim()).length;
const regAfter = sha(readFileSync(rp('champion-map/data/registry.tsv')));
const tally = {};
for (const l of after.slice(1)) { if (!l.trim()) continue; const c = l.split('\t'); tally[c[lx.state]] = (tally[c[lx.state]] || 0) + 1; }
console.log('已写 ' + LEDGER + '：state 分布 ' + Object.entries(tally).map(([k, v]) => k + '=' + v).join(' ‖ '));
console.log('自证：行数 ' + bodyIdx.length + ' → ' + rowsAfter + (bodyIdx.length === rowsAfter ? ' ✅ 没吞行' : ' ⛔ 行数变了') +
  ' ‖ registry.tsv 字节 ' + (regBefore === regAfter ? '未改动 ✅' : '**被改动了 ⛔ 立刻回滚**'));
console.log('下一步（本工具不碰 git、不碰 registry）：git add -f <落盘的 .bak> ' + LEDGER +
  ' ‖ node tools/map-audit.mjs ‖ node tools/land-recovered.mjs --check ‖ 定向门禁');
