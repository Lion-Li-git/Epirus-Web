/* D35 那三条"门槛参与择优"的写法钉要换成行为判据，缺的是一个**正对照夹具**：
 *   得有一粒"base 分更高、但自对局体检不过"的包，否则"选中的是健康那粒"在门槛开/关两种设置下同形 ⇒ 等式是空枪。
 * 本探针在**在册产物**里找这样的夹具（抽 40 枚），并把每枚的 base 与体检读数打出来。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { execSync } from 'node:child_process';
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['stride', 'pool'], 'probe-health-fixture-scan');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const STRIDE = Number(arg('stride', 4));
const INCLUDE_POOL = arg('pool', '0') === '1';
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
const files = execSync('git ls-files docs/artifacts', { encoding: 'utf8' }).split('\n')
  .filter(f => /\.(bak|js)$/.test(f) && (INCLUDE_POOL || !/train-3p-out|pool/.test(f)));
const step = Math.max(1, STRIDE);
const picks = Object.keys(B).filter(k => /^pick/.test(k)).slice(0, 6);
const HG = T.healthGate();
const ref = Float64Array.from(loadChamp(W, 'docs/artifacts/eval-out/win-Ldemo.bak'));
const baseOf = function (p) {
  const sel = T.policyChooserN(p, 0.05);
  const rs = picks.map(k => T.correctedWinRate(sel, B[k], 4, 12345));
  const wr = rs.reduce((a, b) => a + b.wr, 0) / rs.length, mn = Math.min.apply(null, rs.map(x => x.wr));
  return { base: 0.5 * wr + 0.5 * mn, wr: wr, mn: mn };
};
const refBase = baseOf(ref).base;
console.log('参照：win-Ldemo 的 base=' + refBase.toFixed(4) + ' ‖ 扫描 ' + Math.ceil(files.length / step) + '/' + files.length + ' 枚（步长 ' + step + '）');
const hits = [];
for (let i = 0; i < files.length; i += step) {
  const f = files[i];
  let c = null;
  try { c = loadChamp(W, f); } catch (e) { continue; }
  if (!c || c.length !== P.paramCount()) continue;
  const p = Float64Array.from(c);
  const mh = T.mirrorHealth(p, HG.games, HG.n, 'multi');
  const fails = T.healthFails(mh);
  const bb = baseOf(p);
  if (fails.length && bb.base > refBase) {
    hits.push(f + ' base=' + bb.base.toFixed(4) + ' 体检不过=' + JSON.stringify(fails) + ' G=' + mh.effSkills.toFixed(2) + ' 回合=' + mh.rounds.toFixed(1));
  }
}
console.log('候选正对照（base 高于参照 且 体检不过）：' + hits.length + ' 枚');
hits.slice(0, 12).forEach(h => console.log('  ★ ' + h));
console.log('D35_SCAN_DONE');
