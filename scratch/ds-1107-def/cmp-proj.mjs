
import { execSync } from 'node:child_process';
const old = execSync('git show c7a3656c:champion-map/coords-gen3-1105.tsv', { encoding: 'utf8' }).replace(/\r\n/g, '\n').split('\n');
const H = old[0].split('\t');
const h = Object.fromEntries(H.map((x, i) => [x, i]));
const row = old.find(l => l.startsWith('CTRL2-Q-s7\t'));
const c = row.split('\t');
console.log('旧 xt=' + c[h.xt] + ' yt=' + c[h.yt]);
const cur = execSync('git show HEAD:champion-map/coords-gen3-1105.tsv', { encoding: 'utf8' }).replace(/\r\n/g, '\n').split('\n');
const c2 = cur.find(l => l.startsWith('CTRL2-Q-s7\t')).split('\t');
console.log('新 xt=' + c2[h.xt] + ' yt=' + c2[h.yt]);
/* Q-s47 对比 */
const q1 = old.find(l => l.startsWith('Q-s47\t')).split('\t');
const q2 = cur.find(l => l.startsWith('Q-s47\t')).split('\t');
console.log('Q-s47 旧 xt=' + q1[h.xt] + ' 新 xt=' + q2[h.xt]);
