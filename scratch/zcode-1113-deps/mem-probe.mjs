/* 背诵对照探针（11-14 晚 · ZCode · 用户令"先做第一个"）
 *   问题：obs6 把对手精确键通道开回来了（synthMix/seatDrop/seatL2 防背诵）——防得住吗？
 *   量法：同一主体包 vs **名册脚本集 R**（训练见过的 v2 池 6 角色）与 vs **非名册包集 H**
 *   （训练从未当过对手的 6 枚图上包）的胜率差 = Gap。Gap 大于对照包（GD6a-TILT，obs5 系，
 *   同样在脚本桌上训大）的 Gap ⇒ 背诵实锤；Gap 相当 ⇒ 合成对手+正则买住了。
 *   口径：duelAssembly n=2（scriptedSeat=局序轮换 ⇒ 席位对称自证内置），seed0 全配对同种
 *   ⇒ 逐局配对可比；主体胜率 = champRate（G−胜−平）/G。
 *   ⚑ 并行默认（用户 11-14 晚令）：配对互相独立 ⇒ 父进程按配对切片 fork 子进程（jobs=min(8,核数)），
 *   子进程跑单配对吐 `PAIR <i> ...` 行，父进程汇总。`--pair=<i>` = 只跑第 i 个配对（内部模式）。 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { duelAssembly } from '../../tools/v2v4-lib.mjs';
import { EXAM_POOL, OPP_SPECS } from '../../training/server/opp-pool.mjs';

const execFileP = promisify(execFile);
const argNum = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? Number(a.slice(k.length + 3)) : d; };
const GAMES = argNum('games', 200);
const JOBS = Math.max(1, argNum('jobs', Math.min(8, cpus().length)) || 1);
const PAIR_ONLY = process.argv.find((a) => a.startsWith('--pair=')) ? Number(process.argv.find((a) => a.startsWith('--pair=')).slice(7)) : -1;
const SEED0 = 90210;

const SUBJECTS = [
  ['OBS6-GA2PG-8K', 'docs/artifacts/obs6-coldstart/OBS6-GA2PG-8K.bak'],
  ['OBS6-GA25', 'docs/artifacts/obs6-coldstart/OBS6-GA25.js'],
  ['GD6a-TILT(对照)', 'scratch/arms/GD6a-TILT.bak'],
];
/* 名册 R：训练桌见过的 v2 池脚本，四角色各取一（枪压/墙/八卦防spam/攻防/重火力/深经济） */
const R_NAMES = ['gunspam', 'wall', 'baguaspam', 'guardgun', 'heavyfire', 'deepsaver'];
/* 非名册 H：图上现役包——obs6 冷启动臂的训练对手里没有它们（ga-cold/ga2pg 无 FIT_CHAMP/PACK_OPP） */
const H_PACKS = [
  ['GD16m', 'scratch/arms/GD16m-D1.bak'],
  ['KDG-B-Q-s13', 'docs/artifacts/night-adapt/KDG-B-Q-s13.js'],
  ['MSB11-R2', 'docs/artifacts/night-adapt/MSB11-R2S306293884.js'],
  ['MSB14-railgun', 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'],
  ['MSB15R-HITMIX', 'docs/artifacts/night-adapt/MSB15R-hit-mix-R1S2057836694.js'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
];

const W = sandbox();
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
if (!S || !Play || !T || !R || !B) { console.error('⛔ sandbox 字段缺'); process.exit(2); }

const R_OPPS = R_NAMES.map((nm) => {
  if (!EXAM_POOL.find((e) => e.name === nm)) { console.error('⛔ EXAM_POOL 没有 ' + nm); process.exit(2); }
  const spec = OPP_SPECS.find((e) => e.name === nm);
  const fn = spec ? B[spec.fn] : null;
  if (typeof fn !== 'function') { console.error('⛔ EpirusBots 没有 ' + (spec ? spec.fn : nm)); process.exit(2); }
  return { id: 'R:' + nm, chooser: fn };
});
const H_OPPS = H_PACKS.map(([id, path]) => {
  const p = loadChamp(W, path);
  if (!p) { console.error('⛔ 包读不出：' + path); process.exit(2); }
  return { id: 'H:' + id, chooser: T.policyChooserN(p, 0.15) };
});
const OPPS = R_OPPS.concat(H_OPPS);
const FLAT = [];
for (const [sid, spath] of SUBJECTS) for (const opp of OPPS) FLAT.push({ sid, spath, opp });

function runPair(i) {
  const { sid, spath, opp } = FLAT[i];
  const subj = loadChamp(W, spath);
  if (!subj) { console.error('⛔ 主体读不出：' + spath); process.exit(2); }
  const r = duelAssembly({ S, Play, T, R }, subj,
    { games: GAMES, mode: 'multi', seed0: SEED0, n: 2, scripted: opp.chooser });
  console.log('PAIR ' + i + ' ' + sid + ' ' + opp.id + ' ' + r.champRate.toFixed(2) + ' ' + r.winRate.toFixed(2) + ' ' + r.drawPct.toFixed(2) + ' ' + r.avgRounds.toFixed(1));
}

if (PAIR_ONLY >= 0) { runPair(PAIR_ONLY); process.exit(0); }

/* 父进程：fork 全部配对，jobs 路进程池 */
console.log('背诵对照探针 ‖ 每配对 ' + GAMES + ' 局（n=2 席位轮换） ‖ seed0=' + SEED0 +
  ' ‖ R=' + R_OPPS.length + ' 名册脚本 ‖ H=' + H_OPPS.length + ' 非名册包 ‖ 配对 ' + FLAT.length + ' ‖ jobs=' + JOBS);
const pairs = [];
let idx = 0, done = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, FLAT.length) }, async () => {
  while (idx < FLAT.length) {
    const i = idx++;
    const { stdout } = await execFileP('node', [fileURLToPath(import.meta.url), '--games=' + GAMES, '--pair=' + i], { cwd: process.cwd(), maxBuffer: 1 << 24 });
    const line = stdout.split('\n').find((l) => l.startsWith('PAIR ' + i + ' '));
    if (!line) throw new Error('子进程没有吐配对行 #' + i);
    const [, , sid, oppId, sw, ow, dw, rd] = line.split(/\s+/);
    pairs.push({ i, sid, oppId, set: oppId[0], subjWin: +sw, oppWin: +ow, draw: +dw, rounds: +rd });
    done++;
    if (done % 6 === 0 || done === FLAT.length) console.log('[' + done + '/' + FLAT.length + ']');
  }
}));
pairs.sort((a, b) => a.i - b.i);
for (const sid of SUBJECTS.map((s) => s[0])) {
  const rows = pairs.filter((p) => p.sid === sid);
  for (const p of rows) {
    console.log('  ' + sid.padEnd(16) + ' vs ' + p.oppId.padEnd(18) +
      ' 主体胜 ' + p.subjWin.toFixed(1) + '% ‖ 对手 ' + p.oppWin.toFixed(1) + '% ‖ 平 ' + p.draw.toFixed(1) +
      '% ‖ 局均回合 ' + p.rounds.toFixed(1));
  }
  const avg = (set) => rows.filter((x) => x.set === set).reduce((a, x) => a + x.subjWin, 0) / Math.max(1, rows.filter((x) => x.set === set).length);
  const rAvg = avg('R'), hAvg = avg('H');
  console.log('== ' + sid + ' ‖ 名册R均 ' + rAvg.toFixed(1) + '% ‖ 非名册H均 ' + hAvg.toFixed(1) + '% ‖ **Gap=' + (rAvg - hAvg).toFixed(1) + 'pt**');
}
console.log('\n=== 汇总（Gap = 名册胜率 − 非名册胜率；Gap 显著高于对照 ⇒ 背诵实锤） ===');
for (const sid of SUBJECTS.map((s) => s[0])) {
  const rows = pairs.filter((p) => p.sid === sid);
  const avg = (set) => rows.filter((x) => x.set === set).reduce((a, x) => a + x.subjWin, 0) / Math.max(1, rows.filter((x) => x.set === set).length);
  console.log(sid.padEnd(16) + ' R ' + avg('R').toFixed(1) + '% ‖ H ' + avg('H').toFixed(1) + '% ‖ Gap ' + (avg('R') - avg('H')).toFixed(1) + 'pt');
}
