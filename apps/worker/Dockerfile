# Build from the repo root:  docker build -f apps/worker/Dockerfile -t access-worker .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @access/worker...
RUN pnpm --filter @access/worker build

FROM node:22-slim
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo /repo
ENV NODE_ENV=production
WORKDIR /repo/apps/worker
# SIGTERM lets an in-flight job finish or return to the queue.
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/index.js"]
