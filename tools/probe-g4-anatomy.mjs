/* G4「只枪」那格的解剖 + 干预（只读探针，不训练、不写任何包）
 *
 * 背景：`gate-drafts.mjs` 的 G4[long] 是**全仓唯一已知红门** —— 一行脚本「只枪(1ジ压制·打最肥)」能以
 *   **75%(long) / 62%(multi)** 击败线上包（阈值 60%，D67 记的是 `--force` 例外）。
 *   09-19 实测：换包不是出路 —— 6 个 r61fix 臂包在这一格是 **80~100%**（long），
 *   **7 个包里现包最好** ⇒ 只能靠**针对性干预**，不能靠"再抽一次 seed"。
 *
 * HANDOFF §2.2 里记着机制假设：「奖励防御把包推向『龟』，而只枪/只防御正是吃龟的」——
 *   这条**只被间接支持过**（E4 奖励挡下的臂）⇒ 本探针把它做成**可在 G4 自己的装配里直接量的因果读数**。
 *
 * 四段：
 *   §A 自检       —— 用与 `gate-drafts` **同口径**的只枪线（`aff`+`pT`）复现 75%/62%。
 *                    ⚠ 复现不出来 ⇒ 后面所有读数都不算数（装配/包加载错了），先修这里。
 *   §B 解剖       —— 只枪 vs 基线（5 席同包）两栏对照：被测席的出手构成、ジ占比、平均回合、
 *                    终局存活席数、脚本席剩余血量。**看"它是不是在龟、"枪手有没有被打"。**
 *   §C 反事实     —— 同一 seed 同轮座，只改被测席的**一个决策规则**：
 *                      `forceAttack`：它选ジ、而**当回合枪买得起**时 → 改判成枪（= 不许它攒着不出手）；
 *                      `forceTurtle`：它的任何非ジ输出 → 改判成ジ（= 完全不还手）。
 *                    两个方向都记 `forced` 次数（**空枪检测**：0 ⇒ 本行无信息）。
 *                    ⇒ 「只枪靠吃龟」若成立：forceAttack 该让 75% 明显掉、forceTurtle 该让它升到 ~100%。
 *   §D 池子那条线 —— 训练池里的 `Bots.pickGunSpam`（**打最肥、无击杀优先**）当脚本席，与 G4 那格
 *                    （`pT` → `T.pickTargetN`，**击杀优先再打最肥**）对照。两者**几乎同一条线但不逐字相同**
 *                    ⇒ 若 §D 与 §A 差得多，"加池子就能修这格"的推理要打折。
 *
 * 口径说明（这些是"改了就得重测"的东西）：装配在 `tools/v2v4-lib.mjs` 的 `duelAssembly()`，
 *   与 `gate-drafts.mjs:256-268` 逐字一致（seed0=90210、seat=g%5、slotSalt=h32(seed0+g*2246822519)）。
 * 用法：node tools/probe-g4-anatomy.mjs [GAMES=60] [包...]（默认线上包 `js/bundled-champion-3p.js`）
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { duelAssembly } from './v2v4-lib.mjs';

const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots, A = R.SK;
const D = { S: S, Play: Play, T: T, R: R, B: B };

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 60);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js'];
const SEED0 = Number(process.env.G4_SEED0 || 90210);

function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}

/* ===== 与 `gate-drafts.mjs:216-222` 同口径的只枪线 =====
 * ⚠ 这里是**复刻**（那两行只存在于 gate-drafts 内部、且它 import 即执行，不能拿来用）。
 *   复刻的合法性靠 §A 自检背书：**必须复现 75%/62%**，否则就是另一条线。若要长期用，
 *   应把 G4 的克制表抽成模块（与 `v2v4-lib.mjs` 同法），那是另一件工作。 */
const aff = function (l, k) { return l.find(function (x) { return x.key === k && x.affordable; }) ? { key: k } : null; };
const pT = function (st, pid, o) { return { key: o.key, target: o.target != null ? o.target : T.pickTargetN(st, pid, o.key) }; };
const JI_LINE = function (st, pid, legal) {
  return aff(legal, A.GUN) ? pT(st, pid, { key: A.GUN }) : { key: A.JI, target: null };
};
const KEYS = Object.keys(A).map(function (k) { return A[k]; });

function anatomyLine(tag, r) {
  const top = Object.keys(r.counts).map(function (k) { return [k, r.counts[k]]; })
    .filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 7).map(function (x) { return x[0] + ':' + x[1]; }).join(' ');
  console.log('      ' + tag.padEnd(22) +
    ' 脚本席胜 ' + String(r.winPct).padStart(3) + '%  和 ' + String(r.drawPct).padStart(3) + '%' +
    '  被测席夺冠 ' + String(r.champWinPct).padStart(3) + '%');
  console.log('        决策 ' + r.champDecisions + ' · ジ占比 ' + (100 * r.jiShare).toFixed(1) + '%' +
    ' · 均 ' + r.avgRounds.toFixed(1) + ' 回合 · 终局存活(被测) ' + r.aliveChampEnd.toFixed(2) + '/4 席' +
    ' · 脚本席存活 ' + (100 * r.aliveScriptedEnd / GAMES).toFixed(0) + '% 余血 ' + r.hpScriptedEnd.toFixed(2));
  /* v1.5.134：**伤害归属**这一列是 v1.5.133 跨包读数里与那格相关性最强的一条
   *   （只枪格 vs「打在枪手身上」r = −0.82；vs「ジ占比」只有 +0.23）⇒ 解剖行必须打印它。 */
  console.log('        伤害：我方合计 ' + r.champDmgPerGame.toFixed(2) + '/局 · **打在枪手身上 ' +
    r.dmgToScriptedPerGame.toFixed(2) + '/局** · 枪手打出 ' + r.dmgByScriptedPerGame.toFixed(2) + '/局');
  console.log('        被测席出手（前 7）：' + (top || '（无）'));
}

console.log('=== G4「只枪」解剖（口径与 gate-drafts 逐字一致 · ' + GAMES + ' 局/行 · seed0=' + SEED0 + '）===');
/* 期望值 = 09-19 实测的线上包读数（`g4-check.log`）—— 复现不出就是量具坏了 */
const EXPECT = { long: 75, multi: 62 };

for (const f of FILES) {
  let p; try { p = load(f); } catch (e) { console.log('  跳过 ' + f + ': ' + e.message); continue; }
  console.log('\n  包：' + f.split('/').pop() + '（meta 指纹 ' + ((p && p.meta && p.meta.rulesFingerprint) || '—') + '）');
  for (const mode of ['long', 'multi']) {
    console.log('\n  ── 模式 ' + mode + ' ──');
    const base = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: 'champ', countKeys: KEYS });
    const gun = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: JI_LINE, countKeys: KEYS });
    /* §A 自检：**线上包**必须复现已记录的 75%/62%（同 seed、同局数 ⇒ 理论上逐局相同）。
     * 量别的候选包时跳过自检（否则每次都会喊"复现失败"，把一个好量具变成噪音）。 */
    const isOnline = f === 'js/bundled-champion-3p.js';
    const ok = !isOnline ? null : Math.abs(gun.winPct - EXPECT[mode]) <= 2;
    console.log('  §A 自检  只枪线 vs ' + (isOnline ? '线上包' : '本包') + '：' + gun.winPct + '%（线上包应 ' + EXPECT[mode] + '%）' +
      (ok === null ? '   （非线上包 ⇒ 跳过自检）' : (ok ? '   ✅ 装配对上了' : '   ⛔ **复现失败** ⇒ 下面的读数先别读，去查装配/包')));
    console.log('  §B 解剖（同一 seed 序列，只换脚本席）');
    anatomyLine('基线(5 席同包)', base);
    anatomyLine('只枪(1 席脚本)', gun);

    /* §C 反事实：只改被测席一个决策规则 */
    const fa = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: JI_LINE, countKeys: KEYS, forceAttack: true });
    const ft = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: JI_LINE, countKeys: KEYS, forceTurtle: true });
    console.log('  §C 反事实（同 seed 同轮座，只改被测席的一个决策规则）');
    console.log('      forceAttack（攒着不出手→买得起就开枪）：脚本席胜 ' + fa.winPct + '%  ' +
      'Δ ' + (fa.winPct - gun.winPct) + 'pt   改判 ' + fa.forced + ' 次' +
      (fa.forced === 0 ? '   ⛔ 空枪：它在这个装配里从不"买得起枪却选ジ" ⇒ 本行无信息' : ''));
    console.log('      forceTurtle（完全不还手，任何输出→ジ）  ：脚本席胜 ' + ft.winPct + '%  ' +
      'Δ ' + (ft.winPct - gun.winPct) + 'pt   改判 ' + ft.forced + ' 次' +
      (ft.forced === 0 ? '   ⛔ 空枪' : ''));

    /* §D 池子那条线（pickGunSpam = 打最肥，无击杀优先）—— 与 G4 那格不是逐字同一条 */
    if (typeof B.pickGunSpam === 'function') {
      const pool = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: B.pickGunSpam });
      const pfa = duelAssembly(D, p, { games: GAMES, mode: mode, seed0: SEED0, scripted: B.pickGunSpam, forceAttack: true });
      console.log('  §D 池子那条线（Bots.pickGunSpam，打最肥、无击杀优先）');
      console.log('      脚本席胜 ' + pool.winPct + '%（G4 那格 ' + gun.winPct + '% ⇒ 差 ' +
        (pool.winPct - gun.winPct) + 'pt）  forceAttack 后 ' + pfa.winPct + '%  改判 ' + pfa.forced + ' 次');
    }
  }
}
console.log('\n  读法：§C 的 forceAttack 若让只枪胜率**明显下降**、且 forceTurtle 让它**升到接近 100%** ⇒');
console.log('        「只枪吃龟」是因果成立的机制，干预方向 = 让包在"买得起最便宜攻击卡"时**别攒着**；');
console.log('        两者都不动 ⇒ 这格不是"龟"的问题，是别的东西（火力被稀释/冷却吃枪），换方向。');
