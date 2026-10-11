/* champion-map/opphuman-arms.mjs —— v1.6.60 人类形状替身（EPIRUS_OPP_HUMAN）**配对臂驱动**
 *
 * 问题（本实验唯一要回答的）：
 *   把「人类形状替身」放上训练桌（`EPIRUS_OPP_HUMAN=2`），能不能让训出来的包在**闸侧读数**上变好？
 *
 * ===== 跑前钉死的判据（写在这里，跑完不许改）=====
 * 设计：3 粒种子 × 配对两臂（同 seed，**只有 EPIRUS_OPP_HUMAN 不同**）⇒ 6 臂。
 *   off = 出厂桌（19 脚本 + 1 冠军） ‖ on = 出厂桌 + 2 个人类形状替身
 * 端点（只看闸侧，**不许用训练分** —— §E572 实测训练分排不出验收序：ρ 中位 ≈ −0.09、
 *   符号一致性 p=0.727、最高 fit 那带 0/8 拿第一）：
 *   ① 主端点 = 当选包在**人席**上的六格均值（multi/long 两口径，越低越好）
 *   ② 次端点 = `promote --dry` 的阻断条数（0 = 过闸）
 *   ③ 护栏   = `G(long)` 不许塌（< 3 即算塌）、页面 H 不许掉出噪声带
 * 判 PASS（**这是筛查不是确证**，n=3 只能排除大效应）：
 *   3/3 粒同号改善 **且** 配对均值改善 ≥ 3.0pt（≈ 千问 §E576(b) 新量的"同枚换 seed"仪器抖动 p90 2.0~2.3pt 加余量）
 * 判 FAIL（杀）：
 *   2 粒及以上反号 **或** |配对均值| < 1.0pt ⇒ 本 n 下无信号
 * 其余 = 不可判 ⇒ 要不要加样本由用户裁（本仓教训：n=3 不足以定论）
 * ⚠ 引用时的尺子口径（千问 §E576(b) 点名过的坑）：
 *   0.7~2.3pt 是**同一枚包换 seed** 的仪器抖动；12.8pt 是**臂与臂之间**的读数差地板 —— 两个不是一回事，别混读。
 *
 * ===== 纪律（照 k8arms.mjs，逐条都是踩过的疤）=====
 * - 每臂必设 `EPIRUS_T3P_OUT` 与私有 `EPIRUS_BAND_DIR` ⇒ **不碰**门禁比哈希的
 *   `docs/artifacts/train-3p-out.js`（D123/D127 断言它的哈希 = CLI_ARM_BASELINE）
 * - **绝不设** `EPIRUS_PUBLISH`（设了就 exit 2；它会覆写线下冠军槽）
 * - 带文件落 `docs/artifacts/opphuman/<arm>/` **子目录** ⇒ D82 只 readdirSync('docs/artifacts') 非递归，不欠它的账；
 *   且 `*.bak` 全局忽略 ⇒ 本实验的账记在 `champion-map/opphuman-arms.tsv`（含 trainFit 与权重 sha1）
 * - 不给线上两颗冠军槽写任何东西；不 promote；不改 `js/**`
 *
 * ===== v2（2026-10-11 A′）：**热启动配对** —— 上批（冷启动 250 代）判「不可判」，病因不是 n 小，
 *   是**两臂都太弱、离现役太远**（人席均值 21~33 vs 现役 8.04），且六支臂全是**尖刺形**（三格 0、一格 70~100%）
 *   ⇒ 六格均值在那形状上量的是「哪个孔没堵上」，不是「人类对手有没有用」。
 *   本批改法：两臂都**从现役 `js/bundled-champion-3p.js` 热启动续训**（`EPIRUS_HOTSTART=1` + `EPIRUS_SEEDPACK=`），
 *   唯一差异仍是 `EPIRUS_OPP_HUMAN` ⇒ 起点贴在同一条线上，配对差才是"人类对手"的净效应。
 *   依据：§E438 —— 过线的臂恰好都是**从过线的种子出发**的；从未过线的包热启动"臂大概率继承缺陷"。
 *
 * ===== 本批判据（跑前钉死）=====
 *   主端点 = 人席**最坏格**（`最大格` 列，两批 × 两口径 取最大）的配对差 ON − OFF（负 = 改善）
 *            —— 上批的教训：均值会被单个尖刺格支配，最坏格才是"这个包能不能上桌"的那一栏
 *   次端点 = 人席六格均值（两批两口径平均）的配对差（与上批可比）
 *   护栏   = `G(long) ≥ 3` 不塌 ‖ 零剂量守卫（同 seed 两臂指纹必须不同）
 *   PASS = 3/3 同号改善（最坏格）且配对均值改善 ≥ 3.0pt ‖ FAIL = ≥2 粒反号 或 |均值| < 1.0pt
 *   ⚠ 只看闸侧，**不许用训练分**（§E572）‖ ⚠ 尺子口径：0.7~2.3pt = 同枚换 seed 抖动，12.8pt = 臂间地板
 * ================================================================================================
 *
 * 用法： node champion-map/opphuman-arms.mjs [--gens=250] [--n=5] [--games=12] [--pop=12] [--pool=3]
 *                                      [--seeds=301,302,303] [--human=2] [--tag=] [--hotstart=<包>]
 * 产物：
 *   docs/artifacts/opphuman/<arm>/<arm>-band{1..6}.bak ‖ champion-map/opphuman-arms[-<tag>].tsv（tracked）
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BANDROOT = join(ROOT, 'docs/artifacts/opphuman');

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };

if (process.env.EPIRUS_PUBLISH === '1') {
  console.error('⛔ 本工具绝不允许设 EPIRUS_PUBLISH（会覆写线下冠军）');
  process.exit(2);
}

const GENS = Number(arg('gens', 250));
const PN = arg('n', 5), PG = arg('games', 12), PP = arg('pop', 12), POOL = Number(arg('pool', 3));
const HUMAN = Number(arg('human', 2));
const TAG = arg('tag', '');
/* 热启动源：给了就开 `EPIRUS_HOTSTART=1`（两臂都从这枚包续训）。默认空 = 冷启动（v1 那批的形状）。 */
const HOTSTART = arg('hotstart', '');
const SEEDS = String(arg('seeds', '301,302,303')).split(',').map((s) => Number(s.trim())).filter((x) => x > 0);

/* 臂格：每粒种子两臂，唯一差异 = EPIRUS_OPP_HUMAN */
const arms = [];
for (const s of SEEDS) {
  arms.push({ arm: 's' + s + '-off' + (TAG ? '-' + TAG : ''), seed: s, human: 0 });
  arms.push({ arm: 's' + s + '-on' + (TAG ? '-' + TAG : ''), seed: s, human: HUMAN });
}

console.log('配对臂 ' + arms.length + ' 支（' + SEEDS.length + ' 粒种子 × 2 状态，同配方只换 EPIRUS_OPP_HUMAN）'
  + '‖ 预算 ' + GENS + ' 代 · ' + PN + ' 人 · ' + PG + ' 局/代 · 种群 ' + PP + ' ‖ 并发 ' + POOL
  + '‖ 人类形状替身 = ' + HUMAN + ' 席'
  + '‖ 起点 = ' + (HOTSTART ? ('热启动 ' + HOTSTART) : '冷启动'));
console.log('判据跑前已钉：见本文件头部（主端点 = 人席**最坏格**配对差；只看闸侧，不用训练分）\n');

const t0 = Date.now();
const done = [];
let fail = 0;
let running = 0;
let idx = 0;

function launch(a) {
  const env = {
    ...process.env,
    EPIRUS_ARM: a.arm,
    EPIRUS_SEED: String(a.seed),
    EPIRUS_BAND_DIR: 'docs/artifacts/opphuman/' + a.arm,
    EPIRUS_T3P_OUT: 'docs/artifacts/opphuman/' + a.arm + '/' + a.arm + '-out.js',
  };
  delete env.EPIRUS_PUBLISH;
  if (a.human > 0) env.EPIRUS_OPP_HUMAN = String(a.human); else delete env.EPIRUS_OPP_HUMAN;
  if (HOTSTART) { env.EPIRUS_HOTSTART = '1'; env.EPIRUS_SEEDPACK = HOTSTART; }
  else { delete env.EPIRUS_HOTSTART; delete env.EPIRUS_SEEDPACK; }
  if (!existsSync(join(ROOT, env.EPIRUS_BAND_DIR))) mkdirSync(join(ROOT, env.EPIRUS_BAND_DIR), { recursive: true });

  const t = Date.now();
  const p = spawn(process.execPath, ['tools/train-3p.mjs', String(GENS), String(PN), String(PG), String(PP)], { cwd: ROOT, env });
  let last = '';
  p.stdout.on('data', (d) => { const s = String(d); last = s.split('\n').filter(Boolean).slice(-1)[0] || last; });
  p.stderr.on('data', (d) => { last = String(d).split('\n').filter(Boolean).slice(-1)[0] || last; });
  running++;
  p.on('exit', (code) => {
    running--;
    const sec = ((Date.now() - t) / 1000).toFixed(1);
    if (code === 0) {
      done.push({ ...a, sec: Number(sec) });
      console.log('  ✔ ' + a.arm + '（seed ' + a.seed + ' · human ' + a.human + '）' + sec + 's ‖ ' + last.slice(0, 96));
    } else {
      fail++;
      console.log('  ✘ ' + a.arm + ' exit ' + code + '（' + sec + 's）‖ ' + last.slice(0, 160));
    }
    pump();
  });
  return p;
}

function pump() {
  while (running < POOL && idx < arms.length) launch(arms[idx++]);
  if (running === 0 && idx >= arms.length) report();
}

function sha1(s) { return createHash('sha1').update(s).digest('hex'); }

function report() {
  const rows = [['arm', 'seed', 'oppHuman', 'hotstart', 'band', 'trainFit', 'packHash12', 'selected', 'bandRel', 'gens', 'n', 'games', 'pop', 'sec']];
  const selectedPacks = [];
  for (const r of done.slice().sort((x, y) => (x.seed - y.seed) || (x.human - y.human))) {
    const d = join(BANDROOT, r.arm);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.bak')).sort()) {
      const txt = readFileSync(join(d, f), 'utf8');
      const mLine = txt.split('\n').find((l) => l.startsWith('window.EPIRUS_CHAMPION_3P_META = '));
      const wLine = txt.split('\n').find((l) => l.startsWith('window.EPIRUS_CHAMPION_3P = '));
      if (!mLine || !wLine) continue;
      let meta; try { meta = JSON.parse(mLine.slice('window.EPIRUS_CHAMPION_3P_META = '.length).replace(/;\s*$/, '')); } catch (e) { continue; }
      const wjson = wLine.slice('window.EPIRUS_CHAMPION_3P = '.length).replace(/;\s*$/, '');
      const rel = 'docs/artifacts/opphuman/' + r.arm + '/' + f;
      rows.push([r.arm, r.seed, r.human, HOTSTART || '', f.replace('.bak', ''), meta.trainFit != null ? Number(meta.trainFit).toFixed(4) : '',
        sha1(wjson).slice(0, 12), meta.selected ? 1 : 0, rel, meta.gens, meta.n, meta.games, meta.pop, r.sec]);
      if (meta.selected) selectedPacks.push({ arm: r.arm, seed: r.seed, human: r.human, rel, trainFit: meta.trainFit });
    }
  }
  const TSV = join(HERE, 'opphuman-arms' + (TAG ? '-' + TAG : '') + '.tsv');
  writeFileSync(TSV, rows.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
  console.log('\n清单 champion-map/opphuman-arms' + (TAG ? '-' + TAG : '') + '.tsv：' + (rows.length - 1) + ' 行'
    + '‖ 成功臂 ' + done.length + '/' + arms.length + '‖ 失败 ' + fail
    + '‖ 总机时 ' + ((Date.now() - t0) / 1000 / 60).toFixed(1) + ' 分钟');
  console.log('\n===== 当选包（下一步量这些）=====');
  for (const s of selectedPacks) console.log('  ' + s.arm + '\tseed=' + s.seed + '\thuman=' + s.human + '\t' + s.rel);
  if (!selectedPacks.length) console.log('  ⚠ 一枚 selected 都没有 —— 先查臂日志，别去量');
  console.log('\nNEXT：把这些包喂给闸侧三把尺（promote --dry / probe-human-seat / eval-5p 配对），判据见本文件头部。');
}

pump();
