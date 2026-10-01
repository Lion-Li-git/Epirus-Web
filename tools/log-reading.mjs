/* 真机对局日志（`results/` 下嵌套的 `.txt`）的**唯一一份**读取实现。
 *
 * 为什么要抽这一层（10-01 夜 · DS 交接件 `docs/HANDOFF-FOR-QWEN-2026-10-01.md` §3 三处 + 千问复核时挖出的第四处）：
 *   ① **能力项名单手写**：`log-behavior.mjs` 的 `CAP` 只有 9 项，真机数据里排**第 3 的激光剑（11.0%）与第 4 的聚能环（6.8%）
 *      压根不在表内** ⇒ 拿它判"能力项达标"会静默漏掉前三名的两席。
 *   ② **`已淘汰` 被算进分母**：`defTotal.n++` 对每个 `玩家N=【…】` 都加，而 `已淘汰` 是座位死亡后的**状态占位**、不是出招
 *      ⇒ 占比被压低（这批 12 局里它占原始计数的 **14.2%**）。
 *   ③ **完整分布脚本是一次性的**（跑完就没了 ⇒ 下次还得重写，且没人能复算）。
 *   ④ （千问补的）**桶与桶重叠会重复计数**：旧 `/枪(?!法)/` 把「狙击枪」也吃进"枪"这一行
 *      ⇒ 同一手被两个桶各计一次（这批 666 手里"枪"因此从 **13.2%** 虚报成 **16.4%**）。
 *
 * ⇒ 三条共同病根：**"卡有哪些"这件事被抄了第二遍**。这里只留一份：卡名一律从 `js/core/rules.js` 现取（D117 早就为防御类立过同一条规矩）。
 * ⇒ 本模块**只读**：不写 `results/`、不改任何包、不动出厂路径。
 *
 * 用法（给工具的接口，不是命令行）：
 *   const T = loadCardTable();
 *   const files = collectFiles(process.argv.slice(2));
 *   const c = census(files, seatList(process.argv.slice(2)), T);
 *   breadth(c.byCard, c.hands)   // → {kinds, top3, H, G}
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

/** 卡表：从规则表现取，**不许再手写第二份名单**（缺了就响亮退出，不许静默数 0）。 */
export function loadCardTable() {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(readFileSync('js/core/rules.js', 'utf8'), sb, { filename: 'js/core/rules.js' });
  const RUL = sb.window.EpirusRules;
  if (!RUL || !RUL.skills) { console.error('⛔ 从 js/core/rules.js 取不到 skills 表（卡表结构变了？）'); process.exit(3); }
  const keys = Object.keys(RUL.skills);
  const names = [];
  for (const k of keys) { const n = RUL.skills[k].name; if (n && names.indexOf(n) < 0) names.push(n); }
  const defNames = keys.filter(function (k) { return RUL.skills[k].cat === RUL.CAT.DEFENSE; })
    .map(function (k) { return RUL.skills[k].name; });
  if (!names.length || !defNames.length) {
    console.error('⛔ 从 js/core/rules.js 取不到防御类卡（卡表结构变了？）'); process.exit(3);
  }
  return { RUL: RUL, names: names, defNames: defNames };
}

/** 席位：默认 AI = 除真人席之外的 1..5（真人席 = `--human=`，默认 1）。 */
export function seatList(argv) {
  const s = argv.find(function (a) { return a.indexOf('--seats=') === 0; });
  if (s) return s.split('=')[1].split(',').map(Number);
  const hu = argv.find(function (a) { return a.indexOf('--human=') === 0; });
  const human = hu ? Number(hu.split('=')[1]) : 1;
  return [1, 2, 3, 4, 5].filter(function (p) { return p !== human; });
}

function walk(dir, out) {
  for (const nm of readdirSync(dir)) {
    const p = join(dir, nm);
    let st; try { st = statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.txt$/.test(nm)) out.push({ p: p, t: st.mtimeMs });
  }
  return out;
}

/** 参数既可以是文件也可以是目录（含嵌套）；不给参数就取 `results/` 下**最新 5 个** `.txt`（沿用旧口径，历史读数才可比）。 */
export function collectFiles(args, opts) {
  const want = (args || []).filter(function (a) { return a.indexOf('--') !== 0; });
  const out = [];
  for (const a of want) {
    let st; try { st = statSync(a); } catch (e) { throw new Error('读不到：' + a); }
    if (st.isDirectory()) { const g = walk(a, []); g.sort(function (x, y) { return x.t - y.t; }); for (const o of g) out.push(o.p); }
    else out.push(a);
  }
  if (!out.length) {
    const all = walk('results', []);
    all.sort(function (a, b) { return b.t - a.t; });
    return all.slice(0, (opts && opts.maxNewest) || 5).map(function (o) { return o.p; });
  }
  return out;
}

/* 动作栏的 token 形态（实测这批 776 条原始计数）：
 *   · **无目标**的卡直接是卡名 ⇒ `聚能环` / `蓄能` / `八卦阵` / `地雷` / `已淘汰` / `ジ`
 *   · **有目标**的卡带 `→玩家N` 后缀，且**26 种原始 token 里只有 5 种精确等于卡名**，其余 20 种都是带后缀的形态
 *     ⇒ 所以必须**先按 `→` 剪掉再精确比对卡名**；用子串匹配会把「狙击枪」记进"枪"（旧表就是这么虚高 3.2pt 的）。 */
export function cardOf(act) { const i = act.indexOf('→'); return i < 0 ? act : act.slice(0, i).trim(); }
/** `已淘汰` 是座位死亡后写在动作栏上的**状态占位**，不是这一席出的招 ⇒ 不进任何分母（DS 交接件 §3.2）。 */
export const ELIM = '已淘汰';

/** 清点：返回逐局 + 合计的出手构成。 */
export function census(files, seats, T) {
  const set = {}; for (const n of T.names) set[n] = 1;
  const perGame = [];
  const byCard = {}, unknown = {};
  let games = 0, roundsAll = 0, hands = 0, elim = 0, raw = 0;
  for (const f of files) {
    const local = {};
    let rounds = 0, localHands = 0, localElim = 0;
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    for (const ln of lines) {
      const m = /^第 (\d+) 回合：(.*)$/.exec(ln);
      if (!m) continue;
      rounds = Number(m[1]);
      const re = /玩家(\d)=【([^】]*)】/g;
      let x;
      while ((x = re.exec(m[2]))) {
        const pid = Number(x[1]), act = x[2];
        if (seats.indexOf(pid) < 0) continue;                  // 只看指定席位（真人席不在内）
        raw++;
        if (act === ELIM) { elim++; localElim++; continue; }    // 状态占位，不是出手
        hands++; localHands++;
        const c = cardOf(act);
        if (set[c]) { byCard[c] = (byCard[c] || 0) + 1; local[c] = (local[c] || 0) + 1; }
        else unknown[c] = (unknown[c] || 0) + 1;                // 表外卡名 ⇒ 响亮，不许静默丢手
      }
    }
    games++; roundsAll += rounds;
    perGame.push({ file: f.replace(/\\/g, '/'), rounds: rounds, hands: localHands, byCard: local });
  }
  const zero = T.names.filter(function (n) { return !byCard[n]; });
  return { games: games, roundsAll: roundsAll, raw: raw, hands: hands, elim: elim,
    byCard: byCard, unknown: unknown, zero: zero, perGame: perGame };
}

/** 广度四量里的三个（DS 交接件 §2.2：**不许只报 G**）：种类数 / 前 3 占比 / G=exp(Shannon 熵)。 */
export function breadth(byCard, hands) {
  const rows = Object.keys(byCard).map(function (k) { return { name: k, n: byCard[k] }; })
    .sort(function (a, b) { return b.n - a.n || (a.name < b.name ? -1 : 1); });
  if (!hands) return { rows: rows, kinds: 0, top3: NaN, H: NaN, G: NaN };
  let H = 0;
  for (const r of rows) { const p = r.n / hands; H -= p * Math.log(p); }
  const top3 = (rows[0] ? rows[0].n : 0) + (rows[1] ? rows[1].n : 0) + (rows[2] ? rows[2].n : 0);
  return { rows: rows, kinds: rows.length, top3: 100 * top3 / hands, H: H, G: Math.exp(H) };
}

/** 防御类占比（分母 = 有效出手，**已剔 `已淘汰`**）。 */
export function defShare(c, T) {
  let d = 0;
  for (const n of T.defNames) if (c.byCard[n]) d += c.byCard[n];
  return { def: d, share: 100 * d / Math.max(1, c.hands) };
}
