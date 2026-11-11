
import { readFileSync } from 'node:fs';
for (const p of ['docs/artifacts/e507-out/Q-s47.js','docs/artifacts/e528-out/T8-s114.js','docs/artifacts/e539-out/U-s205.js']) {
  const s = readFileSync(p, 'utf8');
  const i = s.indexOf('EPIRUS_CHAMPION_3P_META');
  console.log('=== ' + p);
  if (i < 0) { console.log('  无 META'); continue; }
  const seg = s.slice(i, i + 1400).split('\n')[0];
  console.log('  ' + seg.slice(0, 900));
}
