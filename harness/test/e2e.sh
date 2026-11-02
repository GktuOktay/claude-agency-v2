#!/bin/sh
# harness/test/e2e.sh: runs harness/bin/company-run.sh end to end against a STAND-IN for the `claude` binary.
# Verifies the whole host-to-container path: signature -> mount mode -> hardened container -> proxy -> exit code.
# It does NOT prove model behaviour (no model is called, no real token is used): that needs the live run (B5).
# Needs Docker, the agent image and the proxy; it is NOT part of `check`.
#   COMPANY_E2E_BASE  base image (default company-agent:dev)
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BASE="${COMPANY_E2E_BASE:-company-agent:dev}"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected '$2', got '$3')"; fi; }
export COMPANY_TEST_MODE=1 COMPANY_TEST_PASSPHRASE='throwaway-test-pass' COMPANY_NOTIFY=off

docker image inspect "$BASE" >/dev/null 2>&1 || { echo "missing image $BASE: harness/bin/build-image.sh"; exit 1; }
"$HERE/bin/proxy-up.sh" >/dev/null 2>&1
docker ps --format '{{.Names}}' | grep -qx company-proxy || { echo "proxy did not start"; exit 1; }

# stand-in claude: reports what the container allows, never calls a model
mkdir -p "$T/ctx"
cat > "$T/ctx/claude" <<'EOF'
#!/bin/sh
w() { if ( : > "$1" ) 2>/dev/null; then echo "$2=writable"; else echo "$2=readonly"; fi; }
w /work/src/probe src; w /work/specs/probe specs; w /work/docs/probe docs; w /work/approvals/probe approvals
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && echo "token=present" || echo "token=absent"
[ -n "${HTTPS_PROXY:-}" ] && echo "proxy=set" || echo "proxy=unset"
echo "args=$*"
node -e 'require("https").get("https://example.com",{agent:false,timeout:3000},()=>console.log("direct=open")).on("error",()=>console.log("direct=blocked")).on("timeout",function(){this.destroy()})'
[ -e /work/.fail ] && exit 3
exit 0
EOF
printf 'FROM %s\nUSER root\nCOPY claude /opt/stub/claude\nRUN chmod 755 /opt/stub/claude\nENV PATH=/opt/stub:$PATH\nUSER 1000:1000\n' "$BASE" > "$T/ctx/Dockerfile"
docker build -q -t company-agent:e2e "$T/ctx" >/dev/null || { echo "stand-in image build failed"; exit 1; }

# a private copy of the harness with a throwaway CEO key, so the real key is never touched
cp -R "$HERE" "$T/harness"; rm -rf "$T/harness/keys"; mkdir -p "$T/harness/keys"
node "$HERE/approval.js" keygen "$T/k" >/dev/null; cp "$T/k/ceo.pub.pem" "$T/harness/keys/"
printf 'CLAUDE_CODE_OAUTH_TOKEN=fake-test-token-not-a-credential\n' > "$T/agent.env"; chmod 600 "$T/agent.env"
WS="$T/ws"; mkdir -p "$WS/specs/active" "$WS/src"; printf '# Spec 0001\nAC-1: hello\n' > "$WS/specs/active/0001.md"

run() { COMPANY_IMAGE=company-agent:e2e COMPANY_TOKEN_FILE="$T/agent.env" sh "$T/harness/bin/company-run.sh" "$WS" "probe" "$@" 2>"$T/err"; }
has() { printf '%s' "$1" | grep -qx "$2" && echo yes || echo no; }

out=$(run); rc=$?
t "unsigned: runs and exits 0"                       0 "$rc"
t "unsigned: reported as plan mode"                  1 "$(grep -c 'mode=plan' "$T/err")"
t "unsigned: code area is read-only"                 yes "$(has "$out" src=readonly)"
t "unsigned: specs/ stays writable (drafting)"       yes "$(has "$out" specs=writable)"
t "unsigned: docs/ stays writable"                   yes "$(has "$out" docs=writable)"
t "unsigned: approvals/ is read-only"                yes "$(has "$out" approvals=readonly)"
t "token reaches the container (value never shown)"  yes "$(has "$out" token=present)"
t "proxy variable is set inside the container"       yes "$(has "$out" proxy=set)"
t "direct internet from the container is blocked"    yes "$(has "$out" direct=blocked)"
t "container settings file is passed to claude"      1 "$(printf '%s' "$out" | grep -c -- '--settings /harness/container-settings.json')"

( cd "$WS" && node "$T/harness/approval.js" sign specs/active/0001.md approvals "$T/k/ceo.key.pem" >/dev/null )
out=$(run); rc=$?
t "signed: reported as build mode"                   1 "$(grep -c 'mode=build' "$T/err")"
t "signed: code area is writable"                    yes "$(has "$out" src=writable)"
t "signed: approvals/ is STILL read-only"            yes "$(has "$out" approvals=readonly)"

echo "AC-2: edited after signing" >> "$WS/specs/active/0001.md"
out=$(run)
t "spec edited after signing: back to plan mode"     1 "$(grep -c 'mode=plan' "$T/err")"
t "spec edited after signing: code area read-only"   yes "$(has "$out" src=readonly)"

touch "$WS/.fail"; run >/dev/null; rc=$?
t "container failure becomes the script's exit code" 3 "$rc"
rm -f "$WS/.fail"

chmod 644 "$T/agent.env"; run >/dev/null; rc=$?
t "token file with loose mode is refused"            1 "$rc"
chmod 600 "$T/agent.env"
t "missing token file is refused"                    1 "$(COMPANY_IMAGE=company-agent:e2e COMPANY_TOKEN_FILE="$T/none.env" sh "$T/harness/bin/company-run.sh" "$WS" x >/dev/null 2>&1; echo $?)"

docker rmi company-agent:e2e >/dev/null 2>&1
echo; if [ "$fail" -eq 0 ]; then echo "E2E (stand-in claude) GREEN: $pass passed, 0 failed"; else echo "E2E FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
