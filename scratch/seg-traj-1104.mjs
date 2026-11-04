#!/usr/bin/env node
/* seg-traj-1104.mjs —— 存段的**行为轨迹 + 同形对数**（11-04 晚 · 千问）
 *
 * 为什么要单独一台（而不是复用 `chain-usage-1104.mjs`）：那台的反自我欺骗护栏假设
 *   "wid 不同 ⇒ 剖面必须不同，否则就是没 `installArch2`"。今天跑 24 枚存段时它**当场 abort**，
 *   而权重 md5 一验：**24 枚两两不同** ⇒ 不是接线坏，是**壁盆里的两个粒本来就是同一个玩家**
 *   （60 局同副种子 ⇒ 连出手序列都逐字同）。所以这条"同形对数"本身就是要量的东西，不能当 bug 抹掉。
 *
 * 口径：`tools/behavior-profile.mjs::fieldProfile`（ε=0 · soft · 五席脚本场 · 60 局 · seed0=77000）
 *       = 与 SEL_KEEP/T1/chain-usage 同一把尺；类别走引擎单源。
 * 用法：node scratch/seg-traj-1104.mjs <臂名> [<臂名2> …]        （段名 = scratch/ga-bands/<臂>/<臂>-seg*.bak）
 *       读数落 scratch/wave-I-1104/seg-<臂>.txt
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { fieldProfile, WIN } = await import('../tools/behavior-profile.mjs').then(m => m.default || m);
const { install: installArch2, packCfgExit, readPack2 } = await import('../tools/proto2/arch2.mjs');
const G = Number(process.env.GAMES || 60), SEED0 = Number(process.env.SEED0 || 77000);
const ARMS = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!ARMS.length) { console.error('用法：node scratch/seg-traj-1104.mjs HS-2 HS-4'); process.exit(64); }
const P = WIN.EpirusPolicy;
let installed = null;

const JI = WIN.EpirusRules.SK.JI;
const profOf = (v) => {
  const pr = fieldProfile(v, 0, 'soft', G, SEED0, 'scripts', 'multi');
  const acts = pr.acts || 0;
  const kinds = Object.keys(pr.keys || {}).filter(k => k !== JI && acts && (pr.keys[k] / acts) >= 0.005).length;
  const sigObj = { kinds, acts, def: Math.round(1000 * (pr.def || 0) / acts) / 10, keys: Object.keys(pr.keys || {}).sort().join(',') };
  return { kinds, def: acts ? 100 * (pr.def || 0) / acts : 0, acts: acts / G,
    sig: createHash('md5').update(JSON.stringify(sigObj)).digest('hex').slice(0, 10) };
};

const out = [];
out.push('# 存段轨迹（每 100 代当选的那粒）‖ 尺 = fieldProfile ε=0 · soft · 五席脚本场 · ' + G + ' 局 · seed0=' + SEED0);
out.push('# 「同形」= 种数/出手/防御族/键名集合**逐字同** ⇒ 两粒不同权重在实现行为上是同一个玩家（不是装载坏：权重 md5 随行印出）');
for (const arm of ARMS) {
  const dir = 'scratch/ga-bands/' + arm;
  let files;
  try { files = readdirSync(dir).filter(f => f.indexOf('-seg') === arm.length).sort((a, b) => (parseInt(a.match(/seg(\d+)/)[1], 10) - parseInt(b.match(/seg(\d+)/)[1], 10))); }
  catch (e) { out.push('⚠ ' + arm + '：没有 ' + dir + ' 目录（跳）'); continue; }
  out.push('');
  out.push('== ' + arm + '（' + files.length + ' 个存段）');
  const rows = [];
  for (const f of files) {
    const p = dir + '/' + f;
    const t = readFileSync(p, 'utf8');
    const raw = readPack2(p);
    if (!raw || raw.v !== 92) { out.push('  ' + f + ' ⇒ 不是 v:92 容器（跳）'); continue; }
    const cfg = packCfgExit(raw, p).cfg;
    const cfgKey = JSON.stringify(cfg);
    if (installed && installed !== cfgKey) { out.push('⛔ ' + p + ' 的 dims 与首批不同 ⇒ 分进程重跑（同进程换面会污染）'); process.exit(5); }
    if (!installed) { installArch2(WIN, cfg); installed = cfgKey; }
    const v = Float64Array.from(P.unpack(raw, true));
    if (P.paramCount() !== v.length) { console.error('⛔ paramCount ' + P.paramCount() + ' ≠ 权重长度 ' + v.length); process.exit(5); }
    const wmd5 = createHash('md5').update(Buffer.from(v.buffer, v.byteOffset, 4096)).digest('hex').slice(0, 10);
    const q = profOf(v);
    rows.push({ seg: parseInt(f.match(/seg(\d+)/)[1], 10), wmd5, q });
  }
  const bySig = {};
  for (const r of rows) (bySig[r.q.sig] = bySig[r.q.sig] || []).push(r.seg);
  const dupGroups = Object.values(bySig).filter(a => a.length > 1);
  let pairs = 0;
  for (const g of dupGroups) pairs += g.length * (g.length - 1) / 2;
  for (const r of rows) out.push('  seg' + String(r.seg).padStart(2) + '（≈第 ' + (r.seg * 100) + ' 代）‖ 种数 ' + String(r.q.kinds).padStart(2) +
    ' ‖ 防御族 ' + r.q.def.toFixed(1).padStart(5) + '% ‖ 出手/局 ' + r.q.acts.toFixed(1).padStart(4) +
    ' ‖ 权重 ' + r.wmd5 + ' ‖ 剖面形 ' + r.q.sig);
  out.push('  ⇒ **同形对数 ' + pairs + ' / ' + (rows.length * (rows.length - 1) / 2) + '**（' + rows.length + ' 粒里有 ' +
    Object.keys(bySig).length + ' 个不同的实现行为）‖ 最大同形簇 ' + (dupGroups.length ? Math.max(...dupGroups.map(a => a.length)) + ' 粒 [' +
    dupGroups.map(a => a.join('/')).join('] [') + ']' : '无'));
  const esc = rows.filter(r => r.q.def < 20).length;
  out.push('  ⇒ 离开壁盆（防御族 <20%）的存段：**' + esc + '/' + rows.length + '（第 ' + (rows.find(r => r.q.def < 20) || { seg: '—' }).seg + ' 段起**）');
}
writeFileSync('scratch/wave-I-1104/seg-' + ARMS.join('+') + '.txt', out.join('\n') + '\n');
console.log(out.join('\n'));
