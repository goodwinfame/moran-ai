FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json packages/web/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/web/ packages/web/
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter @moran/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./.next/static
COPY --from=builder /app/packages/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
