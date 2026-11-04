#!/bin/sh
# token-setup.sh : store the agent token in ~/.company/agent.env (mode 600) without it touching chat, repo or logs.
# Run it in YOUR terminal after `claude setup-token` printed the token. The token is read silently from the keyboard,
# never passed as an argument (so it is not in the process list or shell history) and never echoed.
set -eu
umask 077
DIR="${COMPANY_HOME:-$HOME/.company}"
F="$DIR/agent.env"
mkdir -p "$DIR"; chmod 700 "$DIR"
if [ -f "$F" ]; then printf 'agent.env exists. Overwrite? [y/N] '; read -r a; [ "$a" = y ] || { echo "kept the existing file"; exit 0; }; fi
printf 'Paste the token (input hidden), then Enter: '
stty -echo 2>/dev/null || true
read -r T
stty echo 2>/dev/null || true
echo
[ -n "$T" ] || { echo "empty token, nothing written"; exit 1; }
printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "$T" > "$F"
chmod 600 "$F"
unset T
echo "written: $F (mode $(stat -f %Lp "$F" 2>/dev/null || stat -c %a "$F")). When the run is over: rm $F"
