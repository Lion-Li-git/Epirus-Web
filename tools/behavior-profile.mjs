/* 行为面画像（#26 随机性再调的量具 · v1.5.140）
 *
 * 为什么要它：门禁的 G4/G5/五道门量的是**结果**（胜率、被克格），而用户实机给的三条读数全是**行为**——
 * "防御偏多""丢了集火""不会滚环"。现有工具里没有一把尺子同时给出这四个数，
 * 于是"改随机性"只能靠手感（v1.5.139 那轮"ε=0.25 全候选太糙"就是这么反复的）。
 * 本工具在同一装配、同一种子带下并排量 **ε=0（纯贪心）与 ε>0（浏览器实际口径）**，
 * 这样"探索带来的行为漂移"是一个**差值**，不是两个互不可比的绝对数。
 *
 * 口径：
 *   场=1 冠军席 + 4 脚本席（balanced/aggro/defend/mix/farmer，轮座），mode=multi，与人数谱同一装配；
 *   镜像=2 席同一冠军，mode=standard（破局率：决胜/总局，平局算未破）。
 *   defShare/atkShare/ringShare/jiShare 的分母 = 冠军席全部出手（含ジ）。
 *   focusRate = 冠军席"带目标的伤害出手"里，落点与**上一次**带目标伤害出手相同的那部分（连段集火）。
 *   voidShare = 冠军席被 `voided` 的出手占比（"昏手"的直接读数：出了但什么都没发生）。
 *
 * 用法：node tools/behavior-profile.mjs [--champion=js/bundled-champion-3p.js]... 可逗号并列多包
 *       [--eps=0,0.4] [--epsk=5] [--temp=0.15] [--games=60] [--mirror=40]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const EPS = String(flag('eps', '0,0.4')).split(',').map(Number);
const EPSK = Number(flag('epsk', 5));
const EPSMODE = String(flag('epsmode', 'uniform')).split(',').filter(Boolean);   // uniform = v1.5.139 原口径 · soft = 探索不覆盖防御/环
const TEMP = Number(flag('temp', 0.15));
const GAMES = Number(flag('games', 60));
const MIRROR = Number(flag('mirror', 40));
const CHAMPS = String(flag('champion', 'js/bundled-champion-3p.js')).split(',').filter(Boolean);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const SK = R.SK, byKey = R.byKey;
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
const isDmg = k => !!(byKey[k] && byKey[k].dmg && byKey[k].dmg.amt);

function tally() {
  return { acts: 0, def: 0, atk: 0, ring: 0, ji: 0, tgtActs: 0, focus: 0, voided: 0, endgameMultiOnly: 0, rounds: 0, wins: 0 };
}
function share(t, k) { return t.acts ? (100 * t[k] / t.acts).toFixed(1) + '%' : '—'; }

/* 一席冠军 + 其余脚本：跑 G 局，返回行为计数。
 * ⚠️ 出手取自 **chooser 的返回值**（引擎不保留逐回合动作历史，`state.actions` 只有当回合），
 * 顺带得到 §9 判据④ 的机械核对量：`endgameMultiOnly` = 存活≤2 时冠军仍提出 MULTI_ONLY 三张的次数（必须为 0）。 */
function fieldProfile(params, eps, mode, G, seed0) {
  const N = 5, t = tally();
  for (let g = 0; g < G; g++) {
    const seat = g % N;
    const st = S.createState('multi', { next: mulberry32(seed0 + g * 997) }, N);
    st.slotSalt = (seed0 + g * 2246822519) >>> 0;
    const chooser = T.policyChooserN(params, TEMP, eps, EPSK, mode);
    let lastTgt = null;
    const wrapped = function (state, pid, legal) {
      const pick = chooser(state, pid, legal);
      const k = pick && pick.key;
      t.acts++;
      if (k === SK.JI) { t.ji++; return pick; }
      if (k === SK.RING) t.ring++;
      const cat = byKey[k] && byKey[k].cat;
      if (cat === R.CAT.DEFENSE) t.def++;
      else if (cat === R.CAT.ATTACK) t.atk++;
      let alive = 0;
      for (let i = 0; i < state.p.length; i++) if (state.p[i].hp > 0) alive++;
      if (alive <= 2 && R.MULTI_ONLY.indexOf(k) >= 0) t.endgameMultiOnly++;
      if (isDmg(k) && pick.target != null) {
        t.tgtActs++;
        if (lastTgt !== null && pick.target === lastTgt) t.focus++;
        lastTgt = pick.target;
      }
      return pick;
    };
    const cs = [];
    for (let i = 0; i < N; i++) cs.push(i === seat ? wrapped : T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length]));
    Play.autoGameN(st, cs);
    for (const e of st.events || []) if (e.type === 'voided' && e.pid === seat) t.voided++;
    t.rounds += st.round;
    if (st.winner === seat) t.wins++;
  }
  return t;
}

/* 2 席镜像：破局率（决胜 = 有人赢）+ 平均局长 */
function mirrorProfile(params, eps, mode, G, seed0) {
  let dec = 0, rounds = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('standard', { next: mulberry32(seed0 + g * 77) }, 2);
    st.slotSalt = (seed0 + g * 2246822519) >>> 0;
    const chooser = T.policyChooserN(params, TEMP, eps, EPSK, mode);
    Play.autoGameN(st, [chooser, chooser]);
    if (st.winner != null && st.winner >= 0) dec++;
    rounds += st.round;
  }
  return { dec, rounds, G };
}

for (const file of CHAMPS) {
  const params = loadChamp(W, file, ROOT);
  const name = file.replace(/^.*\//, '').replace(/\.bak$/, '').replace(/\.js$/, '');
  console.log('== ' + name + '（参数量 ' + params.length + ' · temp=' + TEMP + ' epsK=' + EPSK + ' · ' + GAMES + ' 局/点）==');
  for (const mode of EPSMODE) {
    for (const eps of EPS) {
      const t = fieldProfile(params, eps, mode, GAMES, 4100);
      const m = mirrorProfile(params, eps, mode, MIRROR, 880);
      console.log('  ε=' + eps + ' ' + mode.padEnd(8) +
        '  防御 ' + share(t, 'def') + ' 攻击 ' + share(t, 'atk') + ' 环 ' + share(t, 'ring') + ' ジ ' + share(t, 'ji') +
        '  集火 ' + (t.tgtActs ? (100 * t.focus / t.tgtActs).toFixed(1) + '%' : '—') +
        '  昏手 ' + share(t, 'voided') + ' 残局 MULTI_ONLY 出手 ' + t.endgameMultiOnly +
        '  胜率 ' + (100 * t.wins / GAMES).toFixed(0) + '% 局长 ' + (t.rounds / GAMES).toFixed(1) +
        '  |  镜像破局 ' + (100 * m.dec / m.G).toFixed(0) + '% 局长 ' + (m.rounds / m.G).toFixed(1));
    }
  }
}
