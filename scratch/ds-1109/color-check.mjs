
function hueAt(i, n) { const nn = Math.max(1, n); const h = nn > 1 ? Math.round(316 * (i % nn) / (nn - 1)) : 0; const s = (i % 2) ? 60 : 88; const l = [50, 74, 62][i % 3]; return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
for (const n of [17, 19]) {
  console.log('=== n=' + n + ' ===');
  for (let i = 0; i < n; i++) {
    const q = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(hueAt(i, n));
    if (i >= n - 5 || i < 3) console.log('fam ' + i + '  hue ' + q[1] + '  s ' + q[2] + '  l ' + q[3]);
  }
}
