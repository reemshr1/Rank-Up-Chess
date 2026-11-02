#!/bin/bash
# Runs every test (tests/*.test.js) and prints one line each with its number of checks, then the totals.
# Needs Node and Playwright with Chromium (NODE_PATH pointing at them if they're installed globally); db.test.js needs
# Postgres (started here with sql/start-pg.sh) and push-fn.test.js needs Deno and http_ece (see README.md).
# Only some: tests/run.sh coach-today player   (file names without .test.js)
cd "$(dirname "$0")"
[ -x sql/start-pg.sh ] && sql/start-pg.sh >/dev/null 2>&1
pass=0; fail=0; checks=0; start=$(date +%s)
files=$(if [ $# -gt 0 ]; then for a in "$@"; do echo "$a.test.js"; done; else ls *.test.js; fi)
for f in $files; do
  t0=$(date +%s); out=$(timeout 900 node "$f" 2>&1); t=$(( $(date +%s) - t0 ))
  n=$(echo "$out" | grep -c "^PASS"); checks=$((checks+n))
  if echo "$out" | grep -q "ALL PASSED"; then echo "PASS $f ($n checks, ${t}s)"; pass=$((pass+1));
  else echo "FAIL $f ($n passed, ${t}s)"; echo "$out" | grep -E "^FAIL|Error" | head -5 | sed 's/^/     /'; fail=$((fail+1)); fi
done
echo "$pass files passed, $fail failed — $checks checks passed — $(( ($(date +%s) - start) / 60 )) min"
[ $fail -eq 0 ]
