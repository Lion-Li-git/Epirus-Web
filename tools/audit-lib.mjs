/* Epirus 冠军体检**指标库**（v1.5.18）—— `champ-audit.mjs`（打印表格）与
 * `promote-champion.mjs`（换冠军时的**阻断条件**）共用同一份实现。
 *
 * 为什么抽出来（第三方复核 §7-4(1)）：那套"打架活跃度"指标（B 伤害/局、C 盾/局与平局率、
 * E 被动场架势率、F 活跃场进攻率）此前只在 `champ-audit.mjs` 里**算完就打印**，
 * 而 `promote-champion.mjs` 要拿它当门槛就必须再写一遍 —— 那正是这个项目栽过四次的
 * "两处各写一遍"（v1.3.59/v1.4.8/v1.4.14/v1.5.2）。这里只有一份。
 *
 * 指标口径（都别改，改了历史读数就不可比）：
 *   · A 考卷：canonical 多人 3 血考卷 1st%（外部脚本对手；**可被"熬"骗**）
 *   · B 自对局（5 座同一冠军）：伤害/局、cost≥3 落地伤害/局、零伤害率、平局率、平均回合
 *   · C 病理：全息屏障施放/局（>2 ⇒ 互套盾风险）
 *   · D 反弹墙：长程 5 血 4 座纯反弹（`--mode=long --field=reflectwall`）
 *   · E 被动场架势率 / F 活跃场进攻率：0 号座固定为"只ジ"或"每回合进攻"，其余 4 座被测冠军
 *   · G 有效技能数：**非ジ** 成功出手分布的 `exp(熵)`（第三方复核 §7-4(1) 建议加的列）。
 *     ⚠️ **样本敏感**（v1.5.18 实测，同一个冠军 eco-34）：n5=3.08 / n10=2.99 / n20=4.24 / n40=4.54 /
 *     n80=4.21 / n160=4.21 —— 罕见技能没出现时熵被低估 ⇒ **要拿它当门槛就必须 n≥20**。
 *     `champ-audit` 默认 20 局、`promote-champion` 默认 20 局都是为这个（后者原先 10，已改）。
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CORE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/policy.js', 'js/train/bots.js', 'js/train/evo.js'];

export function sandbox(root) {
  const R = root || ROOT;
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
  sb.globalThis = sb;
  for (const f of CORE) vm.runInNewContext(readFileSync(join(R, f), 'utf8'), sb, { filename: f });
  return sb.window;
}

export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function loadChamp(W, file, root) {
  const src = readFileSync(join(root || ROOT, file), 'utf8');
  const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (!m) return null;
  /* v7：测量工具必须能读历史形状（v5/v6）——**保持原生形状**读取，不要嵌入：
   * 嵌入会把形状变成 v7，chooser 就切到候选口径，历史基线分复现不了。 */
  return W.EpirusPolicy.unpack(JSON.parse(m[1]), true);
}

/* A. 外部考卷（沿用 canonical eval-5p，默认 20 局） */
export function exam(file, extra, EXG, root) {
  const R = root || ROOT;
  const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', String(EXG), '5', '77000', file].concat(extra || []), { cwd: R, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /\[(?:冠军|消融[^\]]*)\]\s*1st=([\d.]+)%/.exec(out);
  const c3 = /cost>=3 出手占比=([\d.]+)%/.exec(out);
  const st = /严胜=([0-9.]+)%/.exec(out);
  const ti = /并列=([0-9.]+)%/.exec(out);
  return { first: m ? Number(m[1]) : null, cost3: c3 ? Number(c3[1]) : null,
    strict: st ? Number(st[1]) : null, tie: ti ? Number(ti[1]) : null };
}

/* B/C/G. 自对局：5 座同一冠军 */
export function selfPlay(W, params, mode, GAMES) {
  /* v7（v1.5.19）：改为**调用训练侧的单一真源**（`js/train/evo.js` 的 `mirrorHealth`）。
   * 为什么必须共用：训练侧现在用同一套指标做**换冠军的健康门槛**（G/平局/回合），
   * 两边各写一遍就会出现"门槛过了、体检不过"的常态（docs/METHODOLOGY.md 第 13 条）。
   * 返回字段与旧实现逐字一致（dmgPerGame/heavyPerGame/holoPerGame/zeroRate/drawRate/rounds/effSkills/distinctKeys）。 */
  return W.EpirusTrainer.mirrorHealth(params, GAMES || 20, 5, mode === 'long' ? 'long' : 'multi');
}

/* E/F：**对手活跃度**对冠军行为的影响（v1.5.14 加，起因是用户实测"集体防御"）。
 * 0 号座用"被动（只ジ）"或"活跃（每回合进攻）"的固定策略，其余 4 座都是被测冠军 ⇒ 量 AI 座的架势/进攻占比。 */
/* ===== E 新口径（v1.5.26，用户裁定）=====
 * 用户原话："有人攒 ji 而自己也攒并没有什么问题；当初是有人攒 ji，结果冠军就一直出防御类技能，感觉非常奇怪。
 * 并不是说不能出防御，特定情况下反而要出（比如看到对手攒到 5 ji 时防一下大雷），但总不能每回合都这样。"
 * ⇒ 旧口径（摆架势回合占比 > 85% 即判病）会**误伤合理防御**。新口径两条：
 *   ① `noThreatStanceRate`：**对手还没有威胁**（ep < 5，大雷门槛）的那些回合里，摆架势的占比；
 *   ② `maxRun`：**最长连续摆架势**回合数（"总不能每回合都这样"）。
 * 纯函数（入参是每回合每座位的出招记录 + 每回合的威胁标志），便于守门做行为断言。 */
export function stanceProfile(rows, threatByRound) {
  const bySeat = {};
  let noThreatTot = 0, noThreatStance = 0, maxRun = 0, stanceTot = 0;
  for (const r of rows) {
    const th = !!(threatByRound && threatByRound[r.round]);
    if (!th) { noThreatTot++; if (r.stance) noThreatStance++; }
    if (r.stance) stanceTot++;
    const st = bySeat[r.seat] || { run: 0, last: -2, max: 0 };
    if (r.stance) {
      st.run = (st.last === r.round - 1) ? st.run + 1 : 1;
      if (st.run > st.max) st.max = st.run;
    } else st.run = 0;
    st.last = r.round;
    bySeat[r.seat] = st;
    if (st.max > maxRun) maxRun = st.max;
  }
  /* `maxNoThreatRun`：**只在"无威胁"回合里**数连续摆架势 —— 实测 `maxRun`（不区分威胁）没有区分度：
   * 所有会打环的冠军后期都是 56~59 连摆，因为那时对手早就攒过 5 ジ（防大雷是**合理**的）。 */
  const bySeatN = {};
  let maxNoThreatRun = 0;
  for (const r of rows) {
    const th = !!(threatByRound && threatByRound[r.round]);
    const st = bySeatN[r.seat] || { run: 0, last: -2, max: 0 };
    if (r.stance && !th) {
      st.run = (st.last === r.round - 1) ? st.run + 1 : 1;
      if (st.run > st.max) st.max = st.run;
    } else if (!r.stance) st.run = 0;
    if (!th) st.last = r.round; else st.last = -2;   // 有威胁的回合会打断"无威胁连摆"
    bySeatN[r.seat] = st;
    if (st.max > maxNoThreatRun) maxNoThreatRun = st.max;
  }
  return {
    rounds: rows.length, maxRun: maxRun, maxNoThreatRun: maxNoThreatRun,
    noThreatRounds: noThreatTot,
    noThreatStanceRate: noThreatTot ? noThreatStance / noThreatTot : 0,
    stanceRate: rows.length ? stanceTot / rows.length : 0
  };
}


/* ===== v1.5.28（第三方复核 §3-1/§4-2b，用户裁定先做 1+2）：**反弹墙探针** =====
 * 与 champ-audit 的 D 列同口径（4 席 `reflectspam`、长程 5 血、每局轮座）。
 * 为什么必须单独测：v1.5.27 的冠军在**自对局**里激光剑命中 20 次（自对局根本测不出这个病），
 * 但在**反弹墙**里一枪未发 ⇒ D 列 85%→0%。门槛必须量在"墙"上，不能量在自对局上。 */
export function reflectWall(W, params, mode, GAMES) {
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, Bots = W.EpirusBots;
  const G = GAMES || 20, N = 5;
  const wall = Bots.pickReflectSpam;
  const pierceKeys = (R.skills || []).filter(function (sd) {
    const pp = sd.pierce || {};
    return !!(pp.reflect || pp.defense);
  }).map(function (sd) { return sd.key; });
  const landByKey = {};
  let dmg = 0, rounds = 0, zeroGames = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(7300 + g) }, N);
    const seat = g % N;                          // 轮座：每局冠军坐不同座位
    const ch = [];
    for (let pid = 0; pid < N; pid++) ch.push(pid === seat ? T.policyChooserN(params, 0.15) : wall);
    Play.autoGameN(st, ch);
    let gd = 0;
    for (const e of st.events) {
      if (e.type === 'damage' && e.source === seat && e.via) {
        dmg += e.amt; gd += e.amt;
        landByKey[e.via] = (landByKey[e.via] || 0) + 1;
      }
    }
    if (gd === 0) zeroGames++;
    rounds += st.round;
  }
  let pierceLand = 0;
  for (const k of pierceKeys) pierceLand += (landByKey[k] || 0);
  return {
    games: G, dmgPerGame: dmg / G, rounds: rounds / G, zeroDamageRate: zeroGames / G,
    landByKey: landByKey, pierceKeys: pierceKeys, pierceLand: pierceLand
  };
}

/* ===== v1.5.29：**环墙行为探针**（用户实测逼出来的）=====
 * 用户原话："实际上我用聚能环的时候原本的 v7press-36 也没有做任何动作打断我"。
 * 而 `--field=ringwall` 只报**胜率** ⇒ 85.5% 完全可能是靠"熬赢"而不是靠"打断"。
 * 这条探针量的是**行为**：面对 4 席 ringspam，冠军
 *   ① 打中开环者多少次（`damage` 且 `source === seat`）；
 *   ② 用了几次小雷（`action` 且 key === miniT，N6/R10 里唯一能直接打掉环的卡）；
 *   ③ 让开环者被作废了几次（`voided`）。
 * 「会打断」的判据 = ②>0 或 ①达到足够量级 —— 胜率高低不代表会打断。 */
export function ringWallProbe(W, params, mode, GAMES) {
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, Bots = W.EpirusBots;
  const G = GAMES || 20, N = 5;
  const wall = Bots.pickRingSpam || Bots.pickFarmer;
  let dmg = 0, miniT = 0, voided = 0, voidedByMe = 0, hitsByKey = {}, rounds = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(8100 + g) }, N);
    const seat = g % N;
    const ch = [];
    for (let pid = 0; pid < N; pid++) ch.push(pid === seat ? T.policyChooserN(params, 0.15) : wall);
    Play.autoGameN(st, ch);
    for (const e of st.events) {
      if (e.type === 'action' && e.pid === seat && e.outcome === 'ok' && e.key === R.SK.MINI_T) miniT++;
      if (e.type === 'damage' && e.source === seat) {
        dmg += e.amt || 0;
        if (e.via) hitsByKey[e.via] = (hitsByKey[e.via] || 0) + 1;
      }
      /* v1.5.38（复核 §5-5）：验收要看的第二栏 —— **由我造成的作废**（`byPid === 我`）。
       * 旧工具只数 `voided` 总数（含别人造成的），而 §5-1 修好后事件里才有 `byPid`。 */
      if (e.type === 'voided' && e.pid !== seat) voided++;
      if (e.type === 'voided' && e.byPid === seat) voidedByMe++;
    }
    rounds += st.round;
  }
  return { games: G, dmgPerGame: dmg / G, hitsByKey: hitsByKey, miniTCasts: miniT,
    voidedWallSeats: voided, voidedByMe: voidedByMe, rounds: rounds / G };
}

export function fieldRate(W, params, kind, mode, GAMES) {
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
  const G = GAMES || 10;
  const STANCE = [R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINGU, R.SK.PROTO];
  const ATK = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
  let stance = 0, atk = 0, tot = 0, rds = 0;
  let noThreatRounds = 0, noThreatStance = 0, maxRun = 0, maxNoThreatRun = 0, stanceRows = 0, rowTot = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(5100 + g) }, 5);
    const r = mulberry32(6100 + g);
    const human = (kind === 'active')
      ? function (state, pid, legal) {
        const a = legal.filter(function (x) { return x.affordable && ATK.indexOf(x.key) >= 0; });
        if (a.length) { const o = S.opponentsOf(state, pid); return { key: a[0].key, target: o[Math.floor(r() * o.length)] }; }
        return { key: R.SK.JI };
      }
      : function () { return { key: R.SK.JI }; };
    const ch = [human];
    for (let i = 1; i < 5; i++) ch.push(T.policyChooserN(params, 0.15));
    Play.autoGameN(st, ch);
    /* 重建回合：每回合每玩家最多一条 `action` 事件（`round` 字段不是所有事件都有，故不能用它）。
     * 威胁判据 = 该回合开始时**被动座位（pid 0）**的累计 ep ≥ 5（大雷门槛）—— 他只会出ジ，所以是单调增的。 */
    const rows = [], threat = {};
    let seen = {}, cur = -1, ep0 = 0, pending = [];
    const flush = function () { for (const q of pending) rows.push({ seat: q.seat, round: cur, stance: q.stance }); pending = []; };
    for (const e of st.events) {
      if (e.type === 'ep' && e.pid === 0 && e.delta > 0) ep0 += e.delta;
      if (e.type === 'action') {
        if (seen[e.pid] !== undefined) { flush(); seen = {}; cur++; }
        else if (cur < 0) cur = 0;
        seen[e.pid] = true;
        if (e.pid > 0 && e.outcome === 'ok') {
          tot++;
          const isStance = STANCE.indexOf(e.key) >= 0;
          if (isStance) stance++;
          else if (ATK.indexOf(e.key) >= 0) atk++;
          pending.push({ seat: e.pid, stance: isStance });
        }
      }
      threat[cur] = ep0 >= 5;
    }
    flush();
    const prof = stanceProfile(rows, threat);
    rowTot += prof.rounds; stanceRows += Math.round(prof.stanceRate * prof.rounds);
    noThreatRounds += prof.noThreatRounds;
    noThreatStance += Math.round(prof.noThreatStanceRate * prof.noThreatRounds);
    if (prof.maxRun > maxRun) maxRun = prof.maxRun;
    if (prof.maxNoThreatRun > maxNoThreatRun) maxNoThreatRun = prof.maxNoThreatRun;
    rds += st.round;
  }
  return {
    stance: tot ? stance / tot : 0, atk: tot ? atk / tot : 0, rounds: rds / G,
    /* v1.5.26 新增（E 新口径） */
    noThreatStanceRate: noThreatRounds ? noThreatStance / noThreatRounds : 0,
    maxStanceRun: maxRun, maxNoThreatRun: maxNoThreatRun, stanceRateRounds: rowTot ? stanceRows / rowTot : 0,
    noThreatRounds: noThreatRounds
  };
}

/* ===== v1.5.71（第五轮复核 §4-2）：**狙击场探针** =====
 * 病（复核 §3-1/§3-2）：池里没有任何对手会瞄人 ⇒ "狙击专精"在满分环境里像无解卡（v17-146 夺冠 30%），
 * 而给它加上一条"谁用狙击就瞄谁"的规则后立刻 0% ⇒ 那**不是强卡，是没人瞄人**。
 * 判据必须是**行为**：冠军会不会把攻击用在"真正的威胁"身上。
 *
 * ⚠️ 判别力（这是我上一轮 `ringWallProbe` 犯过的错，先写清楚）：**4 席全是狙击手时**
 * "命中狙击手的比例"恒等于 ~1（**没有任何判别力**）。所以默认场是**混合场**：
 *   `mixed`（默认）= 1 席狙击 + 3 席被动（只攒不还手）⇒ 冠军的落地攻击里命中狙击手的比例
 *   在"均匀乱打"下期望 **25%**，判据才分得出"会瞄"（≥40%）与"不会瞄"。
 *   `wall` = 4 席狙击 ⇒ 只量**生存/胜率**（4 打 1 极难，别拿胜率当靶向判据）。
 *
 * ⚠️ 口径与限制（不许含糊）：`action` 事件**不带目标**（state.js:156 只有 pid/key/outcome），
 * "指向谁"只能按伤害事件（`damage.to` + `damage.source`）归因 ⇒ 只统计**命中**的，被挡掉/被无效的
 * 尝试不计 ⇒ 这是**下界**（真实瞄准率 ≥ 它）。归因字段是 `source`（**不是** `from`，曾猜错）。
 * 命名同 `reflectWall`/`ringWallProbe`：探针只报数，阈值由调用方定（**先量基线**）。 */
export function attackAttribution(events, seat) {
  const byTarget = {}, byTargetDmg = {}; let total = 0, dmg = 0;
  for (const e of (events || [])) {
    if (e.type !== 'damage') continue;
    if (e.source !== seat) continue;
    if (!e.via) continue;              // 无 via = 非技能伤害（梦魇/挑衅违约）⇒ 不算"出手瞄准"
    total++; dmg += (e.amt || 0);
    byTarget[e.to] = (byTarget[e.to] || 0) + 1;
    byTargetDmg[e.to] = (byTargetDmg[e.to] || 0) + (e.amt || 0);
  }
  return { total: total, dmg: dmg, byTarget: byTarget, byTargetDmg: byTargetDmg, targets: Object.keys(byTarget).length };
}
export function sniperField(W, params, mode, GAMES, kind) {
  const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, Bots = W.EpirusBots;
  const G = GAMES || 20, N = 5;
  const sniper = Bots.pickSnipeSpam, passive = Bots.pickFarmer;
  const K = (kind === 'wall') ? 'wall' : 'mixed';
  let hitsOnSniper = 0, hitsOnOthers = 0, attacks = 0, dmgToSniper = 0, takenFromSniper = 0, dealt = 0;
  let alive = 0, wins = 0, rounds = 0;
  const spreadHist = {};
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(9100 + g) }, N);
    const seat = g % N;                                  // 冠军座位逐局轮换
    const sn = (g + 2) % N;                              // 混合场的狙击席 ≠ 冠军席（也逐局轮换）
    const isSn = function (pid) { return (K === 'wall') ? (pid !== seat) : (pid === sn); };
    const ch = [];
    for (let pid = 0; pid < N; pid++) {
      ch.push(pid === seat ? T.policyChooserN(params, 0.15) : (isSn(pid) ? sniper : passive));
    }
    Play.autoGameN(st, ch);
    const a = attackAttribution(st.events, seat);
    attacks += a.total; dealt += a.dmg;
    spreadHist[a.targets] = (spreadHist[a.targets] || 0) + 1;
    for (const k in a.byTarget) {
      const to = Number(k);
      if (to === seat) continue;                         // 自伤（电磁炮/自损）不计
      if (isSn(to)) { hitsOnSniper += a.byTarget[k]; dmgToSniper += (a.byTargetDmg[k] || 0); }
      else hitsOnOthers += a.byTarget[k];
    }
    /* 从狙击席承受的伤害（`source` 同源归因；wall 场"狙击席"= 除冠军外全部，逐席拆分无意义） */
    if (K === 'mixed') {
      for (const e of st.events) {
        if (e.type === 'damage' && e.source === sn && e.to === seat && e.via) takenFromSniper += (e.amt || 0);
      }
    }
    if (st.p[seat].hp > 0) alive++;
    if (st.winner === seat) wins++;
    rounds += st.round;
  }
  const aimed = hitsOnSniper + hitsOnOthers;
  return {
    kind: K, games: G, attacksTotal: attacks,
    /* ⚠️ v1.5.71 标定结果（40 局/包，见 CHANGELOG v1.5.71 §6）：**靶向率分不开好坏**——
     * 种子冠军 45.3%、eco-34 47.7%、线上包 43.8%，全都高于"均匀 25%" ⇒ 复核建议的"≥20%"判据无效。
     * 真正分开的是**低压力场里的出手量/伤害/目标多样性**：
     *   种子 2.73 伤害/局、打过 2~4 人；线上 0.47/局、37/60 局只打过 1 个人。 */
    hitsOnSniper: hitsOnSniper, hitsOnOthers: hitsOnOthers,
    aimedAtSniperRate: aimed ? hitsOnSniper / aimed : null,
    uniformRate: (K === 'mixed') ? 0.25 : null,
    dmgPerGame: dealt / G,                        // ★ 真正的判据候选①（低压力场自身伤害/局）
    attacksPerGame: attacks / G,
    spreadAvg: (function () {                     // ★ 判据候选②：平均打过几个不同的人
      let s = 0; for (const k in spreadHist) s += Number(k) * spreadHist[k];
      return G ? s / G : 0;
    })(),
    dmgToSniperPerGame: dmgToSniper / G,
    takenFromSniperPerGame: (K === 'mixed' ? takenFromSniper / G : null),
    targetSpreadHist: spreadHist,
    survivalRate: alive / G, winRate: wins / G, rounds: rounds / G
  };
}

/* 座位对称性探针（v1.5.57，第五轮复核 §6 建议）。
 * 5 席同一策略、每局带盐 ⇒ 量"某个座位是否系统性占便宜"。**口径一律用百分点**：
 * 2026-09-15 我自己曾把"胜场数差"当成"百分点差"报出去（判据写成 18pt），据此得出
 * "多数候选已修好"的错误结论 —— 这条探针把单位钉死在百分点上，防止再犯。
 * 判据（复核 §6 的"比值 + 前置条件"思路）：
 *   ① 前置：分出胜负的局 ≥ 30%（否则"各座≈0%"没有含义，如某候选 93% 平局时"极差 3pt"是空读数）；
 *   ② 判偏 = **占比判据**（某座 ≥70%，对称假设下 ~0.2%，任意 n 稳健）**或** 大样本极差（n ≥ 50 且 ≥30pt）。
 * ⚠️ v1.5.71（第五轮复核 §2-3 的样本量表）：**极差判据在 n<50 时会被噪声打红** ——
 * 对称假设下 5 席胜率极差（均值/p90/p99）：n=6 → 41/50/67pt · n=20 → 23/35/45pt ·
 * n=30 → 19/27/37pt · n=50 → 15/22/28pt · n=100 → 10/16/20pt。
 * ⇒ n=30 配 30pt 阈值仍有 5~8% 假红，n=6 配 30pt 约一半时间假红（= 用噪声当判据）。
 * 小样本时返回 **'underpowered'（不知道）**，绝不能被读成"均衡"。 */
const MIN_N_SPREAD = 50;    // 极差判据的最小局数（v1.5.71）
const SHARE_BIAS = 70;      // 占比判据：某座 ≥70% 通吃（v1.5.71，v1.5.69 的惩罚触发已用同值）
export function seatSymmetry(W, params, mode, GAMES) {
  const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
  const G = GAMES || 100;
  const win = [0, 0, 0, 0, 0];
  let dec = 0, draw = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(12000 + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const base = T.policyChooserN(params, 0.15);
    Play.autoGameN(st, [base, base, base, base, base]);
    if (st.winner === 'draw' || st.winner == null) { draw++; continue; }
    win[st.winner]++; dec++;
  }
  const pct = win.map(function (w) { return 100 * w / Math.max(1, dec); });
  const maxPct = Math.max.apply(null, pct), minPct = Math.min.apply(null, pct);
  const decisiveRate = dec / G;
  const spread = maxPct - minPct;
  let verdict, basis;
  if (decisiveRate < 0.3) { verdict = 'unjudgeable'; basis = '判胜<30%'; }
  else if (maxPct >= SHARE_BIAS) { verdict = 'biased'; basis = '某座≥' + SHARE_BIAS + '%'; }
  else if (G < MIN_N_SPREAD) { verdict = 'underpowered'; basis = 'n=' + G + '<' + MIN_N_SPREAD + '（极差判据在此局数会被噪声打红）'; }
  else if (spread >= 30) { verdict = 'biased'; basis = '极差≥30pt(n≥' + MIN_N_SPREAD + ')'; }
  else { verdict = 'ok'; basis = 'ok'; }
  return {
    pct: pct, win: win, decisive: dec, draw: draw, drawRate: draw / G, decisiveRate: decisiveRate, games: G,
    spread: spread, maxPct: maxPct, minPct: minPct,
    ratio: minPct > 0 ? maxPct / minPct : null,
    verdict: verdict, basis: basis, minNForSpread: MIN_N_SPREAD, shareBias: SHARE_BIAS
  };
}

/* ===== 五道上线门槛的**单一真源**（v1.5.71；派生于 v1.5.67 的落盘处判定 + 第五轮复核 §4-6）=====
 * 病：训练落盘（server/train-server.mjs）与出厂换包（tools/promote-champion.mjs）各写一份阈值 ⇒
 * 两头会漂。实测线上包的 meta 里**没有 feasibility 字段** —— 因为它是经 tools/upgrade-pack.mjs
 * 换回来的、绕过了落盘那一步 ⇒ 判定与记录都收进这个纯函数，两头都调它。
 * ⚠️ 场 B 的判据**只能是清场数**（`fieldB.clearedPerGame`），**绝不能用胜率**：
 * v1.5.65 给 multi 加了终局收缩 + 全灭按累计伤害判胜 ⇒ "打 1 点就赢"：线上包场 B 严格胜率 100%
 * 而清场 0.00/局、伤害 1.0/局 ⇒ 用胜率当门槛等于白送（第五轮复核 §2-1）。
 * 用法：feasibilityOf({ seat, G, wall, aggr }) —— 参数即四个探针的返回值（纯函数，可单测）。 */
const _n = function (x, d) { return (isFinite(x) ? Number(Number(x).toFixed(d === undefined ? 2 : d)) : null); };
/* v1.5.90：第 6 道判据（输出密度 / 经济出口）**是否阻断**。
 * 现在**必须**是 `false` —— 理由见 `feasibilityOf` 里那段长注释：
 * 在位的线上包自己就过不了这道（花珠率 0% = 未闭环）⇒ 它现在不具备"阻断"的资格
 * （本仓库规矩：阈值必须先能分开已知好与已知坏，附录 B2-6 / C-4）。
 * 等真有候选过了它，把它改成 `true` 并补一条守门断言（那时"已知好"一侧才存在）。 */
/* v1.5.90 建、v1.5.94 复核过**不翻**：第 6 道（珠经济**闭环**）是否阻断。
 * ⚠️ 第九轮复核 §6 说"有已知好一侧了 ⇒ 可以阻断"。**我部分不采纳，理由必须写清楚**：
 *   ① 复核点名的那个"密度门"是 **`只枪(打最肥)` 那一格**，而它**早在 v1.5.78 就已经是阻断项**
 *      （`promote-champion` 调 `gate-drafts` 的 G4，**阈值 v1.5.104 起为 60%**（用户裁定；原 45% 是现役包
 *        都达不到的线 —— 补入"只枪"格后线上包自己 65%），标定包 = `v7f3-94` 的 **5%/5%**）——
 *      也就是说**它已经是闸**，不需要在这里再翻一次。
 *   ② 本常量管的是**另一件事**：珠经济闭环（得珠>0 且 花掉>0）。它确实有两个包过（`v7divK2b-82` 11%、
 *      `v7densE-31` 69%），但**两个都是废包**（前者场B 清场 0.28<0.3，后者是退化臂产物）⇒
 *      拿它阻断 = 连在位包一起挡死，且**没有任何可上线候选受益**。这与 v1.5.78 保留 G6 非阻断是同一条理由。
 * ⇒ 保持 `false`。翻转条件不变：**等真有一个可上线候选过了它**。 */
export const DENSITY_BLOCK = false;

export function feasibilityOf(o) {
  const s = (o && o.seat) || {}, g = (o && o.G) || {}, w = (o && o.wall) || {}, a = (o && o.aggr) || {};
  const fA = a.fieldA || {}, fB = a.fieldB || {};
  const fails = [], notes = [];
  /* 探针缺失必须**响亮**（不许静默通过、也不许静默判死）。
   * 这个坑是本函数自己的第一个 bug：`!(dmgPerGame > 0.5)` 在探针缺失时 `NaN > 0.5` = false
   * ⇒ 反向比较把"没跑探针"读成"墙瘫了"（假红）；而正向比较又会静默读成"过了"（假绿）。
   * ⇒ 先判定值是否存在，再比较。 */
  const miss = [];
  if (!isFinite(g.effSkills)) miss.push('G');
  if (!isFinite(w.dmgPerGame)) miss.push('反弹墙');
  if (!isFinite(fA.atk)) miss.push('场A');
  if (!isFinite(fB.clearedPerGame)) miss.push('场B');
  if (!s.verdict) miss.push('座位');
  if (miss.length) fails.push('探针缺失/无值：' + miss.join('、') + '（无法判定 ⇒ 视为未过，先修探针）');
  if (s.verdict === 'biased') {
    fails.push('座位偏座（' + (s.basis || '') + '）：' +
      (s.pct || []).map(function (x) { return Number(x).toFixed(0) + '%'; }).join('/'));
  }
  if (s.verdict === 'underpowered') notes.push('座位探针 ' + (s.basis || 'underpowered') + ' ⇒ **未判定**（不等于均衡）');
  if (s.verdict === 'unjudgeable') notes.push('座位探针不可判（' + (s.basis || '') + '）—— 别当"均衡"');
  if (!miss.length) {
    if (Number(g.effSkills) < 3) fails.push('G ' + Number(g.effSkills).toFixed(2) + ' < 3');
    if (Number(w.dmgPerGame) <= 0.5) fails.push('反弹墙伤害 ' + Number(w.dmgPerGame).toFixed(2) + ' ≤ 0.5/局');
    if (Number(fA.atk) < 0.20) fails.push('场A 还手 ' + (100 * Number(fA.atk)).toFixed(0) + '% < 20%');
    if (Number(fB.clearedPerGame) < 0.3) fails.push('场B 清场 ' + Number(fB.clearedPerGame).toFixed(2) + ' < 0.3/局');
  }
  /* ===== v1.5.90（第八轮复核 §8-3/§8-4）：第 6 道判据 = **输出密度 / 经济出口** =====
   * 口径：① 珠经济**双向闭环**（得珠 > 0 且 **花掉** > 0 —— 单向"浪费率低"会被"把行为删掉"刷绿，
   *   这是 v1.5.78 §1-3 的教训）；② 每回合出手伤害 / 按ジ占比（见 `densityProfile`，只打印对照）。
   * **为什么现在只记录、不阻断**（这条是设计决定，不是偷懒）：按本仓库自己的规矩，
   * 阈值必须先能分开"已知好"与"已知坏"。而这一个 —— 在位的线上包自己就是**未闭环**（花珠率 0%，
   * 第八轮复核 §6/§7 同口径）⇒ 拿它当阻断会把**所有候选一起挡死**（与 G6 靶向率当时的处境一模一样）。
   * 用法：进 `notes` + 进返回值（落盘 meta / 体检都能查）；等真有一个候选过了它再翻 `DENSITY_BLOCK`。 */
  const dens = (o && o.density) || {};
  const dRec = {};
  if (isFinite(dens.dmgPerRound)) dRec.dmgPerRound = _n(dens.dmgPerRound, 3);
  if (isFinite(dens.jiShare)) dRec.jiShare = _n(dens.jiShare, 3);
  if (isFinite(dens.gained)) dRec.beadGained = _n(dens.gained, 0);
  if (isFinite(dens.spentRate)) dRec.beadSpentRate = _n(dens.spentRate, 3);
  if (isFinite(dens.expiredPerGame)) dRec.beadExpiredPerGame = _n(dens.expiredPerGame, 2);
  /* ===== v1.5.101（第十轮复核 §4-2）：**布尔判据会被"最小非零"刷分** =====
   * 复核实测：候选② `v7wall1-93` 得珠 835 / **花掉 1**（花/得 **0.12%**）就点亮了"闭环 ✓"，
   * 而它每局浪费 **20.9** 颗（≈在位包的 250 倍）⇒ 这是**第七轮 §11 陷阱的镜像**
   * （当时是"干脆不用 ⇒ 浪费率 0% ⇒ 绿"，现在是"象征性花一颗 ⇒ 闭环 ⇒ 绿"）。
   * ⇒ 改成**双条件**：① **花/得 ≥ 20%**（真的在用，不是象征性用一下）
   *                ② **过期/局 ≤ 1**（不是靠"攒了全烂掉"换来的 ①）。
   * ⚠️ 这条仍然**只记录不阻断**（`DENSITY_BLOCK`）：收紧后连在位包也不达标，翻闸会把所有候选挡死。 */
  dRec.beadLoopClosed = (isFinite(dens.gained) && isFinite(dens.spentRate) && isFinite(dens.expiredPerGame))
    ? (Number(dens.gained) > 0 && Number(dens.spentRate) >= 0.2 && Number(dens.expiredPerGame) <= 1) : null;
  dRec.blocking = DENSITY_BLOCK;
  /* ===== v1.5.94（第九轮复核 §5-1）：**退化包**必须挡下来 =====
   * 复核实测：`roleC2-31` / `ctrlE-31` 自对局**一次攻击都不出**（0.00 攻/回合、104 回合、0 胜、`G=1.00`），
   * 可 **A 考卷照样给 46.8~47.1%**（入口是"并列判胜也计入 1st"）⇒ A 会给"沉默"高分，
   * 这是比"窄"更严重的口径漏洞。
   * 判据：自对局里**从未出过带 `dmg` 的卡**的局占比 ≥ 90% ⇒ 判负。
   * **可阻断的依据**（本仓库规矩：阈值必须已能分开已知好与已知坏）：退化包 = **1.00**，在位包与其余全部产包 = **0.00**。 */
  if (isFinite(dens.zeroAtkRate)) {
    dRec.zeroAtkRate = _n(dens.zeroAtkRate, 3);
    dRec.zeroDealtRate = _n(dens.zeroDealtRate, 3);
    if (Number(dens.zeroAtkRate) >= 0.9) {
      fails.push('自对局零攻击局 ' + (100 * Number(dens.zeroAtkRate)).toFixed(0) + '% ≥ 90%（退化包：从不出手）');
    }
  }
  if (dRec.beadLoopClosed === null) notes.push('第6道（输出密度/经济出口）**探针缺失** ⇒ 未判定（不等于过）');
  else if (dRec.beadLoopClosed) notes.push('第6道（输出密度/经济出口）：珠经济**闭环** ✓（得珠 ' +
    dRec.beadGained + '、花珠率 ' + dRec.beadSpentRate + '，每回合出手伤害 ' + dRec.dmgPerRound +
    '、按ジ占比 ' + dRec.jiShare + '）⇒ "经济动作有出口"的第一个形态（**目前只记录不阻断**）');
  else notes.push('第6道（输出密度/经济出口）：珠经济**未闭环**（花珠率 ' + dRec.beadSpentRate +
    '，按ジ占比 ' + dRec.jiShare + '）⇒ 记录不阻断 —— 连线上包都没过它（所以它现在没有判别力）');
  return {
    ok: fails.length === 0, fails: fails, notes: notes,
    density: dRec,
    seatSpread: _n(s.spread, 1), seatDecisive: _n(s.decisiveRate), seatVerdict: s.verdict || '?', seatBasis: s.basis || '',
    seatPct: (s.pct || []).map(function (x) { return _n(x, 1); }),
    G: _n(g.effSkills), Gkeys: (g.distinctKeys === undefined ? null : g.distinctKeys),
    wallDmg: _n(w.dmgPerGame), wallPierce: (w.pierceLand === undefined ? null : w.pierceLand),
    fieldA: _n(fA.atk, 3), fieldADealt: _n(fA.dealtPerGame),
    fieldBClears: _n(fB.clearedPerGame),
    /* 仅供参考、**永不参与判定**：规则红利下的严格胜率（复核 §2-1） */
    fieldBWinRate: _n(fB.winRate, 3)
  };
}

/* 输出密度 / 经济出口探针（v1.5.90，第八轮复核 §6 的"命门"机械化）。
 * 复核的结论：冠军输给"一行代码的最便宜枪"，**不是**目标一致性问题，而是
 * ① **overkill 浪费** ② **输出密度** —— 它 57~65% 的回合在按 ジ，而 ep 峰值只有 2
 * ⇒ "交 tempo 税去攒一种永远花不掉的东西"。本函数把这条病变成可比的数：
 *   `dmgPerRound` = 自己造成的伤害 / 对局回合数（= "每回合平均出手伤害"）
 *   `jiShare`     = 按 ジ 的出手 / 全部成功出手（= "按ジ占比"）
 *   `atkShare`    = 属于**数据驱动伤害卡**的出手占比（与 `aggressionProfile` 同口径）
 * 口径与 `chargeProfile` 一致：5 席同一包自对局、每局固定盐、回合数取自 `st.round`；
 * 伤害归因用事件真字段 **`source`**（`{type:'damage', source, to, amt, via}` —— **不猜字段**，
 * 这一族坑本仓库踩过多次，`from` 是错的）。 */
export function densityProfile(W, params, mode, GAMES) {
  const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay, R = W.EpirusRules;
  const G = GAMES || 20;
  const isDmg = function (k) { const d = R.byKey[k]; return !!(d && d.dmg && d.dmg.amt); };
  let acts = 0, ji = 0, dmgActs = 0, dealt = 0, rounds = 0, games = 0;
  let atkGames = 0, dealtGames = 0;   // v1.5.94：按**局**统计"这一局出过手没有"（第九轮复核 §5-1）
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(17000 + g) }, 5);
    st.slotSalt = (Math.imul(g + 2, 0x85ebca6b) ^ 0x27d4eb2f) >>> 0;
    const base = T.policyChooserN(params, 0.15);
    Play.autoGameN(st, [base, base, base, base, base]);
    games++; rounds += st.round;
    let gAtk = 0, gDealt = 0;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok') {
        acts++;
        if (e.key === R.SK.JI) ji++;
        if (isDmg(e.key)) { dmgActs++; gAtk++; }
      } else if (e.type === 'damage' && e.source != null) {
        dealt += e.amt;   // source==null 的伤害是终局收缩（不可归因）⇒ 不计
        gDealt += e.amt;
      }
    }
    if (gAtk > 0) atkGames++;
    if (gDealt > 0) dealtGames++;
  }
  return {
    games: games, rounds: rounds, roundsPerGame: rounds / Math.max(1, games),
    actsPerGame: acts / Math.max(1, games), acts: acts, dmgActs: dmgActs,
    atkActsPerRound: rounds ? dmgActs / rounds : 0,
    /* v1.5.94（第九轮复核 §5-1）——**零出手率与零伤害率必须分两列**：
     * 前者量"这一局有没有出过带 `dmg` 的卡"，后者量"这一局有没有造成伤害"。
     * 只量伤害会漏掉"完全不出手"的包（复核指出这正是 `零伤害率` 一直显示 0% 的原因）。 */
    zeroAtkRate: games ? (games - atkGames) / games : 0,
    zeroDealtRate: games ? (games - dealtGames) / games : 0,
    dmgPerRound: rounds ? dealt / rounds : 0, dealtPerGame: dealt / Math.max(1, games),
    jiShare: acts ? ji / acts : 0, atkShare: acts ? dmgActs / acts : 0
  };
}
/* 蓄能空转探针（v1.5.58，起因：用户实测"蓄能 34 次、电磁炮仅 4 次、第 6 回合三颗全过期"）。
 * 事件是现成的真源（**不猜字段**，先打印过）：
 *   {type:'action', pid, key:'charge', outcome:'ok'}  蓄能出手
 *   {type:'bead', pid, kind:'elec'|'boom', delta:±1}  得珠/耗珠
 *   {type:'beadExpire', ...}                          珠过期
 * ⇒ wasteRate = 过期珠 / 得珠 ⇒ "蓄能来的珠有多少白攒了"。 */
export function chargeProfile(W, params, mode, GAMES) {
  const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay, R = W.EpirusRules;
  const G = GAMES || 20;
  let charges = 0, gained = 0, expired = 0, spent = 0, games = 0, rounds = 0;
  const bySeat = [0, 0, 0, 0, 0];
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(13000 + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const base = T.policyChooserN(params, 0.15);
    Play.autoGameN(st, [base, base, base, base, base]);
    games++; rounds += st.round;
    for (const e of st.events) {
      if (e.type === 'action' && e.key === R.SK.CHARGE && e.outcome === 'ok') {
        charges++; if (typeof e.pid === 'number' && bySeat[e.pid] != null) bySeat[e.pid]++;
      } else if (e.type === 'bead') {
        if (e.delta > 0) gained += e.delta; else spent += Math.abs(e.delta);
      } else if (e.type === 'beadExpire') {
        expired += (e.delta != null ? Math.abs(e.delta) : 1);
      }
    }
  }
  return {
    games: games, charges: charges, chargesPerGame: charges / Math.max(1, games),
    gained: gained, spent: spent, expired: expired,
    wasteRate: gained ? expired / gained : 0, spentRate: gained ? spent / gained : 0,
    roundsPerGame: rounds / Math.max(1, games), bySeat: bySeat
  };
}

/* 侵略性双场探针（v1.5.62，用户裁定：**F 改用场 A**）。
 * 旧 F（fieldRate）的考核依据有两处结构问题（代码证据见 CHANGELOG v1.5.61）：
 *   ① "活跃场"里只有 1 席脚本进攻者，其余 4 席是**冠军自己的副本** ⇒ 量到的是自对局均衡；
 *   ② 分子是硬编码 6 张卡名单（数据驱动看 bigT/dualGun 也带 dmg，未涵盖）。
 * 本函数是**单一真源**（体检 / 筛选器 / 独立探针都调它），两个对置场：
 *   场 A `aggr`（被集火）：4 席脚本猛攻 vs 1 席冠军 ⇒ 冠军的**还手率 + 造成/承受伤害/局 + 胜负**；
 *   场 B `calm`（无压）  ：4 席只ジ   vs 1 席冠军 ⇒ 冠军面对纯攒钱者会不会主动打。
 * 细节：冠军座位**逐局轮换**（g % 5，避免座位相位污染）；伤害归因用事件真字段 **`source`**
 * （打印确认过：`{type:'damage', to, amt, via, source}`；早前猜 `from` 得 0 是错的）。
 * 口径：`atk` = 冠军成功出手里属于**数据驱动伤害卡**（`R.byKey[key].dmg` 存在）的占比。 */
export function aggressionProfile(W, params, GAMES) {
  const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
  const G = GAMES || 40;
  const OLD = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
  const isDmg = function (k) { const d = R.byKey[k]; return !!(d && d.dmg && d.dmg.amt); };
  function run(kind) {
    let atkOld = 0, atkNew = 0, acts = 0, dealt = 0, taken = 0, takenOpp = 0, wins = 0, draws = 0, rounds = 0, oppAtk = 0, cleared = 0;
    for (let g = 0; g < G; g++) {
      const me = g % 5;
      const st = S.createState('multi', { next: mulberry32(15000 + g) }, 5);
      st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
      const r = mulberry32(20000 + g);
      const scripted = (kind === 'aggr')
        ? function (state, pid, legal) {
          const a = legal.filter(function (x) { return x.affordable && OLD.indexOf(x.key) >= 0; });
          if (a.length) { const o = S.opponentsOf(state, pid); return { key: a[0].key, target: o[Math.floor(r() * o.length)] }; }
          return { key: R.SK.JI };
        }
        : function () { return { key: R.SK.JI }; };
      let shrinkStarted = false;   // v1.5.66: 清场判据的分界（收缩开始后的死者不算清场）
      const champ = T.policyChooserN(params, 0.15);
      const ch = [];
      for (let i = 0; i < 5; i++) ch.push(i === me ? champ : scripted);
      Play.autoGameN(st, ch);
      rounds += st.round;
      for (const e of st.events) {
        if (e.type === 'action' && e.outcome === 'ok') {
          if (e.pid === me) {
            acts++;
            if (OLD.indexOf(e.key) >= 0) atkOld++;
            if (isDmg(e.key)) atkNew++;
          } else if (kind === 'aggr' && OLD.indexOf(e.key) >= 0) oppAtk++;
        } else if (e.type === 'damage') {
          /* v1.5.66: 清场数才是诚实判据 —— 新规则下打 1 点就在全灭判胜里赢，严格胜率变得太容易
           * （线上包场 B 已 100%）=> 改量收缩开始前真的死了几个。收缩的伤 source==null（不可格挡）；
           * 在此之前场 B 里唯一的伤害来源就是冠军本身。 */
          if (e.source == null) shrinkStarted = true;
          if (e.source === me) dealt += e.amt;
          if (e.to === me) {
            taken += e.amt;
            /* v1.5.65：终局收缩的伤害**没有 source**（不可格挡、不计来源）⇒ 单独统计，
             * 否则"场 B 里冠军不该挨打"会被收缩的伤打破（实测 3.00/局 = 3 血全掉）。 */
            if (e.source != null) takenOpp += e.amt;
          }
        } else if (e.type === 'death' && !shrinkStarted) {
          cleared++;
        }
      }
      if (st.winner === me) wins++;
      if (st.winner === 'draw' || st.winner == null) draws++;
    }
    return {
      games: G, actsPerGame: acts / G, atk: acts ? atkNew / acts : 0, atkOldWhitelist: acts ? atkOld / acts : 0,
      dealtPerGame: dealt / G, takenPerGame: taken / G, takenByOpponentPerGame: takenOpp / G, winRate: wins / G, drawRate: draws / G,
      clearedPerGame: cleared / G, clearedTotal: cleared,
      roundsPerGame: rounds / G, oppAtkPerGame: oppAtk / G
    };
  }
  const A = run('aggr'), B = run('calm');
  return { fieldA: A, fieldB: B, atk: A.atk, dealtPerGame: A.dealtPerGame, winRate: A.winRate };
}

/* ===== 技能广度 S 的**权威定义**（v1.5.91，用户裁定的口径）=====
 * 用户要的目标形状：**`目标 = H + T·S`**，其中
 *   H = 与**胜率**相关的强度项（本项目 fit 的主项就是自对局回报均值 `fitAvg`；外部标尺是 A 考卷 1st%）；
 *   S = **技能广度**（本函数算的那个量）；T = 交换率（`EPIRUS_DIV_W` 那一族）。
 *   写成 `G = H − T·S'` 也成立，只要把 `S'` 定义成"集中度"= ln(K_menu) − S —— 两种写法同构；
 *   **本仓库统一按 `H + T·S` 陈述**，免得符号打架。
 *
 * **为什么不按"落地伤害"加权**（用户 v1.5.91 逐条否掉，记在这里免得以后又有人提）：
 *   ① 梯度会全给最便宜的可重复攻击卡（枪）⇒"大家都跑去用枪了"；
 *   ② 伤害只是**一条轴**，卡的价值分布在多条轴上（伤害 / 穿透 / 防御 / 经济）：很多卡贵的理由是
 *      **穿透能力**而不是伤害；而防御类卡伤害恒 0 ⇒ 被权成 0 ⇒ **量不出防御技能的使用**；
 *   ③ 更根本的一条：任何"按卡打分"的权重都会给某张卡一个**专属梯度** ——
 *      v1.3.7 的 `hold+conv`"literally 在为『ジ→激光剑』这一个循环付钱"就是这个失败的活例。
 *   ⇒ 所以 S 用**熵**（对卡对称、无专属梯度），只把"支持集"按 `rules.js` **自己声明的 `cat`** 分层。
 *
 * 定义（唯一真源就是下面这段代码）：
 *   n_k       = 自对局里 `outcome==='ok'` 且 `key!==ji` 的动作计数（**与门禁同源**，见 D74）
 *   N         = Σ n_k；K_menu = `rules.js` 里带 `cat` 的非ジ技能数（**固定常量**，不随"能不能付得起"变化）
 *   S_cat     = H(`cat` 的边缘分布)                       ← "用了几**类**"（能量/攻击/防御/特殊）
 *   S_within  = Σ_c share_c · H(第 c 类**内部**的卡分布)     ← "每一类里铺得开不开"
 *   S         = S_cat + S_within  ≡ H(全部非ジ卡的分布)
 *               ⚠️ 分层熵**恒等于**平铺熵（这是数学事实，不能装作发现了新量）——
 *                  分层带来的不是新总量，而是**可读性**：S 低到底是"只敢用一类"，还是"每类只薅一张"。
 *   S_norm    = S / ln(K_menu) ∈ [0,1]（**固定分母** ⇒ 不能靠"把菜单变穷"刷分，v1.5.86/DIV_K 的教训）
 *   G_eff     = exp(S)  —— 与历史的 `G 有效技能数` **同值**（口径不变 ⇒ 历史读数仍可比）
 *   maxCardShare = 出现最多的那张卡的占比（**反 spam 守卫**，只打印、不参与判定）
 *   catsUsed  = 占比 ≥1% 的类数（给人读的"覆盖了几类"）
 * ⚠️ 样本敏感（`docs/METHODOLOGY.md` 规则 22）：同一个包 n5=3.08 / n10=2.99 / n20=4.24 / n40=4.54
 *   ⇒ 返回值**必须带 N 与 games**，打印时一起报；小样本之间的 S 差**不可比**。
 * 本函数**只测量**：不参与 fit、不参与任何阻断（改 fit 的归一化是另一件独立的事，改了必须记 pre/post 分界）。 */
export function breadthProfile(W, params, mode, GAMES) {
  const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay, R = W.EpirusRules;
  const G = GAMES || 20;
  const byKey = R.byKey || {};
  const catOf = function (k) { return (byKey[k] && byKey[k].cat) || '(未分类)'; };
  const menu = Object.keys(byKey).filter(function (k) { return k !== R.SK.JI && byKey[k] && byKey[k].cat; });
  const K_menu = menu.length || 1;
  const cats = {};   // 声明的类集合（固定，不受实测影响）
  Object.keys(byKey).forEach(function (k) { if (k !== R.SK.JI && byKey[k] && byKey[k].cat) cats[byKey[k].cat] = 1; });
  const K_cat = Object.keys(cats).length || 1;
  /* v1.5.93：**功能角色表**（8 个角色：economy/defense/pierceBoth/pierceReflect/pierceDefense/burst/damage/utility）
   * —— 真源是 `js/train/evo.js` 的 `roleOf`，这里**只调它、不自己再写一张表**（"清单两处各写一遍必出事"）。
   * 没有它时退回 `cat`（老沙箱/老包），保证这个探针不会因为缺一个函数就崩。 */
  const roleOf = function (k) {
    if (typeof T.roleOf === 'function') return T.roleOf(k);
    return (byKey[k] && byKey[k].cat) || '(未分类)';
  };
  const rolesDecl = {};   // 声明的角色集合（固定）
  Object.keys(byKey).forEach(function (k) { if (k !== R.SK.JI) rolesDecl[roleOf(k)] = 1; });
  const K_role = Object.keys(rolesDecl).length || 1;
  const h = function (arr) {
    let tot = 0; for (const x of arr) tot += x;
    if (tot <= 0) return 0;
    let e = 0; for (const x of arr) { if (x > 0) { const p = x / tot; e -= p * Math.log(p); } }
    return e;
  };
  const cnt = {}, catCnt = {}, roleCnt = {};
  let N = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(21000 + g) }, 5);
    st.slotSalt = (Math.imul(g + 3, 0x9e3779b1) ^ 0x165667b1) >>> 0;
    const base = T.policyChooserN(params, 0.15);
    Play.autoGameN(st, [base, base, base, base, base]);
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) {
        const c = catOf(e.key), r2 = roleOf(e.key);
        cnt[e.key] = (cnt[e.key] || 0) + 1;
        catCnt[c] = (catCnt[c] || 0) + 1;
        roleCnt[r2] = (roleCnt[r2] || 0) + 1;
        N++;
      }
    }
  }
  const S_flat = h(Object.keys(cnt).map(function (k) { return cnt[k]; }));
  const S_cat = h(Object.keys(catCnt).map(function (c) { return catCnt[c]; }));
  const S_role = h(Object.keys(roleCnt).map(function (r2) { return roleCnt[r2]; }));
  let S_within = 0;
  const catShares = {};
  Object.keys(catCnt).forEach(function (c) {
    const share = catCnt[c] / Math.max(1, N);
    catShares[c] = share;
    const inner = Object.keys(cnt).filter(function (k) { return catOf(k) === c; }).map(function (k) { return cnt[k]; });
    S_within += share * h(inner);
  });
  const roleShares = {};
  Object.keys(roleCnt).forEach(function (r2) { roleShares[r2] = roleCnt[r2] / Math.max(1, N); });
  let maxCardShare = 0;
  Object.keys(cnt).forEach(function (k) { const p = cnt[k] / Math.max(1, N); if (p > maxCardShare) maxCardShare = p; });
  const catsUsed = Object.keys(catShares).filter(function (c) { return catShares[c] >= 0.01; }).length;
  const rolesUsed = Object.keys(roleShares).filter(function (r2) { return roleShares[r2] >= 0.01; }).length;
  return {
    games: G, N: N, K_menu: K_menu, K_cat: K_cat, K_role: K_role, menuSize: menu.length,
    S: S_flat, S_cat: S_cat, S_within: S_within,
    S_role: S_role, S_roleWithin: S_flat - S_role,
    S_norm: S_flat / Math.log(K_menu),
    G_eff: Math.exp(S_flat), G_cat: Math.exp(S_cat), G_role: Math.exp(S_role),
    maxCardShare: maxCardShare, catsUsed: catsUsed, rolesUsed: rolesUsed,
    catShares: catShares, roleShares: roleShares, counts: cnt
  };
}
