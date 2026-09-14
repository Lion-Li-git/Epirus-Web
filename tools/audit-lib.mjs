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
  return { first: m ? Number(m[1]) : null, cost3: c3 ? Number(c3[1]) : null };
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
  let dmg = 0, miniT = 0, voided = 0, hitsByKey = {}, rounds = 0;
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
      if (e.type === 'voided' && e.pid !== seat) voided++;
    }
    rounds += st.round;
  }
  return { games: G, dmgPerGame: dmg / G, hitsByKey: hitsByKey, miniTCasts: miniT,
    voidedWallSeats: voided, rounds: rounds / G };
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
