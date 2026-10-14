# Toolbox image for docker-compose.dev.yml: Bun for installs, scripts and
# Vite, plus Node for the API's `tsx watch`. The repo is bind-mounted at
# /repo, so nothing is copied in here.
FROM oven/bun:1.4.2

COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node

# Bun's install cache lives in a named volume owned by the `bun` user (uid 1000)
RUN mkdir -p /cache && chown bun:bun /cache
ENV BUN_INSTALL_CACHE_DIR=/cache

USER bun
WORKDIR /repo
