/* §E663 配对剖面对账（预注册 = `docs/research/PREREG-2026-10-20-eval-profile-qoder.md`，**线在看数之前写死**）
 * 读 `eval-profile.log.txt`（`eval-profile-batch.sh` 的输出），按三对包印**换后 − 原**的分项差，并按预注册那版的地板判"读得出/读不出"。
 * ⚑ 地板只给**有分母的那几维**：`games=60` ⇒ 胜率与决胜是 60 局上的比例，SE 可解析算；
 *   行为份额（防御/攻击/环/ジ/集火/集中/昏手）的**分母（出手数）没有随读数印出来** ⇒ 这几维只报 Δ，标"地板未标定 ⇒ 不升格"（不许拿"看着挺大"当显著）。
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/eval-profile-analyze.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
const HERE = import.meta.dirname;
const LOG = path.join(HERE, 'eval-profile.log.txt');
const txt = readFileSync(LOG, 'utf8');
const DIMS = [['def', /防御 ([\d.]+)%/], ['atk', /攻击 ([\d.]+)%/], ['ring', /环 ([\d.]+)%/], ['ji', /ジ ([\d.]+)%/],
  ['focus', /集火 ([\d.]+)%/], ['conc', /集中 ([\d.]+)%/], ['void', /昏手 ([\d.]+)%/],
  ['win', /胜率 (\d+)%/], ['decis', /决胜 (\d+)%/], ['glen', /局长 ([\d.]+)/], ['brk', /镜像破局 (\d+)%/]];
const rows = [];
let cur = null;
for (const ln of txt.split('\n')) {
  const m = ln.match(/^@@@ (\S+) eps=(\S+)/);
  if (m) { cur = { pack: m[1].replace(/\.bak$/, ''), eps: m[2], runs: [] }; rows.push(cur); continue; }
  if (!cur) continue;
  const e = ln.match(/^  ε=([\d.]+) uniform/);
  if (e) {
    const dims = {};
    for (const [k, re] of DIMS) { const mm = ln.match(re); dims[k] = mm ? Number(mm[1]) : null; }
    cur.runs.push({ epsLabel: e[1], dims });
  } else if (/^\s+防御/.test(ln)) { /* 数值行紧跟标签行，已在上面合并 */ }
  const tail = ln.match(/^\s+.*(防御 [\d.]+%.*镜像破局 [\d.]+%[^\n]*)$/);
  if (tail && cur.runs.length) {
    const dims = {};
    for (const [k, re] of DIMS) { const mm = tail[1].match(re); if (mm) dims[k] = Number(mm[1]); }
    Object.assign(cur.runs[cur.runs.length - 1].dims, dims);
  }
}
const at = (pack, eps) => { const r = rows.find(x => x.pack === pack && x.eps === eps); if (!r || !r.runs.length) return null;
  return r.runs.find(x => (eps === '0' ? x.epsLabel === '0' : x.epsLabel !== '0') || r.runs.length === 1) || r.runs[0]; };
const PAIRS = [['P1', 'gv-gv0-77000--gv0-77000-band5', 'gv-gv0-77000--gv0-77000-band4', '有真开档臂佐证'],
  ['P2', 'gv-gv0-77002--gv0-77002-band5', 'gv-gv0-77002--gv0-77002-band2', '有真开档臂佐证'],
  ['P3', 'b9-b90-77001--b90-77001-band6', 'b9-b90-77001--b90-77001-band2', '**只是预测 ⇒ 印出来，不参与判据**']];
console.log('地板（预注册 §三）：胜率与决胜是 60 局上的比例 ⇒ 2×SE；行为份额的分母（出手数）没随读数印出 ⇒ **只报 Δ，不判显著**');
for (const [tag, a, b, note] of PAIRS) {
  console.log('\n## ' + tag + ' ‖ ' + note);
  for (const eps of ['0', 'default']) {
    const ra = at(a, eps), rb = at(b, eps);
    if (!ra || !rb) { console.log('  eps=' + eps + '：读不出（该包没有这一档的行）'); continue; }
    const line = [];
    for (const [k] of DIMS) {
      const va = ra.dims[k], vb = rb.dims[k];
      if (va === null || vb === null) { line.push(k + '=—'); continue; }
      const d = vb - va;
      let mark = '';
      if (k === 'win' || k === 'decis') {
        const se = 2 * Math.sqrt(Math.max(1, va) * (100 - Math.max(1, va)) / 60);
        mark = Math.abs(d) > se ? '★' : '（<' + se.toFixed(1) + ' ⇒ 读不出）';
      }
      line.push(k + ' ' + va + '→' + vb + ' Δ' + (d >= 0 ? '+' : '') + d.toFixed(1) + mark);
    }
    console.log('  eps=' + (eps === '0' ? '0（纯贪心）' : '浏览器档') + '：' + line.join(' ‖ '));
  }
}
console.log('\n⚑ 两档同号才算形状（预注册 §二）‖ 判据只看 P1‖P2（同一谱系两 seed ⇒ 仍是形状不是结论）‖ P3 是预测 ⇒ 一个字也不进判据。');
