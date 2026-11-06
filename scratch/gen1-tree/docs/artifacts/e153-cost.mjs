import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E153 可行性的一半是**算力**：信念表 + 1-ply 搜索这条路的代价不在"换代"，在"每个决策要重放多少局"。
 * 浏览器里能不能受住，取决于两个数：① 每决策的候选数（= 重放次数）② 单次重放的墙钟毫秒。
 * 本仪器把两者都量出来，并按"UI 一回合要替 4 个 AI 席位做决策"折算成**玩家能感知的每回合延迟**。
 * ⚠ 只读引擎、不改任何文件；机器上同时还有别的批在跑 ⇒ **这台量的是上界**（并发抢核会让毫秒数偏大），
 *   真要钉产品结论得单独复跑一次。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 12));
const SEED = Number(arg('seed', 77000));

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay, X = W.EpirusResolve;
const packFile = arg('pack', 'js/bundled-champion-3p.js');
const mm = readFileSync(REPO + packFile, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
const V1 = st => { const me = st.p[0]; const o = st.p.filter((p, i) => i !== 0 && p.hp > 0);
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0); };
function replay(snap, seed, picks) {
  const st = S.cloneState(snap);
  st.rng = { next: T.mulberry32(seed) };
  for (let pid = 0; pid < picks.length; pid++) {
    const pk = picks[pid]; if (!pk) continue;
    const p = st.p[pid]; if (!p || p.hp <= 0) continue;
    S.attemptAction(st, pid, pk.key, { bead: pk.bead || (p.elec > p.boom ? 'boom' : 'elec'), target: pk.target, target2: pk.target2 });
  }
  X.resolveActions(st); X.endTurn(st);
  return st;
}
const norm = c => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2, bead: c.bead });
const sig = p => [Math.min(5, p.ep >> 1), p.ep >= 5 ? 1 : 0, p.lastSkill || '-'].join('/');

let dec = 0, cands = 0, msSearch = 0, msResolve = 0, msPack = 0, packCalls = 0, rounds = 0;
for (let g = 0; g < GAMES; g++) {
  const TAB = new Map();
  const st = S.createState('multi', { next: T.mulberry32(SEED + g * 104729) }, 5);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + g * 104729);
  const sel = T.policyChooserN(params, 0.15);
  let keyAt = null, actual = [null, null, null, null, null];
  const subject = function (s, pid, legal) {
    const t0 = process.hrtime.bigint();
    const ds = ((++dec) * 2654435761) >>> 6;
    const use = legal.filter(l => l.affordable);
    const cs = P.candidatesFor(s, pid, use.length ? use : [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
    /* 对手预测：只用可观测面的在线频次表（§E152d 里最便宜又保得住大头的形状） */
    keyAt = [null, null, null, null, null];
    const opp = [null];
    for (let i = 1; i < 5; i++) {
      if (s.p[i].hp <= 0) { opp.push(null); continue; }
      keyAt[i] = 'S' + i + '@' + sig(s.p[i]);
      const m = TAB.get(keyAt[i]);
      let bk = R.SK.JI, bv = -1;
      if (m) for (const k in m) if (m[k] > bv) { bv = m[k]; bk = k; }
      opp.push({ key: bk, target: null, target2: null, bead: null });
    }
    cands += cs.length;
    let best = cs[0], bv = -1e9;
    for (let ci = 0; ci < cs.length; ci++) {
      const t1 = process.hrtime.bigint();
      const v = V1(replay(s, ds + ci * 7919, [norm(cs[ci])].concat(opp.slice(1))));
      msResolve += Number(process.hrtime.bigint() - t1) / 1e6;
      if (v > bv + 1e-9) { bv = v; best = cs[ci]; }
    }
    msSearch += Number(process.hrtime.bigint() - t0) / 1e6;
    return norm(best);
  };
  /* 对照：现役包自己一次决策要多久（它就是产品现在每一格 AI 的真实开销）。
     ⚠ 计时要挂在**真的被调到的那条路**上：我第一版另写了一个从没进 `autoGameN` 的 `probe` ⇒ `packCalls=0`、除数是 0、印出 NaN。
     ⚠ 且复用每局建好的 `sel`，不要把 `policyChooserN(...)` 的**构造**成本算进单次决策（产品是每局建一次）。 */
  const mk = i => function (s, pid, legal) {
    const t0 = process.hrtime.bigint();
    const lg = legal.filter(l => l.affordable);
    const c = sel(s, pid, lg.length ? lg : legal);
    msPack += Number(process.hrtime.bigint() - t0) / 1e6; packCalls++;
    actual[pid] = norm(c); return actual[pid];
  };
  const onTurn = function () {
    for (let i = 1; i < 5; i++) {
      if (!keyAt || !keyAt[i] || !actual[i]) continue;
      let m = TAB.get(keyAt[i]); if (!m) { m = {}; TAB.set(keyAt[i], m); }
      m[actual[i].key] = (m[actual[i].key] || 0) + 1;
    }
    keyAt = null;
  };
  Play.autoGameN(st, [subject, mk(0), mk(1), mk(2), mk(3)], onTurn, null);
  rounds += st.round;
}
const perDec = msSearch / dec, perResolve = msResolve / cands;
if (!packCalls) { console.error('⛔ 一次"现役包决策"都没计时到 ⇒ 对照那条路没接上，倍差不存在（别印 NaN 糊过去）'); process.exit(1); }
console.log('# §E153 算力可行性 ‖ 局=' + GAMES + ' ‖ 被测席决策 ' + dec + ' 次');
console.log('  每决策候选数（= 重放次数）均值 ' + (cands / dec).toFixed(1));
console.log('  单次重放 resolve ' + perResolve.toFixed(3) + ' ms   ‖ 一次搜索决策合计 ' + perDec.toFixed(2) + ' ms');
console.log('  现役包一次决策 ' + (msPack / packCalls).toFixed(3) + ' ms（同机对照 ⇒ 比值就是"贵多少倍"）');
console.log('  ⇒ 搜索型 chooser 比现役包贵 **' + (perDec / (msPack / packCalls)).toFixed(1) + '×**');
console.log('  玩家可感知的等待：一回合 4 个 AI 席各做一次 ⇒ 约 ' + (4 * perDec).toFixed(0) + ' ms/回合（本批平均 ' + (rounds / GAMES).toFixed(1) + ' 回合/局）');
console.log('  ⚠ 本机此刻还有其他批在跑 ⇒ 这些毫秒是**上界**；要钉产品结论请单独复跑（`--games=40`）。');
