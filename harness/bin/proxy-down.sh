#!/bin/sh
# proxy-down.sh : stop the proxy and remove the internal network (leaves nothing running).
docker rm -f company-proxy >/dev/null 2>&1 && echo "proxy removed" || echo "proxy was not running"
docker network rm company-int >/dev/null 2>&1 && echo "network removed" || true
