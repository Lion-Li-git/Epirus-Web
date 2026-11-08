/* 池清理第二轮（用户 11-08 晚令："进池最多缺一门 + 反射墙族差太多 + 多踢几个去软带或踢出去"）
 * ① coords gen3：池 15 枚门禁列回填（feas-poolfix 双桌）‖ ② pool-members.tsv：踢 3 / 降 4 / 进 ADAPT2-Q-s7（用户点名）
 * 备份：coords .bak-gates ‖ pool .bak-pool2
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const RD = f => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').filter(x => x !== '').map(l => l.split('\t'));

/* ===== ① coords 门禁回填 ===== */
const MAP = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(MAP, MAP + '.bak-gates');
const co = RD(MAP);
const H = Object.fromEntries(co[0].map((x, i) => [x, i]));
const FIX = {};
for (const [f, suf] of [['scratch/night-adapt2/feas-poolfix-multi.tsv', 'Short'], ['scratch/night-adapt2/feas-poolfix-long.tsv', 'Long']]) {
  const t = RD(f);
  const hh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) {
    FIX[r[hh.id]] = FIX[r[hh.id]] || {};
    FIX[r[hh.id]]['ok' + suf] = r[hh.ok];
    FIX[r[hh.id]]['fails' + suf] = r[hh.fails] || '';
  }
}
let nFill = 0;
for (const r of co.slice(1)) {
  const f = FIX[r[H.id]];
  if (!f) continue;
  r[H.okShort] = f.okShort; r[H.failsShort] = f.failsShort;
  r[H.okLong] = f.okLong; r[H.failsLong] = f.failsLong;
  nFill++;
}
writeFileSync(MAP, co.map(r => r.join('\t')).join('\n') + '\n');
console.log('coords 门禁回填 ' + nFill + ' 行（备份 ' + MAP + '.bak-gates）');

/* ===== ② pool-members.tsv ===== */
const PF = 'champion-map/pool-members.tsv';
copyFileSync(PF, PF + '.bak-pool2');
const pm = RD(PF);
const ph = Object.fromEntries(pm[0].map((x, i) => [x, i]));
const now = new Date().toString();
const KICK = ['G5DEF-s41', 'GD3ALL-POPP-s17', 'DSTR4-s13'];
const DEMOTE = {
  'L5-1200-s13': '11-08 晚降软（ZCode·用户令「进池最多缺一门+清垃圾」）：门禁补量缺 2 型门×2 桌——短 广2.59+还10.7% ‖ 长 广2.91+还14.3%（线：广3/还20%）‖ exam-fb 场A 6.7%、场B 3.00、农民 100% ‖ 考卷 1st 57.2% 仍是软带强手，但覆盖面/还手双废',
  'GD3ALL-PUSHON-s41': '11-08 晚降软（同上口径）：缺 1 型门（广）双桌——G 1.38/1.41 vs 线 3，近单招 ‖ exam-fb 场A 32.1%、场B 4.00、农民 100%（战斗不弱，纯覆盖面问题）',
  'GD3ALL-POPP-s41': '11-08 晚降软（同上口径）：缺 1 型门（广）双桌——G 1.93/1.82 ‖ exam-fb 场A 39.0%（全池最高）、场B 4.00、农民 100% ‖ 单招',
  'COMBO-s13': '11-08 晚降软（同上口径）：缺 1 型门（场B）双桌——清场 0.00/0.00 vs 线 0.3，清场全无 ‖ exam-fb 场A 25.7%、场B 0.00、农民 100%',
};
const out = [pm[0]];
let nKick = 0, nDemo = 0;
for (const r of pm.slice(1)) {
  const id = r[ph.id];
  if (KICK.includes(id)) { nKick++; console.log('踢出池：' + id); continue; }
  if (DEMOTE[id]) {
    r[ph.tier] = 'soft';
    r[ph.note] = (r[ph.note] || '') + ' ‖ ' + DEMOTE[id];
    nDemo++;
  }
  out.push(r);
}
/* ADAPT2-Q-s7 进硬带（用户点名） */
const s = readFileSync('docs/artifacts/night-adapt/ADAPT2-Q-s7.js', 'utf8');
const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '';
const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
out.push(['ADAPT2-Q-s7', '6c84d61da4bd9a17', 'docs/artifacts/night-adapt/ADAPT2-Q-s7.js', 'hard', '1', 'block', '-1', now,
  '11-08 晚用户点名进硬带（「ADAPT-2 反倒可以进硬带」，invited 越门槛）‖ 门禁双桌各缺 1 同型门：场A 还手 13.9%/16.6%（线 20%）‖ promote 体检 5 阻断（还+G4×2+G5×2：防席夺冠 96-99% = 打不动纯防御对手）‖ exam-fb：场B 0.00/局、对农民桌 5%（**农民盲**——X̄₄ 含刷分水分，清场不可宣称）‖ 定位=2p 专精：P2=0.606 全图最强（N2/3/5/8=0.606/0.456/0.280/0.194）‖ Δε 短+0.018/长+0.103（未到头）‖ 源=夜班 ADAPT2 课程+credit 臂 META.ts=' + ts + ' seed=' + seed]);
writeFileSync(PF, out.map(r => r.join('\t')).join('\n') + '\n');
const tiers = out.slice(1).map(r => r[ph.tier]);
console.log('池册更新：踢 ' + nKick + ' / 降 ' + nDemo + ' / 进 ADAPT2-Q-s7 ⇒ 成员 ' + out.length - 1 + '（hard ' + tiers.filter(x => x === 'hard').length + ' / soft ' + tiers.filter(x => x === 'soft').length + '）（备份 ' + PF + '.bak-pool2）');
