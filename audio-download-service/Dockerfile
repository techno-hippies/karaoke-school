FROM oven/bun:1-debian

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libchromaprint-tools \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files and postinstall script first
COPY package.json bun.lock ./
COPY scripts/ ./scripts/

# Install dependencies (postinstall patch applied automatically)
RUN bun install

# Copy application code
COPY . .

# Expose service port
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run the service
CMD ["bun", "run", "index.ts"]
