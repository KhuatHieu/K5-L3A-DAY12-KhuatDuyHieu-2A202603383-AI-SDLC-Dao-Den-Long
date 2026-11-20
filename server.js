// Zero-dependency static server + local leaderboard API.
//   node server.js                               → serve the game on http://localhost:5173 (PORT env to change)
//   node server.js --export-leaderboard out.json → write {"entries": [...]} (sorted, top 10) and exit
// Leaderboard file: $DDL_DATA_DIR/leaderboard.json (default ./data/leaderboard.json, survives restarts).
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as LB from './src/leaderboard.js';

const ROOT = new URL('.', import.meta.url).pathname;
const DATA = join(process.env.DDL_DATA_DIR || join(ROOT, 'data'), 'leaderboard.json');

const ei = process.argv.indexOf('--export-leaderboard');
if (ei !== -1) {
  const out = process.argv[ei + 1];
  if (!out) { process.stderr.write('usage: node server.js --export-leaderboard out.json\n'); process.exit(1); }
  writeFileSync(out, JSON.stringify({ entries: LB.load(DATA) }, null, 2) + '\n');
  process.exit(0);
}

const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const ALLOWED = ['web/', 'src/', 'node_modules/three/build/', 'game.contract.json'];
const json = (res, code, body) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') return json(res, 200, { entries: LB.load(DATA) });
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let x; try { x = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
        const v = LB.validateEntry({ ...x, achieved_at: undefined }); // server stamps the time
        if (v.error) return json(res, 400, v);
        const r = LB.addEntry(LB.load(DATA), v.entry);
        LB.save(DATA, r.entries);
        json(res, 200, r);
      });
      return;
    }
    return json(res, 405, { error: 'method' });
  }
  let p = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (p === '') p = 'web/index.html';
  p = normalize(p);
  if (!ALLOWED.some((a) => p.startsWith(a))) { res.writeHead(404).end('not found'); return; }
  try {
    const data = await readFileP(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: open http://localhost:${PORT}`));
