#!/bin/sh
# harness/test/stop.sh: tests for harness/stop.js (Stop hook, "done = fresh evidence").
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected '$2', got '$3')"; fi; }

# row <type> <json content>
user()  { printf '{"type":"user","message":{"content":"%s"}}\n' "$1"; }
tool()  { printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"%s","input":%s}]}}\n' "$1" "$2"; }
say()   { printf '{"type":"assistant","message":{"content":[{"type":"text","text":"%s"}]}}\n' "$1"; }
result(){ printf '{"type":"user","message":{"content":[{"type":"tool_result","content":"ok"}]}}\n'; }
run() { # run <name> [extra json fields]; stdout = hook output
  printf '{"transcript_path":"%s/%s.jsonl"%s}' "$TMP" "$1" "${2:-}" | node "$HERE/stop.js"
}
verdict() { out=$(run "$1" "${2:-}"); case "$out" in *'"decision":"block"'*) echo block;; "") echo allow;; *) echo "weird:$out";; esac; }

{ user "fix it"; tool Edit '{"file_path":"/p/src/A.cs"}'; result; say "Bitti."; } > "$TMP/edit_noproof.jsonl"
t "1 code edit, no proof -> block" block "$(verdict edit_noproof)"

{ user "fix it"; tool Edit '{"file_path":"/p/src/A.cs"}'; result; tool Bash '{"command":"dotnet test"}'; result; say "Bitti."; } > "$TMP/edit_proof.jsonl"
t "2 code edit then dotnet test -> allow" allow "$(verdict edit_proof)"

{ user "fix it"; tool Bash '{"command":"dotnet test"}'; result; tool Edit '{"file_path":"/p/src/A.cs"}'; result; say "Bitti."; } > "$TMP/proof_before.jsonl"
t "3 proof BEFORE the last edit is stale -> block" block "$(verdict proof_before)"

{ user "explain"; tool Read '{"file_path":"/p/src/A.cs"}'; result; say "Şöyle çalışıyor."; } > "$TMP/readonly.jsonl"
t "4 read-only turn -> allow" allow "$(verdict readonly)"

{ user "doc"; tool Write '{"file_path":"/p/docs/NOTE.md"}'; result; say "Yazıldı."; } > "$TMP/docsonly.jsonl"
t "5 docs-only edit -> allow" allow "$(verdict docsonly)"

{ user "fix it"; tool Edit '{"file_path":"/p/src/A.cs"}'; result; say "Değiştirdim; doğrulanmadı, test çalıştırmadım."; } > "$TMP/honest.jsonl"
t "6 honest 'not verified' report -> allow" allow "$(verdict honest)"

t "7 stop_hook_active -> allow (no loop)" allow "$(verdict edit_noproof ',"stop_hook_active":true')"

{ user "turn one"; tool Edit '{"file_path":"/p/src/A.cs"}'; result; say "x"; user "turn two"; say "Sadece soru."; } > "$TMP/prev_turn.jsonl"
t "8 edit in an EARLIER turn does not count" allow "$(verdict prev_turn)"

t "9 missing transcript -> allow (fail open)" allow "$(printf '{"transcript_path":"/nope"}' | node "$HERE/stop.js" | sed 's/.*/block/;s/^$/allow/' | grep -q block && echo block || echo allow)"
t "10 garbage stdin -> allow (fail open)" allow "$(printf 'not json' | node "$HERE/stop.js" | grep -q block && echo block || echo allow)"

{ user "fix"; tool Edit '{"file_path":"/p/web/a.tsx"}'; result; tool Bash '{"command":"./harness/bin/check"}'; result; say "Bitti."; } > "$TMP/check.jsonl"
t "11 harness check counts as proof -> allow" allow "$(verdict check)"

echo; if [ "$fail" -eq 0 ]; then echo "STOP HOOK TESTS GREEN: $pass passed, 0 failed"; else echo "STOP HOOK TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
