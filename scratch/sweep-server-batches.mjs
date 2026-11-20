#!/usr/bin/env node
/* sweep-server-batches.mjs —— server 系批级回放（era worktree × tools/ring2-run.mjs 官方回放器）
 * 用法：node scratch/sweep-server-batches.mjs <jobs.tsv> <shard> <totalShards>
 * jobs.tsv 列: batch<TAB>fam<TAB>era<TAB>arm<TAB>seeds<TAB>opps<TAB>mode<TAB>hot<TAB>ids<TAB>paths<TAB>targets
 *   （ids/paths/targets 逗号串与 seeds 一一对应）
 * 行为：逐批 —— era worktree 就位 → RING2_* env 跑 tools/ring2-run.mjs（STAGE=train）→
 *   产物 <wt>/docs/artifacts/<arm>-<seed>.bak wid 试金 → 命中拷主仓台账路径 + 翻账 + git add
 */
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';

const [jobsFile, shardArg, totalArg] = process.argv.slice(2);
const SHARD = Number(shardArg || 0), TOTAL = Number(totalArg || 1);
const ROOT = process.cwd();

const lines = readFileSync(jobsFile, 'utf8').split('\n').filter((l) => l.trim());
const head = lines[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const jobs = lines.slice(1).map((l) => {
  const c = l.split('\t');
  return { batch: c[ix.batch], fam: c[ix.fam], era: c[ix.era], arm: c[ix.arm], seeds: (c[ix.seeds] || '').split(','), opps: c[ix.opps], mode: c[ix.mode], hot: c[ix.hot], ids: (c[ix.ids] || '').split(','), paths: (c[ix.paths] || '').split(','), targets: (c[ix.targets] || '').split(',') };
}).filter((j) => j.era && j.batch);
const mine = jobs.filter((_, k) => k % TOTAL === SHARD);
console.log(`分片 ${SHARD}/${TOTAL}：${mine.length} 批`);

const hits = [];
function wtFor(era) {
  const wt = resolve(dirname(ROOT), 'srv-wt-s' + SHARD + '-' + era.slice(0, 8));
  if (!existsSync(wt)) {
    const add = spawnSync('git', ['worktree', 'add', '--detach', wt, era], { cwd: ROOT, encoding: 'utf8' });
    if (add.status !== 0) throw new Error('worktree 失败 ' + era + ': ' + (add.stderr || '').slice(0, 150));
  } else {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout || '';
    if (!String(head).trim().startsWith(era)) {
      spawnSync('git', ['checkout', '--detach', era], { cwd: wt, encoding: 'utf8' });
    }
  }
  /* runner 需要的目录与根包（BASE=champion-5p-v1.3.58 必须在 worktree 内） */
  mkdirSync(wt + '/docs/artifacts', { recursive: true });
  const basePack = resolve(ROOT, 'docs/artifacts/champion-5p-v1.3.58.bak');
  if (existsSync(basePack)) copyFileSync(basePack, wt + '/docs/artifacts/champion-5p-v1.3.58.bak');
  /* era runner 的 HOT 补丁：老版 runner（<09-20）不认 RING2_HOT ⇒ 把它按 BASE 的那一行
   * 改成"env 有 RING2_HOT 就拷 HOT"。只改驱动层，era server 与 js/* 一字不动。 */
  const runnerPath = wt + '/tools/ring2-run.mjs';
  if (existsSync(runnerPath)) {
    let rt = readFileSync(runnerPath, 'utf8');
    if (!rt.includes('RING2_HOT') && rt.includes('copyFileSync(BASE, STAGE_IN);')) {
      rt = rt.replace('copyFileSync(BASE, STAGE_IN);',
        'copyFileSync(process.env.RING2_HOT ? join(root, process.env.RING2_HOT) : BASE, STAGE_IN);  /* sweep 补丁：时代槽冠军热启动 */');
      writeFileSync(runnerPath, rt);
    }
  }
  return wt;
}

for (const j of mine) {
  let wt = '';
  try {
    wt = wtFor(j.era);
    /* RING2_HOT：时代槽冠军包拷进 worktree（相对路径，runner 与其校验器都按 wt 根解析） */
    let hot = '';
    if (j.hot && existsSync(j.hot)) {
      copyFileSync(j.hot, wt + '/docs/artifacts/hot.bak');
      hot = 'docs/artifacts/hot.bak';
    }
    /* RING2_HOT 缺省 = BASE（champion-5p-v1.3.58）——早期批正好；后期批传时代槽冠军 */
    const env = {
      ...process.env,
      RING2_STAGE: 'train',
      RING2_ARM: j.arm,
      RING2_SEEDS: j.seeds.filter(Boolean).join(','),
      RING2_POOL: j.opps || 'B',
      RING2_MODE: j.mode && j.mode !== '-' && j.mode !== 'multi' ? j.mode : '',
      RING2_HOT: hot,
      RING2_PORT: String(8906 + SHARD * 15),
    };
    console.log(`▶ ${j.batch}（era=${j.era} seeds=${j.seeds} arm=${j.arm} hot=${j.hot ? j.hot.split('/').pop() : 'BASE'} oppsN=${(j.opps || '').split(',').length}）`);
    const r = spawnSync(process.execPath, ['tools/ring2-run.mjs'], { cwd: wt, env, encoding: 'utf8', timeout: 60 * 60000, maxBuffer: 1 << 28 });
    if (r.status !== 0 || r.error) {
      console.log(`  runner exit=${r.status}${r.error ? ' err=' + String(r.error.message).slice(0, 80) : ''} stderr尾: ${String(r.stderr || '').slice(-260).replace(/\n/g, ' | ')}`);
    }
    /* 逐 seed wid 试金 */
    for (let k = 0; k < j.seeds.length; k++) {
      const seed = j.seeds[k], id = j.ids[k], ledger = j.paths[k], target = j.targets[k];
      if (!id || !target) continue;
      const prod = `${wt}/docs/artifacts/${j.arm}-${seed}.bak`;
      if (!existsSync(prod)) { console.log(`  ✗ ${id}: 产物未落（${j.arm}-${seed}.bak）`); continue; }
      const w = widOf(readFileSync(prod, 'utf8'));
      if (w === target) {
        mkdirSync(dirname(ledger), { recursive: true });
        copyFileSync(prod, ledger);
        hits.push({ id, ledger });
        console.log(`  ✅ ${id} wid=${w}`);
        const p = 'docs/ARTIFACT-LOSS-1119.tsv';
        const ls = readFileSync(p, 'utf8').split('\n');
        const si = ls[0].split('\t').indexOf('state');
        for (let i2 = 1; i2 < ls.length; i2++) {
          const c = ls[i2].split('\t');
          if (c.length && c[0] === id && c[si] === 'missing') { c[si] = 'ok'; ls[i2] = c.join('\t'); }
        }
        writeFileSync(p, ls.join('\n'));
        spawnSync('git', ['add', '-f', ledger], { encoding: 'utf8' });
        spawnSync('git', ['add', 'docs/ARTIFACT-LOSS-1119.tsv'], { encoding: 'utf8' });
      } else {
        console.log(`  ✗ ${id} wid=${w} ≠ ${target}`);
      }
    }
  } catch (e) {
    console.log(`⛔ ${j.batch}: ${String(e.message || e).slice(0, 170)}`);
  }
}
console.log(`\n==== 分片 ${SHARD} 完成：${hits.length} 命中 ====`);
console.log('HITS\t' + hits.map((h) => h.id).join(','));
