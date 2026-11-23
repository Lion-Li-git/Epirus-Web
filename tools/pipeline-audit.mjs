#!/usr/bin/env node
/* pipeline-audit.mjs —— 训练→测量→进图→池→promote 全链端到端自检（ZCode · 2026-11-17 凌晨）
 *
 * 动机（用户令）：保证每个包训练出来之后进图都**没有信息缺漏或矛盾**——此前五处失真
 * （蛇形键/普查假零/exam 驱动 A 行/短 a NaN/V3S2 假父）都是链上某站静默掉信息，靠人眼抓。
 * 这台脚本把每一站变成机检：对在册 id 逐站核，输出缺漏分类与逐包清单。
 *
 * 站点：
 *   ①registry 行 + sha256 与文件一致（文件可读时） ②文件可读 + checkPack ③META.ts = registry ts
 *   ④lineage 行 + 父边证据分级（seedpack-wid ⇒ hotstartFrom 可解析；soup ⇒ META.soup.sources 覆盖；
 *     假父检测：META.hotstartFrom 存在但 wid 解析不出图上节点）
 *   ⑤META.soup.sources 逐源：文件存在 + wid 一致 + ts ≤ 本包 ts
 *   ⑥coords 行（进图） ⑦readings 行（有测量） ⑧exam4n 表（skU/skE 列）
 *   ⑨pool-members（若在池）：wid 与 lineage 一致 ⑩promote 行（体检已跑）
 *
 * 用法：node tools/pipeline-audit.mjs [--id=<pack_id>] [--all] [--out=<tsv>]
 *   缺省 = coords.tsv 面板全集（进图的才审计）；--all = registry 全集（含未进图）。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { sandbox } from './audit-lib.mjs';
import * as packLib from '../champion-map/pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ONLY = arg('id', '');
const ALL = process.argv.includes('--all');
const OUT = arg('out', '');

const CHECKPACK = sandbox().EpirusPolicy.checkPack;   // 站②共用一个 sandbox，逐包调
/* 旧 registry/lineage ts 是无时区标记的截断写法（17:13:40）——按 UTC 归一，防 Date.parse 当本地时区 */
const tsMs = (s) => (s ? Date.parse(/\dZ$|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z') : NaN);
/* wid 父链（与 add-point findAncestorOnMap 同语义）：扫本目录/scratch/arms/docs 冷启目录，widOf→hotstartFrom 逐跳爬到图上 id */
let WID_PARENT = null, WID2ID = null;
function WALK_PARENT(startWid) {
  if (!WID_PARENT) {
    WID_PARENT = new Map();
    const { widOf, parseMeta } = packLib;
    const dirs = ['scratch/arms', 'docs/artifacts/obs6-coldstart', 'docs/artifacts/2p0-pool', 'docs/artifacts'];
    for (const dir of dirs) {
      const full = join(ROOT, dir);
      if (!existsSync(full)) continue;
      for (const name of readdirSync(full)) {
        if (!name.endsWith('.bak') && !name.endsWith('.js')) continue;
        try {
          const txt = readFileSync(join(full, name), 'utf8');
          const w = widOf(txt), m = parseMeta(txt);
          if (w && m && m.hotstartFrom) WID_PARENT.set(w, String(m.hotstartFrom).trim());
        } catch (e) { /* 目录里有坏件不拦全局 */ }
      }
    }
    WID2ID = new Map();
    for (const r of lin.rows) { const w = String(r[lin.ix.wid] || ''), i2 = r[lin.ix.id]; if (w && i2) { WID2ID.set(w, i2); if (w.length > 12) WID2ID.set(w.slice(0, 12), i2); } }
  }
  const seen = new Set();
  let cur = startWid;
  for (let hop = 0; hop < 16 && cur && !seen.has(cur); hop++) {
    seen.add(cur);
    const pid = WID2ID.get(cur) || (cur.length > 12 ? WID2ID.get(cur.slice(0, 12)) : '');
    if (pid && cooOf[pid]) return pid;
    cur = WID_PARENT.get(cur) || WID_PARENT.get(cur.slice(0, 12)) || '';
  }
  return '';
}

const readTsv = (p) => {
  if (!existsSync(p)) return { header: [], rows: [], ix: {} };
  const lines = readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split('\t');
  const ix = Object.fromEntries(header.map((c, i) => [c, i]));
  return { header, rows: lines.slice(1).map((l) => l.split('\t')), ix };
};
const D = (p) => join(ROOT, 'champion-map/data', p);

const reg = readTsv(D('registry.tsv'));
const lin = readTsv(D('page/lineage.tsv'));
const coo = readTsv(D('page/coords.tsv'));
const rd = readTsv(D('readings/current.tsv'));
const pool = readTsv(D('page/pool-members.tsv'));
const promo = readTsv(D('page/promote.tsv'));
const exM = existsSync(D('exam4n-mixedfix-1116-multi.tsv')) ? readTsv(D('exam4n-mixedfix-1116-multi.tsv')) : { rows: [], ix: {} };

const regOf = {};
for (const r of reg.rows) regOf[r[reg.ix.pack_id]] = r;
const linOf = {};
for (const r of lin.rows) linOf[r[lin.ix.id]] = r;
const cooOf = {};
for (const r of coo.rows) cooOf[r[coo.ix.id]] = r;
const poolOf = {};
for (const r of pool.rows) poolOf[r[pool.ix.id]] = r;
const promoOf = {};
for (const r of promo.rows) promoOf[r[promo.ix.id]] = r;
const rdCount = {};
for (const r of rd.rows) rdCount[r[rd.ix.pack_id]] = (rdCount[r[rd.ix.pack_id]] || 0) + 1;
const skEof = {};
for (const r of exM.rows) skEof[r[exM.ix.id]] = r[exM.ix.skE];
/* mixed 家族其它表（如矩阵批 exam4n-mixed-matrix-1117）同一把尺 ⇒ skE 同样算数 */
for (const extra of ['exam4n-mixed-matrix-1117-multi.tsv']) {
  const p2 = D(extra);
  if (!existsSync(p2)) continue;
  const t2 = readTsv(p2);
  if (t2.ix.id !== undefined && t2.ix.skE !== undefined) for (const r of t2.rows) if (r[t2.ix.id] && !skEof[r[t2.ix.id]]) skEof[r[t2.ix.id]] = r[t2.ix.skE];
}

let ids = reg.rows.map((r) => r[reg.ix.pack_id]).filter(Boolean);
if (ONLY) ids = [ONLY];
else if (!ALL) ids = ids.filter((id) => cooOf[id]);

const problems = {};
const add = (id, station, msg) => { problems[id] = problems[id] || []; problems[id].push(station + ': ' + msg); };
let checked = 0;

for (const id of ids) {
  checked++;
  const rr = regOf[id];
  if (!rr) { add(id, 'registry', '不在注册表'); continue; }
  /* 墓碑行：文件已清理的 archived 包——测量能力随文件消失，只记账不追责 */
  const REL = rr[reg.ix.path] || '';
  const STATUS = rr[reg.ix.status] || '';
  if (!REL && STATUS === 'archived') { add(id, 'archived', '墓碑行（文件已清理，sha256 留账）'); continue; }
  const rel = rr[reg.ix.path];
  const file = rel && existsSync(rel) ? rel
    : rel && existsSync(join(ROOT, rel)) ? join(ROOT, rel)
    : (existsSync(join(ROOT, 'docs/artifacts', id + '.bak')) ? join(ROOT, 'docs/artifacts', id + '.bak') : null);
  /* ① sha256（文件可读时） */
  if (!file) { add(id, 'file', 'registry 路径不存在：' + rel); }
  else if (rr[reg.ix.sha256]) {
    const got = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (got !== rr[reg.ix.sha256]) add(id, 'sha256', 'registry sha 过期（文件已改，重算 ' + got.slice(0, 12) + '）');
  }
  /* ③ META.ts = registry ts */
  if (file) {
    const txt = readFileSync(file, 'utf8');
    const mm = txt.match(/EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;\s*\n/);
    let meta = null;
    try { meta = mm ? JSON.parse(mm[1]) : null; } catch (e) { add(id, 'meta', 'META JSON 解析失败'); }
    if (meta) {
      /* ② checkPack 载入合法性（吃整包容器，与 exam-4n 同一条装包路） */
      const pm = txt.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      if (pm) { try { const cp = CHECKPACK(JSON.parse(pm[1])); if (cp && cp.ok === false) add(id, cp.reason === 'version' ? 'legacy' : 'checkPack', cp.reason === 'version' ? 'v' + cp.got + ' 时代老包（v7 前容器，历史遗产）' : '载入拒绝：' + JSON.stringify(cp)); } catch (e) { add(id, 'checkPack', '包体 JSON 解析失败'); } }
      else add(id, 'file', '无可载入包体（无 EPIRUS_CHAMPION_3P 容器）');
      /* ③ 时间恒等式：出产 ≤ 注册（registry ts 是注册时刻，合法地晚于出产） */
      if (meta.ts && rr[reg.ix.ts] && tsMs(meta.ts) > tsMs(rr[reg.ix.ts]) + 2000) add(id, 'ts', 'META.ts(' + meta.ts + ') 晚于 registry ts(' + rr[reg.ix.ts] + ') ⇒ 时间倒挂');
      /* ④ 父边检测：与 add-point 同语义——hotstartFrom 与父节点 wid **前缀兼容**，或父是 wid 链爬到的最近图上祖先。
       *   parentSrc=soup 的行跳过单父比较（融合产物走 META.soup.sources 多父边语义）。 */
      const lf = linOf[id];
      const claimedParent = lf ? lf[lin.ix.parent] : '';
      const isSoup = lf && lf[lin.ix.parentSrc] === 'soup';
      if (meta.hotstartFrom && claimedParent && !isSoup) {
        const prow = linOf[claimedParent];
        const pwid = prow ? String(prow[lin.ix.wid] || '') : '';
        const hf = String(meta.hotstartFrom);
        const prefixOk = pwid && (pwid.startsWith(hf) || hf.startsWith(pwid));
        const chainOk = !prefixOk && hf && (() => {
          const w = WALK_PARENT(hf);
          if (!w) return false;
          if (w === claimedParent) return true;
          /* 同粒两名（dupWid 对，如 MX1-E9-GD ≡ EQ-S4-GD6ATEACH）：爬到的 id 与父节点 wid 前缀兼容即算命中 */
          const lw = (id2) => { const r2 = linOf[id2]; return r2 ? String(r2[lin.ix.wid] || '') : ''; };
          const a = lw(w), b = lw(claimedParent);
          return !!(a && b && (a.startsWith(b.slice(0, 12)) || b.startsWith(a.slice(0, 12))));
        })();
        if (prow && pwid && !prefixOk && !chainOk) {
          add(id, 'parent', 'hotstartFrom(' + hf.slice(0, 12) + ') 与父节点(' + claimedParent + ') wid(' + pwid.slice(0, 12) + ') 前缀不符且链爬不到 ⇒ 假父嫌疑');
        }
        if (prefixOk && meta.ts && prow && prow[lin.ix.ts] && tsMs(prow[lin.ix.ts]) > tsMs(meta.ts)) {
          add(id, 'parent', '父节点 META.ts(' + prow[lin.ix.ts] + ') 晚于本包(' + meta.ts + ') ⇒ 时间倒挂');
        }
      }
      /* ⑤ soup.sources 逐源 */
      if (meta.soup && Array.isArray(meta.soup.sources)) {
        for (const s of meta.soup.sources) {
          if (s.path && !existsSync(s.path)) add(id, 'soup', '来源文件不存在：' + s.path);
          if (s.ts && meta.ts && tsMs(s.ts) > tsMs(meta.ts)) add(id, 'soup', '来源 ts(' + s.ts + ') 晚于本包 ⇒ 时间倒挂');
        }
        if (lf && lf[lin.ix.parentSrc] !== 'soup') add(id, 'soup', 'META 声明融合但 lineage parentSrc=' + lf[lin.ix.parentSrc] + ' ⇒ 表未按融合渲染');
      } else if (lf && lf[lin.ix.parentSrc] === 'soup') {
        add(id, 'soup', 'lineage 声明融合（parentSrc=soup）但 META 无 soup.sources ⇒ 反向假账（MSB15-SOUPB 同款）');
      }
      /* ⑥⑦ 站点 */
      if (!cooOf[id]) add(id, 'coords', '未进图（coords 无行）');
      if (!rdCount[id]) add(id, 'readings', '无测量读数');
      /* ④·补 lineage ts = META.ts（add-point 约定：lineage 记出产时刻，registry 记注册时刻，两者合法不同） */
      if (lf && meta.ts && lf[lin.ix.ts] && tsMs(lf[lin.ix.ts]) !== tsMs(meta.ts)) add(id, 'lineage', 'lineage ts(' + lf[lin.ix.ts] + ') ≠ META.ts(' + meta.ts + ')（add-point 约定 lineage 记出产时刻）');
      /* ⑨ pool 一致性（老 lineage 行 wid 是 12 位旧格式 ⇒ 前缀兼容即算一致；两侧都全时才比） */
      const pr = poolOf[id];
      if (pr) {
        const lw = lf ? String(lf[lin.ix.wid] || '') : '';
        const pw = String(pr[pool.ix.wid] || '');
        if (pw && lw && !(pw.startsWith(lw) || lw.startsWith(pw))) add(id, 'pool', 'pool wid(' + pw.slice(0, 12) + ') ≠ lineage wid(' + lw.slice(0, 12) + ') ⇒ 真矛盾（非长度格式差）');
      }
      /* ⑩ promote 行（promote 时代 11-15 起的老包不追账） */
      if (!promoOf[id] && (pr || (rr[reg.ix.ts] && tsMs(rr[reg.ix.ts]) >= tsMs('2026-11-15T00:00:00Z')))) {
        add(id, 'promote', pr ? '池成员无 promote 行（体检未记）' : '11-15 后注册但无 promote 行');
      }
    }
  }
  /* ⑧ skE（进图的才有） */
  if (cooOf[id] && !skEof[id]) add(id, 'skE', 'exam4n 表无 skE（未跑新口径考卷）');
}

/* 汇总 */
const byStation = {};
for (const id of Object.keys(problems)) for (const p of problems[id]) { const st = p.split(':')[0]; byStation[st] = (byStation[st] || 0) + 1; }
console.log('== 管线端到端自检 ==');
console.log('审计 ' + checked + ' 枚 ‖ 带问题 ' + Object.keys(problems).length + ' 枚');
for (const [st, n] of Object.entries(byStation).sort((a, b) => b[1] - a[1])) console.log('  ' + st.padEnd(10) + n);
const want = process.argv.find((x) => x === '--verbose');
if (want || ONLY) {
  for (const [id, ps] of Object.entries(problems)) { console.log('— ' + id); for (const p of ps) console.log('   ' + p); }
}
if (OUT) {
  writeFileSync(join(ROOT, 'champion-map', OUT), JSON.stringify(problems, null, 1), 'utf8');
  console.error('产物 → champion-map/' + OUT);
}
