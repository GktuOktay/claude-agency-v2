#!/bin/sh
# build-image.sh : build the agent image (pinned official Claude Code package on the official Node image).
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker build -t "${COMPANY_IMAGE:-company-agent:dev}" "$HERE/docker"
