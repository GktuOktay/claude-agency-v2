#!/bin/sh
# python.sh : the agent image can run Python and install packages through the allowlist proxy, and only through it.
# Needs Docker, the built image (company-agent:dev) and the proxy (harness/bin/proxy-up.sh). Not part of CI.
IMG="${COMPANY_IMAGE:-company-agent:dev}"
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected '$2', got '$3')"; fi; }
docker ps --format '{{.Names}}' | grep -qx company-proxy || { echo "proxy not running: harness/bin/proxy-up.sh"; exit 1; }
run() { docker run --rm --network company-int --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 \
  --tmpfs /tmp:rw,size=512m --tmpfs /home/node:rw,size=1g,uid=1000,gid=1000 -e HOME=/home/node \
  -e HTTPS_PROXY=http://company-proxy:3128 -e HTTP_PROXY=http://company-proxy:3128 "$IMG" sh -c "$1" 2>&1; }

t "python3 is present" 1 "$(run 'python3 --version' | grep -c '^Python 3')"
out=$(run 'cd /tmp && python3 -m venv v && v/bin/python -m pip install --quiet --no-cache-dir packaging==24.2 && v/bin/python -c "import packaging; print(\"pkg=\"+packaging.__version__)"')
t "venv + pip install from PyPI works through the proxy (read-only root)" 1 "$(printf '%s' "$out" | grep -c '^pkg=24.2')"
out=$(run 'python3 -c "
import urllib.request as u
try:
    u.urlopen(\"https://example.com\", timeout=5); print(\"other=open\")
except Exception: print(\"other=blocked\")"')
t "a host outside the allowlist stays blocked" 1 "$(printf '%s' "$out" | grep -c '^other=blocked')"
out=$(run 'env -u HTTPS_PROXY -u HTTP_PROXY python3 -c "
import urllib.request as u
try:
    u.urlopen(\"https://pypi.org\", timeout=5); print(\"direct=open\")
except Exception: print(\"direct=blocked\")"')
t "direct internet (without the proxy) stays blocked" 1 "$(printf '%s' "$out" | grep -c '^direct=blocked')"
echo; if [ "$fail" -eq 0 ]; then echo "PYTHON IMAGE TESTS GREEN: $pass passed, 0 failed"; else echo "PYTHON IMAGE TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
