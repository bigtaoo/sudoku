# Sudoku API image. Build from the repository root (the server bundles workspace packages):
#   docker build -f apps/server/Dockerfile -t sudoku-api .
#
# Stage 1 installs the whole workspace and bundles dist/server.js; stage 2 keeps only that bundle
# plus the server's production npm dependencies. node:sqlite is built into Node, so no native
# modules are compiled and the runtime image needs no build toolchain.

ARG NODE_VERSION=26
ARG PNPM_VERSION=12.15.0

FROM node:${NODE_VERSION}-slim AS build
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo

# Manifests first so the dependency layer is cached until a lockfile or package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @sudoku/server...

COPY packages/core packages/core
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @sudoku/server build \
 && pnpm --filter @sudoku/server deploy --prod /out \
 && cp -r apps/server/dist /out/dist

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DB_PATH=/data/sudoku.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
