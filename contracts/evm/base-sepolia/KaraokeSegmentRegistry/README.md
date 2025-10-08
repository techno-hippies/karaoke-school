# KaraokeSegmentRegistryV1

**Status**: ✅ Ready to Deploy
**Network**: Base Sepolia (Testnet)
**Chain ID**: 84532

## Overview

On-chain registry for user-generated karaoke segments. Tracks which songs have been processed and stores segment metadata + Grove URIs for stems.

## Key Features

✅ **Segment Metadata**: Stores timing, section types, durations
✅ **Asset Tracking**: Links to Grove URIs (vocals.zip, drums.zip)
✅ **Processing Status**: Tracks Created → Processed lifecycle
✅ **Batch Registration**: Efficient gas usage via batch operations
✅ **PKP Integration**: Only trusted processor can register segments

## Contract Interface

### Processor Functions (PKP Only)

```solidity
// Register song + all segments (called by match-and-segment-v2)
function addSegmentsBatch(
    uint8 source,
    string songId,
    string artist,
    string title,
    string[] segmentIds,
    string[] sectionTypes,
    uint32[] startTimes,
    uint32[] endTimes,
    address createdBy
) external

// Update segment with assets (called by audio-processor-v1)
function updateSegmentAssets(
    uint8 source,
    string songId,
    string segmentId,
    string vocalsUri,
    string drumsUri,
    string audioSnippetUri
) external
```

### Query Functions

```solidity
// Check if song processed
function songExists(uint8 source, string songId) external view returns (bool)

// Get all segments for a song
function getSongSegments(uint8 source, string songId)
    external view returns (Segment[] memory)

// Get specific segment
function getSegment(uint8 source, string songId, string segmentId)
    external view returns (Segment memory)

// Check if assets uploaded
function isSegmentProcessed(uint8 source, string songId, string segmentId)
    external view returns (bool)
```

## Integration Flow

### Step 1: Cold Start (match-and-segment-v2.js)

```javascript
// Lit Action generates segments
const segments = [
  { id: "verse-1", type: "Verse 1", startTime: 0, endTime: 30 },
  { id: "chorus-1", type: "Chorus", startTime: 30, endTime: 60 },
  // ...
]

// Register in batch
await registry.addSegmentsBatch(
  1,  // Genius source
  "378195",  // geniusId
  "Sia",
  "Chandelier",
  segments.map(s => s.id),
  segments.map(s => s.type),
  segments.map(s => s.startTime),
  segments.map(s => s.endTime),
  userAddress
)
```

### Step 2: Asset Processing (audio-processor-v1.js)

```javascript
// After stem separation
const vocalsUri = await uploadToGrove(vocalsZip)
const drumsUri = await uploadToGrove(drumsZip)

// Update segment
await registry.updateSegmentAssets(
  1,  // Genius
  "378195",
  "chorus-1",
  vocalsUri,
  drumsUri,
  audioSnippetUri
)
```

### Step 3: Frontend Query

```typescript
// Check if song processed
const exists = await registry.read.songExists([1, '378195'])

if (exists) {
  // Get all segments
  const segments = await registry.read.getSongSegments([1, '378195'])

  // Display in SegmentPickerDrawer
  segments.forEach(seg => {
    console.log(`${seg.sectionType}: ${seg.startTime}s - ${seg.endTime}s`)
    console.log(`Status: ${seg.status === 1 ? 'Processed' : 'Created'}`)
  })
}
```

## Deployment

```bash
export PRIVATE_KEY=0x...
export PKP_ADDRESS=0x...  # Lit Protocol PKP

forge script KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Data Structures

### Segment

```solidity
struct Segment {
    string segmentId;           // "verse-1", "chorus-1"
    string sectionType;         // "Verse 1", "Chorus"
    uint32 startTime;           // Start time (seconds)
    uint32 endTime;             // End time (seconds)
    uint32 duration;            // Duration (calculated)
    string vocalsUri;           // Grove URI to vocals.zip
    string drumsUri;            // Grove URI to drums.zip
    string audioSnippetUri;     // Grove URI to audio preview
    SegmentStatus status;       // Created or Processed
    uint64 createdAt;           // Timestamp
    uint64 processedAt;         // Timestamp (0 if not processed)
    address createdBy;          // User who triggered generation
    bool exists;                // Exists flag
}
```

### SongMetadata

```solidity
struct SongMetadata {
    uint8 source;               // ContentSource enum
    string songId;              // Song identifier
    string artist;              // Artist name
    string title;               // Song title
    uint32 totalSegments;       // Number of segments
    uint64 generatedAt;         // Generation timestamp
    bool exists;                // Exists flag
}
```

## Example: Complete Flow

```typescript
// 1. Check if song exists
const songHash = await registry.read.getSongHash([1, '378195'])
const exists = await registry.read.songExists([1, '378195'])

if (!exists) {
  // 2. Trigger cold start (FREE - match-and-segment-v2)
  await litAction.executeJs({
    code: matchAndSegmentV2Code,
    jsParams: { geniusId: 378195 }
  })
  // Lit Action calls registry.addSegmentsBatch()
}

// 3. Get segments
const segments = await registry.read.getSongSegments([1, '378195'])

// 4. Check if segment processed
const processed = await registry.read.isSegmentProcessed([1, '378195', 'chorus-1'])

if (!processed) {
  // 5. User needs to unlock (uses credit)
  await creditsContract.write.useCredit([1, '378195', 'chorus-1'])

  // 6. Trigger audio processing (audio-processor-v1)
  await litAction.executeJs({
    code: audioProcessorV1Code,
    jsParams: {
      geniusId: 378195,
      sectionIndex: 1,  // chorus
      sections: segments
    }
  })
  // Lit Action calls registry.updateSegmentAssets()
}

// 7. Assets ready - start karaoke!
const segment = await registry.read.getSegment([1, '378195', 'chorus-1'])
console.log('Vocals:', segment.vocalsUri)
console.log('Drums:', segment.drumsUri)
```

## Gas Optimization

- **Batch Operations**: Register all segments in one transaction (~100k gas for 10 segments)
- **Status Enum**: Uses uint8 (1 byte) instead of bool
- **String Storage**: Only Grove URIs stored on-chain (content on IPFS)
- **Lazy Loading**: Assets only added when user purchases

## Admin Functions

```solidity
// Update trusted processor
function setTrustedProcessor(address newProcessor) external onlyOwner

// Emergency pause
function pause() external onlyOwner
function unpause() external onlyOwner

// Transfer ownership
function transferOwnership(address newOwner) external onlyOwner
```

## Testing

```bash
forge test --match-contract KaraokeSegmentRegistryV1Test -vv
```

## License

MIT
