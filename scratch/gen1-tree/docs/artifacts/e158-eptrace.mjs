import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E158 · 页面侧的集成缺陷：信念表必须**活得过 `cloneState`**
 * 病（09-30 夜读 `ui.js` 才看见，不是跑出来的）：`ui.js:286/542/613` 把 AI 的决策喂的是 **`preState = S.cloneState(B.state)`**，
 *   而 `cloneState` 走 `JSON.parse(JSON.stringify(s))`（`state.js:236`）⇒ 我 v1.5.305 那版把信念表挂在 `state` 的**非枚举**槽上，
 *   JSON 往返会把它**整个丢掉** ⇒ 在浏览器里每一手都从空表开始 ⇒ 预测恒等于默认的 ジ ⇒
 *   等价于 §E152c 那个"空模型 + 前瞻"的臂（比现役包还差 **10.50pt**）⇒ **开了档反而更笨，而 `autoGameN` 那条路测不出来**
 *   （门禁与我的仪器都走 `autoGameN`，那里 state 是同一个对象，槽位活得下来）。
 * ⇒ 这就是"D204 绿 ≠ 可以开档"的具体形状，也是本仓"闸放行 ≠ 线接通"的一条实例。
 *
 * 修法只有一条站得住：**不要存历史，从 `state.events` 重建**（事件是公开记录，且随 JSON 一起被克隆带走）。
 * 于是先要回答一个问题：**ep 能不能从事件流精确反推？** 能 ⇒ 条件量保留（席位, 钱档, 上一手）；
 * 不能 ⇒ 只能退到"席位 + 上一手"这种纯序列条件（值多少由 §E152d 的另一臂回答）。
 * 本探针：跑真局，在每个决策点把**引擎里的真 ep** 与**从 events 反推的 ep**逐席对账。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 25));
const SEED = Number(arg('seed', 77000));

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay;
const mm = readFileSync(REPO + 'js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
const NAMES = ['minespam', 'cursestorm', 'deep saver', 'heavyfire', 'protobeam', 'antimirror', 'ringmaster'];
void NAMES;

/* 从事件流反推 ep：起点 = 0；`type:'ep'` 加 delta；`type:'action'` 且 outcome==='ok' 扣这张卡的费用。
   费用从 `R.byKey[key].cost` 取（这是**名义费用** ⇒ 任何条件减免/返还都是它的误差来源，正是要量的东西）。 */
function reconEp(events, nSeat) {
  const ep = new Array(nSeat).fill(0);
  for (const e of events) {
    if (!e) continue;
    if (e.type === 'ep' && typeof e.delta === 'number' && e.pid != null) { ep[e.pid] += e.delta; continue; }
    if (e.type === 'action' && e.outcome === 'ok' && e.pid != null) {
      const def = R.byKey[e.key];
      if (def && typeof def.cost === 'number') ep[e.pid] -= def.cost;
    }
  }
  for (let i = 0; i < nSeat; i++) if (ep[i] < 0) ep[i] = 0;
  return ep;
}
let cmp = 0, exact = 0, tierOk = 0, worst = 0, worstEx = '';
let firstBad = null;
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const Bots = W.EpirusBots;
const POOLN = OPP_SPECS.map(o => o.name).filter(n => typeof Bots['pick' + n.charAt(0).toUpperCase() + n.slice(1)] === 'function');
const FNOF = {}; for (const o of OPP_SPECS) FNOF[o.name] = Bots[o.fn];
for (let g = 0; g < GAMES; g++) {
  const r0 = T.mulberry32(SEED + g * 7919);
  const tab = []; while (tab.length < 4) { const n = POOLN[Math.floor(r0() * POOLN.length)]; if (tab.indexOf(n) < 0) tab.push(n); }
  const st = S.createState('multi', { next: T.mulberry32(SEED + g * 104729) }, 5);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + g * 104729);
  let seenEv = -1;
  const probe = function (s, pid, legal) {
    /* 只在"本回合还没有任何人出手"的那个瞬间对账（此刻 events 正好是本回合之前的全部历史） */
    if (s.events.length !== seenEv) {
      seenEv = s.events.length;
      const r = reconEp(s.events, s.p.length);
      for (let i = 0; i < s.p.length; i++) {
        cmp++;
        const d = Math.abs(r[i] - s.p[i].ep);
        if (d === 0) exact++;
        if (Math.min(5, r[i] >> 1) === Math.min(5, s.p[i].ep >> 1)) tierOk++;
        if (d > worst) { worst = d; worstEx = '席' + i + ' 真=' + s.p[i].ep + ' 反推=' + r[i]; }
        if (d > 0 && firstBad === null) firstBad = { round: s.round, pid: i, real: s.p[i].ep, recon: r[i] };
      }
    }
    return P.chooseCandidates(s, pid, P.candidatesFor(s, pid, legal.filter(l => l.affordable).length ? legal.filter(l => l.affordable) : [{ key: R.SK.JI, affordable: true }], {}), params, { temp: 0.15 });
  };
  const mk = i => function (s, pid, legal) {
    const lg = legal.filter(l => l.affordable);
    return FNOF[tab[i]](s, pid, lg.length ? lg : legal);
  };
  Play.autoGameN(st, [probe, mk(0), mk(1), mk(2), mk(3)]);
}
console.log('# §E158 ep 能否从 events 精确反推 ‖ 局=' + GAMES + ' ‖ 对账点=' + cmp + '（每决策点 × 5 席）');
console.log('  逐位相同 ' + (100 * exact / cmp).toFixed(2) + '%   ‖   **钱档（`min(5,ep>>1)`）相同 ' + (100 * tierOk / cmp).toFixed(2) + '%**');
console.log('  最大偏差 ' + worst + ' ep（' + worstEx + '）');
console.log('  第一次出错：' + JSON.stringify(firstBad));
console.log('\n  判读：**档对了就够**（条件量用的是 `ep>>1` 截 5，不是余额本身）⇒ 只要"钱档相同率"接近 100%，');
console.log('  重建方案可以保留（席位,钱档,上一手）这套条件；若明显掉下来说明有返还/减免类规则没进事件流 ⇒ 只能退到"席位+上一手"。');
