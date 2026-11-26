#!/bin/sh
# harness/test/run.sh: behavioural tests for the approval tool and the gate hook (no Docker, no network).
# Uses throwaway keys in a temp dir. The real CEO key is never touched.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export COMPANY_TEST_MODE=1 COMPANY_TEST_PASSPHRASE='throwaway-test-pass'
pass=0; fail=0
t() { # t <name> <expected-rc> <actual-rc>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected rc=$2, got rc=$3)"; fi
}
WS="$T/ws"; mkdir -p "$WS/specs/active" "$WS/approvals" "$WS/src" "$WS/.claude"
printf '# Spec 0001\nAC-1: hello\n' > "$WS/specs/active/0001.md"
node "$HERE/approval.js" keygen "$T/keys" >/dev/null
PUB="$T/keys/ceo.pub.pem"; KEY="$T/keys/ceo.key.pem"
gate() { printf '{"hook_event_name":"PreToolUse","tool_name":"%s","cwd":"%s","tool_input":{"file_path":"%s"}}' "$1" "$WS" "$2" | COMPANY_PUBKEY="$PUB" node "$HERE/gate.js" >/dev/null 2>&1; echo $?; }

t "unsigned: code write is blocked"                 2 "$(gate Write "$WS/src/app.cs")"
t "unsigned: drafting the spec is allowed"          0 "$(gate Edit  "$WS/specs/active/0001.md")"
( cd "$WS" && node "$HERE/approval.js" sign specs/active/0001.md approvals "$KEY" >/dev/null )
t "signed: code write is allowed"                   0 "$(gate Write "$WS/src/app.cs")"
t "signed: write into approvals/ is blocked"        2 "$(gate Write "$WS/approvals/x.json")"
t "signed: editing .claude/ is blocked"             2 "$(gate Edit  "$WS/.claude/settings.json")"
t "signed: editing .git/ is blocked"                2 "$(gate Write "$WS/.git/hooks/pre-commit")"
t "signed: path outside the workspace is blocked"   2 "$(gate Write "/etc/hosts")"
t "signed: unrelated tool (Read) is allowed"        0 "$(printf '{"tool_name":"Read","cwd":"%s","tool_input":{"file_path":"%s"}}' "$WS" "$WS/src/app.cs" | COMPANY_PUBKEY="$PUB" node "$HERE/gate.js" >/dev/null 2>&1; echo $?)"
echo "AC-2: sneaky" >> "$WS/specs/active/0001.md"
t "spec edited after signing: code write blocked"   2 "$(gate Write "$WS/src/app.cs")"
sed -i.bak '$d' "$WS/specs/active/0001.md"; rm -f "$WS/specs/active/0001.md.bak"
t "spec restored: signature valid again"            0 "$(gate Write "$WS/src/app.cs")"
H=$(shasum -a 256 "$WS/specs/active/0001.md" | cut -d' ' -f1)
printf '{"version":1,"spec":"specs/active/0001.md","sha256":"%s","signature":"AAAA"}' "$H" > "$WS/approvals/specs__active__0001.md.sig.json"
t "forged record with the right hash is blocked"    2 "$(gate Write "$WS/src/app.cs")"
t "garbage hook input fails closed"                 2 "$(printf 'not json' | node "$HERE/gate.js" >/dev/null 2>&1; echo $?)"
t "missing key fails closed"                        2 "$(printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s"}}' "$WS" "$WS/src/a" | COMPANY_PUBKEY=/nonexistent node "$HERE/gate.js" >/dev/null 2>&1; echo $?)"
t "wrong passphrase cannot sign"                    4 "$( cd "$WS" && COMPANY_TEST_PASSPHRASE=wrong node "$HERE/approval.js" sign specs/active/0001.md approvals "$KEY" >/dev/null 2>&1; echo $?)"
t "no terminal and no test mode cannot sign"        3 "$( cd "$WS" && env -u COMPANY_TEST_MODE -u COMPANY_TEST_PASSPHRASE node "$HERE/approval.js" sign specs/active/0001.md approvals "$KEY" </dev/null >/dev/null 2>&1; echo $?)"
mkdir -p "$WS/specs/active"; cp "$WS/specs/active/0001.md" "$WS/specs/active/0002.md"
t "two active specs: code write blocked"            2 "$(gate Write "$WS/src/app.cs")"

# passwordless key: signs without a terminal; the gate accepts it (presence proof is guard.js on the host)
node "$HERE/approval.js" keygen "$T/plain" --no-passphrase >/dev/null
WS2="$T/ws2"; mkdir -p "$WS2/specs/active" "$WS2/approvals" "$WS2/src"; printf '# Spec 2\n' > "$WS2/specs/active/0002.md"
gate2() { printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s"}}' "$WS2" "$WS2/src/app.cs" | COMPANY_PUBKEY="$T/plain/ceo.pub.pem" node "$HERE/gate.js" >/dev/null 2>&1; echo $?; }
t "plain key: code blocked before signing"            2 "$(gate2)"
t "plain key: signs without terminal or passphrase"   0 "$( cd "$WS2" && env -u COMPANY_TEST_MODE -u COMPANY_TEST_PASSPHRASE node "$HERE/approval.js" sign specs/active/0002.md approvals "$T/plain/ceo.key.pem" </dev/null >/dev/null 2>&1; echo $?)"
t "plain key: signature accepted by the gate"         0 "$(gate2)"
t "plain key file is not PEM-encrypted"               0 "$(grep -c ENCRYPTED "$T/plain/ceo.key.pem")"

# ---- spec 0004 AC-7: approve.sh --preview / --expect, approval.js sign --expect, verifyBuffer ----
# Temp HOME (never the real one), temp git repo with a linked worktree for the main-worktree record.
AP="$HERE/bin/approve.sh"; TH="$T/home"; mkdir -p "$TH"
ap() { HOME="$TH" sh "$AP" "$@"; }
norec() { if [ -z "$(ls "$1/approvals" 2>/dev/null)" ]; then echo 0; else echo 1; fi; }
sha12() { shasum -a 256 "$1" | cut -c1-12; }
tgit() { env HOME="$TH" GIT_CONFIG_NOSYSTEM=1 git "$@"; }
M="$T/main"; LW="$T/lw"; mkdir -p "$M/specs/active"
printf '# Spec 0003\n- Status: draft\n- Unlocks: `src/**`, docs/a.md\n\n## 1\nAC-1: hello\n' > "$M/specs/active/0003.md"
tgit -C "$M" init -q >/dev/null 2>&1
tgit -C "$M" add specs >/dev/null 2>&1
tgit -C "$M" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -qm init >/dev/null 2>&1
tgit -C "$M" worktree add -q "$LW" -b lw >/dev/null 2>&1
t "AC-7 setup: linked worktree has the spec"           0 "$([ -f "$LW/specs/active/0003.md" ]; echo $?)"
S=$(sha12 "$M/specs/active/0003.md")
printf 'Spec: specs/active/0003.md\nsha12: %s\nUnlocks: src/**, docs/a.md\nHeader lint: ok\nSign with: harness/bin/approve.sh %s --expect %s\n' "$S" "$M" "$S" > "$T/want.txt"
ap "$M" --preview > "$T/got.txt" 2>"$T/got.err"; rc=$?
t "AC-7 preview without a key: exit 0"                 0 "$rc"
t "AC-7 preview prints exactly the five lines"         0 "$(cmp -s "$T/want.txt" "$T/got.txt"; echo $?)"
t "AC-7 preview writes nothing to stderr"              0 "$([ ! -s "$T/got.err" ]; echo $?)"
ap "$M" > "$T/out.txt" 2>&1; rc=$?
t "AC-7 no --expect: exit 2"                           2 "$rc"
t "AC-7 no --expect: prints the preview command"       0 "$(grep -q -- "approve.sh $M --preview" "$T/out.txt"; echo $?)"
t "AC-7 no --expect: no record"                        0 "$(norec "$M")"
t "AC-7 --expect without a key: exit 1"                1 "$(ap "$M" --expect "$S" >/dev/null 2>&1; echo $?)"
t "AC-7 --expect without a key: no record"             0 "$(norec "$M")"
mkdir -p "$TH/.company/keys"; cp "$T/plain/ceo.key.pem" "$TH/.company/keys/ceo.key.pem"
t "AC-7 no --expect with a key: exit 2"                2 "$(ap "$M" >/dev/null 2>&1; echo $?)"
t "AC-7 no --expect with a key: no record"             0 "$(norec "$M")"
t "AC-7 --expect with no value: exit 2"                2 "$(ap "$M" --expect >/dev/null 2>&1; echo $?)"
t "AC-7 wrong sha12: exit 5"                           5 "$(ap "$M" --expect 000000000000 >/dev/null 2>&1; echo $?)"
t "AC-7 wrong sha12: no record"                        0 "$(norec "$M")"
t "AC-7 --preview --expect <right>: exit 2"            2 "$(ap "$M" --preview --expect "$S" >/dev/null 2>&1; echo $?)"
t "AC-7 --expect <right> --preview: exit 2"            2 "$(ap "$M" --expect "$S" --preview >/dev/null 2>&1; echo $?)"
t "AC-7 --preview with --expect: no record"            0 "$(norec "$M")"
# invalid header: preview reports it, signing is refused even with the right sha12
BAD="$T/bad"; mkdir -p "$BAD/specs/active"; printf '# Spec bad\n- Unlocks: {a,b}\n\n## 1\n' > "$BAD/specs/active/0009.md"
SB=$(sha12 "$BAD/specs/active/0009.md")
ap "$BAD" --preview > "$T/bad.txt" 2>/dev/null; rc=$?
t "AC-7 invalid header: preview still exits 0"         0 "$rc"
t "AC-7 invalid header: preview says INVALID"          0 "$(sed -n 3p "$T/bad.txt" | grep -q '^Unlocks: INVALID: '; echo $?)"
t "AC-7 invalid header: preview has a lint finding"    1 "$(sed -n 4p "$T/bad.txt" | grep -q '^Header lint: ok$'; echo $?)"
t "AC-7 invalid header: preview is five lines"         5 "$(wc -l < "$T/bad.txt" | tr -d ' ')"
t "AC-7 invalid header with the right sha12: exit 2"   2 "$(ap "$BAD" --expect "$SB" >/dev/null 2>&1; echo $?)"
t "AC-7 invalid header: no record"                     0 "$(norec "$BAD")"
# no Unlocks line: (none)
NO="$T/nohdr"; mkdir -p "$NO/specs/active"; printf '# Spec plain\n\n## 1\n' > "$NO/specs/active/0008.md"
t "AC-7 no Unlocks line: preview prints (none)"        0 "$(ap "$NO" --preview 2>/dev/null | sed -n 3p | grep -q '^Unlocks: (none)$'; echo $?)"
mkdir -p "$T/two/specs/active"; : > "$T/two/specs/active/a.md"; : > "$T/two/specs/active/b.md"
t "AC-7 preview with two active specs: exit 1"         1 "$(ap "$T/two" --preview >/dev/null 2>&1; echo $?)"
# right sha12 from the linked worktree: the record lands in the main worktree's approvals/
t "AC-7 right sha12 (linked worktree): exit 0"         0 "$(ap "$LW" --expect "$S" >/dev/null 2>&1; echo $?)"
t "AC-7 record is in the main worktree approvals/"     0 "$([ -f "$M/approvals/specs__active__0003.md.sig.json" ]; echo $?)"
t "AC-7 no record in the linked worktree"              0 "$(norec "$LW")"
t "AC-7 approval.js verify prints APPROVED"            APPROVED "$( cd "$LW" && node "$HERE/approval.js" verify specs/active/0003.md "$M/approvals" "$T/plain/ceo.pub.pem" 2>/dev/null)"
t "AC-7 record keeps the v1 fields"                    0 "$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(Object.keys(r).join()==="version,spec,sha256,signature,signedAt"&&r.version===1&&r.spec==="specs/active/0003.md"?0:1)' "$M/approvals/specs__active__0003.md.sig.json" 2>/dev/null; echo $?)"
# approval.js sign --expect (direct)
WS4="$T/ws4"; mkdir -p "$WS4/specs/active"; printf '# Spec 4\n' > "$WS4/specs/active/0004.md"; S4=$(sha12 "$WS4/specs/active/0004.md")
sg() { ( cd "$WS4" && node "$HERE/approval.js" sign specs/active/0004.md approvals "$T/plain/ceo.key.pem" "$@" >"$T/sg.txt" 2>&1; echo $? ); }
t "AC-7 approval.js sign --expect <wrong>: exit 5"     5 "$(sg --expect 000000000000)"
t "AC-7 approval.js sign --expect <wrong>: message"    0 "$(grep -q '^REFUSED: file changed since preview$' "$T/sg.txt"; echo $?)"
t "AC-7 approval.js sign --expect <wrong>: no record"  0 "$(norec "$WS4")"
t "AC-7 approval.js sign --expect, no value: exit 2"   2 "$(sg --expect)"
t "AC-7 approval.js sign --expect, no value: no record" 0 "$(norec "$WS4")"
t "AC-7 approval.js sign --expect <right>: exit 0"     0 "$(sg --expect "$S4")"
t "AC-7 approval.js sign --expect <right>: verifies"   0 "$( cd "$WS4" && node "$HERE/approval.js" verify specs/active/0004.md approvals "$T/plain/ceo.pub.pem" >/dev/null 2>&1; echo $?)"
# verifyBuffer (Ruling R-9): same answer as verify for the same bytes; other bytes are refused
vb() { ( cd "$WS4" && node -e 'const a=require(process.argv[1]);const fs=require("fs");let b=fs.readFileSync("specs/active/0004.md");if(process.argv[3]==="changed")b=Buffer.concat([b,Buffer.from("x")]);const r=a.verifyBuffer("specs/active/0004.md",b,"approvals",process.argv[2]);process.stdout.write(r[0]+":"+r[1])' "$HERE/approval.js" "$T/plain/ceo.pub.pem" "$1" 2>/dev/null ); }
t "AC-7 verifyBuffer accepts the signed bytes"         "true:valid signature" "$(vb same)"
t "AC-7 verifyBuffer refuses other bytes"              "false:spec changed after approval" "$(vb changed)"

# ---- spec 0004 AC-5: container gate through the shared policy, one case per delta of §7.1 ----
# cg <ws> <path>: container mode (no --host), throwaway plain key; stdout is kept to prove no case prints a permissionDecision.
cg() { printf '{"hook_event_name":"PreToolUse","tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2" | env -u CLAUDE_PROJECT_DIR COMPANY_PUBKEY="$T/plain/ceo.pub.pem" node "$HERE/gate.js" >>"$T/cg.out" 2>/dev/null; echo $?; }
cws() { mkdir -p "$1/specs/active" "$1/approvals" "$1/src" "$1/harness/bin"; printf "$2" > "$1/specs/active/0001.md"; }
csign() { ( cd "$1" && node "$HERE/approval.js" sign specs/active/0001.md approvals "$T/plain/ceo.key.pem" >/dev/null 2>&1 ); }
C1="$T/c1"; cws "$C1" '# Spec c1\n\n## 1\n'; csign "$C1"
echo x > "$C1/harness/gate.js"; ln -s ../harness/gate.js "$C1/src/link.cs"; mkdir -p "$T/cout"; mkdir -p "$C1/docs"; ln -s "$T/cout/o.md" "$C1/docs/out.md"
t "AC-5 signed: code write is still allowed"                       0 "$(cg "$C1" "$C1/src/app.cs")"
t "AC-5 signed: harness/gate.js is blocked (enforcement)"          2 "$(cg "$C1" "$C1/harness/gate.js")"
t "AC-5 signed: src/CLAUDE.md is blocked (enforcement)"            2 "$(cg "$C1" "$C1/src/CLAUDE.md")"
t "AC-5 signed: .github/workflows/x.yml is blocked"                2 "$(cg "$C1" "$C1/.github/workflows/x.yml")"
t "AC-5 signed, no Unlocks: harness/bin/x.sh is blocked"           2 "$(cg "$C1" "$C1/harness/bin/x.sh")"
t "AC-5 signed: src/link.cs -> ../harness/gate.js is blocked"      2 "$(cg "$C1" "$C1/src/link.cs")"
t "AC-5 signed: .CLAUDE/settings.json is blocked (case fold)"      2 "$(cg "$C1" "$C1/.CLAUDE/settings.json")"
t "AC-5 signed: src/features/approvals/x.ts is blocked"            2 "$(cg "$C1" "$C1/src/features/approvals/x.ts")"
t "AC-5 signed: docs/out.md -> outside is blocked"                 2 "$(cg "$C1" "$C1/docs/out.md")"
C2="$T/c2"; cws "$C2" '# Spec c2\n- Unlocks: harness/bin/x.sh\n\n## 1\n'; csign "$C2"
t "AC-5 signed, Unlocks harness/bin/x.sh: that path is allowed"    0 "$(cg "$C2" "$C2/harness/bin/x.sh")"
t "AC-5 signed, Unlocks harness/bin/x.sh: another one is blocked"  2 "$(cg "$C2" "$C2/harness/bin/y.sh")"
C3="$T/c3"; cws "$C3" '# Spec c3\n- Unlocks: .claude/agents/**\n\n## 1\n'; csign "$C3"
t "AC-5 signed, Unlocks .claude/agents/**: still blocked"          2 "$(cg "$C3" "$C3/.claude/agents/x.md")"
C4="$T/c4"; cws "$C4" '# Spec c4\n\n## 1\n'
t "AC-5 unsigned: plans/x.md is allowed"                           0 "$(cg "$C4" "$C4/plans/x.md")"
t "AC-5 unsigned: STATE.md is allowed"                             0 "$(cg "$C4" "$C4/STATE.md")"
t "AC-5 unsigned: code write is still blocked"                     2 "$(cg "$C4" "$C4/src/app.cs")"
t "AC-5 unsigned: harness/bin/x.sh is blocked"                     2 "$(cg "$C4" "$C4/harness/bin/x.sh")"
t "AC-5 container ignores CLAUDE_PROJECT_DIR (root is cwd)"        2 "$(printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s"}}' "$C4" "$C4/src/app.cs" | CLAUDE_PROJECT_DIR="$C1" COMPANY_PUBKEY="$T/plain/ceo.pub.pem" node "$HERE/gate.js" >>"$T/cg.out" 2>/dev/null; echo $?)"
# spec 0004 AC-16 (delta 2026-11-22): the container never unlocks an enforcement file (REQ-17), whatever the signed header names
C5="$T/c5"; cws "$C5" '# Spec c5\n- Unlocks: harness/gate.js, CLAUDE.md\n\n## 1\n'; csign "$C5"
t "AC-16 container, signed and named: code write is allowed"       0 "$(cg "$C5" "$C5/src/app.cs")"
t "AC-16 container, signed and named: harness/gate.js is blocked"  2 "$(cg "$C5" "$C5/harness/gate.js")"
t "AC-16 container, signed and named: CLAUDE.md is blocked"        2 "$(cg "$C5" "$C5/CLAUDE.md")"
t "AC-5 no case prints a permissionDecision"                       0 "$(grep -c permissionDecision "$T/cg.out")"

# ---- spec 0004 AC-17 (delta 2026-11-22): enforcement entries apart in the preview, locked literals, non-ASCII ----
# Temp HOME as above; the preview reads no key. Entry kinds come from policy.unlockKinds (Ruling R-23).
HEAD17='ENFORCEMENT FILES THIS SIGNATURE OPENS (file-tool edits pass without a dialog while this spec is signed):'
pws() { # pws <dir> <Unlocks value>: a workspace whose single active spec carries that header line
  mkdir -p "$1/specs/active"; printf '%s\n' '# Spec p' '- Status: draft' "- Unlocks: $2" '' '## 1' 'x' > "$1/specs/active/0001.md"
}
pv() { ap "$1" --preview > "$T/pv.txt" 2> "$T/pv.err"; echo $?; }          # preview of <dir>: stdout in $T/pv.txt
BS='\'                                                                      # one backslash: the escapes asserted below are spelled with it, never stored as a decoded character
pline() { sed -n "$1p" "$T/pv.txt"; }
plines() { wc -l < "$T/pv.txt" | tr -d ' '; }
pblock() { grep -c '^  ' "$T/pv.txt"; }                                     # indented block lines
phead() { grep -c 'ENFORCEMENT FILES' "$T/pv.txt"; }
same() { if cmp -s "$T/pwant.txt" "$T/pv.txt"; then echo 0; else echo 1; fi; }
# three entries, two of them exact enforcement paths: exactly eight lines
P1="$T/p1"; pws "$P1" '`templates/**`, `CLAUDE.md`, `harness/gate.js`'; S1=$(sha12 "$P1/specs/active/0001.md")
printf 'Spec: specs/active/0001.md\nsha12: %s\nUnlocks: templates/**\n%s\n  CLAUDE.md\n  harness/gate.js\nHeader lint: ok\nSign with: harness/bin/approve.sh %s --expect %s\n' "$S1" "$HEAD17" "$P1" "$S1" > "$T/pwant.txt"
t "AC-17 preview with enforcement entries: exit 0"             0 "$(pv "$P1")"
t "AC-17 preview prints exactly the eight lines"               0 "$(same)"
t "AC-17 preview with enforcement entries: nothing on stderr"  0 "$([ ! -s "$T/pv.err" ]; echo $?)"
t "AC-17 the flat Unlocks line does not carry CLAUDE.md"       0 "$(pline 3 | grep -c 'CLAUDE.md')"
t "AC-17 the flat Unlocks line does not carry harness/gate.js" 0 "$(pline 3 | grep -c 'gate.js')"
t "AC-17 enforcement entries do not block signing: exit 0"     0 "$(ap "$P1" --expect "$S1" >/dev/null 2>&1; echo $?)"
t "AC-17 that signature left a record"                         1 "$(norec "$P1")"
# CLAUDE.md as the only entry: Unlocks: (none), then the block
P2="$T/p2"; pws "$P2" '`CLAUDE.md`'; S2=$(sha12 "$P2/specs/active/0001.md")
printf 'Spec: specs/active/0001.md\nsha12: %s\nUnlocks: (none)\n%s\n  CLAUDE.md\nHeader lint: ok\nSign with: harness/bin/approve.sh %s --expect %s\n' "$S2" "$HEAD17" "$P2" "$S2" > "$T/pwant.txt"
t "AC-17 enforcement-only header: exit 0"                      0 "$(pv "$P2")"
t "AC-17 enforcement-only header: line 3 is Unlocks: (none)"   "Unlocks: (none)" "$(pline 3)"
t "AC-17 enforcement-only header: the block follows"           0 "$(same)"
# a glob never goes to the block: the five lines of AC-7
P3="$T/p3"; pws "$P3" '`harness/**`'; S3=$(sha12 "$P3/specs/active/0001.md")
printf 'Spec: specs/active/0001.md\nsha12: %s\nUnlocks: harness/**\nHeader lint: ok\nSign with: harness/bin/approve.sh %s --expect %s\n' "$S3" "$P3" "$S3" > "$T/pwant.txt"
t "AC-17 glob-only header harness/**: exit 0"                  0 "$(pv "$P3")"
t "AC-17 glob-only header: the five lines, no block"           0 "$(same)"
t "AC-17 glob-only header: no heading line"                    0 "$(phead)"
# header order is kept inside the block; entries of the other kind keep theirs on the flat line
P4="$T/p4"; pws "$P4" 'harness/gate.js, src/a.cs, CLAUDE.md, `evals/**`, .mcp.json'
t "AC-17 mixed header: exit 0"                                 0 "$(pv "$P4")"
t "AC-17 mixed header: flat line holds the other entries"      "Unlocks: src/a.cs, evals/**" "$(pline 3)"
t "AC-17 mixed header: heading on line 4"                      "$HEAD17" "$(pline 4)"
t "AC-17 mixed header: block in header order"                  "  harness/gate.js|  CLAUDE.md|  .mcp.json|Header lint: ok" "$(pline 5)|$(pline 6)|$(pline 7)|$(pline 8)"
t "AC-17 mixed header: nine lines"                             9 "$(plines)"
# locked literals: on neither the Unlocks: line nor the block; a Header lint finding; --expect refuses
i=0
for e in 'harness/keys/k.pem' 'approvals/x.json' '.git/config' 'src/approvals/y.json' '.claude/settings.local.json' 'harness/bin/ceo-keygen.sh'; do
  i=$((i+1)); PL="$T/pl$i"; pws "$PL" "\`$e\`"; SL=$(sha12 "$PL/specs/active/0001.md")
  t "AC-17 locked literal $e: preview exits 0"                 0 "$(pv "$PL")"
  t "AC-17 locked literal $e: no block line"                   0 "$(pblock)"
  t "AC-17 locked literal $e: no heading line"                 0 "$(phead)"
  t "AC-17 locked literal $e: line 3 is Unlocks: (none)"       "Unlocks: (none)" "$(pline 3)"
  t "AC-17 locked literal $e: the finding quotes the entry"    "Header lint: \"$e\" names a locked path (signatures, keys, git metadata): no header opens it" "$(pline 4)"
  t "AC-17 locked literal $e: five lines"                      5 "$(plines)"
  t "AC-17 locked literal $e: --expect <right> exits 2"        2 "$(ap "$PL" --expect "$SL" >/dev/null 2>&1; echo $?)"
  t "AC-17 locked literal $e: no record"                       0 "$(norec "$PL")"
  t "AC-17 locked literal $e: wrong sha12 still exits 5"       5 "$(ap "$PL" --expect 000000000000 >/dev/null 2>&1; echo $?)"
done
P5="$T/p5"; pws "$P5" '`templates/**`, `harness/keys/k.pem`'; S5=$(sha12 "$P5/specs/active/0001.md")
t "AC-17 glob next to a locked literal: exit 0"                0 "$(pv "$P5")"
t "AC-17 glob next to a locked literal: line 3 exact"          "Unlocks: templates/**" "$(pline 3)"
t "AC-17 glob next to a locked literal: no block"              0 "$(phead)"
t "AC-17 glob next to a locked literal: finding"               0 "$(pline 4 | grep -q '^Header lint: "harness/keys/k.pem" names a locked path'; echo $?)"
t "AC-17 glob next to a locked literal: --expect exits 2"      2 "$(ap "$P5" --expect "$S5" >/dev/null 2>&1; echo $?)"
t "AC-17 glob next to a locked literal: no record"             0 "$(norec "$P5")"
P6="$T/p6"; pws "$P6" 'CLAUDE.md, harness/keys/k.pem, approvals/x.json'; S6=$(sha12 "$P6/specs/active/0001.md")
t "AC-17 enforcement and two locked literals: exit 0"          0 "$(pv "$P6")"
t "AC-17 enforcement and locked: the block holds CLAUDE.md only" "Unlocks: (none)|$HEAD17|  CLAUDE.md|1" "$(pline 3)|$(pline 4)|$(pline 5)|$(pblock)"
t "AC-17 enforcement and locked: both findings, joined by ;"   'Header lint: "harness/keys/k.pem" names a locked path (signatures, keys, git metadata): no header opens it; "approvals/x.json" names a locked path (signatures, keys, git metadata): no header opens it' "$(pline 6)"
t "AC-17 enforcement and locked: --expect exits 2"             2 "$(ap "$P6" --expect "$S6" >/dev/null 2>&1; echo $?)"
t "AC-17 enforcement and locked: no record"                    0 "$(norec "$P6")"
# the lock follows the environment (D-2): with HOME equal to the workspace, .claude/settings.json is locked; elsewhere it is an enforcement entry
PH="$T/ph"; pws "$PH" '.claude/settings.json'; SH=$(sha12 "$PH/specs/active/0001.md")
t "AC-17 .claude/settings.json, HOME elsewhere: in the block"  "Unlocks: (none)|$HEAD17|  .claude/settings.json|Header lint: ok" "$(pv "$PH" >/dev/null; echo "$(pline 3)|$(pline 4)|$(pline 5)|$(pline 6)")"
HOME="$PH" sh "$AP" "$PH" --preview > "$T/pv.txt" 2>/dev/null
t "AC-17 .claude/settings.json, HOME = workspace: locked"      'Unlocks: (none)|Header lint: ".claude/settings.json" names a locked path (signatures, keys, git metadata): no header opens it|0' "$(pline 3)|$(pline 4)|$(phead)"
# S-05: a format character makes the header invalid; other non-ASCII is printed as \uXXXX
P7="$T/p7"; pws "$P7" "$(printf 'docs/a\342\200\256b.md')"; S7=$(sha12 "$P7/specs/active/0001.md")
t "AC-17 entry with U+202E: preview exits 0"                   0 "$(pv "$P7")"
t "AC-17 entry with U+202E: line 3 starts Unlocks: INVALID:"   0 "$(pline 3 | grep -q '^Unlocks: INVALID:'; echo $?)"
t "AC-17 entry with U+202E: no block"                          0 "$(phead)"
t "AC-17 entry with U+202E: five lines"                        5 "$(plines)"
t "AC-17 entry with U+202E: shown as its escape"               0 "$(grep -qF "${BS}u202e" "$T/pv.txt"; echo $?)"
t "AC-17 entry with U+202E: the raw character is not printed"  0 "$(LC_ALL=C grep -c "$(printf '\342\200\256')" "$T/pv.txt")"
t "AC-17 entry with U+202E: --expect <right> exits 2"          2 "$(ap "$P7" --expect "$S7" >/dev/null 2>&1; echo $?)"
t "AC-17 entry with U+202E: no record"                         0 "$(norec "$P7")"
P8="$T/p8"; pws "$P8" "$(printf 'docs/caf\303\251.md, harness/\303\251.js')"
t "AC-17 entry with U+00E9: preview exits 0"                   0 "$(pv "$P8")"
t "AC-17 entry with U+00E9 under docs/: printed as its escape" "Unlocks: docs/caf${BS}u00e9.md" "$(pline 3)"
t "AC-17 enforcement entry with U+00E9: printed as its escape" "  harness/${BS}u00e9.js" "$(pline 5)"
t "AC-17 entry with U+00E9: no raw non-ASCII byte in the output" 0 "$(LC_ALL=C grep -c "$(printf '\303')" "$T/pv.txt")"

echo; if [ "$fail" -eq 0 ]; then echo "HARNESS TESTS GREEN: $pass passed, 0 failed"; else echo "HARNESS TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
