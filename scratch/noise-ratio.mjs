import { readFileSync } from 'node:fs';
const files = process.argv.slice(2);
for (const f of files) {
  const rows = readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse).filter(r => r.gen != null);
  const mv = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i-1].block?.pop?.mean, b = rows[i].block?.pop?.mean;
    if (a != null && b != null) mv.push(Math.abs(b - a));
  }
  const byWid = new Map();
  for (const r of rows) for (const ind of (r.indiv || [])) {
    if (!byWid.has(ind.wid)) byWid.set(ind.wid, []);
    byWid.get(ind.wid).push({ gen: r.gen, blk: ind.blk });
  }
  const diffs = [];
  for (const [, arr] of byWid) {
    arr.sort((x, y) => x.gen - y.gen);
    for (let i = 1; i < arr.length; i++) if (arr[i].gen === arr[i-1].gen + 1) diffs.push(Math.abs(arr[i].blk - arr[i-1].blk));
  }
  const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  console.log(f.split(/[\\/]/).pop() + ' ‖ gens=' + rows.length + ' ‖ 种群逐代移动 mean=' + mean(mv).toFixed(3) + ' ‖ 同权重隔代重测 中位=' + med(diffs).toFixed(3) + '（n=' + diffs.length + '）‖ 比值=' + (med(diffs) / mean(mv)).toFixed(2));
}
