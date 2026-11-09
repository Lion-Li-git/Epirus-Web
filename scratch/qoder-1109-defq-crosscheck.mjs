/* 交叉核：新 measureDefenseQuality 与在产探针 probe-wasted-play 在同口径下必须给出同一组三档计数。
 * 口径对齐点：banker 装配 / multi / 5 席 / ε=0.2 k5 soft / temp 0.15 / seed 5200 / 40 局 / slotSalt 同式。 */
import { sandbox, ROOT, loadChamp } from '../tools/audit-lib.mjs';
import { measureDefenseQuality } from '../tools/defense-quality.mjs';

const pack = process.argv[2] || 'docs/artifacts/night-adapt/KD-G2.bak';
const W = sandbox(ROOT);
const p = loadChamp(W, pack);
if (!p) { console.error('⛔ 读不出包 ' + pack); process.exit(2); }
const r = measureDefenseQuality(W, p, { games: 40, eps: 0.2, seed: 5200, minHands: 30 });
if (r.err) { console.error('⛔ ' + r.err); process.exit(2); }
console.log('包=' + pack);
console.log('新函数: 出手 ' + r.acts + ' 防御手 ' + r.def + ' 有效 ' + r.eff + ' 半有效 ' + r.part + ' 白防 ' + r.idle +
  ' 被打后守 ' + r.afterHit + ' ⇒ 白防率 ' + r.whitePct.toFixed(1) + '% 质量 ' + (100 * r.q).toFixed(1) + '% measurable=' + r.measurable);
console.log('口径: ' + r.cal);
console.log('对照命令: node tools/probe-wasted-play.mjs --packs=' + pack + ' --games=40 --eps=0.2 --seed=5200');