/* 夹具成员硬判据：1v1 对激进脚本（pickAggro）胜率——B 轴成员资格线（FINDING §4.1） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
const load = (p) => T.policyChooserN(P.unpack(JSON.parse(readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
const aggro = B.pickAggro, multiStrong = B.pickMultiStrong;
const PACKS = {
  MSB13: 'docs/artifacts/night-adapt/MSB13-R1S791820660.js', MSB11R2: 'docs/artifacts/night-adapt/MSB11-R2S306293884.js',
  MSB10: 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js', MSB8charge: 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js',
  Qs47: 'docs/artifacts/e507-out/Q-s47.js', G5J50: 'scratch/ds-1109/G5J-50.js', G5C100: 'scratch/ds-1109/G5C-100.js',
  KDGB: 'docs/artifacts/night-adapt/KDG-B-Q-s13.js', MSB14: 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js', v14116: 'docs/artifacts/v14-116.bak',
};
const G = 40;
for (const [name, path] of Object.entries(PACKS)) {
  const ch0 = load(path);
  const res = {};
  for (const [oname, opp] of [['aggro', aggro], ['multiStrong', multiStrong]]) {
    let win = 0;
    for (const mode of ['multi', 'long']) for (let g = 0; g < G / 2; g++) {
      const gseed = 61000 + g * 173 + (mode === 'long' ? 7 : 0);
      const r = T.oneGameN([ch0, opp], gseed, 2, { mode });
      if (T.rankOf(r.state, 0, gseed) === 1) win++;
    }
    res[oname] = win;
  }
  console.log(name.padEnd(10), 'vs aggro', String(res.aggro).padStart(2) + '/' + G, ' vs multiStrong', String(res.multiStrong).padStart(2) + '/' + G, res.aggro > G / 2 && res.multiStrong > G / 2 ? ' PASS' : ' FAIL');
}
