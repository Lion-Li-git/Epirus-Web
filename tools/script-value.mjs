/* 脚本线价值表：1 席脚本 vs 4 席现役冠军（G4 装配 · v1.5.143 起可复用）
 *
 * 为什么要它（DS 交接件 P3 的前置）：本仓关于"某张卡值不值钱"的结论**已经错过两次同一个根因** ——
 * 用一条**不会为那件事选目标**的脚本去量那张卡的价值：
 *   · `pickHeavyFire` 被当成"贵卡教师"用了两臂，实测它最大 ep=2 ⇒ 结构上买不起 cost≥3（空示范）；
 *   · "大雷亏本"那两行 15%/8% 用的是盲放线，实测传导/施放只有 **0.43**（≈ 蒙），而用户实盘是 0.75。
 * ⇒ 价值判断必须先问："这条脚本**真的在做**我认为它在做的事吗？"本工具把这个问题机械化：
 *   除了胜率，它直接数 `bigTChain`（传导落点事件）与 `voided(*连带*)`（被封住的行动），
 *   并除以该席真正放出去的大雷次数 ⇒ **传导/施放** 是一个可反驳的读数，不是印象。
 *
 * 口径：`tools/v2v4-lib.duelAssembly` 同一装配（脚本席轮转 `g % 5`、`seed0=90210`、mode=multi、冠军 temp 0.15 ε=0）。
 *
 * 用法：node tools/script-value.mjs [--games=60] [--seed0=90210] [--champion=js/bundled-champion-3p.js]
 *       [--lines=pickBigTFocus,pickBreakDef,pickHeavyFire,pickDeepSaver,pickBeadBurst]
 */
import { sandbox, loadChamp } from './audit-lib.mjs';
import { mb, h32 } from './v2v4-lib.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const G = Number(flag('games', 60));
const SEED0 = Number(flag('seed0', 90210));
const MODE = flag('mode', 'multi');
const LINES = String(flag('lines', 'pickBigTFocus,pickBreakDef,pickHeavyFire,pickDeepSaver,pickBeadBurst')).split(',');

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const SK = R.SK;
const params = loadChamp(W, flag('champion', 'js/bundled-champion-3p.js'), ROOT);
const ch = T.policyChooserN(params, 0.15, 0);

console.log('== 1 席脚本 vs 4 席现役冠军 · ' + MODE + ' · ' + G + ' 局 · seed0=' + SEED0 + ' · 冠军 ε=0 temp .15 ==');
console.log('   基线（DS 0921 的价值表）：随机线 ≈18% · 只枪 7% · 纯攒大雷 15% · pickBeadBurst 30%');
for (const name of LINES) {
  const sel = B[name];
  if (typeof sel !== 'function') { console.log('  ⚠ 找不到 ' + name + '（跳过）'); continue; }
  const scripted = T.wrapBotN(sel);
  let win = 0, draws = 0, casts = 0, chainEv = 0, sealed = 0, dmgBigT = 0, rounds = 0, maxEp = 0, other = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % 5;
    const st = S.createState(MODE, { next: mb(SEED0 + g * 991) }, 5);
    st.slotSalt = h32(SEED0 + g * 2246822519);
    const wrapped = function (state, pid, legal) {
      const pick = scripted(state, pid, legal);
      if (pid === seat) {
        if (state.p[pid].ep > maxEp) maxEp = state.p[pid].ep;
        if (pick && pick.key === SK.BIG_T) casts++;
      }
      return pick;
    };
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === seat ? wrapped : ch);
    Play.autoGameN(st, cs);
    for (const e of st.events || []) {
      if (e.type === 'bigTChain' && e.from === seat) chainEv++;
      if (e.type === 'voided' && e.pid === seat) other++;
      if (e.type === 'damage' && e.via === SK.BIG_T && e.source === seat) dmgBigT += e.amt;
      if (e.type === 'voided' && /连带|真正的落雷/.test(String(e.by || '')) && e.pid !== seat) sealed++;
    }
    if (st.winner === seat) win++; else if (st.winner === 'draw') draws++;
    rounds += st.round;
  }
  console.log('  ' + name.padEnd(16) +
    ' 胜率 ' + String(Math.round(100 * win / G)).padStart(3) + '%' +
    ' 平 ' + String(Math.round(100 * draws / G)).padStart(3) + '%' +
    ' 大雷施放/局 ' + (casts / G).toFixed(2) +
    ' 传导/施放 ' + (casts ? (chainEv / casts).toFixed(2) : '—') +
    ' 连带封行动/局 ' + (sealed / G).toFixed(2) +
    ' 大雷系伤害/局 ' + (dmgBigT / G).toFixed(2) +
    ' 观测最大 ep ' + String(maxEp).padStart(3) +
    ' 局长 ' + (rounds / G).toFixed(1));
}
