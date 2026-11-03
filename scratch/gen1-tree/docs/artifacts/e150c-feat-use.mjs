import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E150c · 把 §E150/§E150b 搬到**产品口径**重做一遍
   前两把刀的采样偏差：五个座位全是同一个策略 ⇒ 场上没人布雷、没人贴符咒 ⇒ "B 效果块恒 0"是**采样的产物**，不是事实。
   本脚本按 `eval-5p` 的真口径装配：**座位 0 = 被测策略，座位 1~4 = 四个互不相同的脚本**（池 = `OPP_SPECS` + 评测专用三只）。
   输出的两件事：
     ① 每个特征组的"听话程度" = Σ_j Σ_{i∈组} |W1[j][i]| × E_真实决策|x_i|（每维平均，跨组可比）
     ② B 效果块的"字段真值 A vs 特征读数 B"逐条对照 ⇒ 分清"没东西可听"与"有东西没听见"
   ⚠ 相关性证据，不是因果。 */
const REPO = 'D:/code/Epirus-Web/';
const FILE = process.argv[2] || 'js/bundled-champion-3p.js';
const TABLES = Number(process.argv[3] || 120);
const GAMES = Number(process.argv[4] || 8);
const SEED = Number(process.argv[5] || 77000);
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, Play = W.EpirusPlay;
const FEAT_S = P.FEAT_S, HID = P.HID, FEAT_A = P.FEAT_A, FEAT_N = P.FEAT_N, PS = P.PLAYER_SLOTS, NEFF = P.EFFECTS.length, OPP_SLOTS = P.OPP_SLOTS, HIST_K = P.HIST_K;
const mm = readFileSync(REPO + FILE, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('包不兼容 ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }
const asChooser = makeAsChooser({ T: T, R: R });

const NAMES = OPP_SPECS.map(o => o.name)
  .concat(['focusfire', 'minespam', 'cursestorm']);
const FN = {}; for (const n of OPP_SPECS.map(o => o.name)) FN[n] = Bots[OPP_SPECS.find(o => o.name === n).fn];
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
for (const n of NAMES) if (typeof FN[n] !== 'function') { console.error('⛔ 脚本函数不存在: ' + n); process.exit(1); }
console.log('# §E150c 产品口径的特征使用审计 ‖ 包=' + FILE + ' ‖ 桌=' + TABLES + ' × 局=' + GAMES + ' ‖ 对手池=' + NAMES.length + ' 个脚本');

/* 组边界（现算，与 §E150 同） */
const PRE = 63, SLOT = OPP_SLOTS * 10, HIST = (HIST_K + 1) * (1 + OPP_SLOTS), REL = PS * 4, EFF = PS * NEFF;
const B_LO = PRE + SLOT + HIST + REL;
const groups = [['前缀·聚合可见', 0, PRE], ['逐座位 10×4', PRE, PRE + SLOT], ['技能历史', PRE + SLOT, PRE + SLOT + HIST],
  ['T 关系块', PRE + SLOT + HIST, B_LO], ['B 效果块', B_LO, B_LO + EFF]];
const totDim = groups.reduce((a, g) => a + (g[2] - g[1]), 0);
console.log('  组切分：' + groups.map(g => g[0] + '[' + g[1] + ',' + g[2] + ')').join(' ') + ' ⇒ ' + totDim + '/' + FEAT_S + (totDim === FEAT_S ? ' ✅' : ' ⛔'));

const chooser = function (state, pid, legal) {
  const v7 = legal.filter(l => l.affordable);
  const cands = P.candidatesFor(state, pid, v7.length ? v7 : [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
  const f = P.forwardCands(state, pid, cands, params, { temp: 1 });
  let bi = 0; for (let i = 1; i < f.probs.length; i++) if (f.probs[i] > f.probs[bi]) bi = i;
  const c = cands[bi];
  return { key: c.key, target: c.target != null ? c.target : null };
};

const sumAbs = new Float64Array(FEAT_S), nz = new Float64Array(FEAT_S);
const fieldHit = new Array(NEFF).fill(0), featHit = new Array(NEFF).fill(0);
let dec = 0, firstPid = -1;
for (let t = 0; t < TABLES; t++) {
  const rr = T.mulberry32(SEED + t * 7919);
  const pick = [];
  while (pick.length < 4) { const n = NAMES[Math.floor(rr() * NAMES.length)]; if (pick.indexOf(n) < 0) pick.push(n); }
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED + t * 104729 + g) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + t * 104729 + g);
    const wrap = function (s, pid, legal) {
      if (pid === firstPid || (firstPid < 0 && (firstPid = pid, false))) { /* 只在被测席采样 */ }
      if (pid !== firstPid) return chooser(s, pid, legal);
      dec++;
      const x = P.featuresV7(s, pid);
      for (let i = 0; i < FEAT_S; i++) { const v = x[i] || 0; sumAbs[i] += Math.abs(v); if (v !== 0) nz[i]++; }
      for (let e = 0; e < NEFF; e++) {
        for (let i = 0; i < s.p.length; i++) if (P.EFFECTS[e][2](s.p[i]) !== 0) { fieldHit[e]++; break; }
        for (let i = 0; i < PS; i++) { for (let k = 0; k < 1; k++) if ((x[B_LO + i * NEFF + e] || 0) !== 0) { featHit[e]++; break; } }
      }
      return chooser(s, pid, legal);
    };
    Play.autoGameN(st, [wrap, asChooser(FN[pick[0]]), asChooser(FN[pick[1]]), asChooser(FN[pick[2]]), asChooser(FN[pick[3]])]);
  }
}
console.log('  被测席决策点 = ' + dec + '（被测席 pid=' + firstPid + '）');

const colMass = new Float64Array(FEAT_S);
for (let j = 0; j < HID; j++) { const base = j * FEAT_N; for (let i = 0; i < FEAT_S; i++) colMass[i] += Math.abs(params[base + i]); }
const meanAbs = Array.from(sumAbs, v => v / Math.max(1, dec));
console.log('\n  组                维数   E|x|每维   非零时刻    |W1|每维   贡献/维    占全输入');
const tot = groups.reduce((acc, g) => { let s = 0; for (let i = g[1]; i < g[2]; i++) s += colMass[i] * meanAbs[i]; return acc + s; }, 0);
for (const [name, lo, hi] of groups.slice().sort((a, b) => (b[2] - b[1]) && 0)) {
  let c = 0, m = 0, ma = 0, nzc = 0;
  for (let i = lo; i < hi; i++) { c += colMass[i] * meanAbs[i]; m += colMass[i]; ma += meanAbs[i]; nzc += nz[i]; }
  const n = hi - lo;
  console.log('  ' + name.padEnd(16) + String(n).padEnd(7) + (ma / n).toFixed(4).padStart(8) + (nzc / n / Math.max(1, dec)).toFixed(3).padStart(10) +
    (m / n).toFixed(2).padStart(11) + (c / n).toExponential(2).padStart(11) + '   ' + (100 * c / tot).toFixed(1) + '%');
}
console.log('\n  # B 效果块：字段真值(A) vs 特征读数(B)');
console.log('  效果条                  A(决策里出现过的次数)   B(特征位非零次数)   判读');
let bug = 0;
for (let e = 0; e < NEFF; e++) {
  const v = fieldHit[e] > 0 && featHit[e] === 0 ? '⛔ 字段出现过、特征恒 0 ⇒ 装配丢了' : (fieldHit[e] === 0 ? '— 这批桌里从未出现' : '✅ 走到了');
  if (fieldHit[e] > 0 && featHit[e] === 0) bug++;
  console.log('  ' + P.EFFECTS[e][0].padEnd(22) + String(fieldHit[e]).padStart(12) + String(featHit[e]).padStart(18) + '   ' + v);
}
console.log('  ⇒ 装配丢失 = ' + bug + '/' + NEFF + ' ‖ 出现过但没走通的条：' + (bug ? P.EFFECTS.filter((r, e) => fieldHit[e] > 0 && featHit[e] === 0).map(r => r[0]).join(', ') : '无'));
console.log('\n  判读（跑前写死）：① 逐座位/T/B 的"贡献/维"与前缀同量级 ⇒ 网络已在吃对手信息 ⇒ 加维不该做；');
console.log('  ② 低一个量级以上 ⇒ 才有理由花"改 policy.js + 换指纹 + 全量重训"这条贵路；③ 非零时刻 <0.05 的组要先排除"没东西可听"。');
