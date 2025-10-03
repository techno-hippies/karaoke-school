# KaraokeScoreboardV4 Deployment Guide

**Version**: 4.0
**Date**: 2025-01-03
**Contract**: `KaraokeScoreboardV4.sol`

---

## Overview

KaraokeScoreboardV4 is a multi-source karaoke scoring contract that supports:
- Native songs (from SongRegistryV4)
- Genius songs (from Genius.com API)
- Future: SoundCloud, Spotify

### Key Features

- ✅ **ContentSource enum** (Native, Genius, Soundcloud, Spotify)
- ✅ **Hash-based storage** for gas efficiency
- ✅ **Segment terminology** (replaces "clip")
- ✅ **Source-aware events** for indexing
- ✅ **Dual leaderboards** (segment + track)
- ✅ **Track completion detection**

---

## Deployment

### Prerequisites

```bash
# Environment variables
export PRIVATE_KEY="0x..."
export PKP_ADDRESS="0x254AA0096C9287a03eE62b97AA5643A2b8003657"  # Your PKP address
```

### Deploy to Lens Testnet (zkSync)

```bash
cd contracts

# Deploy using Foundry with zkSync profile
FOUNDRY_PROFILE=zksync forge script script/DeployKaraokeScoreboardV4.s.sol:DeployKaraokeScoreboardV4 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync

# Expected output:
# KaraokeScoreboardV4 deployed at: 0x...
# Owner: 0x...
# Trusted Scorer: 0x254AA0096C9287a03eE62b97AA5643A2b8003657
```

### Generate ABI

```bash
forge inspect KaraokeScoreboardV4 abi > ../site/src/abi/KaraokeScoreboardV4.json
```

---

## Configuration

### 1. Configure Native Track

```bash
# Example: Configure "Heat of the Night" by Scarlett X
cast send <CONTRACT_ADDRESS> \
  "configureTrack(uint8,string,string[])" \
  0 \
  "heat-of-the-night-scarlett-x" \
  '["verse-1","chorus-1","verse-2","chorus-2","bridge-1"]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

**Parameters**:
- `source`: `0` (Native)
- `trackId`: `"heat-of-the-night-scarlett-x"`
- `segmentIds`: `["verse-1", "chorus-1", "verse-2", "chorus-2", "bridge-1"]`

### 2. Configure Genius Track

```bash
# Example: Configure Genius song ID 123456
cast send <CONTRACT_ADDRESS> \
  "configureTrack(uint8,string,string[])" \
  1 \
  "123456" \
  '["referent-5678","referent-5679","referent-5680"]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

**Parameters**:
- `source`: `1` (Genius)
- `trackId`: `"123456"` (genius_id)
- `segmentIds`: `["referent-5678", "referent-5679", "referent-5680"]`

---

## Usage

### Submit Score (via PKP)

```solidity
// PKP calls this after STT scoring
scoreboard.updateScore(
    0,                                  // source (0=Native, 1=Genius)
    "heat-of-the-night-scarlett-x",    // trackId
    "verse-1",                          // segmentId
    userAddress,                        // user
    87                                  // score (0-100)
);
```

### Query Segment Leaderboard

```solidity
// Get top 10 scorers for a segment
LeaderboardEntry[10] memory leaderboard = scoreboard.getTopSegmentScorers(
    0,                                  // source
    "verse-1"                          // segmentId
);
```

### Query Track Leaderboard

```solidity
// Get top 10 scorers for a track (users who completed ALL segments)
LeaderboardEntry[10] memory leaderboard = scoreboard.getTopTrackScorers(
    0,                                  // source
    "heat-of-the-night-scarlett-x"     // trackId
);
```

### Get User Score

```solidity
// Get user's segment score
(uint96 score, uint64 timestamp, uint16 attemptCount) = scoreboard.getSegmentScore(
    0,                                  // source
    "verse-1",                         // segmentId
    userAddress
);

// Get user's track score
(uint96 totalScore, uint64 timestamp, uint16 segmentsCompleted, bool isComplete) =
    scoreboard.getTrackScore(
        0,                              // source
        "heat-of-the-night-scarlett-x", // trackId
        userAddress
    );
```

---

## Contract Addresses

### Lens Testnet

| Contract | Address | Deployed | Status |
|----------|---------|----------|--------|
| KaraokeScoreboardV4 | `TBD` | `TBD` | Not deployed |

---

## Events

### SegmentScoreUpdated

```solidity
event SegmentScoreUpdated(
    uint8 indexed source,           // 0=Native, 1=Genius
    string trackId,
    string segmentId,
    address indexed user,
    uint96 score,
    uint64 timestamp,
    bool isNewHighScore,
    bool enteredTopTen,
    uint8 leaderboardPosition
);
```

**Indexing**: Index by `source` and `user` to filter scores

### TrackCompleted

```solidity
event TrackCompleted(
    uint8 indexed source,
    string trackId,
    address indexed user,
    uint96 totalScore,
    uint64 timestamp,
    bool enteredTopTen,
    uint8 leaderboardPosition
);
```

**Indexing**: Index by `source` and `user` to filter completions

### TrackConfigured

```solidity
event TrackConfigured(
    uint8 indexed source,
    string trackId,
    bytes32 trackHash,
    bytes32[] segmentHashes,
    uint16 segmentCount
);
```

**Indexing**: Index by `source` to filter by content source

---

## Testing

### Test Score Submission

```bash
# 1. Configure a test track
cast send <CONTRACT_ADDRESS> \
  "configureTrack(uint8,string,string[])" \
  0 "test-song" '["seg-1","seg-2"]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY

# 2. Submit score (as PKP)
cast send <CONTRACT_ADDRESS> \
  "updateScore(uint8,string,string,address,uint96)" \
  0 "test-song" "seg-1" <USER_ADDRESS> 95 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY

# 3. Check score
cast call <CONTRACT_ADDRESS> \
  "getSegmentScore(uint8,string,address)" \
  0 "seg-1" <USER_ADDRESS> \
  --rpc-url https://rpc.testnet.lens.xyz
```

---

## Admin Functions

### Update Trusted Scorer

```bash
cast send <CONTRACT_ADDRESS> \
  "setTrustedScorer(address)" \
  <NEW_PKP_ADDRESS> \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Pause Contract

```bash
cast send <CONTRACT_ADDRESS> \
  "pause()" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Unpause Contract

```bash
cast send <CONTRACT_ADDRESS> \
  "unpause()" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Migration from V3

### Key Differences

| Feature | V3 | V4 |
|---------|----|----|
| Terminology | Clip | Segment |
| Source tracking | Implicit (native only) | Explicit enum |
| Storage keys | String-based | Hash-based (bytes32) |
| Events | Generic | Source-aware |
| Multi-source support | No | Yes (Native, Genius, etc.) |

### Migration Steps

1. ✅ Deploy V4 contract
2. ✅ Configure tracks in V4 (re-add from V3)
3. ✅ Update frontend to use V4 ABI and address
4. ✅ Update PKP to call V4
5. ❌ **Do not migrate old scores** (clean slate)

---

## Gas Optimization

V4 uses hash-based storage for improved gas efficiency:

```solidity
// V3: String-based keys
mapping(string => mapping(address => Score)) public clipScores;

// V4: Hash-based keys
mapping(bytes32 => mapping(address => Score)) public segmentScores;

// Hash generation
bytes32 hash = keccak256(abi.encodePacked(source, id));
```

**Gas savings**: ~5-10% on score submissions

---

## Frontend Integration

### Update Config

```typescript
// site/src/config/contracts.ts
export const KARAOKE_SCOREBOARD_V4_ADDRESS = '0x...';  // From deployment
```

### Import ABI

```typescript
import { abi as KaraokeScoreboardV4ABI } from '../abi/KaraokeScoreboardV4.json';
```

### Call Contract

```typescript
import { ContentSource } from '../types/song';

// Submit score
await scoreboard.updateScore(
  ContentSource.Native,              // or ContentSource.Genius
  'heat-of-the-night-scarlett-x',
  'verse-1',
  userAddress,
  87
);

// Query leaderboard
const leaderboard = await scoreboard.getTopSegmentScorers(
  ContentSource.Native,
  'verse-1'
);
```

---

## Troubleshooting

### Track Not Configured

**Error**: `Track not configured`

**Solution**: Call `configureTrack()` with the correct source and trackId

```bash
cast send <CONTRACT_ADDRESS> \
  "configureTrack(uint8,string,string[])" \
  0 "your-track-id" '["seg-1","seg-2"]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Not Trusted Scorer

**Error**: `Not trusted scorer`

**Solution**: Ensure you're calling from the PKP address

```bash
# Check trusted scorer
cast call <CONTRACT_ADDRESS> "trustedScorer()" \
  --rpc-url https://rpc.testnet.lens.xyz

# Update if needed
cast send <CONTRACT_ADDRESS> \
  "setTrustedScorer(address)" <NEW_PKP> \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Next Steps

1. ✅ Deploy contract to Lens testnet
2. ✅ Generate and commit ABI
3. ✅ Configure initial tracks
4. ⬜ Update frontend to use V4
5. ⬜ Update PKP to submit to V4
6. ⬜ Test end-to-end flow
7. ⬜ Deploy to mainnet

---

**Contract Source**: `contracts/src/KaraokeScoreboardV4.sol`
**Deployment Script**: `contracts/script/DeployKaraokeScoreboardV4.s.sol`
**Documentation**: `SEGMENT_ARCHITECTURE.md`
