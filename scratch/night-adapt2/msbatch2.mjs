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
 *       [--seg=50]（臂级中途节点：每 K 代快照当代最优粒到 band 目录，杀进程不丢）[--resume]（断点续跑：读
 *       msbatch2-state.json，跳过已完成的轮；state 与 base/arm/形状绑死，换参必须从头跑）
 * 并行（11-11 · 用户令"尽量提高性能利用"，18 核实测）：臂本来就用 Promise.all 并发（每臂单线程 ≈1 核），
 *   本机吞吐瓶颈在轮末重测——4 包 × 2 尺串行 ≈8min/轮 ⇒ 本次改并发（≈2min）。branches 还可以直接开大：
 *   18 核建议 ≤8（留核给 driver + 重测的 8 路 exam-4n），臂间独立 ⇒ 并发不改变任何随机流。
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
log('MSB 配方：COURSE_PACK=' + (process.env.MSB_COURSE_PACK || '(无)') + ' ‖ FIT_CHAMP=' + (process.env.MSB_FIT_CHAMP || '(无)') + ' ‖ FIT_EVERY=' + (process.env.MSB_FIT_EVERY || '(默认)') + ' ‖ SEG=' + (process.env.MSB_SEG || '50(默认)'));
log('base=' + BASE + ' ⇒ 派生种子 ' + JSON.stringify(SEEDS.slice(0, ROUNDS * BRANCHES)) + ' …');

const RECIPE_ENV = {
  EPIRUS_ARCH2: 'S1ob:input=obs5,gen=3,keySplit=1,seatH=24,actH=24,hid=32,hid2=24',
  EPIRUS_MUT_MODE: 'seg',
  EPIRUS_TRAIN_MODE: 'long',
  EPIRUS_KILL_REWARD: '2', EPIRUS_KILL_FIELD: '1',
  EPIRUS_MIX8: '4', EPIRUS_MIX2_EVERY: '4', EPIRUS_MIXHP_EVERY: '2',
  EPIRUS_COURSE_EVERY: '1', EPIRUS_COURSE_BOT: process.env.MSB_COURSE_BOT || 'pickFarmer',
  /* 11-10（用户：2P 统一冠军 + 不同人数/血量）：课程席可换成真实冠军包；
   * 与 FIT_CHAMP 合起来 = 5P 桌 2 席冠军 + 2 席脚本（plan B 的形状），2P 桌只落 FIT_CHAMP 一席。 */
  ...(process.env.MSB_COURSE_PACK ? { EPIRUS_COURSE_PACK: process.env.MSB_COURSE_PACK } : {}),
  EPIRUS_COUNTER_OPPS: 'gunFocus,gunSpam,guardSpam,targeter',
  EPIRUS_SEL_COUNTER: '1',
  EPIRUS_TRIPLET: '1', EPIRUS_TRIPLET_LOG: LEDGER,
  /* 11-11（用户令"中途节点保存"）：臂级每 K 代快照当代最优粒（当场落盘，11-03 修过内存蒸发坑）——
   *   杀进程/断电只丢最后一个 K 段；恢复 = 新臂 EPIRUS_SEEDPACK=<seg 快照> 热启动。 */
  EPIRUS_HOLDOUT_SEG: process.env.MSB_SEG || '50',
  /* 11-10（DS）：fitness 掺冠军桌（默认关；MSB_FIT_CHAMP 指包、MSB_FIT_EVERY 指每 k 局） */
  ...(process.env.MSB_FIT_CHAMP ? { EPIRUS_FIT_CHAMP: process.env.MSB_FIT_CHAMP, EPIRUS_FIT_CHAMP_EVERY: process.env.MSB_FIT_EVERY || '1' } : {}),
};

function runArm(seed, seedpack, packPath, round) {
  return new Promise((resolve) => {
    const armName = ARM + '-R' + round + 'S' + seed;
    const env = Object.assign({}, process.env, RECIPE_ENV, {
      EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: seedpack, EPIRUS_SEED: String(seed),
      EPIRUS_ARM: armName, EPIRUS_T3P_OUT: packPath,
    });
    const t0 = Date.now();
    const child = spawn('node', ['training/train-3p.mjs', String(GENS), '5', '24', '8'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
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
/* 11-10（DS 复核）：选择准则从 **A 轴 triplet** 换成 **C=(A+B)/2**（主尺）。
 *   病：夜里那条 +0.014→+0.29 的链全在 A 轴上选，选出来的冠军在冠军桌 2P 只赢 15%（C≈0）。 */
const W4 = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
function runExam(packPath, mode) {
  return new Promise((res) => {
    const a = ['tools/exam-4n.mjs', '100', '77000', packPath, '--dose=page', '--exam=both'];
    if (mode) a.push('--mode=' + mode);
    const c = spawn('node', a, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('close', () => {
      const line = out.split(/\r?\n/).find((l) => l.indexOf('[冠军4N-v2]') === 0);
      if (!line) return res(null);
      const g = (k) => { const m = new RegExp(k + '=(-?[0-9.]+)').exec(line); return m ? +m[1] : NaN; };
      const cells = [2, 3, 5, 8].map((n) => g('x' + n));
      if (cells.some((v) => !isFinite(v))) return res(null);
      const x4 = cells.reduce((s, v, i) => s + v * W4[[2, 3, 5, 8][i]], 0);
      res({ cells, x4 });
    });
  });
}
async function measure(packPath) {
  const t0 = Date.now();
  const [s, l] = [await runExam(packPath, ''), await runExam(packPath, 'long')];
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  if (!s || !l) { log('⚠ 重测失败（exam-4n both）：' + packPath); return null; }
  const cells = s.cells.concat(l.cells);
  const t = { mean: (s.x4 + l.x4) / 2, min: Math.min.apply(null, cells), spread: Math.max.apply(null, cells) - Math.min.apply(null, cells) };
  log('重测C ' + packPath.split('/').pop().padEnd(26) + ' C均值 ' + t.mean.toFixed(4) + ' ‖ 批内最低 ' + t.min.toFixed(4) + ' ‖ 散布 ' + t.spread.toFixed(3) + '（' + mins + 'min）');
  return t;
}
/* 台账是 triplet（A 轴）记的 ⇒ 换了 C 准则后不能再回读台账（两把尺混用 = 静默换尺）。一律现测。 */
function measureFromLedger() { return null; }

if (!existsSync(START)) { console.error('⛔ 起点包不在：' + START); process.exit(5); }
/* 断点续跑（11-11）：state = {base,arm,形状,champion,champT,seedIdx,history}，每轮收尾写盘。
 *   恢复时逐字校验形状（base/arm/rounds/branches/gens/margin/start）——任何一项不同 ⇒ 拒绝（种子流会错位）。 */
const STATE_F = 'scratch/night-adapt2/msbatch2-' + ARM + '-state.json';   // 11-11：按 ARM 分家——两个驱动器可并行（MSB6 纯轮换 + MSB7 课程轮同飞）
const RESUME = process.argv.includes('--resume');
let champion = START;            // 现有冠军（绝不回退的对象）
let champT = null;
let seedIdx = 0;
const history = [];
if (RESUME) {
  if (!existsSync(STATE_F)) { console.error('⛔ --resume 找不到 state：' + STATE_F); process.exit(5); }
  const st = JSON.parse(readFileSync(STATE_F, 'utf8'));
  const sig = { base: BASE, arm: ARM, rounds: ROUNDS, branches: BRANCHES, gens: GENS, margin: MARGIN, start: START };
  for (const k of Object.keys(sig)) {
    if (st[k] !== sig[k]) { console.error('⛔ --resume 形状不符：state.' + k + '=' + st[k] + ' ≠ 本次 ' + sig[k] + ' ⇒ 换参必须从头跑（种子流会错位）'); process.exit(5); }
  }
  champion = st.champion; champT = st.champT; seedIdx = st.seedIdx; history.push(...st.history);
  log('--resume：从轮 ' + (history.length + 1) + ' 续 ‖ 冠军=' + champion.split('/').pop() + '（' + champT.mean.toFixed(4) + '）‖ seedIdx=' + seedIdx);
} else {
  champT = measureFromLedger(champion) || (await measure(champion));
  if (!champT) { console.error('⛔ 起点包测不出'); process.exit(5); }
  writeFileSync(STATE_F, JSON.stringify({ base: BASE, arm: ARM, rounds: ROUNDS, branches: BRANCHES, gens: GENS, margin: MARGIN, start: START, champion, champT, seedIdx, history }, null, 1));
}
for (let round = history.length + 1; round <= ROUNDS; round++) {
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
  /* ⚑ 11-10 修：原来这里走 measureFromLedger（A 轴台账）——换 C 准则后我把它置 null ⇒ 臂全被丢掉、只剩冠军（本轮就是这么白判的）。改为一律现测 C。 */
  /* 11-11：重测并发（原来 4 包串行 ≈8min/轮是吞吐瓶颈；exam-4n 单线程 ⇒ 并发只吃核，不碰任何随机流） */
  const measured = await Promise.all([
    ...okArms.map(async (d) => ({ label: 'S' + d.seed, pack: d.packPath, t: await measure(d.packPath) })),
    (async () => ({ label: '冠军', pack: champion, t: await measure(champion) }))(),
  ]);
  const pool = measured.filter((m) => m.t);
  const champEntry = pool.find((m) => m.label === '冠军');
  if (champEntry) champT = champEntry.t;
  if (!pool.length) { log('⛔ 轮 ' + round + ' 重测全失败'); process.exit(9); }
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
  /* 轮收尾即写 state（断点续跑的最小恢复粒度 = 一轮；臂内更细的恢复靠 HOLDOUT_SEG 的 seg 快照热启动） */
  writeFileSync(STATE_F, JSON.stringify({ base: BASE, arm: ARM, rounds: ROUNDS, branches: BRANCHES, gens: GENS, margin: MARGIN, start: START, champion, champT, seedIdx, history }, null, 1));
}
writeFileSync('scratch/night-adapt2/msbatch2-' + ARM + '-summary.json', JSON.stringify({ base: BASE, start: START, rounds: ROUNDS, branches: BRANCHES, gens: GENS, margin: MARGIN, final: champion, history }, null, 1));
log('=== 终局冠军：' + champion + '（' + champT.mean.toFixed(4) + '）‖ 轮链 ' + history.map((h) => 'R' + h.round + '=' + h.champMean.toFixed(4)).join(' → '));
