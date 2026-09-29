/* §E161/§E161b/§E161c/§E164 配对仪器：开档的三剂药各自买到什么、代价是什么
 *
 * 背景（为什么要配对而不是各跑各的）：`tools/behavior-profile.mjs` 的绝对读数**每跑一次都换种子带**，
 *   同一档两次跑集火能从 26.5% 摆到 23.4%（09-30 01:3x 实测）⇒ 拿两次的差来判断"有没有修好"是拿噪声当效应。
 *   本仪器让**各臂跑在同一批牌上**：把总局数切成 5 局一块（一块正好轮完 0~4 号位），
 *   块 b 的 `seed0 = seed + b·5·997` ⇒ 块内第 g 局的 rng 种子 = `seed + (5b+g)·997`，
 *   与工具自身 `--games` 那条种子带**逐字同形**（b=0 那五局就是工具的前五局）⇒ "配对"这件事能在纸上证。
 * 判据（§E156b 定的三条 + §E161 加的一条）：电磁炮/局、蓄能/局、集火（以及 §E164 新加的**落点集中度**）要回到关档量级；
 *   且胜率不得掉回关档以下。
 * ⚠ **所有度量算术都从 `tools/behavior-profile.mjs` 拿**（`fieldProfile` / `share` / `conc` / 它那份 tally 形状）——
 *   本仪器不许出现第二份"昏手率/集中度"的算法，本仓的账是"两份同构实现必漂移"（今晚已应验五次）。
 *
 * 用法：node docs/artifacts/e161-ply.mjs [--arms=0,1:0:0,1:0:1] [--games=600] [--eps=0.2] [--epsmode=soft]
 *       [--seed=4100] [--boot=2000] [--champion=js/bundled-champion-3p.js] [--field=mixed] [--gamemode=multi]
 *       臂 = `ply:tgt:tie`（`0` = 关档）：tgt 0=减存活对手均值 · 1=减最强活着的那个 · 2=均值+每次淘汰 6 血
 *                                 tie 0=平票取枚举顺序第一个 · 1=平票交给网络打分
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, conc, WIN } from '../../tools/behavior-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const ARMS = String(flag('arms', '0,1:0:0,1:0:1')).split(',').map(s => s.trim()).filter(s => /^(0|[1-3]:[0-2](:[0-1])?)$/.test(s));
const EPS = Number(flag('eps', 0.2));
const MODE = flag('epsmode', 'soft');
const GAMES = Number(flag('games', 600));
const SEED = Number(flag('seed', 4100));
const BOOT = Number(flag('boot', 2000));
const CHAMP = flag('champion', 'js/bundled-champion-3p.js');
const FIELD = flag('field', 'mixed');
const GAMEMODE = flag('gamemode', 'multi');
const T = WIN.EpirusTrainer, SK = WIN.EpirusRules.SK;
const BLOCK = 5;                                   /* 一块 = 5 局 ⇒ 席位轮转一遍 */
const NB = Math.max(1, Math.floor(GAMES / BLOCK));
const params = loadChamp(WIN, CHAMP, ROOT);

/* ---- 度量 = "一批块 → 一个数"的纯函数（分子分母都在这台仪器外面那份实现里数出来的） ---- */
const ratio = function (k, d) {
  return function (bs) {
    let n = 0, e = 0;
    for (const t of bs) { n += (k.indexOf('n:') === 0 ? (t.keys[k.slice(2)] || 0) : t[k]); e += (d === 'games' ? BLOCK : t[d]); }
    return e ? n / e : 0;
  };
};
const concOf = function (which) {
  return function (bs) {
    let g = 0, s = 0, kk = 0;
    for (const t of bs) { g += t.tgtGames; s += t.tgtTopSum; kk += t.tgtKindSum; }
    const c = conc({ tgtGames: g, tgtTopSum: s, tgtKindSum: kk });
    return c ? (which === 'top' ? c.top / 100 : c.kinds) : 0;
  };
};
const M = [
  ['胜率', ratio('wins', 'games'), 'pct'], ['局长', ratio('rounds', 'games'), 'avg'], ['昏手', ratio('voided', 'acts'), 'pct'],
  ['防御', ratio('def', 'acts'), 'pct'], ['攻击', ratio('atk', 'acts'), 'pct'], ['环', ratio('ring', 'acts'), 'pct'], ['ジ', ratio('ji', 'acts'), 'pct'],
  ['集火(连段)', ratio('focus', 'tgtActs'), 'pct'],
  ['落点集中', concOf('top'), 'pct'], ['打几家', concOf('kinds'), 'avg'],
  ['电磁炮/局', ratio('n:' + SK.RAILGUN, 'games'), 'pg'], ['蓄能/局', ratio('n:' + SK.CHARGE, 'games'), 'pg'],
  ['大雷/局', ratio('n:' + SK.BIG_T, 'games'), 'pg'], ['贴贴/局', ratio('n:' + SK.CURSE, 'games'), 'pg'],
  ['天火/局', ratio('n:' + SK.FIRESTORM, 'games'), 'pg'], ['激光眼/局', ratio('n:' + SK.LASER_EYE, 'games'), 'pg']
];

function runArm(spec) {
  const off = spec === '0';
  const p = spec.split(':');
  const ply = off ? 1 : Number(p[0] || 1);
  const tgt = off ? 0 : Number(p[1] || '0');
  const tie = off ? 0 : Number((p[2] || '0'));
  if (off) { T.setBeliefSearch(0); } else { T.setBeliefSearch(1); T.setBeliefPly(ply); T.setBeliefTarget(tgt); T.setBeliefTie(tie); }
  const blocks = [];
  const t0 = process.hrtime.bigint();
  for (let b = 0; b < NB; b++) blocks.push(fieldProfile(params, EPS, MODE, BLOCK, SEED + b * BLOCK * 997, FIELD, GAMEMODE));
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  T.setBeliefSearch(0); T.setBeliefTarget(0); T.setBeliefPly(1); T.setBeliefTie(0);
  return { arm: spec, ply: ply, tgt: tgt, tie: tie, off: off, blocks: blocks, wallMs: wallMs, acts: blocks.reduce((a, t) => a + t.acts, 0) };
}

/* 配对自助：各臂共用同一组块下标 ⇒ 抽到的永远是"同一批牌上的两臂"。见下面 bootDelta（度量函数只认 blocks）。 */

console.log('== §E161/§E164 配对（' + CHAMP.replace(/^.*\//, '') + ' · ε=' + EPS + ' ' + MODE + ' · ' + FIELD + '/' + GAMEMODE +
  ' · ' + (NB * BLOCK) + ' 局 = ' + NB + ' 块 × ' + BLOCK + '（每块轮完 0~4 号位）· seed0=' + SEED + ' · 配对自助 ' + BOOT + ' 次）==');
console.log('   臂 = `ply:tgt:tie`（tgt 0=减存活对手均值 · 1=减最强活着的那个 · 2=均值+每次淘汰 6 血；tie 0=平票取枚举顺序第一个 · 1=交给网络打分；`0`=关档）· 基线 = 第一臂（' + ARMS[0] + '）');

const runs = [];
for (const spec of ARMS) runs.push(runArm(spec));
const base = runs[0];

/* 自助聚合：对每个重抽样批次，把选中的块交给**同一个度量函数**（度量函数只认 blocks ⇒ 天然配对） */
function bootDelta(a, b, fn) {
  const ds = [];
  const A = new Array(NB), B = new Array(NB);
  for (let r = 0; r < BOOT; r++) {
    for (let i = 0; i < NB; i++) { const j = Math.floor(Math.random() * NB); A[i] = a.blocks[j]; B[i] = b.blocks[j]; }
    ds.push(fn(A) - fn(B));
  }
  ds.sort((x, y) => x - y);
  return [ds[Math.floor(0.025 * BOOT)], ds[Math.floor(0.975 * BOOT)]];
}

for (const r of runs) {
  const tag = r.arm === '0' ? '0（关档基线）' : 'ply=' + r.ply + ' tgt=' + r.tgt + ' tie=' + r.tie;
  console.log('  ' + tag.padEnd(18) + ' 每决策 ' + (r.wallMs / Math.max(1, r.acts)).toFixed(2) + ' ms（本机 node，' +
    r.acts + ' 次搜索决策 / ' + r.wallMs.toFixed(0) + ' ms）');
  const parts = [];
  for (const [label, fn, kind] of M) {
    const mul = kind === 'pct' ? 100 : 1;
    const fmt = (x) => kind === 'pct' ? (100 * x).toFixed(1) + '%' : x.toFixed(kind === 'avg' ? 1 : 2);
    const v = fn(r.blocks), bv = fn(base.blocks);
    let s = label + ' ' + fmt(v);
    if (r !== base) {
      const [lo, hi] = bootDelta(r, base, fn);
      const dl = (v - bv) * mul, l = lo * mul, h = hi * mul;
      s += '（配对差 ' + (dl >= 0 ? '+' : '') + dl.toFixed(2) + ' [' + l.toFixed(2) + ',' + h.toFixed(2) + ']' +
        (l <= 0 && h >= 0 ? ' 含0' : (dl > 0 ? ' ▲' : ' ▼')) + '）';
    }
    parts.push(s);
  }
  console.log('    ' + parts.join('  '));
}
