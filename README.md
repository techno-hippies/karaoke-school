# Karaoke School - Core Architecture

Unified codebase for Karaoke School's core infrastructure: contracts, song preparation, Lit Actions, and frontend app.

## Project Structure

```
root/
├── contracts/          # Smart contracts (Solidity)
│   ├── SongCatalog/        # Each contract in its own versioned folder
│   ├── StudyTracker/       # with script/ and test/ subdirectories
│   ├── ArtistQuizTracker/
│   └── TrendingTracker/
├── shared/             # Shared types & utilities
│   └── types/          # TypeScript types for all components
├── song-uploader/      # CLI for preparing native songs
├── lit-actions/        # Lit Protocol PKP actions (TBD)
├── app/                # Frontend application (TBD)
└── README.md           # This file
```

## Architecture Overview

### Data Model Philosophy

**Hybrid ID Strategy**:
- **Primary ID**: Human-readable slug (e.g., `"heat-of-the-night-scarlett-x"`)
- **Optional Genius ID**: Links to Genius.com for cross-platform unification
- **Benefit**: Decoupled from external APIs, future-proof, extensible

**ContentSource Abstraction**:
```typescript
enum ContentSource {
  Native = 0,   // Songs from SongCatalog (audio + word-level timestamps)
  Genius = 1,   // Songs from Genius.com API (lyrics only, no audio)
}
```

All contracts use this enum for consistent multi-source support.

### Contract Ecosystem

```
                    ┌─────────────────┐
                    │   SongCatalog   │
                    │  Native songs   │
                    │  + Artist IDs   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │StudyTracker │  │ ArtistQuiz   │  │   Trending   │
    │  + FSRS     │  │ Challenges   │  │  Aggregator  │
    └─────────────┘  └──────────────┘  └──────────────┘
```

**Key Contracts**:

1. **SongCatalog** (`contracts/SongCatalog/SongCatalogV1.sol`)
   - Registry for native karaoke songs
   - Grove storage (Lens decentralized storage)
   - Optional Genius ID + Artist ID for unification

2. **StudyTracker** (`contracts/StudyTracker/StudyTrackerV1.sol`)
   - Study sessions & streaks (UTC-based)
   - Encrypted FSRS data (Lit Protocol v8)
   - Public stats for achievements

3. **ArtistQuizTracker** (`contracts/ArtistQuizTracker/ArtistQuizTrackerV1.sol`)
   - Daily artist quiz challenges
   - 8-second time limit (prevents AI cheating)
   - Artist-specific streaks & leaderboards
   - Encrypted questions on-chain

4. **TrendingTracker** (`contracts/TrendingTracker/TrendingTrackerV1.sol`)
   - Time-windowed trending (hourly/daily/weekly)
   - Weighted scoring (completion > play > click)
   - PKP batch aggregation

See [`contracts/README.md`](./contracts/README.md) for detailed contract documentation.

## Data Flow

### 1. Song Preparation & Upload

```
Local songs → ElevenLabs API → Word timestamps → Grove storage → SongCatalog
```

**Tool**: [`song-uploader/`](./song-uploader/)

- Processes songs with ElevenLabs for word-level timestamps
- Uploads to Grove (immutable Lens storage)
- Registers in SongCatalog with optional Genius ID
- See [`song-uploader/README.md`](./song-uploader/README.md)

### 2. Exercise Completion & Scoring

```
User exercise → Lit Action scores → PKP signs → StudyTracker
```

**Lit Action**: `lit-actions/karaoke-scorer.js` (TBD)

- Grades user performance (STT + phonetic matching)
- Updates TS-FSRS algorithm
- Encrypts FSRS data → StudyTracker
- Records session → StudyTracker

### 3. Trending Aggregation

```
Frontend events → Queue → Lit Action aggregates → PKP batch → TrendingTracker
```

**Lit Action**: `lit-actions/trending-aggregator.js` (TBD)

- Collects clicks, plays, completions
- Aggregates by song (5-10 min windows)
- Batch writes to contract (gas efficient)

## Shared Types

All components use consistent TypeScript types from `shared/types/index.ts`:

```typescript
import { ContentSource, CatalogSong, StudyStats } from './shared/types';

// Query native song
const song: CatalogSong = await songCatalog.getSong("heat-of-the-night");

// Check if linked to Genius
if (song.geniusId > 0) {
  console.log(`Linked to Genius song ${song.geniusId}`);
}

// Get user streak
const stats: StudyStats = await studyTracker.getUserStats(userAddress);
console.log(`Streak: ${stats.currentStreak} days`);
```

## Development Workflow

### 1. Setup Contracts

```bash
cd contracts
forge install
forge build

# Deploy each contract to Lens testnet (see contracts/README.md for details)
export PRIVATE_KEY=0x...
export PKP_ADDRESS=0x254AA0096C9287a03eE62b97AA5643A2b8003657

# Example: Deploy SongCatalogV1
FOUNDRY_PROFILE=zksync forge script SongCatalog/script/DeploySongCatalogV1.s.sol:DeploySongCatalogV1 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync
```

### 2. Prepare Songs

```bash
cd song-uploader
bun install
cp .env.example .env

# Edit .env with deployed SongCatalog address
# Add songs to ./songs/ directory

# Process and upload
bun run process
```

### 3. Deploy Lit Actions (TBD)

```bash
cd lit-actions
# Upload to IPFS
# Register PKP permissions
```

### 4. Run Frontend (TBD)

```bash
cd app
npm install
npm run dev
```

## Key Features

### Native + Genius Unification

Songs can have both:
- **Native implementation**: Full audio + word-level timestamps from SongCatalog
- **Genius reference**: Same song on Genius.com for metadata/referents

**Example**:
```solidity
// SongCatalog
{
  id: "heat-of-the-night-scarlett-x",  // Primary (native)
  geniusId: 12345,                      // Links to Genius
  audioUri: "lens://...",
  // ...
}

// Users can practice:
// 1. Native mode: Full audio with word-level karaoke (ContentSource.Native)
// 2. Genius mode: Genius referents as exercises (ContentSource.Genius)

// Unified leaderboard:
// - Artist "Scarlett X" aggregates scores from both sources
// - Uses geniusId for artist matching
```

### Encrypted FSRS with Lit Protocol v8

Study progress encrypted on-chain:

```javascript
// In Lit Action
const fsrsData = {
  difficulty: 5.2,
  stability: 12.5,
  retrievability: 0.89,
  interval: 7,  // days
  lastReview: new Date(),
};

// Encrypt with Lit
const encrypted = await Lit.Actions.encrypt({
  accessControlConditions: [{ /* only user can decrypt */ }],
  to_encrypt: JSON.stringify(fsrsData),
});

// Store on-chain
await studyTracker.storeEncryptedFSRS(
  user,
  ContentSource.Native,
  songId,
  encrypted.ciphertext,
  encrypted.dataToEncryptHash
);

// Client decrypts for scheduling
const decrypted = await litClient.decrypt(encrypted);
const nextReview = calculateNextReview(decrypted);
```

### Multi-Source Scoring

Same leaderboard logic for Native and Genius:

```typescript
// Native song segment
await scoreboard.updateScore(
  ContentSource.Native,
  "heat-of-the-night-scarlett-x",  // trackId
  "verse-1",                         // segmentId
  userAddress,
  95                                 // score
);

// Genius referent (same scoring logic)
await scoreboard.updateScore(
  ContentSource.Genius,
  "123456",      // Genius song ID
  "referent-789", // Genius referent ID
  userAddress,
  88
);
```

## Integration Points

### Frontend → Contracts

```typescript
// 1. Load native songs
const songs = await songCatalog.getEnabledSongs();

// 2. Check leaderboard
const leaders = await scoreboard.getTopTrackScorers(
  ContentSource.Native,
  "heat-of-the-night-scarlett-x"
);

// 3. Get user stats
const stats = await studyTracker.getUserStats(userAddress);

// 4. Get trending
const trending = await trendingTracker.getTrendingSongs(
  TimeWindow.Daily,
  10  // top 10
);
```

### Lit Actions → Contracts

```javascript
// Karaoke Scorer
const score = gradePerformance(userAudio, lyrics);

// Sign transaction
const sig = await Lit.Actions.signAndCombineEcdsa({
  toSign: txHash,
  publicKey: pkpPublicKey,
  sigName: "scoreSubmission",
});

// Submit via PKP
await scoreboard.updateScore(source, trackId, segmentId, user, score);
await studyTracker.recordStudySession(user, source, trackId, itemCount, avgScore);
```

### Song Uploader → SongCatalog

```typescript
// Upload to Grove
const { audioUri, metadataUri, coverUri, thumbnailUri } = await uploadToGrove(song);

// Register in catalog
await songCatalog.addSong(
  song.id,
  song.geniusId || 0,  // 0 if no Genius link
  song.title,
  song.artist,
  song.duration,
  audioUri,
  metadataUri,
  coverUri,
  thumbnailUri,
  song.musicVideoUri || "",
  song.segmentIds.join(","),
  song.languages.join(",")
);
```

## Environment Setup

### Contracts

```bash
# contracts/.env
PRIVATE_KEY=0x...
PKP_ADDRESS=0x254AA0096C9287a03eE62b97AA5643A2b8003657
```

### Song Uploader

```bash
# song-uploader/.env
PRIVATE_KEY=0x...
ELEVENLABS_API_KEY=...
SONG_CATALOG_ADDRESS=0x...  # After deployment
```

### Lit Actions

```bash
# lit-actions/.env
PINATA_JWT=...  # For IPFS upload
PKP_PRIVATE_KEY=...  # For signing (encrypted via dotenvx)
```

## Next Steps

1. **Contracts** ✅
   - [x] SongCatalog with optional Genius ID + Artist ID
   - [x] StudyTracker with encrypted FSRS
   - [x] ArtistQuizTracker with daily challenges
   - [x] TrendingTracker with time windows

2. **Song Uploader** ✅
   - [x] Aligned with SongCatalog data model
   - [x] Genius ID support in metadata.json
   - [x] Grove upload integration

3. **Lit Actions** (TODO)
   - [ ] Karaoke scorer with FSRS encryption
   - [ ] Trending aggregator with batch writes
   - [ ] Permission management scripts

4. **Frontend App** (TODO)
   - [ ] Contract integration with unified types
   - [ ] Multi-source song display
   - [ ] FSRS decryption for scheduling
   - [ ] Trending UI

## Deployment Addresses

### Lens Testnet (zkSync)

- SongCatalog: `0x...` (TBD)
- StudyTracker: `0x...` (TBD)
- ArtistQuizTracker: `0x...` (TBD)
- TrendingTracker: `0x...` (TBD)

### PKP

- Trusted PKP: `0x254AA0096C9287a03eE62b97AA5643A2b8003657`

## Testing

```bash
# Contracts
cd contracts
forge test

# Song uploader (integration test)
cd song-uploader
bun run process --test-mode

# Lit Actions
cd lit-actions
bun test

# Frontend
cd app
npm test
```

## Contributing

Each subdirectory has its own detailed README:

- [`contracts/README.md`](./contracts/README.md) - Smart contract architecture
- [`song-uploader/README.md`](./song-uploader/README.md) - Song preparation workflow
- `lit-actions/README.md` (TBD) - Lit Protocol integration
- `app/README.md` (TBD) - Frontend development

## License

MIT
