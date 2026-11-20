// Measure average FPS of the real browser build at 1280x720 via Chrome DevTools Protocol (no deps).
// Usage: node scripts/fps.mjs [night=1] [seconds=15]   (needs `npm start` running on PORT, default 5173)
import { spawn } from 'node:child_process';
const night = process.argv[2] || '1', secs = Number(process.argv[3] || 15), port = process.env.PORT || 5173;
const chrome = process.env.CHROME || 'google-chrome-stable';
const extra = (process.env.CHROME_FLAGS ?? '--enable-gpu --use-angle=gl').split(' ').filter(Boolean);
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', '--window-size=1280,720', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--user-data-dir=/tmp/ddl-fps-${process.pid}`, ...extra, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => proc.kill());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) { try { const t = await (await fetch('http://127.0.0.1:9333/json')).json(); ws = t.find((x) => x.type === 'page').webSocketDebuggerUrl; } catch { await sleep(200); } }
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
let id = 0; const pend = new Map();
sock.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: `http://localhost:${port}/?night=${night}` });
await sleep(secs * 1000 + 2000);
const fps = await ev('window.__fps');
if (!Array.isArray(fps) || fps.length < 2) { console.error('no FPS samples (page failed to load?)'); process.exit(1); }
const gpu = await ev(`(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
const s = fps.slice(1); // drop first (warm-up) second
const avg = s.reduce((a, b) => a + b, 0) / s.length;
console.log(JSON.stringify({ night: Number(night), seconds: s.length, avg_fps: Number(avg.toFixed(1)), min_fps: Number(Math.min(...s).toFixed(1)), renderer: gpu, size: '1280x720' }));
sock.close(); proc.kill();
