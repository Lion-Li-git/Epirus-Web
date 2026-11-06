/* 「空蓄能」拆成两种病（09-25 凌晨 · Qoder · 只读）
 *
 * 用户 09-24 报的第二条病是"空蓄能"。仓里已有两道菜单闸：`CHARGE_MIN_EP`（ep<2 不蓄能，v1.5.82）与
 *   空净化/空天火闸（v1.5.199/139）。但 §E 量出来真正的空转大头是**蓄能珠过期**（现役 270 颗 / `v7cmin4-82` 744 颗）——
 *   那不是"ep 不够还蓄"，是"蓄了之后那枚珠**没被用掉**"。这两种病的修法完全不同：
 *     ① **下一回合根本用不上**（电磁炮要 2 ジ + 1 电珠；凑不齐就是经济问题）⇒ 该问的是收入/价格；
 *     ② **下一回合明明用得上却没射**（选择问题）⇒ 才谈得上"菜单/打分"要不要动。
 *   现有 `chargeProfile` 只给"得珠/花珠/过期珠"三个总量，分不出这两半 ⇒ 本量具专门分这个。
 *
 * 实现：在**决策那一刻**看该席的合法动作表（`legal`）里电磁炮在不在、买不买得起 —— 不重建、不猜。
 *   规则：珠只保留到下一回合（README/`evo.js` 的 `CHARGE_MIN_EP` 注释同口径）⇒ 判"这次蓄能成不成立"的窗口就是**它下一次做决策的那一回合**。
 *
 * 用法：node tools/probe-bead-loop.mjs [--packs=...] [--games=120] [--mode=multi|long] [--eps=0.2]
 *   ⚠️ 本工具**没有** `--fields`（v1.5.236 起从用法里删掉，不再"文档撒谎"）：它的装配是**五席同一只包的镜像**，
 *     没有"场地"这一维可言；要分场地（pool/镜像/破防）请走 `probe-cross-mode` 或 `promote --dry`。
 */
import { readFileSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { chargeProfile, rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
/* v1.5.234：参数守卫 —— 本工具的**头注曾承诺 `--fields` 而代码没实现**（传了被静默忽略 ⇒ 假读数）。 */
rejectUnknownFlags(process.argv.slice(2), ['packs','games','temp','eps','epsk','epsmode','json','mode'], 'probe-bead-loop');
const PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/v7cmin4-82.bak').split(',');
const GAMES = Number(arg('games', 120));
/* ⚠️ v1.5.234 加了 `--mode` 并把模式印出来；但**"两把尺子差 7 倍 = 模式不同"这个解释已被 DS 自己在交接 §2.6 收回**，
 *   我 09-25 下午做了 §3.2 那步定案实验（同包、同 `long`、同 40 局，只换"沙箱有没有被搬过口径"）：
 *     搬过（route ② 把 `EpirusTrainer.policyChooserN` 包了一层 ⇒ 2 参调用升成 ε=0.2 soft）：得珠 **91** · 浪费率 29.7% · 蓄能 2.27/局 · 局长 25.5
 *     没搬（ε=0，与 `promote-champion` 同）：            得珠 **273** · 浪费率 13.6% · 蓄能 6.83/局 · 局长 53.5
 *   ⇒ **光口径就差 3.00 倍**（`chargeProfile` 内部调的是 `policyChooserN(params, 0.15)` 两参形式，正好被包装层接走）。
 *   所以本工具下面那行"对照真源"以前其实是**产品口径**的数，却写着"真源" ⇒ 这是我的口径漏印，不是 `chargeProfile` 有隐性状态。
 *   修法：对照行改跑在**没搬口径**的沙箱上，并把两个口径都印出来（METHODOLOGY 53/54/66 同族：读数必须带口径才能互比）。 */
const MODE = arg('mode', 'multi');
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

console.log('# 「空蓄能」两种病的拆分（' + GAMES + ' 局/格 · 5 席 · **' + MODE + ' 模式** · ' +
  (EPS === 0 ? '评测口径 ε=0' : '产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE) + ' · 只读）');
console.log('# ① 用不上（下一回合电磁炮不可负担）＝经济问题；② 用得上没射＝选择问题。两者混在"过期珠"这一个数里会互相掩盖。\n');

for (const f of PACKS) {
  const ctx = build({ on: EPS > 0, pack: f, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
  if (EPS > 0 && ctx.patched !== ctx.hardwired) { console.log('⛔ 口径搬运自检失败'); process.exit(9); }
  const sb = ctx.sb, R = sb.EpirusRules, S = sb.EpirusState, T = sb.EpirusTrainer, Play = sb.EpirusPlay, P = sb.EpirusPolicy;
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) { console.log('⚠️ ' + f + ' 解不出参数'); continue; }
  /* v1.5.236：对照行必须跑在**没搬口径**的沙箱上（否则"真源"其实是 ε=0.2 的数，见上面那段注释里的 3.00× 实测）。
   * 同一次 `build` 只是 `on:false` ⇒ 装载器/参数解析与主口径逐字相同，唯一变量是"有没有把 chooser 换掉"。 */
  const ctx0 = build({ on: false, pack: f });
  const params0 = ctx0.sb.EpirusPolicy.unpack(ctx0.sb.EPIRUS_CHAMPION_3P, true) || ctx0.sb.EpirusPolicy.unpack(ctx0.sb.EPIRUS_CHAMPION, true);
  const bs = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
  const NAME = {}; for (const k in R.byKey) NAME[k] = R.byKey[k].name;
  const st = { charged: 0, cantAfford: 0, couldButNoFire: 0, fired: 0, beadGone: 0, noNextDecision: 0 };
  const NEXTKEY = {};   // ②"买得起却没射"的那些决策，下一次实际干了什么（不写这个就解释不了与 `chargeProfile` 的差）
  for (let g = 0; g < GAMES; g++) {
    const state = S.createState(MODE, { next: mul(4100 + g * 7919) }, 5);
    state.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const pending = {};   // pid -> 该席上次蓄能时的回合与当时珠数
    const seenRound = {};
    const ch = [];
    for (let pid = 0; pid < 5; pid++) ch.push(function (s2, p2, lg) {
      const pick = bs(s2, p2, lg);
      const me = s2.p[p2];
      /* 这是该席"下一次决策" —— 结算上一次蓄能成不成立 */
      if (pending[p2] !== undefined && pending[p2].rd !== s2.round) {
        const rail = lg.filter(function (l) { return l.key === R.SK.RAILGUN; })[0];
        st.charged++;
        /* ⚠️ 判"珠子还在不在"必须显式：珠只保留到下一回合，而该席**下一次决策**可能已是两三个回合之后
         *   （上一局里我第一版就是这么错的：把 8 次"两回合后才决策"的算成了买不起）。 */
        const beadAlive = s2.round - pending[p2].rd <= 1 && ((me.elec || 0) + (me.boom || 0)) > 0;
        if (!beadAlive) { st.beadGone++; }
        else if (!rail || !rail.affordable) { st.cantAfford++; }
        else if (pick.key === R.SK.RAILGUN) { st.fired++; }
        else { st.couldButNoFire++; NEXTKEY[pick.key] = (NEXTKEY[pick.key] || 0) + 1; }
        delete pending[p2];
      }
      if (!seenRound[p2]) seenRound[p2] = 0;
      if (pick.key === R.SK.CHARGE) pending[p2] = { rd: s2.round };
      return pick;
    });
    Play.autoGameN(state, ch);
    /* 局末还挂着"蓄了但没等到下一次决策"的 ⇒ 单独计，混进①或②都会偏 */
    for (const k in pending) { st.noNextDecision++; }
  }
  const ok = st.charged - st.beadGone;   // 只有"珠子还活着"的那批才谈得上①②
  const pctv = function (x, n) { return n ? (100 * x / n).toFixed(1) + '%' : '—'; };
  const judge = ok ? (st.couldButNoFire >= st.cantAfford ? '②（选择）为主' : '①（经济）为主') : '没量到（珠子都等不到下一回合）';
  console.log('## ' + f.replace(/^.*\//, '').replace(/\.bak$/, '') + ' · 蓄能后能配到"下一次决策"的样本 n=' + st.charged + '（另 ' + st.noNextDecision + ' 次蓄能后该局就结束/该席再没决策 ⇒ 不计入两半）');
  console.log('   └ 其中 ' + st.beadGone + ' 次蓄能后**隔了两回合以上才决策**（珠子早过期 ⇒ 与①②无关，单列，不混进分母）');
  console.log('   在珠子还活的 ' + ok + ' 次里：① 下一回合电磁炮**买不起** ' + st.cantAfford + ' 次（' + pctv(st.cantAfford, ok) +
    '） · ② 买得起**却没射** ' + st.couldButNoFire + ' 次（' + pctv(st.couldButNoFire, ok) + '） · ③ 买得起也射了 ' + st.fired + ' 次（' + pctv(st.fired, ok) + '）');
  const cpN = Math.max(60, GAMES);
  /* 两口径各跑一次：`cp` = 本工具的口径（搬过 ⇒ 五席 chooser 带探索），`cp0` = **未搬口径**（ε=0，与 `promote-champion` 珠经济栏可直接对表） */
  const cp = chargeProfile(ctx.sb, params, MODE, cpN);
  const cp0 = params0 ? chargeProfile(ctx0.sb, params0, MODE, cpN) : null;
  const share = Object.keys(NEXTKEY).sort(function (a, b) { return NEXTKEY[b] - NEXTKEY[a]; }).slice(0, 5)
    .map(function (k) { return (NAME[k] || k) + ' ' + NEXTKEY[k]; }).join(' · ');
  console.log('   账本 A（**本工具口径 · 搬过 ε**）：得珠 ' + cp.gained + ' · 花掉 ' + cp.spent + '（' + pctv(cp.spent, cp.gained) +
    '） · 过期 ' + cp.expired + '（浪费率 ' + pctv(cp.expired, cp.gained) + '） · 蓄能 ' + cp.chargesPerGame.toFixed(2) + ' 次/局 · 局长 ' + cp.roundsPerGame.toFixed(1) +
    '  ←— ' + MODE + ' × ' + cpN + ' 局 · ' + (EPS === 0 ? 'ε=0' : 'ε=' + EPS + ' ' + EPSMODE));
  console.log('   账本 B：真源 `chargeProfile`（**按珠子计**）· **未搬口径 ε=0** · 同 ' + MODE + ' × ' + cpN + ' 局 ⇒ 与 `promote --dry` 的珠经济栏同尺：' + (cp0 ?
    ('得珠 ' + cp0.gained + ' · 花掉 ' + cp0.spent + '（' + pctv(cp0.spent, cp0.gained) + '） · 过期 ' + cp0.expired +
      '（浪费率 ' + pctv(cp0.expired, cp0.gained) + '） · 蓄能 ' + cp0.chargesPerGame.toFixed(2) + ' 次/局 · 局长 ' + cp0.roundsPerGame.toFixed(1) +
      (cp.gained ? '   ⇒ **A/B 得珠差 ' + (cp0.gained / cp.gained).toFixed(2) + '×：这一整块差异属于口径，不属于账本' : '')) :
    '没量到（对照沙箱解不出参数 ⇒ 不许按 0 处理）'));
  console.log('   （本表按决策计、真源按珠子计，两者不该相等：一颗珠可能被别的卡吃掉、一次蓄能也可能与已有珠混在一起 ⇒ 只并排、不互校）');
  console.log('   ② 里那些"下一次决策"实际干了什么：' + (share || '无') + '   ⇒ 若大头是"又蓄一次/出ジ"，那是**攒着不放**；若是"花了别的珠卡"，那是**珠子被旁路**');
  console.log('   ⇒ 落点：' + judge + '；' + (ok < 60 ? '⚠️ 样本 <60，这句只当方向' : '样本够，但**仍不是判据** —— 它只说明该往哪一层找解'));
}
