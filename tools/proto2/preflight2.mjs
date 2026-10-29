#!/usr/bin/env node
/* preflight2.mjs — 2.0 开臂前的六项预检（DS · 2026-10-28 晚）
 *
 * 为什么要有它（今天一下午四波读数作废，全部是「没崩、也没接上」）：
 *   ① 预算按标称 evals 配 ⇒ 同一标称下 GA 40 局 ‖ CEM 600 局（差 15 倍）；
 *   ② 原型里 candIn 声明 122 列、真拼进去 56 列 ⇒ 1584 个恒零输入的「死权重」，靠字节对账才照出来；
 *   ③ evo 的 LEGACY 把 2.0 判成旧包 ⇒ 前向被叫 0 次，而 fit 照样出数（三波臂因此作废）；
 *   ④ 关掉上线档那一行不打印 ⇒ 复跑的人读到的数是另一格（K2 那一族）。
 * ⇒ 把「接上了没有」写成一次**可失败**的检查：任何一条红就不开臂，比跑完 40 分钟再发现便宜。
 *
 * 用法：node tools/proto2/preflight2.mjs [--games=1] [--se=1.3 --n=608 --effect=2] [--json]
 * 六项：① 形状 ② 接线（真打一局）③ 配对（有牙对照）④ 容器版本（v:90 必须判成现代分支）
 *       ⑤ 功效（要多少局）⑥ 预算记账（按实际局数停并打印）
 * ⚠ 它只读 js/** 与 tools/**，装 2.0 之后用 restore() 还原 ⇒ 不留任何口径。
 */
import { readFileSync } from 'node:fs';
import { sandbox, degeneracyVerdict, arenaGuardVerdict } from '../audit-lib.mjs';
import * as A2 from './arch2.mjs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : (argv.includes('--' + k) ? '1' : d); }
const GAMES = Math.max(1, Number(arg('games', 1)) || 1);
const SE0 = Number(arg('se', 1.3));
const N0 = Math.max(1, Number(arg('n', 608)) || 608);
const EFFECT = Number(arg('effect', 2));
const JSONOUT = argv.includes('--json');

const rows = [];
function chk(ok, name, detail) { rows.push({ ok: !!ok, name, detail }); if (!JSONOUT) console.log((ok ? '✓ ' : '✗ ') + name + (detail ? ' ‖ ' + detail : '')); }

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
if (!T || !P) { console.error('⛔ 沙箱里没有 EpirusTrainer/EpirusPolicy'); process.exit(2); }

/* ① 形状：段和必须等于 paramCount（死权重那一族的第一道哨） */
const L = A2.layout({});
const sum = L.seg.reduce((a, s) => a + s.len, 0);
chk(sum === L.n, '① 形状：段和 = paramCount', L.arch + ' n=' + L.n + ' ‖ ' + L.seg.map((s) => s.name + ' ' + s.len).join(' | '));

/* ② 接线：真打一局，2.0 的前向必须被叫到（不是「装上了、没崩」） */
let A = null, wired = null, wireErr = '';
try { A = A2.install(W, { mode: 'multi', n: 5 }); wired = A2.verifyWired(W, A, { mode: 'multi', n: 5, games: GAMES }); }
catch (e) { wireErr = String((e && e.message) || e); }
chk(!!wired && wired.forwards > 0 && wired.chooseCandidatesCalls > 0, '② 接线：真打 ' + GAMES + ' 局，2.0 的前向必须被叫到（不许 0 次而 fit 照出）',
  wired ? ('forwardCands ' + wired.forwards + ' 次 ‖ chooseCandidates ' + wired.chooseCandidatesCalls + ' 次') : ('抛了：' + wireErr));

/* ③ 配对评估：开 ⇒ 同代不同下标同种子；关 ⇒ 至少一代不同（有牙对照，防「开关空转」） */
const wasPaired = T.pairedEvalOn ? T.pairedEvalOn() : null;
let pairSame = false, pairDiff = false;
if (T.setPairedEval && T.evalSeedOf) {
  T.setPairedEval(true); pairSame = T.evalSeedOf(7, 0) === T.evalSeedOf(7, 3);
  T.setPairedEval(false);
  for (let g = 0; g < 8; g++) if (T.evalSeedOf(g, 0) !== T.evalSeedOf(g, 3)) { pairDiff = true; break; }
  T.setPairedEval(!!wasPaired);
}
chk(pairSame && pairDiff, '③ 配对：开 ⇒ 同代不同下标同种子；关 ⇒ 至少一代不同（有牙对照）', '开=' + pairSame + ' ‖ 关有差=' + pairDiff);

/* ④ 容器版本：v:90 + dims 必须被 shapeOf 判成现代分支（LEGACY 那条病根） */
let cont = null, sh = null, rt = false;
try {
  const w = P.makePolicy(0.2);
  sh = P.shapeOf ? P.shapeOf(w) : null;
  cont = P.pack ? P.pack(w) : null;
  const w2 = (cont && P.unpack) ? P.unpack(cont) : null;
  rt = !!(cont && cont.v === 90 && cont.dims && w2 && w2.length === w.length);
} catch (e) { sh = { err: String((e && e.message) || e) }; }
chk(!!(sh && sh.arch2 === true && sh.legacy === false) && rt, '④ 容器：v:90 + dims，且 shapeOf 必须判成现代分支（legacy=false）',
  sh ? ('shapeOf=' + JSON.stringify({ arch2: sh.arch2, legacy: sh.legacy }) + ' ‖ 容器往返=' + rt + (cont ? ' ‖ v=' + cont.v : '')) : 'pack/shapeOf 不可用');

if (A && A.restore) A.restore();   /* 预检不许把口径留在 2.0 */

/* ⑤ 功效：分辨 EFFECT pt 需要多少局/臂（SE ∝ 1/√n） */
const need = Math.ceil(N0 * Math.pow(SE0 * 2.8 / EFFECT, 2));
const det = Math.round(1000 * (SE0 * 2.8) / 2) / 1000;
chk(need > 0, '⑤ 功效：SE=' + SE0 + 'pt@' + N0 + ' 局 时，分辨 ' + EFFECT + 'pt 需要 ' + need + ' 局/臂（80% power）', '(' + (N0 * 4) + ' 局只分辨得到 ' + det + 'pt；配对评估可再降 2–4×)');

/* ⑥ 预算记账：臂的运行器必须按「实际局数」停并打印它 */
let src = '';
try { src = readFileSync(new URL('../../tools/probe-cem-arm.mjs', import.meta.url), 'utf8'); } catch (e) {}
const hasTarget = src.indexOf('targetGames') >= 0;
const hasActual = /实际局数|gamesActual|ACTUAL/.test(src);
chk(hasTarget && hasActual, '⑥ 预算：臂的运行器按「实际局数」停并打印它（标称 evals 与真实局数可差 15 倍）', 'targetGames=' + hasTarget + ' ‖ 实际局数回执=' + hasActual);

/* ⑦ 强度尺防退化（2026-10-29 DS 落 ‖ 千问 13:4x 把接线改成记录栏）：**两道纯函数门必须能红、且不许误红**
 *   ⚠ 这条判的是**函数本身有没有牙**，不是"promote 现在阻断不阻断"——
 *      ① 在 promote 里 10-29 起**只打印**（全池 30 枚有 5 枚 ≥60%、且 20 局那一档跨档能摆 12.6pt ⇒ 阈值+剂量待用户裁），
 *      ② 走研究侧硬失败（`ladder --guard` exit 4，且它现在还比锚的新鲜度）。 */
const dgBad = degeneracyVerdict({ maxCardShare: 0.95, maxCardKey: 'reflect', N: 400 });
const dgGood = degeneracyVerdict({ maxCardShare: 0.234, maxCardKey: 'gun', N: 400 });
const dgSmall = degeneracyVerdict({ maxCardShare: 0.9, maxCardKey: 'reflect', N: 40 });
const arBad = arenaGuardVerdict({ rungs: [{ key: 'reflect', win: 65.3 }, { key: 'snipe', win: 39.2 }], v7Win: 40.4 });
const arGood = arenaGuardVerdict({ rungs: [{ key: 'reflect', win: 20.0 }], v7Win: 40.4 });
const guardOk = dgBad.fail && !dgGood.fail && !dgSmall.fail && arBad.fail && !arGood.fail;
chk(guardOk, '⑦ 强度尺：单卡 ≥60% 必须红 ‖ 坏 arena（固定打法 ≥ v7）必须红 ‖ 样本不足不许判 ‖ 健康包/好 arena 不许误红',
  '退化包=' + (dgBad.fail ? '红✓' : '未红✗') + ' ‖ 健康包=' + (dgGood.fail ? '误红✗' : '绿✓') + ' ‖ 样本不足=' + (dgSmall.fail ? '误判✗' : '不判✓')
  + ' ‖ 坏arena=' + (arBad.fail ? '红✓' : '未红✗') + ' ‖ 好arena=' + (arGood.fail ? '误红✗' : '绿✓'));

const bad = rows.filter((r) => !r.ok);
if (JSONOUT) console.log(JSON.stringify({ rows, n: L.n, need }));
else console.log('\n⇒ ' + (bad.length ? '⛔ ' + bad.length + ' 项红：不许开臂（' + bad.map((r) => r.name.split('：')[0]).join(' / ') + '）' : '✅ 七项全过：可以开臂'));
process.exit(bad.length ? 1 : 0);
