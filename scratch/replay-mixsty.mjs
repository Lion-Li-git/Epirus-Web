#!/usr/bin/env node
/* replay-mixsty.mjs —— mix/sty 两批专用回放（dsh 0add3d39 v4 会话原文配方，2026-11-21 夜）
 * 配方钉死：
 *   mix = A12 对手 + champ:×4 座位（v1.3.58/hA9/armB12f/armA9），era 8a018817（v1.5.2 champ: 池支持；
 *         批跑 09-12 22:23-22:32 +0800（lineage ts 为 UTC），提交 22:36）
 *   sty = A12 对手 + styleopps=champ:×3&stylew=0.5&stylegames=2（armA9 留出场，META 实证），
 *         era f872ee6c（v1.5.3 复合适应度；批跑 22:49-22:54 +0800，提交 22:58）
 * 流程照抄时代 ring2-run 的 trainSeed：每 seed 重铺 BASE→槽 js/bundled-champion-3p.js →
 *   /train?gens=250&n=5&pop=16&gpo=8&seed=S&opps=... → SSE done → 槽拷出 → wid 试金 → 落账翻 ledger。
 * 用法：node scratch/replay-mixsty.mjs <mix|sty>
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';

const ARM = process.argv[2];
if (ARM !== 'mix' && ARM !== 'sty') { console.error('用法: node scratch/replay-mixsty.mjs <mix|sty>'); process.exit(2); }
const ROOT = process.cwd();
const PORT = ARM === 'mix' ? 8811 : 8812;
const WT_BASE = resolve(dirname(ROOT), 'srv-replay-mixsty');
const BASE = resolve(ROOT, 'docs/artifacts/champion-5p-v1.3.58.bak');
const A12 = 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver';
const SEATS = ['champ:docs/artifacts/champion-5p-v1.3.58.bak', 'champ:docs/artifacts/champion-5p-hA9.bak', 'champ:docs/artifacts/champion-5p-armB12f.bak', 'champ:docs/artifacts/champion-5p-armA9.bak'];
const SEAT_FILES = SEATS.map((s) => s.slice(6));
const CFG = {
  mix: { eras: ['8a018817', 'f872ee6c', '7a4cd0ef'], opps: A12 + ',' + SEATS.join(','), extra: '' },
  sty: { eras: ['f872ee6c', '8a018817'], opps: A12, extra: '&styleopps=' + SEATS.slice(0, 3).join(',') + '&stylew=0.5&stylegames=2' },
};
const TARGETS = {
  mix: { 31: 'b105c7dd8bf03134', 32: '3fe42380da06f33f', 33: '9896dfe0c8b68437', 34: '4515673911ce9c52', 35: '9f7b2614aa49b8bc', 36: '7b75ed07b2861d9f' },
  sty: { 31: '4e271df370449f94', 32: 'bd7a6acaa16a0654', 33: 'cbf8c3e33cfab640', 34: 'b1349956c644ecd7', 35: '353a1b940e7e67a0', 36: '002bf83eef70c90d' },
};
const SEEDS = [31, 32, 33, 34, 35, 36];
const LEDGER = 'docs/ARTIFACT-LOSS-1119.tsv';

/* 台账状态（已 ok 的 seed 跳过） */
const ST = {};
readFileSync(LEDGER, 'utf8').split('\n').slice(1).forEach((l) => {
  const c = l.split('\t');
  if (c.length >= 4) ST[c[0]] = c[2];
});
const todo = SEEDS.filter((s) => ST[`${ARM}-${s}`] !== 'ok');
console.log(`[${ARM}] 待复刻 seed: ${todo.join(',') || '（全部已在账）'}`);

function flipLedger(id, path) {
  const ls = readFileSync(LEDGER, 'utf8').split('\n');
  const si = ls[0].split('\t').indexOf('state');
  for (let i = 1; i < ls.length; i++) {
    const c = ls[i].split('\t');
    if (c.length && c[0] === id && c[si] === 'missing') { c[si] = 'ok'; ls[i] = c.join('\t'); }
  }
  writeFileSync(LEDGER, ls.join('\n'));
  spawnSync('git', ['add', '-f', path], { encoding: 'utf8' });
  spawnSync('git', ['add', LEDGER], { encoding: 'utf8' });
}

function ensureWt(era) {
  const wt = WT_BASE + '-' + era.slice(0, 8);
  if (!existsSync(wt)) {
    const add = spawnSync('git', ['worktree', 'add', '--detach', wt, era], { cwd: ROOT, encoding: 'utf8' });
    if (add.status !== 0) throw new Error('worktree 失败 ' + era + ': ' + (add.stderr || '').slice(0, 150));
  } else {
    const h = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout || '';
    if (!String(h).trim().startsWith(era)) spawnSync('git', ['checkout', '--detach', era], { cwd: wt, encoding: 'utf8' });
  }
  mkdirSync(wt + '/docs/artifacts', { recursive: true });
  /* 座位包 4 件 + 根包进 worktree（champ: 走仓库相对路径） */
  for (const f of SEAT_FILES) { const src = resolve(ROOT, f); if (existsSync(src)) copyFileSync(src, wt + '/' + f); }
  copyFileSync(BASE, wt + '/js/bundled-champion-3p.js');
  return wt;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runEra(era, seeds) {
  const wt = ensureWt(era);
  const srv = spawn(process.execPath, ['server/train-server.mjs', String(PORT)], { cwd: wt, stdio: ['ignore', 'pipe', 'pipe'] });
  let srvLog = '';
  srv.stdout.on('data', (d) => { srvLog += d.toString(); if (srvLog.length > 8000) srvLog = srvLog.slice(-4000); });
  srv.stderr.on('data', (d) => { srvLog += d.toString(); });
  try {
    let up = false;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch('http://127.0.0.1:' + PORT + '/'); if (r.ok) { up = true; break; } } catch (e) { }
      await sleep(500);
    }
    if (!up) throw new Error('server 起不来 @' + era + ': ' + srvLog.slice(-200));
    const hits = [];
    for (const seed of seeds) {
      const id = `${ARM}-${seed}`;
      /* 时代 runner trainSeed 原样：每 seed 重铺 BASE→槽（会话原文每 seed 开跑行都是「起点 = v1.3.58 权重」；
       * 不铺则从上一 seed 产物链式热启动，sty-32 起全偏——11-21 夜实测教训） */
      copyFileSync(BASE, `${wt}/js/bundled-champion-3p.js`);
      const params = `gens=250&n=5&pop=16&gpo=8&seed=${seed}&opps=${CFG[ARM].opps}${CFG[ARM].extra}`;
      const t0 = Date.now();
      const r = await fetch(`http://127.0.0.1:${PORT}/train?${params}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '', doneEv = null, errEv = null;
      const deadline = Date.now() + 40 * 60000;
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, k); buf = buf.slice(k + 1);
          if (line.indexOf('"type":"done"') >= 0) { try { doneEv = JSON.parse(/^data: (.*)$/m.exec(line)[1]); } catch (e) { } }
          if (line.indexOf('"type":"error"') >= 0) errEv = line.slice(0, 200);
        }
        if (doneEv || errEv) break;
      }
      if (!doneEv) throw new Error(`${id} 无 done @${era}: ${errEv || '超时'}`);
      const slot = `${wt}/js/bundled-champion-3p.js`;
      const w = widOf(readFileSync(slot, 'utf8'));
      const target = TARGETS[ARM][seed];
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      const hot = /"hotstartFrom":"([0-9a-f]+)"/.exec(readFileSync(slot, 'utf8'));
      console.log(`  ${w === target ? '✅' : '✗'} ${id} @${era} ${mins}min wid=${w} hotstartFrom=${hot ? hot[1].slice(0, 8) : '?'}${w === target ? '' : ' ≠ ' + target} (1st=${doneEv.firstRate} top2=${doneEv.top2Rate})`);
      if (w === target) {
        const ledger = `docs/artifacts/${ARM}-${seed}.bak`;
        copyFileSync(slot, resolve(ROOT, ledger));
        flipLedger(id, ledger);
        hits.push(id);
      }
    }
    return hits;
  } finally {
    try { srv.kill('SIGKILL'); } catch (e) { }
    if (srv.pid) spawnSync('taskkill', ['/PID', String(srv.pid), '/T', '/F'], { stdio: 'ignore' });
  }
}

const hits = [];
for (const era of CFG[ARM].eras) {
  console.log(`[${ARM}] era 候选 ${era}，seeds=${todo.join(',')}`);
  try {
    const h = await runEra(era, todo);
    if (h.length > 0) { hits.push(...h); break; }
    console.log(`  ↻ era ${era} 全 miss ⇒ 换下一候选`);
  } catch (e) {
    console.log(`⛔ [${ARM}] era ${era}: ${String(e.message || e).slice(0, 200)}`);
  }
}
console.log(`\n==== ${ARM} 完成：${hits.length}/${todo.length} 命中 ====`);
console.log('HITS\t' + (hits.join(',') || '(无)'));
