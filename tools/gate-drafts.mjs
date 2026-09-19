/* 守门草稿（给 np-test 用）：三条"必须能失败"的行为断言
 * 用法：node tools/gate-drafts.mjs        # 打印每条在当前代码/现上线包上的实际结论（PASS/FAIL）
 * 设计原则（对齐本项目 L1/L7 教训）：
 *   ① 断言的是**行为**，不是源码字符串；
 *   ② 凡是"验收某个能力"的门，先用**合成策略**证明**测量工具本身有判别力**，再拿去量冠军
 *      —— 否则会出现"探针永远测不出失败"的假通过（v1.5.44 的教训）。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
/* v1.5.133：G4 的「1 席脚本 vs 4 席被测」装配本体在 `tools/v2v4-lib.mjs` 的 `duelAssembly()`（单一来源）。 */
import { duelAssembly } from './v2v4-lib.mjs';

const REPO = process.cwd() + '/';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy;
/* v1.5.129：G4 的「珠爆发」格**直接复用 bots.js 的实现**（见 COUNTERS 里那一格的注释）——
 * 本脚本的文件头 vm 清单本来就加载 `js/train/bots.js`，所以拿得到同一个函数对象。 */
const B = sb.window.EpirusBots;
const CH = P.unpack(sb.window.EPIRUS_CHAMPION_3P);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 公共工具 ---------- */
const ROLLER = function (state, pid, legal) {
  const r = legal.find(l => l.key === R.SK.RING && l.affordable);
  return r ? { key: R.SK.RING, target: null } : { key: R.SK.JI, target: null };
};
const IDLER = function () { return { key: R.SK.JI, target: null }; };
const ATTACKER = function (state, pid, legal) {
  const g = legal.find(l => l.key === R.SK.GUN && l.affordable);
  return g ? { key: R.SK.GUN, target: T.pickTargetN(state, pid, R.SK.GUN) } : { key: R.SK.JI, target: null };
};
/* 合成策略 1：会瞄 —— 付得起小雷且有滚环者 ⇒ 砸滚环者；否则攒钱 */
function aimedPolicy(me) {
  return function (state, pid, legal) {
    const mt = legal.find(l => l.key === R.SK.MINI_T && l.affordable);
    if (mt) {
      let tgt = -1, best = 0;
      for (let q = 0; q < state.p.length; q++) {
        if (q === pid || state.p[q].hp <= 0) continue;
        const rs = state.p[q].ringStreak || 0;
        if (rs > best) { best = rs; tgt = q; }
      }
      if (tgt >= 0) return { key: R.SK.MINI_T, target: tgt };
    }
    return { key: R.SK.JI, target: null };
  };
}
/* 合成策略 2：仪式 —— 一付得起就砸"最小 pid 的存活对手"，完全不看有没有环 */
function ritualPolicy() {
  return function (state, pid, legal) {
    const mt = legal.find(l => l.key === R.SK.MINI_T && l.affordable);
    if (mt) {
      for (let q = 0; q < state.p.length; q++) if (q !== pid && state.p[q].hp > 0) return { key: R.SK.MINI_T, target: q };
    }
    return { key: R.SK.JI, target: null };
  };
}

/* 在"1 滚环 + 3 旁观 + 1 被测席"的场里数：小雷出手数、砸中滚环者的比例 */
function probeField(policyFn, opts) {
  const mode = opts.mode || 'long', G = opts.games || 30, ringerSeat = opts.ringerSeat == null ? 3 : opts.ringerSeat;
  let casts = 0, atRinger = 0, voidedByMe = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(1234 + g * 13) }, 5);
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === ringerSeat ? ROLLER : (i === opts.me ? policyFn : IDLER));
    Play.autoGameN(st, cs.map((c, idx) => function (s2, pid, legal) {
      const r = c(s2, pid, legal);
      const k = typeof r === 'string' ? r : r.key;
      if (idx === opts.me && k === R.SK.MINI_T) {
        casts++;
        if (r.target === ringerSeat) atRinger++;
      }
      return r;
    }));
    for (const e of st.events) if (e.type === 'voided' && e.byPid === opts.me && e.pid === ringerSeat) voidedByMe++;
  }
  return { casts: casts, atRinger: atRinger, voidedByMe: voidedByMe, games: G };
}
/* 没有滚环者的同一场（把滚环席换成普通攒钱者） */
function probeFieldNoRinger(policyFn, opts) {
  const G = opts.games || 30;
  let casts = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(opts.mode || 'long', { next: mulberry32(1234 + g * 13) }, 5);
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === opts.me ? policyFn : IDLER);
    Play.autoGameN(st, cs.map((c, idx) => function (s2, pid, legal) {
      const r = c(s2, pid, legal);
      if (idx === opts.me && ((typeof r === 'string') ? r : r.key) === R.SK.MINI_T) casts++;
      return r;
    }));
  }
  return { casts: casts, games: G };
}

/* ---------- 座位偏置：同策略自对局的夺冠极差 ---------- */
/* ⚠️ v1.5.78（Cyclone 采用时修）：这里**必须设 `slotSalt`**。
 * 第七轮草稿漏了它 ⇒ 所有对局共用同一个槽位盐 ⇒ 若策略存在"身份通道"，它会被放大而不是被洗掉
 * （同轮他们自己在 §14-1 已承认 `slotSalt = g*2654435761` 与 `g%5` 相关会造出假数；
 *  但 G3 这条是"完全没设"）。盐用 avalanche 散列并与轮座去相关。 */
function seatSpread(chooserFactory, mode, G) {
  const w = [0, 0, 0, 0, 0]; let draw = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(60000 + g * 7) }, 5);
    st.slotSalt = h32pre(60000 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(chooserFactory());
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++; else w[st.winner]++;
  }
  const decided = G - draw;
  const pct = w.map(x => x / G);
  return { pct: pct, decided: decided, spread: Math.round(100 * (Math.max(...pct) - Math.min(...pct))) };
}
/* h32 提到前面（seatSpread 要用；原定义在 G4 段） */
function h32pre(n) {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

const out = [];
/* v1.5.89：三种状态，不是两种 —— `UNRUN` = **本门跑不了/不可判**（如 harness 基线异常）。
 * 为什么必须分开：v1.5.78 的病根是"把没跑/没判的当成过了"。用一个 FAIL 去表达"不可判"同样有害 ——
 * 它会把"量具没量出来"伪装成"候选不合格"，而 promote-champion 只认 FAIL ⇒ 两者被读成同一个结论。
 * 与 `audit-lib.seatSymmetry` 的 underpowered 第三态同一套规矩。 */
function gate(name, pass, detail, unrun) {
  const st = unrun ? 'UNRUN' : (pass ? 'PASS' : 'FAIL');
  out.push({ name: name, pass: !!pass, unrun: !!unrun, detail: detail });
  console.log('  ' + st + '  ' + name + '\n        ' + detail);
}
const statusOf = function (g) { return g.unrun ? 'UNRUN' : (g.pass ? 'PASS' : 'FAIL'); };

console.log('=== G1 探针判别力（元测试：测量工具本身能不能区分"会瞄"与"仪式"）===');
{
  const a = probeField(aimedPolicy(), { me: 0, games: 30 });
  const b = probeField(ritualPolicy(), { me: 0, games: 30 });
  const accA = a.casts ? a.atRinger / a.casts : 0;
  const accB = b.casts ? b.atRinger / b.casts : 0;
  gate('G1 判别场必须让"会瞄"与"仪式"得出不同结论',
    a.casts > 0 && b.casts > 0 && accA - accB >= 0.4,
    `会瞄席：出手 ${a.casts}、砸中滚环者 ${(100 * accA).toFixed(0)}%、可归因作废 ${a.voidedByMe}   ||   ` +
    `仪式席：出手 ${b.casts}、砸中 ${(100 * accB).toFixed(0)}%、可归因作废 ${b.voidedByMe}   ⇒ 差 ${(100 * (accA - accB)).toFixed(0)}pt`);
  /* 对照：把它们丢进**现有的** ringWallProbe（1 冠军 + 4 席全滚环）看能否区分 */
  try {
    const al = await import('file:///' + REPO.replace(/\\/g, '/') + 'tools/audit-lib.mjs');
    if (al.ringWallProbe) {
      const mk = (fn) => ({ EpirusRules: R, EpirusState: S, EpirusPlay: Play, EpirusTrainer: Object.assign({}, T, { policyChooserN: () => fn }), EpirusBots: sb.window.EpirusBots, EpirusPolicy: P });
      const pa = al.ringWallProbe(mk(aimedPolicy()), null, 'multi', 20);
      const pb = al.ringWallProbe(mk(ritualPolicy()), null, 'multi', 20);
      console.log(`        （对照）现有 ringWallProbe 看到的：会瞄席 miniTCasts=${pa.miniTCasts} 仪式席 miniTCasts=${pb.miniTCasts}` +
        ` ⇒ 若两者接近，说明**现有探针无判别力**，这就是 v1.5.44 假通过的机制`);
    }
  } catch (e) { console.log('        （现有探针对照跳过：' + e.message + '）'); }
}

console.log('\n=== G2 换人反证（把唯一滚环者换成不滚环 ⇒ 出手必须显著下降）===');
{
  const withR = probeField(aimedPolicy(), { me: 0, games: 30 });
  const noR = probeFieldNoRinger(aimedPolicy(), { me: 0, games: 30 });
  gate('G2 "会瞄"策略必须满足：无环时出手数 ≤ 有环时的 25%',
    withR.casts > 0 && noR.casts <= 0.25 * withR.casts,
    `有环 ${withR.casts} 次 → 无环 ${noR.casts} 次（合成"会瞄"策略上应成立；再用同一函数量冠军，才知冠军是不是真在读状态）`);
  const cw = probeField(T.policyChooserN(CH, 0.15), { me: 0, games: 40 });
  const cn = probeFieldNoRinger(T.policyChooserN(CH, 0.15), { me: 0, games: 40 });
  console.log(`        现上线冠军实测：有环 ${cw.casts} 次（砸中滚环者 ${cw.atRinger}）、无环 ${cn.casts} 次 ⇒ 出手太少，此门对冠军**暂不可判**（需先有自然出手）`);
}

console.log('\n=== G3 座位偏置（同策略自对局的夺冠极差）===');
const N3 = Number(process.env.GATE3_GAMES || 200);
for (const mode of ['long', 'multi']) {
  const s = seatSpread(() => T.policyChooserN(CH, 0.15), mode, N3);
  gate(`G3[${mode}] 5 席同一冠军：座位夺冠率极差 ≤ 15pt`,
    s.decided >= 40 && s.spread <= 15,
    `各座 ${s.pct.map(x => Math.round(100 * x) + '%').join(' ')}  有胜负局 ${s.decided}/${N3}  极差 ${s.spread}pt` +
    (s.decided < 40 ? '  （注：无胜负局太少则本门不可判，必须先保证场地能分出胜负）' : ''));
}

/* ---------- G4 / G5 / G6（v1.5.77 第七轮实测的可反证形式） ----------
 * 三条共同点：① 断言**行为**；② 每条先跑**合成参照系**证明量具本身有判别力，再量冠军；
 * ③ 盐必须与轮座**去相关**（第六轮踩过：`slotSalt = f(g)` 与 `g % 5` 完全相关 ⇒ 基线自检出假数）。
 */
const h32 = h32pre;   // 单一实现（原为两份函数体，v1.5.78 合并，避免漂移）
/* v1.5.78：既接受 `.bak` 产物，也接受**线上包/bundle**（promote-champion 会把候选直接传进来）。
 * 原来的写法只会切 `{"v": …}` 到**最后一个 `}`** ⇒ 传 bundle 时会把 meta 也吞进去而解析失败。 */
function loadBakParams(f) {
  const t = readFileSync(REPO + f, 'utf8');
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
  if (m) { const r = P.loadAny(JSON.parse(m[1])); if (r && r.params) return r.params; }
  const j = JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1));
  const r = P.loadAny(j);
  return r && r.params ? r.params : null;
}
const EXTRA = process.argv.slice(2).filter(function (a) { return /\.bak$/.test(a); });
const PACKS = [['线上包', CH]].concat(EXTRA.map(function (f) {
  return [f.replace(/^.*artifacts\//, '').replace(/\.bak$/, ''), loadBakParams(f)];
}).filter(function (x) { return !!x[1]; }));
const N4 = Number(process.env.GATE4_GAMES || 60);
const N6 = Number(process.env.GATE6_GAMES || 40);

const aff = function (l, k) { return l.find(function (x) { return x.key === k && x.affordable; }) ? { key: k } : null; };
const pT = function (st, pid, o) { return { key: o.key, target: o.target != null ? o.target : T.pickTargetN(st, pid, o.key) }; };
// ⚠️ 这张表必须包含"最便宜的攻击卡（枪 1ジ）"：第七轮就是因为漏了它，把线上包误判成"无一行脚本能打穿 45%"，
//    实测真值是长程 65%（见 docs/AUDIT-RESPONSE-v1.5.85.md §6）。删行前先确认基线格与成本梯度都还在。
const COUNTERS = {
  '只防御(不还手)': function (st, pid, legal) { return aff(legal, R.SK.GUARD) ? { key: R.SK.GUARD, target: null } : { key: R.SK.JI, target: null }; },
  '只枪(1ジ压制·打最肥)': function (st, pid, legal) { return aff(legal, R.SK.GUN) ? pT(st, pid, { key: R.SK.GUN }) : { key: R.SK.JI, target: null }; },
  '只狙击': function (st, pid, legal) { return pT(st, pid, aff(legal, R.SK.SNIPE) ? { key: R.SK.SNIPE } : { key: R.SK.JI }); },
  '激光剑连刺': function (st, pid, legal) { return pT(st, pid, aff(legal, R.SK.SWORD) ? { key: R.SK.SWORD } : { key: R.SK.JI }); },
  '坦克线': function (st, pid, legal) { return pT(st, pid, aff(legal, R.SK.TANK) ? { key: R.SK.TANK } : { key: R.SK.JI }); },
  '滚环流': function (st, pid, legal) {
    if (aff(legal, R.SK.BIG_T)) return pT(st, pid, { key: R.SK.BIG_T });
    return st.p[pid].ep >= 3 && aff(legal, R.SK.RING) ? { key: R.SK.RING, target: null } : { key: R.SK.JI, target: null };
  },
  '瞄威胁者(1ジ枪)': function (st, pid, legal) {
    if (aff(legal, R.SK.GUN)) {
      for (let q = 0; q < st.p.length; q++) {
        if (q === pid || st.p[q].hp <= 0) continue;
        if (st.p[q].ringStreak >= 1 || st.p[q].ep >= 5 || st.p[q].lastSkill === R.SK.SNIPE) return { key: R.SK.GUN, target: q };
      }
    }
    return { key: R.SK.JI, target: null };
  },
  /* ===== v1.5.129（第三方复核 §3 的实锤线）：珠爆发「ジ→蓄电珠→电磁炮，残血摄魂收尾」=====
   * 它是**唯一一格"要先花钱蓄珠、再用珠开火"的脚本** —— 原有七格全是"付得起就直接用那一张"，
   * 所以"会不会防电 / 会不会花珠"这件事**在 G4 里从来没被考过**。
   * ⚠️ **但它在 5 席 harness 里不是杀手**（v1.5.129 实测 n=60/格）：本格 **30%(long) / 15%(multi)**，
   *    而基线是 18% / 10% ⇒ 有牙（远高于"什么都不做"档的 坦克线 12% / 只防御 13%），但**打不过"只枪"的 75%**。
   *    复核那条 99~100% 是 **1v1（2P）** 量出来的（本仓同口径复现：`standard` 200 局
   *    **100% 胜 · 均 9.2 回合**，见 `tools/p2-baselines.mjs` 的 `beadburst`）。
   * ⇒ 教训（已进 `docs/METHODOLOGY.md` §E.38）：**判据的座位数必须匹配洞的座位数** ——
   *    G4 结构上只跑 5 席，所以任何"1v1 专用洞"它都看不见。留着这一格是为了**池子覆盖类型**
   *    （将来包的 2 席行为若退化，这里能看见），但**真正的信号在 2P 考卷那一侧**。
   * ⚠️ 实现**直接复用 `js/train/bots.js` 的 `pickBeadBurst`**（同一个函数对象），不在这里抄第二份 ——
   *    "同一规则两处维护"是本仓栽过四次的老病（见 `tools/p2-baselines.mjs` 文件头）。
   *    口径：击杀优先 → 压血量最高者（与 `pT` 用的 `T.pickTargetN` 同口径），并列随机走 `state.rng`
   *    ⇒ 可复现、且**不按 pid 取人**（避免重新引入座位身份通道 D50/D58 家族）。 */
  '珠爆发(ジ→蓄电珠→电磁炮/摄魂)': B.pickBeadBurst,
};
/* 1 席脚本 vs 4 席被测；fn==='champ' ⇒ 5 席同策略（= 基线，期望 ≈20%）
 * v1.5.133：**装配本体移到 `tools/v2v4-lib.mjs` 的 `duelAssembly()`**（单一来源）—— 原先它只存在于这里，
 *   于是任何"想解剖 G4 到底输在哪"的探针都只能抄一份（本仓"同一规则两处维护必然漂移"栽过四次）。
 *   口径一个字都没动（seed0=90210、`seat = g%5`、`slotSalt`、chooser 0.15）⇒ **本工具的 G4 全表读数
 *   必须逐字不变**，这是重构的验收条件（自己就是探针的 `probe-g4-anatomy.mjs` §A 也拿这条当自检）。 */
function duel(params, fn, mode, G, seed0) {
  const r = duelAssembly({ S: S, Play: Play, T: T, R: R, B: B }, params,
    { games: G, mode: mode, seed0: seed0, scripted: fn === 'champ' ? 'champ' : fn });
  return { win: r.winPct, draw: r.drawPct };
}

/* ===== v1.5.104（**用户裁定**）：G4 阈值 45% → **60%**（标定理由必须与阈值写在一起）=====
 * 原阈值 45% 的标定包是 `v7f3-94`（5%/5%）。但 v1.5.89 补入「只枪(1ジ压制·打最肥)」这一格后，
 * **在位包自己在 G4[long] 就是 65%** ⇒ 45% 成了**现役包都达不到的线**：用它否候选 =
 * "拿一个不存在的标准判人"（第十轮复核 §6 也指出：候选② 有四格同时贴 49~53%）。
 * ⇒ 重新标定到 **60%**：① **在位包仍过不了**（long 65%）⇒ 判别力没丢（比现役更脆的仍判红）；
 *    ② 候选 `v7seat24-31`（long 54% / multi 51%）通过 ⇒ 判据回到"可达、且优于现役"。
 * ⚠️ **理想线仍然是 45%**（第七轮标定值）：通过 60% 但没到 45% 的，判词里会显式写出差距，
 *    免得"绿灯"被误读成"已达理想"。 */
const G4_MAX = 60, G4_IDEAL = 45;
/* ===== v1.5.129（用户裁定②，配合 `np-test D67`）：**克制表口径 id** = 键序 + 阈值 的 sha1 前 8 位 =====
 * 动机：D67 现在允许"线上包 G4 全红"以**已记录的 `--force` 例外**通过（promote-champion 把越线条件
 * 写进 meta）。但例外必须与**当时那张克制表**绑定 —— 否则"改了池子之后旧记录继续免检"会变成一个新洞，
 * 而那正是本仓最忌讳的形态："门看着在、其实没判"（v1.5.89 的"主语错位"同族）。
 * ⇒ promote-champion 把本 id 记进 `meta.gate4Pool`，D67 只在**口径 id 相等**时才认这条例外。 */
const G4_POOL_ID = (function () {
  const h = createHash('sha1');
  h.update('G4_MAX=' + G4_MAX + '\n');
  Object.keys(COUNTERS).forEach(function (k) { h.update(k + '\n'); });
  return h.digest('hex').slice(0, 8);
})();
/* ===== qoder-research 0920（RESEARCH-LOG §3-2 · 缝自曝于 v1.5.133 §5）：**实现身份 id**，与口径 id 分家 =====
 * 病：`G4POOL` 只绑"键序 + 阈值" ⇒ **改某一格的 chooser 实现**（不改键名/阈值）时 id 不变，
 * 线上包 meta 里的 `--force` 例外会**继续免检** —— 门的"口径"换了血而账不变。
 * `G4IMPL` = 各格 chooser 源码 + `pT`（目标选择器本体；珠爆发格外挂 `B.pickBeadBurst`，
 * 其函数体由 `String(fn)` 天然带入）的 sha1，CRLF⇒LF 归一（本仓是混合换行，v1.5.129 §7-4）。
 * ⚠️ **为什么不并进 G4POOL**：那会让在位包的例外当场失效，而在位包此刻**行为并没有变** ——
 *   迁移走"另发一个 id + D67 的冻结豁免基准"（基准 = 该 id 在 v1.5.134 实现下的值，写死在 D67）。 */
const G4_IMPL_ID = (function () {
  const norm = function (x) { return String(x).replace(/\r\n?/g, '\n'); };
  const h = createHash('sha1');
  h.update('pT:' + norm(pT) + '\n');
  Object.keys(COUNTERS).forEach(function (k) { h.update(k + ' ' + norm(COUNTERS[k]) + '\n'); });
  return h.digest('hex').slice(0, 8);
})();

console.log('\n=== G4 一行脚本克制表（任何克制格 > ' + G4_MAX + '% 即红 · 理想线 ' + G4_IDEAL +
  '%；基线格必须 ≈20% 否则本门不可判）===');
/* 机器可读的口径 id（promote-champion 与 np-test D67 都解析这一行）——
 * 与 `PASS/FAIL <标题>` 同属对外契约：改这一行的格式要同步改那两处。 */
console.log('   G4POOL ' + G4_POOL_ID + '（克制表口径 id = 键序 + G4_MAX 的 sha1 前 8 位 · 格数 ' +
  Object.keys(COUNTERS).length + '；换一格或改阈值 ⇒ 这个 id 必变）');
/* 对外契约第二行（promote-champion 记进 meta.gate4Forced.impl / np-test D67 比对；改格式同步那两处） */
console.log('   G4IMPL ' + G4_IMPL_ID + '（实现身份 id = 各格 chooser 源码 + pT 的 sha1 前 8 位 · 改任何一格**行为**必变）');
for (const [nm, p] of PACKS) {
  for (const mode of ['long', 'multi']) {
    const base = duel(p, 'champ', mode, N4, 90210);
    const cells = Object.keys(COUNTERS).map(function (k) { return [k, duel(p, COUNTERS[k], mode, N4, 90210).win]; });
    const worst = cells.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
    const judgeable = base.win >= 8 && base.win <= 32;
    /* v1.5.89②：把**最克那一格**写进标题（原先只在 detail 里）。动机：promote-champion 只解析
     * `PASS/FAIL <标题>` 这一行 ⇒ 标题里只有基线时，判词读起来像"这条过了"（实测时连作者都被它误导），
     * 而"为什么红"完全看不见 —— 判词必须与被判的那一格绑在一起。 */
    gate(`G4[${nm}/${mode}] 无一行脚本能以 >${G4_MAX}% 击败它（最克「${worst[0]}」${worst[1]}% · 基线 ${base.win}%/${N4}局）`,
      judgeable && worst[1] <= G4_MAX,
      `基线 ${base.win}%（${judgeable ? '可判' : '⚠️ 不可判：harness 基线异常 ⇒ 本格 UNRUN，**不得当作通过**'}）  各格 ` +
      cells.map(function (c) { return c[0] + ' ' + c[1] + '%'; }).join(' · ') +
      `   ⇒ 最克它的脚本：「${worst[0]}」${worst[1]}%` +
      (judgeable && worst[1] > G4_MAX ? `   ⇒ **红的理由**：这一格 ${worst[1]}% > ${G4_MAX}%` : '') +
      (judgeable && worst[1] <= G4_MAX && worst[1] > G4_IDEAL
        ? `   ⚠️ 过闸，但**距理想线 ${G4_IDEAL}% 还差 ${worst[1] - G4_IDEAL}pt**（这里不是"已达理想"）` : ''),
      !judgeable);
  }
}

console.log('\n=== G5 破防反射（1 席只防御 + 4 席被测：防席夺冠必须 ≤25%）===');
for (const [nm, p] of PACKS) {
  const ch = T.policyChooserN(p, 0.15);
  for (const mode of ['long', 'multi']) {
    let defWin = 0, pierceHit = 0, toDef = 0, defHp = 0;
    for (let g = 0; g < N4; g++) {
      const seat = g % 5;
      const st = S.createState(mode, { next: mulberry32(7000 + g * 997) }, 5);
      st.slotSalt = h32(7000 + g * 2246822519);
      const def = function (s2, pid, legal) { return aff(legal, R.SK.GUARD) ? { key: R.SK.GUARD, target: null } : { key: R.SK.JI, target: null }; };
      const cs = []; for (let i = 0; i < 5; i++) cs.push(i === seat ? def : ch);
      Play.autoGameN(st, cs.map(function (c, idx) { return function (s2, pid, legal) {
        const r = c(s2, pid, legal); const k = typeof r === 'string' ? { key: r, target: T.pickTargetN(s2, pid, r) } : r;
        if (idx !== seat && R.ATK_EFFECT.indexOf(k.key) >= 0 && k.target === seat) {
          toDef++;
          const card = R.byKey[k.key];
          if (card && card.pierce && card.pierce.defense) pierceHit++;
        }
        return k;
      }; }));
      defHp += Math.max(0, st.p[seat].hp);
      if (st.winner === seat) defWin++;
    }
    const pct = Math.round(100 * defWin / N4);
    gate(`G5[${nm}/${mode}] 面对"只防御不还手"必须能清场（实测防席夺冠 ${pct}% · 阈值 ≤25%）`, pct <= 25,
      `防席夺冠 ${pct}%  终局血量 ${(defHp / N4).toFixed(1)}  打它的攻击 ${(toDef / N4).toFixed(1)}/局` +
      `  其中**穿透防御**的 ${(pierceHit / N4).toFixed(1)}/局 ⇒ ${pct > 25 ? '缺"目标免疫普通攻击 ⇒ 换穿透卡"的反射' : '破防反射在'}`);
  }
}

console.log('\n=== G6 靶向率（先证明量具有判别力，再量冠军；≥40% 才叫会瞄威胁）===');
function aimRateOnRingField(chooser, G) {
  let atk = 0, onThreat = 0;
  for (let g = 0; g < G; g++) {
    const victim = g % 5;
    const st = S.createState('long', { next: mulberry32(4400 + g * 997) }, 5);
    st.slotSalt = h32(4400 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === victim ? ROLLER : chooser);
    Play.autoGameN(st, cs.map(function (c, idx) { return function (s2, pid, legal) {
      const r = c(s2, pid, legal); const k = typeof r === 'string' ? { key: r, target: T.pickTargetN(s2, pid, r) } : r;
      if (idx !== victim && R.ATK_EFFECT.indexOf(k.key) >= 0 && k.target != null) {
        atk++;
        const q = s2.p[k.target];
        if (q && (q.ringStreak >= 1 || q.ep >= 5 || q.lastSkill === R.SK.SNIPE)) onThreat++;
      }
      return k;
    }; }));
  }
  return { rate: atk ? 100 * onThreat / atk : 0, atk: atk };
}
{
  const ref1 = aimRateOnRingField(COUNTERS['瞄威胁者(1ジ枪)'], N6);          // 应当 ~100%
  const ref2 = aimRateOnRingField(function (st, pid, legal) {                 // 只瞄最肥的：应当 ≈0
    return aff(legal, R.SK.GUN) ? pT(st, pid, { key: R.SK.GUN }) : { key: R.SK.JI, target: null };
  }, N6);
  gate('G6[元测试] 同一场地必须能区分"会瞄"与"只瞄最肥"（差 ≥50pt）',
    ref1.rate - ref2.rate >= 50,
    `参照：一行代码的"瞄威胁者" ${ref1.rate.toFixed(1)}%（攻击 ${ref1.atk}）  vs  "只瞄血量最高" ${ref2.rate.toFixed(1)}%（攻击 ${ref2.atk}）  均匀乱打基线 25%`);
  for (const [nm, p] of PACKS) {
    const a = aimRateOnRingField(T.policyChooserN(p, 0.15), N6);
    gate(`G6[${nm}] 靶向率 ≥40%（他自己在 probe-sniper.mjs 里写的阈值）`, a.rate >= 40,
      `实测 ${a.rate.toFixed(1)}%（选择口径，攻击 ${a.atk} 次）⇒ ${a.rate >= 40 ? '过' : '未过：与"只瞄最肥"同档，能力未长出'}`);
  }
}

console.log('\n=== 汇总 ===');
for (const g of out) console.log(`  ${statusOf(g)}  ${g.name}`);
const nUnrun = out.filter(function (g) { return g.unrun; }).length;
if (nUnrun) console.log(`  ⛔ 另有 ${nUnrun} 格是 **UNRUN（跑不了 / 不可判）—— 不得当作通过**`);
console.log('\n说明（v1.5.78 采用时的分级）：');
console.log('  ① **G4 克制表 / G5 破防反射 ⇒ 采纳为阻断门**（promote-champion，且**只阻断"候选自己的"行**）：');
console.log('     判别力依据（v1.5.78 采用时）：91 FAIL（G4 78~82% / G5 65~75%）、94 FAIL（G4 67~68%），而线上包当时两模式 PASS。');
console.log('     ⚠ v1.5.89 起：补入"只枪(1ジ压制·打最肥)"这一格后，**线上包自己在 G4[long] 也是红的**（1 ジ枪长程能打穿它）——');
console.log('       那是"**在位包该换**"的信号，属**参照行**，不得用来阻断候选（否则任何候选都被连坐，换包只能靠 --force）。');
console.log('  ② **G6 靶向率 ⇒ 只记录不阻断**：四代包（含线上）全部 3.5~22.5% ⇒ 是"能力未长出"而非某包退化，');
console.log('     把它做成阻断会把所有候选一起挡死（该走的路线是窄奖励/教师示范，见 §15-3）。');
console.log('  ③ **G3 座位 ⇒ 只记录不阻断**：≤15pt 这个阈值**连线上包自己都过不了** ⇒ 不满足"能分开已知好与已知坏"，');
console.log('     改用 audit-lib 的 `seatSymmetry`（占比判据 + n≥50 极差判据 + underpowered 第三态）。');
console.log('  ④ 本脚本仍保留"任何 FAIL ⇒ 退出码 1"，供 CI/人工调用；promote-champion 只按 ① 阻断。');

/* 退出码：有任何 FAIL 就非 0 ⇒ 可接进 CI / promote-champion / np-test 的汇总。
 * ⚠ UNRUN **不计入** FAIL（它不是候选的错，而是量具没量出来）；但它也**不是通过** ——
 * 读它的人/工具必须显式处理（promote-champion 会打 ⛔ 警示，np-test 的 D67 守着这条契约）。 */
process.exitCode = out.some(function (g) { return !g.pass && !g.unrun; }) ? 1 : 0;
