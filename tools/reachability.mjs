/* 可达性表：在人造桌形上量"同一席本回合被原型制御挡下的合计 ≥3"到底开不开放。
 * 主语席（被测包）走 duelAssembly 的**轮换 scripted 席**（座位均衡）；其余 4 席是指名脚本。
 * 报的分母有三层，不许合并：
 *   W_all 回合窗 ‖ W_proto 有席被原型制御挡下的窗 ‖ W_ge3 其中合计 ≥3（= 反伤触发）
 * ⇒ 若 W_proto=0，那是**分母为 0（读不出）**，不是"0% 触发"。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
/* ROOT 自解析（10-18 归仓时改），`WT=<路径>` 可覆盖到别的工作树。 */
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const imp = (p) => import(pathToFileURL(ROOT + '/' + p).href);
const { sandbox, loadChamp } = await imp('tools/audit-lib.mjs');
const { duelAssembly } = await imp('tools/v2v4-lib.mjs');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const W = await imp('tools/audit-lib.mjs').then(m => sandbox(ROOT));
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const MODE = arg('mode', 'multi');
const G = Number(arg('games', 300));
const SPEC = String(arg('seats', 'gunfocus,gunfocus,gunfocus,gunfocus'));
const PACK = arg('pack', 'docs/artifacts/v7beadseed-82.bak');
const params = loadChamp(W, PACK, ROOT);
if (!params) { console.error('⛔ 包读不出'); process.exit(7); }
const packInner = T.policyChooserN(params, 0.15);
const PICKS = Object.keys(B).filter(k => /^pick/.test(k));
const names = SPEC.split(',').map(s => s.trim());
const picks = names.map(n => {
  /* 按**大小写不敏感**匹配现成的 pick 名（`gunfocus` ⇒ `pickGunFocus`，Naive 首字母大写会拼成 pickGunfocus 而找不到） */
  const hit = PICKS.find(k => k.slice(4).toLowerCase() === n.toLowerCase());
  if (!hit) { console.error('⛔ 脚本不存在：' + n + '（可选：' + PICKS.map(k => k.slice(4)).join(',') + '）'); process.exit(2); }
  return B[hit];
});
const st = { games: 0, W_all: 0, W_proto: 0, W_ge3: 0, reflEv: 0, reflAmt: 0, gift: 0, giftFired: 0, rounds: 0, subjSeat: 0, protoHeldSeatTurns: 0 };
let RS = [], prevEv = 0, lastSt = null;
const onTurn = (s2) => {
  if (s2 !== lastSt) { prevEv = 0; lastSt = s2; RS = []; }
  const evLen = (s2.events || []).length, acts = [];
  for (let i = 0; i < s2.p.length; i++) { const a = s2.actions && s2.actions[i]; if (a && a.key) acts.push({ pid: i, key: a.key, target: a.target != null ? Number(a.target) : null }); }
  RS.push({ s: prevEv, e: evLen, acts }); prevEv = evLen;
};
const onGame = (s2, seat) => {
  st.games++; st.subjSeat = seat;
  const ev = s2.events || [];
  for (const w of RS) {
    st.W_all++;
    const sum = {}, attackers = {};
    for (let i = w.s; i < w.e; i++) {
      const e = ev[i]; if (!e) continue;
      if (e.type === 'blocked' && e.by === '原型制御') { sum[e.to] = (sum[e.to] || 0) + (e.amt || 0); }
      if (e.type === 'reflect' && e.by === 'proto') { st.reflEv++; st.reflAmt += (e.amt || 0); }
    }
    const held = Object.keys(sum);
    if (held.length) { st.W_proto += held.length; for (const k of held) if (sum[k] >= 3) st.W_ge3++; }
    const gifts = w.acts.filter(a => a.pid === seat && a.key === R.SK.HOLO && a.target != null);
    for (const g of gifts) { st.gift++; if ((sum[g.target] || 0) >= 3) st.giftFired++; }
  }
  st.rounds += RS.length;
  RS.length = 0;
};
/* `--seats=` 给 **5 个**名字 ⇒ 五席全脚本（"机制可达性上限桌"，主语包不上场）；给 4 个 ⇒ 包占轮换席 */
const ALL5 = picks.length === 5;
const seatPick = (pid) => B[(function () { const n = names[pid % names.length].toLowerCase(); return PICKS.find(k => k.slice(4).toLowerCase() === n); })()];
duelAssembly({ S, Play, T, R }, params, { games: G, mode: MODE, seed0: 90210, n: 5,
  scripted: ALL5 ? function (st, pid, legal) { return seatPick(pid)(st, pid, legal); } : packInner,
  chooserFor: ALL5 ? function (pid) { return seatPick(pid); } : (pid) => picks[(pid + 1) % picks.length],
  onTurn, onGame });

const pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(2) + '%（' + a + '/' + b + '）' : '—（分母 0，不是 0%）');
console.log('## 桌形 [' + SPEC + '] + 主语包（轮换席）‖ mode=' + MODE + ' ‖ 局 ' + st.games + ' ‖ 回合 ' + st.rounds + ' ‖ 包=' + PACK.replace(/^.*\//, ''));
console.log('   被原型制御挡下过的「席·回合」格 ' + st.W_proto + '（每局 ' + (st.W_proto / st.games).toFixed(2) + '）‖ 其中合计 ≥3 ⇒ 反伤触发：**' + pct(st.W_ge3, st.W_proto) + '**');
console.log('   反伤事件 ' + st.reflEv + '（每局 ' + (st.reflEv / st.games).toFixed(3) + '）‖ 反伤总量 ' + st.reflAmt.toFixed(0) + '（每局 ' + (st.reflAmt / st.games).toFixed(3) + '）');
console.log('   主语包席送盾 ' + st.gift + '（每局 ' + (st.gift / st.games).toFixed(2) + '）‖ 送盾那窗目标合计 ≥3 ：' + pct(st.giftFired, st.gift));
