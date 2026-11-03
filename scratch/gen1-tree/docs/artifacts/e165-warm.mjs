/* §E165 探针：把"同进程第一次调用不同"这件事定位到**是哪一层**的暖机
 * 问三个问题：
 *   Q1 关档（不调搜索）有没有同样的"第一次不同"？⇒ 若有，这就不是今晚新加的代码，而是**引擎/量具层的既有暖机**。
 *   Q2 若有，它是一次调用就暖完，还是要几次？
 *   Q3 换档（off→on→off）会不会重新触发？
 * 用法：node docs/artifacts/e165-warm.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, WIN } from '../../tools/behavior-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const T = WIN.EpirusTrainer;
const params = loadChamp(WIN, 'js/bundled-champion-3p.js', ROOT);
const K = (t) => t.acts + '/' + t.rounds + '/' + t.wins;
const one = (G, s) => fieldProfile(params, 0.2, 'soft', G, s, 'mixed', 'multi');

function series(tag, G, s0, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(K(one(G, s0)));
  console.log('  ' + tag.padEnd(26) + out.join('  ‖  '));
  return out;
}

console.log('== §E165 暖机探针（同一参数连跑 n 次，看第 1 次与后面是否不同）==');
console.log('-- Q1/Q2：关档（BELIEF_SEARCH=0）--');
T.setBeliefSearch(0);
series('off · G=3 × 4', 3, 4100, 4);
series('off · G=1 × 4', 1, 4100, 4);
console.log('-- Q3：切到开档（tie=0，出厂形状）--');
T.setBeliefSearch(1); T.setBeliefTie(0);
series('on  · G=3 × 4', 3, 4100, 4);
console.log('-- 再切回关档（看"换档"是否重新触发）--');
T.setBeliefSearch(0);
series('off · G=3 × 4（换档后）', 3, 4100, 4);
console.log('-- 再一次开档 --');
T.setBeliefSearch(1);
series('on  · G=3 × 4（第二次）', 3, 4100, 4);
T.setBeliefSearch(0);
