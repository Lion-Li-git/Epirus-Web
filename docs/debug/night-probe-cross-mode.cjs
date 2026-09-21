/* 研究件（只读，不进仓库）：跨模式"包含≠训练得到"的机理量化
 * E1 跨槽头对头：3P 现役包 vs 2P 现役包，standard 2P，120 局 × 双向 × {ε0, ε.2soft}
 * E2 特征分布对照：5P 自对局决策态 vs 2P 对局决策态 的 v7 特征向量 ⇒ 数"死维/越界维"
 * E3 ε 决策差分：同一批 5P 决策态上 greedy(ε0) vs 浏览器(ε.2 soft) 的出手改判率与改判去向
 */
const fs = require('fs'), vm = require('vm');
const REPO = process.argv[2] || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js',
  'js/bundled-champion.js', 'js/bundled-champion-3p.js'])
  vm.runInNewContext(fs.readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const { EpirusRules: R, EpirusState: S, EpirusResolve: X, EpirusPlay: Play, EpirusPolicy: P, EpirusTrainer: T, EpirusBots: Bots } = sb.window;
const W2 = P.unpack(sb.window.EPIRUS_CHAMPION);
const W3 = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function mkState(mode, n, seed) { const f = mb(seed); return S.createState(mode, { next: f }, n); }

// ---------- E1 跨槽头对头（2P standard） ----------
function e1() {
  const chooser = (W, eps) => (state, pid, legal) => {
    const aff = legal.filter(l => l.affordable); const base = aff.length ? aff : [{ key: 'ji', affordable: true }];
    return T.pickChampion(state, pid, base, W, 0.15, eps ? 0.2 : 0, 5, eps ? 'soft' : undefined);
  };
  const res = {};
  for (const eps of [false, true]) {
    for (const packA of ['3p', '2p']) {
      let w3 = 0, w2 = 0, d = 0;
      for (let g = 0; g < 120; g++) {
        const st = mkState('standard', 2, 50000 + g);
        const cA = chooser(packA === '3p' ? W3 : W2, eps), cB = chooser(packA === '3p' ? W2 : W3, eps);
        const win = Play.autoGame(st, cA, cB);
        if (win === 'draw') { d++; continue; }
        const winnerIsA = win === (packA === '3p' ? 0 : 1);
        // winnerIsA ⇒ packA 赢；packA 标签随座位轮换 ⇒ 统计上抵消先后手
        if (winnerIsA) { if (packA === '3p') w3++; else w2++; }
        else { if (packA === '3p') w2++; else w3++; }
      }
      res['eps' + (eps ? 'soft' : '0') + '/' + packA] = { W3: w3, W2: w2, draw: d };
    }
  }
  console.log('== E1 2P 头对头（120 局/组，两组只是座位镜像）==');
  for (const k of Object.keys(res)) {
    const r = res[k];
    console.log(`  ${k.padEnd(16)} 3P包胜 ${r.W3} · 2P包胜 ${r.W2} · 平 ${r.draw}`);
  }
}

// ---------- E2 特征分布对照 ----------
function collectStates(mode, n, mkChamps, games, seed0) {
  const feats = [];
  for (let g = 0; g < games; g++) {
    const st = mkState(mode, n, seed0 + g);
    const onTurn = (s) => {
      for (let pid = 0; pid < n; pid++) {
        if (s.p[pid].hp <= 0) continue;
        feats.push(P.featuresV7(s, pid));
        if (feats.length >= 1500) return;
      }
    };
    Play.autoGame(st, mkChamps(g, st), undefined, onTurn);
    if (feats.length >= 1500) break;
  }
  return feats;
}
function e2() {
  // 5P 长程自对局（≈训练口径主场） vs 2P 标准局（现役 3P 包从未被训过的场）
  const self5 = (g) => { const a = (state, pid, legal) => { const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji' }]; return T.pickChampion(state, pid, b, W3, 0.15); }; return [a, a, a, a, a]; };
  const F5 = [];
  for (let g = 0; g < 40 && F5.length < 1500; g++) {
    const st = mkState('long', 5, 60000 + g);
    const a = self5(g);
    Play.autoGameN(st, a, (s) => { for (let pid = 0; pid < 5; pid++) { if (s.p[pid].hp <= 0) continue; F5.push(P.featuresV7(s, pid)); if (F5.length >= 1500) return; } });
  }
  const F2 = [];
  for (let g = 0; g < 60 && F2.length < 1500; g++) {
    const st = mkState('standard', 2, 70000 + g);
    const c1 = (state, pid, legal) => { const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji' }]; return T.pickChampion(state, pid, b, W2, 0.15); };
    Play.autoGame(st, c1, (state, pid, legal) => Bots.pickBalanced(state, pid, legal), (s) => { for (let pid = 0; pid < 2; pid++) { if (s.p[pid].hp <= 0) continue; F2.push(P.featuresV7(s, pid)); if (F2.length >= 1500) return; } });
  }
  const D = P.FEAT_S;
  let deadIn2 = 0, deadIn5 = 0, ood = 0, bothAlive = 0, oodDims = [];
  for (let d = 0; d < D; d++) {
    let v5 = 0, v2 = 0, lo = Infinity, hi = -Infinity, m5 = 0, m2 = 0;
    for (const f of F5) { m5 += f[d]; } m5 /= F5.length;
    for (const f of F5) v5 += (f[d] - m5) * (f[d] - m5); v5 = Math.sqrt(v5 / F5.length);
    for (const f of F2) { m2 += f[d]; } m2 /= F2.length;
    for (const f of F2) v2 += (f[d] - m2) * (f[d] - m2); v2 = Math.sqrt(v2 / F2.length);
    for (const f of F5) { if (f[d] < lo) lo = f[d]; if (f[d] > hi) hi = f[d]; }
    let outCnt = 0; for (const f of F2) if (f[d] < lo || f[d] > hi) outCnt++;
    const fracOut = outCnt / F2.length;
    if (v5 > 1e-6 && v2 <= 1e-6) deadIn2++;
    if (v2 > 1e-6 && v5 <= 1e-6) { deadIn5++; oodDims.push(d); }
    if (v5 > 1e-6 && v2 > 1e-6) bothAlive++;
    if (fracOut >= 0.05) ood++;
  }
  console.log('== E2 特征分布对照（5P 自对局 n=' + F5.length + ' 态 vs 2P 局 n=' + F2.length + ' 态，FEAT_S=' + D + '）==');
  console.log(`  5P 有方差·2P 恒死维: ${deadIn2}   2P 有方差·5P 恒死维: ${deadIn5}   两侧都活: ${bothAlive}`);
  console.log(`  2P 读数 ≥5% 落在 5P 分布值域外的维数: ${ood} / ${D} (${(100 * ood / D).toFixed(1)}%)`);
}

// ---------- E3 ε 决策差分 ----------
function e3() {
  P.setRng(mb(4242));
  const states = [];
  for (let g = 0; g < 20 && states.length < 400; g++) {
    const st = mkState('long', 5, 80000 + g);
    const a = (state, pid, legal) => { const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji' }]; return T.pickChampion(state, pid, b, W3, 0.15); };
    Play.autoGameN(st, [a, a, a, a, a], (s) => {
      for (let pid = 0; pid < 5; pid++) {
        if (s.p[pid].hp <= 0) continue;
        const legal = Play.legalActions(s, pid).filter(l => l.affordable);
        if (legal.length) states.push({ snapshot: JSON.parse(JSON.stringify({ p: s.p, round: s.round, mode: s.mode, n: s.n, epRegen: s.epRegen, slotSalt: s.slotSalt || 0 })), pid, salt: mb(s.round * 7919 + pid) });
        if (states.length >= 400) return;
      }
    });
  }
  const cats = {};
  let diff = 0, tot = 0;
  const trans = {};
  for (const rec of states) {
    const st = S.createState('long', { next: mb(1) }, 5);
    Object.assign(st.p, rec.snapshot.p); st.round = rec.snapshot.round; st.slotSalt = rec.snapshot.slotSalt;
    const legal = Play.legalActions(st, rec.pid).filter(l => l.affordable);
    if (!legal.length) continue;
    const g1 = T.pickChampion(st, rec.pid, legal, W3, 0.15);            // 贪心（训练/门禁口径）
    const st2 = S.createState('long', { next: rec.salt }, 5);            // 探索要同一条 rng 流？不同也行：各测各的分布
    Object.assign(st2.p, rec.snapshot.p); st2.round = rec.snapshot.round; st2.slotSalt = rec.snapshot.slotSalt;
    const legal2 = Play.legalActions(st2, rec.pid).filter(l => l.affordable);
    let wG = 0, wS = 0, cnt = 30;
    const keysG = {}, keysS = {};
    for (let k = 0; k < cnt; k++) {
      const p1 = T.pickChampion(st, rec.pid, legal, W3, 0.15);
      const p2 = T.pickChampion(st2, rec.pid, legal2, W3, 0.15, 0.2, 5, 'soft');
      keysG[p1.key] = (keysG[p1.key] || 0) + 1; keysS[p2.key] = (keysS[p2.key] || 0) + 1;
    }
    const topG = Object.entries(keysG).sort((a, b) => b[1] - a[1])[0][0];
    const sShare = {};
    for (const [k, v] of Object.entries(keysS)) sShare[k] = v / cnt;
    for (const [k, v] of Object.entries(keysS)) {
      const gShare = (keysG[k] || 0) / cnt;
      cats[k] = cats[k] || { g: 0, s: 0 }; cats[k].g += gShare; cats[k].s += v;
    }
    tot++;
  }
  console.log('== E3 同态 30 采样：贪心 vs 浏览器(ε.2 soft) 的出手占比漂移（现役 3P 包 · ' + states.length + ' 个态）==');
  const rows = Object.entries(cats).map(([k, v]) => [R.byKey[k].name, v.g / (tot * 30) * 30, v.s / (tot * 30)])
    .filter(r => r[1] > 0.002 || r[2] > 0.002)
    .sort((a, b) => Math.abs(b[2] - b[1]) - Math.abs(a[2] - a[1]));
  for (const [n, g, s] of rows.slice(0, 14)) console.log(`  ${n.padEnd(6)} 贪心 ${(100 * g).toFixed(1)}% → 浏览器 ${(100 * s).toFixed(1)}%  (Δ ${((s - g) * 100).toFixed(1)}pt)`);
}

const which = process.argv[3] || "123";
if (which.includes("1")) e1();
if (which.includes("2")) e2();
if (which.includes("3")) e3();
