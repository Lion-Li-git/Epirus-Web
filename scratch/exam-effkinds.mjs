/* 考卷桌（eval-5p）上的"有效出手种类"——与 breadth2 的镜像桌同一定义（非ジ、占比≥阈值），
 * 用来量"下限在哪张桌子上判"。⚠ 考卷只印前 12 行 ⇒ 印满 12 行的包可能被截尾（标 truncated）。
 * 用法：node scratch/exam-effkinds.mjs <log...> */
import { readFileSync } from 'node:fs';
const rows = [];
for (const f of process.argv.slice(2)) {
  const txt = readFileSync(f, 'utf8');
  const m = txt.match(/出手种类=(\d+)\s+分布（前 12）:([\s\S]*?)耗时/);
  if (!m) { rows.push({ file: f, note: '读不出（没有分布段）' }); continue; }
  const lines = m[2].split('\n').map((l) => l.match(/^\s{2}(\S+)\s+([\d.]+)%\s+次数=(\d+)/)).filter(Boolean);
  const rec = lines.map((x) => ({ key: x[1], pct: Number(x[2]), n: Number(x[3]) }));
  const nonji = rec.filter((r) => r.key !== 'ジ');
  const tot = nonji.reduce((a, r) => a + r.n, 0);
  const eff = (t) => nonji.filter((r) => tot && r.n / tot >= t / 100).length;
  const max = nonji.length ? Math.max(...nonji.map((r) => r.n)) / tot : null;
  rows.push({
    file: f.replace(/^.*[\\/]/, ''), printedKinds: Number(m[1]), listedRows: lines.length,
    truncated: lines.length >= 12, nonjiKinds: nonji.length,
    eff1: eff(1), eff2: eff(2), eff5: eff(5), maxCastShareNonji: max == null ? null : (100 * max).toFixed(1) + '%',
    top: nonji.slice().sort((a, b) => b.n - a.n).slice(0, 4).map((r) => r.key + ' ' + (100 * r.n / tot).toFixed(1) + '%').join(' ')
  });
}
const pct = (x) => (x == null ? '—' : x);
console.log('文件'.padEnd(30) + '印出种'.padEnd(8) + '非ジ种'.padEnd(8) + 'eff1'.padEnd(6) + 'eff2'.padEnd(6) + 'eff5'.padEnd(6) + '最大非ジ份额'.padEnd(14) + '截尾?');
for (const r of rows) {
  if (r.note) { console.log(r.file + ' ‖ ' + r.note); continue; }
  console.log(r.file.padEnd(30) + String(r.printedKinds).padEnd(8) + String(r.nonjiKinds).padEnd(8) +
    String(r.eff1).padEnd(6) + String(r.eff2).padEnd(6) + String(r.eff5).padEnd(6) + pct(r.maxCastShareNonji).padEnd(14) +
    (r.truncated ? '⚠可能' : '否') + '   ' + r.top);
}
