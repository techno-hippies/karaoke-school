# Quansic Service v2.0.1 - Technical Documentation

**Anti-Detection Music Metadata Service with Enterprise-Grade Stealth Capabilities**

This service provides enriched music metadata using advanced anti-detection techniques. Originally built with TypeScript/Playwright, it was migrated to Python + hrequests for superior stealth capabilities and performance.

## 🏗️ Architecture Overview

Quansic Service is designed to bypass detection systems while enriching music metadata from the Quansic API. It uses enterprise-grade anti-detection techniques including browser automation, TLS fingerprint replication, and human behavior simulation.

### Core Components

- **main.py**: FastAPI application with anti-detection middleware
- **quansic_service.py**: Core service logic with hrequests integration
- **models.py**: Data models and response structures
- **quansic_service_playwright.py**: Legacy TypeScript service (archived)
- **Dockerfile**: Container configuration with anti-detection dependencies

### Anti-Detection Stack

- **Camoufox**: Stealth Firefox browser for automation
- **Patchright**: Enterprise-grade anti-detection browser
- **hrequests**: HTTP library with anti-detection capabilities
- **TLS Fingerprinting**: Automatic client replication
- **Residential Proxies**: Built-in Evomi integration
- **HTTP/2 Support**: Modern protocol support

## 🔧 Technical Stack

- **Runtime**: Python 3.11+ with FastAPI
- **Backend**: Go backend + gevent for concurrency
- **Anti-Detection**: hrequests with Camoufox/Patchright
- **Browser Automation**: Stealth browsers with human behavior
- **Proxy Support**: Residential proxies (Evomi)
- **Protocols**: HTTP/2, TLS 1.3, modern header patterns
- **Database**: PostgreSQL (Neon DB) for session management
- **Deployment**: Akash cloud or local Docker

## 📁 Code Structure

```
quansic-service/
├── main.py                         # FastAPI application entry point
├── quansic_service.py              # Core service logic (47,176 bytes)
├── models.py                       # Data models and structures (8,825 bytes)
├── quansic_service_playwright.py   # Legacy TypeScript service (14,398 bytes)
├── Dockerfile                      # Container build configuration
├── requirements.txt                # Python dependencies
├── pyproject.toml                  # Python project configuration
├── .env.example                    # Environment variables template
├── build-and-push.sh              # Docker build automation
├── test-service.sh                # Service testing script
└── compare-endpoints.sh           # Endpoint comparison tool
```

### Core Service Architecture

**Main Components:**

1. **main.py**: FastAPI application with endpoints:
   - `/health`: Service health check
   - `/enrich-track`: Track metadata enrichment
   - `/enrich-artist`: Artist metadata enrichment
   - `/account-pool`: Account status and health
   - `/force-reauth`: Force re-authentication

2. **quansic_service.py**: Core functionality:
   - `QuansicEnricher` class: Main enrichment logic
   - Account pool management
   - Anti-detection session handling
   - Request queue with concurrency control
   - Error handling and retry logic

3. **models.py**: Data structures:
   - `TrackEnrichmentRequest`: Input track data
   - `ArtistEnrichmentRequest`: Input artist data
   - `TrackEnrichmentResponse`: Enriched track metadata
   - `ArtistEnrichmentResponse`: Enriched artist metadata
   - `AccountStatus`: Account health information

## 🔌 API Reference

### Endpoints

**GET /health**
- Service health check with account pool status
- Returns: service uptime, active accounts, failure rates

**POST /enrich-track**
- Enrich track metadata with Quansic data
- Input: Track metadata with Spotify/other IDs
- Returns: Enriched track data with additional metadata

**POST /enrich-artist**
- Enrich artist metadata with Quansic data
- Input: Artist metadata with Spotify/other IDs
- Returns: Enriched artist data with additional metadata

**GET /account-pool**
- Get current account pool status
- Returns: Active accounts, failure rates, health metrics

**POST /force-reauth**
- Force re-authentication of all accounts
- Returns: Re-authentication status

### Request/Response Examples

**Track Enrichment Request:**
```json
{
  "spotify_track_id": "43bCmCI0nSgcT7QdMXY6LV",
  "title": "Side To Side",
  "artist": "Ariana Grande",
  "album": "Dangerous Woman",
  "duration_ms": 227613,
  "enrichment_level": "full"
}
```

**Track Enrichment Response:**
```json
{
  "spotify_track_id": "43bCmCI0nSgcT7QdMXY6LV",
  "enriched_metadata": {
    "quansic_id": "abc123def456",
    "confidence_score": 0.94,
    "additional_data": {
      "genres": ["pop", "dance"],
      "mood": "energetic",
      "language": "english",
      "vocal_type": "female",
      "energy_level": 0.85,
      "danceability": 0.92
    }
  },
  "processing_time_ms": 1247,
  "account_used": "account_5",
  "success": true
}
```

**Account Pool Response:**
```json
{
  "total_accounts": 12,
  "active_accounts": 8,
  "healthy_accounts": 7,
  "failed_accounts": 1,
  "average_failure_rate": 0.03,
  "accounts": [
    {
      "account_id": "account_1",
      "status": "healthy",
      "last_used": "2025-10-29T15:30:00Z",
      "failure_count": 0,
      "success_rate": 0.97
    }
  ]
}
```

## ⚙️ Environment Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `QUANSIC_EMAIL` | string | Yes | Quansic account email |
| `QUANSIC_PASSWORD` | string | Yes | Quansic account password |
| `ACCOUNT_POOL_SIZE` | int | No | Number of accounts in pool (default: 5) |
| `REQUESTS_PER_ACCOUNT` | int | No | Requests before account rotation (default: 50) |
| `EVOMI_API_KEY` | string | Yes | Residential proxy API key |
| `HREQUESTS_BROWSER` | string | No | Browser type: "firefox" (default), "chrome" |
| `CONCURRENCY_WORKERS` | int | No | Gevent worker count (default: 10) |
| `REQUEST_TIMEOUT` | int | No | Request timeout seconds (default: 30) |
| `MAX_RETRIES` | int | No | Maximum retry attempts (default: 3) |

### Environment Setup

```bash
# Required environment variables
QUANSIC_EMAIL=your_quansic_email@example.com
QUANSIC_PASSWORD=your_quansic_password
EVOMI_API_KEY=your_evomi_api_key

# Optional configuration
ACCOUNT_POOL_SIZE=8
REQUESTS_PER_ACCOUNT=30
HREQUESTS_BROWSER=firefox
CONCURRENCY_WORKERS=15
REQUEST_TIMEOUT=45
MAX_RETRIES=5
```

## 🔐 Anti-Detection Features

### Browser Stealth

**Camoufox Integration:**
```python
# Use stealth Firefox browser
browser_config = {
    'browser': 'firefox',
    'stealth_mode': True,
    'user_agent_rotation': True,
    'viewport_randomization': True,
    'mouse_movement_simulation': True
}

session = hrequests.Session(**browser_config)
```

**TLS Fingerprinting:**
```python
# Automatic TLS client replication
tls_config = {
    'tls_fingerprint': 'auto',  # Replicate real browser
    ' JA3 fingerprinting': True,
    'HTTP2 fingerprinting': True
}
```

### Human Behavior Simulation

**Mouse Movement Patterns:**
```python
# Neural-pattern movement simulation
behavior_config = {
    'mouse_movement': 'neural_patterns',
    'typing_delay': 'human_like',
    'scroll_behavior': 'natural',
    'pause_patterns': 'randomized'
}
```

**Timing Patterns:**
```python
# Realistic request timing
timing_config = {
    'request_delay': 'adaptive',
    'burst_patterns': 'human_like',
    'idle_periods': 'randomized',
    'session_duration': 'realistic'
}
```

### Account Pool Management

**Account Rotation Strategy:**
```python
class AccountPool:
    def __init__(self, account_count=5):
        self.accounts = self._initialize_accounts()
        self.current_index = 0
        self.request_counts = {}
        self.failure_rates = {}
    
    def get_next_account(self):
        # Round-robin with health checking
        for i in range(len(self.accounts)):
            account = self.accounts[(self.current_index + i) % len(self.accounts)]
            if self._is_account_healthy(account):
                self.current_index = (self.current_index + i + 1) % len(self.accounts)
                return account
        
        # Fallback to least recently used
        return self._get_least_used_account()
```

## 🔄 Service Workflow

### Track Enrichment Flow

1. **Request Validation**
   - Validate input track metadata
   - Check required fields (title, artist, etc.)
   - Apply rate limiting

2. **Account Selection**
   - Get healthy account from pool
   - Check account health and recent usage
   - Rotate accounts based on request count

3. **Session Management**
   - Initialize anti-detection session
   - Apply TLS fingerprinting
   - Set up residential proxy

4. **Request Execution**
   - Human behavior simulation
   - Request to Quansic API
   - Handle retries and errors

5. **Response Processing**
   - Parse enriched metadata
   - Calculate confidence scores
   - Update account statistics

6. **Result Return**
   - Return enriched track data
   - Log processing metrics
   - Update account pool health

### Error Handling Patterns

**Account Health Monitoring:**
```python
def update_account_health(account_id, success, response_time):
    account = self.accounts[account_id]
    
    if success:
        account.success_count += 1
        account.last_success = datetime.now()
    else:
        account.failure_count += 1
        account.last_failure = datetime.now()
    
    # Calculate health score
    total_requests = account.success_count + account.failure_count
    success_rate = account.success_count / total_requests if total_requests > 0 else 0
    
    # Mark as unhealthy if failure rate exceeds threshold
    if success_rate < self.config.min_success_rate:
        account.status = 'unhealthy'
        account.unhealthy_reason = 'high_failure_rate'
```

**Retry Logic:**
```python
async def enrich_with_retry(self, request, account, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = await self._enrich_single(request, account)
            return result
        except AntiDetectionError as e:
            if attempt == max_retries - 1:
                raise e
            
            # Rotate account on anti-detection error
            account = self._rotate_account(account)
            await asyncio.sleep(self.config.retry_delay * (attempt + 1))
```

## 🌐 Proxy Configuration

### Residential Proxy Integration

**Evomi API Integration:**
```python
class EvomiProxyManager:
    def __init__(self, api_key):
        self.api_key = api_key
        self.proxy_pool = self._initialize_proxy_pool()
    
    def get_proxy(self, region=None):
        # Get residential proxy from Evomi
        response = requests.get(
            'https://api.evomi.com/v1/proxies',
            headers={'Authorization': f'Bearer {self.api_key}'},
            params={'region': region, 'type': 'residential'}
        )
        return response.json()
```

**Proxy Rotation:**
```python
class ProxyRotator:
    def __init__(self, proxy_manager):
        self.proxy_manager = proxy_manager
        self.current_proxy = None
        self.proxy_usage_count = 0
    
    def get_next_proxy(self):
        if (self.proxy_usage_count >= self.config.max_requests_per_proxy or
            self._should_rotate_proxy()):
            self.current_proxy = self.proxy_manager.get_proxy()
            self.proxy_usage_count = 0
        
        self.proxy_usage_count += 1
        return self.current_proxy
```

## 📊 Performance Metrics

### Key Performance Indicators

**Response Times:**
- First request: 5-10 seconds (browser warmup)
- Subsequent: 200-500ms (cached session)
- Session lifetime: 1 hour

**Success Rates:**
- Before v1.x: 20-30% ban rate within 24h
- After v2.0: <5% ban rate expected
- Account longevity: 7+ days vs <24h

**Resource Usage:**
- Memory: 4-6GB for browser automation
- CPU: Moderate usage with gevent concurrency
- Network: Residential proxy bandwidth

### Monitoring and Alerting

**Account Health Metrics:**
```python
def calculate_account_health(account):
    metrics = {
        'success_rate': account.success_count / (account.success_count + account.failure_count),
        'avg_response_time': account.total_response_time / account.total_requests,
        'consecutive_failures': account.consecutive_failures,
        'last_activity': account.last_activity
    }
    
    # Health score calculation
    health_score = (
        metrics['success_rate'] * 0.4 +
        (1 - min(metrics['avg_response_time'] / 10.0, 1)) * 0.3 +
        (1 - min(metrics['consecutive_failures'] / 5, 1)) * 0.3
    )
    
    return {
        'score': health_score,
        'status': 'healthy' if health_score > 0.8 else 'degraded',
        'metrics': metrics
    }
```

## 🔧 Integration Examples

### Karaoke Pipeline Integration

```python
# Integration with karaoke-pipeline
import aiohttp
from typing import Dict, Any

class QuansicClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = aiohttp.ClientSession()
    
    async def enrich_track(self, track_data: Dict[str, Any]) -> Dict[str, Any]:
        async with self.session.post(
            f"{self.base_url}/enrich-track",
            json=track_data,
            headers={"Authorization": f"Bearer {self.api_key}"}
        ) as response:
            return await response.json()
    
    async def get_account_health(self) -> Dict[str, Any]:
        async with self.session.get(
            f"{self.base_url}/account-pool",
            headers={"Authorization": f"Bearer {self.api_key}"}
        ) as response:
            return await response.json()

# Usage in pipeline
async def enrich_music_metadata(track_data):
    quansic = QuansicClient(QUANSIC_SERVICE_URL, QUANSIC_API_KEY)
    
    try:
        enriched_data = await quansic.enrich_track(track_data)
        return enriched_data
    except Exception as e:
        logger.error(f"Quansic enrichment failed: {e}")
        return track_data  # Return original data on failure
```

### Batch Processing

```python
async def batch_enrich_tracks(tracks: List[Dict]) -> List[Dict]:
    """Process multiple tracks with rate limiting"""
    quansic = QuansicClient(QUANSIC_SERVICE_URL, QUANSIC_API_KEY)
    
    # Check account health first
    health = await quansic.get_account_health()
    if health['healthy_accounts'] < 2:
        logger.warning("Low healthy account count, consider scaling up")
    
    # Process with concurrency control
    semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
    
    async def process_single(track):
        async with semaphore:
            return await quansic.enrich_track(track)
    
    tasks = [process_single(track) for track in tracks]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle failures
    enriched_tracks = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to enrich track {i}: {result}")
            enriched_tracks.append(tracks[i])  # Use original data
        else:
            enriched_tracks.append(result)
    
    return enriched_tracks
```

## 🛡️ Security Considerations

### API Key Management

**Encrypted Storage:**
```python
# Use environment variables or secure key management
import os
from cryptography.fernet import Fernet

class SecureKeyManager:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)
    
    def encrypt_api_key(self, key: str) -> str:
        return self.cipher.encrypt(key.encode()).decode()
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        return self.cipher.decrypt(encrypted_key.encode()).decode()
```

### Request Validation

**Input Sanitization:**
```python
from pydantic import BaseModel, validator

class TrackEnrichmentRequest(BaseModel):
    spotify_track_id: str
    title: str
    artist: str
    album: str = ""
    duration_ms: int = 0
    
    @validator('spotify_track_id')
    def validate_spotify_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9]{22}$', v):
            raise ValueError('Invalid Spotify track ID format')
        return v
    
    @validator('title', 'artist')
    def validate_strings(cls, v):
        if len(v) == 0 or len(v) > 200:
            raise ValueError('String must be 1-200 characters')
        return v.strip()
```

### Rate Limiting

**Per-Account Rate Limiting:**
```python
class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    
    async def acquire(self, account_id: str):
        now = time.time()
        minute_ago = now - 60
        
        # Clean old requests
        self.requests[account_id] = [
            req_time for req_time in self.requests[account_id]
            if req_time > minute_ago
        ]
        
        # Check rate limit
        if len(self.requests[account_id]) >= self.requests_per_minute:
            sleep_time = 60 - (now - self.requests[account_id][0])
            await asyncio.sleep(sleep_time)
        
        self.requests[account_id].append(now)
```

## 🐛 Troubleshooting

### Common Issues

**"Account banned"**
- **Cause**: Account flagged by Quansic detection
- **Solution**: Auto-rotation to backup accounts, re-authentication

**"Anti-detection failed"**
- **Cause**: Browser fingerprint detected
- **Solution**: Switch to different browser type (firefox → chrome)

**"Proxy connection failed"**
- **Cause**: Residential proxy unavailable
- **Solution**: Rotate to backup proxy, check Evomi API status

**"Rate limit exceeded"**
- **Cause**: Too many requests per account
- **Solution**: Increase account pool size, reduce request rate

### Debugging Tools

**Account Health Debugging:**
```python
async def debug_account_health():
    quansic = QuansicClient(QUANSIC_SERVICE_URL, QUANSIC_API_KEY)
    health = await quansic.get_account_health()
    
    print(f"Total accounts: {health['total_accounts']}")
    print(f"Active accounts: {health['active_accounts']}")
    print(f"Healthy accounts: {health['healthy_accounts']}")
    
    for account in health['accounts']:
        print(f"Account {account['account_id']}:")
        print(f"  Status: {account['status']}")
        print(f"  Success rate: {account['success_rate']:.2%}")
        print(f"  Last used: {account['last_used']}")
```

**Request Tracing:**
```python
import logging

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('quansic_service')

# Add request tracing
class TracingSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.requests = []
    
    async def traced_request(self, method: str, url: str, **kwargs):
        start_time = time.time()
        
        logger.debug(f"[{self.session_id}] {method} {url}")
        
        try:
            response = await self.session.request(method, url, **kwargs)
            duration = time.time() - start_time
            
            logger.debug(f"[{self.session_id}] Success: {response.status} ({duration:.2f}s)")
            
            self.requests.append({
                'method': method,
                'url': url,
                'status': response.status,
                'duration': duration,
                'timestamp': datetime.now()
            })
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"[{self.session_id}] Failed: {str(e)} ({duration:.2f}s)")
            raise
```

### Performance Monitoring

**Response Time Analysis:**
```python
def analyze_response_times(requests_log):
    durations = [req['duration'] for req in requests_log]
    
    stats = {
        'mean': statistics.mean(durations),
        'median': statistics.median(durations),
        'p95': statistics.quantiles(durations, n=20)[18],  # 95th percentile
        'max': max(durations),
        'min': min(durations)
    }
    
    return stats
```

**Success Rate Tracking:**
```python
def calculate_success_metrics(requests_log):
    total_requests = len(requests_log)
    successful_requests = sum(1 for req in requests_log if req['status'] < 400)
    
    return {
        'success_rate': successful_requests / total_requests,
        'total_requests': total_requests,
        'successful_requests': successful_requests,
        'failed_requests': total_requests - successful_requests
    }
```

## 📈 Scaling Configuration

### Horizontal Scaling

**Load Balancer Setup:**
```yaml
# docker-compose.yml for scaling
version: '3.8'
services:
  quansic-service:
    build: .
    environment:
      - ACCOUNT_POOL_SIZE=10
      - CONCURRENCY_WORKERS=20
    deploy:
      replicas: 3
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

**Nginx Configuration:**
```nginx
upstream quansic_backend {
    server quansic-service-1:8000;
    server quansic-service-2:8000;
    server quansic-service-3:8000;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://quansic_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Load balancing
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }
}
```

### Resource Optimization

**Memory Management:**
```python
# Optimize memory usage for browser automation
browser_config = {
    'memory_profile': 'low',
    'cache_disabled': True,
    'image_loading': False,
    'javascript_disabled': False,  # Keep JS enabled for functionality
    'background_tabs': False
}
```

**Concurrent Request Optimization:**
```python
# Balance between performance and anti-detection
class OptimizedConcurrency:
    def __init__(self):
        self.max_concurrent = 8  # Conservative for stealth
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
    
    async def process_request(self, request):
        async with self.semaphore:
            # Add randomized delays for human-like behavior
            await asyncio.sleep(random.uniform(0.1, 0.5))
            return await self._process_single(request)
```

## 🔄 Migration from v1.x

### API Compatibility

The v2.0 service maintains full backward compatibility with v1.x:

- ✅ Same endpoint paths and methods
- ✅ Same request/response format
- ✅ Same environment variable names
- ✅ Same Docker deployment process

### Migration Benefits

**Performance Improvements:**
- Browser startup: hrequests optimized vs Playwright
- Request concurrency: Go backend vs Node.js single-threaded
- Network efficiency: HTTP/2 + realistic header patterns

**Detection Avoidance:**
- Account longevity: 7+ days vs <24h
- Ban rate: <5% vs 20-30%
- Maintenance overhead: Automatic rotation vs manual

### Migration Steps

1. **Update credentials**: Use same Quansic accounts
2. **Deploy v2.0**: Replace v1.x container
3. **Monitor health**: Watch `/health` and `/account-pool`
4. **Validate performance**: Compare ban rates

## 📝 Development Guidelines

### Adding New Features

1. **Follow anti-detection patterns**: Use hrequests best practices
2. **Test with detection systems**: Validate stealth capabilities
3. **Monitor account health**: Track ban rates and performance
4. **Document patterns**: Update AGENTS.md with new techniques

### Code Style

- **Python**: Follow PEP 8 with type hints
- **Async/Await**: Use for all I/O operations
- **Error Handling**: Comprehensive try-catch with specific exception types
- **Logging**: Structured logging for debugging and monitoring

### Testing Strategy

**Account Health Testing:**
```python
async def test_account_health_monitoring():
    service = QuansicEnricher()
    
    # Test account rotation
    accounts = service.account_pool.get_accounts()
    assert len(accounts) > 0
    
    # Test health calculation
    for account in accounts:
        health = service._calculate_account_health(account)
        assert 0 <= health['score'] <= 1
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']
```

---

**For user-facing documentation, see README.md**
**For deployment instructions, see build-and-push.sh**
