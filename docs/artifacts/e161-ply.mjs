/* §E161 配对仪器：信念搜索的"评估深度"（ply）到底修好了 §E156b 的哪几列
 *
 * 背景（为什么要配对而不是各跑各的）：`tools/behavior-profile.mjs` 的绝对读数**每跑一次都换种子带**，
 *   同一档两次跑集火能从 26.5% 摆到 23.4%（09-30 01:3x 实测）⇒ 拿两次的差来判断"2-ply 有没有修好集火"
 *   是拿噪声当效应。本仪器让**各档跑在同一批牌上**：把总局数切成 5 局一块（一块正好轮完 0~4 号位），
 *   块号 b 的 seed0 = seed + b*5*997 ⇒ 块内第 g 局的 rng 种子 = seed + (5b+g)*997，
 *   与工具自身 `--games` 那条种子带**逐字同形**（b=0 那五局就是工具的默认前五局），
 *   所以"配对"是同一副牌、同一席位轮转、只有策略不同。
 * 判据（§E156b 定死的三条，不是"胜率再涨"）：电磁炮/局、蓄能/局、集火 三列**回到关档的量级**才算修好；
 *   配对差连 95% 区间一起给，区间含 0 就写"分不开"。
 *
 * 用法：node docs/artifacts/e161-ply.mjs [--arms=0,1,2] [--games=600] [--eps=0.2] [--epsmode=soft]
 *       [--seed=4100] [--boot=2000] [--champion=js/bundled-champion-3p.js]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, WIN } from '../../tools/behavior-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const ARMS = String(flag('arms', '0,1,2')).split(',').map(Number).filter(n => isFinite(n));
const EPS = Number(flag('eps', 0.2));
const MODE = flag('epsmode', 'soft');
const GAMES = Number(flag('games', 600));
const SEED = Number(flag('seed', 4100));
const BOOT = Number(flag('boot', 2000));
const CHAMP = flag('champion', 'js/bundled-champion-3p.js');
const FIELD = flag('field', 'mixed');
const GAMEMODE = flag('gamemode', 'multi');
const T = WIN.EpirusTrainer, R = WIN.EpirusRules, SK = R.SK;
const BLOCK = 5;                                   /* 一块 = 5 局 ⇒ 席位轮转一遍 */
const NB = Math.max(1, Math.floor(GAMES / BLOCK));

const params = loadChamp(WIN, CHAMP, ROOT);
const M = [
  ['胜率', 'wins', 'games', 'pct'], ['局长', 'rounds', 'games', 'avg'], ['昏手', 'voided', 'acts', 'pct'],
  ['防御', 'def', 'acts', 'pct'], ['攻击', 'atk', 'acts', 'pct'], ['环', 'ring', 'acts', 'pct'], ['ジ', 'ji', 'acts', 'pct'],
  ['集火', 'focus', 'tgtActs', 'pct'],
  ['电磁炮/局', 'n:' + SK.RAILGUN, 'games', 'pg'], ['蓄能/局', 'n:' + SK.CHARGE, 'games', 'pg'],
  ['大雷/局', 'n:' + SK.BIG_T, 'games', 'pg'], ['贴贴/局', 'n:' + SK.CURSE, 'games', 'pg'],
  ['天火/局', 'n:' + SK.FIRESTORM, 'games', 'pg'], ['激光眼/局', 'n:' + SK.LASER_EYE, 'games', 'pg']
];

/* 一臂 = 同一批块（同一副牌）上的逐块 tally。 */
function runArm(arm) {
  if (arm > 0) { T.setBeliefSearch(1); T.setBeliefPly(arm); } else { T.setBeliefSearch(0); }
  const blocks = [];
  const t0 = process.hrtime.bigint();
  for (let b = 0; b < NB; b++) blocks.push(fieldProfile(params, EPS, MODE, BLOCK, SEED + b * BLOCK * 997, FIELD, GAMEMODE));
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  T.setBeliefSearch(0);
  return { arm, blocks, wallMs, acts: blocks.reduce((a, t) => a + t.acts, 0) };
}
function den(t, d) { return d === 'games' ? BLOCK : t[d]; }
function num(t, k) { return k.indexOf('n:') === 0 ? (t.keys[k.slice(2)] || 0) : t[k]; }
function stat(blocks, d, k) { let n = 0, e = 0; for (const t of blocks) { n += num(t, k); e += den(t, d); } return e ? n / e : 0; }
function maxEp(blocks) { let m = 0; for (const t of blocks) if (t.maxEp > m) m = t.maxEp; return m; }

/* 配对自助：各臂共用同一组块下标 ⇒ 抽到的永远是"同一批牌上的两臂"。 */
function pairedBoot(a, b, d, k) {
  const deltas = [];
  for (let r = 0; r < BOOT; r++) {
    const pick = [];
    for (let i = 0; i < NB; i++) pick.push(Math.floor(Math.random() * NB));
    const f = (arr) => { let n = 0, e = 0; for (const i of pick) { const t = arr[i]; n += num(t, k); e += den(t, d); } return e ? n / e : 0; };
    deltas.push(f(a.blocks) - f(b.blocks));
  }
  deltas.sort((x, y) => x - y);
  return [deltas[Math.floor(0.025 * BOOT)], deltas[Math.floor(0.975 * BOOT)]];
}

const runs = [];
for (const arm of ARMS) runs.push(runArm(arm));
const base = runs.find(r => r.arm === (ARMS[0]));
console.log('== §E161 配对（' + CHAMP.replace(/^.*\//, '') + ' · ε=' + EPS + ' ' + MODE + ' · ' + FIELD + '/' + GAMEMODE +
  ' · ' + (NB * BLOCK) + ' 局 = ' + NB + ' 块 × ' + BLOCK + '（每块轮完 0~4 号位）· seed0=' + SEED + ' · 配对自助 ' + BOOT + ' 次）==');
for (const r of runs) {
  const tag = 'ply=' + r.arm + (r.arm === 0 ? '（关档基线）' : '');
  console.log('  ' + tag.padEnd(18) + ' 每决策 ' + (r.wallMs / Math.max(1, r.acts)).toFixed(2) + ' ms（本机 node，' +
    r.acts + ' 次搜索决策 / ' + r.wallMs.toFixed(0) + ' ms）  最大ep ' + maxEp(r.blocks));
  const parts = [];
  for (const [label, k, d, kind] of M) {
    const v = stat(r.blocks, d, k), bv = stat(base.blocks, d, k);
    const mul = kind === 'pct' ? 100 : 1;
    const fmt = (x) => kind === 'pct' ? (100 * x).toFixed(1) + '%' : x.toFixed(kind === 'avg' ? 1 : 2);
    let s = label + ' ' + fmt(v);
    if (r.arm !== base.arm) {
      const [lo, hi] = pairedBoot(r, base, d, k);
      const dl = (v - bv) * mul, l = lo * mul, h = hi * mul;
      s += '（配对差 ' + (dl >= 0 ? '+' : '') + dl.toFixed(2) + ' [' + l.toFixed(2) + ',' + h.toFixed(2) + ']' +
        (l <= 0 && h >= 0 ? ' 含0' : (dl > 0 ? ' ▲' : ' ▼')) + '）';
    }
    parts.push(s);
  }
  console.log('    ' + parts.join('  '));
}
