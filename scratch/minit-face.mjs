/* minit-face.mjs — PREREG-2026-10-31-MINIT-FACE §一 的两条判据（M-F1 可分辨性 / M-F2 代理有没有信号）。
 * 只读 tools/** 与 js/**；不落产物、不改面、不开臂。
 *   跑法：node scratch/minit-face.mjs
 */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';

const MINIT_TARGETS = ['ring', 'bigT', 'railgun'];   /* 判据原文：skill-mastery.mjs:14 */
let seed = 13579;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/* ================= M-F1：目标 lastSkill 换身份 ⇒ 同一枚 miniT 候选的 logit 分得开吗 ================= */
console.log('# M-F1 可分辨性（三档脸：obs3b 现役 / obs3 旧 2.0 面 / v7 线上打分器）');
const VARIANTS = ['ring', 'bigT', 'railgun', 'ji'];

function faceProbe(input) {                       /* input: 'obs3b' | 'obs3' | 'v7' */
  const W = sandbox();
  const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
  const v7p = Float64Array.from(ref);
  const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer;
  let params, note = '';
  if (input !== 'v7') {
    installArch2(W, { mutMode: 'seg', input, gen: 3, keySplit: 1 });
    params = P.makePolicy(0.25);                 /* 随机粒即可：这里问的是"这一维进不进算式"，不是强度 */
    note = 'n=' + P.paramCount();
  } else params = v7p;
  /* 造一个能选目标的中局：跑几拍，取活人 ≥3 的一局 */
  const s = S.createState('multi', { next: mulberry32(90210) }, 4);
  s.slotSalt = 4242;
  const ch = T.policyChooserN ? T.policyChooserN(params, 0.15) : null;
  for (let r = 0; r < 6 && !s.over; r++) {
    for (let pid = 0; pid < 4; pid++) {
      if (s.p[pid].hp <= 0) continue;
      const legal = W.EpirusPlay.legalActions(s, pid);
      const pk = ch ? ch(s, pid, legal) : { key: R.SK.JI };
      S.attemptAction(s, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
    }
    W.EpirusResolve.resolveActions(s); W.EpirusResolve.endTurn(s);
  }
  const mePid = s.p.findIndex((q) => q.hp > 0);
  const tgt = s.p.map((q, i) => i).filter((i) => i !== mePid && s.p[i].hp > 0)[0];
  const base = W.EpirusTrainer.econBase(s, mePid, W.EpirusPlay.legalActions(s, mePid));
  const cand = (base || []).find((x) => x.key === R.SK.MINI_T) || { key: R.SK.MINI_T, affordable: true };
  /* v7 的 forwardCands 吃的是它自己 candidatesFor 的形状（手搓一枚会整条打分短路 ⇒ 上一版 v7 档 0/6 是量具坏了），
   *   而且它单格 probs 能小到 1e-295 ⇒ **逐格比会被绝对零吃掉**。这一档改成比"整张打分向量有没有任何一位变"。 */
  const realCands = P.candidatesFor(s, mePid, base, { lockTarget: false }) || [];
  const useReal = input === 'v7' && realCands.length >= 2;
  const list = useReal ? realCands : [{ key: cand.key, target: tgt, target2: null, bead: cand.bead || null }, { key: R.SK.JI, target: null, target2: null, bead: null }];
  const pick = useReal ? (() => { const i = realCands.findIndex((c) => c.key === R.SK.MINI_T); return i >= 0 ? i : 0; })() : 0;
  const vecOf = () => {
    const f = P.forwardCands(s, mePid, list, params, { temp: 0.15 });
    return Array.from(f.logits || f.probs);
  };
  const lg = () => {
    const out = [];
    for (const k of VARIANTS) {
      const save = s.p[tgt].lastSkill;
      s.p[tgt].lastSkill = R.SK[k] || k;
      out.push(vecOf());
      s.p[tgt].lastSkill = save;
    }
    return out;
  };
  const vals = lg();
  const vdiff = (a, b) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);
  /* 一次性诊断：这一档到底喂进去几枚候选、miniT 在第几格 */
  const diag = '候选 ' + list.length + ' ‖ miniT 取 #' + pick + (useReal ? '(真表)' : '(手搓)') + ' ‖ 打分维数 ' + vals[0].length;
  /* 夹具对照：改**目标血**（v7 一定看得见血）⇒ 若整张向量逐位同，那是量具坏了，不是产品看不见 */
  const ctrlHp = (() => {
    const save = s.p[tgt].hp;
    const a = vecOf();
    s.p[tgt].hp = Math.max(1, save - 3);
    const b = vecOf();
    s.p[tgt].hp = save;
    return { d: vdiff(a, b), ok: vdiff(a, b) > 1e-12 };
  })();
  const pairs = [];
  let split = 0, tot = 0;
  for (let i = 0; i < VARIANTS.length; i++) for (let j = i + 1; j < VARIANTS.length; j++) {
    tot++; const d = vdiff(vals[i], vals[j]);
    if (d > 1e-9) split++;
    pairs.push(VARIANTS[i] + '≠' + VARIANTS[j] + (d > 1e-9 ? ' ✔(' + d.toExponential(1) + ')' : ' **同**'));
  }
  const miniD = Math.max(vdiff(vals[0], vals[1]), vdiff(vals[1], vals[2]));
  console.log('  ' + input.padEnd(7) + ' ' + note + ' ‖ ' + diag + ' ‖ 目标 lastSkill 换身份 ⇒ **整张打分向量**有变的格子数 ' +
    split + '/' + tot + ' ‖ miniT 那一格自身差 ' + miniD.toExponential(1) +
    ' ‖ 夹具对照（改目标血）：' + (ctrlHp.ok ? '看得见 ✔(' + ctrlHp.d.toExponential(1) + ')' : '**也逐位同 ⇒ 这一档读数作废（量具坏了，不是看不见）**'));
  console.log('     ' + pairs.join(' ‖ '));
  return split;
}
const f1 = { obs3b: faceProbe('obs3b'), obs3: faceProbe('obs3'), v7: faceProbe('v7') };
const PASS_MF1 = f1.obs3b === 6;
console.log('  ⇒ M-F1 判（obs3b 必须 6/6 全分开）：' + (PASS_MF1 ? '✔ 判据要的那一位**在 obs3b 面里可见**' : '✘ 分不开，"信息不够"成立'));
console.log('  ⇒ 对照：obs3 ' + f1.obs3 + '/6 ‖ v7 ' + f1.v7 + '/6（在册那句括注写的是 obs3 那一档）');

/* ================= M-F2：代理 P=(对手 lastSkill∈targets) 能不能预示它接下来真放炮/真落雷 ================= */
console.log('\n# M-F2 代理信号（阵容里必须有会放 railgun/bigT 的座位，否则正例≈0 就只是"读不出"）');
const W2 = sandbox();
const R2 = W2.EpirusRules, S2 = W2.EpirusState, T2 = W2.EpirusTrainer, P2 = W2.EpirusPolicy;
const v7ref = Float64Array.from(loadChamp(W2, 'js/bundled-champion-3p.js', ''));

function scriptChooser(mode) {                    /* 只用来制造正例：会真放 railgun / bigT */
  return function (st, pid, legal) {
    const p = st.p[pid];
    const aff = (k) => (legal || []).some((l) => l.key === k && l.affordable);
    if (mode === 'chain' && aff(R2.SK.RAILGUN)) {
      const t = st.p.map((q, i) => i).filter((i) => i !== pid && st.p[i].hp > 0).sort((a, b) => st.p[a].hp - st.p[b].hp)[0];
      return { key: R2.SK.RAILGUN, target: t == null ? null : t };
    }
    if (mode === 'farmer' && aff(R2.SK.BIG_T)) {
      const t = st.p.map((q, i) => i).filter((i) => i !== pid && st.p[i].hp > 0).sort((a, b) => st.p[b].ep - st.p[a].ep)[0];
      return { key: R2.SK.BIG_T, target: t == null ? null : t };
    }
    /* farmer 一律不花 ep（它存在的唯一理由就是让"下一手落雷"这个正例真的存在；
     *   上一版让它在 ep≥3 去 charge ⇒ ep 被吃掉，60 局里 bigT 正例 = 0，那一格只能记"读不出"） */
    if (mode === 'chain' && !p.elec && p.ep >= 3 && aff(R2.SK.CHARGE)) return { key: R2.SK.CHARGE, bead: 'elec' };
    return { key: R2.SK.JI };
  };
}

const ROSTERS = {
  '脚本+线上混合（4 人）': [scriptChooser('chain'), scriptChooser('farmer'), T2.policyChooserN(v7ref, 0.15), () => ({ key: R2.SK.JI })],
  '线上 v7 ×4（对照）': [0, 1, 2, 3].map(() => T2.policyChooserN(v7ref, 0.15)),
};
for (const [tag, cs] of Object.entries(ROSTERS)) {
  let pairs = 0, nP = 0, hit1 = 0, hit2 = 0, lab1 = 0, lab2 = 0, games = 0;
  /* 事后诊断表（**不作预登记判据**，用来说明"是不是打反了"这个机制成不成立）*/
  const PROXIES = [
    ['在册判据：对手 lastSkill∈{ring,bigT,railgun}', (q) => !!q.ls && MINIT_TARGETS.indexOf(q.ls) >= 0],
    ['对手 lastSkill==charge（刚蓄过珠）', (q) => q.ls === 'charge'],
    ['对手 ep≥2', (q) => q.ep >= 2],
    ['对手 ep≥3', (q) => q.ep >= 3],
    ['对手最近 4 回合用过 charge', (q, r, recent) => recent(q.i, R2.SK.CHARGE, r, 4)],
    ['ep≥2 ∧ 最近 4 回合用过 charge', (q, r, recent) => q.ep >= 2 && recent(q.i, R2.SK.CHARGE, r, 4)],
  ];
  const px = PROXIES.map(() => ({ n: 0, h1: 0, h2: 0 }));
  for (let g = 0; g < 60; g++) {
    const st = S2.createState('multi', { next: mulberry32(70000 + g) }, 4);
    st.slotSalt = (g * 7919) % 100000; st.rng = { next: mulberry32(g + 1) };
    /* 先记每一拍的行动（含 outcome），再回头做前看 ⇒ 不用重放 */
    const log = [];
    for (let r = 1; r <= 40 && !st.over; r++) {
      for (let pid = 0; pid < 4; pid++) {
        if (st.p[pid].hp <= 0) continue;
        const legal = W2.EpirusPlay.legalActions(st, pid);
        /* 决策点快照：每个存活对手的 lastSkill 与 ep（"最近 4 回合用过哪把键"事后从 ok 事件反算，不必存） */
        const snap = st.p.map((q, i) => ({ i, ls: q.lastSkill, ep: q.ep || 0, alive: q.hp > 0 }));
        log.push({ kind: 'dec', r, pid, snap });
        const pk = cs[pid](st, pid, legal) || { key: R2.SK.JI };
        const rec = S2.attemptAction(st, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
        log.push({ kind: 'act', r, pid, key: pk.key });
      }
      W2.EpirusResolve.resolveActions(st);
      /* `state.actions[pid] = {key, voided, outcome, …}`，而 endTurn 会清空 ⇒ 只有 resolve 之后、endTurn 之前读得到 outcome */
      for (let pid = 0; pid < 4; pid++) {
        const a = st.actions[pid];
        if (a && a.outcome === 'ok' && !a.voided && a.key) log.push({ kind: 'ok', r, pid, key: a.key });
      }
      W2.EpirusResolve.endTurn(st);
      games++;
    }
    const okOf = (pid, key, fromR, span) => log.some((x) => x.kind === 'ok' && x.pid === pid && x.key === key && x.r >= fromR && x.r <= fromR + span);
    const castRecently = (pid, key, r, back) => log.some((x) => x.kind === 'ok' && x.pid === pid && x.key === key && x.r <= r && x.r > r - back);
    for (const d of log.filter((x) => x.kind === 'dec')) {
      for (const q of d.snap) {
        if (!q.alive || q.i === d.pid) continue;
        pairs++;
        const L1 = okOf(q.i, R2.SK.RAILGUN, d.r, 2), L2 = okOf(q.i, R2.SK.BIG_T, d.r, 3);
        if (L1) lab1++; if (L2) lab2++;
        const isT = q.ls && MINIT_TARGETS.indexOf(q.ls) >= 0;
        if (isT) { nP++; if (L1) hit1++; if (L2) hit2++; }
        PROXIES.forEach(([, fn], k) => { if (fn(q, d.r, castRecently)) { px[k].n++; if (L1) px[k].h1++; if (L2) px[k].h2++; } });
      }
    }
  }
  const br1 = pairs ? lab1 / pairs : 0, br2 = pairs ? lab2 / pairs : 0;
  const pr1 = nP ? hit1 / nP : 0, pr2 = nP ? hit2 / nP : 0;
  console.log('  【' + tag + '】 (决策点,对手) 对 ' + pairs + ' ‖ 正例 base rate：railgun≤2 回合 ' + (100 * br1).toFixed(2) +
    '% ‖ bigT≤3 回合 ' + (100 * br2).toFixed(2) + '%');
  console.log('    预登记判据（代理 P=在册那条）：n(P)=' + nP + ' ‖ precision→railgun ' + (100 * pr1).toFixed(2) + '%（×' +
    (br1 > 0 ? (pr1 / br1).toFixed(2) : 'n/a') + '）‖ precision→bigT ' + (100 * pr2).toFixed(2) + '%（×' +
    (br2 > 0 ? (pr2 / br2).toFixed(2) : 'n/a') + '）‖ 线：n≥60 且 ≥2×base ⇒ ' +
    ((nP >= 60 && br1 > 0 && pr1 >= 2 * br1) ? 'railgun ✔有信号' : 'railgun ✘') + ' ‖ ' +
    ((nP >= 60 && br2 > 0 && pr2 >= 2 * br2) ? 'bigT ✔有信号' : 'bigT ✘') +
    (br2 === 0 ? ' ‖⚠ bigT 正例 0 ⇒ 这一格**读不出**（阵容里没人落雷），不许写成"没有"' : ''));
  console.log('    —— 事后诊断（不作判据）：面内可算的代理各自能预示什么 ——');
  for (const [k, nm] of PROXIES.map((x) => x[0]).entries()) {
    const s2x = px[k];
    const p1 = s2x.n ? s2x.h1 / s2x.n : 0, p2 = s2x.n ? s2x.h2 / s2x.n : 0;
    console.log('      ' + nm.padEnd(38) + ' n=' + String(s2x.n).padStart(5) +
      ' ‖ →railgun ' + (100 * p1).toFixed(2) + '%（×' + (br1 > 0 ? (p1 / br1).toFixed(2) : 'n/a') + '）' +
      ' ‖ →bigT ' + (100 * p2).toFixed(2) + '%（×' + (br2 > 0 ? (p2 / br2).toFixed(2) : 'n/a') + '）');
  }
}
