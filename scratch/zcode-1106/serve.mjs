/* 临时静态测试服务（带 mime map——昨晚的教训：无 mime ⇒ css 不生效 ⇒ 截图全黑）。
 * 用法：node scratch/zcode-1106/serve.mjs [port]（默认 18322） */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.argv[2] || 18322);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.tsv': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.bak': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};
createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(ROOT, p);
  if (!existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(PORT, () => console.log('serving ' + ROOT + ' at http://127.0.0.1:' + PORT));
