# Grove Metadata Schemas

Zod schemas for Grove-stored metadata. **Replaces most V1 contracts** with off-chain storage + minimal on-chain events.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    BEFORE (V1 Contracts)                 │
├─────────────────────────────────────────────────────────┤
│  • ArtistRegistryV1 (artist hierarchy)                  │
│  • SongRegistryV1 (full structs on-chain)               │
│  • SegmentRegistryV1 (audio assets in mappings)         │
│  • PerformanceRegistryV1 (storage + grading)            │
│  • LeaderboardV1 (on-chain sorting)                     │
│  • StudentProfileV2 (stats arrays)                      │
│                                                          │
│  ❌ Gas: ~$0.20 per song registration                   │
│  ❌ Hierarchy: /a/artists vs /u/users                   │
│  ❌ Scalability: Unbounded arrays                       │
└─────────────────────────────────────────────────────────┘

                           ▼

┌─────────────────────────────────────────────────────────┐
│                    AFTER (Grove + Events)                │
├─────────────────────────────────────────────────────────┤
│  • account.ts (unified Lens accounts in Grove)          │
│  • song.ts (immutable Grove JSON)                       │
│  • segment.ts (immutable Grove JSON)                    │
│  • performance.ts (Grove + PKP-signed events)           │
│  • leaderboard.ts (The Graph indexing)                  │
│  • FSRSTrackerV1 (KEEP - already optimal)               │
│                                                          │
│  ✅ Gas: ~$0.03 per song (events only)                  │
│  ✅ Unified: /@username for everyone                    │
│  ✅ Scalability: Free Grove storage                     │
└─────────────────────────────────────────────────────────┘
```

## Schema Files

### 1. `account.ts`
**Replaces:** `ArtistRegistryV1` + `StudentProfileV2`

Unified account metadata for everyone (artists + users).

```typescript
import { AccountMetadataSchema, createInitialAccountMetadata } from './grove/account';

// Create account metadata
const metadata = createInitialAccountMetadata({
  username: 'taylorswift',
  lensAccountAddress: '0x...',
  pkpAddress: '0x...',
  geniusArtistId: 498, // Optional: only if also a Genius artist
  displayName: 'Taylor Swift',
});

// Upload to Grove as Lens Account metadata
const { uri } = await grove.uploadAsJson(metadata);
```

**Key features:**
- No artist/user hierarchy
- Optional `geniusArtistId` field
- Stats replace `StudentProfileV2`
- Achievements array
- Verification badges

### 2. `song.ts`
**Replaces:** `SongRegistryV1`

Song metadata with MLC licensing and lyrics.

```typescript
import { createSongMetadata, addMLCData } from './grove/song';

// Create song metadata
let song = createSongMetadata({
  geniusId: 10047250,
  title: 'TEXAS HOLD \'EM',
  artist: 'Beyoncé',
  duration: 233,
  coverUri: 'https://...',
  registeredBy: '0x...',
  geniusArtistId: 498, // Just a reference, no validation
});

// Add MLC licensing
song = addMLCData(song, {
  isrc: 'USSM12301234',
  publishers: [{ name: 'Sony/ATV', share: 50 }],
  writers: ['Taylor Swift', 'Aaron Dessner'],
});

// Upload to Grove (immutable)
const { uri } = await grove.uploadAsJson(song);
```

**Key features:**
- No `artistExists()` check
- MLC data inline
- Synced lyrics support
- Segments array

### 3. `segment.ts`
**Replaces:** `SegmentRegistryV1`

Segment metadata with audio assets.

```typescript
import { createSegmentMetadata, markProcessed } from './grove/segment';

// Create segment (before processing)
let segment = createSegmentMetadata({
  segmentHash: 'abc123',
  geniusId: 10047250,
  tiktokSegmentId: '7334542274145454891',
  timeRange: { startTime: 0, endTime: 60, duration: 60 },
  registeredBy: '0x...',
});

// After processing (Demucs + fal.ai + ElevenLabs)
segment = markProcessed(segment, {
  instrumentalUri: 'lens://...',
  alignmentUri: 'lens://...',
}, {
  demucs: true,
  falEnhancement: true,
  alignment: true,
});

// Upload to Grove (immutable)
const { uri } = await grove.uploadAsJson(segment);
```

**Key features:**
- Time range validation
- Processing status tracking
- Audio assets (vocals optional, instrumental required)
- Ready-for-karaoke helpers

### 4. `performance.ts`
**Replaces:** `PerformanceRegistryV1`

Performance metadata with AI grading.

```typescript
import { createPerformanceMetadata, addGrading } from './grove/performance';

// Create performance (user submission)
let perf = createPerformanceMetadata({
  performanceId: 12345,
  segmentHash: 'abc123',
  performer: '0x...',
  videoUri: 'lens://...',
});

// Upload to Grove
const { uri } = await grove.uploadAsJson(perf);

// Later: Add grading (via Lit Action + PKP)
perf = addGrading(perf, {
  score: 8525, // basis points (85.25%)
  gradedBy: '0xPKP...',
  gradedAt: new Date().toISOString(),
});

// Update in Grove + emit event for leaderboard
await grove.updateJson(uri, perf);
await performanceGrader.gradePerformance(12345, 'abc123', '0x...', 8525, uri);
```

**Key features:**
- Grading breakdown (pronunciation, timing, pitch)
- PKP-signed grading for anti-cheat
- Leaderboard entry conversion

### 5. `leaderboard.ts`
**Replaces:** `LeaderboardV1`

Off-chain leaderboard entries (indexed via The Graph).

```typescript
import { LeaderboardType, createLeaderboardEntry } from './grove/leaderboard';

// The Graph indexes PerformanceGraded events
// Queries return sorted leaderboard entries

const topPerformers = await graphClient.query({
  query: gql`
    query SegmentLeaderboard($segmentHash: String!) {
      performances(
        where: { segmentHash: $segmentHash, graded: true }
        orderBy: score
        orderDirection: desc
        first: 100
      ) {
        performer
        score
        performanceUri
      }
    }
  `,
  variables: { segmentHash: 'abc123' },
});
```

**Key features:**
- No on-chain storage
- The Graph handles sorting
- Multiple leaderboard types (song, segment, artist, global)
- Real-time updates from events

## Validation

All schemas include validation helpers:

```typescript
import { validateAccountMetadata, validateSongMetadata } from './grove';

try {
  const account = validateAccountMetadata(jsonData);
  const song = validateSongMetadata(jsonData);
} catch (error) {
  console.error('Invalid metadata:', error);
}
```

## Migration from V1 Contracts

See migration scripts (TBD):
- `scripts/migrate-artists-to-accounts.ts`
- `scripts/migrate-songs-to-grove.ts`
- `scripts/migrate-segments-to-grove.ts`

## Gas Comparison

| Operation | V1 (On-Chain) | V2 (Grove + Events) | Savings |
|-----------|---------------|---------------------|---------|
| Register artist | ~150k gas (~$0.15) | $0 (Lens account) | 100% |
| Register song | ~200k gas (~$0.20) | ~30k gas (~$0.03) | 85% |
| Register segment | ~180k gas (~$0.18) | ~30k gas (~$0.03) | 83% |
| Grade performance | ~100k gas (~$0.10) | ~50k gas (~$0.05) | 50% |
| Update leaderboard | ~80k gas (~$0.08) | $0 (off-chain) | 100% |
| Update student stats | ~60k gas (~$0.06) | $0 (Grove) | 100% |

**Total savings: ~85-90%**

## Anti-Cheat Guarantees

### FSRS (Keep contract)
- `FSRSTrackerV1.updateCard()` via PKP-signed transaction
- Lit Action verifies audio transcription
- Consensus across Lit nodes

### Leaderboards (Off-chain)
- `PerformanceGrader.gradePerformance()` emits PKP-signed event
- The Graph indexes immutable events
- No way to spoof scores

### Metadata (Grove ACL)
- Mutable metadata requires PKP signature
- ACL enforces on-chain conditions
- Lit Actions execute with consensus

## Next Steps

1. ✅ Design Zod schemas
2. ⏳ Write minimal event contracts
3. ⏳ Implement account creation flow
4. ⏳ Set up The Graph subgraph
5. ⏳ Write migration scripts
6. ⏳ Update frontend to use Grove

## Questions?

See:
- `v2-contracts/src/events/` - Minimal contracts (TBD)
- `modules/accounts/` - Unified account creation (TBD)
- `ANALYSIS-AUTH-ARCHITECTURE.md` - Full refactor plan
