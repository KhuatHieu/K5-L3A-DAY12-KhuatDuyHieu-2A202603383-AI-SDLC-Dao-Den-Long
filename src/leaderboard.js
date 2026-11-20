// Local leaderboard (Ticket-04 §3): pure helpers + JSON file storage. Used by server.js (API + export).
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export const MAX_ENTRIES = 10;
// 3–12 chars of [A-Za-z0-9_]; Vietnamese letters with diacritics also accepted (bonus). Counted after NFC.
const NAME_RE = /^[\p{Script=Latin}\p{Nd}_]{3,12}$/u;
export function normalizeName(name) {
  if (typeof name !== 'string') return null;
  const n = name.normalize('NFC').trim();
  return NAME_RE.test(n) && !/\p{M}/u.test(n) ? n : null;
}
// ISO 8601 with the local time-zone offset, e.g. 2026-11-20T17:05:09+07:00
export function isoWithTz(d = new Date()) {
  const pad = (x) => String(Math.floor(Math.abs(x))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}
// score desc; equal score → whoever achieved it first stays above (time, then insertion order)
export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map((x) => x.e)
    .slice(0, MAX_ENTRIES);
}
export function validateEntry(x) {
  const name = normalizeName(x?.name);
  if (!name) return { error: 'Tên cần 3–12 ký tự: chữ, số hoặc _' };
  if (!Number.isInteger(x.score) || x.score < 0) return { error: 'score must be a non-negative integer' };
  if (!Number.isInteger(x.nights_won) || x.nights_won < 0 || x.nights_won > 3) return { error: 'nights_won must be 0–3' };
  if (!Number.isInteger(x.seed)) return { error: 'seed must be an integer' };
  return { entry: { name, score: x.score, nights_won: x.nights_won, achieved_at: x.achieved_at ?? isoWithTz(), seed: x.seed } };
}
export function addEntry(entries, entry) {
  const all = sortEntries([...entries, entry]);
  return { entries: all, rank: all.indexOf(entry) + 1 || null };
}
export function load(file) {
  try { const d = JSON.parse(readFileSync(file, 'utf8')); return sortEntries(Array.isArray(d.entries) ? d.entries : []); } catch { return []; }
}
export function save(file, entries) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries: sortEntries(entries) }, null, 2) + '\n');
  renameSync(tmp, file); // atomic replace: a crash never leaves a half-written leaderboard
}
