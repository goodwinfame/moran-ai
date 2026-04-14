# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/agents/ packages/agents/
RUN bun install --frozen-lockfile
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
RUN bun run build --filter=@moran/server

# Stage 2: Production
FROM oven/bun:1-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/agents ./agents
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3200 3100
CMD ["bun", "run", "dist/index.js"]
