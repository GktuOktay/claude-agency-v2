#!/bin/sh
# proxy-up.sh : internal network + allowlist egress proxy. Containers on company-int can reach nothing except through the proxy.
# ALLOW_HOSTS (comma separated, default api.anthropic.com). Package registries are NOT allowed by default (supply-chain risk, see docs).
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
IMAGE="${COMPANY_IMAGE:-company-agent:dev}"
docker network inspect company-int >/dev/null 2>&1 || docker network create --internal company-int >/dev/null
if docker ps --format '{{.Names}}' | grep -qx company-proxy; then echo "proxy already running"; exit 0; fi
docker rm -f company-proxy >/dev/null 2>&1 || true
docker run -d --name company-proxy --network company-int --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --pids-limit 32 -e "ALLOW_HOSTS=${ALLOW_HOSTS:-api.anthropic.com}" \
  -v "$HERE/docker/proxy.js":/proxy.js:ro "$IMAGE" node /proxy.js >/dev/null
docker network connect bridge company-proxy
echo "proxy up; allowed hosts: ${ALLOW_HOSTS:-api.anthropic.com}"
