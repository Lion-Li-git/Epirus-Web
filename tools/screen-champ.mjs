/* 候选筛选器（v1.5.59）：把"上线体检"里最关键的**三件硬指标**一次量完，用于快速筛掉不合格候选。
 * 起因：换冠军时发现没有候选能三全（座位偏 / 反弹墙一枪未发 / F 不进攻），而逐个跑完整体检太慢。
 * 指标（全部来自 audit-lib 的既有探针，口径与上线体检一致）：
 *   ① 座位极差（seatSymmetry，百分点；判偏阈值 30pt，前置"判胜≥30%"）
 *   ② 反弹墙伤害/局（reflectWall：真信号 —— D 的 1st 会被并列污染）
 *   ③ 活跃场进攻率（fieldRate 'active'：F，门槛 25%）
 * 用法：node tools/screen-champ.mjs <file...>  [SEAT_GAMES] [WALL_GAMES]
 */
import { sandbox, loadChamp, seatSymmetry, reflectWall, fieldRate } from './audit-lib.mjs';
const W = sandbox();
const SG = Number(process.argv[process.argv.length - 2]) || 60;
const WG = Number(process.argv[process.argv.length - 1]) || 20;
const files = process.argv.slice(2).filter(function (a) { return !/^\d+$/.test(a); });
console.log('文件'.padEnd(38) + '座位极差  判胜  反弹墙伤害/局  穿透命中  活跃场进攻  G  结论');
for (const f of files) {
  try {
    const params = loadChamp(W, f);
    const ss = seatSymmetry(W, params, 'multi', SG);
    const rw = reflectWall(W, params, 'long', WG);
    const fa = fieldRate(W, params, 'active', 'multi', Math.min(SG, 40));
    const sp = W.EpirusTrainer.mirrorHealth(params, 20, 5, 'multi');
    const bad = [];
    if (ss.verdict === 'biased') bad.push('偏座');
    if (!(rw.dmgPerGame > 0.5)) bad.push('反弹墙瘫');
    if (fa.atk < 0.25) bad.push('不进攻');
    if (sp.effSkills < 3) bad.push('G<3');
    console.log(f.replace('docs/artifacts/', '').replace('js/', '').padEnd(38) +
      (ss.spread.toFixed(0) + 'pt').padStart(8) +
      (Math.round(ss.decisiveRate * 100) + '%').padStart(7) +
      rw.dmgPerGame.toFixed(2).padStart(14) +
      String(rw.pierceLand).padStart(10) +
      ((fa.atk * 100).toFixed(0) + '%').padStart(11) +
      sp.effSkills.toFixed(2).padStart(7) + '  ' + (bad.length ? '✗ ' + bad.join('+') : '✅ 通过'));
  } catch (e) {
    console.log(f.padEnd(38) + ' 读失败: ' + String(e && e.message || e).slice(0, 60));
  }
}
