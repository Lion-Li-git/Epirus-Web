#!/usr/bin/env node
/* aggr-dose-1104.mjs —— 把闸门口上那道**噪声比格差还大**的判据加剂量重测（11-04 晚 · 千问）
 *
 * 为什么单做这一台：`场A 还手率 < 20%` 现在是 `KDFULL400-s13` 唯一的阻断，而它在 n=100 时 1.96SE=±7.3pt
 *   ⇒ "16.4 vs 20" 与线**分不出**（收据自己印的 SE），而"AK3-s7 的 25.6"与"线上包 28.5"同样分不出。
 *   仓里早就认下这个病：§E492 把场A 从 40 提到 100 时明写"**要判 ±2pt 得 n≈1536**"。
 * 这一台不重定义判据、**只加剂量**：走 `tools/audit-lib.mjs::aggressionProfile` —— 与 `promote-champion.mjs:225`
 *   **同一个函数、同一串 seed**（`aggressionProfile(W, params, FEAS_N.aggr)`，没有 opts）⇒ 读的是同一把尺。
 *
 * 三条自守：
 *   ① **接线自证**：n=100 必须先**复现在册收据**（差 >0.5pt ⇒ 当场判"尺不是那一把"，整批判废）；
 *   ② **分进程装载**：一枚包一个子进程 ⇒ 2.0 的 `installArch2` 是进程内覆盖，绝不能和线上包（v7 面）同进程；
 *   ③ **paramCount 自证**：2.0 必须 7993、v7 必须 5689。
 *
 * 用法：node scratch/aggr-dose-1104.mjs [--doses=100,600]
 *       读数落 scratch/aggr-dose-1104.txt
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SELF = import.meta.filename || fileURLToPath(import.meta.url);

const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) ARG[m[1]] = m[2] === '' ? '1' : m[2]; }
const DOSES = String(ARG.doses || '100,600').split(',').map(Number).filter(x => x >= 20);

/* 在册 n=100 的收据（接线自证的目标；出处逐条点名） */
const PACKS = [
  { name: '线上包', p: 'js/bundled-champion-3p.js', face: '7', rec: 28.5, src: 'scratch/PROMOTE-dry-v7.log' },
  { name: 'AK3-s7', p: 'scratch/ga-arms/AK3-s7.js', face: '2', rec: 25.6, src: 'scratch/promote-1104/AK3-s7.txt' },
  { name: 'KDFULL400-s13', p: 'scratch/ga-arms/KDFULL400-s13.js', face: '2', rec: 16.4, src: 'scratch/promote-400s13.log（DS）' },
  { name: 'HS4b', p: 'scratch/ga-arms/HS4b.js', face: '2', rec: 14.0, src: 'scratch/promote-1104/HS4b.txt' },
];

if (ARG.pack) {                                   /* ===== 子进程：一枚包，逐剂量 ===== */
  const face = ARG.face, P0 = ARG.pack;
  const { sandbox, loadChamp, aggressionProfile } = await import('../tools/audit-lib.mjs');
  const W = sandbox();
  const PP = W.EpirusPolicy;
  let params;
  if (face === '2') {
    const { install: installArch2, readPack2, packCfgExit } = await import('../tools/proto2/arch2.mjs');
    const raw = readPack2(P0);
    installArch2(W, packCfgExit(raw, P0).cfg);
    params = Float64Array.from(PP.unpack(raw, true));
    if (PP.paramCount() !== 7993) { console.error('⛔ 2.0 面 paramCount=' + PP.paramCount() + '（期望 7993）'); process.exit(5); }
  } else {
    params = Float64Array.from(loadChamp(W, P0, '.'));
    if (PP.paramCount() !== 5689) { console.error('⛔ v7 面 paramCount=' + PP.paramCount() + '（期望 5689）'); process.exit(5); }
  }
  for (const n of DOSES) {
    const r = aggressionProfile(W, params, n);
    process.stdout.write('#JSON ' + JSON.stringify({
      pack: P0, n, atk: 100 * r.fieldA.atk, dealt: r.fieldA.dealtPerGame, taken: r.fieldA.takenPerGame, win: 100 * (r.fieldA.win || 0),
    }) + '\n');
  }
  process.exit(0);
}

/* ===== 父进程 ===== */
const rows = [];
for (const pk of PACKS) {
  let out;
  try {
    out = execFileSync(process.execPath, [SELF, '--pack=' + pk.p, '--face=' + pk.face, '--doses=' + DOSES.join(',')],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (e) {
    console.error('⛔ ' + pk.name + ' 子进程失败：' + String(e.stderr || e.message).slice(0, 260));
    process.exit(3);
  }
  const got = out.split('\n').filter(l => l.startsWith('#JSON ')).map(l => JSON.parse(l.slice(6)));
  if (!got.length) { console.error('⛔ ' + pk.name + ' 零读数 ⇒ 判"读不出"，不许当 0'); process.exit(3); }
  rows.push({ pk, got });
}

const se95 = (p, n) => 1.96 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / n) * 100;
const L = [];
L.push('# 场A 还手率加剂量重测（`aggressionProfile` = `promote-champion.mjs:225` 同一个函数、同一串 seed ‖ 一pack 一进程 ‖ 判据线 20% 一字不动）');
L.push('# 接线自证：n=' + DOSES[0] + ' 必须先复现在册收据（差 >0.5pt ⇒ 本批判"尺不是那一把"）');
L.push('');
L.push('包'.padEnd(16) + DOSES.map(n => ('n=' + n + ' ±1.96SE').padStart(18)).join('') + '   接线自证（vs 在册 ' + DOSES[0] + ' 局）');
let bad = [];
for (const { pk, got } of rows) {
  const cells = DOSES.map(n => { const r = got.find(g => g.n === n); return r ? r.atk.toFixed(1) + ' ±' + se95(r.atk / 100, n).toFixed(1) : '  —  '; });
  const first = got.find(g => g.n === DOSES[0]);
  const d = first ? first.atk - pk.rec : NaN;
  if (first && Math.abs(d) > 0.5) bad.push(pk.name + '（读到 ' + first.atk.toFixed(1) + ' ‖ 收据 ' + pk.rec + ' ‖ Δ' + d.toFixed(1) + 'pt）');
  L.push(pk.name.padEnd(16) + cells.map(x => x.padStart(18)).join('') + '   Δ' + (isNaN(d) ? '—' : d.toFixed(1)) + 'pt ⇒ ' +
    (isNaN(d) ? '⛔ 没收齐' : Math.abs(d) <= 0.5 ? '**复现**（' + pk.src + '）' : '⛔ **不复现**'));
}
L.push('');
if (bad.length) L.push('⛔ 接线自证没过：' + bad.join(' ‖ ') + ' ⇒ 下面所有大剂量读数**不许引用**（先查是不是另一把尺）');
for (const { pk, got } of rows) {
  const big = got.find(g => g.n === DOSES[DOSES.length - 1]);
  if (!big) continue;
  const s = se95(big.atk / 100, big.n);
  const ci = [big.atk - s, big.atk + s];
  const vs20 = ci[1] < 20 ? 'CI 上界 <20 ⇒ **真的不过线**' : (ci[0] > 20 ? 'CI 下界 >20 ⇒ **真的过线**' : 'CI 跨过 20 ⇒ **与线分不出**（加大剂量也判不动）');
  L.push(pk.name.padEnd(16) + 'n=' + big.n + ' ⇒ 还手 ' + big.atk.toFixed(1) + '% ±' + s.toFixed(1) + 'pt ‖ 95%CI [' +
    ci[0].toFixed(1) + ', ' + ci[1].toFixed(1) + '] ‖ 判 20% 那条线：' + vs20 + ' ‖ 伤害 ' + big.dealt.toFixed(2) + '/局 · 承受 ' + big.taken.toFixed(2) + '/局');
}
L.push('');
L.push('⚑ 这条读数只改**分辨率**，不改判定：闸门口仍是 `atk < 0.20 ⇒ 阻断`（`promote-champion.mjs:234` 一字未动）。');
L.push('   它要回答的是用户那一题："顶多一项没过、且不远"——**"不远"有没有被量出来**。');
writeFileSync('scratch/aggr-dose-1104.txt', L.join('\n') + '\n');
console.log(L.join('\n'));
console.log('\n已落盘：scratch/aggr-dose-1104.txt');
