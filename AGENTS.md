# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js, browser) + headless CLI (Node ≥ 18) for the AI SDLC lab. Requirements per phase: `docs/lab/` (PRD-0, Ticket-02…). Current contract: **v1.1** (3 nights).

## Commands
- install: `npm install` · play: `npm start` → http://localhost:5173 (`?night=N` jumps into a night)
- tests: `npm test` (runs the real headless CLI; must stay green — Stop hook enforces it)
- evidence: `bash scripts/proof.sh <phase>` → `docs/proof/phase-N/` · FPS: `node scripts/fps.mjs <night> <sec>` (server running)

## Architecture (keep it)
- `src/sim.js` — ALL gameplay rules. Pure + deterministic: no DOM, no `Math.random`, no wall clock. One `step()` = 1/60 s, following Ticket-02's numbered tick order (comments 1–11). Maps in `NIGHTS`, fixed ticket numbers in `STD`.
- `src/headless.js` — Test Contract CLI only (args, validation, JSONL). No rules here.
- `web/main.js` — rendering/input/audio/menus only. Visual-only extras must never touch sim state.
- Contract numbers live in `game.contract.json` `tuning` (read via `configure()`); never duplicate them.

## Rules
- Timers are integer tick counters, decremented at step start (step 2). Radius checks use `within(d, r)` (≤ r + 1e-6).
- Events are stamped `tick = k+1` for step k. Output coordinates rounded to 3 decimals only at snapshot time.
- Malformed scenario/inputs → exit 2. Other errors → exit 1 + stderr.
- New rule ⇒ new headless test first. Never weaken a test to make it pass; if a ticket changes a rule, change the test and log why in `docs/notes/ai-log.md`.
- Every ambiguity → a row in `docs/notes/assumptions.md`. Every new feature → acceptance criteria in `docs/notes/spec-phase-N.md`.
- Before claiming UI works: take a screenshot (see `.claude/skills/verify`) and look at it.
