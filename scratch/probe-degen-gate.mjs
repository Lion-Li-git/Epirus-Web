/* 复现 CB-s13 那格的形状：六席零攻击率都是 0 ⇒ 退化闸该不该喊"全部退化"？ */
import { rejectDegenerateWinners } from '../tools/pick-best.mjs';

const mk = (n) => Array.from({ length: n }, (_, i) => ({
  ref: { params: [i], fit: 1.38 - i * 0.02 },
  score: 0.378 + i * 0.01,
  zeroAtkRate: 0,
  ev: { sc: 0.378 + i * 0.01 },
}));

const a = rejectDegenerateWinners(mk(6));
console.log('形状1（在册：零攻击 0%）→ dropped=' + a.dropped + ' best?' + (a.best ? '有' : '**null**'));

/* 形状2：字段名写错/没带（模拟"量具没跑那一粒"） */
const b = rejectDegenerateWinners(mk(6).map((e) => ({ ref: e.ref, score: e.score, ev: e.ev })));
console.log('形状2（缺 zeroAtkRate 字段）→ dropped=' + b.dropped + ' best?' + (b.best ? '有' : '**null**'));

/* 形状3：entries 里 ref 缺失（train-3p 传的是 hallEntries，ref 恒在；这里只为看过滤器怎么判） */
const c = rejectDegenerateWinners([{ score: 1 }, { score: 2 }]);
console.log('形状3（无 ref）→ dropped=' + c.dropped + ' best?' + (c.best ? '有' : '**null**'));

/* 形状4：NaN 分数（evalN 万一回 NaN） */
const d = rejectDegenerateWinners(mk(6).map((e) => Object.assign({}, e, { score: NaN })));
console.log('形状4（score=NaN）→ dropped=' + d.dropped + ' best?' + (d.best ? '有' : '**null**'));

/* 形状5：空数组 */
const e5 = rejectDegenerateWinners([]);
console.log('形状5（空池）→ best?' + (e5.best ? '有' : '**null**') + '（train-3p 的 else-if 靠 hallEntries.length 挡住）');
