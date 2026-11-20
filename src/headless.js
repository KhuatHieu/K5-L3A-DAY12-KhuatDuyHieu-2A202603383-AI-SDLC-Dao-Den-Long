#!/usr/bin/env node
// Headless runner — Test Contract v1.1.
// node src/headless.js --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
import { readFileSync, writeFileSync } from 'node:fs';
import { configure, createGame, step, snapshot, drainEvents, ScenarioError } from './sim.js';

const fail = (code, msg) => { process.stderr.write(`error: ${msg}\n`); process.exit(code); };

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(1, `unexpected argument ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(1, `missing value for ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  return a;
}
const intArg = (a, k, def) => {
  if (a[k] === undefined) { if (def === undefined) fail(1, `--${k} is required`); return def; }
  if (!/^-?\d+$/.test(a[k])) fail(1, `--${k} must be an integer`);
  return parseInt(a[k], 10);
};

function readJson(path, what) {
  let txt;
  try { txt = readFileSync(path, 'utf8'); } catch (e) { fail(1, `cannot read ${what} ${path}: ${e.message}`); }
  try { return JSON.parse(txt); } catch (e) { fail(2, `${what} is not valid JSON: ${e.message}`); }
}

function validateInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) fail(2, 'inputs: "frames" array required');
  const byTick = new Map();
  let last = -1;
  for (const f of obj.frames) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) fail(2, 'inputs: frame must be object');
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(2, 'inputs: tick must be a non-negative integer');
    if (f.tick <= last) fail(2, 'inputs: ticks must be strictly increasing');
    last = f.tick;
    if (f.move !== undefined && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((x) => typeof x === 'number' && Number.isFinite(x))))
      fail(2, 'inputs: move must be [x, z] numbers');
    if (f.cam_yaw_deg !== undefined && !(typeof f.cam_yaw_deg === 'number' && Number.isFinite(f.cam_yaw_deg)))
      fail(2, 'inputs: cam_yaw_deg must be a number');
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause'])
      if (f[b] !== undefined && typeof f[b] !== 'boolean') fail(2, `inputs: ${b} must be boolean`);
    const frame = {};
    if (f.move) frame.move = f.move.map((x) => Math.max(-1, Math.min(1, x)));
    for (const k of ['cam_yaw_deg', 'jump', 'interact', 'pulse', 'dash', 'pause']) if (f[k] !== undefined) frame[k] = f[k];
    byTick.set(f.tick, frame);
  }
  return byTick;
}

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, 'seed', 0);
const night = intArg(args, 'night', 1);
if (![1, 2, 3].includes(night)) fail(1, `--night must be 1, 2 or 3 (got ${night})`);
const ticks = intArg(args, 'ticks');
if (ticks < 0) fail(1, '--ticks must be >= 0');
const every = intArg(args, 'snapshot-every', 10);
if (every <= 0) fail(1, '--snapshot-every must be > 0');
if (!args.out) fail(1, '--out is required');

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
configure(contract.tuning);

const scenario = args.scenario ? readJson(args.scenario, 'scenario') : null;
const inputs = args.inputs ? validateInputs(readJson(args.inputs, 'inputs')) : new Map();

let g;
try { g = createGame({ seed, night, scenario }); } catch (e) {
  if (e instanceof ScenarioError) fail(2, `scenario: ${e.message}`);
  throw e;
}

const lines = [JSON.stringify(snapshot(g)), JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night } })];
const live = () => g.state === 'playing' || g.state === 'paused';
for (let k = 0; k < ticks && live(); k++) {
  step(g, inputs.get(k) || null);
  for (const e of drainEvents(g)) lines.push(JSON.stringify(e));
  if (g.tick % every === 0) lines.push(JSON.stringify(snapshot(g)));
}
lines.push(JSON.stringify({ type: 'end', ticks: g.tick, state: g.state, score: g.score }));
try { writeFileSync(args.out, lines.join('\n') + '\n'); } catch (e) { fail(1, `cannot write ${args.out}: ${e.message}`); }
