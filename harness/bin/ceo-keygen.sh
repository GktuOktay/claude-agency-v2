#!/bin/sh
# ceo-keygen.sh : CEO runs this ONCE in a real terminal (it asks for a passphrase twice-worth of care).
# Private key -> ~/.company/keys/ceo.key.pem (mode 600, outside the repo, never mounted into containers)
# Public key  -> harness/keys/ceo.pub.pem     (committed; containers verify with it)
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
KEYDIR="$HOME/.company/keys"
[ -t 0 ] || { echo "run this in an interactive terminal"; exit 1; }
[ -e "$KEYDIR/ceo.key.pem" ] && { echo "key already exists at $KEYDIR/ceo.key.pem; refusing to overwrite"; exit 1; }
mkdir -p "$KEYDIR"; chmod 700 "$HOME/.company" "$KEYDIR"
umask 077
node "$HERE/approval.js" keygen "$KEYDIR"
cp "$KEYDIR/ceo.pub.pem" "$HERE/keys/ceo.pub.pem"
echo "public key installed at harness/keys/ceo.pub.pem. Keep the passphrase safe: it is the only way to approve work."
