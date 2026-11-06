#!/usr/bin/env node
/* interp-flip-1103.mjs — 沿"相邻两代快照的权重连线"插值，看行为是**渐变**还是**翻面**（qoder · 11-03）
 * 问的是用户观察到的"训练里风格在两头反复横跳"的机制：
 *   已知 ① 相邻快照的权重距离只有 0.09~0.16（同血统在漂，不是换人当选）
 *       ② 防御族份额 7.7% → 2.2% → 7.4% → 2.5% 这种交替**换三个种子重量同一枚照样复现**（不是尺在抖）
 *   ⇒ 剩下的解释只能是：**行为是权重的近不连续函数**（策略按候选 argmax 选键，两族的分数贴着边界 ⇒ 小漂移就翻面）。
 *   这条脚本直接量：在 A(t)=seg_k 与 B=seg_{k+1} 的连线上取 9 个点，各量一次防御族份额与种数。
 *   渐变 ⇒ 我的解释错；**一次跳变**（中间某点从 x% 掉到 y%）⇒ 机制坐实，还能读出边界在哪。
 * 用法：node scratch/interp-flip-1103.mjs --gen=92 --a=<segA.bak> --b=<segB.bak> [--steps=9] [--games=12] [--seed0=77000]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const known = ['a', 'b', 'steps', 'games', 'seed0', 'gen', 'mode'];
const bad = argv.filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (bad.length) { console.error('⛔ 不认识的旗标：' + bad.join(' ')); process.exit(64); }
const A = String(arg('a', '')), B = String(arg('b', ''));
if (!A || !B) { console.error('⛔ 要 --a= 与 --b= 两枚包'); process.exit(2); }
const STEPS = Math.max(3, Number(arg('steps', 9)) || 9);
const GAMES = Math.max(4, Number(arg('games', 12)) || 12);
const SEED0 = Number(arg('seed0', 77000)) || 77000;
const GEN = String(arg('gen', '92'));
const GMODE = String(arg('mode', 'long'));

const { fieldProfile, WIN } = await import(pathToFileURL(ROOT + '/tools/behavior-profile.mjs').href);
const { loadChamp } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const { install: installArch2, readPack2 } = await import(pathToFileURL(ROOT + '/tools/proto2/arch2.mjs').href);
let A2 = null;
if (GEN !== '7') A2 = installArch2(WIN, { input: 'obs3b', gen: 3, keySplit: 1, mutMode: 'seg' });
const load = (p) => (GEN === '7' ? Float64Array.from(loadChamp(WIN, p, '.'))
  : Float64Array.from(WIN.EpirusPolicy.unpack(readPack2(p), true)));
const a = load(ROOT + '/' + A), b = load(ROOT + '/' + B);
if (a.length !== b.length) { console.error('⛔ 两枚维数不同（' + a.length + ' vs ' + b.length + '）⇒ 不是同代，插值没意义'); process.exit(3); }
const R = WIN.EpirusRules, JI = R.SK.JI;
const d0 = Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0)), nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
console.log('A=' + A + ' ‖ B=' + B + ' ‖ 维数=' + a.length + ' ‖ 权重距离=' + d0.toFixed(2) + '（相对 ' + (d0 / ((na + nb) / 2)).toFixed(3) + '）');
console.log('t=0 是 A ‖ t=1 是 B ‖ 每点 ' + GAMES + ' 局/' + GMODE + '（seed ' + SEED0 + '）');
for (let i = 0; i < STEPS; i++) {
  const t = i / (STEPS - 1);
  const p = new Float64Array(a.length);
  for (let j = 0; j < a.length; j++) p[j] = a[j] * (1 - t) + b[j] * t;
  const tr = fieldProfile(p, 0, 'soft', GAMES, SEED0, 'scripts', GMODE);
  const acts = tr.acts || 0;
  const dsh = acts ? 100 * (tr.def || 0) / acts : 0;
  const ks = Object.keys(tr.keys || {}).filter((k) => k !== JI && acts && ((tr.keys[k] || 0) / acts) >= 0.005);
  const defK = ks.filter((k) => { const d = R.byKey[k]; return d && d.cat === R.CAT.DEFENSE; });
  console.log('  t=' + t.toFixed(2) + ' ‖ 防御族 ' + dsh.toFixed(1).padStart(5) + '% ‖ 种数 ' + String(ks.length).padStart(2) +
    ' ‖ 防御卡 ' + defK.length + '（' + defK.slice(0, 6).join(' ') + '）');
}
