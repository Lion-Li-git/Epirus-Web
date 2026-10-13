/* point-data.mjs —— champion-map 的**单文件数据容器**与统一读取接口（v1.7.4 · 10-13 夜班 S1）
 *
 * ## 为什么（用户 10-13 原话）
 * 「尽量把所有表都合并，有些表有人读的话你可以设计一个统一的接口引用数据而不是留着一堆表」
 *   普查（现测）：`champion-map/` 入库 152 个 `.tsv/.txt`，但只有 53 种表头 —— **33 张共用同一个 15 列的
 *   "逐席六格"表头**，40 种是独苗；那 37 个 `.txt` 一个制表符都没有（是打印报告，不是表）。
 *   ⇒ 同一件事被存成上百个文件，每做一次实验就多一摞；"点的数据"没有单一入口。
 *
 * ## 容器形状：逐行原文，不重新编码数据
 * `point-data.tsv` 每条记录以 `<kind>\t<family>\t<batch>\t<原文那一行…>` 存：
 *   · `hdr` 一行：该口径族的**表头原文**（族键 = 表头的 sha1 前 6 位 ⇒ 族名从数据来，不是手抄名单）
 *   · `row` 一行：某张旧表的一行，**逐字保留**（含它自己的制表符；不拆成列、不转型、不排序）
 * 为什么不用 (id,metric,value) 长表：现测 EAV 会把 2.03MB 的 79 张表膨胀到 3.69MB（1.8×，
 *   比现在全部入库表加起来还大）——那是把"重复"从文件间搬进文件内，不叫整洁。
 *   逐行原文 = **零膨胀 + 可逐字节还原**，解析交给接口（唯一的实现点），而不是交给存储格式。
 *
 * ## 三条纪律（本仓栽过的那几族）
 * ① **入库面 ≠ 盘上**：只并 `git ls-files` 里有的。`champion-map/_*.{tsv,txt}` 被 .gitignore 挡着（114~115 行），
 *    本机有、干净克隆里没有 ⇒ 按 `readdirSync` 并就是把本机一次性产物烤进一张要入库的总表（干净克隆里主表指着不存在的批次）。
 *    拿不到 `git ls-files` 就**抛错拒绝**，不许猜。
 * ② **牙靠回归**：`--self-test` 对每张仍在盘上的旧表做**逐字节重建比对**，再加一条**合成正对照**
 *    （篡改一个字符 ⇒ 必须红）。接口自己没牙 = 又一次"分支堆了不等于吞吐量"。
 * ③ **不许静默降级**：契约真源与解析不了的文件一律跳过/拒收并点名（`NEVER_MERGE` ‖ `report.refused`）。
 *
 * 用法：`node champion-map/point-data.mjs --report`（普查，不写盘）
 *       `node champion-map/point-data.mjs --build [--include-readers]`（生成容器 + 迁移报告）
 *       `node champion-map/point-data.mjs --self-test`（逐字节回归 + 正对照）
 * 接口：`import { records, batches, rows, valueOf, reconstruct, families } from './point-data.mjs'`
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
/* 去注释的单一实现（本仓"注释里提到的键名/文件名不算读过"这条规矩就住在它里面） */
import { stripComments } from '../server/knob-guard.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MAP = join(ROOT, 'champion-map');
export const MASTER = join(MAP, 'point-data.tsv');
const CODE_ROOTS = ['tools', 'server', 'js', 'champion-map', 'tests', '.github'];
const TXT_FAMILY = 'report-print';

/* 名单/边表类：语义不是"某枚冠军的读数" ⇒ 永不并进容器，跳过要说清为什么（不许静默） */
export const NEVER_MERGE = {
  'pool-members.tsv': '池成员名单（契约 §2 真源 ‖ 门 D234 的输入）—— 是"谁在池里"，不是"谁考了多少分"',
  'pool-members-2p.tsv': '同上（2P 那一份，§E599）',
  /* ⚠ 这两张是 10-13 夜班补进来的（我上一笔 S1 把它们并掉是**错的**）：
   *   「谁在读」那把尺判的是**代码会不会去读这个文件**，而 `attach-hp.mjs --table=<文件名>` 的用法活在**注释**里
   *   （`champion-map/attach-hp.mjs:34` 原文点名 `epsfull-tier-2026-10-12.tsv`）⇒ 注释不算读 ⇒ 被当成无人认领并走了。
   *   后果不是"少一张表"而是**这条命令照着说明敲就 ENOENT**，而它正是 §E597 之后"头号尺 Hp 由哪把尺量的"那一层
   *   （现面板 986 行里那 149 行的覆盖来源，见 10-13 夜班日志「卡点」④）。
   *   判据修正：**容器里的副本没有文件名可读** ⇒ 凡是"按文件名当 CLI 参数被点名的表"一律留在盘上、不许并。 */
  'epsfull-tier-2026-10-12.tsv': '§E597 全库 tier 重测（seed 77000）= `attach-hp --table=` 点名的那张 ‖ 现面板 Hp 的来源层',
  'epsfull-tier-88000c-2026-10-12.tsv': '同一批的第二只 seed（88000）‖ 同上，按文件名被点名',
  /* 今晚这批也一样留盘：`rebuild-coords.mjs` 第③步是拿 `--extra=<X>-ruler.tsv` 的**名字**去派生"必须有 `<X>-epsfull.tsv`"
   *   （见它自己的 HPMORE 那段），派生出来的是**文件路径**，容器里的副本没有路径可读。 */
  'h2p-ruler.tsv': '10-13 夜班 5 枚代表的现测尺（考卷 120 档）‖ `rebuild-coords --extra=` 按文件名吃它',
  'h2p-epsfull.tsv': '与上表配对的另一半（页面臂 `tier:lv:regular`）‖ 上面那条派生规则**要求**这个名字存在',
  'h2p-extra.tsv': '`eps-full --extra=` 的名单（arm/productRel 两列是其表头契约）'
};
const famOfHeader = line => 'tsv-' + createHash('sha1').update(line).digest('hex').slice(0, 6);

function walk(d) {
  const out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

/* ---------------- 入库面 ---------------- */
export function trackedTables() {
  let out;
  try {
    out = execSync('git ls-files -z champion-map', { cwd: ROOT, maxBuffer: 64e6 }).toString().split('\0').filter(Boolean);
  } catch (e) {
    throw new Error('拿不到 `git ls-files champion-map` ⇒ 拒绝猜"哪些表算入库"（宁可红，不许把本机文件当仓库文件）：' + e.message);
  }
  const files = out.map(f => basename(f).replace(/\r/g, '')).filter(f => /\.(tsv|txt)$/.test(f)).sort();
  const onDisk = readdirSync(MAP).filter(f => /\.(tsv|txt)$/.test(f));
  return { files, ignored: onDisk.filter(f => files.indexOf(f) < 0).sort() };
}

/* ---------------- 写侧 ---------------- */
function splitLines(text) {
  const L = text.replace(/\r\n/g, '\n').split('\n');
  while (L.length && L[L.length - 1] === '') L.pop();
  return L;
}
/** 一张旧表 → 记录（hdr 一条 + row 若干）。TSV 要求有表头且至少一行；TXT 只要求非空（它本来就是一行行文本）
 *  ⚠ batch = **含扩展名的完整文件名**：现测有 4 组同名不同扩展（`pool-seat-new-90210.{tsv,txt}` 等，
 *    正是各班以「本次入库」点名的那批）⇒ 去掉扩展会撞键，重建时会拿错表头（第一版就是这么红的）。 */
function encodeFile(name, text) {
  const base = basename(name);
  const L = splitLines(text);
  if (L.length < 2) return { err: '行数 <2 ⇒ 没什么可并的，原样留着并点名' };
  if (/\.tsv$/.test(name)) {
    if (L.slice(1).some(l => l.trim() === '')) return { err: '中间有空行 ⇒ 逐字节重建不可靠，原样留着' };
    if (L[0].trim() === '' || !L[0].includes('\t')) return { err: '首行不像表头（空或无制表符）⇒ 不猜口径，原样留着' };
    const fam = famOfHeader(L[0]);
    /* 记下**入库时真实看到的行宽集合**：现测有两张源表本来就参差（`beh-e583.tsv` 12 行里 4 行与表头列数不符 ‖
     *   `heavyreflect-5batches-e583.tsv` 11 行里 6 行不符），而逐字节比对证明不是我搬坏的 ⇒ 那是源数据的事实。
     *   所以结构模式不能把"参差"当损坏报红（否则下次真损坏也看不见），只能报"偏离入库时记下的形状"。 */
    const ws = [...new Set(L.slice(1).map(l => l.split('\t').length))].sort((a, b) => a - b).join(',');
    const recs = [['hdr', fam, base, L[0]], ['meta', fam, base, '@widths\tcols\t' + ws]]
      .concat(L.slice(1).map(l => ['row', fam, base, l]));
    return { family: fam, header: L[0], recs };
  }
  const recs = [['hdr', TXT_FAMILY, base, ''], ['meta', TXT_FAMILY, base, '@widths\tlines\t' + L.length]]
    .concat(L.map(l => ['row', TXT_FAMILY, base, l]));
  return { family: TXT_FAMILY, header: '', recs };
}
export function scanDir(opt) {
  const o = opt || {};
  /* "谁在读这张表"的判定：**注释里提到文件名不算读**（现测教训：本工具自己的注释举了 `beh-e583.tsv` 的例子，
   *   结果那张表被判成"有读者"而从可并集里掉出去 —— 工具把自己的说明书当成了依赖）。
   *   去注释用 `server/knob-guard.mjs` 那份**现成的**实现（它保留字符串字面量 ⇒ 真读者的路径字符串不会被吃掉）。 */
  const blob = (function () {
    let s = '';
    for (const r of CODE_ROOTS) {
      const rd = join(ROOT, r); if (!existsSync(rd)) continue;
      for (const f of walk(rd)) {
        if (!/\.(mjs|js|html|yml)$/.test(f)) continue;
        let t = ''; try { t = readFileSync(f, 'utf8'); } catch (e) { continue; }
        if (/\.(mjs|js)$/.test(f)) t = stripComments(t);
        else t = t.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*(#|\/\/).*$/gm, '');
        s += t;
      }
    }
    return s;
  })();
  const tk = trackedTables();
  /* ⚠ 第二把尺（10-13 夜班补，我自己上一笔 S1 就是被它漏掉的表坑的）：**文件名出现在源码里就算"有人按名字读"，注释也算**。
   *   为什么去注释那把尺不够：`attach-hp.mjs:34` 的用法行写着 `--table=` 要吃 `epsfull-tier-2026-10-12.tsv` ——
   *   那是**说明书**而不是 `readFileSync`，去注释之后看不见 ⇒ 那张 §E597 全库重测表被我当"无人认领"并进了容器，
   *   于是"照着说明敲"当场 ENOENT（容器里的副本**没有文件名**可读）。两个后果都要：文件留在盘上、且不再被并走。
   *   与上面那把尺的分工：`blob`（去注释）判"代码真在读"⇒ 数据形状要等 S1-B；`named`（不去注释）判"名字被点名"⇒ 一律不并。
   *   排除本文件自己：`NEVER_MERGE` 的键名与这里的说明都写着表名，不排除就是自己咬自己。 */
  const named = (function () {
    let s = '';
    for (const r of CODE_ROOTS) {
      const rd = join(ROOT, r); if (!existsSync(rd)) continue;
      for (const f of walk(rd)) {
        if (!/\.(mjs|js|html|yml)$/.test(f)) continue;
        if (/point-data\.mjs$/.test(f)) continue;
        let t = ''; try { t = readFileSync(f, 'utf8'); } catch (e) { continue; }
        s += t;
      }
    }
    return s;
  })();
  const res = { merged: [], skipped: [], refused: [], ignoredOnDisk: tk.ignored, bytesIn: 0 };
  for (const n of tk.files) {
    if (n === 'point-data.tsv') continue;
    if (NEVER_MERGE[n]) { res.skipped.push({ f: n, why: NEVER_MERGE[n] }); continue; }
    const text = readFileSync(join(MAP, n), 'utf8');
    if (blob.includes(n) && !o.includeReaders) { res.skipped.push({ f: n, why: '有代码读者（`readFileSync`/路径字符串里真出现）⇒ 留给 S1-B（迁移判据现成：逐字节重建必须等）' }); continue; }
    if (named.includes(n)) { res.skipped.push({ f: n, why: '只在**注释/说明书**里被按文件名点名（例：`--table=<本表名>` 的用法行）⇒ 照样留盘，容器里的副本没有文件名可读' }); continue; }
    const e = encodeFile(n, text);
    if (e.err) { res.refused.push({ f: n, why: e.err }); continue; }
    res.bytesIn += Buffer.byteLength(text, 'utf8');
    res.merged.push({ f: n, family: e.family, rows: e.recs.length - 1 });
  }
  return res;
}
/** 真正写容器：**允许并的名单只有一份**（`scanDir` 的 merged 清单）——
 *  原来这里自己又走一遍目录，结果把"有读者的表"也吞了（报告说 78 张、容器却按 152 张长 ⇒ 口径分裂就是本仓最贵的那类病）。 */
export function build(opt) {
  const o = opt || {};
  const allow = new Set(scanDir(o).merged.map(m => m.f));
  const byFam = new Map();
  const merged = [];
  for (const n of [...allow].sort()) {
    const text = readFileSync(join(MAP, n), 'utf8');
    const e = encodeFile(n, text);
    if (e.err) continue;
    if (!byFam.has(e.family)) byFam.set(e.family, []);
    byFam.get(e.family).push(e);
    merged.push({ f: n, family: e.family, rows: e.recs.length - 1, bytes: Buffer.byteLength(text, 'utf8') });
  }
  const lines = ['# point-data v1 · 单文件容器（kind/family/batch + 原文行）· 由 `node champion-map/point-data.mjs --build` 生成，别手改'];
  for (const fam of [...byFam.keys()].sort()) for (const e of byFam.get(fam)) for (const r of e.recs) lines.push(r.join('\t'));
  const text = lines.join('\n') + '\n';
  /* ⚠ 护栏：迁移之后**容器就是唯一副本**（旧表已 git rm，build 读不到它们）。
   *   没有这条的话，谁在迁移之后再敲一次 --build，就会安静地写出一张空容器把数据全冲掉。
   *   判据：新内容比现有容器少一半以上 ⇒ 拒绝写盘（要重建请先 `git checkout HEAD -- <那些表>` 取回源文件）。 */
  if (!o.dry && existsSync(MASTER)) {
    const cur = splitLines(readFileSync(MASTER, 'utf8')).length;
    if (lines.length < cur * 0.5) {
      console.error('⛔ 拒绝写盘：新容器只有 ' + lines.length + ' 行，而现有容器有 ' + cur + ' 行（少超过一半 = 源表已被迁走，' +
        '容器是唯一副本）。要重建请先从 git 取回源表：git checkout HEAD -- champion-map/<表名>');
      process.exit(8);
    }
  }
  if (!o.dry) writeFileSync(MASTER, text.replace(/\n/g, '\r\n'), 'utf8');
  return { families: [...byFam.keys()].sort(), merged, bytes: Buffer.byteLength(text, 'utf8') };
}

/* ---------------- 读侧（统一接口）---------------- */
let CACHE = null;
export function records(refresh) {
  if (CACHE && !refresh) return CACHE;
  if (!existsSync(MASTER)) throw new Error('point-data.tsv 不在盘上 ⇒ 先 `node champion-map/point-data.mjs --build`（接口不许静默返回空）');
  const rows = [];
  for (const line of splitLines(readFileSync(MASTER, 'utf8'))) {
    if (line.startsWith('#')) continue;
    const c = line.split('\t');
    rows.push({ kind: c[0], family: c[1], batch: c[2], rest: c.slice(3).join('\t') });
  }
  CACHE = rows;
  return rows;
}
export const families = () => [...new Set(records().map(r => r.family))].sort();
export const batches = fam => [...new Set(records().filter(r => r.kind === 'hdr' && (!fam || r.family === fam)).map(r => r.batch))].sort();
/** 逐字节重建一张旧表（表头 + 行序 + 原文） */
export function reconstruct(batch) {
  const rs = records().filter(r => r.batch === batch);
  if (!rs.length) return null;
  const hdr = rs.find(r => r.kind === 'hdr');
  if (!hdr) return null;
  const body = rs.filter(r => r.kind === 'row').map(r => r.rest);
  if (hdr.family === TXT_FAMILY) return body.length ? body.join('\n') + '\n' : null;
  return hdr.rest + '\n' + body.join('\n') + '\n';
}
/** 解析成行对象（表头当键）：接口的唯一"看懂数据"的地方 */
export function rows(batch) {
  const rs = records().filter(r => r.batch === batch);
  const hdr = rs.find(r => r.kind === 'hdr');
  if (!hdr || hdr.family === TXT_FAMILY) return null;
  const cols = hdr.rest.split('\t');
  return rs.filter(r => r.kind === 'row').map(r => {
    const c = r.rest.split('\t'); const o = {};
    cols.forEach((k, i) => { o[k] = i < c.length ? c[i] : ''; });
    return o;
  });
}
/** 取一个读数：同一 (id,metric) 命中多行 ⇒ 响亮拒绝，不"取第一个"糊过去 */
export function valueOf(batch, id, metric) {
  const R = rows(batch);
  if (!R) throw new Error('valueOf 只能用于解析得了的族（' + batch + ' 是打印报告或不在容器里）');
  const key = Object.keys(R[0] || {})[0];
  const hits = R.filter(r => String(r[key]) === String(id) && metric in r);
  if (hits.length > 1) throw new Error('valueOf 命中 ' + hits.length + ' 行（batch=' + batch + ' id=' + id + ' metric=' + metric + '）⇒ 有歧义，调用方要按行取');
  return hits.length ? hits[0][metric] : null;
}

/* ---------------- 自检 ---------------- */
/* batch 现在含扩展名 ⇒ 一个文件名就是一个 batch（同名不同扩展的那 4 组靠这个区分） */
const fileOf = b => { const p = join(MAP, b); return existsSync(p) ? p : null; };
export function selfTest(opt) {
  const o = opt || {};
  const bad = [];
  records(true);
  /* ⚠ 上一版这里写的是 `batches().flatMap(fam => batches(fam))` —— 把"批次名"当"族名"又喂了一遍 batches()，
   *   结果恒为空 ⇒ 这条守卫自己变成了"永远没有受试者"，而它诚实地红了、没假装通过。正确写法：batches() 就是批次名。 */
  /* 两种模式，必须自己说清跑的是哪一种：
   *   A 迁移期（旧表还在盘上）⇒ 逐字节重建比对，这是最强的那条牙；
 *   B 迁移后（旧表已 git rm）⇒ 结构比对：每个 batch 有表头、每行列数 == 表头列数、且没有半空 batch。
   *   ⚠ 没有 B 的话，这个工具会在"迁移成功"之后永远红 ⇒ 一条正常工作后必然失败的自检等于没有自检。 */
  const onDisk = batches().filter(b => !!fileOf(b));
  /* ⚠ 10-13 夜班改正：原来这里是 **A 或 B 二选一**（`if (!onDisk.length)` 才跑 B），
   *   于是把 6 张表放回盘上（`epsfull-tier-*` 那批，见上面 NEVER_MERGE）之后，B 那条**整批都不跑了** ——
   *   77 张没有源文件的 batch 一个结构检查都没有，而输出那行只说"模式 A"，看不出少了一半。
   *   两种模式不是互斥的：B 判"容器自己有没有坏"（对**每一张**都成立），A 判"搬回来的还是不是原样"（只对盘上有源文件的成立）。
   *   ⇒ 现在永远跑 B，盘上有源文件的**再**跑 A。 */
  const mode = 'B 结构 全 ' + batches().length + ' 张' + (onDisk.length ? ' ‖ A 逐字节 ' + onDisk.length + ' 张' : '');
  let n = 0;
  {
    let ragged = 0;
    for (const b of batches()) {
      const rs = records().filter(r => r.batch === b);
      const hdr = rs.find(r => r.kind === 'hdr');
      if (!hdr) { bad.push('batch 没有表头记录：' + b); continue; }
      const body = rs.filter(r => r.kind === 'row');
      if (!body.length) { bad.push('空 batch（只有表头）：' + b); continue; }
      const meta = rs.find(r => r.kind === 'meta' && /^@widths\t/.test(r.rest));
      if (!meta) { bad.push('batch 没记 @widths（旧容器？重跑 --build）：' + b); continue; }
      const kind = meta.rest.split('\t')[1];
      let now, was;
      if (kind === 'lines') { now = String(body.length); was = meta.rest.split('\t')[2]; }        // 打印报告：形状 = 行数
      else { now = [...new Set(body.map(r => r.rest.split('\t').length))].sort((x, y) => x - y).join(','); was = meta.rest.split('\t')[2]; }
      if (now !== was) bad.push('形状偏离入库时记录：' + b + ' ' + kind + ' ' + was + ' → ' + now + '（' + body.length + ' 行）');
      if (hdr.family !== 'report-print' && kind !== 'lines' && now.split(',').length > 1) ragged++;
      n++;
    }
    if (ragged) console.log('ℹ 其中 ' + ragged + ' 张源表本来就**行宽参差**（不是这次搬坏的：搬之前模式 A 逐字节等值才允许 git rm ⇒ 盘上原来就是这样）⇒ 按表头读它们要留意列数。');
  }
  for (const b of onDisk) {
    const f = fileOf(b);
    const rec = reconstruct(b);
    const orig = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    n++;
    if (rec == null) { bad.push('重建返回 null：' + b); continue; }
    if (rec !== orig) {
      const a = rec.split('\n'), c = orig.split('\n');
      let i = 0; while (i < Math.min(a.length, c.length) && a[i] === c[i]) i++;
      bad.push('逐字节不等：' + (n ? b : b) + ' 第 ' + (i + 1) + ' 行\n      重建 ' + String(a[i]).slice(0, 80) + '\n      原文 ' + String(c[i]).slice(0, 80));
    }
  }
  /* 合成正对照（两种模式各有一条，都要"改了必须响"，否则上面那段是装饰）：
   *   A：改一个字符 ⇒ 逐字节重建必须不等；
   *   B：从某行里摘掉一个单元格 ⇒ 结构比对必须报"列数与表头不符"。 */
  const saved = CACHE;
  /* 两条正对照**各跑各的**（原来是一根 `caught` 二选一 ⇒ 跑了 A 就没验 B 的牙，反之亦然） */
  let caughtB = false, probeB = '';
  probeB = batches().find(b => records().some(r => r.batch === b && r.kind === 'row' && r.rest.includes('\t')));
  if (probeB) {
    const t = records().find(r => r.batch === probeB && r.kind === 'row' && r.rest.includes('\t'));
    if (t) t.rest = t.rest.replace(/\t/, '');                       // 摘掉一格 ⇒ 这一行的宽度偏离入库时记下的形状
    const body = records().filter(r => r.batch === probeB && r.kind === 'row');
    const was = (records().find(r => r.batch === probeB && r.kind === 'meta' && /^@widths\t/.test(r.rest)) || { rest: '' }).rest.split('\t')[1];
    const now = [...new Set(body.map(r => r.rest.split('\t').length))].sort((x, y) => x - y).join(',');
    caughtB = !!was && now !== was;
  }
  let caughtA = false, probeA = '';
  if (onDisk.length) {
    probeA = onDisk[0];
    const t = saved.filter(r => r.batch === probeA && r.kind === 'row')[0];
    if (t) t.rest = t.rest + 'X';
    caughtA = reconstruct(probeA) !== readFileSync(fileOf(probeA), 'utf8').replace(/\r\n/g, '\n');
  }
  CACHE = saved;
  if (probeB && !caughtB) bad.push('合成正对照（B 结构）没响（探针打在 ' + probeB + '）⇒ 那条结构比对是装饰');
  if (!probeB) bad.push('合成正对照（B 结构）没有受试者（容器里没有带制表符的数据行）⇒ 等于没验');
  if (onDisk.length && !caughtA) bad.push('合成正对照（A 逐字节）没响（探针打在 ' + probeA + '）⇒ 那条逐字节比对是装饰');
  if (o.list) console.log('模式 ' + mode + ' ‖ 比对 ' + n + ' 次（B 每张一次 + A 每个盘上源文件一次）‖ 正对照：B 探针 ' + probeB + '（响 = ' + caughtB + '）' +
    (onDisk.length ? ' ‖ A 探针 ' + probeA + '（响 = ' + caughtA + '）' : ' ‖ A（盘上无源文件，不适用）'));
  return bad;
}

/* ---------------- 迁移：删旧表（只有在重建等值之后才允许）---------------- */
export function migrate(opt) {
  const o = opt || {};
  /* ⚠ 这里也犯过与 selfTest 同一个错：`batches().flatMap(f => batches(f))` 把批次名当族名再喂一次 ⇒ 恒空，
   *   而"可删 0 张"读起来像"没有可删的"，实际是"我一个都没数到"。空集必须响亮，不许安静。 */
  const list = batches();
  if (!list.length) throw new Error('migrate：容器里一个 batch 都没有 ⇒ 先跑 --build，别让它安静地"什么都没删"');
  const removed = [], kept = [];
  for (const b of list) {
    const f = fileOf(b);
    if (!f) { kept.push({ f: b, why: '容器里有、盘上没有（已删过）' }); continue; }
    const rec = reconstruct(b);
    if (rec !== readFileSync(f, 'utf8').replace(/\r\n/g, '\n')) { kept.push({ f: b, why: '重建不等 ⇒ 不删' }); continue; }
    const tracked = (function () { try { execSync('git ls-files --error-unmatch "' + f.replace(/\\/g, '/') + '"', { cwd: ROOT }); return true; } catch (e) { return false; } })();
    if (!tracked) { kept.push({ f: b, why: '不在入库面 ⇒ 本机文件，不动' }); continue; }
    if (o.dry) { removed.push(b); continue; }
    try { execSync('git rm -q "' + f.replace(/\\/g, '/') + '"', { cwd: ROOT }); removed.push(b); }
    catch (e) { kept.push({ f: b, why: 'git rm 失败：' + e.message.slice(0, 60) }); }
  }
  return { removed, kept };
}

/* ---------------- CLI ---------------- */
const ARGV = process.argv.slice(2);
if (/champion-map\/point-data\.mjs$/i.test(String(process.argv[1] || '').replace(/\\/g, '/'))) cli();
function cli() {
  if (ARGV.includes('--self-test')) {
    const bad = selfTest({ list: true });
    console.log(bad.length ? '✘ 自检 ' + bad.length + ' 条红：\n  - ' + bad.join('\n  - ') : '✔ 自检通过（逐字节重建 + 合成正对照会响）');
    process.exit(bad.length ? 2 : 0);
  }
  if (ARGV.includes('--migrate')) {
    const r = migrate({ dry: ARGV.includes('--dry') });
    console.log((ARGV.includes('--dry') ? '（dry）可删 ' : '已 git rm ') + r.removed.length + ' 张 ‖ 不删 ' + r.kept.length + ' 张');
    if (r.kept.length) console.log('  不删：' + r.kept.slice(0, 8).map(x => x.f + '（' + x.why + '）').join(' ‖ '));
    return;
  }
  const rep = scanDir({ includeReaders: ARGV.includes('--include-readers') });
  const bld = build({ dry: !ARGV.includes('--build') });
  const bytesOld = rep.merged.reduce((a, x) => a + x.rows, 0);
  console.log('可并 ' + rep.merged.length + ' 张（' + bld.families.length + ' 个口径族）‖ 行 ' + bytesOld +
    ' ‖ 容器 ' + (bld.bytes / 1048576).toFixed(2) + 'MB ‖ 源文件合计 ' + (rep.bytesIn / 1048576).toFixed(2) + 'MB');
  console.log('跳过 ' + rep.skipped.length + '（有读者 / 契约真源）‖ 拒收 ' + rep.refused.length + ' ‖ 盘上未入库（绝不并）' + rep.ignoredOnDisk.length);
  if (rep.refused.length) console.log('  拒收：' + rep.refused.map(x => x.f).join(' ‖ '));
  console.log(ARGV.includes('--build') ? '已写 ' + MASTER : '（--report：只普查不写盘）');
  if (ARGV.includes('--build')) {
    const bad = selfTest({ list: true });
    console.log(bad.length ? '✘ 写完自检红：' + bad[0] : '✔ 写完自检通过');
    if (bad.length) process.exit(2);
  }
}
