#!/usr/bin/env node
/* night6-bands.mjs —— 难度分带提议器（ZCode · 11-04 凌晨，v7 §E596 法的 gen-3 版）
 *
 * 输入：scratch/night6/strength-{long,multi}.tsv（+ -fix.tsv 合并）——13 候选包 × 200 局 × seed 77000 配对
 * 输出：
 *   ① 按 5P long 主尺排名（multi 为副尺并列印）
 *   ② 两带提议：强带 = 前 ⌈n/2⌉，弱带 = 其余（v7 Q2 法：按强度坐标切，带大小近乎对半）
 *   ③ 三带提议（中等带抽法演示）：按排名 1/3 分位切 强/中/弱
 *   ④ 带均值差与 σ 账（按各包二项 SE 合成；配对种子只会让差值 SE 更小 ⇒ 这里是保守账）
 * 判线（预注册，写死）：
 *   带间分得开 = 长桌带均值差 ≥ 4pt 且 ≥ 2σ（v7 §E596 ④d 地板 + 2σ 惯例）
 * 覆盖与 h2h 不在本工具里——分带定案后分别跑 coverage-gate.mjs 与 night6-h2h.mjs。
 */
import { readFileSync, existsSync } from 'node:fs';

function rdTsv(f) {
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).slice(1)
    .map((l) => { const c = l.split('\t'); return { pack: c[0], games: Number(c[1]), first: c[2] === 'NA' ? null : Number(c[2]) }; })
    .filter((r) => r.first != null && r.games === 200);
}
const long = new Map(), multi = new Map();
for (const r of rdTsv('scratch/night6/strength-long.tsv').concat(rdTsv('scratch/night6/strength-long-fix.tsv'), rdTsv('scratch/night6/strength-long-ext.tsv'))) long.set(r.pack, r.first);
for (const r of rdTsv('scratch/night6/strength-multi.tsv').concat(rdTsv('scratch/night6/strength-multi-fix.tsv'), rdTsv('scratch/night6/strength-multi-ext.tsv'))) multi.set(r.pack, r.first);

const packs = [...long.keys()];
if (packs.length < 13) console.log('⚠ long 只读了 ' + packs.length + '（车道没跑完？）');
const CANON13 = ['GD3ALL-POPP-s17', 'GD3ALL-PUSHON-s13', 'GD3ALL-PUSHON-s41', 'GD3ALL-G5-8p-s41', 'EFFG-s41', 'EFFG-s7', 'EFFG-s5', 'G5DEF-s41', 'D-a-s13', 'DSTR-s13', 'L5-1200-s13', 'D1200-s13', 'CB-s13'];
const G = 200;
const se = (p) => Math.sqrt((p / 100) * (1 - p / 100) / G) * 100;

const rank = packs.map((p) => ({ p, lg: long.get(p), mu: multi.has(p) ? multi.get(p) : null, se: se(long.get(p)) }))
  .sort((a, b) => b.lg - a.lg);
console.log('== 排名（5P long 200 局，seed 77000 配对）==');
rank.forEach((r, i) => console.log('  ' + (i + 1) + '. ' + (CANON13.includes(r.p) ? '[正选]' : '[扩编]') + ' ' + r.p.padEnd(20) + ' long=' + r.lg.toFixed(1) + ' ±' + r.se.toFixed(1) + (r.mu != null ? '  multi=' + r.mu.toFixed(1) : '')));

function bandStats(members) {
  const ms = members.map((p) => rank.find((r) => r.p === p));
  const mean = ms.reduce((s, r) => s + r.lg, 0) / ms.length;
  const seM = Math.sqrt(ms.reduce((s, r) => s + r.se * r.se, 0)) / ms.length; /* 独立近似＝保守 */
  return { members: ms, mean, seM };
}
function gapLine(a, b, la, lb) {
  const d = a.mean - b.mean;
  const seD = Math.sqrt(a.seM * a.seM + b.seM * b.seM);
  const sig = seD > 0 ? d / seD : Infinity;
  console.log('  ' + la + '(' + a.mean.toFixed(1) + '±' + a.seM.toFixed(1) + ') − ' + lb + '(' + b.mean.toFixed(1) + '±' + b.seM.toFixed(1) + ') = ' + d.toFixed(1) + 'pt ‖ ' + sig.toFixed(1) + 'σ ‖ ' + (d >= 4 && sig >= 2 ? '✔ 分得开' : '✘ 不达标（线：≥4pt 且 ≥2σ）'));
  return { d, sig };
}

const n = rank.length, half = Math.ceil(n / 2), third = Math.ceil(n / 3);
console.log('\n== 两带提议（v7 Q2 法：强带前 ' + half + '，弱带其余 ' + (n - half) + '）==');
const A2 = bandStats(rank.slice(0, half).map((r) => r.p)), B2 = bandStats(rank.slice(half).map((r) => r.p));
console.log('  强带: ' + A2.members.map((r) => r.p + '(' + r.lg.toFixed(1) + ')').join(' '));
console.log('  弱带: ' + B2.members.map((r) => r.p + '(' + r.lg.toFixed(1) + ')').join(' '));
const g2 = gapLine(A2, B2, '强带', '弱带');

console.log('\n== 三带提议（中等带抽法：排名三等分 ' + third + '/' + (n - 2 * third) + '/' + third + '）==');
const A3 = bandStats(rank.slice(0, third).map((r) => r.p));
const M3 = bandStats(rank.slice(third, n - third).map((r) => r.p));
const B3 = bandStats(rank.slice(n - third).map((r) => r.p));
console.log('  强带: ' + A3.members.map((r) => r.p + '(' + r.lg.toFixed(1) + ')').join(' '));
console.log('  中带: ' + M3.members.map((r) => r.p + '(' + r.lg.toFixed(1) + ')').join(' '));
console.log('  弱带: ' + B3.members.map((r) => r.p + '(' + r.lg.toFixed(1) + ')').join(' '));
const gA = gapLine(A3, M3, '强带', '中带');
const gB = gapLine(M3, B3, '中带', '弱带');
console.log('\n判读：两带差 ' + g2.d.toFixed(1) + 'pt/' + g2.sig.toFixed(1) + 'σ ‖ 三带 强-中 ' + gA.d.toFixed(1) + 'pt/' + gA.sig.toFixed(1) + 'σ ‖ 中-弱 ' + gB.d.toFixed(1) + 'pt/' + gB.sig.toFixed(1) + 'σ');
console.log('（σ 账是独立近似=保守上界；本榜同 seed 配对 ⇒ 真实差值 SE 只会更小。定案后须过 coverage-gate 与 h2h 直交两道。）');
