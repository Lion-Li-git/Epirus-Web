/* 「序列机会率」（v1.5.278 · qoder 09-28 §E122 · 用户选定的那条**只读**诊断路线）
 * 问的是 §E121 留下的那一步：N=5 训练桌上"炮买不回来"到底是**哪一种**买不回来 ——
 *   (i) 根本不 `蓄能`（第一步就不发生 ⇒ 归因于**课程/行为面**，与 `ringW` 同病，§E97/§E120 的 (b)）
 *   (ii) 充了珠但**下一回合出不起/不合法**（归因于**经济出口**）
 *   (iii) 又出得起又合法却**没开炮**（归因于**目标函数/选择压力**，§E120 的 (a)）
 * 这三种在现有任何一把尺里都长成一个数（"炮/局低"），所以裁 (a)/(b) 之前必须先把它分开。
 *
 * ⚠ 三条设计约束（本仓的老账，逐条对应一次真实踩坑）：
 *   ① **口径必须成对报**：引擎里有一道"序列窗锁"（v1.5.149，`evo.js:477`），**只在 `epsMode==='soft'` 生效**
 *      ⇒ 训练评分那一路（temp 0.35 · ε=0.15 · 不带 mode）**锁不住**，产品那一路（temp 0.15 · ε=0.2 · k5 · soft）**锁得住**。
 *      所以本探针每个包都跑**两档口径**，只报其中一档就是撒谎（§E87 的"口径三元组"）。
 *   ② **观察者一律不改状态**：只读 `state`/`legal` 与 chooser 的返回值 ⇒ 读数与不接探针逐字相同。
 *   ③ **不许有"读不到就跳过"的兜底**：包读不出必须点名 + `exit 7`；自带判别力自证（全 0 权重的对照臂必须与真包不同），
 *      否则"机会率 = 0"可能是"探针根本没在看"。
 * 用法：node tools/probe-seq-opportunity.mjs [--packs=a.bak,b.js] [--games=200] [--n=5] [--seed=5200] [--self-test=1] [--json]
 */
import { sandbox, rejectUnknownFlags, loadChamp } from './audit-lib.mjs';
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'n', 'seed', 'self-test', 'json'], 'probe-seq-opportunity');
const flag = function (n, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + n + '=') === 0; }); return h ? h.split('=')[1] : d; };
const PACKS = String(flag('packs', 'js/bundled-champion-3p.js')).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const GAMES = Number(flag('games', 200));
const N = Number(flag('n', 5));
const SEED0 = Number(flag('seed', 5200));
const SELF = flag('self-test', '1') === '1';
const AS_JSON = process.argv.includes('--json');
if (!(GAMES >= 40)) { console.error('⛔ --games 必须 ≥40（更少时"兑现率"的分母是个位数，读数没有意义）'); process.exit(7); }
if (!(N >= 2 && N <= 5)) { console.error('⛔ --n 只认 2~5'); process.exit(7); }
if (!PACKS.length) { console.error('⛔ --packs 是空的'); process.exit(7); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const RG = R.SK.RAILGUN, CH = R.SK.CHARGE;

/* 训练桌的 9 个池内脚本（与 `train-3p.mjs:989` / `probe-dead-term` 同一份名单 ⇒ 不另立一张桌子） */
const POOL = [B.pickRandom, B.pickAggro, B.pickDefend, B.pickBalanced, B.pickAntiDef, B.pickBreakDef, B.pickWall, B.pickMix, B.pickFarmer];
const POOL_NAMES = ['random', 'aggro', 'defend', 'balanced', 'antidef', 'breakdef', 'wall', 'mix', 'farmer'];
const GEN = function (a) {
  let s = a | 0;
  return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

/* 两档口径：`train` = 每代评分里**被评席**的出厂形状（序列窗锁不生效）；`product` = 5 人产品那一路（锁生效） */
const CALIBERS = [
  { key: 'train', label: '训练评分口径 temp0.35·ε0.15·**无 mode ⇒ 序列窗锁不生效**', mk: function (p) { return T.policyChooserN(p, 0.35, 0.15); } },
  { key: 'product', label: '产品口径 temp0.15·ε0.2·k5·soft ⇒ 序列窗锁生效', mk: function (p) { return T.policyChooserN(p, 0.15, 0.2, 5, 'soft'); } }
];

function runOnce(params, mk, games, seedBase, observed) {
  /* `beadGained/beadSpent/beadExpiredUnits/heldAtEnd/chargeWhiff` 是为 §E122 那个**没解释干净的缺口**补的：
   *   `charges`（按下蓄能）比 `armed`（下一回合真持珠）多出一截 ⇒ 要么珠被"同回合内又过期/没活到决策点"吃掉（**口径伪影**），
   *   要么根本没充上（**真行为缺口**）。这两种修法完全相反，所以必须守恒地分开。
   * 守恒律（规则依据：`v1.5.82` 注释说"唯一消费电珠的卡是电磁炮"）：
   *   **`beadGained = beadSpent + beadExpiredUnits + heldAtEnd`**（一枚电珠只有三种下场）⇒ 不平就是尺坏了。 */
  const c = { decisions: 0, armed: 0, notOffered: 0, notAfford: 0, opp: 0, taken: 0, missed: 0, charges: 0, chargeWhiff: 0, refresh: 0, delta: 0, games: 0, expired: 0, firedReal: 0, beadGained: 0, beadSpent: 0, heldAtEnd: 0, rank: 0, evSum: 0 };
  /* ⚠ chooser 的返回**不是字符串**，是 `{key,target,target2,bead}`（`evo.js:553`）——
   *   第一版我写成 `k === RG` ⇒ 全表读成"兑现率 0.0%"，而独立那把尺（§E121）说现役炮 1.45/局。
   *   这类"读数自洽但作用点错"的错，只有**与另一把尺对表**才抓得住，所以本探针另外数**事件里的真开炮**（`firedReal`）。 */
  const keyOf = function (k) { return (k && typeof k === 'object') ? k.key : k; };
  for (let gi = 0; gi < games; gi++) {
    const seat = gi % N;
    const base = mk(params);
    /* 观察点包在真 chooser **外面**：读 (state,pid,legal) 与返回值，**一个字都不改**（约束 ②） */
    const wrapped = function (st, pid, legal) {
      const me = st.p[pid];
      c.decisions++;
      if (me && (me.elec || 0) > 0) {
        c.armed++;
        let entry = null;
        for (let i = 0; i < legal.length; i++) if (legal[i].key === RG) { entry = legal[i]; break; }
        if (!entry) c.notOffered++;
        else if (!entry.affordable) c.notAfford++;
        else {
          c.opp++;
          const r = base(st, pid, legal);
          const k = keyOf(r);
          if (k === RG) c.taken++; else c.missed++;
          /* R9' 允许"已持电珠再蓄能"= **只刷新不叠加** ⇒ 事件流仍给一条 `bead delta:+1`，但**没有新珠子产生**。
             这是电珠流的第一种"隐形下场"（不扣掉它就会算成"少了一枚珠"），必须显式记下来。 */
          if (k === CH) { c.charges++; if (((r && r.bead) || 'elec') === 'elec') c.refresh++; }
          return r;   // ⚠ 原样交回：构造新对象会吞掉 `target`/`bead` ⇒ 探针会**改变玩法**，那就不是在测这个包了
        }
      }
      const r2 = base(st, pid, legal);
      const k2 = keyOf(r2);
      if (k2 === CH) c.charges++;
      return r2;
    };
    const cs = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) cs.push(observed === false ? base : wrapped);
      else cs.push(POOL[(gi * 3 + pid) % POOL.length]);
    }
    const st = S.createState('multi', { next: GEN(seedBase + gi * 1013 + N * 31) }, N);
    Play.autoGameN(st, cs);
    c.games++;
    c.evSum += (st.events || []).length;
    for (const e of (st.events || [])) {
      if (e.pid !== seat) continue;
      if (e.type === 'beadExpire' && e.kind === 'elec') c.expired += (e.n || 1);
      if (e.type === 'action' && e.outcome === 'ok' && e.key === RG) c.firedReal++;
      if (e.type === 'bead' && e.kind === 'elec') {
        if (e.delta > 0) c.beadGained += e.delta; else c.beadSpent += -e.delta;
      }
      /* 按下蓄能但**没结算成珠**（禁用/资源不足/同回合已被别的动作挤掉）⇒ 真行为缺口的证据 */
      if (e.type === 'action' && e.key === CH && e.outcome && e.outcome !== 'ok') c.chargeWhiff++;
    }
    if (st.p[seat] && (st.p[seat].elec || 0) > 0) c.heldAtEnd++;
    /* 电珠流对账：**故意不做成硬闸** —— 实测两种方向都出现过失衡（净新增 5 vs 下场 6），
       说明"得到/过期/打出去"三条事件路径之外还有我没读干净的分支（`resolve.js:980` 那条重复蓄能结算、以及 `beadNew` 被清的时机）。
       这把尺的**主读数（armed/opp/taken/notAfford）是直接观测**，不依赖这本账 ⇒ 所以账目差额只**如实打印**，
       并只在"大到连描述性用途都不配"时（|Δ| > 净新增的 25%）才拒发读数。
       ⚠ 任何引用本表的行为解释都必须建立在直接观测上，**不许**用 Δ 反推"丢了多少珠"。 */
    c.delta = (c.beadGained - c.refresh) - (c.beadSpent + c.expired + c.heldAtEnd);
    if (T.rankOf(st, seat, seedBase + gi) === 1) c.rank++;
  }
  /* 守恒自检：计数不许凭空出现或消失（"探针看着像在工作其实没接上"是本仓的老病） */
  if (c.armed !== c.notOffered + c.notAfford + c.opp || c.opp !== c.taken + c.missed) {
    console.error('⛔ 计数不守恒（armed=' + c.armed + ' vs 拆分和=' + (c.notOffered + c.notAfford + c.opp) + '）⇒ 这把尺自己坏了，读数作废');
    process.exit(7);
  }
  return c;
}

const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '—'; };
const per = function (a, b) { return b ? (a / b).toFixed(2) : '—'; };

const rows = [];
const missing = [];
let refLen = 0;
for (const p of PACKS) {
  let params;
  try { params = loadChamp(W, p); } catch (e) { missing.push(p + '（' + String(e.message || e).split('\n')[0].slice(0, 60) + '）'); continue; }
  if (!params) { missing.push(p + '（没有可认的冠军外壳）'); continue; }
  if (!refLen) refLen = params.length;
  const byCal = {};
  for (const cal of CALIBERS) {
    const first = runOnce(params, cal.mk, GAMES, SEED0);
    if (SELF) {
      const again = runOnce(params, cal.mk, GAMES, SEED0);
      if (JSON.stringify(first) !== JSON.stringify(again)) {
        console.error('⛔ ' + p + ' @' + cal.key + ' 同参数连打两次计数不同 ⇒ **这把尺不可复现，读数作废**（§E102 的教训：先证调用本身可复现）');
        process.exit(7);
      }
      /* 中性自证（约束 ②）：把观察者摘掉再跑一遍 ⇒ **事件总数 / 真开炮数 / 夺冠数必须一字不差**，
         否则"我在测这个包"就是假的（观察点本身改了玩法）。 */
      const plain = runOnce(params, cal.mk, GAMES, SEED0, false);
      if (plain.evSum !== first.evSum || plain.firedReal !== first.firedReal || plain.rank !== first.rank) {
        console.error('⛔ ' + p + ' @' + cal.key + ' **接上观察者之后玩法变了**（事件 ' + plain.evSum + '→' + first.evSum +
          ' · 开炮 ' + plain.firedReal + '→' + first.firedReal + ' · 夺冠 ' + plain.rank + '→' + first.rank + '）⇒ 探针不是只读的，读数作废');
        process.exit(7);
      }
    }
    byCal[cal.key] = first;
  }
  rows.push({ pack: p, cal: byCal });
}
if (missing.length) {
  console.error('⛔ 有 ' + missing.length + ' 个包读不出 ⇒ 按失败处理（"读不到"绝不能被读成"机会率 0"）：');
  for (const m of missing) console.error('   · ' + m);
  process.exit(7);
}

/* 判别力自证：**全 0 权重**（= 均匀策略）必须与真包不同 ⇒ 否则"炮没兑现"可能是探针没在看 */
if (!refLen) { console.error('⛔ 拿不到权重维度（一个包都没读出来 ⇒ 探针无法自证判别力）'); process.exit(7); }
const zeroParams = new Array(refLen).fill(0);
const zeroRow = { pack: '(对照·全 0 权重 = 均匀策略)', cal: {} };
for (const cal of CALIBERS) zeroRow.cal[cal.key] = runOnce(zeroParams, cal.mk, GAMES, SEED0 + 7);
rows.push(zeroRow);
const selfLines = [];
for (const cal of CALIBERS) {
  const real = rows[0].cal[cal.key], z = zeroRow.cal[cal.key];
  const same = JSON.stringify(real) === JSON.stringify(z);
  /* ✓ 走 stdout（它是**读数的一部分**，下一班只会收 stdout），但 `--json` 时**必须让位**给纯 JSON；
     ⛔ 走 stderr 并非零退出（D177 那条：缺证据 ≠ 通过） */
  const line = '判别力自证 @' + cal.key + '：真包与均匀策略' + (same ? '**读数完全相同** ⇒ 这把尺没有判别力，本轮读数作废' : ' 读数不同（尺在工作）');
  if (same) { console.error('⛔ ' + line); process.exit(7); }
  selfLines.push('✓ ' + line);
}

if (AS_JSON) { console.log(JSON.stringify({ games: GAMES, n: N, seed: SEED0, rows: rows })); process.exit(0); }
for (const l of selfLines) console.log(l);
console.log('# 序列机会率（1 席被测 · 其余席 = 训练池 9 脚本轮转 · ' + N + ' 人 · ' + GAMES + ' 局/格 · seed' + SEED0 + '）');
console.log('# 判读钥匙：armed=持珠决策数 / opp=其中炮合法且出得起 / taken=其中真开炮 · 「充了珠却打不出」看 notAfford，「打得出没打」看 missed');
for (const cal of CALIBERS) {
  console.log('\n## 口径：' + cal.label);
  console.log('   包                                  armed/局  机会/局  兑现/局  兑现率  开炮(事件)  出不起   没打   蓄手/局  珠过期/局  夺冠');
  for (const r of rows) {
    const c = r.cal[cal.key];
    console.log('   ' + (r.pack.length > 34 ? r.pack.slice(-34) : r.pack.padEnd(34)) +
      '  ' + per(c.armed, c.games).padStart(6) + '  ' + per(c.opp, c.games).padStart(6) + '  ' + per(c.taken, c.games).padStart(6) +
      '  ' + pct(c.taken, c.opp).padStart(7) + '  ' + String(c.firedReal).padStart(9) + '  ' + String(c.notAfford).padStart(6) + '  ' + String(c.missed).padStart(5) +
      '  ' + per(c.charges, c.games).padStart(7) + '  ' + per(c.expired, c.games).padStart(8) + '  ' + pct(c.rank, c.games).padStart(6));
  }
  console.log('   —— 电珠流（原始计数；守恒律：**得到 − 刷新 = 打出去 + 过期 + 终局仍持有**；R9 引注的"已持珠再蓄能"只刷新不叠加，不扣就会假失衡）——');
  for (const r of rows) {
    const c = r.cal[cal.key];
    console.log('   ' + (r.pack.length > 34 ? r.pack.slice(-34) : r.pack.padEnd(34)) +
      '  得到=' + String(c.beadGained).padStart(4) + '  打出=' + String(c.beadSpent).padStart(4) +
      '  过期=' + String(c.expired).padStart(4) + '  终局持=' + String(c.heldAtEnd).padStart(4) +
      '  蓄能落空=' + String(c.chargeWhiff).padStart(4) + '  刷新=' + String(c.refresh).padStart(3) +
      '  持珠决策=' + String(c.armed).padStart(4) + '  Δ=' + String(c.delta).padStart(3));
    /* Δ 太大就不许把这本账当读数用（**直接观测 armed/opp/taken 不受影响**） */
    if (Math.abs(c.delta) > 0.25 * Math.max(1, c.beadGained - c.refresh)) {
      console.error('⛔ ' + r.pack + ' @' + cal.key + ' 电珠账目差额 |Δ|=' + Math.abs(c.delta) +
        ' 超过净新增的 25% ⇒ 这本账不具描述性（armed/opp/taken 仍可直接引用，Δ 不许用来推"丢了几枚珠"）');
      process.exit(7);
    }
  }
}
console.log('\n⚠ 读数解释的三条边界：');
console.log('  · **train 档的 `missed` 高不等于"包很蠢"** —— 那一档序列窗锁**不生效**（`evo.js:477` 只在 soft 生效），是**口径**在改判；');
console.log('  · **`armed` 很低才指向课程/行为面**（第一步不发生 ⇒ 任何"抬那一步的价格"的旋钮都够不到，§E120 的 `SEQ_W` 正是这个形状）；');
console.log('  · 本表与 `probe-wasted-play` / `behavior-profile` **不是同一把尺**（那边数"出手/落地"，这里数"决策点上的可行性"），数字不许互换。');
