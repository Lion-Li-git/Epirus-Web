/* §E711 的尺（10-24 夜 · 千问）：贴贴/天火的"随机注入"到底卡在哪一格
 * 用户假设：贴贴不进 k5（产品口径 ε=0.2/k=5/soft 的探索只在前 K 个**技能键**里均匀抽）⇒ 抽都抽不到。
 * 设计原则：**不重实现产品的候选菜单**（免得量具与产品两份口径）⇒ 只用导出的
 *   `T.policyChooserN(params,temp,eps,epsK,epsMode)` 换 K 值跑，配 `T.seqLockedTurn` / `Play.legalActions` 两个只读判据。
 * 三格分岔：(a) K 太小把它挡在外面 ‖ (b) `seqLockedTurn`（有符咒/持珠/上手蓄能）整回合取消探索 ‖ (c) 这张牌此刻根本不合法/买不起。
 * 用法：node tools/probe-sticker-injection.mjs [--packs=f1,f2] [--games=200] [--mode=multi|long]
 *        [--narrow=0|1] [--push=0..12] [--product=1]
 *   例（复现 §E712 的 2×2 里"两半同开"那一格）：
 *     node tools/probe-sticker-injection.mjs --games=250 --product=1 --narrow=1 --push=1
 * 读数住在：`docs/research/logs/2026-10-24-sticker-injection-qoder.md` §E711（分母与交集）‖ §E712（2×2 与自证）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from './audit-lib.mjs';
/* ROOT 自解析（不写死机器路径 —— `tools/reachability.mjs` 10-18 归仓时立的同一形状，`WT=<路径>` 可指到别的工作树）。 */
const REPO = (process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..')) + '/';
/* 仓规（门 D218）：进 `tools/` 的脚本必须有旗标消毒层 ⇒ 读不到的旗标一律 `exit 64`，别静默吞掉。 */
rejectUnknownFlags(process.argv.slice(2), ['games', 'mode', 'packs', 'narrow', 'push', 'product'], 'probe-sticker-injection');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 200)), MODE = arg('mode', 'multi'), NARROW = Number(arg('narrow', 0)), PUSH = Number(arg('push', 0));
const ONLY_PRODUCT = String(arg('product', '0')) === '1';
/* 默认只量**在册可复算**的那一枚（线上 3P 包）。第二枚 `docs/artifacts/g16-77001.bak` 是 gitignore 的本机产物
 *   ⇒ 想复现 §E711/§E712 那两包对照，得自己带上它（读不到会响亮印"读包失败"，不会静默少一格）。 */
const packs = String(arg('packs', REPO + 'js/bundled-champion-3p.js')).split(',');
const mk = () => {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
  sb.window = sb; sb.globalThis = sb;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
    vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
  }
  return sb.window;
};
const W = mk(), R = W.EpirusRules, S = W.EpirusState, X = W.EpirusResolve, Play = W.EpirusPlay, T = W.EpirusTrainer, P = W.EpirusPolicy;
T.setTrainMode(MODE === 'long' ? 'long' : 'multi');
T.setLockNarrow(NARROW);   // v1.8.33：0 = 出厂（锁上即作废本回合探索）‖ 1 = 窄锁（只许在链内键里探索）
T.setCursePush(PUSH);      // v1.8.33：0 = 关 ‖ N = 每 N 个 ep≥3 窗口把贴贴并进探索集一次（不强落子）
console.log('LOCK_NARROW = ' + T.lockNarrowOn() + '（' + (NARROW ? '窄锁档' : '出厂：锁上作废探索') + '） ‖ CURSE_PUSH = ' + T.cursePushOn());
function loadAny(src) {
  const slot = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (slot) return P.unpack(JSON.parse(slot[1]), true);
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const CELLS = [['贪心 eps=0', 0, 5], ['产品 eps=.2 k=5 soft', 0.2, 5], ['放大 K eps=.2 k=12 soft', 0.2, 12],
  ['近乎全表 eps=.2 k=20 soft', 0.2, 20]];   // 第四档是用来分"K 太小挡住"与"分数低到垫底、K 再大也轮不到"
const CELLS_RUN = String(arg('product', '0')) === '1' ? CELLS.filter(function (c) { return c[0].indexOf('产品') === 0; }) : CELLS;
for (const pf of packs) {
  let params;
  try { params = loadAny(readFileSync(pf, 'utf8')); } catch (e) { console.log(pf + ' 读包失败：' + e.message); continue; }
  console.log('\n包 = ' + pf.replace(REPO, '') + '  ·  mode=' + MODE + '  ·  ' + GAMES + ' 局/格  ·  5 席同包（镜像）');
  console.log('  档位'.padEnd(26) + '贴贴/局  天火/局  连贴≥2局占比 | 决策点: 贴贴可付%  天火可付%  序列锁%  ep≥2%');
  for (const [label, eps, k] of CELLS_RUN) {
    let deton = 0, curseCast = 0, fireCast = 0, gamesWithRun2 = 0, dec = 0, curseLegal = 0, fireLegal = 0, locked = 0, ep2 = 0;
    let dec3 = 0, w2 = 0, w2lock = 0, w3 = 0, w3lock = 0;
    for (let g = 0; g < GAMES; g++) {
      const st = S.createState(MODE === 'long' ? 'long' : 'multi', { next: mul(9100 + g * 13) }, 5);
      const ch = [];
      const inner = T.policyChooserN(params, 0.15, eps, k, 'soft');
      for (let pid = 0; pid < 5; pid++) {
        ch.push(function (state, p2, legal) {
          /* 只读记录，不消耗 state.rng ⇒ 采样流与不套这层时逐字相同。
           * "现在打不打得出去"一律问 `S.computeCost(...).ok`（含珠前置，与线上同一道闸，
           *   ⚑ 这一列连错两次，两次都记下来（免得下一班照抄）：
           *   第 1 版问"`legal` 里有没有这张卡" ⇒ 两列都 100%；第 2 版问 `S.computeCost(...).ok` ⇒ 还是 100%，
           *   因为 `rawCost`（state.js:132-152）**只算价、不判付不付得起**（`ok:false` 只给结构性阻塞：
           *   模式不可用 / 过载炮第 2 次缺 1ジ / 首次激光眼没爆珠）。真正的价格闸是 `legal[i].affordable` ——
           *   `candidatesFor` 就是照它跳过的（policy.js:628 `if (l.affordable === false && !opts.allowUnaffordable) continue;`）。 */
          dec++;
          const me = state.p[p2];
          let lc = false, lf = false;
          for (let i = 0; i < legal.length; i++) {
            if (legal[i].affordable === false) continue;
            if (legal[i].key === R.SK.CURSE) lc = true;
            if (legal[i].key === R.SK.FIRESTORM) lf = true;
          }
          if (lc) curseLegal++;
          if (lf) fireLegal++;
          /* ===== §E712 的关键一格：v1.5.142 的"软注入"与 v1.5.149 的"序列窗锁"是不是互斥 =====
           * `evo.js:903-934` 那三条里，②（持珠/上一手蓄能 ⇒ 并入电磁炮+激光眼）与 ③（有存活符咒/上一手贴贴 ⇒ 并入天火+继续贴）
           * 的**触发条件**，与 `seqLockedTurn`（`evo.js:510-521`：持珠 ‖ 上一手 CHARGE ‖ 有我方符咒）**逐字是同一批条件**；
           * 而 soft 分支的顺序是 `if (seqLockedTurn) pick = 贪心` ⇒ 一旦锁上，后面那段"并入探索集"的代码**根本走不到**（`if (!pick)` 才进）。
           * 所以这里把两边的判据都记下来，直接量交集（不是读代码读出来的推论）。 */
          const lk = T.seqLockedTurn(state, p2);
          if (lk) locked++;
          let holdBead = false, cursing = false;
          const mm = state.p[p2] || {};
          if ((mm.elec | 0) > 0 || (mm.boom | 0) > 0 || mm.lastSkill === R.SK.CHARGE) holdBead = true;
          if (mm.lastSkill === R.SK.CURSE) cursing = true;
          if (!cursing && state.p) {
            for (let zi = 0; zi < state.p.length && !cursing; zi++) {
              const zs = state.p[zi].stickers || [];
              for (let zj = 0; zj < zs.length; zj++) if (zs[zj] && zs[zj].owner === p2) { cursing = true; break; }
            }
          }
          dec3++;
          if (holdBead) { w2++; if (lk) w2lock++; }
          if (cursing) { w3++; if (lk) w3lock++; }
          if ((me.ep | 0) >= 2) ep2++;
          return inner(state, p2, legal);
        });
      }
      Play.autoGameN(st, ch);
      let run = 0, run2 = false;
      for (const e of st.events) {
        if (e.type === 'firestorm') deton++;   // 引擎在天火真的引爆时发这条事件 ⇒ 这是"收益端"，不是出手数
        if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.CURSE) { curseCast++; run++; if (run >= 2) run2 = true; }
        else if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.FIRESTORM) fireCast++;
        else if (e.type === 'action' && e.outcome === 'ok') run = 0;
      }
      if (run2) gamesWithRun2++;
    }
    console.log('  ' + label.padEnd(24) + (curseCast / GAMES).toFixed(3) + '    ' + (fireCast / GAMES).toFixed(3) + '    ' +
      (100 * gamesWithRun2 / GAMES).toFixed(1) + '%          ' +
      (100 * curseLegal / dec).toFixed(1) + '%      ' + (100 * fireLegal / dec).toFixed(1) + '%      ' +
      (100 * locked / dec).toFixed(1) + '%    ' + (100 * ep2 / dec).toFixed(1) + '%   (分母 ' + dec + ' 个决策点)');
    console.log('    └ 收益端：天火**真引爆** ' + deton + ' 次（' + (deton / GAMES).toFixed(3) + '/局） ‖ 窄锁档统计 ' + JSON.stringify(T.lockNarrowStat()) +
      ' ‖ 贴贴软注入 ' + JSON.stringify(T.cursePushStat()));
    console.log('    └ v1.5.142 那两条软注入的窗口 vs 序列窗锁：②持珠/蓄能窗口 ' + w2 + ' 个（其中被锁 ' + w2lock +
      ' = ' + (w2 ? (100 * w2lock / w2).toFixed(0) : '-') + '%） ‖ ③有符咒/刚贴过窗口 ' + w3 + ' 个（其中被锁 ' + w3lock +
      ' = ' + (w3 ? (100 * w3lock / w3).toFixed(0) : '-') + '%） ‖ 窗口占决策点 ' +
      (100 * (w2 + w3) / Math.max(1, dec3)).toFixed(1) + '%');
  }
}
console.log('\n注：贴贴"连贴≥2"数的是**同一席连续两手机**（中间隔别的招就归零），只是注入端的剂量，不含引爆收益。');
console.log('    探索取消的判据 `seqLockedTurn` 是产品自己的函数（evo.js:510，导出面在 :3662），量具没抄第二份。');
