#!/bin/sh
# install-global.sh [--uninstall] : make the company units available in EVERY project and chat.
# Symlinks agents, skills and the routing rule into ~/.claude (or $CLAUDE_HOME). Single source of truth stays in this repo,
# so a `git pull` updates every project. Existing real files are never overwritten; --uninstall removes only our links.
set -eu
REPO=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
H="${CLAUDE_HOME:-$HOME/.claude}"
mode=install; [ "${1:-}" = "--uninstall" ] && mode=uninstall
n=0; skipped=0
link() {
  src=$1; dst=$2
  if [ "$mode" = uninstall ]; then
    if [ -L "$dst" ] && [ "$(readlink "$dst")" = "$src" ]; then rm "$dst"; n=$((n+1)); fi
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  if [ -L "$dst" ]; then
    [ "$(readlink "$dst")" = "$src" ] && return 0
    case "$(readlink "$dst")" in "$REPO"/*) rm "$dst";; *) echo "skip $dst (points elsewhere)"; skipped=$((skipped+1)); return 0;; esac
  elif [ -e "$dst" ]; then echo "skip $dst (exists, not ours)"; skipped=$((skipped+1)); return 0; fi
  ln -s "$src" "$dst"; n=$((n+1))
}
for f in "$REPO"/.claude/agents/*.md; do link "$f" "$H/agents/$(basename "$f")"; done
for d in "$REPO"/.claude/skills/*/; do d=${d%/}; link "$d" "$H/skills/$(basename "$d")"; done
link "$REPO/.claude/rules/yonlendirme.md" "$H/rules/yonlendirme.md"
echo "$mode: $n link(s) changed, $skipped skipped, target $H"
