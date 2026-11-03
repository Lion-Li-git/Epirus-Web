/* 同一件事的**正确切法**：只有"无目标候选"的特征撞车才是构造性并列
 *   （头的输入 = hctx ⊕ ae(那 22 维/obs3 base⊕身份) ⊕ te(席位嵌入)；`target=null` ⇒ te 那一段全等 ⇒ 撞车不可救）。
 *   带目标的候选"特征同、目标不同"**不算撞车**——目标身份走席位嵌入那条路，头看得见。 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { encode as obs3Encode } from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rows = readFileSync('scratch/N-fx-dump240.jsonl', 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s));
const stat = { v722: { n: 0, c: 0, g: {} }, ob: { n: 0, c: 0, g: {} } };
let dec = 0;
const idOf = (c) => c.key + (c.bead ? '/' + c.bead : '');
for (const r of rows) {
  const st = r.st; st.rng = { next: mulberry(1234) };
  const legal = Play.legalActions(st, r.pid);
  const cands = (P.candidatesFor(st, r.pid, T.econBase(st, r.pid, legal), { lockTarget: false }) || []).filter((c) => c.target == null);
  if (cands.length < 2) continue;
  dec++;
  const gA = {}, gB = {};
  for (const c of cands) {
    const a = Array.from(P.actionFeatures(st, r.pid, c.key, c)).slice(0, 22).map((x) => Number(x).toFixed(4)).join(',');
    const b = Array.from(obs3Encode(W, st, r.pid, c)).map((x) => Number(x).toFixed(4)).join(',');
    gA[a] = (gA[a] || []).concat(c); gB[b] = (gB[b] || []).concat(c);
  }
  stat.v722.n += cands.length; stat.v722.c += Object.keys(gA).length;
  stat.ob.n += cands.length; stat.ob.c += Object.keys(gB).length;
  for (const v of Object.values(gA)) if (v.length > 1) stat.v722.g[v.map(idOf).sort().join(' ≡ ')] = (stat.v722.g[v.map(idOf).sort().join(' ≡ ')] || 0) + 1;
  for (const v of Object.values(gB)) if (v.length > 1) stat.ob.g[v.map(idOf).sort().join(' ≡ ')] = (stat.ob.g[v.map(idOf).sort().join(' ≡ ')] || 0) + 1;
}
console.log('# 无目标候选上的输入面分辨率（构造性并列的直接账）‖ ' + dec + ' 个决策 ‖ 源 `scratch/N-fx-dump240.jsonl`');
for (const [nm, s] of [['v7 那 22 维 actionFeatures', stat.v722], ['obs3 的 210 维逐候选编码', stat.ob]]) {
  console.log('  ' + nm + '：' + s.n + ' 枚 → **' + s.c + ' 格** ‖ 分辨率 ' + (100 * s.c / s.n).toFixed(1) + '% ‖ 撞车型 ' + Object.keys(s.g).length + ' 种');
  Object.entries(s.g).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => console.log('     · ' + k + ' ‖ 出现 ' + v + ' 次'));
}
