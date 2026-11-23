#!/bin/sh
# harness/test/host-gate.sh: tests for `gate.js --host` (spec 0004: AC-3 file tools, AC-4 root and identity, AC-10 gate part).
# Runs a temp copy of the harness *.js that holds a throwaway public key: host mode ignores COMPANY_PUBKEY (REQ-15),
# so the repository's gate would read the real CEO public key. The real key and ~/.company are never touched.
#   sh host-gate.sh           run the cases
#   sh host-gate.sh --bench   200 calls, print the p95 latency per call (AC-15; not run by check)
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
T=$(CDPATH= cd -- "$T" && pwd -P)          # physical path: reasons and roots are compared as text
pass=0; fail=0
t() { # t <name> <expected> <actual>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected $2, got $3)"; fi
}

# --- temp harness copy with a throwaway key (non-git directory) -------------------------------
H="$T/h/harness"; mkdir -p "$H/keys"
cp "$HERE"/*.js "$H/"
node "$HERE/approval.js" keygen "$T/k1" --no-passphrase >/dev/null
node "$HERE/approval.js" keygen "$T/k2" --no-passphrase >/dev/null
cp "$T/k1/ceo.pub.pem" "$H/keys/ceo.pub.pem"
KEY="$T/k1/ceo.key.pem"; KEY2="$T/k2/ceo.key.pem"; PUB2="$T/k2/ceo.pub.pem"
TH="$T/home"; mkdir -p "$TH"
NODEBIN=$(dirname "$(command -v node)")

# ev <tool> <file_path|-> <cwd> [permission_mode|-]   the hook event as JSON ("-" leaves the field out)
ev() {
  node -e 'const [tool, fp, cwd, mode] = process.argv.slice(1);
    const e = { hook_event_name: "PreToolUse", tool_name: tool, cwd, tool_input: {} };
    if (fp !== "-") e.tool_input[tool === "NotebookEdit" ? "notebook_path" : "file_path"] = fp;
    if (mode && mode !== "-") e.permission_mode = mode;
    process.stdout.write(JSON.stringify(e));' "$1" "$2" "$3" "${4:--}"
}
# call: reads the event on stdin; env: GATE (entry file), PROJ (CLAUDE_PROJECT_DIR, "-" = unset), GPATH (PATH), XENV (extra VAR=value words).
# Prints deny | ask | none | error; leaves stdout in $T/last.out, stderr in $T/last.err, and appends stdout to $T/all.out.
call() {
  set -- env -u COMPANY_PUBKEY -u COMPANY_SPEC -u COMPANY_HARNESS_DIR
  if [ "${PROJ--}" = "-" ]; then set -- "$@" -u CLAUDE_PROJECT_DIR; else set -- "$@" CLAUDE_PROJECT_DIR="$PROJ"; fi
  # shellcheck disable=SC2086
  "$@" HOME="$TH" PATH="${GPATH:-$PATH}" ${XENV:-} node "${GATE:-$H/gate.js}" --host >"$T/last.out" 2>"$T/last.err"
  rc=$?
  cat "$T/last.out" >> "$T/all.out"
  if [ "$rc" = 2 ]; then echo deny; return; fi
  if [ "$rc" != 0 ]; then echo "error(rc=$rc)"; return; fi
  if [ ! -s "$T/last.out" ]; then echo none; return; fi
  if grep -q '"permissionDecision":"ask"' "$T/last.out"; then echo ask; else echo error; fi
}
# g <project dir|-> <tool> <file_path> [mode] [cwd]   cwd defaults to the project dir
g() { ev "$2" "$3" "${5:-$1}" "${4:--}" | PROJ="$1" call; }
reason() { node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).hookSpecificOutput.permissionDecisionReason)' "$T/last.out" 2>/dev/null; }
has() { if reason | grep -qF -- "$1"; then echo yes; else echo no; fi; }       # the dialog text holds <text>
errhas() { if grep -qF -- "$1" "$T/last.err"; then echo yes; else echo no; fi; } # the refusal text holds <text>
sign() { ( cd "$1" && node "$H/approval.js" sign "specs/active/$2" approvals "${3:-$KEY}" >/dev/null 2>&1 ); }

if [ "${1:-}" = "--bench" ]; then
  B="$T/bench"; mkdir -p "$B/specs/active" "$B/src"; printf '# Spec b\n\n## 1\n' > "$B/specs/active/0001.md"
  ev Write "$B/src/a.cs" "$B" default > "$T/bench.json"
  node -e 'const { spawnSync } = require("child_process"); const fs = require("fs");
    const [gate, evf, proj] = process.argv.slice(1); const input = fs.readFileSync(evf); const ms = [];
    for (let i = 0; i < 200; i++) {
      const t0 = process.hrtime.bigint();
      const r = spawnSync(process.execPath, [gate, "--host"], { input, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: proj }) });
      ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
      if (r.status !== 0) { console.error("bench: unexpected exit " + r.status); process.exit(1); }
    }
    ms.sort((a, b) => a - b);
    console.log("host gate bench: 200 calls, p50 " + ms[99].toFixed(1) + " ms, p95 " + ms[189].toFixed(1) + " ms per call (target < 150 ms)");' "$H/gate.js" "$T/bench.json" "$B"
  exit $?
fi

# --- workspaces --------------------------------------------------------------------------------
# W: one active spec, Unlocks: templates/**; signed below      WU: one active spec, never signed
# W0: specs/active without a spec file                        WX: signed, Unlocks: .claude/**, harness/**
# F: no specs/ directory (as guard.sh uses)
mk() { mkdir -p "$1/specs/active" "$1/approvals" "$1/src" "$1/docs" "$1/plans" "$1/templates" "$1/evals" "$1/harness/bin" "$1/.claude/agents"; }
W="$T/w"; WU="$T/wu"; W0="$T/w0"; WX="$T/wx"; F="$T/f"
mk "$W"; mk "$WU"; mk "$W0"; mk "$WX"; mkdir -p "$F/src" "$F/harness/test" "$F/.claude/skills/scouting" "$F/docs" "$F/approvals" "$F/.github/workflows"
printf '# Spec 0001\n- Status: active\n- Unlocks: `templates/**`\n\n## 1\nAC-1: hello\n' > "$W/specs/active/0001.md"
printf '# Spec 0001\n\n## 1\nAC-1: hello\n' > "$WU/specs/active/0001.md"
printf '# Spec 0001\n- Unlocks: .claude/**, harness/**\n\n## 1\n' > "$WX/specs/active/0001.md"

# --- AC-3: file tools ----------------------------------------------------------------------------
t "AC-3 no active spec: code write asks"                      ask  "$(g "$W0" Write "$W0/src/a.cs")"
t "AC-3 no active spec: reason quotes the relative path"      yes  "$(has '"src/a.cs"')"
t "AC-3 no active spec: reason names the class"               yes  "$(has '(code)')"
t "AC-3 no active spec: reason holds the count 0"             yes  "$(has 'bulunan: 0')"
t "AC-3 no active spec: dialog text starts as the protocol says" yes "$(has 'CEO onayı gerekir: ')"
t "AC-3 no active spec: hook event name is PreToolUse"        0    "$(grep -q '"hookEventName":"PreToolUse"' "$T/last.out"; echo $?)"
t "AC-3 unsigned spec: code write asks"                       ask  "$(g "$W" Write "$W/src/a.cs")"
t "AC-3 unsigned spec: Edit asks"                             ask  "$(g "$W" Edit "$W/src/a.cs")"
t "AC-3 unsigned spec: MultiEdit asks"                        ask  "$(g "$W" MultiEdit "$W/src/a.cs")"
t "AC-3 unsigned spec: NotebookEdit (notebook_path) asks"     ask  "$(g "$W" NotebookEdit "$W/src/n.ipynb")"
t "AC-3 unsigned spec: listed product-config still asks"      ask  "$(g "$W" Write "$W/templates/x.md")"
t "AC-3 another tool (Read) gets no opinion"                  none "$(g "$W" Read "$W/src/a.cs")"
t "AC-3 another tool (Bash) gets no opinion"                  none "$(g "$W" Bash "$W/src/a.cs")"
sign "$W" 0001.md
t "AC-3 signed: code write has no output"                     none "$(g "$W" Write "$W/src/a.cs")"
t "AC-3 signed: product-config listed in Unlocks: no output"  none "$(g "$W" Write "$W/templates/x.md")"
t "AC-3 signed: product-config not listed asks"               ask  "$(g "$W" Write "$W/evals/x.md")"
t "AC-3 signed: that reason names Unlocks"                    yes  "$(has 'Unlocks:')"
t "AC-3 signed: that reason names the class"                  yes  "$(has '(product-config)')"
t "AC-3 signed: harness/bin/check not listed asks"            ask  "$(g "$W" Edit "$W/harness/bin/check")"
t "AC-3 signed: .claude/agents not listed asks"               ask  "$(g "$W" Edit "$W/.claude/agents/x.md")"
echo "AC-2: sneaky" >> "$W/specs/active/0001.md"
t "AC-3 spec edited after signing: code write asks"           ask  "$(g "$W" Write "$W/src/a.cs")"
t "AC-3 spec edited after signing: listed product-config asks" ask "$(g "$W" Write "$W/templates/x.md")"
sed -i.bak '$d' "$W/specs/active/0001.md"; rm -f "$W/specs/active/0001.md.bak"
t "AC-3 spec restored: no output again"                       none "$(g "$W" Write "$W/src/a.cs")"
cp "$W/specs/active/0001.md" "$W/specs/active/0002.md"
t "AC-3 two active specs: code write asks"                    ask  "$(g "$W" Write "$W/src/a.cs")"
t "AC-3 two active specs: reason holds the count 2"           yes  "$(has 'bulunan: 2')"
rm -f "$W/specs/active/0002.md"
sign "$WX" 0001.md
t "AC-3 signed, Unlocks .claude/**, harness/**: code allowed (signature is valid)" none "$(g "$WX" Write "$WX/src/a.cs")"
t "AC-3 that spec: .claude/settings.json still asks"          ask  "$(g "$WX" Edit "$WX/.claude/settings.json")"
t "AC-3 that spec: the reason names the enforcement class"    yes  "$(has '(enforcement)')"
t "AC-3 that spec: harness/gate.js still asks"                ask  "$(g "$WX" Write "$WX/harness/gate.js")"
t "AC-3 that spec: harness/bin/check is unlocked (row 4)"     none "$(g "$WX" Write "$WX/harness/bin/check")"
t "AC-3 approvals/x is refused"                               deny "$(g "$W" Write "$W/approvals/x")"
t "AC-3 approvals/x: refusal carries the gate prefix"         yes  "$(errhas 'BLOCKED by company gate: ')"
t "AC-3 .git/config is refused"                               deny "$(g "$W" Edit "$W/.git/config")"
t "AC-3 unsigned: specs/x.md has no output"                   none "$(g "$WU" Write "$WU/specs/x.md")"
t "AC-3 unsigned: docs/x.md has no output"                    none "$(g "$WU" Write "$WU/docs/x.md")"
t "AC-3 unsigned: plans/x.md has no output"                   none "$(g "$WU" Write "$WU/plans/x.md")"
t "AC-3 unsigned: STATE.md has no output"                     none "$(g "$WU" Write "$WU/STATE.md")"
t "AC-3 /etc/hosts (outside) has no output"                   none "$(g "$WU" Write /etc/hosts)"
t "AC-3 no specs/: src/a.cs has no output"                    none "$(g "$F" Write "$F/src/a.cs")"
t "AC-3 no specs/: CLAUDE.md asks"                            ask  "$(g "$F" Write "$F/CLAUDE.md")"
t "AC-3 missing file_path is refused"                         deny "$(g "$WU" Write -)"
t "AC-3 empty file_path is refused"                           deny "$(g "$WU" Write "")"
t "AC-3 unreadable input is refused"                          deny "$(printf 'not json' | PROJ="$WU" call)"
t "AC-3 unreadable input: fail-closed text"                   yes  "$(errhas 'fail closed')"
t "AC-3 empty input is refused"                               deny "$(: | PROJ="$WU" call)"
NL=$(printf 'src/a\nOK imzalı.cs')
t "AC-3 newline in file_path asks"                            ask  "$(g "$WU" Write "$NL")"
t "AC-3 newline: reason holds the path as a JSON string literal" yes "$(has '"src/a\nOK imzalı.cs"')"
t "AC-3 newline: no raw newline in the reason"                0    "$(reason | wc -l | tr -d ' ')"
# replay of the file-tool paths of guard.sh:105-116, workspace without specs/
t "AC-3 replay: Edit harness/guard.js asks"                   ask  "$(g "$F" Edit "$F/harness/guard.js")"
t "AC-3 replay: Edit harness/loop.js asks"                    ask  "$(g "$F" Edit "$F/harness/loop.js")"
t "AC-3 replay: Write harness/gate.js asks"                   ask  "$(g "$F" Write "$F/harness/gate.js")"
t "AC-3 replay: Edit .claude/settings.json asks"              ask  "$(g "$F" Edit "$F/.claude/settings.json")"
t "AC-3 replay: Edit harness/container-settings.json asks"    ask  "$(g "$F" Edit "$F/harness/container-settings.json")"
t "AC-3 replay: Write CLAUDE.md asks"                         ask  "$(g "$F" Write "$F/CLAUDE.md")"
t "AC-3 replay: Edit a CI workflow asks"                      ask  "$(g "$F" Edit "$F/.github/workflows/check.yml")"
t "AC-3 replay: relative harness/guard.js (against cwd) asks" ask  "$(g "$F" Edit harness/guard.js)"
t "AC-3 replay: Write approvals/0001.sig is refused (row 1)"  deny "$(g "$F" Write "$F/approvals/0001.sig")"
t "AC-3 replay: Edit a skill has no output"                   none "$(g "$F" Edit "$F/.claude/skills/scouting/SKILL.md")"
t "AC-3 replay: Edit a test script has no output"             none "$(g "$F" Edit "$F/harness/test/guard.sh")"
t "AC-3 replay: Write a doc has no output"                    none "$(g "$F" Write "$F/docs/KARARLAR.md")"

# --- AC-4: root and identity ---------------------------------------------------------------------
t "AC-4 project dir set, cwd a subdirectory: unsigned spec is found (ask)"  ask  "$(g "$WU" Write a.cs - "$WU/src")"
t "AC-4 that reason names the path relative to the project dir"             yes  "$(has '"src/a.cs"')"
t "AC-4 project dir set, cwd a subdirectory: record is found (no output)"   none "$(g "$W" Write a.cs - "$W/src")"
t "AC-4 no project dir: the root is cwd (ask)"                              ask  "$(g - Write "$WU/src/a.cs" - "$WU")"
t "AC-4 empty project dir: the root is cwd (ask)"                           ask  "$(ev Write "$WU/src/a.cs" "$WU" | PROJ="" call)"
t "AC-4 no project dir, cwd a subdirectory without specs/: no opinion"      none "$(g - Write "$WU/src/a.cs" - "$WU/src")"
# linked worktree: records and the main-root rule
tgit() { env HOME="$TH" GIT_CONFIG_NOSYSTEM=1 git "$@"; }
M="$T/main"; LW="$T/lw"; mkdir -p "$M/specs/active" "$M/src" "$M/docs" "$M/.claude/agents"
printf '# Spec 0003\n\n## 1\nAC-1: hello\n' > "$M/specs/active/0003.md"; echo x > "$M/src/keep.cs"
tgit -C "$M" init -q >/dev/null 2>&1
tgit -C "$M" add specs src >/dev/null 2>&1
tgit -C "$M" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -qm init >/dev/null 2>&1
tgit -C "$M" worktree add -q "$LW" -b lw >/dev/null 2>&1
mkdir -p "$LW/approvals"
t "AC-4 setup: the linked worktree has the spec"                  0    "$([ -f "$LW/specs/active/0003.md" ]; echo $?)"
t "AC-4 linked worktree, no record: code write asks"              ask  "$(g "$LW" Write "$LW/src/a.cs")"
t "AC-4 main-root rule: <main>/src/x.cs asks (not outside)"       ask  "$(g "$LW" Write "$M/src/x.cs")"
t "AC-4 main-root rule: the reason names the main root"           yes  "$(has "$M")"
t "AC-4 main-root rule: the reason names the relative path"       yes  "$(has '"src/x.cs"')"
t "AC-4 main-root rule: <main>/.claude/agents/x.md asks"          ask  "$(g "$LW" Write "$M/.claude/agents/x.md")"
t "AC-4 main-root rule: <main>/CLAUDE.md asks"                    ask  "$(g "$LW" Write "$M/CLAUDE.md")"
t "AC-4 main-root rule: <main>/docs/x.md has no output"           none "$(g "$LW" Write "$M/docs/x.md")"
t "AC-4 main-root rule: classify reports the main root three times" 0  "$(env HOME="$TH" node -e 'const [h, lw, m] = process.argv.slice(1); const p = require(h + "/policy.js");
    const ctx = p.context({ cwd: lw }, { mode: "host", env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: lw }), harnessDir: h });
    const c = p.classify(m + "/src/x.cs", ctx);
    process.exit(c.label === "code" && c.root === m && c.lexical.root === m && c.resolved.root === m ? 0 : 1);' "$H" "$LW" "$M" 2>/dev/null; echo $?)"
sign "$M" 0003.md
t "AC-4 setup: the record is in the main worktree only"           0    "$([ -f "$M/approvals/specs__active__0003.md.sig.json" ] && [ -z "$(ls "$LW/approvals")" ]; echo $?)"
t "AC-4 linked worktree, record in the main worktree: allowed"    none "$(g "$LW" Write "$LW/src/a.cs")"
t "AC-4 main-root rule: valid record, <main>/src/x.cs no output"  none "$(g "$LW" Write "$M/src/x.cs")"
# test variables are ignored on the host (REQ-15)
WK="$T/wk"; mk "$WK"; printf '# Spec 0001\n\n## 1\n' > "$WK/specs/active/0001.md"; sign "$WK" 0001.md "$KEY2"
cgate() { ev Write "$2" "$1" | env -u CLAUDE_PROJECT_DIR ${3:-} node "$H/gate.js" >/dev/null 2>&1; echo $?; }   # container mode, for contrast
t "AC-4 contrast: container mode honours COMPANY_PUBKEY"          0    "$(cgate "$WK" "$WK/src/a.cs" "COMPANY_PUBKEY=$PUB2")"
t "AC-4 host: COMPANY_PUBKEY is ignored (still ask)"              ask  "$(ev Write "$WK/src/a.cs" "$WK" | PROJ="$WK" XENV="COMPANY_PUBKEY=$PUB2" call)"
t "AC-4 host: COMPANY_HARNESS_DIR is ignored (still ask)"         ask  "$(ev Write "$WK/src/a.cs" "$WK" | PROJ="$WK" XENV="COMPANY_HARNESS_DIR=$T/k2h" call)"
WS2="$T/ws2"; mk "$WS2"; printf '# Spec 0001\n\n## 1\n' > "$WS2/specs/active/0001.md"; sign "$WS2" 0001.md; printf '# Spec 0002\n' > "$WS2/specs/active/0002.md"
t "AC-4 contrast: container mode honours COMPANY_SPEC"            0    "$(cgate "$WS2" "$WS2/src/a.cs" "COMPANY_SPEC=0001.md")"
t "AC-4 host: COMPANY_SPEC is ignored (two specs, ask)"           ask  "$(ev Write "$WS2/src/a.cs" "$WS2" | PROJ="$WS2" XENV="COMPANY_SPEC=0001.md" call)"
t "AC-4 host: COMPANY_SPEC ignored, reason holds the count 2"     yes  "$(has 'bulunan: 2')"
# git made to fail (PATH stub)
mkdir -p "$T/stub"; printf '#!/bin/sh\nexit 1\n' > "$T/stub/git"; chmod +x "$T/stub/git"
SP="$T/stub:$NODEBIN:/usr/bin:/bin"
mkdir -p "$M/templates"
t "AC-4 git fails, root with .git: code write is refused"         deny "$(ev Write "$M/src/a.cs" "$M" | PROJ="$M" GPATH="$SP" call)"
t "AC-4 git fails: the text says git lookup failed"               yes  "$(errhas 'git lookup failed (fail closed)')"
t "AC-4 git fails: product-config write is refused"               deny "$(ev Write "$M/templates/x.md" "$M" | PROJ="$M" GPATH="$SP" call)"
t "AC-4 git fails: that text says git lookup failed"              yes  "$(errhas 'git lookup failed')"
t "AC-4 git fails: docs/x.md has no output"                       none "$(ev Write "$M/docs/x.md" "$M" | PROJ="$M" GPATH="$SP" call)"
t "AC-4 git works again: the same code write is allowed"          none "$(g "$M" Write "$M/src/a.cs")"
F2="$T/f2"; mkdir -p "$F2/.git" "$F2/src"
t "AC-4 git fails, root without specs/: src/a.cs no output"       none "$(ev Write "$F2/src/a.cs" "$F2" | PROJ="$F2" GPATH="$SP" call)"
H2="$T/h2/harness"; mkdir -p "$H2/keys" "$T/h2/.git"; cp "$H"/*.js "$H2/"; cp "$H/keys/ceo.pub.pem" "$H2/keys/"
t "AC-4 harness copy with .git, git fails: code write is refused" deny "$(ev Write "$W/src/a.cs" "$W" | PROJ="$W" GPATH="$SP" GATE="$H2/gate.js" call)"
t "AC-4 that text says harness key lookup failed"                 yes  "$(errhas 'harness key lookup failed (fail closed)')"
t "AC-4 that harness copy: docs/x.md still has no output"         none "$(ev Write "$W/docs/x.md" "$W" | PROJ="$W" GPATH="$SP" GATE="$H2/gate.js" call)"

# --- AC-10: permission modes (gate part) -------------------------------------------------------
# The proven set is policy.ASK_MODES (T-1 record, docs/kanit/0004-t1.md); every other reported mode refuses.
ASKM=$(node -e 'process.stdout.write(require(process.argv[1]).ASK_MODES.join(" "))' "$H/policy.js")
inask() { case " $ASKM " in *" $1 "*) echo yes;; *) echo no;; esac; }
t "AC-10 ASK_MODES holds default"                                 yes  "$(inask default)"
t "AC-10 mode default: ask"                                       ask  "$(g "$WU" Write "$WU/src/a.cs" default)"
t "AC-10 mode absent: ask"                                        ask  "$(g "$WU" Write "$WU/src/a.cs" -)"
for m in $ASKM; do
  t "AC-10 mode $m (ASK_MODES): ask"                              ask  "$(g "$WU" Write "$WU/src/a.cs" "$m")"
  t "AC-10 mode $m (ASK_MODES): enforcement ask"                  ask  "$(g "$WU" Write "$WU/CLAUDE.md" "$m")"
done
for m in plan acceptEdits auto bypassPermissions somethingNew; do
  if [ "$(inask "$m")" = yes ]; then continue; fi                 # a mode proven in T-1 leaves the deny list
  t "AC-10 mode $m: code ask becomes a refusal"                   deny "$(g "$WU" Write "$WU/src/a.cs" "$m")"
  t "AC-10 mode $m: the text names the mode"                      yes  "$(errhas "permission mode '$m'")"
  t "AC-10 mode $m: the text names the ways forward"              yes  "$(errhas 'switch to default mode or sign a spec')"
  t "AC-10 mode $m: enforcement ask becomes a refusal"            deny "$(g "$WU" Write "$WU/CLAUDE.md" "$m")"
  t "AC-10 mode $m: unlisted product-config becomes a refusal"    deny "$(g "$W" Write "$W/evals/x.md" "$m")"
done
t "AC-10 mode auto: the refusal is the exact text of 7.7"         0    "$(g "$WU" Write "$WU/src/a.cs" auto >/dev/null; printf '%s\n' "BLOCKED by company gate: the edit of \"src/a.cs\" needs the CEO's dialog, but permission mode 'auto' is not proven to show it. Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement: such a spec whose Unlocks: names the exact path, file tools only; signatures, keys, .git: no spec covers them, default mode only)." | cmp -s - "$T/last.err"; echo $?)"
for m in default plan acceptEdits auto bypassPermissions somethingNew; do
  t "AC-10 mode $m: free path unchanged (no output)"              none "$(g "$WU" Write "$WU/docs/x.md" "$m")"
  t "AC-10 mode $m: signed code unchanged (no output)"            none "$(g "$W" Write "$W/src/a.cs" "$m")"
  t "AC-10 mode $m: listed product-config unchanged (no output)"  none "$(g "$W" Write "$W/templates/x.md" "$m")"
  t "AC-10 mode $m: outside unchanged (no output)"                none "$(g "$WU" Write /etc/hosts "$m")"
  t "AC-10 mode $m: no specs/ unchanged (no output)"              none "$(g "$F" Write "$F/src/a.cs" "$m")"
  t "AC-10 mode $m: hard-deny stays a refusal"                    deny "$(g "$WU" Write "$WU/approvals/x" "$m")"
done
# recorded payload shape (T-1 fixture: subagent, permission_mode auto, agent_type set)
FX="$HERE/test/fixtures/pretooluse-subagent.json"
t "AC-10 fixture as recorded (scratch path, outside): no output"  none "$(PROJ="$WU" call < "$FX")"
t "AC-10 fixture aimed at a code path: refused, mode auto named"  deny "$(node -e 'const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); e.cwd = process.argv[2]; e.tool_input.file_path = process.argv[2] + "/src/a.cs"; process.stdout.write(JSON.stringify(e));' "$FX" "$WU" | PROJ="$WU" call)"
t "AC-10 fixture: the text names the mode"                        yes  "$(errhas "permission mode 'auto'")"

# --- AC-16: literal enforcement entries (delta 2026-11-22; REQ-8, REQ-20, §7.3) -----------------
# "an exact path may open an enforcement file, a glob never does". New helpers only; the ones above are not edited.
# gx <project dir> <tool> <file_path> [mode|-] [agent_type|-]   as g, with the caller's agent_type in the event
gx() {
  node -e 'const [tool, fp, cwd, mode, agent] = process.argv.slice(1);
    const e = { hook_event_name: "PreToolUse", tool_name: tool, cwd, tool_input: {} };
    e.tool_input[tool === "NotebookEdit" ? "notebook_path" : "file_path"] = fp;
    if (mode !== "-") e.permission_mode = mode;
    if (agent !== "-") e.agent_type = agent;
    process.stdout.write(JSON.stringify(e));' "$2" "$3" "$1" "${4:--}" "${5:--}" | PROJ="$1" call
}
# lws <dir> <Unlocks value>: a workspace with one active spec that carries that Unlocks: line (unsigned)
lws() { mk "$1"; printf '%s\n' '# Spec 0001' '- Status: active' "- Unlocks: $2" '' '## 1' 'AC-1: hello' > "$1/specs/active/0001.md"; }
PATHTEXT() { printf '%s\n' "BLOCKED by company gate: the edit of \"$1\" needs the CEO's dialog, but permission mode 'auto' is not proven to show it. Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement: such a spec whose Unlocks: names the exact path, file tools only; signatures, keys, .git: no spec covers them, default mode only)."; }
# WL: a git repository (its nested roots w2 and w3 are linked worktrees, so their records come from WL/approvals)
WL="$T/wl"
lws "$WL" 'CLAUDE.md, harness/gate.js, templates/**, harness/keys/k.pem, approvals/x.json, src/approvals/y.json, .git/config'
echo x > "$WL/CLAUDE.md"; echo x > "$WL/src/keep.cs"
tgit -C "$WL" init -q >/dev/null 2>&1
tgit -C "$WL" add specs src >/dev/null 2>&1
tgit -C "$WL" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -qm init >/dev/null 2>&1
t "AC-16 unsigned: named CLAUDE.md asks"                           ask  "$(g "$WL" Write "$WL/CLAUDE.md")"
t "AC-16 unsigned: the reason keeps the enforcement label"         yes  "$(has '(enforcement)')"
t "AC-16 unsigned: named harness/gate.js asks"                     ask  "$(g "$WL" Edit "$WL/harness/gate.js")"
sign "$WL" 0001.md
t "AC-16 setup: WL has a record"                                   0    "$([ -f "$WL/approvals/specs__active__0001.md.sig.json" ]; echo $?)"
for tool in Write Edit MultiEdit NotebookEdit; do
  t "AC-16 signed: named CLAUDE.md, $tool: no output"              none "$(g "$WL" "$tool" "$WL/CLAUDE.md")"
done
t "AC-16 signed: named harness/gate.js: no output"                 none "$(g "$WL" Write "$WL/harness/gate.js")"
t "AC-16 signed: named CLAUDE.md, relative path: no output"        none "$(g "$WL" Edit CLAUDE.md)"
for m in default plan acceptEdits auto bypassPermissions somethingNew -; do
  t "AC-16 signed: named CLAUDE.md, mode $m: no output"            none "$(g "$WL" Edit "$WL/CLAUDE.md" "$m")"
done
t "AC-16 signed: .claude/settings.json (not named) asks"           ask  "$(g "$WL" Edit "$WL/.claude/settings.json")"
t "AC-16 that reason keeps the enforcement label"                  yes  "$(has '(enforcement)')"
t "AC-16 that reason names Unlocks:"                               yes  "$(has 'Unlocks:')"
t "AC-16 that reason quotes the path"                              yes  "$(has '".claude/settings.json"')"
t "AC-16 not named, mode auto: refused"                            deny "$(g "$WL" Edit "$WL/.claude/settings.json" auto)"
t "AC-16 not named, mode auto: exactly the path text of 7.7"       0    "$(PATHTEXT '.claude/settings.json' | cmp -s - "$T/last.err"; echo $?)"
t "AC-16 signed: harness/guard.js (not named) asks"                ask  "$(g "$WL" Write "$WL/harness/guard.js")"
# locked paths get no authority, although the signed header names them
t "AC-16 locked: named harness/keys/k.pem asks"                    ask  "$(g "$WL" Write "$WL/harness/keys/k.pem")"
t "AC-16 locked: the reason keeps the enforcement label"           yes  "$(has '(enforcement)')"
t "AC-16 locked: named src/approvals/y.json asks"                  ask  "$(g "$WL" Write "$WL/src/approvals/y.json")"
t "AC-16 locked: named approvals/x.json is refused"                deny "$(g "$WL" Write "$WL/approvals/x.json")"
t "AC-16 locked: named .git/config is refused"                     deny "$(g "$WL" Edit "$WL/.git/config")"
t "AC-16 locked, mode auto: harness/keys/k.pem is refused"         deny "$(g "$WL" Write "$WL/harness/keys/k.pem" auto)"
# exact case, symlinks
t "AC-16 exact case: claude.md asks"                               ask  "$(g "$WL" Edit "$WL/claude.md")"
t "AC-16 exact case: HARNESS/gate.js asks"                         ask  "$(g "$WL" Edit "$WL/HARNESS/gate.js")"
ln -s ../CLAUDE.md "$WL/docs/l.md"
t "AC-16 symlink docs/l.md -> ../CLAUDE.md asks"                   ask  "$(g "$WL" Edit "$WL/docs/l.md")"
t "AC-16 that reason keeps the enforcement label"                  yes  "$(has '(enforcement)')"
rm -f "$WL/docs/l.md"
WL2="$T/wl2"; lws "$WL2" 'CLAUDE.md, AGENTS.md, harness/gate.js, harness/guard.js'
echo x > "$WL2/AGENTS.md"; ln -s AGENTS.md "$WL2/CLAUDE.md"; echo x > "$WL2/harness/guard.js"; ln -s guard.js "$WL2/harness/gate.js"
sign "$WL2" 0001.md
t "AC-16 CLAUDE.md as a symlink to AGENTS.md asks"                 ask  "$(g "$WL2" Write "$WL2/CLAUDE.md")"
t "AC-16 harness/gate.js as a symlink to guard.js asks"            ask  "$(g "$WL2" Write "$WL2/harness/gate.js")"
t "AC-16 harness/guard.js itself (named, no symlink): no output"   none "$(g "$WL2" Write "$WL2/harness/guard.js")"
# caller (condition 6, S-01)
t "AC-16 caller: agent_type absent: no output"                     none "$(gx "$WL" Edit "$WL/CLAUDE.md")"
for a in polyglot-engineer dotnet-engineer react-engineer devops-sre; do
  t "AC-16 caller: agent_type $a: no output"                       none "$(gx "$WL" Edit "$WL/CLAUDE.md" - "$a")"
done
t "AC-16 caller: agent_type scout asks"                            ask  "$(gx "$WL" Edit "$WL/CLAUDE.md" - scout)"
t "AC-16 caller: that reason keeps the enforcement label"          yes  "$(has '(enforcement)')"
t "AC-16 caller: that reason names the caller"                     yes  "$(has '"scout"')"
t "AC-16 caller: scout, mode auto: refused"                        deny "$(gx "$WL" Edit "$WL/CLAUDE.md" auto scout)"
t "AC-16 caller: scout, mode auto: exactly the path text of 7.7"   0    "$(PATHTEXT 'CLAUDE.md' | cmp -s - "$T/last.err"; echo $?)"
t "AC-16 caller: agent_type somethingNew asks"                     ask  "$(gx "$WL" Edit "$WL/CLAUDE.md" - somethingNew)"
t "AC-16 caller: scout still writes signed code (no output)"       none "$(gx "$WL" Write "$WL/src/a.cs" - scout)"
# nested roots: w1 a plain directory; w2, w3 linked worktrees of WL (D-8)
mkdir -p "$WL/.claude/worktrees/w1"
t "AC-16 nested root w1 (no spec of its own): CLAUDE.md asks"      ask  "$(g "$WL" Write "$WL/.claude/worktrees/w1/CLAUDE.md")"
tgit -C "$WL" worktree add -q "$WL/.claude/worktrees/w2" -b w2 >/dev/null 2>&1
tgit -C "$WL" worktree add -q "$WL/.claude/worktrees/w3" -b w3 >/dev/null 2>&1
t "AC-16 setup: w2 holds a byte-identical copy of the signed spec" 0    "$(cmp -s "$WL/specs/active/0001.md" "$WL/.claude/worktrees/w2/specs/active/0001.md"; echo $?)"
t "AC-16 nested root w2, identical signed spec: no output"         none "$(g "$WL" Write "$WL/.claude/worktrees/w2/CLAUDE.md")"
echo >> "$WL/.claude/worktrees/w3/specs/active/0001.md"
t "AC-16 nested root w3, spec differs by one byte: asks"           ask  "$(g "$WL" Write "$WL/.claude/worktrees/w3/CLAUDE.md")"
# signature: edited spec, two specs, wrong spec
cp "$WL/specs/active/0001.md" "$T/wl-spec.keep"
sed 's|^- Unlocks: \(.*\)$|- Unlocks: \1, harness/guard.js|' "$T/wl-spec.keep" > "$WL/specs/active/0001.md"
t "AC-16 spec edited after signing (one more entry): CLAUDE.md asks" ask "$(g "$WL" Write "$WL/CLAUDE.md")"
t "AC-16 spec edited after signing: the added entry asks too"      ask  "$(g "$WL" Write "$WL/harness/guard.js")"
cp "$T/wl-spec.keep" "$WL/specs/active/0001.md"
t "AC-16 spec restored: CLAUDE.md no output again"                 none "$(g "$WL" Write "$WL/CLAUDE.md")"
cp "$WL/specs/active/0001.md" "$WL/specs/active/0002.md"
t "AC-16 a second active spec: CLAUDE.md asks"                     ask  "$(g "$WL" Write "$WL/CLAUDE.md")"
t "AC-16 a second active spec: the reason holds the count 2"       yes  "$(has '2')"
t "AC-16 a second active spec: the reason keeps the label"         yes  "$(has '(enforcement)')"
rm -f "$WL/specs/active/0002.md"
WW="$T/ww"; lws "$WW" 'templates/**'; mkdir -p "$WW/specs/done"
printf '%s\n' '# Spec 0000' '- Unlocks: CLAUDE.md' '' '## 1' 'x' > "$WW/specs/done/0000.md"
sign "$WW" 0001.md; ( cd "$WW" && node "$H/approval.js" sign specs/done/0000.md approvals "$KEY" >/dev/null 2>&1 )
t "AC-16 setup: the done spec has a record"                        0    "$([ -f "$WW/approvals/specs__done__0000.md.sig.json" ]; echo $?)"
t "AC-16 wrong spec: only a signed specs/done names it: asks"      ask  "$(g "$WW" Write "$WW/CLAUDE.md")"
WK1="$T/wk1"; lws "$WK1" 'CLAUDE.md'; sign "$WK1" 0001.md "$KEY2"
t "AC-16 signed with another key: CLAUDE.md asks"                  ask  "$(g "$WK1" Write "$WK1/CLAUDE.md")"
# a glob never unlocks
n=0
for v in 'CLAUDE.m?' 'harness/gate.j*' '**/CLAUDE.md'; do
  n=$((n+1)); WG="$T/wg$n"; lws "$WG" "$v"; sign "$WG" 0001.md
  case "$v" in harness/*) p=harness/gate.js;; *) p=CLAUDE.md;; esac
  t "AC-16 glob $v, signed: $p asks"                               ask  "$(g "$WG" Write "$WG/$p")"
  t "AC-16 glob $v: signed code still has no output"               none "$(g "$WG" Write "$WG/src/a.cs")"
done
# outside every root: the entry equals the path relative to the filesystem root
WO="$T/wo"; mkdir -p "$T/other" "$TH/.claude"
lws "$WO" "${TH#/}/.claude/settings.json, ${T#/}/other/CLAUDE.md"; sign "$WO" 0001.md
t "AC-16 outside: <home>/.claude/settings.json asks"               ask  "$(g "$WO" Write "$TH/.claude/settings.json")"
t "AC-16 outside: CLAUDE.md of another directory asks"             ask  "$(g "$WO" Write "$T/other/CLAUDE.md")"
t "AC-16 outside: that reason keeps the enforcement label"         yes  "$(has '(enforcement)')"
# main root (REQ-35) and same root (D-1)
M2="$T/main2"; LW2="$T/lw2"; lws "$M2" 'CLAUDE.md'; echo x > "$M2/src/keep.cs"
tgit -C "$M2" init -q >/dev/null 2>&1
tgit -C "$M2" add specs src >/dev/null 2>&1
tgit -C "$M2" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -qm init >/dev/null 2>&1
tgit -C "$M2" worktree add -q "$LW2" -b lw2 >/dev/null 2>&1
t "AC-16 main root, unsigned: <main>/CLAUDE.md asks"               ask  "$(g "$LW2" Write "$M2/CLAUDE.md")"
sign "$M2" 0001.md
t "AC-16 main root, signed and named: <main>/CLAUDE.md no output"  none "$(g "$LW2" Write "$M2/CLAUDE.md")"
t "AC-16 main root: <main>/harness/gate.js (not named) asks"       ask  "$(g "$LW2" Write "$M2/harness/gate.js")"
t "AC-16 linked worktree, record in the main tree: its CLAUDE.md no output" none "$(g "$LW2" Write "$LW2/CLAUDE.md")"
echo x > "$M2/CLAUDE.md"; ln -s "$M2/CLAUDE.md" "$LW2/CLAUDE.md"
t "AC-16 same root: <LW>/CLAUDE.md as a symlink to <main>/CLAUDE.md asks" ask "$(g "$LW2" Write "$LW2/CLAUDE.md")"
rm -f "$LW2/CLAUDE.md"
t "AC-16 git fails, signed and named: CLAUDE.md asks (no authority)" ask "$(ev Write "$M2/CLAUDE.md" "$M2" | PROJ="$M2" GPATH="$SP" call)"
t "AC-16 git fails: the reason keeps the enforcement label"        yes  "$(has '(enforcement)')"
t "AC-16 git works again: CLAUDE.md no output"                     none "$(g "$M2" Write "$M2/CLAUDE.md")"
t "AC-16 harness key lookup fails: named harness/guard.js asks"    ask  "$(ev Write "$WL2/harness/guard.js" "$WL2" | PROJ="$WL2" GPATH="$SP" GATE="$H2/gate.js" call)"
mkdir -p "$T/real"; ln -s "$T/real" "$T/link"; WR="$T/real/ws"; lws "$WR" 'CLAUDE.md'; sign "$WR" 0001.md
t "AC-16 same root: workspace behind a symlinked parent: no output" none "$(g "$T/link/ws" Write "$T/link/ws/CLAUDE.md")"
t "AC-16 same root: that workspace by its real path: no output"    none "$(g "$WR" Write "$WR/CLAUDE.md")"
t "AC-16 same root: project dir real, target through the link asks" ask "$(g "$WR" Write "$T/link/ws/CLAUDE.md")"
t "AC-16 workspace without specs/: CLAUDE.md asks"                 ask  "$(g "$F" Write "$F/CLAUDE.md")"
# locked whatever the root (D-2); the temp HOME is elsewhere unless XENV moves it
WD="$T/wd"; lws "$WD" '.claude/settings.local.json, harness/bin/ceo-keygen.sh, .claude/settings.json, .claude.json, .company/x.json, cfg/agents/x.md, CLAUDE.md'; sign "$WD" 0001.md
gd() { ev Write "$WD/$1" "$WD" | PROJ="$WD" XENV="${2:-}" call; }
t "AC-16 locked: named .claude/settings.local.json asks"           ask  "$(gd .claude/settings.local.json)"
t "AC-16 locked: named harness/bin/ceo-keygen.sh asks"             ask  "$(gd harness/bin/ceo-keygen.sh)"
t "AC-16 HOME elsewhere: named .claude/settings.json no output"    none "$(gd .claude/settings.json)"
t "AC-16 HOME elsewhere: named CLAUDE.md no output"                none "$(gd CLAUDE.md)"
t "AC-16 HOME = workspace: named .claude/settings.json asks"       ask  "$(gd .claude/settings.json "HOME=$WD")"
t "AC-16 HOME = workspace: named .claude.json asks"                ask  "$(gd .claude.json "HOME=$WD")"
t "AC-16 HOME = workspace: named .company/x.json asks"             ask  "$(gd .company/x.json "HOME=$WD")"
t "AC-16 HOME = workspace: named CLAUDE.md still no output"        none "$(gd CLAUDE.md "HOME=$WD")"
t "AC-16 no CLAUDE_CONFIG_DIR: cfg/agents/x.md is code (no output)" none "$(gd cfg/agents/x.md)"
t "AC-16 CLAUDE_CONFIG_DIR = <ws>/cfg: named cfg/agents/x.md asks" ask  "$(gd cfg/agents/x.md "CLAUDE_CONFIG_DIR=$WD/cfg")"
t "AC-16 CLAUDE_CONFIG_DIR = <ws>/cfg: the reason keeps the label" yes  "$(has '(enforcement)')"

# --- AC-11 (T-9): the wired gate commands block when the gate cannot run -------------------------
# The command strings are read from the tracked settings files and run as the app runs them: sh -c '<command>'.
REPO=$(dirname "$HERE")
gatecmds() { # gatecmds <settings file>: the hook commands of that file that run gate.js, one per line
  node -e 'const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const out = [];
    for (const entries of Object.values(s.hooks || {})) for (const e of entries || []) for (const h of e.hooks || []) if (/gate\.js/.test(h.command || "")) out.push(h.command);
    process.stdout.write(out.join("\n"));' "$1" 2>/dev/null
}
# shc <command string> <CLAUDE_PROJECT_DIR> <event file>: exit code of sh -c; stdout in $T/sh.out, stderr in $T/sh.err
shc() {
  env -u COMPANY_PUBKEY -u COMPANY_SPEC -u COMPANY_HARNESS_DIR CLAUDE_PROJECT_DIR="$2" HOME="$TH" sh -c "$1" <"$3" >"$T/sh.out" 2>"$T/sh.err"
  echo $?
}
HG=$(gatecmds "$REPO/.claude/settings.json"); CG=$(gatecmds "$REPO/harness/container-settings.json")
t "AC-11 .claude/settings.json holds one gate command"              1    "$(printf '%s\n' "$HG" | grep -c .)"
t "AC-11 it is the host gate command of 7.8, wrapper included"      'node "$CLAUDE_PROJECT_DIR/harness/gate.js" --host || exit 2' "$HG"
NG="$T/nogate"; mkdir -p "$NG/harness" "$NG/src"
ev Write "$NG/src/a.cs" "$NG" > "$T/ng.json"
t "AC-11 the tree of the next case has no harness/gate.js"          no   "$(if [ -e "$NG/harness/gate.js" ]; then echo yes; else echo no; fi)"
t "AC-11 sh -c host gate command, no harness/gate.js: exit 2"       2    "$(shc "$HG" "$NG" "$T/ng.json")"
t "AC-11 that run printed no decision"                              0    "$(wc -c < "$T/sh.out" | tr -d ' ')"
t "AC-11 the same command without the wrapper would exit 1"         1    "$(shc "${HG% || exit 2}" "$NG" "$T/ng.json")"
# the same string does reach a gate that exists: the temp harness copy, a workspace without specs/, CLAUDE.md
ev Write "$T/h/CLAUDE.md" "$T/h" > "$T/hg.json"
t "AC-11 sh -c host gate command, gate present: exit 0"             0    "$(shc "$HG" "$T/h" "$T/hg.json")"
t "AC-11 that run asked (the gate itself answered)"                 1    "$(grep -c '"permissionDecision":"ask"' "$T/sh.out")"
t "AC-11 container-settings.json holds one gate command"            1    "$(printf '%s\n' "$CG" | grep -c .)"
t "AC-11 it is the container gate command of 7.8, wrapper included" 'COMPANY_PUBKEY=/harness/keys/ceo.pub.pem node /harness/gate.js || exit 2' "$CG"
# On the host there is no /harness: the container command must block. If /harness/gate.js exists here, this case fails loudly.
t "AC-11 /harness/gate.js does not exist on this machine"           no   "$(if [ -e /harness/gate.js ]; then echo yes; else echo no; fi)"
if [ ! -e /harness/gate.js ]; then
  t "AC-11 sh -c container gate command on the host: exit 2"        2    "$(shc "$CG" "$NG" "$T/ng.json")"
else
  t "AC-11 sh -c container gate command on the host: exit 2"        2    "not run: /harness/gate.js exists"
fi

# --- AC-12 (T-9): the installer writes the same wiring into another project ---------------------
INST="$HERE/bin/install-project.sh"
# entry <settings file> <event> <matcher|-> <command>: yes when hooks.<event> has an entry with exactly that matcher
# ("-": no matcher) and a hook of type command with exactly that command
entry() {
  node -e 'const [f, ev, m, c] = process.argv.slice(1); const s = JSON.parse(require("fs").readFileSync(f, "utf8"));
    const hit = ((s.hooks || {})[ev] || []).some((e) => (m === "-" ? e.matcher === undefined : e.matcher === m) && (e.hooks || []).some((h) => h.type === "command" && h.command === c));
    process.stdout.write(hit ? "yes" : "no");' "$1" "$2" "$3" "$4" 2>/dev/null || printf error
}
FTOOLS='Write|Edit|MultiEdit|NotebookEdit'
IGATE="node \"$REPO/harness/gate.js\" --host || exit 2"; IGUARD="node \"$REPO/harness/guard.js\" || exit 2"
IP="$T/inst/new"; mkdir -p "$IP"; IS="$IP/.claude/settings.json"
sh "$INST" "$IP" > "$T/inst.out" 2>&1; irc=$?
t "AC-12 install into an empty project: exit 0"                     0    "$irc"
t "AC-12 install: the settings file exists and parses"              yes  "$(node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write("yes")' "$IS" 2>/dev/null || echo no)"
t "AC-12 install: host gate for the four file tools, with wrapper"  yes  "$(entry "$IS" PreToolUse "$FTOOLS" "$IGATE")"
t "AC-12 install: guard for Bash, with wrapper"                     yes  "$(entry "$IS" PreToolUse Bash "$IGUARD")"
t "AC-12 install: loop for all tools"                               yes  "$(entry "$IS" PreToolUse - "node \"$REPO/harness/loop.js\"")"
t "AC-12 install: notify"                                           yes  "$(entry "$IS" Notification - "node \"$REPO/harness/notify.js\"")"
t "AC-12 install: stop, without the wrapper"                        yes  "$(entry "$IS" Stop - "node \"$REPO/harness/stop.js\"")"
t "AC-12 install: harness paths are absolute"                       /    "$(printf '%s' "$REPO" | cut -c1)"
t "AC-12 install: no \$CLAUDE_PROJECT_DIR left in the file"         0    "$(grep -c 'CLAUDE_PROJECT_DIR' "$IS")"
t "AC-12 install: the guard runs in one entry only (Bash)"          1    "$(grep -c 'guard\.js' "$IS")"
t "AC-12 install: the gate runs in one entry only (file tools)"     1    "$(grep -c 'gate\.js' "$IS")"
t "AC-12 install: every gate and guard command ends with the wrapper" 0  "$(grep -E '(gate|guard)\.js' "$IS" | grep -vc '|| exit 2"$')"
t "AC-12 install: the key folder stays denied, as before"           3    "$(grep -c '(~/.company/\*\*)' "$IS")"
t "AC-12 install: the project has specs/active and approvals"       yes  "$(if [ -d "$IP/specs/active" ] && [ -d "$IP/approvals" ]; then echo yes; else echo no; fi)"
# the installed gate command blocks when its harness is gone (the command string, with the path cut short)
IGC=$(gatecmds "$IS")
t "AC-12 install: the gate command with a missing harness: exit 2"  2    "$(shc "$(printf '%s' "$IGC" | sed 's|/harness/gate\.js|/harness/absent/gate.js|')" "$IP" "$T/ng.json")"
# an existing settings file is never rewritten: exit 1 and the entries to merge by hand
IP2="$T/inst/old"; mkdir -p "$IP2/.claude"; printf '%s\n' '{ "hooks": {} }' > "$IP2/.claude/settings.json"
sh "$INST" "$IP2" > "$T/inst2.out" 2>&1; irc=$?
t "AC-12 install over an existing settings file: exit 1"            1    "$irc"
t "AC-12 the existing settings file is not changed"                 '{ "hooks": {} }' "$(cat "$IP2/.claude/settings.json")"
t "AC-12 output: gate --host entry with wrapper and its matcher"    1    "$(grep -F -- "$IGATE" "$T/inst2.out" | grep -F -c -- "$FTOOLS")"
t "AC-12 output: guard entry with wrapper for Bash"                 1    "$(grep -F -- "$IGUARD" "$T/inst2.out" | grep -c 'Bash')"
t "AC-12 output: removal of the guard's file-tool entry"            1    "$(grep -i 'remove' "$T/inst2.out" | grep -F -- "$FTOOLS" | grep -c 'guard\.js')"
t "AC-12 output: nothing else was created in that project"          no   "$(if [ -e "$IP2/specs" ] || [ -e "$IP2/approvals" ]; then echo yes; else echo no; fi)"
sh "$INST" > "$T/inst3.out" 2>&1; irc=$?
t "AC-12 install without a project dir: exit 2 (usage)"             2    "$irc"

# --- §7.1.1: path aliases of macOS (appsec finding of 2026-11-23) --------------------------------
# The data-volume firmlink prefix and volfs name a file that realpath does not lead back to its place. Through the wired
# command form (`gate.js --host`): the firmlink form gets the decision of the direct path; a volfs path is refused.
# WA: one active spec, never signed      WAS: the same, signed      home members sit under the scratch HOME ($TH)
if [ "$(uname -s)" = Darwin ]; then
  FL=/System/Volumes/Data
  WA="$T/wa"; WAS="$T/was"; mk "$WA"; mk "$WAS"; echo x > "$WA/src/a.cs"; echo x > "$WAS/src/a.cs"
  printf '# Spec 0001\n\n## 1\nAC-1: hello\n' > "$WA/specs/active/0001.md"
  printf '# Spec 0001\n\n## 1\nAC-1: hello\n' > "$WAS/specs/active/0001.md"; sign "$WAS" 0001.md
  fid() { stat -f '%d/%i' "$1"; }
  held() { case "$1" in ask|deny) echo yes;; *) echo "no: $1";; esac; }   # the direct path got an ask or a refusal
  VW="/.vol/$(fid "$WA")"; VH="/.vol/$(fid "$TH")"
  t "alias setup: the firmlink form reaches the same file"        "$(fid "$WA/src/a.cs")" "$(fid "$FL$WA/src/a.cs")"
  t "alias setup: the volfs form reaches the same file"           "$(fid "$WA/src/a.cs")" "$(fid "$VW/src/a.cs")"
  for md in - default auto; do
    for p in src/a.cs src/new.cs .git/hooks/pre-commit .mcp.json .claude/agents/x.md harness/x.js; do
      d=$(g "$WA" Write "$WA/$p" "$md")
      t "alias mode $md: direct $p is not waved through"          yes  "$(held "$d")"
      t "alias mode $md: firmlink $p decides as the direct path"  "$d" "$(g "$WA" Write "$FL$WA/$p" "$md")"
      t "alias mode $md: volfs $p is refused"                     deny "$(g "$WA" Write "$VW/$p" "$md")"
    done
    for p in .claude.json .company/keys/ceo.key.pem .company/x.json .claude/settings.json; do
      d=$(g "$WA" Write "$TH/$p" "$md")
      t "alias mode $md: direct <HOME>/$p is not waved through"   yes  "$(held "$d")"
      t "alias mode $md: firmlink <HOME>/$p decides as the direct path" "$d" "$(g "$WA" Write "$FL$TH/$p" "$md")"
      t "alias mode $md: volfs <HOME>/$p is refused"              deny "$(g "$WA" Write "$VH/$p" "$md")"
    done
  done
  t "alias mode auto: direct code write, unsigned, exit 2"        deny "$(g "$WA" Write "$WA/src/a.cs" auto)"
  t "alias mode auto: firmlink code write, unsigned, exit 2"      deny "$(g "$WA" Write "$FL$WA/src/a.cs" auto)"
  t "alias mode auto: that refusal names the path"                yes  "$(errhas 'the edit of "src/a.cs"')"
  t "alias firmlink in another case: code write asks"             ask  "$(g "$WA" Write "/system/volumes/DATA$WA/src/a.cs")"
  t "alias firmlink: the dialog quotes the relative path"         yes  "$(has '"src/a.cs"')"
  t "alias firmlink, Edit / MultiEdit / NotebookEdit ask"         ask,ask,ask "$(g "$WA" Edit "$FL$WA/src/a.cs"),$(g "$WA" MultiEdit "$FL$WA/src/a.cs"),$(g "$WA" NotebookEdit "$FL$WA/src/n.ipynb")"
  t "alias volfs: the refusal says the path cannot be resolved"   yes  "$(g "$WA" Write "$VW/src/a.cs" >/dev/null; errhas 'cannot be resolved')"
  t "alias volfs of the file itself is refused"                   deny "$(g "$WA" Write "/.vol/$(fid "$WA/src/a.cs")")"
  t "alias /.nofollow form is refused"                            deny "$(g "$WA" Write "/.nofollow$WA/src/a.cs")"
  t "alias /.resolve form is refused"                             deny "$(g "$WA" Write "/.resolve/1$WA/src/a.cs")"
  t "alias project dir in the firmlink form: direct code write asks" ask "$(g "$FL$WA" Write "$WA/src/a.cs")"
  t "alias signed: direct code write has no output"               none "$(g "$WAS" Write "$WAS/src/a.cs")"
  t "alias signed: firmlink code write has no output either"      none "$(g "$WAS" Write "$FL$WAS/src/a.cs")"
  t "alias signed: firmlink .mcp.json still asks"                 ask  "$(g "$WAS" Write "$FL$WAS/.mcp.json")"
  t "alias signed: firmlink .git/config is refused"               deny "$(g "$WAS" Write "$FL$WAS/.git/config")"
  t "alias signed: volfs code write is refused"                   deny "$(g "$WAS" Write "/.vol/$(fid "$WAS")/src/a.cs")"
  t "alias: a firmlink path outside every root gets no opinion"   none "$(g "$WA" Write "$FL$T/elsewhere/x.txt")"
else
  echo "skip (not darwin): 7.1.1 path alias cases (firmlink, volfs)"
fi

# --- no hook ever emits an allow (AC-10) -------------------------------------------------------
t "no case printed a permissionDecision other than ask"           0    "$(grep -o '"permissionDecision":"[a-z]*"' "$T/all.out" | grep -vc '"ask"')"
t "no case printed an allow"                                      0    "$(grep -c 'allow' "$T/all.out")"

echo; if [ "$fail" -eq 0 ]; then echo "HOST GATE TESTS GREEN: $pass passed, 0 failed"; else echo "HOST GATE TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
