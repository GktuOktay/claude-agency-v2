#!/bin/sh
# company-run.sh <workspace-dir> "<task>" [agent-name]
# Host-side, trusted. Runs a headless Claude INSIDE a hardened container.
# The container's mounts are chosen from the CEO signature:
#   signed spec  -> BUILD mode: workspace writable
#   no signature -> PLAN mode : workspace read-only except specs/ and docs/   (enforced by the OS, not by a hook)
# The token file is handed to docker with --env-file; this script never reads or prints it.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)        # <repo>/harness
REPO=$(dirname "$HERE")
WS=$(cd "$1" && pwd); TASK=$2; AGENT=${3:-}
ENVF="${COMPANY_TOKEN_FILE:-$HOME/.company/agent.env}"
PUB="$HERE/keys/ceo.pub.pem"
IMAGE="${COMPANY_IMAGE:-company-agent:dev}"
MODEL="${COMPANY_MODEL:-haiku}"

[ -f "$PUB" ]  || { echo "missing $PUB: run harness/bin/ceo-keygen.sh first"; exit 1; }
[ -f "$ENVF" ] || { echo "missing $ENVF: create the agent token file first (see harness/README.md)"; exit 1; }
perm=$(stat -f %Lp "$ENVF" 2>/dev/null || stat -c %a "$ENVF"); [ "$perm" = 600 ] || { echo "token file must be mode 600 (is $perm)"; exit 1; }
docker ps --format '{{.Names}}' | grep -qx company-proxy || { echo "proxy not running: harness/bin/proxy-up.sh"; exit 1; }
mkdir -p "$WS/approvals" "$WS/specs/active" "$WS/docs"

# Which mode? Exactly one active spec with a valid CEO signature -> build.
n=$(ls "$WS/specs/active"/*.md 2>/dev/null | wc -l | tr -d ' ')
MODE=plan
if [ "$n" = 1 ]; then
  spec=$(cd "$WS" && ls specs/active/*.md)
  if (cd "$WS" && node "$HERE/approval.js" verify "$spec" approvals "$PUB" >/dev/null 2>&1); then MODE=build; fi
fi
echo "[company-run] mode=$MODE active_specs=$n workspace=$WS" >&2

if [ "$MODE" = build ]; then
  WSMOUNT="-v $WS:/work:rw"
else
  WSMOUNT="-v $WS:/work:ro -v $WS/specs:/work/specs:rw -v $WS/docs:/work/docs:rw"
fi
AGENTFLAG=""; [ -n "$AGENT" ] && AGENTFLAG="--agent $AGENT"
CLAUDE_DIR=""
# The company's agents and skills are mounted read-only so the agent cannot rewrite its own playbooks (SOP-03).
[ -d "$REPO/.claude/agents" ] && CLAUDE_DIR="-v $REPO/.claude/agents:/home/node/.claude/agents:ro -v $REPO/.claude/skills:/home/node/.claude/skills:ro"
[ -f "$REPO/CLAUDE.md" ] && CLAUDE_DIR="$CLAUDE_DIR -v $REPO/CLAUDE.md:/home/node/.claude/CLAUDE.md:ro"

# shellcheck disable=SC2086
exec docker run --rm --network company-int --read-only --cap-drop ALL --security-opt no-new-privileges \
  --user 1000:1000 --memory "${COMPANY_MEMORY:-4g}" --pids-limit 512 --cpus 2 \
  --tmpfs /tmp:rw,size=512m --tmpfs /home/node:rw,size=1g,uid=1000,gid=1000 \
  --tmpfs /home/node/.claude:rw,size=64m,uid=1000,gid=1000 -e HOME=/home/node \
  -e HTTPS_PROXY=http://company-proxy:3128 -e HTTP_PROXY=http://company-proxy:3128 \
  -e DISABLE_TELEMETRY=1 -e DISABLE_AUTOUPDATER=1 -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  --env-file "$ENVF" \
  $WSMOUNT -v "$WS/approvals":/work/approvals:ro \
  -v "$HERE":/harness:ro $CLAUDE_DIR -w /work \
  "$IMAGE" claude -p "$TASK" --model "$MODEL" --max-turns "${COMPANY_MAX_TURNS:-12}" \
  --settings /harness/container-settings.json --permission-mode acceptEdits $AGENTFLAG
