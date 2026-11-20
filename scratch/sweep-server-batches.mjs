#!/usr/bin/env node
/* sweep-server-batches.mjs —— server 系批级回放（era worktree × tools/ring2-run.mjs 官方回放器）
 * 用法：node scratch/sweep-server-batches.mjs <jobs.tsv> <shard> <totalShards>
 * jobs.tsv 列: batch<TAB>fam<TAB>era(逗号分候选)<TAB>arm<TAB>seeds<TAB>opps<TAB>mode<TAB>hot<TAB>ids<TAB>paths<TAB>targets
 * 经验内建：
 *  - era 候选逐个试（批 0 命中 → 换下一候选 + RING2_FORCE=1）——server 夜批跑在未提交树上，
 *    era=首个含批时特征的提交（def-31=e227d222 / v9=16b3854e 实证），closest-before/after 都只是候选
 *  - EPIRUS_ALLOW_HEALTH_FAIL=1（透明；health gate 拦落盘是"产物未落"的主因之一）
 *  - 热启动根 = RING2_HOT（时代槽冠军）或缺省 BASE（champion-5p-v1.3.58——lineage 584 枚 parent=SLOT-e379c62c 的本尊）
 *  - era runner 双形态 HOT 补丁（STAGE_IN 隔离版 / BUNDLE_MP 直槽版），只改驱动层
 *  - RING2_PORT 按 shard 错峰（8906+15*shard），防"已有多人训练在跑"串台
 */
import { spawnSync } from 'node:child_process';
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
    const h2 = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout || '';
    if (!String(h2).trim().startsWith(era)) spawnSync('git', ['checkout', '--detach', era], { cwd: wt, encoding: 'utf8' });
  }
  mkdirSync(wt + '/docs/artifacts', { recursive: true });
  const basePack = resolve(ROOT, 'docs/artifacts/champion-5p-v1.3.58.bak');
  if (existsSync(basePack)) copyFileSync(basePack, wt + '/docs/artifacts/champion-5p-v1.3.58.bak');
  /* era runner 的 HOT 补丁（双形态），只改驱动层 */
  const runnerPath = wt + '/tools/ring2-run.mjs';
  if (existsSync(runnerPath)) {
    let rt = readFileSync(runnerPath, 'utf8');
    if (!rt.includes('RING2_HOT')) {
      const HOTEXPR = 'process.env.RING2_HOT ? join(root, process.env.RING2_HOT) : BASE';
      if (rt.includes('copyFileSync(BASE, STAGE_IN);')) {
        rt = rt.replace('copyFileSync(BASE, STAGE_IN);', 'copyFileSync(' + HOTEXPR + ', STAGE_IN);  /* sweep 补丁 */');
        writeFileSync(runnerPath, rt);
      } else if (rt.includes('copyFileSync(BASE, BUNDLE_MP);')) {
        rt = rt.replace('copyFileSync(BASE, BUNDLE_MP);', 'copyFileSync(' + HOTEXPR + ', BUNDLE_MP);  /* sweep 补丁 */');
        writeFileSync(runnerPath, rt);
      }
    }
  }
  return wt;
}

function flipLedger(id, ledger) {
  const p = 'docs/ARTIFACT-LOSS-1119.tsv';
  const ls = readFileSync(p, 'utf8').split('\n');
  const si = ls[0].split('\t').indexOf('state');
  let n = 0;
  for (let i = 1; i < ls.length; i++) {
    const c = ls[i].split('\t');
    if (c.length && c[0] === id && c[si] === 'missing') { c[si] = 'ok'; ls[i] = c.join('\t'); n++; }
  }
  writeFileSync(p, ls.join('\n'));
  spawnSync('git', ['add', '-f', ledger], { encoding: 'utf8' });
  spawnSync('git', ['add', 'docs/ARTIFACT-LOSS-1119.tsv'], { encoding: 'utf8' });
  return n;
}

for (const j of mine) {
  const eraCands = (j.era || '').split(',').filter(Boolean);
  const got = {};
  for (let ec = 0; ec < eraCands.length; ec++) {
    const era = eraCands[ec];
    try {
      const wt = wtFor(era);
      let hot = '';
      if (j.hot && existsSync(j.hot)) {
        copyFileSync(j.hot, wt + '/docs/artifacts/hot.bak');
        hot = 'docs/artifacts/hot.bak';
      }
      const env = {
        ...process.env,
        RING2_STAGE: 'train',
        RING2_ARM: j.arm,
        RING2_SEEDS: j.seeds.filter(Boolean).join(','),
        RING2_POOL: j.opps || 'B',
        RING2_MODE: j.mode && j.mode !== '-' && j.mode !== 'multi' ? j.mode : '',
        RING2_HOT: hot,
        RING2_PORT: String(8906 + SHARD * 15),
        EPIRUS_ALLOW_HEALTH_FAIL: '1',
        RING2_FORCE: ec > 0 ? '1' : '',
      };
      console.log(`▶ ${j.batch}（era=${era} seeds=${j.seeds} hot=${j.hot ? j.hot.split('/').pop() : 'BASE'} oppsN=${(j.opps || '').split(',').length}${ec ? ' 重试' + ec : ''}）`);
      const r = spawnSync(process.execPath, ['tools/ring2-run.mjs'], { cwd: wt, env, encoding: 'utf8', timeout: 60 * 60000, maxBuffer: 1 << 28 });
      if (r.status !== 0 || r.error) {
        console.log(`  runner exit=${r.status}${r.error ? ' ' + String(r.error.message).slice(0, 60) : ''} out尾: ${String(r.stdout || '').slice(-220).replace(/\n/g, ' | ')}`);
      }
      let nHit = 0, nProd = 0;
      for (let k = 0; k < j.seeds.length; k++) {
        const seed = j.seeds[k], id = j.ids[k], ledger = j.paths[k], target = j.targets[k];
        if (!id || !target) continue;
        const prod = `${wt}/docs/artifacts/${j.arm}-${seed}.bak`;
        if (!existsSync(prod)) { console.log(`  ✗ ${id}: 产物未落`); continue; }
        nProd++;
        const w = widOf(readFileSync(prod, 'utf8'));
        if (w === target) {
          mkdirSync(dirname(ledger), { recursive: true });
          copyFileSync(prod, ledger);
          hits.push({ id, ledger });
          got[id] = true;
          nHit++;
          console.log(`  ✅ ${id} wid=${w}`);
          flipLedger(id, ledger);
        } else {
          console.log(`  ✗ ${id} wid=${w} ≠ ${target}`);
        }
      }
      if (nHit > 0 || ec === eraCands.length - 1) break;
      const allMiss = j.ids.every((id) => !got[id]);
      if (!allMiss) break;
      console.log(`  ↻ era ${era} 全 miss（产物 ${nProd}/${j.seeds.length}）⇒ 换下一候选`);
    } catch (e) {
      console.log(`⛔ ${j.batch}@${era}: ${String(e.message || e).slice(0, 170)}`);
    }
  }
}
console.log(`\n==== 分片 ${SHARD} 完成：${hits.length} 命中 ====`);
console.log('HITS\t' + hits.map((h) => h.id).join(','));
