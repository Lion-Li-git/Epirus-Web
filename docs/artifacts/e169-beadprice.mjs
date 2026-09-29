/* §E169 仪器：第 4 剂药——**给"跨回合资源本身"定价**，在**两张桌**上配对复量
 *
 * 为什么要这一台：§E156b/§E161 的三剂药（深度 `ply` / 定价对象 `tgt` / 平票规则 `tie`）**没有一剂碰过资源本身**，
 *   而 §E168 之后立着的两条代价恰好就是它：**珠经济归零**与**滚环消失**。⇒ 直接把这两样东西折算进终局价值：
 *   `bead` = 一枚带进下一回合的珠值几血（`setBeliefBead`）、`ring` = "环链条还活着"值几血（`setBeliefRingPrice`）。
 *   这是"状态价值头"最便宜的替身：**手写一个价**，看它能不能既买回风格又不赔胜率。
 *
 * ⚠ 这台仪器**自带一道反证**（不是只看"蓄能变多了"）：珠的三条去路分开数 ⇒ **转化率 = 消耗/获得**、**过期率 = 过期/获得**。
 *   若 `bead>0` 把 `蓄能/局` 抬起来而 `电磁炮/局` 仍 ~0 ⇒ 那不是修好了长程，是**近视定价的退化形状"只攒不打"**（DS 在 B4 里的判据正是"过期率不得上升"）。
 *
 * 单一来源（第 19 条陷阱 + D209 的规矩）：度量 = `tools/behavior-profile.mjs` 的 `fieldProfile/share/conc`；
 *   人类形状对手 = `tools/human-pool.mjs` 的 `loadPool/makeMimic`；本仪器**不写一份计数、也不写一份采样**。
 *   ⇒ 每张桌都必须跑：脚本桌（`bots.js` 四席）与人类形状桌（经验分布抽样）——**风格列是桌形的函数**，一张桌不够。
 *
 * 用法：node docs/artifacts/e169-beadprice.mjs [--table=both] [--arms=0,1:0:0:4:0,1:0:0:8:0,1:0:0:0:4,1:0:0:8:4]
 *       [--games=600] [--eps=0.2] [--epsmode=soft] [--seed=4100] [--boot=2000] [--src=human] [--tgt=rand]
 * 臂 = `ply:tgt:tie:bead:ring`（`0` = 关档基线；缺的字段按 0 补 ⇒ 与 §E161/§E168 的短写法逐字兼容）。
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, WIN } from '../../tools/behavior-profile.mjs';
import { loadPool, makeMimic } from '../../tools/human-pool.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const ARMS = String(flag('arms', '0,1:0:0:0:0,1:0:0:1:0,1:0:0:2:0,1:0:1:1:0,1:0:0:0:2,1:0:0:0:4'))
  .split(',').map(s => s.trim()).filter(s => /^(0|[1-3]:[0-2]:[0-1]:[0-9]+:[0-9]+)$/.test(s));
const EPS = Number(flag('eps', 0.2));
const MODE = flag('epsmode', 'soft');
const GAMES = Number(flag('games', 600));
const SEED = Number(flag('seed', 4100));
const BOOT = Number(flag('boot', 2000));
const SRC = flag('src', 'human');
const TGT = flag('tgt', 'rand');
const CHAMP = flag('champion', 'js/bundled-champion-3p.js');
const GAMEMODE = flag('gamemode', 'multi');
const TABLES = flag('table', 'both');
const BASE = Number(flag('base', 0));   /* 配对差的参照臂下标：0=关档；1=出厂开档那版 ⇒ 想问"这一剂本身值多少"就 --base=1 */
const T = WIN.EpirusTrainer, SK = WIN.EpirusRules.SK;
const BLOCK = 5;
const NB = Math.max(1, Math.floor(GAMES / BLOCK));

const params = loadChamp(WIN, CHAMP, ROOT);
const pool = loadPool(WIN, SRC);

const METRICS = [
  ['胜率', t => t.wins, t => BLOCK, 'pct'], ['昏手', t => t.voided, t => t.acts, 'pct'],
  ['防御', t => t.def, t => t.acts, 'pct'], ['攻击', t => t.atk, t => t.acts, 'pct'], ['环', t => t.ring, t => t.acts, 'pct'],
  ['ジ', t => t.ji, t => t.acts, 'pct'],
  ['集火(连段)', t => t.focus, t => t.tgtActs, 'pct'], ['落点集中', t => t.tgtTopSum, t => t.tgtGames, 'pct'],
  ['打几家', t => t.tgtKindSum, t => t.tgtGames, 'n1'],
  ['蓄能/局', t => (t.keys[SK.CHARGE] || 0), t => BLOCK, 'n2'], ['电磁炮/局', t => (t.keys[SK.RAILGUN] || 0), t => BLOCK, 'n2'],
  ['珠/局获得', t => t.beadGain, t => BLOCK, 'n2'], ['珠/局消耗', t => t.beadSpend, t => BLOCK, 'n2'], ['珠/局过期', t => t.beadExpire, t => BLOCK, 'n2'],
  ['珠转化率', t => t.beadSpend, t => t.beadGain, 'pct'],
  /* §E169b 的两把分开的尺（读 `tallyPick` 的三个计数器，仪器自己**不判可付性**）：
     `有珠买不起炮率` = B 机制（蓄能把自己吃穷，`2 ep + 1 电珠` 凑不齐）‖ `有珠不开炮率` = A 机制（凑得齐却选择继续屯）。 */
  ['有珠买不起炮', t => t.beadBroke, t => t.beadLive, 'pct'],
  ['有珠不开炮', t => t.beadHeld, t => t.beadLive - t.beadBroke, 'pct'],
  /* 「屯而不打」与「没钱打」必须分开：`峰值ep` 高 ⇒ 能量一直有、珠也一直在，它就是不开炮（真退化）；
     `峰值ep` 掉到 0~2 ⇒ 是"蓄能把自己吃穷了"，那是另一回事（电磁炮要 2 ep + 1 电珠）。 */
  ['峰值ep', t => t.maxEp, t => 1, 'n1'],
  ['大雷/局', t => (t.keys[SK.BIG_T] || 0), t => BLOCK, 'n2'], ['局长', t => t.rounds, t => BLOCK, 'n1']
];
function agg(bs, m) { let n = 0, e = 0; for (const t of bs) { n += m[1](t); e += m[2](t); } return e ? n / e : 0; }
/* ⚠ 自助重抽样**必须播种**：§E154~§E168 那几台仪器的区间用 `Math.random()` ⇒ 点估计逐字可复现、**区间端点每跑一次抖一点**
   （实测 §E168 的 +11.67pt 两次给出 [7.00,16.50] 与 [7.17,16.33]）。那一版已经进过裁定材料，改动它=重跑全部历史表 ⇒ 只在**这一台**上修，
   并把那条事实记进日志（第 20 条陷阱）。 */
function boot(a, b, m, mi) {
  const rnd = T.mulberry32(((SEED ^ (mi * 2654435761) ^ 0x5bf03635) >>> 0) + 1);
  const ds = [];
  const A = new Array(NB), B = new Array(NB);
  for (let r = 0; r < BOOT; r++) {
    for (let i = 0; i < NB; i++) { const j = Math.floor(rnd() * NB); A[i] = a.blocks[j]; B[i] = b.blocks[j]; }
    ds.push(agg(A, m) - agg(B, m));
  }
  ds.sort((x, y) => x - y);
  return [ds[Math.floor(0.025 * BOOT)], ds[Math.floor(0.975 * BOOT)]];
}
function runArm(spec, factory) {
  const off = spec === '0';
  const p = spec.split(':');
  const ply = off ? 1 : Number(p[0] || 1);
  const tgt = off ? 0 : Number(p[1] || '0');
  const tie = off ? 0 : Number(p[2] || '0');
  const bead = off ? 0 : Number(p[3] || '0');
  const ringp = off ? 0 : Number(p[4] || '0');
  if (off) T.setBeliefSearch(0);
  else { T.setBeliefSearch(1); T.setBeliefPly(ply); T.setBeliefTarget(tgt); T.setBeliefTie(tie); T.setBeliefBead(bead); T.setBeliefRingPrice(ringp); }
  fieldProfile(params, EPS, MODE, BLOCK, SEED + 991, 'mixed', GAMEMODE, factory(SEED + 991));   /* 暖机一块（§E165/§E167） */
  const blocks = [];
  const t0 = process.hrtime.bigint();
  for (let b = 0; b < NB; b++) {
    const s0 = SEED + b * BLOCK * 997;
    blocks.push(fieldProfile(params, EPS, MODE, BLOCK, s0, 'mixed', GAMEMODE, factory(s0)));
  }
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  T.setBeliefSearch(0); T.setBeliefTie(0); T.setBeliefPly(1); T.setBeliefTarget(0); T.setBeliefBead(0); T.setBeliefRingPrice(0);
  return { arm: spec, off: off, blocks: blocks, acts: blocks.reduce((a, t) => a + t.acts, 0), wallMs: wallMs };
}
function runTable(which) {
  /* 两张桌**只差对手席**：脚本桌 `oppFactory=null`（走 `bots.js`），人类形状桌走 `makeMimic`。
     种子带、块切法、ε、主体席装配全部同一 ⇒ 配对差可以跨臂比，绝对值只在同桌内比。 */
  const factory = which === 'script'
    ? function () { return undefined; }
    : function (seed0) { return function (g, i) { return makeMimic(WIN, pool, TGT, T.mulberry32((seed0 + g * 7919 + i * 104729) >>> 0)); }; };
  console.log('\n===桌：' + (which === 'script' ? '脚本桌（四席 `bots.js`，行为接近确定性）'
    : '人类形状桌（' + SRC + ' 经验分布 ' + pool.tot + ' 手 / ' + pool.games + ' 局 / ' + pool.conds + ' 个条件键 · 指向 ' + TGT + '）') + '===');
  const runs = ARMS.map(function (s) { return runArm(s, factory); });
  const base = runs[BASE];
  if (!base) { console.log('  --base= 越界（臂只有 ' + runs.length + ' 个）'); return; }
  console.log('  参照臂 = `' + base.arm + '`（配对差都是相对它算的）');
  for (const r of runs) {
    console.log('  臂 ' + r.arm.padEnd(14) + ' 每决策 ' + (r.wallMs / Math.max(1, r.acts)).toFixed(2) + ' ms');
    const parts = [];
    let mi = 0;
    for (const m of METRICS) {
      const pct = m[3] === 'pct';
      const fmt = x => pct ? (100 * x).toFixed(1) + '%' : x.toFixed(m[3] === 'n1' ? 1 : 2);
      let s = m[0] + ' ' + fmt(agg(r.blocks, m));
      if (r !== base) {
        const [lo, hi] = boot(r, base, m, mi);
        const mul = pct ? 100 : 1;
        const d = (agg(r.blocks, m) - agg(base.blocks, m)) * mul, l = lo * mul, h = hi * mul;
        s += '（配对差 ' + (d >= 0 ? '+' : '') + d.toFixed(2) + ' [' + l.toFixed(2) + ',' + h.toFixed(2) + ']' +
          (l <= 0 && h >= 0 ? ' 含0' : (d > 0 ? ' ▲' : ' ▼')) + '）';
      }
      parts.push(s);
      mi++;
    }
    console.log('    ' + parts.join('  '));
  }
}
console.log('== §E169 给"珠/环"定价：' + (NB * BLOCK) + ' 局/臂 = ' + NB + ' 块 × ' + BLOCK + '（每块轮完 0~4 号位）· ε=' + EPS + ' ' + MODE +
  ' · seed0=' + SEED + ' · 配对自助 ' + BOOT + ' 次 · 臂=' + ARMS.join(' / ') + ' ==');
console.log('   出厂形状 = 臂 `0`（关档）‖ `1:0:0:0:0` = 开档且两价都为 0 ⇒ **应与 §E161/§E168 那一版逐字同臂**');
for (const w of (TABLES === 'both' ? ['script', 'human'] : [TABLES])) runTable(w);
