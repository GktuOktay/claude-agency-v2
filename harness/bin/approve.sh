#!/bin/sh
# approve.sh <workspace-dir> : CEO signs the single active spec of a workspace.
# Containers never have the key. On the host this command is a CEO decision: guard.js shows the app's permission dialog; headless runs are refused.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WS=$(cd "${1:?usage: approve.sh <workspace-dir>}" && pwd)
KEY="$HOME/.company/keys/ceo.key.pem"
[ -f "$KEY" ] || { echo "no CEO key: run harness/bin/ceo-keygen.sh first"; exit 1; }
cd "$WS"
n=$(ls specs/active/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$n" = 1 ] || { echo "exactly one active spec is required (found $n)"; exit 1; }
spec=$(ls specs/active/*.md)
echo "Spec to approve: $spec"
echo "Signing freezes the spec: any later edit voids the signature."
node "$HERE/approval.js" sign "$spec" approvals "$KEY"
