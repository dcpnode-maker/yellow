// Local design preview only. Fixed file allowlist; no repository or credential exposure.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(option('--port', '4173'));
const host = option('--host', '127.0.0.1');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/workbench.css', ['workbench.css', 'text/css; charset=utf-8']],
  ['/workbench.js', ['workbench.js', 'text/javascript; charset=utf-8']],
  ['/compare.html', ['compare.html', 'text/html; charset=utf-8']],
  ['/compare.css', ['compare.css', 'text/css; charset=utf-8']],
  ['/compare-core.js', ['compare-core.js', 'text/javascript; charset=utf-8']],
  ['/compare.js', ['compare.js', 'text/javascript; charset=utf-8']],
]);
// Fixed, same-origin design assets; never serve arbitrary repository paths.
for (const name of ['guest-mira', 'staff-aditi']) files.set(`/assets/${name}.png`, [`assets/${name}.png`, 'image/png']);
files.set('/assets/Urbanist.ttf', ['assets/Urbanist.ttf', 'font/ttf']);
for (const name of ['arrow-up-right', 'bell', 'briefcase', 'broom', 'calendar-blank', 'chart-line-up', 'clock', 'confetti', 'cooking-pot', 'flower-lotus', 'fork-knife', 'handshake', 'house-line', 'identification-card', 'magnifying-glass']) {
  files.set(`/assets/${name}.svg`, [`assets/${name}.svg`, 'image/svg+xml']);
}
const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://preview.invalid').pathname;
  const file = files.get(path);
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(fileURLToPath(new URL(file[0], import.meta.url)));
    response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' blob: data:; font-src 'self'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'" });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500); response.end('Preview file unavailable'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Yellow design preview listening on port ${port}`));
