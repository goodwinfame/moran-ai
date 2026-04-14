# =============================================================================
# moran-server — Multi-stage Docker build
# Uses pnpm for dependency installation, bun for production runtime
# =============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace config + all package.json files for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

# Install ALL dependencies (need devDeps for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/

# Build core first (server depends on it), then server
RUN pnpm --filter @moran/core run build && pnpm --filter @moran/server run build

# Stage 3: Production dependencies only
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --prod

# Stage 4: Production runtime (bun for performance)
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S moran && adduser -u 1001 -S moran -G moran

# Copy production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=prod-deps /app/packages/server/node_modules ./packages/server/node_modules

# Copy built artifacts
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Copy root package.json for workspace resolution
COPY --from=builder /app/package.json ./

# Set ownership
RUN chown -R moran:moran /app

USER moran

ENV NODE_ENV=production
EXPOSE 3200 3100

# Health check — hit the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3200/ || exit 1

CMD ["bun", "run", "packages/server/dist/index.js"]
