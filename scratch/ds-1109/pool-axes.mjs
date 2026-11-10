
import { EXAM_POOL } from '../../server/opp-pool.mjs';
const by = {};
for (const e of EXAM_POOL) (by[e.axis] = by[e.axis] || []).push(e.name);
for (const k of Object.keys(by)) console.log(k.padEnd(10) + by[k].length + ' 席：' + by[k].join(' '));
console.log('总 ' + EXAM_POOL.length);
