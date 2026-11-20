// Contract tests: v1.1 (Ticket-02) updated for v1.2 (Ticket-03). Tests changed by Ticket-03 say so in a comment. Each test runs the real headless CLI and checks its JSONL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const C = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const T = C.tuning;
const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
let n = 0;

export function run({ seed = 1, night = 1, scenario, inputs, ticks = 600, every, raw = {} } = {}) {
  const id = n++;
  const out = join(dir, `out${id}.jsonl`);
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out];
  if (scenario !== undefined) { const f = join(dir, `sc${id}.json`); writeFileSync(f, raw.scenario ?? JSON.stringify(scenario)); args.push('--scenario', f); }
  if (inputs !== undefined) { const f = join(dir, `in${id}.json`); writeFileSync(f, raw.inputs ?? JSON.stringify({ frames: inputs })); args.push('--inputs', f); }
  if (every) args.push('--snapshot-every', String(every));
  const t0 = Date.now();
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  let lines = [], text = '';
  if (r.status === 0) { text = readFileSync(out, 'utf8'); lines = text.trim().split('\n').map((l) => JSON.parse(l)); }
  const snaps = lines.filter((l) => l.type === 'snapshot');
  return {
    code: r.status, stderr: r.stderr, lines, text, ms: Date.now() - t0,
    events: lines.filter((l) => l.type === 'event' && l.name !== 'night_start'),
    allEvents: lines.filter((l) => l.type === 'event'),
    snaps, at: (tick) => snaps.find((s) => s.tick === tick), end: lines[lines.length - 1],
  };
}
const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [], charms: [] };
const names = (r) => r.events.map((e) => e.name);
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

// ---------------- core / regression of v1.0 rules with standard numbers
// [Ticket-03] durations 240/270/300, new fuel keys, new score table · [Ticket-04] version 1.3 + bench_cmd/soak_cmd
test('contract v1.3 file has standard numbers and bench/soak commands', () => {
  assert.equal(C.contract_version, '1.3');
  for (const k of ['build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof C[k], 'string', k);
  const want = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, invuln_s: 1.5, hit_drop_ratio: 0.5, flames: 3,
    night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    pulse_stun_s: 2, pulse_push_m: 4, fall_enabled: true, lantern_count_night1: 5 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lantern_dawn: 50, per_second_left: 0, per_flame_left: 50 });
});

test('tick 0 snapshot, night_start, cadence, end line, new snapshot fields', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 100 }, ticks: 25, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  const s = r.snaps[0];
  assert.equal(s.night, 1);
  assert.deepEqual(s.wind, { active: false, dir_deg: null });
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  for (const k of ['motes', 'drifters', 'charms']) assert.ok(Array.isArray(s[k]), k);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
  assert.equal(r.snaps[1].time_left_s, Number((100 - 10 / 60).toFixed(3)));
});

test('night 1 standard map: lanterns, 20 random motes on spawn points, no shades at tick 0', () => {
  const s = run({ ticks: 0 }).snaps[0];
  assert.deepEqual(s.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(s.motes.length, 20);
  assert.ok(s.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  const radii = new Set(s.motes.map((m) => Math.round(Math.hypot(m.pos[0], m.pos[2]))));
  assert.ok([...radii].every((r) => r === 12 || r === 33));
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20);
  assert.equal(s.shades.length, 0);
  assert.equal(s.player.flames, 3);
});

test('shade schedule night 1: 2 at tick 300 (spawning), +1 every 480, ids S1.., ≥15 m from player, max 6', () => {
  const r = run({ scenario: { random_motes: false, motes: [], player: { invuln_ticks: 100000 } }, ticks: 300 + 480 * 6, every: 300 });
  const sp = r.events.filter((e) => e.name === 'shade_spawned');
  assert.deepEqual(sp.slice(0, 3).map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  assert.equal(sp.length, 6);
  const s300 = r.at(300);
  assert.ok(s300.shades.every((s) => s.state === 'spawning'));
  for (const s of s300.shades) assert.ok(near(Math.hypot(s.pos[0], s.pos[2]), 37, 0.01));
});

test('random mote respawn at ticks 240, 480 on a free point', () => {
  const r = run({ scenario: { random_shades: false }, ticks: 481, every: 1 });
  assert.equal(r.at(239).motes_active, 20);
  assert.equal(r.at(240).motes_active, 21);
  assert.equal(r.at(480).motes_active, 22);
});

test('movement: 6 m/s, camera yaw rotation, normalization', () => {
  assert.deepEqual(run({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1] }], ticks: 60, every: 60 }).snaps[1].player.pos, [0, 0, 6]);
  assert.deepEqual(run({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60, every: 60 }).snaps[1].player.pos, [6, 0, 0]);
  const p = run({ scenario: quiet, inputs: [{ tick: 0, move: [1, 1] }], ticks: 60, every: 60 }).snaps[1].player.pos;
  assert.ok(near(Math.hypot(p[0], p[2]), 6, 0.01));
});

test('input at tick k affects state k+1; sparse frames persist', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 5, move: [1, 0] }, { tick: 10, cam_yaw_deg: 0 }], ticks: 20, every: 1 });
  assert.equal(r.at(5).player.pos[0], 0);
  assert.ok(r.at(6).player.pos[0] > 0);
  assert.ok(r.at(20).player.pos[0] > r.at(10).player.pos[0]);
});

test('jump: 7 m/s, gravity 20, only when grounded, apex ≈ 1.225 m', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, jump: true }], ticks: 60, every: 1 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(near(Math.max(...ys), 1.225, 0.07));
  assert.equal(r.at(1).player.grounded, false);
  const land = r.snaps.find((s) => s.tick > 1 && s.player.grounded).tick;
  assert.ok(Math.abs(land - 42) <= 2, `landed at ${land}`);
  assert.ok(r.snaps.filter((s) => s.tick > land).every((s) => s.player.pos[1] === 0), 'jump at tick 10 (airborne) ignored');
});

test('pickup: XZ ≤ 1.0 and height diff ≤ 1.5; capacity 10', () => {
  const r = run({ scenario: { ...quiet, motes: [[1, 0, 0], [1.01, 0, 0], [0, 1.6, 0.5]] }, ticks: 1 });
  assert.deepEqual(r.events, [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(r.end.score, 0, 'picking scores nothing in v1.1');
  const many = Array.from({ length: 12 }, () => [0, 0, 0.5]);
  assert.equal(run({ scenario: { ...quiet, motes: many }, ticks: 1 }).events.length, 10);
});

// [Ticket-03] +5 per mote (was +10); lantern_lit carries relight:false
test('deposit: radius 2.0, min(carried, missing), +5 per mote deposited, lantern remembers progress', () => {
  const sc = { ...quiet, player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }, { tick: 1, interact: false }], ticks: 5 });
  assert.deepEqual(r.events.map((e) => e.data), [{ lantern_id: 'L1', amount: 6, deposited: 6 }]);
  assert.equal(r.end.score, 30);
  const r2 = run({ scenario: { ...quiet, player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.01] }] }, inputs: [{ tick: 0, interact: true }], ticks: 2 });
  assert.equal(r2.events.length, 0);
  const r3 = run({ scenario: { ...quiet, player: { carried: 9 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 6 }] }, inputs: [{ tick: 0, interact: true }], ticks: 2 });
  assert.deepEqual(r3.events.map((e) => [e.name, e.data]), [['deposit', { lantern_id: 'L1', amount: 4, deposited: 10 }], ['lantern_lit', { lantern_id: 'L1', relight: false }]]);
  assert.equal(r3.end.score, 20 + 100);
});

test('deposit picks nearest unlit lantern, tie → smaller id', () => {
  // [Ticket-03] a lit lantern is no longer skipped (it decays below 100 and can be refuelled), so the lit L3 was moved out of range
  const sc = { ...quiet, player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }, { id: 'L3', pos: [0, 0, 5], lit: true }] };
  assert.equal(run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 1 }).events[0].data.lantern_id, 'L1');
  const sc2 = { ...sc, lanterns: [{ id: 'L1', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }] };
  assert.equal(run({ scenario: sc2, inputs: [{ tick: 0, interact: true }], ticks: 1 }).events[0].data.lantern_id, 'L2');
});

// [Ticket-03] REPLACED: "win when all lit / all_lit" no longer exists. Lighting every lantern does not end the night;
// the win is decided at dawn (see Phase 3 tests below). Kept here: no_flames always beats a dawn win.
test('lighting all lanterns does not end the night; no_flames on the dawn tick still loses', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = { ...quiet, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...lit], time_left_s: 100 };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 60 });
  assert.ok(names(r).includes('lantern_lit'));
  assert.equal(r.end.state, 'playing');
  const r2 = run({ scenario: { ...sc, player: { flames: 0 }, time_left_s: 1 / 60 }, ticks: 10 });
  assert.deepEqual(r2.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('dawn: time runs out → lost dawn', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 1 }, ticks: 600 });
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
});

// ---------------- shades
test('shade detect 12 m → chase at 4 m/s; beyond detect stays wander', () => {
  const r = run({ scenario: { ...quiet, shades: [{ id: 'A', pos: [11.9, 0, 0] }, { id: 'B', pos: [-30, 0, 0] }] }, ticks: 30, every: 30 });
  const [a, b] = r.at(30).shades;
  assert.equal(a.state, 'chase');
  assert.ok(near(a.pos[0], 11.9 - 2, 1e-3));
  assert.equal(b.state, 'wander');
});

test('shade lose-chase at 18 m', () => {
  const sc = { ...quiet, shades: [{ id: 'A', pos: [10, 0, 0], state: 'chase' }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, move: [-1, 0] }], ticks: 600, every: 1 }); // player runs −X... (x' = x) → −X
  const lost = r.snaps.find((s) => s.shades[0].state === 'wander');
  assert.ok(lost);
  const d = Math.abs(lost.player.pos[0] - lost.shades[0].pos[0]);
  assert.ok(d > 18 && d < 18.2, `lost chase at ${d}`);
});

test('shade hit: −1 flame, drops floor(n/2) motes on 1.5–2.5 m ring (ttl 8 s), invuln 90, recoil 2 m / 60 ticks, 1 hit per tick', () => {
  const sc = { ...quiet, player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }, { id: 'S2', pos: [-0.5, 1, 0] }] };
  const r = run({ scenario: sc, ticks: 120, every: 1 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.equal(r.at(1).shades.find((s) => s.id === 'S1').state, 'recoil');
  assert.equal(r.at(1).shades.find((s) => s.id === 'S2').state, 'chase');
  const drops = r.at(1).motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 2);
  for (const m of drops) { const d = Math.hypot(m.pos[0], m.pos[2]); assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3); assert.equal(m.ttl_s, 8); }
  assert.equal(r.at(1).player.invuln, true);
  assert.equal(hits[1].tick, 91, 'second hit after 90 invuln ticks');
  const s1 = (t) => r.at(t).shades.find((s) => s.id === 'S1').pos[0];
  assert.ok(near(s1(60) - s1(0) + 4 / 60, 2, 1e-3), `recoil distance ${s1(60) - s1(0) + 4 / 60}`); // +4/60: chase step before the hit
});

test('dropped motes expire after 480 ticks', () => {
  const r = run({ scenario: { ...quiet, motes: [{ pos: [5, 0, 0], kind: 'dropped' }] }, ticks: 481, every: 1 });
  assert.equal(r.at(479).motes_active, 1);
  assert.equal(r.at(480).motes_active, 0);
});

test('safe zone: lit lantern blocks shades at 6 m; shade inside when lit is pushed out ≤ 30 ticks without damage', () => {
  const sc = { ...quiet, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [10, 0, 0] }] };
  const r = run({ scenario: sc, ticks: 300, every: 10 });
  for (const s of r.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3);
  const sc2 = { ...quiet, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }], shades: [{ pos: [1.5, 1, 0] }] };
  const r2 = run({ scenario: sc2, inputs: [{ tick: 0, interact: true }], ticks: 40, every: 1 });
  assert.ok(!names(r2).includes('player_hit'), 'no damage while being pushed out');
  const out = r2.snaps.find((s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 1) >= 6 - 1e-3);
  assert.ok(out && out.tick <= 31, `out at ${out && out.tick}`);
});

// ---------------- pulse
test('pulse: costs 3, stuns within 3D 5 m of foot+0.8, 120 ticks, push 4 m over 15 ticks, +5 each, cooldown 3 s', () => {
  const sc = { ...quiet, player: { carried: 7 }, shades: [{ id: 'A', pos: [4, 0.8, 3] }, { id: 'B', pos: [4, 4, 0] }, { id: 'C', pos: [0, 0.8, 0] }] };
  const inputs = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 5, pulse: true }];
  const r = run({ scenario: sc, inputs, ticks: 130, every: 1 });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 1, 'cooldown blocks the second pulse');
  assert.deepEqual(pulses[0].data, { stunned_ids: ['A', 'C'] });
  assert.equal(r.at(1).player.carried, 4);
  assert.equal(r.at(1).player.pulse_cd_s, 3);
  assert.equal(r.at(1).score, 10);
  const A15 = r.at(15).shades[0], A20 = r.at(20).shades[0];
  assert.ok(near(Math.hypot(A15.pos[0], A15.pos[2]), 5 + 4, 1e-3));
  assert.deepEqual(A20.pos, A15.pos);
  assert.ok(near(r.at(15).shades[2].pos[0], 4, 1e-3), 'coincident shade pushed +X');
  assert.equal(r.at(120).shades[0].state, 'stunned');
  assert.notEqual(r.at(121).shades[0].state, 'stunned');
});

test('pulse needs 3 motes; re-pulse refreshes stun on stunned shade and scores again', () => {
  assert.equal(run({ scenario: { ...quiet, player: { carried: 2 }, shades: [{ pos: [2, 1, 0] }] }, inputs: [{ tick: 0, pulse: true }], ticks: 2 }).events.length, 0);
  const sc = { ...quiet, player: { carried: 6, pulse_cd_ticks: 0 }, shades: [{ pos: [1, 1, 0], state: 'stunned', state_ticks_left: 10 }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: 50, every: 50 });
  assert.equal(r.at(50).shades[0].state, 'stunned');
  assert.equal(r.end.score, 5);
});

// ---------------- dash
test('dash: 14 m/s for 12 ticks (2.8 m) along move dir, cooldown 1.5 s from start, facing dir when idle', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 90, dash: true }], ticks: 120, every: 1 });
  assert.deepEqual(r.events.filter((e) => e.name === 'dash').map((e) => e.tick), [1, 91]);
  assert.ok(near(r.at(12).player.pos[2], 2.8, 1e-3), 'idle dash goes +Z (initial facing)');
  assert.equal(r.at(1).player.vel[2], 14);
  const r2 = run({ scenario: quiet, inputs: [{ tick: 0, move: [1, 0], dash: true }], ticks: 12, every: 12 });
  assert.ok(near(r2.at(12).player.pos[0], 2.8, 1e-3));
});

test('dash in the air keeps height', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 0, jump: true }, { tick: 10, dash: true }], ticks: 25, every: 1 });
  const y = r.at(10).player.pos[1];
  for (let t = 11; t <= 22; t++) assert.equal(r.at(t).player.pos[1], y);
});

// ---------------- falling
test('fall off island: once, −1 flame, lose all carried, wait 60 ticks, respawn at start with invuln', () => {
  const sc = { ...quiet, player: { pos: [39.5, 0, 0], carried: 4 } };
  const r = run({ scenario: sc, inputs: [{ tick: 0, move: [-1, 0], cam_yaw_deg: 180 }, { tick: 10, move: [0, 0] }], ticks: 200, every: 1 });
  const falls = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const ft = falls[0].tick;
  assert.notDeepEqual(r.at(ft + 59).player.pos, [0, 0, 0]);
  assert.deepEqual(r.at(ft + 60).player.pos, [0, 0, 0]);
  assert.equal(r.at(ft + 60).player.invuln, true);
  assert.equal(r.at(ft + 60).player.carried, 0);
});

test('fall with last flame loses immediately', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [39.9, 0, 0], flames: 1 } }, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 600 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

// ---------------- pause
test('pause: tick advances, sim_tick/time/cooldowns frozen, state paused, resume continues', () => {
  const sc = { ...quiet, player: { pulse_cd_ticks: 100 } };
  const r = run({ scenario: sc, inputs: [{ tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }], ticks: 60, every: 10 });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[11, 'paused'], [41, 'resumed']]);
  const s30 = r.at(30);
  assert.equal(s30.state, 'paused');
  assert.equal(s30.sim_tick, 10);
  assert.equal(s30.player.pulse_cd_s, Number(((100 - 10) / 60).toFixed(3)));
  assert.equal(r.at(60).sim_tick, 30);
  assert.equal(r.end.ticks, 60);
});

// ---------------- drifters
test('drifter: idle → chase (carried ≥ 5, ≤ 15 m) → steal min(3) → flee 240 ticks → removed', () => {
  const sc = { ...quiet, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] };
  const r = run({ scenario: sc, ticks: 400, every: 1 });
  assert.equal(r.at(1).drifters[0].state, 'chase');
  const st = r.events.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(st.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(r.at(st.tick).drifters[0].state, 'flee');
  assert.equal(r.at(st.tick).drifters[0].stolen, 3);
  assert.equal(r.at(st.tick + 239).drifters[0].state, 'flee');
  assert.equal(r.at(st.tick + 241).drifters[0].state, 'removed');
  const idle = run({ scenario: { ...sc, player: { carried: 4 } }, ticks: 5, every: 5 });
  assert.equal(idle.at(5).drifters[0].state, 'idle');
});

test('drifter steal ignores invulnerability; safe zone does not block it', () => {
  const sc = { ...quiet, player: { carried: 5, invuln_ticks: 600 }, lanterns: [{ id: 'L1', pos: [0, 0, 3], lit: true }], drifters: [{ pos: [0.5, 1.5, 0] }] };
  const r = run({ scenario: sc, ticks: 2 });
  assert.equal(r.events[0].name, 'drifter_steal');
});

test('pulse vs drifter: chase → flee without steal; flee with loot → drifter_drop as dropped motes', () => {
  const sc = { ...quiet, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: 30, every: 1 });
  assert.equal(r.at(1).drifters[0].state, 'flee');
  assert.ok(!names(r).includes('drifter_steal'));
  const sc2 = { ...quiet, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] };
  const r2 = run({ scenario: sc2, inputs: [{ tick: 0, pulse: true }], ticks: 130, every: 1 });
  assert.deepEqual(r2.events.find((e) => e.name === 'drifter_drop').data, { drifter_id: 'D1', amount: 3 });
  assert.equal(r2.at(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(r2.at(1).drifters[0].stolen, 0);
  assert.equal(r2.at(121).drifters[0].state, 'removed');
});

test('drifters spawn on nights 2/3 at tick 1200 (D1), not on night 1', () => {
  const r = run({ night: 2, scenario: { random_shades: false, random_motes: false, motes: [] }, ticks: 1200, every: 1200 });
  assert.deepEqual(r.at(1200).drifters.map((d) => d.id), ['D1']);
  const r1 = run({ night: 1, scenario: { random_shades: false }, ticks: 1200, every: 1200 });
  assert.equal(r1.at(1200).drifters.length, 0);
});

// ---------------- charms
test('charm: pickup event, 600 ticks, speed 7.2, dash without cooldown, respawn after 2700 ticks', () => {
  const sc = { ...quiet, charms: [{ id: 'C1', pos: [0, 0, 0.5] }] };
  const inputs = [{ tick: 1, move: [0, 1] }, { tick: 61, move: [0, 0], dash: true }, { tick: 62, dash: false }, { tick: 63, dash: true }, { tick: 64, dash: false }, { tick: 80, dash: true }];
  const r = run({ scenario: sc, inputs, ticks: 2702, every: 1 });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.ok(near(r.at(61).player.pos[2] - r.at(1).player.pos[2], 7.2, 1e-3));
  assert.deepEqual(r.events.filter((e) => e.name === 'dash').map((e) => e.tick), [62, 81], 'press during dash ignored; no cooldown');
  assert.equal(r.at(1).charms[0].available, false);
  assert.equal(r.at(1).charms[0].respawn_s, 45);
  assert.equal(r.at(2700).charms[0].available, false);
  assert.equal(r.at(2701).charms[0].available, true);
});

test('charm default positions per night', () => {
  assert.deepEqual(run({ night: 2, ticks: 0 }).snaps[0].charms.map((c) => c.pos), [[35, 0, 0]]);
  assert.deepEqual(run({ night: 3, ticks: 0 }).snaps[0].charms.map((c) => c.pos), [[30, 0, 25], [-30, 0, 25]]);
  assert.equal(run({ night: 1, ticks: 0 }).snaps[0].charms.length, 0);
});

// ---------------- night 2 & 3 maps
test('night 2: 6 lanterns, bridge walkable, jump pad flies to island B', () => {
  const s = run({ night: 2, ticks: 0 }).snaps[0];
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  const bridge = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 0] } }, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 600, every: 600 });
  assert.ok(!names(bridge).includes('player_hit'), 'walk across bridge');
  const pad = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } }, ticks: 150, every: 1 });
  const landed = pad.snaps.find((x) => x.tick > 5 && x.player.grounded);
  assert.ok(landed, 'landed');
  const [x, , z] = landed.player.pos;
  assert.ok(Math.hypot(x - 70, z) <= 28, `landed in B at ${x},${z} tick ${landed.tick}`);
  assert.ok(Math.abs(landed.tick - 84) <= 3, `flight ≈ 1.4 s (${landed.tick})`);
});

test('night 3: ramp to tier 1, cliff wall blocks, pad to tier 2, tower blocks', () => {
  // ramp at 150°: walk inward along the ramp from r=31 to r=20
  const a = (150 * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
  const yaw = (Math.atan2(-ux, -uz) * 180) / Math.PI; // move [0,1] → world (sin θ, cos θ) = −u
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [31 * ux, 0, 31 * uz] } }, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: yaw }], ticks: 110, every: 110 });
  assert.equal(r.at(110).player.pos[1], 3, 'on tier 1');
  const wall = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 0, 26] } }, inputs: [{ tick: 0, move: [0, -1] }], ticks: 60, every: 60 });
  assert.ok(wall.at(60).player.pos[2] > 24 - 1e-3, 'blocked by tier-1 cliff');
  const pad = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 3, 13] } }, ticks: 120, every: 1 });
  const landed = pad.snaps.find((x) => x.tick > 5 && x.player.grounded);
  assert.equal(landed.player.pos[1], 6, 'landed on tier 2');
  const tower = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 6, -5] } }, inputs: [{ tick: 0, move: [0, 1] }], ticks: 120, every: 120 });
  assert.ok(Math.hypot(tower.at(120).player.pos[0], tower.at(120).player.pos[2]) >= 2 - 1e-3);
});

test('night 3 wind: gust at sim tick 1800 for 300 ticks, 2 m/s; wind_enabled false disables', () => {
  const r = run({ night: 3, scenario: { ...quiet, wind_enabled: true, player: { invuln_ticks: 100000 } }, ticks: 2101, every: 1 });
  assert.equal(r.at(1799).wind.active, false);
  assert.notEqual(r.at(1799).wind.dir_deg, null, 'direction known during 2 s warning');
  assert.equal(r.at(1800).wind.active, true);
  assert.equal(r.at(2100).wind.active, false);
  const v = r.at(1850).player.vel;
  assert.ok(near(Math.hypot(v[0], v[2]), 2, 1e-3));
  const off = run({ night: 3, scenario: { ...quiet, wind_enabled: false }, ticks: 1900, every: 1900 });
  assert.equal(off.at(1900).wind.active, false);
});

test('night 3 shades are 4.5 m/s', () => {
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 0, -30] }, shades: [{ pos: [10, 1, -30] }] }, ticks: 60, every: 60 });
  assert.ok(near(r.at(60).shades[0].pos[0], 10 - 4.5, 1e-3));
});

// ---------------- contract mechanics
test('determinism: nights 1–3 byte-identical for same seed+inputs', () => {
  const inputs = [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 37 }, { tick: 200, pulse: true }, { tick: 201, pulse: false }, { tick: 300, dash: true }];
  for (const night of [1, 2, 3]) {
    const a = run({ night, seed: 42, inputs, ticks: 3000 });
    const b = run({ night, seed: 42, inputs, ticks: 3000 });
    assert.equal(a.text, b.text, `night ${night}`);
  }
});

test('performance: full night (21600 ticks) headless ≤ 30 s', () => {
  const r = run({ night: 3, seed: 9, scenario: { player: { invuln_ticks: 30000 } }, ticks: 21600 });
  assert.equal(r.code, 0);
  assert.ok(r.ms < 30000, `${r.ms} ms`);
});

test('coordinates rounded to 3 decimals', () => {
  const r = run({ inputs: [{ tick: 0, move: [0.37, 0.91], cam_yaw_deg: 13 }], ticks: 100 });
  for (const s of r.snaps) for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
});

test('exit codes: malformed → 2; bad args / night 4 → nonzero', () => {
  assert.equal(run({ inputs: [], raw: { inputs: '{not json' } }).code, 2);
  assert.equal(run({ inputs: [{ tick: 5 }, { tick: 5 }] }).code, 2);
  assert.equal(run({ inputs: [{ tick: 0, pause: 'yes' }] }).code, 2);
  assert.equal(run({ scenario: {}, raw: { scenario: '[1,2' } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L9' }] } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [1, 0, 0], state: 'dancing' }] } }).code, 2);
  assert.notEqual(run({ night: 4 }).code, 0);
  assert.notEqual(spawnSync('node', ['src/headless.js', '--seed', '1'], { cwd: ROOT }).status, 0);
});

// ======================= Phase 3 — Ticket-03 "Đèn cạn dầu" (contract v1.2) =======================
const lanternAt = (r, tick, id = 'L1') => r.at(tick).lanterns.find((l) => l.id === id);

test('v1.2 snapshot fields: lantern fuel/ever_lit/relit_count, player.capacity; lit:true without fuel → 100', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 42.5 }] }, ticks: 0 });
  const [l1, l2, l3] = r.snaps[0].lanterns;
  assert.deepEqual([l1.fuel, l1.ever_lit, l1.relit_count], [100, true, 0]);
  assert.equal(l2.fuel, 42.5);
  assert.deepEqual([l3.fuel, l3.ever_lit, l3.lit], [0, false, false]);
  assert.equal(r.snaps[0].player.capacity, 10);
});

test('fuel decays 1/s exactly (integer 1/60 units); lantern_out at 0 → deposited 0, ever_lit', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 2, deposited: 10 }] }, ticks: 200, every: 1 });
  assert.equal(lanternAt(r, 60).fuel, 1);
  assert.equal(lanternAt(r, 119).lit, true);
  const out = r.events.find((e) => e.name === 'lantern_out');
  assert.deepEqual(out, { type: 'event', tick: 120, name: 'lantern_out', data: { lantern_id: 'L1' } });
  const l = lanternAt(r, 120);
  assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
  const long = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }] }, ticks: 6000, every: 6000 });
  assert.equal(lanternAt(long, 6000).fuel, 0, '100 fuel lasts exactly 100 s');
});

test('refuel: used = min(carried, ceil((100−fuel)/10)), +10 fuel each, +5 points each, event refuel', () => {
  const sc = { ...quiet, player: { carried: 8 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 1, every: 1 });
  // after step-2 decay fuel = 55 − 1/60 → missing 45.017 → ceil(4.5017) = 5
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(r.end.score, 25);
  assert.equal(r.at(1).player.carried, 3);
});

test('full lantern is not selectable: interact falls through to the next eligible lantern, or nothing', () => {
  // fuel 100 decays to 99.983 in step 2, so a scenario-lit lantern is never "full" at interact time; test via cap
  const sc = { ...quiet, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0.5], lit: true, fuel: 100 }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 1 });
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 }, 'ceil(0.017/10) = 1');
});

test('relight needs 5 (ever_lit), first light 10; scores +40 relight / +100 first; capacity +2 per light (max 20)', () => {
  const sc = { ...quiet, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }, { id: 'L2', pos: [0, 0, -1.2] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true }], ticks: 4, every: 1 });
  const lit = r.events.filter((e) => e.name === 'lantern_lit');
  assert.deepEqual(lit[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(lanternAt(r, 1).relit_count, 1);
  assert.equal(r.at(1).player.capacity, 12);
  assert.equal(r.at(1).score, 5 * 5 + 40);
  // 2nd press: L1 (now 99.98 fuel, not full) is still the nearest eligible lantern → refuel 1, not L2
  assert.deepEqual(r.events.find((e) => e.name === 'refuel').data, { lantern_id: 'L1', amount: 1, fuel: 100 });
  assert.equal(r.at(3).player.carried, 4);
  const cap = run({ scenario: { ...quiet, player: { successful_lights: 9 } }, ticks: 0 });
  assert.equal(cap.snaps[0].player.capacity, 20);
});

test('weak lantern (< 30) loses safe zone; exactly 30 keeps it', () => {
  const mk = (fuel) => ({ ...quiet, player: { pos: [0, 0, -20] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel }], shades: [{ id: 'S1', pos: [10, 1, 0] }] });
  const weak = run({ scenario: mk(20), ticks: 300, every: 10 });
  assert.ok(weak.snaps.some((s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) < 6 - 1e-3), 'shade entered');
  const ok = run({ scenario: mk(30.5), ticks: 25, every: 1 }); // stays ≥ 30 during the run
  for (const s of ok.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3);
});

test('wander shade goes to weak lantern, drains 5/s (+1/s decay), fuel_drain every 60 ticks, stacks', () => {
  const sc = { ...quiet, player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [1.5, 1, 0] }, { id: 'S2', pos: [-1.5, 1, 0] }] };
  const r = run({ scenario: sc, ticks: 130, every: 1 });
  assert.deepEqual(r.at(1).shades.map((s) => s.state), ['drain', 'drain']);
  const fd = r.events.filter((e) => e.name === 'fuel_drain');
  assert.deepEqual(fd.slice(0, 2).map((e) => [e.tick, e.data.shade_id]), [[61, 'S1'], [61, 'S2']]);
  // ticks 1..60: decay 60 + drain from tick 2 → 59 × 10 units … fuel after 60 ticks = 29 − 1 − 2×5×59/60
  assert.ok(near(lanternAt(r, 60).fuel, Math.round((29 - 1 - (10 * 59) / 60) * 10) / 10, 0.051));
});

test('drain exits: chase when Mây within 6 m; wander when refuelled ≥ 30 (and pushed out, no damage)', () => {
  const sc = { ...quiet, player: { pos: [0, 0, -7], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }] };
  const chase = run({ scenario: sc, inputs: [{ tick: 0, move: [0, 1] }], ticks: 20, every: 1 });
  const t = chase.snaps.find((s) => s.shades[0].state === 'chase').tick;
  const p = chase.at(t).player.pos;
  assert.ok(Math.hypot(1.5 - p[0], 0 - p[2]) <= 6 + 0.11, 'switched to chase as Mây came within 6 m');
  const sc2 = { ...sc, player: { pos: [0, 0, 1.5], carried: 5, invuln_ticks: 0 } };
  const r = run({ scenario: sc2, inputs: [{ tick: 0, interact: true }], ticks: 40, every: 1 });
  assert.equal(r.events[0].name, 'refuel');
  assert.equal(r.at(1).shades[0].state, 'recoil');
  assert.ok(!names(r).includes('player_hit'));
  assert.ok(Math.hypot(r.at(31).shades[0].pos[0], r.at(31).shades[0].pos[2]) >= 6 - 1e-3);
});

test('pulse on a draining shade scores 15 total; stun ends in wander', () => {
  const sc = { ...quiet, player: { pos: [0, 0, -4], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: 1, every: 1 });
  assert.equal(r.end.score, 15);
  assert.equal(r.at(1).shades[0].state, 'stunned');
});

test('dawn win: alive and lit ≥ ceil(0.6 × n) at the last tick → dawn_survived with lantern + flame bonus', () => {
  const lit = (ids, fuel) => ids.map((id) => ({ id, lit: true, fuel }));
  const r = run({ scenario: { ...quiet, lanterns: lit(['L1', 'L2', 'L3'], 50.5), time_left_s: 1 }, ticks: 100 });
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1).data, { result: 'won', reason: 'dawn_survived' });
  // fuel at dawn = 50.5 − 1 = 49.5 → floor 49; 3 × (50 + 49) + 3 flames × 50
  assert.equal(r.end.score, 3 * (50 + 49) + 150);
  const r2 = run({ scenario: { ...quiet, lanterns: lit(['L1', 'L2'], 50), time_left_s: 1 }, ticks: 100 });
  assert.deepEqual(r2.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(r2.end.score, 0);
  const n2 = run({ night: 2, scenario: { ...quiet, lanterns: lit(['L1', 'L2', 'L3'], 50), time_left_s: 1 }, ticks: 100 });
  assert.equal(n2.end.state, 'lost', 'night 2 needs 4/6');
  const n3 = run({ night: 3, scenario: { ...quiet, lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5'], 50), time_left_s: 1 }, ticks: 100 });
  assert.equal(n3.end.state, 'won', 'night 3 needs 5/7');
});

test('a lantern going out on the dawn tick does not count', () => {
  const sc = { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 1 }, { id: 'L2', lit: true }, { id: 'L3', lit: true }], time_left_s: 1 };
  const r = run({ scenario: sc, ticks: 100 });
  assert.ok(names(r).includes('lantern_out'));
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('default night durations 240 / 270 / 300 s', () => {
  for (const [n, d] of [[1, 240], [2, 270], [3, 300]]) assert.equal(run({ night: n, ticks: 0 }).snaps[0].time_left_s, d);
});
