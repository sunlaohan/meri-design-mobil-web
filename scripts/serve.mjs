import http from 'node:http';
import { createReadStream, watch } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { build, root } from './build.mjs';

const production = process.argv.includes('--production');
if (!production) await build();
const directory = path.join(root, 'dist');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const url = new URL(request.url, 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    let file = path.resolve(directory, `.${decoded}`);
    if (file !== directory && !file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
    let info;
    try {
      info = await stat(file);
      if (info.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file); }
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(await readFile(path.join(directory, '404.html')));
      return;
    }
    const isVideo = file.includes(`${path.sep}_videos${path.sep}`);
    const contentType = isVideo ? 'video/mp4' : mime[path.extname(file)] || 'application/octet-stream';
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    const match = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    let start = 0, end = info.size - 1;
    if (match) {
      if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
      else if (match[2]) start = Math.max(0, info.size - Number(match[2]));
      if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(match ? 206 : 200, headers);
    if (request.method === 'HEAD') response.end();
    else createReadStream(file, { start, end }).pipe(response);
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) response.writeHead(500);
    response.end('Local server error');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Meri Design Mobile\nLocal: http://localhost:${port}`));

if (process.argv.includes('--watch')) {
  let timer, pending = false, rebuilding = false;
  async function rebuild() {
    if (rebuilding) { pending = true; return; }
    rebuilding = true;
    try { await build({ clean: false }); console.log('Updated. Refresh the browser to see your changes.'); }
    catch (error) { console.error('Build failed:', error.message); }
    finally { rebuilding = false; if (pending) { pending = false; await rebuild(); } }
  }
  watch(path.join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 180);
  });
}

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
