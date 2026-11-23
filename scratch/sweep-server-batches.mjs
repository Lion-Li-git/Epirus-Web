#!/usr/bin/env node
/* sweep-server-batches.mjs —— server 系批级回放 v3（校准优先）
 * 用法：node scratch/sweep-server-batches.mjs <jobs.tsv> <shard> <totalShards>
 * jobs.tsv 列: batch fam era(逗号候选) arm seeds opps mode hot ids paths targets calibSeed calibWid calibPath
 * 流程：有校准（幸存者）的批——先单跑校准 seed 验 era/配置（1-2 分钟）；命中 ⇒ 同 era 全批扫；
 *       miss ⇒ 换下一 era 候选只重跑校准；候选尽 miss ⇒ 记档跳过（省整批算力）。
 *       无校准的批——整批按 era 候选扫（0 命中换下一候选）。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  return { batch: c[ix.batch], fam: c[ix.fam], era: c[ix.era], arm: c[ix.arm], seeds: (c[ix.seeds] || '').split(','), opps: c[ix.opps], mode: c[ix.mode], hot: c[ix.hot] || '', ids: (c[ix.ids] || '').split(','), paths: (c[ix.paths] || '').split(','), targets: (c[ix.targets] || '').split(','), calibSeed: c[ix.calibSeed] || '', calibWid: c[ix.calibWid] || '', calibPath: c[ix.calibPath] || '', env: (c[ix.env] !== undefined ? c[ix.env] : '') };
}).filter((j) => j.era && j.batch);
const mine = jobs.filter((_, k) => k % TOTAL === SHARD);
console.log(`分片 ${SHARD}/${TOTAL}：${mine.length} 批（校准 ${mine.filter((j) => j.calibWid).length}）`);

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

function runBatch(j, era, seeds, force) {
  const wt = wtFor(era);
  const env = {
    ...process.env,
    RING2_STAGE: 'train',
    RING2_ARM: j.arm,
    RING2_SEEDS: seeds,
    RING2_POOL: j.opps || 'B',
    RING2_MODE: j.mode && j.mode !== '-' && j.mode !== 'multi' ? j.mode : '',
    RING2_PORT: process.env.SWEEP_PORT || String(8906 + SHARD * 15),
    EPIRUS_ALLOW_HEALTH_FAIL: '1',
    RING2_FORCE: force ? '1' : '',
  };
  /* 11-22：批级 env 精配列（KEY=VAL;KEY=VAL）——会话原文挖掘的旋钮覆写注入（fgt 系 EPIRUS_FIGHT_WHISTLE 等） */
  for (const kv of (j.env || '').split(';')) {
    const i2 = kv.indexOf('=');
    if (i2 > 0 && kv.slice(0, i2).trim()) env[kv.slice(0, i2).trim()] = kv.slice(i2 + 1).trim();
  }
  /* 11-23：热启动列（hot=包名，不带 .bak）——t1/u1 系当年 RING2_HOT=现役冠军；包拷进 worktree 再指路径 */
  if (j.hot && j.hot !== '-') {
    const hp = resolve(ROOT, 'docs/artifacts', j.hot + '.bak');
    if (existsSync(hp)) {
      copyFileSync(hp, wt + '/docs/artifacts/' + j.hot + '.bak');
      env.RING2_HOT = 'docs/artifacts/' + j.hot + '.bak';
    } else {
      console.log(`    ⚠ 热启动包缺盘 ${j.hot}.bak——本批裸 BASE 顶上（预期 miss）`);
    }
  }
  console.log(`  ▶ ${j.batch}@${era} seeds=${seeds}`);
  const r = spawnSync(process.execPath, ['tools/ring2-run.mjs'], { cwd: wt, env, encoding: 'utf8', timeout: 60 * 60000, maxBuffer: 1 << 28 });
  if (r.status !== 0 || r.error) {
    console.log(`    runner exit=${r.status} out尾: ${String(r.stdout || '').slice(-200).replace(/\n/g, ' | ')}`);
  }
  return wt;
}

function checkProducts(j, wt, seeds) {
  const res = [];
  for (let k = 0; k < seeds.length; k++) {
    const seed = String(seeds[k]);
    const prod = `${wt}/docs/artifacts/${j.arm}-${seed}.bak`;
    if (!existsSync(prod)) { res.push({ seed, id: '', hit: false, wid: '' }); continue; }
    const w = widOf(readFileSync(prod, 'utf8'));
    res.push({ seed, prod, hit: false, wid: w });
  }
  return res;
}

const LEDGER_ST = {};
readFileSync('docs/ARTIFACT-LOSS-1119.tsv', 'utf8').split('\n').slice(1).forEach((l) => {
  const c = l.split('\t');
  if (c.length >= 4) LEDGER_ST[c[0]] = c[2];
});

for (const j of mine) {
  const eraCands = (j.era || '').split(',').filter(Boolean);
  let verifiedEra = '';
  if (j.ids.length && j.ids.every((id) => LEDGER_ST[id] && LEDGER_ST[id] !== 'missing')) {
    console.log('skip ' + j.batch + ': 全部已在账');
    continue;
  }
  try {
    /* ---- 阶段 1：校准（幸存者 seed 探针）---- */
    if (j.calibWid) {
      let ok = false;
      for (const era of eraCands) {
        const wt = runBatch(j, era, j.calibSeed, true);
        const w = widOf(readFileSync(`${wt}/docs/artifacts/${j.arm}-${j.calibSeed}.bak`, 'utf8'));
        if (w === j.calibWid) {
          console.log(`  ✅ 校准 ${j.batch} seed=${j.calibSeed} @${era} wid=${w} ⇒ 配置/era 验证`);
          verifiedEra = era;
          ok = true;
          break;
        }
        console.log(`  · 校准 miss @${era} wid=${w} ≠ ${j.calibWid}`);
      }
      if (!ok) {
        console.log(`  ⛔ ${j.batch}: 全 era 候选校准未过 ⇒ 跳过整批（配置/era 待考古）`);
        continue;
      }
    }
    /* ---- 阶段 2：全批扫 ---- */
    const era = verifiedEra || eraCands[0];
    /* 盲扫批（无幸存者）最多补试 1 个备选 era；重扫一律 force=1，绝不复用上一波误配方留下的同名 .bak */
    const altEras = j.calibWid ? [] : eraCands.filter((e) => e !== era);
    for (let ec = 0; ec < 1 + Math.min(altEras.length, 1); ec++) {
      const e2 = ec === 0 ? era : altEras[ec - 1];
      const wt = runBatch(j, e2, j.seeds.filter(Boolean).join(','), true);
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
          nHit++;
          console.log(`  ✅ ${id} wid=${w}`);
          const p = 'docs/ARTIFACT-LOSS-1119.tsv';
          const ls = readFileSync(p, 'utf8').split('\n');
          const si = ls[0].split('\t').indexOf('state');
          /* 11-22 深夜登记口径改口（HANDOFF-2026-11-22 §7.1）：重放件与当年原件字节不同（wid 逐位同）
           *   ⇒ 记 sha-diff-wid-same + 第 4 列写盘上实际 sha；registry.sha256 是历史指纹永不动。 */
          const sha = createHash('sha256').update(readFileSync(ledger)).digest('hex');
          for (let i2 = 1; i2 < ls.length; i2++) {
            const c = ls[i2].split('\t');
            if (c.length && c[0] === id && c[si] === 'missing') { c[si] = 'sha-diff-wid-same'; while (c.length < 4) c.push(''); c[3] = sha; ls[i2] = c.join('\t'); }
          }
          writeFileSync(p, ls.join('\n'));
        } else {
          console.log(`  ✗ ${id} wid=${w} ≠ ${target}`);
        }
      }
      if (nHit > 0 || ec >= Math.min(altEras.length, 1)) break;
      console.log(`  ↻ era ${e2} 全 miss ⇒ 换 ${altEras[ec - 1] || '(无)'}`);
    }
  } catch (e) {
    console.log(`⛔ ${j.batch}: ${String(e.message || e).slice(0, 170)}`);
  }
}
console.log(`\n==== 分片 ${SHARD} 完成：${hits.length} 命中 ====`);
console.log('HITS\t' + hits.map((h) => h.id).join(','));
