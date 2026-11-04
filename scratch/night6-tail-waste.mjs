#!/usr/bin/env node
/* night6-tail-waste.mjs —— 尾部窗口浪费量（ZCode · 11-05 凌晨）
 * 问题：残局抑制（停长链）到底值多少？量 v7 线上包自打 5P multi 40 局：
 *   ① 长链键（环/大雷/炮/蓄能）在「最后 10 回合窗口」的出手份额 vs 全局份额（有没有自发收缩）
 *   ② 尾部窗口里这些出手**之后到终局**实际造成的伤害（兑现证据）——每局分摊
 * 判读：尾部份额 ≈ 全局 且 尾部兑现/出手 明显低于中局 ⇒ 浪费真实存在 ⇒ 训练目标成立；
 *       尾部兑现/出手 与中局相当 ⇒ 浪费是伪命题 ⇒ 目标降级。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

const src = readFileSync(join(ROOT, 'js/bundled-champion-3p.js'), 'utf8');
const raw = JSON.parse(/EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src)[1]);
/* v7 包 = 原生形状：不 install（install 会被 v7 unpack 的长度守卫拒绝 ⇒ null） */
const ch = T.policyChooserN(Float64Array.from(P.unpack(raw, true)), 0.15);

const LONG = new Set([R.SK.CHARGE, R.SK.RING, R.SK.BIG_T, R.SK.RAILGUN]);
const G = 40, TAIL = 10;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let actsAll = 0, longAll = 0, actsTail = 0, longTail = 0, dmgTail = 0, tailGames = 0;
const perGame = [];
for (let g = 0; g < G; g++) {
  const seat = g % 5;
  const st = S.createState('multi', { next: mulberry(77000 + g * 977) }, 5);
  const chs = []; for (let i = 0; i < 5; i++) chs.push(i === seat ? ch : W.EpirusBots.pickRandom);
  const chByPid = (pid) => (pid === seat ? ch : W.EpirusBots.pickRandom);
  /* 先正常跑完整局，但需要按回合归属出手——手动跑回合循环太重 ⇒ 用事件流的回合边界重建 */
  Play.autoGameN(st, chs);
  const total = st.round;
  const tailStart = Math.max(0, total - TAIL);
  /* 事件流重建：action 的回合归属 = 遇到新 pid 序列头时 round++（与 trace-game 同法） */
  let round = -1, seen = {};
  let aAll = 0, aTail = 0, lAll = 0, lTail = 0, dTail = 0;
  const dmgAfter = [];
  for (const e of st.events) {
    if (e.type === 'action') {
      if (seen[e.pid] !== undefined) { seen = {}; round++; } else if (round < 0) round = 0;
      seen[e.pid] = true;
      if (e.pid === seat) {
        aAll++; if (LONG.has(e.key)) lAll++;
        if (round >= tailStart) { aTail++; if (LONG.has(e.key)) lTail++; }
      }
    } else if (e.type === 'damage' && e.source === seat && round >= tailStart) {
      dTail += e.amt;
    }
  }
  actsAll += aAll; longAll += lAll; actsTail += aTail; longTail += lTail; dmgTail += dTail;
  if (aTail > 0) { tailGames++; perGame.push({ g, total, lTail, aTail, dTail }); }
}
console.log('v7 线上包自打 5P multi × ' + G + ' 局 ‖ 尾窗 = 每局最后 ' + TAIL + ' 回合');
console.log('全局：长链出手份额 ' + (100 * longAll / Math.max(1, actsAll)).toFixed(1) + '%（' + longAll + '/' + actsAll + '）');
console.log('尾窗：长链出手份额 ' + (100 * longTail / Math.max(1, actsTail)).toFixed(1) + '%（' + longTail + '/' + actsTail + '）⇒ ' + (longTail / Math.max(1, actsTail) > longAll / Math.max(1, actsAll) ? '尾窗份额更高（无自发收缩）' : '尾窗份额更低（有自发收缩迹象）'));
console.log('尾窗长链出手 ' + longTail + ' 次 ‖ 尾窗内这些席位的全部造伤 ' + Math.round(dmgTail) + ' ‖ 均 ' + (dmgTail / Math.max(1, tailGames)).toFixed(2) + '/局（含非长链手）');
console.log('⇒ 尾窗长链次数/局 = ' + (longTail / G).toFixed(2) + '（如果这个数 ≈0，"残局停长链"的收益上限就是它）');
