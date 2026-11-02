#!/bin/sh
# approve.sh <workspace-dir> : CEO signs the single active spec of a workspace.
# Needs a real terminal and the CEO passphrase. Agents never run this and cannot: the private key is not in any container.
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
echo "Read it first. Open questions must be empty. Signing freezes it: any later edit voids the signature."
node "$HERE/approval.js" sign "$spec" approvals "$KEY"
