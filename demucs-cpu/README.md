# Demucs CPU - Cloud-Optimized Audio Separation

**CPU-optimized vocal/instrumental separation service designed for Akash deployment.**

This is a CPU-only version of Demucs that uses quantized MDX models for efficient audio processing without requiring GPU hardware. Perfect for cloud deployment on platforms like Akash where GPU instances are expensive or unavailable.

## 🎯 Key Features

- **CPU-Only Processing**: No GPU requirements, runs on any CPU instance
- **MDX Quantized Models**: Uses `mdx_q` for efficient CPU processing  
- **Same API**: Compatible with existing GPU version endpoints
- **Sequential Processing**: Prevents resource conflicts on shared instances
- **Cloud Optimized**: Designed for deployment on Akash and similar platforms
- **Cost Effective**: 80-90% cheaper than GPU alternatives

## 🔄 CPU vs GPU Comparison

| Aspect | GPU Version (demucs-local) | CPU Version (demucs-cpu) |
|--------|---------------------------|---------------------------|
| **Model** | HTDemucs (mdx_extra) | MDX Quantized (mdx_q) |
| **Hardware** | GPU (RTX 3080+) | CPU (2+ cores) |
| **Processing Time** | 20-30 seconds | 2-5 minutes |
| **Memory Usage** | ~8GB VRAM | ~4GB RAM |
| **Deployment Cost** | $0.50-1.00/hour | $0.03-0.07/hour |
| **Quality** | Excellent (~9dB SDR) | Good (~7.7dB SDR) |
| **Concurrency** | Single job | Single job |

## 📊 Model Differences

**HTDemucs (GPU Version)**
- Hybrid Transformer architecture
- Best quality separation (~9dB SDR)
- Requires GPU with CUDA
- Faster processing (20-30s)

**MDX Quantized (CPU Version)**  
- Convolutional U-Net architecture
- Quantized for CPU efficiency
- No GPU required
- Slower processing (2-5 minutes)

The MDX quantized model provides ~75-80% of the quality of HTDemucs but at 10-15% of the cost, making it ideal for cloud deployments where GPU instances are expensive.

## 🚀 Quick Start

### Local Development

```bash
# Clone and setup
cd demucs-cpu
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download model (first time only)
python -c 'from demucs.pretrained import get_model; get_model("mdx_q")'

# Run service
chmod +x start.sh
./start.sh
```

### Docker

```bash
# Build image
docker build -t demucs-cpu:latest .

# Run container
docker run -p 8002:8002 demucs-cpu:latest

# Or with custom port
PORT=8003 docker run -p 8003:8003 demucs-cpu:latest
```

### Health Check

```bash
curl http://localhost:8002/health
```

Expected response:
```json
{
  "status": "healthy",
  "model": "mdx_q", 
  "hardware": "CPU",
  "torch_version": "2.1.0+cpu",
  "cuda_available": false,
  "device": "CPU"
}
```

## 🌐 Akash Deployment

### Prerequisites

1. **Akash CLI installed**: https://docs.akash.network/guides/install
2. **Wallet funded with AKT**: For deployment costs
3. **Docker image built and pushed**: To Docker Hub or similar registry

### Build and Push Image

```bash
# Build the image
docker build -t your-username/demucs-cpu:latest .

# Push to Docker Hub
docker push your-username/demucs-cpu:latest
```

### Update Deployment Configuration

Edit `deploy-akash.yaml`:
```yaml
image: your-username/demucs-cpu:latest  # Replace with your image
```

### Deploy to Akash

```bash
# Create deployment
akash tx deployment create deploy-akash.yaml --from your-wallet --fees 50000uakt

# Wait for lease (check status)
akash query deployment list --owner your-wallet-address

# Get the service URI when lease is created
akash provider lease-status --provider $PROVIDER --dseq $DEPLOYMENT_SEQ --gseq 1 --oseq 1
```

### Resource Requirements

**Minimum**: 1 CPU core, 2GB RAM, 5GB storage
**Recommended**: 2 CPU cores, 4GB RAM, 10GB storage

**Akash Pricing**: ~$0.03-0.07/hour (vs $0.50-1.00/hour for GPU)

## 🔌 API Reference

### Endpoints

The CPU version provides the same API as the GPU version:

- `POST /separate-sync` - Synchronous separation (base64 input)
- `POST /separate-async` - Async separation with webhook (URL input)  
- `GET /health` - Health check
- `GET /` - Service information

### Synchronous Example

```bash
curl -X POST "http://localhost:8002/separate-sync" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_base64": "data:audio/mpeg;base64,...",
    "model": "mdx_q",
    "output_format": "mp3"
  }'
```

### Asynchronous Example

```bash
curl -X POST "http://localhost:8002/separate-async" \
  -F "job_id=job_123" \
  -F "audio_url=https://example.com/audio.mp3" \
  -F "webhook_url=https://your-app.com/webhook" \
  -F "model=mdx_q"
```

### Expected Processing Times

- **Short tracks** (2-3 min): 60-120 seconds
- **Medium tracks** (3-4 min): 120-240 seconds  
- **Long tracks** (4-5 min): 240-300 seconds

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8002 | Service port |
| `HOST` | 0.0.0.0 | Bind address |
| `DEMUCS_MODEL` | mdx_q | Model to use |
| `SEPARATION_TIMEOUT` | 600 | Max processing time (seconds) |

### Available Models

| Model | CPU Optimized | Quality | Speed |
|-------|---------------|---------|-------|
| `mdx_q` | ✅ Yes | Good | Fast |
| `mdx_extra_q` | ✅ Yes | Better | Slower |
| `mdx` | ⚠️ Slower | Better | Slow |
| `mdx_extra` | ❌ No | Best | Very Slow |

**Recommendation**: Use `mdx_q` for production (default).

## 📈 Performance Optimization

### For Better Quality
- Use `mdx_extra_q` instead of `mdx_q`
- Increase memory allocation to 6GB+ 
- Use faster CPU instances (3+ cores)

### For Better Speed  
- Stick with `mdx_q` model
- Use 2+ CPU cores
- Process shorter audio segments (under 5 minutes)

### For Lower Cost
- Use minimum resources (1 core, 2GB RAM)
- Process during off-peak hours
- Batch multiple short tracks together

## 🐛 Troubleshooting

### Common Issues

**Model download fails**
```bash
# Manually download model
python -c 'from demucs.pretrained import get_model; get_model("mdx_q")'
```

**Out of memory**
- Increase RAM allocation to 4GB+
- Process shorter audio files
- Restart service to clear memory

**Timeout errors**  
- Increase `SEPARATION_TIMEOUT` environment variable
- Use smaller audio files
- Upgrade to faster CPU instance

**Port conflicts**
```bash
# Use different port
PORT=8003 ./start.sh
```

### Logs

```bash
# Local logs
tail -f demucs.log

# Docker logs  
docker logs -f demucs-cpu-container

# Akash logs
akash provider lease-status --provider $PROVIDER --dseq $DEPLOYMENT_SEQ --gseq 1 --oseq 1
```

## 🔧 Development

### File Structure

```
demucs-cpu/
├── Dockerfile              # CPU-optimized container
├── requirements.txt        # CPU-only dependencies
├── demucs_local.py         # API service (CPU version)
├── start.sh               # Startup script (no CUDA checks)
├── deploy-akash.yaml      # Akash deployment config
├── .dockerignore          # Docker build exclusions
├── .gitignore             # Git exclusions
└── README.md              # This file
```

### Key Differences from GPU Version

1. **No CUDA checks** in start.sh
2. **CPU-only PyTorch** in requirements.txt
3. **MDX models** instead of HTDemucs
4. **Different default port** (8002 vs 8000)
5. **Akash-optimized deployment** config

## 📄 License

Same as original Demucs project - see Demucs repository for details.

## 🤝 Contributing

1. Test changes locally first
2. Ensure CPU compatibility
3. Update this README for any new features
4. Test Akash deployment

## 📞 Support

- **Issues**: Report CPU-specific problems
- **Performance**: Note slower processing times vs GPU
- **Deployment**: Check Akash provider status for deployments
- **Models**: Verify MDX model compatibility for CPU
