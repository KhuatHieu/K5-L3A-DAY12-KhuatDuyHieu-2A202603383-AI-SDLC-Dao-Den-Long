// Contract tests: run the real headless CLI and check its JSONL output.
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

function run({ seed = 1, scenario, inputs, ticks = 600, every, raw = {} } = {}) {
  const id = n++;
  const out = join(dir, `out${id}.jsonl`);
  const args = ['src/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  if (scenario !== undefined) {
    const f = join(dir, `sc${id}.json`);
    writeFileSync(f, raw.scenario ?? JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (inputs !== undefined) {
    const f = join(dir, `in${id}.json`);
    writeFileSync(f, raw.inputs ?? JSON.stringify({ frames: inputs }));
    args.push('--inputs', f);
  }
  if (every) args.push('--snapshot-every', String(every));
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  let lines = [], text = '';
  if (r.status === 0) {
    text = readFileSync(out, 'utf8');
    lines = text.trim().split('\n').map((l) => JSON.parse(l));
  }
  return { code: r.status, stderr: r.stderr, lines, text,
    events: lines.filter((l) => l.type === 'event'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    end: lines[lines.length - 1] };
}
const quiet = { random_motes: false, random_shades: false, motes: [], shades: [] };

test('tick 0 snapshot = scenario state, end line last, snapshot cadence', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 100 }, ticks: 25, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20]);
  assert.equal(r.snaps[0].time_left_s, 100);
  assert.deepEqual(r.snaps[0].player.pos, [0, 0, 0]);
  assert.equal(r.snaps[0].lanterns.length, 5);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
  assert.equal(r.snaps[1].time_left_s, Number((100 - 10 / 60).toFixed(3)));
});

test('default game: 5 lanterns L1..L5, motes and shades exist', () => {
  const r = run({ ticks: 0 });
  const s = r.snaps[0];
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.ok(s.motes_active > 0);
  assert.ok(s.shades.length > 0);
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.player.flames, T.flames);
});

test('movement: player_speed and camera yaw rotation', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }], ticks: 60, every: 60 });
  assert.deepEqual(r.snaps[1].player.pos, [0, 0, T.player_speed]);
  const r2 = run({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60, every: 60 });
  assert.deepEqual(r2.snaps[1].player.pos, [T.player_speed, 0, 0]);
  const r3 = run({ scenario: quiet, inputs: [{ tick: 0, move: [1, 1] }], ticks: 60, every: 60 }); // normalized
  const p = r3.snaps[1].player.pos;
  assert.ok(Math.abs(Math.hypot(p[0], p[2]) - T.player_speed) < 0.01);
});

test('input frame applied at tick k affects state k+1; missing fields persist', () => {
  const r = run({ scenario: quiet, inputs: [{ tick: 5, move: [1, 0] }, { tick: 10, cam_yaw_deg: 0 }], ticks: 20, every: 1 });
  assert.equal(r.snaps[5].player.pos[0], 0);
  assert.ok(r.snaps[6].player.pos[0] > 0);
  assert.ok(r.snaps[20].player.pos[0] > r.snaps[10].player.pos[0]);
});

test('pickup within pickup_radius (<= r), event tick = k+1, score per_mote', () => {
  const r = run({ scenario: { ...quiet, motes: [[T.pickup_radius, 0, 0], [T.pickup_radius + 0.01, 0, 0]] }, ticks: 1 });
  assert.deepEqual(r.events, [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(r.end.score, T.score.per_mote);
});

test('carry_capacity limits pickup', () => {
  const motes = Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 0.5]);
  const r = run({ scenario: { ...quiet, motes }, ticks: 1 });
  assert.equal(r.events.filter((e) => e.name === 'mote_picked').length, T.carry_capacity);
});

test('deposit + lantern_lit on interact rising edge within interact_radius', () => {
  const sc = { ...quiet, player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 3, interact: true }], ticks: 10 });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name, e.data]), [
    [4, 'deposit', { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost }],
    [4, 'lantern_lit', { lantern_id: 'L1' }],
  ]);
  assert.equal(r.end.score, T.score.per_lantern);
});

test('partial deposit; holding interact does not retrigger', () => {
  const sc = { ...quiet, player: { carried: 2 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 30 });
  assert.deepEqual(r.events.map((e) => e.name), ['deposit']);
  assert.deepEqual(r.events[0].data, { lantern_id: 'L2', amount: 2, deposited: 2 });
});

test('out of interact_radius: no deposit', () => {
  const sc = { ...quiet, player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.01] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 2 });
  assert.equal(r.events.length, 0);
});

test('win: lighting last lantern -> game_over won all_lit, stops early with bonus', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = { ...quiet, player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...lit], time_left_s: 100 };
  const r = run({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 600 });
  const go = r.events.at(-1);
  assert.deepEqual(go, { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.equal(r.end.ticks, 1);
  assert.equal(r.end.state, 'won');
  const left = Math.floor(100 - 1 / 60);
  assert.equal(r.end.score, T.score.per_lantern + T.score.per_second_left * left + T.score.per_flame_left * T.flames);
});

test('scenario lit:true awards no points and emits no events', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }] }, ticks: 1 });
  assert.equal(r.events.length, 0);
  assert.equal(r.snaps[0].score, 0);
  assert.equal(r.snaps[0].lanterns[0].lit, true);
});

test('shade chases at shade_speed, hits within shade_hit_radius, drops carried', () => {
  const sc = { ...quiet, player: { carried: 4 }, shades: [{ id: 'S9', pos: [5, 0, 0] }] };
  const r = run({ scenario: sc, ticks: 120, every: 30 });
  assert.equal(r.snaps[1].shades[0].pos[0], Number((5 - T.shade_speed * 0.5).toFixed(3)));
  const hit = r.events.find((e) => e.name === 'player_hit');
  assert.ok(hit);
  assert.deepEqual(hit.data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  const expectTick = Math.ceil(((5 - T.shade_hit_radius) / T.shade_speed) * 60 - 1e-6);
  assert.ok(Math.abs(hit.tick - expectTick) <= 1, `hit tick ${hit.tick} vs ${expectTick}`);
});

test('invuln_s prevents repeated hits; lose at 0 flames (no_flames)', () => {
  const sc = { ...quiet, player: { flames: 2 }, shades: [{ pos: [0.5, 0, 0] }] };
  const r = run({ scenario: sc, ticks: 1000 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 2);
  assert.equal(hits[1].tick - hits[0].tick, Math.round(T.invuln_s * 60));
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
});

test('pulse: costs light, stuns + pushes shades within pulse_radius, cooldown', () => {
  const sc = { ...quiet, player: { carried: 3 }, shades: [{ id: 'A', pos: [T.pulse_radius, 0, 0] }, { id: 'B', pos: [-20, 0, 0] }] };
  const inputs = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }, { tick: 3, pulse: false }];
  const r = run({ scenario: sc, inputs, ticks: 3, every: 1 });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 1, 'second pulse blocked by cooldown');
  assert.deepEqual(pulses[0].data, { stunned_ids: ['A'] });
  const s1 = r.snaps[1];
  assert.equal(s1.player.carried, 3 - T.pulse_cost);
  assert.equal(s1.shades[0].state, 'stunned');
  assert.equal(s1.shades[0].pos[0], T.pulse_radius + T.pulse_push_m);
  assert.notEqual(s1.shades[1].state, 'stunned');
  assert.equal(s1.score, T.score.per_stun);
});

test('stun lasts pulse_stun_s', () => {
  const sc = { ...quiet, player: { carried: 1 }, shades: [{ pos: [2, 0, 0] }] };
  const st = Math.round(T.pulse_stun_s * 60);
  const r = run({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: st + 2, every: 1 });
  assert.equal(r.snaps[st].shades[0].state, 'stunned');
  assert.notEqual(r.snaps[st + 1].shades[0].state, 'stunned');
});

test('pulse without enough light does nothing', () => {
  const r = run({ scenario: { ...quiet, shades: [{ pos: [2, 0, 0] }] }, inputs: [{ tick: 0, pulse: true }], ticks: 1 });
  assert.equal(r.events.length, 0);
});

test('lit lantern safe_radius keeps shades out', () => {
  const sc = { ...quiet, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [10, 0, 0] }] };
  const r = run({ scenario: sc, ticks: 600, every: 60 });
  for (const s of r.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= T.safe_radius - 1e-3);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('dawn: timer runs out -> lost dawn', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 1 }, ticks: 600 });
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('random shades spawn with shade_spawned events', () => {
  const r = run({ scenario: { shades: [] }, ticks: 60 * 31 });
  const sp = r.events.filter((e) => e.name === 'shade_spawned');
  assert.ok(sp.length >= 1);
  assert.match(sp[0].data.id, /^S\d+$/);
});

test('determinism: same seed+inputs -> identical bytes; different seed differs', () => {
  const inputs = [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 37 }, { tick: 200, pulse: true }, { tick: 201, pulse: false }];
  const a = run({ seed: 42, inputs, ticks: 3000 });
  const b = run({ seed: 42, inputs, ticks: 3000 });
  const c = run({ seed: 43, inputs, ticks: 3000 });
  assert.equal(a.text, b.text);
  assert.notEqual(a.text, c.text);
});

test('coordinates rounded to 3 decimals', () => {
  const r = run({ inputs: [{ tick: 0, move: [0.37, 0.91], cam_yaw_deg: 13 }], ticks: 100 });
  for (const s of r.snaps) for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
});

test('exit codes: malformed inputs/scenario -> 2, bad args -> nonzero', () => {
  assert.equal(run({ inputs: [], raw: { inputs: '{not json' } }).code, 2);
  assert.equal(run({ inputs: [{ tick: 5 }, { tick: 5 }] }).code, 2);
  assert.equal(run({ inputs: [{ tick: 0, move: 'up' }] }).code, 2);
  assert.equal(run({ scenario: {}, raw: { scenario: '[1,2' } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L9' }] } }).code, 2);
  const r = spawnSync('node', ['src/headless.js', '--seed', '1'], { cwd: ROOT });
  assert.notEqual(r.status, 0);
});

test('contract file shape', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in C);
  assert.equal(C.contract_version, '1.0');
  assert.equal(T.lantern_count_night1, 5);
});

test('radius boundary robust to float drift (walk exactly to interact_radius)', () => {
  // 50 ticks * 6 m/s / 60 = 5.0 m (accumulated float ≈ 4.9999999); lantern at 8 -> d = 3 = interact_radius
  const sc = { ...quiet, player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 5 + T.interact_radius] }] };
  const r = run({ scenario: sc, inputs: [{ tick: 0, move: [0, 1] }, { tick: 50, move: [0, 0] }, { tick: 55, interact: true }], ticks: 60 });
  assert.equal(r.events.filter((e) => e.name === 'deposit').length, 1);
});
