#!/usr/bin/node
/* ============================================================================
 * probe-5p-envfit.mjs —— §E142：**5 人局产品口径**的"环境 × 包"矩阵
 *
 * 为什么要有它：整晚所有"按环境换包值多少钱"的上界（§E129 的 +7.0pt [2.2, 11.9]）都是 **N=3 桌**的，
 * 而 §E133 已经证明 N=3 的结论搬到 5P 会翻号（+12.4pt → −1.9pt）⇒ **决策单 §四 那条"产品口径的环境矩阵"其实从未做过**。
 * §E141 顺手把它的成本从"1~1.5 小时"纠正成几分钟（实测吞吐 ≈ 531 局/秒）⇒ 没有理由不下这一格。
 *
 * 用法：
 *   node tools/probe-5p-envfit.mjs --pack=<粒> [--envs=<matrix.json>] [--games=60] [--seeds=0,1] [--n=5] [--out=<tsv>]
 *
 * ⚠ 三条口径约束（预注册写在 §E142 第 1/2 节）：
 *   1) **对手规则只许一份**：环境定义读 `regime-panel.mjs`（池内取 `OPP_SPECS` 的函数引用、池外取 `HELDOUT`），
 *      chooser 包装读 `bot-chooser-lib.mjs`（与 `eval-5p` 同一份）⇒ 本探针**不抄名字表、也不抄包装规则**。
 *   2) **配对成立**：一张桌子的种子只由 `(环境, seed档, 第几局)` 决定，**与"哪粒包"无关**
 *      ⇒ 同一环境在不同包之间面对逐位相同的桌子；`oracle − best_single` 才能按环境配对。
 *   3) **主体座位每局轮换 `g % n`**（eval-5p 的座位公平做法）⇒ 环境之间不会因为固定座位而互相错位。
 * ==========================================================================*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { HELDOUT, poolFromSpecs, heldFromNames } from './regime-panel.mjs';
import { makeAsChooser } from './bot-chooser-lib.mjs';

const arg = function (k, d) { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const MATRIX = arg('envs', 'docs/artifacts/e129-out/matrix.json');
const GAMES = Number(arg('games', 60));
const N = Number(arg('n', 5));
const SEEDS = String(arg('seeds', '0,1')).split(',').map(function (x) { return Number(x); });
const OUT = arg('out', '');
/* §E143：`--mix=<k>` —— 每桌 `k` 席用该原型、其余 `n−k` 席用 `random`。**默认 k = n−1 ⇒ 逐字就是 §E142 的"满席原型"构造**。
 * ⚠ 头部必须把 `k` 写进产物（`#mix=`）：`analyze-5p-envfit.mjs` 只认头部不认构造，两批产物若混在一个目录会同源不同义。 */
const MIX = arg('mix', '') === '' ? (N - 1) : Number(arg('mix', ''));

if (!PACK) { console.error('用法：--pack=<包路径>（缺了就拒绝，不许"默认用出厂包"混进矩阵）'); process.exit(2); }
if (!existsSync(PACK)) { console.error('--pack 指向的文件不存在: ' + PACK); process.exit(2); }
if (!Number.isFinite(GAMES) || GAMES < 1 || Math.floor(GAMES) !== GAMES) {
  console.error('--games 必须是 ≥1 的**整数**（实测 `' + arg('games', '60') + '`）⇒ 含糊剂量（2.5 局）会静默变成 3 局，分母就不是账面上那个数了');
  process.exit(2);
}
if (!(N >= 3 && N <= 5)) { console.error('本探针只支持 3~5 人局（实测 --n=' + N + '）'); process.exit(2); }
for (const s of SEEDS) if (!Number.isFinite(s)) { console.error('--seeds 里有非数字: ' + arg('seeds', '0,1')); process.exit(2); }
if (!Number.isFinite(MIX) || MIX < 1 || MIX > N - 1) {
  console.error('--mix 必须是 1 ~ n−1 的整数（实测 `' + MIX + '`，n=' + N + '）⇒ 不许 k=0（那等于没有原型）也不许 k=n（主体没地方站）');
  process.exit(2);
}

/* ---------- 引擎沙箱（与 eval-5p 同一份文件清单）---------- */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, P = W.EpirusPolicy;
const asChooser = makeAsChooser({ T: T, R: R });

/* ---------- 包 ---------- */
const src = readFileSync(PACK, 'utf8');
const mm = /window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
if (!mm) { console.error('包里找不到冠军外壳（EPIRUS_CHAMPION[_3P]）: ' + PACK); process.exit(2); }
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('包不兼容（维度/版本）: ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(2); }

/* ---------- 环境（单一来源）---------- */
const { pool, byFn } = poolFromSpecs(Bots, OPP_SPECS);
const held = heldFromNames(Bots, byFn, Object.keys(HELDOUT));
const byName = new Map();
for (const p of pool) byName.set(p.name, p);
for (const h of held) { byName.set(h.name, h); if (h.aliasOf && !byName.has(h.aliasOf)) byName.set(h.aliasOf, h); }

if (!existsSync(MATRIX)) { console.error('环境名单的来源矩阵不存在: ' + MATRIX + '（§E142 要求复用 §E129 那 33 个原型，不许另列）'); process.exit(2); }
const MJ = JSON.parse(readFileSync(MATRIX, 'utf8'));
const envNames = Object.keys((MJ.rows && MJ.rows[0] && MJ.rows[0].per) || {});
if (envNames.length < 10) { console.error('矩阵里读出的环境不足 10 个（实测 ' + envNames.length + '）⇒ 拒绝用半张名单算上界'); process.exit(2); }
const ENVS = [];
const missing = [];
for (const nm of envNames) {
  const e = byName.get(nm);
  if (!e || typeof e.sel !== 'function') { missing.push(nm); continue; }
  ENVS.push({ name: nm, sel: e.sel, inPool: e.inPool === true });
}
/* ⚠ 一个都不许静默丢：少了环境 = 分母变了 = `oracle − best_single` 与 §E129 不可比（这是 D200 钉的一条） */
if (missing.length) {
  console.error('有 ' + missing.length + ' 个环境在 regime-panel 里解析不到函数：' + missing.join(' ') +
    '（池内 ' + pool.length + ' ‖ 池外 ' + held.length + '）⇒ 拒绝出读数');
  process.exit(2);
}
/* `--mix` 的填充席也走同一份真源（不是新写一个"中立脚本"） */
const RANDOM_SEL = (byName.get('random') || {}).sel;
if (typeof RANDOM_SEL !== 'function') { console.error('填充席要用的 `random` 在 regime-panel 里解析不到函数 ⇒ 拒绝出读数'); process.exit(2); }

/* ---------- 桌子种子：**只看 (环境, seed档, 第几局)**，与包无关 ⇒ 跨包配对成立 ---------- */
function envSalt(name) { let h = 5381; for (let i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) >>> 0; return h; }

const rows = [];
let gamesRun = 0;
for (let ei = 0; ei < ENVS.length; ei++) {
  const env = ENVS[ei];
  const salt = envSalt(env.name);
  for (const sd of SEEDS) {
    let first = 0, strict = 0, n = 0;
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const gameSeed = (salt ^ (sd * 1000003)) + g * 977;
      const sel = T.policyChooserN(params, 0.15);
      const opp = asChooser(env.sel);
      const filler = asChooser(RANDOM_SEL);
      /* 对手席里哪几席摆原型：随局号**轮转**（与主体座位轮换同一套公平性），
       * 否则"原型总坐在低号位"会把座位偏置与环境偏置混在一起（eval-5p 的同类事故）。 */
      const oppSlots = [];
      for (let pid = 0; pid < N; pid++) if (pid !== seat) oppSlots.push(pid);
      const arch = new Set();
      for (let j = 0; j < MIX; j++) arch.add(oppSlots[(g + j) % oppSlots.length]);
      const choosers = [];
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(function (state, id, legal) { return sel(state, id, legal); });
        else choosers.push(arch.has(pid) ? opp : filler);
      }
      const r = T.oneGameN(choosers, gameSeed, N);
      const rank = T.rankOf(r.state, seat, gameSeed);
      n++; gamesRun++;
      if (rank === 1) first++;
      if (r.winner === seat) strict++;
    }
    rows.push({ env: env.name, seed: sd, inPool: env.inPool, games: n, first: first, strict: strict });
  }
}

const packName = PACK.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '');
console.log('包=' + packName + ' ‖ 环境=' + ENVS.length + '（池内 ' + ENVS.filter(e => e.inPool).length +
  ' / 池外 ' + ENVS.filter(e => !e.inPool).length + '） ‖ 每桌原型 ' + MIX + ' 席 + 随机 ' + (N - 1 - MIX) +
  ' 席 ‖ ' + SEEDS.length + ' 个 seed 档 × ' + GAMES + ' 局 = ' + gamesRun + ' 局');
const avg = rows.reduce((a, r) => a + r.first / r.games, 0) / rows.length;
console.log('  平均夺冠率=' + (avg * 100).toFixed(2) + '% ‖ 最差环境=' +
  (function () { const w = rows.slice().sort((a, b) => a.first / a.games - b.first / b.games)[0]; return w.env + ' ' + (w.first / w.games * 100).toFixed(1) + '%（seed ' + w.seed + '）'; })());

if (OUT) {
  const lines = ['#probe-5p-envfit', '#pack=' + packName, '#packFile=' + PACK, '#n=' + N, '#mix=' + MIX,
    '#games=' + GAMES, '#seeds=' + SEEDS.join(','), '#envs=' + ENVS.length, '#matrix=' + MATRIX,
    '#env\tseed\tinPool\tgames\tfirst\tstrict'];
  for (const r of rows) lines.push([r.env, r.seed, r.inPool ? 1 : 0, r.games, r.first, r.strict].join('\t'));
  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log('  逐环境账 → ' + OUT + '（' + rows.length + ' 行）');
}
