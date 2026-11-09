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

/** 量一次防御质量（**装配与切窗也只该有一份**，故与三档判据同住本文件）。
 * 装配 = 攒钱者：seat0 永远出 ジ + 其余 N-1 席都是被评包（与 probe-wasted-play 的 banker 同形）。
 * ⛔ 不要拿 `aggressionProfile` 的场B 当宿主：那四席只出 ジ ⇒ **任何包白防率恒 100%**，判据在那张桌上没有分辨力
 *   （11-09 实测；场A 则四席脚本猛攻冠军 ⇒ 白防率恒低，同样不分人）。
 * ⚠ 四席同包 ⇒ 决策相关，"我防的回合没人来打我"可能只是"大家同时在防" ⇒ 本读数只配当**相对排序键**，
 *   不配当绝对合格线（绝对线要在页面装配上另量，见 scratch/qoder-1109-defq-caliber.mjs）。
 * 切窗照 probe-wasted-play:100-109：回合 R 的结算窗 = [max(ev0 of R), min(ev0 of R+1))。
 * opts = {games=40, seats=5, eps=0.1, epsk=5, epsmode='soft', temp=0.15, mode='multi', seed=5200, minHands=30}
 * 返回 counts + `q`/`whitePct` + `measurable`（手数 < minHands ⇒ false，调用方必须按"没量到"跳过，不许判过或判不过）。 */
export function measureDefenseQuality(W, params, opts) {
  const o = opts || {};
  const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
  if (!(R && R.byKey && R.CAT && S && T && Play)) return { err: '沙箱里读不到 Rules/State/Trainer/Play' };
  const G = o.games == null ? 40 : Number(o.games);
  const N = o.seats == null ? 5 : Number(o.seats);
  const SEED = o.seed == null ? 5200 : Number(o.seed);
  const EPS = o.eps == null ? 0.1 : Number(o.eps);
  const EK = o.epsk == null ? 5 : Number(o.epsk);
  const EM = o.epsmode || 'soft', TEMP = o.temp == null ? 0.15 : Number(o.temp), MODE = o.mode || 'multi';
  const MINH = o.minHands == null ? 30 : Number(o.minHands);
  const isDef = function (k) { const d = R.byKey[k]; return !!(d && d.cat === R.CAT.DEFENSE && d.target === 'self'); };
  const isCardHit = function (e, pid) { return e.type === 'damage' && e.to === pid && e.source != null && e.source !== pid && !!R.byKey[e.via]; };
  const out = { games: G, acts: 0, def: 0, eff: 0, part: 0, idle: 0, afterHit: 0, events: 0, defRounds: 0, defHit: 0, otherRounds: 0, otherHit: 0 };
  for (let g = 0; g < G; g++) {
    const st = S.createState(MODE, { next: T.mulberry32(SEED + g * 7919) }, N);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const DEC = [];
    const base = T.policyChooserN(params, TEMP, EPS, EK, EM);
    const ch = [function () { return { key: R.SK.JI }; }];
    for (let i = 1; i < N; i++) ch.push(function (s2, p2, lg) {
      const pick = base(s2, p2, lg);
      if (pick && pick.key) DEC.push({ rd: s2.round, pid: p2, key: pick.key, ev0: s2.events.length });
      return pick;
    });
    Play.autoGameN(st, ch);
    const ev = st.events || [];
    out.events += ev.length;
    const byRound = new Map();
    for (const d of DEC) { if (!byRound.has(d.rd)) byRound.set(d.rd, []); byRound.get(d.rd).push(d); }
    const rds = [...byRound.keys()].sort(function (a, b) { return a - b; });
    const winEnd = {};
    for (let i = 0; i < rds.length; i++) {
      winEnd[rds[i]] = i + 1 < rds.length ? Math.min.apply(null, byRound.get(rds[i + 1]).map(function (d) { return d.ev0; })) : ev.length;
    }
    const prevHit = {};
    for (const r of rds) {
      const w = ev.slice(Math.max.apply(null, byRound.get(r).map(function (d) { return d.ev0; })), winEnd[r]);
      for (const d of byRound.get(r)) {
        out.acts++;
        const hit = w.some(function (e) { return isCardHit(e, d.pid); });
        if (isDef(d.key)) {
          out.defRounds++; if (hit) out.defHit++;
          out.def++;
          if (prevHit[d.pid]) out.afterHit++;
          const kind = classifyDefenseWindow(w, R, d.pid);
          out[kind === 'eff' ? 'eff' : kind === 'part' ? 'part' : 'idle']++;
        } else { out.otherRounds++; if (hit) out.otherHit++; }
        prevHit[d.pid] = hit;
      }
    }
  }
  const q = defenseQuality(out);
  out.n = q.n; out.q = q.q; out.whitePct = q.idle; out.minHands = MINH;
  /* placebo 基线（在产探针同一条纪律）：白防率高有两种完全不同的原因 —— ① 它专挑没威胁的回合防（时机差，P1 要治的）
   *   ② 这张桌本来就没人互相打（读数无意义）。倍差 = 防的回合被招呼率 ÷ 没防的回合被招呼率：
   *   ≈1 ⇒ 属②，**不许**读成"防得没道理"；<1 ⇒ 确实往低威胁回合上防。调用方要把这一列一起印出来。 */
  const dh = out.defRounds ? out.defHit / out.defRounds : NaN;
  const oh = out.otherRounds ? out.otherHit / out.otherRounds : NaN;
  out.hitWhileDef = dh; out.hitWhenNotDef = oh;
  out.placeboRatio = (isFinite(dh) && isFinite(oh) && oh > 0) ? dh / oh : NaN;
  out.measurable = q.n >= MINH;
  out.cal = '攒钱者（seat0 永远 ジ + 其余 ' + (N - 1) + ' 席被评包）· ' + MODE + ' · ε=' + EPS + '/' + EM + ' k=' + EK +
    ' · temp ' + TEMP + ' · ' + G + ' 局 · seed ' + SEED + ' · 最小手数门 ' + MINH;
  if (!out.events) out.err = '整批 0 事件 ⇒ 仪器没接上，不许当"防得准"读';
  return out;
}

/** 记录栏的措辞（只记录不阻断 ⇒ 与 D155 那条同规矩：读不到就明说"没量到"） */
export function formatQualityRecord(q, meta) {
  if (!q || !q.n) return '   防御质量栏（用户 09-26 裁定：出防御那回合完全没人来打 = 白防；被穿透算半有效）**只记录不阻断**：' +
    '⚠️ 没量到（不许按 0 处理）' + (meta && meta.err ? ' ⇒ ' + meta.err : '');
  return '   防御质量栏（同上，**只记录不阻断**）：' + formatQuality(q) + ' · 装配=' + (meta && meta.asm ? meta.asm : '攒钱者（1 席 hold + 4 席被评）') +
    ' · 口径 ε=' + (meta && meta.eps != null ? meta.eps : '0.2') + '/' + (meta && meta.mode ? meta.mode : 'soft') + ' · 判定用的是**手次数**，不是占比';
}
