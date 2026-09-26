/* 防御质量判据的**单一来源**（v1.5.243 · 用户 09-26 裁定）
 *
 * 用户原话（裁定）：「设一下防御打空率的质量判断，也就是出防御的时候完全没人打他就算白防御了（被穿透算防御半有效）」
 * ⇒ 每一手防御按"那一回合有没有人来招呼我"分三档：
 *     有效   = 我的防御/反弹真的挡下了一次（事件里有 `blocked`/`reflect` 且 `to === 我`）
 *     半有效 = 有人用**一张卡**打到我身上（防了但被穿透/没挡住）⇒ 事件里 `damage.to === 我` 且 `source` 是另一个席、
 *              且 `via` 是一张**真卡**（`R.byKey[via]` 存在）
 *     白防   = 那一回合根本没有人朝我来
 *   ⇒ 质量分 = (有效 + 0.5 × 半有效) / 防御手数
 *
 * ⚠️ 三条会踩的口径（都写在实现里，别在调用点各写一遍）：
 *  1. **非攻击性掉血不算"有人打我"**：梦魇/铁索连环/挑衅违约/过载炮血债/地雷这些 `damage` 事件要么 `source` 为空、
 *     要么 `via` 不是一张卡 ⇒ 一律不算（`landByKey` 含非卡键算出过 44900% 份额是同族事故）。
 *  2. **一回合里既挡到又被穿透 ⇒ 记"有效"**（它确实挡下了东西），不重复计半有效。
 *  3. 反击伤害（金刚盾/藤甲的 `via:'counter'`）不算"有人打我"，但**防御成功**的证据是 `blocked`/`reflect`，与它无关。
 */

/** 一回合结算窗内的证据分类。events 只该含"本回合结算窗"那段（调用方负责切窗）。 */
export function classifyDefenseWindow(events, R, pid) {
  const byKey = (R && R.byKey) || {};
  let blocked = false, pierced = false;
  for (const e of events || []) {
    if (!e) continue;
    if (e.to !== pid) continue;
    if (e.type === 'blocked' || e.type === 'reflect') {
      // 挡下/弹回：`via` 是打过来的那张卡（可能是中文 reason ⇒ 只认成功这件事，不认卡名）
      blocked = true;
      continue;
    }
    if (e.type === 'damage') {
      if (e.source == null || e.source === pid) continue;      // 环境伤/自损：不算"有人朝我来"
      const via = e.via;
      if (!via || !byKey[via]) continue;                        // 梦魇/连环/违约/血债 ⇒ via 不是一张真卡，不算
      pierced = true;
    }
  }
  if (blocked) return 'eff';
  if (pierced) return 'part';
  return 'idle';
}

/** 计数 ⇒ 质量分（半有效记 0.5，这条常数**只在这里出现一次**） */
export function defenseQuality(st) {
  const n = (st.eff || 0) + (st.part || 0) + (st.idle || 0);
  if (!n) return { n: 0, q: NaN, eff: NaN, part: NaN, idle: NaN };
  return {
    n: n,
    q: (st.eff + 0.5 * st.part) / n,
    eff: 100 * st.eff / n, part: 100 * st.part / n, idle: 100 * st.idle / n
  };
}

/** 一行读数（探针与 promote 共用同一串措辞，免得两处各写一遍） */
export function formatQuality(q) {
  if (!q || !q.n) return '防御质量 —（没量到防御手）';
  const pc = (x) => isFinite(x) ? x.toFixed(1) + '%' : '—';
  return '防御质量 **' + (isFinite(q.q) ? (100 * q.q).toFixed(1) + '%' : '—') + '**' +
    '（有效 ' + pc(q.eff) + ' · 被穿透=半 ' + pc(q.part) + ' · **白防 ' + pc(q.idle) + '** · n=' + q.n + ' 手）';
}

/** 从探针输出里解析那一行（promote 的记录栏用；解析不到 ⇒ null，**不许当 0**） */
export function parseQuality(text) {
  const m = /防御质量 \*\*([\d.]+)%\*\*（有效 ([\d.]+)% · 被穿透=半 ([\d.]+)% · \*\*白防 ([\d.]+)%\*\* · n=(\d+) 手）/.exec(String(text || ''));
  if (!m) return null;
  return { q: Number(m[1]) / 100, eff: Number(m[2]), part: Number(m[3]), idle: Number(m[4]), n: Number(m[5]) };
}

/** 记录栏的措辞（只记录不阻断 ⇒ 与 D155 那条同规矩：读不到就明说"没量到"） */
export function formatQualityRecord(q, meta) {
  if (!q || !q.n) return '   防御质量栏（用户 09-26 裁定：出防御那回合完全没人来打 = 白防；被穿透算半有效）**只记录不阻断**：' +
    '⚠️ 没量到（不许按 0 处理）' + (meta && meta.err ? ' ⇒ ' + meta.err : '');
  return '   防御质量栏（同上，**只记录不阻断**）：' + formatQuality(q) + ' · 装配=' + (meta && meta.asm ? meta.asm : '攒钱者（1 席 hold + 4 席被评）') +
    ' · 口径 ε=' + (meta && meta.eps != null ? meta.eps : '0.2') + '/' + (meta && meta.mode ? meta.mode : 'soft') + ' · 判定用的是**手次数**，不是占比';
}
