/* 守门草稿（给 np-test 用）：三条"必须能失败"的行为断言
 * 用法：node tools/gate-drafts.mjs        # 打印每条在当前代码/现上线包上的实际结论（PASS/FAIL）
 * 设计原则（对齐本项目 L1/L7 教训）：
 *   ① 断言的是**行为**，不是源码字符串；
 *   ② 凡是"验收某个能力"的门，先用**合成策略**证明**测量工具本身有判别力**，再拿去量冠军
 *      —— 否则会出现"探针永远测不出失败"的假通过（v1.5.44 的教训）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const REPO = process.cwd() + '/';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy;
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
function seatSpread(chooserFactory, mode, G) {
  const w = [0, 0, 0, 0, 0]; let draw = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(60000 + g * 7) }, 5);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(chooserFactory());
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++; else w[st.winner]++;
  }
  const decided = G - draw;
  const pct = w.map(x => x / G);
  return { pct: pct, decided: decided, spread: Math.round(100 * (Math.max(...pct) - Math.min(...pct))) };
}

const out = [];
function gate(name, pass, detail) { out.push({ name: name, pass: pass, detail: detail }); console.log((pass ? '  PASS  ' : '  FAIL  ') + name + '\n        ' + detail); }

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
for (const mode of ['long', 'multi']) {
  const s = seatSpread(() => T.policyChooserN(CH, 0.15), mode, 200);
  gate(`G3[${mode}] 5 席同一冠军：座位夺冠率极差 ≤ 15pt`,
    s.decided >= 40 && s.spread <= 15,
    `各座 ${s.pct.map(x => Math.round(100 * x) + '%').join(' ')}  有胜负局 ${s.decided}/200  极差 ${s.spread}pt` +
    (s.decided < 40 ? '  （注：无胜负局太少则本门不可判，必须先保证场地能分出胜负）' : ''));
}

console.log('\n=== 汇总 ===');
for (const g of out) console.log(`  ${g.pass ? 'PASS' : 'FAIL'}  ${g.name}`);
console.log('\n说明：G3 现在 FAIL 是**正确结果**——它测的是行为，而偏置实测仍在（0 号座 66~76%）。');
console.log('      D50 现在是 PASS，但它断言的是"源码里换了比较器 + 槽位 0 会随回合变"，不是"偏置消失了"。');
console.log('      ⇒ G3 请当作"待修的已知红"处理，不要 --force 掉；修好后它自然转绿并长期防回归。');

/* 退出码：有任何 FAIL 就非 0 ⇒ 可接进 CI / promote-champion / np-test 的汇总 */
process.exitCode = out.some(function (g) { return !g.pass; }) ? 1 : 0;
