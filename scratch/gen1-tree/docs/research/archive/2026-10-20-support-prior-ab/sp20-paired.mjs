/* §E674 补 · DS 的 sp20 送盾先验 A/B 的配对复算（千问 10-20 夜，只读复算，不重跑任何一局）
 *
 * 为什么要这支脚本：CHANGELOG v1.7.126 印了 "10 粒配对 Δ均值 −0.43pt ‖ t=−0.14"，但没写这是**哪把尺**，
 *   也没把产物留在仓里（原件在 gitignore 的 docs/artifacts/sp20/）。读数本身我复算过是一位不差的，
 *   缺的只是尺子名与可复算入口 ⇒ 这里把两件都补上。
 * 同时它把 DS 没印的那一档也吐出来：同一批每份池桌表里都带 multi 与 long 两档 ⇒ 只引一档就是把选择读成产出。
 *
 * 用法：node docs/research/archive/2026-10-20-support-prior-ab/sp20-paired.mjs [--dir=<目录>] [--seeds=9901-9910]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { for (const a of argv) { const p = '--' + n + '='; if (a.startsWith(p)) return a.slice(p.length); } return d; };
const DIR = flag('dir', join(HERE, 'sp20-pooltxt'));
const SEEDS = String(flag('seeds', '9901-9910')).split(',').flatMap(s => {
  const m = s.split('-'); return m.length === 2 ? Array.from({ length: +m[1] - +m[0] + 1 }, (_, i) => +m[0] + i) : [+s];
});
const ARMS = flag('arms', 'p0,p2').split(',');

const jsonOf = (f) => {
  const txt = readFileSync(f, 'utf8');
  const line = txt.split(/\r?\n/).filter(l => l.trim().startsWith('{'))[0];
  if (!line) throw new Error('这份池桌表里没有机器可读行：' + f);
  return JSON.parse(line);
};
const diffOf = (rec, mode) => { const e = (rec.perMode || []).find(x => x.mode === mode); return e ? e.diff : null; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
const median = a => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

const rows = [];
const pairing = { sig: new Set(), roster: new Set(), ref: new Set() };
for (const seed of SEEDS) {
  const one = { seed };
  for (const arm of ARMS) {
    const f = join(DIR, arm + '-s' + seed + '-pool.txt');
    if (!existsSync(f)) { one[arm] = null; one.miss = (one.miss || 0) + 1; continue; }
    const rec = jsonOf(f);
    pairing.sig.add(rec.perMode.map(x => x.mode + ':' + x.sig).join('|'));
    pairing.roster.add((rec.rosterIds || []).join(','));
    pairing.ref.add(rec.ref + '/' + rec.refWid);
    one[arm] = { multi: diffOf(rec, 'multi'), long: diffOf(rec, 'long') };
  }
  rows.push(one);
}

console.log('配对前置（不成立就不许报 Δ）：');
console.log('  名单签名集合大小 = ' + pairing.sig.size + (pairing.sig.size === 1 ? ' ✔ 两臂同桌' : ' ✗ 两臂吃的不是同一张桌 ⇒ 下面的数无效'));
console.log('  roster 集合大小  = ' + pairing.roster.size + (pairing.roster.size === 1 ? ' ✔' : ' ✗'));
console.log('  参照集合大小     = ' + pairing.ref.size + (pairing.ref.size === 1 ? ' ✔（' + [...pairing.ref][0] + '）' : ' ✗ 参照被换过'));

const out = ['mode\tn\tmean_p0\tmean_p2\tΔ均值\t中位Δ\tSD\tSE\tt\t正号\t去掉最极一端后的Δ'];
for (const mode of ['multi', 'long']) {
  const pairs = rows.filter(r => r.p0 && r.p2 && r.p0[mode] != null && r.p2[mode] != null);
  const n = pairs.length;
  if (!n) { console.log(mode + '：读不出（分母 0）'); continue; }
  const a = pairs.map(r => r.p0[mode]), b = pairs.map(r => r.p2[mode]);
  const d = pairs.map(r => r.p2[mode] - r.p0[mode]);
  const m = mean(d), s = sd(d), se = s / Math.sqrt(n);
  const pos = d.filter(x => x > 0).length;
  const trimmed = (() => { const i = d.findIndex(x => x === Math.max(...d.map(Math.abs))); const k = d.slice(); k.splice(i, 1); return mean(k); })();
  console.log(mode + '  n=' + n + '  p0均值 ' + mean(a).toFixed(2) + '  p2均值 ' + mean(b).toFixed(2)
    + '  Δ ' + m.toFixed(2) + '  中位Δ ' + median(d).toFixed(2) + '  SD ' + s.toFixed(2) + '  SE ' + se.toFixed(2)
    + '  t ' + (m / se).toFixed(2) + '  正号 ' + pos + '/' + n + '  去最极 ' + trimmed.toFixed(2));
  out.push([mode, n, mean(a).toFixed(2), mean(b).toFixed(2), m.toFixed(2), median(d).toFixed(2), s.toFixed(2), se.toFixed(2), (m / se).toFixed(2), pos + '/' + n, trimmed.toFixed(2)].join('\t'));
  out.push('# 逐粒 ' + mode + ': ' + pairs.map(r => r.seed + ' ' + r.p0[mode].toFixed(1) + '→' + r.p2[mode].toFixed(1)).join(' ‖ '));
}
out.push('# 尺子 = tools/probe-pool.mjs --subject=<包>（主体席尺：1 席被考包 + 4 席按 tier 抽 · ε=0 纯贪心 · 60 局/批 × 20 批 · 两臂同 seed 同盐逐批配对）');
out.push('# 读数含义 = 被考夺1% − 参照夺1%（pts），参照 = ' + [...pairing.ref][0]);
out.push('# 2σ 分辨率 = ' + (2 * (sd(rows.filter(r => r.p0 && r.p2 && r.p0.multi != null).map(r => r.p2.multi - r.p0.multi)) / Math.sqrt(rows.filter(r => r.p0 && r.p2 && r.p0.multi != null).length))).toFixed(2) + 'pt（multi）⇒ 比这小的效应这批设计上就看不见');
writeFileSync(join(HERE, 'sp20-paired.tsv'), out.join('\r\n') + '\r\n', 'utf8');
console.log('\n写 ' + join(HERE, 'sp20-paired.tsv'));
