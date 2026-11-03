#!/usr/bin/env node
/* game-record.mjs — 把一场 2.0 对局落成"旧式对局记录"（研究用 · DS · 2026-10-30）
 *
 * 为什么：`results/**` 里那些 `epirus-battle-*.txt` 是 Web UI 导出的真实对局，读起来能一眼看出"它在干什么"；
 *   而 2.0 的臂只有聚合读数（clean/夺1/单卡/byShape），没有逐回合记录 ⇒ 讨论"这包到底怎么打"时只能猜。
 * 本工具用**同一条引擎**（`T.oneGameN`）+ arena2 v2 的对手表/坐席轮换，把一局写成与 UI 同形的纯文本。
 *
 * 用法：node tools/proto2/game-record.mjs --pack=scratch/arms/BONS-s11.bak --temp=0.15 --mode=multi --n=5 \
 *         --seed=777 --field=strat --out=results/BONS-s11/n5-seed777.txt [--focus=0]
 *
 * 口径：
 *  · 对手表 = arena2 的 51 项 roster（同一轮换公式 `(gameSeq*7+pid*11+shapeIdx*13+salt)%len`），random 项跳过；
 *  · 被测席固定 `--focus`（缺省 0）；**不是** arena2 的"轮换被测席"——那样一局里只有一个席位是被测的，与旧记录可比；
 *  · 记录只写**公开信息**：对手蓄能只写"完成蓄能"（类型不公开，与 UI 规则一致）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
if (!PACK) { console.error('⛔ --pack=<bak>'); process.exit(2); }
const TEMP = Number(arg('temp', 0.15));
const MODE = arg('mode', 'multi');
const N = Math.max(2, Number(arg('n', 5)) || 5);
const SEED = Number(arg('seed', 777));
const FIELD = arg('field', 'strat') === 'avg' ? 'avg' : 'strat';
const OUT = arg('out', '');
const FOCUS = Math.max(0, Number(arg('focus', 0)) || 0);

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const ref = loadChamp(W, "js/bundled-champion-3p.js");
if (!ref) { console.error("⛔ 参照包读不出"); process.exit(2); }
/* 读包：先按 v7 原生形状试（loadChamp 能吃 v7 与 2P 外壳）；不行再当 2.0 容器解析。
 * ⚠️ 2.0 容器里 `dims` 是嵌套对象 ⇒ 不能用非贪婪正则截 JSON（会截在第一个内层 `}`），要花括号配平。 */
function balancedJson(s, at) {
  const i = s.indexOf("{", at); if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === "\"") inStr = false; continue; }
    if (ch === "\"") { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(i, k + 1); }
  }
  return null;
}
const srcTxt = readFileSync(PACK, "utf8");
let packParams = null;
{
  const v7 = loadChamp(W, PACK);
  if (v7 && v7.length) packParams = v7;
}
if (!packParams) {
  const at = srcTxt.indexOf("EPIRUS_CHAMPION_3P ");
  const jsonTxt = at >= 0 ? balancedJson(srcTxt, at) : null;
  if (!jsonTxt) { console.error("⛔ 读不出包（既不是 v7 可读形状，也不是 EPIRUS_CHAMPION_3P 容器）"); process.exit(7); }
  const raw = JSON.parse(jsonTxt);
  const got = packCfgExit(raw, PACK);            /* 代闸：代 1 的包不许按新网络读 */
  console.error("[容器代] " + got.era + " ‖ dof=" + (raw.dims && raw.dims.dof) + "（记录正文走 stdout，这行只进 stderr）");
  const cfg = got.cfg;
  installArch2(W, cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  packParams = Float64Array.from(P.unpack(raw, true));
  if (!packParams || packParams.length !== P.paramCount()) { console.error("⛔ 包形状不对 " + (packParams && packParams.length) + " vs " + P.paramCount()); process.exit(7); }
}
const A = createArena2(W, { refParams: Float64Array.from(ref), temp: TEMP, stratified: FIELD === "strat", stratCap: "2", stratMix: "0.5" });
const shapeIdx = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
if (shapeIdx < 0) { console.error("⛔ 没有桌形 " + N + ":" + MODE + "（可用：" + A.shapes.map((s) => s.n + ":" + s.mode).join(",") + "）"); process.exit(2); }
const SALT = 101;   /* arena2 的 SALT.loop */
const pk = T.policyChooserN(packParams, TEMP);

const nameOf = (pid, st) => (st.p[pid] && st.p[pid].name) || ("玩家" + (pid + 1));
const skillName = (k) => (R.byKey[k] && R.byKey[k].name) || k;
const byName = (b) => (R.byKey[b] && R.byKey[b].name) || b;

function evLine(e, st) {
  switch (e.type) {
    case 'action': return null;
    case 'damage': return '💥 ' + nameOf(e.to, st) + ' 受 ' + e.amt + ' 点伤害' + (e.reason && e.reason !== e.via ? '（' + e.reason + '）' : '');
    case 'heal': return '💚 ' + nameOf(e.pid, st) + ' 回复 ' + e.amt + ' 血' + (e.reason ? '（' + e.reason + '）' : '');
    case 'ep': return '🔋 ' + nameOf(e.pid, st) + ' ジ ' + (e.delta > 0 ? '+' : '') + e.delta;
    case 'bead': return e.delta > 0 ? ('✨ ' + nameOf(e.pid, st) + ' 完成蓄能' + (e.pid === FOCUS ? '（' + (e.kind === 'elec' ? '电珠' : '爆珠') + '）' : '（类型不公开）')) : ('✖ ' + nameOf(e.pid, st) + ' 消耗 1 ' + (e.kind === 'elec' ? '电珠' : '爆珠'));
    case 'beadExpire': return '⏳ ' + nameOf(e.pid, st) + ' 的蓄能珠过期';
    case 'mineArm': return '💣 ' + nameOf(e.pid, st) + ' 埋下地雷';
    case 'guardSet': return '🛡 ' + nameOf(e.pid, st) + ' 摆出【' + skillName(e.key) + '】架势';
    case 'holoSet': return '🛡 ' + nameOf(e.pid, st) + ' 用【全息屏障】护住 ' + nameOf(e.target, st);
    case 'blocked': return '🛡 ' + nameOf(e.to, st) + ' 的【' + (e.by ? byName(e.by) : '架势') + '】挡下伤害';
    case 'reflect': return '↩ ' + nameOf(e.from, st) + ' 的攻击被 ' + nameOf(e.to, st) + ' 弹回 → 伤害落到 ' + nameOf(e.from, st);
    case 'transfer': return '↩ ' + nameOf(e.to, st) + ' 把伤害转给 ' + nameOf(e.dest != null ? e.dest : e.from, st);
    case 'curse': return '🧧 ' + nameOf(e.owner, st) + ' 给 ' + nameOf(e.pid, st) + ' 贴上符咒';
    case 'taunt': return '📣 ' + nameOf(e.pid, st) + ' 对 ' + nameOf(e.target, st) + ' 挑衅';
    case 'voided': return '🚫 ' + nameOf(e.pid, st) + ' 的技能被无效化' + (e.by ? '（' + byName(e.by) + '）' : '');
    case 'cancel': return '⚔ 双方攻击相抵';
    case 'clash': return '⚔ 高优先级攻击阻止了对方攻击';
    case 'rod': return '☂ ' + nameOf(e.pids && e.pids[0], st) + ' 架起避雷针';
    case 'firestorm': return e.n > 0 ? ('🔥 ' + nameOf(e.pid, st) + ' 引燃 ' + e.n + ' 枚符咒') : (nameOf(e.pid, st) + ' 放出天火但没有符咒');
    default: return null;
  }
}

function actionTarget(evs, r, pid) {
  for (const e of evs) {
    if (!e || e.round !== r || e.source !== pid) continue;
    if (e.type === 'damage' || e.type === 'blocked' || e.type === 'reflect' || e.type === 'transfer') return e.to;
  }
  return null;
}

/* 事件不带 round（`js/core/state.js` 的 action 只记 pid/key/outcome）⇒ 用"一席一回合只出一手"重建回合号：
 *   遇到"本回合已出过手的 pid" ⇒ 新回合。场上死人不行动，所以每回合块大小会缩，不能按固定 N 切。 */
function tagRounds(evs) {
  const out = [];
  let round = 1;
  const seen = new Set();
  for (const e of evs) {
    if (e && e.type === "action") {
      if (seen.has(e.pid)) { round++; seen.clear(); }
      seen.add(e.pid);
      out.push({ e, round });
    } else out.push({ e, round });
  }
  return out;
}

function build(rm, label) {
  const st = rm.state;
  const tagged = tagRounds(st.events || []);
  let txt = "Epirus 拍手游戏 对局记录（研究·自动生成）\n";
  txt += "模式=" + MODE + "(" + (st.mode && st.mode.hp) + "血)  对手表=arena2 v2 " + (FIELD === "strat" ? "分层场" : "平均场") + "  温度=" + TEMP + "\n";
  txt += "包=" + PACK.replace(/^.*[\\/]/, "") + "  种子=" + SEED + "  被测席=" + (FOCUS + 1) + "\n";
  const seats = [];
  for (let i = 0; i < N; i++) seats.push((i === FOCUS ? "" : "") + nameOf(i, st) + "(" + (seatNames[i] || "?") + ")");
  txt += "坐席=" + seats.join(" ‖ ") + "\n\n";
  const maxRound = tagged.reduce((m, t) => Math.max(m, t.round), 0);
  for (let r = 1; r <= maxRound; r++) {
    const acts = [];
    for (let pid = 0; pid < N; pid++) {
      const a = tagged.find((t) => t.round === r && t.e.type === "action" && t.e.pid === pid);
      if (!a) continue;
      const tgt = tagged.find((t) => t.round === r && t.e.source === pid && (t.e.type === "damage" || t.e.type === "blocked" || t.e.type === "reflect" || t.e.type === "transfer"));
      acts.push(nameOf(pid, st) + "=【" + skillName(a.e.key) + (tgt ? "→" + nameOf(tgt.e.to, st) : "") + "】" + (a.e.outcome && a.e.outcome !== "ok" ? "(" + a.e.outcome + ")" : ""));
    }
    txt += "第 " + r + " 回合：" + acts.join("  ") + "\n";
    for (const t of tagged) {
      if (t.round !== r || t.e.type === "action") continue;
      const l = evLine(t.e, st);
      if (l) txt += "   - " + l + "\n";
    }
  }
  const w = st.winner;
  const res = w === "draw" || w == null ? "平局" : (st.p[w] ? st.p[w].name + " 获胜" : "平局");
  txt += "\n结果：" + res + "（共 " + st.round + " 回合）\n";
  txt += "血量=" + st.p.map((q, i) => nameOf(i, st) + ":" + Math.max(0, q.hp)).join(" ‖ ") + "\n";
  return txt;
}

const SALT2 = 5077;
const choosers = [];
const seatNames = [];
for (let pid = 0; pid < N; pid++) {
  if (pid === FOCUS) { choosers.push(pk); seatNames.push('【被测】' + PACK.replace(/^.*[\\/]/, '')); continue; }
  const gameSeq = 90000;
  let ri = (gameSeq * 7 + pid * 11 + shapeIdx * 13 + SALT) % A.roster.length;
  let e = A.roster[ri];
  while (e.kind === "random") { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
  choosers.push(e.sel);
  seatNames.push(e.name);
}
const rm = T.oneGameN(choosers, SEED, N, { regen: 0, mode: MODE });
const txt = build(rm, PACK);
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, txt, "utf8"); console.log("写出 " + OUT + "（" + txt.length + " 字符）"); }
else process.stdout.write(txt);