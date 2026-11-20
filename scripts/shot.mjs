// Real-time screenshot via Chrome DevTools Protocol (game logic actually runs, unlike --virtual-time-budget).
// Usage: node scripts/shot.mjs "<url>" <wait-seconds> <out.png>   (GPU on; set CHROME_FLAGS to override)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [url, wait = '5', out = 'shot.png'] = process.argv.slice(2);
const port = 9600 + (process.pid % 300);
const flags = (process.env.CHROME_FLAGS ?? '--enable-gpu --use-angle=gl').split(' ').filter(Boolean);
const proc = spawn(process.env.CHROME || 'google-chrome-stable', ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,720', '--no-first-run', `--user-data-dir=/tmp/ddl-shot-${process.pid}`, ...flags, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => proc.kill());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; for (let i = 0; i < 50 && !ws; i++) { try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page').webSocketDebuggerUrl; } catch { await sleep(200); } }
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
let id = 0; const pend = new Map();
sock.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url });
await sleep(Number(wait) * 1000);
writeFileSync(out, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
console.log(out); sock.close(); process.exit(0);
