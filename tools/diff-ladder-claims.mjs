/* diff-ladder-claims.mjs —— 难度阶梯"哪两步分得开"的**在册实测账**（§E591 · 2026-10-12 用户裁定甲）
 *
 * 为什么要有这个文件：`D227` 的 ④ 原来每次跑 1500 局 × 两装配去现场证明"五档两两分得开"，
 *   那句话既贵又已经被 10-11 的实测证否（换包把中段压平 ⇒ 门被裁定暂停）。
 *   甲 = **只声明分得开的档** ⇒ 于是"分得开"变成一条**有出处的读数**，而不是一次现场判断：
 *     · 每条声称都绑定"当时的档位参数签名" ⇒ 剂量/池一改，签名就变，声称当场过期（要重测才许再声称）；
 *     · σ 与"分得开/分不开"的标法必须自洽（|σ|≥2 才许写"分得开"）；
 *     · 表里每一对相邻档都必须有记录（新增一档却没测 = 红，不许悄悄多一个没人管的位置）。
 *   为什么不再现场跑到能判中段的分辨率：200 局下"普通↔入门"经常正好并列（实测三遍里两遍翻序），
 *   把那种 n 的序钉进门里只会造出**随机假红** ⇒ 现场只验"量具还活着 + 极端档分得开"（那一步是 25.8σ，稳）。
 *
 * 数据出处（不是估的）：`docs/GATE-SHIFTS.md` §十九「相邻档两两配对差」表 ——
 *   `tools/probe-diff-ladder.mjs --pairs=1 --games=1500`（逐局配对；`--pool=1` = 池装配，逐席抽一枚）。
 *   判"分得开"用 |差| ≥ 2σ(配对)；表里 se 就是那条 2σ 判据的分母，引用时不许换成"≥2pt"（2pt 在这把尺上只有 ≈1.5σ）。
 *
 * ⚠ 改这张表的唯一合法方式：重跑上面那条命令、把新读数贴进来、并同步 `sigOf(现表)` 的结果。
 *   手动改 σ 或改 `sep` 会被 `D227`④ 的自洽腿抓住（它比的是这两个字段彼此，不是某个具体数字）。
 */

/* 参数签名：把"这套阶梯到底由什么构成"写成一根字符串。
 * 池的**成员名册**不在签名里（名册一改就要重跑 1500 局 × 两模式，太贵），
 *   ⇒ 已知边界：只换池成员而不改档位参数时，这张账不会自动过期；那种情形的兜底是 ④ 的现场腿
 *   （量具活着 + 极端档仍分得开）与 `D234` 的池契约。要收紧就到需要收紧的那天，别提前加戏。 */
export function sigOf(tiers) {
  return (tiers || []).map(function (t) {
    return [t.id, t.kind, t.eps, t.epsK, t.epsMode, t.ramp ? 1 : 0, t.pool || '-', t.style || '-'].join(':');
  }).join(';');
}

/* 实测账（1500 局/档 · 逐局配对 · 表内 = 差 ±1σ） */
export const LADDER_CLAIM = {
  /* 与生成这份读数的档位参数逐字对应（`D227`④ 拿 `sigOf(Bots.DIFF_TIERS)` 现算来比这里）。
   * ⚠ 这串是**现算出来贴上的**，不是我手打的 —— 第一版手打时把 style 档的 `ramp` 写成了 `-`，
   *   而 `sigOf` 对未定义一律给 `0` ⇒ 差一个字符就是永久过期。手打派生值是这个仓最常犯的错之一。 */
  sig: 'lv:sparring:champ:1:40:uniform:0:low:-;lv:novice:champ:0.5:5:soft:0:low:-;lv:regular:champ:0.2:5:soft:1:mid:-;lv:hard:champ:0:5:soft:0:hard:-;lv:hunter:style::::0:-:st:combocounter',
  source: 'docs/GATE-SHIFTS.md §十九「相邻档两两配对差」‖ tools/probe-diff-ladder.mjs --pairs=1 --games=1500',
  rule: '判"分得开" = |差| ≥ 2σ(配对)（不是 ≥2pt）',
  measuredAt: '2026-10-12',
  modes: {
    'pool:multi': [
      { from: 'lv:hunter', to: 'lv:hard', d: 3.60, se: 1.16, sep: true },
      { from: 'lv:hard', to: 'lv:regular', d: 3.40, se: 1.29, sep: true },
      { from: 'lv:regular', to: 'lv:novice', d: 3.53, se: 1.37, sep: true },
      { from: 'lv:novice', to: 'lv:sparring', d: 41.87, se: 1.62, sep: true }
    ],
    'pool:long': [
      { from: 'lv:hunter', to: 'lv:hard', d: 5.13, se: 1.12, sep: true },
      { from: 'lv:hard', to: 'lv:regular', d: 6.20, se: 1.35, sep: true },
      { from: 'lv:regular', to: 'lv:novice', d: 2.67, se: 1.44, sep: false },   /* 1.9σ ⇒ 分不开，甲就是"这一步不许声称分得开" */
      { from: 'lv:novice', to: 'lv:sparring', d: 49.53, se: 1.59, sep: true }
    ],
    /* 四席同一枚包（池上线前的装配）：中间三步**全都**分不开 ⇒ 留着是为了"换池把阶梯修好了"这句话有对照 */
    'single:multi': [
      { from: 'lv:hunter', to: 'lv:hard', d: 1.27, se: 1.12, sep: false },
      { from: 'lv:hard', to: 'lv:regular', d: 0.20, se: 1.08, sep: false },
      { from: 'lv:regular', to: 'lv:novice', d: 1.87, se: 1.14, sep: false },
      { from: 'lv:novice', to: 'lv:sparring', d: 28.67, se: 1.56, sep: true }
    ]
  }
};
