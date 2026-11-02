# Agent image: .NET SDK + Node (for the pinned official Claude Code package) + graphify.
# Built on the host. Runs read-only, non-root, with network only through the allowlist proxy.
FROM node:22-bookworm-slim AS nodejs
FROM mcr.microsoft.com/dotnet/sdk:10.0

ARG CLAUDE_CODE_VERSION=2.1.316
ARG GRAPHIFY_VERSION=0.9.54

# Node comes from the official Node image (same glibc family); npm and npx are re-linked.
COPY --from=nodejs /usr/local/bin/node /usr/local/bin/node
COPY --from=nodejs /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
 && npm cache clean --force

# git for the agent's commits; python venv for graphify (pinned).
RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 python3-venv ca-certificates \
 && python3 -m venv /opt/graphify \
 && /opt/graphify/bin/pip install --no-cache-dir graphifyy==${GRAPHIFY_VERSION} \
 && ln -s /opt/graphify/bin/graphify /usr/local/bin/graphify \
 && rm -rf /var/lib/apt/lists/*

# Visual verification (Scout report 2026-11-02): headless Chromium + axe, baked in at build time so that
# nothing is downloaded at run time. Scripts live in /opt/visual; browsers in /opt/pw-browsers (read-only at run).
ARG PLAYWRIGHT_VERSION=1.64.1
ARG AXE_PLAYWRIGHT_VERSION=4.14.0
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    NODE_PATH=/opt/visual/node_modules
# apt over HTTPS: plain HTTP to the Ubuntu mirrors can be blocked on some networks, and HTTPS is stricter anyway.
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources \
 && mkdir -p /opt/visual && cd /opt/visual \
 && npm init -y >/dev/null \
 && npm install --no-audit --no-fund playwright-core@${PLAYWRIGHT_VERSION} @axe-core/playwright@${AXE_PLAYWRIGHT_VERSION} \
 && npx playwright-core install --with-deps --only-shell chromium \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/* \
 && chmod -R a+rX /opt/visual /opt/pw-browsers
COPY shot.js /opt/visual/shot.js

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_CLI_HOME=/home/node \
    NUGET_PACKAGES=/home/node/.nuget/packages

RUN userdel -r ubuntu && useradd --create-home --uid 1000 --shell /bin/bash node
USER node
WORKDIR /work
