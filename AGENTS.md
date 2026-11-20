# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js, browser) + headless CLI (Node ≥ 18) for the AI SDLC lab. Requirements per phase: `docs/lab/phase-*.txt`.

## Commands
- install: `npm install` · play: `npm start` → http://localhost:5173
- tests: `npm test` (runs the real headless CLI; must stay green)
- evidence: `bash scripts/proof.sh` → `docs/proof/phase-N/`

## Architecture (keep it)
- `src/sim.js` — ALL gameplay rules. Pure + deterministic: no DOM, no `Math.random`, no wall clock. Fixed 1/60 s `step()`.
- `src/headless.js` — Test Contract CLI only (args, validation, JSONL). No rules here.
- `web/main.js` — rendering/input/audio only. Visual-only extras must never touch `sim.js` state.
- `game.contract.json` `tuning` is the single source of numbers; sim reads it via `configure()`. Never hard-code a tuning number elsewhere.

## Rules
- Timers are integer tick counters (float drift bit us). Radius checks use `within(d, r)` (≤ r + 1e-6).
- Events are stamped `tick = k+1` for step k. Coordinates rounded to 3 decimals in output only.
- Malformed scenario/inputs → exit 2. Other errors → exit 1 + stderr.
- New rule ⇒ new test in `tests/` first. Never weaken a test to make it pass; if a phase changes a rule, update the test and note why in `docs/notes/`.
- Record every assumption in `docs/notes/assumptions.md`.
