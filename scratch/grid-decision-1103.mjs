#!/usr/bin/env node
/* grid-decision-1103.mjs — 从臂日志的「整池格表」那一行，离线重排**任何容差带**会选谁（qoder · 11-03）
 * 为什么要有：一臂 12 分钟，而带宽（tolPt）只是选择层的一个数。`train-3p` 的 `[分格选人] 整池格表`
 *   本来就把**每个闸后候选**的 格 / 重验分 印全了（稀有度要数整池 ⇒ 这些签名是白送的）
 *   ⇒ 拿它喂**同一个纯函数** `pick-best.mjs:gridPickByRarity`（不在这儿重写算术）就能扫一遍容差带。
 * 用法：node scratch/grid-decision-1103.mjs --log=scratch/qoder-t1/CBGG-s13.log --tol=1,2,3,4,6,8,12
 */
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const known = ['log', 'tol', 'defshare', 'kinds'];
const badFlags = argv.filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (badFlags.length) { console.error('⛔ 不认识的旗标：' + badFlags.join(' ') + '（可用 --log= --tol= --defshare= --kinds=）'); process.exit(64); }
const LOG = String(arg('log', ''));
if (!LOG || !existsSync(ROOT + '/' + LOG)) { console.error('⛔ --log= 要指到一份真实臂日志（现在收到 ' + JSON.stringify(LOG) + '）'); process.exit(2); }
const TOLS = String(arg('tol', '1,2,3,4,6,8,12')).split(',').map(Number).filter((x) => x > 0);
/* 档边线必须与 `train-3p` 里 selGrid 的那两处一致（改那边要改这边 ⇒ 单源在训练 CLI，这里是副本，注释点名它） */
const DEFS = String(arg('defshare', '0.5,3,8')).split(',').map(Number);
const KINDS = String(arg('kinds', '5,8,11')).split(',').map(Number);
const b = (v, edges) => edges.reduce((n, e) => (v < e ? n : n + 1), 0);

const { gridPickByRarity } = await import(pathToFileURL(ROOT + '/tools/pick-best.mjs').href);

const txt = readFileSync(ROOT + '/' + LOG, 'utf8');
const line = (txt.match(/\[分格选人\] 整池格表[^：]*：(.*)/) || [])[1];
if (!line) { console.error('⛔ 日志里没有 `[分格选人] 整池格表` ⇒ 这一臂没开这根键（或没跑到选择层）'); process.exit(3); }
/* 一格 = "D2K2 12.3[原当选]" 这样；[gateOk=false] 的照实带进纯函数（它自己会闸掉） */
const entries = [];
const re = /(D\dK\d|\(闸外未测\))\s+([\d.]+)((?:\[gateOk=false\])?)(\[原当选\])?/g;
let m;
while ((m = re.exec(line))) {
  entries.push({ ref: { id: 'e' + entries.length }, score: Number(m[2]) / 100, __sig: m[1] === '(闸外未测)' ? undefined : m[1],
    gateOk: m[3] ? false : true, __wasWinner: !!m[4] });
}
if (!entries.length) { console.error('⛔ 那行解析出 0 格（格式变了？原文：' + line.slice(0, 120) + '）'); process.exit(3); }
const wasWinner = entries.filter((e) => e.__wasWinner)[0] || null;
console.log('池 ' + entries.length + ' 粒 ‖ 原当选=' + (wasWinner ? wasWinner.__sig + ' 分 ' + (wasWinner.score * 100).toFixed(1) : '（日志没标）') +
  ' ‖ 最高分=' + (Math.max.apply(null, entries.map((e) => e.score)) * 100).toFixed(1));
console.log('格子分布：' + entries.map((e) => e.__sig + '(' + (e.score * 100).toFixed(1) + ')').join(' '));
console.log('');
console.log('容差带(pt) | 带内 | 选中的格 | 该格池内几粒 | 换人? | 与按分选的差(pt)');
for (const tol of TOLS) {
  const pool = entries.map((e) => Object.assign({}, e, { __sig: e.__sig }));   /* 每档重算：__sig 会被缓存，但值一样 */
  const r = gridPickByRarity(pool, tol, null);
  if (!r.best) { console.log(String(tol).padStart(6) + '  | 带内 0 粒 ⇒ **零作用**（empty=' + r.empty + ' skipped=' + r.skipped + '）'); continue; }
  const byScoreTop = r.byScore;
  console.log(String(tol).padStart(6) + '  | ' + String(r.band.length).padStart(4) + ' | ' + (r.pickedCell || '?') +
    ' | ' + r.pickedCount + ' | ' + (r.changedWinner ? '**换**' : '不换') +
    ' | ' + (((byScoreTop ? byScoreTop.score : 0) - r.best.score) * 100).toFixed(1));
}
console.log('\n⚠ 这一张表是把臂里**已经印出**的读数重排，不是重新量 ⇒ 分母还是那一池（同一 seed、同一次演化）。');
console.log('⚠ 格档边线（防御 <' + DEFS.join('/') + '% ‖ 种数 <' + KINDS.join('/') + '）的权威定义在 `tools/train-3p.mjs` 的 selGrid 块，这里是副本。');
