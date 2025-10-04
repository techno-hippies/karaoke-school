# Karaoke School Contracts

Core smart contracts for the Karaoke School platform, deployed on Lens testnet (zkSync).

## Project Structure

```
root/
├── contracts/                         # Smart contracts
│   ├── SongCatalog/
│   │   ├── SongCatalogV1.sol
│   │   ├── script/
│   │   │   └── DeploySongCatalogV1.s.sol
│   │   └── test/
│   │       └── SongCatalogV1.t.sol
│   │
│   ├── StudyTracker/
│   │   ├── StudyTrackerV1.sol
│   │   ├── script/
│   │   │   └── DeployStudyTrackerV1.s.sol
│   │   └── test/
│   │       └── StudyTrackerV1.t.sol
│   │
│   ├── ArtistQuizTracker/
│   │   ├── ArtistQuizTrackerV1.sol
│   │   ├── ARCHITECTURE.md
│   │   ├── script/
│   │   │   └── DeployArtistQuizTrackerV1.s.sol
│   │   └── test/
│   │       └── ArtistQuizTrackerV1.t.sol
│   │
│   ├── TrendingTracker/
│   │   ├── TrendingTrackerV1.sol
│   │   ├── script/
│   │   │   └── DeployTrendingTrackerV1.s.sol
│   │   └── test/
│   │       └── TrendingTrackerV1.t.sol
│   │
│   ├── foundry.toml
│   └── README.md
│
└── shared/                            # Shared types (outside contracts)
    └── types/
        └── index.ts                   # TypeScript types for all contracts
```

## Architecture Overview

### Data Model Philosophy

**Hybrid ID Strategy:**
- **Primary ID**: Human-readable slug (e.g., `"heat-of-the-night-scarlett-x"`)
- **Optional Genius ID**: Links to Genius.com for metadata enrichment
- **Decoupled from Genius**: Primary operations don't depend on Genius API
- **Future-proof**: Can integrate other data sources without migration

### Contract Ecosystem

```
┌─────────────────────────────────────────────────────────┐
│              SongCatalogV1                              │
│  Native songs with audio + word-level timestamps        │
│  • Primary: human-readable ID (slug)                    │
│  • Optional: Genius ID + Artist ID for unification      │
│  • Grove URIs for all assets                            │
└─────────────────────────────────────────────────────────┘
                            │
                            ├── Powers ──────────────────┐
                            │                             │
                            ▼                             ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────┐
│   StudyTrackerV1                    │   │   ArtistQuizTrackerV1       │
│  SayItBack practice sessions        │   │  Daily fan challenges       │
│  • Encrypted FSRS data (Lit v8)     │   │  • Encrypted questions      │
│  • Public stats/streaks             │   │  • 8-second time limit      │
│  • Session history                  │   │  • Artist-specific streaks  │
│  • Timezone-aware (UTC)             │   │  • Top-10 leaderboards      │
└─────────────────────────────────────┘   └─────────────────────────────┘
                            │
                            ├── Aggregates ──────────────┐
                            │                             │
                            ▼                             ▼
                ┌───────────────────────┐   ┌─────────────────────────────┐
                │ TrendingTrackerV1     │   │   (Future: MegapotLottery)  │
                │  Time-windowed trends │   │  Chainlink VRF distribution │
                │  • Hourly/Daily/Weekly│   │  • Leader-based tickets     │
                │  • Weighted scoring   │   └─────────────────────────────┘
                │  • PKP aggregation    │
                └───────────────────────┘
```

## Contracts

### 1. SongCatalogV1

**Purpose**: Registry for native karaoke songs with full audio and word-level timestamps

**Key Features**:
- Primary ID: Human-readable slug (permanent, immutable)
- Optional Genius ID: For artist/song unification across platforms
- Full song assets (audio, metadata, covers) stored on Grove
- Segment/clip references for practice units
- Multilingual support (comma-separated language codes)
- Soft delete with enable/disable toggle

**Integration**:
```solidity
// Add song to catalog
songCatalog.addSong(
    "heat-of-the-night-scarlett-x",  // id
    12345,                            // geniusId (0 if none)
    "Heat of the Night",              // title
    "Scarlett X",                     // artist
    194,                              // duration
    "lens://4f91cab...",              // audioUri
    "lens://7a3bc9d...",              // metadataUri
    "lens://2e5f8c3...",              // coverUri
    "lens://9d8e7f6...",              // thumbnailUri
    "",                               // musicVideoUri (optional)
    "verse-1,chorus-1,verse-2",       // segmentIds
    "en,cn,vi"                        // languages
);
```

### 2. StudyTrackerV1

**Purpose**: Track study sessions, streaks, and encrypted FSRS spaced-repetition data

**Key Features**:
- Study session recording
- Streak tracking (UTC-based, consecutive days)
- Encrypted FSRS state (Lit Protocol v8)
- Public stats for achievements
- Session history (last 100)

**Integration**:
```solidity
// Record session (via PKP)
studyTracker.recordStudySession(
    userAddress,                        // user
    0,                                  // ContentSource.Native
    "heat-of-the-night-scarlett-x",    // contentId
    5,                                  // itemsReviewed
    92                                  // averageScore
);

// Store encrypted FSRS
studyTracker.storeEncryptedFSRS(
    userAddress,                        // user
    0,                                  // ContentSource.Native
    "verse-1",                          // contentId
    "encrypted_ciphertext_here...",     // ciphertext
    "0xdataToEncryptHash..."            // hash
);

// Query stats
StudyStats memory stats = studyTracker.getUserStats(userAddress);
// stats.currentStreak, stats.totalSessions, etc.
```

### 3. ArtistQuizTrackerV1

**Purpose**: Daily artist quiz challenges - prove you're a superfan

**Key Features**:
- Encrypted questions stored on-chain (Lit Protocol)
- 8-second time limit (prevents AI cheating)
- 1 quiz per day per artist (creates daily engagement)
- Sequential unlock (must complete Q1 before Q2)
- Study gating (must complete SayItBack first)
- Artist-specific streaks and leaderboards

**Integration**:
```solidity
// Add encrypted questions (via PKP)
quizTracker.addQuestions(
    artistHash,                         // keccak256("genius-artist-{id}")
    ["ciphertext1", "ciphertext2"],     // Encrypted questions
    ["hash1", "hash2"],                 // Verification hashes
    [referentHash1, referentHash2]      // Source tracking
);

// Record quiz completion (via PKP after validation)
quizTracker.recordQuizCompletion(
    artistHash,                         // Artist identifier
    userAddress,                        // User
    0,                                  // Question index
    true,                               // Correct answer
    submittedAt,                        // Timestamp
    questionShownAt                     // Time validation
);

// Query progress
ArtistProgress memory progress = quizTracker.getUserProgress(artistHash, userAddress);
// progress.currentStreak, progress.questionsCorrect, etc.

// Get leaderboard
LeaderboardEntry[10] memory leaders = quizTracker.getLeaderboard(artistHash);
```

**See**: `ArtistQuizTracker/ARCHITECTURE.md` for complete system design

### 4. TrendingTrackerV1

**Purpose**: Time-windowed trending songs based on user interactions

**Key Features**:
- Time windows: Hourly, Daily, Weekly
- Event types: clicks, plays, completions
- Weighted scoring: completion (60%) > play (30%) > click (10%)
- PKP batch aggregation

**Integration**:
```solidity
// Update trending (via PKP batch)
trendingTracker.updateTrendingBatch(
    1,                                  // TimeWindow.Daily
    [0, 0, 1],                          // sources (Native, Native, Genius)
    ["song-1", "song-2", "123456"],     // songIds
    [10, 5, 3],                         // clicks
    [50, 30, 20],                       // plays
    [25, 15, 10]                        // completions
);

// Query trending
TrendingSong[] memory trending = trendingTracker.getTrendingSongs(
    1,   // TimeWindow.Daily
    10   // top 10
);
```

## Data Model Alignment

### Shared Types

All contracts use consistent data structures (see `../shared/types/index.ts`):

```typescript
// ContentSource enum (matches all contracts)
export const ContentSource = {
  Native: 0,    // SongCatalogV1
  Genius: 1,    // Genius API
} as const;

// Content hash function (matches contract keccak256)
export function getContentHash(source: ContentSource, id: string): string {
  return keccak256(encodePacked(['uint8', 'string'], [source, id]));
}
```

## Development

### Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies (if any)
forge install

# Build contracts
forge build
```

### Testing

```bash
# Run all tests
forge test

# Run specific contract tests
forge test --match-contract SongCatalogV1Test

# Run with verbosity
forge test -vvv

# Generate coverage
forge coverage
```

### Deployment

#### Set Environment Variables

```bash
export PRIVATE_KEY=0x...
export PKP_ADDRESS=0x254AA0096C9287a03eE62b97AA5643A2b8003657
```

#### Deploy Contracts Individually

Deploy contracts in this order (some have dependencies):

```bash
# 1. SongCatalogV1 (no dependencies)
FOUNDRY_PROFILE=zksync forge script SongCatalog/script/DeploySongCatalogV1.s.sol:DeploySongCatalogV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync

# 2. KaraokeScoreboardV1 (requires PKP_ADDRESS)
FOUNDRY_PROFILE=zksync forge script KaraokeScoreboard/script/DeployKaraokeScoreboardV1.s.sol:DeployKaraokeScoreboardV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync

# 3. StudyTrackerV1 (requires PKP_ADDRESS)
FOUNDRY_PROFILE=zksync forge script StudyTracker/script/DeployStudyTrackerV1.s.sol:DeployStudyTrackerV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync

# 4. TrendingTrackerV1 (requires PKP_ADDRESS)
FOUNDRY_PROFILE=zksync forge script TrendingTracker/script/DeployTrendingTrackerV1.s.sol:DeployTrendingTrackerV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync
```

> **Note**: Contracts are independent and can be deployed in any order. The numbering above is just a suggested sequence.

## Security

### Trusted Roles

- **Owner**: Can update config, pause contracts, transfer ownership
- **Trusted PKP**: Can submit scores, sessions, trending data
  - Prevents cheating (users can't self-report scores)
  - Lit Protocol v8 PKP address: `0x254AA0096C9287a03eE62b97AA5643A2b8003657`
  - Immutable Lit Actions (IPFS CID)

### Access Control

```solidity
modifier onlyOwner()           // Admin functions
modifier onlyTrustedScorer()   // Score submission (KaraokeScoreboard)
modifier onlyTrustedTracker()  // Session/trending updates
modifier whenNotPaused()       // Emergency stop
```

## Versioning Strategy

Each contract follows semantic versioning:

- **V1**: Initial version
- **V2**: Breaking changes or major features
- **V3+**: Future iterations

Old versions remain deployed for backwards compatibility. Frontend should query the latest version.

**Upgrade Path**:
1. Deploy new version (e.g., SongCatalogV2)
2. Migrate data if needed (owner scripts)
3. Update frontend to use new address
4. Keep V1 deployed (read-only) for historical data

## Deployment Addresses

### Lens Testnet (zkSync)

- `SongCatalogV1`: `0x...` (TBD)
- `KaraokeScoreboardV1`: `0x...` (TBD)
- `StudyTrackerV1`: `0x...` (TBD)
- `TrendingTrackerV1`: `0x...` (TBD)

### PKP Address

- Trusted PKP: `0x254AA0096C9287a03eE62b97AA5643A2b8003657`

## Future Enhancements

### V2 Contracts

- **SongCatalogV2**: On-chain segment metadata, enhanced search
- **KaraokeScoreboardV2**: Unlimited leaderboards via events + TheGraph
- **StudyTrackerV2**: Advanced FSRS algorithms, challenge modes
- **TrendingTrackerV2**: Genre-based trending, personalized feeds

### New Contracts

- **MegapotLottery**: Chainlink VRF-based lottery for leaders
- **AchievementTracker**: On-chain badges and milestones
- **SocialGraph**: Following, challenges, competitions

## License

MIT
