# ==============================================================================
# FirstFix MCP: Multi-Stage Production Dockerfile
# Amazon Developer Hackathon 2026 - AWS Builder Mini Challenge
# ==============================================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src/ ./src/
COPY addon-package/ ./addon-package/
COPY skills/ ./skills/
COPY public/ ./public/

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/addon-package/ ./addon-package/
COPY --from=builder /app/skills/ ./skills/
COPY --from=builder /app/.well-known/ ./.well-known/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server/start.js"]
