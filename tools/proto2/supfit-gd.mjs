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
rejectUnknownFlags(argv, ['upstream', 'groups', 'lr', 'steps', 'seed', 'out', 'tag', 'objective'], 'supfit-gd');
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

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const up = P.unpack(raw, true);
if (!up) { console.error('⛔ 上游读不出：' + UP); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: 0.15, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });

/* ---- 收集：与 chain-supfit 逐字同流（seed 20261030 LCG、同 salt/局号、同教师、同克隆）---- */
let seed = 20261030;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const teacherPick = (state, pid, cs) => pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0];
const groups = [];
const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0 };
{
  const sel = (state, pid, legal) => {
    if (groups.length < NGRP && legal && legal.length >= 2) {
      const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      if (cs.length >= 2) {
        const t0 = teacherPick(state, pid, cs);
        if (t0) {
          const cl = S.cloneState(state); cl.rng = { next: rnd };
          const cs2 = P.candidatesFor(cl, pid, T.econBase(cl, pid, legal), { lockTarget: false }) || [];
          const again = teacherPick(cl, pid, cs2);
          const keys = cs2.map((c) => c.key);
          if (!again || !cs2.length || keys.indexOf(again.key) < 0) LABEL.gone++;
          else {
            /* tape 的输入与参数无关 ⇒ 收集时算一次，之后任意参数重放（单源：arch2 wantTape） */
            const fr = P.forwardCands(cl, pid, cs2, up, { temp: 1, wantTape: 1 });
            /* 教师那一枚在候选表里的下标（pickChain 返回的是 cs2 里的对象本身 ⇒ 按身份找，不按 key 找） */
            const wIdx = cs2.indexOf(again);
            if (OBJ === 'cand' && wIdx < 0) { LABEL.gone++; }
            else {
              groups.push({ tape: fr.tape, keys, beads: cs2.map((c) => c.bead || null), wantKey: again.key, want0: t0.key,
                wantIdx: wIdx, wantBead: again.bead || null });
              LABEL.keys++;
              if (again.key !== t0.key) LABEL.moved++; else LABEL.ok++;
            }
          }
        }
      }
    }
    const cs3 = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    const a = teacherPick(state, pid, cs3);
    return a ? { key: a.key, target: a.target == null ? null : a.target, target2: a.target2 == null ? null : a.target2, bead: a.bead || null } : { key: R.SK.JI };
  };
  for (let s = 0; s < A2.shapes.length && groups.length < NGRP; s++) {
    for (let g = 0; g < 60 && groups.length < NGRP; g++) A2.playOne(sel, s, 300000 + s * 1000 + g, 4242);
  }
}
if (groups.length < 60) { console.error('⛔ 只抓到 ' + groups.length + ' 组 ⇒ 不做'); process.exit(2); }
const cut = Math.floor(groups.length * 0.75);
const train = groups.slice(0, cut), test = groups.slice(cut);
/* 1/类频 权重：`key` 路径按 wantKey（与 chain-supfit 同式，逐字不变）；
 *   `cand` 路径按"键#珠"伪类 ⇒ 让 `charge#elec` 不被 `charge#boom` 的数量吃掉（ji 本来占 6 成）。 */
const cls = (gr) => (OBJ === 'cand' ? gr.wantKey + (gr.wantBead ? '#' + gr.wantBead : '') : gr.wantKey);
const cnt = {};
for (const gr of train) { const c = cls(gr); cnt[c] = (cnt[c] || 0) + 1; }
const WKEY = {}; for (const k in cnt) WKEY[k] = 1 / cnt[k];

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
console.log('# supfit-gd（Adam+反传） ‖ 目标=' + OBJ + ' ‖ 上游 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 组 ' + groups.length + '（训 ' + train.length + ' ‖ 测 ' + test.length + '）');
console.log('  ⚑ 标签对账（克隆态重算后）：未变 ' + LABEL.ok + ' ‖ 变了 ' + LABEL.moved + ' ‖ 作废 ' + LABEL.gone + '（分母 ' + LABEL.keys + '）');
console.log('  起点：加权似然 ' + base.ll.toFixed(4) + ' ‖ ' + (OBJ === 'cand' ? '同枚 top-1' : '同键 top-1') + ' ' + (100 * base.agree).toFixed(1) + '% ‖ 加权一致率 ' + (100 * base.wAgree).toFixed(1) + '%');

/* ---- Adam + 反传（全批）---- */
const DIM = up.length;
const pv = Float64Array.from(up);
const m = new Float64Array(DIM), v = new Float64Array(DIM);
const B1 = 0.9, B2 = 0.999, EPSA = 1e-8;
let best = { ll: base.ll, agree: base.agree, wAgree: base.wAgree, pv: Float64Array.from(up) };
for (let it = 1; it <= STEPS; it++) {
  const grad = new Float64Array(DIM);
  let ll = 0;
  for (const gr of train) {
    const act = tapeForward(gr.tape, pv, ly);
    const t = tailOf(act.logits, gr.keys, 1);
    const p = OBJ === 'cand' ? t.probs[gr.wantIdx] : t.kProb[gr.wantKey];
    if (!(p > 0)) continue;
    const w = WKEY[cls(gr)];
    ll -= w * Math.log(Math.max(1e-12, p));
    const u = (OBJ === 'cand' ? dLogPi(gr.wantIdx, act.logits, gr.keys, 1, t) : dLogKeyP(gr.wantKey, act.logits, gr.keys, 1, t));
    for (let j = 0; j < u.length; j++) u[j] *= -w;
    tapeBackward(gr.tape, pv, ly, act, u, grad);
  }
  const denom = Math.max(1, train.length);
  for (let d = 0; d < DIM; d++) {
    const g = grad[d] / denom;
    m[d] = B1 * m[d] + (1 - B1) * g;
    v[d] = B2 * v[d] + (1 - B2) * g * g;
    const mh = m[d] / (1 - Math.pow(B1, it)), vh = v[d] / (1 - Math.pow(B2, it));
    pv[d] -= LR * mh / (Math.sqrt(vh) + EPSA);
  }
  if (it % 50 === 0 || it === STEPS) {
    const tr = like(pv, train);
    if (tr.ll > best.ll) { best = { ll: tr.ll, pv: Float64Array.from(pv) }; }
    console.log('  步 ' + it + ' ‖ 训练加权似然 ' + tr.ll.toFixed(4) + ' ‖ 训练' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * tr.agree).toFixed(1) + '%');
  }
}
/* 终评：按**训练似然最好**的那份粒报留出（lr 挑档不许偷看 test 的纪律同一源头） */
const finalPv = best.pv;
const fin = like(finalPv, test);
const finTrain = like(finalPv, train);
const byKeyLine = Object.keys(fin.byKey).filter((k) => fin.byKey[k].n >= 3).sort((x, y) => fin.byKey[y].n - fin.byKey[x].n).slice(0, 8)
  .map((k) => k + ' ' + (100 * fin.byKey[k].hit / fin.byKey[k].n).toFixed(0) + '%(' + fin.byKey[k].n + ')').join(' ‖ ');
const secs = (Date.now() - t0) / 1000;
console.log('  终（训 ' + train.length + ' 组上 ll 最高的粒）：留出加权似然 ' + fin.ll.toFixed(4) + '（起点 ' + base.ll.toFixed(4) + '）' +
  ' ‖ ' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * fin.agree).toFixed(1) + '%（起点 ' + (100 * base.agree).toFixed(1) + '%）' +
  ' ‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');
console.log('  逐' + (OBJ === 'cand' ? '类(键#珠)' : '键') + '（留出）：' + byKeyLine);
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
  objective: OBJ,
  label: LABEL, supfitGd: { objective: OBJ, startAgree: base.agree, startLl: base.ll, agree: fin.agree, ll: fin.ll, wAgree: fin.wAgree, nTest: fin.n, nTrain: finTrain.n, byKey: Object.keys(fin.byKey).map((k) => ({ key: k, n: fin.byKey[k].n, hit: fin.byKey[k].hit })), verdict },
  container: { v: packed.v != null ? packed.v : null, input: got.cfg.input, dof: got.cfg.dof },
  lineage: { parent: UP, gen: 2, recipe: { teacher: 'chain-lib.pickChain', objective: (OBJ === 'cand' ? 'weighted candidate log-likelihood log pi(teacher action), class=key#bead (temp=1)' : 'weighted key log-likelihood (temp=1)'), solver: 'Adam+analytic backprop (pg-lib)' } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
