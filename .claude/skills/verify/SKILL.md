---
name: verify
description: Run the full verification for the current phase (contract tests, headless evidence, determinism, screenshots) and save evidence under docs/proof/phase-N.
---
1. `npm test` — all must pass. Save: `node --test tests/*.test.js > docs/proof/phase-N/test-report.txt 2>&1`.
2. `bash scripts/proof.sh` — check each scenario ends in the expected state (win → won/all_lit, lose_* → lost) and determinism says IDENTICAL.
3. Screenshots (needs a running `PORT=5179 node server.js`):
   `google-chrome-stable --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/phase-N/screenshot-play.png "http://localhost:5179/?play"`
   (`?lit=3` pre-lights lanterns for a visual check.) Look at the image before claiming it works.
4. Update `docs/proof/phase-N/README.md` table: requirement → how verified → evidence → result. Write "chưa đạt" honestly.
