#!/usr/bin/env node
/* pool-degeneracy.mjs — 全池 30 枚的**非ジ最大单卡占比**（与 DS 那条 `degeneracyVerdict` 门同口径）
 *   动因（10-29 13:2x · 审 DS 的 `45e6dcbf`）：那道门阈值 60% 只由三枚健康包标定（v7 23.4 ‖ K2 20.5 ‖ U2 30.8），
 *   而 `docs/artifacts/promote-R-s123.txt` 在册印的是 **71.0%（gun）**，`R-s123` 是**当前池成员**
 *   ⇒ 门现在会拒掉一枚在册冠军。到底是"该出池"还是"阈值定低了"，得先有全池分布。
 * 口径：与 `tools/promote-champion.mjs:256/257` 逐字同（`breadthProfile(..., 'long' | 'multi', 20)`，缺省 `EPIRUS_BREADTH_GAMES=20`）
 *   ⇒ 两模式各判一次（DS 的门目前只喂 `long`，与用户 10-25 那条"广度两模式取更严"不对称，这一格顺手把数摆出来）。
 * ⚠ 20 局那一档本身有噪声：占比 ±3~4pt 量级 ⇒ 落在 55~65% 带里的枚子单拎出来不许当判语，本脚本再跑一档 `--deep=` 复核。
 * 用法：node scratch/pool-degeneracy.mjs [--deep=55]（`--deep=X` ⇒ 把占比 ≥X% 的枚子按 60 局/模式重跑一遍）
 */
import { readFileSync } from 'node:fs';
import { sandbox, extractJsonObject, breadthProfile } from '../tools/audit-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
/* 剂量：promote 的门缺省吃 `EPIRUS_BREADTH_GAMES=20` ⇒ 这里也用 20 当"门自己的那一档"
 *   ⚑ 另跑一档（`--games=60`）不是加戏，是**判这条线能不能复现**：同一枚包在两档之间会不会跨线 ⇒ 若会，红/绿就不是这枚包的性质 */
const GAMES = Math.max(10, Number(arg('games', 20)) || 20);
const DEEP = arg('deep', '') === '' ? null : Number(arg('deep'));

const W = sandbox();
const P = W.EpirusPolicy;
const src = readFileSync('js/bundled-champion-pool.js', 'utf8');
const objSrc = extractJsonObject(src, 'EPIRUS_CHAMPION_POOL');
if (!objSrc) { console.error('⛔ 从 js/bundled-champion-pool.js 里抽不出 EPIRUS_CHAMPION_POOL ⇒ 无输入，不出数'); process.exit(2); }
const pool = JSON.parse(objSrc);
const rows = [];
let t0 = Date.now();
for (const m of pool.members) {
  const params = P.unpack(m.pack, true);
  if (!params) { console.log('  ⛔ ' + m.id + ' unpack 返回 null ⇒ 这一枚读不出（不许当"合格"）'); continue; }
  const L = breadthProfile(W, Float64Array.from(params), 'long', GAMES);
  const M = breadthProfile(W, Float64Array.from(params), 'multi', GAMES);
  rows.push({ id: m.id, tier: m.tier || '', longPct: 100 * L.maxCardShare, longKey: L.maxCardKey || '—', longN: L.N,
    multiPct: 100 * M.maxCardShare, multiKey: M.maxCardKey || '—', multiN: M.N });
}
const pct = (x) => x.toFixed(1) + '%';
rows.sort((a, b) => Math.max(b.longPct, b.multiPct) - Math.max(a.longPct, a.multiPct));
console.log('# 全池非ジ最大单卡占比 ‖ ' + rows.length + ' 枚 ‖ 口径与 promote 的门逐字同（breadthProfile long ‖ multi 各 ' + GAMES + ' 局）‖ 耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
for (const r of rows) {
  const flag = (r.longPct >= 60 || r.multiPct >= 60) ? ' ≥60⚠' : '';
  console.log('  ' + r.id.padEnd(15) + ' ' + (r.tier || '—').padEnd(5) + ' ‖ long ' + pct(r.longPct).padStart(6) + '（' + r.longKey + ' · n=' + r.longN + '）'
    + ' ‖ multi ' + pct(r.multiPct).padStart(6) + '（' + r.multiKey + ' · n=' + r.multiN + '）' + flag);
}
const overL = rows.filter((r) => r.longPct >= 60), overM = rows.filter((r) => r.multiPct >= 60), overAny = rows.filter((r) => Math.max(r.longPct, r.multiPct) >= 60);
const under = rows.filter((r) => r.longN < 100 || r.multiN < 100);
console.log('⇒ 分布：最高 long ' + pct(Math.max(...rows.map((r) => r.longPct))) + ' ‖ 最高 multi ' + pct(Math.max(...rows.map((r) => r.multiPct)))
  + ' ‖ ≥60% 的枚数：long ' + overL.length + ' ‖ multi ' + overM.length + ' ‖ 任一模式 ' + overAny.length + ' / ' + rows.length);
console.log('   按 DS 的门（只吃 long）会拒：' + (overL.map((r) => r.id).join(' ') || '无') + ' ‖ 按"两模式取严"会拒：' + (overAny.map((r) => r.id).join(' ') || '无'));
console.log('   样本不足（非ジ出手 n<100，门自己判"不判"）：' + (under.map((r) => r.id).join(' ') || '无') + ' ‖ 最小 n = ' + Math.min(...rows.map((r) => Math.min(r.longN, r.multiN))));
if (DEEP != null) {
  const near = rows.filter((r) => Math.max(r.longPct, r.multiPct) >= DEEP);
  console.log('\n# 复核（≥' + DEEP + '% 的那 ' + near.length + ' 枚，每模式 60 局 ⇒ 噪声约降到 1/√3）');
  for (const r of near) {
    const m = pool.members.filter((x) => x.id === r.id)[0];
    const params = Float64Array.from(P.unpack(m.pack, true));
    const L = breadthProfile(W, params, 'long', 60), M = breadthProfile(W, params, 'multi', 60);
    console.log('  ' + r.id.padEnd(15) + ' ‖ 20 局时 long ' + pct(r.longPct) + ' ‖ 60 局 long ' + pct(100 * L.maxCardShare) + '（' + (L.maxCardKey || '—') + ' · n=' + L.N + '）'
      + ' ‖ 60 局 multi ' + pct(100 * M.maxCardShare) + '（' + (M.maxCardKey || '—') + ' · n=' + M.N + '）');
  }
}
