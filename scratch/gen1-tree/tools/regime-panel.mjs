/* ============================================================================
 * regime-panel.mjs —— "环境块"的单一来源（09-26 夜班 §E48 起）。
 *
 * 为什么单独一个文件：`probe-regime-fitness`（量具）与 `analyze-regime-scan`（判词）必须用
 * **同一份**"哪些原型算池内 / 哪些算池外"的定义。手抄第二份一旦出现，"池外地板"这个词
 * 在两个文件里就不是同一个量（METHODOLOGY 62/76 的同族事故）。
 *
 * ⚠️ **池内不在这份名单里，是运行时从 `server/opp-pool.mjs` 的函数引用算出来的。**
 *   第一版我手抄了一份"池内 10 类"，里面 `promis` 根本不存在 —— 训练池那个条目叫
 *   `protomine`，两者都指向 `pickProtoMine`。名字对不上却"取到了函数"（走了我自己的
 *   `pick`+Name 兜底路径）⇒ 一个真池内环境被标成"没见过的地形"，τ 的池内/池外两栏就错位了。
 *   OPP_SPECS 的文件头记录的正是同一族事故（"加名字漏一处"踩过三次），所以这里**不再抄名字**：
 *   判"在不在池里"= 判"这个函数引用在不在 OPP_SPECS 的函数引用集合里"。
 *
 * HELDOUT = **额外**要量的、不在训练池里的原型（`inPool=false` ⇒ 才配叫"没见过的地形"）。
 * ==========================================================================*/

/* 名字 -> EpirusBots 上的函数名。这些是"洞的形状"，不是训练池的副本。 */
export const HELDOUT = {
  gunspam: 'pickGunSpam', mine: 'pickMineSpam', aimdef: 'pickAimDefender',
  promis: 'pickProtoMine', focus: 'pickFocusFire', bigt: 'pickBigTChain',
  beadburst: 'pickBeadBurst', adaptive: 'pickAdaptive', strong: 'pickMultiStrong',
  protowall: 'pickProtoWall', reflectmix: 'pickReflectMix', defreflectgun: 'pickDefReflectGun',
  guardgun: 'pickGuardGun',
};

/**
 * 从 OPP_SPECS 构造"池内环境块"（名字用池里的真名，sel 用真函数引用）。
 * 返回 { pool, byFn } —— byFn: 函数引用 -> 池内条目，供 HELDOUT 一侧判"这个脚本其实已在池里"。
 */
export function poolFromSpecs(B, OPP_SPECS) {
  const pool = [];
  const byFn = new Map();
  for (const o of (OPP_SPECS || [])) {
    const sel = B && B[o.fn];
    if (typeof sel !== 'function') continue;                 // 池里点名了但脚本不存在 ⇒ 不参与（探针会另报）
    pool.push({ name: o.name, sel, inPool: true });
    if (!byFn.has(sel)) byFn.set(sel, o.name);
  }
  return { pool, byFn };
}

/** 把 HELDOUT 展开成环境块；同一个函数引用若已在池里出现，则**改名加 `[撞池]` 标记**而不是偷偷当池外。 */
export function heldFromNames(B, byFn, names) {
  const out = [];
  for (const nm of names) {
    const fnName = HELDOUT[nm];
    const sel = fnName && B && B[fnName];
    if (typeof sel !== 'function') continue;
    const clash = byFn && byFn.get(sel);
    out.push({ name: clash ? nm + '[撞池:' + clash + ']' : nm, sel, inPool: !!clash, aliasOf: fnName, clash: clash || null });
  }
  return out;
}
