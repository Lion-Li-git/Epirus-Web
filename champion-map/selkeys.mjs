/* §E575 候选当选键的**分辨率扫描**（方向 1：换量程之前，先问新键分不分得开）
 *
 * 病（已有数，n=1 对种子）：现役键 `firstRate + 0.5·top2Rate` 在**产品口径**下第 1 与第 2 名分差只有
 *   **0.30pt**，而同分带是 3.0pt（`tools/pick-best.mjs:96` 的 `tol`）⇒「基本是抽签」
 *   （`cont1200-2026-10-10.tsv`，EXAM-FIT-MATCH §三）。§E572 又证明 `trainFit` 连臂内 6 带的验收序都排不出
 *   （中位 ρ = −0.086，跨臂符号 p = 0.727）⇒ 信息只可能在**终局那次重验**里，而那次重验用的就是这把没分辨率的键。
 * 于是"换量程"这一步真正的前置问题不是"读哪一维更对"（那是方向 2，要人席贵尺），而是：
 *   **候选键自己的分差能不能离开它自己的噪声**。离不开 ⇒ 换键 = 换抽签的签，一整批训练可以直接省掉。
 *
 * 一台仪器问三件事（每枚候选、每粒重复都落盘，判读与测量分开跑）：
 *   ① 现役键与 8 把候选键的**值**（同一批复跑原料 ⇒ 键的多少不改变成本）
 *   ② 每条键的**自身噪声**：8 粒重复各自算一遍键值，取极差（pt / z 单位）
 *   ③ **分半**：前 4 粒选出的冠军是不是后 4 粒选出的那一枚（换人率），以及两半的名次相关
 *
 * 口径纪律（跑前写死，逐字对齐 `tools/train-3p.mjs` 的终局那段）：
 *   - 沙箱启动搬 `champion-map/evaln-noise.mjs`（它自己是从 train-3p **逐字搬**的，含 `__seedSandbox` 与
 *     `P.setRng(mulberry32(sbseed*7919+13))`）。⚠ §E312 那条老坑：复刻仪器要**搬代码**，照记忆重写必坏 ——
 *     第一版自列 Math 名单就在 `Math.imul` 上抛过 TypeError。
 *   - `ALL_PAIRS` = `Bots.pick*` 那 9 个 bot 的两两组合 = **36 对**，`evalN(params, ALL_PAIRS, 20, 5, selBase(i))`。
 *   - 名次维的重复只动 **seedBase**（`selBase(0..7)`，步长 100000 ⇒ 8 组的局 seed 集合互不重叠，见 pick-best:36 那条注释），
 *     沙箱种子**恒为 1** = 现口径 ⇒ 这一族的噪声结构与真臂当选完全同型。
 *   - 行为维（`mirrorHealth`）没有 seedBase 这个参数（`evo.js:3178` 的游戏流写死 `mulberry32(9000+g)`）⇒
 *     它唯一的复跑自由度是**沙箱随机流**，所以第 i 粒重复用 sbseed = i+1（第 0 粒 = 1 = 现口径，可核对复现）。
 *     ⚠ 这一族的噪声来源与名次族**不同型**，判读里必须分开印，不许混着比大小。
 *   - `TRAIN_MODE`：k8 那 8 支臂的 `recipeEnv` 没下模式令 ⇒ 恒 'multi'；这里加守卫，若 env 写了别的就照它 setTrainMode。
 *   - 只读：不改 `tools/`、不改 `js/**`、不 promote、不落任何 .bak。
 *
 * 判据（跑前写死，不许事后改口径）：
 *   (a) **仪器对应性**：`SHIPPED-Ldemo` 与 `K2` 参照包在 selBase(0) 上的 `1st/top2` 必须与真臂日志同格；
 *       并且现役键在 k8 那 48 枚上的**第 1/2 名分差分布**要能把 §三 那笔账复现出来（分差中位 ≪ 同分带 3.0pt）。
 *       ⇒ 若现役键在这台上显示"分得开"，说明台子搭错，全部读数作废（这条是"判据必须能红"的正面版）。
 *   (b) 一条键**入围方向 2** 的门槛（名次族与行为族各自判）：8 个臂池里
 *       「top-2 分差 > 该键自身噪声」的臂数 ≥ 7/8，且分半不换人 ≥ 6/8。
 *   (c) **机会水平不拍脑袋**：每个池的换人概率上限按 8 粒重复里"该枚当过 argmax 的频率 p_i"算 `Σ p_i²`，
 *       观测换人对照它做精确二项（不是拿 1/6 当基线 —— 值分布本就不均）。
 *   (d) **正对照三条**（造不出能红的判据就别写它，METHODOLOGY 127）：
 *       ① 常数键 ⇒ 分半秩相关必须 NaN；② 按考卷倒造的键（`k8fit` 的 exam 列取负）⇒ 必须 8/8 不换人、ρ = +1.000；
 *       ③ 独立随机键 ⇒ 分半 ρ 的跨臂中位必须 ≈ 0、且 ≥6/8 臂判不出分辨率。
 *   (e) **名单数 vs 落盘数**：收尾必须比对"要跑的枚数 × 重复数"与 tsv 行数（§E502 那批就是靠这个抓到漏测的）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { selBase } from '../tools/pick-best.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const FLAG = {}; const POS = [];
for (const a of argv) {
  if (a.startsWith('--')) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2]; }
  else POS.push(a);
}
const PHASE = FLAG.phase || 'measure';
const REPS = Number(FLAG.reps || 8);
const N = Number(FLAG.n || 5);
const GAMES = Number(FLAG.games || 20);          /* evalN 每对局数（= 现口径）*/
const LAND_GAMES = Number(FLAG.landgames || 20);  /* mirrorHealth 局数（SEL_LAND_GAMES 的默认档）*/
const BANDS = FLAG.bands || 'k8bands.tsv';
const OUT = FLAG.out || 'selkeys-raw.tsv';
const POOLS = FLAG.pools || 'k8fit-2026-10-10.tsv';

/* ===== 沙箱：搬 evaln-noise.mjs（它搬 train-3p） ===== */
function bootSandbox(sbseed) {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date };
  sb.window = sb; sb.globalThis = sb;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
    vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
  }
  const P = sb.window.EpirusPolicy, T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots;
  /* 函数体逐字搬 evaln-noise.mjs 的 `__seedSandbox`（只是不再收 sbox 参数、改成闭包内的 sb）——
   * ⚠ §E312 那条老坑：复刻仪器要**搬代码**，照记忆重写必坏（自列 Math 名单会在 `Math.imul` 上抛 TypeError）。 */
  function applySeed(seed) {
    if (!seed) return;
    const M = Object.create(Math);
    let s = (seed >>> 0) || 1;
    M.random = function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    sb.Math = M;
  }
  const g = { sb: sb, P: P, T: T, Bots: Bots };
  applySeed(sbseed);
  if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(sbseed * 7919 + 13));
  return g;
}
/* ⚑ **每次测量开一个全新 realm**（这一条是被判据 (a) 连红两轮逼出来的，不是洁癖）：
 *   第一版沿用 evaln-noise 的"一沙箱跑到底"，同一片里 SHIPPED-3P @987654 的 firstRate 在四片切片里给出
 *   **54.4444%（两片）与 55.0000%（两片）** —— 同一枚包、同一粒 seedBase，唯一的区别是前面算过哪些包。
 *   第二版加了"每次重置沙箱随机流"（`Math` + `P.setRng`），**仍然红** ⇒ 说明光重置流不够：
 *   脚本对手自己带状态（`evo.js:3134` 那个 `rr++` 的轮换计数器），相位随前面的对局数推进，
 *   而它不在随机流里。只有**重新载入那 7 份 js** 才把它归零。
 *   ⇒ 这两条都是现役当选键的真病，不是本仪器的毛病：真臂收尾时名人堂 6 枚就是**同一进程顺序评估**的，
 *     所以印出来的 `1st/top2` 依赖评估顺序，而且有两个独立的依赖通道（随机流 + bot 相位）。记进 §E575。 */
const SBSEED_RANK = 1;                       /* 名次族恒用现口径那一粒沙箱种子 */
const G1 = bootSandbox(SBSEED_RANK);         /* 只当工具面用（unpack / mulberry32 / trainMode）；测量各自开 realm */
/* ⚑ 第三次修正（这一条才是真因）：**对手表必须在"跑这次测量的那个 realm"里现建**。
 *   `Bots.pick*` 是闭包，内部带着**轮换计数器**（`evo.js:3134` 那族 `rr++`）——
 *   我第一版用 G1 建了一张 `ALL_PAIRS` 复用，于是就算 evalN 每次开新 realm，执行的 bot 仍然来自 G1，
 *   它们的相位在整个进程里累积。实测：同一枚锚点 @987654，前面垫 1 枚 = 54.4444%，垫 2 枚 = **55.0000%**，
 *   垫 4/6/8/10/12 枚又回到 54.4444%（相位按 bot 的轮换周期打回来）—— 不是单调累积，正是"周期状态被推进"的形状。
 *   ⇒ 现在每次测量都 `bootSandbox` + 在**那个** realm 里现建 36 对，bot 状态与随机流一起归零。
 *   ⚠ 真臂里名人堂 6 枚是同一进程顺序评估、bot 单例共用 ⇒ **这条相位依赖在真臂里同样成立**，
 *     是现役当选键的第二条顺序依赖通道（第一条是随机流）。记进 §E575。 */
function pairsIn(g) {
  const POOL = [g.Bots.pickRandom, g.Bots.pickAggro, g.Bots.pickDefend, g.Bots.pickBalanced,
                g.Bots.pickAntiDef, g.Bots.pickBreakDef, g.Bots.pickWall, g.Bots.pickMix, g.Bots.pickFarmer];
  const out = [];
  for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) out.push([POOL[a], POOL[b]]);
  if (out.length !== 36) { console.error('⛔ 对手对数 = ' + out.length + ' ≠ 36 ⇒ 池子或组合方式变了，台子搭错'); process.exit(2); }
  return out;
}

function loadParams(file) {
  const src = readFileSync(file, 'utf8');
  const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + file); process.exit(1); }
  const params = G1.P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.error('unpack 拿到 null（维度/版本不兼容）: ' + file); process.exit(1); }
  return params;
}

/* ===== 候选名单：k8bands.tsv 的 48 枚带（判据 (e) 的名单在这里定） ===== */
function rd(p) { const L = readFileSync(p, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map((l) => l.split('\t')) }; }
const B = FLAG.nobands ? { h: {}, rows: [] } : rd(join(HERE, BANDS));
const CAND = [];
for (const r of B.rows) {
  const id = r[B.h.arm] + '-b' + r[B.h.band];
  const rel = r[B.h.bandRel];
  if (+r[B.h.dupInArm]) continue;                       /* 臂内重复权重（本轮 48 枚实测全不同，留守卫） */
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { console.log('  ⛔ 盘上查无 ' + rel + '（' + id + '）'); continue; }
  CAND.push({ id: id, arm: r[B.h.arm], band: +r[B.h.band], abs: abs, rel: rel, fit: +r[B.h.trainFit], selected: r[B.h.selected] });
}
if (FLAG.limit && +FLAG.limit > 0) CAND.length = Math.min(CAND.length, Number(FLAG.limit));
if (FLAG.mod) { const [i, m] = String(FLAG.mod).split('/').map(Number); for (let q = CAND.length - 1; q >= 0; q--) if (q % m !== i) CAND.splice(q, 1); }
/* 位置参数 = 额外的参照包（.bak 路径）。它们同时是**判据 (a) 的锚**：`--anchor=<tsv>` 给一张
 *   `pack base first top2 sc` 的表（`_e318-all15.tsv` 那型），凡 id 在表里出现的枚，第 0 粒重复的
 *   1st/top2 必须与真臂日志同格（±0.05pt）⇒ 不同格 = 这台仪器不是同一把尺，全部读数作废（§E312）。 */
for (const f of POS) {
  const spec = f.split('#'); const useFile = spec[0];
  const abs = useFile.indexOf(':') >= 0 || useFile[0] === '/' ? useFile : join(ROOT, useFile);
  if (!existsSync(abs)) { console.log('  ⛔ 参照包盘上查无 ' + f); continue; }
  const id = spec[1] || abs.split(/[\\/]/).pop().replace(/\.bak$/, '');
  CAND.push({ id: id, arm: 'anchor', band: 0, abs: abs, rel: useFile, fit: NaN, selected: '', anchor: true });
}
const ANCHOR = {};
if (FLAG.anchor) { const A = rd(FLAG.anchor.indexOf(':') >= 0 || FLAG.anchor[0] === '/' ? FLAG.anchor : join(HERE, FLAG.anchor));
  for (const r of A.rows) if (+r[A.h.base] === selBase(0)) ANCHOR[r[A.h.pack]] = { first: +r[A.h.first], top2: +r[A.h.top2] }; }
console.log('# §E575 ' + PHASE + ' ‖ 候选 ' + CAND.length + ' 枚 ‖ 重复 ' + REPS + ' 粒 ‖ evalN(36×' + GAMES + '×n=' + N + ') + mirrorHealth(' + LAND_GAMES + '×2 mode)');
console.log('# TRAIN_MODE = ' + G1.T.trainMode() + ' ‖ selBase(0) = ' + selBase(0) + ' ‖ selBase(' + (REPS - 1) + ') = ' + selBase(REPS - 1));

/* ===== 测量：每枚 × 每粒重复 → 一行原料（键在判读相里从这些列构造） ===== */
const COLS = ['id', 'arm', 'band', 'rep', 'first', 'second', 'third', 'games',
  'm_dmg', 'm_heavy', 'm_holo', 'm_holoOther', 'm_zero', 'm_draw', 'm_rounds', 'm_G', 'm_distinct', 'm_landG', 'm_landed', 'm_landedTot', 'm_seatSpread', 'm_seatDec', 'm_pierceMissing',
  'l_dmg', 'l_heavy', 'l_holo', 'l_zero', 'l_draw', 'l_rounds', 'l_G', 'l_landG', 'l_landed', 'l_seatSpread', 'l_pierceMissing'];
if (PHASE === 'measure') {
  const t0 = Date.now(); const rows = [];
  for (const c of CAND) {
    const params = loadParams(join(ROOT, c.rel));
    for (let i = 0; i < REPS; i++) {
      const gR = bootSandbox(SBSEED_RANK);
      const v = gR.T.evalN(params, pairsIn(gR), GAMES, N, selBase(i));
      if (i === 0 && c.anchor && ANCHOR[c.id]) {
        const a = ANCHOR[c.id];
        const f = 100 * v.firstRate, t = 100 * v.top2Rate;
        const ok = Math.abs(f - a.first) <= 0.05 && Math.abs(t - a.top2) <= 0.05;
        console.log('# 锚点(判据 a) ' + c.id + ' @' + selBase(0) + ' ⇒ 1st=' + f.toFixed(4) + '% top2=' + t.toFixed(4) +
          '% ‖ 真臂日志 ' + a.first + '/' + a.top2 + ' ⇒ ' + (ok ? '✅ 同一把尺' : '⛔ 不是同一台仪器，读数作废'));
        if (!ok) { console.error('⛔ 锚点红 ⇒ 停'); process.exit(3); }
      }
      const mh = measureMirror(params, i, 'multi');
      const lh = measureMirror(params, i, 'long');
      rows.push([c.id, c.arm, c.band, i,
        v.first, v.second, v.third, v.games,
        mh.dmgPerGame, mh.heavyPerGame, mh.holoPerGame, mh.holoOtherPerGame, mh.zeroRate, mh.drawRate, mh.rounds, mh.effSkills, mh.distinctKeys, mh.effSkillsLand, mh.landedKeys, mh.landedTotal, nz(mh.seatSpread), mh.seatDecisive, mh.pierceMissing.length,
        lh.dmgPerGame, lh.heavyPerGame, lh.holoPerGame, lh.zeroRate, lh.drawRate, lh.rounds, lh.effSkills, lh.effSkillsLand, lh.landedKeys, nz(lh.seatSpread), lh.pierceMissing.length].join('\t'));
    }
    process.stdout.write('  ' + c.id + ' ' + rows.length + ' 行 ‖ ' + ((Date.now() - t0) / 1000).toFixed(0) + 's\n');
  }
  const base = OUT.indexOf(':') >= 0 || OUT[0] === '/' ? OUT : join(HERE, OUT);
  const path = FLAG.mod ? base.replace(/\.tsv$/, '') + '.' + String(FLAG.mod).replace('/', '-') + '.tsv' : base;
  writeFileSync(path, [COLS.join('\t')].concat(rows).join('\n') + '\n', 'utf8');
  const want = CAND.length * REPS;
  console.log('# 落盘 ' + rows.length + ' 行 ‖ 名单要 ' + want + ' 行 ⇒ ' + (rows.length === want ? '✅ 判据 (e) 过' : '⛔ 判据 (e) 红：少 ' + (want - rows.length)));
  console.log('# 用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's ‖ 每枚 ' + ((Date.now() - t0) / Math.max(1, CAND.length) / 1000).toFixed(1) + 's ⇒ ' + path);
  process.exit(rows.length === want ? 0 : 4);
}
function nz(x) { return x === null || x === undefined ? 'NA' : x; }

/* ===== behnoise 相：给**确定性**的行为维一条能量到噪声的分半尺 =====
 * `mirrorHealth` 逐局用的是 `mulberry32(9000+g)`（`evo.js:3178`），每局的流**互相独立**，
 *   所以 `G=10` 跑的是 g=0..9，`G=20` 跑的是 g=0..19 ⇒ 前者是后者的**前缀**。
 *   ⇒ 后半（g=10..19）可以从两个和里减出来：`m后半 = 2·m20 − m10`（只对"每局均值"型可加列成立）。
 *   于是同一枚包拿到两个**互不重叠**的 10 局样本 = 一次真正的分半。
 * ⚠ 三个前提写在账上：
 *   ① 只有可加列能这么切：伤害/重击/护盾/送人盾/零攻率/平局率/回合。
 *      **熵型的 G 与落地广度 `effSkillsLand`、以及 `seatSpread` 不可切**（它们不是逐局之和）⇒ 那两维本轮仍是"不可判"。
 *   ② 10 局的抖动是 20 局估计器抖动的 √2 倍 ⇒ 这是**保守方向**（更容易判"分不开"），不会把没分辨率说成有。
 *   ③ 前缀性质必须实测，不是假定：可加列的"后半"若出现**负值**（伤害/回合不可能为负）⇒ 前缀假设红 ⇒ 判读作废。 */
const ADD = [['dmg', 'dmgPerGame'], ['heavy', 'heavyPerGame'], ['holo', 'holoPerGame'], ['holoOther', 'holoOtherPerGame'],
  ['zero', 'zeroRate'], ['draw', 'drawRate'], ['rounds', 'rounds']];
if (PHASE === 'behnoise') {
  if (LAND_GAMES <= 10) { console.error('⛔ --landgames 必须 > 10，否则减不出"后半"'); process.exit(2); }
  const t0 = Date.now();
  const hdr = ['id', 'arm', 'mode', 'g20'].concat(ADD.flatMap(a => [a[0] + '_10', a[0] + '_20', a[0] + '_back']));
  const rows = [hdr.join('\t')];
  let neg = 0, nchk = 0;
  for (const c of CAND) {
    const params = loadParams(join(ROOT, c.rel));
    for (const mode of ['multi', 'long']) {
      const a = bootSandbox(1).T.mirrorHealth(params, 10, N, mode);
      const b = bootSandbox(1).T.mirrorHealth(params, LAND_GAMES, N, mode);
      const cells = [];
      for (const [, field] of ADD) {
        const m10 = a[field], m20 = b[field];
        const back = (LAND_GAMES * m20 - 10 * m10) / (LAND_GAMES - 10);   /* 后半(g=10..19)的每局均值 */
        nchk++; if (back < -1e-9) neg++;
        cells.push(m10, m20, back);
      }
      rows.push([c.id, c.arm, mode, LAND_GAMES].concat(cells).join('\t'));
    }
    process.stdout.write('  ' + c.id + ' ‖ ' + ((Date.now() - t0) / 1000).toFixed(0) + 's\n');
  }
  const ob = FLAG.out || 'selkeys-beh.tsv';
  const base = ob.indexOf(':') >= 0 || ob[0] === '/' ? ob : join(HERE, ob);
  writeFileSync(base, rows.join('\n') + '\n', 'utf8');
  console.log('# behnoise 落盘 ' + (rows.length - 1) + ' 行 ‖ 名单要 ' + (CAND.length * 2) + ' ⇒ ' + (rows.length - 1 === CAND.length * 2 ? '✅ 判据 (e) 过' : '⛔ 判据 (e) 红'));
  console.log('# 前缀检验（前提 ③）：减出的"后半"共 ' + nchk + ' 格，负值 ' + neg + ' 格 ⇒ ' + (neg ? '⛔ 前缀不成立，判读作废' : '✅ 无一为负'));
  console.log('# 用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's ⇒ ' + base);
  process.exit(neg ? 5 : 0);
}

/* ===== behjudge 相：行为族的分辨率（分半 = 同一批 20 局的前 10 局 vs 后 10 局）=====
 * 与上面 judge 相的区别只在**噪声从哪来**：
 *   名次族 → 8 粒 seedBase（与真臂当选同型）；行为族 → `mirrorHealth` 确定性、只能按局号切（behnoise 相那条推导）。
 * ⚠ 两条写在账上的口径：
 *   ① 10 局半的抖动 ≈ 20 局估计器抖动的 √2 倍 ⇒ **保守**（更容易判"分不开"），不会把没分辨率说成有。
 *   ② 混合键的两半来源不同型（名次那半换 seedBase、行为那半换局号）⇒ 它是"重测一遍会不会换人"的近似，
 *      不是严格的重采样；所以混合键的判定只作**筛选**用，真要换判据还得按新键跑一批臂。 */
if (PHASE === 'behjudge') {
  const R = rd(FLAG.raw.indexOf(':') >= 0 || FLAG.raw[0] === '/' ? FLAG.raw : join(HERE, FLAG.raw));
  const H = rd(FLAG.beh.indexOf(':') >= 0 || FLAG.beh[0] === '/' ? FLAG.beh : join(HERE, FLAG.beh));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
  const med = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN);
  function ranksOf(x) { const idx = x.map((v, i) => i).sort((a, b) => x[b] - x[a]); const r = new Array(x.length);
    let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }
  function pear(a, b) { const m1 = mean(a), m2 = mean(b); let n = 0, d1 = 0, d2 = 0;
    for (let i = 0; i < a.length; i++) { n += (a[i] - m1) * (b[i] - m2); d1 += (a[i] - m1) ** 2; d2 += (b[i] - m2) ** 2; }
    return (d1 === 0 || d2 === 0) ? NaN : n / Math.sqrt(d1 * d2); }
  function binomTwo(k, n, p) { const pr = i => { let c = 1; for (let q = 0; q < i; q++) c = c * (n - q) / (q + 1); return c * Math.pow(p, i) * Math.pow(1 - p, n - i); };
    const obs = pr(k); let s = 0; for (let i = 0; i <= n; i++) if (pr(i) <= obs * 1.0000001) s += pr(i); return Math.min(1, s); }
  /* 名次族：每枚的 8 粒 → full / A(0..3) / B(4..7) */
  const rk = {};
  for (const row of R.rows) { const id = row[R.h.id]; if (row[R.h.arm] === 'anchor') continue;
    const g = +row[R.h.games], f = +row[R.h.first], s = +row[R.h.second];
    (rk[id] = rk[id] || { v: [], arm: row[R.h.arm] }).v.push(f / g + 0.5 * (f + s) / g); }
  /* 行为族：每枚每 mode 的 10 / 20 / back 三档 */
  const bh = {};
  for (const row of H.rows) { const id = row[H.h.id]; if (row[H.h.arm] === 'anchor') continue;
    bh[id] = bh[id] || { arm: row[H.h.arm], m: {}, l: {} };
    const tgt = row[H.h.mode] === 'multi' ? bh[id].m : bh[id].l;
    for (const [k] of ADD) { tgt[k] = { a: +row[H.h[k + '_10']], f: +row[H.h[k + '_20']], b: +row[H.h[k + '_back']] }; } }
  const POOLBY = {};
  for (const id in bh) (POOLBY[bh[id].arm] = POOLBY[bh[id].arm] || []).push(id);
  const arms = Object.keys(POOLBY).sort();
  console.log('# behjudge 池结构：' + arms.length + ' 池 ‖ ' + arms.map(a => a + '=' + POOLBY[a].length).join(' ‖ '));
  /* 键 = [名字, 分量表]；分量 = [来源, 量, 权重]，来源 'rank' | 'multi' | 'long' */
  const KEYS = [
    ['名次+0.5前二（现役键，本相只是交叉核对）', [['rank', '', 1]]],
    ['纯行为：伤害', [['multi', 'dmg', 1]]],
    ['纯行为：重击', [['multi', 'heavy', 1]]],
    ['纯行为：护盾', [['multi', 'holo', 1]]],
    ['纯行为：零攻率(反)', [['multi', 'zero', -1]]],
    ['纯行为：磨（回合，反）', [['multi', 'rounds', -1]]],
    ['纯行为：平局率(反)', [['multi', 'draw', -1]]],
    ['纯行为：长程伤害', [['long', 'dmg', 1]]],
    ['名次+伤害', [['rank', '', 1], ['multi', 'dmg', 1]]],
    ['名次+零攻(反)', [['rank', '', 1], ['multi', 'zero', -1]]],
    ['名次−磨', [['rank', '', 1], ['multi', 'rounds', -1]]],
    ['名次+长程伤害', [['rank', '', 1], ['long', 'dmg', 1]]],
    ['正对照②：按考卷倒造（噪声=0 ⇒ 必须判"不可判"）', 'exam'],
    ['正对照③：独立随机键（必须判死）', 'rand']
  ];
  const Ptab = rd((FLAG.pools || 'k8fit-2026-10-10.tsv').indexOf(':') >= 0 ? FLAG.pools : join(HERE, FLAG.pools || 'k8fit-2026-10-10.tsv'));
  const EXAM = {}; for (const r of Ptab.rows) EXAM[r[Ptab.h.id]] = +r[Ptab.h.exam];
  const RND = {}; { const prng = G1.T.mulberry32(20261011);
    for (const id of Object.keys(bh).sort()) { RND[id + '#f'] = prng(); RND[id + '#a'] = prng(); RND[id + '#b'] = prng(); } }
  const get = function (id, src, q, which) {
    if (src === 'rank') { const v = rk[id].v; return which === 'f' ? mean(v) : which === 'a' ? mean(v.slice(0, 4)) : mean(v.slice(4)); }
    const t = (src === 'multi' ? bh[id].m : bh[id].l)[q]; return which === 'f' ? t.f : which === 'a' ? t.a : t.b;
  };
  const out = [];
  for (const [kname, terms] of KEYS) {
    const st = { 可分: 0, 不换: 0, 无噪: 0, 恒常: 0, 可判: 0, rho: [], ratio: [], chance: [], same: [], rng: [], noi: [] };
    for (const arm of arms) {
      const ids = POOLBY[arm];
      const F = [], A = [], B = [];
      for (const id of ids) {
        if (terms === 'exam') { F.push(-EXAM[id]); A.push(-EXAM[id]); B.push(-EXAM[id]); continue; }
        if (terms === 'rand') { F.push(RND[id + '#f']); A.push(RND[id + '#a']); B.push(RND[id + '#b']); continue; }
        F.push(terms.map(t => get(id, t[0], t[1], 'f')).reduce((x, y) => x + y, 0));
        A.push(terms.map(t => get(id, t[0], t[1], 'a')).reduce((x, y) => x + y, 0));
        B.push(terms.map(t => get(id, t[0], t[1], 'b')).reduce((x, y) => x + y, 0));
      }
      /* 混合键的尺度：两个分量先在同一池内按**全值**标准化，再相加（否则"伤害 14 局"会淹没"名次 0.7"）*/
      if (terms !== 'exam' && terms !== 'rand' && terms.length > 1) {
        const zOf = function (vec) { const m = mean(vec), s = sd(vec) || 1; return vec.map(v => (v - m) / s); };
        const fF = zOf(F), fA = zOf(A), fB = zOf(B);
        for (let i = 0; i < ids.length; i++) { F[i] = fF[i]; A[i] = fA[i]; B[i] = fB[i]; }
      }
      const am = v => { let b = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[b]) b = i; return b; };
      const noise = ids.map((id, i) => Math.abs(A[i] - B[i]));
      const order = F.map((v, i) => i).sort((a, b) => F[b] - F[a]);
      const gap = F[order[0]] - F[order[1]];
      const ns = Math.max(noise[order[0]], noise[order[1]]);
      const range = F[order[0]] - F[order[order.length - 1]];
      const EPS = 1e-9 * Math.max(1e-12, Math.abs(range));
      st.rng.push(range); st.noi.push(ns);
      /* 三种池要分开印：**噪声没量到**（range>0 但 ns≈0 ⇒ 不可判）与**这把尺本身不动**（range≈0 ⇒ 直接判死）
       *   是两件不同的事。零攻率/平局率在这批包上是后者，不是"仪器看不见"。 */
      if (range <= EPS) st.恒常++;
      else if (ns <= EPS) st.无噪++;
      else { st.可判++; st.可分 += gap > ns ? 1 : 0; }
      const same = am(A) === am(B);
      st.不换 += same ? 1 : 0; st.same.push(same);
      st.rho.push(pear(ranksOf(A), ranksOf(B))); st.ratio.push(ns > EPS ? gap / ns : Infinity);
      st.chance.push(1 / ids.length);   /* 行为族没有逐粒 argmax 序列可比 ⇒ 只按"均匀抽签"给机会水平 */
    }
    const flips = st.same.filter(v => !v).length;
    /* 判据 (b) 只能在**量得到噪声的池**上问：可判 < 7 ⇒ 门槛根本够不着，那不是"分不开"，是"看不见"（不可判）。
     *   但若那些池是因为**值域本身为 0**（这批包在该维一模一样）而不可判 ⇒ 那就直接是"这把尺没有分辨力"（判死）。 */
    out.push({ 键: kname, 池: st.same.length, 可判: st.可判, 可分: st.可分, 不换: st.不换, 无噪: st.无噪, 恒常: st.恒常,
      值域: med(st.rng), 两半差: med(st.noi),
      rho: med(st.rho.filter(v => !isNaN(v))), ratio: med(st.ratio), 换人: flips + '/' + st.same.length,
      p: binomTwo(flips, st.same.length, 1 - mean(st.chance)),
      判: st.恒常 >= 8 ? '判死（这批包在该维一模一样 ⇒ 键不会有任何分辨力）'
        : st.可判 < 7 ? '不可判（只有 ' + st.可判 + '/8 个池量到了噪声）'
        : (st.可分 >= 7 && st.不换 >= 6) ? '入围方向2' : '判死（没有分辨率）' });
  }
  console.log('\n===== §E575 行为族分辨率（分半 = 每包 20 局的第 1~10 局 vs 第 11~20 局）=====');
  console.log('键 | 池 | 可判池 | 可分(≥7) | 分半不换人(≥6) | 零噪声池 | 值域为 0 的池 | 值域中位 | 两半差中位 | 分半ρ中位 | 分差÷两半差 | 换人(p) | 判');
  for (const r of out) console.log([r.键, r.池, r.可判, r.可分, r.不换, r.无噪, r.恒常,
    r.值域.toExponential(2), r.两半差.toExponential(2), isNaN(r.rho) ? 'NaN' : r.rho.toFixed(3),
    isFinite(r.ratio) ? r.ratio.toFixed(2) : '∞', r.换人 + ' ‖ p=' + r.p.toFixed(4), r.判].join(' | '));
  console.log('\n读法：`可分` 用的是 10 局半的抖动（比 20 局真噪声大 √2 倍）⇒ 判"分不开"是保守结论，判"分得开"才需要复核。');
  process.exit(0);
}

/* ===== 判读相：从原料构造候选键，问的只有**分辨率**（不含方向，方向要人席贵尺 = 第 2 项） =====
 * 池 = 每臂那 6 带（这才是终局键真作用的形状：一臂的名人堂 ≈ 6 枚候选）；参照包不入池。
 * 三个统计量：
 *   可分  = 该键的「第 1/2 名分差」> 两枚各自的**自身噪声**（8 粒重复的极差较大者）
 *   不换人 = 前 4 粒选出的冠军 == 后 4 粒选出的冠军（换人对照机会水平 Σp_i² 做精确二项，判据 (c)）
 *   分半ρ = 两半名次在这 6 枚上的 Spearman
 * ⚠ 名次族的重复只动 seedBase（与真臂当选同型）；行为族的重复只动沙箱随机流（游戏流写死）——
 *   两族的"噪声"来源不同型 ⇒ 表里分族印，**不许跨族比大小**。 */
if (PHASE === 'judge') {
  const R = rd(FLAG.raw.indexOf(':') >= 0 || FLAG.raw[0] === '/' ? FLAG.raw : join(HERE, FLAG.raw));
  const byId = {};
  for (const row of R.rows) { const id = row[R.h.id]; (byId[id] = byId[id] || { arm: row[R.h.arm], rep: [] }).rep.push(row); }
  const NUM = (row, k) => { const v = row[R.h[k]]; return v === 'NA' || v === '' ? null : +v; };
  /* 每枚、每粒重复的**观测向量**（键 = 这些列的线性组合，所以加键不加成本）*/
  const obsOf = function (row) {
    const g = +row[R.h.games], f = +row[R.h.first], s = +row[R.h.second], t = +row[R.h.third];
    return { 夺1: f / g, 累2: (f + s) / g, 名次: f / g + 0.5 * (f + s) / g,
      dmg: NUM(row, 'm_dmg'), heavy: NUM(row, 'm_heavy'), holo: NUM(row, 'm_holo'), zero: NUM(row, 'm_zero'),
      draw: NUM(row, 'm_draw'), rounds: NUM(row, 'm_rounds'), G: NUM(row, 'm_G'), landG: NUM(row, 'm_landG'),
      seatSpread: NUM(row, 'm_seatSpread'), l_dmg: NUM(row, 'l_dmg'), l_rounds: NUM(row, 'l_rounds'), l_G: NUM(row, 'l_G') };
  };
  const PACKS = {};
  for (const id in byId) {
    byId[id].rep.sort((a, b) => +a[R.h.rep] - +b[R.h.rep]);
    PACKS[id] = { arm: byId[id].arm, obs: byId[id].rep.map(obsOf), repN: byId[id].rep.length };
  }
  const KEYS = [
    ['名次+0.5前二（现役键）', 'rank', [['名次', 1]]],
    ['只读夺1', 'rank', [['夺1', 1]]],
    ['夺1+前二全额', 'rank', [['累2', 1]]],
    ['名次+伤害', 'mix', [['名次', 1], ['dmg', 1]]],
    ['名次+落地广度', 'mix', [['名次', 1], ['landG', 1]]],
    ['名次+座位稳', 'mix', [['名次', 1], ['seatSpread', -1]]],
    ['名次−磨（回合与平局）', 'mix', [['名次', 1], ['rounds', -1], ['draw', -1]]],
    ['纯行为：出手广度 G', 'beh', [['G', 1]]],
    ['纯行为：长程伤害', 'beh', [['l_dmg', 1]]],
    ['纯行为：重击', 'beh', [['heavy', 1]]],
    ['纯行为：护盾', 'beh', [['holo', 1]]],
    ['纯行为：零攻率(反)', 'beh', [['zero', -1]]],
    ['正对照①：常数键（答案已知 = 一律判死）', 'ctl', []],
    ['正对照②：按考卷倒造（答案已知 = 必须满分）', 'ctl', 'exam'],
    ['正对照③：独立随机键（答案已知 = 一律判死）', 'ctl', null]
  ];
  const POOLBY = {};
  for (const id in PACKS) { if (PACKS[id].arm === 'anchor') continue; (POOLBY[PACKS[id].arm] = POOLBY[PACKS[id].arm] || []).push(id); }
  const arms = Object.keys(POOLBY).sort();
  /* ⚑ 池结构守卫（这一版差点被漏掉：`arm` 没接进 byId ⇒ 50 枚混成一个池，"前二分差"量的是跨臂而不是臂内）*/
  { const np = arms.reduce((s, a) => s + POOLBY[a].length, 0);
    const want = Number(FLAG.wantPools || 8), eachWant = Number(FLAG.each || 6);
    console.log('# 池结构：' + arms.length + ' 池 ‖ ' + arms.map(a => a + '=' + POOLBY[a].length).join(' ‖ ') +
      ' ‖ 入池枚数 ' + np + ' ‖ 参照包（不入池）' + Object.keys(PACKS).filter(k => PACKS[k].arm === 'anchor').length);
    if (arms.length !== want || arms.some(a => POOLBY[a].length !== eachWant)) {
      console.error('⛔ 池结构应为 ' + want + ' 池 × ' + eachWant + ' 枚 ⇒ 现在不对，判读作废（先修接线，别改判据）');
      process.exit(2);
    } }
  /* 考卷列（判据 (d)② 要用 k8fit 的 exam 倒造一条"完美键"）*/
  const Ptab = rd(FLAG.pools.indexOf(':') >= 0 || FLAG.pools[0] === '/' ? FLAG.pools : join(HERE, FLAG.pools));
  const EXAM = {}; for (const r of Ptab.rows) EXAM[r[Ptab.h.id]] = +r[Ptab.h.exam];
  /* 独立随机键（正对照③）用的是一张**预先发好号的固定表**（键 = 枚+粒）⇒ 同一格被多次调用取到同一个值。
   * 第一版是在 val() 里现场 `rnd()`，那是错的：统计里每格会被读 3~4 次（A/B/F/spread），每读一次就换一个数，
   * 于是"随机键"看起来分不开并不是因为它随机，而是因为它根本不是同一把尺 —— 正对照就废了。 */
  const RND = {};
  { const prng = G1.T.mulberry32(20261010);
    for (const id of Object.keys(PACKS).sort()) for (let r = 0; r < 8; r++) RND[id + '#' + r] = prng(); }

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
  function ranksOf(x) { const idx = x.map((v, i) => i).sort((a, b) => x[b] - x[a]); const r = new Array(x.length);
    let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }
  function pear(a, b) { const m1 = mean(a), m2 = mean(b); let n = 0, d1 = 0, d2 = 0;
    for (let i = 0; i < a.length; i++) { n += (a[i] - m1) * (b[i] - m2); d1 += (a[i] - m1) ** 2; d2 += (b[i] - m2) ** 2; }
    return (d1 === 0 || d2 === 0) ? NaN : n / Math.sqrt(d1 * d2); }
  /* 精确二项双侧：P(X ≥ k) + P(X ≤ k)（k 在 np 之上时取尾 + 对称另一侧），与 §E572 同一套路 */
  function binomTwo(k, n, p) { const pr = i => { let c = 1; for (let q = 0; q < i; q++) c = c * (n - q) / (q + 1); return c * Math.pow(p, i) * Math.pow(1 - p, n - i); };
    const obs = pr(k); let s = 0; for (let i = 0; i <= n; i++) if (pr(i) <= obs * 1.0000001) s += pr(i); return Math.min(1, s); }

  /* 每臂池：先按**全 8 粒均值**定 z 的位置与尺度，再算每粒重复的键值 ⇒ 归一化本身不引入噪声 */
  const out = [];
  for (const [kname, fam, terms] of KEYS) {
    const row = { 键: kname, 族: fam, 可分: 0, 不换: 0, 同分带: 0, 无噪: 0, 缺池: 0, rho: [], ratio: [], gapPt: [], chance: [], same: [] };
    for (const arm of arms) {
      const ids = POOLBY[arm]; if (ids.length < 4) continue;
      const mu = {}, sg = {};
      for (const o of ['名次', '夺1', '累2', 'dmg', 'heavy', 'holo', 'zero', 'draw', 'rounds', 'G', 'landG', 'seatSpread', 'l_dmg', 'l_rounds', 'l_G']) {
        const full = ids.map(i => mean(PACKS[i].obs.map(x => x[o]).filter(v => v !== null)));
        mu[o] = mean(full); const raw = ids.map(i => PACKS[i].obs.map(x => x[o]));
        sg[o] = mean(raw.map(v => sd(v.filter(x => x !== null))));
      }
      const val = function (id, r) {
        if (terms === null) return RND[id + '#' + r];                       /* 正对照③：独立随机键 */
        if (terms === 'exam') return -EXAM[id];                             /* 正对照②：按考卷倒造（答案已知 = 必须满分）*/
        if (!terms.length) return 1;                                        /* 正对照①：常数键 */
        if (fam === 'rank') { const x = PACKS[id].obs[r][terms[0][0]];      /* 名次族用**原始百分数**：判据 (a) 要拿前二分差去对 §三 那笔 0.30pt，
                                                                                 z 化之后那个比较就没有量纲了（多族键才需要归一化才能相加） */
          return x === null ? null : terms[0][1] * x; }
        let s = 0;
        for (const [o, w] of terms) { const x = PACKS[id].obs[r][o]; if (x === null || !sg[o]) return null;
          s += w * (x - mu[o]) / sg[o]; }
        return s;
      };
      /* 每粒重复的键值矩阵 M[枚][粒]（先建表再统计 ⇒ 随机对照每格只抽一次，重复调用不会换值）*/
      const nrep = Math.min.apply(null, ids.map(i => PACKS[i].repN));
      const M = ids.map(function (id) { const v = []; for (let r = 0; r < nrep; r++) v.push(val(id, r)); return v; });
      if (M.some(v => v.some(x => x === null))) { row.缺池++; continue; }
      const H = nrep >> 1;
      const A = M.map(v => mean(v.slice(0, H))), B = M.map(v => mean(v.slice(H))), F = M.map(v => mean(v));
      const SP = M.map(v => Math.max.apply(null, v) - Math.min.apply(null, v));
      /* 机会水平 Σp_i²（判据 c）：逐粒重复各选一次 argmax，统计每枚当选的频率 */
      const winRep = new Array(ids.length).fill(0);
      for (let r = 0; r < nrep; r++) { let bi = 0; for (let i = 1; i < ids.length; i++) if (M[i][r] > M[bi][r]) bi = i; winRep[bi]++; }
      const chance = mean(winRep.map(w => (w / nrep) ** 2));
      const am = function (v) { let bi = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[bi]) bi = i; return bi; };
      const same = am(A) === am(B);
      const rho = pear(ranksOf(A), ranksOf(B));
      /* 名次族的前二分差直接印 pt（与 §三 那笔 0.30pt 同量纲）；其余族只印「分差 ÷ 自身噪声」的比值 */
      const order = F.map((v, i) => i).sort((a, b) => F[b] - F[a]);
      const gap = F[order[0]] - F[order[1]];
      const ns = Math.max(SP[order[0]], SP[order[1]]);
      /* ⚑ 零噪声守卫（这一版读出来的真事）：若某池的重复读数**没有可测抖动**（极差 ≤ 值域的 1e-9），
       *   那 "分差 > 噪声" 就**恒成立**，等于给任何确定性维度发一张"有分辨率"的假证。
       *   这种池不计入可分，单独计数并让整条键判"不可判"。
       *   实测：`mirrorHealth` 给定参数是确定性的（游戏流写死 `mulberry32(9000+g)`，沙箱随机流碰不到它）
       *   ⇒ 行为族的 8 粒重复一模一样；而"按考卷倒造"那条正对照**和它们读成同一个形状** ——
       *   这就是"判据对零噪声维度不设防"的证据（正对照第二次发挥作用：第一次抓到 permP 尾数写反）。
       *   所以行为族改用另一条能量到噪声的分半尺：`--phase=behnoise`（按局号切 10+10，见下面那一段）。 */
      /* 浮尘不算噪声：噪声若小于该池值域的 1e-9，那是**浮点尘埃**而不是测量抖动（实测混合键上出现过
       *   分差÷噪声 = 2.6e13 这种读数 —— 行为维逐粒一模一样，只有末位在第 13 位有效数字上抖）。 */
      const range = F[order[0]] - F[order[order.length - 1]];
      if (ns <= 1e-9 * Math.max(1e-12, Math.abs(range))) row.无噪++;
      else row.可分 += (gap > ns) ? 1 : 0;
      row.不换 += same ? 1 : 0;
      row.rho.push(rho); row.ratio.push(ns > 0 ? gap / ns : Infinity); row.gapPt.push(fam === 'rank' ? gap * 100 : NaN);
      if (fam === 'rank' && gap * 100 < 3.0) row.同分带++;    /* 3.0pt = `pick-best.mjs:96` 那条 tol（WR_TOL/SEL_LAND_TOL 的默认档）*/
      row.chance.push(chance); row.same.push(same);
    }
    const fin = row.rho.filter(v => !isNaN(v)).sort((a, b) => a - b);
    const med = a => (a.length ? a[a.length >> 1] : NaN);
    const gaps = row.gapPt.filter(v => !isNaN(v)).sort((a, b) => a - b);
    const ch = mean(row.chance);
    const flips = row.same.filter(v => !v).length;
    out.push({ 键: kname, 族: fam, 池: fin.length, 缺池: row.缺池, 可分: row.可分, 不换: row.不换, 同分带: row.同分带, 无噪: row.无噪,
      rho中位: med(fin), ratio中位: med(row.ratio.slice().sort((a, b) => a - b)), gapPt中位: med(gaps),
      换人: flips + '/' + row.same.length, 机会换人: row.same.length ? ((1 - ch) * 100).toFixed(0) + '%' : '—',
      换人p: row.same.length ? binomTwo(flips, row.same.length, 1 - ch) : NaN,
      判: row.无噪 ? ('不可判（' + row.无噪 + ' 个池的 8 粒重复一模一样 ⇒ 这条键的噪声没被量到）')
        : (row.可分 >= 7 && row.不换 >= 6) ? '入围方向2' : '判死（没有分辨率）' });
  }
  console.log('\n===== §E575 候选当选键的分辨率（8 个臂池 × 各 6 枚 ‖ 分半 = 前 4 粒 vs 后 4 粒重复）=====\n');
  console.log('键 | 族 | 判读的池 | 缺读数跳过 | 零噪声池 | 可分(判据b要 ≥7) | 分半不换人(要 ≥6) | 落在同分带3.0pt内 | 换人/机会水平(精确二项 p) | 分半ρ中位 | 分差÷噪声 中位 | 前二分差pt中位 | 判');
  for (const r of out) console.log([r.键, r.族, r.池, r.缺池, r.无噪, r.可分, r.不换, r.族 === 'rank' ? r.同分带 + '/8' : '—',
    r.换人 + ' ‖ 机会 ' + r.机会换人 + ' ‖ p=' + (isNaN(r.换人p) ? '—' : r.换人p.toFixed(4)),
    isNaN(r.rho中位) ? 'NaN' : r.rho中位.toFixed(3), isFinite(r.ratio中位) ? r.ratio中位.toFixed(2) : '∞',
    isNaN(r.gapPt中位) ? '—' : r.gapPt中位.toFixed(2), r.判].join(' | '));
  console.log('\n判据 (a) 复现性：现役键的前二分差中位必须 ≪ 同分带 3.0pt（§三 那笔账的分布版）；');
  console.log('   若这一格显示"分得开" ⇒ 台子搭错，整表作废。');
  process.exit(0);
}

/* mirrorHealth 的游戏流写死（mulberry32(9000+g)），能动的只有沙箱随机流 ⇒ 重复靠换装好的沙箱粒（文件头那条口径警告）。
 * 名次族固定在 G1（sbseed=1）里跑，与真臂当选同型；行为族第 0 粒也用 sbseed=1 = 现口径，可核对复现。 */
function measureMirror(params, rep, mode) {
  return bootSandbox(rep + 1).T.mirrorHealth(params, LAND_GAMES, N, mode);   /* 每档 mode 各开一个 realm ⇒ 两者只差 mode，不差在相位 */
}
