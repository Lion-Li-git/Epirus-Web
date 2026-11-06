/* C1 分析器 · 池桌两臂（`--support=0` vs `--support=2`）的逐批配对 + 枚间分布
 * 输入 = `ab-tmp/<member>__<mode>__s<0|2>.tsv`（`tools/probe-pool.mjs --subject=` 产出，列：mode/sig/batch/subj/ref/diff/…）
 * 两层的分母必须分开写（这是本仓钉过的那条"重复测量不是复现"）：
 *   **批级**配对 ⇒ 一枚包内部的 SE（仪器精度，分母 = 批数）
 *   **枚级**分布 ⇒ 回答"开先验对现役池有没有影响"的证据量（分母 = 枚数，不是批数）
 * ⚠ subject 会被从对手席摘掉 ⇒ 每枚的名单签名不同 ⇒ 跨枚只许比 Δ，不许比电平；两臂签名不同直接 `exit 4`。
 * 用法：node analyze-ab-pool.mjs [--dir=ab-tmp]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { pairedStats, fmtPaired, rejectUnknownFlags } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), ['dir'], 'analyze-ab-pool');   /* 仓规：不认识的 `--` 必须响亮拒绝（门 D218 的形状；归档目录不在门的扫描面上，但病一样会犯） */
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const DIR = path.join(HERE, arg('dir', 'ab-tmp'));
if (!existsSync(DIR)) { console.error('⛔ 读不到 ' + DIR + ' ⇒ 批还没跑'); process.exit(2); }

const cells = {};   // key = member|mode → { s0:{batch:subj}, s2:{...}, sig0, sig2, mean0, mean2 }
for (const f of readdirSync(DIR).filter(x => x.endsWith('.tsv'))) {
  const m = /^(.+)__(multi|long)__s([02])\.tsv$/.exec(f);
  if (!m) { console.error('⛔ 文件名不合 `<member>__<mode>__s<0|2>.tsv`：' + f); process.exit(3); }
  const [, member, mode, sup] = m;
  const L = readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() && l[0] !== '#');
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x.trim(), i]));
  for (const col of ['batch', 'subj', 'sig']) if (h[col] === undefined) { console.error('⛔ ' + f + ' 缺列 ' + col); process.exit(3); }
  const key = member + '|' + mode, c = cells[key] = cells[key] || { member, mode, arms: {} };
  const per = {}, means = [];
  for (const l of L.slice(1)) {
    const r = l.split('\t');
    if (r[h.batch] === '__mean') { means.push(Number(r[h.subj])); continue; }
    if (r[h.batch] === '__hall') continue;
    const v = Number(r[h.subj]); if (!isFinite(v)) { console.error('⛔ ' + f + ' 有一行 subj 不是数：' + l); process.exit(3); }
    per[r[h.batch]] = v;
  }
  c.arms['s' + sup] = per;
  c['sig' + sup] = (L[1] || '').split('\t')[h.sig];
  c['mean' + sup] = means.length ? means[means.length - 1] : null;
}

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const keys = Object.keys(cells).sort();
const byMode = {}, incomplete = [];
console.log('# C1 池桌 A/B（两臂只差 --support）‖ 枚×模式格 ' + keys.length + ' ‖ 每格批数 = 配对分母');
for (const k of keys) {
  const c = cells[k];
  if (!c.arms.s0 || !c.arms.s2) { incomplete.push(k + '（缺 ' + (!c.arms.s0 ? 's0' : 's2') + '）'); continue; }
  if (c.sig0 !== c.sig2) { console.error('⛔ ' + k + ' 两臂名单签名不同（' + c.sig0 + ' ↔ ' + c.sig2 + '）⇒ 不是配对，拒'); process.exit(4); }
  const bs = Object.keys(c.arms.s0).filter(b => c.arms.s2[b] !== undefined);
  if (!bs.length) { incomplete.push(k + '（批号对不上）'); continue; }
  const ds = bs.map(b => +(c.arms.s2[b] - c.arms.s0[b]).toFixed(2));
  const st = pairedStats(ds);
  const mean = st.mean;
  (byMode[c.mode] = byMode[c.mode] || []).push({ member: c.member, mean, se: st.se, n: ds.length, t: st.t, signs: ds.filter(d => d > 0).length + '+' + ds.filter(d => d < 0).length + '−' });
  console.log('  ' + c.member.padEnd(18) + ' · ' + c.mode.padEnd(6) + ' ‖ 配对 n=' + ds.length + ' 批 ‖ 均值 Δ '
    + (mean >= 0 ? '+' : '') + mean.toFixed(2) + 'pt' + (st.se === null ? '（SE 读不出：批间无离散）' : ' ± ' + st.se.toFixed(2))
    + (st.se ? ' ‖ t=' + st.t.toFixed(2) : '') + ' ‖ 符号 ' + ds.filter(d => d > 0).length + '+' + ds.filter(d => d < 0).length + '−');
}
if (incomplete.length) console.log('  ⛔ 不完整格 ' + incomplete.length + '：' + incomplete.slice(0, 8).join(' ‖ '));

for (const mode of Object.keys(byMode).sort()) {
  const arr = byMode[mode];
  const ms = arr.map(a => a.mean);
  console.log('\n## 枚间分布 · ' + mode + ' ‖ n=' + ms.length + ' 枚（**证据量的分母是枚数，不是批数**）');
  console.log('   Δ(开档−裸包) 中位 ' + q(ms, 0.5).toFixed(2) + 'pt ‖ P10 ' + q(ms, 0.10).toFixed(2) + ' ‖ P90 ' + q(ms, 0.90).toFixed(2)
    + ' ‖ 最小 ' + Math.min.apply(null, ms).toFixed(2) + ' ‖ 最大 ' + Math.max.apply(null, ms).toFixed(2));
  const st = pairedStats(ms);
  console.log('   ' + fmtPaired(mode + ' 枚间', ms) + ' ‖ 符号 ' + ms.filter(x => x > 0).length + '+ / ' + ms.filter(x => x < 0).length + '− / ' + ms.filter(x => x === 0).length + ' 零');
  console.log('   ⚑ 批内 SE 只说明仪器（上面每行的 ±）；"有没有影响"这句只能由这一层的枚间分布判。');
  const DS3 = ['T8-s114', 'K2', 'v7bead1-93'];
  const shown = arr.filter(a => DS3.indexOf(a.member) >= 0);
  if (shown.length) console.log('   对 DS 交班那三枚：' + shown.map(a => a.member + ' ' + (a.mean >= 0 ? '+' : '') + a.mean.toFixed(2)).join(' ‖ ')
    + '（他印的是 −0.75 ‖ +0.58 ‖ +0.08，同一把尺不同批数）');
}
