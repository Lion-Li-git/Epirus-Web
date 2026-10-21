/* kill-instinct.mjs —— 冠军到底**收不收人**（用户 10-13 的第三个观察："这些冠军之前训练出来收割倾向都比较弱，更倾向于打高ep多血的人"）
 *
 * 为什么单独量这个：用户这句话是"印象"，而它决定两件正在做的事 ——
 *   ① 弱档脚本的 P3（大雷"先收能一雷打死的"）是不是真的比现役强；
 *   ② 如果要给冠军加收割，那是训练侧/特征侧的改动（用户的裁定范围），先把现状数清楚。
 *
 * 口径：与 `usage-probe` / 训练侧 `mirrorHealth` 同一套装配（5 席全是被测包自己 · `Play.autoGameN`），
 *   ε 默认 **0（贪心 ⇒ 量的是策略的意图，不是抽签的偶然）**。
 *   每次出手记四件事（全部从 chooser 的**返回对象**读，不猜引擎默认目标）：
 *     · attackPlays  这一手是不是伤害招（`dmg.amt ≥ 1` 且带了目标）
 *     · killAvail    当时**存在**一个活着的目标 `hp ≤ amt`（能一手打死）
 *     · tookKill     而它打的就是那样的人 ⇒ **收割率 = tookKill / killAvail**
 *     · hitRichest / hitThickest  打的是"场上**唯一** ep 最高的人"/"唯一 hp 最高的人" ⇒ 分母是 `uniqRich`/`uniqThick`
 *       ⚠ 第一版写 `=== 最大值` 且分母取全部招，而 5 人局里 ep 常常全员并列 ⇒ 报出 52%~90% 的**虚高**数
 *         （差点据此附和"冠军爱打高 ep"）。收紧：并列的场合既不进分子也不进分母。
 *   ⚠ killAvail 只看 hp，**没算对面摆了防御/原型制御**（那要读整回合的交互，是另一把尺）⇒ 它是"表面上能杀"的**上界**，
 *     所以"没抓"里有一部分其实可能被挡住 ⇒ 本读数报的是"表面上有机会不抓"的次数，别当成"白白放走"的确证。
 *
 * 自检（`--self-test`，三格必然移动分布的强制 chooser）：
 *   ① "能杀就杀" ⇒ 收割率必须 100%（有 killAvail 的场合全抓）；
 *   ② "永远打血最多的" ⇒ 在**唯一最厚**的场合必须 100% 打它，而收割率必须 < 100%（两个判据互相分得开）；
 *   ③ `uniqThick` 必须严格小于 `attackPlays` ⇒ 钉"唯一性过滤"真的在起作用（否则并列全算命中，这条就是摆设）。
 *
 * 用法：node docs/debug/kill-instinct.mjs [--ids=a,b | --paths=f.js] [--games=40] [--eps=0] [--mode=multi] [--out=_kill.tsv]
 *       node docs/debug/kill-instinct.mjs --self-test
 * 退出码：0 ‖ 2 = 名单空 / 装载失败 / 自检不过
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags } from '../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['ids', 'paths', 'games', 'eps', 'mode', 'out', 'seed', 'self-test'], 'kill-instinct');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const EPS = Number(arg('eps', 0));
const MODE = arg('mode', 'multi');

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, P = W.EpirusPlay, T = W.EpirusTrainer;
const BY = R.byKey;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEED = Number(process.env.EPIRUS_SEED || 20261013);

function scan(choose, G) {
  const o = { attackPlays: 0, killAvail: 0, tookKill: 0, hitRichest: 0, hitThickest: 0, noTarget: 0,
    uniqRich: 0, uniqThick: 0, games: 0 };
  for (let g = 0; g < G; g++) {
    const st = S.createState(MODE, { next: mulberry32(SEED + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const wrapped = function (state, pid, legal) {
      const res = choose(state, pid, legal);
      const key = (typeof res === 'string') ? res : (res && res.key);
      const tgt = (res && typeof res === 'object') ? res.target : null;
      const d = BY[key];
      if (d && d.dmg && d.dmg.amt >= 1 && d.target === 'enemy') {
        const alive = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) alive.push(i);
        if (tgt == null) { o.noTarget++; }
        else {
          o.attackPlays++;
          const amt = d.dmg.amt;
          const killSet = alive.filter(i => state.p[i].hp <= amt);
          let mx = -Infinity, richest = -Infinity;
          for (const i of alive) { if (state.p[i].hp > mx) mx = state.p[i].hp; if (state.p[i].ep > richest) richest = state.p[i].ep; }
          if (killSet.length) { o.killAvail++; if (state.p[tgt].hp <= amt) o.tookKill++; }
          /* ⚠ "打最富/打血厚"必须**只在唯一最大时才算**：5 人局里 ep 常常全是 0（大家刚出完招），
           *   用 `=== 最大值` 会把并列全算成命中 ⇒ 第一版给出 52%~90% 的虚高数（我差点据此附和"冠军爱打高ep"）。
           *   收紧：分母只数"存在唯一最富/唯一最厚"的那些招，分子只数"打的就是那一个"。 */
          const richSet = alive.filter(i => state.p[i].ep === richest);
          const thickSet = alive.filter(i => state.p[i].hp === mx);
          if (richSet.length === 1) { o.uniqRich++; if (tgt === richSet[0]) o.hitRichest++; }
          if (thickSet.length === 1) { o.uniqThick++; if (tgt === thickSet[0]) o.hitThickest++; }
        }
      }
      return res;
    };
    const ch = []; for (let i = 0; i < 5; i++) ch.push(wrapped);
    P.autoGameN(st, ch);
    o.games++;
  }
  return o;
}

/* 两具强制 chooser：只读 state，不 import 任何策略 */
const forceKill = function (state, pid, legal) {
  const alive = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) alive.push(i);
  const atk = legal.filter(l => l.affordable && BY[l.key] && BY[l.key].dmg && BY[l.key].dmg.amt >= 1 && BY[l.key].target === 'enemy');
  for (const l of atk) { const amt = BY[l.key].dmg.amt; const k = alive.find(i => state.p[i].hp <= amt); if (k != null) return { key: l.key, target: k }; }
  if (atk.length) return { key: atk[0].key, target: alive[0] };
  return 'ji';
};
const forceThickest = function (state, pid, legal) {
  const alive = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) alive.push(i);
  const atk = legal.filter(l => l.affordable && BY[l.key] && BY[l.key].dmg && BY[l.key].dmg.amt >= 1 && BY[l.key].target === 'enemy');
  if (atk.length && alive.length) {
    let mx = -Infinity, t = alive[0];
    for (const i of alive) if (state.p[i].hp > mx) { mx = state.p[i].hp; t = i; }
    return { key: atk[0].key, target: t };
  }
  return 'ji';
};

if (process.argv.includes('--self-test')) {
  let nok = 0, nbad = 0;
  const chk = (name, cond, got) => { if (cond) { nok++; console.log('  ok   ' + name); } else { nbad++; console.log('  FAIL ' + name + ' ‖ 实测 ' + got); } };
  const a = scan(forceKill, 12), b = scan(forceThickest, 12);
  const rate = (o) => (o.killAvail ? o.tookKill / o.killAvail : 0);
  chk('①"能杀就杀"⇒ 收割率必须 100%（否则是 tookKill/killAvail 接错）', a.killAvail > 0 && rate(a) === 1, (a.killAvail ? rate(a) : '空跑') + ' (killAvail=' + a.killAvail + ')');
  chk('②"只打血最多"⇒ 收割率必须 <100%（两条判据互相分得开）', b.killAvail > 0 && rate(b) < 1, rate(b));
  chk('②"只打血最多"⇒ 唯一最厚场合必须 100% 打它（否则 hitThickest 的字段接错）',
    b.uniqThick > 0 && b.hitThickest === b.uniqThick, b.hitThickest + '/' + b.uniqThick);
  chk('②并列要排除：uniqThick 必须 < attackPlays（否则"唯一性"这层根本没生效）',
    b.uniqThick < b.attackPlays, b.uniqThick + ' vs ' + b.attackPlays);
  console.log('kill-instinct 自检：' + nok + ' ok ‖ ' + nbad + ' FAIL ‖ 能杀就杀 n=' + a.killAvail + '/' + a.attackPlays + ' 招');
  process.exit(nbad ? 2 : 0);
}

const CO = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h0 = Object.fromEntries(CO[0].split('\t').map((c, i) => [c, i]));
const rowsC = CO.slice(1).map(l => { const c = l.split('\t'); return { id: c[h0.id], path: c[h0.path] }; }).filter(e => e.id && e.path);
const IDS = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
const PATHS = String(arg('paths', '')).split(',').map(s => s.trim()).filter(Boolean);
let list = IDS.length ? rowsC.filter(e => IDS.indexOf(e.id) >= 0) : [];
if (PATHS.length) list = list.concat(PATHS.map(p => ({ id: p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''), path: p })));
if (!list.length) { console.error('⛔ 名单是空的（--ids= / --paths=）'); process.exit(2); }

console.log('装配=' + MODE + ' · ε=' + EPS + '（贪心=意图）· ' + GAMES + ' 局/枚 · 5 席镜像');
console.log('包名'.padEnd(20) + '伤害招  可杀场合  抓到的  收割率 ‖ 打最富  打血厚 ‖ 无目标');
const out = [];
let n = 0;
for (const e of list) {
  const p = isAbsolute(e.path) ? e.path : join(ROOT, e.path);
  if (!existsSync(p)) { console.error('  ⚠ ' + e.id + ' 文件不在 ⇒ 跳过'); continue; }
  let params; try { params = loadChamp(W, p, ROOT); } catch (x) { console.error('  ⚠ ' + e.id + ' 读包失败：' + String(x.message || x).split('\n')[0]); continue; }
  if (!params || !params.length) { console.error('  ⚠ ' + e.id + ' 读不出参数 ⇒ 跳过'); continue; }
  const o = scan(T.policyChooserN(params, EPS), GAMES); n++;
  const pct = (v, d) => (d ? (v / d * 100).toFixed(1) + '%' : '-');
  console.log(e.id.padEnd(20) + String(o.attackPlays).padStart(7) + String(o.killAvail).padStart(11) + String(o.tookKill).padStart(9) +
    pct(o.tookKill, o.killAvail).padStart(9) + ' ‖ ' + pct(o.hitRichest, o.uniqRich) + '(' + o.uniqRich + ') ' +
    pct(o.hitThickest, o.uniqThick) + '(' + o.uniqThick + ')' + ' ‖ ' + o.noTarget);
  out.push([e.id, o.attackPlays, o.killAvail, o.tookKill, pct(o.tookKill, o.killAvail),
    pct(o.hitRichest, o.uniqRich), o.uniqRich, pct(o.hitThickest, o.uniqThick), o.uniqThick, o.noTarget].join('\t'));
}
if (!n) { console.error('⛔ 一枚都没装载成功'); process.exit(2); }
const P2 = join(ROOT, 'champion-map', arg('out', '_kill.tsv'));
writeFileSync(P2, 'id\tattackPlays\tkillAvail\ttookKill\tkillRate\thitRicestShare\tuniqRich\thitThickestShare\tuniqThick\tnoTarget\n' + out.join('\n') + '\n');
console.log('\n读法：收割率的分母是"有可杀场合的招"，不是全部招 ⇒ "抓不到"才是这条要看的。');
console.log('     "打最富/打血厚"的分母是括号里的 n（**只有存在唯一最富/唯一最厚的那些招**才算得出这一格）⇒ 别拿它跟 attackPlays 比。');
console.log('已写 champion-map/' + arg('out', '_kill.tsv') + '（`_*` 不入库）');
