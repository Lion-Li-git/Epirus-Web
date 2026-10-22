#!/usr/bin/env node
/* §E679 跨臂**固定场**汇总尺（探索分支在册量具，10-22 夜班）。
 * 为什么必须有这一台：各臂内部那条 `holdout()` 用**自己的 params** 建对手（`buildOpps(params, 0.05)`）⇒ 只在自行内可读；
 *   循环内的 `inLoopBest` 更跨臂不可比（GA 走 shaped/内部择优，CEM 走原始 fit），而且实测有一截是 **idx 抽签**
 *   （同一粒只换 idx ⇒ SD≈0.12–0.17，见 `tools/probe-idx-spread.mjs`）。
 * 这台尺的做法：**场只建一次**（从起点夹具），所有包吃同一批对手 + 同一 (gen,idx) ⇒ 跨臂/跨 seed 才可比。
 * 用法：node tools/probe-cem-yard.mjs --dir=<批次根> [--batches=a,b,c,d] [--trainMode=multi] [--n=3] [--games=300] [--start=<夹具包>]
 *        （`--dir` 指到放 `arm-*.log` 与 `pack-<mode>-<seed>.js` 的目录；批 D 那档要 `--trainMode=long --n=5`）
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dir', 'batches', 'trainMode', 'n', 'games', 'start'], 'probe-cem-yard');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIR = arg('dir', '');
const BATCHES = String(arg('batches', 'a,b,c,d')).split(',').map(s => s.trim()).filter(Boolean);
const MODE = arg('trainMode', 'multi'), N = Number(arg('n', 3)), HG = Number(arg('games', 300));
const START = arg('start', 'docs/artifacts/eval-out/win-Ldemo.bak');
if (!DIR) { console.error('⛔ 必须给 --dir=<批次根>（里面要有 arm-*.log 与 pack-*.js）'); process.exit(64); }
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
if (T.setTrainMode) T.setTrainMode(MODE);
if (T.trainMode && T.trainMode() !== MODE) { console.error('⛔ 桌形没生效（要 ' + MODE + ' 读到 ' + T.trainMode() + '）⇒ 记下来的口径是假的'); process.exit(2); }
const REFc = loadChamp(W, START);
if (!REFc || REFc.length !== P.paramCount()) { console.error('⛔ 起点夹具读不出/维度不符：' + START); process.exit(2); }
const REF = Float64Array.from(REFc);
const OPPS = T.buildOpps(REF, 0.05);          /* ← 只建一次：所有包吃同一批对手 */
const yard = function (params) {
  const r = T.scoreMemberN(params, OPPS, HG, N, 999, 0, 0);
  return { fit: r.fit, first: r.firstRate, top2: r.top2Rate };
};
const start = yard(REF);
console.log('固定场 trainMode=' + MODE + ' ‖ n=' + N + ' ‖ ' + HG + ' 局 ‖ 场只建一次 ‖ 起点 ' + START);
console.log('起点 fit=' + start.fit.toFixed(4) + ' 夺1=' + (100 * start.first).toFixed(1) + '% 前二=' + (100 * start.top2).toFixed(1) + '%');
for (const b of BATCHES) {
  const dir = DIR + '/' + b;
  if (!existsSync(dir)) { console.log('\n== 批 ' + b + '：目录不在（' + dir + '）=='); continue; }
  const arms = [];
  for (const f of readdirSync(dir).filter(x => /^arm-.*\.log$/.test(x))) {
    const m = /\{"mode":.*\}/.exec(readFileSync(dir + '/' + f, 'utf8'));
    if (!m) { console.log('  ' + f + '：无 JSON 回执行（未完成）'); continue; }
    try { arms.push(Object.assign(JSON.parse(m[0]), { file: f })); } catch (e) { console.log('  ' + f + '：回执行不可解析'); }
  }
  if (!arms.length) { console.log('\n== 批 ' + b + '：还没有完成的臂 =='); continue; }
  console.log('\n== 批 ' + b + '（evals≈' + arms[0].evals + ' ‖ games=' + arms[0].games + ' ‖ pop=' + arms[0].pop +
    ' ‖ 完成 ' + arms.length + ' 臂 ‖ 回执里的桌形=' + (arms[0].trainMode || '(旧回执无此字段)') + ' n=' + arms[0].n + '）==');
  if (arms[0].trainMode && arms[0].trainMode !== MODE) console.error('  ⚠ 回执桌形是 ' + arms[0].trainMode + '，而这把尺喂的是 ' + MODE + ' ⇒ 别把两边的数并排读');
  if (arms[0].n !== N) console.error('  ⚠ 回执人数 n=' + arms[0].n + '，而这把尺是 n=' + N + ' ⇒ 同上');
  if (arms[0].startLabel && String(arms[0].startLabel).indexOf(START) < 0)
    console.error('  ⛔ 回执的起点是「' + arms[0].startLabel + '」，而这把尺的 --start 是 ' + START +
      ' ⇒ 场是用**另一粒**建的 ⇒ 这批"与起点差"是假的（10-22 实测：忘传 --start 会安静地把批 E 的臂用批 D 的场量）');
  const bySeed = {}, vs = [];
  for (const a of arms) {
    const pk = dir + '/pack-' + a.mode + '-' + a.seed + '.js';
    let y = null;
    if (existsSync(pk)) {
      const p = loadChamp(W, pk);
      if (p && p.length === P.paramCount()) { y = yard(Float64Array.from(p)); vs.push({ mode: a.mode, y: y }); }
    }
    (bySeed[a.seed] = bySeed[a.seed] || {})[a.mode] = { a: a, y: y };
    console.log('  ' + a.mode.padEnd(4) + ' seed' + a.seed + ' ‖ inLoop=' + a.inLoopBest.toFixed(3) +
      ' 臂内 holdout=' + a.holdoutFit.toFixed(4) + '/' + (100 * a.holdoutFirst).toFixed(1) + '%' +
      (y ? ' ‖ 固定场 fit=' + y.fit.toFixed(4) + ' 夺1=' + (100 * y.first).toFixed(1) + '% 前二=' + (100 * y.top2).toFixed(1) + '%'
          : ' ‖ 固定场：无产物/维度不符') + ' ‖ ' + a.secs + 's');
  }
  const ds = [], df = [];
  for (const s of Object.keys(bySeed)) {
    const g = bySeed[s].ga, c = bySeed[s].cem;
    if (!g || !c || !g.y || !c.y) { console.log('  seed ' + s + '：配对缺臂/缺产物 ⇒ 不进配对统计'); continue; }
    ds.push(c.y.fit - g.y.fit); df.push(100 * (c.y.first - g.y.first));
  }
  if (ds.length) {
    const mean = ds.reduce((x, y) => x + y, 0) / ds.length;
    const sd = ds.length > 1 ? Math.sqrt(ds.reduce((x, y) => x + (y - mean) ** 2, 0) / (ds.length - 1)) : NaN;
    const se = sd / Math.sqrt(ds.length);
    console.log('  ⇒ Δfit(CEM−GA) 逐对 ' + ds.map(x => x.toFixed(3)).join(' ') + ' ‖ 均值=' + mean.toFixed(4) +
      ' SE=' + se.toFixed(4) + ' ‖ |均值|/SE=' + (Math.abs(mean) / se).toFixed(1) + ' ‖ 正号 ' + ds.filter(x => x > 0).length + '/' + ds.length);
    console.log('  ⇒ Δ夺1 逐对 ' + df.map(x => x.toFixed(1)).join(' ') + 'pt ‖ 均值=' +
      (df.reduce((x, y) => x + y, 0) / df.length).toFixed(2) + 'pt（每对 ' + HG + ' 局 ⇒ 单对 1σ≈' +
      (100 * Math.sqrt(0.25 / HG) * Math.SQRT2).toFixed(1) + 'pt）');
  }
  for (const m of ['ga', 'cem']) {
    const arr = vs.filter(x => x.mode === m);
    if (!arr.length) continue;
    const mf = arr.reduce((x, y) => x + y.y.fit, 0) / arr.length;
    console.log('  ' + m.toUpperCase() + ' 均值 fit=' + mf.toFixed(4) + ' ‖ 与起点差=' + (mf - start.fit).toFixed(4) +
      ' ‖ 夺1 均值=' + (100 * arr.reduce((x, y) => x + y.y.first, 0) / arr.length).toFixed(1) + '%（起点 ' + (100 * start.first).toFixed(1) + '%）');
  }
}
console.log('\n⚠ 跨臂只比"固定场"那两列；inLoop / 臂内 holdout 都各自建场，不可并排读。');
console.log('⚠ 每个 --start 只是一个起点：同批内的"正号 n/m"是 seed 簇的自由度，不是起点的自由度 ⇒ 跨批（不同 --start）合读才算复现。');
