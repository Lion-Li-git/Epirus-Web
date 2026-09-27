/* 出手形状的记录用读数（**只记录不阻断**）。
 *
 * 动因（用户 2026-09-27 看 Ldemo 实盘后原话）：「不过还是有一些**奇怪的公式打法**」，
 * 用户点名的两处 + 我在这 4 局实盘里数出来的形状（`results/Ldemo/*.txt`）：
 *   ① **同一目标死磕**：`玩家4→玩家5 ×5` · `玩家3→玩家5 ×4` · `玩家5→玩家2 ×3` · `玩家4→玩家3 ×3`；
 *   ② **ジ⇄枪 机械交替**：30 回合局玩家4 从第16~30回合几乎就是 `枪,ジ,枪,ジ,枪,ジ,ジ,激光剑…`
 *      （ジ 57% · 枪 6）——"够 1ep 就打枪、否则ジ"，没有跨回合计划。
 * ⚠️ **口径必须写清**（本仓"两处维护必漂移"的老病）：
 *   · `attackTargets`：只数**结算事件里带 `source` 的**那些（`damage`/`blocked`/`reflect`）⇒ 是"**落地/被挡的出手**"，
 *     `action` 事件本身**不带目标**（`js/core/state.js:195` 只记 `pid/key/outcome/reason`）⇒ 别去猜。
 *   · `actionKeys`：`action` 且 `outcome === 'ok'` 的按序 key（被拒的出手不算）。
 *   · 三条读数都**没有分母就返回 NaN**（不许给 0 —— 与 `defense-quality` 同规矩：
 *     "没量到"和"量到 0"是两件事，混起来就会把"样本不足"读成"行为很好"）。
 *
 * ⚠️ **"空防御"不在这里**：已有的口径是 `tools/defense-quality.mjs` 的 **白防**（用户 09-26 裁定：
 *   "那一回合根本没有人朝我来"）⇒ 不许在别处另立一套。本文件的"目标死磕/ジ⇄枪交替"是**另外两条**读数。
 *
 * ⚠️ **判据地位**：本文件只产出**记录**。要不要立成判据（阻断）是用户裁定的事 —— 见 `docs/RESEARCH-LOG-2026-09-27-ds.md`。
 */

/** 一席的"出手目标序列"：只取带 source 的结算事件 */
export function attackTargets(events, pid) {
  const out = [];
  for (const e of events || []) {
    if (!e || e.source !== pid) continue;
    if (e.type !== 'damage' && e.type !== 'blocked' && e.type !== 'reflect') continue;
    if (e.to == null) continue;
    out.push(e.to);
  }
  return out;
}

/** 目标死磕：最长连打同一目标、以及"与上一次同目标"的比例 */
export function targetFixation(targets) {
  const n = (targets || []).length;
  if (!n) return { n: 0, maxRun: NaN, sameRate: NaN };
  let maxRun = 1, run = 1, same = 0;
  for (let i = 1; i < n; i++) {
    if (targets[i] === targets[i - 1]) { run++; same++; } else run = 1;
    if (run > maxRun) maxRun = run;
  }
  return { n: n, maxRun: maxRun, sameRate: n > 1 ? same / (n - 1) : NaN };
}

/** 一席的出手序列（`outcome==='ok'` 的 action，按序） */
export function actionKeys(events, pid) {
  const out = [];
  for (const e of events || []) {
    if (!e || e.type !== 'action' || e.pid !== pid) continue;
    if (e.outcome !== 'ok') continue;
    out.push(e.key);
  }
  return out;
}

/** ジ⇄枪 机械交替 + 攒钱深度（连ジ段的平均长度） */
export function jiGunShape(keys, jiKey, gunKey) {
  const n = (keys || []).length;
  if (!n) return { n: 0, altRate: NaN, meanJiRun: NaN, jiShare: NaN };
  let ji = 0, alt = 0, pairs = 0, runs = 0, run = 0, runSum = 0;
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    if (k === jiKey) { ji++; run++; }
    else if (run > 0) { runs++; runSum += run; run = 0; }
    if (k !== gunKey && k !== jiKey) { /* 其它招不打断"机械交替"计数，只打断连ジ段 */ }
    if (i > 0) {
      const a = keys[i - 1], b = k;
      if ((a === jiKey && b === gunKey) || (a === gunKey && b === jiKey)) alt++;
      pairs++;
    }
  }
  if (run > 0) { runs++; runSum += run; }
  return {
    n: n,
    altRate: pairs ? alt / pairs : NaN,
    meanJiRun: runs ? runSum / runs : NaN,
    jiShare: ji / n
  };
}

/** 一行读数（探针与 promote 共用同一串措辞，免得两处各写一遍） */
export function formatShape(fx, jg) {
  const f = (x, d) => (isFinite(x) ? x.toFixed(d == null ? 2 : d) : '—');
  const t = fx && fx.n ? ('目标死磕 **最长 ' + fx.maxRun + ' 连** · 同目标率 ' + f(fx.sameRate, 2) + '（出手 ' + fx.n + ' 次）')
    : '目标死磕 —（没量到出手）';
  const j = jg && jg.n ? ('ジ⇄枪交替 **' + f(100 * jg.altRate, 1) + '%** · 连ジ段均长 ' + f(jg.meanJiRun, 2) +
    ' · ジ占比 ' + f(100 * jg.jiShare, 1) + '%（出手 ' + jg.n + ' 次）')
    : 'ジ⇄枪交替 —（没量到出手）';
  return t + ' · ' + j;
}

/** 解析回数字（供门/体检复用同一串措辞） */
export function parseShape(text) {
  const g = (re) => { const m = re.exec(String(text)); return m ? Number(m[1]) : NaN; };
  return {
    maxRun: g(/最长 ([\d.]+) 连/),
    sameRate: g(/同目标率 ([\d.]+)/),
    altRate: g(/ジ⇄枪交替 \*\*([\d.]+)%\*\*/) / 100
  };
}
