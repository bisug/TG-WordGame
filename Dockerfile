# ─────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────
FROM oven/bun:1.3.14-debian AS deps

WORKDIR /app

# Copy only the files needed for install (better layer caching)
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# ─────────────────────────────────────────────
# Stage 2: Final runtime image
# ─────────────────────────────────────────────
FROM oven/bun:1.3.14-debian AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install system libraries required by sharp + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY kysely.config.ts ./
COPY tsconfig.json ./
COPY package.json ./

# Use non-root user for security (bun image ships with this user)
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

# Run the bot
CMD ["bun", "run", "src/index.ts"]
