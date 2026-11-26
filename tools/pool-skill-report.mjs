#!/usr/bin/env node
/* pool-skill-report.mjs —— 池级 skill-report 合并尺（v3 · 2026-11-19 凌夜 · PLAN-2026-11-18-late 批 1b）
 *
 * 两级一体（用户 11-18/19 裁定）：
 *   Stage 1 观察层（**进图默认**）＝ 跨环境使用普查：对手矩阵（fixtures.tsv 声明）× 人数 2/3/5/8 × multi/long
 *     → 120 格/包，产出技能并集/每技能环境覆盖率/桶钉换招 JS/镜像失真（机制逐字承 scratch/probes/probe-crossenv-skill.mjs，
 *       那把尺 11-16 在册；本文件把它从 scratch 归位并钉现役夹具）。
 *   Stage 2 强度层（**入池触发**）＝ 分层强度 A/B：把 skill-report.mjs 的 INSTR 配方表自动化——
 *     按技能族挑对手场（破防/反制/AoE/反应/辅助/经济），双经济读数（Δ_rich 潜力 / Δ_nat 实际），
 *     边界技能按 needPair 自适应续局（≤24 局/组）；A/B 核心与 skill-report.mjs 共用 `strength-lib.mjs`（AGENTS §4）。
 *
 * 用法：
 *   node tools/pool-skill-report.mjs --stage=1 --all-pool [--jobs=8]     # 在池全量观察层
 *   node tools/pool-skill-report.mjs --stage=1 --pack=<id>               # 单枚观察
 *   node tools/pool-skill-report.mjs --stage=2 --pack=<id>               # 单枚强度（入池时；需已有 Stage 1）
 *   node tools/pool-skill-report.mjs --stage=2 --pack=<id> --shortlist=tank,purify   # 死卡强测（覆盖=0 也测）
 *   node tools/pool-skill-report.mjs --bake                              # 烘 champion-map/skill-report.html
 *
 * 产物：champion-map/data/skill-report/<id>.json（Stage 1/2 同文件合并）＋ fixtures.tsv 留痕。
 * 戳：每份 raw 带 fixtureKey / rulesFingerprint / wid / measuredAt —— AGENTS §7「不同夹具的读数不混表」。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, cardUsageProfile, rejectUnknownFlags } from './audit-lib.mjs';
import { widOf } from '../champion-map/pack-id.mjs';
import { OPP_SPECS } from '../training/server/opp-pool.mjs';
import { rulesFingerprint } from './rules-fingerprint.mjs';
import { createStrengthCore } from './strength-lib.mjs';
import { hpEpBucket, jsDiv } from './switch-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['stage', 'pack', 'packs', 'all-pool', 'jobs', 'games-census', 'games-strength',
  'max-strength-games', 'shortlist', 'out', 'bake', 'coverth', 'temp', 'candidate'], 'pool-skill-report');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const h = process.argv.find(a => a.indexOf('--' + k + '=') === 0); return h ? h.split('=')[1] : d; };
const has = k => process.argv.includes('--' + k);
const STAGE = Number(arg('stage', 0)) || 0;
const GAMES_CENSUS = Math.max(1, Number(arg('games-census', 10)) || 10);
const GAMES_STRENGTH = Math.max(2, Number(arg('games-strength', 6)) || 6);
const MAX_STRENGTH_GAMES = Math.max(GAMES_STRENGTH, Number(arg('max-strength-games', 24)) || 24);
const COVERTH = Math.max(1, Number(arg('coverth', 3)) || 3);
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const DATA_DIR = join(ROOT, arg('out', 'champion-map/data/skill-report'));
const POOL_TSV = join(ROOT, 'champion-map/data/page/pool-members.tsv');
/* ① 命名（PLAN §1.6）：合并尺 = pool-skill-report；产物页 = champion-map/skill-report.html */

const FIXTURES_TSV = join(ROOT, 'champion-map/data/skill-report/fixtures.tsv');
function readFixturesSpec() {
  const rows = readFileSync(FIXTURES_TSV, 'utf8').split('\n').map(s => s.replace(/\r/g, '').trim()).filter(s => s && !s.startsWith('#'));
  const kv = {};
  for (const r of rows) {
    const [k, v] = r.split('\t');
    if (k && v != null) kv[k] = v.trim();
  }
  if (!kv.fixtureKey || !kv['real-opponents']) {
    console.error('⛔ fixtures.tsv 缺 fixtureKey 或 real-opponents 列');
    process.exit(2);
  }
  const realOpps = kv['real-opponents'].split(',').map(s => s.trim()).filter(Boolean);
  return { fixtureKey: kv.fixtureKey, realOpps };
}
const { fixtureKey: FIXTURE_KEY, realOpps: DECLARED_REAL_OPPS } = readFixturesSpec();   /* 单一真源在 fixtures.tsv，防池滚动后静默混用旧 fixtureKey（AGENTS §7/§8） */
/* 观察层脚本对手（承 crossenv 11-16 的 10 名单，全部在 OPP_SPECS） */
const CENSUS_SCRIPTS = ['gunspam', 'wall', 'baguaspam', 'guardgun', 'heavyfire', 'deepsaver', 'ringspam', 'tankline', 'targeter', 'beadburst'];
/* 真包对手 = 现役池 hard 带前 4 + soft 带前 1（表序；随池滚动，fixtureKey 换代 ⇒ 换列族） */
const REAL_RULE = 'hard 头 4 + soft 头 1（pool-members.tsv 表序）';

/* ===== Stage 2 分层格（PLAN §1.3 表；opps 每组 4 个 = 1 冠军席 + 4 对手；两组去对手偏置） ===== */
const STRATA = {
  break: { label: '破防族', n: 5, mode: 'multi', econ: 'both', seed: 556001, combos: [['wall', 'baguaspam', 'protowall', 'guardspam'], ['guardgun', 'reflectspam', 'tankline', 'protowall']] },
  counter: { label: '反制族', n: 5, mode: 'multi', econ: 'both', seed: 557001, combos: [['ringspam', 'beadburst', 'deepsaver', 'farmer'], ['ringspam', 'gunfocus', 'snipespam', 'heavyfire']] },
  aoe: { label: 'AoE族', n: 8, mode: 'multi', econ: 'native', seed: 558001, combos: [['gunspam', 'wall', 'heavyfire', 'targeter', 'guardgun', 'beadburst', 'balanced'], ['deepsaver', 'ringspam', 'tankline', 'aggro', 'mix', 'farmer', 'random']] },
  react: { label: '反应族', n: 5, mode: 'long', econ: 'both', seed: 559001, combos: [['cursestorm', 'heavyfire', 'prototransfer', 'gunspam'], ['tankline', 'beadburst', 'targeter', 'cursestorm']] },
  util: { label: '辅助防御族', n: 5, mode: 'multi', econ: 'rich', seed: 560001, combos: [['heavyfire', 'gunspam', 'targeter', 'snipespam'], ['aggro', 'tankline', 'gunfocus', 'breakdef']] },
  econ: { label: '经济族(multi)', n: 5, mode: 'multi', econ: 'native', seed: 561001, combos: [['gunspam', 'guardgun', 'deepsaver', 'farmer'], ['balanced', 'mix', 'random', 'tankline']] },
  econLong: { label: '经济族(long)', n: 5, mode: 'long', econ: 'native', seed: 562001, combos: [['gunspam', 'guardgun', 'deepsaver', 'farmer'], ['balanced', 'mix', 'random', 'tankline']] },
  mixed: { label: '默认攻击族', n: 5, mode: 'multi', econ: 'both', seed: 563001, combos: [['gunspam', 'wall', 'heavyfire', 'balanced'], ['aggro', 'tankline', 'mix', 'targeter']] },
};
/* 死卡短名单（A 层七张 + purify；dualGun/mirror 裁定「可没有」不进） */
const DEFAULT_SHORTLIST = ['tank', 'jinshield', 'armor', 'miniT', 'rod', 'firestorm', 'taunt', 'purify'];
const SK_NAME = { tank: '坦克', jinshield: '金刚盾', armor: '藤甲', miniT: '雷击之枪', rod: '避雷针', firestorm: '天火', taunt: '挑衅', purify: '净化', drain: '摄魂指法', transfer: '转移伤害', ring: '聚能环', laserEye: '激光眼', cannon: '过载炮' };

function loadPool() {
  const lines = readFileSync(POOL_TSV, 'utf8').split('\n').map(s => s.replace(/\r/g, '')).filter(Boolean);
  const head = lines[0].split('\t');
  const idIx = head.indexOf('id'), widIx = head.indexOf('wid'), pathIx = head.indexOf('path'), tierIx = head.indexOf('tier');
  if (idIx < 0 || pathIx < 0 || tierIx < 0) throw new Error('pool-members.tsv 列名不对：' + head.join(','));
  return lines.slice(1).map(l => {
    const c = l.split('\t');
    return { id: c[idIx], wid: c[widIx], path: c[pathIx], tier: c[tierIx] };
  });
}

function realPackFixtures(pool) {
  const hard = pool.filter(m => m.tier === 'hard').slice(0, 4);
  const soft = pool.filter(m => m.tier === 'soft').slice(0, 1);
  return [...hard, ...soft].map(m => ({ id: m.id, path: m.path }));
}

function pickPacks(pool, argPack, argPacks, allPool) {
  if (allPool) return pool.map(m => m.id);
  const ids = [];
  if (argPack) ids.push(...argPack.split(',').map(s => s.trim()).filter(Boolean));
  if (argPacks) ids.push(...argPacks.split(',').map(s => s.trim()).filter(Boolean));
  const known = new Set(pool.map(m => m.id));
  const bad = ids.filter(id => !known.has(id));
  if (bad.length) { console.error('⛔ 不在池表的包 id：' + bad.join(',') + '（在册包才进池级 report；候选请先入图）'); process.exit(2); }
  return ids;
}

/* ===== Stage 1 观察层（机制逐字承 probe-crossenv-skill.mjs evalPack；夹具钉现役） =====
 * ⚠ 对手 chooser 必须在**被测包同一个沙箱**里构建（policy 推理与引擎缓存不能跨 W 混用）
 *   ⇒ 这里收描述符（{name, kind:'script'|'real', fn|path}），chooser 在本函数内建。 */
function closureRow(uses, paid, wasted, unit) {
  return { uses, paid, wasted, unit, rate: uses >= 20 ? paid / uses : null, readable: uses >= 20 };
}

function aggregateClosure(cells) {
  const out = {};
  for (const c of cells) for (const [k, v] of Object.entries(c.closure || {})) {
    const shape = c.n + ':' + c.mode;
    const a = out[k] || (out[k] = { uses: 0, paid: 0, wasted: 0, unit: v.unit, byShape: {} });
    a.uses += v.uses; a.paid += v.paid; a.wasted += v.wasted;
    const s = a.byShape[shape] || (a.byShape[shape] = { uses: 0, paid: 0, wasted: 0 });
    s.uses += v.uses; s.paid += v.paid; s.wasted += v.wasted;
  }
  for (const v of Object.values(out)) {
    v.rate = v.uses >= 20 ? v.paid / v.uses : null;
    v.readable = v.uses >= 20;
    for (const s of Object.values(v.byShape)) s.rate = s.uses >= 20 ? s.paid / s.uses : null;
  }
  return out;
}

function stage1(W, pack, oppDesc, gamesCensus) {
  const R = W.EpirusRules, T = W.EpirusTrainer, B = W.EpirusBots;
  const params = loadChamp(W, pack.path);
  const base = T.policyChooserN(params, TEMP);
  const bead = { elecGained: 0, elecSpent: 0, elecExpired: 0, boomGained: 0, boomSpent: 0, boomExpired: 0 };
  const curseStats = { curseOk: 0, curseLanded: 0, firestormOk: 0, firestormHits: 0,
    /* 按局闭环（11-24 夜班加）：聚合次数分不开"没学过出这一手"与"学了但从没闭环"，
     *   而用户的裁定是「宁可不贴，也不要不闭环」⇒ 这一维必须按局记，不能从次数反推。
     *   stickGames = 本局贴到过（`curse` 事件 owner=被测席）；loopGames = 贴过且本局至少一次引爆真吃到符（`n>0`）；
     *   boomGames = 本局出过引爆手（不管吃没吃到）；emptyBoomGames = 出手引爆但 `n=0`（空转）的次数。 */
    stickGames: 0, loopGames: 0, boomGames: 0, emptyBoomGames: 0,
    /* 机会 vs 出手（11-24 夜班加 · 分两种病的唯一办法）：R64（`js/core/state.js:160-172`）把
     *   "没有自己贴出的可引爆符咒"的天火**挡在 legal 之外**，所以
     *     `fsLegalDecisions` = 决策点上天火**可用**（既合法又买得起才算，legal 已过滤）的次数；
     *     `fsTakenWhenLegal` = 其中真出了天火的次数。
     *   ⇒ 差值就是「**有机会却没爆**」，它才是裁定要治的那一种；而 `fsLegalDecisions=0` 的包
     *     是"根本没造出可引爆的局面"，治它得改贴的时机/剂量，不是骂它不闭环。
     * ⚠ 我差点先加一个 `curseBlocked` 计数，但 `resolve.js:1261` 的 `curseBlock` 是
     *   "**贴**被对方盾挡"（`pid: t` 是被贴者），与 R64 无关，而且 `curseOk − curseLanded` 已经等于它
     *   ⇒ 加了只会造出一个看着精确的冗余字段，已撤。 */
    fsLegalDecisions: 0, fsTakenWhenLegal: 0 };
  const oppChoosers = oppDesc.map(od => {
    if (od.kind === 'script') {
      if (typeof B[od.fn] !== 'function') { console.error('⛔ 脚本对手取不到：' + od.name + '（fn=' + od.fn + '）'); process.exit(2); }
      return [od.name, T.wrapBotN(B[od.fn]), false];
    }
    if (!existsSync(join(ROOT, od.path))) { console.error('⛔ 真包对手文件不存在：' + od.name + ' ' + od.path); process.exit(2); }
    const p = loadChamp(W, od.path);
    if (!p) { console.error('⛔ 真包对手读不出：' + od.name + ' ' + od.path); process.exit(2); }
    return [od.name, T.policyChooserN(p, TEMP), true];
  });
  let curCell = null, decN = 0;
  const wrapped = function (state, pid, legal) {
    decN++;
    const got = base(state, pid, legal);
    const key = got && (got.key || got);
    /* 天火机会 vs 出手（定义见 curseStats 处的注）：只在被测席的决策点上数，且照抄别处的 legal 形状 */
    if (Array.isArray(legal) && legal.some((l) => l && l.key === R.SK.FIRESTORM)) {
      curseStats.fsLegalDecisions++;
      if (key === R.SK.FIRESTORM) curseStats.fsTakenWhenLegal++;
    }
    const bk = hpEpBucket(state, pid);
    curCell.buckets[bk] = curCell.buckets[bk] || {};
    curCell.buckets[bk][key] = (curCell.buckets[bk][key] || 0) + 1;
    curCell.keys[key] = (curCell.keys[key] || 0) + 1;
    return got;
  };
  const NS = [2, 3, 5, 8], MODES = ['multi', 'long'];
  const closureKeys = new Set([R.SK.CURSE, R.SK.FIRESTORM, R.SK.MINE, R.SK.TAUNT, R.SK.ROD, R.SK.HOLO,
    R.SK.TRANSFER, R.SK.PURIFY, R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.SHIFT, R.SK.JINSHIELD,
    R.SK.ARMOR, R.SK.PROTO, R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.MINI_T, R.SK.BIG_T]);
  const cells = [];
  for (const [oname, oppCh, isReal] of oppChoosers) {
    for (const n of NS) for (const mode of MODES) {
      const cell = { opp: oname, real: isReal, n, mode, games: 0, win: 0, keys: {}, buckets: {}, closure: {},
        bead: { elecGained: 0, elecSpent: 0, elecExpired: 0, boomGained: 0, boomSpent: 0, boomExpired: 0 } };
      curCell = cell;
      for (let g = 0; g < gamesCensus; g++) {
        const seat = g % n;
        const choosers = [];
        for (let pid = 0; pid < n; pid++) choosers.push(pid === seat ? wrapped : oppCh);
        const gseed = 910000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977 + (isReal ? 7919 : 0);
        const r = T.oneGameN(choosers, gseed, n, { mode });
        cell.games++;
        cell.win += T.rankOf(r.state, seat, gseed) === 1 ? 1 : 0;
        /* 闭环按局判定（第二遍扫同一份 events，不改上面那台的任何计数 ⇒ 老读数逐字不动） */
        {
          const used = new Set(), paid = new Set(), holoTargets = new Set(), tauntTargets = new Set();
          let gStick = 0, gBoomHit = 0, gBoomEmpty = 0;
          const roundActors = new Set();
          for (const e of ((r.state && r.state.events) || [])) {
            if (e.type === 'action') {
              if (roundActors.has(e.pid)) roundActors.clear();
              roundActors.add(e.pid);
              if (e.pid === seat && e.outcome === 'ok') {
                if (closureKeys.has(e.key) && e.key !== R.SK.CURSE) used.add(e.key);
                if (e.key === R.SK.TAUNT && e.target != null) tauntTargets.add(e.target);
                if (e.key === R.SK.CURSE) curseStats.curseOk++;
                else if (e.key === R.SK.FIRESTORM) curseStats.firestormOk++;
              }
            } else if (e.type === 'curse' && e.owner === seat) {
              gStick++;
              curseStats.curseLanded++;
            } else if (e.type === 'firestorm' && e.pid === seat) {
              if ((e.n || 0) > 0) { gBoomHit++; paid.add(R.SK.FIRESTORM); } else gBoomEmpty++;
              curseStats.firestormHits += (e.n || 0);
            } else if (e.type === 'mine' && (e.from === seat || (Array.isArray(e.from) && e.from.includes(seat)))) {
              paid.add(R.SK.MINE);
            } else if (e.type === 'rod' && e.mode === 'A' && Array.isArray(e.pids) && e.pids.includes(seat) && e.voided && e.voided.length > 0) {
              paid.add(R.SK.ROD);
            } else if (e.type === 'rodBlock' && e.pid === seat) {
              paid.add(R.SK.ROD);
            } else if (e.type === 'tauntCheck' && e.pid != null && tauntTargets.has(e.pid)) {
              /* !e.ok = 对手违约并被「挑衅违约」直扣 1 血；e.ok 仅在挑衅者未先阵亡（非 impossible）时计作逼出合规攻击 */
              if (!e.ok || roundActors.has(seat)) paid.add(R.SK.TAUNT);
            } else if (e.type === 'holoSet' && e.pid === seat) {
              used.add(R.SK.HOLO);
              if (e.target != null) holoTargets.add(e.target);
            } else if (e.type === 'transfer' && e.to === seat && e.dest != null && (e.amt || 0) > 0) {
              paid.add(R.SK.TRANSFER);
            } else if (e.type === 'purify' && e.pid === seat) {
              if ((e.curses || 0) > 0) paid.add(R.SK.PURIFY);
            } else if ((e.type === 'blocked' || e.type === 'reflect') && (e.amt || 0) > 0) {
              const by = e.by;
              if ((by === '原型制御' || by === 'proto') && holoTargets.has(e.to)) paid.add(R.SK.HOLO);
              if (e.to !== seat) continue;
              if (by === '防御') paid.add(R.SK.GUARD);
              else if (by === '反弹' || by === 'reflect') paid.add(R.SK.REFLECT);
              else if (by === '藤甲' || by === 'armor') paid.add(R.SK.ARMOR);
              else if (by === '八卦阵') { paid.add(R.SK.BAGUA); paid.add(R.SK.SHIFT); }
              else if (by === '金刚盾') paid.add(R.SK.JINSHIELD);
              else if (by === '原型制御' || by === 'proto') paid.add(R.SK.PROTO);
            } else if (e.type === 'damage' && e.source === seat && (e.amt || 0) > 0 && closureKeys.has(e.via)) {
              paid.add(e.via);
            } else if (e.type === 'bead' && e.pid === seat) {
              const cnt = Math.abs(e.delta || 0);
              const bucket = (e.delta || 0) > 0 ? 'Gained' : 'Spent';
              if (e.kind === 'boom') { bead['boom' + bucket] += cnt; cell.bead['boom' + bucket] += cnt; }
              else { bead['elec' + bucket] += cnt; cell.bead['elec' + bucket] += cnt; }
            } else if (e.type === 'beadExpire' && e.pid === seat) {
              const cnt = Math.abs(e.n != null ? e.n : (e.delta != null ? e.delta : 1));
              if (e.kind === 'boom') { bead.boomExpired += cnt; cell.bead.boomExpired += cnt; }
              else { bead.elecExpired += cnt; cell.bead.elecExpired += cnt; }
            }
          }
          for (const k of used) {
            const row = cell.closure[k] || (cell.closure[k] = { uses: 0, paid: 0, wasted: 0, unit: 'games' });
            row.uses++;
            if (paid.has(k)) row.paid++; else row.wasted++;
          }
          if (gStick) {
            curseStats.stickGames++;
            if (gBoomHit) curseStats.loopGames++;
            const row = cell.closure[R.SK.CURSE] || (cell.closure[R.SK.CURSE] = { uses: 0, paid: 0, wasted: 0, unit: 'games' });
            row.uses++;
            if (gBoomHit) row.paid++; else row.wasted++;
          }
          if (gBoomHit || gBoomEmpty) curseStats.boomGames++;
          curseStats.emptyBoomGames += gBoomEmpty;
        }
      }
      const cb = cell.bead;
      cell.closure.charge = closureRow(cb.elecGained + cb.boomGained, cb.elecSpent + cb.boomSpent,
        cb.elecExpired + cb.boomExpired, 'events');
      cells.push(cell);
    }
  }
  curCell = null;
  const union = new Set(); for (const c of cells) for (const k of Object.keys(c.keys)) union.add(k);
  const coverage = {};
  for (const k of union) coverage[k] = cells.filter(c => (c.keys[k] || 0) >= COVERTH).length;
  const closure = aggregateClosure(cells);
  for (const c of cells) { delete c.closure; delete c.bead; }
  const mk = real => {
    const m = {};
    for (const c of cells.filter(c => c.real === real)) {
      for (const bk of Object.keys(c.buckets)) {
        m[bk] = m[bk] || {};
        for (const k of Object.keys(c.buckets[bk])) m[bk][k] = (m[bk][k] || 0) + c.buckets[bk][k];
      }
    }
    return m;
  };
  const S = mk(false), Rp = mk(true);
  let pairSum = 0, pairN = 0;
  for (const bk of Object.keys(S)) {
    if (!Rp[bk]) continue;
    const totS = Object.values(S[bk]).reduce((a, b) => a + b, 0);
    const totR = Object.values(Rp[bk]).reduce((a, b) => a + b, 0);
    if (totS >= 30 && totR >= 30) { pairSum += jsDiv(S[bk], Rp[bk]); pairN++; }
  }
  const cuL = cardUsageProfile(W, params, { games: 15, mode: 'long' });
  const cuM = cardUsageProfile(W, params, { games: 15, mode: 'multi' });
  const selfKeys = new Set([...Object.keys(cuL.pct || {}), ...Object.keys(cuM.pct || {})]);
  const winBy = {};
  for (const c of cells) winBy[c.opp + '@' + c.n + c.mode[0]] = { w: c.win, g: c.games };
  const totalUses = {}; for (const c of cells) for (const k of Object.keys(c.keys)) totalUses[k] = (totalUses[k] || 0) + c.keys[k];
  return {
    unionN: union.size, selfUnionN: selfKeys.size,
    envOnlySkills: [...union].filter(k => !selfKeys.has(k)),
    selfOnlySkills: [...selfKeys].filter(k => !union.has(k)),
    coverage, totalUses, totalCells: cells.length, decN, closure,
    switchJs: pairN ? +(pairSum / pairN).toFixed(4) : null, switchJsCells: pairN,
    winRate: +(cells.reduce((a, c) => a + c.win, 0) / cells.reduce((a, c) => a + c.games, 0)).toFixed(4),
    bead, curseStats,
    winBy, cells,
  };
}

/* ===== Stage 2 强度层（skill-report.mjs INSTR 配方自动化；核心共用 strength-lib） ===== */
function strataFor(W, key) {
  const R = W.EpirusRules;
  const d = R.byKey[key];
  if (!d) return ['mixed'];
  if (d.cat === 'energy') return ['econ', 'econLong'];
  if (d.cat === 'defense') return ['util'];
  if (R.LIGHTNING.includes(key) || key === 'rod') return ['counter'];
  if (d.target2 || key === 'mine' || key === 'firestorm') return ['aoe'];
  if (key === 'drain' || key === 'transfer' || key === 'purify') return ['react'];
  if (d.pierce && (d.pierce.defense || d.pierce.reflect)) return ['break'];
  return ['mixed'];
}

const NAME2FN = {};
for (const o of OPP_SPECS) NAME2FN[o.name] = o.fn;

function stage2(W, pack, st1, opts) {
  const R = W.EpirusRules;
  const params = loadChamp(W, pack.path);
  const B = W.EpirusBots;
  const shortlist = String(opts.shortlist || DEFAULT_SHORTLIST.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  /* 分层格 combos 用 OPP_SPECS **名字**声明（fixtures.tsv 同口径），跑之前翻译成 Bot 函数名（strength-lib 吃函数名） */
  const fnCombos = stName => STRATA[stName].combos.map(c => c.map(nm => {
    const fn = NAME2FN[nm];
    if (!fn || typeof B[fn] !== 'function') throw new Error('分层格脚本对手无效：' + stName + ' ' + nm);
    return fn;
  }));
  /* 技能选择门（PLAN §1.3）：覆盖>0 ∪ 短名单；ji（0 费回资源，且重复落在 econ/econLong 两格）/dualGun/mirror 不进强度消融 */
  const SKIP = new Set(['ji', 'dualGun', 'mirror']);
  const sel = [];
  for (const key of (R.skills || []).map(d => d.key)) {
    if (SKIP.has(key)) continue;
    const cov = st1 && st1.coverage ? (st1.coverage[key] || 0) : 0;
    const uses = st1 && st1.totalUses ? (st1.totalUses[key] || 0) : 0;
    if (cov > 0 || uses > 0 || shortlist.includes(key)) sel.push({ key, cov, uses });
  }
  /* 在池判定（消融 vs 强制）：普查决策占比 ≥1%（承 skill-report USE_BAN 口径，分母换成普查决策数） */
  const inUse = new Set(sel.filter(s => st1 && st1.decN > 0 && (s.uses / st1.decN) >= 0.01).map(s => s.key));
  const results = [];
  const cores = {};   // 每 (stratum, games) 复用 core；games 变化时改 ctx.games
  function coreFor(stName, games) {
    const st = STRATA[stName];
    const ck = stName + '@' + games;
    if (!cores[ck]) {
      cores[ck] = createStrengthCore({ W, champ: params, n: st.n, mode: st.mode, pairs: fnCombos(stName), games, temp: TEMP, richConst: 10, targetPt: 2 });
    } else cores[ck].ctx.games = games;
    return cores[ck];
  }
  for (const stName of Object.keys(STRATA)) {
    const st = STRATA[stName];
    const members = sel.filter(s => strataFor(W, s.key).includes(stName));
    if (!members.length) continue;
    const core0 = coreFor(stName, GAMES_STRENGTH);
    const ctl = { rich: core0.runCondition(null, true, st.seed), nat: core0.runCondition(null, false, st.seed) };
    for (const s of members) {
      const key = s.key;
      const rec = { key, name: SK_NAME[key] || (R.byKey[key] && R.byKey[key].name) || key, stratum: stName, inUse: inUse.has(key), arms: [] };
      if (inUse.has(key)) {
        /* 消融臂（承 skill-report v1.4.10：已在用 ⇒ 拿掉比强制 spam 准） */
        const ban = core0.runCondition(null, false, st.seed, null, key);
        const pd = core0.pairedDiff(ctl.nat, ban);
        rec.arms.push({ kind: 'ban', econ: 'native', games: st.combos.length * core0.ctx.games, deltaLost: -pd.d, se: pd.se, forceHit: null });
      } else {
        /* 强制双臂：Δ_rich（潜力）与 Δ_nat（实际）——原尺只算 rich，这里补 nat（PLAN §1.3） */
        const acc = { tries: 0, hit: 0 };
        let games = GAMES_STRENGTH;
        let rich = core0.runCondition(key, true, st.seed, acc);
        let nat = core0.runCondition(key, false, st.seed);
        let pdR = core0.pairedDiff(ctl.rich, rich), pdN = core0.pairedDiff(ctl.nat, nat);
        /* 自适应续局（原尺 needPair 列自动化）：分不出且预算内 ⇒ 双臂同续（种子前缀稳定） */
        const noisy = Math.max(pdR.se || 0, pdN.se || 0);
        if (noisy > 0 && Math.max(Math.abs(pdR.d), Math.abs(pdN.d)) <= 1.96 * noisy) {
          const need = Math.min(MAX_STRENGTH_GAMES, Math.max(core0.needGamesPerPair(noisy) || GAMES_STRENGTH, GAMES_STRENGTH));
          if (need > games) {
            games = need;
            const core1 = coreFor(stName, need);
            ctl.rich = core1.runCondition(null, true, st.seed); ctl.nat = core1.runCondition(null, false, st.seed);
            rich = core1.runCondition(key, true, st.seed, acc); nat = core1.runCondition(key, false, st.seed);
            pdR = core1.pairedDiff(ctl.rich, rich); pdN = core1.pairedDiff(ctl.nat, nat);
          }
        }
        rec.arms.push({ kind: 'forced', econ: 'rich', games: st.combos.length * games, delta: pdR.d, se: pdR.se, forceHit: acc.tries ? acc.hit / acc.tries : 0 });
        rec.arms.push({ kind: 'forced', econ: 'native', games: st.combos.length * games, delta: pdN.d, se: pdN.se, forceHit: acc.tries ? acc.hit / acc.tries : 0 });
      }
      results.push(rec);
    }
  }
  return { shortlist, selected: sel.map(s => s.key), inUse: [...inUse], results };
}

/* ===== 主流程 ===== */
function runOne(stage, pack, oppDesc) {
  const W = sandbox(ROOT);
  const outPath = join(DATA_DIR, pack.id + '.json');
  let doc = {};
  if (existsSync(outPath)) { try { doc = JSON.parse(readFileSync(outPath, 'utf8')); } catch (e) { doc = {}; } }
  const t0 = Date.now();
  if (stage === 1) {
    doc.stage1 = stage1(W, pack, oppDesc, GAMES_CENSUS);
  } else if (stage === 2) {
    if (!doc.stage1) { console.error('⛔ ' + pack.id + ' 没有 Stage 1 观察层产物（先 --stage=1）——强度分层格的选择门依赖它'); process.exit(2); }
    doc.stage2 = stage2(W, pack, doc.stage1, { shortlist: arg('shortlist', '') || null });
  } else {
    console.error('⛔ --stage 只认 1|2'); process.exit(2);
  }
  doc.id = pack.id; doc.wid = pack.wid; doc.tier = pack.tier;
  doc.rulesFingerprint = rulesFingerprint();
  doc.fixtureKey = FIXTURE_KEY;
  doc.measuredAt = new Date().toISOString();
  doc.stageSec = +((Date.now() - t0) / 1000).toFixed(1);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 1), 'utf8');
  const u = doc.stage1 ? ('并集 ' + doc.stage1.unionN + '/30（自对局 ' + doc.stage1.selfUnionN + '） 换招JS ' + doc.stage1.switchJs) : '';
  const s2 = doc.stage2 ? (' ‖ 强度 ' + doc.stage2.results.length + ' 技（消融 ' + doc.stage2.results.filter(r => r.inUse).length + '）') : '';
  console.log('[' + pack.id + '] stage' + stage + ' ' + u + s2 + ' ‖ ' + doc.stageSec + 's → ' + outPath);
  return doc;
}

function main() {
  const pool = loadPool();
  /* `--candidate=<path[,path]>`：**入池之前**也能量一枚候选（11-24 夜班加）。
   *   为什么必须开：`pickPacks` 原来只认在册池表 id（"候选请先入池"），而闭环这类判据恰恰要在准入判断
   *   **之前**量候选 ⇒ "先入池才能量、量完才知道该不该入池"是死结。
   *   候选只进本次内存表与 `--out=` 指定的目录，**不写任何池表**；与在册枚同名一律拒绝（不许顶掉现役件）。 */
  const candIds = [];
  for (const cp of (arg('candidate', '') || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!existsSync(cp)) { console.error('⛔ --candidate 件不在盘上：' + cp); process.exit(2); }
    const cid = cp.split(/[\\/]/).pop().replace(/\.bak$/, '');
    if (pool.some((m) => m.id === cid)) { console.error('⛔ --candidate 解析出的 id 与在册枚同名：' + cid + ' ⇒ 改用不带冲突的文件名，别顶掉现役件'); process.exit(2); }
    let cwid = ''; try { cwid = widOf(readFileSync(cp, 'utf8')); } catch (e) { cwid = ''; }
    if (!cwid) { console.error('⛔ --candidate ' + cp + ' 解不出 wid ⇒ 不是可读的权重件，拒绝'); process.exit(2); }
    pool.push({ id: cid, wid: cwid, path: cp, tier: 'candidate' });
    candIds.push(cid);
    console.log('# 候选枚（只此一次，不落池表）：' + cid + ' wid=' + cwid);
  }
  if (has('bake')) {
    import('../champion-map/build-skill-page.mjs').then(m => m.bake({ quiet: false }));
    return;
  }
  if (!STAGE) { console.error('用法：--stage=1|2 ＋ --pack=<id> ‖ --all-pool [--jobs=N] ‖ --bake'); process.exit(2); }
  /* 对手夹具 = 描述符（chooser 在每个包自己的沙箱里现建，见 stage1 头注） */
  const byName = {};
  for (const o of OPP_SPECS) byName[o.name] = o.fn;
  const oppDesc = CENSUS_SCRIPTS.map(nm => {
    if (typeof byName[nm] !== 'string') { console.error('⛔ 观察层脚本对手不在 OPP_SPECS：' + nm); process.exit(2); }
    return { name: nm, kind: 'script', fn: byName[nm] };
  });
  const realFixtures = realPackFixtures(pool);
  if (STAGE === 1) {
    const curReal = realFixtures.map(f => f.id).sort().join(',');
    const decReal = [...DECLARED_REAL_OPPS].sort().join(',');
    if (curReal !== decReal) {
      console.error('⛔ 现役池真包夹具已变：' + curReal + ' !== fixtures.tsv 声明的 ' + decReal +
        '\n   ⇒ 先更新 champion-map/data/skill-report/fixtures.tsv 的 fixtureKey 与 real-opponents 再重扫（AGENTS §7/§8）');
      process.exit(2);
    }
  }
  for (const f of realFixtures) oppDesc.push({ name: f.id, kind: 'real', path: f.path });
  const ids = pickPacks(pool, arg('pack', ''), arg('packs', ''), has('all-pool'));
  /* 只给 `--candidate=` 而不给 `--pack/--all-pool` 以前是**静默空转**：候选进了内存表、
   *   `pickPacks` 却不认它 ⇒ `ids=[]`、一个 `runOne` 都不跑、目录都不建、退出码 0。
   *   11-24 夜班实测（三枚臂喂进去 ⇒ stdout 只有三行"候选枚"横幅，`scratch/skill-report-grid/` 根本不存在）。
   *   现在：候选本身就是要量的那几枚，并且**跑完必须逐枚见到产物**，否则响亮退出。 */
  if (!ids.length && candIds.length) {
    console.log('# 只给了 --candidate ⇒ 就量这 ' + candIds.length + ' 枚候选（不落任何池表）');
    ids.push(...candIds);
  }
  if (!ids.length) { console.error('⛔ 一枚都没挑到（给 --pack= / --all-pool= / --candidate= 三者之一）⇒ 不跑、不写、退出码非 0'); process.exit(2); }
  const jobs = Math.max(1, Math.min(Number(arg('jobs', 1)) || 1, 16));
  console.log('# 落盘目录 = ' + DATA_DIR + (jobs > 1 ? '（并行 ' + jobs + ' 路，旗标逐字转给子进程）' : ''));
  if (ids.length === 1 || jobs === 1) {
    for (const id of ids) runOne(STAGE, pool.find(m => m.id === id), oppDesc);
    const noArt = ids.filter((id) => !existsSync(join(DATA_DIR, id + '.json')));
    if (noArt.length) { console.error('⛔ 跑完了却没有产物：' + noArt.join(' ‖ ') + '（该目录 ' + DATA_DIR + '）⇒ 这次测量不算数'); process.exit(3); }
  } else {
    /* 多包并行：按包拆子进程（各自写各自 JSON，无共享状态） */
    let done = 0, fail = 0;
    const pending = [...ids];
    const workers = new Array(Math.min(jobs, ids.length)).fill(0).map(() => new Promise(res => {
      function next() {
        const id = pending.shift();
        if (!id) return res();
        const cp = spawn(process.execPath, [join('tools', 'pool-skill-report.mjs'), '--stage=' + STAGE, '--pack=' + id,
          '--games-census=' + GAMES_CENSUS, '--games-strength=' + GAMES_STRENGTH, '--max-strength-games=' + MAX_STRENGTH_GAMES,
          /* `--out=`/`--coverth=` 必须**逐字传给子进程**：并行分支以前只转 stage/pack/games 三样，
           *   于是 `--all-pool --jobs=6 --out=scratch/…` 的产物会静默落回在册目录（11-24 夜班实测踩到，
           *   25 枚 `champion-map/data/skill-report/*.json` 就这么被就地重写了）。**下面那行落盘目录横幅就是为这条而加**：
           *   跑了才知道写在哪，别让人去猜。 */
          ...(arg('out', '') ? ['--out=' + arg('out', '')] : []),
          /* 候选必须一起转：子进程只拿 `--pack=<候选 id>` 会在 `pickPacks` 那里被判"不在池表"⇒
           *   并行 + 候选 这一组合原来必红，而红在子进程里、母进程只报 fail=N（11-24 夜班顺手补）。 */
          ...(arg('candidate', '') ? ['--candidate=' + arg('candidate', '')] : []),
          ...(arg('coverth', '') ? ['--coverth=' + arg('coverth', '')] : []),
          ...(arg('shortlist') ? ['--shortlist=' + arg('shortlist')] : [])], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        cp.stdout.on('data', d => process.stdout.write(d));
        cp.stderr.on('data', d => process.stderr.write(d));
        cp.on('exit', c => { if (c !== 0) fail++; done++; next(); });
      }
      next();
    }));
    Promise.all(workers).then(() => {
      console.log('\n==== ' + done + '/' + ids.length + ' 包完成（fail=' + fail + '）fixture=' + FIXTURE_KEY + ' fp=' + rulesFingerprint() + ' ====');
      process.exit(fail ? 1 : 0);
    });
    return;
  }
  if (ids.length > 1) console.log('==== ' + ids.length + ' 包完成 fixture=' + FIXTURE_KEY + ' fp=' + rulesFingerprint() + ' ====');
}
main();
