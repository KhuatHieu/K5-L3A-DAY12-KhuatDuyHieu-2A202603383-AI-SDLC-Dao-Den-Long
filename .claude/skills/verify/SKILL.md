---
name: verify
description: Run the full verification for the current phase (contract tests, headless evidence, determinism, screenshots, FPS) and save evidence under docs/proof/phase-N.
---
1. `npm test` — all must pass. Save: `node --test tests/*.test.js > docs/proof/phase-N/test-report.txt 2>&1`.
2. `bash scripts/proof.sh N` — check each scenario ends as expected and every "determinism night X" line says IDENTICAL.
3. Start a server: `PORT=5179 node server.js &`. Screenshots (look at each image before claiming it works):
   `google-chrome-stable --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=3000 --screenshot=docs/proof/phase-N/<name>.png "http://localhost:5179/?night=2&yaw=60"`
   Helpers: `?night=N` jump into night N, `&lit=k` pre-light k lanterns, `&t=sec` set time left, `&yaw=deg` camera.
4. FPS (needs real GPU): `PORT=5179 node scripts/fps.mjs <night> 15` for nights 1–3 → append to `docs/proof/phase-N/fps.txt`. SwiftShader numbers are NOT representative.
5. Update `docs/proof/phase-N/README.md`: requirement → how verified → evidence → result. Write "chưa đạt" honestly.
6. Kill leftovers by PID (`node server.js & SP=$!; …; kill $SP`). Do NOT use `pkill -f`: it matches the agent's own shell whenever the command text contains the pattern (exit 144, twice).
