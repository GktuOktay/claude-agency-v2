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

echo; if [ "$fail" -eq 0 ]; then echo "HARNESS TESTS GREEN: $pass passed, 0 failed"; else echo "HARNESS TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
