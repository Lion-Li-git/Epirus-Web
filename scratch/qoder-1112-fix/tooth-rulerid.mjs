/* 主尺身份单源化这条改动的正反向实验（gate-audit R4 三步：旧行为复现 / 新绿 / 咬牙）。
 * 全部在 scratch 的注册表副本上做，champion-map/data/** 一个字节不动（那是三个班共用的表）。 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = 'D:/code/Epirus-Web';
const SRC = ROOT + '/champion-map/data';
const DIR = ROOT + '/scratch/qoder-1112-fix';
const TOOL = ROOT + '/champion-map/viewer.mjs';
const FIT = 'data/build/coords-view.tsv';
rmSync(DIR + '/dd', { recursive: true, force: true });

function dd(tag, mut) {                    // 造一份只改注册表的 data 副本
  const d = DIR + '/dd-' + tag;
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  for (const f of ['rulers.tsv', 'batches.tsv']) copyFileSync(SRC + '/' + f, d + '/' + f);
  if (mut) mut(d);
  return d;
}
function bake(d, out) {
  try {
    const o = execFileSync(process.execPath, [TOOL, '--fit=' + FIT, '--preset=all', '--projcols=1', '--verpages=0',
      '--datadir=' + d, '--out=' + out], { cwd: ROOT + '/champion-map', encoding: 'utf8' });
    return { code: 0, out: o };
  } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}
const rows = [];
function judge(name, want, got, detail) { rows.push({ name, ok: want === got }); console.log((want === got ? '✅' : '⛔') + ' ' + name + '：期望 ' + want + ' ‖ 实得 ' + got + (detail ? ' ‖ ' + detail : '')); }

/* ── 0 控制组：现状必须绿，而且页面上那串名字真的来自注册表 ── */
const d0 = dd('base', null);
const r0 = bake(d0, DIR + '/index.html');
judge('控制组（照册出图）', 0, r0.code);
const html0 = readFileSync(DIR + '/index.html', 'utf8');
const lab = /B=([^（）]*)（([^（）]*)）/.exec(html0) || [];
console.log('   页面尺说明里的 B 段：' + JSON.stringify(lab[1]) + ' 夹具 ' + JSON.stringify(lab[2]));

/* ── 1 真·F3k2 场景：换 B 轴尺 ⇒ 页面出处必须跟着换（这才是这次改动要买到的东西）── */
const d1 = dd('f3k2', (d) => {
  let t = readFileSync(d + '/batches.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const lines = t.split('\n'), ix = Object.fromEntries(lines[0].split('\t').map((x, i) => [x, i]));
  lines.push(['b-f3k2-1112', 'b-f3k2-page-1112', 'B', 'MSB13+MSB11+MSB8-charge+KDG-B',
    'MSB13-R1S791820660+MSB11-R2S306293884+MSB8-charge-R1S1861674281+KDG-B-Q-s13', 'f3k2', 'scratch/f3k2-30.tsv', '30', 'x', '变异夹具'].join('\t'));
  writeFileSync(d + '/batches.tsv', lines.join('\n') + '\n');
  let u = readFileSync(d + '/rulers.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const hi = Object.fromEntries(u[0].split('\t').map((x, i) => [x, i]));
  u = u.map((l, i) => { if (!i) return l; const c = l.split('\t');
    if (c[hi.axis] === 'B' && c[hi.status] === 'current') c[hi.status] = 'reference';
    return c.join('\t'); });
  u.push(['b-f3k2-page-1112', 'B', 'F3k2 冠军夹具（page dose）', 'current', 'excess', 'MSB13+MSB11+MSB8-charge+KDG-B',
    'b-f3k2-1112', '(A+B)/2 的 B 侧', '变异尺'].join('\t'));
  writeFileSync(d + '/rulers.tsv', u.join('\n') + '\n');
});
const r1 = bake(d1, DIR + '/index-f3k2.html');
judge('换尺后仍出图（标签派生而不是写死）', 0, r1.code);
const html1 = readFileSync(DIR + '/index-f3k2.html', 'utf8');
const moved = html1.indexOf('F3k2 冠军夹具') >= 0 && html1.indexOf('MSB13+MSB11+MSB8-charge+KDG-B') >= 0;
const stale = html1.indexOf('MSB11-R2S306293884,MSB10-R1S1149480262,MSB8-charge-R1S1861674281,Q-s47') >= 0;
rows.push({ name: '换尺后页面出处跟着换', ok: moved && !stale });
console.log((moved && !stale ? '✅' : '⛔') + ' 换尺后页面出处跟着换：新名命中 ' + moved + ' ‖ 旧 F2 的 --champ 串还在 ' + stale);

/* ── 2 咬牙①：B 轴没有 current ⇒ 必须拒绝出图 ── */
const d2 = dd('noB', (d) => {
  const u = readFileSync(d + '/rulers.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const hi = Object.fromEntries(u[0].split('\t').map((x, i) => [x, i]));
  writeFileSync(d + '/rulers.tsv', u.map((l, i) => { if (!i) return l; const c = l.split('\t');
    if (c[hi.axis] === 'B' && c[hi.status] === 'current') c[hi.status] = 'reference'; return c.join('\t'); }).join('\n') + '\n');
});
const r2 = bake(d2, DIR + '/index-noB.html');
judge('B 轴无 current ⇒ 拒绝出图', 2, r2.code, (r2.out.match(/主尺身份核不出来[^\n]*/) || ['⚠ 没报原因'])[0]);

/* ── 3 咬牙②：champ 空 ⇒ 必须拒绝（报不出夹具是谁就不该印出处）── */
const d3 = dd('nochamp', (d) => {
  const lines = readFileSync(d + '/batches.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const ix = Object.fromEntries(lines[0].split('\t').map((x, i) => [x, i]));
  writeFileSync(d + '/batches.tsv', lines.map((l, i) => { if (!i) return l; const c = l.split('\t');
    if (c[ix.batch_id] === 'b-f2-1111') c[ix.champ] = ''; return c.join('\t'); }).join('\n') + '\n');
});
const r3 = bake(d3, DIR + '/index-noc.html');
judge('champ 空 ⇒ 拒绝出图', 2, r3.code, (r3.out.match(/主尺身份核不出来[^\n]*/) || ['⚠ 没报原因'])[0]);

/* ── 4 咬牙③：冒出个代码不认识的 C 族 ⇒ 必须拒绝，而不是拿旧文案继续印 ── */
const d4 = dd('newC', (d) => {
  const u = readFileSync(d + '/rulers.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const hi = Object.fromEntries(u[0].split('\t').map((x, i) => [x, i]));
  const out = u.map((l, i) => { if (!i) return l; const c = l.split('\t');
    if (c[hi.axis] === 'C' && c[hi.status] === 'current') c[hi.status] = 'reference'; return c.join('\t'); });
  out.push(['c-pb3', 'C', 'PB3 新列族综合分', 'current', 'excess', '-', 'b-f2-1111', '(A+B3)/2', '变异新族'].join('\t'));
  writeFileSync(d + '/rulers.tsv', out.join('\n') + '\n');
});
const r4 = bake(d4, DIR + '/index-newC.html');
judge('不认识的当前 C 族 ⇒ 拒绝出图', 2, r4.code, (r4.out.match(/主尺身份核不出来[^\n]*/) || ['⚠ 没报原因'])[0]);

/* ── 5 在册 data 没被碰过 ── */
const dirty = ['rulers.tsv', 'batches.tsv'].filter((f) => {
  try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'champion-map/data/' + f], { cwd: ROOT }); return false; }
  catch (e) { return true; }
});
rows.push({ name: '在册注册表未改动', ok: dirty.length === 0 });
console.log((dirty.length ? '⛔' : '✅') + ' 在册注册表未改动' + (dirty.length ? '：' + dirty.join(',') : ''));

console.log('——');
const bad = rows.filter((x) => !x.ok);
console.log(bad.length ? '⛔ ' + bad.length + '/' + rows.length + ' 不成立：' + bad.map((x) => x.name).join(' ‖ ')
  : '✅ ' + rows.length + '/' + rows.length + ' 成立（含 3 条该红的变异 + 1 条换尺正向）');
process.exit(bad.length ? 1 : 0);