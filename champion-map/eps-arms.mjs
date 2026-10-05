#!/usr/bin/env node
/* §E315 孪生臂：把训练侧的**执行口径**换成线上口径，能不能把"脆"训掉？
 *
 * 起因（§E313/§E314 量到的病灶）：现役冠军的 Δε（考卷 ε=0 贪心 → 页面 ε=0.2 soft 掉的 pt）= 8.10pt，
 *   在 718 枚里排第 **99.6 百分位**；历代冠军的 Δε 中位 2.25 是非冠军 1.20 的 1.9 倍。
 *   机制 = 冠军是在贪心 argmax 上被选出来的，而页面每手 20% 概率在短名单里软采样、扰动的正是那个 argmax。
 *   ⇒ 这是一次"过拟合到评估器口径"，与本项目头号目标"读环境"反向。
 *
 * 为什么这一格还没被跑过（先查档案，别重跑已判的实验）：
 *   `EPIRUS_TRAIN_EPS` 存在（v1.5.237 E28），§E35（09-26）确实跑过产品口径臂并留下 `E35-prod-807/814`。
 *   但那批**没有 Δε 这把尺**（尺是今天才有的），也**没有配对的考卷口径孪生臂**在同一批种子上比。
 *   今天用现成存货补测到的两个数是：807 Δε = **−0.7**（吃探索）‖ 814 Δε = +2.1 —— 都远低于现役的 8.1，
 *   但 n=2 且没有同种子对照 ⇒ 只能算"值得跑一批"的证据，不能算结论。
 *
 * ⚠ 干预不是一个标量：`setTrainEps` 同时接两个漏斗 ——
 *   `fitChooser()`（每代评分的被评席，**出厂 ε=0.15 硬档 · temp 0.35**）与 `trainChooser()`（自评/健康门槛，出厂 ε=0）。
 *   处理臂把两处一起设成 temp0.15·ε0.2·k5·soft ⇒ 与对照臂差的是"整套页面口径 chooser"，不是单个常数。
 *   ⇒ 判读时不许说"只改了 eps"；这是 §E194"一次对照只能一个自由度"的**已知破例**，破例的理由 = 干预对象本身就是"口径"这个整体。
 *   ⚠ 另一处必须写清：`audit-lib` 的 9 处与承诺局 `makeCommitChooser` **不经过这个旋钮** ⇒ 五道门/体检两臂同尺，
 *     所以"pg 臂过闸率更高"不能算效果，只能算没坏。
 *
 * 判据（跑前写死，不许事后改口）：
 *   (a) 主判据 = **配对 Δε**（同种子的 pg − ex）。三粒种子**全部为负** ⇒ "按线上口径训能减脆"立住；
 *       有任何一粒 ≥0 ⇒ 判不出（按 §E309 的三种子纪律，只报极差、不报合并数）。
 *   (b) 不许"更稳但更弱"：pg 臂的**页面口径 H** 必须 ≥ 同种子 ex 臂 − 1pt（1pt 内算打平，因为同包换 eval seed 极差 p50 就有 1.5pt）。
 *   (c) 不许塌广度：pg 臂产物 G(long) ≥ 3（这条最常卡前沿）。
 *   (d) 仪器守卫：每臂"经它决策"必须 > 0（空枪 exit 8 已由工具自己钉）；且同种子两臂的**权重指纹必须不同**
 *       （§E249 那一族：零剂量臂的产物与孪生逐位相同 ⇒ 那种"两臂都一样"是假阴性，不是"没效果"）。
 *
 * 用法：node champion-map/eps-arms.mjs [--seeds=201,202,203] [--gens=250]
 *   产物：docs/artifacts/e315-out/<arm>.js（EPIRUS_T3P_OUT 分路，避免 §E35 那个"共用默认路径互相覆盖"的坑）
 */
import { spawn } from 'node:child_process';
import { existsSync, copyFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUTDIR = join(ROOT, 'docs/artifacts/e315-out');
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SEEDS = String(arg('seeds', '201,202,203')).split(',').map(Number);
const GENS = Number(arg('gens', 250));

/* 两臂：ex = 出厂口径（不设旗标）‖ pg = 线上口径（temp0.15·ε0.2·k5·soft，与 §E35 处理臂一字相同） */
const ARMS = [];
for (const s of SEEDS) {
  ARMS.push({ arm: 'epsX-' + s, seed: s, env: { EPIRUS_ARM: 'epsX-' + s, EPIRUS_SEED: String(s) } });
  ARMS.push({ arm: 'epsP-' + s, seed: s, env: { EPIRUS_ARM: 'epsP-' + s, EPIRUS_SEED: String(s),
    EPIRUS_TRAIN_EPS: '0.2', EPIRUS_TRAIN_EPS_K: '5', EPIRUS_TRAIN_EPS_MODE: 'soft', EPIRUS_TRAIN_TEMP: '0.15' } });
}
console.log('臂格 ' + ARMS.length + ' 支（' + SEEDS.length + ' 粒种子 × 2 口径）‖ 预算 ' + GENS + ' 代 · 5 人 · 12 局/代 · 种群 12');

function run(a) { return new Promise((res) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, ['tools/train-3p.mjs', String(GENS), '5', '12', '12'], {
    cwd: ROOT, env: Object.assign({}, process.env, a.env, { EPIRUS_T3P_OUT: 'docs/artifacts/e315-out/' + a.arm + '.js' }) });
  let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('exit', (code) => {
    const sec = ((Date.now() - t0) / 1000).toFixed(0);
    const dose = (out.match(/经它决策 \*\*(\d+)\*\* 次/) || [0, '0'])[1];
    const eps = (out.match(/消费点读回 (eps=[^\n]+)/) || [0, '出厂口径（未下达）'])[1];
    console.log('  ' + a.arm.padEnd(12) + ' exit ' + code + ' ‖ ' + sec + 's ‖ ' + eps + (code === 0 ? '' : '\n    ' + out.split('\n').slice(-6).join('\n    ')));
    res({ arm: a.arm, code: code, sec: +sec, dose: +dose, eps: eps });
  });
}); }
/* 并发 3 支：机器还有 DS 的门禁/浏览器要用，全开会把别人的活挤慢 */
const Q = ARMS.slice(), done = [];
async function pool() {
  const live = new Set();
  while (Q.length || live.size) {
    while (Q.length && live.size < 3) { const a = Q.shift(); const pr = run(a).then((r) => { live.delete(pr); done.push(r); }); live.add(pr); }
    await Promise.race(live);
  }
}
(async function () {
  const t0 = Date.now();
  await pool();
  console.log('\n全部跑完，用时 ' + ((Date.now() - t0) / 60000).toFixed(1) + ' 分钟');
  const bad = done.filter(r => r.code !== 0);
  if (bad.length) console.log('⛔ 非零退出 ' + bad.length + ' 支：' + bad.map(r => r.arm + '→exit' + r.code).join(' ‖ '));
  /* 判据 (d) 空枪守卫：处理臂必须有决策经过漏斗 */
  const zero = done.filter(r => r.arm.indexOf('epsP') === 0 && r.dose === 0);
  console.log('判据(d) 空枪：' + (zero.length ? '⛔ ' + zero.map(r => r.arm).join(' ') + ' 一次决策都没经过漏斗 ⇒ 该臂读数作废' : '✅ 处理臂全部有剂量'));
  const miss = done.filter(r => !existsSync(join(OUTDIR, r.arm + '.js')));
  console.log('产物齐备：' + (done.length - miss.length) + '/' + done.length + (miss.length ? ' ‖ 缺 ' + miss.map(r => r.arm).join(' ') : ''));
  console.log('\n下一步（量三栏 + 指纹守卫）：node champion-map/eps-arms-read.mjs');
})();
