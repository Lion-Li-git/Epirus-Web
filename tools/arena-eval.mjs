#!/usr/bin/env node
/* arena-eval.mjs —— 多人 Plackett-Luce 联盟（Arena B 轴）标定、效度检验与全库并行评估工具
 * 用法：
 *   node tools/arena-eval.mjs --calibrate [--jobs=14]          # 标定 24 枚多样化锚点联盟 → champion-map/data/arena-league-1118.tsv
 *   node tools/arena-eval.mjs --validate [--jobs=14]           # 在 GLM 24 代表点上核验对 1v1/5席真值相关性
 *   node tools/arena-eval.mjs --all [--jobs=14] [--resume]     # 全库在册包并行评估 → champion-map/data/exam4n-arena-1118.tsv
 *   node tools/arena-eval.mjs --pack=<path> --id=<id>          # 测单枚新包（JSON / TSV 输出）
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { ROOT, sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';
import {
  LEAGUE_ANCHORS,
  HORIZONS,
  loadRegistryPaths,
  loadLeagueTable,
  loadAnchorChoosers,
  tableWinCredits,
  buildLeagueCalibrationSchedule,
  fitPlackettLuceLeague,
  evaluatePackArena,
} from './arena-lib.mjs';

if (isMainThread) {
  rejectUnknownFlags(process.argv.slice(2), ['calibrate', 'validate', 'all', 'resume', 'pack', 'id', 'jobs', 'seed', 'dose', 'eps-tier'], 'arena-eval');
}

const arg = (k, d) => {
  const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0);
  return a ? a.slice(('--' + k + '=').length) : d;
};
const hasFlag = (k) => process.argv.includes('--' + k);

/* ============ Worker 线程入口 ============ */
if (!isMainThread) {
  const W = sandbox(ROOT);
  const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
  const { taskType, league, seedBase, dose } = workerData;
  const anchorChoosers = loadAnchorChoosers(W, league, ROOT, dose);

  parentPort.on('message', (msg) => {
    if (msg.stop) process.exit(0);
    try {
      if (taskType === 'calibrate') {
        const out = [];
        for (const job of msg.jobs) {
          const choosers = job.seats.map((ai) => anchorChoosers[ai]);
          const st = S.createState(job.mode, { next: mulberry32(job.gseed) }, job.n);
          st.slotSalt = job.gseed >>> 0;
          Play.autoGameN(st, choosers);
          const credits = tableWinCredits(T, st, job.n, job.gseed);
          out.push({ mode: job.mode, n: job.n, seats: job.seats, credits });
        }
        parentPort.postMessage({ ok: true, id: msg.id, records: out });
      } else {
        const resList = [];
        for (const item of msg.items) {
          const p = loadChamp(W, item.path, ROOT);
          if (!p) { resList.push({ id: item.id, err: 'loadChamp 失败' }); continue; }
          const ev = evaluatePackArena(W, p, item.id, anchorChoosers, league, { seedBase, dose });
          resList.push(ev);
        }
        parentPort.postMessage({ ok: true, id: msg.id, results: resList });
      }
    } catch (e) {
      parentPort.postMessage({ ok: false, id: msg.id, err: String(e && e.message || e) });
    }
  });
}

/* ============ 主线程工具函数 ============ */
function runWorkers(taskType, league, seedBase, jobsNum, items, batchSize, onBatch, dose) {
  const scriptPath = fileURLToPath(import.meta.url);
  const nWorkers = Math.max(1, Math.min(jobsNum, items.length || 1));
  return new Promise((resolveAll, rejectAll) => {
    const workers = [];
    let cursor = 0, inflight = 0, finished = false;
    const nextBatch = () => {
      if (cursor >= items.length) return null;
      const slice = items.slice(cursor, cursor + batchSize);
      const id = cursor;
      cursor += batchSize;
      return { id, slice };
    };
    const cleanup = () => { for (const w of workers) try { w.postMessage({ stop: true }); w.terminate(); } catch {} };
    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(scriptPath, { workerData: { taskType, league, seedBase, dose } });
      workers.push(w);
      const assign = () => {
        if (finished) return;
        const b = nextBatch();
        if (!b) {
          if (inflight === 0 && !finished) { finished = true; cleanup(); resolveAll(); }
          return;
        }
        inflight++;
        if (taskType === 'calibrate') w.postMessage({ id: b.id, jobs: b.slice });
        else w.postMessage({ id: b.id, items: b.slice });
      };
      w.on('message', (m) => {
        inflight--;
        if (!m.ok) { finished = true; cleanup(); rejectAll(new Error(m.err)); return; }
        onBatch(m);
        assign();
      });
      w.on('error', (err) => { if (!finished) { finished = true; cleanup(); rejectAll(err); } });
      assign();
    }
  });
}

function spearman(a, b) {
  const rank = (arr) => {
    const idxs = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(arr.length);
    let i = 0;
    while (i < idxs.length) {
      let j = i;
      while (j + 1 < idxs.length && idxs[j + 1][0] === idxs[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idxs[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/* ============ 主流程 ============ */
if (isMainThread) {
  const JOBS = Math.max(1, Number(arg('jobs', Math.min(14, Math.max(2, cpus().length - 2)))) || 4);
  const SEED = Number(arg('seed', 82200)) || 82200;
  /* --dose=exam（缺省，ε=0 考卷口径）| page（页面剂量：DIFF_TIERS 那档 + 前 3 回合斜坡）
   *   page 模式单独一套联盟标定与读数文件，**不许与 exam 混表**（同尺 = 同文件，§E597）。 */
  const DOSE = String(arg('dose', 'exam'));
  if (DOSE !== 'exam' && DOSE !== 'page') { console.error('⛔ --dose 只认 exam/page，收到 ' + DOSE); process.exit(2); }
  const EPS_TIER = String(arg('eps-tier', 'lv:regular'));
  const DOSE_OBJ = DOSE === 'page' ? { tierId: EPS_TIER } : null;
  const DOSE_SUF = DOSE === 'page' ? '-page' : '';
  const LEAGUE_FILE = join(ROOT, 'champion-map/data/arena-league-1118' + DOSE_SUF + '.tsv');
  const OUT_ALL = join(ROOT, 'champion-map/data/exam4n-arena' + DOSE_SUF + '-1118.tsv');
  /* §E597：exam 与 page 两套口径不许混表 ⇒ 条件留痕也跟着分档（同一个 DOSE_SUF 后缀）。
   * 为什么要有这张账：`--pack` 那条路只把读数打到 stdout，而读数赖以成立的 seedBase/dose/联盟表**没有产物级留痕**
   * ⇒ 同一枚包换个 --seed 再跑，输出行分不出是哪档条件跑出来的（#75 剩下的那一处）。 */
  const CONDS = join(ROOT, 'champion-map/data/arenaB-conditions-1118' + DOSE_SUF + '.tsv');
  const t0 = Date.now();
  const regMap = loadRegistryPaths(ROOT);

  if (hasFlag('calibrate')) {
    const anchors = LEAGUE_ANCHORS.map((a, idx) => {
      const info = regMap.get(a.id);
      if (!info || !existsSync(join(ROOT, info.path))) throw new Error('联盟锚缺文件：' + a.id);
      return { idx, id: a.id, path: info.path, era: a.era, role: a.role };
    });
    const calJobs = [];
    for (const { mode } of HORIZONS) {
      const sched = buildLeagueCalibrationSchedule(anchors.length, SEED + (mode === 'long' ? 500000 : 0));
      for (const g of sched) calJobs.push({ mode, n: g.n, seats: g.seats, gseed: g.gseed });
    }
    console.log('=== Arena 联盟标定：' + anchors.length + ' 锚点 × ' + calJobs.length + ' 局（' + JOBS + ' 线程）===');
    const allRecs = [];
    await runWorkers('calibrate', anchors, SEED, JOBS, calJobs, 40, (m) => {
      for (const r of m.records) allRecs.push(r);
    }, DOSE_OBJ);
    const shortRecs = allRecs.filter((r) => r.mode === 'multi');
    const longRecs = allRecs.filter((r) => r.mode === 'long');
    const rShort = fitPlackettLuceLeague(shortRecs, anchors.length, 0.05, 250);
    const rLong = fitPlackettLuceLeague(longRecs, anchors.length, 0.05, 250);
    const rAll = fitPlackettLuceLeague(allRecs, anchors.length, 0.05, 250);
    const lines = [['idx', 'pack_id', 'path', 'era', 'role', 'r_short', 'r_long', 'r_all'].join('\t')];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      lines.push([i, a.id, a.path, a.era, a.role, rShort[i].toFixed(4), rLong[i].toFixed(4), rAll[i].toFixed(4)].join('\t'));
    }
    writeFileSync(LEAGUE_FILE, lines.join('\n') + '\n', 'utf8');
    console.log('✅ 已标定写入 ' + LEAGUE_FILE + '（' + ((Date.now() - t0) / 1000).toFixed(1) + 's）');
    console.log('   corr(r_short, r_long) = ' + spearman(rShort, rLong).toFixed(4));
    const ranked = anchors.map((a, i) => ({ id: a.id, role: a.role, rAll: rAll[i], rS: rShort[i], rL: rLong[i] }))
      .sort((a, b) => b.rAll - a.rAll);
    for (const x of ranked) console.log('   ' + x.id.padEnd(28) + ' all=' + x.rAll.toFixed(3).padStart(7) + ' S=' + x.rS.toFixed(3).padStart(7) + ' L=' + x.rL.toFixed(3).padStart(7) + '  [' + x.role + ']');
  }

  if (hasFlag('validate')) {
    const league = loadLeagueTable(LEAGUE_FILE);
    const VAL_IDS = [
      'T8-s114', 'Q-s47', 'v7blk1-92', 'WSEL9-200', 'v7wall-33', 'v7blk1-93',
      'MSB11-R1S130778313', 'MSB11-R2S306293884', 'MSB13-R1S791820660', 'MSB14-railgun-R1S175656469', 'MSB15R-HITMIX', 'MSB15-LASER-R3',
      'DEF-s13', 'DEF-s16', 'OBS6E9', 'OBS6P4-S4000', 'OBS6-LH6P', 'OBS6-SHAPEDIST-V3S2',
      'EQ-S4-E9', 'EQ-S4-GD6ATEACH', 'MX1-GD-EQ', 'MX3-GDEQ-GD', 'MX5-GD-LE40', 'MX8-TN25-KL',
    ];
    const items = VAL_IDS.map((id) => ({ id, path: regMap.get(id).path }));
    const resMap = new Map();
    await runWorkers('eval', league, SEED, JOBS, items, 2, (m) => {
      for (const r of m.results) resMap.set(r.id, r);
    }, DOSE_OBJ);
    /* 读 GLM 1v1 RR 与 5 席桌战真值 */
    const rrSum = {}, rrCnt = {};
    for (const l of readFileSync(join(ROOT, 'docs/artifacts/zcode-1113-deps/bp-validity-1118-rr.tsv'), 'utf8').trim().split('\n')) {
      const [a, b, wr] = l.split('\t');
      if (!b || b === 'Q1' || b === 'Q2') continue;
      const w = Number(wr);
      rrSum[a] = (rrSum[a] || 0) + w; rrCnt[a] = (rrCnt[a] || 0) + 1;
      rrSum[b] = (rrSum[b] || 0) + (1 - w); rrCnt[b] = (rrCnt[b] || 0) + 1;
    }
    const tbSum = {}, tbCnt = {};
    for (const l of readFileSync(join(ROOT, 'docs/artifacts/zcode-1113-deps/bp-table-truth-1118.tsv'), 'utf8').trim().split('\n')) {
      const [id, , , wr] = l.split('\t');
      tbSum[id] = (tbSum[id] || 0) + Number(wr); tbCnt[id] = (tbCnt[id] || 0) + 1;
    }
    const dispLines = readFileSync(join(ROOT, 'champion-map/data/display.tsv'), 'utf8').trim().split('\n');
    const dh = dispLines[0].split('\t'), dix = Object.fromEntries(dh.map((c, i) => [c, i]));
    const bpMMap = new Map(), aLongMap = new Map();
    for (const l of dispLines.slice(1)) {
      const c = l.split('\t');
      bpMMap.set(c[dix.id], Number(c[dix.bpM]));
      aLongMap.set(c[dix.id], 0.15 * c[dix.P2L] + 0.25 * c[dix.P3L] + 0.45 * c[dix.P5L] + 0.15 * c[dix.P8L]);
    }
    const ids = VAL_IDS.filter((id) => resMap.has(id) && rrCnt[id] && tbCnt[id]);
    const rrV = ids.map((id) => rrSum[id] / rrCnt[id]);
    const tbV = ids.map((id) => tbSum[id] / tbCnt[id]);
    const arS = ids.map((id) => resMap.get(id).short.x4);
    const arL = ids.map((id) => resMap.get(id).long.x4);
    const arR = ids.map((id) => resMap.get(id).rAll);
    const bpV = ids.map((id) => bpMMap.get(id));
    const aLV = ids.map((id) => aLongMap.get(id));
    console.log('\n=== Arena 效度核验 (n=' + ids.length + ' 跨代真值集) ===');
    console.log('corr(Arena rAll,  1v1 RR真值)   = ' + spearman(arR, rrV).toFixed(4) + '  (vs bpM=' + spearman(bpV, rrV).toFixed(4) + ')');
    console.log('corr(Arena rAll,  5席桌战真值)  = ' + spearman(arR, tbV).toFixed(4) + '  (vs bpM=' + spearman(bpV, tbV).toFixed(4) + ')');
    console.log('corr(Arena short, 5席桌战真值)  = ' + spearman(arS, tbV).toFixed(4) + '  (vs RR=' + spearman(arS, rrV).toFixed(4) + ')');
    console.log('corr(Arena long,  5席桌战真值)  = ' + spearman(arL, tbV).toFixed(4) + '  (vs RR=' + spearman(arL, rrV).toFixed(4) + ')');
    console.log('corr(Arena short, Arena long)   = ' + spearman(arS, arL).toFixed(4));
    console.log('corr(Arena rAll,  A_long)       = ' + spearman(arR, aLV).toFixed(4));
  }

  if (hasFlag('all')) {
    const league = loadLeagueTable(LEAGUE_FILE);
    const allItems = [];
    for (const [id, info] of regMap) {
      if (info.status !== 'archived' && existsSync(join(ROOT, info.path))) allItems.push({ id, path: info.path });
    }
    const doneSet = new Set();
    const RESUME = hasFlag('resume') && existsSync(OUT_ALL);
    const HEADER = ['pack_id', 'x2s', 'x3s', 'x5s', 'x8s', 'arS', 'x2l', 'x3l', 'x5l', 'x8l', 'arL', 'arR', 'rShort', 'rLong'].join('\t');
    if (RESUME) {
      for (const l of readFileSync(OUT_ALL, 'utf8').trim().split('\n').slice(1)) {
        const id = l.split('\t')[0];
        if (id) doneSet.add(id);
      }
    } else {
      writeFileSync(OUT_ALL, HEADER + '\n', 'utf8');
    }
    const todo = allItems.filter((x) => !doneSet.has(x.id));
    console.log('\n=== 全库 Arena 并行评估：' + todo.length + '/' + allItems.length + ' 包（' + JOBS + ' 线程）===');
    let done = 0, fail = 0;
    await runWorkers('eval', league, SEED, JOBS, todo, 8, (m) => {
      const rows = [];
      for (const r of m.results) {
        if (r.err) { fail++; console.error('⛔ ' + r.id + ': ' + r.err); continue; }
        rows.push([
          r.id,
          r.short.cells[2].x.toFixed(4), r.short.cells[3].x.toFixed(4), r.short.cells[5].x.toFixed(4), r.short.cells[8].x.toFixed(4), r.short.x4.toFixed(4),
          r.long.cells[2].x.toFixed(4), r.long.cells[3].x.toFixed(4), r.long.cells[5].x.toFixed(4), r.long.cells[8].x.toFixed(4), r.long.x4.toFixed(4),
          r.rAll.toFixed(4), r.short.r.toFixed(4), r.long.r.toFixed(4),
        ].join('\t'));
      }
      if (rows.length) appendFileSync(OUT_ALL, rows.join('\n') + '\n', 'utf8');
      done += m.results.length;
      if (done % 120 === 0 || done === todo.length) {
        console.log('… ' + done + '/' + todo.length + '（fail=' + fail + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's）');
      }
    }, DOSE_OBJ);
    console.log('✅ 全库 Arena 评估完成 ⇒ ' + OUT_ALL + '（总耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's，fail=' + fail + '）');
  }

  if (arg('pack', '')) {
    const packPath = arg('pack', '');
    const id = arg('id', 'PACK');
    const league = loadLeagueTable(LEAGUE_FILE);
    const W = sandbox(ROOT);
    const p = loadChamp(W, packPath, ROOT);
    if (!p) { console.error('⛔ 载入失败：' + packPath); process.exit(2); }
    const anchorChoosers = loadAnchorChoosers(W, league, ROOT, DOSE_OBJ);
    const r = evaluatePackArena(W, p, id, anchorChoosers, league, { seedBase: SEED, dose: DOSE_OBJ });
    console.log(JSON.stringify(r));
    /* 条件留痕：写完必须读回对账（写坏/写漏都直接 exit 3，不静默）——这是"表不许落后于件"的同一形状。 */
    const packSha = createHash('sha256').update(readFileSync(packPath)).digest('hex').slice(0, 16);
    const CHDR = ['at', 'id', 'pack', 'packSha256_16', 'seedBase', 'dose', 'leagueTable', 'shortR', 'shortX4'];
    const row = [new Date().toISOString(), id, packPath.replace(/\\/g, '/'), packSha, String(SEED), DOSE,
      LEAGUE_FILE.replace(/\\/g, '/').split('/').slice(-2).join('/'), String(r.short.r.toFixed(6)), String(r.short.x4.toFixed(6))].join('\t');
    if (!existsSync(CONDS)) {
      try { writeFileSync(CONDS, CHDR.join('\t') + '\n', { encoding: 'utf8', flag: 'wx' }); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    appendFileSync(CONDS, row + '\n', 'utf8');
    const back = readFileSync(CONDS, 'utf8').trim().split('\n');
    if (!back.includes(row)) {
      console.error('⛔ 条件留痕读回找不到本行（id=' + id + ' seedBase=' + SEED + ' sha=' + packSha + '）⇒ exit 3');
      process.exit(3);
    }
    /* 保持 --pack stdout 末行始终是纯 JSON（measure-point.mjs:163 等调用方走 stdout.split('\n').pop() 解析），
     *   条件留痕回执打到 stderr，避免破坏机器可读出口。 */
    console.error('✅ 条件留痕 ' + CONDS.replace(/\\/g, '/').split('/').slice(-1)[0] + '（' + (back.length - 1) + ' 行，本行 seedBase=' + SEED + ' dose=' + DOSE + '）');
  }
}
