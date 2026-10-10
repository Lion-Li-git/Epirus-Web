#!/usr/bin/env node
/* §E572 K=8 臂内 `trainFit` ↔ 验收尺配对实验的**跑臂**那一半（设计在 docs/research/EXAM-FIT-MATCH-2026-10-10.md §四）。
 *
 * 病（§二 的 P1 为什么"算不出"）：`trainFit` 只有 **1 臂 × 6 带**可比，其余臂各留 1 带；
 *   跨臂那 23 枚因为"配方换了题"不可合并（METHODOLOGY 877 那条：两臂的 bestFit 不可比）。
 *   ⇒ 唯一能钉死 P1 的形状是**臂内配对**：同配方同旗标、只换种子，把一臂的名人堂各带当成"训练自己的排序"。
 *
 * 判据（跑前写死，不许事后改口）：
 *   (a) 每臂 ≥5 个**去重后**的不同权重带（带按权重 JSON 的 sha1 去重，不按 dupOfBand —— 同一粒权重
 *       可能以不同对象进两次 hall，dupOfBand 那时是 null）。不足 5 带的臂**整个剔除并如实报数**，不补。
 *   (b) 主读数 = **每臂单独**的 Spearman ρ(trainFit, 考卷120) 与 ρ(trainFit, 页面120)；
 *       **不做跨臂合并**（那是坑 1）。跨臂只比**符号一致性**（8 臂同号数 + 精确二项 p，H0 各半）。
 *   (c) 判"匹配"的地板：中位 |ρ| ≥ 0.3 且 ≥7/8 同号；否则判"臂内也无信号"。
 *   (d) 分辨率随行报：每臂"fit 带间跨度"与"考卷带间极差"，并把后者与库内噪声尺（同包换 eval seed 极差
 *       p50 1.5pt / p90 3.7pt）并排 —— 极差 < 噪声尺的臂，ρ 是被衰减的，不许当成"训练没用"。
 *   (e) 仪器守卫：任何一臂 exit≠0 或带数 0 ⇒ 响亮报告；读数前必须核"取到值"而非只看 rc（§E569 那两次踩坑）。
 *
 * 纪律：命令行走 `tools/train-3p.mjs`（**只吃位置参数**，任何 `--` 一律 exit 64）；
 *   每臂必设 `EPIRUS_T3P_OUT` 与私有 `EPIRUS_BAND_DIR` ⇒ 不碰门禁比哈希的 `docs/artifacts/train-3p-out.js`
 *   （那两处门 D123/D127 断言它的哈希 = CLI_ARM_BASELINE），也**绝不设 EPIRUS_PUBLISH**。
 *   带文件落在 `docs/artifacts/k8bands/` 子目录：D82 只 readdirSync('docs/artifacts') 非递归，
 *   且 `*.bak` 全局忽略 ⇒ 本实验的账记在 `champion-map/k8bands.tsv`（含 trainFit 与权重 sha1），不靠 48 个 .bak 入库。
 *
 * 用法：node champion-map/k8arms.mjs [--arms=8] [--seedbase=301] [--gens=250] [--n=5] [--games=12] [--pop=12] [--pool=3]
 *        ‖ `--inventory` = 只盘点已落盘的带、不跑训练（重出清单用）
 *   产物：docs/artifacts/k8bands/<arm>/<arm>-band{1..6}.bak ‖ champion-map/k8bands.tsv（清单，tracked）
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BANDROOT = join(ROOT, 'docs/artifacts/k8bands');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
if (process.env.EPIRUS_PUBLISH === '1') { console.error('⛔ 本工具绝不允许设 EPIRUS_PUBLISH（会覆写线下冠军）'); process.exit(2); }
const N_ARMS = Number(arg('arms', 8)), GENS = Number(arg('gens', 250));
const SB = Number(arg('seedbase', 301));
const PN = arg('n', 5), PG = arg('games', 12), PP = arg('pop', 12), POOL = Number(arg('pool', 3));
const SEEDS = []; for (let i = 0; i < N_ARMS; i++) SEEDS.push(SB + i);

const arms = SEEDS.map((s) => ({ arm: 'k8s' + s, seed: s, dir: join(BANDROOT, 'k8s' + s) }));
console.log('臂格 ' + arms.length + ' 支（同配方同旗标，只换 EPIRUS_SEED）‖ 预算 ' + GENS + ' 代 · ' + PN + ' 人 · ' + PG + ' 局/代 · 种群 ' + PP + ' ‖ 并发 ' + POOL);

function run(a) { return new Promise((res) => {
  const t0 = Date.now();
  const env = Object.assign({}, process.env, {
    EPIRUS_ARM: a.arm, EPIRUS_SEED: String(a.seed),
    EPIRUS_BAND_DIR: 'docs/artifacts/k8bands/' + a.arm,
    EPIRUS_T3P_OUT: 'docs/artifacts/k8bands/' + a.arm + '/' + a.arm + '-out.js'
  });
  delete env.EPIRUS_PUBLISH;
  if (!existsSync(env.EPIRUS_BAND_DIR)) mkdirSync(env.EPIRUS_BAND_DIR, { recursive: true });
  const p = spawn(process.execPath, ['tools/train-3p.mjs', String(GENS), String(PN), String(PG), String(PP)],
    { cwd: ROOT, env });
  let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('exit', (code) => {
    const sec = ((Date.now() - t0) / 1000).toFixed(0);
    const files = existsSync(a.dir) ? readdirSync(a.dir).filter((f) => /-band\d+\.bak$/.test(f)) : [];
    console.log('  ' + a.arm.padEnd(9) + ' exit ' + code + ' ‖ 带 ' + files.length + ' ‖ ' + sec + 's' +
      (code === 0 ? '' : '\n    ' + out.split('\n').slice(-8).join('\n    ')));
    res({ arm: a.arm, code, sec: +sec, files, dose: +((out.match(/经它决策 \*\*(\d+)\*\* 次/) || [0, '0'])[1]) });
  });
}); }

const Q = arms.slice(), done = [], live = new Set();
async function pump() {
  while (Q.length || live.size) {
    while (Q.length && live.size < POOL) {
      const a = Q.shift();
      const p = run(a).then((r) => { live.delete(p); done.push(r); });
      live.add(p);
    }
    await Promise.race(live);
  }
}
(async function () {
  const t0 = Date.now();
  if (process.argv.includes('--inventory')) {
    /* 只盘点已落盘的带（重测/补清单用，不必重跑训练）：done = BANDROOT 的每个子目录 */
    done.length = 0;
    for (const d of readdirSync(BANDROOT)) {
      const files = readdirSync(join(BANDROOT, d)).filter((f) => /-band\d+\.bak$/.test(f));
      done.push({ arm: d, code: 0, sec: 0, files });
    }
    console.log('盘点模式：' + done.length + ' 支已落盘的臂（不跑训练）');
  } else { await pump(); }
  const rows = [['arm', 'seed', 'band', 'trainFit', 'packHash', 'dupInArm', 'selected', 'bandRel', 'gens', 'n', 'games', 'pop', 'recipeEnv']];
  let short = 0;
  for (const r of done.slice().sort((x, y) => x.arm < y.arm ? -1 : 1)) {
    const files = r.files.slice().sort((x, y) => (+x.match(/band(\d+)/)[1]) - (+y.match(/band(\d+)/)[1]));
    const seen = {};
    for (const f of files) {
      const txt = readFileSync(join(BANDROOT, r.arm, f), 'utf8');
      /* META 与权重各占一行；权重**是对象**（`{"v":7,"a":[…],"f":…}`）不是裸数组 ⇒ 按行前缀剥，别拿正则猜结构。 */
      const mLine = txt.split('\n').find((l) => l.startsWith('window.EPIRUS_CHAMPION_3P_META = '));
      const wLine = txt.split('\n').find((l) => l.startsWith('window.EPIRUS_CHAMPION_3P = '));
      if (!mLine || !wLine) { console.log('  ⛔ ' + r.arm + '/' + f + ' 读不出 META 或权重 ⇒ 该带不计入'); continue; }
      let meta; try { meta = JSON.parse(mLine.slice('window.EPIRUS_CHAMPION_3P_META = '.length).replace(/;\s*$/, '')); }
      catch (e) { console.log('  ⛔ ' + r.arm + '/' + f + ' META 解析失败：' + e.message + ' ⇒ 该带不计入'); continue; }
      const wjson = wLine.slice('window.EPIRUS_CHAMPION_3P = '.length).replace(/;\s*$/, '');
      const h = createHash('sha1').update(wjson).digest('hex').slice(0, 12);
      const dup = seen[h] !== undefined;
      if (!dup) seen[h] = 1;
      /* 同权重进两席**照写**并标 `dupInArm=1`（落选者也是证据，判据 (a) 的去重放在下游按 packHash 做） */
      rows.push([meta.arm, meta.seed, meta.bandIdx + 1, meta.trainFit, h, dup ? 1 : 0,
        meta.selected ? 1 : 0,
        'docs/artifacts/k8bands/' + r.arm + '/' + f, meta.gens, meta.n, meta.games, meta.pop,
        Object.keys(meta.recipe.env).map((k) => k + '=' + meta.recipe.env[k]).join(' ')]);
    }
    const nd = Object.keys(seen).length;
    if (nd < 5) { short++; console.log('  ⛔ ' + r.arm + ' 去重后只有 ' + nd + ' 带 ⇒ 判据(a) 不满足，本臂剔除'); }
  }
  writeFileSync(join(HERE, 'k8bands.tsv'), rows.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
  console.log('\n清单 champion-map/k8bands.tsv：' + (rows.length - 1) + ' 行（去重后不同权重 ' +
    new Set(rows.slice(1).map((r) => r[4])).size + ' 枚）‖ 不足 5 带的臂 ' + short + ' 支');
  console.log('全部跑完 ' + ((Date.now() - t0) / 60000).toFixed(1) + ' 分钟');
  console.log('下一步：node champion-map/k8measure.mjs（建 extra 表 → 交 eps-full 量两口径 120 档）');
})();
