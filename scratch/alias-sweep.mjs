/* 第十七段登记的那格"还没闭合"：obs3 输入面 0 撞车，现在只在**一个局面**上量过。
 * 这里把它扫成多份原件：`scratch/N-fx-dump240.jsonl` 里每个采样决策的整张候选名单（v7 分数的并列也一起报，作对照）。
 * 判"输入面分辨率"= 等价类数 ÷ 候选数；撞车组 = 逐维全等的候选集合。 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { encode as obs3Encode } from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rows = readFileSync('scratch/N-fx-dump240.jsonl', 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s));
const byCls = (vecOf) => {
  const g = {};
  for (const c of vecOf.list) {
    const k = vecOf.f(c).map((x) => Number(x).toFixed(4)).join(',');
    (g[k] || (g[k] = [])).push(c);
  }
  const groups = Object.values(g).filter((v) => v.length > 1);
  return { n: vecOf.list.length, cls: Object.keys(g).length, groups };
};
let tot3 = 0, cls3 = 0, coll3 = 0, tot22 = 0, cls22 = 0, coll22 = 0, v7flat = 0, v7tot = 0, ex3 = null;
const idOf = (c) => c.key + (c.bead ? '/' + c.bead : '') + '/t' + (c.target == null ? '-' : c.target) + (c.target2 == null ? '' : ':' + c.target2);
for (const r of rows) {
  const st = r.st; st.rng = { next: mulberry(1234) };
  const legal = Play.legalActions(st, r.pid);
  const cands = P.candidatesFor(st, r.pid, T.econBase(st, r.pid, legal), { lockTarget: false }) || [];
  if (cands.length < 2) continue;
  const a = byCls({ list: cands, f: (c) => Array.from(P.actionFeatures(st, r.pid, c.key, c)).slice(0, 22) });
  const b = byCls({ list: cands, f: (c) => Array.from(obs3Encode(W, st, r.pid, c)) });
  tot22 += a.n; cls22 += a.cls; coll22 += a.n - a.cls;
  tot3 += b.n; cls3 += b.cls; coll3 += b.n - b.cls;
  if (!ex3 && b.groups.length) ex3 = { pk: r.pk, g: b.groups.map((v) => v.map(idOf).join(' ≡ ')) };
  const sc = cands.map((c) => P.value(st, r.pid, c.key, v7, null, c)).filter(Number.isFinite);
  if (sc.length > 1) { v7tot++; if (new Set(sc.map((x) => x.toFixed(3))).size === 1) v7flat++; }
}
console.log('# 输入面分辨率的多样本扫描 ‖ 源 `scratch/N-fx-dump240.jsonl` ‖ 决策 ' + rows.length + ' 个');
console.log('  v7 那 22 维 actionFeatures：候选 ' + tot22 + ' 枚 → ' + cls22 + ' 格 ‖ **分辨率 ' + (100 * cls22 / tot22).toFixed(1) + '%** ‖ 被抹平 ' + coll22 + ' 枚');
console.log('  obs3 的 210 维逐候选编码：候选 ' + tot3 + ' 枚 → ' + cls3 + ' 格 ‖ **分辨率 ' + (100 * cls3 / tot3).toFixed(1) + '%** ‖ 被抹平 ' + coll3 + ' 枚');
if (ex3) console.log('  ⚠ obs3 仍撞车的第一例（' + ex3.pk + '）：' + ex3.g.slice(0, 3).join('  ‖ '));
else console.log('  ✔ obs3 在全部样本上 **0 撞车**');
console.log('  对照（不是缺陷，是同一件事的另一面）：v7 自己的 `P.value` 在整张名单上**全同一分**的决策占 ' + (100 * v7flat / Math.max(1, v7tot)).toFixed(1) + '%（' + v7flat + '/' + v7tot + '）');
