/* 「风格化冠军」当训练对手 —— 机制**单一来源**（v1.5.2）
 *
 * 为什么需要：训练池里原先**只有脚本对手**（`js/train/bots.js` 里的 if-else 人格）。
 * 而手上那几个 `.bak` 冠军本身就是四种成型的流派 ——
 *   激光剑流 / 狙击枪+环流 / 坦克流 / 枪+墙流（画像见 `docs/skill-report-cmp.html`）。
 * 要练"对不同风格都有反制能力"，这些才是真靶子：脚本对手打不出成体系的策略。
 *
 * 名字语法：`champ:<仓库相对路径>`
 *   例：`champ:docs/artifacts/champion-5p-armB12f.bak`
 * 为什么不把冠军包写死在名单里：§7 的约定是**冠军包不入库**（`*.bak` 被 .gitignore 忽略），
 * 写死会让仓库依赖本机文件。用 `?opps=` 传路径则**既不留依赖、又天然可复现** ——
 * 路径会连同 seed/参数一起记进产物 meta 的 `opps` 字段。
 *
 * 为什么本模块要**接收调用方的沙箱**：server 与 worker 各有独立 vm context，
 * 各自加载了自己的 `EpirusPolicy` / `EpirusTrainer`。函数无法跨线程传，
 * 所以两边各自构造 chooser，但**解析规则只有这一份**（v1.4.8 的静默取子集就是这么来的）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const CHAMP_PREFIX = 'champ:';
export function isChampOpp(nm) { return typeof nm === 'string' && nm.indexOf(CHAMP_PREFIX) === 0; }
export function champOppRel(nm) { return String(nm).slice(CHAMP_PREFIX.length); }
export function champOppAbs(nm, rootDir) {
  const rel = champOppRel(nm);
  return isAbsolute(rel) ? rel : join(rootDir, rel);
}
export function champOppMissing(nm, rootDir) { return !existsSync(champOppAbs(nm, rootDir)); }

/* 解包一个多人冠军包 → params（与 server 的 loadSeedN / eval-5p 同一条路径） */
export function loadChampParams(P, file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('不是多人冠军包（缺 EPIRUS_CHAMPION_3P）: ' + file);
  const params = P.unpack(JSON.parse(m[1]));
  if (!params) throw new Error('冠军包不兼容: ' + file);
  return params;
}

/* 统一解析器：**脚本名与冠军对手走同一个入口**。
 * 为什么必须唯一：本项目因为"名字→函数"的映射写两处/漏一处已经栽过三次
 * （v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 漏 opp-pool），
 * 而 v1.5.2 我加 champ: 对手时又漏了**终局评估那条路**（它自己又写了一遍 `B[BOT_FN_N[nm]]`）
 * ⇒ 训练跑到名人堂评估才炸成 `sel is not a function`。np-test D12 现在盯着这个形状。
 * 返回 null = 名字不认识；文件缺失/包不兼容则**抛错**（调用方据此在开跑前中止）。 */
export function makeOppSelResolver(sb, rootDir, fnMap, BotsObj, temp) {
  const resolveChamp = makeChampOppResolver(sb, rootDir, temp);
  return function resolveOpp(nm) {
    if (isChampOpp(nm)) return resolveChamp(nm).sel;
    const fn = fnMap[nm];
    return fn ? BotsObj[fn] : null;
  };
}

/* 带缓存的冠军对手解析器：worker 每一代都会要同一批对手，重复读盘+解包很浪费。
 * temp 与页面「困难」档一致（0.15）—— 就是玩家会遇到的强度。 */
export function makeChampOppResolver(sb, rootDir, temp) {
  const P = sb.EpirusPolicy, T = sb.EpirusTrainer;
  const TEMP = (typeof temp === 'number') ? temp : 0.15;
  const cache = new Map();
  return function resolve(nm) {
    if (cache.has(nm)) return cache.get(nm);
    const file = champOppAbs(nm, rootDir);
    if (!existsSync(file)) throw new Error('冠军对手文件不存在: ' + file);
    const params = loadChampParams(P, file);
    const sel = T.policyChooserN(params, TEMP);   // 与页面/评测同一条推理路径
    const out = { name: nm, sel: sel, file: file };
    cache.set(nm, out);
    return out;
  };
}
