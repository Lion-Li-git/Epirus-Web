#!/usr/bin/env node
/* pool-synergy-meter.mjs —— 池配合量具 v0（C 线 · 用户令：带划分口径 v2 的第二因子「池配合」需要量）
 * 问题：hard 带全员风格同质核 ⇒ 全同质桌局是否真的抑制「配合出现」？混风格合成桌会不会把配合放出来？
 * 口径（GOAL-2026-11-19-ruler-resolution §三 量测协议的落地）：
 *   T1 = hard 核固定桌，T2 = hard 核 − 1 + 最外围风格 2 枚（X2b-fuse / rod r10）固定桌；
 *   同 seed 同桌形配对跑 multi+long，逐局采集 st.actions[pid]（onTurn 钩子 = 引擎实际解析的选择）
 *   与 st.events 的 damage（source/to），报：
 *     ① 集中火率：同一受害者 ≥2 个不同 source 打过的局占比（FFA 隐性结盟信号）
 *     ② 挑衅联动：挨打最多的目标恰是 taunter 的局数（拉火为他人创造输出）
 *     ③ 空轴触达率：tank/transfer/laserEye/holo/ring/curse/shift/bigT/proto 九轴有实际出卡的局占比
 *     ④ 跨席同局共现对：X@i 与 Y@j（i≠j）的 pair 计数 top10
 *     ⑤ 用卡熵（pooled shares）+ 胜者分布（桌面强度 sanity）
 * ⚠ v0 条款：**固定桌不是池抽签**（不带 slotSalt 抽签维度）——读数说的是「这两张桌」，不是带级判词；
 *   独立组成数 = seeds 数（沿用 probe-pool 的教训：加 games 只降仪器噪声，加 seeds 才升独立组成）。
 * 引擎单一来源：roster-lib（跨维度真包席，独立沙箱）+ v2v4-lib.duelAssembly（不抄对局循环）。
 * 用法：node scratch/pool-synergy-meter.mjs [--games=150] [--seeds=90210,90211,90212] [--modes=multi,long]
 *       [--tableA=pack:...×5] [--tableB=pack:...×5] [--out=tsv路径]
 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../training/proto2/arch2.mjs';
import { rosterFromArg } from '../training/proto2/roster-lib.mjs';
import { duelAssembly } from './v2v4-lib.mjs';
import { writeFileSync } from 'node:fs';

rejectUnknownFlags(process.argv.slice(2), ['games', 'seeds', 'modes', 'tableA', 'tableB', 'out'], 'pool-synergy-meter');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 150)) || 150;
const SEEDS = (arg('seeds', '90210,90211,90212') || '').split(',').map(Number).filter(Boolean);
const MODES = (arg('modes', 'multi,long') || '').split(',').filter(Boolean);
const TABLE_A = arg('tableA',
  'pack:docs/artifacts/obs6-coldstart/OBS6P9-S4000.bak,pack:docs/artifacts/obs6-coldstart/MX1-GD-EQ.bak,pack:docs/artifacts/obs6-coldstart/MX5-GD-T2STR.bak,pack:docs/artifacts/nov21-taunt-dsp0b.bak,pack:docs/artifacts/obs6-coldstart/MX3-GDEQ-GD.bak');
const TABLE_B = arg('tableB',
  'pack:docs/artifacts/obs6-coldstart/OBS6P9-S4000.bak,pack:docs/artifacts/obs6-coldstart/MX1-GD-EQ.bak,pack:docs/artifacts/nov21-taunt-dsp0b.bak,pack:docs/artifacts/night2-X2b-fuse.bak,pack:docs/artifacts/nov21-rod-tzt2d-r10.bak');
const OUT = arg('out', '');
const EMPTY_AXES = ['tank', 'transfer', 'laserEye', 'holo', 'ring', 'curse', 'shift', 'bigT', 'proto'];

/* 主沙箱：只为 duelAssembly 提供 S/Play/T/R。ch 兜底用 E1 真参构造（chooserFor 全覆盖 ⇒ 永不触发，
 * 但不给它静默 undefined 的机会——roster 缺席当场 throw）。 */
const W = sandbox();
const E1 = 'docs/artifacts/night2-E1-det-strong.bak';
installArch2(W, packCfgExit(readPack2(E1), E1).cfg);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const e1params = W.EpirusPolicy.unpack(readPack2(E1), true);

const mkTable = (spec, tag) => {
  const roster = rosterFromArg(W, T, 'names:' + spec, tag);
  if (roster.length < 3) { console.error('⛔ ' + tag + '：桌至少 3 席'); process.exit(2); }
  for (const r of roster) if (!r || !r.sel) { console.error('⛔ ' + tag + '：席位缺 chooser（装配断裂，禁静默）'); process.exit(2); }
  return roster;
};
const A = mkTable(TABLE_A, 'T1-hard核');
const B = mkTable(TABLE_B, 'T2-混风格');

function play(roster, tag) {
  const N = roster.length;
  const per = { games: 0, focusFire: 0, tauntGames: 0, tauntLinked: 0, emptyTouch: 0, rounds: 0, casts: {}, emptyCasts: {} };
  const pairs = {}; const winBy = {};
  for (const seed of SEEDS) {
    for (const mode of MODES) {
      let acts = null;   /* onTurn 采集的本局动作流水（引擎实际解析的选择） */
      const onTurn = (st) => {
        const row = [];
        for (let pid = 0; pid < N; pid++) {
          const a = st.actions && st.actions[pid];
          if (a && a.key && !a.voided) row.push({ pid, key: String(a.key), target: a.target == null ? null : a.target });
        }
        acts = row;
      };
      const onGame = (st) => {
        if (!acts) return;
        const casts = acts; acts = null;
        per.games++; per.rounds += st.round;
        const bySeat = {};
        for (const a of casts) (bySeat[a.pid] = bySeat[a.pid] || new Set()).add(a.key);
        let empty = false;
        for (const a of casts) {
          per.casts[a.key] = (per.casts[a.key] || 0) + 1;
          if (EMPTY_AXES.indexOf(a.key) >= 0) { empty = true; per.emptyCasts[a.key] = (per.emptyCasts[a.key] || 0) + 1; }
        }
        if (empty) per.emptyTouch++;
        /* ① 集中火：同一受害者 ≥2 个不同 source */
        const srcBy = {};
        for (const e of st.events || []) if (e.type === 'damage' && e.to != null && e.source != null) {
          (srcBy[e.to] = srcBy[e.to] || new Set()).add(e.source);
        }
        if (Object.values(srcBy).some((s) => s.size >= 2)) per.focusFire++;
        /* ② 挑衅联动：挨打最多的目标 = taunter 自己 */
        const taunters = new Set(casts.filter((a) => a.key === 'taunt').map((a) => a.pid));
        if (taunters.size) {
          per.tauntGames++;
          const hitCnt = {};
          for (const e of st.events || []) if (e.type === 'damage' && e.to != null) hitCnt[e.to] = (hitCnt[e.to] || 0) + 1;
          const top = Object.entries(hitCnt).sort((a, b) => b[1] - a[1])[0];
          if (top && taunters.has(Number(top[0]))) per.tauntLinked++;
        }
        /* ④ 跨席同局共现对 */
        const seats = Object.keys(bySeat).map(Number);
        for (const i of seats) for (const j of seats) {
          if (i === j) continue;
          for (const ki of bySeat[i]) for (const kj of bySeat[j]) {
            const p = ki + '>' + kj;
            pairs[p] = (pairs[p] || 0) + 1;
          }
        }
        const w = st.winner;
        const wname = w === 'draw' ? 'draw' : roster[w] ? roster[w].name : String(w);
        winBy[wname] = (winBy[wname] || 0) + 1;
      };
      duelAssembly({ S, Play, T, R }, e1params, {
        games: GAMES, mode, seed0: seed, scripted: 'champ',
        chooserFor: (pid) => roster[pid].sel,
        onGame, onTurn,
      });
    }
  }
  return { per, pairs, winBy, roster };
}

function summarize(tag, x) {
  const per = x.per, n = Math.max(1, per.games);
  const tot = Object.values(per.casts).reduce((a, b) => a + b, 0) || 1;
  let H = 0;
  for (const [k, c] of Object.entries(per.casts)) { const p = c / tot; if (p > 0) H -= p * Math.log(p); }
  const topPairs = Object.entries(x.pairs).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\n== ' + tag + ' == 桌员: ' + x.roster.map((r) => r.name).join(' | '));
  console.log('局数 ' + per.games + ' ‖ 平均回合 ' + (per.rounds / n).toFixed(1));
  console.log('① 集中火率 ' + (per.focusFire / n * 100).toFixed(1) + '%');
  console.log('② 挑衅联动 ' + per.tauntLinked + '/' + per.tauntGames + ' 局（taunt 局占比 ' + (per.tauntGames / n * 100).toFixed(1) + '%）');
  console.log('③ 空轴触达率 ' + (per.emptyTouch / n * 100).toFixed(1) + '% ‖ 空轴出卡 ' + JSON.stringify(per.emptyCasts));
  console.log('⑤ 用卡熵 ' + H.toFixed(3) + ' nats ‖ 胜者分布 ' + JSON.stringify(x.winBy));
  console.log('④ 跨席共现对 top10: ' + topPairs.map(([p, c]) => p + '(' + c + ')').join(' '));
  return { per, H, n };
}
void loadChamp;
const sa = summarize('T1 hard核', play(A, 'T1'));
const sb = summarize('T2 混风格', play(B, 'T2'));

console.log('\n== 配对差（T2 − T1，同 seed 同桌形） ==');
console.log('集中火率 ' + (sb.per.focusFire / sb.n * 100 - sa.per.focusFire / sa.n * 100).toFixed(1) + 'pt ‖ 空轴触达 ' + (sb.per.emptyTouch / sb.n * 100 - sa.per.emptyTouch / sa.n * 100).toFixed(1) + 'pt ‖ 用卡熵 ' + (sb.H - sa.H).toFixed(3) + ' nats');
if (OUT) {
  const row = ['table', 'games', 'focusFire%', 'tauntLinked/tauntGames', 'emptyTouch%', 'entropy', 'winnerDist', 'emptyCasts'].join('\t');
  const line = (tag, x, s) => [tag, x.per.games, (x.per.focusFire / s.n * 100).toFixed(1), x.per.tauntLinked + '/' + x.per.tauntGames, (x.per.emptyTouch / s.n * 100).toFixed(1), s.H.toFixed(3), JSON.stringify(x.winBy), JSON.stringify(x.per.emptyCasts)].join('\t');
  writeFileSync(OUT, row + '\n' + line('T1-hard核', sa, sa) + '\n' + line('T2-混风格', sb, sb) + '\n');
  console.log('写 ' + OUT);
}
