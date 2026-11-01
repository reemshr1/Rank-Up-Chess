#!/bin/bash
# Runs every browser test (tests/*.test.js) and prints one line each, then the total.
# Needs Node and Playwright with Chromium (NODE_PATH pointing at them if they're installed globally).
cd "$(dirname "$0")"
pass=0; fail=0
for f in *.test.js; do
  out=$(timeout 900 node "$f" 2>&1)
  if echo "$out" | grep -q "ALL PASSED"; then echo "PASS $f"; pass=$((pass+1)); else echo "FAIL $f"; echo "$out" | grep -E "^FAIL|Error" | head -5 | sed 's/^/     /'; fail=$((fail+1)); fi
done
echo "$pass passed, $fail failed"
[ $fail -eq 0 ]
