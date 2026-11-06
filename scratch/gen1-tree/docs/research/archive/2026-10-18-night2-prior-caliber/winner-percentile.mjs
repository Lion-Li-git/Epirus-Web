/* C1（DS 的 10-19 待办清单 §7.4）· "当选者在其候选分布里的分位"这把读数
 * 为什么这条值得单独量：§E650 七 已经把每支谱系的**候选分布**量出来了（`gift-ladder-dist.log.txt`），
 *   而 §E650 六 那句"选择键把最凶的一粒端到当选位"的分母只有**每格六席的名次** ⇒ 名次这把尺看不见剂量，
 *   也看不见"当选者在整条谱系产出的全部候选里排第几"。DS 的原话形态（只读数、不动行为）：
 *     [当选] 当选者 送盾 24.0/局 ‖ 候选分布 p50 6.1 / p90 39.2 ⇒ 分位 88%
 * ⚑ 三条口径必须说清（否则这台尺会自己撒谎）：
 *   ① **分母含当选者自己**（它本来就是候选之一）⇒ 用中位秩（below + 0.5×equal），随机挑的期望值就是 50%，不是"50%+1/n"；
 *   ② 分母 = 该谱系**三粒 seed 的六席去重后**全体（`gift-ladder-dist.mjs` 同一把去重尺：按权重本体 sha8），
 *      ⇒ 它把三个梯子的候选池化，所以"分位"是**谱系级**形状，不是那一梯子的相对位置（后者 §E650 已印过，这里一起印作对照）；
 *   ③ 平局必须显式：teach/expo 那一堆 0.00 的候选里"分位 35%"与"分位 5%"**都可能**是平局造成的 ⇒ 逐粒的相等数一起印。
 * 顺带一条免费的：每席的 `trainFit=` 就在臂日志里 ⇒ 同一条梯子内的 ρ(fit, 送盾) 也印出来（**注意**：
 *   "（当选）"并不是 argmax(trainFit)，gv0-77000 的当选在第 5 席 ⇒ 这条 ρ 只描述形状，不等于当选判据）。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/winner-percentile.mjs
 * 只读：读 `arms/` 与既有日志，不写任何盘。
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { sandbox, loadChamp, rejectUnknownFlags, HOLO_GIFT_MAX } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), [], 'winner-percentile');   /* 仓规（D218）：不吃旗标 ⇒ 任何 `--x=` 都该 exit 64 */
const A = path.join(HERE, 'arms');
if (!existsSync(A)) { console.error('⛔ 没有 arms/ ⇒ 读不出'); process.exit(2); }
const W = sandbox(ROOT); const T = W.EpirusTrainer;
T.setSupportPrior(0);   // 与 §E650 七 同一档：全部按**裸包**量
const wid = p => { const a = loadChamp(W, p, ROOT); return a ? createHash('sha1').update(JSON.stringify(a.a || a)).digest('hex').slice(0, 8) : null; };
const gift = (p, g) => { const a = loadChamp(W, p, ROOT); if (!a) return null;
  const mh = T.mirrorHealth(a, g, 5, 'multi'); const v = Number(mh && mh.holoOtherPerGame); return isFinite(v) ? v : null; };

const LINES = [['gv', 'v7beadseed-82（现网池成员，起点 17.3）'], ['tw', 'v7teach-32（起点 81.4）'],
  ['ex', 'v7expo-34（起点 115.0）'], ['wa', 'v7wall-33（起点 8.7，灰带）'],
  ['b3', 'v7beadseed-31（同族姊妹，起点 0.00）'], ['b9', 'v7beadseed-93（同族姊妹，起点 0.80）']];
const winnerBandOf = (txt, arm) => ((txt.match(new RegExp('^\\[band-save\\] (' + arm + '-band\\d+)\\.bak\\s+trainFit=[\\d.]+（当选）', 'm')) || [])[1]) || null;
const seatFits = (txt, arm) => { const out = []; const re = new RegExp('^\\[band-save\\] (' + arm + '-band(\\d))\\.bak\\s+trainFit=([\\d.]+)', 'gm');
  let m; while ((m = re.exec(txt))) out.push({ seat: +m[2], fit: +m[3] }); return out; };

console.log('线 = 六支谱系 ‖ 每谱系三粒 seed（77000/77001/77002）‖ 尺 = @100 裸包 holoOtherPerGame ‖ 线值 HOLO_GIFT_MAX=' + HOLO_GIFT_MAX);
const all = [];
for (const [pfx, name] of LINES) {
  /* 候选分布：与该谱系前缀有关的**全部**产物按权重本体去重（与 gift-ladder-dist.mjs 同一把尺） */
  const seen = new Map();
  for (const f of readdirSync(A)) {
    if (f.indexOf(pfx + '-') !== 0 || f.indexOf('--') < 0) continue;
    const abs = path.join(A, f); const w = wid(abs); if (!w) continue;
    if (!seen.has(w)) seen.set(w, abs);
  }
  const vals = [];
  for (const [, abs] of seen) { const g = gift(abs, 100); if (g !== null && isFinite(g)) vals.push(g); }
  vals.sort((a, b) => a - b);
  if (!vals.length) { console.log('\n## ' + name + '：候选读不出 ⇒ 这一支不参与'); continue; }
  const q = t => vals[Math.min(vals.length - 1, Math.floor(t * vals.length))];
  console.log('\n## ' + name + ' ‖ 候选 n=' + vals.length + '（三粒 seed 的六席去重）‖ p50=' + q(0.5).toFixed(2) +
    ' ‖ p90=' + q(0.9).toFixed(2) + ' ‖ 最小=' + vals[0].toFixed(2) + ' ‖ 最大=' + vals[vals.length - 1].toFixed(2));
  for (const s of [77000, 77001, 77002]) {
    const lg = path.join(HERE, 'gift-veto-' + pfx + '0-' + s + '.log.txt');
    if (!existsSync(lg)) { console.log('  seed ' + s + '：臂日志不在 ⇒ 读不出'); continue; }
    const txt = readFileSync(lg, 'utf8');
    const band = winnerBandOf(txt, pfx + '0-' + s);
    if (!band) { console.log('  seed ' + s + '：日志里读不到"（当选）"行 ⇒ 读不出（不许拿名次冒充）'); continue; }
    const cand = [path.join(A, pfx + '-' + pfx + '0-' + s + '--' + band + '.bak'),
      path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, band + '.bak')];
    const p = cand.find(x => existsSync(x));
    if (!p) { console.log('  seed ' + s + '：当选产物不在盘上 ⇒ 读不出'); continue; }
    const wg = gift(p, 100);
    if (wg === null) { console.log('  seed ' + s + '：当选者送盾读不出 ⇒ 读不出'); continue; }
    const below = vals.filter(x => x < wg - 1e-9).length, equal = vals.filter(x => Math.abs(x - wg) <= 1e-9).length;
    const mid = (below + 0.5 * equal) / vals.length * 100;
    /* 对照：同一梯子里的名次（§E650 那把尺），用来核"分位与名次讲的是不是一回事" */
    const lad = [];
    for (let k = 1; k <= 6; k++) { const f = path.join(A, pfx + '-' + pfx + '0-' + s + '--' + pfx + '0-' + s + '-band' + k + '.bak');
      const fl = path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, pfx + '0-' + s + '-band' + k + '.bak');
      const q2 = f.length && existsSync(f) ? f : (existsSync(fl) ? fl : null); if (!q2) continue;
      const g = gift(q2, 100); if (g !== null) lad.push(g); }
    const rank = 1 + lad.filter(g => g > wg + 1e-9).length;
    console.log('  [当选] seed ' + s + ' 送盾 ' + wg.toFixed(2) + '/局 ‖ 候选 p50 ' + q(0.5).toFixed(1) + ' / p90 ' + q(0.9).toFixed(1) +
      ' ⇒ **分位 ' + mid.toFixed(0) + '%**（低于它 ' + below + ' 粒 ‖ 与它相等 ' + equal + ' 粒 ‖ n=' + vals.length + '）' +
      '‖ 同梯子名次 ' + rank + '/' + lad.length + (wg > HOLO_GIFT_MAX ? ' ‖ **超线**' : ''));
    all.push({ pfx: pfx, seed: s, g: wg, mid: mid, below: below, equal: equal, n: vals.length, rank: rank, ladN: lad.length });
    /* ρ(fit, 送盾)：同一条梯子六席内的秩相关（n≤6，平局多 ⇒ 只作形状，不当检验） */
    const fits = seatFits(txt, pfx + '0-' + s);
    const rowsP = [];
    for (const f of fits) { const seatFile = path.join(A, pfx + '-' + pfx + '0-' + s + '--' + pfx + '0-' + s + '-band' + f.seat + '.bak');
      const fl = path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, pfx + '0-' + s + '-band' + f.seat + '.bak');
      const pth = existsSync(seatFile) ? seatFile : (existsSync(fl) ? fl : null); if (!pth) continue;
      const g = gift(pth, 100); if (g === null) continue; rowsP.push({ fit: f.fit, g: g }); }
    if (rowsP.length >= 4) {
      const rk = arr => { const o = arr.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length);
        for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
          const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; };
      const rf = rk(rowsP.map(x => x.fit)), rg = rk(rowsP.map(x => x.g));
      const m1 = rf.reduce((a, b) => a + b, 0) / rf.length, m2 = rg.reduce((a, b) => a + b, 0) / rg.length;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < rf.length; i++) { const a = rf[i] - m1, b = rg[i] - m2; sxy += a * b; sxx += a * a; syy += b * b; }
      const rho = (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null;
      console.log('        └ 该梯子内 ρ(trainFit, 送盾) = ' + (rho === null ? '读不出（某一边全平）' : rho.toFixed(2)) +
        '（n=' + rowsP.length + ' 席 ‖ **不是当选判据**：日志里"（当选）"可以不在 fit 第一位）');
    }
  }
}
if (all.length) {
  const mids = all.map(x => x.mid).sort((a, b) => a - b);
  const med = mids[Math.floor(mids.length / 2)];
  console.log('\n汇总：' + all.length + ' 格 ‖ 分位中位 ' + med.toFixed(0) + '% ‖ P25 ' + mids[Math.floor(mids.length * 0.25)].toFixed(0) +
    '% ‖ P75 ' + mids[Math.floor(mids.length * 0.75)].toFixed(0) + '%（随机挑的期望 = 50%）');
  console.log('  分位 ≥90% 的格数 = ' + all.filter(x => x.mid >= 90).length + ' ‖ 当选者就是该谱系最大送盾的格数 = ' +
    all.filter(x => x.below + x.equal === x.n).length + '（n=' + all.length + '）');
  console.log('⚑ 分母说实话：' + all.length + ' 格分布在 ' + new Set(all.map(x => x.pfx)).size + ' 支谱系上，而**谱系本身是 n=1/条**' +
    ' ⇒ 这把尺能把"当选位是不是自己那批里最凶的一粒"说成数，**不能**据此下"选择键必然挑刷屏的"这个结论（那要更多起点）。');
  console.log('⚑ 平局那格必须看：分位低但 equal 大（一堆 0.00 里排序）与"真的挑了干净的一粒"不同形 ⇒ 逐格已把 below/equal 印全。');
}
