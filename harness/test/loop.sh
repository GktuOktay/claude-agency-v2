#!/bin/sh
# harness/test/loop.sh: tests for loop.js (no network, state in a temp dir).
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export COMPANY_LOOP_DIR="$T"
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected $2, got $3)"; fi; }
# call <session> <tool> <command>  ->  exit code of the hook
call() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],tool_name:process.argv[2],tool_input:{command:process.argv[3]}}))' "$1" "$2" "$3" | node "$HERE/loop.js" >/dev/null 2>&1; echo $?; }
seq_rc() { s=$1; shift; last=0; for c in "$@"; do last=$(call "$s" Bash "$c"); done; echo "$last"; }

t "a different call each time is never blocked"      0 "$(seq_rc s1 a b c d e f g h)"
t "4 identical calls pass"                           0 "$(seq_rc s2 x x x x)"
t "the 5th identical call in a row is blocked"       2 "$(seq_rc s3 x x x x x)"
t "a different call in between resets the streak"    0 "$(seq_rc s4 x x x x y x x x x)"
t "A,B,A,B,A,B cycle is blocked"                     2 "$(seq_rc s5 a b a b a b)"
t "A,B,C,A,B,C,A,B,C cycle is blocked"               2 "$(seq_rc s6 a b c a b c a b c)"
t "A,B,A,B,A (not yet 3 rounds) passes"              0 "$(seq_rc s7 a b a b a)"
t "sessions are independent"                         0 "$(seq_rc s8 x x x x >/dev/null; seq_rc s9 x)"
t "same command, different tool is a different call" 0 "$( s=s10; call $s Bash x >/dev/null; call $s Read x >/dev/null; call $s Bash x >/dev/null; call $s Read x >/dev/null; call $s Bash x )"
t "plan/task bookkeeping tools are exempt"           0 "$( s=s11; r=0; for i in 1 2 3 4 5 6 7 8; do r=$(call $s mcp__ccd_turn__update_plan same); done; echo $r )"
t "COMPANY_LOOP_MAX=0 turns the hook off"            0 "$( export COMPANY_LOOP_MAX=0; r=0; for i in 1 2 3 4 5 6 7 8; do r=$(call s12 Bash x); done; echo $r )"
t "COMPANY_LOOP_MAX=2 tightens the threshold"        2 "$( export COMPANY_LOOP_MAX=2; call s13 Bash x >/dev/null; call s13 Bash x )"
t "garbage input fails open"                         0 "$(printf 'not json' | node "$HERE/loop.js" >/dev/null 2>&1; echo $?)"
t "unwritable state dir still fails open"            0 "$(COMPANY_LOOP_DIR=/nonexistent/dir sh -c 'node -e "process.stdout.write(JSON.stringify({session_id:\"a\",tool_name:\"Bash\",tool_input:{command:\"x\"}}))" | node "'"$HERE"'/loop.js" >/dev/null 2>&1; echo $?')"
t "message tells the agent what to do"              1 "$( s=s14; seq_rc $s x x x x >/dev/null; node -e 'process.stdout.write(JSON.stringify({session_id:"s14",tool_name:"Bash",tool_input:{command:"x"}}))' | node "$HERE/loop.js" 2>&1 >/dev/null | grep -c 'dur, STATE.md' )"
t "input key order does not matter"                  2 "$( s=s15; r=0; for i in 1 2 3 4 5; do if [ $((i%2)) = 0 ]; then j='{"a":1,"b":2}'; else j='{"b":2,"a":1}'; fi; r=$(printf '{"session_id":"s15","tool_name":"Write","tool_input":%s}' "$j" | node "$HERE/loop.js" >/dev/null 2>&1; echo $?); done; echo $r )"

echo; if [ "$fail" -eq 0 ]; then echo "LOOP GUARD TESTS GREEN: $pass passed, 0 failed"; else echo "LOOP GUARD TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
