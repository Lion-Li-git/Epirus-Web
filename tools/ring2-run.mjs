/* ring2 实验自跑器：训练 seeds + 两考卷评估 + 生成 ab-analyze 的输入日志
 *
 * 为什么要有它（而不是在会话里手搓 bash 循环）：
 *   HANDOFF §5.1-1 的教训 ——「别把等待写进 tool call」。上次我写了个 15 分钟轮询循环，
 *   把 DSH 整个卡死、作业被带走。这个脚本把「等待」关在**它自己的进程内**：
 *     起 server → 逐个 seed 抓 SSE（完成即落产物）→ 关 server → 跑评估 → 写汇总日志。
 *   会话侧只做「一次看一眼」（job_output 或 tail 状态日志），不再有长等待。
 *   §5.1-9 的坑（按命令行模式杀进程会杀掉自己）也一并绕开：不改用 kill-by-pattern，
 *   而是**自动挑一个空闲端口**，残留 server 不冲突；server 是本脚本的子进程，直接 kill。
 *
 * 用法（bash 写法；pwsh 用 $env:RING2_XXX='..'）:
 *   node tools/ring2-run.mjs                      # 训练 32..36 + 评估 12 臂 + 汇总
 *   RING2_STAGE=eval  node tools/ring2-run.mjs    # 只评估（产物已在时）
 *   RING2_STAGE=train node tools/ring2-run.mjs    # 只训练
 *   RING2_SEEDS=32,33 node tools/ring2-run.mjs    # 只跑指定 seed
 *   RING2_FORCE=1     node tools/ring2-run.mjs    # 已有产物也重跑
 *   # 高精度复核：环场每臂 400 局（40 局时单跑极差 82.5pt，读不出效应）
 *   RING2_STAGE=eval RING2_RGAMES=400 RING2_TAG=r400 node tools/ring2-run.mjs
 *   RING2_ONLY=ring   # 只跑环场（跳标准考卷）
 *   # 长程（5 血）实验：12 对手池 + 5 血训练，考卷2 = 5 血标准考卷
 *   RING2_MODE=long RING2_POOL=A RING2_ARM=long RING2_SEEDS=31,32,33,34,35,36 \
 *     RING2_EXAM2FLAGS='--mode=long' RING2_TAG=long node tools/ring2-run.mjs
 *
 * 产物（*.log 与 *.bak 都已被 .gitignore 忽略）:
 *   docs/artifacts/ring2-<seed>.bak       冠军包
 *   docs/artifacts/ring2-<seed>.sse.log   原始 SSE（含 error 事件）
 *   docs/artifacts/ring2-status.log       进度（可 tail）
 *   docs/artifacts/ring2-eval.log         逐臂逐考卷读数（人读）
 *   docs/artifacts/ring2-run.log          ab-analyze.mjs 的输入（机器读）
 *   docs/artifacts/ring2-analyze.log      ab-analyze.mjs 的输出
 *
 * 会被还原的副作用：训练每轮都会改写 js/bundled-champion-3p.js，
 * 并通过 bumpChampionVersion() 刷 index.html 的 ?v= 缓存戳 ⇒ 脚本开头备份字节、结尾原样写回。
 */
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, copyFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

/* ===== 环境配置（必须在下面用到 TAG / EGAMES 的路径常量之前声明：const 有 TDZ，
 * node --check 查不出来，只有运行到那一行才炸 —— 本文件第一版就栽在这）===== */
const STAGE = process.env.RING2_STAGE || 'all';       // all | train | eval
/* 每考卷局数：§6.4 的预注册口径是 40；RING2_RGAMES 可单独抬高环场局数。
 * 为什么需要：环场（1 组合 × N 局）在 40 局下单跑极差可达 82.5pt ⇒ 配对统计读不出东西。
 * 抬局数压低的是**每臂的抽样噪声**（不能压低"每个 seed 落到哪个局部最优"的真实异质性，
 * 那只能靠加 seed）⇒ 用来区分"指标噪声"与"真效应"。 */
const EGAMES = Number(process.env.RING2_EGAMES || 40);
const RGAMES = Number(process.env.RING2_RGAMES || EGAMES);
const ONLY = process.env.RING2_ONLY || '';            // '' | standard | ring
const TAG = process.env.RING2_TAG ? '-' + process.env.RING2_TAG : '';
/* v1.5.0：本工具从「ring2 专用」扩成**通用 seed-sweep**（换池子/换模式/换考卷都是环境变量）。
 *   RING2_MODE       训练模式（'long' = 5 血长程）；不设 ⇒ URL 里不带 mode ⇒ 旧行为逐位不变
 *   RING2_POOL       训练池（'A' = 12 对手，与 ms2-p12 控制臂同池；默认 'B' = 13 含 ringspam）
 *   RING2_ARM        实验臂产物前缀（默认 ring2 ⇒ ring2-<seed>.bak）
 *   RING2_CTRL       控制臂前缀（默认 ms2-p12）
 *   RING2_EXAM2FLAGS 第二考卷参数（默认环场；长程实验传 --mode=long = 5 血标准考卷） */
const TRAIN_MODE = process.env.RING2_MODE || '';
const ARM = process.env.RING2_ARM || 'ring2';
const CTRL = process.env.RING2_CTRL || 'ms2-p12';
const EXAM2 = (process.env.RING2_EXAM2FLAGS || '--mode=long --field=ringwall').split(' ').filter(Boolean);
/* v1.5.2：风格切片（复合适应度）—— 在池子预算之外追加 k 局对风格冠军的局，1st 率按权重并进 fit。 */
const STYLE_OPPS = process.env.RING2_STYLEOPPS || '';
const STYLE_W = process.env.RING2_STYLEW || '';
const STYLE_G = process.env.RING2_STYLEGAMES || '';

/* ===== 路径 ===== */
const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ART = join(root, 'docs', 'artifacts');
const BUNDLE_MP = join(root, 'js', 'bundled-champion-3p.js');
const INDEX = join(root, 'index.html');
const BASE = join(ART, 'champion-5p-v1.3.58.bak');   // 热启动起点（与 ms2/ring2-31 同一权重）
const STATUS = join(ART, 'ring2-status' + TAG + '.log');
const EVALLOG = join(ART, 'ring2-eval' + TAG + '.log');
const RUNLOG = join(ART, 'ring2-run' + TAG + '.log');
const ANALOG = join(ART, 'ring2-analyze' + TAG + '.log');
/* ⚠ 命名规矩：TAG 必须加在**扩展名之前**（`<名字><TAG>.log`）。
 * 我踩过一次：状态/服务端日志原本写成 `ring2-status.log-<tag>` ⇒ `.gitignore` 的 `*.log`
 * 匹配不到 ⇒ `git add -A` 会把它们带进仓库。np-test L5 现在守着这条。 */
const SERVERLOG = join(ART, 'ring2-server' + TAG + '.log');
/* 每个臂每个考卷的**完整 stdout**（含出手种类/分布、ep 分带、cost>=3 出手占比、
 * 前置条件读数）——只解析 1st/top2 会把"技能使用分布变了吗"这类问题丢掉。 */
const STDOUTLOG = join(ART, 'ring2-stdout' + TAG + '.log');

/* ===== 实验输入 ===== */
const POOL_A = 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver';
const POOL_B = POOL_A + ',ringspam';
/* v1.5.0：池子可选 —— 'A' = 12 对手（与 ms2-p12 控制臂同池），默认 'B' = 13（含 ringspam）。
 * v1.5.2：也可以直接传**自定义名单**（含 `champ:<路径>` 冠军对手），例：
 *   RING2_POOL='random,defend,champ:docs/artifacts/champion-5p-hA9.bak' */
const POOL = (function () {
  const v = String(process.env.RING2_POOL || 'B');
  const u = v.toUpperCase();
  if (u === 'A') return POOL_A;
  if (u === 'B') return POOL_B;
  return v;   // 当名单用
})();
const SEEDS = (process.env.RING2_SEEDS || '32,33,34,35,36').split(',').map(function (s) { return Number(s.trim()); }).filter(Boolean);
const ALL_SEEDS = Array.from(new Set([31].concat(SEEDS)));   // 31 常备（ring2 上一轮已有；长程实验要新训）
const GENS = Number(process.env.RING2_GENS || 250), NP = 5, POP = 16, GPO = 8;
const EN = 5, ESEED = 77000;
const LBL_C = 'p12', LBL_E = 'r17';                   // ab-analyze 的两个臂名
const SEED_TIMEOUT_MS = Number(process.env.RING2_SEED_TIMEOUT_MS || 900000);

const T0 = Date.now();
function say(msg) {
  const l = '[' + ((Date.now() - T0) / 1000).toFixed(1) + 's] ' + msg;
  console.log(l);
  try { appendFileSync(STATUS, l + '\n'); } catch (e) { /* ignore */ }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function readMeta(file) {
  try {
    const src = readFileSync(file, 'utf8');
    const m = src.match(/EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\});/);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) { return null; }
}

/* 挑一个空闲端口：不依赖「杀掉残留 server」这种危险动作（§5.1-9）。 */
function freePort(start) {
  return new Promise(function (resolve, reject) {
    let p = start;
    (function tryOne() {
      if (p > start + 30) return reject(new Error('8906..8936 全被占用'));
      const s = net.createServer();
      s.once('error', function () { p++; tryOne(); });
      s.once('listening', function () { s.close(function () { resolve(p); }); });
      s.listen(p, '127.0.0.1');
    })();
  });
}
async function waitServer(port, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true; } catch (e) { /* not up yet */ }
    await sleep(300);
  }
  return false;
}

/* 一个 seed：热启动 → 抓 SSE 到 done/error → 落产物 */
async function trainSeed(seed, port) {
  const out = join(ART, ARM + '-' + seed + '.bak');
  const sseLog = join(ART, ARM + '-' + seed + '.sse.log');
  copyFileSync(BASE, BUNDLE_MP);
  const startMeta = readMeta(BUNDLE_MP);
  const url = 'http://127.0.0.1:' + port + '/train?gens=' + GENS + '&n=' + NP + '&pop=' + POP +
    '&gpo=' + GPO + '&seed=' + seed + '&opps=' + POOL + (TRAIN_MODE ? '&mode=' + TRAIN_MODE : '') +
    (STYLE_OPPS ? '&styleopps=' + STYLE_OPPS : '') + (STYLE_W ? '&stylew=' + STYLE_W : '') +
    (STYLE_G ? '&stylegames=' + STYLE_G : '');
  /* 起点 = champion-5p-v1.3.58.bak 的**权重**（其 weightsId 见产物 meta 的 hotstartFrom：
     产出的 .bak 里 hotstartFrom 应恒为 e379c62ccd2648fa，这就是热启动谱系的校验点）。 */
  say('seed ' + seed + ' 开跑（起点 = v1.3.58 权重, meta seed=' + (startMeta && startMeta.seed) + '）: ' + url);
  const ac = new AbortController();
  const timer = setTimeout(function () { ac.abort(); }, SEED_TIMEOUT_MS);
  let sawDone = false, sawErr = null, lastGen = -1, carry = '';
  writeFileSync(sseLog, '');                     // 清空；下面**边收边追加**，跑中即可 tail
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const s = dec.decode(step.value, { stream: true });
      try { appendFileSync(sseLog, s); } catch (e) { /* ignore */ }
      /* 行缓冲：SSE 的一行可能被 TCP 分块切开；不带 carry 就会漏掉 done 事件
       * ⇒ 然后干等到 SEED_TIMEOUT_MS（15 分钟）。这是"等不到 done"最常见的原因。 */
      carry += s;
      const parts = carry.split('\n');
      carry = parts.pop();
      for (const l of parts) {
        if (l.indexOf('"type":"done"') >= 0) sawDone = true;
        if (l.indexOf('"type":"error"') >= 0) sawErr = l.trim();
        if (l.indexOf('"type":"gen"') >= 0) {              // 每 50 代报一次进度
          const g = /"gen":(\d+)/.exec(l), b = /"best":(-?[\d.]+)/.exec(l);
          if (g) {
            const gn = Number(g[1]);
            if (gn % 50 === 0 && gn !== lastGen) { lastGen = gn; say('seed ' + seed + ' 进度 gen ' + gn + '/' + GENS + '  best=' + (b ? b[1] : '?')); }
          }
        }
      }
      if (sawDone || sawErr) { ac.abort(); break; }
    }
  } catch (e) {
    if (!sawDone && !sawErr) sawErr = 'fetch/stream: ' + String((e && e.message) || e);
  }
  clearTimeout(timer);
  if (!sawDone) throw new Error('seed ' + seed + ' 没有 done 事件: ' + (sawErr || '未知（见 ' + sseLog + '）'));
  copyFileSync(BUNDLE_MP, out);
  const meta = readMeta(out) || {};
  say('seed ' + seed + ' DONE  自评=' + Number(meta.firstRate || 0).toFixed(4) +
    ' top2=' + Number(meta.top2Rate || 0).toFixed(4) + '  → ' + out);
  return meta;
}

/* 一次考卷：抓 [主体] 行的 1st / top2 */
async function evalArm(file, extra, games) {
  const args = ['tools/eval-5p.mjs', String(games || EGAMES), String(EN), String(ESEED), file].concat(extra || []);
  const r = await execFileP(process.execPath, args, { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  const out = String(r.stdout || '');
  for (const l of out.split(/\r?\n/)) {
    const m = /^\[[^\]]*\]\s*1st=([\d.]+)%.*top2=([\d.]+)%/.exec(l);
    if (m) return { first: Number(m[1]), top2: Number(m[2]), out: out };
  }
  throw new Error('解析不到读数: ' + file + ' ' + (extra || []).join(' ') + '\n' + out.slice(0, 800));
}

/* ab-analyze.mjs 的行格式：^  seed 臂 自评 1st=..% … top2=..% 1st=..%$（最后一个是第二考卷） */
function fmtLine(r) {
  return '  ' + String(r.seed).padStart(3) + '   ' + r.pool.padEnd(5) + '  ' + r.self.toFixed(4) +
    '  1st=' + r.stdFirst.toFixed(1) + '%  2nd=--  3rd=--  4th=--  5th=--  | top2=' + r.stdTop2.toFixed(1) +
    '% top3=--  1st=' + r.ringFirst.toFixed(1) + '%';
}

async function evalAll() {
  const rows = [];
  let elog = '# ring2 逐臂逐考卷读数（eval-5p.mjs ' + EGAMES + '/' + RGAMES + ' ' + EN + ' ' + ESEED + '）\n';
  elog += '# 控制臂 p12 = ms2-p12-<seed>.bak（12 对手）；实验臂 r17 = ring2-<seed>.bak（12 + ringspam）\n';
  for (const seed of ALL_SEEDS) {
    const arms = [
      { pool: LBL_C, file: join(ART, CTRL + '-' + seed + '.bak') },
      { pool: LBL_E, file: join(ART, ARM + '-' + seed + '.bak') }
    ];
    for (const arm of arms) {
      if (!existsSync(arm.file)) { say('缺文件，跳过: ' + arm.file); continue; }
      const meta = readMeta(arm.file) || {};
      let std = { first: 0, top2: 0, out: '' };
      if (ONLY !== 'ring') {
        std = await evalArm(arm.file, [], EGAMES);
        say('eval ' + arm.pool + ' seed ' + seed + ' 标准考卷: 1st=' + std.first + '%  top2=' + std.top2 + '%');
        appendFileSync(STDOUTLOG, '\n===== ' + arm.pool + ' seed ' + seed + ' 考卷1(3血标准) ' + arm.file + ' =====\n' + std.out);
      }
      let ring = { first: 0, out: '' };
      if (ONLY !== 'standard') {
        ring = await evalArm(arm.file, EXAM2, RGAMES);
        say('eval ' + arm.pool + ' seed ' + seed + ' 考卷2(' + EXAM2.join(' ') + ', ' + RGAMES + '局): 1st=' + ring.first + '%');
        appendFileSync(STDOUTLOG, '\n===== ' + arm.pool + ' seed ' + seed + ' 考卷2(' + EXAM2.join(' ') + ') ' + arm.file + ' =====\n' + ring.out);
      }
      rows.push({ seed: seed, pool: arm.pool, self: Number(meta.firstRate || 0), stdFirst: std.first, stdTop2: std.top2, ringFirst: ring.first });
      elog += arm.pool + ' seed ' + seed + '  考卷1 1st=' + std.first + '% top2=' + std.top2 +
        '%  | 考卷2(' + EXAM2.join(' ') + ') 1st=' + ring.first + '%  | 训练自评=' + Number(meta.firstRate || 0).toFixed(4) +
        '  (opps=' + ((meta.opps || '').split(',').length) + ' 个, mode=' + (meta.mode || 'multi(未记录)') + ')\n';
      writeFileSync(EVALLOG, elog, 'utf8');
    }
  }
  let out = '# seed-sweep｜池 = ' + POOL + '\n';
  out += '# 训练模式 = ' + (TRAIN_MODE || 'multi(默认/未传)') + '   臂：' + LBL_C + ' = ' + CTRL + '-<seed>.bak，' + LBL_E + ' = ' + ARM + '-<seed>.bak\n';
  out += '# 考卷1 = eval-5p.mjs ' + EGAMES + ' ' + EN + ' ' + ESEED + ' <文件>   （35 组合 × ' + EGAMES + ' 局 = ' + (35 * EGAMES) + ' 局）\n';
  out += '# 考卷2 = 同上 + ' + EXAM2.join(' ') + '   （' + RGAMES + ' 局）\n';
  out += '# 行格式（ab-analyze.mjs 解析）：seed 臂 训练自评 考卷1-1st=..% … top2=..% 考卷2-1st=..%\n';
  for (const r of rows) out += fmtLine(r) + '\n';
  writeFileSync(RUNLOG, out, 'utf8');
  say('已写 ' + RUNLOG + '（' + rows.length + ' 行）');
  try {
    const a = await execFileP(process.execPath, ['tools/ab-analyze.mjs', RUNLOG, LBL_C, LBL_E], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(ANALOG, String(a.stdout || ''), 'utf8');
    console.log(String(a.stdout || ''));
    say('已写 ' + ANALOG);
  } catch (e) {
    say('ab-analyze 失败: ' + String((e && e.stdout) || '') + String((e && e.stderr) || e));
  }
}

async function main() {
  const bakBundle = existsSync(BUNDLE_MP) ? readFileSync(BUNDLE_MP) : null;
  const bakIndex = existsSync(INDEX) ? readFileSync(INDEX) : null;
  let child = null;
  try {
    if (STAGE !== 'eval') {
      const port = await freePort(Number(process.env.RING2_PORT || 8906));
      say('启动训练服务 :' + port + '（日志 ' + SERVERLOG + '）');
      child = spawn(process.execPath, ['server/train-server.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', function (d) { try { appendFileSync(SERVERLOG, d); } catch (e) { /* */ } });
      child.stderr.on('data', function (d) { try { appendFileSync(SERVERLOG, d); } catch (e) { /* */ } });
      if (!await waitServer(port, 30000)) throw new Error('训练服务 30s 内没起来（见 ' + SERVERLOG + '）');
      say('训练服务就绪');
      for (const s of ALL_SEEDS) {
        const existing = join(ART, ARM + '-' + s + '.bak');
        if (existsSync(existing) && process.env.RING2_FORCE !== '1') { say('seed ' + s + ' 已有产物，跳过（RING2_FORCE=1 强制重跑）'); continue; }
        await trainSeed(s, port);
      }
      child.kill();
      child = null;
      await sleep(500);
    }
    if (STAGE !== 'train') await evalAll();
    say('全部完成');
  } finally {
    if (child) { try { child.kill(); } catch (e) { /* */ } }
    if (bakBundle) writeFileSync(BUNDLE_MP, bakBundle);
    if (bakIndex) writeFileSync(INDEX, bakIndex);
    say('已还原 js/bundled-champion-3p.js 与 index.html（训练会刷 ?v= 缓存戳）');
  }
}
main().catch(function (e) {
  say('!! 失败: ' + String((e && e.stack) || e));
  process.exitCode = 1;
});
