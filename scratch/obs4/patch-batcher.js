/* exam-4n-full.mjs 两处修（11-10 深夜）：--exam=B 全图扫出 0 行的静默事故
 * ① 解析只认 `[冠军4N] ` ⇒ --exam=B 印的是 `[冠军4N-B] ` ⇒ 907 枚全败、退出码 0、&& 链把第二批也跑了
 * ② 批尾没有"全败必红"守卫 ⇒ 那次事故以"完成 907/失败 907"的绿脸收场（feas.mjs 的同类守卫这里缺一份）
 */
const fs = require('fs');
const F = 'tools/exam-4n-full.mjs';
let s = fs.readFileSync(F, 'utf8');

if (!/\[冠军4N\(?:-B\)\?\]/.test(s)) {
  const a1 = /const m = String\(so\)\.match\(/;
  if (!s.includes("const m = String(so).match(/\\[冠军4N\\] (.*)/);")) { console.error('锚1'); process.exit(2); }
  s = s.replace("const m = String(so).match(/\\[冠军4N\\] (.*)/);",
    "/* v2.0.6（11-10）：--exam=B 时子进程印的是 `[冠军4N-B] ` ⇒ 旧正则解析 0 行还 exit 0（全图 B 扫因此出过两张空表）。\n     *   收宽到 -B；--exam=both 时第一条命中的是 A 行（默认行为不变）。 */\n        const m = String(so).match(/\\[冠军4N(?:-B)?\\] (.*)/);");
}

if (!/全败必红/.test(s)) {
  const a2 = /  console\.error\('完成 ' \+ done \+ ' \/ 失败 ' \+ fail \+ '[^]*?⇒ ' \+ OUT\);/;
  if (!a2.test(s)) { console.error('锚2'); process.exit(2); }
  s = s.replace(a2, (m0) => m0 + "\n  /* 全败必红（11-10 补）：907 枚全败 = 解析器/旗标错，不是'没数据'——不许 exit 0 让 && 链把下一批也跑了 */\n  if (done > 0 && fail === done) { console.error('⛔ 全败（' + fail + '/' + done + '）⇒ 解析器或旗标错，响亮失败'); process.exit(1); }");
}

/* 表头/行加 exam 列（A/B 两表同 schema 的事故预防）：找 header 写点 */
if (!/exam.*(表头)|表头.*exam/.test(s) && !/EXAM_COL/.test(s)) {
  const hi = s.indexOf("appendFileSync(OUT");
  const hLine = s.match(/const HEAD = [^\n]+|appendFileSync\(OUT, \[([^\]]+)\]/);
  if (!hLine) { console.error('锚3（表头写点没认出）——跳过 exam 列，只修前两处'); }
}
fs.writeFileSync(F, s);
console.log('①② 完成');
