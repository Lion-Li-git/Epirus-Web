/* 批量筛查（只读）：v7* 产物的 G(multi)/G(long) 谱，找"有技能广度的老包"
 * 用法：node scan-breadth.cjs [每臂seed数=2] [--arms=v7div,v7l2] */
import { readdirSync } from 'node:fs';
import { sandbox, loadChamp, selfPlay } from '../../tools/audit-lib.mjs';
const W = sandbox();
const files = readdirSync('D:/code/Epirus-Web/docs/artifacts')
  .filter(f => /^v7[a-z0-9]+-\d+\.bak$/.test(f))
  
  .sort();
const perArmKeep = Number(process.argv[2] || 2);
const armRe = (process.argv.find(a => a.startsWith('--arms=')) || '').split('=')[1];
const arms = armRe ? armRe.split(',') : null;
const byArm = {};
for (const f of files) {
  const arm = f.replace(/-\d+\.bak$/, '');
  if (arms && arms.indexOf(arm) < 0) continue;
  (byArm[arm] = byArm[arm] || []).push(f);
}
const rows = [];
let skipped = [];
for (const arm of Object.keys(byArm).sort()) {
  for (const f of byArm[arm].slice(0, perArmKeep)) {
    let params;
    try { params = loadChamp(W, 'docs/artifacts/' + f); } catch (e) { skipped.push([f, 'load:' + e.message.slice(0, 40)]); continue; }
    if (!params || !params.length) { skipped.push([f, 'shape 不符 v7']); continue; }
    try {
      const sp = selfPlay(W, params, 'multi', 20);
      const spL = selfPlay(W, params, 'long', 20);
      rows.push({ f, G: sp.effSkills, Gl: spL.effSkills, atk: sp.distinctKeys });
    } catch (e) { skipped.push([f, 'run:' + e.message.slice(0, 40)]); }
  }
}
rows.sort((a, b) => Math.min(b.G, b.Gl) - Math.min(a.G, a.Gl));
console.log('臂数 ' + Object.keys(byArm).length + ' · 测了 ' + rows.length + ' 粒 · 跳过 ' + skipped.length);
for (const r of rows.slice(0, 25)) console.log(`  ${r.f.padEnd(24)} G(multi) ${r.G.toFixed(2)}  G(long) ${r.Gl.toFixed(2)}  异卡数 ${r.atk.toFixed(1)}`);
if (skipped.length) console.log('  跳过样例: ' + skipped.slice(0, 5).map(s => s[0] + '(' + s[1] + ')').join('  '));
