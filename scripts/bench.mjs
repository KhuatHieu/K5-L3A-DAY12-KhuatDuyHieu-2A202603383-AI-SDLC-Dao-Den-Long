#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Starts the static server, opens a real Chrome window (1280×720 viewport, vsync off), loads ?bench, measures
// rAF frame times after a 3 s warm-up, samples Chrome process-tree RSS, writes bench.json, exits 0.
// Env: CHROME=<path> (browser binary), BENCH_HEADLESS=1 (no window, for CI only — not representative).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, type, release, arch, cpus, platform } from 'node:os';
import { join } from 'node:path';

const processStartEpoch = Date.now() - process.uptime() * 1000;
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const seed = parseInt(args.seed ?? '42', 10), duration = Number(args.duration ?? '30'), out = args.out ?? 'bench.json';
const ROOT = new URL('..', import.meta.url).pathname;
const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { process.stderr.write(`bench: ${m}\n`); cleanup(); process.exit(1); };

function findChrome() {
  const c = [process.env.CHROME, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean);
  for (const x of c) {
    if (x.startsWith('/')) { if (existsSync(x)) return x; continue; }
    try { return execFileSync('which', [x], { encoding: 'utf8' }).trim(); } catch {}
  }
  return null;
}
const port = 5200 + (process.pid % 500), cdpPort = 9400 + (process.pid % 500);
const server = spawn(process.execPath, [join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
let chrome = null;
function cleanup() { try { chrome?.kill(); } catch {} try { server.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} }
process.on('exit', cleanup);

const bin = findChrome() || fail('Chrome/Chromium not found (set CHROME=/path/to/chrome)');
const flags = [`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,720', '--window-position=40,40', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--new-window'];
if (process.env.BENCH_HEADLESS) flags.push('--headless=new');
chrome = spawn(bin, [...flags, 'about:blank'], { stdio: 'ignore' });

let ws;
for (let i = 0; i < 100 && !ws; i++) { try { const t = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); ws = t.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!ws) await sleep(100); }
if (!ws) fail('could not connect to Chrome DevTools');
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
let id = 0; const pend = new Map();
sock.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') process.stderr.write(`page error: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}\n`);
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/game.contract.json`); break; } catch { await sleep(100); } }
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); // exact 1280×720 viewport
await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/?bench&seed=${seed}&duration=${duration}` });

// RSS of the whole Chrome process tree (browser + GPU + renderer), sampled during the run
function treeRssMb() {
  try {
    const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const kids = new Map(); for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
    const rss = new Map(rows.map(([p, , r]) => [p, r]));
    let sum = 0; const st = [chrome.pid];
    while (st.length) { const p = st.pop(); sum += rss.get(p) || 0; for (const k of kids.get(p) || []) st.push(k); }
    return sum / 1024;
  } catch { return null; }
}
let peak = null, res = null;
const deadline = Date.now() + (duration + 30) * 1000;
while (!res && Date.now() < deadline) {
  await sleep(250);
  const measuring = await ev('window.__benchFirstFrameEpoch ? (performance.timeOrigin + performance.now() - window.__benchFirstFrameEpoch) / 1000 >= 3 : false');
  if (measuring) { const m = treeRssMb(); if (m !== null) peak = Math.max(peak ?? 0, m); }
  res = await ev('window.__benchResult || null');
}
if (!res) fail('benchmark did not finish (page error?)');
const first = await ev('window.__benchFirstFrameEpoch');
const version = (await cdp('Browser.getVersion'))?.product ?? 'Chrome';

const dts = res.dts, N = dts.length, sum = dts.reduce((a, b) => a + b, 0);
const sorted = [...dts].sort((a, b) => a - b);
const k = Math.max(1, Math.ceil(0.01 * N));
const worst = sorted.slice(-k);
const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
const r1 = (x) => Math.round(x * 10) / 10;
const report = {
  contract_version: contract.contract_version,
  avg_fps: r1((1000 * N) / sum),
  p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
  frame_ms_p95: Math.round(p95 * 100) / 100,
  frames: N,
  load_ms: Math.round(first - processStartEpoch),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `Three.js r${res.three} (WebGL${res.webgl2 ? '2' : '1'}) on ${version}; GPU: ${res.gpu}${process.env.BENCH_HEADLESS ? ' [headless]' : ''}`,
  os: `${type()} ${release()} ${arch()} (${platform()}), CPU: ${cpus()[0]?.model ?? '?'}`,
  scene: { seed, duration_s: duration, warmup_s: 3, shades: res.shades, motes: res.motes, lit: res.lit, viewport: '1280x720' },
  peak_mem_note: 'RSS sum of the Chrome process tree (browser, GPU, renderer) sampled every 250 ms during measurement',
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
sock.close(); cleanup(); process.exit(0);
