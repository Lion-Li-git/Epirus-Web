#!/usr/bin/env node
/* night6-band-union.mjs —— 从 coverage-21.txt 的逐包行算任意带并集（ZCode · 11-04 凌晨）
 * 用法: node scratch/night6-band-union.mjs <带名>=<包1,包2,...> ...
 * 判带口径与 coverage-gate.mjs 逐字一致（§三十 预注册）：
 *   主干并集: gun/sword/snipe/tank 各 ≥1 成员会 + 基础防御族 ≥1 成员会（guard/reflect/bagua/shift/jinshield/proto）
 *   次级长程: charge/ring/bigT/railgun 各 ≥50% 成员会
 *   地雷: Σ 8P 自选 ≥ 0.2×20=4 ‖ 摄魂: Σ 残血自选 ≥ 4
 *   防御原型: 存在成员（份额 5-15% ∧ 准确 ≥25%）——按收档口径只报不判
 *   逐包主干缺项: 如实列表（缺 >1 的包标出；不判，§三十）
 */
import { readFileSync } from 'node:fs';

const txt = readFileSync('scratch/night6/coverage-21.txt', 'utf8');
const blocks = txt.split(/^== /m).slice(1);
const TRUNK = ['gun', 'sword', 'snipe', 'tank'];
const DEFSET = ['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'proto'];
const SECL = ['charge', 'ring', 'bigT', 'railgun'];
const per = {};
for (const b of blocks) {
  const name = b.slice(0, b.indexOf('『') >= 0 ? b.indexOf('『') : b.indexOf('\n')).replace(/（.*$/, '').trim();
  const selLine = b.match(/自选: (.*)/);
  const sel = {};
  if (selLine) for (const kv of selLine[1].split(' ')) { const [k, v] = kv.split('='); if (k && v) sel[k] = Number(v); }
  const accM = b.match(/准确 ([\d.]+)%/);
  const shareM = b.match(/防御族份额 ([\d.]+)%/);
  const mineM = b.match(/8P long: mine 菜单=\d+ 自选=(\d+)/);
  const drainM = b.match(/残血开局: drain 自选 (\d+)/);
  per[name] = {
    sel,
    acc: accM ? Number(accM[1]) : null,
    share: shareM ? Number(shareM[1]) : null,
    mine8: mineM ? Number(mineM[1]) : 0,
    drain: drainM ? Number(drainM[1]) : 0
  };
}
console.log('解析到 ' + Object.keys(per).length + ' 包');
const bandOf = (m) => {
  const t = {}, miss = {};
  for (const k of TRUNK) t[k] = m.filter((p) => (per[p].sel[k] || 0) > 0).length;
  t.def = m.filter((p) => DEFSET.some((k) => (per[p].sel[k] || 0) > 0)).length;
  const secl = {};
  for (const k of SECL) secl[k] = m.filter((p) => (per[p].sel[k] || 0) > 0).length;
  const mine8 = m.reduce((s, p) => s + per[p].mine8, 0);
  const drain = m.reduce((s, p) => s + per[p].drain, 0);
  const protoM = m.map((p) => ({ p, ok: per[p].share >= 5 && per[p].share <= 15 && per[p].acc != null && per[p].acc >= 25, share: per[p].share, acc: per[p].acc })).filter((x) => x.share != null);
  const proto = protoM.find((x) => x.ok);
  console.log('  主干并集: ' + TRUNK.map((k) => k + ' ' + (t[k] > 0 ? '✔(' + t[k] + ')' : '✘0')).join(' ‖ ') + ' ‖ 基础防御族 ' + (t.def > 0 ? '✔(' + t.def + ')' : '✘0'));
  console.log('  次级长程(≥' + Math.ceil(m.length / 2) + '/' + m.length + '): ' + SECL.map((k) => k + ' ' + secl[k] + (secl[k] >= Math.ceil(m.length / 2) ? '✔' : '✘')).join(' ‖ '));
  console.log('  地雷 Σ8P=' + mine8 + (mine8 >= 4 ? ' ✔' : ' ✘') + ' ‖ 摄魂 Σ残血=' + drain + (drain >= 4 ? ' ✔' : ' ✘'));
  console.log('  防御原型(只报): ' + (proto ? '✔ ' + proto.p + '（份额 ' + proto.share + '% 准 ' + proto.acc + '%）' : '无带内成员') + ' ‖ 最高份额 ' + Math.max(...protoM.map((x) => x.share || 0)).toFixed(1) + '%');
  for (const p of m) {
    const missK = TRUNK.filter((k) => !(per[p].sel[k] > 0));
    const defOk = DEFSET.some((k) => (per[p].sel[k] || 0) > 0);
    const nMiss = missK.length + (defOk ? 0 : 1);
    if (nMiss > 1) miss[p] = nMiss + '（' + missK.join('/') + (defOk ? '' : '/防御族') + '）';
  }
  console.log('  逐包缺 >1 项（如实，不判）: ' + (Object.keys(miss).length ? Object.entries(miss).map(([p, v]) => p + ' 缺' + v).join(' ‖ ') : '无'));
};
for (const a of process.argv.slice(2)) {
  const [band, list] = a.split('=');
  const m = list.split(',').filter(Boolean);
  console.log('\n== ' + band + '（' + m.length + ' 枚）==');
  const unknown = m.filter((p) => !per[p]);
  if (unknown.length) { console.log('  ⛔ 解析不到: ' + unknown.join(',')); continue; }
  bandOf(m);
}
