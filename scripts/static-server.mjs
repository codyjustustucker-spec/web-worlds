import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.argv[2] || '4173', 10);
const types = new Map([
  ['.html','text/html; charset=utf-8'], ['.js','text/javascript; charset=utf-8'], ['.mjs','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'], ['.json','application/json; charset=utf-8'], ['.svg','image/svg+xml'],
  ['.txt','text/plain; charset=utf-8'], ['.xml','application/xml; charset=utf-8']
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

async function resolveFile(requestPath) {
  let target = safePath(requestPath);
  if (!target) return null;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    return target;
  } catch {
    if (!path.extname(target)) {
      const candidate = path.join(target, 'index.html');
      try { await stat(candidate); return candidate; } catch { return null; }
    }
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const target = await resolveFile(req.url || '/');
  if (!target) {
    try {
      const body = await readFile(path.join(root, '404.html'));
      res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('Not found');
    }
    return;
  }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types.get(path.extname(target).toLowerCase()) || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('Server error');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Web Worlds QA server: http://127.0.0.1:${port}`));
