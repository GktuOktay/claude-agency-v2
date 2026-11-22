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

echo; if [ "$fail" -eq 0 ]; then echo "HARNESS TESTS GREEN: $pass passed, 0 failed"; else echo "HARNESS TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
