#!/bin/sh
# install-project.sh <project-dir> : add the host hook set of spec 0004 to a project: the signature gate in host mode
# for the file tools, the envelope guard for Bash, and the loop, stop and notify hooks.
# Hooks point at this repo's harness by absolute path, so updates arrive with `git pull`. Does not touch existing
# settings: for a project that already has .claude/settings.json it prints the entries to merge by hand and exits 1.
set -eu
[ -n "${1:-}" ] && [ -d "$1" ] || { echo "usage: install-project.sh <project-dir>"; exit 2; }
REPO=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
P=$(CDPATH= cd -- "$1" && pwd)
F="$P/.claude/settings.json"
FILE_TOOLS='Write|Edit|MultiEdit|NotebookEdit'
if [ -e "$F" ]; then
  echo "$F exists: merge the hooks by hand (see $REPO/.claude/settings.json, replace \$CLAUDE_PROJECT_DIR/harness with $REPO/harness)"
  echo "Entries of spec 0004 to merge into hooks.PreToolUse (projects installed earlier keep the old hooks until this is done):"
  echo "  1. add or replace, matcher \"$FILE_TOOLS\": node \"$REPO/harness/gate.js\" --host || exit 2"
  echo "  2. add or replace, matcher \"Bash\": node \"$REPO/harness/guard.js\" || exit 2"
  echo "  3. remove the entry with matcher \"$FILE_TOOLS\" that runs guard.js: the gate alone decides file-tool writes"
  exit 1
fi
mkdir -p "$P/.claude" "$P/specs/active" "$P/approvals" "$P/docs"
REPO="$REPO" FILE_TOOLS="$FILE_TOOLS" node -e '
const r = process.env.REPO + "/harness/";
// A gate or guard hook that crashes or is missing must block: "|| exit 2". The other hooks never block on a crash.
const cmd = (f, tail) => ({ type: "command", command: "node \"" + r + f + "\"" + (tail || "") });
const s = { permissions: { deny: ["Read(~/.company/**)", "Edit(~/.company/**)", "Write(~/.company/**)"] }, hooks: {
  PreToolUse: [{ hooks: [cmd("loop.js")] }, { matcher: "Bash", hooks: [cmd("guard.js", " || exit 2")] }, { matcher: process.env.FILE_TOOLS, hooks: [cmd("gate.js", " --host || exit 2")] }],
  Notification: [{ hooks: [cmd("notify.js")] }], Stop: [{ hooks: [cmd("stop.js")] }] } };
require("fs").writeFileSync(process.argv[1], JSON.stringify(s, null, 2) + "\n");' "$F"
echo "installed: $F (hooks -> $REPO/harness). Specs go in $P/specs/active, signatures in $P/approvals."
