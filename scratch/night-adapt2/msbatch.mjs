#!/usr/bin/env node
/* 多种子分批轮换训练驱动器（用户 11-10 晨令 · "游戏最早期就有多种子每轮更换种子的训练方法"）
 *
 * 结构：初始种子 → 确定性派生 N 个随机数 → 原本一轮的训练等分成 ROUNDS 批 →
 *   每批 = BRANCHES 条平行臂（各自用对应种子，同一起点包）→ 批间晋升 =
 *   裁定②口径（triplet 均值，平手看批内最低 cells）选最优者当下一批的起点包，种子每轮换新。
 *
 * 对照系（同一 KDO5C 起点、同一配方，只换训练结构）：
 *   OBS5-E（单种子 400 代）= +0.02~0.03 ‖ OBS5-F（单种子 800 代）= +0.28~0.31 ‖ 本驱动 = 等预算下的轮换结构。
 *
 * 用法：node scratch/night-adapt2/msbatch.mjs [--base=13] [--start=scratch/obs4/KDO5C.bak]
 *       [--rounds=2] [--branches=3] [--gens=200] [--arm=MSB]
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const BASE = Number(arg('base', 13)) || 13;
const START = arg('start', 'scratch/obs4/KDO5C.bak');
const ROUNDS = Number(arg('rounds', 2)) || 2;
const BRANCHES = Number(arg('branches', 3)) || 3;
const GENS = Number(arg('gens', 200)) || 200;
const ARM = arg('arm', 'MSB');
const OUTDIR = 'docs/artifacts/night-adapt';
const LEDGER = 'scratch/night-adapt2/triplet-ledger.tsv';
const LOG = 'scratch/night-adapt2/msbatch.log';
const log = (m) => { const line = '[' + new Date().toISOString().slice(11, 19) + '] ' + m; console.log(line); appendFileSync(LOG, line + '\n'); };

/* 初始种子 → mulberry 链派生 ROUNDS×BRANCHES 个随机数（确定性：同 base 同批种子） */
function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(BASE);
const SEEDS = Array.from({ length: ROUNDS * BRANCHES }, () => Math.floor(rng() * 0x7fffffff) + 1);
log('base=' + BASE + ' ⇒ 派生种子 ' + JSON.stringify(SEEDS));

const RECIPE_ENV = {
  EPIRUS_ARCH2: 'S1ob:input=obs5,gen=3,keySplit=1,seatH=24,actH=24,hid=32,hid2=24',
  EPIRUS_MUT_MODE: 'seg',
  EPIRUS_TRAIN_MODE: 'long',
  EPIRUS_KILL_REWARD: '2', EPIRUS_KILL_FIELD: '1',
  EPIRUS_MIX8: '4', EPIRUS_MIX2_EVERY: '4', EPIRUS_MIXHP_EVERY: '2',
  EPIRUS_COURSE_EVERY: '1', EPIRUS_COURSE_BOT: 'pickFarmer',
  EPIRUS_COUNTER_OPPS: 'gunFocus,gunSpam,guardSpam,targeter',
  EPIRUS_SEL_COUNTER: '1',
  EPIRUS_TRIPLET: '1', EPIRUS_TRIPLET_LOG: LEDGER,
};

function runArm(seed, seedpack, packPath, round, idx) {
  return new Promise((resolve) => {
    const armName = ARM + '-R' + round + '-' + seed;
    const env = Object.assign({}, process.env, RECIPE_ENV, {
      EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: seedpack, EPIRUS_SEED: String(seed),
      EPIRUS_ARM: armName, EPIRUS_T3P_OUT: packPath,
    });
    const t0 = Date.now();
    const child = spawn('node', ['tools/train-3p.mjs', String(GENS), '5', '24', '8'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      const min = ((Date.now() - t0) / 60000).toFixed(1);
      appendFileSync(LOG, '--- ' + armName + ' exit=' + code + ' 用时 ' + min + 'min\n' + out.split('\n').slice(-6).join('\n') + '\n');
      resolve({ seed, packPath, code, min });
    });
  });
}

function tripletOf(packPath) {
  const rows = readFileSync(LEDGER, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const r = rows.filter((x) => x.pack === packPath).pop();
  if (!r) return null;
  const cells = (r.cells_S || []).concat(r.cells_L || []);
  return { mean: (r.X4P_S + r.X4P_L) / 2, min: Math.min.apply(null, cells), spread: Math.max.apply(null, cells) - Math.min.apply(null, cells), raw: r };
}

if (!existsSync(START)) { console.error('⛔ 起点包不在：' + START); process.exit(5); }
let carry = START;
const summary = [];
for (let round = 1; round <= ROUNDS; round++) {
  const seeds = SEEDS.slice((round - 1) * BRANCHES, round * BRANCHES);
  log('=== 轮 ' + round + '/' + ROUNDS + '：' + BRANCHES + ' 臂 × ' + GENS + ' 代 ‖ 起点=' + carry + ' ‖ 种子 ' + JSON.stringify(seeds));
  const jobs = seeds.map((sd, i) => runArm(sd, carry, OUTDIR + '/' + ARM + '-R' + round + '-' + sd + '.js', round, i));
  const done = await Promise.all(jobs);
  const bad = done.filter((d) => d.code !== 0);
  if (bad.length === done.length) { log('⛔ 轮 ' + round + ' 全败：' + JSON.stringify(bad)); process.exit(9); }
  const scored = done.filter((d) => d.code === 0 && existsSync(d.packPath)).map((d) => Object.assign(d, { t: tripletOf(d.packPath) }));
  const unscored = scored.filter((d) => !d.t);
  if (unscored.length) log('⚠ ' + unscored.length + ' 臂没有 triplet 行（用 exist 兜底不晋升它们）');
  const ranked = scored.filter((d) => d.t).sort((a, b) => (b.t.mean - a.t.mean) || (b.t.min - a.t.min));
  if (!ranked.length) { log('⛔ 轮 ' + round + ' 没有可晋升产物'); process.exit(9); }
  for (const d of ranked) log('轮' + round + ' ' + d.packPath.split('/').pop().padEnd(24) + ' 均值 ' + d.t.mean.toFixed(4) + ' ‖ 批内最低 ' + d.t.min.toFixed(4) + ' ‖ 散布 ' + d.t.spread.toFixed(3) + ' ‖ seed=' + d.seed);
  const win = ranked[0];
  log('轮 ' + round + ' 晋升：' + win.packPath + '（均值 ' + win.t.mean.toFixed(4) + '）');
  summary.push({ round, winner: win.packPath, mean: win.t.mean, min: win.t.min, all: ranked.map((d) => ({ pack: d.packPath, mean: d.t.mean, min: d.t.min })) });
  carry = win.packPath;
}
writeFileSync('scratch/night-adapt2/msbatch-summary.json', JSON.stringify({ base: BASE, start: START, rounds: ROUNDS, branches: BRANCHES, gens: GENS, summary, final: carry }, null, 1));
log('=== 终局：' + carry + ' ‖ 晋升链均值 ' + summary.map((s) => 'R' + s.round + '=' + s.mean.toFixed(4)).join(' → '));
