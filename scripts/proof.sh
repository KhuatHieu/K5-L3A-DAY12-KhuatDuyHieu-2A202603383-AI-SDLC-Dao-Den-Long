#!/usr/bin/env bash
# Re-generate Phase 1 headless evidence. Usage: bash scripts/proof.sh
set -u
cd "$(dirname "$0")/.."
D=docs/proof/phase-1; S=$D/scenarios; O=$D/out; mkdir -p "$O"
H="node src/headless.js"
run() { # name seed ticks [scenario] [inputs]
  local a=(--seed "$2" --night 1 --ticks "$3" --out "$O/$1.jsonl")
  [ -n "${4:-}" ] && a+=(--scenario "$4"); [ -n "${5:-}" ] && a+=(--inputs "$5")
  $H "${a[@]}"; echo "$1: exit=$? | $(tail -n1 "$O/$1.jsonl") | events: $(grep -o '"name":"[a-z_]*"' "$O/$1.jsonl" | cut -d'"' -f4 | sort | uniq -c | tr -s ' ' | tr '\n' ',')"
}
{
echo "# Phase 1 headless evidence ($(date -u +%FT%TZ), node $(node -v))"
run win 1 600 $S/win.scenario.json $S/win.inputs.json
run lose_no_flames 1 3000 $S/lose_no_flames.scenario.json
run lose_dawn 1 600 $S/lose_dawn.scenario.json
run pulse 1 120 $S/pulse.scenario.json $S/pulse.inputs.json
run full_default_a 42 18000 "" $S/full_default.inputs.json
run full_default_b 42 18000 "" $S/full_default.inputs.json
if cmp -s "$O/full_default_a.jsonl" "$O/full_default_b.jsonl"; then echo "determinism (seed 42, 2 runs): IDENTICAL sha256=$(sha256sum "$O/full_default_a.jsonl" | cut -c1-16)"; else echo "determinism: DIFFERENT (FAIL)"; fi
echo '{bad' > "$O/bad.json"; $H --seed 1 --night 1 --ticks 10 --out "$O/x.jsonl" --inputs "$O/bad.json" 2>/dev/null; echo "malformed inputs -> exit $?"
$H --seed 1 --night 1 --ticks 10 --out "$O/x.jsonl" --scenario "$O/bad.json" 2>/dev/null; echo "malformed scenario -> exit $?"
$H --night 1 --out "$O/x.jsonl" 2>/dev/null; echo "missing --ticks -> exit $?"
rm -f "$O/bad.json" "$O/x.jsonl"
s=$(date +%s%N); $H --seed 7 --night 1 --ticks 18000 --out "$O/perf.jsonl"; e=$(date +%s%N)
echo "perf: default game up to 18000 ticks in $(( (e-s)/1000000 )) ms ($(tail -n1 "$O/perf.jsonl"))"; rm -f "$O/perf.jsonl"
} | tee "$D/headless-summary.txt"
