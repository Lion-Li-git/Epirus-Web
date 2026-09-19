/* 侵略性双场探针（v1.5.62）：逻辑已收进 audit-lib.aggressionProfile（单一真源），本工具只负责打印。
 *
 * v1.5.133 修复：本探针**一直在打「读失败」** —— 它读的字段名（`atkOld`/`dealt`/`taken`/`rounds`）
 *   与 `aggressionProfile` 实际返回的（`atkOldWhitelist`/`dealtPerGame`/`takenPerGame`/`roundsPerGame`）
 *   漂移了（`undefined.toFixed()` ⇒ 每行抛错被 catch 吞成一行"读失败"）⇒ 全仓**没有一个能用的
 *   场A/场B 打印器**。同时它**从来没打印 `clearedPerGame`**（= 场B 真正被门禁判的那一格，阈值 ≥0.3/局），
 *   只打了胜率/平局（D60 明确：场B 判据**只能是清场数**，胜率是规则红利）⇒ 一并补上。
 *
 * AGGR_HOOK=attack|turtle ⇒ 只改**冠军席**的一个决策规则做反事实（默认关闭；见 `aggressionProfile` 的 opts）：
 *   attack：买得起枪却选ジ → 改判开枪；turtle：任何非ジ输出 → 改判ジ。
 *   用途：判 `docs/HANDOFF-2026-09-19.md` §2.1 的「场B 清场 ↔ 抗只枪单调互斥」是不是**根本**的。
 * 用法：node tools/probe-aggr.mjs [GAMES=40] 包...（环境变量 AGGR_HOOK=attack|turtle）
 */
import { sandbox, mulberry32, loadChamp, aggressionProfile } from './audit-lib.mjs';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const OLD = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
const isDmg = function (k) { const d = R.byKey[k]; return !!(d && d.dmg && d.dmg.amt); };
const args = process.argv.slice(2);
const G = Number(args[args.length - 1]) || 40;
const files = args.filter(function (a) { return !/^\d+$/.test(a); });
const HK = process.env.AGGR_HOOK;
const OPTS = HK === 'attack' ? { forceAttack: true } : (HK === 'turtle' ? { forceTurtle: true } : undefined);

console.log('钩子：' + (HK || '（关）') + '   （attack = 买得起枪却选ジ时改判开枪 · turtle = 完全不还手）');
console.log('文件'.padEnd(28) + '| 场      | 出手/局 旧进攻% 新进攻%  造伤/局 承伤/局 清场/局  ジ%  改判  胜率  平局  回合 对手进攻/局');
for (const f of files) {
  try {
    const params = loadChamp(W, f);
    const P = aggressionProfile(W, params, G, OPTS);
    const nm = f.replace('docs/artifacts/', '').replace('js/', '');
    for (const kind of ['aggr', 'calm']) {
      const x = (kind === 'aggr' ? P.fieldA : P.fieldB);
      console.log(nm.padEnd(28) + '| ' + (kind === 'aggr' ? '被集火' : '无压  ') + '  |' +
        x.actsPerGame.toFixed(1).padStart(8) +
        (x.atkOldWhitelist * 100).toFixed(0).padStart(7) + '%' +
        (x.atk * 100).toFixed(0).padStart(7) + '%' +
        x.dealtPerGame.toFixed(2).padStart(9) +
        x.takenPerGame.toFixed(2).padStart(9) +
        x.clearedPerGame.toFixed(2).padStart(8) +
        (x.jiShare * 100).toFixed(0).padStart(5) + '%' +
        String(x.forced).padStart(6) +
        (x.winRate * 100).toFixed(0).padStart(6) + '%' +
        (x.drawRate * 100).toFixed(0).padStart(6) + '%' +
        x.roundsPerGame.toFixed(1).padStart(6) +
        x.oppAtkPerGame.toFixed(1).padStart(11));
    }
  } catch (e) { console.log(f.padEnd(28) + '| 读失败: ' + String(e && e.message || e).slice(0, 60)); }
}
console.log('  场A（被集火）= 1 席冠军 vs 4 席"付得起就打人"的脚本 ⇒ 门禁看 新进攻% ≥ 20；');
console.log('  场B（无压）  = 1 席冠军 vs 4 席"只按ジ不还手"     ⇒ 门禁看 清场/局 ≥ 0.3（**不是胜率**，D60）。');
