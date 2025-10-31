FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    build-essential \
    libsndfile1 \
    libsndfile1-dev \
    libasound2-dev \
    portaudio19-dev \
    python3-pyaudio \
    libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (faster pip alternative)
RUN pip install uv

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt* ./

# Install CPU-only PyTorch first using uv (system-wide install)
RUN uv pip install --system torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install other dependencies using uv (system-wide install, restored to PyPI index)
RUN uv pip install --system -r requirements.txt

# Copy application code
COPY . .

# Expose port (default 8002 to avoid conflicts with GPU version)
EXPOSE 8002

# Health check - just check if the port is listening
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8002/ || exit 1

# Run uvicorn on port 8002
CMD ["uvicorn", "demucs_local:app", "--host", "0.0.0.0", "--port", "8002"]
