FROM oven/bun:1

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

# Run the service
CMD ["bun", "run", "index.ts"]
