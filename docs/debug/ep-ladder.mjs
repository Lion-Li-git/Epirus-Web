/* ep-ladder.mjs —— 脚本席的**珠数分布**（经济天花板；10-13 用来定位"六条计划为什么不触发"）
 *
 * ★ 为什么这台必须先问"席位装配是谁"（这是它最重要的一条口径）：默认 5 席全是被测脚本自己（镜像）⇒
 *   没人真正逼它花钱、也没人打它 ⇒ 珠数**系统性虚高**（实测镜像里最高到过 51 珠；用户 10-13 当场指出
 *   "攒到 51ep 也太夸张了，到 20 都绰绰有余可以玩各种技能了"）。要回答"她给的 3/5/7 珠门槛在**真装配**里够不够得到"，
 *   必须喂混合席位：
 *     node docs/debug/ep-ladder.mjs --seats=st:toolkit,st:toolkit,@T8-s114,@v7u1-82,@SP-s30
 *   `@id` = 从 `champion-map/coords.tsv` 的 path 装一枚真包（与 `usage-probe` 同一份名册，ε=0 贪心）。
 *   计数只数**被测脚本那些席**（包席的珠不算进来），第一行会把装配原样打出来 ⇒ 引用任何一个数都要带上它。
 *
 * 用法：node docs/debug/ep-ladder.mjs [--seats=a,b,@id,...] [--games=20]
 *       （默认 --seats 是 5 席镜像 ⇒ 读数只能当"无压力上限"看）
 * 退出码：0 ‖ 2 = 席位认不出 / 包文件不在 / 名单里没有被测席
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const W = sandbox(ROOT);
const S = W.EpirusState, P = W.EpirusPlay, BT = W.EpirusBots, R = W.EpirusRules, SK = R.SK, TR = W.EpirusTrainer;
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 20)) || 20;
const SPEC = String(arg('seats', '')).split(',').map(s => s.trim()).filter(Boolean);
const rndOf = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const CO = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h0 = Object.fromEntries(CO[0].split('\t').map((c, i) => [c, i]));
function packChooser(id) {
  const row = CO.slice(1).map(l => l.split('\t')).find(c => c[h0.id] === id);
  if (!row || !row[h0.path]) { console.error('⛔ coords.tsv 里没有 ' + id + ' 或它没有 path（先跑 attach-path.mjs）'); process.exit(2); }
  const path = join(ROOT, row[h0.path]);
  if (!existsSync(path)) { console.error('⛔ 包文件不在：' + row[h0.path]); process.exit(2); }
  const params = loadChamp(W, path, ROOT);
  if (!params || !params.length) { console.error('⛔ 包读不出参数：' + id); process.exit(2); }
  return { label: '@' + id, isTool: false, choose: TR.policyChooserN(params, 0) };
}
const spec = SPEC.length ? SPEC : ['st:toolkit', 'st:toolkit', 'st:toolkit', 'st:toolkit', 'st:toolkit'];
const seats = spec.map(s => {
  if (s.startsWith('@')) return packChooser(s.slice(1));
  const st = BT.STYLES.find(x => x.id === s);
  if (!st) { console.error('⛔ 认不出的席位：' + s + '（STYLES 里没有 ⇒ 读数会静默少一席，宁可红）'); process.exit(2); }
  return { label: s, isTool: (s === 'st:toolkit'), choose: st.pick };
});
const toolSeats = seats.map((s, i) => (s.isTool ? i : -1)).filter(i => i >= 0);
if (!toolSeats.length) { console.error('⛔ 席位表里没有 st:toolkit ⇒ 这台要量的经济是谁的？'); process.exit(2); }

const hist = {}; let maxEp = 0, dec = 0, p95 = 0, affRing = 0, affBigT = 0, affCurse7 = 0, playedRing = 0, playedBigT = 0, hpBehind = 0;
const epList = [];
for (let g = 0; g < GAMES; g++) {
  const st = S.createState('multi', { next: rndOf(20261013 + g) }, seats.length);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const wrapped = (state, pid, legal) => {
    const me = state.p[pid];
    const watching = toolSeats.includes(pid);
    if (watching) {
      dec++; epList.push(me.ep);
      if (me.ep > maxEp) maxEp = me.ep;
      hist[me.ep] = (hist[me.ep] || 0) + 1;
      const has = k => legal.some(l => l.key === k && l.affordable);
      if (has(SK.RING)) affRing++;
      if (has(SK.BIG_T)) affBigT++;
      if (me.ep >= 7 && has(SK.CURSE)) affCurse7++;
      let mx = -Infinity; for (let i = 0; i < state.p.length; i++) { if (i !== pid && state.p[i].hp > 0 && state.p[i].hp > mx) mx = state.p[i].hp; }
      if (isFinite(mx) && me.hp < mx) hpBehind++;
    }
    const r = seats[pid].choose(state, pid, legal);
    if (watching) {
      const k = typeof r === 'string' ? r : (r && r.key);
      if (k === SK.RING) playedRing++;
      if (k === SK.BIG_T) playedBigT++;
    }
    return r;
  };
  P.autoGameN(st, seats.map(() => wrapped));
}
const sorted = epList.slice().sort((a, b) => a - b);
p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
console.log('席位装配：' + seats.map(s => s.label).join(' + ') + '（只统计 st:toolkit 那些席）');
console.log(GAMES + ' 局 · 被测席决策 ' + dec + ' 次');
console.log('出手时珠数分布：' + Object.keys(hist).sort((a, b) => a - b).map(e => e + '珠×' + hist[e] + ' (' + (hist[e] / dec * 100).toFixed(1) + '%)').join(' ‖ '));
console.log('最大珠数 ' + maxEp + ' ‖ **P95 = ' + p95 + '**（引用"现场能攒到几珠"请用 P95，最大值只是长尾）');
console.log('聚能环买得起：' + affRing + ' 次 (' + (affRing / dec * 100).toFixed(2) + '%) ‖ 大雷买得起：' + affBigT + ' ‖ ep≥7 且贴贴买得起：' + affCurse7);
console.log('血不劣势（无人比我血多）的比例：' + ((1 - hpBehind / dec) * 100).toFixed(1) + '%');
console.log('实际打出：聚能环 ' + playedRing + ' 次 ‖ 大雷 ' + playedBigT + ' 次');
