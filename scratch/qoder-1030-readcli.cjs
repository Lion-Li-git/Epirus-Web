/* 读 arena2 的配对 JSON（包 vs 同场 v7，逐温度 + 逐桌形）。原件 scratch/qoder-1030-readcli.mjs */
const B = 'D:/code/Epirus-Web/scratch/';
const files = process.argv.slice(2);
for (const f of files) {
  const o = require(B + f + '.json');
  const g = {};
  for (const r of o.rows) { const t = r.temp; (g[t] = g[t] || {})
    [/v7|参/i.test(String(r.tag)) ? 'v' : 'p'] = r; }
  console.log('=== ' + f + '（40 局/桌形 × 11 桌形 = 每行 440 局 ‖ gps=' + o.gamesPerShape + '）');
  for (const t of Object.keys(g).map(Number).sort((a, b) => a - b)) {
    const p = g[t].p, v = g[t].v;
    if (!p || !v) { console.log('   t=' + t + ' 缺配对行（p=' + !!p + ' v=' + !!v + '）'); continue; }
    console.log('   t=' + t,
      '包 夺1=' + (p.first * 100).toFixed(1) + '% clean=' + p.cleanScore.toFixed(3) +
      ' 单卡=' + (p.maxCard ? p.maxCard.key + ' ' + (p.maxCard.share * 100).toFixed(0) + '%' : '-') +
      ' 平局=' + (p.draw * 100).toFixed(1) + '%',
      '‖ v7 ' + (v.first * 100).toFixed(1) + '% / ' + v.cleanScore.toFixed(3),
      '⇒ Δ夺1 ' + (((p.first - v.first) * 1000 | 0) / 10).toFixed(1) + 'pt',
      'Δclean ' + (((p.cleanScore - v.cleanScore) * 1000 | 0) / 1000).toFixed(3));
  }
  const ts = Object.keys(g).map(Number).sort((a, b) => a - b);
  const top = g[ts[ts.length - 1]];
  if (top && top.p && top.v) {
    const below = Object.keys(top.p.byShape).filter((k) => {
      const a = top.p.byShape[k], b = top.v.byShape[k];
      return b && a.first < b.first;
    });
    const line = (side) => Object.entries(side.byShape).map(([k, x]) => k.replace(':multi', ':m') + ' ' + (x.first * 100).toFixed(0)).join(' ‖ ');
    console.log('   t=' + ts[ts.length - 1] + ' 逐桌形夺1（单位 %）');
    console.log('     包 : ' + line(top.p));
    console.log('     v7 : ' + line(top.v));
    console.log('   ⇒ 低于 v7 同格的桌形数 = ' + below.length + '/11' + (below.length ? ' [' + below.join(' ') + ']' : '（全格不输）'));
    console.log('   桌形顺序：' + Object.keys(top.p.byShape).join(','));
  }
}
