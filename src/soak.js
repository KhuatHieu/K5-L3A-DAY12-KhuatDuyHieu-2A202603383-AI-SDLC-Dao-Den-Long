#!/usr/bin/env node
// Soak test (Ticket-04 §2): node --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json
// Runs N nights headless in ONE process (night 1→2→3 rotating), night i uses seed+i, random seeded inputs.
import { readFileSync, writeFileSync } from 'node:fs';
import { configure, createGame, step, drainEvents, mulberry32 } from './sim.js';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const seed = parseInt(args.seed ?? '7', 10), nights = parseInt(args.nights ?? '10', 10), out = args.out;
if (!out || !Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { process.stderr.write('usage: soak --seed <int> --nights <int> --out <file>\n'); process.exit(1); }
configure(JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).tuning);

const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const MAX_TICKS = 21600;
const t0 = performance.now();
const results = [];
let crashes = 0, memStart = null, g = null;

for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  try {
    g = createGame({ seed: seed + i, night });
    if (memStart === null) { gc(); memStart = rssMb(); } // RSS after the first night is loaded
    const rng = mulberry32((seed + i) ^ 0x5bd1e995);
    let move = [0, 0];
    for (let k = 0; k < MAX_TICKS && (g.state === 'playing' || g.state === 'paused'); k++) {
      if (k % 30 === 0) { const a = rng() * Math.PI * 2; move = [Math.cos(a), Math.sin(a)]; }
      step(g, { move, cam_yaw_deg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.10 });
      drainEvents(g);
    }
    results.push(g.state === 'won' || g.state === 'lost' ? g.state : 'timeout');
  } catch (e) {
    crashes++; results.push('crash'); process.stderr.write(`night ${i} crashed: ${e.stack}\n`);
  }
  g = null; // reset: drop the finished night
}
gc();
const report = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: rssMb(), duration_s: Math.round((performance.now() - t0) / 100) / 10 };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
