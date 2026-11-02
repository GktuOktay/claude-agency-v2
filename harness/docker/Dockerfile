FROM node:22-bookworm-slim
RUN npm install -g @anthropic-ai/claude-code@2.1.316 && npm cache clean --force
USER node
WORKDIR /work
