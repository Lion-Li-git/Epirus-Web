/* Epirus 冠军体检（v1.5.8；v1.5.18 抽出指标库 + 新增 G 列）
 *
 * 为什么要有它：**考卷 1st 率可以被"熬"骗**。
 * v1.5.7 我把 long-33 换上线，依据是 canonical 多人考卷 41.0%（旧产物 17.8%）。
 * 但浏览器对战测试 + 引擎量化发现：long-33 在 5 座全是自己的自对局里
 * **20/20 局零伤害、60 回合平局** —— 它只刷聚能环和ジ、从不出手打人，
 * 那个 41% 是"熬到哨声比血量"赢来的，不是打出来的。
 * 千问体检 §5-4 早就警告过这一点（"改报 cost≥3 落地伤害 + 哨声前 HP 领先，
 * 后者能量出'赢'还是'熬'"），我当时没把它变成硬指标 ⇒ 这次把它工具化。
 *
 * ⚠️ v1.5.18：指标实现已抽到 `tools/audit-lib.mjs`，与 `tools/promote-champion.mjs` 的
 * **阻断条件**共用同一份（第三方复核 §7-4(1)：指标只打印不判定 ⇒ 它建议把 E/F/G 变成门槛）。
 * 想改口径请改那个文件，别在这里再写一遍。
 *
 * 输出（列含义见 audit-lib.mjs 顶部）：
 *   A 考卷1st · B 伤害/局 · B 重击/局 · C 盾/局 · 零伤害率 · 平局率 · 回合 · D 长程反弹墙 ·
 *   E 被动场架势 · F 活跃场进攻 · F 回合 · **G 有效技能数**（非ジ出手的 exp(熵)）
 *
 * 用法：node tools/champ-audit.mjs [--games=20] [--exam-games=20] [--mode=multi|long] [文件...]
 *       （不给文件则体检全部在库冠军 + 线上 bundle）
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, sandbox, loadChamp, exam, selfPlay, fieldRate, seatSymmetry, chargeProfile, reflectWall, aggressionProfile } from './audit-lib.mjs';

const flag = function (n, d) {
  const hit = process.argv.find(function (a) { return a.indexOf('--' + n + '=') === 0; });
  return hit ? hit.split('=')[1] : d;
};
const GAMES = Number(flag('games', 20));
const EXG = Number(flag('exam-games', 20));
/* v1.5.78（第七轮复核 §8 的工具陷阱）：`flag()` 只认 `--k=v` ⇒ 裸 `--games 80` 会被**静默忽略**、
 * 按默认局数跑完且没有任何警告（复核第一版表就是这么来的，整表重跑过）。这里显式点名。 */
{
  const bare = process.argv.slice(2).filter(function (a) { return /^--[a-zA-Z0-9-]+$/.test(a); });
  if (bare.length) {
    console.warn('⚠ 未识别的裸参数（本工具只认 `--k=v`）：' + bare.join(' ') +
      ' ⇒ 这些参数**已被忽略**，本次用的是默认值（复核 §8 踩过这个坑）。');
  }
}
const SEAT_G = Number(process.env.EPIRUS_SEAT_GAMES || 100);   // v1.5.57：座位探针局数（≥100 才有判别力）
const GAMES2 = Number(process.env.EPIRUS_CHARGE_GAMES || GAMES);   // v1.5.58：蓄能探针局数
const SP_MODE = flag('mode', 'multi');   // 自对局那几列用哪个模式（multi 默认；看"集体防御"要用 long）

const list = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const files = list.length ? list : (function () {
  const out = ['js/bundled-champion-3p.js'];
  const dir = join(ROOT, 'docs/artifacts');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (/^(champion-5p-.*|long-3\d|eco2?|def|rwd0|lng[AB])-\d+\.bak$/.test(f) || /^champion-5p-[\w.]+\.bak$/.test(f)) out.push('docs/artifacts/' + f);
    }
  }
  return out;
})();

const W = sandbox();
/* v1.5.8：训练在跑时 bundle 会被临时覆盖成热启动基线（见 tools/ring2-run.mjs 的训练锁）
 * ⇒ 此时量 `js/bundled-champion-3p.js` 会得到旧冠军的特征（本轮踩过）。给该行打标记。 */
const trainingLive = existsSync(join(ROOT, 'docs/artifacts/.training.lock'));
console.log('冠军体检（自对局 ' + GAMES + ' 局 · 考卷 ' + EXG + ' 局）' + (trainingLive ? '  ⚠️ 训练进行中：bundle 行不可信，请看对应 .bak' : '') + '\n');
console.log('文件'.padEnd(42) + 'A 考卷1st  A严胜  B伤害/局  B重击/局  C盾/局  零伤害率 平局率  回合   D长程反弹墙  E无威胁摆架势 F被集火还手 F回合 G有效技能数 座位极差 反弹墙伤害/局 蓄能/局 珠浪费  H混合场  I对被动');
for (const f of files) {
  const params = loadChamp(W, f);
  if (!params) { console.log(f.padEnd(42) + '  (读不出冠军包)'); continue; }
  const e1 = exam(f, [], EXG);
  const e2 = exam(f, ['--mode=long', '--field=reflectwall'], EXG);
  /* v1.5.36（复核 §4-1/§4-2）：H = 4 风格同场夺冠率；I = 1 冠军 vs 4 只ジ的夺冠率（两列的盲区见 CHANGELOG）。 */
  const eH = exam(f, ['--mode=long', '--field=mix4'], EXG);
  const eI = exam(f, ['--mode=multi', '--field=farmerwall'], EXG);
  const sp = selfPlay(W, params, SP_MODE, GAMES);
  const fPass = fieldRate(W, params, 'passive', SP_MODE);
  const fAct = fieldRate(W, params, 'active', SP_MODE);
  const agg = aggressionProfile(W, params, GAMES2);   // v1.5.62：F 新口径（场 A 被集火还手率）
  /* v1.5.57：局数必须够 —— 20 局时 5 席各约 4 局，30pt 阈值会被抽样噪声淹没（实测同一策略 37~50pt 抖动）。 */
  const ss = seatSymmetry(W, params, 'multi', SEAT_G);
  /* v1.5.59：D 的 1st 被并列污染（线上包 100% 里 87.5% 是并列，严胜仅 12.5%）⇒
   * 真正有判别力的是**反弹墙里的穿透卡落地伤害**（0 = 面对 4 面反弹墙一枪未发）。 */
  const rw = reflectWall(W, params, 'long', GAMES2);
  const cp = chargeProfile(W, params, 'multi', GAMES2);   // v1.5.58：蓄能空转（过期珠/得珠）   // 座位对称性（百分点口径）
  const nm = f.replace('docs/artifacts/', '').replace('js/', '').slice(0, 41);
  console.log(nm.padEnd(42) +
    String(e1.first == null ? '?' : e1.first).padStart(8) + '%' +
    /* v1.5.58（复核 §4-1）：并报**严格胜率**（引擎判胜）—— 只看 1st 会把'并列第一'当赢（farmerwall 实测 97.5% vs 严胜 0.0%）。 */
    String(e1.strict == null ? '?' : e1.strict).padStart(8) + '%' +
    sp.dmgPerGame.toFixed(1).padStart(9) +
    sp.heavyPerGame.toFixed(1).padStart(10) +
    sp.holoPerGame.toFixed(1).padStart(8) +
    (sp.zeroRate * 100).toFixed(0).padStart(9) + '%' +
    (sp.drawRate * 100).toFixed(0).padStart(7) + '%' +
    sp.rounds.toFixed(1).padStart(7) +
    String(e2.first == null ? '?' : e2.first).padStart(14) + '%' +
    /* v1.5.26（用户裁定）：E 改用新口径 —— 对手ジ<5（无大雷威胁）时还摆架势的占比。
     * 旧口径（总占比）会把"看到对手攒到 5 ジ 该防一下"也判成病：实测 eco-34 旧 89% / 新 16%。 */
    (fPass.noThreatStanceRate * 100).toFixed(0).padStart(10) + '%' +
    (agg.fieldA.atk * 100).toFixed(0).padStart(11) + '%' +
    fAct.rounds.toFixed(1).padStart(7) +
    sp.effSkills.toFixed(2).padStart(12) + ' (' + sp.distinctKeys + '种)' +
    ss.spread.toFixed(0).padStart(9) + 'pt' +
    rw.dmgPerGame.toFixed(2).padStart(12) +
    cp.chargesPerGame.toFixed(1).padStart(9) +
    (cp.wasteRate * 100).toFixed(0).padStart(8) + '%' +
    /* v1.5.57（复核 §4-4）：H/I 原先印在 D 之后、表头却排在末尾 ⇒ 按表头读会整体错两格。现按表头顺序印。 */
    String(eH.first == null ? '?' : eH.first).padStart(8) + '%' +
    String(eI.first == null ? '?' : eI.first).padStart(8) + '%');
}
console.log('\n判读：**A 高但 B 伤害≈0** = 靠"熬到哨声"赢的，不是强度（long-33 就是这个形状）；');
console.log('      C 盾/局 高 ⇒ 互套盾风险（v1.5.4 之后把盾套给对手）；零伤害率/平局率高 = 摆烂；');
console.log('      **E 无威胁摆架势率高 + F 活跃场进攻率低** ⇒ 学出了"互戒均衡"（REVIEW §12：三张架势牌费用为 0）；');
console.log('      **G 有效技能数**（非ジ出手的 exp(熵)）< 3 ⇒ 打法只剩两三张卡。');
console.log('      ⚠️ v1.5.18 起这几列**不再只是打印**：`tools/promote-champion.mjs` 会拿 E/F/G 与');
console.log('         伤害/平局/全息屏障一起做**阻断条件**（--force 可越过，但会留痕）。');
