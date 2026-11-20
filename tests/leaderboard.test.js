// Leaderboard (Ticket-04 §3): validation, ordering, top-10, persistence, export command.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as LB from '../src/leaderboard.js';

const ROOT = new URL('..', import.meta.url).pathname;
const e = (name, score, t, seed = 1) => ({ name, score, nights_won: 1, achieved_at: t, seed });

test('name rules: 3–12 of [A-Za-z0-9_]; Vietnamese letters accepted; others rejected', () => {
  for (const ok of ['abc', 'May_01', 'ABCDEFGHIJKL', 'Mây', 'Đăng_ông', 'Nguyễn']) assert.ok(LB.normalizeName(ok), ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'x-y-z', 'abc!', '', null, 'абвг']) assert.equal(LB.normalizeName(bad), null, String(bad));
});

test('sort: score desc, ties → earlier achieved_at first; keep top 10', () => {
  let list = [];
  list = LB.addEntry(list, e('late', 100, '2026-11-20T10:00:00+07:00')).entries;
  list = LB.addEntry(list, e('early', 100, '2026-11-20T09:00:00+07:00')).entries;
  list = LB.addEntry(list, e('top', 500, '2026-11-20T11:00:00+07:00')).entries;
  assert.deepEqual(list.map((x) => x.name), ['top', 'early', 'late']);
  for (let i = 0; i < 12; i++) list = LB.addEntry(list, e(`p${String(i).padStart(2, '0')}`, 200 + i, `2026-11-20T12:00:${String(i).padStart(2, '0')}+07:00`)).entries;
  assert.equal(list.length, 10);
  assert.equal(list[0].name, 'top');
  assert.ok(!list.some((x) => x.name === 'late'));
});

test('same score and same timestamp: earlier insertion stays above', () => {
  const t = '2026-11-20T10:00:00+07:00';
  const r = LB.addEntry(LB.addEntry([], e('first', 50, t)).entries, e('second', 50, t));
  assert.deepEqual(r.entries.map((x) => x.name), ['first', 'second']);
  assert.equal(r.rank, 2);
});

test('achieved_at is ISO 8601 with a time-zone offset', () => {
  assert.match(LB.isoWithTz(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('persisted on disk via API, survives server restart, exported in order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  const env = { ...process.env, DDL_DATA_DIR: dir, PORT: String(5800 + (process.pid % 100)) };
  const start = async () => { const s = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${env.PORT}/api/leaderboard`); return s; } catch { await new Promise((r) => setTimeout(r, 100)); } } return s; };
  let s = await start();
  const post = (b) => fetch(`http://127.0.0.1:${env.PORT}/api/leaderboard`, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json().then((j) => ({ status: r.status, ...j })));
  assert.equal((await post({ name: 'ab', score: 1, nights_won: 0, seed: 1 })).status, 400);
  await post({ name: 'Mây', score: 300, nights_won: 2, seed: 5 });
  await post({ name: 'Bob_1', score: 900, nights_won: 3, seed: 6 });
  s.kill(); await new Promise((r) => setTimeout(r, 200));
  s = await start(); // restart: data still there
  const got = await (await fetch(`http://127.0.0.1:${env.PORT}/api/leaderboard`)).json();
  s.kill();
  assert.deepEqual(got.entries.map((x) => x.name), ['Bob_1', 'Mây']);
  const out = join(dir, 'out.json');
  assert.equal(spawnSync(process.execPath, ['server.js', '--export-leaderboard', out], { cwd: ROOT, env }).status, 0);
  const ex = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(ex.entries.map((x) => [x.name, x.score, x.nights_won, x.seed]), [['Bob_1', 900, 3, 6], ['Mây', 300, 2, 5]]);
  for (const x of ex.entries) assert.match(x.achieved_at, /[+-]\d\d:\d\d$/);
});
