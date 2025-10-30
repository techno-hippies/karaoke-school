# Quansic Service Dockerfile - Python + hrequests anti-detection version
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Playwright and browser automation
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy uv configuration files
COPY pyproject.toml ./
COPY uv.lock* ./

# Install uv package manager
RUN pip install uv

# Install dependencies using uv
RUN uv pip install --system -e . 

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 quansic && \
    chown -R quansic:quansic /app
USER quansic

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:3000/health', timeout=5)" || exit 1

# Run the application
CMD ["python", "main.py"]
