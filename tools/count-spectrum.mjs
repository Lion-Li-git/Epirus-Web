/* 人数谱 + 残局胜率（#22 · v1.5.140 起把口径钉进仓库）
 *
 * 为什么要有它：`G4/G5` 量的是"包自己在家门口的行为门"，而**换了桌人数之后**冠军会怎样，
 * 门禁一行都看不见（09-19 的"3P 包在 2 人局 0 胜"就是这么漏出去的）。v1.5.140 的残局规则改动
 * 更是**只在 3~5 人局掉到 2 人时才生效** ⇒ 必须有一条"残局"口径的读数，否则判据 ② 无从落地。
 *
 * 两个装配：
 *   ① 人数谱：1 冠军席 vs (N-1) 脚本席（脚本 = balanced/aggro/defend/mix/farmer 轮转），seat 轮转，N=2/3/5；
 *      N=2 用 `standard`（2 人场的卡表本就禁 MULTI_ONLY 三张），N≥3 用 `multi` ⇒ 与页面同口径。
 *   ② 残局胜率：N=3/5 的 `multi` 场里，**第一次掉到 2 人存活**之后冠军最终夺冠的比例。
 *      分母 = 到过 2 人残局的局数（一开始就 2 人的不算），分子 = 其中冠军赢的。
 *      ⇒ v1.5.140 的效果只可能出现在这一格，其它格对它不敏感。
 *
 * 用法：node tools/count-spectrum.mjs [--champions=docs/artifacts/v7u1-93.bak,...]  # 不给 = 现役三粒（现役3P/前任3P/2P内置）
 *       [--games=60] [--ns=2,3,5] [--temp=0.15]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, mulberry32 } from './audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Number(flag('games', 60));
const NS = String(flag('ns', '2,3,5')).split(',').map(Number);
const TEMP = Number(flag('temp', 0.15));
const CHAMPS = String(flag('champions', 'js/bundled-champion-3p.js,docs/artifacts/v7press3-91.bak,js/bundled-champion.js')).split(',').filter(Boolean);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots, P = W.EpirusPolicy;
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];

function paramsOf(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  if (/EPIRUS_CHAMPION_3P/.test(src)) return loadChamp(W, file, ROOT);
  const m = /window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);        // 2P 内置包
  if (!m) throw new Error('读不出冠军包：' + file);
  return P.unpack(JSON.parse(m[1]), true);
}

/* 一席冠军 vs 其余脚本；同时记"掉到 2 人残局后是否夺冠" */
function run(params, N, G, seed0) {
  const mode = N === 2 ? 'standard' : 'multi';
  const ch = T.policyChooserN(params, TEMP, 0);
  let win = 0, endgameSeen = 0, endgameWon = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % N;
    const st = S.createState(mode, { next: mulberry32(seed0 + g * 997) }, N);
    st.slotSalt = (seed0 + g * 2246822519) >>> 0;
    const cs = [];
    for (let i = 0; i < N; i++) cs.push(i === seat ? ch : T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length]));
    /* 引擎没有"回合内死亡"钩子 ⇒ 用每回合开始时数存活人数的办法抓"第一次只剩 2 人"那一刻 */
    let reached2 = false;
    Play.autoGameN(st, cs, null, function (state) {
      if (reached2 || N <= 2) return;
      let alive = 0;
      for (let i = 0; i < N; i++) if (state.p[i].hp > 0) alive++;
      if (alive === 2) reached2 = true;
    });
    if (reached2) { endgameSeen++; if (st.winner === seat) endgameWon++; }
    if (st.winner === seat) win++;
  }
  return { win: Math.round(100 * win / G), endgameSeen, endgameWon: Math.round(100 * endgameWon / Math.max(1, endgameSeen)) };
}

console.log('== 1 冠军席 vs (N-1) 脚本席 · 每点 ' + GAMES + ' 局 · seat 轮转 · mode 按人数（N=2 ⇒ standard）==');
for (const file of CHAMPS) {
  const params = paramsOf(file);
  const name = file.replace(/^.*\//, '').replace(/\.bak$/, '').replace(/\.js$/, '');
  const cells = NS.map(function (N) {
    const r = run(params, N, GAMES, 4100);
    const tail = (N > 2 && r.endgameSeen) ? ('｜残局2人 到过' + r.endgameSeen + '局 夺冠 ' + r.endgameWon + '%') : '';
    return 'N' + N + ': ' + r.win + '%' + tail;
  });
  console.log('  ' + name.padEnd(16) + cells.join('  '));
}

/* 正面对决（#22 的那一问）：`--duel=A,B` ⇒ 2 席 `standard` 轮先手，A-B 记胜负。
 * 人数谱的 N=2 是"打脚本席"，回答不了"两个包互殴谁赢" —— 09-19 那次就是把这两件事混了。 */
const DUEL = flag('duel', '');
if (DUEL) {
  const [fa, fb] = DUEL.split(',').filter(Boolean);
  const A = paramsOf(fa), Bp = paramsOf(fb);
  const na = fa.replace(/^.*\//, '').replace(/\.bak$/, ''), nb = fb.replace(/^.*\//, '').replace(/\.bak$/, '');
  const ca = T.policyChooserN(A, TEMP, 0), cb = T.policyChooserN(Bp, TEMP, 0);
  let wa = 0, wb = 0, dr = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('standard', { next: mulberry32(880 + g * 77) }, 2);
    st.slotSalt = (880 + g * 2246822519) >>> 0;
    const first = g % 2;                                   // 先手轮转（否则座位漏进胜负）
    Play.autoGameN(st, first === 0 ? [ca, cb] : [cb, ca]);
    const w = st.winner;
    if (w === 'draw' || w == null || w < 0) dr++;
    else if (w === first) wa++; else wb++;
  }
  console.log('== 2 席 standard 正面对决（' + GAMES + ' 局 · 先手轮转）==');
  console.log('  ' + na + ' vs ' + nb + '：' + wa + '-' + wb + (dr ? '（平 ' + dr + '）' : ''));
}
