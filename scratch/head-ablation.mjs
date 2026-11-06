/* 第十七段判语 3 留下的那一问（不新开臂、不打一局）：**头的并列到底是"没用技能身份"还是"没用目标"**
 * 做法：同一张候选表上，把候选**按"只差技能"与"只差目标"配成对**，看两两 logits 差多少。
 *   · 同目标、不同技能  ⇒ 差 ≈ 0 ⇒ 头不看技能身份
 *   · 同技能、不同目标  ⇒ 差 ≈ 0 ⇒ 头不看目标
 *   · 参照用 v7 自己的 `P.value` 同一批配对 ⇒ 知道"这一格里本来有没有信息可分"
 * 只读 `scratch/N-fx-dump240.jsonl`（上游仪器落的夹具），不重算标签、不动 js/**。 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rows = readFileSync('scratch/N-fx-dump240.jsonl', 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s)).slice(0, 120);
const PACKS = [['B8 (S1)', 'scratch/arms/B8-fx-S1.bak'], ['R1 (S1)', 'scratch/arms/R1-v7fix-S1.bak'], ['N2 (S1o)', 'scratch/arms/N2-fx-S1o.bak']];
for (const [tag, path] of PACKS) {
  const raw = JSON.parse(readFileSync(path, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
  const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
  if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
  const A = installArch2(W, cfg);
  const head = Float64Array.from(P.unpack(raw, true));
  let nSkill = 0, flatSkill = 0, nTgt = 0, flatTgt = 0, nTgt2 = 0, flatTgt2 = 0;
  let v7nSkill = 0, v7flatSkill = 0, v7nTgt = 0, v7flatTgt = 0;
  const skillEq = new Set(); let interSk = 0;                 /* "头全等的对"与"标签全等的对"**是不是同一批对**（数量相等不等于集合相同） */
  for (const r of rows) {
    const st = r.st; st.rng = { next: mulberry(99) };
    const cands = P.candidatesFor(st, r.pid, T.econBase(st, r.pid, Play.legalActions(st, r.pid)), { lockTarget: false }) || [];
    if (cands.length < 2) continue;
    const lg = Array.from(P.forwardCands(st, r.pid, cands, head, { temp: 0.001 }).logits);
    const vv = cands.map((c) => P.value(st, r.pid, c.key, v7, null, c));
    const g = {};
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const kt = 'T' + c.target + '|' + (c.bead || '-'), ks = c.key + '|' + (c.bead || '-');
      (g['k:' + c.key + '|' + (c.bead || '-') + '|t2=' + (c.target2 == null ? '-' : c.target2)] || (g['k:' + c.key + '|' + (c.bead || '-') + '|t2=' + (c.target2 == null ? '-' : c.target2)] = [])).push(i);
      (g['s:' + kt] || (g['s:' + kt] = [])).push(i);
      if (c.target != null && c.target2 != null) (g['s2:' + c.key + '|t=' + c.target] || (g['s2:' + c.key + '|t=' + c.target] = [])).push(i);
    }
    const flat = (idxs, arr) => idxs.length > 1 && idxs.every((i) => Math.abs(arr[i] - arr[idxs[0]]) < 1e-12);
    /* ⚑⚑ 两版都在这儿错过：① 第一版把单枚组算进分母；② 第二版要求"**整桶**逐位相等"，
     *   而 `target=null` 那一桶里同时装着 `ji`——ji 与三手防御本来就该有差 ⇒ 整桶永远不相等 ⇒ 读出 0/418 的**假干净**。
     *   正确做法是**逐对**统计：同桶内每一对候选算一对，分数相等算"这一对分不开"。 ⇒ 与 rankfit 那条出厂列同定义才可对表。 */
    const pairOf = (v) => { let n = 0, e = 0; const set = []; for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) { n++; const eq = Math.abs(lg[v[a]] - lg[v[b]]) < 1e-12; if (eq) { e++; set.push(v[a] + '-' + v[b]); } } return { n, e, set }; };
    const pairV7 = (v) => { let n = 0, e = 0; const set = new Set(); for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) { n++; if (Math.abs(vv[v[a]] - vv[v[b]]) < 1e-6) { e++; set.add(v[a] + '-' + v[b]); } } return { n, e, set }; };
    for (const [k, v] of Object.entries(g)) {
      if (v.length < 2) continue;
      if (k.startsWith('s:') && !k.startsWith('s2:')) {
        if (new Set(v.map((i) => cands[i].key + '|' + (cands[i].bead || '-'))).size < 2) continue;
        const p = pairOf(v), q = pairV7(v); nSkill += p.n; flatSkill += p.e; v7nSkill += q.n; v7flatSkill += q.e;
        p.set.forEach((x) => { skillEq.add(r.pk + '#' + x); if (q.set.has(x)) interSk++; });
      } else if (k.startsWith('k:')) {
        const p = pairOf(v), q = pairV7(v); nTgt += p.n; flatTgt += p.e; v7nTgt += q.n; v7flatTgt += q.e;
      } else if (k.startsWith('s2:')) { const p = pairOf(v); nTgt2 += p.n; flatTgt2 += p.e; }
    }
  }
  const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
  console.log('\n# ' + tag + ' ‖ 源 ' + rows.length + ' 个真实决策（`scratch/N-fx-dump240.jsonl`）');
  console.log('  只差**技能**的组：' + nSkill + ' ‖ 头逐位全等 ' + flatSkill + '（' + pc(flatSkill, nSkill) + '） ‖ 同一批配对上 v7 同分率 ' + pc(v7flatSkill, v7nSkill) + '（' + v7flatSkill + '/' + v7nSkill + '）'
    + ' ‖ ⚑ 头全等的 ' + skillEq.size + ' 对里，**标签也全等的有 ' + interSk + ' 对**（' + pc(interSk, skillEq.size) + '）');
  console.log('  只差**目标**的组：' + nTgt + ' ‖ 头逐位全等 ' + flatTgt + '（' + pc(flatTgt, nTgt) + '） ‖ 同一批配对上 v7 同分率 ' + pc(v7flatTgt, v7nTgt) + '（' + v7flatTgt + '/' + v7nTgt + '）');
  console.log('  只差**第二目标**的组：' + nTgt2 + ' ‖ 头逐位全等 ' + flatTgt2 + '（' + pc(flatTgt2, nTgt2) + '）');
  A.restore();
}
