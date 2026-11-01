#!/usr/bin/env node
/* play-interactive.mjs — 我（ZCode）作为真人玩家的对局驱动（11-01 下午 · 用户命题"自己作为玩家打几局感受特点"）
 *
 * 与 game-record.mjs 同一条引擎（T.oneGameN），但被我测席换成**我的出招队列**：
 *   --moves=ジ,ジ,枪→2,防御,…   （逗号分隔；`名字→n` 指定目标席 1..N，缺省打"血最低的活对手"；蓄能/电磁炮/激光眼默认电珠，写 `名字#爆` 选爆珠）
 *   队列耗尽或本手不合法 ⇒ 回落 ジ 并在记录里标注 (fallback)。
 * 对手：--opps=champ（两席都上线上冠军 T8-s114，= UI 的"困难·冠军"档）| s41（两席都上 GA-ration-s41，= UI"本机导入"行为）| mix（冠军+s41）。
 * 记录格式与 game-record 完全同形；--out 落盘。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, packCfgExit } from '../tools/proto2/arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const MOVES = String(arg('moves', '')).split(',').map(s => s.trim()).filter(Boolean);
const OPPS = arg('opps', 'champ');
const N = 3, TEMP = 0.15, MODE = 'multi', SEED = Number(arg('seed', 77001)) || 77001;
const OUT = arg('out', '');

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;

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
function readPackAny(path) {
  const srcTxt = readFileSync(path, "utf8");
  const at0 = srcTxt.indexOf("EPIRUS_CHAMPION_3P ");
  const j0 = at0 >= 0 ? balancedJson(srcTxt, at0) : null;
  const raw0 = j0 ? JSON.parse(j0) : null;
  if (raw0 && raw0.dims) {
    const got = packCfgExit(raw0, path);
    installArch2(W, got.cfg);
    if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
    return { params: Float64Array.from(P.unpack(raw0, true)), label: path.replace(/^.*[\\/]/, "") + "(2.0)" };
  }
  const v7 = loadChamp(W, path);
  if (!v7 || !v7.length) { console.error("⛔ 读不出包 " + path); process.exit(7); }
  return { params: Float64Array.from(v7), label: path.replace(/^.*[\\/]/, "") };
}
const CHAMP = readPackAny("js/bundled-champion-3p.js");
const S41 = readPackAny("scratch/ga-arms/GA-ration-s41.js");
const OPP_LABEL = { champ: [CHAMP, CHAMP], s41: [S41, S41], mix: [CHAMP, S41] }[OPPS] || [CHAMP, CHAMP];

const skillName = (k) => (R.byKey[k] && R.byKey[k].name) || k;
const keyByName = {};
for (const k of Object.keys(R.byKey)) keyByName[skillName(k)] = k;
const JI = R.SK && R.SK.JI ? R.SK.JI : keyByName["ジ"];

function humanChooser(queueRef) {
  return function (st, pid, cs) {
    const legal = cs || [];
    const aliveOpp = [];
    for (let q = 0; q < st.p.length; q++) if (q !== pid && st.p[q] && st.p[q].hp > 0) aliveOpp.push(q);
    aliveOpp.sort((a, b) => st.p[a].hp - st.p[b].hp);
    const pick = (wantName, wantBead) => {
      const wantKey = keyByName[wantName];
      let hit = legal.find((c) => c && c.key === wantKey && (!wantBead || c.bead === wantBead));
      if (!hit && wantBead) hit = legal.find((c) => c && c.key === wantKey);
      if (!hit) hit = legal.find((c) => c && c.key === wantKey);
      if (!hit) return null;
      /* 目标：记录里指定的席位号 > 血最低活对手；cand 已带 target 的（如防御/八卦阵）不动 */
      if (hit.target == null && hit.target2 == null && aliveOpp.length && "target" in hit) {
        const to = queueRef.tgt;
        if (to && st.p[to] && st.p[to].hp > 0 && to !== pid) hit = Object.assign({}, hit, { target: to });
        else hit = Object.assign({}, hit, { target: aliveOpp[0] });
      }
      return hit;
    };
    while (queueRef.i < queueRef.list.length) {
      const raw = queueRef.list[queueRef.i++];
      const m = raw.match(/^(.+?)#(爆|电)$/);
      const wantName = m ? m[1] : raw.replace(/→\d+$/, "");
      const wantBead = m ? (m[2] === "爆" ? "boom" : "elec") : (raw.indexOf("炮") >= 0 || wantName === "蓄能" ? "elec" : null);
      const tm = raw.match(/→(\d+)$/);
      queueRef.tgt = tm ? Number(tm[1]) - 1 : null;
      const hit = pick(wantName, wantBead);
      if (hit) return hit;
      queueRef.fell.push("第" + (queueRef.fell.length + 1) + "手不合法回落: " + wantName);
      return pick("ジ", null) || legal[0];
    }
    return pick("ジ", null) || legal[0];
  };
}
const myQueue = { i: 0, list: MOVES, tgt: null, fell: [] };
const meChooser = humanChooser(myQueue);

const ME = arg("me", "human");
const meLabel = ME === "champ" ? CHAMP.label + "(AI代打)" : (ME === "s41" ? S41.label + "(AI代打)" : "【真人】我");
const meChooserReal = ME === "champ" ? T.policyChooserN(CHAMP.params, TEMP) : (ME === "s41" ? T.policyChooserN(S41.params, TEMP) : meChooser);
const choosers = [meChooserReal];
for (const op of OPP_LABEL) choosers.push(T.policyChooserN(op.params, TEMP));

const seatNames = [meLabel, OPP_LABEL[0].label, OPP_LABEL[1].label];
const rm = T.oneGameN(choosers, SEED, N, { regen: 0, mode: MODE });
const st = rm.state;

/* ── 记录（与 game-record 同形）── */
function tagRounds(evs) {
  const out = []; let round = 1; const seen = new Set();
  for (const e of evs) {
    if (e && e.type === "action") { if (seen.has(e.pid)) { round++; seen.clear(); } seen.add(e.pid); }
    out.push({ e, round });
  }
  return out;
}
const byName = (b) => (R.byKey[b] && R.byKey[b].name) || b;
const nameOf = (pid) => (st.p[pid] && st.p[pid].name) || ("玩家" + (pid + 1));
function evLine(e) {
  switch (e.type) {
    case 'damage': return '💥 ' + nameOf(e.to) + ' 受 ' + e.amt + ' 点伤害' + (e.reason && e.reason !== e.via ? '（' + e.reason + '）' : '');
    case 'heal': return '💚 ' + nameOf(e.pid) + ' 回复 ' + e.amt + ' 血';
    case 'ep': return '🔋 ' + nameOf(e.pid) + ' ジ ' + (e.delta > 0 ? '+' : '') + e.delta;
    case 'bead': return e.delta > 0 ? ('✨ ' + nameOf(e.pid) + ' 完成蓄能' + (e.pid === 0 ? '（' + (e.kind === 'elec' ? '电珠' : '爆珠') + '）' : '（类型不公开）')) : ('✖ ' + nameOf(e.pid) + ' 消耗 1 ' + (e.kind === 'elec' ? '电珠' : '爆珠'));
    case 'beadExpire': return '⏳ ' + nameOf(e.pid) + ' 的蓄能珠过期';
    case 'mineArm': return '💣 ' + nameOf(e.pid) + ' 埋下地雷';
    case 'guardSet': return '🛡 ' + nameOf(e.pid) + ' 摆出【' + skillName(e.key) + '】架势';
    case 'holoSet': return '🛡 ' + nameOf(e.pid) + ' 用【全息屏障】护住 ' + (typeof e.target === 'string' ? e.target : (e.target != null ? nameOf(e.target) : '?'));
    case 'blocked': return '🛡 ' + nameOf(e.to) + ' 的【' + (e.by ? byName(e.by) : '架势') + '】挡下伤害';
    case 'reflect': return '↩ ' + nameOf(e.from) + ' 的攻击被 ' + nameOf(e.to) + ' 弹回 → 伤害落到 ' + nameOf(e.from);
    case 'transfer': return '↩ ' + nameOf(e.to) + ' 把伤害转给 ' + nameOf(e.dest != null ? nameOf(e.dest) : nameOf(e.from));
    case 'curse': return '🧧 ' + nameOf(e.owner != null ? nameOf(e.owner) : '?') + ' 给 ' + nameOf(e.pid) + ' 贴上符咒';
    case 'taunt': return '📣 ' + nameOf(e.pid) + ' 对 ' + nameOf(e.target != null ? nameOf(e.target) : '?') + ' 挑衅';
    case 'voided': return '🚫 ' + nameOf(e.pid) + ' 的技能被无效化' + (e.by ? '（' + byName(e.by) + '）' : '');
    case 'cancel': return '⚔ 双方攻击相抵';
    case 'clash': return '⚔ 高优先级攻击阻止了对方攻击';
    case 'rod': return '☂ 架起避雷针';
    case 'firestorm': return e.n > 0 ? ('🔥 ' + nameOf(e.pid) + ' 引燃 ' + e.n + ' 枚符咒') : (nameOf(e.pid) + ' 放出天火但没有符咒');
    default: return null;
  }
}
const tagged = tagRounds(st.events || []);
let txt = "Epirus 拍手游戏 对局记录（真人试玩 · ZCode）\n";
txt += "模式=" + MODE + "(" + (st.mode && st.mode.hp) + "血)  对手=" + OPP_LABEL.map(o => o.label).join("+") + "  温度=" + TEMP + "\n";
txt += "我的队列=" + MOVES.join(",") + "\n";
if (myQueue.fell.length) txt += "回落注记=" + myQueue.fell.join(" ‖ ") + "\n";
txt += "坐席=" + seatNames.map((n, i) => nameOf(i) + "(" + n + ")").join(" ‖ ") + "\n\n";
const maxRound = tagged.reduce((m, t) => Math.max(m, t.round), 0);
for (let r = 1; r <= maxRound; r++) {
  const acts = [];
  for (let pid = 0; pid < N; pid++) {
    const a = tagged.find((t) => t.round === r && t.e.type === "action" && t.e.pid === pid);
    if (!a) continue;
    const tgt = tagged.find((t) => t.round === r && t.e.source === pid && ["damage", "blocked", "reflect", "transfer"].includes(t.e.type));
    acts.push(nameOf(pid) + "=【" + skillName(a.e.key) + (tgt ? "→" + nameOf(tgt.e.to) : "") + "】" + (a.e.outcome && a.e.outcome !== "ok" ? "(" + a.e.outcome + ")" : ""));
  }
  if (!acts.length) continue;
  txt += "第 " + r + " 回合：" + acts.join("  ") + "\n";
  txt += "    ┌终局 " + st.p.map((q, i) => nameOf(i) + " hp" + Math.max(0, q.hp) + "/ジ" + (q.ep != null ? q.ep : "?") + (q.beads && q.beads.length ? "/珠" + q.beads.length : "")).join(" ‖ ") + "\n";
  for (const t of tagged) { if (t.round !== r || t.e.type === "action") continue; const l = evLine(t.e); if (l) txt += "   - " + l + "\n"; }
}
const w = st.winner;
txt += "\n结果：" + (w === "draw" || w == null ? "平局" : (st.p[w] ? nameOf(w) + " 获胜" : "平局")) + "（共 " + st.round + " 回合）\n";
txt += "血量=" + st.p.map((q, i) => nameOf(i) + ":" + Math.max(0, q.hp)).join(" ‖ ") + "\n";
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, txt, "utf8"); console.log("写出 " + OUT); }
process.stdout.write(txt);
