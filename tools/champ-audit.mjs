/* Epirus 冠军体检（v1.5.8）
 *
 * 为什么要有它：**考卷 1st 率可以被"熬"骗**。
 * v1.5.7 我把 long-33 换上线，依据是 canonical 多人考卷 41.0%（旧产物 17.8%）。
 * 但浏览器对战测试 + 引擎量化发现：long-33 在 5 座全是自己的自对局里
 * **20/20 局零伤害、60 回合平局** —— 它只刷聚能环和ジ、从不出手打人，
 * 那个 41% 是"熬到哨声比血量"赢来的，不是打出来的。
 * 千问体检 §5-4 早就警告过这一点（"改报 cost≥3 落地伤害 + 哨声前 HP 领先，
 * 后者能量出'赢'还是'熬'"），我当时没把它变成硬指标 ⇒ 这次把它工具化。
 *
 * 输出四类指标：
 *   A. 考卷：canonical 多人 3 血考卷 1st%（外部脚本对手，可被"熬"骗）
 *   B. 打架活跃度（自对局，5 座同一冠军）：伤害/局、cost≥3 伤害/局、零伤害率、平均回合
 *   C. 病理：全息屏障施放/局（>0 且高 ⇒ 互套盾风险）、平局率（无人被淘汰）
 *   D. 反弹墙：长程口径 4 座纯反弹（`--mode=long --field=reflectwall`）
 *
 * 用法：node tools/champ-audit.mjs [--games=20] [--exam-games=20] [文件...]
 *       （不给文件则体检全部在库冠军 + 线上 bundle）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = function (n, d) {
  const hit = process.argv.find(function (a) { return a.indexOf('--' + n + '=') === 0; });
  return hit ? hit.split('=')[1] : d;
};
const GAMES = Number(flag('games', 20));
const EXG = Number(flag('exam-games', 20));
const CORE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/policy.js', 'js/train/bots.js', 'js/train/evo.js'];

function sandbox() {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
  sb.globalThis = sb;
  for (const f of CORE) vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
  return sb.window;
}
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function loadChamp(W, file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (!m) return null;
  return W.EpirusPolicy.unpack(JSON.parse(m[1]));
}

/* A. 外部考卷（沿用 canonical eval-5p，20 局） */
function exam(file, extra) {
  const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', String(EXG), '5', '77000', file].concat(extra || []), { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /\[(?:冠军|消融[^\]]*)\]\s*1st=([\d.]+)%/.exec(out);
  const c3 = /cost>=3 出手占比=([\d.]+)%/.exec(out);
  return { first: m ? Number(m[1]) : null, cost3: c3 ? Number(c3[1]) : null };
}

/* B/C. 自对局：5 座同一冠军 */
function selfPlay(W, params, mode) {
  const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
  const N = mode === 'long' ? 5 : 5;
  let dmg = 0, heavyDmg = 0, holo = 0, draws = 0, rounds = 0, zero = 0, attacks = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState(mode === 'long' ? 'long' : 'multi', { next: mulberry32(9000 + g) }, N);
    const ch = []; for (let i = 0; i < N; i++) ch.push(T.policyChooserN(params, 0.15));
    Play.autoGameN(st, ch);
    let gd = 0;
    const HP = st.mode.hp;
    for (const e of st.events) {
      if (e.type === 'holoSet') holo++;
      if (e.type === 'damage') {
        dmg += e.amt; gd += e.amt;
        /* cost≥3 的落地伤害：从事件里认 via（技能）成本 */
        const def = e.via ? R.byKey[e.via] : null;
        if (def && def.cost != null && def.cost >= 3) heavyDmg += e.amt;
      }
      if (e.type === 'action' || e.type === 'cast') attacks++;
    }
    rounds += st.round;
    if (gd === 0) zero++;
    if (st.p.every(function (p) { return p.hp > 0; })) draws++;
  }
  return {
    dmgPerGame: dmg / GAMES, heavyPerGame: heavyDmg / GAMES, holoPerGame: holo / GAMES,
    zeroRate: zero / GAMES, drawRate: draws / GAMES, rounds: rounds / GAMES
  };
}

const list = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const files = list.length ? list : (function () {
  const out = ['js/bundled-champion-3p.js'];
  const dir = join(ROOT, 'docs/artifacts');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (/^(champion-5p-.*|long-3\d|eco2?|def|rwd0|lng[AB])-\d+\.bak$/.test(f) || /^champion-5p-[\w.]+\.bak$/.test(f)) out.push('docs/artifacts/' + f);
    }
  }
  return out;
})();

const W = sandbox();
/* v1.5.8：训练在跑时 bundle 会被临时覆盖成热启动基线（见 tools/ring2-run.mjs 的训练锁）
 * ⇒ 此时量 `js/bundled-champion-3p.js` 会得到旧冠军的特征（本轮踩过）。给该行打标记。 */
const trainingLive = existsSync(join(ROOT, 'docs/artifacts/.training.lock'));
console.log('冠军体检（自对局 ' + GAMES + ' 局 · 考卷 ' + EXG + ' 局）' + (trainingLive ? '  ⚠️ 训练进行中：bundle 行不可信，请看对应 .bak' : '') + '\n');
console.log('文件'.padEnd(42) + 'A 考卷1st  B伤害/局  B重击/局  C盾/局  零伤害率 平局率  回合   D长程反弹墙');
for (const f of files) {
  const params = loadChamp(W, f);
  if (!params) { console.log(f.padEnd(42) + '  (读不出冠军包)'); continue; }
  const e1 = exam(f, []);
  const e2 = params ? exam(f, ['--mode=long', '--field=reflectwall']) : { first: null };
  const sp = selfPlay(W, params, 'multi');
  const nm = f.replace('docs/artifacts/', '').replace('js/', '').slice(0, 41);
  console.log(nm.padEnd(42) +
    String(e1.first == null ? '?' : e1.first).padStart(8) + '%' +
    sp.dmgPerGame.toFixed(1).padStart(9) +
    sp.heavyPerGame.toFixed(1).padStart(10) +
    sp.holoPerGame.toFixed(1).padStart(8) +
    (sp.zeroRate * 100).toFixed(0).padStart(9) + '%' +
    (sp.drawRate * 100).toFixed(0).padStart(7) + '%' +
    sp.rounds.toFixed(1).padStart(7) +
    String(e2.first == null ? '?' : e2.first).padStart(14) + '%');
}
console.log('\n判读：**A 高但 B 伤害≈0** = 靠"熬到哨声"赢的，不是强度（long-33 就是这个形状）；');
console.log('      C 盾/局 高 ⇒ 互套盾风险（v1.5.4 之后把盾套给对手）；零伤害率/平局率高 = 摆烂');
