/* 同一把尺（第十七~十九段那条"跨候选撞车"）量三面输入面：
 *   ① v7 原版 22 维 actionFeatures（S1 吃的动作侧）
 *   ② DS 的 obs2（98 维，`tools/proto2/obs2.mjs`）
 *   ③ 我的 obs3（210 维）
 * 判据只有一条：**把每个技能键当一枚无目标候选，特征逐维全等就并成一格** ⇒ 格数/键数 = 输入面分辨率。
 * 附加第二条：obs2 的**对手槽位数**能表示几席（它有没有 L1 那类写死槽）⇒ 直接决定"跨人数"这件事。 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { encode as enc2 } from '../tools/proto2/obs2.mjs';
import { encode as enc3 } from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function cls(vecs) { const g = {}; vecs.forEach(({ k, v }) => { const s = Array.from(v).map((x) => Number(x).toFixed(4)).join(','); (g[s] || (g[s] = [])).push(k); }); const groups = Object.values(g).filter((x) => x.length > 1); return { n: vecs.length, cls: Object.keys(g).length, groups }; }
const MODES = [['multi', 5], ['multi', 8], ['standard', 2]];
for (const [mode, n] of MODES) {
  const st = S.createState(mode, { next: () => 0.37 }, n); st.rng = { next: () => 0.37 };
  st.p.forEach((q, i) => { q.ep = 6; });
  const legal = Play.legalActions(st, 0);
  const base = T.econBase(st, 0, legal);
  const keys = R.skills.map((s) => s.key);
  const mk = (k) => ({ key: k, target: null, target2: null, bead: null });
  const c2 = cls(keys.map((k) => ({ k, v: enc2(W, st, 0, mk(k)) })));
  const c3 = cls(keys.map((k) => ({ k, v: enc3(W, st, 0, mk(k)) })));
  const c1 = cls(keys.map((k) => ({ k, v: Array.from(P.actionFeatures(st, 0, k, mk(k))).slice(0, 22) })));
  console.log('# ' + mode + ' ‖ n=' + n + '（候选表实有 ' + P.candidatesFor(st, 0, base, { lockTarget: false }).length + ' 枚）');
  [['v7 那 22 维', c1], ['DS 的 obs2（' + c2.n + ' 维/键）', c2], ['我的 obs3（' + c3.n + ' 维/键）', c3]].forEach(([nm, c]) => {
    console.log('   ' + nm.padEnd(26) + ' ‖ ' + keys.length + ' 个技能键 → **' + c.cls + ' 格**（分辨率 ' + (100 * c.cls / keys.length).toFixed(1) + '% ‖ 撞车 ' + c.groups.length + ' 组）');
    c.groups.slice(0, 3).forEach((g) => console.log('        · ' + g.join(' ≡ ')));
  });
}
