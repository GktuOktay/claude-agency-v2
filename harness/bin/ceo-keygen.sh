#!/bin/sh
# ceo-keygen.sh [--passphrase] : creates the CEO signing key ONCE. Default: no password (approval is one click in the app's permission dialog).
# With --passphrase the key is encrypted and signing needs a real terminal and the passphrase.
# Private key -> ~/.company/keys/ceo.key.pem (mode 600, outside the repo, never mounted into containers)
# Public key  -> harness/keys/ceo.pub.pem     (committed; containers verify with it)
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
KEYDIR="$HOME/.company/keys"
[ -e "$KEYDIR/ceo.key.pem" ] && { echo "key already exists at $KEYDIR/ceo.key.pem; refusing to overwrite"; exit 1; }
mkdir -p "$KEYDIR"; chmod 700 "$HOME/.company" "$KEYDIR"
umask 077
if [ "${1:-}" = "--passphrase" ]; then
  [ -t 0 ] || { echo "--passphrase needs an interactive terminal"; exit 1; }
  node "$HERE/approval.js" keygen "$KEYDIR"
else
  node "$HERE/approval.js" keygen "$KEYDIR" --no-passphrase
fi
cp "$KEYDIR/ceo.pub.pem" "$HERE/keys/ceo.pub.pem"
echo "public key installed at harness/keys/ceo.pub.pem. Private key: $KEYDIR/ceo.key.pem (mode 600, never in the repo or any container)."
