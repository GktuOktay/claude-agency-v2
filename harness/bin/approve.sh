#!/bin/sh
# approve.sh <workspace-dir> --preview          : shows what would be signed (path, sha12, Unlocks, header lint). Reads no key.
# approve.sh <workspace-dir> --expect <sha12>   : CEO signs the single active spec, only if its bytes still have that sha12 (spec 0004 §7.5).
# Exit: 0 ok · 1 no key, active spec count != 1 or main worktree not found · 2 usage (no --expect, both flags, invalid header) · 5 sha mismatch.
# The record goes to the main worktree's approvals/ (same directory as before when the workspace is the main worktree).
# Containers never have the key. On the host this command is a CEO decision: guard.js shows the app's permission dialog; headless runs are refused.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
USAGE="usage: approve.sh <workspace-dir> --preview | --expect <sha12>"
WSARG=; PREVIEW=0; EXPECT=; HAVE_EXPECT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --preview) PREVIEW=1 ;;
    --expect) HAVE_EXPECT=1; [ $# -ge 2 ] || { echo "$USAGE"; exit 2; }; EXPECT=$2; shift ;;
    -*) echo "$USAGE"; exit 2 ;;
    *) [ -z "$WSARG" ] || { echo "$USAGE"; exit 2; }; WSARG=$1 ;;
  esac
  shift
done
[ -n "$WSARG" ] || { echo "$USAGE"; exit 2; }
if [ "$PREVIEW" = 1 ] && [ "$HAVE_EXPECT" = 1 ]; then echo "use either --preview or --expect"; exit 2; fi
if [ "$PREVIEW" = 0 ] && [ "$HAVE_EXPECT" = 0 ]; then
  echo "refused: signing needs --expect <sha12>. Preview first: harness/bin/approve.sh $WSARG --preview"; exit 2
fi
if [ "$HAVE_EXPECT" = 1 ] && [ -z "$EXPECT" ]; then echo "$USAGE"; exit 2; fi
WS=$(cd "$WSARG" && pwd)
KEY="$HOME/.company/keys/ceo.key.pem"
if [ "$PREVIEW" = 0 ]; then [ -f "$KEY" ] || { echo "no CEO key: run harness/bin/ceo-keygen.sh first"; exit 1; }; fi
cd "$WS"
n=$(ls specs/active/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$n" = 1 ] || { echo "exactly one active spec is required (found $n)"; exit 1; }
spec=$(ls specs/active/*.md)

# One read of the spec: sha12 and header come from the same bytes. preview prints the five lines; check prints the main worktree.
inspect() {
  node -e '
    const fs = require("fs"), crypto = require("crypto");
    const [pol, spec, ws, arg, mode, expect] = process.argv.slice(1);
    const p = require(pol);
    const show = (s) => (/[\u0000-\u001f\u007f]/.test(s) ? p.quote(s) : s);
    const buf = fs.readFileSync(spec);
    const sha12 = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
    const h = p.parseHeader(buf.toString("utf8"));
    if (mode === "preview") {
      const unlocks = h.errors.length ? "INVALID: " + show(h.errors[0]) : h.unlocks.length ? h.unlocks.map(show).join(", ") : "(none)";
      console.log("Spec: " + show(spec));
      console.log("sha12: " + sha12);
      console.log("Unlocks: " + unlocks);
      console.log("Header lint: " + (h.errors.length ? h.errors.map(show).join("; ") : "ok"));
      console.log("Sign with: harness/bin/approve.sh " + show(arg) + " --expect " + sha12);
      process.exit(0);
    }
    if (sha12 !== expect) { console.error("REFUSED: file changed since preview (sha12 is " + sha12 + ")"); process.exit(5); }
    if (h.errors.length) { console.error("REFUSED: invalid header: " + h.errors.map(show).join("; ")); process.exit(2); }
    let main;
    try { main = p.mainWorktree(ws); } catch { console.error("REFUSED: main worktree of the workspace not found (git lookup failed)"); process.exit(1); }
    console.log(main);
  ' "$HERE/policy.js" "$spec" "$WS" "$WSARG" "$1" "$EXPECT"
}

if [ "$PREVIEW" = 1 ]; then inspect preview; exit $?; fi
MAIN=$(inspect check) || exit $?
[ -n "$MAIN" ] || { echo "REFUSED: main worktree of the workspace not found"; exit 1; }
echo "Spec to approve: $spec"
echo "Signing freezes the spec: any later edit voids the signature."
node "$HERE/approval.js" sign "$spec" "$MAIN/approvals" "$KEY" --expect "$EXPECT"
