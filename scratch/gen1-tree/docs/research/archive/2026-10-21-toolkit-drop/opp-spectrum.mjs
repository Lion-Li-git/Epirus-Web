/* §E676 前提尺（用户 10-21 07:0x 的假设：「训练对应的脚本场并不会用连招，把杂货铺丢到训练里面」）
 * 要量的是**对手侧**两件事，不是冠军侧：
 *   ① 训练桌上那 9 条 `OPPS` 到底出不出"连招/攒-花"那一族（CHARGE→RAILGUN ‖ RING ‖ BIG_T ‖ CANNON），
 *      以及它到底攒不攒得到那一族的门槛珠数（决策时 ep 的均值与最大值）；
 *   ② `st:toolkit`（杂货铺，计划层 P0~P7）在**同一张桌的形状**下补的是哪一维。
 * 两臂只差桌子里有没有第 10 只 picker ⇒ 每只 picker 的谱按"它自己那一席的事件"逐席归因，不做跨席汇总。
 * ⚠ 三条会把读数读歪的地方：
 *   · **混合桌换了分布**：第二臂每只 picker 遇到的对手也变了 ⇒ 本尺只判"哪一维有没有出现/多少剂量"，不判"谁更强"；
 *   · 出手只数 `type==='action' && outcome==='ok'`（与 `usage-probe`/`aggressionProfile` 同判据），空放不算；
 *   · ep 是**决策时刻**握珠（chooser 被调用那一刻），不是回合结束值 ⇒ 判"攒没攒到 3/5/7"只能用它。
 * 用法：node opp-spectrum.mjs [--games=200] [--seeds=90210] [--mode=multi] [--arms=train9,train9tk]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

/* ROOT 自解析（归档规矩第 1 条：写死的机器路径在干净克隆里就是死链）‖ 测量常在 detached worktree 上做 ⇒ 留 `WT` 覆盖口 */
const HERE = path.dirname(path.resolve(fileURLToPath(import.meta.url)));
const ROOT = process.env.WT || process.env.EPIRUS_ROOT || path.resolve(HERE, '../../../..');
const AUD = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const V2 = await import(pathToFileURL(ROOT + '/tools/v2v4-lib.mjs').href);
const W = AUD.sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const SK = R.SK;

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Math.max(1, Number(arg('games', 200)) || 200);
const SEED0 = Number(arg('seeds', 90210)) || 90210;
const MODE = arg('mode', 'multi') === 'long' ? 'long' : 'multi';
const ARMS = String(arg('arms', 'train9,train9tk')).split(',').map(s => s.trim()).filter(Boolean);

/* 训练桌的 9 条 = `tools/train-3p.mjs:864` 那份表的**同一批函数**（从 EpirusBots 取，不抄名单） */
const TRAIN9 = [
  ['random', B.pickRandom], ['balanced', B.pickBalanced], ['aggro', B.pickAggro],
  ['defend', B.pickDefend], ['wall', B.pickWall], ['antidef', B.pickAntiDef],
  ['breakdef', B.pickBreakDef], ['mix', B.pickMix], ['farmer', B.pickFarmer]
];
if (typeof B.pickToolKit !== 'function') { console.error('⛔ EpirusBots.pickToolKit 不是函数 ⇒ 本尺没有对照'); process.exit(2); }
const TOOLKIT = [['toolkit', B.pickToolKit]];
for (const [nm, fn] of TRAIN9) { if (typeof fn !== 'function') { console.error('⛔ 训练桌少了一只：' + nm); process.exit(2); } }

const DEFENSE = new Set(R.skills.filter(s => s.cat === 'defense').map(s => s.key));
const CHAIN = [SK.CHARGE, SK.RAILGUN, SK.RING, SK.BIG_T, SK.MINI_T, SK.CANNON];
const CHAIN_LAB = ['蓄能', '炮', '环', '大雷', '小雷', '过载'];
const N = 5;

/* 占位参数：`duelAssembly` 会 `T.policyChooserN(params)`，但本尺逐席都换成了脚本 chooser ⇒ 那个 `ch` 永不触发，
 * 只需要形状合法。取一枚在册包，不新造权重。 */
const PARAMS = AUD.loadChamp(W, ROOT + '/docs/artifacts/SHIPPED-Ldemo-2026-10-11-pre-T8s114.bak');
if (!PARAMS || typeof PARAMS.length !== 'number') { console.error('⛔ 读不到占位包（loadChamp 给的不是参数向量）'); process.exit(2); }

function blank() {
  const b = { seatGames: 0, acts: 0, ji: 0, kinds: new Set(), epSum: 0, epN: 0, epMax: 0, def: 0, holo: 0, proto: 0, rounds: 0, games: 0 };
  for (const k of CHAIN) b['k_' + k] = 0;
  return b;
}

console.log('# §E676 前提尺 ‖ ROOT=' + ROOT + ' ‖ mode=' + MODE + ' ‖ ' + GAMES + ' 局/臂 ‖ seed ' + SEED0 +
  ' ‖ 桌=5 席全脚本（训练桌那 9 只，第二臂加 `st:toolkit`）');

for (const arm of ARMS) {
  const pool = arm === 'train9tk' ? TRAIN9.concat(TOOLKIT) : TRAIN9;
  const P = pool.map(function (p) { return p[1]; });
  const acct = {}; for (const [nm] of pool) acct[nm] = blank();
  let curState = null, gIdx = -1, map = {};

  const chooser = function (st, pid, legal) {
    if (st !== curState) {
      curState = st; gIdx++;
      map = {};
      for (let i = 0; i < N; i++) map[i] = gIdx % pool.length;
    }
    const a = acct[pool[map[pid]][0]];
    a.epSum += st.p[pid].ep; a.epN++; if (st.p[pid].ep > a.epMax) a.epMax = st.p[pid].ep;
    return P[map[pid]](st, pid, legal);
  };
  const onGame = function (st) {
    const pid0 = Number(Object.keys(map)[0]);
    const a = acct[pool[map[pid0]][0]];
    a.games++; a.rounds += Number(st.round) || 0; a.seatGames += N;
    for (const e of (st.events || [])) {
      if (!e || e.type !== 'action' || e.outcome !== 'ok') continue;
      const pid = Number(e.pid);
      if (!(pid in map)) continue;
      const b = acct[pool[map[pid]][0]];
      b.acts++;
      if (e.key === SK.JI) { b.ji++; continue; }
      b.kinds.add(e.key);
      if (DEFENSE.has(e.key)) b.def++;
      if (e.key === SK.HOLO) b.holo++;
      if (e.key === SK.PROTO) b.proto++;
      for (const k of CHAIN) if (e.key === k) b['k_' + k]++;
    }
  };

  for (let g = 0; g < GAMES; g++) {
    V2.duelAssembly({ S: S, Play: Play, T: T, R: R }, PARAMS,
      { games: 1, mode: MODE, seed0: SEED0 + g * 991, n: N, scripted: chooser, chooserFor: function () { return chooser; }, onGame: onGame });
  }

  console.log('\n=== 臂 ' + arm + '（桌内 ' + pool.length + ' 只 picker ‖ 一局 5 席同一只 = 镜像桌）===');
  console.log('picker       局   局长  出手/席/局 卡种(批内)  ジ占比  防御/席/局  holo  proto | ' +
    CHAIN_LAB.map(s => s.padStart(4)).join(' ') + ' |  ep均 ep最大');
  for (const [nm] of pool) {
    const a = acct[nm], SG = a.seatGames || 1;
    const per = function (x) { return (x / SG).toFixed(2); };
    console.log([nm.padEnd(10), String(a.games).padStart(4), (a.rounds / Math.max(1, a.games)).toFixed(1).padStart(5),
      per(a.acts).padStart(11), String(a.kinds.size).padStart(11), (100 * a.ji / Math.max(1, a.acts)).toFixed(0).padStart(7) + '%',
      per(a.def).padStart(11), per(a.holo).padStart(5), per(a.proto).padStart(6), '|',
      CHAIN.map(function (k) { return per(a['k_' + k]).padStart(4); }).join(' '), '|',
      (a.epSum / Math.max(1, a.epN)).toFixed(2).padStart(5), String(a.epMax).padStart(5)].join(' '));
  }
  let tot = 0, rg = 0; for (const [nm] of pool) { tot += acct[nm].games; rg += acct[nm]['k_' + SK.RAILGUN]; }
  console.log('  自证：局数合计 ' + tot + '（应为 ' + GAMES + '）‖ 本臂 RAILGUN 出手合计 ' + rg);
}
