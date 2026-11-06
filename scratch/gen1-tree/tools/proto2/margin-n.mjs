/* margin-n.mjs —— ZCode 10-29 深夜小探针（2.0 容量分析供数，详见 docs/research/PROTO2-CAPACITY-N-2026-10-29-zcode.md）：
 * 同一枚包在 n=3/5/8 上逐决策记录 logit 的归一化间隔（top1−top2)/std、softmax 置信度 maxp、熵占比 H/log(nc)、候选数。
 * 判读：间隔随 N 塌掉 ⇒ 校准/尺度问题（修温度/归一化即可，与容量无关）；间隔稳而打不过 ⇒ 表示/推理问题。
 * 装配照抄 matrix2（对手表种子 20261029 同源）；v7 用独立沙箱（arch2 覆盖 P 的方法 ⇒ v7 必须在任何 install 之前量）。
 * 用法：node tools/proto2/margin-n.mjs [--packs=a.bak,b.bak] [--ns=3,5,8] [--games=10] [--temp=0.15] [--style=wall] [--v7=1]
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp, buildPoolSeeded } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACKS = arg('packs', 'scratch/arms/COMBO-s7.bak,scratch/arms/LONG-s7.bak,scratch/arms/N2-fx-S1o.bak').split(',');
const NS = String(arg('ns', '3,5,8')).split(',').map(Number);
const MODE = arg('mode', 'multi');
const STYLE = arg('style', 'wall');
const GAMES = Math.max(2, Number(arg('games', 10)) || 10);
const TEMP = Number(arg('temp', 0.15));
const WITH_V7 = String(arg('v7', '1')) === '1';
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function freshPool() {
  const W0 = sandbox();
  const ref = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
  return buildPoolSeeded(W0.EpirusTrainer, ref, 20261029);
}

function probeEnv(params, isV7) {
  const W = sandbox();
  const P = W.EpirusPolicy, T = W.EpirusTrainer;
  let arch = null;
  if (!isV7) {
    const raw = params.raw, cfg = { mutMode: 'seg', ...(raw.dims || {}) };
    if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
    arch = installArch2(W, cfg);
  }
  return { W, P, T, POOL: freshPool(), arch };
}

function probePack(tag, params, isV7) {
  const { P, T, POOL } = probeEnv(params, isV7);
  const idx = POOL.findIndex(o => o.name === STYLE);
  const recs = [], wins = { g: 0, first: 0 };
  const inner = T.policyChooserN(params, TEMP);
  const actor = (state, pid, legal) => {
    try {
      const base = T.econBase(state, pid, legal);
      const cands = P.candidatesFor(state, pid, base, { lockTarget: false });
      if (cands && cands.length >= 2) {
        let lg;
        if (isV7) lg = cands.map(c => P.value(state, pid, c.key, params, null, c));
        else lg = Array.from(P.forwardCands(state, pid, cands, params, { temp: 0.001 }).logits);
        if (lg && lg.length >= 2 && lg.every(v => Number.isFinite(v))) {
          const sorted = [...lg].sort((a, b) => b - a);
          const m = lg.reduce((a, b) => a + b, 0) / lg.length;
          const sd = Math.sqrt(lg.reduce((a, b) => a + (b - m) * (b - m), 0) / lg.length) || 1e-9;
          const ex = lg.map(v => Math.exp(Math.max(-50, Math.min(50, v)))); const sum = ex.reduce((a, b) => a + b, 0);
          const probs = ex.map(v => v / sum);
          const H = -probs.reduce((a, p) => a + p * Math.log(p + 1e-12), 0);
          recs.push({ n: state.p.length, nc: lg.length, nmargin: (sorted[0] - sorted[1]) / sd, maxp: Math.max(...probs), Hn: H / Math.log(lg.length) });
        }
      }
    } catch (e) { /* 记录失败不挡局 */ }
    return inner(state, pid, legal);
  };
  for (const n of NS) for (let g = 0; g < GAMES; g++) {
    const seat = g % n;
    const choosers = [];
    for (let pid = 0; pid < n; pid++) choosers.push(pid === seat ? actor : POOL[(idx + 1 + pid) % POOL.length].sel);
    const rm = T.oneGameN(choosers, 5000 + n * 131 + g * 7919, n, { regen: 0, mode: MODE });
    wins.g++;
    if (rm.winner === seat) wins.first++;
  }
  const buckets = {};
  for (const r of recs) (buckets[r.n] = buckets[r.n] || []).push(r);
  console.log('== ' + tag + ' (temp=' + TEMP + ', ' + MODE + '/' + STYLE + ', ' + GAMES + '局/n) ‖ 夺1 ' + wins.first + '/' + wins.g);
  for (const n of NS) {
    const b = buckets[n] || [];
    if (!b.length) { console.log('   n=' + n + ' 无记录'); continue; }
    const ncMean = mean(b.map(r => r.nc));
    console.log('   n=' + n + ' 决策' + b.length +
      ' ‖ 归一间隔中位 ' + med(b.map(r => r.nmargin)).toFixed(3) +
      ' ‖ maxp均 ' + mean(b.map(r => r.maxp)).toFixed(3) +
      ' ‖ 熵占比均 ' + mean(b.map(r => r.Hn)).toFixed(3) +
      ' ‖ 候选均 ' + ncMean.toFixed(1) +
      ' ‖ 1/nc ' + (1 / Math.max(2, Math.round(ncMean))).toFixed(3));
  }
}

/* v7 必须最先量（它自己的沙箱，无 arch2 覆盖） */
if (WITH_V7) probePack('v7(线上包)', Float64Array.from(loadChamp(sandbox(), 'js/bundled-champion-3p.js', '')), true);
for (const p of PACKS) {
  const raw = JSON.parse(readFileSync(p, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
  if (raw.v !== 90) { console.log('== ' + p + ' ⛔ 非 2.0 容器(v=' + raw.v + ')'); continue; }
  const Wp = sandbox();
  const Pp = Wp.EpirusPolicy;
  const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
  if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
  installArch2(Wp, cfg);
  const params = Float64Array.from(Pp.unpack(raw, true));
  params.raw = raw;
  probePack(p.split('/').pop(), params, false);
}
