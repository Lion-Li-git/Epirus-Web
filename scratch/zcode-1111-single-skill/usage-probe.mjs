/* 用量探针：一枚包在三张桌上各技能的出手占比（自对局5座 / 脚本桌4席 / F2冠军桌） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, Bots = W.EpirusBots, R0 = W.EpirusRules;
const asChooser = W.EpirusTrainer.policyChooserN; // 占位
const pack = process.argv[2];
const FILE = process.argv[3] || pack;
const F2 = ['MSB11-R2S306293884', 'MSB10-R1S1149480262', 'MSB8-charge-R1S1861674281', 'Q-s47'].map((id) => {
  const p2 = { 'MSB11-R2S306293884': 'docs/artifacts/night-adapt/MSB11-R2S306293884.js', 'MSB10-R1S1149480262': 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js', 'MSB8-charge-R1S1861674281': 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js', 'Q-s47': 'docs/artifacts/e507-out/Q-s47.js' }[id];
  return T.policyChooserN(P.unpack(JSON.parse(readFileSync(p2, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
});
const SCRIPTS = ['pickAggro', 'pickFarmer', 'pickDefend', 'pickGunSpam'].map((n) => Bots[n]).filter(Boolean);
function loadPack(p) {
  const mm = readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  return P.unpack(JSON.parse(mm[1]), true);
}
const params = loadPack(pack);
function table(table) {
  const counts = {};
  for (let g = 0; g < 4; g++) {
    const base = T.policyChooserN(params, 0.15);
    const wrap = (st, pid, legal) => { const r = base(st, pid, legal); const k = typeof r === 'string' ? r : r.key; counts[k] = (counts[k] || 0) + 1; return r; };
    const n = table === 'self' ? 5 : 5;
    const ch = [];
    for (let i = 0; i < n; i++) {
      if (table === 'self') ch.push(wrap);
      else if (i === g % n) ch.push(wrap);
      else if (table === 'script') ch.push(SCRIPTS[(g + i) % SCRIPTS.length]);
      else ch.push(F2[(g + i) % F2.length]);
    }
    T.oneGameN(ch, 9100 + g * 31, n, { mode: process.argv[4] || 'multi' });
  }
  return counts;
}
for (const tb of ['self', 'script', 'f2']) {
  const c = table(tb);
  const tot = Object.values(c).reduce((a, b) => a + b, 0);
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + (v / tot * 100).toFixed(0) + '%');
  console.log((FILE || pack).split('/').pop().padEnd(36) + tb.padEnd(8) + '出手' + String(tot).padStart(5) + '  ' + top.join('  '));
}
