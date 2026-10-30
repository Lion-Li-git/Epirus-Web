#!/usr/bin/env node
/* skill-mastery.mjs — 长程技能"会 X"事件级审计尺（ZCode · 2026-10-30 深夜，P1）
 *
 * PREREG：docs/research/PREREG-2026-10-30-LONGSKILL-zcode.md（判据先于训练臂，d3acd1be）
 * 骑 arena2 v2 的 playOne（对手表/坐席轮换/种子公式同源，每局 resetBotMem；wantEvents=1 拿事件流）；
 * **包装被测席 chooser** 在决策时刻记录 round/key/target/ep/hp/珠/全场 lastSkill + 事件流游标，
 * 局后按窗口回放：成功 = action.ok ∧ 无 voided（与 resolve.js:1272 的 ringStreak 保活口径一致）。
 *
 * 判据（PREREG §二，六条活跃；短程按 §四 ×1/4）：
 *   1 ring    批内 ≥1 段三连（连续 3 回合 ring ok 未被无效化）
 *   2 bigT    ≥0.2 次/局（各格都要）
 *   3 railgun ≥0.35 次/局（各格）∧ chargeProfile('long').wasteRate<50%（珠经济单源，long 才判）
 *   4 laserEye≥0.2 次/局（各格）∧ ≥1/2 打"防席"（目标 lastSkill∈GUARD_FAMILY=rules.js:108）
 *   5 miniT   ≥0.2 次/局（各格）∧ ≥1/2 打 lastSkill∈{ring,bigT,railgun}
 *   6 cannon  "第3下打 ep 顶的三连"（复合事件，按用户原文字面）≥0.1 次/局（各格）
 * 观测列（不判线）：proto/transfer 出手率+时机旗（上回合被≥2源打/ep顶/hp最低）、transfer 命中率、
 *                   holo 出手率+目标分布（暂缓只记录）。
 *
 * 用法：
 *   node tools/proto2/skill-mastery.mjs --pack=a.bak[,b.bak,...] [--table=long] [--n=3,5]
 *        [--games=40] [--temp=0.15] [--out=results/x.json]
 *   node tools/proto2/skill-mastery.mjs --selftest [--pack=a.bak]   # 三腿自证，任一挂 exit 1
 *   pack 位置支持 'v7'（bundled 参照）与 'fixed:<key>'（only:* 阳性/阴性对照）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sandbox, loadChamp, chargeProfile } from '../audit-lib.mjs';
import { install as installArch2, packCfgExit } from './arch2.mjs';
import { createArena2, ARENA2_VERSION } from './arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const has = (k) => argv.indexOf('--' + k) >= 0;

const TABLE = arg('table', 'long');
const NCELLS = arg('n', '3,5').split(',').map((x) => Number(x)).filter((x) => x > 0);
const GAMES = Math.max(1, Number(arg('games', 40)) || 40);
const TEMP = Number(arg('temp', 0.15));
const SALT = 101; /* arena2 的 SALT.loop */
const PACKS = arg('pack', '').split(',').map((s) => s.trim()).filter(Boolean);

/* rules.js:108 的 GUARD_FAMILY（内部常量，key 镜像 + 启动自守；rules.js 若动这里会响） */
const GUARD_FAMILY = ['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor', 'proto', 'holo'];
const MINIT_TARGETS = ['ring', 'bigT', 'railgun'];
const LONG_LINES = { bigT: 0.2, railgun: 0.35, laserEye: 0.2, miniT: 0.2, cannon: 0.1 };
const SHORT_LINES = { bigT: 0.05, railgun: 0.09, laserEye: 0.05, miniT: 0.05 }; /* 长线 ×1/4（PREREG §四） */
const FREQ_KEYS = ['ring', 'bigT', 'railgun', 'laserEye', 'miniT', 'cannon', 'proto', 'transfer', 'holo'];

/* ---------- 装载（与 game-record.mjs 同一路数：v7 原生先试，再走 2.0 容器 + 代闸） ---------- */
function balancedJson(s, at) {
  const i = s.indexOf('{', at); if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return s.slice(i, k + 1); }
  }
  return null;
}
function loadPackParams(W, packPath) {
  if (packPath === 'v7') return Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js'));
  /* ⚑ 10-31 00:5x 修（diag-gate-vs-formal 抓到）：**先判容器再信 loadChamp**。
   *   病：v7 的 unpack 不做版本门 ⇒ 新沙箱上 loadChamp 把 v:91 容器当壳吃掉，返回 6122 维参数
   *   灌进 5689 维的 v7 网（截断重解释）——此前所有 v:91 包的"正式尺"读数都是错网。
   *   面对账：probe 门内审计（env 显式装 obs3）与 packCfgExit 面在产物上逐局一致 ⇒ 门没病，尺有病。 */
  const srcTxt = readFileSync(packPath, 'utf8');
  const at = srcTxt.indexOf('EPIRUS_CHAMPION_3P ');
  if (at >= 0) {
    const jsonTxt = balancedJson(srcTxt, at);
    if (jsonTxt) {
      const raw = JSON.parse(jsonTxt);
      if (raw && raw.dims) {   /* 2.0 容器标记 ⇒ 必须走 packCfgExit 单一出口（代闸 + 按包重建面） */
        const got = packCfgExit(raw, packPath);
        installArch2(W, got.cfg);
        if (W.EpirusPolicy.__arch2) W.EpirusPolicy.__arch2.rngRef.r = W.EpirusTrainer.mulberry32(4242);
        const params = Float64Array.from(W.EpirusPolicy.unpack(raw, true));
        if (!params || params.length !== W.EpirusPolicy.paramCount()) throw new Error('包形状不对：' + packPath + '（' + (params && params.length) + ' vs ' + W.EpirusPolicy.paramCount() + '）');
        return params;
      }
    }
  }
  /* v7 原生 / 2P 外壳 / 池代表（v:7, a:[...]） */
  const v7 = loadChamp(W, packPath);
  if (v7 && v7.length) return Float64Array.from(v7);
  throw new Error('读不出包：' + packPath);
}

/* ---------- 事件级审计：包装 chooser（零扰动）+ 游标窗口 ---------- */
export function makeAuditor() {
  const games = [];
  let cur = null;
  return {
    begin() { cur = { marks: [], picks: [] }; games.push(cur); },
    games,
    wrap(inner) {
      return function (state, pid, legal, events) {
        const p = state.p[pid];
        const snap = {
          round: state.round, pid,
          me: { ep: p.ep, hp: p.hp, elec: p.elec, boom: p.boom, cannonCount: p.cannonCount || 0, lastSkill: p.lastSkill || null },
          opps: [],
        };
        for (let i = 0; i < state.p.length; i++) {
          if (i === pid || !state.p[i] || state.p[i].hp <= 0) continue;
          const q = state.p[i];
          snap.opps.push({ pid: i, ep: q.ep, hp: q.hp, lastSkill: q.lastSkill || null });
        }
        const res = inner(state, pid, legal, events);
        const pk = (res && typeof res === 'object' && res.key) ? res : { key: (typeof res === 'string' ? res : null), target: null, target2: null, bead: null };
        cur.marks.push(state.events.length);
        cur.picks.push({ key: pk.key, target: pk.target == null ? null : pk.target, target2: pk.target2 == null ? null : pk.target2, bead: pk.bead || null, ...snap });
        return res; /* 原样返回 = 零扰动 */
      };
    },
  };
}

/* 局后回放：picks[i] 的回合窗口 = [marks[i], marks[i+1])（本回合结算 + 下回合开局前的全部事件） */
export function replay(audGame, evs) {
  const rows = [];
  for (let i = 0; i < audGame.picks.length; i++) {
    const pk = audGame.picks[i];
    const lo = audGame.marks[i], hi = (i + 1 < audGame.marks.length) ? audGame.marks[i + 1] : evs.length;
    let attempt = null, voided = false;
    const dmgToMe = [];
    for (let j = lo; j < hi; j++) {
      const e = evs[j];
      if (!attempt && e.type === 'action' && e.pid === pk.pid) attempt = e;
      if (e.type === 'voided' && e.pid === pk.pid) voided = true;
      if (e.type === 'damage' && e.to === pk.pid && e.amt > 0) dmgToMe.push({ src: e.source == null ? null : e.source, amt: e.amt });
    }
    rows.push({
      pick: pk,
      outcome: attempt ? attempt.outcome : 'no-attempt',
      attemptedKey: attempt ? attempt.key : null,
      ok: !!attempt && attempt.outcome === 'ok' && !voided,
      voided, dmgToMe,
    });
  }
  return rows;
}

/* ---------- 单包（或对照）审计 ---------- */
function auditOne(spec, opts) {
  const o = opts || {};
  const W = sandbox();
  const T = W.EpirusTrainer, R = W.EpirusRules;
  for (const k of GUARD_FAMILY) if (!R.byKey[k]) throw new Error('GUARD_FAMILY 键不存在：' + k + '（rules.js 改了键名？）');
  const ref = loadChamp(W, 'js/bundled-champion-3p.js');
  if (!ref) throw new Error('参照包读不出');
  const A = createArena2(W, { refParams: Float64Array.from(ref), temp: TEMP, wantEvents: 1 });

  let chooser, label, params = null;
  if (spec.startsWith('fixed:')) {
    const k = spec.slice(6);
    if (!R.byKey[k]) throw new Error('fixed 键不存在：' + k);
    chooser = A.fixed(k); label = 'only:' + k;
  } else if (spec === 'hybrid:railgun') {
    /* 阳性对照 v2（自证抓出来的前提修正）：railgun 有"需 1 电珠"的硬门（rawCost），fixed bot
     * 永远无珠 ⇒ only:railgun 是结构性 0，不是尺的阳性。真正会电磁炮的最小行为 = 蓄电珠→放电。 */
    chooser = function (state, pid) {
      const p = state.p[pid];
      if (p.elec >= 1) {
        let tgt = -1;
        for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) { tgt = i; break; }
        return { key: 'railgun', target: tgt >= 0 ? tgt : null };
      }
      return { key: 'charge', bead: 'elec' };
    };
    label = 'hybrid:railgun';
  } else {
    params = loadPackParams(W, spec);
    chooser = T.policyChooserN(params, TEMP);
    label = spec;
  }
  const { cells } = auditCells(W, A, chooser, NCELLS.map((n) => ({ n, table: TABLE })), GAMES, SALT);
  /* 珠经济单源（PREREG §二；fixed 对照没有 params → 跳过并标 n/a） */
  let bead = null;
  if (params) bead = chargeProfile(W, params, 'long', 20);
  const fp = A.fp;
  return { label, spec, table: TABLE, cells, bead, fp, gamesPerCell: GAMES, temp: TEMP };
}

/* ---------- 审计核心（模块出口：probe-cem-arm 的 mastery 门复用同一段，不另写第二套） ----------
 * cellsSpec: [{n, table}]；在给定 arena2 实例上跑 games 局/格并按判据口径累计。 */
export function auditCells(W, A, chooser, cellsSpec, games, salt) {
  const R = W.EpirusRules;
  const aud = makeAuditor();
  const wrapped = aud.wrap(chooser);
  const cells = [];
  for (const spec of cellsSpec) {
    const n = spec.n, table = spec.table;
    const idx = A.shapes.findIndex((s) => s.n === n && s.mode === table);
    if (idx < 0) throw new Error('没有桌形 ' + n + ':' + table + '（可用 ' + A.shapes.map((s) => s.n + ':' + s.mode).join(',') + '）');
    const st = {
      n, table, games: 0, rounds: 0, win: 0, clean: 0,
      okUses: {}, attempts: {},
      ringRuns: [],                       /* 本格全部 ok-ring 连段长度（诊断用） */
      chains: { ring: 0, cannon: 0, cannonEpMax: 0 },
      sem: { laserEyeHit: 0, laserEyeN: 0, miniTHit: 0, miniTN: 0 },
      obs: { proto: 0, transfer: 0, transferHit: 0, transferAmt: 0, holo: 0, protoHeat: 0, protoLead: 0, protoLow: 0, tHeat: 0, tLead: 0, tLow: 0, holoTargets: {} },
    };
    for (let g = 0; g < games; g++) {
      aud.begin();
      const r = A.playOne(wrapped, idx, g, salt);
      const evs = r.evs || [];
      const rows = replay(aud.games[aud.games.length - 1], evs);
      st.games++; st.rounds += r.rounds || 0; st.win += r.win ? 1 : 0; st.clean += r.clean ? 1 : 0;

      let ringRun = 0;
      const gRuns = [];                    /* 本局的 ok-ring 连段（断在失败/换招/死亡都算闭合） */
      let cannonRun = [];                  /* 连续 ok cannon 的 {phase, target, opps} */
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], pk = row.pick;
        st.attempts[pk.key] = (st.attempts[pk.key] || 0) + 1;
        if (!row.ok) {
          /* 断连段也要先落账：run 被"失败的一手"打断仍是已完成的连段 */
          if (ringRun > 0) gRuns.push(ringRun);
          ringRun = 0;
          flushCannon(st, cannonRun); cannonRun = [];
          continue;
        }
        st.okUses[pk.key] = (st.okUses[pk.key] || 0) + 1;
        /* 连段账本：ok 才延续（resolve.js:1272 口径） */
        if (pk.key === R.SK.RING) { ringRun++; } else { if (ringRun > 0) gRuns.push(ringRun); ringRun = 0; }
        if (pk.key === R.SK.CANNON) {
          cannonRun.push({ phase: (pk.me.cannonCount % 3) + 1, target: pk.target, opps: pk.opps });
        } else {
          flushCannon(st, cannonRun); cannonRun = [];
        }
        /* 语义计数 */
        if (pk.key === R.SK.LASER_EYE) {
          st.sem.laserEyeN++;
          if (isTargetWith(pk, GUARD_FAMILY)) st.sem.laserEyeHit++;
        }
        if (pk.key === R.SK.MINI_T) {
          st.sem.miniTN++;
          if (isTargetWith(pk, MINIT_TARGETS)) st.sem.miniTHit++;
        }
        /* 观测列：时机旗（对任何出手都算旗，报告时只看 proto/transfer 的） */
        const flags = riskFlags(row, rows, i);
        if (pk.key === R.SK.PROTO) {
          st.obs.proto++;
          if (flags.heat) st.obs.protoHeat++;
          if (flags.lead) st.obs.protoLead++;
          if (flags.low) st.obs.protoLow++;
        }
        if (pk.key === R.SK.TRANSFER) {
          st.obs.transfer++;
          if (flags.heat) st.obs.tHeat++;
          if (flags.lead) st.obs.tLead++;
          if (flags.low) st.obs.tLow++;
          const got = row.dmgToMe.filter((d) => d.src != null);
          if (got.length) { st.obs.transferHit++; st.obs.transferAmt += got.reduce((a, d) => a + d.amt, 0); }
        }
        if (pk.key === R.SK.HOLO) {
          st.obs.holo++;
          const tk = 'p' + (pk.target == null ? '?' : pk.target);
          st.obs.holoTargets[tk] = (st.obs.holoTargets[tk] || 0) + 1;
        }
      }
      if (ringRun > 0) gRuns.push(ringRun);
      flushCannon(st, cannonRun);
      for (const L of gRuns) { st.ringRuns.push(L); if (L >= 3) st.chains.ring++; }
    }
    /* 一格 = games 局的聚合 */
    cells.push(st);
  }
  return { cells, aud };
}
function flushCannon(st, run) {
  /* 三连 = 连续三回合 phase 1→2→3；非重叠扫三元组 */
  for (let i = 0; i + 2 < run.length; i++) {
    if (run[i].phase === 1 && run[i + 1].phase === 2 && run[i + 2].phase === 3) {
      st.chains.cannon++;
      const third = run[i + 2];
      if (third.opps.length) {
        const mx = Math.max.apply(null, third.opps.map((x) => x.ep));
        const t = third.opps.find((x) => x.pid === third.target);
        if (t != null && t.ep === mx) st.chains.cannonEpMax++;
      }
      i += 2;
    }
  }
}
function isTargetWith(pk, keyList) {
  if (pk.target == null) return false;
  const o = pk.opps.find((x) => x.pid === pk.target);
  return !!o && keyList.indexOf(o.lastSkill) >= 0;
}
/* 时机旗：heat=上一回合被 ≥2 个不同 source 打过；lead=我 ep 为存活(并列)最高；low=我 hp 为存活最低 */
function riskFlags(row, rows, i) {
  const heat = i > 0 && (new Set(rows[i - 1].dmgToMe.filter((d) => d.src != null && d.src !== row.pick.pid).map((d) => d.src))).size >= 2;
  const eps = row.pick.opps.map((x) => x.ep);
  const hps = row.pick.opps.map((x) => x.hp);
  const lead = eps.length > 0 && row.pick.me.ep >= Math.max.apply(null, eps);
  const low = hps.length > 0 && row.pick.me.hp < Math.min.apply(null, hps);
  return { heat, lead, low };
}

/* ---------- 判据汇总 ---------- */
const pct = (x) => (x * 100).toFixed(1) + '%';
function verdictOf(a) {
  const isShort = a.table === 'multi' || a.table === 'multi4';
  const L = isShort ? SHORT_LINES : LONG_LINES;
  const rate = (key, st) => (st.okUses[key] || 0) / Math.max(1, st.games);
  const minRate = (key) => Math.min.apply(null, a.cells.map((st) => rate(key, st)));
  const chainsAll = a.cells.reduce((s, st) => s + st.chains.ring, 0);
  const canAll = a.cells.reduce((s, st) => s + st.chains.cannon, 0);
  const canEp = a.cells.reduce((s, st) => s + st.chains.cannonEpMax, 0);
  const leN = a.cells.reduce((s, st) => s + st.sem.laserEyeN, 0), leH = a.cells.reduce((s, st) => s + st.sem.laserEyeHit, 0);
  const mtN = a.cells.reduce((s, st) => s + st.sem.miniTN, 0), mtH = a.cells.reduce((s, st) => s + st.sem.miniTHit, 0);
  const waste = a.bead ? a.bead.wasteRate : null;
  const v = {};
  v.ring = { pass: chainsAll >= 1, actual: chainsAll + ' 段三连', line: isShort ? '批内≥1' : '批内≥1' };
  v.bigT = { pass: minRate('bigT') >= L.bigT, actual: pct(minRate('bigT')) + '/局', line: L.bigT + '/局（各格）' };
  v.railgun = { pass: minRate('railgun') >= L.railgun && (isShort || (waste != null && waste < 0.5)), actual: pct(minRate('railgun')) + '/局' + (isShort || waste == null ? '' : '，浪费 ' + pct(waste)), line: L.railgun + '/局（各格）' + (isShort ? '' : ' ∧ 珠浪费<50%') };
  v.laserEye = { pass: minRate('laserEye') >= L.laserEye && (isShort || (leN > 0 && leH / leN >= 0.5)), actual: pct(minRate('laserEye')) + '/局，打防席 ' + leH + '/' + leN, line: L.laserEye + '/局（各格）' + (isShort ? '（语义只记录）' : ' ∧ 打防席≥1/2') };
  v.miniT = { pass: minRate('miniT') >= L.miniT && (isShort || (mtN > 0 && mtH / mtN >= 0.5)), actual: pct(minRate('miniT')) + '/局，反制 ' + mtH + '/' + mtN, line: L.miniT + '/局（各格）' + (isShort ? '（语义只记录）' : ' ∧ 打 ring/bigT/railgun 用户≥1/2') };
  v.cannon = { pass: isShort ? canAll >= 1 : minCannonRate(a) >= L.cannon, actual: (isShort ? canAll + ' 段' : pct(minCannonRate(a)) + '/局（对 ep 顶 ' + canEp + ' 段）'), line: isShort ? '批内≥1 段' : L.cannon + '/局（各格，第3下打ep顶）' };
  if (isShort) v.ring = { pass: chainsAll >= 1, actual: chainsAll + ' 段三连', line: '批内≥1（不许归零）' };
  return v;
}
function minCannonRate(a) {
  return Math.min.apply(null, a.cells.map((st) => st.chains.cannonEpMax / Math.max(1, st.games)));
}

/* ---------- 输出 ---------- */
function printPack(a) {
  const head = ['桌 ' + a.table + ' × n=' + NCELLS.join('/'), GAMES + ' 局/格', 't=' + a.temp, 'arena2.v' + ARENA2_VERSION, a.fp.split('|').slice(0, 2).join('|')].join(' ‖ ');
  console.log('\n=== ' + a.label + '（' + (a.spec.startsWith('fixed:') ? '对照' : a.spec) + '） ===');
  console.log('[' + head + ']');
  const cols = FREQ_KEYS;
  console.log('  ' + '格'.padEnd(7) + cols.map((k) => k.slice(0, 8).padStart(8)).join('') + '   胜%  净胜%  回合/局  三连(ring/can/canEp)');
  for (const st of a.cells) {
    const g = Math.max(1, st.games);
    const row = ('n=' + st.n).padEnd(7) + cols.map((k) => ((st.okUses[k] || 0) / g).toFixed(3).padStart(8)).join('') +
      pct(st.win / g).padStart(6) + pct(st.clean / g).padStart(7) + (st.rounds / g).toFixed(0).padStart(8) +
      ('  ' + st.chains.ring + '/' + st.chains.cannon + '/' + st.chains.cannonEpMax);
    console.log('  ' + row);
  }
  const v = verdictOf(a);
  const names = { ring: '会聚能环', bigT: '会大雷', railgun: '会电磁炮', laserEye: '会激光眼', miniT: '会小雷', cannon: '会过载炮' };
  console.log('  —— 判据（' + (a.table === 'long' ? '长程 PREREG §二' : '短程迁移 PREREG §四 ×1/4') + '）——');
  for (const k of Object.keys(v)) console.log('  ' + (v[k].pass ? '✔' : '✘') + ' ' + names[k].padEnd(5) + '  ' + v[k].actual + '   [线：' + v[k].line + ']');
  if (a.bead) console.log('  珠经济（chargeProfile long 单源）：蓄能/局 ' + a.bead.chargesPerGame.toFixed(1) + '，得 ' + a.bead.gained + ' 花 ' + a.bead.spent + '（电 ' + a.bead.spentElec + '/爆 ' + a.bead.spentBoom + '）过期 ' + a.bead.expired + ' ⇒ 浪费率 ' + pct(a.bead.wasteRate) + '，花珠率 ' + pct(a.bead.spentRate));
  const ob = { p: 0, t: 0, th: 0, ph: 0, pl: 0, pw: 0, th2: 0, tl2: 0, tw2: 0, h: 0 };
  for (const st of a.cells) {
    ob.p += st.obs.proto; ob.t += st.obs.transfer; ob.th += st.obs.transferHit;
    ob.ph += st.obs.protoHeat; ob.pl += st.obs.protoLead; ob.pw += st.obs.protoLow;
    ob.th2 += st.obs.tHeat; ob.tl2 += st.obs.tLead; ob.tw2 += st.obs.tLow; ob.h += st.obs.holo;
  }
  console.log('  观测列：proto ' + ob.p + ' 次（时机旗 被集火 ' + ob.ph + '/ep顶 ' + ob.pl + '/hp最低 ' + ob.pw + '）‖ transfer ' + ob.t + ' 次（当回合真受创 ' + ob.th + '；旗 ' + ob.th2 + '/' + ob.tl2 + '/' + ob.tw2 + '）‖ holo（暂缓只记录）' + ob.h + ' 次');
}

function poolSummary(all) {
  console.log('\n=== 池级汇总（⚠ 分母 = 本批候选集 ' + all.length + ' 枚，不是真池；PREREG §三 不produce 池级判词） ===');
  const names = { ring: '聚能环', bigT: '大雷', railgun: '电磁炮', laserEye: '激光眼', miniT: '小雷', cannon: '过载炮' };
  const need = { ring: '≥1/2', bigT: '≥1/2', railgun: '≥1/2', laserEye: '≥1/5', miniT: '≥1/5', cannon: '≥1/5' };
  for (const k of Object.keys(names)) {
    const ok = all.filter((a) => verdictOf(a)[k].pass).length;
    console.log('  ' + names[k].padEnd(4) + ' 会者 ' + ok + '/' + all.length + '（' + pct(ok / all.length) + '；目标 ' + need[k] + '）');
  }
}

function canon(a) {
  const v = verdictOf(a);
  return JSON.stringify({
    cells: a.cells.map((st) => ({ n: st.n, g: st.games, rounds: st.rounds, win: st.win, clean: st.clean, uses: st.okUses, att: st.attempts, ch: st.chains, sem: st.sem, obs: st.obs, runs: st.ringRuns })),
    bead: a.bead, verdict: v,
  });
}

/* ---------- 自证三腿 ---------- */
function selftest() {
  const pack0 = PACKS[0] || null;
  let fail = 0;
  const base = { n: '3', table: 'long' };
  console.log('[自证·A 阳性] fixed:ring / fixed:bigT / hybrid:railgun / fixed:miniT —— 频率必爆表（long n=3 × 12 局）');
  for (const [spec, key] of [['fixed:ring', 'ring'], ['fixed:bigT', 'bigT'], ['hybrid:railgun', 'railgun'], ['fixed:miniT', 'miniT']]) {
    const a = auditOne(spec, { games: 12 });
    const st = a.cells[0];
    const rate = (st.okUses[key] || 0) / Math.max(1, st.games);
    let ok;
    if (key === 'ring') ok = st.chains.ring >= 1;
    else if (key === 'railgun') ok = rate >= 0.35;
    else if (key === 'miniT') ok = rate >= 0.5 && st.sem.miniTN > 0;
    else ok = rate >= 0.5;
    console.log('  ' + (ok ? '✔' : '✘') + ' ' + a.label + '：' + key + ' ' + rate.toFixed(2) + '/局' + (key === 'ring' ? '，三连 ' + st.chains.ring + ' 段' : '') + (key === 'miniT' ? '（语义计数 n=' + st.sem.miniTN + '）' : ''));
    if (!ok) fail++;
  }
  console.log('[自证·B 阴性] fixed:gun —— 六条全 ✘');
  {
    const a = auditOne('fixed:gun', { games: 12 });
    const v = verdictOf(a);
    const allFail = Object.keys(v).every((k) => !v[k].pass);
    console.log('  ' + (allFail ? '✔' : '✘') + ' only:gun 判据全不过（' + Object.keys(v).map((k) => k + (v[k].pass ? '✔' : '✘')).join(' ') + '）');
    if (!allFail) fail++;
  }
  console.log('[自证·C 确定性] ' + (pack0 || 'fixed:bigT') + ' 连跑两遍逐项全等');
  {
    const spec = pack0 || 'fixed:bigT';
    const a1 = auditOne(spec, { games: 12 });
    const a2 = auditOne(spec, { games: 12 });
    const same = canon(a1) === canon(a2);
    console.log('  ' + (same ? '✔' : '✘') + ' 两遍计数逐项全等（behav-shift 模式）');
    if (!same) {
      fail++;
      console.log('  ⛔ 第一遍：' + canon(a1).slice(0, 400));
      console.log('  ⛔ 第二遍：' + canon(a2).slice(0, 400));
    }
  }
  console.log(fail === 0 ? '[自证] 三腿全过 ✔' : '[自证] ⛔ ' + fail + ' 腿挂 ⇒ 尺作废，先修再测');
  return fail === 0 ? 0 : 1;
}

/* ---------- main ---------- */
function main() {
  if (has('selftest')) process.exit(selftest());
  if (!PACKS.length) { console.error('用法：--pack=a.bak[,b.bak,...] | --selftest'); process.exit(2); }
  const all = [];
  for (const p of PACKS) {
    try { all.push(auditOne(p, { games: GAMES })); }
    catch (e) { console.error('⛔ ' + p + '：' + e.message); process.exit(7); }
  }
  for (const a of all) printPack(a);
  if (all.length > 1) poolSummary(all);
  const out = arg('out', '');
  if (out) {
    writeFileSync(out, JSON.stringify({
      meta: { tool: 'skill-mastery', table: TABLE, n: NCELLS, games: GAMES, temp: TEMP, arena2: 'v' + ARENA2_VERSION, prereg: 'PREREG-2026-10-30-LONGSKILL-zcode.md' },
      packs: all.map((a) => ({ label: a.label, spec: a.spec, fp: a.fp, bead: a.bead, cells: a.cells, verdict: verdictOf(a) })),
    }, null, 1));
    console.log('\n[JSON] ' + out);
  }
}
/* CLI 与模块双用：直接执行才跑 main；被 import（probe-cem-arm 的 mastery 门）时只出 auditCells/verdictOf 等 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
