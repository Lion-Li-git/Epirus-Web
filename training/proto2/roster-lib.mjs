/* roster-lib.mjs — 训练场**对手表**的单一来源（千问 · 11-01）
 *
 * 为什么单独一个文件：`PRODUCT7` 这份名单原先在 `tools/probe-cem-arm.mjs` 与 `tools/proto2/supfit-gd.mjs`
 *   各写一遍，而 `server/opp-pool.mjs` 的头注记着同族三次事故（"加名字漏一处"⇒ 服务端拿到 undefined，
 *   跑到一半才报 `sel is not a function`）。⇒ 名单只在这里写一次，两个工具都 import。
 * `names:` 档（同文件第二形态）是给"对手面实验"用的：`server/opp-pool.mjs` 里**已登记但两个训练池都没在用**
 *   的脚本（targeter / gunspam / snipespam / ringspam / deadlineburst / earlypressure …）可以直接摆进训练桌，
 *   不必每加一枚对手就改一次代码。名字不在册 ⇒ 当场拒（不许静默变成 undefined 席位）。
 */
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { makeAsChooser } from '../../tools/bot-chooser-lib.mjs';

export const PRODUCT7 = ['random', 'defend', 'antidef', 'wall', 'farmer', 'heavyfire', 'deepsaver'];

function build(W, T, rows, tag) {
  const asC = makeAsChooser({ T: T, R: W.EpirusRules });
  const out = [];
  for (const nm of rows) {
    const x = OPP_SPECS.filter((o) => o.name === nm)[0];
    if (!x) { console.error('⛔ ' + tag + '：对手名不在册（`server/opp-pool.mjs` 的 OPP_SPECS 里没有 "' + nm + '"；可选 ' + OPP_SPECS.map((o) => o.name).join(',') + '）'); process.exit(2); }
    const fn = W.EpirusBots[x.fn];
    if (typeof fn !== 'function') { console.error('⛔ ' + tag + '：' + nm + ' 的函数 ' + x.fn + ' 在 EpirusBots 里不存在（核对 server/opp-pool.mjs 与 js/train/bots.js）'); process.exit(2); }
    out.push({ name: nm, kind: 'bot', sel: asC(fn) });
  }
  if (!out.length) { console.error('⛔ ' + tag + '：roster 空'); process.exit(2); }
  return out;
}

/* 产品 7 的**摆桌次序 = OPP_SPECS 的次序**（不是名单的书写次序）：
 *   arena2 的席位轮换是 `ri % roster.length` ⇒ 换了顺序就是换了考场，昨夜 `RB2P-*` 那批配对读数会复现不出来。 */
function buildProduct(W, T, tag) {
  return build(W, T, OPP_SPECS.filter((o) => PRODUCT7.indexOf(o.name) >= 0).map((o) => o.name), tag);
}

/* `--arenaPool` 的三种取值：
 *   `product`          ⇒ 产品 7 脚本（eval-5p CORE 同名单）
 *   `names:a,b,c`      ⇒ 按名字摆任何**已登记**对手（可含产品池没用的 specialist）
 *   空                 ⇒ 不换池（研究卷 buildPoolSeeded 原路，逐字不变）
 * 返回 null 表示"不换"。 */
export function rosterFromArg(W, T, s, tag) {
  const str = String(s || '');
  if (!str) return null;
  if (str === 'product') return buildProduct(W, T, tag);
  const m = /^names:(.+)$/i.exec(str);
  if (m) return build(W, T, m[1].split(',').map((x) => x.trim()).filter(Boolean), tag);
  console.error('⛔ ' + tag + '：--arenaPool 只认 product | names:a,b,c（收到 ' + str + '）');
  process.exit(2);
}

/* 桌形串（`3:multi,5:multi`）⇒ {n,mode} 列表；空串 ⇒ null（沿用 arena2 默认 11 格）。
 * `:rN` 后缀（ZCode · 11-02 夜）= **逐形经济补贴**（该形每回合每席 +N ep；缺省 = arena 级 regen）：
 *   蒸馏采集要穷富混装——穷桌教攒钱/短程，富桌才能演示大雷(5ジ)/激光眼/投资块（11-02 两次冒烟红的修法）。 */
export function shapesFromArg(str, tag, dflt) {
  const s = String(str == null || str === '' ? (dflt || '') : str);
  if (!s) return null;
  return s.split(',').map((x) => {
    const m = /^(\d+):([a-z0-9]+)(?::r(\d+))?$/i.exec(x.trim());
    if (!m) { console.error('⛔ ' + tag + '：--arenaShapes 只认 n:mode[:rN]（收到 "' + x + '"）'); process.exit(2); }
    return { n: Number(m[1]), mode: m[2], regen: m[3] == null ? null : Number(m[3]) };
  });
}
