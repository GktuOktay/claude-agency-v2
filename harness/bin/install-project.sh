#!/bin/sh
# install-project.sh <project-dir> : add the host guard layer to a project (guard, loop, stop, notify hooks).
# Hooks point at this repo's harness by absolute path, so updates arrive with `git pull`. Does not touch existing settings.
set -eu
[ -n "${1:-}" ] && [ -d "$1" ] || { echo "usage: install-project.sh <project-dir>"; exit 2; }
REPO=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
P=$(CDPATH= cd -- "$1" && pwd)
F="$P/.claude/settings.json"
if [ -e "$F" ]; then echo "$F exists: merge the hooks by hand (see $REPO/.claude/settings.json, replace \$CLAUDE_PROJECT_DIR/harness with $REPO/harness)"; exit 1; fi
mkdir -p "$P/.claude" "$P/specs/active" "$P/approvals" "$P/docs"
REPO="$REPO" node -e '
const r = process.env.REPO + "/harness/";
const cmd = (f) => ({ type: "command", command: "node \"" + r + f + "\"" });
const s = { permissions: { deny: ["Read(~/.company/**)", "Edit(~/.company/**)", "Write(~/.company/**)"] }, hooks: {
  PreToolUse: [{ hooks: [cmd("loop.js")] }, { matcher: "Bash", hooks: [cmd("guard.js")] }, { matcher: "Write|Edit|MultiEdit|NotebookEdit", hooks: [cmd("guard.js")] }],
  Notification: [{ hooks: [cmd("notify.js")] }], Stop: [{ hooks: [cmd("stop.js")] }] } };
require("fs").writeFileSync(process.argv[1], JSON.stringify(s, null, 2) + "\n");' "$F"
echo "installed: $F (hooks -> $REPO/harness). Specs go in $P/specs/active, signatures in $P/approvals."
