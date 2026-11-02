#!/bin/sh
# harness/bin/visual-check.sh: screenshots + axe for a built page, in a SEPARATE, locked-down container.
# Runs on the host (trusted); the agent container never starts it and has no Docker socket.
#   usage: visual-check.sh <page-dir> <out-dir> [seconds]
# The browser runs WITHOUT Chromium's sandbox (it cannot start under the hardened default seccomp), so it gets
# nothing worth stealing: no network, no token, page dir read-only, only <out-dir> writable. Decision: AppSec
# review 2026-11-02 (option C2); the sandbox-less browser inside the agent container is NOT allowed.
set -u
IMG="${COMPANY_IMAGE:-company-agent:visual}"
PAGE="${1:-}"; OUT="${2:-}"; SECS="${3:-120}"
[ -d "$PAGE" ] && [ -n "$OUT" ] || { echo "usage: visual-check.sh <page-dir> <out-dir> [seconds]" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }
mkdir -p "$OUT" && chmod 777 "$OUT" || exit 2
PAGE=$(CDPATH= cd -- "$PAGE" && pwd); OUT=$(CDPATH= cd -- "$OUT" && pwd)
NAME="company-visual-$$"
docker run --rm --name "$NAME" --network none \
  --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 \
  --memory 1g --cpus 2 --pids-limit 256 \
  --tmpfs /tmp:rw,size=256m --tmpfs /home/node:rw,size=256m,uid=1000,gid=1000 -e HOME=/home/node -e SHOT_TIMEOUT_MS=$((SECS * 1000)) \
  -v "$PAGE:/page:ro" -v "$OUT:/out" \
  --entrypoint node "$IMG" /opt/visual/shot.js /page /out --no-sandbox &
RUN=$!
# host wall-clock watchdog (macOS has no `timeout`)
( sleep $((SECS + 15)); docker kill "$NAME" >/dev/null 2>&1 ) &
DOG=$!
wait "$RUN"; rc=$?
kill "$DOG" 2>/dev/null; wait "$DOG" 2>/dev/null
exit "$rc"
