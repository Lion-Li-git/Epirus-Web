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
  return W.EpirusPolicy.unpack(JSON.parse(m[1]));
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
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
  const G = GAMES || 20;
  const N = 5;
  let dmg = 0, heavyDmg = 0, holo = 0, draws = 0, rounds = 0, zero = 0, attacks = 0;
  const keyCount = {};
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(9000 + g) }, N);
    const ch = []; for (let i = 0; i < N; i++) ch.push(T.policyChooserN(params, 0.15));
    Play.autoGameN(st, ch);
    let gd = 0;
    for (const e of st.events) {
      if (e.type === 'holoSet') holo++;
      if (e.type === 'damage') {
        dmg += e.amt; gd += e.amt;
        /* cost≥3 的落地伤害：从事件里认 via（技能）成本 */
        const def = e.via ? R.byKey[e.via] : null;
        if (def && def.cost != null && def.cost >= 3) heavyDmg += e.amt;
      }
      if (e.type === 'action' || e.type === 'cast') attacks++;
      /* G：只统计**非ジ**的成功出手（ジ 占比 ~60% 是算术必然，算进去会把覆盖度量成常数）。 */
      if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) {
        keyCount[e.key] = (keyCount[e.key] || 0) + 1;
      }
    }
    rounds += st.round;
    if (gd === 0) zero++;
    if (st.p.every(function (p) { return p.hp > 0; })) draws++;
  }
  /* 有效技能数 = exp(熵)；只用非ジ出手的分布。样本不足时给 0（而不是 NaN）。 */
  const ks = Object.keys(keyCount);
  const tot = ks.reduce(function (a, k) { return a + keyCount[k]; }, 0);
  let H = 0;
  for (const k of ks) { const p = keyCount[k] / tot; H -= p * Math.log(p); }
  const effSkills = tot ? Math.exp(H) : 0;
  return {
    dmgPerGame: dmg / G, heavyPerGame: heavyDmg / G, holoPerGame: holo / G,
    zeroRate: zero / G, drawRate: draws / G, rounds: rounds / G,
    effSkills: effSkills, distinctKeys: ks.length
  };
}

/* E/F：**对手活跃度**对冠军行为的影响（v1.5.14 加，起因是用户实测"集体防御"）。
 * 0 号座用"被动（只ジ）"或"活跃（每回合进攻）"的固定策略，其余 4 座都是被测冠军 ⇒ 量 AI 座的架势/进攻占比。 */
export function fieldRate(W, params, kind, mode, GAMES) {
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
  const G = GAMES || 10;
  const STANCE = [R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINGU, R.SK.PROTO];
  const ATK = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
  let stance = 0, atk = 0, tot = 0, rds = 0;
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
    for (const e of st.events) {
      if (e.type === 'action' && e.pid > 0 && e.outcome === 'ok') {
        tot++;
        if (STANCE.indexOf(e.key) >= 0) stance++;
        else if (ATK.indexOf(e.key) >= 0) atk++;
      }
    }
    rds += st.round;
  }
  return { stance: tot ? stance / tot : 0, atk: tot ? atk / tot : 0, rounds: rds / G };
}
