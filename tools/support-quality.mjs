/* 辅助质量判据的**单一来源**（2026-10-18 · 待裁 #1 的第一版实现：**闸，不是奖励**）
 *
 * 用户原话（10-17 晚）：「辅助是一个很难以辨别的标准…标准定的太死结果 AI 就会对着刷分搞得可玩性反而降低了」
 * 用户原话（10-18）：「你可以试一下前两个吧」
 * ⇒ 所以这里**只做"无效就不计"**，**不产出任何正向加分**。与 `defense-quality.mjs` 的"白防"同一族判据：
 *   出辅助的那一刻，**目标到底有没有需要它** —— 没有 ⇒ 记 untimely（不值得付钱）。
 *
 * 口径（三条，只在这里写一次）：
 *  1. **timely** = 同一回合结算窗内，目标真的挨了打（`damage.to === target` 且 `source` 是别人、`via` 是真卡）。
 *     这是"时机对"的**可实现判据**（不需要外部状态表）：有人要打他，你给了盾。
 *  2. **untimely** = 窗内没有任何人来打这个目标 ⇒ 这一手辅助**不计**（与"白防"同义）。
 *  3. 非攻击性掉血（梦魇/铁索/违约/血债/地雷：`source` 空或 `via` 不是真卡）**不算"有人要他"** —— 与 defense-quality 第①条同源。
 *
 * ⚠ 已知边界（别当成没写）：
 *  - 这是**同回合**口径。"提前一回合给盾、下一回合才挨打"会被记成 untimely（Qoder §12.4 那条 14.2% 的"提前保护"）。
 *    要分开它得跨窗 ⇒ 需要调用方把两段窗拼起来交给 `classifySupportPair`（这里留了口子，但没实现跨回合拼接）。
 *  - "给对人"与"给对时机"是两个维度（Qoder 表①″：151 会挑时机不会给人）⇒ 本文件**只判时机**，对象维度不在这里判。
 */

/** 一回合结算窗内的证据分类。`events` 只该含"本回合结算窗"那段；`target` 是辅助的对象席。 */
export function classifySupportWindow(events, R, pid, target) {
  const byKey = (R && R.byKey) || {};
  let hitTarget = false;
  for (const e of events || []) {
    if (!e) continue;
    if (e.type !== 'damage') continue;
    if (e.to !== target) continue;
    if (e.source == null || e.source === target) continue;   // 环境伤 / 自损
    const via = e.via;
    if (!via || !byKey[via]) continue;                        // 非卡键（梦魇/连环/违约/血债/地雷）不算
    hitTarget = true;
  }
  return hitTarget ? 'timely' : 'untimely';
}

/** 计数 ⇒ 及时率（口径与 `defenseQuality` 同形：只比值，阈值不在这里定） */
export function supportQuality(st) {
  const n = (st.timely || 0) + (st.untimely || 0);
  if (!n) return { n: 0, q: NaN, timely: NaN, untimely: NaN };
  return {
    n: n,
    q: st.timely / n,
    timely: 100 * st.timely / n,
    untimely: 100 * st.untimely / n
  };
}

/** 一行读数（探针与 promote 共用同一串措辞，免得两处各写一遍） */
export function formatSupport(q) {
  if (!q || !q.n) return '辅助时机 —（没量到辅助手）';
  const pc = (x) => isFinite(x) ? x.toFixed(1) + '%' : '—';
  return '辅助时机 **' + (isFinite(q.q) ? (100 * q.q).toFixed(1) + '%' : '—') + '**' +
    '（时机对 ' + pc(q.timely) + ' · **时机错 ' + pc(q.untimely) + '** · n=' + q.n + ' 手）';
}

/** 从输出里解析那一行（读不到 ⇒ null，**不许当 0**） */
export function parseSupport(text) {
  const m = /辅助时机 \*\*([\d.]+)%\*\*（时机对 ([\d.]+)% · \*\*时机错 ([\d.]+)%\*\* · n=(\d+) 手）/.exec(String(text || ''));
  if (!m) return null;
  return { q: Number(m[1]) / 100, timely: Number(m[2]), untimely: Number(m[3]), n: Number(m[4]) };
}

/* ===== 自证（--self-test）：这条闸得先证明自己咬得住，再说它有用 ===== */
function selfTest() {
  let bad = 0;
  const ok = (c, msg) => { if (!c) { bad++; console.log('  ✘ ' + msg); } else console.log('  ✔ ' + msg); };
  const R = { byKey: { atk: 1, shield: 1 } };
  const seats = { p: 0, t: 1 };
  /* ① 时机对：窗内有真卡打向目标 */
  ok(classifySupportWindow([{ type: 'damage', to: 1, source: 0, via: 'atk', amt: 2 }], R, 0, 1) === 'timely',
    '① 窗内有真卡打向目标 ⇒ timely');
  /* ② 时机错：没人打他 */
  ok(classifySupportWindow([{ type: 'damage', to: 2, source: 0, via: 'atk', amt: 2 }], R, 0, 1) === 'untimely',
    '② 窗内没人打这个目标 ⇒ untimely');
  /* ③ 非卡键掉血不算"有人要他"（与 defense-quality 第①条同源） */
  ok(classifySupportWindow([{ type: 'damage', to: 1, source: null, via: '梦魇', amt: 1 }], R, 0, 1) === 'untimely',
    '③ 梦魇/环境伤不算"有人要他" ⇒ untimely');
  ok(classifySupportWindow([{ type: 'damage', to: 1, source: 0, via: '地雷', amt: 1 }], R, 0, 1) === 'untimely',
    '④ via 不是真卡（地雷）⇒ untimely');
  /* ⑤ 自损不算 */
  ok(classifySupportWindow([{ type: 'damage', to: 1, source: 1, via: 'atk', amt: 1 }], R, 0, 1) === 'untimely',
    '⑤ 目标自己打自己不算 ⇒ untimely');
  /* ⑥ 空窗 */
  ok(classifySupportWindow([], R, 0, 1) === 'untimely', '⑥ 空窗 ⇒ untimely（不许当 timely）');
  /* ⑦ 质量分与格式化/解析往返 */
  const q = supportQuality({ timely: 3, untimely: 1 });
  ok(Math.abs(q.q - 0.75) < 1e-12, '⑦ 及时率 3/4 = 75%');
  const p = parseSupport(formatSupport(q));
  ok(p && p.n === 4 && Math.abs(p.q - 0.75) < 1e-12, '⑧ format→parse 往返一致（n=4, q=0.75）');
  ok(parseSupport('garbage') === null, '⑨ 解析不到 ⇒ null（不许当 0）');
  ok(supportQuality({}).n === 0 && isNaN(supportQuality({}).q), '⑩ 零手 ⇒ NaN（不许当 100%）');
  console.log(bad ? '\n✘ 自检失败 ' + bad + ' 条' : '\n✔ 自检全过 10 条');
  return bad ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith('support-quality.mjs') && process.argv.includes('--self-test')) {
  process.exit(selfTest());
}
