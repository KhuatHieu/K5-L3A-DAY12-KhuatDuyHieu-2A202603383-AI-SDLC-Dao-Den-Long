#!/usr/bin/env bash
# Re-generate headless evidence for the current phase. Usage: bash scripts/proof.sh [phase=2]
set -u
cd "$(dirname "$0")/.."
PH=${1:-2}; D=docs/proof/phase-$PH; S=$D/scenarios; O=$D/out; mkdir -p "$O"
H="node src/headless.js"
run() { # name night seed ticks [scenario] [inputs]
  local a=(--seed "$3" --night "$2" --ticks "$4" --out "$O/$1.jsonl")
  [ -n "${5:-}" ] && a+=(--scenario "$5"); [ -n "${6:-}" ] && a+=(--inputs "$6")
  local s=$(date +%s%N); $H "${a[@]}"; local c=$?; local e=$(date +%s%N)
  echo "$1 (night $2): exit=$c $(( (e-s)/1000000 ))ms | $(tail -n1 "$O/$1.jsonl") | events: $(grep -o '"name":"[a-z_]*"' "$O/$1.jsonl" | cut -d'"' -f4 | sort | uniq -c | tr -s ' ' | tr '\n' ',')"
}
{
echo "# Phase $PH headless evidence ($(date -u +%FT%TZ), node $(node -v))"
if [ "$PH" = 2 ]; then
run n1_win 1 1 600 $S/n1_win.scenario.json $S/n1_win.inputs.json
run n2_pad_drifter 2 1 600 $S/n2_pad_drifter.scenario.json
run n3_ramp_wind 3 1 2400 $S/n3_ramp_wind.scenario.json $S/n3_ramp_wind.inputs.json
run pause_charm 1 1 200 $S/pause_charm.scenario.json $S/pause_charm.inputs.json
for n in 1 2 3; do run full_n${n}_a $n 42 21600; run full_n${n}_b $n 42 21600
  cmp -s "$O/full_n${n}_a.jsonl" "$O/full_n${n}_b.jsonl" && echo "determinism night $n (seed 42): IDENTICAL" || echo "determinism night $n: DIFFERENT (FAIL)"
  rm -f "$O/full_n${n}_b.jsonl"; gzip -f "$O/full_n${n}_a.jsonl"; done
fi
echo '{bad' > "$O/bad.json"; $H --seed 1 --night 1 --ticks 10 --out "$O/x.jsonl" --inputs "$O/bad.json" 2>/dev/null; echo "malformed inputs -> exit $?"
$H --seed 1 --night 2 --ticks 10 --out "$O/x.jsonl" --scenario "$O/bad.json" 2>/dev/null; echo "malformed scenario -> exit $?"
$H --seed 1 --night 4 --ticks 10 --out "$O/x.jsonl" 2>/dev/null; echo "--night 4 -> exit $?"
rm -f "$O/bad.json" "$O/x.jsonl"
} | tee "$D/headless-summary.txt"
