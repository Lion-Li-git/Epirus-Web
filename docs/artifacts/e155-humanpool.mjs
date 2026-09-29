import { readFileSync } from 'node:fs';
import vm from 'node:vm';
/* §E168：对手池的采样器**提进 `tools/human-pool.mjs` 当单一来源**（这台仪器与 `e168-style-human.mjs`（风格复量）必须用同一份采样，
 *   否则两张桌子的"人类形状"不是同一个东西 ⇒ 本仓"两份同构实现必漂移"的老账。提完后本节下面重跑一遍，
 *   +8.75 / +14.25pt 那两行必须逐字复现（复现了才说明提取没动语义）。 */
import { loadPool, makeMimic } from '../../tools/human-pool.mjs';

/* §E155 · 把"对手模型"的收益从**脚本桌**搬到**人类形状的环境**上。
 * 为什么必须做这一步：§E152d/§E154 的 +43~+50pt 全部是在 26 个脚本 + 现役包身上量的，
 *   而产品在 5 人局里面对的是**人**。§E152e 只回答了"人类好不好预测"（答案：和产品 AI 一样好预测），
 *   没回答"预测人类赚不赚钱"。这一台补的就是后一问。
 * 做法：用 `docs/artifacts/human-behavior.json`（56 局人类日志导出的经验分布，单一真源 = §E152e 那台解析器）
 *   造一个**人类形状的对手**：给定该局面的可观测条件（钱档 / 是否富有 / 上一手），按经验分布**抽样**出一手。
 *   ⇒ 它不是"复刻某个人"，是"行为统计上像人类"——人类日志里 n≈1000 个决策撑不起更细的说法（诚实标注在下面）。
 * ⚠ 三条口径纪律：
 *   ① 搜索/关档都走**发布路径**（`Trainer.pickChampion` + `opts.belief`），不在仪器里手搓第二份搜索（本仓"同构必漂移"第四次应验的教训）；
 *   ② 两臂同桌同 seed ⇒ 逐桌配对；
 *   ③ 这个对手池是**模型造出来的**，不是真人 ⇒ 结论只能是"对人类形状的行为有没有用"，不能写成"对真人有用"。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const TABLES = Number(arg('tables', 40));
const GAMES = Number(arg('games', 10));
const SEED = Number(arg('seed', 77000));
const SRC = arg('src', 'human');          /* human | ai ⇒ 用哪一份经验分布造对手 */
const TGT = arg('tgt', 'next');          /* next = 机械指向下一位 ‖ rand = 活席里随机指（绝对值的对照） */
const ARMS = arg('arms', 'prod-off,prod-on').split(',');
/* §E161c：`--tie=1` ⇒ **开档那臂**的平票交给网络自己的打分（关档臂根本不进搜索 ⇒ 不受影响）。
   默认 0 = §E155 已量过那一版（+8.75 / +14.25pt 那两行）。加这一档是为了回答"产品口径那个数会不会被目标函数的小修推动"。 */
const TIE = Number(arg('tie', 0));

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay;
const mm = readFileSync(REPO + 'js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('⛔ 出厂包读不到'); process.exit(1); }
if (TIE) T.setBeliefTie(TIE);
console.log('装配：对手=' + SRC + ' · 指向=' + TGT + ' · 臂=' + ARMS.join('/') + ' · tie=' + TIE + (TIE ? '（平票交给网络打分）' : '（§E155 原形状）') + ' · ' + TABLES + ' 桌 × ' + GAMES + ' 局 · seed0=' + SEED);

/* ---- §E168：采样器搬到 `tools/human-pool.mjs`（与 §E168 那台风格复量共用同一份）----
   下面这段以前是本地实现（`POOL`/`MARG`/`sample`/`humanMimic` 共 50 行），现在只留一个**流句柄**：
   每局把 `mimicRng` 换成 `mulberry32(seed*7+13)` ⇒ 四席共用同一个闭包 = 共用同一条流（与提取前逐字同形）。
   ⚠ 提取后重跑 `--tgt=rand` 那两行必须还是 +8.75 / +14.25pt（复现了才算"提取没动语义"，见 §E168 的记录）。 */
const pool = loadPool(W, SRC);
let mimicRng = null;
const humanMimic = makeMimic(W, pool, TGT, () => mimicRng());

function runArm(arm) {
  const rows = [];
  for (let t = 0; t < TABLES; t++) {
    let first = 0, rounds = 0;
    for (let g = 0; g < GAMES; g++) {
      const seed = SEED + t * 104729 + g;
      const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
      mimicRng = T.mulberry32(seed * 7 + 13);          /* 对手池自己的流：与两臂共用同一个 seed ⇒ 两臂面对**同一串**抽样 */
      const subject = function (s, pid, legal) {
        const bf = legal.filter(l => l.affordable);
        const lfa = bf.length ? bf : [{ key: R.SK.JI, affordable: true }];
        /* 关档 = 页面那一行原样（`Trainer.pickChampion`）；开档 = 实例级 `policyChooserBelief` ⇒ 同桌另一席仍可关档。
           （不给 `policyChooserN` 加形参的原因见 evo.js 里那条注释：两道量具拿它的签名行当补丁锚点。） */
        const er = r => (r <= 1 ? 0 : r === 2 ? 0.1 : 0.2);
        if (arm === 'prod-on') return T.policyChooserBelief(params, 0.15, er(s.round), 5, 'soft')(s, pid, lfa);
        return T.pickChampion(s, pid, lfa, params, 0.15, er(s.round), 5, 'soft');
      };
      Play.autoGameN(st, [subject, humanMimic, humanMimic, humanMimic, humanMimic]);
      if (st.winner === 0) first++;
      rounds += st.round;
    }
    rows.push({ table: t, first: first, g: GAMES, rounds: rounds / GAMES });
  }
  return { rows: rows };
}
const { pairedDiff } = await import('file://' + REPO + 'tools/routing-gain-lib.mjs');
console.log('# §E155 人类形状环境（对手池 = ' + SRC + ' 经验分布，' + pool.conds + ' 个条件、' + pool.tot + ' 手抽样质量 · 采样器 = `tools/human-pool.mjs`（§E168 提取，与风格复量共用一份）） ‖ 桌=' + TABLES + ' × 局=' + GAMES);
const res = {};
for (const a of ARMS) res[a] = runArm(a);
const tot = {};
for (const a of ARMS) tot[a] = 100 * res[a].rows.reduce((x, r) => x + r.first, 0) / (TABLES * GAMES);
console.log('\n  臂            夺冠率      平均回合');
for (const a of ARMS) {
  const rd = res[a].rows.reduce((x, r) => x + r.rounds, 0) / TABLES;
  console.log('  ' + a.padEnd(14) + tot[a].toFixed(2).padStart(7) + '%' + rd.toFixed(1).padStart(11));
}
console.log('  对手池抽样：命中条件分布 ' + humanMimic.stats.hit + ' 次、8 次都没抽到可负担的卡 ⇒ 退回 ジ ' + humanMimic.stats.miss + ' 次（' +
  (100 * humanMimic.stats.miss / Math.max(1, humanMimic.stats.hit + humanMimic.stats.miss)).toFixed(1) + '%）');
for (let i = 0; i < ARMS.length; i++) for (let j = i + 1; j < ARMS.length; j++) {
  const d = pairedDiff(res[ARMS[i]].rows.map(r => r.first / r.g), res[ARMS[j]].rows.map(r => r.first / r.g), 1.96);
  console.log('  配对差 ' + ARMS[i] + ' − ' + ARMS[j] + ' = **' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']**（逐桌 n=' + d.n + '）');
}
console.log('\n  ⚠ 读法：这一批比的是**同一个人类形状对手池**下的开/关档 ⇒ 若收益仍然很大，说明"对手模型"卖的不是"背脚本";');
console.log('    若掉到 0 附近，说明 §E152d 那 +43.25pt 里有一部分只是"把 26 个脚本的固定套路背下来"。两种都要如实记。');
console.log('  ⚠ 对手池本身是从 ' + HB.games + ' 局 / 人类 ~1000 个决策造出来的 ⇒ 它是**粗模型**，不等于真人（尤其不等于会读你的高手）。');
