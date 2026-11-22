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
t "AC-10 mode auto: the refusal is the exact text of 7.7"         0    "$(g "$WU" Write "$WU/src/a.cs" auto >/dev/null; printf '%s\n' "BLOCKED by company gate: the edit of \"src/a.cs\" needs the CEO's dialog, but permission mode 'auto' is not proven to show it. Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement, signatures, .git: no spec covers them, default mode only)." | cmp -s - "$T/last.err"; echo $?)"
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

# --- no hook ever emits an allow (AC-10) -------------------------------------------------------
t "no case printed a permissionDecision other than ask"           0    "$(grep -o '"permissionDecision":"[a-z]*"' "$T/all.out" | grep -vc '"ask"')"
t "no case printed an allow"                                      0    "$(grep -c 'allow' "$T/all.out")"

echo; if [ "$fail" -eq 0 ]; then echo "HOST GATE TESTS GREEN: $pass passed, 0 failed"; else echo "HOST GATE TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
