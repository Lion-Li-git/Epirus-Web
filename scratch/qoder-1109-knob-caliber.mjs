/* 接进产线之前必须成立的三件事（11-09 · P1/P2 的口径验证）：
 *  A. 重构后的 tools/card-usage.mjs 与重构前的在册产物**逐字节相同** ⇒ 证明"只是把循环搬进 lib"，尺没变
 *  B. 训练侧 SEL_CARDS 走 `cardUsageProfile`（60 局）与 CLI 给出同一张数 ⇒ 地板与 POOL-CONTRACT 基准同源
 *  C. 训练侧 SEL_DEFQ 走 `measureDefenseQuality` 与在产探针 `probe-wasted-play` 三档计数逐位相同
 * 任何一条不成立 ⇒ 不许上旋钮（两个"看起来合理"的读数差一张压线卡，就足以把 veto 变成抽签）。 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sandbox, ROOT, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { cardUsageProfile } from '../tools/audit-lib.mjs';
import { measureDefenseQuality } from '../tools/defense-quality.mjs';

let bad = 0;
const packs = readFileSync(ROOT + '/champion-map/pool-members.tsv', 'utf8').replace(/\r/g, '').split('\n').slice(1).filter(Boolean)
  .map(l => l.split('\t')[2]).filter(Boolean);

/* —— A —— */
console.log('=== A. card-usage CLI 重构前后逐字节 ===');
const r = spawnSync(process.execPath, ['tools/card-usage.mjs', '--packs=' + packs.join(','), '--games=60', '--mode=multi',
  '--out=' + ROOT + '/scratch/qoder-1109-card-usage-pool20-after-refactor.tsv'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
if (r.status !== 0) { console.error('⛔ CLI 跑挂：rc=' + r.status + ' ‖ ' + String(r.stderr || '').split('\n')[0]); bad++; }
else {
  const before = readFileSync(ROOT + '/scratch/qoder-1109-card-usage-pool20.tsv', 'utf8');
  const after = readFileSync(ROOT + '/scratch/qoder-1109-card-usage-pool20-after-refactor.tsv', 'utf8');
  const same = before === after;
  if (!same) bad++;
  console.log('  产物 ' + packs.length + ' 行 ‖ 重构前 vs 重构后 ⇒ ' + (same ? '**逐字节相同**' : '**不同**（下面的 diff 是要核的）'));
  if (!same) {
    const b = before.split('\n'), a = after.split('\n');
    for (let i = 0; i < Math.max(b.length, a.length); i++) if (b[i] !== a[i]) console.log('   行 ' + (i + 1) + '\n    前 ' + b[i] + '\n    后 ' + a[i]);
  }
}

/* —— B —— */
console.log('=== B. 训练侧路径与 CLI 同数（cardUsageProfile 60 局 · 含 ジ · ≥0.5%）===');
const W = sandbox(ROOT);
const EXPECT = { 'KD-G2': 9, 'FOCUS-Q-s13': 8, 'STR-B-Q-s13': 6, 'ADAPT2-Q-s7': 7, 'PASS2-Q-s13': 5 };
for (const f of packs) {
  const id = f.replace(/^.*\//, '').replace(/\.(bak|js)$/, '');
  if (EXPECT[id] === undefined) continue;
  const p = loadChamp(W, f);
  if (!p) { console.error('  ⛔ 读不出 ' + id); bad++; continue; }
  const u = cardUsageProfile(W, p, { games: 60, mode: 'multi' });
  const ok = u.distinct === EXPECT[id];
  if (!ok) bad++;
  console.log('  ' + id.padEnd(14) + '训练侧 ' + String(u.distinct).padStart(2) + ' 张 ‖ 在册 ' + EXPECT[id] + ' 张 ⇒ ' +
    (ok ? '一致' : '**不一致**') + (u.borderline.length ? ' ‖ 压线卡 ' + u.borderline.join(',') + '（份额 ' + u.borderline.map(k => u.pct[k].toFixed(2) + '%').join('/') + '）' : ' ‖ 无压线卡'));
}

/* —— C —— */
console.log('=== C. 白防率与在产探针逐位 ===');
const kd = loadChamp(W, 'docs/artifacts/night-adapt/KD-G2.bak');
const m = measureDefenseQuality(W, kd, { games: 40, eps: 0.2, seed: 5200, minHands: 30 });
console.log('  新函数：防御 ' + m.def + ' ‖ 有效 ' + m.eff + ' ‖ 半 ' + m.part + ' ‖ 白防 ' + m.idle + ' ‖ 白防率 ' + m.whitePct.toFixed(1) + '% ‖ 质量 ' + (100 * m.q).toFixed(1) + '% ‖ placebo ' + m.placeboRatio.toFixed(2) + '×');
console.log('  在产探针在册（同口径 40 局 · ε=0.2 · seed 5200）：874 ‖ 82 ‖ 19 ‖ 773 ‖ 88.4% ‖ 10.5%');
const okC = m.def === 874 && m.idle === 773 && m.eff === 82 && m.part === 19;
if (!okC) bad++;
console.log('  ⇒ ' + (okC ? '逐位一致' : '**不一致 ⇒ P1 的度量与在册尺不同源，不许上**'));
console.log('  ⚑ 可测性：measurable=' + m.measurable + '（n=' + m.n + ' ≥ 门 30）‖ 若 n<30 训练侧按"没量到"跳过本条，不判过也不判不过');
console.log(bad ? '⛔ ' + bad + ' 条对不上 ⇒ 旋钮不许上产线' : '✅ 三条全对上');
process.exit(bad ? 2 : 0);