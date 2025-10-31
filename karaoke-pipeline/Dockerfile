FROM oven/bun:1-debian

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lock ./

# Install dependencies
RUN bun install

# Copy application code
COPY . .

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# Run standalone server
CMD ["bun", "run", "standalone-server"]
