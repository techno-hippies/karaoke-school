# Trending System Documentation

TikTok-style trending discovery using on-chain aggregation via PKP/Lit Actions.

## Architecture

### Components

1. **TrendingTrackerV1.sol** - On-chain storage and leaderboards
2. **trending-tracker-v1.js** - Lit Action for event aggregation
3. **TrendingQueueService.ts** - Frontend event queue (localStorage)
4. **TrendingService.ts** - Contract query utilities

### Flow

```
User Click → Queue (localStorage) → Background Sync (5min) → Lit Action → PKP Signs → Contract Update
                                                                                              ↓
Frontend ← Query Trending ← Contract (time-windowed leaderboards)
```

## Features

### ✅ What We Built

- **Multi-timeframe Trending**: Hourly, Daily, Weekly windows
- **Event Types**: Clicks, Plays, Completions (weighted scoring)
- **Gas Efficient**: Batches 1000s of events into single transaction
- **No User Friction**: Background syncing, no wallet prompts
- **Tamper Resistant**: Only PKP can update contract
- **TikTok-like Discovery**: "Trending now" UI patterns
- **Multi-source Support**: Native songs + Genius results

### Scoring Algorithm

```solidity
trendingScore = (clicks × 10) + (plays × 30) + (completions × 60)
```

- **Clicks** (10%): User clicked search result
- **Plays** (30%): User played audio preview
- **Completions** (60%): User finished song/segment (highest value)

Weights can be adjusted by contract owner.

## Deployment

### ✅ DEPLOYED TO LENS TESTNET

**Contract Address:** `0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731`
**Transaction Hash:** `0x53c290203966a26e833ed12593adb5321c86a81b46297b7e760607c25cc300d6`
**Deployer:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`
**Trusted Tracker (PKP):** `0x254AA0096C9287a03eE62b97AA5643A2b8003657`
**Deployed:** 2025-10-03

**Explorer:** https://explorer.testnet.lens.xyz/address/0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731

### 1. Deploy Contract (Already Done)

```bash
cd contracts

# Set PKP address
export PKP_ADDRESS="0x254AA0096C9287a03eE62b97AA5643A2b8003657"

# Deploy to Lens Testnet (ALREADY DEPLOYED)
DOTENV_PRIVATE_KEY='...' npx dotenvx run --env-file=.env -- bash -c 'FOUNDRY_PROFILE=zksync forge create src/TrendingTrackerV1.sol:TrendingTrackerV1 --broadcast --rpc-url https://rpc.testnet.lens.xyz --private-key $PRIVATE_KEY --constructor-args "$PKP_ADDRESS" --zksync --gas-limit 10000000 --gas-price 300000000'
```

**Output:**
```
TrendingTrackerV1 deployed at: 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731
```

### 2. Update Lit Action (Already Done)

Edit `lit-actions/src/trending/trending-tracker-v1.js`:

```javascript
const TRENDING_TRACKER_ADDRESS = '0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731'; // ✅ Updated
```

### 3. Upload Lit Action to IPFS (✅ Complete)

```bash
npm run upload-lit-action -- lit-actions/src/trending/trending-tracker-v1.js
```

**Output:**
```
Uploaded to IPFS: ipfs://QmW2wo1S7Bd4yaNKiAmXXkrbkPAwt16aFFXH6ZzmjiAGyz
```

### 4. Configure PKP Permissions (✅ Complete)

Update PKP to allow execution of the Lit Action:

```bash
bun run scripts/update-pkp-permissions.ts QmW2wo1S7Bd4yaNKiAmXXkrbkPAwt16aFFXH6ZzmjiAGyz
```

**Transaction:** `0xacfdfb4c5d848d041de185803354d264700d5395d73a705f181a43a9c7968be0`

### 5. Frontend Configuration (✅ Complete)

Configuration added to `site/src/config/lit-actions.ts`:

```typescript
trending: {
  tracker: {
    cid: 'QmW2wo1S7Bd4yaNKiAmXXkrbkPAwt16aFFXH6ZzmjiAGyz',
    version: 'v1',
    network: 'lens-testnet',
    chainId: 37111,
    description: 'Trending song tracker with batched event aggregation',
    contracts: {
      trendingTracker: '0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731',
    },
    pkp: '0x254AA0096C9287a03eE62b97AA5643A2b8003657',
  },
}
```

## Frontend Integration

### Track Events

```typescript
import { ContentSource, trackClick, trackPlay, trackCompletion } from '@/services/TrendingQueueService';

// Track click when user selects song
onClick={() => {
  trackClick(ContentSource.Genius, songId);
  navigate(`/create/genius/${songId}`);
}}

// Track play when audio preview starts
onPlay={() => {
  trackPlay(ContentSource.Native, songId);
  audioRef.current.play();
}}

// Track completion when song/segment finishes
onComplete={() => {
  trackCompletion(ContentSource.Native, songId);
}}
```

### Display Trending

```typescript
import { TrendingService, TimeWindow } from '@/services/TrendingService';
import { ethers } from 'ethers';

// Initialize service
const provider = new ethers.providers.JsonRpcProvider(LENS_RPC_URL);
const trendingService = new TrendingService(provider, TRENDING_CONTRACT_ADDRESS);

// Get trending songs
const hourlyTrending = await trendingService.getTrendingSongs(TimeWindow.Hourly, 10);

// Display in UI
{hourlyTrending.map((song, index) => (
  <div key={song.songId}>
    <span>#{index + 1}</span>
    <span>{song.songId}</span>
    <span>🔥 {formatTrendingScore(song.trendingScore)}</span>
  </div>
))}
```

### Auto-sync Setup

```typescript
import { startAutoSync } from '@/services/TrendingQueueService';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

// Initialize Lit client
const litClient = new LitNodeClient({ litNetwork: 'cayenne' });
await litClient.connect();

// Load Lit Action code
const litActionCode = await fetch(`https://ipfs.io/ipfs/${TRENDING_CONFIG.litActionCid}`).then(r => r.text());

// Start auto-sync (every 5 minutes)
const syncHandle = startAutoSync(
  litClient,
  TRENDING_CONFIG.pkpPublicKey,
  litActionCode,
  TimeWindow.Hourly
);

// Stop on unmount
return () => syncHandle.stop();
```

## Time Windows

### Hourly (Trending Now)
- Window ID: `block.timestamp / 1 hour`
- Rolling 1-hour window
- Best for "what's hot right now"

### Daily (Today's Trending)
- Window ID: `block.timestamp / 1 day`
- Rolling 24-hour window
- Best for "trending today"

### Weekly (This Week's Trending)
- Window ID: `block.timestamp / 7 days`
- Rolling 7-day window
- Best for "trending this week"

## Contract API

### Write Functions (PKP Only)

```solidity
function updateTrendingBatch(
    uint8 timeWindow,
    uint8[] calldata sources,
    string[] calldata songIds,
    uint32[] calldata clicks,
    uint32[] calldata plays,
    uint32[] calldata completions
) external onlyTrustedTracker whenNotPaused
```

### Read Functions (Public)

```solidity
// Get top N trending songs
function getTrendingSongs(uint8 timeWindow, uint256 limit)
    external view
    returns (TrendingSong[] memory)

// Get trending data for specific song
function getSongTrending(uint8 timeWindow, uint8 source, string calldata songId)
    external view
    returns (TrendingEntry memory)

// Get current window ID
function getCurrentWindowId(uint8 timeWindow)
    public view
    returns (uint256)
```

### Admin Functions (Owner Only)

```solidity
// Update scoring weights
function setWeights(uint8 clickWeight, uint8 playWeight, uint8 completionWeight)
    external onlyOwner

// Pause/unpause tracking
function pause() external onlyOwner
function unpause() external onlyOwner

// Update PKP address
function setTrustedTracker(address newTracker) external onlyOwner
```

## UI Patterns

### Trending Badge

```typescript
import { getTrendingBadge } from '@/services/TrendingService';

const badge = getTrendingBadge(rank, TimeWindow.Hourly);
// rank 1 → "#1 trending now"
// rank 2-3 → "#2 trending now", "#3 trending now"
// rank 4-10 → "Top 10 now"
// rank 11-50 → "Top 50 now"
```

### "Hot" Indicator

```typescript
import { isHotTrending } from '@/services/TrendingService';

const isHot = isHotTrending(trendingEntry);
// true if: updated in last hour AND completion rate > 50%

{isHot && <span>🔥 HOT</span>}
```

### Score Formatting

```typescript
import { formatTrendingScore } from '@/services/TrendingService';

formatTrendingScore(1234567) // "1.2M"
formatTrendingScore(12345)   // "12.3K"
formatTrendingScore(123)     // "123"
```

## Testing

### Manual Test Flow

1. **Track Events**:
   ```typescript
   trackClick(ContentSource.Genius, "123456");
   trackPlay(ContentSource.Genius, "123456");
   trackCompletion(ContentSource.Genius, "123456");
   ```

2. **Check Queue**:
   ```typescript
   const stats = getQueueStats();
   console.log(stats); // { totalEvents: 3, clicks: 1, plays: 1, completions: 1 }
   ```

3. **Force Sync** (don't wait 5 min):
   ```typescript
   await syncQueue(litClient, pkpPublicKey, TimeWindow.Hourly, litActionCode);
   ```

4. **Query Trending**:
   ```typescript
   const trending = await trendingService.getTrendingSongs(TimeWindow.Hourly, 10);
   console.log(trending); // Should include your song
   ```

### Contract Testing

```bash
cd contracts

# Run tests
forge test --match-contract TrendingTrackerV1Test -vvv

# Test specific function
forge test --match-test testUpdateTrendingBatch -vvv
```

## Gas Costs

### Deployment
- ~500K gas (~$2-5 on Lens Testnet)

### Updates (PKP pays)
- 1 song: ~100K gas
- 10 songs: ~300K gas
- 50 songs: ~1M gas
- 100 songs: ~2M gas

**Cost per song decreases with batch size** (gas efficiency of batching).

### Queries (Free)
- All read operations are free
- No gas cost to display trending

## Monitoring

### Queue Metrics

```typescript
import { getQueueStats, getLastSyncTime } from '@/services/TrendingQueueService';

// Display in debug panel
const stats = getQueueStats();
const lastSync = getLastSyncTime();

console.log(`Queue: ${stats.totalEvents} events`);
console.log(`Last sync: ${new Date(lastSync).toLocaleTimeString()}`);
```

### Contract Events

Listen for trending updates:

```typescript
trendingService.contract.on('TrendingBatchUpdated', (timeWindow, windowId, songCount, timestamp) => {
  console.log(`Trending updated: ${songCount} songs in window ${windowId}`);
});
```

## Roadmap

### Phase 1 ✅ (Complete)
- [x] Contract deployment (TrendingTrackerV1 on Lens testnet)
- [x] Lit Action aggregation (uploaded to IPFS)
- [x] PKP permissions configured
- [x] Frontend queue system (TrendingQueueService.ts)
- [x] Contract query utilities (TrendingService.ts)
- [x] Configuration integrated (lit-actions.ts)

### Phase 2 ✅ (Complete)
- [x] Trending display components (TrendingBadge, TrendingList, TrendingSection)
- [x] Integration with SongPickerPage
- [x] Event tracking on song clicks
- [x] Unit tests for services (24 tests passing)
- [ ] Real-time trending updates (websockets) - Future
- [ ] Trending notifications ("Your song is trending!") - Future
- [ ] Analytics dashboard - Future

### Phase 3 (Future)
- [ ] Paid trending boosts (promote songs)
- [ ] Regional trending (by country)
- [ ] Trending playlists (auto-generated)
- [ ] Trending rewards (token incentives)

## Troubleshooting

### Events not syncing?
```typescript
// Check queue
const stats = getQueueStats();
console.log(stats);

// Force sync
await syncQueue(litClient, pkpPublicKey, TimeWindow.Hourly, litActionCode);

// Check Lit Action response
// Look for errors in browser console
```

### Trending not showing?
```typescript
// Check contract data
const trending = await trendingService.getTrendingSongs(TimeWindow.Hourly, 10);
console.log(trending);

// Check current window
const windowId = await trendingService.getCurrentWindowId(TimeWindow.Hourly);
console.log('Current window:', windowId);
```

### PKP signature failing?
- Ensure PKP has permissions for Lit Action CID
- Check PKP public key is correct
- Verify contract address in Lit Action code

## Support

- **Contract Issues**: Check contract events on Lens explorer
- **Lit Action Issues**: Check browser console for errors
- **UI Issues**: Check queue stats and sync status

## License

MIT
