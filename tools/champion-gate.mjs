#!/usr/bin/env node
/* champion-gate.mjs —— 冠军验收线的**单一登记处**（千问 · 2026-10-28）
 *
 * 为什么要有它（用户 10-28 裁定）：
 *   ① 「先把理想冠军过线要求写清楚」——原来的线叫「伤 平 墙 架 还 座 广 场B G4 G5 珠 强」，
 *      每个字都要先读一遍代码才知道它在量什么 ⇒ 本文件把每条线写成**人话名 + 能力维度 + 量在哪张桌**；
 *   ② 「池子里是多种不同风格的冠军，不能指望每枚都用所有技能」⇒ 线必须分层：
 *      **单包只判「任何风格都不该有的缺陷」，能力覆盖归整池**（原来 12 行把这两件事混排，
 *      读的人只能读成「十二项都要最优」）；
 *   ③ 「不能纯只是池子里有」⇒ 池级那一层带**配额**（用户 10-28 给的数），并且印出现状对照。
 *
 * 一条线属于哪一层，用这一句判：**「如果我接受池里有一枚专职坦克、一枚专职龟缩，这条线还成立吗？」**
 *   成立 ⇒ 单包层（L0/L1）；不成立 ⇒ 池级（L2）。
 *
 * 用法：
 *   node tools/champion-gate.mjs --selftest                       # 只跑登记处自检（名字唯一/层合法/线非空/珍不在闸门）
 *   node tools/champion-gate.mjs --pool [--games=120] [--eps2]     # 池级：逐卡覆盖率 vs 用户配额（两把口径并排）
 *   node tools/champion-gate.mjs --legend                           # 只印这张分层表（文档用）
 * ⚠ 本文件**不解析 promote 的输出**，也**不做判语**：解析与判语在 `tools/score13.mjs`（它 import 这里的 LINES）。
 *   分成两个文件是为了让"线定义"只有一份：判语器改口径时不许顺手改定义，定义改了就当场被 --selftest 抓到。
 */
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

/* ===== 层 ===== */
export const LAYERS = {
  L0: { name: '结构', who: '每一枚', mean: '与打得好不好无关：公平、合法性。违反 = 一定不上线，不许放宽' },
  L1: { name: '缺陷地板', who: '每一枚', mean: '这枚包「一窍不通」的洞。线画在「完全不会」，不是「不够精」——抬高它就等于要求每枚冠军都会所有技能' },
  L2: { name: '池级覆盖', who: '整个池', mean: '某种能力在池子里必须有人有；**不许压给单枚包**' },
  L3: { name: '只记录', who: '报告', mean: '研究判据、极值、没有分母的期待 ⇒ 不判红' }
};

/* ===== 逐枚的线（L0/L1）+ 降到只记录的（L3） =====
 * old = 原来的机器名（`score13.mjs` 的解析与历史文档仍在用它，保留做对照）
 * src = 量在哪张桌 · 样本量（同一性状在仓里有几把尺 ⇒ 必须写死是哪一把） */
export const LINES = [
  { key: 'seat', old: '座', layer: 'L0', dim: '公平（不偏心座位）',
    name: '坐哪个位置都一样能打',
    rule: '5 席同一枚包时，各席夺冠率的极差 < 30pt',
    src: 'seatSymmetry · 5 席镜像 · n=100 · ε=0',
    get: r => r.raw.seat, pass: v => v != null && v < 30 },

  { key: 'legal', old: '（新增）', layer: 'L0', dim: '合法性（交出的动作真被引擎执行）',
    name: '交出去的动作没有被静默改写',
    rule: '递交动作被引擎记进当回合动作栏 ≥ 99%（废手率 ≤ 1%）',
    src: 'probe-wasted-play 的「废手」列（action.outcome !== ok）· n=30 · 产品档 ε=0.2',
    get: r => r.raw.wasteHand, pass: v => v == null ? null : v <= 1, na: '这一遍没量 ⇒ 读不出（不判绿）' },

  { key: 'dmg', old: '伤', layer: 'L1', dim: '主动性（不互相干等）',
    name: '一局里真打得出伤害',
    rule: '≥ 5 点/局',
    src: '自对局（5 席同一冠军）· n=20 · multi',
    get: r => r.raw.dmg, pass: v => v != null && v >= 5 },

  { key: 'draw', old: '平', layer: 'L1', dim: '终局能力（能收场）',
    name: '这局收得了场，不是一起耗到上限',
    rule: '平局率 ≤ 20%',
    src: '自对局 · n=20 · multi',
    get: r => r.raw.draw, pass: v => v != null && v <= 20 },

  { key: 'stance', old: '架 + 白防', layer: 'L1', dim: '防御的时机（别空转、也别防了个寂寞）',
    name: '没人威胁时不是一直摆架势；出手防御时通常真有人来打',
    rule: '① 无威胁（对手珠 < 5）回合里摆架 ≤ 60%　② 白防率 ≤ 80% —— **只在防御 ≥20 手时判**，不足 = 读不出',
    src: '① promote E 栏（自对局）‖ ② probe-wasted-play 的**被攻击桌(hotseat)** · n=30（池 30 枚：12 枚防御 ≥20 手、13 手次数不足、5 枚从没出防御；有分母那批白防中位 65.5%）' +
      ' —— ⚠ promote 默认印的是**攒钱者(banker)** 那一栏（同池白防中位 89.4%、倍差中位 0.65×<1 ⇒ 「没人打我」是桌子产物，不喂这条判据）',
    get: r => [r.raw.stance, r.raw.idle, r.raw.defN],
    pass: v => { const [st, idle, n] = v || []; if (st == null) return false; if (st > 60) return false;
      if (idle == null || !(n >= 20)) return true;    /* 白防没量或分母不足 ⇒ 这一子句不判（不判绿也不判红） */
      return idle <= 80; } },

  { key: 'fieldA', old: '还', layer: 'L1', dim: '抗压制（挨打会还手）',
    name: '被围殴时不是只攒钱不还手',
    rule: '还手率 ≥ 20%（⚠ n=100 的 95% 半宽 = ±7.8pt ⇒ 线正落在噪声带里，贴线 18~22% 别当结论）',
    src: '场A：1 席被测 + 4 席随机猛攻 · 3 血 · n=100',
    get: r => r.raw.fieldA, pass: v => v != null && v >= 20 },

  { key: 'broad', old: '广', layer: 'L1', dim: '手段多样性（别只会一张牌）',
    name: '会用的招不止两三种',
    rule: '有效技能数 ≥ 3，短程与长程各判，两把尺里取更严的那把',
    src: 'min(selfPlay ‖ breadthProfile) × {multi, long}',
    get: r => [r.raw.gMulti, r.raw.gLong],
    pass: v => Array.isArray(v) && v[0] != null && v[1] != null && v[0] >= 3 && v[1] >= 3 },

  { key: 'wall', old: '墙', layer: 'L1', dim: '不被一种机制赖死（反弹要换卡打）',
    name: '对面都摆反弹时不是一枪不发',
    rule: '主动伤害 > 0.5/局（promote 那侧还有一条「穿透卡零命中 ⇒ 阻断」）',
    src: '反弹墙桌：4 席 reflectspam · 长程 · n=20',
    get: r => r.raw.wall, pass: v => v != null && v > 0.5 },

  { key: 'fieldB', old: '场B', layer: 'L1', dim: '收割（把快死的收掉，别让人回血拖过去）',
    name: '对面都在攒钱不动时，能把人打死',
    rule: '清场 ≥ 0.3 次/局（≈三局收一个）',
    src: '场B：1 席被测 + 4 席只ジ · n=40 · 终局收缩之前才计数',
    get: r => r.raw.fieldB, pass: v => v != null && v >= 0.3 },

  { key: 'g4', old: 'G4', layer: 'L1', dim: '抗套路（不被固定操作稳赢）',
    name: '不会被一套固定操作连续吃掉',
    rule: '八格一行脚本克制表里，**最克的那一格**赢它的比率 ≤ 60%（理想线 45%）',
    src: 'gate-drafts · 8 格 × {multi, long} × n=300（基线格须在 8~32% 之间才叫可判）',
    get: r => (r.raw.behaviorHeader ? r.raw.g4Fails.length === 0 : null), pass: v => (v === null ? null : v === true) },

  { key: 'g5', old: 'G5', layer: 'L1', dim: '破龟（纯防御要能收场）',
    name: '有人往那一躺只防不还手时，它赢不赢得了',
    rule: '防席夺冠 ≤ 25%（开上线档 ≤ 40%）',
    src: 'gate-drafts · 1 席只防御 + 4 席被测 × {multi, long} × n=300',
    get: r => (r.raw.behaviorHeader ? r.raw.g5Fails.length === 0 : null), pass: v => (v === null ? null : v === true) },

  /* 珠：2026-10-28 用户「珠经济门确实可以调整，或许可以按照绝对浪费数量来算？」⇒ 比率换成绝对颗数。
   * 原线（得珠>0 ∧ 浪费<50% ∧ 蓄能≤9.4）罚的主要是「参与珠经济的深度」：
   *   全池 30 枚同尺重跑 = 得珠 0 有 4 枚 / 浪费≥50% 有 12 枚 / 只有 5 枚是「攒得多又没花」。
   * 而珠的规则本身就是**同类上限 1 颗、只活到下一回合**（resolve.js:1294-1302）⇒ 蓄了没花必然过期。 */
  { key: 'bead', old: '珠', layer: 'L1', dim: '经济闭环（别把珠囤死在手里）',
    name: '攒下来的珠没有被囤成一堆过期废物',
    rule: '过期 ≤ 5 颗/局（绝对量，不看比率）‖ 得珠 = 0 ⇒ 不适用（这枚包不走珠经济 = 风格，不是缺陷）',
    src: 'chargeProfile · 长程 · n=40（池 30 枚实测：0 颗 ~10 枚 ‖ >5 颗 7 枚 ‖ 最高 43.2 颗/局）',
    get: r => (r.raw.expiredPerGame == null ? null : (r.raw.gained === 0 ? 'NA' : r.raw.expiredPerGame)),
    pass: v => v === 'NA' ? true : (v == null ? null : v <= 5) },

  { key: 'strong', old: '强', layer: 'L1', dim: '强度（抽到它赢不赢得下来）',
    name: '玩家抽到它时赢不赢得了',
    rule: 'A 考卷 1st ≥ 48.2%（= soft 带中位）—— **初期只当诊断**：用户 10-28「强度要求在初期肯定是没办法完成的，考卷本身可能也需要修改」**待考卷重做后再进阻断**',
    src: 'eval-5p A 考卷 · 5 人 3 血 · 4 席互不相同脚本 · n=120（池上极差只有 17.8pt，而单枚 95% 区间 ±4.5pt ⇒ 量程约等于 4 个台阶）',
    get: r => r.strength, pass: v => v != null && v >= 48.2 },

  /* ===== 不进闸门的（L3）：用户 10-28 已裁 ===== */
  { key: 'dens', old: '珍', layer: 'L3', dim: '单张卡（激光眼）的用量',
    name: '激光眼出手密度（研究判据）',
    rule: '≥ 0.10 次/席·局 —— **用户裁定不进闸门**（「2.0 闸门里不应该单独包含一个激光眼，否则其他技能也得上了」）',
    src: 'mirrorHealth.castByKey.laserEye · ε=0 镜像 · n=120 × {multi, long}',
    get: r => r.density, pass: v => Array.isArray(v) && v.length === 2 && (v[0] >= 0.10 || v[1] >= 0.10) },

  { key: 'holo', old: '送盾（硬门槛）', layer: 'L3', dim: '把原型制御白送对手的频率',
    name: '全息屏障套给别人（旧硬门槛 > 7.5 次/局，--force 也不放行）',
    rule: '**建议降级为只记录**：这条是 v1.5.32 立的，而它的病根已由 v1.5.34「目标没进决策」在引擎侧根因修复；' +
      '且它的口径（ε=0 镜像 multi n=20）与产品口径读出差 2.7 倍 ⇒ 同一个 v7beadseed-82 一侧读 14.9/局（越线）、另一侧读 5.42/局（在线内）',
    src: 'selfPlay.holoOtherPerGame · n=20 · ε=0（2026-10-28 实测：池 30 枚越线的只有 1 枚）',
    get: r => r.raw.holoOther, pass: v => v != null && v <= 7.5 },

  { key: 'g6', old: 'G6', layer: 'L3', dim: '靶向（会不会瞄威胁者）',
    name: '靶向率（只记录）',
    rule: '≥ 40% 才叫会瞄 —— 四代包（含线上）全部 3.5~22.5% ⇒ 是「能力未长出」不是某包退化，做成阻断会把所有候选一起挡死',
    src: 'gate-drafts G6 · n=40', get: () => null, pass: () => null }
];

/* ===== 池级配额（L2）：用户 10-28 给的数，逐条带现池实测 =====
 * 「会用」= 这枚包在该口径下**至少出过 1 手**这张卡；覆盖率 = 会用包数 / 池 30 枚。
 * 两把口径必须并排印：同一枚包换一个 ε，答案可以完全相反（过载炮 0% ↔ 63%）。 */
export const POOL_QUOTAS = [
  { key: 'ring', name: '聚能环', min: 0.50, note: '用户：要一半以上冠军会用' },
  { key: 'bigT', name: '大雷（真正的落雷）', min: 0.50, note: '同上' },
  { key: 'railgun', name: '电磁炮', min: 0.50, note: '同上' },
  { key: 'laserEye', name: '激光眼', min: 0.25, note: '用户：1/4 以上' },
  { key: 'cannon', name: '过载炮', min: 0.25, note: '同上（⚠ 这把尺决定性：ε=0 全池 0%、产品档 63%）' },
  { key: 'miniT', name: '小雷（雷击之枪）', min: 0.25, note: '用户 10-28「小雷、原型制御、转移伤害这种也可以有一定的覆盖率」⇒ 先挂 ≥25%，线待裁' },
  { key: 'proto', name: '原型制御', min: 0.25, note: '同上' },
  { key: 'transfer', name: '转移伤害', min: 0.25, note: '同上（⚠ 现池 ε=0 只有 1/30 ⇒ 这条**不是重选池子能达标的**，要新训）' },
  { key: 'curse', name: '贴贴', min: 1 / 30, note: '用户：有一个包就行' },
  { key: 'firestorm', name: '天火', min: 1 / 30, note: '同上' },
  /* 用户 10-28：「避雷针和地雷这种技能的效果会随着人数增加上升」⇒ 这两张的配额**按座位数分档**。
   *   规则依据（我读了引擎，不是顺着话写的）：
   *   · 地雷 = `rules.js:81`「被非狙击枪攻击时，**除自己外全场其他角色**各受 1 点火伤」+ `resolve.js:421-439` 逐席结算
   *     ⇒ 一波的收益 = **(人数 − 1) 点**，2 人桌只有 1 点、5 人桌 4 点。
   *   · 避雷针 = `rules.js:71`「当回合**雷系技能全部无效**，雷系使用者受 1 电伤并回馈ジ」+ `resolve.js:794-796` 逐席枚举 rodUsers
   *     ⇒ 它挡的是"这一回合有几个雷系使用者"，人越多越可能有人开大雷 ⇒ 同样随人数上升。 */
  { key: 'mine', name: '地雷', min: 0.25, perSeats: { 2: 0, 3: 1 / 30, 4: 0.15, 5: 0.25 }, scalesWithPlayers: true,
    note: '收益 = 人数−1 点 ⇒ 2 人桌不设线、5 人桌要 ≥25%' },
  { key: 'rod', name: '避雷针', min: 0.15, perSeats: { 2: 0, 3: 1 / 30, 4: 0.10, 5: 0.15 }, scalesWithPlayers: true,
    note: '当回合全场雷系无效 ⇒ 人多才值得带；同上分档' },
  { key: 'dualGun', name: '双枪射手', min: 0, note: '用户预判「很难搞出来」⇒ 不设线，只记录（现池各有 1 枚会用）' },
  { key: 'mirror', name: '镜面反射', min: 0, note: '同上' }
];

/* ---------- 池级覆盖率（只读）----------
 * **ε=0 那一栏不自己算** ⇒ 直接调 `EpirusTrainer.mirrorHealth` 的 `castByKey`（与「珍」那条同一台量具，
 *   本仓的老病是「两份同构实现必漂移」；这里只对产品档 ε=0.2 自己拼桌，因为 `mirrorHealth` 不吃 ε）。 */
export function coverageOf(paths, games, seats) {
  const W = sandbox(REPO), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
  const G = games || 120;
  const N = seats || 5;
  /* ⚠ 与 `js/train/evo.js:62-66` 的 `slotSaltFor` **逐字同**（三步抖动的**顺序**是装配的一部分；少一步或换顺序 = 换桌 = 换读数） */
  const salt = seed => {
    let h = (Math.imul((seed | 0) + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
    return h >>> 0;
  };
  function productSpectrum(params, mode) {
    /* 产品档 = `js/app/play-controller.js` 的 temp 0.15 · ε=0.2 · k=5 · soft */
    const ch = T.policyChooserN(params, 0.15, 0.2, 5, 'soft');
    const cnt = {};
    for (let g = 0; g < G; g++) {
      const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(9000 + g) }, N);
      st.slotSalt = salt(9000 + g);
      Play.autoGameN(st, Array.from({ length: N }, () => ch));
      for (const e of st.events) if (e.type === 'action' && e.outcome === 'ok' && e.key) cnt[e.key] = (cnt[e.key] || 0) + 1;
    }
    return cnt;
  }
  const rows = [];
  for (const p of paths) {
    const params = loadChamp(W, p);
    if (!params) { rows.push({ path: p, unreadable: true }); continue; }
    const gm = W.EpirusTrainer.mirrorHealth(params, G, N, 'multi');
    const gl = W.EpirusTrainer.mirrorHealth(params, G, N, 'long');
    rows.push({ path: p,
      greedy: gm.castByKey || {}, greedyLong: gl.castByKey || {},
      holoOther: gm.holoOtherPerGame,
      product: productSpectrum(params, 'multi'), productLong: productSpectrum(params, 'long') });
  }
  return { rows, R, games: G };
}
export function coverageTable(rows, R) {
  const keys = R.AVAILABLE_MULTI.map(x => (typeof x === 'string' ? x : x.key));
  const n = rows.filter(r => !r.unreadable).length;
  const out = {};
  for (const k of keys) {
    let greedy = 0, product = 0;
    for (const r of rows) { if (r.unreadable) continue;
      if ((r.greedy[k] || 0) > 0 || (r.greedyLong[k] || 0) > 0) greedy++;
      if ((r.product[k] || 0) > 0 || (r.productLong[k] || 0) > 0) product++; }
    out[k] = { greedy, product, n };
  }
  return out;
}

/* ---------- 自检：登记处自己的形状 ---------- */
function selftest() {
  const checks = [];
  const names = LINES.map(l => l.name);
  checks.push(['人话名不重复', new Set(names).size === names.length]);
  checks.push(['每条线都有层、且层在 LAYERS 里', LINES.every(l => !!LAYERS[l.layer])]);
  checks.push(['每条线都有 rule / src / dim', LINES.every(l => l.rule && l.src && l.dim)]);
  checks.push(['闸门里不许有单张卡的线（L1 不许出现卡名）',
    !LINES.filter(l => l.layer === 'L1').some(l => /激光眼|聚能环|电磁炮|过载炮|贴贴|天火|双枪|镜面|全息/.test(l.name + l.rule))]);
  checks.push(['激光眼密度（珍）确实被挪出闸门', (LINES.find(l => l.key === 'dens') || {}).layer === 'L3']);
  checks.push(['送盾（旧硬门槛）已登记为只记录', (LINES.find(l => l.key === 'holo') || {}).layer === 'L3']);
  checks.push(['珠这条按绝对颗数判（规则里不许出现「浪费率」）', /过期 ≤ \d+ 颗\/局/.test(LINES.find(l => l.key === 'bead').rule)]);
  checks.push(['防御这条把两个分母都写明（白防要 ≥20 手才判）', /≥\s?20 手/.test(LINES.find(l => l.key === 'stance').rule)]);
  checks.push(['强度这条挂着「初期只当诊断」', /初期只当诊断/.test(LINES.find(l => l.key === 'strong').rule)]);
  const gate = LINES.filter(l => l.layer === 'L0' || l.layer === 'L1').map(l => l.key).sort().join(',');
  const want = ['seat', 'legal', 'dmg', 'draw', 'stance', 'fieldA', 'broad', 'wall', 'fieldB', 'g4', 'g5', 'bead', 'strong'].sort().join(',');
  checks.push(['逐枚闸门 = 原 12 条（珠保留、架并入白防、珍与送盾出局）+ 新增 1 条合法性', gate === want]);
  checks.push(['新增那条挂了「未接线就读不出」（na 字段在）', !!LINES.find(l => l.key === 'legal').na]);
  checks.push(['池级配额覆盖用户点名的全部卡（含 10-28 追加的小雷/原型制御/转移伤害/地雷/避雷针）',
    ['ring', 'bigT', 'railgun', 'laserEye', 'cannon', 'curse', 'firestorm', 'miniT', 'proto', 'transfer', 'mine', 'rod'].every(k => POOL_QUOTAS.some(q => q.key === k))]);
  checks.push(['「随人数上升」那两张必须真的按座位分档（2 人档 = 不设线）',
    [ 'mine', 'rod' ].every(k => { const q = POOL_QUOTAS.find(x => x.key === k); return q && q.scalesWithPlayers && q.perSeats && q.perSeats[2] === 0 && q.perSeats[5] > q.perSeats[3]; })]);
  checks.push(['每条配额都写了出处（note 不许空）', POOL_QUOTAS.every(q => !!q.note)]);
  let bad = 0;
  for (const [name, ok] of checks) { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name); }
  console.log('champion-gate 自检：' + (checks.length - bad) + '/' + checks.length);
  process.exit(bad ? 1 : 0);
}

function legend() {
  const by = {};
  for (const l of LINES) (by[l.layer] || (by[l.layer] = [])).push(l);
  for (const k of ['L0', 'L1', 'L2', 'L3']) {
    if (!by[k]) continue;
    console.log('\n【' + k + ' ' + LAYERS[k].name + '】负责：' + LAYERS[k].who + ' —— ' + LAYERS[k].mean);
    for (const l of by[k]) console.log('  · ' + l.name + '\n      线：' + l.rule + '\n      量具：' + l.src + '\n      原机器名：' + l.old);
  }
  console.log('\n【L2 池级覆盖】负责：整个池（不压给单枚包）');
  for (const q of POOL_QUOTAS) console.log('  · ' + q.name + '：配额 ' + (q.min === 0 ? '不设线' : Math.round(q.min * 100) + '% 的包会用') + ' —— ' + q.note);
}

async function pool(games, onlyPaths, seats) {
  const fs = await import('node:fs');
  const raw = fs.readFileSync(REPO + '/champion-map/pool-members.tsv', 'utf8').replace(/^﻿/, '');
  const col = {}; raw.split('\n')[0].split('\t').forEach((h, i) => { col[h.trim()] = i; });
  const list = raw.split('\n').slice(1).filter(l => l.trim())
    .map(l => ({ id: l.split('\t')[col.id], path: (l.split('\t')[col.path] || '').trim() }))
    .filter(r => r.path && (!onlyPaths.length || onlyPaths.includes(r.id)));
  if (!list.length) { console.error('⛔ 池名单是空的（pool-members.tsv 没读到或 --only= 全筛掉了）⇒ **拒绝判语**：0 枚上打 "0/0 ✅" 是假绿'); process.exit(2); }
  const t0 = Date.now();
  const { rows, R } = coverageOf(list.map(r => r.path), games, seats);
  const live = rows.filter(r => !r.unreadable).length;
  if (!live) { console.error('⛔ ' + list.length + ' 枚全读不出权重 ⇒ 拒绝判语'); process.exit(2); }
  const tab = coverageTable(rows, R);
  const ids = list.map(r => r.id);
  console.log('# 池级覆盖率 · n=' + rows.filter(r => !r.unreadable).length + ' 枚 · 每格 ' + games + ' 局 × ' + (seats || 5) + ' 席 · 两把口径并排（ε=0 = 策略想用什么 ‖ ε=0.2 = 玩家抽到看得见什么）');
  const nameOf = {}; for (const s of R.skills) nameOf[s.key] = s.name;
  for (const q of POOL_QUOTAS) {
    const c = tab[q.key] || { greedy: 0, product: 0 };
    const eff = (q.perSeats && q.perSeats[seats] !== undefined) ? q.perSeats[seats] : q.min;
    const need = eff === 0 ? null : Math.ceil(eff * rows.filter(r => !r.unreadable).length);
    const okG = need == null ? '—' : (c.greedy >= need ? '✅' : '❌');
    const okP = need == null ? '—' : (c.product >= need ? '✅' : '❌');
    console.log('  ' + (nameOf[q.key] || q.name).padEnd(9, ' ') + ' 配额 '
      + (need == null ? '不设' : need + ' 枚以上' + (q.perSeats ? '(' + (seats || 5) + '人档)' : '')).padEnd(9, ' ')
      + ' ‖ ε=0 ' + String(c.greedy).padStart(2) + '/' + c.n + ' ' + okG
      + ' ‖ 产品档 ' + String(c.product).padStart(2) + '/' + c.n + ' ' + okP
      + '   ' + q.note);
  }
  const unmetered = Object.keys(tab).filter(k => !POOL_QUOTAS.some(q => q.key === k));
  console.log('\n  其余卡（本轮未设配额，只列覆盖率）：');
  for (const k of unmetered) console.log('    ' + (nameOf[k] || k).padEnd(9, ' ') + ' ε=0 ' + String(tab[k].greedy).padStart(2) + '/' + tab[k].n
    + ' ‖ 产品档 ' + String(tab[k].product).padStart(2) + '/' + tab[k].n);
  console.log('\n  耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒');
}

const A = process.argv.slice(2);
const arg = k => { const f = A.find(a => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : null; };
/* ⚠ CLI 派发必须**只在直接被调用时**跑：本文件被 `tools/score13.mjs` 当登记处 import，
 *   没有这道守卫时 `import` 会把宿主进程的 `--selftest`/`--pack=` 也当真做了并 `process.exit`
 *   ⇒ 判语器一声不响地变成登记处自检（实测踩过，10-28）。 */
const DIRECT = process.argv[1] && /champion-gate\.mjs$/.test(process.argv[1]);
if (DIRECT) {
  if (A.includes('--selftest')) selftest();
  else if (A.includes('--legend')) legend();
  else if (A.includes('--pool')) pool(Number(arg('games', 120)) || 120, (arg('only', '') || '').split(',').filter(Boolean), Number(arg('seats', 5)) || 5);
  else { console.log('用法：--selftest ‖ --legend ‖ --pool [--games=120] [--only=id1,id2] [--seats=2..5]'); console.log('逐枚判语在 `tools/score13.mjs`（它 import 本文件的 LINES）。'); }
}
