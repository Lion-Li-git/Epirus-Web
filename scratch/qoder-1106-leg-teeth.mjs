/* 11-06 午后 · R4 第③步「咬牙」：给今天换过主语的四条页内判据各造一个"它该抓的东西"，
 *   确认改完主语之后它们不是变成永远绿。每个变异都自证落地（锚点必须命中恰好一次，否则 exit 2）。
 *   变异只作用在页面副本上（scratch/mut-*.html），在册产物一字不动。
 * 跑法：node scratch/qoder-1106-leg-teeth.mjs            （建四份副本 + 各跑一次 mode=map 自检）
 *       期望：四份都让"自己那条腿"翻红，且红的那条腿名字就是被测的那条。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const P = 'champion-map/index.html';
const src = readFileSync(P, 'utf8');
const head = 'var DATA =', i0 = src.indexOf(head), i1 = src.indexOf(';', i0);
const DATA = JSON.parse(src.slice(i0 + head.length, i1).trim());
const wrap = (arr) => src.slice(0, i0 + head.length) + JSON.stringify(arr) + src.slice(i1);
function once(s, needle) { const n = s.split(needle).length - 1; if (n !== 1) { console.error('⛔ 锚点命中 ' + n + ' 次（要恰好 1 次）：' + needle.slice(0, 60)); process.exit(2); } }
const muts = [];

/* ① 批次过滤（本批次内冠军一枚不许少）：把一枚 ver=2.0 的臂产物冠军从可见集里抠掉 */
{ const s2 = src.replace('VIS[i] = keep ? 1 : 0', 'VIS[i] = (keep && !(P[i] && P[i].id === "BAS-s41")) ? 1 : 0');
  once(s2, 'BAS-s41")) ? 1 : 0'); muts.push(['batch', s2, '批次过滤：本批次内的冠军永远保留']); }

/* ② 历代上槽无上线时刻 ≤4：给 5 枚声称上过槽的行抹掉 sh */
{ const a = JSON.parse(JSON.stringify(DATA)); const ids = ['eco-34', 'eco-34-v7', 'Ldemo', 'long-33', 'T8-s114'];
  let n = 0; for (const x of a) if (ids.indexOf(x.id) >= 0 && x.lin === '历代上槽' && x.sh) { x.sh = ''; n++; }
  if (n !== 5) { console.error('⛔ 只抹到 ' + n + ' 枚的 sh（要 5）⇒ 变异没落地'); process.exit(2); }
  muts.push(['unship', wrap(a), '冠军序列：声称上过槽']); }

/* ③ 谱系图落格：让一枚**有时刻**的点拿不到位置 */
{ const s2 = src.replace('function PT(i) {', 'function PT(i) { if (P[i].id === "eco-34") return null;');
  once(s2, 'if (P[i].id === "eco-34") return null;'); muts.push(['tree', s2, '谱系图：旧包没有 lineage 行也要真被画出来']); }

/* ④ 标签拥挤：把**判据读的那份矩形表**（LAB，由 noteLab 落笔）横向放大三倍。
 *   ⚠ 第一版这里挑错了锚：改的是 boxes（避让用的那份），实测 99 PASS 纹丝不动 ——
 *     这与判据自己注释里那条老记录同一件事（"把 putLabel 的避让拆掉两处，这两个数一模一样没动"）。
 *     所以牙要咬在 LAB 那份上，boxes 那一份归另一条判据（矩形重叠，只报不判）。 */
{ const s2 = src.replace('LAB.push([bx, top, bw, bh, idx])', 'LAB.push([bx, top, bw * 3, bh, idx])');
  once(s2, 'LAB.push([bx, top, bw * 3, bh, idx])'); muts.push(['label', s2, '标签：默认视图里被别人的名字压住的点']); }

const out = [];
for (const [name, text, leg] of muts) {
  const f = 'scratch/mut-' + name + '.html';
  writeFileSync(f, text);
  const r = spawnSync(process.execPath, ['champion-map/shot.mjs', '--html=' + f, '--hash=mode=map&check=1&detail=1', '--dump'],
    { encoding: 'utf8', timeout: 180000 });
  const dump = String(r.stdout || '') + String(r.stderr || '');
  const line = (dump.match(/断言：\d+ PASS[^\n]*/) || ['（没抓到断言行）'])[0];
  const hit = dump.split('\n').filter(l => l.indexOf('FAIL ' + leg) === 0);
  const other = dump.split('\n').filter(l => /^FAIL /.test(l) && l.indexOf('FAIL ' + leg) !== 0);
  out.push(name.padEnd(7) + ' exit=' + r.status + ' ‖ ' + line + ' ‖ 目标腿翻红=' + (hit.length ? '是' : '**否**')
    + ' ‖ 顺带红别的腿 ' + other.length + ' 条' + (hit[0] ? ' ‖ ' + hit[0].slice(5, 190) : ''));
}
console.log(out.join('\n'));
