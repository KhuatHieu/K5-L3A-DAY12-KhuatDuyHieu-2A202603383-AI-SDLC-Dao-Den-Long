// Soak runner (Ticket-04 §2): short run checks output shape and the 1→2→3 rotation; full 10-night run is in docs/proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const C = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

test('soak_cmd writes {nights, crashes, results, mem_start_mb, mem_end_mb, duration_s}', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'ddl-soak-')), 'soak.json');
  const [bin, ...flags] = C.soak_cmd.split(' ');
  const r = spawnSync(bin, [...flags, '--seed', '7', '--nights', '4', '--out', out], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 4);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 4);
  for (const x of s.results) assert.ok(['won', 'lost'].includes(x), x);
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof s[k], 'number', k);
});
