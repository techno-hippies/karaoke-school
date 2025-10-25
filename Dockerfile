FROM oven/bun:1-debian

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install Node.js and freyr
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g freyr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .

RUN mkdir -p /tmp/freyr-downloads /tmp/freyr-segments

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "index.ts"]
