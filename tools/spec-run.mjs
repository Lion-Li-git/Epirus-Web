/* Node 桩运行引擎自测（tests/spec.js 原本只跑在浏览器里） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
let OUT = '';
sb.document = {
  getElementById: function () {
    return { set innerHTML(v) { OUT = v; }, get innerHTML() { return OUT; }, textContent: '' };
  },
  createElement: function () { return { style: {}, appendChild() {} }; }
};
const files = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'tests/spec.js'];
for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const m = OUT.match(/通过 (\d+) \/ (\d+)/);
console.log('spec: ' + (m ? m[0] : 'NO OUTPUT'));
const fails = [...OUT.matchAll(/<li class="fail">✘ ([^<]+)/g)].map(function (x) { return x[1]; });
if (fails.length) { console.log('FAILS (' + fails.length + '):'); for (const f of fails) console.log('  - ' + f); }
process.exit(fails.length ? 1 : 0);
