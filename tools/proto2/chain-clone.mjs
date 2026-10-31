#!/usr/bin/env node
/* chain-clone.mjs — 把"攒够链"这条两跳规则装进 2.0 的最后一层；不够就用 DAgger 补分布（千问 · 10-30 夜 · §十八 F）
 *
 * 为什么做：§十八 把价定完了 —— 两跳链在这张考卷上值 **+86.9pt 净分**（相对两个零件），而代 2 实战里
 *   炮每局 0~0.01 次（440 局）。于是"学不学得会"拆成三个**分开验**的子问题：
 *     ① **装得下吗**：冻结上游，只拟合 policyHead（闭式岭回归）能不能表出"炮/蓄/等"三档？
 *     ② **走得动吗**：装进头里的这粒在**实战**里开不开窗（`chain-price --packs=` 另读）？
 *     ③ **够不够**：① 在**脚本自己的状态分布**上量、② 在**头自己走出来的分布**上量 ⇒ 两者差额 = 行为克隆的
 *        复合误差。DAgger（用当前头打，采它自己的状态，再由脚本重新打标签）逐轮补这一格。
 *
 * ⚑ 两次踩坑（都留在读数里，别删）：
 *   a) 第一版只给"脚本真要出手"的组打标签、把"该等（ジ）"的组丢掉 ⇒ 留出 90.4%、实战 **0 窗**：
 *      头没学过"停手"这一档（负例被我筛掉了）。现在ジ也进回归；
 *   b) 补了负例后，**全部组 77.3% / 出手组 44.0%**，实战仍是炮 0.00（蓄 0.52/局）⇒ 不是"没学会出手"，
 *      是**分布一偏就走不回去**（脚本状态里有珠/有ジ，头自己走出来的状态里没有）。
 *
 * ⚑ 标签源 = `chain-lib.pickChain`（= §十八 定价用的**同一条**规则）。
 * ⚑ 数据不泄漏：脚本夹具从**与定价桌不同的局号/盐**上采（`300000+s*1000+g` ‖ 盐 4242），
 *   而 `chain-price` 的读数是 `200000+s*1000+g` ‖ 盐 5077 ⇒ 拟合集与评测集不相交。
 * ⚑ 留出只有一份：脚本夹具里 `i % 3 === 0` 的那一撮，**DAgger 的采样一律不进留出**（否则越练越好看）。
 *
 * 用法：node tools/proto2/chain-clone.mjs [--upstream=scratch/arms/CEM48c-s7.bak] [--perShape=25]
 *        [--dagger=2] [--l2=0.01] [--blend=0] [--out=scratch/arms/chainclone-a3.bak]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { pickChain } from './chain-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['upstream', 'perShape', 'l2', 'blend', 'out', 'temp', 'decisions', 'dagger', 'standardize'], 'chain-clone');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('upstream', 'scratch/arms/CEM48c-s7.bak'));
const PER = Math.max(1, Number(arg('perShape', 25)) || 25);
const L2 = Number(arg('l2', 0.01));
/* 岭回归按列标准化（默认开）：随机起点包的 φ 量级 ~1e-3 时，不标准化的解会被 l2·n 压成 ≈0 ⇒ 一致率假塌到 0%。
 *   `--standardize=0` 留着复现旧口径（默认开这件事必须落进 meta 与启动行）。 */
const STD = String(arg('standardize', '1')) !== '0';
const BLEND = Math.min(1, Math.max(0, Number(arg('blend', 0)) || 0));
/* `--dagger=` 默认 **0**（10-31 实测把它关掉）：朴素 DAgger 在这条链上是**反效果**的——
 *   obs3 上游：出手组 44.2% → 38.6% → 38.1%；obs3b 上游：73.1% → **0.0%**（r1 一次加 793 个自身状态）。
 *   机制：从"当前头自己走出来的分布"采到的状态绝大多数是"没珠没钱"的普通拍 ⇒ 标签几乎全是"该等（ジ）"，
 *   未做类别配平就把正例淹掉了。要用它得按类采样/加权，那是另一件事，别拿默认值替人做决定。 */
const DAGGER = Math.max(0, Math.floor(Number(arg('dagger', 0)) || 0));
const OUT = String(arg('out', 'scratch/arms/chainclone-a3.bak'));
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const MAXDEC = Math.max(60, Number(arg('decisions', 1500)) || 1500);
const SALT_FIT = 4242, BASE_FIT = 300000;     /* 与 chain-price 的 (5077, 200000) 不相交 */
const SALT_DAG = 7777, BASE_DAG = 400000;     /* DAgger 采样也不与上面两批撞 */

const W0 = sandbox();
const v7 = loadChamp(W0, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(v7);

/* ---- 读出上游包（先 install 再 unpack：unpack 要 L）---- */
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
const W = sandbox();
const A = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const up = P.unpack(raw, true);
if (!up) { console.error('⛔ 上游包 unpack 不出：' + UP); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });
const wired = A2.verifyWired(up, { temp: TEMP });
if (!wired.ok) { console.error('⛔ 上游接线没生效（forwardCands +' + wired.forwards + '）⇒ 不拟合'); process.exit(7); }

let seed = 20261030;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function asAct(c) { return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null }; }
function scriptSel(state, pid, legal) {
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
  return asAct(pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || { key: R.SK.JI });
}
/* 抓夹具：cloneState + 独立随机流（不抽走母局的数 —— 在册条款）*/
function record(list, cap) {
  return (state, pid, legal) => {
    if (list.length < cap && legal && legal.length >= 2) {
      const cl = S.cloneState(state); cl.rng = { next: rnd };
      list.push({ state: cl, pid, legal });
    }
    return null;                       /* 由调用方决定实际出招 */
  };
}
/* ---- 标签：脚本的**完整**选择（含"该等"）——组内中心化（同键候选一律 +1，目标身份不算事）---- */
function labelOf(state, pid, cands) {
  let a = pickChain(state, pid, cands, R);
  if (!a) { const j = cands.find((c) => c.key === R.SK.JI); if (!j) return null; a = j; }
  const chosen = cands.map((c) => c.key === a.key);
  const nSame = chosen.filter(Boolean).length;
  if (nSame === cands.length || nSame === 0) return null;   /* 整组同键 ⇒ 没有序可学 */
  const tgt = chosen.map((x) => (x ? 1 : 0));
  const mu = tgt.reduce((x, y) => x + y, 0) / tgt.length;
  const script = tgt.map((x) => x - mu);
  const sd = Math.sqrt(script.reduce((x, y) => x + y * x * x, 0) / script.length) || 1;
  const keep = cands.map((_, i) => i);
  if (!BLEND) return { tgt: script.map((x) => x / sd), keep };
  const self = P.forwardCands(state, pid, cands, up, { temp: 0.5 }).logits || [];
  let sMu = 0; for (let i = 0; i < self.length; i++) sMu += self[i] / self.length;
  let sSd = 0; for (let i = 0; i < self.length; i++) sSd += (self[i] - sMu) * (self[i] - sMu);
  sSd = Math.sqrt(sSd / self.length) || 1;
  return { tgt: script.map((x, i) => (1 - BLEND) * (x / sd) + BLEND * (self[i] - sMu) / sSd), keep };
}

/* ---- 留出：脚本夹具里每 3 个留 1 个（DAgger 数据永不进这里）---- */
function evalAgree(params, list) {
  let n = 0, hit = 0, base = 0, flat = 0, nA = 0, hitA = 0, baseA = 0;
  for (const fx of list) {
    const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
    if (!cands || cands.length < 2) continue;
    let a = pickChain(fx.state, fx.pid, cands, R);
    const acted = !!a;
    if (!a) { const j = cands.find((c) => c.key === R.SK.JI); if (!j) continue; a = j; }
    const same = cands.map((c) => c.key === a.key);
    const nSame = same.filter(Boolean).length;
    if (nSame === cands.length || nSame === 0) continue;
    const lg = P.forwardCands(fx.state, fx.pid, cands, params, { temp: 0.5 }).logits;
    let b = 0; for (let i = 1; i < lg.length; i++) if (lg[i] > lg[b]) b = i;
    n++; if (same[b]) hit++; base += nSame / cands.length;
    if (acted) { nA++; if (same[b]) hitA++; baseA += nSame / cands.length; }
    let mx = -1e18, mn = 1e18; for (const x of lg) { if (x > mx) mx = x; if (x < mn) mn = x; }
    if (mx - mn < 1e-9) flat++;
  }
  return { n, agree: n ? hit / n : 0, base: n ? base / n : 0, flat, nAct: nA, agreeAct: nA ? hitA / nA : 0, baseAct: nA ? baseA / nA : 0 };
}

/* ---- ① 脚本夹具（与定价桌不同批）---- */
const scriptFx = [];
{
  const rec = record(scriptFx, MAXDEC);
  const recSel = (state, pid, legal) => { rec(state, pid, legal); return scriptSel(state, pid, legal); };
  const shapes = A2.shapes;
  for (let s = 0; s < shapes.length && scriptFx.length < MAXDEC; s++) {
    for (let g = 0; g < PER && scriptFx.length < MAXDEC; g++) A2.playOne(recSel, s, BASE_FIT + s * 1000 + g, SALT_FIT);
  }
}
if (scriptFx.length < 60) { console.error('⛔ 只抓到 ' + scriptFx.length + ' 个决策 ⇒ 分母不足'); process.exit(2); }
const testFx = scriptFx.filter((_, i) => i % 3 === 0);
const trainFx = scriptFx.filter((_, i) => i % 3 !== 0);

console.log('# 链克隆 → 2.0 policyHead ‖ 上游 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ input=' + (got.cfg.input || '?') +
  ' ‖ hid2=' + (got.cfg.hid2 || '?') + ' ‖ blend=' + BLEND + ' ‖ l2=' + L2 + ' ‖ standardize=' + (STD ? '开' : '关') + ' ‖ DAgger=' + DAGGER);
console.log('  脚本夹具 ' + scriptFx.length + '（训练 ' + trainFx.length + ' ‖ **留出 ' + testFx.length + '**，盐 ' + SALT_FIT + '/局号 ' + BASE_FIT + '+ 与定价桌不相交）');

let train = trainFx.slice();
let fit = A.distillHead(train, Float64Array.from(up), { labelOf, l2: L2, standardize: STD });
if (!fit.ok) { console.error('⛔ 克隆失败：' + fit.why); process.exit(2); }
let cur = evalAgree(fit.params, testFx);
const before = evalAgree(Float64Array.from(up), testFx);
const rows = [{ round: 0, fx: train.length, all: cur.agree, act: cur.agreeAct, base: cur.base }];
console.log('  [r0 只拟合头] 留出：全部组 ' + (100 * cur.agree).toFixed(1) + '%（基线 ' + (100 * cur.base).toFixed(1) + '%）‖ 出手组 ' + (100 * cur.agreeAct).toFixed(1) +
  '%（基线 ' + (100 * cur.baseAct).toFixed(1) + '%）‖ 上游自己：' + (100 * before.agree).toFixed(1) + '% / ' + (100 * before.agreeAct).toFixed(1) + '%');

/* ---- ③ DAgger：用当前头打，采**它自己**的状态，仍由脚本打标签；再拟合 ----
 * 这是补"分布偏了就走不回去"的那一格：头在脚本状态上 77%、在自己状态上可能只有一半。 */
for (let r = 1; r <= DAGGER; r++) {
  const add = [];
  const sel = A2.chooserOf(fit.params, TEMP);
  const rec = record(add, MAXDEC);
  const recSel = (state, pid, legal) => { rec(state, pid, legal); return sel(state, pid, legal); };
  const shapes = A2.shapes;
  for (let s = 0; s < shapes.length; s++) {
    for (let g = 0; g < Math.max(2, Math.round(PER / 2)); g++) A2.playOne(recSel, s, BASE_DAG + r * 10000 + s * 1000 + g, SALT_DAG);
  }
  /* 只留"脚本与当前头不一致"的那些组（一致性高的组已知无信息 ⇒ 不占行）*/
  const newFx = add.filter((fx) => {
    const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
    if (!cands || cands.length < 2) return false;
    const a = pickChain(fx.state, fx.pid, cands, R) || cands.find((c) => c.key === R.SK.JI);
    if (!a) return false;
    const lg = P.forwardCands(fx.state, fx.pid, cands, fit.params, { temp: 0.5 }).logits;
    let b = 0; for (let i = 1; i < lg.length; i++) if (lg[i] > lg[b]) b = i;
    return cands[b].key !== a.key;
  });
  const f2 = A.distillHead(train, fit.params, { labelOf, l2: L2, standardize: STD });
  if (!f2.ok) { console.error('⛔ DAgger r' + r + ' 拟合失败：' + f2.why); break; }
  /* ⭐ 诊断格（10-31 上午加）：**同一份头**在"教师分布"与"它自己走出来的分布"上各准不准？
   *   两栏之差 = 行为克隆的复合误差本身（之前只有教师留出栏，"实战 0 窗"只能靠猜）。
   *   首测读数（obs3b 上游 OB3S-C2-s7）：自身状态 全部 47.1% / 出手组 66.7% ‖ 教师留出 59.6% / 73.1%
   *   ⇒ **塌的不只是"开不开炮"，更是"该不该停手攒钱"那一档**（全部栏 47.1% 才是真上限）。 */
  const onSelf = evalAgree(fit.params, add);
  fit = f2; cur = evalAgree(fit.params, testFx);
  rows.push({ round: r, fx: train.length, add: newFx.length, selfStates: add.length,
    selfAgree: onSelf.agree, selfAgreeAct: onSelf.agreeAct, selfN: onSelf.n, selfNAct: onSelf.nAct,
    all: cur.agree, act: cur.agreeAct });
  console.log('  [r' + r + ' DAgger] 采到 ' + add.length + ' 个自身状态（与脚本不一致 ' + newFx.length + '）‖ ' +
    '**旧头在这些状态上**同键 top-1：全部 ' + (100 * onSelf.agree).toFixed(1) + '%（' + onSelf.n + ' 组）‖ 出手组 ' +
    (100 * onSelf.agreeAct).toFixed(1) + '%（' + onSelf.nAct + ' 组）‖ 重拟合后教师留出：全部 ' + (100 * cur.agree).toFixed(1) +
    '% ‖ 出手组 ' + (100 * cur.agreeAct).toFixed(1) + '%');
}

const lift = cur.agree - before.agree;
const verdict = (cur.agree > 0.8 && cur.agreeAct > 0.8) ? '⇒ **装得下**（含停手档）'
  : (cur.agree > 0.5 ? '⇒ **部分装得下**（全部组 ' + (100 * cur.agree).toFixed(1) + '%、出手组 ' + (100 * cur.agreeAct).toFixed(1) + '%）：头在"停手 vs 出手"上分不干净'
    : '⇒ **这一层装不下**（全部组 ' + (100 * cur.agree).toFixed(1) + '% ≈ 基线）：先换输入面/加宽，别拿它当热启动');
console.log('  ' + verdict + '（较上游 ' + (lift >= 0 ? '+' : '') + (100 * lift).toFixed(1) + 'pt）');
console.log('  ⚑ 容量 ≠ 行为：留出只说明"头能不能表出"；实战开不开窗由 `chain-price --packs=` 另读（第一版同分布 90.4% 却 0 窗）。');

mkdirSync(dirname(OUT), { recursive: true });
const packed = P.pack(fit.params);
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'chain-clone', mode: 'clone', parent: UP, evals: train.length, targetGames: null,
  blend: BLEND, l2: L2, standardize: STD, dagger: DAGGER, rounds: rows,
  clone: { agree: cur.agree, agreeAct: cur.agreeAct, agreeBefore: before.agree, agreeActBefore: before.agreeAct, base: cur.base, baseAct: cur.baseAct, flat: cur.flat, n: cur.n, nAct: cur.nAct },
  container: { v: packed.v != null ? packed.v : null, gen: packed.dims ? packed.dims.gen : null, input: got.cfg.input, hid2: got.cfg.hid2 },
  lineage: { parent: UP, gen: 2, recipe: { clone: 'chain-lib.pickChain', blend: BLEND, dagger: DAGGER } },
}, null, 1), 'utf8');
console.log('  产物 ' + OUT + ' ‖（下一步：`node tools/proto2/chain-price.mjs --packs=' + OUT + '`）');
