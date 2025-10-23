# V2 Contracts Architecture

## Overview

Clean-slate contract architecture for TikTok-based karaoke learning platform. All contracts follow best practices with proper separation of concerns, clear data models, and efficient gas usage.

## Data Model Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARTIST                                   │
│  - PKP Address                                                   │
│  - Lens Account                                                  │
│  - Genius Artist ID                                              │
│  - Path: /a/:lenshandle                                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ has many
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SONG                                    │
│  - Genius Song ID                                                │
│  - Spotify ID, TikTok Music ID                                   │
│  - Title, Artist, Duration                                       │
│  - Cover Art, Metadata URI                                       │
│  - Path: /s/:songId                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ has many
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SEGMENT                                   │
│  - ~30 second TikTok portion                                     │
│  - Start/End times in song                                       │
│  - Vocals URI (encrypted original)                               │
│  - Instrumental URI (audio2audio derivative)                     │
│  - Alignment URI (forced alignment JSON)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TikTok Videos (reference metadata only, not on-chain)    │  │
│  │ - Often shorter clips of the full segment               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ has many
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE                                  │
│  - User's karaoke recording of full segment                      │
│  - Video URI, Audio URI                                          │
│  - Score (0-10000 basis points)                                  │
│  - Graded by Lit Action                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Key Distinction

**Segment vs TikTok Video vs Performance:**

| Type | Description | Duration | Stored On-Chain |
|------|-------------|----------|-----------------|
| **Segment** | Canonical audio portion users practice | ~30s (full) | ✅ Yes (metadata + assets) |
| **TikTok Video** | Reference to TikTok posts | Variable (often shorter) | ❌ No (metadata only in Grove) |
| **Performance** | User's karaoke recording | ~30s (full segment) | ✅ Yes (video URI + score) |

## Contract Architecture

### Core Contracts

#### 1. ArtistRegistryV1
**Purpose:** Map Genius Artist IDs to PKP addresses and Lens profiles

**Storage:**
- Artist metadata (minimal on-chain)
- PKP → Genius ID mapping
- Lens Handle → Genius ID mapping

**Key Functions:**
- `registerArtist()` - Create artist (PKP, Lens, Genius mapping)
- `getArtist()` - Query artist by Genius ID
- `getLensHandle()` - Get Lens handle for artist

**Access Control:**
- Owner can update artists
- Authorized addresses can register artists (master-pipeline PKP)

---

#### 2. SongRegistryV1
**Purpose:** Store songs with artist linkage

**Storage:**
- Song metadata (title, artist, IDs, URIs)
- Artist → Songs index
- All songs array (for recent songs query)

**Key Functions:**
- `registerSong()` - Add song linked to artist
- `getSong()` - Query song by Genius ID
- `getSongsByArtist()` - Get all songs for an artist
- `getRecentSongs()` - Get recently added songs

**Dependencies:**
- Requires ArtistRegistry address (validates artist exists)

**Access Control:**
- Owner can toggle songs (enable/disable)
- Authorized addresses can register songs (master-pipeline PKP)

---

#### 3. SegmentRegistryV1
**Purpose:** Store ~30s song segments with audio assets

**Storage:**
- Segment metadata (times, URIs)
- Song → Segments index
- Hash-based identification: `keccak256(geniusId, tiktokSegmentId)`

**Key Functions:**
- `registerSegment()` - Create segment (Phase 1: metadata only)
- `processSegment()` - Add audio assets (Phase 2: after audio processing)
- `getSegment()` - Query segment by hash
- `getSegmentsBySong()` - Get all segments for a song

**Two-Phase Registration:**
1. **Register:** Create metadata record (start/end times, cover)
2. **Process:** Add audio assets after pipeline completes
   - Vocals URI (encrypted original)
   - Instrumental URI (audio2audio derivative)
   - Alignment URI (forced alignment JSON)

**Dependencies:**
- Requires SongRegistry address (validates song exists)

**Access Control:**
- Authorized addresses can register/process segments (master-pipeline PKP)

---

#### 4. PerformanceRegistryV1
**Purpose:** Store user karaoke performances with grading

**Storage:**
- Performance records (video URI, score, student)
- Student → Performances index
- Segment → Performances index

**Key Functions:**
- `submitPerformance()` - User submits karaoke recording
- `gradePerformance()` - Lit Action grades performance (adds score)
- `getPerformance()` - Query performance by ID
- `getTopPerformancesBySegment()` - Leaderboard query

**Two-Phase Workflow:**
1. **Submit:** User uploads video, creates record
2. **Grade:** Lit Action scores performance (basis points: 0-10000)

**Dependencies:**
- Requires SegmentRegistry address (validates segment exists)

**Access Control:**
- Anyone can submit performances
- Only authorized addresses (Lit Actions) can grade

---

### Student Contracts

#### 5. StudentProfileV1
**Purpose:** User profiles with stats and achievements

**Storage:**
- Student stats (total performances, average score, streaks)
- Achievement records
- Lens handle linkage

**Key Functions:**
- `registerStudent()` - Create student profile
- `updateStats()` - Update after each performance
- `updateStreak()` - Update daily streak
- `unlockAchievement()` - Award achievement
- `getStats()` - Query student stats
- `getAchievements()` - Get all achievements

**Stats Tracked:**
- Total performances, graded performances
- Average score, best score
- Total study time
- Current streak, longest streak

**Access Control:**
- Anyone can register students (auto-register on first performance)
- Authorized addresses can update stats (PerformanceRegistry, Lit Actions)

---

### Leaderboard Contracts

#### 6. LeaderboardV1
**Purpose:** Unified leaderboard for songs, segments, and artists

**Storage:**
- Leader entries (student, best score, total attempts)
- Top N arrays (sorted by score, max 100 per leaderboard)

**Leaderboard Types:**
- `SONG` - Best overall for a song (across all segments)
- `SEGMENT` - Best for a specific segment
- `ARTIST` - Best across all songs by an artist

**Key Functions:**
- `updateScore()` - Update student's score on a leaderboard
- `getTopStudents()` - Query top N performers
- `getStudentRank()` - Get student's rank and entry
- `getStudentEntry()` - Get student's leaderboard entry

**Optimization:**
- Top N stored in sorted arrays (insertion sort on update)
- Fast reads for common queries
- Composite key: `hash(leaderboardType, identifier)`

**Access Control:**
- Only authorized addresses can update scores (PerformanceRegistry, Lit Actions)

---

## Data Flow

### Artist Setup (One-time per artist)

```
1. PKP-to-Lens Pipeline
   ├─ Mint PKP
   ├─ Create Lens account
   ├─ Create Lens username
   └─ Register in ArtistRegistryV1
       └─ registerArtist(geniusArtistId, pkpAddress, lensHandle, lensAccountAddress)
```

### Song Ingestion (Per TikTok song page)

```
1. Crawl TikTok
   └─ Download TikTok segment (~30s clip)

2. Audio Matching (DTW + STT)
   └─ Output: crop_instructions.json (start/end times)

3. Audio Processing
   ├─ Crop original song (ffmpeg)
   ├─ Run Demucs (separate vocals/instrumental)
   ├─ Run Audio2Audio on instrumental (create derivative)
   └─ Upload to Grove (vocals, instrumental, alignment)

4. On-Chain Registration
   ├─ SongRegistryV1.registerSong(...)
   ├─ SegmentRegistryV1.registerSegment(...) [Phase 1]
   └─ SegmentRegistryV1.processSegment(...) [Phase 2]
```

### User Performance Flow

```
1. User submits karaoke recording
   └─ PerformanceRegistryV1.submitPerformance(segmentHash, student, videoUri, audioUri)

2. Lit Action grades performance
   ├─ Download video from Grove
   ├─ Analyze pronunciation, timing, pitch
   ├─ Calculate score (0-10000 basis points)
   └─ Call PerformanceRegistryV1.gradePerformance(performanceId, score, gradeUri)

3. Update student stats
   ├─ StudentProfileV1.updateStats(student, score, studyTime, true)
   └─ StudentProfileV1.updateStreak(student)

4. Update leaderboards
   ├─ LeaderboardV1.updateScore(SEGMENT, segmentHash, student, score)
   ├─ LeaderboardV1.updateScore(SONG, songId, student, score)
   └─ LeaderboardV1.updateScore(ARTIST, artistId, student, score)

5. Check achievements
   └─ StudentProfileV1.unlockAchievement(...) [if conditions met]
```

## Gas Optimization

### Write Operations (Estimated)

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Register Artist | ~150k | Includes mappings |
| Register Song | ~200k | Includes array push |
| Register Segment | ~180k | Phase 1 only |
| Process Segment | ~120k | Phase 2 (add URIs) |
| Submit Performance | ~150k | Includes indexes |
| Grade Performance | ~80k | Update score |
| Update Leaderboard | ~100k | Insertion sort |
| Update Stats | ~60k | Student profile |

### Read Operations (Optimized)

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Get Artist | ~2k | Single mapping read |
| Get Song | ~2k | Single mapping read |
| Get Segment | ~3k | Includes hash calc |
| Get Performance | ~2k | Single mapping read |
| Get Top Students | ~5k per entry | Array iteration |
| Get Student Stats | ~3k | Struct read |

## Security Considerations

### Access Control
- **Owner:** Can update contracts, toggle songs, transfer ownership
- **Authorized:** Can register/update records (typically master-pipeline PKP)
- **Public:** Can submit performances, register students

### Data Integrity
- Genius IDs validated against registries
- Reverse lookups prevent duplicates
- Two-phase segment processing (metadata → assets)
- Scores stored in basis points (0-10000) for precision

### Upgradeability
- No upgradeability (immutable contracts)
- Versioning via contract names (V1, V2, etc.)
- New versions deployed alongside old versions
- Frontend/pipeline updates to use new contracts

## Integration Points

### With Master Pipeline
- Pipeline calls contract functions via PKP
- PKP authorized in all contracts
- Contract addresses in `.env.contracts`

### With Lit Actions
- Grading service (PerformanceRegistry)
- Achievement checker (StudentProfile)
- Leaderboard updater (Leaderboard)

### With Frontend
- Read contract data via The Graph subgraph
- Write operations via wallet connection
- Grove URIs resolved via Lens SDK

## Next Steps

1. **Deploy Contracts:** Follow DEPLOYMENT.md guide
2. **Setup Master Pipeline:** Create pipeline scripts
3. **Test End-to-End:** Artist → Song → Segment → Performance
4. **Index via The Graph:** Create subgraph for efficient queries
5. **Build Frontend:** Integrate with contracts

## Comparison with V1

| Aspect | V1 (Old) | V2 (New) |
|--------|----------|----------|
| **Structure** | Monolithic KaraokeCatalog | Separated into 6 contracts |
| **Artist Link** | Weak (geniusArtistId field) | Strong (ArtistRegistry reference) |
| **Segment Model** | GeneratedSegment (karaoke stems) | Segment (TikTok portions) |
| **Performances** | Not tracked | PerformanceRegistry |
| **Students** | No profiles | StudentProfile with stats |
| **Leaderboards** | URI-based | On-chain structured data |
| **Gas Efficiency** | Not optimized | Optimized reads/writes |
| **Upgradeability** | Unclear versioning | Clear versioning (V1, V2, etc.) |

## License

MIT
