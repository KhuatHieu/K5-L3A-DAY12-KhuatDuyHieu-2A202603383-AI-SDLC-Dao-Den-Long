// Tiny zero-dependency static server for the browser build.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const ALLOWED = ['web/', 'src/', 'node_modules/three/build/', 'game.contract.json'];

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (p === '') p = 'web/index.html';
  p = normalize(p);
  if (!ALLOWED.some((a) => p.startsWith(a))) { res.writeHead(404).end('not found'); return; }
  try {
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: open http://localhost:${PORT}`));
