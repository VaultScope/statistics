# Multi-stage build for production
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies
RUN npm ci
RUN cd client && npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build
RUN npm run client:build

# Generate database migrations
RUN npm run db:generate || true

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache curl bash sqlite

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/client/.next ./client/.next
COPY --from=builder --chown=nodejs:nodejs /app/client/public ./client/public
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/client/node_modules ./client/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/client/package*.json ./client/
COPY --from=builder --chown=nodejs:nodejs /app/server/db/migrations ./server/db/migrations

# Create data directory
RUN mkdir -p /data && chown -R nodejs:nodejs /data

# Environment variables
ENV NODE_ENV=production
ENV DATABASE_URL=/data/database.db
ENV PORT=4000
ENV CLIENT_PORT=4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 4000 4001

# Start both services
CMD ["sh", "-c", "npm run db:migrate && npm run start:all"]