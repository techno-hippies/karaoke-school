# Minimal Event Contracts

Event-only contracts for Grove + The Graph architecture. **Replaces V1 contract storage** with off-chain Grove metadata and on-chain event logs.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  V1 (Storage-Heavy)                       │
├──────────────────────────────────────────────────────────┤
│  Contract Storage:                                        │
│  • Full structs on-chain (Song, Segment, Performance)    │
│  • Mappings and arrays (expensive)                       │
│  • On-chain sorting (LeaderboardV1)                      │
│                                                           │
│  Gas Costs:                                               │
│  • Register song: ~200k (~$0.20 on Base)                 │
│  • Register segment: ~180k (~$0.18)                      │
│  • Grade performance: ~100k (~$0.10)                     │
│  • Update leaderboard: ~80k (~$0.08)                     │
└──────────────────────────────────────────────────────────┘

                         ▼ Refactor

┌──────────────────────────────────────────────────────────┐
│              V2 (Events + Grove)                          │
├──────────────────────────────────────────────────────────┤
│  Event Contracts (this folder):                          │
│  • SongEvents.sol - Registration events                  │
│  • SegmentEvents.sol - Processing events                 │
│  • PerformanceGrader.sol - PKP-verified grading          │
│  • AccountEvents.sol - Account tracking (optional)       │
│                                                           │
│  Data Storage:                                            │
│  • Grove: Immutable metadata (songs, segments)           │
│  • Grove: Mutable metadata (accounts, via ACL)           │
│  • The Graph: Indexed events (leaderboards)              │
│                                                           │
│  Gas Costs:                                               │
│  • Register song: ~28k (~$0.03) - 86% savings            │
│  • Register segment: ~30k (~$0.03) - 83% savings         │
│  • Grade performance: ~48k (~$0.05) - 52% savings        │
│  • Update leaderboard: $0 (off-chain) - 100% savings     │
└──────────────────────────────────────────────────────────┘
```

## Contracts

### 1. SongEvents.sol
**Purpose:** Emit events for song registration/updates

**Events:**
- `SongRegistered(geniusId, metadataUri, registeredBy, geniusArtistId, timestamp)`
- `SongMetadataUpdated(geniusId, metadataUri, updatedBy, timestamp)`
- `SongToggled(geniusId, enabled, timestamp)`

**Usage:**
```typescript
// 1. Upload song metadata to Grove
const metadata = createSongMetadata({...});
const { uri } = await grove.uploadAsJson(metadata);

// 2. Emit event for indexing
await songEvents.emitSongRegistered(
  10047250, // geniusId
  uri,      // metadataUri
  498       // geniusArtistId (optional, 0 if none)
);

// 3. Query via The Graph or direct Grove fetch
const song = await fetch(`https://api.grove.storage/${uri}`).then(r => r.json());
```

**Gas:** ~28k per registration

---

### 2. SegmentEvents.sol
**Purpose:** Emit events for segment registration/processing

**Events:**
- `SegmentRegistered(segmentHash, geniusId, tiktokSegmentId, metadataUri, registeredBy, timestamp)`
- `SegmentProcessed(segmentHash, instrumentalUri, alignmentUri, metadataUri, timestamp)`
- `SegmentToggled(segmentHash, enabled, timestamp)`

**Helper:**
- `getSegmentHash(geniusId, tiktokSegmentId)` - Generate deterministic hash

**Usage:**
```typescript
// 1. Create segment metadata (before processing)
const segment = createSegmentMetadata({...});
const { uri } = await grove.uploadAsJson(segment);

// 2. Emit registration event
const hash = await segmentEvents.getSegmentHash(geniusId, tiktokSegmentId);
await segmentEvents.emitSegmentRegistered(hash, geniusId, tiktokSegmentId, uri);

// 3. After processing (Demucs + fal.ai + ElevenLabs)
const processed = markProcessed(segment, {
  instrumentalUri: 'lens://...',
  alignmentUri: 'lens://...',
}, {...});

const { uri: updatedUri } = await grove.updateJson(uri, processed);

// 4. Emit processing event
await segmentEvents.emitSegmentProcessed(
  hash,
  processed.instrumentalUri!,
  processed.alignmentUri!,
  updatedUri
);
```

**Gas:** ~30k per registration, ~32k for processing

---

### 3. PerformanceGrader.sol
**Purpose:** PKP-verified performance grading (CRITICAL FOR ANTI-CHEAT)

**Events:**
- `PerformanceGraded(performanceId, segmentHash, performer, score, metadataUri, timestamp)`
- `PerformanceSubmitted(performanceId, segmentHash, performer, videoUri, timestamp)`
- `TrustedPKPUpdated(oldPKP, newPKP)`
- `PausedUpdated(paused)`

**State:**
- `address trustedPKP` - Only this PKP can call `gradePerformance()`
- `bool paused` - Emergency pause flag

**Usage:**
```typescript
// === USER SUBMISSION (anyone can call) ===

// 1. Upload performance video to Grove
const { uri: videoUri } = await grove.uploadAsJson(performanceMetadata);

// 2. Emit submission event
await performanceGrader.submitPerformance(
  12345,     // performanceId
  segmentHash,
  userAddress,
  videoUri
);

// === LIT ACTION GRADING (only PKP) ===

// 3. Lit Action grades video (AI scoring)
const litAction = async () => {
  // Transcribe audio, score pronunciation, timing, etc.
  const score = await gradeVideo(videoUri);

  // Update metadata in Grove
  const graded = addGrading(performance, {
    score: 8525, // basis points
    gradedBy: pkpAddress,
    gradedAt: new Date().toISOString(),
  });
  await grove.updateJson(performanceUri, graded);

  // Sign transaction with PKP to emit event
  const tx = await performanceGrader.gradePerformance(
    performanceId,
    segmentHash,
    performer,
    score,
    performanceUri
  );

  return { score, tx };
};

// 4. The Graph indexes PerformanceGraded event
// 5. Leaderboards built from indexed events (no spoofing!)
```

**Anti-Cheat Guarantees:**
- ✅ Only `trustedPKP` can call `gradePerformance()`
- ✅ Lit nodes reach consensus on execution
- ✅ Events are immutable (no editing scores)
- ✅ The Graph indexes for leaderboards

**Gas:** ~48k per grading

---

### 4. AccountEvents.sol (Optional)
**Purpose:** Track unified account creation (no artist/user split)

**Events:**
- `AccountCreated(lensAccountAddress, pkpAddress, username, metadataUri, geniusArtistId, timestamp)`
- `AccountMetadataUpdated(lensAccountAddress, metadataUri, updatedBy, timestamp)`
- `AccountVerified(lensAccountAddress, verified, verifiedBy, timestamp)`

**Note:** This contract is OPTIONAL. Lens accounts already exist on-chain, so events here are purely for analytics/filtering.

**Usage:**
```typescript
// 1. Create Lens account + upload metadata to Grove
const metadata = createInitialAccountMetadata({...});
const { uri } = await grove.uploadAsJson(metadata);

// 2. Optionally emit event for indexing
await accountEvents.emitAccountCreated(
  lensAccountAddress,
  pkpAddress,
  username,
  uri,
  geniusArtistId // 0 if not an artist
);
```

**Gas:** ~25k per event

---

## Deployment

### Deploy Order
1. **PerformanceGrader** (requires PKP address)
2. **SongEvents** (standalone)
3. **SegmentEvents** (standalone)
4. **AccountEvents** (optional)

### Constructor Parameters

```typescript
// PerformanceGrader
const performanceGrader = await deploy('PerformanceGrader', [
  trustedPKPAddress, // Your PKP address from Lit Protocol
]);

// Others have no constructor params
const songEvents = await deploy('SongEvents', []);
const segmentEvents = await deploy('SegmentEvents', []);
const accountEvents = await deploy('AccountEvents', []);
```

### Hardhat Deployment Script
```typescript
// scripts/deploy-events.ts
import { ethers } from 'hardhat';

async function main() {
  // Deploy PerformanceGrader with PKP
  const trustedPKP = process.env.TRUSTED_PKP_ADDRESS;
  const PerformanceGrader = await ethers.getContractFactory('PerformanceGrader');
  const performanceGrader = await PerformanceGrader.deploy(trustedPKP);
  await performanceGrader.deployed();
  console.log('PerformanceGrader:', performanceGrader.address);

  // Deploy event-only contracts (no params)
  const SongEvents = await ethers.getContractFactory('SongEvents');
  const songEvents = await SongEvents.deploy();
  await songEvents.deployed();
  console.log('SongEvents:', songEvents.address);

  const SegmentEvents = await ethers.getContractFactory('SegmentEvents');
  const segmentEvents = await SegmentEvents.deploy();
  await segmentEvents.deployed();
  console.log('SegmentEvents:', segmentEvents.address);

  const AccountEvents = await ethers.getContractFactory('AccountEvents');
  const accountEvents = await AccountEvents.deploy();
  await accountEvents.deployed();
  console.log('AccountEvents:', accountEvents.address);
}

main();
```

---

## The Graph Integration

### Subgraph Schema

```graphql
type Song @entity {
  id: ID! # geniusId
  metadataUri: String!
  registeredBy: Bytes!
  geniusArtistId: Int!
  timestamp: BigInt!
  enabled: Boolean!
}

type Segment @entity {
  id: ID! # segmentHash
  geniusId: Int!
  tiktokSegmentId: String!
  metadataUri: String!
  instrumentalUri: String
  alignmentUri: String
  processed: Boolean!
  enabled: Boolean!
  timestamp: BigInt!
}

type Performance @entity {
  id: ID! # performanceId
  segmentHash: Bytes!
  performer: Bytes!
  score: Int! # basis points
  metadataUri: String!
  timestamp: BigInt!
}

type LeaderboardEntry @entity {
  id: ID! # "segment-{segmentHash}-{performer}"
  segmentHash: Bytes!
  performer: Bytes!
  bestScore: Int!
  totalAttempts: Int!
  lastUpdated: BigInt!
}
```

### Subgraph Mappings

```typescript
// src/mappings/performance-grader.ts
import { PerformanceGraded } from '../generated/PerformanceGrader/PerformanceGrader';
import { Performance, LeaderboardEntry } from '../generated/schema';

export function handlePerformanceGraded(event: PerformanceGraded): void {
  // Create/update Performance entity
  const performance = new Performance(event.params.performanceId.toString());
  performance.segmentHash = event.params.segmentHash;
  performance.performer = event.params.performer;
  performance.score = event.params.score;
  performance.metadataUri = event.params.metadataUri;
  performance.timestamp = event.block.timestamp;
  performance.save();

  // Update leaderboard entry
  const entryId = `${event.params.segmentHash.toHexString()}-${event.params.performer.toHexString()}`;
  let entry = LeaderboardEntry.load(entryId);

  if (!entry) {
    entry = new LeaderboardEntry(entryId);
    entry.segmentHash = event.params.segmentHash;
    entry.performer = event.params.performer;
    entry.bestScore = event.params.score;
    entry.totalAttempts = 1;
  } else {
    if (event.params.score > entry.bestScore) {
      entry.bestScore = event.params.score;
    }
    entry.totalAttempts += 1;
  }

  entry.lastUpdated = event.block.timestamp;
  entry.save();
}
```

### Subgraph Queries

```graphql
# Get top performers for a segment
query SegmentLeaderboard($segmentHash: Bytes!) {
  leaderboardEntries(
    where: { segmentHash: $segmentHash }
    orderBy: bestScore
    orderDirection: desc
    first: 100
  ) {
    performer
    bestScore
    totalAttempts
    lastUpdated
  }
}

# Get user's performances
query UserPerformances($performer: Bytes!) {
  performances(
    where: { performer: $performer }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    segmentHash
    score
    metadataUri
    timestamp
  }
}

# Get recent songs
query RecentSongs {
  songs(
    orderBy: timestamp
    orderDirection: desc
    first: 50
    where: { enabled: true }
  ) {
    id
    metadataUri
    timestamp
  }
}
```

---

## Gas Comparison

| Operation | V1 (Storage) | V2 (Events) | Savings |
|-----------|--------------|-------------|---------|
| Register song | ~200k ($0.20) | ~28k ($0.03) | **86%** |
| Update song metadata | ~50k ($0.05) | ~30k ($0.03) | 40% |
| Register segment | ~180k ($0.18) | ~30k ($0.03) | **83%** |
| Process segment | ~100k ($0.10) | ~32k ($0.03) | 68% |
| Submit performance | ~80k ($0.08) | ~25k ($0.025) | 69% |
| Grade performance | ~100k ($0.10) | ~48k ($0.05) | **52%** |
| Update leaderboard | ~80k ($0.08) | $0 (off-chain) | **100%** |
| Update student stats | ~60k ($0.06) | $0 (Grove) | **100%** |

**Total savings: 85-90%**

---

## Migration from V1

### Step 1: Deploy V2 contracts
```bash
bun hardhat run scripts/deploy-events.ts --network base-sepolia
```

### Step 2: Run both V1 and V2 in parallel
- Keep V1 contracts deployed
- Upload metadata to Grove + emit V2 events
- Verify data consistency

### Step 3: Update frontend
- Switch from V1 contract reads to Grove fetches
- Use The Graph for leaderboard queries

### Step 4: Deprecate V1
- Stop writing to V1 contracts
- Keep V1 deployed for historical data

### Migration Scripts
```typescript
// scripts/migrate-songs.ts
import { SongRegistryV1 } from '../v1-contracts';
import { SongEvents } from '../v2-contracts';

async function migrateSongs() {
  const totalSongs = await songRegistryV1.getTotalSongs();

  for (let i = 0; i < totalSongs; i++) {
    const geniusId = allSongIds[i];
    const song = await songRegistryV1.getSong(geniusId);

    // Convert to Grove metadata
    const metadata = {
      geniusId: song.geniusId,
      title: song.title,
      artist: song.artist,
      // ... rest of fields
    };

    // Upload to Grove
    const { uri } = await grove.uploadAsJson(metadata);

    // Emit event in V2 contract
    await songEvents.emitSongRegistered(
      song.geniusId,
      uri,
      song.geniusArtistId
    );

    console.log(`Migrated song ${geniusId}: ${uri}`);
  }
}
```

---

## FSRSTrackerV1 (Keep As-Is)

**NOT included in events/ folder** because it's already optimal:
- ✅ Ultra-compact storage (19 bytes/card)
- ✅ PKP-verified updates
- ✅ Events for indexing
- ✅ View functions for queries

**No changes needed.** Just keep using `FSRSTrackerV1` from V1 contracts.

---

## Anti-Cheat Summary

### What Prevents Spoofing?

1. **PerformanceGrader.gradePerformance()**
   - Only `trustedPKP` can call
   - Lit Action verifies video/audio
   - Multiple Lit nodes reach consensus
   - Events are immutable

2. **FSRSTrackerV1.updateCard()**
   - Only `trustedPKP` can call
   - Lit Action verifies audio transcription
   - Card states are on-chain (tamper-proof)

3. **Grove ACL**
   - Mutable metadata requires PKP signature
   - On-chain condition enforces access control
   - Lit Actions execute with consensus

### What Can Be Spoofed? (And How to Prevent)

| Risk | Mitigation |
|------|------------|
| Fake submission events | Anyone can submit, but only PKP can grade |
| Edited metadata in Grove | ACL restricts edits to PKP-signed requests |
| Fake leaderboard entries | The Graph only indexes PKP-signed grading events |
| Front-running scores | Lit Actions use nonces/timestamps |

---

## Questions?

- **Why no storage?** Grove is free and immutable. Events enable indexing.
- **Why keep FSRSTracker?** Already optimal - 19 bytes/card, PKP-verified.
- **Why PerformanceGrader has state?** Needs `trustedPKP` for authorization.
- **Can I skip AccountEvents?** Yes, it's optional. Lens accounts exist without it.

## Next Steps

1. ✅ Design Zod schemas (done)
2. ✅ Write minimal event contracts (done)
3. ⏳ Set up The Graph subgraph
4. ⏳ Implement unified account creation
5. ⏳ Write migration scripts
6. ⏳ Update frontend to use Grove
