# MLC Integration - Revised Architecture

## Non-GitHub Deployment Options

### Option 1: Modal Scheduled Function (Recommended)

**Why Modal?**
- ✅ Already using Modal for audio processing
- ✅ Built-in scheduled function support
- ✅ No additional infrastructure
- ✅ Reliable execution
- ✅ Easy to monitor

**Location**: `spleeter-modal/mlc_batch_processor.py`

```python
import modal
from datetime import datetime
import os

app = modal.App("mlc-batch-processor")

# Schedule to run monthly on the 1st at 9am UTC
@app.function(
    schedule=modal.Cron("0 9 1 * *"),  # Monthly cron
    secrets=[
        modal.Secret.from_name("catalog-contract-env")  # RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS
    ]
)
def process_mlc_updates():
    """
    Monthly batch processor for MLC data
    """
    from web3 import Web3
    import requests

    # Connect to contract
    w3 = Web3(Web3.HTTPProvider(os.environ['RPC_URL']))
    contract_address = os.environ['CONTRACT_ADDRESS']

    # Get all songs from contract
    songs = get_all_songs(w3, contract_address)

    # Filter unmatched songs
    unmatched = [s for s in songs if not s['mlcCode']]

    print(f"Found {len(unmatched)} songs without MLC data")

    results = []
    for song in unmatched:
        try:
            # Query MLC API
            mlc_data = match_song_with_mlc(song)

            if mlc_data:
                # Update contract
                update_contract_mlc_data(
                    w3,
                    contract_address,
                    song['geniusId'],
                    mlc_data['code'],
                    mlc_data['confidence'],
                    mlc_data['matchMethod']
                )

                results.append({
                    'geniusId': song['geniusId'],
                    'status': 'matched',
                    'mlcCode': mlc_data['code']
                })
            else:
                results.append({
                    'geniusId': song['geniusId'],
                    'status': 'no_match'
                })

            # Rate limiting
            time.sleep(1)

        except Exception as e:
            results.append({
                'geniusId': song['geniusId'],
                'status': 'error',
                'error': str(e)
            })

    # Generate report
    generate_report(results)

    return {
        'timestamp': datetime.utcnow().isoformat(),
        'processed': len(unmatched),
        'matched': len([r for r in results if r['status'] == 'matched']),
        'failed': len([r for r in results if r['status'] == 'no_match'])
    }


def match_song_with_mlc(song):
    """
    Match song with MLC database
    Strategy 1: SoundCloud URL
    Strategy 2: Title + Artist
    """
    # Try SoundCloud URL first
    if song.get('audioUri') and 'soundcloud.com' in song['audioUri']:
        mlc_data = query_mlc_by_url(song['audioUri'])
        if mlc_data:
            return {
                'code': mlc_data['mlcCode'],
                'confidence': 95,
                'matchMethod': 'soundcloud_url'
            }

    # Fallback to title + artist
    mlc_data = query_mlc_by_title_artist(song['title'], song['artist'])
    if mlc_data:
        confidence = calculate_match_confidence(song, mlc_data)
        if confidence > 70:
            return {
                'code': mlc_data['mlcCode'],
                'confidence': confidence,
                'matchMethod': 'title_artist'
            }

    return None


def query_mlc_by_url(soundcloud_url):
    """Query MLC portal by SoundCloud URL"""
    response = requests.post(
        'https://portal.themlc.com/api/search/url',
        json={'url': soundcloud_url},
        headers={'Content-Type': 'application/json'}
    )

    if response.ok:
        data = response.json()
        return data.get('works', [{}])[0]

    return None


def query_mlc_by_title_artist(title, artist):
    """Query MLC portal by title and artist"""
    response = requests.post(
        'https://portal.themlc.com/api/search/work',
        json={'title': title, 'artist': artist},
        headers={'Content-Type': 'application/json'}
    )

    if response.ok:
        data = response.json()
        return data.get('works', [{}])[0]

    return None


# Deploy with: modal deploy spleeter-modal/mlc_batch_processor.py
```

**Deploy**:
```bash
cd spleeter-modal
modal deploy mlc_batch_processor.py
```

**Monitor**:
```bash
modal app logs mlc-batch-processor
```

---

### Option 2: Render Cron Job

**Why Render?**
- ✅ Already using Render for webhook server
- ✅ Native cron job support
- ✅ Free tier available
- ✅ Easy deployment

**Location**: New service `mlc-processor/`

**Structure**:
```
mlc-processor/
├── package.json
├── processor.mjs       # Main batch processor
├── mlc-client.mjs      # MLC API client
└── render.yaml         # Render config with cron
```

**render.yaml**:
```yaml
services:
  - type: cron
    name: mlc-batch-processor
    env: node
    schedule: "0 9 1 * *"  # Monthly on 1st at 9am UTC
    buildCommand: npm install
    startCommand: node processor.mjs
    envVars:
      - key: CATALOG_CONTRACT
        sync: false
      - key: RPC_URL
        sync: false
      - key: PRIVATE_KEY
        sync: false
```

**Deploy**: Connect repo to Render, it auto-deploys cron jobs

---

### Option 3: Railway Cron Job

**Why Railway?**
- ✅ Similar to Render
- ✅ Better free tier for cron jobs
- ✅ Simple deployment

**Deploy**:
```bash
railway init
railway up
railway variables set CATALOG_CONTRACT=...
```

**Procfile**:
```
cron: node processor.mjs
```

---

### Option 4: Manual Script (Simplest)

**Why Manual?**
- ✅ No infrastructure needed
- ✅ Full control over execution
- ✅ Run locally whenever needed
- ✅ Easy to debug

**Location**: `lit-actions/scripts/mlc-batch-processor.mjs`

**Run manually once per month**:
```bash
cd lit-actions
DOTENV_PRIVATE_KEY=xxx dotenvx run -- node scripts/mlc-batch-processor.mjs
```

**Set reminder**: Add to calendar/Slack bot

---

### Option 5: Vercel Cron (if using Vercel)

**vercel.json**:
```json
{
  "crons": [{
    "path": "/api/mlc-update",
    "schedule": "0 9 1 * *"
  }]
}
```

**api/mlc-update.js**:
```javascript
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Run batch processor
  const results = await processMlcUpdates();

  return res.json(results);
}
```

---

## Recommendation Matrix

| Option | Cost | Complexity | Reliability | Control |
|--------|------|------------|-------------|---------|
| **Modal Scheduled** | Free (within limits) | Low | High | Medium |
| **Render Cron** | $7/mo (paid tier) | Low | High | Medium |
| **Railway Cron** | Free tier available | Low | High | Medium |
| **Manual Script** | Free | Very Low | Manual | Full |
| **Vercel Cron** | Free (within limits) | Medium | High | Medium |

---

## My Recommendation: Modal Scheduled Function

**Why?**
1. **Already using Modal** - No new infrastructure
2. **Perfect for batch jobs** - Modal is designed for this
3. **Free** - Within Modal's free tier
4. **Python-friendly** - Easy to work with web3.py
5. **Built-in monitoring** - Modal has great logs/dashboard
6. **Reliable** - Modal handles retries, etc.

**Implementation**:
```bash
# 1. Create the processor
spleeter-modal/mlc_batch_processor.py

# 2. Deploy to Modal
modal deploy spleeter-modal/mlc_batch_processor.py

# 3. Monitor execution
modal app logs mlc-batch-processor

# 4. Run manually if needed
modal run spleeter-modal/mlc_batch_processor.py::process_mlc_updates
```

---

## Contract Updates Needed

Add to `KaraokeCatalogV1.sol`:

```solidity
struct Song {
    // ... existing fields ...

    // MLC fields
    string mlcCode;           // MLC work code
    uint64 mlcMatchedAt;      // When matched
    uint8 mlcMatchConfidence; // 0-100 confidence score
    string mlcMatchMethod;    // "soundcloud_url" | "title_artist" | "manual"
}

function updateMlcData(
    uint32 geniusId,
    string calldata mlcCode,
    uint8 matchConfidence,
    string calldata matchMethod
) external onlyOwner {
    uint256 index = geniusIdToIndex[geniusId];
    require(index > 0, "Song not found");

    Song storage song = songs[index - 1];
    song.mlcCode = mlcCode;
    song.mlcMatchedAt = uint64(block.timestamp);
    song.mlcMatchConfidence = matchConfidence;
    song.mlcMatchMethod = matchMethod;

    emit MlcDataUpdated(geniusId, mlcCode, matchConfidence);
}

event MlcDataUpdated(
    uint32 indexed geniusId,
    string mlcCode,
    uint8 confidence
);
```

---

## Summary

**Best Option**: Modal scheduled function
- **Where**: `spleeter-modal/mlc_batch_processor.py`
- **When**: Monthly via Modal cron
- **Why**: Already using Modal, perfect for batch jobs, free

**Alternative**: Manual script if you prefer full control
- **Where**: `lit-actions/scripts/mlc-batch-processor.mjs`
- **When**: Run manually monthly
- **Why**: Simplest, no infrastructure

Want me to implement the Modal scheduled function? 🚀
