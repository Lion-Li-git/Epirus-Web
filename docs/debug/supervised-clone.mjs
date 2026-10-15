/* supervised-clone.mjs —— **监督克隆**（把杂货铺的策略拟合进一张 213→24→1 的网）
 * ⚑ 出身：本文件是 `docs/artifacts/e608-out/s33-clone.mjs`（v1.7.42 那笔「便宜的克隆诊断」= claude 递来的路线第 1 步，用户 16:2x 批）**正式入库**的版本。
 *   用户 2026-10-15 晚：「把 v1.7.42 那个监督克隆脚本正式入库。它现在在 ignore 区里，是目前最重要的资产」。
 * 问题：**这个网络装不装得下杂货铺？** 给它教师的决策当监督，留出集上按计划层那几手**分别**看一致率 —— 哪一支学不会，才说明真缺特征或缺容量。
 * 做法：教师 = `st:toolkit` 的 pick；在真桌（5 席镜像 · 产品建局）上逐决策记 (featuresV7, 每个候选的 actionFeatures, 教师选的**技能**)；
 *   模型与参数布局照引擎（`value()`：W1 HID×FEAT_N 平铺 → B1 → W2 → B2，ReLU，无归一化），技能层 = 该技能各候选取 max（与 `forwardCands` 同一口径），
 *   损失 = 温度 0.6 的交叉熵 + Adam，按**局**切训练/留出（同局不跨集）。
 * ⚠ 最大的风险是"我写的第二份前向传播与引擎不一样" ⇒ **必做的自证**：采集时当场用一枚参照权重对每个候选逐位比 `EpirusPolicy.value`，
 *   `max|Δ| > 1e-9` ⇒ **整批作废**（`exit 3`，不解释、不放过）。`--self-test` 把这条自证单独跑一遍（不跑对局）。
 * ⚑ v1.7.50 新增（为下一步"热启动进化"）：**`--pack=` 把克隆出来的权重写成引擎能读的包**
 *   （`window.EPIRUS_CHAMPION_3P = {P.pack(w)};`；只有与引擎同宽的那一档 HID 能写），写完**当场读回自证**。
 *   热启动用法：`EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=<该包> node tools/train-3p.mjs <代> 5 8 8`（读不出会 `exit 5`，拒绝静默冷启动）。
 * 用法：node docs/debug/supervised-clone.mjs [--games=40] [--mode=multi] [--seed=20261015] [--hid=24,48] [--epochs=10]
 *        [--frac=0.72] [--out=champion-map/_clone-report.json] [--pack=champion-map/_clone-HID24.js]
 *        node docs/debug/supervised-clone.mjs --self-test
 * 退出码：0 ‖ 2 = 用法/装载/形状错 ‖ 3 = 逐位自证不过（整批作废）
 * ⚠ 本台只做**诊断**：不进判据、不动引擎、不动在册包（参照权重是自己 `makePolicy` 出来的随机向量）。
 */
import { sandbox, rejectUnknownFlags } from '../../tools/audit-lib.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['games', 'mode', 'seed', 'hid', 'epochs', 'out', 'pack', 'frac', 'self-test'], 'supervised-clone');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const N = 5, MODE = arg('mode', 'multi');
const SEED = Number(arg('seed', process.env.EPIRUS_SEED || 20261015));
const HIDS = String(arg('hid', '24,48')).split(',').map(Number);
const EPOCHS = Number(arg('epochs', 10)) || 10;
const FRAC = Number(arg('frac', 0.72)) || 0.72;

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, B = W.EpirusBots, P = W.EpirusPolicy;
const SK = R.SK;
if (!P || typeof P.value !== 'function' || typeof P.featuresV7 !== 'function') { console.error('⛔ EpirusPolicy 的前向面取不到'); process.exit(2); }
const FEAT_S = P.FEAT_S, FEAT_A = P.FEAT_A, NPAR = P.paramCount();
console.log('# 装载：FEAT_S=' + FEAT_S + ' ‖ FEAT_A=' + FEAT_A + ' ‖ 引擎 HID=' + P.HID + ' ‖ paramCount=' + NPAR +
  ' ‖ 桌=' + MODE + ' · ' + N + ' 人 · ' + GAMES + ' 局');
const toolkit = (B.STYLES || []).find(s => s.id === 'st:toolkit');
if (!toolkit) { console.error('⛔ STYLES 里没有 st:toolkit'); process.exit(2); }

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 62) >>> 0) / 4294967296; }; }
const ref = P.makePolicy ? P.makePolicy(0.25) : null;
if (!ref || ref.length !== NPAR) { console.error('⛔ 参照权重形状不对（' + (ref && ref.length) + '）'); process.exit(2); }

/* ---- 我自己的前向（必须与引擎逐位相等，见文件头那条自证） ---- */
function myValue(x, af, params, HID) {
  const NN = FEAT_S + FEAT_A;
  const B1 = HID * NN, W2 = B1 + HID, B2 = W2 + HID;
  let v = params[B2];
  for (let j = 0; j < HID; j++) {
    let s = 0; const base = j * NN;
    for (let i = 0; i < FEAT_S; i++) s += params[base + i] * x[i];
    for (let i = 0; i < FEAT_A; i++) s += params[base + FEAT_S + i] * (i < af.length ? af[i] : 0);
    s += params[B1 + j];
    if (s > 0) v += params[W2 + j] * s;
  }
  return v;
}
if (process.argv.includes('--self-test')) {
  /* 把"我的前向 == 引擎的前向"这条自证**单独**跑一遍：不跑对局、不读教师 ⇒ 便宜，且以后能被门直接钉住。
   * 方法照门 D34：同一份参照权重、同一个合成局面，逐个技能比两条路径的输出。 */
  const stT = S.createState(MODE, { next: mulberry32(SEED) }, N);
  stT.p[0].ep = 8; stT.p[0].guardNext = true; stT.p[1].copiedGuard = SK.REFLECT;
  const xT = Array.from(P.featuresV7(stT, 0));
  if (xT.length !== FEAT_S) { console.error('⛔ featuresV7 长度 ' + xT.length + ' ≠ FEAT_S ' + FEAT_S); process.exit(2); }
  let worst = 0, nT = 0;
  for (const k of ['gun', 'sword', 'charge', 'bagua', 'reflect', 'ji', 'bigT', 'cannon', 'curse']) {
    const afT = Array.from(P.actionFeatures(stT, 0, k, null));
    const theirs = P.value(stT, 0, k, ref, null);
    const mine = myValue(xT, afT, Array.from(ref), P.HID);
    const d = Math.abs(theirs - mine);
    if (!(d >= 0)) { console.error('⛔ 自检比对出 NaN ⇒ 两份实现至少有一份崩了'); process.exit(2); }
    if (d > worst) worst = d; nT++;
  }
  console.log('supervised-clone 自检：比对 ' + nT + ' 个技能 ‖ max|Δ| = ' + worst.toExponential(2));
  if (nT < 5 || worst > 1e-9) { console.error('⛔ 我这版前向与 EpirusPolicy.value 不一致（整批作废那条规矩）'); process.exit(2); }
  console.log('  ✓ 两份实现一致（' + (worst > 0 ? '浮点级差异' : '完全相等') + '）');
  process.exit(0);
}

const samples = []; let eqChecked = 0, eqMax = 0, noCand = 0;
for (let g = 0; g < GAMES; g++) {
  const st = S.createState(MODE, { next: mulberry32(SEED + g) }, N);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const chs = [];
  for (let i = 0; i < N; i++) {
    chs.push(function (state, pid, legal) {
      const act = toolkit.pick(state, pid, legal);
      const tkey = (typeof act === 'string') ? act : (act && act.key);
      try {
        const cands = P.candidatesFor(state, pid, legal, {}) || [];
        if (!cands.length) { noCand++; return act; }
        const x = Array.from(P.featuresV7(state, pid));
        if (x.length !== FEAT_S) { console.error('⛔ featuresV7 长度 ' + x.length + ' ≠ FEAT_S ' + FEAT_S); process.exit(2); }
        const afs = []; const skills = [];
        for (const c of cands) {
          const af = Array.from(P.actionFeatures(state, pid, c.key, c));
          afs.push(af); skills.push(c.key);
          /* 逐位相等自证：同一状态同一候选，我这版与引擎那版必须一样 */
          if (eqChecked < 4000) {
            const theirs = P.value(state, pid, c.key, ref, null, c);
            const mine = myValue(x, af, Array.from(ref), P.HID);
            const d = Math.abs(theirs - mine); if (!(d >= 0)) { console.error('⛔ 比对出 NaN ⇒ 两份实现至少有一份崩了'); process.exit(2); }
            if (d > eqMax) eqMax = d; eqChecked++;
          }
        }
        const li = skills.indexOf(tkey);
        if (li >= 0) samples.push({ g, x, afs, skills, li });
      } catch (e) { /* 采集绝不能改变对局 ⇒ 出错就只跳过这一格，但要计数 */
        noCand++; }
      return act;
    });
  }
  Play.autoGameN(st, chs);
}
console.log('# 采集：决策 ' + samples.length + ' 个（候选空/异常 ' + noCand + ' ‖ 相等性比对了 ' + eqChecked + ' 个候选）');
console.log('# 逐位相等自证：max|我的 value − EpirusPolicy.value| = ' + eqMax.toExponential(2) +
  (eqMax > 1e-9 ? ' ⇒ ⛔ 我这版前向与引擎不一致，**整批作废**（后面一个数都不要引）' : ' ⇒ ✓ 两份实现一致（' + (eqMax > 0 ? '浮点级差异' : '完全相等') + '）'));
if (eqChecked < 500 || eqMax > 1e-9) process.exit(3);

/* ---- 技能分布（教师自己在打什么） ---- */
const dist = {}; for (const s of samples) dist[s.skills[s.li]] = (dist[s.skills[s.li]] || 0) + 1;
const tot = samples.length;
const ranked = Object.keys(dist).sort((a, b) => dist[b] - dist[a]).slice(0, 8)
  .map(k => (R.byKey[k] && R.byKey[k].name || k) + ' ' + (100 * dist[k] / tot).toFixed(1) + '%');
const majority = Object.keys(dist).sort((a, b) => dist[b] - dist[a])[0];
console.log('# 教师的技能分布（这就是"随手猜最高频"能拿到的基线）：' + ranked.join(' ‖ ') +
  ' ⇒ 多数类基线 ' + (100 * dist[majority] / tot).toFixed(1) + '%（' + (R.byKey[majority] && R.byKey[majority].name || majority) + '）');

/* ---- 训练：技能层 max-pool 的次梯度 + Adam ---- */
function trainSplit(HID, tr, ho) {
  const NN = FEAT_S + FEAT_A;
  const size = HID * NN + 2 * HID + 1;
  const w = new Float64Array(size); const rng = mulberry32(991);
  for (let i = 0; i < size; i++) w[i] = (rng() + rng() + rng() - 1.5) * 0.2;
  const m = new Float64Array(size), v = new Float64Array(size);
  const B1 = HID * NN, W2 = B1 + HID, B2 = W2 + HID;
  const temp = 0.6;
  const fwd = (s, g) => {
    const grad = !!g;                      /* 传进来的就是累加梯度的那个数组；null ⇒ 只做前向（评价用） */
    const kmap = {}; const order = [];
    for (let ci = 0; ci < s.skills.length; ci++) { const k = s.skills[ci]; if (!(k in kmap)) { kmap[k] = { best: -1e18, bi: -1 }; order.push(k); } }
    const val = new Float64Array(s.skills.length);
    for (let ci = 0; ci < s.skills.length; ci++) {
      const af = s.afs[ci]; let vv = w[B2]; const hs = grad ? new Float64Array(HID) : null;
      for (let j = 0; j < HID; j++) {
        let sum = 0; const base = j * NN;
        for (let i = 0; i < FEAT_S; i++) sum += w[base + i] * s.x[i];
        for (let i = 0; i < FEAT_A; i++) sum += w[base + FEAT_S + i] * (i < af.length ? af[i] : 0);
        sum += w[B1 + j];
        if (grad) hs[j] = sum;
        if (sum > 0) vv += w[W2 + j] * sum;
      }
      val[ci] = vv;
      const e = kmap[s.skills[ci]];
      if (vv > e.best) { e.best = vv; e.bi = ci; if (grad) e.h = hs; }   /* ⚠ 次梯度只走"该技能里打分最高的那个候选"，
                                                                            否则 max-pool 的梯度会串到非极大分支上 */
    }
    if (!grad) return { val, kmap, order };
    /* 技能层 softmax（每技能取其候选里的最大值 = 引擎那套两级口径） */
    const mx = Math.max.apply(null, order.map(k => kmap[k].best));
    const pk = order.map(k => Math.exp((kmap[k].best - mx) / temp));
    const Z = pk.reduce((a, b) => a + b, 0);
    const yIdx = order.indexOf(s.skills[s.li]);
    let loss = -Math.log((pk[yIdx] || 0) / Z);
    for (let t = 0; t < order.length; t++) {
      const p = pk[t] / Z;
      const e = kmap[order[t]]; const ci = e.bi; const af = s.afs[ci]; const hs = e.h;
      if (!hs) continue;
      const dl = (p - (t === yIdx ? 1 : 0)) / temp;
      for (let j = 0; j < HID; j++) {
        if (hs[j] > 0) {
          const base = j * NN;
          for (let i = 0; i < FEAT_S; i++) g[base + i] += dl * s.x[i];
          for (let i = 0; i < FEAT_A; i++) g[base + FEAT_S + i] += dl * (i < af.length ? af[i] : 0);
          g[B1 + j] += dl;
          g[W2 + j] += dl * hs[j];
        }
      }
      g[B2] += dl;
    }
    return { loss };
  };
  let lastAcc = null, lastAccPlanned = null;
  for (let ep = 0; ep < EPOCHS; ep++) {
    const g = new Float64Array(size); let loss = 0;
    for (let si = 0; si < tr.length; si++) { loss += (fwd(tr[si], g) || {}).loss || 0; if ((si % 32) === 31 || si === tr.length - 1) {
      const lr = 0.008, b1 = 0.9, b2c = 0.999, eps = 1e-8;
      for (let i = 0; i < size; i++) {
        m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2c * v[i] + (1 - b2c) * g[i] * g[i];
        w[i] -= lr * m[i] / (Math.sqrt(v[i]) + eps); g[i] = 0;
      }
    } }
    /* 留出集 top-1 一致率：总体 + "教师打计划卡（非ジ）"那一子集 ‖ **逐张卡拆开**（这才是诊断的主语：
       哪一支学不会才说明真缺特征/缺容量，claude 第 1 步要的就是这张表） */
    let ok = 0, okPlanned = 0, nPlanned = 0;
    const perT = {}; const perPred = {};
    for (const s of ho) {
      const f = fwd(s, null);
      let best = -1e18, bk = null;
      for (const k of f.order) if (f.kmap[k].best > best) { best = f.kmap[k].best; bk = k; }
      const tk = s.skills[s.li];
      perT[tk] = perT[tk] || { n: 0, hit: 0 }; perT[tk].n++;
      perPred[bk] = perPred[bk] || { n: 0, hit: 0 }; perPred[bk].n++;
      if (bk === tk) { ok++; perT[tk].hit++; perPred[bk].hit++; }
      if (tk !== SK.JI) { nPlanned++; if (bk === tk) okPlanned++; }
    }
    lastAcc = ok / ho.length; lastAccPlanned = nPlanned ? okPlanned / nPlanned : null;
    if (ep === EPOCHS - 1) {
      const tops = Object.keys(perT).sort((a, b) => perT[b].n - perT[a].n).slice(0, 9);
      console.log('   逐张卡（教师选它时，模型也选它的比例 = 召回 ‖ 括号 = 留出集里该教师手 n ‖ 模型选中它的次数）：');
      tops.forEach(k => {
        const t = perT[k], pr = perPred[k] || { n: 0, hit: 0 };
        console.log('     ' + ((R.byKey[k] && R.byKey[k].name) || k).padEnd(7) + ' 召回 ' +
          (100 * t.hit / t.n).toFixed(1) + '%（n=' + t.n + '）‖ 模型侧 ' + pr.n + ' 次里对 ' +
          (pr.n ? (100 * pr.hit / pr.n).toFixed(1) : '—') + '%');
      });
    }
    if (ep % 2 === 1 || ep === EPOCHS - 1) console.log('   HID=' + HID + ' epoch ' + (ep + 1) + ' ‖ loss ' + (loss / tr.length).toFixed(4) +
      ' ‖ 留出 top-1 ' + (100 * lastAcc).toFixed(1) + '% ‖ 非ジ子集 ' + (lastAccPlanned === null ? '—' : (100 * lastAccPlanned).toFixed(1) + '%') + '（n=' + nPlanned + '）');
  }
  return { HID, acc: lastAcc, accPlanned: lastAccPlanned, w: w };
}
/* 按局切分（同一局的决策不许跨集 ⇒ 免得上限被同局相关性吹高）‖ 洗牌用**定种子** rng，不用 Math.random（否则切分不可复现） */
const shuf = mulberry32(SEED * 7 + 11);
const gs = Array.from(new Set(samples.map(s => s.g))).sort(() => shuf() - 0.5);
const cut = Math.max(1, Math.floor(gs.length * 0.72));
const trSet = samples.filter(s => gs.slice(0, cut).indexOf(s.g) >= 0);
const hoSet = samples.filter(s => gs.slice(cut).indexOf(s.g) >= 0);
console.log('# 切分：训练 ' + trSet.length + ' ‖ 留出 ' + hoSet.length + '（按**局**切，' + gs.length + ' 局 → ' + cut + '/' + (gs.length - cut) + '）');
const out = [];
for (const HID of HIDS) { console.log('== 拟合 HID=' + HID + ' =='); out.push(trainSplit(HID, trSet, hoSet)); }
console.log('\n== 结论口径 ==');
console.log('  多数类基线（不用网络也能拿到的一致率） ' + (100 * dist[majority] / tot).toFixed(1) + '% ‖ 教师非ジ决策占 ' +
  (100 * samples.filter(s => s.skills[s.li] !== SK.JI).length / tot).toFixed(1) + '%');
const nonJi = samples.filter(s => s.skills[s.li] !== SK.JI);
const njDist = {}; nonJi.forEach(s => { njDist[s.skills[s.li]] = (njDist[s.skills[s.li]] || 0) + 1; });
const njMaj = Object.keys(njDist).sort((a, b) => njDist[b] - njDist[a])[0];
console.log('  **在非ジ子集里"永远猜最高频那张"的基线 = ' + (100 * njDist[njMaj] / nonJi.length).toFixed(1) +
  '%（' + ((R.byKey[njMaj] && R.byKey[njMaj].name) || njMaj) + ' ‖ n=' + nonJi.length + '）');
out.forEach(o => console.log('  HID=' + o.HID + ' ‖ 留出总体 ' + (100 * o.acc).toFixed(1) + '% ‖ 非ジ子集 ' + (o.accPlanned === null ? '—' : (100 * o.accPlanned).toFixed(1)) + '%'));
writeFileSync(join(ROOT, arg('out', 'champion-map/_clone-report.json')), JSON.stringify({
  ts: new Date().toISOString(), FEAT_S, FEAT_A, engineHID: P.HID, games: GAMES, decisions: tot,
  eqChecked, eqMax, teacherDist: dist, majority: { key: majority, share: dist[majority] / tot },
  split: { train: trSet.length, holdout: hoSet.length, byGame: gs.length }, results: out.map(o => ({ HID: o.HID, acc: o.acc, accPlanned: o.accPlanned })) }, null, 1) + '\n', 'utf8');

/* ===== v1.7.50：**把克隆权重写成能热启动的包**（用户 10-15 晚：「用克隆出来的权重做热启动」）=====
 * 只有与引擎同宽的那一档 HID 能写：`P.pack` 写的是 `paramCount()` 那个布局，别的宽度装不进去。
 * 写完**当场读回自证**：走热启动那条路（`P.unpack(o,true)` → `embedLegacy`，与 `tools/train-3p.mjs:1091` 逐字同一套）必须拿回形状正确的权重。 */
const PACKREL = arg('pack', 'champion-map/_clone-HID' + P.HID + '.js');
const PACKP = join(ROOT, PACKREL);
const mine24 = out.find(o => o.HID === P.HID && o.w);
if (!mine24) {
  console.log('\n⚠ 没有与引擎同宽的那一档（HID=' + P.HID + '）的结果 ⇒ **不写权重包**（`--hid=` 里要含 ' + P.HID + ' 才能热启动）');
} else {
  const o24 = P.pack(mine24.w);
  if (o24.a.length !== P.paramCount()) { console.error('⛔ 克隆权重长度 ' + o24.a.length + ' ≠ paramCount ' + P.paramCount()); process.exit(2); }
  writeFileSync(PACKP, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(o24) + ';\n', 'utf8');
  const back = P.embedLegacy(P.unpack(o24, true));
  const okBack = !!back && back.length === P.paramCount();
  console.log('\n已写克隆权重包：' + PACKREL + '（HID=' + P.HID + ' · ' + o24.a.length + ' 参数 · 留出 top-1 ' +
    (100 * mine24.acc).toFixed(1) + '%' + (mine24.accPlanned === null ? '' : ' ‖ 非ジ子集 ' + (100 * mine24.accPlanned).toFixed(1) + '%') + '）');
  console.log('  读回自证（unpack(...,true) + embedLegacy）' + (okBack ? ' ✓' : ' ⛔ 失败'));
  console.log('  热启动用法：EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=' + PACKREL + ' node tools/train-3p.mjs <代> 5 8 8');
  if (!okBack) process.exit(2);
}
