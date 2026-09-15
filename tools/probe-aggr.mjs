/* 侵略性双场探针（v1.5.62）：逻辑已收进 audit-lib.aggressionProfile（单一真源），本工具只负责打印。 */
import { sandbox, mulberry32, loadChamp, aggressionProfile } from './audit-lib.mjs';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const OLD = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
const isDmg = function (k) { const d = R.byKey[k]; return !!(d && d.dmg && d.dmg.amt); };
const args = process.argv.slice(2);
const G = Number(args[args.length - 1]) || 40;
const files = args.filter(function (a) { return !/^\d+$/.test(a); });


console.log('文件'.padEnd(30) + '| 场        | 出手/局 旧进攻% 新进攻%  造成伤/局 承受伤/局 胜率  平局  回合  对手进攻/局');
for (const f of files) {
  try {
    const params = loadChamp(W, f);
    const P = aggressionProfile(W, params, G);
    const nm = f.replace('docs/artifacts/', '').replace('js/', '');
    for (const kind of ['aggr', 'calm']) {
      const x = (kind === 'aggr' ? P.fieldA : P.fieldB);
      console.log(nm.padEnd(30) + '| ' + (kind === 'aggr' ? '被集火' : '无压  ') + '  |' +
        x.actsPerGame.toFixed(1).padStart(8) +
        (x.atkOld * 100).toFixed(0).padStart(7) + '%' +
        (x.atkNew * 100).toFixed(0).padStart(7) + '%' +
        x.dealt.toFixed(2).padStart(10) +
        x.taken.toFixed(2).padStart(10) +
        (x.winRate * 100).toFixed(0).padStart(6) + '%' +
        (x.drawRate * 100).toFixed(0).padStart(6) + '%' +
        x.rounds.toFixed(1).padStart(7) +
        x.oppAtkPerGame.toFixed(1).padStart(14));
    }
  } catch (e) { console.log(f.padEnd(30) + '| 读失败: ' + String(e && e.message || e).slice(0, 50)); }
}
