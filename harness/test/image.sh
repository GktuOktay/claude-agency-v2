#!/bin/sh
# harness/test/image.sh: verifies the agent image. Needs Docker and the built image; it is NOT part of `check`.
# Parts 6 and 7 need the proxy (`harness/bin/proxy-up.sh`) with the registries enabled.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
IMG="${COMPANY_IMAGE:-company-agent:dev}"
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected '$2', got '$3')"; fi; }
HARD="--read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --memory 4g --pids-limit 512 --tmpfs /tmp:rw,size=512m --tmpfs /home/node:rw,size=1g,uid=1000,gid=1000 -e HOME=/home/node"
# shellcheck disable=SC2086
off() { docker run --rm --network none $HARD --entrypoint sh "$IMG" -c "$1" 2>&1; }
# shellcheck disable=SC2086
via() { docker run --rm --network company-int $HARD -e HTTPS_PROXY=http://company-proxy:3128 -e HTTP_PROXY=http://company-proxy:3128 --entrypoint sh "$IMG" -c "$1" 2>&1; }

want_claude=$(sed -n 's/^ARG CLAUDE_CODE_VERSION=//p' "$HERE/docker/Dockerfile")
want_gfy=$(sed -n 's/^ARG GRAPHIFY_VERSION=//p' "$HERE/docker/Dockerfile")

t "1 claude version is the pinned one"          "$want_claude (Claude Code)" "$(off 'claude --version')"
t "2 dotnet SDK is 10.x"                         "10" "$(off 'dotnet --version' | cut -d. -f1)"
t "3 graphify is the pinned version"             "yes" "$(off 'graphify --help >/dev/null 2>&1 && /opt/graphify/bin/pip show graphifyy 2>/dev/null' | grep -q "Version: $want_gfy" && echo yes || echo no)"
t "4 runs as uid 1000, not root"                 "1000" "$(off 'id -u')"
t "5 offline build of a console app (read-only root)" "ok" "$(off 'cd /tmp && dotnet new console -o app --no-restore >/dev/null && cd app && dotnet build -nologo 2>&1 | grep -q "Build succeeded" && echo ok || echo fail' | tail -1)"
t "5b offline build leaves no process running"   "0" "$(off 'cd /tmp && dotnet build-server shutdown >/dev/null 2>&1; ps -eo comm | grep -c "[d]otnet"' | tail -1)"
if docker ps --format '{{.Names}}' | grep -qx company-proxy; then
  t "6 NuGet package restore through the proxy"  "ok" "$(via 'cd /tmp && dotnet new console -o p >/dev/null 2>&1 && cd p && dotnet add package Newtonsoft.Json --version 13.0.3 2>&1 | tail -3 | grep -qiE "restored|PackageReference" && dotnet build -nologo 2>&1 | grep -q "Build succeeded" && echo ok || echo fail' | tail -1)"
  t "7 npm registry reachable through the proxy" "ok" "$(via 'npm view is-odd version >/dev/null 2>&1 && echo ok || echo fail' | tail -1)"
  t "8 other hosts stay blocked"                 "blocked" "$(via 'node -e "require(\"https\").get(\"https://example.com\",{agent:false},r=>{console.log(\"open\")}).on(\"error\",()=>console.log(\"blocked\"))"' | tail -1)"
else
  echo "skip  6-8 (proxy not running: harness/bin/proxy-up.sh)"
fi
echo; if [ "$fail" -eq 0 ]; then echo "IMAGE TESTS GREEN: $pass passed, 0 failed"; else echo "IMAGE TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
