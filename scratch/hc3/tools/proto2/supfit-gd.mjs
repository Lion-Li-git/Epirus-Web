#!/usr/bin/env node
/* supfit-gd.mjs — A 臂：教师蒸馏的**精确梯度**版（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §二A）
 *
 * 与 chain-supfit（CEM 版蒸馏）唯一变量 = 求解器：
 *   数据管线逐字镜像（同随机流/同教师/同 800 组/同 75-25 切/同 lockTarget:false/同 temp=1/同 1-类频加权），
 *   CEM@sig0.08×80代×pop32 → Adam + 反传（tapeBackward，selftest3 六腿先行）。
 * 目标 = 加权键级对数似然（教师给键；键内候选是同一手的珠/目标变体）：
 *   loss = −Σ_gr w(wantKey)·log kProb[wantKey]，u_j = −w·dLogKeyP。
 * 对表基准（scratch/arms/supfit-w1.bak.meta.json）：留出同键 top-1 75.5% ‖ 加权似然 −1.429 ‖ railgun 39/39。
 * ⚑ 读数纪律：lr 只按**训练**似然挑（不偷看留出），挑完的档才报留出。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogKeyP, dLogPi } from './pg-lib.mjs';
import { pickChain } from './chain-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['upstream', 'groups', 'lr', 'steps', 'seed', 'out', 'tag', 'objective', 'dagger', 'dagtemp', 'pool', 'shapeBal', 'keySplit', 'teacher'], 'supfit-gd');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('upstream', 'scratch/arms/OB3S-C2-s7.bak'));
const NGRP = Math.max(60, Number(arg('groups', 800)) || 800);
const LR = Number(arg('lr', 0.02)) || 0.02;
const STEPS = Math.max(10, Number(arg('steps', 400)) || 400);
const SEED = Number(arg('seed', 20261031)) || 20261031;
const OUT = String(arg('out', 'scratch/arms/supfit-gd1.bak'));
const TAG = String(arg('tag', ''));
/* ⚑ 目标层级（千问 · 10-31 午后补，A 臂读数的另一半）：
 *   `key`（默认 = ZCode 的 A 臂，逐字不变）= 键级似然 `log P(key)`。两级 softmax 的键层取 `bestOf`
 *     （键内最大 logit）⇒ 梯度只碰"当前键内赢的那一枚"，**从不表态该赢哪一枚**。而 `policy.js:680`
 *     给「蓄能」两枚同键候选（bead=elec/boom），电珠才是电磁炮的门票（`state.js` RAILGUN 需 p.elec≥1，
 *     珠只活一回合 resolve.js:1296）⇒ 键级蒸馏可以 100% 学会"该等"，却把珠蓄成爆珠（实测 gd1：电 51 / 爆 576）。
 *   `cand` = 候选级似然 `log π(教师那一枚)`（dLogPi，selftest3 腿 C 已数值对账）⇒ 珠种/目标都在标签里。 */
const OBJ = String(arg('objective', 'key'));
if (OBJ !== 'key' && OBJ !== 'cand') { console.error('⛔ --objective 只认 key|cand（收到 ' + OBJ + '）'); process.exit(2); }
/* DAgger（§十三 边界②的正解）：轮数默认 0 ⇒ 只有教师自访，路径与 A 臂逐字同 */
const DAG = Math.max(0, Math.min(6, Number(arg('dagger', 0)) || 0));
const DAG_TEMP = Number(arg('dagtemp', 0.15));
const POOL = Math.max(NGRP, Number(arg('pool', 1200)) || 1200);
/* `--shapeBal=1`：把采集配额**摊到全部桌形**（默认 0 = 现役顺序档：够 NGRP 就停 ⇒ 800 组只落在前 2 个桌形里，
 *   这是 10-31 夜里查出来的采集覆盖洞：考场 11 个桌形、采集只见 2 个）。 */
const SHAPEBAL = Number(arg('shapeBal', 0)) ? 1 : 0;
/* `--keySplit=1`：把上游按**代 3**（v:92，键层按决策键分组）装载并出货 ⇒ 用来直接检验 Stage A：
 *   同一个**键级**目标，旧口径下珠种靠起点抽签、新口径下珠种进入键层。参数量不变（DK 只改分组）。 */
const KS = Number(arg('keySplit', 0)) ? 1 : 0;   /* 训练池上限（教师 600 永远保留，学生态按新旧裁） */

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
/* ⚑ 跨代搬运（Stage B 之后唯一的一条搬运路）：代 2 的容器段表里带 `qHead`（33 个没有任何目标函数读的参数），
 *   而代 3 的尺只认代 3 ⇒ `packCfgExit` 的代闸会把旧包**响亮拒读**（那正是它的作用，不是障碍）。
 *   所以要吃旧包就必须把"我在重解释"写在明面上：cfg 从 dims 手拼 + 参数数组砍掉 qHead 那一段。
 *   砍掉它不改变策略算出的任何一手 —— 这条不是嘴上说的，验收见 §二十（前后 7993 个参数逐位同）。 */
const srcSegQ = ((raw.layout && raw.layout.seg) || []).find((x) => x.name === 'qHead');
const srcDims = raw.dims || {};
const got = srcSegQ
  ? { cfg: { mutMode: 'seg', seatH: srcDims.seatH, actH: srcDims.actH, hid: srcDims.hid, hid2: srcDims.hid2,
             input: srcDims.input, inter: srcDims.inter || 0, tinter: srcDims.tinter || 0, gen: 3, keySplit: KS },
      gen: 3, era: '代 ' + (srcDims.gen || '?') + ' → 代 3（显式砍 qHead ' + srcSegQ.len + ' 个参数）', carried: srcSegQ }
  : packCfgExit(raw, UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg, (KS ? { gen: 3, keySplit: 1 } : {})));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const up = (() => {
  if (got.carried) {
    console.log('  ⚑ 跨代搬运：从源容器去掉 qHead 段 [' + got.carried.off + ',' + (got.carried.off + got.carried.len) + ') 共 ' + got.carried.len + ' 个参数（代 3 无价值头）');
    const a = Float64Array.from(raw.a || []);
    const t = new Float64Array(a.length - got.carried.len);
    t.set(a.subarray(0, got.carried.off), 0);
    t.set(a.subarray(got.carried.off + got.carried.len), got.carried.off);
    return t;
  }
  return P.unpack(raw, true);
})();
if (!up || up.length !== P.paramCount()) { console.error('⛔ 上游读不出/参数数不符：' + UP + '（' + (up ? up.length : 'null') + ' vs ' + P.paramCount() + '）'); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: 0.15, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });

/* ---- 收集：与 chain-supfit 逐字同流（seed 20261030 LCG、同 salt/局号、同教师、同克隆）----
 * ⚑ `--dagger=R`（默认 0）：round 0 = 教师自访（= A 臂原样，局号 300000+/盐 4242）；
 *   之后每轮换**学生自己走出来的状态**再标一次教师（`--dagTemp` 部署温度）⇒ 正面治 §十三 边界②"协变量漂移"。
 *   默认路径（R=0）不碰任何一局学生自访、不改变 RNG 消耗次序 ⇒ 产物必须与 `supfit-gd1.bak` 逐位同（这条是回归腿）。 */
let seed = 20261030;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
/* `--teacher=v7mix`（ZCode · 10-31 晚，产品卷反差的一号修法）：链覆写（pickChain 优先）+ **其余全交 v7 价值 argmax**。
 *   为什么：产品考卷（eval-5p 420 局）实测纯链教师的学生"出手种类=3"（ジ/蓄/炮）、含深经济对手 Δ=−19.2pt ——
 *   忠实的攒够链模仿物是**桶专家**不是全能冠军；教师里只会弃权（ji）的那一格，学生原样学成"除了链什么都不做"。
 *   v7 读数走 fit2 的同款入口 `P.value(state,pid,key,params,sh,cand)`（形参次序有在册勘误，别动）。
 *   默认 `chain` 逐字不变（回归腿：`--teacher=chain` 产物与已登记 md5 对表）。 */
const TEACHER = String(arg('teacher', 'chain'));
const v7Pick = (state, pid, cs) => {
  let bi = -1, bv = -Infinity;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const v = P.value(state, pid, c.key, refParams, null, c);
    if (Number.isFinite(v) && v > bv) { bv = v; bi = i; }
  }
  return bi >= 0 ? cs[bi] : null;
};
const teacherPick = TEACHER === 'v7mix'
  ? (state, pid, cs) => pickChain(state, pid, cs, R) || v7Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : (state, pid, cs) => pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0];
const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0 };
/* 打出去的那一手 vs 教师（只在学生自访轮里量）——与 `LABEL`（克隆态 argmax 口径）是**两个不同的数** */
const PLAY = { n: 0, hit: 0, stuckCharge: 0, missCharge: 0, missFire: 0 };

function collectInto(dst, srcParams, idBase) {
  let curShp = -1;   /* 当前桌形（覆盖自证用） */
  const record = (state, pid, legal) => {
    if (!(legal && legal.length >= 2)) return;
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    if (cs.length < 2) return;
    const t0 = teacherPick(state, pid, cs);
    if (!t0) return;
    const cl = S.cloneState(state); cl.rng = { next: rnd };
    const cs2 = P.candidatesFor(cl, pid, T.econBase(cl, pid, legal), { lockTarget: false }) || [];
    const again = teacherPick(cl, pid, cs2);
    if (!again || !cs2.length) { LABEL.gone++; return; }
    /* tape 的输入与参数无关 ⇒ 收集时算一次，之后任意参数重放（单源：arch2 wantTape） */
    const fr = P.forwardCands(cl, pid, cs2, up, { temp: 1, wantTape: 1 });
    /* ⚑ 键层分组从 **tape 里拿**（arch2 的 DK 是决策键的唯一实现）⇒ 训练目标与部署 softmax 同一套键。
     *   原来这里自造 `cs2.map(c => c.key)`，代 3 开了 keySplit 就会变成苹果对橘子（键数都不一样）。 */
    const keys = fr.tape.keys;
    /* 教师那一枚在候选表里的下标（pickChain 返回的是 cs2 里的对象本身 ⇒ 按身份找，不按 key 找） */
    const wIdx = cs2.indexOf(again);
    if (wIdx < 0 || !keys[wIdx]) { LABEL.gone++; return; }
    dst.push({ tape: fr.tape, keys, beads: cs2.map((c) => c.bead || null), wantKey: keys[wIdx], want0: t0.key, shp: curShp,
      wantIdx: wIdx, wantBead: again.bead || null });
    LABEL.keys++;
    if (again.key !== t0.key) LABEL.moved++; else LABEL.ok++;
  };
  let play;
  if (srcParams == null) {
    play = (state, pid, legal) => {
      if (dst.length < NGRP) record(state, pid, legal);
      const cs3 = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      const a = teacherPick(state, pid, cs3);
      return a ? { key: a.key, target: a.target == null ? null : a.target, target2: a.target2 == null ? null : a.target2, bead: a.bead || null } : { key: R.SK.JI };
    };
  } else {
    const ch = A2.chooserOf(srcParams, DAG_TEMP);
    play = (state, pid, legal) => {
      if (dst.length < NGRP) record(state, pid, legal);
      const act = ch(state, pid, legal);
      /* ⚑ Played-action 一致率（10-31 夜里加，因为"自访留出 100%"与考场读数打脸才补的这条）：
       *   留出一致率量的是**克隆态上的 argmax**；这一条量的是**真正打出去的那一手**。
       *   两者分开才能分清"包不认教师"与"包认教师但走漏"——OB3CH 起点那粒 92% 的蓄能打在 ep=2 上
       *   （教师从不），若这条也 100% 就是我自己的读数接错线。 */
      {
        const csP = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
        const t = teacherPick(state, pid, csP);
        if (t && csP.length >= 2) {
          PLAY.n++;
          const same = act && act.key === t.key && (t.bead || null) === (act.bead || null);
          if (same) PLAY.hit++;
          else {
            if (act && act.key === R.SK.CHARGE && t.key === R.SK.JI) PLAY.stuckCharge++;   // 教师弃权、包去蓄
            if (act && act.key === R.SK.JI && t.key === R.SK.CHARGE) PLAY.missCharge++;    // 教师让蓄、包弃权
            if (act && act.key === R.SK.JI && t.key === R.SK.RAILGUN) PLAY.missFire++;     // 窗口开着、包不放
          }
        }
      }
      return act;
    };
  }
  if (SHAPEBAL) {
    /* 配额摊在**组**上（第一版摊在局上 ⇒ 800 组的上限在前 2 形就撞掉，等于没改——这条已用 `覆盖 x/11 形` 自证堵死） */
    const q = Math.max(2, Math.ceil(NGRP / A2.shapes.length));
    for (let s = 0; s < A2.shapes.length; s++) {
      curShp = s;
      const before = dst.length;
      for (let g = 0; g < 60 && dst.length - before < q; g++) { if (dst.length >= NGRP) break; A2.playOne(play, s, idBase + s * 1000 + g, 4242); }
    }
  } else {
    for (let s = 0; s < A2.shapes.length && dst.length < NGRP; s++) {
      curShp = s;
      for (let g = 0; g < 60 && dst.length < NGRP; g++) A2.playOne(play, s, idBase + s * 1000 + g, 4242);
    }
  }
}

const groups = [];
collectInto(groups, null, 300000);
function shapeCov(list) { const m = {}; for (const g of list) m[g.shp] = (m[g.shp] || 0) + 1; const ks = Object.keys(m); return ks.length + '/' + A2.shapes.length + ' 形（逐形 ' + ks.map((k) => m[k]).join(',') + '）'; }
if (groups.length < 60) { console.error('⛔ 只抓到 ' + groups.length + ' 组 ⇒ 不做'); process.exit(2); }
const cut = Math.floor(groups.length * 0.75);
const train0 = groups.slice(0, cut), test = groups.slice(cut);
/* 1/类频 权重：`key` 路径按 wantKey（与 chain-supfit 同式，逐字不变）；
 *   `cand` 路径按"键#珠"伪类 ⇒ 让 `charge#elec` 不被 `charge#boom` 的数量吃掉（ji 本来占 6 成）。 */
const cls = (gr) => (OBJ === 'cand' ? gr.wantKey + (gr.wantBead ? '#' + gr.wantBead : '') : gr.wantKey);
function weightOf(list) {
  const c = {};
  for (const gr of list) { const k = cls(gr); c[k] = (c[k] || 0) + 1; }
  const w = {}; for (const k in c) w[k] = 1 / c[k];
  return w;
}
let WKEY = weightOf(train0);

/* ---- 评测（`key` = 与 chain-supfit 同口径：temp=1、键级、1/类频加权；`cand` = 教师那一枚候选的似然）---- */
function like(pv, list) {
  let llW = 0, nW = 0, hit = 0, n = 0;
  const byKey = {};
  for (const gr of list) {
    const act = tapeForward(gr.tape, pv, ly);
    const t = tailOf(act.logits, gr.keys, 1);
    const p = OBJ === 'cand' ? t.probs[gr.wantIdx] : t.kProb[gr.wantKey];
    if (!(p > 0)) continue;
    const c = cls(gr);
    n++; llW += WKEY[c] * Math.log(Math.max(1e-12, p)); nW += WKEY[c];
    let bi = 0; for (let i = 1; i < t.probs.length; i++) if (t.probs[i] > t.probs[bi]) bi = i;
    const ok = OBJ === 'cand' ? (bi === gr.wantIdx) : (gr.keys[bi] === gr.wantKey);
    if (ok) hit++;
    /* byKey 用**未加权计数**（chain-supfit 同口径；wAgree 另算） */
    const bk = byKey[c] || (byKey[c] = { n: 0, hit: 0 });
    bk.n++; if (ok) bk.hit++;
  }
  /* wAgree = 1/类频加权一致率（每键的组内一致率按 1/类频加权平均） */
  let wHit = 0, wTot = 0;
  for (const k in byKey) { const w = WKEY[k] != null ? WKEY[k] : 1; wTot += byKey[k].n * w; wHit += byKey[k].hit * w; }
  return { ll: nW ? llW / nW : -99, agree: n ? hit / n : 0, wAgree: wTot ? wHit / wTot : 0, n, byKey };
}

const t0 = Date.now();
const base = like(up, test);
console.log('# supfit-gd（Adam+反传） ‖ 目标=' + OBJ + ' ‖ 轮=' + DAG + ' ‖ 上游 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 组 ' + groups.length + '（训 ' + train0.length + ' ‖ 测 ' + test.length + '）');
console.log('  ⚑ 采集覆盖（教师自访，shapeBal=' + SHAPEBAL + '）：' + shapeCov(groups));
console.log('  ⚑ 标签对账（克隆态重算后）：未变 ' + LABEL.ok + ' ‖ 变了 ' + LABEL.moved + ' ‖ 作废 ' + LABEL.gone + '（分母 ' + LABEL.keys + '）');
console.log('  起点：加权似然 ' + base.ll.toFixed(4) + ' ‖ ' + (OBJ === 'cand' ? '同枚 top-1' : '同键 top-1') + ' ' + (100 * base.agree).toFixed(1) + '% ‖ 加权一致率 ' + (100 * base.wAgree).toFixed(1) + '%');

/* ---- Adam + 反传（全批）：`--dagger>0` 时同一函数按轮续跑（池子换、动量重开）---- */
const B1 = 0.9, B2 = 0.999, EPSA = 1e-8;
function adamFit(pvStart, trainList, sentinelLl, roundTag) {
  WKEY = weightOf(trainList);
  const DIM = pvStart.length;
  const pvR = Float64Array.from(pvStart);
  const m = new Float64Array(DIM), v = new Float64Array(DIM);
  let best = { ll: sentinelLl, pv: Float64Array.from(pvStart) };
  for (let it = 1; it <= STEPS; it++) {
    const grad = new Float64Array(DIM);
    for (const gr of trainList) {
      const act = tapeForward(gr.tape, pvR, ly);
      const t = tailOf(act.logits, gr.keys, 1);
      const p = OBJ === 'cand' ? t.probs[gr.wantIdx] : t.kProb[gr.wantKey];
      if (!(p > 0)) continue;
      const w = WKEY[cls(gr)];
      const u = (OBJ === 'cand' ? dLogPi(gr.wantIdx, act.logits, gr.keys, 1, t) : dLogKeyP(gr.wantKey, act.logits, gr.keys, 1, t));
      for (let j = 0; j < u.length; j++) u[j] *= -w;
      tapeBackward(gr.tape, pvR, ly, act, u, grad);
    }
    const denom = Math.max(1, trainList.length);
    for (let d = 0; d < DIM; d++) {
      const g = grad[d] / denom;
      m[d] = B1 * m[d] + (1 - B1) * g;
      v[d] = B2 * v[d] + (1 - B2) * g * g;
      const mh = m[d] / (1 - Math.pow(B1, it)), vh = v[d] / (1 - Math.pow(B2, it));
      pvR[d] -= LR * mh / (Math.sqrt(vh) + EPSA);
    }
    if (it % 50 === 0 || it === STEPS) {
      const tr = like(pvR, trainList);
      if (tr.ll > best.ll) { best = { ll: tr.ll, pv: Float64Array.from(pvR) }; }
      console.log('  步 ' + it + (roundTag ? '（轮 ' + roundTag + '）' : '') + ' ‖ 训练加权似然 ' + tr.ll.toFixed(4) + ' ‖ 训练' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * tr.agree).toFixed(1) + '%');
    }
  }
  return Float64Array.from(best.pv);
}

let pvCur = Float64Array.from(up);
let trainList = train0.slice();
let stuTrain = [], stuTest = [];
const ROUNDS = [];
pvCur = adamFit(pvCur, trainList, base.ll, 0);
{
  const r0 = like(pvCur, test);
  ROUNDS.push({ round: 0, trainG: trainList.length, teacherAgree: r0.agree, teacherLl: r0.ll, studentAgree: null, studentN: 0 });
}
for (let r = 1; r <= DAG; r++) {
  const before = { keys: LABEL.keys, gone: LABEL.gone, moved: LABEL.moved };
  const gS = [];
  collectInto(gS, pvCur, 500000 + r * 1000);
  if (gS.length < 60) { console.log('  ⚑ 轮 ' + r + ' 学生自访只抓到 ' + gS.length + ' 组 ⇒ 停在第 ' + (r - 1) + ' 轮'); break; }
  const c = Math.floor(gS.length * 0.75);
  stuTrain = stuTrain.concat(gS.slice(0, c));
  stuTest = stuTest.concat(gS.slice(c));
  const cap = Math.max(0, POOL - train0.length);
  if (stuTrain.length > cap) stuTrain = stuTrain.slice(stuTrain.length - cap);
  trainList = train0.concat(stuTrain);
  pvCur = adamFit(pvCur, trainList, like(pvCur, test).ll, r);
  const tr = like(pvCur, test), ts = like(pvCur, stuTest);
  console.log('  轮 ' + r + ' ‖ 学生态采集覆盖（shapeBal=' + SHAPEBAL + '）：' + shapeCov(gS));
  console.log('  轮 ' + r + ' ‖ 打出去的手 vs 教师：一致 ' + (100 * PLAY.hit / Math.max(1, PLAY.n)).toFixed(1) + '%（' + PLAY.n + ' 手）' +
    ' ‖ 教师弃权包去蓄 ' + PLAY.stuckCharge + ' ‖ 教师让蓄包弃权 ' + PLAY.missCharge + ' ‖ 有窗不放 ' + PLAY.missFire);
  console.log('  轮 ' + r + ' ‖ 学生态 +' + gS.length + ' 组（池 ' + trainList.length + ' ‖ 标签对账 ' + (LABEL.keys - before.keys) + '，作废 ' + (LABEL.gone - before.gone) + '）' +
    ' ‖ 教师留出 ' + (100 * tr.agree).toFixed(1) + '% ‖ **学生自访留出 ' + (100 * ts.agree).toFixed(1) + '%（' + ts.n + ' 组）**');
  ROUNDS.push({ round: r, studentG: gS.length, trainG: trainList.length, teacherAgree: tr.agree, teacherLl: tr.ll, studentAgree: ts.agree, studentLl: ts.ll, studentN: ts.n });
}
/* 终评：按**训练似然最好**的那份粒报留出（lr 挑档不许偷看 test 的纪律同一源头） */
const finalPv = pvCur;
const fin = like(finalPv, test);
const finTrain = like(finalPv, trainList);
const finStudent = stuTest.length ? like(finalPv, stuTest) : null;
const byKeyLine = Object.keys(fin.byKey).filter((k) => fin.byKey[k].n >= 3).sort((x, y) => fin.byKey[y].n - fin.byKey[x].n).slice(0, 8)
  .map((k) => k + ' ' + (100 * fin.byKey[k].hit / fin.byKey[k].n).toFixed(0) + '%(' + fin.byKey[k].n + ')').join(' ‖ ');
const secs = (Date.now() - t0) / 1000;
console.log('  终（训 ' + trainList.length + ' 组上 ll 最高的粒）：留出加权似然 ' + fin.ll.toFixed(4) + '（起点 ' + base.ll.toFixed(4) + '）' +
  ' ‖ ' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * fin.agree).toFixed(1) + '%（起点 ' + (100 * base.agree).toFixed(1) + '%）' +
  ' ‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');
console.log('  逐' + (OBJ === 'cand' ? '类(键#珠)' : '键') + '（留出）：' + byKeyLine);
if (finStudent) console.log('  ⚑ 学生自访留出（自己走出来的态）：' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * finStudent.agree).toFixed(1) + '%（' + finStudent.n + ' 组）' +
  ' ‖ 逐类 ' + Object.keys(finStudent.byKey).filter((k) => finStudent.byKey[k].n >= 3).sort((x, y) => finStudent.byKey[y].n - finStudent.byKey[x].n).slice(0, 8)
    .map((k) => k + ' ' + (100 * finStudent.byKey[k].hit / finStudent.byKey[k].n).toFixed(0) + '%(' + finStudent.byKey[k].n + ')').join(' ‖ ') +
    '（**这一行才是"实战走得动"的前导读数**，教师留出 100% 已经两次被证明不等于走得动）');
console.log('  耗时 ' + secs.toFixed(1) + 's ‖ 步数 ' + STEPS + ' ‖ lr ' + LR + ' ‖ 对表基准 supfit-w1：留出 75.5% ‖ railgun 39/39');
const verdict = OBJ === 'cand'
  ? '⇒ P-A1 只对 key 路径预登记；cand 路径的验收在实战尺（chain-price 的窗/珠/净分）'
  : (fin.agree >= 0.755 ? '⇒ P-A1 达标候选（留出 ≥75.5%）' : '⇒ P-A1 未达（<75.5%）');
console.log('  判：' + verdict);

mkdirSync(dirname(OUT), { recursive: true });
const packed = P.pack(finalPv);
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'supfit-gd', tag: TAG || null, parent: UP, seed: SEED, lr: LR, steps: STEPS, groups: groups.length, trainG: cut, testG: test.length,
  objective: OBJ, dagger: DAG, dagTemp: DAG_TEMP, pool: POOL, shapeBal: SHAPEBAL, teacher: TEACHER, keySplit: KS,
  playedAgree: { n: PLAY.n, hit: PLAY.hit, stuckCharge: PLAY.stuckCharge, missCharge: PLAY.missCharge, missFire: PLAY.missFire },
  label: LABEL, supfitGd: { objective: OBJ, dagger: DAG, rounds: ROUNDS, startAgree: base.agree, startLl: base.ll, agree: fin.agree, ll: fin.ll, wAgree: fin.wAgree, nTest: fin.n, nTrain: finTrain.n,
    studentAgree: finStudent ? finStudent.agree : null, studentN: finStudent ? finStudent.n : 0,
    byKey: Object.keys(fin.byKey).map((k) => ({ key: k, n: fin.byKey[k].n, hit: fin.byKey[k].hit })), verdict },
  container: { v: packed.v != null ? packed.v : null, input: (got.cfg.input || 'v7'), dof: got.cfg.dof, gen: (KS ? 3 : (got.cfg.gen || 2)), keySplit: KS },
  lineage: { parent: UP, gen: 2, recipe: { teacher: 'chain-lib.pickChain', objective: (OBJ === 'cand' ? 'weighted candidate log-likelihood log pi(teacher action), class=key#bead (temp=1)' : 'weighted key log-likelihood (temp=1)'), solver: 'Adam+analytic backprop (pg-lib)' + (DAG ? ' + DAgger x' + DAG : '') } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
