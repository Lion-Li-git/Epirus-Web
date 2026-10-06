#!/usr/bin/env node
/* slot-timeline.mjs —— §E369：**槽位时间轴的完整版**（39 段全收），补上 ship-times.tsv 缺的那 26 段。
 *
 * 为什么要另建一台（而不是扩 ship-scan）：`ship-times.tsv` 是"从**面板上的包**反查它们各自何时上槽"，
 *   所以只会列出在 `coords.tsv` 的 `lineage` 列里有名字的枚 —— 实测 main-only 走下来槽文件的权重换过 **39 段**，
 *   而那张表只有 **13 行**。缺的那 26 段有两种可能：那枚没进过面板（研究臂直接上槽），或 `lineage` 列本身漏记。
 *   ⇒ 时间轴必须**从槽文件这一侧**建，不能从面板那一侧建 —— 否则"当时槽里是谁"这个问题在缺段上答不出来。
 *
 * 命名用三条来路，谁有用谁（都留痕，便于复核）：
 *   ① `wid` 能在 `lineage.tsv` 里对上某枚 ⇒ 用那枚的 id（最硬：同一份权重）；
 *   ② 槽文件那个版本自己 META 里的 `arm` / `ts`（promote 会带过来）；
 *   ③ 引入它的那条**提交标题**（= 用户说的"changelog 里的记录"，本仓换包一律写在标题里，如
 *      "v1.5.7 线上冠军换成 long-33" ‖ "feat(pack) v1.5.257 上槽 Ldemo"）。
 *
 * ⚠ 两条本仓踩过的方法坑（§E368 又踩了一次，写在头注里免得下次再踩）：
 *   ① **必须 main-only 走**。`git log --all` 会把分支历史交错，"wid 一变就记一段"在那种顺序下段起点整体偏移。
 *   ② 段起点 = **引入该 wid 的那条提交**（不是它 older 的邻居）。判据：某条提交的内容与它**前一条动过这个文件的提交**不同 ⇒ 就是它引入的。
 *   ③ Windows 上带 `|` 的 git format 走 `execSync` 会被 cmd 当管道截断 ⇒ 一律 `execFileSync('git', [args])`。
 *
 * 用法：node champion-map/slot-timeline.mjs        ⇒ 写 champion-map/slot-timeline.tsv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SLOT = process.env.SLOT_FILE || 'js/bundled-champion-3p.js';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const git = a => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });

/* ---- 1) 面板身份表：wid → id（①号来路）---- */
const WID2ID = {}; const WID2ALT = {};
{ const lp = join(HERE, 'lineage.tsv');
  if (existsSync(lp)) { const L = rd(lp).trim().split('\n'), h = L[0].split('\t');
    const iw = h.indexOf('wid');
    for (const l of L.slice(1)) { const c = l.split('\t'); if (iw < 0 || !c[iw]) continue;
      WID2ALT[c[iw]] = (WID2ALT[c[iw]] || 0) + 1;
      if (!WID2ID[c[iw]]) WID2ID[c[iw]] = c[0]; } } }

/* ---- 2) 走槽文件的提交史（newest → oldest），逐条算权重指纹 ---- */
const hist = git(['log', '--format=%H|%aI', '--', SLOT]).trim().split('\n').filter(Boolean)
  .map(l => { const [sha, when] = l.split('|'); return { sha: sha, when: when, wid: '', arm: '', mts: '' }; });
for (const h of hist) {
  let src = '';
  try { src = git(['show', h.sha + ':' + SLOT]); } catch (e) { h.wid = '(读不到)'; continue; }
  h.wid = widOf(src) || '(no-weights)';
  const i = src.indexOf('_META');
  if (i >= 0) {
    const seg = src.slice(i, i + 4000);
    const a = /"arm":"([^"]{0,40})"/.exec(seg); if (a) h.arm = a[1];
    const t = /"ts":"([^"]{0,32})"/.exec(seg); if (t) h.mts = t[1];
  }
}

/* ---- 3) 段起点 = 引入该 wid 的那条提交（与**更旧**的邻居比不同即是）---- */
const segs = [];
for (let i = 0; i < hist.length; i++) {
  const older = i + 1 < hist.length ? hist[i + 1].wid : null;
  if (older === null || hist[i].wid !== older) {
    const w = hist[i].wid;
    segs.push({ from: hist[i].when, wid: w, sha: hist[i].sha.slice(0, 7),
      panelId: WID2ID[w] || '', arm: hist[i].arm, mts: hist[i].mts,
      subject: git(['show', '-s', '--format=%s', hist[i].sha]).trim() });
  }
}
segs.reverse();   // 时间正序

const COLS = ['fromUTC', 'wid', 'sha', 'panelId', 'panelAlt', 'metaArm', 'metaTs', 'namedBy', 'subject'];
const out = [COLS.join('\t')];
for (const s of segs) {
  s.namedBy = s.panelId ? 'wid=面板枚' : (s.arm ? '槽内META.arm' : (/\d/.test(s.subject) ? '提交标题' : '未命名'));
  /* 同一份权重在面板上可能占好几行（§E334 实测 901 行 = 713 个权重）⇒ 对上的不止一枚要留痕，
   *   否则"这枚叫 v7ws1-91"与提交标题里的"v7press3-91"看着互相打脸，其实是同一份权重的两个名字。*/
  s.alt = WID2ALT[s.wid] || 1;
  out.push([s.from, s.wid, s.sha, s.panelId, s.alt, s.arm, s.mts, s.namedBy, s.subject.replace(/\t/g, ' ')].join('\t'));
}
writeFileSync(join(HERE, 'slot-timeline.tsv'), out.join('\n') + '\n');
const named = segs.filter(s => s.panelId).length;
console.log('已写 slot-timeline.tsv：' + segs.length + ' 段（' + SLOT + '）‖ 其中 ' + named + ' 段能对上面板上的枚 ‖ '
  + (segs.length - named) + ' 段只能靠 META/提交标题命名');
for (const s of segs) console.log('  ' + s.from.slice(0, 16) + '  ' + s.wid.slice(0, 8) + '  ' + (s.panelId || s.arm || '—').padEnd(16)
  + '  ' + s.namedBy + (s.alt > 1 ? '（同权重 ' + s.alt + ' 行）' : '') + '  ‖ ' + s.subject.slice(0, 52));
