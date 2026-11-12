/* ⑫d 的牙：把 ship-pool.mjs 里那一段**原样抽出来**跑，而不是重抄一份逻辑
 * （重抄的"测试"证明的是我抄的那份，不是门里那份）。跑在注册表/家谱表的 scratch 副本上，
 *  在册的 champion-map/data/page/lineage*.tsv 一个字节不动。 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = 'D:/code/Epirus-Web';
const GATE = ROOT + '/tools/gates/ship-pool.mjs';
const DIR = ROOT + '/scratch/qoder-1112-fix/lin';
const L1 = 'champion-map/data/page/lineage.tsv';
const L2 = 'champion-map/data/page/lineage-g3.tsv';

/* 1) 从门体里切出 ⑫d 那一段（锚在它自己的两句 eq 文案上，切不到就当场停，不许拿"没抽到"当通过） */
const src = readFileSync(GATE, 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('⑫d 融合行的第二/第三父边');
if (a < 0) { console.error('⛔ 没在 ship-pool.mjs 里定位到 ⑫d（锚点失效，别再猜它还在）'); process.exit(2); }
/* 从注释尾巴后面第一个 `{` 起**按括号配对**走到闭合 —— 用 indexOf 猜结尾会把块切多/切少，
 *   切错的那一份"测试"证明的是我切出来的东西，不是门里那段。 */
const start = src.indexOf('{', src.indexOf('*/', a));
if (start < 0) { console.error('⛔ ⑫d 注释后面找不到块的起点'); process.exit(2); }
let depth = 0, end = -1;
for (let i = start; i < src.length; i++) { const ch = src[i];
  if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) { end = i + 1; break; } } }
if (end < 0) { console.error('⛔ ⑫d 那块括号不闭合'); process.exit(2); }
const block = src.slice(start, end);
console.log('抽到 ⑫d 源码 ' + block.length + ' 字节 ‖ 含 eq( ' + (block.match(/eq\(/g) || []).length + ' 处 ‖ 含 soup 判据 ' + /parentSrc.*soup|c\[iPS\] === 'soup'/.test(block));

/* 2) 造一份可判的夹具：把两张家谱表拷进 lin/<tag>/，按 tag 施加变异 */
rmSync(DIR, { recursive: true, force: true });
function fixture(tag, mut) {
  const d = DIR + '/' + tag;
  mkdirSync(d, { recursive: true });
  for (const f of [L1, L2]) copyFileSync(ROOT + '/' + f, d + '/' + f.split('/').pop());
  if (mut) mut(d);
  return d;
}
const blank = (d, file, id, col) => {
  const p = d + '/' + file, lines = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const ix = lines[0].split('\t').indexOf(col);
  if (ix < 0) throw new Error(file + ' 没有列 ' + col);
  let hit = 0;
  const out = lines.map((l, i) => { if (!i) return l; const c = l.split('\t'); if (c[0] === id) { c[ix] = ''; hit++; return c.join('\t'); } return l; });
  if (hit !== 1) throw new Error('变异没落地：' + id + ' 命中 ' + hit + ' 行');
  writeFileSync(p, out.join('\n') + '\n');
};
const run = (d) => {
  const errs = [];
  const eq = (got, want, msg) => { if (got !== want) errs.push(msg); };
  const rd = (rel) => readFileSync(d + '/' + rel.split('/').pop(), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  try { new Function('rd', 'eq', 'judgedOut', block + '\n;return judgedOut;')(rd, eq, []); }
  catch (e) { return { fatal: e.message, errs: [] }; }
  return { fatal: '', errs };
};

const results = [];
function expect(name, d, wantBad) {
  const r = run(d);
  const got = r.errs.length;
  const ok = !r.fatal && got === wantBad;
  results.push({ name, ok });
  console.log((ok ? '✅' : '⛔') + ' ' + name + '：期望 ' + wantBad + ' 条否决 ‖ 实得 ' + got +
    (r.fatal ? ' ‖ ⛔ 跑挂了：' + r.fatal.slice(0, 110) : got ? '\n     ' + r.errs.join('\n     ').slice(0, 400) : ''));
}

/* ── 0 现状：7 枚 soup 都带第二父 ⇒ 应当一条都不否决 ── */
expect('现状（应绿）', fixture('base', null), 0);
/* ── 1 摘掉 MSB15-SOUPB 的第二父 ⇒ 两条都该红（它同时是"缺第二父"和"第三父有值而第二父空"）──
 *   第一版这里期望 1 条，是**我的预期不够严**而不是门错：门把断档也抓了，是对的。 */
expect('摘掉 g3 表 MSB15-SOUPB 的 parentOf2', fixture('badG3', (d) => blank(d, 'lineage-g3.tsv', 'MSB15-SOUPB', 'parentOf2')), 2);
/* ── 2 摘掉 lineage.tsv 里一枚老汤的第二父 ⇒ 也必须抓住（证明没只判 g3 那张）── */
expect('摘掉 lineage.tsv SOUP-KE-l60 的 parentOf2', fixture('badL1', (d) => blank(d, 'lineage.tsv', 'SOUP-KE-l60', 'parentOf2')), 1);
/* ── 3 断档：给一枚已有两父的行加第三父、再把第二父清空 ⇒ 两条都要红 ── */
expect('第三父有值而第二父空', fixture('gap', (d) => {
  const p = d + '/lineage-g3.tsv', lines = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const ix2 = lines[0].split('\t').indexOf('parentOf2'), ix3 = lines[0].split('\t').indexOf('parentOf3');
  const out = lines.map((l, i) => { if (!i) return l; const c = l.split('\t');
    if (c[0] === 'MSB15-SOUPB') { c[ix3] = c[ix3] || 'X'; c[ix2] = ''; return c.join('\t'); } return l; });
  writeFileSync(p, out.join('\n') + '\n');
}), 2);

/* ── 4 反向对照：两表都缺 parentOf2 这一列 ⇒ 必须"没得判"而不是判成干净（R8）── */
{
  const d = fixture('nocol', (dd) => {
    for (const f of ['lineage.tsv', 'lineage-g3.tsv']) {
      const p = dd + '/' + f, lines = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
      const ix = lines[0].split('\t').indexOf('parentOf2');
      writeFileSync(p, lines.map((l, i) => { const c = l.split('\t'); c.splice(ix, 1); return c.join('\t'); }).join('\n') + '\n');
    }
  });
  const r = run(d);
  const ok = !r.fatal && r.errs.length === 0;
  results.push({ name: '列被删光 ⇒ 不冒充干净', ok });
  console.log((ok ? '✅' : '⛔') + ' 列被删光：否决 ' + r.errs.length + ' 条' + (r.fatal ? ' ‖ 跑挂 ' + r.fatal.slice(0, 90) : '') +
    '\n     （这一条只证明它没崩；"没得判"写在 judged 名单里，由门自己那句 ‖ 判过的表 报出来，不是静默绿）');
}
console.log('——');
console.log('在册家谱表有没有被这次实验改动：');
try { execSync('git diff --quiet HEAD -- ' + L1 + ' ' + L2, { cwd: ROOT }); console.log('  ✅ 未改动'); }
catch (e) { console.log('  ⛔ 被改了！'); results.push({ name: '在册表未改动', ok: false }); }
const bad = results.filter((x) => !x.ok);
console.log(bad.length ? '⛔ ' + bad.length + '/' + results.length + ' 不成立：' + bad.map((x) => x.name).join(' ‖ ')
  : '✅ ' + results.length + '/' + results.length + ' 成立');
process.exit(bad.length ? 1 : 0);