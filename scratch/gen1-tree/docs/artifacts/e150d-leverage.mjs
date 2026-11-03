import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E150d · "改了对手的状态，行为真的会变吗" —— 因果版（§E150c 只是相关性）
   为什么不能只信 §E150c：那张表量的是"这组特征对隐层激活的贡献份额"，低频特征份额小但**可能一响就翻决策**。
   所以这里做真反事实：同一个决策点上，把某个对手的一项可见状态改掉 ⇒ 重算 ⇒ 看 top-1 动作与概率分布变化多大。

   ⚠⚠ 本机/本仓的两个真陷阱（第一次跑就踩了，读数全 0.00%）：
      `policy.js` 有**两层** memo：`FV_CACHE`（stateVec，:360-366）按 `state 对象身份 + round + events.length + pid + stamp`；
      `PRE_CACHE`（statePre，:488-503）在此基础上再加 `params` **对象身份**。
      ⇒ 只换权重副本**打不穿 FV_CACHE**：改了 `p[i].ep` 而 state 身份没变 ⇒ 拿回缓存的特征向量 ⇒ 反事实恒等、读数假 0。
      ⇒ 正解：把整个 state **克隆**成新对象（函数按引用保留），克隆体上再施加扰动 ⇒ 两层缓存必然 miss；
        并且配两道 placebo：① 同一克隆体算两次 ⇒ 必须一致；② 克隆体（未扰动）与原 state ⇒ 必须一致（证明"克隆"这个动作本身不扰动结果）。 */
function cloneS(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(cloneS);
  const r = {};
  for (const k of Object.keys(o)) { const v = o[k]; r[k] = (typeof v === 'function') ? v : cloneS(v); }
  return r;
}
const REPO = 'D:/code/Epirus-Web/';
const FILE = process.argv[2] || 'js/bundled-champion-3p.js';
const TABLES = Number(process.argv[3] || 60);
const GAMES = Number(process.argv[4] || 8);
const SEED = Number(process.argv[5] || 77000);
const { OPP_SPECS: SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, Play = W.EpirusPlay;
const mm = readFileSync(REPO + FILE, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('包不兼容'); process.exit(1); }
const asChooser = makeAsChooser({ T: T, R: R });
const NAMES = SPECS.map(o => o.name).concat(['focusfire', 'minespam', 'cursestorm']);
const FN = {}; for (const o of SPECS) FN[o.name] = Bots[o.fn];
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
for (const n of NAMES) if (typeof FN[n] !== 'function') { console.error('⛔ 函数不存在 ' + n); process.exit(1); }

function score(st, pid, pr, legalGiven) {
  /* ⚠⚠ 第二次踩坑记录（第一次的 0.0000 是**假读数**）：这里原本自己重建合法集
     （`R.legalMoves` 在本仓不叫这个名字 ⇒ 拿到空数组 ⇒ 候选退化成只有 ジ ⇒ prob 恒 1 ⇒ 任何反事实都"0.00%"且 placebo 也"0"，
      一把看起来干净的读数，其实是量具空转）。
     ⇒ 现在**复用引擎给的那张合法表**，只在它缺失时响亮退出；候选数同时打出来自证不是 1。
     ⇒ 附带好处：候选集固定 ⇒ 反事实里唯一变的就是状态特征，比较更干净。 */
  if (!legalGiven || !legalGiven.length) { console.error('⛔ 合法表为空 ⇒ 反事实读数会退化成恒 1，拒绝出数'); process.exit(6); }
  const cands = P.candidatesFor(st, pid, legalGiven, { lockTarget: false });
  if (!cands || cands.length < 2) { bumpEmpty(); }
  const f = P.forwardCands(st, pid, cands, pr, { temp: 1 });
  let bi = 0; for (let i = 1; f.probs.length && i < f.probs.length; i++) if (f.probs[i] > f.probs[bi]) bi = i;
  let s = 0; for (let i = 0; i < f.probs.length; i++) s += f.probs[i];
  const ent = (() => { let e = 0; for (let i = 0; i < f.probs.length; i++) if (f.probs[i] > 0) e -= f.probs[i] * Math.log(f.probs[i]); return e; })();
  return { key: cands[bi] ? cands[bi].key : null, target: (cands[bi] && cands[bi].target != null) ? cands[bi].target : -1,
    probs: f.probs, ncand: cands.length, ent: ent };
}
let nEmptyCand = 0; function bumpEmpty() { nEmptyCand++; }
const cmp = st => { const o = {}; for (const k of ['ep', 'hp', 'mineArmed', 'guardNext', 'elec', 'boom', 'lastSkill', 'baguaExtra']) o[k] = st[k]; return o; };
const put = (st, o) => { for (const k of Object.keys(o)) st[k] = o[k]; };

const stat = {};
function bump2(name, nd) { const s = stat[name] || (stat[name] = { n: 0, flip: 0, l1: 0, mx: 0, fchg: 0, fchgN: 0 }); s.fchg += nd; s.fchgN++; }
function bump(name, hit, l1d, mx) {
  const s = stat[name] || (stat[name] = { n: 0, flip: 0, l1: 0, mx: 0, fchg: 0, fchgN: 0 });
  s.n++; if (hit) s.flip++; s.l1 += l1d; if (mx > s.mx) s.mx = mx;
}
let dec = 0, firstPid = -1, placeboClone1 = 0, placeboClone2 = 0;
let sumNcand = 0, sumEnt = 0, decMulti = 0, diagLeft = 4;
for (let t = 0; t < TABLES; t++) {
  const rr0 = T.mulberry32(SEED + t * 7919);
  const pick = [];
  while (pick.length < 4) { const n = NAMES[Math.floor(rr0() * NAMES.length)]; if (pick.indexOf(n) < 0) pick.push(n); }
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED + t * 104729 + g) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + t * 104729 + g);
    const wrap = function (s, pid, legal) {
      if (firstPid < 0) firstPid = pid;
      if (pid !== firstPid) return pick0(s, pid, legal);
      dec++;
      const v7 = (legal || []).filter(l => l.affordable);
      const use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
      const ref = score(cloneS(s), pid, params, use);       /* 克隆体、未扰动 ⇒ 一切反事实的分母 */
      const ref2 = score(cloneS(s), pid, params, use);      /* placebo①：再克隆一次再算 ⇒ 必须一致 */
      const refOrig = score(s, pid, params, use);           /* placebo②：克隆 vs 原 state ⇒ 必须一致（证明克隆不扰动） */
      if (ref2.key !== ref.key || ref2.target !== ref.target) placeboClone1++;
      if (refOrig.key !== ref.key || refOrig.target !== ref.target) placeboClone2++;
      sumNcand += ref.ncand; sumEnt += ref.ent; if (ref.ncand >= 2) decMulti++;
      const living = [];
      for (let i = 0; i < s.p.length; i++) if (i !== pid && s.p[i].hp > 0) living.push(i);
      if (!living.length) return { key: ref.key, target: ref.target < 0 ? null : ref.target };
      const cf = function (name, apply) {
        const c = cloneS(s); const changed = apply(c.p);
        if (!changed) return;
        /* 诊断：扰动到底进不进特征？（"0.0000" 有两种完全相反的解释：**网络不敏感** vs **我的扰动没生效**，
           不分开就播报结论 = §E149b 那一族的错。第一次跑出来的全 0.00% 就是这个原因没查清。） */
        if (diagLeft < 3 && /^对手ジ\+4/.test(name)) {
          const x0 = P.featuresV7(cloneS(s), pid), x1 = P.featuresV7(c, pid);
          let nd = 0, ex = [];
          for (let i = 0; i < x0.length; i++) if (Math.abs((x0[i] || 0) - (x1[i] || 0)) > 1e-12) { nd++; if (ex.length < 6) ex.push(i + ':' + x0[i] + '→' + x1[i]); }
          console.log('  [诊断] 特征向量变化维数 = ' + nd + ' / ' + x0.length + '   例：' + ex.join(' '));
          diagLeft--;
        }
        const a = score(c, pid, params, use);
        const x0 = P.featuresV7(cloneS(s), pid), x1 = P.featuresV7(c, pid);
        let nd = 0; for (let i = 0; i < x1.length; i++) if (Math.abs((x0[i] || 0) - (x1[i] || 0)) > 1e-12) nd++;
        bump2(name, nd);
        bump(name, a.key !== ref.key || a.target !== ref.target, l1diff(a.probs, ref.probs), Math.max(...a.probs.map((v, i) => Math.abs(v - ref.probs[i]))));
      };
      /* 反事实 1：血最多的那个对手 ジ +4（只动对手的可见钱） */
      let tall = living[0]; for (const i of living) if (s.p[i].hp > s.p[tall].hp) tall = i;
      cf('对手ジ+4（血最多者）', p => { const e0 = p[tall].ep; p[tall].ep = Math.min(12, e0 + 4); return p[tall].ep !== e0; });
      const q = living[dec % living.length];
      /* 反事实 2：随机一席掉 1 血（活人不死） */
      cf('对手−1 血（随机一席）', p => { if (p[q].hp <= 1) return false; p[q].hp = p[q].hp - 1; return true; });
      /* 反事实 3：给随机一席布上地雷（§E150c 里 B 块最高频的几条之一） */
      cf('对手布雷（mineArmed）', p => { if (p[q].mineArmed) return false; p[q].mineArmed = true; return true; });
      /* 反事实 4：把全部对手的ジ清零（聚合特征必变——这是"最粗的那一眼"） */
      cf('全场对手ジ→0', p => { const anyE = living.some(i => p[i].ep > 0); if (!anyE) return false; for (const i of living) p[i].ep = 0; return true; });
      /* 反事实 5：把随机一席换成"刚蓄能"（前摇信号，脚本口径里最常见的威胁） */
      cf('对手刚蓄能（lastSkill=蓄能）', p => { if (p[q].lastSkill === R.SK.CHARGE) return false; p[q].lastSkill = R.SK.CHARGE; return true; });
      return { key: ref.key, target: ref.target < 0 ? null : ref.target };
    };
    const pick0 = (s, pid, legal) => chooserPlain(s, pid, legal);
    Play.autoGameN(st, [wrap].concat(pick.map(n => asChooser(FN[n]))));
  }
}
function chooserPlain(s, pid, legal) {
  const f = legal.filter(l => l.affordable);
  const cands = P.candidatesFor(s, pid, f.length ? f : [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
  const ff = P.forwardCands(s, pid, cands, params, { temp: 1 });
  let bi = 0; for (let i = 1; i < ff.probs.length; i++) if (ff.probs[i] > ff.probs[bi]) bi = i;
  return { key: cands[bi].key, target: cands[bi].target == null ? null : cands[bi].target };
}
function l1diff(a, b) {
  if (a.length !== b.length) return 2;
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}
console.log('# §E150d 反事实杠杆 ‖ 包=' + FILE + ' ‖ 决策点=' + dec + '（被测席 pid=' + firstPid + '）');
console.log('  placebo①（同一状态克隆两次）不一致 = **' + placeboClone1 + '**' + (placeboClone1 === 0 ? ' ✅' : ' ⛔ 克隆后的重复计算不稳定'));
console.log('  placebo②（克隆体 vs 原 state，都不扰动）不一致 = **' + placeboClone2 + '**' + (placeboClone2 === 0 ? ' ✅ ⇒ "克隆"这个动作不扰动结果，下面的 0 才是证据' : ' ⛔ 克隆在扰动 ⇒ 下面所有读数作废'));
console.log('\n  反事实（只改对手，一字不动自己）        样本    top-1 翻转率   平均 Σ|Δprob|   最大 Δprob     特征变了几个维');
for (const k of Object.keys(stat)) {
  const s = stat[k];
  console.log('  ' + k.padEnd(34) + String(s.n).padStart(5) + (100 * s.flip / s.n).toFixed(2).padStart(12) + '%' +
    (s.l1 / s.n).toFixed(5).padStart(14) + (s.mx).toExponential(1).padStart(13) +
    (s.fchgN ? (s.fchg / s.fchgN).toFixed(1) + ' 维/决策' : '      —').padStart(16));
}
console.log('\n  自证三行：候选数均值 = ' + (sumNcand / Math.max(1, dec)).toFixed(2) + '（**必须远大于 1**，否则概率恒 1、翻转率天然是 0）‖ ' +
  '候选 ≥2 的决策 = ' + decMulti + '/' + dec + ' ‖ 平均香农熵 = ' + (sumEnt / Math.max(1, dec)).toFixed(4) + ' nat' +
  ' ‖ 退化候选次数（cands<2）= ' + nEmptyCand);
