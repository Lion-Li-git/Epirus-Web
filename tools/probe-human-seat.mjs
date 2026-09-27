/* 「人类那一席」探针（v1.5.271 · qoder 09-28 §E82）—— 补一个判据集里从来没有的装配
 * 为什么要有它：仓里的量具只有两种装配 —— `eval-5p` 的"1 席主体 + 4 席脚本"与 G4 的"1 席脚本 + 4 席被测"。
 *   前者测不到"对面全是反弹"，后者测的是**脚本席夺冠率**（人类那一席）但**反手格里没有一格是反弹型**（八格：只防御/只枪/只狙击/
 *   激光剑/坦克线/滚环/瞄威胁者/珠爆发）。⇒ 用户实盘的真实场景"**我一个人 + 4 席冠军**"从来没有一个常驻读数。
 *   而 §E63 已经量到：线上冠军在"4 席纯反弹"场严胜 **0%**、被换下的旧包 99% ⇒ 这个盲区是有代价的。
 * 口径：**复用 `v2v4-lib.duelAssembly`（G4 的同一份装配实现，单一来源）** ⇒ 这里印的数与 G4 八格同尺同播种，可直接并排读。
 * 用法：node tools/probe-human-seat.mjs [--packs=a.js,b.js] [--games=200] [--modes=multi,long] [--seed=90210]
 */
import { sandbox, rejectUnknownFlags, loadChamp } from './audit-lib.mjs';
import { duelAssembly } from './v2v4-lib.mjs';
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'modes', 'seed'], 'probe-human-seat');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const G = Number(flag('games', 200)), SEED0 = Number(flag('seed', 90210));
const MODES = String(flag('modes', 'multi,long')).split(',').filter(Boolean);
const PACKS = String(flag('packs', 'js/bundled-champion-3p.js')).split(',').filter(Boolean);
/* `sandbox()` 返回的**就是** `sb.window`（不是 `{window: ...}`）⇒ 直接 `W.EpirusState`。
 * 读包走 `audit-lib.loadChamp`（3P/2P 两种外壳都认）：本仓"两个读取口不同源"栽过 §N31，不再自己写正则。 */
const W = sandbox();
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
function loadPack(f) {
  const p = loadChamp(W, f);
  if (!p) throw new Error('没有可认的冠军外壳（既非 EPIRUS_CHAMPION_3P 也非 EPIRUS_CHAMPION）');
  return p;
}
/* "人类原型"：4 个纯策略 + 2 个组合（真实的人不会只按一张键）。全部走 `bots.js` 的现成实现，不抄第二份、**也不写兜底链**
 * （兜底链会把"名字写错"伪装成"这个原型就是不赢"—— 本仓比较器假通过的老账）。 */
const HUMAN = [
  ['全程刷反弹', B.pickReflectSpam, 'reflectspam'],
  ['全程只防御', B.pickDefend, 'defend'],
  ['只攒不打(农民)', B.pickFarmer, 'farmer'],
  ['只枪压制', B.pickGunSpam, 'gunspam'],
  ['攒钱+反弹(会玩)', function (st, pid, legal) {
    const k = B.pickReflectSpam(st, pid, legal);
    if (k && k.key) return k;
    return B.pickDeepSaver(st, pid, legal);
  }, 'deepsaver+reflect'],
  ['重火力+反弹', function (st, pid, legal) {
    const k = B.pickReflectSpam(st, pid, legal);
    if (k && k.key) return k;
    return B.pickHeavyFire(st, pid, legal);
  }, 'heavyfire+reflect']
];
for (const h of HUMAN) {
  if (typeof h[1] !== 'function') {
    console.error('⛔ 人类原型「' + h[0] + '」的脚本不是函数 ⇒ `bots.js` 里没有那个名字（拒绝把它当"这人赢不了"读）');
    process.exit(7);
  }
}
console.log('# 人类那一席（1 席"人" vs 4 席被测冠军 · 与 G4 同一份装配实现 · ' + G + ' 局/格 · 轮座 · seed0=' + SEED0 + '）');
console.log('# 读法：印的是**那一席"人"的夺冠率**（越高 = 被测冠军越拿它没办法）；括号里 = 和棋率。\n');
const missing = [];
for (const f of PACKS) {
  let params = null;
  try { params = loadPack(f); } catch (e) { console.log('⛔ ' + f + ' 读不出：' + String(e.message || e).split('\n')[0].slice(0, 80)); missing.push(f); continue; }
  console.log('== ' + f);
  for (const mode of MODES) {
    const cells = HUMAN.map(function (h) {
      const r = duelAssembly({ S: S, Play: Play, T: T, R: R }, params,
        { games: G, mode: mode, seed0: SEED0, scripted: h[1] });
      return { name: h[0], src: h[2], win: r.winPct, draw: r.drawPct };   // **duelAssembly 已经乘过 100 并取整**
    });
    console.log('  ' + mode.padEnd(6) + cells.map(function (c) { return c.name + ' ' + c.win.toFixed(1) + '%(和' + c.draw.toFixed(0) + '%)'; }).join(' · '));
    const anyNonZero = cells.some(function (c) { return c.win > 0; });
    if (!anyNonZero) console.log('  ⚠ ' + mode + '：所有"人"都 0% ⇒ 这一整行没有判别力（换 --games 或换原型，别读成"冠军无敌"）');
  }
}
if (missing.length) {
  console.error('\n⛔ 有 ' + missing.length + ' 个包没量到：' + missing.join(', ') + ' ⇒ 按失败处理（缺行 ≠ 量了没测出来）');
  process.exit(7);
}
