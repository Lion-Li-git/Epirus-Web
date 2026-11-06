/* 两把尺在同一批夹具上打架：`alias-sweep2` 说 v7 那 22 维把 `guard≡reflect≡bagua` 在 228/228 个决策上都压成同格，
 *  而 `head-ablation` 说 B8 的 logits 在"只差技能"的组里 0/418 全等。若特征真同且目标都空，S1 头的输出必然逐位相等
 *  ⇒ 两句话不可能同时对。这里把前 6 行的现场打出来看是谁的分组规则错了。 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const raw = JSON.parse(readFileSync('scratch/arms/B8-fx-S1.bak', 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
const A = installArch2(W, { mutMode: 'seg', ...(raw.dims || {}) });
const head = Float64Array.from(P.unpack(raw, true));
const rows = readFileSync('scratch/N-fx-dump240.jsonl', 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s));
const arms = {}; rows.forEach((r) => { arms[r.arm] = (arms[r.arm] || 0) + 1; });
console.log('  dump 里各臂的行数：' + JSON.stringify(arms));
let shown = 0, trioFeatSame = 0, trioLogitSame = 0, trioPresent = 0;
for (const r of rows) {
  const st = r.st; st.rng = { next: mulberry(99) };
  const cands = P.candidatesFor(st, r.pid, T.econBase(st, r.pid, Play.legalActions(st, r.pid)), { lockTarget: false }) || [];
  const trio = cands.filter((c) => ['guard', 'reflect', 'bagua'].includes(c.key) && c.target == null);
  if (trio.length < 2) continue;
  trioPresent++;
  const lg = Array.from(P.forwardCands(st, r.pid, cands, head, { temp: 0.001 }).logits);
  const idx = trio.map((c) => cands.indexOf(c));
  const feat = trio.map((c) => Array.from(P.actionFeatures(st, r.pid, c.key, c)).slice(0, 22).map((x) => Number(x).toFixed(4)).join(','));
  const fsame = new Set(feat).size === 1, lsame = idx.every((i) => Math.abs(lg[i] - lg[idx[0]]) < 1e-12);
  if (fsame) trioFeatSame++; if (lsame) trioLogitSame++;
  if (shown < 4) {
    console.log('  行 ' + r.pk + '（arm=' + r.arm + ' 第 ' + st.round + ' 回合）‖ trio ' + trio.map((c) => c.key).join(',') + ' ‖ 特征同分=' + fsame + ' ‖ B8 logits 同=' + lsame);
    console.log('     logits: ' + idx.map((i, j) => trio[j].key + '=' + lg[i].toFixed(9)).join(' ‖ '));
    if (!fsame) console.log('     特征差在哪：' + feat.map((f, j) => trio[j].key + ':' + f.split(',').map((x, i) => x === feat[0].split(',')[i] ? null : i + '=' + x).filter(Boolean).join(' ')).join(' ‖ '));
    shown++;
  }
}
console.log('  ⇒ trio 在场(≥2 枚)的决策 ' + trioPresent + ' ‖ 特征逐位相同 ' + trioFeatSame + ' ‖ B8 logits 逐位相同 ' + trioLogitSame);
A.restore();
