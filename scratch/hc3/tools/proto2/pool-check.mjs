#!/usr/bin/env node
/* pool-check.mjs — 池级验收快查（ZCode · 10-31 02:0x）
 *
 * 把两把在册尺编排成一张 PREREG-2026-10-30-LONGSKILL §三 的池表（**单源纪律：测量全部调用现成 CLI，
 * 本工具只编排与汇总，不写第二套判据**）：
 *   ① skill-mastery（每包六判据 + 观测列 + 珠经济）——正式尺档 40 局/格；
 *   ② arena2 CLI 考卷（mild 分层 40 局/桌形，t=0.15 单温度快查档——与 CLIS 全扫描不同档，表头标明）；
 * 汇总输出：比例线（ring/bigT/railgun ≥1/2，laserEye/miniT/cannon ≥1/5）‖ 珠健康（池均浪费<40% ∧ 花珠率≥60%）
 * ‖ 每包 clean/单卡快查列。
 * ⚠ 分母 = 显式传入的候选集，工具不produce"池已达标"判词（PREREG §三；真池以 pool-members 名单另判）。
 *
 * 用法：node tools/proto2/pool-check.mjs --pool=a.bak,b.bak,... [--games=40] [--temp=0.15] [--out=results/x.json]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const POOL = arg('pool', '').split(',').map((s) => s.trim()).filter(Boolean);
if (!POOL.length) { console.error('用法：--pool=a.bak,b.bak,...'); process.exit(2); }
const GAMES = Number(arg('games', 40)) || 40;
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const OUT = arg('out', '');
const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = HERE + '/../..';

const pct = (x) => (x * 100).toFixed(1) + '%';
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const packs = [];
for (const p of POOL) {
  console.error('[pool-check] 审计 ' + p + ' …');
  const mJson = ROOT + '/results/mastery/poolcheck-mastery-' + p.replace(/[^\w.-]/g, '_') + '.json';
  sh('node', ['tools/proto2/skill-mastery.mjs', '--pack=' + p, '--games=' + String(GAMES), '--temp=' + String(TEMP), '--out=' + mJson]);
  const m = JSON.parse(sh('node', ['-e', 'const fs=require("fs");console.log(fs.readFileSync(process.argv[1],"utf8"))', mJson]));
  const aJson = ROOT + '/results/mastery/poolcheck-cli-' + p.replace(/[^\w.-]/g, '_') + '.json';
  /* arena2 行用 tag（'2.0包 X t=…' / '参照v7 t=…'）；v7 要 --v7=1 而非 --pack；单包失败不拖垮整池 */
  let cli = null, cliNote = '';
  try {
    const args = ['tools/proto2/arena2.mjs', '--gamesPerShape=40', '--temp=' + String(TEMP), '--strat=mild', '--json=' + aJson];
    if (p === 'v7') args.push('--v7=1'); else args.push('--pack=' + p);
    sh('node', args);
    const a = JSON.parse(sh('node', ['-e', 'const fs=require("fs");console.log(fs.readFileSync(process.argv[1],"utf8"))', aJson]));
    const rows = a.rows || [];
    const base = p === 'v7' ? '参照v7' : '2.0包';
    cli = rows.find((r) => String(r.tag || '').indexOf(base) === 0 && Math.abs((r.temp != null ? r.temp : TEMP) - TEMP) < 1e-9)
      || rows.find((r) => String(r.tag || '').indexOf(base) === 0) || null;
    if (!cli) cliNote = '（考卷行没匹配上）';
  } catch (e) { cliNote = '（CLI 失败：' + String(e.message || e).slice(0, 80) + '）'; }
  packs.push({ pack: p, mastery: (m.packs && m.packs[0]) || null, cli, cliNote });
}

/* ---------- 汇总 ---------- */
const CRIT = { ring: '会聚能环', bigT: '会大雷', railgun: '会电磁炮', laserEye: '会激光眼', miniT: '会小雷', cannon: '会过载炮' };
const NEED = { ring: 0.5, bigT: 0.5, railgun: 0.5, laserEye: 0.2, miniT: 0.2, cannon: 0.2 };
console.log('\n=== 池级快查（⚠ 分母 = 显式候选集 ' + packs.length + ' 枚，不produce 池级判词；PREREG §三） ===');
console.log('[尺] skill-mastery ' + GAMES + ' 局/格 t=' + TEMP + ' ‖ arena2 CLI mild 40 局/桌形 t=' + TEMP + '（快查单温度档）');
for (const k of Object.keys(CRIT)) {
  const oks = packs.filter((x) => x.mastery && x.mastery.verdict && x.mastery.verdict[k] && x.mastery.verdict[k].pass);
  console.log('  ' + CRIT[k].padEnd(5) + ' 会者 ' + oks.length + '/' + packs.length + '（' + pct(oks.length / packs.length) + '；目标 ≥' + NEED[k] * 100 + '%）' + (oks.length ? '  ← ' + oks.map((x) => x.pack.split('/').pop()).join(', ') : ''));
}
let wasteSum = 0, wasteN = 0, spentSum = 0, spentN = 0;
for (const x of packs) {
  const b = x.mastery && x.mastery.bead;
  if (b && b.gained > 0) { wasteSum += b.wasteRate; wasteN++; spentSum += b.spentRate; spentN++; }
}
if (wasteN) {
  const w = wasteSum / wasteN, s = spentSum / spentN;
  console.log('  珠健康（池均，有珠经济 ' + wasteN + ' 枚）：浪费率 ' + pct(w) + '（线 <40% ' + (w < 0.4 ? '✔' : '✘') + '）‖ 花珠率 ' + pct(s) + '（线 ≥60% ' + (s >= 0.6 ? '✔' : '✘') + '）');
}
console.log('  —— 每包快查列 ——');
for (const x of packs) {
  const name = x.pack.split('/').pop();
  const v = x.mastery && x.mastery.verdict;
  const ncrit = v ? Object.keys(v).filter((k) => v[k].pass).length : 0;
  const c = x.cli;
  console.log('  ' + name.padEnd(28) + ' 判据 ' + ncrit + '/6 ‖ 夺1 ' + (c && c.first != null ? pct(c.first) : '-') + ' ‖ clean ' + (c && c.cleanScore != null ? c.cleanScore.toFixed(3) : '-') + ' ‖ 单卡 ' + (c && c.maxCard ? c.maxCard.key + ' ' + pct(c.maxCard.share) : '-') + (x.cliNote || ''));
}
if (OUT) {
  writeFileSync(OUT, JSON.stringify({ meta: { tool: 'pool-check', games: GAMES, temp: TEMP, note: '快查单温度档；分母=显式候选集' }, packs }, null, 1));
  console.log('\n[JSON] ' + OUT);
}
