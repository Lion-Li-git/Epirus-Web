/* v14-116（纯剑包）vs 各种对手 1v1/多席 H2H：量胜率 + 双方实际出招谱（剑/防御/经济占比） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
const loadChooser = (p) => T.policyChooserN(P.unpack(JSON.parse(readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
const v14 = loadChooser('docs/artifacts/v14-116.bak');
const OPPS = {
  adaptive: B.pickAdaptive, multiStrong: B.pickMultiStrong, aggro: B.pickAggro, defend: B.pickDefend,
  MSB13: loadChooser('docs/artifacts/night-adapt/MSB13-R1S791820660.js'),
  MSB11R2: loadChooser('docs/artifacts/night-adapt/MSB11-R2S306293884.js'),
  MSB14: loadChooser('docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'),
  Qs47: loadChooser('docs/artifacts/e507-out/Q-s47.js'),
};
const GAMES = 40;
for (const [name, opp] of Object.entries(OPPS)) {
  for (const mode of ['multi', 'long']) {
    let v14win = 0, ties = 0;
    const usage = { sword: 0, ji: 0, guard: 0, reflect: 0, other: 0, oppSword: 0, oppStance: 0, oppOther: 0 };
    for (let g = 0; g < GAMES; g++) {
      const wrapA = (st, pid, legal) => { const r = v14(st, pid, legal); const k = typeof r === 'string' ? r : r.key;
        if (k === 'sword') usage.sword++; else if (k === 'ji') usage.ji++; else if (k === 'guard' || k === 'reflect') usage.guard++; else usage.other++; return r; };
      const wrapB = (st, pid, legal) => { const r = opp(st, pid, legal); const k = typeof r === 'string' ? r : r.key;
        if (k === 'sword') usage.oppSword++; else if (k === 'guard' || k === 'reflect' || k === 'proto' || k === 'bagua' || k === 'shift') usage.oppStance++; else usage.oppOther++; return r; };
      const ch = mode === 'multi' || true ? [wrapA, wrapB] : null;
      const gseed = 55000 + g * 97 + (mode === 'long' ? 30011 : 0);
      const res = T.oneGameN(ch, gseed, 2, { mode });
      const rank = T.rankOf(res.state, 0, gseed);
      if (rank === 1) v14win++; else if (rank > 1) ties++;
    }
    console.log(`v14-116 vs ${name.padEnd(11)} ${mode.padEnd(5)} 胜 ${String(v14win).padStart(2)}/${GAMES}  ‖ v14出手: 剑${usage.sword} ジ${usage.ji} 防${usage.guard} 它${usage.other} ‖ 对手: 剑${usage.oppSword} 架势${usage.oppStance} 它${usage.oppOther}`);
  }
}
