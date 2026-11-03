const fs = require('fs');
for (const f of ['broad-s7', 'broad-s13', 'cmxc-s7', 'cmxc-s13', 'pem-s7', 'gd3p-s13', 'rb2p-s7', 'rb2p-s13']) {
  const p = 'D:/code/Epirus-Web/scratch/' + f + '.log';
  let s;
  try { s = fs.readFileSync(p, 'utf8'); } catch (e) { console.log(f + ': no log'); continue; }
  const m = s.match(/\{"mode":"cem"[^\n]+/);
  if (!m) { console.log(f + ': no meta'); continue; }
  const j = JSON.parse(m[0]);
  const c = j.curve || [];
  const peak = c.length ? Math.max(...c.map((x) => x.best)) : null;
  console.log(f.padEnd(10),
    'inLoopBest', j.inLoopBest == null ? '-' : j.inLoopBest.toFixed(3),
    '‖ peak(curve)', peak == null ? '-' : peak.toFixed(3),
    '‖ holdoutFit', j.holdoutFit == null ? '-' : j.holdoutFit.toFixed(3),
    '‖ holdoutFirst', j.holdoutFirst == null ? '-' : j.holdoutFirst.toFixed(3),
    '‖ dFirst', j.dFirst == null ? '-' : j.dFirst.toFixed(3));
}
