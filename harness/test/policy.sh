#!/bin/sh
# harness/test/policy.sh: tests for harness/policy.js (spec 0004: AC-1 matrix, AC-2 superset, AC-6 header grammar, AC-11 source order).
# The cases live in policy-driver.js; this script builds the temp tree they run on (real symlinks, temp HOME, throwaway key).
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
D="$HERE/test/policy-driver.js"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0

# --- temp tree -------------------------------------------------------------------------------
# ws1: main matrix workspace (has specs/active, no spec file)   ws2: real approvals/, CLAUDE.md -> AGENTS.md
# ws3: no specs/ directory, CLAUDE.md -> docs/x.md              out: files outside every workspace
# home: temp HOME (settings.json -> dotfiles/s.json)            cfg: a CLAUDE_CONFIG_DIR
mkdir -p "$T/out/appr" "$T/home/.claude" "$T/home/dotfiles" "$T/cfg"
W="$T/ws1"
mkdir -p "$W/src" "$W/docs" "$W/specs/active" "$W/plans" "$W/harness/keys" "$W/harness/bin" "$W/harness/test" \
  "$W/.claude/agents" "$W/.claude/worktrees/w1/src" "$W/templates" "$W/evals"
echo x > "$W/CLAUDE.md"; echo '{}' > "$W/.claude/settings.json"; echo x > "$W/harness/gate.js"
echo x > "$W/docs/real.md"; echo x > "$W/src/a.cs"; echo x > "$T/out/o.cs"; echo x > "$T/out/o.md"; echo x > "$T/out/plain.txt"
ln -s ../.claude/settings.json "$W/src/link-settings"
ln -s ../harness/gate.js       "$W/src/gate-link.cs"
ln -s ../harness/keys          "$W/src/lnk-keys"
ln -s ../src                   "$W/docs/lnk-src"
ln -s ../docs                  "$W/src/lnk-docs"
ln -s ../CLAUDE.md             "$W/docs/x.md"
ln -s "$T/out/appr"            "$W/approvals"
ln -s "$T/out/o.cs"            "$W/src/out.cs"
ln -s "$T/out/none.cs"         "$W/src/dangling.cs"
ln -s "$T/out/o.md"            "$W/docs/out.md"
ln -s "$T/out/none.md"         "$W/docs/dangling.md"
ln -s loop                     "$W/src/loop"
ln -s "$W/src/a.cs"            "$T/out/in.cs"
mkdir -p "$T/ws2/approvals" "$T/ws2/specs/active"
echo x > "$T/ws2/AGENTS.md"; ln -s AGENTS.md "$T/ws2/CLAUDE.md"
ln -s "$T/ws2/approvals" "$T/out/l2"
mkdir -p "$T/ws3/docs" "$T/ws3/src" "$T/ws3/.git"
echo x > "$T/ws3/docs/x.md"; echo x > "$T/ws3/src/b.cs"; ln -s docs/x.md "$T/ws3/CLAUDE.md"
echo '{}' > "$T/home/dotfiles/s.json"; ln -s "$T/home/dotfiles/s.json" "$T/home/.claude/settings.json"

# dws: a spec signed with a throwaway key; dws-edited: the same, then edited only in its Unlocks: line
node "$HERE/approval.js" keygen "$T/dkeys" --no-passphrase >/dev/null
for w in dws dws-edited; do
  mkdir -p "$T/$w/specs/active" "$T/$w/src" "$T/$w/docs" "$T/$w/templates" "$T/$w/evals" "$T/$w/harness" "$T/$w/plans" "$T/$w/.claude/agents"
  printf '%s\n' '# Spec 0001' '- Status: Draft' '- Unlocks: `templates/**`, `harness/test/*.sh`, `harness/**`' '' '## 1. Intent' 'x' > "$T/$w/specs/active/0001.md"
  ( cd "$T/$w" && node "$HERE/approval.js" sign specs/active/0001.md approvals "$T/dkeys/ceo.key.pem" </dev/null >/dev/null )
done
printf '%s\n' '# Spec 0001' '- Status: Draft' '- Unlocks: `templates/**`, `harness/test/*.sh`, `harness/**`, `evals/**`' '' '## 1. Intent' 'x' > "$T/dws-edited/specs/active/0001.md"

# --- cases -----------------------------------------------------------------------------------
# suite <name> <driver args...>: prints the driver's lines and counts them; a driver crash is one failure.
suite() {
  name=$1; shift
  out=$(node "$D" "$@" 2>&1); rc=$?
  printf '%s\n' "$out" | grep -E '^FAIL ' || true
  ok=$(printf '%s\n' "$out" | grep -c '^ok ')
  bad=$(printf '%s\n' "$out" | grep -c '^FAIL ')
  pass=$((pass+ok)); fail=$((fail+bad))
  if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then fail=$((fail+1)); echo "FAIL  $name: driver stopped (exit $rc)"; printf '%s\n' "$out" | tail -n 5; fi
  if [ "$ok" -eq 0 ]; then fail=$((fail+1)); echo "FAIL  $name: no case ran"; fi
  echo "ok    $name: $ok cases, $bad failed"
}

# AC-2: the ENFORCEMENT literal is read from guard.js at test time
ENF=$(sed -n 's|^const ENFORCEMENT = /\(.*\)/[a-z]*;[[:space:]]*$|\1|p' "$HERE/guard.js")
if [ -n "$ENF" ]; then pass=$((pass+1)); echo "ok    ENFORCEMENT literal extracted from guard.js"; else fail=$((fail+1)); echo "FAIL  ENFORCEMENT literal not found in guard.js"; fi

suite "AC-1 path-class matrix"                 matrix "$T"
suite "AC-2 superset of the guard expression"  superset "$T" "$ENF"
suite "AC-6 Unlocks: header grammar"           header
suite "decisions, signature, permission modes" decide "$T"
suite "AC-11 source order, no allow"           source

n=$(node "$D" paths "$T" | wc -l | tr -d ' ')
if [ "$n" -ge 100 ]; then pass=$((pass+1)); echo "ok    matrix path list for the consistency loop: $n rows"; else fail=$((fail+1)); echo "FAIL  matrix path list too short ($n rows)"; fi

echo; if [ "$fail" -eq 0 ]; then echo "POLICY TESTS GREEN: $pass passed, 0 failed"; else echo "POLICY TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
