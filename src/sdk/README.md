# View Tracking SDK

## Installation

```bash
npm install ethers @lit-protocol/lit-node-client siwe
```

## Quick Start

### React Hook Usage

```tsx
import { useViewTracker } from './sdk/useViewTracker';

function VideoFeed() {
  const { initialize, startTracking, stopTracking } = useViewTracker({
    viewVerifierAddress: '0x931AaA75A23256e6D1a4261DD3D9b224aBA289B9',
    viewVerifierAbi: ViewVerifierABI,
    rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/YOUR_KEY',
    livepeerApiKey: 'YOUR_LIVEPEER_API_KEY',
    autoSubmit: true
  });

  // Initialize on wallet connect
  useEffect(() => {
    if (signer) {
      initialize(signer);
    }
  }, [signer]);

  return (
    <div>
      {videos.map(video => (
        <VideoPlayer
          key={video.playbackId}
          playbackId={video.playbackId}
          onPlay={() => startTracking(video.playbackId)}
          onEnded={() => stopTracking()}
        />
      ))}
    </div>
  );
}
```

### Vanilla JavaScript Usage

```javascript
import { ViewTracker } from './sdk/view-tracker';
import { ethers } from 'ethers';

// Initialize
const tracker = new ViewTracker({
  viewVerifierAddress: '0x931AaA75A23256e6D1a4261DD3D9b224aBA289B9',
  viewVerifierAbi: ViewVerifierABI,
  rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/YOUR_KEY',
  livepeerApiKey: 'YOUR_LIVEPEER_API_KEY'
});

// Connect wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await tracker.initialize(signer);

// Track video view
const playbackId = 'abc123';

// Start when video plays
tracker.startTracking(playbackId);

// Pause when video pauses
tracker.pauseTracking(playbackId);

// Resume when video resumes
tracker.resumeTracking(playbackId);

// Stop and submit when video ends
const txHash = await tracker.stopTracking(playbackId);
console.log('View verified on-chain:', txHash);

// Query stats
const stats = await tracker.getVideoStats(playbackId);
console.log('Total views:', stats.totalViews);
```

## API Reference

### ViewTracker Class

#### Constructor
```typescript
new ViewTracker(config: {
  viewVerifierAddress: string;
  viewVerifierAbi: any;
  rpcUrl: string;
  livepeerApiKey: string;
  litNetwork?: string;  // default: 'cayenne'
  minWatchTime?: number; // default: 3 seconds
  pingInterval?: number; // default: 5000ms
})
```

#### Methods

- `initialize(signer: ethers.Signer): Promise<void>` - Initialize with user's wallet
- `startTracking(playbackId: string): void` - Start tracking a video
- `pauseTracking(playbackId: string): void` - Pause tracking
- `resumeTracking(playbackId: string): void` - Resume tracking
- `stopTracking(playbackId: string): Promise<string | null>` - Stop and submit view
- `getVideoStats(playbackId: string): Promise<ViewStats>` - Get video statistics
- `getUserViews(address: string): Promise<ViewVerification[]>` - Get user's view history
- `destroy(): void` - Cleanup resources

### React Hook

#### Usage
```typescript
const {
  // State
  isInitialized,
  isTracking,
  currentPlaybackId,
  error,
  
  // Actions
  initialize,
  startTracking,
  pauseTracking,
  resumeTracking,
  stopTracking,
  
  // Queries
  getVideoStats,
  getUserViews
} = useViewTracker(config);
```

## How It Works

1. **Initialization**: Connect to LIT network and authenticate with SIWE
2. **Tracking**: Monitor video playback with 5-second pings
3. **Validation**: LIT Action validates view against Livepeer metrics
4. **Submission**: PKP signs proof and submits to smart contract
5. **Indexing**: TheGraph indexes the on-chain event
6. **Querying**: Frontend queries aggregated stats from subgraph

## Security

- Views must be validated against actual Livepeer streaming metrics
- Minimum watch time prevents spam (default: 3 seconds)
- PKP signature ensures only authorized submissions
- On-chain events provide immutable record
- SIWE authentication prevents impersonation

## Testing

```bash
# Run integration test
npm test

# Test with local subgraph
SUBGRAPH_URL=http://localhost:8000/subgraphs/name/tiktok-views npm test
```

## Environment Variables

```env
NEXT_PUBLIC_VIEW_VERIFIER_ADDRESS=0x931AaA75A23256e6D1a4261DD3D9b224aBA289B9
NEXT_PUBLIC_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_LIVEPEER_API_KEY=your_livepeer_api_key
NEXT_PUBLIC_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/tiktok-views
```