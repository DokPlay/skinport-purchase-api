### Multi-stage Dockerfile for production
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (development for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run as non-root for security
USER node

# Healthcheck for container runtime
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
