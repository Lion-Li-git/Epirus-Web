#!/usr/bin/env node
/* 多种子轮换训练 v2（用户 11-10 晨令）——**按最初 2P 训练模式（首提交 server/train-server.mjs）的晋升机制移植**：
 *   ① 每轮 = N 条独立种子臂 × GENS 代，臂各有父代（不是单赢家延续）
 *   ② 轮间晋升 = 父母池（本轮各臂冠军 + **现有冠军同口径重测**）按 triplet 均值排序 → 保留前 √n 名
 *      → 按名次"越靠前分得越多"分配下一轮的臂（3 臂 = 2+1；√3=2）
 *   ③ 绝不回退：冠军只在被明显（> MARGIN）击败时才换代，但它的线始终留在父母池里
 *   目的（2P 模式注释原文）："轮间重新择优/重开种子，避免长跑 sigma 坍缩与冠军蝉联"
 *   —— 对应今晚的病灶：单种子单轨迹 = 随机数主导（OBS5-D-s13 逐位复现同一吸引子）。
 *
 * 用法：node scratch/night-adapt2/msbatch2.mjs [--base=13] [--start=scratch/obs4/KDO5C.bak]
 *       [--rounds=2] [--branches=3] [--gens=200] [--arm=MSB2] [--margin=0.03]
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const BASE = Number(arg('base', 13)) || 13;
const START = arg('start', 'scratch/obs4/KDO5C.bak');
const ROUNDS = Number(arg('rounds', 2)) || 2;
const BRANCHES = Number(arg('branches', 3)) || 3;
const GENS = Number(arg('gens', 200)) || 200;
const ARM = arg('arm', 'MSB2');
const MARGIN = Number(arg('margin', 0.03)) || 0.03;   // 2P 模式的 >4win-pp 在 triplet X̄₄ 尺上的折算
const OUTDIR = 'docs/artifacts/night-adapt';
const LEDGER = 'scratch/night-adapt2/triplet-ledger.tsv';
const LOG = 'scratch/night-adapt2/msbatch2.log';
const log = (m) => { const line = '[' + new Date().toISOString().slice(11, 19) + '] ' + m; console.log(line); appendFileSync(LOG, line + '\n'); };

function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(BASE);
const SEEDS = Array.from({ length: ROUNDS * BRANCHES + 2 }, () => Math.floor(rng() * 0x7fffffff) + 1);   // 含冠军重测的余量
log('base=' + BASE + ' ⇒ 派生种子 ' + JSON.stringify(SEEDS.slice(0, ROUNDS * BRANCHES)) + ' …');

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

function runArm(seed, seedpack, packPath, round) {
  return new Promise((resolve) => {
    const armName = ARM + '-R' + round + 'S' + seed;
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
      appendFileSync(LOG, '--- ' + armName + '（父=' + seedpack.split('/').pop() + '）exit=' + code + ' 用时 ' + min + 'min\n' + out.split('\n').slice(-5).join('\n') + '\n');
      resolve({ seed, packPath, code });
    });
  });
}

/* 同口径重测（2P 模式：现有冠军每轮都按同一把尺重测）⇒ triplet 的 JSON 只打 stdout（台账行是 train-3p 代写的）
 *   ⇒ 这里直接解析 stdout（v2 修：直调不落台账，v1 版因此秒退） */
function measure(packPath) {
  const t0 = Date.now();
  const r = spawnSync('node', ['tools/exam4-triplet.mjs', packPath, '100', '77000'], { stdio: 'pipe', encoding: 'utf8' });
  const min = ((Date.now() - t0) / 60000).toFixed(1);
  const m = ((r.stdout || '') + (r.stderr || '')).match(/\{"pack":[\s\S]*\}/);
  if (!m) { log('⚠ 重测无 JSON 输出：' + packPath + '（exit=' + r.status + '）'); return null; }
  let row;
  try { row = JSON.parse(m[0]); } catch (e) { log('⚠ 重测 JSON 解析失败：' + (e && e.message)); return null; }
  const cells = (row.cells_S || []).concat(row.cells_L || []);
  const t = { mean: (row.X4P_S + row.X4P_L) / 2, min: Math.min.apply(null, cells), spread: Math.max.apply(null, cells) - Math.min.apply(null, cells) };
  log('重测 ' + packPath.split('/').pop().padEnd(26) + ' 均值 ' + t.mean.toFixed(4) + ' ‖ 批内最低 ' + t.min.toFixed(4) + ' ‖ 散布 ' + t.spread.toFixed(3) + '（' + min + 'min）');
  return t;
}
function measureFromLedger(packPath) {
  const rows = readFileSync(LEDGER, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const row = rows.filter((x) => x.pack === packPath).pop();
  if (!row) return null;
  const cells = (row.cells_S || []).concat(row.cells_L || []);
  return { mean: (row.X4P_S + row.X4P_L) / 2, min: Math.min.apply(null, cells), spread: Math.max.apply(null, cells) - Math.min.apply(null, cells) };
}

if (!existsSync(START)) { console.error('⛔ 起点包不在：' + START); process.exit(5); }
let champion = START;            // 现有冠军（绝不回退的对象）
let champT = measureFromLedger(champion) || measure(champion);
if (!champT) { console.error('⛔ 起点包测不出'); process.exit(5); }
let seedIdx = 0;
const history = [];
for (let round = 1; round <= ROUNDS; round++) {
  log('=== 轮 ' + round + '/' + ROUNDS + '：' + BRANCHES + ' 臂 × ' + GENS + ' 代 ‖ 现有冠军=' + champion.split('/').pop() + '（' + champT.mean.toFixed(4) + '）');
  /* 父母分配：2P 模式 3 臂 = 2+1——第 0 轮全从起点包；后续轮 = 上轮父母池按名次分配 */
  const parents = (round === 1)
    ? Array.from({ length: BRANCHES }, () => champion)
    : history[history.length - 1].nextParents;
  const jobs = [];
  for (let b = 0; b < BRANCHES; b++) {
    const seed = SEEDS[seedIdx++];
    jobs.push(runArm(seed, parents[b], OUTDIR + '/' + ARM + '-R' + round + 'S' + seed + '.js', round));
  }
  const done = await Promise.all(jobs);
  const okArms = done.filter((d) => d.code === 0 && existsSync(d.packPath));
  if (!okArms.length) { log('⛔ 轮 ' + round + ' 全败'); process.exit(9); }
  for (const d of done.filter((x) => x.code !== 0)) log('⚠ 臂败 seed=' + d.seed + ' exit=' + d.code + '（不进父母池）');

  /* 本轮收尾：各臂 triplet（臂自带）→ 父母池 = 臂们 + 现有冠军（同口径重测）→ √n 保留 → 2+1 分配 */
  const pool = okArms.map((d) => { const t = measureFromLedger(d.packPath); return t ? { label: 'S' + d.seed, pack: d.packPath, t } : null; }).filter(Boolean);
  const champRemeasured = measure(champion);   // 同口径重测（2P 模式每轮都重测现有冠军）
  if (champRemeasured) champT = champRemeasured;
  pool.push({ label: '冠军', pack: champion, t: champT });
  pool.sort((a, b) => (b.t.mean - a.t.mean) || (b.t.min - a.t.min));
  for (const p of pool) log('轮' + round + '池 ' + p.label.padEnd(10) + ' ' + p.pack.split('/').pop().padEnd(26) + ' 均值 ' + p.t.mean.toFixed(4) + ' ‖ 最低 ' + p.t.min.toFixed(4));
  /* 绝不回退：冠军只在被 >MARGIN 击败时换代（否则保留原冠军；但它总在池里） */
  let newChamp = champion, newT = champT;
  if (pool[0].pack !== champion && pool[0].t.mean > champT.mean + MARGIN) { newChamp = pool[0].pack; newT = pool[0].t; log('轮 ' + round + ' 换代：' + pool[0].label + ' 超 margin（' + (pool[0].t.mean - champT.mean).toFixed(4) + ' > ' + MARGIN + '）'); }
  else log('轮 ' + round + ' 冠军保留（无臂超 margin' + (pool[0].pack !== champion ? '，最高差 ' + (pool[0].t.mean - champT.mean).toFixed(4) : '') + '）');
  /* 父母池：保留前 √n=2 名，按名次分配 3 臂 = 2+1（越靠前分得越多） */
  const keepN = Math.max(1, Math.ceil(Math.sqrt(BRANCHES)));
  const kept = pool.slice(0, keepN);
  const baseN = Math.floor(BRANCHES / kept.length), remN = BRANCHES - baseN * kept.length;
  const nextParents = [];
  kept.forEach((p, i) => { const cnt = baseN + (i < remN ? 1 : 0); for (let j = 0; j < cnt; j++) nextParents.push(p.pack); });
  log('轮 ' + round + ' 父母池：' + kept.map((p) => p.label + '(' + p.t.mean.toFixed(3) + ')').join(' ‖ ') + ' ⇒ 分配 ' + nextParents.map((p) => p.split('/').pop()).join(' / '));
  history.push({ round, champion: newChamp, champMean: newT.mean, pool: pool.map((p) => ({ label: p.label, pack: p.pack, mean: p.t.mean, min: p.t.min })), nextParents });
  champion = newChamp; champT = newT;
}
writeFileSync('scratch/night-adapt2/msbatch2-summary.json', JSON.stringify({ base: BASE, start: START, rounds: ROUNDS, branches: BRANCHES, gens: GENS, margin: MARGIN, final: champion, history }, null, 1));
log('=== 终局冠军：' + champion + '（' + champT.mean.toFixed(4) + '）‖ 轮链 ' + history.map((h) => 'R' + h.round + '=' + h.champMean.toFixed(4)).join(' → '));
