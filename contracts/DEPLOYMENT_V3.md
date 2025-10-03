# KaraokeScoreboardV3 Deployment

## ✅ Successfully Deployed

**Contract Address:** `0xDDA922b0c8B95Bd3af75c20e00413b326381fca5`
**Network:** Lens Chain Testnet
**Transaction:** `0x3d19a041b8ee7b12a6d805a8fef99b52cbe4b00379817c37f6c32b2ac4e09732`
**Explorer:** https://explorer.testnet.lens.xyz/address/0xDDA922b0c8B95Bd3af75c20e00413b326381fca5
**Deployed:** 2025-10-02

---

## Contract Configuration

**Owner:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`
**Trusted Scorer (PKP):** `0x254AA0096C9287a03eE62b97AA5643A2b8003657`
**Paused:** `false` (active)

---

## What's New in V3

### 1. Track-Level Leaderboards
- Separate leaderboards for individual clips AND complete tracks
- Automatic track completion detection when all clips scored
- Track leaderboard only shows users who completed ALL clips

### 2. Emergency Pause
- Owner can pause/unpause score submissions
- Queries still work when paused (view leaderboards)

### 3. Track Configuration Management
- Owner configures which clips belong to each track
- Owner can update clip lists (for fixes/additions)

### 4. No Unbounded Arrays
- Removed gas-bomb risk from V2
- Use event indexers for analytics instead

---

## How to Use

### 1. Configure a Track (Owner Only)

```bash
# Example: Configure "down-home-blues" track
cast send 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "configureTrack(string,string[])" \
  "down-home-blues" \
  '["down-home-blues-verse","down-home-blues-chorus","down-home-blues-chorus-2"]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### 2. Submit Clip Scores (PKP Only)

```bash
# PKP submits score via Lit Action
# Contract automatically:
# - Updates clip leaderboard
# - Checks if user completed all clips
# - Updates track leaderboard if complete

cast send 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "updateScore(string,string,address,uint96)" \
  "down-home-blues" \
  "down-home-blues-verse" \
  "0xUserAddress" \
  87 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PKP_PRIVATE_KEY
```

### 3. Query Clip Leaderboard

```bash
cast call 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "getTopClipScorers(string)" \
  "down-home-blues-verse" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### 4. Query Track Leaderboard

```bash
# Shows top 10 users who completed ALL clips
cast call 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "getTopTrackScorers(string)" \
  "down-home-blues" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### 5. Check User's Track Progress

```bash
cast call 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "getTrackScore(string,address)" \
  "down-home-blues" \
  "0xUserAddress" \
  --rpc-url https://rpc.testnet.lens.xyz

# Returns: (totalScore, timestamp, clipsCompleted, isComplete)
# Example: (174, 1727894400, 2, false) = "2/3 clips done, 174 total"
```

---

## Emergency Controls (Owner Only)

### Pause Contract
```bash
cast send 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "pause()" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Unpause Contract
```bash
cast send 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "unpause()" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

### Update Trusted Scorer
```bash
cast send 0xDDA922b0c8B95Bd3af75c20e00413b326381fca5 \
  "setTrustedScorer(address)" \
  "0xNewPKPAddress" \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Deployment Command Reference

**For future deployments or other networks:**

```bash
bash -c 'DOTENV_PRIVATE_KEY="a75a20fca4d452c7827a662f9ee0857c5147efce6a19149b7f0276b3fbc110d7" \
  npx dotenvx run --env-file=.env -- bash -c \
  "FOUNDRY_PROFILE=zksync forge create \
    src/KaraokeScoreboardV3.sol:KaraokeScoreboardV3 \
    --broadcast \
    --rpc-url https://rpc.testnet.lens.xyz \
    --private-key \$PRIVATE_KEY \
    --constructor-args 0x254AA0096C9287a03eE62b97AA5643A2b8003657 \
    --zksync"'
```

**Key Requirements:**
- ✅ Use `bash -c` wrapper
- ✅ Use `dotenvx run` to decrypt PRIVATE_KEY
- ✅ Set `FOUNDRY_PROFILE=zksync`
- ✅ `--broadcast` flag immediately after contract name
- ✅ Constructor arg: PKP address

---

## Integration Checklist

- [x] Contract deployed and verified
- [x] Contract address saved to .env
- [ ] Configure tracks (call `configureTrack` for each song)
- [ ] Update Lit Action with V3 contract address
- [ ] Update Lit Action to submit trackId + clipId
- [ ] Update frontend to query `getTopTrackScorers(trackId)`
- [ ] Update frontend to show track completion progress
- [ ] Test end-to-end: score clip → auto track completion

---

## Frontend Integration

### TypeScript Example

```typescript
import { KaraokeScoreboardV3ABI } from './abi/KaraokeScoreboardV3';

// Query track leaderboard
const leaderboard = await publicClient.readContract({
  address: '0xDDA922b0c8B95Bd3af75c20e00413b326381fca5',
  abi: KaraokeScoreboardV3ABI,
  functionName: 'getTopTrackScorers',
  args: ['down-home-blues'],
});

// Check user's progress
const [totalScore, timestamp, clipsCompleted, isComplete] =
  await publicClient.readContract({
    address: '0xDDA922b0c8B95Bd3af75c20e00413b326381fca5',
    abi: KaraokeScoreboardV3ABI,
    functionName: 'getTrackScore',
    args: ['down-home-blues', userAddress],
  });

console.log(`Progress: ${clipsCompleted}/${trackClipCount} clips`);
console.log(`Total score: ${totalScore}`);
console.log(`Complete: ${isComplete}`);
```

---

## Events

The contract emits these events for off-chain monitoring:

- `ClipScoreUpdated` - When a clip score is submitted
- `TrackCompleted` - When user completes all clips in a track
- `TrackConfigured` - When owner configures a track
- `TrackClipsUpdated` - When owner updates track clips
- `Paused` / `Unpaused` - Emergency controls
- `TrustedScorerUpdated` - PKP address changed
- `OwnershipTransferred` - Owner changed

---

## Migration from V2

If you have V2 deployed:

1. **V3 is deployed fresh** - No automatic migration
2. **V2 data stays on V2** - Scores don't transfer
3. **Options:**
   - Run both in parallel (keep V2 for history)
   - Switch to V3 only for new tracks
   - Build migration UI (read V2, display alongside V3)

---

## Notes

- Track IDs are strings (e.g., "down-home-blues")
- Clip IDs are strings (e.g., "down-home-blues-verse")
- Scores are 0-100 (uint96)
- Leaderboards are fixed size: 10 entries
- Track must be configured before accepting scores
- Track completion is automatic (no manual trigger)
- Contract uses Solidity 0.8.19 (zkSync compatible)

---

Last Updated: 2025-10-02
