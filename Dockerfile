# Staging image. Pin this base by digest in an approved release manifest.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG SERS_BUILD_REVISION
RUN pnpm build \
    && node scripts/release/candidate.mjs verify-static-identity dist/public \
    && SERS_BUILD_REVISION=$SERS_BUILD_REVISION node scripts/operations/release-contract.mjs write

FROM node:22-bookworm-slim AS runtime
ARG SERS_BUILD_REVISION
LABEL org.opencontainers.image.revision=$SERS_BUILD_REVISION \
    org.opencontainers.image.source="https://github.com/anas8273/sers-preview"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates chromium fonts-noto-core fonts-noto-extra qpdf poppler-utils tini util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 sers \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin sers \
    && install -d -m 0700 -o sers -g sers /var/lib/sers/evidence
ENV NODE_ENV=production PORT=3000 \
    PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/config XDG_CACHE_HOME=/tmp/cache
# Keep the locked toolchain for explicit migration/fixture jobs; no install at startup.
COPY --from=build --chown=sers:sers /app/node_modules ./node_modules
COPY --from=build --chown=sers:sers /app/dist ./dist
COPY --from=build --chown=sers:sers /app/server ./server
COPY --from=build --chown=sers:sers /app/shared ./shared
COPY --from=build --chown=sers:sers /app/drizzle ./drizzle
COPY --from=build --chown=sers:sers /app/scripts ./scripts
COPY --from=build --chown=sers:sers /app/package.json /app/drizzle.config.ts /app/tsconfig.json ./
USER 10001:10001
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "node", "scripts/operations/entrypoint.mjs"]
CMD ["serve"]
