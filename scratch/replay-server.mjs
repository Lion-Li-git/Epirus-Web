#!/usr/bin/env node
/* replay-server.mjs —— server 时代单批回放器（era 整树 + train-server.mjs HTTP 驱动 + SSE done 捕获）
 * 用法：node scratch/replay-server.mjs <jobs.tsv> <shard> <totalShards> [port]
 * jobs.tsv 列: era<TAB>id<TAB>seed<TAB>opps<TAB>gens<TAB>pop<TAB>games<TAB>mode<TAB>ledgerPath<TAB>widTarget
 * 行为：本分片逐 job —— era worktree 就位 → 起 server → GET /train?... → SSE done → 读槽文件 → wid 试金 → 命中落账
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { widOf, widOfArr } from '../champion-map/pack-id.mjs';

const [jobsFile, shardArg, totalArg, portArg] = process.argv.slice(2);
const SHARD = Number(shardArg || 0), TOTAL = Number(totalArg || 1), PORT = Number(portArg || 8801) + SHARD;
const ROOT = process.cwd();
const WT = resolve(dirname(ROOT), 'srv-replay-shard' + SHARD);

const lines = readFileSync(jobsFile, 'utf8').split('\n').filter((l) => l.trim());
const head = lines[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const jobs = lines.slice(1).map((l) => {
  const c = l.split('\t');
  return { era: c[ix.era], id: c[ix.id], seed: c[ix.seed], opps: c[ix.opps], gens: c[ix.gens], pop: c[ix.pop], games: c[ix.games], mode: c[ix.mode], ledger: c[ix.ledgerPath], target: c[ix.widTarget], root: ix.root !== undefined ? c[ix.root] : '' };
}).filter((j) => j.era && j.id);

/* 本分片的任务子集（按行号取模），同 era 连跑 */
const mine = jobs.filter((_, k) => k % TOTAL === SHARD);
console.log(`分片 ${SHARD}/${TOTAL}：${mine.length} 个任务，端口 ${PORT}`);
const hits = [];

function ensureWorktree(era) {
  const lst = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const blocks = String(lst.stdout || '').split('\n\n');
  for (const b of blocks) {
    const lines = b.split('\n');
    const p = (lines.find((l) => l.startsWith('worktree ')) || '').slice(9);
    const head = (lines.find((l) => l.startsWith('HEAD ')) || '').slice(5);
    if (p && head && head.startsWith(era)) return p;
  }
  /* 目录已存在（脱离登记或残留）→ 直接复用 */
  if (existsSync(WT)) {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WT, encoding: 'utf8' }).stdout || '';
    if (String(head).trim().startsWith(era)) return WT;
  }
  const add = spawnSync('git', ['worktree', 'add', '--detach', WT, era], { cwd: ROOT, encoding: 'utf8' });
  if (add.status !== 0) throw new Error('worktree 建立失败: ' + (add.stderr || add.stdout || '').slice(0, 200));
  return WT;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function replayOne(j) {
  const wt = ensureWorktree(j.era);
  /* 热启动根覆写：原工作流每次跑前 cp 根包 → js/bundled-champion-3p.js（def-31 META hotstartFrom 实证）。
   * rootPack 缺省 = era 树自己的槽（老树恰好对得上时才允许）。 */
  if (j.root && existsSync(j.root)) {
    copyFileSync(j.root, `${wt}/js/bundled-champion-3p.js`);
    console.log(`  根已覆写 → 槽 wid=${widOf(readFileSync(`${wt}/js/bundled-champion-3p.js`, 'utf8'))}`);
  } else if (j.root && !existsSync(j.root)) {
    throw new Error('根包不在盘: ' + j.root);
  }
  if (!existsSync(`${wt}/js/bundled-champion-3p.js`)) throw new Error('era 树无槽冠军 ' + j.era);
  const srv = spawn(process.execPath, ['server/train-server.mjs', String(PORT)], { cwd: wt, stdio: ['ignore', 'pipe', 'pipe'] });
  let srvLog = '';
  srv.stdout.on('data', (d) => { srvLog += d.toString(); if (srvLog.length > 8000) srvLog = srvLog.slice(-4000); });
  srv.stderr.on('data', (d) => { srvLog += d.toString(); });
  try {
    /* 等 HTTP 就绪 */
    let up = false;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/champion`); if (r.ok) { up = true; break; } } catch (e) { }
      await sleep(500);
    }
    if (!up) throw new Error('server 起不来: ' + srvLog.slice(-200));
    /* 发起训练并消费 SSE 到 done */
    const params = new URLSearchParams({
      gens: j.gens || '250', n: '5', pop: j.pop || '16', gpo: j.games || '8',
      seed: j.seed, opps: j.opps || '', mode: j.mode && j.mode !== '-' ? j.mode : '',
    });
    const url = `http://127.0.0.1:${PORT}/train?${params.toString()}`;
    const t0 = Date.now();
    const r = await fetch(url);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', doneEv = null, startEv = null;
    const deadline = Date.now() + 40 * 60000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, k); buf = buf.slice(k + 2);
        const m = /^data: (.*)$/m.exec(chunk);
        if (!m) continue;
        let ev; try { ev = JSON.parse(m[1]); } catch (e) { continue; }
        if (ev.type === 'start') startEv = ev;
        if (ev.type === 'done') { doneEv = ev; break; }
        if (ev.type === 'error') throw new Error('server error: ' + (ev.msg || '').slice(0, 160));
      }
      if (doneEv) break;
    }
    if (!doneEv) throw new Error('SSE 无 done（超时 40min）');
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    /* 产物直接取 done 事件的 champ 对象（避开槽文件歧义）；wid = 其 a 数组 */
    let w = null;
    if (doneEv.champ && Array.isArray(doneEv.champ.a)) w = widOfArr(doneEv.champ.a);
    if (!w) { const slotTxt = readFileSync(`${wt}/js/bundled-champion-3p.js`, 'utf8'); w = widOf(slotTxt); }
    console.log(`  诊断: workers=${startEv && startEv.workers} 1st=${doneEv.firstRate} top2=${doneEv.top2Rate} secs=${doneEv.secs}`);
    const hit = w === j.target;
    console.log(`${hit ? '✅' : '✗'} ${j.id} seed=${j.seed} ${mins}min wid=${w}${hit ? '' : ' ≠ ' + j.target}`);
    if (hit) {
      mkdirSync(dirname(j.ledger), { recursive: true });
      copyFileSync(`${wt}/js/bundled-champion-3p.js`, j.ledger);
      hits.push(j);
      /* 台账翻 + git add */
      const p = 'docs/ARTIFACT-LOSS-1119.tsv';
      const lines2 = readFileSync(p, 'utf8').split('\n');
      const si = lines2[0].split('\t').indexOf('state');
      let n = 0;
      for (let i2 = 1; i2 < lines2.length; i2++) {
        const c = lines2[i2].split('\t');
        if (c.length && c[0] === j.id && c[si] === 'missing') { c[si] = 'ok'; lines2[i2] = c.join('\t'); n++; }
      }
      writeFileSync(p, lines2.join('\n'));
      spawnSync('git', ['add', '-f', j.ledger], { encoding: 'utf8' });
      spawnSync('git', ['add', 'docs/ARTIFACT-LOSS-1119.tsv'], { encoding: 'utf8' });
    }
    return hit;
  } finally {
    try { srv.kill('SIGKILL'); } catch (e) { }
    if (process.platform === 'win32' && srv.pid) spawnSync('taskkill', ['/PID', String(srv.pid), '/T', '/F'], { stdio: 'ignore' });
  }
}

for (const j of mine) {
  try { await replayOne(j); } catch (e) { console.log(`⛔ ${j.id}: ${String(e.message || e).slice(0, 180)}`); }
}
console.log(`\n==== 分片 ${SHARD} 完成：${hits.length}/${mine.length} 命中 ====`);
console.log('HITS\t' + hits.map((h) => h.id).join(','));
