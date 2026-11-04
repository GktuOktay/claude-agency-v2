#!/bin/sh
# proxy-up.sh : internal network + allowlist egress proxy. Containers on company-int can reach nothing except through the proxy.
# Allowed hosts: the model service always; package registries (read-only downloads) unless COMPANY_REGISTRIES=none.
#   COMPANY_REGISTRIES  comma list of: nuget, npm, pypi   (default: nuget,npm,pypi)
#   ALLOW_HOSTS         base list (default: api.anthropic.com)
# Registries are enabled by default because .NET, React and Python (Django) builds need them. They carry supply-chain risk:
# a downloaded package runs inside the hardened container (no secrets besides the agent token, no other egress), and
# nothing reaches production without audit and the CEO's approval. Set COMPANY_REGISTRIES=none to turn them off.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
IMAGE="${COMPANY_IMAGE:-company-agent:dev}"
HOSTS="${ALLOW_HOSTS:-api.anthropic.com}"
REG="${COMPANY_REGISTRIES-nuget,npm,pypi}"
NUGET_HOSTS="${COMPANY_NUGET_HOSTS:-api.nuget.org}"
case ",$REG," in *,nuget,*) HOSTS="$HOSTS,$NUGET_HOSTS";; esac
case ",$REG," in *,npm,*) HOSTS="$HOSTS,registry.npmjs.org";; esac
case ",$REG," in *,pypi,*) HOSTS="$HOSTS,${COMPANY_PYPI_HOSTS:-pypi.org,files.pythonhosted.org}";; esac
docker network inspect company-int >/dev/null 2>&1 || docker network create --internal company-int >/dev/null
if docker ps --format '{{.Names}}' | grep -qx company-proxy; then echo "proxy already running"; exit 0; fi
docker rm -f company-proxy >/dev/null 2>&1 || true
docker run -d --name company-proxy --network company-int --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --pids-limit 32 -e "ALLOW_HOSTS=$HOSTS" \
  -v "$HERE/docker/proxy.js":/proxy.js:ro "$IMAGE" node /proxy.js >/dev/null
docker network connect bridge company-proxy
echo "proxy up; allowed hosts: $HOSTS"
