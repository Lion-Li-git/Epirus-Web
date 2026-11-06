/* §E168 仪器：把"开档的风格代价"从脚本桌复量到**人类形状桌**
 *
 * 为什么要这一台（今晚最大的一条自我质疑）：§E156b/§E161/§E164 所有"风格代价"的读数都是在 `field=mixed` 上量的，
 *   而那四席对手是 `bots.js` 的脚本 ⇒ 对手行为接近确定性。DS 的质疑正是"实验室桌与产品桌不是一回事"。
 *   ⇒ 风格那几列（蓄能 / 电磁炮 / 防御占比 / 集中度）到底是"开档的固有代价"，还是"在脚本桌上才成立的形状"？
 *   这一台把**对手换成 §E152e 的人类形状经验分布抽样**，其余口径（同一装配、同一 ε 斜坡、同一套度量、同一批种子带）**一字不动**。
 *
 * 三份单一来源（这就是为什么把采样器提进 `tools/`）：
 *   度量 = `tools/behavior-profile.mjs` 的 `fieldProfile/tallyPick/share/conc`；对手 = `tools/human-pool.mjs` 的 `loadPool/makeMimic`；
 *   装配 = 还是 `fieldProfile` 那一套（1 主体席 + 4 对手席、5 局一块轮完席位）。本仪器自己**不写一份计数、也不写一份采样**。
 *
 * 用法：node docs/artifacts/e168-style-human.mjs [--src=human|ai] [--tgt=rand] [--arms=0,1:0:0,1:0:1]
 *       [--games=600] [--eps=0.2] [--epsmode=soft] [--seed=4100] [--boot=2000]
 * ⚠ 顺带一条：人类形状桌**不经过 `bots.js`** ⇒ 本班 §E165/§E167 那条"脚本席 `__mem` 跨局残留"的协议依赖在这里天然不存在。
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, share, conc, WIN } from '../../tools/behavior-profile.mjs';
import { loadPool, makeMimic } from '../../tools/human-pool.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const ARMS = String(flag('arms', '0,1:0:0,1:0:1')).split(',').map(s => s.trim()).filter(s => /^(0|[1-3]:[0-2](:[0-1])?)$/.test(s));
const EPS = Number(flag('eps', 0.2));
const MODE = flag('epsmode', 'soft');
const GAMES = Number(flag('games', 600));
const SEED = Number(flag('seed', 4100));
const BOOT = Number(flag('boot', 2000));
const SRC = flag('src', 'human');
const TGT = flag('tgt', 'rand');
const CHAMP = flag('champion', 'js/bundled-champion-3p.js');
const GAMEMODE = flag('gamemode', 'multi');
const T = WIN.EpirusTrainer, SK = WIN.EpirusRules.SK;
const BLOCK = 5;
const NB = Math.max(1, Math.floor(GAMES / BLOCK));

const params = loadChamp(WIN, CHAMP, ROOT);
const pool = loadPool(WIN, SRC);
console.log('== §E168 人类形状桌上的风格复量（对手池 = ' + SRC + ' 经验分布 · ' + pool.conds + ' 个条件键 · 抽样质量 ' + pool.tot +
  ' 手 · 来自 ' + pool.games + ' 局日志）==');
console.log('   装配：' + (NB * BLOCK) + ' 局 = ' + NB + ' 块 × ' + BLOCK + '（每块轮完 0~4 号位）· ε=' + EPS + ' ' + MODE +
  ' · gamemode=' + GAMEMODE + ' · 指向=' + TGT + ' · seed0=' + SEED + ' · 配对自助 ' + BOOT + ' 次');
console.log('   臂 = `ply:tgt:tie`（`0`=关档；其余=主体席开档）‖ 度量全走 `behavior-profile`，采样全走 `tools/human-pool.mjs`');

function runArm(spec) {
  const off = spec === '0';
  const p = spec.split(':');
  const ply = off ? 1 : Number(p[0] || 1);
  const tgt = off ? 0 : Number(p[1] || '0');
  const tie = off ? 0 : Number((p[2] || '0'));
  if (off) T.setBeliefSearch(0);
  else { T.setBeliefSearch(1); T.setBeliefPly(ply); T.setBeliefTarget(tgt); T.setBeliefTie(tie); }
  /* 每个 (块, 局, 席位) 一条**独立且可重现**的随机流 ⇒ 两臂面对的是同一串抽样（配对成立的那一半） */
  const factory = function (seed0) {
    return function (g, i) { return makeMimic(WIN, pool, TGT, T.mulberry32((seed0 + g * 7919 + i * 104729) >>> 0)); };
  };
  fieldProfile(params, EPS, MODE, BLOCK, SEED + 991, 'mixed', GAMEMODE, factory(SEED + 991));   /* 暖机一块（§E165/§E167：换档后第一次调用不同） */
  const blocks = [];
  const t0 = process.hrtime.bigint();
  for (let b = 0; b < NB; b++) {
    const s0 = SEED + b * BLOCK * 997;
    blocks.push(fieldProfile(params, EPS, MODE, BLOCK, s0, 'mixed', GAMEMODE, factory(s0)));
  }
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  T.setBeliefSearch(0); T.setBeliefTie(0); T.setBeliefPly(1); T.setBeliefTarget(0);
  return { arm: spec, off: off, blocks: blocks, acts: blocks.reduce((a, t) => a + t.acts, 0), wallMs: wallMs };
}
const add = (bs, k) => bs.reduce((a, t) => a + t[k], 0);
const METRICS = [
  ['胜率', t => t.wins, t => BLOCK], ['昏手', t => t.voided, t => t.acts],
  ['防御', t => t.def, t => t.acts], ['攻击', t => t.atk, t => t.acts], ['环', t => t.ring, t => t.acts], ['ジ', t => t.ji, t => t.acts],
  ['集火(连段)', t => t.focus, t => t.tgtActs], ['落点集中', t => t.tgtTopSum, t => t.tgtGames], ['打几家', t => t.tgtKindSum, t => t.tgtGames],
  ['蓄能/局', t => (t.keys[SK.CHARGE] || 0), t => BLOCK], ['电磁炮/局', t => (t.keys[SK.RAILGUN] || 0), t => BLOCK],
  ['大雷/局', t => (t.keys[SK.BIG_T] || 0), t => BLOCK], ['贴贴/局', t => (t.keys[SK.CURSE] || 0), t => BLOCK],
  ['局长', t => t.rounds, t => BLOCK]
];
function agg(bs, m) { let n = 0, e = 0; for (const t of bs) { n += m[1](t); e += m[2](t); } return e ? n / e : 0; }
function boot(a, b, m) {
  const ds = [];
  const A = new Array(NB), B = new Array(NB);
  for (let r = 0; r < BOOT; r++) {
    for (let i = 0; i < NB; i++) { const j = Math.floor(Math.random() * NB); A[i] = a.blocks[j]; B[i] = b.blocks[j]; }
    ds.push(agg(A, m) - agg(B, m));
  }
  ds.sort((x, y) => x - y);
  return [ds[Math.floor(0.025 * BOOT)], ds[Math.floor(0.975 * BOOT)]];
}
const runs = ARMS.map(runArm);
const base = runs[0];
for (const r of runs) {
  const tag = r.off ? '0（关档基线）' : 'ply=' + (r.arm.split(':')[0]) + ' tgt=' + (r.arm.split(':')[1] || 0) + ' tie=' + (r.arm.split(':')[2] || 0);
  console.log('  ' + tag.padEnd(20) + ' 每决策 ' + (r.wallMs / Math.max(1, r.acts)).toFixed(2) + ' ms（本机 node · ' + r.acts + ' 次出手 / ' + r.wallMs.toFixed(0) + ' ms）');
  const parts = [];
  for (const m of METRICS) {
    const isPct = m[0] !== '打几家' && m[0] !== '局长' && m[0].indexOf('/局') < 0;
    const v = agg(r.blocks, m), fmt = x => isPct ? (100 * x).toFixed(1) + '%' : (m[0] === '局长' || m[0] === '打几家' ? x.toFixed(1) : x.toFixed(2));
    let s = m[0] + ' ' + fmt(v);
    if (r !== base) {
      const [lo, hi] = boot(r, base, m);
      const mul = isPct ? 100 : 1;
      const d = (v - agg(base.blocks, m)) * mul, l = lo * mul, h = hi * mul;
      s += '（配对差 ' + (d >= 0 ? '+' : '') + d.toFixed(2) + ' [' + l.toFixed(2) + ',' + h.toFixed(2) + ']' + (l <= 0 && h >= 0 ? ' 含0' : (d > 0 ? ' ▲' : ' ▼')) + '）';
    }
    parts.push(s);
  }
  console.log('    ' + parts.join('  '));
}
console.log('\n  ⚠ 读法：与脚本桌那一版（§E161/§E164）对照**只能对照方向与量级**——两批桌子的对手不同，绝对值本来就不可比；');
console.log('    要判"风格代价是不是脚本桌专有"，看的是**开档臂相对关档臂的那几个配对差的符号与大小**。');
