# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Install ALL deps (including TypeScript, tsx, drizzle-kit needed for build/seed)
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Copy everything from builder so tsx + drizzle-kit are available for entrypoint
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/drizzle      ./drizzle
COPY --from=builder /app/config       ./config
COPY --from=builder /app/scripts      ./scripts
COPY --from=builder /app/src          ./src
COPY package*.json ./

ENV NODE_ENV=production

EXPOSE 3000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
