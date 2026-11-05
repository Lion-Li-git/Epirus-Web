/* 2.0 分池装载实测（Qoder · 11-05）
 * 问题：GLM 的 2.0 三带定案（scratch/night6/bands-final.tsv，21 枚 gen-3 包）能不能真上到玩家桌上？
 * 走的是产品那一条路，不是训练侧：真源表 → tools/build-pool-bundle.mjs → EpirusPolicy.loadGame（页面那个严格装载口）
 *   → EpirusPoolDraw.compose（页面逐席抽签）→ EpirusTrainer.policyChooserN + EpirusPlay.autoGameN（页面同一台 chooser）。
 * 只写 scratch/，不覆盖 js/bundled-champion-pool.js。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sandbox, ROOT } from '../tools/audit-lib.mjs';
import { braceObj, widOfArr } from '../champion-map/pack-id.mjs';

/* 与 tools/build-pool-bundle.mjs 同一个取法：外壳名要检查后面紧跟 `=`，
 * 否则 `EPIRUS_CHAMPION_META`（账）会被当成 `EPIRUS_CHAMPION`（包）读走。 */
function extractPack(txt) {
  for (const kx of ['EPIRUS_CHAMPION_3P', 'EPIRUS_CHAMPION']) {
    for (let k = txt.indexOf(kx); k >= 0; k = txt.indexOf(kx, k + 1)) {
      if (!/^\s*=/.test(txt.slice(k + kx.length, k + kx.length + 4))) continue;
      const o = braceObj(txt, k); if (o && Array.isArray(o.a)) return o;
    }
  }
  return null;
}

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 6));

/* ---- 1. 带表 → 文件 ---- */
function walk(dir, out) {
  let es; try { es = readdirSync(dir); } catch (e) { return out; }
  for (const e of es) {
    const p = dir + '/' + e;
    let st; try { st = statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p, out); else if (/\.bak$/.test(e)) out.push(p);
  }
  return out;
}
const cand = walk('scratch', []).concat(walk('docs/artifacts', []));
const lines = readFileSync(ROOT + '/scratch/night6/bands-final.tsv', 'utf8').replace(/\r/g, '').trim().split('\n').slice(1);
const rows = [];
for (const l of lines) {
  const [id, band] = l.split('\t');
  const hits = cand.filter((p) => p.endsWith('/' + id + '-band1.bak') || p.endsWith('/' + id + '-seg1.bak') || p.endsWith('/' + id + '.bak'));
  if (!hits.length) { console.log('  ✘ ' + id + ' 盘上找不到权重文件（band1/seg1/*.bak 三种命名都试了）'); continue; }
  const rel = hits[0].replace(ROOT + '/', '');
  const txt = readFileSync(ROOT + '/' + rel, 'utf8');
  const o = extractPack(txt);
  if (!o) { console.log('  ✘ ' + id + ' 外壳解不出权重数组：' + rel); continue; }
  rows.push({ id, band, rel, wid: widOfArr(o.a), gen: o.dims && o.dims.gen, input: o.dims && o.dims.input, n: o.a.length });
}
console.log('== 带表 21 枚 ⇒ 定位到 ' + rows.length + ' 枚权重文件 ==');
const gens = {};
for (const r of rows) gens['gen=' + r.gen + ' input=' + r.input + ' n=' + r.n] = (gens['gen=' + r.gen + ' input=' + r.input + ' n=' + r.n] || 0) + 1;
console.log('   形状分布：' + Object.entries(gens).map(([k, v]) => k + ' ×' + v).join(' ‖ '));

/* ---- 2. 造表 + 造 bundle（只落 scratch） ---- */
const TSV = 'scratch/qoder-1105-pool-g3.tsv';
const OUT = 'scratch/qoder-1105-pool-g3.js';
const tsv = ['id\twid\tpath\ttier\tinvited\tpromoteVerdict\tseatKill\taddedAt\tnote'].concat(
  rows.map((r) => [r.id, r.wid, r.rel, r.band, '0', 'n/a', '-1', 'Qoder-1105 装载实测（非产品池）', '2.0 分池装载试验'].join('\t'))).join('\n') + '\n';
writeFileSync(ROOT + '/' + TSV, tsv);
const bt = spawnSync(process.execPath, [ROOT + '/tools/build-pool-bundle.mjs',
  '--table=' + TSV, '--out=' + OUT, '--global=EPIRUS_CHAMPION_POOL_G3', '--key=EPIRUS_CHAMPION_3P'], { cwd: ROOT, encoding: 'utf8' });
console.log('== build-pool-bundle rc=' + bt.status + ' ==');
(bt.stdout || '').split('\n').filter(Boolean).slice(-4).forEach((l) => console.log('   ' + l));
(bt.stderr || '').split('\n').filter(Boolean).slice(-4).forEach((l) => console.log('   ⛔ ' + l));
if (bt.status !== 0 || !existsSync(ROOT + '/' + OUT)) { console.log('⇒ 造池就断了，后面不用跑'); process.exit(1); }

/* ---- 3. 页面侧装载：P.loadGame（严格） ---- */
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, D = W.EpirusPoolDraw, Play = W.EpirusPlay, S = W.EpirusState, R = W.EpirusRules;
const bundleTxt = readFileSync(ROOT + '/' + OUT, 'utf8');
const bm = /EPIRUS_CHAMPION_POOL_G3\s*=\s*(\{[\s\S]*\})\s*;/.exec(bundleTxt);
const pool = JSON.parse(bm[1]);
const members = pool.members || pool;
console.log('== 页面侧装载 ' + members.length + ' 枚 ==');
let ok = 0, bad = [];
const packs = [];
for (const m of members) {
  const prm = P.loadGame(m.pack);
  if (!prm) { bad.push(m.id + ' ⇒ loadGame 返回 null（checkPack=' + JSON.stringify(P.checkPack(m.pack)) + '）'); continue; }
  if (!prm.p2) { bad.push(m.id + ' ⇒ 读出来了但**没有 2.0 布局标记**（走的还是 v7 那张网）'); continue; }
  ok++; packs.push({ id: m.id, tier: m.tier, params: prm });
}
console.log('   loadGame + p2 标记通过：' + ok + '/' + members.length + (bad.length ? '' : ' ‖ 全过 ✔'));
for (const b of bad.slice(0, 8)) console.log('   ✘ ' + b);

/* ---- 4. 页面逐席抽签 + 打一局 ---- */
function seatAndPlay(n, modeKey, salt) {
  let comp = null, compErr = '';
  try { comp = D.compose(members, n - 1, D.rng(salt >>> 0), null, null); } catch (e) { compErr = 'compose 抛：' + String(e && e.message || e); }
  const cs = [];
  const byId = {}; members.forEach((m) => { byId[m.id] = m; });
  const picked = (comp && comp.seats && comp.seats.length) ? comp.seats.map((s) => byId[s.id]).filter(Boolean) : null;
  for (let pid = 0; pid < n; pid++) {
    /* 页面那一条路：先让 EpirusPoolDraw 决定这一席是谁，再用页面的严格装载口读它 */
    const mem = picked && picked[pid] ? picked[pid] : members[(salt + pid) % members.length];
    const prm = P.loadGame(mem.pack);
    if (!prm) return { err: '席 ' + pid + ' 装载失败：' + mem.id + '（' + compErr + '）' };
    cs.push(T.policyChooserN(prm, 0.15));
  }
  const st = S.createState(modeKey, { next: T.mulberry32(salt >>> 0 || 1) }, n);
  st.slotSalt = salt >>> 0;
  const keys = {};
  try { Play.autoGameN(st, cs); } catch (e) { return { err: 'autoGameN 抛：' + String(e && e.message || e) }; }
  for (const ev of st.events) if (ev.type === 'action' && ev.key) keys[ev.key] = (keys[ev.key] || 0) + 1;
  return { rounds: st.round, over: !!st.over, winner: st.winner, kinds: Object.keys(keys).length, seats: (picked || []).map((m) => m.id).join('+'), top: Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + '×' + v).join(',') };
}
for (const [n, mode] of [[5, 'multi'], [3, 'multi'], [2, 'long']]) {
  let played = 0, errs = [];
  const kindSet = new Set();
  for (let g = 0; g < GAMES; g++) {
    const r = seatAndPlay(n, mode, 77000 + g * 13);
    if (r.err) { errs.push(r.err); continue; }
    played++; String(r.top || '').split(',').forEach((x) => kindSet.add(x.split('×')[0]));
    if (g === 0) console.log('   ' + n + ' 人·' + mode + ' 第一局：EpirusPoolDraw 抽到 ' + (r.seats || '（compose 没出阵容，按下标兜底）') + ' ‖ 回合 ' + r.rounds + ' ‖ over=' + r.over + ' ‖ 种类 ' + r.kinds + ' ‖ ' + r.top);
  }
  console.log('   ' + n + ' 人·' + mode + '：' + played + '/' + GAMES + ' 局打完 ‖ 出手过的键 ' + kindSet.size + ' 种' + (errs.length ? ' ‖ ⛔ ' + errs[0] : ''));
}

/* ---- 5. 双枪/镜面 这两枚 2.0 包到底出不出手（顺带给 target2 那条线做底数） ---- */
console.log('== 2.0 池里的 双枪/镜面 出手（各 20 局 · 5 人 · ε=0 贪心） ==');
const tally = {};
for (const mem of members) {
  const prm = P.loadGame(mem.pack); if (!prm) continue;
  const c = T.policyChooserN(prm, 0);
  let dual = 0, mir = 0, acts = 0;
  for (let g = 0; g < 20; g++) {
    const st = S.createState('multi', { next: T.mulberry32(9000 + g) }, 5);
    try { Play.autoGameN(st, [c, c, c, c, c]); } catch (e) { continue; }
    for (const ev of st.events) if (ev.type === 'action' && ev.pid === 0) { acts++; if (ev.key === 'dualGun') dual++; if (ev.key === 'mirror') mir++; }
  }
  tally[mem.id] = { dual, mir, acts };
}
const ds = Object.entries(tally).filter(([, v]) => v.dual > 0 || v.mir > 0);
console.log('   21 枚里出手过 双枪/镜面 的：' + ds.length + ' 枚' + (ds.length ? ' ⇒ ' + ds.slice(0, 6).map(([k, v]) => k + '(双枪' + v.dual + '/镜面' + v.mir + ')').join(' ') : '（= 一张卡在整个 2.0 池里从不出现）'));
console.log('\n⇒ 产物：' + TSV + ' ‖ ' + OUT);
