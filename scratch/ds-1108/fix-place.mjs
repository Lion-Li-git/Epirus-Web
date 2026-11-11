
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'tools/train-3p.mjs';
let t = readFileSync(P, 'utf8');
const startMark = '/* ===== \`EPIRUS_PASSIVE_OPPS=<k>\`';
const endMark = '\n}\n}\n\n/* ===== v1.6.60';
const i0 = t.indexOf(startMark);
const i1 = t.indexOf(endMark);
if (i0 < 0 || i1 < 0) { console.error('markers not found', i0, i1); process.exit(2); }
const block = t.slice(i0, i1);          // 块本体（不含外层收尾）
const head = t.slice(0, i0);            // 到块前的部分（含 toolkit console.log 行与空行）
const tail = t.slice(i1);               // 从 "\n}\n}\n\n/* v1.6.60" 开始
/* 目标：外层 if 先收尾（"}\n"），再放块。head 末尾是 "...预注册）');\n\n"，把它整理成 "...预注册）');\n}\n\n" + block + "\n" */
let head2 = head.replace(/\n*$/, '\n') + '}\n\n' + block.replace(/\n*$/, '\n') + '\n';
const tail2 = tail.replace(/^\n}\n}\n/, '\n');
writeFileSync(P, head2 + tail2);
console.log('moved; new length', (head2 + tail2).length);
